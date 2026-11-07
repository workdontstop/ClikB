import lunaImage from "./assets/language-models/luna-moon.webp";
import terraImage from "./assets/language-models/terra-earth.webp";
import solBlueImage from "./assets/language-models/sol-blue-sun-v2.webp";
import deepseekImage from "./assets/language-models/deepseek-comet-v1.jpg";
import kimiImage from "./assets/language-models/kimi-ringed-planet-v1.jpg";

/**
 * Prompt-writing models the user can pick between.
 *
 * Display metadata only. The backend owns the real model IDs and the prices it
 * actually charges — these numbers exist so the UI can show a price and an
 * estimate, never to perform a deduction.
 */

export type LanguageModelTier = "luna" | "luna_extra" | "terra" | "sol_medium" | "sol" | "astra" | "deepseek" | "kimi";

export type LanguageModelInfo = {
  id: LanguageModelTier;
  name: string;
  pixels: number;
  image: string;
  imageFilter?: string;
  summary: string;
};

export const LANGUAGE_MODELS: LanguageModelInfo[] = [
  {
    id: "luna",
    name: "Luna",
    pixels: 1,
    image: lunaImage,
    summary: "Low reasoning",
  },
  {
    id: "luna_extra",
    name: "Luna Extra",
    pixels: 2,
    image: lunaImage,
    summary: "High reasoning",
  },
  {
    id: "terra",
    name: "Terra",
    pixels: 5,
    image: terraImage,
    summary: "High reasoning",
  },
  {
    id: "sol",
    name: "Sol",
    pixels: 15,
    image: solBlueImage,
    summary: "High reasoning",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    pixels: 2,
    image: deepseekImage,
    summary: "Independent Replicate route",
  },
  {
    id: "kimi",
    name: "Kimi",
    pixels: 4,
    image: kimiImage,
    summary: "Replicate reasoning route",
  },
];

export const DEFAULT_LANGUAGE_MODEL: LanguageModelTier = "luna";

export const languageModelInfo = (tier: LanguageModelTier): LanguageModelInfo =>
  LANGUAGE_MODELS.find((m) => m.id === (tier === "sol_medium" ? "terra" : tier)) ?? LANGUAGE_MODELS[0];

export const languageModelPixels = (tier: LanguageModelTier): number =>
  languageModelInfo(tier).pixels;

/* ------------------------------------------------------------------ *
 *  Cost estimate
 * ------------------------------------------------------------------ */

export type StoryLlmEstimateInput = {
  tier: LanguageModelTier;
  /**
   * Number of entries in the step array — NOT logical scenes.
   *
   * In Cinema mode that array is stage-indexed: two entries (Stage A and
   * Stage B) belong to one scene and are written by a single backend call, so
   * the image-prompt operations below halve. Pass `parsedKeyPoints.length`.
   */
  sceneCount: number;
  cinemaMode: boolean;
  includeVideoAutoPrompts: boolean;
};

export type StoryLlmEstimate = {
  pricePerOperation: number;
  blueprintOperations: number;
  imagePromptOperations: number;
  imagePacerOperations: number;
  videoPromptOperations: number;
  totalOperations: number;
  blueprintPixels: number;
  imagePromptPixels: number;
  imagePacerPixels: number;
  videoPromptPixels: number;
  totalPixels: number;
};

/** Pure. Informational only — never use this to deduct anything. */
export const estimateStoryLlmPixels = ({
  tier,
  sceneCount,
  cinemaMode,
  includeVideoAutoPrompts,
}: StoryLlmEstimateInput): StoryLlmEstimate => {
  const pricePerOperation = languageModelPixels(tier);
  const scenes = Math.max(0, Math.floor(sceneCount || 0));

  // Cinema writes Stage A and Stage B in one call, so a stage-indexed array of
  // n entries costs ceil(n / 2) image-prompt operations.
  const imagePromptOperations = cinemaMode ? Math.ceil(scenes / 2) : scenes;
  // The automatic pacer follows each initial writer operation, retaining the
  // Cinema A/B pair and charging the selected tier once for that second pass.
  const imagePacerOperations = imagePromptOperations;
  const blueprintOperations = scenes > 0 ? 1 : 0;

  // Video Auto Prompt does NOT pair up: the editor builds one 'A' entry per
  // step, Cinema included, and Auto Prompt runs per A shot. So this is one
  // operation per entry even when the image prompts above were halved.
  const videoPromptOperations = includeVideoAutoPrompts ? scenes : 0;

  const totalOperations =
    blueprintOperations + imagePromptOperations + imagePacerOperations + videoPromptOperations;

  return {
    pricePerOperation,
    blueprintOperations,
    imagePromptOperations,
    imagePacerOperations,
    videoPromptOperations,
    totalOperations,
    blueprintPixels: blueprintOperations * pricePerOperation,
    imagePromptPixels: imagePromptOperations * pricePerOperation,
    imagePacerPixels: imagePacerOperations * pricePerOperation,
    videoPromptPixels: videoPromptOperations * pricePerOperation,
    totalPixels: totalOperations * pricePerOperation,
  };
};

/** Scene count used for the worked example when no story exists yet. */
export const EXAMPLE_SCENE_COUNT = 6;
