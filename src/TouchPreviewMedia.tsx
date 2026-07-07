import React, { useEffect, useRef, useState } from "react";
import { matchMobile } from "./DetectDevice";

export const globalBlobCache: Record<string, string> = {};
const CACHE_KEY_ORDER: string[] = [];
const MAX_CACHE_SIZE = 25;

export const clearGlobalBlobCache = () => {
    Object.values(globalBlobCache).forEach(url => {
        if (url !== "pending") URL.revokeObjectURL(url);
    });
    for (const key in globalBlobCache) delete globalBlobCache[key];
    CACHE_KEY_ORDER.length = 0;
};

interface MediaProps {
    mainRef: React.RefObject<HTMLVideoElement>;
    leftSubRef: React.RefObject<HTMLVideoElement>;
    rightSubRef: React.RefObject<HTMLVideoElement>;
    mainAudioRef: React.RefObject<HTMLAudioElement>;
    leftAudioRef: React.RefObject<HTMLAudioElement>;
    rightAudioRef: React.RefObject<HTMLAudioElement>;
    mainSrc: string;
    subs: [string, string];
    mainAudioUrl?: any[] | any;
    sub1AudioUrl?: any[] | any;
    sub2AudioUrl?: any[] | any;
    feeds: any;
    MuteReducer: boolean;
    IS_IPHONE_OR_SAFARI: boolean;
    active: null | "left" | "right";
    mainLoaded: boolean;
    leftLoaded: boolean;
    rightLoaded: boolean;
    setMainLoaded: (v: boolean) => void;
    setLeftLoaded: (v: boolean) => void;
    setRightLoaded: (v: boolean) => void;
    handleMainPointerUp: () => void;
    jumpToPrePause: () => void;
    onExitSubLeft: () => void;
    onExitSubRight: () => void;
    audioEnabled: boolean;
    setAudioEnabled: (v: boolean) => void;
    globalAudioRef: any;
    setIsPreloaded: any;
    isPreloaded: any;
    // ðŸ‘‡ NEW PROPS FOR GLOBAL LOOP
    bgState?: boolean;
    bgSrc?: any;
    isTransitioning?: boolean;
    setIsTransitioning?: (v: boolean) => void;
    snapshotCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

const TouchPreviewMedia: React.FC<MediaProps> = ({
    mainRef, leftSubRef, rightSubRef, mainAudioRef, leftAudioRef, rightAudioRef,
    mainSrc, subs, mainAudioUrl, sub1AudioUrl, sub2AudioUrl, feeds, MuteReducer, IS_IPHONE_OR_SAFARI,
    active, mainLoaded, leftLoaded, rightLoaded, setMainLoaded, setLeftLoaded, setRightLoaded,
    handleMainPointerUp, jumpToPrePause, onExitSubLeft, onExitSubRight, audioEnabled, setAudioEnabled,
    bgState, bgSrc, globalAudioRef, setIsPreloaded, isPreloaded,
    isTransitioning, setIsTransitioning, snapshotCanvasRef
}) => {
    const [showAudioHint, setShowAudioHint] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const primedOnceRef = useRef(false);

    // ðŸ‘‡ Ref for the global background audio
    const bgAudioRef = useRef<HTMLAudioElement>(null);

    const getAudioSrc = (val: any) => (Array.isArray(val) ? val[0] || null : val || null);
    const mainAudioSrc = getAudioSrc(mainAudioUrl);
    const leftAudioSrc = getAudioSrc(sub1AudioUrl);
    const rightAudioSrc = getAudioSrc(sub2AudioUrl);

    const forceLoadVideo = (v?: HTMLVideoElement | null) => { if (!v) return; try { v.preload = "auto"; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); v.load(); } catch { } };

    const primeDecodeVideo = async (v?: HTMLVideoElement | null) => {
        if (!v) return;
        try {
            const prevMuted = v.muted; v.muted = true; v.setAttribute("muted", ""); v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
            try { v.load(); } catch { }
            const p = v.play(); if (p && typeof (p as any).then === "function") { await p; }
            try { v.pause(); } catch { } try { v.currentTime = 0; } catch { } v.muted = prevMuted;
        } catch { }
    };



