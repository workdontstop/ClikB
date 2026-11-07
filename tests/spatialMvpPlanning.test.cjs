const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function load(file, mocks = {}, cache = new Map()) {
  if (/server[\\/]src[\\/](?:MotionGuideRoute|SpatialWorldPlanRoute)\.ts$/.test(file)) mocks = require('./helpers/isolatedPlanningBilling.cjs').withIsolatedPlanningBilling(mocks, load);
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const model = load('server/src/spatialWorld.ts');
const key = (t, position = [0, .5, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => ({ t, position, rotation, scale });
const fixture = () => {
  const plan = { version: 1, duration: 5, background: '#121212', objects: [
    { id: 'rider', identity: 'Rider', shape: 'box', color: '#eeeeee', keys: [key(0), key(5)], parts: [
      { id: 'arm', shape: 'box', color: '#eeeeee', keys: [key(0, [.3, .2, 0]), key(5, [.3, .2, 0])] },
      { id: 'leg', shape: 'box', color: '#eeeeee', keys: [key(0, [0, -.3, 0]), key(5, [0, -.3, 0])] },
    ] },
    { id: 'horse', shape: 'box', color: '#777777', keys: [key(0, [2, .5, 0]), key(5, [2, .5, 0])] },
  ], camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, .5, 0], fov: 45 })) };
  return model.validateWorld({ version: 2, model: 'luna', revision: 'test-world', sourceImage: 'https://assets.test/start.png', plan, controlledObject: 'rider', controlMode: 'character', walkable: [{ min: [-10, 0, -10], max: [10, 8, 10] }], obstacles: [], approved: true });
};

function planner(response) {
  const calls = []; let charges = 0;
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async args => { calls.push(args); if (response instanceof Error) throw response; return { choices: [{ message: { content: JSON.stringify(response) } }] }; } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 },
    './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => { charges++; return true; } },
    './languageModels': { languageModelForTier: () => 'fixture-model' },
    './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
  });
  return { calls, get charges() { return charges; }, async request(body) {
    let status = 200, result;
    await spatialWorldPlan({ body }, { status(code) { status = code; return this; }, json(value) { result = value; return this; } });
    return { status, result };
  } };
}
function refiner(response) {
  const calls = [];
  const { refineSpatialMovementFromFrame } = load('server/src/SpatialMotionContext.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async args => { calls.push(args); return { choices: [{ message: { content: JSON.stringify(response) } }] }; } } } }) },
    './aiUsageLedger': { recordOpenAiUsage() {} },
  });
  return { calls, async request(body) {
    let status = 200, result;
    await refineSpatialMovementFromFrame({ body }, { status(code) { status = code; return this; }, send(value) { result = value; return this; } });
    return { status, result };
  } };
}
const refinement = controlledMovement => ({ startRelation: 'the authored starting pose', route: 'the recorded turn and travel', endRelation: 'the last authored pose', controlledMovement, secondaryMotion: '', spatialPlan: { cameraMode: 'fixed', unitStaysInside: true, preservesControlState: true, inventsEnvironment: false, boundaryLimited: false, path: [{ x: .3, y: 0, z: .3 }, { x: .8, y: 0, z: .5 }] } });
const refineBody = () => ({ llmTier: 'luna', sceneId: 'test', sceneIntent: 'Explore the garden', videoPrompt: 'A rider and horse in a garden', movementText: 'Follow the authored route', imageUrl: 'https://assets.test/start.png', durationSeconds: 5, motionContext: { controlledSubject: 'The rider and horse', controlMode: 'mounted', primaryMotion: 'Walk calmly together.', ambientMotion: 'Other subjects hold position.' } });

test('authored turn then forward motion keeps the actual trajectory and mounted state without landmark destinations', async () => {
  const world = fixture(), performance = structuredClone(world.plan);
  performance.objects[1].keys = [key(0, [2, .5, 0]), key(1, [2, .5, 0], [0, Math.PI / 2, 0]), key(5, [2, .5, -3], [0, Math.PI / 2, 0])];
  const referenceMotion = { controlledObject: 'horse', controlledSubject: 'The rider and horse', direction: 'forward', stateEvidence: 'authored-world', duration: 5, trajectory: performance.objects[1].keys, objects: performance.objects, sourceState: { ...world.initialState, conditions: { mounted: true, carryingSword: true } }, endState: { ...model.stateAtEnd(performance, world.initialState), conditions: { mounted: true, carryingSword: true } }, projectionCamera: performance.camera, walkable: world.walkable };
  const good = 'The rider and horse turn in place and walk calmly forward into the garden over 5 seconds.';
  const h = refiner(refinement(good));
  const { status, result } = await h.request({ ...refineBody(), referenceMotion });
  assert.equal(status, 200, JSON.stringify(result)); assert.equal(h.calls.length, 1);
  assert.ok(result.instruction.startsWith(good));
  const request = h.calls[0], system = request.messages[0].content;
  assert.match(system, /Do not invent approximate distances/);
  assert.doesNotMatch(system, /controlledMovement must incorporate all three/);
  assert.doesNotMatch(system, /give a concise approximate distance or route/);
  assert.match(system, /yaw, pitch, roll/); assert.match(system, /height and posture/);
  assert.deepEqual(JSON.parse(request.messages[1].content[0].text).referenceMotion, JSON.parse(JSON.stringify(referenceMotion)));
});

