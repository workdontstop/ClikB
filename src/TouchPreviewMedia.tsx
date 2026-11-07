import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { matchMobile } from "./DetectDevice";
import { BRANCH_IDS, BRANCH_INDEX, BranchId, BranchTuple } from "./TouchInteractionModel";
import { acquire, peek } from "./interactionAssetCache";
import { preloadInteractionAssets } from './interactionPreload';
import { useVideoPresentation } from './useVideoPresentation';
import "./mediaLoadingCover.css";

/**
 * Stage 6B: `interactionAssetCache` is the SINGLE loading owner for every
 * interaction video, music track and audio clip. This file no longer keeps a
 * cache of its own — no `globalBlobCache`, no `"pending"` sentinel, no
 * `blobTick` re-render to retro-fit a blob onto a already-mounted element.
 */

/**
 * Resolves a remote URL to its cached blob URL, or `undefined` while it loads.
 *
 * The element is deliberately given NOTHING until the blob exists. Handing over
 * the remote URL as a placeholder is what caused the old dual-owner bug: the
 * browser began its own native streaming download of the same file, and when
 * the manual fetch landed the `src` was swapped underneath a playing element,
 * reloading it and resetting its position. Stage 6A's opacity rules already
 * hold an element invisible until it has a decoded frame, so this wait is
 * presented rather than flashed.
 *
 * The lease taken here protects the blob from LRU eviction and from `clear()`
 * for exactly as long as this element is mounted on this url.
 */
function useCachedSrc(url?: string | null, enabled = true): string | undefined {
    const key = url ? String(url) : null;

    // Seeded synchronously from the cache so an already-cached asset is assigned
    // on the FIRST render of the mount — no empty frame, no post-mount swap.
    const [state, setState] = useState<{ key: string | null; src: string | undefined }>(
        () => ({ key, src: peek(key) ?? undefined })
    );

    // The source changed for this same mounted element. Drop the previous blob
    // immediately so it never shows the outgoing node's frame while the next
    // one downloads. (Adjusting state during render is React's documented
    // pattern for this; it re-renders before committing anything to the DOM.)
    if (state.key !== key) setState({ key, src: peek(key) ?? undefined });

    useEffect(() => {
        if (!key) return;
        // Keep cached branches leased, but let the opening frame download before
        // starting uncached lookahead. An actively selected branch always enables it.
        if (!enabled && !peek(key)) return;
        let live = true;

        // ref++ is synchronous, before any await, so this entry cannot be
        // evicted in the window between requesting it and receiving the blob.
        const lease = acquire(key);

        lease.promise.then(
            (blobUrl) => { if (live) setState((s) => (s.key === key && s.src === blobUrl ? s : { key, src: blobUrl })); },
            // Failed download: stay empty. The cache has already dropped the
            // entry, so the next mount retries it.
            () => { if (live) setState((s) => (s.key === key && s.src === undefined ? s : { key, src: undefined })); },
        );

        return () => { live = false; lease.release(); };
    }, [key, enabled]);

    return state.key === key ? state.src : (peek(key) ?? undefined);
}

interface MediaProps {
    mainRef: React.RefObject<HTMLVideoElement>;
    subRefs: Record<BranchId, React.RefObject<HTMLVideoElement>>;
    mainAudioRef: React.RefObject<HTMLAudioElement>;
    branchAudioRefs: Record<BranchId, React.RefObject<HTMLAudioElement>>;
    mainSrc: string;
    mainPoster?: string;
    subs: BranchTuple<string>;
    /** Node id — preloading runs once per node instead of once per session. */
    preloadKey?: string;
    /** Extra sources worth warming for this node (loop destinations' main videos). */
    extraPreloadSrcs?: string[];
    /**
     * Hold to Play ownership gate. When a Hold session owns an element, ONLY
     * TouchPreviewStageUI may call play()/pause() on it. Gating just the <video
     * autoPlay> prop is not enough — this component starts playback from seven
     * separate places, and any one of them would resume a released hold.
     */
    holdControlledMedia?: "main" | BranchId | null;
    holdSessionId?: number | null;
    /** Identifies the mount, so a readiness report from a destroyed element can be discarded. */
    holdVisitKey?: string | null;
    onHoldMediaReady?: (info: { sessionId: number; visitKey: string | null; controlledMedia: "main" | BranchId }) => void;
    mainAudioUrl?: any[] | any;
    branchAudioUrls: Partial<Record<BranchId, any[] | any>>;
    feeds: any;
    MuteReducer: boolean;
    IS_IPHONE_OR_SAFARI: boolean;
    active: BranchId | null;
    mainLoaded: boolean;
    branchLoaded: Record<BranchId, boolean>;
    setMainLoaded: (v: boolean) => void;
    setBranchLoaded: (branch: BranchId, value: boolean) => void;
    handleMainPointerUp: () => void;
    jumpToPrePause: () => void;
    onExitSub: (branch: BranchId) => void;
    audioEnabled: boolean;
    setAudioEnabled: (v: boolean) => void;
    globalAudioRef: any;
    setIsPreloaded: any;
    isPreloaded: any;
    bgState?: boolean;
    bgSrc?: any;
    isTransitioning?: boolean;
    setIsTransitioning?: (v: boolean) => void;
    snapshotCanvasRef?: React.RefObject<HTMLCanvasElement>;
    onMainVisualReady?: (video: HTMLVideoElement) => void;
}

