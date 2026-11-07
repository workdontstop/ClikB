import type { Request, Response } from "express";
import OpenAI from "openai";
import { recordOpenAiUsage } from "./aiUsageLedger";
import dotenv from "dotenv";
import { beginLlmRequest, withLlmBilling } from "./llmBilling";
import { reasoningEffortForLanguageModel } from "./languageModels";
import type { CreationInference } from './creationModelProfiles';
import { createRoutedTextClient } from "./textGeneration";

dotenv.config();

/**
 * Global and per-scene intent both run on Luna. Intent describes material that
 * already exists — the plan and the scenes — rather than inventing it, so the
 * heavier StartStory models buy nothing here and cost time and money on every
 * scene of every creation.
 */
/**
 * Global is the only step doing cross-scene reasoning: hold every scene at once
 * and work out what carries from each into its neighbours. It is also a single
 * call, so the stronger model costs almost nothing in time or spend — and a
 * mistake here is inherited by every scene, since scene intent treats the note
 * as fact.
 */
export const INTENT_GLOBAL_MODEL =
  process.env.INTENT_GLOBAL_MODEL || "gpt-6.1-sol";

/**
 * Per-scene work is synthesis, not inference: one scene and one already-resolved
 * note, both written by stronger models, turned into prose. Cheap model, and it
 * runs six to twelve times per creation, which is where the time actually goes.
 */
export const INTENT_SCENE_MODEL =
  process.env.INTENT_SCENE_MODEL || "gpt-4.1-mini";

export const intentModelForMode = (_mode: IntentMode): string =>
  INTENT_SCENE_MODEL;

/**
 * Reconciliation rewrites one scene's passage against one committed image
 * prompt. Tightly scoped input, prose output, nothing to invent — the same
 * cheap model as compilation.
 */
export const SCENE_INTENT_RECONCILIATION_MODEL =
  process.env.INTENT_RECONCILE_MODEL || "gpt-4.1-mini";

type IntentMode = "shorts" | "cinema" | "interactive";
type CinemaStage = "A" | "B";

type CompileSceneInput = {
  sceneId: string;
  orderIndex: number;
  text: string;
  logicalSceneId?: string;
  stage?: CinemaStage;
};

type IntentAuditIssue = {
  code: string;
  message: string;
  sceneId?: string;
  factKey?: string;
};

type IntentAudit = {
  status: "valid" | "warning" | "invalid";
  issues: IntentAuditIssue[];
};

type JsonRecord = Record<string, unknown>;

type CompileRequestBody = {
  blueprintId?: unknown;
  mode?: unknown;
  originalPrompt?: unknown;
  creationType?: unknown;
  artStyle?: unknown;
  scenes?: unknown;
  planx?: unknown;
  characters?: unknown;
  referenceNotes?: unknown;
  sourceContextHash?: unknown;
};

type ReconcileRequestBody = {
  blueprintId?: unknown;
  sceneId?: unknown;
  mode?: unknown;
  previousSceneBlueprint?: unknown;
  previousImagePrompt?: unknown;
  committedImagePrompt?: unknown;
  editInstruction?: unknown;
  expectedSceneRevision?: unknown;
  expectedPromptHash?: unknown;
  committedPromptHash?: unknown;
};

const openai = createRoutedTextClient(new OpenAI({ apiKey: process.env.DALLE_KEY }));

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isIntentMode = (value: unknown): value is IntentMode =>
  value === "shorts" || value === "cinema" || value === "interactive";

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const cleanJsonText = (text: string): string =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

const normalizeForStableJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForStableJson);
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<JsonRecord>((result, key) => {
        if (value[key] !== undefined) {
          result[key] = normalizeForStableJson(value[key]);
        }
        return result;
      }, {});
  }
  return value;
};

