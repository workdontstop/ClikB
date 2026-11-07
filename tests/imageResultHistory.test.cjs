const test = require('node:test'), assert = require('node:assert/strict');
const load = require('./loadTs.cjs');
const { upsertImageResultHistory: upsert, preciseImageResultIntent } = load('src/imageResultHistory.ts');
const { hashIntentValue } = load('src/intentBlueprint.ts');
const { videoImagePromptContext } = load('src/imagePromptPacing.ts');
const empty = () => ({ resultHistory: {}, resultImagePrompt: {}, resultIntent: {} });
const intent = name => ({ sceneId: name, kind: 'shorts-scene', mode: 'shorts', revision: 3, sourceContextHash: 'original-source',
    boundImagePromptHash: 'old-prompt', syncStatus: 'ready', derivedFrom: 'initial-compile', text: 'The original complete scene meaning.' });
function rows(history, key) {
    assert.equal(history.resultHistory[key].length, history.resultImagePrompt[key].length);
    assert.equal(history.resultHistory[key].length, history.resultIntent[key].length);
    return history.resultHistory[key].map((url, index) => [url, history.resultImagePrompt[key][index], history.resultIntent[key][index]]);
}
function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
}

test('A-roll, B-roll and single scene histories retain independent matching result metadata', () => {
    let history = empty();
    const cases = [['A:4', 'a-roll'], ['B:4:2', 'b-roll'], ['A:0', 'single']];
    for (const [key, name] of cases) {
        history = upsert(history, key, `${name}-first.png`, `${name} first description`, intent(`${name}-first`));
        history = upsert(history, key, `${name}-second.png`, `${name} second description`, intent(`${name}-second`));
    }
    for (const [key, name] of cases) assert.deepEqual(rows(history, key), [
        [`${name}-second.png`, `${name} second description`, intent(`${name}-second`)],
        [`${name}-first.png`, `${name} first description`, intent(`${name}-first`)],
    ]);
});

test('retry updates one corresponding result without adding metadata and moves its complete row to newest', () => {
    let history = upsert(empty(), 'A:1', 'first.png', 'First description', intent('first'));
    history = upsert(history, 'A:1', 'second.png', 'Second description', intent('second'));
    const before = structuredClone(history);
    freeze(history);
    const changed = upsert(history, 'A:1', 'first.png', 'Reconciled first description', intent('first-reconciled'));
    assert.deepEqual(rows(changed, 'A:1'), [
        ['first.png', 'Reconciled first description', intent('first-reconciled')],
        ['second.png', 'Second description', intent('second')],
    ]);
    assert.deepEqual(upsert(changed, 'A:1', 'first.png', 'Reconciled first description', intent('first-reconciled')), changed);
    assert.deepEqual(history, before, 'archiving must not mutate the active owner state');
});

test('newest=false appends new entries and updates an existing result in place', () => {
    let history = upsert(empty(), 'B:2:0', 'first.png', 'First', intent('first'));
    history = upsert(history, 'B:2:0', 'last.png', 'Last', null, { newest: false });
    history = upsert(history, 'B:2:0', 'first.png', 'Corrected first', intent('corrected'), { newest: false });
    assert.deepEqual(rows(history, 'B:2:0'), [
        ['first.png', 'Corrected first', intent('corrected')], ['last.png', 'Last', null],
    ]);
});

test('existing duplicate URL slots collapse with their matching metadata and legacy empty slots stay aligned', () => {
    const history = { resultHistory: { 'A:0': ['old.png', 'duplicate.png', 'duplicate.png', 'legacy.png'] },
        resultImagePrompt: { 'A:0': ['Old', 'Matching duplicate', 'Repeated duplicate'] },
        resultIntent: { 'A:0': [intent('old'), intent('duplicate'), intent('repeated')] } };
    const next = upsert(history, 'A:0', 'duplicate.png', 'Latest matching prompt', intent('latest'), { newest: false });
    assert.deepEqual(rows(next, 'A:0'), [
        ['old.png', 'Old', intent('old')], ['duplicate.png', 'Latest matching prompt', intent('latest')], ['legacy.png', '', null],
    ]);
});

test('Precise result intent binds only the new depiction and keeps original scene context without active mutations', () => {
    const original = intent('scene');
    original.imagePacing = { version: 1, originalImagePrompt: 'Complete original scene prompt.',
        pacedImagePrompt: 'Previous first-frame depiction.', handoff: 'Old transition from that frame.', fullScene: 'Original full story scene.' };
    original.imagePacingContext = { ...original.imagePacing, fullScene: 'Retained historical full scene.' };
    const before = structuredClone(original); freeze(original);
    const prompt = 'A complete current first frame with the accepted red coat and repaired door.';
    const result = preciseImageResultIntent(original, prompt);
    assert.equal(result.boundImagePromptHash, hashIntentValue(prompt));assert.equal(result.syncStatus, 'ready');
    assert.equal(result.text, original.text);assert.equal(result.revision, original.revision);
    for (const key of ['imagePacing', 'imagePacingContext']) {
        assert.notEqual(result[key], original[key]);
        assert.equal(result[key].originalImagePrompt, original[key].originalImagePrompt);
        assert.equal(result[key].fullScene, original[key].fullScene);
        assert.equal(result[key].pacedImagePrompt, prompt);assert.equal(result[key].handoff, '');
    }
    assert.deepEqual(videoImagePromptContext(prompt, result.imagePacing), {
        imageDescription: original.imagePacing.originalImagePrompt, startingImagePrompt: prompt,
        imagePacingHandoff: '', fullScene: original.imagePacing.fullScene,
    });
    result.imagePacing.fullScene = 'Changed archived copy';
    assert.deepEqual(original, before, 'original image pacing and original scene meaning stay untouched');
});

test('Precise result intent updates originalImagePrompt when a reconciled narrative is supplied', () => {
    const original = intent('scene');
    original.imagePacing = { version: 1, originalImagePrompt: 'Original unpaced story.',
        pacedImagePrompt: 'Old first frame.', handoff: 'Old handoff.', fullScene: 'Story.' };
    const result = preciseImageResultIntent(original, 'New first frame.', 'Reconciled unpaced story.');
    assert.equal(result.imagePacing.pacedImagePrompt, 'New first frame.');
    assert.equal(result.imagePacing.originalImagePrompt, 'Reconciled unpaced story.');
});

test('historical pacing supplies missing active pacing and missing scene intent stays unknown', () => {
    assert.equal(preciseImageResultIntent(null, 'New depiction'), null);
    const original = { ...intent('legacy'), syncStatus: 'failed',
        imagePacingContext: { version: 1, originalImagePrompt: 'Original', pacedImagePrompt: 'Old', handoff: 'Stale', fullScene: 'Full scene' } };
    const result = preciseImageResultIntent(original, 'New depiction');
    assert.deepEqual(result.imagePacing, { ...original.imagePacingContext, pacedImagePrompt: 'New depiction', handoff: '' });
    assert.equal(result.syncStatus, 'ready');
    const withoutPacing = preciseImageResultIntent(intent('no-pacing'), 'New depiction');
    assert.equal(withoutPacing.imagePacing, undefined);assert.equal(withoutPacing.imagePacingContext, undefined);
});
