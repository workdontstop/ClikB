const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.createSourceFile('PromptInput.tsx', fs.readFileSync(path.join(__dirname, '../src/PromptInput.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node)) {
    const name = node.name.getText(source);
    if (['getUsableReferenceImage', 'isReferenceWorking', 'referenceNeedsImage', 'hasMissingImages', 'proceedToImageGeneration'].includes(name)) {
      nodes.set(name, name === 'proceedToImageGeneration' ? node.initializer.arguments[0] : node.initializer);
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
for (const name of ['getUsableReferenceImage', 'isReferenceWorking', 'referenceNeedsImage', 'hasMissingImages', 'proceedToImageGeneration']) assert.ok(nodes.has(name), `Production ${name} must exist`);

function evaluate(node, bindings = {}) {
  const code = ts.transpileModule(`const value = ${node.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), code + 'return value;')(...Object.values(bindings));
}
const getUsableReferenceImage = evaluate(nodes.get('getUsableReferenceImage'));
const isReferenceWorking = evaluate(nodes.get('isReferenceWorking'));
const referenceNeedsImage = evaluate(nodes.get('referenceNeedsImage'), { getUsableReferenceImage, isReferenceWorking });
const needsGeneration = referenceImages => evaluate(nodes.get('hasMissingImages'), { referenceImages, referenceNeedsImage });
const namesMatch = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function fixture(references, vips = [], options = {}) {
  const requests = [], renders = [], queued = [], statuses = [], errors = [], referenceImagesRef = { current: references };
  const latestCastingIdRef = { current: 17 }, castingPromptRunRef = { current: null };
  let skips = 0;
  const plan = { style: 'Anime', brief: 'Cuzon wears a black tuxedo; Terra keeps the exact reference outfit.' };
  const scenes = ['Cuzon and Terra prepare for a formal reception.'];
  const generated = references.map(ref => ({ name: ref.name, type: ref.type || 'character', imagePrompt: `Current story reference for ${ref.name}` }));
  const proceed = evaluate(nodes.get('proceedToImageGeneration'), {
    setCastingStatus: value => statuses.push(value),
    Vipcharacters: vips,
    referenceNamesMatch: namesMatch,
    CLIK_URL: 'https://local-fixture.invalid',
    axios: { post: async (url, body, requestOptions) => {
      requests.push({ url, body, options: requestOptions });
      const response = { data: { prompts: generated } };
      return options.onRequest ? options.onRequest({ url, body, response, count: requests.length }) : response;
    } },
    parsedKeyPointsb: scenes,
    Planx: plan,
    parsedKeyPoints2: ['Narration for the formal reception.'],
    latestCastingIdRef,
    castingPromptRunRef,
    referenceImagesRef,
    updateReferenceImages: updater => { referenceImagesRef.current = updater(referenceImagesRef.current); },
    referenceRenderClaims: { current: { working: () => false, done: () => false } },
    getReferenceEditKey: ref => ref.clientReferenceId || ref.name,
    findRefByName: (refs, name) => refs.find(ref => namesMatch(ref.name, name)),
    getPixel: async () => 100,
    setAvailablePixels() {},
    calcModelPixels: () => 2,
    modelz: 'Bannana',
    setReferencePendingCount() {},
    setQueuedCastingPrompts: value => queued.push(value),
    setStudioActionCost() {},
    hasStartedCastingRef: { current: false },
    setStudioButtonStage() {},
    runReferenceImageGeneration: async (prompts, castingId) => {
      renders.push({ prompts, castingId });
      if (options.onRender) await options.onRender({ prompts, castingId });
    },
    handleSkipCharacters: () => { skips++; },
    console: { error: (...values) => errors.push(values) },
  });
  return { requests, renders, queued, statuses, errors, proceed, plan, scenes, latestCastingIdRef, castingPromptRunRef, get skips() { return skips; } };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function uploadedVip(name, overrides = {}) {
  return { name, type: 'character', isVip: true, imageUrl: `/${name}-original.png`, prompt: '', isGenerating: false, clientReferenceId: name, ...overrides };
}

test('VIP-only uploads with empty prompts require generation without an environment', async () => {
  const refs = [uploadedVip('Cuzon'), uploadedVip('Terra')];
  const vips = refs.map(ref => ({ name: ref.name, imageUrl: ref.imageUrl, description: 'STALE_WARDROBE: original brown coat and old military equipment.' }));
  assert.equal(needsGeneration(refs), true);
  const f = fixture(refs, vips);
  await f.proceed(refs, [], 17);
  assert.equal(f.requests.length, 1);
  assert.equal(f.renders.length, 1);
  assert.equal(f.requests[0].url, 'https://local-fixture.invalid/generateCastingPrompts');
  assert.deepEqual(f.requests[0].body.characters.map(character => character.name), ['Cuzon', 'Terra']);
  assert.ok(f.requests[0].body.characters.every(character => character.isVip === true));
  assert.deepEqual(f.requests[0].body.environments, []);
  assert.deepEqual(f.requests[0].body.prompts, f.scenes);
  assert.deepEqual(f.requests[0].body.plan, f.plan);
  assert.equal(f.requests[0].options.withCredentials, true);
  assert.doesNotMatch(JSON.stringify(f.requests[0].body), /STALE_WARDROBE|brown coat|old military equipment/);
  assert.equal(f.skips, 0);
});

test('mixed missing regular and VIP references share one casting request and render queue', async () => {
  const vip = uploadedVip('Terra');
  const regular = { name: 'Guest', type: 'character', imageUrl: '', prompt: '', description: 'Adult guest in formal clothing.' };
  const environment = { name: 'Reception', type: 'environment', imageUrl: '', prompt: '', description: 'A reception hall.' };
  const refs = [vip, regular, environment];
  assert.equal(needsGeneration(refs), true);
  const f = fixture(refs, [{ name: vip.name, imageUrl: vip.imageUrl, description: 'STALE_WARDROBE' }]);
  await f.proceed([vip, regular], [environment], 17);
  assert.equal(f.requests.length, 1, 'VIP and regular references must not submit separate casting requests');
  assert.equal(f.renders.length, 1);
  assert.equal(f.queued.length, 1);
  const characters = f.requests[0].body.characters;
  assert.equal(characters.length, 2);
  assert.equal(new Set(characters.map(character => character.name)).size, 2);
  assert.equal(characters.find(character => character.name === 'Terra').isVip, true);
  assert.equal(characters.find(character => character.name === 'Guest').description, regular.description);
  assert.deepEqual(f.requests[0].body.environments, [environment]);
  assert.deepEqual(f.renders[0].prompts.map(prompt => prompt.name), ['Terra', 'Guest', 'Reception']);
  assert.equal(f.skips, 0);
});

test('completed VIP prompts and regular images retain Continue eligibility', () => {
  for (const reference of [
    uploadedVip('Terra', { imageUrl: '/terra-created.png', prompt: 'Terra in current story outfit' }),
    { name: 'Guest', imageUrl: '/guest-created.png', prompt: '' },
    { name: 'Hall', type: 'environment', imageUrl: '/hall-created.png', prompt: '' },
    { name: 'Guest', url: '/guest-created.png', prompt: '' },
  ]) {
    assert.equal(referenceNeedsImage(reference), false);
    assert.equal(needsGeneration([reference]), false);
  }
  assert.equal(referenceNeedsImage(uploadedVip('Terra', { prompt: '   ' })), true);
});

test('working or upscaling references do not re-enter the missing-image queue', () => {
  for (const reference of [
    uploadedVip('Terra', { isGenerating: true }),
    uploadedVip('Terra', { isUpscaling: true }),
    { name: 'Guest', imageUrl: '', isGenerating: true },
    { name: 'Hall', imageUrl: '', isUpscaling: true },
  ]) {
    assert.equal(referenceNeedsImage(reference), false);
    assert.equal(needsGeneration([reference]), false);
  }
});

test('repeated readiness checks have no generation side effects', () => {
  const refs = [uploadedVip('Cuzon'), uploadedVip('Terra')];
  const snapshot = structuredClone(refs);
  const f = fixture(refs);
  for (let index = 0; index < 20; index++) assert.equal(needsGeneration(refs), true);
  assert.deepEqual(refs, snapshot);
  assert.equal(f.requests.length, 0);
  assert.equal(f.renders.length, 0);
});

test('concurrent explicit generation calls share one request through prompt and image completion', async () => {
  const refs = [uploadedVip('Terra')];
  const requestGate = deferred(), renderGate = deferred(), renderingStarted = deferred();
  const f = fixture(refs, refs, {
    onRequest: async ({ response }) => { await requestGate.promise; return response; },
    onRender: async () => { renderingStarted.resolve(); await renderGate.promise; },
  });
  const first = f.proceed(refs, [], 17);
  await f.proceed(refs, [], 17);
  assert.equal(f.requests.length, 1);
  requestGate.resolve();
  await renderingStarted.promise;
  await f.proceed(refs, [], 17);
  assert.equal(f.requests.length, 1, 'The request lock must remain active through image rendering');
  assert.equal(f.renders.length, 1);
  renderGate.resolve();
  await first;
  assert.equal(f.castingPromptRunRef.current, null);
  await f.proceed(refs, [], 17);
  assert.equal(f.requests.length, 2, 'Completion must release the guard for a later explicit request');
  assert.equal(f.renders.length, 2);
  assert.equal(f.skips, 0);
});

test('a failed prompt request releases its guard for retry', async () => {
  const refs = [uploadedVip('Terra')];
  const f = fixture(refs, refs, {
    onRequest: async ({ response, count }) => {
      if (count === 1) throw new Error('Mocked prompt request failure');
      return response;
    },
  });
  await f.proceed(refs, [], 17);
  assert.equal(f.requests.length, 1);
  assert.equal(f.renders.length, 0);
  assert.equal(f.skips, 1);
  assert.equal(f.castingPromptRunRef.current, null);
  await f.proceed(refs, [], 17);
  assert.equal(f.requests.length, 2);
  assert.equal(f.renders.length, 1);
  assert.equal(f.castingPromptRunRef.current, null);
});

test('stale explicit casting calls submit no request', async () => {
  const refs = [uploadedVip('Terra')];
  const f = fixture(refs, refs);
  await f.proceed(refs, [], 16);
  assert.equal(f.requests.length, 0);
  assert.equal(f.renders.length, 0);
  assert.equal(f.castingPromptRunRef.current, null);
});

test('a superseded prompt response cannot render or release a newer request guard', async () => {
  const refs = [uploadedVip('Terra')];
  const oldGate = deferred(), newGate = deferred();
  const f = fixture(refs, refs, {
    onRequest: async ({ response, count }) => { await (count === 1 ? oldGate.promise : newGate.promise); return response; },
  });
  const oldRun = f.proceed(refs, [], 17);
  f.latestCastingIdRef.current = 18;
  const newRun = f.proceed(refs, [], 18);
  assert.equal(f.requests.length, 2);
  oldGate.resolve();
  await oldRun;
  assert.equal(f.renders.length, 0);
  assert.equal(f.castingPromptRunRef.current.castingId, 18);
  await f.proceed(refs, [], 18);
  assert.equal(f.requests.length, 2);
  newGate.resolve();
  await newRun;
  assert.equal(f.renders.length, 1);
  assert.equal(f.renders[0].castingId, 18);
  assert.equal(f.castingPromptRunRef.current, null);
});
