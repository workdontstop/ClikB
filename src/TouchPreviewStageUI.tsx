import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { RootState } from "./store";
import { useSelector, useDispatch } from "react-redux";
import { activateFullscreenMute, deactivateFullscreenMute, initFirstImpression, incrementFirstImpression } from "./settingsSlice";
import TouchPreviewMedia, { clearGlobalBlobCache } from "./TouchPreviewMedia";
import TouchPreviewOverlay from "./TouchPreviewOverlay";
import { matchMobile } from "./DetectDevice";

const LENS_ZOOM = 1.1;

export interface Hotspot {
    id: "left" | "right";
    x: number;
    y: number;
    r: number;
    polygon?: [number, number][]; // Optional SAM shape array
    boundingBox?: { w: number, h: number }; // Optional SAM dimensions
    svgPath?: string;
    maskWidth?: number;
    maskHeight?: number;
    customText?: string;
    isVictory?: boolean;
}

export interface InteractionNode {
    id: string;
    mainSrc: string;
    subs: [string, string];
    hotspots: [Hotspot, Hotspot];
    // âœ… Updated to expect Arrays
    audio?: { main?: any[]; left?: any[]; right?: any[]; };
    autoPlaySrc?: string;
    autoPlayIsVictory?: boolean;
    children?: { left?: InteractionNode; right?: InteractionNode; autoPlay?: InteractionNode; };
}

interface Props {
    backToEdit: () => void;
    mainSrc: string;
    subs: [string, string];
    hotspots: [Hotspot, Hotspot];
    stage: any;
    onPublish: any;
    feeds: any;
    // âœ… Updated inputs to accept arrays or single values (normalized in useMemo)
    mainAudioUrl?: any[] | any;
    sub1AudioUrl?: any[] | any;
    sub2AudioUrl?: any[] | any;
    nestedTree?: InteractionNode;
    setActiveStory?: any;
    feedDataMainAud?: any;
    intbg?: any;
    isPreloaded: any;
    setIsPreloaded: any;
    videoArray?: any[];
    goodOutcomes?: string[];
    setGoodOutcomes?: (v: string[]) => void;
    interactionPostId?: string | number | null;
}

function getDisplayedVideoRect(containerEl: HTMLElement, videoEl: HTMLVideoElement) {
    const rect = containerEl.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const vw = videoEl.videoWidth || 0;
    const vh = videoEl.videoHeight || 0;
    if (!vw || !vh) return { dispW: cw, dispH: ch, offX: 0, offY: 0, cw, ch, vw, vh };
    const videoAR = vw / vh;
    const containerAR = cw / ch;
    let dispW, dispH, offX = 0, offY = 0;
    if (containerAR > videoAR) { dispH = ch; dispW = ch * videoAR; offX = (cw - dispW) / 2; }
    else { dispW = cw; dispH = cw / videoAR; offY = matchMobile ? 0 : (ch - dispH) / 2; }

    // âœ… FIX: Calculate offset of Video Element relative to Container (e.g. -10px inset)
    // We must measure the VIDEO element, not the container loopback.
    const vRect = videoEl.getBoundingClientRect();
    const cRect = containerEl.getBoundingClientRect();
    const elOffX = vRect.left - cRect.left;
    const elOffY = vRect.top - cRect.top;

    return { dispW, dispH, offX, offY, cw, ch, vw, vh, elOffX, elOffY };
}

