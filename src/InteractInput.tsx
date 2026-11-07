import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import DefaultStageUI from "./DefaultStageUI";
import SwipeEditStageUI from "./SwipeEditStageUI";
import SwipePreviewStageUI from "./SwipePreviewStageUI";
import TouchEditStageUI from "./TouchEditStageUI"; // ✅ The New Builder
import TouchPreviewStageUI, { InteractionNode, Hotspot } from "./TouchPreviewStageUI"; // ✅ The New Player
import { matchMobile } from "./DetectDevice";
import Texttospeech from "./Texttospeech";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import type { Dispatch, SetStateAction } from "react";
import {
    BranchTuple,
    normalizeHotspots,
    normalizeInteractionNode,
    normalizeSubs,
} from "./TouchInteractionModel";
import InteractionNodeMap from "./InteractionNodeMap";
import {
    STORED_PLAN_KEY,
    graphFromTopology,
    parseStoredMediaSlots,
    parseStoredPlan,
    planThumbsFromSlots,
    type MediaSlot,
} from "./interactionGraph";

type Mode = "touch" | "swipe" | any;

interface InteractInputProps {
    vid1: any;
    vid2: any;
    vid3: any;
    mode: Mode;
    setmode: (m: Mode) => void;
    stage: number;
    setStage: any;
    interactionPostId: string | number | null;
    touchHotspots: BranchTuple<Hotspot>;
    setTouchHotspots: Dispatch<SetStateAction<BranchTuple<Hotspot>>>;
    feeds: boolean;
    snapshotObscured?: boolean;
    wipeInteractionState: any;
    mainAudioUrl: any;
    sub1AudioUrl: any;
    sub2AudioUrl: any;
    setMainAudioUrl: any;
    setSub1AudioUrl: any;
    setSub2AudioUrl: any;
    mainAudioUrlx: any;
    sub1AudioUrlx: any;
    sub2AudioUrlx: any;
    setMainAudioUrlx: any;
    setSub1AudioUrlx: any;
    setSub2AudioUrlx: any;
    videoArray: any; // ✅ Ensure this contains the list of 9 videos
    feedData: any;
    setActiveStory?: any;
    intbg?: any;
    setintbg?: any
}

