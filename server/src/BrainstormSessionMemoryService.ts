import OpenAI from "openai";
import { Pinecone, type PineconeRecord, type RecordMetadata } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import { createEmbeddingWithProviderRouting } from "./falEmbeddings";

dotenv.config();

const DEFAULT_INDEX_NAME = "pineconebase";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const SESSION_MEMORY_SOURCE_TYPE = "brainstorm-session-memory";
const SESSION_MEMORY_RECORD_TYPES = {
  ARCHIVE_CHUNK: "archive_chunk",
  MEMORY_CARD: "memory_card",
  CANON_CARD: "canon_card",
} as const;
type BrainstormSessionMemoryRecordType = (typeof SESSION_MEMORY_RECORD_TYPES)[keyof typeof SESSION_MEMORY_RECORD_TYPES];
const DEFAULT_SESSION_MEMORY_TOP_K = 8;
const DEFAULT_SESSION_MEMORY_MIN_SCORE = 0.18;
const DEFAULT_SESSION_MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

const getOpenAiApiKey = (): string => {
  const key = process.env.DALLE_KEY;
  if (!key) throw new Error("Missing DALLE_KEY for Brainstorm session memory");
  return key;
};

const getPineconeApiKey = (): string => {
  const key = process.env.PINECONE_API_KEY || process.env.PINECONE_KEY;
  if (!key) throw new Error("Missing Pinecone API key for Brainstorm session memory");
  return key;
};

const getPineconeIndexName = (): string => process.env.PINECONE_INDEX || DEFAULT_INDEX_NAME;
const getEmbeddingModel = (): string => process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
const toPositiveNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const getSessionMemoryTopK = (): number => toPositiveNumber(process.env.BRAINSTORM_SESSION_MEMORY_TOP_K, DEFAULT_SESSION_MEMORY_TOP_K);
const getSessionMemoryMinScore = (): number => toPositiveNumber(process.env.BRAINSTORM_SESSION_MEMORY_MIN_SCORE, DEFAULT_SESSION_MEMORY_MIN_SCORE);
const getSessionMemoryTtlMs = (): number => toPositiveNumber(process.env.BRAINSTORM_SESSION_MEMORY_TTL_MS, DEFAULT_SESSION_MEMORY_TTL_MS);

let openaiClient: OpenAI | null = null;
let pineconeClient: Pinecone | null = null;

const getOpenAiClient = (): OpenAI => {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  return openaiClient;
};

const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) pineconeClient = new Pinecone({ apiKey: getPineconeApiKey() });
  return pineconeClient;
};

export type BrainstormSessionIdentity = {
  userId?: number | string | null;
  username?: string | null;
  sessionId?: string | null;
  deviceId?: string | null;
};

type NormalizedBrainstormSessionIdentity = {
  userId: number;
  username: string;
  sessionId: string;
  deviceId: string;
  namespace: string;
};

export type BrainstormSessionMemoryInputRecord = {
  recordType?: BrainstormSessionMemoryRecordType;
  memoryKind: string;
  title: string;
  text: string;
  entities?: string[];
  aliases?: string[];
  domains?: string[];
  sceneNumber?: string;
  importance?: number;
  turnStart?: number;
  turnEnd?: number;
  slotId?: number;
  mode?: number | string;
  canonicalId?: string;
  cardType?: string;
  status?: string;
  operation?: string;
  vectorId?: string;
};

export type BrainstormSessionCanonOperationInput = {
  operation: string;
  cardType: string;
  title: string;
  canonicalTitle?: string;
  aliases?: string[];
  domains?: string[];
  facts?: string[];
  text?: string;
  entities?: string[];
  sceneNumber?: string;
  importance?: number;
  confidence?: number;
  turnStart?: number;
  turnEnd?: number;
  slotId?: number;
  mode?: number | string;
};

type BrainstormSessionMemoryMetadata = RecordMetadata & {
  text: string;
  title: string;
  sourceType: string;
  recordType: string;
  userId: number;
  username: string;
  sessionId: string;
  deviceId: string;
  memoryKind: string;
  canonicalId: string;
  cardType: string;
  entities: string[];
  aliases: string[];
  domains: string[];
  sceneNumber: string;
  mode: string;
  status: string;
  operation: string;
  turnStart: number;
  turnEnd: number;
  slotId: number;
  importance: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  createdAtIso: string;
  updatedAtIso: string;
  expiresAtIso: string;
};

export type BrainstormSessionMemoryMatch = {
  id: string;
  score: number;
  title: string;
  text: string;
  recordType: string;
  memoryKind: string;
  canonicalId: string;
  cardType: string;
  entities: string[];
  aliases: string[];
  domains: string[];
  sceneNumber: string;
  status: string;
  turnStart: number;
  turnEnd: number;
  slotId: number;
  importance: number;
  updatedAt: number;
  expiresAt: number;
};

