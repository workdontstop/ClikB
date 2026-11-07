/**
 * Canonical image-model metadata used by selection, routing, pricing, and
 * coverage UI. Registry keys are persisted in post data; routes stay internal.
 */
export const GPT_IMAGE_2_LEGACY = "Gpt Image" as const;
export const GPT_IMAGE_25_SUNBURST = "GPT Image 2.5 Sunburst" as const;
export const GPT_IMAGE_25_FLARE = "GPT Image 2.5 Flare" as const;
export const DEFAULT_IMAGE_MODEL = GPT_IMAGE_25_FLARE;

// Flat output estimates for the most expensive current size (1440x1440), at $30/M:
// Flare medium: 587 tokens -> $0.0177 after FAL rounding -> ceil(333 * cost) = 6 P.
// Sunburst high: 2,347 tokens -> $0.0705 after FAL rounding -> 24 P.
// Reference/text input costs are excluded. See docs/CREATION_REGRESSION_FIXES.md.
export const GPT_IMAGE_25_FLARE_PIXEL_COST = 6 as const;
export const GPT_IMAGE_25_SUNBURST_PIXEL_COST = 24 as const;

export const IMAGE_MODEL_REGISTRY = {
    Schnell: { displayName: "Klein", pixelCost: 1, coverage: true },
    "Hi Dream": { displayName: "Hi Dream", pixelCost: 3, coverage: false },
    minimax: { displayName: "Seedream 5 Pro", pixelCost: 23, coverage: true },
    minimax2: { displayName: "Seedream 4.5", pixelCost: 14, coverage: true },
    Imagen: { displayName: "Nano Banana 2.1", pixelCost: 48, coverage: true },
    fluxUltra: { displayName: "Nano Banana 2 Lite", pixelCost: 17, coverage: true },
    fluxUltra2: { displayName: "Nano Banana Pro", pixelCost: 56, coverage: true },
    Imagen2: { displayName: "Nano Banana", pixelCost: 14, coverage: true },
    seeDream: { displayName: "SeeDream", pixelCost: 11, coverage: false },
    fluxDev: { displayName: "Reve", pixelCost: 9, coverage: false },
    Bannana: { displayName: "Banana Pro", pixelCost: 56, coverage: false },
    Bannana2: { displayName: "Banana", pixelCost: 14, coverage: false },
    Imagenx: { displayName: "Imagen", pixelCost: 21, coverage: false },
    [GPT_IMAGE_2_LEGACY]: {
        displayName: "GPT Image 2",
        pixelCost: 17,
        coverage: false,
        route: "GptImage",
        quality: "medium",
    },
    [GPT_IMAGE_25_FLARE]: {
        displayName: "GPT Image 2.6 Flare",
        pixelCost: GPT_IMAGE_25_FLARE_PIXEL_COST,
        coverage: true,
        route: "GptImageFlare",
        quality: "medium",
    },
    [GPT_IMAGE_25_SUNBURST]: {
        displayName: "GPT Image 2.6 Sunburst",
        pixelCost: GPT_IMAGE_25_SUNBURST_PIXEL_COST,
        coverage: true,
        route: "GptImageSunburst",
        quality: "high",
    },
} as const;

export type ImageModelKey = keyof typeof IMAGE_MODEL_REGISTRY;

/** Mirrors the card/tier order in ModelSelectionModal. */
export const ACTIVE_IMAGE_MODEL_KEYS: ImageModelKey[] = [
    "fluxUltra2",
    "Imagen2",
    GPT_IMAGE_25_SUNBURST,
    GPT_IMAGE_25_FLARE,
    "Imagen",
    "fluxUltra",
    "minimax",
    "minimax2",
    "Schnell",
];

export const GPT_IMAGE_MODEL_KEYS = [
    GPT_IMAGE_2_LEGACY,
    GPT_IMAGE_25_FLARE,
    GPT_IMAGE_25_SUNBURST,
] as const;

export function isGptImageModel(model: string | null | undefined): boolean {
    return GPT_IMAGE_MODEL_KEYS.includes(model as (typeof GPT_IMAGE_MODEL_KEYS)[number]);
}

export function getGptImageRoute(model: string | null | undefined): string | null {
    if (!model || !isGptImageModel(model)) return null;
    return (IMAGE_MODEL_REGISTRY[model as (typeof GPT_IMAGE_MODEL_KEYS)[number]] as { route: string }).route;
}

export function getImageModelPixelCost(model: string): number | null {
    const direct = IMAGE_MODEL_REGISTRY[model as ImageModelKey];
    if (direct) return direct.pixelCost;

    const slug = model.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const matchedKey = (Object.keys(IMAGE_MODEL_REGISTRY) as ImageModelKey[]).find(
        (key) => key.replace(/[^a-z0-9]/gi, "").toLowerCase() === slug || IMAGE_MODEL_REGISTRY[key].displayName.replace(/[^a-z0-9]/gi, "").toLowerCase() === slug
    );
    return matchedKey ? IMAGE_MODEL_REGISTRY[matchedKey].pixelCost : null;
}

export function getImageModelDisplayName(model: string): string {
    return IMAGE_MODEL_REGISTRY[model as ImageModelKey]?.displayName ?? model;
}

/** Use the model's registered name consistently in results and example sets. */
export function getCreationImageModelName(model: string): string {
    return getImageModelDisplayName(model);
}

/** Some legacy/fallback routes use a different model from the selected option. */
export function imageModelForGenerationRoute(route: string, reportedModel?: unknown): string {
    if (route === 'fluxschnell' && reportedModel === 'fal-nano-banana-pro-edit') return 'fluxUltra2';
    return ({ fluxschnell: 'Schnell', Bannana: 'Imagen', Bannana2: 'Imagen2',
        GptImageSunburst: GPT_IMAGE_25_SUNBURST, GptImageFlare: GPT_IMAGE_25_FLARE,
        GptImage: GPT_IMAGE_2_LEGACY, HiDream: 'Hi Dream' } as Record<string, string>)[route] || route;
}
