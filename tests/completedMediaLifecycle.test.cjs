const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
function load(file) { const filename = path.resolve(__dirname, '..', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename); return mod.exports; }
const media = load('src/completedMediaLifecycle.ts'), creation = load('src/creationWorkOwnership.ts'), scene = load('src/sceneTargetArchitecture.ts');
const readiness = load('src/sceneImageReadiness.ts');
const source = fs.readFileSync(path.resolve(__dirname, '../src/Storybook.tsx'), 'utf8'), tree = ts.createSourceFile('Storybook.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name) { let found; const walk = node => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer; ts.forEachChild(node, walk); }; walk(tree); assert.ok(found, name); return (ts.isCallExpression(found) ? found.arguments[0] : found).getText(tree); }
function effect(fragment) { let found; const walk = node => { if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0].getText(tree).includes(fragment)) found = node.arguments[0]; ts.forEachChild(node, walk); }; walk(tree); assert.ok(found, fragment); return found.getText(tree); }
function bind(code, bindings) { bindings = { inheritImageResultModel() {}, recordGeneratedImageModel() {}, imageModelsForSources: () => ({}), imageModelForSource: () => undefined, imageModelForGenerationRoute: route => route, ...bindings }; const js = ts.transpileModule(`const run = ${code};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; return Function(...Object.keys(bindings), js + ';return run;')(...Object.values(bindings)); }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(count = 18) {
    const sd = Array.from({ length: count }, (_, index) => new Blob([`SD-${index}`], { type: 'image/webp' }));
    const hd = Array.from({ length: count }, (_, index) => new Blob([`HD-${index}-larger`], { type: 'image/webp' }));
    const previews = sd.map((_, index) => `blob:scene-${index}`), cloud = sd.map(() => '');
    const state = { sd, hd, previews, cloud, dummy: {}, loading: false, videoMode: false, stored: [], db: [], revoked: [], errors: [], planCalls: 0, ready: false };
    const live = { sd, hd, previews, cloud, steps: sd.map((_, index) => `Scene ${index + 1}`), projectId: 'project-1', aTopology: 0, liveSources: previews };
    const mutate = field => value => { state[field] = typeof value === 'function' ? value(state[field]) : value; if (['sd', 'hd', 'previews', 'cloud'].includes(field)) live[field] = state[field]; live.liveSources = [...state.previews, ...Object.values(state.dummy)]; };
    const bindings = {
        ...media, ...creation, ...scene, ...readiness, imageLifecycleLiveRef: { current: live },
        dispatch() {}, recordCreationAttemptStart: value => value, recordCreationAttemptSuccess: value => value, recordCreationAttemptFailure: value => value,
        imageProvenanceRef: { current: new readiness.SceneImageProvenance() },
        imageMediaReceiptsRef: { current: {} }, imageStoredAliasesRef: { current: new Map() }, retainedInitialImageResultsRef: { current: [] }, imageBinaryUploadsRef: { current: new media.StoredBinaryUploads() }, imageDownloadedInputsRef: { current: new Map() },
        videoHistoryRef: { current: {} }, normalizeVideoHistory: value => value,
        ownedImageObjectUrlsRef: { current: new Set(previews) }, releasableImageObjectUrlsRef: { current: new Set() }, setImageMediaRevision() {},
        setGeneratedImagesFluxBlob: mutate('sd'), setGeneratedImagesFluxBlobHd: mutate('hd'), setGeneratedImagesFlux: mutate('previews'), setImagesHdCloud: mutate('cloud'), setDummyImageUrls: mutate('dummy'),
        GenerateSignedUrlForSingleImage: async blob => ({ urlHD: `https://storage.test/${state.stored.length}-${blob.size}` }),
        PutSingleImageInS3WithURL: async (blob, signed) => { state.stored.push(blob); if (state.failStorage) throw Error('Storage unavailable'); return signed.urlHD; }, Saveprompthelperfordellater() {},
        setisLoading: value => { state.loading = value; }, setLoadData() {}, setdbLoad() {}, setHideSave() {}, setDraftSaveNotice() {}, setNanoImages() {},
        creationDraft: undefined, draftSeed: {}, persistedPlanMediaRef: { current: [] }, safetyImageSetsByTarget: {}, safetyVideoSetsByTarget: {},
        safetySceneSourceUrl: value => value, safetyPlanMediaEntries: () => [], collectAllSafetyUrls: () => ({ audios: [] }),
        ProtectSavedMediaFromDeleteLater() {}, TextVideo: [], referenceVideoUrls: [], bShotReferenceVideoUrls: [], autoDrawGuideData: [], bShotAutoDrawGuideData: [],
        GeneratedImage: [], referenceImages: [], Vipcharacters: [], bShotImages: [], bShotVideos: [], bShotNanoImages: [], bShotPrompts: [], bShotTextVideo: [],
        buildPlanKontextPayload: inputs => { state.kontextInputs = inputs; return inputs; }, getPlanKontextCleanupUrls: () => ({ images: [], videos: [] }), serializePlanKontextPayload: JSON.stringify,
        PostId: 4, creationProjectId: 'project-1', loggedUser: { id: 3 }, type: 2, prompt: 'Story', modelz: 'Schnell', ratioKey: 1, steps: live.steps, GeneratedText: live.steps, intentBlueprintRef: { current: null },
        CLIK_URL: 'http://fixture', axios: { post: async (_url, payload) => { const request = deferred(); state.db.push({ ...request, payload }); return request.promise; } },
        setStopText() {}, setPostId() {}, lastSavedImagesRef: { current: null }, pendingSavedImagesRef: { current: null }, setSavedSceneImages() {}, RemoveFromDeleteLater() {}, RemoveVideoFromDeleteLater() {},
        VideoArrayCloud: [], VideoArray: [], StartPlan: () => { state.planCalls++; }, Planx: {}, steps2: [], setVideMode: value => { state.videoMode = value; }, setnarrate() {}, activeEdit: 0,
        globalErrorEmitter: { emit: message => state.errors.push(message) }, console: { log() {}, error() {} },
        localStorage: { removeItem() {} },
        generatedImagesFluxBlob: state.sd, generatedImagesFluxBlobHd: state.hd, generatedImagesFlux: state.previews, ImagesHdCloud: state.cloud,
        setDone: value => { state.ready = value; },
        startLoader: () => { state.generating = true; },
        revokeUnusedOwnedObjectUrl: (url, owners) => media.revokeUnusedOwnedObjectUrl(url, owners, value => state.revoked.push(value)),
    };
    bindings.setGeneratedImage = update => { const next = update(bindings.GeneratedImage); bindings.GeneratedImage.splice(0, bindings.GeneratedImage.length, ...next); };
    bindings.setReferenceImages = update => { const next = update(bindings.referenceImages); bindings.referenceImages.splice(0, bindings.referenceImages.length, ...next); };
    for (const name of ['storeImageBinary', 'releaseStoredImageSources', 'onImageMediaStored', 'prepareImageSaveContext', 'saveToDastabase', 'uploadAllImagesToS3Default']) bindings[name] = bind(callback(name), bindings);
    bindings.isSceneImageFinal = index => bind(callback('isSceneImageFinal'), {
        ...bindings, generatedImagesFluxBlob: state.sd, generatedImagesFluxBlobHd: state.hd,
        generatedImagesFlux: state.previews, ImagesHdCloud: state.cloud, nanoImages: [],
    })(index);
    const releaseUrls = () => bind(effect('if (revokeUnusedOwnedObjectUrl(url, imageLifecycleLiveRef.current.liveSources))'), { ...bindings, generatedImagesFluxBlob: state.sd, generatedImagesFluxBlobHd: state.hd, generatedImagesFlux: state.previews, steps: live.steps })();
    return { state, live, bindings, releaseUrls, prepare: bindings.prepareImageSaveContext, save: context => bindings.saveToDastabase(context.receipts.map(receipt => receipt.sdUrl), context.receipts.map(receipt => receipt.hdUrl), context) };
}

