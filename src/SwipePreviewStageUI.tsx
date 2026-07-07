import React, { useEffect, useRef, useState, useCallback } from "react";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import SwipeLeftIcon from "@mui/icons-material/SwipeLeft";
import SwipeRightIcon from "@mui/icons-material/SwipeRight";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import SwipeLayer from "./SwipeLayer";
import Button from "@mui/material/Button";
import { matchMobile } from "./DetectDevice";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";

import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';



interface SwipePreviewStageProps {
    backToEdit: () => void;
    mainSrc: string;
    subs: [string, string]; // [left, right]
    registerRefs?: (refs: {
        main: HTMLVideoElement | null;
        subs: [HTMLVideoElement | null, HTMLVideoElement | null];
    }) => void;

    onPublish: any;
    feeds: any;
    wipeInteractionState: any;

    mainAudioUrl: string | null | undefined;
    sub1AudioUrl: string | null | undefined;
    sub2AudioUrl: string | null | undefined;
}

/** Hints omitted for brevity â€” unchanged */
const CloudHint: React.FC<{ side: "left" | "right" }> = ({ side }) => {
    const isLeft = side === "left";
    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                top: "50%",
                [isLeft ? "left" : "right"]: 0,
                transform: "translateY(-50%)",
                width: "10%",
                minWidth: 64,
                maxWidth: 120,
                height: 48,
                borderRadius: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: isLeft ? "flex-end" : "flex-start",
                gap: 8,
                paddingInline: 10,
                background:
                    "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
                zIndex: 6,
                pointerEvents: "none",
                opacity: 0.95
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    [isLeft ? "left" : "right"]: -10,
                    transform: "translateY(-50%)",
                    width: 22,
                    height: 28
                } as React.CSSProperties}
            />
            {isLeft ? (
                <SwipeLeftIcon sx={{ fontSize: 22, opacity: 0.95 }} />
            ) : (
                <SwipeRightIcon sx={{ fontSize: 22, opacity: 0.95 }} />
            )}
        </div>
    );
};

