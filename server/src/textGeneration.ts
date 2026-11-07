import OpenAI from "openai";
import { decodeReplicateToolReply, replicateToolPrompt, streamReplicateToolReply } from './ReplicateToolAdapter';
import Replicate from "replicate";
import { streamReplicateBuild } from './replicateLiveBuild';
import { recordReplicateUsage } from "./aiUsageLedger";
import { providerForLanguageModel } from "./languageModels";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { isLanguageModelTier, languageModelForTier } from "./languageModels";
import { resolveConversationProfile } from './conversationModels';

export const REPLICATE_DEEPSEEK_MODEL = "deepseek-ai/deepseek-v3.1";
export const REPLICATE_KIMI_MODEL = "moonshotai/kimi-k2.6";
export const REPLICATE_QWEN_MODEL = "qwen/qwen3-7-plus";
export const REPLICATE_GPT_5_4_MODEL = "openai/gpt-5.4";
export const REPLICATE_GPT_5_2_MODEL = "openai/gpt-5.2";
export const REPLICATE_GPT_4_1_MINI_MODEL = "openai/gpt-4.1-mini";
export const REPLICATE_WHISPER_MODEL = "openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e";
export const HIDDEN_TEXT_MODEL = process.env.HIDDEN_TEXT_MODEL || REPLICATE_QWEN_MODEL;
// This is the selectable Replicate default used by Creation AI and Conversation
// AI. Hidden routes below can still override it with their approved specialist.
const OPENAI_FALLBACK_MODEL = REPLICATE_DEEPSEEK_MODEL;

/**
 * Golden-source calls keep their proven OpenAI models during normal service,
 * but use the closest explicitly approved official model on Replicate when the
 * OpenAI account reports billing exhaustion.
 */
export const replicateFallbackModelForPath = (path: string): string => {
  const normalizedPath = String(path || "").split("?")[0].toLowerCase();
  if (normalizedPath === "/startstory" || normalizedPath === "/startinteractions") {
    return REPLICATE_GPT_5_4_MODEL;
  }
  if (["/startmemes", "/startplan", "/startplank", "/startplanvid", "/generatecastingprompts"].includes(normalizedPath)) {
    return REPLICATE_GPT_5_2_MODEL;
  }
  if (["/extractcasting", "/intent-blueprint/compile-scene", "/gptremake", "/gptremaketext",
    "/gpttagger", "/editgeneratedvisualtextonly", "/chatgptapidesign4", "/summary", "/chatgptapiaudio", "/examplestory",
    "/startplanyou", "/startdesignyou", "/startdesignyouk", "/distilltemplate",
    "/gptartstyleprompt", "/memory/summarizeslot"].includes(normalizedPath)) {
    return REPLICATE_QWEN_MODEL;
  }
  if (normalizedPath === "/intent-blueprint/reconcile-scene") return REPLICATE_DEEPSEEK_MODEL;
  if (normalizedPath === "/gptremakesafe" || normalizedPath === "/gptremakeksafe") return REPLICATE_GPT_5_2_MODEL;
  if (normalizedPath === "/narratesummary") return REPLICATE_GPT_4_1_MINI_MODEL;
  if (normalizedPath === "/motion-guide/build") return REPLICATE_KIMI_MODEL;
  return OPENAI_FALLBACK_MODEL;
};

type OpenAiAvailabilityState = {
  available: boolean;
  code: string | null;
  since: string | null;
  noticePending: boolean;
};
const DEFAULT_AVAILABILITY_KEY = "__direct__";
const OPENAI_SESSION_COOKIE = "clikbAiSession";
const unavailableOpenAiSessions = new Map<string, OpenAiAvailabilityState>();

