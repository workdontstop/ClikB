import { Request, Response } from "express";
import { addPixelsToUser, getPixelsForUser, trySpendPixels } from "./db";
import {
  recordPixelCharge, recordUsagePixelBalance, replayUsageOperation, runUsageOperation,
  type UsageDescriptor, type UsageSummary,
} from "./aiUsageLedger";
import { authenticatedOwnerId } from "./requestAuth";
import { creationInferenceForTier, type CreationInference } from './creationModelProfiles';
import {
  LanguageModelTier,
  LANGUAGE_MODEL_TIERS,
  isLanguageModelTier,
} from "./languageModels";

/**
 * Flat pixel billing for the selectable prompt-writing models.
 *
 * Deliberately small. There is no ledger table and no reservation: the balance
 * is checked BEFORE the provider call and deducted AFTER it succeeds, so a
 * failed call never charges and nothing ever needs refunding.
 *
 * `members.pixels` remains the one and only pixel balance — the deduction goes
 * through the existing `spendPixels` helper in db.ts, exactly like every other
 * charge in the app.
 *
 * Trade-off accepted by design: if a response is lost in flight after the model
 * has already run, a client retry pays a second time. The frontend keeps that
 * rare by not re-firing work whose result it already holds.
 */

export type LlmCharge = {
  userId: string;
  tier: LanguageModelTier;
  model: string;
  pixels: number;
};

export type ResolvedLlm = {
  /** The model the handler should actually call. */
  model: string;
  inference: CreationInference;
  /** null only for an authorised continuation of an already-paid batch. */
  charge: LlmCharge | null;
  userId?: string;
  tier?: LanguageModelTier;
};

export type LlmOperationIdentity = { operationKey: string; fingerprint: string };
export type LlmBillingReceipt = {
  tier: LanguageModelTier;
  pixelsCharged: number;
  pixels?: number;
  operationId?: string;
  replayed?: boolean;
};
type CachedOperationResult = { value: unknown; billing: LlmBillingReceipt | null; entry: UsageSummary };
type CachedOperation = { expiresAt: number; complete: boolean; promise: Promise<CachedOperationResult> };
const OPERATION_CACHE_TTL_MS = 30 * 60 * 1000;
const OPERATION_CACHE_LIMIT = 256;
const operationResults = new Map<string, CachedOperation>();

const operationCacheKey = (userId: string, tier: LanguageModelTier, operation: LlmOperationIdentity): string =>
  JSON.stringify([userId, tier, LANGUAGE_MODEL_TIERS[tier].model, LANGUAGE_MODEL_TIERS[tier].pixels, creationInferenceForTier(tier).reasoning_effort, operation.operationKey, operation.fingerprint]);

const pruneOperationResults = (): void => {
  const now = Date.now();
  for (const [key, operation] of operationResults) {
    if (operation.complete && operation.expiresAt <= now) operationResults.delete(key);
  }
};

export const llmOperationIsCached = (identity: LlmOperationIdentity & {
  userId: string; tier: LanguageModelTier;
}): boolean => {
  pruneOperationResults();
  return operationResults.has(operationCacheKey(identity.userId, identity.tier, identity));
};

/**
 * Validate the request's tier tag, authenticate the member and confirm they can
 * afford the flat price. Nothing is deducted here.
 *
 * Returns null when a response has already been sent (400 / 401 / 402) — the
 * caller must return immediately without contacting OpenAI.
 *
 * The client must name a server-owned tier. Missing tiers used to fall through
 * to an unbilled legacy model, which made the route directly exploitable.
 */
