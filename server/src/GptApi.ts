import { Request, Response } from "express";

import OpenAI from "openai";
import { buildBrainstormRagSystemContext } from "./RagVectorService";

import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file  generateGPT4oPromptProWeb

const GPTKey = process.env.DALLE_KEY;

const openai = new OpenAI({
  apiKey: GPTKey,
});

// --- types that mirror your original roles GptInjectCharacters, EditGeneratedVisualTextOnly ---
type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

// --- Model Directive Helper ---
export function getModelDirective(
  modelName?: string,
  duration?: any,
  hasAudio: boolean = true,
  ratioKey?: number,
  useModelSpecificDirective: boolean = true
): string {
  const timeContext = duration
    ? `\n- PACING & TIME ADAPTATION: The target duration is ${duration} seconds. Adapt your shot list to fit this time perfectly.\n- If the duration is long, you MUST create dynamic multiple angle shots, time-lapse shots, or smooth slow-mo shots to keep the scene professional.`
    : "";

  let ratioSuffix = " / 16:9";
  if (ratioKey === 1) ratioSuffix = " / 9:16";
  else if (ratioKey === 2) ratioSuffix = " / 1:1";
  else if (ratioKey === 3) ratioSuffix = " / 16:9";
  else if (ratioKey) ratioSuffix = ""; // Fallback if ratioKey 4 is added later

  const audioGlobalRules = hasAudio
    ? `
- AUDIO / NO MUSIC FORMAT: You MUST append the following block exactly at the very end of your prompt to strictly enforce audio constraints:
CONSTRAINTS:
	Music: none
- Do NOT introduce music unless explicitly demanded by the user.`
    : `
- NO AUDIO MODE: Do NOT generate a VOICE & DIALOG section. Do NOT generate a CONSTRAINTS section.`;

  const baseRules = `
--- GLOBAL DIRECTING & AUDIO RULES ---${audioGlobalRules}
- ON-DEMAND CAMERA SHIFTS: If the user requests a radical change (e.g., "freeze frame", "slow mo"), overhaul the timeline or shot block to execute that cinematic technique flawlessly.${timeContext}
`.trim();

  // Audio templates
  const klingAudio = hasAudio
    ? `
VOICE & DIALOG:
	[Character Name, Voice Quality]: "Spoken text."
CONSTRAINTS:
	Music: none`
    : "";

  const klingAudioEx = hasAudio
    ? `
VOICE & DIALOG:
	[Detective, gruff and tired]: "It ends here."
CONSTRAINTS:
	Music: none`
    : "";

  const seedanceAudio = hasAudio
    ? `
VOICE & DIALOG:
	[Character Name, Voice Quality]: "Spoken text."
CONSTRAINTS:
	Music: none`
    : "";

  const seedanceAudioEx = hasAudio
    ? `
VOICE & DIALOG:
	[Woman, whispering with breath visible in cold air]: "They found us."
CONSTRAINTS:
	Music: none`
    : "";

  const legacyAudioHeaders = hasAudio ? `\n  VOICE & DIALOG:` : "";
  const legacyAudioGuidance = hasAudio
    ? `

VOICE & DIALOG:
- Extract dialogue spoken by characters from the Story Context ("question").
- CRITICAL PACING: You MUST respect the ${
        duration ? duration + " second" : "short"
      } video duration. If the duration is 5 seconds, limit dialogue to ONE concise sentence maximum! Do not generate two lines of dialogue for a 5-second video.
- Format exactly as: Character Name, [brief action or state] (Voice Quality): says "Spoken text."
- Do NOT cram massive visual descriptions into this section; keep character descriptions here very brief.
- If there is no dialogue implied, describe natural ambient audio.`
    : "";

  if (useModelSpecificDirective && modelName === "pPro") {
    return (
      baseRules +
      `

--- MODEL DIRECTIVE: KLING 3.0 OMNI (CINEMATIC MULTI-SHOT ENGINE) ---
You are directing Kling 3.0 Omni, a cinematic multi-shot storytelling engine.
NO KEYWORD STUFFING. Use explicit lensing, camera rigs, and lighting recipes.
CRITICAL LIMIT: Kling has a hard limit of 2500 characters. Your ENTIRE OUTPUT MUST NOT exceed 300 words (or 2000 characters) total. Be extremely concise. Cut unnecessary adjectives.

KLING 3.0 MULTI-SHOT TEMPLATE FORMAT (Use this exact structure):
SHOT 1 (X seconds): [Camera Lensing/Rig] [Subject Action & Micro-motions] [Lighting & Texture]
SHOT 2 (Y seconds): [Camera Lensing/Rig] [Subject Action] [Lighting]${klingAudio}

EXAMPLE:
SHOT 1 (4 seconds): 35mm Steadicam pushes in slowly. The detective places a folder on the wet table. Flickering fluorescent lighting overhead casts harsh shadows.
SHOT 2 (4 seconds): Extreme close-up on the folder, 85mm macro lens. Rain beads on the leather jacket.${klingAudioEx}

(Ensure shots add up to the total duration. Describe contact friction to ground characters.)
`.trim()
    );
  } else if (useModelSpecificDirective && (modelName === "Pro" || modelName === "Minix")) {
    return (
      baseRules +
      `

--- MODEL DIRECTIVE: SEEDANCE 2.0 (THE OMNI-LEVEL PHYSICS ENGINE) ---
You are directing Seedance 2.0. Speak strictly in optical physics, lighting terminology, and spatial geometry. Drop abstract adjectives.

SEEDANCE 2.0 TIMELINE TEMPLATE FORMAT (Use this exact structure):
HEADER: Total: [Duration]s / [N] shots${ratioSuffix}
SHOT 0:00-0:03: [Camera Vector] [Subject Material & Kinetic Action] [Environment Depth] [Lighting/Style]
SHOT 0:03-0:06: [Camera Vector] [Subject Action] [Lighting]${seedanceAudio}

EXAMPLE:
HEADER: Total: 6s / 2 shots${ratioSuffix || " / 16:9"}
SHOT 0:00-0:03: 100mm macro slow push-in. A young woman slowly turns her head. Rain-slicked pavement reflects golden hour backlighting.
SHOT 0:03-0:06: 240fps feel speed ramp. Close-up on her face, eyes widening as droplets splash outward on the wet asphalt.${seedanceAudioEx}

(Use chain-of-thought physics for destruction. Keep camera static if subject motion is highly complex.)
`.trim()
    );
  }

  return (
    baseRules +
    `

--- MODEL DIRECTIVE: STANDARD MODELS ---
STRICT FORMAT RULES:
- Output a SINGLE TEXT BLOCK. NO TIMESTAMPS. NO SHOTS BREAKDOWN.
- Keep the description flowing naturally as one continuous paragraph per section.
- BE EXTREMELY CONCISE. Your entire output MUST NOT exceed 60 words per section. Cut unnecessary adjectives and avoid bloated descriptions. Short and punchy.
- Organize the text into these exact sections, in this exact order:
  CAMERA:
  MOTION:${legacyAudioHeaders}

SECTION CONTENT GUIDANCE:
CAMERA:
- Describe the camera movements, lensing, and framing for the scene naturally. Keep it very brief.

MOTION:
- Describe the physical actions and environment without rigid constraints, but keep it very brief.${legacyAudioGuidance}
`.trim()
  ); // Fallback for all other models
}

// --- URL helpers: keep only the registrable root (e.g., james.com) ---
function rootDomainFromUrl(raw: string): string {
  try {
    const url = new URL(raw.includes("://") ? raw : "http://" + raw);
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);

    const parts = host.split(".");
    // Heuristic: keep e.g. "james.co.uk"
    const isCC = parts[parts.length - 1]?.length === 2;
    const sld = parts[parts.length - 2];
    const sldLike = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
    if (parts.length >= 3 && isCC && sldLike.has(sld)) {
      return parts.slice(-3).join(".");
    }
    // Default: last two labels
    return parts.slice(-2).join(".");
  } catch {
    // If not a URL, strip leading www.
    return raw.replace(/^www\./i, "");
  }
}

// --- duplicate URL utilities (global across the whole text) ---
function removeDuplicateUrls(text: string): string {
  const seen = new Set<string>();

  // 1) Handle markdown links first so we can keep anchor text for dups
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (match, anchor: string, url: string) => {
      const root = rootDomainFromUrl(url);
      if (seen.has(root)) return anchor; // keep readable text, drop duplicate URL
      seen.add(root);
      return match; // keep first occurrence intact
    }
  );

  // 2) Handle bare links (http/https/www)
  const bare = /(https?:\/\/[^\s)\]]+)|\bwww\.[^\s)\]]+/gi;
  text = text.replace(bare, (match) => {
    const root = rootDomainFromUrl(match);
    if (seen.has(root)) return ""; // remove duplicate entirely
    seen.add(root);
    return match; // keep first
  });

  return text;
}

// Convert markdown links to "anchor (domain)" and bare links to just the root domain
function simplifyLinks(s: string): string {
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_, anchor: string, url: string) => `${anchor} (${rootDomainFromUrl(url)})`
  );
  const urlLike = /(https?:\/\/[^\s)\]]+)|\bwww\.[^\s)\]]+/gi;
  s = s.replace(urlLike, (m) => rootDomainFromUrl(m));
  return s;
}

/**
 * Web-search enabled version with same input/output format as your original .
 * - Accepts messages as { role: string; content: string }[]
 * - Uses Responses API + `web_search_preview`
 * - Returns an array of non-empty lines
 *   (after removing duplicate URLs by root domain and collapsing links)
 *
 * Note: ensure GPTKey is defined (e.g., from env).
 */

export async function generateGPT4oPromptProWeb(
  messages: { role: string; content: string }[]
) {
  const openai = new OpenAI({ apiKey: GPTKey });

  // Narrow roles ("user" | "assistant" | "system")
  const coerced: Msg[] = messages.map((m) => {
    const r = m.role.toLowerCase();
    if (r === "user" || r === "assistant" || r === "system") {
      return { role: r as Role, content: m.content };
    }
    throw new Error(`Invalid role: ${m.role}`);
  });

  // Try your preferred model; if hosted tool isn't supported, fall back to gpt-4o
  const tryModels: readonly string[] = ["gpt-5.5", "gpt-5.5"];

  let lastErr: unknown;
  console.log("last error gpt web", lastErr);

  for (const model of tryModels) {
    try {
      const res = await openai.responses.create({
        model,
        input: coerced,
        tools: [{ type: "web_search_preview" }], // preview tool name per current SDK typings
        tool_choice: "auto",
        max_output_tokens: 3000,
      });

      // Prefer SDK helper; fallback assembles text from items
      // @ts-ignore - available on recent SDKs
      const text: string =
        (res as any).output_text ??
        (res.output ?? [])
          .flatMap((o: any) => (o.content ?? []).map((c: any) => c.text ?? ""))
          .join("\n");

      if (!text) throw new Error("Incomplete response from OpenAI");

      // First remove duplicate URLs across the whole text, then simplify link display
      const deduped = removeDuplicateUrls(text);

      return deduped
        .split("\n")
        .map((line) => simplifyLinks(line).trim())
        .filter((line) => line !== "");
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? "").toLowerCase();
      // Only fall back if the model doesn't support the hosted tool
      if (
        msg.includes("hosted tool") ||
        msg.includes("not supported") ||
        msg.includes("tools are not available")
      ) {
        continue;
      }
      throw err; // surface unrelated errors
    }
  }

  // As a last resort, call without tools (still keep your output format)
  const res = await openai.responses.create({
    model: "gpt-5.5",
    input: coerced,
    max_output_tokens: 3000,
  });

  // @ts-ignore

  const text: string =
    (res as any).output_text ??
    (res.output ?? [])
      .flatMap((o: any) => (o.content ?? []).map((c: any) => c.text ?? ""))
      .join("\n");

  if (!text) throw new Error("Incomplete response from OpenAI");

  const deduped = removeDuplicateUrls(text);

  return deduped
    .split("\n")
    .map((line) => simplifyLinks(line).trim())
    .filter((line) => line !== "");
}

async function generateGPT4oPromptProWebT(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-5.1", // Change to GPT-4o
    max_completion_tokens: 3000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}

async function generateGPT4oPromptProWebX(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-5.2", // Change to GPT-4o
    max_completion_tokens: 3000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}

export async function generateGPT4oPromptTTS(messages: any) {
  const ttsResponseSchema = {
    type: "json_schema",
    json_schema: {
      name: "gemini_tts_payload_array",
      strict: true,
      schema: {
        type: "object",
        properties: {
          keyPoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                voice: {
                  type: "string",
                  description: "The designated character voice for the audio.",
                  enum: [
                    "Zephyr",
                    "Puck",
                    "Charon",
                    "Kore",
                    "Fenrir",
                    "Leda",
                    "Orus",
                    "Aoede",
                    "Callirrhoe",
                    "Autonoe",
                    "Enceladus",
                    "Iapetus",
                    "Umbriel",
                    "Algenib",
                    "Despina",
                    "Erinome",
                    "Laomedeia",
                    "Achernar",
                    "Algieba",
                    "Schedar",
                    "Gacrux",
                    "Pulcherrima",
                    "Achird",
                    "Zubenelgenubi",
                    "Vindemiatrix",
                    "Sadachbia",
                    "Sadaltager",
                    "Sulafat",
                    "Alnilam",
                    "Rasalgethi",
                  ],
                },
                prompt: {
                  type: "string",
                  description:
                    "The Director's Notes. Establishes the character's persona, environmental context, and the overall emotional arc. Maximum 4,000 bytes.",
                },
                text: {
                  type: "string",
                  description:
                    "The dialogue script. Must include inline markup tags like [sigh], [laughing], [whispering], [shouting], or [medium pause] to shift emotions mid-sentence and avoid a robotic delivery. Maximum 4,000 bytes.",
                },
                language_code: {
                  type: "string",
                  description:
                    "BCP-47 language code for the speech output (e.g., 'en-US', 'en-GB').",
                },
              },
              required: ["voice", "prompt", "text", "language_code"],
              additionalProperties: false,
            },
          },
        },
        required: ["keyPoints"],
        additionalProperties: false,
      },
    },
  };

  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-4o",
    response_format: ttsResponseSchema as any,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }
  return completion.choices[0].message.content;
}

async function generateGPT4oPromptP(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-4.1-mini", // Change to GPT-4o
    max_completion_tokens: 3000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}

async function generateGPT4oPrompt(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-4.1-mini", // Change to GPT-4o
    max_completion_tokens: 3000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}

async function generateGPT4oPrompt5B(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-5.1",
    max_completion_tokens: 4000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}
async function generateGPT4oPrompt5(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-5.1",

    max_completion_tokens: 4000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}

async function generateGPT4oPromptx(messages: any) {
  const completion = await openai.chat.completions.create({
    messages,
    model: "gpt-4.1-mini", // Change to GPT-4o
    max_completion_tokens: 3000,
    n: 1,
  });

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0] ||
    !completion.choices[0].message ||
    !completion.choices[0].message.content
  ) {
    throw new Error("Incomplete response from OpenAI");
  }

  return completion.choices[0].message.content
    .split("\n")
    .filter((line) => line.trim() !== "");
}

export const GptApiSum = async (req: Request, res: Response): Promise<any> => {
  const { pp } = req.body;

  try {
    /* ------------------------------------------------------------------ */
    /* 1. Prompt â€“ no change to your wrapperâ€™s signature ImageDesignStory                  */
    /* ------------------------------------------------------------------ */
    const initialMessages = [
      {
        role: "system",
        content:
          // ask VERY explicitly â€“ OpenAI usually obeys
          "Return ONLY this exact JSON (no markdown):\n" +
          '{"title":"<1-2 words>","summary":"<50-70 chars>"}',
      },
      {
        role: "user",
        content: `Create the JSON summary for: ${pp}`,
      },
    ];

    /* ------------------------------------------------------------------ */
    /* 2. Call the model                                                  */
    /* ------------------------------------------------------------------ */
    const raw = await generateGPT4oPrompt(initialMessages); // <-- same call

    /* ------------------------------------------------------------------ */
    /* 3. Make sure we can parse it                                       */
    /* ------------------------------------------------------------------ */
    // If your wrapper returns an array, join it; otherwise leave as-is.
    const text = Array.isArray(raw) ? raw.join("") : String(raw ?? "").trim();

    // Strip ```json fences or plain ``` if they sneak in.
    const cleaned = text
      .replace(/```json\s*([\s\S]*?)```/gi, "$1")
      .replace(/```([\s\S]*?)```/g, "$1")
      .trim();

    const { title, summary } = JSON.parse(cleaned); // throws if not valid

    /* ------------------------------------------------------------------ */
    /* 4. Respond                                                         */
    /* ------------------------------------------------------------------ */
    return res.send({ message: "Done", title, summary });
  } catch (e: any) {
    console.error("Error:", e.message);
    return res
      .status(500)
      .send({ message: "Error in accessing ChatGPT API or parsing JSON" });
  }
};

export const GptApi = async (req: Request, res: Response): Promise<any> => {
  const { pp, prompt, long } = req.body;

  console.log(prompt);

  var t = "";
  if (long === 1) {
    t = "7. Return maximum of 350 chars";
  } else {
    t = "7. Return maximum of 350 chars";
  }
  const systemPrompt = `
You are an advanced AI expert in generating highly descriptive, engaging, and vivid story-like prompts tailored specifically for Flux image generation.

Strict Guidelines:
1. Craft a concise, captivating narrative rich in visual and sensory detail.
2. Clearly depict essential visual elements including distinct characters, detailed environments, evocative mood, specific locations, accurate skin tones, expressive facial features, and meaningful interactions.
3. Prioritize clarity and vividness by immediately highlighting key visual and narrative details.
4. Avoid mentioning explicit art styles (e.g., photorealistic, cinematic, painterly) or technical visual terms.
5. Allow creative freedom by refraining from specifying camera angles, framing, or precise composition details.
6. Deliver only the enhanced prompt, without extra explanations, JSON, code fences, or supplementary text.
${t}
`;

  const userPrompt = `Create a highly vivid and engaging visual prompt based on: \"${pp}\".`;

  try {
    const initialMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const initialResponseData = await generateGPT4oPrompt(initialMessages);

    const initialResponseFormatted = Array.isArray(initialResponseData)
      ? initialResponseData.join(" ")
      : initialResponseData;

    console.log(initialResponseFormatted.trim());
    return res.send({
      message: "Done",
      initialSteps: initialResponseFormatted.trim(),
    });
  } catch (e: any) {
    console.error("Error:", e.message);
    return res.status(500).send({ message: "Error accessing ChatGPT API" });
  }
};

/* ------------------------------------------------------------------ */
/*  0.  Mood catalogue â€“ you can add / remove styles here              */
/* ------------------------------------------------------------------ */
const MOOD_GUIDES: Record<string, string> = {
  Friendly: `
â€” Use a warm, conversational tone (contractions welcome).
â€” Optionally open with a short greeting (max 5 words).`,
  "Movie Recap": `
â€” Describe events like snappy scene summaries.
â€” Keep tense consistent (present tense works well).`,
  Documentary: `
â€” Maintain a calm, third-person narrator voice.
â€” Weave in one date, place, or statistic if context supplies it.`,
  "Story Time": `
â€” Begin with a mini hook.
â€” Drop in 1â€“2 vivid sensory details when relevant.`,
  Explainer: `
â€” Focus on how and why; include at least one causal phrase.`,
  Comedian: `
â€” Slip in a light one-liner or witty parenthetical per bullet.
â€” Keep humour on-topic.`,
  Upbeat: `
â€” Keep sentences brisk and energetic; sprinkle positive adjectives.
â€” End with a quick motivational note if it fits.`,
  "News Reporter": `
â€” Lead with who/what/when in the first sentence.
â€” Follow inverted-pyramid order: key fact, then details.`,
};

const MOOD_GUIDES2: Record<string, string> = {
  Visualizer: `
â€” You describe things like they would look in a visual scene.
â€”  You are a master of description of what images would look like to other a.i models`,
};
/* ------------------------------------------------------------------ */
/*  1.  Hard-rules prompt (unchanged)                                 */
/* ----------------------------------------------------
-------------- */

const rigidRules = `
You are a highly reliable AI. Strictly adhere to the following rules:
0. **Scene count contract:** If the user's prompt specifies an exact number of scenes, story scenes, bullet points, or keyPoints, return exactly that many keyPoints total; this overrides any default bullet-count range below. The cinematic intro, poster, cover, or title scene is always keyPoints[0] / Scene 1 and counts inside that requested number. Never add a separate extra intro, title, poster, or cover scene before or after the requested count. For example, if the user asks for 5 scenes, return 5 total keyPoints: Scene 1 is the intro/poster scene, and Scenes 2-5 continue and conclude the story.
1. Respond with exactly 3 to 8 bullet points in total.
   â€¢ **The final bullet point must double as a short conclusion / ending with short ending dialog**  that
     wraps up the story or video in the same mood and echoes the user's prompt.
2. Each bullet point must have between 1 â€“ 4 sentences, providing
   **specific, concrete details** about events, actions, facts, or tangible
   outcomes.
3. Do NOT use vague or generic attributes such as resilience, courage,
   charisma, prowess, strength, or leadership growth etc.
4. Omit any attribute you cannot ground in a concrete action or event.
5. **Return valid JSON only** in this exact shapeâ€”nothing before or after it:
   {
     "keyPoints": ["Point 1", "Point 2", â€¦]
   }
6. Include descriptive or visual details only when the context calls for it.
7. **Do not add explanations, warnings, or any extra text outside the JSON.**
`.trim();

const rigidRules2 = `
You are a highly reliable AI. Strictly adhere to the following rules:
1. Respond with exactly 1 to 4 bullet points in total if number of scenes not specified by prompt if number of scenes specified follow prompt.

2. Each bullet point must have between 1 â€“ 4 sentences, providing
   **A detailed visual description of a scene , this scene should have all details needed for a.i image generation except art style,all scenes are
   a complete text representation of an image.
5. **Return valid JSON only** in this exact shapeâ€”nothing before or after it:
   {
     "keyPoints": ["Point 1", "Point 2", â€¦]
   }
6. Include descriptive visual details following context.
7. **Do not any extra text outside the JSON.**
`.trim();

const rigidRulesInt = `
You are a highly reliable AI. Strictly adhere to the following rules:
1. Respond with exactly 1 to 4 bullet points in total if number of scenes not specified by prompt if number of scenes specified follow prompt.

2. Each bullet point must have between 1 â€“ 4 sentences, providing
   **A detailed visual description of a scene , this scene should have all details needed for a.i image generation except art style,all scenes are
   a complete text representation of an image.
3. **PREMIUM UI & CLUTTER-FREE CONSTRAINTS:**
   - **No Fake Buttons After Intro:** Node 1 (The Intro/Main Menu) is the ONLY scene allowed to have text buttons (like 'Start' or 'Engage'). For ALL subsequent nodes, DO NOT generate any interactive buttons, text labels, or prompts in the middle of the screen.
   - **Clean & Premium Aesthetic:** Maintain a premium, uncluttered "AI Game" feel. Only include UI elements (like headers or top indicators) if they are intrinsically necessary to the story vibe. No generic inventories unless requested.
   - **Absolute Consistency:** The UI design (colors, aesthetic, placement) must remain EXACTLY identical across every single scene.
   - **Contextual Tracking:** If you include an element like a Health Bar or Ammo Counter, it MUST logically track the narrative context across scenes (e.g., depleting if damage is taken).
5. **Return valid JSON only** in this exact shapeâ€”nothing before or after it:
   {
     "keyPoints": ["Point 1", "Point 2", â€¦]
   }
6. Include descriptive visual details following context.
7. **Do not any extra text outside the JSON.**
`.trim();

/* ------------------------------------------------------------------ */
/*  2.  Function to build the *full* system prompt                     */
/* ------------------------------------------------------------------ */
const buildSystemPrompt = (): string => {
  const catalogue = Object.entries(MOOD_GUIDES)
    .map(([name, guide]) => `**${name}**:${guide}`)
    .join("\n");

  return `
${rigidRules}

â€”â€” Mood Catalogue â€”â€”
${catalogue}

Choose the single most appropriate mood **based on the user's prompt** and write the bullet points in that style.
â€¢ Do **not** state which mood you chose.
â€¢ Still follow every rule above precisely.
`.trim();
};

const buildSystemPrompt2 = (): string => {
  const catalogue2 = Object.entries(MOOD_GUIDES2)
    .map(([name, guide]) => `**${name}**:${guide}`)
    .join("\n");

  return `
${rigidRules2}

â€”â€” Mood Catalogue â€”â€”
${catalogue2}

Choose the single most appropriate mood **based on the user's prompt** and write the bullet points in that style.
â€¢ Do **not** state which mood you chose.
â€¢ Still follow every rule above precisely.
`.trim();
};

const buildSystemPromptInt = (): string => {
  const catalogue2 = Object.entries(MOOD_GUIDES2)
    .map(([name, guide]) => `**${name}**:${guide}`)
    .join("\n");

  return `
${rigidRulesInt}

â€”â€” Mood Catalogue â€”â€”
${catalogue2}

Choose the single most appropriate mood **based on the user's prompt** and write the bullet points in that style.
â€¢ Do **not** state which mood you chose.
â€¢ Still follow every rule above precisely.
`.trim();
};

/* ------------------------------------------------------------------ */
/*  3.  Exported handler                                               */
/* ------------------------------------------------------------------ */

