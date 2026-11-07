import { adoptSceneBuild, reconcileSceneOutcome, scenePerformanceInstructions } from './sceneBuildAuthoring';
import { expandScenePlan, sceneRecipeInstructions } from './sceneRecipes';
import { createAuthoringDraft, evaluateAuthoringDraft, type SceneAuthoringDraft } from './sceneAuthoring';
import { bindWorldRigs } from './sceneRig';
import { validateScenePerformance } from './scenePerformance';
import { motionSceneInstructions } from './motionSceneInstructions';
import { prepareMotionBlockout } from './motionBlockout';
import { blockoutAuthoringInstructions } from './motionBlockoutAuthoring';
import type { Request, Response } from 'express';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { createRoutedTextClient } from './textGeneration';
import { handleLiveRequest, registerLivePreparer, type LiveSpec } from './liveSceneBuilds';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { languageModelForTier } from './languageModels';
import { spatialHelperPrice } from './spatialHelperPricing';
import { spatialPlanningInference } from './spatialPlanningInference';
import { providerPixelsSince, providerUsageCursor, recordOpenAiUsage, recordPixelCharge } from './aiUsageLedger';
import {
    accumulateMeteredUsage,
    buildMeteredSessionKey,
    checkMeteredZeroBalanceGuard,
    rawPixelsToSubunits,
    settleMeteredSession,
    SUBUNITS_PER_PIXEL,
} from './meteredUsageBilling';
import { isPlanningTier, spatialAssetReferences, validateWorld, planAtState, stateAtEnd, worldAtState, cloneWorld, type SpatialWorld, type WorldState } from './spatialWorld';
import { validateMotionPlan } from './motionGuidePlan';
import { prepareSpatialReconstruction } from './spatialReconstruction';
import { prepareSpatialMotion } from './spatialMotion';
import { spatialClipPrompt } from './spatialClipPrompt';
import { frameSceneSubjects, sceneCalibrationIssues, validateSceneLayout, type SceneLayout } from './spatialSceneCalibration';

const system = `Return strict JSON, never code. Build a bounded, inspectable low-poly spatial mock-up whose VISIBLE layout matches the source image: camera perspective, framing, relative scale, actors and furniture placement. Simplify surface detail, never substitute a generic room or omit chairs, tables or other usable landmarks. Use meters, seconds, Y up, Euler XYZ radians. Geometry is centered unit box/sphere/cylinder/cone; sphere radius .5, cylinder/cone radius .5 height 1. Include all visible actors, props and ground with meaningful stable IDs; there is no fixed object-count cap. Use economical low-poly geometry. Every object has color #rrggbb and keys {t,position:[x,y,z],rotation:[x,y,z],scale:[x,y,z]}; camera keys {t,position,target,fov}. Each track spans t=0 to t=5 in 2-48 increasing keys. Positions within +/-100, positive scale <=100, fov 15-100. Ground must support actors. Solve the source camera from horizon, vanishing lines, visible surfaces and measured sourceLayout; camera fov is VERTICAL at supplied aspectRatio. Reproject every landmark to its measured normalized image box, preserving overlap order and contact with the ground. Preserve sourceLayout IDs as root object IDs. Infer visible depth, obstacles and walkable bounds. Never invent guaranteed hidden geometry.
Objects may have parts:[{id,shape,color,keys}] with the local primitive parts needed for a readable solid silhouette; there is no fixed part-count cap. When parts exist they REPLACE the root primitive visually; the object root remains the shared position/rotation/scale. Part keys use immediate-parent-local coordinates within +/-100 and scale .01-100, with the same full-duration timeline. Build simple connected solid proxies for people and creatures showing occupied space, pose, facing, scale and motion-relevant branches. Use shared joints underneath to connect and animate their solid parts. Omit cosmetic cape, armor and decoration. Vehicles and other rigid moving objects remain solid primitive assemblies even with role:"actor"; retain a car's body, cabin and wheels. For newly built compound objects use root scale [1,1,1], keeping local measurements in meters. Boxes are the base, with other suitable primitives for curved or broad shapes; do not force every asset into boxes or expose its skeleton by default. Avoid photorealism, textures, meshes from URLs and costly detail. Capture visible equipment, mounts and riders with stable identities and held/riding relationships in initialState. ${motionSceneInstructions} Match visible placement, proportions and camera composition carefully. Animate local limbs for walking and actions without changing asset identities.
For reconstruction return {plan:{version:1,duration:5,background,objects,camera},controlledObject,controlMode,motionStyle,walkable:[{min:[x,y,z],max:[x,y,z]}],obstacles:[{min,max}],initialState:{conditions:{},relationships:[],objects:{ID:{facts:{},assets:[]}}}}. controlMode is character/vehicle/mounted/pov/other. Also return locomotion:{kind:"ground"|"air"|"water"|"vehicle",vertical:boolean,speed:number,turnRate:number}. Infer capabilities of the actual driven unit from the image and scene intent: flying/swimming units allow vertical movement, ordinary ground movement does not. Speed is .1–10 world units per second; turnRate is .1–6 radians per second. Prefer existing .65 walking or 1.2 riding/driving defaults unless the subject/context warrants a different speed. Keep the driven identity unchanged. Static objects, parts and camera repeat initial keys. Exclude ground and controlled actor from obstacles. Honor correction text and preserve unaffected objects.
For movement/action return {plan,conditions,relationships,objectFacts,stateChanges}. plan uses the same schema. Start every object and camera at supplied sourceState. Prefer stable object/part IDs and the saved geometry for continuity; existing tracks may omit shape/color/parts to reuse the saved asset. You may add or change renderable geometry where the performance needs it; the creator will preview the result. Do not redraw every anatomical part unnecessarily. Animate secondary figures according to creator context. For movement preserve the supplied recorded controlled-object trajectory exactly. Preserve recorded camera unless the creator explicitly requests camera movement: then set plan.cameraInstruction to the exact camera clause copied verbatim from prompt and author matching camera keys from sourceState.camera. Do not invent a camera request. Preserve camera continuity into the endpoint. For action choreograph the prompt with no predefined inventory or object rules. Conditions and objectFacts are complete flexible semantic facts AFTER this action; relationships are {from,to,relation,facts}. Do not undo earlier actions implicitly.
For return, separately animate turning then travel to the specified destination pose over 5 seconds. This is a new physical performance, never a video reversal. Preserve all semantic facts from the forward end unless the creator explicitly asks for changes. End the controlled subject and camera at the supplied destination transforms.`;

