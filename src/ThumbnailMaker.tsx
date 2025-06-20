import React, { FC, useRef, useState, useEffect, useCallback } from "react";
import { Box, Button, Slider, IconButton } from "@mui/material";
import CropIcon from "@mui/icons-material/Crop";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import axios from "axios";
import { matchMobile } from "./DetectDevice";

interface ThumbnailMakerProps {
    videoURL: string;
    setThumbnail: (thumbUrl: string) => void;
    setShowThumb: (show: boolean) => void;
}
interface SignedUrl { urlBase: string; urlHD: string; }

const targetAspect = 9 / 16; // width/height

const ThumbnailMaker: FC<ThumbnailMakerProps> = ({
    videoURL,
    setThumbnail,
    setShowThumb,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const offsetRef = useRef<number>(0);
    const intervalRef = useRef<number | null>(null);

    const CLIK_URL = import.meta.env.VITE_CLIK_URL as string;

    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [offset, setOffset] = useState(0);
    const [maxOffset, setMaxOffset] = useState(0);
    const isMobile = matchMobile;


    // 3) Always‐portrait drawFrame()
    const drawFrame = useCallback(
        (video: HTMLVideoElement, userOffset: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // compute display‐size as portrait
            const maxW = window.innerWidth * (isMobile ? 0.9 : 0.5);
            const maxH = window.innerHeight * (isMobile ? 0.75 : 0.7);
            let displayH = maxH;
            let displayW = displayH * targetAspect;
            if (displayW > maxW) {
                displayW = maxW;
                displayH = displayW / targetAspect;
            }

            canvas.width = displayW;
            canvas.height = displayH;
            ctx.clearRect(0, 0, displayW, displayH);

            const vidW = video.videoWidth;
            const vidH = video.videoHeight;
            const cropW = vidH * targetAspect;
            const cropH = vidH;

            // center + user pan
            const sx = Math.min(maxOffset, Math.max(0, userOffset));
            const sy = 0;

            ctx.drawImage(
                video,
                sx, sy, cropW, cropH,
                0, 0, displayW, displayH
            );
        },
        [isMobile, maxOffset]
    );

    // 1) On metadata load, compute portrait‐crop and center it
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onLoaded = () => {
            const vidW = video.videoWidth;
            const vidH = video.videoHeight;

            // portrait‐crop width in source pixels
            const cropW = vidH * targetAspect;
            const extra = Math.max(0, vidW - cropW);

            setMaxOffset(extra);
            // start centered
            const centerOffset = extra / 2;
            offsetRef.current = centerOffset;
            setOffset(centerOffset);

            setDuration(video.duration);
            setCurrentTime(Math.min(5, video.duration / 2));

            // draw initial frame
            drawFrame(video, centerOffset);
        };

        video.addEventListener("loadedmetadata", onLoaded);
        return () => video.removeEventListener("loadedmetadata", onLoaded);
    }, [videoURL, drawFrame]);

    // 2) Seek & redraw on time / pan change
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onSeeked = () => drawFrame(video, offset);
        video.currentTime = currentTime;
        video.addEventListener("seeked", onSeeked);
        return () => video.removeEventListener("seeked", onSeeked);
    }, [currentTime, offset, drawFrame]);


    // slider → time
    const handleTimeChange = (_: Event, val: number | number[]) => {
        setCurrentTime(Array.isArray(val) ? val[0] : val);
    };

    // panning controls
    const startPan = () => {
        const video = videoRef.current;
        if (!video || maxOffset <= 0) return;
        offsetRef.current = offset;
        intervalRef.current = window.setInterval(() => {
            let next = offsetRef.current + 5;
            if (next > maxOffset) next = 0;
            offsetRef.current = next;
            setOffset(next);
            drawFrame(video, next);
        }, 30);
    };
    const stopPan = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    // upload via signed URLs
    const generateSignedUrl = useCallback(
        async (blob: Blob) => {
            const { data } = await axios.post<{ holder: SignedUrl[] }>(
                `${CLIK_URL}/get_signed_url_image`,
                { values: { count: 2 } },
                { withCredentials: true }
            );
            const urls = data.holder[0];
            await axios.put(urls.urlHD, blob, {
                headers: { "Content-Type": blob.type },
            });
            setThumbnail(urls.urlHD.split("?")[0]);
            setShowThumb(false);
        },
        [CLIK_URL, setThumbnail, setShowThumb]
    );

    // save → always portrait crop then upload
    // utility to detect iPhone
    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    // in your component
    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // choose format: JPEG on iPhone, WebP elsewhere
        const format = isIphone() ? "image/jpeg" : "image/webp";

        // you can also tweak JPEG quality; for WebP most browsers use lossless by default
        const quality = isIphone() ? 0.8 : undefined;

        canvas.toBlob(
            (blob) => {
                if (blob) generateSignedUrl(blob);
            },
            format,
            quality
        );
    };
    ;

    return (
        <Box
            position="fixed" top={0} left={0}
            width="100%" height="100%"
            display="flex" flexDirection="column"
            alignItems="center" justifyContent="center"
            bgcolor="rgba(20,20,20,0.6)" zIndex={1300}
        >
            <IconButton
                onClick={() => setShowThumb(false)}
                sx={{ position: "absolute", top: "10vh", fontSize: "4rem", color: 'rgba(240,240,240,0.8)' }}
            >
                <CloseIcon fontSize="inherit" />
            </IconButton>

            <canvas
                ref={canvasRef}
                style={{
                    width: "auto",
                    height: isMobile ? "75vh" : "70vh",
                    display: "block",
                    margin: "0 auto",
                }}
            />

            <Box display="flex" alignItems="center" sx={{ width: "80%", mt: 2 }}>
                <Slider
                    value={currentTime}
                    min={0}
                    max={duration}
                    onChange={handleTimeChange}
                    sx={{ flexGrow: 1 }}
                />
                {maxOffset > 0 && (
                    <IconButton
                        onMouseDown={startPan}
                        onMouseUp={stopPan}
                        onMouseLeave={stopPan}
                        onTouchStart={(e) => { e.preventDefault(); startPan(); }}
                        onTouchEnd={(e) => { e.preventDefault(); stopPan(); }}
                        sx={{ ml: 1 }}
                    >
                        <CropIcon sx={{ color: "#fff", fontSize: 36 }} />
                    </IconButton>
                )}
            </Box>

            <Button
                variant="contained"
                onClick={handleSave}
                startIcon={<CheckIcon />}
                sx={{ mt: 2 }}
            >
                Save Thumbnail
            </Button>

            <video
                ref={videoRef}
                src={videoURL}
                crossOrigin="anonymous"
                style={{ display: "none" }}
            />
        </Box>
    );
};

export default ThumbnailMaker;
