const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const quietConsole = { log() {}, error() {} };

function handler(file, name, bindings) {
    bindings = { ...require('./promptTestBindings.cjs'), ...require('./promptTestBindings.cjs').loadTypeScript('src/imagePromptPacing.ts'), getImagePacingForTarget: () => null, ...bindings };
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    let found;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
        ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(found, `Missing actual ${file} ${name} callback`);
    const code = ts.transpileModule(`const handler = ${found.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(bindings), `${code}\nreturn handler;`)(...Object.values(bindings));
}

function load(file) {
    return require('./promptTestBindings.cjs').loadTypeScript(file);
}

const visual = 'CAMERA:\nLocked close-up.\n\nMOTION:\n@Terra checks the horizon.\n\nAUDIO:\nGentle waves.';
const spoken = '@Terra, white-haired rider (urgent): says "We have a war to fight."';
const charge = { pixels: 1, balance: 99 };
function backendFixture({ output = visual, dialogue = spoken, canCharge = true, dialogueError = false, route = 'GptVideoVisual' } = {}) {
    const modelCalls = [], charges = [], billing = [];
    let response, status = 200;
    const bindings = {
        ...load('server/src/cinemaNarrationDialogue.ts'),
        ...load('server/src/videoCreationContext.ts'),
        logIntentBlueprintUsage() {}, getModelDirective: () => 'CAMERA:\nMOTION:\nAUDIO:\nVOICE & DIALOG:\nCONSTRAINTS:\nMusic: none',
        buildVideoSkillBlock: () => '', VIDEO_AUTO_PROMPT_MODEL: 'fixture-default',
        beginLlmRequest: async (...args) => { charges.push(args); return canCharge ? { model: 'fixture-selected', charge } : null; },
        runBilledLlmOperation: async (llm, operation, work) => {
            assert.equal(operation.stage, 'video_prompt');
            const value = await work();
            billing.push(llm.charge);
            return { value, billing: llm.charge };
        },
        withLlmBilling: async (body, receipt) => { billing.push(receipt); return { ...body, llmBilling: receipt }; },
        generateGPT4oPrompt5B: async (messages, model) => {
            modelCalls.push({ messages, model });
            if (modelCalls.length === 1) return output;
            if (dialogueError) throw new Error('dialogue model unavailable');
            return dialogue;
        },
        console: quietConsole,
    };
    const call = handler('server/src/GptApi.ts', route, bindings);
    const req = { body: { question: 'Terra brings urgent news.', imageDescription: '@Terra sits on a horse.', PlanVid: { characters: [{ name: '@Terra' }] }, duration: 5, targetModel: 'WAN', imageUrl: 'scene.png', ratioKey: 1, creationType: 2 } };
    const res = { status(value) { status = value; return this; }, send(value) { response = value; return this; } };
    return { async run(options = {}) { req.body = { ...req.body, ...options }; await call(req, res); return response; }, modelCalls, charges, billing, get status() { return status; } };
}

test('initial deferred dialogue uses normal two-pass generation with one charge and keeps speech out of the displayed prompt', async () => {
    const fixture = backendFixture({ output: `${visual}\n\nVOICE & DIALOG:\n${spoken}\n\nCONSTRAINTS:\nMusic: none` });
    const response = await fixture.run({ suppressDialogue: true, deferDialogue: true });
    assert.equal(fixture.modelCalls.length, 2);
    assert.equal(fixture.charges.length, 1);
    assert.deepEqual(fixture.billing, [charge]);
    assert.ok(fixture.modelCalls.every(call => call.model === 'fixture-selected'));
    assert.match(response.storyPrompt, /AUDIO:/);
    assert.match(response.storyPrompt, /CONSTRAINTS:\s+Music: none$/);
    assert.doesNotMatch(response.storyPrompt, /VOICE & DIALOG|We have a war to fight/);
    assert.match(response.dialoguePrompt, /^VOICE & DIALOG:/);
    assert.match(response.dialoguePrompt, /We have a war to fight/);
    assert.doesNotMatch(response.dialoguePrompt, /CONSTRAINTS:/);
    assert.equal(response.llmBilling, charge);
    assert.equal(fixture.modelCalls[0].messages[1].content[1].image_url.url, 'scene.png');
});

test('no meaningful generated speech returns an empty optional dialogue section', async () => {
    for (const dialogue of ['No dialogue.', 'VOICE & DIALOG:\nNo dialogue.', '', '   ', 'none', 'N/A']) {
        const fixture = backendFixture({ dialogue });
        const response = await fixture.run({ suppressDialogue: true, deferDialogue: true });
        assert.equal(response.dialoguePrompt, '', JSON.stringify(dialogue));
        assert.doesNotMatch(response.storyPrompt, /VOICE & DIALOG|No dialogue/);
        assert.equal(fixture.charges.length, 1);
    }
});

test('deferred-only requests cannot accidentally put cached speech in the visible prompt', async () => {
    const fixture = backendFixture();
    const response = await fixture.run({ deferDialogue: true });
    assert.doesNotMatch(response.storyPrompt, /VOICE & DIALOG|We have a war to fight/);
    assert.match(response.dialoguePrompt, /We have a war to fight/);
    assert.equal(fixture.modelCalls.length, 2);
});

test('legacy ambient-only requests still skip the dialogue pass and keep positive ambience', async () => {
    const fixture = backendFixture({ output: `${visual.replace('Gentle waves.', 'No speech, avoid music.')}\n\nVOICE & DIALOG:\n${spoken}` });
    const response = await fixture.run({ suppressDialogue: true });
    assert.equal(fixture.modelCalls.length, 1);
    assert.doesNotMatch(response.storyPrompt, /VOICE & DIALOG|We have a war to fight|No speech|avoid music/);
    assert.match(response.storyPrompt, /Soft, scene-aware ambient sound/);
    assert.equal(fixture.charges.length, 1);
});

test('ordinary audio-on Auto Prompt preserves visible speech and the one-charge two-pass path', async () => {
    const fixture = backendFixture();
    const response = await fixture.run({ suppressDialogue: false });
    assert.equal(fixture.modelCalls.length, 2);
    assert.equal(fixture.charges.length, 1);
    assert.match(response.storyPrompt, /VOICE & DIALOG:/);
    assert.match(response.storyPrompt, /We have a war to fight/);
    assert.equal(response.dialoguePrompt, undefined);
    assert.equal(response.llmBilling, charge);
});

test('rejected billing never calls a model and dialogue failure does not begin another charge', async () => {
    const blocked = backendFixture({ canCharge: false });
    assert.equal(await blocked.run({ suppressDialogue: true, deferDialogue: true }), undefined);
    assert.equal(blocked.modelCalls.length, 0);
    assert.equal(blocked.billing.length, 0);
    const failed = backendFixture({ dialogueError: true });
    await failed.run({ suppressDialogue: true, deferDialogue: true });
    assert.equal(failed.charges.length, 1);
    assert.equal(failed.modelCalls.length, 2);
    assert.equal(failed.status, 500);
});

const { normalizeVideoDialogue, insertVideoDialogue, createInitialVideoDialogueCache } = load('src/videoDialogue.ts');
const { buildCinemaDialogueSource, createCinemaDialoguePlanCache } = load('src/cinemaDialogue.ts');
test('Dialogue inserts before existing constraints without replacing current edits, references, or ambience', () => {
    const current = `CAMERA:\nUser chose a tracking shot.\n\nMOTION:\n@Terra signals @Cuzon beside @Scene1.\n\nAUDIO:\nQuiet surf and leather creaks.\n\nCONSTRAINTS:\nMusic: none\nKeep my custom constraint.`;
    const inserted = insertVideoDialogue(current, spoken);
    const prefix = current.slice(0, current.indexOf('CONSTRAINTS:')).trimEnd();
    assert.equal(inserted, `${prefix}\n\nVOICE & DIALOG:\n${spoken}\n\n${current.slice(current.indexOf('CONSTRAINTS:'))}`);
    assert.equal(insertVideoDialogue(inserted, spoken), inserted, 'Repeated click duplicated the section');
    assert.equal(insertVideoDialogue(current, 'No dialogue.'), current);
});

test('existing user-written dialogue is authoritative and prompts without constraints get one section', () => {
    const authored = `MOTION:\nWave.\n\nvoice & dialog:\n@Terra: says "My own line."\n\nCONSTRAINTS:\nMusic: none`;
    assert.equal(insertVideoDialogue(authored, spoken), authored);
    assert.equal(insertVideoDialogue('MOTION:\nWave.', 'VOICE & DIALOG:\n' + spoken), `MOTION:\nWave.\n\nVOICE & DIALOG:\n${spoken}`);
    for (const none of ['', ' ', 'No dialogue.', 'VOICE & DIALOG: No dialogue.', 'none', 'N/A']) assert.equal(normalizeVideoDialogue(none), '');
});

test('initial dialogue belongs to its own scene and is consumed exactly once', () => {
    const cache = createInitialVideoDialogueCache();
    const first = cache.begin('A:0'), second = cache.begin('A:1');
    assert.equal(cache.store(first, spoken), true);
    assert.equal(cache.store(second, '@Casey: says "Nice."'), true);
    assert.equal(cache.take('A:0'), `VOICE & DIALOG:\n${spoken}`);
    assert.equal(cache.take('A:0'), '');
    assert.equal(cache.get('A:1'), 'VOICE & DIALOG:\n@Casey: says "Nice."');
    assert.equal(cache.store(first, spoken), false, 'A consumed response could restore the button');
});

test('regeneration and AI edits invalidate queued and in-flight dialogue even when their requests fail', () => {
    const cache = createInitialVideoDialogueCache();
    const inFlight = cache.begin('A:0'), queued = cache.begin('A:1'), unaffected = cache.begin('A:2');
    assert.equal(cache.store(unaffected, '@Rita: says "Ready."'), true);
    cache.invalidate('A:0'); // Auto Prompt begins, then fails.
    cache.invalidate('A:1'); // Update with AI begins before the initial serial batch reaches it.
    assert.equal(cache.store(inFlight, spoken), false);
    assert.equal(cache.store(queued, spoken), false);
    assert.equal(cache.get('A:0'), '');
    assert.equal(cache.get('A:1'), '');
    assert.equal(cache.get('A:2'), 'VOICE & DIALOG:\n@Rita: says "Ready."');
});

test('a changed plan rejects old responses even when it reuses the same scene key', () => {
    const cache = createInitialVideoDialogueCache();
    const old = cache.begin('A:0');
    cache.store(old, spoken);
    cache.reset();
    const next = cache.begin('A:0');
    assert.equal(cache.store(old, 'stale'), false);
    assert.equal(cache.get('A:0'), '');
    assert.equal(cache.store(next, spoken), true);
    assert.equal(cache.store(cache.begin('A:1'), 'No dialogue.'), false);
    assert.equal(cache.get('A:1'), '');
});

function frontendFixture({ audio = true, prompts = ['', '', ''], respond, pageType = 2, narration } = {}) {
    const map = [{ type: 'A', index: 0, originalIndex: 0 }, { type: 'B', index: 0, originalIndex: 1 }, { type: 'A', index: 1, originalIndex: 2 }];
    const cache = createInitialVideoDialogueCache(), calls = [], committed = [], drafts = [], bills = [], errors = [], versions = new Map();
    const promptValues = [...prompts], loader = { value: [] }, redraws = [];
    const targetKey = target => `${target.type}:${target.index}`;
    const resolve = target => map.find(item => item.type === target.type && item.index === target.index)?.originalIndex ?? -1;
    const capture = (sceneIndex = 0) => { const found = map[sceneIndex]; return { type: found.type, index: found.index }; };
    const bindings = {
        settextVidUpdate() {}, videModel: 'WAN', musicKling: audio,
        unifiedIndexMapRef: { current: map }, PlanVid: { storyContext: 'The heroes prepare.' }, TextVideo: promptValues,
        ImagesHdCloud: ['terra.png', 'detail.png', 'casey.png'], autoPromptBatchPlanRef: { current: null },
        manualOnlyVideoPrompts: false, initialAutoPromptEnabledRef: { current: true },
        autoPromptLoadingTargetsRef: { current: new Map() }, retainedAutoPromptResultsRef: { current: new Map() },
        dirtyVideoPromptScenesRef: { current: new Set() },
        captureSceneTarget: capture, getSceneTargetKey: targetKey, resolveSceneTargetIndex: resolve,
        resolveVideoPromptForTarget: target => String(promptValues[resolve(target)] || ''),
        initialDialogueCacheRef: { current: cache }, cinemaDialoguePlanCacheRef: { current: createCinemaDialoguePlanCache() },
        initialCinemaDialogueSourcesRef: { current: new Map() }, refreshInitialDialogue: updater => redraws.push(updater(0)),
        beginSceneRequest: (channel, target) => { const key = `${targetKey(target)}:${channel}`, version = (versions.get(key) || 0) + 1; versions.set(key, version); return { target, requestKey: key, version }; },
        isLatestSceneRequest: request => versions.get(request.requestKey) === request.version,
        setloadPrompt: updater => { loader.value = updater(loader.value); },
        sceneSourceDataRef: { current: { GeneratedText: ['@Terra on horseback.', 'Horse detail.', '@Casey on the beach.'], GeneratedTextx: [], steps: ['Terra arrives.', 'Detail.', 'Casey reacts.'], stepsx: ['Terra arrives.', 'Casey reacts.'], steps2: narration === undefined ? [] : [narration], ImagesHdCloud: ['terra.png', 'detail.png', 'casey.png'], noImagePrompt: [], TextVideo: promptValues } },
        stepsx: ['Terra arrives.', 'Casey reacts.'], prompt: 'All seven heroes.', time: 5, ratioKey: 1, pageType, languageModel: 'standard',
        getSceneIntentForTarget: target => ({ syncStatus: 'ready', sceneId: targetKey(target), revision: 1 }),
        CLIK_URL: '/api', dispatch() {},
        axios: { post: async (url, body, config) => { calls.push({ url, body, config }); return respond ? respond(url, body, config, calls.length) : { data: { storyPrompt: `${visual}\n\nCONSTRAINTS:\nMusic: none`, dialoguePrompt: spoken, llmBilling: charge } }; } },
        applyLlmBilling: (_, body) => bills.push(body), applyLlmBillingError: () => '',
        globalErrorEmitter: { emit: (...args) => errors.push(args) }, console: quietConsole,
        withPromptWriteSource: (_, work) => work(),
        commitVideoPromptToScene: (target, text) => { committed.push({ target, text }); promptValues[resolve(target)] = text; },
        setVideoPromptDraftForTarget: (target, text, dirty) => { drafts.push({ target, text, dirty }); promptValues[resolve(target)] = text; },
        EditGeneratedVisualTextOnlyFn: () => assert.fail('Unexpected second AI edit'),
    };
    bindings.buildCinemaDialogueSource = buildCinemaDialogueSource;
    bindings.initialAutoPromptContextRef = { current: { PlanVid: bindings.PlanVid, aSceneTopologyVersion: 0, PostId: 4, pageType } };
    bindings.syncAutoPromptLoading = handler('src/EditStory.tsx', 'syncAutoPromptLoading', bindings);
    bindings.cinemaDialogueConfigRef = { current: { pageType, time: bindings.time, PlanVid: bindings.PlanVid, prompt: bindings.prompt, languageModel: bindings.languageModel, getSceneIntentForTarget: bindings.getSceneIntentForTarget } };
    bindings.getCinemaDialogueSource = handler('src/EditStory.tsx', 'getCinemaDialogueSource', bindings);
    bindings.invalidateInitialDialogue = handler('src/EditStory.tsx', 'invalidateInitialDialogue', bindings);
    const auto = handler('src/EditStory.tsx', 'fetchAndGenerateImage', bindings);
    function insertion(sceneIndex, currentDraft, audioEnabled = audio) {
        return handler('src/EditStory.tsx', 'handleInsertInitialDialogue', {
            ...bindings, index: sceneIndex, generatedVideoAudioRef: { current: audioEnabled },
            insertVideoDialogue, resolveVideoPromptForTarget: () => currentDraft,
            axios: { post: () => assert.fail('Dialogue click sent a new AI request') },
        });
    }
    function update(sceneIndex, responder) {
        return handler('src/EditStory.tsx', 'EditGeneratedVisualTextOnlyFn', {
            ...bindings, index: sceneIndex, setloadersPrompt: updater => { loader.value = updater(loader.value); },
            GeneratedText: bindings.sceneSourceDataRef.current.GeneratedText, steps: bindings.sceneSourceDataRef.current.steps,
            isSpatialInteraction: false, spatialActionMode: false, spatialVideoGenerationMode: false,
            alert: message => errors.push([message]),
            axios: { post: responder || (async () => { throw new Error('AI edit unavailable'); }) },
        });
    }
    return { auto, insertion, update, bindings, cache, calls, committed, drafts, bills, errors, loader, promptValues, redraws };
}

test('actual initial batch separates every A scene cache, preserves image/intent inputs and per-operation billing', async () => {
    const fixture = frontendFixture();
    await fixture.auto(0, '', 0, 'WAN', true);
    assert.equal(fixture.calls.length, 2, 'B shots must not get automatic dialogue calls');
    assert.deepEqual(fixture.calls.map(call => call.body.imageUrl), ['terra.png', 'casey.png']);
    assert.deepEqual(fixture.calls.map(call => call.body.sceneIntent.sceneId), ['A:0', 'A:1']);
    assert.deepEqual(fixture.calls.map(call => call.body.llmBatchContinuation), [false, false]);
    assert.equal(new Set(fixture.calls.map(call => call.body.promptOperationId)).size, 2,
        'Each scene owns a distinct retry-safe prompt operation, rather than a skipped batch continuation charge');
    assert.ok(fixture.calls.every(call => call.url === '/api/VideoDesign' && call.body.suppressDialogue === true && call.body.deferDialogue === true));
    assert.ok(fixture.calls.every(call => call.config.withCredentials && call.body.duration === 5 && call.body.llmTier === 'standard'));
    assert.deepEqual(fixture.committed.map(entry => entry.target), [{ type: 'A', index: 0 }, { type: 'A', index: 1 }]);
    assert.ok(fixture.committed.every(entry => !entry.text.includes('VOICE & DIALOG')));
    assert.match(fixture.cache.get('A:0'), /We have a war to fight/);
    assert.match(fixture.cache.get('A:1'), /We have a war to fight/);
    assert.equal(fixture.cache.get('B:0'), '');
    assert.equal(fixture.bills.length, 2);
    assert.deepEqual(fixture.loader.value, [false, false, false]);
});

test('actual Dialogue click uses the latest edited prompt, updates only its scene and never calls AI', async () => {
    const fixture = frontendFixture();
    await fixture.auto(0, '', 0, 'WAN', true);
    const currentDraft = 'MOTION:\nUser-added close-up of @Casey.\n\nCONSTRAINTS:\nMusic: none';
    const click = fixture.insertion(2, currentDraft);
    click();
    assert.equal(fixture.cache.get('A:1'), '');
    assert.match(fixture.cache.get('A:0'), /We have a war to fight/);
    const last = fixture.committed.at(-1);
    assert.deepEqual(last.target, { type: 'A', index: 1 });
    assert.equal(last.text, insertVideoDialogue(currentDraft, spoken));
    assert.equal(fixture.drafts.at(-1).dirty, true, 'Inserted dialogue must survive draft synchronization');
    const count = fixture.committed.length;
    click();
    assert.equal(fixture.committed.length, count);
    assert.equal(fixture.calls.length, 2);
});

test('audio off blocks cached insertion while normal later Auto Prompts use their audio route', async () => {
    const held = frontendFixture();
    await held.auto(0, '', 0, 'WAN', true);
    const count = held.committed.length;
    held.insertion(0, 'MOTION:\nWave.', false)();
    assert.equal(held.committed.length, count);
    assert.match(held.cache.get('A:0'), /We have a war to fight/);
    for (const audio of [true, false]) {
        const fixture = frontendFixture({ audio, prompts: ['Existing A prompt', '', 'Existing second prompt'] });
        const token = fixture.cache.begin('A:0'); fixture.cache.store(token, spoken);
        await fixture.auto(0, '', 0);
        assert.equal(fixture.cache.get('A:0'), '');
        assert.equal(fixture.calls.length, 1);
        assert.equal(fixture.calls[0].url, audio ? '/api/VideoDesign' : '/api/GptVideoVisualMiniMax');
        assert.equal(fixture.calls[0].body.deferDialogue, false);
        assert.equal(fixture.calls[0].body.suppressDialogue, false);
    }
});

test('manual Auto Prompt clears cached dialogue before waiting, including failed requests', async () => {
    let reject;
    const pending = new Promise((_, rejectPromise) => { reject = rejectPromise; });
    const fixture = frontendFixture({ prompts: ['Existing prompt', '', 'Second prompt'], respond: () => pending });
    fixture.cache.store(fixture.cache.begin('A:0'), spoken);
    fixture.cache.store(fixture.cache.begin('A:1'), spoken);
    const operation = fixture.auto(0, '', 0);
    assert.equal(fixture.cache.get('A:0'), '');
    assert.match(fixture.cache.get('A:1'), /We have a war to fight/);
    reject(new Error('Network failed')); await operation;
    assert.equal(fixture.cache.get('A:0'), '');
    assert.equal(fixture.loader.value[0], false);
});

test('actual Update with AI clears cache before any request or validation and failures cannot restore it', async () => {
    let reject;
    const pending = new Promise((_, rejectPromise) => { reject = rejectPromise; });
    const fixture = frontendFixture({ prompts: ['Current prompt', '', 'Other prompt'] });
    const token = fixture.cache.begin('A:0'); fixture.cache.store(token, spoken);
    fixture.cache.store(fixture.cache.begin('A:1'), spoken);
    const update = fixture.update(0, () => pending);
    const operation = update(0, 'Make the sky purple.', 'Current prompt', 1);
    assert.equal(fixture.cache.get('A:0'), '');
    reject(new Error('Update failed')); assert.equal(await operation, null);
    assert.equal(fixture.cache.store(token, spoken), false);
    assert.match(fixture.cache.get('A:1'), /We have a war to fight/);
    fixture.cache.store(fixture.cache.begin('A:0'), spoken);
    assert.equal(await fixture.update(0)(0, '', 'Current prompt', 1), null);
    assert.equal(fixture.cache.get('A:0'), '');
});

test('AI edits reject an old in-flight initial response and skip another already-edited queued scene', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const fixture = frontendFixture({ respond: () => pending });
    const batch = fixture.auto(0, '', 0, 'WAN', true);
    assert.equal(fixture.calls.length, 1);
    await fixture.update(0)(0, 'Different action.', 'Current prompt', 1);
    await fixture.update(2)(2, 'Make it rain.', 'Second prompt', 1);
    release({ data: { storyPrompt: 'Old visual prompt', dialoguePrompt: spoken, llmBilling: charge } });
    await batch;
    assert.equal(fixture.calls.length, 1, 'Queued edited scene was still auto-prompted');
    assert.equal(fixture.committed.length, 0, 'Old initial response overwrote the user edit');
    assert.equal(fixture.cache.get('A:0'), '');
    assert.equal(fixture.cache.get('A:1'), '');
    assert.equal(fixture.bills.length, 1, 'Superseded request billing must still synchronize');
    assert.equal(fixture.loader.value[0], false);
});

test('a failed first initial scene does not make the remaining scene a free continuation', async () => {
    const fixture = frontendFixture({ respond: async (_, __, ___, count) => {
        if (count === 1) throw new Error('Insufficient pixels');
        return { data: { storyPrompt: visual, dialoguePrompt: spoken, llmBilling: charge } };
    } });
    await fixture.auto(0, '', 0, 'WAN', true);
    assert.deepEqual(fixture.calls.map(call => call.body.llmBatchContinuation), [false, false]);
    assert.equal(fixture.cache.get('A:0'), '');
    assert.match(fixture.cache.get('A:1'), /We have a war to fight/);
});

const originalCinemaNarration = { text: '[calmly] Almost there. I am calibrating the engine now. [short pause] Just one more adjustment. It is not fully stable yet.', prompt: 'Cuzon, the calm pilot, speaks while calibrating.' };
const cinemaPlan = { stageA: '@Terra: says "Almost there. I am calibrating the engine."', stageB: '@Casey: says "One more adjustment. It is not fully stable yet."' };
const cinemaResponse = (_, body) => ({ data: {
    storyPrompt: `${visual}\n\nCONSTRAINTS:\nMusic: none`,
    dialoguePrompt: `VOICE & DIALOG:\n${body.cinemaNarration?.stage === 'B' ? cinemaPlan.stageB : cinemaPlan.stageA}`,
    cinemaDialoguePlan: cinemaPlan, llmBilling: charge,
} });

test('actual Cinema initial batch allocates one original narration across both native A slots and reuses the pair plan', async () => {
    const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration, respond: cinemaResponse });
    await fixture.auto(0, '', 0, 'WAN', true);
    assert.equal(fixture.calls.length, 2);
    const [first, second] = fixture.calls.map(call => call.body);
    assert.equal(first.cinemaNarration.text, originalCinemaNarration.text);
    assert.equal(first.cinemaNarration.delivery, originalCinemaNarration.prompt);
    assert.deepEqual(first.cinemaNarration.stages.map(stage => stage.imageDescription), ['@Terra on horseback.', '@Casey on the beach.']);
    assert.deepEqual(first.cinemaNarration.stages.map(stage => stage.duration), [5, 5]);
    assert.equal(first.cinemaNarration.stage, 'A');
    assert.equal(first.cinemaDialoguePlan, undefined);
    assert.equal(second.cinemaNarration.stage, 'B');
    assert.deepEqual(second.cinemaDialoguePlan, cinemaPlan);
    assert.deepEqual([first.sceneNumber, second.sceneNumber], [1, 1]);
    assert.deepEqual([first.sceneStage, second.sceneStage], ['A', 'B']);
    assert.match(fixture.cache.get('A:0'), /calibrating the engine/);
    assert.match(fixture.cache.get('A:1'), /not fully stable/);
    assert.ok(fixture.committed.every(entry => !entry.text.includes('VOICE & DIALOG')));
    assert.equal(fixture.cache.get('B:0'), '');
});

test('manual Cinema Auto Prompt at ten seconds replans from full original text and subsequent paired requests reuse that duration', async () => {
    const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration, respond: cinemaResponse });
    await fixture.auto(0, '', 0, 'WAN', true);
    fixture.bindings.cinemaDialogueConfigRef.current.time = 10;
    await fixture.auto(2, '', 0);
    const longer = fixture.calls.at(-1).body;
    assert.equal(longer.duration, 10);
    assert.equal(longer.cinemaNarration.text, originalCinemaNarration.text);
    assert.deepEqual(longer.cinemaNarration.stages.map(stage => stage.duration), [10, 10]);
    assert.equal(longer.cinemaDialoguePlan, undefined, 'Five-second lines cannot supply the ten-second rewrite');
    await fixture.auto(0, '', 0);
    assert.deepEqual(fixture.calls.at(-1).body.cinemaDialoguePlan, cinemaPlan);
});

test('changing the reasoning model replans Cinema speech from the original while the paired stage reuses the new tier allocation', async () => {
    const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration, respond: cinemaResponse });
    await fixture.auto(0, '', 0, 'WAN', true);
    fixture.bindings.cinemaDialogueConfigRef.current.languageModel = 'terra';
    await fixture.auto(0, '', 0);
    const regenerated = fixture.calls.at(-1).body;
    assert.equal(regenerated.llmTier, 'terra');
    assert.equal(regenerated.cinemaNarration.text, originalCinemaNarration.text);
    assert.equal(regenerated.cinemaDialoguePlan, undefined, 'A previous model allocation cannot bypass the selected model speech writer');
    assert.deepEqual(regenerated.cinemaNarration.stages.map(stage => stage.duration), [5, 5]);
    await fixture.auto(2, '', 0);
    assert.equal(fixture.calls.at(-1).body.llmTier, 'terra');
    assert.deepEqual(fixture.calls.at(-1).body.cinemaDialoguePlan, cinemaPlan);
});

const visibleCinemaResponse = body => ({ data: {
    storyPrompt: `${visual}\n\nVOICE & DIALOG:\n${body.cinemaNarration.stage === 'A' ? cinemaPlan.stageA : cinemaPlan.stageB}\n\nCONSTRAINTS:\nMusic: none`,
    cinemaDialoguePlan: cinemaPlan, llmBilling: charge,
} });

test('concurrent uncached Cinema A/B Auto Prompts wait for one speech plan and retain each stage line', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let speechWriters = 0;
    const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration,
        prompts: ['Current A prompt', '', 'Current B prompt'], respond: (_, body, __, count) => {
            if (!body.cinemaDialoguePlan) speechWriters++;
            return count === 1 ? pending : visibleCinemaResponse(body);
        } });
    fixture.bindings.cinemaDialogueConfigRef.current.time = 10;
    fixture.bindings.cinemaDialogueConfigRef.current.languageModel = 'terra';
    const first = fixture.auto(0, '', 0);
    const second = fixture.auto(2, '', 0);
    assert.equal(fixture.calls.length, 1, 'The second stage started another request before the pair was ready');
    const firstBody = fixture.calls[0].body;
    assert.equal(firstBody.duration, 10);
    assert.equal(firstBody.llmTier, 'terra');
    assert.equal(firstBody.cinemaNarration.text, originalCinemaNarration.text);
    release(visibleCinemaResponse(firstBody));
    await Promise.all([first, second]);
    assert.equal(fixture.calls.length, 2);
    assert.equal(speechWriters, 1);
    assert.deepEqual(fixture.calls[1].body.cinemaDialoguePlan, cinemaPlan);
    assert.deepEqual(fixture.committed.map(entry => entry.target.index), [0, 1]);
    assert.match(fixture.committed[0].text, /calibrating the engine/);
    assert.doesNotMatch(fixture.committed[0].text, /not fully stable/);
    assert.match(fixture.committed[1].text, /not fully stable/);
    assert.doesNotMatch(fixture.committed[1].text, /calibrating the engine/);
    assert.equal(fixture.loader.value[0], false);
    assert.equal(fixture.loader.value[2], false);
});

test('failed Cinema pair preparation releases the waiting stage to retry without hanging', async () => {
    let reject;
    const pending = new Promise((_, rejectPromise) => { reject = rejectPromise; });
    const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration,
        prompts: ['Current A prompt', '', 'Current B prompt'], respond: (_, body, __, count) => count === 1 ? pending : visibleCinemaResponse(body) });
    const first = fixture.auto(0, '', 0), second = fixture.auto(2, '', 0);
    assert.equal(fixture.calls.length, 1);
    reject(new Error('First pair request failed'));
    await Promise.all([first, second]);
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.calls[1].body.cinemaDialoguePlan, undefined);
    assert.equal(fixture.committed.length, 1);
    assert.equal(fixture.committed[0].target.index, 1);
    assert.match(fixture.committed[0].text, /not fully stable/);
    assert.match(fixture.errors[0][0], /First pair request failed/);
    assert.equal(fixture.loader.value[0], false);
    assert.equal(fixture.loader.value[2], false);
});

test('reset releases a queued Cinema request before any charge and permits a fresh owner while the old request finishes', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration,
        prompts: ['Current A prompt', '', 'Current B prompt'], respond: (_, body, __, count) => count === 1 ? pending : visibleCinemaResponse(body) });
    const first = fixture.auto(0, '', 0), second = fixture.auto(2, '', 0);
    const firstBody = fixture.calls[0].body;
    fixture.bindings.cinemaDialoguePlanCacheRef.current.reset();
    await second;
    assert.equal(fixture.calls.length, 1, 'The stale waiter made a charged request after reset');
    assert.equal(fixture.loader.value[2], false);
    await fixture.auto(2, '', 0);
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.calls[1].body.cinemaDialoguePlan, undefined);
    release(visibleCinemaResponse(firstBody));
    await first;
    assert.equal(fixture.committed.length, 1, 'Old response overwrote the current creation');
    assert.equal(fixture.committed[0].target.index, 1);
    assert.match(fixture.committed[0].text, /not fully stable/);
    assert.equal(fixture.bills.length, 2, 'Already charged responses must still synchronize balances');
});

test('Cinema Dialogue insertion rejects an old cached summary after narration, duration or either source image changes', async () => {
    for (const change of [
        fixture => { fixture.bindings.cinemaDialogueConfigRef.current.time = 10; },
        fixture => { fixture.bindings.cinemaDialogueConfigRef.current.languageModel = 'terra'; },
        fixture => { fixture.bindings.sceneSourceDataRef.current.steps2[0] = { ...originalCinemaNarration, text: 'Changed story.' }; },
        fixture => { fixture.bindings.sceneSourceDataRef.current.GeneratedText[2] = '@Casey now alone elsewhere.'; },
        fixture => { fixture.bindings.sceneSourceDataRef.current.ImagesHdCloud[0] = 'replacement.png'; },
    ]) {
        const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration, respond: cinemaResponse });
        await fixture.auto(0, '', 0, 'WAN', true);
        const count = fixture.committed.length;
        change(fixture);
        fixture.insertion(0, 'MOTION:\nCurrent edits.\n\nCONSTRAINTS:\nMusic: none')();
        assert.equal(fixture.committed.length, count);
        assert.equal(fixture.calls.length, 2, 'A stale Dialogue click must never generate replacement lines');
    }
});

test('Cinema responses from an old narration or duration cannot overwrite current prompts but still synchronize billing', async () => {
    for (const change of [
        fixture => { fixture.bindings.cinemaDialogueConfigRef.current.time = 10; },
        fixture => { fixture.bindings.cinemaDialogueConfigRef.current.languageModel = 'terra'; },
        fixture => { fixture.bindings.sceneSourceDataRef.current.steps2[0] = 'New narration after request start.'; },
        fixture => { fixture.bindings.cinemaDialoguePlanCacheRef.current.reset(); },
    ]) {
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        const fixture = frontendFixture({ pageType: 1, narration: originalCinemaNarration,
            prompts: ['User visual edit', '', 'Second visual edit'], respond: () => pending });
        const operation = fixture.auto(0, '', 0);
        const requested = fixture.calls[0].body;
        change(fixture);
        release(cinemaResponse('', requested));
        await operation;
        assert.equal(fixture.committed.length, 0);
        assert.equal(fixture.promptValues[0], 'User visual edit');
        assert.equal(fixture.bills.length, 1);
        assert.equal(fixture.loader.value[0], false);
    }
});

test('other modes retain scene-created dialogue and audio-off Cinema sends no narration or speech plan', async () => {
    for (const pageType of [0, 2, 3]) {
        const fixture = frontendFixture({ pageType, narration: originalCinemaNarration });
        await fixture.auto(0, '', 0, 'WAN', true);
        assert.ok(fixture.calls.every(call => call.body.cinemaNarration === undefined && call.body.cinemaDialoguePlan === undefined));
        assert.deepEqual(fixture.calls.map(call => call.body.sceneNumber), [1, 2]);
        assert.ok(fixture.calls.every(call => call.body.sceneStage === undefined));
    }
    const silent = frontendFixture({ pageType: 1, audio: false, narration: originalCinemaNarration });
    await silent.auto(0, '', 0, 'WAN', true);
    assert.ok(silent.calls.every(call => call.url === '/api/GptVideoVisualMiniMax' && call.body.cinemaNarration === undefined));
});

test('the actual Dialogue button is optional, uses the app accent foreground, and sits on the field border', () => {
    const source = ts.createSourceFile('EditStory.tsx', fs.readFileSync(path.join(root, 'src/EditStory.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let button;
    const visit = node => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Button' && node.children.some(child => ts.isJsxText(child) && child.text.trim() === 'Dialogue')) button = node;
        ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(button);
    let conditional = button.parent;
    while (conditional && !ts.isJsxExpression(conditional)) conditional = conditional.parent;
    assert.ok(conditional);
    const code = ts.transpileModule(`const result = ${conditional.expression.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
    const { appAccentButtonSx } = load('src/appAccentStyles.ts');
    function render(audio, cached, dark) {
        let clicks = 0;
        const bindings = { React: { createElement: (type, props, ...children) => ({ type, props, children }) }, Button: 'button', cb: () => ({}), musicKling: audio, pendingInitialDialogue: cached,
            appAccentButtonSx, appColor: '#F54387', darkModeReducer: dark, handleInsertInitialDialogue: () => { clicks++; } };
        const element = new Function(...Object.keys(bindings), `${code}\nreturn result;`)(...Object.values(bindings));
        return { element, get clicks() { return clicks; } };
    }
    assert.ok(!render(false, spoken, false).element);
    assert.ok(!render(true, '', false).element);
    for (const dark of [true, false]) {
        const rendered = render(true, spoken, dark), { props, children } = rendered.element;
        assert.equal(children.join('').trim(), 'Dialogue');
        assert.equal(props.sx.bgcolor, '#F54387');
        assert.equal(props.sx.color, dark ? '#000' : '#fff');
        assert.equal(props.sx.position, 'absolute');
        assert.equal(props.sx.top, 0);
        assert.equal(props.sx.transform, 'translateY(-50%)');
        assert.equal(props.sx.textTransform, 'none');
        let stopped = false;
        props.onClick({ stopPropagation() { stopped = true; } });
        assert.equal(stopped, true); assert.equal(rendered.clicks, 1);
    }
});


test('automatic entry without PlanVid prepares only empty A scenes and sends four distinct story inputs', async () => {
    const fixture = frontendFixture({ audio: false, prompts: ['Keep my existing prompt', '', ''] });
    fixture.bindings.PlanVid = null;
    fixture.bindings.initialAutoPromptContextRef.current.PlanVid = null;
    const auto = handler('src/EditStory.tsx', 'fetchAndGenerateImage', fixture.bindings);
    await auto(2, '', 0, 'SeedanceMini', true);
    assert.equal(fixture.calls.length, 1);
    const body = fixture.calls[0].body;
    assert.equal(body.targetModel, 'SeedanceMini');
    assert.equal(body.groundTruthAction, 'Casey reacts.');
    assert.equal(body.firstFramePrompt, '@Casey on the beach.');
    assert.equal(body.scene.number, 2); assert.equal(body.scene.duration, 5);
    assert.equal(body.sceneIntent.sceneId, 'A:1');
    assert.equal(body.PlanVid.storyContext, 'Casey reacts.');
    assert.ok(!fixture.committed.some(entry => entry.target.index === 0));
});

test('empty selected scenes can auto-prompt after the initial batch without overwriting a user draft', async () => {
    const fixture = frontendFixture({ audio: false });
    await fixture.auto(0, '', 0, 'SeedanceMini', true);
    assert.equal(fixture.calls.length, 2);
    fixture.promptValues[2] = '';
    await fixture.auto(2, '', 0, 'SeedanceMini', true);
    assert.equal(fixture.calls.length, 3);
    fixture.promptValues[2] = '';
    fixture.bindings.dirtyVideoPromptScenesRef.current.add('A:1');
    await fixture.auto(2, '', 0, 'SeedanceMini', true);
    assert.equal(fixture.calls.length, 3);
});


for (const route of ['GptVideoVisual', 'GptVideoVisualMiniMax']) {
    test(`${route} labels existing scene inputs, forwards the handoff, and uses one visual model call`, async () => {
        const fixture = backendFixture({ route });
        const scene = { number: 1, duration: 5 };
        const sceneIntent = { text: 'Current scene purpose and continuity.' };
        const groundTruthAction = 'Current scene ordered developments.';
        const firstFramePrompt = 'Current scene opening physical state.';
        const handoff = 'The required developments remain pending.';
        const originalVisual = 'Original unpaced visual conception.';
        await fixture.run({ suppressDialogue: true, scene, sceneIntent, groundTruthAction,
            firstFramePrompt, imagePacingHandoff: handoff, imageDescription: originalVisual,
            PlanVid: { characters: [], storyContext: 'Whole-story overview including other scenes.' } });
        assert.equal(fixture.status, 200);
        assert.equal(fixture.modelCalls.length, 1);
        const messages = fixture.modelCalls[0].messages;
        const system = messages.filter(message => message.role === 'system').map(message => message.content).join('\n');
        assert.doesNotMatch(system, /THE ABSOLUTE VISUAL GROUND TRUTH|Only animate characters or elements explicitly present|never use it to add anything absent|SILENT OMISSION/);
        const labelled = messages.find(message => typeof message.content === 'string' && message.content.startsWith('\nVIDEO SCENE CONTRACT:'));
        assert.ok(labelled);
        const contract = JSON.parse(labelled.content.slice(labelled.content.indexOf('{')));
        assert.deepEqual(contract, { scene, sceneIntent, groundTruthAction, firstFramePrompt, imagePacingHandoff: handoff });
        const sceneMessage = messages.find(message => Array.isArray(message.content));
        const text = sceneMessage.content.find(part => part.type === 'text').text;
        assert.ok(text.includes('Global Plan Overview (supporting context for the whole story; other scenes are outside this clip):'));
        assert.ok(text.includes(originalVisual));
        assert.ok(!text.includes('PlanVid (ground truth):'));
    });
}