type RouteOwnership = "creation" | "conversation" | "hidden" | "unowned";
type RoutingContext = {
  availabilityKey: string;
  path: string;
  ownership: RouteOwnership;
  selectedModel: string | null;
  onlineRequested: boolean;
  allowReplicateBillingFallback: boolean;
  replicateBillingFallbackModel: string;
  replicateReasoningEffort?: "none" | "low" | "medium" | "high";
  useFalEmbeddings: boolean;
  replicateModeSelected: boolean;
  deferOpenAiProviderSwitch: boolean;
  openAiFailedThisRequest: boolean;
  openAiFailure?: unknown;
};
const routingStorage = new AsyncLocalStorage<RoutingContext>();

const availabilityKeyForRequest = (req: Request, res: Response): string => {
  // The browser creates a fresh ID on every page load. This makes a reload a
  // genuinely fresh Luna attempt without sharing provider state across users.
  const pageSession = String(req.get?.("X-ClikB-AI-Session") || "").trim();
  if (/^[a-zA-Z0-9-]{1,128}$/.test(pageSession)) return `page:${pageSession}`;

  // Cookie fallback keeps non-browser/older clients isolated from one another.
  const existing = String((req as any).cookies?.[OPENAI_SESSION_COOKIE] || "").trim();
  if (/^[a-zA-Z0-9-]{1,128}$/.test(existing)) return `cookie:${existing}`;
  const created = randomUUID();
  if (typeof (res as any).cookie === "function") {
    (res as any).cookie(OPENAI_SESSION_COOKIE, created, {
      httpOnly: true,
      secure: process.env.APP_STATE !== "dev",
      sameSite: process.env.APP_STATE === "dev" ? "lax" : "none",
    });
  }
  return `cookie:${created}`;
};

const currentAvailabilityKey = (): string =>
  routingStorage.getStore()?.availabilityKey || DEFAULT_AVAILABILITY_KEY;

const availabilityForKey = (key: string): OpenAiAvailabilityState =>
  unavailableOpenAiSessions.get(key) || { available: true, code: null, since: null, noticePending: false };

const CREATION_ROUTES = /^(?:\/(?:startStory|startMemes|startInteractions|examplestory|startPlan(?:K|Vid)?|startPlanYou|startDesignYouK?|generate-world-remix|gptWorldImage|ImageDesignStory|VideoDesign|GptVisual|GptRemake|EditGeneratedVisualTextOnly|narrateSummary|extractCasting|generateCastingPrompts|injectCharactersToPrompt|startMilo|GptArtstylePrompt)|\/intent-blueprint\/(?:compile|compile-global|compile-scene|reconcile-scene)|\/spatial-motion-context\/|\/motion-guide\/)/i;
const CONVERSATION_ROUTES = /^\/(?:startBrainstorm|startBrainstormStream)/i;
const HIDDEN_ROUTES = /^\/(?:startStory|startMemes|startInteractions|startPlan(?:K|Vid)?|extractCasting|generateCastingPrompts|GptRemake(?:Safe|KSafe|Text)?|EditGeneratedVisualTextOnly|narrateSummary|GptTagger|GptLipSyncAudioInstructions|ChatGPTApiDesign4|summary|ChatGPTApiAudio|examplestory|startPlanYou|startDesignYouK?|distillTemplate|GptArtstylePrompt|memory\/summarizeSlot|motion-guide\/build|intent-blueprint\/(?:compile-scene|reconcile-scene)|reconcilePreciseImagePrompt)/i;

const ownershipForPath = (path: string): RouteOwnership => {
  if (CONVERSATION_ROUTES.test(path)) return "conversation";
  if (HIDDEN_ROUTES.test(path)) return "hidden";
  if (CREATION_ROUTES.test(path)) return "creation";
  return "unowned";
};