export const GptInt = async (req: Request, res: Response): Promise<any> => {
  // 1. Destructure the prompt (pp) and the Blueprint string (remixData)
  const { pp = "", remixData = "" } = req.body;

  var userPrompt = "";

  if (remixData && remixData.trim() !== "") {
    // 2. Updated Prompt: NODE-BASED INTERACTIVE GAME MASTER
    userPrompt = `
**ROLE:** You are the core logic engine of a Node-Based Interactive Game Creator. Your job is to *design the visual content and narrative branching* for a "Choose Your Own Adventure" game set within an established Story World.
You are NOT responsible for coding or defining the actual interactive 'Hotspots' (the user will manually add those later on the frontend). Your job is purely to set up the visual scenarios and design the UI.

**INPUTS:**
1. **THE SCENARIO (User Prompt):** "${pp}"
2. **THE WORLD GUIDE (Lore, Visuals, Style):**
"""
${remixData}
"""

**THE ENGINE BLUEPRINT & BOUNDARIES:**
1. You have a minimum of 3 and a maximum of 9 video slots.
2. The World Guide is your source for **how things look**. Use its specific lighting, colors, textures, and characters.

**DEEP LOGIC ENFORCEMENT (STRUCTURAL WRAPPING & PACING):**
1. **Mandatory Intro Screen:** Node 1 MUST ALWAYS be an Intro/Main Menu screen for the game. It must feature the game's title and a creative, context-aware interactive button (e.g., 'Start', 'Explore', 'Fight', 'Engage', 'Kick').
2. **Mandatory Endings:** The final terminal nodes of ANY branch MUST be explicit 'Victory' or 'Failure/Game Over' screens, depicting the final state (e.g., celebrating with confetti, or a crashed car).
3. **Strict Pacing (The Body Nodes):** For the gameplay nodes between the Intro and the Outros, you MUST strictly follow the pacing of the user's prompt.
   - If the user asks for a simple, quick interaction (like a penalty kick), keep the body tight (e.g., 5 nodes total: Intro -> Stance -> Left/Right Choice -> Victory/Failure). DO NOT artificially inflate simple games to 7 or 8 nodes.
   - ONLY expand and auto-create deep body nodes if the user's prompt is highly complex (e.g., fighting a war across multiple locations) and requires the space to logically resolve.
4. **Never Compress Actions:** If the context implies an action sequence (e.g., facing enemies -> firing the weapon -> seeing the outcome), you MUST break this into separate, consecutive nodes. Do not compress the 'action' and the 'result' into a single node. The user needs an intermediate node (like aiming/firing) to place their interaction Hotspot on before the Victory/Failure outcome is shown.
5. **Dynamic, Plot-Driven Depth:** The depth of an action sequence is NOT a fixed, rigid rule. It is entirely driven by the plot of the game sequence provided in the context. A result sequence might be 2 nodes deep, 3 nodes deep, or more. Use your logical understanding of the narrative to determine how many consecutive nodes are needed to fully play out a complex action before reaching the ending screen.

**THE BRANDING SECRET WEAPON (BAKED-IN UI):**
Because these scenes are for a video game, you MUST instruct the visual generator to bake Video Game UI elements directly into the scene unless the user explicitly asks for "Cinematic/No UI".
- Add consistent, context-aware UI elements (e.g., subtle health bars in fighting games, clean crosshairs in shooters, stylized dialogue boxes in RPGs).
- Maintain the exact same UI color, style, and placement across all nodes.
- Make the visual targets (e.g., the enemy, the door, the item) prominent so the user can easily overlay their Hotspots on them later.
- i will add input images also so you must describe characters and suggest they come from input image with that description placed after all characters name. this text add face from input image also add characters complete description and visual looks.

**OUTPUT REQUIREMENTS:**
Return **strictly valid JSON** with exactly 3 to 9 strings.
Each string MUST be prefixed with its Node ID and Branching Context so the user knows how to connect them.
Example Format:
{
  "keyPoints": [
    "[NODE 1 - ROOT] Main Menu Screen for 'The Heist' with a large 'ENGAGE' button...",
    "[NODE 2 - BRANCH FROM 1: Engage] The spy faces a choice: Hack the terminal or Attack...",
    "[NODE 3 - BRANCH FROM 2: Hack] The spy begins to hack the terminal...",
    "[NODE 4 - BRANCH FROM 3: Enter Vault] VICTORY SCREEN. The spy escapes with the gold...",
    "[NODE 5 - BRANCH FROM 2: Attack] The spy shoots at the guards...",
    "[NODE 6 - BRANCH FROM 5: Overwhelmed] FAILURE SCREEN. The spy is overwhelmed by guards..."
  ]
}
`.trim();
  } else {
    userPrompt = `
**ROLE:** You are the core logic engine of a Node-Based Interactive Game Creator. Your job is to *design the visual content and narrative branching* for a "Choose Your Own Adventure" game.
You are NOT responsible for coding or defining the actual interactive 'Hotspots' (the user will manually add those later on the frontend). Your job is purely to set up the visual scenarios and design the UI.

**THE SCENARIO (User Prompt):** "${pp}"

**THE ENGINE BLUEPRINT & BOUNDARIES:**
1. You have a minimum of 3 and a maximum of 9 video slots.

**DEEP LOGIC ENFORCEMENT (STRUCTURAL WRAPPING & PACING):**
1. **Mandatory Intro Screen:** Node 1 MUST ALWAYS be an Intro/Main Menu screen for the game. It must feature the game's title and a creative, context-aware interactive button (e.g., 'Start', 'Explore', 'Fight', 'Engage', 'Kick').
2. **Mandatory Endings:** The final terminal nodes of ANY branch MUST be explicit 'Victory' or 'Failure/Game Over' screens, depicting the final state (e.g., celebrating with confetti, or a crashed car).
3. **Strict Pacing (The Body Nodes):** For the gameplay nodes between the Intro and the Outros, you MUST strictly follow the pacing of the user's prompt.
   - If the user asks for a simple, quick interaction (like a penalty kick), keep the body tight (e.g., 5 nodes total: Intro -> Stance -> Left/Right Choice -> Victory/Failure). DO NOT artificially inflate simple games to 7 or 8 nodes.
   - ONLY expand and auto-create deep body nodes if the user's prompt is highly complex (e.g., fighting a war across multiple locations) and requires the space to logically resolve.
4. **Never Compress Actions:** If the context implies an action sequence (e.g., facing enemies -> firing the weapon -> seeing the outcome), you MUST break this into separate, consecutive nodes. Do not compress the 'action' and the 'result' into a single node. The user needs an intermediate node (like aiming/firing) to place their interaction Hotspot on before the Victory/Failure outcome is shown.
5. **Dynamic, Plot-Driven Depth:** The depth of an action sequence is NOT a fixed, rigid rule. It is entirely driven by the plot of the game sequence provided in the context. A result sequence might be 2 nodes deep, 3 nodes deep, or more. Use your logical understanding of the narrative to determine how many consecutive nodes are needed to fully play out a complex action before reaching the ending screen.

**THE BRANDING SECRET WEAPON (BAKED-IN UI):**
Because these scenes are for a video game, you MUST instruct the visual generator to bake Video Game UI elements directly into the scene unless the user explicitly asks for "Cinematic/No UI".
- Add consistent, context-aware UI elements (e.g., subtle health bars in fighting games, clean crosshairs in shooters, stylized dialogue boxes in RPGs).
- Maintain the exact same UI color, style, and placement across all nodes.
- Make the visual targets (e.g., the enemy, the door, the item) prominent so the user can easily overlay their Hotspots on them later.

**OUTPUT REQUIREMENTS:**
Return **strictly valid JSON** with exactly 3 to 9 strings.
Each string MUST be prefixed with its Node ID and Branching Context so the user knows how to connect them.
Example Format:
{
  "keyPoints": [
    "[NODE 1 - ROOT] Main Menu Screen for 'The Heist' with a large 'ENGAGE' button...",
    "[NODE 2 - BRANCH FROM 1: Engage] The spy faces a choice: Hack the terminal or Attack...",
    "[NODE 3 - BRANCH FROM 2: Hack] The spy begins to hack the terminal...",
    "[NODE 4 - BRANCH FROM 3: Enter Vault] VICTORY SCREEN. The spy escapes with the gold...",
    "[NODE 5 - BRANCH FROM 2: Attack] The spy shoots at the guards...",
    "[NODE 6 - BRANCH FROM 5: Overwhelmed] FAILURE SCREEN. The spy is overwhelmed by guards..."
  ]
}
`.trim();
  }

  const initialMessages = [
    { role: "system", content: buildSystemPromptInt() },
    { role: "user", content: userPrompt },
  ];

  /* -------- JSON helpers -------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };
  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  };

  /* -------- Retry loop -------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let responseData: string | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const raw = await generateGPT4oPromptProWeb(initialMessages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(txt)) {
        responseData = txt;
        break;
      }

      const extracted = extractJSON(txt);
      if (extracted && isValidJSON(extracted)) {
        responseData = extracted;
        break;
      }

      attempt++;
      console.warn(`Attempt ${attempt} returned invalid JSON. Retryingâ€¦`);
    } catch (err: any) {
      console.error("GPT API error:", err.message);
      return res
        .status(500)
        .send({ message: "Error in accessing ChatGPT API" });
    }
  }

  if (!responseData) {
    return res
      .status(500)
      .send({ message: "Failed to get valid JSON from ChatGPT API" });
  }

  return res.send({
    message: "Done",
    initialSteps: JSON.parse(responseData),
  });
};

export const GptMeme = async (req: Request, res: Response): Promise<any> => {
  const { pp = "", remixData = "" } = req.body;

  var userPrompt = "";

  if (remixData && remixData.trim() !== "") {
    // 2. Updated Prompt: Injects the Text Blueprint but keeps your exact formatting rules
    userPrompt = `
**ROLE:** You are a Visual Director. You take a specific user scenario and "film" it inside an established Story World.

**INPUTS:**
1. **THE SCENARIO (User Prompt):** "${pp}"
2. **THE WORLD GUIDE (Lore, Visuals, Style):**
"""
${remixData}
"""

**YOUR TASK:**
Visualize "THE SCENARIO" taking place within "THE WORLD".
You must honor the **Narrative Action** of the User Prompt, while strictly applying the **Visual Style, Character Designs, and Atmosphere** of the World Guide.

**GUIDELINES FOR ADAPTATION:**
1. **Visual Consistency:** The World Guide is your source for **how things look**. Use the specific lighting, colors, textures, and character descriptions found in the Guide.
2. **Creative Expansion:** The User Prompt drives the story. If the user introduces a new prop, location, or action that is NOT in the Guide, **you must design it to fit the World's aesthetic.** (e.g., If the World is "Ancient Rome" and the user asks for a "phone," describe a magical slate or scroll, or a time-anachronism, depending on the world's logic).
3. **Lore-Accurate Tone:** Ensure the mood of the generated scenes matches the atmosphere described in the World Guide.
4. **i will add input images also  so you  must describe characters and suggest they come from input image with that description placed after all characters name  this text add face from input image  also add characters complete description and visual looks.

**OUTPUT FORMAT:**
Scenes/images/pics are returned as key points: output 1â€“9. If the prompt specifies a number, honor it; otherwise infer the appropriate 1â€“9 from context.
Each bullet point should be concise but can use up to 5 sentences if more detail is needed.
Return them in a JSON object like:
{
  "keyPoints": [
    "Point 1",
    "Point 2",
    ...
  ]
}
`.trim();
  } else {
    userPrompt = `
Please respond to this prompt for scene or scenes creation: "${pp}".
Scenes/images/pics are returned as key points: output 1â€“9. If the prompt specifies a number, honor it; otherwise infer the appropriate 1â€“9 from context.
Each bullet point should be concise but can use up to 5 sentences if more detail is needed.
Return them in a JSON object like:
{
  "keyPoints": [
    "Point 1",
    "Point 2",
    ...
  ]
}
`.trim();
  }

  const initialMessages = [
    { role: "system", content: buildSystemPrompt2() },
    { role: "user", content: userPrompt },
  ];

  /* -------- JSON helpers   GptVideoVisual,-------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };
  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  };

  /* -------- Retry loop -------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let responseData: string | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const raw = await generateGPT4oPromptProWeb(initialMessages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(txt)) {
        responseData = txt;
        break;
      }

      const extracted = extractJSON(txt);
      if (extracted && isValidJSON(extracted)) {
        responseData = extracted;
        break;
      }

      attempt++;
      console.warn(`Attempt ${attempt} returned invalid JSON. Retryingâ€¦`);
    } catch (err: any) {
      console.error("GPT API error:", err.message);
      return res
        .status(500)
        .send({ message: "Error in accessing ChatGPT API" });
    }
  }

  if (!responseData) {
    return res
      .status(500)
      .send({ message: "Failed to get valid JSON from ChatGPT API" });
  }

  return res.send({
    message: "Done",
    initialSteps: JSON.parse(responseData),
  });
};

export const GptVisualize = async (
  req: Request,
  res: Response
): Promise<any> => {
  // 1. Destructure pp and remixData
  const { pp = "", remixData = "" } = req.body;

  var userPrompt = "";

  if (remixData && remixData.trim() !== "") {
    // 2. Updated Prompt: Injects Blueprint Law + Keeps your exact output rules
    userPrompt = `
**ROLE:** You are a Visual Director. You take a specific user scenario and "film" it inside an established Story World.

**INPUTS:**
1. **THE SCENARIO (User Prompt):** "${pp}"
2. **THE WORLD GUIDE (Lore, Visuals, Style):**
"""
${remixData}
"""

**YOUR TASK:**
Visualize "THE SCENARIO" taking place within "THE WORLD".
You must honor the **Narrative Action** of the User Prompt, while strictly applying the **Visual Style, Character Designs, and Atmosphere** of the World Guide.

**GUIDELINES FOR ADAPTATION:**
1. **Visual Consistency:** The World Guide is your source for **how things look**. Use the specific lighting, colors, textures, and character descriptions found in the Guide.
2. **Creative Expansion:** The User Prompt drives the story. If the user introduces a new prop, location, or action that is NOT in the Guide, **you must design it to fit the World's aesthetic.** (e.g., If the World is "Medieval" and the user asks for a "car," describe a "fast carriage" or a "magical construct," depending on the world's logic).
3. **Lore-Accurate Tone:** Ensure the mood of the generated scenes matches the atmosphere described in the World Guide.
4. **i will add input images also  so you  must describe characters and suggest they come from input image with that description placed after all characters name  this text add face from input image  also add characters complete description and visual looks.

**OUTPUT REQUIREMENTS:**
- Generate **at least 3** and **at most 9** bullet points.
- If the prompt specifies a number, honor it; otherwise infer the appropriate length (3-9).
- Each bullet point should be concise but can use up to 5 sentences if more detail is needed.
- **CRITICAL:** The **very first bullet point MUST be written as a Premium Cinematic Blockbuster Movie Poster description. It MUST start with a short, punchy TITLE (1-3 words) for the story (e.g., 'Title: The Awakening.'). Then, describe the visually massive, professional poster-inspired cover capturing the vibes, colors, genre, and epic essence of the overall story (e.g. establishing the cinematic sun, the mood, and the scale).**
- **CRITICAL:** The **last bullet point must serve as a natural conclusion to the story/subject or end with short ending dialog.**

**OUTPUT FORMAT:**
Return **strictly valid JSON** in exactly this structure:
{
  "keyPoints": [
    "Point 1",
    "Point 2",
    ...
  ]
}
`.trim();
  } else {
    userPrompt = `
Please respond to this prompt: "${pp}"
Include at least 3 bullet points, and at most 9.
Each bullet point should be concise but can use up to 5 sentences if more detail is needed.
CRITICAL: The **very first bullet point MUST be written as a Premium Cinematic Blockbuster Movie Poster description. It MUST start with a short, punchy TITLE (1-3 words) for the story (e.g., 'Title: The Awakening.'). Then, describe the visually massive, professional poster-inspired cover capturing the vibes, colors, genre, and epic essence of the overall story (e.g. establishing the cinematic sun, the mood, and the scale).**
Make sure the **last bullet point also serves as a natural conclusion to the story/subject or
  ending with short ending dialog**.
Return them in a JSON object like:
{
  "keyPoints": [
    "Point 1",
    "Point 2",
    ...
  ]
}
`.trim();
  }

  const initialMessages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userPrompt },
  ];

  /* -------- JSON helpers -------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };
  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  };

  /* -------- Retry loop -------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let responseData: string | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const raw = await generateGPT4oPromptProWeb(initialMessages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(txt)) {
        responseData = txt;
        break;
      }

      const extracted = extractJSON(txt);
      if (extracted && isValidJSON(extracted)) {
        responseData = extracted;
        break;
      }

      attempt++;
      console.warn(`Attempt ${attempt} returned invalid JSON. Retryingâ€¦`);
    } catch (err: any) {
      console.error("GPT API error:", err.message);
      return res
        .status(500)
        .send({ message: "Error in accessing ChatGPT API" });
    }
  }

  if (!responseData) {
    return res
      .status(500)
      .send({ message: "Failed to get valid JSON from ChatGPT API" });
  }

  return res.send({
    message: "Done",
    initialSteps: JSON.parse(responseData),
  });
};

export const GenerateWorldRemix = async (
  req: Request,
  res: Response
): Promise<any> => {
  // 1. Destructure the payload sent from your frontend Axios call
  const { originalPrompt = "", rawPlan = {}, sceneSteps = [] } = req.body;

  // 2. Construct the strict Prompt Logic
  const systemPrompt = `
You are a Visual Continuity Engine for a story world. You are a specialized JSON-only API. You must return valid JSON.

**YOUR TASK:**
Analyze the provided STORY_CONTEXT, RAW_PLAN, and SCENE_STEPS to create a "World Remix Bible" with metadata.

**INSTRUCTIONS:**
1. **Metadata Creation:**
   - **Title:** Generate a short, natural, and fitting title based strictly on the STORY_CONTEXT. Do not use awkward or overly "thematic" naming conventions.
   - **Description:** Write a rich, cinematic "World Lore" synopsis (3-5 sentences). You must follow this specific narrative structure:
      1. **The Setting:** First, introduce the location, atmosphere, and the state of the world.
      2. **The Inhabitants:** Next, explain who lives there, the nature of the society, or the beings involved.
      3. **The Story:** Finally, describe the specific event, conflict, or journey that is currently happening in this world.
      *Tone: Immersive, dramatic, and storytelling-focused.*

2. **Analyze Characters:** Look at the 'characters' list in RAW_PLAN.
   - **Filter:** Remove inanimate objects (tables, chairs, cars, plants). Keep ONLY Alive Beings (humans, animals, sentient creatures).
   - **Enrich:** If a character has no name (null), generate a natural one based on the STORY_CONTEXT.
   - **Visuals:** Create a specific 'description' for their permanent look (clothing, face, vibe) based on details found in SCENE_STEPS.

3. **Create Plan Summary (The Bible):**
   - Synthesize the art style and atmospheric details from the steps into a cohesive "World Bible" summary.
   - This should define the visual rules, lighting, and mood of the world.

**OUTPUT FORMAT:**
You must return **strictly valid JSON** in exactly this format:
{
  "title": "String (The generated title)",
  "description": "String (The cinematic lore synopsis starting with world, then people, then story)",
  "Characters": [
    {
      "name": "String (e.g. Jack)",
      "description": (append this string to start) -> 'show one character from my image' "String (e.g. Wearing a tattered brown leather coat...)"
    }
  ],
  "Plan Summary": "String (The cohesive world bible/style description)"
}
`.trim();

  const userPrompt = `
Here is the data to analyze:
1. **STORY_CONTEXT**: "${originalPrompt}"
2. **RAW_PLAN**: ${JSON.stringify(rawPlan)}
3. **SCENE_STEPS**: ${JSON.stringify(sceneSteps)}
`.trim();

  const initialMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* -------- JSON helpers -------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string): string | null => {
    // Matches standard JSON objects
    const m = str.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  };

  /* -------- Retry loop -------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let responseData: string | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      // Call your existing GPT generation function
      // @ts-ignore
      const raw = await generateGPT4oPrompt5B(initialMessages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw);

      // Check if raw output is valid JSON
      if (isValidJSON(txt)) {
        responseData = txt;
        break;
      }

      // If not, try to extract JSON from markdown wrappers
      const extracted = extractJSON(txt);
      if (extracted && isValidJSON(extracted)) {
        responseData = extracted;
        break;
      }

      console.log("ik");

      attempt++;
      console.warn(`Attempt ${attempt} returned invalid JSON. Retrying...`);
    } catch (err: any) {
      console.error("GPT API error:", err.message);
      return res
        .status(500)
        .send({ message: "Error in accessing ChatGPT API" });
    }
  }

  if (!responseData) {
    return res
      .status(500)
      .send({ message: "Failed to get valid JSON from ChatGPT API" });
  }

  // 3. Return the processed data
  // We parse it here to ensure we are sending an Object, not a string, to the frontend
  const parsedData = JSON.parse(responseData);

  res.send(parsedData);
};

export const gptWorldImage = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { prompt, planContext } = req.body;

  if (!prompt || !planContext) {
    return res
      .status(400)
      .send({ message: "Body must contain { prompt, planContext }" });
  }

  const styleToken = planContext?.art_style?.style_token
    ? `, ${planContext.art_style.style_token} art style`
    : "";

  const systemPrompt = `
You are a Visual Director AI. Generate a prompt for Character Concept Art.
RULES: One plain string. Full body description. Contextual background (no white background). End with style token.
Structure: [Subject] in [Environment]. [Pose]. [Lighting]. [Specs]. ${styleToken}
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `CONTEXT:\n${JSON.stringify(planContext)}` },
    { role: "user", content: prompt },
  ];

  try {
    // @ts-ignore
    const raw = await generateGPT4oPrompt5(messages);

    // Convert array to string if needed and clean it
    const generatedText = Array.isArray(raw) ? raw.join("") : String(raw);
    const cleanText = generatedText.replace(/```/g, "").trim();

    console.log("--- GPT Output ---", cleanText);

    if (!cleanText || cleanText.length < 5) {
      throw new Error("GPT returned empty string");
    }

    // âœ… FIX: Send data in 'payload' to match frontend
    return res.status(200).send({
      message: "Success",
      payload: cleanText,
    });
  } catch (e: any) {
    console.error("GPT Error:", e.message);
    return res.status(500).send({ message: "Error generating description" });
  }
};

/* ------------ ENDPOINT ------------ */
export const GptTextVisual = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { text, prompt, Planx, videoPrompt } = req.body as {
    text: string;
    prompt: string;
    videoPrompt?: string;
    Planx: {
      art_style: { style_token: string | null };
      characters: { id: string; name: string | null; description: string }[];
    };
  };

  if (!text || !prompt || !Planx) {
    return res
      .status(400)
      .send({ message: "Body must contain { text, prompt, Planx }" });
  }

  /* ---------- GPT messages ---------- */
  const systemPrompt = `
You are a specialised AI that converts story steps into image-generation prompts of max 800 char.

RULES (read carefully):
1. Respond with **one plain string** â€“ no JSON, no markdown, no code fences.

${
  videoPrompt
    ? `\n--- PREVIOUS ACTION MOTION CONTEXT ---\nThe previous scene motion was: ${videoPrompt}\nEnsure visual continuity.\n---------------------------------------\n`
    : ""
}

2. The string should describe the image concept in detail focusing on subjects, environments, mood, setting, skin colors, locations, race, and facial expressions.


When composing these visual descriptions, keep them concise yet thorough:
- Front-load the most important subjects or features.
- Provide clear hierarchy of details (e.g.,noun name, main subject, secondary details, background features).
- Avoid overly rigid camera or angle instructions unless necessary.
- Emphasize crucial items so they are not omitted.
- Keep it short enough to avoid overshadowing important details.
- Focus on factual or descriptive content rather than style or artistic technique.



3. **Always** end the string with the planâ€™s art-style token (if not null), from the art style list pick one that matches my text
   Example: "futurama cartoon art style, ..."
   - always use this format for adding artstyle  :' {art-style token} art style'


4. If a step mentions a character whose *name* appears in the plan,
   COPY that character's visual description **verbatim** into the prompt
   (always give character with character's visual description  if any characters).
    (always add a noun name before character's visual  description).

  **DO NOT** descriibe a charcter without a noun name all characters must have an actual name gotten from ${Planx} like peter or john or ironman or beerboy.



5. Put must-have elements first (e.g.,noun name, main subject, secondary details, background features)  keep sentences short and direct using ${Planx}.

6. **Start-Frame Rule:** Every image generated must be an establishing 'start frame image' to allow for smooth video AI animation. Avoid mid-action blur or frantic motion that ruins temporal flow.

7. **Camera & Context Rule:** Consider close-up shots and dynamic camera angles for professional storytelling. HOWEVER, if a close-up would omit critical story context, characters, or environment details from the text, sacrifice the close-up to tell the complete vision of the user. Never omit details that break story context.

8. **Text Overlay Rule:** If the scene is a movie poster or cover image, explicitly instruct the image generator that any text on the image MUST be limited to a short, punchy Title (1-3 words) in large cinematic font, and optionally a very small subtitle. DO NOT include long sentences or narration text on the image.
`.trim();

  const planMessage = {
    role: "system",
    content: `VISUAL PLAN to be used for context and consistency, always start visual description  (use according to the rules above):\n${JSON.stringify(
      Planx
    )}`,
  };

  const userMessage = {
    role: "user",
    content: `
Origin prompt: "${prompt}"

Transform this step into a Flux image prompt:
"${text}"
`.trim(),
  };

  const initialMessages = [
    { role: "system", content: systemPrompt },
    planMessage,
    userMessage,
  ];

  /* ---------- GPT call & response handling ---------- */
  try {
    const raw = await generateGPT4oPrompt5(initialMessages);
    const visualPrompt = (Array.isArray(raw)
      ? raw.join("")
      : String(raw)
    ).trim();

    console.log(visualPrompt);
    console.log("");

    return res.send({ message: "Done", visualPrompt });
  } catch (e: any) {
    console.error("GPT-4o error:", e.message);
    return res.status(500).send({ message: "Error in accessing ChatGPT API" });
  }
};

