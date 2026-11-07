import { randomUUID, createHash } from "crypto";
import execQuery, { withTransaction, type TransactionQuery } from "./execQuery";
import { getPixelsForUser } from "./db";

export const PIXELS_PER_USD = 333;
export const PIXEL_USD = 1 / PIXELS_PER_USD;
export const SUBUNITS_PER_PIXEL = 1_000_000_000;
export const METERED_SETTLEMENT_INTERVAL_MS = 10_000;
export const METERED_BILLING_POLICY_VERSION = "2026-10-27.v2";

export type MeteredWorkload = "concierge" | "voice" | "spatial" | "motion";

export type MeteredQueryRunner = {
  execQuery: typeof execQuery;
  withTransaction: typeof withTransaction;
};

export type MeteredUsageIncrement = {
  eventId: string;
  userId: string;
  sessionKey: string;
  workload?: MeteredWorkload;
  surface?: MeteredWorkload;
  profile?: string;
  tier?: string;
  model?: string;
  rawPixels?: number;
  providerCostUsd?: number;
  costSubunits?: number;
  billableToUser?: boolean;
  queryRunner?: MeteredQueryRunner;
};

export type MeteredSettlementReceipt = {
  receiptId: string;
  receiptSeq: number;
  idempotencyKey: string;
  sessionKey: string;
  userId: string;
  workload: MeteredWorkload;
  profile: string;
  model: string;
  policyVersion: string;
  pixelsCharged: number;
  totalSettledPixels: number;
  carrySubunits: number;
  carriedSubunits: number;
  cumulativeSubunits: number;
  unsettledWholePixels?: number;
  remainingPixels?: number;
  zeroBalanceReached: boolean;
  settledAt: string;
  replayed?: boolean;
  pendingReconciliation?: boolean;
  error?: string;
};

export type MeteredSessionState = {
  sessionKey: string;
  userId: string;
  workload: MeteredWorkload;
  profile: string;
  model: string;
  cumulativeSubunits: number;
  settledWholePixels: number;
  carrySubunits: number;
  receiptSeq: number;
  recordedEventIds: Set<string>;
  receiptsByKey: Map<string, MeteredSettlementReceipt>;
  latestReceipt: MeteredSettlementReceipt | null;
  updatedAt: number;
};

export type MeteredBillingDbAdapter = {
  getBalance: (userId: string) => Promise<number>;
  atomicDebit: (params: {
    userId: string;
    sessionKey: string;
    idempotencyKey: string;
    receiptId: string;
    receiptSeq: number;
    workload: MeteredWorkload;
    profile: string;
    model: string;
    requestedPixels: number;
    cumulativeSubunits: number;
    settledWholePixelsBefore: number;
    strictFullBalance?: boolean;
  }) => Promise<{
    actualCharged: number;
    remainingPixels: number;
    zeroBalanceReached: boolean;
    replayed?: boolean;
    sessionState?: {
      cumulativeSubunits: number;
      settledWholePixels: number;
      carrySubunits: number;
      receiptSeq: number;
    };
  }>;
};

type DurableSessionRecord = {
  sessionKey: string;
  userId: string;
  workload: MeteredWorkload;
  profile: string;
  model: string;
  cumulativeSubunits: number;
  settledWholePixels: number;
  carrySubunits: number;
  receiptSeq: number;
  policyVersion: string;
};

type DurableEventRecord = {
  sessionKey: string;
  eventId: string;
  userId: string;
  workload: MeteredWorkload;
  profile: string;
  model: string;
  costSubunits: number;
  policyVersion: string;
};

type DurableStoreMirror = {
  sessions: Map<string, DurableSessionRecord>;
  events: Map<string, DurableEventRecord>;
  receipts: Map<string, MeteredSettlementReceipt>;
};

const STORE_MIRROR_SYMBOL = Symbol.for("clikb.meteredBillingStoreMirror.v2");

