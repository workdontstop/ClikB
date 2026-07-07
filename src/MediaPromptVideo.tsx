import React, { useState, useEffect } from "react";
import { Box, IconButton, Fade, Backdrop, Typography, Grid, Button, Switch, FormControlLabel, Tabs, Tab, Portal } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'; // Imported for the dummy UI

import AnimationIcon from '@mui/icons-material/Animation';

// --- Dummy Component for Animate Mode ---

// ... other imports
import ModalAnimate from './ModalAnimate'; // <--- Import the component

// ... inside your main component return statement ...

interface MediaPromptVideoProps {
    index: number;
    VideoArrayCloud: string[];
    currentImage: string;
    // FIXED: Now accepts two numbers (targetIndex, sourceIndex)
    onSelectStepback: (targetIndex: number, sourceIndex: number) => void;
    onToggleContext: (isDirect: boolean) => void;
    isDirectMode: boolean;
    darkMode: boolean;
    matchMobile: boolean;
    CreationMode: string;
    videoDurationCap: number;
    animateState: any;
    setAnimateState: any;
    trimmedVideoUrl: any;
    setTrimmedVideoUrl: any;
    onGenerate: (i: number, overridePrompt?: string, overrideAudio?: boolean) => Promise<void>;
    onClose: () => void;
    onResetToDefault: () => void;
    onExtractFrame?: (targetIndex: number, blob: Blob) => void;
}