export const GptTextVisualStages = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { text, prompt, Planx, videoPrompt } = req.body as {
    text: string;
    prompt: string;
    videoPrompt?: string;
    Planx: {
      art_style: { style_token: string | null };
      characters: { id: string; name: string | null; description: string }[];
    };
  };

  if (!text || !prompt || !Planx) {
    return res
      .status(400)
      .send({ message: "Body must contain { text, prompt, Planx }" });
  }

  const systemPrompt = `
You are a specialised AI that converts story steps into image-generation prompts of max 800 char.

RULES (read carefully):
1) Respond with EXACTLY TWO plain strings separated by this delimiter on its own line:
---STAGE2---
No JSON, no markdown, no code fences.

2) Each string must be a strong, usable image prompt describing subjects, environment, mood, setting, skin colors, locations, race, and facial expressions.

3) Stage 1 = the best â€œmainâ€ visual for this step (the most important moment/beat).

4) Stage 2 = a second useful visual for the SAME step:
   - If the step contains multiple beats / actions / locations, split them: Stage 1 covers beat A, Stage 2 covers beat B.
   - If the step is a single beat, Stage 2 should be a complementary depiction (different emphasis/detail/subject focus), but do NOT use generic filler phrases like â€œtighter frameâ€. Be concrete about what is shown.
   - Do not invent new characters/objects/locations that are not implied by the step + plan. If the step implies changes, reflect them.

5) Always end EACH stage string with the planâ€™s art-style token (if not null),from the art style list pick one that matches my text formatted like:
"{art-style token} art style"

6) If a step mentions a character whose name appears in the plan,
   COPY that character's visual description verbatim into the prompt.
   Always add a noun name before the character's visual description.
   DO NOT describe a character without a noun name.

7) Put must-have elements first (noun name, main subject, key action, key environment details).

8) If there is Previous Action Motion (videoPrompt), ensure the visual continuation respects the ongoing motion context.
${
  videoPrompt
    ? `\n--- PREVIOUS ACTION MOTION CONTEXT ---\nThe previous scene motion was: ${videoPrompt}\nEnsure visual continuity.\n---------------------------------------\n`
    : ""
}

9) always use the exact descriptions of the same objects,people and characters in stage 1 and 2 (use the exact phrase to describe characters word for word or they look different)

10) **Start-Frame Rule:** Every stage must be described as an establishing 'start frame image' to allow for smooth video AI animation. Avoid mid-action blur or frantic motion that ruins temporal flow.

11) **Camera & Context Rule:** Consider close-up shots and dynamic camera angles for professional storytelling. HOWEVER, if a close-up would omit critical story context, characters, or environment details from the text, sacrifice the close-up to tell the complete vision of the user. Never omit details that break story context.

12) **Text Overlay Rule:** If the input text describes a movie poster or cover image (e.g., it contains a Title):
    - For Stage 1: You MUST explicitly include the short Title (1-3 words) in the prompt so the image generator draws it as a large cinematic text overlay. **DO NOT include any other text, taglines, labels, or long sentences on the image.**
    - For Stage 2: DO NOT include the Title or any text overlays. Stage 2 must naturally begin the story by depicting the scene without any text.
`.trim();

  const planMessage = {
    role: "system",
    content: `VISUAL PLAN to be used for context and consistency:\n${JSON.stringify(
      Planx
    )}`,
  };

  const userMessage = {
    role: "user",
    content: `
Origin prompt: "${prompt}"

Transform this step into TWO Flux image prompts (stage 1 + stage 2):
"${text}"
`.trim(),
  };

  const initialMessages = [
    { role: "system", content: systemPrompt },
    planMessage,
    userMessage,
  ];

  try {
    const raw = await generateGPT4oPrompt5(initialMessages);
    const out = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();

    // âœ… robust delimiter split (handles missing newlines)
    const parts = out.split(/\s*---STAGE2---\s*/);

    let stage1 = (parts[0] ?? "").trim();
    let stage2 = (parts[1] ?? "").trim();

    // cleanup if delimiter got embedded in stage1 somehow
    stage1 = stage1.replace(/---STAGE2---/g, "").trim();
    stage2 = stage2.replace(/---STAGE2---/g, "").trim();

    const visualPromptStage1 = stage1;
    const visualPromptStage2 = stage2 || stage1;

    console.log("STAGE1:", visualPromptStage1);
    console.log("STAGE2:", visualPromptStage2);
    console.log("");

    return res.send({
      message: "Done",
      visualPromptStage1,
      visualPromptStage2,
    });
  } catch (e: any) {
    console.error("GPT-4o error:", e.message);
    return res.status(500).send({ message: "Error in accessing ChatGPT API" });
  }
};

/* ------------ ENDPOINT : Flux Kontext prompt generator ------------ */

export const GptPlanK = async (req: Request, res: Response): Promise<any> => {
  /* ---------------- Parse incoming ---------------- */
  const { pp, x } = req.body as { pp: string; x: any };

  if (!pp || !Array.isArray(x)) {
    return res.status(400).send({ message: "Body must contain { pp, x[] }" });
  }

  /* -------- System  GptRecreateKontext prompt (Flux Kontext â€“ object/animal only) -------- */
  /* -------- System prompt (Flux Kontext â€“ people allowed, 3rd-person, likeness for IPs) -------- */
  // inside GptPlanK (keep everything else exactly as-is)
  // inside GptPlanK (keep everything else exactly as-is)
  const systemPrompt = `
  You are a precise planning AI.
  Return ONLY valid JSON, no markdown, no extra text.
  The JSON MUST match this schema exactly:

  {
    "art_style": {
      "style_token": string        // a concise style tag (e.g., "neon-noir cyberpunk", "studio portrait soft light"); never null or empty
    },
    "characters": [
      {
        "id": string,              // "char1" â€¦ "char3"
        "name": string | null,     // proper noun or null
        "description": string,     // ONLY inherent visual traits (see Rule 5)
        "style_token": string | null
      }
      // 1â€“8 total entries
    ]
  }

  Rules:
  1. All characters saved should be based off reference from input image, eg place the dog ,place the shoe, transformthe shoe , The shoe is a charcter follow the prompt but from the input image, NOT a place.
  2. Choose up to eight **visually important** entities mentioned in the key-points (one mention is enough).
  3. If fewer than eight exist, return only those you find; do NOT invent extras.
4. Always set "art_style.style_token" Up to ONE OR NINE of the following allowed tokens,scenes can have multiple art styles or 1 if specified by user : ${artStyles.join(
    ", "
  )}. Pick either 1 or more styles Token that best matches the overall tone of the prompt. Do **NOT** invent new styles.
  5. Do NOT enforce cross-image character consistency. Subjects (people/animals/objects) are treated as references from the input image only.
  6. **do not Describe inherent attributes**: just characters and objects to place the man in the image , the girl in the image, the people, the dog,
  the Boat
     â€¢ Keep descriptions short and comma-separated.
  7. Preserve the original environment (background, layout, camera angle, lighting, time of day, weather, overall color tone) unless the user prompt explicitly requests changes.
  8. **When composing any transformation/edit instruction outside of this JSON, never restate inherent traits.**
     â€¢ Refer to subjects generically by count and type only (e.g., "these two men", "the woman", "the dog").
     â€¢ Example phrasing : "Transform these two men into ,place them in , place him in ,
`.trim();

  const userPrompt = `
Prompt:
"${pp}"

Key-points:
${JSON.stringify(x, null, 2)}

Create the JSON plan now.
  `.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ---------------- Helpers ---------------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}$/);
    return m ? m[0] : null;
  };

  /* ---------------- Retry loop ---------------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let planJson: string | null = null;

  while (attempt < MAX_RETRIES && !planJson) {
    try {
      const raw = await generateGPT4oPromptProWebT(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(text)) {
        planJson = text;
      } else {
        const extracted = extractJSON(text);
        if (extracted && isValidJSON(extracted)) planJson = extracted;
      }
    } catch (e: any) {
      console.error("GPT-4o error:", e.message);
    }
    attempt += planJson ? 0 : 1;
  }

  if (!planJson) {
    return res
      .status(500)
      .send({ message: "GptPlan: failed to obtain valid JSON" });
  }

  /* ---------------- Success ---------------- */
  const plan: GptPlanResult = JSON.parse(planJson);
  return res.send({ message: "Plan created", plan });
};
export const GptTextVisualKontext = async (
  req: any,
  res: any
): Promise<any> => {
  const { text, prompt, Planx, videoPrompt } = req.body as {
    text: string;
    prompt: string;
    videoPrompt?: string;
    Planx: any;
  };

  if (!text || !prompt) {
    return res
      .status(400)
      .send({ message: "Body must contain { text, prompt, Planx }" });
  }

  /* -------- Art style helper (just to pass to prompt) -------- */
  const getArtStyle = (plan: any): string => {
    const s =
      (plan?.art_style &&
        typeof plan.art_style.style_token === "string" &&
        plan.art_style.style_token.trim()) ||
      (typeof plan?.art_style === "string" && plan.art_style.trim()) ||
      "";
    return s;
  };

  const planArtStyle = getArtStyle(Planx);

  /* -------- System prompt -------- */
  // Optimized to handle all the formatting logic internally
  const systemPrompt = `
You are a specialised AI that converts a single story step into ONE image-edit prompt for an image-to-image video pipeline.

RULES â€” FOLLOW EXACTLY:
1) Respond with ONE plain string only. No JSON, no lists, no bullet points.
2) The prompt MUST START with the word "Place ".
   After "Place", immediately describe who is visibly in the shot RIGHT NOW (one person, two people, etc.) and where they are.
   - Example: "Place the blue alien girl with sparkling blue hair in a cozy kitchen, teaching how to make lasagna."
3) **Style Injection:** If the plan has an art style, from the art style list pick one that matches my text (${
    planArtStyle ? `"${planArtStyle}"` : "none"
  }), naturalize it into the description (e.g., "Place the [subject] in a ${
    planArtStyle || "cinematic"
  } style...").
4) **Identity Safety:** Use "wearing", "holding", "styled as". DO NOT use "transform into", "turned into", "as a [identity]", or "now is [different character]". Describe costume/styling, not identity swapping.
5) **Length Limit:** Keep the description concise (max ~40-50 words). Focus on the immediate visible action and lighting.
6) **Start-Frame Rule:** The prompt must describe an establishing 'start frame image' to allow for smooth video AI animation. Avoid mid-action blur or frantic motion that ruins temporal flow.
${
  videoPrompt
    ? `\n--- PREVIOUS ACTION MOTION CONTEXT ---\nThe previous scene motion was: ${videoPrompt}\nEnsure visual continuity.\n---------------------------------------\n`
    : ""
}
7) **Camera & Context Rule:** Consider close-up shots and dynamic camera angles for professional storytelling. HOWEVER, if a close-up would omit critical story context, characters, or environment details from the text, sacrifice the close-up to tell the complete vision of the user. Never omit details that break story context.
8) **Text Overlay Rule:** If the scene is a movie poster or cover image, explicitly instruct the image generator that any text on the image MUST be limited to a short, punchy Title (1-3 words) in large cinematic font. DO NOT include long sentences or narration text on the image.
9) **Ending Clause:** At the very end of the prompt, ALWAYS include this exact phrase:
   "Retain facial structure and appearance."

DO NOT:
- Do not add on-screen text labels or captions.
- Do not mention copyrighted brand names.
- Do not add people not implied by the scene.

Your output MUST be one continuous block of natural language starting with "Place " and ending with "Retain facial structure and appearance."
`.trim();

  // context for the model
  const planMessage = {
    role: "system" as const,
    content: `VISUAL PLAN for context:\n${JSON.stringify(Planx)}`,
  };

  const userMessage = {
    role: "user" as const,
    content: `Origin prompt: "${prompt}"\n\nTransform this step into a single image-edit prompt:\n"${text}"`,
  };

  const messages = [
    { role: "system", content: systemPrompt },
    planMessage,
    userMessage,
  ];

  try {
    const raw = await generateGPT4oPrompt5(messages);
    const visualPrompt = (Array.isArray(raw)
      ? raw.join("")
      : String(raw)
    ).trim();

    console.log("Image-edit prompt =>", visualPrompt);
    return res.send({ message: "Done", visualPrompt });
  } catch (err: any) {
    console.error("GPT-4o error:", err?.message || err);
    return res.status(500).send({ message: "Error generating prompt" });
  }
};
export const GptTextVisualKontextStages = async (
  req: any,
  res: any
): Promise<any> => {
  const { text, prompt, Planx, videoPrompt } = req.body as {
    text: string;
    prompt: string;
    videoPrompt?: string;
    Planx: any;
  };

  if (!text || !prompt) {
    return res
      .status(400)
      .send({ message: "Body must contain { text, prompt, Planx }" });
  }

  /* -------- Art style helper -------- */
  // Kept to extract the string to pass into the prompt
  const getArtStyle = (plan: any): string => {
    const s =
      (plan?.art_style &&
        typeof plan.art_style.style_token === "string" &&
        plan.art_style.style_token.trim()) ||
      (typeof plan?.art_style === "string" && plan.art_style.trim()) ||
      "";
    return s;
  };

  const planArtStyle = getArtStyle(Planx);

  /* -------- System prompt (2-stage, AI decides) -------- */
  // Logic updated to handle formatting internally, removing the need for JS post-processing slices.
  const systemPrompt = `
You are a specialised AI that converts a single story step into TWO image-edit prompts (Stage 1 and Stage 2) for an image-to-image video pipeline.

RULES â€” FOLLOW EXACTLY:
1) Respond with EXACTLY TWO plain strings separated by this delimiter on its own line:
---STAGE2---
No JSON, no lists, no bullet points, no markdown.

${
  videoPrompt
    ? `\n--- PREVIOUS ACTION MOTION CONTEXT ---\nThe previous scene motion was: ${videoPrompt}\nEnsure visual continuity.\n---------------------------------------\n`
    : ""
}

2) **Start Format:** Each prompt MUST start with the word "Place ".
   After "Place", immediately describe who is visibly in the shot RIGHT NOW and where they are.

3) **Art Style:** ${
    planArtStyle
      ? `The art style is "${planArtStyle}". from the art style list pick one that matches my text then Incorporate this style naturally into the description (e.g., "Place the subject in a ${planArtStyle} style...").`
      : "No specific art style token provided."
  }

4) **Stage Logic:**
   - Stage 1: The best main visual for this step (the most important beat).
   - Stage 2: A second useful visual for the SAME step (different emphasis, detail, or covering a second action/beat).
   - Do not invent extra people not implied by the text.

5) **Identity Safety:** Use "wearing", "holding", "styled as". DO NOT use "transform into", "turned into", "as a [identity]". Describe styling/costume, not identity swapping.

6) **Length:** Keep each prompt concise (max ~40-50 words). Focus on visible action and lighting.

7) **Start-Frame Rule:** The prompt must describe an establishing 'start frame image' to allow for smooth video AI animation. Avoid mid-action blur or frantic motion that ruins temporal flow.

8) **Camera & Context Rule:** Consider close-up shots and dynamic camera angles for professional storytelling. HOWEVER, if a close-up would omit critical story context, characters, or environment details from the text, sacrifice the close-up to tell the complete vision of the user. Never omit details that break story context.

9) **Text Overlay Rule:** If the input text describes a movie poster or cover image (e.g., it contains a Title):
    - For Stage 1: You MUST explicitly include the short Title (1-3 words) in the prompt so the image generator draws it as a large cinematic text overlay. **DO NOT include any other text, taglines, labels, or long sentences on the image.**
    - For Stage 2: DO NOT include the Title or any text overlays. Stage 2 must naturally begin the story by depicting the scene without any text.

10) **Mandatory Ending:** At the END of EACH stage prompt, ALWAYS include this exact clause:
   "Retain facial structure and appearance."

Your output MUST be two continuous blocks of natural language separated by the delimiter line.
`.trim();

  const planMessage = {
    role: "system" as const,
    content: `VISUAL PLAN for context:\n${JSON.stringify(Planx)}`,
  };

  const userMessage = {
    role: "user" as const,
    content: `Origin prompt: "${prompt}"\n\nTransform this step into TWO image-edit prompts (stage 1 + stage 2):\n"${text}"`,
  };

  const messages = [
    { role: "system", content: systemPrompt },
    planMessage,
    userMessage,
  ];

  try {
    const raw = await generateGPT4oPrompt5(messages);
    const out = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();

    // Split by the delimiter
    const parts = out.split(/\s*---STAGE2---\s*/);

    let stage1Raw = (parts[0] ?? "").trim();
    let stage2Raw = (parts[1] ?? "").trim();

    // Fallback: If Stage 2 is empty/missing, just reuse Stage 1 to prevent errors
    if (!stage2Raw) stage2Raw = stage1Raw;

    // No 'enforceStyle' or 'condense' calls here.
    // We trust the AI output because the System Prompt instructions are strict.

    console.log("Image-edit prompt STAGE1 =>", stage1Raw);
    console.log("Image-edit prompt STAGE2 =>", stage2Raw);

    return res.send({
      message: "Done",
      visualPromptStage1: stage1Raw,
      visualPromptStage2: stage2Raw,
    });
  } catch (err: any) {
    console.error("GPT-4o error:", err?.message || err);
    return res.status(500).send({ message: "Error generating prompt" });
  }
};

export const GptApiAudio = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { prompt } = req.body;
  console.log("Received prompt:", prompt);

  try {
    // Set up the messages for ChatGPT with a friendly, witty system prompt.
    const messages = [
      {
        role: "system",
        content: ` You are a charming and witty chatbot. Respond with accurate information while sprinkling in humor, jokes, and charismatic remarksâ€”like chatting with a delightful friend who makes my day brighter. `,
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    // Generate the response using your GPT function.
    const responseData = await generateGPT4oPromptx(messages);

    console.log("GPT response parts:", responseData);

    // Join the response parts into one string (adjust separator as needed).
    const responseText = responseData.join(" ");

    return res.send({
      message: "Success",
      responseText,
    });
  } catch (error: any) {
    console.error("Error in GPT API:", error.message);
    return res.status(500).send({ message: "Error accessing ChatGPT API" });
  }
};

export const GptRecreateKontext = async (req: any, res: any): Promise<any> => {
  const { instructions, promptx, logic } = req.body as {
    instructions: string;
    promptx: string; // original Flux prompt you generated earlier
    logic: string; // any extra logic flags or constraints
  };

  console.log("Original Flux Prompt:", promptx);
  console.log("User Instructions:", instructions);

  /* -------- System prompt (Flux Kontext editing rules) -------- */
  const systemPrompt = `  You must obey this rule at all cost -> response length must be less than 3000 You must obey this rule at all cost -> response length must be less than 3000
   You must obey this rule at all cost -> response length must be less than 3000 You must obey this rule at all cost -> response length must be less than 3000

You are an expert prompt-engineer for **Flux Kontext** â€” a model that edits an
*existing* image according to a text prompt.

RULES
1. Respond with **one single plain string** of max 800 char  â€” no JSON, no markdown, no code-fences.
2. The prompt must be anchored to the **uploaded reference image**:
   â€¢ Refer to subjects as â€œthe man in the imageâ€, â€œthat personâ€ from the image,
     or, if multiple humans: â€œperson1â€ from the image, â€œperson2â€ from the image, â€¦ in third person only.
   â€¢ Mention pets/objects by neutral descriptors unless non-trademarked names.
3. Merge the userâ€™s *instructions* and the original *promptx* so the result
   explains exactly **what changes** to make while preserving unchanged details.
4. If you must allude to a trademark, brand, or celebrity, do **not** name it;
   use likeness phrasing â€” â€œa sleek hybrid sports car reminiscent of a high-end
   German modelâ€, â€œa singer resembling a famous pop iconâ€, etc.
5. Front-load must-have elements; then background / mood; keep sentences short.
6. If the original prompt ends with an art-style token (e.g. â€œphotorealistic art styleâ€)
   keep that token **at the end** of your new prompt.
`.trim();

  /* -------- User message -------- */
  const userMessage = {
    role: "user" as const,
    content: `
Base Flux prompt:
"${promptx}"

 instructions from user:
"${instructions}"

Extra logic / constraints:
"${logic}"

Rewrite the base prompt so it *edits the existing image* per the instructions from user,
while obeying all Flux Kontext rules above.
Return a single, concise prompt string â€” nothing else.
    `.trim(),
  };

  const messages = [{ role: "system", content: systemPrompt }, userMessage];

  try {
    const raw = await generateGPT4oPromptProWebX(messages);
    const updatedPrompt = Array.isArray(raw) ? raw.join("") : String(raw);
    return res.send({ message: "Done", payload: updatedPrompt.trim() });
  } catch (e: any) {
    console.error("GPT-4o error:", e.message);
    return res.status(500).send({ message: "Error generating Flux prompt" });
  }
};

export const GptRecreate = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { instructions, promptx, logic, imageUrl } = req.body;

  console.log("Original Prompt:", promptx);
  console.log("Instructions:", instructions);

  try {
    let userContent: any = `

     You must obey this rule at all cost -> response length must be less than 3000 You must obey this rule at all cost -> response length must be less than 3000
      You must obey this rule at all cost -> response length must be less than 3000 You must obey this rule at all cost -> response length must be less than 3000
Use the following instructions: "${instructions}" , with the base logic :"${logic}" to modify the base prompt using a similar structure  :"${promptx}"


Now transform this base prompt: "${promptx}" into a new visual prompt for Flux:


Remember:
- Front-load the must-have elements.
-keep the context similar to base prompt.
- Describe the subjects and environment in detail similar to base prompt with art style from base prompt.
- Return only a single string without JSON formatting or extra commentary.
        `;

    if (typeof imageUrl !== "undefined" && imageUrl) {
      userContent = [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    // Build messages in a similar way as GptTextVisual
    const messages = [
      {
        role: "system",
        content: `
You are a specialized AI for generating visual descriptions suitable for Flux image generation.
Your output must follow these rules:
1. Return only a single string in max 800 char without any JSON formatting, code fences, or extra text.
2. The string should describe the image concept in detail (subjects, environments, mood, setting, skin colors, race, facial expressions).
3. place art style as specified in base prompt at the end of result.
4. Keep it concise, emphasizing essential visual details and context.
5. **Text Overlay Rule:** If the base prompt contains a short Title (1-3 words), you may keep it. However, DO NOT add any long sentences, taglines, arrows with labels, or narration text overlays to the image prompt.
        `,
      },
      {
        role: "user",
        content: userContent,
      },
    ];

    // Call your GPT function that communicates with GPT-4 or another model
    const updatedResponseData = await generateGPT4oPromptProWebX(messages);

    // Convert the response into a single string if it comes as an array
    const updatedPrompt = Array.isArray(updatedResponseData)
      ? updatedResponseData.join("")
      : updatedResponseData;

    // Trim the response
    const trimmedPrompt = updatedPrompt.trim();

    return res.send({
      message: "Done",
      payload: trimmedPrompt,
    });
  } catch (e: any) {
    console.error("Error:", e.message);
    return res.status(500).send({ message: "Error in accessing ChatGPT API" });
  }
};

type ChatMessage = any;

/**
 * Lightweight local scan to detect obvious NSFW/unsafe categories.
 * This does NOT rewrite; it only flags. The actual rewrite happens via LLM.
 */
function scanNSFW(prompt: string) {
  const mk = (arr: string[]) => new RegExp(`\\b(${arr.join("|")})\\b`, "i");

  const sexualTerms = mk([
    "nude",
    "naked",
    "porn",
    "erotic",
    "nsfw",
    "sex",
    "sexual",
    "intercourse",
    "boobs",
    "breasts",
    "nipples",
    "areola",
    "penis",
    "vagina",
    "cum",
    "semen",
    "fetish",
    "bdsm",
    "bondage",
    "orgasm",
    "explicit",
    "sensual",
    "lewd",
    "thong",
    "lingerie",
    "hardcore",
    "softcore",
    "strip",
    "lap dance",
    "oral",
    "anal",
  ]);

  const minorSexualization = mk([
    "teen",
    "underage",
    "schoolgirl",
    "loli",
    "youngster",
    "minor",
  ]);

  const graphicViolence = mk([
    "gore",
    "gory",
    "bloodbath",
    "decapitation",
    "dismemberment",
    "entrails",
    "severed",
    "splatter",
    "viscera",
    "graphic violence",
  ]);

  const selfHarm = mk([
    "self-harm",
    "suicide",
    "kill myself",
    "cutting",
    "overdose",
    "burnt",
  ]);

  const hate = mk([
    "hate",
    "racial slur",
    "genocide",
    "ethnic cleansing",
    "DO NOT ADD DESCRIBE ANY SHARP OBJECT ",
  ]);

  const illegal = mk([
    "make bomb",
    "meth",
    "heroin",
    "weapon",
    "silencer",
    "unlock phone",
    "credit card skimming",
    "explosive",
    "poison gas",
  ]);

  const extremism = mk([
    "isis",
    "al-qaeda",
    "neo-nazi",
    "extremist propaganda",
  ]);

  const flags = {
    sexual: sexualTerms.test(prompt),
    minorSexualization: minorSexualization.test(prompt),
    graphicViolence: graphicViolence.test(prompt),
    selfHarm: selfHarm.test(prompt),
    hate: hate.test(prompt),
    illegal: illegal.test(prompt),
    extremism: extremism.test(prompt),
  };

  const reasons = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return { flags, reasons };
}

/**
 * System prompt that STRICTLY sanitizes the input.
 * - Removes NSFW (sexual, minors, explicit anatomy), graphic violence, self-harm, hate, extremism, illegal activity.
 * - Avoids real public figures & trademarked characters by using generic descriptors.
 * - If irredeemably explicit, return exactly "REDACTED".
 */

/* ---------- System prompt: STRICT sanitizer for Flux Kontext prompts ---------- */
function buildKontextMessages(originalPrompt: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `
      You are a Trust & Safety rewriting engine. Your goal is to transform user prompts into SAFE, PG-7 visual descriptions for an image generator.
You are a strict rewriting tool for nano banana pro prompts (editing an existing image) you must create a fresh prompt from scratch.
Rewrite the user's text into a  SAFER new prompt based on my suggestions for a (flux kontext image edit prompt).

Rules:
- Do not use words  that can suggest pain
- Remove or replace any sexual/explicit content (nudity, anatomy, acts, fetish) try to recreate a safer scenario of these.
- Remove graphic violence/gore, self-harm/suicide, hate/harassment, extremist propaganda, or illegal instructions while mantaining creativity.
- Do not use exact names of public figures or trademarked characters. Use generic descriptors/likeness phrasing instead.
- Preserve only safe creative intent (environment, mood, clothing, lighting, composition); keep it anchored to an existing image edit.
- If the text is irredeemably explicit or primarily pornographic, output exactly: REDACTED
- Output a SINGLE LINE, no JSON, no quotes, no commentary, max 800 characters.
`.trim(),
    },
    { role: "user", content: originalPrompt },
  ];
}

/* ---------- Endpoint: ONLY sanitize promptx; ignore instructions/logic GptTextVisualKontext ---------- */
export const GptRecreateKontextSafe = async (
  req: any,
  res: any
): Promise<any> => {
  const { promptx } = (req.body ?? {}) as { promptx?: string };

  if (typeof promptx !== "string" || !promptx.trim()) {
    return res.status(400).send({ message: "promptx is required" });
  }

  const originalPrompt = promptx.trim();
  const { flags, reasons } = scanNSFW(originalPrompt);

  try {
    const messages = buildKontextMessages(originalPrompt);

    const raw = await generateGPT4oPromptProWebX(messages);
    // generateGPT4oPrompt
    const sanitized = (Array.isArray(raw) ? raw.join("") : String(raw || ""))
      .trim()
      .slice(0, 800);

    const redacted = sanitized.toUpperCase() === "REDACTED";

    return res.send({
      message: "Done",
      payload: redacted ? "REDACTED" : sanitized,
      meta: {
        original_prompt: originalPrompt,
        redacted,
        flags,
        reasons,
      },
    });
  } catch (e: any) {
    console.error("Kontext NSFW filter error:", e?.message || e);
    return res
      .status(500)
      .send({ message: "Error in NSFW filtering (Kontext)" });
  }
};

/* (Optional) keep legacy export name if you swapped earlier */
// export const GptRecreateSafeKontext = GptRecreateKontextSafe;