export type BrainstormSessionMemoryContext = {
  status: "found" | "not_found" | "skipped" | "error";
  contextBlock: string;
  matches: BrainstormSessionMemoryMatch[];
  namespace?: string;
  reason?: string;
};

export type BrainstormSessionMemoryIndexResult = {
  indexName: string;
  namespace: string;
  embeddingModel: string;
  vectorIds: string[];
  canonVectorIds?: string[];
  deletedVectorIds?: string[];
  expiresAt: number;
};

export type BrainstormCreationMemorySyncOperation = {
  action: "upsert" | "delete";
  cardKey: string;
  title?: string;
  text?: string;
  cardType?: string;
  sceneNumber?: string;
  entities?: string[];
  domains?: string[];
  mode?: number | string;
  importance?: number;
};

export type BrainstormCreationMemorySyncResult = {
  namespace: string;
  upsertedVectorIds: string[];
  deletedVectorIds: string[];
  expiresAt: number;
};

export type BrainstormSessionMemoryDevRow = {
  id: number;
  rag_id: string;
  title: string;
  instructions: string;
  source_type: typeof SESSION_MEMORY_SOURCE_TYPE;
  record_type?: string;
  namespace: string;
  vector_id: string;
  session_id: string;
  device_id: string;
  expires_at: number;
  memory_kind: string;
  card_type?: string;
  aliases?: string[];
  domains?: string[];
  memory_status?: string;
  turn_start: number;
  turn_end: number;
  slot_id: number;
  preview_text: string;
};

const safePineconePart = (value: unknown, fallback: string): string => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || fallback;
};

const safeVectorPart = (value: unknown, fallback: string): string => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return cleaned || fallback;
};
const normalizeLookupValue = (value: unknown): string => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/["'`]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const uniqueCleanList = (value: unknown, limit = 24): string[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of source) {
    const cleaned = String(item || "").trim();
    if (!cleaned) continue;
    const key = normalizeLookupValue(cleaned) || cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned.slice(0, 180));
    if (result.length >= limit) break;
  }
  return result;
};

const buildCanonicalId = (cardType: string, title: string, aliases: string[] = []): string => {
  const normalizedTitle = normalizeLookupValue(title) || normalizeLookupValue(aliases[0]) || "card";
  return `${safePineconePart(cardType || "general_note", "general_note")}::${safeVectorPart(normalizedTitle.replace(/\s+/g, "-"), "card")}`;
};

const renderCanonOperationText = (operation: BrainstormSessionCanonOperationInput): string => {
  const facts = uniqueCleanList(operation.facts, 18);
  const aliases = uniqueCleanList(operation.aliases, 24);
  const domains = uniqueCleanList(operation.domains, 16);
  const lines = [
    "ACTIVE CANON CARD",
    `Card type: ${safePineconePart(operation.cardType || "general_note", "general_note")}`,
    `Title: ${String(operation.canonicalTitle || operation.title || "").trim()}`,
    aliases.length ? `Aliases: ${aliases.join(", ")}` : "",
    domains.length ? `Domains: ${domains.join(", ")}` : "",
    `Latest operation: ${String(operation.operation || "update")}`,
    facts.length ? "Facts:" : "",
    ...facts.map((fact) => `- ${fact}`),
    operation.text ? "Canon text:" : "",
    String(operation.text || "").trim(),
  ].filter(Boolean);
  return lines.join("\n").slice(0, 18000);
};

const canonOperationToRecord = (
  scoped: NormalizedBrainstormSessionIdentity,
  operation: BrainstormSessionCanonOperationInput
): BrainstormSessionMemoryInputRecord | null => {
  const op = safePineconePart(operation.operation || "update", "update").toLowerCase();
  if (op === "no_change" || op === "delete") return null;
  const cardType = safePineconePart(operation.cardType || "general_note", "general_note");
  const title = String(operation.canonicalTitle || operation.title || "").trim();
  if (!title) return null;
  const aliases = uniqueCleanList(operation.aliases, 24);
  const canonicalId = buildCanonicalId(cardType, title, aliases);
  const vectorId = ["session-memory", scoped.sessionId, scoped.deviceId, "canon", safeVectorPart(canonicalId, "card")].join("::");
  return {
    recordType: SESSION_MEMORY_RECORD_TYPES.CANON_CARD,
    memoryKind: cardType,
    cardType,
    canonicalId,
    vectorId,
    title,
    text: renderCanonOperationText(operation),
    aliases,
    domains: uniqueCleanList(operation.domains, 16),
    entities: uniqueCleanList([...(operation.entities || []), ...aliases], 32),
    sceneNumber: String(operation.sceneNumber || ""),
    importance: Math.max(1, Math.min(5, Number(operation.importance || 4))),
    turnStart: Number(operation.turnStart || 0),
    turnEnd: Number(operation.turnEnd || 0),
    slotId: Number(operation.slotId || 0),
    mode: operation.mode,
    status: "active",
    operation: op,
  };
};

