import { validateMotionPlan, type MotionObject } from './motionGuidePlan';
import {
    applyAuthoringCommands,
    restoreAuthoringDraft,
    serializeAuthoringDraft,
    type AuthoringCommand,
    type RigBinding,
    type SceneAuthoringDraft,
} from './sceneAuthoring';

export type ConstructionCommitBatch = {
    buildId: string;
    sequence: number;
    dependsOn?: string[];
    progress?: number;
    objects?: MotionObject[];
    rigs?: Record<string, RigBinding>;
    commands?: AuthoringCommand[];
    final?: boolean;
};

export type ConstructionStreamState = {
    buildId: string;
    draft: SceneAuthoringDraft;
    buildProgress: number;
    acceptedSequences: number[];
    pendingBatches: ConstructionCommitBatch[];
    completed: boolean;
    receiptId?: string;
    rejectedReasons: string[];
};

function hasTargetInDraft(draft: SceneAuthoringDraft, targetSpec: string): boolean {
    const [objectId, partId] = targetSpec.split('/');
    const obj = draft.plan.objects.find(o => o.id === objectId);
    if (!obj) return false;
    if (!partId) return true;
    return Boolean(obj.parts?.some(p => p.id === partId));
}

function batchDependenciesSatisfied(draft: SceneAuthoringDraft, batch: ConstructionCommitBatch): boolean {
    for (const dep of batch.dependsOn || []) {
        if (!hasTargetInDraft(draft, dep)) return false;
    }
    for (const obj of batch.objects || []) {
        if (obj.attachment) {
            const spec = obj.attachment.partId ? `${obj.attachment.objectId}/${obj.attachment.partId}` : obj.attachment.objectId;
            const inSameBatch = (batch.objects || []).some(o => o.id === obj.attachment!.objectId && (!obj.attachment!.partId || o.parts?.some(p => p.id === obj.attachment!.partId)));
            if (!inSameBatch && !hasTargetInDraft(draft, spec)) return false;
        }
    }
    return true;
}

function applyBatchAtomically(draft: SceneAuthoringDraft, batch: ConstructionCommitBatch): SceneAuthoringDraft {
    let candidate = restoreAuthoringDraft(serializeAuthoringDraft(draft));
    if (batch.objects?.length) {
        const nextObjects = [...candidate.plan.objects];
        const nextStateObjects = { ...candidate.sourceState.objects };
        for (const incoming of batch.objects) {
            const idx = nextObjects.findIndex(o => o.id === incoming.id);
            if (idx >= 0) nextObjects[idx] = incoming;
            else nextObjects.push(incoming);
            const firstKey = incoming.keys?.[0];
            if (firstKey) {
                nextStateObjects[incoming.id] = {
                    transform: { t: 0, position: [...firstKey.position], rotation: [...firstKey.rotation], scale: [...firstKey.scale] },
                    facts: {},
                    assets: [],
                    ...(incoming.attachment ? { attachment: { ...incoming.attachment } } : {}),
                    ...(incoming.parts ? { parts: Object.fromEntries(incoming.parts.map(p => [p.id, { t: 0, position: [...p.keys[0].position], rotation: [...p.keys[0].rotation], scale: [...p.keys[0].scale] }])) } : {}),
                };
            }
        }
        const validatedPlan = validateMotionPlan({ ...candidate.plan, objects: nextObjects });
        candidate = {
            ...candidate,
            revision: candidate.revision + 1,
            plan: validatedPlan,
            sourceState: { ...candidate.sourceState, objects: nextStateObjects },
        };
    }
    if (batch.rigs && Object.keys(batch.rigs).length) {
        for (const [objId] of Object.entries(batch.rigs)) {
            if (!candidate.plan.objects.some(o => o.id === objId)) {
                throw new Error(`Rig binding references missing object ${objId}.`);
            }
        }
        candidate = {
            ...candidate,
            revision: candidate.revision + (batch.objects?.length ? 0 : 1),
            rigs: { ...candidate.rigs, ...batch.rigs },
        };
    }
    if (batch.commands?.length) {
        candidate = applyAuthoringCommands(candidate, candidate.revision, batch.commands);
    }
    return restoreAuthoringDraft(serializeAuthoringDraft(candidate));
}

/**
 * Genuine incremental construction decoder (P08-01..P08-12).
 * Handles arbitrary UTF-8 byte splits, string escapes, braces inside strings,
 * dependency-gated atomic commits, duplicate/out-of-order sequences, and
 * separated buildProgress vs performance timeline.
 */
