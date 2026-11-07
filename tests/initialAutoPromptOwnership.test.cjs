const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
const source = fs.readFileSync(path.resolve(__dirname, '../src/EditStory.tsx'), 'utf8');
const tree = ts.createSourceFile('EditStory.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) { let found; const walk = node => { if (predicate(node)) found = node; ts.forEachChild(node, walk); }; walk(tree); assert.ok(found); return found; }
function callback(name) { const node = find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name).initializer; return node.arguments[0].getText(tree); }
function effect(fragment) { return find(node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0].getText(tree).includes(fragment)).arguments[0].getText(tree); }
function bind(code, bindings) { const js = ts.transpileModule(`const run = ${code};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText; return Function(...Object.keys(bindings), js + ';return run;')(...Object.values(bindings)); }
function load(file) { const filename = path.resolve(__dirname, '..', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename); return mod.exports; }
const scene = load('src/sceneTargetArchitecture.ts'), dialogue = load('src/videoDialogue.ts'), cinema = load('src/cinemaDialogue.ts');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const requests = [], edits = [], errors = [], state = { loading: [], video: '', image: '', instruction: 'keep A instruction', draw: {} };
    const PlanVid = { story: 'Initial plan' };
    const bindings = {
        ...require('./promptTestBindings.cjs').loadTypeScript('src/imagePromptPacing.ts'),
        CLIK_URL: 'http://fixture', PlanVid, PostId: 4, pageType: 1, aSceneTopologyVersion: 0, sceneTopologyVersion: 0,
        VideMode: true, narrate: 2, PLoader: false, manualOnlyVideoPrompts: false, startEdit: false, index: 0, AUTO_PROMPT_VIDEO_MODEL: 'Proxx', videModel: 'Proxx',
        initialAutoPromptEnabledRef: { current: true }, initialAutoPromptContextRef: { current: { PlanVid, aSceneTopologyVersion: 0, PostId: 4, pageType: 1 } },
        autoPromptedPlanVidRef: { current: null }, autoPromptBatchPlanRef: { current: null },
        unifiedIndexMapRef: { current: [0, 1, 2].map(index => ({ type: 'A', index, originalIndex: index })) },
        sceneSourceDataRef: { current: { GeneratedText: ['Image zero', 'Image one', 'Image two'], steps: ['Zero', 'One', 'Two'], TextVideo: ['', 'Authored prompt', ''], ImagesHdCloud: ['img0', 'img1', 'img2'] } },
        imagePromptDraftsRef: { current: {} }, videoPromptDraftsRef: { current: { 'A:1': 'Authored prompt' } },
        dirtyImagePromptScenesRef: { current: new Set() }, dirtyVideoPromptScenesRef: { current: new Set(['A:1']) },
        requestVersionsRef: { current: {} }, sceneRequestSerialRef: { current: 0 }, autoPromptLoadingTargetsRef: { current: new Map() }, retainedAutoPromptResultsRef: { current: new Map() },
        initialDialogueCacheRef: { current: dialogue.createInitialVideoDialogueCache() }, cinemaDialoguePlanCacheRef: { current: cinema.createCinemaDialoguePlanCache() }, initialCinemaDialogueSourcesRef: { current: new Map() },
        refreshInitialDialogue() {}, settextVidUpdate: value => { state.instruction = value; }, setvideModel() {}, setbutton() {},
        getSceneTargetKey: scene.sceneTargetKey, getSceneIntentForTarget: () => null, getImagePacingForTarget: () => null, getCinemaDialogueSource: () => null,
        invalidateInitialDialogue(target) { bindings.initialDialogueCacheRef.current.invalidate(scene.sceneTargetKey(target)); },
        ImagesHdCloud: ['img0', 'img1', 'img2'], TextVideo: ['', 'Authored prompt', ''], prompt: 'Story', stepsx: [], time: 5, ratioKey: 1, languageModel: 'sol', musicKling: false,
        setloadPrompt(value) { state.loading = typeof value === 'function' ? value(state.loading) : value; },
        applyLlmBilling() {}, applyLlmBillingError: () => '', dispatch() {}, globalErrorEmitter: { emit: (...args) => errors.push(args) }, console: { log() {}, error() {} },
        withPromptWriteSource: (_source, run) => run(),
        commitVideoPromptToScene(target, value) { edits.push([scene.sceneTargetKey(target), value]); const slot = bindings.resolveSceneTargetIndex(target); bindings.sceneSourceDataRef.current.TextVideo[slot] = value; },
        setVideoPromptDraftForTarget(target, value) { bindings.videoPromptDraftsRef.current[scene.sceneTargetKey(target)] = value; },
        EditGeneratedVisualTextOnlyFn: async () => {},
        axios: { post: async (_url, payload) => { const request = deferred(); requests.push({ ...request, payload }); return request.promise; } },
    };
    bindings.captureSceneTarget = index => { const entry = bindings.unifiedIndexMapRef.current[index]; return { type: entry.type, index: entry.index, ...(entry.type === 'B' ? { bIndex: entry.bIndex } : {}) }; };
    bindings.resolveSceneTargetIndex = target => scene.findSceneTargetIndex(bindings.unifiedIndexMapRef.current, target);
    bindings.resolveVideoPromptForTarget = target => bindings.videoPromptDraftsRef.current[scene.sceneTargetKey(target)] ?? bindings.sceneSourceDataRef.current.TextVideo[bindings.resolveSceneTargetIndex(target)] ?? '';
    bindings.beginSceneRequest = bind(callback('beginSceneRequest'), bindings);
    bindings.isLatestSceneRequest = bind(callback('isLatestSceneRequest'), bindings);
    bindings.syncAutoPromptLoading = bind(callback('syncAutoPromptLoading'), bindings);
    bindings.fetchAndGenerateImage = bind(callback('fetchAndGenerateImage'), bindings);
    const enter = () => bind(effect('autoPromptedPlanVidRef.current ='), bindings)();
    return { bindings, requests, edits, errors, state, enter, fetch: (...args) => bind(callback('fetchAndGenerateImage'), bindings)(...args) };
}

test('actual initial-grid effect prepares only missing A prompts before opening editor, shows queued progress, and does not repeat', async () => {
    const f = fixture(); f.enter();
    assert.deepEqual(f.errors, []);
    assert.equal(f.requests.length, 1); assert.deepEqual(f.state.loading, [true, false, true]); assert.equal(f.bindings.startEdit, false);
    f.enter(); await f.fetch(0, '', 0, 'Proxx', true); assert.equal(f.requests.length, 1);
    f.requests[0].resolve({ data: { storyPrompt: 'Initial zero', llmBilling: {} } }); await flush();
    assert.equal(f.requests.length, 2); assert.equal(f.requests[1].payload.llmBatchContinuation, false); assert.notEqual(f.requests[0].payload.promptOperationId, f.requests[1].payload.promptOperationId);
    f.requests[1].resolve({ data: { storyPrompt: 'Initial two' } }); await flush(); f.enter();
    assert.deepEqual(f.edits.map(([key]) => key), ['A:0', 'A:2']); assert.equal(f.bindings.videoPromptDraftsRef.current['A:1'], 'Authored prompt');
    assert.deepEqual(f.state.loading, [false, false, false]); assert.equal(f.requests.length, 2); assert.deepEqual(f.errors, []);
});

test('actual initial batch stops new requests on Images return and explicit AutoPrompt then affects one chosen shot', async () => {
    const f = fixture(); f.enter(); f.bindings.initialAutoPromptEnabledRef.current = false; f.bindings.manualOnlyVideoPrompts = true;
    f.requests[0].resolve({ data: { storyPrompt: 'Paid first prompt' } }); await flush(); f.enter();
    assert.equal(f.requests.length, 1); assert.deepEqual(f.state.loading, [false, false, false]);
    const manual = f.fetch(2, '', 0, 'Proxx', false); assert.equal(f.requests.length, 2);
    f.requests[1].resolve({ data: { storyPrompt: 'Explicit chosen shot' } }); await manual;
    assert.deepEqual(f.edits.map(([key]) => key), ['A:0', 'A:2']); assert.equal(f.requests.length, 2);
});

test('a deferred prompt response retains its paid output while preserving a manual edit made during the request', async () => {
    const f = fixture(); f.enter(); f.bindings.initialAutoPromptEnabledRef.current = false;
    f.bindings.videoPromptDraftsRef.current['A:0'] = 'Manual latest text'; f.bindings.dirtyVideoPromptScenesRef.current.add('A:0');
    f.requests[0].resolve({ data: { storyPrompt: 'Earlier paid text' } }); await flush();
    assert.deepEqual(f.edits, []); assert.equal(f.bindings.videoPromptDraftsRef.current['A:0'], 'Manual latest text');
    assert.equal([...f.bindings.retainedAutoPromptResultsRef.current.values()].find(value => value.storyPrompt)?.storyPrompt, 'Earlier paid text');
});

test('queued initial work skips a prompt authored while an earlier request was in flight', async () => {
    const f = fixture(); f.enter(); f.bindings.videoPromptDraftsRef.current['A:2'] = 'New authored shot'; f.bindings.dirtyVideoPromptScenesRef.current.add('A:2');
    f.requests[0].resolve({ data: { storyPrompt: 'Initial zero' } }); await flush();
    assert.equal(f.requests.length, 1); assert.equal(f.bindings.videoPromptDraftsRef.current['A:2'], 'New authored shot'); assert.deepEqual(f.state.loading, [false, false, false]);
});

test('returning during a shared cinema-plan await prevents the provider submission', async () => {
    const f = fixture(), wait = deferred(); f.bindings.musicKling = true;
    f.bindings.getCinemaDialogueSource = () => ({ signature: 'same logical scene', narration: { stages: [{ duration: 5 }] }, llmTier: 'sol' });
    f.bindings.cinemaDialoguePlanCacheRef.current = { get: () => undefined, reserve: () => ({ owner: false, completion: wait.promise }), epoch: () => 0, isCurrent: () => true };
    const work = f.fetch(0, '', 0, 'Proxx', true); await flush(); assert.equal(f.requests.length, 0);
    f.bindings.initialAutoPromptEnabledRef.current = false; wait.resolve(); await work; assert.equal(f.requests.length, 0); assert.deepEqual(f.state.loading, [false, false, false]);
});

function topologyFixture() {
    const f = fixture(), b = f.bindings;
    b.creationDraft = undefined;
    b.editorPlanSignature = JSON.stringify(b.PlanVid);
    b.editorNativeTopology = '[0,1,2]';
    b.captureCreationCache = () => {};
    f.state.editor = {};
    for (const field of ['vidGenCaches','actionImagesMap','activeActionImagesMap','motionImagesMap','activeMotionImagesMap',
        'selectedPromptsMap','selectedFinalsMap','resultHistory','resultImagePrompt','resultIntent']) {
        f.state.editor[field] = { 'A:1': ['Accepted A'], 'B:0:0': ['Old B'] };
        b['set'+field[0].toUpperCase()+field.slice(1)] = update => {
            f.state.editor[field] = typeof update === 'function' ? update(f.state.editor[field]) : update;
        };
    }
    for (const field of ['resultHistory','resultImagePrompt','resultIntent']) b[field+'Ref'] = { current: f.state.editor[field] };
    b.lastSceneTopologyVersionRef = { current: { sceneTopologyVersion: 0, aSceneTopologyVersion: 0, PostId: 4, pageType: 1 } };
    b.currentSceneKey = 'A:1'; b.index = 1; b.isArrayMode = true; b.defaultText = '';
    b.cleanPromptLiterals = value => value; b.textVidUpdateLiveRef = { current: 'keep A instruction' };
    b.setvideotxt = value => { f.state.video = value; }; b.setTextValue = value => { f.state.image = value; };
    b.setAutoDrawGeneratingScenes = value => { f.state.draw = typeof value === 'function' ? value(f.state.draw) : value; };
    b.imagePromptDraftsRef.current = { 'A:1': 'Authored A image', 'B:0:0': 'Old B image' };
    b.videoPromptDraftsRef.current['B:0:0'] = 'Old B video'; b.dirtyImagePromptScenesRef.current = new Set(['A:1', 'B:0:0']); b.dirtyVideoPromptScenesRef.current.add('B:0:0');
    b.requestVersionsRef.current = { 'A:1:auto-video-prompt': 1, 'B:0:0:auto-video-prompt': 2 };
    b.autoPromptLoadingTargetsRef.current.set('A:1', Symbol()); b.autoPromptLoadingTargetsRef.current.set('B:0:0', Symbol()); f.state.draw = { 'A:1': true, 'B:0:0': true };
    return { ...f, change: () => bind(effect('const invalidateAll = previous.aSceneTopologyVersion'), b)() };
}

test('actual topology effect preserves A drafts, dialogue and active work through B rebuild and remaps their progress', () => {
    const f = topologyFixture(), b = f.bindings;
    const request = b.initialDialogueCacheRef.current.begin('A:1'); b.initialDialogueCacheRef.current.store(request, 'Saved A speech');
    b.sceneTopologyVersion = 1; f.change();
    assert.deepEqual(b.imagePromptDraftsRef.current, { 'A:1': 'Authored A image' }); assert.deepEqual(b.videoPromptDraftsRef.current, { 'A:1': 'Authored prompt' });
    assert.deepEqual(b.requestVersionsRef.current, { 'A:1:auto-video-prompt': 1 }); assert.equal(b.initialDialogueCacheRef.current.isCurrent(request), true);
    assert.equal(f.state.video, 'Authored prompt'); assert.equal(f.state.image, 'Authored A image'); assert.equal(f.state.instruction, 'keep A instruction');
    assert.deepEqual(f.state.loading, [false, true, false]); assert.deepEqual(f.state.draw, { 'A:1': true });
    for (const value of Object.values(f.state.editor)) assert.deepEqual(value, { 'A:1': ['Accepted A'] });
});

test('A deletion or project change invalidates every old draft/request and never reuses an old request version', () => {
    const f = topologyFixture(), b = f.bindings; const old = b.beginSceneRequest('auto-video-prompt', { type: 'A', index: 1 });
    b.sceneTopologyVersion = 1; b.aSceneTopologyVersion = 1; f.change();
    assert.deepEqual(b.imagePromptDraftsRef.current, {}); assert.deepEqual(b.videoPromptDraftsRef.current, {}); assert.deepEqual(f.state.loading, [false, false, false]);
    const next = b.beginSceneRequest('auto-video-prompt', { type: 'A', index: 1 }); assert.notEqual(next.version, old.version); assert.equal(b.isLatestSceneRequest(old), false);
    b.imagePromptDraftsRef.current['A:0'] = 'Other project'; b.PostId = 9; f.change(); assert.deepEqual(b.imagePromptDraftsRef.current, {});
    for (const value of Object.values(f.state.editor)) assert.deepEqual(value, {});
});

test('A deletion adopts the parent synchronous stable-target remap before editor effects can save old indexes', () => {
    const f = topologyFixture(), b = f.bindings;
    const editor = { remappedASceneTopologyVersion: 1,
        promptDrafts: { image: { 'A:0': 'Retained later scene image' }, video: { 'A:0': 'Retained later scene video' }, dirtyImage: ['A:0'], dirtyVideo: ['A:0'] },
        resultHistory: { 'A:0': ['https://assets/selected-fourth.png'] },
        resultImagePrompt: { 'A:0': ['Matching fourth prompt'] }, resultIntent: { 'A:0': [{ sceneId: 'retained-later-scene' }] } };
    b.creationDraft = { section: () => editor };
    b.sceneTopologyVersion = 1; b.aSceneTopologyVersion = 1; b.currentSceneKey = 'A:0'; b.index = 0;
    f.change();
    assert.deepEqual(b.imagePromptDraftsRef.current, editor.promptDrafts.image);
    assert.deepEqual(b.videoPromptDraftsRef.current, editor.promptDrafts.video);
    assert.deepEqual(b.resultHistoryRef.current, editor.resultHistory);
    assert.deepEqual(b.resultImagePromptRef.current, editor.resultImagePrompt);
    assert.deepEqual(b.resultIntentRef.current, editor.resultIntent);
    assert.equal(f.state.image, 'Retained later scene image');
    assert.equal(f.state.video, 'Retained later scene video');
});

test('actual Storybook A card displays queued prompt progress using its native target after B shots flatten the grid', () => {
    const storybook = ts.createSourceFile('Storybook.tsx', fs.readFileSync(path.resolve(__dirname, '../src/Storybook.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let slot, preparing, badge;
    const walk = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(storybook) === 'promptSceneIndex') slot = node.initializer;
        if (ts.isVariableDeclaration(node) && node.name.getText(storybook) === 'isPromptPreparing') preparing = node.initializer;
        if (ts.isJsxExpression(node) && node.expression?.getText(storybook).startsWith('isPromptPreparing &&')) badge = node.expression;
        ts.forEachChild(node, walk);
    }; walk(storybook); assert.ok(slot && preparing && badge);
    const code = ts.transpileModule(`const promptSceneIndex = ${slot.getText(storybook)}; const isPromptPreparing = ${preparing.getText(storybook)}; const result = ${badge.getText(storybook)};`,
        { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
    const render = VideMode => Function('React', 'Box', 'CircularProgress', 'Typography', 'VideMode', 'index', 'unifiedIndexMap', 'loadPrompt', code + ';return result;')(
        { createElement: (type, props, ...children) => ({ type, props, children }) }, 'box', 'spinner', 'text', VideMode, 1,
        [{ type: 'A', index: 0 }, { type: 'B', index: 0, bIndex: 0 }, { type: 'A', index: 1 }], [false, false, true]);
    assert.equal(render(false), false);
    const displayed = render(true); assert.equal(displayed.props.role, 'status'); assert.equal(displayed.children[0].type, 'spinner');
    assert.equal(displayed.children[1].children[0], 'Preparing Prompt…'); assert.equal(displayed.props.sx.pointerEvents, 'none');
});
