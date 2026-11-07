import { promises as fs } from "fs";
import path from "path";

export const CONVERSATION_MEASUREMENT_SCHEMA_VERSION = 1;
export const CONVERSATION_MEASUREMENT_HEADER = "x-clikb-conversation-session";

export type ConversationMeasurementCall = {
  provider: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  inputAudioTokens?: number;
  outputAudioTokens?: number;
  durationSeconds?: number;
  toolCalls: number;
  searchCalls: number;
  providerCostUsd: number;
  pricingSource?: string;
  usageQuality?: "reported" | "estimated" | "mixed";
  metadata?: Record<string, unknown>;
};

export type ConversationMeasurementEvent = {
  name: string;
  at: string;
  elapsedMs: number;
  detail?: Record<string, unknown>;
};

export type ConversationMeasurementRecord = {
  sessionId: string;
  requestId: string;
  route: string;
  stage: string;
  actionLabel: string;
  status: string;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  calls: ConversationMeasurementCall[];
  events: ConversationMeasurementEvent[];
};

const pricing = {
  checkedAt: "2026-10-27",
  currency: "USD",
  notes: [
    "Provider cost is calculated from provider-reported usage when available.",
    "Estimated rows are explicitly marked; they must not be mistaken for an invoice.",
    "The one-hour projection scales this session's observed wall-clock window, including user pauses between measured requests.",
  ],
  sources: {
    openai: "https://developers.openai.com/api/docs/pricing",
    openaiVoiceCostGuide: "https://developers.openai.com/api/docs/guides/voice-latency-cost",
    jevOfficial: "https://typesafe.ai/blog/introducing-system-one-models-and-jev",
    jevGateway: "https://openrouter.ai/typesafe/jev-1.13/api",
    xaiVoice: "https://x.ai/api/voice",
    googleGemini: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  rates: {
    jev_1_13_input_per_million_tokens: 0.042,
    jev_1_13_output_per_million_tokens: 0,
    xai_streaming_stt_per_hour: 0.20,
    gemini_3_1_flash_live_audio_input_per_minute: 0.005,
    gemini_3_1_flash_tts_text_input_per_million_tokens: 1,
    gemini_3_1_flash_tts_audio_output_per_million_tokens: 20,
    gemini_2_5_flash_tts_text_input_per_million_tokens: 0.50,
    gemini_2_5_flash_tts_audio_output_per_million_tokens: 10,
    gemini_2_5_pro_tts_text_input_per_million_tokens: 1,
    gemini_2_5_pro_tts_audio_output_per_million_tokens: 20,
  },
};

export const conversationMeasurementPricing = pricing;

export type ConversationWorkloadCategory =
  | "main_concierge"
  | "jev"
  | "memory"
  | "embedding"
  | "voice"
  | "other";

export type ConversationWorkloadSummaryRow = {
  category: ConversationWorkloadCategory;
  calls: number;
  costUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  durationSeconds: number;
};

export type ConversationContextSizeSummary = {
  eventCount: number;
  totalCharacters: number;
  averageCharacters: number;
  bySource: {
    knowledgeChars: number;
    snapshotChars: number;
    systemChars: number;
    memoryChars: number;
    actionEvidenceChars: number;
    conversationChars: number;
  };
  averageBySource: {
    knowledgeChars: number;
    snapshotChars: number;
    systemChars: number;
    memoryChars: number;
    actionEvidenceChars: number;
    conversationChars: number;
  };
  byReason: Record<string, { count: number; totalCharacters: number; averageCharacters: number }>;
};

export type StoredSession = {
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  measuredWindowMs: number;
  summary: ReturnType<typeof summarizeConversationRecords>;
  records: ConversationMeasurementRecord[];
};

export type CompactConversationSessionView = {
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  measuredWindowMs: number;
  summary: ReturnType<typeof summarizeConversationRecords>;
  totalRecordCount: number;
  page: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  watermark: {
    inMemoryRevision: number;
    persistedRevision: number;
    flushPending: boolean;
  };
  records: ConversationMeasurementRecord[];
};

type LedgerFile = {
  schemaVersion: number;
  generatedAt: string;
  pricing: typeof pricing;
  latestSessionId: string | null;
  sessions: StoredSession[];
};

const ledgerPath = path.resolve(
  process.env.CONVERSATION_MEASUREMENT_LOG || path.join(process.cwd(), "logs", "conversation-cost-ledger.json"),
);
let loaded: LedgerFile | null = null;
let loadPromise: Promise<LedgerFile> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let inMemoryRevision = 0;
let persistedRevision = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFlushPromise: Promise<void> | null = null;
let resolvePendingFlush: (() => void) | null = null;

const COALESCE_WRITE_DELAY_MS = 120;
const MAX_COMPACT_DETAIL_STRING_CHARS = 240;
const MAX_STORED_DETAIL_STRING_CHARS = process.env.CONVERSATION_VERBOSE_TRACES === "1" ? 32_000 : 1_200;

const parseFiniteNonNegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const percentile = (values: number[], proportion: number): number => {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * proportion) - 1))];
};

