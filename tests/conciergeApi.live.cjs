const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const enabled = process.env.CLIKB_RUN_LIVE_CONCIERGE === '1';

// Explicit opt-in: real API credits, no browser mutations or generated media.
// Use the production request builder, router, schemas and streamed-call parser.
test('live Concierge conversation and function/result protocol across selected providers', { skip: !enabled, timeout: 600000 }, async t => {
  require(path.join(root, 'server/node_modules/dotenv')).config({ path: path.join(root, 'server/.env') });
  const OpenAI = require(path.join(root, 'server/node_modules/openai'));
  const { buildConciergeCompletionRequest, CONCIERGE_TOOLS, accumulateToolCalls } = require('../server/dist/backend/ConciergeTools.js');
  const { createRoutedTextClient, resetOpenAiAvailability, getOpenAiAvailability, shouldBypassOpenAiForCurrentSession } = require('../server/dist/backend/textGeneration.js');
  const { resolveConversationProfile } = require('../server/dist/backend/conversationModels.js');
  const { ConciergeResponseSession } = require('../server/dist/backend/ConciergeInference.js');
  const tiers = process.env.CLIKB_LIVE_CONCIERGE_MODELS?.split(',') || ['luna', 'luna_xhigh', 'sol', 'deepseek', 'kimi'];
  assert.ok(tiers.every(tier => ['luna', 'luna_xhigh', 'sol', 'deepseek', 'kimi'].includes(tier)), 'Select supported Concierge profiles');
  assert.ok(process.env.DALLE_KEY, 'The backend OpenAI key must be configured');
  if (tiers.some(tier => tier === 'deepseek' || tier === 'kimi')) assert.ok(process.env.REPLICATE_API_TOKEN || process.env.REPLI_KEY, 'The backend Replicate key must be configured');
  const client = createRoutedTextClient(new OpenAI({ apiKey: process.env.DALLE_KEY, maxRetries: 0, timeout: 120000 }));
  resetOpenAiAvailability();
  async function complete(profile, messages, session) {
    const request = buildConciergeCompletionRequest({ model: profile.model, messages, tools: CONCIERGE_TOOLS, maxCompletionTokens: 1024 });
    const stream = await session.start(client, { profile, messages, tools: CONCIERGE_TOOLS,
      bypassOpenAi: shouldBypassOpenAiForCurrentSession(), maxCompletionTokens: request.max_completion_tokens });
    const calls = new Map(); let text = '';
    for await (const chunk of stream) {
      accumulateToolCalls(calls, chunk.choices?.[0]?.delta?.tool_calls || []);
      text += chunk.choices?.[0]?.delta?.content || '';
    }
    return { text, calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call) };
  }
  for (const tier of tiers) {
    await t.test(tier, async () => {
      const profile = resolveConversationProfile(tier), session = new ConciergeResponseSession();
      const greeting = await complete(profile, [{ role: 'system', content: 'This is a conversation test. Answer with a short greeting in ordinary text. There is no active app task; do not call a function.' }, { role: 'user', content: 'Hello!' }], session);
      assert.ok(greeting.text.trim(), 'Function-enabled requests must still allow conversation');
      assert.equal(greeting.calls.length, 0);
      const history = [{ role: 'system', content: 'This is a read-only function protocol regression. The user explicitly asks to observe the app. Call getCurrentSnapshot exactly once now. Do not mark an Auto Control task or mutate the app.' }, { role: 'user', content: 'Please get the current app snapshot.' }];
      const observation = await complete(profile, history, session);
      assert.equal(observation.calls.length, 1);
      assert.equal(observation.calls[0].function.name, 'getCurrentSnapshot');
      assert.deepEqual(JSON.parse(observation.calls[0].function.arguments), {});
      const result = await complete(profile, [...history,
        { role: 'assistant', content: observation.text || null, tool_calls: observation.calls },
        { role: 'tool', tool_call_id: observation.calls[0].id, content: JSON.stringify({ status: 'observed', snapshot: { route: '/settings', pageName: 'Settings', autoControl: { enabled: false } } }) },
        { role: 'system', content: 'The observed result is now available. Reply in ordinary text with the current page name and Auto Control state. Do not call any more functions.' },
      ], session);
      assert.equal(result.calls.length, 0);
      assert.match(result.text, /settings/i);
      assert.match(result.text, /off|disabled|false/i);
      assert.equal(getOpenAiAvailability().available, true);
      console.log(`PASS ${tier}: normal conversation, native/adapter snapshot function, correlated result and conversational reply; GPT stays available`);
    });
  }
});
