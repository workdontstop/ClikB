const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
function load(file, mocks = {}, cache = new Map(), sources = {}) {
  if (/server[\\/]src[\\/](?:MotionGuideRoute|SpatialWorldPlanRoute)\.ts$/.test(file)) mocks = require('./helpers/isolatedPlanningBilling.cjs').withIsolatedPlanningBilling(mocks, load);
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache, sources)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(sources[file] ?? fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const worldModel = load('server/src/spatialWorld.ts');
const videoSpec = load('server/src/spatialVideoSpec.ts');

test('reconstruction binds the selected asset and description without asking for it again', () => {
  const { prepareSpatialReconstruction } = load('server/src/spatialReconstruction.ts');
  const plan = fixture().ledger.world.plan;
  const root = plan.objects[0]; root.id = 'space_ranger';
  plan.objects.unshift({...structuredClone(root),id:'cockpit'});
  const references=[{name:'space ranger',imageUrl:'https://assets.test/ranger.png',description:'Blue suit, silver shoulders'}];
  const world=prepareSpatialReconstruction({plan,controlledObject:'cockpit'}, {version:2,model:'luna',drivenName:'space ranger',references});
  assert.equal(world.controlledObject,'space_ranger');
  assert.equal(world.controlSelectionRequired,false);
  assert.equal(world.references[0].description,references[0].description);
  const legacy=worldModel.validateWorld({...world,controlledObject:'cockpit',controlSelectionRequired:true});
  assert.equal(legacy.controlledObject,'space_ranger'); assert.equal(legacy.controlSelectionRequired,false);
  const manual=worldModel.validateWorld({...world,controlledObject:'cockpit',controlSelectionRequired:false});
  assert.equal(manual.controlledObject,'cockpit','explicit manual selection overwritten');
});
test('asset-free reconstruction still requires a subject; an arbitrary first root is not confirmed', () => {
  const { prepareSpatialReconstruction } = load('server/src/spatialReconstruction.ts');
  const plan=fixture().ledger.world.plan;
  const metadata={version:2,model:'luna',drivenName:'missing',references:[{name:'missing',imageUrl:'https://assets.test/missing.png'}]};
  assert.equal(prepareSpatialReconstruction({plan},metadata).controlSelectionRequired,true);
  const named={...metadata,drivenName:plan.objects[0].id,references:[]};
  assert.equal(prepareSpatialReconstruction({plan},named).controlSelectionRequired,true);
});
test('rejecting a review retains geometry and references, cannot approve accidentally, and can be restored', () => {
  const world=fixture().ledger.world, before=structuredClone(world.plan);
  const rejected=worldModel.validateWorld({...world,reviewRejected:true,approved:true});
  assert.equal(rejected.reviewRejected,true); assert.equal(rejected.approved,false);
  assert.deepEqual(rejected.plan,before);
  const restored=worldModel.validateWorld({...rejected,reviewRejected:false});
  assert.equal(restored.reviewRejected,undefined); assert.equal(restored.approved,false);
});

test('asset-free identification sends the actual scene image and context without charging or building geometry', async () => {
  let request, charges = 0;
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async value => { request = value; return { choices: [{ message: { content: JSON.stringify({ subjects: [{ name: 'youngGirl', description: 'Foreground girl' }, { name: 'horse', description: 'White horse' }] }) } }] }; } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 },
    './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => { charges++; return true; } },
    './languageModels': { languageModelForTier: () => 'fixture-model', pixelsForTier: () => 1 },
    './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
  });
  let result;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(value) { result = value; return this; } };
  await spatialWorldPlan({ body: { operation: 'identify', llmTier: 'luna', prompt: '', image: 'https://assets.test/scene.png', context: { imagePrompt: '@youngGirl beside a horse', sceneIntent: 'Approach the horse' } } }, res);
  assert.equal(charges, 0);
  assert.equal(result.subjects[0].name, 'youngGirl');
  assert.equal(result.world, undefined);
  const parts = request.messages[1].content;
  assert.deepEqual(parts.find(part => part.type === 'image_url').image_url, { url: 'https://assets.test/scene.png', detail: 'high' });
  assert.equal(JSON.parse(parts[0].text).context.sceneIntent, 'Approach the horse');
});

test('ten-second action uses the normal timer through planning, playback, provider input and billing', async () => {
  const scene = fixture(), world = scene.ledger.world;
  let request;
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async value => { request = value; return { choices: [{ message: { content: JSON.stringify({ plan: world.plan }) } }] }; } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 },
    './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => true },
    './languageModels': { languageModelForTier: () => 'fixture-model', pixelsForTier: () => 1 },
    './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
  });
  let status = 200, result;
  await spatialWorldPlan({ body: { operation:'action', duration:10, llmTier:'luna', prompt:'@Zuri waves', image:world.sourceImage, world, sourceState:world.initialState, recorded:world.plan } }, {
    status(code) { status=code; return this; }, json(value) { result=value; return this; },
  });
  assert.equal(status,200,JSON.stringify(result));
  assert.equal(JSON.parse(request.messages[1].content[0].text).duration,10);
  assert.equal(result.animatic.plan.duration,10);
  assert.equal(result.animatic.plan.objects[0].keys.at(-1).t,10);
  assert.equal(result.animatic.plan.camera.at(-1).t,10);
  scene.connections[0].kind='action'; scene.ledger.routes.edge.forward=result.animatic; delete scene.ledger.routes.edge.backward;
  const { threePlayableScene }=load('src/spatialThreePlayback.ts');
  assert.equal(threePlayableScene(scene).connections[0].forward.durationMs,10000);
  const job={ ...result.animatic, duration:10, startAnchor:'https://assets.test/start.png', endAnchor:'https://assets.test/end.png', referenceVideo:'https://assets.test/ref.mp4' };
  for (const model of Object.keys(videoSpec.spatialVideoModels)) {
    assert.equal(videoSpec.spatialVideoInput(model,job,'480p','16:9',false).duration,10);
    const expectedPrice = model === 'FalH3' ? Math.round(load('server/src/falH3Spec.ts').falH3Dollars(10, '480p', 1, 1, 0) * 333) : Math.round(videoSpec.spatialVideoModels[model].rates[0] * 10 * 333);
    assert.equal(videoSpec.spatialVideoPixels(model,'480p',10),expectedPrice);
  }
});

test('spatial UI keeps transparent media hit areas and the original action submit surface', () => {
  const studio = fs.readFileSync(path.resolve(__dirname, '../src/components/SpatialStudio.tsx'), 'utf8');
  const editor = fs.readFileSync(path.resolve(__dirname, '../src/EditStory.tsx'), 'utf8');
  assert.match(studio, /pointerEvents: 'none'/);
  assert.match(studio, /width: 'min\(380px,85%\)'/);
  assert.match(studio, /onPlanningPriceChange\?\.\(prices\[tier\]\)/);
  assert.match(editor, /await spatialActionSubmitRef.current\(\)/);
  assert.match(editor, /nextVideoAction.pixels} P/);
  assert.match(editor, /create_spatial_action/);
  assert.match(studio, /You can describe the subject yourself if identification fails/);
});
test('authoring stays locked and observable across editor remounts, independently per scene', async () => {
  const client = load('src/spatialWorldClient.ts', { axios: { post: async () => { throw new Error('No network in this test'); } } });
  const session = client.spatialSession('/test', 1, 'main');
  let release, calls = 0;
  const pending = client.runSpatialAuthoring(session, 'Building scene', async () => { calls++; await new Promise(resolve => release = resolve); });
  const reopened = client.spatialSession('/test', 1, 'main');
  assert.equal(reopened.authoring.busy, 'Building scene');
  assert.equal(reopened.authoring.running, true);
  await client.runSpatialAuthoring(reopened, 'Duplicate', async () => { calls++; });
  assert.equal(calls, 1);
  await client.runSpatialAuthoring(client.spatialSession('/test', 1, 'b-shot'), 'Other scene', async () => { calls++; });
  assert.equal(calls, 2);
  release(); await pending;
  assert.equal(reopened.authoring.running, false);
  await client.runSpatialAuthoring(reopened, 'Build again', async () => { throw new Error('Invalid scene'); });
  assert.equal(client.spatialSession('/test', 1, 'main').authoring.error, 'Invalid scene');
});
const fixture = () => {
  const plan = { version: 1, duration: 5, background: '#121212', objects: [{ id: 'car', shape: 'box', color: '#ffffff', keys: [0, 5].map(t => ({ t, position: [0, .5, 0], rotation: [0, 0, 0], scale: [.5, 1, .5] })) }], camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, .5, 0], fov: 45 })) };
  const world = worldModel.validateWorld({ version: 2, model: 'luna', revision: 'world-1', sourceImage: 'https://assets.test/root.png', plan, controlledObject: 'car', controlMode: 'vehicle', walkable: [{ min: [-5, 0, -5], max: [5, 2, 5] }], obstacles: [{ min: [1, 0, -1], max: [2, 2, 1] }], approved: true });
  const animation = { id: 'animation', plan, sourceState: world.initialState, endState: world.initialState, stateChanges: {}, prompt: 'Drive', referenceVideo: 'https://assets.test/motion.mp4', startAnchor: 'https://assets.test/start.png', endAnchor: 'https://assets.test/end.png', model: 'luna', createdAt: 1 };
  return { sceneId: 'scene-a', activeNodeId: 'root', nodes: [{ id: 'root', frameUrl: world.sourceImage }, { id: 'end', frameUrl: animation.endAnchor }], connections: [{ id: 'edge', sourceNodeId: 'root', targetNodeId: 'end', kind: 'movement', movement: { samples: [] }, forward: null, backward: null }], draftMovement: null,
    ledger: { version: 2, world, routes: { edge: { connectionId: 'edge', worldRevision: world.revision, forward: animation, backward: animation } }, states: { root: world.initialState, end: world.initialState }, jobs: [], epoch: 0, generationStarted: false, view: 'three', boardOpen: false } };
};

test('canonical Spatial action and return retain capability transitions under the existing destination policy', async () => {
  const ground = {kind:'ground',vertical:false,speed:.65,turnRate:1}, air = {kind:'air',vertical:true,speed:2,turnRate:2};
  for (const operation of ['action','return']) {
    const world = fixture().ledger.world; world.locomotion = ground; world.initialState.locomotion = ground;
    const destinationState = structuredClone(world.initialState); destinationState.locomotion = air;
    let result, status = 200;
    const raw = {plan:world.plan,locomotion:operation === 'action' ? air : ground};
    const {spatialWorldPlan} = load('server/src/SpatialWorldPlanRoute.ts', {
      openai: class {},
      './textGeneration': {createRoutedTextClient:()=>({chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify(raw)}}]})}}})},
      './requestAuth': {authenticatedUserId:()=>1},
      './db': {getPixelsForUser:async()=>100,trySpendPixels:async()=>true},
      './languageModels': {languageModelForTier:()=> 'fixture-model'},
      './aiUsageLedger': {recordOpenAiUsage(){},recordPixelCharge(){}},
    });
    await spatialWorldPlan({body:{operation,llmTier:'luna',prompt:'Update motion',world,sourceState:world.initialState,recorded:world.plan,destinationState}}, {
      status(code){status=code;return this;},json(value){result=value;return this;},
    });
    assert.equal(status,200,JSON.stringify(result));
    assert.deepEqual(result.animatic.endState.locomotion,air,operation);
    const {evaluateAuthoringDraft}=load('server/src/sceneAuthoring.ts');
    assert.deepEqual(evaluateAuthoringDraft(result.animatic.authoring,0).state.locomotion,ground);
    assert.deepEqual(evaluateAuthoringDraft(result.animatic.authoring,5).state.locomotion,air);
  }
});

test('an action after movement keeps the current pose throughout, not only at frame zero', () => {
  const { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
  const { world } = fixture().ledger;
  const source = structuredClone(world.initialState);
  source.objects.car.transform.position = [3, .5, -2];
  source.objects.car.transform.rotation = [0, 1, 0];
  source.objects.car.transform.scale = [.8, 1.2, .8];
  source.objects.car.facts = { holding: 'cup' };
  source.conditions = { arrived: true };
  source.camera.position = [3, 2, 4]; source.camera.target = [3, .5, -2];
  const raw = structuredClone(world.plan);
  raw.objects[0].keys.splice(1, 0, { ...structuredClone(raw.objects[0].keys[0]), t: 2.5, rotation: [0, .25, 0] });
  raw.objects[0].keys.at(-1).position[0] = .2;
  raw.camera.at(-1).position[1] += .2;
  const before = JSON.stringify({ world, source, raw });
  const { plan } = prepareSpatialMotion(raw, world, source, worldModel.planAtState(world, source), 'action');
  assert.deepEqual(plan.objects[0].keys.map(key => key.position), [[3,.5,-2],[3,.5,-2],[3.2,.5,-2]]);
  assert.deepEqual(plan.objects[0].keys.map(key => key.rotation), [[0,1,0],[0,1.25,0],[0,1,0]]);
  assert.deepEqual(plan.objects[0].keys.map(key => key.scale), Array(3).fill([.8,1.2,.8]));
  assert.deepEqual(plan.camera.map(key => key.position), [[3,2,4],[3,2.2,4]]);
  assert.deepEqual(plan.camera.map(key => key.target), [[3,.5,-2],[3,.5,-2]]);
  assert.deepEqual(worldModel.stateAtEnd(plan, source).conditions, source.conditions);
  assert.deepEqual(worldModel.stateAtEnd(plan, source).objects.car.facts, source.objects.car.facts);
  assert.equal(JSON.stringify({ world, source, raw }), before, 'normalization mutated the saved scene or AI response');
});

test('action planner receives the current node geometry and semantic state, not the reconstruction origin', async () => {
  const { world } = fixture().ledger;
  const source = structuredClone(world.initialState);
  source.objects.car.transform.position = [3,.5,-2];
  source.objects.car.facts = { holding: 'cup' }; source.conditions = { arrived: true };
  source.camera.target = [3,.5,-2];
  const before = JSON.stringify(world);
  let request, result, status = 200;
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async body => { request=body; return { choices: [{ message: { content: JSON.stringify({plan:world.plan}) } }] }; } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 },
    './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => true },
    './languageModels': { languageModelForTier: () => 'fixture-model', pixelsForTier: () => 1 },
    './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
  });
  await spatialWorldPlan({body:{operation:'action',llmTier:'luna',prompt:'Pick up the cup beside me',world,sourceState:source,recorded:worldModel.planAtState(world,source)}}, {
    status(code){status=code;return this;},json(value){result=value;return this;},
  });
  assert.equal(status,200,JSON.stringify(result));
  const sent=JSON.parse(request.messages[1].content[0].text);
  assert.deepEqual(sent.world.plan.objects[0].keys.map(key=>key.position),[[3,.5,-2],[3,.5,-2]]);
  assert.deepEqual(sent.world.initialState,source);
  assert.deepEqual(result.animatic.plan.objects[0].keys.at(-1).position,source.objects.car.transform.position);
  assert.equal(JSON.stringify(world),before);
});

test('movement accepts changed part counts, added objects and sparse tracks; geometry survives publishing and next recording', async () => {
  const { world } = fixture().ledger;
  const part = id => ({ id, shape: 'sphere', color: '#bb8855', keys: [0, 5].map(t => ({ t, position: [0, .3, 0], rotation: [0, 0, 0], scale: [.3, .3, .3] })) });
  world.plan.objects[0].parts = [part('head'), part('leg')];
  world.initialState = worldModel.newWorldState(world.plan);
  const recorded = worldModel.cloneWorld(world.plan);
  recorded.objects[0].keys[1].position[0] = 2;
  const raw = worldModel.cloneWorld(world.plan);
  raw.objects[0].parts = [part('HEAD'), part('tail'), part('body')];
  raw.objects.push({ id: 'dog', shape: 'box', color: '#dddddd', keys: [0,5].map(t => ({ t, position: [t/3,.4,0], rotation:[0,0,0],scale:[.5,.5,.5] })) });
  let charges = 0, request;
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {},
    './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async body => { request = body; return { choices: [{ message: { content: JSON.stringify({ plan: raw }) } }] }; } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 },
    './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => { charges++; return true; } },
    './languageModels': { languageModelForTier: () => 'fixture-model', pixelsForTier: () => 1 },
    './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
    './spatialGenerationGuidance': { prepareSpatialGenerationGuidance: async () => ({key:'author-time',instruction:'Prepared movement',motionContext:{}}) },
  });
  let status = 200, result;
  const res = { status(code) { status = code; return this; }, json(body) { result = body; return this; } };
  await spatialWorldPlan({ body: { operation:'movement', llmTier:'luna', prompt:'@Spark follows @Zuri', image:'https://assets.test/root.png', world, sourceState:world.initialState, recorded, references:[{name:'Spark', imageUrl:'https://assets.test/spark.png', description:'Robotic dog'}] } }, res);
  assert.equal(status, 200); assert.equal(charges, 1);
  assert.deepEqual(result.animatic.plan.objects[0].keys, recorded.objects[0].keys);
  assert.equal(result.animatic.plan.objects[0].parts.length, 4);
  assert.ok(result.animatic.plan.objects[0].parts.some(part => part.id === 'leg'), 'an omitted saved limb survives a sparse motion response');
  assert.equal(result.animatic.plan.objects[0].parts[0].id, 'head');
  assert.equal(result.animatic.plan.objects[1].id, 'dog');
  assert.equal(JSON.parse(request.messages[1].content[0].text).references[0].description, 'Robotic dog');
  assert.ok(result.animatic.reviewNotes.length);
  const restored = JSON.parse(JSON.stringify(result.animatic.endState));
  const next = worldModel.planAtState(world, restored);
  assert.equal(next.objects[0].parts.length, 4);
  assert.equal(next.objects[1].id, 'dog');
  assert.equal(next.objects[1].keys[0].position[0], 5/3);
  const { prepareSpatialMotion } = load('server/src/spatialMotion.ts');
  const sparse = prepareSpatialMotion({ objects:[{ id:'car', keys:recorded.objects[0].keys }], camera:recorded.camera }, world, restored, next, 'action');
  assert.equal(sparse.plan.objects[0].parts.length, 4);
  assert.equal(sparse.plan.objects[1].id, 'dog');
  const back = prepareSpatialMotion(result.animatic.plan, world, restored, recorded, 'return', world.initialState);
  assert.deepEqual(back.plan.objects[0].keys.at(-1).position, world.initialState.objects.car.transform.position);
});

test('preview renderer displays AI-added and changed geometry, then restores the base view', () => {
  const world = fixture().ledger.world;
  const THREE = require('three'); let rendered;
  const { createMotionRenderer } = load('src/motionGuideRenderer.ts', { three: { ...THREE, WebGLRenderer: class { shadowMap = {}; setPixelRatio() {} setSize() {} render(scene) { rendered = scene; } dispose() {} forceContextLoss() {} } } });
  const view = createMotionRenderer({}, world.plan, 960, 540);
  view.draw(0);
  assert.equal(rendered.children.filter(child => child.isGroup).length, 1);
  const generated = worldModel.cloneWorld(world.plan);
  generated.objects[0].parts = [{ id:'head', shape:'sphere', color:'#ff0000', keys:generated.objects[0].keys }];
  generated.objects.push({ ...generated.objects[0], id:'follower' });
  view.draw(3, generated);
  const groups = rendered.children.filter(child => child.isGroup);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].children[0].geometry.type, 'SphereGeometry');
  view.draw(0);
  const restored = rendered.children.filter(child => child.isGroup);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].children[0].geometry.type, 'BoxGeometry');
  view.dispose();
});
test('existing action planning consumes actual state context in the same paid planning call', async () => {
  const world = fixture().ledger.world, context = { controlledSubject: 'Ranger', controlMode: 'mounted', primaryMotion: 'The rider remains seated on the dragon with the sword held.', ambientMotion: 'The other subjects hold position.' };
  let calls = 0, charges = 0, input;
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {}, './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async args => { calls++; input = args; return { choices: [{ message: { content: JSON.stringify({ plan: world.plan, conditions: {}, relationships: [], objectFacts: {} }) } }] }; } } } }) },
    './requestAuth': { authenticatedUserId: () => 1 }, './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => { charges++; return true; } },
    './languageModels': { languageModelForTier: () => 'fixture', pixelsForTier: () => 1 }, './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
  });
  const body = { operation: 'action', llmTier: 'luna', prompt: 'Dismount', world, recorded: world.plan, sourceState: world.initialState, image: 'https://assets.test/actual-mounted.png', currentStateContext: context };
  let code = 200, result; const res = { status(n) { code = n; return this; }, json(value) { result = value; return this; } };
  await spatialWorldPlan({ body }, res); assert.equal(code, 200, JSON.stringify(result)); assert.equal(calls, 1); assert.equal(charges, 1);
  const parts = input.messages[1].content, state = parts.filter(part => part.type === 'text').map(part => JSON.parse(part.text)).find(part => part.currentStateContext);
  assert.deepEqual(state.currentStateContext, context); assert.match(state.requirement, /new creator instruction may explicitly change/);
  assert.ok(parts.some(part => part.image_url?.url === body.image));
  await spatialWorldPlan({ body: { ...body, currentStateContext: { controlledSubject: 'incomplete' } } }, res);
  assert.equal(code, 422); assert.equal(calls, 1); assert.equal(charges, 1);
});

