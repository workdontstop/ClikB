export type CinemaNarrationStage = {
  stage: "A" | "B";
  imageDescription: string;
  context: string;
  duration: number;
  intent?: unknown;
};

export type CinemaNarrationSource = {
  stage: "A" | "B";
  text: string;
  delivery?: string;
  stages: [CinemaNarrationStage, CinemaNarrationStage];
};

export type CinemaDialoguePlan = { stageA: string; stageB: string };

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// Other creation modes, supplemental shots, and old projects without narration
// keep their existing scene-driven dialogue path.
export const readCinemaNarrationSource = (
  creationType: unknown,
  value: unknown,
  duration: unknown
): CinemaNarrationSource | null => {
  if (Number(creationType) !== 1 || !record(value)) return null;
  if (value.stage !== "A" && value.stage !== "B") return null;
  if (typeof value.text !== "string" || !value.text.trim()) return null;
  if (!Array.isArray(value.stages) || value.stages.length !== 2) return null;
  const stageInputs: unknown[] = value.stages;
  const stages = (["A", "B"] as const).map(stage => {
    const input = stageInputs.find(item => record(item) && item.stage === stage);
    if (!record(input) || typeof input.imageDescription !== "string" || !input.imageDescription.trim()) return null;
    const seconds = Number(stage === value.stage ? duration : input.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return {
      stage, imageDescription: input.imageDescription.trim(),
      context: typeof input.context === "string" ? input.context : "",
      duration: seconds, ...(input.intent ? { intent: input.intent } : {}),
    };
  });
  if (!stages[0] || !stages[1]) return null;
  return {
    stage: value.stage, text: value.text.trim(),
    ...(typeof value.delivery === "string" && value.delivery.trim() ? { delivery: value.delivery.trim() } : {}),
    stages: [stages[0], stages[1]],
  };
};

export const cleanCinemaDialogue = (value: string): string => {
  const text = value.trim().replace(/^VOICE\s*&\s*DIALOG\s*:\s*/i, "")
    .replace(/\n\s*CONSTRAINTS\s*:[\s\S]*$/i, "").trim();
  return /^(?:no dialogue|none|n\/a)[.!]?$/i.test(text) ? "" : text;
};

export const readCinemaDialoguePlan = (value: unknown): CinemaDialoguePlan | null => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    } catch { return null; }
  }
  if (!record(parsed) || typeof parsed.stageA !== "string" || typeof parsed.stageB !== "string") return null;
  return { stageA: cleanCinemaDialogue(parsed.stageA), stageB: cleanCinemaDialogue(parsed.stageB) };
};

export const buildCinemaDialoguePrompt = (
  source: CinemaNarrationSource,
  lockedVisual: string,
  characters: unknown,
  videoDirections: string
): string => `
You adapt an existing Cinema speech script into native video dialogue. Plan BOTH consecutive stages together, then return their separate speech blocks.

ORIGINAL FULL NARRATION (the authoritative speech source, not a previous summary):
${JSON.stringify({ text: source.text, delivery: source.delivery ?? "" })}

STAGE A AND B (base frames, story context, intent, and selected seconds):
${JSON.stringify(source.stages)}

CURRENT STAGE ${source.stage} LOCKED VISUAL:
${lockedVisual}

CHARACTER IDENTITY AND VOICE GUIDANCE:
${JSON.stringify(characters ?? [])}

${videoDirections}

SPEECH ADAPTATION:
- Use the original narration's meaning, speaker, point of view, essential facts, uncertainty, setup, payoff, and personality. It may already be character dialogue despite its field name.
- Keep the original wording when it fits. If it is long, write a coherent shorter version that fits the selected durations; do not refuse or flag it as too long. A five-second Einstein explanation should become a logically condensed explanation, not an unrelated remark. A longer duration allows more of the original detail.
- Distribute the speech across A then B in story order, without repeating, restarting, contradicting, or prematurely resolving it. These are consecutive clips, not alternative versions. Each quoted line belongs to one stage only.
- Respect explicit stage speech/silence assignments and video directions. A silent establishing/action stage stays silent, with the necessary spoken summary in its assigned speaking stage. Without an explicit assignment, allocate naturally using both stage contexts.
- Budget each stage independently for clear natural delivery, its actions, and any requested text reveal or pause. Bracketed delivery tags guide performance and are not spoken words. Never speak bracketed tags or speaker labels.
${source.stages.map(item => `- Stage ${item.stage}: ${item.duration} seconds; at most ${Math.max(1, Math.floor(item.duration * 2.5))} spoken words, with fewer when motion or pauses need time.`).join("\n")}
- Use only the intended speaker(s) present in each stage's base frame, retaining exact character names/handles. Use the story and delivery guidance to identify the original speaker; do not substitute a different character merely because they are visible. Do not add people or invent a new conversation. Preserve explicitly requested voiceover as voiceover.
- Each speech block uses: <EXACT NAME + concise visual description> (delivery): says "line". Names/descriptions/delivery are not part of the spoken word budget. Use an empty string for a silent stage.

Return ONLY valid JSON with exactly this shape, no markdown:
{"stageA":"speech block or empty string", "stageB":"speech block or empty string"}
`.trim();
