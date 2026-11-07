const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
function load(file) {
    const filename = path.resolve(__dirname, '..', file), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return mod.exports;
}
const api = load('src/creationWorkOwnership.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const source = fs.readFileSync(path.resolve(__dirname, '../src/Storybook.tsx'), 'utf8');
const tree = ts.createSourceFile('Storybook.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name) {
    let found; const walk = node => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer; ts.forEachChild(node, walk); }; walk(tree);
    assert.ok(found, name); return ts.isCallExpression(found) ? found.arguments[0].getText(tree) : found.getText(tree);
}
function effect(fragment) {
    let found; const walk = node => { if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes(fragment)) found = node.arguments[0]; ts.forEachChild(node, walk); }; walk(tree);
    assert.ok(found, fragment); return found.getText(tree);
}
function bind(code, bindings) {
    bindings = { creationDraft: undefined, captureCreationCache() {}, durableNarrationRef: { current: new Map() }, ...bindings };
    const js = ts.transpileModule(`const run = ${code};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return Function(...Object.keys(bindings), js + ';return run;')(...Object.values(bindings));
}

test('submitted work keeps one owner through pause/resume and retains its paid result', async () => {
    const requests = new api.OwnedCreationRequests(), response = deferred(); let enabled = true, calls = 0;
    const submit = () => { calls++; return response.promise; };
    const first = requests.run('scene/voice/text', () => enabled, submit);
    const duplicate = requests.run('scene/voice/text', () => enabled, submit);
    assert.equal(first, duplicate); await flush(); enabled = false;
    const resumed = requests.run('scene/voice/text', () => enabled, submit);
    assert.equal(resumed, first); response.resolve('paid-audio');
    assert.equal(await resumed, 'paid-audio'); assert.equal(calls, 1);
    assert.equal(await requests.run('scene/voice/text', () => enabled, submit), 'paid-audio');
    assert.equal(calls, 1);
});

test('pausing before the provider boundary submits nothing and later resumes once', async () => {
    const requests = new api.OwnedCreationRequests(); let enabled = true, calls = 0;
    const pending = requests.run('later-scene', () => enabled, async () => { calls++; return 'saved'; });
    enabled = false; await assert.rejects(pending, { name: 'CreationWorkPaused' }); assert.equal(calls, 0);
    enabled = true; assert.equal(await requests.run('later-scene', () => enabled, async () => { calls++; return 'saved'; }), 'saved'); assert.equal(calls, 1);
});

test('serial worker observes Stop after an awaited operation, then starts only missing work', async () => {
    const worker = new api.SerialCreationWorker(), wait = deferred(); let enabled = true, step = 0;
    const next = async () => { step++; if (step === 1) await wait.promise; return step < 3; };
    const first = worker.run(() => enabled, next); await flush(); enabled = false;
    assert.equal(worker.run(() => enabled, next), first); wait.resolve(); await first; assert.equal(step, 1);
    enabled = true; await worker.run(() => enabled, next); assert.equal(step, 3);
});

test('narration identity changes with voice and delivery but preserves exact literal text', () => {
    const item = { text: '“Come with me.”', prompt: 'Warm and calm.' };
    const key = api.narrationContentKey(item, 'Puck');
    assert.notEqual(key, api.narrationContentKey(item, 'Kore'));
    assert.notEqual(key, api.narrationContentKey({ ...item, prompt: 'Whisper.' }, 'Puck'));
    assert.notEqual(key, api.narrationContentKey({ ...item, text: 'Come with me.' }, 'Puck'));
    assert.equal(JSON.parse(key).language_code, 'en-US');
});

function bShotFixture() {
    const live = { prompts: [['Base [B-Shot-Pending 5s]'], ['Authored cutaway [B-Shot 5s]']], images: [[], []], videos: [[], []], nanoImages: [[], []], GeneratedText: ['Base cinematic prompt', 'Other base'], TextVideo: [], videoPrompts: [], generatedAudioTexts: [], prompt: 'Story', Planx: {}, Seed: 42, ratioKey: 1, topology: 0, anyGenerating: false };
    const gate = { allowed: false }, promptResponse = deferred(), imageResponse = deferred();
    const counts = { prompts: 0, images: 0, revisions: 0 }, retained = [], modelReceipts = [], state = { prompts: live.prompts, videos: [], nano: live.nanoImages };
    const owner = { current: null };
    const setters = field => value => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
    const bindings = {
        ...api, canSubmitBShotWork: () => gate.allowed, bShotWorkLiveRef: { current: live },
        failedBShotRequestsRef: { current: new Set() }, optionalBShotsRunning: true, setOptionalBShotsRunning() {},
        bShotTruthRef: { current: { images: live.images, videos: live.videos, prompts: live.prompts } },
        bShotWorkerRef: { current: new api.SerialCreationWorker() }, setIsGeneratingBShotPrompts() {},
        bShotPromptRequestsRef: { current: new api.OwnedCreationRequests() }, bShotNanoRequestsRef: { current: new api.OwnedCreationRequests() },
        sceneTopologyVersionRef: { current: 0 }, setBShotPrompts: setters('prompts'), setBShotTextVideo: setters('videos'), setBShotNanoImages: setters('nano'),
        retainedBShotArrangementsRef: { current: retained }, CLIK_URL: 'http://fixture',
        fetch: async () => { counts.prompts++; return promptResponse.promise; },
        axios: { post: async () => { counts.images++; return imageResponse.promise; } },
        cleanQuotedAtMentions: text => text, resolveStorybookGeneratedImage: async data => data.imageUrl,
        imageModelForGenerationRoute: (route, resultModel) => { assert.equal(route, 'fluxschnell'); return resultModel || 'Schnell'; },
        recordGeneratedImageModel: (model, urls) => modelReceipts.push({ model, urls }),
        dispatch() {}, throwLlmFetchError: async () => { throw Error('Failed prompt'); }, applyPixelBillingHeaders() {},
        observedBShotWorkRef: owner, setBShotWorkRevision: () => counts.revisions++, STORYBOOK_LINK_MODE: true,
        console: { error() {} },
    };
    const run = bind(effect('const work = bShotWorkerRef.current.run'), bindings);
    return { live, gate, counts, retained, modelReceipts, state, bindings, owner, promptResponse, imageResponse, run };
}

test('actual B-shot effect enters optional mode without calls and resumes nano after Publish interrupts prompt', async () => {
    const f = bShotFixture(); f.run(); await flush(); assert.deepEqual(f.counts, { prompts: 0, images: 0, revisions: 0 });
    f.gate.allowed = true; f.run(); await flush(); assert.equal(f.counts.prompts, 1);
    f.gate.allowed = false; f.promptResponse.resolve({ ok: true, json: async () => ({ visualPromptStage1: 'Authored result' }) });
    await f.owner.current; await flush(); assert.equal(f.counts.images, 0);
    assert.equal(f.state.prompts[0][0], 'Authored result [B-Shot 5s]');
    f.run(); await flush(); assert.equal(f.counts.images, 0);
    // A Publish return in an optional mode still waits for explicit Start.
    f.gate.allowed = true; f.live.prompts = f.state.prompts; f.run(); await flush();
    assert.equal(f.counts.prompts, 1); assert.equal(f.counts.images, 1);
    f.gate.allowed = false; f.imageResponse.resolve({ data: { imageUrl: 'https://fixture/paid.png' } });
    await f.owner.current; assert.equal(f.state.nano[0][0], 'https://fixture/paid.png');
    assert.deepEqual(f.modelReceipts, [{ model: 'Schnell', urls: ['https://fixture/paid.png'] }]);
});

test('actual B-shot worker retains a stale paid completion without overwriting a rebuilt arrangement', async () => {
    const f = bShotFixture(); f.gate.allowed = true; f.run(); await flush();
    f.gate.allowed = false; f.bindings.sceneTopologyVersionRef.current = 1;
    f.live.topology = 1; f.live.prompts = [['New arrangement [B-Shot-Pending 5s]']]; f.state.prompts = f.live.prompts;
    f.promptResponse.resolve({ ok: true, json: async () => ({ visualPromptStage1: 'Old paid result' }) });
    await f.owner.current;
    assert.deepEqual(f.state.prompts, [['New arrangement [B-Shot-Pending 5s]']]);
    assert.equal(f.retained[0].prompt, 'Old paid result [B-Shot 5s]'); assert.equal(f.counts.images, 0);
});

test('actual B-shot effect stops polling once all slots already have media', async () => {
    const f = bShotFixture(); f.gate.allowed = true;
    f.live.images = [['https://fixture/image.png']]; f.live.videos = [[], ['https://fixture/video.mp4']];
    f.run(); f.run(); await flush(); assert.equal(f.counts.prompts, 0); assert.equal(f.counts.images, 0); assert.equal(f.counts.revisions, 0);
});

test('resume selects missing nano only, skips active-stage failures, existing videos and preview results', () => {
    const f = bShotFixture(), failed = new Set();
    f.live.prompts[0][0] = 'Ready cutaway [B-Shot 5s]';
    const nano = api.nextBShotCreationStage(f.live, failed); assert.equal(nano.pending, false);
    failed.add(nano.key); assert.equal(api.nextBShotCreationStage(f.live, failed).index, 1);
    f.live.videos[1][0] = 'https://fixture/video.mp4'; assert.equal(api.nextBShotCreationStage(f.live, failed), null);
    failed.clear(); f.live.nanoImages[0][0] = 'https://fixture/preview.png'; assert.equal(api.nextBShotCreationStage(f.live, failed), null);
});

test('actual final Publish opening pauses synchronously before its modal state changes', () => {
    let allowed = true, optional = true, opened = false;
    const run = bind(callback('setFinalPublishOpen'), { pauseBShotWork: () => { allowed = false; optional = false; }, setPublishLoader2Open: value => { assert.equal(allowed, false); opened = value; } });
    run(true); assert.equal(opened, true); assert.equal(optional, false);
});

function calculation(duration) {
    let state = { prompts: [], images: [], videos: [], time: null }, timeout;
    class Audio { constructor() { this.duration = duration; timeout = () => this.onloadedmetadata(); queueMicrotask(timeout); } }
    const bindings = { sceneTopologyVersionRef: { current: 0 }, isBShotModeActive: true, time: 5, bShotPrompts: [], bShotImages: [], bShotVideos: [], steps: ['A', 'B'], activatevoicenarration: true, type: 1, generatedAudios: ['blob:audio'], Audio, bShotBuiltWithTime: null,
        setBShotPrompts: value => state.prompts = value, setBShotImages: value => state.images = value, setBShotVideos: value => state.videos = value, setBShotBuiltWithTime: value => state.time = value, setShowBShotTimeChangeWarning() {}, console: { error() {} } };
    return { run: bind(effect('const calculateBShots = async'), bindings), state, bindings };
}
test('actual duration calculation preserves zero shots, round threshold, two A-shots and ten-shot cap', async () => {
    for (const [duration, count] of [[10, 0], [12, 0], [15, 1], [22, 2], [120, 10]]) {
        const f = calculation(duration); f.run(); await flush();
        assert.equal(f.state.prompts[0]?.length || 0, 0); assert.equal(f.state.prompts[1]?.length || 0, count);
        if (count) assert.equal(f.state.time, 5);
    }
});

test('an old metadata result cannot restore the B-shot layout after reset', async () => {
    const f = calculation(22), close = f.run(); f.bindings.sceneTopologyVersionRef.current = 1; close(); await flush();
    assert.deepEqual(f.state.prompts, []);
});

function narrationFixture(overrides = {}) {
    const live = { enabled: true, voice: 'Puck', plots: [{ text: 'First scene', prompt: 'Warm.' }, 'Second scene'], audios: [], texts: [], layout: 0 };
    const first = deferred(), second = deferred(), delay = deferred();
    const state = { audio: [], texts: [], statuses: [{ status: 'pending' }, { status: 'pending' }] };
    let calls = 0, urls = 0;
    const bindings = {
        ...api, narrationLiveRef: { current: live }, narrationLayoutVersionRef: { current: 0 },
        narrationRequestsRef: { current: new api.OwnedCreationRequests() }, narrationMetadataRef: { current: new Map() },
        failedNarrationRequestsRef: { current: new Set() }, narrationRequestedRef: { current: true },
        narrationWorkerRef: { current: new api.SerialCreationWorker() },
        sleepx: async () => delay.promise, axios: { post: async () => { calls++; return calls === 1 ? first.promise : second.promise; } },
        CLIK_URL: 'http://fixture', URL: { createObjectURL: () => `blob:paid-${++urls}` }, Blob, Uint8Array, atob,
        setGeneratedAudios: update => state.audio = update(state.audio), setGeneratedAudioTexts: update => state.texts = update(state.texts),
        setAudioSceneStatuses: update => state.statuses = update(state.statuses), console: { error() {} },
        ...overrides,
    };
    const speech = bind(callback('fetchAndGenerateSpeech'), bindings);
    bindings.fetchAndGenerateSpeech = speech;
    bindings.hasValidNarrationAudio = (item, index) => api.isCompletedCreationMedia(live.audios[index])
        && bindings.narrationMetadataRef.current.get(live.audios[index]) === api.narrationContentKey(item, live.voice);
    const run = bind(callback('callvoice'), bindings);
    return { live, first, second, delay, state, bindings, run, speech, calls: () => calls };
}

test('actual narration callbacks pause before TTS dispatch if switched off during the delay', async () => {
    const f = narrationFixture(), work = f.run('', [], 'Puck'); await flush();
    f.live.enabled = false; f.delay.resolve(); await work;
    assert.equal(f.calls(), 0); assert.equal(f.state.statuses[0].status, 'pending');
    assert.deepEqual(f.state.audio, []);
});

test('actual narration callbacks retain in-flight audio, block the next scene, and resume without duplicate work', async () => {
    const f = narrationFixture(); f.delay.resolve();
    const first = f.run('', [], 'Puck'); await flush(); assert.equal(f.calls(), 1);
    f.live.enabled = false;
    // Closing the progress dialog never touches the request/queue owner.
    assert.equal(f.run('', [], 'Puck'), first);
    f.first.resolve({ data: { audioContent: Buffer.from('audio-one').toString('base64') } }); await first;
    assert.equal(f.calls(), 1); assert.equal(f.state.audio[0], 'blob:paid-1');
    f.live.enabled = true; const resumed = f.run('', [], 'Puck');
    assert.equal(f.run('', [], 'Puck'), resumed); await flush(); assert.equal(f.calls(), 2);
    f.second.resolve({ data: { audioContent: Buffer.from('audio-two').toString('base64') } }); await resumed;
    assert.deepEqual(f.state.audio, ['blob:paid-1', 'blob:paid-2']); assert.equal(f.calls(), 2);
});

test('actual narration callbacks retain results for changed topology/settings without assigning them to a new scene', async () => {
    const f = narrationFixture(); f.delay.resolve(); const work = f.speech(f.live.plots[0], 0, 'Puck', ''); await flush();
    f.bindings.narrationLayoutVersionRef.current = 1; f.live.layout = 1; f.live.plots = ['Replacement scene'];
    f.first.resolve({ data: { audioContent: Buffer.from('paid audio').toString('base64') } }); await work;
    assert.deepEqual(f.state.audio, []); assert.equal(f.bindings.narrationRequestsRef.current.result(api.narrationContentKey({ text: 'First scene', prompt: 'Warm.' }, 'Puck')), 'blob:paid-1');
});

test('actual B-shot save passes upscale ownership metadata and protects URLs only after persistence', async () => {
    const done = deferred(); let body, config, imagesProtected = 0, videosProtected = 0, receipt;
    const run = bind(callback('saveBShotTruthPayload'), { axios: { put: async (_url, data, options) => { body = data; config = options; return done.promise; } }, CLIK_URL: 'http://fixture', PostId: 7,
        imageModelsForSources: urls => { assert.deepEqual(urls, ['https://fixture/image.png']); return { 'https://fixture/image.png': 'Schnell' }; },
        ...api, ...load('server/src/videoHistory.ts'), videoHistoryRef: { current: { 'B:2:1': [{ videoUrl: 'https://fixture/1080.mp4', createdAt: 10, prompt: 'Original generation' }] } }, RemoveFromDeleteLater: () => imagesProtected++, RemoveVideoFromDeleteLater: () => videosProtected++, ProtectSavedMediaFromDeleteLater: value => receipt = value,
        console: { error() {} } });
    const upscale = { parentScene: 2, bShotIndex: 1, videoUrl: 'https://fixture/2k.mp4', sourceUrl: 'https://fixture/1080.mp4', resolution: '2k' };
    const work = run([['https://fixture/image.png']], [['https://fixture/2k.mp4']], [['Authored prompt']], 'save failed', upscale);
    assert.equal(imagesProtected, 0); assert.equal(videosProtected, 0); assert.equal(body.values.postId, 7);
    assert.equal(body.values.upscale, upscale); assert.equal(config.withCredentials, true);
    assert.deepEqual(body.values.imageModels, { 'https://fixture/image.png': 'Schnell' });
    assert.deepEqual(body.values.videoHistory, { 'B:2:1': [{ videoUrl: 'https://fixture/1080.mp4', createdAt: 10, prompt: 'Original generation' }] });
    done.resolve({ data: {} }); await work; assert.equal(imagesProtected, 1); assert.equal(videosProtected, 1); assert.equal(receipt, upscale);
});

function bShotUpscaleSaveFixture() {
    const architecture = load('src/sceneTargetArchitecture.ts'), saved = deferred(), calls = [];
    const state = { images: [['image-original']], videos: [['source-video']], prompts: [['Authored original']], receipts: {}, writes: [] };
    const bindings = {
        ...architecture, activeEdit: 0, activeBShotEdit: 0, VideoArrayCloud: [], type: 1,
        PostId: 7, bShotTruthPostIdRef: { current: 7 },
        sceneTopologyVersionRef: { current: 3 },
        bShotTruthRef: { current: { images: state.images, videos: state.videos, prompts: state.prompts } },
        bShotTruthQueueRef: { current: architecture.createSerialTaskQueue() },
        saveBShotTruthPayload: async (...args) => { calls.push(args); return saved.promise; },
        setBShotImages: value => { state.images = value; state.writes.push('images'); },
        setBShotVideos: value => { state.videos = value; state.writes.push('videos'); },
        setBShotPrompts: value => { state.prompts = value; state.writes.push('prompts'); },
        setSavedVideoUpscales: value => { state.receipts = value(state.receipts); },
        cleanQuotedAtMentions: value => value, console: { error() {} },
    };
    bindings.enqueueBShotTruthMutation = bind(callback('enqueueBShotTruthMutation'), bindings);
    const run = bind(callback('handleBShotTruthSave'), bindings);
    const metadata = { topologyVersion: 3, sourceUrl: 'source-video', resolution: '2k', predictionId: 'paid-upscale', duration: 5 };
    return { state, bindings, saved, calls, metadata, run: () => run('paid-upscale-video', 'Earlier prompt snapshot', true, 0, 0, metadata) };
}

test('actual deferred B upscale save awaits persistence and promotes only its video slot while preserving newer prompts/images', async () => {
    const f = bShotUpscaleSaveFixture(), work = f.run(); await flush();
    assert.deepEqual(f.state.writes, []); assert.equal(f.calls[0][4].promote, true);
    f.bindings.bShotTruthRef.current = { images: [['New authored image']], videos: [['source-video', 'Other slot completed']], prompts: [['New manual prompt']] };
    f.saved.resolve({ promoted: true }); assert.deepEqual(await work, { promoted: true });
    assert.deepEqual(f.state.writes, ['videos']); assert.deepEqual(f.state.videos, [['paid-upscale-video', 'Other slot completed']]);
    assert.deepEqual(f.bindings.bShotTruthRef.current.images, [['New authored image']]); assert.deepEqual(f.bindings.bShotTruthRef.current.prompts, [['New manual prompt']]);
    assert.equal(f.metadata.promoted, true); assert.equal(f.state.receipts['B:0:0'].videoUrl, 'paid-upscale-video');
});

test('actual B upscale save retains stale receipt without publishing over a replacement or rebuilt topology', async () => {
    const replaced = bShotUpscaleSaveFixture(); replaced.bindings.bShotTruthRef.current.videos = [['Manual newer video']];
    const work = replaced.run(); await flush(); assert.equal(replaced.calls[0][4].promote, false);
    replaced.saved.resolve({ promoted: false }); assert.deepEqual(await work, { promoted: false });
    assert.deepEqual(replaced.state.writes, []); assert.deepEqual(replaced.state.receipts, {}); assert.equal(replaced.metadata.promoted, false);

    const rebuilt = bShotUpscaleSaveFixture(), pending = rebuilt.run(); await flush();
    rebuilt.bindings.sceneTopologyVersionRef.current += 1;
    rebuilt.bindings.bShotTruthRef.current = { images: [['Rebuilt image']], videos: [['source-video']], prompts: [['Rebuilt manual prompt']] };
    rebuilt.saved.resolve({ promoted: true }); assert.deepEqual(await pending, { promoted: false });
    assert.deepEqual(rebuilt.state.writes, []); assert.deepEqual(rebuilt.bindings.bShotTruthRef.current.prompts, [['Rebuilt manual prompt']]);
});

test('B upscale promotion preserves an explicit upstream rejection even when local source and topology still match', async () => {
    const f = bShotUpscaleSaveFixture(); f.metadata.promote = false;
    const work = f.run(); await flush(); assert.equal(f.calls[0][4].promote, false);
    f.saved.resolve({ promoted: false }); assert.deepEqual(await work, { promoted: false }); assert.deepEqual(f.state.writes, []);
    const switched = bShotUpscaleSaveFixture(); switched.bindings.bShotTruthPostIdRef.current = 9;
    const pending = switched.run(); await flush(); assert.equal(switched.calls[0][4].promote, false);
    switched.saved.resolve({ promoted: false }); assert.deepEqual(await pending, { promoted: false }); assert.deepEqual(switched.state.writes, []);
});


test('draft narration storage failure retries already-paid audio without another TTS submission', async () => {
    let uploads=0, tts=0; const captures=[], revoked=[];
    const durable={current:new Map()};
    const f=narrationFixture({
        creationDraft:{getState:()=>({postId:23}),flush:async()=>{}}, durableNarrationRef:durable,
        dispatch() {}, showAiProviderNotice: value => value,
        captureCreationCache:(_draft,section,patch)=>captures.push({section,patch}),
        GenerateSignedUrlForSingleAudio:async()=>({urlAudio:'https://assets/voice.wav?signature=private'}),
        ProtectSavedMediaFromDeleteLater(){}, fetch:async()=>({blob:async()=>new Blob(['paid audio'],{type:'audio/wav'})}),
        URL:{createObjectURL:()=> 'blob:already-paid',revokeObjectURL:url=>revoked.push(url)},
        axios:{post:async()=>{tts++;return {data:{audioContent:Buffer.from('audio').toString('base64')}}},
            put:async()=>{uploads++;if(uploads===1)throw new Error('Upload interrupted')}}
    });
    f.delay.resolve();
    assert.equal(await f.speech(f.live.plots[0],0,'Puck',''),undefined);
    assert.equal(tts,1);assert.equal(uploads,1);assert.deepEqual(f.state.audio,[]);
    const restored=await f.speech(f.live.plots[0],0,'Puck','');
    assert.equal(restored,'https://assets/voice.wav');assert.equal(tts,1);assert.equal(uploads,2);
    await f.speech(f.live.plots[0],0,'Puck','');assert.equal(tts,1);assert.equal(uploads,2);
    assert.deepEqual(revoked,['blob:already-paid']);
    assert.equal(captures.find(entry=>entry.section==='prompt').patch.generatedAudios[0],'https://assets/voice.wav');
});