const SwipePreviewStageUI: React.FC<SwipePreviewStageProps> = ({
    backToEdit,
    mainSrc,
    subs,
    registerRefs,
    onPublish,
    feeds,
    wipeInteractionState,
    mainAudioUrl,
    sub1AudioUrl,
    sub2AudioUrl
}) => {
    const mainRef = useRef<HTMLVideoElement | null>(null);
    const leftRef = useRef<HTMLVideoElement | null>(null);
    const rightRef = useRef<HTMLVideoElement | null>(null);

    // AUDIO refs
    const mainAudioRef = useRef<HTMLAudioElement | null>(null);
    const leftAudioRef = useRef<HTMLAudioElement | null>(null);
    const rightAudioRef = useRef<HTMLAudioElement | null>(null);

    const [active, setActive] = useState<null | "left" | "right">(null);
    const [showHints, setShowHints] = useState(true);
    useEffect(() => {
        if (active === null) {
            setShowHints(true);
            const t = setTimeout(() => setShowHints(false), 60000);
            return () => clearTimeout(t);
        }
    }, [active]);

    useEffect(() => {
        registerRefs?.({
            main: mainRef.current,
            subs: [leftRef.current, rightRef.current]
        });
    }, [registerRefs]);

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Audio state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [mainAudioPlayedOnce, setMainAudioPlayedOnce] = useState(false); // NEW



    const MuteReducer = useSelector((state: RootState) => state.settings.fullscreenMute);
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const IS_IPHONE_OR_SAFARI = (() => {
        const ua = navigator.userAgent || "";
        const vendor = navigator.vendor || "";

        // iPhone / iPod (classic UA check)
        const isIPhone = /iPhone|iPod/i.test(ua);

        // Safari (exclude Chrome/Edge/Opera/Firefox variants on iOS & desktop)
        const isSafari =
            /Safari/i.test(ua) &&
            /Apple/i.test(vendor) &&
            !/(CriOS|Chrome|Edg|OPR|Opera|FxiOS|Firefox)/i.test(ua);

        return isIPhone || isSafari;
    })();




    const tryPlay = useCallback(async (el?: HTMLMediaElement | null) => {
        if (!el) return false;
        try {
            await el.play();
            return true;
        } catch {
            return false;
        }
    }, []);

    const pauseAllAudios = useCallback(() => {
        [mainAudioRef.current, leftAudioRef.current, rightAudioRef.current].forEach(a => {
            try {
                a?.pause();
            } catch { }
        });
    }, []);

    // Attach one-time "ended" handler for main audio (marks it as played-once)
    useEffect(() => {
        const a = mainAudioRef.current;
        if (!a) return;

        const onEnded = () => { ///setMainAudioPlayedOnce(true);
        }
        a.addEventListener("ended", onEnded);
        return () => a.removeEventListener("ended", onEnded);
    }, [mainAudioUrl]);




    // Sub activation: each play is one-shot (no loop)
    const playSub = useCallback(
        async (side: "left" | "right") => {
            if (active) return;
            const main = mainRef.current;
            const subVideo = side === "left" ? leftRef.current : rightRef.current;
            if (!subVideo || !main) return;

            try { main.pause(); } catch { }

            subVideo.currentTime = 0;
            setActive(side);

            // Audio one-shot for this sub
            pauseAllAudios();
            if (audioEnabled) {
                const subAudio = side === "left" ? leftAudioRef.current : rightAudioRef.current;
                if (subAudio) {
                    subAudio.currentTime = 0;
                    await tryPlay(subAudio); // plays once; we don't loop subs
                }
            }

            try { await subVideo.play(); } catch { }
        },
        [active, audioEnabled, pauseAllAudios, tryPlay]
    );

    const returnToMain = useCallback(() => {
        const main = mainRef.current;
        const sub = active === "left" ? leftRef.current : rightRef.current;
        if (sub) {
            try { sub.pause(); } catch { }
            sub.currentTime = 0;
        }
        setActive(null);

        // DO NOT replay main audio here.
        // It should have played once on initial load only.
        pauseAllAudios();

        main?.play().catch(() => { });
    }, [active, pauseAllAudios]);

    const onSubEnded = useCallback(() => {
        returnToMain();
    }, [returnToMain]);

    useEffect(() => {
        const l = leftRef.current;
        const r = rightRef.current;
        if (l) l.addEventListener("ended", onSubEnded);
        if (r) r.addEventListener("ended", onSubEnded);
        return () => {
            if (l) l.removeEventListener("ended", onSubEnded);
            if (r) r.removeEventListener("ended", onSubEnded);
        };
    }, [onSubEnded]);

    const handleSwipe = (dir: "left" | "right") => {
        if (dir === "left") playSub("left");
        else playSub("right");
    };

    // Speaker visible only while a video is playing, audio isn't enabled yet, and at least one URL exists
    const shouldShowSpeaker =
        videoPlaying &&
        !audioEnabled &&
        (!!mainAudioUrl || !!sub1AudioUrl || !!sub2AudioUrl);






    // add setMainAudioPlayedOnce to your state if you don't already have it:
    // const [mainAudioPlayedOnce, setMainAudioPlayedOnce] = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);

    const audioUnlockedRef = useRef(false);


    // Prime ALL <audio> elements synchronously during the gesture.
    // No awaits, no timeouts before the first play().
    const primeAudioGesture = useCallback(() => {
        if (audioUnlockedRef.current) return;

        // Resume/create AudioContext (no await)
        try {
            const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AC) {
                audioCtxRef.current ??= new AC();
                audioCtxRef.current?.resume?.(); // don't await
            }
        } catch { }

        const els: (HTMLAudioElement | null)[] = [
            mainAudioRef.current,
            leftAudioRef.current,
            rightAudioRef.current,
        ];

        // ðŸ”‘ Synchronously "tick" each element once at tiny volume.
        // This unlocks each element individually for iOS.
        els.forEach((el) => {
            if (!el) return;
            const prevVol = el.volume;
            try {
                el.muted = false;              // must be audible
                el.volume = Math.max(0.01, prevVol || 0.01);
                if (el.ended) el.currentTime = 0;
                // Play NOW in the same pointer/click stack
                void el.play();
                // Stop next frame; weâ€™ll start the proper one later
                requestAnimationFrame(() => {
                    try { el.pause(); el.volume = prevVol; } catch { }
                });
            } catch {
                try { el.volume = prevVol; } catch { }
            }
        });

        audioUnlockedRef.current = true;
        setAudioEnabled(true);
    }, [setAudioEnabled]);

    const enableAudioByUser = useCallback(async () => {

        // primeAudioGesture();
        setAudioEnabled(true);

        const aMain = mainAudioRef.current;
        const aL = leftAudioRef.current;
        const aR = rightAudioRef.current;

        // 0) iOS/WebKit: resume an AudioContext on user gesture (helps reliability)
        try {
            if (!audioCtxRef.current && (window as any).AudioContext) {
                audioCtxRef.current = new (window as any).AudioContext();
            }
            await audioCtxRef.current?.resume();
        } catch { /* ignore */ }

        // Helper: briefly play audibly (very low volume) to â€œunlockâ€ audio
        const audiblePrime = async (el?: HTMLAudioElement | null) => {
            if (!el) return false;
            const prevVol = el.volume;
            try {
                el.muted = false;      // must be audible
                el.volume = 0.01;      // extremely low, but not zero
                el.currentTime = 0;
                await el.play();
                await new Promise(r => setTimeout(r, 120)); // ~1â€“2 frames is enough
                el.pause();
                el.currentTime = 0;
                return true;
            } catch {
                return false;
            } finally {
                el.volume = prevVol;
            }
        };

        // 1) Do a single audible prime on any available element (prefer main)
        //    This is what actually â€œunlocksâ€ audio on iOS.
        await (audiblePrime(aMain) || audiblePrime(aL) || audiblePrime(aR));

        // 2) Make sure nothing else is still playing
        pauseAllAudios?.();

        // 3) Now play ONLY the relevant track
        const playAudibly = async (el?: HTMLAudioElement | null) => {
            if (!el) return false;
            try {
                el.muted = false;
                el.volume = 1;
                el.currentTime = 0;
                await el.play();
                return true;
            } catch {
                return false;
            }
        };

        if (active === "left") {
            await playAudibly(aL);
        } else if (active === "right") {
            await playAudibly(aR);
        } else if (!mainAudioPlayedOnce) {
            const ok = await playAudibly(aMain);
            ///  if (ok) setMainAudioPlayedOnce?.(true);
        }
    }, [active, mainAudioPlayedOnce, pauseAllAudios, setMainAudioPlayedOnce]);



    return (
        <>
            {/* Hidden AUDIO tags (no loop) */}
            {mainAudioUrl ? (
                IS_IPHONE_OR_SAFARI || !feeds ?
                    <audio ref={mainAudioRef} src={mainAudioUrl} preload="auto"   /* no loop */ />
                    : <audio ref={mainAudioRef} src={mainAudioUrl} preload="auto" muted={MuteReducer}  /* no loop */ />
            ) : null}
            {sub1AudioUrl ? (
                IS_IPHONE_OR_SAFARI || !feeds ?
                    <audio ref={leftAudioRef} src={sub1AudioUrl} preload="auto"  /* no loop */ />
                    : <audio ref={leftAudioRef} src={sub1AudioUrl} preload="auto" muted={MuteReducer} /* no loop */ />
            ) : null}
            {sub2AudioUrl ? (
                IS_IPHONE_OR_SAFARI || !feeds ?
                    <audio ref={rightAudioRef} src={sub2AudioUrl} preload="auto"  /* no loop */ />
                    : <audio ref={rightAudioRef} src={sub2AudioUrl} preload="auto" muted={MuteReducer} /* no loop */ />
            ) : null}

            {/* MAIN */}
            <video
                ref={mainRef}
                src={mainSrc}
                playsInline
                muted={true}
                loop
                autoPlay
                style={{
                    position: "absolute",
                    inset: matchMobile ? -10 : 0,
                    padding: "0px",
                    width: matchMobile ? "105%" : "100%",
                    height: matchMobile ? "105%" : "100%",
                    objectFit: "contain",
                    backgroundColor: "#000",
                    opacity: active ? 0 : 1,
                    transition: "opacity 220ms"
                }}
            />

            {/* SUB LEFT */}
            <video
                ref={leftRef}
                src={subs[0]}
                playsInline
                muted={true}
                preload="auto"
                onClick={active === "left" ? returnToMain : undefined}
                style={{
                    position: "absolute",
                    inset: matchMobile ? -10 : 0,
                    padding: "0px",
                    width: matchMobile ? "105%" : "100%",
                    height: matchMobile ? "105%" : "100%",
                    objectFit: "contain",
                    backgroundColor: "transparent",
                    opacity: active === "left" ? 1 : 0,
                    pointerEvents: active === "left" ? "auto" : "none",
                    transition: "opacity 220ms",
                    cursor: active === "left" ? "pointer" : "default"
                }}
            />

            {/* SUB RIGHT */}
            <video
                ref={rightRef}
                src={subs[1]}
                playsInline
                muted={true}
                preload="auto"
                onClick={active === "right" ? returnToMain : undefined}
                style={{
                    position: "absolute",
                    inset: matchMobile ? -10 : 0,
                    padding: "0px",
                    width: matchMobile ? "105%" : "100%",
                    height: matchMobile ? "105%" : "100%",
                    objectFit: "contain",
                    backgroundColor: "transparent",
                    opacity: active === "right" ? 1 : 0,
                    pointerEvents: active === "right" ? "auto" : "none",
                    transition: "opacity 220ms",
                    cursor: active === "right" ? "pointer" : "default"
                }}
            />

            {/* Speaker button (iOS/policy unlock) */}
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
                        zIndex: 8
                    }}
                >
                    <RecordVoiceOverIcon />
                </button>
            )}

            {/* Hints */}
            {active === null && showHints && (
                <>
                    <CloudHint side="left" />
                    <CloudHint side="right" />
                </>
            )}

            {/* Swipe catcher */}
            {active === null && (
                <div
                    onPointerDownCapture={primeAudioGesture}
                    onTouchStartCapture={primeAudioGesture}
                    style={{ position: "absolute", inset: 0, background: "transparent", zIndex: 6 }}
                >
                    <SwipeLayer
                        onSwipe={(dir) => (dir === "left" ? playSub("left") : playSub("right"))}
                        zIndex={6}
                    />
                </div>
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
                    display: feeds ? "none" : "flex"
                }}
            >
                <ArrowBackIosNewIcon style={{ fontSize: 20 }} />
            </button>

            {/* Publish */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: 12,
                    zIndex: 7,
                    display: feeds ? "none" : "block"
                }}
            >
                <Button
                    variant="contained"
                    fullWidth
                    onClick={onPublish}
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
    );
};

export default SwipePreviewStageUI;