test('exact Blob upload ownership dedupes in-flight/retry success and a failed upload remains retryable', async () => {
    const owner = new media.StoredBinaryUploads(), blob = new Blob(['same bytes']), wait = deferred(); let uploads = 0;
    const upload = () => { uploads++; return wait.promise; };
    const first = owner.run(blob, upload); assert.equal(owner.run(blob, upload), first); await flush(); assert.equal(uploads, 1);
    wait.resolve('https://storage.test/saved'); await first; assert.equal(await owner.run(blob, upload), 'https://storage.test/saved'); assert.equal(uploads, 1);
    const other = new Blob(['same bytes']); await owner.run(other, async () => { uploads++; return 'https://storage.test/another-version'; }); assert.equal(uploads, 2);
    const failed = new Blob(['retry']); await assert.rejects(owner.run(failed, async () => { throw Error('storage failed'); }));
    assert.equal(await owner.run(failed, async () => 'https://storage.test/recovered'), 'https://storage.test/recovered');
});

test('18 actual Storybook scenes release exact stored SD/HD before DB; DB retry uses URL receipts without upload', async () => {
    const f = fixture(), originals = [...f.state.sd, ...f.state.hd], context = await f.prepare();
    assert.equal(new Set(originals).size, 36); assert.equal(f.state.stored.length, 36);
    assert.ok(context.receipts.every(receipt => receipt.sdUrl !== receipt.hdUrl));
    const failed = f.save(context); const failureAssertion = assert.rejects(failed, /DB failed/);
    f.releaseUrls();
    assert.equal(f.state.sd.filter(Boolean).length, 0); assert.equal(f.state.hd.filter(Boolean).length, 0); assert.equal(f.state.revoked.length, 18);
    assert.ok(context.receipts.every(receipt => !receipt.sdBlob && !receipt.hdBlob && !receipt.persisted));
    f.state.db[0].reject(Error('DB failed')); await failureAssertion;
    const retry = await f.prepare(); assert.equal(f.state.stored.length, 36);
    const done = f.save(retry); assert.equal(f.state.videoMode, false); f.state.db[1].resolve({ data: { go: 4 } }); await done; f.releaseUrls();
    assert.ok(f.state.sd.every(value => value === null)); assert.ok(f.state.hd.every(value => value === null));
    assert.ok(f.state.previews.every(media.isHttpMediaUrl)); assert.ok(f.state.cloud.every(media.isHttpMediaUrl));
    assert.equal(f.state.revoked.length, 18); assert.equal(f.state.videoMode, true); assert.equal(f.state.planCalls, 1);
    assert.ok(Object.values(f.bindings.imageMediaReceiptsRef.current).every(receipt => !receipt.sdBlob && !receipt.hdBlob && receipt.persisted));
    assert.deepEqual(f.state.db[1].payload.values.image1, retry.receipts[0].sdUrl); assert.deepEqual(f.state.db[1].payload.values.imageHd1, retry.receipts[0].hdUrl);
});

test('a deferred DB completion never clears a new result or navigates with changed scene versions', async () => {
    const f = fixture(1), context = await f.prepare(), pending = f.save(context);
    const newSD = new Blob(['new manual file']), newHD = new Blob(['new manual HD']);
    f.bindings.setGeneratedImagesFluxBlob([newSD]); f.bindings.setGeneratedImagesFluxBlobHd([newHD]); f.bindings.setGeneratedImagesFlux(['blob:new-version']); f.bindings.setImagesHdCloud(['https://storage.test/new-hd']);
    f.state.db[0].resolve({ data: { go: 4 } }); await pending; f.releaseUrls();
    assert.equal(f.state.sd[0], newSD); assert.equal(f.state.hd[0], newHD); assert.equal(f.state.previews[0], 'blob:new-version'); assert.equal(f.state.cloud[0], 'https://storage.test/new-hd');
    assert.equal(f.state.videoMode, false); assert.equal(f.state.planCalls, 0); assert.deepEqual(f.state.revoked, ['blob:scene-0']);
});

