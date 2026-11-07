export const MOTION_EXPORT_FPS = 30;
// One encoded frame plus millisecond container rounding, not a blanket allowance
// for incomplete performances (4.59s for a 5s request is still genuinely short).
export const MOTION_EXPORT_TOLERANCE = 1 / MOTION_EXPORT_FPS + .002;
export const motionExportComplete = (measured: number, requested: number) =>
    Number.isFinite(measured) && measured > 0 && measured + MOTION_EXPORT_TOLERANCE >= requested;

/** Fragmented MP4s can initially report Infinity/zero. Resolve their last
 * decodable timestamp before treating unavailable metadata as a short clip. */
export function readMotionExportDuration(blob: Blob, signal: AbortSignal): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob), video = document.createElement('video');
        let finished = false, seeking = false;
        const finish = (error?: Error, measured = video.duration) => {
            if (finished) return;
            finished = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
            video.onloadedmetadata = video.ondurationchange = video.onseeked = video.onerror = null;
            video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
            if (error) reject(error); else resolve(measured);
        };
        const abort = () => finish(new Error('Motion Guide cancelled.'));
        const measure = () => {
            if (Number.isFinite(video.duration) && video.duration > 0) { finish(); return; }
            if (!seeking) { seeking = true; video.currentTime = 1e9; }
        };
        const timer = setTimeout(() => finish(new Error('Could not read motion export timing. Your animation is saved; retry export without a new AI call.')), 15000);
        signal.addEventListener('abort', abort, { once: true });
        video.onloadedmetadata = measure;
        video.ondurationchange = measure;
        video.onseeked = () => {
            if (Number.isFinite(video.duration) && video.duration > 0) finish();
            else if (video.seekable.length) finish(undefined, video.seekable.end(video.seekable.length - 1));
        };
        video.onerror = () => finish(new Error('Could not read the exported motion video. Retry export; no new AI call.'));
        video.preload = 'auto'; video.src = url;
        if (signal.aborted) abort();
    });
}
