const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);
const { LiveSceneClient } = require('../src/liveSceneClient.ts');
const { adoptSceneBuild } = require('../server/src/sceneBuildAuthoring.ts');
const { evaluateAuthoringDraft, applyAuthoringCommands } = require('../server/src/sceneAuthoring.ts');
const originalFetch = global.fetch;
const storage = new Map();
global.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const keys = (position = [0, 0, 0]) => [0, 5].map(t => ({ t, position: [...position], rotation: [0, 0, 0], scale: [1, 1, 1] }));
const box = id => ({ id, shape: 'box', color: '#6686b3', keys: keys() });
const plan = objects => ({ version: 1, duration: 5, background: '#edf5fc', objects: objects || [box('actor')], camera: [0, 5].map(t => ({ t, position: [3, 2, 6], target: [0, 1, 0], fov: 45 })) });
const tick = () => new Promise(resolve => setImmediate(resolve));
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function gate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function wire() {
    let controller, closed = false;
    const response = new Response(new ReadableStream({ start(c) { controller = c; }, cancel() { closed = true; } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
    return { response, send(event) { if (!closed) controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n')); }, close() { if (!closed) { closed = true; controller.close(); } } };
}
function performance() {
    let draft = adoptSceneBuild({ ...plan([box('hero'), { ...box('cup'), attachment: { objectId: 'hero' } }]), initialState: { relationships: [{ from: 'hero', to: 'cup', relation: 'holds' }], objects: { cup: { facts: { held: true } } } }, performance: { events: [
        { id: 'release', kind: 'detach', objectId: 'cup', time: 1, landing: { time: 3, position: [4, .2, 1] } },
        { id: 'landed', kind: 'facts', objectId: 'cup', time: 3, facts: { fallen: true }, removeFacts: ['held'] },
    ] } }, 'motion:stop-export');
    draft = applyAuthoringCommands(draft, draft.revision, [{ kind: 'pose', target: { objectId: 'hero' }, time: 4, pose: { ...keys([2, 0, 0])[0], t: 4 } }]);
    return draft;
}
let nextId = 0;
async function begin({ kind = 'motion', operation, authoring, scene = authoring?.plan || plan(), exporter } = {}) {
    const id = 'stop-export-' + (++nextId), source = wire(), continued = wire(), requests = [];
    let seq = 1;
    global.fetch = async (url, options = {}) => {
        const body = JSON.parse(options.body || '{}'); requests.push({ url, body });
        if (url.endsWith('/pause')) {
            source.send({ type: 'paused', buildId: id, seq: ++seq, plan: scene, authoring, commitSeq: 0, continuationsLeft: 4 }); source.close();
            return json({ status: 'paused', plan: scene, authoring, commitSeq: 0, continuationsLeft: 4 });
        }
        if (url.endsWith('/stop')) return json({ kept: true, plan: scene, authoring });
        return body.continueBuildId ? continued.response : source.response;
    };
    const client = new LiveSceneClient('/api', id), route = kind === 'spatial' ? '/spatial-world/plan' : '/motion-guide/build';
    client.onExportDraft = exporter;
    const body = { prompt: 'Retain this performance', duration: 5, operation, llmTier: 'sol', liveNewBuild: true, ...(authoring ? { authoringContext: authoring } : {}) };
    const result = client.run(route, body);
    await tick(); source.send({ type: 'started', buildId: id, seq, basePlan: scene, authoring, operation, tier: 'sol' }); await tick();
    return { client, result, source, continued, requests, id, body, route };
}
test.after(() => { global.fetch = originalFetch; });

test('Stop exports a detached canonical timeline snapshot once and leaves the retained build resumable', async () => {
    const draft = performance(), exported = gate(); let captured, signal, exports = 0;
    const h = await begin({ authoring: draft, exporter: async (snapshot, abort, progress) => {
        exports++; captured = snapshot; signal = abort; progress('Exporting motion 25%'); return exported.promise;
    } });
    const first = h.client.stop(true), duplicate = h.client.stop(true);
    assert.equal(first, duplicate, 'double clicks share the same stop/export operation');
    await tick(); assert.equal(exports, 1); assert.equal(h.client.snapshot().phase, 'paused'); assert.equal(h.client.snapshot().exporting, true);
    assert.equal(h.client.snapshot().message, 'Exporting motion 25%'); assert.equal(signal.aborted, false);
    assert.notEqual(captured.plan, h.client.snapshot().plan, 'the recorder cannot mutate the live plan');
    assert.notEqual(captured.authoring, h.client.snapshot().authoring, 'the recorder owns a separate canonical document');
    assert.deepEqual(captured.authoring.events, draft.events); assert.deepEqual(captured.authoring.manualControls, draft.manualControls);
    for (const t of [0, .5, 2, 3, 4, 5]) assert.deepEqual(evaluateAuthoringDraft(captured.authoring, t), evaluateAuthoringDraft(draft, t), 'record all timestamps, not the inspection playhead');
    h.client.applyCommands([{ kind: 'remove', target: { objectId: 'hero' } }]);
    assert.equal(h.client.snapshot().plan.objects.length, draft.plan.objects.length, 'manual changes cannot race the frozen export');
    await h.client.continue('not during export');
    assert.equal(h.requests.filter(r => r.body.continueBuildId).length, 0);
    exported.resolve('https://media.test/stopped.mp4'); await first;
    const retained = await h.result;
    assert.equal(retained.liveDraft, true); assert.equal(retained.videoUrl, 'https://media.test/stopped.mp4');
    assert.equal(h.client.snapshot().exportedVideoUrl, retained.videoUrl); assert.equal(h.client.snapshot().phase, 'paused');
    assert.equal(h.client.snapshot().exporting, false); assert.equal(h.client.snapshot().stopping, false);
    assert.ok([...storage.values()].includes(h.id), 'export does not acknowledge/remove the resumable receipt');
    let resumed;
    h.client.canResume = () => true; h.client.onResume = () => { resumed = h.client.run(h.route, h.body); };
    await h.client.continue('Continue from the retained animation'); await tick();
    const continuation = h.requests.find(r => r.body.continueBuildId);
    assert.equal(continuation.body.continueBuildId, h.id); assert.equal(continuation.body.llmTier, 'sol');
    assert.deepEqual(continuation.body.authoring.events, draft.events);
    h.continued.send({ type: 'final', buildId: h.id, seq: 10, result: { plan: draft.plan, authoring: draft, resumed: true } }); h.continued.close();
    assert.equal((await resumed).resumed, true);
});

test('a failed stopped export preserves the previous video and draft, and retries without another AI request', async () => {
    let attempts = 0;
    const h = await begin({ exporter: async () => { attempts++; if (attempts === 2) throw new Error('Upload unavailable'); return `https://media.test/export-${attempts}.mp4`; } });
    await h.client.stop(true); await h.result;
    const firstUrl = h.client.snapshot().exportedVideoUrl, kept = JSON.stringify(h.client.snapshot().plan);
    await h.client.stop(true);
    assert.equal(h.client.snapshot().phase, 'paused'); assert.equal(h.client.snapshot().exportedVideoUrl, firstUrl);
    assert.equal(JSON.stringify(h.client.snapshot().plan), kept); assert.match(h.client.snapshot().error, /Upload unavailable/);
    await h.client.stop(true); assert.equal(h.client.snapshot().exportedVideoUrl, 'https://media.test/export-3.mp4');
    assert.equal(h.client.snapshot().error, undefined);
    assert.equal(h.requests.filter(r => r.url.endsWith('/motion-guide/build')).length, 1, 'record/upload retry never invokes a model');
});

test('an invisible starter workspace cannot be exported as a successful video', async () => {
    let exports = 0;
    const h = await begin({ scene: plan([{ ...box('live_workspace'), shape: 'anchor' }]), exporter: async () => { exports++; return 'wrong'; } });
    await h.client.stop(true); const kept = await h.result;
    assert.equal(exports, 0); assert.equal(kept.liveDraft, true); assert.match(kept.exportError, /Nothing visible/);
    assert.equal(h.client.snapshot().phase, 'paused'); assert.equal(h.client.snapshot().exportedVideoUrl, undefined);
});

test('only Motion Reference and Spatial action/correction opt into Stop export', async () => {
    for (const operation of ['action', 'action-correction', 'movement', 'return', 'reconstruct']) {
        let exports = 0;
        const h = await begin({ kind: 'spatial', operation, exporter: async () => { exports++; return 'https://media.test/action.mp4'; } });
        const supported = ['action', 'action-correction'].includes(operation);
        assert.equal(h.client.canExportDraft(), supported);
        await h.client.stop(true); const kept = await h.result;
        assert.equal(exports, supported ? 1 : 0, operation); assert.equal(kept.videoUrl, supported ? 'https://media.test/action.mp4' : undefined);
        assert.equal(h.client.snapshot().phase, 'paused');
    }
});

test('natural finalization winning the stop race uses the existing final result without duplicate snapshot export', async () => {
    const source = wire(), paused = gate(); let exports = 0, stops = 0;
    global.fetch = async url => { if (url.endsWith('/pause')) return paused.promise; if (url.endsWith('/stop')) { stops++; return json({}); } return source.response; };
    const client = new LiveSceneClient('/api', 'final-race'); client.onExportDraft = async () => { exports++; return 'wrong'; };
    const result = client.run('/motion-guide/build', { duration: 5, prompt: 'scene', liveNewBuild: true }); await tick();
    source.send({ type: 'started', buildId: 'final-race', seq: 1, basePlan: plan() }); await tick();
    const stopping = client.stop(true); source.send({ type: 'final', buildId: 'final-race', seq: 2, result: { plan: plan(), finalReceipt: true } }); source.close(); await tick();
    paused.resolve(json({ type: 'snapshot', status: 'completed', plan: plan(), final: { plan: plan(), finalReceipt: true } })); await stopping;
    assert.equal((await result).finalReceipt, true); assert.equal(exports, 0); assert.equal(stops, 0); assert.equal(client.snapshot().phase, 'idle');
});

test('source replacement aborts stopped recording and rejects late export/upload into the next run', async () => {
    const exportDone = gate(); let exportSignal;
    const h = await begin({ exporter: async (_, signal) => { exportSignal = signal; return exportDone.promise; } });
    const stopping = h.client.stop(true); await tick(); assert.equal(h.client.snapshot().exporting, true);
    h.client.detach(); await assert.rejects(h.result, /source changed/); assert.equal(exportSignal.aborted, true);
    const next = wire(); global.fetch = async () => next.response;
    const replacement = h.client.run('/motion-guide/build', { duration: 5, prompt: 'new source', liveNewBuild: true }); await tick();
    next.send({ type: 'started', buildId: 'replacement', seq: 1, basePlan: plan([box('newActor')]) }); await tick();
    exportDone.resolve('https://media.test/stale.mp4'); await stopping;
    assert.equal(h.client.snapshot().buildId, 'replacement'); assert.equal(h.client.snapshot().exportedVideoUrl, undefined);
    assert.equal(h.client.snapshot().phase, 'streaming'); assert.equal(h.client.snapshot().stopping, false);
    next.send({ type: 'final', buildId: 'replacement', seq: 2, result: { plan: plan([box('newActor')]), current: true } }); next.close();
    assert.equal((await replacement).current, true);
});
