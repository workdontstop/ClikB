const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
function load(file, mocks = {}, cache = new Map()) {
    if (/server[\\/]src[\\/](?:MotionGuideRoute|SpatialWorldPlanRoute)\.ts$/.test(file)) mocks = require('./helpers/isolatedPlanningBilling.cjs').withIsolatedPlanningBilling(mocks, load);
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
        ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return mod.exports;
}
const models = { luna: 'gpt-6-luna', terra: 'gpt-6.1-terra', sol: 'gpt-6.1-sol' }, prices = { luna: 1, terra: 1, sol: 1 }; // floor(1.2 P fixture usage), with 0.2 P carried.
const { validateWorld } = load('server/src/spatialWorld.ts');
function worldFixture() {
    const plan = { version: 1, duration: 5, background: '#ffffff', objects: [{ id: 'car', shape: 'box', color: '#ffffff',
        keys: [0, 5].map(t => ({ t, position: [0, .5, 0], rotation: [0, 0, 0], scale: [.5, 1, .5] })) }],
        camera: [0, 5].map(t => ({ t, position: [0, 2, 6], target: [0, .5, 0], fov: 45 })) };
    return validateWorld({ version: 2, model: 'luna', revision: 'world-1', sourceImage: 'https://assets.test/scene.png', plan,
        controlledObject: 'car', controlMode: 'vehicle', walkable: [{ min: [-5, 0, -5], max: [5, 2, 5] }], obstacles: [], approved: true });
}
function harness(moduleName, outputs = [], balance = 100) {
    const calls = [], charges = [], usage = [];
    const provider = { chat: { completions: { create: async request => {
        calls.push(request); assert.ok(outputs.length, 'Unexpected additional provider call');
        return { model: request.model, choices: [{ message: { content: JSON.stringify(outputs.shift()) } }] };
    } } } };
    const handlers = load(moduleName, {
        openai: class {}, './textGeneration': { createRoutedTextClient: () => provider },
        './requestAuth': { authenticatedUserId: () => 'owned-user' },
        './db': { getPixelsForUser: async () => balance, trySpendPixels: async (_user, price) => {
            if (balance < price) return false;
            charges.push(price); balance -= price; return true;
        } },
        './aiUsageLedger': { recordOpenAiUsage: (...args) => usage.push(args), recordPixelCharge() {} },
    });
    return { ...handlers, calls, charges, usage, async run(handler, body) {
        const res = { code: 200, body: undefined, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
        await handler({ body }, res); return res;
    } };
}
function assertPlanningProfile(calls, tier, count = 1) {
    assert.equal(calls.length, count);
    for (const call of calls) { assert.equal(call.model, models[tier]); assert.equal(call.reasoning_effort, 'low'); assert.equal(call.max_completion_tokens, 60000); }
}

test('actual spatial planner operations preserve selected models, reasoning profiles and one logical charge', async () => {
    for (const tier of Object.keys(models)) for (const operation of ['identify', 'reconstruct', 'movement', 'action', 'return', 'action-correction']) {
        const world = worldFixture(), correction = operation === 'action-correction';
        const output = operation === 'identify' ? { subjects: [{ name: 'car', description: 'The existing car' }] }
            : { plan: world.plan, controlledObject: 'car', controlMode: 'vehicle', walkable: world.walkable, obstacles: [], creatorInstruction: 'Turn the existing car gently' };
        const h = harness('server/src/SpatialWorldPlanRoute.ts', [output]);
        const body = { operation: correction ? 'action' : operation, llmTier: tier, prompt: 'Move the existing car', image: world.sourceImage,
            aspectRatio: '16:9', drivenName: 'car', world, recorded: world.plan, sourceState: world.initialState, destinationState: world.initialState,
            ...(correction ? { existingPlan: world.plan, existingEndState: world.initialState, existingStateChanges: {}, correction: 'Turn more gently' } : {}) };
        const res = await h.run(h.spatialWorldPlan, body);
        assert.equal(res.code, 200, `${tier}/${operation}: ${JSON.stringify(res.body)}`); assertPlanningProfile(h.calls, tier);
        assert.equal(h.usage.length, 1); assert.deepEqual(h.charges, operation === 'identify' ? [] : [prices[tier]]);
        if (operation !== 'identify') assert.equal(res.body.llmBilling.pixelsCharged, prices[tier]);
        if (correction) assert.ok(h.calls[0].messages[0].content.includes('ACTION CORRECTION'));
        assert.equal(res.body.reviewTicket, undefined);
    }
});

test('invalid planner tiers and retired review never call or charge a provider', async () => {
    const h = harness('server/src/SpatialWorldPlanRoute.ts');
    const invalid = await h.run(h.spatialWorldPlan, { operation: 'reconstruct', llmTier: 'invalid', prompt: '' }); assert.equal(invalid.code, 400);
    const review = await h.run(h.spatialWorldPlan, { operation: 'review', plan: worldFixture().plan }); assert.equal(review.code, 200);
    assert.deepEqual(h.calls, []); assert.deepEqual(h.charges, []);
});

test('spatial helper rejects a short balance before inference and accepts exactly the selected fee', async () => {
    for (const tier of ['luna', 'sol']) {
        const world = worldFixture(), price = prices[tier];
        const body = { operation: 'action', llmTier: tier, prompt: 'Turn gently', world,
            recorded: world.plan, sourceState: world.initialState };
        const insufficient = harness('server/src/SpatialWorldPlanRoute.ts', [], price - 1);
        const denied = await insufficient.run(insufficient.spatialWorldPlan, body);
        assert.equal(denied.code, 402); assert.deepEqual(insufficient.calls, []); assert.deepEqual(insufficient.charges, []);
        const exact = harness('server/src/SpatialWorldPlanRoute.ts', [{ plan: world.plan }], price);
        const accepted = await exact.run(exact.spatialWorldPlan, body);
        assert.equal(accepted.code, 200, JSON.stringify(accepted.body)); assert.deepEqual(exact.charges, [price]);
        assert.equal(accepted.body.llmBilling.pixelsCharged, price); assert.equal(accepted.body.llmBilling.pixels, 0);
    }
});

test('shared context/refiner repairs retain selected reasoning across every authored-state mode', async () => {
    const context = { controlledSubject: 'car', controlMode: 'vehicle', primaryMotion: 'Drive the existing car gently.', ambientMotion: 'Nearby trees remain still.' };
    const refinement = { startRelation: 'Beside the tree', route: 'Along the lane', endRelation: 'Still inside the lane',
        controlledMovement: 'The existing car drives gently along the authored route and stops.', secondaryMotion: 'Trees remain still.',
        spatialPlan: { cameraMode: 'fixed', unitStaysInside: true, preservesControlState: true, inventsEnvironment: false, boundaryLimited: false,
            path: [{ x: .5, y: 0, z: .3 }, { x: .6, y: 0, z: .3 }] } };
    for (const tier of Object.keys(models)) {
        for (const stateMode of ['root', 'post-action', 'planned-action']) {
            const h = harness('server/src/SpatialMotionContext.ts', [{ contexts: [] }, { contexts: [{ sceneId: 'scene', ...context }] }]);
            const world = worldFixture();
            const res = await h.run(h.compileSpatialMotionContexts, { llmTier: tier, scenes: [{ nodeId: 'root', sceneId: 'scene',
                sceneIntent: 'Drive gently', videoPrompt: 'Drive gently', stateMode, completedAction: 'Stopped', finalFrameUrl: world.sourceImage,
                ...(stateMode === 'planned-action' ? { plannedState: world.initialState, referenceMotion: { stateEvidence: 'authored-world' } } : {}) }] });
            assert.equal(res.code, 200, JSON.stringify(res.body)); assertPlanningProfile(h.calls, tier, 2); assert.deepEqual(h.charges, []);
        }
        for (const direction of ['forward', 'backward']) {
            const h = harness('server/src/SpatialMotionContext.ts', [{ spatialPlan: null }, refinement]);
            const res = await h.run(h.refineSpatialMovementFromFrame, { llmTier: tier, sceneId: 'scene', sceneIntent: 'Drive gently', videoPrompt: 'Drive gently',
                motionContext: context, durationSeconds: 5, movementText: 'Follow the authored route', imageUrl: 'https://assets.test/scene.png',
                referenceMotion: { stateEvidence: 'authored-world', direction }, ...(direction === 'backward' ? { destinationImageUrl: 'https://assets.test/destination.png' } : {}) });
            assert.equal(res.code, 200, JSON.stringify(res.body)); assertPlanningProfile(h.calls, tier, 2); assert.deepEqual(h.charges, []);
        }
    }
});

test('nonselected provider policies stay unchanged', () => {
    const { spatialPlanningInference } = load('server/src/spatialPlanningInference.ts');
    assert.deepEqual(spatialPlanningInference('astra'), { reasoning_effort: 'low' });
    for (const tier of ['deepseek', 'kimi']) assert.deepEqual(spatialPlanningInference(tier), {});
});
