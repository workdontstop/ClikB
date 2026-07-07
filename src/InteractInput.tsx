import React, { useEffect, useRef, useState, useCallback } from "react";
import DefaultStageUI from "./DefaultStageUI";
import SwipeEditStageUI from "./SwipeEditStageUI";
import SwipePreviewStageUI from "./SwipePreviewStageUI";
import TouchEditStageUI from "./TouchEditStageUI"; // âœ… The New Builder
import TouchPreviewStageUI, { InteractionNode, Hotspot } from "./TouchPreviewStageUI"; // âœ… The New Player
import { matchMobile } from "./DetectDevice";
import Texttospeech from "./Texttospeech";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import type { Dispatch, SetStateAction } from "react";

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
    touchHotspots: [Hotspot, Hotspot];
    setTouchHotspots: Dispatch<SetStateAction<[Hotspot, Hotspot]>>;
    feeds: boolean;
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
    videoArray: any; // âœ… Ensure this contains the list of 9 videos
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

    // Subs state (Legacy/Flat support)
    const [subs, setSubs] = useState<[string, string]>([vid2, vid3]);

    const [isPreloaded, setIsPreloaded] = useState(false);

    const [treeRoot, setTreeRoot] = useState<InteractionNode>({
        id: "root",
        mainSrc: vid1,
        subs: feeds ? [vid2, vid3] : ["", ""],
        hotspots: touchHotspots,
        audio: {
            main: mainAudioUrl ? [mainAudioUrl] : [],
            left: sub1AudioUrl ? [sub1AudioUrl] : [],
            right: sub2AudioUrl ? [sub2AudioUrl] : [],
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
    const [identifier, setIdentifier] = useState<0 | 1 | 2>(0);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // ðŸ›‘ NEW STATE: Track if audio is currently being generated
    const [isGenerating, setIsGenerating] = useState(false);

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

    // ðŸ”¹ HYDRATE FROM feedData WHEN feeds === true
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
                const hotspotsFromFeed: [Hotspot, Hotspot] =
                    touchConfig.hotspots ||
                    touchConfig.tree?.hotspots ||
                    touchHotspots;

                const loadedOutcomes = touchConfig.goodOutcomes || [];

                const normalizeNode = (node: any): InteractionNode => {
                    const rawAudio = node.audio || {};
                    const n: InteractionNode = {
                        id: node.id ?? "root",
                        mainSrc: node.mainSrc ?? vid1,
                        subs: node.subs ?? [vid2, vid3],
                        hotspots: node.hotspots || hotspotsFromFeed || touchHotspots,
                        autoPlaySrc: node.autoPlaySrc || "", // âœ… Hydrate autoPlaySrc
                        autoPlayIsVictory: node.autoPlayIsVictory || false, // âœ… Hydrate autoPlayIsVictory
                        audio: {
                            main: toArr(rawAudio.main),
                            left: toArr(rawAudio.left),
                            right: toArr(rawAudio.right),
                        },
                        children: {},
                    };

                    if (node.children) {
                        n.children = {};
                        if (node.children.left) {
                            n.children.left = normalizeNode(node.children.left);
                        }
                        if (node.children.right) {
                            n.children.right = normalizeNode(node.children.right);
                        }
                        if (node.children.autoPlay) {
                            n.children.autoPlay = normalizeNode(node.children.autoPlay); // âœ… Hydrate children.autoPlay
                        }
                    }

                    // âœ… Auto-generate autoPlay child if autoPlaySrc is present but the child node is missing
                    if (n.autoPlaySrc && !n.children.autoPlay) {
                        n.children.autoPlay = {
                            id: `${n.id}-autoPlay`,
                            mainSrc: n.autoPlaySrc,
                            subs: ["", ""],
                            hotspots: [{ id: "left", x: 0.25, y: 0.5, r: 0.15 }, { id: "right", x: 0.75, y: 0.5, r: 0.15 }],
                            audio: { main: [], left: [], right: [] }
                        };
                    }

                    return n;
                };

                const treeFromFeed = touchConfig.tree || touchConfig;
                const normalizedRoot = normalizeNode(treeFromFeed);

                setTreeRoot(normalizedRoot);
                setTouchHotspots(hotspotsFromFeed);
                setSubs(normalizedRoot.subs);
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



    // Sync "Flat" props to "Tree" state whenever flat props change (e.g. from DefaultStage)
    useEffect(() => {
        setSubs([vid2, vid3]);

        // Only update root basics, preserve children if they exist
        setTreeRoot((prev) => ({
            ...prev,
            mainSrc: vid1,
            //    subs: [vid2, vid3],
            hotspots: touchHotspots,
            audio: {
                main: mainAudioUrl ? [mainAudioUrl] : [],
                left: sub1AudioUrl ? [sub1AudioUrl] : [],
                right: sub2AudioUrl ? [sub2AudioUrl] : [],
            },
        }));
    }, [vid1, vid2, vid3, touchHotspots, mainAudioUrl, sub1AudioUrl, sub2AudioUrl]);

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

        if (isTouchEdit) {
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
            };

            const payload = {
                id: interactionPostId,
                mode: mode === "swipe" ? 2 : 1,
                mainSrc: vid1,
                subs: { left: subs[0], right: subs[1] },

                // legacy / easy access audio
                audio: flatRootAudio,

                // full touch config (new system)
                touchConfig: {
                    hotspots: touchHotspots,
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
                const res = await axios.put(`${CLIK_URL}/interactionSave`, body);
                console.log("âœ… saved interaction", res.data);

                setTimeout(() => {
                    wipeInteractionState();
                    const routeState = { userId: loggedUser?.id };
                    navigate(`/pages`, { state: routeState });
                }, 500);
            } catch (err) {
                console.error("âŒ saveInteraction failed", err);
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
            style={{
                position: "absolute",
                inset: 0,
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
                    height: (feeds && matchMobile) ? "100vh" : (dims.height || "100vh"),
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
                    autoPlay
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
                        videoArray={videoArray} // âœ… Passing 0-9 vids to Default Stage
                        dims={dims}
                        mode={mode}
                        setmode={setmode}
                        stage={stage}
                        setStage={setStage}
                        enterSwipeEdit={enterSwipeEdit}
                        enterTouchEdit={enterTouchEdit}
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
                    // âœ… THE NEW NODE BUILDER
                    <TouchEditStageUI
                        intbg={intbg}
                        backToDefault={backToDefault}
                        goToPreview={() => setStage(2)} // Goes to Touch Preview
                        hotspots={touchHotspots}
                        setHotspots={setTouchHotspots}
                        subs={subs}
                        // Pass Tree State
                        treeRoot={treeRoot}
                        setTreeRoot={setTreeRoot}
                        // Pass Data
                        videoArray={videoArray || []} // Provide all available videos
                        // Audio
                        sub1AudioUrl={sub1AudioUrl}
                        sub2AudioUrl={sub2AudioUrl}
                        setSub1AudioUrl={setSub1AudioUrl}
                        setSub2AudioUrl={setSub2AudioUrl}
                        setAddVoice={setAddVoice}
                        setIdentifier={setIdentifier}
                        // ðŸ›‘ PASS LOADING STATE
                        isGenerating={isGenerating}
                    />
                ) : (
                    // âœ… THE NEW TREE PLAYER
                    <TouchPreviewStageUI
                        setIsPreloaded={setIsPreloaded}
                        isPreloaded={isPreloaded}
                        intbg={feeds ? intbg : 0}
                        feedDataMainAud={feedData.mainaud}
                        setActiveStory={setActiveStory}
                        mainAudioUrl={mainAudioUrl}
                        sub1AudioUrl={sub1AudioUrl}
                        sub2AudioUrl={sub2AudioUrl}
                        feeds={feeds ? feedData : false}
                        onPublish={onPublish}
                        stage={stage}
                        backToEdit={() => setStage(1)}
                        mainSrc={vid1}
                        subs={subs}
                        hotspots={touchHotspots}
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
                    mainAudioUrl={mainAudioUrl}
                    sub1AudioUrl={sub1AudioUrl}
                    sub2AudioUrl={sub2AudioUrl}
                    setMainAudioUrl={setMainAudioUrl}
                    setSub1AudioUrl={setSub1AudioUrl}
                    setSub2AudioUrl={setSub2AudioUrl}
                    // ðŸ›‘ PASS SETTER DOWN
                    setIsGenerating={setIsGenerating}
                />
            </div>
        </div>
    );
};

export default InteractInput;
