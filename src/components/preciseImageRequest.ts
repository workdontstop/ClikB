import { downloadImageUrlAsBlob } from '../imageCorsDownloadManager';
import { PRECISE_MAX_PIXELS, type PreciseReference } from '../../server/src/preciseEditSpec';

/** Below the server's 60 MiB JSON limit, with space for instructions and transport overhead. */
const MAX_REQUEST_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
type PreparedImage = { url: string; width?: number; height?: number };
export type PreciseImageRequestCache = Map<string, Promise<PreparedImage>>;
const supportedMime = /^image\/(?:png|jpe?g|gif|(?:x-)?bmp)(?:;|$)/i;
const tooLarge = () => new Error('These images are too large to send together. Choose fewer character references.');
const urlBytes = (url: string) => url.startsWith('data:') ? url.length : new TextEncoder().encode(url).byteLength;

function hasSupportedExtension(url: string) {
    try { return /\.(?:png|jpe?g|gif|bmp)$/i.test(new URL(url).pathname); }
    catch { return false; }
}

async function pngForImage(url: string, ceilingPixels: number | undefined): Promise<PreparedImage> {
    // Keep ordinary public raster URLs small; the server verifies bytes and caps references.
    if (/^https?:/i.test(url) && hasSupportedExtension(url)) return { url };
    if (/^data:image\/(?:png|jpeg|gif|bmp);base64,/i.test(url)) return { url };
    const blob = await downloadImageUrlAsBlob(url);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('An image is too large to prepare for Precise.');
    // Opaque CDN URLs can still point to a server-supported raster format.
    if (/^https?:/i.test(url) && supportedMime.test(blob.type)) return { url };
    const objectUrl = URL.createObjectURL(blob);
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const value = new Image();
            value.onload = () => resolve(value);
            value.onerror = () => reject(new Error('This image format could not be prepared for Precise.'));
            value.src = objectUrl;
        });
        const { naturalWidth: width, naturalHeight: height } = image;
        if (!width || !height) throw new Error('The image dimensions could not be read.');
        if (!ceilingPixels && width * height > PRECISE_MAX_PIXELS) throw new Error('Precise supports source images up to 4,220,160 pixels.');
        const scale = ceilingPixels && width * height > ceilingPixels ? Math.sqrt(ceilingPixels / (width * height)) : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('The image could not be prepared for Precise.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const prepared = { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
        // Release the full decoded canvas promptly; only the request representation is cached.
        canvas.width = canvas.height = 0;
        if (prepared.url.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 100) throw new Error('The prepared image is too large for Precise.');
        return prepared;
    } finally { URL.revokeObjectURL(objectUrl); }
}

function prepareImage(url: string, ceilingPixels: number | undefined, cache: PreciseImageRequestCache): Promise<PreparedImage> {
    const key = `${ceilingPixels || 'source'}:${url}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = pngForImage(url, ceilingPixels);
    cache.set(key, pending);
    void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
    return pending;
}

/** Convert browser-only formats for the request, without changing image ownership or display URLs. */
export async function preparePreciseImageRequest(
    imageUrl: string,
    dimensions: { width: number; height: number },
    references: PreciseReference[],
    cache: PreciseImageRequestCache,
): Promise<{ imageUrl: string; references: PreciseReference[] }> {
    const area = dimensions.width * dimensions.height;
    if (!Number.isSafeInteger(area) || area < 1 || area > PRECISE_MAX_PIXELS) throw new Error('Precise supports source images up to 4,220,160 pixels.');
    const source = await prepareImage(imageUrl, undefined, cache);
    if (source.width && (source.width !== dimensions.width || source.height !== dimensions.height)) throw new Error('The source image dimensions changed. Reopen Precise and try again.');
    const preparedReferences: PreciseReference[] = [];
    let requestBytes = urlBytes(source.url) + 100;
    // Decode sequentially so seven character references do not retain seven full canvases at once.
    for (const reference of references) {
        const prepared = await prepareImage(reference.url, area, cache);
        requestBytes += urlBytes(prepared.url) + new TextEncoder().encode(JSON.stringify(reference.name)).byteLength + 100;
        // Stop before decoding additional references when this batch cannot fit the server body.
        if (requestBytes > MAX_REQUEST_BYTES) throw tooLarge();
        preparedReferences.push({ name: reference.name, url: prepared.url });
    }
    const result = { imageUrl: source.url, references: preparedReferences };
    assertPreciseRequestSize(result);
    return result;
}

export function assertPreciseRequestSize(body: unknown): void {
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_REQUEST_BYTES) {
        throw tooLarge();
    }
}