function buildMessages(originalPrompt: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `
       You must obey this rule at all cost -> response length must be less than 3000 You must obey this rule at all cost -> response length must be less than 3000
        You must obey this rule at all cost -> response length must be less than 3000 You must obey this rule at all cost -> response length must be less than 3000
       You are a Trust & Safety rewriting engine. Your goal is to transform user prompts into SAFE, PG-7 visual descriptions for an image generator.
You are a strict word rewriting to for Gpt Image  you must create a fresh prompt from scratch.
Rewrite the user's text into a SAFER new prompt based on my suggestions.

Rules:
- DO not USE words that can suggest pain
- Remove or replace any sexual/explicit content (nudity, anatomy, acts, fetish) try to recreate a safer scenario of these.
- Remove graphic violence/gore, self-harm/suicide, hate/harassment, extremist propaganda, or illegal instructions  while mantaining creativity.
- Do not use exact names of public figures or trademarked characters. Use generic descriptors instead like similar to.
- Keep safe, creative intent where possible (environment, mood, clothing, lighting, composition).
- If the text is irredeemably explicit or primarily pornographic, output exactly: REDACTED
- Output a SINGLE LINE, no JSON, no quotes, no commentary, max 800 characters.
`.trim(),
    },
    {
      role: "user",
      content: originalPrompt,
    },
  ];
}

/**
 * The ONLY job of this endpoint now:
 * - Accept promptx
 * - Sanitize it for NSFW/disallowed content
 * - Return cleaned string (or "REDACTED"), plus simple flags for debugging/telemetry
 */

export const GptRecreateSafe = async (req: any, res: any): Promise<any> => {
  const { promptx, imageUrl } = req.body ?? {};

  if (typeof promptx !== "string" || !promptx.trim()) {
    return res.status(400).send({ message: "promptx is required" });
  }

  const originalPrompt = promptx.trim();
  const { flags, reasons } = scanNSFW(originalPrompt);

  try {
    let messages = buildMessages(originalPrompt);

    if (typeof imageUrl !== "undefined" && imageUrl) {
      messages = [
        messages[0], // Keep system prompt
        {
          role: "user",
          content: [
            { type: "text", text: originalPrompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ];
    }

    // Use your existing LLM bridge
    const modelResponse = await generateGPT4oPromptProWebX(messages);
    /// generateGPT4oPrompt

    const sanitized = (Array.isArray(modelResponse)
      ? modelResponse.join("")
      : String(modelResponse || "")
    )
      .trim()
      .slice(0, 800); // hard cap just in case

    const redacted = sanitized.toUpperCase() === "REDACTED";

    return res.send({
      message: "Done",
      payload: redacted ? "REDACTED" : sanitized,
      meta: {
        original_prompt: originalPrompt,
        redacted,
        flags,
        reasons,
      },
    });
  } catch (e: any) {
    console.error("NSFW filter error:", e?.message || e);
    return res.status(500).send({ message: "Error in NSFW filtering" });
  }
};

/* ---------------------------
   (Optional) If you prefer to keep the old name for backwards-compat:
---------------------------- */
// export const GptRecreateSafe = GptFilterNSFW;

export const GptRecreateText = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { instructions, promptx, imageUrl } = req.body;

  console.log("Original Prompt:", promptx);
  console.log("Instructions:", instructions);

  try {
    let userContent: any = `
Edit the following text based on these instructions:

String length must be less than or equal to 3500

Base text: "${promptx}"
Instructions: "${instructions}"

The final output should be a revised text reflecting the user's requirements while remaining clear and concise.
        `;

    if (typeof imageUrl !== "undefined" && imageUrl) {
      userContent = [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      {
        role: "system",
        content: `
You are a specialized text editor.

Your role:
1. Take a base text prompt and revise it according to the user's instructions.
2. Output a single string with no JSON formatting, code blocks, or additional commentary.
3. Provide clarity and focus on answering the user's instructions.
4. Keep the final output concise yet sufficiently detailed, ensuring grammar and coherence are maintained.
        `,
      },
      {
        role: "user",
        content: userContent,
      },
    ];

    // Call your GPT function that communicates with GPT-4 or another model
    const updatedResponseData = await generateGPT4oPromptProWebX(messages);

    console.log("Updated Response Array:", updatedResponseData);

    // Join the array if needed
    const updatedPrompt = Array.isArray(updatedResponseData)
      ? updatedResponseData.join(" ")
      : updatedResponseData;

    return res.send({
      message: "Done",
      payload: updatedPrompt.trim(),
    });
  } catch (e: any) {
    console.error("Error:", e.message);
    return res.status(500).send({ message: "Error in accessing ChatGPT API" });
  }
};

// --------------------------------------------------
// Controller: EditGeneratedVisualTextOnly
// --------------------------------------------------
export const EditGeneratedVisualTextOnly = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    editvalue,
    createdvisual,
    targetModel,
    duration,
    imageUrl,
  } = req.body;

  console.log("\n------- EditGeneratedVisualTextOnly START ---------");
  console.log("1. Input editvalue:", editvalue);
  console.log("2. Input createdvisual type:", typeof createdvisual);
  console.log(
    "3. Input createdvisual value:",
    JSON.stringify(createdvisual).slice(0, 200) + "..."
  );

  if (!editvalue || !createdvisual) {
    console.log("X. Missing parameters!");
    return res.status(400).send("Missing editvalue or createdvisual");
  }

  // --- Helper: Extract strict header list from the ORIGINAL prompt ---
  function extractHeaderList(src: string): string[] {
    const headerRegex = /([A-Z0-9][A-Z0-9 \/&'()\-\:]+:)/g;
    const list: string[] = [];
    let m;
    while ((m = headerRegex.exec(src)) !== null) {
      const header = m[1].trim();
      if (header.length > 2 && !list.includes(header)) {
        list.push(header);
      }
    }
    return list;
  }

  // --- Helper: Universal Dialogue Protector ---
  const enforceVoiceFormat = (input: string, headers: string[]): string => {
    const dialogHeaders = [
      "CHARACTER VOICES / DIALOGUE:",
      "DIALOGUE:",
      "VOICE & DIALOG:",
    ];
    const activeHeader = headers.find((h) => dialogHeaders.includes(h));

    if (!activeHeader) return input;

    const startIdx = input.indexOf(activeHeader);
    if (startIdx === -1) return input;

    let endIdx = input.length;
    for (const h of headers) {
      if (h === activeHeader) continue;
      const pos = input.indexOf(h, startIdx + activeHeader.length);
      if (pos !== -1 && pos < endIdx) endIdx = pos;
    }

    const before = input.slice(0, startIdx + activeHeader.length);
    const section = input.slice(startIdx + activeHeader.length, endIdx);
    const after = input.slice(endIdx);

    const lines = section.split("\n");
    const processed: string[] = [];
    let prevWasDialog = false;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const nameTone = m[1].trim();
        const rest = m[2].trim();
        const newRest = /^\s*says\b/i.test(rest) ? rest : `says ${rest}`;

        if (prevWasDialog) processed.push("");
        processed.push(`\t${nameTone}: ${newRest}`);
        prevWasDialog = true;
      } else {
        processed.push(`\t${line}`);
        prevWasDialog = false;
      }
    }

    return before + "\n" + processed.join("\n") + "\n\n" + after;
  };

  // --- Core Normal Code Extracted ---
  const processSinglePrompt = async (visualStr: string): Promise<string> => {
    console.log("  -> [Core] Processing prompt of length:", visualStr.length);
    const headerList = extractHeaderList(visualStr);
    console.log("  -> [Core] Found headers:", headerList);
    const headersString = headerList.join("\n");

    const systemPrompt = `
You are a precise Prompt Editor for visual generation AI.
Your goal is to apply a user's requested change (editvalue) to an existing prompt (createdvisual).

STRICT RULES:
1. STRUCTURE PRESERVATION: By default, output EXACTLY the same headers or shot blocks in EXACTLY the same order as the input prompt.
   - Headers detected:
${headersString || "None"}
   - EXCEPTION: If the user explicitly requests dynamic multi-shots, speed ramps, or radical camera shifts, you MUST restructure the prompt to fit the model's template formats (see below).

2. SURGICAL EDITING:
   - Apply the edit strictly (e.g., if user says "make it rain", add rain; if user says "3 different angles", rewrite the shot blocks).
   - If a section is NOT affected by the edit, output it EXACTLY as it was in the original prompt.
   - Safety: Do not output NSFW content.

${getModelDirective(
  targetModel,
  duration,
  visualStr.includes("VOICE & DIALOG:"),
  req.body.ratioKey
)}
`.trim();

    let userPrompt: any = `
ORIGINAL PROMPT TO EDIT:
${visualStr}

USER EDIT REQUEST:
${editvalue}

INSTRUCTIONS:
Rewrite the ORIGINAL PROMPT to satisfy the USER EDIT REQUEST.
Keep the exact same headers (if any). Preserve all long visual character descriptions and strive to maintain the overall style and length of the original prompt.
`.trim();

    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];

    console.log("  -> [Core] Sending to GPT...");
    const raw = await generateGPT4oPrompt5(messages);
    let text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();
    console.log("  -> [Core] Received GPT output of length:", text.length);

    text = text.replace(/^```[a-z]*|```$/gm, "").trim();

    const foundHeaders = [];
    for (const h of headerList) {
      const idx = text.indexOf(h);
      if (idx !== -1) foundHeaders.push({ name: h, index: idx });
    }

    foundHeaders.sort((a, b) => b.index - a.index);

    for (let i = 0; i < foundHeaders.length; i++) {
      const current = foundHeaders[i];
      const next = foundHeaders[i - 1]; // The header below it

      const contentEnd = next ? next.index : text.length;
      const content = text
        .slice(current.index + current.name.length, contentEnd)
        .trim();

      const before = text.slice(0, current.index).trim();
      const after = text.slice(contentEnd);

      text = `${before}\n\n${current.name}\n\t${content}\n\n${after}`.trim();
    }

    text = text.replace(/\n{3,}/g, "\n\n");
    text = enforceVoiceFormat(text, headerList);

    return text.trim();
  };

  try {
    // --- Determine if Array or String ---
    let parsedJson: any[] | null = null;
    if (
      Array.isArray(createdvisual) &&
      createdvisual.length > 0 &&
      createdvisual[0].prompt
    ) {
      parsedJson = createdvisual;
      console.log("4. Detected createdvisual as direct Array (Kling format)");
    } else if (typeof createdvisual === "string") {
      try {
        const parsed = JSON.parse(createdvisual);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].prompt) {
          parsedJson = parsed;
          console.log(
            "4. Detected createdvisual as JSON String Array (Kling format)"
          );
        } else {
          console.log("4. Parsed JSON successfully but NOT a Kling array");
        }
      } catch (e) {
        console.log(
          "4. Failed to parse as JSON, assuming standard text prompt"
        );
      }
    }

    // --- Execution ---
    if (parsedJson) {
      console.log(`5. Executing array mode for ${parsedJson.length} items`);
      const updatedArray = await Promise.all(
        parsedJson.map(async (shot: any, index: number) => {
          console.log(`   -> Starting shot index: ${index}`);
          if (!shot.prompt) return shot;
          let updatedPromptStr = await processSinglePrompt(shot.prompt);

          // Compress Kling multi-line formatting back into a single unbroken string
          updatedPromptStr = updatedPromptStr
            .replace(/[\n\t]+/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

          console.log(`   -> Finished shot index: ${index}`);
          return { ...shot, prompt: updatedPromptStr };
        })
      );
      const finalJson = JSON.stringify(updatedArray, null, 2);
      console.log("6. Final Array built! Payload length:", finalJson.length);
      console.log("------- EditGeneratedVisualTextOnly END ---------\n");
      return res.send(finalJson);
    } else {
      console.log("5. Executing string mode (Standard prompt)");
      const finalOutput = await processSinglePrompt(createdvisual);
      console.log("6. Final String built! Payload length:", finalOutput.length);
      console.log("------- EditGeneratedVisualTextOnly END ---------\n");
      return res.send(finalOutput);
    }
  } catch (e: any) {
    console.error("! EditGeneratedVisualTextOnly Error:", e.message);
    return res.status(500).send("Error editing prompt");
  }
};
export const EditGeneratedVisualTextOnlypp = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    editvalue,
    createdvisual,
    visualsource,
    targetModel,
    duration,
  } = req.body;

  console.log("\n------- EditGeneratedVisualTextOnlypp START ---------");
  console.log("1. Editvalue:", editvalue);
  console.log("2. Createdvisual type:", typeof createdvisual);
  console.log(
    "3. Createdvisual content:",
    JSON.stringify(createdvisual).slice(0, 200) + "..."
  );
  console.log("4. visualsource (context lock):", visualsource);

  function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function extractHeaderList(src: string): string[] {
    const headerRegex = /([A-Z0-9][A-Z0-9 \/&'()\-\:]*:)/g;
    const seen = new Set<string>();
    const list: string[] = [];

    let m;
    while ((m = headerRegex.exec(src)) !== null) {
      const header = m[1].trim();
      if (header.length < 3) continue;
      if (!/^[A-Z0-9]/.test(header)) continue;
      if (!seen.has(header)) {
        seen.add(header);
        list.push(header);
      }
    }
    return list;
  }

  function formatByHeaders(modelText: string, headerList: string[]): string {
    if (!headerList.length) {
      return modelText.trim();
    }

    let working = modelText;

    headerList.forEach((header) => {
      const headerEsc = escapeRegex(header);
      const beforeRegex = new RegExp(`([^\\n])\\s*(${headerEsc})`, "g");
      working = working.replace(beforeRegex, (_full, beforeChar, hdr) => {
        return `${beforeChar}\n${hdr}`;
      });

      const leadingRegex = new RegExp(`\\n\\s*${headerEsc}`, "g");
      working = working.replace(leadingRegex, `\n${header}`);
    });

    const blocks: string[] = [];
    for (let i = 0; i < headerList.length; i++) {
      const header = headerList[i];
      const nextHeader = headerList[i + 1];

      const headerIdx = working.indexOf(header);
      if (headerIdx === -1) {
        continue;
      }

      const bodyStart = headerIdx + header.length;
      let bodyEnd = working.length;
      if (nextHeader) {
        const nextIdx = working.indexOf(nextHeader, bodyStart);
        if (nextIdx !== -1) {
          bodyEnd = nextIdx;
        }
      }

      let bodyChunk = working.slice(bodyStart, bodyEnd).trim();
      const rebuilt = `${header}\n${bodyChunk}`;
      blocks.push(rebuilt);
    }

    if (blocks.length) {
      return blocks.join("\n\n").trim();
    }
    return working.trim();
  }

  // --- Core Normal Code Extracted ---
  const processSinglePrompt = async (visualStr: string): Promise<string> => {
    console.log("  -> [Core PP] Processing prompt length:", visualStr.length);
    const messages = [
      {
        role: "system",
        content: `
You are an AI video generation prompts Editor.

You will receive:
- visualsource: optional world / tone / context hints.
- createdvisual: an EXISTING prompt. It is already organized into multiple section headers.
  The exact headers, spelling, punctuation, and order in createdvisual are the law.
- editvalue: what the user wants now.

YOUR JOB:
1. Write a NEW VERSION of the prompt that fully satisfies editvalue.
   - You must update ALL sections so they reflect what the user wants.
   - You MAY introduce new characters, animals, props, weapons, vehicles, combat, mood, tone, lighting, pacing, etc, IF that is requested or implied by editvalue.
   - What the user asks for in editvalue MUST now actually be happening on camera in this shot.
   - 'always specify characters with name  and description ex Adam The guy(blue eyes,clothing etc), Donny The guy(features ) , Fenta a girl(looks etc)  , '

2. You MUST preserve structure from createdvisual:
   - By default, output EXACTLY the SAME section headers or shot blocks.
   - EXCEPTION: If the user requests dynamic multi-shots or speed shifts, restructure the prompt to fit the model's structural template (see below).

3. Technical flags:
   - If createdvisual contains hard flags like "fps: 30", "music: none", etc.,keep them unless editvalue clearly told you to change them.

4. Output style:
   - Return plain text. It's okay if you put header and body on the same line or run headers together; the server will re-space it.
   - Do NOT add explanations, do NOT wrap in JSON, do NOT add code fences.

${getModelDirective(
  targetModel,
  duration,
  createdvisual.includes("VOICE & DIALOG:"),
  req.body.ratioKey
)}
`.trim(),
      },
      {
        role: "user",
        content: `
visualsource (optional context you MAY use, but editvalue can override it):
${visualsource}

createdvisual (THIS SHOWS THE EXACT SECTION HEADERS AND ORDER YOU MUST KEEP):
${visualStr}

editvalue (THIS IS WHAT WE WANT NOW. Rewrite ALL sections so they reflect this request. Keep the SAME headers and SAME header order. Preserve technical flags like fps: 30, music: none, etc. unless I explicitly said to change them.):
${editvalue}

Now return ONLY the new rewritten prompt text, using the SAME headers and header order from createdvisual. Do not add explanations.
`.trim(),
      },
    ];

    console.log("  -> [Core PP] Calling GPT...");
    const updatedResponseData = await generateGPT4oPrompt5(messages);
    const rawModelOutput = Array.isArray(updatedResponseData)
      ? updatedResponseData.join(" ")
      : updatedResponseData || "";
    console.log(
      "  -> [Core PP] GPT returned output length:",
      rawModelOutput.length
    );

    const headerList = extractHeaderList(visualStr);
    console.log("  -> [Core PP] Parsed headers:", headerList);
    const finalOutput = formatByHeaders(rawModelOutput, headerList);

    return finalOutput;
  };

  try {
    // --- Determine if Array or String ---
    let parsedJson: any[] | null = null;
    if (
      Array.isArray(createdvisual) &&
      createdvisual.length > 0 &&
      createdvisual[0].prompt
    ) {
      parsedJson = createdvisual;
      console.log("5. Detected as direct array (Kling format)");
    } else if (typeof createdvisual === "string") {
      try {
        const parsed = JSON.parse(createdvisual);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].prompt) {
          parsedJson = parsed;
          console.log("5. Detected as JSON string array (Kling format)");
        } else {
          console.log("5. Valid JSON but not recognized as Kling array format");
        }
      } catch (e) {
        console.log("5. Invalid JSON, defaulting to normal string format");
      }
    }

    // --- Execution ---
    if (parsedJson) {
      console.log(`6. Executing array mode for ${parsedJson.length} items`);
      const updatedArray = await Promise.all(
        parsedJson.map(async (shot: any, index: number) => {
          console.log(`   -> Starting PP shot index ${index}`);
          if (!shot.prompt) return shot;
          let updatedPromptStr = await processSinglePrompt(shot.prompt);

          // Compress Kling multi-line formatting back into a single unbroken string
          updatedPromptStr = updatedPromptStr
            .replace(/[\n\t]+/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

          console.log(`   -> Finished PP shot index ${index}`);
          return { ...shot, prompt: updatedPromptStr };
        })
      );

      const stringified = JSON.stringify(updatedArray, null, 2);
      console.log("7. Final Output Array length:", stringified.length);
      console.log("------- EditGeneratedVisualTextOnlypp END ---------\n");
      return res.send(stringified);
    } else {
      console.log("6. Executing string mode");
      const finalOutput = await processSinglePrompt(createdvisual);
      console.log("7. Final Output String length:", finalOutput.length);
      console.log("------- EditGeneratedVisualTextOnlypp END ---------\n");
      return res.send(finalOutput);
    }
  } catch (e: any) {
    console.error("! EditGeneratedVisualTextOnlypp Error:", e.message);
    return res.status(500).send("Error in editing prompt");
  }
};

// promptComposer.ts

export type VeoOptions = {
  aspectRatio?: "16:9" | "9:16";
  style?: "realistic" | "cinematic" | "animated" | "surreal";
  includeNarration?: boolean;
  mood?: string;
  music?: string;
  sfx?: string[];
  camera?: string[];
};

// --- helper (use function declaration so it's hoisted) ---
function summarizeToShortLines(scene: string, desc: string) {
  const base = `${scene} ${desc}`.replace(/\s+/g, " ").trim();
  const cut = base.split(/[\.\!\?]/)[0].slice(0, 160);
  return cut.endsWith(".") ? cut : `${cut}.`;
}

// Express handler that BUILDS the Veo 3 prompt from your scene + description
export const GptV = async (req: Request, res: Response): Promise<any> => {
  try {
    // Expect: { question, imageDescription, opt? }
    const { question, imageDescription, opt = {} } = req.body as {
      question: string;
      imageDescription: string;
      opt?: {
        aspectRatio?: "16:9" | "9:16";
        style?: "realistic" | "cinematic" | "animated" | "surreal";
        includeNarration?: boolean;
        mood?: string;
        music?: string; // "no music" to suppress background music
        sfx?: string[]; // ["wind", "footsteps"]
        camera?: string[]; // ["slow pan", "gentle push-in"]
      };
    };

    // Defaults (feel free to tweak)
    const {
      //aspectRatio = "16:9",
      style = "cinematic",
      includeNarration = true,
      mood = "natural",
      music = "light ambient",
      sfx = ["environmental room tone"],
      camera = ["gentle pan", "slow push-in"],
    } = opt;

    // Shot cue from camera array
    const shotCue =
      camera.length > 0
        ? `${camera[0]} on the main subject; ${camera.slice(1).join(", ")}.`
        : "steady shot on the main subject.";

    // Core visual brief (scene + image description)
    const visual = [
      `Style: ${style}, mood: ${mood}.`,
      `Scene: ${question?.trim()}`,
      `Details: ${imageDescription?.trim()}`,
      `Camera: ${shotCue}`,
    ].join(" ");

    // Audio cues (Veo reads this as generation instructions)
    const audioLines = [
      `Audio: ambience ${music !== "no music" ? `+ ${music}` : "(no music)"}.`,
      sfx.length ? `SFX: ${sfx.join(", ")}.` : "",
    ].filter(Boolean);

    // Optional short narration (lip-synced; keep concise for 8s)
    const narration = includeNarration
      ? `Narrator: ${summarizeToShortLines(
          question,
          imageDescription
        )} (no subtitles)`
      : "";

    const prompt = [visual, audioLines.join(" "), narration]
      .filter(Boolean)
      .join(" ");

    // Keep output clean (no baked-in text)
    /// const negativePrompt ="subtitles, on-screen text, captions, watermark, logo, low quality, oversaturated, cartoonish";

    return res.send({
      message: "Done",

      visualPrompt: prompt,
    });
  } catch (e: any) {
    console.error("GptVideoVisualx error:", e?.message);
    return res
      .status(500)
      .send({ message: "Prompt build failed", error: e?.message });
  }
};

export const GptVideoVisualMiniMax = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    question,
    imageDescription,
    PlanVid,
    duration,
    targetModel,
    imageUrl,
  } = req.body as {
    question: string;
    imageDescription: string;
    PlanVid: any;
    duration: any;
    targetModel?: string;
    imageUrl?: string;
  };

  if (!question || !imageDescription || !PlanVid) {
    return res.status(400).send({
      message: "Body must contain { question, imageDescription, PlanVid }",
    });
  }

  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return JSON.stringify(obj);
    }
  };

  const systemPrompt = `
You are a motion director for MiniMax Hailuo-2.3 (image-to-video).
You are animating ONE EXISTING frame.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH. It dictates exactly who and what is on screen for this specific shot.
- "question" = BACKGROUND STORY CONTEXT. Use this to understand the mood and weight, but treat it as lore, not an action list.

STRICT VISUAL BOUNDARY (PREVENT CONTEXT LEAK):
- Only animate characters or elements explicitly present in the "imageDescription".
- If the "question" mentions events or characters not visible in the "imageDescription", ignore them for this shot.

CHARACTERS AND CONTINUITY:
- Video models require visual grounding to maintain identity.
- You MUST include the exact visual descriptions from the PlanVid characters array alongside their names in your motion blocks.

// Temporary: Auto Prompt uses the generic CAMERA / MOTION structure for every model.
${getModelDirective(targetModel, duration, false, req.body.ratioKey, false)}
`.trim();

  const userPrompt = `
PlanVid (ground truth):
${safeStringify(PlanVid)}

Story Context ("question"):
${question}

Visual Base Frame (Ground Truth):
${imageDescription}

Target Duration: ${duration} seconds.

Create the MiniMax Hailuo-2.3 prompt. Ensure the visual descriptions are included in the ACTION / MOTION block.
`.trim();

  console.log(
    "================================================================================"
  );
  console.log(
    "=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisualMiniMax START ==="
  );
  console.log("  [INPUTS RECEIVED]");
  console.log("  targetModel :", targetModel);
  console.log("  duration    :", duration);
  console.log("  question    :", question);
  console.log("  imageDescription :", imageDescription);
  console.log("  PlanVid Object  :", safeStringify(PlanVid));
  console.log("  ratioKey    :", req.body.ratioKey);
  console.log("  [PROMPTS TO LLM]");
  console.log("  systemPrompt:\n", systemPrompt);
  console.log("  userPrompt:\n", userPrompt);
  console.log(
    "================================================================================"
  );

  const formatCompact = (t: string) => {
    let out = t.trim();

    // 1. Force spacing for inline headers that get smushed to punctuation (e.g. "field.SHOT 1:" or "bokeh.  ACTION:")
    const smushRegex = /([^\n])\s*(CAMERA:|MOTION:|ACTION \/ MOTION:|ENVIRONMENT DEPTH:|LIGHTING \/ STYLE:|VOICE & DIALOG:|CONSTRAINTS:|HEADER:|SHOT [a-zA-Z0-9\-\.\s\(\)\:]+:)/gi;
    out = out.replace(smushRegex, "$1\n\n$2");

    // 2. Dynamically space ALL headers (Added \. for decimal timestamps like 0:02.5)
    const dynamicHeaderRegex = /(?:^|\n)\s*([A-Z0-9][A-Z0-9 \/&'()\-\.\:]+:)/g;
    out = out.replace(dynamicHeaderRegex, (_match, p1) => {
      return `\n\n${p1.trim()}\n\t`;
    });

    // Clean up excessive newlines
    out = out.replace(/\n{3,}/g, "\n\n").trim();

    return out;
  };

  try {
    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];

    const raw = await generateGPT4oPrompt5B(messages);
    const text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();

    const storyPrompt = formatCompact(text);

    console.log(
      "================================================================================"
    );
    console.log(
      "=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisualMiniMax RESULT ==="
    );
    console.log("  raw LLM output:", raw);
    console.log("  storyPrompt (formatted):\n", storyPrompt);
    console.log(
      "=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisualMiniMax END ==="
    );
    console.log(
      "================================================================================"
    );

    return res.send({
      message: "Done",
      storyPrompt,
    });
  } catch (e: any) {
    console.error("GptVideoVisualMiniMax error:", e.message);
    return res.status(500).send({ message: "Error creating MiniMax prompt" });
  }
};