const replicateDisplayName = (model: string): string => {
  if (model === REPLICATE_KIMI_MODEL) return "Kimi";
  if (model === REPLICATE_QWEN_MODEL) return "Qwen";
  if (model === REPLICATE_DEEPSEEK_MODEL) return "DeepSeek";
  if (model === REPLICATE_GPT_5_2_MODEL) return "GPT-5.2 on Replicate";
  if (model === REPLICATE_GPT_5_4_MODEL) return "GPT-5.4 on Replicate";
  if (model === REPLICATE_GPT_4_1_MINI_MODEL) return "GPT-4.1 Mini on Replicate";
  return "Replicate";
};

export const textGenerationRoutingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const availabilityKey = availabilityKeyForRequest(req, res);
  const ownership = ownershipForPath(req.path || req.originalUrl || "");
  const normalizedPath = String(req.path || req.originalUrl || "").toLowerCase();
  const replicateBillingFallbackModel = replicateFallbackModelForPath(normalizedPath);
  const rawTier = ownership === "conversation"
    ? req.body?.conversationModel
    : req.body?.llmTier ?? req.body?.conversationModel ?? req.get?.("X-ClikB-LLM-Tier");
  let selectedModel: string | null = null;
  const tierWasSupplied = rawTier !== undefined && rawTier !== null && rawTier !== "";
  const conversationProfile = ownership === 'conversation' ? resolveConversationProfile(rawTier) : null;
  const validConversationTier = Boolean(conversationProfile);
  if (ownership === "conversation" && tierWasSupplied && !validConversationTier) {
    res.status(400).json({ message: "Unknown conversation model." });
    return;
  }
  if (ownership === "creation" && tierWasSupplied && !isLanguageModelTier(rawTier)) {
    res.status(400).json({ message: "Unknown creation model." });
    return;
  }
  if ((ownership === "creation" || ownership === "conversation") && isLanguageModelTier(rawTier)) {
    selectedModel = languageModelForTier(rawTier);
  }
  if (conversationProfile) selectedModel = conversationProfile.model;
  const replicateModeSelected = isLanguageModelTier(rawTier)
    && providerForLanguageModel(languageModelForTier(rawTier)) === "replicate";
  const onlineRequested = Boolean(req.body?.webSearch || req.body?.onlineAccess || req.body?.online);
  const embeddingConversationModel = String(req.body?.conversationModel || "");
  routingStorage.run({
    availabilityKey,
    path: normalizedPath,
    ownership,
    selectedModel,
    onlineRequested,
    allowReplicateBillingFallback: true,
    replicateBillingFallbackModel,
    replicateReasoningEffort: normalizedPath === "/motion-guide/build" ? "high" : undefined,
    useFalEmbeddings: embeddingConversationModel === "deepseek" || embeddingConversationModel === "kimi",
    replicateModeSelected,
    deferOpenAiProviderSwitch: req.body?.deferOpenAiProviderSwitch === true
      && (normalizedPath === "/imagedesignstory" || normalizedPath === "/imagedesignstorystage"),
    openAiFailedThisRequest: false,
  }, () => {
    const originalEnd = res.end.bind(res);
    (res as any).end = (...args: any[]) => {
      const status = getOpenAiAvailability(availabilityKey);
      const selectedReplicate = Boolean(selectedModel && providerForLanguageModel(selectedModel) === "replicate");
      if (!res.headersSent) {
        res.setHeader("X-ClikB-OpenAI-Available", status.available ? "1" : "0");
        const providerFailed = routingStorage.getStore()?.openAiFailedThisRequest || status.noticePending;
        if (providerFailed || (onlineRequested && selectedReplicate)) {
          const noticeModel = selectedReplicate && selectedModel ? selectedModel : replicateBillingFallbackModel;
          const offlineModelName = replicateDisplayName(noticeModel);
          res.setHeader("X-ClikB-AI-Notice", encodeURIComponent(
            providerFailed
              ? `GPT connection issue — switched to ${offlineModelName}. Try again.`
              : `Online Access unavailable — continuing offline with ${offlineModelName}`,
          ));
          if (status.noticePending) {
            unavailableOpenAiSessions.set(availabilityKey, { ...status, noticePending: false });
          }
        }
      }
      return originalEnd(...args);
    };
    next();
  });
};

