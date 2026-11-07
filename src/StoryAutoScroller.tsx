import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { Box, CardMedia, Card, CircularProgress } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

/* ───────── props (kept compatible) ───────── */
interface StoryAutoScrollerProps {
    allVideos?: string[];        // Array of all items xv1..xv9
    item1vid?: string;           // when images.length === 0, optional video for slot 1
    image?: string;              // when images.length === 0, image for slot 0
    images: string[];            // image slides (first two used when mode === 2, else up to 3)
    caption: string;
    videoUrl?: string;           // (unused in your code, kept for compatibility)
    onClick: () => void;
    type: number;
    isMenuOpen: boolean;
    captionVisibility: boolean[];
    idx: number;
    MenuOpenb?: boolean;         // (unused, kept for compatibility)
    videoUrlItem?: string;       // video for slide 1 when images.length > 0
    videoUrlItem2?: string;      // video for slide 2 when images.length > 0 (if used)
    itemLoadArray: boolean[];    // external load flags per item
    setitemLoadArray: (updater: (prev: any) => any) => void;
    minimisePrompt: boolean;
    vertical: boolean;
    isFullscreen: boolean;
    suspended?: boolean;
    mode: number;
    interactionFormat?: string | null;
    image2?: string;             // overlay image when images.length === 0
    showEmotions?: boolean;
    aiActionId?: string;
}