test('scene reconstruction uses one call and charges only a renderable result', async () => {
  for (const repaired of [fixture().ledger.world, { plan: { objects: [] } }]) {
    let calls = 0, charges = 0;
    const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
      openai: class {},
      './textGeneration': { createRoutedTextClient: () => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify((++calls, repaired)) } }] }) } } }) },
      './requestAuth': { authenticatedUserId: () => 1 },
      './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => { charges++; return true; } },
      './languageModels': { languageModelForTier: () => 'fixture-model', pixelsForTier: () => 1 },
      './aiUsageLedger': { recordOpenAiUsage() {}, recordPixelCharge() {} },
    });
    let status = 200, result;
    const res = { status(code) { status = code; return this; }, json(body) { result = body; return this; } };
    await spatialWorldPlan({ body: { operation: 'reconstruct', llmTier: 'luna', prompt: 'Build the scene', image: 'https://assets.test/root.png', aspectRatio: '9:16' } }, res);
    assert.equal(calls, 1);
    if (repaired.plan.objects.length) {
      assert.equal(status, 200); assert.equal(charges, 1); assert.equal(result.world.approved, false);
    } else {
      assert.equal(status, 422); assert.equal(charges, 0); assert.match(result.message, /no planning pixels were charged/i);
    }
  }
});

test('reconstruction returns mismatched framing and missing furniture for review instead of discarding renderable geometry',async()=>{
  const base=fixture().ledger.world,chair=structuredClone(base.plan.objects[0]);chair.id='chair';chair.keys.forEach(k=>{k.position[0]=1;k.scale=[.5,.6,.5];});base.plan.objects.push(chair);
  const layout={camera:'Measured perspective',landmarks:Object.entries(load('server/src/spatialSceneCalibration.ts').projectedSceneBoxes(base.plan,'9:16')).map(([id,box])=>({id,box,description:id,occluded:false}))};
  const wrong=structuredClone(base);wrong.plan.objects=wrong.plan.objects.filter(object=>object.id!=='chair');wrong.plan.camera.forEach(k=>k.fov=95);
  let calls=0,charges=0;
  const {spatialWorldPlan}=load('server/src/SpatialWorldPlanRoute.ts',{
    openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async()=>{calls++;assert.ok(calls<=2,'visual mismatch triggered another model call');return{choices:[{message:{content:JSON.stringify({...wrong,sourceLayout:layout})}}]};}}}})},
    './requestAuth':{authenticatedUserId:()=>1},'./db':{getPixelsForUser:async()=>100,trySpendPixels:async()=>{charges++;return true;}},
    './languageModels':{languageModelForTier:()=> 'fixture',pixelsForTier:()=>1},'./aiUsageLedger':{recordOpenAiUsage(){},recordPixelCharge(){}},
  });
  let body,code=200;await spatialWorldPlan({body:{operation:'reconstruct',llmTier:'luna',prompt:'Build',image:'https://assets.test/source.png',aspectRatio:'9:16',context:{sceneIntent:'Explore the cabin',imagePrompt:'Chair beside workstation',videoPrompt:'Ranger uses a laptop'}}},{status(n){code=n;return this;},json(value){body=value;return this;}});
  assert.equal(code,200,JSON.stringify(body));assert.equal(calls,1);assert.equal(charges,1);assert.equal(body.world.approved,false);assert.notEqual(body.world.reviewRejected,true);
  assert.deepEqual(body.world.plan.objects.filter(object=>object.id!=='blockout_ground'),wrong.plan.objects,'renderable subject geometry was changed or discarded');
  assert.ok(body.world.plan.objects.some(object=>object.surface==='ground'),'new scene has no physical grid ground');
  const restored=worldModel.validateWorld(JSON.parse(JSON.stringify(body.world)));assert.deepEqual(restored.sourceLayout,layout);assert.equal(restored.sceneContext.videoPrompt,'Ranger uses a laptop');
});

test('invalid optional measurements do not block the single scene response or editing',async()=>{
  for(const analysis of ['incomplete JSON',{camera:'Unknown',landmarks:[]},new Error('Measurement provider unavailable')]) {
    const built=fixture().ledger.world;let calls=0,charges=0,request;
    const {spatialWorldPlan}=load('server/src/SpatialWorldPlanRoute.ts',{
      openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async args=>{
        calls++;
        request=args;return{choices:[{message:{content:JSON.stringify({...built,sourceLayout:analysis})}}]};
      }}}})},
      './requestAuth':{authenticatedUserId:()=>1},'./db':{getPixelsForUser:async()=>100,trySpendPixels:async()=>{charges++;return true;}},
      './languageModels':{languageModelForTier:()=> 'fixture',pixelsForTier:()=>1},'./aiUsageLedger':{recordOpenAiUsage(){},recordPixelCharge(){}},
    });
    let result,status=200;await spatialWorldPlan({body:{operation:'reconstruct',llmTier:'luna',prompt:'Keep the chair beside the desk',image:'https://assets.test/source.png',drivenName:'car',aspectRatio:'9:16'}},{status(n){status=n;return this;},json(value){result=value;return this;}});
    assert.equal(status,200,JSON.stringify(result));assert.equal(calls,1);assert.equal(charges,1);assert.equal(result.world.approved,false);
    assert.ok(request.messages[1].content.some(part=>part.type==='image_url'&&part.image_url.url==='https://assets.test/source.png'));
    const edited=worldModel.validateWorld({...result.world,plan:structuredClone(result.world.plan)});
    edited.plan.objects[0].keys.forEach(key=>key.scale=[2,1,1]);
    assert.throws(() => worldModel.validateWorld(edited), /plans disagree/);
    edited.authoring = load('server/src/sceneAuthoring.ts').mergeAuthoringPlan(edited.authoring, edited.plan, { preserveManualTracks: false });
    assert.equal(worldModel.validateWorld(edited).plan.objects[0].keys[0].scale[0],2);
  }
});

test('world collision is swept and semantic state survives physical movement', () => {
  const { world } = fixture().ledger;
  const position = worldModel.moveInWorld(world, [0, .5, 0], 4, 0);
  assert.ok(position[0] < .8); assert.ok(position[0] > 0);
  const before = worldModel.cloneWorld(world.initialState);
  before.conditions = { ignition: 'on', customQuest: { completed: true } };
  before.objects.car.facts = { owner: 'actor', arbitraryProperty: ['a', 'b'] };
  before.relationships = [{ from: 'actor', to: 'car', relation: 'driving' }];
  const after = worldModel.stateAtEnd(world.plan, before);
  assert.deepEqual(after.conditions, before.conditions); assert.deepEqual(after.relationships, before.relationships);
  assert.deepEqual(after.objects.car.facts, before.objects.car.facts);
  after.conditions.ignition = 'off'; assert.equal(before.conditions.ignition, 'on');
});

test('compound assets retain local action poses through JSON publishing and Three.js playback', () => {
  const scene = fixture(), world = scene.ledger.world;
  const part = { id: 'head', shape: 'sphere', color: '#bb8855', keys: [0, 5].map(t => ({ t, position: [0, .3, .2], rotation: [t / 10, 0, 0], scale: [.3, .3, .3] })) };
  world.plan.objects[0].parts = [part];
  const validated = worldModel.validateWorld(world);
  assert.equal(validated.plan.objects[0].parts[0].id, 'head');
  const end = worldModel.stateAtEnd(validated.plan, validated.initialState);
  const next = worldModel.planAtState(validated, end);
  assert.equal(next.objects[0].parts[0].keys[0].rotation[0], .5);
  assert.equal(next.objects[0].parts[0].keys[1].rotation[0], .5);
  scene.ledger.world = validated; scene.ledger.states.end = end;
  const experience = load('src/spatialExperience.ts');
  const published = experience.buildSpatialExperience([{ sceneId: scene.sceneId, label: 'Scene', frameUrl: scene.nodes[0].frameUrl }], [scene], [], [], []);
  const restored = experience.parseSpatialExperience(JSON.stringify(published));
  assert.equal(restored.stages[0].scene.ledger.world.plan.objects[0].parts[0].id, 'head');
  assert.equal(restored.stages[0].scene.ledger.states.end.objects.car.parts.head.rotation[0], .5);
  let rendered;
  const THREE = require('three');
  const { createMotionRenderer } = load('src/motionGuideRenderer.ts', { three: { ...THREE, WebGLRenderer: class {
    shadowMap = {};
    setPixelRatio() {} setSize() {} render(scene) { rendered = scene; } dispose() {} forceContextLoss() {}
  } } });
  const renderer = createMotionRenderer({}, validated.plan, 960, 540);
  renderer.draw(0, next);
  const group = rendered.children.find(child => child.isGroup);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].rotation.x, .5);
  assert.equal(group.children[0].geometry.type, 'SphereGeometry');
  renderer.dispose();
  const invalid = worldModel.cloneWorld(validated);
  invalid.plan.objects[0].parts.push(part);
  assert.throws(() => worldModel.validateWorld(invalid), /Part IDs/);
  invalid.plan.objects[0].parts = Array.from({ length: 40 }, (_, index) => ({ ...part, id: `part-${index}` }));
  invalid.plan.objects = Array.from({ length: 30 }, (_, index) => ({ ...invalid.plan.objects[0], id: index === 0 ? 'car' : `object-${index}` }));
  const larger = worldModel.validateWorld(invalid);
  assert.equal(larger.plan.objects.length, 30);
  assert.equal(larger.plan.objects[0].parts.length, 40);
  scene.ledger.world = larger;
  const largePublished = experience.buildSpatialExperience([{ sceneId: scene.sceneId, label: 'Scene', frameUrl: scene.nodes[0].frameUrl }], [scene], [], [], []);
  assert.equal(experience.parseSpatialExperience(JSON.stringify(largePublished)).stages[0].scene.ledger.world.plan.objects.length, 30);
});
test('preview and publish hydration retain saved Three.js routes and reject older read snapshots', async () => {
  const scene = fixture();
  const newer = { scene, revision: 3 };
  const older = { scene: { ...scene, ledger: undefined }, revision: 2 };
  let response = newer;
  const client = load('src/spatialWorldClient.ts', { axios: { post: async () => ({ data: response }) } });
  await client.spatialOperation(client.spatialSession('/test', 1, scene.sceneId), 'read');
  response = older;
  const doc = { version: 1, stages: [{ id: scene.sceneId, label: 'Main', scene: older.scene, address: { sceneId: scene.sceneId }, contexts: [] }], entry: { stageId: scene.sceneId, nodeId: 'root' } };
  const hydrated = await client.hydrateSpatialExperience('/test', 1, doc);
  assert.equal(hydrated.stages[0].scene.ledger.world.revision, scene.ledger.world.revision);
  assert.equal(hydrated.stages[0].scene.ledger.routes.edge.backward.referenceVideo, 'https://assets.test/motion.mp4');
  assert.equal(hydrated.stages[0].scene.activeNodeId, 'root');
});

