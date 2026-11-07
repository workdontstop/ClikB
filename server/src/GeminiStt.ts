import type { Server as HttpServer, IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, TurnCoverage } from "@google/genai";
import { authenticatedOwnerId, authenticatedUserId } from "./requestAuth";
import { activeCreativeProfileIsOwned } from './CreativeProfileRoutes';
import { LIVE_STT_MODEL } from "./GeminiLive";
import {
  accumulateMeteredUsage, buildMeteredSessionKey, checkMeteredZeroBalanceGuard,
  getRememberedSessionConversationProfile, rememberSessionConversationProfile,
  settleMeteredSession, verifyConversationSessionOwnership, METERED_SETTLEMENT_INTERVAL_MS,
} from "./aiUsageLedger";
import {
  CONVERSATION_PROFILE_POLICY_VERSION, extractConversationPolicyVersion,
  isPaidConversationProfile, resolveAdmittedConversationProfile, resolveConversationProfile,
} from "./conversationModels";
import { appendConversationMeasurement } from "./conversationMeasurementLedger";

export const GEMINI_STT_WS_PATH = "/geminiSttStream";
const PRICING_SOURCE = "https://ai.google.dev/gemini-api/docs/pricing";
// Gemini 3.1 Flash Live standard rates, per 1M tokens (verified 2026-10-28).
const INPUT_RATES: Record<string, number> = { TEXT: 0.75, AUDIO: 3, IMAGE: 1, VIDEO: 1 };
const OUTPUT_RATES: Record<string, number> = { TEXT: 4.5, AUDIO: 12 };

/** Incomplete/unsupported usage is pending, never inferred from client bytes. */
export function priceGeminiSttUsage(usage: any): number | null {
  if (!usage || Number(usage.cachedContentTokenCount || 0) !== 0 || Number(usage.toolUsePromptTokenCount || 0) !== 0
      || Number(usage.thoughtsTokenCount || 0) !== 0) return null;
  const price = (details: any, total: unknown, rates: Record<string, number>) => {
    if (!Number.isInteger(total) || Number(total) < 0) return null;
    if (Number(total) === 0 && (details === undefined || Array.isArray(details) && details.length === 0)) return 0;
    if (!Array.isArray(details)) return null;
    let tokens = 0, cost = 0;
    for (const detail of details) {
      const count = Number(detail.tokenCount), rate = rates[String(detail.modality).toUpperCase()];
      if (!Number.isInteger(count) || count < 0 || rate === undefined) return null;
      tokens += count; cost += count * rate / 1_000_000;
    }
    return tokens === Number(total) ? cost : null;
  };
  const input = price(usage.promptTokensDetails, usage.promptTokenCount, INPUT_RATES);
  const output = price(usage.responseTokensDetails, usage.responseTokenCount, OUTPUT_RATES);
  return input === null || output === null ? null : input + output;
}

type GeminiTransport = { sendRealtimeInput: (input: any) => void; close: () => void };
type Connect = (config: any) => Promise<GeminiTransport>;
export type GeminiSttProxyOptions = { connect?: Connect; settlementIntervalMs?: number; walletId?: string };

