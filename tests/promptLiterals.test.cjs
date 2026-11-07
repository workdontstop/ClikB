const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const bindings = require('./promptTestBindings.cjs');
const { cleanQuotedAtMentions, cleanPromptLiterals, mapUnquotedPromptText, loadTypeScript } = bindings;
const { applyCharacterInjection } = loadTypeScript('server/src/characterInjection.ts');

function handler(file, name, extras = {}) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), ts.ScriptTarget.Latest, true);
  let node;
  const visit = child => {
    if (ts.isVariableDeclaration(child) && child.name.getText(source) === name) node = child.initializer;
    if (ts.isFunctionDeclaration(child) && child.name?.text === name) node = child;
    ts.forEachChild(child, visit);
  };
  visit(source); assert.ok(node, name);
  const code = ts.transpileModule(`${ts.isFunctionDeclaration(node) ? '' : 'const actual = '}${node.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const values = { ...bindings, exports: {}, console: { log() {}, error() {} }, ...extras };
  return new Function(...Object.keys(values), code + `\nreturn ${ts.isFunctionDeclaration(node) ? name : 'actual'};`)(...Object.values(values));
}
function response() { return { value: undefined, code: 200, status(code) { this.code = code; return this; }, send(value) { this.value = value; return this; }, json(value) { this.value = value; return this; } }; }

test('literal quotes protect words/case while contractions and outside references stay intact', () => {
  const cases = [
    ['@Casey says "I’m @Casey; don’t panic." beside @Scene1.', '@Casey says "I’m Casey; don’t panic." beside @Scene1.'],
    ["@Casey says 'I'm @Casey, @LAURA.' near @Laura.", "@Casey says 'I'm Casey, LAURA.' near @Laura."],
    ['@Casey says “I’m @Casey” and displays ‘@ClikB Heroes’.', '@Casey says “I’m Casey” and displays ‘ClikB Heroes’.'],
    ['Casey\'s hand touches the actors\' @Scene1 card. @Casey replies "That\'s @Casey".', 'Casey\'s hand touches the actors\' @Scene1 card. @Casey replies "That\'s Casey".'],
    ['@Casey says \\"I’m @Casey\\".', '@Casey says \\"I’m Casey\\".'],
    ['@Casey says "He wrote \\"@Casey\\" on it."', '@Casey says "He wrote \\"Casey\\" on it."'],
    ['Display "@ClikB\n@Heroes". Keep @Casey.', 'Display "ClikB\nHeroes". Keep @Casey.'],
    ['Unfinished "@Casey beside @Scene1', 'Unfinished "@Casey beside @Scene1'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(cleanQuotedAtMentions(input), expected);
    assert.equal(cleanQuotedAtMentions(expected), expected, 'Must be idempotent');
  }
  assert.equal(mapUnquotedPromptText('Casey says "Casey".', text => text.replace(/Casey/g, '@Casey')), '@Casey says "Casey".');
});

test('serialized prompt JSON keeps reference speaker handles and cleans only literal text inside each prompt', () => {
  const source = [{ prompt: '@Casey says "I’m @Casey" beside @Scene1.', duration: 5 }];
  const original = JSON.stringify(source, null, 2);
  const cleaned = cleanPromptLiterals(original);
  assert.deepEqual(JSON.parse(cleaned), [{ prompt: '@Casey says "I’m Casey" beside @Scene1.', duration: 5 }]);
  const fenced = cleanPromptLiterals(`\n\`\`\`json\n${original}\n\`\`\`\n`);
  assert.match(fenced, /^\n```json\n/);
  assert.deepEqual(JSON.parse(fenced.trim().replace(/^```json\n/, '').replace(/\n```$/, '')), JSON.parse(cleaned));
  assert.equal(source[0].prompt, '@Casey says "I’m @Casey" beside @Scene1.');
});

test('image handle injection cleans literals without adding a reference for a literal-only actor', () => {
  for (const syntax of ['flux', 'seedream', 'fal']) {
    const result = applyCharacterInjection('@Casey displays "@Laura" and ‘@Casey’.', [{ name: 'Casey', url: 'casey.png' }, { name: 'Laura', url: 'laura.png' }], syntax);
    assert.match(result.newPrompt, /"Laura" and ‘Casey’/);
    assert.doesNotMatch(result.newPrompt, /@|laura\.png/);
    assert.equal(syntax === 'fal' ? result.falReferences.length : result.updatedInputs.length, 1);
    const literalOnly = applyCharacterInjection('Display "@Casey".', [{ name: 'Casey', url: 'casey.png' }], syntax);
    assert.equal(literalOnly.newPrompt, 'Display "Casey".');
    assert.equal(literalOnly.updatedInputs.length, 0);
    assert.equal(literalOnly.falReferences.length, 0);
  }
  assert.equal(applyCharacterInjection('Display "@Casey".', [], 'flux').newPrompt, 'Display "Casey".');
});

test('actual image rewrite cleans both user input and generated text before returning it', async () => {
  let messages;
  const actual = handler('server/src/GptApi.ts', 'GptRecreate', {
    UPDATE_AI_REFERENCE_HANDLE_SYSTEM_RULES: '', IMAGE_CAMERA_LANGUAGE_SKILL: '', UPDATE_WITH_AI_MODEL: 'fixture',
    generateGPT4oPromptProWebX: async value => { messages = value; return '@Casey holds a board reading "@LAURA".'; },
  });
  const res = response();
  await actual({ body: { promptx: '@Casey holds a board.', instructions: 'Write "@LAURA" on it.', logic: 'Keep @Casey.' } }, res);
  assert.equal(res.code, 200);
  assert.match(JSON.stringify(messages), /Write \\\"LAURA/);
  assert.equal(res.value.payload, '@Casey holds a board reading "LAURA".');
});

test('actual video prompt rewrite cleans literal speech while retaining outside speaker/reference handles', async () => {
  let messages;
  const actual = handler('server/src/GptApi.ts', 'EditGeneratedVisualTextOnly', {
    spatialActionUpdateInstruction: () => '', UPDATE_AI_REFERENCE_HANDLE_SYSTEM_RULES: '', UPDATE_WITH_AI_MODEL: 'fixture', buildVideoSkillBlock: () => '', getModelDirective: () => '',
    generateGPT4oPrompt5: async value => { messages = value; return 'MOTION:\n@Casey waves beside @Scene1.\nVOICE & DIALOG:\n@Casey (warm): says "I’m @Casey"'; },
  });
  const res = response();
  await actual({ body: { editvalue: 'Say “I’m @Casey”.', createdvisual: 'MOTION:\n@Casey waves.\nVOICE & DIALOG:\n@Casey: says "Hello @Laura"', duration: 5, targetModel: 'WAN' } }, res);
  assert.equal(res.code, 200);
  assert.match(JSON.stringify(messages), /I’m Casey/);
  assert.match(res.value, /@Casey \(warm\): says "I’m Casey"/);
  assert.match(res.value, /@Scene1/);
});

test('all four actual Seedance provider translations retain literal titles instead of replacing them with image tokens', async () => {
  for (const name of ['sora2', 'seedance2Mini', 'Seedance2', 'klingProRoute']) {
    let submitted;
    const actual = handler('server/src/fluxSchnellRoute.ts', name, {
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)), normalizeSeedanceResolution: () => '720p', normalizeSeedance25Resolution: () => '720p',
      appendSpatialMovementReferences: (images, prompt) => ({ prompt }), getVideoModelDisplayName: () => 'Seedance',
      appendSeedanceVideoReferences: prompt => prompt, shouldReturnProviderLink: () => true,
      createReplicateVideoJob: async (req, res, options) => { submitted = options; res.json({ jobId: 'fixture' }); return true; },
      replicate: { predictions: { create: async options => { submitted = options; return { id: 'fixture' }; } } },
      Replicate: class { predictions = { create: async options => { submitted = options; return { id: 'fixture' }; } }; },
    });
    const res = response();
    await actual({ body: { prompt: '@Casey waves and says "I’m @Casey"; display ‘@Laura’.', startImage: 'scene.png', activechracternames: [{ name: 'Casey', url: 'casey.png' }, { name: 'Laura', url: 'laura.png' }], videoLength: 5, asyncMode: true } }, res);
    assert.equal(res.code, 200, `${name}: ${JSON.stringify(res.value)}`);
    assert.ok(submitted, name);
    const input = submitted.input || submitted;
    assert.match(input.prompt, /"I’m Casey"; display ‘Laura’/);
    assert.match(input.prompt, /\[Image2\] waves/);
    assert.deepEqual(input.reference_images || input.image_urls, ['scene.png', 'casey.png']);
  }
});

test('voice preservation uses character names across reordered ids and leaves new actors and source plans intact', () => {
  const profile = { accent_description: 'London', timbre_description: 'warm alto', pitch_hint: 'mid' };
  const previous = { characters: [{ id: 'char1', name: '@Casey', voice_profile: profile }] };
  const output = { characters: [{ id: 'char1', name: 'Laura', voice_profile: { timbre_description: 'new' } }, { id: 'char2', name: 'Casey', voice_profile: { timbre_description: 'wrong' } }] };
  const snapshot = JSON.stringify(output);
  const kept = bindings.preserveAuthoredVoiceProfiles(output, previous);
  assert.deepEqual(kept.characters[1].voice_profile, profile);
  assert.deepEqual(kept.characters[0].voice_profile, output.characters[0].voice_profile);
  assert.equal(JSON.stringify(output), snapshot);
  assert.match(bindings.buildCharacterVoiceIdentityPrompt(kept.characters), /London.*warm alto/);
  assert.match(bindings.buildCharacterVoiceIdentityPrompt([]), /emotion, volume, speed and delivery may vary/);
});

test('actual video plan refresh retains authored voice profiles from the previous video plan', async () => {
  const previousPlan = { characters: [{ name: 'Casey', voice_profile: { accent_description: 'London', timbre_description: 'warm alto' } }] };
  const actual = handler('server/src/GptApi.ts', 'GptVideoPlan', {
    ...loadTypeScript('server/src/videoCreationContext.ts'), VIDEO_MOTION_LANGUAGE_SKILL: '',
    generateGPT4oPrompt5B: async () => JSON.stringify({ characters: [{ id: 'char2', name: '@Casey', voice_profile: { timbre_description: 'gravelly' } }], output: { fps: 30 } }),
  });
  const res = response();
  await actual({ body: { planImg: { characters: [{ name: 'Casey', description: 'New outfit.' }] }, steps: ['Casey at the helm.'], previousPlan } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.value.plan.characters[0].voice_profile, previousPlan.characters[0].voice_profile);
});

test('actual two-pass audio writer receives authored voice identity separately from visual pose and delivery', async () => {
  const calls = [];
  const voice = { accent_description: 'London', timbre_description: 'warm alto', pitch_hint: 'mid' };
  const actual = handler('server/src/GptApi.ts', 'GptVideoVisual', {
    ...loadTypeScript('server/src/videoCreationContext.ts'), ...loadTypeScript('server/src/cinemaNarrationDialogue.ts'),
    logIntentBlueprintUsage() {}, getModelDirective: () => 'CAMERA:\nMOTION:\nAUDIO:\nVOICE & DIALOG:\nCONSTRAINTS:\nMusic: none',
    buildVideoSkillBlock: () => '', VIDEO_AUTO_PROMPT_MODEL: 'fixture',
    beginLlmRequest: async () => ({ model: 'fixture', charge: null }), withLlmBilling: async body => body,
    generateGPT4oPrompt5B: async messages => {
      calls.push(messages);
      return calls.length === 1 ? 'CAMERA:\nClose-up.\nMOTION:\n@Casey waves.\nAUDIO:\nSoft waves.'
        : '@Casey (excited): says "I’m @Casey!"';
    },
  });
  const res = response();
  await actual({ body: { question: 'Casey celebrates.', imageDescription: '@Casey wears a new uniform.', PlanVid: { characters: [{ name: 'Casey', voice_profile: voice }] }, duration: 5, targetModel: 'WAN' } }, res);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1][0].content, /London.*warm alto/);
  assert.match(calls[1][0].content, /emotion, volume, speed and delivery may vary/);
  assert.match(res.value.storyPrompt, /@Casey \(excited\): says "I’m Casey!"/);
});
