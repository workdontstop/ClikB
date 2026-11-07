const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
const near = (a, b) => assert.ok(a.every((n, i) => Math.abs(n - b[i]) < 1e-7), JSON.stringify({ a, b }));

// Execute the actual viewport refs, effects, input handlers and animation loop
// with a deterministic clock. Only WebGL/DOM output is replaced; no live app,
// network, saved data or paid planner is involved.
function fixture(initial = {}) {
    let cursor = 0, now = 0, id = 0, props;
    const slots = [], effects = [], raf = new Map(), frames = [], progress = [], completed = [];
    const react = {
        forwardRef: callback => callback,
        useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
        useImperativeHandle(ref, callback) { cursor++; ref.current = callback(); },
        useEffect(callback, deps) {
            const i = cursor++, previous = slots[i];
            if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; });
        },
    };
    const globals = { performance: { now: () => now }, document: { createElement: () => ({ style: {}, remove() {} }) }, requestAnimationFrame: callback => { raf.set(++id, callback); return id; }, cancelAnimationFrame: key => raf.delete(key) };
    const mocks = { react, '../motionGuideRenderer': { createMotionRenderer: () => ({ draw(at, frame) { frames.push({ at, frame: structuredClone(frame) }); }, dispose() {} }) } };
    const cache = new Map();
    function load(file) {
        const filename = path.resolve(root, file);
        if (cache.has(filename)) return cache.get(filename).exports;
        const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
        mod.require = name => name === 'fixture-globals' ? globals : Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : Module.prototype.require.call(mod, name);
        mod._compile('const {performance,document,requestAnimationFrame,cancelAnimationFrame}=require("fixture-globals");\n' + ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
        return mod.exports;
    }
    const pose = t => ({ t, position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
    const plan = { version: 1, duration: 5, background: '#111111', objects: [{ id: 'subject', shape: 'box', color: '#ffffff', keys: [pose(0), pose(5)] }], camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, 1, 0], fov: 45 })) };
    const model = load('server/src/spatialWorld.ts');
    const world = model.validateWorld({ version: 2, model: 'luna', plan, controlledObject: 'subject', controlMode: 'character', locomotion: { kind: 'ground', vertical: false, speed: 1, turnRate: 3 }, walkable: [{ min: [-10, -10, -10], max: [10, 10, 10] }], obstacles: [], approved: true });
    const viewport = load('src/components/SpatialWorldViewport.tsx').default, ref = {};
    function render(update = {}) {
        props = { world, state: world.initialState, onCaptureProgress: value => progress.push(value), onCaptureEnd: value => completed.push(value), ...props, ...update };
        cursor = 0; const tree = viewport(props, ref); tree.ref.current = { replaceChildren() {} };
        while (effects.length) effects.shift()();
    }
    render(initial);
    return {
        world, model, progress, completed, ref, render,
        tick(ms) { const end = now + ms; while (now < end) { now = Math.min(end, now + 20); const pending = [...raf.values()]; raf.clear(); pending.forEach(callback => callback(now)); } },
        drive(x, y, active = true) { ref.current.drive({ x, y, radius: Math.hypot(x, y), angle: Math.atan2(y, x), active, timestamp: now }); },
        get frame() { return frames.at(-1).frame; },
        get transform() { return frames.at(-1).frame.objects[0].keys[0]; },
        validate: load('server/src/motionGuidePlan.ts').validateMotionPlan,
    };
}

test('testing freely drives, turns and elevates beyond five seconds without recording callbacks or timeline accumulation', () => {
    const f = fixture({ recording: false }), before = JSON.stringify(f.world);
    f.drive(0, 1); f.tick(6500); f.drive(0, 0, false); near(f.transform.position, [0, 1, -6.5]);
    f.ref.current.rotate('horizontal'); f.drive(1, 0); f.tick(600); f.drive(0, 0, false);
    f.ref.current.rotate(null); const turned = [...f.transform.rotation], start = [...f.transform.position];
    f.drive(1, 0); f.tick(400); f.drive(0, 0, false); near(f.transform.position, [start[0] + .4, 1, start[2]]); near(f.transform.rotation, turned);
    f.ref.current.elevate(1); f.tick(6500); f.ref.current.elevate(0); near(f.transform.position, [start[0] + .4, 7.5, start[2]]);
    f.tick(500); assert.equal(f.frame.objects[0].keys.length, 2); assert.equal(f.ref.current.elapsed(), 0); assert.equal(f.ref.current.finish(), null);
    assert.deepEqual(f.progress, []); assert.deepEqual(f.completed, []); assert.equal(JSON.stringify(f.world), before);
});

