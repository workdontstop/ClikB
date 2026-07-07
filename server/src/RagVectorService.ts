import OpenAI from "openai";
import { Pinecone, type RecordMetadata, type PineconeRecord } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_INDEX_NAME = "pineconebase";
const DEFAULT_NAMESPACE = "brainstorm-rag";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_CHUNK_MAX_CHARS = 1800;
const DEFAULT_CHUNK_OVERLAP_CHARS = 220;
const DEFAULT_RAG_TOP_K = 5;
const DEFAULT_RAG_MIN_SCORE = 0.45;
const DEFAULT_RAG_MAX_CHUNKS = 4;

const getOpenAiApiKey = (): string => {
  const key = process.env.OPENAI_API_KEY || process.env.DALLE_KEY || process.env.OPENIMAGE_KEY || process.env.APP_STATE_STABLE_KEY;
  if (!key) {
    throw new Error("Missing OpenAI API key for RAG embeddings");
  }
  return key;
};

const getPineconeApiKey = (): string => {
  const key = process.env.PINECONE_API_KEY || process.env.PINECONE_KEY;
  if (!key) {
    throw new Error("Missing Pinecone API key for RAG indexing");
  }
  return key;
};

const getPineconeIndexName = (): string => process.env.PINECONE_INDEX || DEFAULT_INDEX_NAME;
const getPineconeNamespace = (): string => process.env.PINECONE_NAMESPACE || DEFAULT_NAMESPACE;
const getEmbeddingModel = (): string => process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

let openaiClient: OpenAI | null = null;
let pineconeClient: Pinecone | null = null;

const getOpenAiClient = (): OpenAI => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  }
  return openaiClient;
};

const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: getPineconeApiKey() });
  }
  return pineconeClient;
};

export type RagVectorIndexResult = {
  indexName: string;
  namespace: string;
  embeddingModel: string;
  chunkCount: number;
  vectorIds: string[];
};

export type RagVectorDeleteResult = {
  indexName: string;
  namespace: string;
  deletedVectorIds: string[];
};

export type RagSearchMatch = {
  id: string;
  score: number;
  text: string;
  ragId: string;
  title: string;
  sourceName: string;
  chunkIndex: number;
  chunkCount: number;
};

export type BrainstormRagSystemContext = {
  status: "found" | "not_found" | "skipped" | "error";
  contextBlock: string;
  matches: RagSearchMatch[];
  reason?: string;
};

type RagVectorMetadata = RecordMetadata & {
  text: string;
  ragId: string;
  dbId: number;
  title: string;
  sourceName: string;
  sourceType: string;
  chunkIndex: number;
  chunkCount: number;
  vectorIdPrefix: string;
  embeddingModel: string;
};

type IndexRagInstructionInput = {
  dbId: number;
  ragId: string;
  title: string;
  instructions: string;
};

type DeleteRagInstructionVectorsInput = {
  ragId: string;
  instructions: string;
};

type BuildBrainstormRagSystemContextInput = {
  query: string;
  recentContext?: string;
  topK?: number;
  minScore?: number;
  maxChunks?: number;
};

const extractSourceName = (instructions: string, ragId: string): string => {
  const sourceName = instructions.match(/sourceName:\s*"([^"]+)"/)?.[1]?.trim();
  return sourceName || `${ragId}.rag.txt`;
};

const getChunkId = (ragId: string, index: number): string => {
  return `${ragId}::chunk-${String(index + 1).padStart(4, "0")}`;
};

const isPineconeNotFoundError = (error: any): boolean => {
  const status = error?.status || error?.statusCode || error?.response?.status;
  const message = String(error?.message || "");
  return status === 404 || message.includes("HTTP status 404");
};

const toPositiveNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getRagTopK = (): number => toPositiveNumber(process.env.RAG_TOP_K, DEFAULT_RAG_TOP_K);
const getRagMinScore = (): number => toPositiveNumber(process.env.RAG_MIN_SCORE, DEFAULT_RAG_MIN_SCORE);
const getRagMaxChunks = (): number => toPositiveNumber(process.env.RAG_MAX_CHUNKS, DEFAULT_RAG_MAX_CHUNKS);

const shouldSkipBrainstormRagSearch = (query: string): string | null => {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return "empty message";
  if (normalized.length < 12) return "short control message";

  const controlMessages = new Set([
    "ok",
    "okay",
    "yes",
    "no",
    "nah",
    "thanks",
    "thank you",
    "continue",
    "go on",
    "next",
    "again",
    "retry",
    "lol",
    "lmao",
  ]);

  if (controlMessages.has(normalized)) return "control message";
  return null;
};