const classifyCallWorkload = (
  record: ConversationMeasurementRecord,
  call: ConversationMeasurementCall,
): ConversationWorkloadCategory => {
  const model = String(call.model || "").toLowerCase();
  const provider = String(call.provider || "").toLowerCase();
  const route = String(record.route || "").toLowerCase();
  const purpose = String(call.metadata?.purpose || call.metadata?.role || "").toLowerCase();

  if (provider.includes("typesafe") || model.includes("jev")) {
    return "jev";
  }
  if (model.includes("embedding") || purpose.includes("embedding") || purpose.includes("rag")) {
    return "embedding";
  }
  if (
    route.startsWith("/memory")
    || purpose.includes("memory")
    || String(record.actionLabel || "").toLowerCase().includes("memory")
  ) {
    return "memory";
  }
  if (
    route.includes("voicetts")
    || route.includes("stt")
    || route.includes("live")
    || record.stage === "transcription"
    || model.includes("tts")
    || model.includes("whisper")
    || model.includes("grok-2-voice")
    || model.includes("gemini-3.1-flash-live")
    || (Number(call.durationSeconds) || 0) > 0
  ) {
    return "voice";
  }
  if (
    route.includes("startbrainstorm")
    || record.stage === "conversation"
    || model.startsWith("gpt-6")
    || model.startsWith("gpt-5")
  ) {
    return "main_concierge";
  }
  return "other";
};

const extractContextSizeSummary = (records: ConversationMeasurementRecord[]): ConversationContextSizeSummary => {
  const bySource = {
    knowledgeChars: 0,
    snapshotChars: 0,
    systemChars: 0,
    memoryChars: 0,
    actionEvidenceChars: 0,
    conversationChars: 0,
  };
  const byReason: Record<string, { count: number; totalCharacters: number; averageCharacters: number }> = {};
  let eventCount = 0;
  let totalCharacters = 0;

  for (const record of records) {
    // The Responses adapter records actual provider-bound inputs under the
    // newer event name. Prefer these over legacy pre-compilation estimates.
    const hasProviderInputs = (record.events || []).some(event => event.name === "concierge.input_context");
    for (const event of record.events || []) {
      if (hasProviderInputs ? event.name !== "concierge.input_context"
        : event.name !== "concierge.input_size" && event.name !== "concierge.compiled_input") {
        continue;
      }
      const detail = event.detail || {};
      const sources = Array.isArray(detail.sources) ? detail.sources : [];
      const sourceSize = (...names: string[]) => sources.reduce((sum, source) => {
        const characters = Number(source?.characters);
        return names.includes(source?.source) && Number.isFinite(characters) && characters > 0 ? sum + characters : sum;
      }, 0);
      const knowledge = Number(detail.knowledgeChars ?? detail.ragChars ?? sourceSize("knowledge", "retrieved_app_knowledge")) || 0;
      const snapshot = Number(detail.snapshotChars ?? detail.currentStateChars ?? sourceSize("current_snapshot", "snapshot", "requested_snapshot_fields")) || 0;
      const system = Number(detail.systemChars ?? detail.systemInstructionChars ?? sourceSize("system_context")) || 0;
      const memory = Number(detail.memoryChars ?? detail.retrievedMemoryChars ?? sourceSize("memory", "retrieved_session_memory", "retrieved_creation_memory")) || 0;
      const actionEvidence = Number(detail.actionEvidenceChars ?? detail.executionEvidenceChars ?? sourceSize("actions", "tool_calls", "tool_results")) || 0;
      const conversation = Number(detail.conversationChars ?? detail.historyChars ?? sourceSize("conversation")) || 0;
      const explicitTotal = Number(detail.serializedCharacters ?? detail.totalChars ?? detail.totalCharacters ?? 0) || 0;
      const eventTotal = explicitTotal > 0
        ? explicitTotal
        : knowledge + snapshot + system + memory + actionEvidence + conversation;

      eventCount += 1;
      totalCharacters += eventTotal;
      bySource.knowledgeChars += knowledge;
      bySource.snapshotChars += snapshot;
      bySource.systemChars += system;
      bySource.memoryChars += memory;
      bySource.actionEvidenceChars += actionEvidence;
      bySource.conversationChars += conversation;

      const reason = String(detail.reason || detail.callReason || detail.decisionReason || "unspecified").trim() || "unspecified";
      const currentReason = byReason[reason] || { count: 0, totalCharacters: 0, averageCharacters: 0 };
      currentReason.count += 1;
      currentReason.totalCharacters += eventTotal;
      currentReason.averageCharacters = Math.round(currentReason.totalCharacters / currentReason.count);
      byReason[reason] = currentReason;
    }
  }

  const divisor = Math.max(1, eventCount);
  return {
    eventCount,
    totalCharacters,
    averageCharacters: eventCount ? Math.round(totalCharacters / divisor) : 0,
    bySource,
    averageBySource: {
      knowledgeChars: eventCount ? Math.round(bySource.knowledgeChars / divisor) : 0,
      snapshotChars: eventCount ? Math.round(bySource.snapshotChars / divisor) : 0,
      systemChars: eventCount ? Math.round(bySource.systemChars / divisor) : 0,
      memoryChars: eventCount ? Math.round(bySource.memoryChars / divisor) : 0,
      actionEvidenceChars: eventCount ? Math.round(bySource.actionEvidenceChars / divisor) : 0,
      conversationChars: eventCount ? Math.round(bySource.conversationChars / divisor) : 0,
    },
    byReason,
  };
};

