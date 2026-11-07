/** Shared browser/server contract for edits to the current image. Coordinates
 * are fractions of the source image, with (0, 0) at its top-left corner. */
export type PreciseModel = 'flare' | 'sunburst' | 'krea';
export type PreciseRegion = { id: string; x: number; y: number; width: number; height: number; note: string };
export type PreciseReference = { name: string; url: string };
export const PRECISE_MODEL_NAMES: Record<PreciseModel, string> = {
  flare: 'GPT Image 2.6 Flare', sunburst: 'GPT Image 2.6 Sunburst', krea: 'Krea 3',
};
export const PRECISE_MAX_PIXELS = 4_220_160;
export const PRECISE_MAX_REGIONS = 8;
export const PRECISE_MAX_REFERENCES = 7;
export const PRECISE_MAX_NOTE_LENGTH = 2000;

export function preciseModel(value: unknown): PreciseModel {
  if (value !== 'flare' && value !== 'sunburst' && value !== 'krea') throw new Error('Choose Flare, Sunburst, or Krea 3.');
  return value;
}

export function preciseDimensions(width: unknown, height: unknown): { width: number; height: number } {
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 1 || height < 1 || width * height > PRECISE_MAX_PIXELS) {
    throw new Error('The image must have valid dimensions and at most 4,220,160 pixels.');
  }
  return { width, height };
}

export function preciseReferenceCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > PRECISE_MAX_REFERENCES) {
    throw new Error('Choose up to seven extra image references.');
  }
  return value;
}

/** Krea estimates render area from the verified source canvas and assumes every
 * reference is capped to that area. Regional auto preserves the source canvas;
 * provider-internal render rounding can differ from this estimate. The server
 * normalizes references to the quoted ceiling before submitting the edit. */
export function preciseEditPixels(modelValue: unknown, width: number, height: number, extraRefCount = 0): number {
  const model = preciseModel(modelValue);
  preciseDimensions(width, height);
  const references = preciseReferenceCount(extraRefCount);
  if (model === 'flare') return 6;
  if (model === 'sunburst') return 24;
  return Math.ceil(333 * (0.125 + 0.025 * (width * height / 1_000_000) * (2 + references)));
}

export function preciseRegions(value: unknown): PreciseRegion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > PRECISE_MAX_REGIONS) throw new Error('Draw one to eight edit regions.');
  const ids = new Set<string>();
  const regions: PreciseRegion[] = value.map((entry: any) => {
    if (!entry || typeof entry !== 'object') throw new Error('An edit region is invalid.');
    const { x, y, width, height } = entry;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const note = typeof entry.note === 'string' ? entry.note.trim() : '';
    if (!id || id.length > 80 || ids.has(id)) throw new Error('Every edit region needs a unique identifier.');
    ids.add(id);
    if (![x, y, width, height].every(n => typeof n === 'number' && Number.isFinite(n)) || x < 0 || y < 0 || x >= 1 || y >= 1 || width <= 0 || height <= 0
      || x + width > 1.00000001 || y + height > 1.00000001) throw new Error('Edit regions must fit inside the image.');
    if (!note || note.length > PRECISE_MAX_NOTE_LENGTH) throw new Error('Each region needs an instruction of at most 2,000 characters.');
    return { id, x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y), note };
  });
  // Match the editor's numerical tolerance: touching edges are allowed, but
  // positive interior intersections cannot assign competing edit instructions.
  for (let index = 0; index < regions.length; index++) {
    const a = regions[index];
    for (let other = index + 1; other < regions.length; other++) {
      const b = regions[other];
      if (a.x < b.x + b.width - 1e-7 && a.x + a.width > b.x + 1e-7
        && a.y < b.y + b.height - 1e-7 && a.y + a.height > b.y + 1e-7) {
        throw new Error('Edit regions cannot overlap. Move or resize the regions apart.');
      }
    }
  }
  return regions;
}
