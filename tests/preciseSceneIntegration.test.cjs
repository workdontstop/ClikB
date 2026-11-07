const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const load = require('./loadTs.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../src/EditStory.tsx'), 'utf8');
const tree = ts.createSourceFile('EditStory.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function native(name, bindings) {
    let declaration;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) declaration = node.initializer;
        ts.forEachChild(node, visit);
    };
    visit(tree); assert.ok(declaration, `Missing native handler ${name}`);
    const callback = ts.isCallExpression(declaration) ? declaration.arguments[0] : declaration;
    const code = ts.transpileModule(`return (${callback.getText(tree)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return Function(...Object.keys(bindings), code)(...Object.values(bindings));
}
const historyHelpers = load('src/imageResultHistory.ts');
const { StoredBinaryUploads } = load('src/completedMediaLifecycle.ts');
const { DraftController } = load('src/creationDrafts/store.ts');
const { operationalDraftMediaUrls } = load('server/src/creationDrafts/schema.ts');
const { hashIntentValue } = load('src/intentBlueprint.ts');
const keyFor = target => target.type === 'B' ? `B:${target.index}:${target.bIndex}` : `A:${target.index}`;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const initialIntent = () => ({ sceneId: 'scene-owned', kind: 'shorts-scene', mode: 'shorts', revision: 1,
    sourceContextHash: 'original', boundImagePromptHash: hashIntentValue('Original first frame'), syncStatus: 'ready',
    derivedFrom: 'initial-compile', text: 'Original story conception', imagePacing: { version: 1,
        originalImagePrompt: 'Original complete scene', pacedImagePrompt: 'Original first frame', handoff: 'Earlier movement', fullScene: 'Full original story' } });

function fixture({ target = { type: 'A', index: 1 }, single = false, draft = null } = {}) {
    const index = single ? 0 : 2, key = keyFor(target), sourceUrl = 'https://assets.test/original.png';
    const state = { images: [], previews: [], prompts: single ? 'Original first frame' : [], video: ['https://assets.test/existing.mp4'],
        intent: initialIntent(), history: {}, historyPrompts: {}, historyIntents: {}, noImage: [], draw: {}, owned: true,
        downloadFailure: false, uploadFailure: false };
    state.images[index] = sourceUrl; state.previews[index] = sourceUrl;
    if (!single) state.prompts[index] = 'Original first frame';
    const calls = { downloads: [], uploads: [], signatures: 0, applied: [], commits: [], reconciles: [], metadata: [], errors: [], conversions: 0, stored: [] };
    const refs = { current: { ImagesHdCloud: state.images, generatedImagesFlux: state.previews, GeneratedText: state.prompts } };
    const setters = field => value => { state[field] = typeof value === 'function' ? value(state[field]) : value;
        if (field === 'images') refs.current.ImagesHdCloud = state.images;
        if (field === 'previews') refs.current.generatedImagesFlux = state.previews;
        if (field === 'prompts') refs.current.GeneratedText = state.prompts;
    };
    const b = {
        ...historyHelpers, creationDraft: draft, index, type: single ? 1 : 0, isArrayMode: !single,
        PostId: 7, creationProjectId: 'project-precise', sceneImageMode: 'edit', imageActionBusy: false,
        normalDisplayedImage: sourceUrl, currentDisplayedImage: sourceUrl, referenceImages: [],
        getPromptReferenceUrl: reference => reference.url, getSceneTargetKey: keyFor,
        captureSceneTarget: () => ({ ...target }), resolveSceneTargetIndex: value => state.owned && keyFor(value) === key ? index : -1,
        captureMediaSaveOwner: () => () => state.owned, getSceneIntentForTarget: () => state.intent,
        getImagePacingForTarget: () => state.intent?.imagePacing,
        getBShotSaveContextSnapshot: textValue => ({ textValue, imageQuality: 'final', isBShotMedia: target.type === 'B' }),
        preciseSessionRef: { current: null }, preciseSequenceRef: { current: 0 },
        setPreciseSession: value => { b.preciseSessionRef.current = value; }, setPreciseSnapshot() {},
        imagePromptDraftsRef: { current: { [key]: 'Original first frame' } }, sceneSourceDataRef: refs,
        resultHistoryRef: { current: {} }, resultImagePromptRef: { current: {} }, resultIntentRef: { current: {} },
        setResultHistory: setters('history'), setResultImagePrompt: setters('historyPrompts'), setResultIntent: setters('historyIntents'),
        captureCreationCache: (controller, section, patch) => { if (controller) controller.capture(section, patch); },
        imageUploadsRef: { current: new StoredBinaryUploads() }, latestImageSaveRef: { current: new Map() },
        downloadImageUrlAsBlob: async url => {
            calls.downloads.push(url); if (state.downloadFailure) throw new Error('Download failed');
            return new Blob([url], { type: 'image/png' });
        },
        GenerateSignedUrlForSingleImage: async () => ({ id: ++calls.signatures }),
        PutSingleImageInS3WithURL: async (blob, signed) => {
            calls.uploads.push(blob); if (state.uploadFailure) throw new Error('Upload failed');
            return `https://storage.test/result-${signed.id}.png`;
        },
        recordGeneratedImageModel: (model, urls) => calls.metadata.push({ model, urls }), inheritImageResultModel() {},
        setGeneratingAt() {}, startLoader() {}, finishLoader() {}, Saveprompthelperfordellater() {},
        setGeneratedImagesFluxBlob() {}, setGeneratedImagesFluxBlobHd() {},
        setGeneratedImagesFlux: setters('previews'), setImagesHdCloud: setters('images'),
        setFluxImBlob() {}, setFluxIm: value => { state.previews[index] = value; },
        setGeneratedImagePrompt() {}, onImageMediaStored: (_target, receipt) => calls.applied.push(receipt),
        persistStoredEditorImage: async (...args) => calls.stored.push(args),
        mediaPreviewRevocationsRef: { current: new Set() }, setMediaOwnershipVersion() {},
        setGeneratedText: setters('prompts'),
        setImagePromptDraftForTarget: (value, prompt) => { b.imagePromptDraftsRef.current[keyFor(value)] = prompt; },
        refreshImagePromptReferences() {},
        reconcileImagePromptIntent: async (_target, prompt) => { calls.reconciles.push(prompt); return true; },
        restoreSceneIntentSnapshot: (_target, intent) => { state.intent = intent; },
        persistEditorCaches() {}, requestAnimationFrame: callback => setImmediate(callback),
        ImagesHdCloud: state.images, EDITSTORY_HISTORY_BROWSER_TRANSFER: false, nanoImages: [], textValue: 'Original first frame',
        modelz: 'test-model', ratioKey: 1, isSceneImageFinalAtIndex: () => true,
        convertToHDWebpOrJpegByDevicex: async () => { calls.conversions++; throw new Error('Archived PNG must not be converted'); },
        convertToHDWebpOrJpegByDeviceHdx: async () => { calls.conversions++; throw new Error('Archived PNG must not be converted'); },
        URL: { createObjectURL: () => 'blob:reused-preview', revokeObjectURL() {} },
        setnoImagePrompt: setters('noImage'), updateDrawFrameScene: (at, update) => { state.draw[at] = update(state.draw[at] || {}); },
        matchMobile: false, setShow() {}, console: { error() {} },
        globalErrorEmitter: { emit: detail => calls.errors.push(detail) },
    };
    b.captureImageSaveOwner = native('captureImageSaveOwner', b);
    b.rememberImageResult = native('rememberImageResult', b);
    b.handleUpdateFluxImage = native('handleUpdateFluxImage', b);
    const realUpdate = b.handleUpdateFluxImage;
    b.handleUpdateFluxImage = async (...args) => { calls.commits.push(args); return realUpdate(...args); };
    b.commitImagePromptToScene = native('commitImagePromptToScene', b);
    b.archivePreciseImage = native('archivePreciseImage', b);
    b.savePreciseImage = native('savePreciseImage', b);
    b.onImageUrlChange = native('onImageUrlChange', b);
    native('openPreciseEditor', b)();
    return { b, state, calls, key, index, sourceUrl, archive: b.archivePreciseImage, save: b.savePreciseImage,
        restore: b.onImageUrlChange, cancel: native('closePreciseEditor', b) };
}