test('base world locks on first route; generation locks even without finished output', () => {
  const ledger = fixture().ledger;
  assert.equal(worldModel.baseWorldEditable(ledger, 0), true);
  assert.equal(worldModel.baseWorldEditable(ledger, 1), false);
  ledger.generationStarted = true;
  assert.equal(worldModel.authoringLocked(ledger), true);
  assert.equal(worldModel.baseWorldEditable(ledger, 0), false);
});
test('scene framing survives validation and defaults safely for legacy drafts', () => {
  for (const aspectRatio of ['16:9', '9:16', '1:1']) {
    assert.equal(worldModel.validateWorld({ ...fixture().ledger.world, aspectRatio }).aspectRatio, aspectRatio);
  }
  assert.equal(worldModel.validateWorld({ ...fixture().ledger.world, aspectRatio: 'invalid' }).aspectRatio, undefined);
});
test('legacy paid video callbacks stay blocked, but prompt authoring is preserved', async () => {
  const source = ts.createSourceFile('EditStory.tsx', fs.readFileSync(path.resolve(__dirname, '../src/EditStory.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['handleDirectLipSyncGenerate', 'handleBuildMotionGuide', 'runWanAnimate', 'GenerateVideox', 'GenerateVideo', 'handleCreateSpatialAction', 'handleGenerateAutoDrawGuide']);
  const callbacks = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.has(node.name.getText(source)) && node.initializer && ts.isCallExpression(node.initializer)) callbacks.set(node.name.getText(source), node.initializer.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(callbacks.size, names.size);
  for (const [name, callback] of callbacks) {
    const compiled = ts.transpileModule(`const callback = ${callback.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    // No API, billing or generation dependencies exist in this scope. Any
    // attempt to continue beyond the mode gate makes the test fail.
    const run = new Function('spatialStudioActiveRef', 'globalErrorEmitter', 'index', `${compiled}; return callback;`)({ current: true }, { emit() {} }, 0);
    if (name === 'GenerateVideox') await assert.rejects(() => run(), /Use Spatial Studio/);
    else await run();
  }
  const text = source.getFullText();
  for (const name of ['fetchAndGenerateImage', 'EditGeneratedVisualTextOnlyFn', 'handleVideoUpdateWithAi']) {
    const start = text.indexOf(`const ${name} =`);
    assert.ok(start >= 0);
    assert.doesNotMatch(text.slice(start, start + 350), /if \(spatialStudioActiveRef.current\) return/);
  }
  assert.match(text, /await spatialActionSubmitRef.current\(\)/);
});

test('renderable geometry survives absent or invalid navigation metadata without assets', () => {
  const { prepareSpatialReconstruction } = load('server/src/spatialReconstruction.ts');
  const plan = fixture().ledger.world.plan;
  const world = prepareSpatialReconstruction({ plan, controlledObject: 'missing', walkable: 'invalid' }, { version: 2, model: 'luna' });
  assert.deepEqual(world.plan, plan);
  assert.equal(world.approved, false);
  assert.equal(world.controlSelectionRequired, true);
  assert.deepEqual(world.references, []);
  assert.ok(world.walkable.length);
  assert.throws(() => prepareSpatialReconstruction({ plan: { ...plan, objects: [] } }, { version: 2, model: 'luna' }), /at least one/);
});

test('optional character and prop references accompany both provider payloads', () => {
  const job = { prompt: '@girl takes @sword', startAnchor: 'https://a/start.png', endAnchor: 'https://a/end.png', referenceVideo: 'https://a/motion.mp4', references: [{ name: 'girl', imageUrl: 'https://a/girl.png' }, { name: 'sword', imageUrl: 'https://a/sword.png' }] };
  for (const model of ['Pro', 'Proxxx']) {
    const payload = videoSpec.spatialVideoInput(model, job, '480p', '9:16', false);
    assert.deepEqual(payload.reference_images || payload.reference_image_urls, [job.startAnchor, ...job.references.map(ref => ref.imageUrl)]);
    assert.match(payload.prompt, /appearance reference for @girl/);
    assert.match(payload.prompt, /appearance reference for @sword/);
  }
});

test('movement payload is motion-led, excludes proxy stills, and return uses only real endpoints', () => {
  const legacy = { prompt: 'CAMERA: dolly forward to cockpit. MOTION: walk past the cup.', direction: 'forward', kind: 'movement', startAnchor: 'https://a/real-start.png', endAnchor: 'https://a/proxy-end.png', referenceVideo: 'https://a/three-motion.mp4', references: [{name:'ranger',imageUrl:'https://a/ranger.png'}] };
  for (const model of ['SeedanceMini','Proxxx']) {
    const forward = videoSpec.spatialVideoInput(model, legacy, '480p','9:16', false);
    assert.deepEqual(forward.reference_images || forward.reference_image_urls, [legacy.startAnchor, legacy.references[0].imageUrl]);
    assert.doesNotMatch(forward.prompt, /cockpit|walk past|proxy-end/);
    assert.match(forward.prompt, /stopping relation/);
    assert.match(forward.prompt, model === 'Proxxx' ? /Image 2 is the appearance reference/ : /\[Image2\] is the appearance reference/);
    const backward = videoSpec.spatialVideoInput(model, {...legacy,direction:'backward',startAnchor:'https://a/real-generated-end.png',endAnchor:legacy.startAnchor},'480p','9:16',false);
    assert.deepEqual(backward.reference_images || backward.reference_image_urls, ['https://a/real-generated-end.png',legacy.startAnchor,legacy.references[0].imageUrl]);
    assert.match(backward.prompt,/return motion reference/);
    assert.doesNotMatch(backward.prompt,/dolly forward|cockpit/);
    const action = videoSpec.spatialVideoInput(model,{...legacy,kind:'action',promptVersion:2,prompt:'Pick up the cup and drink.'},'480p','9:16',false);
    assert.match(action.prompt,/Pick up the cup and drink/);
  }
});

test('directional diagrams use the old reference-image roles and stay separate from real endpoints and identities', () => {
  const instruction = 'The ranger walks from beside the bench, past the mug and stops next to the desk in five seconds.\nCamera locked at a fixed third-person angle.';
  const job = { prompt: 'Follow the motion reference from its start to its end.', promptVersion: 2, kind: 'movement', guidance: {instruction}, startAnchor: 'https://a/real-start.png', endAnchor: 'https://a/proxy-end.png', referenceVideo: 'https://a/forward.mp4', references: [{name:'ranger',imageUrl:'https://a/ranger.png'}] };
  for (const model of ['Pro','Minix','SeedanceMini','pPro','Proxxx']) for (const direction of ['forward','backward']) {
    const returning = direction === 'backward';
    const diagram = `https://a/${direction}-diagram.png`;
    const payload = videoSpec.spatialVideoInput(model, {...job,direction,endAnchor:returning?'https://a/actual-destination.png':job.endAnchor,referenceVideo:`https://a/${direction}.mp4`,motionEvidence:{diagram:{imageUrl:diagram}}},'480p','9:16',false);
    assert.ok(payload.prompt.startsWith(instruction),'old refiner prose was rewritten');
    assert.deepEqual(payload.reference_images || payload.reference_image_urls,[job.startAnchor,...(returning?['https://a/actual-destination.png']:[]),diagram,job.references[0].imageUrl]);
    assert.deepEqual(payload.reference_videos || payload.reference_video_urls,[`https://a/${direction}.mp4`]);
    const image = number=>model==='Proxxx'?`Image ${number}`:`[Image${number}]`;
    assert.ok(payload.prompt.includes(`Use ${image(returning?3:2)} only as a spatial movement plan: its arrow, dots, labels, and overlays`));
    assert.ok(payload.prompt.includes(`${image(returning?4:3)} is the appearance reference for @ranger.`));
    assert.match(payload.prompt,/must never appear in the generated video/);
    assert.match(payload.prompt,/physical route, pose, timing and stopping relation/);
    assert.doesNotMatch(payload.prompt,/proxy-end/);
  }
});

test('motion planning retains the processed geometry before visual interpretation instead of refining without captures', async () => {
  const world = fixture().ledger.world, prepared=[];
  const { spatialWorldPlan } = load('server/src/SpatialWorldPlanRoute.ts', {
    openai: class {}, './textGeneration': {createRoutedTextClient:()=>({chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify({plan:world.plan})}}]})}}})},
    './requestAuth': {authenticatedUserId:()=>1}, './db': {getPixelsForUser:async()=>100,trySpendPixels:async()=>true},
    './languageModels': {languageModelForTier:()=> 'fixture',pixelsForTier:()=>1}, './aiUsageLedger': {recordOpenAiUsage(){},recordPixelCharge(){}},
    './spatialGenerationGuidance': {prepareSpatialGenerationGuidance:async(scene,job)=>{prepared.push({scene,job});return{key:'author-time',instruction:'Specific scene movement',motionContext:{}};}},
  });
  for (const operation of ['movement','return']) {
    let result, code=200;
    await spatialWorldPlan({body:{operation,llmTier:'luna',prompt:'walk to the cup',context:{videoPrompt:'LONG CAMERA: advance to the cockpit and drink'},world,sourceState:world.initialState,destinationState:world.initialState,recorded:world.plan}}, {status(n){code=n;return this;},json(value){result=value;return this;}});
    assert.equal(code,200,JSON.stringify(result));
    assert.ok(result.animatic.prompt.length<100);
    assert.equal(result.animatic.promptVersion,2);
    assert.doesNotMatch(result.animatic.prompt,/cockpit|drink|LONG CAMERA/);
    assert.equal(result.animatic.guidance,undefined);
    assert.equal(prepared.length,0,'interpretation ran before browser captures existed');
    assert.deepEqual(result.animatic.sourceState,world.initialState);
  }
});
test('dependencies block only descendants and wait for the saved actual end frame', () => {
  const jobs = [{ id: 'parent', dependsOn: [], status: 'failed' }, { id: 'child', dependsOn: ['parent'], status: 'queued' }, { id: 'grandchild', dependsOn: ['child'], status: 'queued' }, { id: 'other', dependsOn: [], status: 'queued' }];
  let next = worldModel.refreshJobDependencies(jobs);
  assert.deepEqual(next.map(j => j.status), ['failed', 'blocked', 'blocked', 'queued']);
  next[0].status = 'checking'; next = worldModel.refreshJobDependencies(next);
  assert.equal(next[1].status, 'waiting-on-parent');
  next[0].status = 'ready'; next = worldModel.refreshJobDependencies(next);
    assert.equal(next[1].status, 'waiting-on-parent', 'ready flag alone cannot replace an actual frame');
    next[0].actualEndFrame = 'https://assets.test/actual-end.png'; next = worldModel.refreshJobDependencies(next);
  assert.equal(next[1].status, 'queued'); assert.equal(next[2].status, 'waiting-on-parent');
});
test('reference-video quote is resolution sensitive and soft anchors never set incompatible hard frames', () => {
  for (const model of Object.keys(videoSpec.spatialVideoModels)) {
    assert.ok(videoSpec.spatialVideoPixels(model, '480p') < videoSpec.spatialVideoPixels(model, '720p'));
    const payload = videoSpec.spatialVideoInput(model, fixture().ledger.routes.edge.forward, '480p', '16:9', true);
    assert.equal(payload.image, undefined); assert.equal(payload.last_frame_image, undefined);
    assert.ok(payload.reference_videos || payload.reference_video_urls);
  }
  assert.equal(videoSpec.spatialVideoPixels('SeedanceMini', '480p'), 83);
  assert.equal(videoSpec.spatialVideoPixels('pPro', '480p'), 717);
  assert.throws(() => videoSpec.spatialVideoPixels('GPU', '480p'));
  assert.throws(() => videoSpec.spatialVideoPixels('Pro', '1080p'));
});
test('standard video quotes use the same Seedance reference rates as spatial jobs', () => {
  const { mediaChargeFor } = load('server/src/mediaPricing.ts', { './sourceMediaDuration': { SERVER_MEASURED_DURATION_FIELD: '__measured', SOURCE_MEDIA_MAX_SECONDS: 10 } });
  for (const [route, model] of [['/klingpro', 'Pro'], ['/sora2', 'Minix'], ['/seedance2mini', 'SeedanceMini'], ['/seedance2', 'pPro'], ['/klingrouteo1', 'Proxxx']]) {
    for (const resolution of ['480p', '720p']) {
      const price = mediaChargeFor(route, { videoLength: 5, resolution, referenceVideoUrl: 'https://assets.test/ref.mp4' });
      assert.equal(price.pixels, videoSpec.spatialVideoPixels(model, resolution));
      if (model !== 'Proxxx') assert.ok(price.pixels > mediaChargeFor(route, { videoLength: 5, resolution }).pixels);
    }
  }
});
test('viewer settings omit unused scenes while preserving explicit link destinations', () => {
  const { usedSpatialStages } = load('src/spatialExperience.ts');
  const stage = id => ({ id, label: id, address: { sceneId: id }, scene: { sceneId: id, nodes: [{ id: 'root', frameUrl: 'frame.png' }], connections: [] }, contexts: [] });
  const entry = stage('entry'), unused = stage('unused'), linked = stage('linked'), authored = stage('authored');
  entry.scene.nodes[0].actionLink = { sceneId: 'linked' }; authored.scene.connections = [{ id: 'route' }];
  assert.deepEqual(usedSpatialStages([entry, unused, linked, authored], 'entry').map(s => s.id), ['entry', 'linked', 'authored']);
});
for (const mode of ['video', 'three']) test(`${mode}: apple state belongs to the authored forward/backward pair`, () => {
  const { spatialTraversalForDrive, spatialAction, spatialBackDestination } = load('src/spatialPlayerModel.ts');
  const { threePlayableScene } = load('src/spatialThreePlayback.ts');
  const scene = fixture(), original = worldModel.cloneWorld(scene.ledger.world.initialState);
  original.conditions = { holdingApple: false };
  const carrying = worldModel.cloneWorld(original); carrying.conditions.holdingApple = true;
  scene.nodes = ['start', 'table', 'picked', 'tv'].map(id => ({ id, frameUrl: `https://assets.test/${id}.png` }));
  scene.ledger.states = { start: original, table: original, picked: carrying, tv: carrying };
  scene.connections = [['walk', 'start', 'table', 'movement'], ['pick', 'table', 'picked', 'action'], ['tvWalk', 'picked', 'tv', 'movement']].map(([id, sourceNodeId, targetNodeId, kind]) => ({
    id, sourceNodeId, targetNodeId, kind, movement: { samples: [{ x: 0, y: 1, radius: 1, elapsedMs: 5000 }] },
    forward: { videoUrl: `${id}-forward.mp4` }, backward: kind === 'movement' ? { videoUrl: `${id}-backward.mp4` } : null,
  }));
  scene.ledger.routes = Object.fromEntries(scene.connections.map(edge => {
    const forward = { ...worldModel.cloneWorld(fixture().ledger.routes.edge.forward), sourceState: scene.ledger.states[edge.sourceNodeId], endState: scene.ledger.states[edge.targetNodeId] };
    return [edge.id, { connectionId: edge.id, forward, backward: edge.backward ? { ...worldModel.cloneWorld(forward), sourceState: forward.endState, endState: forward.sourceState } : undefined }];
  }));
  const before = JSON.stringify(scene);
  const at = nodeId => ({ ...(mode === 'three' ? threePlayableScene(scene) : scene), activeNodeId: nodeId });
  const drive = y => ({ x: 0, y, radius: 1, active: true, angle: 0 });
  const go = (nodeId, y, expectedEdge, expectedHolding) => {
    const traversal = spatialTraversalForDrive(at(nodeId), drive(y));
    assert.equal(traversal.connection.id, expectedEdge);
    assert.equal(traversal.direction, y > 0 ? 'forward' : 'backward');
    assert.equal(scene.ledger.routes[expectedEdge][traversal.direction].endState.conditions.holdingApple, expectedHolding);
    assert.equal(scene.ledger.states[traversal.destinationNodeId].conditions.holdingApple, expectedHolding);
    return traversal.destinationNodeId;
  };
  assert.equal(go('start', 1, 'walk', false), 'table');
  assert.equal(spatialAction(at('table'), []).traversal.destinationNodeId, 'picked');
  assert.equal(go('picked', 1, 'tvWalk', true), 'tv');
  assert.equal(go('tv', -1, 'tvWalk', true), 'picked');
  assert.equal(spatialBackDestination(at('picked'), [], { skipActionResults: true }).position.nodeId, 'table');
  assert.equal(go('table', -1, 'walk', false), 'start');
  assert.equal(JSON.stringify(scene), before, 'playing routes must not rewrite saved state or plans');
});
test('spatial movement waits for its return video while legacy fallback stays unchanged', () => {
  const { playableSpatialScene } = load('src/spatialPlayerModel.ts');
  const scene = fixture(), edge = scene.connections[0];
  edge.forward = { videoUrl: 'forward.mp4' };
  assert.equal(playableSpatialScene(scene).connections.length, 0);
  assert.equal(playableSpatialScene({ ...scene, ledger: undefined }).connections.length, 1);
  edge.backward = { videoUrl: 'return.mp4' };
  assert.equal(playableSpatialScene(scene).connections.length, 1);
  edge.kind = 'action'; edge.backward = null;
  assert.equal(playableSpatialScene(scene).connections.length, 1);
});
test('B-shot prompt edits and distinguishable reordering preserve saved stage identity', () => {
  const { reconcileSpatialBShots } = load('src/spatialBShotIdentity.ts');
  let id = 0; const fresh = () => String(++id);
  const sources = [{ prompt: 'first', frameUrl: 'https://assets.test/a.png' }, { prompt: 'second', frameUrl: 'https://assets.test/b.png' }];
  const initial = reconcileSpatialBShots('parent', [], sources, fresh);
  initial[0].ledger = fixture().ledger;
  const edited = reconcileSpatialBShots('parent', initial, [{ ...sources[0], prompt: 'rewritten' }, sources[1]], fresh);
  assert.equal(edited[0].sceneId, initial[0].sceneId); assert.equal(edited[0].ledger, initial[0].ledger);
  const reordered = reconcileSpatialBShots('parent', edited, [sources[1], { ...sources[0], prompt: 'rewritten' }], fresh);
  assert.deepEqual(reordered.map(s => s.sceneId), [initial[1].sceneId, initial[0].sceneId]);
  const inserted = reconcileSpatialBShots('parent', reordered, [{ prompt: 'new', frameUrl: 'https://assets.test/new.png' }, sources[1], { ...sources[0], prompt: 'rewritten' }], fresh);
  assert.equal(inserted[2].sceneId, initial[0].sceneId); assert.notEqual(inserted[0].sceneId, initial[0].sceneId);
});
test('stable B-shot links ignore slot changes; legacy links resolve to their original saved stage', () => {
  const { resolveSpatialSceneLink, sameSpatialSceneLink } = load('src/spatialStageModel.ts');
  const legacy = { sceneId: 'parent', bShotIndex: 0, bShotIdentity: 'old-hash' };
  const current = { sceneId: 'parent', bShotIndex: 2, bShotIdentity: 'parent:b:0:old-hash' };
  assert.equal(sameSpatialSceneLink(legacy, current), true);
  assert.deepEqual(resolveSpatialSceneLink(legacy, [{ sceneId: 'parent' }], [['parent:b:shot-new', 'parent:b:shot-other', current.bShotIdentity]]), { sceneIndex: 0, bShotIndex: 2 });
  assert.equal(resolveSpatialSceneLink(legacy, [{ sceneId: 'parent' }], [[current.bShotIdentity, current.bShotIdentity]]), null);
});
test('identical B-shots restore by persisted slot and reorder by explicit source identity', () => {
  const { reconcileSpatialBShots } = load('src/spatialBShotIdentity.ts');
  const shot = { prompt: 'identical', frameUrl: 'https://assets.test/same.png' };
  let id = 0;
  const initial = reconcileSpatialBShots('parent', [], [shot, shot], () => String(++id));
  initial[0].ledger = fixture().ledger;
  const restored = reconcileSpatialBShots('parent', [initial[1], initial[0]], [shot, shot], () => String(++id));
  assert.deepEqual(restored.map(s => s.sceneId), initial.map(s => s.sceneId));
  assert.equal(restored[0].ledger, initial[0].ledger);
  const partial = reconcileSpatialBShots('parent', [initial[1]], [shot, shot], () => String(++id));
  assert.equal(partial[1].sceneId, initial[1].sceneId, 'saving only the second duplicate must restore that exact slot');
  assert.notEqual(partial[0].sceneId, partial[1].sceneId);
  const reordered = reconcileSpatialBShots('parent', restored, [{ ...shot, identity: initial[1].sceneId }, { ...shot, identity: initial[0].sceneId }], () => String(++id));
  assert.deepEqual(reordered.map(s => s.sceneId), [initial[1].sceneId, initial[0].sceneId]);
  assert.equal(reordered[1].bShotSource.slot, 1);
  assert.throws(() => reconcileSpatialBShots('parent', restored, [{ ...shot, identity: initial[0].sceneId }, { ...shot, identity: initial[0].sceneId }], () => 'unused'), /unique/);
  const legacy = initial.map(scene => ({ ...scene, ledger: fixture().ledger, bShotSource: shot }));
  const conflicted = reconcileSpatialBShots('parent', legacy, [shot, shot], () => String(++id));
  assert.equal(conflicted[0].ledger, undefined, 'ambiguous old graphs must never be silently assigned');
  assert.deepEqual(conflicted[0].bShotIdentityConflict, legacy.map(s => s.sceneId));
  assert.ok(reconcileSpatialBShots('parent', [legacy[0]], [shot, shot], () => String(++id))[0].bShotIdentityConflict);
});
function routeHarness(publishedDocument = null, postDeletedBeforeLock = false, nativeJson = false) {
  let document = null, transaction = Promise.resolve(), submits = 0, cancelled = 0, submission, imageCalls = 0, receipts = [], pollDelay, polls = 0, preparationDelay, preparationError, preparations = 0;
    const submittedInputs = [], upscaleInputs = [];
  const stateInputs = []; let stateError, stateDelay;
  const guidanceCache = load('server/src/spatialGenerationGuidance.ts', { './SpatialMotionContext': {
    compileSpatialMotionContexts: async (req, res) => {
      stateInputs.push(structuredClone(req.body));
      if (stateDelay) await stateDelay;
      if (stateError) return res.status(502).send({ message: stateError });
      return res.status(200).send({ contexts: [{ controlledSubject: 'subject', controlMode: 'mounted', primaryMotion: 'Keep the rider mounted and carried equipment attached.', ambientMotion: 'Other subjects remain in place.' }] });
    },
  } });
  const query = async (sql, args = []) => {
    if (sql.startsWith('CREATE')) return [];
    if (postDeletedBeforeLock && sql.startsWith('SELECT id FROM posts') && sql.endsWith('FOR UPDATE')) return [];
    if (sql.startsWith('SELECT id FROM')) return [{ id: 1 }];
    if (sql.startsWith('SELECT spatial_experience')) return publishedDocument ? [{spatial_experience_json:nativeJson?structuredClone(publishedDocument):JSON.stringify(publishedDocument)}] : [];
    if (sql.startsWith('UPDATE posts SET spatial_experience_json')) { publishedDocument=JSON.parse(args[0]); return {}; }
    if (sql.includes('FROM media_generation_jobs')) return receipts;
    if (sql.startsWith('SELECT')) return document ? [{ document: JSON.stringify(document) }] : [];
    if (sql.startsWith('INSERT')) { document = JSON.parse(args[4]); return {}; }
    if (sql.startsWith('UPDATE spatial_world')) { document = JSON.parse(args[0]); return {}; }
    throw new Error('Unexpected query: ' + sql);
  };
  const { spatialWorldDocument } = load('server/src/SpatialWorldRoutes.ts', {
    './execQuery': { __esModule: true, default: query, withTransaction: fn => { const next = transaction.then(() => fn(query)); transaction = next.catch(() => {}); return next; } },
    './requestAuth': { authenticatedUserId: () => 1 },
    './spatialGenerationGuidance': { ...guidanceCache, prepareSpatialGenerationGuidance: async (scene, job) => { const cached=guidanceCache.savedSpatialGenerationGuidance(scene,job);if(cached)return cached; preparations++; if (preparationDelay) await preparationDelay; if (preparationError) throw new Error(preparationError); return job.kind === 'action' ? undefined : { key: guidanceCache.spatialGenerationGuidanceInput(scene,job).key, instruction: 'Walk around the table and stop beside the chair. Camera locked.', motionContext: { controlledSubject: 'subject', controlMode: 'character', primaryMotion: 'Walk', ambientMotion: 'Hold positions' } }; } },
    './mediaBilling': { withMediaBilling: fn => fn, withMediaPollBilling: fn => fn },
    './fluxSchnellRoute': { pollVideoStatus: async (_req, res) => { polls++; const delay = pollDelay; pollDelay = undefined; if (delay) await delay; return res.json({ status: 'succeeded', videoUrl: 'https://assets.test/generated.mp4' }); }, BanannaRouteOld: async (_req, res) => { imageCalls++; if (submission) await submission; return res.json({ imageUrl: 'https://assets.test/action-edit.png' }); } },
    './SpatialVideoProvider': { submitSpatialVideo: async (_req, res) => { submits++; submittedInputs.push(structuredClone(_req.body)); if (submission) await submission; return res.json({ jobId: 'provider-1', provider: 'replicate', modelEndpoint: 'model' }); }, cancelSpatialVideo: async () => { cancelled++; } },
    './UpscaleRoute': { VIDEO_UPSCALE_MODEL: 'bytedance/video-upscaler', upscaleVideoRoute: async (_req, res) => { upscaleInputs.push(structuredClone(_req.body)); if (submission) await submission; return res.json({ status: 'starting', jobId: 'upscale-1', provider: 'replicate', modelEndpoint: 'bytedance/video-upscaler' }); } },
    './sourceMediaDuration': { attachMeasuredSourceDuration: async () => {} },
    './mediaPricing': { mediaChargeFor: (route, input) => ({ pixels: route === '/upscaleVideo' ? load('server/src/videoUpscaleSpec.ts').videoUpscalePixels(input.duration, input.targetResolution) : 1 }) },
  });
  const call = async (action, fields = {}) => {
    if(action==='quote' && !fields.skipPrepare) await call('prepare-guidance',{routeId:fields.routeId,sceneContext:fields.sceneContext});
    const req = { body: { postId: 1, stageId: 'scene-a', action, ...fields } };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, setHeader() {}, json(body) { this.body = body; return this; } };
    await spatialWorldDocument(req, res); return res;
  };
  const start = async () => {
    assert.equal((await call('save', { scene: fixture(), revision: 0 })).statusCode, 200);
    const options = { model: 'SeedanceMini', resolution: '480p', aspect: '16:9', audio: false };
    const quote = await call('quote', { options });
    assert.equal(quote.body.quote.pixels, 166);
    return { options, quoteKey: quote.body.quote.key };
  };
  call.published = () => structuredClone(publishedDocument);
  return { call, start, stateInputs: () => stateInputs, failState: message => stateError = message, deferState: () => { let release; stateDelay = new Promise(r => release = r); return release; }, snapshot: () => document, preparations: () => preparations, failPreparation: message => preparationError = message, deferPreparation: () => { let release; preparationDelay = new Promise(r => release = r); return release; }, submittedInputs: () => submittedInputs, upscaleInputs: () => upscaleInputs, polls: () => polls, deferPoll: () => { let release; pollDelay = new Promise(r => release = r); return release; }, receipts: value => { receipts = value; }, submits: () => submits, imageCalls: () => imageCalls, cancelled: () => cancelled, defer: () => { let release; submission = new Promise(r => release = r); return release; } };
}

test('audio references survive owned draft saves, quote creation and provider dispatch; clearing updates route and job', async () => {
  const h=routeHarness(),scene=fixture(),audio={url:'https://assets.test/sound.mp3',sourceUrl:'https://assets.test/upload.mp3',name:'Leaper',duration:5,enabled:true};
  scene.ledger.actionAudioReferences={root:audio};scene.ledger.routes.edge.forward.audioReference=audio;
  assert.equal((await h.call('save',{scene,revision:0})).statusCode,200);assert.deepEqual(h.snapshot().scene.ledger.actionAudioReferences.root,audio);
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};const quote=await h.call('quote',{options});assert.deepEqual(quote.body.quote.jobs[0].audioReference,audio);
  assert.equal((await h.call('start',{options,quoteKey:quote.body.quote.key})).statusCode,200);
  await h.call('tick',{jobId:'edge:forward'});assert.deepEqual(h.submittedInputs()[0].job.audioReference,audio);
  h.snapshot().scene.ledger.jobs[0].status='failed';h.snapshot().scene.ledger.jobs[0].submissionUncertain=false;
  const edit=await h.call('edit-prompt',{jobId:'edge:forward',prompt:'The leaper approaches.',audioReference:null});assert.equal(edit.statusCode,200,JSON.stringify(edit.body));assert.equal(h.snapshot().scene.ledger.jobs[0].audioReference,undefined);assert.equal(h.snapshot().scene.ledger.routes.edge.forward.audioReference,undefined);
  assert.deepEqual(h.snapshot().scene.ledger.jobs[0].audioReferenceHistory,[audio]);
  const cleared=structuredClone(h.snapshot().scene);delete cleared.ledger.actionAudioReferences.root;
  const receipt=await h.call('save',{scene:cleared,revision:h.snapshot().revision});assert.equal(receipt.statusCode,200,JSON.stringify(receipt.body));
  assert.deepEqual(h.snapshot().scene.ledger.actionAudioReferenceHistory,[audio]);
});

test('audio draft validation rejects deleted-node references and overlong clips before submission', async () => {
  const audio={url:'https://assets.test/sound.mp3',name:'Leaper',duration:5,enabled:true};
  const h=routeHarness(),scene=fixture();scene.ledger.actionAudioReferences={deleted:audio};assert.notEqual((await h.call('save',{scene,revision:0})).statusCode,200);assert.equal(h.submits(),0);
  delete scene.ledger.actionAudioReferences;scene.ledger.routes.edge.forward.audioReference={...audio,duration:8};assert.notEqual((await h.call('save',{scene,revision:0})).statusCode,200);assert.equal(h.submits(),0);
});

test('resetting an authored thread prunes node audio while retaining cleared clip assets for eventual post deletion', async () => {
  const h=routeHarness(),scene=fixture(),audio={url:'https://assets.test/sound.mp3',sourceUrl:'https://assets.test/upload.mp3',name:'Leaper',duration:5,enabled:true};
  const prior={...audio,url:'https://assets.test/prior.mp3'};
  scene.ledger.actionAudioReferences={end:audio};scene.ledger.routes.edge.forward.audioReference=audio;scene.ledger.routes.edge.forward.audioReferenceHistory=[prior];
  assert.equal((await h.call('save',{scene,revision:0})).statusCode,200);
  const cut=load('src/spatialStageModel.ts').cutSpatialNodeThread(h.snapshot().scene,'end');
  assert.deepEqual(cut.scene.ledger.actionAudioReferences,{});
  const receipt=await h.call('save',{scene:cut.scene,revision:h.snapshot().revision});assert.equal(receipt.statusCode,200,JSON.stringify(receipt.body));
  assert.deepEqual(h.snapshot().scene.ledger.actionAudioReferenceHistory,[audio,prior]);assert.equal(h.submits(),0);
});

test('a spatial save cannot resurrect a draft after the owned post was deleted between request and transaction', async () => {
  const h = routeHarness(null, true);
  const response = await h.call('save', {scene: fixture(), revision: 0});
  assert.equal(response.statusCode, 409); assert.match(response.body.message, /deleted/);
  assert.equal(h.snapshot(), null); assert.equal(h.submits(), 0);
});

function referenceRequest(scene, direction = 'forward') {
  const animation = scene.ledger.routes.edge[direction], aspect = scene.ledger.world.aspectRatio || '16:9';
  const { motionEvidencePlanText, motionEvidenceTimes } = load('server/src/spatialMotionEvidence.ts');
  const planKey = require('node:crypto').createHash('sha256').update(motionEvidencePlanText(animation.plan, aspect)).digest('hex');
  return { routeId: 'edge', direction, animationId: animation.id, worldRevision: scene.ledger.world.revision, planKey,
    motionEvidence: { animationId: animation.id, planKey, aspectRatio: aspect,
      frames: motionEvidenceTimes(animation.plan.duration).map((t, i) => ({ t, imageUrl: `https://assets.test/frame-${i}.png` })),
      diagram: { imageUrl: 'https://assets.test/diagram.png' } } };
}