const buildBrainstormRagQuery = (query: string, recentContext?: string): string => {
  const cleanQuery = String(query || "").trim();
  const cleanContext = String(recentContext || "").trim();
  if (!cleanContext) return cleanQuery;

  return [
    "Current user message:",
    cleanQuery,
    "",
    "Recent brainstorm context:",
    cleanContext.slice(-1600),
  ].join("\n");
};

const toRagSearchMatch = (match: PineconeRecord<RagVectorMetadata> & { score?: number }): RagSearchMatch | null => {
  const metadata = match.metadata;
  const text = String(metadata?.text || "").trim();
  if (!text) return null;

  return {
    id: match.id,
    score: Number(match.score || 0),
    text,
    ragId: String(metadata?.ragId || ""),
    title: String(metadata?.title || ""),
    sourceName: String(metadata?.sourceName || ""),
    chunkIndex: Number(metadata?.chunkIndex || 0),
    chunkCount: Number(metadata?.chunkCount || 0),
  };
};

const renderBrainstormRagSystemBlock = (
  status: BrainstormRagSystemContext["status"],
  matches: RagSearchMatch[],
  reason?: string
): string => {
  if (status === "found") {
    const renderedMatches = matches
      .map((match, index) => [
        `Memory ${index + 1}: ${match.title || match.ragId || match.id}`,
        `Source: ${match.sourceName || match.ragId || "rag"}`,
        `Score: ${match.score.toFixed(4)}`,
        match.text,
      ].join("\n"))
      .join("\n\n");

    return [
      "RAG_TRAINING_MEMORY_STATUS: found",
      "RAG_TRAINING_MEMORY_KIND: private ClikB app training memory",
      "RAG_TRAINING_MEMORY_RULES:",
      "- Treat this as private training memory about the ClikB app and its workflows.",
      "- Use it when it helps answer the user, especially for ClikB-specific questions.",
      "- Do not mention Pinecone, embeddings, RAG, chunks, scores, or retrieval.",
      "- If the memory is not relevant to the user's message, ignore it and continue normally.",
      "RAG_TRAINING_MEMORY:",
      renderedMatches,
    ].join("\n");
  }

  if (status === "not_found") {
    return [
      "RAG_TRAINING_MEMORY_STATUS: not_found",
      "RAG_TRAINING_MEMORY_KIND: private ClikB app training memory",
      "RAG_TRAINING_MEMORY_RULES:",
      "- No relevant ClikB training memory was found for this message.",
      "- If the user asks a factual question about ClikB app behavior, internal workflows, features, buttons, routes, or saved instructions, say naturally that you have not been trained on that part of ClikB yet.",
      "- Do not say that for normal creative brainstorming, story ideas, general conversation, or visible user-provided context; continue normally in those cases.",
    ].join("\n");
  }

  if (status === "error") {
    return [
      "RAG_TRAINING_MEMORY_STATUS: unavailable",
      "RAG_TRAINING_MEMORY_RULES:",
      "- The private ClikB training memory search was unavailable. Continue normally without mentioning the memory system.",
    ].join("\n");
  }

  return [
    "RAG_TRAINING_MEMORY_STATUS: skipped",
    `RAG_TRAINING_MEMORY_REASON: ${reason || "not needed for this message"}`,
    "RAG_TRAINING_MEMORY_RULES:",
    "- Continue normally without mentioning the memory system.",
  ].join("\n");
};

