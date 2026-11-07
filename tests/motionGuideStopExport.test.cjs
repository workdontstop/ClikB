const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');

function load(file, mocks, cache = new Map()) {
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
        ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8').replace(/import\.meta\.env/g, '({})'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function gate() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const plan = () => ({ version: 1, duration: 2, background: '#edf5fc', objects: [{ id: 'actor', shape: 'box', color: '#6686b3', keys: [0, 2].map(t => ({ t, position: [t, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) }], camera: [0, 2].map(t => ({ t, position: [3, 2, 6], target: [0, 1, 0], fov: 45 })) });
const previous = () => ({ plan: plan(), videoUrl: 'https://media.test/previous.mp4', sourcePrompt: 'scene', sourceFrameUrl: 'https://media.test/frame.png', aspectRatio: '16:9', createdAt: 1, draftPrompt: 'Keep this unsent prompt', model: 'gpt-6.1-sol', provider: 'openai', requestedModel: 'gpt-6.1-sol', requestedReasoningEffort: 'low', llmTier: 'sol' });
let active;
function harness({ prior, recording, upload, keepResponse } = {}) {
    const originalFetch = global.fetch, originalStorage = global.sessionStorage;
    const requests = [], recordings = [], uploads = [], registered = [], states = [], cleanups = [], receipts = new Map();
    let saved = { motion: prior }, slot = 0, streamController, closed = false;
    const scene = plan(), json = data => new Response(JSON.stringify(data));
    const stream = new Response(new ReadableStream({ start(c) { streamController = c; }, cancel() { closed = true; } }));
    global.sessionStorage = { getItem: key => receipts.get(key) || null, setItem: (key, value) => receipts.set(key, value), removeItem: key => receipts.delete(key) };
    global.fetch = async (url, options = {}) => {
        const body = JSON.parse(options.body || '{}'); requests.push({ url, body });
        if (url.endsWith('/pause')) return json({ status: 'paused', plan: scene, continuationsLeft: 4 });
        if (url.endsWith('/stop')) return body.keep
            ? keepResponse ? keepResponse.promise : json({ kept: true, plan: scene })
            : json({ discarded: true });
        return stream;
    };
    const react = {
        useRef: value => ({ current: value }), useCallback: fn => fn,
        useState: value => { const i = slot++; states[i] = value; return [value, update => { states[i] = typeof update === 'function' ? update(states[i]) : update; }]; },
        useEffect: fn => { cleanups.push(fn()); },
    };
    const { useMotionGuide } = load('src/useMotionGuide.ts', {
        react,
        './motionGuideRenderer': { verifyMotionRecording: async () => {}, recordMotionGuide: (...args) => { recordings.push(args); return recording ? recording.promise : Promise.resolve({ name: 'snapshot.mp4' }); } },
        './llmBilling': { applyLlmBilling() {}, applyLlmBillingError: () => null, applyPixelBillingHeaders() {} },
        './liveSceneDiagnostics': { liveSceneLog() {}, exportLiveSceneLogs() {} },
    });
    const target = { type: 'A', index: 0 }, source = { prompt: 'scene', firstFrameUrl: 'https://media.test/frame.png', duration: 2, aspectRatio: '16:9' };
    const hook = useMotionGuide({ apiUrl: '/api', dispatch() {}, topologyVersion: 0, scopeKey: 'stop-export-test', llmTier: 'sol',
        resolveIndex: () => 0, sourceFor: () => source, guideFor: () => saved.motion,
        save: updater => { saved = updater(saved); },
        upload: async file => { uploads.push(file); return upload ? upload(uploads.length) : 'https://media.test/stopped.mp4'; },
        registerVideo: url => registered.push(url),
    });
    const build = hook.build({ ...source, target, previous: prior, ...(prior ? { editInstruction: 'Refine the actor' } : {}) });
    const client = hook.clientFor(target, source);
    const h = { hook, client, build, target, states, requests, recordings, uploads, registered, receipts, scene,
        get saved() { return saved; },
        async start() { await tick(); streamController.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'started', buildId: 'native-stop-build', seq: 1, basePlan: scene, tier: 'sol' }) + '\n')); await tick(); },
        cleanup() { for (const cleanup of cleanups) cleanup?.(); if (!closed) { closed = true; try { streamController.close(); } catch {} } global.fetch = originalFetch; global.sessionStorage = originalStorage; },
    };
    active = h;
    return h;
}
test.afterEach(() => { active?.cleanup(); active = undefined; });

