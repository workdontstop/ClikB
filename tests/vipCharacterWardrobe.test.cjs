const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const castingSource = fs.readFileSync(path.join(root, 'server/src/castingNames.ts'), 'utf8');
const castingModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(castingSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(castingModule, castingModule.exports);
const { CHARACTER_TURNAROUND } = castingModule.exports;
const videoContextModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'server/src/videoCreationContext.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(videoContextModule, videoContextModule.exports);
const { withoutVideoCreationContext } = videoContextModule.exports;

const source = ts.createSourceFile('GptApi.ts', fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
let initializer;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'GptGenerateCastingPrompts') initializer = node.initializer;
  ts.forEachChild(node, visit);
};
visit(source);
assert.ok(initializer, 'The production casting handler must exist');
const handlerCode = ts.transpileModule('const handler = ' + initializer.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

async function generate(body, generatedPrompts) {
  let messages;
  let response;
  const handler = new Function('generateGPT4oPrompt5B', 'CHARACTER_TURNAROUND', 'withoutVideoCreationContext', 'console', 'cleanPromptLiterals', handlerCode + '; return handler;')(
    async value => { messages = value; return JSON.stringify(generatedPrompts); },
    CHARACTER_TURNAROUND,
    withoutVideoCreationContext,
    { log() {}, error: console.error },
    require('./promptTestBindings.cjs').cleanPromptLiterals,
  );
  await handler({ body }, {
    send: value => { response = value; },
    status: code => { throw new Error('Unexpected casting failure: ' + code); },
  });
  return { messages, response };
}

const vip = { name: 'Kyro', isVip: true, description: 'Adult man with vivid blue swept-back hair, wearing a brown leather coat.' };

test('turnaround layout does not add a wardrobe or equipment preservation requirement', () => {
  assert.match(CHARACTER_TURNAROUND, /front, left profile, back and right profile full-body/);
  assert.match(CHARACTER_TURNAROUND, /subject composition, membership, count, identities/);
  assert.match(CHARACTER_TURNAROUND, /pure white background/);
  assert.match(CHARACTER_TURNAROUND, /No unrelated scenery, unrequested subjects, labels or text/);
  assert.doesNotMatch(CHARACTER_TURNAROUND, /outfit|clothing|equipment|gear/i);
});

test('explicit VIP wardrobe changes reach the casting writer and remain in the final image prompt', async () => {
  const imagePrompt = 'Kyro, preserve identity from input reference image; replace original outfit with white medical scrubs and practical shoes, Anime art style';
  const { messages, response } = await generate({
    characters: [vip],
    environments: [{ name: 'Clinic', description: 'A quiet examination room.' }],
    plan: 'Anime. Kyro must wear white medical scrubs instead of his usual brown coat.',
    scenes: ['Kyro examines a patient in the clinic.'],
  }, [
    { name: 'WrongName', type: 'character', imagePrompt },
    { name: 'Clinic', type: 'environment', imagePrompt: 'Quiet examination room, Anime art style' },
  ]);
  const system = messages.find(message => message.role === 'system').content;
  const context = messages.find(message => message.role === 'user').content;
  assert.match(context, /white medical scrubs instead of his usual brown coat/);
  assert.match(context, /"isVip":true/);
  assert.match(context, /brown leather coat/);
  assert.match(system, /Preserving identity does not mean preserving.*clothing or equipment/);
  assert.match(system, /imagePrompt must explicitly separate identity from clothing/);
  assert.doesNotMatch(system, /consistent proportions and outfit|consistent scale, anatomy, outfit/i);
  assert.equal(response.prompts[0].name, 'Kyro');
  assert.equal(response.prompts[0].imagePrompt, `${CHARACTER_TURNAROUND} ${imagePrompt}`);
  assert.match(response.prompts[1].imagePrompt, /^Clean unpopulated location reference plate\./);
  assert.ok(response.prompts[1].imagePrompt.endsWith('Quiet examination room, Anime art style'));
});

test('explicit reference-outfit preservation has priority over inferred setting or role changes', async () => {
  const imagePrompt = 'Kyro, preserve identity and keep the exact outfit from the input reference image, Anime art style';
  const { messages, response } = await generate({
    characters: [vip],
    plan: 'Anime. Keep Kyro in the exact outfit from his reference image; the ship is his home.',
    scenes: ['Kyro works at the controls aboard a futuristic spaceship.'],
  }, [{ name: 'Kyro', type: 'character', imagePrompt }]);
  const system = messages[0].content;
  assert.match(system, /explicit request to keep the original\/reference outfit takes priority over inferred wardrobe changes/i);
  assert.match(system, /imagePrompt must explicitly say "keep the exact outfit from the input reference image"/);
  assert.match(system, /location or genre alone does not require replacing personal clothing with a uniform/i);
  assert.match(messages[1].content, /the ship is his home/);
  assert.equal(response.prompts[0].imagePrompt, `${CHARACTER_TURNAROUND} ${imagePrompt}`);
});

test('indirect wardrobe requirements remain available while unrelated scene action stays out of character sheets', async () => {
  const imagePrompt = 'Kyro, preserve identity from input reference image; replace original outfit with formal black tuxedo and dress shoes, Anime art style';
  const { messages, response } = await generate({
    characters: [vip],
    narrationSummary: 'Anime wedding story.',
    prompts: ['Kyro attends a formal wedding as the groom and waves from a balcony.'],
  }, [{ name: 'Kyro', type: 'character', imagePrompt }]);
  assert.match(messages[0].content, /follow explicit wardrobe instructions and wardrobe changes implied by the story/);
  assert.match(messages[0].content, /never merge incompatible old and new looks/);
  assert.match(messages[0].content, /keep the default outfit when the story provides no wardrobe change/i);
  assert.match(messages[0].content, /Wardrobe and identity instructions must remain complete/);
  assert.match(messages[1].content, /formal wedding as the groom/);
  assert.match(messages[1].content, /Anime wedding story/);
  assert.equal(response.prompts[0].imagePrompt, `${CHARACTER_TURNAROUND} ${imagePrompt}`);
  assert.doesNotMatch(response.prompts[0].imagePrompt, /balcony|waves|brown leather coat/);
});
