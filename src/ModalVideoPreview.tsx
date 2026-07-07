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
import axios from "axios";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

// 700MB Limit
const MAX_FILE_SIZE = 700 * 1024 * 1024;

interface ModalVideoPreviewProps {
    open: boolean;
    onClose: () => void;
    file: File | null;
    videoDurationCap: number;
    darkMode: boolean;
    onUploadSuccess: (trimmedVideoUrl: string) => void;
    currentimage: string; // Ensure this is string url
}

const ModalVideoPreview: React.FC<ModalVideoPreviewProps> = ({
    open,
    onClose,
    file,
    videoDurationCap,
    darkMode,
    onUploadSuccess,
    currentimage
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // UI States
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const [startTime, setStartTime] = useState<number>(0);

    // Dimension States (For Aspect Ratio Logic)
    const [targetAspectRatio, setTargetAspectRatio] = useState<number>(16 / 9); // Default
    const [targetDim, setTargetDim] = useState<{ w: number, h: number } | null>(null);

    // Cleanup State
    const [uploadedRawUrl, setUploadedRawUrl] = useState<string | null>(null);
    const [internalTrimmedUrl, setInternalTrimmedUrl] = useState<string | null>(null);

    // Processing States
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStep, setProcessStep] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    // 1. Reset Internal State When Opened
    useEffect(() => {
        if (open) {
            setInternalTrimmedUrl(null);
            setError(null);
            setProcessStep("");
            setIsProcessing(false);
        }
    }, [open]);

    // 2. Load Target Image Dimensions (The "Dimensional Truth")
    useEffect(() => {
        if (currentimage) {
            const img = new Image();
            img.src = currentimage;
            img.onload = () => {
                const ratio = img.naturalWidth / img.naturalHeight;
                setTargetAspectRatio(ratio);
                setTargetDim({ w: img.naturalWidth, h: img.naturalHeight });
                // console.log(`Target Ratio set to: ${ratio} (${img.naturalWidth}x${img.naturalHeight})`);
            };
        }
    }, [currentimage]);

    // 3. Safety Cleanup
    useEffect(() => {
        if (!open && uploadedRawUrl) {
            console.log("Modal closed with pending file. Cleaning up:", uploadedRawUrl);
            axios.post(
                `${CLIK_URL}/del-video`,
                { url: uploadedRawUrl },
                { withCredentials: true }
            ).catch(err => console.error("Cleanup failed:", err));
            setUploadedRawUrl(null);
        }
    }, [open, uploadedRawUrl]);

    // 4. Load File & Check Size
    useEffect(() => {
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                setError(`File too large (Max 700MB). Selected: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
                setPreviewUrl(null);
                return;
            }
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setStartTime(0);
            setDuration(0);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    // 5. Loop Logic
    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const endTime = startTime + videoDurationCap;
        const current = videoRef.current.currentTime;

        if (current >= endTime || current < startTime - 0.1) {
            videoRef.current.currentTime = startTime;
            if (!videoRef.current.paused) {
                videoRef.current.play().catch(() => { });
            }
        }
    };

    const handleSliderChange = (event: Event, newValue: number | number[]) => {
        const val = newValue as number;
        setStartTime(val);
        if (videoRef.current) videoRef.current.currentTime = val;
    };

    // 6. THE PROCESS
    const handleConfirmAndProcess = async () => {
        if (!file || !videoRef.current) return;

        const img = new Image();
        img.src = currentimage;

        // âœ… Use the IMAGE natural dimensions (the â€œdimensional truthâ€)
        var videoInputWidth = 0;
        var videoInputHeight = 0;

        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;

            // âœ… Use the IMAGE natural dimensions (the â€œdimensional truthâ€)
            videoInputWidth = img.naturalWidth;
            videoInputHeight = img.naturalHeight;

            // now send these to backend (example)
            // axios.post("/Trim-video", {
            //   video, start, end, outputBucket,
            //   inputWidth: videoInputWidth,
            //   inputHeight: videoInputHeight,
            // });

            console.log("image ratio:", ratio, "dims:", videoInputWidth, videoInputHeight);

        }

        setIsProcessing(true);
        setError(null);

        try {
            // A. Get Signed URL
            setProcessStep("Initializing Upload...");
            const requestData = { values: { count: 1 } };
            const signRes: any = await axios.post(
                `${CLIK_URL}/get_signed_url_video`,
                requestData,
                { withCredentials: true }
            );

            const holder = signRes.data?.holder;
            if (!holder || holder.length !== 1) throw new Error("Invalid signed URL.");
            const { urlVideo } = holder[0];

            // B. Upload Raw File
            setProcessStep("Uploading Raw Video...");
            const uploadRes = await axios.put(urlVideo, file, {
                headers: { "Content-Type": file.type || "video/mp4" },
            });

            if (uploadRes.status !== 200 && uploadRes.status !== 204) {
                throw new Error(`Upload failed: ${uploadRes.status}`);
            }

            const rawS3Url = urlVideo.split("?")[0];
            setUploadedRawUrl(rawS3Url);

            const finalEndTime = Math.min(startTime + videoDurationCap, duration);

            // C. Transcode (Trim & CROP)
            setProcessStep("Trimming & Cropping...");
            const trimRes: any = await axios.post(`${CLIK_URL}/Trim-video`, {
                video: rawS3Url,
                start: startTime,
                end: finalEndTime,
                outputBucket: "s3://clikbatebucket/videos/",

                // --- NEW: Pass dimensions to backend for Auto-Crop calculation ---
                inputWidth: videoInputWidth,
                inputHeight: videoInputHeight,
                // We pass the target ratio implicitly or explicitly.
                // Since the backend logic you added previously was hardcoded to 9/16,
                // you might want to send the target dimensions too if you want it dynamic:
                // targetWidth: targetDim?.w,
                // targetHeight: targetDim?.h
            });

            if (!trimRes.data.videoUrl) throw new Error("Transcoding failed.");
            const finalTrimmedUrl = trimRes.data.videoUrl;

            // D. Cleanup
            setProcessStep("Cleaning up...");
            try {
                await axios.post(
                    `${CLIK_URL}/del-video`,
                    { url: rawS3Url },
                    { withCredentials: true }
                );
            } catch (delErr) {
                console.warn("Cleanup warning:", delErr);
            }

            // E. Success
            setInternalTrimmedUrl(finalTrimmedUrl);
            onUploadSuccess(finalTrimmedUrl);

        } catch (err: any) {
            console.error("Process error:", err);
            setError(err.message || "Failed to process video.");
        } finally {
            setIsProcessing(false);
            setProcessStep("");
        }
    };

    const maxStartTime = Math.max(0, duration - videoDurationCap);

    return (
        <Dialog
            open={open}
            onClose={!isProcessing ? onClose : undefined}
            maxWidth="md"
            fullWidth
            sx={{ zIndex: 9999999 }}
            PaperProps={{
                sx: {
                    bgcolor: darkMode ? "#121212" : "#fff",
                    color: darkMode ? "#fff" : "#000",
                    borderRadius: 2
                }
            }}
        >
            <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.2)' }}>
                    <Typography variant="h6" fontWeight="bold">
                        {internalTrimmedUrl ? "Video Processed" : `Select Segment (${videoDurationCap}s)`}
                    </Typography>
                    {!isProcessing && (
                        <IconButton onClick={onClose} sx={{ color: 'inherit' }}>
                            <CloseIcon />
                        </IconButton>
                    )}
                </Box>

                {/* --- VIDEO AREA --- */}
                {/* We use a black background container to frame the crop preview */}
                <Box sx={{
                    width: '100%',
                    height: '450px',
                    bgcolor: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>

                    {/* A. RESULT VIEW */}
                    {internalTrimmedUrl ? (
                        <video
                            src={internalTrimmedUrl}
                            controls
                            autoPlay
                            loop
                            style={{ maxWidth: '100%', maxHeight: '100%' }}
                        />
                    ) : (
                        /* B. PREVIEW / TRIM VIEW (With Visual Crop Simulation) */
                        previewUrl && (
                            <Box sx={{
                                // This box forces the aspect ratio of the IMAGE
                                // The Max Height/Width constraints keep it inside the modal
                                aspectRatio: `${targetAspectRatio}`,
                                maxHeight: '100%',
                                maxWidth: '100%',
                                position: 'relative',
                                border: '2px solid #4caf50', // Green border to show "This is your output shape"
                                overflow: 'hidden', // Hides the parts of video that get cropped
                                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                            }}>
                                <video
                                    ref={videoRef}
                                    src={previewUrl}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onTimeUpdate={handleTimeUpdate}
                                    autoPlay
                                    controls
                                    playsInline
                                    muted
                                    // objectFit: 'cover' is the MAGIC.
                                    // It zooms the video to fill the box, effectively cropping the sides/top
                                    // exactly how the backend will do it.
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />


                            </Box>
                        )
                    )}

                    {/* Processing Overlay */}
                    {isProcessing && (
                        <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.8)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <CircularProgress size={60} thickness={4} sx={{ color: '#fff', mb: 2 }} />
                            <Typography variant="h6" color="white" fontWeight="bold">{processStep}</Typography>
                            <Typography variant="caption" color="rgba(255,255,255,0.7)">Do not close window</Typography>
                        </Box>
                    )}
                </Box>

                {/* --- CONTROLS AREA --- */}
                <Box sx={{ p: 3 }}>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    {internalTrimmedUrl ? (
                        <Button
                            onClick={onClose}
                            variant="contained"
                            color="success"
                            fullWidth
                            startIcon={<CheckCircleIcon />}
                            sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
                        >
                            Use This Video
                        </Button>
                    ) : (
                        <>
                            <Box sx={{ px: 1, mb: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Select {videoDurationCap}s Loop:
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: activeColor }}>
                                        Target Ratio: {targetAspectRatio.toFixed(2)}
                                    </Typography>
                                </Box>
                                <Slider
                                    value={startTime}
                                    min={0}
                                    max={maxStartTime}
                                    step={0.1}
                                    onChange={handleSliderChange}
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(val) => `${val.toFixed(1)}s`}
                                    disabled={isProcessing || duration <= videoDurationCap}
                                    sx={{
                                        height: 8,
                                        color: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                                        '& .MuiSlider-track': { border: 'none', bgcolor: 'transparent' },
                                        '& .MuiSlider-thumb': {
                                            height: 28, width: 28, borderRadius: '4px',
                                            backgroundColor: darkMode ? '#FFD700' : '#FF0000',
                                            border: '2px solid white',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                                        },
                                        '& .MuiSlider-rail': { opacity: 0.5, backgroundColor: 'gray' },
                                    }}
                                />
                            </Box>

                            <Button
                                onClick={handleConfirmAndProcess}
                                disabled={isProcessing || !file || !!error}
                                variant="contained"
                                fullWidth
                                startIcon={isProcessing ? null : <CloudUploadIcon />}
                                sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 'bold', bgcolor: darkMode ? '#3f51b5' : '#1976d2' }}
                            >
                                {isProcessing ? "Processing..." : "Confirm & Process"}
                            </Button>
                        </>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

// Helper for style
const activeColor = "#1976d2";

export default ModalVideoPreview;
