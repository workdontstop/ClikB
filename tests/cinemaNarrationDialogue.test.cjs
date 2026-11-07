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
const cinema = load('server/src/cinemaNarrationDialogue.ts');
const directions = load('server/src/videoCreationContext.ts');
const source = ts.createSourceFile('GptApi.ts', fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
function handler(name, bindings) {
  bindings = { ...require('./promptTestBindings.cjs'), ...bindings };
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(found);
  const code = ts.transpileModule(`const handler = ${found.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${code}\nreturn handler;`)(...Object.values(bindings));
}

const fullText = '[calmly] Almost there. I’m calibrating the engine now. [short pause] Just one more precise adjustment... [soft satisfaction] But it’s not fully stabilizing yet.';
const speechPlan = {
  stageA: '@Cuzon, focused at the helm (calm): says "Almost there. I’m calibrating the engine now."',
  stageB: '@Cuzon, focused at the helm (calm): says "One more adjustment… but it’s still unstable."',
};
function narration(stage = 'A', duration = 5) {
  return { stage, text: fullText, delivery: 'Cuzon, calm and focused.', stages: [
    { stage: 'A', imageDescription: '@Cuzon and @Casey at the helm.', context: 'Calibrating; core flickers.', duration },
    { stage: 'B', imageDescription: '@Cuzon adjusts the helm beside @Casey.', context: 'Adjustment does not fully stabilize.', duration },
  ] };
}
const frame = 'CAMERA:\nSlow push in.\n\nMOTION:\n@Cuzon adjusts the helm beside @Casey.\n\nAUDIO:\nSoft engine hum.';
function fixture({ plan = speechPlan, visual = frame, handlerName = 'GptVideoVisual' } = {}) {
  const calls = [], charges = [];
  let response, status = 200;
  const bindings = {
    ...cinema, ...directions, logIntentBlueprintUsage() {}, buildVideoSkillBlock: () => '',
    getModelDirective: () => 'CAMERA:\nMOTION:\nAUDIO:\nVOICE & DIALOG:\nCONSTRAINTS:\nMusic: none',
    VIDEO_AUTO_PROMPT_MODEL: 'default',
    beginLlmRequest: async () => { charges.push('charged'); return { model: 'selected', charge: { pixels: 1 } }; },
    // The handler owns one billed operation, even when its callback writes both
    // visual directions and paired speech. Exercise that callback; billing/DB
    // persistence itself belongs to llmBilling's dedicated tests.
    runBilledLlmOperation: async (llm, operation, work) => {
      assert.equal(operation.stage, 'video_prompt');
      assert.ok(operation.operationKey);
      return { value: await work(), billing: llm.charge };
    },
    withLlmBilling: async (body, charge) => ({ ...body, llmBilling: charge }),
    generateGPT4oPrompt5B: async (messages, model) => {
      calls.push({ messages, model });
      return calls.length === 1 ? visual : typeof plan === 'string' ? plan : JSON.stringify(plan);
    }, console: { log() {}, error() {} },
  };
  const run = handler(handlerName, bindings);
  return { calls, charges, get status() { return status; }, async run(extra = {}) {
    await run({ body: { question: 'The crew waits for calibration.', imageDescription: '@Cuzon and @Casey at the helm.',
      PlanVid: { characters: [{ name: '@Cuzon', voice_profile: { gender: 'male', tone_baseline: 'warm' } }] },
      duration: 5, creationType: 1, cinemaNarration: narration(), sceneNumber: 1, sceneStage: 'A', ...extra } },
    { status(code) { status = code; return this; }, send(body) { response = body; return this; } });
    return response;
  } };
}

test('Cinema sends the full original speech and both independent time budgets to the charged dialogue pass', async () => {
  const f = fixture();
  const result = await f.run();
  assert.equal(f.charges.length, 1);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every(call => call.model === 'selected'));
  const prompt = f.calls[1].messages[0].content;
  assert.ok(prompt.includes(fullText));
  assert.match(prompt, /Stage A: 5 seconds; at most 12 spoken words/);
  assert.match(prompt, /Stage B: 5 seconds; at most 12 spoken words/);
  assert.match(prompt, /logically condensed explanation/);
  assert.match(prompt, /original narration's meaning, speaker/);
  assert.match(prompt, /without repeating, restarting, contradicting, or prematurely resolving/);
  assert.match(prompt, /not spoken words/);
  assert.deepEqual(result.cinemaDialoguePlan, speechPlan);
  assert.match(result.storyPrompt, /calibrating the engine now/);
  assert.doesNotMatch(result.storyPrompt, /still unstable|stageA|stageB/);
  assert.equal((result.storyPrompt.match(/VOICE & DIALOG:/g) || []).length, 1);
});

test('paired stage reuses the shared allocation without a second independent dialogue rewrite', async () => {
  const f = fixture();
  const result = await f.run({ cinemaNarration: narration('B'), cinemaDialoguePlan: speechPlan, sceneStage: 'B' });
  assert.equal(f.calls.length, 1, 'Cached allocation must not call another speech writer');
  assert.equal(f.charges.length, 1);
  assert.match(result.storyPrompt, /still unstable/);
  assert.doesNotMatch(result.storyPrompt, /calibrating the engine now/);
  assert.deepEqual(result.cinemaDialoguePlan, speechPlan);
});

test('ten-second regeneration uses original speech, with room for more detail in each stage', async () => {
  const f = fixture();
  await f.run({ duration: 10, cinemaNarration: narration('B', 10), sceneStage: 'B' });
  const prompt = f.calls[1].messages[0].content;
  assert.ok(prompt.includes(fullText));
  assert.match(prompt, /Stage A: 10 seconds; at most 25 spoken words/);
  assert.match(prompt, /Stage B: 10 seconds; at most 25 spoken words/);
  assert.match(prompt, /longer duration allows more of the original detail/);
});

test('initial opt-in keeps dialogue out of the prompt but returns the planned speaking stage for the button', async () => {
  const f = fixture({ plan: { stageA: '', stageB: speechPlan.stageB } });
  const result = await f.run({ deferDialogue: true, suppressDialogue: true, cinemaNarration: narration('B'), sceneStage: 'B' });
  assert.doesNotMatch(result.storyPrompt, /VOICE & DIALOG|still unstable/);
  assert.match(result.dialoguePrompt, /still unstable/);
  assert.equal(result.cinemaDialoguePlan.stageA, '');
  assert.equal(f.calls.length, 2);
  const silent = fixture({ plan: { stageA: '', stageB: speechPlan.stageB } });
  const a = await silent.run();
  assert.doesNotMatch(a.storyPrompt, /VOICE & DIALOG|No dialogue/);
});

test('video directions survive both visual prompting and paired dialogue planning with their stage assignments', async () => {
  const f = fixture({ plan: { stageA: '', stageB: speechPlan.stageB } });
  const video_context = { global: 'Use refined typography; no subtitles.', scenes: [
    { scene: 1, stage: 'A', instructions: 'No dialogue and no text.' },
    { scene: 1, stage: 'B', instructions: 'Reveal “Cuzon” beside him just before his first spoken word, then fade.' },
    { scene: 3, stage: 'A', instructions: 'Reveal “Laura” beside her before she speaks.' },
  ] };
  await f.run({ sceneStage: 'B', cinemaNarration: narration('B'), PlanVid: { characters: [], video_context } });
  const visualInput = f.calls[0].messages[1].content;
  assert.match(visualInput, /Reveal “Cuzon”/);
  assert.doesNotMatch(visualInput, /Reveal “Laura”|No dialogue and no text/);
  assert.match(visualInput, /need not be visible in the text-free source image/);
  const speechInput = f.calls[1].messages[0].content;
  assert.match(speechInput, /No dialogue and no text/);
  assert.match(speechInput, /Reveal “Cuzon”/);
  assert.doesNotMatch(speechInput, /Reveal “Laura”/);
});

test('replacing negative audio instructions never deletes a following requested video overlay', async () => {
  const visual = frame.replace('Soft engine hum.', 'No speech.') + '\n\nTEXT OVERLAYS:\nReveal “Cuzon” briefly beside his face.';
  const f = fixture({ visual });
  const result = await f.run({ suppressDialogue: true, deferDialogue: true });
  assert.match(result.storyPrompt, /TEXT OVERLAYS:/);
  assert.match(result.storyPrompt, /Reveal “Cuzon”/);
  assert.doesNotMatch(result.storyPrompt, /No speech/);
  assert.match(result.storyPrompt, /Soft, scene-aware ambient/);
});

test('other modes and Cinema without narration retain the existing scene dialogue writer', async () => {
  for (const creationType of [0, 2, 3]) {
    const f = fixture({ plan: '@Casey (playful): says "Nice."' });
    const result = await f.run({ creationType, cinemaDialoguePlan: speechPlan });
    assert.match(f.calls[1].messages[0].content, /expert ADR Dialogue writer/);
    assert.doesNotMatch(f.calls[1].messages[0].content, /ORIGINAL FULL NARRATION/);
    assert.equal(result.cinemaDialoguePlan, undefined);
    assert.match(result.storyPrompt, /Nice/);
  }
  const f = fixture({ plan: '@Casey (playful): says "Nice."' });
  await f.run({ cinemaNarration: undefined });
  assert.match(f.calls[1].messages[0].content, /expert ADR Dialogue writer/);
});

test('malformed paired output cannot silently fall back to unrelated improvised speech', async () => {
  const f = fixture({ plan: '@Casey (playful): says "Nice."' });
  const result = await f.run();
  assert.equal(f.status, 500);
  assert.equal(result.cinemaDialoguePlan, undefined);
  assert.equal(f.charges.length, 1);
  assert.equal(f.calls.length, 2);
});

test('explicit video exclusions survive normal, deferred and ambient-only native prompts', async () => {
  const exclusions = 'No subtitles. Do not repeat the Cuzon name reveal. Keep overlays clear of faces.';
  for (const flags of [{}, { suppressDialogue: true, deferDialogue: true }, { suppressDialogue: true }]) {
    for (const separator of ['\n\n', ' ']) {
      const f = fixture({ visual: `${frame}${separator}CONSTRAINTS:\nMusic: none\n${exclusions}` });
      const result = await f.run({ ...flags, PlanVid: { characters: [], video_context: { global: exclusions } } });
      assert.equal(f.status, 200);
      assert.ok(result.storyPrompt.includes(exclusions));
      assert.equal((result.storyPrompt.match(/CONSTRAINTS:/g) || []).length, 1);
      assert.match(f.calls[0].messages[0].content, /explicit exception to the visual boundary/);
      if (!flags.suppressDialogue) assert.match(result.storyPrompt, /calibrating the engine now/);
      else assert.doesNotMatch(result.storyPrompt, /VOICE & DIALOG:/);
    }
  }
});

test('audio-off Auto Prompt receives only its assigned overlay with a system-level image boundary exception', async () => {
  const f = fixture({ handlerName: 'GptVideoVisualMiniMax', visual: `${frame}\n\nTEXT OVERLAYS:\nCuzon appears once in designer lettering.` });
  const result = await f.run({ PlanVid: { characters: [], video_context: { scenes: [
    { scene: 1, stage: 'A', instructions: 'Reveal Cuzon once in designer lettering.' },
    { scene: 1, stage: 'B', instructions: 'No Cuzon reveal here.' },
    { scene: 3, stage: 'A', instructions: 'Reveal Laura once.' },
  ] } } });
  assert.equal(f.status, 200);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].messages[0].content, /within the selected no-audio mode/);
  assert.match(f.calls[0].messages[0].content, /explicit exception to the visual boundary/);
  const user = f.calls[0].messages[1].content;
  assert.match(user, /Reveal Cuzon once in designer lettering/);
  assert.doesNotMatch(user, /No Cuzon reveal here|Reveal Laura/);
  assert.match(result.storyPrompt, /TEXT OVERLAYS:/);
});

