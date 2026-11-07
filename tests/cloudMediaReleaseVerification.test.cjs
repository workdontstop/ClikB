const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
const trees = new Map();
function tree(file) { if (!trees.has(file)) trees.set(file, ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)); return trees.get(file); }
function bind(code, bindings) { return Function(...Object.keys(bindings), ts.transpileModule(`return (${code});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings)); }
function callback(file, name, bindings) {
  const source = tree(file); let found; const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer; ts.forEachChild(node, visit); }; visit(source);
  assert.ok(found, `${file}: ${name}`); return bind((ts.isCallExpression(found) ? found.arguments[0] : found).getText(source), bindings);
}
function effect(file, fragment, bindings) {
  const source = tree(file); let found; const visit = node => { if (ts.isCallExpression(node) && /^(React\.)?useEffect$/.test(node.expression.getText(source)) && node.arguments[0].getText(source).includes(fragment)) found = node.arguments[0]; ts.forEachChild(node, visit); }; visit(source);
  assert.ok(found, `${file}: ${fragment}`); return bind(found.getText(source), bindings);
}
function load(file) { const module = { exports: {} }; Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(module, module.exports); return module.exports; }
function assertUrlOnly(value, seen = new Set()) {
  if (value === null || value === undefined || seen.has(value)) return;
  assert.equal(value instanceof Blob, false, 'Completed ownership must contain no File/Blob');
  if (typeof value === 'string') assert.equal(value.startsWith('blob:'), false, 'Completed ownership must contain no object URL');
  if (typeof value !== 'object') return; seen.add(value);
  for (const entry of value instanceof Map ? value.values() : Array.isArray(value) ? value : Object.values(value)) assertUrlOnly(entry, seen);
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const image = load('src/completedMediaLifecycle.ts');
const { SceneImageProvenance } = load('src/sceneImageReadiness.ts');
const video = load('src/savedVideoOwnership.ts');

test('storage publishes an existing paid clip to parent history even when initial hydration has not returned', () => {
  const emitted = [], target = { type: 'A', index: 0 }, projectId = '9', creationProjectId = 'draft-9';
  const register = callback('src/EditStory.tsx', 'registerStoredVideo', {
    PostId: 9, creationProjectId, getSceneTargetKey: () => 'A:0', ProtectSavedMediaFromDeleteLater() {}, adoptSavedSceneVideo() {},
    videoHistorySnapshotRef: { current: { projectId, creationProjectId, videoHistory: {} } },
    storedVideoReceiptsRef: { current: new Map() }, setVideoSaveReceiptVersion() {}, persistStoredVideoReceipt: async () => {},
    videoStorageCallbacksRef: { current: { onVideoMediaStored: (_target, entry) => emitted.push(entry) } },
  });
  register(target, 'https://storage.test/new.mp4', { previousVideoUrl: 'https://storage.test/first-paid.mp4', textValue: 'New motion' }, () => true);
  assert.deepEqual(emitted.map(entry => entry.videoUrl), ['https://storage.test/first-paid.mp4', 'https://storage.test/new.mp4']);
  assert.equal(emitted[0].createdAt, 0); assertUrlOnly(emitted);
});

test('actual history hydration isolates persisted posts sharing a draft id and carries only the first draft save', async () => {
  const helpers = load('server/src/videoHistory.ts');
  for (const previousPost of ['9', '0']) {
    const prior = { 'A:0': [{ videoUrl: 'https://storage.test/earlier.mp4', createdAt: 1 }] };
    const current = { 'A:0': [{ videoUrl: 'https://storage.test/current.mp4', createdAt: 2 }] };
    const owner = { postId: '10', creationProjectId: 'same-draft', userId: '7' };
    const history = { current: prior };
    const cached = JSON.stringify({ postId: previousPost === '0' ? null : previousPost, videoHistory: prior });
    const hydrate = effect('src/Storybook.tsx', 'const firstSavedPost = sameCreation', {
      ...helpers, videoHistoryOwnerRef: { current: owner }, restoredVideoHistoryOwnerRef: { current: { ...owner, postId: previousPost } },
      videoHistoryRef: history, CLIK_URL: '/fixture', localStorage: { getItem: key => key.includes('project:') ? cached : null },
      setVideoHistory() {}, setSavedVideoUpscales() {}, protectVideoHistory() {}, cacheVideoHistory() {}, RemoveVideoFromDeleteLater() {},
      axios: { get: async () => ({ data: { videoHistory: current, retainedMediaUrls: [] } }) }, console,
    });
    const cleanup = hydrate();
    assert.equal(Boolean(history.current['A:0']?.some(item => item.videoUrl === prior['A:0'][0].videoUrl)), previousPost === '0');
    await flush();
    assert.equal(history.current['A:0'].length, previousPost === '0' ? 2 : 1);
    assert.ok(history.current['A:0'].some(item => item.videoUrl === current['A:0'][0].videoUrl));
    cleanup();
  }
});

test('actual Storybook storage callback releases nine scenes across nine replacement versions before DB or Continue', () => {
  const scenes = 9, state = { sd: Array(scenes).fill(null), hd: Array(scenes).fill(null), previews: Array(scenes).fill(''), cloud: Array(scenes).fill(''), dummy: {}, selected: [], references: [] };
  const live = { ...state, liveSources: [], steps: Array(scenes).fill('Scene'), projectId: 'project', aTopology: 1 };
  const owned = new Set(), releasable = new Set(), revoked = [], receipts = {}, downloaded = new Map();
  const set = field => update => { state[field] = typeof update === 'function' ? update(state[field]) : update; };
  const bindings = { ...image, sceneTargetKey: target => `${target.type}:${target.index}`, imageLifecycleLiveRef: { current: live }, imageProvenanceRef: { current: new SceneImageProvenance() },
    imageMediaReceiptsRef: { current: receipts }, imageStoredAliasesRef: { current: new Map() }, imageDownloadedInputsRef: { current: downloaded },
    retainedInitialImageResultsRef: { current: [] }, ownedImageObjectUrlsRef: { current: owned }, releasableImageObjectUrlsRef: { current: releasable },
    setGeneratedImagesFluxBlob: set('sd'), setGeneratedImagesFluxBlobHd: set('hd'), setGeneratedImagesFlux: set('previews'), setImagesHdCloud: set('cloud'),
    setDummyImageUrls: set('dummy'), setGeneratedImage: set('selected'), setReferenceImages: set('references'), setImageMediaRevision() {},
    revokeUnusedOwnedObjectUrl: (url, owners) => image.revokeUnusedOwnedObjectUrl(url, owners, value => revoked.push(value)),
  };
  bindings.releaseStoredImageSources = callback('src/Storybook.tsx', 'releaseStoredImageSources', bindings);
  const stored = callback('src/Storybook.tsx', 'onImageMediaStored', bindings);
  const releaseUrls = effect('src/Storybook.tsx', 'if (revokeUnusedOwnedObjectUrl(url, imageLifecycleLiveRef.current.liveSources))', bindings);
  for (let version = 1; version <= 9; version++) for (let index = 0; index < scenes; index++) {
    const sd = new Blob([new Uint8Array(1024)], { type: 'image/webp' }), hd = new Blob([new Uint8Array(4096)], { type: 'image/webp' }), preview = `blob:image-${version}-${index}`;
    state.sd[index] = sd; state.hd[index] = hd; state.previews[index] = preview; state.dummy[index] = preview;
    state.selected = [preview]; state.references = [{ imageUrl: preview, name: 'Frozen authored reference' }];
    Object.assign(live, { sd: state.sd, hd: state.hd, previews: state.previews, cloud: state.cloud, liveSources: [...state.previews, ...state.selected, ...state.references.map(item => item.imageUrl), ...Object.values(state.dummy)] });
    owned.add(preview); downloaded.set(preview, sd);
    const receipt = { sdBlob: sd, hdBlob: hd, previewUrl: preview, sdUrl: `https://storage.test/${version}-${index}-sd.webp`, hdUrl: `https://storage.test/${version}-${index}-hd.webp`, persisted: false };
    stored({ type: 'A', index }, receipt); releaseUrls();
    assert.ok(state.sd.every(value => value === null)); assert.ok(state.hd.every(value => value === null));
    assert.equal(live.sd[index], null); assert.equal(live.hd[index], null); assert.equal(state.previews[index], receipt.sdUrl); assert.equal(state.cloud[index], receipt.hdUrl);
    assert.equal(state.selected[0], receipt.sdUrl); assert.equal(state.references[0].imageUrl, receipt.sdUrl); assert.equal(state.references[0].name, 'Frozen authored reference');
    assertUrlOnly(receipts); assertUrlOnly(live.sd); assertUrlOnly(live.hd); assert.equal(downloaded.size, 0); assert.equal(owned.size, 0); assert.equal(releasable.size, 0);
    assert.equal(receipts[`A:${index}`].persisted, false, 'Storage release must not depend on DB acknowledgement');
  }
  assert.equal(revoked.length, 81); assert.equal(bindings.retainedInitialImageResultsRef.current.length, 0);
});