const getStoreMirrorForAnchor = (anchor: unknown): DurableStoreMirror => {
  const target = (anchor && (typeof anchor === "object" || typeof anchor === "function"))
    ? (anchor as Record<symbol, DurableStoreMirror>)
    : (globalThis as unknown as Record<symbol, DurableStoreMirror>);
  if (!target[STORE_MIRROR_SYMBOL]) {
    Object.defineProperty(target, STORE_MIRROR_SYMBOL, {
      value: {
        sessions: new Map<string, DurableSessionRecord>(),
        events: new Map<string, DurableEventRecord>(),
        receipts: new Map<string, MeteredSettlementReceipt>(),
      },
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return target[STORE_MIRROR_SYMBOL];
};

export const rawPixelsToSubunits = (rawPixels: number): number => {
  const safe = Math.max(0, Number(rawPixels) || 0);
  if (!Number.isFinite(safe)) return 0;
  return Math.max(0, Math.round(safe * SUBUNITS_PER_PIXEL));
};

export const usdToSubunits = (providerCostUsd: number): number => {
  const safe = Math.max(0, Number(providerCostUsd) || 0);
  if (!Number.isFinite(safe)) return 0;
  return Math.max(0, Math.round(safe * PIXELS_PER_USD * SUBUNITS_PER_PIXEL));
};

export const wholePixelsFromSubunits = (subunits: number): number => {
  const safe = Math.max(0, Math.round(Number(subunits) || 0));
  return Math.floor(safe / SUBUNITS_PER_PIXEL);
};

export const carrySubunitsAfterSettlement = (
  cumulativeSubunits: number,
  settledWholePixels: number,
): number => {
  const safeCumulative = Math.max(0, Math.round(Number(cumulativeSubunits) || 0));
  const safeSettled = Math.max(0, Math.floor(Number(settledWholePixels) || 0));
  return Math.max(0, safeCumulative - safeSettled * SUBUNITS_PER_PIXEL);
};

const sessions = new Map<string, MeteredSessionState>();
const sessionLocks = new Map<string, Promise<unknown>>();
const activeConversationProfileBySession = new Map<string, string>();
const activeSessionOwnerByScope = new Map<string, string>();

let customDbAdapter: MeteredBillingDbAdapter | null = null;
let customAdapterAnchor: unknown = null;
let usageFailureHandler: ((increment: MeteredUsageIncrement, error: unknown) => Promise<void>) | null = null;
let settlementFailureHandler: ((params: MeteredSettlementParams, error: unknown) => Promise<void>) | null = null;
/** Production installs a durable outbox; isolated tests do not write billing files. */
export const configureMeteredUsageFailureHandler = (handler: typeof usageFailureHandler): void => {
  usageFailureHandler = handler;
};
export const configureMeteredSettlementFailureHandler = (handler: typeof settlementFailureHandler): void => {
  settlementFailureHandler = handler;
};
const schemaPromises = new WeakMap<object, Promise<unknown>>();

const getActiveMirrorAnchor = (runner?: MeteredQueryRunner): unknown =>
  customAdapterAnchor || customDbAdapter || runner?.execQuery || getPixelsForUser || execQuery;

export const __setMeteredBillingDbAdapterForTest = (
  adapter: MeteredBillingDbAdapter | null,
): void => {
  customDbAdapter = adapter;
  customAdapterAnchor = adapter;
};

export const __setMeteredBillingTestAdapter = (
  adapter:
    | MeteredBillingDbAdapter
    | {
        getBalance: (userId: string) => Promise<number>;
        spendPixels: (userId: string, pixels: number) => Promise<{ ok: boolean; balance: number }>;
      }
    | null,
): void => {
  if (!adapter) {
    customDbAdapter = null;
    customAdapterAnchor = null;
    return;
  }
  customAdapterAnchor = adapter;
  if ("atomicDebit" in adapter) {
    customDbAdapter = adapter;
    return;
  }
  customDbAdapter = {
    getBalance: adapter.getBalance,
    atomicDebit: async (params) => {
      const currentBalance = Math.max(0, Math.floor(Number(await adapter.getBalance(params.userId)) || 0));
      if (params.strictFullBalance && currentBalance < params.requestedPixels) {
        const err = new Error(`Insufficient Pixels: need ${params.requestedPixels} P, have ${currentBalance} P`) as Error & {
          code?: string;
          status?: number;
          requiredPixels?: number;
          availablePixels?: number;
        };
        err.code = "INSUFFICIENT_PIXELS";
        err.status = 402;
        err.requiredPixels = params.requestedPixels;
        err.availablePixels = currentBalance;
        throw err;
      }
      const candidatePixels = Math.max(0, Math.min(params.requestedPixels, currentBalance));
      let actualCharged = 0;
      let remainingPixels = currentBalance;
      if (candidatePixels > 0) {
        const res = await adapter.spendPixels(params.userId, candidatePixels);
        if (res && res.ok) {
          actualCharged = candidatePixels;
          remainingPixels = Math.max(0, Math.floor(Number(res.balance) || 0));
        } else {
          actualCharged = 0;
          remainingPixels = Math.max(
            0,
            Math.floor(Number(res?.balance ?? (await adapter.getBalance(params.userId))) || 0),
          );
        }
      }
      return {
        actualCharged,
        remainingPixels,
        zeroBalanceReached: params.requestedPixels > 0 && remainingPixels <= 0,
      };
    },
  };
};

export const __resetMeteredBillingSessionsForTest = (): void => {
  usageFailureHandler = null;
  settlementFailureHandler = null;
  sessions.clear();
  sessionLocks.clear();
  activeConversationProfileBySession.clear();
  activeSessionOwnerByScope.clear();
  for (const anchor of [customAdapterAnchor, customDbAdapter, getPixelsForUser, execQuery]) {
    if (anchor && (typeof anchor === "object" || typeof anchor === "function")) {
      const mirror = (anchor as Record<symbol, DurableStoreMirror | undefined>)[STORE_MIRROR_SYMBOL];
      if (mirror) {
        mirror.sessions.clear();
        mirror.events.clear();
        mirror.receipts.clear();
      }
    }
  }
};

export const __resetMeteredBillingStateForTest = __resetMeteredBillingSessionsForTest;

export const rememberSessionConversationProfile = (
  sessionScopeId: string,
  profile: string,
  userId?: string,
): void => {
  const cleanScope = String(sessionScopeId || "").trim().slice(0, 120);
  const cleanProfile = String(profile || "").trim().slice(0, 64);
  const cleanUser = String(userId || "").trim();
  if (cleanScope && cleanUser) {
    const existingOwner = activeSessionOwnerByScope.get(cleanScope);
    if (existingOwner && existingOwner !== cleanUser) {
      const err = new Error("Conversation session belongs to another authenticated user") as Error & {
        status?: number;
        code?: string;
      };
      err.status = 403;
      err.code = "SESSION_OWNERSHIP_MISMATCH";
      throw err;
    }
    activeSessionOwnerByScope.set(cleanScope, cleanUser);
  }
  if (cleanScope && cleanProfile) {
    activeConversationProfileBySession.set(cleanScope, cleanProfile);
  }
};

export const verifyConversationSessionOwnership = (
  sessionScopeId: string,
  userId: string,
): boolean => {
  const cleanScope = String(sessionScopeId || "").trim().slice(0, 120);
  const cleanUser = String(userId || "").trim();
  if (!cleanScope || !cleanUser) return true;
  const existingOwner = activeSessionOwnerByScope.get(cleanScope);
  if (existingOwner && existingOwner !== cleanUser) {
    return false;
  }
  activeSessionOwnerByScope.set(cleanScope, cleanUser);
  return true;
};

export const getRememberedSessionConversationProfile = (
  sessionScopeId: string,
  userId?: string,
): string | null => {
  const cleanScope = String(sessionScopeId || "").trim().slice(0, 120);
  if (!cleanScope) return null;
  if (userId) {
    const existingOwner = activeSessionOwnerByScope.get(cleanScope);
    if (existingOwner && existingOwner !== String(userId).trim()) {
      return null;
    }
  }
  return activeConversationProfileBySession.get(cleanScope) || null;
};

const ensureMeteredSchema = (runner?: MeteredQueryRunner): Promise<unknown> => {
  const runQuery = runner?.execQuery || execQuery;
  const keyObj = (runQuery as unknown as object) || globalThis;
  const existing = schemaPromises.get(keyObj);
  if (existing) return existing;
  const created = (async () => {
    await runQuery(`CREATE TABLE IF NOT EXISTS ai_metered_billing_sessions (
      session_key VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      workload VARCHAR(32) NOT NULL,
      profile VARCHAR(64) NOT NULL,
      model VARCHAR(120) NOT NULL,
      cumulative_subunits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      settled_whole_pixels BIGINT UNSIGNED NOT NULL DEFAULT 0,
      carry_subunits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      receipt_seq INT UNSIGNED NOT NULL DEFAULT 0,
      policy_version VARCHAR(32) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ai_metered_sessions_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runQuery(`CREATE TABLE IF NOT EXISTS ai_metered_billing_events (
      session_key VARCHAR(191) NOT NULL,
      event_id VARCHAR(191) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      workload VARCHAR(32) NOT NULL,
      profile VARCHAR(64) NOT NULL,
      model VARCHAR(120) NOT NULL,
      cost_subunits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      policy_version VARCHAR(32) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_key, event_id),
      KEY idx_ai_metered_events_user (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runQuery(`CREATE TABLE IF NOT EXISTS ai_metered_billing_receipts (
      idempotency_key VARCHAR(191) NOT NULL PRIMARY KEY,
      receipt_id CHAR(36) NOT NULL,
      session_key VARCHAR(191) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      receipt_seq INT UNSIGNED NOT NULL,
      workload VARCHAR(32) NOT NULL,
      profile VARCHAR(64) NOT NULL,
      model VARCHAR(120) NOT NULL,
      pixels_charged INT UNSIGNED NOT NULL DEFAULT 0,
      total_settled_pixels INT UNSIGNED NOT NULL DEFAULT 0,
      carry_subunits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      cumulative_subunits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      remaining_pixels INT UNSIGNED NOT NULL DEFAULT 0,
      zero_balance_reached TINYINT(1) NOT NULL DEFAULT 0,
      policy_version VARCHAR(32) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ai_metered_receipts_session (session_key, receipt_seq)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  })().catch((error) => {
    schemaPromises.delete(keyObj);
    throw error;
  });
  schemaPromises.set(keyObj, created);
  return created;
};

export const buildMeteredSessionKey = (
  workload: MeteredWorkload,
  userId: string,
  scopeId: string,
): string => {
  const safeUser = String(userId || "").trim().slice(0, 48);
  if (!safeUser) {
    throw new Error("Authenticated userId is required for metered billing sessions");
  }
  const safeScope = String(scopeId || "default").trim().slice(0, 120) || "default";
  const namespace = workload === "voice" ? "concierge" : workload;
  return `${namespace}:${safeUser}:${safeScope}`;
};

const hydrateSessionFromMirrorIfNeeded = (
  session: MeteredSessionState,
  anchor: unknown,
): void => {
  const mirror = getStoreMirrorForAnchor(anchor);
  const durable = mirror.sessions.get(session.sessionKey);
  if (durable) {
    if (durable.userId !== session.userId) {
      const err = new Error("Metered billing session belongs to another user") as Error & {
        status?: number;
        code?: string;
      };
      err.status = 403;
      err.code = "SESSION_OWNERSHIP_MISMATCH";
      throw err;
    }
    if (durable.cumulativeSubunits > session.cumulativeSubunits) {
      session.cumulativeSubunits = durable.cumulativeSubunits;
    }
    if (durable.settledWholePixels > session.settledWholePixels) {
      session.settledWholePixels = durable.settledWholePixels;
    }
    if (durable.receiptSeq > session.receiptSeq) {
      session.receiptSeq = durable.receiptSeq;
    }
    session.carrySubunits = carrySubunitsAfterSettlement(
      session.cumulativeSubunits,
      session.settledWholePixels,
    );
  }
  // Event/receipt history is read by exact SQL identity. Do not scan every user's
  // history while hydrating one lightweight display snapshot.
};

export const getOrCreateMeteredSession = (params: {
  sessionKey: string;
  userId: string;
  workload: MeteredWorkload;
  profile: string;
  model: string;
  anchor?: unknown;
}): MeteredSessionState => {
  const cleanUserId = String(params.userId || "").trim();
  if (!cleanUserId) {
    throw new Error("Authenticated userId is required for metered session access");
  }
  const existing = sessions.get(params.sessionKey);
  if (existing) {
    if (existing.userId !== cleanUserId) {
      const err = new Error("Metered billing session belongs to another user") as Error & {
        status?: number;
        code?: string;
      };
      err.status = 403;
      err.code = "SESSION_OWNERSHIP_MISMATCH";
      throw err;
    }
    hydrateSessionFromMirrorIfNeeded(existing, params.anchor || getActiveMirrorAnchor());
    if (params.profile) existing.profile = params.profile;
    if (params.model) existing.model = params.model;
    existing.updatedAt = Date.now();
    return existing;
  }
  const created: MeteredSessionState = {
    sessionKey: params.sessionKey,
    userId: cleanUserId,
    workload: params.workload,
    profile: params.profile,
    model: params.model,
    cumulativeSubunits: 0,
    settledWholePixels: 0,
    carrySubunits: 0,
    receiptSeq: 0,
    recordedEventIds: new Set<string>(),
    receiptsByKey: new Map<string, MeteredSettlementReceipt>(),
    latestReceipt: null,
    updatedAt: Date.now(),
  };
  hydrateSessionFromMirrorIfNeeded(created, params.anchor || getActiveMirrorAnchor());
  sessions.set(params.sessionKey, created);
  return created;
};

export const getMeteredSessionSnapshot = (
  sessionKey: string,
): MeteredSessionState | null => {
  const existing = sessions.get(sessionKey);
  if (existing) {
    hydrateSessionFromMirrorIfNeeded(existing, getActiveMirrorAnchor());
    return existing;
  }
  const mirror = getStoreMirrorForAnchor(getActiveMirrorAnchor());
  const durable = mirror.sessions.get(sessionKey);
  if (!durable) return null;
  return getOrCreateMeteredSession({
    sessionKey: durable.sessionKey,
    userId: durable.userId,
    workload: durable.workload,
    profile: durable.profile,
    model: durable.model,
  });
};

const withSessionLock = async <T>(
  sessionKey: string,
  work: () => Promise<T>,
): Promise<T> => {
  const previous = sessionLocks.get(sessionKey) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => {}).then(() => gate);
  sessionLocks.set(sessionKey, queued);
  await previous.catch(() => {});
  try {
    return await work();
  } finally {
    release();
    if (sessionLocks.get(sessionKey) === queued) sessionLocks.delete(sessionKey);
  }
};

export type MeteredSettlementParams = {
  sessionKey: string;
  userId: string;
  workload?: MeteredWorkload;
  surface?: MeteredWorkload;
  profile?: string;
  tier?: string;
  model?: string;
  stage?: string;
  idempotencyKey?: string;
  forceReceipt?: boolean;
  strictFullBalance?: boolean;
  throwOnError?: boolean;
  queryRunner?: MeteredQueryRunner;
};

type AccountingState = DurableSessionRecord;
const billingError = (message: string, code: string, status: number) =>
  Object.assign(new Error(message), { code, status });
const identity = (params: MeteredSettlementParams): AccountingState => {
  if (!String(params.userId || '').trim() || !String(params.sessionKey || '').trim()) {
    throw billingError('Authenticated billing identity is required', 'BILLING_IDENTITY_REQUIRED', 401);
  }
  return {
    sessionKey: params.sessionKey, userId: String(params.userId).trim(),
    workload: params.workload || params.surface || 'concierge',
    profile: params.profile || params.tier || 'luna', model: params.model || params.profile || params.tier || 'luna',
    cumulativeSubunits: 0, settledWholePixels: 0, carrySubunits: 0, receiptSeq: 0,
    policyVersion: METERED_BILLING_POLICY_VERSION,
  };
};
const sessionValues = (state: AccountingState) => [state.sessionKey, state.userId, state.workload, state.profile,
  state.model, state.cumulativeSubunits, state.settledWholePixels, state.carrySubunits, state.receiptSeq, state.policyVersion];
const writeAccounting = async (query: TransactionQuery, state: AccountingState) => {
  await query(`INSERT INTO ai_metered_billing_sessions
    (session_key,user_id,workload,profile,model,cumulative_subunits,settled_whole_pixels,carry_subunits,receipt_seq,policy_version)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
    workload=VALUES(workload),profile=VALUES(profile),model=VALUES(model),
    cumulative_subunits=VALUES(cumulative_subunits),settled_whole_pixels=VALUES(settled_whole_pixels),
    carry_subunits=VALUES(carry_subunits),receipt_seq=VALUES(receipt_seq),policy_version=VALUES(policy_version)`, sessionValues(state));
};
const lockAccounting = async (query: TransactionQuery, seed: AccountingState): Promise<AccountingState> => {
  // Create before locking: concurrent first events serialize on the primary key too.
  await query(`INSERT IGNORE INTO ai_metered_billing_sessions
    (session_key,user_id,workload,profile,model,cumulative_subunits,settled_whole_pixels,carry_subunits,receipt_seq,policy_version)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, sessionValues(seed));
  const rows = await query('SELECT user_id, cumulative_subunits, settled_whole_pixels, carry_subunits, receipt_seq FROM ai_metered_billing_sessions WHERE session_key = ? FOR UPDATE', [seed.sessionKey]);
  if (!rows?.[0]) throw billingError('Billing session could not be locked', 'BILLING_STATE_UNAVAILABLE', 503);
  if (String(rows[0].user_id) !== seed.userId) throw billingError('Billing session belongs to another user', 'SESSION_OWNERSHIP_MISMATCH', 403);
  return { ...seed, cumulativeSubunits: Number(rows[0].cumulative_subunits), settledWholePixels: Number(rows[0].settled_whole_pixels),
    carrySubunits: Number(rows[0].carry_subunits), receiptSeq: Number(rows[0].receipt_seq) };
};
const eventCost = (increment: MeteredUsageIncrement): number => {
  const value = increment.costSubunits !== undefined ? increment.costSubunits
    : increment.rawPixels !== undefined ? rawPixelsToSubunits(increment.rawPixels)
      : usdToSubunits(increment.providerCostUsd || 0);
  if (!Number.isSafeInteger(value) || value < 0) throw billingError('Invalid confirmed usage amount', 'INVALID_USAGE_AMOUNT', 422);
  return value;
};
const assertEventIdentity = (increment: MeteredUsageIncrement, state: AccountingState) => {
  if (increment.userId !== state.userId || increment.sessionKey !== state.sessionKey) {
    throw billingError('Usage event belongs to another billing session', 'SESSION_OWNERSHIP_MISMATCH', 403);
  }
  if (!increment.eventId || increment.eventId.length > 191) throw billingError('Stable usage event identity is required', 'INVALID_USAGE_ID', 422);
};
const recordEvent = async (query: TransactionQuery, state: AccountingState, increment: MeteredUsageIncrement): Promise<number> => {
  assertEventIdentity(increment, state);
  if (increment.billableToUser === false) return 0;
  const cost = eventCost(increment);
  const rows = await query('SELECT event_id, cost_subunits, profile, model FROM ai_metered_billing_events WHERE session_key = ? AND event_id = ? LIMIT 1', [state.sessionKey, increment.eventId]);
  if (rows?.[0]) {
    if (Number(rows[0].cost_subunits) !== cost
      || (rows[0].profile !== undefined && rows[0].profile !== (increment.profile || increment.tier || state.profile))
      || (rows[0].model !== undefined && rows[0].model !== (increment.model || state.model))) {
      throw billingError('Usage identity was reused with different usage', 'USAGE_EVENT_CONFLICT', 409);
    }
    return 0;
  }
  const next = state.cumulativeSubunits + cost;
  if (!Number.isSafeInteger(next)) throw billingError('Billing total exceeds safe precision', 'INVALID_USAGE_AMOUNT', 422);
  await query(`INSERT INTO ai_metered_billing_events
    (session_key,event_id,user_id,workload,profile,model,cost_subunits,policy_version) VALUES (?,?,?,?,?,?,?,?)`,
    [state.sessionKey, increment.eventId, state.userId, increment.workload || increment.surface || state.workload,
      increment.profile || increment.tier || state.profile, increment.model || state.model, cost, state.policyVersion]);
  state.cumulativeSubunits = next;
  state.carrySubunits = carrySubunitsAfterSettlement(next, state.settledWholePixels);
  await writeAccounting(query, state);
  return cost;
};
const publishCommitted = (state: AccountingState, anchor: unknown, events: MeteredUsageIncrement[] = [], receipt?: MeteredSettlementReceipt) => {
  const session = getOrCreateMeteredSession({ ...state, anchor });
  Object.assign(session, { cumulativeSubunits: state.cumulativeSubunits, settledWholePixels: state.settledWholePixels,
    carrySubunits: state.carrySubunits, receiptSeq: state.receiptSeq, updatedAt: Date.now() });
  const mirror = getStoreMirrorForAnchor(anchor);
  mirror.sessions.set(state.sessionKey, { ...state });
  for (const event of events) {
    session.recordedEventIds.add(event.eventId);
    mirror.events.set(`${state.sessionKey}::${event.eventId}`, { sessionKey: state.sessionKey, eventId: event.eventId,
      userId: state.userId, workload: event.workload || event.surface || state.workload,
      profile: event.profile || event.tier || state.profile, model: event.model || state.model,
      costSubunits: eventCost(event), policyVersion: state.policyVersion });
  }
  if (receipt) {
    session.receiptsByKey.set(receipt.idempotencyKey, receipt);
    session.latestReceipt = receipt;
    mirror.receipts.set(receipt.idempotencyKey, receipt);
  }
  if (!customDbAdapter) {
    // These are display caches, never authorities for accepting/debiting usage.
    // Bounded retention cannot weaken SQL uniqueness or restart recovery.
    const trim = (map: Map<any, any>, limit: number) => {
      while (map.size > limit) map.delete(map.keys().next().value);
    };
    sessions.delete(state.sessionKey);
    sessions.set(state.sessionKey, session);
    mirror.sessions.delete(state.sessionKey);
    mirror.sessions.set(state.sessionKey, { ...state });
    trim(sessions, 512); trim(mirror.sessions, 512);
    trim(mirror.events, 1024); trim(mirror.receipts, 1024);
    while (session.recordedEventIds.size > 256) session.recordedEventIds.delete(session.recordedEventIds.values().next().value!);
    trim(session.receiptsByKey, 128);
  }
  return session;
};

/** Resolves only after event acceptance commits. Rejection leaves the immutable event retryable. */
export const accumulateMeteredUsage = async (input: MeteredUsageIncrement): Promise<MeteredSessionState & { addedSubunits: number }> => {
  const increment = { ...input };
  const seed = identity(increment);
  if (increment.billableToUser === false) return { ...getOrCreateMeteredSession(seed), addedSubunits: 0 };
  return withSessionLock(seed.sessionKey, async () => {
    const anchor = getActiveMirrorAnchor(increment.queryRunner);
    if (customDbAdapter) {
      // Explicit unit-test adapter only. Production acceptance never uses this mirror as SQL recovery.
      const mirror = getStoreMirrorForAnchor(anchor);
      const state = { ...(mirror.sessions.get(seed.sessionKey) || seed), profile: seed.profile, model: seed.model };
      assertEventIdentity(increment, state);
      const prior = mirror.events.get(`${state.sessionKey}::${increment.eventId}`);
      const cost = eventCost(increment);
      if (prior && prior.costSubunits !== cost) throw billingError('Usage identity conflict', 'USAGE_EVENT_CONFLICT', 409);
      const addedSubunits = prior ? 0 : cost;
      state.cumulativeSubunits += addedSubunits;
      state.carrySubunits = carrySubunitsAfterSettlement(state.cumulativeSubunits, state.settledWholePixels);
      return { ...publishCommitted(state, anchor, [increment]), addedSubunits };
    }
    await ensureMeteredSchema(increment.queryRunner);
    const runTx = increment.queryRunner?.withTransaction || withTransaction;
    const accepted = await runTx(async query => {
      const state = await lockAccounting(query, seed);
      const addedSubunits = await recordEvent(query, state, { ...increment });
      return { state, addedSubunits };
    });
    return { ...publishCommitted(accepted.state, anchor, [increment]), addedSubunits: accepted.addedSubunits };
  }).catch(async (error: any) => {
    if (usageFailureHandler && !(error?.status >= 400 && error?.status < 500)) {
      await usageFailureHandler(increment, error);
    }
    throw error;
  });
};

const receiptKey = (key: string) => key.length <= 191 ? key : `sha256:${createHash('sha256').update(key).digest('hex')}`;
const makeReceipt = (state: AccountingState, key: string, balance: number, charged: number): MeteredSettlementReceipt => ({
  receiptId: randomUUID(), receiptSeq: state.receiptSeq, idempotencyKey: key, sessionKey: state.sessionKey,
  userId: state.userId, workload: state.workload, profile: state.profile, model: state.model,
  policyVersion: state.policyVersion, pixelsCharged: charged, totalSettledPixels: state.settledWholePixels,
  carrySubunits: state.carrySubunits, carriedSubunits: state.carrySubunits, cumulativeSubunits: state.cumulativeSubunits,
  unsettledWholePixels: Math.max(0, wholePixelsFromSubunits(state.cumulativeSubunits) - state.settledWholePixels),
  remainingPixels: balance, zeroBalanceReached: balance <= 0, settledAt: new Date().toISOString(),
});
const replayReceipt = (row: any, state: AccountingState, key: string): MeteredSettlementReceipt => {
  if (String(row.user_id) !== state.userId || String(row.session_key) !== state.sessionKey) {
    throw billingError('Receipt belongs to another user or session', 'IDEMPOTENCY_KEY_COLLISION', 409);
  }
  return { ...makeReceipt(state, key, Number(row.remaining_pixels), Number(row.pixels_charged)),
    receiptId: row.receipt_id, receiptSeq: Number(row.receipt_seq), totalSettledPixels: Number(row.total_settled_pixels),
    workload: row.workload || state.workload, profile: row.profile || state.profile, model: row.model || state.model,
    policyVersion: row.policy_version || state.policyVersion,
    carrySubunits: Number(row.carry_subunits), carriedSubunits: Number(row.carry_subunits),
    cumulativeSubunits: Number(row.cumulative_subunits), zeroBalanceReached: Boolean(row.zero_balance_reached), replayed: true,
    unsettledWholePixels: Math.max(0, wholePixelsFromSubunits(Number(row.cumulative_subunits)) - Number(row.total_settled_pixels)),
    settledAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString() };
};
const settleInTransaction = async (query: TransactionQuery, state: AccountingState, params: MeteredSettlementParams): Promise<MeteredSettlementReceipt> => {
  const key = receiptKey(params.idempotencyKey || `${state.sessionKey}:seq:${state.receiptSeq + 1}:usage:${state.cumulativeSubunits}`);
  const previous = await query('SELECT * FROM ai_metered_billing_receipts WHERE idempotency_key = ? LIMIT 1', [key]);
  if (previous?.[0]) return replayReceipt(previous[0], state, key);
  const members = await query('SELECT COALESCE(pixels, 0) AS pixels FROM members WHERE id = ? FOR UPDATE', [state.userId]);
  if (!members?.[0]) throw billingError('Billing account is unavailable', 'BILLING_ACCOUNT_UNAVAILABLE', 503);
  let balance = Math.max(0, Math.floor(Number(members[0].pixels)));
  if (!Number.isFinite(balance)) throw billingError('Balance is unavailable', 'BILLING_ACCOUNT_UNAVAILABLE', 503);
  const due = Math.max(0, wholePixelsFromSubunits(state.cumulativeSubunits) - state.settledWholePixels);
  if (params.strictFullBalance && balance < due) throw Object.assign(billingError('Not enough Pixels to settle confirmed usage', 'INSUFFICIENT_PIXELS', 402), { requiredPixels: due, availablePixels: balance });
  const charged = Math.min(balance, due);
  if (charged > 0) {
    const update = await query('UPDATE members SET pixels = GREATEST(COALESCE(pixels, 0) - ?, 0) WHERE id = ? AND COALESCE(pixels, 0) >= ?', [charged, state.userId, charged]);
    if (Number(update?.affectedRows) !== 1) throw billingError('Balance changed during settlement', 'BILLING_ACCOUNT_UNAVAILABLE', 503);
    balance -= charged;
  }
  state.settledWholePixels += charged;
  state.carrySubunits = carrySubunitsAfterSettlement(state.cumulativeSubunits, state.settledWholePixels);
  state.receiptSeq += 1;
  await writeAccounting(query, state);
  const receipt = makeReceipt(state, key, balance, charged);
  await query(`INSERT INTO ai_metered_billing_receipts
    (idempotency_key,receipt_id,session_key,user_id,receipt_seq,workload,profile,model,pixels_charged,total_settled_pixels,carry_subunits,cumulative_subunits,remaining_pixels,zero_balance_reached,policy_version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [key, receipt.receiptId, state.sessionKey, state.userId, state.receiptSeq, state.workload,
    state.profile, state.model, charged, state.settledWholePixels, state.carrySubunits, state.cumulativeSubunits, balance,
    receipt.zeroBalanceReached ? 1 : 0, state.policyVersion]);
  return receipt;
};

/** All participating accounting and application writes use this connection and publish only after commit.
 * Lock order: billing session, application/build row (if any), account. No provider work belongs in this callback.
 */
export const withMeteredSessionTransaction = async <T>(params: MeteredSettlementParams,
  work: (query: TransactionQuery, settle: (increment?: MeteredUsageIncrement) => Promise<MeteredSettlementReceipt>) => Promise<T>,
): Promise<T> => {
  const seed = identity(params);
  if (customDbAdapter) throw new Error('Compound billing transactions require the SQL query runner');
  return withSessionLock(seed.sessionKey, async () => {
    await ensureMeteredSchema(params.queryRunner);
    const runTx = params.queryRunner?.withTransaction || withTransaction;
    const committed = await runTx(async query => {
      const state = await lockAccounting(query, seed);
      const events: MeteredUsageIncrement[] = [];
      let receipt: MeteredSettlementReceipt | undefined;
      let settling = false;
      const value = await work(query, async increment => {
        if (settling) throw new Error('A compound transaction must settle once');
        settling = true;
        if (increment) {
          const immutableEvent = { ...increment };
          await recordEvent(query, state, immutableEvent);
          events.push(immutableEvent);
        }
        receipt = await settleInTransaction(query, state, params);
        return receipt;
      });
      return { value, state, events, receipt };
    });
    publishCommitted(committed.state, getActiveMirrorAnchor(params.queryRunner), committed.events, committed.receipt);
    return committed.value;
  });
};

const adapterSettlement = async (params: MeteredSettlementParams): Promise<MeteredSettlementReceipt> => {
  const seed = identity(params);
  return withSessionLock(seed.sessionKey, async () => {
    const anchor = getActiveMirrorAnchor();
    const mirror = getStoreMirrorForAnchor(anchor);
    const state = { ...(mirror.sessions.get(seed.sessionKey) || seed), profile: seed.profile, model: seed.model };
    const key = receiptKey(params.idempotencyKey || `${state.sessionKey}:seq:${state.receiptSeq + 1}:usage:${state.cumulativeSubunits}`);
    const prior = mirror.receipts.get(key);
    if (prior) {
      if (prior.userId !== state.userId || prior.sessionKey !== state.sessionKey) throw billingError('Receipt identity conflict', 'IDEMPOTENCY_KEY_COLLISION', 409);
      return { ...prior, replayed: true };
    }
    const due = Math.max(0, wholePixelsFromSubunits(state.cumulativeSubunits) - state.settledWholePixels);
    const result = await customDbAdapter!.atomicDebit({ userId: state.userId, sessionKey: state.sessionKey,
      idempotencyKey: key, receiptId: randomUUID(), receiptSeq: state.receiptSeq + 1, workload: state.workload,
      profile: state.profile, model: state.model, requestedPixels: due, cumulativeSubunits: state.cumulativeSubunits,
      settledWholePixelsBefore: state.settledWholePixels, strictFullBalance: params.strictFullBalance });
    state.settledWholePixels += result.actualCharged;
    state.carrySubunits = carrySubunitsAfterSettlement(state.cumulativeSubunits, state.settledWholePixels);
    state.receiptSeq += 1;
    const receipt = makeReceipt(state, key, result.remainingPixels, result.actualCharged);
    publishCommitted(state, anchor, [], receipt);
    return receipt;
  });
};

export const checkMeteredZeroBalanceGuard = async (userId: string, minimumPixels = 1) => {
  const required = Math.max(1, Math.floor(Number(minimumPixels) || 1));
  if (!String(userId || '').trim()) return { allowed: false, balance: 0, required };
  if (!customDbAdapter) await ensureMeteredSchema();
  const balance = Number(await (customDbAdapter ? customDbAdapter.getBalance(userId) : getPixelsForUser(userId)));
  if (!Number.isFinite(balance)) throw billingError('Balance is unavailable', 'BILLING_ACCOUNT_UNAVAILABLE', 503);
  return { allowed: balance >= required, balance: Math.max(0, Math.floor(balance)), required };
};

export const settleMeteredSession = async (params: MeteredSettlementParams): Promise<MeteredSettlementReceipt | null> => {
  try {
    const receipt = customDbAdapter ? await adapterSettlement(params)
      : await withMeteredSessionTransaction(params, async (_query, settle) => settle());
    return receipt.pixelsCharged === 0 && !params.forceReceipt && !receipt.replayed ? null : receipt;
  } catch (error: any) {
    if (settlementFailureHandler && !(error?.status >= 400 && error?.status < 500)) {
      await settlementFailureHandler({ ...params }, error);
    }
    if (params.throwOnError || error?.status === 401 || error?.status === 403 || error?.status === 409 || error?.status === 402) throw error;
    const state = identity(params);
    const cached = sessions.get(state.sessionKey);
    if (cached) Object.assign(state, { cumulativeSubunits: cached.cumulativeSubunits, settledWholePixels: cached.settledWholePixels,
      carrySubunits: cached.carrySubunits, receiptSeq: cached.receiptSeq });
    const pending: MeteredSettlementReceipt = { ...makeReceipt(state, params.idempotencyKey || '', 0, 0), remainingPixels: undefined,
      zeroBalanceReached: false, pendingReconciliation: true, error: error instanceof Error ? error.message : String(error) };
    // An unavailable balance is unknown, never a fabricated zero-wallet update.
    try { pending.remainingPixels = (await checkMeteredZeroBalanceGuard(params.userId)).balance; } catch { /* unknown */ }
    return pending;
  }
};

/** Passive, authenticated receipt readback for transports such as binary TTS. */
export const readMeteredSessionReceipts = async (params: {
  sessionKey: string; userId: string; afterReceiptSeq?: number; limit?: number;
}): Promise<MeteredSettlementReceipt[]> => {
  const state = identity(params);
  const requestedAfter = Number(params.afterReceiptSeq);
  const after = Number.isSafeInteger(requestedAfter) && requestedAfter >= 0 ? requestedAfter : 0;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 50)));
  if (customDbAdapter) {
    return [...getStoreMirrorForAnchor(getActiveMirrorAnchor()).receipts.values()]
      .filter(receipt => receipt.userId === state.userId && receipt.sessionKey === state.sessionKey && receipt.receiptSeq > after)
      .sort((a, b) => a.receiptSeq - b.receiptSeq).slice(0, limit).map(receipt => ({ ...receipt, replayed: false }));
  }
  await ensureMeteredSchema();
  const rows = await execQuery('SELECT * FROM ai_metered_billing_receipts WHERE session_key = ? AND user_id = ? AND receipt_seq > ? ORDER BY receipt_seq ASC LIMIT ?',
    [state.sessionKey, state.userId, after, limit]);
  return rows.map((row: any) => ({ ...replayReceipt(row, state, row.idempotency_key), replayed: false }));
};
