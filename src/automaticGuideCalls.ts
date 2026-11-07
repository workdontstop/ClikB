export const AUTOMATIC_GUIDE_ENABLED_STORAGE_KEY = "clikb_automatic_guide_enabled";

export const AUTOMATIC_GUIDE_RESPONSE_INSTRUCTION = [
  "This is an automatic Guide intervention displayed in a compact UI.",
  "Reply naturally and concisely in one or two short sentences.",
  "Do not use lists, detailed walkthroughs, or repeat every available option.",
  "Give only the most useful immediate guidance and do not mention that the trigger was automatic.",
].join(" ");

export const AUTOMATIC_GUIDE_CALLS = {
  SCENE_GENERATION_DOUBLE_CHECK: {
    id: "scene-generation-double-check",
    label: "Scene generation double-check",
    route: "prompt-input-scenes",
    description: "Checks the completed scenes array against the request once after generation.",
    defaultEnabled: true,
    runOncePerReload: false,
  },
  CHARACTER_LIST_AUDIT: {
    id: "character-list-audit",
    label: "Character list audit",
    route: "prompt-input-characters",
    description: "Checks a finalized character list against the completed scene and image-prompt text.",
    defaultEnabled: true,
    runOncePerReload: false,
  },
  EDITSTORY_UPDATE_WITH_AI_REVIEW: {
    id: "editstory-update-with-ai-review",
    label: "EditStory Update-with-AI review",
    route: "editstory",
    description: "Reviews the result of an explicit image or video Update-with-AI action.",
    defaultEnabled: true,
    runOncePerReload: false,
  },
} as const;

export const buildSceneGenerationDoubleCheckMessage = (
  originalRequest: unknown,
  completedScenes: unknown[],
): string => {
  const request = String(originalRequest || "").trim();
  const scenes = completedScenes
    .map((scene) => String(scene || "").trim())
    .filter(Boolean);

  return [
    "Compare the completed scenes array with what I originally requested.",
    `Original request:\n${request}`,
    `Completed scenes array:\n${JSON.stringify(scenes, null, 2)}`,
    "Begin with Strong match, Partial match, or Needs revision. Identify the most important match and the biggest mismatch, if any. Do not rewrite the scenes.",
  ].join("\n\n");
};

export const buildCharacterListAuditMessage = (
  finalizedCharacters: unknown[],
  sceneAndImagePrompts: unknown[],
): string => {
  const characters = finalizedCharacters
    .map((character, index) => {
      if (typeof character === "string") {
        const name = character.trim();
        return name ? { name } : null;
      }
      if (!character || typeof character !== "object") return null;
      const item = character as Record<string, unknown>;
      const name = String(item.name || item.characterName || "").trim();
      const description = String(item.description || item.prompt || "").trim();
      if (!name && !description) return null;
      return {
        name: name || `Character ${index + 1}`,
        ...(description ? { description } : {}),
      };
    })
    .filter(Boolean);
  const sourceText = Array.from(new Set(
    sceneAndImagePrompts
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ));

  return [
    "Audit the finalized character list against the completed scene and image-prompt text.",
    `Scene and image-prompt text:\n${JSON.stringify(sourceText, null, 2)}`,
    `Finalized character list:\n${JSON.stringify(characters, null, 2)}`,
    "Check for missing recurring characters, description mismatches, duplicates, and unnecessary one-off or background cast fluff. Reply in one concise, natural sentence. Start with Looks accurate or Needs attention.",
  ].join("\n\n");
};

export const buildEditStoryUpdateWithAiReviewMessage = ({
  sceneNumber,
  mode,
  instruction,
  promptBefore,
  promptAfter,
}: {
  sceneNumber: number;
  mode: "image" | "video";
  instruction: unknown;
  promptBefore: unknown;
  promptAfter: unknown;
}): string => [
  `Review Scene ${sceneNumber}'s ${mode} Update-with-AI result.`,
  `User instruction:\n${String(instruction || "").trim()}`,
  `Prompt before:\n${String(promptBefore || "").trim()}`,
  `Prompt after:\n${String(promptAfter || "").trim()}`,
  "In one concise, natural sentence, explain the expected visual change and name only the most important correction, if any. Start with Looks right or Needs adjustment.",
].join("\n\n");

export type AutomaticGuideCallDefinition = (
  typeof AUTOMATIC_GUIDE_CALLS
)[keyof typeof AUTOMATIC_GUIDE_CALLS];

export type AutomaticGuideCallRequest = {
  callId: string;
  message: string;
  runOncePerReload?: boolean;
};