test('ordinary recording pauses on release, resumes the same pose and stops at exactly five active seconds', () => {
    const f = fixture(); f.drive(0, 1); f.tick(2000); f.drive(0, 0, false); const paused = structuredClone(f.transform);
    f.tick(20000); near(f.transform.position, paused.position); assert.ok(Math.abs(f.ref.current.elapsed() - 2) < 1e-8); assert.deepEqual(f.completed, []);
    f.drive(0, 1); f.tick(4000); assert.equal(f.completed.length, 1); const recorded = f.completed[0]; f.validate(recorded);
    near(recorded.objects[0].keys.at(-1).position, [0, 1, -5]); assert.equal(recorded.duration, 5); assert.ok(recorded.objects[0].keys.length <= 48);
    f.drive(0, 0, false); f.drive(1, 0); f.tick(1000); assert.equal(f.completed.length, 1, 'cutoff began a second recording without reset');
});

test('testing pose is discarded when Add motion arms capture; a short capture stretches timing without extending its route', () => {
    const f = fixture({ recording: false }); f.drive(0, 1); f.tick(2000); f.drive(0, 0, false);
    f.ref.current.reset(); f.render({ recording: true }); f.tick(20); near(f.transform.position, [0, 1, 0]);
    f.drive(1, 0); f.tick(1000); f.drive(0, 0, false); f.tick(15000); const result = f.ref.current.finish();
    f.validate(result); near(result.objects[0].keys[0].position, [0, 1, 0]); near(result.objects[0].keys.at(-1).position, [1, 1, 0]);
    assert.equal(result.duration, 5); assert.equal(result.objects[0].keys.at(-1).t, 5);
    f.render({ recording: false }); f.tick(20); near(f.transform.position, [1, 1, 0]);
    f.drive(0, 1); f.tick(200); f.drive(0, 0, false); near(f.transform.position, [1, 1, -.2]);
    assert.equal(f.ref.current.finish(), null);
    f.render({ recording: true }); f.tick(20); near(f.transform.position, [0, 1, 0]);
});

test('rotation and height recording both pause without losing orientation or height endpoints', () => {
    for (const mode of ['horizontal', 'vertical', 'roll']) {
        const f = fixture(); f.ref.current.rotate(mode); f.drive(mode === 'vertical' ? 0 : 1, mode === 'vertical' ? 1 : 0); f.ref.current.elevate(1); f.tick(700);
        f.drive(0, 0, false); f.ref.current.elevate(0); const paused = structuredClone(f.transform); f.tick(7000); near(f.transform.position, paused.position); near(f.transform.rotation, paused.rotation);
        f.ref.current.rotate(null); f.drive(1, 0); f.tick(300); f.drive(0, 0, false); const result = f.ref.current.finish(); f.validate(result);
        near(result.objects[0].keys.at(-1).position, [.3, 1.7, 0]); near(result.objects[0].keys.at(-1).rotation, paused.rotation); assert.equal(result.objects[0].rotationMode, 'quaternion');
    }
});

test('POV rehearsal/capture preserves the moved camera during pauses and at the exact final pose', () => {
    const f = fixture({ recording: false }); f.world.controlMode = 'pov'; f.render(); f.drive(0, 1); f.ref.current.elevate(1); f.tick(500); f.drive(0, 0, false); f.ref.current.elevate(0);
    const beforePause = structuredClone(f.frame.camera[0]); f.tick(5000); near(f.frame.camera[0].position, beforePause.position); near(f.frame.camera[0].target, beforePause.target);
    f.render({ recording: true }); f.drive(0, 1); f.ref.current.elevate(1); f.tick(100); f.drive(0, 0, false); f.ref.current.elevate(0);
    const result = f.ref.current.finish(); f.validate(result); near(result.camera.at(-1).position, [0, 2.1, 5.9]); near(result.camera.at(-1).target, [0, 1.1, -.1]);
    f.tick(20); near(f.frame.camera[0].position, result.camera.at(-1).position);
});

test('saved plan previews block rehearsal input and identical polling state does not interrupt an active capture', () => {
    const f = fixture({ recording: false }), preview = structuredClone(f.world.plan); preview.objects[0].keys.forEach(key => key.position = [4, 1, 0]);
    f.render({ plan: preview, playing: true }); f.drive(1, 0); f.ref.current.elevate(1); f.ref.current.rotate('vertical'); f.tick(300);
    near(f.transform.position, [4, 1, 0]); assert.deepEqual(f.progress, []); assert.deepEqual(f.completed, []);
    f.render({ plan: undefined, recording: true }); f.drive(0, 1); f.tick(500); f.render({ state: structuredClone(f.world.initialState), world: structuredClone(f.world) }); f.tick(500);
    const result = f.ref.current.finish(); near(result.objects[0].keys.at(-1).position, [0, 1, -1]);
});
