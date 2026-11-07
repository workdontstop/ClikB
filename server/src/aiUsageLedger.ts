import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { addPixelsToUser, getPixelsForUser, trySpendPixels } from "./db";
import { authenticatedOwnerId } from "./requestAuth";
import {
  appendConversationMeasurement,
  CONVERSATION_MEASUREMENT_HEADER,
  type ConversationMeasurementEvent,
} from "./conversationMeasurementLedger";
export * from "./meteredUsageBilling";

export const PIXEL_USD = 1 / 333;

export type UsageStage =
  | "plan"
  | "intent"
  | "image_prompt"
  | "image_prompt_pacer"
  | "video_prompt"
  | "ai_edit"
  | "conversation"
  | "transcription"
  | "motion_guide"
  | "image_generation"
  | "video_generation"
  | "other";

type Stage = UsageStage;
export type UsageDescriptor = { stage: Stage; actionLabel: string };

type ProviderUsage = {
  provider: string;
  model: string;
  attemptNumber: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  toolCalls: number;
  searchCalls: number;
  providerCostUsd: number;
  rawPixels: number;
  inputAudioTokens?: number;
  outputAudioTokens?: number;
  durationSeconds?: number;
  pricingSource?: string;
  usageQuality?: "reported" | "estimated" | "mixed";
  metadata?: Record<string, unknown>;
};

type UsageContext = UsageDescriptor & {
  requestId: string;
  measurementSessionId: string | null;
  startedAtMs: number;
  userId: string | null;
  route: string;
  calls: ProviderUsage[];
  events: ConversationMeasurementEvent[];
  pixelsCharged: number;
  billingSource: string;
  operations: UsageSummary[];
  pixelsBalance?: number;
  refundPending?: boolean;
};

export type UsageSummary = UsageDescriptor & {
  requestId: string;
  route: string;
  status: "failed" | "succeeded";
  pixelsCharged: number;
  billingSource: string;
  createdAt: string;
  elapsedMs: number;
  calls: ProviderUsage[];
  /** A previously completed operation, included for ledger recovery, not a new deduction. */
  replayed?: boolean;
  /** True when a failed request's upfront hold could not be refunded automatically. */
  refundPending?: boolean;
};

const usageStorage = new AsyncLocalStorage<UsageContext>();

/** Raw provider cost only, in pixels. Callers choose the final integer rounding. */
export const providerUsageCursor = (): number => usageStorage.getStore()?.calls.length || 0;
export const providerPixelsSince = (cursor: number): number | null => {
  const calls = usageStorage.getStore()?.calls.slice(cursor);
  if (!calls?.length) return null;
  return calls.reduce((total, call) => total + Math.max(0, call.rawPixels), 0);
};
export const billableProviderCallsSince = (cursor: number): ProviderUsage[] => {
  const calls = usageStorage.getStore()?.calls.slice(cursor) || [];
  return calls.filter((call) => call.metadata?.billableToUser !== false);
};
export const billableProviderPixelsSince = (cursor: number): number => {
  const calls = billableProviderCallsSince(cursor);
  if (!calls.length) return 0;
  return calls.reduce((total, call) => total + Math.max(0, call.rawPixels), 0);
};
export const currentUsageRequestId = (): string | null => usageStorage.getStore()?.requestId || null;
export const currentUsageUserId = (): string | null => usageStorage.getStore()?.userId || null;
export const currentMeasurementSessionId = (): string | null => usageStorage.getStore()?.measurementSessionId || null;

const summarizeUsage = (context: UsageContext, succeeded: boolean): UsageSummary => ({
  requestId: context.requestId,
  stage: context.stage,
  actionLabel: context.actionLabel,
  route: context.route,
  status: succeeded ? "succeeded" : "failed",
  pixelsCharged: context.pixelsCharged,
  billingSource: context.billingSource,
  createdAt: new Date().toISOString(),
  elapsedMs: Date.now() - context.startedAtMs,
  calls: context.calls.slice(0, 12),
});

