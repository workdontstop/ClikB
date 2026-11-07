const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadTypeScript } = require('./promptTestBindings.cjs');

const root = path.resolve(__dirname, '..');
const editing = loadTypeScript('src/characterReferenceEditing.ts');
const { ReferenceRenderClaims, runReferenceWorkers, preserveOwnedReferences } = loadTypeScript('src/referenceRenderQueue.ts');
const imageModels = loadTypeScript('src/imageModels.ts');
const evidence = loadTypeScript('src/creationReferenceEvidence.ts');
const character = (overrides = {}) => ({
  clientReferenceId: 'hero', name: 'Hero', type: 'character',
  imageUrl: 'https://assets.test/current.png', prompt: 'A blue-haired hero',
  originalPrompt: 'Original character prompt', ...overrides,
});

function productionHandler(name, bindings) {
  const source = ts.createSourceFile('PromptInput.tsx', fs.readFileSync(path.join(root, 'src/PromptInput.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      initializer = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(initializer, `Production ${name} handler exists`);
  const code = ts.transpileModule(`const handler = ${initializer.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${code}; return handler;`)(...Object.values(bindings));
}

function editorFixture(references = [character()], vipCharacters = [], overrides = {}) {
  const referenceImagesRef = { current: references.map(item => ({ ...item })) };
  const claims = new ReferenceRenderClaims();
  const posts = [], alerts = [], saved = [], models = [];
  const bindings = {
    ...editing, ...imageModels, ...evidence,
    creationProjectId: 'character-editor-test',
    dispatch() {},
    recordCreationAttemptStart: payload => payload,
    recordCreationAttemptSuccess: payload => payload,
    recordCreationAttemptFailure: payload => payload,
    editingRefIdx: 0, referenceImages: referenceImagesRef.current, referenceImagesRef,
    activeReferenceEditKeyRef: { current: references[0]?.clientReferenceId },
    referenceUploadTargetKeyRef: { current: references[0]?.clientReferenceId },
    referenceUploadInputRef: { current: { value: '', click() {} } },
    referenceRenderClaims: { current: claims },
    getReferenceEditKey: reference => reference?.clientReferenceId || null,
    isReferenceWorking: reference => Boolean(reference?.isGenerating || reference?.isUpscaling || reference?.isUploading),
    referenceNamesMatch: (left, right) => left === right,
    findRefByName: (items, name) => items.find(item => item.name === name),
    Vipcharacters: vipCharacters,
    manualVipRenderClaimsRef: { current: new Map() },
    manualVipRenderSequenceRef: { current: 0 },
    renderedRefsRef: { current: {} }, renderedRefKey: name => name.toLowerCase(),
    referencePromptDraftsRef: { current: new Map() },
    referenceAiLoadingKeysRef: { current: new Set() },
    latestReferenceAiRequestRef: { current: new Map() },
    imagePromptVal: 'A blue-haired hero', aiUpdateVal: '', parsedKeyPointsb: [],
    modelz: 'Imagen', ratioKey: 1, Seed: 123,
    updateReferenceImages: updater => { referenceImagesRef.current = updater(referenceImagesRef.current); },
    handleEditReferenceAI: async () => assert.fail('Unexpected prompt refinement'),
    getWorldCharacterImagePrompt: description => description,
    CLIK_URL: '/api', PROMPTINPUT_CHARACTER_LINK_MODE: true,
    axios: { post: async (url, payload) => {
      posts.push({ url, payload });
      return { data: { imageUrl: 'https://provider.test/generated.png', imageBase64: 'data:image/png;base64,fixture' } };
    } },
    fetch: async () => ({ ok: true, blob: async () => new Blob(['generated'], { type: 'image/png' }) }),
    imageBlobToPng: async file => file,
    putToS3: async () => 'https://assets.test/saved.png',
    Saveprompthelperfordellater: url => saved.push(url),
    recordGeneratedImageModel: (model, urls) => models.push({ model, urls }),
    inheritImageResultModel() {},
    getPixel: async () => 1000, setAvailablePixels() {},
    setIsAILoading() {}, setError() {},
    console: { error() {}, warn() {}, log() {} },
    alert: message => alerts.push(message),
    ...overrides,
  };
  return { bindings, claims, posts, alerts, saved, models, referenceImagesRef,
    handler: name => productionHandler(name, bindings) };
}

test('normal characters default to Recreate and VIP/manual characters default to Edit', () => {
  assert.equal(editing.getReferenceImageGenerationMode(character()), 'recreate');
  for (const identity of [{ isVip: true }, { source: 'upload' }, { source: 'world' }]) {
    assert.equal(editing.getReferenceImageGenerationMode(character(identity)), 'edit');
    assert.equal(editing.getReferenceImageGenerationMode(character({ ...identity, imageGenerationMode: 'recreate' })), 'recreate');
  }
  assert.equal(editing.getReferenceImageGenerationMode(character(), { imageUrl: 'https://assets.test/vip.png' }), 'edit');
  assert.equal(editing.getReferenceImageGenerationMode(character({ imageGenerationMode: 'edit' })), 'edit');
});

test('Edit uses the displayed result before original VIP identity or upload sources', () => {
  const vip = { imageUrl: 'https://assets.test/original-vip.png' };
  assert.equal(editing.getReferenceGenerationInput(character({ vipSourceImageUrl: vip.imageUrl }), vip), 'https://assets.test/current.png');
  assert.equal(editing.getReferenceGenerationInput({ url: 'https://assets.test/result.png', vipSourceImageUrl: vip.imageUrl }, vip), 'https://assets.test/result.png');
  assert.equal(editing.getReferenceGenerationInput({}, vip), vip.imageUrl);
  assert.equal(editing.getReferenceGenerationInput({}), '');
});

test('mode changes preserve the selected image model and use its text or edit route', () => {
  for (const model of imageModels.ACTIVE_IMAGE_MODEL_KEYS) {
    for (const mode of ['recreate', 'edit']) {
      const route = editing.getReferenceGenerationRoute(model, mode);
      const expected = imageModels.getGptImageRoute(model)
        || (model === 'Imagen' ? (mode === 'edit' ? 'Bannana' : 'Imagen')
          : model === 'Imagen2' ? (mode === 'edit' ? 'Bannana2' : 'Imagen2')
            : model === 'Schnell' ? 'fluxschnell' : model);
      assert.equal(route, expected, `${model} in ${mode}`);
    }
  }
});

test('local replacement preserves character identity and prompts while selecting Edit', () => {
  const previous = character({ isVip: true, vipSourceImageUrl: 'original.png', isUploading: true });
  const next = editing.applyReferenceImageReplacement(previous, 'replacement.png');
  for (const key of ['clientReferenceId', 'name', 'type', 'prompt', 'originalPrompt', 'vipSourceImageUrl']) assert.equal(next[key], previous[key]);
  for (const key of ['imageUrl', 'url', 'image']) assert.equal(next[key], 'replacement.png');
  assert.equal(next.imageGenerationMode, 'edit');
  assert.equal(next.hasManualImage, true);
  for (const key of ['isUploading', 'isGenerating', 'isUpscaling']) assert.equal(next[key], false);
  assert.equal(previous.imageUrl, 'https://assets.test/current.png');
});

test('a mode selected before rendering survives late casting results', () => {
  const previous = character({ imageUrl: '', imageGenerationMode: 'edit' });
  const [next] = preserveOwnedReferences([{ name: 'Hero', imageUrl: '', prompt: 'Casting prompt' }], [previous], () => false, (left, right) => left === right);
  assert.equal(next.clientReferenceId, 'hero');
  assert.equal(next.imageGenerationMode, 'edit');
  assert.equal(next.prompt, 'Casting prompt');
});

test('actual regeneration honors defaults and explicit Edit/Recreate choices for normal and VIP characters', async () => {
  for (const vip of [false, true]) for (const mode of [undefined, 'edit', 'recreate']) {
    const reference = character({ ...(vip ? { isVip: true, vipSourceImageUrl: 'https://assets.test/original-vip.png' } : {}),
      ...(mode ? { imageGenerationMode: mode } : {}) });
    const f = editorFixture([reference], vip ? [{ name: 'Hero', imageUrl: 'https://assets.test/original-vip.png' }] : []);
    await f.handler('handleRegenerateReference')();
    assert.equal(f.posts.length, 1, `one image request for vip=${vip}, mode=${mode}`);
    const { url, payload } = f.posts[0];
    const isEdit = mode === 'edit' || (mode === undefined && vip);
    assert.equal(url, isEdit ? '/api/Bannana' : '/api/Imagen');
    assert.equal(payload.model, 'Imagen');
    assert.equal(payload.inputs, 'A blue-haired hero');
    assert.equal(payload.billingReference, 'Hero');
    if (isEdit) {
      assert.deepEqual(payload.sampleImages, ['https://assets.test/current.png']);
      assert.equal(payload.sampleimagesnames[0].imageUrl, payload.sampleImages[0]);
    } else {
      assert.equal(payload.sampleImages, undefined);
      assert.equal(payload.sampleimagesnames, undefined);
    }
    assert.equal(f.referenceImagesRef.current[0].imageUrl, 'https://assets.test/saved.png');
    assert.equal(f.claims.done('hero'), true);
    assert.deepEqual(f.alerts, []);
  }
});

test('editing again with another model uses the latest result as input', async () => {
  const f = editorFixture([character({ isVip: true })], [{ name: 'Hero', imageUrl: 'https://assets.test/original-vip.png' }]);
  await f.handler('handleRegenerateReference')();
  f.bindings.referenceImages = f.referenceImagesRef.current;
  f.bindings.modelz = 'fluxUltra2';
  await f.handler('handleRegenerateReference')();
  assert.equal(f.posts[1].url, '/api/fluxUltra2');
  assert.equal(f.posts[1].payload.model, 'fluxUltra2');
  assert.deepEqual(f.posts[1].payload.sampleImages, ['https://assets.test/saved.png']);
});

test('Edit without an input image does not start a generation or chargeable request', async () => {
  const f = editorFixture([character({ imageUrl: '', imageGenerationMode: 'edit' })]);
  await f.handler('handleRegenerateReference')();
  assert.equal(f.posts.length, 0);
  assert.equal(f.claims.working('hero'), false);
  assert.equal(f.alerts.length, 1);
});

test('mode selection belongs to the selected character and cannot change during its upload', () => {
  const f = editorFixture([character(), character({ clientReferenceId: 'other', name: 'Other' })]);
  const selectMode = f.handler('setActiveReferenceGenerationMode');
  selectMode('edit');
  f.bindings.activeReferenceEditKeyRef.current = 'other';
  selectMode('recreate');
  assert.equal(f.referenceImagesRef.current[0].imageGenerationMode, 'edit');
  assert.equal(f.referenceImagesRef.current[1].imageGenerationMode, 'recreate');
  f.referenceImagesRef.current[1].isUploading = true;
  selectMode('edit');
  assert.equal(f.referenceImagesRef.current[1].imageGenerationMode, 'recreate');
});

function uploadEvent() {
  return { currentTarget: { value: 'replacement.png', files: [new Blob(['replacement'], { type: 'image/png' })] } };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function addAutomaticQueueBindings(fixture) {
  Object.assign(fixture.bindings, {
    runReferenceWorkers, isGeneratingRefsRef: { current: false }, referenceGenerationRunRef: { current: null },
    latestCastingIdRef: { current: 1 }, isRevisitingCharacterRef: { current: true },
    setCastingStatus() {}, setReferenceLoading() {}, setReferencePendingCount() {},
    setQueuedCastingPrompts() {}, setStudioButtonStage() {}, setStudioActionTimer() {},
  });
}

test('first automatic generation retains fresh normal images and reference-based VIP/manual defaults', async () => {
  for (const vip of [false, true]) {
    const reference = character(vip ? { isVip: true, source: 'upload', imageUrl: 'https://assets.test/original-vip.png' } : { imageUrl: '' });
    const f = editorFixture([reference], vip ? [{ name: 'Hero', imageUrl: reference.imageUrl }] : []);
    addAutomaticQueueBindings(f);
    await f.handler('runReferenceImageGeneration')([{ name: 'Hero', type: 'character', imagePrompt: 'Automatic casting prompt' }]);
    const generation = f.posts.filter(post => !post.url.endsWith('/upscaleImage'));
    assert.equal(generation.length, 1);
    assert.equal(generation[0].url, vip ? '/api/Bannana' : '/api/Imagen');
    if (vip) assert.deepEqual(generation[0].payload.sampleImages, ['https://assets.test/original-vip.png']);
    else assert.equal(generation[0].payload.sampleImages, undefined);
    assert.equal(f.referenceImagesRef.current[0].imageUrl, 'https://assets.test/saved.png');
    assert.equal(f.claims.done('hero'), true);
  }
});

test('local replacement stays attached to the picker owner when navigation and list order change', async () => {
  const transfer = deferred();
  const f = editorFixture([character(), character({ clientReferenceId: 'other', name: 'Other', imageUrl: 'other.png' })], [], {
    putToS3: async () => transfer.promise,
  });
  f.handler('openReferenceImageUpload')();
  f.bindings.activeReferenceEditKeyRef.current = 'other';
  const event = uploadEvent();
  const upload = f.handler('handleReferenceImageUpload')(event);
  assert.equal(f.claims.working('hero'), true);
  assert.equal(f.referenceImagesRef.current[0].isUploading, true);
  f.referenceImagesRef.current.reverse();
  transfer.resolve('https://assets.test/replacement.png');
  await upload;
  const hero = f.referenceImagesRef.current.find(item => item.clientReferenceId === 'hero');
  assert.equal(hero.imageUrl, 'https://assets.test/replacement.png');
  assert.equal(hero.imageGenerationMode, 'edit');
  assert.equal(hero.prompt, 'A blue-haired hero');
  assert.equal(hero.isUploading, false);
  assert.equal(f.referenceImagesRef.current.find(item => item.clientReferenceId === 'other').imageUrl, 'other.png');
  assert.equal(f.claims.done('hero'), true);
  assert.equal(event.currentTarget.value, '');
  assert.deepEqual(f.models, [{ model: 'uploaded', urls: ['https://assets.test/replacement.png'] }]);
  assert.equal(f.posts.length, 0, 'upload does not generate an image');
});

test('failed local replacement retains the old image, prompt and mode and releases its claim', async () => {
  const f = editorFixture([character()], [], { putToS3: async () => { throw new Error('Upload unavailable'); } });
  await f.handler('handleReferenceImageUpload')(uploadEvent());
  const reference = f.referenceImagesRef.current[0];
  assert.equal(reference.imageUrl, 'https://assets.test/current.png');
  assert.equal(reference.prompt, 'A blue-haired hero');
  assert.equal(reference.imageGenerationMode, undefined);
  assert.equal(reference.isUploading, false);
  assert.equal(f.claims.working('hero'), false);
  assert.equal(f.claims.done('hero'), false);
  assert.deepEqual(f.alerts, ['Upload unavailable']);
  assert.equal(f.saved.length, 0);
});

test('a queued automatic VIP render waits for local replacement and preserves it without another image request', async () => {
  const transfer = deferred();
  const f = editorFixture([character({ isVip: true })], [{ name: 'Hero', imageUrl: 'https://assets.test/original-vip.png' }], {
    putToS3: async () => transfer.promise,
  });
  addAutomaticQueueBindings(f);
  const upload = f.handler('handleReferenceImageUpload')(uploadEvent());
  const automatic = f.handler('runReferenceImageGeneration')([{ name: 'Hero', type: 'character', imagePrompt: 'Automatic casting prompt' }]);
  assert.equal(f.posts.length, 0);
  transfer.resolve('https://assets.test/replacement.png');
  await Promise.all([upload, automatic]);
  assert.equal(f.referenceImagesRef.current[0].imageUrl, 'https://assets.test/replacement.png');
  assert.equal(f.referenceImagesRef.current[0].prompt, 'A blue-haired hero');
  assert.equal(f.referenceImagesRef.current[0].imageGenerationMode, 'edit');
  assert.equal(f.posts.length, 0, 'automatic queue must not regenerate the local replacement');
  assert.equal(f.bindings.isGeneratingRefsRef.current, false);
});

test('production manual generation records the submitted draft, edit source and stable owner through reorder', async () => {
  const response = deferred();
  const f = editorFixture([character({ imageGenerationMode: 'edit' }), character({ clientReferenceId: 'other', name: 'Other' })], [], {
    imagePromptVal: 'Updated appearance', axios: { post: async () => response.promise },
  });
  f.bindings.referencePromptDraftsRef.current.set('hero', 'Updated appearance');
  const work = f.handler('handleRegenerateReference')();
  f.referenceImagesRef.current.reverse();
  // A later prompt draft must not be removed by the older render result.
  f.bindings.referencePromptDraftsRef.current.set('hero', 'Later appearance');
  response.resolve({ data: { imageBase64: 'data:image/png;base64,fixture' } });await work;
  const hero = f.referenceImagesRef.current.find(r => r.clientReferenceId === 'hero');
  const rendered = evidence.referenceEditEvidence(hero, 'Updated appearance');
  assert.equal(rendered.promptRevision, rendered.renderedPromptRevision);
  assert.equal(hero.renderProvenance.operation, 'edit');
  assert.equal(hero.renderProvenance.sourceMediaRevision, evidence.generatedReferenceProvenance('source', '', 'https://assets.test/current.png').sourceMediaRevision);
  assert.equal(f.bindings.referencePromptDraftsRef.current.get('hero'), 'Later appearance');
  assert.notEqual(evidence.referenceEditEvidence(hero, 'Later appearance').promptRevision, rendered.renderedPromptRevision);
  assert.equal(evidence.referenceEditEvidence(f.referenceImagesRef.current[0]).renderedPromptRevision, null);
});

test('production automatic generation and upscale prove the submitted draft rather than the retained prompt', async () => {
  const f = editorFixture([character({ imageUrl: '' })]);addAutomaticQueueBindings(f);
  f.bindings.referencePromptDraftsRef.current.set('hero', 'New draft for rendering');
  let uploaded=0;f.bindings.putToS3=async()=>`https://assets.test/result-${++uploaded}.png`;
  f.bindings.axios.post=async(url,payload)=>{
    f.posts.push({url,payload});return url.endsWith('/upscaleImage')
      ? {data:{url:'https://provider.test/upscaled.png'}} : {data:{imageUrl:'https://provider.test/generated.png'}};
  };
  await f.handler('runReferenceImageGeneration')([{name:'Hero',type:'character',imagePrompt:'Casting prompt'}]);
  const hero=f.referenceImagesRef.current[0],rendered=evidence.referenceEditEvidence(hero,'New draft for rendering');
  assert.equal(hero.prompt,'A blue-haired hero');assert.equal(f.posts[0].payload.inputs,'New draft for rendering');
  assert.equal(rendered.promptRevision,rendered.renderedPromptRevision);assert.notEqual(rendered.committedPromptRevision,rendered.renderedPromptRevision);
  assert.equal(hero.renderProvenance.operation,'upscale');assert.equal(hero.imageUrl,'https://assets.test/result-2.png');
});

test('production upload clears render proof despite a retained prompt; failed upload preserves it', async () => {
  const prior=character({renderProvenance:evidence.generatedReferenceProvenance('https://assets.test/current.png','A blue-haired hero')});
  const f=editorFixture([prior]);await f.handler('handleReferenceImageUpload')(uploadEvent());
  assert.equal(f.referenceImagesRef.current[0].prompt,prior.prompt);
  assert.equal(evidence.referenceEditEvidence(f.referenceImagesRef.current[0]).renderedPromptRevision,null);
  const failed=editorFixture([prior],[],{putToS3:async()=>{throw Error('failed');}});await failed.handler('handleReferenceImageUpload')(uploadEvent());
  assert.equal(evidence.referenceEditEvidence(failed.referenceImagesRef.current[0]).renderedPromptRevision,evidence.referenceEditEvidence(prior).renderedPromptRevision);
});

test('late manual render cannot replace newer media or attach its prompt proof', async () => {
  const response=deferred(),f=editorFixture([character()],[],{axios:{post:async()=>response.promise}});
  const work=f.handler('handleRegenerateReference')();
  f.referenceImagesRef.current[0]={...f.referenceImagesRef.current[0],imageUrl:'newer-upload.png',renderProvenance:null,isGenerating:false};
  response.resolve({data:{imageBase64:'data:image/png;base64,fixture'}});await work;
  assert.equal(f.referenceImagesRef.current[0].imageUrl,'newer-upload.png');assert.equal(evidence.referenceEditEvidence(f.referenceImagesRef.current[0]).renderedPromptRevision,null);
});

test('failed automatic render keeps known prior media; late casting results cannot publish provenance', async () => {
  const prior=character({isVip:true,renderProvenance:evidence.generatedReferenceProvenance('https://assets.test/current.png','A blue-haired hero')});
  const failed=editorFixture([prior],[{name:'Hero',imageUrl:prior.imageUrl}],{axios:{post:async()=>{throw Error('failed');}}});addAutomaticQueueBindings(failed);
  await failed.handler('runReferenceImageGeneration')([{name:'Hero',type:'character',imagePrompt:'Casting prompt'}]);
  assert.equal(evidence.referenceEditEvidence(failed.referenceImagesRef.current[0]).renderedPromptRevision,evidence.referenceEditEvidence(prior).renderedPromptRevision);
  const response=deferred(),late=editorFixture([character({imageUrl:''})],[],{axios:{post:async()=>response.promise}});addAutomaticQueueBindings(late);
  const work=late.handler('runReferenceImageGeneration')([{name:'Hero',type:'character',imagePrompt:'Casting prompt'}],1);
  late.bindings.latestCastingIdRef.current=2;response.resolve({data:{imageUrl:'late-result.png'}});await work;
  assert.equal(late.referenceImagesRef.current[0].imageUrl,'');assert.equal(evidence.referenceEditEvidence(late.referenceImagesRef.current[0]).renderedPromptRevision,null);
});
test('failed manual regeneration preserves prior prompt proof after all retries',async()=>{
  const prior=character({renderProvenance:evidence.generatedReferenceProvenance('https://assets.test/current.png','A blue-haired hero')});let calls=0;
  const f=editorFixture([prior],[],{axios:{post:async()=>{calls++;throw Error('failed');}},setTimeout:fn=>{fn();return 0;}});
  await f.handler('handleRegenerateReference')();assert.equal(calls,3);assert.equal(f.claims.working('hero'),false);
  assert.equal(evidence.referenceEditEvidence(f.referenceImagesRef.current[0]).renderedPromptRevision,evidence.referenceEditEvidence(prior).renderedPromptRevision);
});
test('late automatic upscale cannot overwrite a replacement or attach old render proof',async()=>{
  const upscale=deferred(),started=deferred(),f=editorFixture([character({imageUrl:''})]);addAutomaticQueueBindings(f);
  f.bindings.axios.post=async url=>{if(url.endsWith('/upscaleImage')){started.resolve();return upscale.promise;}return {data:{imageUrl:'base.png'}};};
  const work=f.handler('runReferenceImageGeneration')([{name:'Hero',type:'character',imagePrompt:'Casting prompt'}]);await started.promise;
  f.referenceImagesRef.current[0]=editing.applyReferenceImageReplacement(f.referenceImagesRef.current[0],'replacement.png');
  upscale.resolve({data:{url:'old-upscale.png'}});await work;
  assert.equal(f.referenceImagesRef.current[0].imageUrl,'replacement.png');assert.equal(evidence.referenceEditEvidence(f.referenceImagesRef.current[0]).renderedPromptRevision,null);
});
test('casting cancellation during upscale retains its owned base and proof while releasing busy flags',async()=>{
  const upscale=deferred(),started=deferred(),f=editorFixture([character({imageUrl:''})]);addAutomaticQueueBindings(f);
  f.bindings.axios.post=async url=>{if(url.endsWith('/upscaleImage')){started.resolve();return upscale.promise;}return {data:{imageUrl:'base.png'}};};
  const work=f.handler('runReferenceImageGeneration')([{name:'Hero',type:'character',imagePrompt:'Casting prompt'}],1);await started.promise;
  const before=evidence.referenceEditEvidence(f.referenceImagesRef.current[0]);assert.equal(before.busy,true);assert.ok(before.renderedPromptRevision);
  f.bindings.latestCastingIdRef.current=2;upscale.resolve({data:{url:'late-upscale.png'}});await work;
  const reference=f.referenceImagesRef.current[0],after=evidence.referenceEditEvidence(reference);
  assert.equal(reference.imageUrl,'https://assets.test/saved.png');assert.equal(after.renderedPromptRevision,before.renderedPromptRevision);
  assert.equal(reference.isGenerating,false);assert.equal(reference.isUpscaling,false);assert.equal(f.claims.working('hero'),false);
});