export function proxyToGemini(client: WebSocket, requestUrl: string, userId: string, options: GeminiSttProxyOptions = {}) {
  const url = new URL(requestUrl, "http://localhost");
  const sessionId = (url.searchParams.get("measurementSessionId") || "default").slice(0, 120);
  const requestedTier = url.searchParams.get("conversationModel") || "luna";
  const admitted = resolveAdmittedConversationProfile(requestedTier, { policyVersion: url.searchParams.get("billingPolicyVersion") });
  let tier = admitted?.tier || "luna";
  const id = `gemini-stt:${randomUUID()}`, startedAt = Date.now();
  const walletId = options.walletId || userId;
  const sessionKey = walletId ? buildMeteredSessionKey("concierge", walletId, "account") : "";
  const calls: any[] = [];
  let closed = false, sliceNumber = 0, queued = 0, bytes = 0;
  let inputTail = Promise.resolve(), usageTail = Promise.resolve();
  type Slice = { tier: string; index: number; billable: boolean; transport: GeminiTransport | null;
    maxCost: number; sawUsage: boolean; acceptedBytes: number; retire: boolean };
  let active: Slice | null = null;
  const send = (event: any) => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event)); };
  const pending = (message: string) => send({ type: "metered_billing", pixelsCharged: 0,
    pendingReconciliation: true, source: "voice", message });
  const settle = async (profile: string) => {
    if (!userId) return;
    const receipt = await settleMeteredSession({ sessionKey, userId: walletId, workload: "voice", profile, model: LIVE_STT_MODEL });
    if (receipt && (receipt.pixelsCharged || receipt.zeroBalanceReached || receipt.pendingReconciliation))
      send({ type: "metered_billing", ...receipt, exhausted: receipt.zeroBalanceReached, source: "voice" });
    if (receipt?.zeroBalanceReached && isPaidConversationProfile(tier)) void shutdown("zero-balance");
  };
  const retire = (slice: Slice) => {
    if (slice.retire) return;
    slice.retire = true;
    if (active === slice) active = null;
    try { slice.transport?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* Provider already closed. */ }
    // One upstream connection per transcribed turn avoids charging repeated
    // cumulative Live context as if it were a new usage event after each turn.
    const closeTimer = setTimeout(() => { try { slice.transport?.close(); } catch { /* closed */ } }, 250);
    closeTimer.unref?.();
    if (slice.billable && slice.acceptedBytes && !slice.sawUsage) pending("Voice provider usage is not yet available; no estimated charge was applied.");
  };
  const shutdown = async (reason: string) => {
    if (closed) return;
    closed = true; clearInterval(timer);
    if (active) { const slice = active; retire(slice); try { slice.transport?.close(); } catch { /* closed */ } }
    await usageTail;
    if (userId) await settle(tier).catch(() => pending("Voice usage settlement is pending."));
    const completed = Date.now();
    appendConversationMeasurement({ sessionId, requestId: id, route: GEMINI_STT_WS_PATH, stage: "transcription",
      actionLabel: "Server Gemini Speech Recognition", status: reason.includes("error") ? "failed" : "succeeded",
      startedAt: new Date(startedAt).toISOString(), completedAt: new Date(completed).toISOString(), elapsedMs: completed - startedAt,
      calls, events: [{ name: "voice.gemini_proxy_closed", at: new Date(completed).toISOString(), elapsedMs: completed - startedAt,
        detail: { reason, acceptedPcmBytes: bytes } }] });
    try { client.close(); } catch { /* closed */ }
  };
  const guard = async (nextTier: string) => {
    if (!isPaidConversationProfile(nextTier)) return true;
    if (!userId) { send({ type: "error", code: "AUTH_REQUIRED", message: "Please sign in again." }); await shutdown("authentication-error"); return false; }
    const balance = await checkMeteredZeroBalanceGuard(walletId, 1);
    if (!balance.allowed) {
      send({ type: "metered_billing", pixelsCharged: 0, remainingPixels: balance.balance,
        zeroBalanceReached: true, exhausted: true, source: "voice" });
      await shutdown("zero-balance"); return false;
    }
    return true;
  };
  const connect: Connect = options.connect || (config => {
    const key = process.env.GOOGLE_LIVE_KEY;
    if (!key) throw new Error("GOOGLE_LIVE_KEY is not configured");
    return new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } }).live.connect(config);
  });
  const open = async (): Promise<Slice | null> => {
    if (!await guard(tier) || closed) return null;
    const slice: Slice = { tier, index: ++sliceNumber, billable: isPaidConversationProfile(tier),
      transport: null, maxCost: 0, sawUsage: false, acceptedBytes: 0, retire: false };
    active = slice;
    slice.transport = await connect({ model: LIVE_STT_MODEL,
      callbacks: {
        onmessage: (message: any) => {
          if (message.usageMetadata) {
            const cost = priceGeminiSttUsage(message.usageMetadata);
            if (cost === null) { if (slice.billable) pending("Provider usage is incomplete; no estimated voice charge was applied."); }
            else if (cost > slice.maxCost) {
              const delta = cost - slice.maxCost;
              slice.maxCost = cost; slice.sawUsage = true;
              calls.push({ provider: "google", model: LIVE_STT_MODEL,
                inputTokens: message.usageMetadata.promptTokenCount, cachedInputTokens: 0,
                outputTokens: message.usageMetadata.responseTokenCount, toolCalls: 0, searchCalls: 0,
                providerCostUsd: delta, pricingSource: PRICING_SOURCE, usageQuality: "reported",
                metadata: { source: "server-proxy", tier: slice.tier, billableToUser: slice.billable } });
              if (slice.billable) {
                const event = { sessionKey, userId: walletId, workload: "voice" as const, profile: slice.tier, model: LIVE_STT_MODEL,
                  eventId: `${id}:slice:${slice.index}:cost:${cost.toFixed(12)}`, providerCostUsd: delta, billableToUser: true };
                usageTail = usageTail.then(async () => {
                  await accumulateMeteredUsage(event);
                  await settle(slice.tier);
                }).catch(() => {
                  pending("Voice accounting is pending; the completed transcription is preserved.");
                  // The SQL failure hook retained this immutable usage event.
                  void shutdown("usage-persistence-pending");
                });
              }
            }
          }
          // Browser receives transcription only; it cannot submit provider usage.
          if (message.serverContent || message.setupComplete) send({ type: "gemini_message", message });
          if (message.serverContent?.turnComplete) retire(slice);
        },
        onerror: (error: any) => {
          if (slice.retire || closed) return;
          send({ type: "error", message: String(error?.message || "Gemini voice error") }); void shutdown("provider-error");
        },
        onclose: () => { if (!slice.retire && !closed) void shutdown("provider-close"); },
      },
      config: { responseModalities: [Modality.AUDIO], maxOutputTokens: 1, inputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW, prefixPaddingMs: 220, silenceDurationMs: 1300 },
          turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY },
        systemInstruction: "You are ClikB voice input only. Your job is to transcribe microphone speech for the app. Do not answer questions, do not brainstorm, and do not give advice. If you produce any text response, it will be ignored; only input transcription matters.",
      } });
    if (closed || slice.retire) { slice.transport.close(); return null; }
    return slice;
  };
  const switchTier = async (requested: string, policyVersion?: string) => {
    if (isPaidConversationProfile(requested) && !userId) { await guard(requested); return; }
    const next = resolveAdmittedConversationProfile(requested, { policyVersion })?.tier || "luna";
    if (next === tier) return;
    if (!await guard(next)) return;
    if (active) retire(active);
    await usageTail;
    tier = next;
    if (userId) rememberSessionConversationProfile(sessionId, tier, userId);
  };
  const enqueue = (work: () => Promise<void>) => {
    if (closed) return;
    if (++queued > 400) { void shutdown("input-backpressure"); return; }
    inputTail = inputTail.then(async () => { if (!closed) await work(); })
      .catch((error: any) => { send({ type: "error", message: String(error?.message || "Voice connection failed") }); void shutdown("proxy-error"); })
      .finally(() => { queued -= 1; });
  };
  const timer = setInterval(() => enqueue(async () => {
    const remembered = getRememberedSessionConversationProfile(sessionId, userId || undefined);
    if (remembered && remembered !== tier) await switchTier(remembered, CONVERSATION_PROFILE_POLICY_VERSION);
    await usageTail;
    await settle(tier);
    await guard(tier);
  }), options.settlementIntervalMs || METERED_SETTLEMENT_INTERVAL_MS);
  timer.unref?.();
  client.on("message", (data, binary) => enqueue(async () => {
    if (!binary) {
      let event: any; try { event = JSON.parse(data.toString()); } catch { return; }
      if (event?.type === "clikb.tier") await switchTier(String(event.conversationModel || "luna"), event.billingPolicyVersion);
      return;
    }
    const remembered = getRememberedSessionConversationProfile(sessionId, userId || undefined);
    if (remembered && remembered !== tier) await switchTier(remembered, CONVERSATION_PROFILE_POLICY_VERSION);
    if (closed) return;
    const slice = active || await open();
    if (!slice || !slice.transport || closed) return;
    const audio = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
    slice.transport.sendRealtimeInput({ audio: { data: audio.toString("base64"), mimeType: "audio/pcm;rate=16000" } });
    bytes += audio.length; slice.acceptedBytes += audio.length;
  }));
  client.on("close", () => { void shutdown("client-close"); });
  client.on("error", () => { void shutdown("client-error"); });
  enqueue(async () => { await open(); send({ type: "gemini_ready" }); });
}