test('authored turn, rightward travel and frame exit are not shortened to an on-screen stopping destination', async () => {
  const world = fixture();
  const referenceMotion = { controlledObject: 'horse', direction: 'forward', duration: 5, trajectory: [key(0), key(1, [0, .5, 0], [0, Math.PI / 2, 0]), key(5, [4, .5, 0], [0, Math.PI / 2, 0])], sourceState: world.initialState, endState: world.initialState, projectionCamera: world.plan.camera, walkable: world.walkable };
  const good = 'The horse turns, walks right and goes off screen over 5 seconds.';
  const h = refiner(refinement(good));
  const { status, result } = await h.request({ ...refineBody(), referenceMotion });
  assert.equal(status, 200); assert.ok(result.instruction.startsWith(good));
  assert.match(h.calls[0].messages[0].content, /Leaving the camera frame is different from leaving the authored world/);
  assert.match(result.instruction, /including any recorded exit from the camera frame/);
  assert.doesNotMatch(result.instruction, /shorten movement|Keep the entire controlled unit/);
});

test('authored physical return retains explicit camera intent in the same refinement call', async () => {
  const world = fixture(), referenceMotion = { direction: 'backward', sourceState: world.initialState, endState: world.initialState, projectionCamera: world.plan.camera, cameraInstruction: 'Pan gently as the rider returns' };
  const h = refiner(refinement('The rider and horse turn and walk back to the original pose over 5 seconds.'));
  const { status, result } = await h.request({ ...refineBody(), referenceMotion });
  assert.equal(status, 200); assert.equal(h.calls.length, 1);
  assert.match(h.calls[0].messages[0].content, /Never repeat the forward command, rewind/);
  assert.match(result.instruction, /Follow the reference camera movement: Pan gently as the rider returns/);
});

test('image-only refinement retains its inferred landmark route and original boundary policy', async () => {
  const response = { ...refinement('The rider walks from the doorway around the table and stops beside the chair over 5 seconds.'), startRelation: 'beside the doorway', route: 'around the table', endRelation: 'beside the chair' };
  const h = refiner(response);
  const { status, result } = await h.request({ ...refineBody(), imageDataUrl: 'data:image/png;base64,AA==', imageUrl: undefined });
  assert.equal(status, 200);
  assert.match(h.calls[0].messages[0].content, /controlledMovement must incorporate all three resolved relationships/);
  assert.match(result.instruction, /shorten movement at its boundaries/);
});

test('correcting one action part preserves unaffected performance, camera and completed semantic outcomes', async () => {
  const world = fixture(), existingPlan = structuredClone(world.plan);
  existingPlan.objects[0].keys[1].position = [1, .5, 0];
  existingPlan.objects[0].parts[0].keys = [key(0, [.3, .2, 0]), key(2, [.3, .2, 0], [0, 0, .8]), key(5, [.3, .2, 0], [0, 0, .1])];
  existingPlan.objects[1].keys[1].rotation = [0, .8, 0];
  existingPlan.camera[1].target = [1, .5, 0];
  const endState = model.stateAtEnd(existingPlan, world.initialState);
  endState.conditions = { mounted: true, carryingSword: true };
  endState.relationships = [{ from: 'rider', to: 'horse', relation: 'riding' }];
  endState.objects.rider.facts = { holding: 'sword' };
  const body = { operation: 'action', llmTier: 'terra', prompt: 'Mount and wave while keeping the sword', correction: 'Bend the left knee more', world, recorded: world.plan, sourceState: world.initialState, existingPlan, existingEndState: endState, existingStateChanges: { mounted: true } };
  const before = JSON.stringify(body);
  const leg = { id: 'leg', keys: [key(0, [0, -.3, 0]), key(5, [0, -.3, 0], [.6, 0, 0])] };
  const h = planner({ plan: { objects: [{ id: 'rider', parts: [leg] }] }, creatorInstruction: 'Mount and wave with the left knee bent further while keeping the sword' });
  const { status, result } = await h.request(body);
  assert.equal(status, 200, JSON.stringify(result)); assert.equal(h.calls.length, 1); assert.equal(h.charges, 1);
  const sent = JSON.parse(h.calls[0].messages[1].content[0].text);
  assert.deepEqual(sent.existingPlan, existingPlan); assert.deepEqual(sent.sourceState, world.initialState);
  assert.deepEqual(sent.existingEndState, JSON.parse(JSON.stringify(endState))); assert.equal(sent.correction, body.correction);
  assert.match(h.calls[0].messages[0].content, /Keep sourceState as its ORIGINAL starting state/);
  const revised = result.animatic;
  assert.deepEqual(revised.plan.objects[0].keys, existingPlan.objects[0].keys);
  assert.deepEqual(revised.plan.objects[0].parts.find(p => p.id === 'arm').keys, existingPlan.objects[0].parts[0].keys);
  assert.deepEqual(revised.plan.objects[1], existingPlan.objects[1]);
  assert.deepEqual(revised.plan.camera, existingPlan.camera);
  assert.equal(revised.plan.objects[0].parts.find(p => p.id === 'leg').keys[1].rotation[0], .6);
  assert.deepEqual(revised.endState.conditions, endState.conditions); assert.deepEqual(revised.endState.relationships, endState.relationships);
  assert.equal(revised.endState.objects.rider.facts.holding, 'sword'); assert.deepEqual(revised.stateChanges, { mounted: true });
  assert.equal(revised.prompt, revised.creatorInstruction); assert.match(revised.prompt, /knee bent further/);
  assert.equal(JSON.stringify(body), before, 'correction mutated the existing action or original starting state');
});