    // 1ï¸âƒ£ Refs to hold data (So we don't need them in useEffect dependencies)
    const dataRef = useRef({ subs, mainAudioUrl, sub1AudioUrl, sub2AudioUrl });

    // Update refs on render (Does not trigger effects)
    dataRef.current = { subs, mainAudioUrl, sub1AudioUrl, sub2AudioUrl };

    // 2ï¸âƒ£ The Loop-Proof Effect
    // --- RAM BLOB CACHE STATE ---
    const [blobTick, setBlobTick] = useState(0);

    useEffect(() => {
        // ðŸ›‘ MASTER GUARD: If already done, NEVER RUN.
        if (isPreloaded) return;

        // Helper
        const preloadToRAM = async (url: any) => {
            if (!url) return;
            const urlStr = String(url);
            if (globalBlobCache[urlStr]) return; // already pending or cached

            try {
                globalBlobCache[urlStr] = "pending";
                const response = await fetch(urlStr);
                const blob = await response.blob();
                const localUrl = URL.createObjectURL(blob);
                globalBlobCache[urlStr] = localUrl;

                CACHE_KEY_ORDER.push(urlStr);
                if (CACHE_KEY_ORDER.length > MAX_CACHE_SIZE) {
                    const oldestKey = CACHE_KEY_ORDER.shift();
                    if (oldestKey && globalBlobCache[oldestKey] && globalBlobCache[oldestKey] !== "pending") {
                        URL.revokeObjectURL(globalBlobCache[oldestKey]);
                        delete globalBlobCache[oldestKey];
                    }
                }

                setBlobTick(t => t + 1); // trigger re-render to apply the blob url
            } catch (e) {
                delete globalBlobCache[urlStr]; // revert on fail
            }
        };

        const timer = setTimeout(() => {
            // Read from REF (Stable) instead of props (Unstable)
            const { subs, mainAudioUrl, sub1AudioUrl, sub2AudioUrl } = dataRef.current;

            // 1. Download Video 1 & 2 into RAM
            if (subs && subs[0]) preloadToRAM(subs[0]);
            if (subs && subs[1]) preloadToRAM(subs[1]);

            // 2. Download Audio into RAM
            const process = (val: any) => {
                if (Array.isArray(val)) val.forEach(v => preloadToRAM(v));
                else if (val) preloadToRAM(val);
            };
            process(mainAudioUrl);
            process(sub1AudioUrl);
            process(sub2AudioUrl);

            // 3. âœ… FLIP SWITCH
            setIsPreloaded((prev: any) => {
                if (prev === true) return prev;
                return true;
            });

        }, 200);

        return () => clearTimeout(timer);

        // ðŸ›‘ DEPENDENCY ARRAY IS EMPTY (or just set/isPreloaded state)
        // We intentionally OMIT 'subs' and 'audioUrl' to prevent the loop.
    }, [isPreloaded, setIsPreloaded]);