test('two paid results remain paired in the real draft after Cancel and a new owner hydrates', async () => {
    const storageValues = new Map(), protectedMedia = [], checkpoints = [];
    const storage = { getItem: key => storageValues.get(key) || null, setItem: (key, value) => storageValues.set(key, value) };
    const draft = new DraftController({ accountId: 7, creationProjectId: 'project-precise', creationType: 0, storage,
        protectMedia: value => protectedMedia.push(value), api: { checkpoint: async request => checkpoints.push(request) } });
    const f = fixture({ draft });
    try {
        const original = structuredClone({ images: f.state.images, prompts: f.state.prompts, video: f.state.video, intent: f.state.intent });
        await f.archive({ imageUrl: 'https://provider.test/first.png', prompt: 'Whole first frame with red coat', modelName: 'GPT Flare' });
        await f.archive({ imageUrl: 'https://provider.test/second.png', prompt: 'Whole first frame with red coat and repaired door', modelName: 'Krea 3' });
        f.cancel();
        assert.equal(f.b.preciseSessionRef.current, null);
        assert.deepEqual({ images: f.state.images, prompts: f.state.prompts, video: f.state.video, intent: f.state.intent }, original);
        assert.equal(f.calls.commits.length, 0); assert.equal(f.calls.reconciles.length, 0);
        const editor = draft.section('editor');
        assert.deepEqual(editor.resultHistory[f.key], ['https://storage.test/result-2.png', 'https://storage.test/result-1.png', f.sourceUrl]);
        assert.deepEqual(editor.resultImagePrompt[f.key], ['Whole first frame with red coat and repaired door', 'Whole first frame with red coat', 'Original first frame']);
        assert.equal(editor.resultIntent[f.key][0].imagePacing.pacedImagePrompt, editor.resultImagePrompt[f.key][0]);
        assert.equal(editor.resultIntent[f.key][1].imagePacing.pacedImagePrompt, editor.resultImagePrompt[f.key][1]);
        assert.ok(protectedMedia.some(patch => patch.resultHistory?.[f.key]?.includes('https://storage.test/result-2.png')));
        assert.deepEqual(operationalDraftMediaUrls(draft.getState().snapshot).sort(), [...editor.resultHistory[f.key]].sort());
        assert.equal(checkpoints.length, 0, 'pre-Continue archival does not create a new post');
        const envelope = JSON.parse(storage.getItem('clik-creation-draft:v1:7:project-precise'));
        const resumed = new DraftController({ accountId: 7, creationProjectId: 'project-precise', creationType: 0, storage,
            protectMedia() {}, record: { postId: 7, draftId: 'draft', revision: 1, digest: 'saved', snapshot: envelope.snapshot, published: false } });
        try { resumed.endHydration(); assert.deepEqual(resumed.section('editor'), editor); }
        finally { resumed.dispose(); }
    } finally { draft.dispose(); }
});