const canonOperationToDeleteVectorId = (
  scoped: NormalizedBrainstormSessionIdentity,
  operation: BrainstormSessionCanonOperationInput
): string => {
  const cardType = safePineconePart(operation.cardType || "general_note", "general_note");
  const title = String(operation.canonicalTitle || operation.title || "").trim();
  if (!title) return "";
  const canonicalId = buildCanonicalId(cardType, title, uniqueCleanList(operation.aliases, 24));
  return ["session-memory", scoped.sessionId, scoped.deviceId, "canon", safeVectorPart(canonicalId, "card")].join("::");
};

export const normalizeBrainstormSessionIdentity = (
  identity: BrainstormSessionIdentity | null | undefined
): NormalizedBrainstormSessionIdentity | null => {
  const userId = Number(identity?.userId);
  const sessionId = safeVectorPart(identity?.sessionId, "");
  const deviceId = safeVectorPart(identity?.deviceId, "");
  if (!Number.isFinite(userId) || userId <= 0 || !sessionId || !deviceId) return null;

  const username = safePineconePart(identity?.username, "guest");
  return {
    userId,
    username,
    sessionId,
    deviceId,
    namespace: `clikb-user-${userId}-${username}WithClikB`,
  };
};

const buildCreationMemoryVectorId = (
  scoped: NormalizedBrainstormSessionIdentity,
  cardKey: string
): string => [
  "session-memory",
  scoped.sessionId,
  scoped.deviceId,
  "canon",
  safeVectorPart(cardKey, "creation-card"),
].join("::");

const buildBrainstormSessionMemoryQuery = (query: string, recentContext?: string): string => [
  "Current user message:",
  String(query || "").trim() || "(no explicit text)",
  "",
  "Recent live conversation context:",
  String(recentContext || "").trim().slice(-2200),
  "",
  "Retrieve active canon cards first, then supporting raw archive chunks and extracted memory cards. The user may ask about creative content, app behavior, characters, environments, events, goals, plots, camera language, workflows, preferences, corrections, or general context.",
].join("\n");

const toBrainstormSessionMemoryMatch = (
  match: PineconeRecord<BrainstormSessionMemoryMetadata> & { score?: number }
): BrainstormSessionMemoryMatch | null => {
  const metadata = match.metadata;
  const text = String(metadata?.text || "").trim();
  const title = String(metadata?.title || "").trim();
  if (!text || !title) return null;

  return {
    id: match.id,
    score: Number(match.score || 0),
    title,
    text,
    recordType: String(metadata?.recordType || SESSION_MEMORY_RECORD_TYPES.MEMORY_CARD),
    memoryKind: String(metadata?.memoryKind || "note"),
    canonicalId: String(metadata?.canonicalId || ""),
    cardType: String(metadata?.cardType || metadata?.memoryKind || ""),
    entities: Array.isArray(metadata?.entities) ? metadata.entities.map(String) : [],
    aliases: Array.isArray(metadata?.aliases) ? metadata.aliases.map(String) : [],
    domains: Array.isArray(metadata?.domains) ? metadata.domains.map(String) : [],
    sceneNumber: String(metadata?.sceneNumber || ""),
    status: String(metadata?.status || "active"),
    turnStart: Number(metadata?.turnStart || 0),
    turnEnd: Number(metadata?.turnEnd || 0),
    slotId: Number(metadata?.slotId || 0),
    importance: Number(metadata?.importance || 0),
    updatedAt: Number(metadata?.updatedAt || metadata?.createdAt || 0),
    expiresAt: Number(metadata?.expiresAt || 0),
  };
};

const renderMemoryMatch = (match: BrainstormSessionMemoryMatch, index: number): string => [
  `Memory ${index + 1}: ${match.title}`,
  `Record type: ${match.recordType}`,
  `Kind: ${match.memoryKind}`,
  match.cardType ? `Card type: ${match.cardType}` : "",
  match.status ? `Status: ${match.status}` : "",
  match.aliases.length ? `Aliases: ${match.aliases.join(", ")}` : "",
  match.domains.length ? `Domains: ${match.domains.join(", ")}` : "",
  match.sceneNumber ? `Scene: ${match.sceneNumber}` : "",
  match.entities.length ? `Entities: ${match.entities.join(", ")}` : "",
  `Turns: ${match.turnStart || "?"}-${match.turnEnd || "?"}`,
  match.text,
].filter(Boolean).join("\n");

