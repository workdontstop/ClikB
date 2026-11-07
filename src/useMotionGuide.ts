import { LiveSceneClient } from './liveSceneClient';
import { liveSceneLog } from './liveSceneDiagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutoDrawGuideData } from './AutoDrawGuide';
import { sceneTargetKey, type SceneTarget } from './sceneTargetArchitecture';
import { MotionGuideJobs, validateMotionPlan, type MotionGuideData } from './motionGuide';
import { verifyMotionRecording, recordMotionGuide } from './motionGuideRenderer';
import { applyLlmBilling, applyLlmBillingError, applyPixelBillingHeaders } from './llmBilling';
import type { LanguageModelTier } from './languageModels';
import type { SceneAuthoringDraft } from '../server/src/sceneAuthoring';
import { validateScenePerformance } from '../server/src/scenePerformance';
import { mergeLiveAuthoringPlan } from './liveAuthoringPlan';
import { scenePerformanceText } from '../server/src/scenePerformance';
import { adoptMotionGuideState } from '../server/src/motionGuideState';

export type MotionGuideSource = { prompt: string; firstFrameUrl: string; duration: number; aspectRatio: MotionGuideData['aspectRatio']; authoring?: SceneAuthoringDraft };
const sourceStateIdentities = new WeakMap<SceneAuthoringDraft, string>();
export const motionGuideSourceIdentity = (source: MotionGuideSource) => {
    const fields: unknown[] = [source.prompt, source.firstFrameUrl, source.duration, source.aspectRatio];
    if (source.authoring) {
        let identity = sourceStateIdentities.get(source.authoring);
        if (!identity) { identity = scenePerformanceText(source.authoring.plan, source.aspectRatio, source.authoring); sourceStateIdentities.set(source.authoring, identity); }
        fields.push(identity);
    }
    return JSON.stringify(fields);
};
const fingerprint = (value: string) => { let a = 2166136261, b = 2246822519; for (const char of value) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b ^ char.charCodeAt(0), 3266489917); } return `${a >>> 0}-${b >>> 0}`; };

export type MotionManualCommitInput = {
    target: SceneTarget;
    previous: MotionGuideData;
    authoring: SceneAuthoringDraft;
};

export type MotionBuildInput = {
    target: SceneTarget;
    prompt: string;
    firstFrameUrl: string;
    duration: number;
    aspectRatio: MotionGuideData['aspectRatio'];
    previous?: MotionGuideData;
    editInstruction?: string;
    /** Only a deliberate rebuild buys a new plan when one is already retained. */
    rebuild?: boolean;
    manualAuthoring?: SceneAuthoringDraft;
    sourceContext?: MotionGuideSource;
    resume?: boolean;
};
type Options = {
    apiUrl: string;
    dispatch: any;
    topologyVersion: number;
    scopeKey?: string;
    llmTier: LanguageModelTier;
    resolveIndex: (target: SceneTarget) => number;
    sourceFor?: (target: SceneTarget) => MotionGuideSource | null;
    guideFor?: (target: SceneTarget) => MotionGuideData | undefined;
    save: (updater: (current: AutoDrawGuideData | null) => AutoDrawGuideData, target: SceneTarget) => void;
    upload: (file: File) => Promise<string>;
    registerVideo: (url: string) => void;
};

