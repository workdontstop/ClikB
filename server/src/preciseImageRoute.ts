import type { NextFunction, Request, Response } from 'express';
import { fal } from '@fal-ai/client';
import { Jimp } from 'jimp';
import { readPublicImageBytes, storeNormalizedImage } from './S3Routes';
import { PRECISE_MODEL_NAMES, PRECISE_MAX_REFERENCES, preciseDimensions, preciseEditPixels, preciseModel, preciseReferenceCount, preciseRegions,
  type PreciseModel, type PreciseReference, type PreciseRegion } from './preciseEditSpec';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
type RasterImage = { width: number; height: number; dataUrl: string };
type PreparedEdit = { model: PreciseModel; source: RasterImage; references: PreciseReference[]; regions: PreciseRegion[] };
type ImageDependencies = {
  readBytes: (url: string, maxBytes: number) => Promise<Buffer>;
  subscribe: (endpoint: string, input: Record<string, unknown>) => Promise<any>;
  persist: (url: string) => Promise<{ imageUrl: string }>;
};

const imageUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_IMAGE_BYTES * 1.4) throw new Error('An image URL is required.');
  const url = value.trim();
  if (/^data:image\/(?:png|jpeg|gif|bmp);base64,/i.test(url)) return url;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('The image URL is invalid.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || url.length > 8192) throw new Error('Use a public HTTP(S) image URL.');
  return url;
};

/** Inspect dimensions before decoding compressed pixels, so a small compressed
 * file cannot make the image decoder allocate an unbounded bitmap. */
export function preciseRasterDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return preciseDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return preciseDimensions(bytes.readUInt16LE(6), bytes.readUInt16LE(8));
  if (bytes.length >= 26 && bytes.toString('ascii', 0, 2) === 'BM') return preciseDimensions(bytes.readInt32LE(18), Math.abs(bytes.readInt32LE(22)));
  if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7) {
        return preciseDimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3));
      }
      offset += length;
    }
  }
  throw new Error('Use a PNG, JPEG, GIF, or BMP image for a precise edit.');
}

export async function loadPreciseImage(urlValue: unknown, readBytes: ImageDependencies['readBytes'] = readPublicImageBytes,
  ceilingPixels?: number): Promise<RasterImage> {
  const url = imageUrl(urlValue);
  const bytes = url.startsWith('data:') ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64') : await readBytes(url, MAX_IMAGE_BYTES);
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('The image is too large to edit.');
  const metadata = preciseRasterDimensions(bytes);
  const image = await Jimp.read(bytes);
  // JPEG EXIF orientation may rotate the decoded image; its area must remain
  // exactly the verified compressed-header area.
  if (image.bitmap.width * image.bitmap.height !== metadata.width * metadata.height) throw new Error('The image dimensions could not be verified.');
  // Billing caps each reference at output area. Freeze those exact pixels in a
  // data URI rather than letting a mutable external URL change after probing.
  if (ceilingPixels && metadata.width * metadata.height > ceilingPixels) {
    const ratio = Math.sqrt(ceilingPixels / (metadata.width * metadata.height));
    image.resize({ w: Math.max(1, Math.floor(image.bitmap.width * ratio)), h: Math.max(1, Math.floor(image.bitmap.height * ratio)) });
  }
  return { width: image.bitmap.width, height: image.bitmap.height, dataUrl: `data:image/png;base64,${(await image.getBuffer('image/png')).toString('base64')}` };
}

export async function preciseMask(width: number, height: number, regions: PreciseRegion[]): Promise<string> {
  preciseDimensions(width, height);
  const mask = new Jimp({ width, height, color: 0x000000ff });
  for (const region of regions) {
    const left = Math.floor(region.x * width), top = Math.floor(region.y * height);
    const right = Math.min(width, Math.ceil((region.x + region.width) * width));
    const bottom = Math.min(height, Math.ceil((region.y + region.height) * height));
    mask.scan(left, top, right - left, bottom - top, (_x, _y, index) => {
      mask.bitmap.data[index] = mask.bitmap.data[index + 1] = mask.bitmap.data[index + 2] = 255;
    });
  }
  return `data:image/png;base64,${(await mask.getBuffer('image/png')).toString('base64')}`;
}

