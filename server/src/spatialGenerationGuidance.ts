import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { compileSpatialMotionContexts, refineSpatialMovementFromFrame } from './SpatialMotionContext';
import { effectiveSpatialClipPrompt, explicitSpatialClipPrompt } from './spatialClipPrompt';
import { worldAtState, spatialStateContextAt, type SpatialLedger, type SpatialJob } from './spatialWorld';
import { motionEvidencePlanText, validateMotionEvidence } from './spatialMotionEvidence';
import { spatialControlledIdentity } from './spatialContinuity';

type Scene = { sceneId: string; connections: Array<{ id: string; kind?: string; sourceNodeId: string; targetNodeId: string; actionPrompt?: string }>; ledger: SpatialLedger };

export function spatialDraftGuidanceInput(scene: Scene, direction: 'forward' | 'backward', sceneContext?: SpatialJob['sceneContext']) {
    const draft = scene.ledger.draft, animation = draft?.[direction];
    if (!draft || draft.kind !== 'movement' || !animation) throw new Error('This recorded movement is unavailable.');
    const routeId = `draft-${draft.forward!.id}`, targetNodeId = `${routeId}-end`;
    const parent = scene.connections.find(edge => edge.targetNodeId === draft.sourceNodeId);
    const authored: Scene = { ...scene,
        connections: [...scene.connections, { id: routeId, kind: 'movement', sourceNodeId: draft.sourceNodeId, targetNodeId }],
        ledger: { ...scene.ledger, routes: { ...scene.ledger.routes, [routeId]: { connectionId: routeId, worldRevision: scene.ledger.world.revision, forward: draft.forward!, backward: draft.backward } } },
    };
    const job = { id: `${routeId}:${direction}`, connectionId: routeId, direction, kind: 'movement',
        sourceNodeId: direction === 'forward' ? draft.sourceNodeId : targetNodeId,
        dependsOn: direction === 'backward' ? [`${routeId}:forward`] : parent ? [`${parent.id}:forward`] : [],
        prompt: animation.prompt, promptVersion: animation.promptVersion, creatorInstruction: animation.creatorInstruction,
        duration: animation.plan.duration, sceneContext: sceneContext || scene.ledger.world.sceneContext } as SpatialJob;
    return { scene: authored, job, animation };
}

// Invoke the EXISTING spatial compiler/refiner, not a second prompt engine.
// No HTTP loopback, document mutation, provider submission or separate Pixel
// deduction: this runs while processing/saving the authored motion, never in
// the provider dispatcher. Actual generated frame URLs are bound separately.
async function guidanceCall(handler: (req: Request, res: Response) => Promise<any>, body: Record<string, unknown>) {
    let status = 200, result: any;
    const response = { status(code: number) { status = code; return this; }, send(value: unknown) { result = value; return this; } };
    await handler({ body } as Request, response as unknown as Response);
    if (status !== 200 || !result) throw new Error(result?.error || result?.message || 'Could not prepare spatial guidance.');
    return result;
}

/** Same graph boundary as resolveSpatialMotionContext at 218277e/c24153e. */
export function spatialNodeContext(scene: Scene, nodeId: string): NonNullable<SpatialLedger['nodeContexts']>[string] | undefined {
    return spatialStateContextAt(scene, nodeId);
}

const stateRefreshes = new Map<string, Promise<NonNullable<SpatialLedger['nodeContexts']>[string]>>();
/** Generated FINAL FRAME is authoritative. Do not pass plannedState here:
 * that would make the existing compiler treat it as original appearance. */
