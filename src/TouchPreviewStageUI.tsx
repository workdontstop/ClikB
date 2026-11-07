import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { RootState } from "./store";
import { publishFeedsArea, removeFeedsArea } from "./brainstormSlice";
import { boundedFeedTextHint, type FeedAreaId, type FeedControl } from "./feedsControlSnapshot";
import { useSelector, useDispatch } from "react-redux";
import { activateFullscreenMute, deactivateFullscreenMute, initFirstImpression, incrementFirstImpression } from "./settingsSlice";
import TouchPreviewMedia from "./TouchPreviewMedia";
import TouchPreviewOverlay from "./TouchPreviewOverlay";
import { matchMobile } from "./DetectDevice";
import {
    BRANCH_IDS,
    BRANCH_INDEX,
    BranchId,
    BranchTuple,
    LANE_IDS,
    LANE_PATH,
    LaneId,
    normalizeHotspots,
    Hotspot,
    InteractionNode,
    isDragNode,
    normalizeInteractionNode,
    normalizeSubs,
} from "./TouchInteractionModel";
import {
    NodeIndex,
    NodeIndexEntry,
    buildStackForPath,
    createNodeIndex,
    loopTargetsForNode,
    resolveBranchDestination,
    resolveLaneDestination,
    buildDragEntryMap,
    buildHoldEntryMap,
} from "./TouchInteractionNavigation";
import {
    HoldPlaybackState,
    choiceWindowMs,
    controllerFromHotspot,
    holdAwaitingRelease,
    holdChoicesEnabled,
    holdIsPlaying,
    holdPlaybackReducer,
} from "./TouchHoldPlaybackModel";
import {
    DragState,
    dragAwaitingRelease,
    dragEngaged as dragIsEngaged,
    dragHoldReducer,
    dragOwnsMedia,
    laneForOffset,
    stickVisible,
} from "./DragHoldModel";

const LENS_ZOOM = 1.1;

export type { Hotspot, InteractionNode } from "./TouchInteractionModel";

interface Props {
    backToEdit: () => void;
    mainSrc: string;
    subs: BranchTuple<string>;
    hotspots: BranchTuple<Hotspot>;
    stage: any;
    onPublish: any;
    feeds: any;
    // ✅ Updated inputs to accept arrays or single values (normalized in useMemo)
    mainAudioUrl?: any[] | any;
    sub1AudioUrl?: any[] | any;
    sub2AudioUrl?: any[] | any;
    topAudioUrl?: any[] | any;
    bottomAudioUrl?: any[] | any;
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
    snapshotObscured?: boolean;
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

    // ✅ FIX: Calculate offset of Video Element relative to Container (e.g. -10px inset)
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
    const [nodeVictoryStack, setNodeVictoryStack] = useState<boolean[]>([]);
    const activeNode = nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : null;

    useEffect(() => {
        console.log("💾 [Database Fetch] Raw nestedTree from DB:", props.nestedTree);
    }, [props.nestedTree]);


    const [isTransitioning, setIsTransitioningRaw] = useState(false);
    const [fastSnapshotReveal, setFastSnapshotReveal] = useState(false);
    const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const snapshotSourceRef = useRef<HTMLVideoElement | null>(null);
    // The Stage 6A transition watchdog lives further down, immediately after the
    // mainLoaded declaration it depends on.

    /** Stage 6C: how long the outgoing frame takes to dissolve. */
    const SNAPSHOT_FADE_MS = 200;

    /**
     * Stage 6C. Ending a transition is a two-step reveal, not a single flag flip.
     *
     * Two layers fading in opposite directions do not compose into one opaque
     * image: at the midpoint of a symmetric crossfade the stage background shows
     * through by ~25% (source-over of 0.5 over 0.5 covers 0.75, not 1.0). That
     * quarter-second of background IS the black/white flash. The fix is to only
     * ever animate ONE layer — the opaque snapshot on top — while the incoming
     * video sits at full opacity underneath it, already painted.
     *
     * So `false` does not clear immediately. The main video's own transition is
     * suppressed for as long as `isTransitioning` is true, which means the frame
     * that sets `mainLoaded` snaps it straight to 1 behind the still-opaque
     * canvas. Two rAFs then guarantee that paint has actually happened before the
     * canvas begins to dissolve. Without the delay the canvas would start fading
     * in the same frame the video is still at 0, which is the very dip this
     * exists to remove.
     *
     * Callers are unchanged — this deliberately keeps the `setIsTransitioning`
     * name and boolean signature so every existing call site, including the ones
     * threaded through Hold readiness and the watchdog, keeps working as written.
     */
    const revealFrameRef = useRef<number | null>(null);

    /**
     * The scheduled reveal belongs to ONE transition. If a second navigation
     * captures a new snapshot while those frames are still queued, the older
     * callback would land afterwards and clear the *new* transition — dropping
     * the fresh snapshot onto a video that has not decoded yet. That is the
     * original flash, reintroduced by the fix for it, and it only shows up on
     * fast successive taps. Every path that starts or ends a transition cancels
     * whatever was pending first.
     */
    const cancelPendingReveal = useCallback(() => {
        if (revealFrameRef.current !== null) {
            cancelAnimationFrame(revealFrameRef.current);
            revealFrameRef.current = null;
        }
    }, []);

    const setIsTransitioning = useCallback((next: boolean) => {
        cancelPendingReveal();
        if (next) { setFastSnapshotReveal(false); setIsTransitioningRaw(true); return; }
        revealFrameRef.current = requestAnimationFrame(() => {
            revealFrameRef.current = requestAnimationFrame(() => {
                revealFrameRef.current = null;
                setIsTransitioningRaw(false);
            });
        });
    }, [cancelPendingReveal]);

    // A queued reveal must not fire into an unmounted tree.
    useEffect(() => cancelPendingReveal, [cancelPendingReveal]);

    /**
     * Stage 6C: the one place an outgoing frame is captured.
     *
     * Deliberately NOT a `navigateTo()` wrapper — consolidating navigation would
     * pull Hold, loop, back and autoplay stack ownership into a purely visual
     * change. Each route keeps its own logic and simply calls this immediately
     * before mutating the stack.
     *
     * The caller passes whichever element is actually on screen. Snapshotting
     * `mainRef` unconditionally would capture the hidden main video whenever the
     * user navigates out of a branch, covering the transition with a frame they
     * were never looking at.
     */
    const captureOutgoingFrame = useCallback((sourceVideo: HTMLVideoElement | null) => {
        const canvas = snapshotCanvasRef.current;
        if (!sourceVideo || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx || !sourceVideo.videoWidth || !sourceVideo.videoHeight) return;
        canvas.width = sourceVideo.videoWidth;
        canvas.height = sourceVideo.videoHeight;
        try {
            ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
            snapshotSourceRef.current = sourceVideo;
            // Through the guarded wrapper, never the raw setter: starting a new
            // transition must cancel any reveal still queued from the previous one.
            setIsTransitioning(true);
        } catch {
            // Cross-origin frame — the transition simply will not cover. Now that
            // playback runs from same-origin blob: URLs this should not fire.
        }
    }, [setIsTransitioning]);

    // ✅ Helpers to normalize inputs to arrays
    const toArray = (val: any) => Array.isArray(val) ? val : (val ? [val] : []);

    const rootNode: InteractionNode = useMemo(
        () => normalizeInteractionNode(props.nestedTree, {
            id: "root",
            mainSrc: props.mainSrc,
            subs: normalizeSubs(props.subs),
            hotspots: normalizeHotspots(props.hotspots),
            audio: {
                main: toArray(props.mainAudioUrl),
                left: toArray(props.sub1AudioUrl),
                right: toArray(props.sub2AudioUrl),
                top: toArray(props.topAudioUrl),
                bottom: toArray(props.bottomAudioUrl),
            },
        }),
        [props.nestedTree, props.mainSrc, props.subs, props.hotspots, props.mainAudioUrl, props.sub1AudioUrl, props.sub2AudioUrl, props.topAudioUrl, props.bottomAudioUrl]
    );

    const currentNode = activeNode || rootNode;
    const isMaxDepth = nodeStack.length >= 7;

    const currentId = currentNode.id;
    const mainSrc = currentNode.mainSrc;
    const subs = currentNode.subs;
    const hotspots = currentNode.hotspots;

    // --- LOOP NAVIGATION ---
    // Visit epoch. Node id alone cannot key media resets, because a loop back to
    // the node you are already on leaves currentId unchanged — nothing would
    // remount and the jump would appear to do nothing.
    const [visitEpoch, setVisitEpoch] = useState(0);
    const visitKey = `${currentId}#${visitEpoch}`;

    const nodeIndex: NodeIndex = useMemo(() => createNodeIndex(rootNode), [rootNode]);

    /**
     * Nodes that are hold scenes, derived from the tree rather than remembered.
     * See buildHoldEntryMap — a scene whose point is that the viewer drives it must
     * behave that way however they arrive, not only when they press the hotspot.
     */
    const holdEntryMap = useMemo(() => buildHoldEntryMap(rootNode), [rootNode]);

    /* --- DRAG & HOLD ------------------------------------------------------ */

    /**
     * Lane action clips, mapped to the drag node and lane that lead into them.
     * Same derivation as holdEntryMap and the same purpose: arriving at an
     * action node WITHOUT the gesture — Back from its payoff, Home, a history
     * link — must not strand the viewer holding nothing.
     */
    const dragEntryMap = useMemo(() => buildDragEntryMap(rootNode), [rootNode]);

    const nodeIsDrag = isDragNode(currentNode);
    /** This node is a lane's action clip, and which drag node it belongs to. */
    const dragEntry = dragEntryMap.get(currentId);

    const [dragSession, setDragSession] = useState<DragState>(null);
    const dragSessionIdRef = useRef(0);
    /**
     * Suppresses the tap produced by the release that follows a won route.
     *
     * The clip ends with the finger still down, we navigate, and the physical
     * pointerup then lands on the destination — where handleMainPointerUp reads
     * a single tap as "restart main". The viewer would see the next scene start
     * and instantly restart.
     */
    const suppressNextTapRef = useRef(false);
    // The Stick's offset is deliberately NOT state. It is written straight to
    // the DOM node in the move handler — see onStickMove.

    const dispatchDrag = useCallback((event: Parameters<typeof dragHoldReducer>[1]) => {
        setDragSession((state) => {
            const next = dragHoldReducer(state, event);
            console.log("[Drag] EVENT", event.type,
                "|", state ? `${state.phase}/${state.lane}/ptr:${state.pointerId}` : "null",
                "->", next ? `${next.phase}/${next.lane}/ptr:${next.pointerId}` : "null");
            return next;
        });
    }, []);

    /** The Stick's DOM node. Its transform is driven directly, never via state. */
    const stickElRef = useRef<HTMLDivElement | null>(null);

    /** Returns the Stick home with the one animation it is allowed. */
    const settleStick = useCallback(() => {
        const el = stickElRef.current;
        if (!el) return;
        el.style.transition = "transform 180ms cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "translate(-50%, 0) translateX(0px)";
    }, []);

    /** True only while the finger still owns the action clip. */
    const dragHoldsMedia = dragOwnsMedia(dragSession);
    /**
     * Same value, read through a ref by the arrival-reset effect.
     *
     * As a dependency it re-fires that effect at COMMIT — the exact moment
     * ownership flips — which called setMainLoaded(false) and then force-played
     * main from the top 50ms later. The clip restarted instead of continuing.
     * Arrival reset must key on navigation and nothing else.
     */
    const dragHoldsMediaRef = useRef(false);
    dragHoldsMediaRef.current = dragHoldsMedia;

    const loopTargets = useMemo(
        () => loopTargetsForNode(nodeIndex, hotspots),
        [nodeIndex, hotspots]
    );

    // Node-level auto-loop: fires like autoPlay when the main video ends, but
    // travels to an existing node instead of cutting to a new video.
    const autoLoopEntry: NodeIndexEntry | undefined = currentNode.autoLoopTargetNodeId
        ? nodeIndex.get(currentNode.autoLoopTargetNodeId)
        : undefined;

    // Main videos of this node's loop destinations. These are the only nodes the
    // viewer can reach in one click, so they are worth having warm. The current
    // node's own mainSrc is deliberately excluded — the <video> element is
    // already streaming it and blob-caching it would download the file twice.
    const loopPreloadSrcs = useMemo(() => {
        const srcs = new Set<string>();
        const add = (src?: string) => {
            if (src && src !== currentNode.mainSrc) srcs.add(src);
        };

        BRANCH_IDS.forEach((branch) => add(loopTargets[branch]?.mainSrc));
        // Warm the choices that become visible after ONE navigation. Do not
        // recurse through the graph, which can contain loops and large trees.
        const destinations = new Map<string, InteractionNode>();
        BRANCH_IDS.forEach(branch => {
            const target = loopTargets[branch] || currentNode.children?.[branch];
            if (target) destinations.set(target.id, target);
        });
        if (autoLoopEntry?.node) destinations.set(autoLoopEntry.node.id, autoLoopEntry.node);
        if (currentNode.children?.autoPlay) destinations.set(currentNode.children.autoPlay.id, currentNode.children.autoPlay);
        destinations.forEach(target => add(target.mainSrc));
        destinations.forEach(target => {
            BRANCH_IDS.forEach((branch, index) => {
                const loop = target.hotspots[index]?.loopTargetNodeId;
                add((loop ? nodeIndex.get(loop)?.node.mainSrc : undefined)
                    || target.children?.[branch]?.mainSrc || target.subs[index]);
            });
        });

        // The auto-loop destination always replays in full, so a cold fetch there
        // is more visible than for a click-driven loop.
        add(autoLoopEntry?.node.mainSrc);

        // ✅ Root's mainSrc always. Every other node's main video enters the cache
        // for free as its parent's sub — root's is nobody's sub, so nothing else
        // pulls it in. It is also the most-revisited loop destination. The cache is
        // URL-keyed, so this costs exactly one fetch per session.
        add(rootNode.mainSrc);

        // ✅ Drag & Hold is unforgiving of a cold fetch: locking a lane and
        // playing its clip are the SAME instant, so there is no gesture-shaped
        // grace period to load in. A cold action clip means the viewer spends
        // the opening of their 2.5s probation holding a control that appears to
        // do nothing — and that fumble costs them a trial.
        //
        // A lane's action clip is nobody's sub either, exactly like root's main,
        // so nothing else pulls it into the cache.
        if (nodeIsDrag) {
            LANE_IDS.forEach((lane) => {
                const action = currentNode.children?.[LANE_PATH[lane]];
                add(action?.mainSrc);
                // The commit → payoff cut lands on the exact end frame.
                add(action?.children?.autoPlay?.mainSrc || action?.autoPlaySrc);
            });
        }

        // ✅ On a lane action clip, pin the drag node we bounce back to. It has
        // root's property locally — it is the node the viewer hits most, because
        // every snap-back returns here — and without this the retry loop
        // re-fetches the one thing it needs warmest.
        if (dragEntry) add(nodeIndex.get(dragEntry.parentNodeId)?.node.mainSrc);

        return Array.from(srcs);
    }, [loopTargets, currentNode, rootNode.mainSrc, autoLoopEntry, nodeIsDrag, dragEntry, nodeIndex]);

