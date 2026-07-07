import React, { useRef, useState, useEffect } from "react";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

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
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    index,
    src,
    isActive,
    isUIHidden,
    setUIHidden,
    matchMobile,
    isNineTwelve,
    isMenuOpen,
    item,
    playvid,
    muted,
    darkMode,
    onRefAssign,
    singleMode,
    loop,
    onEnded
}) => {
    // --- 1. Internal State ---
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const controlsHideTimerRef = useRef<any>(null);
    const lastClickTimeRef = useRef<number>(0); // Ref for double-click detection
    const [controlsVisible, setControlsVisible] = useState(false);
    const [videoMeta, setVideoMeta] = useState({ current: 0, duration: 0 });

    // Local Mute State
    const [isMuted, setIsMuted] = useState(muted);

    // Sync local mute state if parent prop changes
    useEffect(() => {
        setIsMuted(muted);
    }, [muted]);

    // Brand Color Logic
    const brandColor = darkMode ? "#E8BAFA" : "#0099cc";

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

    const hideControlsNow = () => {
        if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
        setControlsVisible(false);
    };

    // --- 3. Handlers ---

    // Down capture just triggers control visibility now, allowing click to pass through
    const handleVideoDownCapture = (e: any) => {
        showControls();
    };

    const handleVideoClick = (e: any) => {
        const video = localVideoRef.current;
        if (!video) return;

        // 1. "Video works as normal" -> Always toggle Play/Pause on click
        if (video.paused) {
            video.play().catch(() => { });
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
    };

    const handleToggleMute = (e: any) => {
        e.stopPropagation();
        const video = localVideoRef.current;
        if (!video) return;

        video.muted = !video.muted;
        setIsMuted(video.muted);
        showControls();
    };

    const handlePointerMove = () => {
        if (isActive && isUIHidden) showControls();
    };

    return (
        <>
            <video
                ref={(el) => {
                    localVideoRef.current = el;
                    onRefAssign(el);
                }}
                onPointerDownCapture={handleVideoDownCapture}
                onTouchStartCapture={handleVideoDownCapture}
                onMouseDownCapture={handleVideoDownCapture}
                onClick={handleVideoClick}
                onPointerMove={handlePointerMove}
                onLoadedMetadata={handleLoadedMeta}
                onTimeUpdate={handleTimeUpdate}
                playsInline
                loop={loop ?? true}
                onEnded={onEnded}
                webkit-playsinline="true"
                src={src}
                controls={false}
                muted={muted}
                style={{
                    width: matchMobile ? "100%" : (item && item.ratio === 3) ? "100%" : "auto",
                    height: matchMobile ? "100dvh" : "100%",
                    // Always show the WHOLE video on mobile (letterboxed if needed) instead of cropping it.
                    objectFit: "contain",
                    position: "absolute",
                    zIndex: singleMode ? 1 : 3,
                    top: "50%",
                    left: "50%",
                    marginTop: matchMobile ? "0vh" : "0px",
                    transform: "translate(-50%, -50%)",
                    transition: "transform 7s ease-in-out",
                    display: "block",
                    opacity: playvid ? 1 : 0,
                    pointerEvents: playvid ? "auto" : "none",
                }}
            />

            {/* --- CUSTOM OVERLAY --- */}
            {/* Shows only when in Control Mode (isUIHidden = true) */}
            {isActive && isUIHidden && controlsVisible && (
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        width: "100%",
                        padding: "10px 20px 30px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "15px",
                        background: "transparent",
                        transition: "opacity 0.5s ease-in-out",
                    }}
                >
                    {/* MUTE BUTTON (Left) */}
                    <button
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
                            height: "4px",
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
