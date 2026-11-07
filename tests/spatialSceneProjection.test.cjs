const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module'), THREE = require('three');
function load(file, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), cache) : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const { validateMotionPlan } = load('server/src/motionGuidePlan.ts');
const { projectedSceneBoxes, sceneWorldCorners } = load('server/src/spatialSceneCalibration.ts');
const { createMotionScene } = load('src/motionScene.ts');
const keys = (position, rotation = [0, 0, 0], scale = [1, 1, 1]) => [0, 5].map(t => ({ t, position: [...position], rotation: [...rotation], scale: [...scale] }));
function fixture() {
    return validateMotionPlan({ version: 1, duration: 5, background: '#ffffff',
        objects: [{ id: 'panel', shape: 'box', color: '#6686B3', keys: keys([0, 0, 0], [.12, -.3, .15]),
            parts: [{ id: 'outline', shape: 'extrude', color: '#6686B3', geometry: { outline: [[0, 0], [1.7, .2], [.35, 1.8]], depth: .12 }, keys: keys([-.8, -.7, 0], [.2, .35, -.6], [1.4, .8, 1.1]) }] }],
        camera: [0, 5].map(t => ({ t, position: [0, 1, 6], target: [0, .4, 0], fov: 45 })) });
}
// Independent reference: clip the triangles of the actual Three.js mesh in
// camera coordinates. Triangulation diagonals lie on real faces and cannot
// introduce screen extrema outside the clipped polygon prism.
function renderedBox(view, mesh, clip = true) {
    view.camera.updateMatrixWorld(true);
    const positions = mesh.geometry.attributes.position;
    const points = [];
    const vertex = i => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(view.camera.matrixWorldInverse);
    const add = p => points.push(p.clone().applyMatrix4(view.camera.projectionMatrix));
    for (let i = 0; i < positions.count; i += 3) {
        const triangle = [vertex(i), vertex(i + 1), vertex(i + 2)];
        for (const point of triangle) if (point.z <= -view.camera.near) add(point);
        if (clip) for (let j = 0; j < 3; j++) {
            const a = triangle[j], b = triangle[(j + 1) % 3];
            if ((a.z > -view.camera.near) === (b.z > -view.camera.near)) continue;
            add(a.clone().lerp(b, (-view.camera.near - a.z) / (b.z - a.z)));
        }
    }
    const clamp = n => Math.max(0, Math.min(1, n));
    const left = clamp((Math.min(...points.map(p => p.x)) + 1) / 2), right = clamp((Math.max(...points.map(p => p.x)) + 1) / 2);
    const top = clamp((1 - Math.max(...points.map(p => p.y))) / 2), bottom = clamp((1 - Math.min(...points.map(p => p.y))) / 2);
    return [left, top, right - left, bottom - top];
}
function close(a, b, label) { assert.ok(a.every((n, i) => Math.abs(n - b[i]) < 2e-7), `${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }

test('rotated extrusions use real polygon vertices rather than invented rectangle corners', () => {
    const plan = fixture(), before = JSON.stringify(plan), view = createMotionScene(plan, 9 / 16), mesh = view.parts.get('panel').get('outline');
    const actualVertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld));
    const corners = sceneWorldCorners(plan).panel;
    assert.equal(corners.length, plan.objects[0].parts[0].geometry.outline.length * 8);
    for (const corner of corners) assert.ok(actualVertices.some(point => point.distanceTo(new THREE.Vector3(...corner)) < 2e-7), `invented vertex ${JSON.stringify(corner)}`);
    close(projectedSceneBoxes(plan, '9:16').panel, renderedBox(view, mesh), 'projected outline');
    assert.equal(JSON.stringify(plan), before); view.dispose();
});

test('polygon outline edges crossing the camera near plane remain in framing measurements', () => {
    const plan = fixture();
    plan.objects[0].keys = keys([0, 0, 0]);
    plan.objects[0].parts[0].geometry = { outline: [[-.1, -.1], [.1, -.1], [0, .15]], depth: .02 };
    plan.objects[0].parts[0].keys = keys([.1, .03, -.05], [0, 1.15, 0]);
    plan.camera = [0, 5].map(t => ({ t, position: [0, 0, 0], target: [0, 0, -1], fov: 80 }));
    const view = createMotionScene(plan, 1), mesh = view.parts.get('panel').get('outline');
    const vertices = sceneWorldCorners(plan).panel;
    assert.ok(vertices.some(point => point[2] > -.05) && vertices.some(point => point[2] < -.05));
    const box = projectedSceneBoxes(plan, '1:1').panel;
    close(box, renderedBox(view, mesh), 'clipped outline');
    assert.ok(box.some((n, i) => Math.abs(n - renderedBox(view, mesh, false)[i]) > .01), 'near-plane clipping must recover visible edge intersections');
    view.dispose();
});

test('ordinary boxes retain eight corners and foreground ground clipping', () => {
    const plan = fixture(); plan.objects = [{ id: 'path', shape: 'box', color: '#8795AF', surface: 'ground', keys: keys([0, -.1, 0], [0, 0, 0], [12, .2, 24]) }];
    plan.camera = [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, 1, -2], fov: 45 }));
    assert.equal(sceneWorldCorners(plan).path.length, 8);
    const box = projectedSceneBoxes(plan, '9:16').path;
    assert.equal(box[0], 0); assert.equal(box[2], 1); assert.ok(Math.abs(box[1] + box[3] - 1) < 1e-8); assert.ok(box[3] > .45);
});