export const getOpenAiAvailability = (key = currentAvailabilityKey()) => ({
  ...availabilityForKey(key),
  fallbackModel: OPENAI_FALLBACK_MODEL,
});

/** Explicit user action only: allow the next GPT request to test OpenAI again. */
export const resetOpenAiAvailability = (): void => {
  unavailableOpenAiSessions.delete(currentAvailabilityKey());
};

export const shouldUseFalEmbeddingProvider = (): boolean => {
  const route = routingStorage.getStore();
  const selectedModel = route?.selectedModel;
  return Boolean(route?.useFalEmbeddings)
    || Boolean(route?.replicateModeSelected)
    || selectedModel === REPLICATE_DEEPSEEK_MODEL
    || selectedModel === REPLICATE_KIMI_MODEL
    || !getOpenAiAvailability().available;
};

export const shouldBypassOpenAiForCurrentSession = (): boolean =>
  Boolean(routingStorage.getStore()?.replicateModeSelected)
  || !getOpenAiAvailability().available;

const errorCode = (error: any): string => String(
  error?.code ?? error?.error?.code ?? error?.response?.data?.error?.code ?? "",
).trim();

// Provider failures keep the existing page-level switch. A rejected request
// is an application error and says nothing about the account's availability.
const isOpenAiFallbackError = (error: any): boolean => {
  if (/^(?:credit_balance_exhausted|billing_hard_limit_reached|insufficient_quota)$/.test(errorCode(error))) return true;
  const status = Number(error?.status ?? error?.response?.status);
  return status !== 400 && status !== 422;
};

const markUnavailable = (error: any, model: string, operation: string): void => {
  const route = routingStorage.getStore();
  // Log the provider's reason without logging keys, request bodies, or prompts.
  const message = String(error?.message ?? error?.error?.message ?? "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/https?:\/\/\S+/gi, "[REDACTED_URL]")
    .slice(0, 500);
  console.error("[OpenAI request failed]", {
    path: route?.path ?? "unknown",
    operation,
    model,
    status: error?.status ?? null,
    code: errorCode(error) || null,
    type: error?.type ?? error?.error?.type ?? null,
    requestId: error?.request_id ?? null,
    message,
  });
  if (route?.path === "/motion-guide/build") return;
  if (route) {
    route.openAiFailedThisRequest = true;
    route.openAiFailure = error;
  }
  unavailableOpenAiSessions.set(currentAvailabilityKey(), {
    available: false,
    code: errorCode(error),
    since: new Date().toISOString(),
    noticePending: true,
  });
};

const textFromContent = (content: any): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part?.type === "text" || part?.type === "input_text") return String(part.text ?? "");
    if (part?.type === "image_url" || part?.type === "input_image") {
      const rawUrl = part.image_url?.url ?? part.image_url ?? part.image ?? "attached";
      const safeUrl = typeof rawUrl === "string" && rawUrl.startsWith("data:") ? "(inline image data)" : rawUrl;
      return `[Visual reference: ${safeUrl}]`;
    }
    return JSON.stringify(part);
  }).join("\n");
};

const imageUrlsFromContent = (content: any): string[] => {
  if (!Array.isArray(content)) return [];
  return content.flatMap((part) => {
    if (part?.type !== "image_url" && part?.type !== "input_image") return [];
    const value = part.image_url?.url ?? part.image_url ?? part.image;
    return typeof value === "string" && value.trim() ? [value.trim()] : [];
  });
};

const imageUrlsFromRequest = (request: any): string[] => {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const fromMessages = messages.flatMap((message: any) => imageUrlsFromContent(message?.content));
  const inputItems = Array.isArray(request.input) ? request.input : [];
  const fromInput = inputItems.flatMap((item: any) => imageUrlsFromContent(item?.content ?? item));
  return [...new Set([...fromMessages, ...fromInput])];
};