export function attachGeminiSttProxy(server: HttpServer, options?: GeminiSttProxyOptions) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (req.url?.split("?")[0] !== GEMINI_STT_WS_PATH) return;
    const url = new URL(req.url || "/", "http://localhost");
    const scope = (url.searchParams.get("measurementSessionId") || "default").slice(0, 120);
    const userId = authenticatedUserId(req) || "";
    const walletId = authenticatedOwnerId(req) || userId;
    const reject = (status: string) => { socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if (userId && !verifyConversationSessionOwnership(scope, userId)) { reject("403 Forbidden"); return; }
    const rawTier = url.searchParams.get("conversationModel") || getRememberedSessionConversationProfile(scope, userId || undefined) || "luna";
    if (!userId && isPaidConversationProfile(rawTier)) { reject("401 Unauthorized"); return; }
    const profile = resolveAdmittedConversationProfile(rawTier, { policyVersion: url.searchParams.get("billingPolicyVersion") || extractConversationPolicyVersion(req) })
      || resolveConversationProfile("luna")!;
    void (async () => {
      if (userId && !await activeCreativeProfileIsOwned(userId, walletId)) { reject("403 Forbidden"); return; }
      if (isPaidConversationProfile(profile.tier) && !(await checkMeteredZeroBalanceGuard(walletId, 1)).allowed) { reject("402 Payment Required"); return; }
      if (userId) rememberSessionConversationProfile(scope, profile.tier, userId);
      url.searchParams.set("conversationModel", profile.tier);
      url.searchParams.set("billingPolicyVersion", CONVERSATION_PROFILE_POLICY_VERSION);
      wss.handleUpgrade(req, socket, head, client => proxyToGemini(client, url.pathname + url.search, userId, { ...options, walletId }));
    })().catch(() => reject("503 Service Unavailable"));
  });
}
