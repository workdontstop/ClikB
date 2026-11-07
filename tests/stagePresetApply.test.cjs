const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { validateWorld, newWorldState } = require('../server/src/spatialWorld.ts');
const { validateMotionPlan } = require('../server/src/motionGuidePlan.ts');
const { createAuthoringDraft, evaluateAuthoringDraft } = require('../server/src/sceneAuthoring.ts');
const { extractStagePreset } = require('../server/src/scenePresets.ts');
const { applySavedStagePreset } = require('../src/applySavedStagePreset.ts');
const key = (t, position = [0, 0, 0], scale = [1, 1, 1]) => ({ t, position, rotation: [0, 0, 0], scale });
const track = (position, scale) => [0, 5].map(t => key(t, position, scale));

function fixture() {
    const plan = validateMotionPlan({ version: 1, duration: 5, background: '#edf5fc', camera: [0, 5].map(t => ({ t, position: [0, 3, 8], target: [0, 1, 0], fov: 45 })), objects: [
        { id: 'ground', shape: 'box', color: '#ffffff', surface: 'ground', role: 'scenery', keys: track([0, -.1, 0], [10, .2, 10]) },
        { id: 'actor', shape: 'box', color: '#6686b3', role: 'actor', keys: track([0, 0, 0]), parts: [
            { id: 'box', shape: 'box', color: '#6686b3', keys: track([0, 1, 0], [.6, 1, .4]) },
            { id: 'ground', shape: 'sphere', color: '#6686b3', parentId: 'box', keys: track([0, .8, 0], [.5, .5, .5]) },
        ] },
        { id: 'box', shape: 'box', color: '#ffcc66', role: 'prop', attachment: { objectId: 'actor', partId: 'ground' }, keys: track([.5, 0, 0], [.2, .2, .2]) },
        { id: 'label', shape: 'text', color: '#111111', text: { content: 'actor' }, keys: track([0, 2.5, 0]) },
    ] });
    const state = newWorldState(plan);
    state.conditions = { actor: 'ground', box: 'actor' };
    state.relationships = [{ from: 'actor', to: 'box', relation: 'holds', facts: { label: 'actor' } }];
    state.objects.actor.facts = { actor: 'box', label: 'ground' };
    state.objects.actor.assets = ['https://assets.test/actor'];
    const world = validateWorld({ version: 2, revision: 'donor-world', model: 'luna', sourceImage: 'https://assets.test/scene.jpg', plan,
        controlledObject: 'actor', controlMode: 'character', initialState: state, walkable: [{ min: [-5, 0, -5], max: [5, 3, 5] }], obstacles: [], approved: true,
        locomotion: { kind: 'air', vertical: true, speed: 1.5, turnRate: 1 } });
    const rigs = { actor: { kind: 'biped', controls: { actor: 'box', ground: 'ground' }, strideLength: 1.3, hipHeight: 1 } };
    const authoring = createAuthoringDraft(plan, 'donor:actor:donor-world', rigs, world.initialState);
    authoring.manualControls = [JSON.stringify(['actor', 'box']), JSON.stringify(['$camera', ''])];
    authoring.cameraRig = { kind: 'mounted', target: { objectId: 'actor', partId: 'ground' }, focalLengthMm: 35, offset: [0, .2, 1], lookOffset: [0, 0, 0] };
    authoring.lightingRig = { preset: 'golden', azimuthDeg: -55, elevationDeg: 22, intensity: 1.1 };
    authoring.locks = [{ objectId: 'actor', partId: 'box', time: 0, end: 5, channels: ['rotation'], pose: plan.objects[1].parts[0].keys[0] }];
    authoring.masks = [{ objectId: 'actor', partId: 'ground', target: { objectId: 'actor', partId: 'ground' }, start: 0, end: 5, channels: ['position'] }];
    authoring.events = [{ id: 'ground', kind: 'facts', objectId: 'actor', time: 1, addFacts: ['box'], conditions: { actor: 'ground' } }];
    const forward = { id: 'donor-paid-animation', plan, sourceState: authoring.sourceState, endState: evaluateAuthoringDraft(authoring, 5).state, stateChanges: {}, prompt: 'actor', model: 'luna', createdAt: 1, authoring };
    const nodes = [{ id: 'actor', label: 'actor', frameUrl: world.sourceImage, createdAt: 1 }, { id: 'ground', label: 'ground', frameUrl: world.sourceImage, createdAt: 1 }];
    const connections = [{ id: 'box', sourceNodeId: 'actor', targetNodeId: 'ground', kind: 'action', actionPlayback: 'tap', actionPrompt: 'actor', movement: { durationMs: 5000, samples: [] } }];
    const source = { sceneId: 'donor', activeNodeId: 'actor', nodes, connections, draftMovement: null, ledger: { version: 2, world, states: { actor: world.initialState, ground: forward.endState }, routes: { box: { connectionId: 'box', worldRevision: world.revision, forward } }, jobs: [{ id: 'must-not-import', pixels: 100 }], epoch: 4, generationStarted: true, boardOpen: true, view: 'video' } };
    const preset = extractStagePreset(world, rigs, { title: 'actor', description: 'ground' }, { nodes, connections, routes: source.ledger.routes, states: source.ledger.states, authoring });
    assert.ok(preset.authoring, 'extraction preserves the authored root stage');
    assert.deepEqual(preset.locomotion, world.locomotion, 'extraction preserves movement capabilities');
    const current = { ...structuredClone(source), sceneId: 'destination', nodes: [{ id: 'destination-root', label: 'Start', frameUrl: 'https://assets.test/current.jpg', createdAt: 1 }], connections: [], activeNodeId: 'destination-root', ledger: { ...source.ledger, world: { ...world, locomotion: { kind: 'ground', vertical: false, speed: .65, turnRate: 1 } }, states: { 'destination-root': world.initialState }, routes: {}, jobs: [], epoch: 9, generationStarted: false } };
    return { source, preset, current };
}