export const GptVideoVisualKling3 = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    question,
    imageDescription,
    PlanVid,
    duration,
    imageUrl,
  } = req.body as {
    question: string;
    imageDescription: string;
    PlanVid: any;
    duration?: number | string;
    imageUrl?: string;
  };

  if (!question || !imageDescription || !PlanVid) {
    return res.status(400).send({
      message: "Body must contain { question, imageDescription, PlanVid }",
    });
  }

  // Normalize duration
  const vidDuration = Number(duration) || 5;

  // ðŸ”¥ LOGIC: Multi-shot requires at least 6 seconds
  const isMultiShot = vidDuration >= 15;

  // Calculate shots
  const shotCount = vidDuration >= 11 ? 3 : 2;

  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return JSON.stringify(obj);
    }
  };

  /* ============================================================
     MODE A: STANDARD SINGLE SHOT (Duration < 6s)
     Enforcing the "Single Continuous Action" physics rule
  ============================================================ */
  let systemPrompt = "";
  let userPrompt = "";

  if (!isMultiShot) {
    systemPrompt = `
You are a motion director for Kling v3 (image-to-video).
You are animating ONE EXISTING frame.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH. It dictates exactly who and what is on screen for this specific shot.
- "question" = BACKGROUND STORY CONTEXT. Use this to understand the mood and weight, but treat it as lore, not an action list.

STRICT VISUAL BOUNDARY (PREVENT CONTEXT LEAK):
- Only animate characters or elements explicitly present in the "imageDescription".
- If the "question" mentions events or characters not visible in the "imageDescription", ignore them completely for this shot.

CHARACTERS AND CONTINUITY:
- Video models require visual grounding to maintain identity.
- In the ACTION section, you MUST include the exact visual descriptions from the PlanVid characters array alongside their names.

MOVEMENT MANDATE (SINGLE-ACTION):
- Focus exclusively on ONE single, continuous physical movement to maintain physics (e.g., "walking forward steadily", "continuously waving").
- Restrict to ONE simple, slow camera move (e.g., push, orbit, or pan).

STRICT RULES:
- Output exactly two sections in this order:
  CAMERA:
  ACTION:

SECTION CONTENT GUIDANCE:
CAMERA:
- Describe the technical move in 1 concise sentence.
ACTION:
- Describe the physics, atmospheric motion, and character actions present ONLY in the imageDescription.
- You MUST include the full visual descriptions for all active characters here.
- Write 2 to 3 flowing, cinematic sentences.
`.trim();

    userPrompt = `
PlanVid (ground truth):
${safeStringify(PlanVid)}

Story Context ("question"):
${question}

Visual Base Frame (Ground Truth):
${imageDescription}

Target Duration: ${vidDuration} seconds.

Create the Kling v3 prompt. Ensure the visual descriptions are included in the ACTION block.
`.trim();
  } else {
    /* ============================================================
       MODE B: MULTI-SHOT (Duration >= 6s)
       Generates a JSON Array String with STRICT LIMITS
    ============================================================ */

    const durationPerShot = Math.floor(vidDuration / shotCount);

    systemPrompt = `
You are a Lead Cinematographer for Kling v3 Multi-Shot Video Generation.
Your task is to break a single action sequence into ${shotCount} distinct camera shots.
Total Video Duration: ${vidDuration} seconds.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH for ALL shots.
- "question" = BACKGROUND STORY CONTEXT. Use it for mood and atmosphere, but DO NOT use it to advance the plot beyond the current scene.

STRICT VISUAL BOUNDARY (PREVENT CONTEXT LEAK):
- ALL SHOTS must strictly take place in the exact same location, time of day, and reality as the "imageDescription".
- You CANNOT time-jump, change locations, or introduce characters that are not in the "imageDescription".
- If the "question" mentions future events or other characters, IGNORE THEM completely. Only animate the characters present in the base frame continuing their current physical struggle.

CHARACTERS AND CONTINUITY:
- In the ACTION section of EACH shot, you MUST include the exact visual descriptions from the PlanVid characters array alongside their names to maintain identity across cuts.

CRITICAL PHYSICS RULES FOR EACH SHOT:
1. ONE CONTINUOUS ACTION PER SHOT: Focus exclusively on ONE single, continuous physical movement per shot timeframe.
2. SIMPLE CAMERA: Restrict to ONE simple camera move per shot.

STRICT LENGTH CONSTRAINT (CRITICAL):
- Each "prompt" field inside the JSON must be UNDER 500 CHARACTERS.
- Be highly concise and use technical shorthand to ensure the API does not crash.

STRICT OUTPUT FORMAT:
Output ONLY a raw JSON Array string. No markdown formatting.
Format:
[
  { "prompt": "CAMERA: [Simple move]. ACTION: [One continuous action + visual descriptions]... (MAX 500 CHARS)", "duration": "${durationPerShot}" },
  { "prompt": "CAMERA: [Simple move]. ACTION: [Next continuous action]... (MAX 500 CHARS)", "duration": "${durationPerShot}" }
]
`.trim();

    userPrompt = `
Total Duration: ${vidDuration} seconds (${shotCount} shots).
PlanVid: ${safeStringify(PlanVid)}
Story Context ("question"): ${question}
Starting Frame (Ground Truth for ALL shots): ${imageDescription}

Generate the JSON Array for ${shotCount} shots now.
REMEMBER: EACH PROMPT MUST BE < 500 CHARS AND STRICTLY ADHERE TO THE VISUAL GROUND TRUTH.
`.trim();
  }

  // Formatting helper with manual slicing for Mode A, and bypass for Mode B
  const formatCompact = (t: string) => {
    let out = t.trim();

    // If it's the JSON array (Mode B), return it cleanly without header parsing
    if (out.startsWith("[") && out.endsWith("]")) {
      return out;
    }

    // If it's Mode A, apply the strict header isolation formatting
    const camH = "CAMERA:";
    const actH = "ACTION:";

    const camIdx = out.indexOf(camH);
    const actIdx = out.indexOf(actH);

    if (camIdx !== -1 && actIdx !== -1) {
      const camContent = out.slice(camIdx + camH.length, actIdx).trim();
      const actContent = out.slice(actIdx + actH.length).trim();

      out = `${camH}\n\t${camContent}\n\n${actH}\n\t${actContent}`;
    }

    return out.trim();
  };

  try {
    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];

    const raw = await generateGPT4oPrompt5B(messages);

    let text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();
    if (text.startsWith("```json"))
      text = text.replace("```json", "").replace("```", "");
    if (text.startsWith("```"))
      text = text.replace("```", "").replace("```", "");

    const storyPrompt = formatCompact(text);

    return res.send({
      message: "Done",
      storyPrompt,
      isMultiShot, // True only if duration >= 6
    });
  } catch (e: any) {
    console.error("GptVideoVisualKling3 error:", e.message);
    return res.status(500).send({ message: "Error creating prompt" });
  }
};

export const GptVideoVisualVeo = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    question,
    imageDescription,
    PlanVid,
    duration,
    imageUrl,
  } = req.body as {
    question: string;
    imageDescription: string;
    PlanVid: any;
    duration: any;
    imageUrl?: string;
  };

  if (!question || !imageDescription || !PlanVid) {
    return res.status(400).send({
      message: "Body must contain { question, imageDescription, PlanVid }",
    });
  }

  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return JSON.stringify(obj);
    }
  };

  const systemPrompt = `
You are an expert motion director for Veo 3.1.
You are animating a SINGLE EXISTING frame.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH. It dictates exactly who and what is on screen for this specific shot.
- "question" = BACKGROUND STORY CONTEXT. Use this to understand the mood, weight, and history of the moment, but DO NOT use it as an action list.

STRICT VISUAL BOUNDARY (PREVENT CONTEXT LEAK):
- NEVER hallucinate or add characters, actions, or elements from the "question" or "PlanVid" if they are NOT explicitly present in the "imageDescription".
- THIS INCLUDES DIALOGUE: A character CANNOT speak if they are not physically named in the "imageDescription". If the image only shows the Emperor and Aku, only the Emperor or Aku can speak.

CHARACTERS AND CONTINUITY:
- Video models do not know who characters are by name alone.
- You MUST include their exact visual descriptions from the PlanVid characters array inside the CINEMATOGRAPHY section AND the CHARACTER VOICES / DIALOGUE section.

MOVEMENT MANDATE:
- Even if the subject is standing still, the video MUST have motion (breathing, wind, shifting weight).
- Describe specific camera moves to force parallax.

STRICT RULES:
- Organize the text into these exact sections, in this order:
  CAMERA:
  CINEMATOGRAPHY:

SECTION CONTENT GUIDANCE:
CAMERA:
- Describe the technical camera move ONLY (e.g., "Slow dolly-in with lateral drift"). 1 sentence.

CINEMATOGRAPHY:
- Describe the lighting, atmospheric physics, and the visual character actions present ONLY in the imageDescription.
- You MUST explicitly write the specific NAMES of any focal characters on screen, alongside their visual descriptions. If they are not named in the imageDescription, do not invent names. 2 sentences.
`.trim();

  const userPrompt = `
PlanVid (ground truth):
${safeStringify(PlanVid)}

Story Context ("question"):
${question}

Visual Base Frame (Ground Truth):
${imageDescription}

Target Duration: ${duration} seconds.
  `.trim();

  const enforceVoiceFormat = (input: string): string => {
    const header = "CHARACTER VOICES / DIALOGUE:";
    const nextHeader = "RENDER SETTINGS:";

    const startIdx = input.indexOf(header);
    if (startIdx === -1) return input;

    const endIdx =
      input.indexOf(nextHeader, startIdx + header.length) !== -1
        ? input.indexOf(nextHeader, startIdx + header.length)
        : input.length;

    const before = input.slice(0, startIdx + header.length);
    const section = input.slice(startIdx + header.length, endIdx);
    const after = input.slice(endIdx);

    const lines = section.split("\n");
    const processed: string[] = [];
    let prevWasDialog = false;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const nameTone = m[1].trim();
        const rest = m[2].trim();
        const newRest = /^\s*says\b/i.test(rest) ? rest : `says ${rest}`;

        if (prevWasDialog) processed.push("");
        processed.push(`\t${nameTone}: ${newRest}`);
        prevWasDialog = true;
      } else {
        processed.push(`\t${line}`);
        prevWasDialog = false;
      }
    }

    return before + "\n" + processed.join("\n") + "\n\n" + after;
  };

  const formatForReadability = (input: string) => {
    let t = input.trim();

    const headers = [
      "CAMERA:",
      "CINEMATOGRAPHY:",
      "CHARACTER VOICES / DIALOGUE:",
      "RENDER SETTINGS:",
    ];

    headers.forEach((h) => {
      const re = new RegExp(`\\s*${h}`, "i");
      t = t.replace(re, `\n\n${h}\n\t`);
    });

    t = enforceVoiceFormat(t);
    t = t.replace(/RENDER SETTINGS:[\s\S]*$/i, "RENDER SETTINGS:\n\tNo music");

    return t.trim();
  };

  try {
    // Step 1: Visual Sequence
    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];
    const raw = await generateGPT4oPrompt5B(messages);
    const text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();

    // Step 2: Dialogue Pass
    const dialogueSystemPrompt = `
You are an expert ADR Dialogue writer for a video scene.
You have ONE JOB: Write dialogue for the characters present in the locked visual scene.

LOCKED VISUAL SCENE:
${text}

SCENE CONTEXT (Base Frame Description):
${imageDescription}

VIDEO DURATION LIMIT: ${duration} seconds.

STRICT RULES:
1. MAXIMUM 1 OR 2 CHARACTERS CAN SPEAK. Pick only the primary focal character(s). Do not write dialogue for everyone.
2. STRICT WORD COUNT: The video is only ${duration} seconds long. The TOTAL combined dialogue for the entire scene MUST NOT EXCEED ${Math.max(
      1,
      Math.floor(Number(duration || 5) * 2.5)
    )} words!
3. STRICT NAMING CHECK: You can ONLY write dialogue for a character if their EXACT SPECIFIC NAME (e.g. "Anakin Skywalker") is explicitly printed in the text of the LOCKED VISUAL SCENE.
4. DO NOT INVENT OR CHANGE NAMES. If a character is named with a special character like "@Relo", you MUST use exactly "@Relo" in the dialogue block. Do NOT invent a generic name.
5. Format: <EXACT NAME + visual descriptions> (tone): says "short line"
6. If no dialogue makes sense, strictly output: "No dialogue."
    `.trim();

    const dialogueMessages = [
      { role: "system", content: dialogueSystemPrompt },
      {
        role: "user",
        content: "Generate the CHARACTER VOICES / DIALOGUE section now.",
      },
    ];
    const rawDialog = await generateGPT4oPrompt5B(dialogueMessages);
    let textDialog = (Array.isArray(rawDialog)
      ? rawDialog.join("")
      : String(rawDialog)
    ).trim();
    if (textDialog.startsWith("CHARACTER VOICES / DIALOGUE:")) {
      textDialog = textDialog
        .replace("CHARACTER VOICES / DIALOGUE:", "")
        .trim();
    }

    // Combine
    const combinedText = `${text}\n\nCHARACTER VOICES / DIALOGUE:\n${textDialog}\n\nRENDER SETTINGS:\n\tNo music`;
    const storyPrompt = formatForReadability(combinedText);

    return res.send({ message: "Done", storyPrompt });
  } catch (e: any) {
    return res.status(500).send({ message: "Error in accessing AI API" });
  }
};

export const GptVideoVisualKling3Audio = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    question,
    imageDescription,
    PlanVid,
    duration,
    imageUrl,
  } = req.body as {
    question: string;
    imageDescription: string;
    PlanVid: any;
    duration?: number | string;
    imageUrl?: string;
  };

  if (!question || !imageDescription || !PlanVid) {
    return res.status(400).send({
      message: "Body must contain { question, imageDescription, PlanVid }",
    });
  }

  // Normalize duration
  const vidDuration = Number(duration) || 5;

  // ðŸ”¥ LOGIC: Multi-shot requires at least 6 seconds
  const isMultiShot = vidDuration >= 15;

  // Calculate shots (only if multi-shot)
  const shotCount = vidDuration >= 11 ? 3 : 2;

  // Helper: stringify safely without crashing on circular refs
  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return JSON.stringify(obj);
    }
  };

  /* ============================================================
     MODE A: STANDARD SINGLE SHOT (Duration < 6s)
  ============================================================ */
  let systemPrompt = "";
  let userPrompt = "";

  if (!isMultiShot) {
    systemPrompt = `
You are an expert motion director for Veo 3.1 / Kling v3.
You are animating a SINGLE EXISTING frame.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH. It dictates exactly who and what is on screen for this specific shot.
- "question" = BACKGROUND STORY CONTEXT. Use this to understand the mood, weight, and history, but DO NOT use it as an action list.

STRICT VISUAL BOUNDARY (PREVENT CONTEXT LEAK):
- NEVER hallucinate or add characters, actions, or elements from the "question" if they are NOT explicitly present in the "imageDescription".
- THIS INCLUDES DIALOGUE: A character CANNOT speak if they are not physically named in the "imageDescription".

CHARACTERS AND CONTINUITY:
- Video models require visual grounding to maintain identity.
- You MUST include the exact visual descriptions from the PlanVid characters array inside the CINEMATOGRAPHY section AND the CHARACTER VOICES / DIALOGUE section.

CRITICAL RULE 1: ONE SINGLE CONTINUOUS ACTION (NO CHOREOGRAPHY)
- Focus exclusively on ONE single, continuous physical movement to maintain physics (e.g., "walking forward steadily", "continuously waving").

CRITICAL RULE 2: SIMPLE CAMERA MOVEMENT
- Restrict to ONE simple, slow camera move.

STRICT RULES:
- Organize the text into these exact sections, in this order:
  CAMERA:
  CINEMATOGRAPHY:

SECTION CONTENT GUIDANCE:
CAMERA:
- Describe the technical move in 1 concise sentence.

CINEMATOGRAPHY:
- Describe the physics, atmospheric lighting, and continuous character actions present ONLY in the imageDescription.
- You MUST explicitly write the specific NAMES of any focal characters on screen, alongside their visual descriptions. If they are not named in the imageDescription, do not invent names.
`.trim();

    userPrompt = `
PlanVid (ground truth):
${safeStringify(PlanVid)}

Story Context ("question"):
${question}

Visual Base Frame (Ground Truth):
${imageDescription}

Target Duration: ${vidDuration} seconds.

Create the SINGLE final production prompt.
CRITICAL: Restrict the motion to ONE continuous action.
`.trim();
  } else {
    /* ============================================================
       MODE B: MULTI-SHOT (Duration >= 6s)
       Generates a JSON Array String
    ============================================================ */

    const durationPerShot = Math.floor(vidDuration / shotCount);

    systemPrompt = `
You are a Lead Cinematographer for Kling v3 Multi-Shot Video Generation.
Your task is to break a single action sequence into ${shotCount} distinct camera shots.
Total Video Duration: ${vidDuration} seconds.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH for ALL shots.
- "question" = BACKGROUND STORY CONTEXT. Use it for mood and atmosphere, but DO NOT use it to advance the plot beyond the current scene.

STRICT VISUAL BOUNDARY (PREVENT CONTEXT LEAK):
- ALL SHOTS must strictly take place in the exact same location, time of day, and reality as the "imageDescription".
- You CANNOT time-jump, change locations, or introduce characters that are not in the "imageDescription".
- If the "question" mentions future events or other characters, IGNORE THEM completely. Only animate the characters present in the base frame.
- A character CANNOT speak in a shot if they are not visible in that specific shot.

CHARACTERS AND CONTINUITY:
- In the CINEMATOGRAPHY section of each shot, you MUST explicitly write the EXACT SPECIFIC NAMES and visual descriptions of any focal characters on screen. If they are not named in the imageDescription, do not invent names.

CRITICAL PHYSICS RULES FOR EACH SHOT:
1. ONE CONTINUOUS ACTION PER SHOT.
2. SIMPLE CAMERA: One basic camera move per shot.

STRICT LENGTH CONSTRAINT (CRITICAL):
- Each "prompt" field inside the JSON must be UNDER 300 CHARACTERS (to save room for dialogue).
- Be highly concise and use technical shorthand to ensure the API does not crash.

STRICT OUTPUT FORMAT:
Output ONLY a raw JSON Array string. No markdown.
Format:
[
  { "prompt": "CAMERA: [Simple Move] CINEMATOGRAPHY: [One continuous action + visual descriptions] ... (MAX 300 CHARS)", "duration": "${durationPerShot}" },
  { "prompt": "CAMERA: [Next Move] CINEMATOGRAPHY: [Next continuous action] ... (MAX 300 CHARS)", "duration": "${durationPerShot}" }
]
`.trim();

    userPrompt = `
Total Duration: ${vidDuration} seconds (${shotCount} shots).
PlanVid: ${safeStringify(PlanVid)}
Story Context ("question"): ${question}
Starting Frame (Ground Truth for ALL shots): ${imageDescription}

Generate the JSON Array for ${shotCount} shots now.
REMEMBER: EACH PROMPT MUST BE < 500 CHARACTERS. STRICTLY ADHERE TO THE VISUAL GROUND TRUTH.
`.trim();
  }

  // Permissive Dialogue Formatter
  const enforceVoiceFormat = (input: string): string => {
    const header = "CHARACTER VOICES / DIALOGUE:";
    const nextHeader = "RENDER SETTINGS:";

    const startIdx = input.indexOf(header);
    if (startIdx === -1) return input;

    const endIdx =
      input.indexOf(nextHeader, startIdx + header.length) !== -1
        ? input.indexOf(nextHeader, startIdx + header.length)
        : input.length;

    const before = input.slice(0, startIdx + header.length);
    const section = input.slice(startIdx + header.length, endIdx);
    const after = input.slice(endIdx);

    const lines = section.split("\n");
    const processed: string[] = [];
    let prevWasDialog = false;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const nameTone = m[1].trim();
        const rest = m[2].trim();
        const newRest = /^\s*says\b/i.test(rest) ? rest : `says ${rest}`;

        if (prevWasDialog) processed.push("");
        processed.push(`\t${nameTone}: ${newRest}`);
        prevWasDialog = true;
      } else {
        processed.push(`\t${line}`);
        prevWasDialog = false;
      }
    }

    return before + "\n" + processed.join("\n") + "\n\n" + after;
  };

  const formatForReadability = (input: string) => {
    let t = input.trim();

    // IF JSON (Multi-shot), return raw without parsing headers
    if (t.startsWith("[") && t.endsWith("]")) {
      return t;
    }

    // Manual string slicing for clean formatting on Single Shots
    const camH = "CAMERA:";
    const cinH = "CINEMATOGRAPHY:";

    const camIdx = t.indexOf(camH);
    const cinIdx = t.indexOf(cinH);

    if (camIdx !== -1 && cinIdx !== -1) {
      const camContent = t.slice(camIdx + camH.length, cinIdx).trim();
      const rest = t.slice(cinIdx);
      t = `${camH}\n\t${camContent}\n\n${rest}`;
    }

    // Now apply the regex replacer for the rest of the headers
    const headers = [
      "CINEMATOGRAPHY:",
      "CHARACTER VOICES / DIALOGUE:",
      "RENDER SETTINGS:",
    ];

    headers.forEach((h) => {
      const re = new RegExp(`\\s*${h}`, "i");
      t = t.replace(re, `\n\n${h}\n\t`);
    });

    t = enforceVoiceFormat(t);
    t = t.replace(
      /RENDER SETTINGS:[\s\S]*$/i,
      "RENDER SETTINGS:\n\tmusic: none"
    );

    return t.trim();
  };

  try {
    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];
    const raw = await generateGPT4oPrompt5B(messages);
    let text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();
    if (text.startsWith("```json"))
      text = text.replace("```json", "").replace("```", "");
    if (text.startsWith("```"))
      text = text.replace("```", "").replace("```", "");

    let combinedText = "";

    const generateDialogue = async (
      visualScene: string,
      currentShotDuration: any
    ) => {
      const dialogueSystemPrompt = `
You are an expert ADR Dialogue writer for a video scene. Write dialogue for the locked visual scene.
LOCKED VISUAL SCENE:
${visualScene}

SCENE CONTEXT (Base Frame Description):
${imageDescription}

VIDEO DURATION LIMIT: ${currentShotDuration} seconds.

STRICT RULES:
1. MAXIMUM 1 OR 2 CHARACTERS CAN SPEAK. Pick only the primary focal character(s). Do not write dialogue for everyone.
2. STRICT WORD COUNT: The exact shot length is ${currentShotDuration} seconds. The TOTAL combined dialogue MUST NOT EXCEED ${Math.max(
        1,
        Math.floor(Number(currentShotDuration || 5) * 2.5)
      )} words!
3. STRICT NAMING CHECK: You can ONLY write dialogue for a character if their EXACT SPECIFIC NAME (e.g. "Anakin Skywalker") is explicitly printed in the text of the LOCKED VISUAL SCENE.
4. DO NOT INVENT OR CHANGE NAMES. If a character is named with a special character like "@Relo", you MUST use exactly "@Relo" in the dialogue block. Do NOT invent a generic name.
5. Format: <EXACT NAME + visual descriptions> (tone): says "short line"
6. If no dialogue makes sense, strictly output: "No dialogue."
        `.trim();
      const dialogueMessages = [
        { role: "system", content: dialogueSystemPrompt },
        {
          role: "user",
          content: "Generate the CHARACTER VOICES / DIALOGUE section now.",
        },
      ];
      const rawDialog = await generateGPT4oPrompt5B(dialogueMessages);
      let textDialog = (Array.isArray(rawDialog)
        ? rawDialog.join("")
        : String(rawDialog)
      ).trim();
      if (textDialog.startsWith("CHARACTER VOICES / DIALOGUE:")) {
        textDialog = textDialog
          .replace("CHARACTER VOICES / DIALOGUE:", "")
          .trim();
      }
      return textDialog;
    };

    if (isMultiShot) {
      try {
        let shots = JSON.parse(text);
        shots = await Promise.all(
          shots.map(async (shot: any) => {
            const textDialog = await generateDialogue(
              shot.prompt,
              shot.duration || Math.floor(vidDuration / shotCount)
            );
            shot.prompt = `${shot.prompt}\n\nCHARACTER VOICES / DIALOGUE:\n${textDialog}\n\nRENDER SETTINGS:\n\tNo music`;
            return shot;
          })
        );
        combinedText = JSON.stringify(shots, null, 2);
      } catch (e) {
        combinedText = text;
      }
    } else {
      const textDialog = await generateDialogue(text, vidDuration);
      combinedText = `${text}\n\nCHARACTER VOICES / DIALOGUE:\n${textDialog}\n\nRENDER SETTINGS:\n\tNo music`;
    }

    const storyPrompt = formatForReadability(combinedText);

    return res.send({
      message: "Done",
      storyPrompt,
      isMultiShot,
    });
  } catch (e: any) {
    console.error("GptVideoVisualKling3Audio error:", e.message);
    return res.status(500).send({ message: "Error in accessing AI API" });
  }
};

