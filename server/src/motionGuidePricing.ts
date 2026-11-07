/** Minimum balance to start. Final motion billing uses raw measured provider cost. */
export const MOTION_GUIDE_PRICES = { luna: 1, terra: 1, sol: 1, deepseek: 1, kimi: 1 } as const;
export function motionGuidePrice(tier: keyof typeof MOTION_GUIDE_PRICES): number {
    return MOTION_GUIDE_PRICES[tier];
}