const promptFromMessages = (messages: any[] = []): string => messages.map((message) =>
  `${String(message?.role || "user").toUpperCase()}: ${textFromContent(message?.content)}${message.tool_calls ? `\nFUNCTION CALLS: ${JSON.stringify(message.tool_calls)}` : ''}${message.tool_call_id ? `\nFUNCTION RESULT ID: ${message.tool_call_id}` : ''}`,
).join("\n\n");

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

const replicateInput = (model: string, request: any): { input: Record<string, any>; prompt: string } => {
  let prompt = request.messages
    ? promptFromMessages(request.messages)
    : textFromContent(request.input ?? request.prompt);
  if (request.response_format) {
    prompt += `\n\nRESPONSE FORMAT (obey exactly): ${JSON.stringify(request.response_format)}`;
  }
  const maxTokens = request.max_completion_tokens ?? request.max_output_tokens ?? request.max_tokens ?? 4096;
  const imageUrls = imageUrlsFromRequest(request);
  const isOfficialReplicateGpt = [
    REPLICATE_GPT_5_2_MODEL,
    REPLICATE_GPT_5_4_MODEL,
    REPLICATE_GPT_4_1_MINI_MODEL,
  ].includes(model);
  const input: Record<string, any> = isOfficialReplicateGpt
    ? {
      prompt,
      max_completion_tokens: maxTokens,
      reasoning_effort: "none",
      verbosity: "medium",
    }
    : { prompt, max_tokens: maxTokens };
  if (model === REPLICATE_DEEPSEEK_MODEL) input.thinking = "None";
  if (imageUrls.length && model !== REPLICATE_DEEPSEEK_MODEL) {
    if (model === REPLICATE_QWEN_MODEL) input.image = imageUrls;
    else input.image_input = imageUrls;
  }
  if (model === REPLICATE_KIMI_MODEL) {
    input.reasoning_effort = routingStorage.getStore()?.replicateReasoningEffort
      ?? request.reasoning_effort
      ?? request.reasoning?.effort
      ?? "low";
  }
  return { input, prompt };
};

const replicateClient = () => {
  const token = process.env.REPLICATE_API_TOKEN || process.env.REPLI_KEY;
  if (!token) throw Object.assign(new Error("Replicate is not configured."), { code: "replicate_not_configured" });
  return new Replicate({ auth: token });
};

const runReplicate = async (model: string, request: any, signal?: AbortSignal): Promise<string> => {
  if (signal?.aborted) throw Object.assign(new Error('Request cancelled before submission.'), { name: 'AbortError' });
  const replicate = replicateClient();
  const { input, prompt } = replicateInput(model, request);
  const output: any = await replicate.run(model as `${string}/${string}`, { input,
    ...(signal ? { signal, wait: { mode: 'poll' as const, interval: 1000 } } : {}) });
  if (signal?.aborted) throw Object.assign(new Error('Provider request cancelled.'), { name: 'AbortError' });
  const text = Array.isArray(output) ? output.join("") : String(output ?? "");
  recordReplicateUsage(model, {
    inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(text),
  }, { strictRoute: providerForLanguageModel(request.model) === "replicate" });
  return text;
};

export type LiveTextChunk =
  | { type: "meta"; model: string; provider: "openai" | "replicate"; liveStreaming: boolean; reasoningEffort?: string; notice?: string }
  | { type: "delta"; text: string }
  | { type: "done"; text: string; usage?: any; model: string; provider: "openai" | "replicate"; liveStreaming: boolean };

/** Retry only a rejected parameter, before any generation exists. Some deployed
 * model routes lag the advertised max-effort capability; preserve model choice. */