    // --- HOLD TO PLAY ---
    // Session state lives here, outside <React.Fragment key={visitKey}>, so it
    // survives the remount that child and loop navigation cause.
    const [holdSession, dispatchHold] = React.useReducer(holdPlaybackReducer, null as HoldPlaybackState);

    // Diagnostics. Every Hold line is prefixed [Hold] so the console can be
    // filtered down to just this feature.
    useEffect(() => {
        console.log("[Hold] session ->", holdSession
            ? `#${holdSession.sessionId} ${holdSession.phase} target=${holdSession.targetKind} branch=${holdSession.branch} src=${holdSession.sourceNodeId} expect=${holdSession.expectedVisitKey} ptr=${holdSession.pointerId}`
            : "null");
    }, [holdSession]);
    const holdSessionIdRef = useRef(0);
    /** Read inside the readiness callback, which must not go stale. */
    const holdSessionRef = useRef<HoldPlaybackState>(null);
    useEffect(() => { holdSessionRef.current = holdSession; }, [holdSession]);
    // One-shot: the shortened choice window belongs to the route just completed,
    // not to the node, so it must not leak into the next scene.
    const [holdWindowPending, setHoldWindowPending] = useState(false);

    /**
     * The ownership gate TouchPreviewMedia reads.
     *
     * An engaged Drag is folded in here rather than given a parallel gate,
     * because the contract is identical — "only TouchPreviewStageUI may call
     * play()/pause() on this element" — and TouchPreviewMedia starts playback
     * from seven separate places. A second gate would have to be threaded
     * through all seven and would drift from this one.
     *
     * A drag always owns "main": the action clip IS the destination node's main
     * video. Ownership is released at COMMIT, not at release — the inverse of
     * Hold — which is what lets the clip play out hands-free into its payoff.
     */
    const holdControlledMedia: "main" | BranchId | null = holdSession
        ? (holdSession.targetKind === "sub" ? holdSession.branch : "main")
        : (dragHoldsMedia ? "main" : null);
    const holdOwnsMain = holdControlledMedia === "main";
    /** Any live session. Autonomous playback must stop for sub routes too. */
    const holdActive = holdControlledMedia !== null;
    const choicesEnabled = holdChoicesEnabled(holdSession);

    const jumpingRef = useRef(false);
    /** Node id a snap-back asked to land on its end frame. */
    const landOnEndFrameRef = useRef<string | null>(null);
    /** Visit this arrival-armed session belongs to, so it arms exactly once. */
    const armedVisitRef = useRef<string | null>(null);
    /** runNodeCompletion is defined further down; effects above reach it via this. */
    const runNodeCompletionRef = useRef<(fromHoldRoute?: boolean) => void>(() => { });
    /** Same for playSub, which runNodeCompletion needs to auto-take a single route. */
    const playSubRef = useRef<(id: BranchId) => void>(() => { });
    // Hold on the last frame before an auto-loop with no choices travels on.
    const AUTO_LOOP_HOLD_MS = 3000;
    const autoLoopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearAutoLoopTimerImpl = useCallback(() => {
        if (autoLoopTimerRef.current) {
            clearTimeout(autoLoopTimerRef.current);
            autoLoopTimerRef.current = null;
        }
    }, []);

    const clearAutoLoopTimer = clearAutoLoopTimerImpl;

    // The shortened choice window belongs to the completed Hold route, not to the
    // node — any later navigation must return the interaction to five seconds.
    useEffect(() => { setHoldWindowPending(false); }, [visitKey]);

    // Orphan guard. A session whose expected mount no longer matches the one on
    // screen can never receive readiness or release, and while it survives it
    // blocks every autoplay path — which presents as a frozen interaction.
    useEffect(() => {
        if (!holdSession) return;
        if (holdSession.expectedVisitKey === null) return;
        if (holdSession.expectedVisitKey === visitKey) return;
        console.warn("[Hold] Session orphaned by navigation; releasing media gate.");
        dispatchHold({ type: "ABORT" });
    }, [holdSession, visitKey]);

    // ✅ Drag mode does NOT suppress hotspots. A capture node can offer the
    // Stick and its four hotspots and an auto-continuation all at once — drag
    // left, drag right, tap a choice, or hesitate and get timed out. The Stick
    // is one more control on the node, not a mode that disables the rest.
    const hasActiveHotspots = BRANCH_IDS.some(
        (branch) => Boolean(
            subs[BRANCH_INDEX[branch]] ||
            currentNode.children?.[branch] ||
            loopTargets[branch]
        )
    );

    /**
     * Does this node offer the viewer anything to do?
     *
     * The auto-continuations use THIS rather than hasActiveHotspots. The Stick
     * is a choice even though it is not a hotspot, so a capture node with an
     * autoplay video would otherwise cut away the instant its main video ended
     * and the viewer would never see the DRAG circle at all.
     */
    const hasChoices = hasActiveHotspots || nodeIsDrag;


    const mainAudioUrl = currentNode.audio?.main || [];
    const branchAudioUrls: Record<BranchId, any[]> = {
        left: currentNode.audio?.left || [],
        right: currentNode.audio?.right || [],
        top: currentNode.audio?.top || [],
        bottom: currentNode.audio?.bottom || [],
    };

    // --- REFS ---
    const mainRef = useRef<HTMLVideoElement | null>(null);
    const handleMainVisualReady = useCallback((video: HTMLVideoElement) => {
        if (mainRef.current !== video || snapshotSourceRef.current === video || video.seeking || video.readyState < 2) return;
        cancelPendingReveal();
        setFastSnapshotReveal(true);
        setIsTransitioningRaw(false);
    }, [cancelPendingReveal]);
    const leftSubRef = useRef<HTMLVideoElement | null>(null);
    const rightSubRef = useRef<HTMLVideoElement | null>(null);
    const topSubRef = useRef<HTMLVideoElement | null>(null);
    const bottomSubRef = useRef<HTMLVideoElement | null>(null);
    const leftLensCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const rightLensCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const topLensCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const bottomLensCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const mainAudioRef = useRef<HTMLAudioElement | null>(null);
    const leftAudioRef = useRef<HTMLAudioElement | null>(null);
    const rightAudioRef = useRef<HTMLAudioElement | null>(null);
    const topAudioRef = useRef<HTMLAudioElement | null>(null);
    const bottomAudioRef = useRef<HTMLAudioElement | null>(null);

    const subRefs = useMemo(() => ({
        left: leftSubRef,
        right: rightSubRef,
        top: topSubRef,
        bottom: bottomSubRef,
    }), []);
    const lensCanvasRefs = useMemo(() => ({
        left: leftLensCanvasRef,
        right: rightLensCanvasRef,
        top: topLensCanvasRef,
        bottom: bottomLensCanvasRef,
    }), []);
    const branchAudioRefs = useMemo(() => ({
        left: leftAudioRef,
        right: rightAudioRef,
        top: topAudioRef,
        bottom: bottomAudioRef,
    }), []);

    const [active, setActive] = useState<BranchId | null>(null);
    const [subEnded, setSubEnded] = useState(false);
    const [showHotspots, setShowHotspots] = useState(false);
    const [isAutoPlayTimerActive, setIsAutoPlayTimerActive] = useState(false);

    const rafIdRef = useRef<number | null>(null);
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

    /**
     * Stage 6A transition watchdog. isTransitioning is now cleared by exactly two
     * things: the main video's `playing` event, and the readyState >= 2 hatch in
     * the Hold control effect below — which returns early when no Hold owns an
     * element. `play` deliberately no longer clears it (play() being requested
     * does not mean frames are painted). So on a non-Hold node where play()
     * succeeds but `playing` never fires — autoplay rejection, iOS Safari, a
     * decode error — nothing would clear it, and the fully opaque Stage 6C
     * snapshot would sit over the stage forever.
     *
     * Stage 6C note: isTransitioning no longer pins the main video to 0. It now
     * only suppresses that video's opacity transition, so the frame which sets
     * mainLoaded snaps it straight to 1 behind the opaque snapshot. The reason
     * this watchdog exists is unchanged — something must eventually dissolve the
     * cover — but what it uncovers is now already painted.
     *
     * Gated on mainLoaded, and that gate is the whole safety of it. Keyed on
     * isTransitioning alone the timer would also fire on a healthy-but-slow
     * transition — a large file or a poor connection can take longer than 2s to
     * reach `loadeddata` — and clearing it there would dissolve the snapshot
     * while the main video is still at 0 for want of a frame, leaving a black
     * stage: worse than the frozen frame it replaced. With the gate the timer
     * only starts once readiness is proven, so a slow load simply keeps the
     * snapshot up until the video is genuinely ready. A transition that has NOT
     * proven a frame exists must never be force-completed.
     *
     * Excluded entirely during a Hold. The navigation reset below returns early
     * when holdActive, so it never runs setMainLoaded(false) — meaning mainLoaded
     * can still be describing the PREVIOUS node while a Hold destination loads.
     * The mainLoaded gate is therefore not trustworthy here and would arm the
     * timer over an undecoded destination. Holds do not need the watchdog anyway:
     * they have the readiness handshake and the readyState >= 2 escape hatch.
     *
     * Declared here rather than beside isTransitioning because it reads
     * mainLoaded, which is block-scoped to the line above.
     */
    useEffect(() => {
        if (!isTransitioning || !mainLoaded || holdActive) return;
        const timer = setTimeout(() => setIsTransitioning(false), 2000);
        return () => clearTimeout(timer);
    }, [isTransitioning, mainLoaded, holdActive]);

    const [branchLoaded, setBranchLoadedState] = useState<Record<BranchId, boolean>>({
        left: false, right: false, top: false, bottom: false,
    });
    const setBranchLoaded = useCallback((branch: BranchId, value: boolean) => {
        setBranchLoadedState((loaded) => ({ ...loaded, [branch]: value }));
    }, []);
    const [layoutVersion, setLayoutVersion] = useState(0);

    // --- RAM CACHE LIFETIME ---
    // Stage 6B: there is deliberately NO cache teardown here.
    //
    // This unmount cleanup used to call clearGlobalBlobCache(), destroying every
    // cached blob whenever the stage unmounted — which happens on node changes,
    // keyed remounts, leaving a preview, and any FeedsGate state update that
    // re-renders the tree. It was observed throwing away 8.4MB of freshly
    // downloaded video mid-session.
    //
    // The cache is scoped to the browser tab and owns its own bounded LRU, so it
    // needs no component to tidy up after it. Explicit teardown is available as
    // `clear()` from interactionAssetCache, which tombstones anything still
    // mounted rather than revoking it out from under a playing element.

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
            // ✅ Root is now always represented by an EMPTY stack (goHome included),
            // so the old `nodeStack.length === 1` test would never match. The id is
            // what identifies the node here; the length was doing no useful work.
            if (currentNode.id === "root") cloudUrl = props.videoArray[0];
            else if (nodeStack.length === 2 && currentNode.id === "root-left") cloudUrl = props.videoArray[1];
            else if (nodeStack.length === 2 && currentNode.id === "root-right") cloudUrl = props.videoArray[2];
            else if (nodeStack.length === 2 && currentNode.id === "root-top") cloudUrl = props.videoArray[3];
            else if (nodeStack.length === 2 && currentNode.id === "root-bottom") cloudUrl = props.videoArray[4];