async function generatedActionHarness(childKind = 'movement') {
  const h = routeHarness(), scene = fixture();
  scene.connections[0].kind = 'action'; scene.connections[0].actionPrompt = 'Mount the dragon carrying the silver sword';
  delete scene.ledger.routes.edge.backward;
  scene.nodes.push({ id: 'child', frameUrl: 'https://assets.test/planned-child.png' });
  scene.connections.push({ ...structuredClone(scene.connections[0]), id: 'child-edge', sourceNodeId: 'end', targetNodeId: 'child', kind: childKind, actionPrompt: childKind === 'action' ? 'Dismount and keep carrying the silver sword.' : undefined });
  scene.ledger.routes['child-edge'] = { ...structuredClone(scene.ledger.routes.edge), connectionId: 'child-edge', forward: { ...structuredClone(scene.ledger.routes.edge.forward), id: 'child-motion', prompt: 'Follow the motion reference from its start to its end.', creatorInstruction: '' } };
  scene.ledger.routes['child-edge'].backward = { ...structuredClone(scene.ledger.routes['child-edge'].forward), id: 'child-return' };
  if (childKind === 'action') { delete scene.ledger.routes['child-edge'].backward; scene.ledger.routes['child-edge'].forward.prompt = 'Dismount and keep carrying the silver sword.'; }
  scene.ledger.states.child = structuredClone(scene.ledger.states.end);
  const saved = await h.call('save', { scene, revision: 0 }); assert.equal(saved.statusCode, 200, JSON.stringify(saved.body));
  const options = { model: 'SeedanceMini', resolution: '480p', aspect: '16:9', audio: false };
  const quote = await h.call('quote', { options });
  assert.equal((await h.call('start', { options, quoteKey: quote.body.quote.key })).statusCode, 200);
  await h.call('tick', { jobId: 'edge:forward' }); await h.call('tick', { jobId: 'edge:forward' });
  const job = h.snapshot().scene.ledger.jobs.find(job => job.id === 'edge:forward');
  return { h, fields: { jobId: job.id, epoch: 1, automatic: true, attempt: job.attempt, sourceOutput: job.output, videoUrl: 'https://assets.test/paid-upload.mp4', endFrame: 'https://assets.test/actual-mounted-sword.png' } };
}

test('actual action frame compiles before readiness and descendants refresh against that node', async () => {
  const { h, fields } = await generatedActionHarness();
  const release = h.deferState(), pending = h.call('complete', fields);
  while (!h.stateInputs().length) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.snapshot().scene.ledger.jobs[0].status, 'checking');
  assert.equal(h.snapshot().scene.ledger.jobs[1].status, 'waiting-on-parent');
  assert.equal(h.snapshot().scene.ledger.jobs[0].completionAssets.videoUrl, fields.videoUrl);
  const analysis = h.stateInputs()[0].scenes[0];
  assert.equal(analysis.stateMode, 'post-action'); assert.equal(analysis.finalFrameUrl, fields.endFrame);
  assert.equal(analysis.plannedState, undefined); assert.match(analysis.completedAction, /silver sword/);
  release(); assert.equal((await pending).statusCode, 200);
  const context = h.snapshot().scene.ledger.nodeContexts.end;
  assert.equal(context.frameUrl, fields.endFrame); assert.match(context.motionContext.primaryMotion, /rider mounted/);
  assert.equal(h.snapshot().scene.ledger.jobs[1].status, 'queued');
  assert.equal((await h.call('complete', fields)).statusCode, 200); assert.equal(h.stateInputs().length, 1);
  const prepared = h.preparations(); await h.call('tick', { jobId: 'child-edge:forward' });
  assert.equal(h.submits(), 2); assert.ok(h.preparations() > prepared);
  assert.equal(h.submittedInputs().at(-1).job.startAnchor, fields.endFrame);
  assert.equal(h.snapshot().scene.ledger.jobs[0].completionAssets, undefined);
});

test('a following action uses actual compiled state without rewriting its creator prompt or adding AI calls', async () => {
  for (const legacy of [false, true]) {
    const { h, fields } = await generatedActionHarness('action');
    if (legacy) {
      const scene = h.snapshot().scene, job = scene.ledger.jobs[0];
      job.status = 'ready'; job.output = fields.videoUrl; job.actualEndFrame = fields.endFrame; job.continuity = 'approved';
      scene.nodes.find(node => node.id === 'end').frameUrl = fields.endFrame;
      scene.ledger.jobs = worldModel.refreshJobDependencies(scene.ledger.jobs);
    } else await h.call('complete', fields);
    await h.call('tick', { jobId: 'child-edge:forward' });
    assert.equal(h.submits(), 2); assert.equal(h.stateInputs().length, 1);
    const input = h.submittedInputs().at(-1);
    assert.equal(input.job.startAnchor, fields.endFrame);
    assert.equal(input.job.prompt, 'Dismount and keep carrying the silver sword.');
    assert.equal(input.job.currentMotionContext.controlMode, 'mounted');
    const provider = videoSpec.spatialVideoInput('SeedanceMini', input.job, '480p', '16:9', false);
    assert.match(provider.prompt, /rider mounted and carried equipment attached/);
    assert.match(provider.prompt, /new creator instruction above has priority/);
    assert.equal(provider.reference_images[0], fields.endFrame);
  }
});

test('failed action analysis retains uploaded assets, blocks descendants and retries without another video submission', async () => {
  const { h, fields } = await generatedActionHarness(); h.failState('Incomplete frame analysis');
  const failed = await h.call('complete', fields); assert.equal(failed.statusCode, 409);
  const job = failed.body.document.scene.ledger.jobs[0];
  assert.equal(job.status, 'checking'); assert.equal(job.completionError, 'Incomplete frame analysis');
  assert.deepEqual(job.completionAssets, { videoUrl: fields.videoUrl, endFrame: fields.endFrame, attempt: fields.attempt, sourceOutput: fields.sourceOutput });
  assert.equal(worldModel.spatialJobIsActive(job), false);
  await h.call('tick', { jobId: 'child-edge:forward' }); assert.equal(h.submits(), 1);
  h.failState(undefined); assert.equal((await h.call('complete', fields)).statusCode, 200);
  assert.equal(h.submits(), 1); assert.equal(h.stateInputs().length, 2);
  assert.equal(h.snapshot().scene.ledger.jobs[0].completionError, undefined);
  assert.equal(h.snapshot().scene.ledger.jobs[1].status, 'queued');
});

test('restoring an action video restores the state context from that same actual endpoint', async () => {
  const { h, fields } = await generatedActionHarness(); await h.call('complete', fields);
  const original = structuredClone(h.snapshot().scene.ledger.nodeContexts.end);
  for (const finishReplacement of [false, true]) {
    const old = h.snapshot().scene.ledger.jobs[0];
    assert.equal((await h.call('regenerate', { jobId: old.id, confirmation: old.id, pixels: old.pixels })).statusCode, 200);
    let replacement = h.snapshot().scene.ledger.jobs[0];
    assert.deepEqual(replacement.previousResult.nodeContext, original);
    if (finishReplacement) {
      await h.call('tick', { jobId: replacement.id }); await h.call('tick', { jobId: replacement.id });
      replacement = h.snapshot().scene.ledger.jobs[0];
      const saved = await h.call('complete', { ...fields, attempt: replacement.attempt, sourceOutput: replacement.output,
        videoUrl: 'https://assets.test/replacement.mp4', endFrame: 'https://assets.test/replacement-state.png' });
      assert.equal(saved.statusCode, 200); assert.notEqual(h.snapshot().scene.ledger.nodeContexts.end.key, original.key);
    } else replacement.status = 'failed';
    assert.equal((await h.call('restore-result', { jobId: replacement.id })).statusCode, 200);
    assert.deepEqual(h.snapshot().scene.ledger.nodeContexts.end, original);
    assert.equal(h.snapshot().scene.nodes.find(node => node.id === 'end').frameUrl, original.frameUrl);
    assert.equal(h.snapshot().scene.ledger.jobs[0].actualEndFrame, original.frameUrl);
  }
});

test('deleted action generation cannot become ready after a delayed frame analysis', async () => {
  const { h, fields } = await generatedActionHarness(); const release = h.deferState(), pending = h.call('complete', fields);
  while (!h.stateInputs().length) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await h.call('delete', { confirmation: 'DELETE' })).statusCode, 200);
  release(); assert.equal((await pending).statusCode, 409);
  assert.equal(h.snapshot().scene.ledger.jobs.length, 0); assert.equal(h.submits(), 1);
});

test('actual node contexts follow their branch and stop at an uncompiled action boundary', () => {
  const { spatialNodeContext } = load('server/src/spatialGenerationGuidance.ts', { './SpatialMotionContext': {} });
  const scene = fixture(); scene.connections[0].kind = 'action';
  const context = name => ({ key: name, frameUrl: 'https://assets.test/' + name, motionContext: { controlledSubject: name, controlMode: 'character', primaryMotion: name, ambientMotion: '' } });
  scene.ledger.nodeContexts = { root: context('unmounted'), end: context('mounted') };
  scene.connections.push({ id: 'branch', sourceNodeId: 'root', targetNodeId: 'branch-end', kind: 'movement' }, { id: 'descendant', sourceNodeId: 'end', targetNodeId: 'descendant-end', kind: 'movement' });
  assert.equal(spatialNodeContext(scene, 'branch-end').key, 'unmounted');
  assert.equal(spatialNodeContext(scene, 'descendant-end').key, 'mounted');
  delete scene.ledger.nodeContexts.end; assert.equal(spatialNodeContext(scene, 'descendant-end'), undefined);
});

test('actual compiled frames remain current appearance evidence when the generation receipt is absent', () => {
  const { spatialAppearanceFrame } = load('src/spatialPlayerModel.ts'), scene = fixture();
  scene.ledger.nodeContexts = { end: { key:'actual-state', frameUrl:'https://assets.test/actual-state.png', motionContext:{controlledSubject:'actor',controlMode:'mounted',primaryMotion:'Mounted',ambientMotion:'Hold'} } };
  assert.equal(spatialAppearanceFrame(scene, 'end'), scene.ledger.nodeContexts.end.frameUrl);
  scene.nodes.push({ id:'child', frameUrl:'https://assets.test/proxy.png' });
  scene.connections.push({ id:'child-edge', sourceNodeId:'end', targetNodeId:'child' });
  scene.ledger.routes['child-edge'] = structuredClone(scene.ledger.routes.edge);
  assert.equal(spatialAppearanceFrame(scene, 'child'), scene.ledger.nodeContexts.end.frameUrl);
  scene.ledger.jobs.push({connectionId:'child-edge',direction:'forward',status:'ready',actualEndFrame:'https://assets.test/later-actual.png'});
  assert.equal(spatialAppearanceFrame(scene, 'child'), 'https://assets.test/later-actual.png');
});

test('older ready actions are repaired from their actual endpoint before descendant dispatch', async () => {
  const { h, fields } = await generatedActionHarness(), scene = h.snapshot().scene, job = scene.ledger.jobs[0];
  job.status = 'ready'; job.output = fields.videoUrl; job.actualEndFrame = fields.endFrame; job.continuity = 'approved';
  scene.nodes.find(node => node.id === 'end').frameUrl = fields.endFrame;
  scene.ledger.jobs = worldModel.refreshJobDependencies(scene.ledger.jobs);
  assert.equal(scene.ledger.nodeContexts, undefined);
  assert.equal((await h.call('tick', { jobId: 'child-edge:forward' })).statusCode, 200);
  assert.equal(h.stateInputs()[0].scenes[0].finalFrameUrl, fields.endFrame);
  assert.equal(h.snapshot().scene.ledger.nodeContexts.end.frameUrl, fields.endFrame);
  assert.equal(h.submittedInputs().at(-1).job.startAnchor, fields.endFrame); assert.equal(h.submits(), 2);
});

test('deleting generated videos removes actual state context without deleting the mapped motion', async () => {
  const { h, fields } = await generatedActionHarness(); await h.call('complete', fields);
  assert.ok(h.snapshot().scene.ledger.nodeContexts.end);
  assert.equal((await h.call('delete', { confirmation: 'DELETE' })).statusCode, 200);
  assert.equal(h.snapshot().scene.ledger.nodeContexts, undefined); assert.equal(h.snapshot().scene.ledger.jobs.length, 0);
  assert.ok(h.snapshot().scene.ledger.routes.edge); assert.ok(h.snapshot().scene.ledger.routes['child-edge']);
});

test('reopening a failed state save reuses persisted uploads and never extracts or uploads its paid result again', async () => {
  const scene = fixture(); const receipt = { videoUrl: 'https://assets.test/uploaded.mp4', endFrame: 'https://assets.test/final.png', attempt: 1, sourceOutput: 'https://provider.test/paid.mp4' };
  scene.ledger.jobs = [{ id: 'edge:forward', status: 'checking', attempt: 1, output: receipt.sourceOutput, completionAssets: receipt, completionError: 'Retry frame analysis' }];
  let completions = 0;
  const client = load('src/spatialWorldClient.ts', {
    axios: { post: async (url, body) => {
      if (body.action === 'complete') { completions++; assert.equal(body.sourceOutput, receipt.sourceOutput); assert.equal(body.videoUrl, receipt.videoUrl); assert.equal(body.endFrame, receipt.endFrame); scene.ledger.jobs[0].status = 'ready'; }
      return { data: { scene, revision: completions } };
    } },
    './spatialResultAssets': { persistSpatialResultAssets: async (api, output, cached) => { assert.deepEqual(cached, { videoUrl: receipt.videoUrl, endFrame: receipt.endFrame }); return cached; } },
  });
  const session = client.spatialSession('/receipt-test', 1, scene.sceneId); await client.spatialOperation(session, 'read');
  await session.finalize(session.value.scene.ledger.jobs[0], 0); assert.equal(completions, 1);
});

test('same-animation plan edits invalidate partial and completed reference assets and reject late exports', async () => {
  for (const completed of [false, true]) {
    const h = routeHarness(), scene = structuredClone(fixture());
    scene.ledger.routes.edge.backward.startAnchor = scene.ledger.routes.edge.forward.endAnchor;
    scene.ledger.routes.edge.backward.endAnchor = scene.ledger.routes.edge.forward.startAnchor;
    scene.ledger.routes.edge.forward.guidance = { key: 'old', instruction: 'Old prepared movement.' };
    await h.call('save', { scene, revision: 0 });
    const reference = referenceRequest(h.snapshot().scene);
    const oldExport = { ...reference, referenceVideo: 'https://assets.test/export.mp4', endAnchor: 'https://assets.test/export-end.png' };
    assert.equal((await h.call('save-reference', completed ? oldExport : reference)).statusCode, 200);
    const changed = structuredClone(h.snapshot().scene);
    changed.ledger.routes.edge.forward.plan.objects[0].keys.at(-1).position[0] = 2;
    assert.equal((await h.call('save', { scene: changed, revision: h.snapshot().revision })).statusCode, 200);
    const animation = h.snapshot().scene.ledger.routes.edge.forward;
    for (const field of ['referenceVideo', 'referencePlanKey', 'endAnchor', 'motionEvidence', 'guidance']) assert.equal(animation[field], undefined, field);
    const revision = h.snapshot().revision;
    assert.equal((await h.call('save-reference', oldExport)).statusCode, 409);
    assert.equal((await h.call('save-reference', reference)).statusCode, 409);
    assert.equal(h.snapshot().revision, revision);
    const replacement = { ...referenceRequest(h.snapshot().scene), referenceVideo: 'https://assets.test/new-plan.mp4', endAnchor: 'https://assets.test/new-plan-end.png' };
    assert.equal((await h.call('save-reference', replacement)).statusCode, 200);
    assert.equal(h.snapshot().scene.nodes.find(node => node.id === 'end').frameUrl, replacement.endAnchor);
    assert.equal(h.snapshot().scene.ledger.routes.edge.backward.startAnchor, replacement.endAnchor);
  }
});

test('reference saves reject wrong plan hashes without changing persisted assets', async () => {
  const h = routeHarness(); await h.call('save', { scene: fixture(), revision: 0 });
  const before = structuredClone(h.snapshot()), reference = referenceRequest(before.scene);
  const result = await h.call('save-reference', { ...reference, planKey: 'stale-plan', referenceVideo: 'https://assets.test/stale.mp4' });
  assert.equal(result.statusCode, 409); assert.deepEqual(h.snapshot(), before);
});

test('a stale foreground draft save rebases only reference completions and retains their endpoint and assets', async () => {
  const h = routeHarness(); await h.call('save', { scene: fixture(), revision: 0 });
  const before = structuredClone(h.snapshot()), next = structuredClone(before.scene);
  const { sceneWithoutReferenceAssets } = load('server/src/spatialReferenceAssets.ts');
  const referenceBaseKey = require('node:crypto').createHash('sha256').update(JSON.stringify(sceneWithoutReferenceAssets(before.scene))).digest('hex');
  next.ledger.draft = { plan: structuredClone(next.ledger.world.plan), samples: [], kind: 'movement', prompt: 'Next recording', sourceNodeId: 'root' };
  const reference = { ...referenceRequest(before.scene), referenceVideo: 'https://assets.test/background.mp4', endAnchor: 'https://assets.test/background-end.png' };
  assert.equal((await h.call('save-reference', reference)).statusCode, 200);
  const saved = await h.call('save', { scene: next, revision: before.revision, referenceBaseKey });
  assert.equal(saved.statusCode, 200, saved.body.message);
  const current = h.snapshot().scene;
  assert.equal(current.ledger.draft.prompt, 'Next recording');
  assert.equal(current.ledger.routes.edge.forward.referenceVideo, reference.referenceVideo);
  assert.equal(current.ledger.routes.edge.forward.motionEvidence.planKey, reference.planKey);
  assert.equal(current.nodes.find(node => node.id === 'end').frameUrl, reference.endAnchor);
});

test('real prompt and graph edits still reject stale foreground saves even with a reference base hash', async () => {
  for (const edit of ['prompt', 'graph']) {
    const h = routeHarness(); await h.call('save', { scene: fixture(), revision: 0 });
    const before = structuredClone(h.snapshot());
    const { sceneWithoutReferenceAssets } = load('server/src/spatialReferenceAssets.ts');
    const referenceBaseKey = require('node:crypto').createHash('sha256').update(JSON.stringify(sceneWithoutReferenceAssets(before.scene))).digest('hex');
    if (edit === 'prompt') await h.call('edit-prompt', { routeId: 'edge', direction: 'forward', prompt: 'My manual instruction.' });
    else { const changed = structuredClone(before.scene); changed.nodes[1].label = 'Renamed spot'; await h.call('save', { scene: changed, revision: before.revision }); }
    const current = structuredClone(h.snapshot());
    assert.equal((await h.call('save', { scene: before.scene, revision: before.revision, referenceBaseKey })).statusCode, 409);
    assert.deepEqual(h.snapshot(), current);
  }
});

test('final targeted reference completion preserves a concurrent manual prompt without another preparation pass', async () => {
  const h = routeHarness(), scene = fixture();
  scene.ledger.routes.edge.forward.guidance = { key: 'existing', instruction: 'Previously prepared movement.' };
  await h.call('save', { scene, revision: 0 });
  const reference = referenceRequest(h.snapshot().scene);
  await h.call('save-reference', reference);
  await h.call('edit-prompt', { routeId: 'edge', direction: 'forward', prompt: 'Turn left and stop at my exact chosen spot.' });
  const count = h.preparations();
  assert.equal((await h.call('save-reference', { ...reference, referenceVideo: 'https://assets.test/completed.mp4' })).statusCode, 200);
  const animation = h.snapshot().scene.ledger.routes.edge.forward;
  assert.equal(animation.prompt, 'Turn left and stop at my exact chosen spot.');
  assert.equal(animation.guidance.instruction, animation.prompt);
  assert.equal(animation.referencePlanKey, reference.planKey);
  assert.equal(h.preparations(), count);
});

test('scene calibration matches renderer perspective/compound transforms without a backend Three.js dependency', () => {
  const {projectedSceneBoxes,sceneCalibrationIssues,validateSceneLayout}=load('server/src/spatialSceneCalibration.ts');
  const THREE=require('three'),plan=fixture().ledger.world.plan,object=plan.objects[0];
  object.keys[0].rotation=[.2,.4,-.15];object.keys[0].scale=[1,1.5,.7];
  object.parts=[{id:'seat',keys:[{...structuredClone(object.keys[0]),position:[.2,.1,0],scale:[.6,.4,.9]}]}];
  const key=plan.camera[0],camera=new THREE.PerspectiveCamera(key.fov,9/16,.05,500);camera.position.set(...key.position);camera.lookAt(new THREE.Vector3(...key.target));camera.updateMatrixWorld();
  const matrix=k=>new THREE.Matrix4().compose(new THREE.Vector3(...k.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...k.rotation)),new THREE.Vector3(...k.scale));
  const combined=matrix(object.keys[0]).multiply(matrix(object.parts[0].keys[0])),points=[];
  for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])points.push(new THREE.Vector3(x,y,z).applyMatrix4(combined).project(camera));
  const clamp=n=>Math.max(0,Math.min(1,n)),left=clamp((Math.min(...points.map(p=>p.x))+1)/2),right=clamp((Math.max(...points.map(p=>p.x))+1)/2),top=clamp((1-Math.max(...points.map(p=>p.y)))/2),bottom=clamp((1-Math.min(...points.map(p=>p.y)))/2);
  const expected=[left,top,right-left,bottom-top],actual=projectedSceneBoxes(plan,'9:16')[object.id];actual.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-10));
  const layout=validateSceneLayout({camera:'Source perspective',landmarks:[{id:object.id,description:'Controlled subject',box:expected,occluded:false}]});
  assert.deepEqual(sceneCalibrationIssues(plan,layout,'9:16'),[]);
  object.keys[0].position[0]+=3;assert.match(sceneCalibrationIssues(plan,layout,'9:16').join(' '),/framing\/scale|outside/);
  assert.match(sceneCalibrationIssues(plan,{...layout,landmarks:[{...layout.landmarks[0],id:'chair'}]},'9:16').join(' '),/Missing chair/);
  assert.throws(()=>validateSceneLayout({camera:'x',landmarks:[{id:'chair',box:[.5,.5,.8,.2],description:'Chair',occluded:false}]}));
});