const renderBrainstormSessionRecallBlock = (
  status: BrainstormSessionMemoryContext["status"],
  matches: BrainstormSessionMemoryMatch[],
  reason?: string
): string => {
  if (status === "found") {
    const activeCanon = matches.filter((match) => match.recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD && match.status !== "deleted");
    const supportingMemory = matches.filter((match) => !activeCanon.some((canon) => canon.id === match.id));
    const rendered = [
      activeCanon.length ? ["ACTIVE SESSION CANON:", ...activeCanon.map(renderMemoryMatch)].join("\n\n") : "",
      supportingMemory.length ? ["RECENT OR HISTORICAL SESSION ARCHIVE:", ...supportingMemory.map(renderMemoryMatch)].join("\n\n") : "",
    ].filter(Boolean).join("\n\n");

    return [
      "SESSION_RECALL_STATUS: found",
      "SESSION_RECALL_KIND: temporary Brainstorm session memory",
      "SESSION_RECALL_RULES:",
      "- ACTIVE SESSION CANON is the latest known truth for this session. Prefer it over older summaries or archive chunks.",
      "- RECENT OR HISTORICAL SESSION ARCHIVE preserves exact chat text and extracted sections. Use it for missing detail, but treat it as lower authority when it conflicts with active canon or the newest user message.",
      "- Preserve names, aliases, character traits, relationships, world rules, app context, visual style, camera language, sequence logic, rejected ideas, user preferences, goals, and open questions unless the user clearly changes direction.",
      "- If retrieved memory conflicts with the newest user message, follow the newest user message and naturally update direction.",
      "- Do not mention Pinecone, embeddings, retrieval, memory chunks, scores, or internal storage.",
      "SESSION_RECALL_CONTEXT:",
      rendered,
    ].join("\n");
  }

  if (status === "not_found") {
    return [
      "SESSION_RECALL_STATUS: not_found",
      "SESSION_RECALL_RULES:",
      "- No older matching Brainstorm session memory was retrieved. Continue from the visible recent chat and live app context.",
    ].join("\n");
  }

  if (status === "error") {
    return [
      "SESSION_RECALL_STATUS: unavailable",
      "SESSION_RECALL_RULES:",
      "- Temporary Brainstorm session memory could not be searched. Continue normally without mentioning the memory system.",
    ].join("\n");
  }

  return [
    "SESSION_RECALL_STATUS: skipped",
    `SESSION_RECALL_REASON: ${reason || "missing scoped session identity"}`,
    "SESSION_RECALL_RULES:",
    "- Continue normally from the visible recent chat and live app context.",
  ].join("\n");
};
export const indexBrainstormSessionMemoryRecords = async ({
  identity,
  records,
  canonOperations,
}: {
  identity: BrainstormSessionIdentity | null | undefined;
  records: BrainstormSessionMemoryInputRecord[];
  canonOperations?: BrainstormSessionCanonOperationInput[];
}): Promise<BrainstormSessionMemoryIndexResult | null> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  if (!scoped) return null;

  const normalizedCanonOperations = Array.isArray(canonOperations) ? canonOperations : [];
  const deletedVectorIds = normalizedCanonOperations
    .filter((operation) => safePineconePart(operation.operation || "", "").toLowerCase() === "delete")
    .map((operation) => canonOperationToDeleteVectorId(scoped, operation))
    .filter(Boolean);
  const canonRecords = normalizedCanonOperations
    .map((operation) => canonOperationToRecord(scoped, operation))
    .filter((record): record is BrainstormSessionMemoryInputRecord => Boolean(record));

  const cleanRecords = [...records, ...canonRecords]
    .map((record) => {
      const recordType = record.recordType || SESSION_MEMORY_RECORD_TYPES.MEMORY_CARD;
      const memoryKind = safePineconePart(record.memoryKind || record.cardType || "note", "note");
      const cardType = safePineconePart(record.cardType || record.memoryKind || "", "");
      return {
        ...record,
        recordType,
        title: String(record.title || "").trim(),
        text: String(record.text || "").trim().slice(0, 18000),
        memoryKind,
        cardType,
        canonicalId: String(record.canonicalId || "").trim(),
        aliases: uniqueCleanList(record.aliases, 24),
        domains: uniqueCleanList(record.domains, 16),
        entities: uniqueCleanList(record.entities, 24),
        sceneNumber: String(record.sceneNumber || "").trim().slice(0, 80),
        importance: Math.max(1, Math.min(5, Number(record.importance || (recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD ? 4 : 3)))),
        turnStart: Number(record.turnStart || 0),
        turnEnd: Number(record.turnEnd || 0),
        slotId: Number(record.slotId || 0),
        mode: String(record.mode ?? ""),
        status: safePineconePart(record.status || (recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD ? "active" : "indexed"), "active"),
        operation: safePineconePart(record.operation || "index", "index"),
        vectorId: record.vectorId ? String(record.vectorId).trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 240) : "",
      };
    })
    .filter((record) => record.title && record.text);

  const embeddingModel = getEmbeddingModel();
  const indexName = getPineconeIndexName();
  const pineconeIndex = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: indexName });
  const createdAt = Date.now();
  const expiresAt = createdAt + getSessionMemoryTtlMs();
  const createdAtIso = new Date(createdAt).toISOString();
  const expiresAtIso = new Date(expiresAt).toISOString();

  if (deletedVectorIds.length) {
    await pineconeIndex.deleteMany({ namespace: scoped.namespace, ids: deletedVectorIds });
  }

  if (cleanRecords.length === 0) {
    return deletedVectorIds.length ? {
      indexName,
      namespace: scoped.namespace,
      embeddingModel,
      vectorIds: [],
      canonVectorIds: [],
      deletedVectorIds,
      expiresAt,
    } : null;
  }

  const embeddingInputs = cleanRecords.map((record) => [
    `Record type: ${record.recordType}`,
    `Kind: ${record.memoryKind}`,
    record.cardType ? `Card type: ${record.cardType}` : "",
    `Title: ${record.title}`,
    record.aliases.length ? `Aliases: ${record.aliases.join(", ")}` : "",
    record.domains.length ? `Domains: ${record.domains.join(", ")}` : "",
    record.entities.length ? `Entities: ${record.entities.join(", ")}` : "",
    record.sceneNumber ? `Scene: ${record.sceneNumber}` : "",
    record.text,
  ].filter(Boolean).join("\n"));

  const embeddingResponse = await createEmbeddingWithProviderRouting({
    openai: getOpenAiClient(),
    model: embeddingModel,
    input: embeddingInputs,
    metadata: { sessionMemoryEmbedding: true },
  });

  if (embeddingResponse.data.length !== cleanRecords.length) {
    throw new Error("OpenAI returned an unexpected number of session-memory embeddings");
  }

  const recordsToUpsert: Array<PineconeRecord<BrainstormSessionMemoryMetadata>> = cleanRecords.map((record, index) => {
    const id = record.vectorId || (record.recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD
      ? ["session-memory", scoped.sessionId, scoped.deviceId, "canon", safeVectorPart(record.canonicalId || buildCanonicalId(record.cardType || record.memoryKind, record.title, record.aliases), "card")].join("::")
      : [
          "session-memory",
          scoped.sessionId,
          scoped.deviceId,
          record.recordType,
          `slot-${record.slotId || "x"}`,
          `turn-${record.turnStart || "x"}-${record.turnEnd || "x"}`,
          `${index + 1}-${safeVectorPart(record.memoryKind, "note")}`,
        ].join("::"));
    const updatedAt = Date.now();
    const updatedAtIso = new Date(updatedAt).toISOString();

    return {
      id,
      values: embeddingResponse.data[index].embedding,
      metadata: {
        text: record.text,
        title: record.title,
        sourceType: SESSION_MEMORY_SOURCE_TYPE,
        recordType: record.recordType || SESSION_MEMORY_RECORD_TYPES.MEMORY_CARD,
        userId: scoped.userId,
        username: scoped.username,
        sessionId: scoped.sessionId,
        deviceId: scoped.deviceId,
        memoryKind: record.memoryKind,
        canonicalId: record.canonicalId || "",
        cardType: record.cardType || "",
        entities: record.entities,
        aliases: record.aliases,
        domains: record.domains,
        sceneNumber: record.sceneNumber,
        mode: record.mode,
        status: record.status,
        operation: record.operation,
        turnStart: record.turnStart,
        turnEnd: record.turnEnd,
        slotId: record.slotId,
        importance: record.importance,
        createdAt,
        updatedAt,
        expiresAt,
        createdAtIso,
        updatedAtIso,
        expiresAtIso,
      },
    };
  });

  await pineconeIndex.upsert({ records: recordsToUpsert, namespace: scoped.namespace });

  return {
    indexName,
    namespace: scoped.namespace,
    embeddingModel,
    vectorIds: recordsToUpsert.map((record) => record.id),
    canonVectorIds: recordsToUpsert
      .filter((record) => record.metadata?.recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD)
      .map((record) => record.id),
    deletedVectorIds,
    expiresAt,
  };
};