test('current Auto Prompt duration replaces legacy plan lengths and dialogue timecodes in both audio routes', async () => {
  const legacyPlan = {
    characters: [{ name: '@Cuzon', voice_profile: { tone_baseline: 'warm' } }],
    camera: { movement: 'Steady dolly.', duration_seconds: 5 },
    output: { fps: 30, duration_seconds: 5 },
    dialogue: [{ character_id: 'Cuzon', intended_content_description: 'Calibration remains unstable.', timecode_hint_sec: 3 }],
  };
  const snapshot = JSON.stringify(legacyPlan);
  for (const handlerName of ['GptVideoVisual', 'GptVideoVisualMiniMax']) {
    const f = fixture({ handlerName });
    const result = await f.run({ duration: 10, PlanVid: legacyPlan, cinemaNarration: narration('B', 10), sceneStage: 'B' });
    assert.equal(f.status, 200);
    assert.ok(result.storyPrompt);
    const messages = f.calls[0].messages;
    assert.match(messages[0].content, /current Target Duration controls clip timing/);
    assert.match(messages[0].content, /Do not inherit durations or timestamps from older plans/);
    assert.match(messages[1].content, /Target Duration: 10 seconds/);
    assert.doesNotMatch(messages[1].content, /duration_seconds|timecode_hint_sec/);
    assert.match(messages[1].content, /Steady dolly|Calibration remains unstable|tone_baseline/);
    assert.match(messages[1].content, /"fps": 30/);
    if (handlerName === 'GptVideoVisual') {
      assert.match(f.calls[1].messages[0].content, /Stage A: 10 seconds/);
      assert.match(f.calls[1].messages[0].content, /Stage B: 10 seconds/);
    }
  }
  assert.equal(JSON.stringify(legacyPlan), snapshot);
});
