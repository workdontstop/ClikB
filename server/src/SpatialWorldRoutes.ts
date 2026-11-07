import { validateScenePerformance, canonicalAuthoringText } from './scenePerformance';
import { evaluateAuthoringDraft } from './sceneAuthoring';
import type { Request, Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import execQuery, { withTransaction } from './execQuery';
import { authenticatedUserId } from './requestAuth';
import { withMediaBilling, withMediaPollBilling } from './mediaBilling';
import { pollVideoStatus, BanannaRouteOld } from './fluxSchnellRoute';
import { cancelSpatialVideo, submitSpatialVideo } from './SpatialVideoProvider';
import { authoringLocked, refreshJobDependencies, spatialRegenerationBlocker, spatialRouteGenerationBlocker, spatialJobDependenciesReady, spatialUpscaleIsActive, spatialUpscaleSource, validateWorld, type SpatialLedger, type SpatialJob } from './spatialWorld';
import { effectiveSpatialClipPrompt } from './spatialClipPrompt';
import { validateAudioReference } from './audioReference';
import { prepareSpatialGenerationGuidance, prepareSpatialPostActionContext, savedSpatialGenerationGuidance, spatialGenerationGuidanceInput, spatialDraftGuidanceInput, spatialNodeContext } from './spatialGenerationGuidance';
import { motionEvidencePlanText, validateMotionEvidence } from './spatialMotionEvidence';
import { retainCurrentReferenceAssets, sceneWithoutReferenceAssets } from './spatialReferenceAssets';

import { isSpatialVideoModel, spatialVideoPixels, spatialVideoModels } from './spatialVideoSpec';
import { upscaleVideoRoute, VIDEO_UPSCALE_MODEL } from './UpscaleRoute';
import { attachMeasuredSourceDuration, SERVER_MEASURED_DURATION_FIELD } from './sourceMediaDuration';
import { mediaChargeFor } from './mediaPricing';
import { videoUpscaleResolution } from './videoUpscaleSpec';

type Scene = { sceneId: string; activeNodeId: string; nodes: any[]; connections: any[]; draftMovement: any; ledger: SpatialLedger; bShotSource?: { prompt: string; frameUrl: string; identity?: string; slot?: number } };
type Saved = { scene: Scene; revision: number; viewRevision?: number; options?: NonNullable<SpatialJob['options']> };
let schema: Promise<any> | undefined;
const ensureSchema = () => schema ||= execQuery(`CREATE TABLE IF NOT EXISTS spatial_world_drafts (
    user_id BIGINT UNSIGNED NOT NULL, post_id BIGINT UNSIGNED NOT NULL, stage_key CHAR(64) NOT NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 0, document LONGTEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, post_id, stage_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(error => { schema = undefined; throw error; });
const keyFor = (stage: string) => createHash('sha256').update(stage).digest('hex');
const https = (value: unknown) => { if (typeof value !== 'string' || value.length > 8000 || new URL(value).protocol !== 'https:') throw new Error('Save reference assets to HTTPS storage first.'); return value; };
function validateScene(scene: Scene) {
    if (!scene || typeof scene.sceneId !== 'string' || scene.sceneId.length > 500 || !Array.isArray(scene.nodes) || !scene.nodes.length || scene.nodes.length > 100 || !Array.isArray(scene.connections) || scene.connections.length > 40) throw new Error('Invalid spatial scene.');
    const nodes = new Set(scene.nodes.map(n => n.id));
    if (nodes.size !== scene.nodes.length || !nodes.has(scene.activeNodeId)) throw new Error('Invalid node identities.');
    if (scene.ledger?.version !== 2) throw new Error('A version 2 ledger is required.');
    scene.ledger.world = validateWorld(scene.ledger.world);
    for (const [nodeId, reference] of Object.entries(scene.ledger.actionAudioReferences || {})) {
        if (!nodes.has(nodeId)) throw new Error('The audio reference belongs to a deleted node.');
        scene.ledger.actionAudioReferences![nodeId] = validateAudioReference(reference, 15)!;
    }
    if (scene.ledger.draft) {
        if (!nodes.has(scene.ledger.draft.sourceNodeId)) throw new Error('Draft belongs to a deleted node.');
        const draftPerf = validateScenePerformance({ plan: scene.ledger.draft.plan, authoring: scene.ledger.draft.authoring });
        scene.ledger.draft.plan = draftPerf.plan;
        if (draftPerf.authoring) scene.ledger.draft.authoring = draftPerf.authoring;
        for (const anim of [scene.ledger.draft.forward, scene.ledger.draft.backward].filter(Boolean)) {
            const perf = validateScenePerformance(anim!);
            anim!.plan = perf.plan;
            if (perf.authoring) anim!.authoring = perf.authoring;
        }
    }
    const edges = new Set<string>();
    for (const edge of scene.connections) {
        if (!nodes.has(edge.sourceNodeId) || !nodes.has(edge.targetNodeId) || edges.has(edge.id) || edge.sourceNodeId === edge.targetNodeId) throw new Error('Invalid connection.');
        edges.add(edge.id);
        const route = scene.ledger.routes[edge.id];
        if (!route || route.worldRevision !== scene.ledger.world.revision) throw new Error('Route belongs to a different base world.');
        for (const animation of [route.forward, route.backward].filter(Boolean)) {
            const performance = validateScenePerformance(animation!);
            if (performance.authoring) {
                animation!.authoring = performance.authoring;
                if (canonicalAuthoringText(performance.authoring.sourceState) !== canonicalAuthoringText(animation!.sourceState)) throw new Error('Authoring source state does not match this route.');
                const endpoint = evaluateAuthoringDraft(performance.authoring, performance.plan.duration).state;
                if (canonicalAuthoringText(endpoint) !== canonicalAuthoringText(animation!.endState)) throw new Error('Authoring endpoint does not match this route.');
            }
            if (animation!.audioReference) animation!.audioReference = validateAudioReference(animation!.audioReference, animation!.plan.duration);
            if (edge.kind !== 'action' && animation!.plan.duration !== 5) throw new Error('Movement clips must be five seconds.');
        }
        if (edge.kind !== 'action' && !route.backward) throw new Error('Author a separate return route.');
    }
    for (const node of scene.nodes) {
        const actionCount = Number(Boolean(node.actionLink)) + Number(Boolean(node.actionBacktrack)) + scene.connections.filter(edge => edge.sourceNodeId === node.id && edge.kind === 'action').length;
        if (actionCount > 1) throw new Error('Each spot can have only one action, link or backtrack.');
        if (node.actionBacktrack && (!nodes.has(node.actionBacktrack.targetNodeId) || node.actionBacktrack.targetNodeId === node.id)) throw new Error('Choose another saved spot for backtrack.');
        const link = node.actionLink;
        if (link && (typeof link.sceneId !== 'string' || !link.sceneId || link.sceneId.length > 500
            || link.bShotIndex !== undefined && (!Number.isInteger(link.bShotIndex) || link.bShotIndex < 0 || link.bShotIndex > 10000)
            || link.bShotIdentity !== undefined && (typeof link.bShotIdentity !== 'string' || !link.bShotIdentity || link.bShotIdentity.length > 500))) throw new Error('Choose a saved scene for the link.');
    }
    // The authored tree establishes generation dependencies; reject cycles and disconnected edges.
    const reachable = new Set([scene.nodes[0].id]);
    for (let i = 0; i < scene.nodes.length; i++) for (const edge of scene.connections) if (reachable.has(edge.sourceNodeId)) reachable.add(edge.targetNodeId);
    if (reachable.size !== nodes.size || scene.connections.some(e => scene.connections.filter(p => p.targetNodeId === e.targetNodeId).length > 1)) throw new Error('Routes must form a rooted authored tree.');
    if (scene.connections.length !== scene.nodes.length - 1) throw new Error('Route cycles are not supported; use scene links for navigation.');
    if (Buffer.byteLength(JSON.stringify(scene)) > 3_500_000) throw new Error('This spatial scene exceeds the saved draft limit.');
}

function generationOptions(value: any, world: SpatialLedger['world']): NonNullable<Saved['options']> {
    if (!value || typeof value.audio !== 'boolean' || value.music !== undefined && typeof value.music !== 'boolean'
        || !isSpatialVideoModel(value.model) || !['16:9', '9:16', '1:1'].includes(value.aspect)
        || world.aspectRatio && value.aspect !== world.aspectRatio) throw new Error('Choose supported video settings with the mapped scene framing.');
    return { model: value.model, resolution: value.resolution, aspect: value.aspect, audio: value.audio,
        ...(value.music !== undefined ? { music: value.audio && value.music } : {}) };
}

/** Validate the entire replacement scope before resetting either paid result. */
function replacementJobs(scene: Scene, ids: unknown, selected?: NonNullable<Saved['options']>): SpatialJob[] {
    if (!Array.isArray(ids) || !ids.length || ids.length > 2 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) throw new Error('Choose one direction or its forward/backward pair.');
    const jobs = ids.map(id => scene.ledger.jobs.find(job => job.id === id));
    if (jobs.some(job => !job || !['ready', 'checking'].includes(job.status) || !job.output || job.submissionUncertain)) throw new Error('Review the selected clips before confirming replacements.');
    const ready = jobs as SpatialJob[];
    if (ready.length === 2 && (ready[0].connectionId !== ready[1].connectionId || new Set(ready.map(job => job.direction)).size !== 2)) throw new Error('Both directions must belong to the same motion.');
    for (const job of ready) {
        const blocked = spatialRegenerationBlocker(scene.ledger.jobs, job);
        if (blocked) throw new Error(blocked);
        if (!spatialJobDependenciesReady(scene.ledger.jobs, job)) throw new Error('Waiting for the previous video.');
    }
    return ready.sort((a, b) => a.direction === b.direction ? 0 : a.direction === 'forward' ? -1 : 1)
        .map(job => ({ ...job, ...(selected ? { options: { ...selected }, model: selected.model, pixels: spatialVideoPixels(selected.model, selected.resolution, job.duration, job, selected.audio) } : {}) }));
}

function generationQuoteKey(jobs: SpatialJob[], epoch: number, options: Saved['options'], replacement = false): string {
    return createHash('sha256').update(JSON.stringify({ jobs: jobs.map(({ status, ...job }) => job), epoch, options, ...(replacement ? { replacement: true } : {}) })).digest('hex');
}

function createJobs(scene: Scene, options: NonNullable<Saved['options']>, routeId?: string, context?: unknown): SpatialJob[] {
    if (!isSpatialVideoModel(options.model)) throw new Error('Select Seedance 2.0, Mini, Fast, 2.5, MiniMax H3 or Fal H3 in the video model picker.');
    const jobs: SpatialJob[] = [];
    if (routeId && !scene.connections.some(edge => edge.id === routeId)) throw new Error('This motion no longer exists.');
    for (const connection of scene.connections) {
        if (routeId && connection.id !== routeId) continue;
        const route = scene.ledger.routes[connection.id];
        const parent = scene.connections.find(edge => edge.targetNodeId === connection.sourceNodeId);
        for (const direction of ['forward', 'backward'] as const) {
            const animation = route[direction];
            if (!animation) continue;
            if (scene.ledger.jobs.some(job => job.id === `${connection.id}:${direction}`)) continue;
            jobs.push({ id: `${connection.id}:${direction}`, connectionId: connection.id, direction,
                options: { ...options },
                sourceNodeId: direction === 'forward' ? connection.sourceNodeId : connection.targetNodeId,
                targetNodeId: direction === 'forward' ? connection.targetNodeId : connection.sourceNodeId,
                dependsOn: direction === 'backward' ? [`${connection.id}:forward`] : parent ? [`${parent.id}:forward`] : [],
                status: 'waiting-on-parent', kind: connection.kind === 'action' ? 'action' : 'movement', promptVersion: 2,
                creatorInstruction: animation.creatorInstruction,
                guidance: animation.guidance,
                motionEvidence: animation.motionEvidence,
                sceneContext: context && typeof context === 'object' ? Object.fromEntries(['imagePrompt', 'sceneIntent', 'videoPrompt'].map(key => [key, typeof (context as any)[key] === 'string' ? (context as any)[key].slice(0, 6000) : ''])) as SpatialJob['sceneContext'] : scene.ledger.world.sceneContext,
                prompt: effectiveSpatialClipPrompt({ ...animation, guidance: undefined, direction, kind: connection.kind === 'action' ? 'action' : 'movement' }), referenceVideo: https(animation.referenceVideo),
                references: animation.references || scene.ledger.world.references,
                audioReference: animation.audioReference,
                startAnchor: https(animation.startAnchor), endAnchor: https(animation.endAnchor), duration: animation.plan.duration,
                model: options.model, pixels: spatialVideoPixels(options.model, options.resolution, animation.plan.duration, { ...animation, references: animation.references || scene.ledger.world.references, direction, kind: connection.kind === 'action' ? 'action' : 'movement' }, options.audio), attempt: 0 });
        }
    }
    return refreshJobDependencies([...scene.ledger.jobs, ...jobs]).filter(job => jobs.some(created => created.id === job.id));
}

/** Captures an existing billed adapter without making an internal HTTP request. */
async function invoke(handler: any, original: Request, path: string, body: any) {
    const req = Object.create(original);
    Object.defineProperty(req, 'path', { value: path }); req.body = body;
    const headers: Record<string, string> = {};
    const res: any = { statusCode: 200, headersSent: false, body: null,
        status(code: number) { this.statusCode = code; return this; },
        json(value: any) { this.body = value; return this; }, send(value: any) { this.body = value; return this; },
        setHeader(name: string, value: string) { headers[name] = value; }, getHeader(name: string) { return headers[name]; } };
    await handler(req, res, (error: any) => { if (error) throw error; });
    return { code: res.statusCode, body: res.body, headers };
}

export async function spatialWorldDocument(req: Request, res: Response) {
    const user = authenticatedUserId(req), post = Number(req.body?.postId), stage = String(req.body?.stageId || '');
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    if (!Number.isSafeInteger(post) || post <= 0 || !stage || stage.length > 500) return res.status(400).json({ message: 'A saved post and stage are required.' });
    const key = keyFor(stage), args = [user, post, key];
    const action = req.body.action || 'read';
    let completing: { epoch: number; attempt: number; sourceOutput: string } | undefined;
    try {
        const owned = await execQuery('SELECT id FROM posts WHERE id = ? AND sender = ? LIMIT 1', [post, user]);
        if (!owned.length) return res.status(403).json({ message: 'This spatial post belongs to another creator.' });
        await ensureSchema();
        if (action === 'tick') {
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=?', args);
            const snapshot: Saved = rows[0] && JSON.parse(rows[0].document);
            const job = snapshot?.scene.ledger.jobs.find(item => item.id === req.body.jobId);
            if (job?.status === 'queued' && spatialJobDependenciesReady(snapshot.scene.ledger.jobs, job)) {
                let node = job.sourceNodeId, missingState = false;
                const visited = new Set<string>();
                while (!visited.has(node)) {
                    visited.add(node);
                    const edge = snapshot.scene.connections.find(item => item.targetNodeId === node); if (!edge) break;
                    if (edge.kind === 'action' && snapshot.scene.ledger.jobs.some(item => item.connectionId === edge.id && item.direction === 'forward' && item.status === 'ready' && item.actualEndFrame) && !snapshot.scene.ledger.nodeContexts?.[node]) { missingState = true; break; }
                    node = edge.sourceNodeId;
                }
                if (missingState || job.kind !== 'action' && spatialNodeContext(snapshot.scene, job.sourceNodeId) && !savedSpatialGenerationGuidance(snapshot.scene, job)) {
                    // The old state compiler/refiner runs before paid dispatch,
                    // outside its transaction, only after a real action boundary.
                    const prepared = await invoke(spatialWorldDocument, req, '/spatial-world/document', { ...req.body, action: 'prepare-guidance', jobId: job.id, direction: job.direction, routeId: job.connectionId });
                    if (prepared.code !== 200) throw new Error(prepared.body?.message || 'The completed action state could not be prepared.');
                }
            }
        }
        let completedContext: Awaited<ReturnType<typeof prepareSpatialPostActionContext>>;
        let completedSourceOutput: string | undefined;
        if (action === 'complete') {
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=?', args);
            const snapshot: Saved = rows[0] && JSON.parse(rows[0].document);
            const job = snapshot?.scene.ledger.jobs.find(item => item.id === req.body.jobId);
            if (!job || snapshot.scene.ledger.epoch !== req.body.epoch) throw new Error('This completion belongs to a deleted generation.');
            let endFrame = https(req.body.endFrame), videoUrl = https(req.body.videoUrl);
            if (job.status === 'ready' && job.actualEndFrame === endFrame && job.output === videoUrl) return res.json(snapshot);
            if (job.status !== 'checking' || !job.output) throw new Error('This job is not ready for continuity review.');
            if (req.body.automatic && (req.body.attempt !== job.attempt || req.body.sourceOutput !== job.output)) throw new Error('This save belongs to an older video result.');
            completedSourceOutput = job.output;
            if (job.direction === 'forward' && snapshot.scene.connections.some(edge => edge.id === job.connectionId && edge.kind === 'action')) {
                // Persist uploads before the compiler: a failed analysis or page
                // reload must never discard the already paid result.
                const receipt = await withTransaction(async query => {
                    const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                    const doc: Saved = rows[0] && JSON.parse(rows[0].document), current = doc?.scene.ledger.jobs.find(item => item.id === job.id);
                    if (!current || doc.scene.ledger.epoch !== req.body.epoch || current.status !== 'checking' || current.attempt !== job.attempt || current.output !== completedSourceOutput) throw new Error('The video result changed before state analysis.');
                    if (!current.completionAssets || current.completionAssets.attempt !== current.attempt || current.completionAssets.sourceOutput !== current.output) {
                        current.completionAssets = { videoUrl, endFrame, attempt: current.attempt, sourceOutput: current.output! };
                        doc.revision++;
                        await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                    }
                    return current.completionAssets!;
                });
                endFrame = receipt.endFrame; videoUrl = receipt.videoUrl;
                req.body.endFrame = endFrame; req.body.videoUrl = videoUrl;
                completing = { epoch: snapshot.scene.ledger.epoch, attempt: job.attempt, sourceOutput: job.output };
            }
            // Restore the old final-frame -> compiler -> node context sequence
            // outside the database lock. Failed analysis retains the paid video.
            completedContext = await prepareSpatialPostActionContext(snapshot.scene, job, endFrame);
        }
        if (action === 'list') {
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=?', [user, post]);
            return res.json(rows.map((row: any) => JSON.parse(row.document)));
        }
        if (action === 'prepare-guidance') {
            // Compatibility for mapped drafts created before author-time
            // intelligence, and explicit prompt edits. This never queues a
            // video or changes an in-flight paid request.
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=?', args);
            if (!rows.length) throw new Error('Save the 3D scene first.');
            const snapshot: Saved = JSON.parse(rows[0].document);
            const repairedStates: Array<{ job: SpatialJob; context: NonNullable<SpatialLedger['nodeContexts']>[string] }> = [];
            // Older saved action results were marked ready without compiling
            // their actual frame. Repair those receipts before using descendants.
            for (const job of snapshot.scene.ledger.jobs) if (job.status === 'ready' && job.direction === 'forward' && job.actualEndFrame &&
                snapshot.scene.connections.some(edge => edge.id === job.connectionId && edge.kind === 'action') &&
                snapshot.scene.ledger.nodeContexts?.[job.targetNodeId]?.frameUrl !== job.actualEndFrame) {
                const context = await prepareSpatialPostActionContext(snapshot.scene, job, job.actualEndFrame);
                if (context) { snapshot.scene.ledger.nodeContexts ||= {}; snapshot.scene.ledger.nodeContexts[job.targetNodeId] = context; repairedStates.push({ job, context }); }
            }
            const context = req.body.sceneContext && typeof req.body.sceneContext === 'object'
                ? Object.fromEntries(['imagePrompt', 'sceneIntent', 'videoPrompt'].map(key => [key, typeof req.body.sceneContext[key] === 'string' ? req.body.sceneContext[key].slice(0, 6000) : ''])) as SpatialJob['sceneContext'] : undefined;
            if (req.body.draft) {
                const direction = req.body.direction;
                if (!['forward', 'backward'].includes(direction)) throw new Error('Invalid motion direction.');
                const input = spatialDraftGuidanceInput(snapshot.scene, direction, context);
                const fingerprint = spatialGenerationGuidanceInput(input.scene, input.job).key;
                const guidance = await prepareSpatialGenerationGuidance(input.scene, input.job);
                const result = await withTransaction(async query => {
                    const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                    if (!rows.length) throw new Error('This scene is no longer saved.');
                    const doc: Saved = JSON.parse(rows[0].document);
                    if (doc.scene.ledger.epoch !== snapshot.scene.ledger.epoch || !doc.scene.ledger.draft?.[direction as 'forward' | 'backward']) return doc;
                    for (const repaired of repairedStates) {
                        const current = doc.scene.ledger.jobs.find(job => job.id === repaired.job.id);
                        if (current?.status === 'ready' && current.attempt === repaired.job.attempt && current.actualEndFrame === repaired.context.frameUrl) {
                            doc.scene.ledger.nodeContexts ||= {}; doc.scene.ledger.nodeContexts[current.targetNodeId] = repaired.context;
                        }
                    }
                    const latest = spatialDraftGuidanceInput(doc.scene, direction, context);
                    if (spatialGenerationGuidanceInput(latest.scene, latest.job).key !== fingerprint) return doc;
                    if (JSON.stringify(latest.animation.guidance) !== JSON.stringify(guidance)) {
                        latest.animation.guidance = guidance;
                        doc.revision++;
                        await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                    }
                    return doc;
                });
                return res.json(result);
            }
            const inputs: SpatialJob[] = [];
            for (const edge of snapshot.scene.connections) {
                if (edge.kind === 'action' || req.body.routeId && edge.id !== req.body.routeId) continue;
                for (const direction of ['forward', 'backward'] as const) {
                    const id = `${edge.id}:${direction}`, animation = snapshot.scene.ledger.routes[edge.id]?.[direction];
                    const existing = snapshot.scene.ledger.jobs.find(job => job.id === id);
                    if (!animation || req.body.jobId && id !== req.body.jobId || req.body.direction && direction !== req.body.direction) continue;
                    if (!req.body.jobId && existing || existing && (['preparing', 'submitting', 'generating', 'checking'].includes(existing.status) || existing.submissionUncertain)) continue;
                    const parent = snapshot.scene.connections.find(item => item.targetNodeId === edge.sourceNodeId);
                    inputs.push({ ...existing, id, connectionId: edge.id, direction, kind: 'movement',
                        sourceNodeId: direction === 'forward' ? edge.sourceNodeId : edge.targetNodeId,
                        dependsOn: existing?.dependsOn || (direction === 'backward' ? [`${edge.id}:forward`] : parent ? [`${parent.id}:forward`] : []),
                        prompt: existing?.prompt || animation.prompt, promptVersion: existing?.promptVersion || animation.promptVersion,
                        creatorInstruction: existing?.creatorInstruction || animation.creatorInstruction,
                        sceneContext: context || existing?.sceneContext || snapshot.scene.ledger.world.sceneContext,
                        duration: animation.plan.duration } as SpatialJob);
                }
            }
            const prepared: Array<{ job: SpatialJob; fingerprint: string; guidance: SpatialJob['guidance'] }> = [];
            for (const job of inputs) {
                const fingerprint = spatialGenerationGuidanceInput(snapshot.scene, job).key;
                const guidance = await prepareSpatialGenerationGuidance(snapshot.scene, job);
                prepared.push({ job, fingerprint, guidance });
                // Return preparation uses the forward description from this
                // same authoring pass, before either is committed below.
                snapshot.scene.ledger.routes[job.connectionId][job.direction]!.guidance = guidance;
            }
            const result = await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                if (!rows.length) throw new Error('This scene is no longer saved.');
                const doc: Saved = JSON.parse(rows[0].document);
                if (doc.scene.ledger.epoch !== snapshot.scene.ledger.epoch) return doc;
                let changed = false;
                for (const repaired of repairedStates) {
                    const current = doc.scene.ledger.jobs.find(job => job.id === repaired.job.id);
                    if (current?.status !== 'ready' || current.attempt !== repaired.job.attempt || current.actualEndFrame !== repaired.context.frameUrl) continue;
                    doc.scene.ledger.nodeContexts ||= {}; doc.scene.ledger.nodeContexts[current.targetNodeId] = repaired.context; changed = true;
                }
                for (const item of prepared) {
                    const animation = doc.scene.ledger.routes[item.job.connectionId]?.[item.job.direction];
                    const current = doc.scene.ledger.jobs.find(job => job.id === item.job.id);
                    const original = snapshot.scene.ledger.jobs.find(job => job.id === item.job.id);
                    if (!animation || Boolean(current) !== Boolean(original) || current && (current.attempt !== original!.attempt || ['preparing', 'submitting', 'generating', 'checking'].includes(current.status) || current.submissionUncertain)) continue;
                    const latest = { ...item.job, ...current, sceneContext: item.job.sceneContext,
                        prompt: current?.prompt || animation.prompt, creatorInstruction: current?.creatorInstruction || animation.creatorInstruction };
                    if (spatialGenerationGuidanceInput(doc.scene, latest).key !== item.fingerprint) continue;
                    if (JSON.stringify(animation.guidance) !== JSON.stringify(item.guidance) || current && (JSON.stringify(current.guidance) !== JSON.stringify(item.guidance) || JSON.stringify(current.sceneContext) !== JSON.stringify(item.job.sceneContext))) {
                        animation.guidance = item.guidance;
                        if (current) { current.guidance = item.guidance; current.sceneContext = item.job.sceneContext; }
                        changed = true;
                    }
                }
                if (changed) {
                    doc.revision++;
                    await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                }
                return doc;
            });
            return res.json(result);
        }
        if (action === 'action-image-quote' || action === 'action-image') {
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=?', args);
            const document: Saved = rows[0] && JSON.parse(rows[0].document);
            const node = document?.scene.nodes.find(n => n.id === req.body.nodeId);
            const incoming = document?.scene.connections.find(e => e.kind === 'action' && e.targetNodeId === node?.id);
            if (!node || !incoming || authoringLocked(document.scene.ledger) || document.scene.connections.some(e => e.sourceNodeId === node.id)) throw new Error('Select an action result with no authored descendants before video generation.');
            if (['submitting', 'ready'].includes(document.scene.ledger.actionImageEdits?.[node.id]?.status || '')) throw new Error('Finish the current action image edit before requesting another.');
            const prompt = String(req.body.prompt || '').trim(), aspect = req.body.aspect;
            if (!prompt || prompt.length > 4000 || !['16:9', '9:16', '1:1'].includes(aspect)) throw new Error('Supply a visual correction and a valid aspect ratio.');
            const input = { inputs: `Edit only the appearance of this action-result frame. Preserve camera, poses, object count and completed action state. Do not reset the scene or undo prior actions. Requested visual correction: ${prompt}`, sampleImages: [https(node.frameUrl)], ty: aspect === '16:9' ? 3 : aspect === '1:1' ? 2 : 1, linkmode: true, Png: true, billingAction: 'spatial-action-image' };
            const pixels = mediaChargeFor('/Bannana2', input)!.pixels;
            const quoteKey = createHash('sha256').update(JSON.stringify({ revision: document.revision, node: node.id, original: node.frameUrl, prompt, aspect, pixels })).digest('hex');
            if (action === 'action-image-quote') return res.json({ ...document, actionImageQuote: { key: quoteKey, pixels } });
            if (quoteKey !== req.body.quoteKey) throw new Error('The action image quote changed. Review it again.');
            const requestId = randomUUID();
            await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                const doc: Saved = JSON.parse(rows[0].document);
                if (doc.revision !== document.revision || authoringLocked(doc.scene.ledger)) throw new Error('The action changed. Review the image quote again.');
                doc.scene.ledger.actionImageEdits ||= {};
                doc.scene.ledger.actionImageEdits[node.id] = { id: requestId, status: 'submitting', startedAt: Date.now(), prompt, original: node.frameUrl, pixels };
                doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
            });
            const response = await invoke(withMediaBilling(BanannaRouteOld), req, '/Bannana2', input);
            for (const [name, value] of Object.entries(response.headers)) res.setHeader(name, value);
            const updated = await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                const doc: Saved = JSON.parse(rows[0].document), edit = doc.scene.ledger.actionImageEdits?.[node.id];
                if (!edit || edit.id !== requestId || !doc.scene.nodes.some(n => n.id === node.id)) return doc;
                edit.status = response.code === 200 && response.body?.imageUrl ? 'ready' : 'failed';
                edit.output = response.body?.imageUrl;
                edit.error = edit.status === 'failed' ? String(response.body?.message || response.body?.error || 'No image was returned.') : undefined;
                doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                return doc;
            });
            return res.json(updated);
        }
        if (action === 'upscale-quote' || action === 'upscale') {
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=?', args);
            const document: Saved = rows[0] && JSON.parse(rows[0].document);
            const source = document?.scene.ledger.jobs.find(j => j.id === req.body.jobId);
            if (!source || source.status !== 'ready' || !source.output || spatialUpscaleIsActive(source)) throw new Error('Select a completed clip and wait for its active upscale to finish.');
            const sourceVideo = spatialUpscaleSource(source)!;
            const resolution = videoUpscaleResolution(req.body.targetResolution);
            const shortEdge = resolution === '2k' ? 1440 : 1080, longEdge = resolution === '2k' ? 2560 : 1920;
            const submissionToken = randomUUID();
            const aspect = source.options?.aspect || document.options?.aspect;
            const input = { video: sourceVideo, duration: source.duration, targetResolution: resolution, linkmode: true, async: true, job: { submissionToken }, targetWidth: aspect === '9:16' || aspect === '1:1' ? shortEdge : longEdge, targetHeight: aspect === '9:16' ? longEdge : shortEdge, billingAction: 'video-upscale' };
            await attachMeasuredSourceDuration('/upscaleVideo', input);
            const pixels = mediaChargeFor('/upscaleVideo', input)!.pixels;
            const duration = Number((input as any)[SERVER_MEASURED_DURATION_FIELD] ?? input.duration);
            const quoteKey = createHash('sha256').update(JSON.stringify({ source: sourceVideo, resolution, duration, pixels, attempt: source.attempt, epoch: document.scene.ledger.epoch })).digest('hex');
            if (action === 'upscale-quote') return res.json({ ...document, upscaleQuote: { key: quoteKey, pixels, resolution, duration } });
            if (quoteKey !== req.body.quoteKey) throw new Error('The upscale quote changed. Review it again.');
            const epoch = document.scene.ledger.epoch;
            await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                const doc: Saved = JSON.parse(rows[0].document), job = doc.scene.ledger.jobs.find(j => j.id === source.id);
                if (!job || job.status !== 'ready' || spatialUpscaleIsActive(job) || spatialUpscaleSource(job) !== sourceVideo || job.attempt !== source.attempt || doc.scene.ledger.epoch !== epoch) throw new Error('This clip changed, has an active upscale or was deleted. Review it again.');
                if (job.upscale) job.upscaleHistory = [...(job.upscaleHistory || []), job.upscale];
                job.upscale = { status: 'submitting', pixels, original: sourceVideo, submissionToken, resolution, duration, variant: 'Standard', videoType: 'AIGC', targetFps: 60 }; doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
            });
            const response = await invoke(withMediaBilling(upscaleVideoRoute), req, '/upscaleVideo', input);
            for (const [name, value] of Object.entries(response.headers)) res.setHeader(name, value);
            const result = await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                const doc: Saved = JSON.parse(rows[0].document), job = doc.scene.ledger.jobs.find(j => j.id === source.id);
                if (!job?.upscale || job.upscale.submissionToken !== submissionToken || doc.scene.ledger.epoch !== epoch) {
                    if (response.body?.jobId) void cancelSpatialVideo({ ...source, provider: 'replicate', providerJobId: response.body.jobId }).catch(() => {});
                    return doc;
                }
                if (job.upscale.status !== 'submitting') return doc;
                if (response.code === 200 && response.body?.jobId) {
                    job.upscale.status = 'generating'; job.upscale.providerJobId = response.body.jobId; job.upscale.endpoint = response.body.modelEndpoint;
                } else {
                job.upscale.status = response.code === 200 && response.body?.videoUrl ? 'ready' : 'failed';
                if (response.code >= 500) job.upscale.status = 'submitting';
                job.upscale.output = response.body?.videoUrl;
                job.upscale.error = response.code >= 400 ? String(response.body?.error || response.body?.message || 'Upscale failed.') : undefined;
                }
                doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                return doc;
            });
            return res.json(result);
        }
        if (action === 'upscale-tick') {
            const rows = await execQuery('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=?', args);
            const document: Saved = rows[0] && JSON.parse(rows[0].document);
            const job = document?.scene.ledger.jobs.find(j => j.id === req.body.jobId), upscale = job?.upscale;
            if (!upscale || !['submitting', 'generating'].includes(upscale.status)) return res.json(document);
            let providerId = upscale.providerJobId;
            let modelEndpoint = upscale.endpoint || VIDEO_UPSCALE_MODEL;
            if (!providerId && upscale.submissionToken) {
                const receipts = await execQuery("SELECT provider,provider_job_id,model_endpoint FROM media_generation_jobs WHERE user_id=? AND route='/upscaleVideo' AND action_label LIKE ? LIMIT 2", [user, `%spatial:${upscale.submissionToken}`]);
                const receipt = receipts.length === 1 ? receipts[0] : undefined;
                if (receipt?.provider === 'replicate'
                    && receipt.model_endpoint === VIDEO_UPSCALE_MODEL
                    && (!upscale.endpoint || upscale.endpoint === receipt.model_endpoint)) {
                    providerId = receipt.provider_job_id;
                    modelEndpoint = receipt.model_endpoint;
                }
            }
            if (!providerId) return res.json(document);
            const response = await invoke(withMediaPollBilling(pollVideoStatus), req, '/pollVideoStatus', { provider: 'replicate', jobId: providerId, modelEndpoint, linkmode: true });
            for (const [name, value] of Object.entries(response.headers)) res.setHeader(name, value);
            const updated = await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                const doc: Saved = JSON.parse(rows[0].document), current = doc.scene.ledger.jobs.find(j => j.id === job!.id)?.upscale;
                if (!current || doc.scene.ledger.epoch !== document.scene.ledger.epoch || current.submissionToken !== upscale.submissionToken || !['submitting', 'generating'].includes(current.status)) return doc;
                current.providerJobId = providerId; current.endpoint = modelEndpoint; current.status = 'generating';
                if (response.code === 200 && response.body?.status === 'succeeded' && response.body.videoUrl) { current.output = response.body.videoUrl; current.status = 'ready'; current.error = undefined; }
                else if (['failed', 'canceled'].includes(response.body?.status)) { current.status = 'failed'; current.error = String(response.body.error || 'Upscale failed or was cancelled.'); }
                else if (response.code >= 400) current.error = String(response.body?.message || response.body?.error || 'Status unavailable; polling will retry.');
                doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                return doc;
            });
            return res.json(updated);
        }
        let claimed: SpatialJob | undefined, cancelled: SpatialJob[] = [];
        let epoch = 0, options: Saved['options'];
        const saved = await withTransaction(async query => {
            // Serialize across this creator's stages to enforce a shared four-job ceiling.
            await query('SELECT id FROM members WHERE id = ? FOR UPDATE', [user]);
            const currentPost = await query('SELECT id FROM posts WHERE id = ? AND sender = ? FOR UPDATE', [post, user]);
            if (!currentPost.length) throw new Error('This spatial post was deleted.');
            const rows = await query('SELECT * FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
            let doc: Saved | null = rows[0] ? JSON.parse(rows[0].document) : null;
            if (action === 'read') return doc;
            if (action === 'save') {
                const referenceOnlyChange = doc && req.body.referenceBaseKey === createHash('sha256').update(JSON.stringify(sceneWithoutReferenceAssets(doc.scene))).digest('hex');
                if (doc && Number(req.body.revision) !== doc.revision && !referenceOnlyChange) throw new Error('This scene has newer saved changes. Reopen it before saving; your recording is retained.');
                const scene = (doc ? retainCurrentReferenceAssets(req.body.scene, doc.scene) : req.body.scene) as Scene;
                // An edited plan cannot retain the previous plan's prepared files.
                for (const [routeId, route] of Object.entries(scene.ledger?.routes || {})) for (const direction of ['forward', 'backward'] as const) {
                    const animation = route[direction], previous = doc?.scene.ledger.routes[routeId]?.[direction];
                    if (!animation || !previous || animation.id !== previous.id || motionEvidencePlanText(animation.plan, scene.ledger.world.aspectRatio || '16:9', animation.authoring) === motionEvidencePlanText(previous.plan, doc!.scene.ledger.world.aspectRatio || '16:9', previous.authoring)) continue;
                    if (direction === 'forward') {
                        const edge = scene.connections.find(item => item.id === routeId), node = scene.nodes.find(item => item.id === edge?.targetNodeId);
                        if (node && node.frameUrl === previous.endAnchor) node.frameUrl = animation.startAnchor || scene.nodes.find(item => item.id === edge?.sourceNodeId)?.frameUrl;
                        if (route.backward && route.backward.startAnchor === previous.endAnchor) delete route.backward.startAnchor;
                    }
                    delete animation.referenceVideo; delete animation.referencePlanKey; delete animation.endAnchor; delete animation.motionEvidence; delete animation.guidance;
                }
                validateScene(scene);
                if (scene.sceneId !== stage) throw new Error('Wrong scene identity.');
                if (doc?.scene.connections.length && JSON.stringify(scene.ledger.world) !== JSON.stringify(doc.scene.ledger.world)) throw new Error('Reset all routes before editing the base world.');
                const extendingGeneratedScene = doc && authoringLocked(doc.scene.ledger);
                if (extendingGeneratedScene) {
                    // Generation freezes existing work, not the ability to append a motion.
                    // Never accept edited/deleted paid routes or client-owned job updates.
                    const previous = doc!.scene;
                    // Navigation does not change a paid clip's frame or motion.
                    const protectedNode = ({ actionLink, actionBacktrack, ...node }: any) => node;
                    for (const node of previous.nodes) {
                        const next = scene.nodes.find(item => item.id === node.id);
                        if (!next || JSON.stringify(protectedNode(next)) !== JSON.stringify(protectedNode(node))
                            || JSON.stringify(scene.ledger.states[node.id]) !== JSON.stringify(previous.ledger.states[node.id])) throw new Error('Existing nodes are protected. Add a new motion without changing its saved start.');
                    }
                    for (const edge of previous.connections) {
                        if (JSON.stringify(scene.connections.find(item => item.id === edge.id)) !== JSON.stringify(edge)
                            || JSON.stringify(scene.ledger.routes[edge.id]) !== JSON.stringify(previous.ledger.routes[edge.id])) throw new Error('Existing motions and videos are protected. Add a new motion instead.');
                    }
                    if (JSON.stringify(scene.ledger.jobs) !== JSON.stringify(previous.ledger.jobs)) throw new Error('Generated outputs must be attached by their generation jobs.');
                    if (scene.connections.some(edge => !previous.connections.some(saved => saved.id === edge.id) && (edge.forward || edge.backward))) throw new Error('New motions cannot attach generated outputs directly.');
                    scene.ledger = { ...previous.ledger, routes: scene.ledger.routes, states: scene.ledger.states, draft: scene.ledger.draft, actionAudioReferences: scene.ledger.actionAudioReferences };
                }
                if (Object.values(doc?.scene.ledger.actionImageEdits || {}).some(edit => edit.status === 'submitting')) throw new Error('Wait for the action image edit before changing routes.');
                scene.ledger.actionImageEdits = Object.fromEntries(Object.entries(doc?.scene.ledger.actionImageEdits || {}).filter(([id]) => scene.nodes.some(node => node.id === id)));
                if (!extendingGeneratedScene && (scene.connections.some(edge => edge.forward || edge.backward) || scene.ledger.jobs.length || scene.ledger.generationStarted)) throw new Error('Generated outputs must be attached by their generation jobs.');
                // Saved audio leaves temporary cleanup and must remain discoverable
                // for post deletion even after the creator replaces or clears it.
                const audioHistory = [...(doc?.scene.ledger.actionAudioReferenceHistory || [])];
                for (const [nodeId, reference] of Object.entries(doc?.scene.ledger.actionAudioReferences || {})) {
                    if (JSON.stringify(reference) === JSON.stringify(scene.ledger.actionAudioReferences?.[nodeId])) continue;
                    if (!audioHistory.some(item => item.url === reference.url && item.sourceUrl === reference.sourceUrl)) audioHistory.push(reference);
                }
                for (const [routeId, route] of Object.entries(doc?.scene.ledger.routes || {})) for (const direction of ['forward', 'backward'] as const) {
                    const previous = route[direction];
                    if (!previous || scene.ledger.routes[routeId]?.[direction]) continue;
                    for (const reference of [previous.audioReference, ...(previous.audioReferenceHistory || [])]) {
                        if (reference && !audioHistory.some(item => item.url === reference.url && item.sourceUrl === reference.sourceUrl)) audioHistory.push(reference);
                    }
                }
                if (audioHistory.length) scene.ledger.actionAudioReferenceHistory = audioHistory;
                doc = { ...doc, scene, revision: (doc?.revision || 0) + 1, viewRevision: doc?.viewRevision || 0 };
            } else {
                if (!doc) throw new Error('Save the 3D scene first.');
                const ledger = doc.scene.ledger;
                if (action === 'bind-source') {
                    const source = req.body.source;
                    if (Number(req.body.revision) !== doc.revision || !stage.includes(':b:') || source?.identity !== stage || !Number.isInteger(source?.slot) || source.slot < 0 || source.slot > 10000 || typeof source.prompt !== 'string' || source.prompt.length > 30000 || typeof source.frameUrl !== 'string' || source.frameUrl.length > 8000) throw new Error('Invalid or stale B-shot source binding.');
                    if (doc.scene.bShotSource?.slot !== undefined && doc.scene.bShotSource.slot !== source.slot) throw new Error('This map is already bound to another B-shot. Choose a different saved map.');
                    const siblings = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=?', [user, post]);
                    const prefix = stage.slice(0, stage.lastIndexOf(':b:') + 3);
                    if (siblings.some((row: any) => { const scene = JSON.parse(row.document).scene; return scene.sceneId !== stage && scene.sceneId.startsWith(prefix) && scene.bShotSource?.slot === source.slot; })) throw new Error('This B-shot already has a different saved map. Reload before choosing again.');
                    doc.scene.bShotSource = { identity: stage, slot: source.slot, prompt: source.prompt, frameUrl: source.frameUrl };
                } else if (action === 'quote' || action === 'start') {
                    if (ledger.draft) throw new Error('Finish or discard the recorded motion before generating videos.');
                    if (Object.values(ledger.actionImageEdits || {}).some(edit => edit.status === 'submitting' || edit.status === 'ready')) throw new Error('Finish reviewing the action image before generating videos.');
                    if (!ledger.world.approved || !doc.scene.connections.length) throw new Error('Approve the world and author at least one route.');
                    options = generationOptions(req.body.options, ledger.world);
                    const replacement = action === 'quote' && req.body.jobIds !== undefined;
                    if (req.body.routeId) {
                        const blocked = spatialRouteGenerationBlocker(doc.scene, req.body.routeId);
                        if (blocked) throw new Error(blocked);
                    }
                    const jobs = replacement ? replacementJobs(doc.scene, req.body.jobIds, options) : createJobs(doc.scene, options, req.body.routeId, req.body.sceneContext);
                    const quoteKey = generationQuoteKey(jobs, ledger.epoch, options, replacement);
                    if (action === 'quote') return { ...doc, quote: { key: quoteKey, pixels: jobs.reduce((sum, job) => sum + job.pixels, 0), jobs } };
                    if (req.body.quoteKey !== quoteKey) throw new Error('The quote changed. Review the new price before confirming.');
                    if (!jobs.length) throw new Error('All selected clips have already been queued or generated.');
                    if (jobs.some(job => job.kind !== 'action' && !savedSpatialGenerationGuidance(doc!.scene, job))) throw new Error('Process this motion before generating.');
                    for (const existing of ledger.jobs) if (!existing.options && doc.options) existing.options = { ...doc.options };
                    if (!ledger.generationStarted) ledger.epoch++;
                    ledger.jobs = refreshJobDependencies([...ledger.jobs, ...jobs]); ledger.generationStarted = true; ledger.boardOpen = true; doc.options = options;
                } else if (action === 'action-image-abandon') {
                    const edit = ledger.actionImageEdits?.[req.body.nodeId];
                    if (!edit || edit.id !== req.body.editId || edit.status !== 'submitting' || req.body.confirmation !== 'ABANDON' || (edit.startedAt && Date.now() - edit.startedAt < 600000)) throw new Error('Wait at least ten minutes, then confirm ABANDON to keep the original and release this interrupted edit.');
                    delete ledger.actionImageEdits![req.body.nodeId];
                } else if (action === 'action-image-apply' || action === 'action-image-discard') {
                    const node = doc.scene.nodes.find(n => n.id === req.body.nodeId);
                    const edit = ledger.actionImageEdits?.[req.body.nodeId];
                    const incoming = doc.scene.connections.find(e => e.kind === 'action' && e.targetNodeId === node?.id);
                    if (!node || !edit || edit.id !== req.body.editId || authoringLocked(ledger) || edit.status === 'submitting') throw new Error('This action image is unavailable or still running.');
                    if (action === 'action-image-discard') delete ledger.actionImageEdits![node.id];
                    else {
                        if (!incoming || edit.status !== 'ready' || doc.scene.connections.some(e => e.sourceNodeId === node.id) || node.frameUrl !== edit.original) throw new Error('The action has changed. Do not overwrite its descendants.');
                        node.frameUrl = https(req.body.imageUrl);
                        ledger.routes[incoming.id].forward.endAnchor = node.frameUrl;
                        edit.output = node.frameUrl; edit.status = 'applied';
                    }
                } else if (action === 'view') {
                    if (doc.scene.nodes.some(n => n.id === req.body.activeNodeId)) doc.scene.activeNodeId = req.body.activeNodeId;
                    if (req.body.view === 'video' || req.body.view === 'three') ledger.view = req.body.view;
                    if (typeof req.body.boardOpen === 'boolean') ledger.boardOpen = req.body.boardOpen;
                    doc.viewRevision = (doc.viewRevision || 0) + 1;
                } else if (action === 'delete') {
                    if (req.body.confirmation !== 'DELETE') throw new Error('Type DELETE to remove this scene’s generated videos.');
                    cancelled = ledger.jobs.filter(job => job.providerJobId && !['ready', 'failed', 'cancelled'].includes(job.status));
                    cancelled.push(...ledger.jobs.filter(job => job.upscale?.providerJobId && job.upscale.status === 'generating').map(job => ({ ...job, provider: 'replicate', providerJobId: job.upscale!.providerJobId, endpoint: job.upscale!.endpoint })));
                    for (const edge of doc.scene.connections) for (const direction of ['forward', 'backward'] as const) {
                        if (spatialNodeContext(doc.scene, direction === 'forward' ? edge.sourceNodeId : edge.targetNodeId)) {
                            const animation = ledger.routes[edge.id]?.[direction]; if (animation) delete animation.guidance;
                        }
                    }
                    delete ledger.nodeContexts;
                    ledger.epoch++; ledger.jobs = []; ledger.generationStarted = false; ledger.view = 'three';
                    doc.scene.connections = doc.scene.connections.map(edge => ({ ...edge, forward: null, backward: null, status: 'draft' }));
                    for (const node of doc.scene.nodes) {
                        const route = doc.scene.connections.find(edge => edge.targetNodeId === node.id);
                        if (route) node.frameUrl = ledger.routes[route.id].forward.endAnchor;
                    }
                    // Published readers must not retain deleted scene outputs. Other stages are untouched.
                    const published = await query('SELECT spatial_experience_json FROM posts WHERE id=? AND sender=? FOR UPDATE', [post, user]);
                    if (published[0]?.spatial_experience_json) {
                        const stored = published[0].spatial_experience_json;
                        const document = typeof stored === 'string' ? JSON.parse(stored) : stored;
                        // An unpublished preview can already have label metadata
                        // without a published stage graph.
                        if (Array.isArray(document.stages)) {
                            document.stages = document.stages.map((item: any) => item.id === stage ? { ...item, scene: doc!.scene, videoUrl: undefined } : item);
                            await query('UPDATE posts SET spatial_experience_json=? WHERE id=? AND sender=?', [JSON.stringify(document), post, user]);
                        }
                    }
                } else if (action === 'save-reference') {
                    const direction = req.body.direction;
                    if (!['forward', 'backward'].includes(direction)) throw new Error('Invalid motion direction.');
                    const animation = ledger.routes[req.body.routeId]?.[direction as 'forward' | 'backward'];
                    if (!animation || ledger.jobs.some(job => job.id === `${req.body.routeId}:${direction}`)) throw new Error('This motion has already been queued. Its references cannot change.');
                    if (req.body.animationId !== animation.id || req.body.worldRevision !== ledger.world.revision) throw new Error('The mapped motion changed. Prepare its reference again.');
                    const referencePlanKey = createHash('sha256').update(motionEvidencePlanText(animation.plan, ledger.world.aspectRatio || '16:9', animation.authoring)).digest('hex');
                    if (req.body.planKey && req.body.planKey !== referencePlanKey) throw new Error('The mapped motion changed. Prepare its reference again.');
                    const previousEnd = animation.endAnchor;
                    if (req.body.referenceVideo !== undefined) { animation.referenceVideo = https(req.body.referenceVideo); animation.referencePlanKey = referencePlanKey; }
                    if (req.body.startAnchor !== undefined) animation.startAnchor = https(req.body.startAnchor);
                    if (req.body.endAnchor !== undefined) animation.endAnchor = https(req.body.endAnchor);
                    if (req.body.motionEvidence) {
                        const aspectRatio = ledger.world.aspectRatio || '16:9';
                        animation.motionEvidence = validateMotionEvidence(req.body.motionEvidence, animation.id,
                            createHash('sha256').update(motionEvidencePlanText(animation.plan, aspectRatio, animation.authoring)).digest('hex'), animation.plan.duration, aspectRatio);
                    }
                    if (direction === 'forward' && req.body.endAnchor !== undefined) {
                        const edge = doc.scene.connections.find(item => item.id === req.body.routeId);
                        const node = doc.scene.nodes.find(item => item.id === edge?.targetNodeId);
                        if (node && (node.frameUrl === previousEnd || !previousEnd && node.frameUrl === animation.startAnchor)) node.frameUrl = animation.endAnchor;
                        const backward = ledger.routes[req.body.routeId]?.backward;
                        if (backward && (!backward.startAnchor || backward.startAnchor === previousEnd)) backward.startAnchor = animation.endAnchor;
                    }
                } else if (action === 'edit-prompt') {
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    const prompt = String(req.body.prompt || '').trim();
                    if (!req.body.jobId) {
                        const direction = req.body.direction;
                        if (!['forward', 'backward'].includes(direction)) throw new Error('Invalid motion direction.');
                        const animation = ledger.routes[req.body.routeId]?.[direction as 'forward' | 'backward'];
                        if (!animation || ledger.jobs.some(item => item.id === `${req.body.routeId}:${direction}`) || !prompt || prompt.length > 1100) throw new Error('This motion changed. Reopen its prompt editor.');
                        animation.prompt = prompt; animation.promptVersion = 2;
                        if (Object.prototype.hasOwnProperty.call(req.body, 'audioReference')) {
                            const reference = validateAudioReference(req.body.audioReference, animation.plan.duration);
                            if (animation.audioReference && animation.audioReference.url !== reference?.url) animation.audioReferenceHistory = [...(animation.audioReferenceHistory || []), animation.audioReference];
                            animation.audioReference = reference;
                        }
                        if (animation.guidance) animation.guidance = { ...animation.guidance, instruction: prompt, interpretation: undefined };
                    } else {
                    if (!job || ['preparing', 'submitting', 'generating', 'checking'].includes(job.status) || job.submissionUncertain || !prompt || prompt.length > 1100) throw new Error('Wait for this clip to finish, then save a prompt of up to 1100 characters.');
                    job.prompt = prompt; job.promptVersion = 2;
                    if (Object.prototype.hasOwnProperty.call(req.body, 'audioReference')) {
                        const reference = validateAudioReference(req.body.audioReference, job.duration || 5);
                        if (job.audioReference && job.audioReference.url !== reference?.url) job.audioReferenceHistory = [...(job.audioReferenceHistory || []), job.audioReference];
                        job.audioReference = reference;
                    }
                    if (job.guidance) job.guidance = { ...job.guidance, instruction: prompt, interpretation: undefined };
                    const animation = ledger.routes[job.connectionId]?.[job.direction];
                    if (animation) {
                        animation.audioReference = job.audioReference;
                        animation.prompt = prompt; animation.promptVersion = 2;
                        if (animation.guidance) animation.guidance = { ...animation.guidance, instruction: prompt, interpretation: undefined };
                    }
                    }
                } else if (action === 'regenerate') {
                    const selected = req.body.options ? generationOptions(req.body.options, ledger.world) : undefined;
                    const replacements = replacementJobs(doc.scene, req.body.jobIds ?? [req.body.jobId], selected);
                    const pixels = replacements.reduce((sum, job) => sum + job.pixels, 0);
                    if (req.body.confirmation !== replacements.map(job => job.id).join(',') || Number(req.body.pixels) !== pixels) throw new Error('Review the selected clips and their combined price before confirming replacements.');
                    if (req.body.jobIds !== undefined && req.body.quoteKey !== generationQuoteKey(replacements, ledger.epoch, selected, true)) throw new Error('The quote changed. Review the new price before confirming.');
                    for (const replacement of replacements) {
                        const job = ledger.jobs.find(item => item.id === replacement.id)!;
                        if (req.body.sceneContext && typeof req.body.sceneContext === 'object') job.sceneContext = Object.fromEntries(['imagePrompt', 'sceneIntent', 'videoPrompt'].map(key => [key, typeof req.body.sceneContext[key] === 'string' ? req.body.sceneContext[key].slice(0, 6000) : ''])) as SpatialJob['sceneContext'];
                        if (job.previousResult) job.resultHistory = [...(job.resultHistory || []), job.previousResult];
                        job.previousResult = { output: job.output!, actualEndFrame: job.actualEndFrame, prompt: job.prompt, model: job.model, pixels: job.pixels, options: job.options || doc.options, continuity: job.continuity, upscale: job.upscale, upscaleHistory: job.upscaleHistory, nodeContext: job.direction === 'forward' ? ledger.nodeContexts?.[job.targetNodeId] : undefined, completionAssets: job.completionAssets, completionError: job.completionError };
                        if (selected) { job.options = { ...selected }; job.model = selected.model; job.pixels = replacement.pixels; }
                        else if (!job.options && doc.options) job.options = { ...doc.options };
                        delete job.upscale;
                        delete job.upscaleHistory;
                        job.output = undefined; job.actualEndFrame = undefined; job.continuity = undefined;
                        delete job.completionAssets; delete job.completionError;
                        job.status = 'waiting-on-parent'; job.error = undefined; job.providerJobId = undefined; job.submissionToken = undefined; job.submissionStartedAt = undefined; job.submissionUncertain = undefined; job.attempt++;
                    }
                    ledger.boardOpen = true;
                    ledger.jobs = refreshJobDependencies(ledger.jobs);
                } else if (action === 'restore-result') {
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    if (!job?.previousResult || !['failed', 'checking', 'ready'].includes(job.status) || job.submissionUncertain) throw new Error('Wait for the replacement to finish before keeping the previous result.');
                    const blocked = spatialRegenerationBlocker(ledger.jobs, { ...job, previousResult: undefined });
                    if (blocked) throw new Error(blocked);
                    const previous = job.previousResult;
                    job.output = previous.output; job.actualEndFrame = previous.actualEndFrame; job.continuity = previous.continuity; job.upscale = previous.upscale; job.upscaleHistory = previous.upscaleHistory;
                    job.completionAssets = previous.completionAssets ? { ...previous.completionAssets, attempt: job.attempt, sourceOutput: job.output } : undefined;
                    job.completionError = previous.completionError;
                    if (job.direction === 'forward' && doc.scene.connections.some(edge => edge.id === job.connectionId && edge.kind === 'action')) {
                        if (previous.nodeContext) { ledger.nodeContexts ||= {}; ledger.nodeContexts[job.targetNodeId] = previous.nodeContext; }
                        else if (ledger.nodeContexts) delete ledger.nodeContexts[job.targetNodeId];
                    }
                    job.prompt = previous.prompt;
                    if (previous.model) job.model = previous.model;
                    if (previous.pixels !== undefined) job.pixels = previous.pixels;
                    if (previous.options) job.options = previous.options;
                    job.status = previous.continuity === 'approved' ? 'ready' : 'checking'; job.error = undefined; delete job.previousResult;
                    if (job.status === 'ready') {
                        const edge = doc.scene.connections.find(edge => edge.id === job.connectionId);
                        edge[job.direction] = { videoUrl: job.output, durationMs: job.duration * 1000, provider: 'api' };
                        if (job.direction === 'forward' && job.actualEndFrame) doc.scene.nodes.find(n => n.id === job.targetNodeId).frameUrl = job.actualEndFrame;
                    }
                    ledger.jobs = refreshJobDependencies(ledger.jobs);
                } else if (action === 'retry') {
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    if (!job || job.status !== 'failed' || job.output || job.submissionUncertain || job.error?.startsWith('Submission uncertain')) throw new Error('Only confirmed failed jobs can be retried.');
                    if (!spatialJobDependenciesReady(ledger.jobs, job)) throw new Error('Waiting for the previous video.');
                    if (req.body.sceneContext && typeof req.body.sceneContext === 'object') job.sceneContext = Object.fromEntries(['imagePrompt', 'sceneIntent', 'videoPrompt'].map(key => [key, typeof req.body.sceneContext[key] === 'string' ? req.body.sceneContext[key].slice(0, 6000) : ''])) as SpatialJob['sceneContext'];
                    const selected = req.body.options ? generationOptions(req.body.options, ledger.world) : undefined;
                    if (selected) {
                        const pixels = spatialVideoPixels(selected.model, selected.resolution, job.duration, job, selected.audio);
                        if (req.body.confirmation !== job.id || Number(req.body.pixels) !== pixels) throw new Error('Review this clip and its updated price before confirming a retry.');
                        job.options = { ...selected }; job.model = selected.model; job.pixels = pixels;
                    }
                    if (typeof req.body.prompt === 'string' && req.body.prompt.trim()) { job.prompt = req.body.prompt.trim().slice(0, 1100); job.promptVersion = 2; }
                    job.status = 'waiting-on-parent'; job.error = undefined; job.providerJobId = undefined; job.submissionToken = undefined; job.submissionStartedAt = undefined; job.submissionUncertain = undefined; job.attempt++;
                    ledger.jobs = refreshJobDependencies(ledger.jobs);
                } else if (action === 'upscale-complete') {
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    const upscale = job && [job.upscale, ...(job.upscaleHistory || [])].find(item => item?.status === 'ready' && item.output && (!req.body.submissionToken || item.submissionToken === req.body.submissionToken) && (!req.body.sourceOutput || item.output === req.body.sourceOutput));
                    if (req.body.epoch !== ledger.epoch || !upscale) throw new Error('The upscale belongs to a deleted, changed or incomplete job.');
                    upscale.output = https(req.body.videoUrl);
                    doc.scene.connections.find(edge => edge.id === job!.connectionId)[job!.direction].videoUrl = upscale.output;
                } else if (action === 'complete') {
                    if (req.body.epoch !== ledger.epoch) throw new Error('This completion belongs to a deleted generation.');
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    if (!job || job.status !== 'checking' || !job.output) throw new Error('This job is not ready for continuity review.');
                    if (job.output !== completedSourceOutput) throw new Error('The video result changed during state analysis.');
                    if (req.body.automatic && (req.body.attempt !== job.attempt || req.body.sourceOutput !== job.output)) throw new Error('This save belongs to an older video result.');
                    job.output = https(req.body.videoUrl); job.actualEndFrame = https(req.body.endFrame);
                    delete job.completionAssets; delete job.completionError; delete job.error;
                    job.continuity = 'approved'; job.status = 'ready';
                    if (!req.body.automatic) delete job.previousResult;
                    const edge = doc.scene.connections.find(edge => edge.id === job.connectionId);
                    if (edge.kind === 'action' && job.direction === 'forward') {
                        if (!completedContext) throw new Error('The completed action state is not ready.');
                        ledger.nodeContexts ||= {}; ledger.nodeContexts[job.targetNodeId] = completedContext;
                    }
                    edge[job.direction] = { videoUrl: job.output, durationMs: job.duration * 1000, provider: 'api' };
                    edge.status = 'ready';
                    if (job.direction === 'forward') doc.scene.nodes.find(n => n.id === job.targetNodeId).frameUrl = job.actualEndFrame;
                    ledger.jobs = refreshJobDependencies(ledger.jobs);
                    if (ledger.jobs.every(j => j.status === 'ready')) ledger.view = 'video';
                } else if (action === 'recover') {
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    if (!job || !['submitting', 'failed'].includes(job.status) || job.output) throw new Error('This job does not need submission recovery.');
                    if (!job.submissionToken) throw new Error('This older job has no recovery receipt. Keep it blocked until its provider status is verified.');
                    const receipts = await query("SELECT provider,provider_job_id,model_endpoint,status FROM media_generation_jobs WHERE user_id=? AND route='/spatial-video' AND action_label LIKE ? LIMIT 2", [user, `%spatial:${job.submissionToken}`]);
                    const receipt = receipts.length === 1 ? receipts[0] : null;
                    const spec = isSpatialVideoModel(job.model) ? spatialVideoModels[job.model] : null;
                    if (receipt && spec && receipt.provider === spec.provider && receipt.model_endpoint === spec.endpoint && receipt.provider_job_id) {
                        job.providerJobId = receipt.provider_job_id; job.provider = receipt.provider; job.endpoint = receipt.model_endpoint;
                        job.status = 'generating'; job.error = undefined; job.submissionUncertain = false;
                    } else {
                        job.submissionUncertain = true;
                        job.error = 'Submission uncertain — no acknowledged provider receipt is available yet. Recovery never submits or charges for a replacement. Check again or verify the request with provider support.';
                    }
                } else if (action === 'tick') {
                    ledger.jobs = refreshJobDependencies(ledger.jobs);
                    const job = ledger.jobs.find(j => j.id === req.body.jobId);
                    if (job?.status === 'queued') {
                        job.kind = doc.scene.connections.find(edge => edge.id === job.connectionId)?.kind === 'action' ? 'action' : 'movement';
                        job.prompt = effectiveSpatialClipPrompt({ ...job, guidance: undefined }); job.promptVersion = 2;
                        const all = await query('SELECT document FROM spatial_world_drafts WHERE user_id=?', [user]);
                        const running = all.flatMap((row: any) => JSON.parse(row.document).scene.ledger.jobs).filter((j: SpatialJob) => ['preparing', 'submitting', 'generating'].includes(j.status)).length;
                        if (running < 4) {
                            const parent = ledger.jobs.find(p => job.dependsOn.includes(p.id) && p.actualEndFrame);
                            if (parent?.actualEndFrame) job.startAnchor = parent.actualEndFrame;
                            // Returns use the actual generated forward endpoint and the actual original source.
                            if (job.direction === 'backward') job.endAnchor = ledger.jobs.find(j => j.id === `${job.connectionId}:forward`)!.startAnchor;
                            const guidance = savedSpatialGenerationGuidance(doc.scene, job);
                            if (job.kind !== 'action' && !guidance) {
                                job.status = 'failed'; job.error = 'Process this motion before generating.'; job.submissionUncertain = false;
                            } else {
                                // A job owns the options confirmed for its batch,
                                // retry or replacement. Later editor toggles cannot
                                // silently alter a queued request or sibling clip.
                                job.options = generationOptions(job.options || doc.options, ledger.world);
                                job.motionEvidence = ledger.routes[job.connectionId]?.[job.direction]?.motionEvidence;
                                job.guidance = guidance; job.status = 'submitting'; job.attempt++;
                                job.submissionToken = randomUUID(); job.submissionStartedAt = Date.now(); claimed = { ...job };
                            }
                        }
                    } else if (job?.status === 'preparing' && Date.now() - (job.preparationStartedAt || 0) > 900000) {
                        // Compatibility with an interrupted older preparation.
                        job.status = 'failed'; job.error = 'Motion preparation interrupted. Retry this clip.';
                        job.preparationStartedAt = undefined; job.submissionUncertain = false;
                        ledger.jobs = refreshJobDependencies(ledger.jobs);
                    } else if (job?.status === 'generating') claimed = { ...job };
                    epoch = ledger.epoch; options = job?.options || doc.options;
                } else throw new Error('Unknown spatial operation.');
                // View position is not an authored draft change. Arriving at a
                // node must not invalidate a concurrent save or generation quote.
                if (action !== 'view') doc.revision++;
            }
            await query('INSERT INTO spatial_world_drafts(user_id,post_id,stage_key,revision,document) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),document=VALUES(document)', [...args, doc.revision, JSON.stringify(doc)]);
            return doc;
        });
        if (cancelled.length) await Promise.allSettled(cancelled.map(cancelSpatialVideo));
        if (!claimed || !saved) return res.json(saved);
        const job = claimed;
        const providerResult = job.status === 'submitting'
            ? await invoke(withMediaBilling(submitSpatialVideo), req, '/spatial-video', { ...options, model: job.model, duration: job.duration, job: { ...job, ...(job.kind === 'action' ? { currentMotionContext: spatialNodeContext(saved.scene, job.sourceNodeId)?.motionContext } : {}) }, billingAction: job.direction === 'backward' ? 'return-video' : 'forward-video' })
            : await invoke(withMediaPollBilling(pollVideoStatus), req, '/pollVideoStatus', { provider: job.provider, jobId: job.providerJobId, modelEndpoint: job.endpoint, linkmode: true });
        for (const [name, value] of Object.entries(providerResult.headers)) res.setHeader(name, value);
        const updated = await withTransaction(async query => {
            const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
            const doc: Saved = JSON.parse(rows[0].document), ledger = doc.scene.ledger;
            const current = ledger.jobs.find(j => j.id === job.id);
            if (ledger.epoch !== epoch || !current || current.attempt !== job.attempt) {
                if (providerResult.body?.jobId) void cancelSpatialVideo({ ...job, providerJobId: providerResult.body.jobId, provider: providerResult.body.provider, endpoint: providerResult.body.modelEndpoint }).catch(() => {});
                return doc;
            }
            const response = providerResult.body;
            // A recovery poll may already have advanced this same attempt.
            // Its delayed submit acknowledgement must not roll the job back.
            if (job.status === 'submitting' && current.providerJobId && ['generating', 'checking', 'ready'].includes(current.status)) return doc;
            if (job.status === 'generating' && current.status !== 'generating') return doc;
            if (job.status === 'submitting') {
                if (providerResult.code === 200 && response?.jobId) {
                    current.providerJobId = response.jobId; current.provider = response.provider; current.endpoint = response.modelEndpoint; current.status = 'generating'; current.submissionUncertain = false;
                } else {
                    current.status = 'failed'; current.submissionUncertain = Boolean(response?.ambiguous); current.error = `${response?.ambiguous ? 'Submission uncertain — recover the saved provider receipt before retrying. ' : ''}${response?.message || response?.error || 'Submission failed.'}`;
                }
            } else if (providerResult.code === 200 && response?.status === 'succeeded') {
                current.output = response.videoUrl; current.status = 'checking'; current.continuity = 'needs-review';
            } else if (['failed', 'canceled'].includes(response?.status)) { current.status = 'failed'; current.error = String(response.error || 'Provider failed or was cancelled.'); }
            // Poll transport/balance errors retain the provider ID and never create a replacement job.
            else if (providerResult.code >= 400) current.error = String(response?.message || response?.error || 'Status unavailable; retry polling.');
            ledger.jobs = refreshJobDependencies(ledger.jobs); doc.revision++;
            await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
            return doc;
        });
        return res.json(updated);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Spatial state could not be saved.';
        if (action === 'complete' && completing) {
            const failedDocument = await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                if (!rows.length) return;
                const doc: Saved = JSON.parse(rows[0].document), job = doc.scene.ledger.jobs.find(item => item.id === req.body.jobId);
                if (doc.scene.ledger.epoch !== completing!.epoch || job?.status !== 'checking' || job.attempt !== completing!.attempt || job.output !== completing!.sourceOutput) return;
                job.completionError = message; job.error = `Action state analysis failed: ${message}`;
                doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
                return doc;
            }).catch(() => undefined);
            if (failedDocument) return res.status(409).json({ message, document: failedDocument });
        }
        if (action === 'prepare-guidance' && req.body.jobId) {
            // A failed refresh must not loop model calls every scheduler tick.
            // Keep the paid source video and expose the existing explicit retry.
            await withTransaction(async query => {
                const rows = await query('SELECT document FROM spatial_world_drafts WHERE user_id=? AND post_id=? AND stage_key=? FOR UPDATE', args);
                if (!rows.length) return;
                const doc: Saved = JSON.parse(rows[0].document), job = doc.scene.ledger.jobs.find(item => item.id === req.body.jobId);
                if (job?.status !== 'queued') return;
                job.status = 'failed'; job.error = `Motion state preparation failed: ${message}`; job.submissionUncertain = false;
                doc.scene.ledger.jobs = refreshJobDependencies(doc.scene.ledger.jobs); doc.revision++;
                await query('UPDATE spatial_world_drafts SET document=?,revision=? WHERE user_id=? AND post_id=? AND stage_key=?', [JSON.stringify(doc), doc.revision, ...args]);
            }).catch(() => {});
        }
        return res.status(409).json({ message });
    }
}