export const GptVideoVisualSora = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    question,
    imageDescription,
    PlanVid,
    duration,
    imageUrl,
  } = req.body as {
    question: string;
    imageDescription: string;
    PlanVid: any;
    duration: any;
    imageUrl?: string;
  };

  if (!question || !imageDescription || !PlanVid) {
    return res.status(400).send({
      message: "Body must contain { question, imageDescription, PlanVid }",
    });
  }

  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return JSON.stringify(obj);
    }
  };

  const systemPrompt = `
You are an expert motion director for an IMAGE-TO-VIDEO pipeline (Sora 2 style i2v).
You are animating ONE EXISTING frame.

Interpret inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH. It dictates exactly who and what is on screen for this specific shot.
- "question" = BACKGROUND STORY CONTEXT. Use this to understand the mood and weight, but DO NOT use it as an action list.

STRICT VISUAL BOUNDARY & SILENT OMISSION (CRITICAL):
- NEVER hallucinate or add characters, actions, or elements from the "question" if they are NOT explicitly present in the "imageDescription".
- SILENT OMISSION: If a character is in the PlanVid or Question but NOT in the imageDescription, you must SILENTLY ignore them.
- DO NOT write their names. DO NOT write their descriptions. DO NOT explicitly state they are "not present." If you mention their name anywhere in the prompt, the video model will hallucinate them into the shot.
- THIS INCLUDES DIALOGUE: A character CANNOT speak if they are not physically named in the "imageDescription".

CHARACTERS AND CONTINUITY:
- Video models require visual grounding to maintain identity.
- For characters that ARE explicitly in the imageDescription, you MUST include their exact visual descriptions from the PlanVid characters array inside BOTH the ACTION / MOTION TIMING section AND the DIALOGUE section.

CRITICAL RULE 1: ONE SINGLE CONTINUOUS ACTION (NO CHOREOGRAPHY)
- Focus exclusively on ONE single, continuous physical movement to maintain physics (e.g., "walking forward steadily", "continuously waving").
- Do NOT write chronological sequences.

CRITICAL RULE 2: SIMPLE CAMERA MOVEMENT
- Restrict to ONE simple, slow camera move.

STRICT RULES:
- Output exactly these sections, in this order:
  CAMERA / FRAMING:
  ACTION / MOTION TIMING:

SECTION CONTENT GUIDANCE:
CAMERA / FRAMING:
- Describe the technical move in 1 concise sentence.

ACTION / MOTION TIMING:
- Describe the physics, continuous character actions, and environment motion present ONLY in the imageDescription.
- You MUST explicitly write the specific NAMES of any focal characters on screen, alongside their visual descriptions. If they are not named in the imageDescription, do not invent names.
`.trim();

  const userPrompt = `
PlanVid (ground truth):
${safeStringify(PlanVid)}

Story Context ("question"):
${question}

Visual Base Frame (Ground Truth):
${imageDescription}

Target Duration: ${duration} seconds.

Create ONE single-shot i2v animation prompt.
CRITICAL: Restrict the motion to ONE continuous action. DO NOT mention characters that are not in the Base Frame.
  `.trim();

  const enforceVoiceFormat = (input: string): string => {
    const header = "DIALOGUE:";
    const nextHeader = "RENDER SETTINGS:";

    const startIdx = input.indexOf(header);
    if (startIdx === -1) return input;

    const endIdx =
      input.indexOf(nextHeader, startIdx + header.length) !== -1
        ? input.indexOf(nextHeader, startIdx + header.length)
        : input.length;

    const before = input.slice(0, startIdx + header.length);
    const section = input.slice(startIdx + header.length, endIdx);
    const after = input.slice(endIdx);

    const lines = section.split("\n");
    const processed: string[] = [];
    let prevWasDialog = false;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const nameTone = m[1].trim();
        const rest = m[2].trim();
        const newRest = /^\s*says\b/i.test(rest) ? rest : `says ${rest}`;

        if (prevWasDialog) processed.push("");
        processed.push(`\t${nameTone}: ${newRest}`);
        prevWasDialog = true;
      } else {
        processed.push(`\t${line}`);
        prevWasDialog = false;
      }
    }

    return before + "\n" + processed.join("\n") + "\n\n" + after;
  };

  const formatForReadability = (input: string) => {
    let t = input.trim();

    // Manual string slicing to guarantee clean breaks
    const camH = "CAMERA / FRAMING:";
    const actH = "ACTION / MOTION TIMING:";

    const camIdx = t.indexOf(camH);
    const actIdx = t.indexOf(actH);

    if (camIdx !== -1 && actIdx !== -1) {
      const camContent = t.slice(camIdx + camH.length, actIdx).trim();
      const rest = t.slice(actIdx);
      t = `${camH}\n\t${camContent}\n\n${rest}`;
    }

    // Apply regex replacer for the remaining headers
    const headers = [
      "ACTION / MOTION TIMING:",
      "DIALOGUE:",
      "RENDER SETTINGS:",
    ];

    headers.forEach((h) => {
      const re = new RegExp(`\\s*${h}`, "i");
      t = t.replace(re, `\n\n${h}\n\t`);
    });

    t = enforceVoiceFormat(t);

    t = t.replace(/RENDER SETTINGS:[\s\S]*$/i, "RENDER SETTINGS:\n\tNo Music");

    return t.trim();
  };

  try {
    // Step 1: Visual Sequence
    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];
    const raw = await generateGPT4oPrompt5B(messages);
    const text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();

    // Step 2: Dialogue Pass
    const dialogueSystemPrompt = `
You are an expert ADR Dialogue writer for a video scene.
You have ONE JOB: Write dialogue for the characters present in the locked visual scene.

LOCKED VISUAL SCENE:
${text}

SCENE CONTEXT (Base Frame Description):
${imageDescription}

VIDEO DURATION LIMIT: ${duration} seconds.

STRICT RULES:
1. MAXIMUM 1 OR 2 CHARACTERS CAN SPEAK. Pick only the primary focal character(s). Do not write dialogue for everyone.
2. STRICT WORD COUNT: The video is only ${duration} seconds long. The TOTAL combined dialogue for the entire scene MUST NOT EXCEED ${Math.max(
      1,
      Math.floor(Number(duration || 5) * 2.5)
    )} words!
3. STRICT NAMING CHECK: You can ONLY write dialogue for a character if their EXACT SPECIFIC NAME (e.g. "Anakin Skywalker") is explicitly printed in the text of the LOCKED VISUAL SCENE.
4. DO NOT INVENT OR CHANGE NAMES. If a character is named with a special character like "@Relo", you MUST use exactly "@Relo" in the dialogue block. Do NOT invent a generic name.
5. Format: <EXACT NAME + visual descriptions> (tone): says "short line"
6. If no dialogue makes sense, strictly output: "No dialogue."
    `.trim();

    const dialogueMessages = [
      { role: "system", content: dialogueSystemPrompt },
      { role: "user", content: "Generate the DIALOGUE section now." },
    ];
    const rawDialog = await generateGPT4oPrompt5B(dialogueMessages);
    let textDialog = (Array.isArray(rawDialog)
      ? rawDialog.join("")
      : String(rawDialog)
    ).trim();
    if (textDialog.startsWith("DIALOGUE:")) {
      textDialog = textDialog.replace("DIALOGUE:", "").trim();
    }

    // Combine
    const combinedText = `${text}\n\nDIALOGUE:\n${textDialog}\n\nRENDER SETTINGS:\n\tNo music`;
    const storyPrompt = formatForReadability(combinedText);

    return res.send({
      message: "Done",
      storyPrompt,
    });
  } catch (e: any) {
    console.error("GptVideoVisualSora error:", e.message);
    return res.status(500).send({ message: "Error in accessing AI API" });
  }
};

export const GptVideoVisual = async (
  req: Request,
  res: Response
): Promise<any> => {
  // Incoming: question (scene narration seed), imageDescription (movement/visual seed), PlanVid (advanced plan)
  const {
    question,
    imageDescription,
    PlanVid,
    duration,
    targetModel,
    imageUrl,
    suppressDialogue,
  } = req.body as {
    question: string;
    imageDescription: string;
    PlanVid: any;
    duration: any;
    targetModel?: string;
    imageUrl?: string;
    suppressDialogue?: boolean;
  };

  if (!question || !imageDescription || !PlanVid) {
    return res.status(400).send({
      message: "Body must contain { question, imageDescription, PlanVid }",
    });
  }

  // Helper: stringify safely without crashing on circular refs EditGeneratedVisualTextOnly
  const safeStringify = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return JSON.stringify(obj);
    }
  };

  // --- SYSTEM PROMPT ---
  const systemPrompt = `
You are an expert motion director for WAN 2.5 i2v (image-to-video with native audio).
You are animating an EXISTING base frame.

Interpret the inputs like this:
- PlanVid = canonical world rules.
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH. It dictates exactly who and what is on screen for this specific shot.
- "question" = BACKGROUND STORY CONTEXT. Use this to understand the mood and intent, but DO NOT use it as an action list.

STRICT VISUAL BOUNDARY & SILENT OMISSION (CRITICAL):
- NEVER hallucinate or add characters, actions, or elements from the "question" if they are NOT explicitly present in the "imageDescription".
- SILENT OMISSION: If a character is in the PlanVid or Question but NOT in the imageDescription, you must SILENTLY ignore them.
- DO NOT write their names. DO NOT write their descriptions. DO NOT explicitly state they are "not present."
- THIS INCLUDES DIALOGUE: A character CANNOT speak if they are not physically named in the "imageDescription".

CHARACTERS AND CONTINUITY:
- Video models require visual grounding to maintain identity.
- For characters explicitly in the imageDescription, you MUST include their exact visual descriptions from the PlanVid characters array inside the motion blocks.

${
  suppressDialogue
    ? `STORY MODE DIALOGUE SUPPRESSION:
- Do NOT generate spoken dialogue.
- If a VOICE & DIALOG section appears, it must say exactly: No dialogue.`
    : ""
}

// Temporary: Auto Prompt uses the generic CAMERA / MOTION structure for every model.
${getModelDirective(targetModel, duration, true, req.body.ratioKey, false)}
`.trim();

  const userPrompt = `
PlanVid (ground truth):
${safeStringify(PlanVid)}

Story Context ("question"):
${question}

Image description (current base frame on screen):
${imageDescription}

Target Duration: ${duration} seconds.

Create the SINGLE production prompt now.
CRITICAL: DO NOT mention characters that are not in the Base Frame.
  `.trim();

  console.log(
    "================================================================================"
  );
  console.log("=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisual START ===");
  console.log("  [INPUTS RECEIVED]");
  console.log("  targetModel :", targetModel);
  console.log("  duration    :", duration);
  console.log("  question    :", question);
  console.log("  imageDescription :", imageDescription);
  console.log("  PlanVid Object  :", safeStringify(PlanVid));
  console.log("  ratioKey    :", req.body.ratioKey);
  console.log("  [PROMPTS TO LLM]");
  console.log("  systemPrompt:\n", systemPrompt);
  console.log("  userPrompt:\n", userPrompt);
  console.log(
    "================================================================================"
  );

  // ----- Helpers -----

  const enforceVoiceFormat = (input: string): string => {
    const header = "VOICE & DIALOG:";
    const nextHeader = "CONSTRAINTS:";

    const startIdx = input.indexOf(header);
    if (startIdx === -1) return input;

    const endIdx =
      input.indexOf(nextHeader, startIdx + header.length) !== -1
        ? input.indexOf(nextHeader, startIdx + header.length)
        : input.length;

    const before = input.slice(0, startIdx + header.length);
    const section = input.slice(startIdx + header.length, endIdx);
    const after = input.slice(endIdx);

    const lines = section.split("\n");
    const processed: string[] = [];
    let prevWasDialog = false;

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      // The new permissive regex to catch 50+ word visual descriptions
      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const nameTone = m[1].trim();
        const rest = m[2].trim();
        const newRest = /^\s*says\b/i.test(rest) ? rest : `says ${rest}`;

        if (prevWasDialog) processed.push("");
        processed.push(`\t${nameTone}: ${newRest}`);
        prevWasDialog = true;
      } else {
        processed.push(`\t${line}`);
        prevWasDialog = false;
      }
    }

    return before + "\n" + processed.join("\n") + "\n\n" + after;
  };

  const formatCompact = (input: string) => {
    let t = input.trim();
    t = t.replace(/OUTPUT:[\s\S]*$/i, "").trim();

    // 1. Force spacing for inline headers that get smushed to punctuation (e.g. "field.SHOT 1:" or "bokeh.  ACTION:")
    const smushRegex = /([^\n])\s*(CAMERA:|MOTION:|ACTION \/ MOTION:|ENVIRONMENT DEPTH:|LIGHTING \/ STYLE:|VOICE & DIALOG:|CONSTRAINTS:|HEADER:|SHOT [a-zA-Z0-9\-\.\s\(\)\:]+:)/gi;
    t = t.replace(smushRegex, "$1\n\n$2");

    // 2. Dynamically space ALL headers (Added \. for decimal timestamps like 0:02.5)
    const dynamicHeaderRegex = /(?:^|\n)\s*([A-Z0-9][A-Z0-9 \/&'()\-\.\:]+:)/g;
    t = t.replace(dynamicHeaderRegex, (_match, p1) => {
      return `\n\n${p1.trim()}\n\t`;
    });

    // Enforce dialog "says " format and permissive regex
    t = enforceVoiceFormat(t);

    // Hard bottom-anchor guardrail
    t = t.replace(
      /\n\nCONSTRAINTS:[\s\S]*$/i,
      "\n\nCONSTRAINTS:\n\tMusic: none"
    );

    // Clean up excessive newlines
    t = t.replace(/\n{3,}/g, "\n\n").trim();

    return t;
  };

  const stripGeneratedVoiceAndConstraints = (input: string) =>
    input
      .replace(/\n*VOICE & DIALOG:[\s\S]*?(?=\n\nCONSTRAINTS:|$)/i, "")
      .replace(/\n*CONSTRAINTS:[\s\S]*$/i, "")
      .trim();

  try {
    // Step 1: Visual Sequence
    let userPromptObj: any = userPrompt;
    if (typeof imageUrl !== "undefined" && imageUrl) {
      userPromptObj = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ];
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptObj },
    ];
    const raw = await generateGPT4oPrompt5B(messages);
    const text = (Array.isArray(raw) ? raw.join("") : String(raw)).trim();

    if (suppressDialogue) {
      const combinedText = `${stripGeneratedVoiceAndConstraints(
        text
      )}\n\nVOICE & DIALOG:\n\tNo dialogue.\n\nCONSTRAINTS:\n\tMusic: none`;
      const storyPrompt = formatCompact(combinedText);

      console.log(
        "================================================================================"
      );
      console.log(
        "=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisual DIALOGUE SUPPRESSED ==="
      );
      console.log("  raw visual output:", raw);
      console.log("  storyPrompt:\n", storyPrompt);
      console.log("=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisual END ===");
      console.log(
        "================================================================================"
      );

      return res.send({
        message: "Done",
        storyPrompt,
      });
    }

    // Step 2: Dialogue Pass
    const dialogueSystemPrompt = `
You are an expert ADR Dialogue writer for a video scene.
You have ONE JOB: Write dialogue for the characters present in the locked visual scene.

LOCKED VISUAL SCENE:
${text}

SCENE CONTEXT (Base Frame Description):
${imageDescription}

VIDEO DURATION LIMIT: ${duration} seconds.

STRICT RULES:
1. MAXIMUM 1 OR 2 CHARACTERS CAN SPEAK. Pick only the primary focal character(s). Do not write dialogue for everyone.
2. STRICT WORD COUNT: The video is only ${duration} seconds long. The TOTAL combined dialogue for the entire scene MUST NOT EXCEED ${Math.max(
      1,
      Math.floor(Number(duration || 5) * 2.5)
    )} words!
3. STRICT NAMING CHECK: You can ONLY write dialogue for a character if their EXACT SPECIFIC NAME (e.g. "Anakin Skywalker") is explicitly printed in the text of the LOCKED VISUAL SCENE.
4. DO NOT INVENT OR CHANGE NAMES. If a character is named with a special character like "@Relo", you MUST use exactly "@Relo" in the dialogue block. Do NOT invent a generic name.
5. Format: <EXACT NAME + visual descriptions> (tone): says "short line"
6. If no dialogue makes sense, strictly output: "No dialogue."
    `.trim();

    console.log(
      "================================================================================"
    );
    console.log(
      "=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisual STEP 1 VISUAL RESULT ==="
    );
    console.log("  raw visual output:", raw);
    console.log("  text (visual prompt):\n", text);
    console.log("  [DIALOGUE PROMPTS TO LLM]");
    console.log("  dialogueSystemPrompt:\n", dialogueSystemPrompt);
    console.log(
      "================================================================================"
    );

    const dialogueMessages = [
      { role: "system", content: dialogueSystemPrompt },
      { role: "user", content: "Generate the VOICE & DIALOG section now." },
    ];
    const rawDialog = await generateGPT4oPrompt5B(dialogueMessages);
    let textDialog = (Array.isArray(rawDialog)
      ? rawDialog.join("")
      : String(rawDialog)
    ).trim();
    if (textDialog.startsWith("VOICE & DIALOG:")) {
      textDialog = textDialog.replace("VOICE & DIALOG:", "").trim();
    }

    // Combine
    const combinedText = `${text}\n\nVOICE & DIALOG:\n${textDialog}\n\nCONSTRAINTS:\n\tMusic: none`;
    const storyPrompt = formatCompact(combinedText);

    console.log(
      "================================================================================"
    );
    console.log(
      "=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisual STEP 2 DIALOGUE RESULT ==="
    );
    console.log("  rawDialog output:", rawDialog);
    console.log("  textDialog:\n", textDialog);
    console.log("  [FINAL COMBINED RESULT]");
    console.log("  storyPrompt:\n", storyPrompt);
    console.log("=== SERVER-SIDE AUTO PROMPT LOG: GptVideoVisual END ===");
    console.log(
      "================================================================================"
    );

    return res.send({
      message: "Done",
      storyPrompt,
    });
  } catch (e: any) {
    console.error("GptVideoVisual error:", e.message);
    return res.status(500).send({ message: "Error in accessing AI API" });
  }
};
/* ---------- Type helpers ---------- */

interface ArtStyle {
  style_token: string | null;
  color_palette: string[] | null;
}

interface Character {
  id: string; // "char1", "char2", ...
  name: string | null; // proper noun if any, else null
  description: string; // visual description incl. skin / hair / obvious traits
  style_token: string | null;
}

interface GptPlanResult {
  art_style: ArtStyle;
  characters: Character[];
}

/* ---------------- Allowed art styles ---------------- */
/* ---------------- Allowed art styles ---------------- */
const artStyles: string[] = [""];

export const GptVideoPlan = async (
  req: Request,
  res: Response
): Promise<any> => {
  /* ---------------- Parse incoming ---------------- */
  // Accepts: planImg (existing image plan object), steps (array for context)
  const { planImg, steps } = req.body as { planImg: any; steps: any };

  if (!planImg || !Array.isArray(steps)) {
    return res
      .status(400)
      .send({ message: "Body must contain { planImg, steps[] }" });
  }

  // We are REMOVING art_style, aspect_ratio, and resolution.
  // Enforce fps=30 always.
  const FIXED_FPS = 30;

  /* ---------------- System prompt (STRICT JSON) ---------------- */
  const systemPrompt = `
You are a precise planning AI for WAN 2.5 video generation with native audio.
Use the provided image plan ${planImg} and ${steps} array only as context.
Return ONLY valid JSON, no markdown, no extra text.
The JSON MUST match this schema exactly (no extra keys, keep key order and key spelling):

{
  "characters": [
    {
      "id": string,                 // "char1" â€¦ "char8"
      "name": string | null,        // proper noun or null (if none provided)
      "description": string,        // ONLY visible traits: age, skin-tone, hair color/length/style, eye color, attire/materials, notable props; NO actions/powers/history
      "voice_profile": {            // Descriptive voice blueprint for consistency across generations
        "gender": "male" | "female" | "androgynous" | "unknown",
        "age_range": "child" | "teen" | "young_adult" | "adult" | "senior" | "creature",
        "timbre_description": string,      // e.g. "breathy and bright", "deep and gravelly"
        "accent_description": string,      // e.g. "soft British RP", "light West African lilt", "none"
        "pace_description": string,        // e.g. "measured and unhurried"
        "tone_baseline": string,           // e.g. "warm and friendly", "stoic and calm"
        "pitch_hint": "low" | "mid" | "high",
        "consistency_tags": [string]       // short reusable tags (e.g. ["confident", "gentle sibilants"])
      }
    }
    // 1â€“8 entries; pick only visually important entities; do NOT invent extras
  ],
  "visual_scene": {
    "setting": string,              // concise: place, time of day/season
    "lighting": string,             // e.g. "dusk blue hour, soft rim light"
    "palette": string,              // e.g. "icy blues, silver highlights"
    "style_notes": string           // extra visual cues (materials, texture, mood) without actions
  },
  "camera": {
    "shot_type": string,            // e.g. "medium two-shot", "wide establishing"
    "angle": string,                // e.g. "ground level", "low-angle", "overhead"
    "lens_style": string | null,    // e.g. "35mm, shallow DOF", or null
    "movement": string,             // explicit, smooth verbs: pan/dolly/orbit/track/tilt; use "smooth"/"steady" if desired
    "cut_style": "one_take" | "minimal_cuts" | "standard",
    "duration_seconds": number      // target clip length in seconds (5â€“10 typical)
  },
  "audio": {
    "ambience": [string],           // e.g. ["soft wind", "distant city hum"]
    "sfx": [string],                // e.g. ["wing flaps whoosh", "snow crunch"]
    "music": {
      "use_music": false,           // ALWAYS false (no music)
      "description": null,          // ALWAYS null when no music
      "intensity": "none"           // ALWAYS "none"
    },
    "mix": {
      "voice_priority": "high" | "medium" | "low",
      "duck_ambience_under_dialogue": boolean,
      "duck_music_under_dialogue": boolean,
      "no_clipping": boolean
    }
  },
  "dialogue": [
    {
      "character_id": string,               // must match a "characters[i].id"
      "delivery_description": string,        // e.g. "excited, breathless", "calm whisper"
      "intended_content_description": string,// describe what they say/mean; DO NOT provide verbatim lines
      "timecode_hint_sec": number            // approximate start time (0-based)
    }
    // 0â€“8 entries; if no spoken intent, return an empty array
  ],
  "constraints": {
    "negative_visual": [string],   // e.g. ["no extra people", "no text overlays", "no shaky cam"]
    "negative_audio": [string],    // e.g. [ "no echo", "no random chatter"]
    "consistency": [string]        // e.g. ["character appearance remains consistent", "no sudden scene cuts"]
  },
  "output": {
    "fps": ${FIXED_FPS},           // ALWAYS 30
    "duration_seconds": number     // must align with camera.duration_seconds
  }
}

Rules:
1) REMOVE any notion of art style, aspect ratio, or resolution â€” do not include those keys.
2) fps MUST be exactly ${FIXED_FPS} in "output".
3) Ground characters/visuals in planImg and steps; do NOT invent entities beyond what is visually important.
4) If a proper name exists in planImg/steps (e.g., "Luna the cat"), use it verbatim in "name".
5) Describe ONLY what is visible in character "description" (no actions/history/powers).
6) Provide detailed DESCRIPTIONS for ambience, SFX, and voice; DO NOT include music (music.use_music=false, description=null, intensity="none").
7) Dialogue MUST be descriptive intent only (use "intended_content_description"), not verbatim lines.
8) Prefer smooth, steady camera motions.
9) Return ONLY valid JSON, no markdown, no extra text.
`.trim();

  /* ---------------- User prompt ---------------- */
  const userPrompt = `
Image Plan (context):
${JSON.stringify(planImg, null, 2)}

Steps (context array):
${JSON.stringify(steps, null, 2)}

Create the JSON video plan now, following the schema exactly.
  `.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ---------------- Helpers ---------------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}$/);
    return m ? m[0] : null;
  };

  /* ---------------- Retry loop ---------------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let planJson: string | null = null;

  while (attempt < MAX_RETRIES && !planJson) {
    try {
      const raw = await generateGPT4oPrompt5B(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(text)) {
        planJson = text;
      } else {
        const extracted = extractJSON(text);
        if (extracted && isValidJSON(extracted)) planJson = extracted;
      }
    } catch (e: any) {
      console.error("GptVideoPlan error:", e.message);
    }
    attempt += planJson ? 0 : 1;
  }

  if (!planJson) {
    return res
      .status(500)
      .send({ message: "GptVideoPlan: failed to obtain valid JSON" });
  }

  /* ---------------- Success ---------------- */
  const plan = JSON.parse(planJson);

  // Safety: hard-enforce the no-music rule even if the model slips. Kontext
  if (plan?.audio?.music) {
    plan.audio.music = {
      use_music: false,
      description: null,
      intensity: "none",
    };
  }

  return res.send({ message: "Video plan created", plan });
};

export const GptPlan = async (req: Request, res: Response): Promise<any> => {
  /* ---------------- Parse incoming ---------------- */
  const { pp, x } = req.body as { pp: string; x: any };

  if (!pp || !Array.isArray(x)) {
    return res.status(400).send({ message: "Body must contain { pp, x[] }" });
  }

  const systemPrompt = `
You are a precise planning AI.
Return ONLY valid JSON, no markdown, no extra text.
The JSON MUST match this schema exactly:

{
  "art_style": {
    "style_token": string,        // REQUIRED, never null. e.g. "Pixar"

  },
  "characters": [
    {
      "id": string,               // "char1" â€¦ "char3"
      "name": string | null,      // proper noun or null
      "description": string,      // ONLY visual traits: age, skin-tone, hair colour/length/style, eye colour, color, texture etc
      "style_token": string | null
    }
    // 1â€“8 total entries
  ]
}

Rules:
1. A character may be a human, animal, or object, but NOT a place.
2. Choose up to eight **visually important** entities mentioned in the key-points (one mention is enough).
3. If fewer than eight exist, return the ones you find; do NOT invent extra.
 4. Always set "art_style.style_token" Up to ONE OR NINE of the following allowed tokens,scenes can have multiple art styles or 1 if specified by user : ${artStyles.join(
   ", "
 )}. Pick either 1 or more styles Token that best matches the overall tone of the prompt. Do **NOT** invent new styles.
5. Describe **only what can be seen** (hair, eyes, age, attire, materials). No actions, no history, no powers.
6. If a human, animal, or object has a proper name mentioned in the input (e.g., "Luna the cat", "Professor Oak"), use that exact name in the "name" field. Do not replace it with a generic label.
7. Return ONLY valid JSON, no markdown, no extra text.
`.trim();

  const userPrompt = `
Prompt:
"${pp}"

Key-points:
${JSON.stringify(x, null, 2)}

Create the JSON plan now.
  `.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ---------------- Helpers ---------------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}$/);
    return m ? m[0] : null;
  };

  /* ---------------- Retry loop ---------------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let planJson: string | null = null;

  while (attempt < MAX_RETRIES && !planJson) {
    try {
      const raw = await generateGPT4oPromptProWebT(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(text)) {
        planJson = text;
      } else {
        const extracted = extractJSON(text);
        if (extracted && isValidJSON(extracted)) planJson = extracted;
      }
    } catch (e: any) {
      console.error("GPT-4o error:", e.message);
    }
    attempt += planJson ? 0 : 1;
  }

  if (!planJson) {
    return res
      .status(500)
      .send({ message: "GptPlan: failed to obtain valid JSON" });
  }

  /* ---------------- Success ---------------- */
  const plan: GptPlanResult = JSON.parse(planJson);
  return res.send({ message: "Plan created", plan });
};