test('a changed A layout rejects old prepared saves before any DB write; B-only rebuild does not invalidate A media', async () => {
    const f = fixture(1), context = await f.prepare(); f.live.aTopology += 1;
    await assert.rejects(f.bindings.uploadAllImagesToS3Default(context.receipts.map(receipt => receipt.hdUrl), context), /image changed|scene layout/i); assert.equal(f.state.db.length, 0);
    assert.equal(f.state.sd[0], null);
    f.live.aTopology = context.aTopology; const pending = f.save(context); f.state.db[0].resolve({ data: { go: 4 } }); await pending; assert.equal(f.state.sd[0], null);
});

test('readiness remains true for URL-only saved scenes without resurrecting Blob ownership', async () => {
    const f = fixture(2), context = await f.prepare(), pending = f.save(context); f.state.db[0].resolve({ data: { go: 4 } }); await pending;
    bind(effect('const allImagesReady ='), { ...f.bindings, generatedImagesFluxBlob: f.state.sd, generatedImagesFlux: f.state.previews, ImagesHdCloud: f.state.cloud, steps: f.live.steps })();
    assert.equal(f.state.ready, true); const receipts = await f.prepare(); assert.equal(f.state.stored.length, 4); assert.ok(receipts.receipts.every(receipt => !receipt.sdBlob && !receipt.hdBlob));
});

test('single-scene Continue passes exact stored URLs and waits for DB while completed files are already released', async () => {
    const f = fixture(1);
    const run = bind(callback('continueSingleImage'), f.bindings);
    const pending = run(); await flush(); assert.equal(f.state.videoMode, false); assert.equal(f.state.sd[0], null);
    assert.equal(f.state.db[0].payload.values.imagehd, f.bindings.imageMediaReceiptsRef.current['A:0'].hdUrl);
    f.state.db[0].resolve({ data: { go: 4 } }); await pending; f.releaseUrls(); assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null); assert.equal(f.state.videoMode, true);
    const failed = fixture(1); await bind(callback('continueSingleImage'), { ...failed.bindings, axios: { post: async () => { throw Error('Save unavailable'); } } })();
    assert.equal(failed.state.sd[0], null); assert.equal(failed.state.videoMode, false); assert.equal(failed.state.errors.length, 1);
    assert.ok(media.isHttpMediaUrl(failed.bindings.imageMediaReceiptsRef.current['A:0'].hdUrl));
});

test('owned object URL is revoked only when no preview, reference or dummy card still uses it', () => {
    const revoked = []; assert.equal(media.revokeUnusedOwnedObjectUrl('blob:shared', ['blob:shared'], url => revoked.push(url)), false);
    assert.equal(media.revokeUnusedOwnedObjectUrl('blob:shared', ['https://storage.test/result'], url => revoked.push(url)), true); assert.deepEqual(revoked, ['blob:shared']);
    assert.equal(media.revokeUnusedOwnedObjectUrl('https://storage.test/result', [], url => revoked.push(url)), false);
});

test('actual unified media setter clears nested B binary without clearing A or another B result', () => {
    const a = new Blob(['A']), b0 = new Blob(['B zero']), b1 = new Blob(['B one']); let aFiles = [a], bFiles = [[b0, b1]];
    const state = { current: { map: [{ type: 'A', index: 0 }, { type: 'B', index: 0, bIndex: 0 }, { type: 'B', index: 0, bIndex: 1 }], VideoArrayBlob: [a, b0, b1] } };
    const setter = bind(callback('createUnifiedSetter'), { unifiedStateRef: state, cleanQuotedAtMentions: value => value, console: { log() {} } })('VideoArrayBlob', value => { aFiles = value(aFiles); }, value => { bFiles = value(bFiles); });
    setter(previous => media.replaceMatchingMediaEntry(previous, 2, b1, null)); assert.equal(aFiles[0], a); assert.equal(bFiles[0][0], b0); assert.equal(bFiles[0][1], null);
    setter(previous => media.replaceMatchingMediaEntry(previous, 1, new Blob(['stale different file']), null)); assert.equal(bFiles[0][0], b0);
});

test('actual cached Nano path stores one exact binary, retains storage failure and retries without another provider request', async () => {
    const f = fixture(1), nano = new Blob(['paid nano bytes']); let downloads = 0, finished = 0;
    f.bindings.setGeneratedImagesFluxBlob([null]); f.bindings.setGeneratedImagesFluxBlobHd([null]); f.bindings.setGeneratedImagesFlux(['']); f.bindings.setImagesHdCloud(['']); f.state.failStorage = true;
    const bindings = { ...f.bindings, imageGenerationClaimsRef: { current: {} }, retainedInitialImageResultsRef: { current: [] },
        fetchAndGenerateImage: async () => 'Authored shot prompt', CreationMode: 'Video', modelz: 'Schnell',
        nanoImagesRef: { current: ['https://provider.test/paid-nano'] }, STORYBOOK_LINK_MODE: true, timeoutsDisabledRef: { current: false },
        fetch: async () => { downloads++; return { ok: true, blob: async () => nano }; }, finishLoader: () => { finished++; }, setContinue() {}, loggedUser: { id: 3 } };
    await bind(callback('handleSubmitFluxImageNew'), bindings)([], '', bindings.loggedUser, 0, '');
    assert.equal(downloads, 1); assert.equal(f.state.sd[0], nano); assert.equal(f.state.hd[0], nano); assert.equal(f.state.videoMode, false); assert.equal(f.state.stored.length, 1); assert.equal(finished, 1);
    f.state.failStorage = false; const context = await f.prepare(); assert.equal(f.state.stored.length, 2); assert.equal(downloads, 1);
    assert.equal(context.receipts[0].sdUrl, context.receipts[0].hdUrl);
    const saved = f.save(context); f.state.db[0].resolve({ data: { go: 4 } }); await saved;
    assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null); assert.equal(f.state.dummy[0], context.receipts[0].sdUrl);
});

