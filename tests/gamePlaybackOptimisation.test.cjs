const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
function loader(mocks = {}) {
  const modules = new Map();
  function read(name) {
    const file = path.resolve(__dirname, '../src', name.endsWith('.ts') ? name : name + '.ts');
    if (modules.has(file)) return modules.get(file).exports;
    const mod = new Module(file, module); modules.set(file, mod);
    mod.require = name => name in mocks ? mocks[name] : name.startsWith('.') ? read(name) : require(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
    return mod.exports;
  }
  return read;
}
class Video extends EventTarget {
  constructor(ready = 0) { super(); this.readyState = ready; this.src = ''; this.duration = 2; this.time = 0;
    this.seeking = false; this.loads = 0; this.seeks = 0; this.paused = true; this.buffered = { length: 1 }; this.frames = new Map(); this.frameId = 0; }
  get currentSrc() { return this.src; }
  get currentTime() { return this.time; }
  set currentTime(value) { this.time = value; this.seeks++; }
  load() { this.loads++; }
  pause() { this.paused = true; }
  play() { this.paused = false; return Promise.resolve(); }
  remove() {}
  removeAttribute(key) { if (key === 'src') this.src = ''; }
  cloneNode() { const video = new Video(this.readyState); video.src = this.src; return video; }
  requestVideoFrameCallback(callback) { const id = ++this.frameId; this.frames.set(id, callback); return id; }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  frame(time = this.currentTime) { const callbacks = [...this.frames.values()]; this.frames.clear(); callbacks.forEach(callback => callback(0, { mediaTime: time })); }
  ready() { this.readyState = 4; this.oncanplay?.(); }
}
const edge = (id, source, target, extra = {}) => ({ id, sourceNodeId: source, targetNodeId: target, kind: 'movement',
  forward: { videoUrl: id + '.mp4' }, backward: { videoUrl: id + '-back.mp4' }, ...extra });
const scene = connections => ({ sceneId: 's', activeNodeId: 'root', connections,
  nodes: [...new Set(['root', ...connections.flatMap(edge => [edge.sourceNodeId, edge.targetNodeId])])].map(id => ({ id, frameUrl: id + '.png' })) });
test('spatial lookahead covers immediate alternatives and arrival choices without changing route selection', () => {
  const { buildSpatialVideoCachePlan } = loader()('spatialVideoCache');
  const routes = { root: 'left' }, world = scene([edge('left', 'root', 'a'), edge('right', 'root', 'b'), edge('next', 'a', 'c')]);
  const plan = buildSpatialVideoCachePlan(world, 1, routes, 5, 'a');
  assert.deepEqual(plan.forwardConnectionIds, ['left', 'next']);
  assert.ok(plan.assets.some(asset => asset.url === 'right.mp4'));
  assert.ok(plan.assets.some(asset => asset.url === 'next.mp4'));
  assert.deepEqual(routes, { root: 'left' });
});
test('spatial speculation is bounded and skips incomplete world pairs', () => {
  const { buildSpatialVideoCachePlan } = loader()('spatialVideoCache');
  const world = scene(Array.from({ length: 40 }, (_, i) => edge('edge' + i, 'root', 'n' + i)));
  world.ledger = {}; world.connections.push(edge('incomplete', 'root', 'n0', { backward: null }));
  const plan = buildSpatialVideoCachePlan(world, 1);
  assert.ok(plan.assets.length <= 20);
  assert.ok(!plan.assets.some(asset => asset.url === 'incomplete.mp4'));
});
const plan = (owner, urls) => ({ sceneId: 's', sceneIndex: owner, activeNodeId: 'root', forwardConnectionIds: [], backwardConnectionIds: [],
  assets: urls.map((url, index) => ({ url, connectionId: url, assetDirection: 'forward', slotDirection: 'forward', distance: index + 1 })) });
function cache() {
  global.document = { createElement: () => new Video() }; global.HTMLMediaElement = { HAVE_FUTURE_DATA: 3 };
  return loader()('spatialVideoCache').spatialVideoRamCache;
}
test('spatial loads two speculative assets per owner; an explicit queued choice starts immediately', () => {
  const c = cache();
  try {
    c.reconcile(plan(1, ['a', 'b', 'c', 'd']));
    assert.equal(c.snapshot().loading, 2); assert.equal(c.snapshot().queued, 2);
    const chosen = c.acquirePlayback('d');
    assert.equal(chosen.video.loads, 1); assert.equal(c.snapshot().loading, 3);
    chosen.video.ready(); chosen.release();
    c.playbackElement('a').ready();
    assert.equal(c.playbackElement('c').loads, 1);
    const b = c.playbackElement('b'), loads = b.loads;
    c.reconcile(plan(1, ['d', 'b', 'c', 'a']));
    assert.equal(c.playbackElement('b'), b); assert.equal(b.loads, loads, 'reconcile restarted an in-flight source');
  } finally { c.releaseScene(1); }
});
test('shared spatial admission stays bounded and teardown removes queued work', () => {
  const c = cache();
  try {
    c.reconcile(plan(1, Array.from({ length: 20 }, (_, i) => 'a' + i)));
    c.reconcile(plan(2, Array.from({ length: 20 }, (_, i) => 'b' + i)));
    c.reconcile(plan(3, Array.from({ length: 20 }, (_, i) => 'c' + i)));
    assert.equal(c.snapshot().loading, 4); assert.ok(c.snapshot().entries.length <= 40);
    const chosen = c.acquirePlayback('outside-budget');
    assert.ok(chosen); c.releaseScene(1); c.releaseScene(2); c.releaseScene(3);
    assert.equal(c.snapshot().queued, 0); assert.equal(chosen.video.src, 'outside-budget');
    chosen.release(); assert.equal(c.snapshot().entries.length, 0);
  } finally { [1, 2, 3].forEach(owner => c.releaseScene(owner)); }
});
function playback(video, read) {
  let shown = 0;
  const timers = new Set();
  const options = { video, traversal: { connection: edge('route', 'root', 'end', { movement: { samples: [{ x: 1, y: 0 }] } }),
    direction: 'forward', destinationNodeId: 'end', video: { videoUrl: video.src } }, progress: null,
    drive: () => null, waitForSeekBeforePlayback: true, onDirection() {}, onFinish() {}, onError(reason) { throw Error(reason); },
    onVisualReady() { shown++; }, clock: { now: () => 0, every() { return () => {}; }, after(callback) { timers.add(callback); return () => timers.delete(callback); } } };
  const stop = read('spatialPlayback').attachSpatialPlayback(options);
  return { stop, shown: () => shown, timers };
}
test('a proven current frame skips redundant seek; changed sources and cloned elements require new evidence', () => {
  const read = loader({ './spatialDiagnostics': { spatialLog() {}, mediaUrlLabel: value => value } });
  const video = new Video(4); video.src = 'one.mp4';
  read('presentedVideoFrame').rememberPresentedVideoFrame(video, 0);
  let session = playback(video, read);
  assert.equal(session.shown(), 1); assert.equal(video.seeks, 0); session.stop();
  video.src = 'two.mp4'; session = playback(video, read);
  assert.equal(session.shown(), 0); video.frame(.5); assert.equal(session.shown(), 0);
  video.frame(0); assert.equal(session.shown(), 1); session.stop();
  session = playback(video.cloneNode(), read); assert.equal(session.shown(), 0); session.stop();
});
test('same-position startup without frame callbacks does not wait for a nonexistent seeked event', () => {
  const read = loader({ './spatialDiagnostics': { spatialLog() {}, mediaUrlLabel: value => value } });
  const video = new Video(4); video.src = 'one.mp4'; video.requestVideoFrameCallback = undefined;
  const session = playback(video, read); assert.equal(session.shown(), 1); assert.equal(video.seeks, 0); session.stop();
});
test('a cancelled frame callback cannot reveal a retired spatial traversal', () => {
  const read = loader({ './spatialDiagnostics': { spatialLog() {}, mediaUrlLabel: value => value } });
  const video = new Video(4); video.src = 'one.mp4'; const session = playback(video, read);
  const callback = [...video.frames.values()][0]; session.stop(); callback(0, { mediaTime: 0 });
  assert.equal(session.shown(), 0); assert.equal(session.timers.size, 0);
});
test('hotspot lookahead shares two fetch slots; cancelling queued work never aborts a chosen asset', async () => {
  const calls = [], deferred = new Map();
  const read = loader({ './interactionAssetCache': { cacheStats: () => ({ bytes: 0, maxBytes: 128e6, entries: 0, max: 30 }),
    peek: () => null, load(url) { calls.push(url); return new Promise(resolve => deferred.set(url, resolve)); } } });
  const { preloadInteractionAssets } = read('interactionPreload');
  const stop = preloadInteractionAssets(['a', 'a', 'b', 'c']); const stopOther = preloadInteractionAssets(['d']);
  assert.deepEqual(calls, ['a', 'b']); stop(); deferred.get('a')();
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(calls, ['a', 'b', 'd']);
  stopOther(); deferred.get('b')(); deferred.get('d')(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(!calls.includes('c'));
});