export async function createChatWithReasoningCompatibility(openai: OpenAI, request: any, options?: { signal?: AbortSignal }): Promise<any> {
  try { return await openai.chat.completions.create(request, options); }
  catch (error) {
    const message = String((error as any)?.message || '');
    if ((error as any)?.status !== 400 || request.reasoning_effort !== 'max' || !/reasoning_effort/.test(message) || !/Unsupported value/.test(message) || !/xhigh/.test(message)) throw error;
    const result: any = await openai.chat.completions.create({ ...request, reasoning_effort: 'xhigh' }, options);
    result._clikbReasoningEffort = 'xhigh';
    return result;
  }
}

/**
 * Provider-native token streaming for live Three.js construction. Routing
 * mirrors `createRoutedTextClient` (selected tier, hidden-route Replicate
 * mode, billing fallback) so the user's model choice and pricing are kept.
 * Nothing is buffered and re-split: each yielded delta is what the provider
 * has just produced. If a Replicate model rejects streaming, the full result
 * is returned with `liveStreaming: false` so the UI can say so honestly.
 */
export async function* streamRoutedChatText(openai: OpenAI, request: any, signal?: AbortSignal): AsyncGenerator<LiveTextChunk> {
  const existingRoute = routingStorage.getStore();
  if (existingRoute?.openAiFailedThisRequest) throw existingRoute.openAiFailure;
  let model = routeModel(String(request.model || ""));
  let useReplicate = providerForLanguageModel(model) === "replicate";
  const route = routingStorage.getStore();
  const isMotionGuide = route?.path === "/motion-guide/build";
  if (!useReplicate && route?.ownership === "hidden" && route.replicateModeSelected && !isMotionGuide) { model = route.replicateBillingFallbackModel || OPENAI_FALLBACK_MODEL; useReplicate = true; }
  else if (!useReplicate && !getOpenAiAvailability().available && route?.allowReplicateBillingFallback !== false && !isMotionGuide) { model = route?.replicateBillingFallbackModel || OPENAI_FALLBACK_MODEL; useReplicate = true; }
  if (useReplicate) {
    const replicate = replicateClient();
    const { input, prompt } = replicateInput(model, { ...request, model });
    let text = "";
    let streamed = false;
    try {
      yield { type: "meta", model, provider: "replicate", liveStreaming: true };
      for await (const event of streamReplicateBuild(replicate, model, input, signal)) {
        if (signal?.aborted) break;
        if ((event as any).event === "output") {
          const piece = String((event as any).data ?? "");
          if (piece) { streamed = true; text += piece; yield { type: "delta", text: piece }; }
        } else if ((event as any).event === "error") {
          throw new Error(String((event as any).data || "Replicate stream failed."));
        } else if ((event as any).event === "done") break;
      }
    } catch (error) {
      if (streamed || signal?.aborted) throw error;
      // A streaming prediction may already exist even before its first output.
      // Never silently submit another paid prediction as a buffered fallback.
      throw error;
    }
    recordReplicateUsage(model, { inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(text) }, { strictRoute: providerForLanguageModel(request.model) === "replicate" });
    yield { type: "done", text, model, provider: "replicate", liveStreaming: true };
    return;
  }
  let stream: any;
  try {
    stream = await createChatWithReasoningCompatibility(openai, { ...request, model, stream: true, stream_options: { include_usage: true } }, { signal });
  } catch (error) {
    if (isOpenAiFallbackError(error) && !signal?.aborted && !route?.deferOpenAiProviderSwitch) markUnavailable(error, model, "chat.completions.stream");
    throw error;
  }
  yield { type: "meta", model, provider: "openai", liveStreaming: true, reasoningEffort: stream._clikbReasoningEffort || request.reasoning_effort,
    ...(stream._clikbReasoningEffort ? { notice: 'This model route rejected max reasoning; it is using its supported extra-high level with the same selected model.' } : {}) };
  let text = "", usage: any, actualModel = model;
  try {
    for await (const chunk of stream) {
      if (chunk?.model) actualModel = chunk.model;
      if (chunk?.usage) usage = chunk.usage;
      const piece = chunk?.choices?.[0]?.delta?.content;
      if (piece) { text += piece; yield { type: "delta", text: piece }; }
    }
  } catch (error) {
    if (!signal?.aborted && isOpenAiFallbackError(error) && !route?.deferOpenAiProviderSwitch) markUnavailable(error, model, "chat.completions.stream");
    throw error;
  }
  yield { type: "done", text, usage, model: actualModel, provider: "openai", liveStreaming: true };
}