test('stored storyboard previews allow Continue into Video while optional full-image Auto remains pending', async () => {
    const readiness = load('src/sceneImageReadiness.ts'), f = fixture(1), nano = new Blob(['paid Nano preview']);
    f.bindings.setGeneratedImagesFluxBlob([null]); f.bindings.setGeneratedImagesFluxBlobHd([null]);
    f.bindings.setGeneratedImagesFlux(['']); f.bindings.setImagesHdCloud(['']);
    await bind(callback('handleSubmitFluxImageNew'), {
        ...f.bindings, imageGenerationClaimsRef: { current: {} },
        fetchAndGenerateImage: async () => 'Authored shot prompt', CreationMode: 'Video', modelz: 'Schnell',
        nanoImagesRef: { current: ['https://provider.test/paid-nano'] }, STORYBOOK_LINK_MODE: true,
        timeoutsDisabledRef: { current: false }, fetch: async () => ({ ok: true, blob: async () => nano }),
        finishLoader() {}, setContinue() {}, loggedUser: { id: 3 },
    })([], '', { id: 3 }, 0, '');
    const needsImage = () => bind(callback('isUnifiedSlotEmpty'), {
        ...f.bindings, ...readiness, unifiedIndexMap: [{ type: 'A', index: 0 }], unifiedImagesHdCloud: f.state.cloud,
        unifiedGeneratedImagesFlux: f.state.previews, unifiedNanoImages: ['https://provider.test/paid-nano'], dummyImageUrls: f.state.dummy,
    })(0);
    const original = f.state.previews[0];
    assert.ok(media.isHttpMediaUrl(original)); assert.equal(f.state.cloud[0], original);
    assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null);
    assert.equal(needsImage(), true, 'storing preview bytes must not hide Auto');
    bind(effect('const allImagesReady ='), { ...f.bindings, generatedImagesFluxBlob: f.state.sd, generatedImagesFlux: f.state.previews, ImagesHdCloud: f.state.cloud })();
    assert.equal(f.state.ready, true, 'storyboard previews must allow Continue without optional full image generation');
    const context = await f.prepare(), continuing = f.save(context);
    f.state.db[0].resolve({ data: { go: 4 } }); await continuing;
    assert.equal(f.state.videoMode, true, 'Continue saves the preview storyboard and opens Video mode');
    assert.equal(f.state.previews[0], original);
    assert.equal(needsImage(), true, 'entering Video does not falsely mark previews as completed full images');

    f.bindings.GeneratedImage.push(original);
    f.bindings.referenceImages.push({ name: '@PreviewReference', imageUrl: original });
    const sd = new Blob(['completed SD']), hd = new Blob(['completed HD']);
    f.bindings.setGeneratedImagesFluxBlob([sd]); f.bindings.setGeneratedImagesFluxBlobHd([hd]);
    f.bindings.setGeneratedImagesFlux(['blob:full-replacement']);
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, {
        sdBlob: sd, hdBlob: hd, previewUrl: 'blob:full-replacement', sdUrl: 'https://storage.test/final-sd', hdUrl: 'https://storage.test/final-hd',
    });
    assert.equal(needsImage(), false); assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null);
    bind(effect('const allImagesReady ='), { ...f.bindings, generatedImagesFluxBlob: f.state.sd, generatedImagesFlux: f.state.previews, ImagesHdCloud: f.state.cloud })();
    assert.equal(f.state.ready, true, 'completed URL replacement enables Continue');
    assert.equal(f.bindings.referenceImages[0].imageUrl, original);
    assert.equal(f.bindings.GeneratedImage[0], original); assert.equal(f.state.dummy[0], original);
});

test('initial generation stays busy through delayed preparation and storage and retains a paid result on conversion failure', async () => {
    for (const failConversion of [false, true]) {
        const f = fixture(1), fetched = deferred(), scheduled = [];
        f.bindings.setGeneratedImagesFluxBlob([null]); f.bindings.setGeneratedImagesFluxBlobHd([null]);
        f.bindings.setGeneratedImagesFlux(['']); f.bindings.setImagesHdCloud(['']);
        let providerCalls = 0;
        const bindings = { ...f.bindings, imageGenerationClaimsRef: { current: {} },
            fetchAndGenerateImage: async () => 'A full scene', CreationMode: 'Image', modelz: 'GptImage',
            nanoImagesRef: { current: [] }, STORYBOOK_LINK_MODE: true, timeoutsDisabledRef: { current: false },
            Seed: 42, sceneActiveCharacters: [], sceneActiveCharactersVideo: [], getGptImageRoute: () => 'gptimage',
            cleanQuotedAtMentions: value => value, setPollStatus() {},
            axios: { post: async () => { providerCalls++; return { status: 200, data: 'result' }; } },
            resolveStorybookGeneratedImage: async () => 'https://storage.test/provider-result',
            timeoutRefsxp: { current: {} }, setTimeout: callback => { scheduled.push(callback); return 1; }, clearTimeout() {},
            fetch: async () => fetched.promise,
            convertToHDWebpOrJpegByDevice: async value => { if (failConversion) throw Error('conversion failed'); return value; },
            convertToHDWebpOrJpegByDeviceHd: async () => new Blob(['full HD']),
            finishLoader: () => { f.state.generating = false; }, setContinue() {}, setS3ResultUrl() {},
            LOCAL_STORAGE_KEY: 'fixture', localStorage: { setItem() {} },
        };
        await bind(callback('handleSubmitFluxImageNew'), bindings)([], '', { id: 3 }, 0, '');
        assert.equal(providerCalls, 1); assert.equal(f.state.generating, true, 'provider receipt is not the end of preparation');
        const preparation = scheduled.shift()(); await flush();
        assert.equal(f.state.generating, true, 'download/conversion/storage still own the active loader');
        fetched.resolve({ ok: true, blob: async () => new Blob(['full SD']) }); await preparation;
        assert.equal(f.state.generating, false); assert.equal(providerCalls, 1);
        assert.equal(f.bindings.isSceneImageFinal(0), true, 'received full result remains available even if conversion failed');
        if (failConversion) assert.equal(f.state.previews[0], 'https://storage.test/provider-result');
        else { assert.equal(f.state.stored.length, 2); assert.equal(f.state.sd[0], null); }
    }
});