export function summarizeConversationRecords(records: ConversationMeasurementRecord[]) {
  const calls = records.flatMap(record => record.calls || []);
  const totalCostUsd = calls.reduce((sum, call) => sum + (Number(call.providerCostUsd) || 0), 0);
  const started = records.length ? Math.min(...records.map(record => Date.parse(record.startedAt))) : Date.now();
  const completed = records.length ? Math.max(...records.map(record => Date.parse(record.completedAt))) : started;
  const measuredWindowMs = Math.max(1, completed - started);
  const projectionFactor = 3_600_000 / measuredWindowMs;
  const latencies = records
    .map(record => parseFiniteNonNegativeNumber(record.elapsedMs))
    .filter((value): value is number => value !== null);
  const firstTokenLatencies = calls
    .map(call => parseFiniteNonNegativeNumber(call.metadata?.timeToFirstTokenMs))
    .filter((value): value is number => value !== null);
  const modelCallLatencies = calls
    .map(call => parseFiniteNonNegativeNumber(call.metadata?.durationMs ?? call.metadata?.elapsedMs))
    .filter((value): value is number => value !== null);
  const firstAudibleLatencies = records
    .flatMap(record => (record.events || [])
      .filter(event => event.name === "voice.first_audible" || event.name === "tts.first_audio")
      .map(event => parseFiniteNonNegativeNumber(event.detail?.latencyMs ?? event.elapsedMs)))
    .filter((value): value is number => value !== null);
  const firstMutationLatencies = records
    .flatMap(record => (record.events || [])
      .filter(event => event.name === "concierge.first_mutation" || event.name === "control.dispatched")
      .map(event => parseFiniteNonNegativeNumber(event.detail?.latencyMs ?? event.elapsedMs)))
    .filter((value): value is number => value !== null);

  const providerTotals = Object.values(calls.reduce((acc, call) => {
    const reasoningEffort = typeof call.metadata?.reasoningEffort === "string" ? call.metadata.reasoningEffort : undefined;
    const key = `${call.provider}:${call.model}:${reasoningEffort || ""}`;
    const row = acc[key] || {
      provider: call.provider,
      model: call.model,
      ...(reasoningEffort ? { reasoningEffort } : {}),
      calls: 0,
      costUsd: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      durationSeconds: 0,
    };
    row.calls += 1;
    row.costUsd += Number(call.providerCostUsd) || 0;
    row.inputTokens += Number(call.inputTokens) || 0;
    row.cachedInputTokens += Number(call.cachedInputTokens) || 0;
    row.outputTokens += Number(call.outputTokens) || 0;
    row.durationSeconds += Number(call.durationSeconds) || 0;
    acc[key] = row;
    return acc;
  }, {} as Record<string, {
    provider: string;
    model: string;
    reasoningEffort?: string;
    calls: number;
    costUsd: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    durationSeconds: number;
  }>));

  const workloadMap: Record<ConversationWorkloadCategory, ConversationWorkloadSummaryRow> = {
    main_concierge: { category: "main_concierge", calls: 0, costUsd: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, durationSeconds: 0 },
    jev: { category: "jev", calls: 0, costUsd: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, durationSeconds: 0 },
    memory: { category: "memory", calls: 0, costUsd: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, durationSeconds: 0 },
    embedding: { category: "embedding", calls: 0, costUsd: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, durationSeconds: 0 },
    voice: { category: "voice", calls: 0, costUsd: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, durationSeconds: 0 },
    other: { category: "other", calls: 0, costUsd: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, durationSeconds: 0 },
  };

  for (const record of records) {
    for (const call of record.calls || []) {
      const category = classifyCallWorkload(record, call);
      const bucket = workloadMap[category];
      bucket.calls += 1;
      bucket.costUsd += Number(call.providerCostUsd) || 0;
      bucket.inputTokens += Number(call.inputTokens) || 0;
      bucket.cachedInputTokens += Number(call.cachedInputTokens) || 0;
      bucket.outputTokens += Number(call.outputTokens) || 0;
      bucket.durationSeconds += Number(call.durationSeconds) || 0;
    }
  }

  const workloadTotals = Object.values(workloadMap)
    .filter(row => row.calls > 0)
    .map(row => ({
      ...row,
      costUsd: Number(row.costUsd.toFixed(9)),
      durationSeconds: Number(row.durationSeconds.toFixed(3)),
    }));

  const contextSize = extractContextSizeSummary(records);

  return {
    measuredWindowSeconds: Number((measuredWindowMs / 1000).toFixed(3)),
    requestCount: records.length,
    providerCallCount: calls.length,
    successfulRequests: records.filter(record => record.status === "succeeded").length,
    failedRequests: records.filter(record => record.status !== "succeeded").length,
    totalCostUsd: Number(totalCostUsd.toFixed(9)),
    projectedOneHourCostUsd: Number((totalCostUsd * projectionFactor).toFixed(6)),
    projectedRequestsPerHour: Number((records.length * projectionFactor).toFixed(2)),
    projectionStatus: measuredWindowMs < 600_000 ? "preliminary_under_10_minutes" : "representative_sample",
    speedMs: {
      averageRequest: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      p50Request: Math.round(percentile(latencies, 0.5)),
      p95Request: Math.round(percentile(latencies, 0.95)),
      averageTimeToFirstToken: firstTokenLatencies.length
        ? Math.round(firstTokenLatencies.reduce((sum, value) => sum + value, 0) / firstTokenLatencies.length)
        : null,
      p95TimeToFirstToken: firstTokenLatencies.length
        ? Math.round(percentile(firstTokenLatencies, 0.95))
        : null,
      validFirstTokenSamples: firstTokenLatencies.length,
      missingFirstTokenSamples: Math.max(0, calls.length - firstTokenLatencies.length),
      averageModelCall: modelCallLatencies.length
        ? Math.round(modelCallLatencies.reduce((sum, value) => sum + value, 0) / modelCallLatencies.length)
        : null,
      averageFirstAudible: firstAudibleLatencies.length
        ? Math.round(firstAudibleLatencies.reduce((sum, value) => sum + value, 0) / firstAudibleLatencies.length)
        : null,
      averageFirstMutation: firstMutationLatencies.length
        ? Math.round(firstMutationLatencies.reduce((sum, value) => sum + value, 0) / firstMutationLatencies.length)
        : null,
    },
    providerTotals: providerTotals.map(row => ({
      ...row,
      costUsd: Number(row.costUsd.toFixed(9)),
      projectedOneHourCostUsd: Number((row.costUsd * projectionFactor).toFixed(6)),
      durationSeconds: Number(row.durationSeconds.toFixed(3)),
    })),
    workloadTotals,
    contextSize,
  };
}

