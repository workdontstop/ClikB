import axios from 'axios';
import { ProtectSavedMediaFromDeleteLater } from './SavepromptHelpersLocal';
import type { SpatialSceneState } from './spatialStageModel';
import type { SpatialExperience } from './spatialExperience';
import { retainCurrentReferenceAssets, sceneWithoutReferenceAssets } from '../server/src/spatialReferenceAssets';

export type SpatialSavedDocument = { scene: SpatialSceneState; revision: number; viewRevision?: number; options?: import('../server/src/spatialWorld').SpatialJob['options']; quote?: { key: string; pixels: number; jobs: import('../server/src/spatialWorld').SpatialJob[] } };
type Session = { api: string; postId: number; stageId: string; value?: SpatialSavedDocument; listeners: Set<(doc: SpatialSavedDocument) => void>; authoring: { busy: string; error: string; running: boolean; startedAt?: number; inputs: Record<string, any> }; authoringListeners: Set<() => void>; busy: Set<string>; recoveryChecks?: Map<string, number>; timer?: ReturnType<typeof setTimeout>; finalize?: (job: import('../server/src/spatialWorld').SpatialJob, epoch: number) => Promise<void>; finalizationAttempts?: Map<string, number> };
const sessions = new Map<string, Session>();
const documentListeners = new Set<{ api: string; postId: number; listener: (doc: SpatialSavedDocument) => void }>();
const referenceWrites = new WeakMap<Session, Promise<unknown>>();
export function subscribeSpatialDocuments(api: string, postId: number, listener: (doc: SpatialSavedDocument) => void) {
    const subscription = { api, postId, listener }; documentListeners.add(subscription);
    for (const session of sessions.values()) if (session.api === api && session.postId === postId && session.value) listener(session.value);
    return () => { documentListeners.delete(subscription); };
}
export async function loadSpatialDocuments(api: string, postId: number): Promise<SpatialSavedDocument[]> {
    const response = await axios.post<SpatialSavedDocument[]>(`${api}/spatial-world/document`, { postId, stageId: '__all__', action: 'list' }, { withCredentials: true });
    for (const doc of response.data) receive(spatialSession(api, postId, doc.scene.sceneId), doc);
    return response.data;
}
export function spatialSession(api: string, postId: number, stageId: string) {
    const key = `${api}:${postId}:${stageId}`;
    if (!sessions.has(key)) sessions.set(key, { api, postId, stageId, listeners: new Set(), busy: new Set(), authoring: { busy: '', error: '', running: false, inputs: {} }, authoringListeners: new Set() });
    const session = sessions.get(key)!;
    if (!session.finalize) {
        const savedAssets = new Map<string, { endFrame?: string; videoUrl?: string }>();
        session.finalize = async (job, epoch) => {
            const key = `${epoch}:${job.id}:${job.attempt}:${job.output}`;
            const receipt = job.completionAssets;
            if (receipt?.attempt === job.attempt && receipt.sourceOutput === job.output) savedAssets.set(key, { videoUrl: receipt.videoUrl, endFrame: receipt.endFrame });
            if (!savedAssets.has(key)) savedAssets.set(key, {});
            const { persistSpatialResultAssets } = await import('./spatialResultAssets');
            const assets = await persistSpatialResultAssets(api, job.output!, savedAssets.get(key)!);
            await spatialOperation(session, 'complete', { epoch, jobId: job.id, attempt: job.attempt, sourceOutput: job.output, ...assets, automatic: true });
            savedAssets.delete(key);
        };
    }
    return session;
}
export function updateSpatialAuthoring(session: Session, patch: Partial<Session['authoring']>) {
    Object.assign(session.authoring, patch);
    session.authoringListeners.forEach(listener => listener());
}
const rawSpatialError = (error: any): string => typeof error === 'string' ? error : error?.response?.data?.message || error?.message || 'This operation failed.';
const connectionFailure = (error: any) => /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network error|socket hang up|timeout of \d+ms/i.test(rawSpatialError(error));
/** Transport diagnostics belong in logs, not creator-facing notifications. */
export function spatialErrorMessage(error: unknown): string {
    return connectionFailure(error) ? 'Connection interrupted. Please try again.' : rawSpatialError(error);
}
/** This lock belongs to the stage, not an editor instance. Closing the editor does not release it. */
export async function runSpatialAuthoring(session: Session, message: string, work: () => Promise<void>) {
    if (session.authoring.running) return;
    updateSpatialAuthoring(session, { running: true, busy: message, error: '', startedAt: Date.now() });
    try { await work(); }
    catch (error: any) { updateSpatialAuthoring(session, { error: spatialErrorMessage(error) }); }
    finally { updateSpatialAuthoring(session, { running: false, busy: '' }); }
}
const olderDocument = (doc: SpatialSavedDocument, current: SpatialSavedDocument) => doc.revision < current.revision
    || doc.revision === current.revision && (doc.viewRevision || 0) < (current.viewRevision || 0);
