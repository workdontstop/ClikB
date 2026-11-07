/**
 * Selectable prompt-writing models.
 *
 * The tier is the only thing the browser is allowed to send. The real OpenAI
 * model ID and the flat pixel price live here and nowhere else, so a client
 * cannot ask for a cheaper price or an arbitrary model.
 *
 * Flat pricing: each logical prompt-writing operation has one tier-owned
 * charge. Initial image writing and image pacing are separate operations;
 * paired Cinema stages share one operation per pass.
 */

export type LanguageModelTier = "luna" | "luna_extra" | "terra" | "sol_medium" | "sol" | "astra" | "deepseek" | "kimi";

export type TextProvider = "openai" | "replicate";

export const LANGUAGE_MODEL_TIERS = {
  luna: { provider: "openai", model: "gpt-6-luna", pixels: 1 },
  luna_extra: { provider: "openai", model: "gpt-6-luna", pixels: 2 },
  terra: { provider: "openai", model: "gpt-6.1-terra", pixels: 5 },
  sol_medium: { provider: "openai", model: "gpt-6.1-sol", pixels: 5 },
  sol: { provider: "openai", model: "gpt-6.1-sol", pixels: 15 },
  astra: { provider: "openai", model: "gpt-6-astra", pixels: 20 },
  deepseek: { provider: "replicate", model: "deepseek-ai/deepseek-v3.1", pixels: 2 },
  kimi: { provider: "replicate", model: "moonshotai/kimi-k2.6", pixels: 4 },
} as const;

export const DEFAULT_LANGUAGE_MODEL_TIER: LanguageModelTier = "luna";

export const isLanguageModelTier = (
  value: unknown
): value is LanguageModelTier =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(LANGUAGE_MODEL_TIERS, value);

export const languageModelForTier = (tier: LanguageModelTier): string =>
  LANGUAGE_MODEL_TIERS[tier].model;

export const providerForLanguageModel = (model: string): TextProvider =>
  Object.values(LANGUAGE_MODEL_TIERS).find((entry) => entry.model === model)?.provider
  ?? (model.includes("/") ? "replicate" : "openai");

export const pixelsForTier = (tier: LanguageModelTier): number =>
  LANGUAGE_MODEL_TIERS[tier].pixels;

/** Astra is intentionally fixed to its least expensive supported reasoning level. */
export const reasoningEffortForLanguageModel = (
  model: string,
): "low" | undefined => model === LANGUAGE_MODEL_TIERS.astra.model ? "low" : undefined;