            if (cloudUrl && validOutcomes.includes(getFilename(cloudUrl as string))) {
                isGoodOutcome = true;
            }
        }
    }
    const hasLeftChild = !!(currentNode.children?.left && currentNode.children.left.mainSrc !== "");
    const hasRightChild = !!(currentNode.children?.right && currentNode.children.right.mainSrc !== "");
    const hasTopChild = !!(currentNode.children?.top && currentNode.children.top.mainSrc !== "");
    const hasBottomChild = !!(currentNode.children?.bottom && currentNode.children.bottom.mainSrc !== "");
    const hasAutoPlayChild = !!(currentNode.children?.autoPlay && currentNode.children.autoPlay.mainSrc !== "");
    const hasAnyChild = hasLeftChild || hasRightChild || hasTopChild || hasBottomChild || hasAutoPlayChild;
    // ✅ A node offering a resolvable loop is NOT a dead end — the viewer still has
    // somewhere to go, so it must not be treated as terminal.
    const hasAnyLoopRoute = BRANCH_IDS.some((branch) => Boolean(loopTargets[branch])) || Boolean(autoLoopEntry);
    // ✅ Neither a drag node nor a lane action clip can be terminal. A drag node
    // always offers the Stick, and an unauthored lane returns the viewer here;
    // an action clip leads to its payoff, or back to the drag node it came from.
    const isLeaf = currentNode.id !== "root"
        && !hasAnyChild
        && !hasAnyLoopRoute
        && !nodeIsDrag
        && !dragEntry;

    // ✅ Home affordance is a SEPARATE question from "is this a dead end".
    // A node with no ordinary children is somewhere the viewer may want to bail
    // out of, even when a loop hotspot gives them somewhere else to go — which
    // matters most there, since an author can build loops with no route to a
    // victory. Deliberately not `isLeaf`: that excludes loop nodes so autoplay
    // and dead-end detection keep treating them as non-terminal.
    const canExitToHome = currentNode.id !== "root" && !hasAnyChild;
    const isCurrentNodeVictory = nodeVictoryStack[nodeVictoryStack.length - 1] || false;

    // 🏆 FIRST IMPRESSIONS LOGIC
    useEffect(() => {
        if (props.interactionPostId) {
            dispatch(initFirstImpression(String(props.interactionPostId)));
        }
    }, [props.interactionPostId, dispatch]);

    useEffect(() => {
        console.log("🏆 FirstImpressions Check ->", { 
            nodeId: currentNode.id,
            isLeaf, 
            hasLeftChild,
            hasRightChild,
            hasTopChild,
            hasBottomChild,
            hasAutoPlayChild,
            isCurrentNodeVictory, 
            interactionPostId: props.interactionPostId,
            childrenObj: currentNode.children,
            mainSrc: currentNode.mainSrc
        });
        
        if (isLeaf) {
            console.log("Leaf reached. Failure is consumed only when exiting/backing from a non-victory route.", {
                isCurrentNodeVictory,
                hasInteractionPostId: Boolean(props.interactionPostId)
            });
        }
    }, [isLeaf, isCurrentNodeVictory, props.interactionPostId, dispatch, hasLeftChild, hasRightChild, hasTopChild, hasBottomChild, hasAutoPlayChild, currentNode]);

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
    }, [visitKey]);

    // --- FIRST IMPRESSION STATE ---
    const [firstImpression, setFirstImpression] = useState<string | null>(null);

    useEffect(() => {
        if (isLeaf && !firstImpression) {
            setFirstImpression(currentNode.mainSrc);
        }
    }, [isLeaf, firstImpression, currentNode.mainSrc]);

    const showFirstImpressionPill = validOutcomes.length > 0 && isLeaf && isGoodOutcome && firstImpression === currentNode.mainSrc;

    // ✅ One failure consumption per VISIT (not per currentId — a self-loop keeps
    // the same id). Protects Back / Home / sub-exit / loop-jump from all counting
    // the same failed route.
    const failureConsumedRef = useRef<string | null>(null);

    const consumeFailedRouteIfNeeded = useCallback((reason: string) => {
        if (!props.interactionPostId) return;
        if (failureConsumedRef.current === visitKey) return;

        const activeBranchIsVictory = active
            ? Boolean(currentNode.hotspots[BRANCH_INDEX[active]]?.isVictory)
            : null;

        const isFailedTerminalBranch = activeBranchIsVictory === false;
        const isFailedTreeRoute = active === null && currentNode.id !== "root" && !isCurrentNodeVictory;

        if (isFailedTerminalBranch || isFailedTreeRoute) {
            failureConsumedRef.current = visitKey;
            console.log("🚨 DETECTOR TRIGGERED: Failed route exited. Incrementing trials for post:", props.interactionPostId, reason);
            dispatch(incrementFirstImpression(String(props.interactionPostId)));
        }
    }, [active, currentNode, dispatch, isCurrentNodeVictory, props.interactionPostId, visitKey]);

    /** pauseAllAudios is declared further down; this keeps a live reference. */
    const pauseAllAudiosRef = useRef<() => void>(() => { });

    /** Retires whatever branch video is on screen, so navigation cannot orphan it. */
    const clearActiveBranch = useCallback(() => {
        BRANCH_IDS.forEach((branch) => {
            const el = subRefs[branch].current;
            if (!el) return;
            try { el.pause(); } catch { }
            try { el.currentTime = 0; } catch { }
        });
        pauseAllAudiosRef.current();
        setActive(null);
        setSubEnded(false);
    }, []);

    const goHome = useCallback(() => {
        dispatchHold({ type: "ABORT" });
        // Stage 6C: capture BEFORE clearActiveBranch(). That helper rewinds every
        // branch to currentTime 0, so capturing after it would snapshot the
        // branch's first frame rather than the frame the user was actually
        // watching — a visibly wrong cover when leaving an active branch.
        captureOutgoingFrame(active ? subRefs[active].current : mainRef.current);
        clearActiveBranch();
        consumeFailedRouteIfNeeded("goHome");
        // ✅ Root is canonically an EMPTY stack. Previously this set [rootNode],
        // giving root two representations: isRootNode went false after Home, and
        // the following Back press popped to [] without changing anything on
        // screen, so it looked broken.
        setNodeStack([]);
        setNodeVictoryStack([]);
        setVisitEpoch((epoch) => epoch + 1);
    }, [active, captureOutgoingFrame, consumeFailedRouteIfNeeded, clearActiveBranch]);

    // --- GEOMETRY ---
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

    // 1️⃣ Create Ref for the global audio
    const globalAudioRef = useRef<HTMLAudioElement>(null);    // 2️⃣ Decide what URL to loop (Use prop or fallback to mainSrc)
    // Note: If you want it to be truly continuous, pick one static URL. 
    // If you use props.mainAudioUrl, it might change per node. 
    // Ideally, define a const or use the root node's audio.
    const GLOBAL_BG_SRC = props.feedDataMainAud;




    const IS_IPHONE_OR_SAFARI = (() => {
        const ua = navigator.userAgent || ""; const vendor = navigator.vendor || "";
        const isIPhone = /iPhone|iPod/i.test(ua);
        return isIPhone || (/Safari/i.test(ua) && /Apple/i.test(vendor) && !/(CriOS|Chrome|Edg|OPR|Opera|FxiOS|Firefox)/i.test(ua));
    })();

    // ✅ Check array length for logic (ROBUST CHECK for ALL sources)
    const checkAudio = (url: any) => Array.isArray(url)
        ? (typeof url[0] === 'string' && url[0].length > 0)
        : (typeof url === 'string' && url.length > 0);

    const hasMainSnippet = checkAudio(mainAudioUrl);
    const branchHasSnippet: Record<BranchId, boolean> = {
        left: checkAudio(branchAudioUrls.left),
        right: checkAudio(branchAudioUrls.right),
        top: checkAudio(branchAudioUrls.top),
        bottom: checkAudio(branchAudioUrls.bottom),
    };

    const wantsAnyVideoAudio = !hasMainSnippet || BRANCH_IDS.some((branch) => !branchHasSnippet[branch]);

    // --- UTILS ---
    const handleBack = useCallback(() => {
        dispatchHold({ type: "ABORT" });
        // Stage 6C: capture BEFORE clearActiveBranch() rewinds the branches — see
        // goHome. Guarded on the same condition as the navigation below so a Back
        // press at the root does not raise a transition it will never resolve.
        if (nodeStack.length > 0) {
            captureOutgoingFrame(active ? subRefs[active].current : mainRef.current);
        }
        clearActiveBranch();
        consumeFailedRouteIfNeeded("handleBack");
        if (nodeStack.length > 0) {
            setNodeStack(prev => {
                const next = [...prev];
                next.pop();
                return next;
            });
            setNodeVictoryStack(prev => {
                const next = [...prev];
                next.pop();
                return next;
            });
            setVisitEpoch((epoch) => epoch + 1);
        } else {
            props.backToEdit();
        }
    }, [nodeStack, props.backToEdit, active, captureOutgoingFrame, consumeFailedRouteIfNeeded, clearActiveBranch]);

    const tryPlay = useCallback(async (el?: HTMLMediaElement | null) => {
        if (!el) return false; try { await el.play(); return true; } catch { return false; }
    }, []);

    const pauseAllAudios = useCallback(() => {
        [mainAudioRef.current, ...BRANCH_IDS.map((branch) => branchAudioRefs[branch].current)].forEach((a) => { try { a?.pause(); } catch { } });
    }, []);

    useEffect(() => { pauseAllAudiosRef.current = pauseAllAudios; }, [pauseAllAudios]);

    const muteVideo = (el: HTMLVideoElement | null | undefined, muted: boolean) => {
        if (!el) return; try { el.muted = muted; if (!muted) el.volume = 1; } catch { }
    };

    const NEAR_END_DELTA = 0.08;
    const END_EPS = 0.01;

    function playableEnd(v: HTMLVideoElement): number {
        const d = Number.isFinite(v.duration) ? v.duration : 0; if (d > 0) return d;
        const len = v.seekable?.length ?? 0; return len > 0 ? v.seekable.end(len - 1) : 0;
    }

    const hsById = useMemo(() => ({
        left: hotspots[0],
        right: hotspots[1],
        top: hotspots[2],
        bottom: hotspots[3],
    }) as Record<BranchId, Hotspot>, [hotspots]);

    // --- EFFECTS ---

    // 1. Reset State on Navigation & Play Entrance Audio
    useEffect(() => {
        // ✅ Choices are cleared on EVERY arrival, before the media guards below.
        //
        // Those guards exist to stop this effect touching media a Hold or Drag
        // owns — a real and load-bearing rule. But returning early also skipped
        // this line, so arriving somewhere a Hold arms immediately could carry a
        // stale `true` in from the PREVIOUS visit. The engine then believes
        // choices are up while the video sits at frame 0 waiting for a press,
        // which puts the DRAG circle on screen over an unplayed hold scene.
        //
        // Clearing a visibility flag touches no media, so it is safe here and
        // wrong anywhere else.
        setShowHotspots(false);
        isShowingRef.current = false;

        // A live Hold owns the media; nothing below may run, including the resets.
        if (holdActive) return;
        // Same for a live Drag: the action clip advances only under the finger.
        // Read through a ref, deliberately NOT a dependency — see above.
        if (dragHoldsMediaRef.current) return;

        isShowingRef.current = false;
        setActive(null);
        // ✅ FIX: Reset loaded states so Media component knows to wait
        setMainLoaded(false);
        setBranchLoadedState({ left: false, right: false, top: false, bottom: false });


        // ✅ NEW: Auto-play Main Audio on Entrance (Just Once)
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
                    await tryPlay(mv); // ✅ Force play in case it was paused
                }
            }
        };

        // Small timeout to ensure DOM is ready and previous state cleared
        const t = setTimeout(playEntranceAudio, 50);
        return () => clearTimeout(t);

        // ✅ Keyed on visitKey, not currentId — a self-loop keeps the same id and
        // would otherwise reset nothing.
    }, [visitKey, currentId, audioEnabled, hasMainSnippet, pauseAllAudios, tryPlay, holdActive]);

    // 2. Audio Watchdog (Self-Healing)
    useEffect(() => {
        const interval = setInterval(() => {
            // NOTE: this whole body is currently unreachable — isBgMode is
            // useState(true) and setIsBgMode is never called. Gated anyway: a
            // paused Hold-controlled destination satisfies every other condition,
            // so wiring up setIsBgMode later would silently resume released holds.
            if (holdActive) return;
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
    }, [active, showHotspots, audioEnabled, isBgMode, hasMainSnippet, holdActive]);

    // 3. Geometry Only (REMOVED AGGRESSIVE PRELOAD TO FIX DOUBLE-PLAY)
    useEffect(() => {
        const bump = () => setLayoutVersion((v) => v + 1);
        window.addEventListener("resize", bump);
        const m = mainRef.current;
        // The enclosing InteractInput fits itself after metadata loads. That
        // changes the container without a window resize and can happen after
        // the startup poll has ended, especially on a cold fullscreen visit.
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(bump) : null;
        if (m) { observer?.observe(m); if (m.parentElement) observer?.observe(m.parentElement); }

        const retryInt = observer ? null : setInterval(bump, 200);
        const stopRetry = retryInt === null ? null : setTimeout(() => clearInterval(retryInt), 1200);

        // 🛑 REMOVED THE CONFLICTING PRELOAD LOOP HERE
        // The child component TouchPreviewMedia now handles loading perfectly.
        // The old code that was here (el.load()...) caused the "Double Play" glitch.

        m?.addEventListener("loadedmetadata", bump);
        return () => {
            window.removeEventListener("resize", bump);
            observer?.disconnect();
            m?.removeEventListener("loadedmetadata", bump);
            if (retryInt !== null) clearInterval(retryInt);
            if (stopRetry !== null) clearTimeout(stopRetry);
        };
    }, [visitKey]);


    const recomputeGeom = useCallback(() => {
        const main = mainRef.current; const container = main?.parentElement as HTMLElement | null;
        if (!main || !container) { geomRef.current = null; return; }
        const { dispW, dispH, offX, offY, cw, ch } = getDisplayedVideoRect(container, main);
        const clampPx = Math.min(Math.max(0.08 * window.innerWidth, 56), 88);
        const mk = (hs: Hotspot) => {
            const lensDiamPx = Math.max(hs.r * cw, clampPx) * (matchMobile ? 1.65 : 1.3);
            // ✅ FIX: Use displayed video rect (dispW/H + offsets) to account for black bars
            const centerX = offX + (hs.x * dispW);
            const centerY = offY + (hs.y * dispH);
            return { centerX, centerY, lensDiamPx };
        };
        const next = { dispW, dispH, offX, offY, cw, ch, ...Object.fromEntries(BRANCH_IDS.map((branch) => [branch, mk(hsById[branch])])) };
        if (JSON.stringify(geomRef.current) !== JSON.stringify(next)) {
            geomRef.current = next;
            // Updating only the ref left rendered hotspots one measurement
            // behind until another click happened to cause a render.
            setLayoutVersion(value => value + 1);
        }
    }, [hsById]);

    useLayoutEffect(() => { recomputeGeom(); }, [recomputeGeom, layoutVersion]);


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

        isShowingRef.current = true;
        try { main.pause(); } catch { }

        const end = playableEnd(main);
        const target = Math.max(0, (isFinite(end) ? end : main.duration || 0) - NEAR_END_DELTA);

        const afterSeek = () => {
            main.removeEventListener("seeked", afterSeek);
            requestAnimationFrame(() => {
                pauseAllAudios();
                muteVideo(main, true);
                setShowHotspots(true);
                setTimeout(() => { suppressEndHooksRef.current = false; }, 150);
            });
        };
        try { main.addEventListener("seeked", afterSeek); main.currentTime = target; } catch { afterSeek(); }
    }, [pauseAllAudios]);


    /**
     * Snap-back landing. `showHotspotsAtEnd` already does the work — seek to
     * playableEnd - NEAR_END_DELTA, pause, mute, reveal the choices — so this
     * only has to fire it at the right moment.
     *
     * It waits on the ELEMENT, not on `mainLoaded`: that state is still stale
     * from the previous node on the arrival commit, and firing early means
     * seekable is empty, playableEnd() returns 0 and the seek lands on frame 0.
     */
    useEffect(() => {
        if (landOnEndFrameRef.current !== currentId) { landOnEndFrameRef.current = null; return; }

        // This node may also be a hold scene. Landing on the end frame IS a
        // finished hold, so claim the visit with Hold's own "already armed or
        // finished this visit" latch (line ~1630) instead of letting it arm a
        // fresh session that pins main back at zero. No Hold code changes.
        armedVisitRef.current = visitKey;

        const main = mainRef.current;
        if (!main) return;

        const land = () => {
            if (landOnEndFrameRef.current !== currentId) return;
            if (main.readyState < 2 || !isFinite(main.duration) || main.duration <= 0) return;
            landOnEndFrameRef.current = null;
            main.removeEventListener("loadeddata", land);
            main.removeEventListener("canplay", land);
            main.removeEventListener("durationchange", land);
            showHotspotsAtEnd();
            setIsTransitioning(false);
        };

        land();
        main.addEventListener("loadeddata", land);
        main.addEventListener("canplay", land);
        main.addEventListener("durationchange", land);
        return () => {
            main.removeEventListener("loadeddata", land);
            main.removeEventListener("canplay", land);
            main.removeEventListener("durationchange", land);
        };
    }, [currentId, visitKey, showHotspotsAtEnd, setIsTransitioning]);

    /**
     * Loop jump. Replaces the navigation stack with the destination's canonical
     * stack rather than pushing onto it, so no fake history like
     * Root → Fail → Root → Fail accumulates and manual Back stays predictable.
     */
    const performLoopJump = useCallback((entry: NodeIndexEntry, reason: string) => {
        if (jumpingRef.current) return;
        jumpingRef.current = true;
        dispatchHold({ type: "ABORT" });

        // 1. Record the failed route FIRST, while currentNode / active / victory
        //    still describe the route being left. The detector self-gates, so a
        //    victory route or a forward jump from root will not increment.
        consumeFailedRouteIfNeeded(reason);

        // 2. Dimmed snapshot covers the source swap.
        captureOutgoingFrame(active ? subRefs[active].current : mainRef.current);

        // 3. Silence and stop everything on the outgoing node.
        clearAutoLoopTimer();
        suppressEndHooksRef.current = true;
        nearEndArmedRef.current = false;
        try { mainRef.current?.pause(); } catch { }
        BRANCH_IDS.forEach((branch) => { try { subRefs[branch].current?.pause(); } catch { } });
        pauseAllAudios();

        setActive(null);
        setSubEnded(false);
        setShowHotspots(false);
        isShowingRef.current = false;
        setIsAutoPlayTimerActive(false);

        // 4. Every jump replays its destination from zero — hotspot loops, auto
        //    loops and drag snap-backs alike. Landing on a frozen end-frame
        //    reads as a glitch; a full replay makes even a self-sustaining loop
        //    play like a slideshow.
        //
        //    A snap-back was briefly made an exception, on the theory that the
        //    armed Stick stopped the frame reading as dead. It did not. Being
        //    dropped onto a still after a failed attempt breaks the fiction and
        //    leaves the viewer staring at a frozen image. Replaying the scene is
        //    what keeps them in it: the warrior winds up again, and the next
        //    swing is a real decision rather than a retry on a paused screen.
        //    There are now NO exceptions. Do not reintroduce one.

        // 5. Replace both parallel stacks. The destination must NOT inherit the
        //    source route's victory value or failure detection would be suppressed.
        const stack = buildStackForPath(rootNode, entry.path);
        setNodeStack(stack);
        setNodeVictoryStack(stack.map(() => false));
        setVisitEpoch((epoch) => epoch + 1);

        setTimeout(() => {
            suppressEndHooksRef.current = false;
            jumpingRef.current = false;
        }, 500);
    }, [active, consumeFailedRouteIfNeeded, pauseAllAudios, rootNode, captureOutgoingFrame, clearAutoLoopTimer]);

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
                    // Only the autoPlay VIDEO pre-snapshots, because it cuts on the
                    // exact frame. An auto-loop holds on the last frame for a beat
                    // first, so an early dimmed snapshot would sit there visibly
                    // for the whole hold — it takes its own snapshot when it jumps.
                    // hasChoices, not hasActiveHotspots: a capture node with a
                    // Stick is not about to auto-continue, so it must not
                    // pre-capture a transition snapshot either.
                    const willAutoContinue = isAutoPlayNode && !hasChoices;

                    if (willAutoContinue) {
                        // PRE-TRANSITION: Snapshot canvas early so swap is seamless.
                        // `main` is correct here rather than the visible-element
                        // form: this path only runs from main's own ended/near-end
                        // handler, where no branch is active.
                        if (!isTransitioning) captureOutgoingFrame(main);
                    } else if (!showHotspots && active === null) {
                        setShowHotspots(true);
                    }
                } else {
                    // ✅ CRITICAL FIX: If time is < duration (e.g. looped back to start), HIDE hotspots
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
    }, [visitKey, showHotspots, active, currentNode, isTransitioning, captureOutgoingFrame, autoLoopEntry]);

    /**
     * Everything that happens when a node's main video finishes: auto-loop,
     * autoplay continuation, or reveal the choices.
     *
     * Extracted so it runs exactly once from exactly one place, whether the video
     * ended on its own or ended under a Hold and had to wait for the finger to lift.
     * Two competing `ended` listeners is what produced the double completion.
     */
    const runNodeCompletion = useCallback((fromHoldRoute = false) => {
        if (manualRestartingRef.current || suppressEndHooksRef.current) return;

        const isAutoPlayNode = !!(currentNode.autoPlaySrc && currentNode.children?.autoPlay);

        // ✅ A lane action clip that finished with no payoff. The viewer held
        // successfully and watched it through — a finished thread — so it gets
        // the last-frame beat and then the drag node FROM ZERO, like ordinary
        // navigation. Only a snap-back lands on an end frame.
        //
        // An authored history link wins over this: explicit beats implicit, and
        // it is the reason a lane action node may hold one at all.
        if (dragEntry && !isAutoPlayNode && !autoLoopEntry && !hasActiveHotspots) {
            const origin = nodeIndex.get(dragEntry.parentNodeId);
            if (origin) {
                // Straight back, no last-frame hold. A beat on the final frame
                // was meant to let the ending land, but with no payoff there is
                // no ending to land — it just strands the viewer on a still.
                // Returning immediately puts the drag node back on screen and
                // the Stick back under their finger.
                clearAutoLoopTimer();
                performLoopJump(origin, `dragNoPayoff:${dragEntry.lane}`);
                return;
            }
        }

        // hasChoices, not hasActiveHotspots. A capture node's DRAG circle is a
        // choice, so an auto-continuation there must WAIT rather than cut — it
        // gets the ordinary 5-second window like any other node with choices.
        // Without this the circle never appeared and the lanes were unreachable.
        if (autoLoopEntry && !hasChoices) {
            // Hold on the final frame for a beat first. Without it a chain of
            // auto-loops cuts the instant each video ends, which reads as a
            // jump rather than a sequence.
            clearAutoLoopTimer();
            autoLoopTimerRef.current = setTimeout(() => {
                autoLoopTimerRef.current = null;
                performLoopJump(autoLoopEntry, "autoLoop:ended");
            }, AUTO_LOOP_HOLD_MS);
        } else if (isAutoPlayNode && !hasChoices) {
            // EXACT END: Push the next node for a seamless cut
            suppressEndHooksRef.current = true;
            setNodeStack(prev => [...prev, currentNode.children!.autoPlay!]);
            setNodeVictoryStack(prev => [...prev, !!currentNode.autoPlayIsVictory]);
            setTimeout(() => { suppressEndHooksRef.current = false; }, 500);
        } else if (fromHoldRoute) {
            // Finishing a Hold IS the viewer's action, so a scene with nothing to
            // decide should not stop and ask them to press again. With exactly one
            // onward route, take it; with several, they must choose.
            //
            // A single route that is ITSELF a Hold still needs the press — you
            // cannot hold something automatically — so it falls through to the
            // ordinary reveal and waits for a finger.
            const onward = BRANCH_IDS.filter(
                (branch) => resolveBranchDestination(nodeIndex, currentNode, branch).kind !== "none"
            );
            const only = onward.length === 1 ? onward[0] : null;
            const onlyIsHold = only
                ? currentNode.hotspots[BRANCH_INDEX[only]]?.holdToPlay === true
                : false;

            if (only && !onlyIsHold) {
                playSubRef.current(only);
            } else {
                showHotspotsAtEnd();
            }
        } else {
            showHotspotsAtEnd();
        }
    }, [currentNode, hasActiveHotspots, autoLoopEntry, performLoopJump, clearAutoLoopTimer, showHotspotsAtEnd, nodeIndex, dragEntry]);

    useEffect(() => { runNodeCompletionRef.current = runNodeCompletion; }, [runNodeCompletion]);

    // 3. On Ended Handler (Main Video)
    useEffect(() => {
        const main = mainRef.current; if (!main) return;
        const onEnded = () => {
            // ⚠ ORDER MATTERS. The holdOwnsMain check below must NOT come first.
            //
            // holdControlledMedia returns "main" for a drag session as well as a
            // Hold — that is how drag reuses the ownership gate — so holdOwnsMain
            // is true during a drag. Checking it first swallowed the action
            // clip's own `ended`, runNodeCompletion never ran, and the payoff
            // never fired. That was the "I hold to the end and nothing happens".

            // ✅ A Drag reaching its own end IS the win. There is no commit
            // threshold: holding to the end is the whole test, so this is the
            // only success signal — and it is end-of-video detection, which
            // means clip length never matters.
            if (dragIsEngaged(dragSession)) {
                console.log("[Drag] WON — held to the end");
                // The finger is still down. Stamp before navigating so the
                // release that follows cannot read as a tap on the destination.
                suppressNextTapRef.current = true;
                dispatchDrag({ type: "MEDIA_ENDED", sessionId: dragSession!.sessionId });
                runNodeCompletion();
                return;
            }
            // Already won and waiting for the release: completion has run.
            if (dragAwaitingRelease(dragSession)) return;

            // A Hold route defers its completion until the finger lifts, so this
            // must not also run — see finalizeHoldRoute.
            if (holdOwnsMain) return;

            runNodeCompletion();
        };
        main.addEventListener("ended", onEnded);
        return () => {
            main.removeEventListener("ended", onEnded);
            clearAutoLoopTimer();
        };
    }, [runNodeCompletion, clearAutoLoopTimer, holdOwnsMain, dragSession, dispatchDrag]);

    // 4. Time-based Hotspot Auto-Play Logic
    useEffect(() => {
        const isAutoPlayNode = !!(currentNode.autoPlaySrc && currentNode.children?.autoPlay);

        console.log("⏳ [HotspotCatcher] Eval -> showHotspots:", showHotspots, "| isAutoPlayNode:", isAutoPlayNode, "| hasActiveHotspots:", hasActiveHotspots, "| active:", active);
        console.log("⏳ [HotspotCatcher] Nodes -> autoPlaySrc:", !!currentNode.autoPlaySrc, "| children.autoPlay exists:", !!currentNode.children?.autoPlay);

        // ✅ An auto-loop counts as an end-of-scene continuation exactly like an
        // autoPlay video: choices appear first and get the 5-second window.
        const hasAutoContinuation = isAutoPlayNode || Boolean(autoLoopEntry);

        // Suspended entirely while a Hold session owns media, and while completed
        // choices are still disabled — the viewer has not had their reaction window.
        // Also suspended for a live Drag: the viewer is mid-gesture and an
        // autoplay cut underneath them would steal the attempt.
        if (holdSession || dragSession || !choicesEnabled) {
            setIsAutoPlayTimerActive(false);
            return;
        }

        // hasChoices: the window is the viewer's chance to act, and on a capture
        // node the Stick is something to act with.
        if (showHotspots && hasAutoContinuation && hasChoices && active === null) {
            console.log("⏳ [HotspotCatcher] STARTING 5-SECOND TIMER");
            setIsAutoPlayTimerActive(true);
            const timerId = setTimeout(() => {
                if (autoLoopEntry) {
                    console.log("⏳ [HotspotCatcher] TIMER FINISHED - Auto-looping to", autoLoopEntry.label);
                    setIsAutoPlayTimerActive(false);
                    performLoopJump(autoLoopEntry, "autoLoop:timer");
                    return;
                }

                console.log("⏳ [HotspotCatcher] TIMER FINISHED - Transitioning to AutoPlay!");
                suppressEndHooksRef.current = true;

                // Transition snapshot. The autoplay timer only fires while main
                // owns the screen, so main is the visible element here.
                captureOutgoingFrame(mainRef.current);

                setNodeStack(prev => [...prev, currentNode.children!.autoPlay!]);
                setNodeVictoryStack(prev => [...prev, !!currentNode.autoPlayIsVictory]);
                setTimeout(() => { suppressEndHooksRef.current = false; }, 500);
                setIsAutoPlayTimerActive(false);
            }, choiceWindowMs(holdWindowPending));

            return () => {
                console.log("⏳ [HotspotCatcher] Timer CLEARED");
                clearTimeout(timerId);
                setIsAutoPlayTimerActive(false);
            };
        } else {
            setIsAutoPlayTimerActive(false);
        }
    }, [showHotspots, currentNode, active, captureOutgoingFrame, autoLoopEntry, performLoopJump, holdSession, dragSession, choicesEnabled, holdWindowPending]);


    // --- ACTIONS ---

    const onExitSub = useCallback((branch: BranchId) => {
        consumeFailedRouteIfNeeded(`onExitSub:${branch}`);
        const sub = subRefs[branch].current;
        // Stage 6C: pause now, but do NOT rewind here. This element is still fully
        // opaque and about to fade out — resetting currentTime would snap it to its
        // first frame and play that jump in full view. The rewind now happens in
        // the branch's own `onTransitionEnd` once it has actually reached opacity
        // 0, which is both correctly timed and safe if the user reopens the branch
        // mid-fade (a timer would have fired into live playback and reset it).
        if (sub) sub.pause();
        setActive(null);
        setSubEnded(false);
        pauseAllAudios();
        if (mainRef.current) muteVideo(mainRef.current, true);
        setShowHotspots(true);
        setTimeout(() => showHotspotsAtEnd(), 0);
    }, [consumeFailedRouteIfNeeded, pauseAllAudios, showHotspotsAtEnd]);

    useEffect(() => {
        const listeners = BRANCH_IDS.map((branch) => {
            const element = subRefs[branch].current;
            const handleEnd = () => {
                if (active === branch) setSubEnded(true);
            };
            element?.addEventListener("ended", handleEnd);
            return { element, handleEnd };
        });

        return () => {
            listeners.forEach(({ element, handleEnd }) => element?.removeEventListener("ended", handleEnd));
        };
    }, [active, visitKey]);


    const restartMainFromZero = useCallback(async () => {
        const main = mainRef.current; if (!main) return;
        manualRestartingRef.current = true; suppressEndHooksRef.current = true; nearEndArmedRef.current = false;
        setShowHotspots(false); isShowingRef.current = false;
        BRANCH_IDS.forEach((branch) => { try { subRefs[branch].current?.pause(); } catch { } });
        setActive(null); pauseAllAudios();
        try { main.pause(); main.currentTime = 0; } catch { }
        if (audioEnabled) { if (hasMainSnippet) { await tryPlay(mainAudioRef.current); muteVideo(main, true); } else { muteVideo(main, false); } } else { muteVideo(main, true); }
        await tryPlay(main);
        setTimeout(() => { suppressEndHooksRef.current = false; manualRestartingRef.current = false; nearEndArmedRef.current = true; }, 800);
    }, [audioEnabled, hasMainSnippet, tryPlay]);

    const jumpToPrePause = useCallback(() => { stoppedAfterTwoRef.current = false; loopsRef.current = 0; restartMainFromZero(); }, [restartMainFromZero]);

    // --- HOLD TO PLAY: media control ---

    /** The element this session owns, resolved fresh each time (it is remounted). */
    const holdControlledElement = useCallback((): HTMLVideoElement | null => {
        if (!holdSession) return null;
        return holdSession.targetKind === "sub"
            ? subRefs[holdSession.branch].current
            : mainRef.current;
    }, [holdSession]);

    const holdRouteAudio = useCallback((): HTMLAudioElement | null => {
        if (!holdSession) return null;
        return holdSession.targetKind === "sub"
            ? branchAudioRefs[holdSession.branch].current
            : mainAudioRef.current;
    }, [holdSession]);

    /**
     * Hard lock on the controlled element.
     *
     * Gating individual call sites does not work: this file and TouchPreviewMedia
     * start playback from a dozen places between them (tap handlers, priming,
     * watchdogs, audio effects, exit handlers), and missing any single one shows up
     * as "it plays again the moment I let go". Rather than keep hunting them, the
     * element's own play() is replaced for the lifetime of the session, so ONLY the
     * controller below can start it. Anything else is logged and ignored.
     *
     * The native method is kept here and restored on teardown.
     */
    // Drives the actual element from the reducer phase. Every play()/pause() for
    // hold-controlled media happens here and nowhere else.
    useEffect(() => {
        const video = holdControlledElement();
        if (!video) return;
        const audio = holdRouteAudio();

        // Visibility in TouchPreviewMedia is opacity: mainLoaded ? (active ? 0 : 1) : 0
        // for main, and active === branch && branchLoaded for a sub. Audio without a
        // picture means one of those is wrong, so log them alongside the phase.
        console.log("[Hold] control:", holdSession?.phase,
            "el=", holdSession?.targetKind === "sub" ? `sub:${holdSession?.branch}` : "main",
            "t=", video.currentTime.toFixed(2), "paused=", video.paused, "ended=", video.ended,
            "| VISIBILITY -> mainLoaded=", mainLoaded, "active=", active,
            "branchLoaded=", JSON.stringify(branchLoaded),
            "readyState=", video.readyState, "hasSrc=", Boolean(video.currentSrc || video.src),
            "node=", currentId, "visit=", visitKey);

        // The transition snapshot is normally cleared by the main video's `playing`
        // event. A Hold destination is deliberately NOT played on arrival, so that
        // never fires and the snapshot stays over everything at zIndex 15 — the
        // scene appears frozen and dimmed, with the control hidden beneath. Since
        // Stage 6A the main video is also pinned to opacity 0 while isTransitioning,
        // so this hatch is what makes a Hold destination visible at all.
        // Once the controlled element has data, the transition is over.
        if (video.readyState >= 2) setIsTransitioning(false);

        // Finished and waiting for the release: touch nothing. Pausing would fight
        // the frozen final frame, playing would restart it.
        if (holdAwaitingRelease(holdSession)) return;

        if (holdIsPlaying(holdSession)) {
            // Unmuting is NOT the gate's job. Every path in TouchPreviewMedia that
            // would normally unmute is disabled while Hold owns the element, so if
            // this does not set the mute state the route plays silently.
            // Ask the SAME question the rest of the app asks — is there a real
            // audio URL for this route — instead of reading .src off the element.
            // A child node inherits audio.main from its parent's branch audio, so
            // the element can exist with nothing useful in it; trusting .src then
            // muted the video and played silence.
            const routeHasOwnTrack = holdSession?.targetKind === "sub"
                ? branchHasSnippet[holdSession.branch]
                : hasMainSnippet;
            const usesSeparateTrack = Boolean(routeHasOwnTrack && audio);
            if (usesSeparateTrack && audio) {
                // Keep external audio with the video. Drift accumulates across
                // pause/resume cycles, so realign when it exceeds a small tolerance.
                if (Math.abs(audio.currentTime - video.currentTime) > 0.25) {
                    try { audio.currentTime = video.currentTime; } catch { }
                }
                audio.muted = Boolean(MuteReducer);
                muteVideo(video, true); // silence the embedded track, the file carries it
                audio.play().catch(() => { });
            } else {
                // MuteReducer alone, matching attemptUnmuteAndPlay. audioEnabled is
                // only set by tapping the video body, and the speaker hint that would
                // otherwise set it can never appear (videoPlaying is never assigned),
                // so keying on it here could mute a route with no way to un-mute it.
                muteVideo(video, Boolean(MuteReducer));
            }
            video.play().catch(() => { });
        } else {
            try { video.pause(); } catch { }
            try { audio?.pause(); } catch { }
        }
    }, [holdSession, holdControlledElement, holdRouteAudio, MuteReducer, setIsTransitioning,
        hasMainSnippet, branchHasSnippet.left, branchHasSnippet.right, branchHasSnippet.top, branchHasSnippet.bottom]);

    /**
     * Readiness report from TouchPreviewMedia. Accepted only when both the session
     * and the mount match — after a child/loop remount the old element may still
     * fire, and acting on it would seek a destroyed node's video.
     */
    const onHoldMediaReady = useCallback((info: { sessionId: number; visitKey: string | null; controlledMedia: "main" | BranchId }) => {
        // One handshake, two owners. Only one of them can hold the element at a
        // time — holdControlledMedia is a single slot — so the live session is
        // unambiguous.
        if (holdSessionRef.current) {
            dispatchHold({ type: "MEDIA_READY", sessionId: info.sessionId, visitKey: info.visitKey });
            return;
        }
        console.log("[Drag] MEDIA READY session=", info.sessionId, "visit=", info.visitKey);
        dispatchDrag({ type: "MEDIA_READY", sessionId: info.sessionId, visitKey: info.visitKey });
    }, [dispatchDrag]);

    // First activation seeks to zero exactly once; resuming must never seek.
    // Keyed on the session, NOT on currentTime: a sub element is not remounted
    // for a sub route, so it can still hold a stale position from a previous
    // play — which is exactly the case that needs the seek.
    const seekedSessionRef = useRef<number | null>(null);
    useEffect(() => {
        if (!holdSession || !holdSession.hasStartedAtZero) return;
        if (seekedSessionRef.current === holdSession.sessionId) return;
        const video = holdControlledElement();
        if (!video) return;
        seekedSessionRef.current = holdSession.sessionId;
        try { video.currentTime = 0; } catch { }
    }, [holdSession?.sessionId, holdSession?.hasStartedAtZero, holdControlledElement]);

    /** Completion of hold-controlled media. Owns `ended` before the normal logic. */
    useEffect(() => {
        if (!holdSession) return;
        const video = holdControlledElement();
        if (!video) return;
        const sessionId = holdSession.sessionId;
        const wasReleased = holdSession.pointerId === null;
        const onEnded = () => {
            dispatchHold({ type: "MEDIA_ENDED", sessionId });
            // Already released: the reducer clears the session outright, and the
            // ordinary ended handler skipped because ownership still existed when
            // it fired. Nothing else will run completion, so do it here.
            if (wasReleased) runNodeCompletionRef.current();
        };
        video.addEventListener("ended", onEnded);
        return () => video.removeEventListener("ended", onEnded);
    }, [holdSession?.sessionId, holdSession?.pointerId, holdControlledElement]);

    /**
     * Arriving at a hold scene by any route other than pressing its hotspot —
     * Back, Home, a loop, an auto-loop — arms the session on arrival instead.
     *
     * The video sits frozen at zero with the same control, in the same place, as
     * the hotspot that leads here. Press it and it plays exactly as it did the
     * first time. Nothing is remembered between visits; the entry is derived from
     * the tree, so this is identical for every viewer and correct on first arrival.
     */
    useEffect(() => {
        if (holdSession) {
            // A session already exists for this visit — either the viewer pressed the
            // hotspot to get here, or this effect armed it. Mark the visit consumed
            // NOW, so that when the session ends we do not immediately arm a fresh
            // one on the same node: that re-armed session seeks back to zero and the
            // scene plays a second time.
            armedVisitRef.current = visitKey;
            return;
        }
        if (armedVisitRef.current === visitKey) return; // already armed or finished this visit

        const entry = holdEntryMap.get(currentId);
        if (!entry) return;

        armedVisitRef.current = visitKey;

        dispatchHold({
            type: "START_SESSION",
            sessionId: ++holdSessionIdRef.current,
            sourceNodeId: currentId,
            branch: entry.branch,
            targetKind: "child",          // controls this node's main video
            pointerId: null,              // nothing is held yet: it waits, paused at zero
            controller: entry.controller,
            expectedVisitKey: visitKey,
        });
    }, [holdSession, holdEntryMap, currentId, visitKey]);

    // Backgrounding or losing focus must not leave a held video running.
    useEffect(() => {
        const pause = () => dispatchHold({ type: "PAUSE_EXTERNAL" });
        const onVisibility = () => { if (document.hidden) pause(); };
        window.addEventListener("blur", pause);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("blur", pause);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    /**
     * Release is owned by the WINDOW for the life of the session, matched on the
     * pointer that started it.
     *
     * Element-level release cannot work here: a child or loop route unmounts the
     * hotspot that captured the pointer, so the release lands on nothing and the
     * unmount itself fires lostpointercapture. Listening globally means it no
     * longer matters which element is mounted, or which one believes it is the
     * controller.
     */
    const releaseHoldRef = useRef<(pointerId: number | null) => void>(() => { });
    useEffect(() => {
        if (!holdSession) return;
        const sessionPointerId = holdSession.pointerId;
        if (sessionPointerId === null) return; // keyboard sessions release on keyup

        let releaseTimer: ReturnType<typeof setTimeout> | null = null;

        const onPointerUp = (event: PointerEvent) => {
            if (event.pointerId !== sessionPointerId) return;
            // This physical release belongs exclusively to the active Hold
            // controller. Keep the session (and therefore choicesEnabled=false)
            // through the browser's trailing click, then finalize immediately
            // after the pointerup/click event sequence has finished. That click
            // can no longer land as a fresh activation on an ordinary hotspot.
            event.preventDefault();
            event.stopPropagation();
            const pointerId = event.pointerId;
            releaseTimer = setTimeout(() => {
                releaseTimer = null;
                releaseHoldRef.current(pointerId);
            }, 0);
        };
        const onPointerCancel = (event: PointerEvent) => {
            if (event.pointerId !== sessionPointerId) return;
            // Completion-aware: a cancel on a finished route must finalize it, not
            // leave it owning the media forever.
            event.preventDefault();
            event.stopPropagation();
            releaseHoldRef.current(event.pointerId);
        };

        // Capture phase: a release must be observed even if something between the
        // target and the window stops propagation.
        window.addEventListener("pointerup", onPointerUp, true);
        window.addEventListener("pointercancel", onPointerCancel, true);
        return () => {
            if (releaseTimer) clearTimeout(releaseTimer);
            window.removeEventListener("pointerup", onPointerUp, true);
            window.removeEventListener("pointercancel", onPointerCancel, true);
        };
    }, [holdSession?.sessionId, holdSession?.pointerId, holdSession?.phase]);

    /**
     * Begin a hold route. START_SESSION is dispatched BEFORE the navigation state
     * change, in the same React event, so the destination's very first render
     * already carries the gate — otherwise the freshly mounted media autoplays
     * before the gate arrives.
     */
    const beginHold = useCallback((branch: BranchId, pointerId: number | null) => {
        if (holdSession) {
            dispatchHold({ type: "PRESS", sessionId: holdSession.sessionId, pointerId });
            return;
        }

        const hotspot = currentNode.hotspots[BRANCH_INDEX[branch]];
        const destination = resolveBranchDestination(nodeIndex, currentNode, branch);
        if (destination.kind === "none") return;

        hideHUDTemporarily();
        clearAutoLoopTimer();
        setIsAutoPlayTimerActive(false);
        pauseAllAudios();
        try { mainRef.current?.pause(); } catch { }

        const sessionId = ++holdSessionIdRef.current;
        const controller = controllerFromHotspot(hotspot);

        if (destination.kind === "sub") {
            // Terminal sub: no navigation, so the element already exists and the
            // mount it lives under is the current one.
            setShowHotspots(false);
            isShowingRef.current = false;
            setSubEnded(false);
            setActive(branch);
            BRANCH_IDS.forEach((b) => muteVideo(subRefs[b].current, true));
            const sub = subRefs[branch].current;
            if (sub) { try { sub.currentTime = 0; } catch { } muteVideo(sub, !audioEnabled || branchHasSnippet[branch]); }
            // No MEDIA_READY here: readiness is reported by TouchPreviewMedia once
            // the sub element actually has data. Dispatching it synchronously would
            // ask the parent to play a cold video.
            dispatchHold({
                type: "START_SESSION", sessionId, sourceNodeId: currentId, branch,
                targetKind: "sub", pointerId, controller, expectedVisitKey: visitKey,
            });
            return;
        }

        // Stage 6C: child and loop remount the media, destroying the element the
        // user is looking at, so they need the same cover every other node change
        // gets. Captured here, before the stack mutation below and before
        // setActive(null) can retire the branch. The terminal-sub case above
        // returns early and deliberately takes no snapshot — both elements stay
        // mounted there, so branch opacity handles it. The Hold readyState >= 2
        // hatch releases this snapshot on arrival.
        captureOutgoingFrame(active ? subRefs[active].current : mainRef.current);

        // Compute the destination's visit key first so stale readiness reports
        // can be rejected.
        const nextEpoch = visitEpoch + 1;
        const destinationNode = destination.kind === "loop" ? destination.entry.node : destination.node;
        const expectedVisitKey = `${destinationNode.id}#${nextEpoch}`;

        dispatchHold({
            type: "START_SESSION", sessionId, sourceNodeId: currentId, branch,
            targetKind: destination.kind, pointerId, controller, expectedVisitKey,
        });

        setShowHotspots(false);
        isShowingRef.current = false;
        setActive(null);
        setSubEnded(false);

        if (destination.kind === "loop") {
            const stack = buildStackForPath(rootNode, destination.entry.path);
            consumeFailedRouteIfNeeded(`holdLoop:${branch}`);
            setNodeStack(stack);
            setNodeVictoryStack(stack.map(() => false));
        } else {
            const branchIsVictory = Boolean(hotspot.isVictory);
            setNodeStack((nodes) => [...nodes, destination.node]);
            setNodeVictoryStack((victories) => [...victories, branchIsVictory]);
        }
        // A self-loop keeps the same node id, so without this bump nothing
        // remounts and the destination never reloads.
        setVisitEpoch(nextEpoch);
    }, [holdSession, currentNode, currentId, nodeIndex, visitKey, visitEpoch, rootNode, audioEnabled, active,
        branchHasSnippet.left, branchHasSnippet.right, branchHasSnippet.top, branchHasSnippet.bottom,
        pauseAllAudios, clearAutoLoopTimer, consumeFailedRouteIfNeeded, hideHUDTemporarily, captureOutgoingFrame]);

    /**
     * Consumes the release that ends a completed Hold route. Clears the session,
     * re-enables the choices, arms the shortened reaction window, and hands off to
     * the ordinary completion path exactly once.
     */
    const finalizeHoldRoute = useCallback((pointerId: number | null) => {
        const finished = holdSession;
        if (!finished || finished.phase !== "completed-awaiting-release") return;

        dispatchHold({ type: "COMPLETE_RELEASED", pointerId });
        setHoldWindowPending(true);

        if (finished.targetKind === "sub") {
            // Terminal sub: the existing exit path owns failure detection and the
            // per-visit guard, so delegate rather than duplicating it.
            onExitSub(finished.branch);
        } else {
            runNodeCompletion(true);
        }
    }, [holdSession, onExitSub, runNodeCompletion]);

    const releaseHold = useCallback((pointerId: number | null) => {
        if (!holdSession) return;
        if (holdSession.phase === "completed-awaiting-release") {
            finalizeHoldRoute(pointerId);
            return;
        }
        dispatchHold({ type: "RELEASE", pointerId });
    }, [holdSession, finalizeHoldRoute]);

    useEffect(() => { releaseHoldRef.current = releaseHold; }, [releaseHold]);

    /* ------------------------------------------------------------------ *
     * Drag & Hold
     * ------------------------------------------------------------------ */

    /**
     * The one destination all three drag fallbacks share: back to the drag node
     * with the Stick armed. An empty lane, a snap-back and a committed lane with
     * no payoff all end here.
     */
    const dragOriginEntry = useCallback((originNodeId: string) =>
        nodeIndex.get(originNodeId), [nodeIndex]);

    /**
     * Lane locked. This NAVIGATES IMMEDIATELY — the 2.5s that follows is a
     * probation period on a push that has already happened, not a gate before
     * one.
     *
     * ENGAGE is dispatched BEFORE the navigation state change, in the same React
     * event, so the destination's first render already carries the ownership
     * gate. Otherwise the freshly mounted media autoplays before the gate
     * arrives — the same ordering rule beginHold documents.
     */
    const beginDrag = useCallback((lane: LaneId, pointerId: number | null) => {
        if (dragSession || jumpingRef.current) return;

        hideHUDTemporarily();
        clearAutoLoopTimer();
        setIsAutoPlayTimerActive(false);
        pauseAllAudios();
        try { mainRef.current?.pause(); } catch { }

        const destination = resolveLaneDestination(currentNode, lane);

        // An unauthored lane is not dead. It replays this node — which is what
        // makes a Drag & Hold node incapable of dead-ending under any authoring.
        if (destination.kind === "fallback") {
            const entry = nodeIndex.get(currentId);
            if (entry) performLoopJump(entry, `dragEmptyLane:${lane}`);
            return;
        }

        captureOutgoingFrame(mainRef.current);

        const sessionId = ++dragSessionIdRef.current;
        const nextEpoch = visitEpoch + 1;
        const actionNode = destination.node;

        dispatchDrag({
            type: "ENGAGE",
            sessionId,
            lane,
            pointerId,
            originNodeId: currentId,
            actionNodeId: actionNode.id,
            expectedVisitKey: `${actionNode.id}#${nextEpoch}`,
        });

        setShowHotspots(false);
        isShowingRef.current = false;
        setActive(null);
        setSubEnded(false);

        // Victory for a lane comes from the clicked edge, exactly like a hotspot.
        const laneIsVictory = Boolean(
            actionNode.hotspots?.[BRANCH_INDEX[lane]]?.isVictory
        );
        setNodeStack((nodes) => [...nodes, actionNode]);
        setNodeVictoryStack((victories) => [...victories, laneIsVictory]);
        setVisitEpoch(nextEpoch);

        // Wall clock from lane lock. Never accumulated from pointer events and
        // never paused for a buffering stall — every fumble costs a trial, so
        // the engine must not charge the viewer for its own dropped frames.
        console.log("[Drag] ENGAGE lane=", lane, "action=", actionNode.id,
            "expect=", `${actionNode.id}#${nextEpoch}`, "ptr=", pointerId);
    }, [dragSession, currentNode, currentId, nodeIndex, visitEpoch, performLoopJump,
        captureOutgoingFrame, pauseAllAudios, clearAutoLoopTimer, hideHUDTemporarily,
        dispatchDrag]);

    /**
     * Released before the probation elapsed.
     *
     * The clip stops and resets to zero, the viewer returns to the drag node on
     * its END FRAME with the Stick armed — the only end-frame landing in the
     * system — and the attempt is spent. Right direction, bad grip: they lose
     * the trial but not the time.
     */
    const snapBackDrag = useCallback(() => {
        const session = dragSession;
        if (!session || session.phase !== "engaged") return;

        settleStick();
        dispatchDrag({ type: "RELEASE", pointerId: session.pointerId });

        try {
            const main = mainRef.current;
            if (main) { main.pause(); main.currentTime = 0; }
        } catch { }

        console.log("[Drag] SNAPBACK lane=", session.lane,
            "· let go before the end · returning to", session.originNodeId);

        const entry = dragOriginEntry(session.originNodeId);
        if (!entry) {
            console.warn("[Drag] SNAPBACK has nowhere to go —", session.originNodeId, "not in index");
            return;
        }
        // An ordinary loop jump, with no special landing. The scene plays again
        // from the top and the viewer decides again — swing left and fail, watch
        // the wind-up, swing right and win. A still frame ends that.
        //
        // Consumes the failed route, as every jump does. The detector reads
        // currentNode — the ACTION node here — so the victory self-gate looks at
        // the right route with no special casing.
        // Land on the drag node's END FRAME: hotspots up, Stick armed.
        landOnEndFrameRef.current = entry.node.id;
        performLoopJump(entry, `dragSnapBack:${session.lane}`);
    }, [dragSession, dragOriginEntry, performLoopJump, settleStick, dispatchDrag]);

    /**
     * Any release.
     *
     * While engaged it abandons the attempt. After a win it merely discharges
     * the pending pointerup — the route already resolved when the clip ended.
     */
    const releaseDrag = useCallback((pointerId: number | null) => {
        if (!dragSession) return;
        settleStick();
        if (dragAwaitingRelease(dragSession)) {
            dispatchDrag({ type: "RELEASE", pointerId });
            return;
        }
        if (dragSession.pointerId !== null && dragSession.pointerId !== pointerId) return;
        snapBackDrag();
    }, [dragSession, snapBackDrag, settleStick, dispatchDrag]);

    const releaseDragRef = useRef(releaseDrag);
    useEffect(() => { releaseDragRef.current = releaseDrag; }, [releaseDrag]);

    /* --- The Stick's gesture ---------------------------------------------
     *
     * The Stick element is permanent — rendered outside the keyed fragment —
     * so setPointerCapture works properly and routes every move and release
     * back to it even when the finger leaves the circle. That is exactly what
     * a joystick wants, and it is only possible because the element survives
     * the navigation that locking a lane causes.
     */
    const stickPointerRef = useRef<number | null>(null);
    const stickStartXRef = useRef(0);
    const stickWidthRef = useRef(0);
    /**
     * pointermove keeps firing with the CLOSURE from the render that started
     * the gesture, where dragSession is still null — so a state check cannot
     * see the session it just created. A ref is read live.
     */
    const laneLockedRef = useRef(false);

    const onStickDown = useCallback((event: React.PointerEvent) => {
        event.stopPropagation();
        // A Stick press starts a new user-authorized Drag attempt. Snap-back
        // keeps its parent video silent on the end frame, but that temporary
        // mute must not carry into the next attempt when global mute is off.
        if (!MuteReducer) setAudioEnabled(true);
        stickPointerRef.current = event.pointerId;
        stickStartXRef.current = event.clientX;
        stickWidthRef.current =
            stickElRef.current?.parentElement?.getBoundingClientRect().width || 0;
        laneLockedRef.current = false;
        settleStick();
        let captured = false;
        try {
            (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
            captured = true;
        } catch { }
        console.log("[Drag] DOWN ptr=", event.pointerId, "x=", Math.round(event.clientX),
            "stageW=", Math.round(stickWidthRef.current), "captured=", captured);
    }, [MuteReducer]);

    const onStickMove = useCallback((event: React.PointerEvent) => {
        if (stickPointerRef.current !== event.pointerId) return;
        // A lane locks once. Sliding across to the other side must do nothing,
        // or the probation timer would have two owners.
        if (laneLockedRef.current) return;

        const offset = event.clientX - stickStartXRef.current;

        // ⚡ Written straight to the DOM, NOT through React state.
        //
        // setState here re-rendered this entire component — media props,
        // overlay props, every memo — at touch frequency for the whole gesture.
        // That was the jank. The Stick's position is pure presentation and
        // nothing else reads it, so it belongs on the compositor, not in the
        // render tree.
        const el = stickElRef.current;
        if (el) {
            el.style.transition = "none";
            el.style.transform = `translate(-50%, 0) translateX(${offset}px)`;
        }

        const lane = laneForOffset(offset, stickWidthRef.current);
        if (!lane) return;
        laneLockedRef.current = true;
        console.log("[Drag] LOCK lane=", lane, "offset=", Math.round(offset),
            "frac=", (offset / (stickWidthRef.current || 1)).toFixed(3));
        beginDrag(lane, event.pointerId);
    }, [beginDrag]);


    /**
     * Split from pointerup ON PURPOSE, for measurement.
     *
     * A pointercancel means the BROWSER took the gesture away — not the viewer
     * letting go. Mutating touch-action on an ancestor during an active touch is
     * one documented way to cause it, and the scroll lock does exactly that the
     * instant a lane locks. If these logs show CANCEL rather than UP, the
     * mechanism is cancelling itself.
     */
    const endStickGesture = useCallback((event: React.PointerEvent, reason: "up" | "cancel") => {
        if (stickPointerRef.current !== event.pointerId) {
            console.log("[Drag]", reason.toUpperCase(), "ignored — not the controlling pointer",
                event.pointerId, "vs", stickPointerRef.current);
            return;
        }
        console.log("[Drag]", reason.toUpperCase(), "ptr=", event.pointerId,
            "laneLocked=", laneLockedRef.current);
        stickPointerRef.current = null;
        laneLockedRef.current = false;
        settleStick();
        releaseDragRef.current(event.pointerId);
    }, [settleStick]);

    const onStickUp = useCallback(
        (event: React.PointerEvent) => endStickGesture(event, "up"), [endStickGesture]);
    const onStickCancel = useCallback(
        (event: React.PointerEvent) => endStickGesture(event, "cancel"), [endStickGesture]);

    /**
     * Total scroll lock while a lane is engaged.
     *
     * DOCUMENT level, not container level — the same reason InteractInput
     * mounts its contextmenu/selectstart guards there: a drag can resolve
     * against a feed panel OUTSIDE the interaction, where a container-scoped
     * handler never fires. Unlocked it reaches FullScreenStories' vertical
     * scroll, pull-to-refresh and swipe-to-close.
     *
     * ONE owner and ONE release path. This cleanup is the only place that
     * unlocks, so snap-back, commit, Back, Home and unmount all release through
     * the same line. A leaked scroll lock freezes the entire feed with no way
     * out, and two release sites is how that happens.
     */
    const dragEngaged = dragSession !== null && dragSession.phase === "engaged";
    useEffect(() => {
        if (!dragEngaged) return;
        // ⚠ SUSPECT: this mutates touch-action on an ancestor DURING an active
        // touch, which is a documented way to make Chrome fire pointercancel.
        // If the logs show CANCEL immediately after LOCK, this is the cause.
        console.log("[Drag] SCROLL LOCK on");
        const body = document.body;
        const previous = {
            overflow: body.style.overflow,
            touchAction: body.style.touchAction,
            overscroll: body.style.overscrollBehavior,
        };
        body.style.overflow = "hidden";
        body.style.overscrollBehavior = "none";
        // NOTE: no document-level touchmove preventDefault, and no body
        // touch-action mutation.
        //
        // Both were measured and both were useless. Every preventDefault logged
        // "Ignored attempt to cancel a touchmove event with cancelable=false" —
        // by the time a lane locks the browser has already decided what this
        // gesture is, so the cancel is a no-op. What it DID do was emit dozens
        // of console warnings per gesture, each with a stack trace and each
        // routed through the DevTools hook, which cost real frames.
        //
        // The Stick's own `touch-action: none` is what actually stops the
        // gesture reaching the feed, and it works from touchstart, which is the
        // only moment that matters.
        return () => {
            body.style.overflow = previous.overflow;
            body.style.overscrollBehavior = previous.overscroll;
        };
    }, [dragEngaged]);

    /**
     * Non-gesture arrival at an action clip.
     *
     * Back from a payoff, Home, a history link pointing straight at it. The
     * viewer never dragged, so there is nothing to hold — the node enters
     * already committed and plays hands-free into its payoff. Derived from the
     * tree, exactly as buildHoldEntryMap solved the same problem for Hold.
     */
    const dragArmedVisitRef = useRef<string | null>(null);
    useEffect(() => {
        if (!dragEntry) return;
        if (dragSession) { dragArmedVisitRef.current = visitKey; return; }
        if (dragArmedVisitRef.current === visitKey) return;
        dragArmedVisitRef.current = visitKey;
        // Nothing to do beyond letting it play: with no session, no ownership
        // gate is held, so the ordinary media path plays it and
        // runNodeCompletion cuts to the payoff on its end frame.
    }, [dragEntry, dragSession, visitKey]);

    /**
     * The action clip advances only while the finger is down.
     *
     * With ownership held, every autonomous play path in TouchPreviewMedia is
     * disabled, so this effect is the ONLY thing moving the element — which is
     * the whole point of the gate.
     */
    useEffect(() => {
        if (!dragSession || dragSession.phase !== "engaged") return;
        if (dragSession.expectedVisitKey !== visitKey) return;

        // ✅ WAIT FOR READINESS. This is the whole fix.
        //
        // Locking a lane pushes the action node and calls play() in the same
        // breath — but TouchPreviewMedia deliberately gives a <video> NOTHING
        // until its blob exists (handing over the remote URL as a placeholder
        // was the dual-owner bug). So the element had no source, play() was a
        // silent no-op, and nothing re-ran when the blob landed.
        //
        // Meanwhile ownership was held, which correctly suppresses all seven of
        // TouchPreviewMedia's own play paths. The clip therefore sat still for
        // the entire 2.5s and only started at COMMIT, when ownership was handed
        // back — which is why the Stick appeared to vanish BEFORE the video
        // played, instead of long after.
        //
        // hasStartedAtZero is set by MEDIA_READY, reported once the element
        // genuinely has data and carrying the visitKey so a destroyed element's
        // report is rejected.
        if (!dragSession.hasStartedAtZero) return;

        const main = mainRef.current;
        if (!main) return;

        if (dragSession.pointerId !== null) {
            // Embedded audio only — an action clip never carries a separate
            // track, so nothing has to be kept in lockstep with the finger.
            muteVideo(main, !audioEnabled);
            void main.play().catch(() => { });
        } else {
            // Released before commit: stop where it is. The reset to zero
            // happens in snapBackDrag, which owns the whole abandon path.
            try { main.pause(); } catch { }
        }
    }, [dragSession, visitKey, audioEnabled]);

    /**
     * The action clip starts from zero exactly once per attempt.
     *
     * A snap-back returns the viewer to the drag node and the next attempt
     * remounts this element, but a re-engage on a warm element could otherwise
     * resume from where the last abandoned attempt left off.
     */
    const dragSeekedSessionRef = useRef<number | null>(null);
    useEffect(() => {
        if (!dragSession?.hasStartedAtZero) return;
        if (dragSeekedSessionRef.current === dragSession.sessionId) return;
        dragSeekedSessionRef.current = dragSession.sessionId;
        try { if (mainRef.current) mainRef.current.currentTime = 0; } catch { }
    }, [dragSession?.sessionId, dragSession?.hasStartedAtZero]);

    /**
     * A session cannot outlive the node it was started from.
     *
     * A won session is exempt: it has deliberately navigated to its payoff and
     * is only waiting for the physical release to arrive.
     */
    useEffect(() => {
        if (!dragSession) return;
        if (dragSession.expectedVisitKey === visitKey) return;
        if (dragAwaitingRelease(dragSession)) return;
        console.warn("[Drag] ORPHANED — expected visit", dragSession.expectedVisitKey,
            "but on", visitKey, "· aborting");
        dispatchDrag({ type: "ABORT" });
    }, [dragSession, visitKey, dispatchDrag]);

    /**
     * Safety net for a won route whose release never arrives.
     *
     * The Stick unmounts the moment the clip ends, taking its pointer capture
     * with it, so the browser often never delivers that pointerup to anything —
     * a missed release is the normal case here, not an edge case.
     *
     * This no longer gates playback. The won phase holds no media ownership, so
     * the payoff starts immediately; all this clears is the leftover state that
     * would otherwise keep the NEXT drag node's Stick hidden. Short, because
     * nothing is waiting on it.
     */
    useEffect(() => {
        if (!dragAwaitingRelease(dragSession)) return;
        const timer = setTimeout(() => {
            dispatchDrag({ type: "ABORT" });
        }, 600);
        return () => clearTimeout(timer);
    }, [dragSession, dispatchDrag]);

    const playSub = useCallback((id: BranchId) => {
        hideHUDTemporarily();
        const branchIsVictory = Boolean(currentNode.hotspots[BRANCH_INDEX[id]]?.isVictory);

        // ✅ ROUTE ORDER: loop link wins over the ordinary child / sub-video.
        // The underlying media is retained, only overridden. A stale link falls
        // through to normal behaviour rather than dead-ending the viewer.
        const loopTargetId = currentNode.hotspots[BRANCH_INDEX[id]]?.loopTargetNodeId;
        if (loopTargetId) {
            const entry = nodeIndex.get(loopTargetId);
            if (entry) {
                performLoopJump(entry, `loopJump:${id}`);
                return;
            }
            console.warn("[TouchNav] Loop target no longer exists, falling back to normal branch:", loopTargetId);
        }

        if (currentNode.children?.[id]) {
            captureOutgoingFrame(active ? subRefs[active].current : mainRef.current);
            setNodeStack((nodes) => [...nodes, currentNode.children![id]!]);
            setNodeVictoryStack((victories) => [...victories, branchIsVictory]);
            return;
        }

        const main = mainRef.current;
        const sub = subRefs[id].current;
        if (!main || !sub) return;
        setShowHotspots(false);
        isShowingRef.current = false;
        try { main.pause(); } catch { }
        if (Math.abs(sub.currentTime) > .001 || sub.ended) sub.currentTime = 0;
        setActive(id);
        setSubEnded(false);
        pauseAllAudios();
        muteVideo(main, true);
        BRANCH_IDS.forEach((branch) => muteVideo(subRefs[branch].current, true));

        if (audioEnabled) {
            if (branchHasSnippet[id]) {
                const subAudio = branchAudioRefs[id].current;
                if (subAudio) { subAudio.currentTime = 0; tryPlay(subAudio); }
                muteVideo(sub, true);
            } else {
                muteVideo(sub, false);
            }
        } else {
            muteVideo(sub, true);
        }
        sub.play().catch(() => { });
    }, [currentNode, active, audioEnabled, branchHasSnippet.left, branchHasSnippet.right, branchHasSnippet.top, branchHasSnippet.bottom, pauseAllAudios, tryPlay, nodeIndex, performLoopJump]);

    useEffect(() => { playSubRef.current = playSub; }, [playSub]);

    const firstSoundPlayedRef = useRef(false);



    const shouldShowSpeaker = videoPlaying && !audioEnabled && (hasMainSnippet || BRANCH_IDS.some((branch) => branchHasSnippet[branch]) || wantsAnyVideoAudio);
    const activeSubIsVictory = active ? Boolean(currentNode.hotspots[BRANCH_INDEX[active]]?.isVictory) : false;
    const overlayVictory = active ? activeSubIsVictory : isCurrentNodeVictory;
    const overlayVictoryVideoEnded = active ? subEnded : undefined;
    const overlayVictoryKey = active ? `${currentId}-${active}` : currentId;
    const [firstImpressionPillVisible, setFirstImpressionPillVisible] = useState(false);
    useEffect(() => {
        const areaId: FeedAreaId = 'clikb.feeds.hotspot';
        if (!props.feeds) return;
        const postId = Number(props.interactionPostId) || 0;
        const control = (name: string, handlerRef: string, policy: FeedControl['aiPolicy'] = 'candidate'): FeedControl => ({
            controlId: `${areaId}.${name}`, areaId, handlerRef,
            enabled: true, aiPolicy: policy, targetId: postId,
            ...(policy === 'candidate' ? { candidateActionId: `${areaId}.${name}` } : {}),
        });
        const configured = BRANCH_IDS.filter(branch => Boolean(
            subs[BRANCH_INDEX[branch]] || currentNode.children?.[branch]?.mainSrc || loopTargets[branch]));
        const visibleChoices = showHotspots && active === null && !nodeIsDrag
            ? configured.map(branch => ({ id: branch,
                label: boundedFeedTextHint(hotspots[BRANCH_INDEX[branch]].customText || branch, 40),
                kind: hotspots[BRANCH_INDEX[branch]].holdToPlay ? 'hold' : 'tap',
                enabled: choicesEnabled })) : [];
        const controls: FeedControl[] = props.snapshotObscured ? [] : [
            ...(shouldShowSpeaker ? [control('enable_audio', 'TouchPreviewStageUI.enableAudioByUser', 'manual_only')] : []),
            ...(showHotspots && active === null && !nodeIsDrag && choicesEnabled
                ? configured.map(branch => hotspots[BRANCH_INDEX[branch]].holdToPlay
                    ? control(`hold_${branch}`, 'TouchPreviewStageUI.beginHold/releaseHold', 'manual_only')
                    : control(`tap_${branch}`, 'TouchPreviewStageUI.playSub')) : []),
            ...(holdSession ? [control('hold_controller', 'TouchPreviewStageUI.beginHold/releaseHold', 'manual_only')] : []),
            ...(stickVisible(dragSession, nodeIsDrag && showHotspots)
                ? [control('drag_stick', 'TouchPreviewStageUI.onStickDown/Move/Up', 'manual_only')] : []),
            ...(!isHUDHidden && (canExitToHome || (active !== null && subEnded))
                ? [control('go_home', 'TouchPreviewStageUI.goHome')] : []),
            ...(nodeStack.length > 0 ? [control('back_gesture', 'TouchPreviewStageUI.handleMainPointerUp double-tap', 'manual_only')] : []),
            ...(firstImpressionPillVisible ? [control('dismiss_first_impression', 'TouchPreviewOverlay.setHidePill(true)')] : []),
        ];
        dispatch(publishFeedsArea({ areaId, source: 'TouchPreviewStageUI', instanceId: 'hotspot',
            state: {
                postId, nodeId: boundedFeedTextHint(currentId, 64),
                visitEpoch, depth: nodeStack.length,
                activeBranch: active ?? '', showHotspots,
                choicesEnabled, visibleChoices: JSON.stringify(visibleChoices),
                interactionKind: nodeIsDrag ? 'drag_hold' : holdSession ? 'hold_to_play' : 'hotspot',
                holdPhase: holdSession?.phase ?? '', dragPhase: dragSession?.phase ?? '',
                dragLane: dragSession?.lane ?? '',
                audioEnabled, speakerVisible: shouldShowSpeaker,
                hudHidden: isHUDHidden, transitioning: isTransitioning,
                obscuredByOverlay: Boolean(props.snapshotObscured),
                canBack: nodeStack.length > 0, canGoHome: canExitToHome || (active !== null && subEnded),
                victory: overlayVictory, victoryVideoEnded: Boolean(overlayVictoryVideoEnded),
                firstImpressionPillEligible: showFirstImpressionPill,
                firstImpressionPillVisible,
            }, visiblePosts: [], visibleControls: controls,
        }));
    }, [dispatch, props.feeds, props.interactionPostId, currentId, currentNode, subs,
        hotspots, loopTargets, visitEpoch, nodeStack.length, active, showHotspots,
        nodeIsDrag, choicesEnabled, holdSession, dragSession, shouldShowSpeaker,
        isHUDHidden, canExitToHome, subEnded, audioEnabled, isTransitioning,
        overlayVictory, overlayVictoryVideoEnded, showFirstImpressionPill, firstImpressionPillVisible, props.snapshotObscured]);
    useEffect(() => () => {
        if (props.feeds) dispatch(removeFeedsArea({ areaId: 'clikb.feeds.hotspot', source: 'TouchPreviewStageUI' }));
    }, [dispatch, props.feeds]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioUnlockedRef = useRef(false);

    const primeAudioGesture = useCallback(() => {
        // ✅ AUDIO FIX: the `if (audioUnlockedRef.current) return;` that used to sit
        // here made this whole callback a once-per-mount affair. The AudioContext
        // only needs unlocking once — but the UNMUTE below has to run again for
        // every node, because each node change mounts a BRAND NEW video element
        // that Safari has never heard and that arrives muted. Returning early meant
        // node 2 onwards could never be unmuted by a gesture, which is half of why
        // reveals were silent. Only the context creation is guarded now.
        if (!audioUnlockedRef.current) {
            try {
                const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (AC) {
                    audioCtxRef.current ??= new AC();
                    audioCtxRef.current?.resume?.();
                }
            } catch { }
            audioUnlockedRef.current = true;
        }

        // The viewer's own mute always wins — this must never un-mute behind them.
        if (MuteReducer) return;

        setAudioEnabled(true);

        // Nudging a paused element here is deliberate: we are inside a real user
        // gesture, so this play() carries the credit that a later programmatic one
        // would not have.
        if (active) {
            const sub = subRefs[active].current;
            if (sub && !branchHasSnippet[active]) {
                muteVideo(sub, false);
                if (sub.paused) sub.play().catch(() => { });
            }
        } else if (mainRef.current && !hasMainSnippet) {
            const main = mainRef.current;
            muteVideo(main, false);
            if (main.paused) main.play().catch(() => { });
        }
    }, [active, branchHasSnippet.left, branchHasSnippet.right, branchHasSnippet.top, branchHasSnippet.bottom, hasMainSnippet, MuteReducer]);

    const enableAudioByUser = useCallback(async () => {
        setAudioEnabled(true);
        try {
            if (!audioCtxRef.current && (window as any).AudioContext) {
                audioCtxRef.current = new (window as any).AudioContext();
            }
            await audioCtxRef.current?.resume();
        } catch { }

        const audiblePrime = async (element?: HTMLAudioElement | null) => {
            if (!element) return false;
            try {
                element.muted = false;
                element.volume = 1;
                element.currentTime = 0;
                await element.play();
                await new Promise((resolve) => setTimeout(resolve, 120));
                element.pause();
                element.currentTime = 0;
                return true;
            } catch {
                return false;
            }
        };

        let primed = await audiblePrime(mainAudioRef.current);
        for (const branch of BRANCH_IDS) {
            if (primed) break;
            primed = await audiblePrime(branchAudioRefs[branch].current);
        }
        pauseAllAudios();

        if (active) {
            const sub = subRefs[active].current;
            if (branchHasSnippet[active]) {
                await tryPlay(branchAudioRefs[active].current);
                muteVideo(sub, true);
            } else {
                muteVideo(sub, false);
            }
        } else if (hasMainSnippet) {
            await tryPlay(mainAudioRef.current);
            muteVideo(mainRef.current, true);
        } else {
            muteVideo(mainRef.current, false);
        }
    }, [active, branchHasSnippet.left, branchHasSnippet.right, branchHasSnippet.top, branchHasSnippet.bottom, hasMainSnippet, pauseAllAudios, tryPlay]);
    const baseMarkerStyle = useCallback((id: BranchId): React.CSSProperties => {
        const g = geomRef.current;
        // ✅ A resolvable loop link is a route in its own right. Without this a
        // loop-only hotspot (no sub video, no child) would never render.
        // The lens visual is drawn from the MAIN video frame in TouchPreviewOverlay,
        // not from the branch video, so no fallback media is required here.
        const subUrl = subs[BRANCH_INDEX[id]] || currentNode.children?.[id]?.mainSrc || (loopTargets[id] ? "loop" : "");
        if (!subUrl) return { display: "none" };

        if (!g) return { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "64px", aspectRatio: "1 / 1", borderRadius: "50%", background: "rgba(255,255,255,0.05)", zIndex: 6 };
        const spot = g[id];
        return {
            position: "absolute", left: `${spot.centerX}px`, top: `${spot.centerY}px`, transform: "translate(-50%, -50%)", width: `${spot.lensDiamPx}px`, aspectRatio: "1 / 1", borderRadius: "50%", background: "radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.00) 55%)", backdropFilter: "blur(0.2px) saturate(10%)", WebkitBackdropFilter: "blur(0.2px) saturate(10%)", border: "none", boxShadow: "0 6px 18px rgba(0,0,0,0.22)", display: "block", transition: "transform 1080ms ease, box-shadow 1080ms ease, opacity 1120ms ease", willChange: "transform, box-shadow, opacity", cursor: "pointer", zIndex: 6, overflow: "hidden"
        } as React.CSSProperties;
    }, [subs, currentNode.children, loopTargets]);

    const markerStyle = baseMarkerStyle;

    const makeLensVideoStyle = useCallback((hs: Hotspot): React.CSSProperties => {
        const g = geomRef.current;
        if (!g) return { display: "none" };
        const spot = g[hs.id];
        const dx = spot.centerX - g.offX; const dy = spot.centerY - g.offY;
        const left = spot.lensDiamPx / 2 - dx; const top = spot.lensDiamPx / 2 - dy;
        return { position: "absolute", left: `${left}px`, top: `${top}px`, width: `${g.dispW}px`, height: `${g.dispH}px`, objectFit: "fill", pointerEvents: "none", transformOrigin: `${dx}px ${dy}px`, willChange: "transform" };
    }, []);



    const tapCountRef = useRef(0); // 👈 add this

    const handleMainPointerUp = useCallback(async () => {
        hideHUDTemporarily();
        // The release that ends a won drag route. It arrives AFTER navigation,
        // so without this it reads as a fresh single tap on the destination —
        // which restarts main. One-shot: cleared as soon as it is spent.
        if (suppressNextTapRef.current) {
            suppressNextTapRef.current = false;
            return;
        }
        // Double/triple tap to go back is default navigation and must survive a Hold.
        // The normal guard bails when a sub is active, which is exactly the state a
        // sub Hold puts us in, so it is relaxed while a session is live.
        if (!holdActive && (showHotspots || active !== null)) return;


        props.setActiveStory?.(true);

        // 1️⃣ First tap ever → unlock + choose audio source.
        // Skipped during a Hold: enableAudioByUser starts media the session owns.
        if (!firstSoundPlayedRef.current && !holdActive) {

            firstSoundPlayedRef.current = true;
            await enableAudioByUser();
            lastTapRef.current = performance.now();
            tapCountRef.current = 1;
            return;


        }

        // 2️⃣ After that: count taps within a small window
        const now = performance.now();
        if (now - lastTapRef.current < 550) {
            tapCountRef.current += 1;
        } else {
            tapCountRef.current = 1;
        }
        lastTapRef.current = now;

        // 3️⃣ Triple tap & NOT root → go back up one node
        if (tapCountRef.current >= 2 && nodeStack.length > 0) {
            tapCountRef.current = 0;
            handleBack();       // pops child node
            return;
        }

        // 4️⃣ Double tap → restart main. Never while a Hold owns the video: the
        // viewer is driving it, and a restart would yank it back to zero.
        if (tapCountRef.current === 1 && !holdActive) {
            jumpToPrePause();
        }
    }, [showHotspots, active, enableAudioByUser, jumpToPrePause, handleBack, nodeStack.length, holdActive]);


    return (
        <>

            <audio
                ref={globalAudioRef}
                src={GLOBAL_BG_SRC}
                loop
                preload="auto"
                style={{ display: 'none' }}
            />

            {/* 📸 SNAPSHOT CANVAS FOR TRANSITIONS */}
            <canvas 
                ref={snapshotCanvasRef}
                className={isTransitioning ? 'media-loading-cover' : undefined}
                style={{
                    position: "absolute", inset: 0, padding: "0px", width: "100%", height: "100%",
                    objectFit: "contain", objectPosition: matchMobile ? "top center" : "center",
                    // Stage 6C: fully opaque, and it appears INSTANTLY.
                    //
                    // It used to fade in to 0.7 over 420ms. Both halves of that were
                    // wrong. The fade-in raced a video React had already unmounted —
                    // a CSS transition never runs on an element being removed — so
                    // for ~200ms the outgoing picture was gone and its replacement
                    // had not arrived. And 0.7 meant the cover never matched the
                    // frame it replaced, so even perfect timing showed a brightness
                    // step. At opacity 1 with no fade-in this is indistinguishable
                    // from the video still being there.
                    //
                    // The transition is asymmetric on purpose: instant on, gentle
                    // off. This is the ONLY layer that animates during a
                    // transition — see the main video's opacity chain for why.
                    //
                    // `objectFit`/`objectPosition` match the video exactly, and the
                    // bitmap is sized from videoWidth/videoHeight, so the still
                    // letterboxes identically. No geometry jump at the swap.
                    opacity: isTransitioning ? 1 : 0,
                    transition: isTransitioning || fastSnapshotReveal
                        ? "none"
                        : `opacity ${SNAPSHOT_FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                    pointerEvents: "none", zIndex: 15
                }}
            />

            {/* --- DRAG & HOLD: the Stick ---
                Rendered HERE, outside <React.Fragment key={visitKey}>, next to
                the transition snapshot for the same reason that canvas is
                outside it: both have to survive the remount they are part of.

                Locking a lane navigates immediately. Inside the fragment the
                element would be destroyed mid-gesture, losing its pointer
                capture, and the browser's pointercancel read as the viewer
                letting go — every drag snapped back before the finger moved.

                Fixed bottom-centre, so unlike a hotspot it needs no per-node
                geometry, no shape mask and no lens canvas. It is chrome, not
                node content — which is exactly why it can live out here.

                zIndex 16 clears the snapshot canvas at 15. Below it, the
                opaque transition cover would hide the Stick at precisely the
                moment a lane locks; the gesture would keep working underneath,
                invisibly. Everything else WANTS to be under that cover. The
                Stick is the one thing that must read as continuous across the
                swap. */}
            {stickVisible(dragSession, nodeIsDrag && showHotspots) && (
                <div
                    ref={stickElRef}
                    onPointerDown={onStickDown}
                    onPointerMove={onStickMove}
                    onPointerUp={onStickUp}
                    onPointerCancel={onStickCancel}
                    style={{
                        position: "absolute",
                        left: "50%",
                        bottom: "9%",
                        width: "30%",
                        aspectRatio: "1 / 1",
                        // Initial value only. From here the transform is driven
                        // straight on the DOM node by the move handler, so React
                        // never re-renders during a drag.
                        transform: "translate(-50%, 0) translateX(0px)",
                        transition: "transform 180ms cubic-bezier(.2,.8,.2,1)",
                        willChange: "transform",
                        borderRadius: "50%",
                        // No commit flash: there is no commit moment any more.
                        // Reaching the end of the clip IS the confirmation, and
                        // the payoff cutting in on the exact end frame says so.
                        border: "3px solid rgba(255,255,255,0.92)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                        background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        // The gesture is ours: no scroll, no callout, no
                        // selection, no native drag.
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        WebkitTouchCallout: "none",
                        WebkitTapHighlightColor: "transparent",
                        cursor: "grab",
                        zIndex: 16,
                    }}
                >
                    <span style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#fff",
                        textShadow: "0 1px 6px rgba(0,0,0,0.9)", pointerEvents: "none",
                    }}>
                        DRAG
                    </span>
                </div>
            )}

            <React.Fragment key={visitKey}>
                <TouchPreviewMedia
                    setIsPreloaded={props.setIsPreloaded}
                    isPreloaded={props.isPreloaded}
                    globalAudioRef={globalAudioRef}
                    bgState={props.intbg === 0 ? false : true}
                    bgSrc={props.feedDataMainAud}
                    audioEnabled={audioEnabled}
                    setAudioEnabled={setAudioEnabled}
                    mainRef={mainRef} subRefs={subRefs}
                    mainAudioRef={mainAudioRef} branchAudioRefs={branchAudioRefs}
                    mainSrc={mainSrc} subs={subs}
                    mainPoster={currentId === rootNode.id ? props.feeds?.x1 || props.feeds?.item1 : undefined}
                    mainAudioUrl={mainAudioUrl} branchAudioUrls={branchAudioUrls}
                    feeds={props.feeds} MuteReducer={MuteReducer} IS_IPHONE_OR_SAFARI={IS_IPHONE_OR_SAFARI}
                    active={active} mainLoaded={mainLoaded} branchLoaded={branchLoaded}
                    setMainLoaded={setMainLoaded} setBranchLoaded={setBranchLoaded}
                    handleMainPointerUp={handleMainPointerUp} jumpToPrePause={jumpToPrePause}
                    onExitSub={onExitSub}
                    isTransitioning={isTransitioning}
                    setIsTransitioning={setIsTransitioning}
                    snapshotCanvasRef={snapshotCanvasRef}
                    preloadKey={currentId}
                    extraPreloadSrcs={loopPreloadSrcs}
                    onMainVisualReady={handleMainVisualReady}
                    holdControlledMedia={holdControlledMedia}
                    // A drag owns the element too, so it needs a session id or the
                    // readiness handshake has nothing to report against.
                    holdSessionId={holdSession?.sessionId
                        ?? (dragHoldsMedia ? dragSession?.sessionId ?? null : null)}
                    holdVisitKey={visitKey}
                    onHoldMediaReady={onHoldMediaReady}
                />

                <TouchPreviewOverlay
                    mainRef={mainRef} // 👈 Added for Canvas Lenses
                    isHUDHidden={isHUDHidden} // 👈 Added for auto-hide
                    isAutoPlayTimerActive={isAutoPlayTimerActive} // 👈 Added for timer bar
                    showHotspots={showHotspots} active={active} markerStyle={markerStyle} makeLensVideoStyle={makeLensVideoStyle}
                    hsById={hsById} lensCanvasRefs={lensCanvasRefs}
                    lensZoomAnimated={LENS_ZOOM}
                    MuteReducer={MuteReducer} toggleMute={toggleMute}
                    primeAudioGesture={primeAudioGesture} playSub={playSub} shouldShowSpeaker={shouldShowSpeaker}
                    enableAudioByUser={enableAudioByUser} backToEdit={handleBack} onPublish={props.onPublish} feeds={props.feeds}
                    interactionPostId={props.interactionPostId}
                    // VICTORY MODE PROPS
                    videoArray={props.videoArray}
                    goodOutcomes={props.goodOutcomes}
                    setGoodOutcomes={props.setGoodOutcomes}
                    isGoodOutcome={isGoodOutcome}
                    isCurrentNodeVictory={overlayVictory}
                    victoryVideoEnded={overlayVictoryVideoEnded}
                    victoryKey={overlayVictoryKey}
                    isLeaf={canExitToHome || (active !== null && subEnded)}
                    goHome={goHome}
                    showFirstImpressionPill={showFirstImpressionPill}
                    onFirstImpressionPillVisibilityChange={setFirstImpressionPillVisible}
                    isRootNode={nodeStack.length === 0}
                    holdSession={holdSession}
                    choicesEnabled={choicesEnabled}
                    autoPlayTimerDurationMs={choiceWindowMs(holdWindowPending)}
                    beginHold={beginHold}
                    releaseHold={releaseHold}
                />


            </React.Fragment>

        </>
    );
};

export default TouchPreviewStageUI;
