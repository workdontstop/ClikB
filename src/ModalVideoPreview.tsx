import React, { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    Slider,
    IconButton,
    CircularProgress,
    Alert
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCutRoundedIcon from "@mui/icons-material/ContentCutRounded";
import axios from "axios";
import { IMMUTABLE_VIDEO_CACHE_CONTROL } from "./mediaCachePolicy";
import { alpha } from '@mui/material/styles';
import { appAccentButtonSx, appAccentForeground } from './appAccentStyles';
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { SaveVideoHelperForDelLater } from './SavepromptHelpersLocal';

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const MAX_FILE_SIZE = 700 * 1024 * 1024;
type VideoDimensions = { w: number; h: number };
const formatTime = (seconds: number) => {
    const tenths = Math.max(0, Math.round(seconds * 10));
    const minutes = Math.floor(tenths / 600);
    const remaining = ((tenths % 600) / 10).toFixed(1).padStart(4, '0');
    return `${minutes}:${remaining}`;
};

const loadImageDimensions = (url: string): Promise<VideoDimensions> => new Promise((resolve, reject) => {
    if (!url) {
        reject(new Error("Choose a source image before processing motion video."));
        return;
    }
    const image = new Image();
    const timeout = window.setTimeout(() => finish(new Error("Could not load the source image. Try again.")), 15000);
    const finish = (error?: Error) => {
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        if (error) reject(error);
        else if (image.naturalWidth >= 2 && image.naturalHeight >= 2) {
            resolve({ w: image.naturalWidth, h: image.naturalHeight });
        } else reject(new Error("Could not read source image dimensions."));
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Could not load the source image. Try again."));
    image.src = url;
});

interface ModalVideoPreviewProps {
    appColor: string;
    open: boolean;
    onClose: () => void;
    file: File | null;
    videoDurationCap: number;
    darkMode: boolean;
    onUploadSuccess: (trimmedVideoUrl: string) => void;
    currentimage?: string;
    mode?: 'motion' | 'reference';
    maxFileSizeBytes?: number;
    minSegmentSeconds?: number;
    onProcessingChange?: (processing: boolean) => void;
}

const ModalVideoPreview: React.FC<ModalVideoPreviewProps> = ({
    appColor,
    open,
    onClose,
    file,
    videoDurationCap,
    darkMode,
    onUploadSuccess,
    currentimage = "",
    mode = 'motion',
    maxFileSizeBytes = MAX_FILE_SIZE,
    minSegmentSeconds = 0,
    onProcessingChange,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mountedRef = useRef(false);
    const sessionVersionRef = useRef(0);
    const operationRef = useRef(0);
    const processingRef = useRef(false);
    const latestRef = useRef({ open, file, mode, onUploadSuccess, onProcessingChange });
    latestRef.current = { open, file, mode, onUploadSuccess, onProcessingChange };
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const [startTime, setStartTime] = useState<number>(0);
    const [sourceDim, setSourceDim] = useState<VideoDimensions | null>(null);
    const [targetDim, setTargetDim] = useState<VideoDimensions | null>(null);
    const [internalTrimmedUrl, setInternalTrimmedUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStep, setProcessStep] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [metadataError, setMetadataError] = useState<string | null>(null);
    const accentText = appAccentForeground(darkMode);
    const isReference = mode === 'reference';
    const surface = isReference ? 'workstation_video_reference_segment' : 'workstation_motion_transfer_segment';
    const dimensions = isReference ? sourceDim : targetDim;
    const targetAspectRatio = dimensions ? dimensions.w / dimensions.h : 16 / 9;
    const validCap = Number.isFinite(videoDurationCap) && videoDurationCap > 0;
    const segmentDuration = validCap && duration > 0 ? Math.min(videoDurationCap, duration) : 0;
    const maxStartTime = Math.max(0, duration - segmentDuration);
    const segmentStart = Math.max(0, Math.min(startTime, maxStartTime));
    const segmentEnd = Math.min(duration, segmentStart + segmentDuration);
    const sizeLimitMb = maxFileSizeBytes / 1024 / 1024;
    const validationError = file && file.size > maxFileSizeBytes
        ? `File too large (Max ${sizeLimitMb.toFixed(0)}MB). Selected: ${(file.size / 1024 / 1024).toFixed(1)}MB`
        : !validCap ? "Choose a valid generation duration before trimming."
            : duration > 0 && segmentDuration < minSegmentSeconds
                ? `Choose a video segment at least ${minSegmentSeconds} seconds long.`
                : metadataError;
    const canProcess = Boolean(file && sourceDim && duration > 0 && segmentEnd > segmentStart && !validationError);
    const textColor = darkMode ? '#f4f4f6' : '#20232a';
    const secondaryColor = darkMode ? '#a9abb4' : '#666b76';
    const dividerColor = darkMode ? 'rgba(255,255,255,.09)' : 'rgba(20,25,35,.08)';
    const selectedStartPercent = duration > 0 ? segmentStart / duration * 100 : 0;
    const selectedWidthPercent = duration > 0 ? segmentDuration / duration * 100 : 0;

    useCreationControls(surface, 'ModalVideoPreview', open, {
        selectedFile: Boolean(file),
        fileWithin700Mb: Boolean(file && file.size <= MAX_FILE_SIZE),
        fileWithinSizeLimit: Boolean(file && file.size <= maxFileSizeBytes),
        sourceDurationSeconds: duration,
        generationDurationSeconds: videoDurationCap,
        segmentDurationSeconds: segmentDuration,
        segmentStartSeconds: segmentStart,
        targetAspectRatio: Number(targetAspectRatio.toFixed(2)),
        processing: isProcessing,
        processed: Boolean(internalTrimmedUrl),
    });

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        sessionVersionRef.current += 1;
        setInternalTrimmedUrl(null);
        setError(null);
        setMetadataError(null);
        setProcessStep("");
        setIsProcessing(false);
        setStartTime(0);
        setDuration(0);
        setSourceDim(null);
        setPreviewUrl(null);
        const url = open && file && file.size <= maxFileSizeBytes ? URL.createObjectURL(file) : null;
        if (url) setPreviewUrl(url);
        return () => {
            sessionVersionRef.current += 1;
            if (url) URL.revokeObjectURL(url);
            if (processingRef.current) {
                processingRef.current = false;
                latestRef.current.onProcessingChange?.(false);
            }
        };
    }, [open, file, mode, maxFileSizeBytes]);

    useEffect(() => {
        let active = true;
        setTargetDim(null);
        if (!isReference && open && currentimage) {
            loadImageDimensions(currentimage).then(dim => {
                if (active) setTargetDim(dim);
            }).catch(() => { /* Processing can retry an image that failed to load. */ });
        }
        return () => { active = false; };
    }, [currentimage, isReference, open]);

    useEffect(() => {
        setStartTime(previous => Math.max(0, Math.min(previous, maxStartTime)));
        if (videoRef.current && videoRef.current.currentTime > maxStartTime) {
            videoRef.current.currentTime = segmentStart;
        }
    }, [maxStartTime, segmentStart]);

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;
        if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth < 2 || video.videoHeight < 2) {
            setMetadataError("Could not read valid video duration and dimensions. Choose another file.");
            return;
        }
        setMetadataError(null);
        setDuration(video.duration);
        setSourceDim({ w: video.videoWidth, h: video.videoHeight });
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current || segmentDuration <= 0 || processingRef.current) return;
        const current = videoRef.current.currentTime;
        if (current >= segmentEnd || current < segmentStart - 0.1) {
            videoRef.current.currentTime = segmentStart;
            if (!videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
            }
        }
    };

    const handleSliderChange = (_event: Event, newValue: number | number[]) => {
        const val = Math.max(0, Math.min(newValue as number, maxStartTime));
        setStartTime(val);
        if (videoRef.current) videoRef.current.currentTime = val;
    };

    const handleClose = () => {
        if (!processingRef.current) onClose();
    };

    const cleanupVideo = async (url: string) => {
        try {
            await axios.post(`${CLIK_URL}/del-video`, { url }, { withCredentials: true });
        } catch (cleanupError) {
            // A failed delete stays in the application's existing deferred cleanup queue.
            SaveVideoHelperForDelLater(url);
            console.warn("Video cleanup warning:", cleanupError);
        }
    };

    const handleConfirmAndProcess = async () => {
        if (!file || !sourceDim || !canProcess || processingRef.current) return;
        const operation = ++operationRef.current;
        const sessionVersion = sessionVersionRef.current;
        const selectedFile = file;
        const selectedMode = mode;
        const isCurrent = () => mountedRef.current && sessionVersionRef.current === sessionVersion
            && operationRef.current === operation && latestRef.current.open
            && latestRef.current.file === selectedFile && latestRef.current.mode === selectedMode;
        const requireCurrent = () => {
            if (!isCurrent()) throw new Error("Video processing was closed.");
        };
        let rawS3Url: string | null = null;
        let finalTrimmedUrl: string | null = null;
        let published = false;
        processingRef.current = true;
        setIsProcessing(true);
        setError(null);
        latestRef.current.onProcessingChange?.(true);

        try {
            // Motion Transfer crops to its image; regular references retain their video framing.
            setProcessStep("Preparing your clip…");
            const outputDim = isReference ? sourceDim : await loadImageDimensions(currentimage);
            requireCurrent();
            setProcessStep("Preparing your clip…");
            const signRes: any = await axios.post(
                `${CLIK_URL}/get_signed_url_video`,
                { values: { count: 1 } },
                { withCredentials: true }
            );
            requireCurrent();
            const holder = signRes.data?.holder;
            if (!holder || holder.length !== 1) throw new Error("Invalid signed URL.");
            const urlVideo = holder[0]?.urlVideo;
            if (typeof urlVideo !== 'string' || !urlVideo) throw new Error("No signed URL returned from server.");
            setProcessStep("Uploading video…");
            rawS3Url = urlVideo.split("?")[0];
            const uploadRes = await axios.put(urlVideo, selectedFile, {
                headers: {
                    "Content-Type": selectedFile.type || "video/mp4",
                    "Cache-Control": IMMUTABLE_VIDEO_CACHE_CONTROL,
                },
            });
            if (uploadRes.status !== 200 && uploadRes.status !== 204) {
                throw new Error(`Upload failed: ${uploadRes.status}`);
            }
            requireCurrent();
            setProcessStep("Trimming your clip…");
            const trimRes: any = await axios.post(`${CLIK_URL}/Trim-video`, {
                video: rawS3Url,
                start: segmentStart,
                end: segmentEnd,
                outputBucket: "s3://clikbatebucket/videos/",
                inputWidth: outputDim.w,
                inputHeight: outputDim.h,
            }, { withCredentials: true });
            const processedUrl = trimRes.data?.videoUrl;
            if (typeof processedUrl !== 'string' || !processedUrl) throw new Error("Video processing failed.");
            finalTrimmedUrl = processedUrl;
            requireCurrent();
            setProcessStep("Finishing up…");
            await cleanupVideo(rawS3Url);
            rawS3Url = null;
            requireCurrent();
            setInternalTrimmedUrl(finalTrimmedUrl);
            latestRef.current.onUploadSuccess(processedUrl);
            published = true;
        } catch (err: any) {
            if (isCurrent()) setError(err?.response?.data?.error || err.message || "Failed to process video. Try again.");
        } finally {
            // Keep the raw input until a pending trim has returned, including after unmount.
            if (rawS3Url) await cleanupVideo(rawS3Url);
            if (finalTrimmedUrl && !published) await cleanupVideo(finalTrimmedUrl);
            if (isCurrent()) {
                processingRef.current = false;
                setIsProcessing(false);
                setProcessStep("");
                latestRef.current.onProcessingChange?.(false);
            }
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            disableEscapeKeyDown={isProcessing}
            maxWidth="md"
            fullWidth
            aria-labelledby="video-trim-title"
            sx={{ zIndex: 9999999, '& .MuiBackdrop-root': { bgcolor: 'rgba(8,10,18,.72)', backdropFilter: 'blur(7px)' } }}
            PaperProps={{
                sx: {
                    m: 2,
                    width: 'calc(100% - 32px)',
                    maxWidth: 860,
                    maxHeight: 'calc(100dvh - 32px)',
                    bgcolor: darkMode ? '#17191f' : '#fff',
                    color: textColor,
                    borderRadius: { xs: 3, sm: 4 },
                    border: `1px solid ${alpha(appColor, darkMode ? .25 : .18)}`,
                    boxShadow: '0 28px 90px rgba(0,0,0,.35)',
                    overflow: 'hidden',
                }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, sm: 3 }, py: 2, flexShrink: 0, borderBottom: `1px solid ${dividerColor}` }}>
                <Box sx={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2.5, color: appColor, bgcolor: alpha(appColor, darkMode ? .16 : .1) }}>
                    <ContentCutRoundedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography id="video-trim-title" component="h2" sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 750, lineHeight: 1.3 }}>
                        {internalTrimmedUrl ? 'Your clip is ready' : isReference ? 'Trim video reference' : 'Select motion clip'}
                    </Typography>
                    <Typography sx={{ mt: .4, fontSize: 13, color: secondaryColor, lineHeight: 1.45 }}>
                        {internalTrimmedUrl ? 'Use this clip to continue.' : `Choose the part to use for your ${videoDurationCap}s video.`}
                    </Typography>
                </Box>
                <IconButton
                    {...cb(surface, 'close', isReference ? 'Close video-reference segment preview' : 'Close motion-reference segment preview', 'onClose')}
                    aria-label="Close video trim"
                    onClick={handleClose}
                    disabled={isProcessing}
                    sx={{ alignSelf: 'flex-start', color: secondaryColor, bgcolor: darkMode ? 'rgba(255,255,255,.04)' : 'rgba(20,25,35,.04)', '&:hover': { color: textColor, bgcolor: alpha(appColor, .12) } }}
                >
                    <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Box>

            <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                <Box sx={{
                    width: '100%',
                    height: { xs: 'clamp(160px, 31dvh, 270px)', sm: 'clamp(160px, 36dvh, 350px)' },
                    '@media (max-height: 700px)': { height: 'clamp(110px, 24dvh, 170px)' },
                    bgcolor: '#07080b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 2.5,
                    border: `1px solid ${dividerColor}`,
                }}>
                    {internalTrimmedUrl ? (
                        <video
                            src={internalTrimmedUrl}
                            controls
                            autoPlay
                            loop
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    ) : (
                        previewUrl && (
                            <Box sx={{
                                aspectRatio: `${targetAspectRatio}`,
                                ...(isReference ? { width: '100%', height: '100%' } : {}),
                                maxHeight: '100%',
                                maxWidth: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                <video
                                    ref={videoRef}
                                    src={previewUrl}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onError={() => setMetadataError("Could not read this video. Choose another file.")}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={() => {
                                        if (!videoRef.current || segmentDuration <= 0 || processingRef.current) return;
                                        videoRef.current.currentTime = segmentStart;
                                        videoRef.current.play().catch(() => {});
                                    }}
                                    autoPlay
                                    controls
                                    playsInline
                                    muted
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: isReference ? 'contain' : 'cover'
                                    }}
                                />
                            </Box>
                        )
                    )}

                    {!isProcessing && segmentDuration > 0 && (
                        <Box sx={{ pointerEvents: 'none', position: 'absolute', top: 12, left: 12, px: 1.2, py: .55, borderRadius: 1.5, bgcolor: appColor, color: accentText, fontSize: 11, fontWeight: 750, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
                            {segmentDuration.toFixed(1)}s clip
                        </Box>
                    )}
                    {isProcessing && (
                        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(7,8,11,.85)', backdropFilter: 'blur(5px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 2 }}>
                            <CircularProgress size={38} thickness={4} sx={{ color: appColor }} />
                            <Typography sx={{ color: '#fff', fontSize: 15, fontWeight: 700 }} aria-live="polite">{processStep}</Typography>
                            <Typography sx={{ color: '#bfc0c8', fontSize: 12 }}>Your clip will be ready in a moment.</Typography>
                        </Box>
                    )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.2, mb: 2 }}>
                    <Typography title={file?.name} sx={{ fontSize: 12, color: secondaryColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name || 'Video reference'}</Typography>
                    <Typography sx={{ flexShrink: 0, fontSize: 12, color: secondaryColor, fontVariantNumeric: 'tabular-nums' }}>
                        {duration > 0 ? `${duration.toFixed(1)}s source` : 'Loading video…'}
                    </Typography>
                </Box>

                {!internalTrimmedUrl && (
                    <Box sx={{ p: { xs: 1.5, sm: 2 }, border: `1px solid ${alpha(appColor, darkMode ? .23 : .18)}`, bgcolor: darkMode ? 'rgba(255,255,255,.025)' : '#fafbfc', borderRadius: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Selected segment</Typography>
                            <Typography sx={{ px: 1, py: .35, borderRadius: 1, bgcolor: alpha(appColor, darkMode ? .15 : .1), color: textColor, fontSize: 11, fontWeight: 700 }}>
                                {segmentDuration > 0 ? `${segmentDuration.toFixed(1)}s` : `${videoDurationCap}s`} clip
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
                            {[{ label: 'Start', value: segmentStart }, { label: 'End', value: segmentEnd }].map(item => (
                                <Box key={item.label} sx={{ px: 1.4, py: 1, border: `1px solid ${dividerColor}`, borderRadius: 1.5, bgcolor: darkMode ? '#1b1e26' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                    <Typography sx={{ color: secondaryColor, fontSize: 12 }}>{item.label}</Typography>
                                    <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTime(item.value)}</Typography>
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ position: 'relative', mx: .5 }}>
                            <Box aria-hidden="true" sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 8, transform: 'translateY(-50%)', borderRadius: 4, bgcolor: darkMode ? '#373b46' : '#e3e6ed', overflow: 'hidden' }}>
                                <Box sx={{ position: 'absolute', left: `${selectedStartPercent}%`, width: `${selectedWidthPercent}%`, height: '100%', bgcolor: appColor, borderRadius: 4 }} />
                            </Box>
                            <Slider
                                {...cb(surface, 'select_segment', `Set segment start in seconds for ${segmentDuration || videoDurationCap}-second ${isReference ? 'video-reference' : 'motion-reference'} clip`, 'handleSliderChange', 'text')}
                                aria-label="Segment start"
                                value={segmentStart}
                                min={0}
                                max={duration || 1}
                                step={0.1}
                                track={false}
                                onChange={handleSliderChange}
                                valueLabelDisplay="auto"
                                valueLabelFormat={formatTime}
                                disabled={isProcessing || !canProcess || maxStartTime <= 0}
                                slotProps={{ input: { 'aria-valuemax': maxStartTime } }}
                                sx={{
                                    color: appColor, height: 8, py: 1.5,
                                    '& .MuiSlider-rail': { opacity: 0 },
                                    '& .MuiSlider-thumb': {
                                        width: 20, height: 20, bgcolor: appColor,
                                        border: `3px solid ${darkMode ? '#17191f' : '#fff'}`,
                                        boxShadow: `0 0 0 1px ${alpha(appColor, .55)}, 0 2px 5px rgba(0,0,0,.2)`,
                                        '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: `0 0 0 7px ${alpha(appColor, .14)}` },
                                    },
                                    '& .MuiSlider-valueLabel': { bgcolor: appColor, color: accentText, borderRadius: 1, fontWeight: 700 },
                                }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', color: secondaryColor, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                            <span>{formatTime(0)}</span><span>{formatTime(duration)}</span>
                        </Box>
                        <Typography sx={{ mt: 1.5, color: secondaryColor, fontSize: 12, lineHeight: 1.5 }}>
                            {duration > 0 && duration < videoDurationCap
                                ? `This ${duration.toFixed(1)}s clip is shorter than the selected ${videoDurationCap}s generation. The full clip will be used.`
                                : `Drag the start handle to choose your clip. Its length stays at ${segmentDuration || videoDurationCap}s.`}
                        </Typography>
                    </Box>
                )}
                {(validationError || error) && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{validationError || error}</Alert>}
            </DialogContent>

            <Box sx={{ display: 'flex', gap: 1.25, px: { xs: 2, sm: 3 }, py: 2, flexShrink: 0, borderTop: `1px solid ${dividerColor}`, bgcolor: darkMode ? '#17191f' : '#fff' }}>
                <Button
                    {...cb(surface, 'cancel', 'Cancel video trimming and keep the current reference', 'onClose')}
                    onClick={handleClose}
                    disabled={isProcessing}
                    sx={{ px: { xs: 2, sm: 3 }, py: 1.2, borderRadius: 2, textTransform: 'none', color: secondaryColor, fontWeight: 650, border: `1px solid ${dividerColor}`, '&:hover': { bgcolor: alpha(appColor, .07), color: textColor } }}
                >
                    {internalTrimmedUrl ? 'Close' : 'Cancel'}
                </Button>
                <Button
                    {...cb(surface, internalTrimmedUrl ? 'use_processed_video' : 'confirm_process', internalTrimmedUrl
                        ? 'Use the processed video reference'
                        : isReference ? 'Upload and trim the selected video-reference segment' : 'Upload, trim and crop the selected motion-reference video', internalTrimmedUrl ? 'onClose' : 'handleConfirmAndProcess', 'click', internalTrimmedUrl ? 'candidate' : 'requires_video')}
                    onClick={internalTrimmedUrl ? handleClose : handleConfirmAndProcess}
                    disabled={isProcessing || (!internalTrimmedUrl && !canProcess)}
                    variant="contained"
                    startIcon={isProcessing ? <CircularProgress size={17} color="inherit" /> : internalTrimmedUrl ? <CheckCircleIcon /> : isReference ? <ContentCutRoundedIcon /> : <CloudUploadIcon />}
                    sx={{ ...appAccentButtonSx(appColor, darkMode, { contrast: .06 }), flex: 1, minWidth: 0, px: 1.5, py: 1.2, borderRadius: 2, textTransform: 'none', fontSize: 14, fontWeight: 750 }}
                >
                    {isProcessing ? 'Preparing clip…' : internalTrimmedUrl ? 'Use This Video' : isReference ? 'Trim & Use Video' : 'Confirm & Process'}
                </Button>
            </Box>
        </Dialog>
    );
};

export default ModalVideoPreview;
