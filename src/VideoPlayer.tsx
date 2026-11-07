import React, { useRef, useState, useEffect, useCallback } from "react";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { useSelector } from "react-redux";
import type { RootState } from "./store";
import { useDispatch } from "react-redux";
import { publishFeedsArea, removeFeedsArea } from "./brainstormSlice";
import type { FeedAreaId, FeedControl } from "./feedsControlSnapshot";
import { setPlaybackMuted, setPlaybackVolume } from "./settingsSlice";
import { getVideoControlBounds, type VideoControlBounds } from "./videoPlaybackLayout";
import { createOwnedMediaPlayback, releaseOwnedMedia, type OwnedMediaPlayback } from './ownedMediaLifecycle';

// --- Props Interface ---
interface VideoPlayerProps {
    index: number;
    src: string;
    isActive: boolean;
    isUIHidden: boolean;
    setUIHidden: (hidden: boolean) => void;

    // Styling & Layout Props
    matchMobile: boolean;
    isNineTwelve: boolean;
    isMenuOpen: boolean;
    item: any;
    playvid: boolean;

    // Audio/Theme
    muted: boolean;
    darkMode: boolean;
    singleMode: boolean;

    // Ref Handling
    onRefAssign: (el: HTMLVideoElement | null) => void;

    // Playback Controls
    loop?: boolean;
    onEnded?: () => void;
    onPlaybackChange?: (playing: boolean) => void;
    mobileViewportHeight?: string;
    snapshotObscured?: boolean;
    playbackSuspended?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    index,
    src,
    isActive,
    isUIHidden,
    setUIHidden,
    matchMobile,
    item,
    playvid,
    muted,
    darkMode,
    onRefAssign,
    singleMode,
    loop,
    onEnded,
    onPlaybackChange,
    mobileViewportHeight,
    snapshotObscured = false,
    playbackSuspended = false,
}) => {
    const dispatch = useDispatch();
    // --- 1. Internal State ---
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const ownedPlaybackRef = useRef<OwnedMediaPlayback | null>(null);
    const sourceRef = useRef(src);
    sourceRef.current = src;
    const playbackPreferencesRef = useRef({ muted, volume: 1 });
    const onRefAssignRef = useRef(onRefAssign);
    onRefAssignRef.current = onRefAssign;
    const assignVideoRef = useCallback((node: HTMLVideoElement | null) => {
        const previous = localVideoRef.current;
        if (previous === node) return;
        // Volume events from retiring the old node must not change Redux settings.
        localVideoRef.current = null;
        if (ownedPlaybackRef.current) ownedPlaybackRef.current.dispose();
        else if (previous) releaseOwnedMedia(previous);
        ownedPlaybackRef.current = null;
        if (node) {
            if (!node.src && sourceRef.current) node.src = sourceRef.current;
            node.muted = playbackPreferencesRef.current.muted;
            node.volume = playbackPreferencesRef.current.volume;
        }
        localVideoRef.current = node;
        onRefAssignRef.current(node);
        if (node) ownedPlaybackRef.current = createOwnedMediaPlayback(node, () => localVideoRef.current === node);
    }, []);
    const controlsHideTimerRef = useRef<any>(null);
    const lastClickTimeRef = useRef<number>(0); // Ref for double-click detection
    const [controlsVisible, setControlsVisible] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoMeta, setVideoMeta] = useState({ current: 0, duration: 0 });
    const [controlBounds, setControlBounds] = useState<VideoControlBounds | null>(null);
    const playbackChangeRef = useRef(onPlaybackChange);
    playbackChangeRef.current = onPlaybackChange;
    const activeRef = useRef(isActive);
    activeRef.current = isActive;
    const suspendedRef = useRef(playbackSuspended);
    suspendedRef.current = playbackSuspended;
    const isMuted = useSelector((state: RootState) => state.settings.fullscreenMute ?? muted);
    const playbackVolume = useSelector((state: RootState) => state.settings.playbackVolume ?? 1);
    playbackPreferencesRef.current = { muted: isMuted, volume: playbackVolume };
    const syncPlaybackState = useCallback(() => {
        const video = localVideoRef.current;
        const playing = Boolean(activeRef.current && video && video.readyState >= 2 && !video.paused && !video.ended);
        setIsPlaying(playing);
        playbackChangeRef.current?.(playing);
    }, []);
    const postId = Number(item?.id) || 0;
    const snapshotSource = `VideoPlayer:${postId}`;
    const currentSecond = Math.floor(videoMeta.current);
    useEffect(() => {
        const areaId: FeedAreaId = 'clikb.feeds.video';
        if (!isActive || !playvid) {
            dispatch(removeFeedsArea({ areaId, source: snapshotSource }));
            return;
        }
        const control = (name: string, handlerRef: string, policy: FeedControl['aiPolicy'] = 'candidate'): FeedControl => ({
            controlId: `${areaId}.${name}`, areaId, handlerRef, enabled: true, aiPolicy: policy,
            targetId: postId, ...(policy === 'candidate' ? { candidateActionId: `${areaId}.${name}` } : {}),
        });
        dispatch(publishFeedsArea({ areaId, source: snapshotSource, instanceId: 'video',
            state: {
                postId, playing: isPlaying, muted: isMuted, volume: playbackVolume,
                uiHidden: isUIHidden, controlsVisible,
                currentSecond, durationSeconds: Math.floor(videoMeta.duration),
                obscuredByOverlay: snapshotObscured,
            }, visiblePosts: [], visibleControls: snapshotObscured ? [] : [
                control('toggle_play_pause', 'VideoPlayer.handleVideoClick'),
                control('double_click_ui_mode', 'VideoPlayer.handleVideoClick double click', 'manual_only'),
                ...(isUIHidden && controlsVisible ? [
                    control('toggle_local_mute', 'VideoPlayer.handleToggleMute'),
                    control('seek', 'VideoPlayer.handleSeekChange', 'manual_only'),
                ] : []),
            ],
        }));
    }, [dispatch, snapshotSource, postId, isActive, playvid, isPlaying, isMuted,
        isUIHidden, controlsVisible, currentSecond, videoMeta.duration, snapshotObscured, playbackVolume]);
    useEffect(() => () => {
        dispatch(removeFeedsArea({ areaId: 'clikb.feeds.video', source: snapshotSource }));
    }, [dispatch, snapshotSource]);

    useEffect(() => {
        const video = localVideoRef.current;
        if (!video) return;
        if (video.muted !== isMuted) video.muted = isMuted;
        if (video.volume !== playbackVolume) video.volume = playbackVolume;
    }, [isMuted, playbackVolume, src]);

    const measureControls = useCallback(() => {
        const video = localVideoRef.current;
        const container = video?.offsetParent as HTMLElement | null || video?.parentElement;
        if (!video || !container) return;
        const rect = video.getBoundingClientRect();
        const parent = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const bounds = getVideoControlBounds({
            left: rect.left - parent.left - container.clientLeft,
            top: rect.top - parent.top - container.clientTop,
            width: rect.width, height: rect.height,
        }, container.clientHeight, video.videoWidth, video.videoHeight);
        setControlBounds(previous => previous &&
            Math.abs(previous.left - bounds.left) < 0.5 &&
            Math.abs(previous.bottom - bounds.bottom) < 0.5 &&
            Math.abs(previous.width - bounds.width) < 0.5 ? previous : bounds);
    }, []);

    useEffect(() => {
        syncPlaybackState();
        setVideoMeta({ current: 0, duration: 0 });
        setControlBounds(null);
        const playbackOnDispose = playbackChangeRef.current;
        const video = localVideoRef.current;
        const container = video?.offsetParent as HTMLElement | null || video?.parentElement;
        let frame = 0;
        const scheduleMeasure = () => {
            if (!frame) frame = requestAnimationFrame(() => { frame = 0; measureControls(); });
        };
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
        if (video) observer?.observe(video);
        if (container) observer?.observe(container);
        window.addEventListener('resize', scheduleMeasure);
        scheduleMeasure();
        return () => {
            playbackOnDispose?.(false);
            observer?.disconnect();
            window.removeEventListener('resize', scheduleMeasure);
            if (frame) cancelAnimationFrame(frame);
            if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
        };
    }, [src, measureControls, syncPlaybackState]);

    useEffect(() => {
        // The selected row can mount its video after the scroll observer fires.
        // Begin as soon as that owned node commits, without an artificial timer.
        const video = localVideoRef.current;
        if (isActive && playvid && !suspendedRef.current) ownedPlaybackRef.current?.play().catch(() => { });
        else video?.pause();
        syncPlaybackState();
    }, [isActive, playvid, src, syncPlaybackState]);

    // Brand Color Logic
    // Seeker follows the user's configurable app color from Redux settings
    // (dark/light aware), falling back to the old defaults if unset.
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const brandColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? "#E8BAFA" : "#0099cc");

    // --- 2. Logic Helpers ---

    const showControls = () => {
        setControlsVisible(true);
        if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);

        controlsHideTimerRef.current = setTimeout(() => {
            const v = localVideoRef.current;
            if (v && v.paused) return;
            setControlsVisible(false);
        }, 2500);
    };

    // --- 3. Handlers ---

    // Down capture just triggers control visibility now, allowing click to pass through
    const handleVideoDownCapture = () => {
        showControls();
    };

    const handleVideoClick = () => {
        const video = localVideoRef.current;
        if (!video || suspendedRef.current) return;

        // 1. "Video works as normal" -> Always toggle Play/Pause on click
        if (video.paused) {
            ownedPlaybackRef.current?.play().catch(() => { });
        } else {
            video.pause();
        }
        showControls();

        // 2. Double Click Detection Logic
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
            // -- DOUBLE CLICK DETECTED -- 
            // Toggle UI Mode
            if (isUIHidden) {
                // If in Control Mode -> Go to Base Mode (Show UI)
                setUIHidden(false);
            } else {
                // If in Base Mode -> Go to Control Mode (Hide UI)
                setUIHidden(true);
            }

            // Reset click timer to prevent triple-click confusion
            lastClickTimeRef.current = 0;
        } else {
            // Record first click time
            lastClickTimeRef.current = now;
        }
    };

    const handleSeekChange = (e: any) => {
        e.stopPropagation?.();
        const video = localVideoRef.current;
        if (!video) return;

        const val = Number(e.target.value);
        if (!Number.isFinite(val)) return;

        video.currentTime = val;
        setVideoMeta((prev) => ({
            ...prev,
            current: val,
            duration: prev.duration || video.duration || 0,
        }));

        // Keep controls visible while dragging, but don't start timer yet
        setControlsVisible(true);
        if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };

    // --- NEW HANDLER: Starts the hide timer when seeking ends ---
    const handleSeekEnd = (e: any) => {
        e.stopPropagation();
        showControls(); // This sets visible=true AND starts the 2.5s timer
    };

    const handleTimeUpdate = () => {
        const video = localVideoRef.current;
        if (!video) return;
        setVideoMeta((prev) => ({
            ...prev,
            current: video.currentTime || 0,
            duration: prev.duration || (Number.isFinite(video.duration) ? video.duration : 0),
        }));
    };

    const handleLoadedMeta = () => {
        const video = localVideoRef.current;
        if (!video) return;
        setVideoMeta({
            current: video.currentTime || 0,
            duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
        measureControls();
        syncPlaybackState();
    };

    const handleVolumeChange = () => {
        const video = localVideoRef.current;
        if (!video) return;
        if (video.muted !== isMuted) dispatch(setPlaybackMuted(video.muted));
        if (video.volume !== playbackVolume) dispatch(setPlaybackVolume(video.volume));
    };

    const handleToggleMute = (e: any) => {
        e.stopPropagation();
        const video = localVideoRef.current;
        if (!video) return;

        const nextMuted = !video.muted;
        video.muted = nextMuted;
        dispatch(setPlaybackMuted(nextMuted));
        showControls();
    };

    const handlePointerMove = () => {
        if (isActive && isUIHidden) showControls();
    };

    return (
        <>
            <video
                data-ai-action={isActive && playvid && !snapshotObscured ? 'clikb.feeds.video.toggle_play_pause' : undefined}
                ref={assignVideoRef}
                onPointerDownCapture={handleVideoDownCapture}
                onTouchStartCapture={handleVideoDownCapture}
                onMouseDownCapture={handleVideoDownCapture}
                onClick={handleVideoClick}
                onPointerMove={handlePointerMove}
                onLoadedMetadata={handleLoadedMeta}
                onTimeUpdate={handleTimeUpdate}
                onPlay={event => { if (suspendedRef.current) event.currentTarget.pause(); syncPlaybackState(); }}
                onPlaying={event => { if (suspendedRef.current) event.currentTarget.pause(); syncPlaybackState(); }}
                onPause={syncPlaybackState}
                onCanPlay={syncPlaybackState}
                onLoadedData={syncPlaybackState}
                onEmptied={syncPlaybackState}
                onError={syncPlaybackState}
                onVolumeChange={handleVolumeChange}
                playsInline
                loop={loop ?? true}
                onEnded={() => { syncPlaybackState(); onEnded?.(); }}
                webkit-playsinline="true"
                src={src}
                poster={item?.item1 || item?.x1 || item?.thumb1 || item?.poster || undefined}
                preload={isActive ? 'auto' : 'none'}
                controls={false}
                muted={isMuted}
                style={{
                    width: matchMobile ? "100%" : (item && item.ratio === 3) ? "100%" : "auto",
                    maxWidth: "100%",
                    height: matchMobile ? (mobileViewportHeight || "100dvh") : "100%",
                    // Always show the WHOLE video on mobile (letterboxed if needed) instead of cropping it.
                    objectFit: "contain",
                    position: "absolute",
                    zIndex: singleMode ? 1 : 3,
                    top: "50%",
                    left: "50%",
                    marginTop: matchMobile ? "0vh" : "0px",
                    transform: "translate(-50%, -50%)",
                    transition: "none",
                    display: "block",
                    opacity: playvid ? 1 : 0,
                    pointerEvents: playvid ? "auto" : "none",
                }}
            />

            {/* --- CUSTOM OVERLAY --- */}
            {/* Shows only when in Control Mode (isUIHidden = true) */}
            {isActive && isUIHidden && controlsVisible && controlBounds && (
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: "absolute",
                        left: controlBounds.left,
                        bottom: controlBounds.bottom,
                        zIndex: 9999,
                        width: controlBounds.width,
                        boxSizing: "border-box",
                        padding: "10px 16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                        background: "transparent",
                        transition: "opacity 0.5s ease-in-out",
                    }}
                >
                    {/* MUTE BUTTON (Left) */}
                    <button
                        aria-label={isMuted ? 'Unmute playback' : 'Mute playback'}
                        data-ai-action="clikb.feeds.video.toggle_local_mute"
                        onClick={handleToggleMute}
                        style={{
                            background: "rgba(0, 0, 0, 0.4)",
                            border: "none",
                            borderRadius: "50%",
                            width: "42px",
                            height: "42px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                            flexShrink: 0,
                            color: "white",
                            backdropFilter: "blur(2px)"
                        }}
                    >
                        {isMuted ? (
                            <VolumeOffIcon sx={{ fontSize: 26 }} />
                        ) : (
                            <VolumeUpIcon sx={{ fontSize: 26 }} />
                        )}
                    </button>

                    {/* SEEK BAR (Center) */}
                    <input
                        aria-label="Seek video"
                        type="range"
                        min={0}
                        max={videoMeta.duration || 0}
                        step={0.05}
                        value={videoMeta.current || 0}
                        onChange={handleSeekChange}

                        // --- MOBILE DRAG FIX ---
                        // 1. Prevent Swipe on Start/Move
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}

                        // 2. Restart Auto-Hide Timer on End (Mobile & PC)
                        onMouseUp={handleSeekEnd}
                        onTouchEnd={handleSeekEnd}
                        onKeyUp={handleSeekEnd}

                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: "28px",
                            cursor: "pointer",
                            accentColor: brandColor,
                            background: "rgba(255,255,255,0.3)",
                            borderRadius: "2px",
                            outline: "none",
                        }}
                    />
                </div>
            )}
        </>
    );
};

export default VideoPlayer;