export const beginLlmRequest = async (
  req: Request,
  res: Response,
  _fallbackModel: string,
  options: { operationCount?: number; operations?: LlmOperationIdentity[] } = {},
): Promise<ResolvedLlm | null> => {
  const rawTier = (req.body ?? {}).llmTier;

  // Never let a handcrafted request obtain an unbilled legacy model call.
  if (rawTier === undefined || rawTier === null || rawTier === "") {
    res.status(400).send({ message: "Language model tier is required." });
    return null;
  }

  // Tagged but wrong: never silently fall back to an expensive tier.
  if (!isLanguageModelTier(rawTier)) {
    res.status(400).send({ message: "Unknown language model." });
    return null;
  }

  const tier: LanguageModelTier = rawTier;
  const { model, pixels } = LANGUAGE_MODEL_TIERS[tier];

  const userId = authenticatedOwnerId(req);
  if (!userId) {
    res
      .status(401)
      .send({ message: "Please sign in to use AI prompt writing." });
    return null;
  }

  /**
   * Continuation of an already-charged batch: the first request of the batch
   * paid for it, so this one gets the selected model and no second charge.
   *
   * Honest caveat: with no ledger there is nothing server-side that can verify
   * the claim, so a hand-crafted request could assert it. The tier's price and
   * model mapping are still server-owned, and the caller is still authenticated
   * — only the batch grouping is taken on trust.
   */
  if (!options.operations && !options.operationCount && (req.body ?? {}).llmBatchContinuation === true) {
    return { model, inference: creationInferenceForTier(tier), charge: null, userId, tier };
  }

  let balance = 0;
  try {
    balance = Number(await getPixelsForUser(userId)) || 0;
  } catch (error) {
    console.error("[llmBilling] balance lookup failed:", error);
    res.status(500).send({ message: "Could not check your pixel balance." });
    return null;
  }

  const operationCount = options.operations
    ? options.operations.filter(operation => !llmOperationIsCached({ ...operation, userId, tier })).length
    : Math.max(1, Math.floor(options.operationCount || 1));
  const requiredPixels = pixels * operationCount;
  if (balance < requiredPixels) {
    res.status(402).send({
      message: `Not enough pixels. AI prompt writing needs ${requiredPixels} P and you have ${balance} P.`,
      pixels: balance,
      required: requiredPixels,
      tier,
    });
    return null;
  }

  return { model, inference: creationInferenceForTier(tier), charge: { userId, tier, model, pixels }, userId, tier };
};

/**
 * A separately measured and billed stage of automatic prompt preparation.
 * Successful work is retained for retries; an unfinished/failed later stage
 * cannot force the completed base writer to run or charge again.
 */
export const runBilledLlmOperation = async <T>(
  llm: ResolvedLlm,
  operation: UsageDescriptor & LlmOperationIdentity,
  work: () => Promise<T>,
): Promise<{ value: T; billing: LlmBillingReceipt | null }> => {
  const userId = llm.userId || llm.charge?.userId;
  const tier = llm.tier || llm.charge?.tier;
  if (!userId || !tier) throw new Error("A resolved authenticated model is required for prompt operations.");
  if (!operation.operationKey || operation.operationKey.length > 300 || !operation.fingerprint || operation.fingerprint.length > 300) {
    throw Object.assign(new Error("Invalid prompt operation identity."), { status: 400 });
  }
  pruneOperationResults();
  const key = operationCacheKey(userId, tier, operation);
  const existing = operationResults.get(key);
  if (existing) {
    const result = await existing.promise;
    replayUsageOperation(result.entry);
    let pixels: number | undefined;
    try { pixels = Number(await getPixelsForUser(userId)) || 0; recordUsagePixelBalance(pixels); } catch { /* ledger still records the known operation */ }
    return { value: result.value as T, billing: result.billing
      ? { ...result.billing, pixelsCharged: 0, pixels, replayed: true } : null };
  }
  // Evict only completed work; never break in-flight coalescing.
  while (operationResults.size >= OPERATION_CACHE_LIMIT) {
    const evictable = [...operationResults].find(([, item]) => item.complete);
    if (!evictable) throw Object.assign(new Error("Prompt preparation is busy. Retry shortly."), { status: 429 });
    operationResults.delete(evictable[0]);
  }
  const cached: CachedOperation = { complete: false, expiresAt: Date.now() + OPERATION_CACHE_TTL_MS, promise: undefined! };
  cached.promise = (async () => {
    let entry: UsageSummary | undefined;
    const result = await runUsageOperation(operation, async () => {
      const charge = llm.charge;
      if (charge && !await trySpendPixels(charge.userId, charge.pixels)) {
        const pixels = Number(await getPixelsForUser(userId)) || 0;
        recordUsagePixelBalance(pixels);
        throw Object.assign(new Error(`Not enough pixels. ${operation.actionLabel} needs ${charge.pixels} P and you have ${pixels} P.`), {
          status: 402, required: charge.pixels, pixels,
        });
      }
      let value: T;
      try {
        value = await work();
      } catch (error) {
        if (charge) {
          try {
            await addPixelsToUser(charge.userId, charge.pixels);
          } catch (refundError) {
            // If the database cannot refund, keep the ledger honest about the
            // actual balance instead of pretending no deduction occurred.
            recordPixelCharge(charge.pixels, "selectable-llm-refund-failed");
            console.error("[llmBilling] prompt operation refund failed:", refundError);
          }
          try { recordUsagePixelBalance(Number(await getPixelsForUser(userId)) || 0); } catch { /* next balance read can recover */ }
        }
        throw error;
      }
      let pixels: number | undefined;
      if (charge) recordPixelCharge(charge.pixels, "selectable-llm-operation");
      try { pixels = Number(await getPixelsForUser(userId)) || 0; recordUsagePixelBalance(pixels); } catch { /* never replay completed provider work for a balance read */ }
      return { value, billing: charge ? { tier, pixelsCharged: charge.pixels, pixels } : null };
    }, { onComplete: summary => { entry = summary; } });
    if (!entry) throw new Error("Prompt operation measurement was not completed.");
    cached.complete = true;
    cached.expiresAt = Date.now() + OPERATION_CACHE_TTL_MS;
    return { ...result, billing: result.billing ? { ...result.billing, operationId: entry.requestId } : null, entry };
  })();
  operationResults.set(key, cached);
  try {
    const result = await cached.promise;
    return { value: result.value as T, billing: result.billing };
  } catch (error) {
    if (operationResults.get(key) === cached) operationResults.delete(key);
    throw error;
  }
};

