import { cloneWorld, validateWorld, type SpatialRoute, type WorldState } from '../server/src/spatialWorld';
import type { StagePreset } from '../server/src/scenePresets';
import type { MotionObject, MotionPlan } from '../server/src/motionGuidePlan';
import type { PoseTarget, RigBinding, SceneAuthoringDraft } from '../server/src/sceneAuthoring';
import type { SpatialSceneState } from './spatialStageModel';

/** Remap identifier fields only. Enum values, user text and semantic facts remain literal. */
export function applySavedStagePreset(current: SpatialSceneState, input: StagePreset): SpatialSceneState {
    if (!current.ledger) throw new Error('Open a 3D stage before applying this preset.');
    const preset = cloneWorld(input), stamp = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    let serial = 0;
    const fresh = (kind: string) => `p_${stamp}_${kind}${serial++}`;
    const objectIds = new Map<string, string>(), partIds = new Map<string, Map<string, string>>();
    const nodeIds = new Map<string, string>(), connectionIds = new Map<string, string>();
    const collectObject = (object: MotionObject) => {
        if (!objectIds.has(object.id)) objectIds.set(object.id, fresh('o'));
        const parts = partIds.get(object.id) || new Map<string, string>();
        for (const part of object.parts || []) if (!parts.has(part.id)) parts.set(part.id, fresh('p'));
        partIds.set(object.id, parts);
    };
    const collectPlan = (plan: MotionPlan) => plan.objects.forEach(collectObject);
    collectPlan(preset.plan);
    if (preset.authoring) collectPlan(preset.authoring.plan);
    for (const route of Object.values(preset.routes || {})) for (const anim of [route.forward, route.backward]) if (anim) {
        collectPlan(anim.plan); if (anim.authoring) collectPlan(anim.authoring.plan);
    }
    for (const node of preset.nodes || []) nodeIds.set(node.id, fresh('n'));
    for (const edge of preset.connections || []) connectionIds.set(edge.id, fresh('c'));
    const objectId = (id: string) => objectIds.get(id) || id;
    const partId = (owner: string, id: string) => partIds.get(owner)?.get(id) || id;
    const nodeId = (id: string) => nodeIds.get(id) || id;
    const target = (value: PoseTarget): PoseTarget => ({ ...value, objectId: objectId(value.objectId), ...(value.partId !== undefined ? { partId: partId(value.objectId, value.partId) } : {}) });
    const remapPlan = (plan: MotionPlan): MotionPlan => ({ ...plan, objects: plan.objects.map(object => ({
        ...object, id: objectId(object.id), ...(object.attachment ? { attachment: target(object.attachment) } : {}),
        ...(object.parts ? { parts: object.parts.map(part => ({ ...part, id: partId(object.id, part.id), ...(part.parentId !== undefined ? { parentId: partId(object.id, part.parentId) } : {}) })) } : {}),
    })) });
    const remapState = (state: WorldState): WorldState => ({ ...state,
        ...(state.controlledObject !== undefined ? { controlledObject: objectId(state.controlledObject) } : {}),
        objects: Object.fromEntries(Object.entries(state.objects).map(([id, value]) => [objectId(id), { ...value,
            ...(value.geometry ? { geometry: { ...value.geometry,
                ...(value.geometry.attachment ? { attachment: target(value.geometry.attachment) } : {}),
                ...(value.geometry.parts ? { parts: value.geometry.parts.map(part => ({ ...part, id: partId(id, part.id), ...(part.parentId !== undefined ? { parentId: partId(id, part.parentId) } : {}) })) } : {}),
            } } : {}),
            ...(value.parts ? { parts: Object.fromEntries(Object.entries(value.parts).map(([part, pose]) => [partId(id, part), pose])) } : {}),
        }])), relationships: state.relationships.map(relation => ({ ...relation, from: objectId(relation.from), to: objectId(relation.to) })),
    });
    const remapRigs = (rigs: Record<string, RigBinding>): Record<string, RigBinding> => Object.fromEntries(Object.entries(rigs).map(([id, rig]) => [objectId(id), {
        ...rig, controls: Object.fromEntries(Object.entries(rig.controls).map(([name, part]) => [name, partId(id, part)])),
    }]));
    const remapControl = (value: string): string => {
        try { const parsed: unknown = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string' && objectIds.has(parsed[0])) return JSON.stringify([objectId(parsed[0]), parsed[1] ? partId(parsed[0], parsed[1]) : '']);
        } catch { /* Preserve reserved/non-entity control markers. */ }
        return value;
    };
    const remapAuthoring = (draft: SceneAuthoringDraft, sourceKey: string): SceneAuthoringDraft => ({
        ...draft, draftId: fresh('draft'), sourceKey, revision: 0, plan: remapPlan(draft.plan), sourceState: remapState(draft.sourceState), rigs: remapRigs(draft.rigs),
        locomotion: draft.locomotion.map(objectId), manualControls: draft.manualControls.map(remapControl),
        moves: draft.moves.map(move => ({ ...move, id: fresh('move'), objectId: objectId(move.objectId) })),
        events: draft.events.map(event => ({ ...event, id: fresh('event'), objectId: objectId(event.objectId), ...(event.kind === 'attach' ? { parent: target(event.parent) } : {}) })),
        locks: draft.locks.map(lock => ({ ...lock, ...target(lock) })),
        ...(draft.masks ? { masks: draft.masks.map(mask => ({ ...mask, ...(typeof mask.objectId === 'string' ? target(mask) : {}), ...(mask.target ? { target: target(mask.target) } : {}) })) } : {}),
        ...(draft.cameraRig && 'target' in draft.cameraRig ? { cameraRig: { ...draft.cameraRig, target: target(draft.cameraRig.target) } } : {}),
    });
    const revision = crypto.randomUUID(), rootFrame = current.nodes[0]?.frameUrl || '';
    const nodes = preset.nodes?.length ? preset.nodes.map((node, index) => ({ id: nodeId(node.id), label: node.label || (index ? `Spot ${index + 1}` : 'Start'), ...(node.kind ? { kind: node.kind } : {}), frameUrl: rootFrame, createdAt: Date.now() }))
        : [{ id: fresh('n'), label: 'Start', frameUrl: rootFrame, createdAt: Date.now() }];
    const world = validateWorld({ ...current.ledger.world, revision, aspectRatio: preset.aspectRatio, plan: remapPlan(preset.plan), controlledObject: objectId(preset.controlledObject), controlMode: preset.controlMode,
        initialState: remapState(preset.initialState), locomotion: preset.locomotion,
        authoring: preset.authoring ? remapAuthoring(preset.authoring, `${current.sceneId}:${nodes[0].id}:${revision}`) : undefined,
        walkable: preset.walkable, obstacles: preset.obstacles, approved: true, reviewRejected: false, navigationNeedsReview: false });
    const connections = (preset.connections || []).map(edge => ({ ...edge, id: connectionIds.get(edge.id)!, sourceNodeId: nodeId(edge.sourceNodeId), targetNodeId: nodeId(edge.targetNodeId), forward: null, backward: null, status: 'draft' as const,
        movement: { ...edge.movement, id: fresh('movement'), sourceNodeId: nodeId(edge.sourceNodeId), createdAt: Date.now() } }));
    const routes: Record<string, SpatialRoute> = {};
    for (let index = 0; index < connections.length; index++) {
        const edge = connections[index], original = preset.connections![index], saved = preset.routes?.[original.id];
        if (!saved?.forward || edge.kind !== 'action' && !saved.backward) throw new Error('This stage preset has an incomplete motion route.');
        const adapt = (anim: NonNullable<typeof saved.forward>, direction: string) => ({
            id: fresh('animatic'), plan: remapPlan(anim.plan), prompt: anim.prompt, model: world.model, createdAt: Date.now(), ...(anim.creatorInstruction !== undefined ? { creatorInstruction: anim.creatorInstruction } : {}),
            sourceState: remapState(anim.sourceState), endState: remapState(anim.endState), stateChanges: cloneWorld(anim.stateChanges || {}),
            ...(anim.authoring ? { authoring: remapAuthoring(anim.authoring, `${current.sceneId}:${direction === 'forward' ? edge.sourceNodeId : edge.targetNodeId}:${revision}`) } : {}),
        });
        routes[edge.id] = { connectionId: edge.id, worldRevision: revision, forward: adapt(saved.forward, 'forward'), ...(saved.backward ? { backward: adapt(saved.backward, 'backward') } : {}) };
    }
    const states = Object.fromEntries(Object.entries(preset.states || {}).filter(([id]) => nodeIds.has(id)).map(([id, state]) => [nodeId(id), remapState(state)]));
    // Root authoring may contain edits newer than the source ledger's cached
    // root state. Its evaluated initial state owns the instantiated stage.
    states[nodes[0].id] = world.initialState;
    for (const edge of connections) states[edge.targetNodeId] ||= routes[edge.id].forward.endState;
    return { ...current, activeNodeId: nodes[0].id, nodes, connections, draftMovement: null, ledger: { version: 2, world, states, routes, jobs: [], epoch: (current.ledger.epoch || 0) + 1, generationStarted: false, boardOpen: false, view: 'three' } };
}