test('nine 18-scene replacements before Continue leave zero completed raw bytes, and DB failure retry adds no S3 transfer', async t => {
    const f = fixture(18), measurements = [];
    const ownedBytes = () => [...new Set([...f.state.sd, ...f.state.hd].filter(value => value instanceof Blob))].reduce((bytes, blob) => bytes + blob.size, 0);
    let context;
    for (let cycle = 0; cycle < 9; cycle++) {
        if (cycle) {
            const sd = Array.from({ length: 18 }, (_, index) => new Blob([`cycle-${cycle}-sd-${index}`]));
            const hd = Array.from({ length: 18 }, (_, index) => new Blob([`cycle-${cycle}-hd-${index}-larger`]));
            const previews = sd.map((_, index) => `blob:cycle-${cycle}-${index}`);
            f.bindings.setGeneratedImagesFluxBlob(sd); f.bindings.setGeneratedImagesFluxBlobHd(hd); f.bindings.setGeneratedImagesFlux(previews);
            previews.forEach(url => f.bindings.ownedImageObjectUrlsRef.current.add(url));
        }
        const processingBytes = ownedBytes(); assert.ok(processingBytes > 0);
        context = await f.prepare(); f.releaseUrls();
        assert.equal(f.state.db.length, 0);
        const completedBytes = ownedBytes(); measurements.push({ cycle, processingBytes, completedBytes }); assert.equal(completedBytes, 0);
        assert.equal(f.bindings.ownedImageObjectUrlsRef.current.size, 0); assert.equal(f.bindings.releasableImageObjectUrlsRef.current.size, 0);
        assert.equal(f.bindings.imageDownloadedInputsRef.current.size, 0); assert.ok(Object.values(f.bindings.imageMediaReceiptsRef.current).every(receipt => !receipt.sdBlob && !receipt.hdBlob));
    }
    assert.equal(f.state.revoked.length, 162); assert.equal(f.state.stored.length, 324); assert.equal(measurements.length, 9);
    const failed = f.save(context), rejected = assert.rejects(failed, /offline/); f.state.db[0].reject(Error('offline')); await rejected;
    const retry = await f.prepare(); assert.equal(f.state.stored.length, 324);
    const saved = f.save(retry); f.state.db[1].resolve({ data: { go: 4 } }); await saved;
    t.diagnostic(`Synthetic scene-owned Blob bytes: ${JSON.stringify(measurements)}; this measures reachable scene owners, not browser RAM.`);
});

test('B canonical image persistence strips binary receipt owners without touching native A raw files', () => {
    const f = fixture(1), a = f.state.sd[0], sd = new Blob(['B SD']), hd = new Blob(['B HD']);
    f.bindings.onImageMediaStored({ type: 'B', index: 0, bIndex: 1 }, { sdBlob: sd, hdBlob: hd, previewUrl: 'blob:b-preview', sdUrl: 'https://storage.test/b-sd', hdUrl: 'https://storage.test/b-hd', persisted: false });
    assert.equal(f.state.sd[0], a); assert.equal(f.bindings.imageMediaReceiptsRef.current['B:0:1'].sdBlob, undefined); assert.equal(f.bindings.imageMediaReceiptsRef.current['B:0:1'].hdBlob, undefined);
    assert.equal(f.bindings.imageMediaReceiptsRef.current['B:0:1'].sdUrl, 'https://storage.test/b-sd'); assert.equal(f.bindings.imageMediaReceiptsRef.current['B:0:1'].hdUrl, 'https://storage.test/b-hd');
});

test('a selected frozen scene reference is persisted and migrated to the exact SD cloud version before its preview URL ends', async () => {
    const f = fixture(1); f.bindings.GeneratedImage.push('blob:scene-0'); f.bindings.referenceImages.push({ name: '@Selected', imageUrl: 'blob:scene-0', description: 'Frozen reference' });
    const context = await f.prepare(), pending = f.save(context);
    assert.equal(f.state.kontextInputs.coverUrl, context.receipts[0].sdUrl); assert.equal(f.state.kontextInputs.referenceImages[0].imageUrl, context.receipts[0].sdUrl);
    f.state.db[0].resolve({ data: { go: 4 } }); await pending; f.releaseUrls();
    assert.deepEqual(f.bindings.GeneratedImage, [context.receipts[0].sdUrl]); assert.equal(f.bindings.referenceImages[0].imageUrl, context.receipts[0].sdUrl); assert.equal(f.bindings.referenceImages[0].description, 'Frozen reference');
    assert.deepEqual(f.state.revoked, ['blob:scene-0']);
});

