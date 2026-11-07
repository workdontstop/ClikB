const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

// Exercise the real TypeScript modules with controlled network/recording adapters.
function load(file, mocks = {}, cache = new Map()) {
    if (/server[\\/]src[\\/](?:MotionGuideRoute|SpatialWorldPlanRoute)\.ts$/.test(file)) mocks = require('./helpers/isolatedPlanningBilling.cjs').withIsolatedPlanningBilling(mocks, load);
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache);
        return Module.prototype.require.call(mod, name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
}
const { validateMotionPlan, motionSegment } = load('server/src/motionGuidePlan.ts');
const fixture = () => ({ version: 1, duration: 2, background: '#202838', objects: [{
    id: 'subject', shape: 'box', color: '#eeeeee', keys: [0, 2].map(t => ({ t, position: [t, 0.5, 0], rotation: [0, t * Math.PI, 0], scale: [1, 1, 1] })),
}], camera: [0, 2].map(t => ({ t, position: [0, 2, 6], target: [0, 0.5, 0], fov: 45 })) });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(r => setImmediate(r));

test('motion schema rejects malformed or unbounded model output', () => {
    assert.equal(validateMotionPlan(fixture()).objects.length, 1);
    for (const mutate of [
        p => p.objects[0].keys[1].t = 0,
        p => p.objects[0].keys[0].position[0] = Infinity,
        p => p.objects[0].keys[0].scale[0] = -1,
        p => p.objects.push(p.objects[0]),
        p => p.objects[0].shape = 'script',
        p => p.camera[0].target = p.camera[0].position,
        p => p.objects[0].keys.pop(),
    ]) { const p = fixture(); mutate(p); assert.throws(() => validateMotionPlan(p)); }
});
test('timeline keeps holds, endpoint and full rotation timing', () => {
    const keys = fixture().objects[0].keys;
    const [a, b, t] = motionSegment(keys, 1);
    assert.equal(a.rotation[1] + (b.rotation[1] - a.rotation[1]) * t, Math.PI);
    assert.equal(motionSegment(keys, 2)[0].position[0], 2);
    assert.equal(motionSegment(keys, -1)[0].position[0], 0);
});

test('exported motion uses the existing video reference field, only on reference-video models', () => {
    const { attachMotionVideoReference } = load('src/motionGuide.ts');
    const guide = { plan: fixture(), videoUrl: 'https://test/motion.mp4' };
    for (const model of ['Pro', 'Minix', 'SeedanceMini', 'Proxxx', 'pPro']) {
        const payload = { prompt: 'The original shot', characterImage: 'appearance.png', referenceVideoUrl: 'uploaded.mp4' };
        attachMotionVideoReference(payload, guide, model, '');
        assert.equal(payload.referenceVideoUrl, guide.videoUrl);
        assert.equal(payload.characterImage, 'appearance.png');
        assert.ok(payload.prompt.startsWith('The original shot'));
        assert.ok(payload.prompt.includes(model === 'Proxxx' ? 'Video 1' : '[Video1]'));
        assert.equal(payload.image_urls, undefined);
    }
    for (const model of ['Proxx', 'GeminiOmni', 'Omni', 'Mini', 'unknown']) assert.throws(() => attachMotionVideoReference({}, guide, model, 'prompt'));
    assert.throws(() => attachMotionVideoReference({}, { plan: fixture() }, 'Pro', 'prompt'));
});

