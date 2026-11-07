import React, { useMemo, useState, useEffect, useRef } from "react";
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { createPortal } from "react-dom";
import { Box, Button, Typography, Backdrop, Fade, LinearProgress } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { InteractionExperienceMode } from "./interactionExperienceMode";

interface PublishLoader2Props {
    onPreview?: () => void;
    spatialVerified?: boolean;
    onSpatialPublish?: () => Promise<void>;
    onPrepareHotspotSearch?: () => Promise<void>;
    open: boolean;
    fromCreationDeck?: boolean;
    inCreationDeck?: boolean;
    deckDetailHost?: HTMLElement | null;
    onClose: () => void;
    type: number; // 0=Memes, 1=Stories, 3=Interactions
    interactionExperienceMode?: InteractionExperienceMode | null;
    darkMode: boolean;
    appColor: string;
    matchMobile: boolean;

    // Data
    generatedImagesFlux: string[];
    VideoArrayCloud: string[];
    generatedAudios: string[];
    upscaledSceneRefs?: Array<{ role: "a-shot" | "b-shot"; sourceIndex: number; bShotIndex?: number; url: string }>;
    bShotImages: string[][];
    bShotVideos: string[][];
    bShotPrompts: string[][];
    postId?: number | string;
    usedanimate?: boolean;
    ratioKey?: number;

    // Narration Props
    musicname?: string;
    musicUrl?: string;
    MemeMusic?: string;

    // Type 3 Actions
    ClosePromptInput?: () => void;
    setflip?: (val: boolean) => void;
    setminimisePrompt?: (val: boolean) => void;
    onProcessLambdaRecipe?: (recipe: any) => Promise<void>;
    lambdaPublishStatus?: {
        active: boolean;
        progress: number;
        message: string;
        stage?: string;
        error?: string;
    };
    musicMode?: boolean;
    clipDurationSec?: number;
    musicSegments?: { index: number; start: number; end: number }[];
    musicBreakerSec?: 5 | 10;
    activatevoicenarration?: boolean;
    autoStart?: boolean;
}