export const syncBrainstormCreationMemoryCards = async ({
  identity,
  operations,
}: {
  identity: BrainstormSessionIdentity | null | undefined;
  operations: BrainstormCreationMemorySyncOperation[];
}): Promise<BrainstormCreationMemorySyncResult | null> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  if (!scoped) return null;

  const cleanOperations = (Array.isArray(operations) ? operations : [])
    .map((operation) => ({
      ...operation,
      action: operation?.action === "delete" ? "delete" as const : "upsert" as const,
      cardKey: String(operation?.cardKey || "").trim().slice(0, 220),
      title: String(operation?.title || "").trim().slice(0, 240),
      text: String(operation?.text || "").trim().slice(0, 18000),
    }))
    .filter((operation) => operation.cardKey.startsWith("project:"));

  const deleteOperations = cleanOperations.filter((operation) => operation.action === "delete");
  const upsertOperations = cleanOperations.filter((operation) => operation.action === "upsert" && operation.text);
  const deletedVectorIds = deleteOperations.map((operation) => buildCreationMemoryVectorId(scoped, operation.cardKey));

  if (deletedVectorIds.length) {
    const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
    await index.deleteMany({ namespace: scoped.namespace, ids: deletedVectorIds });
  }

  const records: BrainstormSessionMemoryInputRecord[] = upsertOperations.map((operation) => ({
    recordType: SESSION_MEMORY_RECORD_TYPES.CANON_CARD,
    memoryKind: safePineconePart(operation.cardType || "creation_state", "creation_state"),
    cardType: safePineconePart(operation.cardType || "creation_state", "creation_state"),
    canonicalId: operation.cardKey,
    vectorId: buildCreationMemoryVectorId(scoped, operation.cardKey),
    title: operation.title || operation.cardKey,
    text: operation.text,
    entities: uniqueCleanList(operation.entities, 32),
    domains: uniqueCleanList(["guide_content_creation", ...(operation.domains || [])], 20),
    sceneNumber: String(operation.sceneNumber || ""),
    importance: Math.max(1, Math.min(5, Number(operation.importance || 5))),
    mode: operation.mode,
    status: "active",
    operation: "source_change",
  }));

  const indexed = records.length
    ? await indexBrainstormSessionMemoryRecords({ identity: scoped, records })
    : null;

  return {
    namespace: scoped.namespace,
    upsertedVectorIds: indexed?.vectorIds || [],
    deletedVectorIds,
    expiresAt: indexed?.expiresAt || (Date.now() + getSessionMemoryTtlMs()),
  };
};

