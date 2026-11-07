import { validateMotionPlan, type MotionObject, type MotionPlan } from './motionGuidePlan';
import { expandSceneObject } from './sceneRecipes';
import { preserveProtectedScenePlan, protectedSceneFrames } from './scenePlanProtection';

/**
 * Live Three.js construction while the model is still writing.
 *
 * The provider streams ordinary JSON text (the same scene format the
 * non-live routes already validate). `StreamingJsonWatcher` follows that text
 * character by character and reports each value as soon as it closes, so a
 * complete scene object (or a complete articulated part inside an object that
 * is still being written) can be validated and shown immediately, long before
 * the closing brace of the whole response. Nothing here executes model output;
 * every accepted object passes `validateMotionPlan` in the context of the
 * scene accepted so far.
 */

export type JsonPath = Array<string | number>;

type Frame = {
    type: 'object' | 'array';
    path: JsonPath;
    collect: boolean;
    members: Record<string, unknown> | unknown[];
    /** object: current key; array: next index */
    key?: string;
    index: number;
    expectingKey: boolean;
};

export type WatchEvent = { path: JsonPath; value: unknown; parentMembers?: Record<string, unknown> | unknown[] };

/**
 * Incremental JSON scanner. `collect(path)` decides which containers keep a
 * parsed copy of their completed members (used to assemble partial objects).
 * `onValue` fires for every completed value whose path `watch(path)` accepts.
 */
export class StreamingJsonWatcher {
    private text = '';
    private pos = 0;
    private stack: Frame[] = [];
    private started = false;
    private finishedRoot = false;
    private inString = false;
    private escaped = false;
    private stringIsKey = false;
    private stringStart = -1;
    private primitiveStart = -1;
    rootValue: unknown;

    constructor(
        private readonly watch: (path: JsonPath) => boolean,
        private readonly collect: (path: JsonPath) => boolean,
        private readonly onValue: (event: WatchEvent) => void,
    ) {}

    get complete() { return this.finishedRoot; }
    get fullText() { return this.text; }

    push(chunk: string) {
        if (!chunk) return;
        this.text += chunk;
        const text = this.text;
        for (; this.pos < text.length; this.pos++) {
            if (this.finishedRoot) return;
            const ch = text[this.pos];
            if (!this.started) {
                // Tolerate a code fence or a short preamble before the JSON body.
                if (ch === '{') { this.started = true; this.openContainer('object', this.pos); }
                continue;
            }
            if (this.inString) {
                if (this.escaped) this.escaped = false;
                else if (ch === '\\') this.escaped = true;
                else if (ch === '"') {
                    this.inString = false;
                    const raw = text.slice(this.stringStart, this.pos + 1);
                    if (this.stringIsKey) {
                        const top = this.stack[this.stack.length - 1];
                        try { top.key = JSON.parse(raw); } catch { top.key = raw.slice(1, -1); }
                        top.expectingKey = false;
                    } else this.completeValue(this.stringStart, this.pos + 1);
                }
                continue;
            }
            if (this.primitiveStart >= 0) {
                if (/[\s,\]}]/.test(ch)) {
                    this.completeValue(this.primitiveStart, this.pos);
                    this.primitiveStart = -1;
                } else continue;
            }
            const top = this.stack[this.stack.length - 1];
            if (!top) return;
            if (/\s/.test(ch) || ch === ':') continue;
            if (ch === ',') { if (top.type === 'object') top.expectingKey = true; continue; }
            if (ch === '"') {
                this.inString = true; this.escaped = false; this.stringStart = this.pos;
                this.stringIsKey = top.type === 'object' && top.expectingKey;
                continue;
            }
            if (ch === '{' || ch === '[') { this.openContainer(ch === '{' ? 'object' : 'array', this.pos); continue; }
            if (ch === '}' || ch === ']') { this.closeContainer(); continue; }
            // number / true / false / null
            this.primitiveStart = this.pos;
        }
    }

    private childPath(): JsonPath {
        const top = this.stack[this.stack.length - 1];
        if (!top) return [];
        return [...top.path, top.type === 'object' ? String(top.key ?? '') : top.index];
    }

    private openContainer(type: 'object' | 'array', start: number) {
        const path = this.childPath();
        const frame: Frame = { type, path, collect: this.collect(path), members: type === 'object' ? {} : [], index: 0, expectingKey: type === 'object' };
        (frame as any).start = start;
        this.stack.push(frame);
    }

    private closeContainer() {
        const frame = this.stack.pop();
        if (!frame) return;
        const start = (frame as any).start as number;
        if (!this.stack.length) {
            this.finishedRoot = true;
            try { this.rootValue = JSON.parse(this.text.slice(start, this.pos + 1)); } catch { this.rootValue = undefined; }
            return;
        }
        this.completeValue(start, this.pos + 1, frame.path);
    }

    private completeValue(start: number, end: number, knownPath?: JsonPath) {
        const parent = this.stack[this.stack.length - 1];
        if (!parent) return;
        const path = knownPath || this.childPath();
        const wanted = this.watch(path);
        if (parent.collect || wanted) {
            let value: unknown;
            try { value = JSON.parse(this.text.slice(start, end)); } catch { value = undefined; }
            if (value !== undefined) {
                if (parent.collect) {
                    if (parent.type === 'object') (parent.members as Record<string, unknown>)[String(parent.key)] = value;
                    else (parent.members as unknown[])[parent.index] = value;
                }
                if (wanted) this.onValue({ path, value, parentMembers: parent.members });
            }
        }
        if (parent.type === 'array') parent.index++;
        else parent.expectingKey = false;
    }

    /** Completed members of the open container at `path`, if it is collected. */
    openMembers(path: JsonPath): Record<string, unknown> | unknown[] | undefined {
        const key = JSON.stringify(path);
        return this.stack.find(frame => JSON.stringify(frame.path) === key)?.members;
    }
}