test('3D guidance uses the OLD compiler/refiner with full intent and authored state; real frame binding does not re-run intelligence', async()=>{
  const scene=fixture(),calls=[];
  const context={sceneId:scene.sceneId,controlledSubject:'The ranger',controlMode:'character',primaryMotion:'Walk with the established deliberate human gait.',ambientMotion:'Other subjects remain anchored in their current positions.'};
  const guidance=load('server/src/spatialGenerationGuidance.ts',{
    openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async args=>{calls.push(args);const data=JSON.parse(args.messages.find(m=>m.role==='user').content[0].text);return {choices:[{message:{content:JSON.stringify(data.scenes?{contexts:[context]}:{startRelation:'beside the door',route:'around the desk',endRelation:'beside the chair',controlledMovement:'The ranger walks around the desk and stops beside the chair over 5 seconds.',secondaryMotion:'Other subjects remain in place.',spatialPlan:{cameraMode:'fixed',unitStaysInside:true,preservesControlState:true,inventsEnvironment:false,boundaryLimited:false,path:[{x:.4,y:0,z:.3},{x:.6,y:0,z:.4}]}})}}]};}}}})},'./aiUsageLedger':{recordOpenAiUsage(){}},
  });
  scene.ledger.world.drivenName='Ranger';scene.ledger.routes.edge.backward=structuredClone(scene.ledger.routes.edge.backward);scene.ledger.routes.edge.forward.creatorInstruction='Walk to the chair';
  const {motionEvidencePlanText,motionEvidenceTimes}=load('server/src/spatialMotionEvidence.ts');
  for(const direction of ['forward','backward']){
    const animation=scene.ledger.routes.edge[direction];animation.id=`animation-${direction}`;
    animation.motionEvidence={animationId:animation.id,aspectRatio:'16:9',planKey:require('node:crypto').createHash('sha256').update(motionEvidencePlanText(animation.plan,'16:9')).digest('hex'),frames:motionEvidenceTimes(5).map(t=>({t,imageUrl:`https://assets.test/${direction}-${t}.png`})),diagram:{imageUrl:`https://assets.test/${direction}-diagram.png`}};
  }
  const job={id:'edge:forward',connectionId:'edge',direction:'forward',kind:'movement',dependsOn:[],sourceNodeId:'root',duration:5,startAnchor:'https://a/ACTUAL.png',endAnchor:'https://a/proxy.png',referenceVideo:'https://a/FORWARD.mp4',prompt:'Follow the motion reference from its start to its end.',promptVersion:2,sceneContext:{sceneIntent:'Explore the cabin',videoPrompt:'Ranger approaches his workstation',imagePrompt:'A detailed cabin with chair and desk'}};
  const result=await guidance.prepareSpatialGenerationGuidance(scene,job);assert.equal(calls.length,2);assert.match(result.instruction,/walks around the desk/);assert.match(result.instruction,/Camera locked/);
  const compiler=JSON.parse(calls[0].messages.find(m=>m.role==='user').content[0].text);assert.match(compiler.scenes[0].sceneIntent,/Explore the cabin/);assert.equal(compiler.scenes[0].videoPrompt,job.sceneContext.videoPrompt);
  assert.ok(calls[0].messages.find(m=>m.role==='user').content.some(part=>part.image_url?.url===scene.ledger.world.sourceImage));
  assert.deepEqual(compiler.scenes[0].plannedState,scene.ledger.routes.edge.forward.sourceState);
  const refine=calls[1].messages.find(m=>m.role==='user').content;const data=JSON.parse(refine[0].text);
  assert.equal(data.userInstruction,'Walk to the chair');assert.equal(data.referenceMotion.controlledObject,scene.ledger.world.controlledObject);assert.deepEqual(data.referenceMotion.trajectory,scene.ledger.routes.edge.forward.plan.objects[0].keys);
  assert.ok(data.referenceMotion.projectionCamera);assert.equal(data.motionContext.controlledSubject,context.controlledSubject);
  const expectedImages=direction=>[scene.ledger.world.sourceImage,scene.ledger.routes.edge[direction].motionEvidence.diagram.imageUrl,...scene.ledger.routes.edge[direction].motionEvidence.frames.map(frame=>frame.imageUrl)];
  assert.deepEqual(refine.filter(part=>part.image_url).map(part=>part.image_url.url),expectedImages('forward'));
  assert.deepEqual(calls[0].messages.find(m=>m.role==='user').content.filter(part=>part.image_url).map(part=>part.image_url.url),expectedImages('forward'));
  assert.equal(result.interpretation.startRelation,'beside the door');assert.equal(result.interpretation.endRelation,'beside the chair');
  assert.equal(data.videoPrompt,undefined,'old plot must not re-enter movement refinement');assert.equal(refine[1].image_url.url,scene.ledger.world.sourceImage);
  const cached=await guidance.prepareSpatialGenerationGuidance(scene,{...job,startAnchor:'https://a/NEW-ACTUAL.png',endAnchor:'https://a/ACTUAL-TARGET.png',referenceVideo:'https://a/EXPORTED.mp4',guidance:result});assert.deepEqual(cached,result);assert.equal(calls.length,2);
  scene.ledger.routes.edge.forward.guidance=result;
  const backward={...job,direction:'backward',dependsOn:['edge:forward'],sourceNodeId:'end',prompt:'Follow the return motion reference from its start to its end.',startAnchor:'https://a/ACTUAL-END.png',endAnchor:job.startAnchor,referenceVideo:'https://a/RETURN.mp4'};
  await guidance.prepareSpatialGenerationGuidance(scene,backward);const returned=calls.at(-1).messages.find(m=>m.role==='user').content;assert.deepEqual(returned.filter(p=>p.image_url).map(p=>p.image_url.url),expectedImages('backward'));
  assert.deepEqual(JSON.parse(returned[0].text).referenceMotion.endState,scene.ledger.routes.edge.backward.endState);
  assert.equal(JSON.parse(returned[0].text).userInstruction,'','forward command must not become return instruction');
  const returnText=JSON.parse(returned[0].text).movementText;
  const oldEditor=require('node:child_process').execFileSync('git',['show','c24153e:src/EditStory.tsx'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  for(const prefix of ['AUTHENTIC SPATIAL RETURN:', 'Generate a newly performed physical return', 'Use scene geometry and control mode']){
    const legacyLine=oldEditor.split(/\r?\n/).find(line=>line.trimStart().startsWith('"'+prefix));
    const declaration=JSON.parse(legacyLine.trim().replace(/,$/,''));
    assert.ok(returnText.includes(declaration),'old return declaration was dropped: '+prefix);
  }
  assert.match(returnText,/Creator's forward state\/action to physically undo: Walk to the chair/);
  assert.match(returnText,/Infer its natural inverse/);
  assert.match(returnText,/Full forward instruction as context for the physical return/);
  assert.equal(calls.length,3,'the return must reuse the existing controlled-subject context');
  const payload=videoSpec.spatialVideoInput('SeedanceMini',{...job,guidance:result},'480p','9:16',false);assert.match(payload.prompt,/walks around the desk/);assert.match(payload.prompt,/supplemental evidence/);assert.equal(payload.generate_audio,false);
  assert.ok(payload.prompt.startsWith(result.instruction+' '),'the old movement description was rewritten at provider submission');
  assert.equal(await guidance.prepareSpatialGenerationGuidance(scene,{...job,kind:'action'}),undefined);assert.equal(calls.length,3,'action must not be rewritten as joystick movement');
});

test('the current refiner retains the c24153e image-based prompt and produces identical movement prose',async()=>{
  const file='server/src/SpatialMotionContext.ts';
  const original=require('node:child_process').execFileSync('git',['show',`c24153e:${file}`],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  const response={startRelation:'beside the doorway',route:'around the table',endRelation:'beside the chair',controlledMovement:'The ranger walks from the doorway around the table and stops beside the chair over 5 seconds.',secondaryMotion:'The seated woman remains in place.',spatialPlan:{cameraMode:'fixed',unitStaysInside:true,preservesControlState:true,inventsEnvironment:false,boundaryLimited:false,path:[{x:.4,y:0,z:.3},{x:.6,y:0,z:.4}]}};
  const requests=[],client={chat:{completions:{create:async args=>{requests.push(args);return{choices:[{message:{content:JSON.stringify(response)}}]};}}}};
  const mocks={openai:class{constructor(){return client;}},'./textGeneration':{createRoutedTextClient:()=>client},'./aiUsageLedger':{recordOpenAiUsage(){}}};
  const legacy=load(file,mocks,new Map(),{[file]:original}),current=load(file,mocks);
  const body={llmTier:'luna',sceneId:'test',sceneIntent:'Explore the cabin',videoPrompt:'The ranger in a cabin',movementText:'Walk to the chair',durationSeconds:5,imageDataUrl:'data:image/png;base64,AA==',motionContext:{controlledSubject:'The ranger',controlMode:'character',primaryMotion:'Walk naturally.',ambientMotion:'Hold position.'}};
  const outputs=[];
  for(const handler of [legacy.refineSpatialMovementFromFrame,current.refineSpatialMovementFromFrame]){
    let result,status=200;await handler({body},{status(n){status=n;return this;},send(value){result=value;return this;}});
    assert.equal(status,200,JSON.stringify(result));outputs.push(result);
  }
  assert.equal(requests[1].messages[0].content,requests[0].messages[0].content,'original 2D prompt instructions changed');
  assert.equal(outputs[1].instruction,outputs[0].instruction,'original video-model movement prose changed');
});

test('motion evidence is bound to the exact plan and direction, while stale captures cannot be reused',()=>{
  const {motionEvidencePlanText,motionEvidenceTimes,validateMotionEvidence}=load('server/src/spatialMotionEvidence.ts');
  const scene=fixture(),animation=scene.ledger.routes.edge.forward;
  const planKey=require('node:crypto').createHash('sha256').update(motionEvidencePlanText(animation.plan,'16:9')).digest('hex');
  const evidence={animationId:animation.id,planKey,aspectRatio:'16:9',frames:motionEvidenceTimes(5).map(t=>({t,imageUrl:`https://assets.test/forward-${t}.png`})),diagram:{imageUrl:'https://assets.test/forward-diagram.png'}};
  assert.equal(validateMotionEvidence(evidence,animation.id,planKey,5,'16:9'),evidence);
  for(const [id,key,duration,aspect] of [['return',planKey,5,'16:9'],[animation.id,'changed-plan',5,'16:9'],[animation.id,planKey,10,'16:9'],[animation.id,planKey,5,'9:16']]) assert.throws(()=>validateMotionEvidence(evidence,id,key,duration,aspect),/do not match/);
});

test('draft authoring saves forward and return intelligence before mapping; reopening and actual frame binding reuse it',async()=>{
  const h=routeHarness(),scene=fixture();
  const route=scene.ledger.routes.edge;scene.ledger.draft={plan:scene.ledger.world.plan,samples:[],kind:'movement',prompt:'Walk to the chair',generatedPrompt:'Walk to the chair',hold:false,sourceNodeId:'root',forward:structuredClone(route.forward),backward:structuredClone(route.backward)};
  scene.connections=[];scene.nodes=scene.nodes.slice(0,1);scene.ledger.routes={};delete scene.ledger.states.end;
  assert.equal((await h.call('save',{scene,revision:0})).statusCode,200);
  for(const direction of ['forward','backward']){
    const result=await h.call('prepare-guidance',{draft:true,direction});assert.equal(result.statusCode,200,JSON.stringify(result.body));
    assert.ok(result.body.scene.ledger.draft[direction].guidance);
  }
  const count=h.preparations();assert.equal(count,2);
  for(const direction of ['forward','backward'])await h.call('prepare-guidance',{draft:true,direction});
  assert.equal(h.preparations(),count);assert.equal(h.submits(),0);
  const saved=structuredClone(h.snapshot().scene),draft=saved.ledger.draft;
  saved.nodes.push({id:'end',frameUrl:'https://assets.test/end.png'});saved.connections.push(fixture().connections[0]);
  saved.ledger.routes.edge={connectionId:'edge',worldRevision:saved.ledger.world.revision,forward:draft.forward,backward:draft.backward};saved.ledger.states.end=draft.forward.endState;delete saved.ledger.draft;
  await h.call('save',{scene:saved,revision:h.snapshot().revision});const fields=await h.call('quote',{options:{model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false}});
  assert.equal(h.preparations(),count,'saving the motion discarded draft guidance');
  await h.call('start',{options:{model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false},quoteKey:fields.body.quote.key});await h.call('tick',{jobId:'edge:forward'});
  assert.equal(h.preparations(),count);assert.equal(h.submits(),1);
});

test('author-time intelligence carries man, vehicle and mounted-elephant control context and completed action state in BOTH directions',async()=>{
  for(const [subject,mode,action,condition] of [['The man','character','Pick up the cup','holdingCup'],['The car with its driver','vehicle','Enter the car','driverSeated'],['The rider and elephant together','mounted','Mount the elephant','mounted']]){
    const scene=fixture(),compiled=[],refined=[];scene.ledger.world.drivenName=subject;scene.ledger.world.controlMode=mode;scene.ledger.world.sceneContext={sceneIntent:`Control ${subject}`,imagePrompt:'An outdoor courtyard',videoPrompt:action};
    const animation=scene.ledger.routes.edge.forward;scene.ledger.routes.edge.backward=structuredClone(animation);
    for(const direction of ['forward','backward']){scene.ledger.routes.edge[direction].sourceState.conditions={[condition]:true};scene.ledger.routes.edge[direction].endState.conditions={[condition]:true};}
    scene.connections=[{id:'action',sourceNodeId:'root',targetNodeId:'after-action',kind:'action',actionPrompt:action},{...scene.connections[0],sourceNodeId:'after-action'}];
    const helper=load('server/src/spatialGenerationGuidance.ts',{'./SpatialMotionContext':{
      compileSpatialMotionContexts:async(req,res)=>{compiled.push(req.body);return res.send({contexts:[{controlledSubject:subject,controlMode:mode,primaryMotion:'Use the established locomotion profile.',ambientMotion:'Other subjects maintain their established motion.'}]});},
      refineSpatialMovementFromFrame:async(req,res)=>{refined.push(req.body);return res.send({instruction:`${subject} follows the authored ${req.body.referenceMotion.direction} route while retaining ${condition}.`});},
    }});
    for(const direction of ['forward','backward']){
      const job={id:`edge:${direction}`,connectionId:'edge',kind:'movement',direction,sourceNodeId:direction==='forward'?'after-action':'end',dependsOn:[],duration:5,promptVersion:2,prompt:direction==='forward'?'Follow the motion reference from its start to its end.':'Follow the return motion reference from its start to its end.'};
      const prepared=await helper.prepareSpatialGenerationGuidance(scene,job);assert.equal(prepared.motionContext.controlMode,mode);assert.equal(prepared.motionContext.controlledSubject,subject);
      assert.equal(compiled.at(-1).scenes[0].stateMode,'planned-action');assert.equal(compiled.at(-1).scenes[0].completedAction,action);assert.equal(compiled.at(-1).scenes[0].plannedState.conditions[condition],true);
      assert.equal(refined.at(-1).referenceMotion.sourceState.conditions[condition],true);assert.equal(refined.at(-1).referenceMotion.endState.conditions[condition],true);
      assert.equal(refined.at(-1).referenceMotion.direction,direction);assert.equal(refined.at(-1).imageUrl,scene.ledger.world.sourceImage);
    }
    assert.equal(compiled.length,2);assert.equal(refined.length,2);
  }
});

test('intelligence is saved before confirmation; dispatch and real-frame binding make ZERO preparation calls', async()=>{
  const h=routeHarness(),scene=fixture();
  const {motionEvidencePlanText,motionEvidenceTimes}=load('server/src/spatialMotionEvidence.ts');
  for(const direction of ['forward','backward']) {
    const animation=scene.ledger.routes.edge[direction];
    animation.motionEvidence={animationId:animation.id,aspectRatio:'16:9',planKey:require('node:crypto').createHash('sha256').update(motionEvidencePlanText(animation.plan,'16:9')).digest('hex'),frames:motionEvidenceTimes(5).map(t=>({t,imageUrl:`https://assets.test/${direction}-${t}.png`})),diagram:{imageUrl:`https://assets.test/${direction}-diagram.png`}};
  }
  await h.call('save',{scene,revision:0});const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};
  const authoredQuote=await h.call('quote',{options});await h.call('start',{options,quoteKey:authoredQuote.body.quote.key});const count=h.preparations();assert.equal(count,2);
  assert.ok(h.snapshot().scene.ledger.routes.edge.forward.guidance);assert.ok(h.snapshot().scene.ledger.routes.edge.backward.guidance);
  await h.call('tick',{jobId:'edge:forward'});assert.equal(h.preparations(),count);assert.equal(h.submits(),1);assert.match(h.submittedInputs()[0].job.guidance.instruction,/beside the chair/);
  assert.deepEqual(h.submittedInputs()[0].job.motionEvidence,scene.ledger.routes.edge.forward.motionEvidence);
  await h.call('tick',{jobId:'edge:forward'});await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/generated.mp4',endFrame:'https://a/ACTUAL-END.png'});
  await h.call('tick',{jobId:'edge:backward'});assert.equal(h.preparations(),count);assert.equal(h.submits(),2);assert.equal(h.submittedInputs()[1].job.startAnchor,'https://a/ACTUAL-END.png');
  assert.deepEqual(h.submittedInputs()[1].job.motionEvidence,scene.ledger.routes.edge.backward.motionEvidence);
  const failed=routeHarness();await failed.call('save',{scene:fixture(),revision:0});failed.failPreparation('Invalid grounded route');assert.equal((await failed.call('prepare-guidance')).statusCode,409);assert.equal(failed.submits(),0);
  const quote=await failed.call('quote',{options:{model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false},skipPrepare:true});
  assert.equal((await failed.call('start',{options:{model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false},quoteKey:quote.body.quote.key})).statusCode,409);assert.equal(failed.submits(),0);
});

test('stale author-time preparation never overwrites edits or a deleted generation; paid requests stay unchanged', async()=>{
  const h=routeHarness();await h.call('start',await h.start());
  delete h.snapshot().scene.ledger.jobs[0].guidance;delete h.snapshot().scene.ledger.routes.edge.forward.guidance;
  const release=h.deferPreparation(),pending=h.call('prepare-guidance',{jobId:'edge:forward'});await new Promise(r=>setImmediate(r));
  await h.call('edit-prompt',{jobId:'edge:forward',prompt:'Newer edit'});release();await pending;
  assert.equal(h.snapshot().scene.ledger.jobs[0].prompt,'Newer edit');assert.equal(h.snapshot().scene.ledger.jobs[0].guidance,undefined);assert.equal(h.submits(),0);
  const deleted=routeHarness();await deleted.call('start',await deleted.start());
  delete deleted.snapshot().scene.ledger.jobs[0].guidance;delete deleted.snapshot().scene.ledger.routes.edge.forward.guidance;
  const finish=deleted.deferPreparation(),later=deleted.call('prepare-guidance',{jobId:'edge:forward'});await new Promise(r=>setImmediate(r));await deleted.call('delete',{confirmation:'DELETE'});finish();await later;assert.equal(deleted.snapshot().scene.ledger.jobs.length,0);assert.equal(deleted.submits(),0);
});

test('approved motion instructions survive later scene-text changes without another interpretation call',async()=>{
  const h=routeHarness();await h.call('start',await h.start());const count=h.preparations();
  const before=structuredClone(h.snapshot().scene.ledger.routes.edge);
  assert.equal((await h.call('prepare-guidance',{jobId:'edge:forward',sceneContext:{videoPrompt:'A changed narrative'}})).statusCode,200);
  assert.equal((await h.call('prepare-guidance',{jobId:'edge:backward',sceneContext:{videoPrompt:'Another changed narrative'}})).statusCode,200);
  assert.equal(h.preparations(),count,'approved prompts were interpreted again');
  assert.deepEqual(h.snapshot().scene.ledger.routes.edge,before,'the approved route or its prose changed');
});

test('explicit forward, return and action edits override stale generated prose at the editor and provider boundary',async()=>{
  const prompts=load('server/src/spatialClipPrompt.ts');
  const scene=fixture();
  for(const [direction,kind,instruction] of [
    ['forward','movement','The ranger walks from the entrance to the chair.'],
    ['backward','movement','The ranger turns at the chair and walks back to the entrance.'],
    ['forward','action','The ranger turns the chair and sits down.'],
  ]){
    const job={...scene.ledger.routes.edge[direction],direction,kind,promptVersion:2,prompt:instruction,guidance:{instruction:'Wrong saved movement.'}};
    assert.equal(prompts.effectiveSpatialClipPrompt(job),instruction);
    for(const model of Object.keys(videoSpec.spatialVideoModels)){
      const input=videoSpec.spatialVideoInput(model,job,'480p','16:9',false);
      assert.ok(input.prompt.startsWith(instruction+' '),model+' submitted stale prose');
      assert.ok(!input.prompt.includes('Wrong saved movement.'));
    }
  }
});

test('saving an edited prompt retains it through compatibility preparation and submission without AI or reference changes',async()=>{
  const h=routeHarness();await h.call('start',await h.start());const count=h.preparations();
  const before=structuredClone(h.snapshot().scene.ledger.routes.edge);
  const instruction='The ranger walks from the entrance and stops left of the captain’s chair.';
  assert.equal((await h.call('edit-prompt',{jobId:'edge:forward',prompt:instruction})).statusCode,200);
  assert.equal(h.preparations(),count);assert.equal(h.submits(),0);
  assert.equal(h.snapshot().scene.ledger.jobs[0].guidance.instruction,instruction);
  assert.equal((await h.call('prepare-guidance',{jobId:'edge:forward',sceneContext:{videoPrompt:'Changed after approval'}})).statusCode,200);
  assert.equal(h.preparations(),count,'the edit was sent to AI again');
  await h.call('tick',{jobId:'edge:forward'});
  const submitted=h.submittedInputs()[0].job;
  assert.equal(submitted.guidance.instruction,instruction);
  assert.ok(videoSpec.spatialVideoInput('SeedanceMini',submitted,'480p','16:9',false).prompt.startsWith(instruction+' '));
  const current=h.snapshot().scene.ledger.routes.edge;
  assert.deepEqual(current.forward.plan,before.forward.plan);
  assert.deepEqual(current.forward.motionEvidence,before.forward.motionEvidence);
  assert.equal(current.forward.referenceVideo,before.forward.referenceVideo);
  assert.deepEqual(current.backward,before.backward);
});

test('author-time compatibility preparation never changes already-running paid inputs',async()=>{
  const h=routeHarness();await h.call('start',await h.start());h.snapshot().scene.ledger.jobs[0].status='generating';h.snapshot().scene.ledger.jobs[0].providerJobId='already-paid';
  const before=structuredClone(h.snapshot().scene.ledger.jobs[0]),count=h.preparations();await h.call('prepare-guidance',{jobId:'edge:forward',sceneContext:{videoPrompt:'Different'}});
  assert.deepEqual(h.snapshot().scene.ledger.jobs[0],before);assert.equal(h.preparations(),count);
  await h.call('tick',{jobId:'edge:forward'});assert.equal(h.preparations(),count);assert.equal(h.submits(),0);assert.equal(h.polls(),1);
});

test('mapping lock/loader covers upload preparation, queue, provider, saving and upscale states only',()=>{
  for(const status of ['queued','preparing','submitting','generating','checking'])assert.equal(worldModel.spatialJobIsActive({status}),true,status);
  for(const status of ['waiting-on-parent','blocked','failed','ready','cancelled'])assert.equal(worldModel.spatialJobIsActive({status}),false,status);
  assert.equal(worldModel.spatialJobIsActive({status:'ready',upscale:{status:'generating'}}),true);
});

test('generation does not lock new mapping; saved videos, requests and settings survive append and reopen', async () => {
  const h=routeHarness();await h.call('start',await h.start());
  await h.call('tick',{jobId:'edge:forward'});await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/retained.mp4',endFrame:'https://a/end.png'});
  const before=structuredClone(h.snapshot()),next=structuredClone(before.scene);
  next.nodes.push({id:'appended',frameUrl:'https://a/new-proxy.png'});next.ledger.states.appended=structuredClone(next.ledger.states.end);
  next.connections.push({...structuredClone(next.connections[0]),id:'append',sourceNodeId:'end',targetNodeId:'appended',forward:null,backward:null,status:'draft'});
  next.ledger.routes.append={...structuredClone(next.ledger.routes.edge),connectionId:'append'};
  const changed=await h.call('save',{scene:next,revision:before.revision});assert.equal(changed.statusCode,200,changed.body.message);
  assert.deepEqual(changed.body.scene.ledger.jobs,before.scene.ledger.jobs);assert.deepEqual(changed.body.options,before.options);
  assert.equal(changed.body.scene.ledger.epoch,before.scene.ledger.epoch);assert.equal(changed.body.scene.connections[0].forward.videoUrl,'https://a/retained.mp4');
  const opened=await h.call('view',{boardOpen:true});const closed=await h.call('view',{boardOpen:false,view:'three'});
  assert.equal(opened.statusCode,200);assert.equal(closed.statusCode,200);assert.equal(h.submits(),1,'opening/closing must not submit');
  const reloaded=(await h.call('read')).body;assert.equal(reloaded.scene.connections.length,2);assert.deepEqual(reloaded.scene.ledger.jobs,before.scene.ledger.jobs);
  const quote=await h.call('quote',{options:before.options});assert.equal(quote.body.quote.jobs.length,2,'only appended clips are new');
  assert.equal((await h.call('save',{scene:next,revision:before.revision})).statusCode,409,'stale append accepted');
  for(const mutate of [s=>s.ledger.world.sourceImage='https://a/changed.png',s=>s.nodes[0].frameUrl='https://a/changed.png',s=>s.ledger.routes.edge.forward.prompt='overwrite',s=>s.ledger.jobs[0].pixels=1,s=>s.connections[1].forward={videoUrl:'https://a/forged.mp4'}]){
    const bad=structuredClone(h.snapshot().scene);mutate(bad);
    assert.equal((await h.call('save',{scene:bad,revision:h.snapshot().revision})).statusCode,409,'protected generation data edited');
  }
});

test('failed retry uses explicitly selected model/resolution and refreshed price, without resubmitting other jobs', async()=>{
  const h=routeHarness();await h.call('start',await h.start());
  h.snapshot().scene.ledger.jobs[0].status='failed';h.snapshot().scene.ledger.jobs[0].error='E005';h.snapshot().scene.ledger.jobs[1].status='blocked';
  const other=structuredClone(h.snapshot().scene.ledger.jobs[1]),options={model:'Pro',resolution:'720p',aspect:'16:9',audio:true},id='edge:forward';
  assert.equal((await h.call('retry',{jobId:id,confirmation:id,pixels:83,options})).statusCode,409,'stale price accepted');
  assert.equal((await h.call('retry',{jobId:id,confirmation:id,pixels:366,options})).statusCode,200);
  assert.equal(h.submits(),0);assert.equal(h.snapshot().scene.ledger.jobs[0].model,'Pro');assert.equal(h.snapshot().scene.ledger.jobs[0].pixels,366);
  assert.equal(h.snapshot().scene.ledger.jobs[1].model,other.model);assert.equal(h.snapshot().scene.ledger.jobs[1].pixels,other.pixels);
  assert.equal((await h.call('retry',{jobId:id,confirmation:id,pixels:366,options})).statusCode,409,'retry duplicated');
  await h.call('tick',{jobId:id});assert.equal(h.submits(),1);assert.equal(h.submittedInputs()[0].model,'Pro');assert.equal(h.submittedInputs()[0].resolution,'720p');
  assert.equal(load('server/src/mediaPricing.ts').mediaChargeFor('/spatial-video',h.submittedInputs()[0]).pixels,366);
  assert.equal(h.snapshot().scene.ledger.jobs[1].status,'waiting-on-parent');
});

test('confirmed per-job sound choices survive later global toggles and accepted requests', async()=>{
  const h=routeHarness();await h.call('save',{scene:fixture(),revision:0});
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:true,music:false};
  const quote=await h.call('quote',{options});await h.call('start',{options,quoteKey:quote.body.quote.key});
  await h.call('tick',{jobId:'edge:forward',audio:false});
  const forward=structuredClone(h.snapshot().scene.ledger.jobs[0]);
  await h.call('tick',{jobId:'edge:forward',audio:false});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/forward.mp4',endFrame:'https://a/end.png'});
  assert.equal((await h.call('tick',{jobId:'edge:backward',audio:false})).statusCode,200);
  for(const request of h.submittedInputs()){
    assert.equal(request.audio,true);assert.equal(request.music,false);assert.deepEqual(request.job.options,options);
    const payload=videoSpec.spatialVideoInput(request.model,request.job,request.resolution,request.aspect,request.audio,request.music);
    assert.equal(payload.generate_audio,true);assert.match(payload.prompt,/Music: none/);
  }
  assert.deepEqual(h.snapshot().scene.ledger.jobs[0].options,forward.options);
  assert.equal(h.submits(),2);
});

