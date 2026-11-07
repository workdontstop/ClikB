/** Shared template-only choices. Billing prices remain in the existing model registries. */
export const TEMPLATE_COVER_MODELS = {
  sd: { model: 'Schnell', route: 'fluxschnell', steps: 4, timeoutMs: 45_000, label: 'Klein' },
  hd: { model: 'GPT Image 2.5 Flare', route: 'GptImageFlare', steps: 35, timeoutMs: 120_000, label: 'GPT Image 2.6' },
  sd2: { model: 'minimax2', route: 'minimax2', steps: 35, timeoutMs: 120_000, label: 'Seedream 4.5' },
} as const;
export type TemplateCoverQuality = keyof typeof TEMPLATE_COVER_MODELS;
export const templateCoverQualityForRoute = (route: string): TemplateCoverQuality | undefined =>
  (Object.keys(TEMPLATE_COVER_MODELS) as TemplateCoverQuality[])
    .find(quality => `/${TEMPLATE_COVER_MODELS[quality].route}`.toLowerCase() === route.toLowerCase());
