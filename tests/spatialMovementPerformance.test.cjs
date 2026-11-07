const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function load(file, mocks = {}, cache = new Map()) {
  const root = path.resolve(__dirname, '..'), filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const model = load('server/src/spatialWorld.ts');
const { boxSpanKey } = load('server/src/motionGuidePlan.ts');
const key = (t, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => ({ t, position, rotation, scale });
const span = (start, end, width = .16, depth = .16) => ({ start, end, width, depth });
const poses = {
  torso: [span([0, .6, 0], [0, 1.05, .35], .45, .28), span([0, 1, 0], [0, 1.55, 0], .45, .28)],
  upper_leg_left: [span([-.16, .6, 0], [-.16, .32, .3]), span([-.16, 1, 0], [-.16, .53, 0])],
  lower_leg_left: [span([-.16, .32, .3], [-.16, .05, 0]), span([-.16, .53, 0], [-.16, .05, 0])],
  upper_leg_right: [span([.16, .6, 0], [.16, .32, .3]), span([.16, 1, 0], [.16, .53, 0])],
  lower_leg_right: [span([.16, .32, .3], [.16, .05, 0]), span([.16, .53, 0], [.16, .05, 0])],
  upper_arm_left: [span([-.23, 1.05, .35], [-.3, .85, .55], .12, .12), span([-.23, 1.55, 0], [-.3, 1.25, .1], .12, .12)],
  lower_arm_left: [span([-.3, .85, .55], [-.3, .65, .65], .1, .1), span([-.3, 1.25, .1], [-.3, .95, .1], .1, .1)],
  upper_arm_right: [span([.23, 1.05, .35], [.3, .85, .55], .12, .12), span([.23, 1.55, 0], [.3, 1.25, .1], .12, .12)],
  lower_arm_right: [span([.3, .85, .55], [.3, .65, .65], .1, .1), span([.3, 1.25, .1], [.3, .95, .1], .1, .1)],
};
function parts(animated) {
  const result = Object.entries(poses).map(([id, [crouched, standing]]) => ({ id, shape: 'box', color: '#556677',
    keys: animated ? [boxSpanKey(0, crouched), boxSpanKey(1.5, standing), boxSpanKey(5, standing)]
      : [boxSpanKey(0, crouched), boxSpanKey(5, crouched)] }));
  result.push({ id: 'head', shape: 'sphere', color: '#556677', keys: animated
    ? [key(0, [0, 1.22, .35], undefined, [.3, .3, .3]), key(1.5, [0, 1.72, 0], undefined, [.3, .3, .3]), key(5, [0, 1.72, 0], undefined, [.3, .3, .3])]
    : [key(0, [0, 1.22, .35], undefined, [.3, .3, .3]), key(5, [0, 1.22, .35], undefined, [.3, .3, .3])] });
  return result;
}
function fixture() {
  const camera = [0, 5].map(t => ({ t, position: [0, 2.5, 6], target: [0, 1, 0], fov: 45 }));
  const plan = { version: 1, duration: 5, background: '#ffffff', camera, objects: [
    { id: 'girl', identity: 'girl', role: 'actor', shape: 'box', color: '#556677', keys: [key(0), key(5)], parts: parts(false) },
    { id: 'wand', identity: 'wand', shape: 'box', color: '#999999', attachment: { objectId: 'girl', partId: 'lower_arm_right' }, keys: [key(0, [0, .5, 0], undefined, [.1, .5, .1]), key(5, [0, .5, 0], undefined, [.1, .5, .1])] },
    { id: 'horse', shape: 'box', color: '#ffffff', keys: [key(0, [3, .8, -2]), key(5, [3, .8, -2])] },
  ] };
  const world = model.validateWorld({ version: 2, revision: 'performance-fixture', model: 'luna', sourceImage: 'https://assets.test/crouched.png',
    controlledObject: 'girl', controlMode: 'character', drivenName: 'girl', primarySubjectName: 'girl', plan,
    walkable: [{ min: [-10, 0, -10], max: [10, 10, 10] }], obstacles: [], approved: true });
  world.initialState.objects.girl.facts = { pose: 'crouched', holding: 'wand' };
  world.initialState.relationships = [{ from: 'girl', to: 'wand', relation: 'holding' }];
  const recorded = structuredClone(plan);
  recorded.objects[0].keys = [key(0), key(1.5, [.6, 0, -.3], [0, Math.PI, 0]), key(5, [2, 0, -1], [0, Math.PI * 2, 0])];
  const response = { plan: structuredClone(plan), objectFacts: { girl: { pose: 'standing' } } };
  response.plan.objects[0].parts = parts(true);
  // The root must remain the recorded route even if the model changes it.
  response.plan.objects[0].keys = [key(0), key(5, [8, 9, 8], [0, .25, 0])];
  return { world, recorded, response };
}
function planner(responseFor) {
  const requests = [], charges = [];
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async request => {
      const input = JSON.parse(request.messages[1].content[0].text); requests.push({ request, input });
      return { choices: [{ message: { content: JSON.stringify(responseFor(input)) } }] };
    } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 },
    './db': { getPixelsForUser: async () => 100, trySpendPixels: async (_, amount) => { charges.push(amount); return true; } },
    './languageModels': { languageModelForTier: () => 'fixture-model', pixelsForTier: () => 1 },
    './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
  });
  return { requests, charges, async call(body) {
    let status = 200, result;
    await spatialWorldPlan({ body: { llmTier: 'luna', ...body } }, { status(code) { status = code; return this; }, json(value) { result = value; return this; } });
    assert.equal(status, 200, JSON.stringify(result)); return result.animatic;
  } };
}
function assertRenderedPose(plan, time, expectedHeadHeight) {
  const { createMotionScene } = load('src/motionScene.ts');
  const view = createMotionScene(plan, 16 / 9);
  try {
    view.draw(time);
    const head = view.parts.get('girl').get('head'), root = view.roots.get('girl');
    assert.equal(head.position.y, expectedHeadHeight);
    const worldPosition = head.getWorldPosition(new (require('three').Vector3)());
    assert.ok(Math.abs(worldPosition.y - (root.position.y + expectedHeadHeight)) < 1e-8);
    const torso = view.parts.get('girl').get('torso');
    assert.ok(torso.matrixWorld.elements.every(Number.isFinite));
    return { headY: worldPosition.y, rootPosition: root.position.toArray(), rootRotation: root.rotation.toArray().slice(0, 3) };
  } finally { view.dispose(); }
}