/** Isolate a logical operation's provider measurements and deduction within one HTTP request. */
export const runUsageOperation = async <T>(
  descriptor: UsageDescriptor,
  work: () => Promise<T>,
  options: { requestId?: string; onComplete?: (summary: UsageSummary) => void } = {},
): Promise<T> => {
  const parent = usageStorage.getStore();
  const context: UsageContext = {
    requestId: options.requestId || randomUUID(),
    measurementSessionId: parent?.measurementSessionId || null,
    startedAtMs: Date.now(),
    userId: parent?.userId || null,
    route: parent?.route || "internal",
    ...descriptor,
    calls: [], events: [], pixelsCharged: 0, billingSource: "provider-usage", operations: [],
  };
  let succeeded = false;
  try {
    const value = await usageStorage.run(context, work);
    succeeded = true;
    return value;
  } finally {
    const summary = summarizeUsage(context, succeeded);
    if (parent) {
      parent.operations.push(summary, ...context.operations);
      if (context.pixelsBalance !== undefined) parent.pixelsBalance = context.pixelsBalance;
    }
    options.onComplete?.(summary);
  }
};

/** Restore a successful operation's same ledger identity without recording its charge twice. */
export const replayUsageOperation = (summary: UsageSummary): void => {
  const context = usageStorage.getStore();
  if (context && !context.operations.some(entry => entry.requestId === summary.requestId)) {
    context.operations.push({ ...summary, replayed: true });
  }
};

export const recordUsagePixelBalance = (balance: number): void => {
  const context = usageStorage.getStore();
  if (context && Number.isFinite(balance)) context.pixelsBalance = balance;
};

export type ModelPricePerMillion = {
  input: number;
  cached: number;
  cacheWrite30m?: number;
  output: number;
};

const MODEL_PRICES_USD_PER_MILLION: Record<string, ModelPricePerMillion> = {
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, output: 1.2 },
  "gpt-5.6-terra": { input: 2, cached: 0.2, output: 12 },
  "gpt-5.6-sol": { input: 4, cached: 0.4, output: 20 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, cacheWrite30m: 0.125, output: 0.5 },
  "gpt-6.1-terra": { input: 1, cached: 0.05, cacheWrite30m: 1.25, output: 5 },
  "gpt-6-sol": { input: 2, cached: 0.2, output: 10 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, cacheWrite30m: 2.5, output: 10 },
  "gpt-5.5": { input: 5, cached: 0.5, output: 30 },
  "gpt-5.2": { input: 1.75, cached: 0.175, output: 14 },
  "gpt-5.1": { input: 1.25, cached: 0.125, output: 10 },
  "gpt-4o": { input: 2.5, cached: 1.25, output: 10 },
  "gpt-4.1-mini": { input: 0.4, cached: 0.1, output: 1.6 },
  "gpt-6-astra": { input: 10, cached: 1, output: 50 },
  "text-embedding-3-small": { input: 0.02, cached: 0, output: 0 },
  "deepseek-ai/deepseek-v3.1": { input: 0.672, cached: 0, output: 2.016 },
  "moonshotai/kimi-k2.6": { input: 0.95, cached: 0, output: 4 },
  "qwen/qwen3-7-plus": { input: 0.276, cached: 0, output: 1.101 },
  "openai/gpt-5.1": { input: 1.25, cached: 0, output: 10 },
  "openai/gpt-5.2": { input: 1.75, cached: 0, output: 14 },
  "openai/gpt-5.4": { input: 2.5, cached: 0, output: 15 },
  "openai/gpt-4.1-mini": { input: 0.4, cached: 0, output: 1.6 },
  "openai/gpt-oss-20b": { input: 0.09, cached: 0, output: 0.36 },
};

