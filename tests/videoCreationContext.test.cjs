const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText)(module, module.exports);
  return module.exports;
}
const helpers = load('server/src/videoCreationContext.ts');
const { CHARACTER_TURNAROUND } = load('server/src/castingNames.ts');
const api = ts.createSourceFile('GptApi.ts', fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
function actualHandler(name, bindings) {
  bindings = { ...require('./promptTestBindings.cjs'), ...bindings };
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(api) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(api);
  assert.ok(initializer, `Production handler ${name} exists`);
  const code = ts.transpileModule(`const handler = ${initializer.getText(api)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), code + '\nreturn handler;')(...Object.values(bindings));
}
async function run(name, body, modelResult) {
  const calls = [];
  let response, status = 200;
  const generate = async messages => { calls.push(messages); return typeof modelResult === 'string' ? modelResult : JSON.stringify(modelResult); };
  const handler = actualHandler(name, {
    ...helpers, CHARACTER_TURNAROUND, artStyles: ['Anime'], IMAGE_CAMERA_LANGUAGE_SKILL: '', VIDEO_MOTION_LANGUAGE_SKILL: '',
    INITIAL_IMAGE_PROMPT_MODEL: 'fixture', B_SHOT_IMAGE_PROMPT_MODEL: 'fixture',
    generateGPT4oPromptProWebT: generate, generateGPT4oPrompt5B: generate, generateGPT4oPrompt5: generate,
    // This fixture verifies the original image writer's plan isolation. The
    // real two-stage pipeline, its context and billing have separate tests.
    prepareInitialImagePrompts: async (_req, _res, config) => {
      const original = config.parseOriginal(await generate(config.baseMessages));
      return { images: original.map((prompt, index) => ({ version: 1,
        originalImagePrompt: prompt, pacedImagePrompt: prompt, handoff: '', fullScene: config.scenes[index].fullScene,
      })) };
    },
    initialImagePromptError: (res, error) => res.status(500).send({ message: error.message }),
    beginLlmRequest: async () => ({ model: 'fixture', charge: null }), withLlmBilling: async value => value,
    logIntentBlueprintUsage() {}, console: { log() {}, error() {} },
  });
  await handler({ body }, { status(value) { status = value; return this; }, send(value) { response = value; return this; } });
  assert.equal(status, 200);
  assert.equal(calls.length, 1);
  return { response, messages: calls[0] };
}

const context = {
  global: 'No music. Name reveals use refined designer typography and appear only once.',
  scenes: [
    { scene: 1, stage: 'B', instructions: 'Reveal exact text "Cuzon" beside him just before his first spoken word, then fade.' },
    { scene: 3, stage: 'A', instructions: 'Reveal exact text "Laura" beside her before her first spoken word, then fade.' },
    { scene: 9, stage: 'B', instructions: 'After "Come with me", show "ClikB Heroes" only in the final two seconds.' },
  ],
};
const imagePlan = { prompt_summary: 'Seven friends aboard their ship above Earth.', art_style: { style_token: 'Anime' }, characters: [{ id: 'char1', name: 'Cuzon', description: 'Adult man with dark braids.' }] };

test('actual active initial plan schema preserves optional explicit video instructions and disambiguates Cinema stages', async () => {
  const { response, messages } = await run('GptPlan', {
    pp: 'In Scene 1B, briefly reveal Cuzon beside him before his first spoken word. No music.',
    x: ['Scene 1 A: establish the ship', 'Scene 1 B: Cuzon at the helm'], creationType: 1,
  }, { ...imagePlan, video_context: context });
  assert.deepEqual(response.plan.video_context, context);
  assert.deepEqual(response.plan.characters, imagePlan.characters);
  assert.match(messages[0].content, /"video_context":\s*\{\s*\/\/ OPTIONAL/);
  assert.match(messages[0].content, /ONLY video-specific instructions stated by the user in Prompt/);
  assert.match(messages[0].content, /two entries share one scene number/);
  assert.match(messages[0].content, /Keep video-only directions in video_context/);
  assert.match(messages[1].content, /Creation type: 1/);
  assert.match(messages[1].content, /In Scene 1B/);
});

test('actual initial plan omits absent and empty video context without changing its existing format', async () => {
  for (const extra of [{}, { video_context: null }, { video_context: { global: ' ', scenes: [] } }]) {
    const { response, messages } = await run('GptPlan', { pp: 'A cat sits in a garden.', x: ['Cat in a garden'], creationType: 0 }, { ...imagePlan, ...extra });
    assert.deepEqual(response.plan, imagePlan);
    assert.match(messages[0].content, /OMIT video_context completely, including null or empty placeholders/);
    assert.match(messages[1].content, /Creation type: 0/);
  }
});

test('actual video plan retains source instructions even when the second model omits or changes them', async () => {
  const planImg = { ...imagePlan, video_context: context };
  const snapshot = JSON.stringify(planImg);
  for (const extra of [{}, { video_context: { global: 'Invented generic title.', scenes: [] } }]) {
    const { response, messages } = await run('GptVideoPlan', { planImg, steps: ['Cuzon adjusts the helm.'] }, {
      characters: imagePlan.characters, output: { fps: 30, duration_seconds: 5 },
      audio: { music: { use_music: true, description: 'music', intensity: 'high' } }, ...extra,
    });
    assert.deepEqual(response.plan.video_context, context);
    assert.deepEqual(response.plan.audio.music, { use_music: false, description: null, intensity: 'none' });
    assert.match(messages[0].content, /explicitly use those user-specified video directions/);
    assert.match(messages[0].content, /"video_context":/);
    assert.match(messages[1].content, /Cuzon.*first spoken word/);
  }
  assert.equal(JSON.stringify(planImg), snapshot);
});

test('actual video plan removes invented context when the source plan supplied none', async () => {
  const { response, messages } = await run('GptVideoPlan', { planImg: imagePlan, steps: ['Cuzon adjusts the helm.'] }, {
    characters: imagePlan.characters, video_context: context,
  });
  assert.equal(Object.hasOwn(response.plan, 'video_context'), false);
  assert.doesNotMatch(messages[0].content, /"video_context":/);
  assert.doesNotMatch(messages[1].content, /designer typography|Reveal exact text/);
});

test('video context selection carries global directions and only the assigned scene/stage', () => {
  const plan = { ...imagePlan, video_context: context };
  const a = helpers.buildVideoCreationContextPrompt(plan, 1, 'A');
  const b = helpers.buildVideoCreationContextPrompt(plan, 1, 'B');
  assert.match(a, /No music/);
  assert.doesNotMatch(a, /Reveal exact text/);
  assert.match(b, /Cuzon.*first spoken word/);
  assert.doesNotMatch(b, /Laura|ClikB Heroes/);
  assert.match(b, /A newer explicit user change takes priority/);
  assert.match(b, /need not be visible in the text-free source image/);
  assert.match(b, /never add unseen characters/);
  assert.deepEqual(helpers.selectVideoCreationContext(plan, 9, 'B').scenes, [context.scenes[2]]);
  assert.deepEqual(helpers.selectVideoCreationContext(plan), context);
  assert.equal(helpers.buildVideoCreationContextPrompt(imagePlan, 1, 'A'), '');
  assert.equal(helpers.buildVideoCreationContextPrompt(null), '');
});

test('real base image prompt writers receive all existing plan fields without video-only directions', async () => {
  const Planx = { ...imagePlan, extraVisualData: 'Maintain warm lighting.', video_context: context };
  const snapshot = JSON.stringify(Planx);
  for (const name of ['GptTextVisual', 'GptTextVisualStages', 'GptTextVisualKontext', 'GptTextVisualKontextStages', 'gptWorldImage']) {
    const { messages } = await run(name, { text: 'Cuzon at the helm.', prompt: 'Spacecraft above Earth.', Planx, planContext: Planx }, 'Place Cuzon at the helm. ---STAGE2--- Place Cuzon closer.');
    const planMessage = messages.find(message => /VISUAL PLAN|^CONTEXT:/.test(message.content));
    assert.ok(planMessage, name);
    assert.match(planMessage.content, /Adult man with dark braids/);
    assert.match(planMessage.content, /Maintain warm lighting/);
    assert.doesNotMatch(planMessage.content, /video_context|designer typography|Reveal exact text/);
  }
  assert.equal(JSON.stringify(Planx), snapshot);
});

test('malformed optional context is omitted and image omission leaves absent plans alone', () => {
  assert.equal(helpers.normalizeVideoCreationContext({ scenes: [{ scene: 0, instructions: 'Wrong' }, { scene: 1, stage: 'C', instructions: 'Wrong' }] }), undefined);
  assert.deepEqual(helpers.normalizeVideoCreationContext({ global: ' Keep exact words. ', scenes: [{ scene: '2', instructions: ' Keep this shot. ' }] }), { global: 'Keep exact words.', scenes: [{ scene: 2, instructions: 'Keep this shot.' }] });
  assert.equal(helpers.withoutVideoCreationContext(imagePlan), imagePlan);
  assert.equal(helpers.withoutVideoCreationContext(null), null);
  assert.equal(helpers.normalizeVideoCreationContext({ scenes: [{ scene: true, instructions: 'Invalid boolean scene' }] }), undefined);
  assert.equal(helpers.buildVideoCreationContextPrompt(imagePlan, Symbol('invalid')), '');
});

test('real character casting excludes video directions while preserving story wardrobe instructions', async () => {
  const plan = { ...imagePlan, prompt_summary: 'Cuzon wears a formal black tuxedo at a wedding.', video_context: context };
  const { messages, response } = await run('GptGenerateCastingPrompts', {
    plan, characters: [{ name: 'Cuzon', isVip: true, description: 'Adult man with dark braids.' }], scenes: ['Cuzon at a wedding.'],
  }, [{ name: 'Cuzon', type: 'character', imagePrompt: 'Cuzon wearing a formal black tuxedo, Anime art style' }]);
  assert.match(messages[1].content, /formal black tuxedo at a wedding/);
  assert.doesNotMatch(messages[1].content, /video_context|designer typography|Reveal exact text/);
  assert.match(response.prompts[0].imagePrompt, /360-degree subject turnaround/);
});

test('saved video plan timing is removed without changing creative guidance, ordering, fps or source data', () => {
  const plan = {
    characters: [{ name: 'Cuzon', description: 'Adult man with dark braids.', voice_profile: { pace_description: 'Warm and unhurried.' } }],
    camera: { movement: 'Slow dolly.', duration_seconds: 5, cut_style: 'one_take' },
    output: { fps: 30, duration_seconds: 5 },
    dialogue: [
      { character_id: 'char1', delivery_description: 'Warm.', intended_content_description: 'Reassures the crew.', timecode_hint_sec: 0 },
      { character_id: 'char2', delivery_description: 'Playful.', intended_content_description: 'Responds after Cuzon.', timecode_hint_sec: 3 },
    ],
    video_context: { scenes: [{ scene: 1, stage: 'B', instructions: 'Reveal Cuzon for one second before speaking; fade, then continue.' }] },
  };
  const snapshot = JSON.stringify(plan);
  const result = helpers.withoutVideoPlanTiming(plan);
  assert.deepEqual(result.camera, { movement: 'Slow dolly.', cut_style: 'one_take' });
  assert.deepEqual(result.output, { fps: 30 });
  assert.deepEqual(result.dialogue, [
    { character_id: 'char1', delivery_description: 'Warm.', intended_content_description: 'Reassures the crew.' },
    { character_id: 'char2', delivery_description: 'Playful.', intended_content_description: 'Responds after Cuzon.' },
  ]);
  assert.equal(result.characters, plan.characters);
  assert.equal(result.video_context, plan.video_context);
  assert.equal(JSON.stringify(plan), snapshot);
  assert.equal(helpers.withoutVideoPlanTiming(imagePlan), imagePlan);
  assert.equal(helpers.withoutVideoPlanTiming(null), null);
});

test('actual video planning excludes clip-length and timecode fields and discards legacy model output timing', async () => {
  const generated = {
    characters: imagePlan.characters, camera: { movement: 'Slow dolly.', duration_seconds: 5 },
    output: { fps: 30, duration_seconds: 5 },
    dialogue: [
      { character_id: 'char1', delivery_description: 'Warm.', intended_content_description: 'Cuzon speaks before Casey.', timecode_hint_sec: 0 },
      { character_id: 'char2', delivery_description: 'Playful.', intended_content_description: 'Casey answers.', timecode_hint_sec: 3 },
    ],
  };
  const { response, messages } = await run('GptVideoPlan', { planImg: { ...imagePlan, video_context: context }, steps: ['Cuzon speaks, then Casey answers.'] }, generated);
  assert.doesNotMatch(messages[0].content, /"duration_seconds"|"timecode_hint_sec"/);
  assert.deepEqual(response.plan.camera, { movement: 'Slow dolly.' });
  assert.deepEqual(response.plan.output, { fps: 30 });
  assert.deepEqual(response.plan.dialogue.map(row => row.character_id), ['char1', 'char2']);
  assert.equal(Object.hasOwn(response.plan.dialogue[0], 'timecode_hint_sec'), false);
  assert.match(response.plan.dialogue[0].intended_content_description, /before Casey/);
  assert.deepEqual(response.plan.video_context, context);
  assert.equal(generated.camera.duration_seconds, 5);
  assert.equal(generated.dialogue[0].timecode_hint_sec, 0);
});
