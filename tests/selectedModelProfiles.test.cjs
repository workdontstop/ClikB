const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, cache = new Map()) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : /\.(?:webp|png|jpg)$/.test(name) ? name : name.startsWith('.')
        ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return mod.exports;
}

test('selected creation profiles apply only when explicitly passed; pinned Luna editing and B-shot calls retain their settings', async () => {
    const { creationInferenceForTier } = load('server/src/creationModelProfiles.ts');
    const raw = fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8');
    const source = ts.createSourceFile('GptApi.ts', raw, ts.ScriptTarget.Latest, true);
    const functions = source.statements.filter(node => ts.isFunctionDeclaration(node)
        && ['generateGPT4oPrompt5', 'generateGPT4oPrompt5B'].includes(node.name?.text));
    assert.equal(functions.length, 2);
    for (const node of functions) {
        const requests = [];
        const code = ts.transpileModule(node.getText(source) + `\nexports.run = ${node.name.text};`, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const exports = {};
        new Function('exports', 'openai', 'recordOpenAiUsage', 'reasoningEffortForLanguageModel', code)(exports,
            { chat: { completions: { create: async request => { requests.push(request); return { choices: [{ message: { content: 'A complete prompt.' } }] }; } } } },
            () => {}, () => undefined);
        await exports.run([], 'gpt-6-luna');
        assert.equal(requests.at(-1).reasoning_effort, undefined);
        assert.equal(requests.at(-1).max_completion_tokens, 4000);
        for (const [tier, model, effort] of [
            ['luna', 'gpt-6-luna', 'low'],
            ['luna_extra', 'gpt-6-luna', 'high'],
            ['terra', 'gpt-6.1-terra', 'high'],
            ['sol_medium', 'gpt-6.1-sol', 'medium'],
            ['sol', 'gpt-6.1-sol', 'high'],
        ]) {
            await exports.run([], model, creationInferenceForTier(tier));
            assert.equal(requests.at(-1).reasoning_effort, effort);
            assert.equal(requests.at(-1).max_completion_tokens, 32000);
        }
        await exports.run([], 'gpt-6-luna');
        assert.equal(requests.at(-1).reasoning_effort, undefined, 'selected reasoning must not leak into the next fixed helper');
        assert.equal(requests.at(-1).max_completion_tokens, 4000);
    }
});

test('billing retains the explicit profile even for an already-paid batch; charge values match 1 P / 2 P / 5 P / 15 P', async () => {
    const charges = [];
    const { beginLlmRequest } = load('server/src/llmBilling.ts', {
        './requestAuth': { authenticatedUserId: () => 'user' },
        './db': { getPixelsForUser: async () => 100, trySpendPixels: async () => { charges.push(1); return true; } },
        './aiUsageLedger': { recordPixelCharge() {} },
    });
    for (const [tier, model, effort, price] of [
        ['luna', 'gpt-6-luna', 'low', 1],
        ['luna_extra', 'gpt-6-luna', 'high', 2],
        ['terra', 'gpt-6.1-terra', 'high', 5],
        ['sol', 'gpt-6.1-sol', 'high', 15],
    ]) {
        const result = await beginLlmRequest({ body: { llmTier: tier } }, {}, 'unused');
        assert.equal(result.model, model); assert.equal(result.inference.reasoning_effort, effort); assert.equal(result.charge.pixels, price);
        const continuation = await beginLlmRequest({ body: { llmTier: tier, llmBatchContinuation: true } }, {}, 'unused');
        assert.equal(continuation.charge, null); assert.equal(continuation.inference.reasoning_effort, effort);
    }
    assert.deepEqual(charges, []);
});

test('selected global intent gains its reasoning profile without adding a cap to intentionally uncapped intent generation', async () => {
    const { creationInferenceForTier } = load('server/src/creationModelProfiles.ts');
    const raw = fs.readFileSync(path.join(root, 'server/src/IntentBlueprint.ts'), 'utf8');
    const source = ts.createSourceFile('IntentBlueprint.ts', raw, ts.ScriptTarget.Latest, true);
    const declaration = source.statements.filter(ts.isVariableStatement).flatMap(node => node.declarationList.declarations)
        .find(node => node.name.getText(source) === 'requestJson');
    assert.ok(declaration);
    const code = ts.transpileModule('const ' + declaration.getText(source) + ';\nexports.run = requestJson;', {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const requests = [], exports = {};
    new Function('exports', 'openai', 'recordOpenAiUsage', 'reasoningEffortForLanguageModel', 'isRecord', 'cleanJsonText', 'console', code)(exports,
        { chat: { completions: { create: async request => { requests.push(request); return { choices: [{ message: { content: '{"title":"A complete intent"}' } }] }; } } } },
        () => {}, () => undefined, value => value && typeof value === 'object', text => text, { log() {} });
    await exports.run('gpt-6-luna', 'Interpret the scenes.', {}, undefined, creationInferenceForTier('luna'));
    assert.equal(requests.at(-1).reasoning_effort, 'low');
    assert.ok(!('max_completion_tokens' in requests.at(-1)));
    await exports.run('gpt-6-luna', 'Summarise this scene.', {});
    assert.equal(requests.at(-1).reasoning_effort, undefined);
    assert.ok(!('max_completion_tokens' in requests.at(-1)));
});

test('opening a Terra world preserves Terra 6.1 selection for Three.js planning without rewriting saved world evidence', () => {
    const { planningModelSelection } = load('src/planningModelSelection.ts');
    const world = Object.freeze({ model: 'terra', revision: 'saved-world' });
    assert.equal(planningModelSelection(world.model), 'terra');
    assert.equal(world.model, 'terra'); assert.equal(world.revision, 'saved-world');
    assert.equal(planningModelSelection('luna'), 'luna');
    assert.equal(planningModelSelection('sol'), 'sol');
    assert.equal(planningModelSelection(undefined), 'luna');
});

test('Conversation, Three.js and Creation model pickers expose the locked model options, prices and OpenAI rates', () => {
    const { resolveConversationProfile } = load('server/src/conversationModels.ts');
    const { CONVERSATION_MODELS, DEFAULT_CONVERSATION_MODEL } = load('src/conversationModels.ts');
    const { LANGUAGE_MODELS, DEFAULT_LANGUAGE_MODEL, languageModelInfo } = load('src/languageModels.ts');
    const { LANGUAGE_MODEL_TIERS, isLanguageModelTier } = load('server/src/languageModels.ts');
    const { hasConfiguredModelPrice, getModelPricePerMillion } = load('server/src/aiUsageLedger.ts', {
        './db': { addPixelsToUser: async () => 0, getPixelsForUser: async () => 0, trySpendPixels: async () => true },
        './requestAuth': { authenticatedUserId: () => null },
    });
    assert.equal(DEFAULT_CONVERSATION_MODEL, 'luna');
    assert.equal(DEFAULT_LANGUAGE_MODEL, 'luna');
    assert.deepEqual(LANGUAGE_MODELS.map(model => [model.id, model.name, model.pixels, model.summary]), [
        ['luna', 'Luna', 1, 'Low reasoning'],
        ['luna_extra', 'Luna Extra', 2, 'High reasoning'],
        ['terra', 'Terra', 5, 'High reasoning'],
        ['sol', 'Sol', 15, 'High reasoning'],
        ['deepseek', 'DeepSeek', 2, 'Independent Replicate route'],
        ['kimi', 'Kimi', 4, 'Replicate reasoning route'],
    ]);
    assert.equal(languageModelInfo('terra').id, 'terra');
    assert.equal(languageModelInfo('terra').pixels, 5);
    assert.equal(resolveConversationProfile(undefined, 'gpt-6-luna').reasoningEffort, 'low');
    assert.equal(resolveConversationProfile('luna').reasoningEffort, 'low');
    assert.equal(resolveConversationProfile('luna_xhigh').reasoningEffort, 'medium');
    assert.equal(resolveConversationProfile('terra').tier, 'terra');
    assert.equal(resolveConversationProfile('terra').model, 'gpt-6.1-terra');
    assert.equal(resolveConversationProfile('terra').reasoningEffort, 'low');
    assert.equal(CONVERSATION_MODELS.find(model => model.id === 'luna_xhigh').name, 'Luna · Medium');
    assert.equal(CONVERSATION_MODELS.find(model => model.id === 'terra').name, 'Terra · Low');
    assert.equal(CONVERSATION_MODELS.find(model => model.id === 'sol_low'), undefined);
    assert.equal(isLanguageModelTier('luna_extra'), true);
    assert.equal(isLanguageModelTier('terra'), true);
    assert.deepEqual(LANGUAGE_MODEL_TIERS.luna, { provider: 'openai', model: 'gpt-6-luna', pixels: 1 });
    assert.deepEqual(LANGUAGE_MODEL_TIERS.luna_extra, { provider: 'openai', model: 'gpt-6-luna', pixels: 2 });
    assert.deepEqual(LANGUAGE_MODEL_TIERS.terra, { provider: 'openai', model: 'gpt-6.1-terra', pixels: 5 });
    assert.deepEqual(LANGUAGE_MODEL_TIERS.sol, { provider: 'openai', model: 'gpt-6.1-sol', pixels: 15 });

    // Every selectable OpenAI model has a verified rate in MODEL_PRICES_USD_PER_MILLION
    for (const model of ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol']) {
        assert.equal(hasConfiguredModelPrice(model), true, `Missing price for ${model}`);
    }
    assert.deepEqual(getModelPricePerMillion('gpt-6-luna'), { input: 0.1, cached: 0.01, cacheWrite30m: 0.125, output: 0.5 });
    assert.deepEqual(getModelPricePerMillion('gpt-6.1-terra'), { input: 1, cached: 0.05, cacheWrite30m: 1.25, output: 5 });
    assert.deepEqual(getModelPricePerMillion('gpt-6.1-sol'), { input: 2, cached: 0.1, cacheWrite30m: 2.5, output: 10 });
});

test('story cost estimates price the pacer separately while keeping paired Cinema stages together', () => {
    const { estimateStoryLlmPixels } = load('src/languageModels.ts');
    const normal = estimateStoryLlmPixels({ tier: 'terra', sceneCount: 3, cinemaMode: false, includeVideoAutoPrompts: true });
    assert.equal(normal.imagePromptOperations, 3);
    assert.equal(normal.imagePacerOperations, 3);
    assert.equal(normal.imagePacerPixels, 15);
    assert.equal(normal.totalOperations, 10);
    assert.equal(normal.totalPixels, 50);
    const cinema = estimateStoryLlmPixels({ tier: 'luna_extra', sceneCount: 4, cinemaMode: true, includeVideoAutoPrompts: false });
    assert.equal(cinema.imagePromptOperations, 2);
    assert.equal(cinema.imagePacerOperations, 2);
    assert.equal(cinema.imagePacerPixels, 4);
    assert.equal(cinema.totalPixels, 10);
    const empty = estimateStoryLlmPixels({ tier: 'luna', sceneCount: 0, cinemaMode: false, includeVideoAutoPrompts: true });
    assert.equal(empty.totalPixels, 0);
    assert.equal(empty.imagePacerOperations, 0);
});

test('new Creation tier remains compatible with independently priced spatial helpers', () => {
    const { spatialHelperPrice } = load('server/src/spatialHelperPricing.ts');
    const { spatialPlanningInference } = load('server/src/spatialPlanningInference.ts');
    assert.equal(spatialHelperPrice('luna_extra'), spatialHelperPrice('luna'));
    assert.deepEqual(spatialPlanningInference('luna_extra'), spatialPlanningInference('luna'));
    assert.deepEqual(spatialPlanningInference('terra'), spatialPlanningInference('luna'));
});