export const hashIntentValue = (value: unknown): string => {
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(normalizeForStableJson(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `intent-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const normalizeAudit = (value: unknown): IntentAudit => {
  if (!isRecord(value)) return { status: "valid", issues: [] };
  const rawStatus = value.status;
  const status =
    rawStatus === "warning" || rawStatus === "invalid" ? rawStatus : "valid";
  const issues = Array.isArray(value.issues)
    ? value.issues
        .filter(isRecord)
        .map((issue) => ({
          code: asString(issue.code, "UNSPECIFIED"),
          message: asString(issue.message, "Unspecified intent audit issue"),
          ...(typeof issue.sceneId === "string"
            ? { sceneId: issue.sceneId }
            : {}),
          ...(typeof issue.factKey === "string"
            ? { factKey: issue.factKey }
            : {}),
        }))
    : [];
  return { status, issues };
};

const parseInteractivePrefix = (
  text: string
): {
  declaredNodeId?: string;
  parentNodeId?: string;
  branchLabel?: string;
  sourcePrefix?: string;
  branchingContext?: string;
} => {
  const prefixMatch = text.match(/^\s*(\[NODE\s+([^\]]+)\])/i);
  if (!prefixMatch) return {};
  const sourcePrefix = prefixMatch[1];
  const inside = prefixMatch[2].trim();
  const rootMatch = inside.match(/^(\d+)\s*-\s*ROOT$/i);
  if (rootMatch) {
    return {
      declaredNodeId: rootMatch[1],
      sourcePrefix,
      branchingContext: "root",
    };
  }
  const branchMatch = inside.match(
    /^(\d+)\s*-\s*BRANCH\s+FROM\s+(\d+)\s*:\s*(.+)$/i
  );
  if (branchMatch) {
    return {
      declaredNodeId: branchMatch[1],
      parentNodeId: branchMatch[2],
      branchLabel: branchMatch[3].trim(),
      sourcePrefix,
      branchingContext: `branch from ${branchMatch[2]}: ${branchMatch[3].trim()}`,
    };
  }
  const idMatch = inside.match(/^(\d+)/);
  return {
    ...(idMatch ? { declaredNodeId: idMatch[1] } : {}),
    sourcePrefix,
    branchingContext: inside,
  };
};

const validateCompileScene = (
  value: unknown,
  index: number,
  mode: IntentMode
): CompileSceneInput => {
  if (!isRecord(value)) throw new Error(`scenes[${index}] must be an object`);
  const sceneId = asString(value.sceneId).trim();
  const text = asString(value.text).trim();
  const orderIndex = value.orderIndex;
  if (!sceneId) throw new Error(`scenes[${index}].sceneId is required`);
  if (!text) throw new Error(`scenes[${index}].text is required`);
  if (!Number.isInteger(orderIndex) || Number(orderIndex) < 0) {
    throw new Error(`scenes[${index}].orderIndex must be a non-negative integer`);
  }
  if (mode === "cinema") {
    const logicalSceneId = asString(value.logicalSceneId).trim();
    if (!logicalSceneId) {
      throw new Error(`scenes[${index}].logicalSceneId is required for cinema`);
    }
    if (value.stage !== "A" && value.stage !== "B") {
      throw new Error(`scenes[${index}].stage must be A or B for cinema`);
    }
    return {
      sceneId,
      text,
      orderIndex: Number(orderIndex),
      logicalSceneId,
      stage: value.stage,
    };
  }
  return { sceneId, text, orderIndex: Number(orderIndex) };
};

const ensureScenePayload = (
  mode: IntentMode,
  modelScene: unknown,
  scene: CompileSceneInput
): JsonRecord | null => {
  // A scene blueprint is an envelope plus one passage of prose. The prose is
  // never parsed — it is handed to the image and video prompt writers as
  // context — so there is nothing here to validate beyond "is it text".
  const text =
    typeof modelScene === "string"
      ? modelScene.trim()
      : isRecord(modelScene)
        ? asString(modelScene.text).trim()
        : "";
  if (!text) return null;

  const sourceFields = {
    sceneId: scene.sceneId,
    mode,
    revision: 1,
    boundImagePromptHash: null,
    syncStatus: "ready",
    derivedFrom: "initial-compile",
    text,
  };

  if (mode === "interactive") {
    const parsedNode = parseInteractivePrefix(scene.text);
    return { ...sourceFields, kind: "interactive-node", node: parsedNode };
  }
  if (mode === "cinema") {
    return {
      ...sourceFields,
      kind: "cinema-stage",
      logicalSceneId: scene.logicalSceneId,
      stage: scene.stage,
    };
  }
  return { ...sourceFields, kind: "shorts-scene" };
};

const buildCinemaStructure = (
  scenes: CompileSceneInput[],
  modelStructure: unknown
): JsonRecord => {
  const structureRecord = isRecord(modelStructure) ? modelStructure : {};
  const modelLogicalScenes = isRecord(structureRecord.logicalScenes)
    ? structureRecord.logicalScenes
    : {};
  const logicalSceneOrder: string[] = [];
  const logicalScenes: JsonRecord = {};

  scenes.forEach((scene) => {
    if (!scene.logicalSceneId || logicalScenes[scene.logicalSceneId]) return;
    const pair = scenes.filter(
      (candidate) => candidate.logicalSceneId === scene.logicalSceneId
    );
    const stageAId = pair.find((candidate) => candidate.stage === "A")?.sceneId;
    const stageBId = pair.find((candidate) => candidate.stage === "B")?.sceneId;
    if (!stageAId || !stageBId) return;
    const modelLogical = isRecord(modelLogicalScenes[scene.logicalSceneId])
      ? (modelLogicalScenes[scene.logicalSceneId] as JsonRecord)
      : {};
    logicalSceneOrder.push(scene.logicalSceneId);
    logicalScenes[scene.logicalSceneId] = {
      logicalSceneId: scene.logicalSceneId,
      orderIndex: logicalSceneOrder.length - 1,
      stageAId,
      stageBId,
      sharedPurpose: asString(modelLogical.sharedPurpose),
      cinematicCoverageIntent: asString(modelLogical.cinematicCoverageIntent),
    };
  });

  return { kind: "cinema", logicalSceneOrder, logicalScenes };
};

const buildModeStructure = (
  mode: IntentMode,
  scenes: CompileSceneInput[],
  modelStructure: unknown
): JsonRecord => {
  if (mode === "cinema") return buildCinemaStructure(scenes, modelStructure);
  return { kind: mode };
};

/**
 * Canon is not regenerated. Planx already produced the characters, the art style
 * and (via prompt_summary) the brief one stage earlier, so the global blueprint
 * is assembled from it in code rather than paid for again in tokens. The model
 * is only asked for the one thing nothing upstream can produce: continuity.
 */
const buildGlobalFromPlanx = (
  planx: unknown,
  mode: IntentMode,
  artStyle: string
): JsonRecord => {
  const plan = isRecord(planx) ? planx : {};
  const summary = asString(plan.prompt_summary).trim();
  const planArtStyle = isRecord(plan.art_style) ? plan.art_style : {};
  const styleToken =
    asString(planArtStyle.style_token) ||
    (typeof plan.art_style === "string" ? plan.art_style : "") ||
    artStyle;

  const characters = Array.isArray(plan.characters)
    ? plan.characters.filter(isRecord).map((character, index) => ({
        key: asString(character.id, `char${index + 1}`),
        name: asString(character.name) || asString(character.id, `char${index + 1}`),
        facts: [
          {
            key: "appearance",
            value: asString(character.description),
            confidence: "high",
          },
        ].filter((fact) => asString(fact.value)),
      }))
    : [];

  const modeProfile: JsonRecord =
    mode === "shorts"
      ? { kind: "shorts", hook: "", payoff: "", beatMap: [] }
      : mode === "cinema"
        ? {
            kind: "cinema",
            narrativeArc: summary,
            actStructure: [],
            toneProgression: [],
            pacingNotes: [],
          }
        : {
            kind: "interactive",
            experienceKind: summary,
            userRole: "",
            progressionModel: "",
            interfaceLanguage: [],
          };

  return {
    title: "",
    overview: "",
    experienceType: "",
    premise: summary,
    userGoal: summary,
    audienceExpectation: "",
    canon: { characters, locations: [], props: [], worldRules: [] },
    visualLanguage: { artStyle: styleToken },
    globalMustPreserve: [],
    globalMustAvoid: [],
    modeProfile,
    audit: { status: "valid", issues: [] },
  };
};

const COMPILER_SYSTEM_PROMPT = (mode: IntentMode) => `
You are the Intent Blueprint compiler, running the GLOBAL pass. Return one strict JSON
object only. Never use markdown.

You wrote the scenes you are reading. This pass has ONE job: for each scene, say what the
surrounding scenes make true inside it.

Canon is NOT your job. Planx already carries the characters, the art style and the user's
request, and it is assembled in code. Do not restate any of it.

WHAT YOU WRITE:

1. "title" - a short, evocative title for this creation. A few words. No quotes, no
   punctuation at the end, no "A story about". Name the thing.

2. "overview" - two or three sentences of PLAIN TEXT written FOR THE USER, not for a model.
   This is shown on screen while their images are being made, so it should read well and feel
   like the piece is being understood. Say what they asked for, what is being created, what
   happens across it, and the feeling it is going for. Warm and concrete, never a list of
   fields and never a restatement of the prompt back at them. Present tense.

   good: "Aegon Targaryen's conquest of Westeros, told in six blood-red tableaux. It opens
          with three dragons above a divided realm and ends on the Iron Throne, with the
          Field of Fire and the fall of Storm's End between them. Epic, primal, and heavy
          with the cost of unity."

3. "sceneNotes" - for every supplied sceneId, one short passage of PLAIN TEXT. No markdown, no bullet points,
no labels, no JSON inside the string. Just sentences.

Say everything that carries into this scene from the ones around it and is still true here:
what has just happened, the condition of the characters, what they are wearing or carrying
after earlier events, the time of day, the weather, the state of the location, and — where
the piece has them — things like health, score, progress or objective as they would appear
on screen in this scene. Write it as a condition of THIS scene, never as a transition.

  good: "The fighting is over. The field is strewn with fallen soldiers, smoke still rising
         from the treeline, dawn fog low across the churned ground. He is wounded from the
         charge, armour scorched, sword still drawn."
  bad:  "The battle from scene 5 ends and then scene 6 begins."

Write "" when a scene owes nothing to the scenes around it.
Two or three sentences. It is a handoff, not a description of the whole frame.

${mode === "cinema" ? `CINEMA:
Each logical scene has a Stage A and a Stage B sceneId. Append one final sentence to each
saying what that stage covers relative to its partner, so the two do not duplicate each
other. Stage A is the wider establishing read, Stage B the closer one. If a scene describes a movie-poster cover with a Title, that cover title overlay belongs only to Stage A; Stage B is the pure visual continuation of the scene and must never carry a title or poster text overlay.` : `Each supplied sceneId represents one complete scene or node. Keep all information needed
to understand it in that scene; do not reserve details for an imagined partner shot.`}

RULES:
- Never write a transition, a downstream patch, a video prompt, or hotspot routing.
- Never carry a running total between scenes. Describe values as they appear in this scene.
- This is the ONLY place continuity is resolved. Every later pass treats your text as fact.

OUTPUT:
{
  "title": "short title",
  "overview": "two or three sentences for the user",
  "sceneNotes": { "<exact supplied sceneId>": "plain text passage" }
}
`.trim();

const SCENE_COMPILER_SYSTEM_PROMPT = (mode: IntentMode) => `
You are the Intent Blueprint compiler, writing the understanding of each supplied scene.
Return one strict JSON object only. Never use markdown.

You receive the global blueprint and the scenes to write. Between them they are the whole
truth — there is nothing else to consult. Each scene carries a continuityNote that is
established fact about that scene.

Read global.title and global.overview first. They say what this whole creation is and what
it is going for, so use them to place this scene inside the larger piece rather than treating
it as an isolated picture. global.canon names the characters and the art style; use those
names and that style. global.premise is the user's own request in their words.

WHAT YOU WRITE:
For each supplied sceneId, one passage of PLAIN TEXT. No markdown, no bullet points, no
labels, no field names, no JSON inside the string. Just sentences a reader absorbs in one go.

Cover, in prose and in whatever order reads best:
- what is in this frame: who is present and in what condition, where, what time, what
  weather, what they wear and carry, what objects matter
- what carried in from the continuityNote, stated as true here
- what is happening in this moment
- what the scene is for, and what it means in the piece
- what the viewer should feel and understand from it
- what motion and camera behaviour would suit it, if it were animated
- for an interactive node: what the participant is meant to do, what reads as interactive,
  and what any on-screen values or interface elements show

Be specific and concrete. Name things. A vague passage is a failed one. Four to six
sentences. You are adding understanding for whoever writes the image and video prompts —
you constrain nothing and forbid nothing.

Do not invent game mechanics, HUD, scores, win/lose states or inventory unless the scene or
the note actually has them.

${mode === "cinema" ? `WHEN TWO SCENES ARE SUPPLIED:
They are Stage A and Stage B of one cinema scene, written together so they cannot drift.
They describe the same moment and must agree on every shared fact — same characters, same
place, same time, same conditions. Stage A takes the wider establishing read, Stage B the
closer one. Neither is a transition into the other. If the scene describes a movie-poster cover with a Title, only Stage A carries the cover title text overlay; Stage B is the pure visual continuation and must never include a title or poster text overlay.` : `Each supplied sceneId represents one complete scene or node. Describe its full intended
content without reserving any of it for an imagined partner shot.`}

OUTPUT:
{ "scenes": { "<exact supplied sceneId>": "plain text passage" } }
`.trim();

const RECONCILER_SYSTEM_PROMPT = `
You rewrite the understanding of exactly ONE scene after its image prompt was committed.
Return one strict JSON object only. Never use markdown.

The picture changed, so the passage describing it is rewritten to match. You are context,
not a rule: you forbid nothing and gate nothing.

You receive the scene's previous passage and the newly committed image prompt. Rewrite the
passage so it describes what the committed prompt now shows and means. Keep whatever is
still true, drop whatever the new prompt no longer supports, and add what it introduces.
Anything the previous passage carried in from surrounding scenes goes first when it
conflicts with the new image.

Same shape as before: one passage of PLAIN TEXT, four to six sentences, no markdown, no
labels, no JSON inside the string. Cover what is in the frame, what is happening, what it
means, what the viewer should feel, and what motion would suit it.

Never write a global blueprint, another scene, a video prompt, or hotspot routing.
For an interactive node, also give its role in one or two words as "role".

OUTPUT:
{ "text": "plain text passage", "role": "only for interactive nodes" }
`.trim();

const requestJson = async (
  model: string,
  systemPrompt: string,
  userPayload: unknown,
  repairMessage?: string,
  inference?: CreationInference
): Promise<JsonRecord> => {
  console.log("[IntentBlueprint][LLM][request]", {
    model,
    repair: Boolean(repairMessage),
    payload: userPayload,
  });
  // No max_completion_tokens. Intent is only worth generating if it can be
  // specific, and a cap shared across a whole bundle is what made earlier
  // output thin. Each call below covers one scene or one global pass, so the
  // natural stopping point is the right one.
  const completion = await openai.chat.completions.create({
    model,
    ...(reasoningEffortForLanguageModel(model)
      ? { reasoning_effort: reasoningEffortForLanguageModel(model) }
      : {}),
    ...(inference?.reasoning_effort ? { reasoning_effort: inference.reasoning_effort } : {}),
    n: 1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      ...(repairMessage
        ? [
            {
              role: "system" as const,
              content: `REPAIR REQUIRED: ${repairMessage}`,
            },
          ]
        : []),
      { role: "user", content: JSON.stringify(userPayload) },
    ],
  });
  recordOpenAiUsage(model, completion, { repair: Boolean(repairMessage), reasoningEffort: inference?.reasoning_effort });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(`${model} returned an empty intent response`);
  const parsed = JSON.parse(cleanJsonText(content)) as unknown;
  if (!isRecord(parsed)) throw new Error("Intent response must be a JSON object");
  console.log("[IntentBlueprint][LLM][response]", {
    model,
    response: parsed,
  });
  return parsed;
};

const compileFromModelResult = (
  body: {
    blueprintId: string;
    mode: IntentMode;
    sourceContextHash: string;
    scenes: CompileSceneInput[];
  },
  modelResult: JsonRecord,
  scenePayloadsBySceneId: Record<string, unknown>
): JsonRecord => {
  // Canon always comes from Planx now; the model never returns a global block.
  const global = buildGlobalFromPlanx(undefined, body.mode, "");
  const scenes: JsonRecord = {};
  const missingSceneIds: string[] = [];

  body.scenes.forEach((scene) => {
    const payload = ensureScenePayload(
      body.mode,
      scenePayloadsBySceneId[scene.sceneId],
      scene
    );
    if (!payload) {
      missingSceneIds.push(scene.sceneId);
      return;
    }
    scenes[scene.sceneId] = {
      ...payload,
      sourceContextHash: body.sourceContextHash,
    };
  });

  if (Object.keys(scenes).length === 0) {
    throw new Error("Compiler returned no valid scene snapshots");
  }
  const modelAudit = normalizeAudit(modelResult.audit);
  const coverageIssues: IntentAuditIssue[] = missingSceneIds.map((sceneId) => ({
    code: "SCENE_BLUEPRINT_MISSING",
    message: "The compiler did not return a valid snapshot for this scene.",
    sceneId,
  }));
  const audit: IntentAudit = {
    status:
      coverageIssues.length > 0 && modelAudit.status === "valid"
        ? "warning"
        : modelAudit.status,
    issues: [...modelAudit.issues, ...coverageIssues],
  };

  return {
    schemaVersion: 1,
    blueprintId: body.blueprintId,
    revision: 1,
    mode: body.mode,
    sourceContextHash: body.sourceContextHash,
    global,
    modeStructure: buildModeStructure(
      body.mode,
      body.scenes,
      modelResult.modeStructure
    ),
    sceneOrder: body.scenes.map((scene) => scene.sceneId),
    scenes,
    audit,
  };
};

export const compileIntentBlueprint = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const raw = req.body as CompileRequestBody;
    const blueprintId = asString(raw.blueprintId).trim();
    const originalPrompt = asString(raw.originalPrompt).trim();
    const sourceContextHash = asString(raw.sourceContextHash).trim();
    if (!blueprintId || !originalPrompt || !sourceContextHash) {
      return res.status(400).send({
        message:
          "blueprintId, originalPrompt, and sourceContextHash are required",
      });
    }
    if (!isIntentMode(raw.mode)) {
      return res.status(400).send({ message: "Invalid intent mode" });
    }
    if (!Array.isArray(raw.scenes) || raw.scenes.length < 1 || raw.scenes.length > 18) {
      return res.status(400).send({ message: "scenes must contain 1 to 18 entries" });
    }
    const scenes = raw.scenes.map((scene, index) =>
      validateCompileScene(scene, index, raw.mode as IntentMode)
    );
    if (new Set(scenes.map((scene) => scene.sceneId)).size !== scenes.length) {
      return res.status(400).send({ message: "sceneId values must be unique" });
    }
    const safeBody = {
      blueprintId,
      mode: raw.mode,
      originalPrompt,
      creationType: raw.creationType,
      artStyle: asString(raw.artStyle),
      scenes,
      planx: raw.planx,
      characters: raw.characters,
      referenceNotes: Array.isArray(raw.referenceNotes)
        ? raw.referenceNotes
        : undefined,
      sourceContextHash,
    };

    const model = intentModelForMode(raw.mode);
    console.log("[IntentBlueprint][compile][start][legacy-whole-bundle]", {
      model,
      blueprintId,
      mode: raw.mode,
      sourceContextHash,
      sceneIds: scenes.map((scene) => scene.sceneId),
    });

    // Phase 1 - global pass. Canon, visual language, mode profile, and one
    // continuity note per scene. Continuity is resolved here and only here.
    let globalResult: JsonRecord | null = null;
    let globalError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        globalResult = await requestJson(
          model,
          COMPILER_SYSTEM_PROMPT(raw.mode as IntentMode),
          safeBody,
          attempt === 1 ? globalError : undefined
        );
        break;
      } catch (error: unknown) {
        globalError = error instanceof Error ? error.message : String(error);
        console.error("[IntentBlueprint][compile][global-attempt-failed]", {
          model,
          blueprintId,
          attempt: attempt + 1,
          error: globalError,
        });
        if (attempt === 1) throw error;
      }
    }
    if (!globalResult) throw new Error("Global intent pass produced no result");

    const globalBlueprint = globalResult.global;
    const sceneNotes = isRecord(globalResult.sceneNotes) ? globalResult.sceneNotes : {};

    // Phase 2 - one call per scene, all in flight together. Each scene gets the
    // finished global blueprint plus its own already-resolved continuity note,
    // so no scene call has to re-derive continuity and none competes with the
    // others for a shared output budget.
    const scenePayloadEntries = await Promise.all(
      scenes.map(async (scene) => {
        const note = isRecord(sceneNotes[scene.sceneId])
          ? (sceneNotes[scene.sceneId] as JsonRecord)
          : {};
        const scenePayload = {
          blueprintId,
          mode: raw.mode,
          originalPrompt,
          artStyle: asString(raw.artStyle),
          global: globalBlueprint,
          scene,
          continuityNote: typeof note === "string" ? note : asString((note as JsonRecord).continuityNote),
        };

        let sceneError = "";
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const result = await requestJson(
              model,
              SCENE_COMPILER_SYSTEM_PROMPT(raw.mode as IntentMode),
              scenePayload,
              attempt === 1 ? sceneError : undefined
            );
            return [scene.sceneId, result] as const;
          } catch (error: unknown) {
            sceneError = error instanceof Error ? error.message : String(error);
            console.error("[IntentBlueprint][compile][scene-attempt-failed]", {
              model,
              blueprintId,
              sceneId: scene.sceneId,
              attempt: attempt + 1,
              error: sceneError,
            });
          }
        }
        // A scene that will not compile is recorded as missing coverage rather
        // than failing the whole bundle. Every other scene still gets intent.
        return [scene.sceneId, null] as const;
      })
    );

    const scenePayloadsBySceneId: Record<string, unknown> = {};
    scenePayloadEntries.forEach(([sceneId, payload]) => {
      if (payload) scenePayloadsBySceneId[sceneId] = payload;
    });

    const bundle = compileFromModelResult(
      { blueprintId, mode: raw.mode, sourceContextHash, scenes },
      globalResult,
      scenePayloadsBySceneId
    );
    console.log("[IntentBlueprint][compile][created]", {
      model,
      blueprintId,
      sceneCount: Object.keys(scenePayloadsBySceneId).length,
      requestedSceneCount: scenes.length,
      bundle,
    });
    return res.status(200).send({ message: "Intent compiled", bundle, model });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Intent blueprint compile failed:", message);
    return res.status(502).send({ message: "Intent compilation failed", error: message });
  }
};

/**
 * Phase 1 on its own route. Canon, visual language, mode profile, and one
 * continuity note per scene — one call, nothing else waits behind it. The
 * caller fans out to compileSceneIntentSnapshot once per scene.
 */
export const compileGlobalIntent = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const raw = req.body as CompileRequestBody;
    const blueprintId = asString(raw.blueprintId).trim();
    const sourceContextHash = asString(raw.sourceContextHash).trim();
    if (!blueprintId || !sourceContextHash) {
      return res.status(400).send({
        message: "blueprintId and sourceContextHash are required",
      });
    }
    if (!isIntentMode(raw.mode)) {
      return res.status(400).send({ message: "Invalid intent mode" });
    }
    if (!raw.planx) {
      return res.status(400).send({ message: "planx is required" });
    }
    if (!Array.isArray(raw.scenes) || raw.scenes.length < 1 || raw.scenes.length > 18) {
      return res.status(400).send({ message: "scenes must contain 1 to 18 entries" });
    }
    const scenes = raw.scenes.map((scene, index) =>
      validateCompileScene(scene, index, raw.mode as IntentMode)
    );
    if (new Set(scenes.map((scene) => scene.sceneId)).size !== scenes.length) {
      return res.status(400).send({ message: "sceneId values must be unique" });
    }

    /* ---------- selectable model + flat charge ----------
       One charge for the whole global compile. The two-attempt repair loop
       below is internal to this one logical operation, and only a successful
       attempt is charged at all. */
    const llm = await beginLlmRequest(req, res, INTENT_GLOBAL_MODEL);
    if (!llm) return; // 400 / 401 / 402 already sent; never reached OpenAI
    const model = llm.model;
    // No originalPrompt: planx.prompt_summary already carries the user's request
    // forward from the plan stage. Resending the raw prompt would hand the model
    // two versions of the same brief to reconcile.
    const safeBody = {
      blueprintId,
      mode: raw.mode,
      creationType: raw.creationType,
      artStyle: asString(raw.artStyle),
      scenes,
      planx: raw.planx,
      characters: raw.characters,
      referenceNotes: asStringArray(raw.referenceNotes),
      sourceContextHash,
    };

    console.log("[IntentBlueprint][global][start]", {
      model,
      blueprintId,
      mode: raw.mode,
      sceneIds: scenes.map((scene) => scene.sceneId),
    });

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const modelResult = await requestJson(
          model,
          COMPILER_SYSTEM_PROMPT(raw.mode as IntentMode),
          safeBody,
          attempt === 1 ? lastError : undefined,
          llm.inference
        );
        // Canon comes from Planx, in code, for free. The model was only asked
        // for continuity, which is the one thing no earlier stage can supply.
        // Canon from Planx, plus the two human-facing fields the model writes:
        // a title and an overview the user reads while their images generate.
        const global = {
          ...buildGlobalFromPlanx(
            raw.planx,
            raw.mode as IntentMode,
            asString(raw.artStyle)
          ),
          title: asString(modelResult.title).trim(),
          overview: asString(modelResult.overview).trim(),
        };
        const sceneNotes = isRecord(modelResult.sceneNotes) ? modelResult.sceneNotes : {};
        const modeStructure = buildModeStructure(
          raw.mode,
          scenes,
          modelResult.modeStructure
        );

        console.log("[IntentBlueprint][global][created]", {
          model,
          blueprintId,
          attempt: attempt + 1,
          global,
          sceneNotes,
        });

        return res.status(200).send(
          await withLlmBilling(
            {
              message: "Global intent compiled",
              model,
              blueprintId,
              sourceContextHash,
              global,
              sceneNotes,
              modeStructure,
              audit: normalizeAudit(modelResult.audit),
            },
            llm.charge
          )
        );
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error("[IntentBlueprint][global][attempt-failed]", {
          model,
          blueprintId,
          attempt: attempt + 1,
          error: lastError,
        });
        if (attempt === 1) throw error;
      }
    }
    throw new Error("Global intent pass produced no result");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Global intent compile failed:", message);
    return res
      .status(502)
      .send({ message: "Global intent compilation failed", error: message });
  }
};

/**
 * Phase 2, one scene per request. The caller fires these concurrently, so a
 * scene never queues behind another scene's snapshot.
 */
export const compileSceneIntentSnapshot = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const raw = req.body as JsonRecord;
    const blueprintId = asString(raw.blueprintId).trim();
    const sourceContextHash = asString(raw.sourceContextHash).trim();
    if (!blueprintId || !sourceContextHash) {
      return res
        .status(400)
        .send({ message: "blueprintId and sourceContextHash are required" });
    }
    if (!isIntentMode(raw.mode)) {
      return res.status(400).send({ message: "Invalid intent mode" });
    }
    if (!isRecord(raw.global)) {
      return res.status(400).send({ message: "global is required" });
    }
    // One or two scenes. Cinema sends Stage A and Stage B of the same logical
    // scene together: the image call consumes both, so deciding them in one pass
    // is what stops them drifting apart, and it halves cinema's call count.
    const rawScenes = Array.isArray(raw.scenes)
      ? raw.scenes
      : raw.scene !== undefined
        ? [raw.scene]
        : [];
    if (rawScenes.length < 1 || rawScenes.length > 2) {
      return res
        .status(400)
        .send({ message: "scenes must contain 1 or 2 entries" });
    }
    const scenes = rawScenes.map((scene, index) =>
      validateCompileScene(scene, index, raw.mode as IntentMode)
    );
    const notesBySceneId = isRecord(raw.notes) ? raw.notes : {};
    const model = intentModelForMode(raw.mode);

    // Global blueprint + these scenes, and nothing else. The global pass already
    // read the original prompt, Planx and every scene; re-sending those here
    // just gives the model competing sources to reconcile.
    const scenePayload = {
      blueprintId,
      mode: raw.mode,
      global: raw.global,
      scenes: scenes.map((scene) => {
        // Global now returns one plain passage per scene, not a field bag.
        const note = notesBySceneId[scene.sceneId];
        return {
          ...scene,
          continuityNote:
            typeof note === "string"
              ? note
              : isRecord(note)
                ? asString(note.continuityNote)
                : "",
        };
      }),
    };

    console.log("[IntentBlueprint][scene][start]", {
      model,
      blueprintId,
      sceneIds: scenes.map((scene) => scene.sceneId),
    });

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const modelResult = await requestJson(
          model,
          SCENE_COMPILER_SYSTEM_PROMPT(raw.mode as IntentMode),
          scenePayload,
          attempt === 1 ? lastError : undefined
        );
        const modelScenes = isRecord(modelResult.scenes) ? modelResult.scenes : {};
        const sceneBlueprints: JsonRecord = {};
        scenes.forEach((scene) => {
          const payload = ensureScenePayload(
            raw.mode as IntentMode,
            modelScenes[scene.sceneId],
            scene
          );
          if (payload) {
            sceneBlueprints[scene.sceneId] = { ...payload, sourceContextHash };
          }
        });
        if (Object.keys(sceneBlueprints).length !== scenes.length) {
          throw new Error("Scene compiler returned an unusable snapshot");
        }

        console.log("[IntentBlueprint][scene][created]", {
          model,
          blueprintId,
          sceneIds: scenes.map((scene) => scene.sceneId),
          attempt: attempt + 1,
          sceneBlueprints,
        });
        return res.status(200).send({
          message: "Scene intent compiled",
          model,
          sceneBlueprints,
        });
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error("[IntentBlueprint][scene][attempt-failed]", {
          model,
          blueprintId,
          sceneIds: scenes.map((scene) => scene.sceneId),
          attempt: attempt + 1,
          error: lastError,
        });
        if (attempt === 1) throw error;
      }
    }
    throw new Error("Scene intent pass produced no result");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scene intent compile failed:", message);
    return res
      .status(502)
      .send({ message: "Scene intent compilation failed", error: message });
  }
};

export const reconcileSceneIntent = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const raw = req.body as ReconcileRequestBody;
    const blueprintId = asString(raw.blueprintId).trim();
    const sceneId = asString(raw.sceneId).trim();
    const previousImagePrompt = asString(raw.previousImagePrompt);
    const committedImagePrompt = asString(raw.committedImagePrompt).trim();
    const expectedPromptHash = asString(raw.expectedPromptHash).trim();
    const committedPromptHash = asString(raw.committedPromptHash).trim();
    if (!blueprintId || !sceneId || !committedImagePrompt) {
      return res.status(400).send({
        message: "blueprintId, sceneId, and committedImagePrompt are required",
      });
    }
    if (!isIntentMode(raw.mode) || !isRecord(raw.previousSceneBlueprint)) {
      return res.status(400).send({ message: "Invalid mode or previous blueprint" });
    }
    if (
      !Number.isInteger(raw.expectedSceneRevision) ||
      raw.previousSceneBlueprint.revision !== raw.expectedSceneRevision
    ) {
      return res.status(409).send({ message: "Scene intent revision is stale" });
    }
    if (raw.previousSceneBlueprint.sceneId !== sceneId) {
      return res.status(400).send({ message: "sceneId does not match blueprint" });
    }
    if (
      expectedPromptHash !== hashIntentValue(previousImagePrompt) ||
      raw.previousSceneBlueprint.boundImagePromptHash !== expectedPromptHash
    ) {
      return res.status(409).send({ message: "Previous image prompt hash is stale" });
    }
    if (committedPromptHash !== hashIntentValue(committedImagePrompt)) {
      return res.status(400).send({ message: "Committed image prompt hash is invalid" });
    }

    console.log("[IntentBlueprint][reconcile][start]", {
      model: SCENE_INTENT_RECONCILIATION_MODEL,
      blueprintId,
      sceneId,
      mode: raw.mode,
      expectedSceneRevision: raw.expectedSceneRevision,
      expectedPromptHash,
      committedPromptHash,
      editInstruction: asString(raw.editInstruction),
    });

    const modelResult = await requestJson(
      SCENE_INTENT_RECONCILIATION_MODEL,
      RECONCILER_SYSTEM_PROMPT,
      {
        blueprintId,
        sceneId,
        mode: raw.mode,
        previousSceneBlueprint: raw.previousSceneBlueprint,
        previousImagePrompt,
        committedImagePrompt,
        editInstruction: asString(raw.editInstruction),
      }
    );
    const text = asString(modelResult.text).trim();
    if (!text) {
      throw new Error("Reconciler response is missing text");
    }

    const previous = raw.previousSceneBlueprint;
    const nextScene: JsonRecord = {
      ...previous,
      // An explicit edit creates a new canonical prompt; never inherit the old opening handoff.
      imagePacing: undefined,
      imagePacingContext: previous.imagePacing || previous.imagePacingContext,
      lastEditInstruction: asString(raw.editInstruction),
      revision: Number(raw.expectedSceneRevision) + 1,
      boundImagePromptHash: committedPromptHash,
      syncStatus: "ready",
      derivedFrom: "image-prompt-edit",
      text,
    };
    if (raw.mode === "interactive") {
      // Routing fields belong to the frontend hotspot tree. Carry the previous
      // values through verbatim so the reconciler cannot rewire the graph; only
      // the role is re-read against the committed frame.
      const previousNode = isRecord(previous.node) ? previous.node : {};
      const role = asString(modelResult.role).trim() || asString(previousNode.role);
      nextScene.node = { ...previousNode, ...(role ? { role } : {}) };
    }

    console.log("[IntentBlueprint][reconcile][created]", {
      model: SCENE_INTENT_RECONCILIATION_MODEL,
      blueprintId,
      sceneId,
      previousRevision: raw.expectedSceneRevision,
      nextRevision: nextScene.revision,
      committedPromptHash,
      sceneBlueprint: nextScene,
    });

    return res.status(200).send({
      message: "Scene intent reconciled",
      sceneBlueprint: nextScene,
      expectedSceneRevision: raw.expectedSceneRevision,
      committedPromptHash,
      model: SCENE_INTENT_RECONCILIATION_MODEL,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scene intent reconciliation failed:", message);
    return res
      .status(502)
      .send({ message: "Scene intent reconciliation failed", error: message });
  }
};