test('stage presets preserve primitive/role/surface/text/semantic values when IDs are box, ground and actor', () => {
    const { preset, current } = fixture(), before = JSON.stringify(preset), currentBefore = JSON.stringify(current);
    const result = applySavedStagePreset(current, preset), objects = result.ledger.world.plan.objects;
    assert.equal(objects[0].shape, 'box'); assert.equal(objects[0].surface, 'ground'); assert.equal(objects[0].role, 'scenery');
    assert.equal(objects[1].role, 'actor'); assert.equal(objects[2].shape, 'box'); assert.equal(objects[3].text.content, 'actor');
    assert.equal(result.ledger.world.controlMode, 'character'); assert.deepEqual(result.ledger.world.initialState.conditions, { actor: 'ground', box: 'actor' });
    assert.equal(result.nodes[0].label, 'actor'); assert.equal(result.nodes[1].label, 'ground'); assert.equal(result.connections[0].kind, 'action');
    assert.equal(result.connections[0].actionPrompt, 'actor'); assert.equal(result.ledger.routes[result.connections[0].id].forward.prompt, 'actor');
    assert.equal(JSON.stringify(preset), before); assert.equal(JSON.stringify(current), currentBefore);
});

test('stage application remaps only typed entity, nested part, attachment, state and route references', () => {
    const { preset, current } = fixture(), result = applySavedStagePreset(current, preset), world = result.ledger.world;
    const [ground, actor, prop] = world.plan.objects, [body, head] = actor.parts, edge = result.connections[0], route = result.ledger.routes[edge.id];
    for (const value of [ground.id, actor.id, prop.id, body.id, head.id, edge.id, ...result.nodes.map(node => node.id)]) assert.ok(!['ground', 'actor', 'box'].includes(value));
    assert.notEqual(actor.id, result.nodes[0].id, 'entity and node namespaces must remain separate');
    assert.equal(head.parentId, body.id); assert.deepEqual(prop.attachment, { objectId: actor.id, partId: head.id });
    assert.equal(world.controlledObject, actor.id); assert.equal(edge.sourceNodeId, result.nodes[0].id); assert.equal(edge.targetNodeId, result.nodes[1].id);
    assert.equal(edge.movement.sourceNodeId, result.nodes[0].id); assert.equal(route.connectionId, edge.id); assert.equal(route.worldRevision, world.revision);
    assert.deepEqual(route.forward.sourceState.objects[prop.id].geometry.attachment, prop.attachment);
    assert.equal(route.forward.sourceState.objects[actor.id].geometry.parts[1].parentId, body.id);
    assert.ok(route.forward.sourceState.objects[actor.id].parts[body.id]);
    assert.deepEqual(route.forward.sourceState.objects[actor.id].facts, { actor: 'box', label: 'ground' });
    assert.deepEqual(route.forward.sourceState.relationships[0], { from: actor.id, to: prop.id, relation: 'holds', facts: { label: 'actor' } });
    assert.ok(result.ledger.states[result.nodes[1].id]); validateMotionPlan(world.plan); validateMotionPlan(route.forward.plan);
});