export async function preciseProviderRequest(edit: PreparedEdit): Promise<{ endpoint: string; input: Record<string, unknown> }> {
  const { model, source, references, regions } = edit;
  const regionInstructions = regions.map((r, index) => `Region ${index + 1} (left ${r.x}, top ${r.y}, width ${r.width}, height ${r.height}): ${r.note}`).join('\n');
  const referenceInstructions = references.map((reference, index) => `${model === 'krea' ? `<image-${index + 2}>` : `Reference image ${index + 2}`}: ${reference.name}`).join('\n');
  const input: Record<string, unknown> = {
    image_urls: [source.dataUrl, ...references.map(reference => reference.url)],
    image_size: { width: source.width, height: source.height },
    output_format: 'png',
    prompt: `Edit only the specified regions of the first image. Preserve everything outside those regions, including the camera, framing, subject identity, lighting, and composition. Apply each region's instruction only to that region. Additional images are named visual references, never replacement canvases.\n${referenceInstructions}\n${regionInstructions}`,
  };
  if (model === 'krea') {
    // Krea's regional_edit contract keeps the original canvas with auto;
    // an explicit image_size first resizes it to the provider's 16px grid.
    // https://fal.ai/models/krea/v3/edit/api
    input.image_size = 'auto';
    input.model = 'berry';
    input.reasoning_level = 'high';
    input.regional_edit = true;
    input.regions = regions.map((region, index) => ({ image_idx: 0, x: region.x, y: region.y, width: region.width, height: region.height, label: `region${index + 1}`, note: region.note }));
    return { endpoint: 'krea/v3/edit', input };
  }
  input.quality = model === 'flare' ? 'medium' : 'high';
  input.num_images = 1;
  input.mask_url = await preciseMask(source.width, source.height, regions);
  return { endpoint: `openai/gpt-image-2.6/${model}/edit`, input };
}

export function createPreciseImageHandlers(overrides: Partial<ImageDependencies> = {}) {
  const dependencies: ImageDependencies = {
    readBytes: readPublicImageBytes,
    subscribe: (endpoint, input) => fal.subscribe(endpoint as any, { input } as any),
    persist: url => storeNormalizedImage(url, 'precise-image'),
    ...overrides,
  };
  const prepared = new WeakMap<Request, PreparedEdit>();
  const validate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const body = req.body || {};
      const model = preciseModel(body.model);
      const requestedSize = preciseDimensions(body.width, body.height);
      const regions = preciseRegions(body.regions);
      if (body.billingAction !== 'precise-image') throw new Error('Invalid precise image billing action.');
      const rawReferences = body.references === undefined ? [] : body.references;
      if (!Array.isArray(rawReferences) || rawReferences.length > PRECISE_MAX_REFERENCES) throw new Error('Choose up to seven extra image references.');
      const references = rawReferences.map((reference: any): PreciseReference => {
        if (typeof reference?.name !== 'string' || !reference.name.trim() || reference.name.length > 120) throw new Error('Each reference needs a name of at most 120 characters.');
        return { name: reference.name.trim(), url: imageUrl(reference.url) };
      });
      const source = await loadPreciseImage(body.imageUrl, dependencies.readBytes);
      if (requestedSize.width !== source.width || requestedSize.height !== source.height) throw new Error('The source image dimensions changed. Reopen Precise and try again.');
      // Sequential decoding bounds peak memory even with seven references.
      const boundedReferences: PreciseReference[] = [];
      for (const reference of references) {
        const image = await loadPreciseImage(reference.url, dependencies.readBytes, source.width * source.height);
        boundedReferences.push({ name: reference.name, url: image.dataUrl });
      }
      prepared.set(req, { model, source, references: boundedReferences, regions });
      // Replace caller-owned billable fields with exactly the validated values
      // before withMediaBilling reserves any pixels or executes the provider.
      req.body = { ...body, model, width: source.width, height: source.height, regions, references: boundedReferences, billingAction: 'precise-image' };
      return next();
    } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'The source image could not be verified.' }); }
  };
  const generate = async (req: Request, res: Response): Promise<any> => {
    const edit = prepared.get(req);
    if (!edit) return res.status(400).json({ message: 'The source image must be verified before editing.' });
    prepared.delete(req);
    try {
      const { endpoint, input } = await preciseProviderRequest(edit);
      const result = await dependencies.subscribe(endpoint, input);
      const output = result?.data?.images?.[0]?.url || result?.images?.[0]?.url;
      if (typeof output !== 'string' || !output) throw new Error('The image provider returned no edited image.');
      let savedUrl = output;
      try { savedUrl = (await dependencies.persist(output)).imageUrl; }
      catch { console.warn('[Precise] Image storage failed; preserving the completed provider image.'); }
      return res.json({ imageUrl: savedUrl, modelName: PRECISE_MODEL_NAMES[edit.model] });
    } catch (error) { return res.status(502).json({ message: error instanceof Error ? error.message : 'The precise edit failed.' }); }
  };
  return { validate, generate };
}

export const preciseImageQuote = (req: Request, res: Response): any => {
  try {
    const { model, width, height, referenceCount = 0 } = req.body || {};
    return res.json({ pixels: preciseEditPixels(model, width, height, preciseReferenceCount(referenceCount)) });
  } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid precise image settings.' }); }
};
const preciseHandlers = createPreciseImageHandlers();
export const validatePreciseImage = preciseHandlers.validate;
export const preciseImageRoute = preciseHandlers.generate;