test('Process movement receives the explicit stand-up instruction and renders local performance while preserving route, spins and attachments', async () => {
  const { world, recorded, response } = fixture();
  const before = JSON.stringify({ world, recorded, response });
  const h = planner(() => response);
  const result = await h.call({ operation: 'movement', prompt: 'she stands up then moves to the horse', world, recorded, sourceState: world.initialState,
    context: { imagePrompt: 'The crouched girl in the meadow', videoPrompt: 'Keep the crouched girl and horse in frame' } });
  assert.equal(h.requests.length, 1); assert.equal(h.charges.length, 1);
  assert.equal(h.requests[0].input.prompt, 'she stands up then moves to the horse');
  assert.match(h.requests[0].request.messages[0].content, /sourceState is the starting pose, not a requirement to hold that pose throughout/);
  assert.match(h.requests[0].request.messages[0].content, /body action authored only by changing the root or semantic metadata will not appear/);
  assert.match(h.requests[0].request.messages[0].content, /Do not require a separate action/);
  const girl = result.plan.objects.find(object => object.id === 'girl');
  assert.deepEqual(girl.keys, recorded.objects[0].keys);
  assert.deepEqual(girl.parts.find(part => part.id === 'torso').keys.at(-1).span, poses.torso[1]);
  assert.deepEqual(result.plan.objects.find(object => object.id === 'wand').attachment, { objectId: 'girl', partId: 'lower_arm_right' });
  assert.equal(result.endState.objects.girl.facts.pose, 'standing');
  assert.equal(result.endState.objects.girl.facts.holding, 'wand');
  assert.equal(result.creatorInstruction, h.requests[0].input.prompt);
  assertRenderedPose(result.plan, 0, 1.22);
  const rendered = assertRenderedPose(result.plan, 5, 1.72);
  assert.deepEqual(rendered.rootPosition, [2, 0, -1]);
  assert.equal(rendered.rootRotation[1], Math.PI * 2);
  const savedState = JSON.parse(JSON.stringify(result.endState));
  const nextPlan = model.planAtState(world, savedState);
  assertRenderedPose(nextPlan, 0, 1.72);
  assertRenderedPose(nextPlan, 5, 1.72);
  assert.equal(JSON.stringify({ world, recorded, response }), before, 'the planner mutated saved input or a model result');
});

test('return is a separate physical performance from the stood-up endpoint and is not replaced by reversed recorded keys', async () => {
  const { world, recorded, response } = fixture();
  const h = planner(input => {
    if (input.operation === 'movement') return response;
    const plan = model.planAtState(world, input.sourceState);
    plan.objects.find(object => object.id === 'girl').keys = [
      key(0, [2, 0, -1], [0, Math.PI * 2, 0]), key(1.5, [2, 0, -1], [0, Math.PI, 0]),
      key(3.25, [.8, 0, -.8], [0, Math.PI, 0]), key(5),
    ];
    return { plan };
  });
  const forward = await h.call({ operation: 'movement', prompt: 'she stands up then moves to the horse', world, recorded, sourceState: world.initialState });
  const backward = await h.call({ operation: 'return', prompt: '', world, recorded: forward.plan, sourceState: forward.endState, destinationState: world.initialState });
  assert.equal(h.requests.length, 2); assert.equal(h.charges.length, 2);
  assert.deepEqual(h.requests.map(item => item.input.operation), ['movement', 'return']);
  assert.equal(h.requests[1].input.sourceState.objects.girl.parts.head.position[1], 1.72);
  assert.doesNotMatch(h.requests[1].request.messages[0].content, /MOVEMENT PERFORMANCE:/);
  const girl = backward.plan.objects.find(object => object.id === 'girl');
  assert.equal(girl.keys[1].t, 1.5); assert.deepEqual(girl.keys[1].position, [2, 0, -1], 'the return turn must occur before travel');
  assert.deepEqual(girl.keys.at(-1).position, world.initialState.objects.girl.transform.position);
  assertRenderedPose(backward.plan, 0, 1.72);
  assertRenderedPose(backward.plan, 5, 1.22);
  assert.equal(backward.endState.objects.girl.facts.holding, 'wand');
});

test('sparse movement animation retains unmentioned equipment and limbs without a semantic save gate', () => {
  const { world, recorded } = fixture();
  const { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
  const head = parts(true).find(part => part.id === 'head');
  const raw = { objects: [{ id: 'girl', parts: [head] }] };
  const { plan } = prepareSpatialMotion(raw, world, world.initialState, recorded, 'movement', undefined, 5, 'look up while moving');
  assert.equal(plan.objects.find(object => object.id === 'girl').parts.length, world.plan.objects[0].parts.length);
  assert.deepEqual(plan.objects.find(object => object.id === 'wand').attachment, world.plan.objects[1].attachment);
  assert.deepEqual(plan.objects[0].keys, recorded.objects[0].keys);
  assertRenderedPose(plan, 5, 1.72);
});
