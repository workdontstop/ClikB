const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
function load(file, mocks = {}, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache) : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename); return mod.exports;
}
const model = load('server/src/motionGuidePlan.ts'), worldModel = load('server/src/spatialWorld.ts');
const keys = (from = [0, 0, 0], to = from) => [0, 5].map((t, i) => ({ t, position: i ? to : from, rotation: [0, 0, 0], scale: [1, 1, 1] }));
const object = (id, shape = 'box') => ({ id, shape, color: '#ffaa66', keys: keys() });
const fixture = () => ({ version: 1, duration: 5, background: '#202838', objects: [{ ...object('knight'), keys: keys([0, 0, 0], [2, 0, 0]), parts: [
    { ...object('arm', 'capsule'), keys: keys([.3, .5, 0]) },
    { ...object('hand', 'sphere'), parentId: 'arm', keys: keys([0, -.5, 0]) },
    { ...object('held_blade', 'extrude'), identity: 'Silver sword', parentId: 'hand', geometry: { outline: [[-.03, 0], [.03, 0], [0, 1]], depth: .02 }, keys: keys([0, -.2, 0]) },
] }, { ...object('shield'), attachment: { objectId: 'knight', partId: 'hand' }, keys: keys([.2, 0, 0]) }], camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, 0, 0], fov: 45 })) });
const world = plan => worldModel.validateWorld({ version: 2, revision: 'test', model: 'luna', sourceImage: 'https://assets/scene.png', prompt: 'A knight', controlledObject: 'knight', controlMode: 'character', motionStyle: 'walk', plan, walkable: [{ min: [-5, -5, -5], max: [5, 5, 5] }], obstacles: [] });

