import { validateMotionPlan, boxSpanKey, spanFromKey, type MotionPlan, type MotionKey, type MotionVec3 } from './motionGuidePlan';
import { cloneWorld, planAtState, type SpatialWorld, type WorldState } from './spatialWorld';
import { initialMotionTransform } from './motionNodeTransforms';

const identity = (id: unknown) => typeof id === 'string' ? id.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
const matching = <T extends { id: string }>(items: T[], id: unknown): T | undefined => {
    const exact = items.find(item => item.id === id);
    const aliases = items.filter(item => identity(item.id) === identity(id));
    return exact || (aliases.length === 1 ? aliases[0] : undefined);
};

const offset = (value: MotionVec3, from: MotionVec3, to: MotionVec3): MotionVec3 => value.map((n, i) => n - from[i] + to[i]) as MotionVec3;
/** Keep the performance's deltas, but attach the entire track to the saved pose.
 * Replacing only t=0 makes the next frame jump back to the model's old origin. */
function anchorActionTrack(keys: MotionKey[], pose: MotionKey, fade = false, duration = 1): MotionKey[] {
    const first = keys[0];
    return keys.map(key => {
        const weight = fade && duration > 0 ? Math.max(0, 1 - key.t / duration) : 1;
        if (key.span) {
            const start = spanFromKey(first), saved = spanFromKey(pose);
            const fadeStart = start.start.map((n, i) => n + (saved.start[i] - n) * weight) as MotionVec3;
            const fadeEnd = start.end.map((n, i) => n + (saved.end[i] - n) * weight) as MotionVec3;
            const width = start.width + (saved.width - start.width) * weight, depth = start.depth + (saved.depth - start.depth) * weight;
            return boxSpanKey(key.t, { start: offset(key.span.start, start.start, fadeStart), end: offset(key.span.end, start.end, fadeEnd),
                width: key.span.width / start.width * width, depth: key.span.depth / start.depth * depth });
        }
        const fadePos = first.position.map((n, i) => n + (pose.position[i] - n) * weight) as MotionVec3;
        const fadeRot = first.rotation.map((n, i) => n + (pose.rotation[i] - n) * weight) as MotionVec3;
        const fadeScale = first.scale.map((n, i) => n + (pose.scale[i] - n) * weight) as MotionVec3;
        return ({ ...key,
        position: offset(key.position, first.position, fadePos),
        rotation: offset(key.rotation, first.rotation, fadeRot),
        scale: key.scale.map((n, i) => n / first.scale[i] * fadeScale[i]) as MotionVec3,
    }); });
}

/** Accept changed/partial AI geometry instead of rejecting a whole performance
 * for a different part count. Missing tracks inherit the saved source pose.
 * Actual renderability is still checked; there is no object/part count cap. */
