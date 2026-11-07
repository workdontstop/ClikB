import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConciergeCompletionRequest, CONCIERGE_TOOLS } from './ConciergeTools';
import { createRoutedTextClient, getOpenAiAvailability, isOpenAiProviderError, resetOpenAiAvailability, textGenerationRoutingMiddleware, reportOpenAiTextStreamFailure } from './textGeneration';
import { ConciergeResponseSession } from './ConciergeInference';
import { resolveConversationProfile } from './conversationModels';

const messages = [{ role: 'user', content: 'Open Models and select Nano Banana Pro' }];

const inSession = (id: string, work: (headers: Record<string, unknown>, end: () => void) => Promise<void>) => new Promise<void>((resolve, reject) => {
  const headers: Record<string, unknown> = {};
  const req: any = { path: '/startBrainstormStream', body: { conversationModel: 'luna' }, get: (name: string) => name.toLowerCase() === 'x-clikb-ai-session' ? id : undefined };
  const res: any = { headersSent: false, setHeader: (name: string, value: unknown) => { headers[name] = value; }, end: () => undefined };
  textGenerationRoutingMiddleware(req, res, () => { work(headers, () => res.end()).then(resolve, reject); });
});

for (const model of ['gpt-6-luna', 'gpt-5.6-terra']) test(`Concierge ${model} request satisfies the live function endpoint requirement without forcing calls`, async () => {
  const request = buildConciergeCompletionRequest({ model, messages, tools: CONCIERGE_TOOLS, maxCompletionTokens: 3000 });
  const received: any[] = [];
  const client = createRoutedTextClient({ chat: { completions: { create: async (request: any) => {
    received.push(request);
    if (request.tools.length && request.reasoning_effort !== 'none') throw Object.assign(new Error('Function tools require reasoning_effort none'), { status: 400, param: 'reasoning_effort' });
    return { choices: [{ message: { content: 'I can help you choose a model.' } }] };
  } } } } as any);
  await inSession(`concierge-valid-functions-${model}`, async () => {
    const response: any = await client.chat.completions.create(request as any);
    assert.equal(response.choices[0].message.content, 'I can help you choose a model.');
    assert.equal(getOpenAiAvailability().available, true);
  });
  assert.equal(received.length, 1);
  assert.equal(received[0].tool_choice, 'auto');
  assert.equal(received[0].parallel_tool_calls, false);
});

test('plain chat, automatic updates and Replicate models retain their existing reasoning settings', () => {
  for (const [model, tools] of [['gpt-6-luna', []], ['gpt-5.6-terra', []], ['deepseek-ai/deepseek-v3.1', CONCIERGE_TOOLS], ['moonshotai/kimi-k2.6', CONCIERGE_TOOLS]] as const) {
    const request = buildConciergeCompletionRequest({ model, messages, tools: [...tools], maxCompletionTokens: 350 });
    assert.ok(!('reasoning_effort' in request));
    if (!tools.length) assert.ok(!('tools' in request));
  }
});

test('HTTP 400/422 request errors preserve GPT availability and do not issue a DeepSeek notice', async () => {
  for (const endpoint of ['chat', 'responses']) for (const status of [400, 422]) {
    let attempts = 0;
    const error = Object.assign(new Error('Invalid function request'), { status, param: 'reasoning_effort' });
    const create = async () => { if (++attempts === 1) throw error; return {}; };
    const client = createRoutedTextClient({ chat: { completions: { create } }, responses: { create } } as any);
    await inSession(`concierge-request-error-${endpoint}-${status}`, async (headers, end) => {
      resetOpenAiAvailability();
      const call = () => endpoint === 'chat' ? client.chat.completions.create({ model: 'gpt-6-luna', messages: [] }) : client.responses.create({ model: 'gpt-6-luna', input: 'hello' });
      await assert.rejects(call(), candidate => candidate === error);
      assert.equal(getOpenAiAvailability().available, true);
      assert.equal(isOpenAiProviderError(error), false);
      assert.deepEqual(await call(), {});
      end();
      assert.equal(headers['X-ClikB-OpenAI-Available'], '1');
      assert.equal(headers['X-ClikB-AI-Notice'], undefined);
    });
    assert.equal(attempts, 2);
  }
});

test('real provider, quota and billing failures retain the existing fallback rule', () => {
  for (const error of [{ status: 429 }, { status: 503 }, { status: 401 }, { code: 'credit_balance_exhausted', status: 400 }, { code: 'insufficient_quota', status: 400 }, new Error('Connection failure')]) {
    assert.equal(isOpenAiProviderError(error), true);
  }
});

test('streamed quota failures update availability without replay; invalid requests and output exhaustion do not', async () => {
  for (const [kind, code, unavailable] of [
    ['response.failed', 'insufficient_quota', true], ['error', 'server_error', true],
    ['error', 'invalid_prompt', false], ['response.incomplete', 'clikb_incomplete_response', false],
  ] as const) await inSession(`stream-failure-${code}`, async (headers, end) => {
    resetOpenAiAvailability(); let attempts = 0;
    const client: any = { responses: { create: async () => {
      attempts++;
      return (async function* () { yield kind === 'error' ? { type: kind, code, message: code }
        : { type: kind, response: { error: { code, message: code }, usage: { input_tokens: 1, output_tokens: 2 } } }; })();
    } } };
    const session = new ConciergeResponseSession(error => reportOpenAiTextStreamFailure(error, 'gpt-6-luna'));
    await assert.rejects(async () => {
      for await (const _chunk of session.stream(client, { profile: resolveConversationProfile('luna')!, messages, tools: CONCIERGE_TOOLS })) { /* consume */ }
    });
    assert.equal(attempts, 1); assert.equal(getOpenAiAvailability().available, !unavailable);
    end(); assert.equal(headers['X-ClikB-OpenAI-Available'], unavailable ? '0' : '1');
  });
});