/** One response can report several actual deductions and the latest known authoritative balance. */
export const mergeLlmBilling = (receipts: Array<LlmBillingReceipt | null | undefined>): {
  tier: LanguageModelTier; pixelsCharged: number; pixels?: number; operations: LlmBillingReceipt[];
} | null => {
  const operations = receipts.filter((receipt): receipt is LlmBillingReceipt => Boolean(receipt));
  if (!operations.length) return null;
  return {
    tier: operations[operations.length - 1].tier,
    pixelsCharged: operations.reduce((total, receipt) => total + receipt.pixelsCharged, 0),
    pixels: [...operations].reverse().find(receipt => typeof receipt.pixels === "number")?.pixels,
    operations,
  };
};

/**
 * Deduct the flat price after the handler's LLM work succeeded, and report the
 * new balance so the client can sync Redux from an authoritative number.
 *
 * A billing write that fails must not fail the user's request — they already
 * have their prompt. It is logged and the charge is skipped.
 */
export const completeLlmCharge = async (
  charge: LlmCharge | null
): Promise<{ tier: LanguageModelTier; pixelsCharged: number; pixels?: number } | null> => {
  if (!charge) return null;

  try {
    const spent = await trySpendPixels(charge.userId, charge.pixels);
    if (!spent) {
      console.warn("[llmBilling] balance changed before charge could be applied", {
        userId: charge.userId,
        pixels: charge.pixels,
      });
      return null;
    }
    recordPixelCharge(charge.pixels, "selectable-llm");
    let pixels: number | undefined;
    try {
      const readBalance = Number(await getPixelsForUser(charge.userId));
      if (Number.isFinite(readBalance) && readBalance >= 0) {
        pixels = readBalance;
      }
    } catch (balanceError) {
      console.warn("[llmBilling] post-debit balance read failed:", balanceError);
    }
    return {
      tier: charge.tier,
      pixelsCharged: charge.pixels,
      ...(typeof pixels === "number" ? { pixels } : {}),
    };
  } catch (error) {
    console.error("[llmBilling] charge failed after successful call:", error);
    return null;
  }
};

/**
 * Convenience for the response body: merges an `llmBilling` object in when the
 * request was billable, and changes nothing when it was not.
 */
export const withLlmBilling = async (
  payload: Record<string, any>,
  charge: LlmCharge | null
): Promise<Record<string, any>> => {
  const billing = await completeLlmCharge(charge);
  return billing ? { ...payload, llmBilling: billing } : payload;
};