export const hasConfiguredModelPrice = (model: string): boolean =>
  typeof model === "string" && Object.prototype.hasOwnProperty.call(MODEL_PRICES_USD_PER_MILLION, model);

export const getModelPricePerMillion = (model: string): ModelPricePerMillion | null =>
  hasConfiguredModelPrice(model) ? MODEL_PRICES_USD_PER_MILLION[model] : null;

const descriptorForRoute = (route: string, req?: Request): UsageDescriptor => {
  const normalized = route.toLowerCase();
  if (normalized === "/startplan") return { stage: "plan", actionLabel: "Story Plan" };
  if (normalized === "/startmemes") return { stage: "plan", actionLabel: "Shorts Setup" };
  if (normalized === "/startstory") return { stage: "plan", actionLabel: "Story Setup" };
  if (normalized === "/startinteractions") return { stage: "plan", actionLabel: "Interaction Setup" };
  if (normalized === "/examplestory") return { stage: "plan", actionLabel: "AI Prompt Idea" };
  if (normalized === "/generate-world-remix") return { stage: "plan", actionLabel: "World Remix Plan" };
  if (normalized === "/extractcasting") {
    return { stage: "plan", actionLabel: req?.body?.auditOnly === true ? "Cast Audit" : "Cast Search" };
  }
  if (normalized === "/generatecastingprompts") return { stage: "plan", actionLabel: "Reference Prompts" };
  if (normalized === "/intent-blueprint/compile-global") return { stage: "intent", actionLabel: "Story Intent" };
  if (normalized === "/intent-blueprint/compile-scene") return { stage: "intent", actionLabel: "Scene Intent" };
  if (normalized === "/intent-blueprint/reconcile-scene") return { stage: "intent", actionLabel: "Intent Update" };
  if (normalized === "/imagedesignstorystage") {
    return { stage: "image_prompt", actionLabel: req?.body?.isBShotPrompt === true ? "B-Shot Image Prompt" : "Cinema Prompts" };
  }
  if (normalized === "/imagedesignstory") return { stage: "image_prompt", actionLabel: "Image Prompt" };
  if (normalized === "/gpttagger") return { stage: "image_prompt", actionLabel: "Prompt Analysis" };
  if (normalized === "/chatgptapidesign4") return { stage: "image_prompt", actionLabel: "Image Design Prompt" };
  if (normalized === "/gptartstyleprompt") return { stage: "image_prompt", actionLabel: "Art Style Prompt" };
  if (normalized === "/gptvideovisualminimax") return { stage: "video_prompt", actionLabel: "MiniMax Prompt" };
  if (normalized === "/videodesign") return { stage: "video_prompt", actionLabel: "Video Prompt" };
  if (normalized === "/startplanvid") return { stage: "video_prompt", actionLabel: "Video Plan" };
  if (normalized === "/spatial-motion-context/compile") return { stage: "video_prompt", actionLabel: "Motion Context" };
  if (normalized === "/spatial-motion-context/refine-from-frame") return { stage: "video_prompt", actionLabel: "Motion Refine" };
  if (normalized === "/motion-guide/build") return { stage: "motion_guide", actionLabel: "Motion Guide" };
  if (normalized === "/editgeneratedvisualtextonly") return { stage: "ai_edit", actionLabel: "Visual Text Update" };
  if (normalized === "/gptremake") return { stage: "ai_edit", actionLabel: "Prompt Remake" };
  if (normalized === "/gptremakesafe") return { stage: "ai_edit", actionLabel: "Safe Remake" };
  if (normalized === "/gptremaketext") return { stage: "ai_edit", actionLabel: "Text Remake" };
  if (normalized === "/narratesummary") return { stage: "ai_edit", actionLabel: "Narration Prompt" };
  if (normalized === "/summary") return { stage: "ai_edit", actionLabel: "Title" };
  if (normalized === "/chatgptapiaudio") return { stage: "ai_edit", actionLabel: "Audio Instructions" };
  if (normalized === "/gptlipsyncaudioinstructions") return { stage: "transcription", actionLabel: "Lip-Sync Prep" };
  if (normalized === "/voicettsstream") return { stage: "conversation", actionLabel: "Conversation Voice Playback" };
  if (/^\/(startbrainstorm|memory\/)/.test(normalized)) return { stage: "conversation", actionLabel: "Conversation" };
  return { stage: "other", actionLabel: "AI Support" };
};

