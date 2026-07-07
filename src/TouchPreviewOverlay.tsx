import React from "react";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import SendIcon from "@mui/icons-material/Send";
import HomeIcon from "@mui/icons-material/Home";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import Button from "@mui/material/Button";
import { matchMobile } from "./DetectDevice";
import { useSelector } from "react-redux";
import { RootState } from "./store";

import type { Hotspot } from "./TouchPreviewStageUI"; // or your shared types file

interface OverlayProps {
    // hotspot & lens
    showHotspots: boolean;
    active: null | "left" | "right";
    markerStyle: (id: "left" | "right") => React.CSSProperties;
    makeLensVideoStyle: (hs: Hotspot, zoom: number) => React.CSSProperties;
    hsById: Record<"left" | "right", Hotspot>;
    lensZoomAnimated: number;
    isAutoPlayTimerActive?: boolean;

    // lens video refs
    leftLensVidRef: React.RefObject<HTMLVideoElement>;
    rightLensVidRef: React.RefObject<HTMLVideoElement>;

    // interactions
    primeAudioGesture: () => void;
    playSub: (id: "left" | "right") => void;

    // speaker
    shouldShowSpeaker: boolean;
    enableAudioByUser: () => void;

    // controls
    backToEdit: () => void;
    onPublish: any;
    feeds: any;
    MuteReducer?: boolean;
    toggleMute?: () => void;
    mainRef?: React.RefObject<HTMLVideoElement>;
    isHUDHidden?: boolean;

    // Victory Mode
    videoArray?: any[];
    goodOutcomes?: string[];
    setGoodOutcomes?: (v: string[]) => void;
    isGoodOutcome?: boolean;
    isCurrentNodeVictory?: boolean;
    isLeaf?: boolean;
    goHome?: () => void;
    showFirstImpressionPill?: boolean;
    isRootNode?: boolean;
    interactionPostId?: string | number | null;
}