let harnessSeq = 0; function routeHarness({ balance = 100, authenticated = true, outputs = [fixture()], providerError = false, debitAllowed = true, providerModel, provider, rawPixelsPerCall = 1.2, userId = 'test-user-' + (++harnessSeq) } = {}) {
    const calls = [], charges = [];
    class OpenAI {
        chat = { completions: { create: async payload => {
            calls.push(payload);
            if (providerError) throw new Error('provider unavailable');
            if (!debitAllowed) balance = 0;
            return { ...(providerModel ? { model: providerModel } : {}), ...(provider ? { _clikbProvider: provider } : {}), choices: [{ message: { content: JSON.stringify(outputs.shift()) } }] };
        } } };
    }
    const { buildMotionGuide } = load('server/src/MotionGuideRoute.ts', {
        openai: OpenAI,
        './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {}, providerUsageCursor: () => 0, providerPixelsSince: () => calls.length * rawPixelsPerCall },
        './jwtUtils': { verifyToken: () => { if (!authenticated) throw new Error('no session'); return { id: userId }; } },
        './db': { getPixelsForUser: async () => balance, trySpendPixels: async (_id, price) => { if (!debitAllowed || balance < price) return false; charges.push(price); balance -= price; return true; }, withTransaction: async fn => fn({ query: async () => ({ rows: [] }) }) }, './execQuery': { __esModule: true, default: async () => [], withTransaction: async fn => fn(async () => []) },
    });
    const req = { cookies: { authToken: 'test' }, body: { prompt: 'Roll a cube', duration: 2, aspectRatio: '16:9', firstFrameUrl: 'https://test/frame.png', llmTier: 'luna', llmBatchContinuation: true } };
    const res = { statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
    return { run: () => buildMotionGuide(req, res), req, res, calls, charges };
}
test('endpoint honors selected Luna tier with raw provider cost and ignores client billing bypass flags', async () => {
    const h = routeHarness(); await h.run();
    assert.equal(h.res.statusCode, 200); assert.deepEqual(h.charges, [1]);
    assert.equal(h.calls[0].model, 'gpt-6-luna'); assert.equal(h.calls[0].reasoning_effort, 'low');
    assert.equal(h.calls[0].messages[1].content[1].image_url.url, 'https://test/frame.png');
    assert.equal(h.res.body.llmBilling.pixels, 99);
});
test('endpoint rejects unauthenticated, unaffordable and invalid input before calling AI', async () => {
    for (const options of [{ authenticated: false }, { balance: 0 }]) {
        const h = routeHarness(options); await h.run();
        assert.equal(h.calls.length, 0); assert.equal(h.charges.length, 0);
        assert.ok([401, 402].includes(h.res.statusCode));
    }
    const h = routeHarness(); h.req.body.duration = 30; await h.run();
    assert.equal(h.res.statusCode, 400); assert.equal(h.calls.length, 0);
});
test('selected Motion Guide tiers share server preflight, exact debit and returned price', async () => {
    for (const [tier, price, model] of [['luna', 1, 'gpt-6-luna'], ['terra', 1, 'gpt-6.1-terra'], ['sol', 1, 'gpt-6.1-sol']]) {
        const h = routeHarness({ balance: price }); h.req.body.llmTier = tier; await h.run();
        assert.deepEqual(h.charges, [price]); assert.equal(h.res.body.llmBilling.pixelsCharged, price);
        assert.equal(h.res.body.llmBilling.pixels, 0);
        assert.equal(h.calls[0].model, model); assert.equal(h.calls[0].reasoning_effort, 'low');
        assert.equal(h.calls[0].max_completion_tokens, 32000);
        const insufficient = routeHarness({ balance: 0 }); insufficient.req.body.llmTier = tier;
        await insufficient.run(); assert.equal(insufficient.res.statusCode, 402); assert.equal(insufficient.calls.length, 0);
    }
});
test('Sol Motion Guide uses extra high reasoning and retains actual provider metadata with provider-cost billing', async () => {
    const h = routeHarness({ providerModel: 'gpt-6.1-sol' }); h.req.body.llmTier = 'sol'; await h.run();
    assert.equal(h.calls[0].model, 'gpt-6.1-sol'); assert.equal(h.calls[0].reasoning_effort, 'low');
    assert.equal(h.calls[0].max_completion_tokens, 32000);
    assert.equal(h.res.body.model, 'gpt-6.1-sol'); assert.equal(h.res.body.requestedReasoningEffort, 'low');
    assert.deepEqual(h.charges, [1]);
    const fallback = routeHarness({ providerModel: 'moonshotai/kimi-k2.6', provider: 'replicate' });
    fallback.req.body.llmTier = 'sol'; await fallback.run();
    assert.equal(fallback.res.body.model, 'moonshotai/kimi-k2.6'); assert.equal(fallback.res.body.provider, 'replicate');
    assert.equal(fallback.res.body.requestedModel, 'gpt-6.1-sol'); assert.equal(fallback.res.body.llmTier, 'sol');
    assert.equal(fallback.res.body.llmBilling.pixelsCharged, 1);
});
test('normal motion cannot repair an incomplete animated track into a paid stationary success', async () => {
    const incomplete = fixture(); incomplete.objects[0].keys = [incomplete.objects[0].keys[0]];
    const h = routeHarness({ outputs: [incomplete, fixture()] }); await h.run();
    assert.equal(h.calls.length, 2); assert.deepEqual(h.charges, [2]);
    assert.equal(h.res.body.plan.objects[0].keys[1].position[0], 2);
    assert.ok(h.calls[1].messages[0].content.includes('2–96 strictly increasing keys'));
    assert.ok(h.calls[0].messages[0].content.includes('shape:"text"'));
    assert.ok(!h.calls[0].messages[0].content.includes('No text'));
});
test('a concurrent exhausted balance preserves the completed plan and reports the actual zero debit', async () => {
    const h = routeHarness({ debitAllowed: false }); await h.run();
    assert.equal(h.res.statusCode, 200); assert.ok(h.res.body.plan);
    assert.equal(h.res.body.llmBilling.pixelsCharged, 0); assert.equal(h.res.body.llmBilling.pixels, 0);
    assert.equal(h.charges.length, 0);
});
test('model repair charges once; invalid plans and provider failures never charge', async () => {
    const repaired = routeHarness({ outputs: [{ invalid: true }, fixture()] }); await repaired.run();
    assert.equal(repaired.calls.length, 2); assert.deepEqual(repaired.charges, [2]);
    const broken = routeHarness({ outputs: [{}, {}] }); await broken.run();
    assert.equal(broken.res.statusCode, 502); assert.equal(broken.charges.length, 0);
    const unavailable = routeHarness({ providerError: true }); await unavailable.run();
    assert.equal(unavailable.res.statusCode, 502); assert.equal(unavailable.charges.length, 0);
});

function harness() {
    const requests = [], exports = [], saved = {}, charged = [], state = [], cleanups = [];
    let slot = 0;
    const React = {
        useRef: value => ({ current: value }), useCallback: fn => fn,
        useState: value => { const i = slot++; state[i] = value; return [value, update => { state[i] = typeof update === 'function' ? update(state[i]) : update; }]; },
        useEffect: fn => { cleanups.push(fn()); },
    };
    const { useMotionGuide } = load('src/useMotionGuide.ts', {
        react: React,
        './liveSceneClient': { LiveSceneClient: class {
            constructor(_api, targetKey) { this.targetKey = targetKey; }
            snapshot = () => ({ phase: 'idle', pinned: [] });
            subscribe = () => () => {};
            async run(_route, payload) { const d = deferred(); requests.push({ ...d, payload }); return (await d.promise).data; }
            recover = async () => {};
            detach() {} acknowledge() {} async stop() {}
        } },
        axios: { post: (_url, payload) => { const d = deferred(); requests.push({ ...d, payload }); return d.promise; } },
        './motionGuideRenderer': {
            verifyMotionRecording: async () => {},
            recordMotionGuide: (plan, _ratio, signal, progress) => { const d = deferred(); exports.push({ ...d, plan, signal }); progress(25); return d.promise; },
        },
        './llmBilling': { applyLlmBilling: (_d, data) => charged.push(data.llmBilling), applyLlmBillingError: () => null },
    });
    const map = new Map([['A:0', 0], ['B:0:0', 1], ['A:1', 2]]);
    const key = t => t.type === 'A' ? `A:${t.index}` : `B:${t.index}:${t.bIndex}`;
    const hook = useMotionGuide({ apiUrl: '', dispatch: () => {}, topologyVersion: 0, llmTier: 'luna',
        resolveIndex: t => map.get(key(t)) ?? -1,
        save: (updater, target) => { saved[key(target)] = updater(saved[key(target)] || null); },
        upload: async file => `https://test/${file.name}.mp4`, registerVideo: () => {},
    });
    return { hook, requests, exports, saved, charged, state, map, cleanup: () => cleanups.forEach(c => c?.()) };
}
const input = target => ({ target, prompt: target.type === 'B' ? 'B shot rolls left' : 'A shot moves right', firstFrameUrl: `https://test/${target.type}.png`, duration: 2, aspectRatio: '16:9' });
const result = () => ({ data: { plan: fixture(), llmBilling: { pixelsCharged: 10 } } });

test('a legacy review ticket cannot trigger a second call or replace the first exported plan', async () => {
    const h = harness(), first = result(); first.data.reviewTicket = 'legacy-ticket';
    Object.assign(first.data, { model: 'moonshotai/kimi-k2.6', provider: 'replicate', requestedModel: 'gpt-6.1-sol', requestedReasoningEffort: 'high', llmTier: 'sol' });
    const promise = h.hook.build(input({ type: 'A', index: 0 }));
    await flush(); h.requests[0].resolve(first); await flush();
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.exports[0].plan, first.data.plan);
    h.exports[0].resolve({ name: 'first-pass' }); assert.equal(await promise, true);
    assert.deepEqual(h.saved['A:0'].motion.plan, first.data.plan);
    assert.equal(h.saved['A:0'].motion.model, 'moonshotai/kimi-k2.6');
    assert.equal(h.saved['A:0'].motion.requestedReasoningEffort, 'high');
});

