const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const THREE = require('three');

function load(file, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => name.startsWith('.')
        ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return mod.exports;
}
const { validateMotionPlan } = load('server/src/motionGuidePlan.ts');
const { prepareMotionGuide, prepareMotionBlockout } = load('server/src/motionBlockout.ts');
const { createMotionScene, createMotionTextCanvas } = load('src/motionScene.ts');
const key = (t, position = [0, 0, 0], rotation = [0, 0, 0], extra = {}) => ({ t, position, rotation, scale: [1, 1, 1], ...extra });
const fixture = () => ({ version: 1, duration: 5, background: '#ffffff', objects: [{
    id: 'actor', role: 'actor', shape: 'box', color: '#112233', keys: [key(0), key(5)], parts: [{
        id: 'hand', shape: 'box', color: '#112233', keys: [key(0, [0, 1, 0]), key(1, [0, 1, 0]), key(2.5, [1, 2, 0], [0, Math.PI * 2, 0]), key(5, [0, 1, 0], [0, Math.PI * 4, 0])],
    }],
}], camera: [0, 2, 5].map(t => ({ t, position: [t / 5, 2, 6], target: [0, 1, 0], fov: 45 })) });

test('normal reference preserves articulated timing, holds, spins and attached contact without static subject fitting', () => {
    const input = fixture();
    input.objects.push({ id: 'prop', shape: 'box', role: 'prop', color: '#334455', attachment: { objectId: 'actor', partId: 'hand' }, keys: [key(0, [0, .5, 0]), key(5, [0, .5, 0])] });
    const before = JSON.stringify(input);
    const layout = { camera: 'eye level', landmarks: [{ id: 'actor', description: 'moving actor', box: [.7, .2, .2, .6], occluded: false }] };
    const output = prepareMotionGuide(input, '9:16', layout);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(output.objects.slice(0, 2), input.objects);
    assert.deepEqual(output.camera, input.camera);
    const scene = createMotionScene(output, 9 / 16);
    for (const t of [0, .8, 1.4, 2.5, 4, 5]) {
        scene.draw(t);
        const hand = scene.parts.get('actor').get('hand');
        const contact = new THREE.Vector3(0, .5, 0).applyMatrix4(hand.matrixWorld);
        assert.ok(scene.roots.get('prop').getWorldPosition(new THREE.Vector3()).distanceTo(contact) < 1e-7);
    }
    scene.draw(2.5); assert.equal(scene.parts.get('actor').get('hand').rotation.y, Math.PI * 2);
    scene.dispose();
});

test('normal reference rejects lossy shorthand, missing/endless tracks and duplicate timing while spatial reconstruction retains shorthand', () => {
    const compact = { format: 'connected-primitives', duration: 5, camera: { position: [0, 2, 6], target: [0, 1, 0], fov: 45 }, objects: [{ id: 'static_prop', shape: 'box', size: [1, 1, 1], position: [0, 0, 0] }] };
    assert.throws(() => prepareMotionGuide(compact, '16:9'), /version/);
    assert.equal(prepareMotionBlockout(compact, '16:9').objects[0].keys.length, 2);
    for (const change of [p => p.objects[0].parts[0].keys = [key(0)], p => p.camera = undefined,
        p => p.objects[0].parts[0].keys[1].t = 0, p => p.objects[0].keys[1].t = 4,
        p => p.objects[0].keys = Array.from({ length: 97 }, (_, i) => key(i * 5 / 96))]) {
        const plan = fixture(); change(plan); assert.throws(() => prepareMotionGuide(plan, '16:9'));
    }
    const staticPlan = fixture(); staticPlan.objects[0].parts[0].keys = [key(0), key(5)];
    assert.deepEqual(prepareMotionGuide(staticPlan, '1:1').objects[0], staticPlan.objects[0]);
});

test('source camera fitting retains each authored camera delta and track timestamp', () => {
    const input = fixture(); input.objects.push({ id: 'landmark', shape: 'box', color: '#334455', keys: [key(0, [3, 1, -2]), key(5, [3, 1, -2])] });
    const layout = { camera: 'eye level', landmarks: [{ id: 'actor', description: 'actor', box: [.15, .35, .2, .5], occluded: false }, { id: 'landmark', description: 'prop', box: [.65, .45, .15, .2], occluded: false }] };
    const output = prepareMotionGuide(input, '16:9', layout);
    assert.deepEqual(output.objects.slice(0, 2), input.objects);
    assert.deepEqual(output.camera.map(k => k.t), input.camera.map(k => k.t));
    for (const field of ['position', 'target']) for (let i = 1; i < input.camera.length; i++) for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(output.camera[i][field][axis] - output.camera[0][field][axis] - input.camera[i][field][axis] + input.camera[0][field][axis]) < 1e-8);
    }
});