const countOutputItems = (response: any, type: string): number =>
  Array.isArray(response?.output)
    ? response.output.filter((item: any) => item?.type === type).length
    : 0;

export const recordOpenAiUsage = (
  model: string,
  response: any,
  metadata: Record<string, unknown> = {},
): void => {
  if (response?._clikbProvider === "replicate" || String(response?.model || model).includes("/")) return;
  const context = usageStorage.getStore();
  if (!context) return;

  const usage = response?.usage ?? {};
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0;
  const cachedInputTokens = Number(
    usage.input_tokens_details?.cached_tokens
      ?? usage.prompt_tokens_details?.cached_tokens
      ?? 0,
  ) || 0;
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0;
  const cacheWriteTokens = Number(
    usage.input_tokens_details?.cache_write_tokens
      ?? usage.prompt_tokens_details?.cache_write_tokens
      ?? usage.input_tokens_details?.cache_creation_input_tokens
      ?? 0,
  ) || 0;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens - cacheWriteTokens);
  const searchCalls = countOutputItems(response, "web_search_call");
  const toolCalls = searchCalls + countOutputItems(response, "file_search_call") + countOutputItems(response, "function_call");
  const hasPrice = hasConfiguredModelPrice(model);
  const price = MODEL_PRICES_USD_PER_MILLION[model] ?? { input: 0, cached: 0, cacheWrite30m: 0, output: 0 };
  const cacheWriteRate = price.cacheWrite30m ?? price.input;
  const tokenCost = (
    uncachedInputTokens * price.input
    + cachedInputTokens * price.cached
    + cacheWriteTokens * cacheWriteRate
    + outputTokens * price.output
  ) / 1_000_000;
  const providerCostUsd = tokenCost + searchCalls * 0.01;

  context.calls.push({
    provider: "openai",
    model,
    attemptNumber: context.calls.length + 1,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    toolCalls,
    searchCalls,
    providerCostUsd,
    rawPixels: providerCostUsd / PIXEL_USD,
    pricingSource: "https://developers.openai.com/api/docs/pricing",
    usageQuality: "reported",
    metadata: { ...metadata, ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}), ...(!hasPrice ? { unconfiguredModelPrice: true } : {}), reasoningTokens: Number(usage.output_tokens_details?.reasoning_tokens ?? usage.completion_tokens_details?.reasoning_tokens ?? 0) || 0 },
  });
};

export const recordProviderUsage = (usage: {
  provider: string;
  model: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  inputAudioTokens?: number;
  outputAudioTokens?: number;
  durationSeconds?: number;
  toolCalls?: number;
  searchCalls?: number;
  providerCostUsd: number;
  pricingSource?: string;
  usageQuality?: "reported" | "estimated" | "mixed";
  metadata?: Record<string, unknown>;
}): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  const providerCostUsd = Math.max(0, Number(usage.providerCostUsd) || 0);
  context.calls.push({
    provider: String(usage.provider || "unknown"),
    model: String(usage.model || "unknown"),
    attemptNumber: context.calls.length + 1,
    inputTokens: Math.max(0, Number(usage.inputTokens) || 0),
    cachedInputTokens: Math.max(0, Number(usage.cachedInputTokens) || 0),
    outputTokens: Math.max(0, Number(usage.outputTokens) || 0),
    inputAudioTokens: Math.max(0, Number(usage.inputAudioTokens) || 0),
    outputAudioTokens: Math.max(0, Number(usage.outputAudioTokens) || 0),
    durationSeconds: Math.max(0, Number(usage.durationSeconds) || 0),
    toolCalls: Math.max(0, Number(usage.toolCalls) || 0),
    searchCalls: Math.max(0, Number(usage.searchCalls) || 0),
    providerCostUsd,
    rawPixels: providerCostUsd / PIXEL_USD,
    pricingSource: usage.pricingSource,
    usageQuality: usage.usageQuality || "reported",
    metadata: usage.metadata,
  });
};