test('concurrent A/B jobs retain their inputs, loaders and destinations after navigation/map movement', async () => {
    const h = harness();
    const a = h.hook.build(input({ type: 'A', index: 0 }));
    const b = h.hook.build(input({ type: 'B', index: 0, bIndex: 0 }));
    await flush();
    assert.equal(h.requests[1].payload.prompt, 'B shot rolls left');
    assert.equal(h.requests[1].payload.firstFrameUrl, 'https://test/B.png');
    assert.ok(h.state[0]['A:0']); assert.ok(h.state[0]['B:0:0']);
    h.map.set('B:0:0', 4); // The visible flattened position changes mid-request.
    h.requests[1].resolve(result()); await flush();
    h.exports[0].resolve({ name: 'B' }); await b;
    assert.equal(h.saved['B:0:0'].motion.videoUrl, 'https://test/B.mp4');
    assert.ok(h.state[0]['A:0']); assert.equal(h.state[0]['B:0:0'], undefined);
    h.requests[0].resolve(result()); await flush();
    h.exports[1].resolve({ name: 'A' }); await a;
    assert.equal(h.saved['A:0'].motion.videoUrl, 'https://test/A.mp4');
    assert.equal(h.charged.length, 2);
});
test('failed export retains paid plan; retry exports without a second AI call', async () => {
    const h = harness(), i = input({ type: 'A', index: 0 });
    const first = h.hook.build(i); await flush(); h.requests[0].resolve(result()); await flush();
    h.exports[0].reject(new Error('export failed')); assert.equal(await first, false);
    const previous = h.saved['A:0'].motion;
    assert.ok(previous.plan); assert.equal(previous.videoUrl, undefined);
    const retry = h.hook.build({ ...i, previous });
    await flush();
    assert.equal(h.requests.length, 1);
    h.exports[1].resolve({ name: 'retry' }); assert.equal(await retry, true);
    assert.equal(h.charged.length, 1);
});
test('failed replacement retains completed reference and retries paid export without another charge', async () => {
    const h = harness(), i = input({ type: 'A', index: 0 });
    const previous = { plan: fixture(), sourcePrompt: 'old prompt', sourceFrameUrl: '', aspectRatio: '16:9', createdAt: 1, videoUrl: 'old.mp4', draftPrompt: i.prompt };
    const first = h.hook.build({ ...i, previous, rebuild: true }); await flush(); h.requests[0].resolve(result()); await flush();
    assert.equal(h.saved['A:0'].motion.videoUrl, 'old.mp4');
    h.exports[0].reject(new Error('export failed')); assert.equal(await first, false);
    assert.ok(h.saved['A:0'].motion.pendingReplacement);
    const retry = h.hook.build({ ...i, previous: h.saved['A:0'].motion }); await flush();
    assert.equal(h.requests.length, 1); h.exports[1].resolve({ name: 'replacement' }); assert.equal(await retry, true);
    assert.equal(h.saved['A:0'].motion.videoUrl, 'https://test/replacement.mp4'); assert.equal(h.charged.length, 1);
});
test('delete and immediate rebuild cannot be overwritten or unlocked by the old completion', async () => {
    const h = harness(), i = input({ type: 'B', index: 0, bIndex: 0 });
    const old = h.hook.build(i); await flush(); h.hook.remove(i.target);
    const fresh = h.hook.build(i);
    await flush();
    h.requests[0].resolve(result()); assert.equal(await old, false);
    assert.ok(h.state[0]['B:0:0']); assert.equal(h.saved['B:0:0'].motion, undefined);
    h.requests[1].resolve(result()); await flush(); h.exports[0].resolve({ name: 'fresh' });
    assert.equal(await fresh, true);
    assert.equal(h.saved['B:0:0'].motion.videoUrl, 'https://test/fresh.mp4');
});
test('failure in one scene leaves another running; unmount invalidates its late response', async () => {
    const h = harness();
    const a = h.hook.build(input({ type: 'A', index: 0 }));
    const b = h.hook.build(input({ type: 'B', index: 0, bIndex: 0 }));
    await flush();
    h.requests[0].reject(new Error('provider failed')); await a;
    assert.ok(h.state[1]['A:0']); assert.ok(h.state[0]['B:0:0']);
    h.cleanup(); h.requests[1].resolve(result()); assert.equal(await b, false);
    assert.equal(h.saved['B:0:0'], undefined);
});
test('edit sends the existing plan and instruction, and replaces only the requesting shot', async () => {
    const h = harness();
    const previous = { plan: fixture(), sourcePrompt: 'B prompt', sourceFrameUrl: '', aspectRatio: '16:9', createdAt: 1, videoUrl: 'old.mp4' };
    const promise = h.hook.build({ ...input({ type: 'B', index: 0, bIndex: 0 }), previous, editInstruction: 'Move twice as far' });
    await flush();
    assert.deepEqual(h.requests[0].payload.previousPlan, previous.plan);
    assert.equal(h.requests[0].payload.editInstruction, 'Move twice as far');
    h.requests[0].resolve(result()); await flush(); h.exports[0].resolve({ name: 'edited' }); await promise;
    assert.equal(h.saved['B:0:0'].motion.videoUrl, 'https://test/edited.mp4');
    assert.equal(h.saved['A:0'], undefined);
});

