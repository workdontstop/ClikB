const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { loadTypeScript, cleanPromptLiterals, buildSceneImageEditContext } = require('./promptTestBindings.cjs');
const root = path.resolve(__dirname, '..');
const api = ts.createSourceFile('GptApi.ts', fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const { CHARACTER_TURNAROUND, FACED_CHARACTER_SHEET, normalizeDetectedCharacterNames, normalizeDetectedEnvironmentNames } = loadTypeScript('server/src/castingNames.ts');
const { withoutVideoCreationContext } = loadTypeScript('server/src/videoCreationContext.ts');

function handler(name, generate) {
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(api) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(api);
  assert.ok(initializer, 'Production handler exists');
  const code = ts.transpileModule(`const handler = ${initializer.getText(api)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const bindings = {
    cleanPromptLiterals, CHARACTER_TURNAROUND, FACED_CHARACTER_SHEET, withoutVideoCreationContext, buildSceneImageEditContext,
    generateGPT4oPrompt5B: generate, generateGPT4oPromptProWebX: generate,
    openai: { chat: { completions: { create: async request => ({ choices: [{ message: { content: await generate(request.messages, request.model) } }] }) } } },
    normalizeDetectedCharacterNames, normalizeDetectedEnvironmentNames, recordOpenAiUsage() {},
    UPDATE_WITH_AI_MODEL: 'fixture', IMAGE_CAMERA_LANGUAGE_SKILL: '', UPDATE_AI_REFERENCE_HANDLE_SYSTEM_RULES: '',
    console: { log() {}, error() {} },
  };
  return new Function(...Object.keys(bindings), `${code}; return handler;`)(...Object.values(bindings));
}

async function run(name, body, response) {
  const calls = [];
  const call = handler(name, async (messages, model) => {
    calls.push({ messages, model });
    return typeof response === 'string' ? response : JSON.stringify(response);
  });
  let result, status = 200;
  await call({ body }, {
    status(value) { status = value; return this; },
    send(value) { result = value; return this; },
  });
  return { result, status, calls };
}

test('legacy environment subjects receive turnarounds without changing saved names or reference types', async () => {
  const { result, status, calls } = await run('GptGenerateCastingPrompts', {
    environments: [
      { name: 'helicopter', description: 'Gray rescue helicopter hovering beside the bridge.' },
      { name: 'bridge', description: 'Fractured concrete bridge over a canyon.' },
    ],
    prompts: ['The helicopter returns to the same bridge in the next beat.'],
    plan: { art_style: { style_token: 'Anime' } },
  }, [
    { name: 'helicopter', type: 'environment', referenceKind: 'subject', imagePrompt: 'Gray rescue helicopter, complete aircraft views on white, Anime art style' },
    { name: 'bridge', type: 'environment', referenceKind: 'location', imagePrompt: 'Fractured concrete bridge and canyon, Anime art style' },
  ]);
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(result.prompts.map(item => [item.name, item.type, item.referenceKind]), [
    ['helicopter', 'environment', 'subject'], ['bridge', 'environment', 'location'],
  ]);
  assert.ok(result.prompts[0].imagePrompt.startsWith(CHARACTER_TURNAROUND));
  assert.match(result.prompts[1].imagePrompt, /^Clean unpopulated location reference plate/);
  assert.doesNotMatch(result.prompts[1].imagePrompt, /360-degree/);
  assert.match(calls[0].messages[0].content, /legacy environment entry may still describe a movable subject/);
});

test('collective membership and nonhuman design survive complete source context and turnaround assembly', async () => {
  const source = 'Four distinct angels, two feathered wing pairs each, retain their different face shapes and silver markings across both scenes.';
  const design = 'Four distinct angels, two feathered wing pairs each, individual face shapes and silver markings, Anime art style';
  const { result, calls } = await run('GptGenerateCastingPrompts', {
    characters: [{ name: 'angels', description: source }], prompts: [source], plan: { prompt_summary: source },
  }, [{ name: 'angels', type: 'character', referenceKind: 'subject', imagePrompt: design }]);
  assert.equal(result.prompts.length, 1);
  assert.equal(result.prompts[0].imagePrompt, `${CHARACTER_TURNAROUND} ${design}`);
  assert.match(calls[0].messages[1].content, /Four distinct angels, two feathered wing pairs each/);
  assert.match(calls[0].messages[0].content, /Repeated turnaround views are not additional cast members/);
  assert.doesNotMatch(CHARACTER_TURNAROUND, /SAME character|single unit|other characters/);
});

test('first-pass detection preserves collective descriptions and receives full source scenes without a naming call', async () => {
  const source = 'Four distinct angels with different faces and silver markings return aboard the rescue helicopter. The handgun appears later.';
  const description = 'Four distinct angels with different faces, two feathered wing pairs each and silver markings.';
  const { result, status, calls } = await run('GptExtractCasting', {
    prompts: [source], firstPassOnly: true,
  }, {
    characters: [{ name: 'angels', description }, { name: 'helicopter', description: 'Gray rescue aircraft.' }, { name: 'handgun', description: 'Compact dark metal.' }],
    environments: [],
  });
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(result.data.characters.map(item => item.name), ['angels', 'helicopter', 'handgun']);
  assert.equal(result.data.characters[0].description, description);
  assert.ok(calls[0].messages[1].content.includes(source));
  assert.match(calls[0].messages[0].content, /Place these physical subjects in characters/);
  assert.match(calls[0].messages[0].content, /Do not exclude a qualifying collective solely because its members lack individual proper names/);
});

test('named reference outputs remain attached to their entity when model order differs', async () => {
  const { result } = await run('GptGenerateCastingPrompts', {
    characters: [{ name: 'driver' }], environments: [{ name: 'bridge' }],
  }, [
    { name: 'bridge', type: 'environment', referenceKind: 'location', imagePrompt: 'Concrete bridge, Anime art style' },
    { name: 'driver', type: 'character', referenceKind: 'subject', imagePrompt: 'Black-haired driver in fitted jacket, Anime art style' },
  ]);
  assert.deepEqual(result.prompts.map(item => item.name), ['driver', 'bridge']);
  assert.match(result.prompts[0].imagePrompt, /Black-haired driver/);
  assert.doesNotMatch(result.prompts[0].imagePrompt, /Concrete bridge/);
  assert.match(result.prompts[1].imagePrompt, /Concrete bridge/);
});

test('incomplete model output fails without handing an empty or misassigned reference to generation', async () => {
  const { status, result, calls } = await run('GptGenerateCastingPrompts', {
    characters: [{ name: 'driver' }, { name: 'angels' }],
  }, [{ name: 'driver', imagePrompt: 'Driver, Anime art style' }]);
  assert.equal(status, 502);
  assert.equal(result.prompts, undefined);
  assert.equal(calls.length, 1);
});

test('reference editor overrides stale scenery while ordinary scene rewrites retain their normal context', async () => {
  const reference = await run('GptRecreate', {
    logic: 'Character/Environment reference for: angels',
    promptx: 'Four winged beings in a mountain valley.',
    instructions: 'Make this a complete 360-degree reference sheet.', imageUrl: 'https://example.test/old-image.png',
  }, 'Four winged beings, complete turnaround views on white, Anime art style');
  assert.equal(reference.calls.length, 1);
  assert.match(reference.calls[0].messages[0].content, /REFERENCE PRESENTATION CONTEXT/);
  assert.match(reference.calls[0].messages[0].content, /Remove unrelated background content/);
  assert.match(reference.calls[0].messages[0].content, /Preserve the contextually intended subject composition, membership, count/);
  assert.equal(reference.calls[0].messages[1].content[1].image_url.url, 'https://example.test/old-image.png');
  assert.equal(reference.result.payload, 'Four winged beings, complete turnaround views on white, Anime art style');

  const scene = await run('GptRecreate', {
    logic: 'Current scene image', promptx: 'Driver beside the helicopter.', instructions: 'Make the lighting warmer.',
  }, 'Driver beside the helicopter in warm light.');
  assert.doesNotMatch(scene.calls[0].messages[0].content, /REFERENCE PRESENTATION CONTEXT/);
  assert.match(scene.calls[0].messages[0].content, /PRESERVE EVERYTHING THE INSTRUCTION DID NOT ASK YOU TO CHANGE/);
});

test('faced characters receive 3-panel sheet with polygon-masked full-body front face + back + HD portrait, while vehicles keep 360 turnaround', async () => {
  const { result, status, calls } = await run('GptGenerateCastingPrompts', {
    characters: [
      { name: 'Maren', description: '38-year-old female diver-knight with facial scars and burgundy hooded cloak.' },
      { name: 'Submarine', description: 'Compact brass deep-sea submersible with glass dome.' },
    ],
    prompts: ['Maren pilots the submarine into the flooded ward.'],
    plan: { art_style: { style_token: 'Cinematic Concept Art' } },
  }, [
    {
      name: 'Maren',
      type: 'character',
      referenceKind: 'subject',
      hasFace: true,
      imagePrompt: 'Maren in dark leather diver armor and burgundy hooded cloak, Cinematic Concept Art art style',
    },
    {
      name: 'Submarine',
      type: 'character',
      referenceKind: 'subject',
      hasFace: false,
      imagePrompt: 'Compact brass deep-sea submersible with glass dome, Cinematic Concept Art art style',
    },
  ]);
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  assert.ok(result.prompts[0].imagePrompt.startsWith(FACED_CHARACTER_SHEET));
  assert.match(result.prompts[0].imagePrompt, /full-body front view with the facial area obscured by a clean flat white geometric polygon cutout/);
  assert.match(result.prompts[0].imagePrompt, /full-body back view/);
  assert.match(result.prompts[0].imagePrompt, /large high-definition close-up chest-up portrait/);
  assert.ok(result.prompts[1].imagePrompt.startsWith(CHARACTER_TURNAROUND));
  assert.doesNotMatch(result.prompts[1].imagePrompt, /polygon cutout/);
});
