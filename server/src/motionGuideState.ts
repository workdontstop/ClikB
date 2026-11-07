import { createAuthoringDraft, type SceneAuthoringDraft } from './sceneAuthoring';
import { bindWorldRigs } from './sceneRig';
import { mergeLiveAuthoringPlan } from './liveAuthoringPlan';
import { validateMotionPlan, type MotionPlan } from './motionGuidePlan';
import { validateScenePerformance } from './scenePerformance';
import { cloneWorld, newWorldState, planAtState, type SpatialWorld, type WorldState } from './spatialWorld';
import { preserveProtectedScenePlan } from './scenePlanProtection';

export const motionGuideStateInstructions = `
SHARED SPATIAL CHARACTER STATE:
sourceState is the authoritative STARTING world state. Its objects contain root transforms, parent-local part poses, facts and assets; relationships describe existing support, possession and carrier connections. authoringContext is the application's full clikb.scene-authoring.v1 document, including that sourceState, saved plan, rig bindings, manual controls, masks, locks, events and camera/lighting rigs. Preserve these identities and controls; do not replace them with a generic actor or default gait.
The first-frame image establishes starting posture, facing, contact, scale and prop placement when no saved sourceState exists. Build that actual pose before authoring its requested motion. Return initialState:{conditions:{},relationships:[{from,to,relation,facts?}],objects:{ID:{facts:{},assets:[]}}} alongside the version:1 plan. Use this same flexible state vocabulary as Spatial; record the observed posture/activity, supports, held items and carrier relationships without a fixed scenario or subject inventory. Metadata does not pose geometry: encode the matching physical state in root and articulated LOCAL part keys, including bends, orientation and contacts.
initialState describes the start of the SAME shot, not the endpoint of the previous construction chunk. acceptedScene and acceptedAuthoring describe work already accepted for this shot. Continue adding or refining that work without resetting its source state. Preserve unchanged facts and relationships; newly added subjects must include their initial state. A build chunk is a construction revision, not a later story beat.
Preserve the requested starting state and motion throughout the complete timeline. Changes to posture, support, equipment or carrier state must be requested by the creator and physically represented in the animation; preserve all other state. Stationary or held poses do not imply walking. Rig bindings enable controls; they do not authorize procedural locomotion. If authoringContext already contains active moves/events/locomotion, keep them separate from the underlying keys rather than baking their effect twice.
Use rendered feedback together with sourceState, acceptedAuthoring and the original first-frame image to inspect whether the intended pose and actions are actually represented. Camera motion does not substitute for body performance. Complete a build when the requested scene, state and choreography are represented; do not spend further steps polishing unrelated details.`;

/** Reuse Spatial's current node pose, without replaying a completed route. */
export function motionAuthoringFromSpatial(world: SpatialWorld, state: WorldState, sourceKey: string, duration: number): SceneAuthoringDraft {
    const plan = validateMotionPlan(planAtState(world, state, duration));
    const rigs = bindWorldRigs(plan);
    for (const [id, rig] of Object.entries(world.authoring?.rigs || {})) {
        const object = plan.objects.find(item => item.id === id);
        if (object) rigs[id] = { ...cloneWorld(rig), controls: Object.fromEntries(Object.entries(rig.controls).filter(([, partId]) => object.parts?.some(part => part.id === partId))) };
    }
    const draft = createAuthoringDraft(plan, sourceKey, rigs, state);
    if (world.authoring?.lightingRig) draft.lightingRig = cloneWorld(world.authoring.lightingRig);
    return validateScenePerformance({ plan, authoring: draft }).authoring!;
}

/** Adopt each Motion Guide revision through Spatial's authoring boundary.
 * Semantic facts supplement actual transforms; they never substitute for them. */
export function adoptMotionGuideState(
    input: MotionPlan, sourceKey: string, previous?: SceneAuthoringDraft,
    declaredInitialState?: unknown, pinned: readonly string[] = [],
    keepPinnedPerformance = false,
    protectInput = false,
): SceneAuthoringDraft {
    const protections = previous ? [...previous.manualControls, ...(previous.masks || []).map(mask => JSON.stringify([mask.objectId, mask.partId || ''])), ...previous.locks.map(lock => JSON.stringify([lock.objectId, lock.partId || '']))] : [];
    // Canonical retention and AI input protection are independent: creator
    // pause/continue edits must be allowed to replace their own prior frame.
    const plan = validateMotionPlan(previous && protectInput ? preserveProtectedScenePlan(previous.plan, input, protections, pinned, previous.events.flatMap(event => event.kind === 'attach' ? [event] : [])) : input);
    const next = previous ? mergeLiveAuthoringPlan(previous, plan, pinned, { keepPinnedPerformance })!
        : createAuthoringDraft(plan, sourceKey, bindWorldRigs(plan));
    const initial = newWorldState(plan);
    const declared = declaredInitialState && typeof declaredInitialState === 'object' && !Array.isArray(declaredInitialState)
        ? declaredInitialState as Partial<WorldState> : undefined;
    for (const [id, pose] of Object.entries(initial.objects)) {
        const old = next.sourceState.objects[id], supplied = declared?.objects?.[id];
        next.sourceState.objects[id] = { ...pose, facts: old?.facts || pose.facts, assets: old?.assets || pose.assets };
        if (supplied?.facts && typeof supplied.facts === 'object' && !Array.isArray(supplied.facts))
            next.sourceState.objects[id].facts = { ...(old?.facts || {}), ...cloneWorld(supplied.facts) };
        if (Array.isArray(supplied?.assets)) next.sourceState.objects[id].assets = [...new Set([
            ...(old?.assets || []), ...supplied.assets.filter((value): value is string => typeof value === 'string'),
        ])];
    }
    const ids = new Set(plan.objects.map(object => object.id));
    for (const id of Object.keys(next.sourceState.objects)) if (!ids.has(id)) delete next.sourceState.objects[id];
    if (next.sourceState.controlledObject && !ids.has(next.sourceState.controlledObject)) delete next.sourceState.controlledObject;
    if (declared?.conditions && typeof declared.conditions === 'object' && !Array.isArray(declared.conditions))
        next.sourceState.conditions = { ...next.sourceState.conditions, ...cloneWorld(declared.conditions) };
    const relations = [...next.sourceState.relationships];
    for (const relation of Array.isArray(declared?.relationships) ? declared.relationships : []) {
        if (!relation || typeof relation.relation !== 'string' || !ids.has(relation.from) || !ids.has(relation.to)) continue;
        if (!relations.some(old => old.from === relation.from && old.to === relation.to && old.relation === relation.relation)) relations.push(cloneWorld(relation));
    }
    next.sourceState.relationships = relations.filter(relation => ids.has(relation.from) && ids.has(relation.to));
    const discovered = bindWorldRigs(plan);
    for (const [id, rig] of Object.entries(discovered)) next.rigs[id] = next.rigs[id]
        ? { ...next.rigs[id], controls: { ...rig.controls, ...next.rigs[id].controls } } : rig;
    // Deliberately leave locomotion/moves unchanged. A rig is a set of controls,
    // not an instruction to make a stationary character walk.
    return validateScenePerformance({ plan: next.plan, authoring: next }).authoring!;
}
