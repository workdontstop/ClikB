import React, { useState } from "react";
import { Box, IconButton, Fade, Backdrop, Typography, Grid, Button, Switch, Portal } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DrawIcon from '@mui/icons-material/Draw';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

import { alpha, getContrastRatio } from '@mui/material/styles';

import DrawFrameDirector, { DrawFrameArrowSettings, DrawFrameSource } from './DrawFrameDirector';
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { captureVideoFrameBlob } from './videoFrameCapture';

export interface VideoHistoryEntry {
    videoUrl: string;
    createdAt: number;
    prompt?: string;
}

interface MediaPromptVideoProps {
    index: number;
    VideoArrayCloud: string[];
    videoHistory?: VideoHistoryEntry[];
    onRestoreVideo?: (entry: VideoHistoryEntry) => Promise<void> | void;
    currentImage: string;
    // FIXED: Now accepts two numbers (targetIndex, sourceIndex)
    onSelectStepback: (targetIndex: number, sourceIndex: number) => void;
    onToggleContext: (isDirect: boolean) => void;
    isDirectMode: boolean;
    darkMode: boolean;
    appColor: string;
    matchMobile: boolean;
    CreationMode: string;
    onResetToDefault: () => void;
    onExtractFrame?: (targetIndex: number, blob: Blob) => void;
    drawFrameData?: any;
    isDrawSaving?: boolean;
    isDrawUpgrading?: boolean;
    onSaveDrawnFrame?: (blob: Blob, note: string) => Promise<void> | void;
    onUpgradeDrawnFrame?: (note: string) => Promise<void> | void;
    onUseDrawFrameSource?: (source: DrawFrameSource) => void;
    onUpdateDrawArrowSettings?: (settings: DrawFrameArrowSettings) => void;
    onResetDrawFrame?: () => void;
}

