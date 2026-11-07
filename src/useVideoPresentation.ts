import { useEffect, useState, type RefObject } from 'react';
import { rememberPresentedVideoFrame } from './presentedVideoFrame';

/** Observe only: never starts, seeks or pauses media owned by Hold/Drag. */
export function useVideoPresentation(ref: RefObject<HTMLVideoElement>, src?: string) {
    const [presented, setPresented] = useState<string>();
    useEffect(() => {
        const video = ref.current;
        if (!src || !video || typeof video.requestVideoFrameCallback !== 'function') return;
        let live = true, frame = 0;
        const seeking = () => setPresented(undefined);
        const observe = () => {
            frame = video.requestVideoFrameCallback((_now, metadata) => {
                if (!live) return;
                if (video.currentSrc === src && !video.seeking && video.readyState >= 2
                    && Math.abs(metadata.mediaTime - video.currentTime) < .15) {
                    rememberPresentedVideoFrame(video, metadata.mediaTime);
                    setPresented(src);
                }
                observe();
            });
        };
        video.addEventListener('seeking', seeking);
        observe();
        return () => { live = false; video.cancelVideoFrameCallback(frame); video.removeEventListener('seeking', seeking); };
    }, [ref, src]);
    return Boolean(src && presented === src);
}