export class IncrementalConstructionDecoder {
    private decoder = new TextDecoder('utf-8');
    private objectDepth = 0;
    private inString = false;
    private escaped = false;
    private currentObjectChars = '';
    private state: ConstructionStreamState;
    private seenSequences = new Set<number>();

    constructor(initialDraft: SceneAuthoringDraft, buildId: string) {
        if (!buildId.trim()) throw new Error('Construction stream requires a server-owned buildId.');
        this.state = {
            buildId,
            draft: restoreAuthoringDraft(serializeAuthoringDraft(initialDraft)),
            buildProgress: 0,
            acceptedSequences: [],
            pendingBatches: [],
            completed: false,
            rejectedReasons: [],
        };
    }

    get snapshot(): ConstructionStreamState {
        return {
            ...this.state,
            acceptedSequences: [...this.state.acceptedSequences],
            pendingBatches: [...this.state.pendingBatches],
            rejectedReasons: [...this.state.rejectedReasons],
        };
    }

    push(chunk: string | Uint8Array): ConstructionStreamState {
        const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (this.objectDepth === 0) {
                if (ch === '{') {
                    this.objectDepth = 1;
                    this.inString = false;
                    this.escaped = false;
                    this.currentObjectChars = '{';
                }
                continue;
            }
            this.currentObjectChars += ch;
            if (this.inString) {
                if (this.escaped) {
                    this.escaped = false;
                } else if (ch === '\\') {
                    this.escaped = true;
                } else if (ch === '"') {
                    this.inString = false;
                }
            } else {
                if (ch === '"') {
                    this.inString = true;
                } else if (ch === '{') {
                    this.objectDepth++;
                } else if (ch === '}') {
                    this.objectDepth--;
                    if (this.objectDepth === 0) {
                        const raw = this.currentObjectChars;
                        this.currentObjectChars = '';
                        this.consumeCompleteObject(raw);
                    }
                }
            }
        }
        return this.snapshot;
    }

    finish(receiptId?: string): ConstructionStreamState {
        const tail = this.decoder.decode();
        if (tail) this.push(tail);
        if (this.objectDepth !== 0) {
            this.state.rejectedReasons.push('Truncated JSON commit at stream end was discarded; accepted draft retained.');
            this.objectDepth = 0;
            this.currentObjectChars = '';
        }
        if (receiptId && !this.state.receiptId) {
            this.state.receiptId = receiptId;
        }
        return this.snapshot;
    }

    private consumeCompleteObject(raw: string) {
        let parsed: ConstructionCommitBatch;
        try {
            parsed = JSON.parse(raw) as ConstructionCommitBatch;
        } catch (error) {
            this.state.rejectedReasons.push(`Malformed JSON commit: ${(error as Error).message}`);
            return;
        }
        if (!parsed || typeof parsed !== 'object' || parsed.buildId !== this.state.buildId || !Number.isInteger(parsed.sequence) || parsed.sequence < 1) {
            this.state.rejectedReasons.push('Rejected commit batch with mismatched buildId or invalid sequence.');
            return;
        }
        if (this.seenSequences.has(parsed.sequence)) {
            return; // Idempotent replay protection (P08-10)
        }
        this.seenSequences.add(parsed.sequence);
        this.state.pendingBatches.push(parsed);
        this.state.pendingBatches.sort((a, b) => a.sequence - b.sequence);
        this.drainReadyBatches();
    }

    private drainReadyBatches() {
        let progressed = true;
        while (progressed && this.state.pendingBatches.length > 0) {
            progressed = false;
            for (let i = 0; i < this.state.pendingBatches.length; i++) {
                const batch = this.state.pendingBatches[i];
                const expectedNext = (this.state.acceptedSequences.at(-1) || 0) + 1;
                if (batch.sequence !== expectedNext) continue;
                if (!batchDependenciesSatisfied(this.state.draft, batch)) continue;
                this.state.pendingBatches.splice(i, 1);
                try {
                    this.state.draft = applyBatchAtomically(this.state.draft, batch);
                    this.state.acceptedSequences.push(batch.sequence);
                    if (Number.isFinite(batch.progress)) {
                        this.state.buildProgress = Math.max(this.state.buildProgress, Math.min(100, Math.max(0, Number(batch.progress))));
                    }
                    if (batch.final) {
                        this.state.completed = true;
                        this.state.buildProgress = 100;
                    }
                    progressed = true;
                } catch (error) {
                    this.state.rejectedReasons.push(`Batch ${batch.sequence} rejected: ${(error as Error).message}`);
                }
                break;
            }
        }
    }
}