export const isOpenAiProviderError = (error: any): boolean => isOpenAiFallbackError(error);

export const reportOpenAiFailure = (error: any): void => markUnavailable(error, "whisper-1", "audio.transcriptions");
export const reportOpenAiTextStreamFailure = (error: unknown, model: string): void => {
  if (isOpenAiFallbackError(error)) markUnavailable(error, model, 'responses.stream');
};

export const withReplicateFallbackModel = async <T>(model: string, work: () => Promise<T>): Promise<T> => {
  const current = routingStorage.getStore();
  if (!current) return work();
  return routingStorage.run({ ...current, replicateBillingFallbackModel: model }, work);
};

export const withoutReplicateFallback = async <T>(work: () => Promise<T>): Promise<T> => {
  const current = routingStorage.getStore();
  if (!current) return work();
  return routingStorage.run({ ...current, allowReplicateBillingFallback: false }, work);
};

export const transcribeWithReplicateWhisper = async (audioUrl: string): Promise<any> => {
  const token = process.env.REPLICATE_API_TOKEN || process.env.REPLI_KEY;
  if (!token) throw Object.assign(new Error("Replicate is not configured."), { code: "replicate_not_configured" });
  const replicate = new Replicate({ auth: token });
  return replicate.run(REPLICATE_WHISPER_MODEL as `${string}/${string}`, {
    input: { audio: audioUrl, language: "auto", translate: false, temperature: 0, transcription: "plain text" },
  });
};

const fakeChatResponse = (model: string, text: string) => ({
  _clikbProvider: "replicate",
  id: `replicate-${Date.now()}`, object: "chat.completion", model,
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: text } }],
  usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
});

const fakeResponse = (model: string, text: string) => ({
  _clikbProvider: "replicate",
  id: `replicate-${Date.now()}`, object: "response", model, output_text: text,
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }],
  usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
});

const streamedChat = async function* (text: string) {
  const pieces = text.match(/.{1,80}/gs) ?? [text];
  for (const piece of pieces) yield { choices: [{ delta: { content: piece }, finish_reason: null }] };
  yield { choices: [{ delta: {}, finish_reason: "stop" }] };
};

const taggedStreamedChat = (text: string) => {
  const stream: any = streamedChat(text);
  stream._clikbProvider = "replicate";
  return stream;
};

const routeModel = (requestedModel: string): string => {
  const requestRoute = routingStorage.getStore();
  if (requestRoute?.selectedModel) return requestRoute.selectedModel;
  return requestedModel;
};

const replicateChatCompletion = async (model: string, request: any, signal?: AbortSignal) => {
  const tools = Array.isArray(request.tools) ? request.tools.filter((tool: any) => tool.type === 'function') : [];
  if (!tools.length) {
    const text = await runReplicate(model, request, signal);
    return request.stream ? taggedStreamedChat(text) : fakeChatResponse(model, text);
  }
  const protocolRequest = { ...request, messages: undefined, input: replicateToolPrompt(tools, request.messages || []) };
  let reply: ReturnType<typeof decodeReplicateToolReply>;
  const text = await runReplicate(model, protocolRequest, signal);
  try { reply = decodeReplicateToolReply(text, tools); }
  catch {
    // No tool has been dispatched. One format-only repair is safe and bounded.
    const repaired = await runReplicate(model, { ...protocolRequest,
      input: `${protocolRequest.input}\nYour last output was not a valid function-channel envelope. Return valid JSON with content and tool_calls only. Do not change the user goal.`,
    }, signal);
    reply = decodeReplicateToolReply(repaired, tools);
  }
  if (request.stream) {
    const stream: any = streamReplicateToolReply(reply);
    stream._clikbProvider = 'replicate';
    return stream;
  }
  const response = fakeChatResponse(model, reply.content || '');
  response.choices[0].finish_reason = reply.tool_calls.length ? 'tool_calls' : 'stop';
  return { ...response, choices: [{ ...response.choices[0], message: { role: 'assistant', ...reply } }] };
};