const TouchPreviewStageUI: React.FC<Props> = (props) => {
    // --- STATE ---
    const [nodeStack, setNodeStack] = useState<InteractionNode[]>([]);
    const activeNode = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : null;

    useEffect(() => {
        console.log("ðŸ’¾ [Database Fetch] Raw nestedTree from DB:", props.nestedTree);
    }, [props.nestedTree]);


    const [isTransitioning, setIsTransitioning] = useState(false);
    const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // âœ… Helpers to normalize inputs to arrays
    const toArray = (val: any) => Array.isArray(val) ? val : (val ? [val] : []);

    const rootNode: InteractionNode = useMemo(() => props.nestedTree || {
        id: "root",
        mainSrc: props.mainSrc,
        subs: props.subs,
        hotspots: props.hotspots,
        // âœ… Normalize props to arrays for the root node
        audio: {
            main: toArray(props.mainAudioUrl),
            left: toArray(props.sub1AudioUrl),
            right: toArray(props.sub2AudioUrl)
        }
    }, [props.nestedTree, props.mainSrc, props.subs, props.hotspots, props.mainAudioUrl, props.sub1AudioUrl, props.sub2AudioUrl]);

    const currentNode = activeNode || rootNode;
    const isMaxDepth = nodeStack.length >= 7;

    const currentId = currentNode.id;
    const mainSrc = currentNode.mainSrc;
    const subs = currentNode.subs;
    const hotspots = currentNode.hotspots;

    // âœ… These are now Arrays
    const mainAudioUrl = currentNode.audio?.main || [];
    const sub1AudioUrl = currentNode.audio?.left || [];
    const sub2AudioUrl = currentNode.audio?.right || [];

    // --- REFS ---
    const mainRef = useRef<HTMLVideoElement | null>(null);
    const leftSubRef = useRef<HTMLVideoElement | null>(null);
    const rightSubRef = useRef<HTMLVideoElement | null>(null);
    const leftLensVidRef = useRef<HTMLVideoElement | null>(null);
    const rightLensVidRef = useRef<HTMLVideoElement | null>(null);
    const mainAudioRef = useRef<HTMLAudioElement | null>(null);
    const leftAudioRef = useRef<HTMLAudioElement | null>(null);
    const rightAudioRef = useRef<HTMLAudioElement | null>(null);

    const [active, setActive] = useState<null | "left" | "right">(null);
    const [subEnded, setSubEnded] = useState(false);
    const [showHotspots, setShowHotspots] = useState(false);
    const [isAutoPlayTimerActive, setIsAutoPlayTimerActive] = useState(false);

    const CHOICE_WINDOW_MS = 5500;
    const rafIdRef = useRef<number | null>(null);
    const windowTimerRef = useRef<number | null>(null);
    const lastTapRef = useRef<number>(0);

    // Track strict showing state to avoid race conditions
    const isShowingRef = useRef(false);

    const loopsRef = useRef(0);
    const stoppedAfterTwoRef = useRef(false);
    const manualRestartingRef = useRef(false);
    const suppressEndHooksRef = useRef(false);
    const nearEndArmedRef = useRef(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const MuteReducer = useSelector((state: RootState) => state.settings.fullscreenMute);
    const dispatch = useDispatch();
    const toggleMute = useCallback(() => {
        if (MuteReducer) dispatch(deactivateFullscreenMute());
        else dispatch(activateFullscreenMute());
    }, [MuteReducer, dispatch]);
    const [mainLoaded, setMainLoaded] = useState(false);
    const [leftLoaded, setLeftLoaded] = useState(false);
    const [rightLoaded, setRightLoaded] = useState(false);
    const [layoutVersion, setLayoutVersion] = useState(0);

    // --- RAM BLOB CACHE CLEANUP ---
    useEffect(() => {
        return () => {
            clearGlobalBlobCache();
        };
    }, []);

    // --- VICTORY MODE STATE ---
    // Extract filename for robust matching, ignoring domains/tokens/protocols
    const getFilename = (url: string) => {
        if (typeof url !== 'string') return String(url);
        const base = url.split('?')[0].trim();
        const parts = base.split('/');
        return parts[parts.length - 1];
    };

    const validOutcomes = (props.goodOutcomes || [])
        .filter(v => Boolean(v) && v !== "" && v !== "null" && v !== "undefined" && v !== "[]")
        .map(getFilename);

    const currentSrcFilename = getFilename(currentNode.mainSrc);

    let isGoodOutcome = validOutcomes.length === 0;

    if (!isGoodOutcome) {
        if (validOutcomes.includes(currentSrcFilename)) {
            isGoodOutcome = true;
        } else if (props.videoArray && props.videoArray.length > 0) {
            // Map Blob URL to its corresponding Cloud URL based on EXACT tree depth/id
            let cloudUrl = null;
            if (nodeStack.length === 1 && currentNode.id === "root") cloudUrl = props.videoArray[0];
            else if (nodeStack.length === 2 && currentNode.id === "root-left") cloudUrl = props.videoArray[1];
            else if (nodeStack.length === 2 && currentNode.id === "root-right") cloudUrl = props.videoArray[2];

            if (cloudUrl && validOutcomes.includes(getFilename(cloudUrl as string))) {
                isGoodOutcome = true;
            }
        }
    }
    const hasLeftChild = !!(currentNode.children?.left && currentNode.children.left.mainSrc !== "");
    const hasRightChild = !!(currentNode.children?.right && currentNode.children.right.mainSrc !== "");
    const hasAutoPlayChild = !!(currentNode.children?.autoPlay && currentNode.children.autoPlay.mainSrc !== "");
    const hasAnyChild = hasLeftChild || hasRightChild || hasAutoPlayChild;
    const isLeaf = nodeStack.length > 1 && !hasAnyChild;
    // Check if the current node is a victory scene
    const isCurrentNodeVictory = useMemo(() => {
        if (nodeStack.length < 2) return false;
        const parentNode = nodeStack[nodeStack.length - 2];
        const current = nodeStack[nodeStack.length - 1];
        if (current.mainSrc === parentNode.subs[0]) {
            return parentNode.hotspots[0].isVictory || false;
        } else if (current.mainSrc === parentNode.subs[1]) {
            return parentNode.hotspots[1].isVictory || false;
        } else if (parentNode.autoPlaySrc && current.mainSrc === parentNode.autoPlaySrc) {
            return parentNode.autoPlayIsVictory || false;
        }
        return false;
    }, [nodeStack]);

    // ðŸ† FIRST IMPRESSIONS LOGIC
    useEffect(() => {
        if (props.interactionPostId) {
            dispatch(initFirstImpression(String(props.interactionPostId)));
        }
    }, [props.interactionPostId, dispatch]);

    useEffect(() => {
        console.log("ðŸ† FirstImpressions Check ->", {
            nodeId: currentNode.id,
            isLeaf,
            hasLeftChild,
            hasRightChild,
            hasAutoPlayChild,
            isCurrentNodeVictory,
            interactionPostId: props.interactionPostId,
            childrenObj: currentNode.children,
            mainSrc: currentNode.mainSrc
        });

        if (isLeaf && !isCurrentNodeVictory && props.interactionPostId) {
            console.log("ðŸš¨ DETECTOR TRIGGERED: Failed leaf node reached. Incrementing trials for post:", props.interactionPostId);
            dispatch(incrementFirstImpression(String(props.interactionPostId)));
        } else if (isLeaf) {
            console.log("â„¹ï¸ Detector skipped despite being a leaf. Reason:",
                isCurrentNodeVictory ? "Is Victory Node" :
                !props.interactionPostId ? "props.interactionPostId is falsy" : "Unknown"
            );
        }
    }, [isLeaf, isCurrentNodeVictory, props.interactionPostId, dispatch, hasLeftChild, hasRightChild, hasAutoPlayChild, currentNode]);

    // --- Overlay / Touch Handlers ---
    const isBacktrackingRef = useRef(false);
    const backtrackTimerRef = useRef<NodeJS.Timeout | null>(null);

    // --- CLEANUP BACKTRACK TIMER ON NODE CHANGE ---
    useEffect(() => {
        return () => {
            if (backtrackTimerRef.current) {
                clearTimeout(backtrackTimerRef.current);
                backtrackTimerRef.current = null;
            }
            isBacktrackingRef.current = false;
        };
    }, [currentId]);

    // --- FIRST IMPRESSION STATE ---
    const [firstImpression, setFirstImpression] = useState<string | null>(null);

    useEffect(() => {
        if (isLeaf && !firstImpression) {
            setFirstImpression(currentNode.mainSrc);
        }
    }, [isLeaf, firstImpression, currentNode.mainSrc]);

    const showFirstImpressionPill = validOutcomes.length > 0 && isLeaf && isGoodOutcome && firstImpression === currentNode.mainSrc;

    const goHome = useCallback(() => {
        const sourceVideo = active === "left" ? leftSubRef.current : active === "right" ? rightSubRef.current : mainRef.current;
        if (sourceVideo && snapshotCanvasRef.current) {
            const canvas = snapshotCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx && sourceVideo.videoWidth && sourceVideo.videoHeight) {
                canvas.width = sourceVideo.videoWidth;
                canvas.height = sourceVideo.videoHeight;
                ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
                setIsTransitioning(true);
            }
        }
        setNodeStack([props.nestedTree || {
            id: "root", mainSrc: props.mainSrc, subs: props.subs, hotspots: props.hotspots,
            audio: { main: Array.isArray(props.mainAudioUrl) ? props.mainAudioUrl : [props.mainAudioUrl], left: Array.isArray(props.sub1AudioUrl) ? props.sub1AudioUrl : [props.sub1AudioUrl], right: Array.isArray(props.sub2AudioUrl) ? props.sub2AudioUrl : [props.sub2AudioUrl] },
            children: {}
        }]);
    }, [props.nestedTree, props.mainSrc, props.subs, props.hotspots, props.mainAudioUrl, props.sub1AudioUrl, props.sub2AudioUrl, active, setIsTransitioning]);

    // --- GEOMETRY ---
    const leftLensPrimedRef = useRef(false);
    const rightLensPrimedRef = useRef(false);
    const bgPrimeTimerRef = useRef<number | null>(null);
    const geomRef = useRef<any>(null);


    const [isBgMode, setIsBgMode] = useState(true);

    // --- HUD Auto-Hide Logic ---
    const [isHUDHidden, setIsHUDHidden] = useState(false);
    const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const hideHUDTemporarily = useCallback(() => {
        setIsHUDHidden(true);
        if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
        hudTimeoutRef.current = setTimeout(() => {
            setIsHUDHidden(false);
        }, 1000);
    }, []);

    // 1ï¸âƒ£ Create Ref for the global audio
    const globalAudioRef = useRef<HTMLAudioElement>(null);    // 2ï¸âƒ£ Decide what URL to loop (Use prop or fallback to mainSrc)
    // Note: If you want it to be truly continuous, pick one static URL.
    // If you use props.mainAudioUrl, it might change per node.
    // Ideally, define a const or use the root node's audio.
    const GLOBAL_BG_SRC = props.feedDataMainAud;




    const IS_IPHONE_OR_SAFARI = (() => {
        const ua = navigator.userAgent || ""; const vendor = navigator.vendor || "";
        const isIPhone = /iPhone|iPod/i.test(ua);
        return isIPhone || (/Safari/i.test(ua) && /Apple/i.test(vendor) && !/(CriOS|Chrome|Edg|OPR|Opera|FxiOS|Firefox)/i.test(ua));
    })();

    // âœ… Check array length for logic (ROBUST CHECK for ALL sources)
    const checkAudio = (url: any) => Array.isArray(url)
        ? (typeof url[0] === 'string' && url[0].length > 0)
        : (typeof url === 'string' && url.length > 0);

    const hasMainSnippet = checkAudio(mainAudioUrl);
    const hasLeftSnippet = checkAudio(sub1AudioUrl);
    const hasRightSnippet = checkAudio(sub2AudioUrl);

    const wantsAnyVideoAudio = !hasMainSnippet || !hasLeftSnippet || !hasRightSnippet;

    // --- UTILS ---
    const handleBack = useCallback(() => {
        if (nodeStack.length > 0) {
            const sourceVideo = active === "left" ? leftSubRef.current : active === "right" ? rightSubRef.current : mainRef.current;
            if (sourceVideo && snapshotCanvasRef.current) {
                const canvas = snapshotCanvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && sourceVideo.videoWidth && sourceVideo.videoHeight) {
                    canvas.width = sourceVideo.videoWidth;
                    canvas.height = sourceVideo.videoHeight;
                    ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
                    setIsTransitioning(true);
                }
            }
            setNodeStack(prev => {
                const next = [...prev];
                next.pop();
                return next;
            });
        } else {
            props.backToEdit();
        }
    }, [nodeStack, props.backToEdit, active, setIsTransitioning]);

    const tryPlay = useCallback(async (el?: HTMLMediaElement | null) => {
        if (!el) return false; try { await el.play(); return true; } catch { return false; }
    }, []);

    const pauseAllAudios = useCallback(() => {
        [mainAudioRef.current, leftAudioRef.current, rightAudioRef.current].forEach((a) => { try { a?.pause(); } catch { } });
    }, []);

    const muteVideo = (el: HTMLVideoElement | null | undefined, muted: boolean) => {
        if (!el) return; try { el.muted = muted; if (!muted) el.volume = 1; } catch { }
    };

    const NEAR_END_DELTA = 0.08;
    const END_EPS = 0.01;

    function playableEnd(v: HTMLVideoElement): number {
        const d = Number.isFinite(v.duration) ? v.duration : 0; if (d > 0) return d;
        const len = v.seekable?.length ?? 0; return len > 0 ? v.seekable.end(len - 1) : 0;
    }

    const hsById = useMemo(() => ({ left: hotspots[0], right: hotspots[1] }) as Record<"left" | "right", Hotspot>, [hotspots]);

    // --- EFFECTS ---

    // 1. Reset State on Navigation & Play Entrance Audio
    useEffect(() => {
        setShowHotspots(false);
        isShowingRef.current = false;
        setActive(null);
        // âœ… FIX: Reset loaded states so Media component knows to wait
        setMainLoaded(false);
        setLeftLoaded(false);
        setRightLoaded(false);

        if (windowTimerRef.current) { clearTimeout(windowTimerRef.current); windowTimerRef.current = null; }

        // âœ… NEW: Auto-play Main Audio on Entrance (Just Once)
        // This ensures nested mains play their audio immediately upon entry
        const playEntranceAudio = async () => {
            const ma = mainAudioRef.current;
            const mv = mainRef.current;

            // Stop any lingering audio
            pauseAllAudios();

            if (audioEnabled) {
                if (hasMainSnippet && ma) {
                    ma.currentTime = 0;
                    // Mute video so we hear the audio track
                    if (mv) muteVideo(mv, true);
                    await tryPlay(ma);
                } else if (mv) {
                    // No audio track, play video sound
                    muteVideo(mv, false);
                    await tryPlay(mv); // âœ… Force play in case it was paused
                }
            }
        };

        // Small timeout to ensure DOM is ready and previous state cleared
        const t = setTimeout(playEntranceAudio, 50);
        return () => clearTimeout(t);

    }, [currentId, audioEnabled, hasMainSnippet, pauseAllAudios, tryPlay]);

    // 2. Audio Watchdog (Self-Healing)
    useEffect(() => {
        const interval = setInterval(() => {
            // Only run if we expect Main Audio to be playing
            if (active === null && !showHotspots && audioEnabled && !isBgMode) {
                const mv = mainRef.current;
                const ma = mainAudioRef.current;

                // Case A: Main Audio File exists
                if (hasMainSnippet && ma) {
                    if (ma.paused) ma.play().catch(() => { });
                    if (mv && !mv.muted) mv.muted = true; // Ensure visual video is muted
                }
                // Case B: Video Audio (No separate file)
                else if (mv) {
                    if (mv.muted) mv.muted = false; // Force unmute
                    if (mv.paused) mv.play().catch(() => { }); // Force play
                }
            }
        }, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, [active, showHotspots, audioEnabled, isBgMode, hasMainSnippet]);

    // 3. Geometry Only (REMOVED AGGRESSIVE PRELOAD TO FIX DOUBLE-PLAY)
    useEffect(() => {
        const bump = () => setLayoutVersion((v) => v + 1);
        window.addEventListener("resize", bump);
        const m = mainRef.current;

        const retryInt = setInterval(bump, 200);
        setTimeout(() => clearInterval(retryInt), 1200);

        // ðŸ›‘ REMOVED THE CONFLICTING PRELOAD LOOP HERE
        // The child component TouchPreviewMedia now handles loading perfectly.
        // The old code that was here (el.load()...) caused the "Double Play" glitch.

        m?.addEventListener("loadedmetadata", bump);
        return () => {
            window.removeEventListener("resize", bump);
            m?.removeEventListener("loadedmetadata", bump);
            clearInterval(retryInt);
        };
    }, [currentId]);


    const recomputeGeom = useCallback(() => {
        const main = mainRef.current; const container = main?.parentElement as HTMLElement | null;
        if (!main || !container) { geomRef.current = null; return; }
        const { dispW, dispH, offX, offY, cw, ch } = getDisplayedVideoRect(container, main);
        const clampPx = Math.min(Math.max(0.08 * window.innerWidth, 56), 88);
        const mk = (hs: Hotspot) => {
            const lensDiamPx = Math.max(hs.r * cw, clampPx) * (matchMobile ? 1.65 : 1.3);
            // âœ… FIX: Use displayed video rect (dispW/H + offsets) to account for black bars
            const centerX = offX + (hs.x * dispW);
            const centerY = offY + (hs.y * dispH);
            return { centerX, centerY, lensDiamPx };
        };
        geomRef.current = { dispW, dispH, offX, offY, cw, ch, left: mk(hsById.left), right: mk(hsById.right) };
    }, [hsById]);

    useEffect(() => { recomputeGeom(); }, [recomputeGeom, layoutVersion]);

    // 3. Sync Lens Time
    const syncLensSrcAndTime = useCallback((lens: HTMLVideoElement | null) => {
        const main = mainRef.current; if (!lens || !main) return;
        const mainSrc = (main as any).src || main.currentSrc || "";
        if (mainSrc && lens.src !== mainSrc) lens.src = mainSrc;
        lens.muted = true; lens.playsInline = true; (lens as any).preload = "auto";
        const applyTime = () => { try { lens.currentTime = main.currentTime; } catch { } };
        if (lens.readyState >= 1) applyTime(); else lens.addEventListener("loadedmetadata", applyTime, { once: true });
    }, []);

    useEffect(() => {
        const main = mainRef.current; if (!main) return;
        // Cleaned up unused lens sync loop
        const onMetaOrSeek = () => { recomputeGeom(); };
        main.addEventListener("loadedmetadata", onMetaOrSeek); main.addEventListener("seeked", onMetaOrSeek);
        return () => { main.removeEventListener("loadedmetadata", onMetaOrSeek); main.removeEventListener("seeked", onMetaOrSeek); };
    }, [recomputeGeom]);



    // --- LOGIC: Trigger & Show ---

    // 1. Explicit Show Function
    const showHotspotsAtEnd = useCallback(() => {
        const main = mainRef.current; if (!main) return;
        suppressEndHooksRef.current = true; nearEndArmedRef.current = false;
        if (windowTimerRef.current) { clearTimeout(windowTimerRef.current); windowTimerRef.current = null; }

        isShowingRef.current = true;
        try { main.pause(); } catch { }

        const end = playableEnd(main);
        const target = Math.max(0, (isFinite(end) ? end : main.duration || 0) - NEAR_END_DELTA);

        const afterSeek = () => {
            main.removeEventListener("seeked", afterSeek);

            // âœ… FIX: Wait for lens seek to complete before showing to avoid "wrong frame" jump
            requestAnimationFrame(() => {
                const lLens = leftLensVidRef.current;
                const rLens = rightLensVidRef.current;

                // 1. Sync times
                syncLensSrcAndTime(lLens);
                syncLensSrcAndTime(rLens);

                pauseAllAudios();
                muteVideo(main, true);

                // 2. Wait for lens 'seeked' (or timeout)
                let pending = 0;
                const onLensReady = () => {
                    pending--;
                    if (pending <= 0) {
                        setShowHotspots(true);
                        setTimeout(() => { suppressEndHooksRef.current = false; }, 150);
                    }
                };

                // Helper to attach one-time listener
                const waitFor = (v: HTMLVideoElement | null) => {
                    if (!v || v.readyState < 1) return;
                    pending++;
                    // If already close enough, just go
                    if (Math.abs(v.currentTime - target) < 0.1) {
                        pending--; return;
                    }
                    const h = () => { v.removeEventListener("seeked", h); onLensReady(); };
                    v.addEventListener("seeked", h, { once: true });
                };

                waitFor(lLens);
                waitFor(rLens);

                // If nothing to wait for, show immediately
                if (pending === 0) {
                    setShowHotspots(true);
                    setTimeout(() => { suppressEndHooksRef.current = false; }, 150);
                } else {
                    // Safety timeout (in case seek hangs)
                    setTimeout(() => {
                        if (pending > 0) { pending = 0; setShowHotspots(true); suppressEndHooksRef.current = false; }
                    }, 250); // 250ms max wait
                }
            });
        };
        try { main.addEventListener("seeked", afterSeek); main.currentTime = target; } catch { afterSeek(); }
    }, [pauseAllAudios, syncLensSrcAndTime]);

    // 2. The Time Check Loop (Fixes Ghost Hotspots & AutoPlay Pre-transition)
    useEffect(() => {
        const main = mainRef.current;
        if (!main) return;

        let rafId: number;
        const checkTime = () => {
            if (!main.paused && !main.ended) {
                const dur = main.duration;
                const time = main.currentTime;

                // Removed Bad Outcome Backtracking per user request - ALL leaf nodes will now stay on screen.

                // Only trigger if we are VERY close to end
                if (dur > 0 && time >= dur - 0.2) {
                    const isAutoPlayNode = !!(currentNode.autoPlaySrc && currentNode.children?.autoPlay);
                    const hasActiveHotspots = !!currentNode.subs[0] || !!currentNode.subs[1];

                    if (isAutoPlayNode && !hasActiveHotspots) {
                        // PRE-TRANSITION: Snapshot canvas early so swap is seamless
                        if (!isTransitioning && snapshotCanvasRef.current) {
                            const canvas = snapshotCanvasRef.current;
                            const ctx = canvas.getContext('2d');
                            if (ctx && main.videoWidth && main.videoHeight) {
                                canvas.width = main.videoWidth;
                                canvas.height = main.videoHeight;
                                ctx.drawImage(main, 0, 0, canvas.width, canvas.height);
                                setIsTransitioning(true);
                            }
                        }
                    } else if (!showHotspots && active === null) {
                        setShowHotspots(true);
                    }
                } else {
                    // âœ… CRITICAL FIX: If time is < duration (e.g. looped back to start), HIDE hotspots
                    if (showHotspots && active === null && time < dur - 0.5 && time > 0.1) {
                        setShowHotspots(false);
                        isShowingRef.current = false;
                    }
                }
            }
            rafId = requestAnimationFrame(checkTime);
        };
        rafId = requestAnimationFrame(checkTime);
        return () => cancelAnimationFrame(rafId);
    }, [currentId, showHotspots, active, currentNode, isTransitioning, setIsTransitioning]);

    // 3. On Ended Handler (Main Video)
    useEffect(() => {
        const main = mainRef.current; if (!main) return;
        const onEnded = () => {
            console.log("ðŸŽ¬ [Preview] onEnded fired. manualRestarting:", manualRestartingRef.current, "suppress:", suppressEndHooksRef.current);
            if (!manualRestartingRef.current && !suppressEndHooksRef.current) {
                const hasActiveHotspots = !!currentNode.subs[0] || !!currentNode.subs[1];
                const isAutoPlayNode = !!(currentNode.autoPlaySrc && currentNode.children?.autoPlay);

                console.log("ðŸŽ¬ [Preview] onEnded logic -> hasActiveHotspots:", hasActiveHotspots, "| isAutoPlayNode:", isAutoPlayNode);
                console.log("ðŸŽ¬ [Preview] onEnded -> autoPlaySrc:", !!currentNode.autoPlaySrc, "| children.autoPlay exists:", !!currentNode.children?.autoPlay);

                if (isAutoPlayNode && !hasActiveHotspots) {
                    console.log("ðŸŽ¬ [Preview] EXACT END: Pushing next node for seamless cut.");
                    // EXACT END: Push the next node for a seamless cut
                    suppressEndHooksRef.current = true;
                    setNodeStack(prev => [...prev, currentNode.children!.autoPlay!]);
                    // Reset suppress flag shortly after to allow subsequent logic
                    setTimeout(() => { suppressEndHooksRef.current = false; }, 500);
                } else {
                    console.log("ðŸŽ¬ [Preview] onEnded calling showHotspotsAtEnd()");
                    showHotspotsAtEnd();
                }
            }
        };
        main.addEventListener("ended", onEnded);
        return () => main.removeEventListener("ended", onEnded);
    }, [showHotspotsAtEnd, currentNode]);

    // 4. Time-based Hotspot Auto-Play Logic
    useEffect(() => {
        const isAutoPlayNode = !!(currentNode.autoPlaySrc && currentNode.children?.autoPlay);
        const hasActiveHotspots = !!currentNode.subs[0] || !!currentNode.subs[1];

        console.log("â³ [HotspotCatcher] Eval -> showHotspots:", showHotspots, "| isAutoPlayNode:", isAutoPlayNode, "| hasActiveHotspots:", hasActiveHotspots, "| active:", active);
        console.log("â³ [HotspotCatcher] Nodes -> autoPlaySrc:", !!currentNode.autoPlaySrc, "| children.autoPlay exists:", !!currentNode.children?.autoPlay);

        if (showHotspots && isAutoPlayNode && hasActiveHotspots && active === null) {
            console.log("â³ [HotspotCatcher] STARTING 5-SECOND TIMER");
            setIsAutoPlayTimerActive(true);
            const timerId = setTimeout(() => {
                console.log("â³ [HotspotCatcher] TIMER FINISHED - Transitioning to AutoPlay!");
                suppressEndHooksRef.current = true;

                // Transition snapshot
                const main = mainRef.current;
                if (main && snapshotCanvasRef.current) {
                    try {
                        const canvas = snapshotCanvasRef.current;
                        const ctx = canvas.getContext('2d');
                        if (ctx && main.videoWidth && main.videoHeight) {
                            canvas.width = main.videoWidth;
                            canvas.height = main.videoHeight;
                            ctx.drawImage(main, 0, 0, canvas.width, canvas.height);
                            setIsTransitioning(true);
                            console.log("â³ [HotspotCatcher] Canvas snapshot success");
                        }
                    } catch (err) {
                        console.error("â³ [HotspotCatcher] Canvas snapshot ERROR (Likely Cross-Origin):", err);
                    }
                }

                setNodeStack(prev => [...prev, currentNode.children!.autoPlay!]);
                setTimeout(() => { suppressEndHooksRef.current = false; }, 500);
                setIsAutoPlayTimerActive(false);
            }, 5000);

            return () => {
                console.log("â³ [HotspotCatcher] Timer CLEARED");
                clearTimeout(timerId);
                setIsAutoPlayTimerActive(false);
            };
        } else {
            setIsAutoPlayTimerActive(false);
        }
    }, [showHotspots, currentNode, active, setIsTransitioning]);


    // --- ACTIONS ---

    const onExitSubLeft = useCallback(() => {
        if (leftSubRef.current) { leftSubRef.current.pause(); leftSubRef.current.currentTime = 0; }
        setActive(null); setSubEnded(false); pauseAllAudios();
        if (mainRef.current) muteVideo(mainRef.current, true);
        setShowHotspots(true);
        setTimeout(() => showHotspotsAtEnd(), 0);
    }, [pauseAllAudios, showHotspotsAtEnd]);

    const onExitSubRight = useCallback(() => {
        if (rightSubRef.current) { rightSubRef.current.pause(); rightSubRef.current.currentTime = 0; }
        setActive(null); setSubEnded(false); pauseAllAudios();
        if (mainRef.current) muteVideo(mainRef.current, true);
        setShowHotspots(true);
        setTimeout(() => showHotspotsAtEnd(), 0);
    }, [pauseAllAudios, showHotspotsAtEnd]);

    // âœ… NEW: Auto-Close Sub-Videos Logic
    // If not last node: Close sub after 3s.
    // If last node (Node 2 / Max Depth): Do nothing (Stay open).
    useEffect(() => {
        const leftEl = leftSubRef.current;
        const rightEl = rightSubRef.current;

        const handleEnd = (side: "left" | "right") => {
            // NEVER auto-close sub-videos per user request. Stay on the final frame!
            // We just record that the sub-video ended so we can show the Home Icon.
            if (active === side) {
                setSubEnded(true);
            }
        };

        const onLeftEnd = () => handleEnd("left");
        const onRightEnd = () => handleEnd("right");

        if (leftEl) leftEl.addEventListener("ended", onLeftEnd);
        if (rightEl) rightEl.addEventListener("ended", onRightEnd);

        return () => {
            if (leftEl) leftEl.removeEventListener("ended", onLeftEnd);
            if (rightEl) rightEl.removeEventListener("ended", onRightEnd);
        };
    }, [active, onExitSubLeft, onExitSubRight, isMaxDepth]);


    const restartMainFromZero = useCallback(async () => {
        const main = mainRef.current; if (!main) return;
        manualRestartingRef.current = true; suppressEndHooksRef.current = true; nearEndArmedRef.current = false;
        setShowHotspots(false); isShowingRef.current = false;
        if (windowTimerRef.current) { clearTimeout(windowTimerRef.current); windowTimerRef.current = null; }
        try { leftSubRef.current?.pause(); rightSubRef.current?.pause(); } catch { }
        setActive(null); pauseAllAudios();
        try { main.pause(); main.currentTime = 0; } catch { }
        if (audioEnabled) { if (hasMainSnippet) { await tryPlay(mainAudioRef.current); muteVideo(main, true); } else { muteVideo(main, false); } } else { muteVideo(main, true); }
        await tryPlay(main);
        setTimeout(() => { suppressEndHooksRef.current = false; manualRestartingRef.current = false; nearEndArmedRef.current = true; }, 800);
    }, [audioEnabled, hasMainSnippet, tryPlay]);

    const jumpToPrePause = useCallback(() => { stoppedAfterTwoRef.current = false; loopsRef.current = 0; restartMainFromZero(); }, [restartMainFromZero]);

    const playSub = useCallback((id: "left" | "right") => {
        hideHUDTemporarily();
        if (currentNode.children?.[id]) {
            // Snapshot current video before transitioning
            const sourceVideo = active === "left" ? leftSubRef.current : active === "right" ? rightSubRef.current : mainRef.current;
            if (sourceVideo && snapshotCanvasRef.current) {
                const canvas = snapshotCanvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && sourceVideo.videoWidth && sourceVideo.videoHeight) {
                    canvas.width = sourceVideo.videoWidth;
                    canvas.height = sourceVideo.videoHeight;
                    ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
                    setIsTransitioning(true);
                }
            }
            setNodeStack(prev => [...prev, currentNode.children![id]!]);
            return;
        }
        const main = mainRef.current; const sub = id === "left" ? leftSubRef.current : rightSubRef.current;
        if (!main || !sub) return;
        setShowHotspots(false); isShowingRef.current = false;
        if (windowTimerRef.current) { clearTimeout(windowTimerRef.current); windowTimerRef.current = null; }
        try { main.pause(); } catch { }
        sub.currentTime = 0; setActive(id); setSubEnded(false);
        pauseAllAudios(); muteVideo(main, true); muteVideo(leftSubRef.current, true); muteVideo(rightSubRef.current, true);
        const hasSnippet = id === "left" ? hasLeftSnippet : hasRightSnippet;
        if (audioEnabled) { if (hasSnippet) { const subAudio = id === "left" ? leftAudioRef.current : rightAudioRef.current; if (subAudio) { subAudio.currentTime = 0; tryPlay(subAudio); } muteVideo(sub, true); } else { muteVideo(sub, false); } } else { muteVideo(sub, true); }
        sub.play().catch(() => { });
    }, [currentNode, audioEnabled, hasLeftSnippet, hasRightSnippet, pauseAllAudios, tryPlay]);

    const firstSoundPlayedRef = useRef(false);



    const shouldShowSpeaker = videoPlaying && !audioEnabled && (hasMainSnippet || hasLeftSnippet || hasRightSnippet || wantsAnyVideoAudio);
    const audioCtxRef = useRef<AudioContext | null>(null); const audioUnlockedRef = useRef(false);
    const primeAudioGesture = useCallback(() => { if (audioUnlockedRef.current) return; try { const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext; if (AC) { audioCtxRef.current ??= new AC(); audioCtxRef.current?.resume?.(); } } catch { } audioUnlockedRef.current = true; setAudioEnabled(true); const sub = active === "left" ? leftSubRef.current : active === "right" ? rightSubRef.current : null; if (active && sub) { const hasSnippet = active === "left" ? hasLeftSnippet : hasRightSnippet; if (!hasSnippet) muteVideo(sub, false); } else if (!active && mainRef.current && !hasMainSnippet) { muteVideo(mainRef.current, false); } }, [active, hasLeftSnippet, hasRightSnippet, hasMainSnippet]);
    const enableAudioByUser = useCallback(async () => {
        setAudioEnabled(true); try { if (!audioCtxRef.current && (window as any).AudioContext) audioCtxRef.current = new (window as any).AudioContext(); await audioCtxRef.current?.resume(); } catch { }

        const audiblePrime = async (el?: HTMLAudioElement | null) => { if (!el) return false; try { el.muted = false; el.volume = 1; el.currentTime = 0; await el.play(); await new Promise((r) => setTimeout(r, 120)); el.pause(); el.currentTime = 0; return true; } catch { return false; } }; await ((await audiblePrime(mainAudioRef.current)) || (await audiblePrime(leftAudioRef.current)) || (await audiblePrime(rightAudioRef.current))); pauseAllAudios(); const main = mainRef.current; const l = leftSubRef.current; const r = rightSubRef.current; if (active === "left") { if (hasLeftSnippet) { await tryPlay(leftAudioRef.current); muteVideo(l, true); } else { muteVideo(l, false); } } else if (active === "right") { if (hasRightSnippet) { await tryPlay(rightAudioRef.current); muteVideo(r, true); } else { muteVideo(r, false); } } else { if (hasMainSnippet) { await tryPlay(mainAudioRef.current); muteVideo(main, true); } else { muteVideo(main, false); } }
    }, [active, hasLeftSnippet, hasRightSnippet, hasMainSnippet, pauseAllAudios, tryPlay]);

    // --- STYLES ---
    const baseMarkerStyle = useCallback((id: "left" | "right"): React.CSSProperties => {
        const g = geomRef.current;
        const subUrl = id === "left" ? subs[0] : subs[1];
        if (!subUrl) return { display: "none" };

        if (!g) return { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "64px", aspectRatio: "1 / 1", borderRadius: "50%", background: "rgba(255,255,255,0.05)", zIndex: 6 };
        const spot = id === "left" ? g.left : g.right;
        return {
            position: "absolute", left: `${spot.centerX}px`, top: `${spot.centerY}px`, transform: "translate(-50%, -50%)", width: `${spot.lensDiamPx}px`, aspectRatio: "1 / 1", borderRadius: "50%", background: "radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.00) 55%)", backdropFilter: "blur(0.2px) saturate(10%)", WebkitBackdropFilter: "blur(0.2px) saturate(10%)", border: "none", boxShadow: "0 6px 18px rgba(0,0,0,0.22)", display: "block", transition: "transform 1080ms ease, box-shadow 1080ms ease, opacity 1120ms ease", willChange: "transform, box-shadow, opacity", cursor: "pointer", zIndex: 6, overflow: "hidden"
        } as React.CSSProperties;
    }, [subs]);

    const markerStyle = baseMarkerStyle;

    const makeLensVideoStyle = useCallback((hs: Hotspot): React.CSSProperties => {
        const g = geomRef.current;
        if (!g) return { display: "none" };
        const spot = hs.id === "left" ? g.left : g.right;
        const dx = spot.centerX - g.offX; const dy = spot.centerY - g.offY;
        const left = spot.lensDiamPx / 2 - dx; const top = spot.lensDiamPx / 2 - dy;
        return { position: "absolute", left: `${left}px`, top: `${top}px`, width: `${g.dispW}px`, height: `${g.dispH}px`, objectFit: "fill", pointerEvents: "none", transformOrigin: `${dx}px ${dy}px`, willChange: "transform" };
    }, []);



    const tapCountRef = useRef(0); // ðŸ‘ˆ add this

    const handleMainPointerUp = useCallback(async () => {
        hideHUDTemporarily();
        if (showHotspots || active !== null) return;


        props.setActiveStory(true);

        // 1ï¸âƒ£ First tap ever â†’ unlock + choose audio source
        if (!firstSoundPlayedRef.current) {

            firstSoundPlayedRef.current = true;
            await enableAudioByUser();
            lastTapRef.current = performance.now();
            tapCountRef.current = 1;
            return;


        }

        // 2ï¸âƒ£ After that: count taps within a small window
        const now = performance.now();
        if (now - lastTapRef.current < 550) {
            tapCountRef.current += 1;
        } else {
            tapCountRef.current = 1;
        }
        lastTapRef.current = now;

        // 3ï¸âƒ£ Triple tap & NOT root â†’ go back up one node
        if (tapCountRef.current >= 2 && nodeStack.length > 0) {
            tapCountRef.current = 0;
            handleBack();       // pops child node
            return;
        }

        // 4ï¸âƒ£ Double tap â†’ restart main
        if (tapCountRef.current === 1) {
            jumpToPrePause();
        }
    }, [showHotspots, active, enableAudioByUser, jumpToPrePause, handleBack, nodeStack.length,]);


    return (
        <>

            <audio
                ref={globalAudioRef}
                src={GLOBAL_BG_SRC}
                loop
                preload="auto"
                style={{ display: 'none' }}
            />

            {/* ðŸ“¸ SNAPSHOT CANVAS FOR TRANSITIONS */}
            <canvas
                ref={snapshotCanvasRef}
                style={{
                    position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%",
                    objectFit: "contain", objectPosition: matchMobile ? "top center" : "center",
                    filter: "grayscale(100%)",
                    opacity: isTransitioning ? 1 : 0,
                    transition: "opacity 300ms ease",
                    pointerEvents: "none", zIndex: 15
                }}
            />

            <React.Fragment key={currentId}>
                <TouchPreviewMedia
                    setIsPreloaded={props.setIsPreloaded}
                    isPreloaded={props.isPreloaded}
                    globalAudioRef={globalAudioRef}
                    bgState={props.intbg === 0 ? false : true}
                    bgSrc={props.feedDataMainAud}
                    audioEnabled={audioEnabled}
                    setAudioEnabled={setAudioEnabled}
                    mainRef={mainRef} leftSubRef={leftSubRef} rightSubRef={rightSubRef}
                    mainAudioRef={mainAudioRef} leftAudioRef={leftAudioRef} rightAudioRef={rightAudioRef}
                    mainSrc={mainSrc} subs={subs}
                    // âœ… Passing the full array now
                    mainAudioUrl={mainAudioUrl} sub1AudioUrl={sub1AudioUrl} sub2AudioUrl={sub2AudioUrl}
                    feeds={props.feeds} MuteReducer={MuteReducer} IS_IPHONE_OR_SAFARI={IS_IPHONE_OR_SAFARI}
                    active={active} mainLoaded={mainLoaded} leftLoaded={leftLoaded} rightLoaded={rightLoaded}
                    setMainLoaded={setMainLoaded} setLeftLoaded={setLeftLoaded} setRightLoaded={setRightLoaded}
                    handleMainPointerUp={handleMainPointerUp} jumpToPrePause={jumpToPrePause}

                    onExitSubLeft={onExitSubLeft}
                    onExitSubRight={onExitSubRight}
                    isTransitioning={isTransitioning}
                    setIsTransitioning={setIsTransitioning}
                    snapshotCanvasRef={snapshotCanvasRef}
                />

                <TouchPreviewOverlay
                    mainRef={mainRef} // ðŸ‘ˆ Added for Canvas Lenses
                    isHUDHidden={isHUDHidden} // ðŸ‘ˆ Added for auto-hide
                    isAutoPlayTimerActive={isAutoPlayTimerActive} // ðŸ‘ˆ Added for timer bar
                    showHotspots={showHotspots} active={active} markerStyle={markerStyle} makeLensVideoStyle={makeLensVideoStyle}
                    hsById={hsById} leftLensVidRef={leftLensVidRef} rightLensVidRef={rightLensVidRef}
                    MuteReducer={MuteReducer} toggleMute={toggleMute}
                    primeAudioGesture={primeAudioGesture} playSub={playSub} shouldShowSpeaker={shouldShowSpeaker}
                    enableAudioByUser={enableAudioByUser} backToEdit={handleBack} onPublish={props.onPublish} feeds={props.feeds}
                    interactionPostId={props.interactionPostId}
                    // VICTORY MODE PROPS
                    videoArray={props.videoArray}
                    goodOutcomes={props.goodOutcomes}
                    setGoodOutcomes={props.setGoodOutcomes}
                    isGoodOutcome={isGoodOutcome}
                    isCurrentNodeVictory={isCurrentNodeVictory}
                    isLeaf={isLeaf || (active !== null && subEnded)}
                    goHome={goHome}
                    showFirstImpressionPill={showFirstImpressionPill}
                    isRootNode={nodeStack.length === 0}
                />


            </React.Fragment>

        </>
    );
};

export default TouchPreviewStageUI;