test('late actual image storage callback preserves a newer unsaved file and retains only the older cloud URLs', () => {
  const old = new Blob(['old']), newer = new Blob(['unsaved']); const live = { sd: [newer], hd: [newer], previews: ['blob:new'], cloud: [''], liveSources: ['blob:new'] };
  const retained = { current: [] }, bindings = { ...image, imageLifecycleLiveRef: { current: live }, imageProvenanceRef: { current: new SceneImageProvenance() }, retainedInitialImageResultsRef: retained, imageStoredAliasesRef: { current: new Map() }, ownedImageObjectUrlsRef: { current: new Set() }, releasableImageObjectUrlsRef: { current: new Set() }, setGeneratedImage() {}, setReferenceImages() {}, setImageMediaRevision() {} };
  bindings.releaseStoredImageSources = callback('src/Storybook.tsx', 'releaseStoredImageSources', bindings);
  const stored = callback('src/Storybook.tsx', 'onImageMediaStored', bindings);
  stored({ type: 'A', index: 0 }, { sdBlob: old, hdBlob: old, previewUrl: 'blob:old', sdUrl: 'https://storage.test/old-sd', hdUrl: 'https://storage.test/old-hd' });
  assert.equal(live.sd[0], newer); assert.equal(live.previews[0], 'blob:new'); assertUrlOnly(retained.current); assert.equal(retained.current.length, 1);
});