export const recordJevUsage = (
  result: any,
  metadata: Record<string, unknown> = {},
): void => {
  const usage = result?.usage ?? result?.result?.usage ?? {};
  const reportedInputTokens = Math.max(0, Number(usage.input_tokens ?? usage.inputTokens) || 0);
  const inputTokens = reportedInputTokens || Math.max(0, Number(metadata.estimatedInputTokens) || 0);
  const outputTokens = Math.max(0, Number(usage.output_tokens ?? usage.outputTokens) || 0);
  recordProviderUsage({
    provider: "typesafe-via-openrouter",
    model: String(result?.model || "typesafe/jev-1.13"),
    inputTokens,
    outputTokens,
    providerCostUsd: inputTokens * 0.042 / 1_000_000,
    pricingSource: "https://typesafe.ai/blog/introducing-system-one-models-and-jev",
    usageQuality: reportedInputTokens > 0 ? "reported" : "estimated",
    metadata: { ...metadata, billableToUser: false },
  });
};

export const recordUsageEvent = (
  name: string,
  detail: Record<string, unknown> = {},
): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  context.events.push({
    name: String(name || "event").slice(0, 120),
    at: new Date().toISOString(),
    elapsedMs: Date.now() - context.startedAtMs,
    detail,
  });
};

export const recordReplicateUsage = (
  model: string,
  usage: { inputTokens?: number; outputTokens?: number } = {},
  metadata: Record<string, unknown> = {},
): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  const inputTokens = Math.max(0, Number(usage.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(usage.outputTokens) || 0);
  const price = MODEL_PRICES_USD_PER_MILLION[model] ?? { input: 0, cached: 0, output: 0 };
  const providerCostUsd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  context.calls.push({
    provider: "replicate", model, attemptNumber: context.calls.length + 1,
    inputTokens, cachedInputTokens: 0, outputTokens, toolCalls: 0, searchCalls: 0,
    providerCostUsd, rawPixels: providerCostUsd / PIXEL_USD, metadata,
  });
};

export const recordFalEmbeddingUsage = (
  inputTokens: number,
  metadata: Record<string, unknown> = {},
): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  const safeInputTokens = Math.max(0, Number(inputTokens) || 0);
  const providerCostUsd = safeInputTokens * 0.02 / 1_000_000;
  context.calls.push({
    provider: "fal",
    model: "openai/text-embedding-3-small",
    attemptNumber: context.calls.length + 1,
    inputTokens: safeInputTokens,
    cachedInputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    searchCalls: 0,
    providerCostUsd,
    rawPixels: providerCostUsd / PIXEL_USD,
    metadata: { ...metadata, billableToUser: false },
  });
};

export const recordWhisperUsage = (model: string, durationSeconds: number): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  const safeSeconds = Math.max(0, Number(durationSeconds) || 0);
  const providerCostUsd = safeSeconds / 60 * 0.006;
  context.calls.push({
    provider: "openai",
    model,
    attemptNumber: context.calls.length + 1,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    searchCalls: 0,
    providerCostUsd,
    rawPixels: providerCostUsd / PIXEL_USD,
    metadata: { durationSeconds: safeSeconds },
  });
};