test('an action correction can explicitly change semantic outcomes without moving its starting state', async () => {
  const world = fixture(), existingEndState = model.stateAtEnd(world.plan, world.initialState);
  existingEndState.conditions = { holdingSword: true }; existingEndState.relationships = [{ from: 'rider', to: 'sword', relation: 'holding' }];
  const h = planner({ plan: world.plan, conditions: { holdingSword: false }, relationships: [], objectFacts: { rider: {} }, stateChanges: { released: 'sword' }, creatorInstruction: 'Wave and put down the sword' });
  const { status, result } = await h.request({ operation: 'action', llmTier: 'luna', prompt: 'Wave with the sword', correction: 'Put down the sword', world, sourceState: world.initialState, recorded: world.plan, existingPlan: world.plan, existingEndState });
  assert.equal(status, 200); assert.deepEqual(result.animatic.sourceState, world.initialState);
  assert.deepEqual(result.animatic.endState.relationships, []); assert.equal(result.animatic.endState.conditions.holdingSword, false);
  assert.deepEqual(result.animatic.stateChanges, { released: 'sword' });
});

test('changing correction duration preserves unaffected track timing proportionally', async () => {
  const world = fixture(), existingPlan = structuredClone(world.plan);
  existingPlan.objects[0].parts[0].keys.splice(1, 0, key(2, [.3, .2, 0], [0, 0, .8]));
  const h = planner({ plan: { objects: [] }, creatorInstruction: 'Perform the same wave over ten seconds' });
  const { status, result } = await h.request({ operation: 'action', llmTier: 'luna', prompt: 'Wave', correction: 'Use ten seconds', duration: 10, world, recorded: world.plan, sourceState: world.initialState, existingPlan });
  assert.equal(status, 200, JSON.stringify(result)); assert.equal(result.animatic.plan.duration, 10);
  assert.deepEqual(result.animatic.plan.objects[0].parts[0].keys.map(k => k.t), [0, 4, 10]);
  assert.equal(result.animatic.plan.camera[1].t, 10);
});

test('a failed correction retains the old action and does not charge planning pixels', async () => {
  const world = fixture(), body = { operation: 'action', llmTier: 'sol', prompt: 'Wave', correction: 'Use the other hand', world, recorded: world.plan, sourceState: world.initialState, existingPlan: world.plan };
  const before = JSON.stringify(body), h = planner(new Error('Fixture model unavailable'));
  const { status } = await h.request(body);
  assert.equal(status, 422); assert.equal(h.calls.length, 1); assert.equal(h.charges, 0);
  assert.equal(JSON.stringify(body), before);
});

test('correction metadata is rejected outside the explicit action correction request', async () => {
  const world = fixture(), h = planner({ plan: world.plan });
  for (const extra of [{ operation: 'movement', existingPlan: world.plan, correction: 'Turn left' }, { operation: 'action', correction: 'Use the other hand' }, { operation: 'action', existingPlan: world.plan, correction: '' }]) {
    const { status } = await h.request({ llmTier: 'luna', prompt: 'Wave', world, recorded: world.plan, sourceState: world.initialState, ...extra });
    assert.equal(status, 400);
  }
  assert.equal(h.calls.length, 0); assert.equal(h.charges, 0);
});
