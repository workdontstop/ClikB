import { mergeAuthoringPlan, type SceneAuthoringDraft } from './sceneAuthoring';
import { validateMotionPlan, type MotionPlan } from './motionGuidePlan';
import { validateScenePerformance } from './scenePerformance';
import { cloneWorld, newWorldState } from './spatialWorld';

const controlKey = (objectId: string, partId = '') => JSON.stringify([objectId, partId]);
const attachmentRelations = new Set(['holds', 'riding', 'attached']);

/** Native and recovered Assist completions must adopt the same canonical result. */
export function adoptLiveAuthoringResult(previous: SceneAuthoringDraft, result: { plan: MotionPlan; authoring?: SceneAuthoringDraft }, pinned: readonly string[] = []): SceneAuthoringDraft {
    if (!result.authoring) return mergeLiveAuthoringPlan(previous, result.plan, pinned)!;
    const accepted = validateScenePerformance(result).authoring!;
    if (accepted.sourceKey !== previous.sourceKey) throw new Error('This scene result belongs to a different source.');
    return accepted;
}

/** Adopt a live result without replaying the authoring overrides it supersedes. */
export function mergeLiveAuthoringPlan(
    previous: SceneAuthoringDraft | undefined,
    accepted: MotionPlan,
    pinnedObjectIds: readonly string[] = [],
    options?: { controlledObjectId?: string; keepPinnedPerformance?: boolean },
): SceneAuthoringDraft | undefined {
    if (!previous) return undefined;
    const plan = validateMotionPlan(accepted), corrected = new Set(options?.keepPinnedPerformance ? [] : pinnedObjectIds);
    const base = cloneWorld(previous);
    base.manualControls = base.manualControls.filter(key => {
        try { return !corrected.has(JSON.parse(key)[0]); } catch { return false; }
    });
    base.masks = (base.masks || []).filter(mask => !corrected.has(mask.objectId) && !corrected.has(mask.target?.objectId || ''));
    base.locks = base.locks.filter(lock => !corrected.has(lock.objectId));
    base.moves = base.moves.filter(move => !corrected.has(move.objectId));
    base.locomotion = base.locomotion.filter(id => !corrected.has(id));
    // The accepted track already includes the visible attachment/move result.
    // Replaying its old spatial events would compose that motion a second time.
    base.events = base.events.filter(event => event.kind === 'facts'
        || !corrected.has(event.objectId) && (event.kind !== 'attach' || !corrected.has(event.parent.objectId)));

    const next = mergeAuthoringPlan(base, plan, { preserveManualTracks: true, ...options });
    const objects = new Map(next.plan.objects.map(object => [object.id, object]));
    const initial = newWorldState(next.plan);
    // Keep the existing route-origin baseline, while supplying newly created
    // entities and preventing an explicitly deleted pinned entity from returning.
    for (const [id, state] of Object.entries(initial.objects)) if (!next.sourceState.objects[id]) next.sourceState.objects[id] = state;
    for (const id of corrected) if (!objects.has(id)) {
        delete next.sourceState.objects[id];
        if (next.sourceState.controlledObject === id) delete next.sourceState.controlledObject;
    }
    next.sourceState.relationships = next.sourceState.relationships.filter(relation => {
        if (corrected.has(relation.from) && !objects.has(relation.from) || corrected.has(relation.to) && !objects.has(relation.to)) return false;
        return !attachmentRelations.has(relation.relation) || !corrected.has(relation.from) && !corrected.has(relation.to);
    });
    for (const object of next.plan.objects) {
        const parent = object.attachment;
        if (parent && (corrected.has(object.id) || corrected.has(parent.objectId))) {
            const oldRelation = previous.sourceState.relationships.find(relation =>
                relation.relation === 'holds' && relation.from === parent.objectId && relation.to === object.id
                || ['riding', 'attached'].includes(relation.relation) && relation.from === object.id && relation.to === parent.objectId);
            next.sourceState.relationships.push(oldRelation ? cloneWorld(oldRelation) : { from: object.id, to: parent.objectId, relation: 'attached' });
        }
        const sourceGeometry = next.sourceState.objects[object.id]?.geometry;
        if (sourceGeometry?.attachment && corrected.has(sourceGeometry.attachment.objectId) && !objects.has(sourceGeometry.attachment.objectId)) {
            if (parent) sourceGeometry.attachment = cloneWorld(parent);
            else delete sourceGeometry.attachment;
        }
        if (!corrected.has(object.id)) continue;
        // Preserve the entire corrected animation, rather than pinning every
        // frame to whichever pose was visible when Pause was pressed.
        next.manualControls.push(controlKey(object.id), ...(object.parts || []).map(part => controlKey(object.id, part.id)));
    }
    next.manualControls = [...new Set(next.manualControls)];
    next.rigs = Object.fromEntries(Object.entries(next.rigs).flatMap(([id, rig]) => {
        const object = objects.get(id);
        return object ? [[id, { ...rig, controls: Object.fromEntries(Object.entries(rig.controls).filter(([, partId]) => object.parts?.some(part => part.id === partId))) }]] : [];
    }));
    if (next.cameraRig && next.cameraRig.kind !== 'free') {
        const target = next.cameraRig.target, object = objects.get(target.objectId);
        if (!object || target.partId && !object.parts?.some(part => part.id === target.partId)) delete next.cameraRig;
    }
    return validateScenePerformance({ plan: next.plan, authoring: next }).authoring;
}