test('actual signed video storage callbacks release nine scenes across nine versions while every metadata acknowledgement is pending', async () => {
  const scenes = 9, state = { VideoArray: Array(scenes).fill(null), VideoArrayBlob: Array(scenes).fill(null), VideoArrayCloud: Array(scenes).fill('') };
  const sources = { current: { ...state } }, receipts = { current: new Map() }, history = { current: { projectId: '9', creationProjectId: 'project-9', videoHistory: {} } };
  const revocations = new Set(), revoked = [], latest = { current: new Map() }, claims = { current: new Map() }, metadata = [], emitted = [], uploads = [], topology = { current: { projectId: '9', creationProjectId: 'project-9', topologyVersion: 1, aTopologyVersion: 1 } }; let nextUrl = 0;
  const setters = field => update => { state[field] = typeof update === 'function' ? update(state[field]) : update; sources.current[field] = state[field]; };
  const bindings = { ...video, PostId: 9, creationProjectId: 'project-9', pageType: 0, CreationMode: 'Video', CLIK_URL: '/fixture', console: { log() {}, error() {} },
    sceneSourceDataRef: sources, videoOwnershipCallbacksRef: { current: { setVideoArray: setters('VideoArray'), setVideoArrayBlob: setters('VideoArrayBlob'), setVideoArrayCloud: setters('VideoArrayCloud') } },
    mediaPreviewRevocationsRef: { current: revocations }, setMediaOwnershipVersion() {}, captureSceneTarget: index => ({ type: 'A', index }), resolveSceneTargetIndex: target => target.index,
    getSceneTargetKey: target => `${target.type}:${target.index}`, upscaleTopologyRef: topology, latestVideoUploadRef: latest, videoUploadClaimsRef: claims,
    storedVideoReceiptsRef: receipts, videoHistorySnapshotRef: history, videoStorageCallbacksRef: { current: { onVideoMediaStored: (target, entry) => emitted.push({ target, entry }) } },
    setVideoSaveReceiptVersion() {}, setVideoSavingScenes() {}, setGeneratingAt() {}, finishLoader() {}, ProtectSavedMediaFromDeleteLater() {},
    VideoArrayCloud: state.VideoArrayCloud, bShotSaveContextRef: { current: {} }, isBShotModeActive: false, IMMUTABLE_VIDEO_CACHE_CONTROL: 'immutable',
    videoUpscaleCompletedRef: { current: {} }, videoUpscaleProviderResultsRef: { current: {} }, retainedUpscaleUrlsRef: { current: new Set() },
    saveToDatabase: (url, index, preview, context) => { assert.equal(preview, undefined); assertUrlOnly(context); let resolve; const promise = new Promise(done => resolve = done); metadata.push({ url, index, context, resolve }); return promise; },
    axios: { post: async () => ({ data: { holder: [{ urlVideo: `https://storage.test/video-${++nextUrl}.mp4?signed=1` }] } }), put: async (_url, blob) => { uploads.push(blob.size); return { status: 200 }; } },
  };
  for (const name of ['adoptSavedSceneVideo', 'captureMediaSaveOwner', 'captureVideoUploadOwner', 'persistStoredVideoReceipt', 'registerStoredVideo']) bindings[name] = callback('src/EditStory.tsx', name, bindings);
  bindings.videoStorageOperationsRef = { current: { stored: bindings.registerStoredVideo } };
  bindings.PutVideoInS3WithURL = callback('src/EditStory.tsx', 'PutVideoInS3WithURL', bindings);
  const generate = callback('src/EditStory.tsx', 'GenerateSignedUrlForVideo', bindings);
  for (let version = 1; version <= 9; version++) for (let index = 0; index < scenes; index++) {
    const blob = new Blob([new Uint8Array(8192)], { type: 'video/mp4' }), preview = `blob:video-${version}-${index}`;
    state.VideoArray[index] = preview; state.VideoArrayBlob[index] = blob; sources.current = { ...state };
    const target = { type: 'A', index }, url = await generate(blob, index, preview, { textValue: `Authored ${version}:${index}` }, target);
    assert.equal(state.VideoArray[index], url); assert.equal(state.VideoArrayCloud[index], url); assert.equal(sources.current.VideoArrayBlob[index], null);
    assert.ok(state.VideoArrayBlob.every(value => value === null)); assertUrlOnly(receipts.current); assertUrlOnly(history.current); assertUrlOnly(emitted);
    assert.equal(receipts.current.get(`9:A:${index}`).status, 'saving'); assert.equal(claims.current.size, 0);
    effect('src/EditStory.tsx', 'for (const url of mediaPreviewRevocationsRef.current)', { ...bindings, VideoArray: state.VideoArray, generatedImagesFlux: [], GeneratedImage: [], referenceImages: [], URL: { revokeObjectURL: url => revoked.push(url) } })();
    assert.equal(revocations.size, 0);
  }
  assert.equal(metadata.length, 81); assert.equal(uploads.length, 81); assert.equal(revoked.length, 81); assert.equal(latest.current.size, 9);
  for (let index = 0; index < scenes; index++) assert.equal(history.current.videoHistory[`A:${index}`].length, 9);
  for (const save of metadata) save.resolve(); await flush(); assert.equal(receipts.current.size, 0);
});