export const deleteExpiredBrainstormSessionMemory = async (
  identity: BrainstormSessionIdentity | null | undefined
): Promise<{ namespace: string; deleted: boolean } | null> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  if (!scoped) return null;

  const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
  await index.deleteMany({
    namespace: scoped.namespace,
    filter: {
      sourceType: { $eq: SESSION_MEMORY_SOURCE_TYPE },
      userId: { $eq: scoped.userId },
      expiresAt: { $lte: Date.now() },
    },
  });
  return { namespace: scoped.namespace, deleted: true };
};

export const deleteBrainstormSessionMemoryScope = async ({
  identity,
  sessionId,
  deviceId,
}: {
  identity: BrainstormSessionIdentity | null | undefined;
  sessionId?: string | null;
  deviceId?: string | null;
}): Promise<{ namespace: string; deleted: boolean } | null> => {
  const scoped = normalizeBrainstormSessionIdentity({
    ...(identity || {}),
    sessionId: sessionId || identity?.sessionId,
    deviceId: deviceId || identity?.deviceId,
  });
  if (!scoped) return null;

  const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
  await index.deleteMany({
    namespace: scoped.namespace,
    filter: {
      sourceType: { $eq: SESSION_MEMORY_SOURCE_TYPE },
      userId: { $eq: scoped.userId },
      sessionId: { $eq: scoped.sessionId },
      deviceId: { $eq: scoped.deviceId },
    },
  });
  return { namespace: scoped.namespace, deleted: true };
};

export const deleteBrainstormSessionMemoryItem = async ({
  identity,
  vectorId,
}: {
  identity: BrainstormSessionIdentity | null | undefined;
  vectorId: string;
}): Promise<{ namespace: string; vectorId: string; deleted: boolean } | null> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  const cleanVectorId = String(vectorId || "").trim();
  if (!scoped || !cleanVectorId) return null;

  const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
  await index.deleteMany({ namespace: scoped.namespace, ids: [cleanVectorId] });
  return { namespace: scoped.namespace, vectorId: cleanVectorId, deleted: true };
};