const StoryAutoScroller: React.FC<StoryAutoScrollerProps> = ({
    allVideos,
    item1vid,
    image,
    images,
    caption,
    onClick,
    type,
    isMenuOpen,
    captionVisibility,
    idx,
    videoUrlItem,
    videoUrlItem2,
    itemLoadArray,
    setitemLoadArray,
    minimisePrompt,
    vertical,
    isFullscreen,
    suspended = false,
    mode,
    interactionFormat,
    image2,
    showEmotions,
    aiActionId
}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? "#E8BAFA" : "#0099cc");
    // Match FullScreenStories' distinction between spatial and hotspot posts.
    const isSpatialPost = interactionFormat === "spatial-v1";
    const interactionPreview = (thumbnail?: string) => isSpatialPost ? (
        <Box role="img" aria-label="Spatial experience" sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", bgcolor: "rgba(0,0,0,0.65)" }}>
            <ViewInArOutlinedIcon sx={{ color: "#fff", fontSize: 28 }} />
        </Box>
    ) : (
        <CardMedia component="img" image={thumbnail} alt={`${caption} thumbnail`} loading="lazy" decoding="async" sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }} />
    );

    /* ───────── state ───────── */
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cap, setcap] = useState(false);
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [nearViewport, setNearViewport] = useState(true);
    const mediaSuspended = suspended || isFullscreen || !nearViewport;
    useEffect(() => {
        const card = cardRef.current;
        if (!card || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => {
            setNearViewport(entry.isIntersecting);
        }, { rootMargin: '200px' });
        observer.observe(card);
        return () => observer.disconnect();
    }, []);

    // which video index is ready (decoded enough to play)
    const [videoReady, setVideoReady] = useState<Record<number, boolean>>({});

    // refs for active video(s) so we can pause/unload hidden ones
    const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
    const videoRefCallbacks = useRef<Record<number, (element: HTMLVideoElement | null) => void>>({});
    const videoRefFor = (index: number) => {
        if (!videoRefCallbacks.current[index]) videoRefCallbacks.current[index] = element => {
            const previous = videoRefs.current[index];
            if (previous && previous !== element) {
                previous.pause();
                previous.removeAttribute('src');
                try { previous.load(); } catch { /* Media was already detached. */ }
            }
            videoRefs.current[index] = element;
        };
        return videoRefCallbacks.current[index];
    };

    /* ───────── memoized styles ───────── */
    const imgSx = useMemo(
        () => ({
            borderRadius: matchMobile ? (type === 10 ? 2 : 2) : 2,
            objectFit: "cover" as const,
            width: "100%",
            height: "100%",
            cursor: "pointer",
            "&::-webkit-scrollbar": { display: "none" }
        }),
        [type]
    );

    /* ───────── derived constants (kept) ───────── */
    const numPics =
        images.length === 0 ? 2 :
            mode === 2 ? 2 : images.length === 2 ? 2 : 2;

    const [randomOverrides, setRandomOverrides] = useState<{ rImg?: number, rVid?: number }>({});

    useEffect(() => {
        if (itemLoadArray && itemLoadArray.length > 3 && randomOverrides.rImg === undefined) {
            let rImg = 1;
            let rVid = 0;
            if (images && images.length > 2) {
                rImg = Math.floor(Math.random() * (images.length - 2)) + 2;
            }
            if (allVideos && allVideos.length > 2) {
                rVid = Math.floor(Math.random() * (allVideos.length - 2)) + 2;
            }
            setRandomOverrides({ rImg, rVid });
        }
    }, [itemLoadArray, images, allVideos, randomOverrides.rImg]);

    const overrideImgIdx = randomOverrides.rImg !== undefined ? randomOverrides.rImg : 1;
    const overrideVidIdx = randomOverrides.rVid !== undefined ? randomOverrides.rVid : 0;

    const displayedImages = images.slice(0, numPics);
    if (images.length > 1 && overrideImgIdx > 1) {
        displayedImages[1] = images[overrideImgIdx] || displayedImages[1];
    }

    // one-off random delay for slide 0 (kept behavior)
    const randomDuration = useMemo(
        () => Math.floor(
            (type === 10 && matchMobile ? 4500 + Math.random() * 6500 : 4500 + Math.random() * 6500)
        ),
        [images, type]
    );

    const getDuration = (nextIdx: number) =>
        currentIndex === 0 ? (!vertical && matchMobile ? 2000 : randomDuration) : 5000;

    /* ───────── caption visibility timer (with cleanup) ───────── */
    useEffect(() => {
        if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        captionTimerRef.current = setTimeout(() => {
            setcap(Boolean(captionVisibility?.[idx]));
            setCurrentIndex(0);
        }, 1000);

        return () => {
            if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        };
    }, [captionVisibility, idx]);

    /* ───────── auto-advance timer (with cleanup) ───────── */
    useEffect(() => {
        if (!nearViewport) return;
        // stop auto-advance in these cases (kept)
        if (isFullscreen || suspended || showEmotions) {
            setCurrentIndex(0);
            return;
        }

        if (images.length === 0) {
            // image + optional single video
            if (currentIndex !== 0) return; // stops loop unless we’re on first slide
            if (!item1vid) {
                setCurrentIndex(images.length);
                return;
            }
        }

        if (!minimisePrompt) {
            setCurrentIndex(0);
            return;
        }

        if (!captionVisibility?.[idx]) {
            setCurrentIndex(0);
            return;
        }

        if (itemLoadArray.length > 0 && itemLoadArray[idx]) {
            const nextIdx = (currentIndex + 1) % numPics;
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
            advanceTimerRef.current = setTimeout(() => setCurrentIndex(nextIdx), getDuration(nextIdx));
        }

        return () => {
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentIndex, randomDuration, captionVisibility, idx, itemLoadArray, images,
        minimisePrompt, vertical, type, item1vid, isFullscreen, suspended, showEmotions, numPics, nearViewport
    ]);

    /* ───────── pause & unload hidden videos to free memory ───────── */
    useEffect(() => {
        // allow only the current index to remain loaded/playing
        Object.entries(videoRefs.current).forEach(([k, v]) => {
            const i = Number(k);
            if (!v) return;
            if (i === currentIndex && !mediaSuspended) {
                v.play().catch(() => { /* ignore */ });
            } else {
                // pause + unload source (frees decoded frames/buffers)
                v.pause();
                v.removeAttribute("src");
                try { v.load(); } catch { /* ignore */ }
                // reset readiness for this hidden index so placeholder can show next time
                setVideoReady((s) => {
                    if (!s[i]) return s;
                    const { [i]: _removed, ...rest } = s;
                    return rest as Record<number, boolean>;
                });
            }
        });
    }, [currentIndex, mediaSuspended]);

    /* ───────── component unmount cleanup ───────── */
    useEffect(() => {
        return () => {
            if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
            Object.values(videoRefs.current).forEach((v) => {
                if (!v) return;
                v.pause();
                v.removeAttribute("src");
                try { v.load(); } catch { /* ignore */ }
            });
        };
    }, []);

    /* ───────── helpers ───────── */
    const markItemLoaded = (atIndex: number) => {
        if (atIndex !== 0) return;
        setitemLoadArray((prev: any) => {
            if (prev[idx]) return prev;
            const next = [...prev];
            next[idx] = true;
            return next;
        });
    };

    const isVideoIndex = (index: number) => {
        if (images.length === 0) {
            // two slots: 0=image, 1=video (item1vid)
            const actualItem1Vid = overrideVidIdx > 0 && allVideos ? allVideos[overrideVidIdx] : item1vid;
            return index === 1 && Boolean(actualItem1Vid);
        }
        // for multi-image mode, video only when not first slide and a url exists
        if (index === 1) {
            return Boolean(overrideImgIdx > 1 && allVideos ? allVideos[overrideImgIdx] : videoUrlItem);
        }
        if (index === 2 && videoUrlItem2) return true;
        return false;
    };

    /* ───────── SINGLE-IMAGE SHORT-CIRCUIT (kept UI, memory-safe) ───────── */
    if (images.length === 0) {
        const actualItem1Vid = overrideVidIdx > 0 && allVideos ? allVideos[overrideVidIdx] : item1vid;
        const activeIsVideo = !mediaSuspended && currentIndex === 1 && Boolean(actualItem1Vid);
        const containerHeight = matchMobile
            ? (vertical ? (type === 10 ? "36vh" : "36vh") : "38vh")
            : (vertical ? (isMenuOpen ? type === 10 ? '40vh' : "40vh" : "50vh") : (isMenuOpen ? "42vh" : "44vh"));

        // keep your badge UI: spinner shows next to icon when not ready (regardless of active)
        // image acts as placeholder and is hidden once active video is ready (no visible change)
        const showImage = !activeIsVideo || (activeIsVideo && !videoReady[1]);

        return (
            <Box ref={cardRef} data-ai-action={aiActionId} sx={{ position: "relative", width: "100%", overflow: "hidden", backgroundColor: darkModeReducer ? '#000000' : "#ffffff", }} onClick={onClick}>
                <Card
                    sx={{
                        height: containerHeight,
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: darkModeReducer ? '#000000' : "#ffffff",
                        boxShadow: "none",
                        borderRadius: matchMobile ? (type === 10 ? 2 : 2) : 2
                    }}
                >
                    {/* base image (placeholder, hidden once active video ready) */}
                    {image && showImage && (
                        <CardMedia
                            component="img"
                            image={image}
                            alt={caption}
                            loading={idx < 6 ? "eager" : "lazy"}
                            decoding="async"
                            onLoad={() => markItemLoaded(0)}
                            sx={{ ...imgSx, display: "block", backgroundColor: "transparent", }}
                        />
                    )}

                    {/* Video badge with spinner (exact UI) */}
                    {(actualItem1Vid && (!activeIsVideo || (activeIsVideo && !videoReady[1]))) && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: matchMobile ? 5 : 6,
                                right: matchMobile ? 5 : 6,
                                display: "flex",
                                alignItems: "center",
                                px: 0.5,
                                py: 0.25,
                                borderRadius: "12px",
                                bgcolor: "rgba(0,0,0,0.4)",
                                visibility: mode === 2 ? 'hidden' : 'visible'
                            }}
                        >
                            <VideocamIcon sx={{ color: "#fff", fontSize: matchMobile ? 14 : 18 }} />
                        </Box>
                    )}

                    {/* Active video (poster to avoid flash; only mounted when active) */}
                    {activeIsVideo && actualItem1Vid && (
                        <CardMedia
                            key={actualItem1Vid} // ensure remount on source change
                            component="video"
                            ref={videoRefFor(1)}
                            src={actualItem1Vid}
                            poster={image}
                            autoPlay
                            muted
                            loop
                            playsInline
                            controls={false}
                            preload="none"
                            onLoadedData={() => setVideoReady((s) => ({ ...s, 1: true }))}
                            onCanPlay={() => setVideoReady((s) => ({ ...s, 1: true }))}
                            onClick={(e: any) => {
                                const v = e.currentTarget as HTMLVideoElement;
                                v[v.paused ? "play" : "pause"]?.();
                            }}
                            sx={{
                                ...imgSx,
                                position: "absolute",
                                inset: 0
                            }}
                        />
                    )}

                    {/* Circular spatial cube or hotspot thumbnail */}
                    {mode === 2 && (isSpatialPost || image2) && (
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: matchMobile ? "1vh" : isMenuOpen ? "1.4vh" : "1.5vh",
                                left: matchMobile ? "3.5%" : "5%",
                                height: matchMobile ? (type === 10 ? "48px" : "48px") : "52.8px",
                                width: matchMobile ? (type === 10 ? "48px" : "48px") : "52.8px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                objectPosition: '50% 20%',

                                opacity: 1,
                                /// boxShadow: "0 0 6px rgba(0,0,0,0.4)",
                                boxShadow: `0 0 6px ${appColor}`,
                                border: `1px solid ${appColor}`,
                                overflow: "hidden"
                            }}
                        >
                            {interactionPreview(image2)}
                        </Box>
                    )}
                </Card>
            </Box>
        );
    }

    /* ───────── MULTI-IMAGE/VIDEO CAROUSEL (kept UI, memory-safe) ───────── */
    const containerHeight = matchMobile
        ? (vertical ? (type === 10 ? "36vh" : "36vh") : "38vh")
        : (vertical ? (isMenuOpen ? type === 10 ? '40vh' : "40vh" : "50vh") : (isMenuOpen ? "42vh" : "44vh"));

    return (
        <Box ref={cardRef} data-ai-action={aiActionId} sx={{ position: "relative", width: "100%", overflow: "hidden" }} onClick={onClick}>
            <Box sx={{ width: "100%", overflow: "hidden" }}>
                <Box
                    sx={{
                        display: "flex",
                        width: "100%",
                        transform: `translateX(-${currentIndex * 100}%)`,
                        transition: "transform 0.8s ease"
                    }}
                >
                    {displayedImages.map((src, index) => {
                        const active = !mediaSuspended && currentIndex === index;
                        const isVideo = isVideoIndex(index);
                        let videoSrc = index === 1 ? videoUrlItem : index === 2 ? videoUrlItem2 : undefined;
                        if (index === 1 && overrideImgIdx > 1 && allVideos) {
                            videoSrc = allVideos[overrideImgIdx] || videoSrc;
                        }

                        // Image placeholder logic (no visual change: video covers it when mounted)
                        const showImgPlaceholder = !isVideo || !active || (isVideo && active && !videoReady[index]);

                        return (
                            <Box key={index} sx={{ flex: "0 0 100%", width: "100%", overflow: "hidden", backgroundColor: darkModeReducer ? '#000000' : "#ffffff", }}>
                                <Card
                                    sx={{
                                        height: containerHeight,
                                        position: "relative",
                                        overflow: "hidden",
                                        backgroundColor: darkModeReducer ? '#000000' : "#ffffff",
                                        boxShadow: "none",
                                        borderRadius: matchMobile ? (type === 10 ? 2 : 2) : 2
                                    }}
                                >
                                    {/* Always your image UI, but hidden once active video is ready to avoid double textures */}
                                    {showImgPlaceholder && (
                                        <CardMedia
                                            component="img"
                                            image={src}
                                            alt={caption}
                                            loading={idx < 6 && index === 0 ? "eager" : "lazy"}
                                            decoding="async"
                                            onLoad={() => markItemLoaded(index)}
                                            sx={{
                                                ...imgSx,
                                                display: cap ? "block" : index === 0 ? "block" : "none"
                                            }}
                                        />
                                    )}

                                    {/* Circular spatial cube or hotspot thumbnail */}
                                    {mode === 2 && (isSpatialPost || displayedImages[1]) && (
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                bottom: matchMobile ? "1vh" : isMenuOpen ? "0.4vh" : "0.5vh",
                                                left: matchMobile ? "3.5%" : "5%",
                                                height: matchMobile ? (type === 10 ? "52.8px" : "48px") : "52.8px",
                                                width: matchMobile ? (type === 10 ? "52.8px" : "48px") : "52.8px",
                                                borderRadius: "50%",
                                                objectFit: "cover",
                                                objectPosition: '50% 20%',
                                                boxShadow: `0 0 6px ${appColor}`,
                                                border: `1px solid ${appColor}`,
                                                overflow: "hidden",
                                                display: mode === 2 ? "block" : "none"
                                            }}
                                        >
                                            {interactionPreview(displayedImages[1])}
                                        </Box>
                                    )}

                                    {/* Video badge (kept UI). Spinner only while active & not ready */}
                                    {isVideo && (
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: matchMobile ? 5 : 6,
                                                right: matchMobile ? 5 : 6,
                                                display: "flex",
                                                alignItems: "center",
                                                px: 0.5,
                                                py: 0.25,
                                                borderRadius: "12px",
                                                bgcolor: "rgba(0,0,0,0.4)",
                                                visibility: mode === 2 ? 'hidden' : 'visible'
                                            }}
                                        >
                                            <VideocamIcon sx={{ color: "#fff", fontSize: matchMobile ? 14 : 18 }} />
                                        </Box>
                                    )}

                                    {/* Mount the video ONLY when this slide is active AND it's a video (with poster) */}
                                    {active && isVideo && videoSrc && (
                                        <CardMedia
                                            key={videoSrc} // ensure remount on source change
                                            component="video"
                                            ref={videoRefFor(index)}
                                            src={videoSrc}
                                            poster={src}
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            controls={false}
                                            preload="none"
                                            onLoadedData={() => setVideoReady((s) => ({ ...s, [index]: true }))}
                                            onCanPlay={() => setVideoReady((s) => ({ ...s, [index]: true }))}
                                            onClick={(e: any) => {
                                                const v = e.currentTarget as HTMLVideoElement;
                                                v[v.paused ? "play" : "pause"]?.();
                                            }}
                                            sx={{
                                                ...imgSx,
                                                position: "absolute",
                                                inset: 0
                                            }}
                                        />
                                    )}

                                    {/* Spinner overlay on first slide while caption is visible (kept behavior) */}
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: 8,
                                            right: 8,
                                            p: 1,
                                            borderRadius: "80%",
                                            pointerEvents: "none",
                                            display: captionVisibility?.[idx] && index === 0 ? "flex" : "none",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            visibility: 'hidden'
                                        }}
                                    >
                                        <CircularProgress
                                            variant="indeterminate"
                                            size={40}
                                            thickness={4}
                                            sx={{
                                                color: "rgba(5,5,5,0.05)",
                                                animationDuration: "8000ms",
                                                position: "absolute"
                                            }}
                                        />
                                        <CircularProgress
                                            variant="indeterminate"
                                            size={32}
                                            thickness={4}
                                            sx={{
                                                color: "rgba(255,255,255,0.2)",
                                                animationDuration: "8000ms",
                                                position: "relative"
                                            }}
                                        />
                                    </Box>
                                </Card>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
};

/* Use default memo (no risky custom comparator that can miss props) */
export default memo(StoryAutoScroller);
