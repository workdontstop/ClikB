const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { loadTypeScript } = require('./promptTestBindings.cjs');

function guardFixture(verify) {
    let now = 0, nextId = 0;
    const timers = new Map(), beats = [], errors = [];
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync('server/src/liveBuildSecurity.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('module', 'exports', 'setTimeout', 'clearTimeout', code)(module, module.exports,
        (fn, ms) => { const id = ++nextId; timers.set(id, { at: now + ms, fn }); return id; },
        id => timers.delete(id));
    const stop = module.exports.guardLiveBuild(verify, pixels => beats.push({ at: now, pixels }), error => errors.push({ at: now, error }));
    const advance = async ms => {
        const end = now + ms;
        while (true) {
            const pending = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!pending) break;
            now = pending[1].at; timers.delete(pending[0]); pending[1].fn();
            for (let i = 0; i < 8; i++) await Promise.resolve();
        }
        now = end;
    };
    return { advance, beats, errors, stop, timers };
}

test('four-minute builds verify balance every ten seconds without charging or pausing frames', async () => {
    let checks = 0;
    const f = guardFixture(async () => { checks++; return 100; });
    await f.advance(240_000);
    assert.equal(checks, 24); assert.equal(f.beats.length, 24); assert.equal(f.errors.length, 0);
    assert.deepEqual(f.beats.map(beat => beat.at), Array.from({ length: 24 }, (_, i) => (i + 1) * 10_000));
    f.stop(); assert.equal(f.timers.size, 0);
});

test('a failed balance or authentication check halts within the next security window', async () => {
    for (const reason of ['Balance exhausted', 'Session expired']) {
        let valid = true;
        const f = guardFixture(async () => { if (!valid) throw new Error(reason); return 100; });
        await f.advance(10_000); valid = false;
        await f.advance(10_000);
        assert.equal(f.errors.length, 1); assert.match(f.errors[0].error.message, new RegExp(reason));
        assert.ok(f.errors[0].at <= 20_000); assert.equal(f.timers.size, 0);
    }
});

test('a stalled verification cannot extend the ten-second lease, and late success cannot restart it', async () => {
    let release;
    const f = guardFixture(() => new Promise(resolve => { release = resolve; }));
    await f.advance(10_000);
    assert.equal(f.errors.length, 1); assert.equal(f.errors[0].at, 10_000);
    release(100); await f.advance(240_000);
    assert.equal(f.beats.length, 0); assert.equal(f.errors.length, 1);
});

test('four explicit video inputs retain the action despite a static first-frame intent', () => {
    const video = loadTypeScript('server/src/imagePromptPacer.ts');
    const body = { scene: { number: 2, duration: 5 }, sceneIntent: { text: 'A subject waits before the required action.' },
        groundTruthAction: 'The subject performs the complete ordered action.', firstFramePrompt: 'The subject in the initial state.' };
    const context = video.videoPacingSystemContext(body);
    assert.match(context, /static depiction in Intent cannot veto/);
    const user = video.videoPacingUserContext(body);
    assert.deepEqual(JSON.parse(user.slice(user.indexOf('{'))), body);
});

test('shareable Three.js logs redact credentials and bound repeated events', () => {
    const logs = loadTypeScript('src/liveSceneDiagnostics.ts');
    const original = console.info; console.info = () => {};
    try {
        for (let i = 0; i < 400; i++) logs.liveSceneLog('heartbeat', { verified: true });
        logs.liveSceneLog('provider-error', { error: 'Bearer secret https://provider.test/?token=secret person@test.com sk-private-token r8_private eyJfoo.bar.sig' });
        const exported = logs.exportLiveSceneLogs(); const data = JSON.parse(exported);
        assert.equal(data.entries.length, 300);
        assert.ok(!exported.includes('secret')); assert.ok(!exported.includes('person@test.com'));
        assert.ok(!exported.includes('sk-private')); assert.ok(!exported.includes('r8_private'));
        assert.equal(data.entries.at(-1).event, 'provider-error');
    } finally { console.info = original; }
});