const boundValueStrings = (value: unknown, maxChars: number, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > maxChars ? `${value.slice(0, maxChars)}…[+${value.length - maxChars} chars]` : value;
  }
  if (typeof value !== "object") return value;
  if (depth >= 4) return "[truncated-depth]";
  if (Array.isArray(value)) {
    return value.slice(0, 24).map(item => boundValueStrings(item, maxChars, depth + 1));
  }
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 32);
  for (const [k, v] of entries) {
    out[k] = boundValueStrings(v, maxChars, depth + 1);
  }
  return out;
};

const sanitizeRecordForStorage = (record: ConversationMeasurementRecord): ConversationMeasurementRecord => ({
  ...record,
  calls: (record.calls || []).map(call => ({
    ...call,
    ...(call.metadata
      ? { metadata: boundValueStrings(call.metadata, MAX_STORED_DETAIL_STRING_CHARS) as Record<string, unknown> }
      : {}),
  })),
  events: (record.events || []).slice(-120).map(event => ({
    ...event,
    ...(event.detail
      ? { detail: boundValueStrings(event.detail, MAX_STORED_DETAIL_STRING_CHARS) as Record<string, unknown> }
      : {}),
  })),
});

export const compactRecordForDisplay = (record: ConversationMeasurementRecord): ConversationMeasurementRecord => ({
  ...record,
  calls: (record.calls || []).map(call => ({
    ...call,
    ...(call.metadata
      ? { metadata: boundValueStrings(call.metadata, MAX_COMPACT_DETAIL_STRING_CHARS) as Record<string, unknown> }
      : {}),
  })),
  events: (record.events || []).slice(-20).map(event => ({
    ...event,
    ...(event.detail
      ? { detail: boundValueStrings(event.detail, MAX_COMPACT_DETAIL_STRING_CHARS) as Record<string, unknown> }
      : {}),
  })),
});

