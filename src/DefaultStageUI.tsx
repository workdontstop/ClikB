import React, { useEffect, useMemo, useRef, useState } from "react";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import TimelineIcon from "@mui/icons-material/Timeline";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

type Mode = "touch" | "swipe" | any;

interface DefaultStageProps {
    vid2: string; // Kept for legacy compatibility
    vid3: string; // Kept for legacy compatibility
    videoArray?: string[]; // ✅ Ensure this type is string[] or any[] based on your data
    dims: { width: number; height: number };
    mode: Mode;
    setmode: (m: Mode) => void;
    stage: number;
    setStage: (s: number) => void;
    enterSwipeEdit: () => void;
    enterTouchEdit: () => void;
    wipeInteractionState: any;
    setAddVoice: any;
    setIdentifier: any;
    mainAudioUrl: any;
    intbg?: any;
    setintbg?: any;
    /**
     * Opens the interaction node map. Optional so the component still renders
     * before the map is wired up in InteractInput.
     */
    onOpenNodeMap?: () => void;
}

const DefaultStageUI: React.FC<DefaultStageProps> = ({
    videoArray, // ✅ Receiving the prop passed from InteractInput
    dims,
    mode,
    enterSwipeEdit,
    enterTouchEdit,
    wipeInteractionState,
    setAddVoice,
    setIdentifier,
    mainAudioUrl,
    intbg,
    setintbg,
    onOpenNodeMap
}) => {

    const [confirmOpen, setConfirmOpen] = useState(false);
    const videoStripRef = useRef<HTMLDivElement | null>(null);

    // ✅ LOGIC: Use the FULL videoArray — length is driven by what is actually in
    // localStorage (A-shots + B-shots), no fixed 9-item cap.
    // Filters out null/undefined/empty string values.
    const videosToList = useMemo(
        () => (videoArray || []).filter((v: any) => v),
        [videoArray]
    );

    // Only decode previews that the user is actually looking at. A preview must
    // remain at least half-visible for one second before playback begins; leaving
    // the strip viewport pauses it immediately and cancels any pending start.
    useEffect(() => {
        const strip = videoStripRef.current;
        if (!strip) return;

        const videos = Array.from(
            strip.querySelectorAll<HTMLVideoElement>("video[data-default-stage-preview]")
        );
        const pendingStarts = new Map<HTMLVideoElement, number>();

        const cancelPendingStart = (video: HTMLVideoElement) => {
            const timer = pendingStarts.get(video);
            if (timer !== undefined) {
                window.clearTimeout(timer);
                pendingStarts.delete(video);
            }
        };

        const pausePreview = (video: HTMLVideoElement) => {
            cancelPendingStart(video);
            video.pause();
        };

        const schedulePreview = (video: HTMLVideoElement) => {
            if (!video.paused || pendingStarts.has(video)) return;

            const timer = window.setTimeout(() => {
                pendingStarts.delete(video);
                void video.play().catch(() => {
                    // Muted inline playback is normally allowed. If the browser
                    // still rejects it, leave the thumbnail paused.
                });
            }, 1000);

            pendingStarts.set(video, timer);
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target as HTMLVideoElement;
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        schedulePreview(video);
                    } else {
                        pausePreview(video);
                    }
                });
            },
            {
                root: strip,
                threshold: [0, 0.5, 1],
            }
        );

        videos.forEach((video) => observer.observe(video));

        const handleVisibilityChange = () => {
            if (document.hidden) videos.forEach(pausePreview);
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            observer.disconnect();
            videos.forEach(pausePreview);
        };
    }, [videosToList]);

    return (
        <>
            {/* ✅ Horizontal Scroll Container */}
            <div
                ref={videoStripRef}
                className="no-scrollbar"
                style={{
                    position: "absolute",
                    top: 12,
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "row",
                    overflowX: "auto",
                    paddingLeft: 12,
                    paddingRight: 12,
                    gap: 12,
                    zIndex: 3,
                    pointerEvents: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                }}
            >
                {videosToList.map((src: string, index: number) => (
                    <div key={index} style={{ flexShrink: 0 }}>
                        <video
                            data-default-stage-preview
                            src={src}
                            playsInline
                            muted
                            loop
                            preload="metadata"
                            style={{
                                width: Math.max(160, Math.min(240, (dims.width || 800) * 0.22)),
                                height: "auto",
                                aspectRatio: "16 / 9",
                                objectFit: "cover",
                                borderRadius: 12,
                                boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                                outline: "none",
                                backgroundColor: "#000"
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Swipe button */}
            <div
                role="button"
                tabIndex={0}
                onClick={enterSwipeEdit}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && enterSwipeEdit()}
                style={{
                    position: "absolute",
                    right: 16,
                    bottom: "50%",
                    transform: "translateY(50%)",
                    width: Math.max(140, Math.min(180, (dims.width || 800) * 0.18)),
                    height: Math.max(48, Math.min(64, (dims.height || 450) * 0.08)),
                    display: "none",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: mainAudioUrl ? 1 : 0.3,
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: mode === "swipe" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    cursor: "pointer",
                    zIndex: 4,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(4px)",
                }}
                aria-pressed={mode === "swipe"}
                aria-label="Edit: Swipe mode"
            >
                Swipe
            </div>

            {/* Touch button */}
            <div
                role="button"
                tabIndex={0}
                onClick={enterTouchEdit}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && enterTouchEdit()}
                style={{
                    position: "absolute",
                    right: 16,
                    bottom: "60%",
                    transform: "translateY(50%)",
                    width: Math.max(140, Math.min(180, (dims.width || 800) * 0.18)),
                    height: Math.max(48, Math.min(64, (dims.height || 450) * 0.08)),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: mainAudioUrl ? 1 : 1,
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: mode === "touch" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    cursor: "pointer",
                    zIndex: 4,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(4px)",
                }}
                aria-pressed={mode === "touch"}
                aria-label="Touch mode"
            >
                Touch
            </div>

            {/* Preview — opens the interaction node map. Keeps the original
                85px circle position so nothing else in this layout shifts. */}
            <div
                onClick={() => onOpenNodeMap?.()}
                role="button"
                tabIndex={0}
                aria-label="Preview interaction map"
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenNodeMap?.()}
                style={{
                    position: "absolute",
                    left: "calc(16px + env(safe-area-inset-left))",
                    bottom: "20vh",
                    zIndex: 7,
                    width: 85,
                    height: 85,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.45)",
                    border: `2px solid #ffffff`,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                    cursor: 'pointer'
                }}
            >
                <TimelineIcon style={{ fontSize: 28, color: '#ffffff' }} />
            </div>

            {/* Global music — same handler as before, now on a half-size circle
                sitting to the right of the preview button and centred with it. */}
            <div
                onClick={() => {
                    setIdentifier(0);
                    setAddVoice(true);
                }}
                role="button"
                tabIndex={0}
                aria-label="Add global music"
                onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    setIdentifier(0);
                    setAddVoice(true);
                }}
                style={{
                    position: "absolute",
                    // 16px inset + 85px circle + 12px gap
                    left: "calc(113px + env(safe-area-inset-left))",
                    // Big circle centre is 20vh + 42.5; this one is 43 tall, so
                    // 20vh + 21 puts the two centres on the same line.
                    bottom: "calc(20vh + 21px)",
                    zIndex: 7,
                    width: 43,
                    height: 43,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.45)",
                    border: `2px solid #ffffff`,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                    cursor: 'pointer'
                }}
            >
                <MusicNoteIcon style={{ fontSize: 16, color: '#ffffff' }} />
            </div>

            <div
                style={{
                    position: "absolute",
                    left: "calc(16px + env(safe-area-inset-left))", // Aligned with button above
                    bottom: "calc(20vh - 65px)", // Positions it right under the 20vh button
                    zIndex: 7,
                    height: 50, // Smaller height than the button
                    padding: "0 20px",
                    borderRadius: "25px", // Pill shape
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    background: "rgba(0,0,0,0.45)", // Same design
                    border: `2px solid #ffffff`,      // Same design
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)", // Same design
                    backdropFilter: "blur(2px)",      // Same design
                }}
            >
                {/* Label Text */}
                <span style={{
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                }}>
                    Use this Audio  for all scenes
                </span>

                {/* The Custom Toggle Switch */}
                <div
                    onClick={() => setintbg(intbg === 0 ? 1 : 0)}
                    style={{
                        width: '40px',
                        height: '22px',
                        background: intbg === 1 ? '#34C759' : 'rgba(255,255,255,0.3)', // Green if ON, Gray if OFF
                        borderRadius: '11px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background 0.3s ease'
                    }}
                >
                    {/* The Toggle Circle (Knob) */}
                    <div style={{
                        width: '18px',
                        height: '18px',
                        background: '#ffffff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: intbg === 1 ? '20px' : '2px', // Moves knob left/right
                        transition: 'left 0.3s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                    }} />
                </div>
            </div>

            {/* Back / Delete Button */}
            <button
                onClick={() => setConfirmOpen(true)}
                aria-label="Back to Edit"
                style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: "rgba(0,0,0,0.35)",
                    color: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 7,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                    display: "flex",
                }}
            >
                <DeleteForeverIcon style={{ fontSize: 20 }} />
            </button>

            {confirmOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirm permanent deletion"
                    style={{
                        position: "absolute",
                        top: 68,
                        left: 16,
                        zIndex: 8,
                        minWidth: 260,
                        maxWidth: 320,
                        padding: 12,
                        borderRadius: 12,
                        border: "2px solid rgba(255,255,255,0.9)",
                        background: "rgba(0,0,0,0.55)",
                        color: "#fff",
                        boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Delete forever?</div>
                    <div style={{ opacity: 0.9, lineHeight: 1.4, marginBottom: 12 }}>
                        This item will be deleted permanently.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={() => {
                                wipeInteractionState();
                                setConfirmOpen(false);
                            }}
                            style={{
                                flex: 1,
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "2px solid rgba(255,255,255,0.95)",
                                background: "rgba(215,0,0,0.9)",
                                color: "#fff",
                                cursor: "pointer",
                                fontWeight: 800,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                            }}
                        >
                            Yes, delete
                        </button>
                        <button
                            onClick={() => setConfirmOpen(false)}
                            style={{
                                flex: 1,
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "2px solid rgba(255,255,255,0.6)",
                                background: "rgba(255,255,255,0.15)",
                                color: "#fff",
                                cursor: "pointer",
                                fontWeight: 700,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                            }}
                        >
                            No, keep
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default DefaultStageUI;