test('aborting a Replicate build cancels the owned remote prediction, including abort before its ID arrives', async () => {
    const { streamReplicateBuild } = loadTypeScript('server/src/replicateLiveBuild.ts');
    for (const early of [false,true]) {
        const controller = new AbortController(), cancelled = []; let creates=0;
        const provider = { predictions: {
            create: async () => { creates++; if(early) controller.abort(); return { id:'owned-build' }; },
            cancel: async id => { cancelled.push(id); },
        }, async *stream() {
            await this.predictions.create();
            if (!controller.signal.aborted) yield {event:'output',data:'first'};
            await new Promise(resolve => { if(controller.signal.aborted)resolve();else controller.signal.addEventListener('abort',resolve,{once:true}); });
        } };
        const iterator = streamReplicateBuild(provider,'fixture/model',{},controller.signal);
        const first = iterator.next(); if(!early) { await first; controller.abort(); } else await first;
        await iterator.next();
        assert.equal(creates,1); assert.deepEqual(cancelled,['owned-build']);
    }
});

test('a completed Replicate stream is retained and never cancelled', async () => {
    const { streamReplicateBuild } = loadTypeScript('server/src/replicateLiveBuild.ts');
    const cancelled=[],controller=new AbortController();
    const provider={predictions:{create:async()=>({id:'complete'}),cancel:async id=>cancelled.push(id)},async *stream(){await this.predictions.create();yield{event:'done'};}};
    for await(const event of streamReplicateBuild(provider,'fixture/model',{},controller.signal))assert.equal(event.event,'done');
    controller.abort();assert.deepEqual(cancelled,[]);
});

test('the Videos-tab effect auto-prompts without PlanVid, claims each target once, and protects drafts', () => {
    const filename = 'src/EditStory.tsx';
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
            && node.arguments[0]?.getText(source).includes('Claim before invoking')) effect = node.arguments[0];
        ts.forEachChild(node, visit);
    }
    visit(source); assert.ok(effect);
    const code = ts.transpileModule(`const run = ${effect.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const calls = [], claims = { current: null }, dirty = new Set(), loading = new Map();
    const bindings = { narrate: 2, VideMode: false, PLoader: false, manualOnlyVideoPrompts: false,
        captureSceneTarget: index => ({ type: 'A', index }), resolveSceneTargetIndex: target => target.index,
        getSceneTargetKey: target => 'A:' + target.index, resolveVideoPromptForTarget: () => '',
        dirtyVideoPromptScenesRef: { current: dirty }, autoPromptLoadingTargetsRef: { current: loading },
        autoPromptedPlanVidRef: claims, PlanVid: null, aSceneTopologyVersion: 0, PostId: 7,
        fetchAndGenerateImage: (...args) => calls.push(args), index: 0, videModel: 'SeedanceMini', AUTO_PROMPT_VIDEO_MODEL: 'SeedanceMini' };
    const run = overrides => new Function(...Object.keys(bindings), code + '\nreturn run;')(...Object.values({ ...bindings, ...overrides }))();
    run(); run(); assert.deepEqual(calls, [[0, '', 0, 'SeedanceMini', true]]);
    run({ index: 1 }); assert.equal(calls.length, 2);
    dirty.add('A:2'); run({ index: 2 }); assert.equal(calls.length, 2);
    loading.set('A:3', Symbol()); run({ index: 3 }); assert.equal(calls.length, 2);
    run({ index: 4, resolveVideoPromptForTarget: () => 'My written prompt' }); assert.equal(calls.length, 2);
    run({ index: 5, manualOnlyVideoPrompts: true }); assert.equal(calls.length, 2);
    run({ index: 5, narrate: 0 }); assert.equal(calls.length, 2);
    run({ index: 5, narrate: 0, VideMode: true }); assert.equal(calls.length, 3);
});