const emptyLedger = (): LedgerFile => ({
  schemaVersion: CONVERSATION_MEASUREMENT_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  pricing,
  latestSessionId: null,
  sessions: [],
});

async function loadLedger(): Promise<LedgerFile> {
  if (loaded) return loaded;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const parsed = JSON.parse(await fs.readFile(ledgerPath, "utf8"));
      loaded = parsed?.schemaVersion === CONVERSATION_MEASUREMENT_SCHEMA_VERSION ? parsed : emptyLedger();
    } catch {
      loaded = emptyLedger();
    }
    return loaded!;
  })();
  return loadPromise;
}

async function saveLedger(ledger: LedgerFile): Promise<void> {
  ledger.generatedAt = new Date().toISOString();
  ledger.pricing = pricing;
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function scheduleLedgerFlush(): void {
  if (!pendingFlushPromise) {
    pendingFlushPromise = new Promise<void>(resolve => {
      resolvePendingFlush = resolve;
    });
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const targetRevision = inMemoryRevision;
    writeQueue = writeQueue
      .then(async () => {
        const ledger = await loadLedger();
        await saveLedger(ledger);
        persistedRevision = Math.max(persistedRevision, targetRevision);
      })
      .catch(error => console.error("[ConversationMeasurement] write failed:", error))
      .finally(() => {
        if (persistedRevision >= inMemoryRevision) {
          const done = resolvePendingFlush;
          pendingFlushPromise = null;
          resolvePendingFlush = null;
          done?.();
        } else {
          scheduleLedgerFlush();
        }
      });
  }, COALESCE_WRITE_DELAY_MS);
  if (typeof (flushTimer as any)?.unref === "function") {
    (flushTimer as any).unref();
  }
}

export const flushConversationMeasurementLedger = async (): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
    const targetRevision = inMemoryRevision;
    writeQueue = writeQueue
      .then(async () => {
        const ledger = await loadLedger();
        await saveLedger(ledger);
        persistedRevision = Math.max(persistedRevision, targetRevision);
      })
      .catch(error => console.error("[ConversationMeasurement] write failed:", error))
      .finally(() => {
        const done = resolvePendingFlush;
        pendingFlushPromise = null;
        resolvePendingFlush = null;
        done?.();
      });
  }
  if (pendingFlushPromise) {
    await pendingFlushPromise;
  }
  await writeQueue;
};