const InteractInput: React.FC<InteractInputProps> = ({
    vid1,
    vid2,
    vid3,
    mode,
    setmode,
    stage,
    setStage,
    interactionPostId,
    touchHotspots,
    setTouchHotspots,
    feeds,
    snapshotObscured = false,
    wipeInteractionState,
    mainAudioUrl,
    sub1AudioUrl,
    sub2AudioUrl,
    setMainAudioUrl,
    setSub1AudioUrl,
    setSub2AudioUrl,
    mainAudioUrlx,
    sub1AudioUrlx,
    sub2AudioUrlx,
    setMainAudioUrlx,
    setSub1AudioUrlx,
    setSub2AudioUrlx,
    videoArray,
    feedData,
    setActiveStory,
    intbg,
    setintbg
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const frameRef = useRef<HTMLDivElement | null>(null);
    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    // Swipe keeps its own two-direction media state; touch uses treeRoot exclusively.
    const [topAudioUrl, setTopAudioUrl] = useState<any>("");
    const [bottomAudioUrl, setBottomAudioUrl] = useState<any>("");
    const [topAudioUrlx, setTopAudioUrlx] = useState<any>("");
    const [bottomAudioUrlx, setBottomAudioUrlx] = useState<any>("");

    const [subs, setSubs] = useState<[string, string]>([vid2, vid3]);

    const [isPreloaded, setIsPreloaded] = useState(false);

    const [treeRoot, setTreeRoot] = useState<InteractionNode>({
        id: "root",
        mainSrc: vid1,
        subs: feeds ? normalizeSubs([vid2, vid3]) : normalizeSubs([]),
        hotspots: normalizeHotspots(touchHotspots),
        audio: {
            main: mainAudioUrl ? [mainAudioUrl] : [],
            left: sub1AudioUrl ? [sub1AudioUrl] : [],
            right: sub2AudioUrl ? [sub2AudioUrl] : [],
            top: topAudioUrl ? [topAudioUrl] : [],
            bottom: bottomAudioUrl ? [bottomAudioUrl] : [],
        },
        children: {}, // Starts empty, TouchEditStageUI fills this
    });

    const [goodOutcomes, setGoodOutcomes] = useState<string[]>([]);

    const navigate = useNavigate();
    const [aspect, setAspect] = useState<number>(16 / 9);
    const [dims, setDims] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });
    const [addVoice, setAddVoice] = useState(false);
    const [identifier, setIdentifier] = useState<0 | 1 | 2 | 3 | 4>(0);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // 🛑 NEW STATE: Track if audio is currently being generated
    const [isGenerating, setIsGenerating] = useState(false);

    // Same fix as FullScreenStories' getMobileFullscreenHeight: on mobile,
    // plain 100vh sizes as if browser bars are hidden, making the frame taller
    // than the visible area — video cropped at the top, gap/misplaced UI at
    // the bottom. Dynamic viewport height (dvh) tracks the REAL visible area.
    const mobileFrameHeight = (typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh"))
        ? "100dvh"
        : (typeof CSS !== "undefined" && CSS.supports?.("height", "100lvh"))
            ? "100lvh"
            : "100vh";

    const fitToViewport = useCallback((a: number) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let width = vw;
        let height = width / a;
        if (height > vh) {
            height = vh;
            width = height * a;
        }
        setDims({ width: Math.floor(width), height: Math.floor(height) });
    }, []);

    // 🔹 HYDRATE FROM feedData WHEN feeds === true
    useEffect(() => {

        // alert(intbg)
        if (!feeds || !feedData) return;

        const {
            interactionAudioMain,
            interactionAudioLeft,
            interactionAudioRight,
            touchConfigJson,
        } = feedData;

        // 1) Set simple audio props from DB (parent owns these states)
        if (interactionAudioMain) {
            setMainAudioUrl(interactionAudioMain);
        }
        if (interactionAudioLeft) {
            setSub1AudioUrl(interactionAudioLeft);
        }
        if (interactionAudioRight) {
            setSub2AudioUrl(interactionAudioRight);
        }

        const toArr = (v: any) =>
            Array.isArray(v) ? v : v ? [v] : [];

        // 2) If we have a full touch config stored, hydrate tree + hotspots
        if (touchConfigJson) {
            try {
                const parsed = JSON.parse(touchConfigJson);

                const touchConfig = parsed.touchConfig || parsed;
                const hotspotsFromFeed: BranchTuple<Hotspot> = normalizeHotspots(
                    touchConfig.hotspots ||
                    touchConfig.tree?.hotspots ||
                    touchHotspots);

                const loadedOutcomes = touchConfig.goodOutcomes || [];

                // ✅ fallbackId is path-derived. Previously every child fell back to
                // "root" when its id was missing, which produced duplicate IDs — fatal
                // now that IDs are loop destinations resolved through an index.
                const normalizeNode = (
                    node: any,
                    fallbackId: string = "root",
                    /**
                     * Whether a missing mainSrc/subs may fall back to the ROOT's
                     * media. Left false for Drag & Hold lanes.
                     *
                     * A lane action node legitimately has no subs — its only
                     * onward route is its payoff — so inheriting root's vid2/vid3
                     * here would make hasActiveHotspots true, and
                     * runNodeCompletion would then reveal choices instead of
                     * cutting to the payoff on the end frame. The payoff would
                     * simply never fire.
                     */
                    inheritRootMedia: boolean = true
                ): InteractionNode => {
                    const rawAudio = node.audio || {};
                    const n: InteractionNode = {
                        id: node.id ?? fallbackId,
                        mainSrc: node.mainSrc ?? (inheritRootMedia ? vid1 : ""),
                        subs: normalizeSubs(node.subs ?? (inheritRootMedia ? [vid2, vid3] : [])),
                        hotspots: normalizeHotspots(node.hotspots || hotspotsFromFeed || touchHotspots),
                        autoPlaySrc: node.autoPlaySrc || "", // ✅ Hydrate autoPlaySrc
                        autoPlayIsVictory: node.autoPlayIsVictory || false, // ✅ Hydrate autoPlayIsVictory
                        autoLoopTargetNodeId: node.autoLoopTargetNodeId || undefined, // ✅ Hydrate auto-loop destination
                        // ✅ Drag & Hold mode. Strict coercion, exactly as the model
                        // normalizer: a mode that replaces the entire hotspot UI must
                        // not be switched on by "false", 1, or malformed JSON.
                        dragHold: node.dragHold === true,
                        audio: {
                            main: toArr(rawAudio.main),
                            left: toArr(rawAudio.left),
                            right: toArr(rawAudio.right),
                            top: toArr(rawAudio.top),
                            bottom: toArr(rawAudio.bottom),
                        },
                        children: {},
                    };

                    if (node.children) {
                        n.children = {};
                        if (node.children.left) {
                            n.children.left = normalizeNode(node.children.left, `${n.id}-left`);
                        }
                        if (node.children.right) {
                            n.children.right = normalizeNode(node.children.right, `${n.id}-right`);
                        }
                        if (node.children.top) {
                            n.children.top = normalizeNode(node.children.top, `${n.id}-top`);
                        }
                        if (node.children.bottom) {
                            n.children.bottom = normalizeNode(node.children.bottom, `${n.id}-bottom`);
                        }
                        if (node.children.autoPlay) {
                            n.children.autoPlay = normalizeNode(node.children.autoPlay, `${n.id}-autoPlay`); // ✅ Hydrate children.autoPlay
                        }
                        // ✅ Drag & Hold lanes. This list is hand-rolled rather than
                        // derived from a PathId array, so a new path segment is
                        // invisible here until it is added by name — and anything
                        // missing is silently DELETED rather than failing loudly.
                        // Without these two lines a drag node loses both lanes on
                        // every hydration and the action clip has nowhere to go.
                        if (node.children.dragLeft) {
                            n.children.dragLeft = normalizeNode(node.children.dragLeft, `${n.id}-dragLeft`, false);
                        }
                        if (node.children.dragRight) {
                            n.children.dragRight = normalizeNode(node.children.dragRight, `${n.id}-dragRight`, false);
                        }
                    }

                    // ✅ Auto-generate autoPlay child if autoPlaySrc is present but the child node is missing
                    if (n.autoPlaySrc && !n.children.autoPlay) {
                        n.children.autoPlay = {
                            id: `${n.id}-autoPlay`,
                            mainSrc: n.autoPlaySrc,
                            subs: normalizeSubs([]),
                            hotspots: normalizeHotspots([]),
                            audio: { main: [], left: [], right: [], top: [], bottom: [] }
                        };
                    }

                    return n;
                };

                const treeFromFeed = touchConfig.tree || touchConfig;
                const normalizedRoot = normalizeInteractionNode(normalizeNode(treeFromFeed));

                setTreeRoot(normalizedRoot);
                setTouchHotspots(hotspotsFromFeed);
                setSubs([normalizedRoot.subs[0], normalizedRoot.subs[1]]);
                setTopAudioUrl(normalizedRoot.audio?.top?.[0] || "");
                setBottomAudioUrl(normalizedRoot.audio?.bottom?.[0] || "");
                setGoodOutcomes(loadedOutcomes);
            } catch (err) {
                console.error("Failed to parse touchConfigJson", err);
            }
        }
    }, [
        feeds,
        feedData,
        setMainAudioUrl,
        setSub1AudioUrl,
        setSub2AudioUrl,
        setTouchHotspots
    ]);



    // Keep root-level controls synchronized without replacing branch media or children.
    useEffect(() => {
        setSubs([vid2, vid3]);

        // Only update root basics, preserve children if they exist
        setTreeRoot((prev) => ({
            ...prev,
            mainSrc: vid1,
            //    subs: [vid2, vid3],
            hotspots: normalizeHotspots(touchHotspots),
            audio: {
                main: mainAudioUrl ? [mainAudioUrl] : [],
                left: sub1AudioUrl ? [sub1AudioUrl] : [],
                right: sub2AudioUrl ? [sub2AudioUrl] : [],
                top: topAudioUrl ? [topAudioUrl] : [],
                bottom: bottomAudioUrl ? [bottomAudioUrl] : [],
            },
        }));
    }, [vid1, vid2, vid3, touchHotspots, mainAudioUrl, sub1AudioUrl, sub2AudioUrl, topAudioUrl, bottomAudioUrl]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onMeta = () => {
            const w = v.videoWidth || 16;
            const h = v.videoHeight || 9;
            const a = w / h;
            setAspect(a);
            fitToViewport(a);
        };
        v.addEventListener("loadedmetadata", onMeta, { once: true });
        if (v.readyState >= 1) onMeta();
        return () => v.removeEventListener("loadedmetadata", onMeta);
    }, [fitToViewport, vid1, interactionPostId, feeds]);

    useEffect(() => {
        const onResize = () => fitToViewport(aspect);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [aspect, fitToViewport]);

    /**
     * Suppress the browser's long-press gestures for as long as an interaction is
     * open, at the DOCUMENT level rather than on this subtree.
     *
     * Handlers bound to a container only fire for elements inside it. A long press
     * that begins on a hotspot but resolves against a feed panel, a preloaded
     * thumbnail or any layer outside this component never bubbles here, which is why
     * scoping the guard to the interaction did not stop the save-image sheet — and
     * why the image being offered belonged to a different post. contextmenu bubbles
     * to document from every element on the page, so this cannot be out-layered.
     *
     * Mounted-only: the listeners and the class are removed when the interaction
     * closes, so ordinary browsing keeps long-press, selection and right-click.
     */
    useEffect(() => {
        if (!matchMobile) return;

        const suppress = (event: Event) => event.preventDefault();
        // Capture phase, so a stopPropagation() anywhere below cannot hide the event.
        document.addEventListener("contextmenu", suppress, true);
        // iOS begins a selection before any contextmenu fires; this is what stops the
        // highlight from dragging across labels and captions mid-hold.
        document.addEventListener("selectstart", suppress, true);

        const STYLE_ID = "clik-no-callout-style";
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement("style");
            style.id = STYLE_ID;
            // iOS honours -webkit-touch-callout, not the contextmenu handler, and
            // drops it on replaced elements, so img/video/canvas are named outright.
            // Inputs keep selection so text entry in the editor still behaves.
            style.textContent = `
                body.clik-no-callout,
                body.clik-no-callout *:not(input):not(textarea) {
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    user-select: none !important;
                }
                body.clik-no-callout img,
                body.clik-no-callout video,
                body.clik-no-callout canvas {
                    -webkit-touch-callout: none !important;
                    -webkit-user-drag: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        document.body.classList.add("clik-no-callout");

        return () => {
            document.removeEventListener("contextmenu", suppress, true);
            document.removeEventListener("selectstart", suppress, true);
            document.body.classList.remove("clik-no-callout");
        };
    }, []);

    const enterSwipeEdit = () => {
        if (mainAudioUrl) {
            setmode("swipe");
            setStage(1);
        } else {
            alert("Add Call To Action Audio First");
        }
    };

    const enterTouchEdit = () => {
        // Enter Touch Edit (Node Builder)
        setmode("touch");
        setStage(1);
    };

    /**
     * Node map. Shows the AI's original plan until hotspot data exists, then
     * switches to the live tree — user data overwrites default data.
     *
     * The plan is READ ONLY, and only its shape: node ids, parents and branch
     * labels, a few hundred bytes written by Storybook. Thumbnails come from
     * videoArray, which this component already receives. Nothing is written here.
     */
    const [showNodeMap, setShowNodeMap] = useState(false);
    const [planTopology, setPlanTopology] = useState(() =>
        parseStoredPlan(localStorage.getItem(STORED_PLAN_KEY))
    );
    const [planSlots, setPlanSlots] = useState<MediaSlot[]>(() =>
        parseStoredMediaSlots(localStorage.getItem(STORED_PLAN_KEY))
    );

    const openNodeMap = useCallback(() => {
        // Re-read on open: Storybook writes it from a different route, so there
        // is nothing to notify this component when it changes.
        const stored = localStorage.getItem(STORED_PLAN_KEY);
        setPlanTopology(parseStoredPlan(stored));
        setPlanSlots(parseStoredMediaSlots(stored));
        setShowNodeMap(true);
    }, []);

    const planGraph = useMemo(
        () =>
            planTopology
                ? graphFromTopology(
                    planTopology,
                    planThumbsFromSlots(planTopology, planSlots, videoArray || [])
                )
                : null,
        [planTopology, planSlots, videoArray]
    );

    const backToDefault = () => {
        setStage(0);
        setmode("");
    };

    const isSwipeEdit = stage === 1 && mode === "swipe";
    const isSwipePreview = stage === 2 && mode === "swipe";
    const isTouchEdit = stage === 1 && mode === "touch";
    const isTouchPreview = stage === 2 && mode === "touch";

    const previewRefs = useRef<any>(null);
    const registerPreviewRefs = (refs: any) => {
        previewRefs.current = refs;
    };

    // Freeze logic for Edit mode
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const freezeAtEnd = () => {
            try {
                v.loop = false;
                if (isFinite(v.duration) && v.duration > 0) {
                    const target = Math.max(0, v.duration - 0.05);
                    v.currentTime = target;
                }
                v.pause();
            } catch { }
        };

        if (isSwipePreview || isTouchPreview) {
            // The child player owns playback. This hidden element only measures
            // the media, and must not keep a second decoder running underneath it.
            v.pause();
        } else if (isTouchEdit) {
            if (v.readyState >= 1) freezeAtEnd();
            else {
                const onMeta = () => freezeAtEnd();
                v.addEventListener("loadedmetadata", onMeta, { once: true });
                return () => v.removeEventListener("loadedmetadata", onMeta);
            }
        } else {
            try {
                v.loop = true;
                if (!isSwipePreview && !isTouchPreview) {
                    v.play().catch(() => { });
                }
            } catch { }
        }
    }, [isTouchEdit, isSwipePreview, isTouchPreview]);

    const saveInteraction = useCallback(
        async () => {
            // flatten root audio (first item of each array)
            const flatRootAudio = {
                main: treeRoot.audio?.main?.[0] ?? null,
                left: treeRoot.audio?.left?.[0] ?? null,
                right: treeRoot.audio?.right?.[0] ?? null,
                top: treeRoot.audio?.top?.[0] ?? null,
                bottom: treeRoot.audio?.bottom?.[0] ?? null,
            };

            const payload = {
                id: interactionPostId,
                mode: mode === "swipe" ? 2 : 1,
                mainSrc: vid1,
                subs: {
                    left: treeRoot.subs[0],
                    right: treeRoot.subs[1],
                    top: treeRoot.subs[2],
                    bottom: treeRoot.subs[3],
                },

                // legacy / easy access audio
                audio: flatRootAudio,

                // full touch config (new system)
                touchConfig: {
                    hotspots: treeRoot.hotspots,
                    tree: treeRoot,
                    goodOutcomes: goodOutcomes,
                },
                intbg: intbg
            };

            const body = {
                values: {
                    ...payload,
                    userId: loggedUser?.id ?? null,
                },
            };

            try {
                const res = await axios.put(`${CLIK_URL}/interactionSave`, body, { withCredentials: true });
                console.log("✅ saved interaction", res.data);

                setTimeout(() => {
                    wipeInteractionState();
                    const routeState = { userId: loggedUser?.id };
                    navigate(`/pages`, { state: routeState });
                }, 500);
            } catch (err) {
                console.error("❌ saveInteraction failed", err);
                throw err;
            }
        },
        [
            mode,
            vid1,
            subs,
            touchHotspots,
            treeRoot,
            goodOutcomes,
            loggedUser,
            interactionPostId,
            CLIK_URL,
            wipeInteractionState,
            navigate,
            intbg
        ]
    );

    const onPublish = async () => {
        try {
            await saveInteraction();
        } catch { }
    };

    return (
        <div
            onClick={(e: any) => {
                if (e.currentTarget !== e.target) return;
                if (feeds) window.history.back();
            }}
            // A long press inside an interaction is a Hold gesture, never a request
            // for the browser's save/copy sheet. Android raises a real contextmenu
            // event for that sheet, so only preventDefault stops it; iOS is handled
            // by WebkitTouchCallout below. Touch only — desktop right-click is left
            // alone, since nothing here depends on suppressing it.
            onContextMenu={(e: any) => { if (matchMobile) e.preventDefault(); }}
            style={{
                position: "absolute",
                inset: 0,
                WebkitTouchCallout: "none",
                WebkitTapHighlightColor: "transparent",
                backgroundColor: feeds ? "rgba(40,40,40,0)" : "rgba(40,40,40,0.8)",
                display: "flex",
                width: matchMobile ? "100%" : "100%",
                height: "auto",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
                touchAction: "pan-y",
                overflow: "hidden",
                zIndex: feeds ? 4 : 900000,
                padding: "0px",
                backdropFilter: "blur(4px)",
            }}
        >
            {/* FRAME */}
            <div
                ref={frameRef}
                style={{
                    padding: "0px",
                    position: "relative",
                    width: (feeds && matchMobile) ? "100%" : (dims.width || "100vw"),
                    height: (feeds && matchMobile) ? mobileFrameHeight : (dims.height || "100vh"),
                }}
            >
                {/* Main Video (Visible usually, hidden in specific preview modes) */}
                <video
                    id="main-video"
                    ref={videoRef}
                    src={vid1}
                    playsInline
                    muted
                    loop
                    autoPlay={!isSwipePreview && !isTouchPreview}
                    preload={isSwipePreview || isTouchPreview ? 'metadata' : 'auto'}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        backgroundColor: "#000",
                        visibility:
                            !isSwipePreview && !isTouchPreview ? "visible" : "hidden",
                    }}
                />

                {/* --- CHILD UIs --- */}
                {!isSwipeEdit &&
                    !isSwipePreview &&
                    !isTouchEdit &&
                    !isTouchPreview ? (
                    <DefaultStageUI
                        intbg={intbg}
                        setintbg={setintbg}

                        mainAudioUrl={mainAudioUrl}
                        setAddVoice={setAddVoice}
                        setIdentifier={setIdentifier}
                        wipeInteractionState={wipeInteractionState}
                        vid2={subs[0]}
                        vid3={subs[1]}
                        videoArray={videoArray} // ✅ Passing 0-9 vids to Default Stage
                        dims={dims}
                        mode={mode}
                        setmode={setmode}
                        stage={stage}
                        setStage={setStage}
                        enterSwipeEdit={enterSwipeEdit}
                        enterTouchEdit={enterTouchEdit}
                        onOpenNodeMap={openNodeMap}
                    />
                ) : isSwipeEdit ? (
                    <SwipeEditStageUI
                        sub1AudioUrl={sub1AudioUrl}
                        sub2AudioUrl={sub2AudioUrl}
                        setSub1AudioUrl={setSub1AudioUrl}
                        setSub2AudioUrl={setSub2AudioUrl}
                        setAddVoice={setAddVoice}
                        setIdentifier={setIdentifier}
                        onSwipe={() => { }}
                        backToDefault={backToDefault}
                        subs={subs}
                        setSubs={setSubs}
                        goToPreview={() => setStage(2)}
                    />
                ) : isSwipePreview ? (
                    <SwipePreviewStageUI
                        interactionPostId={interactionPostId}
                        snapshotObscured={snapshotObscured}
                        mainAudioUrl={mainAudioUrl}
                        sub1AudioUrl={sub1AudioUrl}
                        sub2AudioUrl={sub2AudioUrl}
                        wipeInteractionState={wipeInteractionState}
                        feeds={feeds}
                        onPublish={onPublish}
                        mainSrc={vid1}
                        subs={subs}
                        registerRefs={registerPreviewRefs}
                        backToEdit={() => setStage(1)}
                    />
                ) : isTouchEdit ? (
                    // ✅ THE NEW NODE BUILDER
                    <TouchEditStageUI
                        intbg={intbg}
                        backToDefault={backToDefault}
                        goToPreview={() => setStage(2)} // Goes to Touch Preview
                        hotspots={treeRoot.hotspots}
                        setHotspots={setTouchHotspots}
                        subs={treeRoot.subs}
                        // Pass Tree State
                        treeRoot={treeRoot}
                        setTreeRoot={setTreeRoot}
                        // Pass Data
                        videoArray={videoArray || []} // Provide all available videos
                        // Audio
                        sub1AudioUrl={sub1AudioUrl}
                        sub2AudioUrl={sub2AudioUrl}
                        setSub1AudioUrl={setSub1AudioUrl}
                        topAudioUrl={topAudioUrl}
                        bottomAudioUrl={bottomAudioUrl}
                        setTopAudioUrl={setTopAudioUrl}
                        setBottomAudioUrl={setBottomAudioUrl}
                        setSub2AudioUrl={setSub2AudioUrl}
                        setAddVoice={setAddVoice}
                        setIdentifier={setIdentifier}
                        // 🛑 PASS LOADING STATE
                        isGenerating={isGenerating}
                    />
                ) : (
                    // ✅ THE NEW TREE PLAYER
                    <TouchPreviewStageUI
                        snapshotObscured={snapshotObscured}
                        setIsPreloaded={setIsPreloaded}
                        isPreloaded={isPreloaded}
                        // ✅ Creator preview now honours "Use this Audio for all scenes"
                        // instead of being forced to 0, so the toggle can be tested
                        // before publishing rather than only in the feed.
                        intbg={intbg}
                        // The background track is the ROOT main audio. In feed that
                        // arrives as the saved row.mainaud; in creator it is the live
                        // mainAudioUrl, which is the same value that gets published.
                        // feedData is `[]` in creator mode, hence the optional access.
                        feedDataMainAud={
                            feeds
                                ? feedData?.mainaud
                                : (Array.isArray(mainAudioUrl) ? mainAudioUrl[0] : mainAudioUrl)
                        }
                        setActiveStory={setActiveStory}
                        mainAudioUrl={mainAudioUrl}
                        sub1AudioUrl={sub1AudioUrl}
                        sub2AudioUrl={sub2AudioUrl}
                        feeds={feeds ? feedData : false}
                        onPublish={onPublish}
                        topAudioUrl={topAudioUrl}
                        bottomAudioUrl={bottomAudioUrl}
                        stage={stage}
                        backToEdit={() => setStage(1)}
                        mainSrc={vid1}
                        subs={treeRoot.subs}
                        hotspots={treeRoot.hotspots}
                        nestedTree={treeRoot}
                        videoArray={videoArray || []}
                        interactionPostId={interactionPostId}
                        goodOutcomes={goodOutcomes}
                        setGoodOutcomes={setGoodOutcomes}
                    />
                )}

                <Texttospeech
                    interactionPostId={interactionPostId}
                    Addvoice={addVoice}
                    identifier={identifier}
                    onClose={() => setAddVoice(false)}
                    mainAudioUrlx={mainAudioUrlx}
                    sub1AudioUrlx={sub1AudioUrlx}
                    sub2AudioUrlx={sub2AudioUrlx}
                    setMainAudioUrlx={setMainAudioUrlx}
                    setSub1AudioUrlx={setSub1AudioUrlx}
                    setSub2AudioUrlx={setSub2AudioUrlx}
                    topAudioUrlx={topAudioUrlx}
                    bottomAudioUrlx={bottomAudioUrlx}
                    mainAudioUrl={mainAudioUrl}
                    sub1AudioUrl={sub1AudioUrl}
                    sub2AudioUrl={sub2AudioUrl}
                    setMainAudioUrl={setMainAudioUrl}
                    setTopAudioUrlx={setTopAudioUrlx}
                    setBottomAudioUrlx={setBottomAudioUrlx}
                    setSub1AudioUrl={setSub1AudioUrl}
                    setSub2AudioUrl={setSub2AudioUrl}
                    // 🛑 PASS SETTER DOWN
                    setIsGenerating={setIsGenerating}
                    topAudioUrl={topAudioUrl}
                    bottomAudioUrl={bottomAudioUrl}
                    setTopAudioUrl={setTopAudioUrl}
                    setBottomAudioUrl={setBottomAudioUrl}
                />
            </div>

            <InteractionNodeMap
                open={showNodeMap}
                onClose={() => setShowNodeMap(false)}
                treeRoot={treeRoot}
                planGraph={planGraph}
                slots={planSlots}
            />
        </div>
    );
};

export default InteractInput;
