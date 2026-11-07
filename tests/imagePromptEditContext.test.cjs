const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const bindings = require('./promptTestBindings.cjs');
const { buildSceneImageEditContext } = bindings;
const api = ts.createSourceFile('GptApi.ts', fs.readFileSync(path.resolve(__dirname, '../server/src/GptApi.ts'), 'utf8'), ts.ScriptTarget.Latest, true);

function actual(name, extras = {}) {
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(api) === name) found = node.initializer;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(api);
  assert.ok(found, name);
  const declaration = ts.isFunctionDeclaration(found);
  const code = ts.transpileModule(`${declaration ? '' : 'const call = '}${found.getText(api)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const values = {
    ...bindings, UPDATE_AI_REFERENCE_HANDLE_SYSTEM_RULES: '', IMAGE_CAMERA_LANGUAGE_SKILL: '',
    UPDATE_WITH_AI_MODEL: 'fixture', console: { log() {}, error() {} }, ...extras,
  };
  return new Function(...Object.keys(values), `${code}; return ${declaration ? name : 'call'};`)(...Object.values(values));
}

const context = {
  originalImagePrompt: 'The full intended scene, optical treatment and subsequent action.',
  pacedImagePrompt: 'The chosen visible opening state.',
  handoff: 'The selected opening leads into the intended subsequent development.',
  fullScene: 'The complete scene including explicit action order and spatial relationships.',
};

function contextData(text) { return JSON.parse(text.slice(text.indexOf('\n') + 1)); }

test('supporting edit context retains full source text, current edit and scene intent without truncation', () => {
  const fullScene = `${'A long complete scene. '.repeat(600)}End of the scene.`;
  const intent = { sceneId: 'scene-1', text: 'Preserve the scene meaning.', lastEditInstruction: 'Keep the subject beside the window.' };
  const result = buildSceneImageEditContext({
    promptx: 'The current edited opening.', instructions: 'Change the focal emphasis.',
    imagePacingContext: { ...context, fullScene, ignoredField: 'This is not a supported field.' }, sceneIntent: intent,
  });
  const data = contextData(result.userContext);
  assert.equal(data.fullScene, fullScene);
  assert.equal(data.originalImagePrompt, context.originalImagePrompt);
  assert.equal(data.historicalOriginalPacedImagePrompt, context.pacedImagePrompt);
  assert.equal(data.historicalOriginalPacingHandoff, context.handoff);
  assert.equal(data.currentEditableImagePrompt, 'The current edited opening.');
  assert.equal(data.currentEditInstruction, 'Change the focal emphasis.');
  assert.deepEqual(data.lastCommittedSceneIntent, intent);
  assert.equal(data.lastEditInstruction, 'Keep the subject beside the window.');
  assert.equal(data.contextRoles.originalImagePrompt, 'HISTORICAL ORIGINAL FULL-SCENE IMAGE PROMPT');
  assert.equal(data.contextRoles.historicalOriginalPacedImagePrompt, 'HISTORICAL ORIGINAL PACED IMAGE PROMPT; may predate committed edits');
  assert.equal(data.contextRoles.currentEditableImagePrompt, 'CURRENT STARTING DEPICTION AND EDIT TARGET immediately before this edit');
  assert.equal(data.contextRoles.lastCommittedSceneIntent, 'LAST COMMITTED INTENT before this new edit');
  assert.equal(Object.hasOwn(data, 'ignoredField'), false);
  assert.match(result.systemPrompt, /current explicit instruction/);
  assert.match(result.systemPrompt, /Do not automatically restore subsequent events/);
});

test('reference editors and absent or malformed pacing metadata receive no scene-pacing context', () => {
  for (const body of [null, {}, { imagePacingContext: [] }, { imagePacingContext: { originalImagePrompt: 4 } },
    { logic: 'Character/Environment reference for: angels', imagePacingContext: context }]) {
    assert.deepEqual(buildSceneImageEditContext(body), { systemPrompt: '', userContext: '' });
  }
});

async function rewrite(name, body) {
  const calls = [];
  const output = 'The edited opening, preserving the selected depicted moment.';
  const call = actual(name, {
    buildMessages: actual('buildMessages'), scanNSFW: actual('scanNSFW'),
    generateGPT4oPromptProWebX: async (messages, model) => { calls.push({ messages, model }); return output; },
  });
  let result, status = 200;
  await call({ body }, {
    status(value) { status = value; return this; }, send(value) { result = value; return this; },
  });
  return { calls, result, status, output };
}

test('normal scene Update with AI includes separate original/paced context and retains current image input in one call', async () => {
  const { calls, result, status, output } = await rewrite('GptRecreate', {
    promptx: 'The current edited opening.', instructions: 'Change the focal emphasis.', logic: 'Scene image update',
    imagePacingContext: context, sceneIntent: { text: 'Full scene intent.' }, imageUrl: 'https://example.test/current.png',
  });
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.equal(result.payload, output);
  assert.equal(calls[0].model, 'fixture');
  const [system, current, supporting] = calls[0].messages;
  assert.match(system.content, /SCENE IMAGE EDIT CONTEXT/);
  assert.match(current.content[0].text, /Change the focal emphasis/);
  assert.equal(current.content[1].image_url.url, 'https://example.test/current.png');
  assert.equal(contextData(supporting.content).originalImagePrompt, context.originalImagePrompt);
  assert.deepEqual(contextData(supporting.content).lastCommittedSceneIntent, { text: 'Full scene intent.' });
});

test('Safety scene rewrite retains sanitization and image input while receiving the same supporting context in one call', async () => {
  const { calls, result, status, output } = await rewrite('GptRecreateSafe', {
    promptx: 'A character holds a cup.', instructions: 'Preserve the chosen visible moment.',
    imagePacingContext: context, sceneIntent: 'Complete scene intent.', imageUrl: 'https://example.test/current.png',
  });
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.equal(result.payload, output);
  assert.equal(result.meta.original_prompt, 'A character holds a cup.');
  assert.equal(result.meta.redacted, false);
  const [system, current, supporting] = calls[0].messages;
  assert.match(system.content, /Trust & Safety rewriting engine/);
  assert.match(system.content, /SCENE IMAGE EDIT CONTEXT/);
  assert.equal(current.content[1].image_url.url, 'https://example.test/current.png');
  assert.equal(contextData(supporting.content).currentEditInstruction, 'Preserve the chosen visible moment.');
  assert.equal(contextData(supporting.content).lastCommittedSceneIntent, 'Complete scene intent.');
});

test('latest replacement requests remain explicit while original scene, prior handoff and committed intent are labeled history', async () => {
  const instructions = 'Replace the entire scene with an abstract geometric composition, no people, using a new style and palette.';
  const { calls, result, status } = await rewrite('GptRecreate', {
    promptx: 'A person at a table, naturalistic portrait style.', instructions,
    imagePacingContext: context,
    sceneIntent: { text: 'A person drinks at a table.', lastEditInstruction: 'Keep the naturalistic portrait style.' },
  });
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  const [system, current, supporting] = calls[0].messages;
  assert.match(system.content, /replace the scene entirely/);
  assert.match(system.content, /historical context must not constrain explicit additions, removals or replacements/);
  assert.match(system.content, /LAST COMMITTED INTENT before this new edit/);
  assert.match(system.content, /not a separate user request or an immutable ground truth for this rewrite/);
  assert.ok(current.content.includes(instructions));
  const data = contextData(supporting.content);
  assert.equal(data.currentEditInstruction, instructions);
  assert.equal(data.lastEditInstruction, 'Keep the naturalistic portrait style.');
  assert.equal(data.originalImagePrompt, context.originalImagePrompt);
  assert.equal(result.payload, 'The edited opening, preserving the selected depicted moment.');
});

test('available prior edit instruction is passed without inventing one for older callers', () => {
  const withPrevious = buildSceneImageEditContext({ imagePacingContext: context, lastEditInstruction: 'Change the wardrobe.' });
  assert.equal(contextData(withPrevious.userContext).lastEditInstruction, 'Change the wardrobe.');
  const withEmptyCommitted = buildSceneImageEditContext({ imagePacingContext: context, sceneIntent: { lastEditInstruction: ' ' }, lastEditInstruction: 'Change the wardrobe.' });
  assert.equal(contextData(withEmptyCommitted.userContext).lastEditInstruction, 'Change the wardrobe.');
  const legacy = buildSceneImageEditContext({ imagePacingContext: context });
  assert.equal(Object.hasOwn(contextData(legacy.userContext), 'lastEditInstruction'), false);
});

test('a repeated scene edit uses the latest editable prompt as current while initial pacing stays historical', async () => {
  const firstInstruction = 'Replace the scene and remove its original subjects.';
  const first = await rewrite('GptRecreate', {
    promptx: context.pacedImagePrompt, instructions: firstInstruction, imagePacingContext: context,
    sceneIntent: { text: 'The original scene intention.' },
  });
  const lastCommittedIntent = {
    text: 'The committed replacement scene intention.', lastEditInstruction: firstInstruction, revision: 2,
  };
  const second = await rewrite('GptRecreate', {
    promptx: first.result.payload, instructions: 'Refine the current replacement composition.',
    imagePacingContext: context, sceneIntent: lastCommittedIntent,
  });
  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 1);
  const data = contextData(second.calls[0].messages.at(-1).content);
  assert.equal(data.currentEditableImagePrompt, first.result.payload);
  assert.notEqual(data.currentEditableImagePrompt, context.pacedImagePrompt);
  assert.equal(data.historicalOriginalPacedImagePrompt, context.pacedImagePrompt);
  assert.equal(data.historicalOriginalPacingHandoff, context.handoff);
  assert.equal(data.originalImagePrompt, context.originalImagePrompt);
  assert.deepEqual(data.lastCommittedSceneIntent, lastCommittedIntent);
  assert.equal(data.lastEditInstruction, firstInstruction);
  assert.equal(data.currentEditInstruction, 'Refine the current replacement composition.');
  assert.equal(Object.hasOwn(data, 'pacedImagePrompt'), false);
  assert.equal(Object.hasOwn(data, 'handoff'), false);
  assert.match(second.calls[0].messages[0].content, /current editable image prompt alone supplies the current starting depiction/);
  assert.match(data.contextRoles.historicalOriginalPacingHandoff, /HISTORICAL/);
});

test('legacy Safety callers keep their original two-message operation and response shape', async () => {
  const { calls, result, status } = await rewrite('GptRecreateSafe', { promptx: 'A character holds a cup.' });
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].messages.length, 2);
  assert.doesNotMatch(calls[0].messages[0].content, /SCENE IMAGE EDIT CONTEXT/);
  assert.ok(result.meta.flags);
});