test('first native Stop export preserves the latest prompt draft and routing metadata without recording twice', async () => {
    const recording = gate(), prior = previous(), h = harness({ prior, recording });
    await h.start(); const stopped = h.client.stop(true); await tick();
    h.saved.motion.draftPrompt = 'Newer wording saved while recording';
    recording.resolve({ name: 'stopped.mp4' }); await stopped;
    assert.equal(await h.build, true);
    assert.equal(h.saved.motion.videoUrl, 'https://media.test/stopped.mp4');
    assert.equal(h.saved.motion.draftPrompt, 'Newer wording saved while recording');
    for (const key of ['model', 'provider', 'requestedModel', 'requestedReasoningEffort', 'llmTier']) assert.equal(h.saved.motion[key], prior[key], key);
    assert.equal(h.recordings.length, 1); assert.equal(h.uploads.length, 1);
    assert.equal(h.client.snapshot().phase, 'paused'); assert.ok(h.receipts.size);
});

test('clearing a prompt draft during stopped export does not restore its old value', async () => {
    const recording = gate(), h = harness({ prior: previous(), recording });
    await h.start(); const stopped = h.client.stop(true); await tick();
    h.saved.motion.draftPrompt = undefined;
    recording.resolve({ name: 'stopped.mp4' }); await stopped; await h.build;
    assert.equal(h.saved.motion.draftPrompt, undefined);
});

test('removing during stopped recording aborts immediately and discards without waiting for the recorder', async () => {
    const recording = gate(), h = harness({ recording });
    await h.start(); const stopped = h.client.stop(true); await tick();
    const exportSignal = h.recordings[0][2];
    h.hook.remove(h.target); await tick();
    assert.equal(h.saved.motion, undefined); assert.equal(exportSignal.aborted, true);
    assert.ok(h.requests.some(request => request.url.endsWith('/stop') && request.body.keep === false));
    recording.resolve({ name: 'late.mp4' }); await stopped; await h.build; await tick();
    assert.equal(h.saved.motion, undefined); assert.deepEqual(h.uploads, []); assert.deepEqual(h.registered, []);
    assert.equal(h.receipts.size, 0);
});

test('removing during a retry upload rejects its late completion even after the original waiter ended', async () => {
    const uploaded = gate(), h = harness({ upload: attempt => attempt === 2 ? uploaded.promise : 'https://media.test/first.mp4' });
    await h.start(); await h.client.stop(true); await h.build;
    const retry = h.client.stop(true); await tick();
    assert.equal(h.uploads.length, 2);
    h.hook.remove(h.target); await tick();
    assert.equal(h.recordings[1][2].aborted, true);
    assert.ok(h.requests.some(request => request.url.endsWith('/stop') && request.body.keep === false));
    uploaded.resolve('https://media.test/late.mp4'); await retry; await tick();
    assert.equal(h.saved.motion, undefined); assert.deepEqual(h.registered, ['https://media.test/first.mp4']);
});

test('discard supersedes an in-flight keep request and cannot be undone by its late acknowledgment', async () => {
    const kept = gate(), h = harness({ keepResponse: kept });
    await h.start(); const stopped = h.client.stop(true); await tick();
    h.hook.remove(h.target); await tick();
    kept.resolve(new Response(JSON.stringify({ kept: true, plan: h.scene })));
    await stopped; await h.build; await tick();
    const stops = h.requests.filter(request => request.url.endsWith('/stop'));
    assert.deepEqual(stops.map(request => request.body.keep), [true, false]);
    assert.equal(h.saved.motion, undefined); assert.equal(h.recordings.length, 0);
    assert.equal(h.client.snapshot().phase, 'idle');
});

test('failed Stop keeps the previous video and retry preserves the retained prompt and metadata', async () => {
    const prior = previous(), h = harness({ prior, upload: attempt => { if (attempt === 1) throw new Error('Upload unavailable'); return 'https://media.test/retry.mp4'; } });
    await h.start(); await h.client.stop(true); assert.equal(await h.build, false);
    assert.equal(h.saved.motion.videoUrl, prior.videoUrl);
    assert.ok(h.saved.motion.pendingReplacement?.liveDraft);
    h.saved.motion.draftPrompt = 'Retry must keep this newer wording';
    await h.client.stop(true);
    assert.equal(h.saved.motion.videoUrl, 'https://media.test/retry.mp4');
    assert.equal(h.saved.motion.draftPrompt, 'Retry must keep this newer wording');
    assert.equal(h.saved.motion.model, prior.model);
    assert.equal(h.requests.filter(request => request.url.endsWith('/motion-guide/build')).length, 1);
});