const MediaPromptVideo: React.FC<MediaPromptVideoProps> = ({
    index,
    VideoArrayCloud,
    currentImage,
    onSelectStepback,
    onToggleContext,
    isDirectMode,
    darkMode,
    matchMobile,
    CreationMode,
    videoDurationCap,
    animateState,
    setAnimateState,
    trimmedVideoUrl,
    setTrimmedVideoUrl,
    onGenerate,
    onClose,
    onResetToDefault,
    onExtractFrame
}) => {
    const [open, setOpen] = useState(false);
    const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);

    // State for switching tabs
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    // Auto-select "Motion Transfer" tab if animation is active or requested
    useEffect(() => {
        if (open && animateState > 0) {
            setTabValue(1);
        }
    }, [open, animateState]);

    const activeVideoRef = React.useRef<HTMLVideoElement>(null);

    const handleUseFrame = () => {
        const activeVideo = activeVideoRef.current;
        if (!activeVideo || !onExtractFrame || !activeVideoSrc) return;

        const currentTime = activeVideo.currentTime;
        const videoUrl = activeVideoSrc;

        try {
            // Replicate exactly how captureLastFrameBlobFromVideo works off-DOM
            const video = document.createElement("video");

            // Explicitly bust cache to prevent reusing a non-CORS response
            const separator = videoUrl.includes("?") ? "&" : "?";
            video.src = videoUrl + separator + "nocache=" + new Date().getTime();
            video.crossOrigin = "anonymous";
            video.muted = true;
            video.playsInline = true;

            const onError = () => {
                alert("Error loading video for frame capture. It may be restricted.");
            };

            video.addEventListener("error", onError);

            video.addEventListener("loadedmetadata", () => {
                const onSeeked = () => {
                    try {
                        const canvas = document.createElement("canvas");

                        canvas.width = video.videoWidth || 1080;
                        canvas.height = video.videoHeight || 1920;

                        const ctx = canvas.getContext("2d");
                        if (!ctx) {
                            alert("Canvas 2D context not available.");
                            return;
                        }

                        // Draw and auto-resize the video to the smaller canvas
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        canvas.toBlob(
                            (blob) => {
                                if (blob) {
                                    onExtractFrame(index, blob);
                                    setActiveVideoSrc(null);
                                    if (isDirectMode) onToggleContext(false);
                                    setOpen(false);
                                } else {
                                    alert("Error: Could not extract frame blob.");
                                }
                            },
                            "image/jpeg",
                            0.95
                        );
                    } catch (e) {
                        console.error("Frame extraction error:", e);
                        alert("Security Error: Cannot extract frame due to CORS restrictions.");
                    }
                };

                video.addEventListener("seeked", onSeeked, { once: true });
                // Seek to the exact frame the user paused on
                video.currentTime = currentTime;
            });
        } catch (e) {
            console.error("Frame extraction setup error:", e);
            alert("Unexpected error setting up frame extraction.");
        }
    };

    const renderVideoItem = (vidSrc: string | null, sourceIndex: number) => {
        if (!vidSrc) return null;

        return (
            <Grid item xs={6} sm={4} md={2.4} key={`video-${sourceIndex}`}>
                <Box
                    onClick={() => setActiveVideoSrc(vidSrc)}
                    sx={{
                        position: "relative",
                        aspectRatio: "9/16",
                        borderRadius: 2,
                        overflow: "hidden",
                        border: "1px solid transparent",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                        transition: "all 0.2s ease-in-out",
                        cursor: "pointer",
                        "&:active": { transform: "scale(0.98)" },
                        "&:hover": { transform: "scale(1.02)", border: `2px solid ${darkMode ? "#fff" : "#000"}` }
                    }}
                >
                    <video
                        src={vidSrc}
                        crossOrigin="anonymous"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        muted
                        loop
                        playsInline
                        onMouseOver={(e) => e.currentTarget.play()}
                        onMouseOut={(e) => e.currentTarget.pause()}
                    />

                    {/* Centered Play Icon */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 2,
                            bgcolor: 'rgba(0,0,0,0.4)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 0.5
                        }}
                    >
                        <PlayCircleOutlineIcon sx={{ color: 'white', fontSize: 32 }} />
                    </Box>

                    <Box sx={{ position: "absolute", bottom: 4, left: 4, bgcolor: "rgba(0,0,0,0.6)", color: "white", px: 1, borderRadius: 1, fontSize: "0.7rem", zIndex: 2 }}>
                        Scene {sourceIndex + 1}
                    </Box>
                </Box>
            </Grid>
        );
    };

    const displayImage = isDirectMode ? "" : currentImage;

    return (
        <>
            <Box sx={{ position: "absolute", top: matchMobile ? 70 : 16, right: { xs: 8, md: "1vw" }, zIndex: 30000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {displayImage && typeof displayImage === 'string' && displayImage.trim() !== "" && animateState === 0 ? (
                    <Box
                        onClick={() => setOpen(true)}
                        sx={{
                            position: "relative",
                            width: matchMobile ? 60 : 80,
                            height: matchMobile ? 60 : 80,
                            borderRadius: "50%",
                            overflow: "hidden",
                            cursor: "pointer",
                            border: `2px solid ${darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)"}`,
                            boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
                            transition: "transform 0.2s",
                            "&:hover": { transform: "scale(1.05)", borderColor: darkMode ? "#fff" : "#000" }
                        }}
                    >
                        <img src={displayImage} alt="Active Context" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </Box>
                ) : (
                    <Button onClick={() => setOpen(true)} variant="contained" sx={{ width: matchMobile ? 56 : 64, height: matchMobile ? 56 : 64, borderRadius: "50%", minWidth: 0, bgcolor: darkMode ? "rgb(100,100,100,0.4)" : "rgb(250,250,250,0.4)", color: darkMode ? "white" : "black", backdropFilter: "blur(10px)", boxShadow: 3, "&:hover": { bgcolor: darkMode ? "rgba(100,100,100,0.7)" : "rgba(250,250,250,0.7)" } }}>
                        {animateState === 0 ? <VideoLibraryIcon sx={{ fontSize: matchMobile ? "1.5rem" : "2rem" }} /> : <AnimationIcon sx={{ fontSize: matchMobile ? "1.5rem" : "2rem" }} />}
                    </Button>
                )}
                <Typography variant="caption" sx={{ mt: 1, color: darkMode ? "#fff" : "#000", fontWeight: "bold", textShadow: "0 1px 4px rgba(0,0,0,0.5)", display: displayImage ? animateState > 0 ? 'block' : "none" : "block" }}>
                    {animateState > 0 ? "Animate" : CreationMode === 'Video' ? "Context" : "Prompt"}
                </Typography>
            </Box>

            <Portal>
              <Backdrop open={open} sx={{ zIndex: 40000, height: '100vh', color: '#fff', backgroundColor: darkMode ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)" }}>
                  <Fade in={open}>
                      <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "88vh", display: "flex", flexDirection: "column", color: darkMode ? "#fff" : "#000" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, pt: matchMobile ? 4 : 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 1 }}>VIDEO CONTEXT {index + 1}</Typography>
                            <IconButton onClick={() => setOpen(false)} sx={{ color: "inherit" }}><CloseIcon sx={{ fontSize: "2rem" }} /></IconButton>
                        </Box>

                        <Box sx={{ flex: 1, display: 'flex', flexDirection: matchMobile ? 'column' : 'row', p: 2, gap: 2, overflow: 'hidden' }}>
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', borderRight: matchMobile ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderBottom: matchMobile ? `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none', pb: matchMobile ? 2 : 0, pr: matchMobile ? 0 : 2 }}>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <AutoFixHighIcon fontSize="small" /> Start Frame
                                </Typography>

                                {displayImage ? (
                                    <Box sx={{ position: 'relative', width: '100%', maxWidth: '240px', aspectRatio: '9/16', borderRadius: 2, overflow: 'hidden', boxShadow: 3, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` }}>
                                        <img src={displayImage} alt="Active" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <Button
                                            variant="contained"
                                            onClick={() => onResetToDefault()}
                                            sx={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '15%',
                                                borderRadius: 0,
                                                bgcolor: 'rgba(0,0,0,0.6)',
                                                color: '#fff',
                                                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                                                fontSize: '0.9rem',
                                                fontWeight: 'bold',
                                                textTransform: 'none'
                                            }}
                                        >
                                            Default
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ width: '100%', maxWidth: '240px', aspectRatio: '9/16', borderRadius: 2, border: `2px dashed ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.05)' }}>
                                        <Typography variant="body2" align="center" sx={{ p: 2 }}>
                                            Direct Video (No start frame)
                                        </Typography>
                                    </Box>
                                )}

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={isDirectMode}
                                            onChange={(e) => onToggleContext(e.target.checked)}
                                            color="error"
                                        />
                                    }
                                    label="Direct Video (No start frame)"
                                    sx={{ mt: 2, color: darkMode ? '#fff' : '#000' }}
                                />
                            </Box>

                            <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'opacity 0.3s' }}>
                                {/* TABS SECTION ADDED HERE */}
                                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                    <Tabs
                                        value={tabValue}
                                        onChange={handleTabChange}
                                        textColor="inherit"
                                        indicatorColor="secondary"
                                        variant={matchMobile ? "fullWidth" : "standard"}
                                    >
                                        <Tab label="Frame History" />
                                        <Tab label="Motion Transfer (v2)" />
                                    </Tabs>
                                </Box>

                                {/* TAB 1: FRAME HISTORY (Original Content) */}
                                {tabValue === 0 && (
                                    <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 1 }}>
                                        <Grid container spacing={1.5} justifyContent="flex-start">
                                            {VideoArrayCloud && VideoArrayCloud.map((vidSrc, idx) => {
                                                if (!vidSrc || vidSrc.trim() === "") return null;
                                                return renderVideoItem(vidSrc, idx);
                                            })}
                                            {(!VideoArrayCloud || VideoArrayCloud.every(u => !u || u.trim() === "")) && (
                                                <Grid item xs={12}>
                                                    <Typography sx={{ opacity: 0.7, fontStyle: 'italic', fontSize: '0.9rem', color: darkMode ? '#fff' : '#000' }}>
                                                        No generated videos available yet.
                                                    </Typography>
                                                </Grid>
                                            )}
                                        </Grid>
                                    </Box>
                                )}


                                {/* TAB 2: ANIMATE MODE (New Dummy Content) */}
                                {/* TAB 2: ANIMATE MODE */}
                                {tabValue === 1 && (
                                    <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
                                        <ModalAnimate
                                            animateState={animateState}
                                            setAnimateState={setAnimateState}
                                            trimmedVideoUrl={trimmedVideoUrl}
                                            setTrimmedVideoUrl={setTrimmedVideoUrl}
                                            videoDurationCap={videoDurationCap}
                                            darkMode={darkMode}
                                            matchMobile={matchMobile}
                                            currentImage={currentImage}
                                            isDirectMode={isDirectMode}
                                            onGenerate={(prompt, audio) => onGenerate(index, prompt, audio)}
                                            onClose={() => {
                                                setOpen(false);
                                                //if (onClose) onClose();
                                            }}
                                        />
                                    </Box>
                                )}
                            </Box>
                        </Box>
                      </Box>
                  </Fade>
              </Backdrop>
            </Portal>

            {/* FULLSCREEN VIDEO FRAME EXTRACTOR */}
            {activeVideoSrc && (
                <Portal>
                    <Backdrop
                        open={true}
                        sx={{
                            color: '#fff',
                            zIndex: 9999999,
                            flexDirection: 'column',
                            bgcolor: 'rgba(0,0,0,0.9)'
                        }}
                    >
                        <IconButton
                            onClick={() => setActiveVideoSrc(null)}
                            sx={{ position: 'absolute', top: 16, right: 16, color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                        >
                            <CloseIcon />
                        </IconButton>

                        <video
                            ref={activeVideoRef}
                            src={activeVideoSrc}
                            crossOrigin="anonymous"
                            controls
                            autoPlay
                            style={{ maxWidth: '90%', maxHeight: '80%', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                        />

                        <Button
                            variant="contained"
                            onClick={handleUseFrame}
                            sx={{ mt: 3, px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: 4, bgcolor: '#ff4081', '&:hover': { bgcolor: '#f50057' } }}
                        >
                            Use Frame
                        </Button>
                    </Backdrop>
                </Portal>
            )}
        </>
    );
};

export default MediaPromptVideo;
