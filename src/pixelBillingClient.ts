import axios from "axios";
import { store } from "./store";
import { setConversationModel, setLanguageModel, setPixels, showAiProviderNotice, showPixelChargeNotice } from "./settingsSlice";
import { captureCreationLedgerHeader } from "./CreationLedgerContext";
import { expectedMediaCharge } from "./mediaPricing";
import { MeteredReceiptState, MeteredWalletRefresh, isCurrentMeteredReceipt } from './meteredReceiptState';

let installed = false;
const AI_SESSION_HEADER = "X-ClikB-AI-Session";
const LLM_TIER_HEADER = "X-ClikB-LLM-Tier";
const ACTIVE_MEMBER_HEADER = "X-ClikB-Active-Member";
const aiPageSessionId = typeof globalThis.crypto?.randomUUID === "function"
  ? globalThis.crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const clikBaseUrl = String(import.meta.env.VITE_CLIK_URL || "").replace(/\/+$/, "");
const isClikRequest = (input: string): boolean => {
  if (!clikBaseUrl) return input.startsWith("/");
  return input === clikBaseUrl || input.startsWith(`${clikBaseUrl}/`);
};

const numericHeader = (headers: any, name: string): number | null => {
  const value = Number(headers?.[name] ?? headers?.[name.toLowerCase()]);
  return Number.isFinite(value) ? value : null;
};

const decodedHeader = (headers: any, name: string): string => {
  const value = String(headers?.[name] ?? headers?.[name.toLowerCase()] ?? "");
  try { return decodeURIComponent(value); } catch { return value; }
};

