const assert = require('node:assert/strict');
const {
  createRoutedTextClient,
  REPLICATE_DEEPSEEK_MODEL,
  REPLICATE_KIMI_MODEL,
  REPLICATE_GPT_5_2_MODEL,
  REPLICATE_GPT_5_4_MODEL,
  REPLICATE_GPT_4_1_MINI_MODEL,
  REPLICATE_QWEN_MODEL,
  replicateFallbackModelForPath,
  resetOpenAiAvailability,
  shouldBypassOpenAiForCurrentSession,
  shouldUseFalEmbeddingProvider,
  textGenerationRoutingMiddleware,
  withoutReplicateFallback,
} = require('../server/dist/backend/textGeneration.js');

function falEmbeddingSelection(path, body) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const req = { path, originalUrl: path, body };
    const res = {
      headersSent: false,
      setHeader: (key, value) => { headers[key] = value; },
      end: () => undefined,
      status: () => res,
      json: (value) => reject(new Error(`unexpected routing rejection: ${JSON.stringify(value)}`)),
    };
    textGenerationRoutingMiddleware(req, res, () => resolve(shouldUseFalEmbeddingProvider()));
  });
}

function inPageSession(sessionId, work, path = '/startBrainstorm', body = { conversationModel: 'luna' }, tierHeader) {
  return new Promise((resolve, reject) => {
    const req = {
      path,
      originalUrl: path,
      body,
      cookies: {},
      get: (name) => {
        const normalized = name.toLowerCase();
        if (normalized === 'x-clikb-ai-session') return sessionId;
        if (normalized === 'x-clikb-llm-tier') return tierHeader;
        return undefined;
      },
    };
    const res = {
      headersSent: false,
      cookie: () => undefined,
      setHeader: () => undefined,
      end: () => undefined,
      status: () => res,
      json: (value) => reject(new Error(`unexpected routing rejection: ${JSON.stringify(value)}`)),
    };
    textGenerationRoutingMiddleware(req, res, () => {
      Promise.resolve().then(work).then(resolve, reject);
    });
  });
}