const PublishLoader2: React.FC<PublishLoader2Props> = ({
    onPreview,
    spatialVerified = false,
    onSpatialPublish,
    onPrepareHotspotSearch,
    open,
    fromCreationDeck = false,
    inCreationDeck = false,
    deckDetailHost = null,
    onClose,
    type,
    interactionExperienceMode = null,
    darkMode,
    appColor,
    matchMobile,
    generatedImagesFlux,
    VideoArrayCloud,
    generatedAudios,
    upscaledSceneRefs = [],
    bShotImages,
    bShotVideos,
    bShotPrompts,
    postId,
    usedanimate,
    ratioKey,
    musicname,
    musicUrl,
    MemeMusic,
    ClosePromptInput,
    setflip,
    setminimisePrompt,
    onProcessLambdaRecipe,
    lambdaPublishStatus,
    musicMode = false,
    clipDurationSec,
    musicSegments = [],
    musicBreakerSec,
    activatevoicenarration = true,
    autoStart = false,
}) => {

    const funEmojis = ["🚀", "🎬", "🍿", "🎥", "🎞️", "🔮", "✨", "💫", "🔥", "⚡"];
    const [currentEmoji, setCurrentEmoji] = useState(darkMode ? "🎬" : "🚀");
    const [spatialPublishBusy, setSpatialPublishBusy] = useState(false);
    const [spatialPublishError, setSpatialPublishError] = useState("");
    const [hotspotSearchBusy, setHotspotSearchBusy] = useState(false);
    const [hotspotSearchError, setHotspotSearchError] = useState('');
    const hotspotSearchInFlight = useRef(false);
    const liveOpen = useRef(open);
    useEffect(() => { liveOpen.current = open; return () => { liveOpen.current = false; }; }, [open]);

    useEffect(() => {
        if (!open) {
            setSpatialPublishBusy(false);
            setSpatialPublishError("");
            setHotspotSearchError('');
        }
    }, [open]);

    const isUsableUrl = (url?: string | null) => (
        typeof url === "string" &&
        url.trim() !== "" &&
        url !== "EMPTY" &&
        url !== "EMPTY_BSHOT" &&
        url !== "ERROR" &&
        url !== "undefined" &&
        url !== "null"
    );
    const isMusicVideoMode = Boolean(musicMode && type === 1);
    const [musicUnavailable, setMusicUnavailable] = useState(false);

    useEffect(() => {
        if (!open || !isUsableUrl(musicUrl)) {
            setMusicUnavailable(false);
            return;
        }
        let cancelled = false;
        const testAudio = new Audio();
        let resolved = false;

        const markOk = () => {
            if (resolved || cancelled) return;
            resolved = true;
            setMusicUnavailable(false);
        };

        const markFailed = () => {
            if (resolved || cancelled) return;
            resolved = true;
            setMusicUnavailable(true);
        };

        fetch(musicUrl!, { method: 'HEAD' })
            .then(res => {
                if (res.ok) {
                    markOk();
                } else if (res.status === 403 || res.status === 404) {
                    markFailed();
                } else {
                    testAudio.src = musicUrl!;
                }
            })
            .catch(() => {
                testAudio.src = musicUrl!;
            });

        testAudio.oncanplaythrough = markOk;
        testAudio.onloadedmetadata = markOk;
        testAudio.onerror = markFailed;

        return () => {
            cancelled = true;
            testAudio.src = '';
            testAudio.oncanplaythrough = null;
            testAudio.onloadedmetadata = null;
            testAudio.onerror = null;
        };
    }, [open, musicUrl]);
    const isSpatialInteraction = type === 3 && interactionExperienceMode === "spatial";
    const isHotspotInteraction = type === 3 && interactionExperienceMode === "hotspots";
    const requiredMusicVideoSlots = Math.max(
        generatedImagesFlux?.length || 0,
        VideoArrayCloud?.length || 0
    );
    const missingMusicVideoSlots = useMemo(() => {
        if (!isMusicVideoMode) return [];
        return Array.from({ length: requiredMusicVideoSlots }, (_, index) => index)
            .filter((index) => !isUsableUrl(VideoArrayCloud?.[index]));
    }, [isMusicVideoMode, requiredMusicVideoSlots, VideoArrayCloud]);
    const allMusicVideosReady = !isMusicVideoMode || (
        requiredMusicVideoSlots > 0 &&
        missingMusicVideoSlots.length === 0
    );
    // --- Interaction A-shot completeness (type === 3 only) ---
    // Every A-shot scene must have a rendered video. B-shots are optional and
    // never gate the save; B-shot images without a video are simply skipped.
    const requiredInteractionSlots = Math.max(
        generatedImagesFlux?.length || 0,
        VideoArrayCloud?.length || 0
    );
    const missingInteractionVideoSlots = useMemo(() => {
        if (!isHotspotInteraction) return [];
        return Array.from({ length: requiredInteractionSlots }, (_, index) => index)
            .filter((index) => !isUsableUrl(VideoArrayCloud?.[index]));
    }, [isHotspotInteraction, requiredInteractionSlots, VideoArrayCloud]);
    const allInteractionAShotsReady = (
        requiredInteractionSlots > 0 &&
        missingInteractionVideoSlots.length === 0
    );

    const autoStartRef = useRef(false);
    const [musicMetadataDurationSec, setMusicMetadataDurationSec] = useState<number | null>(null);

    useEffect(() => {
        if (!isMusicVideoMode || !isUsableUrl(musicUrl)) {
            setMusicMetadataDurationSec(null);
            return;
        }

        let cancelled = false;
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "metadata";

        const handleLoadedMetadata = () => {
            if (cancelled) return;
            const duration = Number(audio.duration);
            setMusicMetadataDurationSec(Number.isFinite(duration) && duration > 0 ? duration : null);
        };

        const handleError = () => {
            if (!cancelled) setMusicMetadataDurationSec(null);
        };

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("error", handleError);
        audio.src = musicUrl || "";

        return () => {
            cancelled = true;
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("error", handleError);
            audio.removeAttribute("src");
            audio.load();
        };
    }, [isMusicVideoMode, musicUrl]);

    const hasProvidedMusicSegmentTiming = isMusicVideoMode && Array.isArray(musicSegments) && musicSegments.some((segment) => {
        const start = Number(segment?.start);
        const end = Number(segment?.end);
        return Number.isFinite(start) && Number.isFinite(end) && end > start;
    });
    const hasMusicMetadataTiming = isMusicVideoMode &&
        Number.isFinite(Number(musicMetadataDurationSec)) &&
        Number(musicMetadataDurationSec) > 0;
    const hasMusicTimingForPublish = !isMusicVideoMode || hasProvidedMusicSegmentTiming || hasMusicMetadataTiming;

    const getModeName = () => {
        if (type === 0) return "meme";
        if (type === 1) return "story";
        if (type === 3) return "interactions";
        return "unknown";
    };

    const getOutputConfig = () => {
        if (ratioKey === 2) {
            return { ratioKey, width: 1080, height: 1080, fps: 24 };
        }

        if (ratioKey === 3) {
            return { ratioKey, width: 1920, height: 1080, fps: 24 };
        }

        return { ratioKey: ratioKey || 1, width: 1080, height: 1920, fps: 24 };
    };

    const clearInteractionVideoStorage = () => {
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && /^localstoragevid\d+$/.test(key)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach((key) => localStorage.removeItem(key));
        localStorage.removeItem("localInteractionpostId");

        return keysToRemove;
    };

    const lambdaRecipePayload = useMemo(() => {
        const mode = isMusicVideoMode ? "music-video" : getModeName();
        const isStoryMode = type === 1;
        const requestedClipDuration = Number(clipDurationSec);
        const fixedVideoSlotDurationSec = Number.isFinite(requestedClipDuration) && requestedClipDuration > 0
            ? requestedClipDuration
            : 5;
        const requestedMusicBreakerSec = Number(musicBreakerSec);
        const musicVideoStageDurationSec = isMusicVideoMode && (requestedMusicBreakerSec === 5 || requestedMusicBreakerSec === 10)
            ? requestedMusicBreakerSec
            : fixedVideoSlotDurationSec;
        const musicVideoLayerDurationSec = musicVideoStageDurationSec * 2;
        const totalVisualSlots = isMusicVideoMode ? Math.max(
            VideoArrayCloud?.length || 0,
            generatedImagesFlux?.length || 0
        ) : Math.max(
            VideoArrayCloud?.length || 0,
            generatedImagesFlux?.length || 0,
            bShotVideos?.length || 0,
            bShotImages?.length || 0,
            bShotPrompts?.length || 0
        );
        const totalScenes = isStoryMode
            ? isMusicVideoMode
                ? Math.ceil(totalVisualSlots / 2)
                : Math.max(Math.ceil(totalVisualSlots / 2), generatedAudios?.length || 0)
            : totalVisualSlots;
        const normalizedUpscaledSceneRefs = Array.isArray(upscaledSceneRefs)
            ? upscaledSceneRefs.filter((ref) => isUsableUrl(ref?.url))
            : [];
        const hasUpscaledSource = normalizedUpscaledSceneRefs.length > 0;
        const getUpscaledSceneRef = (role: "a-shot" | "b-shot", sourceIndex: number, bShotIndex?: number) => (
            normalizedUpscaledSceneRefs.find((ref) => (
                ref.role === role &&
                ref.sourceIndex === sourceIndex &&
                (role === "a-shot" || ref.bShotIndex === bShotIndex)
            )) || null
        );

        const getMusicVideoLayerDurationSec = (sceneIndex: number) => {
            const segment = Array.isArray(musicSegments) ? musicSegments[sceneIndex] : null;

            if (segment) {
                const start = Number(segment.start);
                const end = Number(segment.end);
                if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                    return Math.min(musicVideoLayerDurationSec, Math.max(0, end - start));
                }
            }

            const musicDurationSec = Number(musicMetadataDurationSec);
            if (Number.isFinite(musicDurationSec) && musicDurationSec > 0) {
                const layerStart = sceneIndex * musicVideoLayerDurationSec;
                return Math.min(musicVideoLayerDurationSec, Math.max(0, musicDurationSec - layerStart));
            }

            return musicVideoLayerDurationSec;
        };

        const getMusicVideoStageDurationSec = (sceneIndex: number, stageCount: number) => {
            const layerDurationSec = getMusicVideoLayerDurationSec(sceneIndex);
            if (!Number.isFinite(layerDurationSec) || layerDurationSec <= 0) return 0;

            const divisor = stageCount > 1 ? 2 : 1;
            return Math.min(musicVideoStageDurationSec, layerDurationSec / divisor);
        };

        const addVisualSlot = (
            visuals: any[],
            sourceIndex: number,
            sceneIndex: number,
            stage: "stage-a" | "stage-b" | null,
            targetDurationSec?: number
        ) => {
            const normalizedTargetDurationSec = Number(targetDurationSec);
            if (isMusicVideoMode && (!Number.isFinite(normalizedTargetDurationSec) || normalizedTargetDurationSec <= 0)) {
                return;
            }

            const aShotVideo = VideoArrayCloud?.[sourceIndex];
            const aShotImage = generatedImagesFlux?.[sourceIndex];
            const aShotUpscaledRef = getUpscaledSceneRef("a-shot", sourceIndex);

            if (isUsableUrl(aShotVideo)) {
                visuals.push({
                    role: "a-shot",
                    type: "video",
                    url: aShotVideo,
                    sceneIndex,
                    sourceIndex,
                    stage,
                    source: "VideoArrayCloud",
                    targetDurationSec,
                    fallbackImageUrl: isUsableUrl(aShotImage) ? aShotImage : null,
                    isUpscaledSource: Boolean(aShotUpscaledRef),
                    upscaledSourceUrl: aShotUpscaledRef?.url || null
                });
            } else if (!isMusicVideoMode && isUsableUrl(aShotImage)) {
                visuals.push({
                    role: "a-shot",
                    type: "image",
                    url: aShotImage,
                    sceneIndex,
                    sourceIndex,
                    stage,
                    source: "generatedImagesFlux",
                    isUpscaledSource: Boolean(aShotUpscaledRef),
                    upscaledSourceUrl: aShotUpscaledRef?.url || null
                });
            }

            if (isMusicVideoMode) return;

            const bShotCount = Math.max(
                bShotVideos?.[sourceIndex]?.length || 0,
                bShotImages?.[sourceIndex]?.length || 0,
                bShotPrompts?.[sourceIndex]?.length || 0
            );

            for (let bShotIndex = 0; bShotIndex < bShotCount; bShotIndex++) {
                const bShotVideo = bShotVideos?.[sourceIndex]?.[bShotIndex];
                const bShotImage = bShotImages?.[sourceIndex]?.[bShotIndex];
                const prompt = bShotPrompts?.[sourceIndex]?.[bShotIndex] || null;
                const bShotUpscaledRef = getUpscaledSceneRef("b-shot", sourceIndex, bShotIndex);

                if (isUsableUrl(bShotVideo)) {
                    visuals.push({
                        role: "b-shot",
                        type: "video",
                        url: bShotVideo,
                        sceneIndex,
                        sourceIndex,
                        stage,
                        bShotIndex,
                        prompt,
                        source: "bShotVideos",
                        targetDurationSec,
                        fallbackImageUrl: isUsableUrl(bShotImage) ? bShotImage : null,
                        isUpscaledSource: Boolean(bShotUpscaledRef),
                        upscaledSourceUrl: bShotUpscaledRef?.url || null
                    });
                } else if (isUsableUrl(bShotImage)) {
                    visuals.push({
                        role: "b-shot",
                        type: "image",
                        url: bShotImage,
                        sceneIndex,
                        sourceIndex,
                        stage,
                        bShotIndex,
                        prompt,
                        source: "bShotImages",
                        isUpscaledSource: Boolean(bShotUpscaledRef),
                        upscaledSourceUrl: bShotUpscaledRef?.url || null
                    });
                }
            }
        };

        const scenes = Array.from({ length: totalScenes }, (_, sceneIndex) => {
            const visuals: any[] = [];
            const narrationUrl = isStoryMode && !isMusicVideoMode && activatevoicenarration
                ? generatedAudios?.[sceneIndex]
                : null;
            const hasSceneNarration = isUsableUrl(narrationUrl);
            const musicStageCount = isMusicVideoMode
                ? [
                    VideoArrayCloud?.[sceneIndex * 2],
                    VideoArrayCloud?.[sceneIndex * 2 + 1]
                ].filter(isUsableUrl).length
                : 0;
            const targetDurationSec = isMusicVideoMode
                ? getMusicVideoStageDurationSec(sceneIndex, musicStageCount)
                : !hasSceneNarration
                    ? fixedVideoSlotDurationSec
                    : undefined;

            if (isStoryMode) {
                addVisualSlot(visuals, sceneIndex * 2, sceneIndex, "stage-a", targetDurationSec);
                addVisualSlot(visuals, sceneIndex * 2 + 1, sceneIndex, "stage-b", targetDurationSec);
            } else {
                addVisualSlot(visuals, sceneIndex, sceneIndex, null, targetDurationSec);
            }

            const fixedVideoOnlyScene = !hasSceneNarration && visuals.length > 0 && visuals.every((visual) => (
                visual.type === "video" && Number.isFinite(Number(visual.targetDurationSec)) && Number(visual.targetDurationSec) > 0
            ));

            return {
                sceneIndex,
                targetDurationSec: fixedVideoOnlyScene
                    ? visuals.reduce((sum: number, visual: any) => sum + Number(visual.targetDurationSec || 0), 0)
                    : null,
                narration: hasSceneNarration
                    ? {
                        url: narrationUrl,
                        source: "generatedAudios",
                        sourceIndex: sceneIndex
                    }
                    : null,
                visuals
            };
        }).filter((scene) => scene.visuals.length > 0 || scene.narration);

        const hasNarration = scenes.some((scene) => !!scene.narration);
        const bgDb = isMusicVideoMode ? 0 : usedanimate ? -60 : mode === "meme" ? -13 : hasNarration ? -25 : -13;
        const musicTimelineDurationSec = isMusicVideoMode
            ? scenes.reduce((sum: number, scene: any) => sum + Number(scene.targetDurationSec || 0), 0)
            : null;

        return {
            schemaVersion: 1,
            pipeline: "lambda-ffmpeg-scene-recipe",
            postId: postId ?? null,
            mode,
            type,
            output: getOutputConfig(),
            hasNarration,
            usedanimate: !!usedanimate,
            forceChunkedRender: hasUpscaledSource,
            renderHints: {
                forceChunkedRender: hasUpscaledSource,
                chunkReason: hasUpscaledSource ? "upscaled-source" : null,
                upscaledSceneRefs: normalizedUpscaledSceneRefs
            },
            backgroundMusic: {
                enabled: isUsableUrl(musicUrl),
                displayName: musicname || "Music",
                url: isUsableUrl(musicUrl) ? musicUrl : null,
                db: bgDb
            },
            musicTimelineDurationSec,
            rules: {
                imageDurationWithoutNarrationSec: 5,
                imageTransition: {
                    enabled: true,
                    type: "xfade",
                    durationSec: 0.2,
                    onlyBetweenImages: true
                },
                videoAudioVolumeWithNarration: 0.25,
                transition: {
                    betweenScenes: false,
                    type: "cut",
                    durationSec: 0
                },
                loopLastVisualToNarration: true,
                normalizeResolutionAndFps: true,
                injectSilentAudioWhenMissing: true
            },
            scenes
        };
    }, [
        isMusicVideoMode,
        type,
        postId,
        usedanimate,
        ratioKey,
        musicname,
        musicUrl,
        clipDurationSec,
        musicSegments,
        musicBreakerSec,
        musicMetadataDurationSec,
        activatevoicenarration,
        generatedImagesFlux,
        VideoArrayCloud,
        generatedAudios,
        bShotImages,
        bShotVideos,
        bShotPrompts,
        upscaledSceneRefs
    ]);

    useEffect(() => {
        if (!open) return;
        const interval = setInterval(() => {
            setCurrentEmoji(funEmojis[Math.floor(Math.random() * funEmojis.length)]);
        }, 1500);
        return () => clearInterval(interval);
    }, [open, darkMode]);

    // --- Derived Extraction Logic ---
    const extractedData = useMemo(() => {
        const interleavedVideos: string[] = [];
        const interleavedImages: string[] = [];
        const validAudios: string[] = [];
        
        let validBShotVideosCount = 0;
        let validBShotImagesCount = 0;

        const totalScenes = Math.max(
            VideoArrayCloud?.length || 0,
            generatedImagesFlux?.length || 0,
            generatedAudios?.length || 0,
            bShotVideos?.length || 0,
            bShotImages?.length || 0,
            bShotPrompts?.length || 0
        );

        for (let i = 0; i < totalScenes; i++) {
            // --- A-ROLL ---
            const aVid = VideoArrayCloud?.[i];
            if (aVid && aVid !== "EMPTY" && aVid.trim() !== "") interleavedVideos.push(aVid);

            const aImg = generatedImagesFlux?.[i];
            if (aImg && aImg !== "EMPTY_BSHOT" && aImg.trim() !== "") interleavedImages.push(aImg);

            const aAud = generatedAudios?.[i];
            if (aAud && aAud.trim() !== "") validAudios.push(aAud);

            // --- B-SHOTS ---
            if (bShotVideos && bShotVideos[i]) {
                for (let j = 0; j < bShotVideos[i].length; j++) {
                    const bVid = bShotVideos[i][j];
                    if (bVid && bVid !== "EMPTY_BSHOT" && bVid.trim() !== "") {
                        interleavedVideos.push(bVid);
                        validBShotVideosCount++;
                    }
                }
            }

            if (bShotImages && bShotImages[i]) {
                for (let j = 0; j < bShotImages[i].length; j++) {
                    const bImg = bShotImages[i][j];
                    if (bImg && bImg !== "EMPTY_BSHOT" && bImg.trim() !== "") {
                        interleavedImages.push(bImg);
                        validBShotImagesCount++;
                    }
                }
            }
        }

        return {
            validVideosCount: interleavedVideos.length,
            validImagesCount: interleavedImages.length,
            validAudiosCount: validAudios.length,
            bShotsIncludedCount: validBShotVideosCount + validBShotImagesCount,
            allValidVideos: interleavedVideos,
            allValidImages: interleavedImages,
            validAudios,
            hasBgMusic: !!musicUrl || !!musicname || !!MemeMusic
        };
    }, [VideoArrayCloud, bShotVideos, generatedImagesFlux, bShotImages, generatedAudios, bShotPrompts, musicUrl, musicname, MemeMusic]);

    const renderAssetSummary = useMemo(() => {
        const counts = {
            aShotImages: 0,
            aShotVideos: 0,
            bShotImages: 0,
            bShotVideos: 0,
            narration: 0,
            scenes: lambdaRecipePayload.scenes?.length || 0
        };

        lambdaRecipePayload.scenes?.forEach((scene: any) => {
            if (scene.narration) counts.narration++;

            scene.visuals?.forEach((visual: any) => {
                if (visual.role === "a-shot" && visual.type === "video") counts.aShotVideos++;
                if (visual.role === "a-shot" && visual.type === "image") counts.aShotImages++;
                if (visual.role === "b-shot" && visual.type === "video") counts.bShotVideos++;
                if (visual.role === "b-shot" && visual.type === "image") counts.bShotImages++;
            });
        });

        const visualParts: string[] = [];
        if (counts.aShotVideos > 0) visualParts.push("A-roll videos");
        if (counts.aShotImages > 0) visualParts.push("A-roll images");
        if (counts.bShotVideos > 0) visualParts.push("B-roll videos");
        if (counts.bShotImages > 0) visualParts.push("B-roll images");

        const featureParts: string[] = [];
        if (counts.narration > 0) featureParts.push("narration");
        if (lambdaRecipePayload.backgroundMusic?.enabled) featureParts.push("background music");

        const parts = [...visualParts, ...featureParts];
        if (parts.length === 0) return "Selected media";

        const formattedParts = parts.length > 1
            ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
            : parts[0];

        return formattedParts;
    }, [lambdaRecipePayload]);

    const mediaPillText = useMemo(() => {
        if (lambdaPublishStatus?.active) return renderAssetSummary;
        if (type !== 3) return renderAssetSummary;
        if (extractedData.bShotsIncludedCount > 0) return `${extractedData.bShotsIncludedCount} B-roll media`;
        if (extractedData.validAudiosCount > 0) return `${extractedData.validAudiosCount} audio track${extractedData.validAudiosCount === 1 ? "" : "s"}`;
        return "Selected media";
    }, [extractedData, lambdaPublishStatus, renderAssetSummary, type]);

    // --- State/Color Logic ---
    const postStateInfo = useMemo(() => {
        if (lambdaPublishStatus?.active) {
            return {
                text: lambdaPublishStatus.error ? "Render Failed" : "Rendering Video",
                subText: lambdaPublishStatus.message || "Preparing Lambda render...",
                color: lambdaPublishStatus.error ? "#ff6b6b" : appColor,
                bg: lambdaPublishStatus.error ? "rgba(255, 107, 107, 0.15)" : `${appColor}26`,
                canProcess: false,
                actionLabel: "Rendering..."
            };
        }

        if (isMusicVideoMode) {
            const readyVideoCount = VideoArrayCloud.filter(isUsableUrl).length;

            return {
                text: allMusicVideosReady
                    ? hasMusicTimingForPublish ? "Music Video Ready" : "Reading Music Timing"
                    : "Videos Required",
                subText: !allMusicVideosReady
                    ? `${readyVideoCount} / ${requiredMusicVideoSlots} videos ready. Generate every shot before publishing.`
                    : hasMusicTimingForPublish
                        ? `${readyVideoCount} / ${requiredMusicVideoSlots} videos ready. No narration or B-roll.`
                        : "Reading selected song timing before publishing.",
                color: appColor,
                bg: allMusicVideosReady && hasMusicTimingForPublish
                    ? `${appColor}26`
                    : "rgba(255, 152, 0, 0.15)",
                canProcess: allMusicVideosReady && hasMusicTimingForPublish,
                actionLabel: "Publish"
            };
        }

        if (isSpatialInteraction) {
            return {
                text: spatialVerified ? "Preview verified" : "Interaction Mode",
                subText: spatialVerified
                    ? "Your spatial experience is ready to save."
                    : "Try your spatial experience. You can return and continue creating.",
                color: appColor,
                bg: `${appColor}26`,
                canProcess: spatialVerified ? Boolean(onSpatialPublish) && !spatialPublishBusy : Boolean(onPreview),
                actionLabel: spatialPublishBusy ? "Publishing..." : spatialVerified ? "Publish" : "Preview"
            };
        }

        if (isHotspotInteraction) {
            const readyAShotCount = requiredInteractionSlots - missingInteractionVideoSlots.length;
            return {
                text: "Hotspots Mode",
                subText: requiredInteractionSlots === 0
                    ? "No shots yet — generate your scenes before starting hotspot setup."
                    : allInteractionAShotsReady
                        ? `${extractedData.validVideosCount} Interleaved Videos Ready`
                        : `${readyAShotCount} / ${requiredInteractionSlots} A-roll videos ready. Every A-roll needs a video.`,
                color: appColor,
                bg: allInteractionAShotsReady ? `${appColor}26` : "rgba(255, 152, 0, 0.15)",
                canProcess: allInteractionAShotsReady,
                actionLabel: "Start Hotspot Setup"
            };
        }

        if (type === 3) {
            return {
                text: "Choose an interaction",
                subText: "Select Spatial or Hotspots before publishing.",
                color: appColor,
                bg: `${appColor}26`,
                canProcess: false,
                actionLabel: "Interaction mode required"
            };
        } else {
            return {
                text: `${type === 1 ? 'Story' : 'Meme'} Mode Ready`,
                subText: `${extractedData.validVideosCount} Videos, ${extractedData.validImagesCount} Images`,
                color: appColor,
                bg: `${appColor}26`,
                canProcess: extractedData.validVideosCount > 0 || extractedData.validImagesCount > 0,
                actionLabel: "Process Video"
            };
        }
    }, [type, extractedData, appColor, darkMode, lambdaPublishStatus, isMusicVideoMode, allMusicVideosReady, hasMusicTimingForPublish, requiredMusicVideoSlots, VideoArrayCloud, onPreview, onSpatialPublish, spatialPublishBusy, spatialVerified, isSpatialInteraction, isHotspotInteraction, requiredInteractionSlots, missingInteractionVideoSlots, allInteractionAShotsReady, musicUnavailable]);

    const presentationTitle = lambdaPublishStatus?.error ? 'Render Failed' : postStateInfo.text;
    const handleAction = async () => {
        if (musicUnavailable) {
            onClose();
            return;
        }
        if (lambdaPublishStatus?.active) return;
        if (isMusicVideoMode && (!allMusicVideosReady || !hasMusicTimingForPublish)) return;
        if (isHotspotInteraction && !allInteractionAShotsReady) return;

        if (isSpatialInteraction) {
            if (!spatialVerified) {
                onPreview?.();
                return;
            }
            if (!onSpatialPublish || spatialPublishBusy) return;
            setSpatialPublishBusy(true);
            setSpatialPublishError("");
            try {
                await onSpatialPublish();
            } catch (error: unknown) {
                setSpatialPublishError(error instanceof Error ? error.message : "Spatial experience could not be published.");
            } finally {
                setSpatialPublishBusy(false);
            }
            return;
        }

        if (isHotspotInteraction) {
            if (hotspotSearchInFlight.current) return;
            hotspotSearchInFlight.current = true;
            setHotspotSearchBusy(true);
            setHotspotSearchError('');
            try {
                if (!onPrepareHotspotSearch) throw new Error('Game search preparation is unavailable.');
                await onPrepareHotspotSearch();
                if (!liveOpen.current) return;
            } catch {
                setHotspotSearchError('Could not save the game search details. Retry to continue to Hotspot Setup.');
                return;
            } finally {
                hotspotSearchInFlight.current = false;
                setHotspotSearchBusy(false);
            }
            // Rewrite the complete, validated A/B sequence in one final handoff.
            const removedKeys = clearInteractionVideoStorage();
            const interactionVideos = extractedData.allValidVideos;

            if (postId !== undefined && postId !== null && String(postId).trim() !== "") {
                localStorage.setItem("localInteractionpostId", String(postId));
            }

            interactionVideos.forEach((videoUrl, index) => {
                localStorage.setItem(`localstoragevid${index + 1}`, videoUrl);
            });

            window.dispatchEvent(new CustomEvent("clikb-hotspot-storage-updated", {
                detail: { mode: "hotspots", postId: postId == null ? null : String(postId) }
            }));

            console.group("=== HOTSPOT INTERACTION HANDOFF ===");
            console.log("Post ID:", postId ?? "None");
            console.log("Removed stale localStorage video keys:", removedKeys);
            console.log("Final interleaved video order:", interactionVideos.map((videoUrl, index) => ({
                key: `localstoragevid${index + 1}`,
                videoUrl
            })));
            console.groupEnd();

            if (ClosePromptInput) ClosePromptInput();
            if (setflip) setflip(false);
            if (setminimisePrompt) setminimisePrompt(true);
            onClose();
            return;
        }

        if (type === 3) {
            return;
        } else {
            // STORY/MEME MODE: Log all data for AWS Lambda/FFmpeg later
            console.group("=== FINAL STORY/MEME PUBLISH DATA FOR PROCESSING ===");
            console.log("Mode:", type === 1 ? "Story" : "Meme");
            console.log("Post ID:", postId ?? "None");
            console.log("A-roll images:", generatedImagesFlux);
            console.log("A-roll videos:", VideoArrayCloud);
            console.log("Narration audios:", generatedAudios);
            console.log("B-roll images:", bShotImages);
            console.log("B-roll videos:", bShotVideos);
            console.log("B-roll prompts:", bShotPrompts);
            console.log("Interleaved valid images:", extractedData.allValidImages);
            console.log("Interleaved valid videos:", extractedData.allValidVideos);
            console.log("Valid narration audios:", extractedData.validAudios);
            console.log("Background music:", {
                enabled: !!MemeMusic,
                displayName: musicname || "Music",
                url: musicUrl || "None",
                musicname,
                MemeMusic,
                selected: musicUrl || musicname || MemeMusic || "None"
            });
            console.log("Counts:", {
                validImages: extractedData.validImagesCount,
                validVideos: extractedData.validVideosCount,
                validAudios: extractedData.validAudiosCount,
                bShotMediaIncluded: extractedData.bShotsIncludedCount
            });
            console.log("Lambda FFmpeg recipe payload:", lambdaRecipePayload);
            (window as any).__lastLambdaRecipePayload = lambdaRecipePayload;
            try {
                localStorage.setItem("lastLambdaRecipePayload", JSON.stringify(lambdaRecipePayload));
            } catch (error) {
                console.warn("Could not persist Lambda recipe payload:", error);
            }
            console.groupEnd();

            if (onProcessLambdaRecipe) {
                await onProcessLambdaRecipe(lambdaRecipePayload);
            } else {
                alert("Data Extracted! Check Console for final payload (Lambda & FFmpeg coming soon).");
                onClose();
            }
        }
    };

    useEffect(() => {
        if (!open) {
            autoStartRef.current = false;
            return;
        }

        if (!autoStart || autoStartRef.current || lambdaPublishStatus?.active || !postStateInfo.canProcess) {
            return;
        }

        autoStartRef.current = true;
        void handleAction();
    }, [open, autoStart, lambdaPublishStatus?.active, postStateInfo.canProcess, handleAction]);

    const publishActionKey = isSpatialInteraction
        ? spatialVerified ? 'publish_spatial' : 'preview_spatial'
        : isHotspotInteraction ? 'start_hotspot_setup' : 'process_video';
    const publishBinding = isSpatialInteraction
        ? spatialVerified
            ? cb('storybook_publish', 'publish_spatial', 'Publish verified spatial experience', 'handleAction', 'click', 'needs_confirmation')
            : cb('storybook_publish', 'preview_spatial', 'Open spatial preview before publishing', 'handleAction')
        : isHotspotInteraction
            ? cb('storybook_publish', 'start_hotspot_setup', 'Leave the storyboard and open the Hotspots creator', 'handleAction', 'click', 'needs_confirmation')
            : cb('storybook_publish', 'process_video', 'Process and publish the video', 'handleAction', 'click', 'needs_confirmation');
    useCreationControls('storybook_publish', 'PublishLoader2', open, {
        mode: presentationTitle, action: postStateInfo.actionLabel,
        actionKey: publishActionKey,
        canProcess: postStateInfo.canProcess, validImages: extractedData.validImagesCount,
        validVideos: extractedData.validVideosCount, validAudios: extractedData.validAudiosCount,
        bshotMediaIncluded: extractedData.bShotsIncludedCount,
        renderActive: Boolean(lambdaPublishStatus?.active),
        searchMetadataStatus: hotspotSearchBusy ? 'loading' : hotspotSearchError ? 'error' : '',
        searchMetadataError: hotspotSearchError,
        publicationBusy: spatialPublishBusy,
        renderStage: lambdaPublishStatus?.stage || '',
        renderProgress: Number(lambdaPublishStatus?.progress || 0),
        renderError: lambdaPublishStatus?.error || spatialPublishError || '',
    });
    const canDismiss = !lambdaPublishStatus?.active && !spatialPublishBusy && !hotspotSearchBusy;
    useEffect(() => {
        if (!open || !inCreationDeck || !canDismiss) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [open, inCreationDeck, canDismiss, onClose]);
    const loader = (
        <Backdrop
            aria-hidden={false}
            role="dialog" aria-modal="true" aria-label="Final publish review"
            sx={inCreationDeck ? {
                position: 'relative',
                inset: 'auto',
                color: 'var(--creation-text-ink)',
                backgroundColor: 'transparent',
            } : {
                zIndex: fromCreationDeck ? 1000001 : 9999,
                color: '#fff',
                backdropFilter: "blur(12px)",
                backgroundColor: "rgba(0,0,0,0.7)"
            }}
            open={open}
            onClick={inCreationDeck || lambdaPublishStatus?.active || spatialPublishBusy ? undefined : onClose}
        >
            <Fade in={open}>
                <Box onClick={(e) => e.stopPropagation()} sx={{
                    position: 'relative',
                    width: inCreationDeck ? '100%' : matchMobile ? "92%" : (lambdaPublishStatus?.active ? "520px" : "360px"),
                    maxWidth: inCreationDeck ? '100%' : "92vw",
                    boxSizing: inCreationDeck ? 'border-box' : undefined,
                    p: inCreationDeck ? 0 : lambdaPublishStatus?.active ? 4 : 3,
                    borderRadius: inCreationDeck ? 0 : "35px",
                    background: inCreationDeck ? 'transparent' : darkMode
                        ? "linear-gradient(145deg, rgba(35,35,35,0.9), rgba(15,15,15,0.95))"
                        : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(245,245,245,0.9))",
                    border: inCreationDeck ? 'none' : `1px solid ${darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
                    boxShadow: inCreationDeck ? 'none' : "0 20px 40px rgba(0,0,0,0.6)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: inCreationDeck ? 1.25 : 2
                }}>
                    {type === 3 && spatialVerified && (
                        <Box sx={{
                            width: "100%",
                            px: 2,
                            py: 1.25,
                            borderRadius: "20px",
                            bgcolor: `${appColor}26`,
                            border: `1px solid ${appColor}70`,
                            backdropFilter: "blur(14px)",
                        }}>
                            <Typography sx={{ color: appColor, fontWeight: 900 }}>
                                If Preview is verified, you can continue.
                            </Typography>
                        </Box>
                    )}
                    
                    {/* Header Emoji */}
                    <Box sx={{
                        width: inCreationDeck ? "40px" : "60px",
                        height: inCreationDeck ? "40px" : "60px",
                        borderRadius: "50%",
                        background: postStateInfo.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: inCreationDeck ? "1.25rem" : "2rem",
                        boxShadow: `0 4px 15px ${postStateInfo.color}40`,
                    }}>
                        {currentEmoji}
                    </Box>

                    {/* Title & Sub */}
                    <Box sx={{ width: '100%' }}>
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 900,
                                letterSpacing: 0.5,
                                background: `linear-gradient(45deg, ${postStateInfo.color}, ${darkMode ? "#FFF" : postStateInfo.color})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                mb: 0.5
                            }}
                        >
                            {presentationTitle}
                        </Typography>

                        <Typography variant="body2" sx={{ color: inCreationDeck ? 'inherit' : darkMode ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.68)", fontWeight: 700, fontSize: matchMobile ? "0.95rem" : "1.05rem", lineHeight: 1.35 }}>
                            {postStateInfo.subText}
                        </Typography>

                        {lambdaPublishStatus?.active && (
                            <Typography variant="caption" sx={{ display: "block", mt: 1, color: inCreationDeck ? 'inherit' : darkMode ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.72)", fontWeight: 800, fontSize: matchMobile ? "0.88rem" : "0.98rem", lineHeight: 1.35 }}>
                                Keep this tab open while the render finishes.
                            </Typography>
                        )}
                    </Box>

                    {lambdaPublishStatus?.active && (
                        <Box sx={{ width: "100%" }}>
                            <LinearProgress
                                variant="determinate"
                                value={Math.max(0, Math.min(100, lambdaPublishStatus.progress || 0))}
                                sx={{
                                    height: 9,
                                    borderRadius: 999,
                                    bgcolor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                                    "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        bgcolor: postStateInfo.color
                                    }
                                }}
                            />
                            <Typography variant="caption" sx={{ mt: 0.9, display: "block", color: postStateInfo.color, fontWeight: 900, fontSize: matchMobile ? "0.9rem" : "1rem", lineHeight: 1.3 }}>
                                {Math.round(lambdaPublishStatus.progress || 0)}% {lambdaPublishStatus.stage ? `- ${lambdaPublishStatus.stage}` : ""}
                            </Typography>
                        </Box>
                    )}

                    {(lambdaPublishStatus?.error || spatialPublishError || hotspotSearchError) && (
                        <Typography role="alert" sx={{ color: inCreationDeck ? (darkMode ? '#ffc1c7' : '#741b2a') : '#ff6b6b', fontWeight: 800 }}>
                            {lambdaPublishStatus?.error || spatialPublishError || hotspotSearchError}
                        </Typography>
                    )}

                    {/* Stats Pill */}
                    <Box sx={{ 
                        width: "100%", 
                        p: 1.5, 
                        borderRadius: "20px", 
                        bgcolor: darkMode ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)", 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 1 
                    }}>
                        {musicUnavailable ? (
                            <WarningAmberIcon sx={{ color: postStateInfo.color, fontSize: matchMobile ? "1.25rem" : "1.4rem" }} />
                        ) : (
                            <CheckCircleIcon sx={{ color: postStateInfo.color, fontSize: matchMobile ? "1.25rem" : "1.4rem" }} />
                        )}
                        <Typography variant="caption" sx={{ color: postStateInfo.color, fontWeight: 900, fontSize: matchMobile ? "0.92rem" : "1.05rem", lineHeight: 1.35 }}>
                            {mediaPillText}
                        </Typography>
                    </Box>

                    {/* Action Button */}
                    <Button
                        {...publishBinding}
                        variant="contained"
                        disabled={!postStateInfo.canProcess || spatialPublishBusy || hotspotSearchBusy}
                        onClick={handleAction}
                        sx={{
                            width: "100%", 
                            py: 1.2, 
                            borderRadius: "25px", 
                            fontSize: "1.1rem", 
                            fontWeight: 800, 
                            textTransform: "none",
                            bgcolor: postStateInfo.color,
                            color: darkMode ? "#000" : "#FFF",
                            boxShadow: `0 8px 15px ${postStateInfo.bg}`,
                            transition: "all 0.2s",
                            "&:hover": { transform: "scale(1.03)", bgcolor: postStateInfo.color, filter: "brightness(1.1)" },
                            "&:active": { transform: "scale(0.97)" },
                            "&.Mui-disabled": {
                                bgcolor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                color: "rgba(150,150,150,0.4)"
                            }
                        }}
                    >
                        {hotspotSearchBusy ? 'Preparing search details…' : postStateInfo.actionLabel}
                        {type === 3 && (spatialVerified ? <CheckCircleIcon sx={{ ml: 1 }} /> : <PlayArrowIcon sx={{ ml: 1 }} />)}
                    </Button>
                    {inCreationDeck && canDismiss && (
                        <Button
                            {...cb('storybook_publish', 'close', 'Close final publish review', 'PublishLoader2.onClose')}
                            onClick={onClose}
                            sx={{ color: 'inherit', textTransform: 'none' }}
                        >
                            {lambdaPublishStatus?.error || spatialPublishError || hotspotSearchError ? 'Dismiss' : 'Cancel'}
                        </Button>
                    )}
                </Box>
            </Fade>
        </Backdrop>
    );
    if (inCreationDeck) return open && deckDetailHost ? createPortal(loader, deckDetailHost) : null;
    // Spatial preview and Creation Deck live outside the storyboard container.
    return (type === 3 || fromCreationDeck) && typeof document !== "undefined"
        ? createPortal(loader, document.body)
        : loader;
};

export default PublishLoader2;
