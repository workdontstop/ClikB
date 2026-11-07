const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const THREE = require('three');
const root = path.resolve(__dirname, '..');
function load(file, cache = new Map()) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), cache) : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const { creationDriveStep, creationOrientationAxes } = load('src/spatialCreationDrive.ts');
const { validateWorld, planAtState } = load('server/src/spatialWorld.ts');
const { validateMotionPlan } = load('server/src/motionGuidePlan.ts');
const { createMotionScene } = load('src/motionScene.ts');
const key = (t = 0, position = [0, 1, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => ({ t, position, rotation, scale });
const part = (id, position, extra = {}) => ({ id, shape: 'box', color: '#ffffff', keys: [0, 5].map(t => key(t, position)), ...extra });
function fixture(parts, controlMode = 'character') {
    const plan = { version: 1, duration: 5, background: '#111111', objects: [{ id: 'subject', shape: 'box', color: '#ffffff', keys: [key(), key(5)], ...(parts ? { parts } : {}) }],
        camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, 1, 0], fov: 45 })) };
    return validateWorld({ version: 2, model: 'luna', plan, controlledObject: 'subject', controlMode, motionStyle: 'walk', locomotion: { kind: 'ground', vertical: false, speed: 1, turnRate: 3 }, walkable: [{ min: [-10, -10, -10], max: [10, 10, 10] }], obstacles: [], approved: true });
}
const near = (a, b, message) => assert.ok(a.every((n, i) => Math.abs(n - b[i]) < 1e-8), message || JSON.stringify({ a, b }));
const rotation = value => new THREE.Quaternion().setFromEuler(new THREE.Euler(...value));

test('all stick directions remain camera-relative after yaw, pitch, roll or inverted orientation', () => {
    const headings = [[0, Math.PI, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI], [.9, 2.7, -1.2]];
    for (const camera of [[0, 2, 6], [6, 2, 0], [-3, 2, -5]]) {
        const world = fixture(), state = world.initialState; state.camera.position = camera;
        const initial = state.objects.subject.transform, before = JSON.stringify(world);
        for (let angle = 0; angle < 2 * Math.PI - .01; angle += Math.PI / 4) {
            const sample = { x: Math.cos(angle), y: Math.sin(angle), active: true };
            const ordinary = creationDriveStep(world, state, initial, sample, .05);
            for (const heading of headings) for (const vertical of [-1, 0, 1]) {
                const driven = creationDriveStep(world, state, initial, sample, .05, { heading, vertical });
                near(driven.position, [ordinary.position[0], initial.position[1] + vertical * .05, ordinary.position[2]], 'rotation changed stick travel');
                near(driven.rotation, heading, 'travel changed explicit facing');
            }
        }
        assert.equal(JSON.stringify(world), before, 'control simulation mutated the saved world');
    }
});

test('explicit height freely moves every control mode without inventing a flight profile', () => {
    for (const mode of ['character', 'vehicle', 'mounted', 'pov', 'other']) {
        const world = fixture(undefined, mode), state = world.initialState, initial = state.objects.subject.transform;
        for (const vertical of [-1, 1]) {
            const driven = creationDriveStep(world, state, initial, { x: 0, y: 0, active: false }, .1, { vertical, speedMultiplier: 2 });
            near(driven.position, [0, 1 + .2 * vertical, 0]); near(driven.rotation, initial.rotation);
        }
        assert.equal(world.locomotion.vertical, false);
    }
});

test('yaw, nose tilt and roll rotate in place; height remains independently combinable', () => {
    const world = fixture([part('body', [0, 0, 0]), part('muzzle', [1, .3, 0]), part('tail', [-1, 0, 0])]);
    const state = world.initialState, initial = state.objects.subject.transform;
    for (const rotationMode of ['horizontal', 'vertical', 'roll']) {
        const sample = { x: rotationMode === 'vertical' ? 0 : 1, y: rotationMode === 'vertical' ? 1 : 0, active: true };
        const turned = creationDriveStep(world, state, initial, sample, .1, { rotationMode });
        near(turned.position, initial.position);
        assert.ok(rotation(turned.rotation).angleTo(rotation(initial.rotation)) > .29);
        const rising = creationDriveStep(world, state, initial, sample, .1, { rotationMode, vertical: 1 });
        near(rising.position, [0, 1.1, 0]); near(rising.rotation, turned.rotation);
    }
});

test('pitch raises an actual side-facing nose rather than rolling the body sideways', () => {
    for (const front of [[1, .3, 0], [-1, .3, 0], [0, .3, 1], [0, .3, -1]]) {
        const world = fixture([part('body', [0, 0, 0]), part('muzzle', front), part('tail', front.map(n => -n))]);
        const state = world.initialState, initial = state.objects.subject.transform;
        const next = creationDriveStep(world, state, initial, { x: 0, y: 1, active: true }, .1, { rotationMode: 'vertical' });
        const forward = new THREE.Vector3(...creationOrientationAxes(world, state).forward).applyQuaternion(rotation(next.rotation));
        assert.ok(forward.y > .29, 'nose-up drag did not pitch the proxy nose upward');
        const scene = createMotionScene(planAtState(world, state), 1);
        const frame = planAtState(world, state); frame.objects[0].keys = [next, { ...next, t: 5 }]; scene.draw(0, frame);
        const nose = scene.parts.get('subject').get('muzzle').getWorldPosition(new THREE.Vector3());
        const body = scene.parts.get('subject').get('body').getWorldPosition(new THREE.Vector3());
        assert.ok(nose.y - body.y > .5, 'rendered nose did not rise'); scene.dispose();
    }
});

