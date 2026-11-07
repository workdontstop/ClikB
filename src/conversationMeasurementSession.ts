import { CONVERSATION_PROFILE_POLICY_VERSION } from "./conversationModels";

const STORAGE_KEY = "clikb.conversationMeasurementSession.v1";
const OWNER_STORAGE_KEY = "clikb.conversationMeasurementSessionOwner.v1";

const createId = (): string => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `conversation-${random}`;
};

export const getConversationMeasurementSessionId = (): string => {
  if (typeof window === "undefined") return "server-render";
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = createId();
    window.sessionStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return createId();
  }
};

export const conversationMeasurementHeaders = (): Record<string, string> => ({
  "X-ClikB-Conversation-Session": getConversationMeasurementSessionId(),
  "X-ClikB-Billing-Policy": CONVERSATION_PROFILE_POLICY_VERSION,
});

export const resetConversationMeasurementSessionId = (): string => {
  const created = createId();
  try { window.sessionStorage.setItem(STORAGE_KEY, created); } catch { /* session state is best effort */ }
  return created;
};

export const syncConversationMeasurementSessionOwner = (ownerId: number | string | null | undefined): string => {
  const normalized = ownerId !== null && ownerId !== undefined && String(ownerId).trim() !== ""
    ? String(ownerId).trim()
    : "guest";
  if (typeof window === "undefined") return "server-render";
  try {
    const previousOwner = window.sessionStorage.getItem(OWNER_STORAGE_KEY);
    if (previousOwner && previousOwner !== normalized) {
      window.sessionStorage.setItem(OWNER_STORAGE_KEY, normalized);
      return resetConversationMeasurementSessionId();
    }
    window.sessionStorage.setItem(OWNER_STORAGE_KEY, normalized);
  } catch {
    /* session state is best effort */
  }
  return getConversationMeasurementSessionId();
};

if (typeof window !== "undefined") {
  (window as any).__clikbConversationMeasurement = {
    sessionId: getConversationMeasurementSessionId,
    resetSessionId: resetConversationMeasurementSessionId,
  };
}