async function strictReplicateRouteNeverCallsOpenAi(model) {
  let openAiCalls = 0;
  const fakeOpenAi = {
    chat: { completions: { create: async () => { openAiCalls += 1; throw new Error('OpenAI called'); } } },
    responses: { create: async () => { openAiCalls += 1; throw new Error('OpenAI called'); } },
  };
  const oldToken = process.env.REPLICATE_API_TOKEN;
  const oldRepliKey = process.env.REPLI_KEY;
  delete process.env.REPLICATE_API_TOKEN;
  delete process.env.REPLI_KEY;
  try {
    const client = createRoutedTextClient(fakeOpenAi);
    await assert.rejects(
      client.chat.completions.create({ model, messages: [{ role: 'user', content: 'test' }] }),
      (error) => error && error.code === 'replicate_not_configured',
    );
    assert.equal(openAiCalls, 0, `${model} must fail closed without touching OpenAI`);
  } finally {
    if (oldToken === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = oldToken;
    if (oldRepliKey === undefined) delete process.env.REPLI_KEY;
    else process.env.REPLI_KEY = oldRepliKey;
  }
}

(async () => {
  const { languageModelForTier, pixelsForTier } = require('../server/dist/backend/languageModels.js');
  assert.equal(languageModelForTier('sol'), 'gpt-6.1-sol');
  assert.equal(pixelsForTier('sol'), 15);

  // The creation picker must never replace result-tuned hidden route models.
  for (const [route, pinnedModel] of [
    ['/startStory', 'gpt-5.5'],
    ['/startPlan', 'gpt-5.2'],
    ['/startMemes', 'gpt-5.2'],
    ['/GptRemakeText', 'gpt-5.2'],
  ]) {
    const calls = [];
    const client = createRoutedTextClient({
      chat: { completions: { create: async (request) => { calls.push(request); return {}; } } },
      responses: { create: async (request) => { calls.push(request); return {}; } },
    });
    await inPageSession(`sol-hidden-${route.slice(1)}`, async () => {
      await client.chat.completions.create({ model: pinnedModel, messages: [] });
      await client.responses.create({ model: pinnedModel, input: [] });
    }, route, { llmTier: 'sol' }, 'sol');
    assert.equal(calls.length, 2);
    assert.ok(calls.every((request) => request.model === pinnedModel), `${route} must keep its pinned model`);
  }

  assert.equal(replicateFallbackModelForPath('/startStory'), REPLICATE_GPT_5_4_MODEL);
  assert.equal(replicateFallbackModelForPath('/startInteractions'), REPLICATE_GPT_5_4_MODEL);
  assert.equal(replicateFallbackModelForPath('/startMemes'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/startPlan'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/startPlanK'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/startPlanVid'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/generateCastingPrompts'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/extractCasting'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/intent-blueprint/compile-scene'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/intent-blueprint/reconcile-scene'), REPLICATE_DEEPSEEK_MODEL);
  assert.equal(replicateFallbackModelForPath('/GptRemake'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/GptRemakeText'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/GptRemakeSafe'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/GptRemakeKSafe'), REPLICATE_GPT_5_2_MODEL);
  assert.equal(replicateFallbackModelForPath('/narrateSummary'), REPLICATE_GPT_4_1_MINI_MODEL);
  assert.equal(replicateFallbackModelForPath('/GptTagger'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/EditGeneratedVisualTextOnly'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/ChatGPTApiDesign4'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/summary'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/ChatGPTApiAudio'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/examplestory'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/startPlanYou'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/startDesignYou'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/startDesignYouK'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/distillTemplate'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/GptArtstylePrompt'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/motion-guide/build'), REPLICATE_KIMI_MODEL);
  assert.equal(replicateFallbackModelForPath('/memory/summarizeSlot'), REPLICATE_QWEN_MODEL);
  assert.equal(replicateFallbackModelForPath('/startBrainstorm'), REPLICATE_DEEPSEEK_MODEL);
  assert.equal(await falEmbeddingSelection('/startBrainstorm', { conversationModel: 'deepseek' }), true);
  assert.equal(await falEmbeddingSelection('/startBrainstorm', { conversationModel: 'kimi' }), true);
  assert.equal(await falEmbeddingSelection('/startBrainstorm', { conversationModel: 'luna' }), false);
  assert.equal(await falEmbeddingSelection('/memory/summarizeSlot', { conversationModel: 'kimi' }), true);

  await strictReplicateRouteNeverCallsOpenAi(REPLICATE_DEEPSEEK_MODEL);
  await strictReplicateRouteNeverCallsOpenAi(REPLICATE_KIMI_MODEL);

  const previousToken = process.env.REPLICATE_API_TOKEN;
  const previousRepliKey = process.env.REPLI_KEY;
  delete process.env.REPLICATE_API_TOKEN;
  delete process.env.REPLI_KEY;
  try {
    let manuallySelectedHiddenOpenAiCalls = 0;
    const manuallySelectedHiddenClient = createRoutedTextClient({
      chat: { completions: { create: async () => {
        manuallySelectedHiddenOpenAiCalls += 1;
        return {};
      } } },
      responses: { create: async () => { throw new Error('unused'); } },
    });
    await assert.rejects(
      inPageSession(
        'manual-deepseek-hidden',
        () => manuallySelectedHiddenClient.chat.completions.create({ model: 'gpt-5.5', messages: [] }),
        '/startStory',
        { llmTier: 'deepseek' },
      ),
      (error) => error && error.code === 'replicate_not_configured',
    );
    assert.equal(manuallySelectedHiddenOpenAiCalls, 0, 'manual DeepSeek selection must keep hidden calls off OpenAI');
    await assert.rejects(
      inPageSession(
        'manual-kimi-hidden',
        () => manuallySelectedHiddenClient.chat.completions.create({ model: 'gpt-5.5', messages: [] }),
        '/startStory',
        {},
        'kimi',
      ),
      (error) => error && error.code === 'replicate_not_configured',
    );
    assert.equal(manuallySelectedHiddenOpenAiCalls, 0, 'manual Kimi selection header must keep hidden calls off OpenAI');

    let deferredOpenAiCalls = 0;
    const deferredImagePromptClient = createRoutedTextClient({
      chat: { completions: { create: async () => {
        deferredOpenAiCalls += 1;
        throw new Error('temporary image prompt timeout');
      } } },
      responses: { create: async () => { throw new Error('unused'); } },
    });
    await assert.rejects(
      inPageSession(
        'deferred-image-prompt-page',
        () => deferredImagePromptClient.chat.completions.create({ model: 'gpt-6-astra', messages: [] }),
        '/ImageDesignStory',
        { llmTier: 'astra', deferOpenAiProviderSwitch: true },
      ),
      /temporary image prompt timeout/,
    );
    assert.equal(deferredOpenAiCalls, 1);
    assert.equal(
      await inPageSession('deferred-image-prompt-page', shouldBypassOpenAiForCurrentSession),
      false,
      'a deferred Storybook image-prompt failure must not switch providers before retries are exhausted',
    );

    let failedPageOpenAiCalls = 0;
    const failedPageClient = createRoutedTextClient({
      chat: { completions: { create: async () => {
        failedPageOpenAiCalls += 1;
        throw new Error('temporary GPT connection failure');
      } } },
      responses: { create: async () => { throw new Error('unused'); } },
    });
    await assert.rejects(
      inPageSession('page-that-failed', () => failedPageClient.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] })),
      (error) => error && error.message === 'temporary GPT connection failure',
    );
    assert.equal(failedPageOpenAiCalls, 1);
    assert.equal(await inPageSession('page-that-failed', shouldBypassOpenAiForCurrentSession), true);
    assert.equal(await inPageSession('page-that-failed', shouldUseFalEmbeddingProvider), true);

    let sameRequestError;
    await inPageSession('same-request-must-stop', async () => {
      try {
        await failedPageClient.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] });
      } catch (error) {
        sameRequestError = error;
      }
      await assert.rejects(
        failedPageClient.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
        (error) => error === sameRequestError,
      );
    });
    assert.equal(failedPageOpenAiCalls, 2, 'a handler retry inside the failed request must not call any provider again');

    let freshPageOpenAiCalls = 0;
    const freshPageClient = createRoutedTextClient({
      chat: { completions: { create: async () => {
        freshPageOpenAiCalls += 1;
        return { choices: [{ message: { content: 'fresh page used Luna' } }] };
      } } },
      responses: { create: async () => { throw new Error('unused'); } },
    });
    const freshResult = await inPageSession(
      'new-page-after-reload',
      () => freshPageClient.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
    );
    assert.equal(freshPageOpenAiCalls, 1, 'a fresh page session must try OpenAI again');
    assert.equal(freshResult.choices[0].message.content, 'fresh page used Luna');
    assert.equal(await inPageSession('new-page-after-reload', shouldBypassOpenAiForCurrentSession), false);

    let finishOlderRequest;
    let raceCalls = 0;
    const racingClient = createRoutedTextClient({
      chat: { completions: { create: async () => {
        raceCalls += 1;
        if (raceCalls === 1) {
          return new Promise((resolve) => { finishOlderRequest = resolve; });
        }
        throw new Error('newer request failed');
      } } },
      responses: { create: async () => { throw new Error('unused'); } },
    });
    const olderRequest = inPageSession(
      'concurrent-page',
      () => racingClient.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(
      inPageSession(
        'concurrent-page',
        () => racingClient.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
      ),
      /newer request failed/,
    );
    finishOlderRequest({ choices: [{ message: { content: 'older success' } }] });
    await olderRequest;
    assert.equal(
      await inPageSession('concurrent-page', shouldBypassOpenAiForCurrentSession),
      true,
      'an older success must not clear a newer OpenAI failure',
    );
  } finally {
    if (previousToken === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = previousToken;
    if (previousRepliKey === undefined) delete process.env.REPLI_KEY;
    else process.env.REPLI_KEY = previousRepliKey;
  }

  let rateLimitCalls = 0;
  resetOpenAiAvailability();
  const rateLimited = createRoutedTextClient({
    chat: { completions: { create: async () => {
      rateLimitCalls += 1;
      throw Object.assign(new Error('slow down'), { code: 'rate_limit_exceeded' });
    } } },
    responses: { create: async () => { throw new Error('unused'); } },
  });
  await assert.rejects(
    rateLimited.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
    (error) => error && error.code === 'rate_limit_exceeded',
  );
  assert.equal(rateLimitCalls, 1, 'a GPT connection failure must stop after one OpenAI attempt');

  let blockedOpenAiCalls = 0;
  const circuitBroken = createRoutedTextClient({
    chat: { completions: { create: async () => { blockedOpenAiCalls += 1; return {}; } } },
    responses: { create: async () => { throw new Error('unused'); } },
  });
  await assert.rejects(
    circuitBroken.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
    (error) => error && error.code === 'replicate_not_configured',
  );
  assert.equal(blockedOpenAiCalls, 0, 'later calls must go directly to Replicate while the GPT circuit is closed');

  resetOpenAiAvailability();
  const manuallyRetried = await circuitBroken.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] });
  assert.deepEqual(manuallyRetried, {});
  assert.equal(blockedOpenAiCalls, 1, 'manual GPT selection should permit one fresh OpenAI attempt');

  let billingCalls = 0;
  resetOpenAiAvailability();
  const exhausted = createRoutedTextClient({
    chat: { completions: { create: async () => {
      billingCalls += 1;
      throw Object.assign(new Error('no credit'), { code: 'credit_balance_exhausted' });
    } } },
    responses: { create: async () => { throw new Error('unused'); } },
  });
  await assert.rejects(
    exhausted.chat.completions.create({ model: 'gpt-5.6-luna', messages: [] }),
    (error) => error && error.code === 'credit_balance_exhausted',
  );
  assert.equal(billingCalls, 1, 'billing exhaustion must stop after one OpenAI attempt');

  resetOpenAiAvailability();
  let responseCalls = 0;
  const failedResponseClient = createRoutedTextClient({
    chat: { completions: { create: async () => { throw new Error('unused'); } } },
    responses: { create: async () => {
      responseCalls += 1;
      throw Object.assign(new Error('responses API failed'), { code: 'response_failed' });
    } },
  });
  await assert.rejects(
    failedResponseClient.responses.create({ model: 'gpt-5.6-luna', input: 'test' }),
    (error) => error && error.code === 'response_failed',
  );
  assert.equal(responseCalls, 1, 'Responses API failure must not retry through Replicate');

  resetOpenAiAvailability();
  let directOpenAiCalls = 0;
  const noFallbackClient = createRoutedTextClient({
    chat: { completions: { create: async () => {
      directOpenAiCalls += 1;
      throw new Error('OpenAI timeout on text prompt');
    } } },
    responses: { create: async () => { throw new Error('unused'); } },
  });
  await inPageSession('no-fallback-test-page', async () => {
    await assert.rejects(
      withoutReplicateFallback(() => noFallbackClient.chat.completions.create({ model: 'gpt-6-luna', messages: [] })),
      /OpenAI timeout on text prompt/,
    );
  }, '/reconcilePreciseImagePrompt');
  assert.equal(directOpenAiCalls, 1, 'withoutReplicateFallback must prevent silent fallback to Replicate');

  console.log('textGenerationRouting: strict Replicate routes made 0 OpenAI calls');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