// The same concrete primitive format used by Motion Guide, including root
// shape/color even for compound groups. These fields are not optional.
const formatExample = JSON.stringify({ plan: { version: 1, duration: 5, background: '#DCE2EC', objects: [{ id: 'subject', shape: 'box', color: '#BBC3D2', keys: [0, 5].map(t => ({ t, position: [0, .5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) }], camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, .5, 0], fov: 45 })) }, controlledObject: 'subject', controlMode: 'character', motionStyle: 'walk', walkable: [{ min: [-5, 0, -5], max: [5, 2, 5] }], obstacles: [] });
const sceneSystem = `${system}\nComplete reconstruction format example (replace its contents with the actual scene, never return this example as a fallback): ${formatExample}\nEvery root needs id, shape, color and keys, including roots with parts. IDs use letters, digits, underscore or hyphen, at most 48 characters. Root scale is 0.01–100; rotations are within +/-32. Empty optional parts must be omitted. context contains relevant existing scene information; prompt is the additional instruction, not a replacement for context. The first image is the scene composition; additional named asset images establish identity only. If drivenName is supplied, keep that subject as the persistent identity; if riding, controlledObject is its attached outer moving mount, never discard the rider. If assets are absent, infer the subject from the scene image and context; do not require asset selection.`;

// Movement locks the outer travel track; requested body performances belong
// in local part animation so preserving the recording does not discard them.
const movementPerformanceInstructions = `MOVEMENT PERFORMANCE: prompt is the creator's current additional instruction. If it requests a posture or body action different from the source image or older context, perform that change during this motion; sourceState is the starting pose, not a requirement to hold that pose throughout. For example, a crouched subject asked to stand up must visibly unfold into a standing pose along the recorded travel path.
Copy the controlled object's recorded root position, rotation and scale keys exactly, including deliberate full turns, pitch and roll. The application preserves these outer root keys, so a body action authored only by changing the root or semantic metadata will not appear. Animate it with the existing parts' LOCAL keys: torso/pelvis, head and all affected limbs or other actual body parts, with connected joints and intermediate keys for the transition. Preserve stable IDs, appearance, attachments and unaffected parts. If the saved root has no articulated parts, you may add the minimal connected local parts needed for the requested performance. Do not require a separate action to combine a body performance with recorded travel. The endpoint must contain the requested resulting pose, with corresponding conditions/objectFacts when appropriate. Do not ignore explicit body choreography merely because the operation is movement.`;

