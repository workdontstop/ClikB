import type OpenAI from 'openai';
import type { ConversationProfile } from './conversationModels';
import { buildConciergeCompletionRequest } from './ConciergeTools';
import { conciergeProviderMessages, logConciergeInputSizes } from './ConciergeContext';

/** Translate Responses events into the existing concierge stream contract.
 * The Jev/browser loop remains the only executor of returned function calls. */
export class ConciergeResponseSession {
    private readonly toolOutputs = new Map<string, any[]>();
    constructor(private readonly onStreamError?: (error: unknown) => void,
        private readonly onInput?: (label: string, items: any[], tools: any[], metadata: Record<string, unknown>) => void) {}

    async start(client: OpenAI, request: {
        profile: ConversationProfile; messages: any[]; tools: any[];
        bypassOpenAi: boolean; maxCompletionTokens: number;
    }): Promise<AsyncIterable<any>> {
        if (request.profile.reasoningEffort && !request.bypassOpenAi) return this.stream(client, request);
        // The existing Chat adapter owns Replicate's executable tool envelope.
        const messages = conciergeProviderMessages(request.messages);
        logConciergeInputSizes('chat-provider', messages, request.tools, { model: request.profile.model });
        this.onInput?.('chat-provider', messages, request.tools, { model: request.profile.model });
        return client.chat.completions.create(buildConciergeCompletionRequest({
            model: request.profile.model, messages,
            tools: request.tools, maxCompletionTokens: request.maxCompletionTokens,
        }) as any) as any;
    }

    private input(messages: any[]): any[] {
        return conciergeProviderMessages(messages).flatMap(message => {
            if (message.role === 'tool') return [{
                type: 'function_call_output', call_id: message.tool_call_id,
                output: String(message.content ?? ''),
            }];
            if (message.role === 'assistant' && message.tool_calls?.length) {
                const retained = this.toolOutputs.get(message.tool_calls[0].id);
                if (retained) return retained;
                return [
                    ...(message.content ? [{ role: 'assistant', content: String(message.content) }] : []),
                    ...message.tool_calls.map((call: any) => ({ type: 'function_call',
                        call_id: call.id, name: call.function.name, arguments: call.function.arguments })),
                ];
            }
            return [{ role: message.role, content: message.content ?? '' }];
        });
    }

    async *stream(client: OpenAI, request: {
        profile: ConversationProfile; messages: any[]; tools: any[];
    }): AsyncGenerator<any> {
        const input = this.input(request.messages);
        const tools = request.tools.map(tool => ({ type: 'function' as const, ...tool.function }));
        logConciergeInputSizes('responses-provider', input, tools, { model: request.profile.model });
        this.onInput?.('responses-provider', input, tools, { model: request.profile.model });
        const response = await client.responses.create({
            model: request.profile.model,
            reasoning: { effort: request.profile.reasoningEffort },
            input,
            store: false,
            include: ['reasoning.encrypted_content'],
            // The former 300/350/3000 limits were visible-answer budgets. Reasoning
            // needs its own room; existing prompts still bound spoken verbosity.
            max_output_tokens: 32000,
            ...(request.tools.length ? {
                tools,
                tool_choice: 'auto' as const, parallel_tool_calls: false,
            } : {}),
            stream: true,
        } as any);
        let completed: any = null;
        // Existing provider fallback can return a complete read-only response.
        if (!(Symbol.asyncIterator in Object(response))) {
            completed = response;
            if ((response as any).output_text) yield { choices: [{ delta: { content: (response as any).output_text } }] };
        } else {
            try { for await (const event of response as any) {
                if (event.type === 'response.output_text.delta') yield { choices: [{ delta: { content: event.delta } }] };
                if (event.type === 'response.completed') completed = event.response;
                if (event.type === 'response.failed' || event.type === 'response.incomplete') {
                    // Report usage even when no usable answer was produced; never replay the turn.
                    yield { usage: event.response?.usage, _clikbResponse: event.response };
                    if (event.type === 'response.incomplete') throw Object.assign(new Error('Concierge response did not complete.'),
                        { status: 422, code: 'clikb_incomplete_response' });
                    throw responseStreamError(event.response?.error);
                }
                if (event.type === 'error') throw responseStreamError(event);
            } } catch (error: any) {
                if (error?.code !== 'clikb_incomplete_response') this.onStreamError?.(error);
                throw error;
            }
        }
        if (!completed) throw new Error('Concierge stream ended without a completed response.');
        const outputs = completed.output || [];
        const calls = outputs.filter((item: any) => item.type === 'function_call');
        for (const call of calls) this.toolOutputs.set(call.call_id, outputs);
        if (calls.length) yield { choices: [{ delta: { tool_calls: calls.map((call: any, index: number) => ({
            index, id: call.call_id, type: 'function',
            function: { name: call.name, arguments: call.arguments },
        })) } }] };
        yield { usage: completed.usage, _clikbResponse: completed, choices: [{ delta: {}, finish_reason: calls.length ? 'tool_calls' : 'stop' }] };
    }
}

function responseStreamError(source: any): Error {
    const error = Object.assign(new Error(source?.message || 'Concierge stream failed.'), source || {});
    if (!(error as any).status && /^invalid_|^unsupported_|^context_length/.test(String(source?.code || ''))) (error as any).status = 400;
    return error;
}