export async function prepareSpatialPostActionContext(scene: Scene, job: SpatialJob, frameUrl: string) {
    const savedWorld = scene.ledger.world, edge = scene.connections.find(edge => edge.id === job.connectionId);
    if (edge?.kind !== 'action' || job.direction !== 'forward') return undefined;
    const targetState = scene.ledger.states[job.targetNodeId] || scene.ledger.routes[job.connectionId]?.forward.endState;
    const world = targetState ? worldAtState(savedWorld, targetState) : savedWorld;
    const identity = spatialControlledIdentity(world);
    const completedAction = edge.actionPrompt || job.creatorInstruction || job.prompt;
    const key = `post-action-frame-v3:${createHash('sha256').update(JSON.stringify([scene.sceneId, job.targetNodeId, job.attempt, frameUrl, completedAction, identity])).digest('hex')}`;
    const saved = scene.ledger.nodeContexts?.[job.targetNodeId]; if (saved?.key === key) return saved;
    let pending = stateRefreshes.get(key);
    if (!pending) {
        pending = (async () => {
            const context = job.sceneContext || world.sceneContext;
            const compiled = await guidanceCall(compileSpatialMotionContexts, {
                llmTier: scene.ledger.routes[job.connectionId]?.forward.model || world.model,
                globalIntent: { controlledSubject: identity.controlledSubject, primarySubjectName: identity.primarySubjectName, sceneIntent: context?.sceneIntent || world.prompt },
                scenes: [{ sceneId: scene.sceneId, nodeId: job.targetNodeId,
                    sceneIntent: context?.sceneIntent || world.prompt || `Preserve ${world.drivenName || world.controlledObject}.`,
                    videoPrompt: `THIS ACTION HAS COMPLETED. INFER ONLY THE PERSISTENT STATE AT ITS FINAL FRAME: ${completedAction}`,
                    stateMode: 'post-action', completedAction, finalFrameUrl: frameUrl,
                    previousMotionContext: spatialNodeContext(scene, job.sourceNodeId)?.motionContext || job.guidance?.motionContext }],
            });
            const motionContext = compiled.contexts?.[0];
            if (!motionContext?.controlledSubject || !motionContext.primaryMotion || !motionContext.ambientMotion) throw new Error('The action state compiler returned incomplete context.');
            return { key, frameUrl, motionContext };
        })();
        stateRefreshes.set(key, pending);
        void pending.catch(() => { if (stateRefreshes.get(key) === pending) stateRefreshes.delete(key); });
        if (stateRefreshes.size > 64) stateRefreshes.delete(stateRefreshes.keys().next().value!);
    }
    return pending;
}

