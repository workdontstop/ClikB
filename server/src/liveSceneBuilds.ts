import type { Request, Response } from 'express';
import { createLiveSceneModelClient, LIVE_SCENE_REQUEST_TIMEOUT_MS } from './liveSceneModelClient';
import { randomUUID } from 'crypto';
import execQuery, { withTransaction } from './execQuery';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { activeCreativeProfileIsOwned } from './CreativeProfileRoutes';
import { recordPixelCharge, providerUsageCursor, providerPixelsSince } from './aiUsageLedger';
import {
    buildMeteredSessionKey,
    rawPixelsToSubunits,
    SUBUNITS_PER_PIXEL,
    withMeteredSessionTransaction,
    type MeteredSettlementReceipt,
} from './meteredUsageBilling';
import { guardLiveBuild } from './liveBuildSecurity';
import { streamRoutedChatText } from './textGeneration';
import { validateMotionPlan, type MotionPlan } from './motionGuidePlan';
import { LivePlanAssembler, liveContinuationInstructions, liveStreamingOrder, mergeContinuationRaw, createLiveWorkspacePlan, type JsonPath } from './liveSceneStream';
import type { SceneAuthoringDraft } from './sceneAuthoring';
import { adoptMotionGuideState } from './motionGuideState';
import { validateScenePerformance } from './scenePerformance';
import { hasVisibleSceneGeometry } from './sceneVisibility';

/**
 * Server-owned live construction sessions (Update 2).
 *
 * One build = one buildId, one final receipt. A build may run several inference
 * segments (the first request plus creator-guided continuations or an
 * automatic format repair); confirmed usage settles at checkpoints and completion.
 * Accepted commits are kept in memory for replay and checkpointed to MySQL so
 * a reload/reconnect can recover the visible draft without a new model call.
 */

export type LiveSpec = {
    kind: 'spatial' | 'motion';
    operation: string;
    price: number;
    atCostPricing?: boolean;
    tier: string;
    planPath: JsonPath;
    basePlan?: MotionPlan;
    baseAuthoring?: SceneAuthoringDraft;
    adoptCheckpoint?: (raw: any, previous?: SceneAuthoringDraft, pinned?: readonly string[]) => { plan: MotionPlan; authoring: SceneAuthoringDraft };
    duration: number;
    request: any;
    finalize: (raw: any, meta: { model: string; provider: string }, authoring?: SceneAuthoringDraft) => Promise<any> | any;
    charge: () => Promise<Record<string, unknown>>;
    recordUsage: (model: string, usage: any, meta: Record<string, unknown>) => void;
};

export type LivePrepare = (userId: string, body: any) => Promise<LiveSpec>;
type BuildBillingSpec = Pick<LiveSpec, 'price' | 'tier' | 'atCostPricing'>;
type PendingFinal = { result: any; billing: BuildBillingSpec };

type Status = 'streaming' | 'paused' | 'finalizing' | 'completed' | 'discarded' | 'failed';
type ProviderLease = { owner: string; token: string; expiresAt: number };
export const LIVE_PROVIDER_LEASE_MS = 30_000;
export const LIVE_REMOTE_CHECKPOINT_POLL_MS = 2_000;
const providerOwner = randomUUID();
type ProviderFailure = { name?: string; code?: string; causes: { name?: string; code?: string }[]; elapsedMs: number; receivedContent: boolean };
const describeProviderFailure = (error: unknown, elapsedMs: number, receivedContent: boolean): ProviderFailure => {
    const chain: { name?: string; code?: string }[] = [], seen = new Set<object>();
    let current = error;
    const identifier = (value: unknown) => typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80) : undefined;
    while (current && typeof current === 'object' && !seen.has(current) && chain.length < 4) {
        seen.add(current);
        const entry = current as { name?: unknown; code?: unknown; cause?: unknown };
        chain.push({ name: identifier(entry.name), code: identifier(entry.code) });
        current = entry.cause;
    }
    // Names/codes identify transport failures without retaining headers,
    // request bodies, credentials, URLs or arbitrary provider error content.
    return { ...chain[0], causes: chain.slice(1), elapsedMs, receivedContent };
};

type LiveSession = {
    buildId: string;
    userId: string;
    kind: 'spatial' | 'motion';
    operation: string;
    targetKey: string;
    tier: string;
    body: any;
    status: Status;
    events: any[];
    seq: number;
    commitSeq: number;
    listeners: Set<Response>;
    abort?: AbortController;
    stopIntent?: 'pause' | 'stop';
    running?: Promise<void>;
    accepted?: MotionPlan;
    authoring?: SceneAuthoringDraft;
    rootFields?: Record<string, unknown>;
    pinned: string[];
    segments: number;
    charged: boolean;
    final?: any;
    error?: string;
    providerFailure?: ProviderFailure;
    startedAt: number;
    firstVisibleMs?: number;
    liveStreaming?: boolean;
    model?: string;
    provider?: string;
    lastPersist: number;
    viewportSnapshot?: string;
    rawProviderPixels?: number;
    settledWholePixels?: number;
    accruedSubunits?: number;
    meteredSessionSettledByBuild?: number;
    securityStop?: () => void;
    buildSteps?: number;
    renderCheckpoint?: { id: string; commitSeq: number };
    acceptRender?: (image: string) => void;
    providerLease?: ProviderLease;
    pendingFinal?: PendingFinal;
};

export const MAX_LIVE_CONTINUATIONS = 15;
const sessions = new Map<string, LiveSession>();
const preparers = new Map<string, LivePrepare>();
const buildAccountingLocks = new Map<string, Promise<unknown>>();
export const registerLivePreparer = (kind: 'spatial' | 'motion', prepare: LivePrepare) => { preparers.set(kind, prepare); };

const withBuildAccountingLock = async <T>(lockKey: string, work: () => Promise<T>): Promise<T> => {
    const previous = buildAccountingLocks.get(lockKey) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const tail = previous.catch(() => {}).then(() => gate);
    buildAccountingLocks.set(lockKey, tail);
    await previous.catch(() => {});
    try { return await work(); }
    finally { release(); if (buildAccountingLocks.get(lockKey) === tail) buildAccountingLocks.delete(lockKey); }
};

const sessionMeteredKey = (session: LiveSession): string =>
    buildMeteredSessionKey(
        session.kind,
        sessionWalletId(session),
        String(session.body?.billingSessionId || session.body?.projectKey || 'default'),
    );
const sessionWalletId = (session: LiveSession): string => String(session.body?.authenticatedWalletId || session.userId);

