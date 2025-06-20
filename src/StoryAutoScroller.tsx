import React, { useState, useEffect, useMemo, useRef, memo } from "react";
import { Box, CardMedia, Card } from "@mui/material";

import { matchMobile } from "./DetectDevice";

/* ───────── props (unchanged) ───────── */
interface StoryAutoScrollerProps {
    image: any;
    images: any[];
    caption: string;
    onClick: () => void;
    type: number;
}

const StoryAutoScroller: React.FC<any> = ({
    image,
    images,
    caption,
    videoUrl,
    onClick,
    type,
    isMenuOpen,
    captionVisibility,
    idx,
    MenuOpenb,
    videoUrlItem,
    videoUrlItem2,
    itemLoadArray,
    setitemLoadArray,
    minimisePrompt,
}) => {
    const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);

    /* ───────── SINGLE-IMAGE SHORT-CIRCUIT (unchanged) ───────── */
    if (images.length === 0) {
        return (
            <Box
                sx={{ position: "relative", width: "100%", overflow: "hidden" }}
                onClick={onClick}
            >
                <Card
                    sx={{
                        height: matchMobile
                            ? type === 10
                                ? "36vh"
                                : "45vh"
                            : isMenuOpen
                                ? "60vh"
                                : "50vh",
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        borderRadius: matchMobile ? (type === 10 ? 0 : 2) : 2,
                    }}
                >
                    <CardMedia
                        component="img"
                        image={image}
                        alt={caption}
                        loading="lazy"
                        sx={{
                            borderRadius: matchMobile ? (type === 10 ? 0 : 2) : 2,
                            objectFit: "cover",
                            width: "100%",
                            height: "100%",
                            cursor: "pointer",
                            "&::-webkit-scrollbar": { display: "none" },
                        }}
                    />
                </Card>
            </Box>
        );
    }

    /* ───────── CAPTION TIMER (unchanged) ───────── */
    const [cap, setcap] = useState(false);
    useEffect(() => {
        if (iconTimeoutRefax.current) clearTimeout(iconTimeoutRefax.current);
        iconTimeoutRefax.current = setTimeout(
            () => setcap(captionVisibility[idx]),
            1000
        );
    }, [captionVisibility, idx]);

    /* ───────── DERIVED CONSTANTS  ───────── */
    const numPics = images.length === 2 ? 2 : 3;
    const displayedImages = images.slice(0, numPics);

    const [currentIndex, setCurrentIndex] = useState(0);

    /* one-off random delay for slide 0 */
    const randomDuration = useMemo(
        () => Math.floor(2500 + Math.random() * 5500),
        [images]
    );

    const getDuration = (nextIdx: number) =>
        currentIndex === 0 ? randomDuration : 4000;

    /* ───────── AUTO-ADVANCE TIMER (unchanged) ───────── */
    useEffect(() => {

        if (!minimisePrompt) {
            setCurrentIndex(0);
            return;
        }

        if (!captionVisibility[idx]) {
            setCurrentIndex(0);
            return;
        }

        if (itemLoadArray.length > 0 && itemLoadArray[idx]) {




            const nextIdx = (currentIndex + 1) % numPics;
            const index = setTimeout(() => setCurrentIndex(nextIdx), getDuration(nextIdx));
            return () => clearTimeout(index);

        }
    }, [currentIndex, randomDuration, captionVisibility, idx, itemLoadArray, images, minimisePrompt]);

    /* ───────── ⚡ PERF 1 – memoise style object ───────── */
    const imgSx = useMemo(
        () => ({
            borderRadius: matchMobile ? (type === 10 ? 0 : 2) : 2,
            objectFit: "cover",
            width: "100%",
            height: "100%",
            cursor: "pointer",
            "&::-webkit-scrollbar": { display: "none" },
        }),
        [type]
    );

    return (
        <Box
            sx={{ position: "relative", width: "100%", overflow: "hidden" }}
            onClick={onClick}
        >
            <Box sx={{ width: "100%", overflow: "hidden" }}>
                <Box
                    sx={{
                        display: "flex",
                        width: "100%",
                        transform: `translateX(-${currentIndex * 100}%)`,
                        transition: "transform 0.8s ease",
                    }}
                >
                    {displayedImages.map((src: any, index: any) => (
                        <Box
                            key={index}
                            sx={{ flex: "0 0 100%", width: "100%", overflow: "hidden" }}
                        >
                            <Card
                                sx={{
                                    height: matchMobile
                                        ? type === 10
                                            ? "36vh"
                                            : "45vh"
                                        : isMenuOpen
                                            ? "60vh"
                                            : "50vh",
                                    position: "relative",
                                    overflow: "hidden",
                                    backgroundColor: "transparent",
                                    boxShadow: "none",
                                    borderRadius: matchMobile ? (type === 10 ? 0 : 2) : 2,
                                }}
                            >
                                {/* your exact img logic */}


                                {videoUrlItem && currentIndex !== 0 ? (
                                    /* ---------- VIDEO ---------- */
                                    <CardMedia
                                        component="video"
                                        src={index === 1 ? videoUrlItem :
                                            videoUrlItem2
                                        }
                                        autoPlay
                                        muted                 // ✓ required for autoplay on mobile
                                        loop
                                        playsInline           // ✓ plays inside the page on iOS
                                        controls={false}      // hide default toolbar
                                        /* tap / click to toggle play–pause */
                                        onClick={e => {
                                            const vid = e.currentTarget as HTMLVideoElement;
                                            vid[vid.paused ? 'play' : 'pause']();
                                        }}
                                        /* mark this slot as loaded when we have enough data to play */

                                        sx={{
                                            ...imgSx,

                                            objectFit: 'cover',                 // match img behaviour
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                ) : (
                                    /* ---------- IMAGE ---------- */
                                    <CardMedia
                                        component="img"
                                        image={src}
                                        alt={caption}
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                        onLoad={() => {
                                            if (index === 0) {
                                                setitemLoadArray((prev: any) => {
                                                    if (prev[idx]) return prev;
                                                    const next = [...prev];
                                                    next[idx] = true;
                                                    return next;
                                                })
                                            }
                                        }
                                        }
                                        sx={{
                                            ...imgSx,
                                            display: cap ? 'block' : index === 0 ? 'block' : 'none',
                                        }}
                                    />
                                )}


                            </Card>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

/* ───────── ⚡ PERF 2 – prevent sibling re-renders ───────── */
export default memo(
    StoryAutoScroller,
    (prev, next) =>
        prev.images === next.images &&
        prev.captionVisibility[prev.idx] === next.captionVisibility[next.idx] &&
        prev.isMenuOpen === next.isMenuOpen
);
