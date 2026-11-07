import React, { useState, useRef, useEffect } from "react";
import { Box, Typography, Button, CircularProgress, Chip, TextField, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Switch } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import EditIcon from "@mui/icons-material/Edit";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"; // Icon for Animation
import MovieIcon from "@mui/icons-material/Movie";
import ImageIcon from "@mui/icons-material/Image";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // Icon for Active Selection
import { SaveVideoHelperForDelLater } from "./SavepromptHelpersLocal";
import { alpha, getContrastRatio } from '@mui/material/styles';

// Import the Preview Component
import ModalVideoPreview from "./ModalVideoPreview";
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';

interface ModalAnimateProps {
    appColor: string;
    darkMode: boolean;
    matchMobile: boolean;
    currentImage: string;
    isDirectMode: boolean;
    videoDurationCap: number;
    animateState: any;
    setAnimateState: any;
    trimmedVideoUrl: any;
    setTrimmedVideoUrl: any;
    onGenerate: (overridePrompt?: string, overrideAudio?: boolean) => Promise<void>;
    onClose?: () => void;
}

const ModalAnimate: React.FC<ModalAnimateProps> = ({
    appColor,
    darkMode,
    matchMobile,
    currentImage,
    isDirectMode,
    videoDurationCap,
    animateState,
    setAnimateState,
    trimmedVideoUrl,
    setTrimmedVideoUrl,
    onGenerate,
    onClose
}) => {
    // STATE
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Prompt Control State
    const [promptMode, setPromptMode] = useState<'motion' | 'custom'>('motion');
    const [customPrompt, setCustomPrompt] = useState<string>("");
    const [keepAudio, setKeepAudio] = useState<boolean>(false); // Default OFF as requested

    // Result State
    const [isTranscoding, setIsTranscoding] = useState(false);

    useCreationControls('workstation_motion_transfer', 'ModalAnimate', true, {
        hasSourceImage: Boolean(currentImage),
        hasProcessedMotionVideo: Boolean(trimmedVideoUrl),
        durationSeconds: videoDurationCap,
        uploadPreviewOpen: isPreviewOpen,
        generatingRoute: animateState === 1 ? 'DreamActor' : animateState === 2 ? 'Wan Animate' : 'inactive',
    });

    // Ref to trigger file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- 1. Handle File Selection ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setIsPreviewOpen(true);
        }
    };

    // --- 2. Handle Success ---
    const handleUploadSuccess = (finalUrl: string) => {
        console.log("Process Complete. Final Video:", finalUrl);
        SaveVideoHelperForDelLater(finalUrl);
        setTrimmedVideoUrl(finalUrl);
        setIsTranscoding(false);
        // Automatically select video (Mode 2) upon successful upload
        setAnimateState(2);
    };

    const imageToDisplay = currentImage;

    // Common Styles
    const containerBg = darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
    const containerBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
    const imageColor = appColor;
    const videoColor = appColor;
    const accentText = getContrastRatio(appColor, '#111') >= 4.5 ? '#111' : '#fff';
    const activeColor = animateState === 1 ? imageColor : (animateState === 2 ? videoColor : "transparent");

    // --- Toggle Handlers ---
    const handleImageClick = () => {
        // If currently 1, toggle off to 0. Else set to 1.
        setAnimateState((prev: any) => prev === 1 ? 0 : 1);
    };

    const handleVideoClick = () => {
        if (!trimmedVideoUrl) {
            fileInputRef.current?.click(); // Open upload if no video
        } else {
            // If currently 2, toggle off to 0. Else set to 2.
            setAnimateState((prev: any) => prev === 2 ? 0 : 2);
        }
    };

    const handleGenerateClick = () => {
        // Fall back to the scene's video prompt when this modal has no override.
        const p = customPrompt.trim() || undefined;
        const a = keepAudio;
        console.log("ModalAnimate: handleGenerateClick", { p, a });
        onGenerate(p, a);
        if (onClose) onClose();
    };

    // Force animateState to 1 (DreamActor M2.0 only supports this mode)
    useEffect(() => {
        if (animateState !== 1) {
            setAnimateState(1);
        }
    }, [animateState, setAnimateState]);

    return (
        <Box sx={{
            width: "100%",
            // height: "100%", // Removed to allow natural height
            display: "flex",
            flexDirection: "column",
            gap: 2,
            p: 1,
            // overflow: "hidden" // Removed to allow scrolling from parent
        }}>

            {/* TOP SECTION: ANIMATE SELECTION (Scrollable, Reduced Height) */}
            <Box sx={{
                flex: "0 1 auto", // Allow shrinking
                display: "flex",
                flexDirection: "column",
                gap: 2,
                overflowY: "auto", // Make scrollable
                minHeight: "200px", // Ensure visibility
                maxHeight: "55%",   // Restrict height
                p: 1
            }}>
                <Box sx={{ display: "flex", flexDirection: matchMobile ? "column" : "row", gap: 2, width: "100%" }}>
                    {/* ================= LEFT PANEL: Context Image (Mode 1) ================= */}
                    <Box sx={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>

                    {/* Image Container */}
                    <Box sx={{
                        width: '100%',
                        height: { xs: "200px", md: "250px" }, // Reduced height
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: darkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
                        borderRadius: 2,
                        overflow: "hidden",
                        // Highlight border ONLY if state is 1
                        border: `2px solid ${animateState === 1 ? activeColor : "transparent"}`,
                        outline: `1px solid ${containerBorder}`, // Subtle outline when not active
                        position: "relative",
                        transition: 'border 0.2s ease'
                    }}>
                        {/* Badge: Source Image (Only if Mode 1) */}
                        {animateState === 1 && (
                            <Chip
                                label="Result Media"
                                icon={<CheckCircleIcon sx={{ fontSize: '16px !important' }} />}
                                sx={{ position: 'absolute', top: 10, left: 10, zIndex: 5, fontWeight: 'bold', bgcolor: appColor, color: accentText }}
                                size="small"
                            />
                        )}

                        {imageToDisplay ? (
                            <img
                                src={imageToDisplay}
                                alt="Reference"
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.8 }}>
                                <BrokenImageOutlinedIcon sx={{ fontSize: 40, mb: 1, color: darkMode ? "#fff" : "#000" }} />
                                <Typography variant="body2" align="center" sx={{ color: darkMode ? "#fff" : "#000" }}>No Image Selected</Typography>
                            </Box>
                        )}
                    </Box>

                </Box>


                {/* ================= RIGHT PANEL: Upload OR Result Video (Mode 2) ================= */}
                <Box sx={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>

                    {/* Video Container */}
                    <Box sx={{
                        width: '100%',
                        height: { xs: "200px", md: "250px" }, // Reduced height
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: containerBg,
                        borderRadius: 2,
                        // Highlight border ONLY if state is 2
                        border: animateState === 2 ? `2px solid ${activeColor}` : `2px dashed ${containerBorder}`,
                        p: 2,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'border 0.2s ease'
                    }}>

                        {/* Badge: Result Frame (Only if Mode 2) */}
                        {animateState === 2 && trimmedVideoUrl && (
                            <Chip
                                label="Result Media"
                                icon={<CheckCircleIcon sx={{ fontSize: '16px !important' }} />}
                                sx={{ position: 'absolute', top: 10, left: 10, zIndex: 5, fontWeight: 'bold', bgcolor: appColor, color: accentText }}
                                size="small"
                            />
                        )}

                        {/* 1. LOADING STATE */}
                        {isTranscoding ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <CircularProgress size={40} />
                                <Typography variant="caption" sx={{ color: darkMode ? "#fff" : "#000" }}>Processing...</Typography>
                            </Box>

                            /* 2. RESULT VIDEO STATE (Clickable to Replace) */
                        ) : trimmedVideoUrl ? (
                            <Box
                                {...cb('workstation_motion_transfer', 'replace_motion_video', 'Replace the processed motion-reference video with another upload', 'handleFileSelect', 'click', 'needs_handoff')}
                                onClick={() => {
                                    fileInputRef.current?.click();
                                }}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover .overlay': { opacity: 1 }
                                }}
                            >
                                <video
                                    src={trimmedVideoUrl}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                />

                                {/* Hover Overlay */}
                                <Box className="overlay" sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    borderRadius: '8px'
                                }}>
                                        <>
                                            <EditIcon sx={{ color: 'white', fontSize: 40, mb: 1 }} />
                                            <Typography variant="body2" color="white" fontWeight="bold">Click to Replace</Typography>
                                        </>
                                </Box>
                            </Box>

                            /* 3. DEFAULT UPLOAD STATE */
                        ) : (
                            <>
                                <Button
                                    {...cb('workstation_motion_transfer', 'upload_motion_video', 'Choose a motion-reference video file, maximum 700MB', 'handleFileSelect', 'click', 'needs_handoff')}
                                    variant="contained"
                                    startIcon={<CloudUploadIcon />}
                                    onClick={() => fileInputRef.current?.click()}
                                    sx={{
                                        textTransform: "none",
                                        px: 4,
                                        py: 1.5,
                                        bgcolor: activeColor === "transparent" ? (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") : activeColor,
                                        color: accentText,
                                        boxShadow: 0,
                                        "&:hover": {
                                            bgcolor: activeColor === "transparent" ? (darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)") : activeColor,
                                        }
                                    }}
                                >
                                    Upload Video
                                </Button>
                                <Typography variant="caption" sx={{ mt: 2, textAlign: "center", color: darkMode ? "#fff" : "#000", fontWeight: 500 }}>
                                    Max size: 700MB <br /> Supported: MP4, WEBM, MOV
                                </Typography>
                            </>
                        )}

                        {/* HIDDEN INPUT */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            accept="video/*"
                            onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
                            onChange={handleFileSelect}
                        />
                    </Box>

                </Box>
                </Box>
            </Box>

            {/* BOTTOM SECTION: CONTROLS (New Layout) */}
            <Box sx={{
                flex: "1 1 auto",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                px: 1,
                borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                pt: 2
            }}>


                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    {/* SUBMIT BUTTON */}
                    <Button
                        {...cb('workstation_motion_transfer', 'generate', 'Generate video from the current image and processed motion reference at the displayed pixel cost', 'handleGenerateClick', 'click', 'requires_video')}
                        fullWidth
                        variant="contained"
                        onClick={() => {
                            console.log("Generate Clicked! State:", { animateState, prompt: customPrompt, keepAudio });
                            handleGenerateClick();
                        }}
                        disabled={animateState === 0 || !trimmedVideoUrl}
                        sx={{
                            px: 4,
                            zIndex: 10,
                            pointerEvents: 'auto',
                            background: animateState === 0 ? "rgba(0,0,0,0.12)" :
                                (animateState === 1 ? imageColor : videoColor),
                            color: animateState === 0 ? "rgba(0,0,0,0.26)" : accentText,
                            fontWeight: 'bold',
                            boxShadow: animateState > 0 ? `0 3px 8px 2px ${alpha(appColor, 0.35)}` : 'none',
                            "&:disabled": {
                                background: "rgba(0,0,0,0.12)",
                                color: "rgba(0,0,0,0.26)"
                            }
                        }}
                    >
                        GENERATE
                        {(!trimmedVideoUrl && animateState > 0) ? " (Upload Video first)" : ""}

                        {/* Show pixel cost if ready to generate */}
                        {(trimmedVideoUrl && animateState > 0) && (
                            <span style={{
                                marginLeft: "8px",
                                color: accentText,

                                fontWeight: 900, // Extra Bold
                                letterSpacing: "0.5px",
                                // Add a subtle drop shadow to lift the text off the button
                                filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.5))"
                            }}>
                                {(() => {
                                    // Calculate pixels based on Kling O3 Pro rates
                                    let pxx = 420; // default 5s (Standard)
                                    if (videoDurationCap === 10) pxx = 839;
                                    else if (videoDurationCap === 8) pxx = 671;
                                    else if (videoDurationCap === 6) pxx = 503;

                                    return `(${pxx}p)`;
                                })()}
                            </span>
                        )}
                    </Button>
                </Box>
            </Box>


            {/* MODAL POPUP */}
            <ModalVideoPreview
                appColor={appColor}
                currentimage={currentImage}
                open={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={selectedFile}
                videoDurationCap={videoDurationCap}
                darkMode={darkMode}
                onUploadSuccess={handleUploadSuccess}
            />
        </Box>
    );
};

export default ModalAnimate;
