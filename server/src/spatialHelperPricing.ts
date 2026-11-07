import type { LanguageModelTier } from './languageModels';

/** Spatial AI work is priced independently from creation prompt writing. */
export const SPATIAL_HELPER_PRICES = {
    luna: 2, luna_extra: 2, terra: 5, sol_medium: 20, sol: 20, astra: 20, deepseek: 2, kimi: 4,
} as const satisfies Record<LanguageModelTier, number>;

export function spatialHelperPrice(tier: unknown): number {
    return typeof tier === 'string' && Object.prototype.hasOwnProperty.call(SPATIAL_HELPER_PRICES, tier)
        ? SPATIAL_HELPER_PRICES[tier as LanguageModelTier] : SPATIAL_HELPER_PRICES.luna;
}