test('archival and repeated Save reuse the exact PNG upload and keep one matching history row', async () => {
    let flushes = 0;
    const draft = { capture() {}, flush: async () => { if (++flushes === 3) throw new Error('Final draft save failed'); } };
    const f = fixture({ draft }), result = { imageUrl: 'https://provider.test/paid.png', prompt: 'Whole first frame after accepted edits', modelName: 'Krea 3' };
    const oldVideo = [...f.state.video];
    const receipt = await f.archive(result);
    await assert.rejects(f.save(result), /Final draft save failed/);
    await f.save(result);
    assert.equal(f.calls.downloads.length, 1);
    assert.equal(f.calls.uploads.length, 1); assert.equal(f.calls.signatures, 1);
    assert.equal(f.calls.uploads[0], receipt.blob);
    assert.equal(f.calls.commits.length, 1, 'retrying Save must not run the image mutator again');
    assert.equal(f.calls.commits[0][0], receipt.blob); assert.equal(f.calls.commits[0][2], receipt.blob);
    assert.deepEqual(f.calls.commits[0][6], { type: 'A', index: 1 }, 'apply uses captured native identity');
    assert.equal(f.state.images[f.index], receipt.savedUrl);
    assert.equal(f.state.prompts[f.index], result.prompt);
    assert.equal(f.b.imagePromptDraftsRef.current[f.key], result.prompt);
    assert.equal(f.state.history[f.key].filter(url => url === receipt.savedUrl).length, 1);
    const position = f.state.history[f.key].indexOf(receipt.savedUrl);
    assert.equal(f.state.historyPrompts[f.key][position], result.prompt);
    assert.equal(f.state.historyIntents[f.key][position].imagePacing.pacedImagePrompt, result.prompt);
    assert.deepEqual(f.state.video, oldVideo);
    assert.equal(f.calls.conversions, 0, 'Precise bytes pass through the existing save without canvas conversion');
});