test('authoring controls, pins, masks, rigs, camera targets and source ownership follow the instantiated stage', () => {
    const { preset, current } = fixture(), result = applySavedStagePreset(current, preset), actor = result.ledger.world.plan.objects[1], edge = result.connections[0];
    const routeDraft = result.ledger.routes[edge.id].forward.authoring;
    assert.notEqual(routeDraft.draftId, preset.routes.box.forward.authoring.draftId);
    assert.equal(routeDraft.sourceKey, `${current.sceneId}:${edge.sourceNodeId}:${result.ledger.world.revision}`);
    assert.equal(routeDraft.rigs[actor.id].kind, 'biped'); assert.equal(routeDraft.rigs[actor.id].controls.actor, actor.parts[0].id); assert.equal(routeDraft.rigs[actor.id].controls.ground, actor.parts[1].id);
    assert.deepEqual(JSON.parse(routeDraft.manualControls[0]), [actor.id, actor.parts[0].id]); assert.equal(routeDraft.manualControls[1], JSON.stringify(['$camera', '']));
    assert.equal(routeDraft.locks[0].objectId, actor.id); assert.equal(routeDraft.locks[0].partId, actor.parts[0].id); assert.deepEqual(routeDraft.locks[0].channels, ['rotation']);
    assert.deepEqual(routeDraft.masks[0].target, { objectId: actor.id, partId: actor.parts[1].id });
    assert.deepEqual(routeDraft.cameraRig.target, { objectId: actor.id, partId: actor.parts[1].id }); assert.equal(routeDraft.cameraRig.kind, 'mounted');
    assert.equal(routeDraft.events[0].objectId, actor.id); assert.notEqual(routeDraft.events[0].id, 'ground'); assert.deepEqual(routeDraft.events[0].addFacts, ['box']);
    assert.equal(routeDraft.lightingRig.preset, 'golden');
    assert.deepEqual(result.ledger.world.locomotion, preset.locomotion);
    assert.ok(result.ledger.world.authoring);
    assert.equal(result.ledger.world.authoring.sourceKey, `${current.sceneId}:${result.nodes[0].id}:${result.ledger.world.revision}`); assert.equal(result.ledger.world.authoring.cameraRig.target.objectId, actor.id);
});

test('legacy stage payloads do not inherit the destination stage authoring or movement capabilities', () => {
    const { preset, current } = fixture();
    current.ledger.world.authoring = structuredClone(preset.authoring);
    delete preset.authoring; delete preset.locomotion;
    const result = applySavedStagePreset(current, preset);
    assert.equal(result.ledger.world.authoring, undefined); assert.equal(result.ledger.world.locomotion, undefined);
});

test('a root authoring correction overrides a stale ledger root cache when the stage is applied', () => {
    const { preset, current } = fixture();
    const actor = preset.authoring.plan.objects.find(object => object.id === 'actor');
    actor.keys.forEach(pose => pose.position[0] = 2);
    preset.plan = structuredClone(preset.authoring.plan);
    const result = applySavedStagePreset(current, preset), actorId = result.ledger.world.controlledObject;
    assert.equal(result.ledger.world.initialState.objects[actorId].transform.position[0], 2);
    assert.equal(result.ledger.states[result.activeNodeId].objects[actorId].transform.position[0], 2);
});

test('repeated applications allocate fresh project identities and never import live jobs or media receipts', () => {
    const { preset, current } = fixture(); preset.jobs = [{ id: 'paid' }]; preset.routes.box.forward.referenceVideo = 'https://private.test/paid.mp4'; preset.routes.box.forward.billingReceipt = 'private';
    const first = applySavedStagePreset(current, preset), second = applySavedStagePreset(current, preset);
    assert.notEqual(first.nodes[0].id, second.nodes[0].id); assert.notEqual(first.ledger.world.plan.objects[0].id, second.ledger.world.plan.objects[0].id);
    assert.notEqual(first.ledger.world.revision, second.ledger.world.revision);
    assert.deepEqual(first.ledger.jobs, []); assert.equal(first.ledger.epoch, current.ledger.epoch + 1); assert.equal(first.ledger.generationStarted, false); assert.equal(first.ledger.view, 'three');
    const route = first.ledger.routes[first.connections[0].id].forward;
    assert.equal(route.referenceVideo, undefined); assert.equal(route.billingReceipt, undefined); assert.equal(first.sceneId, current.sceneId); assert.equal(first.nodes[0].frameUrl, current.nodes[0].frameUrl);
});