export const chunkRagInstruction = (
  instructions: string,
  maxChars: number = DEFAULT_CHUNK_MAX_CHARS,
  overlapChars: number = DEFAULT_CHUNK_OVERLAP_CHARS
): string[] => {
  const text = String(instructions || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const newlineBreak = text.lastIndexOf("\n", end);
      if (newlineBreak > start + Math.floor(maxChars * 0.55)) {
        end = newlineBreak;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;
    start = Math.max(0, end - overlapChars);
  }

  return chunks;
};

export const indexRagInstruction = async ({
  dbId,
  ragId,
  title,
  instructions,
}: IndexRagInstructionInput): Promise<RagVectorIndexResult> => {
  const chunks = chunkRagInstruction(instructions);
  if (chunks.length === 0) {
    throw new Error("RAG instruction has no text to index");
  }

  const embeddingModel = getEmbeddingModel();
  const indexName = getPineconeIndexName();
  const namespace = getPineconeNamespace();
  const vectorIdPrefix = `${ragId}::chunk`;
  const sourceName = extractSourceName(instructions, ragId);

  const openai = getOpenAiClient();
  const embeddingResponse = await openai.embeddings.create({
    model: embeddingModel,
    input: chunks,
  });

  if (embeddingResponse.data.length !== chunks.length) {
    throw new Error("OpenAI returned an unexpected number of embeddings");
  }

  const records: Array<PineconeRecord<RagVectorMetadata>> = embeddingResponse.data.map((item, index) => ({
    id: getChunkId(ragId, index),
    values: item.embedding,
    metadata: {
      text: chunks[index],
      ragId,
      dbId,
      title,
      sourceName,
      sourceType: "clikb-base-rag",
      chunkIndex: index + 1,
      chunkCount: chunks.length,
      vectorIdPrefix,
      embeddingModel,
    },
  }));

  const pinecone = getPineconeClient();
  const index = pinecone.index<RagVectorMetadata>({ name: indexName });

  await index.upsert({
    records,
    namespace,
  });

  return {
    indexName,
    namespace,
    embeddingModel,
    chunkCount: chunks.length,
    vectorIds: records.map((record) => record.id),
  };
};
export const deleteRagInstructionVectors = async ({
  ragId,
  instructions,
}: DeleteRagInstructionVectorsInput): Promise<RagVectorDeleteResult> => {
  const chunks = chunkRagInstruction(instructions);
  if (chunks.length === 0) {
    throw new Error("RAG instruction has no text to delete from Pinecone");
  }

  const indexName = getPineconeIndexName();
  const namespace = getPineconeNamespace();
  const vectorIds = chunks.map((_, index) => getChunkId(ragId, index));
  const pinecone = getPineconeClient();
  const index = pinecone.index<RagVectorMetadata>({ name: indexName });

  try {
    await index.deleteMany({
      ids: vectorIds,
      namespace,
    });
  } catch (error: any) {
    if (!isPineconeNotFoundError(error)) {
      throw error;
    }
  }

  return {
    indexName,
    namespace,
    deletedVectorIds: vectorIds,
  };
};
export const buildBrainstormRagSystemContext = async ({
  query,
  recentContext,
  topK,
  minScore,
  maxChunks,
}: BuildBrainstormRagSystemContextInput): Promise<BrainstormRagSystemContext> => {
  const skipReason = shouldSkipBrainstormRagSearch(query);
  if (skipReason) {
    return {
      status: "skipped",
      contextBlock: renderBrainstormRagSystemBlock("skipped", [], skipReason),
      matches: [],
      reason: skipReason,
    };
  }

  try {
    const embeddingModel = getEmbeddingModel();
    const indexName = getPineconeIndexName();
    const namespace = getPineconeNamespace();
    const openai = getOpenAiClient();
    const embeddingResponse = await openai.embeddings.create({
      model: embeddingModel,
      input: buildBrainstormRagQuery(query, recentContext),
    });
    const vector = embeddingResponse.data?.[0]?.embedding;

    if (!Array.isArray(vector) || !vector.length) {
      throw new Error("OpenAI returned no RAG query embedding");
    }

    const index = getPineconeClient().index<RagVectorMetadata>({ name: indexName });
    const search = await index.query({
      vector,
      topK: topK || getRagTopK(),
      namespace,
      includeMetadata: true,
      includeValues: false,
    });

    const scoreFloor = minScore ?? getRagMinScore();
    const limit = maxChunks || getRagMaxChunks();
    const matches = (search.matches || [])
      .map(toRagSearchMatch)
      .filter((match): match is RagSearchMatch => Boolean(match))
      .filter((match) => match.score >= scoreFloor)
      .slice(0, limit);

    if (!matches.length) {
      return {
        status: "not_found",
        contextBlock: renderBrainstormRagSystemBlock("not_found", []),
        matches: [],
        reason: `no matches above ${scoreFloor}`,
      };
    }

    return {
      status: "found",
      contextBlock: renderBrainstormRagSystemBlock("found", matches),
      matches,
    };
  } catch (error: any) {
    console.error("Brainstorm RAG search failed:", error?.message || error);
    return {
      status: "error",
      contextBlock: renderBrainstormRagSystemBlock("error", []),
      matches: [],
      reason: error?.message || "RAG search failed",
    };
  }
};