let schema: Promise<unknown> | undefined;
const ensureSchema = () => schema ||= execQuery(`CREATE TABLE IF NOT EXISTS scene_live_builds (
  build_id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(16) NOT NULL,
  operation VARCHAR(32) NOT NULL,
  target_key VARCHAR(255) NOT NULL,
  tier VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  request_body LONGTEXT NOT NULL,
  checkpoint LONGTEXT NULL,
  final_result LONGTEXT NULL,
  charged TINYINT(1) NOT NULL DEFAULT 0,
  segments INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_scene_live_builds_user_target (user_id, target_key, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(error => { schema = undefined; throw error; });

type BuildAccounting = Pick<LiveSession, 'rawProviderPixels' | 'settledWholePixels' | 'accruedSubunits'>;
const readCheckpoint = (value: string | null | undefined): Record<string, any> => {
    try { return value ? JSON.parse(value) : {}; } catch { return {}; }
};
const checkpointOf = (session: LiveSession, accounting: BuildAccounting = {}, lease: ProviderLease | null = session.providerLease || null, pending: PendingFinal | null = session.pendingFinal || null) => JSON.stringify({ accepted: session.accepted, authoring: session.authoring, rootFields: session.rootFields, pinned: session.pinned, commitSeq: session.commitSeq, error: session.error, providerFailure: session.providerFailure, liveStreaming: session.liveStreaming, model: session.model, provider: session.provider, viewportSnapshot: session.viewportSnapshot, rawProviderPixels: session.rawProviderPixels, settledWholePixels: session.settledWholePixels, accruedSubunits: session.accruedSubunits, meteredSessionSettledByBuild: session.meteredSessionSettledByBuild, buildSteps: session.buildSteps, pauseReason: (session as any).pauseReason, freeRetries: (session as any).freeRetries, ...accounting, providerLease: lease, pendingFinal: pending });
const mergeBuildAccounting = (session: LiveSession, checkpoint: Record<string, any>): BuildAccounting => ({
    rawProviderPixels: Math.max(0, session.rawProviderPixels || 0, Number(checkpoint.rawProviderPixels) || 0),
    settledWholePixels: Math.max(0, session.settledWholePixels || 0, Number(checkpoint.settledWholePixels) || 0),
    accruedSubunits: Math.max(0, session.accruedSubunits || 0, Number(checkpoint.accruedSubunits) || 0),
});
const persistence = new Map<string, Promise<unknown>>();

const leaseError = () => Object.assign(new Error('This build is active on another server. Its saved scene is retained; reconnect shortly.'), { status: 409, code: 'BUILD_BUSY' });
const ownsProviderLease = (session: LiveSession, lease: ProviderLease | null | undefined) => Boolean(
    lease && session.providerLease && lease.owner === providerOwner && lease.token === session.providerLease.token,
);
const assertProviderLease = (session: LiveSession, checkpoint: Record<string, any>) => {
    const lease = checkpoint.providerLease as ProviderLease | null | undefined;
    // Builds without a lease are supported for persisted legacy checkpoints;
    // active provider runs always acquire one before starting inference.
    if (lease || session.providerLease) {
        if (!ownsProviderLease(session, lease) || Number(lease?.expiresAt) <= Date.now()) throw leaseError();
    }
};

async function acquireProviderLease(session: LiveSession) {
    await ensureSchema();
    const lease = await withTransaction(async query => {
        const rows = await query('SELECT charged,final_result,checkpoint,status FROM scene_live_builds WHERE build_id=? AND user_id=? FOR UPDATE', [session.buildId, session.userId]);
        const row = rows?.[0];
        if (!row || row.charged || row.status === 'discarded') throw leaseError();
        const checkpoint = readCheckpoint(row.checkpoint), prior = checkpoint.providerLease as ProviderLease | undefined;
        if (prior && Number(prior.expiresAt) > Date.now()) throw leaseError();
        const next: ProviderLease = { owner: providerOwner, token: randomUUID(), expiresAt: Date.now() + LIVE_PROVIDER_LEASE_MS };
        await query('UPDATE scene_live_builds SET checkpoint=? WHERE build_id=? AND user_id=?', [JSON.stringify({ ...checkpoint, providerLease: next }), session.buildId, session.userId]);
        return next;
    });
    session.providerLease = lease;
}

async function renewProviderLease(session: LiveSession) {
    if (!session.providerLease) throw leaseError();
    const lease = await withTransaction(async query => {
        const rows = await query('SELECT charged,final_result,checkpoint,status FROM scene_live_builds WHERE build_id=? AND user_id=? FOR UPDATE', [session.buildId, session.userId]);
        const row = rows?.[0];
        if (!row || row.charged || row.status === 'discarded') throw leaseError();
        const checkpoint = readCheckpoint(row.checkpoint);
        assertProviderLease(session, checkpoint);
        const next: ProviderLease = { ...session.providerLease!, expiresAt: Date.now() + LIVE_PROVIDER_LEASE_MS };
        await query('UPDATE scene_live_builds SET checkpoint=? WHERE build_id=? AND user_id=?', [JSON.stringify({ ...checkpoint, providerLease: next }), session.buildId, session.userId]);
        return next;
    });
    session.providerLease = lease;
}

async function releaseProviderLease(session: LiveSession) {
    if (!session.providerLease) return;
    const token = session.providerLease.token;
    try {
        await withTransaction(async query => {
            const rows = await query('SELECT charged,final_result,checkpoint,status FROM scene_live_builds WHERE build_id=? AND user_id=? FOR UPDATE', [session.buildId, session.userId]);
            if (!rows?.[0]) return;
            const checkpoint = readCheckpoint(rows[0].checkpoint);
            if (checkpoint.providerLease?.owner !== providerOwner || checkpoint.providerLease?.token !== token) return;
            await query('UPDATE scene_live_builds SET checkpoint=? WHERE build_id=? AND user_id=?', [JSON.stringify({ ...checkpoint, providerLease: null }), session.buildId, session.userId]);
        });
        if (session.providerLease?.token === token) session.providerLease = undefined;
    } catch (error) {
        // A failed release cannot transfer ownership; its short expiry permits recovery.
        console.warn('[LiveScene] provider lease release unavailable', { buildId: session.buildId, reason: (error as Error).message });
    }
}

async function requireLocalProviderControl(session: LiveSession) {
    if (!session.providerLease) return;
    const rows = await execQuery('SELECT checkpoint FROM scene_live_builds WHERE build_id=? AND user_id=?', [session.buildId, session.userId]);
    const lease = readCheckpoint(rows?.[0]?.checkpoint).providerLease as ProviderLease | null | undefined;
    if (lease && Number(lease.expiresAt) > Date.now() && !ownsProviderLease(session, lease)) throw leaseError();
}

async function persist(session: LiveSession, force = false) {
    if (!force && Date.now() - session.lastPersist < 4000) return;
    session.lastPersist = Date.now();
    const previous = persistence.get(session.buildId) || Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
        await ensureSchema();
        await withTransaction(async query => {
            const rows = await query('SELECT charged,final_result,checkpoint,status FROM scene_live_builds WHERE build_id=? AND user_id=? FOR UPDATE', [session.buildId, session.userId]);
            // Another worker may have finalized while this checkpoint was queued.
            if (rows?.[0]?.charged || rows?.[0]?.status === 'discarded') return;
            const stored = readCheckpoint(rows?.[0]?.checkpoint);
            if (stored.providerLease && Number(stored.providerLease.expiresAt) > Date.now() && !ownsProviderLease(session, stored.providerLease)) return;
            const accounting = mergeBuildAccounting(session, stored);
            await query(`INSERT INTO scene_live_builds (build_id,user_id,kind,operation,target_key,tier,status,request_body,checkpoint,final_result,charged,segments)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status), checkpoint=VALUES(checkpoint), final_result=COALESCE(VALUES(final_result), final_result), segments=VALUES(segments)`,
                [session.buildId, session.userId, session.kind, session.operation, session.targetKey.slice(0, 255), session.tier, session.status, JSON.stringify(session.body), checkpointOf(session, accounting, stored.providerLease || null, session.status === 'discarded' ? null : stored.pendingFinal || session.pendingFinal || null), session.final ? JSON.stringify(session.final) : null, session.charged ? 1 : 0, session.segments]);
        });
    });
    persistence.set(session.buildId, write);
    try { await write; } catch (error) {
        // A checkpoint failure must never interrupt what the creator is watching.
        console.warn('[LiveScene] checkpoint unavailable', { buildId: session.buildId, reason: (error as Error).message });
        if (force) throw error;
    } finally { if (persistence.get(session.buildId) === write) persistence.delete(session.buildId); }
}

async function loadSession(buildId: string, userId: string): Promise<LiveSession | undefined> {
    const memory = sessions.get(buildId);
    if (memory) return memory.userId === userId ? memory : undefined;
    try {
        await ensureSchema();
        const rows = await execQuery('SELECT * FROM scene_live_builds WHERE build_id=? AND user_id=?', [buildId, userId]);
        const row = rows?.[0];
        if (!row) return undefined;
        const checkpoint = row.checkpoint ? JSON.parse(row.checkpoint) : {};
        const status: Status = row.status === 'streaming' || row.status === 'finalizing' ? 'paused' : row.status;
        const session: LiveSession = {
            buildId, userId, kind: row.kind, operation: row.operation, targetKey: row.target_key, tier: row.tier, body: JSON.parse(row.request_body),
            status, events: [], seq: 0, commitSeq: checkpoint.commitSeq || 0, listeners: new Set(), accepted: checkpoint.accepted, rootFields: checkpoint.rootFields,
            pinned: checkpoint.pinned || [], segments: row.segments || 1, charged: Boolean(row.charged), final: row.final_result ? JSON.parse(row.final_result) : undefined,
            error: row.status === 'streaming' ? 'The server restarted while this scene was being built. The scene so far is kept — Continue or Discard.' : checkpoint.error,
            startedAt: Date.now(), liveStreaming: checkpoint.liveStreaming, model: checkpoint.model, provider: checkpoint.provider, lastPersist: 0,
            viewportSnapshot: checkpoint.viewportSnapshot,
            rawProviderPixels: checkpoint.rawProviderPixels,
            settledWholePixels: checkpoint.settledWholePixels,
            accruedSubunits: checkpoint.accruedSubunits,
            meteredSessionSettledByBuild: checkpoint.meteredSessionSettledByBuild,
            buildSteps: checkpoint.buildSteps,
            authoring: checkpoint.authoring,
            providerFailure: checkpoint.providerFailure,
            providerLease: checkpoint.providerLease || undefined,
            pendingFinal: checkpoint.pendingFinal || undefined,
        };
        (session as any).pauseReason = checkpoint.pauseReason;
        (session as any).freeRetries = Number(checkpoint.freeRetries) || 0;
        sessions.set(buildId, session);
        return session;
    } catch { return undefined; }
}

function write(res: Response, event: any) {
    try { res.write(`${JSON.stringify(event)}\n`); (res as any).flush?.(); } catch { /* client gone */ }
}

function send(session: LiveSession, event: any) {
    if (['started', 'build', 'paused', 'error', 'final', 'continued', 'security', 'metered-billing'].includes(event.type)) {
        console.info('[ThreeJS]', JSON.stringify({ event: event.type, buildId: session.buildId,
            kind: session.kind, phase: session.status, elapsedMs: Date.now() - session.startedAt,
            segment: session.segments, provider: session.provider, model: session.model,
            code: event.code, stage: event.stage, reason: event.reason }));
    }
    const stamped = { ...event, buildId: session.buildId, seq: ++session.seq };
    session.events.push(stamped);
    if (session.events.length > 4000) session.events.splice(0, session.events.length - 4000);
    for (const listener of session.listeners) write(listener, stamped);
}

function endListeners(session: LiveSession) {
    for (const listener of session.listeners) { try { listener.end(); } catch { /* ignore */ } }
    session.listeners.clear();
}

function snapshotEvent(session: LiveSession) {
    return { type: 'snapshot', status: session.status, plan: session.accepted, authoring: session.authoring, commitSeq: session.commitSeq, error: session.error, providerFailure: session.providerFailure, final: session.status === 'completed' ? session.final : undefined,
        kind: session.kind, operation: session.operation, resumeBody: session.body, targetKey: session.targetKey, tier: session.tier, segments: session.segments, continuationsLeft: Math.max(0, MAX_LIVE_CONTINUATIONS - (session.segments - 1)),
        liveStreaming: session.liveStreaming, model: session.model, provider: session.provider, pinned: session.pinned, renderCheckpoint: session.renderCheckpoint, finalizationPending: Boolean(session.pendingFinal) };
}

function openStream(res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();
    try { (res.socket as any)?.setNoDelay?.(true); } catch { /* ignore */ }
    // Inference commonly needs 3–4 minutes; transport inactivity is not a job deadline.
    res.setTimeout?.(0);
}

function attach(session: LiveSession, res: Response, afterSeq?: number) {
    openStream(res);
    if (afterSeq !== undefined) {
        const replay = session.events.filter(event => event.seq > afterSeq);
        // Events evicted from memory (or a restarted server) are covered by a snapshot.
        const missingPrefix = !session.events.length || session.events[0].seq > afterSeq + 1 || afterSeq > session.seq;
        if (missingPrefix || !replay.length) write(res, { ...snapshotEvent(session), buildId: session.buildId, seq: session.seq });
        else for (const event of replay) write(res, event);
    }
    if (session.status !== 'streaming' && session.status !== 'finalizing') { res.end(); return; }
    session.listeners.add(res);
    const heartbeat = setInterval(() => write(res, { type: 'ping', buildId: session.buildId }), 10000);
    res.on('close', () => { clearInterval(heartbeat); session.listeners.delete(res); if (session.status === 'streaming' && !session.listeners.size) { session.stopIntent = 'pause'; session.abort?.abort(); } });
}

/** A foreign worker observes durable checkpoints; it never adopts provider ownership. */
function observedCheckpoint(session: LiveSession, row: any) {
    const checkpoint = readCheckpoint(row.checkpoint);
    const lease = checkpoint.providerLease as ProviderLease | null | undefined;
    const active = Boolean(lease && Number(lease.expiresAt) > Date.now());
    const running = row.status === 'streaming' || row.status === 'finalizing';
    const status: Status = row.charged && row.final_result ? 'completed' : running && !active ? 'paused' : row.status;
    const observed: LiveSession = { ...session, status, accepted: checkpoint.accepted || session.accepted,
        authoring: checkpoint.authoring, commitSeq: checkpoint.commitSeq || 0, pinned: checkpoint.pinned || [],
        segments: Number(row.segments) || 1, model: checkpoint.model, provider: checkpoint.provider,
        liveStreaming: checkpoint.liveStreaming, providerFailure: checkpoint.providerFailure,
        error: running && !active ? 'The previous server stopped responding. The saved scene is retained; Continue to resume.' : checkpoint.error,
        final: row.final_result ? JSON.parse(row.final_result) : undefined,
        pendingFinal: checkpoint.pendingFinal || undefined,
        // A render acknowledgement belongs to the owning process, not this observer.
        renderCheckpoint: undefined,
    };
    return { snapshot: { ...snapshotEvent(observed), ...(running && !active ? { recoverable: true } : {}) }, active: active && running && status !== 'completed', expiresAt: Number(lease?.expiresAt) || 0,
        signature: JSON.stringify([status, checkpoint.commitSeq, checkpoint.rawProviderPixels, checkpoint.settledWholePixels, checkpoint.error, row.final_result]) };
}

function observeForeignBuild(session: LiveSession, res: Response, initialRow: any, afterSeq: number) {
    openStream(res);
    let closed = false, sequence = afterSeq, lastSignature = '';
    let nextPoll: ReturnType<typeof setTimeout> | undefined, expiry: ReturnType<typeof setTimeout> | undefined;
    let lastSnapshot = snapshotEvent(session);
    const cleanup = () => { if (closed) return; closed = true; clearTimeout(nextPoll); clearTimeout(expiry); };
    const finish = () => { cleanup(); try { res.end(); } catch { /* disconnected */ } };
    const paused = (message: string) => {
        if (closed) return;
        write(res, { ...lastSnapshot, type: 'snapshot', status: 'paused', final: undefined, error: message, recoverable: true, buildId: session.buildId, seq: ++sequence });
        finish();
    };
    res.on('close', cleanup);
    const emit = (row: any) => {
        if (closed) return false;
        const observed = observedCheckpoint(session, row);
        lastSnapshot = observed.snapshot;
        if (observed.signature !== lastSignature) {
            lastSignature = observed.signature;
            write(res, { ...observed.snapshot, buildId: session.buildId, seq: ++sequence });
        } else {
            write(res, { type: 'ping', buildId: session.buildId });
        }
        clearTimeout(expiry);
        if (!observed.active) { finish(); return false; }
        // A stalled SQL read cannot keep a ghost stream open beyond the last
        // observed lease. No additional overlapping database reads are queued.
        expiry = setTimeout(() => paused('The live checkpoint could not be refreshed. The saved scene is retained; reconnect to resume.'), Math.max(1, observed.expiresAt - Date.now()));
        return true;
    };
    const poll = async () => {
        if (closed) return;
        try {
            const rows = await execQuery('SELECT * FROM scene_live_builds WHERE build_id=? AND user_id=?', [session.buildId, session.userId]);
            if (closed) return;
            if (!rows?.[0]) { paused('The saved build could not be found. Reconnect to refresh its state.'); return; }
            if (emit(rows[0])) nextPoll = setTimeout(poll, LIVE_REMOTE_CHECKPOINT_POLL_MS);
        } catch { paused('The live checkpoint is temporarily unavailable. The saved scene is retained; reconnect to resume.'); }
    };
    if (emit(initialRow)) nextPoll = setTimeout(poll, LIVE_REMOTE_CHECKPOINT_POLL_MS);
}

const client = createLiveSceneModelClient;

async function runSegment(session: LiveSession, spec: LiveSpec, continuation?: { base: MotionPlan; previousRoot?: Record<string, unknown>; automaticRepair?: boolean }) {
    const visualLoop = session.body.visualCheckpoints === true;
    if (visualLoop) session.buildSteps = (session.buildSteps || 0) + 1;
    const usageCursor = spec.atCostPricing ? providerUsageCursor() : 0;
    const controller = new AbortController();
    session.abort = controller; session.stopIntent = undefined; session.status = 'streaming'; session.error = undefined; session.providerFailure = undefined;
    await renewProviderLease(session);
    if (session.stopIntent || controller.signal.aborted) { await settlePaused(session); return; }
    const assembler = new LivePlanAssembler(spec.planPath, continuation?.base || spec.basePlan, spec.duration, { pinned: session.pinned, protectedControls: session.authoring?.manualControls, startSequence: session.commitSeq, deltaOnly: Boolean(continuation) || visualLoop && Boolean(spec.basePlan) });
    const segmentStarted = Date.now();
    send(session, { type: 'status', phase: 'thinking', message: continuation ? (continuation.automaticRepair ? 'AI is fixing the scene format…' : 'AI is continuing from your scene…') : 'AI is planning the scene…' });
    let text = '', drawing = false, meta = { model: String(spec.request.model), provider: 'openai', liveStreaming: true }, usage: any;
    try {
        for await (const chunk of streamRoutedChatText(client(), spec.request, controller.signal)) {
            if (session.stopIntent || controller.signal.aborted) break;
            if (chunk.type === 'meta') {
                meta = { model: chunk.model, provider: chunk.provider, liveStreaming: chunk.liveStreaming };
                session.model = chunk.model; session.provider = chunk.provider;
                if (chunk.notice) send(session, { type: 'notice', message: chunk.notice });
                send(session, { type: 'build', operation: session.operation, model: chunk.model, provider: chunk.provider, liveStreaming: chunk.liveStreaming, segment: session.segments });
                if (session.viewportSnapshot && chunk.model.includes('deepseek')) send(session, { type: 'notice', message: 'The current provider route cannot use viewport images. It receives the scene JSON and your text guidance.' });
            } else if (chunk.type === 'delta') {
                if (!drawing) { drawing = true; send(session, { type: 'status', phase: 'drawing', message: 'AI is building the scene…' }); }
                const commit = assembler.push(chunk.text);
                if (commit) {
                    session.commitSeq = commit.sequence;
                    session.accepted = assembler.current || session.accepted;
                    if (session.firstVisibleMs === undefined && hasVisibleSceneGeometry(session.accepted)) session.firstVisibleMs = Date.now() - session.startedAt;
                    try {
                        if (session.accepted && spec.adoptCheckpoint) {
                            const adopted = spec.adoptCheckpoint({ ...assembler.authoringPatch, ...(spec.planPath.length ? { plan: session.accepted } : session.accepted) }, session.authoring, session.pinned);
                            session.authoring = adopted.authoring; session.accepted = adopted.plan;
                        }
                    } catch { /* incomplete authoring dependencies remain provisional until the checkpoint */ }
                    send(session, { type: 'commit', ...commit, authoring: session.authoring, elapsedMs: Date.now() - segmentStarted });
                    void persist(session);
                }
            } else if (chunk.type === 'done') {
                text = chunk.text; usage = chunk.usage; meta = { model: chunk.model, provider: chunk.provider, liveStreaming: chunk.liveStreaming };
                if (!chunk.liveStreaming) {
                    // Honest fallback: this route returned everything at once.
                    send(session, { type: 'build', operation: session.operation, model: chunk.model, provider: chunk.provider, liveStreaming: false, segment: session.segments,
                        notice: 'This model route returned the whole scene at once instead of streaming it, so it could not be shown while being built.' });
                    const commit = assembler.push(chunk.text);
                    if (commit) { session.commitSeq = commit.sequence; session.accepted = assembler.current || session.accepted; send(session, { type: 'commit', ...commit }); }
                }
            }
        }
        session.liveStreaming = meta.liveStreaming;
        spec.recordUsage(meta.model, usage, { liveScene: session.operation, buildId: session.buildId, segment: session.segments });
        if (spec.atCostPricing) {
            const rawPixels = providerPixelsSince(usageCursor);
            if (rawPixels === null) throw new Error('Provider usage is unavailable; the draft is retained without a charge.');
            session.rawProviderPixels = (session.rawProviderPixels || 0) + rawPixels;
        }
    } catch (error) {
        session.abort = undefined;
        if (session.stopIntent) { await settlePaused(session); return; }
        session.providerFailure = describeProviderFailure(error, Date.now() - segmentStarted, drawing);
        const firstResponseDeadline = !drawing && session.providerFailure.name === 'APIConnectionTimeoutError'
            && session.providerFailure.elapsedMs >= LIVE_SCENE_REQUEST_TIMEOUT_MS - 1000;
        const settledClause = (session.settledWholePixels || 0) > 0
            ? `${session.settledWholePixels} P settled for completed steps; no additional pixels were charged.`
            : 'no pixels were charged.';
        session.error = firstResponseDeadline
            ? `The model did not start sending scene data within the 10-minute limit. The scene so far is kept; ${settledClause} Continue or Discard.`
            : `The AI stopped before finishing (${(error as Error)?.message?.slice(0, 200) || 'provider error'}). The scene so far is kept; ${settledClause} Continue or Discard.`;
        send(session, { type: 'error', recoverable: true, code: 'PROVIDER_FAILED', stage: 'provider-stream', message: session.error, providerFailure: session.providerFailure });
        await settlePaused(session);
        return;
    }
    // Keep this controller alive through the rendered checkpoint: Pause must
    // cancel both provider inference and a pending browser acknowledgement.
    if (!visualLoop) session.abort = undefined;
    if (session.stopIntent) { await settlePaused(session); return; }
    session.status = 'finalizing';
    send(session, { type: 'status', phase: 'validating', message: visualLoop ? 'Checking this scene chunk…' : 'Checking the finished scene…' });
    let raw: any = assembler.watcher.rootValue;
    if (raw === undefined) { try { raw = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { raw = null; } }
    // Never merge unreadable output with the segment's starting plan. That
    // used to turn an incomplete continuation into a successful empty workspace,
    // replacing geometry that had already streamed to the browser.
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        session.error = 'The model stopped before completing this scene chunk. The geometry already built is retained. Continue from this checkpoint; no final scene was charged.';
        send(session, { type: 'error', recoverable: true, code: 'INCOMPLETE_SCENE_RESPONSE', message: session.error });
        await settlePaused(session); return;
    }
    if (raw && typeof raw === 'object' && spec.planPath.length) session.rootFields = { ...(continuation?.previousRoot || session.rootFields || {}), ...Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'plan')) };
    if (continuation) raw = mergeContinuationRaw(raw, continuation.base, spec.planPath, session.pinned, continuation.previousRoot, session.authoring?.manualControls);
    else if (spec.basePlan && (session.pinned.length || visualLoop)) raw = mergeContinuationRaw(raw, spec.basePlan, spec.planPath, session.pinned, undefined, session.authoring?.manualControls);
    if (visualLoop) {
        try {
            const adopted = spec.adoptCheckpoint?.(raw, session.authoring, session.pinned);
            const accepted = adopted?.plan || validateMotionPlan(raw);
            if (Math.abs(accepted.duration - spec.duration) > .001) throw new Error('The checkpoint changed the requested duration.');
            if (!hasVisibleSceneGeometry(accepted)) throw new Error('The checkpoint contains no visible geometry.');
            session.accepted = accepted;
            if (adopted) session.authoring = adopted.authoring;
            session.status = 'streaming';
            const image = await waitForRenderedCheckpoint(session, controller.signal);
            if (session.stopIntent || controller.signal.aborted) { await settlePaused(session); return; }
            session.viewportSnapshot = image;
            // At least one visual feedback turn is required, even if the first
            // blockout incorrectly declares itself complete.
            if (raw?.buildProgress?.done !== true || (session.buildSteps || 0) < 2) {
                if ((session.buildSteps || 0) >= 8) throw new Error('The visual build reached its eight-step limit. Inspect the retained scene and Continue with guidance.');
                const next = continuationSpec(spec, session, accepted,
                    'Inspect the attached render of your last checkpoint. Correct visible framing, scale, overlap or missing geometry, then implement the next small unfinished part of the original motion task. Mark buildProgress.done true only when the complete requested scene and choreography are present.');
                return runSegment(session, next, { base: accepted, previousRoot: session.rootFields });
            }
        } catch (error) {
            session.error = (error as Error).message;
            send(session, { type: 'error', recoverable: true, code: 'RENDER_CHECKPOINT_FAILED', message: session.error });
            await settlePaused(session); return;
        }
    }
    let result: any;
    try {
        result = await spec.finalize(raw, meta, session.authoring);
        const finalPlan = result.plan || result.world?.plan || result.animatic?.plan;
        if (session.kind === 'motion' && !hasVisibleSceneGeometry(finalPlan)) throw new Error('The finished plan contains only an invisible workspace. The visible checkpoint is retained.');
    } catch (error) {
        const reason = (error as Error)?.message || 'Invalid scene data';
        // One bounded automatic repair, like the non-live Motion Guide route.
        if (!continuation?.automaticRepair && session.segments <= MAX_LIVE_CONTINUATIONS && session.accepted) {
            const repair = continuationSpec(spec, session, session.accepted, `Your previous output could not be used: ${reason}. Repair it.`);
            return runSegment(session, repair, { base: session.accepted, previousRoot: session.rootFields, automaticRepair: true });
        }
        const settledClause = (session.settledWholePixels || 0) > 0
            ? `${session.settledWholePixels} P settled for completed steps; no additional pixels were charged.`
            : 'no pixels were charged.';
        session.error = `The finished scene did not pass checks (${reason}). The scene so far is kept; ${settledClause} Continue with guidance or Discard.`;
        send(session, { type: 'error', recoverable: true, message: session.error });
        await settlePaused(session);
        return;
    }
    session.accepted = result.plan || result.world?.plan || result.animatic?.plan || session.accepted;
    session.authoring = result.authoring || result.world?.authoring || result.animatic?.authoring || session.authoring;
    await completeAndCharge(session, spec, result);
}

async function settlePaused(session: LiveSession) {
    if (session.status === 'paused') return;
    session.renderCheckpoint = undefined; session.acceptRender = undefined;
    session.securityStop?.(); session.securityStop = undefined;
    const intent = session.stopIntent;
    if (session.kind === 'motion' && session.accepted?.objects.some(object => object.id !== 'live_workspace')) {
        session.authoring = adoptMotionGuideState(session.accepted, session.authoring?.sourceKey || session.targetKey, session.authoring, undefined, session.pinned, true);
        session.accepted = session.authoring.plan;
    }
    session.status = 'paused';
    send(session, { type: 'paused', plan: session.accepted, authoring: session.authoring, commitSeq: session.commitSeq, reason: intent || 'error', error: session.error,
        continuationsLeft: Math.max(0, MAX_LIVE_CONTINUATIONS - (session.segments - 1)) });
    await releaseProviderLease(session);
    try { await persist(session, true); } catch { send(session, { type: 'error', recoverable: true, message: 'The draft is retained here, but its checkpoint could not be saved. Retry before closing.' }); }
    endListeners(session);
}

/** Every automatic step waits for the browser to actually render its accepted
 * scene. No timer, heartbeat or provider completion substitutes for this image. */
function waitForRenderedCheckpoint(session: LiveSession, signal: AbortSignal): Promise<string> {
    const checkpoint = { id: randomUUID(), commitSeq: session.commitSeq };
    return new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); session.acceptRender = undefined; session.renderCheckpoint = undefined; };
        const abort = () => { cleanup(); reject(new Error('The build was paused at its rendered checkpoint.')); };
        const timeout = setTimeout(() => { cleanup(); reject(new Error('The viewport did not return a rendered checkpoint within 30 seconds. The scene is retained; reopen the preview and Continue.')); }, 30000);
        session.renderCheckpoint = checkpoint;
        session.acceptRender = image => { cleanup(); resolve(image); };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { abort(); return; }
        send(session, { type: 'render-checkpoint', checkpointId: checkpoint.id, commitSeq: checkpoint.commitSeq, plan: session.accepted, authoring: session.authoring, step: session.buildSteps, message: 'Rendering this step for visual feedback…' });
        void persist(session, true).catch(() => {});
    });
}

/** POST /scene-live/render-feedback — authenticated acknowledgement of the
 * exact pending scene revision, carrying the actual viewport JPEG. */
export async function renderedLiveFeedback(req: Request, res: Response) {
    const user = authenticatedUserId(req);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const session = await loadSession(String(req.body?.buildId || ''), user);
    if (!session) return res.status(404).json({ message: 'This live build is no longer available.' });
    const checkpoint = session.renderCheckpoint;
    if (session.status !== 'streaming' || !checkpoint || req.body.checkpointId !== checkpoint.id || req.body.commitSeq !== checkpoint.commitSeq || !session.acceptRender) return res.status(409).json({ message: 'This rendered checkpoint is no longer current.' });
    let image: string | undefined;
    try { image = validateViewportSnapshot(req.body.viewportSnapshot); if (!image) throw new Error('A rendered viewport image is required.'); }
    catch (error) { return res.status(400).json({ message: (error as Error).message }); }
    session.acceptRender(image);
    send(session, { type: 'render-feedback', step: session.buildSteps, commitSeq: checkpoint.commitSeq, message: 'AI is inspecting the rendered scene…' });
    return res.json({ accepted: true });
}

/** Lock order is metered session -> build -> wallet, shared by ticks and completion. */
async function settleLiveBuildAccounting(session: LiveSession, spec: BuildBillingSpec, result?: any) {
    const finalizing = result !== undefined;
    const meteredKey = sessionMeteredKey(session);
    return withBuildAccountingLock(meteredKey, async () => {
        await persistence.get(session.buildId)?.catch(() => {});
        const committed = await withMeteredSessionTransaction({
            sessionKey: meteredKey, userId: sessionWalletId(session), workload: session.kind,
            profile: session.tier, model: session.model || session.tier,
            forceReceipt: true, strictFullBalance: false, throwOnError: true,
        }, async (query, settle) => {
            const rows = await query('SELECT charged,final_result,checkpoint,status FROM scene_live_builds WHERE build_id=? AND user_id=? FOR UPDATE', [session.buildId, session.userId]);
            const row = rows?.[0];
            if (!row) throw new Error('The build receipt is unavailable. The scene is retained.');
            const checkpoint = readCheckpoint(row.checkpoint);
            if (row.charged && row.final_result) {
                return { final: JSON.parse(row.final_result), fresh: false, deltaChargePixels: 0, receipt: null as MeteredSettlementReceipt | null,
                    accounting: mergeBuildAccounting(session, checkpoint) };
            }
            if (row.status === 'discarded') throw new Error('This build has been discarded.');
            assertProviderLease(session, checkpoint);
            if (session.stopIntent || !finalizing && (session.charged || session.status !== 'streaming')) return null;

            // The accepted usage event and this build watermark commit together. A
            // retry or another worker sees the saved watermark before adding usage.
            const previousAccrued = Math.max(0, Number(checkpoint.accruedSubunits) || 0);
            const buildSubunits = Math.max(previousAccrued, spec.atCostPricing
                ? rawPixelsToSubunits(Math.max(session.rawProviderPixels || 0, Number(checkpoint.rawProviderPixels) || 0))
                : finalizing ? rawPixelsToSubunits(spec.price) : 0);
            const deltaSubunits = Math.max(0, buildSubunits - previousAccrued);
            const receipt = await settle(deltaSubunits > 0 ? {
                sessionKey: meteredKey, userId: sessionWalletId(session), workload: session.kind,
                profile: session.tier, model: session.model || session.tier,
                eventId: `${session.buildId}:subunits:${buildSubunits}`,
                costSubunits: deltaSubunits, billableToUser: true,
            } : undefined);
            const deltaChargePixels = receipt.replayed ? 0 : receipt.pixelsCharged;
            const totalBuildPixelsCharged = Math.max(0, Number(checkpoint.settledWholePixels) || 0) + deltaChargePixels;
            const accounting: BuildAccounting = {
                rawProviderPixels: Math.max(session.rawProviderPixels || 0, Number(checkpoint.rawProviderPixels) || 0),
                accruedSubunits: buildSubunits,
                settledWholePixels: totalBuildPixelsCharged,
            };
            const savedCheckpoint = checkpointOf(session, accounting, finalizing ? null : checkpoint.providerLease || null, finalizing ? null : checkpoint.pendingFinal || session.pendingFinal || null);
            let final: any;
            if (finalizing) {
                final = {
                    ...result,
                    llmBilling: {
                        tier: session.kind === 'motion' ? 'motion-guide' : spec.tier,
                        receiptId: receipt.receiptId,
                        pixelsCharged: totalBuildPixelsCharged,
                        deltaPixelsCharged: deltaChargePixels,
                        settledPixels: totalBuildPixelsCharged,
                        carrySubunits: receipt.carrySubunits,
                        unsettledWholePixels: receipt.unsettledWholePixels,
                        carriedPixels: Number((receipt.carrySubunits / SUBUNITS_PER_PIXEL).toFixed(6)),
                        pixels: receipt.remainingPixels,
                        ...(spec.atCostPricing ? { pricing: 'provider-cost', rawPixels: accounting.rawProviderPixels } : {}),
                    },
                    liveBuild: {
                        buildId: session.buildId, liveStreaming: session.liveStreaming !== false,
                        model: session.model, provider: session.provider, firstVisibleMs: session.firstVisibleMs,
                        totalMs: Date.now() - session.startedAt, segments: session.segments,
                    },
                };
                await query("UPDATE scene_live_builds SET checkpoint=?,charged=1,status='completed',final_result=? WHERE build_id=? AND user_id=?",
                    [savedCheckpoint, JSON.stringify(final), session.buildId, session.userId]);
            } else {
                await query('UPDATE scene_live_builds SET checkpoint=? WHERE build_id=? AND user_id=?',
                    [savedCheckpoint, session.buildId, session.userId]);
            }
            return { final, fresh: true, deltaChargePixels, receipt, accounting };
        });
        // No in-memory billing counters, UI notifications or ledgers change until
        // the outer transaction (including the build checkpoint) has committed.
        if (committed) {
            Object.assign(session, committed.accounting);
            if (finalizing) session.providerLease = undefined;
        }
        return committed;
    });
}

async function completeAndCharge(session: LiveSession, spec: BuildBillingSpec, result: any) {
    // Keep provider success before any subsequent store/debit can fail. These
    // server-owned data fields are sufficient for a save-only retry after restart.
    session.pendingFinal ||= { result, billing: { tier: spec.tier, price: spec.price, atCostPricing: spec.atCostPricing } };
    if (session.stopIntent) { await settlePaused(session); return; }
    session.securityStop?.(); session.securityStop = undefined;
    await persist(session, true);
    const committed = await settleLiveBuildAccounting(session, spec, result);
    if (!committed) { await settlePaused(session); return; }
    session.charged = true; session.final = committed.final; session.status = 'completed';
    session.pendingFinal = undefined;
    if (committed.fresh && committed.deltaChargePixels > 0) {
        recordPixelCharge(committed.deltaChargePixels, session.kind === 'motion' ? 'motion-guide' : 'spatial-plan');
        if (spec.atCostPricing && committed.receipt) {
            send(session, { type: 'metered-billing', receiptId: committed.receipt.receiptId,
                pixelsCharged: committed.deltaChargePixels, settledWholePixels: session.settledWholePixels,
                carrySubunits: committed.receipt.carrySubunits, unsettledWholePixels: committed.receipt.unsettledWholePixels, pixels: committed.receipt.remainingPixels,
                tier: session.tier, surface: 'threejs' });
        }
    }
    send(session, { type: 'final', result: session.final });
    endListeners(session);
}

export function validateViewportSnapshot(value: unknown): string | undefined {
    if (value == null || value === '') return undefined;
    if (typeof value !== 'string' || value.length > 1_500_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('The viewport screenshot must be a JPEG under 1 MB.');
    const image = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
    if (image[0] !== 255 || image[1] !== 216 || image[image.length - 2] !== 255 || image[image.length - 1] !== 217) throw new Error('The viewport screenshot is not a valid JPEG.');
    return value;
}

function continuationSpec(spec: LiveSpec, session: LiveSession, accepted: MotionPlan, guidance: string): LiveSpec {
    const planAtRoot = spec.planPath.length === 0;
    // Keep the original task once; replace the previous checkpoint feedback
    // rather than accumulating a full scene and image on every turn.
    const messages = spec.request.messages.slice(0, 2);
    if (!String(messages[0].content).includes('LIVE CONTINUATION:')) messages[0] = { ...messages[0], content: `${messages[0].content}\n${liveContinuationInstructions(planAtRoot)}` };
    const content: any[] = [{ type: 'text', text: JSON.stringify({ acceptedScene: accepted, acceptedAuthoring: session.authoring, sourceState: session.authoring?.sourceState, pinnedObjectIds: session.pinned, creatorGuidance: guidance || 'Continue building the remaining scene.', viewportImage: session.viewportSnapshot ? 'The attached image is the rendered timestamped contact sheet of this accepted shot. Use it alongside sourceState, acceptedAuthoring and the original reference; construction steps are revisions of the same timeline.' : undefined }) }];
    if (session.viewportSnapshot && !String(spec.request.model).includes('deepseek')) content.push({ type: 'image_url', image_url: { url: session.viewportSnapshot, detail: 'high' } });
    else if (session.viewportSnapshot) send(session, { type: 'notice', message: 'The selected model does not accept viewport images. Guidance uses your text and scene JSON.' });
    messages.push({ role: 'user', content });
    return { ...spec, basePlan: accepted, request: { ...spec.request, messages } };
}

function liveRequest(spec: LiveSpec, visualCheckpoints = false): LiveSpec {
    const messages = [...spec.request.messages];
    messages[0] = { ...messages[0], content: `${messages[0].content}\n${liveStreamingOrder(spec.planPath.length === 0)}\nWhen lighting is requested, include lightingRig inside the plan AFTER objects: {preset:studio|golden|noon|dramatic|moonlight|backlit,azimuthDeg:number(-360..360),elevationDeg:number(8..88),intensity:number(.25..2.5)}. This is rendered and saved with the scene.` };
    if (visualCheckpoints) {
        messages[0] = { ...messages[0], content: `${messages[0].content}\nVISUAL CHECKPOINT BUILD (changes response delivery, preserving the existing geometry, rig, state and performance requirements): Build in coherent renderable increments. Establish the actual starting pose, required contacts and attachments with the physical environment and camera; do not substitute a standing template for the source state. On subsequent turns inspect the actual rendered image, acceptedScene, acceptedAuthoring and sourceState. Add the next required geometry or choreography while preserving unaffected work. Return complete definitions for changed objects using the SAME stable object and part IDs; omitted objects remain in acceptedScene. There is no additional root/part count cap and no reduced-fidelity geometry policy for streaming. Use as many connected parts and timeline keys as the requested pose and performance require. Every checkpoint represents the full requested timeline, not the next chronological slice. Include initialState metadata for newly represented subjects. Include buildProgress:{done:boolean,next:string} LAST at the root; next names a specific missing requirement, rather than an optional visual improvement. done means all requested subjects, physical states, camera movement and action timing are represented, not just that this increment is finished. A rendered screenshot is supplied before each next turn for comparison against the original source and requested performance. Do not rebuild unchanged objects, reset sourceState, or polish unrelated details. The first step receives visual feedback before finalization.` };
        // Streaming must not silently change the selected model's established
        // reasoning or completion budget.
        return { ...spec, request: { ...spec.request, messages } };
    }
    return { ...spec, request: { ...spec.request, messages } };
}

function secureSession(session: LiveSession, spec: LiveSpec, req: Request) {
    session.securityStop?.();
    // Re-read the signed cookie each time, bypassing the request's cached identity.
    const identity: Request = Object.assign(Object.create(req), { authenticatedUserId: undefined });
    session.securityStop = guardLiveBuild(async () => {
        const t0 = Date.now();
        if (authenticatedUserId(identity) !== session.userId || authenticatedOwnerId(identity) !== sessionWalletId(session)
            || !await activeCreativeProfileIsOwned(session.userId, sessionWalletId(session))) throw new Error('Your session expired. Sign in to continue this draft.');
        const tProfile = Date.now() - t0;
        (identity as any).authenticatedUserId = undefined;
        const tLeaseStart = Date.now();
        await renewProviderLease(session);
        const tLease = Date.now() - tLeaseStart;
        let balance: number;
        const tBillingStart = Date.now();
        if (spec.atCostPricing && !session.charged && session.status === 'streaming' && !session.stopIntent) {
            const committed = await settleLiveBuildAccounting(session, spec);
            if (committed?.receipt) {
                if (typeof committed.receipt.remainingPixels !== 'number') throw new Error('The billing balance is unavailable. The draft is retained.');
                balance = committed.receipt.remainingPixels;
                if (committed.receipt.replayed) {
                    const rows = await execQuery('SELECT pixels FROM members WHERE id=?', [sessionWalletId(session)]);
                    balance = Number(rows?.[0]?.pixels);
                }
                if (committed.deltaChargePixels > 0) {
                    recordPixelCharge(committed.deltaChargePixels, session.kind === 'motion' ? 'motion-guide' : 'spatial-plan');
                    send(session, { type: 'metered-billing', receiptId: committed.receipt.receiptId,
                        pixelsCharged: committed.deltaChargePixels, settledWholePixels: session.settledWholePixels,
                        carrySubunits: committed.receipt.carrySubunits, unsettledWholePixels: committed.receipt.unsettledWholePixels, pixels: balance, tier: session.tier, surface: 'threejs' });
                }
            } else {
                const rows = await execQuery('SELECT pixels FROM members WHERE id=?', [sessionWalletId(session)]);
                balance = Number(rows?.[0]?.pixels);
            }
        } else {
            const rows = await execQuery('SELECT pixels FROM members WHERE id=?', [sessionWalletId(session)]);
            balance = Number(rows?.[0]?.pixels);
        }
        const tBilling = Date.now() - tBillingStart;
        const totalMs = Date.now() - t0;
        const required = spec.atCostPricing ? 1 : spec.price;
        if (!Number.isFinite(balance) || balance < required) throw new Error('The build stopped because the pixel balance is no longer sufficient. The draft is retained.');
        (session as any).lastSecurityTiming = { totalMs, profileMs: tProfile, leaseMs: tLease, billingMs: tBilling };
        if (totalMs > 1000) {
            console.warn('[ThreeJS] security check took', totalMs, 'ms (profile:', tProfile, 'ms, lease:', tLease, 'ms, billing:', tBilling, 'ms)');
        }
        return balance;
    }, pixels => send(session, { type: 'security', verified: true, pixels, intervalMs: 10000, timing: (session as any).lastSecurityTiming }), error => {
        session.stopIntent = 'pause'; session.error = error.message;
        (session as any).pauseReason = 'SECURITY_STOP';
        send(session, { type: 'error', code: 'SECURITY_STOP', stage: 'security-heartbeat', recoverable: true, message: error.message, timing: (session as any).lastSecurityTiming });
        session.abort?.abort();
        void settlePaused(session);
    });
}

/** Entry point used by the existing plan routes when `body.live === true`. */
export async function handleLiveRequest(req: Request, res: Response, kind: 'spatial' | 'motion', userId: string) {
    console.info('[ThreeJS]', JSON.stringify({ event: 'preparing', kind }));
    const body = req.body || {};
    const prepare = preparers.get(kind)!;
    if (body.continueBuildId) return continueLive(req, res, kind, userId, prepare);
    let spec: LiveSpec;
    const walletId = authenticatedOwnerId(req) || userId;
    try { spec = liveRequest(await prepare(walletId, body), body.visualCheckpoints === true); }
    catch (error) { return res.status((error as any)?.status || 400).json({ code: 'PREPARATION_FAILED', stage: 'preparation', message: (error as Error).message, ...((error as any)?.extra || {}) }); }
    const session: LiveSession = {
        buildId: randomUUID(), userId, kind, operation: spec.operation, targetKey: String(body.liveTargetKey || '').slice(0, 255), tier: spec.tier,
        body: { ...body, live: undefined, authenticatedWalletId: walletId }, status: 'streaming', events: [], seq: 0, commitSeq: 0, listeners: new Set(), pinned: Array.isArray(body.pinnedObjectIds) ? body.pinnedObjectIds.filter((id: unknown) => typeof id === 'string').slice(0, 400) : [], segments: 1, charged: false,
        startedAt: Date.now(), lastPersist: 0, accepted: spec.basePlan || createLiveWorkspacePlan(spec.duration), authoring: spec.baseAuthoring,
    };
    if (spec.basePlan && Array.isArray(body.assistParticipants)) {
        const allowed = new Set(body.assistParticipants.filter((id: unknown) => typeof id === 'string'));
        session.pinned = [...new Set([...session.pinned, ...spec.basePlan.objects.filter(object => !allowed.has(object.id)).map(object => object.id)])];
    }
    try { await persist(session, true); await acquireProviderLease(session); } catch { return res.status(503).json({ message: 'The checkpoint store is unavailable. No AI request was started.' }); }
    sessions.set(session.buildId, session);
    if (res.destroyed) { session.status = 'paused'; await releaseProviderLease(session); await persist(session, true); return; }
    attach(session, res);
    send(session, { type: 'started', operation: session.operation, targetKey: session.targetKey, tier: session.tier, basePlan: spec.basePlan, authoring: session.authoring, duration: spec.duration, price: spec.price, continuationsLeft: MAX_LIVE_CONTINUATIONS });
    secureSession(session, spec, req);

    session.running = runSegment(session, spec).catch(async error => {
        session.error = (error as Error).message; send(session, { type: 'error', recoverable: true, message: session.error }); await settlePaused(session);
    }).finally(async () => { session.securityStop?.(); session.securityStop = undefined; await releaseProviderLease(session); });
}

async function continueLive(req: Request, res: Response, kind: 'spatial' | 'motion', userId: string, prepare: LivePrepare) {
    const body = req.body || {};
    const session = await loadSession(String(body.continueBuildId), userId);
    if (!session || session.kind !== kind) return res.status(404).json({ message: 'This live build is no longer available.' });
    if (body.liveTargetKey !== session.targetKey) return res.status(409).json({ message: 'This continuation belongs to a different scene.' });
    if (session.status !== 'paused') return res.status(409).json({ message: session.status === 'completed' ? 'This build is already finished.' : 'Pause the build before continuing.' });
    if (body.llmTier !== undefined && body.llmTier !== session.tier) return res.status(409).json({ message: 'Continue with the model the build started with.' });
    try {
        const rows = await execQuery('SELECT charged,final_result,checkpoint,status FROM scene_live_builds WHERE build_id=? AND user_id=?', [session.buildId, session.userId]);
        const row = rows?.[0];
        if (!row) throw new Error('The saved build is unavailable.');
        const checkpoint = readCheckpoint(row.checkpoint);
        if (row.charged && row.final_result) {
            session.final = JSON.parse(row.final_result); session.status = 'completed'; session.charged = true; session.pendingFinal = undefined;
            openStream(res); write(res, { ...snapshotEvent(session), buildId: session.buildId, seq: session.seq + 1 }); res.end(); return;
        }
        session.pendingFinal = checkpoint.pendingFinal || session.pendingFinal;
        if (checkpoint.pendingFinal) {
            session.accepted = checkpoint.accepted || session.accepted;
            session.authoring = checkpoint.authoring || session.authoring;
        }
    } catch (error) {
        if (!session.pendingFinal) return res.status(503).json({ recoverable: true, message: 'The saved build could not be checked. No AI request was started.' });
    }
    if (session.pendingFinal) {
        const pending = session.pendingFinal;
        try {
            if (ownsProviderLease(session, session.providerLease)) await releaseProviderLease(session);
            await acquireProviderLease(session);
        }
        catch (error) { return res.status((error as any).status || 503).json({ code: (error as any).code || 'BUILD_STORE_UNAVAILABLE', recoverable: true, message: (error as Error).message, plan: session.accepted, buildId: session.buildId }); }
        session.status = 'finalizing'; session.stopIntent = undefined; session.error = undefined;
        attach(session, res);
        send(session, { type: 'status', phase: 'validating', message: 'Saving the completed scene…' });
        session.running = completeAndCharge(session, pending.billing, pending.result).catch(async error => {
            session.error = (error as Error).message;
            send(session, { type: 'error', code: 'FINALIZATION_PENDING', recoverable: true, message: 'The completed scene is retained. Continue retries saving it without another AI run.' });
            await settlePaused(session);
        }).finally(async () => { session.securityStop?.(); session.securityStop = undefined; await releaseProviderLease(session); });
        return;
    }
    if (session.segments - 1 >= MAX_LIVE_CONTINUATIONS) return res.status(409).json({ message: `This build has used its ${MAX_LIVE_CONTINUATIONS} included continuations. Keep the scene or start a new build.` });
    let accepted: MotionPlan;
    try { accepted = validateMotionPlan(body.partialPlan ?? session.accepted); }
    catch (error) { return res.status(400).json({ message: `The current scene is not valid: ${(error as Error).message}` }); }
    const guidance = typeof body.guidance === 'string' ? body.guidance.slice(0, 4000) : '';
    session.pinned = Array.isArray(body.pinnedObjectIds) ? body.pinnedObjectIds.filter((id: unknown) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)).slice(0, 400) : session.pinned;
    try { session.viewportSnapshot = validateViewportSnapshot(body.viewportSnapshot) || session.viewportSnapshot; } catch (e) { return res.status(400).json({ message: (e as Error).message }); }
    session.status = 'streaming';
    let spec: LiveSpec;
    try { spec = liveRequest(await prepare(authenticatedOwnerId(req) || userId, session.body), session.body.visualCheckpoints === true); }
    catch (error) { session.status = 'paused'; return res.status(400).json({ message: (error as Error).message }); }
    let authoring = session.authoring;
    if (body.authoring || authoring || kind === 'motion') {
        try {
            const supplied = body.authoring ? validateScenePerformance({ plan: accepted, authoring: body.authoring }).authoring : session.authoring;
            authoring = body.authoring ? supplied! : adoptMotionGuideState(accepted, supplied?.sourceKey || session.targetKey, supplied, undefined, session.pinned, true);
            accepted = authoring.plan;
        } catch (error) { session.status = 'paused'; return res.status(400).json({ message: (error as Error).message }); }
    }
    try { await acquireProviderLease(session); }
    catch (error) {
        session.status = 'paused';
        return res.status((error as any).status || 503).json({ code: (error as any).code || 'BUILD_STORE_UNAVAILABLE', recoverable: true, message: (error as Error).message, plan: session.accepted, buildId: session.buildId });
    }
    const isSystemPause = session.error && (
        session.error.includes('security check timed out') ||
        session.error.includes('stopped before completing this scene chunk') ||
        session.error.includes('viewport did not return a rendered checkpoint') ||
        session.error.includes('AI stopped before finishing')
    );
    const freeRetries = (session as any).freeRetries || 0;
    if (isSystemPause && freeRetries < 10 && !guidance) {
        (session as any).freeRetries = freeRetries + 1;
    } else {
        session.segments += 1;
    }
    // A creator continuation gets a fresh bounded cycle, independent of the
    // manual continuation allowance and previous automatic build steps.
    session.buildSteps = 0;
    session.accepted = accepted;
    session.authoring = authoring;
    if (res.destroyed) { session.status = 'paused'; await releaseProviderLease(session); await persist(session, true); return; }
    try { await persist(session, true); }
    catch { session.status = 'paused'; await releaseProviderLease(session); return res.status(503).json({ recoverable: true, message: 'The build checkpoint could not be saved. No AI request was started.' }); }
    attach(session, res);
    send(session, { type: 'continued', plan: session.accepted, authoring: session.authoring, guidance, pinned: session.pinned, segment: session.segments, continuationsLeft: Math.max(0, MAX_LIVE_CONTINUATIONS - (session.segments - 1)) });
    secureSession(session, spec, req);
    session.running = runSegment(session, continuationSpec(spec, session, accepted, guidance), { base: accepted, previousRoot: session.rootFields }).catch(async error => {
        session.error = (error as Error).message; send(session, { type: 'error', recoverable: true, message: session.error }); await settlePaused(session);
    }).finally(async () => { session.securityStop?.(); session.securityStop = undefined; await releaseProviderLease(session); });
}

const liveUser = authenticatedUserId;
const changesPendingFinal = (session: LiveSession, body: any) => session.pendingFinal && (
    body?.partialPlan && JSON.stringify(body.partialPlan) !== JSON.stringify(session.accepted)
    || body?.authoring && JSON.stringify(body.authoring) !== JSON.stringify(session.authoring)
);
const pendingFinalEditMessage = 'This scene is already complete and waiting to be saved. Continue saves it without another AI run; apply further edits afterward.';

/** POST /scene-live/pause {buildId} — stop inference now; keep everything accepted. */
export async function pauseLiveBuild(req: Request, res: Response) {
    const user = liveUser(req);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const session = await loadSession(String(req.body?.buildId || ''), user);
    if (!session) return res.status(404).json({ message: 'This live build is no longer available.' });
    try { await requireLocalProviderControl(session); }
    catch (error) { return res.status((error as any).status || 503).json({ code: (error as any).code, recoverable: true, message: (error as Error).message, plan: session.accepted, buildId: session.buildId }); }
    if (changesPendingFinal(session, req.body)) return res.status(409).json({ recoverable: true, message: pendingFinalEditMessage, plan: session.accepted });
    if (req.body?.checkpointOnly && (session.status !== 'paused' || req.body.commitSeq !== session.commitSeq)) return res.status(409).json({ message: 'This draft changed before the manual correction was saved. Reconnect to its current checkpoint.' });
    try { session.viewportSnapshot = validateViewportSnapshot(req.body?.viewportSnapshot) || session.viewportSnapshot; } catch (e) { return res.status(400).json({ message: (e as Error).message }); }
    // Once validation/receipt commit has begun, return its settled result rather
    // than telling the client it can edit a draft that is still being finalized.
    if (session.status === 'finalizing') await session.running?.catch(() => {});
    if (session.status === 'streaming' && session.abort) {
        session.stopIntent = 'pause';
        session.abort.abort();
        await session.running?.catch(() => {});
    }
    if (session.status === 'paused' && req.body?.partialPlan) {
        let accepted: MotionPlan;
        try { accepted = validateMotionPlan(req.body.partialPlan); }
        catch (error) { return res.status(400).json({ message: (error as Error).message }); }
        const pinned = Array.isArray(req.body.pinnedObjectIds) ? req.body.pinnedObjectIds.filter((id: unknown) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)).slice(0, 400) : session.pinned;
        let authoring = session.authoring;
        if (req.body.authoring || authoring || session.kind === 'motion') {
            try {
                const supplied = req.body.authoring ? validateScenePerformance({ plan: accepted, authoring: req.body.authoring }).authoring : session.authoring;
                authoring = req.body.authoring ? supplied! : adoptMotionGuideState(accepted, supplied?.sourceKey || session.targetKey, supplied, undefined, pinned, true);
                accepted = authoring.plan;
            } catch (error) { return res.status(400).json({ message: (error as Error).message }); }
        }
        session.accepted = accepted; session.authoring = authoring; session.pinned = pinned;
        await persist(session, true);
    }
    return res.json(snapshotEvent(session));
}

/** POST /scene-live/stop {buildId, keep} — keep the partial scene as a finished draft, or discard. */
export async function stopLiveBuild(req: Request, res: Response) {
    const user = liveUser(req);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const session = await loadSession(String(req.body?.buildId || ''), user);
    if (!session) return res.status(404).json({ message: 'This live build is no longer available.' });
    try { await requireLocalProviderControl(session); }
    catch (error) { return res.status((error as any).status || 503).json({ code: (error as any).code, recoverable: true, message: (error as Error).message, plan: session.accepted, buildId: session.buildId }); }
    if (session.status === 'finalizing') await session.running?.catch(() => {});
    if ((session as LiveSession).status === 'completed') return res.json({ final: session.final });
    if (session.status === 'streaming' && session.abort) { session.stopIntent = 'stop'; session.abort.abort(); await session.running?.catch(() => {}); }
    // The awaited running segment may have completed and charged atomically.
    if ((session as LiveSession).status === 'completed') return res.json({ final: session.final });
    if (!req.body?.keep) {
        session.status = 'discarded';
        await releaseProviderLease(session);
        try { await persist(session, true); }
        catch (error) { session.status = 'paused'; throw error; }
        session.pendingFinal = undefined;
        send(session, { type: 'discarded' }); endListeners(session);
        return res.json({ discarded: true, pixelsCharged: session.settledWholePixels || 0 });
    }
    if (changesPendingFinal(session, req.body)) return res.status(409).json({ recoverable: true, message: pendingFinalEditMessage, plan: session.accepted });
    if (!session.accepted) return res.status(422).json({ message: 'Nothing has been built yet to keep. Continue or Discard.' });
    let accepted: MotionPlan;
    try { accepted = validateMotionPlan(req.body?.partialPlan ?? session.accepted); } catch (error) { return res.status(400).json({ message: (error as Error).message }); }
    if (req.body.authoring || session.authoring || session.kind === 'motion') {
        try {
            const supplied = req.body.authoring ? validateScenePerformance({ plan: accepted, authoring: req.body.authoring }).authoring : session.authoring;
            session.authoring = req.body.authoring ? supplied! : adoptMotionGuideState(accepted, supplied?.sourceKey || session.targetKey, supplied, undefined, session.pinned, true);
            accepted = session.authoring.plan;
        } catch (error) { return res.status(400).json({ message: (error as Error).message }); }
    }
    session.accepted = accepted; session.status = 'paused';
    await releaseProviderLease(session);
    await persist(session, true);
    return res.json({ kept: true, plan: accepted, authoring: session.authoring, buildId: session.buildId, pixelsCharged: session.settledWholePixels || 0 });
}

/** GET /scene-live/events?buildId=&after= — reconnect/reload replay without a new model call. */
export async function liveBuildEvents(req: Request, res: Response) {
    const user = liveUser(req);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const session = await loadSession(String(req.query.buildId || ''), user);
    if (!session) return res.status(404).json({ message: 'This live build is no longer available.' });
    const after = Math.max(0, Number(req.query.after) || 0);
    if (session.status === 'completed' && session.final || session.running && ownsProviderLease(session, session.providerLease)) {
        attach(session, res, after); return;
    }
    try {
        const rows = await execQuery('SELECT * FROM scene_live_builds WHERE build_id=? AND user_id=?', [session.buildId, session.userId]);
        if (!rows?.[0]) return res.status(404).json({ message: 'This live build is no longer available.' });
        observeForeignBuild(session, res, rows[0], after);
    } catch {
        // A cached local snapshot remains recoverable when the store is offline.
        openStream(res);
        write(res, { ...snapshotEvent(session), status: 'paused', error: 'The live checkpoint is temporarily unavailable. The saved scene is retained.', buildId: session.buildId, seq: after + 1 });
        res.end();
    }
}

/** GET /scene-live/recent?targetKey= — builds a reload can recover for this target. */
export async function recentLiveBuilds(req: Request, res: Response) {
    const user = liveUser(req);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const targetKey = String(req.query.targetKey || '').slice(0, 255);
    const memory = [...sessions.values()].filter(session => session.userId === user && session.targetKey === targetKey && ['streaming', 'paused', 'finalizing'].includes(session.status));
    let rows: any[] = [];
    try {
        await ensureSchema();
        rows = await execQuery(`SELECT build_id, status, operation, updated_at FROM scene_live_builds WHERE user_id=? AND target_key=? AND status IN ('streaming','paused','finalizing') AND updated_at > (NOW() - INTERVAL 1 DAY) ORDER BY updated_at DESC LIMIT 5`, [user, targetKey]);
    } catch { rows = []; }
    const ids = new Set(memory.map(session => session.buildId));
    return res.json({ builds: [...memory.map(session => ({ buildId: session.buildId, status: session.status, operation: session.operation })),
        ...rows.filter(row => !ids.has(row.build_id)).map(row => ({ buildId: row.build_id, status: row.status === 'paused' ? 'paused' : 'paused', operation: row.operation }))] });
}

/** Test hook. */
export const __liveSessionsForTest = sessions;