export const recordReplicateWhisperUsage = (durationSeconds: number): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  const safeSeconds = Math.max(0, Number(durationSeconds) || 0);
  // Replicate lists openai/whisper at $0.975 per 1,000 seconds.
  const providerCostUsd = safeSeconds * 0.000975;
  context.calls.push({
    provider: "replicate",
    model: "openai/whisper",
    attemptNumber: context.calls.length + 1,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    searchCalls: 0,
    providerCostUsd,
    rawPixels: providerCostUsd / PIXEL_USD,
    metadata: { durationSeconds: safeSeconds },
  });
};

export const recordPixelCharge = (pixels: number, billingSource = "llm-billing"): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  context.pixelsCharged += Math.max(0, Math.floor(Number(pixels) || 0));
  context.billingSource = billingSource;
};

export const setUsageAction = (stage: Stage, actionLabel: string): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  context.stage = stage;
  context.actionLabel = actionLabel;
};

export const setUsageUserId = (userId: string | number): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  const normalized = String(userId || "").trim();
  if (normalized) context.userId = normalized;
};

const recordPixelRefund = (pixels: number): void => {
  const context = usageStorage.getStore();
  if (!context) return;
  context.pixelsCharged = Math.max(0, context.pixelsCharged - Math.max(0, Math.floor(pixels)));
};

export type FixedPixelCharge = {
  pixels: number | ((req: Request) => number);
  actionLabel: string | ((req: Request) => string);
  stage: Stage;
  billingSource?: string;
  /** Optional gate for mixed handlers such as normal vs B-shot prompt writing. */
  when?: (req: Request) => boolean;
};

/**
 * Reserve one predictable user-facing charge before provider work starts.
 * Existing image/video routes are intentionally not wrapped by this helper.
 */
export const withFixedAiPixelCharge = (
  handler: (req: Request, res: Response, next?: NextFunction) => any,
  config: FixedPixelCharge,
) => async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  if (config.when && !config.when(req)) return handler(req, res, next);

  const userId = authenticatedOwnerId(req);
  if (!userId) return res.status(401).json({ message: "Please sign in to use this AI action." });

  const pixels = Math.max(0, Math.floor(
    typeof config.pixels === "function" ? config.pixels(req) : config.pixels,
  ));
  const actionLabel = String(
    typeof config.actionLabel === "function" ? config.actionLabel(req) : config.actionLabel,
  ).trim().slice(0, 120) || "AI Support";
  setUsageAction(config.stage, actionLabel);
  if (!pixels) return handler(req, res, next);

  let balance = Number(await getPixelsForUser(userId)) || 0;
  if (balance < pixels || !await trySpendPixels(userId, pixels)) {
    balance = Number(await getPixelsForUser(userId)) || 0;
    return res.status(402).json({
      message: `Not enough pixels. ${actionLabel} needs ${pixels} P and you have ${balance} P.`,
      pixels: balance,
      required: pixels,
    });
  }

  balance = Number(await getPixelsForUser(userId)) || Math.max(0, balance - pixels);
  recordUsagePixelBalance(balance);
  recordPixelCharge(pixels, config.billingSource ?? "estimated-ai-action");
  res.setHeader("X-ClikB-Pixels-Charged", String(pixels));
  res.setHeader("X-ClikB-Pixels-Balance", String(balance));
  res.setHeader("X-ClikB-Billing-Label", encodeURIComponent(actionLabel));
  res.setHeader("X-ClikB-Billing-Stage", config.stage);

  let refunded = false;
  let refundPromise: Promise<void> | null = null;
  const refundOnce = (): Promise<void> => {
    if (refundPromise) return refundPromise;
    refunded = true;
    refundPromise = (async () => {
      try {
        await addPixelsToUser(userId, pixels);
        recordPixelRefund(pixels);
        const restoredBalance = Number(await getPixelsForUser(userId));
        if (Number.isFinite(restoredBalance) && restoredBalance >= 0) {
          balance = restoredBalance;
          recordUsagePixelBalance(restoredBalance);
        }
        if (!res.headersSent) {
          res.setHeader("X-ClikB-Pixels-Charged", "0");
          if (Number.isFinite(restoredBalance) && restoredBalance >= 0) {
            res.setHeader("X-ClikB-Pixels-Balance", String(restoredBalance));
          }
        }
      } catch (refundErr) {
        const currentStore = usageStorage.getStore();
        if (currentStore) {
          currentStore.refundPending = true;
        }
        if (!res.headersSent) {
          res.setHeader("X-ClikB-Pixels-Charged", String(pixels));
          res.setHeader("X-ClikB-Refund-Pending", "1");
        }
        recordUsageEvent("billing.refund_failed", {
          userId,
          pixels,
          actionLabel,
          refundPending: true,
          error: (refundErr as Error)?.message || "refund_failed",
        });
      }
    })();
    return refundPromise;
  };

  // Settlement barrier: if the handler sends an error response (status >= 400),
  // hold res.end until the refund and authoritative balance refresh complete
  // so response headers and usage summary reflect the refunded state.
  const priorEnd = res.end.bind(res);
  let barrierReleased = false;
  (res as any).end = (...endArgs: any[]) => {
    if (!barrierReleased && res.statusCode >= 400 && !refunded) {
      barrierReleased = true;
      void refundOnce().finally(() => {
        priorEnd(...endArgs);
      });
      return res;
    }
    barrierReleased = true;
    return priorEnd(...endArgs);
  };

  try {
    const result = await handler(req, res, next);
    if (res.statusCode >= 400) {
      await refundOnce();
    } else if (refundPromise) {
      await refundPromise;
    }
    return result;
  } catch (error) {
    await refundOnce();
    next(error);
  }
};