test('an original frozen Blob alias migrates even when EditStory has already adopted the cloud SD preview', async () => {
    const f = fixture(1); f.bindings.GeneratedImage.push('blob:scene-0'); f.bindings.referenceImages.push({ name: '@Frozen', imageUrl: 'blob:scene-0' });
    const context = await f.prepare(); f.bindings.setGeneratedImagesFlux([context.receipts[0].sdUrl]); f.bindings.setImagesHdCloud([context.receipts[0].hdUrl]);
    const pending = f.save(context); assert.equal(f.state.kontextInputs.coverUrl, context.receipts[0].sdUrl);
    f.state.db[0].resolve({ data: { go: 4 } }); await pending; f.releaseUrls();
    assert.deepEqual(f.bindings.GeneratedImage, [context.receipts[0].sdUrl]); assert.equal(f.bindings.referenceImages[0].imageUrl, context.receipts[0].sdUrl);
    assert.deepEqual(f.state.revoked, ['blob:scene-0']); assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null);
});

test('replacing a stored initial image before Continue releases its original unused preview', async () => {
    const f = fixture(1), oldPreview = f.state.previews[0], original = await f.prepare();
    const sd = new Blob(['replacement SD']), hd = new Blob(['replacement HD']);
    f.bindings.setGeneratedImagesFluxBlob([sd]); f.bindings.setGeneratedImagesFluxBlobHd([hd]);
    f.bindings.setGeneratedImagesFlux(['https://storage.test/replacement-sd']); f.bindings.setImagesHdCloud(['https://storage.test/replacement-hd']);
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, { sdBlob: sd, hdBlob: hd, previewUrl: 'blob:replacement', sdUrl: f.state.previews[0], hdUrl: f.state.cloud[0] });
    const context = await f.prepare(), saving = f.save(context); f.state.db[0].resolve({ data: { go: 4 } }); await saving; f.releaseUrls();
    assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null);
    assert.deepEqual(f.state.revoked, [oldPreview]); assert.equal(f.bindings.ownedImageObjectUrlsRef.current.has(oldPreview), false);
    assert.equal(f.bindings.releasableImageObjectUrlsRef.current.size, 0);
    assert.notEqual(f.state.previews[0], original.receipts[0].sdUrl);
});

test('replacement preserves frozen references to the original stored bytes and waits for remaining URL owners', async () => {
    const f = fixture(1), oldPreview = f.state.previews[0], original = await f.prepare();
    f.bindings.GeneratedImage.push(oldPreview); f.bindings.referenceImages.push({ name: '@Original', imageUrl: oldPreview, description: 'Keep original' });
    f.bindings.setDummyImageUrls({ 0: oldPreview });
    // Simulate one remaining mounted consumer during the state transition.
    f.bindings.setGeneratedImagesFlux(['https://storage.test/new-sd']); f.live.liveSources.push(oldPreview);
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, { previewUrl: 'blob:new', sdUrl: 'https://storage.test/new-sd', hdUrl: 'https://storage.test/new-hd' });
    assert.deepEqual(f.bindings.GeneratedImage, [original.receipts[0].sdUrl]);
    assert.equal(f.bindings.referenceImages[0].imageUrl, original.receipts[0].sdUrl);
    assert.equal(f.bindings.referenceImages[0].description, 'Keep original'); assert.equal(f.state.dummy[0], original.receipts[0].sdUrl);
    f.live.liveSources.push(oldPreview); f.releaseUrls(); assert.deepEqual(f.state.revoked, []);
    f.live.liveSources = [...f.state.previews, ...Object.values(f.state.dummy), ...f.bindings.GeneratedImage, ...f.bindings.referenceImages.map(reference => reference.imageUrl)];
    f.releaseUrls(); f.releaseUrls(); assert.deepEqual(f.state.revoked, [oldPreview]);
});

test('draft cleanup releases queued superseded previews while retaining current and unstored previews', async () => {
    const f = fixture(1), oldPreview = f.state.previews[0]; await f.prepare();
    f.bindings.setGeneratedImagesFlux(['blob:unsaved-current']); f.bindings.ownedImageObjectUrlsRef.current.add('blob:unsaved-current');
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, { previewUrl: 'blob:new-stored', sdUrl: 'https://storage.test/new-sd', hdUrl: 'https://storage.test/new-hd' });
    const cleanup = bind(effect('for (const url of releasableImageObjectUrlsRef.current) revokeUnusedOwnedObjectUrl'), f.bindings)();
    cleanup(); assert.deepEqual(f.state.revoked, [oldPreview]);
    assert.equal(f.bindings.ownedImageObjectUrlsRef.current.has('blob:unsaved-current'), true);
    assert.equal(f.state.sd[0], null);
});

test('storage receipt synchronizes live URL sources before deferred React setters, so immediate Continue adds no transfer', async () => {
    const f = fixture(1), sd = f.state.sd[0], hd = f.state.hd[0], queued = [];
    for (const name of ['setGeneratedImagesFluxBlob', 'setGeneratedImagesFluxBlobHd', 'setGeneratedImagesFlux', 'setImagesHdCloud', 'setDummyImageUrls']) {
        const commit = f.bindings[name]; f.bindings[name] = update => queued.push(() => commit(update));
    }
    f.bindings.releaseStoredImageSources = bind(callback('releaseStoredImageSources'), f.bindings);
    f.bindings.onImageMediaStored = bind(callback('onImageMediaStored'), f.bindings);
    const stored = { sdBlob: sd, hdBlob: hd, previewUrl: 'blob:scene-0', sdUrl: 'https://storage.test/exact-sd', hdUrl: 'https://storage.test/exact-hd', persisted: false };
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, stored);
    assert.equal(f.live.sd[0], null); assert.equal(f.live.hd[0], null);
    const context = await bind(callback('prepareImageSaveContext'), f.bindings)();
    assert.deepEqual(context.receipts, [{ sdUrl: stored.sdUrl, hdUrl: stored.hdUrl, previewUrl: stored.sdUrl, persisted: false }]);
    assert.equal(f.state.stored.length, 0); assert.equal(f.state.sd[0], sd);
    queued.forEach(commit => commit()); assert.equal(f.state.sd[0], null); assert.equal(f.state.hd[0], null);
    f.releaseUrls(); assert.deepEqual(f.state.revoked, ['blob:scene-0']);
});