export function prepareSpatialMotion(value: any, world: SpatialWorld, source: WorldState, recorded: MotionPlan, operation: string, destination?: WorldState, duration = operation === 'action' ? recorded.duration : 5, creatorInstruction = '', existingPlan?: MotionPlan) {
    if (!value || !Array.isArray(value.objects)) throw new Error('The motion response is missing its object tracks.');
    const sourcePlan = planAtState(world, source, duration);
    // Corrections inherit the generated performance, rather than replacing
    // every unmentioned track with a static pose from the starting scene.
    const baseline = operation === 'action' && existingPlan ? cloneWorld(existingPlan) : sourcePlan;
    if (baseline.duration !== duration) {
        const previousDuration = baseline.duration;
        for (const object of baseline.objects) for (const keys of [object.keys, ...(object.parts || []).map(part => part.keys)])
            for (const key of keys) key.t = key.t / previousDuration * duration;
        for (const key of baseline.camera) key.t = key.t / previousDuration * duration;
        baseline.duration = duration;
    }
    value = cloneWorld(value);
    const suppliedDuration = Number(value.duration) || duration;
    if (suppliedDuration !== duration) {
        for (const object of value.objects) {
            for (const keys of [object.keys, ...(object.parts || []).map((part: any) => part.keys)])
                if (Array.isArray(keys)) for (const key of keys) key.t = key.t / suppliedDuration * duration;
        }
        if (Array.isArray(value.camera)) for (const key of value.camera) key.t = key.t / suppliedDuration * duration;
    }
    value.duration = duration;
    const suppliedIds = new Set<string>();
    const releasedAssets = new Map<string, { objectId: string; partId: string }>();
    const objects = value.objects.map((object: any) => {
        const original = matching(baseline.objects, object?.id);
        const id = original?.id || object?.id;
        suppliedIds.add(id);
        const merged = { ...original, ...object, subjectColor: original?.subjectColor || object?.subjectColor, id, keys: object?.keys ?? original?.keys };
        if (Array.isArray(object?.parts) && object.parts.length) {
            merged.parts = object.parts.map((part: any) => {
                const base = matching(original?.parts || [], part?.id);
                return { ...base, ...part, id: base?.id || part?.id, keys: part?.keys ?? base?.keys };
            });
            // A partial response may animate only a limb or vehicle wheel.
            // Unmentioned saved parts still belong to the asset and follow its root.
            {
                const kept = new Set(merged.parts.map((part: any) => part.id));
                const released = new Set<string>(operation === 'action' && creatorInstruction.trim() && Array.isArray(object.releasedPartIds) ? object.releasedPartIds.filter((id: unknown) => typeof id === 'string') : []);
                for (const part of original?.parts || []) if (part.identity && released.has(part.id) && !kept.has(part.id)) releasedAssets.set(part.identity, { objectId: id, partId: part.id });
                const needed = new Set<string>(merged.parts.map((part: any) => part.parentId).filter(Boolean));
                for (const candidate of baseline.objects) { const anchor = candidate.attachment; if (anchor && anchor.objectId === id && anchor.partId) needed.add(anchor.partId); }
                // Omission is not removal. Explicit edits still replace matching
                // parts; an authored release can remove a carried asset.
                for (const part of original?.parts || []) if (!released.has(part.id)) needed.add(part.id);
                for (let pass = 0; pass < (original?.parts?.length || 0); pass++) for (const part of original?.parts || []) if (needed.has(part.id) && part.parentId) needed.add(part.parentId);
                merged.parts.push(...(original?.parts || []).filter(part => needed.has(part.id) && !kept.has(part.id)));
            }
        } else if (object?.parts == null || Array.isArray(object.parts) && !object.parts.length) {
            merged.parts = original?.parts;
        }
        return merged;
    });
    objects.push(...baseline.objects.filter(object => !suppliedIds.has(object.id)));
    const plan = validateMotionPlan({ ...baseline, ...value, objects, camera: value.camera ?? baseline.camera });
    // New attachment anchors use their proposed first pose; existing anchors
    // retain their actual source pose, even when the AI lists them later.
    const anchorPlan = { ...sourcePlan, objects: sourcePlan.objects.map(object => {
        const proposed = plan.objects.find(candidate => candidate.id === object.id);
        const added = proposed?.parts?.filter(part => !object.parts?.some(old => old.id === part.id)) || [];
        return added.length ? { ...object, parts: [...(object.parts || []), ...added] } : object;
    }).concat(plan.objects.filter(object => !sourcePlan.objects.some(old => old.id === object.id))) };
    const reviewNotes: string[] = [];
    const geometry = (p: MotionPlan) => JSON.stringify(p.objects.map(({ keys: _keys, parts, ...object }) => ({ ...object, parts: parts?.map(({ keys: _track, ...part }) => part) })));
    if (geometry(plan) !== geometry(baseline)) reviewNotes.push('The AI changed the proxy geometry. Preview it before saving; you can revise the instructions and try again.');
    for (const object of plan.objects) {
        const pose = source.objects[object.id];
        if (pose) {
            const oldAnchor = sourcePlan.objects.find(candidate => candidate.id === object.id)?.attachment;
            const oldObject = sourcePlan.objects.find(candidate => candidate.id === object.id)!;
            const anchorChanged = JSON.stringify(oldAnchor) !== JSON.stringify(object.attachment) || JSON.stringify(oldObject.pivot) !== JSON.stringify(object.pivot);
            const sourceTransform = anchorChanged ? initialMotionTransform(sourcePlan, object.id, object.attachment, { targetPlan: anchorPlan, pivot: object.pivot }) : pose.transform;
            if (operation === 'action') object.keys = anchorActionTrack(object.keys, sourceTransform, anchorChanged, duration);
            object.keys[0] = { ...cloneWorld(sourceTransform), t: 0 };
            for (const part of object.parts || []) if (pose.parts?.[part.id]) {
                const oldPart = oldObject.parts?.find(candidate => candidate.id === part.id);
                const changed = oldPart?.parentId !== part.parentId || JSON.stringify(oldPart?.pivot) !== JSON.stringify(part.pivot);
                const partPose = changed ? initialMotionTransform(sourcePlan, object.id, { objectId: object.id, partId: part.parentId }, { partId: part.id, targetPlan: anchorPlan, pivot: part.pivot }) : pose.parts[part.id];
                if (operation === 'action') part.keys = anchorActionTrack(part.keys, partPose, anchorChanged, duration);
                part.keys[0] = { ...cloneWorld(partPose), t: 0 };
            }
        } else if (operation === 'action' && object.identity && releasedAssets.has(object.identity)) {
            const released = releasedAssets.get(object.identity)!;
            object.keys = anchorActionTrack(object.keys, initialMotionTransform(sourcePlan, released.objectId, object.attachment,
                { partId: released.partId, targetPlan: anchorPlan, pivot: object.pivot }));
        }
        if (operation === 'movement' && object.id === world.controlledObject) {
            const track = recorded.objects.find(candidate => candidate.id === object.id);
            if (!track) throw new Error('The saved recording is missing the driven subject.');
            object.keys = cloneWorld(track.keys);
            if (track.rotationMode) object.rotationMode = track.rotationMode;
        }
    }
    if (operation === 'action') {
        const first = plan.camera[0];
        plan.camera = plan.camera.map(key => ({ ...key,
            position: offset(key.position, first.position, source.camera.position),
            target: offset(key.target, first.target, source.camera.target),
            fov: key.fov - first.fov + source.camera.fov,
        }));
    }
    plan.camera[0] = { ...cloneWorld(source.camera), t: 0 };
    if (operation === 'movement') {
        // The planner copies the creator's explicit camera clause verbatim.
        // Without that evidence, the existing recorded camera remains exact.
        const requested = plan.cameraInstruction && creatorInstruction.includes(plan.cameraInstruction);
        if (!requested) { plan.camera = cloneWorld(recorded.camera); delete plan.cameraInstruction; }
    }
    if (operation === 'return') {
        if (!destination?.objects?.[world.controlledObject]) throw new Error('Return destination is missing.');
        for (const object of plan.objects) {
            const pose = destination.objects[object.id];
            if (!pose) continue;
            object.keys[object.keys.length - 1] = { ...cloneWorld(pose.transform), t: duration };
            for (const part of object.parts || []) if (pose.parts?.[part.id]) part.keys[part.keys.length - 1] = { ...cloneWorld(pose.parts[part.id]), t: duration };
        }
        plan.camera[plan.camera.length - 1] = { ...cloneWorld(destination.camera), t: duration };
    }
    return { plan: validateMotionPlan(plan), reviewNotes };
}