// Lightweight CSS Confetti Component
const CSSConfetti = () => {
    return (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
            {[...Array(50)].map((_, i) => (
                <div key={i} style={{
                    position: "absolute",
                    width: "8px", height: "16px",
                    backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`,
                    top: "-10%",
                    left: `${Math.random() * 100}%`,
                    opacity: Math.random() + 0.5,
                    transform: `rotate(${Math.random() * 360}deg)`,
                    animation: `fallConfetti ${Math.random() * 2 + 2}s linear forwards`,
                    animationDelay: `${Math.random() * 1}s`
                }} />
            ))}
            <style>{`
                @keyframes fallConfetti {
                    to { transform: translateY(120vh) rotate(720deg); }
                }
            `}</style>
        </div>
    );
};

const TouchPreviewOverlay: React.FC<OverlayProps> = ({
    showHotspots,
    active,
    markerStyle,
    makeLensVideoStyle,
    hsById,
    lensZoomAnimated,
    isAutoPlayTimerActive,
    leftLensVidRef,
    rightLensVidRef,
    primeAudioGesture,
    playSub,
    shouldShowSpeaker,
    enableAudioByUser,
    backToEdit,
    onPublish,
    feeds,
    MuteReducer,
    toggleMute,
    isHUDHidden,
    videoArray,
    goodOutcomes,
    setGoodOutcomes,
    isGoodOutcome,
    isCurrentNodeVictory,
    isLeaf,
    goHome,
    showFirstImpressionPill,
    isRootNode,
    interactionPostId,
    ...props // Capture remaining props (including mainRef)
}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    // First Impressions Check
    const impressions = useSelector((state: RootState) => state.settings.firstImpressions);
    const trials = impressions.find(imp => imp.postId === String(interactionPostId))?.trials || 1;
    const isFirstImpression = trials === 1;

    const [isPublishExpanded, setIsPublishExpanded] = React.useState(false);
    const [hidePill, setHidePill] = React.useState(false);

    React.useEffect(() => {
        if (showFirstImpressionPill) {
            setHidePill(false);
            const tm = setTimeout(() => setHidePill(true), 8000);
            return () => clearTimeout(tm);
        }
    }, [showFirstImpressionPill]);

    // --- VICTORY LOGIC ---
    const [victoryStep, setVictoryStep] = React.useState(0);
    const [isVideoEnded, setIsVideoEnded] = React.useState(false);

    // Track when main video ends
    React.useEffect(() => {
        const main = props.mainRef?.current;
        if (!main) return;
        const onEnd = () => setIsVideoEnded(true);
        const onPlay = () => setIsVideoEnded(false);

        if (main.ended) onEnd();

        main.addEventListener("ended", onEnd);
        main.addEventListener("play", onPlay);
        return () => {
            main.removeEventListener("ended", onEnd);
            main.removeEventListener("play", onPlay);
        };
    }, [props.mainRef?.current]);

    // Victory step timer
    React.useEffect(() => {
        let tm1: NodeJS.Timeout;
        let tm2: NodeJS.Timeout;

        const duration = isFirstImpression ? 5000 : 4000;

        if (isCurrentNodeVictory && isVideoEnded) {
            setVictoryStep(1);
            tm1 = setTimeout(() => {
                setVictoryStep(2);
                tm2 = setTimeout(() => {
                    setVictoryStep(0);
                }, duration);
            }, duration);
        } else {
            setVictoryStep(0);
        }

        return () => {
            clearTimeout(tm1);
            clearTimeout(tm2);
        };
    }, [isCurrentNodeVictory, isVideoEnded, isFirstImpression]);

    // keep nodes mounted; just toggle visibility
    const lensesVisible = showHotspots && active === null;

    const markerCommonVisibility: React.CSSProperties = {
        opacity: lensesVisible ? 1 : 0,
        pointerEvents: lensesVisible ? "auto" : "none",
        transition: "opacity 200ms ease",
    };

    // âœ… NEW: Draw Video Frame to Canvas (Instant, no seek lag)
    const mainRef = (props as any).mainRef; // Access mainRef

    // Track if main video is playing
    const [isMainPlaying, setIsMainPlaying] = React.useState(false);
    React.useEffect(() => {
        const video = mainRef?.current;
        if (!video) return;
        const updatePlayState = () => setIsMainPlaying(!video.paused);
        video.addEventListener("play", updatePlayState);
        video.addEventListener("pause", updatePlayState);
        video.addEventListener("playing", updatePlayState);
        // Initial state
        updatePlayState();
        return () => {
            video.removeEventListener("play", updatePlayState);
            video.removeEventListener("pause", updatePlayState);
            video.removeEventListener("playing", updatePlayState);
        };
    }, [mainRef?.current]);

    React.useEffect(() => {
        if (showHotspots && active === null && mainRef?.current) {
            const v = mainRef.current;

            const draw = (canvasRef: any) => {
                const c = canvasRef.current;
                if (!c || !v) return;
                // Match canvas size to video internal resolution for quality
                if (c.width !== v.videoWidth) c.width = v.videoWidth;
                if (c.height !== v.videoHeight) c.height = v.videoHeight;

                const ctx = c.getContext("2d");
                if (ctx) {
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                }
            };

            // âœ… USER REQUEST: Wait 1 second for video to freeze/settle before drawing
            const timer = setTimeout(() => {
                // Double check we are still attempting to show hotspots
                if (!mainRef.current) return;

                // Draw heavily to ensure we catch the frame
                draw(leftLensVidRef);
                draw(rightLensVidRef);

                // Small RAF loop effectively keeps it synced if video is still settling
                let f = 0;
                const loop = () => {
                    if (f++ < 5) {
                        draw(leftLensVidRef);
                        draw(rightLensVidRef);
                        requestAnimationFrame(loop);
                    }
                };
                loop();
            }, 1000); // 1000ms delay

            return () => clearTimeout(timer);
        }
    }, [showHotspots, active, mainRef, leftLensVidRef, rightLensVidRef]);

    return (
        <>
            {/* Auto-Play Hotspot Timer Loader */}
            {isAutoPlayTimerActive && (
                <div style={{
                    position: "absolute",
                    top: "5vh",
                    left: 0,
                    right: 0,
                    height: "4px",
                    zIndex: 20,
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                    background: "rgba(0, 0, 0, 0.25)", // Subtle dark track behind
                    boxShadow: "0 2px 10px rgba(0,0,0,0.5)" // Dark shadow for the whole bar area
                }}>
                    <div style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#ffffff",
                        transformOrigin: "center",
                        animation: "shrinkToCenterTimer 5s linear forwards",
                        boxShadow: "0 0 8px rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.8)"
                    }} />
                    <style>
                        {`
                        @keyframes shrinkToCenterTimer {
                            0% { transform: scaleX(1); }
                            100% { transform: scaleX(0); }
                        }
                        `}
                    </style>
                </div>
            )}

            {/* --- VICTORY PILL --- */}
            {victoryStep > 0 && (
                <>
                    {/* Fire confetti on step 1 if it is a First Impression */}
                    {victoryStep === 1 && isFirstImpression && <CSSConfetti />}

                    <div style={{
                        position: "absolute",
                        top: 40,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: `url("data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='none' rx='30' stroke='rgba(255,255,255,0.9)' stroke-width='4' stroke-dasharray='10 10' stroke-dashoffset='0'%3E%3Canimate attributeName='stroke-dashoffset' values='20;0' dur='0.8s' repeatCount='indefinite' linear='true'/%3E%3C/rect%3E%3C/svg%3E"), linear-gradient(${darkModeReducer ? "rgba(232, 186, 250, 0.9), rgba(232, 186, 250, 0.9)" : "rgba(0, 153, 204, 0.9), rgba(0, 153, 204, 0.9)"})`,
                        backdropFilter: "blur(10px)",
                        border: "none",
                        padding: "10px 24px",
                        borderRadius: 30,
                        color: "#000",
                        fontWeight: 700,
                        fontSize: victoryStep === 1 ? "18px" : (isFirstImpression ? "16px" : "14px"),
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        zIndex: 9999,
                        animation: "fadeIn 0.5s ease"
                    }}>
                        {victoryStep === 1 ? (
                            <>
                                {isFirstImpression ? (
                                    <><span style={{ fontSize: "20px" }}>ðŸŽ‰</span> First Impressions</>
                                ) : (
                                    <><span style={{ fontSize: "20px" }}>ðŸ˜Š</span> Completed</>
                                )}
                            </>
                        ) : (
                            <>
                                {isFirstImpression ? (
                                    `@${feeds?.username || "creator"}: First Trial. Impressive ðŸ‘`
                                ) : (
                                    `Credits: @${feeds?.username || "creator"}`
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* FULL SCREEN GRADIENT FOR LENS EFFECT */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                {hsById.left.svgPath && (
                    <clipPath id="ai-mask-left" clipPathUnits="objectBoundingBox">
                        <path transform={`scale(${1 / (hsById.left.maskWidth || 1080)}, ${1 / (hsById.left.maskHeight || 1920)})`} d={hsById.left.svgPath} />
                    </clipPath>
                )}
                {hsById.right.svgPath && (
                    <clipPath id="ai-mask-right" clipPathUnits="objectBoundingBox">
                        <path transform={`scale(${1 / (hsById.right.maskWidth || 1080)}, ${1 / (hsById.right.maskHeight || 1920)})`} d={hsById.right.svgPath} />
                    </clipPath>
                )}
            </svg>

            <style>
                {`
                @keyframes aiShapePulse {
                    0% { opacity: 0; }
                    75% { opacity: 0; }
                    77.5% { opacity: 0.4; }
                    97.5% { opacity: 0.4; }
                    100% { opacity: 0; }
                }
                .ai-shape-outline {
                    pointer-events: none;
                    z-index: 10;
                    filter: drop-shadow(0px 0px 3px rgba(255, 255, 255, 0.8)) drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.4));
                }
                .ai-shape-outline.hotspot-canvas-ai {
                    animation: aiShapePulse 8s infinite, aiHotspotPulse 0.933s infinite ease-in-out;
                }
                @keyframes hotspotPulse {
                    0% { transform: scale(0.97); }
                    50% { transform: scale(1.07); }
                    100% { transform: scale(0.97); }
                }
                @keyframes aiHotspotPulse {
                    0% { transform: scale(1.028); }
                    50% { transform: scale(1.134); }
                    100% { transform: scale(1.028); }
                }
                .hotspot-canvas {
                    animation: hotspotPulse 0.933s infinite ease-in-out;
                }
                .hotspot-canvas-ai {
                    animation: aiHotspotPulse 0.933s infinite ease-in-out;
                }
                @media (hover: hover) {
                    .hotspot:hover .hotspot-canvas,
                    .hotspot:hover .hotspot-canvas-ai {
                        animation-play-state: paused;
                    }
                }
                .hotspot:active .hotspot-canvas,
                .hotspot:active .hotspot-canvas-ai {
                    animation-play-state: paused;
                }
                `}
            </style>

            {/* LEFT lens hotspot â€” always mounted */}
            <div
                className={`hotspot ${hsById.left.svgPath ? "" : "show-clik"}`}
                data-text={hsById.left.customText || "CLIK"}
                onPointerDownCapture={primeAudioGesture}
                onTouchStartCapture={primeAudioGesture}
                style={{
                    ...(matchMobile ? markerStyle("left") : markerStyle("left")),
                    ...markerCommonVisibility,
                    boxShadow: hsById.left.svgPath ? 'none' : 'none',
                    overflow: hsById.left.svgPath ? 'visible' : 'hidden',
                    background: hsById.left.svgPath ? 'transparent' : undefined,
                    backdropFilter: hsById.left.svgPath ? 'none' : undefined,
                    WebkitBackdropFilter: hsById.left.svgPath ? 'none' : undefined,
                    border: hsById.left.svgPath ? 'none' : undefined,
                    cursor: 'pointer',
                }}
                onClick={() => playSub("left")}
                aria-label="Play left sub"
            >
                {/* Invisible solid click target to prevent click-through on complex AI shapes (like fans) */}
                {hsById.left.svgPath && (
                    <div style={{
                        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                        width: '180%', height: '180%', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.001)', cursor: 'pointer', zIndex: 1
                    }} />
                )}

                {/* BRANDING SIGNAL: Spinning Dashed Border */}
                <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: hsById.left.svgPath ? "none" : "2px dashed rgba(255,255,255,0.65)",
                    animation: "clikSpin 10s linear infinite",
                    pointerEvents: "none", zIndex: 1, boxSizing: "border-box"
                }} />

                <canvas
                    ref={leftLensVidRef as any}
                    className={hsById.left.svgPath ? "hotspot-canvas-ai" : "hotspot-canvas"}
                    style={{
                        ...makeLensVideoStyle(hsById.left),
                        pointerEvents: (hsById.left.svgPath && lensesVisible) ? "auto" : "none",
                        ...(hsById.left.svgPath ? {
                            clipPath: `url(#ai-mask-left)`,
                            WebkitClipPath: `url(#ai-mask-left)`
                        } : {})
                    }}
                    aria-hidden="true"
                />

                {/* Visual Outline SVG */}
                {hsById.left.svgPath && (
                    <svg
                        className="ai-shape-outline hotspot-canvas-ai"
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        style={makeLensVideoStyle(hsById.left)}
                    >
                        <path
                            transform={`scale(${1 / (hsById.left.maskWidth || 1080)}, ${1 / (hsById.left.maskHeight || 1920)})`}
                            d={hsById.left.svgPath}
                            stroke="rgba(255,255,255,0.7)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                            fill="none"
                        />
                    </svg>
                )}
            </div>

            {/* RIGHT lens hotspot â€” always mounted */}
            <div
                className={`hotspot ${hsById.right.svgPath ? "" : "show-clik"}`}
                data-text={hsById.right.customText || "CLIK"}
                onPointerDownCapture={primeAudioGesture}
                onTouchStartCapture={primeAudioGesture}
                style={{
                    ...(matchMobile ? markerStyle("right") : markerStyle("right")),
                    ...markerCommonVisibility,
                    boxShadow: hsById.right.svgPath ? 'none' : 'none',
                    overflow: hsById.right.svgPath ? 'visible' : 'hidden',
                    background: hsById.right.svgPath ? 'transparent' : undefined,
                    backdropFilter: hsById.right.svgPath ? 'none' : undefined,
                    WebkitBackdropFilter: hsById.right.svgPath ? 'none' : undefined,
                    border: hsById.right.svgPath ? 'none' : undefined,
                    cursor: 'pointer',
                }}
                onClick={() => playSub("right")}
                aria-label="Play right sub"
            >
                {/* Invisible solid click target to prevent click-through on complex AI shapes (like fans) */}
                {hsById.right.svgPath && (
                    <div style={{
                        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                        width: '180%', height: '180%', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.001)', cursor: 'pointer', zIndex: 1
                    }} />
                )}

                {/* BRANDING SIGNAL: Spinning Dashed Border */}
                <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: hsById.right.svgPath ? "none" : "2px dashed rgba(255,255,255,0.65)",
                    animation: "clikSpin 10s linear infinite",
                    pointerEvents: "none", zIndex: 1, boxSizing: "border-box"
                }} />

                <canvas
                    ref={rightLensVidRef as any}
                    className={hsById.right.svgPath ? "hotspot-canvas-ai" : "hotspot-canvas"}
                    style={{
                        ...makeLensVideoStyle(hsById.right),
                        pointerEvents: (hsById.right.svgPath && lensesVisible) ? "auto" : "none",
                        ...(hsById.right.svgPath ? {
                            clipPath: `url(#ai-mask-right)`,
                            WebkitClipPath: `url(#ai-mask-right)`
                        } : {})
                    }}
                    aria-hidden="true"
                />

                {/* Visual Outline SVG */}
                {hsById.right.svgPath && (
                    <svg
                        className="ai-shape-outline hotspot-canvas-ai"
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        style={makeLensVideoStyle(hsById.right)}
                    >
                        <path
                            transform={`scale(${1 / (hsById.right.maskWidth || 1080)}, ${1 / (hsById.right.maskHeight || 1920)})`}
                            d={hsById.right.svgPath}
                            stroke="rgba(255,255,255,0.7)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                            fill="none"
                        />
                    </svg>
                )}
            </div>

            {/* hotspot effects (BIGGER hover + click/active bounce + BORDER BLINK) */}
            <style>
                {`
          .hotspot {
            position: absolute;
            /* keep your inline transform from markerStyle; we only add transitions */
            transition: transform 160ms ease, opacity 200ms ease, box-shadow 160ms ease;
            will-change: transform, opacity;
          }

          /* âœ… FIXED BORDER BLINK LOOP */
          /* Using ::after to ensure it sits ON TOP of video content */
          .hotspot.show-clik::after {
            content: '';
            position: absolute;
            /* inset: 0 ensures it fits INSIDE the overflow:hidden container so it is visible */
            inset: 0;
            border-radius: 50%;
            /* 4px transparent gray-white border removed in favor of dashed branding */
            border: none;
            opacity: 0;
            pointer-events: none;
            z-index: 10; /* Force on top of video */
            /* 5s total cycle: 2s blinking + 3s waiting */
            animation: border-blink-loop 5s linear infinite;
          }

          @keyframes border-blink-loop {
            /* --- 0s to 2s: Blink ON/OFF twice (approx 40% of 5s) --- */
            0%    { opacity: 0; }
            5%    { opacity: 1; }  /* ~0.25s ON */
            15%   { opacity: 0; }  /* ~0.75s OFF */
            25%   { opacity: 1; }  /* ~1.25s ON */
            35%   { opacity: 0; }  /* ~1.75s OFF (End of blink) */

            /* --- 2s to 5s: Wait (Opacity stays 0) --- */
            100%  { opacity: 0; }
          }

          /* âœ… NEW: Dark Glass "Clik" Branding */
          .hotspot.show-clik::before {
            content: attr(data-text);
            position: absolute;
            inset: 0;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 800;
            font-size: 1.1rem;
            letter-spacing: 1.5px;
            font-family: system-ui, -apple-system, sans-serif;
            text-transform: uppercase;
            z-index: 11; /* Above border and canvas */
            /* Glassmorphism */
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            pointer-events: none;
            /* Inverse animation of the border blink */
            animation: glass-fade-loop 5s linear infinite;
          }

          @keyframes glass-fade-loop {
            /* 0s to 1.75s (35%): Invisible while border blinks */
            0%    { opacity: 0; }
            35%   { opacity: 0; }

            /* 2s (40%) to 4.75s (95%): Show dark glass + text */
            40%   { opacity: 1; }
            95%   { opacity: 1; }

            /* Fade out just before blink restarts */
            100%  { opacity: 0; }
          }

          /* bigger, more obvious hover bounce */
          .hotspot:hover {
            animation: hs-bounce-big 520ms cubic-bezier(.34,1.56,.64,1) both;
          }

          /* focus-visible for keyboard users (matches hover feel) */
          .hotspot:focus-visible {
            outline: none;
            animation: hs-bounce-big 520ms cubic-bezier(.34,1.56,.64,1) both;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.18);
          }

          /* stronger press/click bounce */
          .hotspot:active {
            animation: hs-press-big 260ms cubic-bezier(.4,0,.2,1) both;
          }

          @keyframes hs-bounce-big {
            0%   { transform: translate(-50%, -50%) scale(1); }
            40%  { transform: translate(-50%, -50%) scale(1.16); } /* higher peak */
            70%  { transform: translate(-50%, -50%) scale(1.08); }
            100% { transform: translate(-50%, -50%) scale(1.05); } /* settles above 1 */
          }

          @keyframes hs-press-big {
            0%   { transform: translate(-50%, -50%) scale(1); }
            60%  { transform: translate(-50%, -50%) scale(0.88); } /* deeper press */
            100% { transform: translate(-50%, -50%) scale(0.96); } /* subtle settle */
          }
        `}
            </style>

            {/* Speaker button (unlock) */}
            {shouldShowSpeaker && (
                <button
                    onClick={enableAudioByUser}
                    aria-label="Enable audio"
                    style={{
                        position: "absolute",
                        top: 12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,0.25)",
                        background:
                            "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        backdropFilter: "blur(6px) saturate(120%)",
                        WebkitBackdropFilter: "blur(6px) saturate(120%)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 8,
                        opacity: 0,
                        animation: "speakerFade 300ms ease forwards",
                    }}
                >
                    <RecordVoiceOverIcon />
                    <style>{`@keyframes speakerFade { to { opacity: 1 } }`}</style>
                </button>
            )}

            {/* Back arrow */}
            <button
                onClick={backToEdit}
                aria-label="Back to Edit"
                style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: "2px solid rgba(196, 17, 17, 0.9)",
                    background: "rgba(0,0,0,0.35)",
                    color: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 7,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                    display: feeds ? "none" : "flex",
                    opacity: isHUDHidden ? 0 : 1,
                    pointerEvents: isHUDHidden ? "none" : "auto",
                    transition: "opacity 0.3s ease",
                    animation: isHUDHidden ? "none" : "ctrlFade 280ms ease forwards 140ms",
                }}
            >
                <ArrowBackIosNewIcon style={{ fontSize: 20 }} />
            </button>
            {/* FIRST IMPRESSION PILL */}
            {showFirstImpressionPill && !hidePill && active === null && (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        setHidePill(true);
                    }}
                    style={{
                        position: "absolute",
                        top: "30vh",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "rgba(0, 230, 118, 0.2)",
                        border: "2px solid #00E676",
                        color: "#fff",
                        padding: "8px 16px",
                        borderRadius: "24px",
                        fontSize: "14px",
                        fontWeight: 700,
                        backdropFilter: "blur(4px)",
                        boxShadow: "0 4px 12px rgba(0,230,118,0.4)",
                        zIndex: 10,
                        pointerEvents: "auto",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        opacity: isHUDHidden ? 0 : 1,
                        transition: "opacity 0.3s ease",
                        animation: isHUDHidden ? "none" : "ctrlFade 280ms ease forwards",
                    }}
                >
                    <span style={{ fontSize: "16px", display: "inline-block", animation: "wobbleEmoji 1s ease-in-out infinite" }}>ðŸ˜„</span> First Impression
                </div>
            )}

            {/* Mute Toggle Button (Top Right) */}
            {/* Mute Toggle / Home Button (Top Right) */}
            {(!feeds || isLeaf) && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isLeaf) {
                            goHome?.();
                        } else {
                            toggleMute?.();
                        }
                    }}
                    aria-label={isLeaf ? "Go Home" : "Toggle mute"}
                    style={{
                        position: "absolute",
                        right: 10,
                        top: 10,
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: "2px solid rgba(255, 255, 255, 0.4)",
                        background: "rgba(0,0,0,0.35)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 7,
                        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                        backdropFilter: "blur(2px)",
                        opacity: isHUDHidden ? 0 : 1,
                        pointerEvents: isHUDHidden ? "none" : "auto",
                        transition: "opacity 0.3s ease",
                        animation: isHUDHidden ? "none" : "ctrlFade 280ms ease forwards 140ms",
                    }}
                >
                    {isLeaf ? (
                        <HomeIcon style={{ fontSize: 24 }} />
                    ) : MuteReducer ? (
                        <VolumeOffIcon style={{ fontSize: 24 }} />
                    ) : (
                        <VolumeUpIcon style={{ fontSize: 24 }} />
                    )}
                </button>
            )}

            {/* Tap Icon for iOS Autoplay Fallback (Feeds Mode, Root Node, Paused) */}
            {feeds && isRootNode && active === null && !isMainPlaying && (
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 9,
                        color: "rgba(255,255,255,0.85)",
                        animation: "aiShapePulse 2s infinite ease-in-out",
                        pointerEvents: "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))"
                    }}
                >
                    <TouchAppIcon sx={{ fontSize: 80 }} />
                    <span style={{ fontSize: "1rem", fontWeight: "bold", marginTop: 8 }}>Tap</span>
                </div>
            )}

            {/* --- UPLOAD ICON BUTTON --- */}
            <button
                onClick={() => setIsPublishExpanded(true)}
                style={{
                    position: "absolute", bottom: 16, right: 16, zIndex: 11,
                    width: 44, height: 44, borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: "rgba(0,0,0,0.35)", color: "#fff",
                    display: feeds || isPublishExpanded ? "none" : "flex",
                    alignItems: "center", justifyContent: "center",
                    cursor: "pointer", backdropFilter: "blur(2px)",
                    opacity: isHUDHidden ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isHUDHidden ? "none" : "auto",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    animation: isHUDHidden ? "none" : "ctrlFade 280ms ease forwards 180ms",
                }}
            >
                <SendIcon style={{ fontSize: 20, marginLeft: 2 }} />
            </button>

            {/* Bottom full-width PUBLISH button and Good Outcome UI */}
            {isPublishExpanded && (
                <>
                    {/* Invisible Backdrop to close the popup when clicking outside */}
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsPublishExpanded(false);
                        }}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 6,
                            background: "transparent",
                            cursor: "pointer"
                        }}
                    />

                    <div
                        style={{
                            position: "fixed",
                            left: matchMobile ? 0 : "20%",
                            right: matchMobile ? 0 : "20%",
                            width: matchMobile ? "auto" : "60%",
                            bottom: matchMobile ? 0 : 24,
                            borderRadius: matchMobile ? 0 : 16,
                            padding: 12,
                            zIndex: 7,
                            display: feeds ? "none" : "flex",
                            flexDirection: "column",
                            gap: 12,
                            opacity: isHUDHidden ? 0 : 1,
                            pointerEvents: isHUDHidden ? "none" : "auto",
                            transition: "opacity 0.3s ease",
                            animation: isHUDHidden ? "none" : "ctrlFade 150ms ease forwards",
                        }}
                    >
                    {/* SLEEK CIRCULAR THUMBNAIL UI FOR OUTCOMES - Hidden per user request */}

                    <Button
                        variant="contained"
                        fullWidth
                        onClick={() => {
                            onPublish?.();
                            setIsPublishExpanded(false);
                        }}
                        sx={{
                            py: 1.5,
                            fontWeight: 700,
                            borderRadius: 2,
                            backgroundColor: darkModeReducer ? "#000000" : "#ffffff",
                            color: darkModeReducer ? "#ffffff" : "#000000",
                            '&:hover': {
                                backgroundColor: darkModeReducer ? "#333333" : "#f0f0f0"
                            }
                        }}
                    >
                        Publish
                    </Button>
                </div>
                </>
            )}
            <style>{`
                @keyframes ctrlFade { to { opacity: 1 } }
                @keyframes wobbleEmoji {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px) rotate(-10deg); }
                    75% { transform: translateX(4px) rotate(10deg); }
                }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </>
    );
};

export default TouchPreviewOverlay;
