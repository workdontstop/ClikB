import { applyLiveOps, createLiveWorkspacePlan } from '../server/src/liveSceneStream';
import type { MotionPlan } from '../server/src/motionGuidePlan';
import { liveSceneLog, exportLiveSceneLogs } from './liveSceneDiagnostics';
import { applyAuthoringCommands, createAuthoringDraft, samplePose, type AuthoringCommand, type SceneAuthoringDraft } from '../server/src/sceneAuthoring';
import { bindWorldRigs } from '../server/src/sceneRig';
import { adoptMotionGuideState } from '../server/src/motionGuideState';
import { hasVisibleSceneGeometry } from '../server/src/sceneVisibility';
import { validateScenePerformance } from '../server/src/scenePerformance';

export type LiveSceneState = { phase: 'idle' | 'streaming' | 'paused'; buildId?: string; plan?: MotionPlan; authoring?: SceneAuthoringDraft; message: string; error?: string; notice?: string; pinned: string[]; continuationsLeft: number; segment: number; price?: number; pausing?: boolean; stopping?: boolean; exporting?: boolean; exportedVideoUrl?: string; canUndo?: boolean; canRedo?: boolean; local?: boolean; tier?: string; kind?: 'spatial' | 'motion'; operation?: string; resumeBody?: Record<string, any>; lastMeteredBilling?: { id: string; pixelsCharged: number; settledWholePixels: number; pixels?: number; at: number } };
export type LiveDraftResult = { liveDraft: true; plan: MotionPlan; authoring?: SceneAuthoringDraft; liveBuild: { buildId: string }; videoUrl?: string; exportError?: string };
type AuthoringSnapshot = { plan: MotionPlan; authoring?: SceneAuthoringDraft; pinned: string[] };
export class LiveSceneClient {
    private state: LiveSceneState = { phase: 'idle', message: '', pinned: [], continuationsLeft: 15, segment: 1 };
    private listeners = new Set<() => void>();
    private resolve?: (value: any) => void;
    private reject?: (error: Error) => void;
    private pending?: Promise<any>;
    private controller?: AbortController;
    private lifecycle = 0;
    private connection = 0;
    private sequence = 0;
    private commitSequence = 0;
    private pauseRequested = false;
    private stopped = false;
    private route = '';
    private history: AuthoringSnapshot[] = [];
    private redoHistory: AuthoringSnapshot[] = [];
    onLocalEdit?: (draft: SceneAuthoringDraft) => void;
    private segmentBase?: MotionPlan;
    private segmentAuthoring?: SceneAuthoringDraft;
    private pausePending?: Promise<void>;
    private checkpointPending?: Promise<unknown>;
    private stopPending?: Promise<void>;
    private stopKeepsDraft = true;
    private stopControlPending?: Promise<any>;
    private exportController?: AbortController;
    private notifyAttached?: () => void;
    private resumeAttaching?: Promise<boolean>;
    private startedAt = 0;
    private firstCommit = false;
    exportLogs = exportLiveSceneLogs;
    onResponse?: (response: Response) => void;
    onResume?: () => void;
    /** Native editor owns recording/upload and source-specific persistence. No model finalization. */
    onExportDraft?: (draft: LiveDraftResult, signal: AbortSignal, progress: (message: string) => void) => Promise<string>;
    canExportDraft = () => Boolean(this.onExportDraft && (this.state.kind === 'motion'
        || this.state.kind === 'spatial' && ['action', 'action-correction'].includes(this.state.operation || '')));
    canResume?: () => boolean;
    capture?: () => string | undefined;
    captureCheckpoint?: (plan: MotionPlan) => string | undefined;
    private viewportOwners: Array<{ expanded?: boolean; capture: () => string | undefined; captureCheckpoint: (plan: MotionPlan) => string | undefined }> = [];
    registerViewportOwner(owner: { expanded?: boolean; capture: () => string | undefined; captureCheckpoint: (plan: MotionPlan) => string | undefined }) {
        this.viewportOwners = [...this.viewportOwners.filter(item => item !== owner), owner];
        this.capture = owner.capture;
        this.captureCheckpoint = owner.captureCheckpoint;
        return () => {
            this.viewportOwners = this.viewportOwners.filter(item => item !== owner);
            const active = [...this.viewportOwners].reverse().find(item => item.expanded) || this.viewportOwners[this.viewportOwners.length - 1];
            if (active) {
                this.capture = active.capture;
                this.captureCheckpoint = active.captureCheckpoint;
            } else {
                if (this.capture === owner.capture) this.capture = undefined;
                if (this.captureCheckpoint === owner.captureCheckpoint) this.captureCheckpoint = undefined;
            }
        };
    }
    private captureFromActiveViewport(): string | undefined {
        const ordered = [...this.viewportOwners].sort((a, b) => Number(Boolean(b.expanded)) - Number(Boolean(a.expanded)));
        for (const owner of ordered) {
            const shot = owner.capture?.();
            if (shot) return shot;
        }
        return this.capture?.();
    }
    private captureCheckpointFromActiveViewport(plan: MotionPlan): string | undefined {
        const ordered = [...this.viewportOwners].sort((a, b) => Number(Boolean(b.expanded)) - Number(Boolean(a.expanded)));
        for (const owner of ordered) {
            const shot = owner.captureCheckpoint?.(plan);
            if (shot) return shot;
        }
        return this.captureCheckpoint?.(plan);
    }
    private renderedCheckpoint?: string;
    private acknowledgedCheckpoints = new Set<string>();
    constructor(readonly api: string, readonly targetKey: string) {}
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    snapshot = () => this.state;
    private update(patch: Partial<LiveSceneState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
    private deferred() {
        if (!this.pending) { this.pending = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); this.pending.catch(() => {}); }
        return this.pending;
    }
    private async waitForResult(result: Promise<any>, signal?: AbortSignal) {
        if (this.pending === result) this.notifyAttached?.();
        const cancel = () => this.detach();
        signal?.addEventListener('abort', cancel, { once: true });
        try { return await result; } finally { signal?.removeEventListener('abort', cancel); }
    }
    async run(route: string, body: any, signal?: AbortSignal): Promise<any> {
        if (signal?.aborted) throw Object.assign(new Error('The source changed before the scene request started.'), { name: 'AbortError' });
        if (this.state.phase !== 'idle' && this.state.buildId) return this.waitForResult(this.deferred(), signal);
        this.lifecycle++;
        this.startedAt = Date.now(); this.firstCommit = false;
        this.acknowledgedCheckpoints.clear();
        liveSceneLog('request-start', { route, tier: body.llmTier, operation: body.operation, duration: body.duration, resume: Boolean(body.continueBuildId) });
        this.controller?.abort(); this.exportController?.abort();
        this.pausePending = undefined; this.checkpointPending = undefined;
        this.route = route; this.stopped = false; this.pauseRequested = false; this.sequence = 0; this.commitSequence = 0; this.history = []; this.redoHistory = [];
        this.pending = undefined;
        const result = this.deferred();
        this.receipt = this.receiptKey(route, body);
        if (!body.liveNewBuild) {
            let recovery: string | null = null;
            try { recovery = sessionStorage.getItem(this.receiptKey(route, body)); } catch { /* storage may be unavailable */ }
            if (recovery) { this.route = route; this.update({ buildId: recovery, phase: 'paused', message: 'Recovering retained scene…' }); void this.reconnect(); return this.waitForResult(result, signal); }
        }
        this.segmentBase = body.previousPlan || body.existingPlan || body.world?.plan || createLiveWorkspacePlan(body.duration || 5);
        this.update({ phase: 'streaming', tier: body.llmTier, kind: route.includes('spatial-world') ? 'spatial' : 'motion', operation: body.operation, resumeBody: { ...body }, local: false, canUndo: false, canRedo: false, stopping: false, exporting: false, exportedVideoUrl: undefined, plan: this.segmentBase || createLiveWorkspacePlan(body.duration || 5), authoring: body.authoringContext?.schema === 'clikb.scene-authoring.v1' ? body.authoringContext : undefined, buildId: undefined, message: 'AI is working…', error: undefined, notice: undefined, pinned: [], segment: 1, continuationsLeft: 15 });
        this.segmentAuthoring = this.state.authoring;
        void this.pump(`${this.api}${route}`, { ...body, live: true, liveTargetKey: this.targetKey }).catch(error => this.fail(error));
        return this.waitForResult(result, signal);
    }
    private fail(error: any) {
        if (error?.name === 'AbortError') return;
        if (error?.status === 404) { this.acknowledge(); this.update({ buildId: undefined }); }
        liveSceneLog('request-error', { buildId: this.state.buildId, status: error?.status, error: error?.message, elapsedMs: Date.now() - this.startedAt });
        this.update({ phase: this.state.buildId ? 'paused' : 'idle', error: error.message, message: this.state.buildId ? 'Scene retained' : 'Build failed before a draft was received' });
        if (!this.state.buildId) { this.reject?.(error); this.pending = undefined; }
    }
    private async pump(url: string, body?: any) {
        const lifecycle = this.lifecycle, connection = ++this.connection;
        this.controller?.abort();
        const controller = new AbortController(); this.controller = controller;
        const current = () => lifecycle === this.lifecycle && connection === this.connection && !this.stopped;
        try {
        const response = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
        if (!current()) { await response.body?.cancel(); return; }
        this.onResponse?.(response);
        liveSceneLog('response', { buildId: this.state.buildId, status: response.status, elapsedMs: Date.now() - this.startedAt });
        if (!response.ok) { const data = await response.json().catch(() => ({})); liveSceneLog('server-rejection', { status: response.status, code: data.code, stage: data.stage, error: data.message }); throw Object.assign(new Error(data.message || `Scene request failed (${response.status}).`), { status: response.status }); }
        const reader = response.body?.getReader(); if (!reader) throw new Error('This browser cannot read the live scene response.');
        const decoder = new TextDecoder(); let buffer = '';
        const consume = (text: string) => { if (!current() || !text.trim()) return; this.event(JSON.parse(text)); };
        try {
            while (true) { const { done, value } = await reader.read(); if (!current()) { await reader.cancel(); return; } buffer += decoder.decode(value, { stream: !done }); let newline: number; while ((newline = buffer.indexOf('\n')) >= 0) { consume(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1); } if (done) { consume(buffer); break; } }
        } finally { reader.releaseLock(); }
        if (current() && this.state.phase === 'streaming') {
            liveSceneLog('stream-ended-early', { buildId: this.state.buildId, elapsedMs: Date.now() - this.startedAt, receivedDraft: this.firstCommit });
            this.update({ phase: 'paused', message: 'Connection interrupted · draft retained', error: 'Reconnect to recover this build without another AI request.' });
        }
        } catch (error) { if (current()) throw error; }
    }
    private event(event: any) {
        if (this.stopped) return;
        if (event.type === 'ping') { liveSceneLog('transport-ping', { buildId: event.buildId, elapsedMs: Date.now() - this.startedAt }); return; }
        if (event.buildId && this.state.buildId && this.state.buildId !== event.buildId) return;
        if (event.seq !== undefined && event.seq < this.sequence && event.type !== 'snapshot') return;
        this.sequence = Math.max(this.sequence, event.seq || 0);
        if (event.type !== 'commit') liveSceneLog('server-' + event.type, { buildId: event.buildId,
            stage: event.stage || event.phase, code: event.code, reason: event.reason,
            status: event.status, provider: event.provider, model: event.model,
            message: event.message || event.error, verified: event.verified,
            timingTotalMs: event.timing?.totalMs,
            timingProfileMs: event.timing?.profileMs,
            timingLeaseMs: event.timing?.leaseMs,
            timingBillingMs: event.timing?.billingMs,
            continuationsLeft: event.continuationsLeft,
            segment: event.segment,
            failureName: event.providerFailure?.name, failureCode: event.providerFailure?.code,
            causeNames: event.providerFailure?.causes?.map((cause: { name?: string }) => cause.name || '').filter(Boolean).join('/'),
            causeCodes: event.providerFailure?.causes?.map((cause: { code?: string }) => cause.code || '').filter(Boolean).join('/'),
            elapsedMs: Date.now() - this.startedAt });
        if (event.type === 'security' && event.verified && Number.isFinite(event.pixels)) {
            this.onResponse?.(new Response(null, { headers: { 'x-clikb-pixels-balance': String(event.pixels) } }));
        }
        if (event.type === 'metered-billing') {
            if (Number.isFinite(event.pixels)) {
                this.onResponse?.(new Response(null, { headers: { 'x-clikb-pixels-balance': String(event.pixels) } }));
            }
            const pixelsCharged = Math.round(Number(event.pixelsCharged) || 0);
            if (pixelsCharged > 0) {
                this.update({
                    lastMeteredBilling: {
                        id: `${event.buildId || this.state.buildId || ''}:${event.seq || Date.now()}:${pixelsCharged}`,
                        pixelsCharged,
                        settledWholePixels: Math.round(Number(event.settledWholePixels || pixelsCharged)),
                        pixels: Number.isFinite(event.pixels) ? Number(event.pixels) : undefined,
                        at: Date.now(),
                    },
                });
            }
        }
        if (event.buildId) this.update({ buildId: event.buildId });
        if (event.type === 'started') { this.update({ price: event.price, operation: event.operation || this.state.operation, tier: event.tier || this.state.tier, plan: event.basePlan || this.state.plan, authoring: event.authoring || this.state.authoring, message: 'AI is building…' }); try { if (this.receipt) sessionStorage.setItem(this.receipt, event.buildId); } catch { /* checkpoint remains server-owned */ } if (this.pauseRequested) void this.pause(); }
        if (event.type === 'status') this.update({ message: event.message });
        if (event.type === 'render-checkpoint') {
            this.commitSequence = event.commitSeq;
            this.update({ plan: event.plan || this.state.plan, authoring: event.authoring || this.state.authoring, message: event.message });
            void this.returnRenderedCheckpoint(event.checkpointId, event.commitSeq);
        }
        if (event.type === 'render-feedback') this.update({ message: event.message });
        if (event.type === 'notice' || event.notice) this.update({ notice: event.message || event.notice });
        if (event.type === 'continued') this.update({ plan: event.plan || this.state.plan, authoring: event.authoring || this.state.authoring, phase: 'streaming', segment: event.segment, continuationsLeft: event.continuationsLeft, error: undefined });
        if (event.type === 'commit' && !this.pauseRequested && event.sequence > this.commitSequence) {
            const plan = applyLiveOps(this.state.plan, event.ops);
            const authoring = event.authoring || (plan
                ? adoptMotionGuideState(plan, this.targetKey, this.state.authoring, undefined, this.state.pinned, true, true) : this.state.authoring);
            const visible = hasVisibleSceneGeometry(authoring?.plan || plan);
            if (!this.firstCommit && visible) { this.firstCommit = true; liveSceneLog('first-visible-output', { buildId: event.buildId, elapsedMs: Date.now() - this.startedAt }); }
            this.commitSequence = event.sequence; this.update({ plan: authoring?.plan || plan, authoring, message: visible ? 'AI is building…' : 'AI is writing scene data…' });
        }
        if (event.type === 'snapshot') {
            this.sequence = event.seq || 0;
            this.commitSequence = event.commitSeq || 0;
            if (event.kind) this.route = event.kind === 'motion' ? '/motion-guide/build' : '/spatial-world/plan';
            this.update({ plan: event.plan || this.state.plan, authoring: event.authoring || this.state.authoring, tier: event.tier || this.state.tier, kind: event.kind || this.state.kind, operation: event.operation || this.state.operation, resumeBody: event.resumeBody || this.state.resumeBody, pinned: event.pinned || [], phase: event.status === 'streaming' || event.status === 'finalizing' ? 'streaming' : 'paused', continuationsLeft: event.continuationsLeft, error: event.error, message: 'Recovered scene' });
            if (event.final) this.finish(event.final);
            else if (event.renderCheckpoint) void this.returnRenderedCheckpoint(event.renderCheckpoint.id, event.renderCheckpoint.commitSeq);
            else if (event.status === 'discarded') { this.acknowledge(); this.stopped = true; this.reject?.(new Error('This AI build was discarded. The original scene is unchanged.')); this.pending = undefined; this.update({ phase: 'idle', buildId: undefined, plan: undefined, pausing: false }); }
        }
        if (event.type === 'paused') { this.pauseRequested = false; this.segmentEnded(); this.update({ phase: 'paused', pausing: false, plan: event.plan || this.state.plan, authoring: event.authoring || this.state.authoring, error: event.error, message: event.reason === 'stop' ? 'Stopped · draft kept' : 'Paused', continuationsLeft: event.continuationsLeft }); }
        if (event.type === 'error') this.update({ error: event.message });
        if (event.type === 'final') this.finish(event.result);
    }
    private finish(result: any) { this.pauseRequested = false; this.resolve?.(result); this.pending = undefined; this.resolve = undefined; this.reject = undefined; this.update({ phase: 'idle', plan: result.plan || result.world?.plan || result.animatic?.plan || this.state.plan, authoring: result.authoring || result.world?.authoring || result.animatic?.authoring || this.state.authoring, pausing: false, message: 'Scene ready', error: undefined }); }
    private async returnRenderedCheckpoint(id: string, commitSeq: number) {
        if (this.acknowledgedCheckpoints.has(id) || this.renderedCheckpoint === id || this.pauseRequested || this.state.phase !== 'streaming') return;
        this.renderedCheckpoint = id;
        const lifecycle = this.lifecycle, buildId = this.state.buildId;
        try {
            // Let React mount/update the real viewport before asking it to draw
            // the exact accepted plan. A heartbeat cannot acknowledge a render.
            // Browsers suspend animation frames in background tabs; capture
            // renders directly, so a timer fallback avoids a false 30s pause.
            await new Promise<void>(resolve => {
                const timer = setTimeout(resolve, 250);
                requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
            });
            if (lifecycle !== this.lifecycle || this.pauseRequested || this.state.phase !== 'streaming') return;
            let image = this.state.plan && this.captureCheckpointFromActiveViewport(this.state.plan);
            for (let retry = 0; !image && retry < 5; retry++) {
                await new Promise<void>(resolve => setTimeout(resolve, 180));
                if (lifecycle !== this.lifecycle || this.pauseRequested || this.state.phase !== 'streaming') return;
                image = this.state.plan && this.captureCheckpointFromActiveViewport(this.state.plan);
            }
            if (!image) throw new Error('The viewport could not capture this scene. The build has paused at its checkpoint.');
            await this.control('render-feedback', { checkpointId: id, commitSeq, viewportSnapshot: image });
            this.acknowledgedCheckpoints.add(id);
            liveSceneLog('render-checkpoint-sent', { buildId, commitSeq });
        } catch (error) {
            if (lifecycle !== this.lifecycle || this.pauseRequested) return;
            liveSceneLog('render-checkpoint-error', { buildId, error: (error as Error).message });
            await this.pause();
            this.update({ error: (error as Error).message });
        } finally { if (this.renderedCheckpoint === id) this.renderedCheckpoint = undefined; }
    }
    private receipt?: string;
    private receiptKey(route: string, body: any) {
        const source = JSON.stringify([route, body.operation, body.prompt, body.firstFrameUrl || body.image, body.duration, body.editInstruction, body.correction, body.world?.revision]);
        let hash = 2166136261; for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        return `clikb.liveReceipt:${this.api}:${this.targetKey}:${hash >>> 0}`;
    }
    acknowledge() { try { if (this.receipt) sessionStorage.removeItem(this.receipt); } catch { /* ignore */ } }
    private segmentEnded() {
        if (this.segmentBase) this.history.push({ plan: this.segmentBase, authoring: this.segmentAuthoring, pinned: [...this.state.pinned] });
        this.segmentBase = undefined; this.segmentAuthoring = undefined;
        this.history = this.history.slice(-30); this.redoHistory = [];
        this.update({ canUndo: this.history.length > 0, canRedo: false });
    }
    private async control(action: string, extra: any = {}) {
        liveSceneLog('control-request', { action, buildId: this.state.buildId, phase: this.state.phase });
        const lifecycle = this.lifecycle, buildId = this.state.buildId;
        const response = await fetch(`${this.api}/scene-live/${action}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buildId, ...extra }) });
        if (lifecycle !== this.lifecycle || buildId !== this.state.buildId) throw Object.assign(new Error('This build no longer owns the editor.'), { name: 'AbortError' });
        const data = await response.json();
        if (lifecycle !== this.lifecycle || buildId !== this.state.buildId) throw Object.assign(new Error('This build no longer owns the editor.'), { name: 'AbortError' });
        liveSceneLog('control-response', { action, buildId, status: response.status });
        if (!response.ok) throw new Error(data.message || 'Could not update this build.'); return data;
    }
    async pause() {
        if (this.pausePending) return this.pausePending;
        if (this.state.phase === 'idle') return;
        const lifecycle = this.lifecycle;
        this.pauseRequested = true;
        this.update({ pausing: true, message: 'Pausing AI…' });
        if (!this.state.buildId) return;
        this.pausePending = (async () => {
            try { const data = await this.control('pause', { viewportSnapshot: this.captureFromActiveViewport() }); this.event({ ...data, type: data.status === 'paused' ? 'paused' : 'snapshot' }); }
            catch (error) { this.fail(error); }
            finally { if (lifecycle === this.lifecycle) { this.update({ pausing: false }); this.pausePending = undefined; } }
        })();
        return this.pausePending;
    }
    async continue(guidance = '') {
        if (this.resumeAttaching || this.stopPending || this.state.exporting) return;
        const lifecycle = this.lifecycle;
        if (this.pausePending) await this.pausePending;
        if (this.checkpointPending) await this.checkpointPending;
        if (!this.state.buildId || !this.state.plan) return;
        if (this.state.phase === 'streaming') await this.pause();
        if (lifecycle !== this.lifecycle || this.state.phase !== 'paused') return;
        if (this.canResume && !this.canResume()) { this.update({ error: 'This source has changed. The retained draft will not modify the new scene.' }); return; }
        if (!this.pending) {
            if (!this.onResume) { this.update({ error: 'Reopen this retained build in its editor before continuing.' }); return; }
            this.deferred();
            let attached!: (value: boolean) => void;
            this.resumeAttaching = new Promise(resolve => { attached = resolve; });
            this.notifyAttached = () => attached(true);
            const timeout = setTimeout(() => attached(false), 5000);
            try { this.onResume(); } catch { attached(false); }
            const ready = await this.resumeAttaching;
            clearTimeout(timeout); this.notifyAttached = undefined; this.resumeAttaching = undefined;
            if (lifecycle !== this.lifecycle) return;
            if (!ready) {
                const error = new Error('The editor could not resume this draft. Check its model balance, source and export support, then try Continue again.');
                this.reject?.(error); this.pending = undefined; this.resolve = undefined; this.reject = undefined; this.update({ error: error.message }); return;
            }
        }
        this.pauseRequested = false; this.segmentBase = structuredClone(this.state.plan); this.segmentAuthoring = this.state.authoring ? structuredClone(this.state.authoring) : undefined;
        this.update({ phase: 'streaming', error: undefined, message: 'AI is continuing…' });
        void this.pump(`${this.api}${this.route}`, { live: true, llmTier: this.state.tier, continueBuildId: this.state.buildId, liveTargetKey: this.targetKey, partialPlan: this.state.plan, authoring: this.state.authoring, pinnedObjectIds: this.state.pinned, guidance, viewportSnapshot: this.captureFromActiveViewport() }).catch(error => this.fail(error));
    }
    stop(keep = true): Promise<void> {
        if (this.stopPending) {
            if (keep || !this.stopKeepsDraft) return this.stopPending;
            // Discard supersedes Stop/export, including an upload that cannot
            // itself be cancelled. Its late result must never publish again.
            this.exportController?.abort();
        }
        this.stopKeepsDraft = keep;
        const lifecycle = this.lifecycle;
        const pending = this.stopDraft(keep).finally(() => {
            if (this.stopPending === pending) {
                this.stopPending = undefined;
                if (lifecycle === this.lifecycle) this.update({ stopping: false, exporting: false });
            }
        });
        this.stopPending = pending;
        return pending;
    }
    private async stopDraft(keep: boolean) {
        const lifecycle = this.lifecycle;
        this.update({ stopping: true });
        if (this.pausePending) await this.pausePending;
        if (this.checkpointPending) await this.checkpointPending;
        if (this.state.phase === 'streaming') await this.pause();
        if (lifecycle !== this.lifecycle || this.state.phase === 'idle' || keep && !this.stopKeepsDraft) return;
        let stopRequest: Promise<any> | undefined;
        try {
            // Finish an already-sent keep request before discarding on the
            // server, but never wait for its recorder or upload to finish.
            if (!keep) await this.stopControlPending?.catch(() => {});
            if (lifecycle !== this.lifecycle || this.state.phase === 'idle') return;
            stopRequest = this.control('stop', { keep, partialPlan: this.state.plan, authoring: this.state.authoring });
            this.stopControlPending = stopRequest;
            const data = await stopRequest;
            if (lifecycle !== this.lifecycle || keep && !this.stopKeepsDraft) return;
            if (data.final) return this.finish(data.final);
            if (keep) {
                const plan = data.plan || this.state.plan;
                const result: LiveDraftResult = structuredClone({ liveDraft: true, plan, authoring: data.authoring || this.state.authoring, liveBuild: { buildId: this.state.buildId! } });
                this.update({ phase: 'paused', plan, authoring: result.authoring, message: 'Stopped · editable draft kept', error: undefined });
                if (this.canExportDraft()) {
                    const controller = new AbortController(); this.exportController = controller;
                    const current = () => lifecycle === this.lifecycle && !controller.signal.aborted;
                    try {
                        const validated = validateScenePerformance({ plan: result.plan, authoring: result.authoring });
                        if (!hasVisibleSceneGeometry(validated.plan)) throw new Error('Nothing visible has been built yet to export. The draft is kept.');
                        result.plan = validated.plan; result.authoring = validated.authoring;
                        this.update({ exporting: true, message: 'Exporting current animation…' });
                        const url = await this.onExportDraft!(result, controller.signal, message => { if (current()) this.update({ message }); });
                        if (!current()) return;
                        result.videoUrl = url;
                        this.update({ exportedVideoUrl: url, message: 'Video exported · AI draft retained' });
                    } catch (error) {
                        if (!current()) return;
                        result.exportError = (error as Error).message || 'Video export failed. The draft is kept; use Stop to retry.';
                        this.update({ error: result.exportError, message: 'Export failed · draft retained' });
                    } finally { if (this.exportController === controller) this.exportController = undefined; }
                }
                if (lifecycle !== this.lifecycle) return;
                this.resolve?.(result);
                this.pending = undefined; this.resolve = undefined; this.reject = undefined;
            }
            else { this.acknowledge(); this.stopped = true; this.reject?.(new Error('AI build discarded. The original scene is unchanged.')); this.pending = undefined; this.update({ phase: 'idle', plan: undefined, buildId: undefined, message: '' }); }
        } catch (error) {
            if (lifecycle === this.lifecycle && (!keep || this.stopKeepsDraft)) this.fail(error);
        } finally {
            if (stopRequest && this.stopControlPending === stopRequest) this.stopControlPending = undefined;
        }
    }
    loadLocalDraft(draft: SceneAuthoringDraft) {
        if (!this.state.local || this.state.authoring?.sourceKey !== draft.sourceKey || this.state.authoring?.draftId !== draft.draftId) { this.history = []; this.redoHistory = []; this.update({ pinned: [], canUndo: false, canRedo: false }); }
        this.update({ phase: 'paused', local: true, buildId: undefined, kind: 'motion', plan: draft.plan, authoring: draft, message: '3D workspace · drag to orbit, scroll to zoom' });
    }
    private remember() {
        if (this.state.plan) this.history = [...this.history.slice(-29), { plan: this.state.plan, authoring: this.state.authoring, pinned: [...this.state.pinned] }];
        this.redoHistory = [];
    }
    private saveCorrection(plan: MotionPlan, authoring: SceneAuthoringDraft | undefined, pinned: string[]) {
        this.update({ plan, authoring, pinned, canUndo: this.history.length > 0, canRedo: this.redoHistory.length > 0 });
        if (this.state.local) { if (authoring) this.onLocalEdit?.(authoring); return; }
        const previous = this.checkpointPending || Promise.resolve();
        this.checkpointPending = previous.catch(() => {}).then(() => this.control('pause', { checkpointOnly: true, commitSeq: this.commitSequence, partialPlan: plan, authoring, pinnedObjectIds: pinned, viewportSnapshot: this.captureFromActiveViewport() })).catch(error => this.fail(error));
    }
    applyCommands(commands: AuthoringCommand[]) {
        if (this.state.phase !== 'paused' || !this.state.plan || this.state.stopping || this.state.exporting) return;
        const base = this.state.authoring || createAuthoringDraft(this.state.plan, this.targetKey, bindWorldRigs(this.state.plan));
        const anchors: AuthoringCommand[] = [];        for (const command of commands) if (command.kind === 'pose' && !command.target.partId) {            const object = base.plan.objects.find(item => item.id === command.target.objectId)!;            for (const event of base.events.filter(event => event.objectId === object.id && event.time < command.time)) {                const time = event.kind === 'detach' && event.landing && event.landing.time < command.time ? event.landing.time : event.time;                anchors.push({ kind: 'pose', target: command.target, time, pose: samplePose(object, time) });            }        }        const next = applyAuthoringCommands(base, base.revision, [...anchors, ...commands]);
        this.remember();
        const deleted = commands.filter((command): command is Extract<AuthoringCommand, { kind: 'remove' }> => command.kind === 'remove').map(command => command.target.objectId);
        this.saveCorrection(next.plan, next, [...new Set([...this.state.pinned, ...deleted, ...base.plan.objects.filter(object => !next.plan.objects.some(next => next.id === object.id)).map(object => object.id)])]);
    }
    edit(plan: MotionPlan, pinned = this.state.pinned) {
        if (this.state.phase !== 'paused' || this.state.stopping || this.state.exporting) return;
        const authoring = adoptMotionGuideState(plan, this.targetKey, this.state.authoring, undefined, pinned);
        this.remember(); this.saveCorrection(authoring.plan, authoring, pinned);
    }
    togglePin(objectId: string) {
        if (this.state.phase !== 'paused' || !this.state.plan || this.state.stopping || this.state.exporting) return;
        this.remember();
        const pinned = this.state.pinned.includes(objectId) ? this.state.pinned.filter(id => id !== objectId) : [...this.state.pinned, objectId];
        let authoring = this.state.authoring;
        if (authoring) {
            const object = this.state.plan.objects.find(item => item.id === objectId);
            const controls = [JSON.stringify([objectId, '']), ...(object?.parts || []).map(part => JSON.stringify([objectId, part.id]))];
            authoring = { ...authoring, revision: authoring.revision + 1, manualControls: pinned.includes(objectId) ? [...new Set([...authoring.manualControls, ...controls])] : authoring.manualControls.filter(key => !controls.includes(key)) };
        }
        this.saveCorrection(this.state.plan, authoring, pinned);
    }
    undo() { this.restoreHistory(this.history, this.redoHistory); }
    redo() { this.restoreHistory(this.redoHistory, this.history); }
    private restoreHistory(from: AuthoringSnapshot[], to: AuthoringSnapshot[]) {
        if (this.state.phase !== 'paused' || !this.state.plan || this.state.stopping || this.state.exporting) return;
        const entry = from.pop(); if (!entry) return;
        to.push({ plan: this.state.plan, authoring: this.state.authoring, pinned: [...this.state.pinned] });
        const authoring = entry.authoring ? { ...structuredClone(entry.authoring), revision: Math.max(entry.authoring.revision, this.state.authoring?.revision || 0) + 1 } : undefined;
        this.saveCorrection(entry.plan, authoring, entry.pinned);
    }
    async reconnect() {
        if (!this.state.buildId) return;
        void this.pump(`${this.api}/scene-live/events?buildId=${encodeURIComponent(this.state.buildId)}&after=${this.sequence}`).catch(error => this.fail(error));
    }
    async recover(route: string) {
        if (this.state.phase !== 'idle') return;
        const lifecycle = this.lifecycle;
        this.route = route;
        try { const response = await fetch(`${this.api}/scene-live/recent?targetKey=${encodeURIComponent(this.targetKey)}`, { credentials: 'include' }); if (!response.ok) return; const data = await response.json(); if (lifecycle !== this.lifecycle || this.state.phase !== 'idle' || this.canResume && !this.canResume()) return; const build = data.builds?.[0]; if (build) { this.update({ buildId: build.buildId, phase: 'paused', message: 'Recovering scene…' }); await this.reconnect(); } } catch { /* a new build still remains available */ }
    }
    detach() { if (this.state.phase !== 'idle' && this.state.phase !== 'paused') void this.pause(); this.lifecycle++; this.connection++; this.controller?.abort(); this.exportController?.abort(); this.stopPending = undefined; this.stopControlPending = undefined; this.stopped = true; this.reject?.(new Error('The source changed. The accepted scene is retained.')); this.pending = undefined; this.resolve = undefined; this.reject = undefined; this.pausePending = undefined; this.checkpointPending = undefined; this.update({ phase: 'idle', pausing: false, stopping: false, exporting: false }); }
}