test('pitch and roll follow carrier landmarks through nested transforms, source orientation and state geometry', () => {
    const neck = part('neck', [0, .5, 0]); neck.keys.forEach(k => { k.rotation = [0, -Math.PI / 2, 0]; k.scale = [2, 1, 1]; });
    const world = fixture([part('body', [0, 0, 0]), neck, part('muzzle', [0, 0, 1], { parentId: 'neck', pivot: [.2, 0, 0] }), part('rider_head', [0, 2, 4])], 'mounted');
    const state = world.initialState, initial = state.objects.subject.transform; initial.rotation = [0, .7, 0];
    const frame = creationOrientationAxes(world, state);
    assert.ok(frame.forward[0] < -.98, 'nested nose orientation or rider exclusion failed');
    const pitch = creationDriveStep(world, state, initial, { x: 0, y: 1, active: true }, .1, { rotationMode: 'vertical' });
    assert.ok(new THREE.Vector3(...frame.forward).applyQuaternion(rotation(pitch.rotation)).y > .29);
    const roll = creationDriveStep(world, state, initial, { x: 1, y: 0, active: true }, .1, { rotationMode: 'roll' });
    near(new THREE.Vector3(...frame.forward).applyQuaternion(rotation(roll.rotation)).toArray(), new THREE.Vector3(...frame.forward).applyQuaternion(rotation(initial.rotation)).toArray(), 'roll changed nose direction');
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation(roll.rotation));
    assert.ok(up.dot(new THREE.Vector3(...frame.right).applyQuaternion(rotation(initial.rotation))) > .29, 'right input did not bank right');
    state.objects.subject.geometry.parts = [part('body', [0, 0, 0]), part('nose', [0, 0, -2])].map(({ keys, ...geometry }) => geometry);
    state.objects.subject.parts = { body: key(0, [0, 0, 0]), nose: key(0, [0, 0, -2]) };
    near(creationOrientationAxes(world, state).forward, [0, 0, -1], 'current node geometry was ignored');
});

test('paired front/rear wheels define the car length rather than a diagonal corner', () => {
    const world = fixture([part('chassis', [0, 0, 0]), ...[-1, 1].flatMap(z => [part(`front_wheel_${z < 0 ? 'left' : 'right'}`, [2, -.3, z]), part(`rear_wheel_${z < 0 ? 'left' : 'right'}`, [-2, -.3, z])])], 'vehicle');
    const state = world.initialState, initial = state.objects.subject.transform;
    near(creationOrientationAxes(world, state).forward, [1, 0, 0]);
    const next = creationDriveStep(world, state, initial, { x: 0, y: 1, active: true }, .1, { rotationMode: 'vertical' });
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation(next.rotation));
    assert.ok(up.x < -.29); assert.ok(Math.abs(up.z) < 1e-8, 'nose tilt included a side roll');
});

test('unlabelled old worlds retain their authored camera frame and ordinary walking facing rules', () => {
    for (const yaw of [0, Math.PI / 2, -2.4]) {
        const world = fixture(), state = world.initialState, initial = state.objects.subject.transform; initial.rotation = [0, yaw, 0];
        const axes = creationOrientationAxes(world, state);
        near(new THREE.Vector3(...axes.forward).applyQuaternion(rotation(initial.rotation)).toArray(), [0, 0, -1]);
        const pitched = creationDriveStep(world, state, initial, { x: 0, y: 1, active: true }, .1, { rotationMode: 'vertical' });
        assert.ok(new THREE.Vector3(...axes.forward).applyQuaternion(rotation(pitched.rotation)).y > .29);
        const walked = creationDriveStep(world, state, initial, { x: 0, y: 1, active: true }, .1);
        near(walked.rotation, initial.rotation, 'ordinary forward input replaced saved facing');
    }
    for (const mode of ['vehicle', 'mounted']) {
        const world = fixture(undefined, mode), state = structuredClone(world.initialState); state.objects.subject.transform.rotation[1] = 1.9;
        const moved = creationDriveStep(world, state, state.objects.subject.transform, { x: 0, y: 1, active: true }, .1);
        near(moved.rotation, state.objects.subject.transform.rotation, 'next-node carrier snapped back to initial-world heading');
    }
});

test('complete turns on each axis remain valid and continuous through actual quaternion playback', () => {
    for (const mode of ['horizontal', 'vertical', 'roll']) {
        const world = fixture([part('body', [0, 0, 0]), part('nose', [1, 0, 0])]), state = world.initialState;
        const recorded = planAtState(world, state), object = recorded.objects[0]; object.rotationMode = 'quaternion'; object.keys = [key()];
        let current = key();
        const sample = { x: mode === 'vertical' ? 0 : 1, y: mode === 'vertical' ? 1 : 0, active: true };
        for (let i = 1; i <= 250; i++) {
            const next = creationDriveStep(world, state, current, sample, .02, { rotationMode: mode }); next.t = i * .02;
            assert.ok(rotation(current.rotation).angleTo(rotation(next.rotation)) < .061, 'orientation jumped at an Euler boundary');
            current = next; if (i % 6 === 0 || i === 250) object.keys.push(structuredClone(next));
        }
        assert.ok(object.keys.length <= 48); validateMotionPlan(recorded);
        const renderer = createMotionScene(recorded, 1), axis = mode === 'horizontal' ? new THREE.Vector3(0, -1, 0) : mode === 'vertical' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        for (const time of [1.7, 2.4, 3.8, 4.6, 5]) {
            renderer.draw(time); const expected = new THREE.Quaternion().setFromAxisAngle(axis, time * 3);
            assert.ok(renderer.roots.get('subject').quaternion.angleTo(expected) < 1e-7, 'recorded full turn was flattened or replayed backwards');
        }
        renderer.dispose();
    }
});
