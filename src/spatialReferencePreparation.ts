import { worldControlAtPlan, type SpatialAnimatic, type SpatialWorld } from '../server/src/spatialWorld';
import { motionEvidencePlanText } from '../server/src/spatialMotionEvidence';
import type { SpatialSceneState } from './spatialStageModel';
import { explicitSpatialClipPrompt } from '../server/src/spatialClipPrompt';

export type SpatialReferenceWork = {
    routeId: string; direction: 'forward' | 'backward'; worldRevision: string;
    aspect: NonNullable<SpatialWorld['aspectRatio']>; controlledObject: string; action: boolean; animation: SpatialAnimatic;
    planKey?: string; videoFile?: File; signal: AbortSignal;
};
type Adapter = {
    read: () => SpatialSceneState | undefined;
    prepare: (work: SpatialReferenceWork, progress: (message: string) => void) => Promise<void>;
    persist: (work: SpatialReferenceWork) => Promise<unknown>;
};
type Task = { key: string; work: SpatialReferenceWork; controller: AbortController; state: 'queued' | 'running' | 'ready' | 'failed'; promise?: Promise<void>; error?: unknown; needsPersist?: boolean };
const complete = (animation: SpatialAnimatic, action: boolean) => Boolean(animation.referenceVideo && animation.startAnchor && animation.endAnchor
    && (action || animation.motionEvidence?.frames.length === 5 && animation.motionEvidence.diagram && (animation.guidance || explicitSpatialClipPrompt(animation))));
const fingerprint = (scene: SpatialSceneState, routeId: string, direction: 'forward' | 'backward') => {
    const ledger = scene.ledger, animation = ledger?.routes[routeId]?.[direction];
    const edge = scene.connections.find(item => item.id === routeId);
    if (!ledger || !animation || !edge || ledger.jobs.some(job => job.id === `${routeId}:${direction}`)) return undefined;
    const aspect = ledger.world.aspectRatio || '16:9';
    return JSON.stringify([ledger.world.revision, routeId, direction, animation.id, edge.kind, motionEvidencePlanText(animation.plan, aspect, animation.authoring)]);
};

/** One persistent queue per stage. Closing/reopening the editor cannot duplicate an export. */
export class SpatialReferencePreparation {
    private tasks = new Map<string, Task>();
    private tail: Promise<void> = Promise.resolve();
    private listeners = new Set<() => void>();
    private message = '';
    constructor(private adapter: Adapter) {}
    configure(adapter: Adapter) { this.adapter = adapter; }
    subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    private notify() { this.listeners.forEach(listener => listener()); }
    private current(task: Task) {
        const scene = this.adapter.read();
        return Boolean(scene && fingerprint(scene, task.work.routeId, task.work.direction) === task.key);
    }
    get status() {
        const relevant = [...this.tasks.values()].filter(task => this.current(task));
        return { pending: relevant.filter(task => task.state === 'queued' || task.state === 'running').length,
            message: this.message || `Preparing ${relevant.find(task => task.state === 'queued' || task.state === 'running')?.work.action ? 'action' : 'motion'} assets…`, error: relevant.find(task => task.state === 'failed')?.error };
    }
    start(routeId?: string, retry = false): Promise<void> {
        for (const task of this.tasks.values()) if (!this.current(task)) task.controller.abort();
        const scene = this.adapter.read(), waiting: Promise<void>[] = [];
        if (!scene?.ledger) return Promise.resolve();
        for (const edge of scene.connections) {
            if (routeId && edge.id !== routeId) continue;
            for (const direction of ['forward', 'backward'] as const) {
                const key = fingerprint(scene, edge.id, direction), animation = scene.ledger.routes[edge.id]?.[direction];
                if (!key || !animation) continue;
                let task = this.tasks.get(key);
                // Legacy saved assets belong to their immutable mapped animation.
                // New exports carry a plan hash, checked even when their files exist.
                if (!task && !animation.authoring && complete(animation, edge.kind === 'action') && !animation.referencePlanKey) continue;
                if (!task) {
                    const controller = new AbortController();
                    task = { key, controller, state: 'queued', work: { routeId: edge.id, direction, worldRevision: scene.ledger.world.revision,
                        aspect: scene.ledger.world.aspectRatio || '16:9', controlledObject: worldControlAtPlan(scene.ledger.world, animation.plan),
                        action: edge.kind === 'action', animation: structuredClone(animation), signal: controller.signal } };
                    this.tasks.set(key, task);
                }
                if (!task.promise || retry && task.state === 'failed') this.run(task);
                waiting.push(task.promise!);
            }
        }
        this.notify();
        return Promise.all(waiting).then(() => undefined);
    }
    private run(task: Task) {
        task.state = 'queued'; task.error = undefined;
        task.promise = this.tail.then(async () => {
            if (!this.current(task)) return;
            task.state = 'running'; this.message = `Preparing ${task.work.action ? 'action' : 'motion'} assets…`; this.notify();
            const work = task.work;
            const saved = this.adapter.read()?.ledger?.routes[work.routeId]?.[work.direction];
            if ((work.direction === 'backward' && saved?.startAnchor) || !work.animation.startAnchor) work.animation.startAnchor = saved?.startAnchor;
            if (!work.animation.endAnchor) work.animation.endAnchor = saved?.endAnchor;
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(motionEvidencePlanText(work.animation.plan, work.aspect, work.animation.authoring)));
            work.planKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
            if ((work.animation.referencePlanKey || work.animation.authoring) && work.animation.referencePlanKey !== work.planKey) {
                delete work.animation.referenceVideo; delete work.animation.endAnchor; delete work.animation.motionEvidence; delete work.animation.guidance; delete work.videoFile;
                task.needsPersist = true;
            }
            work.animation.referencePlanKey = work.planKey;
            if (!complete(work.animation, work.action)) {
                task.needsPersist = true;
                await this.adapter.prepare(work, message => { if (this.current(task)) { this.message = message; this.notify(); } });
            }
            if (task.needsPersist && this.current(task) && !work.signal.aborted) { await this.adapter.persist(work); task.needsPersist = false; }
        }).then(() => { task.state = 'ready'; }, error => {
            if (this.current(task) && !task.controller.signal.aborted) { task.state = 'failed'; task.error = error; throw error; }
            task.state = 'ready';
        }).finally(() => this.notify());
        // A background failure is retained for explicit Finish/retry; no automatic upload loop.
        this.tail = task.promise.catch(() => {});
    }
}
const queues = new WeakMap<object, SpatialReferencePreparation>();
export function spatialReferencePreparation(owner: object, adapter: Adapter) {
    let queue = queues.get(owner);
    if (!queue) { queue = new SpatialReferencePreparation(adapter); queues.set(owner, queue); }
    else queue.configure(adapter);
    return queue;
}