test('motion prompt/edit/display cleanup preserves outside handles, styles, attachment and all unaffected motion', async () => {
    const output = fixture(); output.objects.push({ id: 'label', shape: 'text', color: '#FA00FA', text: { content: '@Casey’s words', fontFamily: 'serif', fontWeight: 700 },
        attachment: { objectId: 'subject' }, keys: structuredClone(output.objects[0].keys) });
    output.objects[0].parts = [{ id: 'local_label', shape: 'text', color: '#AABBCC', text: { content: '@Hello' }, keys: structuredClone(output.objects[0].keys) }];
    const unchanged = structuredClone(output);
    const h = routeHarness({ outputs: [output] });
    Object.assign(h.req.body, { prompt: "Show '@Casey' above @Casey.", editInstruction: "Move '@Casey' nearer @Casey.", previousPlan: output });
    await h.run(); assert.equal(h.res.statusCode, 200);
    const request = JSON.parse(h.calls[0].messages[1].content[0].text);
    assert.equal(request.prompt, "Show 'Casey' above @Casey."); assert.equal(request.editInstruction, "Move 'Casey' nearer @Casey.");
    assert.equal(request.previousPlan.objects[1].text.content, 'Casey’s words');
    assert.equal(h.res.body.plan.objects[1].text.content, 'Casey’s words'); assert.equal(h.res.body.plan.objects[0].parts[0].text.content, 'Hello');
    assert.deepEqual(h.res.body.plan.objects[1].attachment, output.objects[1].attachment);
    assert.deepEqual(h.res.body.plan.objects[1].keys, output.objects[1].keys);
    assert.equal(h.res.body.plan.objects[1].text.fontFamily, 'serif'); assert.equal(h.res.body.plan.objects[1].text.fontWeight, 700);
    assert.deepEqual(output, unchanged); assert.deepEqual(h.charges, [1]);
});