export type LiveOp =
    | { op: 'duration'; value: number }
    | { op: 'background'; value: string }
    | { op: 'camera'; camera: MotionPlan['camera'] }
    | { op: 'lighting'; lighting: NonNullable<MotionPlan['lightingRig']> }
    | { op: 'upsertObject'; object: MotionObject; partial?: boolean }
    | { op: 'removeObject'; id: string };

export type LiveCommit = { sequence: number; ops: LiveOp[]; objectCount: number };

const DEFAULT_CAMERA = (duration: number): MotionPlan['camera'] => [
    { t: 0, position: [0, 2.2, 7], target: [0, .7, 0], fov: 45 },
    { t: duration, position: [0, 2.2, 7], target: [0, .7, 0], fov: 45 },
];

/** An editor placeholder, never a claim that the AI has generated geometry. */
export function createLiveWorkspacePlan(duration = 5): MotionPlan {
    return { version: 1, duration, background: '#edf5fc', camera: DEFAULT_CAMERA(duration), objects: [{ id: 'live_workspace', shape: 'anchor', color: '#ffffff', keys: [0, duration].map(t => ({ t, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) }] };
}

/** Re-time a track that was authored for another duration (edits that change length). */
function retime<T extends { t: number }>(keys: T[], duration: number): T[] {
    const end = keys[keys.length - 1]?.t || 0;
    if (!keys.length || Math.abs(end - duration) < .001) return keys;
    if (end <= 0) return [{ ...keys[0], t: 0 }, { ...keys[0], t: duration }];
    return keys.map(key => ({ ...key, t: Number((key.t / end * duration).toFixed(4)) })).map((key, i, all) => i === all.length - 1 ? { ...key, t: duration } : key);
}

function retimeObject(object: MotionObject, duration: number): MotionObject {
    return { ...object, keys: retime(object.keys, duration), ...(object.parts ? { parts: object.parts.map(part => ({ ...part, keys: retime(part.keys, duration) })) } : {}) };
}

/** A streamed construction update is sparse, never an implicit deletion of
 * previously accepted body parts. Deletion/release is explicit by stable ID. */
function mergeLiveObject(base: MotionObject | undefined, incoming: any, preserveParts: boolean, protectedControls: readonly string[] = []): any {
    if (!base) return incoming;
    const merged = { ...base, ...incoming };
    if (incoming.parts === undefined) merged.parts = base.parts;
    else if (preserveParts && Array.isArray(incoming.parts)) {
        const protectedParts = new Set<string>();
        for (const key of protectedControls) { try { const [objectId, partId] = JSON.parse(key); if (objectId === base.id && partId) protectedParts.add(partId); } catch { /* invalid controls are rejected at the authoring boundary */ } }
        for (let pass = 0; pass < (base.parts?.length || 0); pass++) for (const part of base.parts || []) if (protectedParts.has(part.id) && part.parentId) protectedParts.add(part.parentId);
        const removed = new Set<string>([
            ...(Array.isArray(incoming.removedPartIds) ? incoming.removedPartIds : []),
            ...(Array.isArray(incoming.releasedPartIds) ? incoming.releasedPartIds : []),
        ].filter(id => !protectedParts.has(id)));
        for (let pass = 0; pass < (base.parts?.length || 0); pass++) for (const part of base.parts || [])
            if (part.parentId && removed.has(part.parentId)) removed.add(part.id);
        const updates = new Map<string, any>(incoming.parts.filter((part: any) => part && typeof part.id === 'string').map((part: any) => [part.id, part]));
        merged.parts = (base.parts || []).filter(part => !removed.has(part.id)).map(part => updates.has(part.id) ? { ...part, ...updates.get(part.id) } : part);
        for (const [id, part] of updates) if (!removed.has(id) && !merged.parts.some((old: any) => old.id === id)) merged.parts.push(part);
    }
    delete merged.removedPartIds; delete merged.releasedPartIds;
    if (!merged.parts?.length) delete merged.parts;
    return merged;
}

/**
 * Accepts streamed scene content into a renderable provisional plan.
 * `planPath` is where the plan lives in the model's JSON (`['plan']` for
 * Spatial, `[]` for Motion Guide). `base` is the scene the creator already
 * sees (edits) or undefined for a new build.
 */
export class LivePlanAssembler {
    readonly authoringPatch: Record<string, unknown> = {};
    private readonly protectedIds = new Set<string>();
    private plan: { version: 1; duration: number; background: string; camera: MotionPlan['camera']; objects: MotionObject[]; lightingRig?: MotionPlan['lightingRig'] };
    private readonly baseObjects: Map<string, MotionObject>;
    private readonly basePlan?: MotionPlan;
    private readonly pinned: Set<string>;
    private pendingAttachment = new Map<string, { object: MotionObject; partial: boolean }>();
    private sequence: number;
    private queued: LiveOp[] = [];
    readonly watcher: StreamingJsonWatcher;
    rejected = 0;

    constructor(private readonly planPath: JsonPath, base: MotionPlan | undefined, duration: number, private readonly options: { pinned?: string[]; startSequence?: number; deltaOnly?: boolean; protectedControls?: string[] } = {}) {
        this.baseObjects = new Map((base?.objects || []).map(object => [object.id, object]));
        this.basePlan = base;
        for (const key of options.protectedControls || []) { try { this.protectedIds.add(JSON.parse(key)[0]); } catch { /* validated at the authoring boundary */ } }
        for (let pass = 0; pass < this.baseObjects.size; pass++) for (const object of this.baseObjects.values()) if (this.protectedIds.has(object.id) && object.attachment) this.protectedIds.add(object.attachment.objectId);
        this.pinned = new Set(options.pinned || []);
        if (base) for (const key of protectedSceneFrames(base, options.protectedControls || [], options.pinned)) this.protectedIds.add(JSON.parse(key)[0]);
        this.sequence = options.startSequence || 0;
        this.plan = {
            version: 1,
            duration: base ? base.duration : duration,
            background: base?.background || '#DCE2EC',
            camera: base?.camera ? base.camera : DEFAULT_CAMERA(duration),
            objects: base ? base.objects.map(object => ({ ...object })) : [],
            lightingRig: base?.lightingRig,
        };
        const prefix = planPath.length;
        const isPlan = (path: JsonPath) => path.length === prefix && planPath.every((seg, i) => path[i] === seg);
        const under = (path: JsonPath, ...rest: Array<string | number | null>) => path.length === prefix + rest.length
            && planPath.every((seg, i) => path[i] === seg)
            && rest.every((seg, i) => seg === null ? typeof path[prefix + i] === 'number' : path[prefix + i] === seg);
        this.watcher = new StreamingJsonWatcher(
            path => path.length === 1 && ['initialState', 'performance'].includes(String(path[0])) || under(path, 'duration') || under(path, 'background') || under(path, 'camera') || under(path, 'lightingRig') || under(path, 'objects') || under(path, 'objects', null)
                || under(path, 'objects', null, 'parts', null) || under(path, 'removedObjectIds'),
            path => path.length === 0 || isPlan(path) || under(path, 'objects', null) || under(path, 'objects', null, 'parts'),
            event => {
                if (event.path.length === 1 && ['initialState', 'performance'].includes(String(event.path[0]))) this.authoringPatch[String(event.path[0])] = event.value;
                else this.consume(event.path.slice(prefix), event.value);
            },
        );
    }

    get current(): MotionPlan | undefined {
        if (!this.plan.objects.length) return undefined;
        return this.plan as MotionPlan;
    }

    get snapshot() { return { ...this.plan, objects: [...this.plan.objects] }; }
    get lastSequence() { return this.sequence; }
    private protects(id: string) { return this.protectedIds.has(id); }

    /** Feed provider text; returns a commit when something new became visible. */
    push(text: string): LiveCommit | undefined {
        this.watcher.push(text);
        return this.flush();
    }

    flush(): LiveCommit | undefined {
        if (!this.queued.length) return undefined;
        const ops = this.queued; this.queued = [];
        return { sequence: ++this.sequence, ops, objectCount: this.plan.objects.length };
    }

    private consume(rel: JsonPath, value: unknown) {
        const [head, index, sub] = rel;
        if (head === 'objects' && rel.length === 1 && !this.options.deltaOnly && Array.isArray(value)) {
            const kept = new Set(value.map(object => object?.id));
            for (const object of [...this.plan.objects]) if (!kept.has(object.id) && !this.pinned.has(object.id) && !this.protects(object.id)) {
                const remaining = this.plan.objects.filter(candidate => candidate.id !== object.id);
                if (remaining.length) try { validateMotionPlan({ ...this.plan, objects: remaining }); this.plan.objects = remaining; this.queued.push({ op: 'removeObject', id: object.id }); } catch { /* retain a still-required anchor */ }
            }
            return;
        }
        if (head === 'duration' && rel.length === 1) {
            const next = Number(value);
            if (!Number.isFinite(next) || next < 2 || next > 15 || Math.abs(next - this.plan.duration) < .001) return;
            this.plan.duration = next;
            // Keep everything already on screen renderable under the new length.
            this.plan.objects = this.plan.objects.map(object => retimeObject(object, next));
            this.plan.camera = retime(this.plan.camera, next);
            this.queued.push({ op: 'duration', value: next });
            return;
        }
        if (head === 'background' && rel.length === 1) {
            if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) { this.plan.background = value; this.queued.push({ op: 'background', value }); }
            return;
        }
        if (head === 'camera' && rel.length === 1) {
            try {
                const probe = validateMotionPlan({ ...this.plan, objects: this.plan.objects.length ? this.plan.objects : [{ id: 'probe', shape: 'box', color: '#888888', keys: [{ t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, { t: this.plan.duration, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }] }], camera: value });
                this.plan.camera = probe.camera;
                this.queued.push({ op: 'camera', camera: probe.camera });
            } catch { this.rejected++; }
            return;
        }
        if (head === 'removedObjectIds' && rel.length === 1) {
            if (!Array.isArray(value)) return;
            for (const id of value) if (typeof id === 'string' && !this.pinned.has(id) && !this.protects(id) && this.plan.objects.some(object => object.id === id)) {
                this.plan.objects = this.plan.objects.filter(object => object.id !== id && object.attachment?.objectId !== id);
                this.queued.push({ op: 'removeObject', id });
            }
            return;
        }
        if (head === 'lightingRig' && rel.length === 1 && this.plan.objects.length) {
            try { const lighting = validateMotionPlan({ ...this.plan, lightingRig: value }).lightingRig!; this.plan.lightingRig = lighting; this.queued.push({ op: 'lighting', lighting }); } catch { this.rejected++; }
            return;
        }
        if (head !== 'objects' || typeof index !== 'number') return;
        if (rel.length === 2) { this.offer(value, false); return; }
        if (sub === 'parts' && rel.length === 4) {
            // An object is still being written; show its root plus the parts
            // completed so far so articulated figures assemble piece by piece.
            const members = this.watcher.openMembers([...this.planPath, 'objects', index]) as Record<string, unknown> | undefined;
            const parts = this.watcher.openMembers([...this.planPath, 'objects', index, 'parts']) as unknown[] | undefined;
            if (!members || !Array.isArray(parts) || typeof members.id !== 'string' || !Array.isArray(members.keys)) return;
            this.offer({ ...members, parts: parts.filter(Boolean) }, true);
        }
    }

    private offer(raw: unknown, partial: boolean) {
        if (!raw || typeof raw !== 'object') return;
        let incoming = raw as Record<string, any>;
        if (typeof incoming.id !== 'string' || this.pinned.has(incoming.id)) return;
        try { incoming = expandSceneObject(incoming, this.plan.duration); } catch { if (!partial) this.rejected++; return; }
        // Spatial motion may omit geometry to reuse the saved asset.
        const base = this.plan.objects.find(object => object.id === incoming.id) || this.baseObjects.get(incoming.id);
        const merged: Record<string, any> = mergeLiveObject(base, incoming, partial || Boolean(this.options.deltaOnly) || Boolean(this.protects(incoming.id)), this.options.protectedControls);
        if (!merged.shape) merged.shape = merged.parts?.length ? 'box' : 'box';
        if (!merged.color) merged.color = '#BBC3D2';
        if (merged.parts && !merged.parts.length) delete merged.parts;
        if (merged.parts) merged.parts = merged.parts.map((part: any) => base?.parts?.find(old => old.id === part?.id) && !part.shape ? { ...base.parts!.find(old => old.id === part.id), ...part } : part);
        this.tryAccept(merged as MotionObject, partial);
        this.retryPending();
    }

    private tryAccept(object: MotionObject, partial: boolean): boolean {
        if (this.basePlan) object = preserveProtectedScenePlan(this.basePlan, { ...this.plan, objects: [object] }, this.options.protectedControls || [], this.options.pinned).objects.find(item => item.id === object.id)!;
        if (object.attachment) {
            const owner = this.plan.objects.find(candidate => candidate.id === object.attachment!.objectId);
            if (!owner || object.attachment.partId && !owner.parts?.some(part => part.id === object.attachment!.partId)) {
                // Dependency not visible yet: hold it until its anchor arrives.
                this.pendingAttachment.set(object.id, { object, partial });
                return false;
            }
        }
        const objects = this.plan.objects.some(candidate => candidate.id === object.id)
            ? this.plan.objects.map(candidate => candidate.id === object.id ? object : candidate)
            : [...this.plan.objects, object];
        try {
            const validated = validateMotionPlan({ ...this.plan, objects: objects.map(candidate => candidate === object ? candidate : candidate) });
            const accepted = validated.objects.find(candidate => candidate.id === object.id)!;
            this.plan.objects = objects.map(candidate => candidate.id === object.id ? accepted : candidate);
            this.pendingAttachment.delete(object.id);
            this.queued.push({ op: 'upsertObject', object: accepted, ...(partial ? { partial: true } : {}) });
            return true;
        } catch {
            if (!partial) this.rejected++;
            return false;
        }
    }

    private retryPending() {
        let progressed = true;
        while (progressed && this.pendingAttachment.size) {
            progressed = false;
            for (const [, entry] of [...this.pendingAttachment]) if (this.tryAccept(entry.object, entry.partial)) progressed = true;
        }
    }
}

/** Apply ops to a plan on either side of the wire (client mirrors this). */
export function applyLiveOps(plan: MotionPlan | undefined, ops: LiveOp[], fallbackDuration = 5): MotionPlan | undefined {
    let next: any = plan ? { ...plan, objects: [...plan.objects] } : { version: 1, duration: fallbackDuration, background: '#DCE2EC', camera: DEFAULT_CAMERA(fallbackDuration), objects: [] };
    for (const op of ops) {
        if (op.op === 'duration') { next.duration = op.value; next.objects = next.objects.map((object: MotionObject) => retimeObject(object, op.value)); next.camera = retime(next.camera, op.value); }
        else if (op.op === 'background') next.background = op.value;
        else if (op.op === 'camera') next.camera = op.camera;
        else if (op.op === 'lighting') next.lightingRig = op.lighting;
        else if (op.op === 'removeObject') next.objects = next.objects.filter((object: MotionObject) => object.id !== op.id && object.attachment?.objectId !== op.id);
        else if (op.op === 'upsertObject') {
            const index = next.objects.findIndex((object: MotionObject) => object.id === op.object.id);
            if (index >= 0) next.objects[index] = op.object; else next.objects.push(op.object);
        }
    }
    if (next.objects.length > 1) next.objects = next.objects.filter((object: MotionObject) => object.id !== 'live_workspace');
    return next.objects.length ? next as MotionPlan : undefined;
}

/** Streaming-order guidance appended to live prompts so the scene builds in a watchable order. */
export const liveStreamingOrder = (planAtRoot: boolean) => planAtRoot
    ? 'STREAMING ORDER (the creator watches this scene build live in Three.js while you write): write keys in this order: version, duration, background, camera, objects, then any optional fields such as sourceLayout LAST. Write the ground/environment first, then large landmarks and furniture, then actors/subjects, then small props. Inside each object write id, shape, color, role, attachment, keys, then parts; write parent parts before their children.'
    : 'STREAMING ORDER (the creator watches this scene build live in Three.js while you write): write the top-level "plan" key FIRST. Inside plan write keys in this order: version, duration, background, camera, objects. Write the ground/environment first, then large landmarks and furniture, then actors/subjects, then small props. Inside each object write id, shape, color, role, attachment, keys, then parts; write parent parts before their children. Write every other top-level field (sourceLayout, controlledObject, initialState, conditions, etc.) AFTER plan.';

export const liveContinuationInstructions = (planAtRoot: boolean) => `LIVE CONTINUATION: the creator paused this build while watching it and may have corrected the scene by hand. acceptedScene is the scene built so far INCLUDING those manual corrections; treat it as authoritative. Never change or remove pinnedObjectIds, including deleted objects named in that list. Follow creatorGuidance. Continue the same task from acceptedScene — do not restart from nothing.
Output the same JSON format as before, with one difference: ${planAtRoot ? 'objects' : 'plan.objects'} contains ONLY objects that are new or that you change (same stable IDs, complete changed tracks); list objects to delete in ${planAtRoot ? 'removedObjectIds' : 'plan.removedObjectIds'}. Unmentioned parts of a changed object remain in the accepted scene. To delete parts, put removedPartIds on their owning object; releasedPartIds retains the existing release protocol. Preserve unchanged part poses, geometry and attachment anchors. Omit ${planAtRoot ? 'camera' : 'plan.camera'} unless it changes. Keep version and duration. Include every other required ${planAtRoot ? 'field' : 'top-level field'}.`;

/**
 * Merge a continuation segment's raw JSON with the accepted scene so the
 * existing (unchanged) validation pipeline receives one complete response.
 */
export function mergeContinuationRaw(raw: any, accepted: MotionPlan, planPath: JsonPath, pinned: string[], previousRoot: Record<string, unknown> | undefined, protectedControls: readonly string[] = []): any {
    const root = raw && typeof raw === 'object' ? raw : {};
    const result: any = planPath.length ? { ...(previousRoot || {}), ...root } : { ...root };
    const streamedPlan: any = planPath.length ? root.plan || {} : root;
    const protectedIds = new Set<string>(protectedControls.flatMap(key => { try { return [JSON.parse(key)[0]]; } catch { return []; } }));
    for (let pass = 0; pass < accepted.objects.length; pass++) for (const object of accepted.objects) if (protectedIds.has(object.id) && object.attachment) protectedIds.add(object.attachment.objectId);
    const removed = new Set<string>(Array.isArray(streamedPlan.removedObjectIds) ? streamedPlan.removedObjectIds.filter((id: unknown) => typeof id === 'string' && !pinned.includes(id as string) && !protectedIds.has(id as string)) : []);
    for (let pass = 0; pass < accepted.objects.length; pass++) for (const object of accepted.objects) if (object.attachment && removed.has(object.attachment.objectId) && !pinned.includes(object.id)) removed.add(object.id);
    const changed = new Map<string, any>((Array.isArray(streamedPlan.objects) ? streamedPlan.objects : []).filter((object: any) => object && typeof object.id === 'string' && !pinned.includes(object.id)).map((object: any) => [object.id, object]));
    const duration = Number(streamedPlan.duration) || accepted.duration;
    const objects = accepted.objects.filter(object => !removed.has(object.id)).map(object => changed.has(object.id) ? mergeLiveObject(object, changed.get(object.id), true, protectedControls) : retimeObject(object, duration));
    for (const [id, object] of changed) if (!objects.some(existing => existing.id === id)) objects.push(object);
    const plan = preserveProtectedScenePlan(accepted, { ...accepted, ...streamedPlan, version: 1, duration, objects: objects.length > 1 ? objects.filter(object => object.id !== 'live_workspace') : objects, camera: streamedPlan.camera || retime(accepted.camera, duration) }, protectedControls, pinned);
    delete (plan as any).removedObjectIds;
    if (planPath.length) result.plan = plan; else Object.assign(result, plan);
    return result;
}