const actionCorrectionInstructions = `ACTION CORRECTION: existingPlan is the generated performance to edit, not a recording of a new action. correction is the requested change to that performance. Keep sourceState as its ORIGINAL starting state; never begin at existingEndState or repeat the action after its endpoint. Preserve every unaffected object's and part's geometry, stable ID, animation keys, timing, camera and resulting semantic state. Modify only the affected performance and any changes required for its physical consistency. Unmentioned tracks inherit existingPlan. Honor the selected duration, scaling unaffected timing proportionally only when the duration changes. existingEndState and existingStateChanges describe its prior outcomes: carry across unaffected conditions, relationships, held/riding state and object facts, while applying explicit releases or other requested changes. Return the complete corrected plan and complete resulting conditions, relationships and objectFacts. Also return creatorInstruction: a concise description of the corrected action for video generation, preserving the original prompt except for the requested correction. Do not describe the correction process itself.`;


type SpatialPrepared = { spec: LiveSpec; chargeWithRaw?: (rawPixels?: number | null) => Promise<Record<string, unknown>>; identify?: undefined } | { identify: true; model: string; content: OpenAI.Chat.Completions.ChatCompletionContentPart[] };

class RouteError extends Error { constructor(message: string, readonly status: number) { super(message); } }

/**
 * Validate the request and build the model call plus its finalizer. Shared by
 * the ordinary JSON route and live construction so both validate, price and
 * process results identically.
 */