const MediaPromptVideo: React.FC<MediaPromptVideoProps> = ({
    index,
    VideoArrayCloud,
    videoHistory = [],
    onRestoreVideo,
    currentImage,
    onSelectStepback,
    onToggleContext,
    isDirectMode,
    darkMode,
    appColor,
    matchMobile,
    CreationMode,
    onResetToDefault,
    onExtractFrame,
    drawFrameData,
    isDrawSaving = false,
    isDrawUpgrading = false,
    onSaveDrawnFrame,
    onUpgradeDrawnFrame,
    onUseDrawFrameSource,
    onUpdateDrawArrowSettings,
    onResetDrawFrame
}) => {
    const [open, setOpen] = useState(false);
    const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);
    const [drawMode, setDrawMode] = useState(false);
    const [historyTab, setHistoryTab] = useState<'frames' | 'videos'>('frames');
    const [restoringVideoUrl, setRestoringVideoUrl] = useState<string | null>(null);
    const [restoreError, setRestoreError] = useState('');
    const restoreRequestRef = React.useRef(0);
    const restorePendingRef = React.useRef<string | null>(null);
    const historyPreviewNodes = React.useRef(new Map<string, HTMLVideoElement>());
    const historyPreviewCallbacks = React.useRef(new Map<string, (element: HTMLVideoElement | null) => void>());
    const bindHistoryPreview = (url: string) => {
        let callback = historyPreviewCallbacks.current.get(url);
        if (!callback) {
            callback = element => {
                const previous = historyPreviewNodes.current.get(url);
                if (previous && previous !== element) {
                    previous.pause();
                    previous.removeAttribute('src');
                    previous.load();
                    historyPreviewNodes.current.delete(url);
                }
                if (element) historyPreviewNodes.current.set(url, element);
            };
            historyPreviewCallbacks.current.set(url, callback);
        }
        return callback;
    };
    const previousVideos = React.useMemo(() => {
        const seen = new Set<string>();
        return videoHistory.filter(entry => {
            if (!/^https?:\/\//i.test(entry.videoUrl) || entry.videoUrl === VideoArrayCloud[index] || seen.has(entry.videoUrl)) return false;
            seen.add(entry.videoUrl);
            return true;
        }).sort((a, b) => b.createdAt - a.createdAt);
    }, [videoHistory, VideoArrayCloud, index]);
    React.useEffect(() => {
        restorePendingRef.current = null;
        setRestoringVideoUrl(null);
        setRestoreError('');
        return () => { restoreRequestRef.current++; };
    }, [index]);
    const handleRestoreHistoryVideo = async (entry: VideoHistoryEntry) => {
        if (!onRestoreVideo || restorePendingRef.current) return;
        const request = ++restoreRequestRef.current;
        restorePendingRef.current = entry.videoUrl;
        setRestoringVideoUrl(entry.videoUrl);
        setRestoreError('');
        try { await onRestoreVideo(entry); }
        catch (error) {
            if (restoreRequestRef.current === request) setRestoreError(error instanceof Error ? error.message : 'Could not restore this video.');
        } finally {
            if (restoreRequestRef.current === request) {
                restorePendingRef.current = null;
                setRestoringVideoUrl(null);
            }
        }
    };

    useCreationControls('workstation_video_context', 'MediaPromptVideo', open && !drawMode, {
        sceneNumber: index + 1,
        directVideoWithoutStartFrame: Boolean(isDirectMode),
        hasCurrentStartFrame: Boolean(currentImage),
        availableSceneVideos: VideoArrayCloud?.filter((url) => Boolean(url?.trim())).length || 0,
        activeTab: historyTab === 'frames' ? 'frame_history' : 'video_history',
        previousSceneVideoCount: previousVideos.length,
        restoringSceneVideo: Boolean(restoringVideoUrl),
        framePreviewOpen: Boolean(activeVideoSrc),
    });

    const activeVideoRef = React.useRef<HTMLVideoElement>(null);
    const frameCaptureRef = React.useRef<AbortController | null>(null);
    const [isExtractingFrame, setIsExtractingFrame] = useState(false);
    React.useEffect(() => {
        setIsExtractingFrame(false);
        return () => {
            frameCaptureRef.current?.abort();
            frameCaptureRef.current = null;
        };
    }, [activeVideoSrc, open, index]);

    const handleUseFrame = async () => {
        const activeVideo = activeVideoRef.current;
        if (!activeVideo || !onExtractFrame || !activeVideoSrc || isExtractingFrame) return;
        const currentTime = activeVideo.currentTime;
        const targetIndex = index;
        const controller = new AbortController();
        frameCaptureRef.current?.abort();
        frameCaptureRef.current = controller;
        setIsExtractingFrame(true);
        try {
            const blob = await captureVideoFrameBlob(activeVideoSrc, {
                timeSeconds: currentTime, mimeType: 'image/jpeg', quality: 0.95, signal: controller.signal,
            });
            if (controller.signal.aborted || frameCaptureRef.current !== controller) return;
            // The parent owns the frame after handoff and preserves its upload/recovery workflow.
            onExtractFrame(targetIndex, blob);
            setActiveVideoSrc(null);
            if (isDirectMode) onToggleContext(false);
            setOpen(false);
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error('Frame extraction error:', error);
                alert('Could not extract this frame. Check the video URL and its CORS permission.');
            }
        } finally {
            if (frameCaptureRef.current === controller) {
                frameCaptureRef.current = null;
                setIsExtractingFrame(false);
            }
        }
    };

    const renderVideoItem = (vidSrc: string | null, sourceIndex: number) => {
        if (!vidSrc) return null;

        return (
            <Grid item xs={6} sm={4} md={2.4} key={`video-${sourceIndex}`}>
                <Box
                    {...cb('workstation_video_context', `frame_history_video_${sourceIndex + 1}`, `Open Scene ${sourceIndex + 1} video to choose a frame for Scene ${index + 1}`, 'setActiveVideoSrc')}
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
    const accentText = getContrastRatio(appColor, '#111') >= 4.5 ? '#111' : '#fff';

    return (
        <>
            <Box data-spatial-media-overlay sx={{ position: "absolute", top: matchMobile ? 70 : 16, right: { xs: 8, md: "1vw" }, zIndex: 30000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {displayImage && typeof displayImage === 'string' && displayImage.trim() !== "" ? (
                    <Box
                        {...cb('workstation_video', 'open_context', `Open Video Context for Scene ${index + 1}`, 'setOpen')}
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
                    <Button {...cb('workstation_video', 'open_context', `Open Video Context for Scene ${index + 1}`, 'setOpen')} onClick={() => setOpen(true)} variant="contained" sx={{ width: matchMobile ? 56 : 64, height: matchMobile ? 56 : 64, borderRadius: "50%", minWidth: 0, bgcolor: darkMode ? "rgb(100,100,100,0.4)" : "rgb(250,250,250,0.4)", color: darkMode ? "white" : "black", backdropFilter: "blur(10px)", boxShadow: 3, "&:hover": { bgcolor: darkMode ? "rgba(100,100,100,0.7)" : "rgba(250,250,250,0.7)" } }}>
                        <VideoLibraryIcon sx={{ fontSize: matchMobile ? "1.5rem" : "2rem" }} />
                    </Button>
                )}
                <Typography variant="caption" sx={{ mt: 1, color: darkMode ? "#fff" : "#000", fontWeight: "bold", textShadow: "0 1px 4px rgba(0,0,0,0.5)", display: displayImage ? "none" : "block" }}>
                    {CreationMode === 'Video' ? "Context" : "Prompt"}
                </Typography>
            </Box>

                        <Portal>
              <Backdrop
                aria-hidden={false}
                role="dialog" aria-modal="true" aria-label="Video Context"
                open={open}
                data-editstory-gesture-guard="true"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                sx={{ zIndex: 40000, height: '100dvh', overflow: 'hidden', color: '#fff', backgroundColor: darkMode ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)" }}
              >
                  <Fade in={open}>
                      <Box data-editstory-gesture-guard="true" data-draw-frame-director={drawMode ? "true" : undefined} sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100dvh", maxHeight: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", color: darkMode ? "#fff" : "#000" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, p: 2, pt: matchMobile ? 4 : 2, borderBottom: drawMode ? `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` : 'none', flexShrink: 0 }}>
                            {drawMode ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                                    <IconButton
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDrawMode(false);
                                        }}
                                        sx={{
                                            color: 'inherit',
                                            bgcolor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                            border: darkMode ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(0,0,0,0.1)',
                                            width: matchMobile ? 46 : 52,
                                            height: matchMobile ? 46 : 52,
                                            '&:hover': {
                                                bgcolor: darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
                                            },
                                        }}
                                    >
                                        <ArrowBackIcon />
                                    </IconButton>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 950, fontSize: matchMobile ? '1.05rem' : '1.2rem', lineHeight: 1.05 }}>Draw Director</Typography>
                                        <Typography sx={{ fontWeight: 900, fontSize: '0.78rem', letterSpacing: 0.8, opacity: 0.65 }}>VIDEO CONTEXT {index + 1}</Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 1 }}>VIDEO CONTEXT {index + 1}</Typography>
                            )}
                            <IconButton {...cb('workstation_video_context', 'close', 'Close Video Context', 'setOpen')} onClick={() => setOpen(false)} sx={{ color: "inherit" }}><CloseIcon sx={{ fontSize: "2rem" }} /></IconButton>
                        </Box>

                        {drawMode ? (
                            <Box
                                data-draw-frame-director="true"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseMove={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onMouseLeave={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerMove={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                sx={{
                                    flex: 1,
                                    minHeight: 0,
                                    minWidth: 0,
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    p: matchMobile ? 1 : 2,
                                    overflowX: 'hidden',
                                    overflowY: matchMobile ? 'auto' : 'hidden',
                                    WebkitOverflowScrolling: 'touch',
                                    overscrollBehavior: 'contain',
                                    touchAction: 'pan-y',
                                    background: darkMode
                                        ? `radial-gradient(circle at 50% 0%, ${alpha(appColor, 0.08)}, transparent 32%), #030304`
                                        : `radial-gradient(circle at 50% 0%, ${alpha(appColor, 0.08)}, transparent 32%), #f7f8fb`,
                                }}
                            >
                                <DrawFrameDirector
                                    accentColor={appColor}
                                    baseImageUrl={drawFrameData?.baseImageUrl || displayImage || currentImage}
                                    data={drawFrameData}
                                    darkMode={darkMode}
                                    matchMobile={matchMobile}
                                    isSaving={isDrawSaving}
                                    isUpgrading={isDrawUpgrading}
                                    onSaveDrawing={onSaveDrawnFrame || (async () => {})}
                                    onUpgradeDrawing={onUpgradeDrawnFrame || (async () => {})}
                                    onUseSource={onUseDrawFrameSource || (() => {})}
                                    onUpdateArrowSettings={onUpdateDrawArrowSettings}
                                    onReset={onResetDrawFrame || (() => {})}
                                />
                            </Box>
                        ) : (
                        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: matchMobile ? 'column' : 'row', p: 2, gap: 2, overflowX: 'hidden', overflowY: matchMobile ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                            <Box sx={{ flex: matchMobile && historyTab === 'videos' ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', borderRight: matchMobile ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderBottom: matchMobile ? `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none', pb: matchMobile ? 2 : 0, pr: matchMobile ? 0 : 2 }}>
                                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <AutoFixHighIcon fontSize="small" /> Start Frame
                                </Typography>

                                {displayImage ? (
                                    <Box sx={{ position: 'relative', width: '100%', maxWidth: matchMobile && historyTab === 'videos' ? '96px' : '240px', aspectRatio: '9/16', borderRadius: 2, overflow: 'hidden', boxShadow: 3, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` }}>
                                        <img src={displayImage} alt="Active" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <Button
                                            {...cb('workstation_video_context', 'draw', 'Draw Director is a user-operated visual-direction workspace', 'setDrawMode', 'click', 'information_only')}
                                            variant="contained"
                                            startIcon={<DrawIcon fontSize="small" />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDrawMode(true);
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                top: 12,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                borderRadius: 999,
                                                bgcolor: 'rgba(0,0,0,0.55)',
                                                border: `1px solid ${alpha(appColor, darkMode ? 0.55 : 0.45)}`,
                                                color: '#fff',
                                                '&:hover': { bgcolor: 'rgba(0,0,0,0.78)' },
                                                fontSize: '0.82rem',
                                                fontWeight: 900,
                                                textTransform: 'none',
                                                px: 1.6,
                                                zIndex: 2,
                                            }}
                                        >
                                            Draw
                                        </Button>
                                        <Button
                                            {...cb('workstation_video_context', 'default_frame', 'Restore this scene original/default start frame', 'onResetToDefault')}
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
                                    <Box sx={{ width: '100%', maxWidth: matchMobile && historyTab === 'videos' ? '96px' : '240px', aspectRatio: '9/16', borderRadius: 2, border: `2px dashed ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.05)' }}>
                                        <Typography variant="body2" align="center" sx={{ p: 2 }}>
                                            Direct Video (No start frame)
                                        </Typography>
                                    </Box>
                                )}

                                <Box
                                    {...cb('workstation_video_context', 'toggle_direct_video', 'Toggle Direct Video without a start frame', 'onToggleContext')}
                                    component="button"
                                    type="button"
                                    role="switch"
                                    aria-checked={Boolean(isDirectMode)}
                                    aria-label="Direct Video without start frame"
                                    data-direct-video-toggle="true"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onToggleContext(!Boolean(isDirectMode));
                                    }}
                                    sx={{
                                        mt: 2,
                                        p: 0,
                                        border: 0,
                                        bgcolor: 'transparent',
                                        color: darkMode ? '#fff' : '#000',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        alignSelf: 'center',
                                        cursor: 'pointer',
                                        font: 'inherit',
                                        userSelect: 'none',
                                    }}
                                >
                                    <Switch
                                        checked={Boolean(isDirectMode)}
                                        sx={{ pointerEvents: 'none', '& .MuiSwitch-switchBase.Mui-checked': { color: appColor }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: appColor } }}
                                        tabIndex={-1}
                                        disableRipple
                                        inputProps={{ "aria-hidden": true, tabIndex: -1 }}
                                    />
                                    <Typography component="span" sx={{ fontWeight: 500 }}>
                                        Direct Video (No start frame)
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ flex: matchMobile && historyTab === 'videos' ? '0 0 480px' : 2, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'opacity 0.3s' }}>
                                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button {...cb('workstation_video_context', 'show_frame_history', 'Choose a frame from the latest scene videos', 'setHistoryTab')}
                                        onClick={() => setHistoryTab('frames')} aria-pressed={historyTab === 'frames'}
                                        sx={{ py: 1.5, color: historyTab === 'frames' ? appColor : 'inherit', borderBottom: historyTab === 'frames' ? `2px solid ${appColor}` : '2px solid transparent' }}>Frame History</Button>
                                    <Button {...cb('workstation_video_context', 'show_video_history', 'Browse earlier videos for this scene', 'setHistoryTab')}
                                        onClick={() => setHistoryTab('videos')} aria-pressed={historyTab === 'videos'}
                                        sx={{ py: 1.5, color: historyTab === 'videos' ? appColor : 'inherit', borderBottom: historyTab === 'videos' ? `2px solid ${appColor}` : '2px solid transparent' }}>Video History</Button>
                                </Box>

                                <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 1 }}>
                                    {historyTab === 'frames' ? <Grid container spacing={1.5} justifyContent="flex-start">
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
                                    </Grid> : <>
                                        <Typography variant="body2" sx={{ mb: 2, opacity: 0.75 }}>Earlier videos for Scene {index + 1}. Restore a saved version.</Typography>
                                        {restoreError && <Typography role="alert" sx={{ mb: 2, color: 'error.main' }}>{restoreError}</Typography>}
                                        <Grid container spacing={1.5}>
                                            {previousVideos.map((entry, version) => <Grid item xs={6} sm={4} key={entry.videoUrl}>
                                                <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${alpha(appColor, 0.25)}` }}>
                                                    {open && <video ref={bindHistoryPreview(entry.videoUrl)} src={entry.videoUrl} crossOrigin="anonymous" preload="metadata" playsInline muted controls
                                                        aria-label={`Earlier Scene ${index + 1} video ${version + 1}`}
                                                        style={{ width: '100%', aspectRatio: '9/16', objectFit: 'contain', background: '#111', display: 'block' }} />}
                                                    <Box sx={{ p: 1 }}>
                                                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }}>{Number.isFinite(entry.createdAt) && entry.createdAt > 0 ? new Date(entry.createdAt).toLocaleString() : 'Earlier version'}</Typography>
                                                        {entry.prompt && <Typography variant="caption" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', my: 0.5 }}>{entry.prompt}</Typography>}
                                                        <Button {...cb('workstation_video_context', `restore_video_${version + 1}`, `Restore Scene ${index + 1} video version ${version + 1}`, 'handleRestoreHistoryVideo')}
                                                            aria-label={`Restore Scene ${index + 1} video version ${version + 1}`}
                                                            disabled={!onRestoreVideo || Boolean(restoringVideoUrl)}
                                                            onClick={() => void handleRestoreHistoryVideo(entry)}
                                                            sx={{ color: appColor, width: '100%', fontWeight: 800 }}>{restoringVideoUrl === entry.videoUrl ? 'Restoring…' : 'Restore'}</Button>
                                                    </Box>
                                                </Box>
                                            </Grid>)}
                                            {previousVideos.length === 0 && <Grid item xs={12}><Typography sx={{ opacity: 0.7, fontStyle: 'italic' }}>No earlier videos for this scene yet.</Typography></Grid>}
                                        </Grid>
                                    </>}
                                </Box>
                            </Box>
                        </Box>
                        )}
                      </Box>
                  </Fade>
              </Backdrop>
            </Portal>

            {/* FULLSCREEN VIDEO FRAME EXTRACTOR */}
            {activeVideoSrc && (
                <Portal>
                    <Backdrop
                        aria-hidden={false}
                        role="dialog" aria-modal="true" aria-label="Video frame selection"
                        open={true}
                        sx={{
                            color: '#fff',
                            zIndex: 9999999,
                            flexDirection: 'column',
                            bgcolor: 'rgba(0,0,0,0.9)'
                        }}
                    >
                        <IconButton
                            {...cb('workstation_video_context', 'close_frame_preview', 'Close the selected scene video preview', 'setActiveVideoSrc')}
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
                            {...cb('workstation_video_context', 'use_frame', 'Use the paused video frame as this scene start frame', 'handleUseFrame')}
                            disabled={isExtractingFrame}
                            variant="contained" 
                            onClick={handleUseFrame}
                            sx={{ mt: 3, px: 4, py: 1.5, fontSize: '1.1rem', borderRadius: 4, bgcolor: appColor, color: accentText, '&:hover': { bgcolor: appColor, filter: 'brightness(0.9)' } }}
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





