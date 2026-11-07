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
import { useDispatch, useSelector } from "react-redux";
import { incrementFirstImpression } from "./settingsSlice";
import { RootState } from "./store";
import CompletionConfetti from "./components/CompletionConfetti";

import { BRANCH_IDS, BranchId, Hotspot } from "./TouchInteractionModel";
import { HoldPlaybackState } from "./TouchHoldPlaybackModel";

interface OverlayProps {
    // hotspot & lens
    showHotspots: boolean;
    active: BranchId | null;
    markerStyle: (id: BranchId) => React.CSSProperties;
    makeLensVideoStyle: (hs: Hotspot, zoom: number) => React.CSSProperties;
    hsById: Record<BranchId, Hotspot>;
    lensZoomAnimated: number;
    isAutoPlayTimerActive?: boolean;

    // lens video refs
    lensCanvasRefs: Record<BranchId, React.RefObject<HTMLCanvasElement>>;

    // interactions
    primeAudioGesture: () => void;
    playSub: (id: BranchId) => void;

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
    onFirstImpressionPillVisibilityChange?: (visible: boolean) => void;
    isRootNode?: boolean;
    interactionPostId?: string | number | null;
    victoryVideoEnded?: boolean;
    victoryKey?: string;

    // Hold to Play. The overlay only REPORTS gestures — it never touches media.
    holdSession?: HoldPlaybackState;
    /** Choices may be drawn while still disabled, so a held finger cannot pick one. */
    choicesEnabled?: boolean;
    autoPlayTimerDurationMs?: number;
    beginHold?: (branch: BranchId, pointerId: number | null) => void;
    releaseHold?: (pointerId: number | null) => void;

    // NOTE: Drag & Hold's Stick is deliberately NOT here. This component lives
    // inside <React.Fragment key={visitKey}> and is torn down on every node
    // change, and the Stick has to outlive the very navigation that locking a
    // lane causes. It is rendered by TouchPreviewStageUI instead, next to the
    // transition snapshot canvas — the other element that must survive a
    // remount in order to do its job.
}