const attachUsageSummary = (res: Response, context: UsageContext): void => {
  const isConversationMeasurement = context.stage === "conversation"
    || context.route.toLowerCase() === "/voicettsstream";
  if (!context.calls.length && !context.pixelsCharged && !context.operations.length && !isConversationMeasurement) return;
  if (!res.headersSent && context.pixelsCharged > 0) {
    if (!res.hasHeader("X-ClikB-Billing-Label")) {
      res.setHeader("X-ClikB-Billing-Label", encodeURIComponent(context.actionLabel));
    }
    if (!res.hasHeader("X-ClikB-Billing-Stage")) {
      res.setHeader("X-ClikB-Billing-Stage", context.stage);
    }
  }
  const completedAtMs = Date.now();
  const summary: UsageSummary = {
    requestId: context.requestId,
    stage: context.stage,
    actionLabel: context.actionLabel,
    route: context.route,
    status: res.statusCode >= 400 ? "failed" : "succeeded",
    pixelsCharged: res.statusCode >= 400 && !context.refundPending ? 0 : context.pixelsCharged,
    ...(context.refundPending ? { refundPending: true } : {}),
    billingSource: context.billingSource,
    createdAt: new Date().toISOString(),
    elapsedMs: completedAtMs - context.startedAtMs,
    // Keep the response header compact. Prompt text and provider output are
    // deliberately excluded from this temporary, creation-scoped ledger.
    calls: context.calls.slice(0, 12).map((call) => ({
      provider: call.provider,
      model: call.model,
      attemptNumber: call.attemptNumber,
      inputTokens: call.inputTokens,
      cachedInputTokens: call.cachedInputTokens,
      outputTokens: call.outputTokens,
      toolCalls: call.toolCalls,
      searchCalls: call.searchCalls,
      providerCostUsd: call.providerCostUsd,
      rawPixels: call.rawPixels,
      inputAudioTokens: call.inputAudioTokens,
      outputAudioTokens: call.outputAudioTokens,
      durationSeconds: call.durationSeconds,
      pricingSource: call.pricingSource,
      usageQuality: call.usageQuality,
      metadata: call.metadata,
    })),
  };
  const entries = context.operations.length
    ? [...(context.calls.length || context.pixelsCharged ? [summary] : []), ...context.operations]
      .filter((entry, index, all) => all.findIndex(item => item.requestId === entry.requestId) === index)
    : [];
  const headerSummary = entries.length ? {
    ...summary,
    // Legacy consumers see the actual aggregate deduction; current clients
    // publish the individual entries and never add this aggregate as a row.
    pixelsCharged: entries.reduce((total, entry) => total + (entry.replayed ? 0 : entry.pixelsCharged), 0),
    entries,
  } : summary;
  if (!res.headersSent) {
    if (entries.length) {
      res.setHeader("X-ClikB-Pixels-Charged", String(headerSummary.pixelsCharged));
      if (context.pixelsBalance !== undefined) res.setHeader("X-ClikB-Pixels-Balance", String(context.pixelsBalance));
      const chargedEntries = entries.filter(entry => !entry.replayed && entry.pixelsCharged > 0);
      if (chargedEntries.length && !res.hasHeader("X-ClikB-Billing-Label")) {
        res.setHeader("X-ClikB-Billing-Label", encodeURIComponent(chargedEntries.length === 1
          ? chargedEntries[0].actionLabel : "Image Prompt Preparation"));
      }
      if (chargedEntries.length && !res.hasHeader("X-ClikB-Billing-Stage")) {
        res.setHeader("X-ClikB-Billing-Stage", chargedEntries.length === 1 ? chargedEntries[0].stage : "image_prompt");
      }
    }
    res.setHeader("X-ClikB-Usage-Summary", encodeURIComponent(JSON.stringify(headerSummary)));
  }
  if (context.measurementSessionId && isConversationMeasurement) {
    appendConversationMeasurement({
      sessionId: context.measurementSessionId,
      requestId: context.requestId,
      route: context.route,
      stage: context.stage,
      actionLabel: context.actionLabel,
      status: res.statusCode >= 400 ? "failed" : "succeeded",
      startedAt: new Date(context.startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      elapsedMs: completedAtMs - context.startedAtMs,
      calls: context.calls.map(call => ({
        provider: call.provider,
        model: call.model,
        inputTokens: call.inputTokens,
        cachedInputTokens: call.cachedInputTokens,
        outputTokens: call.outputTokens,
        inputAudioTokens: call.inputAudioTokens,
        outputAudioTokens: call.outputAudioTokens,
        durationSeconds: call.durationSeconds,
        toolCalls: call.toolCalls,
        searchCalls: call.searchCalls,
        providerCostUsd: call.providerCostUsd,
        pricingSource: call.pricingSource,
        usageQuality: call.usageQuality,
        metadata: call.metadata,
      })),
      events: context.events,
    });
  }
};

export const aiUsageContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const route = req.path || req.originalUrl || "unknown";
  const descriptor = descriptorForRoute(route, req);
  const context: UsageContext = {
    // Correlation supplied by a browser must never become the identity of paid
    // provider work: a fresh admitted HTTP request gets a server-owned identity.
    requestId: randomUUID(),
    measurementSessionId: String(req.headers[CONVERSATION_MEASUREMENT_HEADER] || "").trim().slice(0, 120) || null,
    startedAtMs: Date.now(),
    userId: authenticatedOwnerId(req),
    route,
    ...descriptor,
    calls: [],
    events: [],
    pixelsCharged: 0,
    billingSource: "provider-usage",
    operations: [],
  };
  usageStorage.run(context, () => {
    const clientCorrelation = String(req.headers['x-clikb-request-id'] || '').slice(0, 120);
    if (clientCorrelation) recordUsageEvent('request.client_correlation', { clientRequestId: clientCorrelation });
    const originalEnd = res.end.bind(res);
    (res as any).end = (...args: any[]) => {
      attachUsageSummary(res, context);
      return originalEnd(...args);
    };
    next();
  });
};
