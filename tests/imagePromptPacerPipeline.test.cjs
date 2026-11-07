const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

function fixture({ pair = false, afford = true, originalGate, rawOriginal, pacedOutput } = {}) {
  const events = [], requests = [], operations = [], paid = [], preflights = [];
  const camera = 'SHARED OPTICAL DIRECTIVE: specific optics, purposeful framing and lighting.';
  let workflow = 'EXACT CREATION WORKFLOW: original prompt, pacing, preview, render, video handoff.';
  const llm = { model: 'gpt-6-luna', inference: { reasoning_effort: 'low', max_completion_tokens: 32000 }, charge: { pixels: 1 } };
  const pipeline = load('server/src/initialImagePromptPipeline.ts', {
    './creationWorkflowKnowledge': { getImagePacerWorkflowKnowledge: async () => workflow },
    './llmBilling': {
      beginLlmRequest: async (_req, _res, _fallback, options) => {
        preflights.push(options); return afford ? llm : null;
      },
      runBilledLlmOperation: async (selected, descriptor, work) => {
        assert.equal(selected, llm); operations.push(descriptor); events.push(descriptor.stage + ':begin');
        const value = await work();
        paid.push(descriptor.actionLabel); events.push(descriptor.stage + ':charged');
        return { value, billing: { tier: 'luna', pixelsCharged: 1, pixels: 20 - paid.length } };
      },
      mergeLlmBilling: receipts => ({ pixelsCharged: receipts.reduce((sum, receipt) => sum + receipt.pixelsCharged, 0), pixels: receipts.at(-1).pixels }),
    },
  });
  const source = 'Exact authored full scene. ' + 'Detailed intended relationships and chronology. '.repeat(80) + 'SOURCE TAIL MUST SURVIVE @later';
  const scenes = pair ? [
    { id: 'A', fullScene: source, sceneIntent: { text: 'Stage A understanding', stage: 'A' } },
    { id: 'B', fullScene: source + ' COMPLETE SECOND STAGE.', sceneIntent: { text: 'Stage B understanding', stage: 'B' } },
  ] : [{ id: 'scene', fullScene: source, sceneIntent: { text: 'Complete current scene intent' } }];
  const originals = pair ? ['Original A @driver @prop, deliberate optics.', 'Original B @other, distinct authored treatment.']
    : ['Original full-scene @driver @prop, deliberate optics.'];
  const context = {
    globalIntent: { overview: 'Complete creation purpose and emotional intention', userGoal: 'Actual user goal' },
    initialPlan: { prompt_summary: 'Full project brief', art_style: { style_token: 'Anime' },
      video_context: { global: 'Preserved explicit event relationships', scenes: [{ scene: 1, instructions: 'Specific scene direction' }] } },
    outputContext: { ratio: '16:9', intendedResult: 'User-defined contextual purpose' },
    referenceContext: [{ name: 'driver', description: 'Canonical identity description' }],
  };
  const config = {
    fallbackModel: 'unused', cameraLanguage: camera,
    baseMessages: [{ role: 'system', content: camera }, { role: 'user', content: source }],
    scenes, context,
    parseOriginal: raw => String(raw).split('---STAGE2---'),
    generate: async (messages, model, inference) => {
      const request = { messages, model, inference }; requests.push(request);
      events.push(requests.length === 1 ? 'base:provider' : 'pacer:provider');
      if (requests.length === 1) {
        if (originalGate) await originalGate;
        return rawOriginal === undefined ? originals.join('---STAGE2---') : rawOriginal;
      }
      const images = scenes.map((scene, index) => ({ id: scene.id,
        pacedImagePrompt: `Paced ${scene.id} ${originals[index]} Anime art style`, handoff: `Selection explanation for ${scene.id}` }));
      return pacedOutput ? pacedOutput(images) : JSON.stringify({ images });
    },
  };
  return { ...pipeline, config, camera, llm, scenes, originals, context, requests, events, operations, paid, preflights,
    req: { body: { promptOperationId: 'stable-client-operation' } }, res: {}, setWorkflow: value => { workflow = value; } };
}