export function useMotionGuide(options: Options) {
    const latest = useRef(options);
    latest.current = options;
    const jobs = useRef(new MotionGuideJobs());
    const clients = useRef(new Map<string, LiveSceneClient>());
    const owners = useRef(new Map<LiveSceneClient, { target: SceneTarget; source: MotionGuideSource; identity: string; scope: string; input?: MotionBuildInput }>());
    const buildRef = useRef<(input: MotionBuildInput) => Promise<boolean>>(async () => false);
    const ownerCurrent = (owner: { target: SceneTarget; identity: string; scope: string }) => latest.current.resolveIndex(owner.target) >= 0
        && owner.scope === `${latest.current.apiUrl}:${latest.current.scopeKey || ''}`
        && (!latest.current.sourceFor || (() => { const source = latest.current.sourceFor!(owner.target); return Boolean(source && motionGuideSourceIdentity(source) === owner.identity); })());
    const clientFor = (target: SceneTarget, source = latest.current.sourceFor?.(target) || { prompt: '', firstFrameUrl: '', duration: 5, aspectRatio: '16:9' as const }) => {
        const key = sceneTargetKey(target), identity = motionGuideSourceIdentity(source), scope = `${latest.current.apiUrl}:${latest.current.scopeKey || ''}`;
        const id = `${scope}:${key}:${fingerprint(identity)}`;
        let client = clients.current.get(id);
        if (!client) { client = new LiveSceneClient(latest.current.apiUrl, `motion:${latest.current.scopeKey || ''}:${key}:${fingerprint(identity)}`); clients.current.set(id, client); owners.current.set(client, { target: { ...target }, source: { ...source }, identity, scope }); }
        client.onResponse = response => applyPixelBillingHeaders(latest.current.dispatch, response);
        const owner = owners.current.get(client)!;
        client.onExportDraft = async (draft, signal, progress) => {
            const current = () => !signal.aborted && owners.current.get(client!) === owner && ownerCurrent(owner);
            const assertCurrent = () => { if (!current()) throw Object.assign(new Error('The source changed. The exported draft will not replace the new scene.'), { name: 'AbortError' }); };
            assertCurrent();
            const key = sceneTargetKey(owner.target), input = owner.input;
            const previous = latest.current.guideFor?.(owner.target) || input?.previous;
            const retained: MotionGuideData = {
                ...previous, plan: draft.plan, authoring: draft.authoring,
                sourcePrompt: input?.prompt || owner.source.prompt,
                sourceFrameUrl: input?.firstFrameUrl || owner.source.firstFrameUrl,
                aspectRatio: input?.aspectRatio || owner.source.aspectRatio,
                createdAt: Date.now(), videoUrl: undefined, pendingReplacement: undefined,
                liveDraft: { buildId: draft.liveBuild.buildId, sourceIdentity: owner.identity },
            };
            // Preserve the previous usable video until this frozen revision uploads.
            latest.current.save(p => {
                const completed = p?.motion?.videoUrl ? p.motion : previous?.videoUrl ? previous : undefined;
                return { ...p, motion: completed ? { ...completed, pendingReplacement: retained } : retained };
            }, owner.target);
            const report = (message: string) => { if (current()) { progress(message); setStatuses(p => ({ ...p, [key]: message })); } };
            try {
                await verifyMotionRecording(retained.aspectRatio, { shortEdge: 480 }); assertCurrent();
                const file = await recordMotionGuide(retained.plan, retained.aspectRatio, signal, pct => report(`Exporting motion ${pct}%`), retained.authoring, { shortEdge: 480 });
                assertCurrent(); report('Uploading motion…');
                const videoUrl = await latest.current.upload(file); assertCurrent();
                latest.current.registerVideo(videoUrl);
                latest.current.save(p => {
                    if (!current()) return p || {};
                    const draftPrompt = p?.motion ? p.motion.draftPrompt : retained.draftPrompt;
                    return { ...p, motion: { ...retained, videoUrl,
                        draftPrompt: draftPrompt !== retained.sourcePrompt ? draftPrompt : undefined } };
                }, owner.target);
                setErrors(p => ({ ...p, [key]: '' }));
                return videoUrl;
            } finally {
                if (current()) setStatuses(p => { const next = { ...p }; delete next[key]; return next; });
            }
        };
        client.canResume = () => ownerCurrent(owner) && (!client!.snapshot().resumeBody?.liveSource || motionGuideSourceIdentity(client!.snapshot().resumeBody!.liveSource) === owner.identity);
        client.onResume = () => {
            const body = client!.snapshot().resumeBody || {}, saved = latest.current.guideFor?.(owner.target) || owner.input?.previous;
            const partial = saved?.pendingReplacement?.liveDraft ? saved.pendingReplacement : saved;
            void buildRef.current({ ...owner.input, target: owner.target, sourceContext: owner.source, prompt: body.prompt || owner.source.prompt,
                firstFrameUrl: body.firstFrameUrl || owner.source.firstFrameUrl, duration: body.duration || owner.source.duration, aspectRatio: body.aspectRatio || owner.source.aspectRatio,
                previous: saved, manualAuthoring: partial?.authoring || body.liveAuthoring || owner.input?.manualAuthoring, editInstruction: body.editInstruction, resume: true });
        };
        return client;
    };
    const controllers = useRef(new Map<string, AbortController>());
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [progress, setProgress] = useState<Record<string, number>>({});
    const activeOwners = useRef(new Map<string, { client: LiveSceneClient; owner: { target: SceneTarget; identity: string; scope: string } }>());
    useEffect(() => {
        for (const [client, owner] of owners.current) if (!ownerCurrent(owner)) {
            const key = sceneTargetKey(owner.target);
            if (activeOwners.current.get(key)?.client === client) { jobs.current.cancel(key); controllers.current.get(key)?.abort(); controllers.current.delete(key); activeOwners.current.delete(key); setStatuses(p => { const next = { ...p }; delete next[key]; return next; }); }
            client.detach(); owners.current.delete(client); for (const [id, value] of clients.current) if (value === client) clients.current.delete(id);
        }
    });
    useEffect(() => {
        jobs.current.reset();
        controllers.current.forEach(c => c.abort());
        controllers.current.clear();
        setStatuses({}); setErrors({});
        setProgress({});
        return () => {
            jobs.current.reset();
            controllers.current.forEach(c => c.abort());
            controllers.current.clear();
            clients.current.forEach(client => client.detach()); clients.current.clear(); owners.current.clear(); activeOwners.current.clear();
        };
    }, [options.topologyVersion, options.scopeKey]);

    const build = useCallback(async (input: MotionBuildInput): Promise<boolean> => {
        liveSceneLog('motion-preflight', { duration: input.duration, aspectRatio: input.aspectRatio, resume: Boolean(input.resume) });
        const key = sceneTargetKey(input.target);
        const source = input.sourceContext || latest.current.sourceFor?.(input.target) || { prompt: input.prompt, firstFrameUrl: input.firstFrameUrl, duration: input.duration, aspectRatio: input.aspectRatio };
        const client = clientFor(input.target, source), owner = owners.current.get(client)!;
        if (!ownerCurrent(owner)) return false;
        const planningTier = latest.current.llmTier;
        if (jobs.current.busy(key)) return false;
        const token = jobs.current.start(key);
        const controller = new AbortController();
        controllers.current.set(key, controller);
        activeOwners.current.set(key, { client, owner }); owner.input = input;
        const current = () => jobs.current.current(key, token) && ownerCurrent(owner);
        const status = (value: string) => { if (current()) { liveSceneLog('motion-stage', { stage: value, buildId: client.snapshot().buildId }); setStatuses(p => ({ ...p, [key]: value })); } };
        const advance = (value: number) => { if (current()) setProgress(p => ({ ...p, [key]: Math.max(p[key] || 0, value) })); };
        setProgress(p => ({ ...p, [key]: 0 }));
        setErrors(p => ({ ...p, [key]: '' }));
        try {
            // Verify codec support BEFORE a paid build. Navigation between scenes
            // is safe: the recording canvas belongs to this job, not the preview.
            // Continue's callback must attach its native waiter synchronously,
            // before the provider can finish the resumed inference segment.
            const resumed = input.resume ? client.run('/motion-guide/build', client.snapshot().resumeBody || {}, controller.signal) : undefined;
            if (!input.resume) { await verifyMotionRecording(input.aspectRatio, { shortEdge: 480 }); liveSceneLog('recording-preflight-ready'); }
            if (!current() || controller.signal.aborted) return false;
            const previous = input.previous;
            const paidReplacement = !input.editInstruction && !input.rebuild && previous?.pendingReplacement
                ? previous.pendingReplacement : undefined;
            let guide = paidReplacement || previous;
            if (!guide || input.editInstruction || input.rebuild || input.resume || guide.liveDraft && !guide.videoUrl) {
                status(input.editInstruction ? 'Editing motion…' : 'Building motion…');
                const previousAuthoring = input.manualAuthoring || (input.editInstruction || input.resume ? guide?.authoring : undefined) || source.authoring;
                const response = { data: await (resumed || client.run('/motion-guide/build', {
                    prompt: input.prompt, firstFrameUrl: input.firstFrameUrl || undefined,
                    duration: input.duration, aspectRatio: input.aspectRatio,
                    llmTier: planningTier,
                    visualCheckpoints: true,
                    liveNewBuild: Boolean(input.rebuild || input.editInstruction),
                    previousPlan: previousAuthoring?.plan || (input.editInstruction ? guide?.plan : undefined),
                    pinnedObjectIds: previousAuthoring?.locks.map(lock => lock.objectId) || [],
                    liveSource: source, liveAuthoring: previousAuthoring,
                    authoringContext: previousAuthoring,
                    editInstruction: input.editInstruction || undefined,
                }, controller.signal)) };
                if (!current()) return false;
                const validatedPlan = validateMotionPlan(response.data.plan);
                const mergedAuthoring = response.data.authoring
                    ? validateScenePerformance({ plan: validatedPlan, authoring: response.data.authoring }).authoring!
                    : mergeLiveAuthoringPlan(previousAuthoring, validatedPlan, client.snapshot().pinned)
                        || adoptMotionGuideState(validatedPlan, client.targetKey);
                guide = {
                    plan: mergedAuthoring ? mergedAuthoring.plan : validatedPlan,
                    ...(mergedAuthoring ? { authoring: mergedAuthoring } : {}),
                    sourcePrompt: input.prompt,
                    sourceFrameUrl: input.firstFrameUrl, aspectRatio: input.aspectRatio,
                    editInstruction: input.editInstruction, createdAt: Date.now(),
                    model: response.data.model, provider: response.data.provider,
                    requestedModel: response.data.requestedModel,
                    requestedReasoningEffort: response.data.requestedReasoningEffort,
                    llmTier: response.data.llmTier,
                    ...(response.data.liveDraft === true ? { liveDraft: { buildId: response.data.liveBuild.buildId, sourceIdentity: owner.identity } } : {}),
                    ...(response.data.liveDraft === true && response.data.videoUrl ? { videoUrl: response.data.videoUrl } : {}),
                };
                // Retain the paid plan even if recording/upload subsequently fails.
                if (current()) latest.current.save(p => {
                    if (response.data.liveDraft === true) {
                        const retained = p?.motion?.pendingReplacement?.liveDraft?.buildId === response.data.liveBuild.buildId
                            ? p.motion.pendingReplacement : p?.motion || previous;
                        // The export callback has already saved this revision.
                        // A stopped result carries no normal finalization metadata.
                        for (const field of ['model', 'provider', 'requestedModel', 'requestedReasoningEffort', 'llmTier'] as const) {
                            if (guide![field] === undefined && retained?.[field] !== undefined) Object.assign(guide!, { [field]: retained[field] });
                        }
                        const draftPrompt = p?.motion ? p.motion.draftPrompt : retained?.draftPrompt;
                        if (draftPrompt !== undefined && draftPrompt !== guide!.sourcePrompt) guide!.draftPrompt = draftPrompt;
                    }
                    const completed = p?.motion?.videoUrl ? p.motion : previous?.videoUrl ? previous : undefined;
                    return { ...p, motion: completed && !guide!.videoUrl ? { ...completed, pendingReplacement: guide } : guide };
                }, input.target);
                if (response.data.liveDraft === true) {
                    if (response.data.exportError) setErrors(p => ({ ...p, [key]: response.data.exportError }));
                    return !response.data.exportError;
                }
                applyLlmBilling(latest.current.dispatch, response.data);
                client.acknowledge();
            }
            if (!current()) return false;
            if (input.resume) await verifyMotionRecording(guide.aspectRatio, { shortEdge: 480 });
            if (!current()) return false;
            const file = await recordMotionGuide(guide.plan, guide.aspectRatio, controller.signal, pct => {
                status(`Exporting motion ${pct}%`);
                advance(90 + pct * 0.08);
            }, guide.authoring, { shortEdge: 480 });
            if (!current()) return false;
            status('Uploading motion…');
            const videoUrl = await latest.current.upload(file);
            latest.current.registerVideo(videoUrl);
            if (!current()) return false;
            latest.current.save(p => {
                const draftPrompt = p?.motion?.draftPrompt ?? previous?.draftPrompt;
                return { ...p, motion: { ...guide, videoUrl,
                    ...(draftPrompt !== undefined && draftPrompt !== guide.sourcePrompt ? { draftPrompt } : {}) } };
            }, input.target);
            advance(100);
            return true;
        } catch (error: any) {
            liveSceneLog('motion-error', { buildId: client.snapshot().buildId, error: error?.message });
            if (current()) {
                const message = applyLlmBillingError(latest.current.dispatch, error)
                    || error?.response?.data?.message || error?.message || 'Motion Guide failed. Try again.';
                setErrors(p => ({ ...p, [key]: message }));
            }
            return false;
        } finally {
            if (jobs.current.current(key, token)) {
                jobs.current.finish(key, token);
                controllers.current.delete(key);
                activeOwners.current.delete(key);
                setStatuses(p => { const next = { ...p }; delete next[key]; return next; });
            }
        }
    }, []);
    buildRef.current = build;

    const commitManual = useCallback(async (input: MotionManualCommitInput): Promise<boolean> => {
        const key = sceneTargetKey(input.target);
        const source = latest.current.sourceFor?.(input.target) || { prompt: input.previous.sourcePrompt, firstFrameUrl: input.previous.sourceFrameUrl, duration: input.previous.plan.duration, aspectRatio: input.previous.aspectRatio };
        const client = clientFor(input.target, source), owner = owners.current.get(client)!;
        if (jobs.current.busy(key)) return false;
        const token = jobs.current.start(key);
        const controller = new AbortController();
        controllers.current.set(key, controller);
        activeOwners.current.set(key, { client, owner });
        const current = () => jobs.current.current(key, token) && ownerCurrent(owner);
        const status = (value: string) => { if (current()) setStatuses(p => ({ ...p, [key]: value })); };
        const advance = (value: number) => { if (current()) setProgress(p => ({ ...p, [key]: Math.max(p[key] || 0, value) })); };
        setProgress(p => ({ ...p, [key]: 0 }));
        setErrors(p => ({ ...p, [key]: '' }));
        try {
            await verifyMotionRecording(input.previous.aspectRatio, { shortEdge: 480 });
            if (!current() || controller.signal.aborted) return false;
            const validated = validateScenePerformance({ plan: input.authoring.plan, authoring: input.authoring });
            const syncedAuthoring = validated.authoring!;
            const manualGuide: MotionGuideData = {
                ...input.previous,
                plan: validated.plan,
                authoring: syncedAuthoring,
                createdAt: Date.now(),
                liveDraft: undefined,
            };
            // Retain manual 3D revision immediately before export/upload so failed export never loses work.
            if (current()) latest.current.save(p => {
                const completed = p?.motion?.videoUrl ? p.motion : input.previous.videoUrl ? input.previous : undefined;
                return { ...p, motion: completed ? { ...completed, authoring: syncedAuthoring, pendingReplacement: { ...manualGuide, videoUrl: undefined } } : { ...manualGuide, videoUrl: undefined } };
            }, input.target);
            const file = await recordMotionGuide(validated.plan, manualGuide.aspectRatio, controller.signal, pct => {
                status(`Exporting motion ${pct}%`);
                advance(Math.min(95, pct * 0.9));
            }, syncedAuthoring, { shortEdge: 480 });
            if (!current()) return false;
            status('Uploading motion…');
            const videoUrl = await latest.current.upload(file);
            latest.current.registerVideo(videoUrl);
            if (!current()) return false;
            latest.current.save(p => {
                const draftPrompt = p?.motion?.draftPrompt ?? input.previous.draftPrompt;
                return {
                    ...p,
                    motion: {
                        ...manualGuide,
                        videoUrl,
                        pendingReplacement: undefined,
                        ...(draftPrompt !== undefined && draftPrompt !== manualGuide.sourcePrompt ? { draftPrompt } : {}),
                    },
                };
            }, input.target);
            advance(100);
            return true;
        } catch (error: any) {
            if (current()) {
                const message = error?.response?.data?.message || error?.message || 'Manual Motion Guide export failed. Try again.';
                setErrors(p => ({ ...p, [key]: message }));
            }
            return false;
        } finally {
            if (jobs.current.current(key, token)) {
                jobs.current.finish(key, token);
                controllers.current.delete(key);
                activeOwners.current.delete(key);
                setStatuses(p => { const next = { ...p }; delete next[key]; return next; });
            }
        }
    }, []);

    const remove = useCallback((target: SceneTarget) => {
        const key = sceneTargetKey(target);
        // Invalidates all later completions, including an upload already in flight.
        jobs.current.cancel(key);
        const client = clientFor(target), controller = controllers.current.get(key);
        void client.stop(false).finally(() => { controller?.abort(); client.detach(); });
        for (const [id, value] of clients.current) if (value === client) clients.current.delete(id);
        owners.current.delete(client); activeOwners.current.delete(key);
        controllers.current.delete(key);
        latest.current.save(p => ({ ...p, motion: undefined }), target);
        setStatuses(p => { const next = { ...p }; delete next[key]; return next; });
        setErrors(p => { const next = { ...p }; delete next[key]; return next; });
        setProgress(p => { const next = { ...p }; delete next[key]; return next; });
    }, []);
    const recover = useCallback((target: SceneTarget) => {
        const client = clientFor(target), owner = owners.current.get(client)!;
        if (client.snapshot().phase !== 'idle') return client;
        let attached = false;
        const unsubscribe = client.subscribe(() => {
            const state = client.snapshot();
            if (attached || !state.buildId || !state.resumeBody || !state.plan || !ownerCurrent(owner)) return;
            attached = true;
            unsubscribe();
            // Attach during snapshot delivery so a replayed final result is adopted
            // by the native guide, including its export and source ownership checks.
            client.onResume?.();
        });
        void client.recover('/motion-guide/build').finally(unsubscribe);
        return client;
    }, []);
    return { build, commitManual, remove, statuses, errors, progress, clientFor, recover };
}