    const primeAllMediaOnce = () => {
        if (primedOnceRef.current) return;
        primedOnceRef.current = true;

        const l = leftSubRef.current;
        const r = rightSubRef.current;

        // 1. OPTIMIZED Video Priming
        // Only force load if we don't have data yet (readyState < 3)
        const smartPrime = (v: any) => {
            if (!v) return;
            if (v.readyState < 3) {
                forceLoadVideo(v);
                primeDecodeVideo(v);
            } else {
                // Video is already ready! Just mute/ensure settings.
                v.muted = true;
            }
        };

        smartPrime(l);
        smartPrime(r);

        // 2. Prime Standard Audios (Keep as is, lightweight)
        try { mainAudioRef.current?.load?.(); } catch { }
        try { leftAudioRef.current?.load?.(); } catch { }
        try { rightAudioRef.current?.load?.(); } catch { }

        // We don't need to load bgAudio if we are about to play globalAudio below
        // try { bgAudioRef.current?.load?.(); } catch { }

        // 3. âœ… HANDLE GLOBAL AUDIO (Your working Fix)
        try {
            if (bgState) {
                if (globalAudioRef?.current) {




                    const global = globalAudioRef.current;
                    global.muted = false;
                    global.volume = 1.0;

                    const playPromise = global.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            // Logic: Keep playing if bgState is true, else pause.

                            console.log("Global Audio started successfully.");

                        }).catch((error: any) => {
                            console.log("Global Audio Autoplay blocked:", error);
                        });
                    }
                }

            }

            setIsPreloaded(true);
        } catch (e) { console.log(e); }
    };

    useEffect(() => {
        const v = mainRef.current; if (!v) return;
        v.playsInline = true; v.autoplay = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); v.muted = true; v.setAttribute("muted", "");
        try { v.load(); } catch { } v.play().catch(() => { });
    }, [mainRef.current, mainSrc]);

    useEffect(() => {
        const l = leftSubRef.current; const r = rightSubRef.current;
        forceLoadVideo(l); forceLoadVideo(r);
        try { mainAudioRef.current?.load?.(); } catch { } try { leftAudioRef.current?.load?.(); } catch { } try { rightAudioRef.current?.load?.(); } catch { }
    }, [subs?.[0], subs?.[1], mainAudioSrc, leftAudioSrc, rightAudioSrc]);

    // âœ… UNIFIED AUDIO LOGIC
    useEffect(() => {
        const video = mainRef.current; const audio = mainAudioRef.current;
        const attemptUnmuteAndPlay = async () => {
            if (IS_IPHONE_OR_SAFARI) { if (video) video.muted = true; setAudioEnabled(true); setShowAudioHint(false); return; }
            const effectiveMute = MuteReducer;
            if (effectiveMute) {
                if (video) video.muted = true; if (audio) audio.muted = true; setShowAudioHint(false); setAudioEnabled(false); return;
            }
            try {
                // âœ… FIX: Strictly check that mainAudioSrc is a STRING to avoid "Array(0)" truthy issues
                if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && audio) {
                    audio.muted = false; await audio.play(); setAudioEnabled(true);
                    // âœ… FIX: Explicitly play video so it triggers 'onPlay' and becomes visible (opacity 1)
                    // Otherwise it might sit paused (invisible) while audio plays.
                    if (video) {
                        video.muted = true; // Ensure video track is silent
                        if (video.paused) video.play().catch(() => { });
                        setMainLoaded(true); // âœ… FIX: Force visibility (opacity 1) immediately
                    }
                }
                else if (video) {
                    video.muted = false; await video.play(); setAudioEnabled(true);
                }
                setShowAudioHint(false);
            } catch (err) {
                setShowAudioHint(true);
            }
        };
        if (mainLoaded) { attemptUnmuteAndPlay(); }
    }, [mainLoaded, mainAudioSrc, MuteReducer, IS_IPHONE_OR_SAFARI, setAudioEnabled, mainRef, mainAudioRef]);

    // âœ… FIX: "Kickstarter" to break Deadlock.
    // If autoPlay fails (common), mainLoaded stays false, and attemptUnmuteAndPlay NEVER runs.
    // This forces the video to wake up if we have external audio.
    useEffect(() => {
        if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && !mainLoaded && mainRef.current) {
            const v = mainRef.current;
            v.muted = true; // Safety
            v.play().catch(() => { });
            setMainLoaded(true); // Force the state to unblock other logic
        }
    }, [mainAudioSrc, mainLoaded]);

    const handleDoubleTap = () => {
        primeAllMediaOnce(); jumpToPrePause();
        const video = mainRef.current; const audio = mainAudioRef.current;
        if (mainAudioSrc && audio) { audio.muted = false; audio.play().then(() => { setShowAudioHint(false); setAudioEnabled(true); }).catch(console.error); }
        else if (video) { video.muted = false; video.play().then(() => { setShowAudioHint(false); setAudioEnabled(true); }).catch(console.error); }
    };

    // âœ… CONTINUOUS AUDIO LOGIC (UPDATED WITH GLOBAL KILL SWITCH)
    useEffect(() => {

        // ðŸ›‘ 1. GLOBAL KILL SWITCH LOGIC
        if (bgState) {
            // Allow video audio to play even if BG is present (User Request)
            // We do NOT return here anymore, detecting "Silence" was likely due to this block blocking normal audio logic.

            // Just ensure sub audios are paused if returning to main
            // try { mainAudioRef.current?.pause(); } catch { }
        }

        // ðŸ‘‡ 2. NORMAL LOGIC (Resume standard behavior)
        // Ensure BG audio is stopped when not in BG mode
        try { bgAudioRef.current?.pause(); } catch { }

        // --- ORIGINAL LOGIC BELOW ---
        const pauseSubAudios = () => {
            try { leftAudioRef.current?.pause(); } catch { }
            try { rightAudioRef.current?.pause(); } catch { }
        };

        if (active === null) {
            // Returning to Main
            pauseSubAudios(); // Must stop sub audios

            // âœ… FIX: Strict check for string to avoid Array(0) muting the video logic
            if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && mainAudioRef.current) {
                // If main has audio file, ensure it plays
                mainAudioRef.current.play().catch(() => { });
                // Mute main video to avoid double audio
                if (mainRef.current) mainRef.current.muted = true;
            } else if (mainRef.current) {
                // If no main audio file, play video audio
                mainRef.current.muted = false;
            }
        }
        else if (active === "left") {
            // âœ… FIX: Strict check for leftAudioSrc
            if (leftAudioSrc && typeof leftAudioSrc === 'string' && leftAudioSrc.length > 0 && leftAudioRef.current) {
                // Has File: Play file, Pause Main
                try { mainAudioRef.current?.pause(); } catch { }
                leftAudioRef.current.currentTime = 0;
                leftAudioRef.current.play().catch(() => { });
                if (leftSubRef.current) {
                    leftSubRef.current.muted = true;
                    // âœ… FIX: Force Play + Visibility for Sub-Scene
                    if (leftSubRef.current.paused) leftSubRef.current.play().catch(() => { });
                    setLeftLoaded(true);
                }
            } else {
                // No File: Check Main
                // âœ… FIX: Strict check for mainAudioSrc string
                if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && mainAudioRef.current && !mainAudioRef.current.paused) {
                    // Main is playing? KEEP PLAYING. Mute sub video.
                    if (leftSubRef.current) leftSubRef.current.muted = true;
                } else {
                    // No Main playing? Unmute sub video.
                    if (leftSubRef.current) leftSubRef.current.muted = false;
                }
                // âœ… FIX: Force Play + Visibility for Sub-Scene (Fallback Case)
                if (leftSubRef.current) {
                    if (leftSubRef.current.paused) leftSubRef.current.play().catch(() => { });
                    setLeftLoaded(true);
                }
            }
        }
        else if (active === "right") {
            // âœ… FIX: Strict check for rightAudioSrc
            if (rightAudioSrc && typeof rightAudioSrc === 'string' && rightAudioSrc.length > 0 && rightAudioRef.current) {
                try { mainAudioRef.current?.pause(); } catch { }
                rightAudioRef.current.currentTime = 0;
                rightAudioRef.current.play().catch(() => { });
                if (rightSubRef.current) {
                    rightSubRef.current.muted = true;
                    // âœ… FIX: Force Play + Visibility for Sub-Scene
                    if (rightSubRef.current.paused) rightSubRef.current.play().catch(() => { });
                    setRightLoaded(true);
                }
            } else {
                // âœ… FIX: Strict check for mainAudioSrc string
                if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && mainAudioRef.current && !mainAudioRef.current.paused) {
                    if (rightSubRef.current) rightSubRef.current.muted = true;
                } else {
                    if (rightSubRef.current) rightSubRef.current.muted = false;
                }
                // âœ… FIX: Force Play + Visibility for Sub-Scene (Fallback Case)
                if (rightSubRef.current) {
                    if (rightSubRef.current.paused) rightSubRef.current.play().catch(() => { });
                    setRightLoaded(true);
                }
            }
        }

        // ðŸ›‘ GLOBAL MUTE ENFORCEMENT
        if (MuteReducer) {
            if (mainRef.current) mainRef.current.muted = true;
            if (leftSubRef.current) leftSubRef.current.muted = true;
            if (rightSubRef.current) rightSubRef.current.muted = true;
        }

    }, [active, mainAudioSrc, leftAudioSrc, rightAudioSrc, bgState, audioEnabled, MuteReducer]); // ðŸ‘ˆ Added MuteReducer to deps

    const getSrc = (url: any) => {
        if (!url) return undefined;
        const cached = globalBlobCache[String(url)];
        return (cached && cached !== "pending") ? cached : String(url);
    };

    return (
        <>
            {/* ðŸ‘‡ GLOBAL LOOP AUDIO ELEMENT */}


            {bgState ? null : mainAudioSrc ? <audio ref={mainAudioRef} src={getSrc(mainAudioSrc)} preload="auto" muted={MuteReducer} /> : null}
            {bgState ? null : leftAudioSrc ? <audio ref={leftAudioRef} src={getSrc(leftAudioSrc)} preload="auto" muted={MuteReducer} /> : null}
            {bgState ? null : rightAudioSrc ? <audio ref={rightAudioRef} src={getSrc(rightAudioSrc)} preload="auto" muted={MuteReducer} /> : null}

            <video ref={mainRef} src={getSrc(mainSrc)} preload="auto" playsInline autoPlay
                onTimeUpdate={() => { if (!mainLoaded) setMainLoaded(true); }}
                onPlay={() => { setMainLoaded(true); setIsBuffering(false); setIsTransitioning?.(false); }}
                onPlaying={() => { setIsBuffering(false); setIsTransitioning?.(false); }}
                onWaiting={() => setIsBuffering(true)}
                onLoadStart={() => setIsBuffering(true)}
                onLoadedData={() => setMainLoaded(true)}
                onCanPlay={() => setMainLoaded(true)}
                onDoubleClick={handleDoubleTap} onClick={primeAllMediaOnce}
                onPointerUp={() => { primeAllMediaOnce(); if (IS_IPHONE_OR_SAFARI) { handleMainPointerUp() } else { if (!MuteReducer && audioEnabled) { handleMainPointerUp() } else { jumpToPrePause(); handleMainPointerUp() } } }}
                style={{
                    position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%",
                    objectFit: "contain", objectPosition: matchMobile ? "top center" : "center", backgroundColor: "transparent",
                    opacity: mainLoaded ? (active ? 0 : 1) : 0,
                    filter: isTransitioning || isBuffering ? "grayscale(100%)" : "grayscale(0%)",
                    transition: "opacity 320ms cubic-bezier(.22,1,.36,1), filter 500ms ease",
                    willChange: "opacity, filter", backfaceVisibility: "hidden", touchAction: "manipulation",
                }} />

            <video ref={leftSubRef} src={getSrc(subs[0])} playsInline preload="auto" onLoadedData={() => setLeftLoaded(true)}
                style={{ position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%", objectFit: "contain", objectPosition: matchMobile ? "top center" : "center", backgroundColor: "transparent", opacity: active === "left" ? (leftLoaded ? 1 : 0) : 0, pointerEvents: active === "left" ? "auto" : "none", transition: "opacity 260ms cubic-bezier(.22,1,.36,1)", willChange: "opacity", backfaceVisibility: "hidden", cursor: active === "left" ? "pointer" : "default", }}
                onClick={() => { if (active === "left") onExitSubLeft(); }} />

            <video ref={rightSubRef} src={getSrc(subs[1])} playsInline preload="auto" onLoadedData={() => setRightLoaded(true)}
                style={{ position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%", objectFit: "contain", objectPosition: matchMobile ? "top center" : "center", backgroundColor: "transparent", opacity: active === "right" ? (rightLoaded ? 1 : 0) : 0, pointerEvents: active === "right" ? "auto" : "none", transition: "opacity 260ms cubic-bezier(.22,1,.36,1)", willChange: "opacity", backfaceVisibility: "hidden", cursor: active === "right" ? "pointer" : "default", }}
                onClick={() => { if (active === "right") onExitSubRight(); }} />
        </>
    );
};

export default TouchPreviewMedia;