const applyRecordToLedger = (ledger: LedgerFile, rawRecord: ConversationMeasurementRecord): void => {
  const record = sanitizeRecordForStorage(rawRecord);
  let session = ledger.sessions.find(item => item.sessionId === record.sessionId);
  if (!session) {
    session = {
      sessionId: record.sessionId,
      startedAt: record.startedAt,
      updatedAt: record.completedAt,
      measuredWindowMs: 0,
      summary: summarizeConversationRecords([]),
      records: [],
    };
    ledger.sessions.push(session);
  }
  const duplicateIndex = session.records.findIndex(item => item.requestId === record.requestId);
  if (duplicateIndex >= 0) session.records[duplicateIndex] = record;
  else session.records.push(record);
  session.records = session.records.slice(-1000);
  session.startedAt = new Date(Math.min(...session.records.map(item => Date.parse(item.startedAt)))).toISOString();
  session.updatedAt = new Date(Math.max(...session.records.map(item => Date.parse(item.completedAt)))).toISOString();
  session.measuredWindowMs = Math.max(1, Date.parse(session.updatedAt) - Date.parse(session.startedAt));
  session.summary = summarizeConversationRecords(session.records);
  ledger.latestSessionId = record.sessionId;
  ledger.sessions = ledger.sessions.slice(-20);
  inMemoryRevision += 1;
};

export const appendConversationMeasurement = (record: ConversationMeasurementRecord): void => {
  if (!record.sessionId || !record.requestId) return;
  if (loaded) {
    applyRecordToLedger(loaded, record);
    scheduleLedgerFlush();
    return;
  }
  void loadLedger()
    .then(ledger => {
      applyRecordToLedger(ledger, record);
      scheduleLedgerFlush();
    })
    .catch(error => console.error("[ConversationMeasurement] append load failed:", error));
};

export type ReadConversationMeasurementOptions = {
  compact?: boolean;
  offset?: number;
  limit?: number;
};

export const buildCompactConversationSessionView = (
  session: StoredSession,
  options: { offset?: number; limit?: number } = {},
): CompactConversationSessionView => {
  const total = session.records.length;
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 25)));
  const orderedNewestFirst = [...session.records].reverse();
  const safeOffset = Math.max(0, Math.min(total, Math.floor(Number(options.offset) || 0)));
  const pageRecords = orderedNewestFirst
    .slice(safeOffset, safeOffset + safeLimit)
    .map(compactRecordForDisplay);

  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    measuredWindowMs: session.measuredWindowMs,
    summary: session.summary,
    totalRecordCount: total,
    page: {
      offset: safeOffset,
      limit: safeLimit,
      total,
      hasMore: safeOffset + pageRecords.length < total,
    },
    watermark: {
      inMemoryRevision,
      persistedRevision,
      flushPending: inMemoryRevision > persistedRevision,
    },
    records: pageRecords,
  };
};

export const readConversationMeasurementLedger = async (
  sessionId?: string,
  options: ReadConversationMeasurementOptions = {},
): Promise<LedgerFile | StoredSession | CompactConversationSessionView | null> => {
  const ledger = await loadLedger();
  if (!sessionId) {
    if (options.compact) {
      return {
        ...ledger,
        sessions: ledger.sessions.map(s => ({
          ...s,
          records: s.records.slice(-10).map(compactRecordForDisplay),
        })),
      };
    }
    return ledger;
  }
  const session = ledger.sessions.find(item => item.sessionId === sessionId) || null;
  if (!session) return null;
  // Old files retain summaries made by the previous event-name reader. Refresh
  // just this small summary from existing events without rewriting the log.
  const currentSession = {
    ...session,
    summary: { ...session.summary, contextSize: extractContextSizeSummary(session.records) },
  };
  if (options.compact) {
    return buildCompactConversationSessionView(currentSession, {
      offset: options.offset,
      limit: options.limit,
    });
  }
  return currentSession;
};

export const resetConversationMeasurementSession = async (sessionId: string): Promise<void> => {
  const ledger = await loadLedger();
  ledger.sessions = ledger.sessions.filter(item => item.sessionId !== sessionId);
  ledger.latestSessionId = ledger.sessions.at(-1)?.sessionId || null;
  inMemoryRevision += 1;
  scheduleLedgerFlush();
  await flushConversationMeasurementLedger();
};

export const conversationMeasurementLogPath = (): string => ledgerPath;
