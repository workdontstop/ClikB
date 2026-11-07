const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.resolve(__dirname, '../src/cinemaDialogue.ts');
const mod = new Module(file, module);
mod.filename = file;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { buildCinemaDialogueSource, createCinemaDialoguePlanCache } = mod.exports;

function options(overrides = {}) {
    const nativeToDisplay = new Map([[0, 0], [1, 3], [2, 4], [3, 5]]);
    return {
        creationType: 1, target: { type: 'A', index: 1 },
        narration: { text: '[calmly] Almost there. I am calibrating the engine. It is not fully stable yet.', prompt: 'Cuzon speaks calmly.' },
        duration: 5, resolveIndex: native => nativeToDisplay.get(native) ?? -1,
        imageDescription: display => ['Cuzon at helm', 'Supplemental engine detail', 'Supplemental hand detail', 'Cuzon adjusts core'][display],
        context: native => ['First calibrate; do not claim completion.', 'Second adjustment still does not fully stabilize.'][native],
        intent: native => ({ sceneId: `native-${native}`, revision: 1 }),
        frame: display => `image-${display}.png`,
        videoContext: { exclusions: ['No title overlays'] },
        llmTier: 'standard',
        ...overrides,
    };
}

test('Cinema stages resolve native even and odd A slots around supplemental B shots', () => {
    const source = buildCinemaDialogueSource(options());
    assert.equal(source.pairIndex, 0);
    assert.equal(source.narration.stage, 'B');
    assert.deepEqual(source.narration.stages.map(stage => stage.imageDescription), ['Cuzon at helm', 'Cuzon adjusts core']);
    assert.deepEqual(source.narration.stages.map(stage => stage.context), ['First calibrate; do not claim completion.', 'Second adjustment still does not fully stabilize.']);
    assert.equal(source.narration.delivery, 'Cuzon speaks calmly.');
    assert.equal(source.narration.text, options().narration.text);
    const first = buildCinemaDialogueSource(options({ target: { type: 'A', index: 0 } }));
    assert.equal(first.signature, source.signature, 'The requested stage must not split the shared speech cache');
    assert.equal(first.narration.stage, 'A');
});

test('non-Cinema modes, supplemental B shots and empty narration keep their existing dialogue route', () => {
    for (const creationType of [0, 2, 3, undefined]) assert.equal(buildCinemaDialogueSource(options({ creationType })), null);
    assert.equal(buildCinemaDialogueSource(options({ target: { type: 'B', index: 0 } })), null);
    for (const narration of ['', ' ', undefined, {}, { text: '' }]) assert.equal(buildCinemaDialogueSource(options({ narration })), null);
    assert.equal(buildCinemaDialogueSource(options({ resolveIndex: () => -1 })), null);
});

test('duration changes plan from the full original narration and invalidate cached summaries', () => {
    const first = buildCinemaDialogueSource(options()), longer = buildCinemaDialogueSource(options({ duration: 10 }));
    assert.notEqual(longer.signature, first.signature);
    assert.equal(longer.narration.text, first.narration.text);
    assert.deepEqual(longer.narration.stages.map(stage => stage.duration), [10, 10]);
    const cache = createCinemaDialoguePlanCache();
    assert.equal(cache.store(first.signature, { stageA: 'Short first line', stageB: 'Short second line' }, cache.epoch()), true);
    assert.equal(cache.get(longer.signature), undefined);
    assert.deepEqual(cache.get(first.signature), { stageA: 'Short first line', stageB: 'Short second line' });
});

test('narration, delivery, either stage truth, reference frames and video instructions each invalidate speech allocation', () => {
    const original = buildCinemaDialogueSource(options());
    for (const change of [
        { narration: { ...options().narration, text: 'The original speech has changed.' } },
        { narration: { ...options().narration, prompt: 'Speak urgently.' } },
        { imageDescription: display => display === 3 ? 'New stage B subjects' : options().imageDescription(display) },
        { context: native => native === 0 ? 'New stage A context' : options().context(native) },
        { intent: native => ({ sceneId: `native-${native}`, revision: 2 }) },
        { frame: display => display === 3 ? 'new-second-image.png' : options().frame(display) },
        { videoContext: { exclusions: ['No dialogue in stage A'] } },
        { llmTier: 'terra' },
    ]) assert.notEqual(buildCinemaDialogueSource(options(change)).signature, original.signature);
    assert.equal(buildCinemaDialogueSource(options()).signature, original.signature, 'Equal content in newly allocated arrays must keep the plan');
});

test('cache accepts intentional silence but rejects malformed responses and responses from an old creation epoch', () => {
    const cache = createCinemaDialoguePlanCache(), source = buildCinemaDialogueSource(options()), epoch = cache.epoch();
    assert.equal(cache.store(source.signature, { stageA: '', stageB: 'Cuzon: says "Ready."' }, epoch), true);
    assert.equal(cache.get(source.signature).stageA, '');
    for (const response of [undefined, null, '', {}, { stageA: 'Line' }, { stageA: 'Line', stageB: null }]) assert.equal(cache.store(source.signature, response, epoch), false);
    cache.reset();
    assert.equal(cache.get(source.signature), undefined);
    assert.equal(cache.store(source.signature, { stageA: 'Old A', stageB: 'Old B' }, epoch), false);
});

test('concurrent pair reservations share completion and reset releases waiters without unlocking a new owner', async () => {
    const cache = createCinemaDialoguePlanCache();
    const owner = cache.reserve('pair'), waiter = cache.reserve('pair');
    assert.equal(owner.owner, true);
    assert.equal(waiter.owner, false);
    let released = false;
    waiter.completion.then(() => { released = true; });
    await Promise.resolve();
    assert.equal(released, false);
    owner.release();
    await waiter.completion;
    assert.equal(released, true);
    const oldOwner = cache.reserve('pair'), oldWaiter = cache.reserve('pair');
    cache.reset();
    await oldWaiter.completion;
    const newOwner = cache.reserve('pair');
    assert.equal(newOwner.owner, true);
    oldOwner.release();
    assert.equal(cache.reserve('pair').owner, false, 'The old request finally released the new owner');
    newOwner.release();
});