test('both required image variants must store before callback releases a file; superseded stored result retains URLs only', () => {
    const f = fixture(1), sd = f.state.sd[0], hd = f.state.hd[0];
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, { sdBlob: sd, hdBlob: hd, previewUrl: 'blob:scene-0', sdUrl: 'https://storage.test/sd', hdUrl: '' });
    assert.equal(f.state.sd[0], sd); assert.equal(f.state.hd[0], hd); assert.equal(f.bindings.releasableImageObjectUrlsRef.current.size, 0);
    const newer = new Blob(['new processing']); f.bindings.setGeneratedImagesFluxBlob([newer]); f.bindings.setGeneratedImagesFlux(['blob:new']);
    f.bindings.onImageMediaStored({ type: 'A', index: 0 }, { sdBlob: sd, hdBlob: hd, previewUrl: 'blob:scene-0', sdUrl: 'https://storage.test/sd', hdUrl: 'https://storage.test/hd' });
    assert.equal(f.state.sd[0], newer); assert.deepEqual(f.bindings.retainedInitialImageResultsRef.current, [{ sdUrl: 'https://storage.test/sd', hdUrl: 'https://storage.test/hd' }]);
});

test('close captures an existing preview and an empty scene without generating or promoting the preview', async () => {
    const f = fixture(3), preview = 'https://provider.test/nano-scene-2';
    f.bindings.setGeneratedImagesFluxBlob([f.state.sd[0], null, null]);
    f.bindings.setGeneratedImagesFluxBlobHd([f.state.hd[0], null, null]);
    f.bindings.setGeneratedImagesFlux([f.state.previews[0], '', '']);
    f.live.nanoPreviews = ['', preview, ''];
    let downloads = 0;
    f.bindings.fetch = async url => { assert.equal(url, preview); downloads++; return { ok: true, blob: async () => new Blob(['actual preview bytes']) }; };
    const prepare = bind(callback('prepareImageSaveContext'), f.bindings);
    await assert.rejects(prepare(), /no recoverable SD\/HD image pair/);
    const context = await prepare({ allowIncomplete: true });
    assert.equal(context.receipts.length, 3);
    assert.equal(context.receipts[2], null, 'missing media keeps its original scene position');
    assert.equal(context.receipts[1].quality, 'preview');
    assert.equal(f.bindings.imageProvenanceRef.current.quality(context.receipts[1].sdUrl), 'preview');
    assert.equal(context.receipts[1].sdUrl, context.receipts[1].hdUrl, 'the preview stores one actual binary');
    assert.equal(downloads, 1);
    assert.equal(f.state.stored.length, 3, 'two full variants plus one existing preview');
    const pending = f.bindings.saveToDastabase(context.receipts.map(receipt => receipt?.sdUrl || ''),
        context.receipts.map(receipt => receipt?.hdUrl || ''), context, { advanceToVideo: false, showSaveNotice: false });
    assert.equal(f.state.db[0].payload.values.image3, null);
    assert.equal(f.state.db[0].payload.values.imageHd3, null);
    f.state.db[0].resolve({ data: { go: 4 } });
    await pending;
    assert.equal(f.state.videoMode, false);
    assert.equal(f.state.planCalls, 0);
});

test('close checkpoint keeps preview quality in its resumable snapshot and clears missing A-slot receipts', async () => {
    const f = fixture(2), wait = deferred(), sections = { storybook: { imageReceipts: { 'A:1': { quality: 'final', sdUrl: 'https://old.test/sd', hdUrl: 'https://old.test/hd' } } } };
    f.bindings.setGeneratedImagesFluxBlob([null, null]); f.bindings.setGeneratedImagesFluxBlobHd([null, null]);
    f.bindings.setGeneratedImagesFlux(['', '']);
    f.live.nanoPreviews = ['https://provider.test/nano', ''];
    let request;
    const draftState = { revision: 0, saved: false, isSaving: false };
    f.bindings.creationDraft = {
        section: name => sections[name] || {}, getState: () => draftState,
        checkpoint: (action, projection) => {
            request = { action, projection, sections: structuredClone(sections) };
            return wait.promise.then(() => { draftState.saved = true; return { postId: 4, revision: 1 }; });
        },
    };
    f.bindings.captureCreationCache = (_draft, name, patch) => { sections[name] = { ...(sections[name] || {}), ...patch }; };
    f.bindings.GeneratedTextx = f.live.steps;
    f.bindings.stableDraftJson = JSON.stringify;
    f.bindings.fetch = async () => ({ ok: true, blob: async () => new Blob(['preview']) });
    for (const name of ['onImageMediaStored', 'prepareImageSaveContext', 'saveToDastabase']) f.bindings[name] = bind(callback(name), f.bindings);
    const context = await f.bindings.prepareImageSaveContext({ allowIncomplete: true });
    const pending = f.bindings.saveToDastabase(context.receipts.map(receipt => receipt?.sdUrl || ''),
        context.receipts.map(receipt => receipt?.hdUrl || ''), context, { advanceToVideo: false, showSaveNotice: false });
    assert.equal(request.action, 'images');
    assert.equal(request.sections.storybook.imageReceipts['A:0'].quality, 'preview');
    assert.equal(request.sections.storybook.imageReceipts['A:1'], null);
    assert.equal(request.projection.image2, null);
    assert.equal(draftState.saved, false);
    wait.resolve(); await pending;
    assert.equal(f.state.videoMode, false);
    assert.equal(f.state.planCalls, 0);
});

