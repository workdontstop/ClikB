import { cloneWorld, spatialAssetReferences, worldControlAtPlan, type SpatialWorld, type WorldState } from './spatialWorld';
import type { MotionPlan, MotionObject } from './motionGuidePlan';

const normalize = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
type ContinuityLink = { sceneId: string; bShotIndex?: number; bShotIdentity?: string };
type ContinuityScene = { sceneId: string; nodes: Array<{ id: string; actionLink?: ContinuityLink | null }>; ledger?: { world: SpatialWorld; states: Record<string, WorldState> } };
const linkedStageId = (link?: ContinuityLink | null) => {
    if (!link || link.bShotIndex === undefined) return link?.sceneId;
    if (!link.bShotIdentity) return undefined;
    return link.bShotIdentity.startsWith(`${link.sceneId}:b:`) ? link.bShotIdentity
        : `${link.sceneId}:b:${link.bShotIndex}:${link.bShotIdentity}`;
};

/** Identity is shared; poses and inventory cross only an unambiguous authored link.
 * Unconnected scenes and branches must not inherit somebody else's action state. */
export function spatialSceneContinuity(scenes: ContinuityScene[], currentSceneId: string) {
    const current = scenes.find(scene => scene.sceneId === currentSceneId);
    const established = scenes.find(scene => scene.ledger?.world.primarySubjectName)
        || scenes.find(scene => scene.ledger?.world.drivenName);
    const primarySubjectName = current?.ledger?.world.primarySubjectName
        || established?.ledger?.world.primarySubjectName || established?.ledger?.world.drivenName || '';
    const references = spatialAssetReferences(established?.ledger?.world.references);
    const incoming = scenes.flatMap(scene => scene.sceneId === currentSceneId ? [] : scene.nodes
        .filter(node => linkedStageId(node.actionLink) === currentSceneId)
        .flatMap(node => {
            const state = scene.ledger?.states[node.id] || (node.id === scene.nodes[0]?.id ? scene.ledger?.world.initialState : undefined);
            if (!state || !scene.ledger) return [];
            return [{ sceneId: scene.sceneId, nodeId: node.id, state, world: scene.ledger.world }];
        }));
    const source = incoming.length === 1 ? incoming[0] : undefined;
    const linkedState = source && {
        sceneId: source.sceneId, nodeId: source.nodeId,
        objects: Object.entries(source.state.objects).map(([id, object]) => ({ id,
            identity: object.geometry?.identity || source.world.plan.objects.find(item => item.id === id)?.identity || id,
            attachment: object.geometry?.attachment, facts: cloneWorld(object.facts),
            carriedParts: object.geometry?.parts?.filter(part => part.identity).map(part => ({ id: part.id, identity: part.identity, parentId: part.parentId })),
        })), relationships: cloneWorld(source.state.relationships), conditions: cloneWorld(source.state.conditions),
    };
    return { primarySubjectName, references, linkedState };
}

/** Name the actual moving root and its attached identities, retaining the actor
 * separately. Selecting a vehicle never turns its rider into unrelated ambient motion. */
export function spatialControlledIdentity(world: SpatialWorld, plan: MotionPlan = world.plan) {
    const objectId = worldControlAtPlan(world, plan);
    const root = plan.objects.find(object => object.id === objectId);
    const nameOf = (object: MotionObject) => object.identity
        || world.references?.find(reference => normalize(reference.name) === normalize(object.id))?.name
        || object.id.replace(/[_-]/g, ' ');
    const named = plan.objects.some(object => normalize(object.id) === normalize(world.drivenName || '') || normalize(object.identity || '') === normalize(world.drivenName || ''));
    const name = root ? (named || world.primarySubjectName ? nameOf(root) : world.drivenName || nameOf(root)) : world.drivenName || objectId;
    const unitIds = new Set([objectId]);
    for (let pass = 0; pass < plan.objects.length; pass++) for (const object of plan.objects)
        if (object.attachment && unitIds.has(object.attachment.objectId)) unitIds.add(object.id);
    const carried = [...new Set(plan.objects.flatMap(object => unitIds.has(object.id)
        ? [...(object.id !== objectId ? [nameOf(object)] : []), ...(object.parts?.flatMap(part => part.identity ? [part.identity] : []) || [])] : []))]
        .filter(identity => normalize(identity) !== normalize(name));
    return { objectId, name, primarySubjectName: world.primarySubjectName || world.drivenName || name,
        controlledSubject: carried.length ? `${name} with ${carried.join(', ')}` : name, unitIds: [...unitIds] };
}
