const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
function load(file) {
    const filename = path.join(root, file), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return mod.exports;
}
const readiness = load('src/sceneImageReadiness.ts');
const { isHttpMediaUrl } = load('src/completedMediaLifecycle.ts');
const { isCompletedCreationMedia } = load('src/creationWorkOwnership.ts');
const source = ts.createSourceFile('Storybook.tsx', fs.readFileSync(path.join(root, 'src/Storybook.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findCallback(name) {
    let callback;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) callback = node.initializer.arguments[0];
        ts.forEachChild(node, visit);
    };
    visit(source); assert.ok(callback, name); return callback;
}
function evaluate(node, bindings) {
    const code = ts.transpileModule(`const run = ${node.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return Function(...Object.keys(bindings), code + ';return run;')(...Object.values(bindings));
}

test('a stored URL does not upgrade a known Nano preview into a finished scene', () => {
    const { hasFinalSceneImage, isPreviewSceneImage } = readiness;
    const preview = 'https://storage.test/opaque-image-id';
    assert.equal(hasFinalSceneImage({ hdImageUrl: preview, displayImageUrl: preview, quality: 'preview' }), false);
    assert.equal(hasFinalSceneImage({ hdImageUrl: preview, nanoImageUrl: preview }), false);
    assert.equal(hasFinalSceneImage({ hdImageUrl: 'https://storage.test/converted-hd', displayImageUrl: preview, quality: 'preview' }), false,
        'resizing a Nano preview must not certify its quality');
    for (const blank of ['', 'EMPTY', 'EMPTY_BSHOT', 'null', 'undefined', undefined]) {
        assert.equal(hasFinalSceneImage({ hdImageUrl: blank }), false);
        assert.equal(isPreviewSceneImage(blank, blank), false);
    }
    const final = 'https://storage.test/finished-id';
    assert.equal(hasFinalSceneImage({ hdImageUrl: final, displayImageUrl: final }), true, 'existing URL-only cover remains complete');
    assert.equal(hasFinalSceneImage({ hdImageUrl: final, displayImageUrl: 'https://storage.test/final-sd', nanoImageUrl: preview }), true,
        'retaining the old preview as a reference must not requeue a finished replacement');
    assert.equal(hasFinalSceneImage({ hdImageUrl: 'blob:legacy-finished', displayImageUrl: 'blob:legacy-finished' }), true);
    assert.equal(hasFinalSceneImage({ hdImageUrl: '', displayImageUrl: 'blob:new-full-result', quality: 'final', hasLocalImage: true }), true);
    assert.equal(hasFinalSceneImage({ hdImageUrl: '', hasLocalImage: true }), true);
});

test('actual Storybook scan keeps URL-only previews pending and skips completed A/B images', () => {
    const preview = 'https://storage.test/nano-stored';
    const bindings = {
        ...readiness,
        unifiedIndexMap: [{ type: 'A', index: 0 }, { type: 'A', index: 1 }, { type: 'B', index: 1, bIndex: 0 }, { type: 'B', index: 1, bIndex: 1 }],
        unifiedImagesHdCloud: ['https://storage.test/cover', preview, '', 'https://storage.test/b-final'],
        unifiedGeneratedImagesFlux: ['https://storage.test/cover', preview, undefined, 'https://storage.test/b-final'],
        unifiedNanoImages: [undefined, 'https://provider.test/original-nano', 'https://storage.test/b-preview', 'https://storage.test/b-old-preview'],
        dummyImageUrls: { 1: preview },
        imageProvenanceRef: { current: new readiness.SceneImageProvenance() },
    };
    bindings.imageProvenanceRef.current.mark('preview', preview);
    bindings.isSceneImageFinal = index => evaluate(findCallback('isSceneImageFinal'), {
        ...bindings, ImagesHdCloud: bindings.unifiedImagesHdCloud,
        generatedImagesFlux: bindings.unifiedGeneratedImagesFlux, nanoImages: bindings.unifiedNanoImages,
        generatedImagesFluxBlob: [], generatedImagesFluxBlobHd: [],
    })(index);
    const isEmpty = evaluate(findCallback('isUnifiedSlotEmpty'), bindings);
    assert.deepEqual(bindings.unifiedIndexMap.map((_, i) => isEmpty(i)), [false, true, true, false]);
    bindings.unifiedImagesHdCloud[1] = 'https://storage.test/final-hd';
    bindings.unifiedGeneratedImagesFlux[1] = 'https://storage.test/final-sd';
    assert.equal(isEmpty(1), false, 'full replacement stops being queued without clearing old source references');
    assert.equal(bindings.dummyImageUrls[1], preview);
});

test('storyboard Continue accepts preview images independently of optional full-image Auto', () => {
    let effect;
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
            && node.arguments[0].getText(source).includes('const allImagesReady =')) effect = node.arguments[0];
        ts.forEachChild(node, visit);
    };
    visit(source); assert.ok(effect);
    for (const scenario of [
        { display: ['https://storage.test/preview-1', 'https://storage.test/preview-2'], cloud: [], files: [], ready: true },
        { display: ['blob:preview-1', 'blob:preview-2'], cloud: [], files: [], ready: true },
        { display: [], cloud: ['https://storage.test/preview-1', 'https://storage.test/final-2'], files: [], ready: true },
        { display: [], cloud: [], files: [new Blob(['preview-1']), new Blob(['preview-2'])], ready: true },
        { display: ['https://storage.test/preview-1', ''], cloud: [], files: [], ready: false },
    ]) {
        let ready;
        evaluate(effect, { steps: ['One', 'Two'], generatedImagesFlux: scenario.display, ImagesHdCloud: scenario.cloud,
            generatedImagesFluxBlob: scenario.files, isHttpMediaUrl, isCompletedCreationMedia, setDone: value => { ready = value; } })();
        assert.equal(ready, scenario.ready);
    }
    assert.equal(readiness.hasFinalSceneImage({ hdImageUrl: 'https://storage.test/preview-1', quality: 'preview' }), false,
        'a preview sufficient for Continue still leaves optional full-image work available');
});

test('actual Auto runner skips a finished cover, in-flight work and already-fired preview slots', () => {
    let effect;
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0].getText(source).includes('const fireNext =')) effect = node.arguments[0];
        ts.forEachChild(node, visit);
    };
    visit(source); assert.ok(effect);
    const requested = [], scheduled = [], stopped = [];
    const bindings = {
        autoImageRunnerOn: true,
        autoGeneratorRef: { current: target => { requested.push(target); return true; } },
        autoScanRef: { current: {
            unifiedIndexMap: [{ type: 'A', index: 0 }, { type: 'A', index: 1 }, { type: 'A', index: 2 }],
            unifiedLoaders: [0, 0, 1],
            isUnifiedSlotEmpty: i => i !== 0,
            autoPendingIndexes: [1, 2],
        } },
        autoFiredKeysRef: { current: new Set() }, autoTickTimerRef: { current: null },
        sceneTargetKey: target => `${target.type}:${target.index}`,
        canSubmitBShotWork: () => true, isCompletedCreationMedia: () => false,
        bShotWorkLiveRef: { current: { videos: [] } },
        stopAutoImageRunner: () => stopped.push(true),
        setTimeout: callback => { scheduled.push(callback); return scheduled.length; },
        clearTimeout: () => {}, AUTO_TICK_MS: 8000, console,
    };
    const cleanup = evaluate(effect, bindings)();
    assert.deepEqual(requested, [{ type: 'A', index: 1 }]);
    scheduled.shift()();
    assert.equal(requested.length, 1, 'a pending preview already dispatched must not generate twice');
    bindings.autoScanRef.current.unifiedLoaders[2] = 0;
    scheduled.shift()();
    assert.deepEqual(requested, [{ type: 'A', index: 1 }, { type: 'A', index: 2 }]);
    bindings.autoScanRef.current.autoPendingIndexes = [];
    bindings.autoScanRef.current.isUnifiedSlotEmpty = () => false;
    scheduled.shift()();
    assert.equal(stopped.length, 1); cleanup();
});

test('registered Auto generator takes the full manual render path rather than adopting cached Nano again', async () => {
    const editor = ts.createSourceFile('EditStory.tsx', fs.readFileSync(path.join(root, 'src/EditStory.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(editor) === 'generateSceneImageForTarget') callback = node.initializer.arguments[0];
        ts.forEachChild(node, visit);
    };
    visit(editor); assert.ok(callback);
    const code = ts.transpileModule(`const run = ${callback.getText(editor)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const calls = [], target = { type: 'A', index: 1 };
    const bindings = {
        allowgetImage: true, resolveSceneTargetIndex: () => 1,
        GeneratedTextx: ['', 'Current full scene prompt'], GeneratedText: [], steps: [],
        GeneratedImages3: ['https://storage.test/reference'], onInstantBShotSave() {},
        refreshImagePromptReferences: (...args) => calls.push(['references', ...args]),
        setImagePromptDraftForTarget: (...args) => calls.push(['draft', ...args]),
        setGeneratingAt: (...args) => calls.push(['generating', ...args]),
        startLoader: (...args) => calls.push(['loader', ...args]),
        handleDraw: (...args) => { calls.push(['draw', ...args]); return Promise.resolve(true); },
    };
    const generate = Function(...Object.keys(bindings), code + ';return run;')(...Object.values(bindings));
    assert.equal(await generate(target), true);
    const draw = calls.find(call => call[0] === 'draw');
    assert.equal(draw[1], 'Current full scene prompt'); assert.equal(draw[5], target);
    assert.equal(calls.filter(call => call[0] === 'draw').length, 1);
    assert.equal(draw[4].automaticBShot, false);
});