test('background dispatch sends no global audio override after a remount', async()=>{
  const queued=fixture();queued.ledger.generationStarted=true;queued.ledger.jobs=[{id:'edge:backward',status:'queued',options:{audio:true,music:false}}];
  const ticks=[];const client=load('src/spatialWorldClient.ts',{axios:{__esModule:true,default:{post:async(_url,body)=>{
    if(body.action==='tick'){ticks.push(body);queued.ledger.jobs[0].status='generating';}
    return {data:structuredClone({scene:queued,revision:ticks.length+1})};
  }}}});
  const session=client.spatialSession('/audio-test',1,'scene-a');session.generationAudio=true;
  await client.spatialOperation(session,'read');session.generationAudio=false;
  assert.equal(client.spatialSession('/audio-test',1,'scene-a'),session);
  const deadline=Date.now()+5000;
  while(!ticks.length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
  clearTimeout(session.timer);assert.equal(ticks.length,1);assert.equal(Object.hasOwn(ticks[0],'audio'),false);
});

test('legacy delayed return calls and spatial payload resolution read the live audio setting rather than a captured value',()=>{
  const source=ts.createSourceFile('EditStory.tsx',fs.readFileSync(path.resolve(__dirname,'../src/EditStory.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let callback,actualAudio;
  const visit=node=>{if(ts.isVariableDeclaration(node)){
    if(node.name.getText(source)==='runSpatialReturn')callback=node.initializer.arguments[0];
    if(node.name.getText(source)==='actualAudio')actualAudio=node.initializer;
  }ts.forEachChild(node,visit);};visit(source);
  let call;const find=node=>{if(ts.isCallExpression(node)&&node.expression.getText(source)==='GenerateVideox')call=node;ts.forEachChild(node,find);};find(callback);
  assert.ok(call);assert.ok(actualAudio);
  const live={current:true},captured=true;
  const delayed=new Function('generatedVideoAudioRef','musicKling',`return ()=>(${call.arguments[2].getText(source)});`)(live,captured);
  live.current=false;assert.equal(delayed(),false);live.current=true;assert.equal(delayed(),true);
  const compiled=ts.transpileModule(`const read=()=>(${actualAudio.getText(source)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const read=new Function('generatedVideoAudioRef','musicKling','spatialRequest','useModalGpu','overrideAudio','hasVideoModelCapability','videModel',compiled+'return read;')(live,captured,{direction:'backward'},false,true,()=>true,'SeedanceMini');
  live.current=false;assert.equal(read(),false,'a native-audio capability or stale override turned spatial audio on');
});

test('generated spots can add, replace and clear navigation without altering saved clips or creating requests', async()=>{
  const h=routeHarness();await h.call('start',await h.start());
  await h.call('tick',{jobId:'edge:forward'});await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/paid.mp4',endFrame:'https://a/actual.png'});
  const before=structuredClone(h.snapshot());
  const update=async navigation=>{
    const scene=structuredClone((await h.call('read')).body.scene),node=scene.nodes.find(n=>n.id==='end');
    delete node.actionLink;delete node.actionBacktrack;Object.assign(node,navigation);
    return h.call('save',{scene,revision:h.snapshot().revision});
  };
  assert.equal((await update({actionBacktrack:{targetNodeId:'root'}})).statusCode,200);
  assert.equal((await update({actionLink:{sceneId:'second',bShotIndex:0,bShotIdentity:'second:b:saved'}})).statusCode,200);
  assert.equal((await update({})).statusCode,200);
  const reloaded=(await h.call('read')).body;
  assert.deepEqual(reloaded.scene.ledger,before.scene.ledger);assert.deepEqual(reloaded.scene.connections,before.scene.connections);
  assert.deepEqual(reloaded.options,before.options);assert.equal(h.submits(),1);
  for(const nav of [{actionBacktrack:{targetNodeId:'missing'}},{actionBacktrack:{targetNodeId:'end'}},{actionLink:{sceneId:''}},{actionLink:{sceneId:'second'},actionBacktrack:{targetNodeId:'root'}}]){
    assert.equal((await update(nav)).statusCode,409,'invalid navigation accepted');
  }
  const scene=fixture();scene.connections[0].kind='action';delete scene.ledger.routes.edge.backward;
  scene.nodes[0].actionLink={sceneId:'second'};
  const fresh=routeHarness(),overlap=await fresh.call('save',{scene,revision:0});assert.equal(overlap.statusCode,409,'link overlaps the authored action');
  assert.match(overlap.body.message,/only one action/);
  assert.equal(load('server/src/mediaPricing.ts').mediaChargeFor('/spatial-video',h.submittedInputs()[0]).pixels,83,'five-second billing mismatch');
});

test('restoring a previous video also restores its model, price and options after a different-model replacement', async()=>{
  const h=routeHarness();await h.call('start',await h.start());await h.call('tick',{jobId:'edge:forward'});await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/original.mp4',endFrame:'https://a/end.png'});
  const options={model:'Pro',resolution:'720p',aspect:'16:9',audio:false};
  assert.equal((await h.call('regenerate',{jobId:'edge:forward',confirmation:'edge:forward',pixels:366,options})).statusCode,200);
  const replacing=h.snapshot().scene.ledger.jobs[0];assert.equal(replacing.model,'Pro');assert.equal(replacing.previousResult.model,'SeedanceMini');replacing.status='failed';
  assert.equal((await h.call('restore-result',{jobId:replacing.id})).statusCode,200);
  const restored=h.snapshot().scene.ledger.jobs[0];assert.equal(restored.model,'SeedanceMini');assert.equal(restored.pixels,83);assert.equal(restored.options.resolution,'480p');assert.equal(restored.output,'https://a/original.mp4');
});

test('image view resolves real appearance instead of mapping proxies across failed, saved and replacement jobs',()=>{
  const {spatialAppearanceFrame}=load('src/spatialPlayerModel.ts'),scene=fixture(),source=scene.ledger.world.sourceImage;
  assert.equal(spatialAppearanceFrame(scene,'end'),source);
  scene.ledger.jobs=[{id:'edge:forward',connectionId:'edge',direction:'forward',status:'failed'}];assert.equal(spatialAppearanceFrame(scene,'end'),source);
  scene.ledger.jobs[0].status='ready';scene.ledger.jobs[0].actualEndFrame='https://a/real-end.png';assert.equal(spatialAppearanceFrame(scene,'end'),'https://a/real-end.png');
  scene.nodes.push({id:'later',frameUrl:'https://a/proxy-later.png'});scene.connections.push({id:'later-edge',sourceNodeId:'end',targetNodeId:'later'});scene.ledger.routes['later-edge']={connectionId:'later-edge',forward:scene.ledger.routes.edge.forward};
  assert.equal(spatialAppearanceFrame(scene,'later'),'https://a/real-end.png');
  scene.ledger.jobs[0].previousResult={actualEndFrame:'https://a/previous.png'};scene.ledger.jobs[0].status='generating';assert.equal(spatialAppearanceFrame(scene,'later'),'https://a/previous.png');
  scene.ledger.actionImageEdits={later:{status:'applied',output:'https://a/edited.png'}};assert.equal(spatialAppearanceFrame(scene,'later'),'https://a/edited.png');
  const unchanged=JSON.stringify(scene);spatialAppearanceFrame(scene,'later');assert.equal(JSON.stringify(scene),unchanged);
});

test('18 motions: individual generation then Generate all is append-only and concurrent requests cannot duplicate jobs', async () => {
  const h=routeHarness(), scene=fixture(), template=structuredClone(scene.connections[0]), route=structuredClone(scene.ledger.routes.edge);
  for(let index=2;index<=18;index++) {
    const id=`edge${index}`, target=`node${index}`;
    scene.nodes.push({id:target,frameUrl:'https://assets.test/end.png'});
    scene.connections.push({...structuredClone(template),id,sourceNodeId:index===2?'end':`node${index-1}`,targetNodeId:target});
    scene.ledger.routes[id]={...structuredClone(route),connectionId:id};scene.ledger.states[target]=scene.ledger.world.initialState;
  }
  assert.equal((await h.call('save',{scene,revision:0})).statusCode,200);
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};
  const first=await h.call('quote',{options,routeId:'edge'});
  assert.equal(first.body.quote.jobs.length,2);
  const starts=await Promise.all([1,2].map(()=>h.call('start',{options,routeId:'edge',quoteKey:first.body.quote.key})));
  assert.deepEqual(starts.map(result=>result.statusCode).sort(),[200,409]);
  const finish=async id=>{
    await h.call('tick',{jobId:id});await h.call('tick',{jobId:id});
    const current=h.snapshot().scene.ledger.jobs.find(job=>job.id===id);
    assert.equal((await h.call('complete',{epoch:1,jobId:id,attempt:current.attempt,sourceOutput:current.output,videoUrl:`https://assets.test/${id}.mp4`,endFrame:'https://assets.test/end.png',automatic:true})).statusCode,200);
  };
  await finish('edge:forward');await finish('edge:backward');
  const preserved=structuredClone(h.snapshot().scene.ledger.jobs);
  const second=await h.call('quote',{options,routeId:'edge2'});
  assert.equal((await h.call('start',{options,routeId:'edge2',quoteKey:second.body.quote.key})).statusCode,200);
  await finish('edge2:forward');await finish('edge2:backward');
  const all=await h.call('quote',{options});assert.equal(all.body.quote.jobs.length,32);assert.equal(all.body.quote.pixels,32*83);
  assert.equal((await h.call('start',{options,quoteKey:all.body.quote.key})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.epoch,1,'append invalidated in-flight completions');
  assert.equal(h.snapshot().scene.ledger.jobs.length,36);
  assert.deepEqual(h.snapshot().scene.ledger.jobs.slice(0,2),preserved,'Generate all replaced paid results');
  assert.equal((await h.call('quote',{options})).body.quote.pixels,0);
  const reopen=await h.call('read');assert.equal(reopen.body.scene.ledger.jobs.length,36);
  assert.equal(reopen.body.scene.connections[0].forward.videoUrl,'https://assets.test/edge:forward.mp4');
});

test('document subscribers receive background results only for their own post and reject stale snapshots', async () => {
  let response;
  const client=load('src/spatialWorldClient.ts',{axios:{__esModule:true,default:{post:async()=>({data:response})}}});
  const seen=[],other=[];
  const unsubscribe=client.subscribeSpatialDocuments('/fixture',11,doc=>seen.push(doc.revision));
  client.subscribeSpatialDocuments('/fixture',12,doc=>other.push(doc.revision));
  const session=client.spatialSession('/fixture',11,'scene-a');
  response={scene:fixture(),revision:3};await client.spatialOperation(session,'read');
  response={scene:fixture(),revision:2};await client.spatialOperation(session,'read');
  assert.deepEqual(seen,[3]);assert.deepEqual(other,[]);
  unsubscribe();response={scene:fixture(),revision:4};await client.spatialOperation(session,'read');assert.deepEqual(seen,[3]);
  const remounted=[];client.subscribeSpatialDocuments('/fixture',11,doc=>remounted.push(doc.revision));assert.deepEqual(remounted,[4]);
});

test('manual child generation is blocked until its saved parent exists; Generate all queues safely', async () => {
  const h=routeHarness(),scene=fixture();
  scene.nodes.push({id:'last',frameUrl:'https://a/last.png'});
  scene.connections.push({...structuredClone(scene.connections[0]),id:'later',sourceNodeId:'end',targetNodeId:'last'});
  scene.ledger.routes.later={...structuredClone(scene.ledger.routes.edge),connectionId:'later'};
  await h.call('save',{scene,revision:0});
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};
  const quote=await h.call('quote',{options,routeId:'later'});
  assert.equal(quote.statusCode,409); assert.match(quote.body.message,/previous video/);
  assert.equal((await h.call('start',{options,routeId:'later',quoteKey:'invalid'})).statusCode,409);
  assert.equal(h.snapshot().scene.ledger.jobs.length,0);
  const rest=await h.call('quote',{options});assert.equal(rest.body.quote.jobs.length,4);
  assert.equal((await h.call('start',{options,quoteKey:rest.body.quote.key})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs.find(job=>job.id==='later:forward').status,'waiting-on-parent');
  await h.call('tick',{jobId:'later:forward'});assert.equal(h.submits(),0);
  assert.equal(h.snapshot().scene.ledger.jobs.length,4);
});

test('movement → action → next movement submits only after each actual last frame is saved', async () => {
  const h=routeHarness(),scene=fixture();
  const template=structuredClone(scene.connections[0]),route=structuredClone(scene.ledger.routes.edge);
  scene.nodes.push({id:'acted',frameUrl:'https://assets.test/acted.png'},{id:'next',frameUrl:'https://assets.test/next.png'});
  scene.connections.push({...template,id:'drink',kind:'action',sourceNodeId:'end',targetNodeId:'acted'},{...template,id:'next-edge',sourceNodeId:'acted',targetNodeId:'next'});
  scene.ledger.routes.drink={connectionId:'drink',worldRevision:route.worldRevision,forward:{...structuredClone(route.forward),referenceVideo:'https://assets.test/pickup-three.mp4'}};
  scene.ledger.routes['next-edge']={...structuredClone(route),connectionId:'next-edge'};
  await h.call('save',{scene,revision:0});
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};
  const quote=await h.call('quote',{options});await h.call('start',{options,quoteKey:quote.body.quote.key});
  await h.call('tick',{jobId:'drink:forward'});await h.call('tick',{jobId:'next-edge:forward'});assert.equal(h.submits(),0);
  await h.call('tick',{jobId:'edge:forward'});await h.call('tick',{jobId:'edge:forward'});
  await h.call('tick',{jobId:'drink:forward'});assert.equal(h.submits(),1,'provider output without saved last frame advanced action');
  const complete=async(id,endFrame)=>{
    const job=h.snapshot().scene.ledger.jobs.find(job=>job.id===id);
    assert.equal((await h.call('complete',{jobId:id,epoch:1,attempt:job.attempt,sourceOutput:job.output,videoUrl:`https://assets.test/${id}.mp4`,endFrame,automatic:true})).statusCode,200);
  };
  const parentEnd='https://assets.test/saved-at-cup.png';await complete('edge:forward',parentEnd);
  await h.call('tick',{jobId:'drink:forward'});
  const action=h.submittedInputs().at(-1).job;
  assert.equal(action.startAnchor,parentEnd);assert.equal(action.referenceVideo,'https://assets.test/pickup-three.mp4');
  const payload=videoSpec.spatialVideoInput('SeedanceMini',action,'480p','16:9',false);
  assert.ok(payload.reference_images.includes(parentEnd));assert.ok(!payload.reference_images.includes(route.forward.endAnchor),'Three.js still used for action appearance');
  await h.call('tick',{jobId:'next-edge:forward'});assert.equal(h.submits(),2);
  await h.call('tick',{jobId:'drink:forward'});const actionEnd='https://assets.test/saved-after-drink.png';await complete('drink:forward',actionEnd);
  await h.call('tick',{jobId:'next-edge:forward'});assert.equal(h.submittedInputs().at(-1).job.startAnchor,actionEnd);
  const preserved=h.snapshot().scene.ledger.jobs.find(job=>job.id==='edge:forward');assert.equal(preserved.status,'ready');assert.equal(preserved.actualEndFrame,parentEnd);
});

test('spatial errors hide transport jargon but retain genuine blocking failures', () => {
  const client=load('src/spatialWorldClient.ts',{axios:{__esModule:true,default:{}}});
  for(const error of [new Error('read ECONNRESET'),'socket hang up','timeout of 30000ms exceeded']) assert.equal(client.spatialErrorMessage(error),'Connection interrupted. Please try again.');
  assert.equal(client.spatialErrorMessage(''),'');
  assert.equal(client.spatialErrorMessage(new Error('The action is missing a motion track.')),'The action is missing a motion track.');
});

test('spatial video model filtering keeps the existing editor buttons and their selection handlers', () => {
  const source=fs.readFileSync(path.resolve(__dirname,'../src/EditStory.tsx'),'utf8');
  assert.doesNotMatch(source,/SpatialVideoModelOptions/);
  assert.match(source,/& > :not\(\[data-spatial-video-model\]\)/);
  const models=[...source.matchAll(/data-spatial-video-model="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(models.sort(),Object.keys(videoSpec.spatialVideoModels).sort());
  for(const model of models){
    const button=source.slice(source.indexOf(`data-spatial-video-model="${model}"`)).split('</Button>')[0];
    assert.ok(button.includes('...commonButtonSx'));assert.ok(button.includes(`setvideModel?.("${model}")`));assert.ok(button.includes(`setbutton?.("${model}")`));
  }
});

test('unstarted prompts and references can be saved after generation starts without changing existing jobs', async () => {
  const h=routeHarness(),scene=fixture();
  scene.nodes.push({id:'last',frameUrl:'https://a/last.png'});
  scene.connections.push({...structuredClone(scene.connections[0]),id:'later',sourceNodeId:'end',targetNodeId:'last'});
  scene.ledger.routes.later={...structuredClone(scene.ledger.routes.edge),connectionId:'later'};
  scene.ledger.routes.later.forward=structuredClone(scene.ledger.routes.later.forward);
  delete scene.ledger.routes.later.forward.referenceVideo;
  await h.call('save',{scene,revision:0});
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};
  const quote=await h.call('quote',{options,routeId:'edge'});
  assert.equal((await h.call('start',{options,routeId:'edge',quoteKey:quote.body.quote.key})).statusCode,200);
  const before=structuredClone(h.snapshot().scene.ledger.jobs);
  assert.equal((await h.call('edit-prompt',{routeId:'later',direction:'forward',prompt:'Stop beside the cup.'})).statusCode,200);
  const reference={routeId:'later',direction:'forward',animationId:'animation',worldRevision:'world-1',referenceVideo:'https://a/new-reference.mp4',startAnchor:'https://a/start.png',endAnchor:'https://a/end.png'};
  assert.equal((await h.call('save-reference',reference)).statusCode,200);
  assert.deepEqual(h.snapshot().scene.ledger.jobs,before);
  assert.equal(h.snapshot().scene.ledger.routes.later.forward.prompt,'Stop beside the cup.');
  assert.equal((await h.call('save-reference',{...reference,routeId:'edge'})).statusCode,409);
  assert.equal((await h.call('save-reference',{...reference,animationId:'stale'})).statusCode,409);
  const next=await h.call('quote',{options});
  assert.equal(next.body.quote.jobs[0].prompt,'Stop beside the cup.');
  assert.equal(next.body.quote.jobs[0].referenceVideo,'https://a/new-reference.mp4');
});

test('reopened unvisited scene automatically saves its completed result without mounting SpatialStudio', async () => {
  const scene=fixture();scene.ledger.generationStarted=true;scene.ledger.epoch=1;
  scene.ledger.jobs=[{id:'edge:forward',status:'checking',output:'https://a/provider.mp4',attempt:1}];
  let revision=1,uploads=0,completions=0;
  const client=load('src/spatialWorldClient.ts',{
    axios:{__esModule:true,default:{post:async(_url,body)=>{
      if(body.action==='complete'){completions++;assert.equal(body.sourceOutput,'https://a/provider.mp4');scene.ledger.jobs[0].status='ready';revision++;}
      return {data:structuredClone({scene,revision})};
    }}},
    './spatialResultAssets':{persistSpatialResultAssets:async()=>{uploads++;return {endFrame:'https://a/frame.jpg',videoUrl:'https://a/saved.mp4'};}}
  });
  const session=client.spatialSession('/reload-test',17,'scene-a');
  await client.spatialOperation(session,'read');
  const deadline=Date.now()+6000;
  while(session.value.scene.ledger.jobs[0].status!=='ready' && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  clearTimeout(session.timer);
  assert.equal(session.value.scene.ledger.jobs[0].status,'ready');assert.equal(uploads,1);assert.equal(completions,1);
});

test('automatic save rejects a stale attempt and replacement save retains the previous result', async () => {
  const h=routeHarness();await h.call('start',await h.start());
  await h.call('tick',{jobId:'edge:forward'});await h.call('tick',{jobId:'edge:forward'});
  const job=h.snapshot().scene.ledger.jobs[0];
  const fields={epoch:1,jobId:job.id,attempt:job.attempt,sourceOutput:job.output,automatic:true,videoUrl:'https://a/saved.mp4',endFrame:'https://a/saved.png'};
  assert.equal((await h.call('complete',{...fields,attempt:0})).statusCode,409);
  assert.equal((await h.call('complete',fields)).statusCode,200);
  assert.equal((await h.call('regenerate',{jobId:job.id,confirmation:job.id,pixels:job.pixels})).statusCode,200);
  await h.call('tick',{jobId:job.id});await h.call('tick',{jobId:job.id});
  const replacement=h.snapshot().scene.ledger.jobs[0];
  assert.equal((await h.call('complete',{...fields,attempt:replacement.attempt,sourceOutput:replacement.output,videoUrl:'https://a/replacement.mp4'})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].previousResult.output,'https://a/saved.mp4');
});

test('arrival in the same tab does not invalidate a saved motion or a generation quote', async () => {
  const h=routeHarness(), settings=await h.start(), revision=h.snapshot().revision;
  await h.call('view',{activeNodeId:'end',view:'three'});
  assert.equal(h.snapshot().revision,revision);
  assert.equal(h.snapshot().viewRevision,1);
  assert.equal((await h.call('save',{scene:structuredClone(h.snapshot().scene),revision})).statusCode,200);
  assert.equal((await h.call('save',{scene:fixture(),revision})).statusCode,409,'real stale authored changes must still be rejected');
  const quote=await h.call('quote',{options:settings.options});
  await h.call('view',{activeNodeId:'root',boardOpen:true});
  assert.equal((await h.call('start',{options:settings.options,quoteKey:quote.body.quote.key})).statusCode,200);
  assert.equal(h.submits(),0);
});

test('a late view/read response cannot reopen a closed board or rewind the active node', async () => {
  const initial={scene:fixture(),revision:1,viewRevision:0};
  const open=structuredClone(initial); open.viewRevision=1; open.scene.ledger.boardOpen=true;
  const closed=structuredClone(open); closed.viewRevision=2; closed.scene.ledger.boardOpen=false; closed.scene.activeNodeId='end';
  let response=initial;
  const client=load('src/spatialWorldClient.ts',{axios:{post:async()=>({data:response})}});
  const session=client.spatialSession('/view-test',1,'scene-a');
  await client.spatialOperation(session,'read');
  response=closed;await client.spatialOperation(session,'view');
  response=open; const late=await client.spatialOperation(session,'view');
  assert.equal(late.scene.ledger.boardOpen,false);
  assert.equal(session.value.scene.activeNodeId,'end');
  response=initial;await client.spatialOperation(session,'read');
  assert.equal(session.value.viewRevision,2);
});

test('explicit provider rejection is retryable; lost acknowledgements require recovery', async () => {
  let failure;
  const reject=async()=>{throw failure;};
  const {submitSpatialVideo}=load('server/src/SpatialVideoProvider.ts',{
    replicate:class {predictions={create:reject};},'@fal-ai/client':{fal:{queue:{submit:reject}}},
  });
  for(const model of ['SeedanceMini','Proxxx'])for(const status of [400,422,429,500,undefined]) {
    failure=Object.assign(new Error('Fixture provider failure'),model==='SeedanceMini'?{response:{status}}:{status});
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await submitSpatialVideo({body:{model,job:fixture().ledger.routes.edge.forward,resolution:'480p',aspect:'16:9',audio:false}},res);
    assert.equal(res.body.ambiguous,status===500||status===undefined);
    assert.equal(res.statusCode,status===500||status===undefined?502:status);
  }
  const input=videoSpec.spatialVideoInput('Proxxx',fixture().ledger.routes.edge.forward,'480p','16:9',false);
  assert.equal(input.prompt_expansion_mode,'disabled','the provider must not expand the authored movement instruction');
});

test('retry backward retains the ready forward result and editing a prompt does not submit', async () => {
  const h=routeHarness(); await h.call('start',await h.start());
  await h.call('tick',{jobId:'edge:forward'}); await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/forward.mp4',endFrame:'https://a/real-end.png'});
  const forward=structuredClone(h.snapshot().scene.ledger.jobs[0]);
  const backward=h.snapshot().scene.ledger.jobs[1]; backward.status='failed'; backward.error='E005';
  const submits=h.submits(),preparations=h.preparations();
  const instruction='The ranger turns beside the chair and walks back to the entrance.';
  assert.equal((await h.call('edit-prompt',{jobId:backward.id,prompt:instruction})).statusCode,200);
  assert.equal(h.submits(),submits);
  assert.equal((await h.call('retry',{jobId:backward.id,prompt:instruction,sceneContext:{videoPrompt:'A changed narrative'}})).statusCode,200);
  assert.deepEqual(h.snapshot().scene.ledger.jobs[0],forward);
  assert.equal(h.snapshot().scene.connections[0].forward.videoUrl,forward.output);
  assert.equal(h.snapshot().scene.ledger.jobs[1].status,'queued');
  assert.equal(h.submits(),submits,'retry confirmation should queue only; no inline submission');
  await h.call('tick',{jobId:backward.id});
  assert.equal(h.preparations(),preparations,'retry reinterpreted the saved return prompt');
  assert.equal(h.submits(),submits+1);
  const submitted=h.submittedInputs().at(-1).job;
  assert.equal(submitted.guidance.instruction,instruction);
  assert.equal(submitted.startAnchor,'https://a/real-end.png');
  assert.equal(submitted.endAnchor,forward.startAnchor);
  assert.ok(videoSpec.spatialVideoInput('SeedanceMini',submitted,'480p','16:9',false).prompt.startsWith(instruction+' '));
  assert.deepEqual(h.snapshot().scene.ledger.jobs[0],forward);
});

test('replacement requires explicit confirmation and preserves paid descendants unchanged', async () => {
  const h=routeHarness(); await h.call('start',await h.start());
  await h.call('tick',{jobId:'edge:forward'}); await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/original.mp4',endFrame:'https://a/original-end.png'});
  const job=h.snapshot().scene.ledger.jobs[0], fields={jobId:job.id,confirmation:job.id,pixels:job.pixels};
  assert.equal((await h.call('regenerate',{jobId:job.id})).statusCode,409);
  assert.equal((await h.call('regenerate',fields)).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].previousResult.output,'https://a/original.mp4');
  assert.equal(h.snapshot().scene.connections[0].forward.videoUrl,'https://a/original.mp4');
  h.snapshot().scene.ledger.jobs[0].status='failed';
  assert.equal((await h.call('restore-result',{jobId:job.id})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].status,'ready');
  h.snapshot().scene.ledger.jobs[1].output='https://a/backward.mp4'; h.snapshot().scene.ledger.jobs[1].status='ready';
  assert.equal((await h.call('regenerate',fields)).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].previousResult.output,'https://a/original.mp4');
  assert.equal(h.snapshot().scene.ledger.jobs[1].output,'https://a/backward.mp4');
});

test('replacement protects an in-flight upscale and retains a completed HD result for restoration', async () => {
  const h=routeHarness();await h.call('start',await h.start());
  await h.call('tick',{jobId:'edge:forward'});await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{epoch:1,jobId:'edge:forward',videoUrl:'https://a/original.mp4',endFrame:'https://a/end.png'});
  const job=h.snapshot().scene.ledger.jobs[0],fields={jobId:job.id,confirmation:job.id,pixels:job.pixels};
  job.upscale={status:'generating',pixels:4,original:job.output,providerJobId:'hd'};
  assert.equal((await h.call('regenerate',fields)).statusCode,409);
  job.upscale.status='ready';job.upscale.output='https://a/hd.mp4';
  assert.equal((await h.call('regenerate',fields)).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale,undefined);
  assert.equal(h.snapshot().scene.ledger.jobs[0].previousResult.upscale.output,'https://a/hd.mp4');
  const replacement=h.snapshot().scene.ledger.jobs[0];replacement.status='checking';replacement.output='https://a/new.mp4';
  assert.equal((await h.call('regenerate',fields)).statusCode,409,'second replacement would overwrite the retained original');
  assert.equal((await h.call('restore-result',{jobId:job.id})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale.output,'https://a/hd.mp4');
  assert.equal(h.snapshot().scene.ledger.jobs[0].output,'https://a/original.mp4');
});

test('saved scene reject/restore round trip retains its paid geometry and references without provider calls', async () => {
  const h=routeHarness(), scene=fixture();
  scene.nodes=scene.nodes.slice(0,1); scene.activeNodeId=scene.nodes[0].id; scene.connections=[];
  scene.ledger.routes={}; scene.ledger.jobs=[]; scene.ledger.generationStarted=false;
  scene.ledger.world.references=[{name:'car',imageUrl:'https://assets.test/car.png',description:'Original car'}];
  const original=structuredClone(scene.ledger.world.plan);
  scene.ledger.world.approved=false;
  assert.equal((await h.call('save',{scene,revision:0})).statusCode,200);
  const rejected=structuredClone(h.snapshot().scene); rejected.ledger.world.reviewRejected=true;
  assert.equal((await h.call('save',{scene:rejected,revision:h.snapshot().revision})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.world.reviewRejected,true);
  const restored=structuredClone(h.snapshot().scene); delete restored.ledger.world.reviewRejected;
  assert.equal((await h.call('save',{scene:restored,revision:h.snapshot().revision})).statusCode,200);
  assert.deepEqual(h.snapshot().scene.ledger.world.plan,original);
  assert.equal(h.snapshot().scene.ledger.world.references[0].description,'Original car');
  assert.equal(h.snapshot().scene.ledger.world.approved,false);
  assert.equal(h.submits(),0); assert.equal(h.imageCalls(),0);
});
test('action image is quoted, generated once and applied only to its selected result', async () => {
  const h = routeHarness(), scene = fixture(); scene.connections[0].kind = 'action';
  await h.call('save', { scene, revision: 0 });
  const fields = { nodeId: 'end', prompt: 'Warmer lighting', aspect: '16:9' };
  const quote = await h.call('action-image-quote', fields);
  assert.equal(quote.statusCode, 200); assert.equal(h.imageCalls(), 0);
  const release = h.defer();
  const running = h.call('action-image', { ...fields, quoteKey: quote.body.actionImageQuote.key });
  while (!h.imageCalls()) await new Promise(r => setImmediate(r));
  assert.equal((await h.call('action-image', { ...fields, quoteKey: quote.body.actionImageQuote.key })).statusCode, 409);
  assert.equal((await h.call('save', { scene, revision: h.snapshot().revision })).statusCode, 409);
  release(); await running;
  const edit = h.snapshot().scene.ledger.actionImageEdits.end;
  assert.equal(edit.status, 'ready'); assert.equal(h.snapshot().scene.nodes[1].frameUrl, edit.original);
  assert.equal((await h.call('action-image-apply', { nodeId: 'root', editId: edit.id, imageUrl: 'https://assets.test/saved.png' })).statusCode, 409);
  const applied = await h.call('action-image-apply', { nodeId: 'end', editId: edit.id, imageUrl: 'https://assets.test/saved.png' });
  assert.equal(applied.statusCode, 200); assert.equal(h.imageCalls(), 1);
  assert.equal(h.snapshot().scene.nodes[0].frameUrl, scene.nodes[0].frameUrl);
  assert.equal(h.snapshot().scene.nodes[1].frameUrl, 'https://assets.test/saved.png');
  assert.equal(h.snapshot().scene.ledger.routes.edge.forward.endAnchor, 'https://assets.test/saved.png');
  assert.equal(h.snapshot().scene.ledger.actionImageEdits.end.original, edit.original);
});
test('image editing rejects roots, movement results, stale quotes and generated scenes', async () => {
  const h = routeHarness(), start = await h.start();
  const fields = { nodeId: 'end', prompt: 'Lighting', aspect: '16:9' };
  assert.equal((await h.call('action-image-quote', fields)).statusCode, 409);
  const scene = worldModel.cloneWorld(h.snapshot().scene); scene.connections[0].kind = 'action';
  await h.call('save', { scene, revision: h.snapshot().revision });
  assert.equal((await h.call('action-image-quote', { ...fields, nodeId: 'root' })).statusCode, 409);
  const quote = await h.call('action-image-quote', fields);
  await h.call('view', { view: 'three' });
  // Only an authored change invalidates the quote, not changing the view.
  await h.call('save', { scene: worldModel.cloneWorld(h.snapshot().scene), revision: h.snapshot().revision });
  assert.equal((await h.call('action-image', { ...fields, quoteKey: quote.body.actionImageQuote.key })).statusCode, 409);
  const videoQuote = await h.call('quote', { options: start.options });
  await h.call('start', { options: start.options, quoteKey: videoQuote.body.quote.key });
  assert.equal((await h.call('action-image-quote', fields)).statusCode, 409);
  assert.equal(h.imageCalls(), 0);
});
test('an action image cannot change a frame already used by an authored descendant', async () => {
  const h = routeHarness(), scene = fixture(); scene.connections[0].kind = 'action';
  scene.nodes.push({ id: 'child', frameUrl: 'https://assets.test/child.png' });
  scene.connections.push({ ...worldModel.cloneWorld(scene.connections[0]), id: 'child-edge', sourceNodeId: 'end', targetNodeId: 'child', kind: 'movement' });
  scene.ledger.routes['child-edge'] = { ...worldModel.cloneWorld(scene.ledger.routes.edge), connectionId: 'child-edge' };
  scene.ledger.states.child = worldModel.cloneWorld(scene.ledger.states.end);
  assert.equal((await h.call('save', { scene, revision: 0 })).statusCode, 200);
  assert.equal((await h.call('action-image-quote', { nodeId: 'end', prompt: 'Lighting', aspect: '16:9' })).statusCode, 409);
  assert.equal(h.imageCalls(), 0);
});
test('duplicate confirmation and concurrent ticks create only one provider submission', async () => {
  const h = routeHarness(), start = await h.start();
  const results = await Promise.all([h.call('start', start), h.call('start', start)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  await Promise.all([h.call('tick', { jobId: 'edge:forward' }), h.call('tick', { jobId: 'edge:forward' })]);
  assert.equal(h.submits(), 1);
  await h.call('tick', { jobId: 'edge:forward' });
  assert.equal(h.snapshot().scene.ledger.jobs[0].status, 'checking');
  assert.equal(h.snapshot().scene.ledger.jobs[1].status, 'waiting-on-parent');
  await h.call('complete', { jobId: 'edge:forward', epoch: 1, videoUrl: 'https://assets.test/saved.mp4', endFrame: 'https://assets.test/actual-end.png' });
  assert.equal(h.snapshot().scene.ledger.jobs[1].status, 'queued');
});

test('saved ten-second action is quoted once, submitted at ten seconds and keeps playback timing', async () => {
  const h=routeHarness(),scene=fixture(); scene.connections[0].kind='action';
  const animation=scene.ledger.routes.edge.forward;
  animation.plan.duration=10;
  animation.plan.objects.forEach(object=>object.keys.forEach(key=>key.t*=2));
  animation.plan.camera.forEach(key=>key.t*=2);
  delete scene.ledger.routes.edge.backward;
  assert.equal((await h.call('save',{scene,revision:0})).statusCode,200);
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false};
  const quote=await h.call('quote',{options});
  assert.equal(quote.statusCode,200); assert.equal(quote.body.quote.pixels,167);
  assert.equal((await h.call('start',{options,quoteKey:quote.body.quote.key})).statusCode,200);
  assert.equal(h.snapshot().scene.ledger.jobs.length,1);
  assert.equal(h.snapshot().scene.ledger.jobs[0].duration,10);
  await h.call('tick',{jobId:'edge:forward'}); assert.equal(h.submits(),1);
  assert.equal(h.submittedInputs()[0].duration,10);
  assert.equal(load('server/src/mediaPricing.ts').mediaChargeFor('/spatial-video',h.submittedInputs()[0]).pixels,quote.body.quote.pixels,'ten-second billing differs from confirmed price');
  await h.call('tick',{jobId:'edge:forward'});
  await h.call('complete',{jobId:'edge:forward',epoch:1,videoUrl:'https://assets.test/saved.mp4',endFrame:'https://assets.test/end.png'});
  assert.equal(h.snapshot().scene.connections[0].forward.durationMs,10000);
});
test('generation rejects unfinished mapping drafts and mismatched framing without provider calls', async () => {
  const h = routeHarness(), scene = fixture();
  scene.ledger.world.aspectRatio = '9:16';
  scene.ledger.draft = { plan: scene.ledger.world.plan, samples: [], kind: 'movement', prompt: '', hold: false, sourceNodeId: 'root' };
  assert.equal((await h.call('save', { scene, revision: 0 })).statusCode, 200);
  const options = { model: 'Proxxx', resolution: '480p', aspect: '9:16', audio: false };
  assert.equal((await h.call('quote', { options })).statusCode, 409);
  delete scene.ledger.draft;
  assert.equal((await h.call('save', { scene, revision: h.snapshot().revision })).statusCode, 200);
  assert.equal((await h.call('quote', { options: { ...options, aspect: '16:9' } })).statusCode, 409);
  assert.equal((await h.call('quote', { options })).statusCode, 200);
  assert.equal(h.submits(), 0);
});
test('interrupted submission recovers only its owned matching billing receipt without resubmission', async () => {
  const h = routeHarness(); await h.call('start', await h.start());
  const release = h.defer(), pending = h.call('tick', { jobId: 'edge:forward' });
  while (!h.submits()) await new Promise(r => setImmediate(r));
  assert.ok(h.snapshot().scene.ledger.jobs[0].submissionToken);
  h.receipts([{ provider: 'replicate', provider_job_id: 'wrong', model_endpoint: 'wrong-model' }]);
  await h.call('recover', { jobId: 'edge:forward' });
  assert.equal(h.snapshot().scene.ledger.jobs[0].submissionUncertain, true);
  assert.equal((await h.call('retry', { jobId: 'edge:forward' })).statusCode, 409);
  h.receipts([{ provider: 'replicate', provider_job_id: 'provider-1', model_endpoint: 'bytedance/seedance-2.0-mini' }]);
  assert.equal((await h.call('recover', { jobId: 'edge:forward' })).statusCode, 200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].status, 'generating');
  assert.equal(h.snapshot().scene.ledger.jobs[0].providerJobId, 'provider-1');
  assert.equal(h.submits(), 1);
  release(); await pending;
});
test('deleting generated videos accepts unpublished preview label metadata and preserves published labels', async () => {
  const labels={ 'scene-a':{edge:'Strike'} };
  for (const nativeJson of [false,true])for (const document of [{actionLabels:labels},{version:1,actionLabels:labels,stages:[{id:'scene-a',scene:fixture()}]}]) {
    const h=routeHarness(document,false,nativeJson);
    assert.equal((await h.call('save',{scene:fixture(),revision:0})).statusCode,200);
    const deleted=await h.call('delete',{confirmation:'DELETE'});
    assert.equal(deleted.statusCode,200,JSON.stringify(deleted.body));
    assert.equal(deleted.body.scene.ledger.view,'three');
    assert.equal(deleted.body.scene.connections[0].forward,null);
    assert.deepEqual(h.call.published().actionLabels,labels);
  }
});
test('typed deletion invalidates an in-flight submission and preserves authored routes', async () => {
  const h = routeHarness(); await h.call('start', await h.start());
  const release = h.defer();
  const pending = h.call('tick', { jobId: 'edge:forward' });
  while (!h.submits()) await new Promise(r => setImmediate(r));
  assert.equal((await h.call('delete', { confirmation: 'delete' })).statusCode, 409);
  assert.equal((await h.call('delete', { confirmation: 'DELETE' })).statusCode, 200);
  release(); await pending;
  const ledger = h.snapshot().scene.ledger;
  assert.equal(ledger.epoch, 2); assert.equal(ledger.generationStarted, false); assert.equal(ledger.jobs.length, 0);
  assert.equal(Object.keys(ledger.routes).length, 1); assert.equal(h.cancelled(), 1);
  assert.equal((await h.call('complete', { epoch: 1, jobId: 'edge:forward' })).statusCode, 409);
});

test('HD upscale persists its provider ID, resumes polling and retains the original', async () => {
  const h = routeHarness(); await h.call('start', await h.start());
  await h.call('tick', { jobId: 'edge:forward' }); await h.call('tick', { jobId: 'edge:forward' });
  await h.call('complete', { jobId: 'edge:forward', epoch: 1, videoUrl: 'https://assets.test/original.mp4', endFrame: 'https://assets.test/end.png' });
  const quote = await h.call('upscale-quote', { jobId: 'edge:forward' });
  const started = await h.call('upscale', { jobId: 'edge:forward', quoteKey: quote.body.upscaleQuote.key });
  assert.equal(started.statusCode, 200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale.providerJobId, 'upscale-1');
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale.endpoint, 'bytedance/video-upscaler');
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale.status, 'generating');
  assert.equal((await h.call('upscale', { jobId: 'edge:forward', quoteKey: quote.body.upscaleQuote.key })).statusCode, 409);
  await h.call('upscale-tick', { jobId: 'edge:forward' });
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale.status, 'ready');
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscale.original, 'https://assets.test/original.mp4');
  assert.equal(h.snapshot().scene.connections[0].forward.videoUrl, 'https://assets.test/original.mp4');
});

test('spatial resolution quotes and repeated HD own their source, price, metadata and earlier paid outputs', async () => {
  const h = routeHarness(); await h.call('start', await h.start());
  await h.call('tick', { jobId: 'edge:forward' }); await h.call('tick', { jobId: 'edge:forward' });
  await h.call('complete', { jobId: 'edge:forward', epoch: 1, videoUrl: 'https://assets.test/original.mp4', endFrame: 'https://assets.test/end.png' });
  const full = await h.call('upscale-quote', { jobId: 'edge:forward', targetResolution: '1080p' });
  const twoK = await h.call('upscale-quote', { jobId: 'edge:forward', targetResolution: '2k' });
  assert.equal(full.body.upscaleQuote.pixels, 23); assert.equal(twoK.body.upscaleQuote.pixels, 46);
  assert.equal(h.upscaleInputs().length, 0, 'quoting or cancelling must not submit a provider job');
  assert.equal((await h.call('upscale', { jobId: 'edge:forward', targetResolution: '2k', quoteKey: full.body.upscaleQuote.key })).statusCode, 409);
  assert.equal(h.upscaleInputs().length, 0);
  assert.equal((await h.call('upscale', { jobId: 'edge:forward', targetResolution: '2k', quoteKey: twoK.body.upscaleQuote.key })).statusCode, 200);
  assert.equal(h.upscaleInputs()[0].targetResolution, '2k'); assert.equal(h.upscaleInputs()[0].targetWidth, 2560); assert.equal(h.upscaleInputs()[0].targetHeight, 1440);
  await h.call('upscale-tick', { jobId: 'edge:forward' });
  const first = structuredClone(h.snapshot().scene.ledger.jobs[0].upscale);
  assert.equal(first.resolution, '2k'); assert.equal(first.targetFps, 60); assert.equal(first.videoType, 'AIGC'); assert.equal(first.variant, 'Standard'); assert.equal(first.pixels, 46);
  const quote = await h.call('upscale-quote', { jobId: 'edge:forward', targetResolution: '1080p' });
  const release = h.defer();
  const submitting = h.call('upscale', { jobId: 'edge:forward', targetResolution: '1080p', quoteKey: quote.body.upscaleQuote.key });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await h.call('upscale', { jobId: 'edge:forward', targetResolution: '1080p', quoteKey: quote.body.upscaleQuote.key })).statusCode, 409);
  release(); assert.equal((await submitting).statusCode, 200);
  const current = h.snapshot().scene.ledger.jobs[0];
  assert.equal(h.upscaleInputs().length, 2); assert.equal(h.upscaleInputs()[1].video, first.output);
  assert.equal(current.upscale.original, first.output); assert.deepEqual(current.upscaleHistory, [first]);
  assert.equal(current.output, 'https://assets.test/original.mp4');
  assert.equal((await h.call('upscale-complete', { epoch: 1, jobId: current.id, sourceOutput: first.output, submissionToken: 'wrong-attempt', videoUrl: 'https://assets.test/wrong.mp4' })).statusCode, 409);
  assert.equal((await h.call('upscale-complete', { epoch: 1, jobId: current.id, sourceOutput: first.output, submissionToken: first.submissionToken, videoUrl: 'https://assets.test/retained-hd.mp4' })).statusCode, 200);
  assert.equal(h.snapshot().scene.ledger.jobs[0].upscaleHistory[0].output, 'https://assets.test/retained-hd.mp4');
});