export function spatialGenerationGuidanceInput(scene: Scene, job: SpatialJob) {
    const animation = scene.ledger.routes[job.connectionId]?.[job.direction];
    if (!animation) throw new Error('This motion reference is missing.');
    const world = worldAtState(scene.ledger.world, animation.sourceState);
    const identity = spatialControlledIdentity(world, animation.plan);
    const controlled = animation.plan.objects.find(object => object.id === world.controlledObject);
    if (!controlled) throw new Error('The controlled subject is missing from this motion.');
    // Prepared prose is output, never an instruction to re-interpret itself.
    const edited = effectiveSpatialClipPrompt({ ...job, guidance: undefined });
    const creatorInstruction = /^Follow the (?:return )?motion reference from its start to its end\.$/.test(edited)
        ? job.creatorInstruction || animation.creatorInstruction || ''
        : edited;
    const aspectRatio = world.aspectRatio || '16:9';
    const motionEvidence = animation.motionEvidence && validateMotionEvidence(animation.motionEvidence, animation.id,
        createHash('sha256').update(motionEvidencePlanText(animation.plan, aspectRatio, animation.authoring)).digest('hex'), animation.plan.duration, aspectRatio);
    const nodeContext = spatialNodeContext(scene, job.sourceNodeId);
    const currentFrame = nodeContext ? job.dependsOn.map(id => scene.ledger.jobs.find(parent => parent.id === id)?.actualEndFrame).find(Boolean) || nodeContext.frameUrl : undefined;
    const referenceMotion = {
        units: 'meters', controlledObject: world.controlledObject,
        controlledSubject: identity.controlledSubject, primarySubjectName: identity.primarySubjectName, controlMode: world.controlMode,
        direction: job.direction, stateEvidence: nodeContext ? 'actual-frame' : 'authored-world',
        duration: animation.plan.duration, trajectory: controlled.keys,
        projectionCamera: animation.plan.camera, cameraInstruction: animation.plan.cameraInstruction, aspectRatio: world.aspectRatio,
        landmarks: animation.plan.objects.filter(object => object.id !== world.controlledObject).map(object => ({ id: object.id, start: object.keys[0], end: object.keys.at(-1) })),
        sourceState: animation.sourceState, endState: animation.endState,
        motionEvidence, objects: animation.plan.objects, stateChanges: animation.stateChanges,
        walkable: world.walkable, obstacles: world.obstacles, sourceLayout: world.sourceLayout,
        identityReferences: animation.references || world.references,
        controlledIdentity: identity,
    };
    const sourceEdge = scene.connections.find(edge => edge.targetNodeId === job.sourceNodeId);
    const parentContext = nodeContext?.motionContext || job.dependsOn.map(id => scene.ledger.jobs.find(parent => parent.id === id)?.guidance?.motionContext).find(Boolean)
        || (sourceEdge && scene.ledger.routes[sourceEdge.id]?.forward.guidance?.motionContext);
    let node = job.sourceNodeId;
    let completedAction = '';
    const completedActions: string[] = [];
    const visited = new Set<string>();
    while (!visited.has(node)) {
        visited.add(node);
        const parent = scene.connections.find(edge => edge.targetNodeId === node);
        if (!parent) break;
        if (parent.kind === 'action') {
            const action = parent.actionPrompt || scene.ledger.routes[parent.id]?.forward.creatorInstruction || scene.ledger.routes[parent.id]?.forward.prompt || '';
            if (!completedAction) completedAction = action;
            if (action) completedActions.unshift(action);
        }
        node = parent.sourceNodeId;
    }
    // Actual generated frame URLs are bound at submission, not a reason to
    // discard the intelligence already prepared for this immutable 3D route.
    const forwardInstruction = job.direction === 'backward' ? scene.ledger.routes[job.connectionId]?.forward.guidance?.instruction : undefined;
    const key = createHash('sha256').update(JSON.stringify({ version: 3, nodeContextKey: nodeContext?.key, currentFrame, animationId: animation.id, direction: job.direction, creatorInstruction, referenceMotion, completedAction, completedActions, forwardInstruction, sceneContext: job.sceneContext || world.sceneContext, worldRevision: world.revision })).digest('hex');
    return { key, animation, creatorInstruction, referenceMotion, completedAction, completedActions, forwardInstruction, parentContext, nodeContext, currentFrame };
}

export function savedSpatialGenerationGuidance(scene: Scene, job: SpatialJob): SpatialJob['guidance'] {
    if (job.kind === 'action') return undefined;
    const input = spatialGenerationGuidanceInput(scene, job);
    // The mapped animation owns its approved instruction. Later scene text,
    // generation options or actual frame binding must not reinterpret it.
    const prepared = input.nodeContext ? [input.animation.guidance, job.guidance].find(guidance => guidance?.key === input.key)
        : input.animation.guidance || (job.guidance?.key === input.key ? job.guidance : undefined);
    const edited = explicitSpatialClipPrompt(job);
    if (!edited) return prepared;
    // A prompt edit is the final creator instruction, not input to another AI
    // rewrite. Keep the existing control context for subsequent movements.
    const world = worldAtState(scene.ledger.world, input.animation.sourceState);
    return { key: input.key, instruction: edited, motionContext: prepared?.motionContext || input.parentContext || {
        controlledSubject: spatialControlledIdentity(world).controlledSubject, controlMode: world.controlMode,
        primaryMotion: world.motionStyle, ambientMotion: '',
    } };
}