const meteredReceipts = new MeteredReceiptState({
  load: () => typeof window === 'undefined' ? null : window.localStorage.getItem('clikb.metered-receipt-ui.v1'),
  save: value => { if (typeof window !== 'undefined') window.localStorage.setItem('clikb.metered-receipt-ui.v1', value); },
});
const meteredWalletRefresh = new MeteredWalletRefresh(
  () => {
    const state = store.getState();
    const user = state.profile?.loggedUser?.ownerId || state.profile?.loggedUser?.id;
    return { userId: user == null ? null : String(user), revision: Number(state.settings.pixelsRevision) || 0 };
  },
  async userId => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${clikBaseUrl}/getPixels`, { method: 'POST', credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: { userid: userId } }) });
      if (!response.ok) throw new Error('Balance is unavailable');
      const data = await response.json();
      if (String(data.userid) !== userId) throw new Error('Balance belongs to another account');
      return Number(data.pixels);
    } finally { clearTimeout(timer); }
  },
  balance => store.dispatch(setPixels(balance)),
);
export const getConciergeMeteredReceiptCursor = (): number => {
  const user = store.getState().profile?.loggedUser;
  const userId = user?.ownerId || user?.id;
  return userId ? meteredReceipts.cursor(`concierge:${userId}:account`) : 0;
};

export const handleConciergeMeteredBillingEvent = (evt: any): void => {
  if (!evt || typeof evt !== "object") return;
  const user = store.getState().profile?.loggedUser;
  if (!isCurrentMeteredReceipt(evt, user?.ownerId || user?.id)) return;
  const delivery = meteredReceipts.accept(evt);
  // Receipt balances are historical. A fresh ordered read prevents a delayed
  // voice receipt from undoing a later media charge or top-up.
  if (delivery.fresh && !evt.pendingReconciliation && (evt.pixelsCharged > 0 || evt.zeroBalanceReached)) void meteredWalletRefresh.request();
  if (delivery.fresh && typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("clikb:concierge-metered-billing", { detail: evt }));
  }
};

/** Deliver unseen binary-transport receipts once, with one combined drawer notice. */
export const handleConciergeMeteredReceiptBatch = (payload: any): void => {
  const user = store.getState().profile?.loggedUser;
  if (payload && !isCurrentMeteredReceipt(payload, user?.ownerId || user?.id)) return;
  if (!payload || !Array.isArray(payload.receipts)) {
    if (payload?.meteredBilling) handleConciergeMeteredBillingEvent(payload.meteredBilling);
    return;
  }
  let pixelsCharged = 0;
  let notice: any = null;
  for (const receipt of payload.receipts) {
    const delivery = meteredReceipts.accept(receipt);
    if (delivery.fresh && receipt.pixelsCharged > 0) {
      pixelsCharged += Math.floor(receipt.pixelsCharged);
      notice = receipt;
    }
  }
  const last = payload.receipts[payload.receipts.length - 1];
  meteredReceipts.advance(payload.sessionKey || last?.sessionKey, Number(payload.latestReceiptSeq ?? last?.receiptSeq));
  if (notice && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clikb:concierge-metered-billing', {
    detail: { ...notice, receiptId: `batch:${notice.sessionKey}:${notice.receiptSeq}`, pixelsCharged },
  }));
  if (notice || payload.receipts.some((receipt: any) => receipt.zeroBalanceReached)) void meteredWalletRefresh.request();
};

export const captureAiProviderHeaders = (headers: any): void => {
  const available = String(headers?.["x-clikb-openai-available"] ?? headers?.get?.("x-clikb-openai-available") ?? "");
  const notice = decodedHeader(headers, "x-clikb-ai-notice")
    || (() => {
      const value = headers?.get?.("x-clikb-ai-notice") || "";
      try { return decodeURIComponent(value); } catch { return value; }
    })();
  let switchedToDeepSeek = false;
  if (available === "0") {
    const { languageModel, conversationModel } = store.getState().settings;
    const alreadyOnReplicate = (model: string) => model === "deepseek" || model === "kimi";

    // OpenAI being unavailable must never overwrite an explicit Replicate
    // choice. Only selectors that still point at an OpenAI model fall back.
    if (!alreadyOnReplicate(languageModel)) {
      // Do not overwrite visible Creation or Concierge selector state into an invisible fallback tier.
      switchedToDeepSeek = true;
    }
    if (!alreadyOnReplicate(conversationModel)) {
      switchedToDeepSeek = true;
    }
  }
  if (notice && (available !== "0" || switchedToDeepSeek)) {
    store.dispatch(showAiProviderNotice(notice));
  }
};

const labelForUrl = (url: string): { label: string; stage?: string } => {
  if (/startPlanVid/i.test(url)) return { label: "Video Plan", stage: "video_prompt" };
  if (/startPlan\b/i.test(url)) return { label: "Story Plan", stage: "plan" };
  if (/startMemes/i.test(url)) return { label: "Shorts Setup", stage: "plan" };
  if (/startStory/i.test(url)) return { label: "Story Setup", stage: "plan" };
  if (/startInteractions/i.test(url)) return { label: "Interaction Setup", stage: "plan" };
  if (/examplestory/i.test(url)) return { label: "AI Prompt Idea", stage: "plan" };
  if (/compile-global/i.test(url)) return { label: "Story Intent", stage: "intent" };
  if (/compile-scene/i.test(url)) return { label: "Scene Intent", stage: "intent" };
  if (/reconcile-scene/i.test(url)) return { label: "Intent Update", stage: "intent" };
  if (/ImageDesignStoryStage/i.test(url)) return { label: "Cinema Prompts", stage: "image_prompt" };
  if (/ImageDesignStory/i.test(url)) return { label: "Image Prompt", stage: "image_prompt" };
  if (/GptVideoVisualMiniMax/i.test(url)) return { label: "MiniMax Prompt", stage: "video_prompt" };
  if (/VideoDesign/i.test(url)) return { label: "Video Prompt", stage: "video_prompt" };
  if (/spatial-motion-context\/refine/i.test(url)) return { label: "Motion Refine", stage: "video_prompt" };
  if (/spatial-motion-context/i.test(url)) return { label: "Motion Context", stage: "video_prompt" };
  if (/motion-guide/i.test(url)) return { label: "Motion Guide", stage: "motion_guide" };
  return { label: "AI Prompt" };
};

// These routes only transport an existing server-owned build. Authentication,
// balance verification and final billing remain enforced by its security lease.
export const isLiveSceneTransport = (url: string): boolean => {
  try { return /^\/scene-live\/(?:events|recent|pause|stop)$/.test(new URL(url, clikBaseUrl || 'http://localhost').pathname); }
  catch { return false; }
};

export const installPixelBillingInterceptor = (): void => {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    if (!isClikRequest(String(config.url || ""))) return config;
    const expected = isLiveSceneTransport(String(config.url || "")) ? null
      : expectedMediaCharge(String(config.url || ""), config.data);
    if (expected) {
      const balance = Number(store.getState().settings.pixels) || 0;
      if (balance < expected.pixels) {
        const message = `Not enough pixels. ${expected.label} needs ${expected.pixels} P and you have ${balance} P.`;
        store.dispatch(showAiProviderNotice(message));
        const error: any = new Error(message);
        error.code = "ERR_INSUFFICIENT_PIXELS";
        error.response = {
          status: 402,
          data: { message, pixels: balance, required: expected.pixels },
          headers: {},
          config,
        };
        return Promise.reject(error);
      }
    }
    config.withCredentials = true;
    const active = store.getState().profile.loggedUser?.id;
    if (typeof (config.headers as any)?.set === "function") {
      (config.headers as any).set(AI_SESSION_HEADER, aiPageSessionId);
      (config.headers as any).set(LLM_TIER_HEADER, store.getState().settings.languageModel);
      if (active) (config.headers as any).set(ACTIVE_MEMBER_HEADER, String(active));
    } else {
      config.headers = {
        ...(config.headers as any),
        [AI_SESSION_HEADER]: aiPageSessionId,
        [LLM_TIER_HEADER]: store.getState().settings.languageModel,
        ...(active ? { [ACTIVE_MEMBER_HEADER]: String(active) } : {}),
      } as any;
    }
    return config;
  });

  // Native fetch does not use Axios interceptors. Route only ClikB API calls
  // through the same page-session identity and consume the same notice headers.
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (!isClikRequest(requestUrl)) return originalFetch(input, init);

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      headers.set(AI_SESSION_HEADER, aiPageSessionId);
      headers.set(LLM_TIER_HEADER, store.getState().settings.languageModel);
      const active = store.getState().profile.loggedUser?.id;
      if (active && !headers.has(ACTIVE_MEMBER_HEADER)) headers.set(ACTIVE_MEMBER_HEADER, String(active));
      const response = await originalFetch(input, { ...init, headers, credentials: "include" });
      captureAiProviderHeaders(response.headers);
      return response;
    }) as typeof window.fetch;
  }

  axios.interceptors.response.use(
    (response) => {
      captureAiProviderHeaders(response.headers);
      captureCreationLedgerHeader(response.headers);
      const headerCharge = numericHeader(response.headers, "x-clikb-pixels-charged");
      const headerBalance = numericHeader(response.headers, "x-clikb-pixels-balance");
      const bodyBilling = response.data?.llmBilling ?? response.data?.billing;
      const pixelsCharged = headerCharge ?? (
        Number.isFinite(Number(bodyBilling?.pixelsCharged))
          ? Number(bodyBilling.pixelsCharged)
          : null
      );
      const balance = headerBalance ?? (
        Number.isFinite(Number(bodyBilling?.pixels)) ? Number(bodyBilling.pixels) : null
      );

      if (balance !== null) store.dispatch(setPixels(balance));
      if (pixelsCharged !== null && pixelsCharged > 0) {
        const fallback = labelForUrl(String(response.config?.url || ""));
        store.dispatch(showPixelChargeNotice({
          pixels: pixelsCharged,
          label: decodedHeader(response.headers, "x-clikb-billing-label") || fallback.label,
          stage: decodedHeader(response.headers, "x-clikb-billing-stage") || fallback.stage,
        }));
      }
      return response;
    },
    (error) => {
      captureAiProviderHeaders(error?.response?.headers);
      captureCreationLedgerHeader(error?.response?.headers);
      const balance = numericHeader(error?.response?.headers, "x-clikb-pixels-balance")
        ?? Number(error?.response?.data?.pixels);
      if (Number.isFinite(balance)) store.dispatch(setPixels(balance));
      return Promise.reject(error);
    },
  );

};