test('changed wording after a failed paid replacement retries its retained plan free and preserves newer drafts', async () => {
    const h = harness(), i = input({ type: 'A', index: 0 });
    const old = { plan: fixture(), sourcePrompt: 'old reference', sourceFrameUrl: '', aspectRatio: '16:9', createdAt: 1, videoUrl: 'old.mp4', draftPrompt: i.prompt };
    const replacement = h.hook.build({ ...i, previous: old, rebuild: true }); await flush();
    h.requests[0].resolve(result()); await flush(); h.exports[0].reject(new Error('export failed')); assert.equal(await replacement, false);
    const retained = { ...h.saved['A:0'].motion, draftPrompt: 'new wording only' }; h.saved['A:0'].motion = retained;
    const retry = h.hook.build({ ...i, prompt: retained.draftPrompt, previous: retained }); await flush();
    assert.equal(h.requests.length, 1); assert.deepEqual(h.exports[1].plan, retained.pendingReplacement.plan);
    h.saved['A:0'].motion = { ...retained, draftPrompt: 'wording changed while exporting' };
    h.exports[1].resolve({ name: 'paid-retry' }); assert.equal(await retry, true);
    assert.equal(h.charged.length, 1); assert.equal(h.saved['A:0'].motion.sourcePrompt, i.prompt);
    assert.equal(h.saved['A:0'].motion.draftPrompt, 'wording changed while exporting');
    assert.equal(h.saved['A:0'].motion.videoUrl, 'https://test/paid-retry.mp4');
});