test('late preview replacement is retained while an older close download finishes', async () => {
    const f = fixture(1), download = deferred(), original = 'https://provider.test/old-preview', replacement = 'https://provider.test/new-preview';
    f.bindings.setGeneratedImagesFluxBlob([null]); f.bindings.setGeneratedImagesFluxBlobHd([null]);
    f.bindings.setGeneratedImagesFlux(['']); f.live.nanoPreviews = [original];
    f.bindings.fetch = async () => download.promise;
    const pending = bind(callback('prepareImageSaveContext'), f.bindings)({ allowIncomplete: true });
    f.live.nanoPreviews = [replacement];
    download.resolve({ ok: true, blob: async () => new Blob(['older preview']) });
    const context = await pending;
    await assert.rejects(f.bindings.saveToDastabase(context.receipts.map(receipt => receipt?.sdUrl || ''),
        context.receipts.map(receipt => receipt?.hdUrl || ''), context, { advanceToVideo: false }), /image changed while preparing the draft/);
    assert.equal(f.live.nanoPreviews[0], replacement);
    assert.equal(f.state.db.length, 0);
    assert.equal(f.state.videoMode, false);
});

test('a new preview during the close checkpoint keeps exit unconfirmed until its version is saved', async () => {
    const f = fixture(1), original = 'https://provider.test/selected-preview', replacement = 'https://provider.test/late-preview';
    f.bindings.setGeneratedImagesFluxBlob([null]); f.bindings.setGeneratedImagesFluxBlobHd([null]);
    f.bindings.setGeneratedImagesFlux(['']); f.live.nanoPreviews = [original];
    f.bindings.fetch = async () => ({ ok: true, blob: async () => new Blob(['selected preview']) });
    const context = await bind(callback('prepareImageSaveContext'), f.bindings)({ allowIncomplete: true });
    const pending = f.bindings.saveToDastabase(context.receipts.map(receipt => receipt?.sdUrl || ''),
        context.receipts.map(receipt => receipt?.hdUrl || ''), context, { advanceToVideo: false });
    const rejected = assert.rejects(pending, /newer image is ready/);
    f.live.nanoPreviews = [replacement];
    f.state.db[0].resolve({ data: { go: 4 } });
    await rejected;
    assert.equal(f.live.nanoPreviews[0], replacement);
    assert.equal(f.state.videoMode, false);
});

for (const initialPostId of [0, 81]) test(`${initialPostId ? 'resumed' : 'fresh'} saved images move to Video seven times without save work or loading feedback`, async () => {
    const f = fixture(2), sections = {}, checkpoints = [], loading = [], notices = [], messages = [];
    const draftState = { postId: initialPostId || null, revision: 0, saved: false, isSaving: false, imageProjectionDigest: null };
    f.bindings.PostId = initialPostId;
    f.bindings.creationDraft = {
        section: name => sections[name] || {}, getState: () => draftState,
        checkpoint: async (action, projection) => {
            checkpoints.push({ action, projection, sections: structuredClone(sections) });
            draftState.postId = 81;
            draftState.revision++;
            draftState.imageProjectionDigest = JSON.stringify(projection);
            draftState.saved = true;
            return { postId: 81, revision: draftState.revision };
        },
    };
    f.bindings.captureCreationCache = (_draft, name, patch) => { sections[name] = { ...(sections[name] || {}), ...patch }; };
    f.bindings.GeneratedTextx = f.live.steps;
    f.bindings.stableDraftJson = JSON.stringify;
    f.bindings.setisLoading = value => { loading.push(value); f.state.loading = value; };
    f.bindings.setLoadData = value => messages.push(value);
    f.bindings.setDraftSaveNotice = value => notices.push(value);
    f.bindings.setdbLoad = value => { f.state.dbLoad = value; };
    f.bindings.visitedVideoGridRef = { current: true };
    f.bindings.setManualOnlyVideoPrompts = () => {};
    for (const name of ['onImageMediaStored', 'prepareImageSaveContext', 'saveToDastabase', 'uploadAllImagesToS3Default']) f.bindings[name] = bind(callback(name), f.bindings);
    const first = await f.bindings.prepareImageSaveContext();
    await f.bindings.saveToDastabase(first.receipts.map(receipt => receipt.sdUrl), first.receipts.map(receipt => receipt.hdUrl), first);
    assert.equal(checkpoints.length, 1);
    assert.equal(f.state.stored.length, 4);
    f.bindings.PostId = 81;
    f.bindings.saveToDastabase = bind(callback('saveToDastabase'), f.bindings);
    f.bindings.uploadAllImagesToS3Default = bind(callback('uploadAllImagesToS3Default'), f.bindings);
    const continueImages = bind(callback('uploadAllImagesToS3'), f.bindings);
    loading.length = 0; notices.length = 0; messages.length = 0;
    for (let repeat = 0; repeat < 7; repeat++) {
        f.state.videoMode = false;
        await continueImages();
        assert.equal(f.state.videoMode, true);
        assert.equal(f.state.dbLoad, false);
    }
    assert.equal(checkpoints.length, 1, 'unchanged transitions never checkpoint again');
    assert.equal(f.state.stored.length, 4, 'unchanged transitions never store media again');
    assert.deepEqual(loading, [], 'unchanged transitions never set generic loading');
    assert.deepEqual(messages, [], 'unchanged transitions never announce Saving or Uploading');
    assert.ok(notices.every(value => value === null), 'unchanged transitions never announce draft save');

    f.bindings.prompt = 'A deliberately edited caption';
    const editedSave = bind(callback('saveToDastabase'), f.bindings);
    await editedSave(first.receipts.map(receipt => receipt.sdUrl), first.receipts.map(receipt => receipt.hdUrl), first);
    assert.equal(checkpoints.length, 2, 'a real projection edit still saves');
    assert.equal(checkpoints[1].projection.caption, 'A deliberately edited caption');
    assert.ok(loading.includes(true));
    assert.ok(messages.includes('Saving..'));
    draftState.saved = false;
    await editedSave(first.receipts.map(receipt => receipt.sdUrl), first.receipts.map(receipt => receipt.hdUrl), first);
    assert.equal(checkpoints.length, 3, 'dirty current snapshots still require confirmation');
});