const guidanceFlights = new Map<string, Promise<SpatialJob['guidance']>>();
export async function prepareSpatialGenerationGuidance(scene: Scene, job: SpatialJob): Promise<SpatialJob['guidance']> {
    if (job.kind === 'action') return undefined;
    const key = spatialGenerationGuidanceInput(scene, job).key;
    const existing = guidanceFlights.get(key); if (existing) return existing;
    const result = buildSpatialGenerationGuidance(scene, job); guidanceFlights.set(key, result);
    try { return await result; } finally { if (guidanceFlights.get(key) === result) guidanceFlights.delete(key); }
}
async function buildSpatialGenerationGuidance(scene: Scene, job: SpatialJob): Promise<SpatialJob['guidance']> {
    if (job.kind === 'action') return undefined; // Keep the creator's existing action prompt intact.
    const input = spatialGenerationGuidanceInput(scene, job);
    const prepared = savedSpatialGenerationGuidance(scene, job);
    if (prepared) return prepared;
    const world = worldAtState(scene.ledger.world, input.animation.sourceState);
    const identity = spatialControlledIdentity(world);
    const subject = identity.controlledSubject;
    const context = job.sceneContext || world.sceneContext;
    const sceneIntent = `Control only ${subject}. ${context?.sceneIntent || ''} ${world.motionStyle || ''} Preserve the supplied current state.`;
    const videoPrompt = context?.videoPrompt || context?.imagePrompt || world.prompt || sceneIntent;
    const contexts = input.parentContext ? undefined : await guidanceCall(compileSpatialMotionContexts, { llmTier: input.animation.model || world.model,
        globalIntent: { controlledSubject: subject, primarySubjectName: identity.primarySubjectName, sceneIntent, imagePrompt: context?.imagePrompt },
        scenes: [{ sceneId: scene.sceneId, nodeId: job.sourceNodeId, sceneIntent,
            videoPrompt,
            stateMode: input.completedAction ? 'planned-action' : 'scene-root', completedAction: input.completedAction,
            plannedState: input.animation.sourceState, finalFrameUrl: world.sourceImage, previousMotionContext: input.parentContext, referenceMotion: input.referenceMotion }],
    });
    const motionContext = input.parentContext || contexts.contexts[0];
    // Port the forward/return declarations from EditStory.tsx at c24153e.
    // Three.js replaces recorded-stick evidence; it does not replace the old
    // controlled-subject rules or authentic physical-return instructions.
    const controlData = [
        'SPATIAL CONTROL DATA (reasoning input only; do not copy its directional words):',
        `Controlled subject: ${motionContext.controlledSubject}`,
        'AUTHORED THREE.JS MOVEMENT:',
        'Follow referenceMotion.sourceState, its recorded trajectory, and referenceMotion.endState in that order.',
        "Infer the controlled unit's scene-relative route from the image. Attached riders, passengers and carried items belong to that unit. Preserve their identities and current state. Other subjects keep their independent state unless the creator explicitly choreographs their behavior; honor that choreography without making them follow joystick motion automatically.",
    ].join('\n');
    const forward = scene.ledger.routes[job.connectionId]?.forward;
    const forwardCreatorInstruction = forward && (explicitSpatialClipPrompt(forward) || forward.creatorInstruction);
    const movementText = job.direction === 'backward' ? [
        'AUTHENTIC SPATIAL RETURN:',
        'Generate a newly performed physical return to the exact previous-node state. Never reverse or rewind the forward clip.',
        'Use scene geometry and control mode to choose believable mechanics: turn and travel back, reverse or turn a vehicle, coordinate rider and mount, or retreat a POV with correct parallax and obstacle avoidance.',
        forwardCreatorInstruction ? `Creator's forward state/action to physically undo: ${forwardCreatorInstruction}. Do not repeat this forward command. Infer its natural inverse unless the creator explicitly included a separate return/backward clause; only that explicit return clause has highest return priority.` : '',
        controlData,
        input.forwardInstruction ? `Full forward instruction as context for the physical return: ${input.forwardInstruction}` : '',
    ] : [input.creatorInstruction ? `Creator instruction: ${input.creatorInstruction}` : '', controlData];
    if (input.completedActions.length) movementText.push(`These actions have already finished. Preserve their current outcomes in sourceState: ${input.completedActions.join('; ')}`);
    const refined = await guidanceCall(refineSpatialMovementFromFrame, { llmTier: input.animation.model || world.model,
        sceneId: scene.sceneId, sceneIntent, videoPrompt, motionContext,
        imageUrl: input.currentFrame || world.sourceImage,
        durationSeconds: job.duration, userInstruction: job.direction === 'backward' ? undefined : input.creatorInstruction,
        referenceMotion: input.referenceMotion, movementText: movementText.filter(Boolean).join('\n'),
    });
    return { key: input.key, instruction: refined.instruction, interpretation: refined.interpretation, motionContext };
}