const TouchPreviewMedia: React.FC<MediaProps> = ({
    mainRef, subRefs, mainAudioRef, branchAudioRefs,
    mainSrc, mainPoster, subs, mainAudioUrl, branchAudioUrls, feeds, MuteReducer, IS_IPHONE_OR_SAFARI,
    active, mainLoaded, branchLoaded, setMainLoaded, setBranchLoaded,
    handleMainPointerUp, jumpToPrePause, onExitSub, audioEnabled, setAudioEnabled,
    bgState, bgSrc, globalAudioRef, setIsPreloaded, isPreloaded,
    isTransitioning, setIsTransitioning, snapshotCanvasRef, onMainVisualReady,
    preloadKey, extraPreloadSrcs,
    holdControlledMedia = null, holdSessionId = null, holdVisitKey = null, onHoldMediaReady
}) => {
    const [showAudioHint, setShowAudioHint] = useState(false);
    // Stage 6A: buffering means a genuine mid-playback stall — the browser fired
    // `waiting` while frames were moving. It does NOT mean "a source started
    // loading". Only `waiting` sets it; only `playing` clears it. `loadstart`
    // must never set it: a Hold destination is deliberately never played, so
    // `playing` would never fire and the element would sit dimmed forever.
    // Starts false for the same reason — a Hold on the very first node would
    // otherwise be stuck at 0.7.
    const [isBuffering, setIsBuffering] = useState(false);
    // Per-branch equivalent. Lives here, not in the stage, so the
    // <React.Fragment key={visitKey}> remount resets it on every visit for free
    // (the stage's branchLoaded needs an explicit reset because it lives up there).
    const [branchBuffering, setBranchBufferingState] = useState<Record<BranchId, boolean>>({
        left: false, right: false, top: false, bottom: false,
    });
    const setBranchBuffering = (branch: BranchId, value: boolean) => {
        setBranchBufferingState((buffering) => ({ ...buffering, [branch]: value }));
    };
    const primedOnceRef = useRef(false);

    // 👇 Ref for the global background audio
    const bgAudioRef = useRef<HTMLAudioElement>(null);

    // ✅ "Use this Audio for all scenes" only takes effect when there is actually a
    // track to loop. bgState does two jobs — it starts the global track AND
    // suppresses every scene's own audio element — so turning it on without a
    // source would silence the whole interaction instead of unifying it.
    const bgActive = Boolean(bgState && bgSrc);

    // True when the named element is owned by a Hold session and must not be
    // started by any of this component's own effects.
    const holdOwnsMain = holdControlledMedia === "main";
    const holdOwnsBranch = (branch: BranchId) => holdControlledMedia === branch;
    /** Any live Hold session, whatever element it owns. */
    const holdActive = holdControlledMedia !== null;

    const heldSrcsRef = useRef<Set<string>>(new Set());
    if (holdControlledMedia === "main") {
        if (mainSrc) heldSrcsRef.current.add(String(mainSrc));
    } else if (holdControlledMedia) {
        const heldSub = subs[BRANCH_INDEX[holdControlledMedia]];
        if (heldSub) heldSrcsRef.current.add(String(heldSub));
    }
    const wasHeld = (src?: string | null) => Boolean(src && heldSrcsRef.current.has(String(src)));
    const ownership = useRef({ active, holdControlledMedia });
    ownership.current = { active, holdControlledMedia };
    const isOwnedVideo = (video: HTMLVideoElement) => {
        const current = ownership.current;
        return BRANCH_IDS.some(branch => subRefs[branch].current === video
            && (current.active === branch || current.holdControlledMedia === branch))
            || mainRef.current === video && current.holdControlledMedia === 'main';
    };

    const getAudioSrc = (val: any) => (Array.isArray(val) ? val[0] || null : val || null);
    const mainAudioSrc = getAudioSrc(mainAudioUrl);
    const branchAudioSrcs: Record<BranchId, string | null> = {
        left: getAudioSrc(branchAudioUrls.left),
        right: getAudioSrc(branchAudioUrls.right),
        top: getAudioSrc(branchAudioUrls.top),
        bottom: getAudioSrc(branchAudioUrls.bottom),
    };

    const forceLoadVideo = (v?: HTMLVideoElement | null) => { if (!v) return; try { v.preload = "auto"; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); if (v.readyState < 2 && !v.networkState) v.load(); } catch { } };

    const primeDecodeVideo = async (v?: HTMLVideoElement | null) => {
        if (!v || isOwnedVideo(v)) return;
        const source = v.currentSrc || v.src;
        try {
            const prevMuted = v.muted; v.muted = true; v.setAttribute("muted", ""); v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
            // load() discards decoder/seek state even for an already ready Blob.
            if (v.readyState < 2 && v.networkState === 0) { try { v.load(); } catch { } }
            const p = v.play(); if (p && typeof (p as any).then === "function") { await p; }
            if (isOwnedVideo(v) || (v.currentSrc || v.src) !== source) return;
            try { v.pause(); } catch { } try { v.currentTime = 0; } catch { } v.muted = prevMuted;
        } catch { }
    };



    // 1️⃣ Refs to hold data (So we don't need them in useEffect dependencies)
    const dataRef = useRef({ subs, mainAudioUrl, branchAudioUrls, extraPreloadSrcs });

    // Update refs on render (Does not trigger effects)
    dataRef.current = { subs, mainAudioUrl, branchAudioUrls, extraPreloadSrcs };

    // Stage 6B: the component-local "already preloaded" ref is GONE.
    //
    // It marked a node complete BEFORE its 200ms timer ran. StrictMode's
    // mount → unmount → mount then cancelled that timer in cleanup while the ref
    // survived the remount, so the second mount returned early and no download
    // was ever scheduled — the preload pass never executed once in development.
    // Deduplication now belongs entirely to the cache manager: a second request
    // for the same url joins the existing pending entry, which is inherently
    // StrictMode-safe and works identically in production.

    // 2️⃣ Lookahead preload — branch videos, loop destinations, music and audio.
    //
    // This warms the shared cache so a branch is already in RAM by the time the
    // user chooses it. Removing it would make every choice pay a full download.
    // The main video does NOT go through here: it is acquired directly by its
    // element on mount (see `useCachedSrc` above), which happens before this
    // 200ms timer and therefore gets the connection first.
    useEffect(() => {
        if (!mainLoaded) return;
        // Lookahead deliberately takes no lease. A destination the user never
        // chooses must stay evictable; only mounted elements pin RAM.
        const urls: string[] = [];
        const warm = (url: any) => {
            if (!url) return;
            // Rejections are logged and the entry dropped by the cache, so the
            // next visit retries. Nothing here needs to react to a failure.
            urls.push(String(url));
        };
        let stop: (() => void) | undefined;
        const timer = setTimeout(() => {
            // Read from REF (stable) instead of props (new identity every render).
            const { subs, mainAudioUrl, branchAudioUrls, extraPreloadSrcs } = dataRef.current;

            subs.forEach(warm);                        // this node's branch videos
            (extraPreloadSrcs || []).forEach(warm);    // loop destinations one click away

            // Audio and music share the same manager and the same entry budget.
            const process = (val: any) => {
                if (Array.isArray(val)) val.forEach(warm);
                else if (val) warm(val);
            };
            process(mainAudioUrl);
            BRANCH_IDS.forEach((branch) => process(branchAudioUrls[branch]));
            stop = preloadInteractionAssets(urls);

            // `isPreloaded` keeps its original meaning (priming/spinner gate).
            // It is not, and never was, a correct preload guard.
            setIsPreloaded((prev: any) => (prev === true ? prev : true));
        }, 200);

        // Cancelling this timer is now harmless: nothing was marked complete on
        // the way in, so a StrictMode remount simply schedules it again.
        return () => { clearTimeout(timer); stop?.(); };

        // 🛑 Keyed on the node, NOT on subs/audio identity, which change every render.
    }, [preloadKey, setIsPreloaded, mainLoaded]);

    const primeAllMediaOnce = () => {
        if (primedOnceRef.current) return;
        primedOnceRef.current = true;

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

        BRANCH_IDS.forEach((branch) => smartPrime(subRefs[branch].current));

        // 1b. ✅ AUDIO FIX (iOS sound unlock).
        // primeAllMediaOnce only ever runs from a real user gesture, and that is
        // the one moment Safari accepts an UNMUTED play() on an element it has
        // never heard. Playing each sub unmuted for a frame and pausing it
        // whitelists that element, so a LATER reveal — including an autoplayed one
        // with no gesture of its own — is allowed to have sound. Without this,
        // autoplay reveals are silent no matter what the unmute logic asks for.
        //
        // Same shape as primeDecodeVideo, minus the mute. Subs are off-screen at
        // this point, so the frame that plays is not visible. Skipped entirely
        // when the viewer has muted, so this can never override that.
        const unlockSoundForGesture = (v?: HTMLVideoElement | null) => {
            if (!v || isOwnedVideo(v)) return;
            const source = v.currentSrc || v.src;
            try {
                const prevMuted = v.muted;
                v.muted = false;
                const settle = () => {
                    if (isOwnedVideo(v) || (v.currentSrc || v.src) !== source) return;
                    try { v.pause(); } catch { }
                    try { v.currentTime = 0; } catch { }
                    v.muted = prevMuted;
                };
                const p = v.play();
                if (p && typeof (p as any).then === "function") {
                    (p as any).then(settle).catch(() => { if (!isOwnedVideo(v) && (v.currentSrc || v.src) === source) v.muted = prevMuted; });
                } else settle();
            } catch { }
        };
        if (!MuteReducer) BRANCH_IDS.forEach((branch) => unlockSoundForGesture(subRefs[branch].current));

        // 2. Prime Standard Audios (Keep as is, lightweight)
        try { mainAudioRef.current?.load?.(); } catch { }
        BRANCH_IDS.forEach((branch) => { try { branchAudioRefs[branch].current?.load?.(); } catch { } });

        // We don't need to load bgAudio if we are about to play globalAudio below
        // try { bgAudioRef.current?.load?.(); } catch { }

        // 3. ✅ HANDLE GLOBAL AUDIO (Your working Fix)
        try {
            if (bgActive) {
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

    // Which source this mount has already auto-started. Without it, the effect
    // below re-runs when holdOwnsMain flips back to false at the end of a Hold
    // session and calls load()+play() again — replaying the video the viewer just
    // finished holding through, before the node's normal outcome runs.
    const autoStartedSrcRef = useRef<string | null>(null);

    useEffect(() => {
        const v = mainRef.current; if (!v) return;
        v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); v.muted = true; v.setAttribute("muted", "");
        if (holdOwnsMain) {
            // Hold owns this element: load it so it can become playable, but never
            // start it. The parent decides when, based on the pointer. Recorded as
            // started so releasing the gate cannot restart it.
            autoStartedSrcRef.current = mainSrc;
            v.autoplay = false;
            if (v.readyState < 2 && v.networkState === 0) { try { v.load(); } catch { } }
            return;
        }
        v.autoplay = true;
        if (autoStartedSrcRef.current === mainSrc || wasHeld(mainSrc)) return; // already started, or Hold owns it
        console.log("[Hold] MEDIA: initial autostart of main", mainSrc);
        autoStartedSrcRef.current = mainSrc;
        if (v.readyState < 2 && v.networkState === 0) { try { v.load(); } catch { } }
        v.play().catch(() => { });
    }, [mainRef.current, mainSrc, holdOwnsMain]);

    // Readiness handshake. Reports which element became playable, under which
    // session and mount, so the parent can ignore stale reports from elements the
    // keyed remount already destroyed.
    //
    // Covers sub routes as well as main. A sub element is not remounted, but it
    // may still be cold — reporting readiness on faith would ask the parent to
    // play a video with no data.
    useEffect(() => {
        if (holdControlledMedia === null || holdSessionId === null || !onHoldMediaReady) return;
        const element = holdControlledMedia === "main"
            ? mainRef.current
            : subRefs[holdControlledMedia].current;
        if (!element) return;

        const controlled = holdControlledMedia;
        const report = () => onHoldMediaReady({ sessionId: holdSessionId, visitKey: holdVisitKey, controlledMedia: controlled });

        if (element.readyState >= 2) { report(); return; }
        element.addEventListener("loadeddata", report, { once: true });
        element.addEventListener("canplay", report, { once: true });
        try { element.load(); } catch { }
        return () => {
            element.removeEventListener("loadeddata", report);
            element.removeEventListener("canplay", report);
        };
    }, [holdControlledMedia, holdSessionId, holdVisitKey, onHoldMediaReady, mainSrc, subs[0], subs[1], subs[2], subs[3]]);

    useEffect(() => {
        BRANCH_IDS.forEach((branch) => forceLoadVideo(subRefs[branch].current));
        try { mainAudioRef.current?.load?.(); } catch { }
        BRANCH_IDS.forEach((branch) => { try { branchAudioRefs[branch].current?.load?.(); } catch { } });
    }, [subs[0], subs[1], subs[2], subs[3], mainAudioSrc, branchAudioSrcs.left, branchAudioSrcs.right, branchAudioSrcs.top, branchAudioSrcs.bottom]);

    // ✅ UNIFIED AUDIO LOGIC
    useEffect(() => {
        const video = mainRef.current; const audio = mainAudioRef.current;
        const attemptUnmuteAndPlay = async () => {
            const effectiveMute = MuteReducer;
            if (effectiveMute) {
                if (video) video.muted = true; if (audio) audio.muted = true; setShowAudioHint(false); setAudioEnabled(false); return;
            }
            // ✅ AUDIO FIX (iOS): this used to hard-mute and return, which made the
            // unmuted play() below unreachable on iPhone — every reveal and every
            // autoplay was silent, and setAudioEnabled(true) reported otherwise.
            // Only handleDoubleTap ever reached sound, which is exactly what the
            // "double tap makes it work" symptom was.
            //
            // Now iOS takes the same path as everyone else, with one guarantee the
            // old code was really protecting: a REJECTED unmuted play() must never
            // stall the scene. If Safari refuses (no gesture credit on this element
            // yet), we fall back to muted playback so the visuals still run, and
            // raise the hint so the viewer can grant sound.
            if (IS_IPHONE_OR_SAFARI) {
                try {
                    if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && audio) {
                        audio.muted = false;
                        await audio.play();
                        if (video) { video.muted = true; if (video.paused) video.play().catch(() => { }); }
                    } else if (video) {
                        video.muted = false;
                        await video.play();
                    }
                    console.log("[AudioFix] ✅ SOUND GRANTED on", mainSrc);
                    setAudioEnabled(true); setShowAudioHint(false);
                } catch (err) {
                    // TEMPORARY DIAGNOSTIC — safe to delete once verified on device.
                    // If this fires on a real iPhone, Safari refused the unmuted
                    // play() and we fall back to silent-but-moving video.
                    console.log("[AudioFix] ❌ SOUND REFUSED on", mainSrc, err);
                    if (audio) { try { audio.pause(); } catch { } }
                    if (video) { video.muted = true; if (video.paused) video.play().catch(() => { }); }
                    setAudioEnabled(false); setShowAudioHint(true);
                }
                return;
            }
            try {
                // ✅ FIX: Strictly check that mainAudioSrc is a STRING to avoid "Array(0)" truthy issues
                if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && audio) {
                    audio.muted = false; await audio.play(); setAudioEnabled(true);
                    // ✅ FIX: Explicitly play the video so it does not sit paused
                    // (invisible) while the audio plays. Since Stage 6A there is no
                    // onPlay handler — visibility now comes from `playing`, which this
                    // play() will produce once frames actually move.
                    if (video) {
                        video.muted = true; // Ensure video track is silent
                        if (video.paused) video.play().catch(() => { });
                        // No setMainLoaded here. It was redundant — this effect is gated
                        // on mainLoaded already being true (see the guard below) — and
                        // since Stage 6A readiness must only be established by an event
                        // that proves a decoded frame exists.
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
        if (mainLoaded && !holdOwnsMain && !wasHeld(mainSrc)) {
            console.log("[Hold] MEDIA: attemptUnmuteAndPlay on main", mainSrc);
            attemptUnmuteAndPlay();
        }
    }, [mainLoaded, mainAudioSrc, MuteReducer, IS_IPHONE_OR_SAFARI, setAudioEnabled, mainRef, mainAudioRef, holdActive]);

    // ✅ FIX: "Kickstarter" to break Deadlock.
    // If autoPlay fails (common), mainLoaded stays false, and attemptUnmuteAndPlay NEVER runs.
    // This forces the video to wake up if we have external audio.
    //
    // Stage 6A: the play() nudge stays, the forced setMainLoaded does NOT. Setting
    // it here declared a decoded frame that may not exist yet, which under the new
    // opacity chain promotes an empty element to 0.7 and — worse — arms the
    // transition watchdog, letting it drop the snapshot over nothing. The nudge
    // alone still breaks the deadlock: it starts the load, and loadeddata/canplay
    // then report readiness truthfully whether or not playback itself was allowed.
    useEffect(() => {
        if (holdActive) return;
        if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && !mainLoaded && mainRef.current) {
            const v = mainRef.current;
            v.muted = true; // Safety
            v.play().catch(() => { });
        }
    }, [mainAudioSrc, mainLoaded, holdActive]);

    const handleDoubleTap = () => {
        // Restarting main while ANY Hold session is live would fight the pointer.
        if (holdActive) return;
        primeAllMediaOnce(); jumpToPrePause();
        const video = mainRef.current; const audio = mainAudioRef.current;
        if (mainAudioSrc && audio) { audio.muted = false; audio.play().then(() => { setShowAudioHint(false); setAudioEnabled(true); }).catch(console.error); }
        else if (video) { video.muted = false; video.play().then(() => { setShowAudioHint(false); setAudioEnabled(true); }).catch(console.error); }
    };

    // ✅ CONTINUOUS AUDIO LOGIC (UPDATED WITH GLOBAL KILL SWITCH)
    useEffect(() => {

        // 🛑 1. GLOBAL KILL SWITCH LOGIC
        if (bgState) {
            // Allow video audio to play even if BG is present (User Request)
            // We do NOT return here anymore, detecting "Silence" was likely due to this block blocking normal audio logic.

            // Just ensure sub audios are paused if returning to main
            // try { mainAudioRef.current?.pause(); } catch { }
        }

        // 👇 2. NORMAL LOGIC (Resume standard behavior)
        // Ensure BG audio is stopped when not in BG mode
        try { bgAudioRef.current?.pause(); } catch { }

        // --- ORIGINAL LOGIC BELOW ---
        const pauseSubAudios = () => {
            BRANCH_IDS.forEach((branch) => {
                try { branchAudioRefs[branch].current?.pause(); } catch { }
            });
        };

        if (active === null) {
            // Returning to Main
            pauseSubAudios(); // Must stop sub audios

            // ✅ FIX: Strict check for string to avoid Array(0) muting the video logic
            if (mainAudioSrc && typeof mainAudioSrc === 'string' && mainAudioSrc.length > 0 && mainAudioRef.current) {
                // If main has audio file, ensure it plays — unless Hold owns the
                // video, in which case its audio must follow the pointer, not this.
                if (!holdActive) mainAudioRef.current.play().catch(() => { });
                // Mute main video to avoid double audio
                if (mainRef.current) mainRef.current.muted = true;
            } else if (mainRef.current) {
                // If no main audio file, play video audio
                mainRef.current.muted = false;
            }
        }
        else {
            const branchAudioSrc = branchAudioSrcs[active];
            const branchAudio = branchAudioRefs[active].current;
            const subVideo = subRefs[active].current;

            if (branchAudioSrc && typeof branchAudioSrc === "string" && branchAudioSrc.length > 0 && branchAudio) {
                try { mainAudioRef.current?.pause(); } catch { }
                if (!holdOwnsBranch(active)) {
                    branchAudio.currentTime = 0;
                    branchAudio.play().catch(() => { });
                }
                if (subVideo) subVideo.muted = true;
            } else if (subVideo) {
                const mainAudioIsPlaying = Boolean(
                    mainAudioSrc &&
                    typeof mainAudioSrc === "string" &&
                    mainAudioSrc.length > 0 &&
                    mainAudioRef.current &&
                    !mainAudioRef.current.paused
                );
                subVideo.muted = mainAudioIsPlaying;
            }

            if (subVideo) {
                const activeSubSrc = subs[BRANCH_INDEX[active]];
                if (subVideo.paused && !holdOwnsBranch(active) && !wasHeld(activeSubSrc)) {
                    console.log("[Hold] MEDIA: continuous-audio restarting sub", active, activeSubSrc);
                    subVideo.play().catch(() => { });
                }
                // Starting a request does not prove a picture exists. Keep
                // main visible (with its pending cue) until the sub has data.
                if (subVideo.readyState >= 2) setBranchLoaded(active, true);
            }
        }

        // 🛑 GLOBAL MUTE ENFORCEMENT
        if (MuteReducer) {
            if (mainRef.current) mainRef.current.muted = true;
            BRANCH_IDS.forEach((branch) => {
                if (subRefs[branch].current) subRefs[branch].current!.muted = true;
            });
        }

    }, [active, mainAudioSrc, branchAudioSrcs.left, branchAudioSrcs.right, branchAudioSrcs.top, branchAudioSrcs.bottom, bgActive, audioEnabled, MuteReducer, holdControlledMedia]);

    // ── Stage 6B source resolution ─────────────────────────────────────────
    // Every element below receives a cached blob URL or nothing at all. The old
    // `getSrc()` returned the remote URL as a placeholder whenever the cache had
    // not finished, which started a second native download of the same file and
    // then swapped `src` underneath a playing element. Both are gone: a source
    // is assigned once per mount and never replaced.
    //
    // The main video acquires here, on mount, which is earlier than the 200ms
    // lookahead timer — so it always gets the connection first.
    //
    // Hook order is fixed and unconditional. BRANCH_IDS/BRANCH_INDEX are
    // constant, so all ten calls run on every render even when a branch has no
    // source (a null url is a no-op that resolves to undefined).
    const mainVideoSrc = useCachedSrc(mainSrc);
    const branchVideoSrcs: Record<BranchId, string | undefined> = {
        left: useCachedSrc(subs[BRANCH_INDEX.left], mainLoaded || active === 'left' || holdControlledMedia === 'left'),
        right: useCachedSrc(subs[BRANCH_INDEX.right], mainLoaded || active === 'right' || holdControlledMedia === 'right'),
        top: useCachedSrc(subs[BRANCH_INDEX.top], mainLoaded || active === 'top' || holdControlledMedia === 'top'),
        bottom: useCachedSrc(subs[BRANCH_INDEX.bottom], mainLoaded || active === 'bottom' || holdControlledMedia === 'bottom'),
    };
    const mainPresented = useVideoPresentation(mainRef, mainVideoSrc);
    const branchPresented: Record<BranchId, boolean> = {
        left: useVideoPresentation(subRefs.left, branchVideoSrcs.left),
        right: useVideoPresentation(subRefs.right, branchVideoSrcs.right),
        top: useVideoPresentation(subRefs.top, branchVideoSrcs.top),
        bottom: useVideoPresentation(subRefs.bottom, branchVideoSrcs.bottom),
    };
    useLayoutEffect(() => {
        // This runs AFTER the render that commits main at full opacity beneath
        // the snapshot. A compositor callback alone cannot prove that commit.
        // Also cut short a fallback fade if its two-rAF timer won the race
        // against the first presentation callback. The parent rejects the
        // outgoing snapshot's own element as readiness for a new destination.
        const video = mainRef.current;
        if (!video || !mainLoaded || isBuffering || video.currentSrc !== mainVideoSrc) return;
        if (mainPresented) { onMainVisualReady?.(video); return; }
        // A fully covered video can withhold compositor callbacks. For a fresh
        // mount at its opening frame, source-matched decoded data plus the next
        // paint is sufficient; arbitrary seeks still use the guarded fallback.
        if (!isTransitioning || video.readyState < 3 || video.seeking || video.currentTime > .1) return;
        const frame = requestAnimationFrame(() => {
            if (mainRef.current === video && video.currentSrc === mainVideoSrc && !video.seeking && video.readyState >= 3) {
                onMainVisualReady?.(video);
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [mainPresented, mainLoaded, isBuffering, isTransitioning, mainVideoSrc, onMainVisualReady]);
    // When bgActive, per-scene audio is suppressed entirely — passing null here
    // releases any lease those elements held instead of pinning unused tracks.
    const mainAudioResolved = useCachedSrc(bgActive ? null : mainAudioSrc);
    const branchAudioResolved: Record<BranchId, string | undefined> = {
        left: useCachedSrc(bgActive ? null : branchAudioSrcs.left),
        right: useCachedSrc(bgActive ? null : branchAudioSrcs.right),
        top: useCachedSrc(bgActive ? null : branchAudioSrcs.top),
        bottom: useCachedSrc(bgActive ? null : branchAudioSrcs.bottom),
    };

    return (
        <>
            {/* 👇 GLOBAL LOOP AUDIO ELEMENT */}


            {bgActive ? null : mainAudioSrc ? <audio ref={mainAudioRef} src={mainAudioResolved} preload="auto" muted={MuteReducer} /> : null}
            {bgActive ? null : BRANCH_IDS.map((branch) => {
                const audioSrc = branchAudioSrcs[branch];
                return audioSrc ? (
                    <audio key={branch} ref={branchAudioRefs[branch]} src={branchAudioResolved[branch]} preload="auto" muted={MuteReducer} />
                ) : null;
            })}

            {mainPoster && <img className="media-loading-cover" src={mainPoster} alt="" decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                    objectPosition: matchMobile ? 'top center' : 'center', pointerEvents: 'none',
                    // Keep the cover opaque underneath the existing video fade.
                    opacity: mainLoaded ? 0 : 1, transition: mainLoaded ? 'opacity 0s 420ms' : 'none' }} />}
            <video ref={mainRef} src={mainVideoSrc} preload="auto" playsInline autoPlay={!holdActive}
                className={active && !branchLoaded[active] ? 'media-loading-cover' : undefined}
                onTimeUpdate={() => { if (!mainLoaded) setMainLoaded(true); }}
                // No onPlay handler by design. `play` fires when play() is *requested*
                // and proves nothing about decoded data — it may not paint for hundreds
                // of ms. It must not clear buffering, must not clear the transition
                // snapshot, and must not set mainLoaded: any of the three can promote an
                // unpainted element to a non-zero opacity, which reads as a black frame.
                // Every event below implies real data: loadeddata and canplay mean a
                // frame exists, playing means frames are moving, timeupdate means the
                // clock advanced.
                onPlaying={() => { setMainLoaded(true); setIsBuffering(false); setIsTransitioning?.(false); }}
                onWaiting={() => setIsBuffering(true)}
                onLoadedData={() => setMainLoaded(true)}
                onCanPlay={() => setMainLoaded(true)}
                onDoubleClick={handleDoubleTap} onClick={() => { if (!holdActive) primeAllMediaOnce(); }}
                onPointerUp={() => {
                    // During a Hold: no priming (it calls load/play/pause and
                    // currentTime = 0 on every sub, including the held one) and no
                    // jumpToPrePause (it restarts main from zero). handleMainPointerUp
                    // still runs, so double/triple tap to go back keeps working.
                    if (holdActive) { handleMainPointerUp(); return; }
                    primeAllMediaOnce();
                    if (IS_IPHONE_OR_SAFARI) { handleMainPointerUp() } else { if (!MuteReducer && audioEnabled) { handleMainPointerUp() } else { jumpToPrePause(); handleMainPointerUp() } }
                }}
                style={{
                    position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%",
                    objectFit: "contain", objectPosition: matchMobile ? "top center" : "center", backgroundColor: "transparent",
                    // Stage 6C: this layer no longer hides itself. Two of the old
                    // "engine" cases are gone, and both removals are load-bearing.
                    //
                    //   `active ? 0` — REMOVED. Dropping main to 0 the instant a
                    //   branch became active meant main faded 1→0 while the branch
                    //   faded 0→1 over the same 420ms. Two layers fading in
                    //   opposite directions do not compose into one opaque image:
                    //   source-over of 0.5 onto 0.5 covers 0.75, so a quarter of
                    //   the stage background showed through for ~200ms. That was
                    //   the flash. Main now simply stays put and the branch, which
                    //   paints above it, covers it on the way in and uncovers it
                    //   on the way out. One animating layer, never two.
                    //
                    //   `isTransitioning ? 0` — REMOVED for the same reason. The
                    //   snapshot canvas is now fully opaque (Stage 6C), so there is
                    //   nothing to ghost against and no need to pin this to 0.
                    //   Staying visible is what lets the incoming video be revealed
                    //   rather than faded in.
                    //
                    //   no decoded frame yet -> 0    (element is empty; 0.7 would be black)
                    //   stalled mid-playback -> 0.7  (last decoded frame, dimmed)
                    //   playing              -> 1
                    opacity:
                        !mainLoaded ? 0 :
                            isBuffering ? 0.7 :
                                1,
                    // Suppressed for the whole transition so the frame that sets
                    // `mainLoaded` snaps this straight to 1 behind the opaque
                    // snapshot, instead of animating 0→1 against a canvas that is
                    // animating 1→0. The stage waits two rAFs after readiness
                    // before dissolving the canvas, guaranteeing this has painted.
                    // Outside a transition the 420ms easing is untouched — it still
                    // owns the mid-playback buffering dim.
                    transition: isTransitioning
                        ? "none"
                        : "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)",
                    willChange: "opacity", backfaceVisibility: "hidden", touchAction: "manipulation",
                }} />

            {BRANCH_IDS.map((branch, index) => (
                <video key={branch} ref={subRefs[branch]} src={branchVideoSrcs[branch]} playsInline preload="auto"
                    onLoadedData={() => setBranchLoaded(branch, true)}
                    // Same contract as main: `waiting` marks a stall but must never
                    // clear branchLoaded — that would discard the last decoded frame
                    // and drop the layer to 0 (a black flash) instead of dimming it.
                    onWaiting={() => setBranchBuffering(branch, true)}
                    onPlaying={() => { setBranchLoaded(branch, true); setBranchBuffering(branch, false); }}
                    // Stage 6C: rewind only once this layer has genuinely finished
                    // fading out. Doing it in onExitSub reset the video while it was
                    // still fully visible, so the jump to frame 0 played on screen.
                    // A timer instead of this event would fire into live playback if
                    // the user reopened the branch mid-fade; the `active` guard makes
                    // a reopened branch simply skip the rewind.
                    onTransitionEnd={(event) => {
                        if (event.propertyName !== "opacity") return;
                        if (active === branch) return;   // reopened before the fade finished
                        const element = subRefs[branch].current;
                        if (element) { try { element.currentTime = 0; } catch { } }
                    }}
                    style={{
                        position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%",
                        objectFit: "contain", objectPosition: matchMobile ? "top center" : "center",
                        backgroundColor: "transparent",
                        // Engine cases first, all resolving to 0 — see the main video above.
                        opacity:
                            active !== branch ? 0 :
                                !branchLoaded[branch] ? 0 :
                                    branchBuffering[branch] ? 0.7 :
                                        1,
                        pointerEvents: active === branch ? "auto" : "none",
                        // A verified incoming frame cuts in immediately. Exit
                        // still fades, preserving the rewind-on-transitionend contract.
                        transition: active === branch && branchPresented[branch]
                            ? 'none' : "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)",
                        willChange: "opacity", backfaceVisibility: "hidden",
                        cursor: active === branch ? "pointer" : "default",
                    }}
                    onClick={() => {
                        // A Hold release landing on the video must not exit the route.
                        if (holdActive) return;
                        if (active === branch) onExitSub(branch);
                    }} />
            ))}
        </>
    );
};

export default TouchPreviewMedia;