async function prepareSpatialPlan(user: string, body: any): Promise<SpatialPrepared> {
    if (!isPlanningTier(body.llmTier) || !['identify', 'reconstruct', 'movement', 'action', 'return'].includes(body.operation)
        || typeof body.prompt !== 'string' || body.prompt.length > 30000) throw new RouteError('Invalid spatial planning request.', 400);
    const correctingAction = body.existingPlan !== undefined;
    if ((correctingAction || body.correction !== undefined) && (body.operation !== 'action' || !correctingAction
        || typeof body.correction !== 'string' || !body.correction.trim() || body.correction.length > 30000)) throw new RouteError('A generated action and correction are required.', 400);
    const meteredAvailable = typeof providerPixelsSince === 'function' && typeof providerUsageCursor === 'function';
    const model = languageModelForTier(body.llmTier), price = meteredAvailable ? 1 : spatialHelperPrice(body.llmTier);
    try {
        if (!(await checkMeteredZeroBalanceGuard(user, price)).allowed) throw new RouteError(`Planning needs ${price} P.`, 402);
        let world: SpatialWorld | undefined;
        if (body.world) world = validateWorld(body.world);
        const recorded = body.recorded ? validateMotionPlan(body.recorded) : undefined;
        const existingPlan = correctingAction ? validateMotionPlan(body.existingPlan) : undefined;
        const duration = body.operation === 'action' ? Number(body.duration ?? existingPlan?.duration ?? recorded?.duration ?? 5) : 5;
        if (!Number.isFinite(duration) || duration < 2 || duration > 15) throw new Error('Choose a supported action duration in the video timer.');
        if (!['identify', 'reconstruct'].includes(body.operation) && (!world || !recorded || !body.sourceState)) throw new Error('A world and recorded source motion are required.');
        const references = spatialAssetReferences(body.references ?? world?.references);
        // Actions use the current node, including earlier actions and moved props.
        // The original image supplies appearance, not an instruction to reset poses.
        const planningWorld = body.operation === 'action' && world
            ? { ...world, plan: planAtState(world, body.sourceState, duration), initialState: cloneWorld(body.sourceState) }
            : world;
        const primarySubjectName = typeof body.primarySubjectName === 'string' ? body.primarySubjectName.trim().slice(0, 160) : world?.primarySubjectName || body.drivenName || world?.drivenName;
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: JSON.stringify({ operation: body.operation, duration, prompt: body.prompt, context: body.context, drivenName: body.drivenName || world?.drivenName, primarySubjectName, linkedState: body.operation === 'reconstruct' ? body.linkedState : undefined, references, aspectRatio: body.aspectRatio, world: planningWorld, recorded, sourceState: body.sourceState, destinationState: body.destinationState,
            ...(existingPlan ? { existingPlan, correction: body.correction.trim(), existingEndState: body.existingEndState, existingStateChanges: body.existingStateChanges } : {}) }) }];
        content.push({ type: 'text', text: JSON.stringify({ requirement: 'primarySubjectName is the persistent story identity, not necessarily the outer moving root. drivenName is this scene’s selected controllable subject/unit. Preserve the primary character and their current inventory and relationships when they drive, ride, carry, or leave another unit. Use visible/current state and explicit instructions to establish attachments: selecting a car alone does not prove anyone is inside it. A rider/driver and carrier move together via attachment or identifiable parts; leaving releases that same actor so control can return to them. linkedState, when supplied, contains the exact authored predecessor’s semantic state, not positions in this new scene. Preserve its unchanged outcomes, reconcile identities using references, and let the new scene image and explicit creator instructions establish placement and any intended state changes. Never create an unseen person just because their reference is supplied.' }) });
        if (body.currentStateContext) {
            const state = body.currentStateContext;
            if (['controlledSubject', 'controlMode', 'primaryMotion', 'ambientMotion'].some(key => typeof state[key] !== 'string' || state[key].length > 6000)) throw new Error('Invalid current action state context.');
            content.push({ type: 'text', text: JSON.stringify({ currentStateContext: Object.fromEntries(['controlledSubject', 'controlMode', 'primaryMotion', 'ambientMotion'].map(key => [key, state[key]])),
                requirement: 'This persistent state was compiled from the actual generated final frame. Preserve its identity, equipment and mounted relationships at the start. The new creator instruction may explicitly change that state; do not repeat the completed action. Keep the supplied chronological transforms and recorded route.' }) });
        }
        if (body.image) {
            if (typeof body.image !== 'string' || body.image.length > 8000 || new URL(body.image).protocol !== 'https:') throw new Error('A saved HTTPS scene image is required.');
            content.push({ type: 'image_url', image_url: { url: body.image, detail: 'high' } });
        }
        for (const reference of references) content.push({ type: 'text', text: `Appearance reference: @${reference.name}` }, { type: 'image_url', image_url: { url: reference.imageUrl, detail: 'high' } });
        if (body.operation === 'identify') return { identify: true, model, content };
        if (body.operation === 'reconstruct' && !body.image) throw new Error('A scene image is required for reconstruction.');
        const request = { model, max_completion_tokens: 60000, ...spatialPlanningInference(body.llmTier),
            response_format: { type: 'json_object' as const }, messages: [{ role: 'system' as const, content: `${sceneSystem}\n${sceneRecipeInstructions}\n${scenePerformanceInstructions}\nFor THIS request the full timeline is 0 to ${duration} seconds and plan.duration must be ${duration}. This overrides the five-second example for actions. Pace the entire requested performance across that selected duration.${body.operation === 'action' ? ' The action begins at the CURRENT supplied world/sourceState. Use the image for appearance only; do not reset the subject or props to their image positions.' : ''}${body.operation === 'reconstruct' ? blockoutAuthoringInstructions : ''}${body.operation === 'movement' ? `\n${movementPerformanceInstructions}` : ''}${existingPlan ? `\n${actionCorrectionInstructions}` : ''}` }, { role: 'user' as const, content }] };
        const sourceKey = `spatial:${String(body.liveTargetKey || world?.revision || 'draft')}`;
        const suppliedAuthoring = body.authoringContext ? validateScenePerformance({ plan: body.authoringContext.plan, authoring: body.authoringContext }).authoring : undefined;
        const baseAuthoring = body.operation === 'return' ? undefined : suppliedAuthoring;
        const adoptCheckpoint = (raw: any, current?: SceneAuthoringDraft, pinned: readonly string[] = []) => {
            const plan = expandScenePlan(raw.plan || raw);
            const initial = current || baseAuthoring || createAuthoringDraft(plan, sourceKey, bindWorldRigs(plan), body.sourceState);
            const authoring = adoptSceneBuild(raw, sourceKey, initial, pinned, plan);
            return { plan: authoring.plan, authoring };
        };
        const finalize = (raw: any, _meta?: any, acceptedAuthoring?: SceneAuthoringDraft) => {
            raw = { ...raw, plan: expandScenePlan(raw?.plan) };
            let result: any;
            if (body.operation === 'reconstruct') {
                let sourceLayout: SceneLayout | undefined;
                const sceneContext = Object.fromEntries(['imagePrompt', 'sceneIntent', 'videoPrompt'].map(key => [key, typeof body.context?.[key] === 'string' ? body.context[key].slice(0, 6000) : '']));
                // Validate renderability, not visual agreement with estimated boxes.
                // Every renderable result reaches the existing scene review/editor.
                const parseWorld = (value: any) => {
                    value = { ...value, plan: prepareMotionBlockout(value?.plan, body.aspectRatio || '16:9', sourceLayout, value?.initialState?.relationships, value?.walkable) };
                    value.plan = frameSceneSubjects(value.plan, body.aspectRatio || '16:9', value.controlledObject);
                    const built = prepareSpatialReconstruction(value, { sceneContext, sourceLayout, references, drivenName: body.drivenName, primarySubjectName, aspectRatio: body.aspectRatio, version: 2, revision: randomUUID(), sourceImage: body.image, prompt: body.prompt, model: body.llmTier });
                    if (sourceLayout) built.calibrationNotes = sceneCalibrationIssues(built.plan, sourceLayout, body.aspectRatio || '16:9');
                    return built;
                };
                // Measurements arrive with the geometry in the same model turn.
                // Optional diagnostics must never discard an otherwise usable scene.
                try { if (raw?.sourceLayout) sourceLayout = validateSceneLayout(raw.sourceLayout); } catch { /* use authored camera */ }
                try { const built = parseWorld(raw);
                    built.authoring = adoptSceneBuild(raw, sourceKey, acceptedAuthoring || baseAuthoring || createAuthoringDraft(built.plan, sourceKey, bindWorldRigs(built.plan), built.initialState), [], built.plan);
                    built.plan = built.authoring.plan;
                    built.initialState = evaluateAuthoringDraft(built.authoring, 0).state;
                    result = { world: built }; }
                catch (error) {
                    console.warn('[SpatialWorld] reconstruction unavailable', { model, reason: error instanceof Error ? error.message : 'Invalid scene data' });
                    throw new Error('The response contained no usable scene. Your image and instructions are kept; no planning pixels were charged.');
                }
            } else {
                if (!raw) throw new Error('The motion model returned invalid JSON. Your saved recording is retained; no planning pixels were charged.');
                const source: WorldState = cloneWorld(body.sourceState);
                const creatorInstruction = existingPlan
                    ? typeof raw.creatorInstruction === 'string' && raw.creatorInstruction.trim()
                        ? raw.creatorInstruction.trim().slice(0, 30000)
                        : `${body.prompt.trim()}\nApply this correction to the described action: ${body.correction.trim()}`
                    : body.prompt.trim();
                const { plan, reviewNotes } = prepareSpatialMotion(raw.plan, world!, source, recorded!, body.operation, body.destinationState, duration, creatorInstruction, existingPlan);
                const endState = stateAtEnd(plan, existingPlan && body.existingEndState ? cloneWorld(body.existingEndState) : source);
                if (body.operation === 'return') endState.locomotion = body.destinationState?.locomotion || source.locomotion;
                else if (raw.locomotion) endState.locomotion = validateWorld({ ...world, locomotion: raw.locomotion }).locomotion;
                if (body.operation !== 'return') {
                    // An ordinary movement's sparse/empty metadata must not erase
                    // prior loot or rider state. Actions still supply complete end
                    // semantics so explicit drops, exits and other changes can clear it.
                    if (raw.conditions && typeof raw.conditions === 'object') endState.conditions = body.operation === 'movement' ? { ...endState.conditions, ...raw.conditions } : raw.conditions;
                    if (Array.isArray(raw.relationships)) endState.relationships = body.operation === 'movement'
                        ? [...endState.relationships.filter(old => !raw.relationships.some((next: any) => old.from === next.from && old.to === next.to && old.relation === next.relation)), ...raw.relationships]
                        : raw.relationships;
                    for (const [id, facts] of Object.entries(raw.objectFacts || {})) if (endState.objects[id] && facts && typeof facts === 'object') endState.objects[id].facts = body.operation === 'movement' ? { ...endState.objects[id].facts, ...facts as Record<string, unknown> } : facts as Record<string, unknown>;
                }
                const resultingControl = worldAtState(world!, endState);
                endState.controlledObject = resultingControl.controlledObject;
                endState.controlMode = resultingControl.controlMode;
                const routePrompt = spatialClipPrompt(body.operation, creatorInstruction);
                result = { animatic: { id: randomUUID(), references, creatorInstruction, prompt: routePrompt, promptVersion: 2, plan, sourceState: source, endState, stateChanges: raw.stateChanges || (existingPlan ? body.existingStateChanges : undefined) || {}, reviewNotes, model: body.llmTier, createdAt: Date.now() } };
                const animation = result.animatic;
                const seed = acceptedAuthoring || baseAuthoring || createAuthoringDraft(plan, sourceKey, bindWorldRigs(plan), source);
                const authored = adoptSceneBuild(raw, sourceKey, seed, [], plan);
                const hasExistingOutcome = Boolean(existingPlan && body.existingEndState);
                const reconciledFacts = hasExistingOutcome
                    ? [...new Set([...Object.keys(body.existingEndState?.objects || {}), ...Object.keys(raw.objectFacts || {})])]
                    : Object.keys(raw.objectFacts || {});
                animation.authoring = reconcileSceneOutcome(authored, endState, `outcome:${body.operation}`, { facts: reconciledFacts, conditions: hasExistingOutcome || raw.conditions !== undefined, relationships: hasExistingOutcome || Array.isArray(raw.relationships), locomotion: hasExistingOutcome || body.operation === 'return' || raw.locomotion !== undefined });
                animation.plan = animation.authoring.plan;
                animation.endState = evaluateAuthoringDraft(animation.authoring, duration).state;
                const evaluatedControl = worldAtState(world!, animation.endState);
                animation.endState.controlledObject = evaluatedControl.controlledObject;
                animation.endState.controlMode = evaluatedControl.controlMode;
                // The browser captures this processed plan, then calls the existing
                // compiler/refiner while authoring. Never reason twice before the
                // rendered motion evidence exists or defer it to paid dispatch.
            }
            return result;
        };
        const chargeEventId = `spatial-plan:${randomUUID()}`;
        const charge = async (rawPixels?: number | null) => {
            if (meteredAvailable && rawPixels !== undefined) {
                if (rawPixels === null) throw new RouteError('Provider usage is unavailable; no planning pixels were charged.', 422);
                const billingScope = String(body.billingSessionId || body.projectKey || 'default');
                const sessionKey = buildMeteredSessionKey('spatial', user, billingScope);
                const addedSubunits = rawPixelsToSubunits(rawPixels);
                await accumulateMeteredUsage({
                    sessionKey,
                    userId: user,
                    workload: 'spatial',
                    profile: body.llmTier,
                    model,
                    eventId: chargeEventId,
                    costSubunits: addedSubunits,
                    billableToUser: true,
                });
                const receipt = await settleMeteredSession({
                    sessionKey, userId: user, workload: 'spatial', profile: body.llmTier, model,
                    forceReceipt: true, strictFullBalance: false, throwOnError: true,
                });
                if (!receipt || receipt.pendingReconciliation) throw new Error('The billing receipt is unavailable. The plan has not been charged again.');
                const chargePixels = receipt.replayed ? 0 : receipt.pixelsCharged;
                if (chargePixels > 0) recordPixelCharge(chargePixels, 'spatial-world');
                return {
                    llmBilling: {
                        tier: body.llmTier,
                        pricing: 'provider-cost',
                        rawPixels,
                        pixelsCharged: chargePixels,
                        receiptId: receipt.receiptId,
                        carrySubunits: receipt.carrySubunits,
                        unsettledWholePixels: receipt.unsettledWholePixels,
                        carriedPixels: Number((receipt.carrySubunits / SUBUNITS_PER_PIXEL).toFixed(6)),
                        pixels: receipt.remainingPixels,
                    },
                };
            }
            throw new RouteError('Provider usage is unavailable; no planning pixels were charged.', 422);
        };
        // The scene the creator already sees is the starting point of a live edit.
        const basePlan = body.operation === 'reconstruct' ? world?.plan : existingPlan || recorded;
        return { spec: { kind: 'spatial', operation: existingPlan ? 'action-correction' : body.operation, price, atCostPricing: meteredAvailable, tier: body.llmTier, planPath: ['plan'], basePlan, baseAuthoring, adoptCheckpoint, duration, request, finalize, charge: () => charge(),
            recordUsage: (usedModel, usage, meta) => recordOpenAiUsage(usedModel, { model: usedModel, usage }, { spatialWorld: body.operation, selectedTier: body.llmTier, reasoningEffort: spatialPlanningInference(body.llmTier).reasoning_effort, ...meta }) }, chargeWithRaw: charge };
    } catch (error) {
        if (error instanceof RouteError) throw error;
        throw new RouteError(error instanceof Error ? error.message : 'Spatial planning failed.', 422);
    }
}

