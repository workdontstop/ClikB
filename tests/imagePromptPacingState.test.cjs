const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadPure(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}
const state = loadPure('src/imagePromptPacing.ts');
const intent = loadPure('src/intentBlueprint.ts');
const video = loadPure('server/src/imagePromptPacer.ts');

function fixture() {
  const fullScene = 'The collective has four distinct members with shared anatomy and individual markings. '
    + 'Preserve the complete authored scene, temporal order, and intentional simultaneous relationships. '.repeat(90)
    + 'EXACT SOURCE END: naïve façade; intact @collective and @location.';
  const pacing = {
    version: 1,
    originalImagePrompt: 'The collective completes the intended development at the location; deliberate optical treatment.',
    pacedImagePrompt: 'The collective in the selected state at the location; deliberate optical treatment.',
    handoff: 'This depiction establishes the selected state of the complete scene; retain the intended development and membership.',
    fullScene,
  };
  const binding = { sceneId: 'scene-one', orderIndex: 0 };
  const scene = {
    sceneId: binding.sceneId, mode: 'shorts', kind: 'shorts-scene', revision: 1,
    sourceContextHash: 'source-revision', boundImagePromptHash: null,
    syncStatus: 'syncing', derivedFrom: 'initial-compile', text: 'Full scene meaning, not only the selected visible state.',
  };
  const bundle = {
    schemaVersion: intent.INTENT_BLUEPRINT_SCHEMA_VERSION, blueprintId: 'creation-one', revision: 1,
    mode: 'shorts', sourceContextHash: 'source-revision', global: { overview: 'Full creation purpose' },
    modeStructure: { kind: 'shorts' }, sceneOrder: [binding.sceneId], scenes: { [binding.sceneId]: scene },
    audit: { status: 'valid', issues: [] },
  };
  return { fullScene, pacing, binding, scene, bundle };
}

test('binding preserves original, paced prompt, handoff, and full collective scene through blueprint JSON persistence', () => {
  const f = fixture();
  const sourceSnapshot = JSON.stringify(f.bundle);
  const bound = intent.bindSceneIntentToImagePrompt(f.bundle, f.binding.sceneId, f.pacing.pacedImagePrompt, f.pacing);
  const restored = intent.parseIntentBlueprintBundle(JSON.stringify(bound));
  assert.ok(restored);
  const stored = restored.scenes[f.binding.sceneId];
  assert.deepEqual(stored.imagePacing, f.pacing);
  assert.equal(stored.imagePacing.fullScene, f.fullScene);
  assert.ok(stored.imagePacing.fullScene.endsWith('EXACT SOURCE END: naïve façade; intact @collective and @location.'));
  assert.equal(stored.text, f.scene.text, 'selecting a depiction must not reduce full scene intent');
  assert.equal(stored.boundImagePromptHash, intent.hashIntentValue(f.pacing.pacedImagePrompt));
  assert.notEqual(stored.boundImagePromptHash, intent.hashIntentValue(f.pacing.originalImagePrompt));
  assert.equal(stored.syncStatus, 'ready');
  assert.equal(intent.sceneIntentMatchesPrompt(stored, f.pacing.pacedImagePrompt), true);
  assert.equal(intent.sceneIntentMatchesPrompt(stored, f.pacing.originalImagePrompt), false);
  assert.deepEqual(intent.intentSceneBindingsFromBundle(restored), [f.binding]);
  assert.deepEqual(intent.resolveSceneIntent({ type: 'A', index: 0 }, [f.binding], restored).imagePacing, f.pacing);
  assert.equal(JSON.stringify(f.bundle), sourceSnapshot, 'initial bundle stays immutable');
});

test('video context preserves canonical scene conception separately from the actual paced starting description', () => {
  const { pacing, fullScene } = fixture();
  const current = pacing.pacedImagePrompt;
  const result = state.videoImagePromptContext(current, pacing);
  assert.deepEqual(result, {
    imageDescription: pacing.originalImagePrompt, startingImagePrompt: current,
    imagePacingHandoff: pacing.handoff, fullScene,
  });
  assert.notEqual(result.imageDescription, result.startingImagePrompt);
  assert.equal(state.readImagePromptPacing(pacing, current), pacing);
});

test('frame edits preserve full action and replace only the starting look and stale handoff', () => {
  const { pacing } = fixture();
  for (const edited of [
    pacing.pacedImagePrompt.replace('selected state', 'a different state'),
    pacing.pacedImagePrompt.replace('collective', 'single subject'),
    pacing.pacedImagePrompt.replace('deliberate optical treatment', 'a materially different optical treatment'),
  ]) {
    assert.equal(state.readImagePromptPacing(pacing, edited), pacing);
    assert.deepEqual(state.videoImagePromptContext(edited, pacing), {
      imageDescription: pacing.originalImagePrompt, startingImagePrompt: edited,
      imagePacingHandoff: '', fullScene: pacing.fullScene,
    });
  }
});

test('automatic handle tagging, quoted handles, and harmless spacing retain pacing context without changing full source', () => {
  const { pacing, fullScene } = fixture();
  const tagged = '  The "@collective" in the selected state at the \'@location\';\n deliberate optical treatment.  ';
  assert.equal(state.readImagePromptPacing(pacing, tagged), pacing);
  const result = state.videoImagePromptContext(tagged, pacing);
  assert.equal(result.startingImagePrompt, tagged, 'use the actual currently tagged render prompt');
  assert.equal(result.imageDescription, pacing.originalImagePrompt);
  assert.equal(result.fullScene, fullScene);
  assert.equal(result.imagePacingHandoff, pacing.handoff);
});