/** #rgb / #rrggbb -> rgba(), so one theme colour can drive fills and glows. */
const hexToRgba = (hex: string, alpha: number): string => {
    const value = String(hex || "").replace("#", "");
    const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    const int = parseInt(full, 16);
    if (full.length !== 6 || Number.isNaN(int)) return `rgba(255,255,255,${alpha})`;
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

/** Perceived brightness, to decide whether text on this colour should be black. */
const isLightColor = (hex: string): boolean => {
    const value = String(hex || "").replace("#", "");
    const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    const int = parseInt(full, 16);
    if (full.length !== 6 || Number.isNaN(int)) return true;
    const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
};

const TouchPreviewOverlay: React.FC<OverlayProps> = ({
    showHotspots,
    active,
    markerStyle,
    makeLensVideoStyle,
    hsById,
    lensZoomAnimated,
    isAutoPlayTimerActive,
    lensCanvasRefs,
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
    onFirstImpressionPillVisibilityChange,
    isRootNode,
    interactionPostId,
    victoryVideoEnded,
    victoryKey,
    holdSession = null,
    choicesEnabled = true,
    autoPlayTimerDurationMs = 5000,
    beginHold,
    releaseHold,
    ...props // Capture remaining props (including mainRef)
}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const dispatch = useDispatch();

    // The app's own brand colour, so these follow the theme the creator picked
    // rather than the literals that were baked in here.
    const appColor = darkModeReducer ? appColorDark : appColorLight;
    // Dark brand colours need light text on them and vice versa.
    const onAppColor = isLightColor(appColor) ? "#000" : "#fff";
    
    // First Impressions Check
    const impressions = useSelector((state: RootState) => state.settings.firstImpressions);
    const trials = impressions.find(imp => imp.postId === String(interactionPostId))?.trials || 1;
    const isFirstImpression = trials === 1;

    const [isPublishExpanded, setIsPublishExpanded] = React.useState(false);
    const [hidePill, setHidePill] = React.useState(false);
    React.useEffect(() => {
        onFirstImpressionPillVisibilityChange?.(Boolean(showFirstImpressionPill && !hidePill && active === null && !isHUDHidden));
    }, [onFirstImpressionPillVisibilityChange, showFirstImpressionPill, hidePill, active, isHUDHidden]);

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
    const [victoryWasFirstImpression, setVictoryWasFirstImpression] = React.useState(false);

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

    const isFirstImpressionRef = React.useRef(isFirstImpression);
    const interactionPostIdRef = React.useRef(interactionPostId);

    React.useEffect(() => {
        isFirstImpressionRef.current = isFirstImpression;
    }, [isFirstImpression]);

    React.useEffect(() => {
        interactionPostIdRef.current = interactionPostId;
    }, [interactionPostId]);

    const effectiveVideoEnded = typeof victoryVideoEnded === "boolean" ? victoryVideoEnded : isVideoEnded;
    const activeVictoryKey = isCurrentNodeVictory && effectiveVideoEnded
        ? String(victoryKey || interactionPostId || "victory")
        : "";

    // Victory step timer
    React.useEffect(() => {
        let tm1: NodeJS.Timeout;
        let tm2: NodeJS.Timeout;

        if (activeVictoryKey) {
            const wasFirstImpression = isFirstImpressionRef.current;
            const postId = interactionPostIdRef.current;
            const duration = wasFirstImpression ? 5000 : 4000;

            setVictoryWasFirstImpression(wasFirstImpression);
            setVictoryStep(1);

            if (wasFirstImpression && postId) {
                dispatch(incrementFirstImpression(String(postId)));
            }

            tm1 = setTimeout(() => {
                setVictoryStep(2);
                tm2 = setTimeout(() => {
                    setVictoryStep(0);
                }, duration);
            }, duration);
        } else {
            setVictoryStep(0);
            setVictoryWasFirstImpression(false);
        }

        return () => {
            clearTimeout(tm1);
            clearTimeout(tm2);
        };
    }, [activeVictoryKey, dispatch]);

    // keep nodes mounted; just toggle visibility
    const lensesVisible = showHotspots && active === null;

    const markerCommonVisibility: React.CSSProperties = {
        opacity: lensesVisible ? 1 : 0,
        pointerEvents: lensesVisible ? "auto" : "none",
        transition: "opacity 200ms ease",
    };

    // ✅ NEW: Draw Video Frame to Canvas (Instant, no seek lag)
    const mainRef = (props as any).mainRef; // Access mainRef

    // Track if main video is playing
    const [isMainPlaying, setIsMainPlaying] = React.useState(false);
    /**
     * Latch: has the main video played at all during this mount?
     *
     * The Tap hint exists for ONE failure — autoplay never started. Once the video
     * has played, that failure is disproved for good, so the hint must never
     * return. Keyed off "is playing" alone it also reappeared every later pause,
     * and main is deliberately paused at the end of every scene to reveal the
     * choices — so the hand sat on top of the live hotspots telling the viewer to
     * tap when there was nothing to start.
     *
     * Reset comes from remounting: a new post in the feed, or reloading the
     * interaction, gets a fresh component and a fresh chance to show the hint.
     */
    const [hasPlayedOnce, setHasPlayedOnce] = React.useState(false);
    React.useEffect(() => {
        const video = mainRef?.current;
        if (!video) return;
        const updatePlayState = () => {
            const playing = !video.paused;
            setIsMainPlaying(playing);
            if (playing) setHasPlayedOnce(true);
        };
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

            // ✅ USER REQUEST: Wait 1 second for video to freeze/settle before drawing
            const timer = setTimeout(() => {
                // Double check we are still attempting to show hotspots
                if (!mainRef.current) return;

                // Draw heavily to ensure we catch the frame
                BRANCH_IDS.forEach((branch) => draw(lensCanvasRefs[branch]));

                // Small RAF loop effectively keeps it synced if video is still settling
                let f = 0;
                const loop = () => {
                    if (f++ < 5) {
                        BRANCH_IDS.forEach((branch) => draw(lensCanvasRefs[branch]));
                        requestAnimationFrame(loop);
                    }
                };
                loop();
            }, 1000); // 1000ms delay

            return () => clearTimeout(timer);
        }
    }, [showHotspots, active, mainRef, lensCanvasRefs]);

    const keyHeldRef = React.useRef(false);


    /**
     * The control the viewer is physically holding. Drawn from the session
     * snapshot rather than the live hotspot, because a child or loop route has
     * already replaced currentNode — the source hotspot no longer exists in state.
     *
     * Positioned from normalized centre/radius rather than the source AI mask: a
     * segmentation path traced on the source frame is meaningless over the
     * destination video and would give an unusable hit target.
     */
    const renderHoldController = () => {
        if (!holdSession) return null;
        const { controller, phase, branch } = holdSession;
        const pressed = phase === "playing";
        const awaitingRelease = phase === "completed-awaiting-release";
        const label = awaitingRelease ? "RELEASE" : (controller.customText || "HOLD");

        return (
            <div
                key={`hold-controller-${holdSession.sessionId}`}
                className="hotspot show-clik"
                data-text={label}
                role="button"
                tabIndex={0}
                aria-pressed={pressed}
                aria-label={`Hold to play ${branch}`}
                onPointerDownCapture={primeAudioGesture}
                onTouchStartCapture={primeAudioGesture}
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
                style={{
                    position: "absolute",
                    left: `${controller.x * 100}%`,
                    top: `${controller.y * 100}%`,
                    transform: `translate(-50%, -50%) scale(${pressed ? 0.94 : 1})`,
                    width: `max(${controller.r * 200}%, 88px)`,
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                    border: pressed
                        ? "3px solid rgba(255,255,255,0.95)"
                        : "2px dashed rgba(255,255,255,0.75)",
                    boxShadow: pressed ? "0 0 26px rgba(255,255,255,0.35)" : "0 6px 18px rgba(0,0,0,0.35)",
                    transition: "transform 120ms ease, border 160ms ease, box-shadow 160ms ease",
                    cursor: "pointer",
                    touchAction: "none",
                    zIndex: 8,
                }}
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    beginHold?.(branch, event.pointerId);
                }}
                onKeyDown={(event) => {
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    if (event.repeat || keyHeldRef.current) return;
                    keyHeldRef.current = true;
                    beginHold?.(branch, null);
                }}
                onKeyUp={(event) => {
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    keyHeldRef.current = false;
                    releaseHold?.(null);
                }}
                onClick={(event) => event.stopPropagation()}
            />
        );
    };

    const renderHotspot = (branch: BranchId) => {
        const hotspot = hsById[branch];
        const isHold = hotspot.holdToPlay === true;
        const label = hotspot.customText || (isHold ? "HOLD" : "CLIK");

        return (
            <div
                key={branch}
                data-ai-action={!isHold && choicesEnabled ? `clikb.feeds.hotspot.tap_${branch}` : undefined}
                className={`hotspot ${hotspot.svgPath ? "" : "show-clik"}`}
                // Ordinary hotspots never inherit an active Hold session's text.
                // RELEASE belongs exclusively to renderHoldController().
                data-text={label}
                onPointerDownCapture={primeAudioGesture}
                onTouchStartCapture={primeAudioGesture}
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
                role="button"
                tabIndex={0}
                aria-pressed={isHold ? false : undefined}
                style={{
                    ...markerStyle(branch),
                    ...markerCommonVisibility,
                    boxShadow: "none",
                    overflow: hotspot.svgPath ? "visible" : "hidden",
                    background: hotspot.svgPath ? "transparent" : undefined,
                    backdropFilter: hotspot.svgPath ? "none" : undefined,
                    WebkitBackdropFilter: hotspot.svgPath ? "none" : undefined,
                    border: hotspot.svgPath ? "none" : undefined,
                    cursor: "pointer",
                    // Only the active Hold hotspot opts out of browser gestures, so
                    // ordinary scrolling elsewhere on the page is unaffected.
                    touchAction: isHold ? "none" : undefined,
                    transform: (markerStyle(branch) as any).transform,
                    // These two keys come AFTER the ...markerCommonVisibility spread,
                    // so they replace it outright — including when the value is
                    // undefined. Writing them naively made every hotspot permanently
                    // visible and clickable, ignoring showHotspots entirely, so a
                    // circle appeared the moment a destination node loaded instead of
                    // when its video ended. lensesVisible must stay the outer gate.
                    pointerEvents: lensesVisible && choicesEnabled ? "auto" : "none",
                    opacity: lensesVisible ? (choicesEnabled ? 1 : 0.55) : 0,
                }}
                onPointerDown={(event) => {
                    if (!isHold) return;
                    event.preventDefault();
                    event.stopPropagation();
                    beginHold?.(branch, event.pointerId);
                }}
                onKeyDown={(event) => {
                    if (!isHold) return;
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    // Key repeat must not start a second session.
                    if (event.repeat || keyHeldRef.current) return;
                    keyHeldRef.current = true;
                    beginHold?.(branch, null);
                }}
                onKeyUp={(event) => {
                    if (!isHold) return;
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    keyHeldRef.current = false;
                    releaseHold?.(null);
                }}
                onClick={(event) => {
                    if (isHold) return;
                    if (!choicesEnabled) return;
                    playSub(branch);
                }}
                aria-label={isHold ? `Hold to play ${branch}` : `Play ${branch} sub`}
            >
                {hotspot.svgPath && (
                    <div style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "180%",
                        height: "180%",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.001)",
                        cursor: "pointer",
                        zIndex: 1,
                    }} />
                )}

                <div style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: hotspot.svgPath ? "none" : "2px dashed rgba(255,255,255,0.65)",
                    animation: "clikSpin 10s linear infinite",
                    pointerEvents: "none",
                    zIndex: 1,
                    boxSizing: "border-box",
                }} />

                <canvas
                    ref={lensCanvasRefs[branch]}
                    className={hotspot.svgPath ? "hotspot-canvas-ai" : "hotspot-canvas"}
                    style={{
                        ...makeLensVideoStyle(hotspot, lensZoomAnimated),
                        pointerEvents: hotspot.svgPath && lensesVisible ? "auto" : "none",
                        ...(hotspot.svgPath ? {
                            clipPath: `url(#ai-mask-${branch})`,
                            WebkitClipPath: `url(#ai-mask-${branch})`,
                        } : {}),
                    }}
                    aria-hidden="true"
                />

                {hotspot.svgPath && (
                    <svg className="ai-shape-outline hotspot-canvas-ai" viewBox="0 0 1 1" preserveAspectRatio="none" style={makeLensVideoStyle(hotspot, lensZoomAnimated)}>
                        <path
                            transform={`scale(${1 / (hotspot.maskWidth || 1080)}, ${1 / (hotspot.maskHeight || 1920)})`}
                            d={hotspot.svgPath}
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
        );
    };


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
                        animation: `shrinkToCenterTimer ${autoPlayTimerDurationMs}ms linear forwards`,
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
                    {victoryStep === 1 && victoryWasFirstImpression && <CompletionConfetti
                        appColor={appColor}
                        alternateColor={darkModeReducer ? appColorLight : appColorDark}
                        accentColor={darkModeReducer ? "#ff334f" : "#E69500"}
                        variant="fall"
                    />}
                    
                    <div style={{
                        position: "absolute",
                        top: 40,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: `url("data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='none' rx='30' stroke='rgba(255,255,255,0.9)' stroke-width='4' stroke-dasharray='10 10' stroke-dashoffset='0'%3E%3Canimate attributeName='stroke-dashoffset' values='20;0' dur='0.8s' repeatCount='indefinite' linear='true'/%3E%3C/rect%3E%3C/svg%3E"), linear-gradient(${hexToRgba(appColor, 0.9)}, ${hexToRgba(appColor, 0.9)})`,
                        backdropFilter: "blur(10px)",
                        border: "none",
                        padding: "10px 24px",
                        borderRadius: 30,
                        color: onAppColor,
                        fontWeight: 700,
                        fontSize: victoryStep === 1 ? "18px" : (victoryWasFirstImpression ? "16px" : "14px"),
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        zIndex: 9999,
                        animation: "fadeIn 0.5s ease"
                    }}>
                        {victoryStep === 1 ? (
                            <>
                                {victoryWasFirstImpression ? (
                                    <><span style={{ fontSize: "20px" }}>🎉</span> First Impressions</>
                                ) : (
                                    <><span style={{ fontSize: "20px" }}>😊</span> Completed</>
                                )}
                            </>
                        ) : (
                            <>
                                {victoryWasFirstImpression ? (
                                    `@${feeds?.username || "creator"}: First Trial. Impressive 👍`
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
                {BRANCH_IDS.map((branch) => {
                    const hotspot = hsById[branch];
                    return hotspot.svgPath ? (
                        <clipPath key={branch} id={`ai-mask-${branch}`} clipPathUnits="objectBoundingBox">
                            <path transform={`scale(${1 / (hotspot.maskWidth || 1080)}, ${1 / (hotspot.maskHeight || 1920)})`} d={hotspot.svgPath} />
                        </clipPath>
                    ) : null;
                })}
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

            {/* Four branch hotspots stay mounted for stable lens canvases. */}
            {(!holdSession || holdSession.phase === "completed-awaiting-release") && BRANCH_IDS.map(renderHotspot)}
            {renderHoldController()}


            {/* hotspot effects (BIGGER hover + click/active bounce + BORDER BLINK) */}
            <style>
                {`
          .hotspot {
            position: absolute;
            /* keep your inline transform from markerStyle; we only add transitions */
            transition: transform 160ms ease, opacity 200ms ease, box-shadow 160ms ease;
            will-change: transform, opacity;
            /* A long press is a legitimate gesture here, not a request to save the
               lens frame or select the CLIK/HOLD label. iOS answers a long press
               with the share/save callout, Android with the image context menu,
               and both drag a selection highlight across the pseudo-element text.
               Suppressed on every hotspot, not just Hold ones, because the same
               menu appears over an ordinary tap target held a moment too long. */
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }

          /* The lens canvas is what the browser actually offers to save, and the
             mask outline is selectable vector content. Inheritance covers most
             engines, but older WebKit drops -webkit-touch-callout on replaced
             elements, so both are named explicitly. */
          .hotspot canvas,
          .hotspot svg,
          .hotspot::before,
          .hotspot::after {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }

          /* Three-step loop: hollow circle, text cue, then frosted choice surface. */
          .hotspot.show-clik::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background:
              radial-gradient(circle at 32% 20%, rgba(255,255,255,0.55), rgba(255,255,255,0.25) 38%, rgba(255,255,255,0.10) 68%, rgba(255,255,255,0.035) 100%);
            border: 1px solid rgba(255,255,255,0.46);
            backdrop-filter: blur(16px) saturate(160%);
            -webkit-backdrop-filter: blur(16px) saturate(160%);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.57),
              inset 0 -18px 34px rgba(255,255,255,0.08),
              0 14px 34px rgba(0,0,0,0.18);
            pointer-events: none;
            z-index: 10;
            animation: clik-frost-loop 7s linear infinite;
          }

          .hotspot.show-clik::before {
            content: attr(data-text);
            position: absolute;
            top: 14%;
            right: 12%;
            max-width: 62%;
            min-height: 22px;
            padding: 5px 10px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #111827;
            font-weight: 800;
            font-size: 0.72rem;
            letter-spacing: 0;
            line-height: 1;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background: linear-gradient(135deg, rgba(255,255,255,0.66), rgba(255,255,255,0.50));
            border: 1px solid rgba(255,255,255,0.55);
            backdrop-filter: blur(14px) saturate(165%);
            -webkit-backdrop-filter: blur(14px) saturate(165%);
            box-shadow:
              0 8px 20px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.64);
            text-shadow: 0 1px 0 rgba(255,255,255,0.85);
            pointer-events: none;
            z-index: 11;
            animation: clik-text-loop 7s linear infinite;
          }

          @keyframes clik-text-loop {
            0%      { opacity: 0; }
            34.286% { opacity: 0; }
            38.571% { opacity: 1; }
            91.429% { opacity: 1; }
            100%    { opacity: 0; }
          }

          @keyframes clik-frost-loop {
            0%      { opacity: 0; }
            62.857% { opacity: 0; }
            68.571% { opacity: 1; }
            91.429% { opacity: 1; }
            100%    { opacity: 0; }
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
                    data-ai-action={feeds ? 'clikb.feeds.hotspot.dismiss_first_impression' : undefined}
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
                    <span style={{ fontSize: "16px", display: "inline-block", animation: "wobbleEmoji 1s ease-in-out infinite" }}>😄</span> First Impression
                </div>
            )}

            {/* Mute Toggle Button (Top Right) */}
            {/* Mute Toggle / Home Button (Top Right) */}
            {(!feeds || isLeaf) && (
                <button
                    data-ai-action={feeds && isLeaf ? 'clikb.feeds.hotspot.go_home' : undefined}
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

            {/* Tap Icon for iOS Autoplay Fallback (Feeds Mode, Root Node, never yet played) */}
            {feeds && isRootNode && active === null && !hasPlayedOnce && (
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