export const examplestory = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {} = req.body; // userâ€™s prompt text
  // 1. Your expanded categories array stays the same
  // 1. Define your categories
  const categories = [
    "a short action-packed adventure story",

    "an offbeat comedy sketch",
    "explanation of any historic moment",

    "a dystopian political drama",

    "a whimsical fairy-tale adventure",

    "a superhero origin story for kids",
    "a friendly monsterâ€™s first day at school",
    "a curious science experiment tale",
  ];

  // 2. Pick one category at random
  const randomCategory =
    categories[Math.floor(Math.random() * categories.length)];

  // 3. Build a function to generate a userPrompt for N topics
  function makeStorySeedPrompt(category: any, count = 3) {
    return `
Generate ${count} concise, engaging prompts (titles, questions or story-ideas) for ${category}.
â€¢ Keep each under 10 words
â€¢ Make each one vivid and evocative
`.trim();
  }

  // 4. Ask for 5 ideas this time
  const userPrompt = makeStorySeedPrompt(randomCategory, 5);

  console.log(userPrompt);

  // Example:
  console.log(userPrompt);
  // â†’ "Please suggest a concise, engaging title or question prompt for a cyberpunk heist. Keep it under 10 words and make it evocative."

  const initialMessages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userPrompt },
  ];

  /* -------- JSON helpers -------- */
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };
  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  };

  /* -------- Retry loop -------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let responseData: string | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const raw = await generateGPT4oPrompt(initialMessages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(txt)) {
        responseData = txt;
        break;
      }

      const extracted = extractJSON(txt);
      if (extracted && isValidJSON(extracted)) {
        responseData = extracted;
        break;
      }

      attempt++;
      console.warn(`Attempt ${attempt} returned invalid JSON. Retryingâ€¦`);
    } catch (err: any) {
      console.error("GPT API error:", err.message);
      return res
        .status(500)
        .send({ message: "Error in accessing ChatGPT API" });
    }
  }

  if (!responseData) {
    return res
      .status(500)
      .send({ message: "Failed to get valid JSON from ChatGPT API" });
  }

  return res.send({
    message: "Done",
    initialSteps: JSON.parse(responseData),
  });
};

// ---------- GptYouTubeMeta.ts (revised) ----------

type YouTubeMeta = {
  title: string;
  tags: string[];
  description: string;
};

export const GptYouTubeMeta = async (
  req: Request,
  res: Response
): Promise<any> => {
  /* ------------ Parse incoming ------------ */
  const { idea } = req.body as { idea: string };
  if (!idea || typeof idea !== "string") {
    return res.status(400).send({ message: "Body must contain { idea }" });
  }

  /* ------------ Prompts ------------ */
  const systemPrompt = `
You are an expert YouTube SEO assistant.

Return **ONLY valid JSON** (no markdown, no commentary) matching:

{
  "title": string,        // â‰¤60 characters, capitalise main words
  "tags": string[],       // 3â€“15 tags, 2â€“3 words each, lower-case
  "description": string   // â‰¥200 words, persuasive, keyword-rich
}

â€” Title rules â€”
â€¢ Front-load the primary keyword taken from the idea text.
â€¢ Length â‰¤60 chars so it displays fully.
â€¢ Use digits when helpful (e.g. â€œ5 Tipsâ€).
â€¢ Include one emotive/power words if relevant
â€¢ No misleading clickbait.

â€” Tag rules â€”
â€¢ First tag = primary keyword.
â€¢ Mix broad & niche 2â€“3-word phrases.
â€¢ 3â€“15 total, all lower-case.
â€¢ No irrelevant or duplicate tags.

â€” Description rules â€”
â€¢ 200+ words. The first 2â€“3 sentences must contain the primary keyword.
â€¢ Natural repetition of the keyword 2â€“3Ã—, plus synonyms/related terms.
â€¢ Add a compelling hook above the fold, then detailed content.
â€¢ Include clear CTAs (â€œsubscribeâ€, â€œwatch nextâ€), links, bullet lists or timestamps as appropriate.
â€¢ End with up to three relevant hashtags.

Output strictly the JSON objectâ€”no markdown fences, no extra text.
`.trim();

  const userPrompt = `
Idea for video (written by user):
"${idea}"

Generate the JSON metadata now.
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ------------ Helpers ------------ */
  const isValidJSON = (str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string) => {
    const m = str.match(/\{[\s\S]*\}$/);
    return m ? m[0] : null;
  };

  /* ------------ Retry loop ------------ */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let metaJson: string | null = null;

  while (attempt < MAX_RETRIES && !metaJson) {
    try {
      const raw = await generateGPT4oPromptP(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);

      if (isValidJSON(text)) {
        metaJson = text;
      } else {
        const extracted = extractJSON(text);
        if (extracted && isValidJSON(extracted)) metaJson = extracted;
      }
    } catch (e: any) {
      console.error("GPT-4o error:", e.message);
    }
    attempt += metaJson ? 0 : 1;
  }

  if (!metaJson) {
    return res
      .status(500)
      .send({ message: "GptYouTubeMeta: failed to obtain valid JSON" });
  }

  /* ------------ Post-check & success ------------ */
  const meta: YouTubeMeta = JSON.parse(metaJson);

  // title â‰¤60 chars, description â‰¥200 words â€” soft guard rails
  if (meta.title.length > 60) meta.title = meta.title.slice(0, 60).trim();
  const wordCount = meta.description.split(/\s+/).length;
  if (wordCount < 200) {
    meta.description +=
      "\n\nFor more tips and resources, be sure to subscribe and explore the links above!";
  }

  return res.send({ message: "YouTube metadata created", meta });
};
// ---------- GptYouTubeDesign.ts ----------

// ---------- GptYouTubeDesign.ts ----------

const STYLE_WORDS = [
  "digital illustration",
  "digital painting",
  "vector art",
  "flat design",
  "3d render",
  "photo-realistic",
  "cinematic photograph",
  "concept art",
  "neon cyberpunk glitch art",
];

export const GptYouTubeDesign = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { title, imagelook } = req.body as { title: string; imagelook: string };

  if (!title || !imagelook) {
    return res
      .status(400)
      .send({ message: "Body must contain { title, imagelook }" });
  }

  /* ---------- System prompt ---------- */
  const systemPrompt = `
You are a senior prompt-engineer for AI image models (DALLÂ·E 3, SDXL).

Return ONE plain-text line (â‰¤350 chars).
That line is the final generation prompt.

Prompt rules
1. 16:9 composition (1280Ã—720) for a YouTube thumbnail.
2. Describe the main subject & action from ${imagelook} first.
3. Seamlessly weave any distinctive keywords or universe names found in the video *title* into the scene description.
4. **Include ONE art-style phrase** chosen from this list:
   ${STYLE_WORDS.join(" â€¢ ")}
   â€¢ Keep the userâ€™s style if they gave one; otherwise choose the best match.
5. Put that style phrase right after the subject, before mood / lighting words.
6. Bright, high-contrast colours; dynamic angle or expression.


`.trim();

  const userPrompt = `
Video title (context only):
"${title}"

Desired look & feel:
"${imagelook}"

Create the prompt now.
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ---------- Retry loop ---------- */
  const MAX_RETRIES = 3;
  let attempt = 0;
  let promptStr: string | null = null;

  while (attempt < MAX_RETRIES && !promptStr) {
    try {
      const raw = await generateGPT4oPrompt(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);
      const line = text.trim();
      if (line.length) promptStr = line;
    } catch (e: any) {
      console.error("GPT-4o error:", e.message);
    }
    attempt += promptStr ? 0 : 1;
  }

  if (!promptStr) {
    return res
      .status(500)
      .send({ message: "GptYouTubeDesign: failed to obtain prompt" });
  }

  /* ---------- Soft length guard ---------- */
  if (promptStr.length > 350) {
    promptStr = promptStr.slice(0, 347).trim() + "â€¦";
  }

  console.log("Final prompt âžœ", promptStr);
  return res.send({ message: "Thumbnail prompt created", prompt: promptStr });
};

/*------------------------------------------------------------------
  Flux Kontext-friendly â€œfeature verbsâ€ â€” keep it short so GPT can
  weave 1-2 of them into its single-line instruction.
-------------------------------------------------------------------*/

/*------------------------------------------------------------------
  POST /api/gpt-kontext-thumbnail
  Body: { title: string, imagelook: string }
-------------------------------------------------------------------*/
export const GptYou = async function (
  req: Request,
  res: Response
): Promise<any> {
  const { title, imagelook } = req.body as {
    title: string;
    imagelook: string;
  };

  /* ---------- basic validation ------------------------------- */
  if (!title || !imagelook) {
    return res
      .status(400)
      .json({ message: "Body must contain { title, imagelook }" });
  }

  /* ---------- system prompt ---------------------------------- */
  const systemPrompt = `
You are a senior prompt-engineer for the **Flux Kontext** image-editing model.

Output ONE single-line instruction (â‰¤300 chars) that tells Kontext *how to edit*
the user's screenshot for a YouTube thumbnail (1280Ã—720, 16:9).


Editing-prompt rules:
1. Begin with the MAIN ACTION the edit should achieve.
2. Keep it imperative, vivid, and under 300 chars.

`.trim();

  /* ---------- user prompt ------------------------------------ */
  const userPrompt = `
Base screenshot style / elements:
"${imagelook}"

Video title context:
"${title}"

Compose the Kontext edit instruction now.
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ---------- GPT-4o with retry ------------------------------ */
  const MAX_RETRIES = 3;
  let finalPrompt: string | null = null;
  let attempts = 0;

  while (attempts < MAX_RETRIES && !finalPrompt) {
    try {
      const raw = await generateGPT4oPrompt(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);
      const line = text.trim().replace(/\n+/g, " ");
      if (line.length) finalPrompt = line.slice(0, 300);
    } catch (err: any) {
      console.error("GPT-4o error:", err.message);
    }
    attempts += finalPrompt ? 0 : 1;
  }

  if (!finalPrompt) {
    return res
      .status(500)
      .json({ message: "Failed to generate Flux Kontext prompt" });
  }

  console.log("Kontext edit prompt âžœ", finalPrompt);
  return res.json({ prompt: finalPrompt });
};

export const GptTagger = async function (
  req: Request,
  res: Response
): Promise<any> {
  const { caption } = req.body as { caption: string };

  /* ---------- basic validation ------------------------------- */
  if (!caption) {
    return res.status(400).json({ message: "Body must contain { caption }" });
  }

  /* ---------- constants -------------------------------------- */
  const MAX_TAGS = 30;
  const MAX_CATEGORIES = 10;

  /* ---------- system prompt ---------------------------------- */
  const systemPrompt = `
You are an expert social-media taxonomist.

Return **one** JSON object with this shape:

{
  "tags":        [max ${MAX_TAGS} lowercase strings, single-word or short 2â€“3-word phrases],
  "categories":  [max ${MAX_CATEGORIES} single-word, Title-Case concepts]
}

Rules:
1. Tags are SEO / hashtag style â€“ descriptive but concise, no "#" symbols.
2. Categories are broad, one-word themes that conceptually group the caption
   (e.g. "Education", "Aviation", "Learning").
3. NEVER exceed the max lengths; NEVER output anything except the JSON object.
`.trim();

  /* ---------- user prompt  Design------------------------------------ */
  const userPrompt = `
Caption:
"${caption}"

Generate the JSON now.
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  /* ---------- GPT-4o with retry ------------------------------ */
  const MAX_RETRIES = 3;
  let rawJson: string | null = null;
  let attempts = 0;

  while (attempts < MAX_RETRIES && !rawJson) {
    try {
      const raw = await generateGPT4oPromptP(messages);
      const text = Array.isArray(raw) ? raw.join("") : String(raw);
      rawJson = text.trim();
    } catch (err: any) {
      console.error("GPT-4o error:", err.message);
    }
    attempts += rawJson ? 0 : 1;
  }

  if (!rawJson) {
    return res.status(500).json({ message: "Failed to classify caption" });
  }

  /* ---------- parse & sanity-check --------------------------- */
  let output: { tags: string[]; categories: string[] };
  try {
    output = JSON.parse(rawJson);
    // enforce limits just in case
    output.tags = (output.tags || []).slice(0, MAX_TAGS);
    output.categories = (output.categories || []).slice(0, MAX_CATEGORIES);
  } catch (err) {
    console.error("JSON parse error:", err);
    return res.status(500).json({ message: "GPT returned invalid JSON" });
  }

  console.log("Tags/Categories âžœ", output);
  return res.json(output);
};

export const narrateSummary = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { keyPoints } = req.body as { keyPoints: string[] };

  if (!Array.isArray(keyPoints) || keyPoints.length === 0) {
    return res
      .status(400)
      .send({ message: "Body must contain { keyPoints: string[] }" });
  }

  // Helper: validate & extract JSON (same style as GptMeme)
  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string): string | null => {
    const m = str.match(/\{[\s\S]*\}/);
    return m ? m[0] : null;
  };

  // We send the whole story so the model understands global flow,
  // but ask it to return a narration for EACH scene in the same format.
  const storyJson = JSON.stringify({ keyPoints });

  const userPrompt = `
You are rewriting a STORY that is used for visuals into SPOKEN NARRATION ONLY.

You are given a JSON object:
{
  "keyPoints": [
    "Scene 1 text...",
    "Scene 2 text...",
    ...
  ]
}

Each item is a "world scene" for visuals. Read ALL scenes first so the story flows naturally.

Your job:
- For EACH scene, create a short, natural spoken narration line.
- Keep flow and mood consistent across the whole story, scene 1 should be first segment scene two 2nd segment of the narration narration(scene 1, scene2) === (intro, middle, outro).
- Remove purely visual description (camera angles, visual-only details) and keep what should be said aloud.
- Preserve important emotional beats, setup, and payoff.
- Max 32 words per scene for the actual dialogue.

To dynamically translate the scene descriptions into highly expressive, non-robotic audio using the Gemini 3.1 Flash TTS model, you must act as the Audio Director.

Output:
Return a JSON object in the SAME SHAPE as the input, but instead of strings, each item in the "keyPoints" array MUST be a strictly formatted JSON object with three keys: "voice", "prompt", and "text":

{
  "keyPoints": [
    {
      "voice": "VOICE_ID",
      "prompt": "AUDIO PROFILE: A youthful, adventurous tone. THE SCENE: A pitch-black, echoing cave. DIRECTOR'S NOTES: Delivery must start with high anxiety...",
      "text": "[uhm] Okay, okay, don't panic. [nervously] Where did it roll? [medium pause] [sigh] Great. Smashed to pieces."
    },
    ...
  ]
}

Rules for the JSON output objects:
1. "voice": Select an appropriate voice from the allowed list based on the character (e.g., "VOICE_A" for upbeat male, "VOICE_B" for firm female, "VOICE_C" for gravelly male, "VOICE_D" for bright female). Keep the voice consistent across scenes if it is the same narrator.
2. "prompt": Write the Director's Notes. Include the character's persona, the physical environment, and the overall emotional arc of the delivery. (e.g., "DIRECTOR'S NOTES: The speaker is out of breath, standing in a dark forest. Pacing should be erratic, shifting from panicked to relieved.")
3. "text": Write the dialogue. You MUST inject bracketed inline tags to create a dynamic, human-sounding performance.
   - Use non-speech tags naturally: [sigh], [laughing], [uhm].
   - Use pacing tags to break up the rhythm: [short pause], [medium pause], [long pause], [extremely fast].
   - Shift the emotion mid-sentence using descriptive tags: [whispering], [shouting], [sarcasm], [robotic], [excitedly], [nervously], [reluctantly].
   - Do not make the emotion static. Human speech fluctuates. An excited sentence might contain a [short pause] and a [laughing] tag, followed by a [whispering] realization.

Rules:
- The array length MUST MATCH the input "keyPoints" length.
- REPLY WITH JSON ONLY. NO extra commentary, no backticks.

Here is the input JSON:
${storyJson}
`.trim();

  const messages = [
    {
      role: "user" as const,
      content: userPrompt,
    },
  ];

  const MAX_RETRIES = 3;
  let attempt = 0;
  let responseData: string | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const raw = await generateGPT4oPromptP(messages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw).trim();

      if (isValidJSON(txt)) {
        responseData = txt;
        break;
      }

      const extracted = extractJSON(txt);
      if (extracted && isValidJSON(extracted)) {
        responseData = extracted;
        break;
      }

      attempt++;
      console.warn(
        `narrateSummary attempt ${attempt} returned invalid JSON. Retryingâ€¦`
      );
    } catch (e: any) {
      console.error("narrateSummary error:", e?.message);
      return res
        .status(500)
        .send({ message: "Error in accessing ChatGPT API" });
    }
  }

  if (!responseData) {
    return res.status(500).send({
      message: "Failed to get valid JSON from ChatGPT API in narrateSummary",
    });
  }

  // This will be: { keyPoints: [ "narration1", "narration2", ... ] }
  const narrationSteps = JSON.parse(responseData);

  return res.send({
    message: "Done",
    narrationSteps,
  });
};

const cleanBrainstormReply = (input: unknown): string => {
  let text = Array.isArray(input) ? input.join("\n") : String(input ?? "");
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^\s*[-\u2022]\s+/gm, "")
    .replace(/^\s*(?:top|middle|bottom|first|second|third|final)\s+panel\s*:\s*/gim, "")
    .replace(/^\s*panel\s*\d+\s*:\s*/gim, "")
    .replace(/^\s*(?:image|visual|text|caption)\s*:\s*/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

type BrainstormMemorySlot = {
  slotId: number;
  turnStart?: number;
  turnEnd?: number;
  title: string;
  fullSummary: string;
  rejectedIdeas?: string[];
  openQuestions?: string[];
  names?: string[];
  style?: string;
};

const normalizeBrainstormMemorySlots = (input: any): BrainstormMemorySlot[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((slot: any) => ({
      slotId: Number(slot.slotId),
      turnStart: Number(slot.turnStart || 0),
      turnEnd: Number(slot.turnEnd || 0),
      title: String(slot.title || "").trim(),
      fullSummary: String(slot.fullSummary || "").trim(),
      rejectedIdeas: Array.isArray(slot.rejectedIdeas) ? slot.rejectedIdeas.map(String).filter(Boolean) : [],
      openQuestions: Array.isArray(slot.openQuestions) ? slot.openQuestions.map(String).filter(Boolean) : [],
      names: Array.isArray(slot.names) ? slot.names.map(String).filter(Boolean) : [],
      style: String(slot.style || "").trim(),
    }))
    .filter((slot) => Number.isFinite(slot.slotId) && slot.title && slot.fullSummary)
    .slice(-50);
};

const BRAINSTORM_MEMORY_TOOL = {
  type: "function",
  function: {
    name: "getMemory",
    description: "Fetch full session memory pages by slot ID when the title index indicates older context is needed.",
    parameters: {
      type: "object",
      properties: {
        slotIds: {
          type: "array",
          items: { type: "number" },
          maxItems: 5,
          description: "Memory slot IDs to fetch. Use only IDs from the visible session memory index.",
        },
      },
      required: ["slotIds"],
      additionalProperties: false,
    },
  },
};

const renderMemoryToolResult = (slotIds: number[], slots: BrainstormMemorySlot[]): string => {
  const byId = new Map(slots.map((slot) => [slot.slotId, slot]));
  const picked = slotIds
    .map((id) => byId.get(Number(id)))
    .filter(Boolean)
    .slice(0, 5) as BrainstormMemorySlot[];

  if (!picked.length) {
    return "No matching memory slots were found for the requested IDs.";
  }

  return picked
    .map((slot) => {
      const lines = [
        `Memory slot ${slot.slotId}: ${slot.title}`,
        `Turns: ${slot.turnStart || "?"}-${slot.turnEnd || "?"}`,
        `Full summary: ${slot.fullSummary}`,
      ];
      if (slot.rejectedIdeas?.length) lines.push(`Rejected ideas: ${slot.rejectedIdeas.join("; ")}`);
      if (slot.openQuestions?.length) lines.push(`Open questions: ${slot.openQuestions.join("; ")}`);
      if (slot.names?.length) lines.push(`Names: ${slot.names.join("; ")}`);
      if (slot.style) lines.push(`Style: ${slot.style}`);
      return lines.join("\n");
    })
    .join("\n\n");
};

const generateBrainstormWithMemoryTools = async (
  messages: any[],
  memorySlotsInput: any
): Promise<string> => {
  const memorySlots = normalizeBrainstormMemorySlots(memorySlotsInput);
  if (!memorySlots.length) {
    return cleanBrainstormReply(await generateGPT4oPromptP(messages));
  }

  const first = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    tools: [BRAINSTORM_MEMORY_TOOL as any],
    tool_choice: "auto",
    max_completion_tokens: 3000,
    n: 1,
  });

  const firstMessage: any = first.choices?.[0]?.message;
  const toolCalls = Array.isArray(firstMessage?.tool_calls) ? firstMessage.tool_calls.slice(0, 3) : [];

  if (!toolCalls.length) {
    const content = firstMessage?.content || "";
    if (!content) throw new Error("Incomplete response from OpenAI");
    return content;
  }

  const toolMessages = toolCalls.map((call: any) => {
    let slotIds: number[] = [];
    try {
      const parsed = JSON.parse(call.function?.arguments || "{}");
      slotIds = Array.isArray(parsed.slotIds) ? parsed.slotIds.map(Number).filter(Number.isFinite).slice(0, 5) : [];
    } catch {
      slotIds = [];
    }

    return {
      role: "tool",
      tool_call_id: call.id,
      content: renderMemoryToolResult(slotIds, memorySlots),
    };
  });

  const second = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [...messages, firstMessage, ...toolMessages] as any,
    max_completion_tokens: 3000,
    n: 1,
  });

  const content = second.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("Incomplete response from OpenAI after memory tool call");
  return content;
};
const getLatestBrainstormUserMessage = (messages: any): string => {
  if (!Array.isArray(messages)) return "";

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (String(message?.role || "").toLowerCase() === "user") {
      const content = String(message?.content || "").trim();
      if (content) return content;
    }
  }

  return "";
};

