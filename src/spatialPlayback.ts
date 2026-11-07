import type { SpatialTraversal } from "./spatialStageModel";
import type { SpatialDriveInput } from "./spatialPlayerModel";
import { spatialLog, mediaUrlLabel } from "./spatialDiagnostics";
import { hasPresentedVideoFrame, rememberPresentedVideoFrame } from "./presentedVideoFrame";

export interface SpatialPlaybackClock {
    now(): number;
    every(callback: () => void, ms: number): () => void;
    after(callback: () => void, ms: number): () => void;
}
const clock: SpatialPlaybackClock = {
    now: () => performance.now(),
    every: (callback, ms) => { const id = setInterval(callback, ms); return () => clearInterval(id); },
    after: (callback, ms) => { const id = setTimeout(callback, ms); return () => clearTimeout(id); },
};

/** The sole media driver for spatial playback. Progress is measured along the forward route. */
export function attachSpatialPlayback(options: {
    video: HTMLVideoElement;
    traversal: SpatialTraversal;
    progress: number | null;
    drive: () => SpatialDriveInput | null;
    onDirection: (traversal: SpatialTraversal, progress: number) => void;
    onFinish: (nodeId: string) => void;
    onError: (reason: string, error?: unknown) => void;
    muted?: () => boolean;
    actionHeld?: () => boolean;
    waitForSeekBeforePlayback?: boolean;
    onVisualReady?: () => void;
    onMovementAdvance?: (elapsedMs: number) => void;
    clock?: SpatialPlaybackClock;
}) {
    const { video, traversal: clip } = options;
    const scheduler = options.clock || clock;
    const requestedAt = scheduler.now();
    const reverse = clip.direction === "backward" && !clip.connection.backward;
    const movement = clip.connection.kind !== "action";
    const interruptible = movement || clip.connection.actionPlayback === 'hold';
    let cancelled = false, settled = false, started = false, visuallyStarted = false, playPending = false;
    let stopTimer = () => {}, removeSeekListener = () => {}, cancelVisualFrame = () => {}, stopFrameFallback = () => {};
    const fail = (reason: string, error?: unknown) => {
        if (cancelled || settled) return;
        settled = true; stopTimer(); stopFrameFallback(); removeSeekListener(); cancelVisualFrame(); video.pause();
        spatialLog("playback.failed", { connectionId: clip.connection.id, reason, mediaCode: video.error?.code });
        options.onError(reason, error);
    };
    const stopTimeout = scheduler.after(() => fail("load-timeout"), 30000);
    const finish = () => {
        if (cancelled || settled) return;
        settled = true; stopTimer(); stopFrameFallback(); removeSeekListener(); cancelVisualFrame(); video.pause();
        spatialLog("playback.ended", { connectionId: clip.connection.id, direction: clip.direction });
        options.onFinish(clip.destinationNodeId);
    };
    const ended = () => { if (visuallyStarted && !reverse) finish(); };
    const mediaError = () => fail("media-error", video.error?.message);
    const play = async () => {
        if (cancelled || settled || playPending) return;
        playPending = true; video.muted = Boolean(options.muted?.());
        try { await video.play(); }
        catch (error) {
            if (cancelled || settled || interruptible && (error as Error).name === "AbortError") return;
            if ((error as Error).name !== "NotAllowedError") { fail("play-rejected", error); return; }
            video.muted = true;
            try { await video.play(); }
            catch (retryError) { if (!(interruptible && (retryError as Error).name === "AbortError")) fail("muted-play-rejected", retryError); }
        } finally { playPending = false; }
    };
    const ready = () => {
        if (cancelled || settled || started || video.readyState < 2) return;
        if (!Number.isFinite(video.duration) || video.duration <= 0) { fail("invalid-duration"); return; }
        started = true; video.pause();
        const progress = options.progress ?? (clip.direction === "backward" ? 1 : 0);
        const mediaProgress = clip.direction === "backward" && !reverse ? 1 - progress : progress;
        const targetTime = Math.max(0, Math.min(video.duration - 0.001, mediaProgress * video.duration));
        spatialLog("playback.ready", { connectionId: clip.connection.id, url: mediaUrlLabel(clip.video.videoUrl), reverse, progress });
        const begin = () => {
            if (cancelled || settled || visuallyStarted) return;
            visuallyStarted = true;
            stopTimeout(); stopFrameFallback(); cancelVisualFrame();
            spatialLog("playback.visual-ready", { connectionId: clip.connection.id, direction: clip.direction,
                elapsedMs: Math.round(scheduler.now() - requestedAt), mediaTime: video.currentTime });
            options.onVisualReady?.();
            if (!movement) {
                if (clip.connection.actionPlayback !== 'hold') { void play(); return; }
                stopTimer = scheduler.every(() => {
                    if (cancelled || settled) return;
                    if (options.actionHeld?.()) { if (video.paused) void play(); }
                    else video.pause();
                }, 40);
                return;
            }
            let previous = scheduler.now(), previousMediaTime = video.currentTime;
            stopTimer = scheduler.every(() => {
                if (cancelled || settled) return;
                const now = scheduler.now(), delta = Math.min(0.1, Math.max(0, (now - previous) / 1000)); previous = now;
                const mediaAdvanced = Math.abs(video.currentTime - previousMediaTime) > .001; previousMediaTime = video.currentTime;
                const sample = options.drive(), axis = clip.connection.movement.samples.at(-1);
                const denominator = sample && axis ? Math.hypot(sample.x, sample.y) * Math.hypot(axis.x, axis.y) : 0;
                const alignment = sample?.active && sample.radius >= 0.08 && axis && denominator
                    ? (sample.x * axis.x + sample.y * axis.y) / denominator : 0;
                if (Math.abs(alignment) < 0.35) { video.pause(); return; }
                const direction = alignment > 0 ? "forward" : "backward";
                if (direction !== clip.direction) {
                    video.pause(); stopTimer(); settled = true;
                    const mediaProgress = video.currentTime / video.duration;
                    const progress = clip.direction === "backward" && !reverse ? 1 - mediaProgress : mediaProgress;
                    options.onDirection({ ...clip, direction,
                        destinationNodeId: direction === "forward" ? clip.connection.targetNodeId : clip.connection.sourceNodeId,
                        video: direction === "backward" ? clip.connection.backward || clip.connection.forward! : clip.connection.forward!,
                    }, progress);
                    return;
                }
                if (reverse) {
                    video.pause(); video.muted = true;
                    if (!video.seeking) { video.currentTime = Math.max(0, video.currentTime - delta); options.onMovementAdvance?.(delta * 1000); }
                    if (video.currentTime <= 0.025) finish();
                } else { if (!video.paused && mediaAdvanced) options.onMovementAdvance?.(delta * 1000); else if (video.paused) void play(); }
            }, 40);
        };
        if (!options.waitForSeekBeforePlayback) { video.currentTime = targetTime; begin(); return; }
        let seekReady = Math.abs(video.currentTime - targetTime) < 0.001 && !video.seeking;
        let frameReady = hasPresentedVideoFrame(video, targetTime) || typeof video.requestVideoFrameCallback !== 'function';
        const reveal = () => { if (seekReady && frameReady) begin(); };
        let useDecodedSeek = false;
        const seeked = () => {
            removeSeekListener();
            seekReady = true;
            if (useDecodedSeek && video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - targetTime) < 0.1) frameReady = true;
            reveal();
        };
        video.addEventListener("seeked", seeked);
        removeSeekListener = () => video.removeEventListener("seeked", seeked);
        // Register before seeking: a paused video's presentation callback can
        // precede seeked, and registering afterwards can miss its only frame.
        const requestFrame = () => {
            const id = video.requestVideoFrameCallback((_now, metadata) => {
                cancelVisualFrame = () => {};
                if (cancelled || settled) return;
                if (video.readyState < 2 || metadata && Math.abs(metadata.mediaTime - targetTime) > 0.1) { requestFrame(); return; }
                video.pause();
                rememberPresentedVideoFrame(video, metadata?.mediaTime ?? video.currentTime);
                frameReady = true;
                reveal();
            });
            cancelVisualFrame = () => video.cancelVideoFrameCallback(id);
        };
        if (!frameReady) requestFrame();
        if (!frameReady) stopFrameFallback = scheduler.after(() => {
            if (cancelled || settled || visuallyStarted) return;
            // Some browsers withhold compositor callbacks for a covered video.
            // A completed seek with current-frame data is also decoded evidence;
            // never reveal the cached element's unrelated previous frame.
            useDecodedSeek = true; video.pause();
            if (seekReady && !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - targetTime) < 0.1) {
                frameReady = true; reveal();
            } else {
                seekReady = false;
                video.addEventListener('seeked', seeked);
                video.currentTime = targetTime;
            }
        }, 1500);
        // Setting the time to its existing value can trigger an unnecessary
        // seek and invalidate an already decoded frame (or emit no seeked at all).
        if (!seekReady) video.currentTime = targetTime;
        reveal();
        if (!frameReady) {
            // Seeking a paused cached element to its existing frame need not
            // submit another compositor frame. Decode while still covered and
            // muted; the first target presentation pauses this preparation.
            video.muted = true;
            void video.play().catch(error => {
                if (!cancelled && !settled && !frameReady && (error as Error).name !== 'AbortError') fail('frame-prepare-rejected', error);
            });
        }
    };
    video.addEventListener("loadeddata", ready);
    video.addEventListener("canplay", ready);
    video.addEventListener("ended", ended);
    video.addEventListener("error", mediaError);
    spatialLog("playback.start", { connectionId: clip.connection.id, direction: clip.direction, url: mediaUrlLabel(clip.video.videoUrl) });
    if (video.error) video.load(); else ready();
    return () => {
        cancelled = true; stopTimeout(); stopTimer(); stopFrameFallback(); removeSeekListener(); cancelVisualFrame(); video.pause(); video.muted = true;
        video.removeEventListener("loadeddata", ready); video.removeEventListener("canplay", ready);
        video.removeEventListener("ended", ended); video.removeEventListener("error", mediaError);
    };
}