test('ByteDance spatial upscale recovers its owned receipt without submitting another job', async () => {
  const h = routeHarness(); await h.call('start', await h.start());
  await h.call('tick', { jobId: 'edge:forward' }); await h.call('tick', { jobId: 'edge:forward' });
  await h.call('complete', { jobId: 'edge:forward', epoch: 1, videoUrl: 'https://assets.test/original.mp4', endFrame: 'https://assets.test/end.png' });
  const quote = await h.call('upscale-quote', { jobId: 'edge:forward' });
  await h.call('upscale', { jobId: 'edge:forward', quoteKey: quote.body.upscaleQuote.key });
  const upscale = h.snapshot().scene.ledger.jobs[0].upscale;
  delete upscale.providerJobId; delete upscale.endpoint; upscale.status = 'submitting';
  const polls = h.polls(), submissions = h.submits();
  h.receipts([{ provider: 'replicate', provider_job_id: 'wrong', model_endpoint: 'wrong-model' }]);
  await h.call('upscale-tick', { jobId: 'edge:forward' });
  assert.equal(h.polls(), polls);
  h.receipts([{ provider: 'replicate', provider_job_id: 'byte-recovered', model_endpoint: 'bytedance/video-upscaler' }]);
  await h.call('upscale-tick', { jobId: 'edge:forward' });
  const completed = h.snapshot().scene.ledger.jobs[0].upscale;
  assert.equal(completed.providerJobId, 'byte-recovered');
  assert.equal(completed.endpoint, 'bytedance/video-upscaler');
  assert.equal(completed.status, 'ready');
  assert.equal(h.polls(), polls + 1); assert.equal(h.submits(), submissions);
});