for (const scenario of [
    { name: 'A-roll', target: { type: 'A', index: 1 } },
    { name: 'B-roll', target: { type: 'B', index: 1, bIndex: 2 } },
    { name: 'single scene', target: { type: 'A', index: 0 }, single: true },
]) test(`history restoration applies the stored PNG and exact matching prompt for ${scenario.name}`, async () => {
    const f = fixture(scenario), selected = 'https://storage.test/archived-precise.png', matchingPrompt = `Matching ${scenario.name} whole-frame description`;
    const savedIntent = historyHelpers.preciseImageResultIntent(f.state.intent, matchingPrompt);
    f.b.rememberImageResult(f.key, selected, matchingPrompt, savedIntent);
    const oldVideo = [...f.state.video];
    await f.restore(selected, 0);
    assert.deepEqual(f.calls.errors, []);
    assert.equal(f.calls.downloads.length, 1); assert.equal(f.calls.uploads.length, 1);
    assert.equal(f.calls.commits.length, 1);
    assert.equal(f.calls.commits[0][0], f.calls.uploads[0]);
    assert.equal(f.calls.commits[0][2], f.calls.uploads[0]);
    assert.deepEqual(f.calls.commits[0][6], scenario.target);
    assert.equal(f.state.images[f.index], 'https://storage.test/result-1.png');
    assert.equal(scenario.single ? f.state.prompts : f.state.prompts[f.index], matchingPrompt);
    assert.equal(f.b.imagePromptDraftsRef.current[f.key], matchingPrompt);
    assert.deepEqual(f.state.intent, savedIntent);
    const position = f.state.history[f.key].indexOf(f.state.images[f.index]);
    assert.equal(f.state.historyPrompts[f.key][position], matchingPrompt);
    assert.deepEqual(f.state.historyIntents[f.key][position], savedIntent);
    assert.equal(f.calls.conversions, 0); assert.deepEqual(f.state.video, oldVideo);
});

for (const failure of ['download', 'upload']) test(`failed history ${failure} leaves the active image, prompt and intent together`, async () => {
    const f = fixture(), selected = 'https://storage.test/archived-precise.png';
    f.b.rememberImageResult(f.key, selected, 'Stored description', historyHelpers.preciseImageResultIntent(f.state.intent, 'Stored description'));
    const before = structuredClone({ images: f.state.images, prompts: f.state.prompts, intent: f.state.intent, video: f.state.video });
    f.state[failure + 'Failure'] = true;
    await f.restore(selected, 0);
    assert.deepEqual({ images: f.state.images, prompts: f.state.prompts, intent: f.state.intent, video: f.state.video }, before);
    assert.equal(f.b.imagePromptDraftsRef.current[f.key], 'Original first frame');
    assert.equal(f.calls.commits.length, 0); assert.equal(f.calls.reconciles.length, 0);
    assert.equal(f.calls.errors.length, 1);
});

test('Save rejects a same-scene source change while archival waits without applying over it', async () => {
    const f = fixture(), result = { imageUrl: 'https://provider.test/paid.png', prompt: 'Accepted result description', modelName: 'Krea 3' };
    await f.archive(result);
    const gate = deferred(); let entered;
    const began = new Promise(resolve => { entered = resolve; });
    f.b.creationDraft = { flush: async () => { entered(); await gate.promise; } };
    f.b.archivePreciseImage = native('archivePreciseImage', f.b);
    const save = native('savePreciseImage', f.b);
    const work = save(result);
    await began;
    f.state.images[f.index] = 'https://assets.test/newer-background-result.png';
    f.b.sceneSourceDataRef.current.ImagesHdCloud = [...f.state.images];
    gate.resolve();
    await assert.rejects(work, /changed|Reopen/);
    assert.equal(f.calls.commits.length, 0, 'no active mutation is sent after the source changes');
    assert.equal(f.state.images[f.index], 'https://assets.test/newer-background-result.png');
    assert.equal(f.state.prompts[f.index], 'Original first frame');
    assert.ok(f.state.history[f.key].includes('https://storage.test/result-1.png'), 'paid output stays archived');
});
