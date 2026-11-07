import { worldAtState, type SpatialLedger } from './spatialWorld';
import { spatialControlledIdentity } from './spatialContinuity';

type ActionUpdateScene = { sceneId: string; activeNodeId: string; nodes: Array<{ id: string; frameUrl: string }>; ledger?: SpatialLedger };

const shortText = (value: unknown, limit = 160) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const vec = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? value : undefined;
const facts = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, item]) => [key.slice(0, 80),
        typeof item === 'string' ? item.slice(0, 160) : typeof item === 'number' || typeof item === 'boolean' || item === null ? item : '[saved detail]'])) : {};

/** Setup rewrites use the real stage image for appearance, never proxy anchors. */
export function buildSpatialActionUpdate(scene: ActionUpdateScene | null | undefined) {
    const ledger = scene?.ledger;
    if (!scene || !ledger) return undefined;
    const world = ledger.world;
    const state = ledger.states[scene.activeNodeId] || (scene.activeNodeId === scene.nodes[0]?.id ? world.initialState : undefined);
    const activeWorld = state ? worldAtState(world, state) : world;
    const identity = spatialControlledIdentity(activeWorld);
    const subject = identity.objectId;
    const entries = Object.entries(state?.objects || {});
    const priority = (id: string) => id === subject ? 0 : identity.unitIds.includes(id) ? 1 : 2;
    entries.sort(([a], [b]) => priority(a) - priority(b));
    const context = ledger.nodeContexts?.[scene.activeNodeId]?.motionContext;
    return {
        imageUrl: world.sourceImage || scene.nodes[0]?.frameUrl || '',
        spatialActionContext: {
            mode: 'spatial-action-setup', stageId: shortText(scene.sceneId), nodeId: shortText(scene.activeNodeId),
            controlledSubject: shortText(identity.controlledSubject), primarySubjectName: shortText(identity.primarySubjectName), controlMode: activeWorld.controlMode,
            objects: entries.slice(0, 16).map(([id, object]) => ({ id: shortText(id),
                identity: shortText(object.geometry?.identity), attachment: object.geometry?.attachment ? { objectId: shortText(object.geometry.attachment.objectId), partId: shortText(object.geometry.attachment.partId) } : undefined,
                position: vec(object.transform?.position), rotation: vec(object.transform?.rotation), facts: facts(object.facts) })),
            relationships: (state?.relationships || []).slice(0, 24).map(relation => ({
                from: shortText(relation.from), to: shortText(relation.to), relation: shortText(relation.relation), facts: facts(relation.facts) })),
            conditions: facts(state?.conditions),
            stateDescription: context ? Object.fromEntries(['controlledSubject', 'controlMode', 'primaryMotion', 'ambientMotion']
                .map(key => [key, shortText(context[key as keyof typeof context], 800)])) : undefined,
        },
    };
}

/** Only the bounded current state reaches the rewrite, with no full scene history. */
export function spatialActionUpdateInstruction(value: unknown): string {
    if (!value || typeof value !== 'object' || (value as any).mode !== 'spatial-action-setup') return '';
    const context = value as any;
    const state = {
        stageId: shortText(context.stageId), nodeId: shortText(context.nodeId),
        controlledSubject: shortText(context.controlledSubject), primarySubjectName: shortText(context.primarySubjectName), controlMode: shortText(context.controlMode),
        objects: Array.isArray(context.objects) ? context.objects.slice(0, 16).map((object: any) => ({
            id: shortText(object?.id), identity: shortText(object?.identity), attachment: object?.attachment && { objectId: shortText(object.attachment.objectId), partId: shortText(object.attachment.partId) }, position: vec(object?.position), rotation: vec(object?.rotation), facts: facts(object?.facts) })) : [],
        relationships: Array.isArray(context.relationships) ? context.relationships.slice(0, 24).map((relation: any) => ({
            from: shortText(relation?.from), to: shortText(relation?.to), relation: shortText(relation?.relation), facts: facts(relation?.facts) })) : [],
        conditions: facts(context.conditions), stateDescription: context.stateDescription && Object.fromEntries(
            ['controlledSubject', 'controlMode', 'primaryMotion', 'ambientMotion'].map(key => [key, shortText(context.stateDescription[key], 800)])),
    };
    return `SPATIAL ACTION SETUP: You are updating the prompt for one action being authored in Three.js before video generation.
The attached original stage image supplies identity, appearance and visual style. The saved starting state below supplies the action's current pose, position, equipment and relationships; the image may depict an earlier state.
Apply the user's change to this action and preserve everything they did not ask to change. Keep the supplied duration and target-model format. Do not restart the base scene, retell its full story, repeat a completed action, or invent an earlier setup. Return the updated action prompt only, never Three.js code or a scene plan.
SAVED ACTION STARTING STATE: ${JSON.stringify(state)}`;
}