test('legacy B-shot binding checks revision and preserves its authored graph', async () => {
  const h = routeHarness(), scene = fixture(); scene.sceneId = 'parent:b:legacy';
  assert.equal((await h.call('save', { stageId: scene.sceneId, scene, revision: 0 })).statusCode, 200);
  const source = { identity: scene.sceneId, slot: 1, prompt: 'same shot', frameUrl: scene.nodes[0].frameUrl };
  assert.equal((await h.call('bind-source', { stageId: scene.sceneId, revision: 0, source })).statusCode, 409);
  assert.equal((await h.call('bind-source', { stageId: scene.sceneId, revision: 1, source })).statusCode, 200);
  assert.deepEqual(h.snapshot().scene.ledger, worldModel.cloneWorld(scene.ledger));
  assert.equal(h.snapshot().scene.bShotSource.slot, 1);
  assert.equal((await h.call('bind-source', { stageId: scene.sceneId, revision: 2, source: { ...source, slot: 0 } })).statusCode, 409);
});

test('interrupted image release requires explicit confirmation and a ten-minute wait', async () => {
  const h = routeHarness(), scene = fixture(); scene.connections[0].kind = 'action';
  await h.call('save', { scene, revision: 0 });
  const fields = { nodeId: 'end', prompt: 'Lighting', aspect: '16:9' };
  const quote = await h.call('action-image-quote', fields), release = h.defer();
  const pending = h.call('action-image', { ...fields, quoteKey: quote.body.actionImageQuote.key });
  while (!h.imageCalls()) await new Promise(r => setImmediate(r));
  const edit = h.snapshot().scene.ledger.actionImageEdits.end;
  assert.equal((await h.call('action-image-abandon', { nodeId: 'end', editId: edit.id, confirmation: 'ABANDON' })).statusCode, 409);
  edit.startedAt = Date.now() - 600001;
  assert.equal((await h.call('action-image-abandon', { nodeId: 'end', editId: edit.id, confirmation: 'no' })).statusCode, 409);
  assert.equal((await h.call('action-image-abandon', { nodeId: 'end', editId: edit.id, confirmation: 'ABANDON' })).statusCode, 200);
  release(); await pending;
  assert.equal(h.snapshot().scene.ledger.actionImageEdits.end, undefined);
  assert.equal(h.snapshot().scene.nodes[1].frameUrl, scene.nodes[1].frameUrl);
});

test('a delayed status poll cannot roll back an already approved saved video', async () => {
  const h = routeHarness(); await h.call('start', await h.start());
  await h.call('tick', { jobId: 'edge:forward' });
  const release = h.deferPoll(), pending = h.call('tick', { jobId: 'edge:forward' });
  while (!h.polls()) await new Promise(r => setImmediate(r));
  await h.call('tick', { jobId: 'edge:forward' });
  await h.call('complete', { jobId: 'edge:forward', epoch: 1, videoUrl: 'https://assets.test/saved.mp4', endFrame: 'https://assets.test/end.png' });
  release(); await pending;
  assert.equal(h.snapshot().scene.ledger.jobs[0].status, 'ready');
  assert.equal(h.snapshot().scene.ledger.jobs[0].output, 'https://assets.test/saved.mp4');
});

test('all spatial providers apply explicit sound choices to forward, return and action requests without mutating saved prompts', () => {
  const reference={url:'https://assets.test/audio.mp3',name:'Voice',duration:5,enabled:true};
  for(const model of Object.keys(videoSpec.spatialVideoModels)) for(const kind of ['movement','action']) for(const direction of ['forward','backward']) {
    const job={...fixture().ledger.routes.edge.forward,kind,direction,promptVersion:2,audioReference:reference,prompt:'Turns in place and walks forward.\nMusic: none\nNo music'};
    const before=structuredClone(job);
    const silent=videoSpec.spatialVideoInput(model,job,'480p','16:9',false,true);
    assert.equal(silent.reference_audios??silent.reference_audio_urls,undefined);
    assert.match(silent.prompt,/no dialogue, sound effects, ambience or music/);
    if(!['Proxxx','FalH3'].includes(model))assert.equal(silent.generate_audio,false);
    const effects=videoSpec.spatialVideoInput(model,job,'480p','16:9',true,false);
    assert.match(effects.prompt,/Music: none/);assert.match(effects.prompt,/do not invent dialogue/);
    assert.deepEqual(effects.reference_audios??effects.reference_audio_urls,[reference.url]);
    const music=videoSpec.spatialVideoInput(model,job,'480p','16:9',true,true);
    assert.doesNotMatch(music.prompt,/Music:\s*none|No music/i);assert.match(music.prompt,/Generated background music is allowed/);
    assert.deepEqual(job,before);
  }
});

async function completedPair(h) {
  await h.call('start',await h.start());
  for(const direction of ['forward','backward']) {
    const jobId=`edge:${direction}`;
    await h.call('tick',{jobId});await h.call('tick',{jobId});
    assert.equal((await h.call('complete',{epoch:1,jobId,videoUrl:`https://a/original-${direction}.mp4`,endFrame:`https://a/original-${direction}.png`})).statusCode,200);
  }
}

test('a pair replacement confirms combined cost atomically and submits Backward only after the new Forward frame is saved', async()=>{
  const h=routeHarness();await completedPair(h);
  const original=structuredClone(h.snapshot()),options={model:'Pro',resolution:'720p',aspect:'16:9',audio:true,music:true};
  const fields={jobIds:['edge:backward','edge:forward'],options};
  const quote=await h.call('quote',fields);assert.equal(quote.statusCode,200,JSON.stringify(quote.body));
  assert.equal(quote.body.quote.pixels,732);assert.deepEqual(quote.body.quote.jobs.map(j=>j.id),['edge:forward','edge:backward']);
  const confirmation={...fields,confirmation:'edge:forward,edge:backward',quoteKey:quote.body.quote.key,pixels:732};
  assert.equal((await h.call('regenerate',{...confirmation,pixels:366})).statusCode,409);
  assert.deepEqual(h.snapshot(),original,'partial price confirmation changed a paid result');
  assert.equal((await h.call('regenerate',confirmation)).statusCode,200);
  let [forward,backward]=h.snapshot().scene.ledger.jobs;
  assert.equal(forward.status,'queued');assert.equal(backward.status,'waiting-on-parent');
  assert.equal(forward.previousResult.output,'https://a/original-forward.mp4');assert.equal(backward.previousResult.output,'https://a/original-backward.mp4');
  assert.deepEqual(h.snapshot().scene.connections,original.scene.connections,'queued replacements overwrote paid clips');
  const submissions=h.submits();await h.call('tick',{jobId:backward.id});assert.equal(h.submits(),submissions);
  await h.call('tick',{jobId:forward.id});await h.call('tick',{jobId:forward.id});
  await h.call('tick',{jobId:backward.id});assert.equal(h.submits(),submissions+1,'Backward submitted before Forward assets were saved');
  await h.call('complete',{epoch:1,jobId:forward.id,videoUrl:'https://a/replaced-forward.mp4',endFrame:'https://a/replaced-forward.png'});
  assert.equal((await h.call('tick',{jobId:backward.id})).statusCode,200);
  const request=h.submittedInputs().at(-1);
  assert.equal(request.job.startAnchor,'https://a/replaced-forward.png');assert.equal(request.job.endAnchor,original.scene.ledger.jobs[0].startAnchor);
  assert.deepEqual(request.job.options,options);assert.equal(request.music,true);assert.equal(request.audio,true);
});

test('replacement quotes detect changed prompts and reject unrelated pairs without touching saved videos', async()=>{
  const h=routeHarness();await completedPair(h);
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:false,music:true},jobIds=['edge:forward','edge:backward'];
  const quote=await h.call('quote',{jobIds,options});assert.equal(quote.body.quote.jobs[0].options.music,false);
  await h.call('edit-prompt',{jobId:'edge:backward',prompt:'Returns quietly to the original position.'});
  const before=structuredClone(h.snapshot());
  assert.equal((await h.call('regenerate',{jobIds,options,confirmation:jobIds.join(','),quoteKey:quote.body.quote.key,pixels:166})).statusCode,409);
  assert.deepEqual(h.snapshot(),before);
  assert.equal((await h.call('quote',{jobIds:['edge:forward','missing:backward'],options})).statusCode,409);
  assert.deepEqual(h.snapshot(),before);
});

test('single replacement and failed retry keep their own sound choices and leave siblings and batch defaults intact', async()=>{
  const h=routeHarness();await completedPair(h);
  const sibling=structuredClone(h.snapshot().scene.ledger.jobs[1]),batch=structuredClone(h.snapshot().options);
  const options={model:'SeedanceMini',resolution:'480p',aspect:'16:9',audio:true,music:true},jobIds=['edge:forward'];
  const quote=await h.call('quote',{jobIds,options});
  assert.equal((await h.call('regenerate',{jobIds,options,confirmation:jobIds[0],quoteKey:quote.body.quote.key,pixels:83})).statusCode,200);
  assert.deepEqual(h.snapshot().scene.ledger.jobs[1],sibling);assert.deepEqual(h.snapshot().options,batch);
  const job=h.snapshot().scene.ledger.jobs[0];job.status='failed';job.error='Provider rejected';
  assert.equal((await h.call('retry',{jobId:job.id})).statusCode,200);
  await h.call('tick',{jobId:job.id,audio:false});
  assert.deepEqual(h.submittedInputs().at(-1).job.options,options);
  assert.deepEqual(h.snapshot().scene.ledger.jobs[1],sibling);assert.deepEqual(h.snapshot().options,batch);
});