function receive(session: Session, doc: SpatialSavedDocument | null) {
    if (!doc || session.value && olderDocument(doc, session.value)) return;
    ProtectSavedMediaFromDeleteLater(doc);
    session.value = doc;
    documentListeners.forEach(item => { if (item.api === session.api && item.postId === session.postId) item.listener(doc); });
    session.listeners.forEach(listener => listener(doc));
    if (doc.scene.ledger?.generationStarted) schedule(session);
}
export async function spatialOperation(session: Session, action: string, body: Record<string, unknown> = {}) {
    if (action === 'save' || action === 'save-reference') {
        const base = session.value;
        const previous = referenceWrites.get(session) || Promise.resolve();
        const operation = previous.catch(() => {}).then(async () => {
            let fields = body;
            if (action === 'save' && body.scene && session.value) {
                fields = { ...body, scene: retainCurrentReferenceAssets(body.scene as SpatialSceneState, session.value.scene) };
                if (base && body.revision === base.revision) {
                    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sceneWithoutReferenceAssets(base.scene))));
                    fields.referenceBaseKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
                }
                if (base && body.revision === base.revision && JSON.stringify(sceneWithoutReferenceAssets(base.scene)) === JSON.stringify(sceneWithoutReferenceAssets(session.value.scene))) {
                    fields.revision = session.value.revision;
                }
            }
            return sendSpatialOperation(session, action, fields);
        });
        referenceWrites.set(session, operation);
        return operation;
    }
    return sendSpatialOperation(session, action, body);
}
async function sendSpatialOperation(session: Session, action: string, body: Record<string, unknown>) {
    let response;
    try {
        response = await axios.post<SpatialSavedDocument | null>(`${session.api}/spatial-world/document`, { postId: session.postId, stageId: session.stageId, action, ...body }, { withCredentials: true, timeout: 3600000 });
    } catch (error: any) {
        // A failed action-state refresh still saves its paid result receipt.
        // Publish that document so recovery is available without a page reload.
        if (error?.response?.data?.document) receive(session, error.response.data.document);
        throw error;
    }
    if (action !== 'quote') {
        receive(session, response.data);
        // A delayed read must not publish older routes over a newer saved result.
        if (response.data && session.value && olderDocument(response.data, session.value)) return session.value;
    }
    return response.data;
}

/** Preview/publish must include completed jobs from stages no longer mounted. */
export async function hydrateSpatialExperience(api: string, postId: number, document: SpatialExperience): Promise<SpatialExperience> {
    const stages = await Promise.all(document.stages.map(async stage => {
        const saved = await spatialOperation(spatialSession(api, postId, stage.id), 'read');
        return saved ? { ...stage, scene: { ...saved.scene, activeNodeId: saved.scene.nodes[0].id, draftMovement: null } } : stage;
    }));
    const entryStage = stages.find(stage => stage.id === document.entry?.stageId) || stages[0];
    return { ...document, stages, entry: entryStage ? { stageId: entryStage.id, nodeId: entryStage.scene.nodes[0].id } : null };
}
export function setSpatialFinalizer(session: Session, finalize: NonNullable<Session['finalize']>) {
    session.finalize = finalize;
    schedule(session);
}
function schedule(session: Session) {
    if (session.timer) return;
    const jobs = session.value?.scene.ledger?.jobs || [];
    const needsRecovery = (job: typeof jobs[number]) => Boolean(job.submissionToken && (job.status === 'submitting' || job.status === 'failed' && job.submissionUncertain));
    const needsUpscale = (job: typeof jobs[number]) => ['submitting', 'generating'].includes(job.upscale?.status || '');
    const needsSave = (job: typeof jobs[number]) => Boolean(session.finalize && job.status === 'checking' && job.output && !job.completionError);
    if (!jobs.some(job => ['queued', 'preparing', 'generating'].includes(job.status) || needsRecovery(job) || needsUpscale(job) || needsSave(job))) return;
    session.timer = setTimeout(async () => {
        session.timer = undefined;
        const ready = (session.value?.scene.ledger?.jobs || []).filter(job => !session.busy.has(job.id) && (needsSave(job) && Date.now() - (session.finalizationAttempts?.get(job.id) || 0) > 30000 || needsUpscale(job) || ['queued', 'preparing', 'generating'].includes(job.status)
            || needsRecovery(job) && Date.now() - (job.submissionStartedAt || 0) > 60000 && Date.now() - (session.recoveryChecks?.get(job.submissionToken!) || 0) > 30000)).slice(0, 4);
        await Promise.allSettled(ready.map(async job => {
            session.busy.add(job.id);
            try {
                if (needsSave(job)) {
                    session.finalizationAttempts ||= new Map(); session.finalizationAttempts.set(job.id, Date.now());
                    await session.finalize!(job, session.value!.scene.ledger!.epoch);
                    session.finalizationAttempts.delete(job.id);
                    return;
                }
                const recover = needsRecovery(job);
                if (recover) { session.recoveryChecks ||= new Map(); session.recoveryChecks.set(job.submissionToken!, Date.now()); }
                await spatialOperation(session, needsUpscale(job) ? 'upscale-tick' : recover ? 'recover' : 'tick', { jobId: job.id });
            }
            catch (error: any) {
                // Background retries do not interrupt authoring with a transient
                // connection popup. An actual save failure remains visible.
                if (needsSave(job) && !connectionFailure(error)) updateSpatialAuthoring(session, { error: session.value?.scene.ledger?.jobs.find(item => item.id === job.id)?.completionError
                    ? `Your generated video is retained. Retry saving from the Generation Board. ${spatialErrorMessage(error)}`
                    : `Could not save the video yet. Saving will retry. ${spatialErrorMessage(error)}` });
            }
            finally { session.busy.delete(job.id); }
        }));
        schedule(session);
    }, 3000);
}
