import type { MotionObject, MotionPart, MotionPlan } from './motionGuidePlan';

type Target = { objectId: string; partId?: string };
const keyOf = (target: Target) => JSON.stringify([target.objectId, target.partId || '']);

/** Protect coordinate frames, not only the directly edited local key. Retaining
 * a child's keys is insufficient if an AI update moves/reparents its ancestor. */
export function protectedSceneFrames(base: MotionPlan, controls: readonly string[], pinned: readonly string[] = [], attachments: readonly { objectId: string; parent: Target }[] = []): Set<string> {
    const frames = new Set<string>();
    const visit = (target: Target) => {
        const key = keyOf(target);
        if (frames.has(key)) return;
        const object = base.objects.find(item => item.id === target.objectId);
        if (!object) return;
        frames.add(key);
        if (target.partId) {
            const part = object.parts?.find(item => item.id === target.partId);
            visit({ objectId: object.id, ...(part?.parentId ? { partId: part.parentId } : {}) });
        } else {
            if (object.attachment) visit(object.attachment);
            for (const event of attachments) if (event.objectId === object.id) visit(event.parent);
        }
    };
    for (const control of controls) {
        try { const [objectId, partId] = JSON.parse(control); if (objectId !== '$camera') visit({ objectId, ...(partId ? { partId } : {}) }); } catch { /* canonical validation rejects malformed controls */ }
    }
    for (const objectId of pinned) {
        visit({ objectId });
        for (const part of base.objects.find(item => item.id === objectId)?.parts || []) visit({ objectId, partId: part.id });
    }
    return frames;
}

export function preserveProtectedScenePlan(base: MotionPlan, incoming: MotionPlan, controls: readonly string[], pinned: readonly string[] = [], attachments: readonly { objectId: string; parent: Target }[] = []): MotionPlan {
    if (!controls.length && !pinned.length) return incoming;
    const frames = protectedSceneFrames(base, controls, pinned, attachments);
    const duration = incoming.duration || base.duration;
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const retime = <T extends MotionPart>(node: T): T => ({ ...copy(node), keys: node.keys.map(key => ({ ...copy(key), t: key.t / base.duration * duration })) });
    const retimeObject = (node: MotionObject): MotionObject => ({ ...retime(node), ...(node.parts ? { parts: node.parts.map(retime) } : {}) });
    const retainFrame = <T extends MotionPart>(old: T, next: T): T => {
        const kept = { ...next, keys: retime(old).keys };
        for (const field of ['pivot', 'parentId', 'rotationMode', 'interpolation'] as const) {
            if (old[field] === undefined) delete kept[field]; else (kept as any)[field] = copy(old[field]);
        }
        return kept;
    };
    const objects = (incoming.objects || []).filter(object => !pinned.includes(object.id) || base.objects.some(old => old.id === object.id)).map(object => copy(object));
    for (const old of base.objects) {
        if (![...frames].some(key => JSON.parse(key)[0] === old.id)) continue;
        let index = objects.findIndex(item => item.id === old.id);
        if (index < 0) { objects.push(retimeObject(old)); index = objects.length - 1; }
        let next: MotionObject = pinned.includes(old.id) ? retimeObject(old) : objects[index];
        if (frames.has(keyOf({ objectId: old.id }))) {
            next = retainFrame(old, next);
            if (old.attachment) next.attachment = copy(old.attachment); else delete next.attachment;
        }
        const parts = [...(next.parts || [])];
        for (const part of old.parts || []) if (frames.has(keyOf({ objectId: old.id, partId: part.id }))) {
            const at = parts.findIndex(item => item.id === part.id);
            if (at < 0) parts.push(retime(part)); else parts[at] = retainFrame(part, parts[at]);
        }
        objects[index] = { ...next, ...(parts.length ? { parts } : {}) };
    }
    return { ...incoming, objects };
}
