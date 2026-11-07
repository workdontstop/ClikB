import type { PlanningTier } from '../server/src/spatialWorld';

/** Preserve active selector preference (Luna, Terra 6.1, or Sol 6.1) without rewriting saved world/model evidence. */
export const planningModelSelection = (saved?: PlanningTier): PlanningTier =>
    saved === 'terra' ? 'terra' : saved === 'sol' ? 'sol' : saved === 'deepseek' ? 'deepseek' : saved === 'kimi' ? 'kimi' : 'luna';