export const fetchBrainstormCreationMemoryCards = async ({
  identity,
  canonicalIds,
}: {
  identity: BrainstormSessionIdentity | null | undefined;
  canonicalIds: string[];
}): Promise<BrainstormSessionMemoryMatch[]> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  const cleanIds = uniqueCleanList(canonicalIds, 24).filter((id) => id.startsWith("project:"));
  if (!scoped || !cleanIds.length) return [];

  const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
  const response = await index.fetchByMetadata({
    namespace: scoped.namespace,
    limit: Math.min(cleanIds.length, 24),
    filter: {
      sourceType: { $eq: SESSION_MEMORY_SOURCE_TYPE },
      userId: { $eq: scoped.userId },
      sessionId: { $eq: scoped.sessionId },
      deviceId: { $eq: scoped.deviceId },
      recordType: { $eq: SESSION_MEMORY_RECORD_TYPES.CANON_CARD },
      canonicalId: { $in: cleanIds },
      expiresAt: { $gt: Date.now() },
    } as any,
  });
  const order = new Map(cleanIds.map((id, indexNumber) => [id, indexNumber]));

  return Object.entries(response.records || {})
    .map(([id, record]) => toBrainstormSessionMemoryMatch({ ...(record as any), id, score: 1 }))
    .filter((match): match is BrainstormSessionMemoryMatch => Boolean(match))
    .sort((a, b) => (order.get(a.canonicalId) ?? 999) - (order.get(b.canonicalId) ?? 999));
};

export const listBrainstormSessionMemoryDevRows = async (
  identity: BrainstormSessionIdentity | null | undefined
): Promise<BrainstormSessionMemoryDevRow[]> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  if (!scoped) return [];

  const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
  const response = await index.fetchByMetadata({
    namespace: scoped.namespace,
    limit: 150,
    filter: {
      sourceType: { $eq: SESSION_MEMORY_SOURCE_TYPE },
      userId: { $eq: scoped.userId },
      sessionId: { $eq: scoped.sessionId },
      deviceId: { $eq: scoped.deviceId },
      expiresAt: { $gt: Date.now() },
    },
  });

  return Object.entries(response.records || {})
    .map(([id, record], indexNumber) => {
      const metadata = record.metadata;
      const title = String(metadata?.title || "Brainstorm session memory");
      const recordType = String(metadata?.recordType || SESSION_MEMORY_RECORD_TYPES.MEMORY_CARD);
      const memoryKind = String(metadata?.memoryKind || "note");
      const cardType = String(metadata?.cardType || "");
      const aliases = Array.isArray(metadata?.aliases) ? metadata.aliases.map(String) : [];
      const domains = Array.isArray(metadata?.domains) ? metadata.domains.map(String) : [];
      const memoryStatus = String(metadata?.status || "active");
      const expiresAt = Number(metadata?.expiresAt || 0);
      const expiresAtIso = String(metadata?.expiresAtIso || (expiresAt ? new Date(expiresAt).toISOString() : ""));
      const turnStart = Number(metadata?.turnStart || 0);
      const turnEnd = Number(metadata?.turnEnd || 0);
      const slotId = Number(metadata?.slotId || 0);
      const text = String(metadata?.text || "").trim();
      const previewText = text.length > 180 ? `${text.slice(0, 180)}...` : text;
      const instructions = [
        "SESSION MEMORY",
        `Record type: ${recordType}`,
        `Title: ${title}`,
        `Kind: ${memoryKind}`,
        cardType ? `Card type: ${cardType}` : "",
        aliases.length ? `Aliases: ${aliases.join(", ")}` : "",
        domains.length ? `Domains: ${domains.join(", ")}` : "",
        `Status: ${memoryStatus}`,
        `Turns: ${turnStart || "?"}-${turnEnd || "?"}`,
        `Expires: ${expiresAtIso}`,
        "",
        "Memory text:",
        text,
        "",
        "Dev metadata:",
        `Vector id: ${id}`,
        `Namespace: ${scoped.namespace}`,
        `Session id: ${scoped.sessionId}`,
        `Device id: ${scoped.deviceId}`,
      ].filter(Boolean).join("\n");

      return {
        id: -1 - indexNumber,
        rag_id: id,
        title: `${recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD ? "[Session Canon]" : recordType === SESSION_MEMORY_RECORD_TYPES.ARCHIVE_CHUNK ? "[Session Archive]" : "[Session]"} ${title}`,
        instructions,
        source_type: SESSION_MEMORY_SOURCE_TYPE as typeof SESSION_MEMORY_SOURCE_TYPE,
        record_type: recordType,
        namespace: scoped.namespace,
        vector_id: id,
        session_id: scoped.sessionId,
        device_id: scoped.deviceId,
        expires_at: expiresAt,
        memory_kind: recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD ? `canon_${cardType || memoryKind}` : memoryKind,
        card_type: cardType,
        aliases,
        domains,
        memory_status: memoryStatus,
        turn_start: turnStart,
        turn_end: turnEnd,
        slot_id: slotId,
        preview_text: previewText,
      };
    })
    .sort((a, b) => (b.slot_id - a.slot_id) || (b.expires_at - a.expires_at));
};