test('only a deliberate rebuild buys another plan after wording changes', async () => {
    const h = harness(), i = input({ type: 'B', index: 0, bIndex: 0 });
    const old = { plan: fixture(), sourcePrompt: 'existing reference', sourceFrameUrl: '', aspectRatio: '16:9', createdAt: 1, videoUrl: 'old.mp4', draftPrompt: 'new wording' };
    const reuse = h.hook.build({ ...i, prompt: old.draftPrompt, previous: old }); await flush();
    assert.equal(h.requests.length, 0); h.exports[0].resolve({ name: 'retained' }); assert.equal(await reuse, true);
    assert.equal(h.saved['B:0:0'].motion.draftPrompt, 'new wording');
    const rebuild = h.hook.build({ ...i, prompt: old.draftPrompt, previous: h.saved['B:0:0'].motion, rebuild: true }); await flush();
    assert.equal(h.requests.length, 1); assert.equal(h.requests[0].payload.prompt, 'new wording');
    h.requests[0].resolve(result()); await flush(); h.exports[1].resolve({ name: 'deliberate' }); assert.equal(await rebuild, true);
    assert.equal(h.charged.length, 1); assert.equal(h.saved['B:0:0'].motion.sourcePrompt, 'new wording');
    assert.equal(h.saved['B:0:0'].motion.draftPrompt, undefined);
});

test('actual Generate callback uses the existing reference after failed replacement and prompt-only editing', async () => {
    const filename = path.resolve(__dirname, '../src/EditStory.tsx');
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleVideoGenerateClick') callback = node.initializer.arguments[0];
        ts.forEachChild(node, visit);
    };
    visit(source); assert.ok(callback);
    const compiled = ts.transpileModule(`const generate = ${callback.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const builds = [], videos = [], target = { type: 'B', index: 0, bIndex: 1 };
    const bindings = { PostId: 9, storedVideoReceiptsRef: { current: new Map() }, getSceneTargetKey: () => 'B:0:1',
        spatialStudioActiveRef: { current: false }, isLipSyncSceneBusy: false, isAutoDrawGenerating: false,
        isMotionBusy: false, videModel: 'Minix', gpuState: 'off', gpuIsBusy: false, index: 1,
        captureSceneTarget: () => target, resolveVideoUpdateInstructionForTarget: () => '', isMotionMode: true, isVideoRefModel: true,
        motionGuide: { videoUrl: 'https://assets/usable-old-reference.mp4', sourcePrompt: 'old wording', draftPrompt: 'new wording only', pendingReplacement: { sourcePrompt: 'failed paid replacement', plan: fixture() } },
        handleBuildMotionGuide: async (...args) => builds.push(args), GenerateVideox: async (...args) => videos.push(args),
        resolveVideoPromptForTarget: received => { assert.deepEqual(received, target); return 'new wording only'; },
        globalErrorEmitter: { emit: message => { throw Error(message); } },
    };
    const generate = new Function(...Object.keys(bindings), compiled + '\nreturn generate;')(...Object.values(bindings));
    await generate(); assert.deepEqual(builds, []); assert.deepEqual(videos, [[1, 'new wording only']]);
});
