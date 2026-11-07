import assert from 'node:assert/strict';
import test from 'node:test';
import { ConciergeResponseSession } from './ConciergeInference';
import { resolveConversationProfile } from './conversationModels';
import { CONCIERGE_TOOLS } from './ConciergeTools';

const messages = [{ role: 'system', content: 'Use actual app state.' }, { role: 'user', content: 'Open Cinema and stop before publishing.' }];
const reasoning = { id: 'rs_1', type: 'reasoning', encrypted_content: 'opaque_reasoning', summary: [] };
const call = { id: 'fc_1', type: 'function_call', call_id: 'call_1', name: 'getCurrentSnapshot', arguments: '{}' };
const complete = (output: any[]) => ({ type: 'response.completed', response: {
    status: 'completed', output, usage: { input_tokens: 150, output_tokens: 100,
        output_tokens_details: { reasoning_tokens: 80 } },
} });

for (const [tier, model, effort] of [
    ['luna', 'gpt-6-luna', 'low'], ['luna_xhigh', 'gpt-6-luna', 'medium'], ['sol', 'gpt-6.1-sol', 'medium'],
]) test(`${tier} preserves function IDs, reasoning context and usage through the existing control contract`, async () => {
    const requests: any[] = [];
    const batches = [[{ type: 'response.output_item.done', item: call }, complete([reasoning, call])],
        [{ type: 'response.output_text.delta', delta: 'Cinema is open.' }, complete([])]];
    const client: any = { responses: { create: async (request: any) => {
        requests.push(request); const events = batches.shift()!;
        return (async function* () { for (const event of events) yield event; })();
    } } };
    const session = new ConciergeResponseSession(), profile = resolveConversationProfile(tier)!;
    const first = [];
    for await (const chunk of session.stream(client, { profile, messages, tools: CONCIERGE_TOOLS })) first.push(chunk);
    const calls = first.flatMap(chunk => chunk.choices?.[0]?.delta?.tool_calls || []);
    assert.equal(calls.length, 1); assert.equal(calls[0].id, 'call_1');
    assert.equal(calls[0].function.arguments, '{}');
    const nextMessages = [...messages, { role: 'assistant', content: null, tool_calls: calls },
        { role: 'tool', tool_call_id: 'call_1', content: JSON.stringify({ status: 'observed', snapshot: { mode: 'cinema' } }) }];
    const second = [];
    for await (const chunk of session.stream(client, { profile, messages: nextMessages, tools: CONCIERGE_TOOLS })) second.push(chunk);
    for (const request of requests) {
        assert.equal(request.model, model); assert.deepEqual(request.reasoning, { effort });
        assert.equal(request.store, false); assert.equal(request.parallel_tool_calls, false);
        assert.equal(request.tools[0].name, 'virtualGate'); assert.ok(!('function' in request.tools[0]));
        assert.equal(request.max_output_tokens, 32000);
    }
    assert.ok(requests[1].input.includes(reasoning)); assert.ok(requests[1].input.includes(call));
    assert.deepEqual(requests[1].input.at(-1), { type: 'function_call_output', call_id: 'call_1',
        output: JSON.stringify({ status: 'observed', snapshot: { mode: 'cinema' } }) });
    assert.equal(second[0].choices[0].delta.content, 'Cinema is open.');
    assert.equal(second.at(-1)?.usage.output_tokens_details.reasoning_tokens, 80);
});

test('observation-only turns have no function tools and never expose reasoning as speech', async () => {
    let request: any;
    const client: any = { responses: { create: async (body: any) => {
        request = body;
        return (async function* () {
            yield { type: 'response.reasoning_summary_text.delta', delta: 'private thought' };
            yield { type: 'response.output_text.delta', delta: 'The images are ready.' };
            yield complete([reasoning]);
        })();
    } } };
    const chunks = [];
    for await (const chunk of new ConciergeResponseSession().stream(client,
        { profile: resolveConversationProfile('luna_xhigh')!, messages, tools: [] })) chunks.push(chunk);
    assert.ok(!('tools' in request)); assert.ok(!('tool_choice' in request));
    assert.equal(chunks.map(chunk => chunk.choices?.[0]?.delta?.content || '').join(''), 'The images are ready.');
});

test('an incomplete stream reports billed usage without dispatching partial functions or retrying', async () => {
    let attempts = 0; const chunks: any[] = [];
    const client: any = { responses: { create: async () => {
        attempts++;
        return (async function* () {
            yield { type: 'response.output_item.done', item: call };
            yield { type: 'response.incomplete', response: { usage: { input_tokens: 100, output_tokens: 32000 } } };
        })();
    } } };
    await assert.rejects(async () => {
        for await (const chunk of new ConciergeResponseSession().stream(client,
            { profile: resolveConversationProfile('sol')!, messages, tools: CONCIERGE_TOOLS })) chunks.push(chunk);
    }, /did not complete/);
    assert.equal(attempts, 1); assert.equal(chunks.at(-1).usage.output_tokens, 32000);
    assert.equal(chunks.flatMap(chunk => chunk.choices?.[0]?.delta?.tool_calls || []).length, 0);
});

test('retired preferences resolve safely and arbitrary model IDs are rejected', () => {
    assert.equal(resolveConversationProfile('terra')?.model, 'gpt-6.1-sol');
    assert.equal(resolveConversationProfile('gpt-6-astra'), null);
    assert.equal(resolveConversationProfile(undefined, 'gpt-6-luna')?.reasoningEffort, 'low');
    assert.equal(resolveConversationProfile('deepseek')?.reasoningEffort, undefined);
    assert.equal(resolveConversationProfile('kimi')?.reasoningEffort, undefined);
});

test('known provider fallback keeps the existing executable Chat tool protocol for every reasoning profile', async () => {
    for (const tier of ['luna', 'luna_xhigh', 'sol']) {
        const requests: any[] = [];
        const client: any = {
            responses: { create: async () => assert.fail('Fallback must use the existing Replicate tool adapter') },
            chat: { completions: { create: async (request: any) => {
                requests.push(request);
                return (async function* () { yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'fallback_call', type: 'function',
                    function: { name: 'getCurrentSnapshot', arguments: '{}' } }] } }] }; })();
            } } },
        };
        const stream = await new ConciergeResponseSession().start(client, { profile: resolveConversationProfile(tier)!,
            messages, tools: CONCIERGE_TOOLS, bypassOpenAi: true, maxCompletionTokens: 3000 });
        const chunks = []; for await (const chunk of stream) chunks.push(chunk);
        assert.equal(requests.length, 1); assert.equal(requests[0].tools[0].function.name, 'virtualGate');
        assert.equal(chunks[0].choices[0].delta.tool_calls[0].id, 'fallback_call');
    }
});