export const buildBrainstormSessionRecallContext = async ({
  identity,
  query,
  recentContext,
  topK,
  minScore,
  exactCanonicalIds,
  skipSemantic,
  memoryScope,
  projectId,
}: {
  identity: BrainstormSessionIdentity | null | undefined;
  query: string;
  recentContext?: string;
  topK?: number;
  minScore?: number;
  exactCanonicalIds?: string[];
  skipSemantic?: boolean;
  memoryScope?: 'session' | 'creation';
  projectId?: string;
}): Promise<BrainstormSessionMemoryContext> => {
  const scoped = normalizeBrainstormSessionIdentity(identity);
  const cleanQuery = String(query || "").trim();
  if (!scoped) {
    return {
      status: "skipped",
      contextBlock: renderBrainstormSessionRecallBlock("skipped", [], "missing scoped session identity"),
      matches: [],
      reason: "missing scoped session identity",
    };
  }
  if (!cleanQuery && !String(recentContext || "").trim() && !(exactCanonicalIds || []).length) {
    return {
      status: "skipped",
      contextBlock: renderBrainstormSessionRecallBlock("skipped", [], "empty query"),
      matches: [],
      namespace: scoped.namespace,
      reason: "empty query",
    };
  }

  try {
    await deleteExpiredBrainstormSessionMemory(scoped);
    const exactMatches = await fetchBrainstormCreationMemoryCards({
      identity: scoped,
      canonicalIds: exactCanonicalIds || [],
    });
    const scoreFloor = minScore ?? getSessionMemoryMinScore();
    let semanticMatches: BrainstormSessionMemoryMatch[] = [];

    if (!skipSemantic && (cleanQuery || String(recentContext || "").trim())) {
      const embeddingResponse = await createEmbeddingWithProviderRouting({
        openai: getOpenAiClient(),
        model: getEmbeddingModel(),
        input: buildBrainstormSessionMemoryQuery(cleanQuery, recentContext),
        metadata: { sessionMemoryQueryEmbedding: true },
      });
      const vector = embeddingResponse.data?.[0]?.embedding;
      if (!Array.isArray(vector) || !vector.length) {
        throw new Error("OpenAI returned no session-memory query embedding");
      }

      const index = getPineconeClient().index<BrainstormSessionMemoryMetadata>({ name: getPineconeIndexName() });
      const search = await index.query({
        namespace: scoped.namespace,
        vector,
        topK: Math.max((topK || getSessionMemoryTopK()) * 2, 16),
        includeMetadata: true,
        includeValues: false,
        filter: {
          sourceType: { $eq: SESSION_MEMORY_SOURCE_TYPE },
          userId: { $eq: scoped.userId },
          sessionId: { $eq: scoped.sessionId },
          deviceId: { $eq: scoped.deviceId },
          expiresAt: { $gt: Date.now() },
          ...(memoryScope === 'creation' ? { domains: { $in: ['guide_content_creation'] } }
            : memoryScope === 'session' ? { domains: { $nin: ['guide_content_creation'] } } : {}),
        },
      });

      semanticMatches = (search.matches || [])
        .map(toBrainstormSessionMemoryMatch)
        .filter((match): match is BrainstormSessionMemoryMatch => Boolean(match))
        .filter(match => !memoryScope || (memoryScope === 'creation'
          ? match.canonicalId.startsWith(`project:${String(projectId || '').trim()}:`)
          : !match.canonicalId.startsWith('project:')))
        .filter((match) => match.score >= scoreFloor)
        .sort((a, b) => {
          const aCanon = a.recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD && a.status !== "deleted" ? 1 : 0;
          const bCanon = b.recordType === SESSION_MEMORY_RECORD_TYPES.CANON_CARD && b.status !== "deleted" ? 1 : 0;
          return (bCanon - aCanon) || (b.importance - a.importance) || (b.score - a.score) || (b.updatedAt - a.updatedAt);
        })
        .slice(0, topK || getSessionMemoryTopK());
    }

    const seen = new Set<string>();
    const matches = [...exactMatches, ...semanticMatches].filter((match) => {
      if (seen.has(match.id)) return false;
      seen.add(match.id);
      return true;
    });

    if (!matches.length) {
      return {
        status: "not_found",
        contextBlock: renderBrainstormSessionRecallBlock("not_found", []),
        matches: [],
        namespace: scoped.namespace,
        reason: `no matches above ${scoreFloor}`,
      };
    }

    return {
      status: "found",
      contextBlock: renderBrainstormSessionRecallBlock("found", matches),
      matches,
      namespace: scoped.namespace,
    };
  } catch (error: any) {
    console.error("Brainstorm session memory search failed:", error?.message || error);
    return {
      status: "error",
      contextBlock: renderBrainstormSessionRecallBlock("error", []),
      matches: [],
      namespace: scoped.namespace,
      reason: error?.message || "session memory search failed",
    };
  }
};