export const createRoutedTextClient = (openai: OpenAI): OpenAI => {
  const routedChatCreate = async (request: any, options?: { signal?: AbortSignal }) => {
    const existingRoute = routingStorage.getStore();
    if (existingRoute?.openAiFailedThisRequest) throw existingRoute.openAiFailure;
    const model = routeModel(String(request.model || ""));
    if (providerForLanguageModel(model) === "replicate") {
      return replicateChatCompletion(model, request, options?.signal);
    }
    const route = routingStorage.getStore();
    if (route?.ownership === "hidden" && route.replicateModeSelected) {
      const fallbackModel = route.replicateBillingFallbackModel || OPENAI_FALLBACK_MODEL;
      return replicateChatCompletion(fallbackModel, { ...request, model: fallbackModel }, options?.signal);
    }
    if (!getOpenAiAvailability().available && route?.allowReplicateBillingFallback !== false) {
      const fallbackModel = route?.replicateBillingFallbackModel || OPENAI_FALLBACK_MODEL;
      return replicateChatCompletion(fallbackModel, { ...request, model: fallbackModel }, options?.signal);
    }
    try {
      const response = await createChatWithReasoningCompatibility(openai, request, options);
      return response;
    } catch (error) {
      if (!isOpenAiFallbackError(error)) throw error;
      if (!route?.deferOpenAiProviderSwitch) markUnavailable(error, model, "chat.completions");
      // Do not retry the failed user action through another provider. The
      // response header switches both selectors to DeepSeek; a manual retry is
      // a new request and is then routed through Replicate.
      throw error;
    }
  };
  const routedResponseCreate = async (request: any) => {
    const existingRoute = routingStorage.getStore();
    if (existingRoute?.openAiFailedThisRequest) throw existingRoute.openAiFailure;
    const model = routeModel(String(request.model || ""));
    if (providerForLanguageModel(model) === "replicate") {
      return fakeResponse(model, await runReplicate(model, request));
    }
    const route = routingStorage.getStore();
    if (route?.ownership === "hidden" && route.replicateModeSelected) {
      const fallbackModel = route.replicateBillingFallbackModel || OPENAI_FALLBACK_MODEL;
      return fakeResponse(fallbackModel, await runReplicate(fallbackModel, { ...request, model: fallbackModel }));
    }
    if (!getOpenAiAvailability().available && route?.allowReplicateBillingFallback !== false) {
      const fallbackModel = route?.replicateBillingFallbackModel || OPENAI_FALLBACK_MODEL;
      return fakeResponse(fallbackModel, await runReplicate(fallbackModel, { ...request, model: fallbackModel }));
    }
    try {
      const response = await openai.responses.create(request);
      return response;
    } catch (error) {
      if (!isOpenAiFallbackError(error)) throw error;
      if (!route?.deferOpenAiProviderSwitch) markUnavailable(error, model, "responses");
      // As above, switching provider affects the user's next request only.
      throw error;
    }
  };
  return new Proxy(openai as any, {
    get(target, property) {
      if (property === "chat") return { completions: { create: routedChatCreate } };
      if (property === "responses") return { create: routedResponseCreate };
      return target[property];
    },
  }) as OpenAI;
};