test('richer geometry and attachments survive save, endpoint state and next recording', () => {
    const initial = world(fixture());
    const state = JSON.parse(JSON.stringify(worldModel.stateAtEnd(initial.plan, initial.initialState)));
    const next = model.validateMotionPlan(worldModel.planAtState(initial, state));
    assert.deepEqual(next.objects[0].parts.map(({ keys, ...part }) => part), initial.plan.objects[0].parts.map(({ keys, ...part }) => part));
    assert.deepEqual(next.objects[1].attachment, { objectId: 'knight', partId: 'hand' });
    const { createMotionScene } = load('src/motionScene.ts'), THREE = require('three');
    const scene = createMotionScene(next, 16 / 9); scene.draw(0);
    assert.deepEqual(scene.parts.get('knight').get('held_blade').getWorldPosition(new THREE.Vector3()).toArray(), [2.3, -.2, 0]);
    assert.deepEqual(scene.roots.get('shield').getWorldPosition(new THREE.Vector3()).toArray(), [2.5, 0, 0]); scene.dispose();
});
test('a moving hand carries equipment under nonuniform scales; shared assets reduce allocations', () => {
    const plan = fixture(); plan.objects[0].keys.forEach(key => key.scale = [2, 3, 1]);
    plan.objects[0].parts[0].keys[1].rotation[2] = Math.PI / 2;
    plan.objects.push({ ...object('other_hand', 'sphere'), keys: keys() });
    const { createMotionScene } = load('src/motionScene.ts'), THREE = require('three');
    const scene = createMotionScene(plan, 16 / 9); scene.draw(5);
    const blade = scene.parts.get('knight').get('held_blade'), hand = scene.parts.get('knight').get('hand');
    assert.ok(blade.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(4, 1.5, 0)) < 1e-8);
    assert.equal(hand.geometry, scene.roots.get('other_hand').children[0].geometry);
    assert.equal(hand.material, scene.roots.get('other_hand').children[0].material); scene.dispose();
});
test('capsule, tapered cylinder, tube and extruded geometry render with economical meshes', () => {
    const plan = fixture(); plan.objects = [{ ...object('capsule', 'capsule') }, { ...object('tail', 'tube'), geometry: { path: [[0, 0, 0], [.2, .2, 0], [.4, .3, 0]], radius: .03 } },
        { ...object('taper', 'cylinder'), geometry: { radiusTop: .1, radiusBottom: .4 } }, { ...object('blade', 'extrude'), geometry: { outline: [[0, 0], [.1, 0], [0, 1]], depth: .02 } }];
    const { createMotionScene } = load('src/motionScene.ts'); const scene = createMotionScene(plan, 16 / 9);
    assert.deepEqual([...scene.roots.values()].map(root => root.children[0].geometry.type), ['CapsuleGeometry', 'TubeGeometry', 'CylinderGeometry', 'ExtrudeGeometry']);
    assert.ok(scene.roots.get('taper').children[0].geometry.index.count / 3 <= 32); scene.dispose();
});
test('schema rejects missing/cyclic anchors and invalid custom geometry without accepting executable code', () => {
    for (const mutate of [p => p.objects[0].parts[0].parentId = 'missing', p => p.objects[0].parts[0].parentId = 'hand',
        p => p.objects[0].attachment = { objectId: 'shield' }, p => p.objects[1].attachment.partId = 'missing',
        p => p.objects[0].parts[2].geometry.outline = [[0, 0], [0, 0], [0, 0]], p => p.objects[0].shape = 'script']) {
        const p = fixture(); mutate(p); assert.throws(() => model.validateMotionPlan(p));
    }
});
test('ordinary quaternion turns and deliberate full Euler spins retain their distinct motion', () => {
    const p = fixture(); p.objects = [object('spin'), { ...object('turn'), rotationMode: 'quaternion' }];
    p.objects[0].keys[1].rotation[1] = 2 * Math.PI;
    p.objects[1].keys[0].rotation[1] = 170 * Math.PI / 180; p.objects[1].keys[1].rotation[1] = -170 * Math.PI / 180;
    const { createMotionScene } = load('src/motionScene.ts'), THREE = require('three'); const scene = createMotionScene(p, 16 / 9); scene.draw(2.5);
    assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(scene.roots.get('spin').quaternion).z < -.999);
    assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(scene.roots.get('turn').quaternion).z < -.999); scene.dispose();
});
test('sparse movement/action output retains carried identities; explicit releases remain possible', () => {
    const w = world(fixture()), source = w.initialState;
    const { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
    const raw = { ...fixture(), objects: [{ id: 'knight', parts: [{ id: 'arm', keys: keys() }] }] };
    for (const operation of ['movement', 'action']) {
        const result = prepareSpatialMotion(raw, w, source, w.plan, operation);
        assert.ok(result.plan.objects[0].parts.some(part => part.identity === 'Silver sword'));
        assert.ok(result.plan.objects[0].parts.some(part => part.id === 'hand'));
    }
    const detached = prepareSpatialMotion({ ...fixture(), objects: [{ ...fixture().objects[1], attachment: null }] }, w, source, w.plan, 'action', undefined, 5, 'Drop the shield.');
    assert.equal(detached.plan.objects.find(o => o.id === 'shield').attachment, undefined);
    assert.deepEqual(detached.plan.objects.find(o => o.id === 'shield').keys[0].position, [.5, 0, 0]);
});
test('explicit camera movement preserves recorded subject path; default camera remains exact', () => {
    const w = world(fixture()), raw = fixture(); raw.camera[1].position[0] = 3; raw.cameraInstruction = 'orbit the camera';
    const { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
    const explicit = prepareSpatialMotion(raw, w, w.initialState, w.plan, 'movement', undefined, 5, 'Move forward and orbit the camera');
    assert.deepEqual(explicit.plan.objects[0].keys, w.plan.objects[0].keys); assert.equal(explicit.plan.camera[1].position[0], 3);
    const plain = prepareSpatialMotion(raw, w, w.initialState, w.plan, 'movement'); assert.deepEqual(plain.plan.camera, w.plan.camera); assert.equal(plain.plan.cameraInstruction, undefined);
    assert.deepEqual(worldModel.planAtState(w, worldModel.stateAtEnd(explicit.plan, w.initialState)).camera[0].position, [3, 2, 6]);
});

test('drawing, dropping and remounting preserve the initial world pose across attachment changes', () => {
    const THREE = require('three'), { createMotionScene } = load('src/motionScene.ts'), { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
    const initial = fixture(); initial.objects[0].keys.forEach(key => key.position = [2, 0, 1]);
    initial.objects[0].parts.push({ ...object('belt'), keys: keys([-.4, -.1, 0]) });
    initial.objects[0].parts[2].parentId = 'belt';
    const w = world(initial), start = createMotionScene(initial, 1);
    const samePosition = (actual, expected) => assert.ok(actual.every((n, axis) => Math.abs(n - expected[axis]) < 1e-8), JSON.stringify({ actual, expected }));
    const bladePosition = start.parts.get('knight').get('held_blade').getWorldPosition(new THREE.Vector3()).toArray();
    const draw = structuredClone(initial); draw.objects[0].parts[2].parentId = 'hand'; draw.objects[0].parts[2].pivot = [.1, .2, 0];
    const drawn = prepareSpatialMotion(draw, w, w.initialState, w.plan, 'action', undefined, 5, 'Draw the sword').plan;
    const drawnScene = createMotionScene(drawn, 1);
    samePosition(drawnScene.parts.get('knight').get('held_blade').getWorldPosition(new THREE.Vector3()).toArray(), bladePosition);
    const drop = structuredClone(initial); drop.objects[0].releasedPartIds = ['held_blade']; drop.objects[0].parts.splice(2, 1);
    drop.objects.push({ ...object('loose_blade'), identity: 'Silver sword', shape: 'extrude', geometry: initial.objects[0].parts[2].geometry });
    const dropped = prepareSpatialMotion(drop, w, w.initialState, w.plan, 'action', undefined, 5, 'Drop the sword').plan;
    const droppedScene = createMotionScene(dropped, 1);
    samePosition(droppedScene.roots.get('loose_blade').getWorldPosition(new THREE.Vector3()).toArray(), bladePosition);
    const mount = structuredClone(initial); mount.objects.push({ ...object('dragon'), keys: keys([3, 0, 0]), parts: [{ ...object('saddle'), keys: keys([0, 1, 0]) }] });
    mount.objects[0].attachment = { objectId: 'dragon', partId: 'saddle' };
    const mounted = prepareSpatialMotion(mount, w, w.initialState, w.plan, 'action', undefined, 5, 'Mount the new dragon').plan;
    const mountedScene = createMotionScene(mounted, 1);
    assert.deepEqual(mountedScene.roots.get('knight').getWorldPosition(new THREE.Vector3()).toArray(), [2, 0, 1]);
    for (const scene of [start, drawnScene, droppedScene, mountedScene]) scene.dispose();
});

test('dependency-free backend attachment math matches Three.js for rotated, scaled and pivoted hierarchies', () => {
    const THREE = require('three'), { createMotionScene } = load('src/motionScene.ts');
    const backend = load('server/src/motionNodeTransforms.ts', { get three() { throw new Error('Backend imported frontend runtime'); } });
    const near = (actual, expected) => assert.ok(actual.every((n, i) => Math.abs(n - expected[i]) < 1e-8), JSON.stringify({ actual, expected }));
    for (let i = 0; i < 24; i++) {
        const plan = fixture();
        for (const [index, node] of [plan.objects[0], ...plan.objects[0].parts, plan.objects[1]].entries()) {
            node.keys = keys([.2 * index - 1, .13 * i, -.3 * index]);
            node.keys.forEach(key => { key.rotation = [i * .11 - 1, i === 23 ? Math.PI / 2 : i * .07 - .6, index * .35]; key.scale = [1 + index * .1, .8 + i * .03, 1.2]; });
            node.pivot = [.1, -.2, .03];
        }
        const scene = createMotionScene(plan, 1), blade = scene.parts.get('knight').get('held_blade'), shield = scene.roots.get('shield');
        for (const [id, partId, rendered] of [['knight', 'held_blade', blade], ['shield', undefined, shield]]) {
            const values = rendered.matrixWorld.elements;
            near(backend.initialMotionMatrix(plan, id, partId), [values[0], values[4], values[8], values[12], values[1], values[5], values[9], values[13], values[2], values[6], values[10], values[14]]);
            const parent = scene.parts.get('knight').get('hand');
            const relative = parent.matrixWorld.clone().invert().multiply(rendered.matrixWorld);
            const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(); relative.decompose(position, rotation, scale);
            const pivot = new THREE.Vector3(.2, -.1, .3), compensation = pivot.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(), rotation, scale)).sub(pivot); position.add(compensation);
            const actual = backend.initialMotionTransform(plan, id, { objectId: 'knight', partId: 'hand' }, { partId, pivot: pivot.toArray() });
            near(actual.position, position.toArray()); near(actual.scale, scale.toArray()); near(actual.rotation, new THREE.Euler().setFromQuaternion(rotation).toArray().slice(0, 3));
        }
        scene.dispose();
    }
});
test('vertical and directional input combine while walking, speed and facing defaults remain stable', () => {
    const w = world(fixture()), { creationDriveStep } = load('src/spatialCreationDrive.ts'), last = w.initialState.objects.knight.transform;
    const stick = { x: 0, y: 1, active: true };
    assert.equal(creationDriveStep(w, w.initialState, last, stick, 1, { vertical: 1 }).position[1], .65, 'explicit height must work before any AI flight classification');
    w.locomotion = { kind: 'air', vertical: true, speed: 1, turnRate: 2 };
    const flown = creationDriveStep(w, w.initialState, last, stick, 1, { vertical: 1, speedMultiplier: 2 });
    assert.equal(flown.position[1], 2); assert.equal(flown.position[2], -2);
    const rise = creationDriveStep(w, w.initialState, last, { x: 0, y: 0, active: false }, 1, { vertical: 1 });
    assert.deepEqual(rise.rotation, last.rotation); assert.equal(rise.position[1], 1);
});
test('selected rider identity binds the outer mounted unit instead of moving the rider independently', () => {
    const p = fixture(); p.objects[0].parts[0].identity = 'Ranger';
    assert.equal(worldModel.selectedWorldControl(p, 'Ranger', [{ name: 'Ranger', imageUrl: 'https://assets/ranger.png' }], 'shield').controlledObject, 'knight');
});

test('mount then move then dismount resolves the chronological driven unit and its vertical capabilities', () => {
    const initial = fixture(), w = world(initial); w.drivenName = 'knight';
    const mounted = structuredClone(initial); mounted.objects[0].attachment = { objectId: 'dragon', partId: 'saddle' };
    mounted.objects.push({ ...object('dragon'), parts: [{ ...object('saddle'), keys: keys([0, 1, 0]) }] });
    const source = worldModel.stateAtEnd(mounted, w.initialState); source.locomotion = { kind: 'air', vertical: true, speed: 1.2, turnRate: 2 };
    const driven = worldModel.worldAtState(w, source);
    assert.equal(driven.controlledObject, 'dragon'); assert.equal(driven.controlMode, 'mounted'); assert.equal(driven.locomotion.vertical, true);
    const recorded = worldModel.planAtState(driven, source); recorded.objects.find(object => object.id === 'dragon').keys[1].position = [2, 2, 0];
    const { createMotionScene } = load('src/motionScene.ts'), THREE = require('three'), scene = createMotionScene(recorded, 1); scene.draw(5);
    assert.deepEqual(scene.roots.get('knight').getWorldPosition(new THREE.Vector3()).toArray(), [4, 3, 0]); scene.dispose();
    const ended = worldModel.stateAtEnd(recorded, source), dismount = worldModel.planAtState(driven, ended); dismount.objects[0].attachment = null;
    const { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
    const unmounted = worldModel.stateAtEnd(prepareSpatialMotion(dismount, driven, ended, dismount, 'action', undefined, 5, 'Dismount').plan, ended);
    unmounted.locomotion = { kind: 'ground', vertical: false, speed: .65, turnRate: 3 };
    const walking = worldModel.worldAtState(w, unmounted); assert.equal(walking.controlledObject, 'knight'); assert.equal(walking.controlMode, 'character'); assert.equal(walking.locomotion.vertical, false);
    const manuallySelected = { ...w, controlledObject: 'shield' };
    assert.equal(worldModel.worldAtState(manuallySelected, w.initialState).controlledObject, 'knight', 'an attached selected prop should resolve its outer owner');
    const separate = worldModel.stateAtEnd({ ...initial, objects: [...initial.objects, object('chair')] }, w.initialState);
    assert.equal(worldModel.worldAtState({ ...w, controlledObject: 'chair' }, separate).controlledObject, 'chair', 'old driven name overrode a manual selection');
    const { spatialGenerationGuidanceInput } = load('server/src/spatialGenerationGuidance.ts', { './SpatialMotionContext': {} });
    const animation = { id: 'mounted-move', plan: recorded, sourceState: source, endState: ended, prompt: 'Follow the motion reference from its start to its end.' };
    const input = spatialGenerationGuidanceInput({ sceneId: 'scene', connections: [], ledger: { world: w, routes: { edge: { forward: animation } }, jobs: [] } }, { connectionId: 'edge', sourceNodeId: 'mounted', direction: 'forward', kind: 'movement', dependsOn: [], prompt: animation.prompt });
    assert.equal(input.referenceMotion.controlledObject, 'dragon'); assert.equal(input.referenceMotion.controlMode, 'mounted');
});
test('preview balance rerenders and close/reopen reuse one submitted request and its result', async () => {
    const { PreviewImageRequests } = load('src/previewImageRequests.ts'); const requests = new PreviewImageRequests(); let calls = 0, resolve;
    const work = () => { calls++; return new Promise(r => resolve = r); };
    const first = requests.run('same-inputs', work), pending = requests.run('same-inputs', work); await Promise.resolve();
    assert.equal(calls, 1); resolve('saved-image'); assert.equal(await first, 'saved-image'); assert.equal(await pending, 'saved-image');
    assert.equal(await requests.run('same-inputs', work), 'saved-image'); assert.equal(calls, 1);
    const cancelled = requests.run('closed-before-submission', work); requests.setEnabled(false);
    await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(calls, 1); assert.equal(requests.has('closed-before-submission'), false);
    requests.setEnabled(true); const reopened = requests.run('closed-before-submission', work); await Promise.resolve(); resolve('new-image'); assert.equal(await reopened, 'new-image'); assert.equal(calls, 2);
});