test('rebinding a changed frame preserves the compiled story and pacing sources', () => {
  const f = fixture();
  const bound = intent.bindSceneIntentToImagePrompt(f.bundle, f.binding.sceneId, f.pacing.pacedImagePrompt, f.pacing);
  assert.equal(intent.bindSceneIntentToImagePrompt(bound, f.binding.sceneId, f.pacing.pacedImagePrompt), bound);
  const changed = 'The user committed a new visual meaning.';
  const rebound = intent.bindSceneIntentToImagePrompt(bound, f.binding.sceneId, changed);
  assert.deepEqual(rebound.scenes[f.binding.sceneId].imagePacing, f.pacing);
  assert.equal(rebound.scenes[f.binding.sceneId].boundImagePromptHash, intent.hashIntentValue(changed));
  assert.equal(rebound.scenes[f.binding.sceneId].text, f.scene.text);
  assert.equal(rebound.revision, bound.revision + 1);
  assert.equal(intent.sceneIntentMatchesPrompt(rebound.scenes[f.binding.sceneId], changed), true);
  assert.equal(intent.sceneIntentMatchesPrompt(rebound.scenes[f.binding.sceneId], f.pacing.pacedImagePrompt), false);
  assert.deepEqual(bound.scenes[f.binding.sceneId].imagePacing, f.pacing);
});

test('historical edit context and current metadata survive persistence without reactivating a stale starting look', () => {
  const f = fixture();
  const edited = 'The currently edited image depiction.';
  const scene = { ...f.scene, imagePacingContext: f.pacing, lastEditInstruction: 'Preserve the requested identity and change the visual state.' };
  const bundle = { ...f.bundle, scenes: { [f.binding.sceneId]: scene } };
  const restored = intent.parseIntentBlueprintBundle(JSON.stringify(bundle));
  assert.deepEqual(restored.scenes[f.binding.sceneId].imagePacingContext, f.pacing);
  assert.equal(restored.scenes[f.binding.sceneId].lastEditInstruction, scene.lastEditInstruction);
  assert.deepEqual(state.videoImagePromptContext(edited, restored.scenes[f.binding.sceneId].imagePacingContext), { imageDescription: f.pacing.originalImagePrompt, startingImagePrompt: edited, imagePacingHandoff: '', fullScene: f.fullScene });
});

test('legacy or malformed pacing metadata leaves the current prompt authoritative', () => {
  const { pacing } = fixture();
  const current = pacing.pacedImagePrompt;
  for (const value of [undefined, null, {}, [], { ...pacing, version: 2 }, { ...pacing, originalImagePrompt: '' },
    { ...pacing, pacedImagePrompt: '' }, { ...pacing, handoff: null }, { ...pacing, fullScene: 4 }]) {
    assert.equal(state.readImagePromptPacing(value, current), null);
    assert.deepEqual(state.videoImagePromptContext(current, value), { imageDescription: current });
  }
});

test('new video input contract activates only for a complete separately identified starting look', () => {
  const { pacing } = fixture();
  const legacy = { imageDescription: pacing.originalImagePrompt, question: pacing.fullScene, sceneIntent: { text: 'Intent' } };
  const snapshot = JSON.stringify(legacy);
  for (const body of [legacy, { ...legacy, startingImagePrompt: pacing.pacedImagePrompt },
    { ...legacy, fullScene: pacing.fullScene }, { ...legacy, startingImagePrompt: ' ', fullScene: pacing.fullScene },
    { ...legacy, startingImagePrompt: pacing.pacedImagePrompt, fullScene: '' }]) {
    assert.equal(video.videoPacingSystemContext(body), '');
    assert.equal(video.videoPacingUserContext(body), '');
  }
  assert.equal(JSON.stringify(legacy), snapshot);
});

test('video context carries the exact full scene and chosen state, and protects original intent against compressed wording', () => {
  const { pacing } = fixture();
  const body = state.videoImagePromptContext(pacing.pacedImagePrompt, pacing);
  const snapshot = JSON.stringify(body);
  const system = video.videoPacingSystemContext(body);
  assert.match(system, /ORIGINAL full-scene visual conception/);
  assert.match(system, /not a declaration that all of its actions or states already coexist at time zero/);
  assert.match(system, /preserve explicit user chronology and correct temporal or spatial compression/);
  assert.match(system, /not forbidden merely because it is not yet visible/);
  assert.match(system, /Current explicit user edits and current duration remain authoritative/);
  const user = video.videoPacingUserContext(body);
  const payload = JSON.parse(user.slice(user.indexOf('{')).trim());
  assert.deepEqual(payload, {
    startingImagePrompt: pacing.pacedImagePrompt, fullScene: pacing.fullScene, imagePacingHandoff: pacing.handoff,
  });
  assert.equal(JSON.stringify(body), snapshot);
  const withoutHandoff = { ...body, imagePacingHandoff: undefined };
  const userWithoutHandoff = video.videoPacingUserContext(withoutHandoff);
  assert.equal(JSON.parse(userWithoutHandoff.slice(userWithoutHandoff.indexOf('{')).trim()).imagePacingHandoff, '');
});
