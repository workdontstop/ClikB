import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from 'react-dom';
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { Box, Button, Typography, Backdrop, Fade, CircularProgress, Switch } from "@mui/material";
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

interface PublishLoaderProps {
    open: boolean;
    onClose: () => void;
    inCreationDeck?: boolean;
    deckDetailHost?: HTMLElement | null;

    // Data
    type: number; // 0=Memes, 1=Stories, 3=Interactions
    generatedImagesFlux: string[];
    VideoArrayCloud: string[];
    postId?: number | string;
    musicname?: string;
    musicUrl?: string;

    // --- Narration Props ---
    SelectedModel: string;
    musicKling: boolean;
    activatevoicenarration: boolean;
    setactivatevoicenarration: (val: boolean) => void;
    narrationSummaryPending?: boolean;
    narrationSummaryError?: string;
    onRetryNarrationSummary?: () => void;

    // State passed from Parent
    isLoading: boolean;
    loadData: string;

    // Actions
    HaltPublish: boolean;
    setHaltPublish: (val: boolean) => void;
    ContinueUpload: () => void;

    // Type 3 Actions
    Close: () => void;
    setflip: (val: boolean) => void;
    setminimisePrompt: (val: boolean) => void;

    darkMode: boolean;
    appColor: string;
    matchMobile: boolean;
    steps: any;
    setThumbGo: any
    musicMode?: boolean;
    onMusicPublish?: () => void;
}

