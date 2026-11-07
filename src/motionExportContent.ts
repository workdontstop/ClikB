/** Content check on decoded pixels, independent of encoder/container success. */
export function motionFrameHasDetail(pixels: Uint8ClampedArray): boolean {
    const min = [255, 255, 255], max = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], pixels[i + c]); max[c] = Math.max(max[c], pixels[i + c]);
    }
    return max.some((value, c) => value - min[c] > 16);
}

/** Sample the recorded timeline, not the still-visible live WebGL canvas. */
export function assertMotionVideoContent(blob: Blob, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video'), url = URL.createObjectURL(blob);
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        let finished = false, index = 0;
        const finish = (error?: Error) => {
            if (finished) return; finished = true;
            clearTimeout(timer); signal.removeEventListener('abort', abort);
            video.onloadeddata = video.onseeked = video.onerror = null;
            video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
            if (error) reject(error); else resolve();
        };
        const abort = () => finish(new Error('Motion Guide cancelled.'));
        const inspect = () => {
            if (finished) return;
            try {
                if (!context) throw new Error('The browser cannot inspect the recorded motion video.');
                context.drawImage(video, 0, 0, 96, 96);
                if (motionFrameHasDetail(context.getImageData(0, 0, 96, 96).data)) { finish(); return; }
                const times = [.25, .5, .9];
                if (index >= times.length) throw new Error('The recorded video contains only blank frames. The Three.js scene is retained; retry export without rebuilding.');
                video.currentTime = video.duration * times[index++];
            } catch (error) { finish(error as Error); }
        };
        const timer = setTimeout(() => finish(new Error('Could not verify recorded video frames. The scene is retained; retry export.')), 15000);
        signal.addEventListener('abort', abort, { once: true });
        video.muted = true; video.preload = 'auto'; video.onloadeddata = inspect; video.onseeked = inspect;
        video.onerror = () => finish(new Error('The exported motion video could not be decoded. The scene is retained.'));
        if (signal.aborted) abort(); else video.src = url;
    });
}
