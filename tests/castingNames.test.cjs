const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadTypeScript(file) {
  return require('./promptTestBindings.cjs').loadTypeScript(file);
}

test('character and environment names still inject images through exact saved handles', () => {
  const names = loadTypeScript('server/src/castingNames.ts');
  const { applyCharacterInjection } = loadTypeScript('server/src/characterInjection.ts');
  const scenes = ['An adventurer rides a white horse through a meadow garden.'];
  const characters = names.normalizeDetectedCharacterNames([
    { name: 'Space Adventurer' }, { name: 'White Horse' },
  ], scenes);
  const environments = names.normalizeDetectedEnvironmentNames([{ name: 'Meadow Garden' }], scenes);
  const references = [...characters, ...environments].map(reference => ({
    name: reference.name, url: `https://example.test/${reference.name}.png`,
  }));
  const result = applyCharacterInjection('@adventurer rides @horse through @meadow', references, 'flux');
  assert.equal(result.newPrompt, '<image_1> rides <image_3> through <image_2>');
  assert.deepEqual(result.updatedInputs, [
    'https://example.test/adventurer.png', 'https://example.test/meadow.png', 'https://example.test/horse.png',
  ]);
});

function castingHandler(responses) {
  const filename = path.join(root, 'server/src/GptApi.ts');
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  let handler;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'GptExtractCasting') handler = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(handler, 'The real casting handler must be found');
  const code = ts.transpileModule(`const handler = ${handler.getText(source)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  const openai = { chat: { completions: { create: async request => {
    calls.push(request);
    assert.ok(responses.length, 'Unexpected extra paid model request');
    return { choices: [{ message: { content: JSON.stringify(responses.shift()) } }] };
  } } } };
  const names = loadTypeScript('server/src/castingNames.ts');
  const call = new Function(
    'openai', 'recordOpenAiUsage', 'withReplicateFallbackModel', 'REPLICATE_DEEPSEEK_MODEL',
    'normalizeDetectedCharacterNames', 'normalizeDetectedEnvironmentNames', 'console', 'setTimeout',
    `${code}; return handler;`,
  )(
    openai, () => {}, async (_model, request) => request(), 'mock-model',
    names.normalizeDetectedCharacterNames, names.normalizeDetectedEnvironmentNames,
    { log() {}, warn() {}, error() {} }, () => 0,
  );
  const run = async body => {
    let result;
    await call({ body }, {
      send(value) { result = value; },
      status() { throw new Error('Unexpected casting error'); },
    });
    return result;
  };
  return { run, calls };
}

const scenes = ['An adventurer rides a white horse in the meadow garden beside a rose arch.'];
const firstPass = {
  characters: [{ name: 'Space Adventurer', description: 'Colorful armor.' }],
  environments: [{ name: 'The Meadow Garden', description: 'Flowers and grass.' }],
};
const audit = {
  characters: [{ name: 'White Horse', description: 'A white coat.' }],
  environments: [
    { name: 'Meadow Garden', description: 'Duplicate meadow.' },
    { name: 'Rose Arch', description: 'A rose-covered arch.' },
  ],
};

test('first-pass casting returns a single scene word for the environment with one model call', async () => {
  const { run, calls } = castingHandler([firstPass]);
  const result = await run({ prompts: scenes, firstPassOnly: true });
  assert.equal(calls.length, 1);
  assert.equal(result.data.characters[0].name, 'adventurer');
  assert.equal(result.data.environments[0].name, 'meadow');
  assert.match(calls[0].messages[0].content, /Use the first identifying word, skipping a leading article/);
  assert.equal(firstPass.environments[0].name, 'The Meadow Garden');
});

test('audit-only casting uses the same environment handle and does not duplicate its reference', async () => {
  const { run, calls } = castingHandler([audit]);
  const result = await run({ prompts: scenes, auditOnly: true, firstPassResult: structuredClone(firstPass) });
  assert.equal(calls.length, 1);
  assert.deepEqual(result.data.environments.map(environment => environment.name), ['meadow', 'rose']);
  assert.match(calls[0].messages[1].content, /Use the first identifying word, skipping a leading article/);
  assert.match(calls[0].messages[2].content, /"name":"meadow"/);
});

test('combined casting keeps both existing passes and creates no additional naming request', async () => {
  const { run, calls } = castingHandler([firstPass, audit]);
  const result = await run({ prompts: scenes });
  assert.equal(calls.length, 2);
  assert.deepEqual(result.data.characters.map(character => character.name), ['adventurer', 'horse']);
  assert.deepEqual(result.data.environments.map(environment => environment.name), ['meadow', 'rose']);
  assert.equal(result.data.environments[0].description, 'Flowers and grass.');
});

test('manual multi-word reference names remain accepted by injection', () => {
  const { applyCharacterInjection } = loadTypeScript('server/src/characterInjection.ts');
  const result = applyCharacterInjection('@Meadow Garden behind @Captain Mira', [
    { name: 'Meadow Garden', url: 'https://example.test/garden.png' },
    { name: 'Captain Mira', url: 'https://example.test/mira.png' },
  ], 'flux');
  assert.equal(result.newPrompt, '<image_1> behind <image_2>');
  assert.equal(result.updatedInputs.length, 2);
});