const renderRecentBrainstormConversationForRag = (messages: any): string => {
  if (!Array.isArray(messages)) return "";

  return messages
    .slice(-8)
    .map((message: any) => {
      const role = String(message?.role || "user").toLowerCase();
      const content = String(message?.content || "").trim();
      if (!content) return "";
      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(-2400);
};

const resolveBrainstormRagSystemContext = async (messages: any, source: string): Promise<string> => {
  const query = getLatestBrainstormUserMessage(messages);
  const ragContext = await buildBrainstormRagSystemContext({
    query,
    recentContext: renderRecentBrainstormConversationForRag(messages),
  });

  console.log(
    `[${source}] RAG memory status:`,
    ragContext.status,
    "matches:",
    ragContext.matches.length,
    ragContext.reason ? `reason: ${ragContext.reason}` : ""
  );

  return ragContext.contextBlock;
};
const renderBrainstormUserSnapshot = (userSnapshot: any): string => {
  if (!userSnapshot || typeof userSnapshot !== "object") return "";

  try {
    const json = JSON.stringify(userSnapshot, null, 2);
    const cappedJson = json.length > 6000 ? `${json.slice(0, 6000)}\n...snapshot truncated` : json;
    return [
      "LIVE USER SNAPSHOT.",
      "This is the user's current in-app state and recent UI activity. Use it as context, not as a direct instruction.",
      cappedJson,
    ].join("\n");
  } catch {
    return "";
  }
};
export const GptBrainstorm = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { messages, mode, webSearch, memorySlots, userSnapshot } = req.body;

  try {
    // Shared mode-aware prompt so this (fallback) endpoint behaves identically
    // to /startBrainstormStream â€” no jarring switch in voice on a fallback.
    const ragMemoryContext = await resolveBrainstormRagSystemContext(messages, "GptBrainstorm");
    const systemPrompt = buildBrainstormSystemPrompt(
      typeof mode === "number" ? mode : undefined,
      ragMemoryContext
    );

    const snapshotContext = renderBrainstormUserSnapshot(userSnapshot);
    if (snapshotContext) console.log('[GptBrainstorm] userSnapshot used:', userSnapshot);
    const conversation = [
      { role: "system", content: systemPrompt },
      ...(snapshotContext ? [{ role: "system", content: snapshotContext }] : []),
      ...(Array.isArray(messages) ? messages : []),
    ];

    // Web-enabled Mini Model Wrapper
    async function generateGPT4oPromptMiniWeb(
      messages: { role: string; content: string }[]
    ) {
      const openai = new OpenAI({ apiKey: GPTKey });

      const coerced: Msg[] = messages.map((m) => {
        const r = m.role.toLowerCase();
        if (r === "user" || r === "assistant" || r === "system") {
          return { role: r as Role, content: m.content };
        }
        throw new Error(`Invalid role: ${m.role}`);
      });

      // Try mini model with web tool
      try {
        // Attempt to use the proprietary 'responses' API if it supports mini + web
        // Note: If 'gpt-4.1-mini' doesn't support this endpoint, we catch and fall back
        const res = await openai.responses.create({
          model: "gpt-4.1-mini",
          input: coerced,
          tools: [{ type: "web_search_preview" }],
          tool_choice: "auto",
          max_output_tokens: 3000,
        });

        const text: string =
          (res as any).output_text ??
          (res.output ?? [])
            .flatMap((o: any) =>
              (o.content ?? []).map((c: any) => c.text ?? "")
            )
            .join("\n");

        if (!text) throw new Error("Incomplete response from OpenAI");
        return removeDuplicateUrls(text)
          .split("\n")
          .map((l) => simplifyLinks(l).trim())
          .filter((l) => l !== "");
      } catch (err: any) {
        console.log(
          "Mini web search failed, falling back to standard mini chat",
          err.message
        );
        // Fallback to standard chat completions without web (the original 'mini' behavior)
        return generateGPT4oPromptP(messages);
      }
    }

    const memorySlotsForTools = normalizeBrainstormMemorySlots(memorySlots);
    const responseContent = !webSearch && memorySlotsForTools.length
      ? await generateBrainstormWithMemoryTools(conversation, memorySlotsForTools)
      : webSearch
        ? await generateGPT4oPromptMiniWeb(conversation)
        : await generateGPT4oPromptP(conversation);

    let reply = cleanBrainstormReply(responseContent);

    return res.send({
      message: "Done",
      reply: reply,
    });
  } catch (e: any) {
    console.error("Error:", e.message);
    return res.status(500).send({ message: "Error accessing ChatGPT API" });
  }
};

/* ------------------------------------------------------------------ */
/*  Brainstorm â€” Streaming (SSE) + mode-aware system prompt           */
/* ------------------------------------------------------------------ */

// Modes mirror the frontend `type`: 0 = creative scenes/memes, 1 = story,
// 3 = interactions. (2 audio / 4 search are intentionally not handled here.)
const buildBrainstormSystemPrompt = (mode?: number, ragMemoryContext?: string): string => {
  let modeName = "Freeform";
  let modeFlavor = "";
  if (mode === 1) {
    modeName = "Cinema / Story";
    modeFlavor = ", where the user leans toward narrative video stories";
  } else if (mode === 0) {
    modeName = "Creative Scenes / Memes";
    modeFlavor = ", where the user leans toward punchy standalone visuals and memes";
  } else if (mode === 3) {
    modeName = "Interactive";
    modeFlavor = ", where the user leans toward choose-your-own-adventure interactive games";
  }

  return `
You are ClikB's brainstorm buddy â€” a warm, playful, real friend with your own personality and curiosity. You hang out with the user, chat about anything that comes up, and help spark and shape creative ideas for the content they make on ClikB.

The app you live inside is called ClikB (clikb.com) â€” a creation-first social app for making AI image and video content. Always refer to it by its exact name: ClikB.

You're in ${modeName} mode${modeFlavor}. If they ask what mode they're on, just tell them.

DYNAMIC CLIKB TRAINING MEMORY PARAMETER:
${ragMemoryContext || "RAG_TRAINING_MEMORY_STATUS: unavailable\nRAG_TRAINING_MEMORY_RULES:\n- Continue normally without mentioning the memory system."}

Be yourself and read the room. Match their vibe and energy, talk like a real person, and go as light or as deep as the moment actually calls for â€” that's your call, not a rule. When they're genuinely building something, help shape it with them; when they just want to talk, just talk. You can use live web info when something touches recent or real-world events â€” just fold it into the conversation naturally, in your own words, instead of a list of sources.

One hard rule on format (your reply may be read aloud by a voice): always reply in plain, natural spoken prose. Never use markdown, asterisks, bullet points, headings, or labels like "Panel", "Image:", or "Text:", and never dump a formatted spec or breakdown. Weave any idea into sentences a person could actually say out loud â€” e.g. describe a three-panel meme in a flowing sentence, not a labeled list. The clean, structured version of an idea is produced later when the user hits Save, not here.
`.trim();
};

/**
 * Streaming counterpart of GptBrainstorm. Streams the reply chunk-by-chunk over
 * Server-Sent Events. Keeps web search via the Responses API, and falls back to
 * Chat Completions streaming (no web) if the Responses stream fails.
 * Body: { messages: {role, content}[], mode?: number }
 */
export const GptBrainstormStream = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { messages, mode, webSearch, memorySlots, userSnapshot } = req.body;
  console.log("[GptBrainstormStream] mode:", mode, "webSearch:", webSearch);

  // ---- SSE headers ----
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // defeat proxy buffering
  (res as any).flushHeaders?.();

  const send = (obj: any) => {
    if ((res as any).writableEnded) return;
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  let clientGone = false;
  // Use res "close" (fires on real client disconnect) â€” req "close" can fire
  // as soon as the request body is read on some setups, which would abort
  // generation before it starts.
  res.on("close", () => {
    clientGone = true;
  });

  const ragMemoryContext = await resolveBrainstormRagSystemContext(messages, "GptBrainstormStream");
  const systemPrompt = buildBrainstormSystemPrompt(
    typeof mode === "number" ? mode : undefined,
    ragMemoryContext
  );

  const snapshotContext = renderBrainstormUserSnapshot(userSnapshot);
  if (snapshotContext) console.log('[GptBrainstormStream] userSnapshot used:', userSnapshot);
  const coerced: Msg[] = [
    { role: "system", content: systemPrompt },
    ...(snapshotContext ? [{ role: "system", content: snapshotContext }] : []),
    ...(Array.isArray(messages) ? messages : []),
  ].map((m: any) => {
    const r = String(m.role).toLowerCase();
    const role: Role = r === "assistant" || r === "system" ? (r as Role) : "user";
    return { role, content: String(m.content ?? "") };
  });

  const openai = new OpenAI({ apiKey: GPTKey });

  // Type a finished string out to the client as SSE deltas (typing effect).
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const streamOut = async (full: string) => {
    const parts = full.match(/\S+\s*/g) || [full];
    const step = 4; // words per flush
    for (let i = 0; i < parts.length; i += step) {
      if (clientGone) break;
      send({ type: "delta", text: parts.slice(i, i + step).join("") });
      await sleep(18);
    }
  };

  // FAST PATH: real token-by-token Chat Completions streaming (no web search).
  const runChatStream = async () => {
    const stream2 = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: coerced as any,
      max_tokens: 3000,
      stream: true,
    });
    let any = false;
    for await (const chunk of stream2 as any) {
      if (clientGone) break;
      const delta: string = chunk?.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        any = true;
        send({ type: "delta", text: delta });
      }
    }
    if (!any) throw new Error("No text from chat completions");
  };

  // WEB PATH: proven non-streaming Responses call WITH web search, typed out.
  // (Responses streaming + web_search_preview does not emit deltas reliably,
  // so we generate fully â€” web search intact â€” and stream the result.)
  const runWebSearch = async () => {
    const r: any = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: coerced as any,
      tools: [{ type: "web_search_preview" }],
      tool_choice: "auto",
      max_output_tokens: 3000,
    });
    let full: string =
      r.output_text ??
      (r.output ?? [])
        .flatMap((o: any) => (o.content ?? []).map((c: any) => c.text ?? ""))
        .join("\n");
    full = String(full || "");
    // Drop any trailing "Highlights"/"Sources"/"References" link list the
    // web-search tool appends.
    full = full.replace(/\n+#{1,6}[^\n]*\b(highlights|sources|references)\b[\s\S]*$/i, "");
    // Clean links: remove duplicate domains, then collapse to a readable
    // "anchor (domain)" form â€” this also strips tracking params like
    // ?utm_source=openai, since links are reduced to their root domain.
    full = simplifyLinks(removeDuplicateUrls(full));
    full = cleanBrainstormReply(full);
    if (!full) throw new Error("No text produced by responses (web search)");
    await streamOut(full);
  };

  const memorySlotsForTools = normalizeBrainstormMemorySlots(memorySlots);

  try {
    if (!webSearch && memorySlotsForTools.length) {
      const full = await generateBrainstormWithMemoryTools(coerced as any, memorySlotsForTools);
      await streamOut(cleanBrainstormReply(full));
    } else if (webSearch) {
      await runWebSearch();
    } else {
      await runChatStream();
    }
    if (!clientGone) send({ type: "done" });
    return res.end();
  } catch (err: any) {
    console.log(
      "[GptBrainstormStream] primary path failed (webSearch=" + webSearch + "), falling back to chat stream:",
      err?.message
    );
    // FALLBACK: real Chat Completions streaming (no web search)
    try {
      await runChatStream();
      if (!clientGone) send({ type: "done" });
      return res.end();
    } catch (err2: any) {
      console.error("[GptBrainstormStream] fallback failed:", err2?.message);
      send({
        type: "error",
        text: "I'm having trouble connecting to my brain right now. Please try again.",
      });
      return res.end();
    }
  }
};

/* ------------------------------------------------------------------ */
/*  Brainstorm â€” Distill a chat message into a clean template block    */
/* ------------------------------------------------------------------ */

/**
 * Strips a brainstorm message down to a clean, reusable FOUNDATION block
 * (Context / World / Vibe / Rules) with no conversational fluff, so it can
 * be saved as a template and reused verbatim as the world guide.
 * Body: { text: string, mode?: number }
 */
export const GptDistillTemplate = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { text = "", mode } = req.body;

  if (!text || !String(text).trim()) {
    return res.status(400).send({ message: "No text to distill" });
  }

  const target =
    mode === 1
      ? "a story world"
      : mode === 0
      ? "a visual scene concept"
      : mode === 3
      ? "an interactive game world"
      : "a creative concept";

  const systemPrompt = `
You convert a brainstorm conversation or answer into a clean, reusable FOUNDATION block for ${target}.

OUTPUT ONLY THE FOUNDATION â€” the Context, World, Vibe, and Rules.
- No greetings, no commentary, no questions, no "here is", no sign-offs, no emojis.
- No markdown headers, no bold, no bullet symbols. Plain, dense, declarative prose.
- Keep every concrete creative detail: characters and their looks, the setting, the tone/genre, and any rules. Drop only the conversational filler.
- This text is saved as a template and reused verbatim as the world guide for generation.
`.trim();

  try {
    const raw = await generateGPT4oPromptP([
      { role: "system", content: systemPrompt },
      { role: "user", content: String(text) },
    ]);
    let reply = Array.isArray(raw) ? raw.join("\n") : String(raw);
    reply = reply
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*/g, "")
      .trim();
    return res.send({ message: "Done", reply });
  } catch (e: any) {
    console.error("[GptDistillTemplate] error:", e.message);
    return res.status(500).send({ message: "Error distilling template" });
  }
};

/* ------------------------------------------------------------------ */
/* Milo Verse Demo Specific Endpoints
/* ------------------------------------------------------------------ */

export const GptMiloCharacters = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { story } = req.body;
  const systemPrompt = `You are a character designer. Extract or create visually distinct characters based on the story: "${story}".
Return strictly JSON formatting:
{
  "characters": [
    { "name": "Character Name", "description": "Visual description including clothing, hair, face, etc." }
  ]
}`;
  try {
    const raw: any = await generateGPT4oPromptProWeb([
      { role: "system", content: systemPrompt },
    ]);
    const txt = Array.isArray(raw) ? raw.join("") : String(raw);
    const m = txt.match(/\{[\s\S]*\}/);
    res.send({ data: JSON.parse(m ? m[0] : txt) });
  } catch (e) {
    res.status(500).send({ error: true });
  }
};

export const GptMiloImagePlan = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { story, characters } = req.body;
  const systemPrompt = `You are an art director. Create a global aesthetic plan for the story: "${story}".
The art style MUST strictly be a high-quality, vibrant "3D CGI animation" style (resembling premium modern animated motion pictures, keeping the aesthetic coherent across all scenes).
Characters: ${JSON.stringify(characters)}
Return strictly JSON formatting:
{
  "imagePlan": {
    "aesthetic": "Global aesthetic description, environment, lighting, 3D CGI art style.",
    "character_references": "Consolidated character descriptions for consistency."
  }
}`;
  try {
    const raw: any = await generateGPT4oPromptProWeb([
      { role: "system", content: systemPrompt },
    ]);
    const txt = Array.isArray(raw) ? raw.join("") : String(raw);
    const m = txt.match(/\{[\s\S]*\}/);
    res.send({ data: JSON.parse(m ? m[0] : txt) });
  } catch (e) {
    res.status(500).send({ error: true });
  }
};

export const GptMiloScenes = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { story } = req.body;
  const systemPrompt = `You are a storyboard artist. Split the story into 2 to 6 chronological, bite-sized action beats (scenes).
Story: "${story}"
Return strictly JSON formatting:
{
  "scenes": [
    "Scene 1 description...",
    "Scene 2 description..."
  ]
}`;
  try {
    const raw: any = await generateGPT4oPromptProWeb([
      { role: "system", content: systemPrompt },
    ]);
    const txt = Array.isArray(raw) ? raw.join("") : String(raw);
    const m = txt.match(/\{[\s\S]*\}/);
    res.send({ data: JSON.parse(m ? m[0] : txt) });
  } catch (e) {
    res.status(500).send({ error: true });
  }
};

export const GptMiloVideoPlan = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { imagePlan, scenes } = req.body;
  const systemPrompt = `You are a cinematographer. Map out camera and subject movement for each scene.
Image Plan: ${JSON.stringify(imagePlan)}
Scenes: ${JSON.stringify(scenes)}
Return strictly JSON:
{
  "videoPlan": [
    { "sceneIndex": 0, "camera": "Pan right", "subject": "Starts walking" }
  ]
}`;
  try {
    const raw: any = await generateGPT4oPromptProWeb([
      { role: "system", content: systemPrompt },
    ]);
    const txt = Array.isArray(raw) ? raw.join("") : String(raw);
    const m = txt.match(/\{[\s\S]*\}/);
    res.send({ data: JSON.parse(m ? m[0] : txt) });
  } catch (e) {
    res.status(500).send({ error: true });
  }
};

export const GptMiloMotionPrompts = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { videoPlan, scenes } = req.body;
  const systemPrompt = `You are a prompt engineer for an AI video model. Write strict, single-action video movement prompts for each scene based on the video plan.
Scenes: ${JSON.stringify(scenes)}
Video Plan: ${JSON.stringify(videoPlan)}
Return strictly JSON:
{
  "motionPrompts": [
    "A cinematic pan right, subject starts walking...",
    "..."
  ]
}`;
  try {
    const raw: any = await generateGPT4oPromptProWeb([
      { role: "system", content: systemPrompt },
    ]);
    const txt = Array.isArray(raw) ? raw.join("") : String(raw);
    const m = txt.match(/\{[\s\S]*\}/);
    res.send({ data: JSON.parse(m ? m[0] : txt) });
  } catch (e) {
    res.status(500).send({ error: true });
  }
};

/* ------------------------------------------------------------------ */
/* Phase 2: The Casting Call (Automatic Character/Environment Extraction)
/* ------------------------------------------------------------------ */
export const GptExtractCasting = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { prompts: inputPrompts, scenes, instruction } = req.body;
  const targetScenes = inputPrompts || scenes || [];

  const systemPrompt = `You are a visual director for character and environment design.
Given the chronological SCENES, detect and extract visually vital components to ensure absolute character consistency.

RULES:
1. CHARACTERS: Detect and list ONLY characters that appear strictly MORE THAN ONCE across the multiple scenes (MAXIMUM 8 RECURRING CHARACTERS). If a character only appears in a single scene, IGNORE THEM completely.
   - EXACT NAME RULE: You MUST extract the name EXACTLY AS IT APPEARS IN THE TEXT, but REMOVE the leading articles "the", "a", or "an". For example, if the text says "the hill", return "hill". DO NOT remove possessives like "Jack's" or "his". The 'name' field must be the verbatim text minus any leading article.
   - CRITICAL DESCRIPTION RULE: Provide a hyper-specific, vivid visual description.
   - You MUST include: Skin/scale/fur color, eye color, hair style, specific clothing items, build, and any distinctive physical traits.
   - HYBRID/MONSTER RULE: If a character is a hybrid, monster, or alien, you MUST explicitly describe their non-human anatomy. DO NOT be generic.

2. ENVIRONMENTS & OBJECTS: Detect and list ONLY environments/locations OR unique objects/props that appear strictly MORE THAN ONCE across the multiple scenes.
   - EXACT NAME RULE: You MUST extract the name EXACTLY AS IT APPEARS IN THE TEXT, but REMOVE the leading articles "the", "a", or "an" (e.g., return "hill" instead of "the hill").
   - Describe atmosphere, specific details, materials, and signature features.

Return pure JSON following this EXACT schema:
{
  "characters": [ { "name": "Character Name", "description": "Vivid, detailed visual description including non-human traits." } ],
  "environments": [ { "name": "Location Name", "description": "Detailed visual description of the unique environment or object." } ]
}

${
  instruction
    ? `CRITICAL USER INSTRUCTION:\nYou must strictly follow the default rules above AND the user's specific instruction below. Do not skip extracting characters unless the user explicitly tells you to do so.\nUSER INSTRUCTION: "${instruction}"`
    : ""
}`;

  try {
    const messages: any = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `SCENES:\n${JSON.stringify(targetScenes)}`,
      },
    ];

    // Using GPT-4o for character extraction as requested
    const completion = await openai.chat.completions.create({
      messages,
      model: "gpt-4o",
      response_format: { type: "json_object" },
    });

    const txt = completion.choices[0].message.content || "{}";
    const m = txt.match(/\{[\s\S]*\}/);

    const parsedData = JSON.parse(m ? m[0] : txt);
    res.send({ data: parsedData });
  } catch (e) {
    console.error("GptExtractCasting error:", e);
    res.status(500).send({ error: true });
  }
};

/* ------------------------------------------------------------------ */
/* Phase 3: Generate Image Prompts for Characters & Environments
/* ------------------------------------------------------------------ */
export const GptGenerateCastingPrompts = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    characters,
    environments,
    plan,
    scenes,
    prompts: inputPrompts,
    narrationSummary,
  } = req.body;
  const targetScenes = scenes || inputPrompts || [];
  const targetPlan = plan || narrationSummary || "General visual style";

  if (!characters && !environments) {
    return res
      .status(400)
      .send({ message: "Body must contain characters or environments" });
  }

  const allEntities = [
    ...(characters || []).map((c: any) => ({ ...c, type: "character" })),
    ...(environments || []).map((e: any) => ({ ...e, type: "environment" })),
  ];

  if (allEntities.length === 0) {
    return res.send({ prompts: [] });
  }

  const systemPrompt = `You are an expert AI image-prompt engineer specializing in character reference sheets and visual grounding.

You are given a list of CHARACTERS and ENVIRONMENTS extracted from a story, along with the story plan and scenes for context.

Your job: For EACH entity, write a single, detailed, self-contained image generation prompt (â‰¤200 chars) that an AI image model can use to generate a reference image.

INTERNET SEARCH & CANONICAL ACCURACY RULE:
- You HAVE INTERNET ACCESS via tools. If a character or environment name belongs to a known intellectual property (e.g., "Hippocampus", "Shlub", or "Deliria" from Krapopolis, or characters from Marvel, mythology, popular games, etc.), YOU MUST search the web to find their EXACT canonical visual appearance.
- DO NOT invent generic "humanoid" descriptions if the entity exists in real-world media or pop culture. Override the provided extraction description with true-to-life, hyper-accurate visual details based on your web search.

RULES FOR CHARACTERS:
- Place the character centered on a PURE WHITE background.
- Describe their full appearance with extreme focus on their UNIQUE features.
- If the description mentions hybrid/monster parts (fins, tails, scales, gills, wings, etc.), you MUST PRIORITIZE these in the prompt so the AI doesn't default to a generic human.
- Focus on: Face, anatomy, clothing, and textures (e.g., "shimmering blue scales," "mechanical wings").
- The prompt must produce a clean character reference sheet / portrait look.

RULES FOR ENVIRONMENTS:
- Describe the location as a wide establishing shot with cinematic lighting.
- Include atmosphere, time of day, key architectural or natural elements.
- Make it visually rich and self-contained.

ART STYLE REQUIREMENT:
- Extract the designated art style from the provided STORY PLAN.
- You MUST append exactly ", [extacted art style] art style" to the very end of EVERY generated imagePrompt. Do this consistently for both characters and environments.

Return ONLY a JSON array (no markdown, no commentary) in this exact shape:
[
  { "name": "Entity Name", "type": "character"|"environment", "imagePrompt": "the detailed prompt, [art style] art style" }
]

The array length MUST match the number of entities provided.`;

  const userPrompt = `
STORY PLAN:
${JSON.stringify(targetPlan)}

SCENES:
${JSON.stringify(targetScenes)}

ENTITIES TO GENERATE PROMPTS FOR:
${JSON.stringify(
  allEntities.map((e: any) => ({
    name: e.name,
    type: e.type,
    description: e.description,
  }))
)}

Generate the JSON array now.`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const MAX_RETRIES = 3;
  let attempt = 0;
  let resultJson: string | null = null;

  const isValidJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const extractJSON = (str: string): string | null => {
    const m = str.match(/\[[\s\S]*\]/);
    return m ? m[0] : null;
  };

  while (attempt < MAX_RETRIES && !resultJson) {
    try {
      const raw: any = await generateGPT4oPrompt5B(messages);
      const txt = Array.isArray(raw) ? raw.join("") : String(raw).trim();

      if (isValidJSON(txt)) {
        resultJson = txt;
      } else {
        const extracted = extractJSON(txt);
        if (extracted && isValidJSON(extracted)) resultJson = extracted;
      }
    } catch (e: any) {
      console.error("GptGenerateCastingPrompts GPT error:", e.message);
    }
    attempt += resultJson ? 0 : 1;
  }

  if (!resultJson) {
    return res
      .status(500)
      .send({ message: "Failed to generate casting prompts" });
  }

  const prompts = JSON.parse(resultJson);
  console.log("ðŸŽ¨ Casting Prompts Generated:", prompts);
  return res.send({ prompts });
};

export const GptInjectCharacters = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { prompt, activeCharacters, syntaxType, existingInputs } = req.body;
    const { applyCharacterInjection } = require("./characterInjection");

    const result = applyCharacterInjection(
      prompt,
      activeCharacters || [],
      syntaxType || "flux",
      existingInputs || []
    );

    return res.status(200).send(result);
  } catch (error) {
    console.error("Error in GptInjectCharacters:", error);
    return res.status(500).send({ error: "Failed to inject characters" });
  }
};

export const GptVideoVisualSeedance2 = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { question, imageDescription, PlanVid, duration } = req.body as any;
  if (!question || !imageDescription || !PlanVid)
    return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert motion director for ByteDance Seedance 2.0 (Video Generation).
Seedance 2.0 requires a rigid, highly literal four-beat cinematographic structure:
[Subject & Action] + [Camera Movement] + [Sound/Audio Cues] + [Shot Transitions]

Interpret inputs like this:
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH.
- "question" = BACKGROUND STORY CONTEXT.

CRITICAL RULES FOR SEEDANCE 2.0:
1. Seedance 2.0 uses a strict multimodal bracket system. Any character mentioned MUST be referenced using [Image2], [Image3] etc. based on their appearance. NEVER use names directly without the bracket system.
Example: "The character from [Image2] walks confidently."
2. Camera terminology MUST be literal (e.g. Dolly zoom, rack focus, tracking shot). NEVER use "fast pan" or chaotic, comma-separated tag dumps.
3. Keep the prompt tightly constrained within 2 paragraphs.

FORMATTING:
Return ONLY the raw prompt text, no markdown blocks, no titles.
`;

  const userPrompt = `
PlanVid: ${JSON.stringify(PlanVid)}
question: ${question}
imageDescription: ${imageDescription}
duration: ${duration || 5}

Generate the Seedance 2.0 prompt (Non-Audio mode).
`;

  try {
    const raw = await generateGPT4oPrompt5B([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt, isMultiShot: false });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};

export const GptVideoVisualSeedance2Audio = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { question, imageDescription, PlanVid, duration } = req.body as any;
  if (!question || !imageDescription || !PlanVid)
    return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert motion director for ByteDance Seedance 2.0 (Video Generation).
Seedance 2.0 natively synthesizes video and audio in the exact same latent space.

Interpret inputs like this:
- "imageDescription" = THE ABSOLUTE VISUAL GROUND TRUTH.
- "question" = BACKGROUND STORY CONTEXT.

CRITICAL RULES FOR SEEDANCE 2.0 (AUDIO MODE):
1. Bracket System: Any character mentioned MUST be referenced using [Image2], [Image3] etc.
2. Dialogue: To trigger flawless lip-sync, you MUST wrap spoken text in double quotes directly attributed to the bracket tag.
Example: The character from [Image2] looks directly into the lens and says: "We are running out of time."
3. Contextual Foley: Be highly specific about materials interacting to generate precise sound effects (e.g. "debris clattering across concrete").

FORMATTING:
Return ONLY the raw prompt text, no markdown blocks, no titles.
`;

  const userPrompt = `
PlanVid: ${JSON.stringify(PlanVid)}
question: ${question}
imageDescription: ${imageDescription}
duration: ${duration || 5}

Generate the Seedance 2.0 prompt (Audio Mode). Ensure you include dialogue if applicable.
`;

  try {
    const raw = await generateGPT4oPrompt5B([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt, isMultiShot: false });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};

export const GptVideoVisualKling3Std = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { question, imageDescription, PlanVid, duration } = req.body as any;
  if (!question || !imageDescription || !PlanVid)
    return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert motion director for Kling 3 Standard.
You are animating an existing frame.
Kling 3 prefers highly detailed descriptive cinematography, emphasizing texture, lighting, and fluid motion.
Do NOT include audio cues, as this is the Non-Audio pipeline.

FORMATTING:
Return ONLY the raw prompt text, no markdown blocks.
`;

  const userPrompt = `
PlanVid: ${JSON.stringify(PlanVid)}
question: ${question}
imageDescription: ${imageDescription}
duration: ${duration || 5}

Generate the Kling 3 Standard prompt.
`;

  try {
    const raw = await generateGPT4oPrompt5B([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt, isMultiShot: false });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};

export const GptVideoVisualKling3StdAudio = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { question, imageDescription, PlanVid, duration } = req.body as any;
  if (!question || !imageDescription || !PlanVid)
    return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert motion director for Kling 3 Standard Audio-enabled.
You are animating an existing frame.
Kling 3 prefers highly detailed descriptive cinematography, emphasizing texture, lighting, and fluid motion.

CRITICAL FOR AUDIO:
You MUST include clear descriptions of ambient sound effects and spoken dialogue.
Example: "Footsteps crunching on snow. The man says 'I am here.' "

FORMATTING:
Return ONLY the raw prompt text, no markdown blocks.
`;

  const userPrompt = `
PlanVid: ${JSON.stringify(PlanVid)}
question: ${question}
imageDescription: ${imageDescription}
duration: ${duration || 5}

Generate the Kling 3 Standard Audio prompt.
`;

  try {
    const raw = await generateGPT4oPrompt5B([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt, isMultiShot: false });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};

export const GptVideoVisualGrok = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { question, imageDescription, PlanVid, duration } = req.body as any;
  if (!question || !imageDescription || !PlanVid)
    return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert motion director for Grok (xAI) Video Generation.
Grok prefers natural language, highly descriptive prose without structured [Bracket] character tags.
Describe the visual entirely in conversational, flowing cinematography terms.

FORMATTING:
Return ONLY the raw prompt text, no markdown blocks.
`;

  const userPrompt = `
PlanVid: ${JSON.stringify(PlanVid)}
question: ${question}
imageDescription: ${imageDescription}
duration: ${duration || 5}

Generate the Grok video prompt.
`;

  try {
    const raw = await generateGPT4oPrompt5B([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt, isMultiShot: false });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};

export const GptVideoVisualPixVerse = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { question, imageDescription, PlanVid, duration } = req.body as any;
  if (!question || !imageDescription || !PlanVid)
    return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert motion director for PixVerse v6.
PixVerse excels with cinematic keyword dumps and sweeping camera motions. It does NOT support character identity locks, so focus heavily on the environment, lighting, and camera action.

FORMATTING:
Return ONLY the raw prompt text, no markdown blocks.
`;

  const userPrompt = `
PlanVid: ${JSON.stringify(PlanVid)}
question: ${question}
imageDescription: ${imageDescription}
duration: ${duration || 5}

Generate the PixVerse v6 prompt.
`;

  try {
    const raw = await generateGPT4oPrompt5B([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt, isMultiShot: false });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};

export const GptArtstylePrompt = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { artstyleName } = req.body;
  if (!artstyleName) return res.status(400).send({ message: "Bad Request" });

  const systemPrompt = `
You are an expert prompt engineer. Your task is to write a highly detailed, studio-quality visual prompt representing the selected art style.
Strict rules:
1. Must represent the given art style perfectly.
2. Must include a human character or a random animal character.
3. Must depict a studio quality scene.
4. Must capture and depict an emotional vibe representing the style's character.
5. Return ONLY the visual prompt as a single plain-text string (no markdown fences, maximum 300 characters).
`;

  const userPrompt = `Write the visual prompt for the art style: ${artstyleName}`;

  try {
    const raw = await generateGPT4oPrompt([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const storyPrompt = (Array.isArray(raw) ? raw.join("") : String(raw))
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return res.send({ message: "Done", storyPrompt });
  } catch (e: any) {
    return res.status(500).send({ message: "Error" });
  }
};