test('first automatic preparation waits for the base writer, then paces using the same selected model/profile and complete context', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({ originalGate: gate });
  const pending = f.prepareInitialImagePrompts(f.req, f.res, f.config);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, 1, 'pacing must not run ahead of the original writer');
  release();
  const result = await pending;
  assert.equal(f.requests.length, 2);
  for (const request of f.requests) {
    assert.equal(request.model, f.llm.model);
    assert.deepEqual(request.inference, f.llm.inference);
  }
  assert.deepEqual(f.events, ['image_prompt:begin', 'base:provider', 'image_prompt:charged',
    'image_prompt_pacer:begin', 'pacer:provider', 'image_prompt_pacer:charged']);
  const system = f.requests[1].messages.find(message => message.role === 'system').content;
  assert.ok(system.includes(f.camera)); assert.ok(system.includes('EXACT CREATION WORKFLOW'));
  const payload = JSON.parse(f.requests[1].messages.find(message => message.role === 'user').content);
  assert.equal(payload.images[0].fullScene, f.scenes[0].fullScene);
  assert.ok(payload.images[0].fullScene.endsWith('SOURCE TAIL MUST SURVIVE @later'));
  assert.deepEqual(payload.images[0].sceneIntent, f.scenes[0].sceneIntent);
  assert.equal(payload.images[0].originalImagePrompt, f.originals[0]);
  assert.deepEqual(payload.creationContext, f.context);
  assert.equal(result.images[0].originalImagePrompt, f.originals[0]);
  assert.equal(result.images[0].fullScene, f.scenes[0].fullScene);
  assert.equal(result.images[0].version, 1);
  assert.ok(result.images[0].pacedImagePrompt.startsWith('Paced scene'));
  assert.equal(result.images[0].handoff, 'Selection explanation for scene');
  assert.deepEqual(f.paid, ['Image Prompt', 'Image Prompt Pacer']);
  assert.equal(result.llmBilling.pixelsCharged, 2);
  assert.equal(f.preflights[0].operations.length, 2);
  assert.equal(f.preflights[0].operations[0].fingerprint, f.preflights[0].operations[1].fingerprint);
});

test('pacing reuses existing scene intent without forwarding the original user brief or adding model calls', async () => {
  const f = fixture();
  const brief = "FULL ORIGINAL BRIEF MUST NOT BE FORWARDED TO THE PACER";
  f.req.body.prompt = brief;
  await f.prepareInitialImagePrompts(f.req, f.res, f.config);
  assert.equal(f.requests.length, 2);
  const payloadText = f.requests[1].messages.find(message => message.role === 'user').content;
  const payload = JSON.parse(payloadText);
  assert.equal(Object.hasOwn(payload, 'userRequest'), false);
  assert.ok(!payloadText.includes(brief));
  assert.deepEqual(payload.images[0].sceneIntent, f.scenes[0].sceneIntent);
  assert.equal(payload.images[0].originalImagePrompt, f.originals[0]);
  assert.deepEqual(payload.creationContext, f.context);
});

test('Cinema A/B stays one base operation and one pacing operation, with exact independent stage outputs', async () => {
  const f = fixture({ pair: true });
  const result = await f.prepareInitialImagePrompts(f.req, f.res, f.config);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.paid, ['Cinema Prompts', 'Image Prompt Pacer']);
  assert.equal(result.llmBilling.pixelsCharged, 2);
  assert.equal(result.images.length, 2);
  for (const [index, id] of ['A', 'B'].entries()) {
    assert.equal(result.images[index].originalImagePrompt, f.originals[index]);
    assert.equal(result.images[index].fullScene, f.scenes[index].fullScene);
    assert.ok(result.images[index].pacedImagePrompt.startsWith(`Paced ${id}`));
    assert.equal(result.images[index].handoff, `Selection explanation for ${id}`);
  }
  assert.notEqual(result.images[0].pacedImagePrompt, result.images[1].pacedImagePrompt);
});

test('incomplete original stage output is rejected before pacing or successful billing', async () => {
  for (const rawOriginal of ['', 'only one original stage']) {
    const f = fixture({ pair: true, rawOriginal });
    await assert.rejects(f.prepareInitialImagePrompts(f.req, f.res, f.config), /incomplete scene or stage/);
    assert.equal(f.requests.length, 1); assert.deepEqual(f.paid, []);
  }
});

test('malformed pacing JSON or missing/mismatched stage data never becomes a paid pacing result', async () => {
  const mutations = [
    () => 'not JSON',
    images => JSON.stringify({ images: images.slice(0, 1) }),
    images => JSON.stringify({ images: [...images].reverse() }),
    images => JSON.stringify({ images: images.map((image, index) => index ? image : { ...image, pacedImagePrompt: '' }) }),
    images => JSON.stringify({ images: images.map((image, index) => index ? image : { id: image.id, pacedImagePrompt: image.pacedImagePrompt }) }),
  ];
  for (const pacedOutput of mutations) {
    const f = fixture({ pair: true, pacedOutput });
    await assert.rejects(f.prepareInitialImagePrompts(f.req, f.res, f.config));
    assert.equal(f.requests.length, 2); assert.deepEqual(f.paid, ['Cinema Prompts']);
  }
});

