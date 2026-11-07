import lunaPortrait from "./assets/language-models/luna-conversation-medium-v3.webp";
import lunaTeenPortrait from "./assets/language-models/luna-conversation-teen-v2.webp";
import terraPortrait from "./assets/language-models/terra-conversation-robot-portrait-v2.webp";
import solPortrait from "./assets/language-models/sol-conversation-flame-teen-v2.webp";

/**
 * Models used by Brainstorm, Guide, and the other conversational surfaces.
 *
 * The browser sends only this small tier key. The server owns the corresponding
 * OpenAI model IDs so a request cannot select an arbitrary provider model.
 */
export const CONVERSATION_PROFILE_POLICY_VERSION = "2026-10-27.v2";

export type ConversationModelTier =
  | "luna_none"
  | "luna"
  | "luna_xhigh"
  | "terra"
  | "sol_low"
  | "luna_max"
  | "sol"
  | "deepseek"
  | "kimi";

export type ConversationModelInfo = {
  id: ConversationModelTier;
  name: string;
  image: string;
  summary: string;
  provider?: "openai";
  reasoningEffort?: "none" | "low" | "medium" | "max";
  billingMode?: "free" | "metered";
};

export const CONVERSATION_MODELS: ConversationModelInfo[] = [
  {
    id: "luna_none",
    name: "Luna · None",
    image: lunaPortrait,
    summary: "Free · Instant Control",
    provider: "openai",
    reasoningEffort: "none",
    billingMode: "free",
  },
  {
    id: "luna",
    name: "Luna · Low",
    image: lunaPortrait,
    summary: "Free · Smart Control",
    provider: "openai",
    reasoningEffort: "low",
    billingMode: "free",
  },
  {
    id: "luna_xhigh",
    name: "Luna · Medium",
    image: lunaTeenPortrait,
    summary: "Metered · Deep Chat",
    provider: "openai",
    reasoningEffort: "medium",
    billingMode: "metered",
  },
  {
    id: "terra",
    name: "Terra · Low",
    image: terraPortrait,
    summary: "Metered · Story Creator",
    provider: "openai",
    reasoningEffort: "low",
    billingMode: "metered",
  },
];

export const DEFAULT_CONVERSATION_MODEL: ConversationModelTier = "luna";

export const isOpenAiConversationProfile = (tier: string): boolean =>
  CONVERSATION_MODELS.some((model) => model.id === tier && model.provider === "openai") ||
  tier === "luna_max" ||
  tier === "sol";

export const isPaidConversationTier = (tier: string): boolean => {
  const found = CONVERSATION_MODELS.find((model) => model.id === tier);
  if (found) return found.billingMode === "metered";
  return tier === "luna_max" || tier === "sol" || tier === "sol_low";
};

export const migrateSavedConversationModel = (
  rawTier: unknown,
  policyVersion?: unknown,
): ConversationModelTier => {
  const found = typeof rawTier === "string"
    ? CONVERSATION_MODELS.find((model) => model.id === rawTier)
    : undefined;
  if (!found) return DEFAULT_CONVERSATION_MODEL;
  if (policyVersion !== CONVERSATION_PROFILE_POLICY_VERSION && found.billingMode === "metered") {
    return DEFAULT_CONVERSATION_MODEL;
  }
  return found.id;
};
