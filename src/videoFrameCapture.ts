export interface VideoFrameCaptureOptions {
  timeSeconds?: number;
  endOffsetSeconds?: number;
  mimeType?: string;
  quality?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Read a single frame from a URL without retaining a detached media decoder. */
export function captureVideoFrameBlob(source: string, options: VideoFrameCaptureOptions = {}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let canvas: HTMLCanvasElement | null = null;
    let settled = false;
    let seeking = false;
    let exporting = false;
    const cleanup = () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    };
    const finish = (blob?: Blob, error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (blob) resolve(blob);
      else reject(error || new Error('Could not extract the video frame.'));
    };
    const abort = () => finish(undefined, new DOMException('Video frame capture cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new Error('Timed out while reading the video frame.')),
      options.timeoutMs ?? 30_000);
    const exportFrame = () => {
      if (settled || seeking || exporting || video.readyState < 2) return;
      exporting = true;
      try {
        if (!video.videoWidth || !video.videoHeight) throw new Error('Video frame dimensions are unavailable.');
        canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context is not available.');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? finish(blob) : finish(undefined, new Error('Could not export the video frame.')),
          options.mimeType || 'image/jpeg', options.quality ?? 0.95);
      } catch (error) { finish(undefined, error); }
    };
    // The request's CORS mode and callbacks must exist before assigning src.
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(undefined, new Error('Could not load the video for frame capture. Check its URL and CORS permission.'));
    video.onloadedmetadata = () => {
      try {
        if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Invalid video duration.');
        const requested = options.timeSeconds ?? Math.max(0, video.duration - (options.endOffsetSeconds ?? 0.02));
        if (!Number.isFinite(requested)) throw new Error('Invalid frame time.');
        const target = Math.max(0, Math.min(requested, Math.max(0, video.duration - 0.001)));
        seeking = Math.abs(video.currentTime - target) > 0.0001;
        if (seeking) video.currentTime = target;
        else exportFrame();
      } catch (error) { finish(undefined, error); }
    };
    video.onseeked = () => { seeking = false; exportFrame(); };
    video.onloadeddata = exportFrame;
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    try {
      if (!source.trim()) throw new Error('Missing video URL.');
      video.src = source;
      video.load();
    } catch (error) { finish(undefined, error); }
  });
}
