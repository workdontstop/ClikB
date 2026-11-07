import type OpenAI from 'openai';
import type { LanguageModelTier } from './languageModels';

/** Reasoning policy for spatial Three.js planning and its context/refinement calls. */
export function spatialPlanningInference(tier: LanguageModelTier): Pick<
    OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    'reasoning_effort' | 'max_completion_tokens'
> {
    if (tier === 'luna' || tier === 'luna_extra' || tier === 'terra' || tier === 'sol' || tier === 'sol_medium') {
        return {
            reasoning_effort: 'low' as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['reasoning_effort'],
            // Completion limits include reasoning tokens as well as JSON output.
            max_completion_tokens: 60000,
        };
    }
    // Preserve the existing Astra policy and other providers' request contracts.
    return tier === 'astra' ? { reasoning_effort: 'low' } : {};
}
