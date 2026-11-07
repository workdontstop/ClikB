const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadTypeScript } = require('./promptTestBindings.cjs');
const { createInitialVideoDialogueCache } = loadTypeScript('src/videoDialogue.ts');
const { createCinemaDialoguePlanCache } = loadTypeScript('src/cinemaDialogue.ts');
const source = ts.createSourceFile('EditStory.tsx', fs.readFileSync(path.join(__dirname, '../src/EditStory.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function extractFunction(name) {
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
        ts.forEachChild(node, visit);
    }
    visit(source); assert.ok(found, name);
    const js = ts.transpileModule(found.getText(source).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(`${js}\nreturn ${name};`)();
}
function effect(fragment, bindings) {
    let found;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
            && node.arguments[0]?.getText(source).includes(fragment)) found = node.arguments[0];
        ts.forEachChild(node, visit);
    }
    visit(source); assert.ok(found, fragment);
    const js = ts.transpileModule(`const callback=${found.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(bindings), `${js}\nreturn callback;`)(...Object.values(bindings));
}

test('completed dialogue snapshot survives JSON and rejects responses from before restoration', () => {
    const cache = createInitialVideoDialogueCache();
    cache.store(cache.begin('A:0'), '@Cuzon: says "Keep the source stable."');
    const stale = cache.begin('B:0:1');
    const snapshot = JSON.parse(JSON.stringify(cache.snapshot()));
    assert.deepEqual(Object.keys(snapshot), ['version', 'entries']);
    cache.restore(snapshot);
    assert.match(cache.get('A:0'), /Keep the source stable/);
    assert.equal(cache.store(stale, '@Wrong: says "Stale result."'), false);
    assert.equal(cache.get('B:0:1'), '');
    assert.match(cache.take('A:0'), /^VOICE & DIALOG:/);
    assert.equal(cache.get('A:0'), '');
});

test('Cinema snapshot stores only creative allocations and releases old reservations during restore', async () => {
    const cache = createCinemaDialoguePlanCache();
    const signature = JSON.stringify({ frames: ['https://assets/frame-a.png', 'https://assets/frame-b.png'], duration: 5 });
    cache.store(signature, { stageA: '', stageB: '@Cuzon: says "The engine is ready."' }, cache.epoch());
    const oldEpoch = cache.epoch(), waiting = cache.reserve('pending-pair');
    const snapshot = JSON.parse(JSON.stringify(cache.snapshot()));
    assert.deepEqual(Object.keys(snapshot), ['version', 'entries']);
    assert.doesNotMatch(JSON.stringify(snapshot), /completion|promise|epoch|pending-pair/);
    cache.restore(snapshot);
    await waiting.completion;
    assert.deepEqual(cache.get(signature), { stageA: '', stageB: '@Cuzon: says "The engine is ready."' });
    assert.equal(cache.store(signature, { stageA: 'Old A', stageB: 'Old B' }, oldEpoch), false);
    const newOwner = cache.reserve('pending-pair');
    waiting.release();
    assert.equal(cache.reserve('pending-pair').owner, false);
    newOwner.release();
    const detached = cache.snapshot(); detached.entries[0][1].stageB = 'Mutated clone';
    assert.match(cache.get(signature).stageB, /engine is ready/);
});

test('invalid snapshot data never creates dialogue or ready allocations', () => {
    const speech = createInitialVideoDialogueCache(), cinema = createCinemaDialoguePlanCache();
    speech.restore({ version: 1, entries: [['A:0', 'No dialogue.'], ['B:0:0', null], ['A:2', '@Hero: says "Valid."']] });
    assert.equal(speech.get('A:0'), ''); assert.equal(speech.get('B:0:0'), '');
    assert.match(speech.get('A:2'), /Valid/);
    cinema.restore({ version: 1, entries: [['pair', { stageA: 'A', stageB: null }], [null, { stageA: '', stageB: '' }]] });
    assert.equal(cinema.get('pair'), undefined);
    speech.restore({ version: 999, entries: [['A:0', 'Invalid schema']] });
    assert.equal(speech.get('A:2'), '');
});

test('first editor plan/topology effects keep restored speech; genuine changes invalidate it', () => {
    const speech = createInitialVideoDialogueCache(), cinema = createCinemaDialoguePlanCache();
    speech.restore({ version: 1, entries: [['A:0', '@Hero: says "Retained."']] });
    cinema.restore({ version: 1, entries: [['pair', { stageA: 'A', stageB: 'B' }]] });
    const plan = { story: 'One accepted plan' }, planSignature = JSON.stringify(plan);
    const owner = { current: { signature: planSignature, postId: '8', creationProjectId: 'creation-one', pageType: 1 } };
    const initialDialoguePlanRef = { current: plan };
    const sources = { current: new Map([['A:0', 'pair']]) };
    const runPlan = options => effect('const previous = lastDialoguePlanOwnerRef.current', {
        lastDialoguePlanOwnerRef: owner, editorPlanSignature: planSignature, PostId: 8, creationProjectId: 'creation-one', pageType: 1,
        PlanVid: plan, initialDialoguePlanRef, initialDialogueCacheRef: { current: speech },
        cinemaDialoguePlanCacheRef: { current: cinema }, initialCinemaDialogueSourcesRef: sources,
        refreshInitialDialogue() {}, ...options,
    })();
    runPlan({ PlanVid: { ...plan } });
    assert.match(speech.get('A:0'), /Retained/); assert.deepEqual(cinema.get('pair'), { stageA: 'A', stageB: 'B' });
    const topologyOwner = { current: { pageType: 1, topology: '[0,1]' } };
    const runTopology = topology => effect('const previous = previousCinemaTopologyRef.current', {
        previousCinemaTopologyRef: topologyOwner, pageType: 1, cinemaDialogueTopology: topology,
        initialDialogueCacheRef: { current: speech }, cinemaDialoguePlanCacheRef: { current: cinema },
        initialCinemaDialogueSourcesRef: sources, refreshInitialDialogue() {},
    })();
    runTopology('[0,1]'); assert.match(speech.get('A:0'), /Retained/);
    runTopology('[0]'); assert.equal(speech.get('A:0'), ''); assert.equal(cinema.get('pair'), undefined);
    speech.store(speech.begin('A:0'), 'Another accepted result');
    runPlan({ editorPlanSignature: JSON.stringify({ story: 'New authored plan' }) });
    assert.equal(speech.get('A:0'), '');
});

test('editor media uses the owned revisioned checkpoint and preserves promotion result', async () => {
    const persist = extractFunction('persistEditorDraftMedia'), calls = [];
    const values = { postId: 8, type: 1, vid: 'https://assets/accepted.mp4', mode: 1 };
    const sections = { storybook: { VideoArrayCloud: ['https://assets/earlier.mp4'] } };
    const controller = { getState: () => ({ postId: 8 }), section: name => sections[name],
        capture: (name, patch) => { sections[name] = { ...sections[name], ...patch }; },
        checkpoint: async (...args) => { calls.push(args); assert.equal(sections.storybook.VideoArrayCloud[1], values.vid); return { postId: 8, promoted: false }; } };
    const response = await persist(controller, 8, 'video', values, () => { throw Error('Legacy writer must not race draft writer'); });
    assert.deepEqual(calls, [['quiet', { kind: 'video', values }]]);
    assert.equal(response.data.promoted, false);
});

test('only missing migration permits legacy fallback; stale/hydrating/foreign media never falls through', async () => {
    const persist = extractFunction('persistEditorDraftMedia'); let legacy = 0;
    const fallback = async () => { legacy++; return { data: { saved: true } }; };
    const controller = (state, error) => ({ getState: () => state, checkpoint: async () => { throw error; } });
    await persist(undefined, 8, 'image-edit', {}, fallback);
    await persist(controller({ postId: null }), 8, 'video', {}, fallback);
    await persist(controller({ postId: 8 }, { status: 503, code: 'DRAFTS_NOT_INSTALLED' }), 8, 'video', {}, fallback);
    assert.equal(legacy, 3);
    for (const state of [{ postId: 8, closed: true }, { postId: 8, hydrating: true }, { postId: 8, conflicted: true }, { postId: 9 }]) {
        await assert.rejects(() => persist(controller(state), 8, 'video', {}, fallback));
    }
    await assert.rejects(() => persist(controller({ postId: 8 }, new Error('Network failed')), 8, 'video', {}, fallback), /Network failed/);
    await assert.rejects(() => persist(controller({ postId: 8 }, { status: 409, code: 'DRAFT_CONFLICT' }), 8, 'video', {}, fallback));
    assert.equal(legacy, 3);
});

test('completed restored Motion Ref skips live provider recovery while missing guides keep the normal recovery route', () => {
    let recoveries = 0;
    const callback = effect('if (isMotionMode && !hasRestoredCompletedMotion)', {
        isMotionMode: true, hasRestoredCompletedMotion: true, motion: { recover: () => recoveries++ }, currentSceneTarget: { type: 'A', index: 0 },
    });
    callback(); assert.equal(recoveries, 0);
    effect('if (isMotionMode && !hasRestoredCompletedMotion)', {
        isMotionMode: true, hasRestoredCompletedMotion: false, motion: { recover: () => recoveries++ }, currentSceneTarget: { type: 'B', index: 0, bIndex: 1 },
    })();
    assert.equal(recoveries, 1);
});