function textCanvasHarness(run) {
    const previous = global.document, painted = [], canvases = [];
    global.document = { createElement(tag) {
        assert.equal(tag, 'canvas');
        const context = { measureText: text => ({ width: text.length * 30 }), scale() {}, fillRect() {},
            fillText(text) { painted.push({ text, color: this.fillStyle, font: this.font }); }, strokeText() {} };
        const canvas = { width: 0, height: 0, getContext: () => context }; canvases.push(canvas); return canvas;
    } };
    try { return run({ painted, canvases }); } finally { if (previous === undefined) delete global.document; else global.document = previous; }
}

test('literal text schema preserves words and styles, rejects invalid data, and paints exact requested content without palette tint', () => textCanvasHarness(({ painted }) => {
    const plan = fixture(); plan.objects.push({ id: 'words', shape: 'text', color: '#A15BD4', text: {
        content: 'Come @Closer\nIt’s Casey’s title', fontFamily: 'serif', fontWeight: 700, italic: true, align: 'left', strokeColor: '#123456', strokeWidth: 2,
    }, keys: [key(0), key(5)] });
    const parsed = validateMotionPlan(plan); assert.deepEqual(parsed.objects[1].text, plan.objects[1].text);
    const canvas = createMotionTextCanvas(parsed.objects[1]); assert.ok(canvas.width <= 2048 && canvas.height <= 2048);
    assert.deepEqual(painted.map(item => item.text), ['Come @Closer', 'It’s Casey’s title']);
    assert.ok(painted.every(item => item.color === '#A15BD4' && item.font.includes('italic 700')));
    for (const change of [p => p.objects[1].text.content = '', p => p.objects[1].text.fontSize = Infinity,
        p => p.objects[1].text.strokeWidth = 100, p => p.objects[1].keys[0].opacity = 2]) {
        const input = structuredClone(plan); change(input); assert.throws(() => validateMotionPlan(input));
    }
}));

test('text follows moving parent-local attachments, opacity schedules and step poses with resource disposal', () => textCanvasHarness(() => {
    const plan = fixture(); plan.objects.push({ id: 'words', shape: 'text', color: '#FF00FF', text: { content: 'Exact words' },
        attachment: { objectId: 'actor', partId: 'hand' }, interpolation: 'step', keys: [key(0, [0, .25, .01], undefined, { opacity: 0 }), key(1, [0, .25, .01], undefined, { opacity: 1 }), key(3, [.5, .25, .01], undefined, { opacity: 1 }), key(5, [.5, .25, .01], undefined, { opacity: 0 })] });
    const scene = createMotionScene(validateMotionPlan(plan), 16 / 9);
    scene.draw(.5); assert.equal(scene.roots.get('words').visible, false);
    scene.draw(2.5); const words = scene.roots.get('words'), mesh = words.children[0];
    assert.equal(words.visible, true); assert.equal(words.position.x, 0); assert.equal(mesh.material.opacity, 1);
    const expected = new THREE.Vector3(0, .25, .01).applyMatrix4(scene.parts.get('actor').get('hand').matrixWorld);
    assert.ok(words.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-7);
    assert.equal(mesh.geometry.type, 'PlaneGeometry'); assert.equal(mesh.material.side, THREE.DoubleSide);
    let textureDisposed = 0, materialDisposed = 0;
    mesh.material.map.addEventListener('dispose', () => textureDisposed++); mesh.material.addEventListener('dispose', () => materialDisposed++);
    scene.draw(3); assert.equal(words.position.x, .5);
    scene.draw(5); assert.equal(words.visible, false);
    scene.dispose(); assert.equal(textureDisposed, 1); assert.equal(materialDisposed, 1);
    plan.objects[1].interpolation = 'linear';
    const faded = createMotionScene(validateMotionPlan(plan), 1); faded.draw(.5);
    assert.equal(faded.roots.get('words').children[0].material.opacity, .5); faded.dispose();
}));

test('edited scenes release obsolete actor materials and dispose their retained resources once', () => {
    const plan = fixture(), scene = createMotionScene(plan, 1);
    let released = 0;
    const original = scene.parts.get('actor').get('hand').material;
    original.addEventListener('dispose', () => released++);
    const edited = structuredClone(plan); edited.objects[0].subjectColor = '#123456';
    scene.draw(0, edited); assert.equal(released, 1);
    const current = scene.parts.get('actor').get('hand').material;
    assert.notEqual(current, original);
    let currentReleased = 0; current.addEventListener('dispose', () => currentReleased++);
    for (let frame = 0; frame < 100; frame++) scene.draw(frame / 30, edited);
    assert.equal(currentReleased, 0);
    scene.dispose(); scene.dispose();
    assert.equal(released, 1); assert.equal(currentReleased, 1);
});
