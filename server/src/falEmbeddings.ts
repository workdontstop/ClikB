import OpenAI from "openai";
import { recordFalEmbeddingUsage, recordOpenAiUsage } from "./aiUsageLedger";
import { isOpenAiProviderError, reportOpenAiFailure, shouldUseFalEmbeddingProvider } from "./textGeneration";

const FAL_BASE_URL = "https://fal.run/openrouter/router/openai/v1";
const FAL_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EXPECTED_EMBEDDING_DIMENSIONS = 1536;

let falClient: OpenAI | null = null;

const getFalClient = (): OpenAI => {
  const key = String(process.env.FAL_KEY || "").trim();
  if (!key) throw new Error("FAL_KEY is required for FAL embedding fallback");
  if (!falClient) {
    falClient = new OpenAI({
      apiKey: "not-needed",
      baseURL: FAL_BASE_URL,
      defaultHeaders: { Authorization: `Key ${key}` },
    });
  }
  return falClient;
};

const inputList = (input: string | string[]): string[] => Array.isArray(input) ? input : [input];

const assertCompatibleVectors = (response: any, expectedCount: number): void => {
  const vectors = response?.data;
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) {
    throw new Error("FAL returned an unexpected number of embeddings");
  }
  for (const item of vectors) {
    if (!Array.isArray(item?.embedding) || item.embedding.length !== EXPECTED_EMBEDDING_DIMENSIONS) {
      throw new Error(`FAL embedding dimensions must be ${EXPECTED_EMBEDDING_DIMENSIONS} to use the existing Pinecone index`);
    }
  }
};

export const createEmbeddingWithProviderRouting = async ({
  openai,
  model,
  input,
  metadata = {},
}: {
  openai: OpenAI;
  model: string;
  input: string | string[];
  metadata?: Record<string, unknown>;
}): Promise<any> => {
  if (!shouldUseFalEmbeddingProvider()) {
    try {
      const response = await openai.embeddings.create({ model, input });
      recordOpenAiUsage(model, response, metadata);
      return response;
    } catch (error) {
      if (!isOpenAiProviderError(error)) throw error;
      reportOpenAiFailure(error);
      // Do not hide the failed OpenAI action with a same-request FAL retry.
      // Once the UI switches to DeepSeek, the user's next request uses FAL.
      throw error;
    }
  }

  const response: any = await getFalClient().embeddings.create({
    model: FAL_EMBEDDING_MODEL,
    input,
  });
  const inputs = inputList(input);
  assertCompatibleVectors(response, inputs.length);
  const usageTokens = Number(response?.usage?.prompt_tokens ?? response?.usage?.total_tokens)
    || Math.max(1, Math.ceil(inputs.join("\n").length / 4));
  recordFalEmbeddingUsage(usageTokens, metadata);
  response._clikbProvider = "fal";
  return response;
};
