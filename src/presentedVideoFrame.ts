/** Presentation evidence belongs to an element and its source, never just a URL. */
const frames = new WeakMap<HTMLVideoElement, { src: string; time: number }>();

export function rememberPresentedVideoFrame(video: HTMLVideoElement, time: number) {
    frames.set(video, { src: video.currentSrc || video.src, time });
}

export function hasPresentedVideoFrame(video: HTMLVideoElement, target: number) {
    const frame = frames.get(video);
    return Boolean(frame && frame.src === (video.currentSrc || video.src)
        && video.readyState >= 2 && !video.seeking
        && Math.abs(video.currentTime - target) < .001 && Math.abs(frame.time - target) < .1);
}
