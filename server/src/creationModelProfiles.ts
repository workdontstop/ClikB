import type OpenAI from 'openai';
import type { LanguageModelTier } from './languageModels';

export type CreationInference = Pick<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    'reasoning_effort' | 'max_completion_tokens'>;

/** Only explicitly selected creation calls use these profiles. Fixed helpers do not. */
export function creationInferenceForTier(tier: LanguageModelTier): CreationInference {
    if (tier === 'luna' || tier === 'luna_extra' || tier === 'terra' || tier === 'sol_medium' || tier === 'sol') return {
        reasoning_effort: (
            tier === 'luna' ? 'low'
            : tier === 'sol_medium' ? 'medium'
            : 'high'
        ) as CreationInference['reasoning_effort'],
        // Reasoning shares the completion allowance with the finished prompt.
        max_completion_tokens: 32000,
    };
    return tier === 'astra' ? { reasoning_effort: 'low' } : {};
}