registerLivePreparer('spatial', async (user, body) => {
    const prepared = await prepareSpatialPlan(user, body);
    if (prepared.identify) throw new RouteError('Subject identification is not a live scene build.', 400);
    return prepared.spec;
});

export async function spatialWorldPlan(req: Request, res: Response) {
    const user = authenticatedUserId(req);
    if (!user) return res.status(401).json({ message: 'Please sign in.' });
    const body = req.body || {};
    if (body.operation === 'review') {
        // Preserve first-pass builds even when a stale client requests the
        // retired automatic review. This path performs no model call/charge.
        try { return res.json({ plan: validateMotionPlan(body.plan) }); }
        catch { return res.status(400).json({ message: 'The scene preview is unavailable.' }); }
    }
    // Live construction streams this same request into the creator's Three.js view.
    if (body.live === true && body.operation !== 'identify') return handleLiveRequest(req, res, 'spatial', user);
    let prepared: SpatialPrepared;
    try { prepared = await prepareSpatialPlan(authenticatedOwnerId(req) || user, body); }
    catch (error) { return res.status((error as RouteError).status || 422).json({ message: (error as Error).message }); }
    try {
        const client = createRoutedTextClient(new OpenAI({ apiKey: process.env.DALLE_KEY, timeout: 240000, maxRetries: 0 }));
        if (prepared.identify) {
            const { model, content } = prepared;
            const response = await client.chat.completions.create({ model, max_completion_tokens: 2000, ...spatialPlanningInference(body.llmTier), response_format: { type: 'json_object' }, messages: [
                { role: 'system', content: 'Identify the visible subjects and usable props in this scene image using the supplied scene context. Return JSON {subjects:[{name,description}]}. Preserve existing names when known; otherwise use short distinct descriptive names. Do not invent offscreen subjects. This is only a candidate list for the creator to choose the driven subject, not geometry or motion. Return an empty subjects array if there is no recognizable subject.' },
                { role: 'user', content },
            ] });
            recordOpenAiUsage(model, response, { spatialWorld: 'identify', selectedTier: body.llmTier, reasoningEffort: spatialPlanningInference(body.llmTier).reasoning_effort });
            let detected: any;
            try { detected = JSON.parse(response.choices[0]?.message?.content || ''); }
            catch { throw new Error('Subject identification returned incomplete JSON. You can retry identification without rebuilding a scene.'); }
            if (!Array.isArray(detected.subjects)) throw new Error('Subject identification did not return a candidate list.');
            const subjects = detected.subjects.filter((item: any) => typeof item?.name === 'string' && item.name.trim()).map((item: any) => ({ name: item.name.trim(), description: String(item.description || '') }));
            // Preflight is included in scene planning, not a second pixel charge.
            return res.json({ subjects });
        }
        const { spec, chargeWithRaw } = prepared;
        const usageCursor = typeof providerUsageCursor === 'function' ? providerUsageCursor() : 0;
        const response = await client.chat.completions.create(spec.request);
        recordOpenAiUsage(spec.request.model, response, { spatialWorld: body.operation, selectedTier: body.llmTier, reasoningEffort: spatialPlanningInference(body.llmTier).reasoning_effort });
        const rawPixels = typeof providerPixelsSince === 'function' ? providerPixelsSince(usageCursor) : undefined;
        let raw: any;
        try { raw = JSON.parse(response.choices[0]?.message?.content || ''); } catch { raw = null; }
        const result = await spec.finalize(raw, { model: spec.request.model, provider: (response as any)._clikbProvider || 'openai' });
        let billing: Record<string, unknown>;
        try { billing = chargeWithRaw ? await chargeWithRaw(rawPixels) : await spec.charge(); }
        catch (error) { return res.status((error as RouteError).status || 402).json({ message: (error as Error).message }); }
        return res.json({ ...result, ...billing });
    } catch (error) { return res.status(422).json({ message: error instanceof Error ? error.message : 'Spatial planning failed.' }); }
}
