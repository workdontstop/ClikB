export interface ImageBlobConversionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** The temporary URL belongs only to this conversion, never to its caller. */
export function imageBlobToPng(blob: Blob, options: ImageBlobConversionOptions = {}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let url = '';
    let canvas: HTMLCanvasElement | null = null;
    let settled = false;
    const finish = (result?: Blob, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      if (url) URL.revokeObjectURL(url);
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (result) resolve(result);
      else reject(error || new Error('Could not convert the image to PNG.'));
    };
    const abort = () => finish(undefined, new DOMException('Image conversion cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new Error('Timed out while converting the image to PNG.')),
      options.timeoutMs ?? 30_000);
    image.onerror = () => finish(undefined, new Error('Could not load the image for PNG conversion.'));
    image.onload = () => {
      try {
        canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context is not available.');
        context.drawImage(image, 0, 0);
        canvas.toBlob(result => result ? finish(result) : finish(undefined, new Error('Could not export the PNG image.')), 'image/png', 1);
      } catch (error) { finish(undefined, error); }
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    try { url = URL.createObjectURL(blob); image.src = url; }
    catch (error) { finish(undefined, error); }
  });
}
