/** Exact generation tiers, rather than the five paired selector cards. */
export const EXAMPLE_IMAGE_MODELS = [
  'fluxUltra2', 'Imagen2', 'GPT Image 2.5 Sunburst', 'GPT Image 2.5 Flare',
  'Imagen', 'fluxUltra', 'minimax', 'minimax2', 'Schnell',
] as const;

export type ModelExampleImages = Record<string, string>;
export type ImageModelExampleSet = {
  id: string;
  name: string;
  model_images: ModelExampleImages;
  created_at?: string;
};

export function normalizeModelExampleImages(raw: unknown): ModelExampleImages {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const images: ModelExampleImages = {};
  for (const model of EXAMPLE_IMAGE_MODELS) {
    const url = (value as Record<string, unknown>)[model];
    if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) images[model] = url.trim();
  }
  return images;
}

/** Selection happens once on save, so every viewer sees the same saved samples. */
export function chooseModelExampleImages(
  candidates: Array<{ model: string; url: string }>, random: () => number = Math.random,
): ModelExampleImages {
  const groups = new Map<string, Set<string>>();
  for (const { model, url } of candidates) {
    if (!(EXAMPLE_IMAGE_MODELS as readonly string[]).includes(model) || !/^https?:\/\//i.test(url)) continue;
    if (!groups.has(model)) groups.set(model, new Set());
    groups.get(model)!.add(url);
  }
  return Object.fromEntries([...groups].map(([model, urls]) => {
    const choices = [...urls];
    return [model, choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]];
  }));
}

export function normalizeImageModels(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([url, model]) =>
    /^https?:\/\//i.test(url) && typeof model === 'string' && model.length > 0 && model.length <= 100)) as Record<string, string>;
}