const PublishLoader: React.FC<PublishLoaderProps> = ({
    open,
    onClose,
    inCreationDeck = false,
    deckDetailHost,
    type,
    generatedImagesFlux,
    VideoArrayCloud,
    postId,
    musicname,
    musicUrl,
    SelectedModel,
    musicKling,
    activatevoicenarration,
    setactivatevoicenarration,
    narrationSummaryPending = false,
    narrationSummaryError = '',
    onRetryNarrationSummary = () => {},
    isLoading,
    loadData,
    HaltPublish,
    setHaltPublish,
    ContinueUpload,
    darkMode,
    appColor,
    matchMobile,
    steps,
    setThumbGo,
    musicMode = false,
    onMusicPublish
}) => {

    const funEmojis = ["🚀", "👨‍🚀", "👩‍🚀", "🌌", "🛸", "🪐", "🌠", "🛰️", "🔭", "☄️", "👽", "👾", "🎬", "🍿", "🎥", "🎞️", "🔮", "✨", "💫", "🔥", "⚡"];
    const [currentEmoji, setCurrentEmoji] = useState(darkMode ? "👨‍🚀" : "🚀");


    useEffect(() => {
        if (!open) return;
        const interval = setInterval(() => {
            setCurrentEmoji(funEmojis[Math.floor(Math.random() * funEmojis.length)]);
        }, 1500);
        return () => clearInterval(interval);
    }, [open, darkMode]);

    // --- Derived Logic ---
    const isUsableMediaUrl = (url?: string | null) => (
        typeof url === "string" &&
        url.trim() !== "" &&
        url !== "EMPTY" &&
        url !== "EMPTY_BSHOT" &&
        url !== "ERROR" &&
        url !== "undefined" &&
        url !== "null"
    );

    const isMusicMode = Boolean(musicMode && type === 1);
    // Count only real playable URLs — "ERROR"/"EMPTY" markers are not videos.
    const validVideos = VideoArrayCloud.filter(isUsableMediaUrl).length;
    const expectedCount = generatedImagesFlux.length;
    const anyVideoReady = validVideos > 0;
    const allVideosReady = validVideos >= expectedCount && expectedCount > 0;
    const musicExpectedCount = Math.max(
        Array.isArray(steps) ? steps.length : 0,
        generatedImagesFlux?.length || 0,
        VideoArrayCloud?.length || 0
    );
    const musicValidVideos = VideoArrayCloud.filter(isUsableMediaUrl).length;
    const musicMissingVideos = Array.from({ length: musicExpectedCount }, (_, index) => index)
        .filter((index) => !isUsableMediaUrl(VideoArrayCloud?.[index]));
    const allMusicVideosReady = musicExpectedCount > 0 && musicMissingVideos.length === 0;

    // --- Color Logic ---
    const GOLDEN_YELLOW = "#FFD700";

    // --- Narration Logic ---
    const narrationUI = useMemo(() => {
        let isDisabled = true;
        let isAnimated = false;

        if (type === 0) { // Memes
            isDisabled = true;
        } else if (type === 1) { // Stories
            const isAudioModel =
                SelectedModel === "Minix" ||
                SelectedModel === "Mini" ||
                SelectedModel === "Pro" ||
                (SelectedModel === "Proxx" && musicKling);

            if (isAudioModel) {
                isDisabled = false;
                isAnimated = true;
            } else {
                isDisabled = false;
                isAnimated = true;
            }
        }

        return { isDisabled, isAnimated };
    }, [type, SelectedModel, musicKling]);


    var Modexx = type === 0 ? 'Meme' : type === 1 ? 'Story' : 'Interactions'
    const postStateInfo = useMemo(() => {
        if (isMusicMode) {
            if (allMusicVideosReady) {
                return {
                    text: "Music Video Ready",
                    subText: `${musicValidVideos} / ${musicExpectedCount} videos ready`,
                    color: appColor,
                    bg: `${appColor}26`,
                    canProcess: true,
                    actionLabel: "Publish"
                };
            }

            return {
                text: "Videos Required",
                subText: `${musicValidVideos} / ${musicExpectedCount} videos ready. Generate every shot before publishing.`,
                color: appColor,
                bg: `${appColor}26`,
                canProcess: false,
                actionLabel: "Publish"
            };
        }

        if (type === 3) {
            // Entering the studio is never gated — Interactions go straight to
            // the B-shot grid (ContinueUpload bypasses audio/video for type 3).
            // The all-videos requirement is enforced at SAVE time in
            // PublishLoader2, not here.
            return {
                text: validVideos >= steps.length && steps.length > 0
                    ? "Interaction Videos Ready"
                    : "Interactive Studio",
                subText: "Continue to add optional B-roll and spatial interactions. Preview anytime, even while your creation is unfinished.",
                color: appColor,
                bg: `${appColor}26`,
                canProcess: true,
                actionLabel: "Enter Studio"
            };
        } else {
            if (allVideosReady) {
                return {
                    text: "Video Mode Ready",
                    subText: `Publishing as Video ${Modexx}`,
                    color: appColor,
                    bg: `${appColor}26`,
                    canProcess: true,
                    actionLabel: "Enter Studio"
                };
            } else if (anyVideoReady && !allVideosReady) {
                return {
                    text: "Mixed Media Detected",
                    subText: "Creating Image / Video MP4 (Some scenes are images)",
                    color: appColor,
                    bg: `${appColor}26`,
                    canProcess: true,
                    actionLabel: "Enter Studio"
                };
            } else {
                return {
                    text: "Image Mode Ready",
                    subText: `Publishing as Image ${Modexx}`,
                    color: appColor,
                    bg: `${appColor}26`,
                    canProcess: true,
                    actionLabel: "Enter Studio"
                };
            }
        }
    }, [type, validVideos, allVideosReady, anyVideoReady, appColor, darkMode, isMusicMode, allMusicVideosReady, musicExpectedCount, musicValidVideos]);

    const handleProcess = () => {
        if (narrationSummaryPending) return;
        if (isMusicMode) {
            if (!allMusicVideosReady) return;
            if (onMusicPublish) {
                onMusicPublish();
                return;
            }
            ContinueUpload();
            return;
        }

        if (type === 3) {
            ContinueUpload();
            return;
        } else {
            console.group("=== STORY/MEME PUBLISH LOADER DATA ===");
            console.log("Mode:", type === 1 ? "Story" : "Meme");
            console.log("Post ID:", postId ?? "None");
            console.log("Generated images:", generatedImagesFlux);
            console.log("Video cloud array:", VideoArrayCloud);
            console.log("Selected model:", SelectedModel);
            console.log("Narration enabled:", activatevoicenarration);
            console.log("Music Kling enabled:", musicKling);
            console.log("Background music:", {
                enabled: !!musicUrl,
                displayName: musicname || "Music",
                url: musicUrl || "None",
                selected: musicUrl || musicname || "None"
            });
            console.log("Publish state:", {
                validVideos,
                expectedCount,
                anyVideoReady,
                allVideosReady,
                HaltPublish,
                isLoading,
                loadData,
                steps
            });
            console.groupEnd();

            if (generatedImagesFlux.length > 1) {
                if (HaltPublish) {
                    ContinueUpload();
                } else {
                    if (allVideosReady) {
                        ContinueUpload();
                    } else {
                        if (anyVideoReady) {
                            setHaltPublish(true);
                        } else {
                            ContinueUpload();
                        }
                    }
                }
            } else {
                /// alert('publish ');/// Zero videos generated
                setThumbGo(true);

            }
        }
    };

    // ----------------------------------------------------------------------------------
    // RENDER: MINI LOADER (Closed but Processing)
    // ----------------------------------------------------------------------------------
    useEffect(() => {
        if (!open || !inCreationDeck || !deckDetailHost || isLoading) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [open, inCreationDeck, deckDetailHost, isLoading, onClose]);

    useCreationControls('storybook_studio_selector', 'PublishLoader', open, {
        mode: postStateInfo.text, action: postStateInfo.actionLabel,
        narrationOn: Boolean(activatevoicenarration), narrationSummaryPending, narrationSummaryError,
        canProceed: postStateInfo.canProcess && !narrationSummaryPending,
        validVideoCount: validVideos, expectedVideoCount: expectedCount,
    });
    const processBinding = cb('storybook_studio_selector', isMusicMode ? 'publish_music_video' : 'enter_studio',
        postStateInfo.actionLabel, 'handleProcess', 'click', isMusicMode ? 'needs_confirmation' : 'candidate');
    const narrationBinding = cb('storybook_studio_selector', 'narration',
        'Toggle AI voice narration; warn before resetting existing B-roll', 'handleNarrationToggle');
    const retryNarrationBinding = cb('storybook_studio_selector', 'retry_narration',
        'Retry failed narration preparation', 'retryNarrationSummary');
    const canProcess = postStateInfo.canProcess && !narrationSummaryPending;

    if (open && inCreationDeck) {
        if (!deckDetailHost) return null;
        return createPortal(
            <Box component="section" aria-label="Studio setup" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <h2>{isLoading ? loadData || 'Processing…' : postStateInfo.text}</h2>
                <p>{isLoading ? 'Please, stay on this page for permissions.' : postStateInfo.subText}</p>
                {isLoading ? <CircularProgress size={32} sx={{ color: 'var(--deck-accent)' }} /> : <>
                    {type === 1 && !isMusicMode && <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <span>AI voice narration</span>
                        <Switch {...narrationBinding} checked={activatevoicenarration} disabled={narrationUI.isDisabled}
                            onChange={event => setactivatevoicenarration(event.target.checked)} />
                    </Box>}
                    {narrationSummaryError ? <Box role="alert">
                        <p>{narrationSummaryError}</p>
                        <Button {...retryNarrationBinding} onClick={onRetryNarrationSummary}>Retry narration</Button>
                    </Box> : narrationSummaryPending && <p role="status">Preparing narration…</p>}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <button type="button" className="deck-glass-button creation-deck-primary" {...processBinding}
                            disabled={!canProcess} onClick={handleProcess}>{postStateInfo.actionLabel}</button>
                        <button type="button" className="deck-glass-button creation-deck-primary"
                            {...cb('storybook_studio_selector', 'close', 'Close studio setup', 'PublishLoader.onClose')}
                            onClick={onClose}>Cancel</button>
                    </Box>
                </>}
            </Box>,
            deckDetailHost
        );
    }
    if (!open && isLoading) {
        return (
            <Fade in={true}>
                <Box sx={{
                    position: 'fixed',
                    top: '20vh',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: matchMobile ? "90%" : "350px", // Slightly smaller than full modal
                    zIndex: 9999,
                    p: 3,
                    borderRadius: "25px",
                    // IDENTICAL STYLING TO MAIN MODAL
                    background: darkMode
                        ? "linear-gradient(145deg, rgba(30,30,30,0.95), rgba(10,10,10,0.98))"
                        : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,240,240,0.98))",
                    border: `2px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 2
                }}>
                    {/* MINI LOADER RING */}
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <CircularProgress
                            size={60} // Slightly smaller
                            thickness={4}
                            sx={{
                                color: postStateInfo.color,
                                filter: "drop-shadow(0 0 10px currentColor)"
                            }}
                        />
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RocketLaunchIcon sx={{ fontSize: 24, color: postStateInfo.color }} />
                        </Box>
                    </Box>

                    {/* MINI TEXT */}
                    <Box>
                        <Typography
                            variant="h5" // Slightly smaller font
                            sx={{
                                fontWeight: 900,
                                letterSpacing: 1,
                                background: `linear-gradient(45deg, ${postStateInfo.color}, ${darkMode ? "#FFF" : postStateInfo.color})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                            }}
                        >
                            {loadData || "Processing..."}
                        </Typography>
                    </Box>
                </Box>
            </Fade>
        );
    }

    // ----------------------------------------------------------------------------------
    // RENDER: STANDARD MODAL (Open)
    // ----------------------------------------------------------------------------------
    return (
        <Backdrop
            aria-hidden={false}
            role="dialog" aria-modal="true" aria-label={isMusicMode ? 'Music video publish review' : 'Studio setup'}
            sx={{
                zIndex: 9999,
                color: '#fff',
                backdropFilter: "blur(10px)",
                backgroundColor: "rgba(0,0,0,0.65)"
            }}
            open={open}
            onClick={isLoading ? undefined : onClose}
        >
            <Fade in={open}>
                <Box onClick={(e) => e.stopPropagation()} sx={{
                    position: 'relative',
                    width: matchMobile ? "90%" : "400px",
                    p: 4,
                    pt: 8,
                    borderRadius: "30px",
                    background: darkMode
                        ? "linear-gradient(145deg, rgba(30,30,30,0.9), rgba(10,10,10,0.95))"
                        : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,240,240,0.9))",
                    border: `2px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 3
                }}>

                    {/* --- NARRATION TOGGLE (Full Width Header) --- */}
                    {!isLoading && (
                        <Box sx={{
                            position: 'absolute',
                            top: 20,
                            left: 0,
                            right: 0,
                            px: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            visibility: type === 1 && !isMusicMode ? 'visible' : 'hidden',
                            gap: 1.5,
                            animation: narrationUI.isAnimated && activatevoicenarration ? "bop 0.5s infinite alternate" : "none",
                            "@keyframes bop": {
                                "0%": { transform: "scale(1)" },
                                "100%": { transform: "scale(1.12)" }
                            },
                            opacity: narrationUI.isDisabled ? 0.6 : 1,
                            zIndex: 10
                        }}>
                            <Typography variant="h6" sx={{
                                fontWeight: 800,
                                fontSize: "1.1rem",
                                color: darkMode ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                                whiteSpace: "nowrap"
                            }}>
                                {activatevoicenarration ? '  Using A.I  Voice Narration' : 'Narration is Off'}
                            </Typography>
                            <Switch
                                {...narrationBinding}
                                checked={activatevoicenarration}
                                onClick={() => {
                                    if (!narrationUI.isDisabled) {
                                        setactivatevoicenarration(!activatevoicenarration);
                                    }
                                }}
                                onChange={(e) => {
                                    setactivatevoicenarration(e.target.checked);
                                }}
                                disabled={narrationUI.isDisabled}
                                size="medium"
                                sx={{
                                    transform: "scale(1.2)",
                                    "& .MuiSwitch-switchBase.Mui-checked": {
                                        color: postStateInfo.color,
                                    },
                                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                        backgroundColor: postStateInfo.color,
                                    },
                                }}
                            />
                        </Box>
                    )}

                    {/* 1. LOADER RING */}
                    {isLoading && (
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            <CircularProgress
                                size={80}
                                thickness={4}
                                sx={{
                                    color: postStateInfo.color,
                                    filter: "drop-shadow(0 0 10px currentColor)"
                                }}
                            />
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RocketLaunchIcon sx={{ fontSize: 30, color: postStateInfo.color }} />
                            </Box>
                        </Box>
                    )}

                    {/* 2. TEXT STATUS */}


                    <Box sx={{ width: '100%', mt: !isLoading ? 1 : 0 }}>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 900,
                                letterSpacing: 1,
                                background: `linear-gradient(45deg, ${postStateInfo.color}, ${darkMode ? "#FFF" : postStateInfo.color})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                                mb: 1,
                                minHeight: "40px"
                            }}
                        >
                            {isLoading ? loadData : postStateInfo.text}
                        </Typography>

                        <Typography variant="body1" sx={{ color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)", fontWeight: 600, fontFamily: "monospace" }}>
                            {isLoading ? "Please, stay on this page for permissions." : postStateInfo.subText}
                        </Typography>
                    </Box>

                    {/* 3. PRE-CHECK INFO BOX */}
                    {!isLoading && (
                        <Box sx={{ width: "100%", p: 2, borderRadius: "16px", bgcolor: postStateInfo.bg, border: `1px dashed ${postStateInfo.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            {isMusicMode && !allMusicVideosReady ? (
                                <WarningAmberIcon sx={{ color: postStateInfo.color }} />
                            ) : anyVideoReady && !allVideosReady && type !== 3 ? (
                                <CameraAltIcon sx={{ color: postStateInfo.color }} />
                            ) : (
                                <CheckCircleIcon sx={{ color: postStateInfo.color }} />
                            )}
                            <Typography variant="body2" sx={{ color: postStateInfo.color, fontWeight: "bold" }}>
                                {isMusicMode
                                    ? allMusicVideosReady ? "MUSIC VIDEO READY" : "GENERATE EVERY VIDEO"
                                    : type === 3 ? "INTERACTION MODE" : allVideosReady ? "VIDEO STORY MODE" : anyVideoReady ? "IMAGE / VIDEO STORY MODE" : "IMAGE STORY MODE"}
                            </Typography>
                        </Box>
                    )}

                    {/* 4. PROCESS BUTTON */}
                    {narrationSummaryError ? <Box role="alert" sx={{ mb: 1 }}>
                        <Typography>{narrationSummaryError}</Typography>
                        <Button {...retryNarrationBinding} onClick={onRetryNarrationSummary}>Retry narration</Button>
                    </Box> : narrationSummaryPending && <Typography role="status" sx={{ mb: 1 }}>Preparing narration…</Typography>}
                    {!isLoading && (
                        <Button
                            {...processBinding}
                            variant="contained"
                            disabled={!canProcess}
                            onClick={handleProcess}
                            sx={{
                                position: "relative",
                                width: "100%", py: 1.5, borderRadius: "50px", fontSize: "1.2rem", fontWeight: 800, textTransform: "none",
                                bgcolor: postStateInfo.color,
                                color: darkMode ? "#000" : "#FFF",
                                boxShadow: `0 10px 20px ${postStateInfo.bg}`,
                                transition: "transform 0.2s",
                                "&:hover": { transform: "scale(1.05)", bgcolor: postStateInfo.color, filter: "brightness(1.1)" },
                                "&:active": { transform: "scale(0.95)" },
                                "&.Mui-disabled": {
                                    bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                                    color: "rgba(150,150,150,0.5)"
                                }
                            }}
                        >
                            <Typography sx={{ position: 'absolute', left: 24, fontSize: '1.6rem', lineHeight: 1, filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))', transition: 'all 0.3s ease' }}>{currentEmoji}</Typography>
                            {postStateInfo.actionLabel}
                        </Button>
                    )}
                </Box>
            </Fade>
        </Backdrop>
    );
};

export default PublishLoader;