test('intentionally deferred handles can be absent from the starting look while complete canonical metadata survives', async () => {
  const f = fixture({ pacedOutput: images => JSON.stringify({ images: images.map(image => ({
    ...image, pacedImagePrompt: 'A coherent selected depiction. Anime art style',
  })) }) });
  const result = await f.prepareInitialImagePrompts(f.req, f.res, f.config);
  assert.equal(result.images[0].pacedImagePrompt, 'A coherent selected depiction. Anime art style');
  assert.equal(result.images[0].originalImagePrompt, f.originals[0]);
  assert.ok(result.images[0].originalImagePrompt.includes('@prop'));
  assert.equal(result.images[0].fullScene, f.scenes[0].fullScene);
});

test('only exact reference handles grounded in the complete paired source may appear in paced outputs', async () => {
  const allowed = fixture({ pair: true, pacedOutput: images => JSON.stringify({ images: images.map(image => ({
    ...image, pacedImagePrompt: 'Selected @driver @other @later view. Anime art style',
  })) }) });
  assert.equal((await allowed.prepareInitialImagePrompts(allowed.req, allowed.res, allowed.config)).images.length, 2);
  for (const handle of ['@invented', '@driverExtra']) {
    const f = fixture({ pacedOutput: images => JSON.stringify({ images: images.map(image => ({
      ...image, pacedImagePrompt: image.pacedImagePrompt + ' ' + handle,
    })) }) });
    await assert.rejects(f.prepareInitialImagePrompts(f.req, f.res, f.config), /reference handle/i);
    assert.deepEqual(f.paid, ['Image Prompt']);
  }
});

test('unaffordable initial preparation returns without either model operation', async () => {
  const f = fixture({ afford: false });
  assert.equal(await f.prepareInitialImagePrompts(f.req, f.res, f.config), null);
  assert.equal(f.requests.length, 0); assert.equal(f.operations.length, 0);
});

test('the operation fingerprint changes with maintained workflow knowledge as well as the scene context', async () => {
  const f = fixture();
  await f.prepareInitialImagePrompts(f.req, f.res, f.config);
  const first = f.preflights.at(-1).operations[0].fingerprint;
  f.setWorkflow('UPDATED EXACT CREATION WORKFLOW with a changed source contract.');
  await f.prepareInitialImagePrompts(f.req, f.res, f.config);
  const next = f.preflights.at(-1).operations[0].fingerprint;
  assert.notEqual(first, next);
});

test('the actual B-shot handler bypasses the new pipeline and retains its fixed model and charge behavior', async () => {
  const source = ts.createSourceFile('GptApi.ts', fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'GptTextVisualStages') initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(initializer);
  const requests = [];
  const bindings = {
    cleanPromptLiterals: value => value,
    logIntentBlueprintUsage() {},
    withoutVideoCreationContext: value => value,
    IMAGE_CAMERA_LANGUAGE_SKILL: 'shared camera language',
    B_SHOT_IMAGE_PROMPT_MODEL: 'fixed-b-shot-model', INITIAL_IMAGE_PROMPT_MODEL: 'selected-initial-model',
    prepareInitialImagePrompts: () => { throw new Error('B-shot must not run the initial pacer'); },
    initialImagePromptError: () => { throw new Error('Unexpected B-shot preparation error'); },
    generateGPT4oPrompt5: async (messages, model, inference) => { requests.push({ messages, model, inference }); return 'B-shot first---STAGE2---B-shot second'; },
    withLlmBilling: async (body, charge) => { assert.equal(charge, null); return body; },
    console: { log() {}, error() {} },
  };
  const code = ts.transpileModule(`const execute = ${initializer.getText(source)};`, {
    fileName: 'handler.ts', compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const handler = new Function(...Object.keys(bindings), code + '\nreturn execute;')(...Object.values(bindings));
  const res = { status() { return this; }, send(body) { this.body = body; return this; } };
  await handler({ body: { text: 'complete attached shot', prompt: 'user request', Planx: { characters: [], art_style: { style_token: 'Anime' } }, isBShotPrompt: true } }, res);
  assert.equal(requests.length, 1); assert.equal(requests[0].model, 'fixed-b-shot-model');
  assert.equal(requests[0].inference, undefined);
  assert.equal(res.body.visualPromptStage1, 'B-shot first'); assert.equal(res.body.visualPromptStage2, 'B-shot second');
});
