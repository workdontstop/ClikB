import { removeDraftScenes } from '../server/src/creationDrafts/topology';
import SpatialExperiencePlayer from "./SpatialExperiencePlayer";
import type { DraftController } from './creationDrafts/store';
import { usePersistedCreationState, captureCreationCache } from './creationDraftBindings';
import { appColorHintPillSx, appColorPillFloatAndFade } from './appNoticeStyles';
import { stableDraftJson } from '../server/src/creationDrafts/schema';
import type { AutoDrawGuideMode } from "./AutoDrawGuide";
import type { SpatialPosition } from "./spatialPlayerModel";
import type { InteractionExperienceMode } from "./interactionExperienceMode";
import { buildSpatialExperience, buildSpatialExperienceStages, SpatialExperience } from "./spatialExperience";
import React, {
    useCallback,
    useState,
    useEffect,
    useRef,
    useLayoutEffect,
    useMemo
} from "react";
import { creationBinding as cb } from './creationControlSnapshot';
import { imageMediaReceiptMatches, isHttpMediaUrl, persistedImageReceipt, storedImageReceipt, replaceMatchingMediaEntry, revokeUnusedOwnedObjectUrl, StoredBinaryUploads, type StoredImageMedia } from './completedMediaLifecycle';
import { appendVideoHistory, mergeVideoHistory, normalizeVideoHistory, type VideoHistory, type VideoHistoryEntry } from '../server/src/videoHistory';
import { useCreationControls } from './useCreationControls';
import CreationDeck, { useCreationDeckEnabled } from './CreationDeck';
import { useCreationDeckHistory } from './useCreationDeckHistory';
import { observedMediaVersion, type CreationMediaChange } from './creationMediaSnapshot';
import { ensureGameSearchMetadata } from './gameSearchMetadata';
import { hasFinalSceneImage, isPreviewSceneImage, SceneImageProvenance } from './sceneImageReadiness';
import { SceneNumberBadge } from './ImageModelResultPill';
import { buildSceneDisplayMap, sceneDisplayForTarget, sceneDisplayLabel } from './creationSceneDisplay';
import { recordGeneratedImageModel, inheritImageResultModel, imageModelsForSources, imageModelForSource } from './imageResultProvenance';
import { restoreImageResultModels } from './imageModelExamplesSlice';


import axios from "axios";
import { IMMUTABLE_VIDEO_CACHE_CONTROL } from "./mediaCachePolicy";
import InteractionNodeMap from "./InteractionNodeMap";
import {
    STORED_PLAN_KEY,
    compilePlanGraph,
    compilePlanTopology,
    pickThumb,
    type MediaSlot,
} from "./interactionGraph";
///Snackbar/Box

import PublicIcon from "@mui/icons-material/Public";
import AutoModeIcon from "@mui/icons-material/AutoMode";
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Saveprompthelperfordellater, RemoveFromDeleteLater, RemoveVideoFromDeleteLater, RemoveAudioFromDeleteLater, ProtectSavedMediaFromDeleteLater } from "./SavepromptHelpersLocal";
import { collectAllSafetyUrls, safetySceneSourceUrl, safetyPlanMediaEntries, type SceneSafetyImageSet, type SceneSafetyVideoSet } from "./safetyConditioning";
import type { AudioReference } from '../server/src/audioReference';
import { hydrateSpatialExperience, loadSpatialDocuments } from './spatialWorldClient';
import { reconcileSpatialBShots } from './spatialBShotIdentity';
import { buildPlanKontextPayload, getPlanKontextCleanupUrls, serializePlanKontextPayload } from "./planKontextMedia";
import { readImagePromptPacing, type ImagePromptPacing } from './imagePromptPacing';
import {
    cloneBShotTruth,
    createSerialTaskQueue,
    ensureBShotTruthSlot,
    sceneTargetKey,
    type BShotTruth,
    type SceneTarget,
} from "./sceneTargetArchitecture";
import {
    bindSceneIntentToImagePrompt,
    createIntentId,
    createIntentSceneBindings,
    INTENT_BLUEPRINT_SCHEMA_VERSION,
    creationTypeToIntentMode,
    hashIntentValue,
    intentSceneBindingsFromBundle,
    parseIntentBlueprintBundle,
    resolveIntentBinding,
    resolveSceneIntent,
    sceneIntentMatchesPrompt,
    type IntentBlueprintBundle,
    type IntentCompileRequest,
    type SceneIntentBlueprint,
} from "./intentBlueprint";



import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import ErrorPillContainer, { globalErrorEmitter } from "./components/ErrorPillContainer";
import StepsDialog from './StepsDialog';


import { keyframes } from "@emotion/react";

import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { calcModelPixels } from "./ModelPixels";   // adjust path save
import { getGptImageRoute, getCreationImageModelName, imageModelForGenerationRoute } from "./imageModels";

import PublishLoader from "./PublishLoader";   // adjust path
import PublishLoader2 from "./PublishLoader2"; // New modal


import ArrowRightIcon from '@mui/icons-material/ArrowRight';

import PaletteIcon from '@mui/icons-material/Palette';

import ModeEditOutlineIcon from '@mui/icons-material/ModeEditOutline';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import SaveIcon from '@mui/icons-material/Save';


import {
    incrementPixels,
    setConversationModel,
    setGpuTime,
    setLanguageModel,
    setPixels,
    showAiProviderNotice,
} from "./settingsSlice";
import { applyLlmBilling, applyLlmBillingError, applyPixelBillingHeaders, throwLlmFetchError } from "./llmBilling";

import GlowWidthBar from "./GlowWidthBar";

//{showWorldModel Gpt

import ReportOffIcon from '@mui/icons-material/ReportOff';

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import EditIcon from "@mui/icons-material/Edit";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import BuildIcon from '@mui/icons-material/Build';       // The "Wrench" icon
import SettingsIcon from '@mui/icons-material/Settings'; // Alternative "Settings" icon

import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import PanoramaFishEyeIcon from '@mui/icons-material/PanoramaFishEye';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from "react-router-dom";

import VoicePicker from "./VoicePicker";
import { DEFAULT_FISH_VOICE } from '../server/src/fishVoiceCatalog';

import AudioPicker from "./AudioPicker";

import Thumbnail from "./Thumbnail";
import { CreationWorkPaused, OwnedCreationRequests, SerialCreationWorker, narrationContentKey, isCompletedCreationMedia, nextBShotCreationStage } from './creationWorkOwnership';
import { cleanQuotedAtMentions, mapUnquotedPromptText } from '../server/src/promptLiterals';

import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";

import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import MusicNoteIcon from "@mui/icons-material/MusicNote";
import ZoomInMapIcon from "@mui/icons-material/ZoomInMap";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

import {
    Button,
    Chip,
    Box,
    Typography,
    CircularProgress,
    IconButton,
    Stack,
    Modal,
    Portal,
    Snackbar,
    Alert,
    Backdrop,
    Fade,
} from "@mui/material";
import { matchMobile } from "./DetectDevice";
import { alpha, darken } from "@mui/material/styles";

export type CreationImaginationProgress = { title: string; text: string; status: string; image?: string };

export const isValidVideo = (vid: any) => {
    if (!vid) return false;
    if (typeof vid !== 'string') return false;
    const trimmed = vid.trim();
    if (trimmed === "" || trimmed === "EMPTY" || trimmed === "EMPTY_BSHOT" || trimmed === "undefined" || trimmed === "null") return false;
    return true;
};

import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PauseIcon from "@mui/icons-material/Pause";
import AddIcon from "@mui/icons-material/Add";

import EditStory from "./EditStory";
import {
    SPATIAL_MANIFEST_VERSION,
    syncSpatialManifest,
    resolveSpatialSceneLink,
    type SpatialMotionContext,
    type SpatialManifest,
    type SpatialSceneState,
} from "./spatialStageModel";
import {
    patchUserSnapshot,
    recordCreationAttemptStart,
    recordCreationAttemptSuccess,
    recordCreationAttemptFailure,
    type CreationSceneSlotSnapshot,
} from "./brainstormSlice";
import { useBrainstormSession } from "./components/BrainstormSessionProvider";
import { renderCreationMemorySections } from "./creationMemory";


import WorldModel from './WorldModel';

import { Padding, Title } from "@mui/icons-material";
import { video } from "framer-motion/client";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;
const VITE_HUGG = import.meta.env.VITE_HUGG;
// One-switch rollback for the Storybook-only URL transport. Other screens do
// not send `linkmode` and retain the existing Base64 response contract.
const STORYBOOK_LINK_MODE = true;

const resolveStorybookGeneratedImage = async (
    responseData: any,
    _purpose: string,
): Promise<string> => {
    if (!STORYBOOK_LINK_MODE) {
        const imageBase64 = responseData?.imageBase64;
        if (!imageBase64) throw new Error("No imageBase64 returned from server");
        return imageBase64;
    }

    const providerImageUrl = String(responseData?.imageUrl || "").trim();
    if (!providerImageUrl) {
        throw new Error("Storybook link mode returned no image URL");
    }

    // Link mode deliberately keeps image bytes away from EC2. Storybook fetches
    // the provider URL in the browser, then uses its existing direct S3 upload.
    return providerImageUrl;
};

const VITE_REPLI_KEY = import.meta.env.VITE_REPLI_KEY;

interface StorybookProps {
    /** Array of steps (short text strings) to display in the horizontal scroller */
    steps: string[];
    prompt: string;
    selectedStyle?: any;
    referenceImages?: any[];
    setReferenceImages?: any;
    detectedCharacters?: any[];
    detectedEnvironments?: any[];
}

var timerbc: any = null;
export const Storybook: React.FC<any> = ({
    creationDraft,
    onRegisterDraftImageSave,
    cinemaNarrationEnabled = false, onCinemaNarrationChange = () => { }, narrationSummaryReady = true,
    narrationSummaryError = '', onRetryNarrationSummary = () => { },
    creationProjectId = "", steps, stepsx, prompt, isSubmittingKick, setIsSubmittingKick, handleCloseOverlay, setcallFeeds,
    setSteps, setStepsx, GeneratedImage, setStopText, GotIm, generatedImagesFlux, setGeneratedImagesFlux,
    modelz, Planx, isMenuOpen, type, interactionExperienceMode = null, GenerateSignedUrl, PostId, setPostId, Seed, DummyMode,
    timeoutsDisabledRef, timeoutRefsxp, setGeneratedImage, VideMode, setVideMode, ImagesHdCloud,
    setImagesHdCloud, drawFrameData = [], setDrawFrameData = () => { }, autoDrawGuideData = [], setAutoDrawGuideData = () => { }, autoDrawGuideModes = [], setAutoDrawGuideModes = () => { }, stopFeeds, setminimisePrompt, allowSpin, steps2, setSteps2, allowgetImage,
    setallowgetImage, setDummyMode, showWorldModel, setShowWorldModel, setCreationMode, magicMode,
    selectedStyle, minimizeMode = 0, setMinimizeMode = () => { }, stagePromptCache, intentBlueprintJson = null,
    destroyAllFluxCalls, CreationMode, onAllPromptsGenerated, onIntentOverviewChange, setNanoImages, referenceImages, setReferenceImages, detectedCharacters, detectedEnvironments, nanoImages, loadersArray, setLoadersArray,
    onSaveVisibilityChange, Vipcharacters, setVipcharacters,
    isAudioDirty, setIsAudioDirty, audioSceneStatuses, setAudioSceneStatuses, isAudioGenerating, setIsAudioGenerating, isBShotModeActive, setIsBShotModeActive, generatedAudios, setGeneratedAudios,
    generatedAudioTexts, setGeneratedAudioTexts, onBackToInitial = () => { },
    creationDeckCovered = false, creationDeckPreferred = true,
    creationImaginationCovered = false,
    creationImaginationReopen = null as React.ReactNode,
    onCreationImaginationChange = undefined as ((progress: CreationImaginationProgress | null) => void) | undefined,
    onCreationDeckCharacters, onCreationDeckCloseCreation, onCreationDeckModels,
    bShotImages, setBShotImages, bShotVideos, setBShotVideos, bShotPrompts, setBShotPrompts, bShotTextVideo, setBShotTextVideo,
    spatialManifest, setSpatialManifest,
    bShotSpatialScenes = [], setBShotSpatialScenes,
    bShotSpatialContexts = [], setBShotSpatialContexts,
    spatialMotionContexts = [], setSpatialMotionContexts = () => { }, bShotNanoImages, setBShotNanoImages,
    bShotDrawFrameData = [], setBShotDrawFrameData = () => { },
    bShotAutoDrawGuideData = [], setBShotAutoDrawGuideData = () => { }, bShotAutoDrawGuideModes = [], setBShotAutoDrawGuideModes = () => { },
    musicMode = false, musicModeUrl = "", musicModeName = "", musicBreakerSec = 5, musicSegments = [],
    // Reports the A-shot cloud videos upward so the slideshow preview can show
    // real videos in place of scene images (final-render parity).
    onVideosChange = (_videos: string[]) => { },
    // Reports the story's background music (the track picked in Storybook's
    // AudioPicker) upward so the slideshow preview uses the SAME track the
    // final render mixes in. Prompt music is music-video mode only.
    onBgMusicChange = (_url: string, _name: string) => { },
    buttonTheme = {
        bg: "rgba(10, 10, 10, 0.45)",
        text: "#ffffff",
        hoverBg: "rgba(15, 15, 15, 0.65)",
        hoverText: "#ffffff",
    }
}) => {
    const draftSeed = useRef((creationDraft as DraftController | undefined)?.section<Record<string, any>>('storybook') || {}).current;
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const isStoryMusicVideoMode = Boolean(musicMode && type === 1);
    const isSpatialInteraction = Number(type) === 3 && interactionExperienceMode === "spatial";
    const isHotspotInteraction = Number(type) === 3 && interactionExperienceMode === "hotspots";
    const [masterAspectRatio, setMasterAspectRatio] = useState<any>('9 / 10');
    const [isRatioSet, setIsRatioSet] = useState(false);

    // (Unified array logic moved down)

    const dispatch = useDispatch();
    const { syncCreationMemoryCards } = useBrainstormSession();

    const navigate = useNavigate();

    useEffect(() => {
        if (!allowgetImage) setallowgetImage(true);
        if (CreationMode !== 'Video') setCreationMode('Video');
    }, [allowgetImage, CreationMode, setallowgetImage, setCreationMode]);


    const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);
    const gpuEngine = useSelector((s: RootState) => s.settings.gpuEngine);

    /**
     * Prompt-writing model. Sent as `llmTier` on the routes that write prompts;
     * the backend maps the tier to a real model and to the flat pixel price, so
     * this value is a tag, never an authority.
     */
    const languageModel = useSelector((s: RootState) => s.settings.languageModel);
    const languageModelRef = useRef(languageModel);
    useEffect(() => { languageModelRef.current = languageModel; }, [languageModel]);
    const conversationModel = useSelector((s: RootState) => s.settings.conversationModel);
    const conversationModelRef = useRef(conversationModel);
    useEffect(() => { conversationModelRef.current = conversationModel; }, [conversationModel]);

    const [HaltPublish, setHaltPublish] = useState(false);
    const [draftSaveNotice, setDraftSaveNotice] = useState<'saving' | 'saved' | null>(null);
    useEffect(() => {
        if (draftSaveNotice !== 'saved') return;
        const timer = window.setTimeout(() => setDraftSaveNotice(null), 4000);
        return () => window.clearTimeout(timer);
    }, [draftSaveNotice]);

    // Audio on by default. The first Auto Prompt batch after a video plan still
    // keeps dialogue outside the active prompt until the user clicks Dialogue.
    // Ambient audio is written as normal; later Auto Prompts use this setting.
    const [musicKling, setmusicKling] = usePersistedCreationState(creationDraft, 'storybook', 'musicKling', true);
    // Cinema readiness is computed earlier in the render than the narration
    // controls below. Initialize their shared state before those reads.
    const [legacyNarrationEnabled, setLegacyNarrationEnabled] = usePersistedCreationState(creationDraft, 'storybook', 'legacyNarrationEnabled', true);
    const activatevoicenarration = type === 1 ? cinemaNarrationEnabled : legacyNarrationEnabled;
    const setactivatevoicenarration = (enabled: boolean) => type === 1
        ? onCinemaNarrationChange(enabled) : setLegacyNarrationEnabled(enabled);
    const [publishLoader2Open, setPublishLoader2Open] = useState(false);
    const [optionalBShotsRunning, setOptionalBShotsRunning] = useState(false);
    const bShotWorkGateRef = useRef({ allowed: false });
    const bShotPromptRequestsRef = useRef(new OwnedCreationRequests<string>());
    const bShotNanoRequestsRef = useRef(new OwnedCreationRequests<string>());
    const bShotWorkerRef = useRef(new SerialCreationWorker());
    const observedBShotWorkRef = useRef<Promise<void> | null>(null);
    const failedBShotRequestsRef = useRef(new Set<string>());
    const retainedBShotArrangementsRef = useRef<any[]>([]);
    const [bShotWorkRevision, setBShotWorkRevision] = useState(0);
    // Revisiting a view must not dirty the creative draft. Honor the previous
    // saved value on older drafts and track further revisits in this session.
    const [manualOnlyVideoPrompts, setManualOnlyVideoPrompts] = useState(() =>
        creationDraft?.section('storybook')?.manualOnlyVideoPrompts === true);
    const visitedVideoGridRef = useRef(false);
    const authoredVideoPlanRef = useRef<any>(null);
    const canSubmitBShotWork = useCallback(() => bShotWorkGateRef.current.allowed, []);
    const pauseBShotWork = useCallback(() => {
        bShotWorkGateRef.current.allowed = false;
        setOptionalBShotsRunning(false);
    }, []);
    const setFinalPublishOpen = useCallback((open: boolean) => {
        if (open) pauseBShotWork();
        setPublishLoader2Open(open);
    }, [pauseBShotWork]);
    const [previewDocument, setPreviewDocument] = useState<SpatialExperience | null>(null);
    const [spatialPreviewVerifying, setSpatialPreviewVerifying] = useState(false);
    const [spatialPreviewVerified, setSpatialPreviewVerified] = useState(false);
    const [autoStartPublishLoader2, setAutoStartPublishLoader2] = useState(false);

    const clearSpatialPreviewVerification = useCallback(() => {
        setSpatialPreviewVerifying(false);
        setSpatialPreviewVerified(false);
    }, []);
    const publishGpuReleaseCheckedRef = useRef(false);
    const publishGpuReleaseInFlightRef = useRef(false);
    const [lambdaPublishStatus, setLambdaPublishStatus] = useState({
        active: false,
        progress: 0,
        message: "",
        stage: "",
        error: ""
    });

    useEffect(() => {
        if (!publishLoader2Open) {
            setAutoStartPublishLoader2(false);
            publishGpuReleaseCheckedRef.current = false;
            return;
        }

        // PublishLoader2 is the final handoff from the optional B-shot grid.
        // Check once per opening and release only an already-ready GPU. Startup
        // is intentionally left to the existing idle timeout because cancelling
        // startup has previously proved disruptive to the working LTX runtime.
        if (publishGpuReleaseCheckedRef.current || publishGpuReleaseInFlightRef.current) return;
        publishGpuReleaseCheckedRef.current = true;
        publishGpuReleaseInFlightRef.current = true;

        const releaseReadyGpu = async () => {
            try {
                const statusResponse: any = await axios.get(`${CLIK_URL}/gpu/modal/status`, {
                    params: { engine: gpuEngine },
                    withCredentials: true,
                    timeout: 25000,
                });
                if (statusResponse?.data?.status !== "ready") return;

                const stopResponse: any = await axios.post(
                    `${CLIK_URL}/gpu/modal/stop`,
                    { engine: gpuEngine },
                    { withCredentials: true, timeout: 25000 }
                );
                if (typeof stopResponse?.data?.gpu_time_seconds === "number") {
                    dispatch(setGpuTime(stopResponse.data.gpu_time_seconds));
                }
                if (typeof stopResponse?.data?.pixels === "number") {
                    dispatch(setPixels(stopResponse.data.pixels));
                }
            } catch (error) {
                // Publishing must never be blocked by a lifecycle cleanup call.
                console.warn("[ModalGPU][PublishLoader2] Ready-GPU release failed", error);
            } finally {
                publishGpuReleaseInFlightRef.current = false;
            }
        };

        void releaseReadyGpu();
    }, [dispatch, gpuEngine, publishLoader2Open]);

    // --- Sub-Stage 3.5: Narration Toggle Data Protection ---
    const [showBShotResetWarning, setShowBShotResetWarning] = useState(false);

    // --- B-shot time stamp + time-change rebuild prompt ---
    // The clip duration the current B-shot arrangement was built against. Used to
    // detect when the user later generates video at a different length.
    const [bShotBuiltWithTime, setBShotBuiltWithTime] = usePersistedCreationState<number | null>(creationDraft, 'storybook', 'bShotBuiltWithTime', null);
    const [showBShotTimeChangeWarning, setShowBShotTimeChangeWarning] = useState(false);
    const [pendingNarrationToggle, setPendingNarrationToggle] = useState<boolean | null>(null);
    const [isGeneratingBShotPrompts, setIsGeneratingBShotPrompts] = useState(false); // Tracks GPT B-Shot auto-gen

    // Bumped whenever native scene topology changes (a scene is deleted, the
    // B-shot arrangement is wiped/rebuilt, or the editor is closed/reset).
    // EditStory watches this and drops its scene-keyed caches (prompt drafts,
    // request tokens, busy flags) so nothing keyed against the old layout can
    // attach content or Visual Guides to whatever scene now occupies an index.
    // Intentional single-slot resets (deleting one B-shot's media) do NOT bump
    // this: they null slots in place and native keys stay valid.
    const [sceneTopologyVersion, setSceneTopologyVersion] = usePersistedCreationState(creationDraft, 'storybook', 'sceneTopologyVersion', 0);
    const [aSceneTopologyVersion, setASceneTopologyVersion] = usePersistedCreationState(creationDraft, 'storybook', 'aSceneTopologyVersion', 0);
    const sceneTopologyVersionRef = useRef(Number(draftSeed.sceneTopologyVersion) || 0);
    const narrationLayoutVersionRef = useRef(0);
    const bumpSceneTopologyVersion = useCallback((scope: 'all' | 'B' = 'all') => {
        sceneTopologyVersionRef.current += 1;
        setSceneTopologyVersion(sceneTopologyVersionRef.current);
        if (scope === 'all') setASceneTopologyVersion(previous => previous + 1);
    }, []);
    const [bShotVideoArray, setBShotVideoArray] = useState<any[]>([]);
    const [bShotVideoArrayBlob, setBShotVideoArrayBlob] = useState<any[]>([]);

    const handleNarrationToggle = (newVal: boolean) => {
        if (newVal === activatevoicenarration) return;
        // Check if any B Shot images, videos, or auto-generated nano images exist
        const hasData = (bShotImages || []).some((sceneArr: string[]) =>
            (sceneArr || []).some((item: string) => item && item !== "EMPTY_BSHOT")
        ) || (bShotVideos || []).some((sceneArr: string[]) =>
            (sceneArr || []).some((item: string) => item && item !== "EMPTY_BSHOT")
        ) || (bShotNanoImages || []).some((sceneArr: string[]) =>
            (sceneArr || []).some((item: string) => item && item !== "EMPTY_BSHOT")
        );

        if (hasData) {
            setPendingNarrationToggle(newVal);
            setShowBShotResetWarning(true);
        } else {
            pauseBShotWork();
            // Silently reset arrays and allow toggle
            if (setBShotPrompts) setBShotPrompts([]);
            if (setBShotTextVideo) setBShotTextVideo([]);
            setIsBShotGenerating([]);
            if (setBShotImages) setBShotImages([]);
            if (setBShotVideos) setBShotVideos([]);
            if (setBShotNanoImages) setBShotNanoImages([]);
            if (setBShotDrawFrameData) setBShotDrawFrameData([]);
            if (setBShotAutoDrawGuideData) setBShotAutoDrawGuideData([]);
            if (setBShotAutoDrawGuideModes) setBShotAutoDrawGuideModes([]);
            setBShotNoImagePrompt([]);
            setBShotReferenceVideoUrls([]);
            setBShotReferenceVideoActiveList([]);
            setBShotSceneActiveCharacters([]);
            setBShotSceneActiveCharactersVideo([]);
            bumpSceneTopologyVersion('B');
            narrationLiveRef.current.enabled = newVal && (type !== 1 || narrationSummaryReady);
            setactivatevoicenarration(newVal);
        }
    };

    const confirmNarrationToggle = () => {
        pauseBShotWork();
        retainedBShotArrangementsRef.current.push({
            prompts: bShotPrompts, images: bShotImages, videos: bShotVideos, nanoImages: bShotNanoImages,
        });
        if (setBShotPrompts) setBShotPrompts([]);
        if (setBShotTextVideo) setBShotTextVideo([]);
        setIsBShotGenerating([]);
        if (setBShotImages) setBShotImages([]);
        if (setBShotVideos) setBShotVideos([]);
        if (setBShotNanoImages) setBShotNanoImages([]);
        if (setBShotDrawFrameData) setBShotDrawFrameData([]);
        if (setBShotAutoDrawGuideData) setBShotAutoDrawGuideData([]);
        if (setBShotAutoDrawGuideModes) setBShotAutoDrawGuideModes([]);
        setBShotNoImagePrompt([]);
        setBShotReferenceVideoUrls([]);
        setBShotReferenceVideoActiveList([]);
        setBShotSceneActiveCharacters([]);
        setBShotSceneActiveCharactersVideo([]);
        bumpSceneTopologyVersion('B');
        if (pendingNarrationToggle !== null) {
            narrationLiveRef.current.enabled = pendingNarrationToggle && (type !== 1 || narrationSummaryReady);
            setactivatevoicenarration(pendingNarrationToggle);
        }
        setShowBShotResetWarning(false);
        setPendingNarrationToggle(null);
    };

    const cancelNarrationToggle = () => {
        setShowBShotResetWarning(false);
        setPendingNarrationToggle(null);
    };
    // -------------------------------------------------------

    // --- B-shot time-change rebuild (consent-first) ---
    // YES: wipe B-shot media. The calculateBShots effect then rebuilds at the
    // current `time` (arrays are empty) and re-stamps bShotBuiltWithTime.
    const confirmBShotTimeRebuild = () => {
        pauseBShotWork();
        retainedBShotArrangementsRef.current.push({
            prompts: bShotPrompts, images: bShotImages, videos: bShotVideos, nanoImages: bShotNanoImages,
        });
        if (setBShotPrompts) setBShotPrompts([]);
        if (setBShotTextVideo) setBShotTextVideo([]);
        setIsBShotGenerating([]);
        if (setBShotImages) setBShotImages([]);
        if (setBShotVideos) setBShotVideos([]);
        if (setBShotNanoImages) setBShotNanoImages([]);
        if (setBShotDrawFrameData) setBShotDrawFrameData([]);
        if (setBShotAutoDrawGuideData) setBShotAutoDrawGuideData([]);
        if (setBShotAutoDrawGuideModes) setBShotAutoDrawGuideModes([]);
        setBShotNoImagePrompt([]);
        setBShotReferenceVideoUrls([]);
        setBShotReferenceVideoActiveList([]);
        setBShotSceneActiveCharacters([]);
        setBShotSceneActiveCharactersVideo([]);
        bumpSceneTopologyVersion('B');
        setShowBShotTimeChangeWarning(false);
    };

    // NO: keep B-shots untouched. The user decides manually (e.g. delete the
    // mismatched video and regenerate at the B-shot's length). Close the warning
    // and the publish loader, and stay on the A-shots grid (do NOT enter the
    // B-shots grid).
    const cancelBShotTimeRebuild = () => {
        setShowBShotTimeChangeWarning(false);
        setActiveLoaderCallerChecker(false);
        if (setIsBShotModeActive) setIsBShotModeActive(false);
    };
    // -------------------------------------------------------

    const [s3ResultUrl, setS3ResultUrl] = useState<string | null>(null);
    const LOCAL_STORAGE_KEY = "interaction_prompt_s3_url";

    const [GeneratedText, setGeneratedText] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'GeneratedText', []);
    const [GeneratedTextx, setGeneratedTextx] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'GeneratedTextx', []);

    /**
     * Output of the single global pass. Held on its own rather than inside the
     * bundle because scene snapshots arrive one at a time afterwards and each
     * needs this to compile.
     */
    type GlobalIntentResult = {
        blueprintId: string;
        mode: ReturnType<typeof creationTypeToIntentMode>;
        sourceContextHash: string;
        artStyle: string;
        global: IntentBlueprintBundle["global"];
        sceneNotes: Record<string, string>;
        modeStructure: IntentBlueprintBundle["modeStructure"];
        audit: IntentBlueprintBundle["audit"];
        scenesById: Record<string, IntentCompileRequest["scenes"][number]>;
        sceneOrder: string[];
    };
    const loadedIntentBundleRef = useRef<IntentBlueprintBundle | null>(
        parseIntentBlueprintBundle(draftSeed.intentBlueprintState || intentBlueprintJson)
    );
    const [intentSceneBindings, setIntentSceneBindings] = usePersistedCreationState(creationDraft, 'storybook', 'intentSceneBindings', () => {
        const loaded = loadedIntentBundleRef.current;
        return loaded
            ? intentSceneBindingsFromBundle(loaded)
            : createIntentSceneBindings(steps?.length ?? 0, type);
    });
    const intentSceneBindingsRef = useRef(intentSceneBindings);
    const [intentBlueprintState, setIntentBlueprint] = usePersistedCreationState<IntentBlueprintBundle | null>(creationDraft, 'storybook', 'intentBlueprintState', loadedIntentBundleRef.current);
    const intentBlueprintRef = useRef<IntentBlueprintBundle | null>(loadedIntentBundleRef.current);
    const initialImagePacingRef = useRef<Record<string, ImagePromptPacing>>({});
    const intentGlobalResultRef = useRef<GlobalIntentResult | null>(draftSeed.globalIntentResult || (loadedIntentBundleRef.current ? {
        blueprintId: loadedIntentBundleRef.current.blueprintId,
        mode: loadedIntentBundleRef.current.mode,
        sourceContextHash: loadedIntentBundleRef.current.sourceContextHash,
        artStyle: String(selectedStyle || ''),
        global: loadedIntentBundleRef.current.global,
        sceneNotes: {},
        modeStructure: loadedIntentBundleRef.current.modeStructure,
        audit: loadedIntentBundleRef.current.audit,
        sceneOrder: loadedIntentBundleRef.current.sceneOrder,
        scenesById: Object.fromEntries(intentSceneBindings.map((binding: any, orderIndex: number) => [binding.sceneId, {
            ...binding, orderIndex, text: String(steps[orderIndex] || ''),
        }])),
    } : null));
    const intentCompilePromiseRef = useRef<Promise<GlobalIntentResult | null> | null>(null);
    const intentScenePromisesRef = useRef<Record<string, Promise<SceneIntentBlueprint | null> | undefined>>({});
    const intentCompileStatusRef = useRef<"idle" | "compiling" | "ready" | "failed">(
        loadedIntentBundleRef.current ? "ready" : "idle"
    );
    const committedImagePromptBySceneRef = useRef<Record<string, string>>({});
    const boundImagePromptTextBySceneRef = useRef<Record<string, string>>({});

    useEffect(() => {
        intentSceneBindingsRef.current = intentSceneBindings;
    }, [intentSceneBindings]);

    useEffect(() => {
        const bundle = intentBlueprintRef.current;
        if (!bundle) return;
        intentSceneBindingsRef.current.forEach((binding, sceneIndex) => {
            const promptText = String(GeneratedText?.[sceneIndex] || "").trim();
            const scene = bundle.scenes[binding.sceneId];
            if (
                promptText
                && scene?.boundImagePromptHash === hashIntentValue(promptText)
            ) {
                committedImagePromptBySceneRef.current[binding.sceneId] = promptText;
                boundImagePromptTextBySceneRef.current[binding.sceneId] = promptText;
            }
        });
        // This only rehydrates hash-matching prompt text. It never reconciles.
    }, [GeneratedText]);

    /**
     * The two human-facing fields from the global pass. Global lands well before
     * the first image, so the waiting screen can show what is being made instead
     * of a blank caption. Reads state, not the ref, so it re-renders on arrival.
     */
    const intentPreview = useMemo(() => ({
        title: String(intentBlueprintState?.global?.title || "").trim(),
        overview: String(intentBlueprintState?.global?.overview || "").trim(),
    }), [intentBlueprintState]);

    /**
     * What the backend is doing right now, in the user's language. The waiting
     * screen shows this until there is something better to show, so the box is
     * never silent while a stage is running.
     */
    const [intentStage, setIntentStage] = useState<string>("");

    /**
     * Everything intent knows, for the under-the-hood panel: the whole creation's
     * title and overview, plus each scene's passage in display order.
     */
    const getIntentOverview = useCallback(() => {
        const bundle = intentBlueprintState;
        if (!bundle) return null;
        const scenes = bundle.sceneOrder
            .map((sceneId, order) => {
                const scene = bundle.scenes[sceneId];
                if (!scene?.text) return null;
                const stage = scene.kind === "cinema-stage" ? ` (Stage ${scene.stage})` : "";
                return {
                    label: `Scene ${Math.floor(order / (bundle.mode === "cinema" ? 2 : 1)) + 1}${stage}`,
                    text: scene.text,
                };
            })
            .filter(Boolean) as { label: string; text: string }[];
        return {
            title: String(bundle.global?.title || "").trim(),
            overview: String(bundle.global?.overview || "").trim(),
            scenes,
        };
    }, [intentBlueprintState]);

    // Intent lives here, but the plan editor upstream wants to show it beside its
    // own textfield. Pushed up on change rather than re-derived there.
    useEffect(() => {
        onIntentOverviewChange?.(getIntentOverview());
    }, [getIntentOverview, onIntentOverviewChange]);

    const replaceIntentBlueprint = useCallback((
        updater: (current: IntentBlueprintBundle | null) => IntentBlueprintBundle | null
    ): IntentBlueprintBundle | null => {
        const next = updater(intentBlueprintRef.current);
        intentBlueprintRef.current = next;
        setIntentBlueprint(next);
        return next;
    }, []);

    /**
     * The bundle is assembled incrementally as scenes land, rather than arriving
     * whole. The first scene to finish creates it from the global result; each
     * later scene merges itself in. Scenes that never compile simply stay absent.
     */
    const mergeSceneIntoBundle = useCallback((
        globalResult: GlobalIntentResult,
        sceneBlueprint: SceneIntentBlueprint
    ): IntentBlueprintBundle | null => replaceIntentBlueprint((current) => {
        const base: IntentBlueprintBundle = current ?? {
            schemaVersion: INTENT_BLUEPRINT_SCHEMA_VERSION,
            blueprintId: globalResult.blueprintId,
            revision: 0,
            mode: globalResult.mode,
            sourceContextHash: globalResult.sourceContextHash,
            global: globalResult.global,
            modeStructure: globalResult.modeStructure,
            sceneOrder: globalResult.sceneOrder,
            scenes: {},
            audit: globalResult.audit,
        };
        return {
            ...base,
            revision: base.revision + 1,
            scenes: { ...base.scenes, [sceneBlueprint.sceneId]: sceneBlueprint },
        };
    }), [replaceIntentBlueprint]);

    const ensureIntentBlueprint = useCallback(async (): Promise<GlobalIntentResult | null> => {
        if (intentGlobalResultRef.current) return intentGlobalResultRef.current;
        if (intentCompileStatusRef.current === "failed") return null;
        if (intentCompilePromiseRef.current) return intentCompilePromiseRef.current;

        const bindings = intentSceneBindingsRef.current;
        const mode = creationTypeToIntentMode(type);
        const compileScenes = bindings.map((binding, index) => ({
            ...binding,
            orderIndex: index,
            text: String(steps?.[index] ?? "").trim(),
        })).filter((scene) => scene.text.length > 0);
        if (!compileScenes.length) return null;
        // Planx is the canon source now, so there is nothing to compile without it.
        if (!Planx) return null;

        const sourceContextHash = hashIntentValue({
            mode,
            scenes: compileScenes,
            planx: Planx,
            artStyle: selectedStyle ?? "",
        });
        const requestData: IntentCompileRequest = {
            blueprintId: createIntentId("blueprint"),
            mode,
            // No originalPrompt. Planx now carries prompt_summary from the plan
            // stage, so the request travels down the pipeline instead of being
            // re-sent at every step.
            creationType: Number(type),
            artStyle: typeof selectedStyle === "string"
                ? selectedStyle
                : String(selectedStyle?.name || selectedStyle?.style_token || ""),
            scenes: compileScenes,
            planx: Planx,
            characters: Vipcharacters,
            sourceContextHash,
        };

        intentCompileStatusRef.current = "compiling";
        setIntentStage(
            mode === "cinema"
                ? "Understanding your story"
                : mode === "interactive"
                    ? "Understanding your interaction"
                    : "Understanding your content"
        );
        console.log("[IntentBlueprint][global][request]", {
            // The server picks the model from the mode (it mirrors each mode's
            // StartStory route), so it is logged there rather than guessed here.
            blueprintId: requestData.blueprintId,
            mode: requestData.mode,
            sourceContextHash,
            sceneIds: requestData.scenes.map((scene) => scene.sceneId),
        });
        const compilePromise = axios.post<any>(
            `${CLIK_URL}/intent-blueprint/compile-global`,
            // One logical compile, one flat charge — the server's internal
            // repair attempt is part of the same operation.
            { ...requestData, llmTier: languageModelRef.current },
            { withCredentials: true, timeout: 900000 }
        ).then((response) => {
            const data = response.data || {};
            applyLlmBilling(dispatch, data);
            if (!data.global) throw new Error("Global intent pass returned no blueprint.");
            const result: GlobalIntentResult = {
                blueprintId: requestData.blueprintId,
                mode,
                sourceContextHash,
                artStyle: requestData.artStyle,
                global: data.global,
                sceneNotes: data.sceneNotes || {},
                modeStructure: data.modeStructure || { kind: mode },
                audit: data.audit || { status: "valid", issues: [] },
                scenesById: Object.fromEntries(
                    compileScenes.map((scene) => [scene.sceneId, scene])
                ),
                sceneOrder: compileScenes.map((scene) => scene.sceneId),
            };
            intentGlobalResultRef.current = result;
            captureCreationCache(creationDraft, 'storybook', { globalIntentResult: result });
            intentCompileStatusRef.current = "ready";
            setIntentStage("Working out each scene");
            // Seed the bundle with the global pass alone, before any scene has
            // compiled. That is what lets the waiting screen show the title and
            // overview immediately rather than after the first scene lands.
            replaceIntentBlueprint((current) => current ?? {
                schemaVersion: INTENT_BLUEPRINT_SCHEMA_VERSION,
                blueprintId: result.blueprintId,
                revision: 0,
                mode: result.mode,
                sourceContextHash: result.sourceContextHash,
                global: result.global,
                modeStructure: result.modeStructure,
                sceneOrder: result.sceneOrder,
                scenes: {},
                audit: result.audit,
            });
            console.log("[IntentBlueprint][global][created]", {
                model: data.model,
                blueprintId: result.blueprintId,
                sceneNotes: result.sceneNotes,
            });
            intentCompilePromiseRef.current = null;
            return result;
        }).catch((error: any) => {
            intentCompileStatusRef.current = "failed";
            console.error("[IntentBlueprint] Global pass failed; generation continues without intent.", error);
            // A 402 carries the real balance and a useful message; anything else
            // keeps the existing generic notice.
            const billingMessage = applyLlmBillingError(dispatch, error);
            globalErrorEmitter.emit(
                billingMessage ||
                "Intent blueprint failed to initialise. Images can continue without it, but intent protection is unavailable for this creation.",
                0
            );
            intentCompilePromiseRef.current = null;
            return null;
        });
        // Cleared inside both handlers rather than with .finally(): this project's
        // axios typings model the result as IPromise, which has no .finally.

        // Promise.resolve(): axios types the chain as IPromise, which is not
        // assignable to the ref's native Promise type. Wrapping is a no-op.
        const trackedCompile = Promise.resolve(compilePromise);
        intentCompilePromiseRef.current = trackedCompile;
        return trackedCompile;
    }, [Planx, Vipcharacters, prompt, selectedStyle, steps, type]);

    // Fire the global pass the moment Planx and the scene texts exist, without
    // waiting for anything else to settle. It is the only step every scene
    // intent sits behind, so every millisecond it starts earlier is a
    // millisecond off the whole creation.
    useEffect(() => {
        if (!Planx || !steps?.length) return;
        void ensureIntentBlueprint();
    }, [Planx, steps, ensureIntentBlueprint]);


    /**
     * One scene's intent, and only that scene's. Each call is cached by scene
     * index so a scene compiles once, and the calls run concurrently with one
     * another — scene 3 never queues behind scene 7. An image prompt awaits
     * this and nothing wider, so the fan-out the rest of the pipeline relies on
     * is preserved.
     */
    const ensureSceneIntent = useCallback(async (
        sceneIndex: number
    ): Promise<SceneIntentBlueprint | null> => {
        const binding = intentSceneBindingsRef.current[sceneIndex];
        if (!binding) return null;

        const existing = intentBlueprintRef.current?.scenes[binding.sceneId];
        if (existing) return existing;

        const inFlight = intentScenePromisesRef.current[binding.sceneId];
        if (inFlight) return inFlight;

        // Cinema compiles Stage A and Stage B of a logical scene in ONE call.
        // The same image request consumes both stages, so deciding them together
        // is what keeps them from drifting — and it halves cinema's call count.
        const groupBindings = binding.logicalSceneId
            ? intentSceneBindingsRef.current.filter(
                (candidate) => candidate.logicalSceneId === binding.logicalSceneId
            )
            : [binding];

        const groupPromise = (async (): Promise<Record<string, SceneIntentBlueprint>> => {
            const globalResult = await ensureIntentBlueprint();
            if (!globalResult) return {};

            const scenes = groupBindings
                .map((candidate) => globalResult.scenesById[candidate.sceneId])
                .filter(Boolean);
            if (!scenes.length) return {};

            const notes: Record<string, string> = {};
            scenes.forEach((scene) => {
                notes[scene.sceneId] = globalResult.sceneNotes[scene.sceneId] || "";
            });

            try {
                const response = await axios.post<any>(
                    `${CLIK_URL}/intent-blueprint/compile-scene`,
                    {
                        // Global blueprint + these scenes only. Everything else
                        // the scenes could need was already folded into global.
                        blueprintId: globalResult.blueprintId,
                        mode: globalResult.mode,
                        sourceContextHash: globalResult.sourceContextHash,
                        global: globalResult.global,
                        scenes,
                        notes,
                    },
                    { withCredentials: true, timeout: 900000 }
                );
                const blueprints = (response.data?.sceneBlueprints || {}) as Record<string, SceneIntentBlueprint>;
                Object.values(blueprints).forEach((sceneBlueprint) => {
                    mergeSceneIntoBundle(globalResult, sceneBlueprint);
                });
                setIntentStage("Writing the image prompts");
                console.log("[IntentBlueprint][scene][ready]", {
                    model: response.data?.model,
                    sceneIndex,
                    sceneIds: scenes.map((scene) => scene.sceneId),
                    sceneBlueprints: blueprints,
                });
                return blueprints;
            } catch (error) {
                console.error("[IntentBlueprint][scene][failed] Generating these scenes without intent.", {
                    sceneIndex,
                    sceneIds: scenes.map((scene) => scene.sceneId),
                    error,
                });
                return {};
            } finally {
                groupBindings.forEach((candidate) => {
                    delete intentScenePromisesRef.current[candidate.sceneId];
                });
            }
        })();

        // Every scene in the group shares the one in-flight call, so a Stage B
        // request while Stage A is running joins it instead of duplicating it.
        groupBindings.forEach((candidate) => {
            intentScenePromisesRef.current[candidate.sceneId] =
                groupPromise.then((blueprints) => blueprints[candidate.sceneId] ?? null);
        });

        return groupPromise.then((blueprints) => blueprints[binding.sceneId] ?? null);
    }, [ensureIntentBlueprint, mergeSceneIntoBundle]);

    /**
     * Start every scene's intent as soon as the global pass lands, rather than
     * one per turn of the sequential prompt loop. The calls are independent of
     * each other and spend their time waiting on the model, so running them
     * together costs about as long as running one.
     *
     * The loop is untouched: each scene still awaits its own intent before its
     * prompt, with the same ordering, gate and error pill. That wait is simply
     * already over by the time the loop reaches it.
     */
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const globalResult = await ensureIntentBlueprint();
            if (cancelled || !globalResult) return;
            const bindings = intentSceneBindingsRef.current;
            console.log("[IntentBlueprint][scene][prefetch-all]", {
                sceneCount: bindings.length,
            });
            setIntentStage("Working out each scene");
            bindings.forEach((_binding, sceneIndex) => {
                void ensureSceneIntent(sceneIndex);
            });
        })();
        return () => { cancelled = true; };
    }, [ensureIntentBlueprint, ensureSceneIntent]);

    const bindInitialImagePromptToIntent = useCallback((sceneIndex: number, imagePrompt: string, pacing?: ImagePromptPacing) => {
        const binding = intentSceneBindingsRef.current[sceneIndex];
        if (!binding || !imagePrompt.trim()) return;
        if (pacing) initialImagePacingRef.current[binding.sceneId] = pacing;
        committedImagePromptBySceneRef.current[binding.sceneId] = imagePrompt;
        boundImagePromptTextBySceneRef.current[binding.sceneId] = imagePrompt;
        const nextBundle = replaceIntentBlueprint((current) =>
            current ? bindSceneIntentToImagePrompt(current, binding.sceneId, imagePrompt, pacing) : current
        );
        console.log("[IntentBlueprint][initial-bind]", {
            sceneId: binding.sceneId,
            sceneIndex,
            promptHash: hashIntentValue(imagePrompt),
            bundleRevision: nextBundle?.revision,
        });
    }, [replaceIntentBlueprint]);

    const persistIntentBlueprint = useCallback(async (bundle: IntentBlueprintBundle) => {
        if (creationDraft) {
            captureCreationCache(creationDraft, 'storybook', { intentBlueprintState: bundle });
            return;
        }
        if (!PostId) return;
        try {
            console.log("[IntentBlueprint][persistence][request]", {
                postId: PostId,
                blueprintId: bundle.blueprintId,
                revision: bundle.revision,
            });
            await axios.post(
                `${CLIK_URL}/intent-blueprint/save`,
                { postId: PostId, intentBlueprintJson: JSON.stringify(bundle) },
                { withCredentials: true }
            );
            console.log("[IntentBlueprint][persistence][saved]", {
                postId: PostId,
                blueprintId: bundle.blueprintId,
                revision: bundle.revision,
            });
        } catch (error) {
            // The in-memory transaction is still valid. Persistence remains
            // retryable and must not mutate or downgrade the scene snapshot.
            console.error("[IntentBlueprint] Failed to persist the latest bundle.", error);
        }
    }, [PostId]);

    const reconcileImagePromptIntent = useCallback(async (
        target: SceneTarget,
        committedImagePrompt: string,
        _editInstruction = "Image prompt committed"
    ): Promise<boolean> => {
        // Editor B-shots intentionally stay on their existing parent-derived
        // workflow and never compile or reconcile intent.
        if (target.type === "B") return true;

        const bundle = await ensureIntentBlueprint();
        if (!bundle) return true; // initial compiler failure is explicitly fail-open

        const binding = resolveIntentBinding(target, intentSceneBindingsRef.current);
        if (!binding) return true;
        const scene = intentBlueprintRef.current?.scenes[binding.sceneId] ?? null;
        if (!scene) return true; // partial compiler coverage remains additive

        const nextPrompt = String(committedImagePrompt || "").trim();
        if (!nextPrompt) return false;
        committedImagePromptBySceneRef.current[binding.sceneId] = nextPrompt;

        if (sceneIntentMatchesPrompt(scene, nextPrompt)) {
            boundImagePromptTextBySceneRef.current[binding.sceneId] = nextPrompt;
            return true;
        }

        // Image polish changes the starting depiction, never the compiled story premise.
        // Narrative deviations remain explicit video UPDATE WITH AI instructions.
        boundImagePromptTextBySceneRef.current[binding.sceneId] = nextPrompt;
        const nextBundle = replaceIntentBlueprint(current => current
            ? bindSceneIntentToImagePrompt(current, binding.sceneId, nextPrompt,
                scene.imagePacing || scene.imagePacingContext || initialImagePacingRef.current[binding.sceneId])
            : current);
        if (nextBundle) void persistIntentBlueprint(nextBundle);
        return true;
    }, [ensureIntentBlueprint, persistIntentBlueprint, replaceIntentBlueprint]);

    const ensureImageIntentReady = useCallback(async (
        target: SceneTarget,
        imagePrompt: string,
        editInstruction = "Image generation prompt"
    ): Promise<boolean> => {
        if (target.type === "B") return true;
        const currentScene = resolveSceneIntent(
            target,
            intentSceneBindingsRef.current,
            intentBlueprintRef.current
        );
        if (sceneIntentMatchesPrompt(currentScene, imagePrompt)) return true;
        return reconcileImagePromptIntent(target, imagePrompt, editInstruction);
    }, [reconcileImagePromptIntent]);

    const getIntentForSceneTarget = useCallback((target: SceneTarget): SceneIntentBlueprint | null =>
        resolveSceneIntent(target, intentSceneBindingsRef.current, intentBlueprintRef.current), []);

    const getImagePacingForTarget = useCallback((target: SceneTarget): ImagePromptPacing | null => {
        if (target.type !== 'A') return null;
        const binding = resolveIntentBinding(target, intentSceneBindingsRef.current);
        if (!binding) return null;
        const scene = intentBlueprintRef.current?.scenes[binding.sceneId];
        return scene?.imagePacing || scene?.imagePacingContext || initialImagePacingRef.current[binding.sceneId] || null;
    }, []);

    /**
     * Reusing an earlier image restores the exact intent that image was generated
     * under, so the snapshot is written back verbatim instead of being re-derived.
     * Deliberately no Luna call: reconciling would produce a *new* intent, which is
     * the drift this is meant to prevent. The revision is bumped so any in-flight
     * reconcile keyed to the old revision is discarded rather than applied on top.
     */
    const restoreSceneIntentSnapshot = useCallback((
        target: SceneTarget,
        snapshot: SceneIntentBlueprint,
        boundImagePrompt: string
    ): void => {
        if (target.type === "B" || !snapshot) return;

        const binding = resolveIntentBinding(target, intentSceneBindingsRef.current);
        if (!binding) return;

        const promptText = String(boundImagePrompt || "").trim();
        if (!promptText) return;

        const nextBundle = replaceIntentBlueprint((current) => {
            if (!current) return current;
            const currentScene = current.scenes[binding.sceneId];
            if (!currentScene) return current;
            return {
                ...current,
                scenes: {
                    ...current.scenes,
                    [binding.sceneId]: {
                        ...snapshot,
                        sceneId: binding.sceneId,
                        revision: currentScene.revision + 1,
                        syncStatus: "ready",
                        boundImagePromptHash: hashIntentValue(promptText),
                    },
                },
            };
        });

        // Keep the reconcile guard's expectations in step with what we just wrote,
        // so the next genuine prompt edit reconciles from this restored state.
        boundImagePromptTextBySceneRef.current[binding.sceneId] = promptText;
        committedImagePromptBySceneRef.current[binding.sceneId] = promptText;

        if (nextBundle) void persistIntentBlueprint(nextBundle);
    }, [replaceIntentBlueprint, persistIntentBlueprint]);
    const [fetchingPrompts, setFetchingPrompts] = useState(false);
    const [latestFetchedPrompt, setLatestFetchedPrompt] = useState<{ text: string, index: number } | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const imaginationTitle = (!latestFetchedPrompt && intentPreview.title) || 'Accessing Imagination...';
    const imaginationText = latestFetchedPrompt?.text || intentPreview.overview || 'Initializing Prompts...';
    const imaginationStatus = latestFetchedPrompt ? '' : intentStage;
    useLayoutEffect(() => {
        onCreationImaginationChange?.(fetchingPrompts ? {
            title: imaginationTitle, text: imaginationText, status: imaginationStatus, image: previewImage || undefined,
        } : null);
    }, [fetchingPrompts, imaginationTitle, imaginationText, imaginationStatus, previewImage, onCreationImaginationChange]);
    useEffect(() => () => onCreationImaginationChange?.(null), [onCreationImaginationChange]);
    const abortNanoRef = useRef<AbortController | null>(null);
    const hasFiredNanoRef = useRef(false);
    const nanoImagesRef = useRef<string[]>(Array.isArray(nanoImages) ? nanoImages : []);

    useEffect(() => {
        nanoImagesRef.current = Array.isArray(nanoImages) ? nanoImages : [];
    }, [nanoImages]);


    const [TextVideo, setTextVideo] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'TextVideo', []);

    const [VideoArray, setVideoArray] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'VideoArray', []);
    const [VideoArrayBlob, setVideoArrayBlob] = useState<string[]>([]);

    // Fullscreen Character Slideshow State
    const [fullscreenCharIndex, setFullscreenCharIndex] = useState<number | null>(null);
    const [charTouchStart, setCharTouchStart] = useState<number | null>(null);
    const [charTouchEnd, setCharTouchEnd] = useState<number | null>(null);

    const [VideoArrayCloud, setVideoArrayCloud] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'VideoArrayCloud', []);
    const [usedanimate, setusedanimate] = usePersistedCreationState<boolean>(creationDraft, 'storybook', 'usedanimate', false);

    useEffect(() => {
        console.log("[VIDEO SAVE][7 VIDEO ARRAY CLOUD STATE COMMITTED]", {
            VideoArrayCloud,
            count: VideoArrayCloud.filter((value) => typeof value === "string" && value.trim() !== "").length
        });
    }, [VideoArrayCloud]);

    useEffect(() => {
        setusedanimate(false);
    }, [VideMode]);


    useEffect(() => {

        if (HaltPublish) {

            setTimeout(() => {
                setHaltPublish(false);
            }, 9000);
        }

    }, [

        HaltPublish
    ])


    const [Continue, setContinue] = useState(false);

    // magicMode useEffect moved below handleSubmitFluxImageNew to prevent ReferenceError


    const glassSweep = keyframes`
          from { transform: translateX(-150%) rotate(20deg); }
          to   { transform: translateX(150%)  rotate(20deg); }
        `;


    const [HideSave, setHideSave] = useState(false);

    // alert  This state will hold the generated image URLs for each step Imagen VideoMode Wan 2.5
    const [generatedImages, setGeneratedImages] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'generatedImages', Array(steps.length).fill(""));

    const [generatedImagesFirst, setGeneratedImagesFirst] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'generatedImagesFirst', Array(steps.length).fill(""));
    const [lipSyncAudioUrls, setLipSyncAudioUrls] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'lipSyncAudioUrls', () => Array(steps.length).fill(""));
    const [audioReferences, setAudioReferences] = usePersistedCreationState<Record<string, AudioReference>>(creationDraft, 'storybook', 'audioReferences', {});
    const [lipSyncActiveList, setLipSyncActiveList] = usePersistedCreationState<boolean[]>(creationDraft, 'storybook', 'lipSyncActiveList', () => Array(steps.length).fill(false));
    const [lipSyncInstructions, setLipSyncInstructions] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'lipSyncInstructions', () => Array(steps.length).fill(""));
    const [lipSyncInstructionStatuses, setLipSyncInstructionStatuses] = useState<string[]>(
        () => Array(steps.length).fill("idle")
    );
    const [lipSyncInstructionMeta, setLipSyncInstructionMeta] = usePersistedCreationState<any[]>(creationDraft, 'storybook', 'lipSyncInstructionMeta', () => Array(steps.length).fill(null));
    // Per-scene direct Lip Sync Pro lifecycle. EditStory can close while its async task continues.
    const [lipSyncProJobs, setLipSyncProJobs] = useState<Record<number, { state: "generating" | "succeeded" | "failed"; message: string }>>({});
    // Backup of the user's original video prompt per scene, saved when lip-sync is turned ON
    // and restored when turned OFF, so toggling never loses or breaks the prompt.
    const [lipSyncPromptBackup, setLipSyncPromptBackup] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'lipSyncPromptBackup', () => Array(steps.length).fill(""));
    // Per-scene reference video (Seedance 2.0 / 2.0 Fast only). Holds the uploaded S3 URL
    // of a user-picked clip used as a motion/style reference ([Video1]).
    const [referenceVideoUrls, setReferenceVideoUrls] = useState<string[]>(
        () => Array(steps.length).fill("")
    );
    // Whether each scene's reference video is actively in use ("Using Vid").
    const [referenceVideoActiveList, setReferenceVideoActiveList] = useState<boolean[]>(
        () => Array(steps.length).fill(false)
    );
    // B-shot counterparts for scene-owned editor state. The unified arrays below
    // expose one index space to EditStory for both A-shots and B-shots.
    const [bShotNoImagePrompt, setBShotNoImagePrompt] = usePersistedCreationState<boolean[][]>(creationDraft, 'storybook', 'bShotNoImagePrompt', []);
    const [bShotReferenceVideoUrls, setBShotReferenceVideoUrls] = useState<string[][]>([]);
    const [bShotReferenceVideoActiveList, setBShotReferenceVideoActiveList] = useState<boolean[][]>([]);
    const [bShotSceneActiveCharacters, setBShotSceneActiveCharacters] = usePersistedCreationState<any[][][]>(creationDraft, 'storybook', 'bShotSceneActiveCharacters', []);
    const [bShotSceneActiveCharactersVideo, setBShotSceneActiveCharactersVideo] = usePersistedCreationState<any[][][]>(creationDraft, 'storybook', 'bShotSceneActiveCharactersVideo', []);

    useEffect(() => {
        setLipSyncAudioUrls((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push("");
            return next.slice(0, steps.length);
        });
        setLipSyncActiveList((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push(false);
            return next.slice(0, steps.length);
        });
        setLipSyncInstructions((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push("");
            return next.slice(0, steps.length);
        });
        setLipSyncInstructionStatuses((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push("idle");
            return next.slice(0, steps.length);
        });
        setLipSyncInstructionMeta((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push(null);
            return next.slice(0, steps.length);
        });
        setLipSyncPromptBackup((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push("");
            return next.slice(0, steps.length);
        });
        setReferenceVideoUrls((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push("");
            return next.slice(0, steps.length);
        });
        setReferenceVideoActiveList((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            if (next.length === steps.length) return next;
            while (next.length < steps.length) next.push(false);
            return next.slice(0, steps.length);
        });
    }, [steps.length]);
    const [MemeMusic, setMemeMusic] = usePersistedCreationState(creationDraft, 'storybook', 'MemeMusic', true);


    // inside your component
    useEffect(() => {
        // check for any null/empty/default‐placeholder steps
        const hasInvalidStep = type === 0;

        // only update state if it would actually change Remix
        setMemeMusic((current: boolean) => {
            const shouldBeOn = hasInvalidStep;
            return current === shouldBeOn ? current : shouldBeOn;
        });


    }, [steps]);



    const [generatedImagesBlob, setGeneratedImageBlob] = useState<Blob[]>(
        Array(steps.length).fill(null) as Blob[]
    );

    //const [GeneratedText, setGeneratedText] = useState<string[]>([]);

    type LastFrameEntry = {
        base: Blob | null;        // this index's own last frame
        stepback1: Blob | null;   // last frame from index-1
        stepbackTwice: Blob | null; // last frame from index-2
    };

    const [videoArrayLastFrame, setVideoArrayLastFrame] =
        useState<LastFrameEntry[]>([]);


    // ... inside EditStory component
    const [noImagePrompt, setnoImagePrompt] = usePersistedCreationState<boolean[]>(creationDraft, 'storybook', 'noImagePrompt', Array(steps.length).fill(false));
    const restoredFrameModeKeys = useRef([
        ...(draftSeed.noImagePrompt || []).map((_: boolean, i: number) => `A:${i}`),
        ...(draftSeed.bShotNoImagePrompt || []).flatMap((row: boolean[], i: number) => (row || []).map((_: boolean, b: number) => `B:${i}:${b}`)),
    ]).current;




    const hasInitVideoArray = useRef(false);




    useEffect(() => {
        if (!steps || steps.length === 0) return;
        if (hasInitVideoArray.current) return;

        const initial: LastFrameEntry[] = steps.map(() => ({
            base: null,
            stepback1: null,
            stepbackTwice: null,
        }));

        setVideoArrayLastFrame(initial);
        hasInitVideoArray.current = true;
    }, [steps]);




    const [generatedImagePrompt, setGeneratedImagePrompt] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'generatedImagePrompt', Array(steps.length).fill(""));

    const [SelectvidPrompt, setSelectvidImagePrompt] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'SelectvidPrompt', Array(steps.length).fill(""));


    const [base, setbase] = useState<string[]>([]);

    const [Name, setName] = useState("Voices");




    const [musicname, setmusicname] = usePersistedCreationState(creationDraft, 'storybook', 'musicname', "Music");

    /// {loader}%
    const TYPE2_TRACKS = [
        ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3"
        ///https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-b50013a478814b136194434fe19576d7-trim-1749103536560.mp3

        /// "https://clikbatebucket.s3.us-east-1.amazonaws.com/background-melody-6-50284.mp3",
        /// "https://clikbatebucket.s3.us-east-1.amazonaws.com/humming-song-59500.mp3",
        ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/background-melody-3-17343.mp3",


        "https://clikbatebucket.s3.us-east-1.amazonaws.com/welte-mignon-piano-48794.mp3",

        "https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3",
    ];
    //const idx = Math.floor(Math.random() * TYPE2_TRACKS.length);

    var idx = "https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3";
    const [music, setmusic] = usePersistedCreationState(creationDraft, 'storybook', 'music', 'https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3');
    // Prompt music (the song picked in the prompt bar) is ONLY the soundtrack in
    // music-video mode. Every other mode is not music-driven and uses the
    // story's own background track from `music` / `musicname`.
    const publishMusicUrl = isStoryMusicVideoMode && musicModeUrl ? musicModeUrl : music;
    const publishMusicName = isStoryMusicVideoMode && musicModeName ? musicModeName : musicname;

    // Keep the parent (and therefore the slideshow preview) on the same
    // background track the final render will mix in.
    useEffect(() => {
        onBgMusicChange(music || "", musicname || "Music");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [music, musicname]);

    const [generatedImagesFluxBlob, setGeneratedImagesFluxBlob] = useState<
        Blob[]
    >(Array(steps.length).fill(null) as Blob[]);

    // durations in seconds, one perSscene
    const [clipDurations, setClipDurations] = usePersistedCreationState<number[]>(creationDraft, 'storybook', 'clipDurations', () => Array(steps.length).fill(5));




    const [generatedImagesFluxBlobHd, setGeneratedImagesFluxBlobHd] = useState<
        Blob[]
    >(Array(steps.length).fill(null) as Blob[]);

    const [dummyImageUrls, setDummyImageUrls] = useState<Record<number, string>>({});
    const imageProvenanceRef = useRef((() => {
        const provenance = new SceneImageProvenance();
        for (const receipt of Object.values(draftSeed.imageReceipts || {}) as any[]) {
            if (receipt?.sdUrl && receipt?.hdUrl) provenance.mark(receipt.quality === 'preview' ? 'preview' : 'final', receipt.sdUrl, receipt.hdUrl);
        }
        return provenance;
    })());
    const imageMediaReceiptsRef = useRef<Record<string, StoredImageMedia>>({});
    const imageStoredAliasesRef = useRef(new Map<string, string>());
    const imageBinaryUploadsRef = useRef(new StoredBinaryUploads());
    const imageGenerationClaimsRef = useRef<Record<number, symbol>>({});
    const imageDownloadedInputsRef = useRef(new Map<string, Blob>());
    const retainedInitialImageResultsRef = useRef<Array<{ sdUrl?: string; hdUrl?: string; sourceUrl?: string; sdBlob?: Blob; hdBlob?: Blob }>>([]);
    const ownedImageObjectUrlsRef = useRef(new Set<string>());
    const releasableImageObjectUrlsRef = useRef(new Set<string>());
    const [imageMediaRevision, setImageMediaRevision] = useState(0);
    const imageLifecycleLiveRef = useRef<any>(null);
    imageLifecycleLiveRef.current = {
        sd: generatedImagesFluxBlob, hd: generatedImagesFluxBlobHd,
        previews: generatedImagesFlux, nanoPreviews: nanoImages, cloud: ImagesHdCloud, steps,
        projectId: creationProjectId, aTopology: aSceneTopologyVersion,
        liveSources: [...(generatedImagesFlux || []), ...Object.values(dummyImageUrls), ...(nanoImages || []), ...(generatedImages || []), ...(GeneratedImage || []), ...(referenceImages || []).map((reference: any) => reference.imageUrl)],
    };
    const releaseStoredImageSources = useCallback((index: number, receipt: StoredImageMedia) => {
        const live = imageLifecycleLiveRef.current;
        const sources = { sdBlob: live.sd[index], hdBlob: live.hd[index], previewUrl: live.previews[index] };
        const previewAlias = receipt.previewUrl?.startsWith('blob:') ? receipt.previewUrl : sources.previewUrl;
        if (!imageMediaReceiptMatches(receipt, sources)) return false;
        const expectedCloud = live.cloud[index];
        if (sources.sdBlob) setGeneratedImagesFluxBlob(previous => replaceMatchingMediaEntry(previous, index, sources.sdBlob, null) as Blob[]);
        if (sources.hdBlob) setGeneratedImagesFluxBlobHd(previous => replaceMatchingMediaEntry(previous, index, sources.hdBlob, null) as Blob[]);
        setGeneratedImagesFlux((previous: string[]) => replaceMatchingMediaEntry(previous, index, sources.previewUrl, receipt.sdUrl));
        setImagesHdCloud((previous: string[]) => replaceMatchingMediaEntry(previous, index, expectedCloud, receipt.hdUrl));
        setDummyImageUrls(previous => previous[index] === sources.previewUrl ? { ...previous, [index]: receipt.sdUrl } : previous);
        // A selected reference may share this preview URL. Migrate that exact
        // frozen source before releasing its browser URL owner.
        if (previewAlias?.startsWith('blob:')) {
            imageStoredAliasesRef.current.set(previewAlias, receipt.sdUrl);
            setGeneratedImage?.((previous: any) => Array.isArray(previous)
                ? previous.map(value => imageStoredAliasesRef.current.get(value) || value) : previous);
            setReferenceImages?.((previous: any[]) => previous.map(reference => imageStoredAliasesRef.current.has(reference.imageUrl)
                ? { ...reference, imageUrl: imageStoredAliasesRef.current.get(reference.imageUrl) } : reference));
        }
        setDummyImageUrls(previous => {
            const next = { ...previous }; let changed = false;
            for (const key of Object.keys(previous)) {
                const stored = imageStoredAliasesRef.current.get(previous[Number(key)]);
                if (stored) { next[Number(key)] = stored; changed = true; }
            }
            return changed ? next : previous;
        });
        if (previewAlias?.startsWith('blob:') && ownedImageObjectUrlsRef.current.has(previewAlias)) {
            releasableImageObjectUrlsRef.current.add(previewAlias);
        }
        // Programmatic Continue can run before React commits these setters.
        // Its authoritative sources and receipts become URL-only synchronously.
        live.sd = [...live.sd]; live.sd[index] = null;
        live.hd = [...live.hd]; live.hd[index] = null;
        live.previews = [...live.previews]; live.previews[index] = receipt.sdUrl;
        live.cloud = [...live.cloud]; live.cloud[index] = receipt.hdUrl;
        live.liveSources = live.liveSources.map((value: unknown) => value === previewAlias || value === sources.previewUrl ? receipt.sdUrl : value);
        imageMediaReceiptsRef.current[`A:${index}`] = storedImageReceipt(receipt);
        if (receipt.previewUrl) imageDownloadedInputsRef.current.delete(receipt.previewUrl);
        return true;
    }, [setGeneratedImagesFlux, setImagesHdCloud, setGeneratedImage, setReferenceImages]);
    const onImageMediaStored = useCallback((target: SceneTarget, receipt: StoredImageMedia) => {
        if (!isHttpMediaUrl(receipt.sdUrl) || !isHttpMediaUrl(receipt.hdUrl)) return;
        inheritImageResultModel(receipt.previewUrl || receipt.sdUrl, [receipt.previewUrl, receipt.sdUrl, receipt.hdUrl], receipt.hdUrl);
        imageProvenanceRef.current.stored(receipt);
        if (creationDraft) {
            const saved = creationDraft.section('storybook')?.imageReceipts || {};
            captureCreationCache(creationDraft, 'storybook', {
                imageModels: { ...(creationDraft.section('storybook')?.imageModels || {}), ...imageModelsForSources([receipt.sdUrl, receipt.hdUrl]) },
                imageReceipts: { ...saved, [sceneTargetKey(target)]: {
                sdUrl: receipt.sdUrl, hdUrl: receipt.hdUrl,
                quality: imageProvenanceRef.current.quality(receipt.hdUrl) || 'final',
                sourcePrompt: target.type === 'A' ? GeneratedText[target.index] : bShotPrompts?.[target.index]?.[target.bIndex || 0],
            } } });
        }
        if (target.type === 'A') {
            setNanoImages?.((previous: string[]) => previous.map((url, index) => index === target.index
                && (url === receipt.previewUrl || url === receipt.sdUrl) ? receipt.sdUrl : url));
            if (!releaseStoredImageSources(target.index, receipt)) {
                retainedInitialImageResultsRef.current.push({ sdUrl: receipt.sdUrl, hdUrl: receipt.hdUrl });
                const alias = receipt.previewUrl;
                if (alias?.startsWith('blob:')) {
                    imageStoredAliasesRef.current.set(alias, receipt.sdUrl);
                    setGeneratedImage?.((previous: any) => Array.isArray(previous) ? previous.map(value => value === alias ? receipt.sdUrl : value) : previous);
                    setReferenceImages?.((previous: any[]) => previous.map(reference => reference.imageUrl === alias ? { ...reference, imageUrl: receipt.sdUrl } : reference));
                    if (ownedImageObjectUrlsRef.current.has(alias)) releasableImageObjectUrlsRef.current.add(alias);
                }
                setImageMediaRevision(previous => previous + 1);
                return;
            }
        } else {
            const alias = receipt.previewUrl;
            if (alias?.startsWith('blob:')) {
                imageStoredAliasesRef.current.set(alias, receipt.sdUrl);
                setGeneratedImage?.((sources: any) => Array.isArray(sources) ? sources.map(value => value === alias ? receipt.sdUrl : value) : sources);
                setReferenceImages?.((references: any[]) => references.map(reference => reference.imageUrl === alias ? { ...reference, imageUrl: receipt.sdUrl } : reference));
            }
            imageMediaReceiptsRef.current[sceneTargetKey(target)] = storedImageReceipt(receipt);
        }
        setImageMediaRevision(previous => previous + 1);
    }, [releaseStoredImageSources, setGeneratedImage, setReferenceImages]);
    useEffect(() => {
        if (draftSeed.imageModels) dispatch(restoreImageResultModels(draftSeed.imageModels));
    }, [creationProjectId, dispatch]);
    useEffect(() => {
        // A frozen reference update may commit after the storage callback.
        // Normalize its exact recorded alias, then let the next render release
        // the URL once all mounted owners have adopted their cloud sources.
        setGeneratedImage?.((previous: any) => {
            if (!Array.isArray(previous)) return previous;
            const next = previous.map(value => imageStoredAliasesRef.current.get(value) || value);
            return next.some((value, index) => value !== previous[index]) ? next : previous;
        });
        setReferenceImages?.((previous: any[]) => {
            let changed = false;
            const next = previous.map(reference => {
                const stored = imageStoredAliasesRef.current.get(reference.imageUrl);
                if (!stored) return reference;
                changed = true; return { ...reference, imageUrl: stored };
            });
            return changed ? next : previous;
        });
        for (const url of releasableImageObjectUrlsRef.current) {
            if (revokeUnusedOwnedObjectUrl(url, imageLifecycleLiveRef.current.liveSources)) {
                releasableImageObjectUrlsRef.current.delete(url);
                ownedImageObjectUrlsRef.current.delete(url);
            }
        }
    }, [generatedImagesFluxBlob, generatedImagesFluxBlobHd, generatedImagesFlux, ImagesHdCloud, dummyImageUrls, GeneratedImage, referenceImages, generatedImages, nanoImages, steps, imageMediaRevision]);
    useEffect(() => () => {
        for (const url of releasableImageObjectUrlsRef.current) revokeUnusedOwnedObjectUrl(url, imageLifecycleLiveRef.current.liveSources);
    }, []);

    const isSceneImageFinal = useCallback((index: number) => hasFinalSceneImage({
        hdImageUrl: ImagesHdCloud?.[index],
        displayImageUrl: generatedImagesFlux?.[index],
        nanoImageUrl: nanoImages?.[index],
        quality: imageProvenanceRef.current.quality(generatedImagesFlux?.[index] || ImagesHdCloud?.[index]),
        hasLocalImage: generatedImagesFluxBlob[index] instanceof Blob || generatedImagesFluxBlobHd[index] instanceof Blob,
    }), [ImagesHdCloud, generatedImagesFlux, nanoImages, generatedImagesFluxBlob, generatedImagesFluxBlobHd, imageMediaRevision]);
    const finalSceneImageCount = useMemo(() => steps.filter((_: string, index: number) => isSceneImageFinal(index)).length,
        [steps, isSceneImageFinal]);
    const previewSceneImageCount = useMemo(() => steps.filter((_: string, index: number) => !isSceneImageFinal(index)
        && Boolean(generatedImagesFlux?.[index] || ImagesHdCloud?.[index] || nanoImages?.[index])).length,
        [steps, isSceneImageFinal, generatedImagesFlux, ImagesHdCloud, nanoImages]);

    // Whenever `steps` changes, re-initialize generatedImages 
    useEffect(() => {
        setDone(false);
        /// setDonex(false);
        setGeneratedImages(Array(steps.length).fill(""));
    }, [steps]);

    const [narrate, setnarrate] = useState(0);

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );

    const darkMode = darkModeReducer;
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? '#FFD52A' : '#A16900');

    const [startEdit, setstartEdit] = useState(false);
    const prevMinimizeModeRef = useRef<number>(0);

    useEffect(() => {
        if (startEdit) {
            if (minimizeMode !== 0) {
                prevMinimizeModeRef.current = minimizeMode;
                if (setMinimizeMode) setMinimizeMode(0);
            }
        } else {
            if (prevMinimizeModeRef.current !== 0) {
                if (setMinimizeMode) setMinimizeMode(prevMinimizeModeRef.current);
                prevMinimizeModeRef.current = 0;
            }
        }
    }, [startEdit]);

    const [activeEdit, setactiveEdit] = useState(0);
    // Spatial authoring is session-owned here beside the existing scene arrays.
    // It is deliberately not persisted per movement: submit/publish will save the
    // complete manifest in one DB write after the creator finishes the project.
    const [spatialMotionContextStatus, setSpatialMotionContextStatus] = useState<"idle" | "compiling" | "ready" | "failed">("idle");
    const spatialMotionCompileKeyRef = useRef("");
    const retrySpatialMotionContext = useCallback(() => {
        spatialMotionCompileKeyRef.current = "";
        setSpatialMotionContextStatus("idle");
    }, []);

    useEffect(() => {
        setSpatialManifest((previous) => syncSpatialManifest(
            previous,
            (steps || []).map((_: any, sceneIndex: number) => ({
                sceneId: String(intentSceneBindingsRef.current?.[sceneIndex]?.sceneId || `scene-${sceneIndex}`),
                firstFrameUrl: String(ImagesHdCloud?.[sceneIndex] || generatedImagesFlux?.[sceneIndex] || ""),
            })),
        ));
    }, [steps, ImagesHdCloud, generatedImagesFlux]);

    // Changing this invalidates only the cheap one-time scene motion profile,
    // never any generated video or spatial graph data.
    const spatialMotionContextVersion = 4;

    // One Luna call compiles every missing scene after all video prompts and
    // intent snapshots exist. PromptInput owns the standard [scene][state]
    // array; the manifest supplies only node truth and anchor IDs.
    useEffect(() => {
        if (!isSpatialInteraction || !VideMode || !steps?.length) return;
        if (spatialManifest.scenes.length < steps.length) return;
        const prompts = steps.map((_: any, sceneIndex: number) => String(TextVideo?.[sceneIndex] || "").trim());

        const bundle = intentBlueprintState;
        if (!bundle?.global) return;

        const missing = steps.map((_: any, sceneIndex: number) => {
            const scene = spatialManifest.scenes[sceneIndex];
            const binding = intentSceneBindings[sceneIndex];
            const intent = binding ? bundle.scenes[binding.sceneId] : null;
            const rootNode = scene?.nodes?.[0];
            const sourceContextHash = hashIntentValue({
                spatialMotionContextVersion,
                globalRevision: bundle.revision,
                sceneRevision: intent?.revision,
                videoPrompt: prompts[sceneIndex],
                // Rebuild the scene-indexed state after an explicitly
                // accepted base-image replacement, even when text did not change.
                rootFrameUrl: rootNode?.frameUrl,
            });
            const hasRootState = Boolean((spatialMotionContexts[sceneIndex] || []).some(
                (context: SpatialMotionContext) => context.anchorNodeId === rootNode?.id
                    && context.sourceContextHash === sourceContextHash
            ));
            if (!scene || scene.ledger || !scene.connections.length || !rootNode?.frameUrl || !prompts[sceneIndex] || !intent?.text || hasRootState) return null;
            return {
                sceneIndex,
                sceneId: scene.sceneId,
                nodeId: rootNode.id,
                sceneIntent: intent.text,
                videoPrompt: prompts[sceneIndex],
                sourceContextHash,
            };
        }).filter(Boolean) as Array<{
            sceneIndex: number;
            sceneId: string;
            nodeId: string;
            sceneIntent: string;
            videoPrompt: string;
            sourceContextHash: string;
        }>;
        if (!missing.length) {
            if (spatialMotionContextStatus !== "ready") setSpatialMotionContextStatus("ready");
            return;
        }
        const compileKey = hashIntentValue(missing.map(({ sceneId, sourceContextHash }) => ({ sceneId, sourceContextHash })));
        if (spatialMotionCompileKeyRef.current === compileKey) return;
        spatialMotionCompileKeyRef.current = compileKey;
        setSpatialMotionContextStatus("compiling");
        console.log("[SpatialMotionContext][ui][batch-request]", {
            llmTier: languageModelRef.current,
            sceneIndices: missing.map(({ sceneIndex }) => sceneIndex),
            sceneIds: missing.map(({ sceneId }) => sceneId),
        });

        void axios.post<any>(
            `${CLIK_URL}/spatial-motion-context/compile`,
            {
                llmTier: languageModelRef.current,
                globalIntent: bundle.global,
                scenes: missing.map(({ sceneId, nodeId, sceneIntent, videoPrompt }) => ({
                    sceneId, nodeId, sceneIntent, videoPrompt,
                })),
            },
            { withCredentials: true, timeout: 900000 },
        ).then((response) => {
            const bySceneId = new Map((response.data?.contexts || []).map((context: any) => [context.sceneId, context]));
            const createdAt = Date.now();
            setSpatialMotionContexts((previous: SpatialMotionContext[][] = []) => {
                const next = Array.from({ length: steps.length }, (_, sceneIndex) => [...(previous[sceneIndex] || [])]);
                missing.forEach((request) => {
                    const result: any = bySceneId.get(request.sceneId);
                    if (!result) return;
                    const nextContext: SpatialMotionContext = {
                        id: `${request.sceneId}:motion-root`,
                        anchorNodeId: request.nodeId,
                        source: "scene-root",
                        controlMode: result.controlMode,
                        controlledSubject: result.controlledSubject,
                        primaryMotion: result.primaryMotion,
                        ambientMotion: result.ambientMotion,
                        userPriorityHint: "",
                        sourceContextHash: request.sourceContextHash,
                        createdAt,
                        updatedAt: createdAt,
                    };
                    const existingIndex = next[request.sceneIndex].findIndex(
                        (context) => context.anchorNodeId === request.nodeId
                    );
                    if (existingIndex >= 0) next[request.sceneIndex][existingIndex] = nextContext;
                    else next[request.sceneIndex].push(nextContext);
                });
                return next;
            });
            setSpatialMotionContextStatus("ready");
            console.log("[SpatialMotionContext][ui][batch-ready]", {
                model: response.data?.model,
                sceneIndices: missing.map(({ sceneIndex }) => sceneIndex),
                contexts: response.data?.contexts,
            });
        }).catch((error: any) => {
            setSpatialMotionContextStatus("failed");
            console.error("[SpatialMotionContext][ui][batch-failed]", error);
            globalErrorEmitter.emit(
                `Motion context failed: ${error?.response?.data?.error || error?.message || "Could not prepare intelligent movement."}`,
                activeEdit,
            );
        });
    }, [
        TextVideo, VideMode, activeEdit, intentBlueprintState, intentSceneBindings, spatialManifest.scenes,
        spatialMotionContextStatus, spatialMotionContexts, steps, setSpatialMotionContexts, type, isSpatialInteraction,
    ]);

    const [activeBShotEdit, setActiveBShotEdit] = useState<number | any>(null);
    const [savedSpatialDocuments, setSavedSpatialDocuments] = useState<SpatialSceneState[]>([]);
    const [spatialIdentityPost, setSpatialIdentityPost] = useState<number | null>(null);
    useEffect(() => {
        if (!isSpatialInteraction || !(Number(PostId) > 0)) return;
        let cancelled = false;
        void loadSpatialDocuments(CLIK_URL, Number(PostId)).then(documents => { if (!cancelled) { setSavedSpatialDocuments(documents.map(doc => doc.scene)); setSpatialIdentityPost(Number(PostId)); } })
            .catch(error => console.error('Could not restore spatial stage identities', error));
        return () => { cancelled = true; };
    }, [PostId, isSpatialInteraction]);
    useEffect(() => {
        if (!isSpatialInteraction) return;
        if (Number(PostId) > 0 && spatialIdentityPost !== Number(PostId)) return;
        setBShotSpatialScenes((previous: Array<Array<SpatialSceneState | null>>) => {
            const next = spatialManifest.scenes.map((parent, a) => {
                const sources = (bShotPrompts?.[a] || []).map((prompt: string, b: number) => ({ prompt: String(prompt || ''), frameUrl: String(bShotImages?.[a]?.[b] || bShotNanoImages?.[a]?.[b] || '').replace(/^EMPTY_BSHOT$/, '') }));
                const row = [...(previous[a] || [])];
                for (const saved of savedSpatialDocuments) if (saved.sceneId.startsWith(`${parent.sceneId}:b:`) && !row.some(scene => scene?.sceneId === saved.sceneId)) row.push(saved);
                return reconcileSpatialBShots(parent.sceneId, row, sources, () => crypto.randomUUID());
            });
            return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
        });
    }, [isSpatialInteraction, spatialManifest.scenes, bShotPrompts, bShotImages, bShotNanoImages, savedSpatialDocuments, spatialIdentityPost, PostId, setBShotSpatialScenes]);
    const bSpatialScenes: Record<string, SpatialSceneState> = Object.fromEntries(
        bShotSpatialScenes.flatMap((row: Array<SpatialSceneState | null>) => (row || []).filter(Boolean).map(scene => [scene!.sceneId, scene!])));
    const bSpatialContexts: Record<string, SpatialMotionContext[]> = Object.fromEntries(
        bShotSpatialScenes.flatMap((row: Array<SpatialSceneState | null>, a: number) => (row || []).flatMap((scene, b) => scene ? [[scene.sceneId, bShotSpatialContexts[a]?.[b] || []]] : [])));
    const setBSpatialScenes = (updater: (previous: Record<string, SpatialSceneState>) => Record<string, SpatialSceneState>) => {
        const a = activeEdit, b = activeBShotEdit;
        if (b === null) return;
        setBShotSpatialScenes((previous: Array<Array<SpatialSceneState | null>>) => {
            const byId = Object.fromEntries(previous.flatMap(row => (row || []).filter(Boolean).map(scene => [scene!.sceneId, scene!])));
            const updated = updater(byId);
            const key = activeBSpatialKey;
            if (!key || !updated[key]) return previous;
            const next = [...previous]; next[a] = [...(next[a] || [])]; next[a][b] = updated[key];
            return next;
        });
    };
    const setBSpatialContexts = (updater: (previous: Record<string, SpatialMotionContext[]>) => Record<string, SpatialMotionContext[]>) => {
        const a = activeEdit, b = activeBShotEdit, key = activeBSpatialKey;
        if (b === null || !key) return;
        setBShotSpatialContexts((previous: SpatialMotionContext[][][]) => {
            const updated = updater({[key]: previous[a]?.[b] || []});
            const next = [...previous]; next[a] = [...(next[a] || [])]; next[a][b] = updated[key] || [];
            return next;
        });
    };
    const activeBSpatialKey = isSpatialInteraction && isBShotModeActive && activeBShotEdit !== null
        ? bShotSpatialScenes[activeEdit]?.[activeBShotEdit]?.sceneId || null : null;
    const activeSpatialScene = activeBSpatialKey
        ? bSpatialScenes[activeBSpatialKey] || null : spatialManifest.scenes[activeEdit] || null;
    useEffect(() => {
        if (!activeBSpatialKey) return;
        const frame = String(bShotImages?.[activeEdit]?.[activeBShotEdit] || bShotNanoImages?.[activeEdit]?.[activeBShotEdit] || "").replace(/^EMPTY_BSHOT$/, "");
        if (!frame) return;
        setBSpatialScenes(previous => {
            const old = previous[activeBSpatialKey];
            const next = syncSpatialManifest({ version: SPATIAL_MANIFEST_VERSION, scenes: old ? [old] : [] }, [{sceneId: activeBSpatialKey, firstFrameUrl: frame}]).scenes[0];
            return {...previous, [activeBSpatialKey]: next};
        });
    }, [activeBSpatialKey, activeEdit, activeBShotEdit, bShotImages, bShotNanoImages]);
    const [bSpatialContextStatus, setBSpatialContextStatus] = useState<"idle" | "compiling" | "ready" | "failed">("idle");
    const [bSpatialRetry, setBSpatialRetry] = useState(0);
    useEffect(() => {
        if (!isSpatialInteraction || !activeBSpatialKey || !activeSpatialScene?.nodes[0]?.frameUrl || activeSpatialScene.ledger || !activeSpatialScene.connections.length) return;
        if (bSpatialContexts[activeBSpatialKey]?.length) { setBSpatialContextStatus("ready"); return; }
        const text = String(bShotPrompts?.[activeEdit]?.[activeBShotEdit] || "");
        if (!text) return;
        let cancelled = false;
        const key = activeBSpatialKey;
        setBSpatialContextStatus("compiling");
        void axios.post<any>(`${CLIK_URL}/spatial-motion-context/compile`, {
                llmTier: languageModelRef.current,
            globalIntent: intentBlueprintState?.global,
            scenes: [{sceneId: key, nodeId: activeSpatialScene.nodes[0].id, sceneIntent: text,
                videoPrompt: String(bShotTextVideo?.[activeEdit]?.[activeBShotEdit] || text)}],
        }, {withCredentials: true, timeout: 900000}).then(response => {
            if (cancelled) return;
            const result = response.data?.contexts?.[0];
            if (!result) throw new Error("Missing B-roll character state");
            const now = Date.now();
            setBSpatialContexts(previous => ({...previous, [key]: [{...result, id: `${key}:motion-root`,
                anchorNodeId: `${key}:node-0`, source: "scene-root", userPriorityHint: "",
                sourceContextHash: key, createdAt: now, updatedAt: now}]}));
            setBSpatialContextStatus("ready");
        }).catch(() => { if (!cancelled) setBSpatialContextStatus("failed"); });
        return () => { cancelled = true; };
    }, [activeBSpatialKey, Boolean(activeSpatialScene?.nodes[0]?.frameUrl), bSpatialRetry, isSpatialInteraction]);
    const updateActiveSpatialScene = useCallback((
        updater: (scene: SpatialSceneState) => SpatialSceneState,
    ) => {
        const sceneIndex = activeEdit;
        if (activeBSpatialKey) {
            setBSpatialScenes(previous => previous[activeBSpatialKey] ? {...previous, [activeBSpatialKey]: updater(previous[activeBSpatialKey])} : previous);
            return;
        }
        setSpatialManifest((previous) => {
            const current = previous.scenes[sceneIndex];
            if (!current) return previous;
            const nextScene = updater(current);
            if (nextScene === current) return previous;
            const scenes = [...previous.scenes];
            scenes[sceneIndex] = nextScene;
            return { ...previous, scenes };
        });
    }, [activeEdit, activeBSpatialKey]);
    const updateActiveSpatialMotionContexts = useCallback((
        updater: (contexts: SpatialMotionContext[]) => SpatialMotionContext[],
    ) => {
        const sceneIndex = activeEdit;
        if (activeBSpatialKey) {
            setBSpatialContexts(previous => ({...previous, [activeBSpatialKey]: updater(previous[activeBSpatialKey] || [])}));
            return;
        }
        setSpatialMotionContexts((previous: SpatialMotionContext[][] = []) => {
            const current = previous[sceneIndex] || [];
            const nextSceneContexts = updater(current);
            if (nextSceneContexts === current) return previous;
            const next = Array.from({ length: Math.max(previous.length, steps.length) }, (_, index) => previous[index] || []);
            next[sceneIndex] = nextSceneContexts;
            return next;
        });
    }, [activeEdit, activeBSpatialKey, setSpatialMotionContexts, steps.length]);
    const [editStoryMemoryByScene, setEditStoryMemoryByScene] = useState<Record<string, any>>({});
    const handleEditStoryMemoryChange = useCallback((details: any) => {
        const sceneNumber = Number(details?.sceneNumber || 0);
        if (!sceneNumber) return;
        const memoryKey = `${sceneNumber}:${details?.bShotIndex || 0}`;
        setEditStoryMemoryByScene((current) => {
            const previous = current[memoryKey];
            if (JSON.stringify(previous) === JSON.stringify(details)) return current;
            return { ...current, [memoryKey]: details };
        });
    }, []);

    const bShotTruthRef = useRef<BShotTruth>({
        images: bShotImages,
        videos: bShotVideos,
        prompts: bShotPrompts
    });
    const bShotTruthPostIdRef = useRef(PostId);
    bShotTruthPostIdRef.current = PostId;
    const bShotTruthQueueRef = useRef(createSerialTaskQueue());

    useEffect(() => {
        bShotTruthRef.current = {
            images: bShotImages,
            videos: bShotVideos,
            prompts: bShotPrompts
        };
    }, [bShotImages, bShotVideos, bShotPrompts]);

    useEffect(() => {
        if (!setBShotTextVideo) return;
        setBShotTextVideo((previous: string[][] = []) => {
            let changed = false;
            const next = previous.map((sceneVideoPrompts) => [...(sceneVideoPrompts || [])]);
            (bShotPrompts || []).forEach((scenePrompts: string[], parentIndex: number) => {
                if (!next[parentIndex]) next[parentIndex] = [];
                (scenePrompts || []).forEach((imagePrompt, shotIndex) => {
                    if (!String(next[parentIndex][shotIndex] || "").trim() && String(imagePrompt || "").trim()) {
                        next[parentIndex][shotIndex] = imagePrompt;
                        changed = true;
                    }
                });
            });
            return changed ? next : previous;
        });
    }, [bShotPrompts, setBShotTextVideo]);

    const persistedPlanMediaRef = useRef<unknown[]>([]);
    type BShotMediaMetadata = { videoHistory?: VideoHistory; videoHistoryEntry?: VideoHistoryEntry; videoPrompt?: string; targetKey?: string;
        referenceUsageCaptured?: boolean; usedReferenceVideoUrl?: string; usedMotionVideoUrl?: string;
        safetyMedia?: Array<{url:string;kind:'image'|'video';label?:string}>; safetyAudioUrls?: string[] };
    const saveBShotTruthPayload = useCallback(async (nextImages: any[], nextVideos: any[], nextPrompts: any[], errorMessage = "Failed to save BShot truth", upscale?: any, mediaMetadata?: BShotMediaMetadata) => {
        const payload = {
            imagesarray: nextImages,
            videoarray: nextVideos,
            promptsarray: nextPrompts
        };

        try {
            const values = {
                    postId: PostId,
                    bshot: JSON.stringify(payload),
                    imageModels: imageModelsForSources(nextImages.flat()),
                    upscale,
                    videoHistory: mergeVideoHistory(normalizeVideoHistory(videoHistoryRef.current), mediaMetadata?.videoHistory),
                    videoHistoryEntry: mediaMetadata?.videoHistoryEntry,
                    videoPrompt: mediaMetadata?.videoPrompt, targetKey: mediaMetadata?.targetKey,
                    referenceUsageCaptured: mediaMetadata?.referenceUsageCaptured,
                    usedReferenceVideoUrl: mediaMetadata?.usedReferenceVideoUrl, usedMotionVideoUrl: mediaMetadata?.usedMotionVideoUrl,
                    safetyMedia: mediaMetadata?.safetyMedia, safetyAudioUrls: mediaMetadata?.safetyAudioUrls,
            };
            let response: any;
            if (creationDraft?.getState().postId === Number(PostId)) {
                if (!upscale) captureCreationCache(creationDraft, 'prompt', { bShotImages: nextImages, bShotVideos: nextVideos, bShotPrompts: nextPrompts });
                try { response = { data: await creationDraft.checkpoint('quiet', { kind: 'broll', values }) }; }
                catch (error: any) {
                    if (!(error?.status === 503 && error?.code === 'DRAFTS_NOT_INSTALLED')) throw error;
                    response = await axios.put(`${CLIK_URL}/UpdatePostBShotTruth`, { values }, { withCredentials: true });
                }
            } else response = await axios.put(`${CLIK_URL}/UpdatePostBShotTruth`, { values }, { withCredentials: true });
            RemoveFromDeleteLater(nextImages.flat().filter(isCompletedCreationMedia));
            RemoveVideoFromDeleteLater(nextVideos.flat().filter(isCompletedCreationMedia));
            if (upscale) ProtectSavedMediaFromDeleteLater(upscale);
            if (mediaMetadata) {
                persistedPlanMediaRef.current.push(mediaMetadata);
                ProtectSavedMediaFromDeleteLater(mediaMetadata);
            }
            return response.data;
        } catch (err: any) {
            console.error(errorMessage, err);
            throw err;
        }
    }, [PostId]);

    const enqueueBShotTruthMutation = useCallback((
        mutate: (draft: BShotTruth) => void,
        errorMessage = "Failed to save BShot truth",
        upscale?: any,
        mediaMetadata?: BShotMediaMetadata,
    ) => {
        const capturedTopology = upscale?.topologyVersion ?? sceneTopologyVersionRef.current;
        const capturedPostId = String(upscale?.postId ?? PostId);
        return bShotTruthQueueRef.current(async () => {
        const next = cloneBShotTruth(bShotTruthRef.current);
        mutate(next);

        if (upscale) {
            const { parentScene, bShotIndex, sourceUrl } = upscale;
            const canPromote = () => upscale.promote !== false && capturedPostId === String(bShotTruthPostIdRef.current)
                && capturedTopology === sceneTopologyVersionRef.current
                && bShotTruthRef.current.videos[parentScene]?.[bShotIndex] === sourceUrl;
            const receipt = { ...upscale, promote: canPromote() };
            const saved = await saveBShotTruthPayload(next.images, next.videos, next.prompts, errorMessage, receipt, mediaMetadata);
            const promoted = receipt.promote && saved?.promoted !== false && canPromote();
            if (promoted) {
                // Persistence can await while prompts/images or another slot
                // change. Promote only this owned source in the latest truth.
                const latest = cloneBShotTruth(bShotTruthRef.current);
                ensureBShotTruthSlot(latest, parentScene);
                latest.videos[parentScene][bShotIndex] = upscale.videoUrl;
                bShotTruthRef.current = latest;
                setBShotVideos?.(latest.videos);
            }
            return { ...cloneBShotTruth(bShotTruthRef.current), promoted };
        }

        // Publish the canonical snapshot before persistence so the next queued
        // mutation cannot clone the state from an older request.
        bShotTruthRef.current = next;
        setBShotImages?.(next.images);
        setBShotVideos?.(next.videos);
        setBShotPrompts?.(next.prompts);

        await saveBShotTruthPayload(next.images, next.videos, next.prompts, errorMessage, upscale, mediaMetadata);
        return next;
        });
    }, [PostId, saveBShotTruthPayload, setBShotImages, setBShotPrompts, setBShotVideos]);

    const handleBShotTruthSave = useCallback(async (
        mediaUrl: string,
        promptText: string,
        isVideo: boolean,
        parentScene = activeEdit,
        bShotIndex = activeBShotEdit,
        upscale?: any,
        mediaMetadata?: BShotMediaMetadata,
    ) => {
        if (!mediaUrl || typeof parentScene !== "number" || bShotIndex === null || bShotIndex === undefined) {
            const error = new Error("Failed to save BShot truth: missing target slot");
            console.error(error.message, { mediaUrl, parentScene, bShotIndex });
            throw error;
        }

        const saved: any = await enqueueBShotTruthMutation((draft) => {
            ensureBShotTruthSlot(draft, parentScene);
            if (isVideo) {
                draft.videos[parentScene][bShotIndex] = mediaUrl;
            } else {
                draft.images[parentScene][bShotIndex] = mediaUrl;
            }

            if (promptText && promptText.trim()) {
                draft.prompts[parentScene][bShotIndex] = cleanQuotedAtMentions(promptText);
            }
        }, "Failed to save BShot truth", isVideo && upscale ? { ...upscale, videoUrl: mediaUrl, parentScene, bShotIndex } : undefined,
            isVideo ? { ...mediaMetadata, targetKey: `B:${parentScene}:${bShotIndex}`, videoPrompt: mediaMetadata?.videoPrompt || promptText } : mediaMetadata);
        if (isVideo && upscale) {
            upscale.promoted = saved.promoted;
            if (saved.promoted) setSavedVideoUpscales(previous => ({
                ...previous, [sceneTargetKey({ type: 'B', index: parentScene, bIndex: bShotIndex })]: { ...upscale, videoUrl: mediaUrl },
            }));
            return { promoted: saved.promoted };
        }
    // LEGACY INTERACTIONS: disabled; spatial preview will use the authored graphs.
//         const nextVideos = nextTruth.videos;
//
//         if (type === 3 && isVideo && VideoArrayCloud) {
//             const keysToRemove: string[] = [];
//             for (let storageIndex = 0; storageIndex < localStorage.length; storageIndex++) {
//                 const key = localStorage.key(storageIndex);
//                 if (key && /^localstoragevid\d+$/.test(key)) {
//                     keysToRemove.push(key);
//                 }
//             }
//             keysToRemove.forEach((key) => localStorage.removeItem(key));
//             localStorage.removeItem("localInteractionpostId");
//
//             if (PostId !== undefined && PostId !== null && String(PostId).trim() !== "") {
//                 localStorage.setItem("localInteractionpostId", String(PostId));
//             }
//
//             const maxLen = Math.max(VideoArrayCloud.length, nextVideos.length);
//             let interleavedIndex = 1;
//             for (let i = 0; i < maxLen; i++) {
//                 const aRollVid = VideoArrayCloud[i];
//                 if (aRollVid && aRollVid !== "EMPTY" && aRollVid.trim() !== "") {
//                     localStorage.setItem('localstoragevid' + interleavedIndex, aRollVid);
//                     interleavedIndex++;
//                 }
//
//                 if (nextVideos[i]) {
//                     for (let j = 0; j < nextVideos[i].length; j++) {
//                         const bVid = nextVideos[i][j];
//                         if (bVid && bVid !== "EMPTY_BSHOT" && bVid.trim() !== "") {
//                             localStorage.setItem('localstoragevid' + interleavedIndex, bVid);
//                             interleavedIndex++;
//                         }
//                     }
//                 }
//             }
//         }
    }, [activeEdit, activeBShotEdit, VideoArrayCloud, enqueueBShotTruthMutation, type]);

    const [defaultVideoStartFrames, setDefaultVideoStartFrames] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'defaultVideoStartFrames', []);
    const [savedSceneImages, setSavedSceneImages] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'savedSceneImages', () => [...(ImagesHdCloud || [])]);

    const savedScenePostIdRef = useRef(PostId);
    // Hydrate persisted projects and clear stale canon when the active project changes,
    // but never mirror later video-mode first-frame substitutions into Saved.
    useEffect(() => {
        const projectChanged = savedScenePostIdRef.current !== PostId;
        const hasSavedSceneImages = savedSceneImages.some((url) => Boolean(String(url || "").trim()));
        const hasPersistedSceneImages = ImagesHdCloud?.some((url: string) => Boolean(String(url || "").trim()));

        if (projectChanged) {
            savedScenePostIdRef.current = PostId;
            setSavedSceneImages(PostId > 0 && hasPersistedSceneImages ? [...(ImagesHdCloud || [])] : []);
            return;
        }
        if (!hasSavedSceneImages && PostId > 0 && hasPersistedSceneImages) {
            setSavedSceneImages([...(ImagesHdCloud || [])]);
        }
    }, [ImagesHdCloud, PostId, savedSceneImages]);

    useEffect(() => {
        if (!VideMode) {
            // In Image mode, strictly mirror the array every time so it's always up to date
            setDefaultVideoStartFrames([...(ImagesHdCloud || [])]);
        } else {
            // In Video mode, ONLY fill in empty slots. Never overwrite existing ones!
            setDefaultVideoStartFrames(prev => {
                let updated = false;
                const next = [...prev];
                ImagesHdCloud?.forEach((url: string, i: number) => {
                    if (url && typeof url === 'string' && url.trim() !== '' && !next[i]) {
                        next[i] = url;
                        updated = true;
                    }
                });
                return updated ? next : prev;
            });
        }
    }, [ImagesHdCloud, VideMode]);

    const [flip, setflip] = useState(false);


    const [audioError, setAudioError] = useState<{ show: boolean, scene: number | string, text: string, message: string }>({ show: false, scene: '', text: '', message: '' });
    const [audioVoiceGenerationTrigger, setAudioVoiceGenerationTrigger] = useState<any>(null);
    const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null);
    const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
    const [generatedAudiosCloud, setGeneratedAudiosCloud] = usePersistedCreationState<string[]>(creationDraft, 'storybook', 'generatedAudiosCloud', []);



    const [isGenerating, setIsGenerating] = useState<boolean[]>([]);
    const [isBShotGenerating, setIsBShotGenerating] = useState<boolean[][]>([]);

    const [bShotLoaders, setBShotLoaders] = useState<number[][]>([]);



    const [showVoices, setShowVoices] = useState(false);
    const [voice, setVoice] = usePersistedCreationState(creationDraft, 'storybook', 'voice', DEFAULT_FISH_VOICE);
    const initialNarrationVoiceRef = useRef(voice);
    const narrationRequestsRef = useRef(new OwnedCreationRequests<string>());
    const narrationWorkerRef = useRef(new SerialCreationWorker());
    const narrationRequestedRef = useRef(false);
    const narrationMetadataRef = useRef(new Map<string, string>(Object.entries(draftSeed.narrationMetadata || {})));
    const durableNarrationRef = useRef(new Map<string, string>(Object.entries(draftSeed.narrationMetadata || {}).map(([url, key]) => [String(key), url])));
    const failedNarrationRequestsRef = useRef(new Set<string>());
    const [audioWorkRevision, setAudioWorkRevision] = useState(0);
    const observedNarrationWorkRef = useRef<Promise<void> | null>(null);
    const narrationLiveRef = useRef<any>({ enabled: true, voice, plots: [], audios: [], texts: [], layout: 0 });
    const bShotWorkLiveRef = useRef<any>({});
    const [savedVideoUpscales, setSavedVideoUpscales] = usePersistedCreationState<Record<string, any>>(creationDraft, 'storybook', 'savedVideoUpscales', {});
    const [videoHistory, setVideoHistory] = usePersistedCreationState<VideoHistory>(creationDraft, 'storybook', 'videoHistory', {});
    const videoHistoryRef = useRef<VideoHistory>({});
    const videoHistoryOwnerRef = useRef({ postId: String(PostId), creationProjectId, userId: String(loggedUser?.id || 'guest') });
    videoHistoryOwnerRef.current = { postId: String(PostId), creationProjectId, userId: String(loggedUser?.id || 'guest') };
    const restoredVideoHistoryOwnerRef = useRef<typeof videoHistoryOwnerRef.current | null>(null);
    const protectVideoHistory = useCallback((history: VideoHistory) => {
        const urls = Object.values(history).flatMap(entries => entries.map(entry => entry.videoUrl));
        RemoveVideoFromDeleteLater(urls);
        ProtectSavedMediaFromDeleteLater(history);
    }, []);
    const cacheVideoHistory = useCallback((history: VideoHistory) => {
        const owner = videoHistoryOwnerRef.current;
        const prefix = `clik-video-history:${owner.userId}:`;
        const serialized = JSON.stringify(normalizeVideoHistory(history));
        try {
            if (owner.creationProjectId) localStorage.setItem(`${prefix}project:${owner.creationProjectId}`, JSON.stringify({
                postId: Number(owner.postId) > 0 ? owner.postId : null,
                videoHistory: normalizeVideoHistory(history),
            }));
            if (Number(owner.postId) > 0) localStorage.setItem(`${prefix}post:${owner.postId}`, serialized);
        } catch (error) { console.warn('Could not cache stored video history:', error); }
    }, []);
    const onVideoMediaStored = useCallback((target: SceneTarget, entry: VideoHistoryEntry & { projectId?: string; creationProjectId?: string }) => {
        const owner = videoHistoryOwnerRef.current;
        if (entry.projectId !== undefined && String(entry.projectId) !== owner.postId) return;
        if (entry.creationProjectId !== undefined && entry.creationProjectId !== owner.creationProjectId) return;
        const next = appendVideoHistory(videoHistoryRef.current, sceneTargetKey(target), entry);
        videoHistoryRef.current = next;
        setVideoHistory(next);
        protectVideoHistory(next);
        cacheVideoHistory(next);
    }, [protectVideoHistory, cacheVideoHistory]);
    useEffect(() => {
        let cancelled = false;
        const owner = { ...videoHistoryOwnerRef.current }, previous = restoredVideoHistoryOwnerRef.current;
        let cached: VideoHistory = creationDraft ? normalizeVideoHistory((creationDraft as DraftController).section<any>('storybook')?.videoHistory) : {};
        const prefix = `clik-video-history:${owner.userId}:`;
        const sameCreation = previous?.userId === owner.userId && previous?.creationProjectId === owner.creationProjectId;
        const samePost = sameCreation && previous?.postId === owner.postId;
        const firstSavedPost = sameCreation && !!owner.creationProjectId && Number(previous?.postId) <= 0 && Number(owner.postId) > 0;
        try {
            if (!creationDraft && owner.creationProjectId) {
                const projectCache = JSON.parse(localStorage.getItem(`${prefix}project:${owner.creationProjectId}`) || '{}');
                const boundPost = projectCache.postId;
                const currentDraft = Number(owner.postId) <= 0;
                // A draft can become its first post. A later post switch must
                // restore that post's own cache, even if the draft id is reused.
                if (projectCache.videoHistory && (String(boundPost) === owner.postId
                    || (!boundPost && (currentDraft || !previous || firstSavedPost)))) {
                    cached = mergeVideoHistory(cached, projectCache.videoHistory);
                } else if (currentDraft && !projectCache.videoHistory && !boundPost) {
                    cached = mergeVideoHistory(cached, projectCache);
                }
            }
            if (!creationDraft && Number(owner.postId) > 0) cached = mergeVideoHistory(cached, JSON.parse(localStorage.getItem(`${prefix}post:${owner.postId}`) || '{}'));
        } catch (error) { console.warn('Could not restore stored video history:', error); }
        const keepDraft = samePost || firstSavedPost;
        videoHistoryRef.current = mergeVideoHistory(keepDraft ? videoHistoryRef.current : {}, cached);
        restoredVideoHistoryOwnerRef.current = owner;
        setVideoHistory(videoHistoryRef.current);
        protectVideoHistory(videoHistoryRef.current);
        cacheVideoHistory(videoHistoryRef.current);
        if (!creationDraft && Number(owner.postId) > 0) void axios.get<any>(`${CLIK_URL}/SavedVideoUpscales`, { params: { postId: owner.postId }, withCredentials: true }).then(response => {
            const current = videoHistoryOwnerRef.current;
            if (cancelled || current.postId !== owner.postId || current.creationProjectId !== owner.creationProjectId || current.userId !== owner.userId) return;
            const next = mergeVideoHistory(videoHistoryRef.current, response.data?.videoHistory);
            videoHistoryRef.current = next;
            setVideoHistory(next);
            setSavedVideoUpscales(response.data?.upscales || {});
            dispatch(restoreImageResultModels(response.data?.imageModels || {}));
            RemoveVideoFromDeleteLater(response.data?.retainedMediaUrls || []);
            protectVideoHistory(next);
            cacheVideoHistory(next);
        }).catch(error => { if (!cancelled) console.error('Could not restore saved video history:', error); });
        return () => { cancelled = true; };
    }, [PostId, creationProjectId, loggedUser?.id, protectVideoHistory, cacheVideoHistory]);


    const [loadPrompt, setLoadPrompt] = useState<number[]>(
        () => Array(steps.length).fill(0) // first render load
    );


    const loaders = (loadersArray && loadersArray.length > 0) ? loadersArray : Array(steps.length).fill(0);
    const setLoaders = setLoadersArray || (() => { });


    const [loadersPrompt, setLoadersPrompt] = useState<number[]>(
        () => Array(steps.length).fill(0) // first render load
    );




    // 2) Using filter()
    const removeFromStep = (index: number) => {
        // Remove from the “low-res” blobs
        setGeneratedImagesFluxBlob((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        // Remove from the “HD” blobs
        setGeneratedImagesFluxBlobHd((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        // Remove from the URL/previews
        setGeneratedImagesFlux((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        setSteps((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)  // keep all but the one at `index`
        );

        setStepsx((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)  // keep all but the one at `index`
        );
    };
    const originalPromptToInjected = async (text: string, activeReferences: any[]) => {
        try {
            console.log("[INJECTION START] Original Text:", text);
            let injectedText = cleanQuotedAtMentions(text);

            activeReferences.forEach((ref: any) => {
                const rawName = String(ref.name).trim();
                if (!rawName) return;

                // Escape syntax characters in the name strictly
                const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // Format the twitter-style @Handle (stripping spaces/symbols)
                const handle = "@" + rawName.replace(/[^a-zA-Z0-9_]/g, "");

                // Create a flexible name pattern that allows optional spaces/hyphens between words
                // e.g. "Ridgeback Titan" -> "Ridgeback[\s\-]*Titan"
                const words = rawName.split(/[\s\-]+/);
                const flexibleNamePattern = words.map(w => escapeRegExp(w)).join('[\\s\\-]*');

                const regex = new RegExp(`(?<!@)\\b(?:${flexibleNamePattern})\\b`, 'gi');
                injectedText = mapUnquotedPromptText(injectedText, unquoted => unquoted.replace(regex, handle));
            });

            console.log("[INJECTION END] New Text:", injectedText);
            return injectedText;
        } catch (err) {
            console.error("Local Regex Injection error:", err);
            return cleanQuotedAtMentions(text);
        }
    };

    const injectedScenesRef = useRef<Set<number>>(new Set());

    const [sceneActiveCharacters, setSceneActiveCharacters] = usePersistedCreationState<Array<Array<any>>>(creationDraft, 'storybook', 'sceneActiveCharacters', []);
    const [sceneActiveCharactersVideo, setSceneActiveCharactersVideo] = usePersistedCreationState<Array<Array<any>>>(creationDraft, 'storybook', 'sceneActiveCharactersVideo', []);
    const [safetyImageSetsByTarget, setSafetyImageSetsByTarget] = usePersistedCreationState<Record<string, SceneSafetyImageSet>>(creationDraft, 'storybook', 'safetyImageSetsByTarget', {});
    const [safetyVideoSetsByTarget, setSafetyVideoSetsByTarget] = usePersistedCreationState<Record<string, SceneSafetyVideoSet>>(creationDraft, 'storybook', 'safetyVideoSetsByTarget', {});

    // --- UNIFIED ARRAY ARCHITECTURE ---
    const unifiedIndexMap = useMemo(() => {
        const map: { type: 'A' | 'B', index: number, bIndex?: number, originalIndex: number }[] = [];
        let flatIdx = 0;
        (steps || []).forEach((_, i) => {
            map.push({ type: 'A', index: i, originalIndex: flatIdx++ });
            if (isBShotModeActive) {
                (bShotPrompts?.[i] || []).forEach((_, j) => {
                    map.push({ type: 'B', index: i, bIndex: j, originalIndex: flatIdx++ });
                });
            }
        });
        return map;
    }, [steps, isBShotModeActive, bShotPrompts]);

    const unifiedSteps = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? steps?.[m.index] : (bShotPrompts?.[m.index]?.[m.bIndex] || "")), [unifiedIndexMap, steps, bShotPrompts]);
    const unifiedGeneratedImagesFlux = useMemo(() => unifiedIndexMap.map(m => {
        const val = m.type === 'A' ? generatedImagesFlux?.[m.index] : bShotImages?.[m.index]?.[m.bIndex];
        return val === "EMPTY_BSHOT" ? undefined : val;
    }), [unifiedIndexMap, generatedImagesFlux, bShotImages]);
    const unifiedImagesHdCloud = useMemo(() => unifiedIndexMap.map(m => {
        const val = m.type === 'A' ? ImagesHdCloud?.[m.index] : bShotImages?.[m.index]?.[m.bIndex];
        return val === "EMPTY_BSHOT" ? undefined : val;
    }), [unifiedIndexMap, ImagesHdCloud, bShotImages]);
    const unifiedDrawFrameData = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? (drawFrameData?.[m.index] || null) : (bShotDrawFrameData?.[m.index]?.[m.bIndex!] || null)), [unifiedIndexMap, drawFrameData, bShotDrawFrameData]);
    const unifiedTextVideo = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? TextVideo?.[m.index] : (bShotTextVideo?.[m.index]?.[m.bIndex] || "")), [unifiedIndexMap, TextVideo, bShotTextVideo]);
    const unifiedAutoDrawGuideData = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? autoDrawGuideData?.[m.index] : (bShotAutoDrawGuideData?.[m.index]?.[m.bIndex] || null)), [unifiedIndexMap, autoDrawGuideData, bShotAutoDrawGuideData]);
    const unifiedAutoDrawGuideModes = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? (autoDrawGuideModes?.[m.index] || "text") : (bShotAutoDrawGuideModes?.[m.index]?.[m.bIndex!] || "text")), [unifiedIndexMap, autoDrawGuideModes, bShotAutoDrawGuideModes]);
    const unifiedVideoArrayCloud = useMemo(() => unifiedIndexMap.map(m => {
        const val = m.type === 'A' ? VideoArrayCloud?.[m.index] : bShotVideos?.[m.index]?.[m.bIndex];
        return val === "EMPTY_BSHOT" ? undefined : val;
    }), [unifiedIndexMap, VideoArrayCloud, bShotVideos]);
    const unifiedNanoImages = useMemo(() => unifiedIndexMap.map(m => {
        const val = m.type === 'A' ? nanoImages?.[m.index] : bShotNanoImages?.[m.index]?.[m.bIndex];
        return val === "EMPTY_BSHOT" ? undefined : val;
    }), [unifiedIndexMap, nanoImages, bShotNanoImages]);
    const unifiedGeneratedText = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? GeneratedText?.[m.index] : (bShotPrompts?.[m.index]?.[m.bIndex] || "")), [unifiedIndexMap, GeneratedText, bShotPrompts]);
    const unifiedGeneratedTextx = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? GeneratedTextx?.[m.index] : (bShotPrompts?.[m.index]?.[m.bIndex] || "")), [unifiedIndexMap, GeneratedTextx, bShotPrompts]);
    const unifiedSteps2 = useMemo(() => unifiedIndexMap.map(m => steps2?.[m.index]), [unifiedIndexMap, steps2]);
    const unifiedVideoArray = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? VideoArray?.[m.index] : bShotVideoArray?.[m.index]?.[m.bIndex]), [unifiedIndexMap, VideoArray, bShotVideoArray]);
    const unifiedVideoArrayBlob = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? VideoArrayBlob?.[m.index] : bShotVideoArrayBlob?.[m.index]?.[m.bIndex]), [unifiedIndexMap, VideoArrayBlob, bShotVideoArrayBlob]);
    const unifiedLoaders = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? loadersArray?.[m.index] : (bShotLoaders?.[m.index]?.[m.bIndex] || 0)), [unifiedIndexMap, loadersArray, bShotLoaders]);
    const unifiedNoImagePrompt = useMemo(() => unifiedIndexMap.map(m => m.type === 'A'
        ? !!noImagePrompt?.[m.index]
        : !!bShotNoImagePrompt?.[m.index]?.[m.bIndex!]
    ), [unifiedIndexMap, noImagePrompt, bShotNoImagePrompt]);
    const unifiedReferenceVideoUrls = useMemo(() => unifiedIndexMap.map(m => m.type === 'A'
        ? (referenceVideoUrls?.[m.index] || "")
        : (bShotReferenceVideoUrls?.[m.index]?.[m.bIndex!] || "")
    ), [unifiedIndexMap, referenceVideoUrls, bShotReferenceVideoUrls]);
    const unifiedReferenceVideoActiveList = useMemo(() => unifiedIndexMap.map(m => m.type === 'A'
        ? !!referenceVideoActiveList?.[m.index]
        : !!bShotReferenceVideoActiveList?.[m.index]?.[m.bIndex!]
    ), [unifiedIndexMap, referenceVideoActiveList, bShotReferenceVideoActiveList]);
    const unifiedSceneActiveCharacters = useMemo(() => unifiedIndexMap.map(m => m.type === 'A'
        ? (sceneActiveCharacters?.[m.index] || [])
        : (bShotSceneActiveCharacters?.[m.index]?.[m.bIndex!] || [])
    ), [unifiedIndexMap, sceneActiveCharacters, bShotSceneActiveCharacters]);
    const unifiedSceneActiveCharactersVideo = useMemo(() => unifiedIndexMap.map(m => m.type === 'A'
        ? (sceneActiveCharactersVideo?.[m.index] || [])
        : (bShotSceneActiveCharactersVideo?.[m.index]?.[m.bIndex!] || [])
    ), [unifiedIndexMap, sceneActiveCharactersVideo, bShotSceneActiveCharactersVideo]);

    // Active Edit Mapping
    const unifiedActiveEdit = useMemo(() => {
        const match = activeBShotEdit !== null && isBShotModeActive
            ? unifiedIndexMap.find(m => m.type === 'B' && m.index === activeEdit && m.bIndex === activeBShotEdit)
            : unifiedIndexMap.find(m => m.type === 'A' && m.index === activeEdit);
        return match?.originalIndex ?? -1;
    }, [unifiedIndexMap, activeEdit, activeBShotEdit, isBShotModeActive]);
    const editStoryIndex = unifiedActiveEdit >= 0 ? unifiedActiveEdit : 0;
    const spatialLinkOptions = (steps || []).flatMap((_: any, sceneIndex: number) => {
        const sceneId = spatialManifest.scenes[sceneIndex]?.sceneId;
        if (!sceneId) return [];
        return [{ sceneId, label: `Scene ${sceneIndex + 1}`, frameUrl: String(ImagesHdCloud?.[sceneIndex] || generatedImagesFlux?.[sceneIndex] || ""), videoUrl: VideoArrayCloud?.[sceneIndex] },
            ...(bShotPrompts?.[sceneIndex] || []).map((prompt: string, bShotIndex: number) => ({
                sceneId, bShotIndex, bShotIdentity: bShotSpatialScenes[sceneIndex]?.[bShotIndex]?.sceneId || hashIntentValue(prompt),
                label: `Scene ${sceneIndex + 1} · B-roll ${bShotIndex + 1}`,
                frameUrl: String(bShotImages?.[sceneIndex]?.[bShotIndex] || bShotNanoImages?.[sceneIndex]?.[bShotIndex] || "").replace(/^EMPTY_BSHOT$/, ""),
                videoUrl: bShotVideos?.[sceneIndex]?.[bShotIndex],
            }))];
    });
    const spatialCreationStages = buildSpatialExperienceStages(spatialLinkOptions, spatialManifest.scenes, bShotSpatialScenes, spatialMotionContexts, bShotSpatialContexts);
    const navigateSpatialPosition = (position: SpatialPosition) => {
        const stage = spatialCreationStages.find(stage => stage.id === position.stageId);
        if (!stage || !stage.scene.nodes.some(node => node.id === position.nodeId && node.frameUrl)) return false;
        const target = resolveSpatialSceneLink(stage.address, spatialManifest.scenes,
            (bShotPrompts || []).map((row: string[], a: number) => row.map((prompt, b) => bShotSpatialScenes[a]?.[b]?.sceneId || hashIntentValue(prompt))));
        if (!target) return false;
        if (target.bShotIndex !== null) {
            const b = target.bShotIndex;
            setBShotSpatialScenes((previous: Array<Array<SpatialSceneState | null>>) => {
                const existing = previous[target.sceneIndex]?.[b];
                // The adapter already validated the current B-shot identity. A stale saved graph
                // must not replace its new root while this shot's initialization effect catches up.
                const current = existing?.sceneId === stage.id ? existing : stage.scene;
                const next = [...previous]; next[target.sceneIndex] = [...(next[target.sceneIndex] || [])];
                next[target.sceneIndex][b] = {...current, activeNodeId: position.nodeId, draftMovement: null};
                return next;
            });
            setIsBShotModeActive(true);
        } else {
            setSpatialManifest((previous: SpatialManifest) => ({...previous, scenes: previous.scenes.map(scene =>
                scene.sceneId === stage.id ? {...scene, activeNodeId: position.nodeId, draftMovement: null} : scene)}));
        }
        setactiveEdit(target.sceneIndex);
        setActiveBShotEdit(target.bShotIndex);
        currentDeckHistory.current.selectScene(sceneDeckKey(target.sceneIndex, target.bShotIndex));
        return true;
    };


    /* ------------------------------------------------------------------ */
    /*  AUTO IMAGE RUNNER                                                  */
    /*                                                                     */
    /*  A timer that clicks "generate" for you. It owns no queue: on every  */
    /*  tick it re-scans the unified scene list and takes the first slot    */
    /*  with no HD image. That keeps it automatically consistent with       */
    /*  anything you do by hand — a scene you render yourself simply stops  */
    /*  being empty and the next scan walks past it — and it survives the   */
    /*  array reindexing that scene deletion performs.                      */
    /*                                                                     */
    /*  Images only. Video arrays are never consulted.                      */
    /*  Pricing is not handled here: EditStory charges per call exactly as  */
    /*  a manual click does.                                                */
    /* ------------------------------------------------------------------ */
    const [autoImageRunnerOn, setAutoImageRunnerOn] = useState(false);
    // Slots fired during the CURRENT run. A render outlasts the 8s tick, so
    // without this the runner would re-fire the same slot every tick while
    // waiting on it. Cleared each time the runner is armed, which is what makes
    // a previously failed slot eligible again on the next run.
    const autoFiredKeysRef = useRef<Set<string>>(new Set());
    const autoTickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoGeneratorRef = useRef<((target: SceneTarget) => boolean | Promise<boolean>) | null>(null);
    const AUTO_TICK_MS = 8000;

    /** True when a unified slot still needs an HD image. */
    const isUnifiedSlotEmpty = useCallback((i: number) => {
        const target = unifiedIndexMap[i];
        if (target?.type === 'A') return !isSceneImageFinal(target.index);
        return !hasFinalSceneImage({
            hdImageUrl: unifiedImagesHdCloud?.[i],
            displayImageUrl: unifiedGeneratedImagesFlux?.[i],
            nanoImageUrl: unifiedNanoImages?.[i],
            quality: imageProvenanceRef.current.quality(unifiedGeneratedImagesFlux?.[i] || unifiedImagesHdCloud?.[i]),
        });
    }, [unifiedIndexMap, unifiedImagesHdCloud, unifiedGeneratedImagesFlux, unifiedNanoImages, isSceneImageFinal, imageMediaRevision]);

    /** Unified indexes still missing an image, in grid order. */
    const autoPendingIndexes = useMemo(() => {
        const pending: number[] = [];
        unifiedIndexMap.forEach((_entry, i) => {
            if (isUnifiedSlotEmpty(i)) pending.push(i);
        });
        return pending;
    }, [unifiedIndexMap, isUnifiedSlotEmpty]);

    const pendingPrimaryImages = autoPendingIndexes.filter(i => unifiedIndexMap[i]?.type === 'A').length;
    const pendingBShotImages = autoPendingIndexes.length - pendingPrimaryImages;
    const narrationRequiresBShots = type === 1 && Boolean(activatevoicenarration) && !isStoryMusicVideoMode;
    // Read-only Concierge indicators. Never use grid display mode to infer a
    // slot's role, and never count an optional blank B-shot as missing main work.
    const primarySlotCount = unifiedIndexMap.filter(slot => slot.type === 'A').length;
    const bShotSlotCount = unifiedIndexMap.length - primarySlotCount;
    const hasObservedVideo = (value: any) => value instanceof Blob ? value.size > 0 : isValidVideo(value);
    const primaryVideosReady = unifiedIndexMap.filter((slot, i) => slot.type === 'A'
        && [unifiedVideoArrayCloud[i], unifiedVideoArray[i], unifiedVideoArrayBlob[i]].some(hasObservedVideo)).length;
    const bShotVideosReady = unifiedIndexMap.filter((slot, i) => slot.type === 'B'
        && [unifiedVideoArrayCloud[i], unifiedVideoArray[i], unifiedVideoArrayBlob[i]].some(hasObservedVideo)).length;

    const sceneDisplayMap = useMemo(() => buildSceneDisplayMap(unifiedIndexMap.map((slot, i) => {
        const hasHdImage = !isUnifiedSlotEmpty(i);
        return { ...slot, hasHdImage,
            hasPreviewImage: !hasHdImage && Boolean(unifiedNanoImages[i] || unifiedGeneratedImagesFlux[i] || unifiedImagesHdCloud[i]),
            hasVideo: [unifiedVideoArrayCloud[i], unifiedVideoArray[i], unifiedVideoArrayBlob[i]].some(hasObservedVideo) };
    }), type === 1), [unifiedIndexMap, isUnifiedSlotEmpty, unifiedNanoImages, unifiedGeneratedImagesFlux,
        unifiedImagesHdCloud, unifiedVideoArrayCloud, unifiedVideoArray, unifiedVideoArrayBlob, type]);
    const displayLabel = (target: SceneTarget) => sceneDisplayLabel(sceneDisplayForTarget(sceneDisplayMap.entries, target));

    // Observe changed outputs per slot, including replacements whose total
    // ready count stays the same. This never drives generation or media order.
    const previousMedia = useRef({ projectId: '', slots: new Map<string, { version: string; facts: Omit<CreationMediaChange, 'change' | 'revision'> }>(), revision: 0 });
    const [mediaObservation, setMediaObservation] = useState<{ projectId: string; revision: number; changes: CreationMediaChange[] }>({ projectId: '', revision: 0, changes: [] });
    useEffect(() => {
        const previous = previousMedia.current;
        if (previous.projectId !== creationProjectId) {
            previous.projectId = creationProjectId; previous.slots.clear(); previous.revision = 0;
        }
        const next = new Map<string, { version: string; facts: Omit<CreationMediaChange, 'change' | 'revision'> }>();
        const changes: CreationMediaChange[] = [];
        const note = (facts: Omit<CreationMediaChange, 'change' | 'revision'>, version: string, key: string) => {
            if (!version) return;
            next.set(key, { version, facts });
            const old = previous.slots.get(key);
            if (old?.version !== version) changes.push({ ...facts, change: old ? 'updated' : 'ready', revision: ++previous.revision });
        };
        unifiedIndexMap.forEach((slot, i) => {
            const facts = { sceneNumber: type === 1 ? Math.floor(slot.index / 2) + 1 : slot.index + 1,
                nativeSlotNumber: slot.index + 1, role: slot.type === 'A' ? 'a-shot' as const : 'b-shot' as const,
                ...(slot.type === 'B' ? { bShotNumber: (slot.bIndex ?? 0) + 1 } : {}) };
            const key = `${slot.type}:${slot.index}:${slot.type === 'B' ? slot.bIndex ?? 0 : ''}`;
            const image = !isUnifiedSlotEmpty(i) ? [unifiedImagesHdCloud[i], unifiedGeneratedImagesFlux[i]].find(value => observedMediaVersion(value)) : undefined;
            const video = [unifiedVideoArrayCloud[i], unifiedVideoArray[i], unifiedVideoArrayBlob[i]].find(hasObservedVideo);
            note({ ...facts, kind: 'image' }, observedMediaVersion(image), `${key}:image`);
            note({ ...facts, kind: 'video' }, observedMediaVersion(video), `${key}:video`);
        });
        previous.slots.forEach((old, key) => {
            if (!next.has(key)) changes.push({ ...old.facts, change: 'removed', revision: ++previous.revision });
        });
        previous.slots = next;
        setMediaObservation(current => current.projectId === creationProjectId && !changes.length ? current : {
            projectId: creationProjectId, revision: previous.revision, changes: changes.slice(-8),
        });
    }, [creationProjectId, type, unifiedIndexMap, unifiedImagesHdCloud, unifiedGeneratedImagesFlux,
        unifiedVideoArrayCloud, unifiedVideoArray, unifiedVideoArrayBlob, isUnifiedSlotEmpty]);

    // The runner is only meaningful on the image grids, and only while there is
    // something left to render. It hides itself when the grid is complete.
    // B-shot mode counts as an image grid even though VideMode is still true
    // underneath it, so only the plain Videos page is excluded.
    const isAutoImageGridVisible = isBShotModeActive || !VideMode;
    const canShowAutoImageRunner = isAutoImageGridVisible && !Continue && autoPendingIndexes.length > 0;

    // The tick runs on a timer that outlives the render which armed it, so it
    // must not close over the scene arrays. Everything the scan reads goes
    // through this ref, refreshed every render — that is what makes the runner
    // notice images that landed (or that you rendered by hand) since it started.
    const autoScanRef = useRef({ unifiedIndexMap, unifiedLoaders, isUnifiedSlotEmpty, autoPendingIndexes });
    autoScanRef.current = { unifiedIndexMap, unifiedLoaders, isUnifiedSlotEmpty, autoPendingIndexes };

    const stopAutoImageRunner = useCallback(() => {
        if (autoTickTimerRef.current) {
            clearTimeout(autoTickTimerRef.current);
            autoTickTimerRef.current = null;
        }
        setAutoImageRunnerOn(false);
    }, []);

    // One tick: scan, fire the first eligible slot, schedule the next scan.
    // Stopping only clears the pending timer — anything already in flight
    // finishes and lands normally.
    useEffect(() => {
        if (!autoImageRunnerOn) return;

        const fireNext = () => {
            const generate = autoGeneratorRef.current;
            if (!generate) return;

            // Live read — never the closure's copy.
            const scan = autoScanRef.current;

            const nextIndex = scan.unifiedIndexMap.findIndex((entry, i) => (
                scan.isUnifiedSlotEmpty(i)
                && (entry.type !== 'B' || (canSubmitBShotWork()
                    && !isCompletedCreationMedia(bShotWorkLiveRef.current.videos[entry.index]?.[entry.bIndex ?? 0])))
                && !((scan.unifiedLoaders?.[i] ?? 0) > 0) // already rendering (manual or auto)
                // Keyed by scene identity, never by unified position: deleting a
                // scene mid-run reindexes the map, so a positional key would
                // start pointing at a different scene and silently skip it.
                && !autoFiredKeysRef.current.has(sceneTargetKey(entry))
            ));

            if (nextIndex < 0) {
                // Nothing eligible. If nothing is left at all, disarm; otherwise
                // keep waiting — in-flight slots may still fail and free up.
                if (scan.autoPendingIndexes.length === 0) {
                    stopAutoImageRunner();
                    return;
                }
            } else {
                const entry = scan.unifiedIndexMap[nextIndex];
                const target: SceneTarget = entry.type === 'B'
                    ? { type: 'B', index: entry.index, bIndex: entry.bIndex ?? 0 }
                    : { type: 'A', index: entry.index };
                autoFiredKeysRef.current.add(sceneTargetKey(target));
                try {
                    void Promise.resolve(generate(target)).catch((err) => {
                        console.error("[Storybook] Auto image runner failed to generate a scene:", sceneTargetKey(target), err);
                    });
                } catch (err) {
                    console.error("[Storybook] Auto image runner failed to start a scene:", sceneTargetKey(target), err);
                }
            }

            autoTickTimerRef.current = setTimeout(fireNext, AUTO_TICK_MS);
        };

        fireNext();

        return () => {
            if (autoTickTimerRef.current) {
                clearTimeout(autoTickTimerRef.current);
                autoTickTimerRef.current = null;
            }
        };
        // Intentionally keyed only on the armed flag: the tick re-reads live
        // data through refs/callbacks, so re-running on every array change
        // would restart the cadence on each generation that lands.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoImageRunnerOn, canSubmitBShotWork]);

    // Leaving the image grids disarms the runner.
    useEffect(() => {
        if (autoImageRunnerOn && !canShowAutoImageRunner) stopAutoImageRunner();
    }, [autoImageRunnerOn, canShowAutoImageRunner, stopAutoImageRunner]);

    // Scene keys are stable against reordering WITHIN a layout, but SceneTarget
    // .index is still positional: deleting a scene shifts every later scene down,
    // so "A:2" stops meaning the same scene. Rather than try to track identity
    // across a reindex, drop the fired-set whenever the layout changes size.
    // This is safe because the set is not the only protection — a slot that is
    // mid-render is excluded by the unifiedLoaders check, and a slot that
    // finished is excluded by no longer being empty. The set only guards the
    // window between firing and the loader appearing.
    const autoLayoutSizeRef = useRef(unifiedIndexMap.length);
    useEffect(() => {
        if (autoLayoutSizeRef.current !== unifiedIndexMap.length) {
            autoLayoutSizeRef.current = unifiedIndexMap.length;
            autoFiredKeysRef.current = new Set();
        }
    }, [unifiedIndexMap.length]);

    const toggleAutoImageRunner = useCallback(() => {
        setAutoImageRunnerOn((wasOn) => {
            if (wasOn) {
                if (autoTickTimerRef.current) {
                    clearTimeout(autoTickTimerRef.current);
                    autoTickTimerRef.current = null;
                }
                return false;
            }
            // Arming starts a fresh run: forget what an earlier run fired so
            // slots that failed then are picked up again now.
            autoFiredKeysRef.current = new Set();
            return true;
        });
    }, []);

    // Keep the parent (and therefore the slideshow preview) in sync with the
    // current A-shot videos.
    useEffect(() => {
        onVideosChange(VideoArrayCloud || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [VideoArrayCloud]);

    // Warm the browser cache for the neighboring scenes' Visual Guide images so
    // navigating never shows a stale previous guide while a fresh one downloads.
    useEffect(() => {
        [unifiedActiveEdit - 1, unifiedActiveEdit + 1].forEach((neighborIndex) => {
            const url = String(unifiedAutoDrawGuideData?.[neighborIndex]?.imageUrl || "").trim();
            if (url) {
                const image = new Image();
                image.src = url;
            }
        });
    }, [unifiedActiveEdit, unifiedAutoDrawGuideData]);

    useEffect(() => {
        if (startEdit && unifiedActiveEdit < 0) setstartEdit(false);
    }, [startEdit, unifiedActiveEdit]);

    const handleSetUnifiedActiveEdit = useCallback((newUnifiedIndex: number) => {
        const m = unifiedIndexMap[newUnifiedIndex];
        if (m) {
            setactiveEdit(m.index);
            if (m.type === 'B') {
                setActiveBShotEdit(m.bIndex!);
            } else {
                setActiveBShotEdit(null);
            }
            currentDeckHistory.current.selectScene(sceneDeckKey(m.index, m.type === 'B' ? m.bIndex : null));
        }
    }, [unifiedIndexMap, setactiveEdit]);

    const unifiedStateRef = useRef<any>({});
    unifiedStateRef.current = {
        map: unifiedIndexMap,
        generatedImagesFlux: unifiedGeneratedImagesFlux,
        ImagesHdCloud: unifiedImagesHdCloud,
        drawFrameData: unifiedDrawFrameData,
        TextVideo: unifiedTextVideo,
        autoDrawGuideData: unifiedAutoDrawGuideData,
        autoDrawGuideModes: unifiedAutoDrawGuideModes,
        VideoArrayCloud: unifiedVideoArrayCloud,
        steps: unifiedSteps,
        GeneratedText: unifiedGeneratedText,
        GeneratedTextx: unifiedGeneratedTextx,
        steps2: unifiedSteps2,
        VideoArray: unifiedVideoArray,
        VideoArrayBlob: unifiedVideoArrayBlob,
        noImagePrompt: unifiedNoImagePrompt,
        referenceVideoUrls: unifiedReferenceVideoUrls,
        referenceVideoActiveList: unifiedReferenceVideoActiveList,
        sceneActiveCharacters: unifiedSceneActiveCharacters,
        sceneActiveCharactersVideo: unifiedSceneActiveCharactersVideo,
    };

    const createUnifiedSetter = useCallback((key: string, setA: any, setB: any, isInherited = false, mirrorB: any = null) => {
        return (updater: any) => {
            const refs = unifiedStateRef.current;
            const previousUnified = Array.isArray(refs[key]) ? refs[key] : [];
            let nextUnified = typeof updater === 'function' ? updater(previousUnified) : updater;
            if (!Array.isArray(nextUnified)) return;
            if (['steps', 'GeneratedText', 'GeneratedTextx', 'TextVideo'].includes(key)) {
                nextUnified = nextUnified.map(value => typeof value === 'string' ? cleanQuotedAtMentions(value) : value);
            }

            // Only write slots changed by this update. Replaying the whole flattened
            // snapshot can overwrite another scene when async jobs finish together.
            const changedEntries = Array.from(
                { length: Math.max(previousUnified.length, nextUnified.length) },
                (_, unifiedIndex) => ({ value: nextUnified[unifiedIndex], unifiedIndex })
            ).filter(({ value, unifiedIndex }: any) => !Object.is(value, previousUnified[unifiedIndex]));
            if (changedEntries.length === 0) return;

            setA((prevA: any) => {
                const nextA = [...(prevA || [])];
                let changedA = false;
                changedEntries.forEach(({ value, unifiedIndex }: any) => {
                    const mapping = refs.map[unifiedIndex];
                    if (mapping?.type === 'A') {
                        nextA[mapping.index] = value;
                        changedA = true;
                    } else if (mapping?.type === 'B' && isInherited) {
                        nextA[mapping.index] = value;
                        changedA = true;
                    }
                });
                if (changedA && key === 'steps') console.log("🔥 createUnifiedSetter modified A-Roll array for key:", key);
                return changedA ? nextA : prevA;
            });

            const writeChangedBSlots = (setter: any) => {
                if (!setter || isInherited) return;
                setter((prevB: any) => {
                    const nextB = [...(prevB || [])];
                    let changedB = false;
                    changedEntries.forEach(({ value, unifiedIndex }: any) => {
                        const mapping = refs.map[unifiedIndex];
                        if (mapping?.type !== 'B') return;
                        const sceneEntries = [...(nextB[mapping.index] || [])];
                        sceneEntries[mapping.bIndex!] = value;
                        nextB[mapping.index] = sceneEntries;
                        changedB = true;
                    });
                    return changedB ? nextB : prevB;
                });
            };

            writeChangedBSlots(setB);
            writeChangedBSlots(mirrorB);
        };
    }, []);

    const setUnifiedGeneratedImagesFlux = useMemo(() => createUnifiedSetter('generatedImagesFlux', setGeneratedImagesFlux, setBShotImages), [createUnifiedSetter, setGeneratedImagesFlux, setBShotImages]);
    const setUnifiedImagesHdCloud = useMemo(() => createUnifiedSetter('ImagesHdCloud', setImagesHdCloud, setBShotImages), [createUnifiedSetter, setImagesHdCloud, setBShotImages]);
    const setUnifiedDrawFrameData = useMemo(() => createUnifiedSetter('drawFrameData', setDrawFrameData, setBShotDrawFrameData), [createUnifiedSetter, setDrawFrameData, setBShotDrawFrameData]);
    const setUnifiedTextVideo = useMemo(() => createUnifiedSetter('TextVideo', setTextVideo, setBShotTextVideo), [createUnifiedSetter, setTextVideo, setBShotTextVideo]);

    const resolveUnifiedTarget = useCallback((targetInput: any, fallbackUnifiedIndex: number) => {
        if (targetInput && typeof targetInput === 'object' && (targetInput.type === 'A' || targetInput.type === 'B')) {
            return targetInput;
        }
        const targetUnifiedIndex = typeof targetInput === 'number' ? targetInput : fallbackUnifiedIndex;
        return unifiedIndexMap[targetUnifiedIndex];
    }, [unifiedIndexMap]);

    const updateTextVideoForScene = useCallback((targetInput: any, updater: any) => {
        const target = resolveUnifiedTarget(targetInput, unifiedActiveEdit);
        if (!target) return;

        if (target.type === 'A') {
            setTextVideo((previous: any[] = []) => {
                const next = [...previous];
                const current = String(next[target.index] || "");
                next[target.index] = cleanQuotedAtMentions(String((typeof updater === 'function' ? updater(current) : updater) ?? ''));
                return next;
            });
            return;
        }

        setBShotTextVideo((previous: any[] = []) => {
            const next = [...previous];
            const sceneEntries = Array.isArray(next[target.index]) ? [...next[target.index]] : [];
            const current = String(sceneEntries[target.bIndex!] || "");
            sceneEntries[target.bIndex!] = cleanQuotedAtMentions(String((typeof updater === 'function' ? updater(current) : updater) ?? ''));
            next[target.index] = sceneEntries;
            return next;
        });
    }, [resolveUnifiedTarget, setBShotTextVideo, setTextVideo, unifiedActiveEdit]);

    const updateActiveAutoDrawGuide = useCallback((updater: any, targetInput: any = unifiedActiveEdit) => {
        const target = resolveUnifiedTarget(targetInput, unifiedActiveEdit);
        if (!target) return;

        if (target.type === 'A') {
            setAutoDrawGuideData((previous: any[] = []) => {
                const next = [...previous];
                const current = next[target.index] || null;
                next[target.index] = typeof updater === 'function' ? updater(current) : updater;
                return next;
            });
            return;
        }

        setBShotAutoDrawGuideData((previous: any[] = []) => {
            const next = [...previous];
            const sceneEntries = Array.isArray(next[target.index]) ? [...next[target.index]] : [];
            const current = sceneEntries[target.bIndex!] || null;
            sceneEntries[target.bIndex!] = typeof updater === 'function' ? updater(current) : updater;
            next[target.index] = sceneEntries;
            return next;
        });
    }, [resolveUnifiedTarget, setAutoDrawGuideData, setBShotAutoDrawGuideData, unifiedActiveEdit]);
    const updateActiveAutoDrawGuideMode = useCallback((mode: AutoDrawGuideMode, targetInput: any = unifiedActiveEdit) => {
        const target = resolveUnifiedTarget(targetInput, unifiedActiveEdit);
        if (!target) return;

        if (target.type === 'A') {
            setAutoDrawGuideModes((previous: Array<AutoDrawGuideMode> = []) => {
                const next = [...previous];
                next[target.index] = mode;
                return next;
            });
            return;
        }

        setBShotAutoDrawGuideModes((previous: Array<Array<AutoDrawGuideMode>> = []) => {
            const next = [...previous];
            const sceneEntries = Array.isArray(next[target.index]) ? [...next[target.index]] : [];
            sceneEntries[target.bIndex!] = mode;
            next[target.index] = sceneEntries;
            return next;
        });
    }, [resolveUnifiedTarget, setAutoDrawGuideModes, setBShotAutoDrawGuideModes, unifiedActiveEdit]);
    const setUnifiedVideoArrayCloud = useMemo(() => createUnifiedSetter('VideoArrayCloud', setVideoArrayCloud, setBShotVideos), [createUnifiedSetter, setVideoArrayCloud, setBShotVideos]);
    const setUnifiedSteps = useMemo(() => createUnifiedSetter('steps', setSteps, setBShotPrompts, false, setBShotTextVideo), [createUnifiedSetter, setSteps, setBShotPrompts, setBShotTextVideo]);
    const setUnifiedGeneratedText = useMemo(() => createUnifiedSetter('GeneratedText', setGeneratedText, setBShotPrompts, false, setBShotTextVideo), [createUnifiedSetter, setGeneratedText, setBShotPrompts, setBShotTextVideo]);
    const setUnifiedGeneratedTextx = useMemo(() => createUnifiedSetter('GeneratedTextx', setGeneratedTextx, setBShotPrompts, false, setBShotTextVideo), [createUnifiedSetter, setGeneratedTextx, setBShotPrompts, setBShotTextVideo]);
    const setUnifiedSteps2 = useMemo(() => createUnifiedSetter('steps2', setSteps2, null, true), [createUnifiedSetter, setSteps2]);
    const setUnifiedVideoArray = useMemo(() => createUnifiedSetter('VideoArray', setVideoArray, setBShotVideoArray), [createUnifiedSetter, setVideoArray, setBShotVideoArray]);
    const setUnifiedVideoArrayBlob = useMemo(() => createUnifiedSetter('VideoArrayBlob', setVideoArrayBlob, setBShotVideoArrayBlob), [createUnifiedSetter, setVideoArrayBlob, setBShotVideoArrayBlob]);
    const setUnifiedNoImagePrompt = useMemo(() => createUnifiedSetter('noImagePrompt', setnoImagePrompt, setBShotNoImagePrompt), [createUnifiedSetter, setnoImagePrompt]);
    const setUnifiedReferenceVideoUrls = useMemo(() => createUnifiedSetter('referenceVideoUrls', setReferenceVideoUrls, setBShotReferenceVideoUrls), [createUnifiedSetter]);
    const setUnifiedReferenceVideoActiveList = useMemo(() => createUnifiedSetter('referenceVideoActiveList', setReferenceVideoActiveList, setBShotReferenceVideoActiveList), [createUnifiedSetter]);
    const setUnifiedSceneActiveCharacters = useMemo(() => createUnifiedSetter('sceneActiveCharacters', setSceneActiveCharacters, setBShotSceneActiveCharacters), [createUnifiedSetter]);
    const setUnifiedSceneActiveCharactersVideo = useMemo(() => createUnifiedSetter('sceneActiveCharactersVideo', setSceneActiveCharactersVideo, setBShotSceneActiveCharactersVideo), [createUnifiedSetter]);

    useEffect(() => {
        if (startEdit) return;
        if (!referenceImages || referenceImages.length === 0) return;

        const sceneCount = steps?.length || 0;
        const newActive: Array<Array<{ name: string, url: string }>> = Array(sceneCount).fill([]);

        for (let i = 0; i < sceneCount; i++) {
            // Ensure we strictly extract strings, as generatedImagePrompt may be hijacked with objects containing image history
            const rawPrompt = generatedImagePrompt?.[i];
            const text = (typeof rawPrompt === "string" && rawPrompt.trim() !== "" ? rawPrompt : GeneratedText?.[i]) || "";
            const sceneActive: { name: string, url: string }[] = [];

            for (const ref of referenceImages) {
                if (!ref || !ref.name) continue;
                const handle = "@" + ref.name.replace(/[^A-Za-z0-9_]/g, "");
                const regex = new RegExp(`\\s*${handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
                if (regex.test(text)) sceneActive.push({ name: ref.name, url: ref.imageUrl });
            }
            newActive[i] = sceneActive;
        }
        setSceneActiveCharacters(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newActive)) {
                const totalActive = newActive.reduce((acc, scene) => acc + scene.length, 0);
                if (totalActive > 0) {
                    console.log(`%c[STORYBOOK BACKGROUND SYNC] ${sceneCount} SCENES AUTOPARSED!`, "color: #00fa9a; font-weight: bold; font-size: 14px", newActive);
                }
                return newActive;
            }
            return prev;
        });
    }, [generatedImagePrompt, GeneratedText, referenceImages, startEdit, steps?.length]);

    useEffect(() => {
        if (startEdit) return;
        if (!referenceImages || referenceImages.length === 0) return;

        const sceneCount = steps?.length || 0;
        const newActive: Array<Array<{ name: string, url: string }>> = Array(sceneCount).fill([]);

        for (let i = 0; i < sceneCount; i++) {
            const text = TextVideo?.[i] || "";
            const sceneActive: { name: string, url: string }[] = [];

            for (const ref of referenceImages) {
                if (!ref || !ref.name) continue;
                const handle = "@" + ref.name.replace(/[^A-Za-z0-9_]/g, "");
                const regex = new RegExp(`\\s*${handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
                if (regex.test(text)) sceneActive.push({ name: ref.name, url: ref.imageUrl });
            }
            newActive[i] = sceneActive;
        }
        setSceneActiveCharactersVideo(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newActive)) {
                return newActive;
            }
            return prev;
        });
    }, [referenceImages, startEdit, steps, TextVideo]);

    useEffect(() => {
        const activeReferences = referenceImages || [];
        const elementsMadeWithUrls = activeReferences.filter((c: any) => c.imageUrl && c.imageUrl.length > 0);

        if (elementsMadeWithUrls.length > 0) {
            // 1. Inject characters into the active/editable text
            GeneratedText.forEach((text, i) => {
                if (text && text.trim() !== "") {
                    originalPromptToInjected(text, elementsMadeWithUrls).then(newText => {
                        if (newText !== text) {
                            setGeneratedText(prev => {
                                const next = [...prev];
                                next[i] = newText;
                                return next;
                            });
                        }
                    }).catch(err => console.error(err));
                }
            });

            // 2. Inject characters into the baseline/default text independently
            GeneratedTextx.forEach((text, i) => {
                if (text && text.trim() !== "") {
                    originalPromptToInjected(text, elementsMadeWithUrls).then(newText => {
                        if (newText !== text) {
                            setGeneratedTextx(prev => {
                                const next = [...prev];
                                next[i] = newText;
                                return next;
                            });
                        }
                    }).catch(err => console.error(err));
                }
            });
        }
    }, [GeneratedText, GeneratedTextx, referenceImages]);

    // Same injection logic but for Video Mode (TextVideo array)
    // This auto-injects @handles whenever the AI or auto-prompt engine updates the video prompt.
    // It runs on the background state (TextVideo) so it does not interrupt a user manually typing in the videotxt field.
    useEffect(() => {
        const activeReferences = referenceImages || [];
        const elementsMadeWithUrls = activeReferences.filter((c: any) => c.imageUrl && c.imageUrl.length > 0);

        if (elementsMadeWithUrls.length > 0) {
            TextVideo.forEach((text, i) => {
                if (text && text.trim() !== "") {
                    originalPromptToInjected(text, elementsMadeWithUrls).then(newText => {
                        if (newText !== text) {
                            setTextVideo(prev => {
                                const next = [...prev];
                                next[i] = newText;
                                return next;
                            });
                        }
                    }).catch(err => {
                        console.error(err);
                    });
                }
            });
        }
    }, [TextVideo, referenceImages]);

    useEffect(() => {
        const activeReferences = referenceImages || [];
        const elementsMadeWithUrls = activeReferences.filter((c: any) => c.imageUrl && c.imageUrl.length > 0);

        if (elementsMadeWithUrls.length === 0 || !bShotPrompts?.length || !setBShotPrompts) return;

        let cancelled = false;

        const injectBShotPrompts = async () => {
            let changed = false;
            const nextPrompts = await Promise.all((bShotPrompts || []).map(async (sceneArr: string[]) => {
                if (!sceneArr?.length) return sceneArr;

                let sceneChanged = false;
                const nextScene = await Promise.all(sceneArr.map(async (text: string) => {
                    if (!text || !text.trim()) return text;

                    const newText = await originalPromptToInjected(text, elementsMadeWithUrls);
                    if (newText !== text) {
                        changed = true;
                        sceneChanged = true;
                        return newText;
                    }
                    return text;
                }));

                return sceneChanged ? nextScene : sceneArr;
            }));

            if (!cancelled && changed) {
                setBShotPrompts(nextPrompts);
            }
        };

        injectBShotPrompts();

        return () => {
            cancelled = true;
        };
    }, [bShotPrompts, referenceImages, setBShotPrompts]);

    useEffect(() => {
        const activeReferences = referenceImages || [];
        const elementsMadeWithUrls = activeReferences.filter((c: any) => c.imageUrl && c.imageUrl.length > 0);

        if (elementsMadeWithUrls.length === 0 || !bShotTextVideo?.length || !setBShotTextVideo) return;

        let cancelled = false;

        const injectBShotVideoPrompts = async () => {
            let changed = false;
            const nextTextVideo = await Promise.all((bShotTextVideo || []).map(async (sceneArr: string[]) => {
                if (!sceneArr?.length) return sceneArr;

                let sceneChanged = false;
                const nextScene = await Promise.all(sceneArr.map(async (text: string) => {
                    if (!text || !text.trim()) return text;

                    const newText = await originalPromptToInjected(text, elementsMadeWithUrls);
                    if (newText !== text) {
                        changed = true;
                        sceneChanged = true;
                        return newText;
                    }
                    return text;
                }));

                return sceneChanged ? nextScene : sceneArr;
            }));

            if (!cancelled && changed) {
                setBShotTextVideo(nextTextVideo);
            }
        };

        injectBShotVideoPrompts();

        return () => {
            cancelled = true;
        };
    }, [bShotTextVideo, referenceImages, setBShotTextVideo]);

    /* 2️⃣ one timer handle per tile */
    const loaderTimers = useRef<Record<number, ReturnType<typeof setInterval> | null>>({});
    const loaderHideTimers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
    const loaderEpoch = useRef<Record<number, number>>({});

    /* ------------------------------------------------------------------ */
    /* startLoader(idx)                                                   */
    /* ------------------------------------------------------------------ */
    function startLoader(idx: number) {
        // bump epoch => invalidates any old interval callbacks
        const epoch = (loaderEpoch.current[idx] ?? 0) + 1;
        loaderEpoch.current[idx] = epoch;

        // clear any previous interval + hide timeout for this slot
        if (loaderTimers.current[idx]) {
            clearInterval(loaderTimers.current[idx]!);
            loaderTimers.current[idx] = null;
        }
        if (loaderHideTimers.current[idx]) {
            clearTimeout(loaderHideTimers.current[idx]!);
            loaderHideTimers.current[idx] = null;
        }

        // ensure loaders[] is long enough and set to 1 % immediately
        setLoaders((prev) => {
            const next = [...prev];
            while (next.length <= idx) next.push(0);
            next[idx] = 1;
            return next;
        });

        const begun = Date.now();
        const DURATION = 3 * 60 * 1000; // 3 min (your comment said 5; keep as you want)
        const CAP = 95;

        loaderTimers.current[idx] = setInterval(() => {
            // ignore stale ticks
            if (loaderEpoch.current[idx] !== epoch) return;

            const t = Math.min((Date.now() - begun) / DURATION, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const pct = Math.max(1, Math.round(eased * CAP));

            setLoaders((prev) => {
                // ignore stale ticks again inside state update
                if (loaderEpoch.current[idx] !== epoch) return prev;

                const next = [...prev];
                if (pct > (next[idx] ?? 0)) next[idx] = pct;
                return next;
            });
        }, 200);
    }

    /* ------------------------------------------------------------------ */
    /* finishLoader(idx, isFail)                                          */
    /* ------------------------------------------------------------------ */
    function finishLoader(idx: number, isFail: boolean = false) {
        // bump epoch => kills any in-flight/stale interval updates
        const epoch = (loaderEpoch.current[idx] ?? 0) + 1;
        loaderEpoch.current[idx] = epoch;

        // stop interval
        if (loaderTimers.current[idx]) {
            clearInterval(loaderTimers.current[idx]!);
            loaderTimers.current[idx] = null;
        }

        // clear any previous hide timeout (important)
        if (loaderHideTimers.current[idx]) {
            clearTimeout(loaderHideTimers.current[idx]!);
            loaderHideTimers.current[idx] = null;
        }

        if (isFail) {
            setLoaders((prev) => {
                const next = [...prev];
                if (next.length > idx) next[idx] = 0;
                return next;
            });
        } else {
            // snap to 100
            setLoaders((prev) => {
                const next = [...prev];
                if (next.length > idx) next[idx] = 100;
                return next;
            });

            loaderHideTimers.current[idx] = setTimeout(() => {
                setLoaders((prev) => {
                    if (loaderEpoch.current[idx] !== epoch) return prev;
                    const next = [...prev];
                    next[idx] = 0;
                    return next;
                });
            }, 1000);
        }
    }

    /* ------------------------------------------------------------------ */
    /* updateLoader(idx, pct)                                             */
    /* ------------------------------------------------------------------ */
    function updateLoader(idx: number, pct: number, force: boolean = false) {
        if (force) {
            loaderEpoch.current[idx] = (loaderEpoch.current[idx] ?? 0) + 1;
            if (loaderTimers.current[idx]) {
                clearInterval(loaderTimers.current[idx]!);
                loaderTimers.current[idx] = null;
            }
        }
        setLoaders((prev) => {
            const next = [...prev];
            while (next.length <= idx) next.push(0);
            if (force || pct > next[idx]) next[idx] = pct;
            return next;
        });
    }


    /**
     * 1. Call your backend to get a “visualPromptText.”
     * 2. Then call the huggingface SDXL endpoint with that text to generate an image.
     */
    // Define the sleep function
    const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    const [dbLoad, setdbLoad] = useState(false);

    const [ThumbGo, setThumbGo] = useState(false);

    const Close = () => {
        // Freeze capture before the native reset setters run.
        if (creationDraft) void creationDraft.close().catch(() => undefined);
        pauseBShotWork();
        narrationRequestedRef.current = false;
        narrationLiveRef.current.enabled = false;
        narrationLayoutVersionRef.current += 1;
        visitedVideoGridRef.current = false;
        setManualOnlyVideoPrompts(false);
        stopAll();
        setIsSubmittingKick(false);
        setSteps([]);
        setStepsx([]);
        handleCloseOverlay();
        setGeneratedText([]);
        setGeneratedImagesFlux([]);
        setGeneratedImagesFluxBlob([]);
        setMinimizeMode(1);

        // Clear B-Shot Data
        if (setBShotImages) setBShotImages([]);
        if (setBShotVideos) setBShotVideos([]);
        if (setBShotPrompts) setBShotPrompts([]);
        if (setBShotTextVideo) setBShotTextVideo([]);
        setIsBShotGenerating([]);
        if (setBShotNanoImages) setBShotNanoImages([]);
        if (setBShotDrawFrameData) setBShotDrawFrameData([]);
        if (setBShotAutoDrawGuideData) setBShotAutoDrawGuideData([]);
        if (setBShotAutoDrawGuideModes) setBShotAutoDrawGuideModes([]);
        setBShotNoImagePrompt([]);
        setBShotReferenceVideoUrls([]);
        setBShotReferenceVideoActiveList([]);
        setBShotSceneActiveCharacters([]);
        setBShotSceneActiveCharactersVideo([]);
        bumpSceneTopologyVersion();
        if (setIsBShotModeActive) setIsBShotModeActive(false);
    };

    const [isLoading, setisLoading] = useState<boolean>(false);

    const [LoadData, setLoadData] = useState("Processing..");


    const [Done, setDone] = useState<boolean>(false);

    const [Donex, setDonex] = useState<boolean>(true);

    const [pendingDelete, setPendingDelete] = useState<{ index: number, bIndex?: number, type: 'video' | 'bshot' } | null>(null);

    const confirmDelete = async () => {
        if (!pendingDelete) return;

        const { index, bIndex, type } = pendingDelete;

        if (type === 'video') {
            const cloudVideoUrl = VideoArrayCloud?.[index];
            const localVideoUrl = VideoArray?.[index];
            const fallbackVideoUrl = typeof localVideoUrl === "string" && !localVideoUrl.startsWith("blob:")
                ? localVideoUrl
                : null;
            const videoUrlToDelete = cloudVideoUrl || fallbackVideoUrl;

            if (videoUrlToDelete) {
                await startDeleteVid(videoUrlToDelete);
            }

            setVideoArray((prev: any) => {
                const next = [...prev];
                next[index] = null;
                return next;
            });
            setVideoArrayCloud((prev: any) => {
                const next = [...prev];
                next[index] = null;
                return next;
            });
        } else if (type === 'bshot' && bIndex !== undefined) {
            const current = bShotTruthRef.current;
            const imageUrlToDelete = current.images?.[index]?.[bIndex] || bShotImages?.[index]?.[bIndex];
            const videoUrlToDelete = current.videos?.[index]?.[bIndex] || bShotVideos?.[index]?.[bIndex];

            if (imageUrlToDelete) {
                await startDelete(imageUrlToDelete);
            }
            if (videoUrlToDelete) {
                await startDeleteVid(videoUrlToDelete);
            }

            await enqueueBShotTruthMutation((draft) => {
                ensureBShotTruthSlot(draft, index);
                draft.images[index][bIndex] = null;
                draft.videos[index][bIndex] = null;
            }, "Failed to persist BShot deletion");
            setBShotDrawFrameData((previous: any[][] = []) => {
                const next = previous.map((sceneFrames) => [...(sceneFrames || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = null;
                return next;
            });
            setBShotAutoDrawGuideData((previous: any[][] = []) => {
                const next = previous.map((sceneGuides) => [...(sceneGuides || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = null;
                return next;
            });
            setBShotAutoDrawGuideModes((previous: Array<Array<AutoDrawGuideMode>> = []) => {
                const next = previous.map((sceneModes) => [...(sceneModes || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = "text";
                return next;
            });
            setBShotNoImagePrompt((previous) => {
                const next = previous.map((sceneValues) => [...(sceneValues || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = false;
                return next;
            });
            setBShotReferenceVideoUrls((previous) => {
                const next = previous.map((sceneValues) => [...(sceneValues || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = "";
                return next;
            });
            setBShotReferenceVideoActiveList((previous) => {
                const next = previous.map((sceneValues) => [...(sceneValues || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = false;
                return next;
            });
            setBShotSceneActiveCharacters((previous) => {
                const next = previous.map((sceneValues) => [...(sceneValues || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = [];
                return next;
            });
            setBShotSceneActiveCharactersVideo((previous) => {
                const next = previous.map((sceneValues) => [...(sceneValues || [])]);
                if (!next[index]) next[index] = [];
                next[index][bIndex] = [];
                return next;
            });

        }

        setPendingDelete(null);
    };

    const anyGenerating = React.useMemo(() => {
        // B-shot auto prompt/nano pre-generation (isGeneratingBShotPrompts) is
        // intentionally EXCLUDED here. B-shots are optional, so their nano
        // previews must never hide the bottom buttons — mirrors the A-shot side,
        // where `fetchingPrompts` is likewise not part of anyGenerating.
        // Real, user-triggered B-shot generations still block via isBShotGenerating.
        let isGen = false;
        if (isGenerating && isGenerating.some((status: any) => status === true)) {
            isGen = true;
        }
        if (isBShotGenerating) {
            isBShotGenerating.forEach((bArr: any) => {
                if (bArr && bArr.some((status: boolean) => status === true)) {
                    isGen = true;
                }
            });
        }
        console.error("[Storybook] anyGenerating recalculated:", isGen);
        return isGen;
    }, [isBShotGenerating, isGenerating]);

    useEffect(() => {
        if (narrate === 2 && !VideMode) setVideMode(true);
        if (narrate === 0 && VideMode) setVideMode(false);
    }, [narrate, VideMode, setVideMode]);

    // --- B-SHOT EDITOR NAVIGATION FIX (2026-06-12) ---
    // EditStory defaults a B-shot card without an image to the Images tab
    // (setnarrate(0)), which the sync effect above propagates into a GLOBAL
    // VideMode=false. Without restoration, closing the B-shot editor dumps the
    // user on the A-shot Images grid even when they came from the Videos grid.
    // Snapshot the tab/mode when a B-shot edit opens and restore it on close.
    const narrateBeforeBShotEditRef = useRef<number | null>(null);
    useEffect(() => {
        if (startEdit && activeBShotEdit !== null) {
            if (narrateBeforeBShotEditRef.current === null) {
                narrateBeforeBShotEditRef.current = narrate;
            }
        } else if (!startEdit && narrateBeforeBShotEditRef.current !== null) {
            const restored = narrateBeforeBShotEditRef.current;
            narrateBeforeBShotEditRef.current = null;
            setnarrate(restored); // sync effect above restores VideMode to match
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startEdit, activeBShotEdit]);



    useEffect(() => {
        if (onSaveVisibilityChange) {
            onSaveVisibilityChange(Done && !HideSave);
        }
    }, [Done, HideSave, onSaveVisibilityChange]);

    const [EnhanceCaption, setEnhanceCaption] = usePersistedCreationState(creationDraft, 'storybook', 'EnhanceCaption', "");

    const [EnhanceTitle, setEnhanceTitle] = usePersistedCreationState(creationDraft, 'storybook', 'EnhanceTitle', "");


    const [price4all, setPrice4all] = useState(0);

    //Imagen

    const applyArtStyleToPlan = (
        plan: any,
        style: string
    ): any => {
        if (style === "Auto") {
            console.log("Plan Created:", plan); // <- ✨ here’s your plan
            return plan;
        }

        const token = `${style} art style`;
        const updatedPlan = {
            ...plan,
            art_style: { style_token: token },
            characters: (plan.characters || []).map((char: any) => ({
                ...char,
                style_token: token,
            })),
        };

        console.log("Plan Updated:", updatedPlan);
        return updatedPlan;
    };

    useEffect(() => {



        var x = modelz;
        if (GeneratedImage.length > 0) {

            // fluxUltra (Nano Banana 2 Lite) now takes reference images on its own
            // route, so it no longer re-prices as Kontext here.
            if (modelz === 'Schnell' || modelz === 'Models') {

                x = 'Schnell';
            }
        }

        var pixelsPerImage = calcModelPixels({
            model: x,
            baseImagesPerDollar: 333,
        });


        var cc = steps?.length || 0;
        if (creationDraft && draftSeed.savedSceneImages) cc = steps.filter((_: string, index: number) => !draftSeed.savedSceneImages[index]
            || String(draftSeed.GeneratedText?.[index] || '') !== String(GeneratedText[index] || '')).length;
        setPrice4all(pixelsPerImage * cc);
    }, [modelz, steps, type, GeneratedImage, GeneratedText, creationDraft]);  // dependencies alert



    const [PLoader, setPLoader] = useState(false);

    const [PlanVid, setPlanVid] = usePersistedCreationState<any>(creationDraft, 'storybook', 'PlanVid', null);
    authoredVideoPlanRef.current = PlanVid;

    const [SelectedModel, setSelectedModel] = usePersistedCreationState(creationDraft, 'storybook', 'SelectedModel', '');

    // Video clip duration (seconds). Lifted from EditStory so it is the single
    // source of truth shared between the video editor and the B-shot duration
    // calculation. EditStory receives time/setTime as props.
    const [time, setTime] = usePersistedCreationState(creationDraft, 'storybook', 'time', SelectedModel === "Pro" ? 5 :
            SelectedModel === "pPro" ? 5 :
                SelectedModel === "Proxxx" || SelectedModel === "FalH3" ? 5 : SelectedModel === "Prox" ? 5 : SelectedModel === "Proxx" ? 6 :
                    5);

    const narrationPlots = (steps2 || []).slice(0, 9).filter(Boolean);
    narrationLiveRef.current = {
        enabled: activatevoicenarration && (type !== 1 || narrationSummaryReady), voice, plots: narrationPlots,
        audios: generatedAudios || [], texts: generatedAudioTexts || [], layout: narrationLayoutVersionRef.current,
    };
    const automaticNarrationBShots = activatevoicenarration && type === 1 && !musicMode;
    bShotWorkGateRef.current.allowed = Boolean(isBShotModeActive && !publishLoader2Open
        && (automaticNarrationBShots || optionalBShotsRunning));
    bShotWorkLiveRef.current = {
        prompts: bShotPrompts || [], images: bShotImages || [], videos: bShotVideos || [], nanoImages: bShotNanoImages || [],
        GeneratedText, TextVideo, videoPrompts: bShotTextVideo || [], generatedAudioTexts,
        prompt, Planx, Seed, ratioKey, anyGenerating, topology: sceneTopologyVersionRef.current,
    };
    const hasValidNarrationAudio = useCallback((item: any, index: number) => {
        const live = narrationLiveRef.current;
        const audio = live.audios[index];
        const text = typeof item === 'object' && item !== null ? item.text : item;
        if (!isCompletedCreationMedia(audio) || live.texts[index] !== text) return false;
        const key = narrationContentKey(item, live.voice);
        // Existing paid audio has no legacy settings receipt. Associate it once
        // with this session's original voice instead of silently regenerating it.
        if (!narrationMetadataRef.current.has(audio) && live.voice === initialNarrationVoiceRef.current) {
            narrationMetadataRef.current.set(audio, key);
        }
        return narrationMetadataRef.current.get(audio) === key;
    }, []);
    useEffect(() => {
        if (VideMode) visitedVideoGridRef.current = true;
    }, [VideMode]);
    useEffect(() => {
        if (!isBShotModeActive) pauseBShotWork();
    }, [isBShotModeActive, pauseBShotWork]);

    useEffect(() => {
        console.log(
            `[NarrationToggle] 6. Storybook state committed: activatevoicenarration=${activatevoicenarration}`
        );
    }, [activatevoicenarration]);

    // Define the EnhanceText function
    const StartPlan = async (planImg: any, steps: any) => {
        const restoredPlan = (creationDraft as DraftController | undefined)?.section<Record<string, any>>('storybook')?.PlanVid;
        if (restoredPlan && stableDraftJson((creationDraft as DraftController | undefined)?.section<Record<string, any>>('storybook')?.videoPlanInput) === stableDraftJson([planImg, steps])) {
            setPlanVid(restoredPlan);
            return;
        }


        setPLoader(true);

        try {
            // Prepare the request payload

            const requestData: any = { planImg, steps, previousPlan: authoredVideoPlanRef.current };

            var tt = 'startPlanVid';


            // Make the POST request to the server Models
            const response = await axios.post<any>(
                `${CLIK_URL}/${tt}`,
                requestData,
                { withCredentials: true }
            );


            const { plan } = response.data                     // <- ✨ here’s your plan
            console.log("Plan Created:", plan)

            // example use:



            var finalPlan = plan;

            /// setPlanInfo(3)

            console.log('PlaaaaaaaaaaNNNNVIDDDDDDDD', finalPlan)


            finalPlan = applyArtStyleToPlan(plan, '');
            // do something with finalPlan…






            setPlanVid(finalPlan);
            captureCreationCache(creationDraft, 'storybook', { PlanVid: finalPlan, videoPlanInput: [planImg, steps] });
            if (creationDraft?.getState().postId) void creationDraft.flush().catch(() => undefined);


            setPLoader(false);




            // Update state with the enhanced text


            //setPrompt(data.initialSteps);




        } catch (error: any) {
            // alert('bad');

            setPLoader(false);
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                // setError(error.response.data.message || "Server Error");
            } else if (error.request) {
                // Request was made but no response received
                console.error("No response received:", error.request);
                //setError("Network Error: No response received from server.");
            } else {
                // Other errors
                console.error("Error:", error.message);
                // setError(error.message);
            }
        } finally {
            ///setIsLoading(false);
        }
    }



    /*
    useEffect(() => {
        if (!VideMode) return;
        // alert(steps[0]);
        // wrap in async so we can await deletions
        (async () => {
            // 1. delete every vid in S3 using the URLs in videoArray
            // assume each entry in videoArray is the S3 URL string,
            // or has a .url property you can pass to startDeleteVid
            try {
                // if videoArray is like ['https://s3...', 'https://s3...']
                await Promise.all(
                    VideoArray.map((vidUrl: string) => startDeleteVid(vidUrl))
                );

                // if instead your structure is like [{ url: 'https://s3...' }, ...]
                // use this version:
                // await Promise.all(
                //     videoArray.map((v: { url: string }) => startDeleteVid(v.url))
                // );
            } catch (err) {
                console.error("Error deleting old videos:", err);
                // we keep going even if one delete fails
            }

            console.log("🔥 Storybook.tsx: useEffect triggered StartPlan (Grid Reset)! Dependencies changed:", { VideMode, Planx, steps, steps2 });

            // 2. reset state for new plan
            StartPlan(Planx, steps2);

            setVideoArray([]);
            setVideoArrayBlob([]);
        })();
    }, [VideMode, Planx]);
    */



    const startDeleteVid = async (vidUrl: string) => {
        try {

            //del-
            await axios.post(
                `${CLIK_URL}/del-video`,
                { url: vidUrl },          // <-- body
                { withCredentials: true }   // <-- config
            );

            // success: update UI, toast, etc.
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {

        }
    };



    const [showWorldModel2, setShowWorldModel2] = useState(false);


    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;

        // detect touch device (mobile / tablet)
        const isTouchDevice =
            "ontouchstart" in window || navigator.maxTouchPoints > 0;

        // ✅ On mobile: DO NOTHING with JS – let native scroll handle it
        if (isTouchDevice) return;

        // ✅ On PC: block back/forward on horizontal wheel, but keep scrolling
        const stopWheelNav = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();        // stop browser nav
                el.scrollLeft += e.deltaX; // scroll your div
            }
        };

        el.addEventListener("wheel", stopWheelNav, { passive: false });

        return () => {
            el.removeEventListener("wheel", stopWheelNav);
        };
    }, []);




    useEffect(() => {
        ///   setallowgetImage(false)
    }, [stepsx]);




    /* 1️⃣  NEW STATE  –– lives with your other useState hooks VideMode           */
    const [firstImageDims, setFirstImageDims] = useState<{
        width: number;
        height: number;
    } | null>(null);

    const firstImageRef = useRef<HTMLImageElement | null>(null);



    const [activeLoaderCallerChecker, setActiveLoaderCallerChecker] = useState(false);

    useEffect(() => {
        if (!creationProjectId) return;

        const projectKey = `project:${creationProjectId}`;
        const creationModeName = type === 0 ? "Shorts" : type === 1 ? "Cinema" : type === 3 ? "Games" : "Create";
        const storybookStage = activeLoaderCallerChecker
            ? "storybook_studio_selector"
            : isBShotModeActive
                ? "storybook_bshot_grid"
                : Continue
                    ? "storybook_image_start"
                    : VideMode
                        ? "storybook_video_grid"
                        : "storybook_image_grid";
        const storybookMode = isBShotModeActive ? "B-roll Images / Videos" : VideMode ? "A-roll Videos" : "A-roll Images";
        const sceneCount = Math.max(
            Array.isArray(steps) ? steps.length : 0,
            GeneratedText.length,
            TextVideo.length,
        );
        const storybookSceneIndexEntries = sceneDisplayMap.entries.filter(entry => entry.displaySceneNumber).map(entry => {
            const sceneIndexNumber = entry.index;
            const sceneNumber = sceneIndexNumber + 1;
            const cinemaStage = type === 1 ? (sceneIndexNumber % 2 === 0 ? "Stage A" : "Stage B") : undefined;
            const bShotImageCount = (bShotImages?.[sceneIndexNumber] || []).filter(Boolean).length;
            const bShotVideoCount = (bShotVideos?.[sceneIndexNumber] || []).filter(hasObservedVideo).length;
            return {
                scene: entry.displaySceneNumber,
                nativeSlot: entry.slotKey,
                parentNativeScene: sceneNumber,
                label: sceneDisplayLabel(entry),
                ...(cinemaStage ? { stage: cinemaStage } : {}),
                hasHdImage: entry.hasHdImage,
                hasPreviewImage: entry.hasPreviewImage,
                hasVideo: entry.hasVideo,
                previewsAreFinalOutput: false,
                ...(bShotImageCount || bShotVideoCount ? { bShotImageCount, bShotVideoCount } : {}),
                brief: String(entry.type === 'B' ? bShotPrompts?.[entry.index]?.[entry.bIndex ?? 0]
                    : GeneratedText?.[sceneIndexNumber] || steps?.[sceneIndexNumber] || "").slice(0, 260),
                ...(TextVideo?.[sceneIndexNumber] ? { videoBrief: String(TextVideo[sceneIndexNumber]).slice(0, 180) } : {}),
            };
        });
        const sceneCards = Array.from({ length: sceneCount }).flatMap((_, sceneIndexNumber) => {
            const sceneNumber = sceneIndexNumber + 1;
            const cinemaStage = type === 1 ? (sceneIndexNumber % 2 === 0 ? "Stage A" : "Stage B") : undefined;
            const narrationIndex = type === 1 ? Math.floor(sceneIndexNumber / 2) : sceneIndexNumber;
            const activeCharacters = (VideMode ? sceneActiveCharactersVideo : sceneActiveCharacters)?.[sceneIndexNumber] || [];
            const characterNames = activeCharacters
                .map((character: any) => String(character?.name || character?.characterName || "").trim())
                .filter(Boolean);
            const editorDetails = Object.values(editStoryMemoryByScene)
                .filter((details: any) => Number(details?.sceneNumber) === sceneNumber);
            const hasImageResult = isSceneImageFinal(sceneIndexNumber);
            const hasPreviewImage = !hasImageResult && Boolean(ImagesHdCloud?.[sceneIndexNumber] || generatedImagesFlux?.[sceneIndexNumber] || nanoImages?.[sceneIndexNumber]);
            const hasVideoResult = [VideoArrayCloud?.[sceneIndexNumber], VideoArray?.[sceneIndexNumber], VideoArrayBlob?.[sceneIndexNumber]].some(hasObservedVideo);

            return [
                {
                    cardKey: `${projectKey}:scene:${sceneNumber}:state`,
                    title: cinemaStage ? `Scene ${sceneNumber} (${cinemaStage}) current state` : `Scene ${sceneNumber} current state`,
                    cardType: "creation_scene_state",
                    sceneNumber: String(sceneNumber),
                    mode: creationModeName,
                    entities: characterNames,
                    text: renderCreationMemorySections([
                        ...(cinemaStage ? [["Cinema stage", `${cinemaStage} (Scene ${sceneNumber} of ${sceneCount}; ${sceneIndexNumber % 2 === 0 ? `Stage A main shot, owns shared Narration tab with Scene ${sceneNumber + 1}` : `Stage B second main shot, not a B-roll, shares Narration with Scene ${sceneNumber - 1}`})`]] as [string, unknown][] : []),
                        ["Raw scene data", steps?.[sceneIndexNumber]],
                        ["Image prompt", GeneratedText?.[sceneIndexNumber]],
                        ["Original/default image prompt", GeneratedTextx?.[sceneIndexNumber]],
                        ["Original full-scene image prompt", getImagePacingForTarget({ type: 'A', index: sceneIndexNumber })?.originalImagePrompt],
                        ["Image pacing handoff", getImagePacingForTarget({ type: 'A', index: sceneIndexNumber })?.handoff],
                        ["Video prompt", TextVideo?.[sceneIndexNumber]],
                        ["Narration", steps2?.[narrationIndex]],
                        ["Selected image model", modelz],
                        ["Selected video model", SelectedModel],
                        ["Video duration seconds", clipDurations?.[sceneIndexNumber] || time],
                        ["B-roll image prompts", bShotPrompts?.[sceneIndexNumber]],
                        ["B-roll video prompts", bShotTextVideo?.[sceneIndexNumber]],
                        ["Latest EditStory source details", editorDetails],
                    ]),
                },
                {
                    cardKey: `${projectKey}:scene:${sceneNumber}:references`,
                    title: `Scene ${sceneNumber} textual references`,
                    cardType: "creation_scene_references",
                    sceneNumber: String(sceneNumber),
                    mode: creationModeName,
                    entities: characterNames,
                    text: renderCreationMemorySections([
                        ["Active character names", characterNames],
                        ["Character and world reference descriptions", referenceImages],
                        ["Draw reference details", drawFrameData?.[sceneIndexNumber]],
                        ["B-roll draw reference details", bShotDrawFrameData?.[sceneIndexNumber]],
                        ["Visual guide details", autoDrawGuideData?.[sceneIndexNumber]],
                        ["B-roll visual guide details", bShotAutoDrawGuideData?.[sceneIndexNumber]],
                        ["EditStory action, motion, frame and scene references", editorDetails.map((details: any) => details?.references)],
                    ]),
                },
                {
                    cardKey: `${projectKey}:scene:${sceneNumber}:result_context`,
                    title: `Scene ${sceneNumber} generation result context`,
                    cardType: "creation_scene_result_context",
                    sceneNumber: String(sceneNumber),
                    mode: creationModeName,
                    text: renderCreationMemorySections([
                        ["Has generated image", hasImageResult],
                        ["Has preview image (full image still pending)", hasPreviewImage],
                        ["Has generated video", hasVideoResult],
                        ["B-roll image result count", (bShotImages?.[sceneIndexNumber] || []).filter(Boolean).length],
                        ["B-roll video result count", (bShotVideos?.[sceneIndexNumber] || []).filter(hasObservedVideo).length],
                        ["EditStory result facts", editorDetails.map((details: any) => details?.resultContext)],
                    ]),
                },
            ];
        });

        syncCreationMemoryCards([
            ...(sceneCount > 0 ? [{
                cardKey: `${projectKey}:scene_index`,
                title: "Current creation scene index",
                cardType: "creation_scene_index",
                mode: creationModeName,
                text: renderCreationMemorySections([
                    ["Scene count", sceneDisplayMap.count],
                    ["Scenes", storybookSceneIndexEntries],
                ]),
            }] : []),
            {
                cardKey: `${projectKey}:video_plan`,
                title: "Current video plan",
                cardType: "creation_video_plan",
                mode: creationModeName,
                text: renderCreationMemorySections([
                    ["Video plan", PlanVid],
                    ["Current Storybook mode", storybookMode],
                ]),
            },
            ...sceneCards.filter(card => !creationDraft || !card.cardKey.endsWith(':state')),
        ], { owner: `storybook:${creationProjectId}`, priority: 2 });

        const sceneSlots: CreationSceneSlotSnapshot[] = unifiedIndexMap.map((slot, i) => {
            const slotKey = slot.type === 'B' ? `B:${slot.index}:${slot.bIndex ?? 0}` : `A:${slot.index}`;
            const hasHdImage = !isUnifiedSlotEmpty(i);
            const rawPreviewCandidate = unifiedNanoImages?.[i] || unifiedGeneratedImagesFlux?.[i] || unifiedImagesHdCloud?.[i];
            const hasPreviewImage = !hasHdImage && Boolean(rawPreviewCandidate);
            const rawHdCandidate = hasHdImage ? (unifiedImagesHdCloud?.[i] || unifiedGeneratedImagesFlux?.[i]) : undefined;
            const rawVideoCandidate = [unifiedVideoArrayCloud?.[i], unifiedVideoArray?.[i], unifiedVideoArrayBlob?.[i]].find(hasObservedVideo);
            const briefSource = slot.type === 'B'
                ? bShotPrompts?.[slot.index]?.[slot.bIndex ?? 0]
                : (GeneratedText?.[slot.index] || steps?.[slot.index]);
            return {
                slotKey,
                sceneNumber: type === 1 ? Math.floor(slot.index / 2) + 1 : slot.index + 1,
                nativeSlotNumber: slot.index + 1,
                ...(type === 1 && slot.type === 'A' ? { cinemaStage: slot.index % 2 === 0 ? 'Stage A' : 'Stage B' } : {}),
                role: slot.type === 'A' ? 'a-shot' : 'b-shot',
                ...(slot.type === 'B' ? { bShotNumber: (slot.bIndex ?? 0) + 1 } : {}),
                displaySceneNumber: sceneDisplayMap.entries[i]?.displaySceneNumber,
                parentDisplaySceneNumber: sceneDisplayMap.entries[i]?.parentDisplaySceneNumber,
                displayRole: slot.type === 'A' ? 'A-roll' : 'B-roll',
                parentCinemaStage: sceneDisplayMap.entries[i]?.cinemaStage,
                hasPreviewImage,
                hasHdImage,
                hasVideo: Boolean(rawVideoCandidate),
                ...(hasPreviewImage ? { previewVersion: observedMediaVersion(rawPreviewCandidate) || undefined } : {}),
                ...(hasHdImage ? { hdVersion: observedMediaVersion(rawHdCandidate) || undefined } : {}),
                ...(rawVideoCandidate ? { videoVersion: observedMediaVersion(rawVideoCandidate) || undefined } : {}),
                ...(briefSource ? { brief: String(briefSource).slice(0, 140) } : {}),
            };
        });

        dispatch(patchUserSnapshot({
            creation: {
                isActive: true,
                projectId: creationProjectId,
                ...(!startEdit && (!creationDeckCovered || fetchingPrompts) ? { stage: storybookStage,
                    selectedModel: String(modelz || ''),
                    selectedModelDisplayName: getCreationImageModelName(String(modelz || ''),),
                    isGenerating: Boolean(fetchingPrompts || anyGenerating || loaders.some((value: number) => value > 0)),
                    status: fetchingPrompts ? imaginationStatus || 'preparing scene prompts'
                        : anyGenerating || loaders.some((value: number) => value > 0) ? 'generating scene media' : 'reviewing storyboard',
                } : {}),
                storybookStage,
                storybookMode,
                hdImageCount: finalSceneImageCount,
                previewImageCount: previewSceneImageCount,
                videoCount: primaryVideosReady + bShotVideosReady,
                mediaRevision: mediaObservation.projectId === creationProjectId ? mediaObservation.revision : 0,
                recentMediaChanges: mediaObservation.projectId === creationProjectId ? mediaObservation.changes : [],
                sceneSlots,
                displaySceneCount: sceneDisplayMap.count,
                sceneDisplayRevision: sceneDisplayMap.revision,
                storybookSceneIndex: activeEdit + 1,
                mode: creationModeName,
                editStoryIsOpen: startEdit,
                ...(startEdit ? {} : {
                    editStoryStage: 'editstory_closed',
                    editStoryTab: undefined,
                    editStoryMode: undefined,
                    editStoryIsBShot: false,
                    editStoryBShotModeActive: Boolean(isBShotModeActive),
                    editStoryBShotIndex: undefined,
                    editStoryCurrentSceneNumber: undefined,
                    editStoryCurrentImagePrompt: undefined,
                    editStoryCurrentVideoPrompt: undefined,
                    editStoryCurrentNarration: undefined,
                    editStoryNarrationText: undefined,
                    editStoryNarrationAiInstruction: undefined,
                    editStoryPendingAiInstruction: undefined,
                    editStoryMotionSourcePrompt: undefined,
                    editStoryMotionDraftPrompt: undefined,
                    editStoryMotionStatus: undefined,
                    editStoryMotionError: undefined,
                    editStoryMotionVideoReady: false,
                    editStoryVideoContextOpen: false,
                    editStoryActionModalOpen: false,
                    editStoryActionModalMode: undefined,
                    editStoryParentSceneIndex: undefined,
                }),
            },
        }));
    }, [
        Done, Continue, GeneratedText, GeneratedTextx, ImagesHdCloud, PlanVid, SelectedModel,
        TextVideo, VideoArray, VideoArrayCloud, VideoArrayBlob, primaryVideosReady, bShotVideosReady, mediaObservation, activeEdit, activeLoaderCallerChecker,
        autoDrawGuideData, bShotAutoDrawGuideData, bShotDrawFrameData, bShotImages,
        bShotPrompts, bShotTextVideo, bShotVideos, clipDurations, creationProjectId,
        dispatch, drawFrameData, editStoryMemoryByScene, generatedImagesFlux,
        isBShotModeActive, modelz, referenceImages, creationDraft,
        sceneActiveCharacters, sceneActiveCharactersVideo, steps, steps2,
        startEdit, syncCreationMemoryCards, time, type, VideMode, isGenerating,
        isSceneImageFinal, finalSceneImageCount, previewSceneImageCount, nanoImages, anyGenerating, loaders,
        unifiedIndexMap, unifiedNanoImages, unifiedGeneratedImagesFlux, unifiedImagesHdCloud,
        unifiedVideoArrayCloud, unifiedVideoArray, unifiedVideoArrayBlob, isUnifiedSlotEmpty,
        sceneDisplayMap, fetchingPrompts, imaginationStatus, creationDeckCovered,
    ]);

    useEffect(() => () => {
        if (creationProjectId) syncCreationMemoryCards([], { owner: `storybook:${creationProjectId}`, priority: 2 });
    }, [creationProjectId, syncCreationMemoryCards]);




    const [publishLoading, setPublishLoading] = useState(false);
    const [publishStatus, setPublishStatus] = useState("Processing...");

    // 2. Wrap your ContinueUpload (or wherever the logic starts) kontext
    const handleContinueUpload = async () => {
        // Start the visual loader state
        setPublishLoading(true);
        setPublishStatus("Initializing Upload...");

        try {
            // ... Your existing logic ...

            // Example of updating status during the process:
            // setPublishStatus("Encoding Video...");
            // await someAsyncWork();

            await ContinueUpload(); // Call your real function

        } catch (e) {
            console.error(e);
            setPublishLoading(false);
            setPublishStatus("Error Occurred");
        }
    };

    // 3. Render Component

    /* --- effect: whenever the first image URL changes, read its size ---------- */
    useEffect(() => {
        const imgEl = firstImageRef.current;
        if (!imgEl) return; // the element isn’t in the DOM yet

        // If the image has already loaded (cached), read dimensions right away.
        if (imgEl.complete) {
            setFirstImageDims({
                width: imgEl.naturalWidth,
                height: imgEl.naturalHeight,
            });
        }

        // Otherwise wait for the load event.
        const handleLoad = () => {
            setFirstImageDims({
                width: imgEl.naturalWidth,
                height: imgEl.naturalHeight,
            });
        };

        imgEl.addEventListener("load", handleLoad);

        return () => imgEl.removeEventListener("load", handleLoad);
    }, [generatedImagesFlux?.[0]]); // fires when the first URL changes



    const isInteractionSlotLocked = (idx: number) => {
        // Only lock in interaction mode
        if (type !== 3) return false;

        // MainSscene (index 0) is always allowed
        if (idx === 0) return false;

        const entry = videoArrayLastFrame[idx];
        return !entry || !entry.stepback1 || !entry.stepbackTwice;
    };


    // ── Image change tracker: remembers which result URLs were last saved ──
    const lastSavedImagesRef = useRef<string[] | null>(null);
    const pendingSavedImagesRef = useRef<string[] | null>(null);

    const saveToDastabase = useCallback(
        async (blobs: string[], HdFluxArray: string[], saveContext?: any,
            options: { advanceToVideo?: boolean; showSaveNotice?: boolean } = {}) => {
            const advanceToVideo = options.advanceToVideo !== false;
            const showSaveNotice = options.showSaveNotice !== false;
            const isCurrentProject = () => !saveContext || (imageLifecycleLiveRef.current.projectId === saveContext.projectId
                && imageLifecycleLiveRef.current.aTopology === saveContext.aTopology);
            if (!isCurrentProject()) throw new Error('The scene layout changed before image persistence. Saved uploads are retained.');
            const imagesStillMatch = () => !saveContext || saveContext.receipts.every((receipt: StoredImageMedia | null, index: number) => {
                const live = imageLifecycleLiveRef.current;
                const previewUrl = live.previews[index] || (saveContext.allowIncomplete ? live.nanoPreviews?.[index] : undefined);
                if (!receipt) return !live.sd[index] && !live.hd[index]
                    && !isHttpMediaUrl(previewUrl) && !(typeof previewUrl === 'string' && /^(?:blob:|data:image\/)/i.test(previewUrl));
                return imageMediaReceiptMatches(receipt, { sdBlob: live.sd[index], hdBlob: live.hd[index], previewUrl });
            });
            if (saveContext?.allowIncomplete && !imagesStillMatch()) throw new Error('An image changed while preparing the draft. Close again to save its current version.');

            const storedSourceAliases = imageStoredAliasesRef.current;
            const storedReferences = (GeneratedImage || []).map((source: string) => storedSourceAliases.get(source) || source);
            const planKontextPayload = buildPlanKontextPayload({
                imageModels: imageModelsForSources([...blobs, ...HdFluxArray, ...(bShotImages || []).flat(), ...(bShotNanoImages || []).flat()]),
                videoHistory: normalizeVideoHistory(videoHistoryRef.current),
                coverUrl: storedReferences.length > 0 ? storedReferences[0] : null,
                generatedImages: storedReferences,
                referenceImages: (referenceImages || []).map((reference: any) => ({ ...reference, imageUrl: storedSourceAliases.get(reference.imageUrl) || reference.imageUrl })),
                vipCharacters: Vipcharacters,
                bShotImages: (bShotImages || []).map((row: any[], scene: number) => (row || []).map((url: string, b: number) => safetySceneSourceUrl(url, safetyImageSetsByTarget[`B:${scene}:${b}`]))),
                bShotVideos,
                bShotNanoImages: (bShotNanoImages || []).map((row: any[], scene: number) => (row || []).map((url: string, b: number) => safetySceneSourceUrl(url, safetyImageSetsByTarget[`B:${scene}:${b}`]))),
                bShotPrompts,
                bShotTextVideo,
                referenceVideoUrls,
                bShotReferenceVideoUrls,
                autoDrawGuideData,
                bShotAutoDrawGuideData,
                textVideo: TextVideo,
                safetyMediaUrls: safetyPlanMediaEntries(safetyImageSetsByTarget, safetyVideoSetsByTarget),
                safetyAudioUrls: collectAllSafetyUrls(safetyImageSetsByTarget, safetyVideoSetsByTarget).audios,
            });
            const planCleanupUrls = getPlanKontextCleanupUrls(planKontextPayload);

            const dataToSave: any = {
                postId: Number(PostId) > 0 ? Number(PostId) : undefined,
                id: loggedUser ? loggedUser.id : null,
                topic: "",
                mode: type === 0 ? 0 : type === 3 ? 2 : 1,
                caption: prompt,

                kontext: serializePlanKontextPayload(planKontextPayload),
                intentBlueprintJson: intentBlueprintRef.current
                    ? JSON.stringify(intentBlueprintRef.current)
                    : null,
                prompt: prompt ? prompt : null,
                model: modelz === "Models" ? "fluxSchnell" : modelz,
                ratio: ratioKey,
            };

            // ✅ ALWAYS drive saving by steps.length (ALL modes)
            const count = steps?.length ?? 0;

            for (let i = 0; i < count; i++) {
                const n = i + 1;

                dataToSave[`image${n}`] = safetySceneSourceUrl(blobs?.[i], safetyImageSetsByTarget[`A:${i}`]) || null;
                dataToSave[`imageHd${n}`] = safetySceneSourceUrl(HdFluxArray?.[i], safetyImageSetsByTarget[`A:${i}`]) || null;

                dataToSave[`txt${n}`] = steps?.[i] ?? null;
                dataToSave[`GeneratedText${n}`] = GeneratedText?.[i] ?? null;
            }

            const savedDraft = creationDraft?.getState();
            if (savedDraft?.saved && savedDraft.imageProjectionDigest && imagesStillMatch()) {
                let sameImageProjection = false;
                try {
                    const previous = JSON.parse(savedDraft.imageProjectionDigest);
                    const imageContent = (projection: Record<string, unknown>) => Object.fromEntries(
                        Object.entries(projection).filter(([key]) => key !== 'postId'));
                    sameImageProjection = stableDraftJson(imageContent(previous)) === stableDraftJson(imageContent(dataToSave));
                } catch { /* Older malformed digests require the normal confirmed checkpoint. */ }
                if (sameImageProjection) {
                    setdbLoad(false);
                    setHideSave(false);
                    if (advanceToVideo) {
                        StartPlan(Planx, steps2);
                        setVideMode(true);
                        setnarrate(2);
                    }
                    return { postId: savedDraft.postId, sdUrls: blobs, hdUrls: HdFluxArray };
                }
            }

            setisLoading(true);
            setLoadData('Saving..');

            try {
                    let response: any;
                    if (creationDraft) {
                        // Keep the selected durable preview, not an expired provider preview.
                        setNanoImages?.(blobs);
                        captureCreationCache(creationDraft, 'prompt', { ImagesHdCloud: HdFluxArray, generatedImagesFluxx: blobs, nanoImages: blobs });
                        captureCreationCache(creationDraft, 'storybook', { GeneratedText, GeneratedTextx,
                            imageModels: { ...(creationDraft.section('storybook')?.imageModels || {}), ...planKontextPayload.imageModels },
                            intentBlueprintState: intentBlueprintRef.current, savedSceneImages: HdFluxArray,
                            imageReceipts: { ...(creationDraft.section('storybook')?.imageReceipts || {}),
                                ...Object.fromEntries(HdFluxArray.map((hdUrl, index) => [`A:${index}`, hdUrl && blobs[index] ? { hdUrl, sdUrl: blobs[index],
                                    quality: imageProvenanceRef.current.quality(hdUrl, blobs[index]) || 'final', sourcePrompt: GeneratedText[index] } : null])) } });
                        try {
                            const previousRevision = creationDraft.getState().revision;
                            const imagesChanged = creationDraft.getState().imageProjectionDigest !== stableDraftJson(dataToSave);
                            const checkpoint = creationDraft.checkpoint('images', dataToSave);
                            if (showSaveNotice) setDraftSaveNotice(imagesChanged && creationDraft.getState().isSaving ? 'saving' : null);
                            const saved = await checkpoint;
                            if (showSaveNotice) setDraftSaveNotice(imagesChanged && saved.revision > previousRevision ? 'saved' : null);
                            response = { data: saved };
                        }
                        catch (error: any) {
                            setDraftSaveNotice(null);
                            if (!(error?.status === 503 && error?.code === 'DRAFTS_NOT_INSTALLED')) throw error;
                            response = await axios.post(`${CLIK_URL}/PostStory`, { values: dataToSave }, { withCredentials: true });
                        }
                    } else response = await axios.post(`${CLIK_URL}/PostStory`, { values: dataToSave }, { withCredentials: true });
                    const newRowId = response.data.go || response.data.postId;
                    if (!isCurrentProject()) return { postId: newRowId, sdUrls: blobs, hdUrls: HdFluxArray };
                    const unchanged = imagesStillMatch();

                    setStopText(false);
                    setdbLoad(false);
                    setHideSave(false);
                    setisLoading(false);

                    setPostId(newRowId);
                    // Commit the image fingerprint: these URLs are now saved
                    lastSavedImagesRef.current = [...blobs];
                    pendingSavedImagesRef.current = [...blobs];
                    for (let index = 0; index < blobs.length; index++) {
                        const receipt = saveContext?.receipts?.[index];
                        if (!receipt) continue;
                        const live = imageLifecycleLiveRef.current;
                        const previewUrl = live.previews[index] || (saveContext?.allowIncomplete ? live.nanoPreviews?.[index] : undefined);
                        if (imageMediaReceiptMatches(receipt, { sdBlob: live.sd[index], hdBlob: live.hd[index], previewUrl })) imageMediaReceiptsRef.current[`A:${index}`] = persistedImageReceipt(receipt);
                    }
                    // Preserve the newly persisted original scene images as canonical references.
                    // Later video-mode first-frame substitutions only update the live Scene array.
                    setSavedSceneImages([...(HdFluxArray || [])]);

                    persistedPlanMediaRef.current.push(planKontextPayload);
                    ProtectSavedMediaFromDeleteLater(planKontextPayload);
                    // --- Protection: these URLs are now persisted in posts.kontext/post media. ---
                    const inUseImages = [
                        ...planCleanupUrls.images,
                        ...HdFluxArray
                    ];
                    RemoveFromDeleteLater(inUseImages);

                    const inUseVideos = [
                        ...planCleanupUrls.videos,
                        ...(VideoArrayCloud || []),
                        ...(VideoArray || []),
                    ];
                    RemoveVideoFromDeleteLater(inUseVideos);

                    localStorage.removeItem("S3fromprompt");

                    if (!unchanged) {
                        if (saveContext?.allowIncomplete) throw new Error('A newer image is ready. Close again to save its current version.');
                        globalErrorEmitter.emit('A newer image is ready. Continue again to save the current scene versions.', activeEdit);
                        return { postId: newRowId, sdUrls: blobs, hdUrls: HdFluxArray };
                    }
                    if (advanceToVideo) {
                        StartPlan(Planx, steps2);
                        setVideMode(true);
                        setnarrate(2);
                    }
                    return { postId: newRowId, sdUrls: blobs, hdUrls: HdFluxArray };
            } catch (error) {
                    setHideSave(false);
                    setdbLoad(false);
                    setisLoading(false);
                    setHideSave(false);
                    console.log(error);
                    throw error;
            }
        },
        [
            loggedUser,
            prompt,
            generatedImagesFlux,
            steps,
            GeneratedText,
            voice,
            type,
            PostId,
            ImagesHdCloud,
            referenceImages,
            Vipcharacters,
            bShotImages,
            bShotVideos,
            bShotNanoImages,
            bShotPrompts,
            bShotTextVideo,
            VideoArray,
            VideoArrayCloud,
            MemeMusic,
            music,
            GeneratedImage,
            ratioKey,
            modelz,
            CLIK_URL,
            safetyImageSetsByTarget, safetyVideoSetsByTarget, referenceVideoUrls, bShotReferenceVideoUrls, autoDrawGuideData, bShotAutoDrawGuideData, TextVideo,
        ]
    );




    const GenerateSignedUrlForSingleImage = async (blob: Blob) => {
        if (!blob) throw new Error("No image Blob to generate a signed URL.");

        // Example request body:
        const requestData = { values: { count: 1 } };

        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_imageStory`,
            requestData,
            {
                withCredentials: true,
            }
        );

        // Suppose the response structure is { holder: [ { urlBase, urlHD } ] }
        const holder = response.data.holder;
        if (!holder || holder.length !== 1) {
            throw new Error("Invalid signed URL response.");
        }

        const signedUrls = holder[0];
        if (!signedUrls.urlHD) {
            throw new Error("Missing signed URLs for images.");
        }

        return signedUrls;
    };

    const PutSingleImageInS3WithURL = async (blob: Blob, signedUrls: any) => {
        if (!signedUrls.urlHD) {
            throw new Error("Signed URL is not available for uploading.");
        }
        if (!blob) {
            throw new Error("Image blob is not available for uploading.");
        }

        // Upload HD Image
        const uploadHD = await axios.put(signedUrls.urlHD, blob, {
            headers: {
                "Content-Type": blob.type || "application/octet-stream",
            },
        });

        if (uploadHD.status !== 200 && uploadHD.status !== 204) {
            throw new Error(`HD image upload failed with status ${uploadHD.status}`);
        }

        console.log("HD image uploaded successfully.");
        // Extract the S3 URL (remove query params)
        const uploadedHdUrl = signedUrls.urlHD.split("?")[0];
        return uploadedHdUrl;
    };

    const storeImageBinary = useCallback((blob: Blob) => imageBinaryUploadsRef.current.run(blob, async () => {
        const signed = await GenerateSignedUrlForSingleImage(blob);
        const url = await PutSingleImageInS3WithURL(blob, signed);
        Saveprompthelperfordellater(url);
        return url;
    }), []);
    const prepareImageSaveContext = useCallback(async ({ allowIncomplete = false, onStorageRequired }:
        { allowIncomplete?: boolean; onStorageRequired?: () => void } = {}) => {
        const live = imageLifecycleLiveRef.current;
        const context = { projectId: live.projectId, aTopology: live.aTopology, allowIncomplete, receipts: [] as (StoredImageMedia | null)[] };
        for (let index = 0; index < live.steps.length; index++) {
            const nativePreview = allowIncomplete ? live.nanoPreviews?.[index] : undefined;
            const previewCandidate = live.previews[index] || nativePreview;
            const previewUrl = !allowIncomplete || isHttpMediaUrl(previewCandidate)
                || (typeof previewCandidate === 'string' && /^(?:blob:|data:image\/)/i.test(previewCandidate)) ? previewCandidate : undefined;
            const sources = { sdBlob: live.sd[index], hdBlob: live.hd[index], previewUrl };
            if (allowIncomplete && !sources.sdBlob && !sources.hdBlob && !sources.previewUrl) {
                context.receipts.push(null);
                continue;
            }
            const quality = imageProvenanceRef.current.quality(sources.previewUrl, live.cloud[index])
                || (nativePreview && sources.previewUrl === nativePreview ? 'preview' : undefined);
            const known = imageMediaReceiptsRef.current[`A:${index}`];
            if (imageMediaReceiptMatches(known, sources)) {
                context.receipts.push({ ...known! });
                continue;
            }
            let receipt: StoredImageMedia;
            if (!sources.sdBlob && !sources.hdBlob && isHttpMediaUrl(sources.previewUrl) && isHttpMediaUrl(live.cloud[index])) {
                // URL-only history/drawing selections already have stored variants.
                receipt = { ...sources, sdUrl: sources.previewUrl, hdUrl: live.cloud[index], ...(quality ? { quality } : {}) };
            } else {
                onStorageRequired?.();
                let sdBlob = sources.sdBlob, hdBlob = sources.hdBlob;
                const downloadablePreview = isHttpMediaUrl(sources.previewUrl)
                    || (allowIncomplete && typeof sources.previewUrl === 'string' && /^(?:blob:|data:image\/)/i.test(sources.previewUrl));
                if (!sdBlob && !hdBlob && downloadablePreview) {
                    // Recover an existing paid Nano result whose download/upload
                    // failed, without making another image-provider request.
                    let downloaded = imageDownloadedInputsRef.current.get(sources.previewUrl);
                    if (!downloaded) {
                        const response = await fetch(sources.previewUrl);
                        if (!response.ok) throw new Error(`Scene ${index + 1} image download failed (${response.status}).`);
                        downloaded = await response.blob();
                        imageDownloadedInputsRef.current.set(sources.previewUrl, downloaded);
                    }
                    sdBlob = downloaded; hdBlob = downloaded;
                }
                if (!(sdBlob instanceof Blob) || !(hdBlob instanceof Blob)) throw new Error(`Scene ${index + 1} has no recoverable SD/HD image pair.`);
                const sdUrl = await storeImageBinary(sdBlob);
                const hdUrl = await storeImageBinary(hdBlob);
                receipt = { ...sources, sdBlob, hdBlob, sdUrl, hdUrl, ...(quality ? { quality } : {}) };
            }
            const current = imageLifecycleLiveRef.current;
            const currentPreview = current.previews[index] || (allowIncomplete ? current.nanoPreviews?.[index] : undefined);
            if (current.projectId === context.projectId && current.aTopology === context.aTopology
                && imageMediaReceiptMatches(receipt, { sdBlob: current.sd[index], hdBlob: current.hd[index], previewUrl: currentPreview })) {
                onImageMediaStored({ type: 'A', index }, receipt);
            }
            const retainedPreview = !current.previews[index] && allowIncomplete ? sources.previewUrl : undefined;
            receipt = { ...storedImageReceipt(receipt), ...(retainedPreview ? { previewUrl: retainedPreview } : {}) };
            context.receipts.push(receipt);
        }
        return context;
    }, [storeImageBinary, onImageMediaStored]);

    useEffect(() => {
        if (!onRegisterDraftImageSave || !creationDraft || VideMode || !steps?.length) return;
        // The close review uses the exact image persistence path, without the
        // Continue-only transition or its automatic video-plan work.
        const save = async () => {
            setDraftSaveNotice(null);
            const context = await prepareImageSaveContext({ allowIncomplete: true });
            const result = await saveToDastabase(context.receipts.map(receipt => receipt?.sdUrl || ''),
                context.receipts.map(receipt => receipt?.hdUrl || ''), context,
                { advanceToVideo: false, showSaveNotice: false });
            await creationDraft.flush();
            if (!result || !creationDraft.getState().saved) throw new Error('The current images have not finished saving.');
        };
        onRegisterDraftImageSave(save);
        return () => onRegisterDraftImageSave(null);
    }, [onRegisterDraftImageSave, creationDraft, VideMode, steps?.length, prepareImageSaveContext, saveToDastabase]);

    const uploadAllImagesToS3 = useCallback(async () => {
        setDraftSaveNotice(null);
        if (PostId > 0 && visitedVideoGridRef.current) setManualOnlyVideoPrompts(true);
        //callCreatemp4

        // ── Change tracker: if this post was already saved and no image result URL
        // changed since, skip delete/re-upload/re-save entirely and just navigate ──
        if (!creationDraft && PostId > 0 && lastSavedImagesRef.current) {
            const prevSaved = lastSavedImagesRef.current;
            const curImgs = generatedImagesFlux || [];
            const unchanged = prevSaved.length === curImgs.length && prevSaved.every((u: any, ci: number) => u === curImgs[ci]);
            if (unchanged) {
                console.log('[Images->Videos] images unchanged - navigating without re-upload');
                // Defer one tick: the caller runs setHideSave(true) right after this call,
                // so reset it afterwards or the bottom buttons stay hidden forever
                await new Promise((r) => setTimeout(r, 0));
                setHideSave(false);
                setVideMode(true);
                setnarrate(2);
                return;
            }
        }
        // Remember what is about to be saved; committed on save success
        pendingSavedImagesRef.current = [...(generatedImagesFlux || [])];


        // Image navigation updates this post in place. Retained references and
        // videos belong to it; navigation never performs explicit post deletion.


        // setdbLoad(true);startPlan delete

        try {
            const context = await prepareImageSaveContext({ onStorageRequired: () => {
                setisLoading(true);
                setLoadData('Uploading Images..');
                setdbLoad(true);
            } });
            await uploadAllImagesToS3Default(context.receipts.map(receipt => receipt?.hdUrl || ''), context);
        } catch (err) {
            setisLoading(false);
            setHideSave(false);
            // Close();
            console.error("Error uploading all images to S3  HDss:", err);
        }
    }, [
        generatedImagesFlux,
        saveToDastabase,
        steps,
        generatedImagesFluxBlobHd,
        GeneratedText,
        voice,
        type,
        PostId,
        ImagesHdCloud,
        MemeMusic,
        music,
        ratioKey,
        prepareImageSaveContext
    ]);

    // near the top of your component


    const startDelete = async (imageUrl: String) => {

        if (imageUrl) {
            try {
                ///  setLoadingDatabase(true);
                //del-
                await axios.post(
                    `${CLIK_URL}/del-image`,
                    { url: imageUrl },          // <-- body
                    { withCredentials: true }   // <-- config
                );
                console.log("Deleted from s3:", imageUrl);
                // success: update UI, toast, etc.
            } catch (err) {
                console.error("Delete failed:", err);
            } finally {
                /// setLoadingDatabase(false);
            }
        }
    };

    const InteractionsPromptS3Upload = useCallback(async (blob: any) => {
        try {
            // 1) Get a signed URL for this blob
            const signedUrl = await GenerateSignedUrlForSingleImage(blob);

            // 2) Upload the blob to S3 using the signed URL (returns final public/HD URL)
            const uploadedHdUrl = await PutSingleImageInS3WithURL(blob, signedUrl);

            // ---- NEW: detect existing URL in state or localStorage ----
            const storedFromState = s3ResultUrl ?? null; // s3ResultUrl is your React state (string | null)
            let storedFromLocal: string | null = null;
            try {
                const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
                storedFromLocal = raw ? raw : null;
            } catch (e) {
                console.warn("Couldn't read localStorage", e);
            }

            // prefer state, fallback to localStorage
            const existingUrl = storedFromState ?? storedFromLocal;

            // only call startDelete if there's an existing url and it's different from new upload
            if (existingUrl && existingUrl !== uploadedHdUrl) {
                try {
                    await startDelete(existingUrl); // YOUR delete function, called with the url
                } catch (delErr) {
                    console.warn("startDelete failed, continuing:", delErr);
                }
            }
            //  alert(uploadedHdUrl);
            // 3) Save single URL to component state and localStorage (replace previous)
            setS3ResultUrl(uploadedHdUrl);
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, uploadedHdUrl);
            } catch (e) {
                console.warn("Could not write S3 url to localStorage", e);
            }

            return uploadedHdUrl;
        } catch (err) {
            console.error("Error uploading interaction prompt image", err);
            throw err;
        } finally {
            // (optional cleanup)
        }
    }, [s3ResultUrl, startDelete]); // include deps you use



    const uploadAllImagesToS3Default = useCallback(
        async (HdFluxArray: string[], preparedContext?: any) => {
            try {
                const context = preparedContext || await prepareImageSaveContext();
                const s3Urls = context.receipts.map((receipt: StoredImageMedia | null) => receipt?.sdUrl || '');
                const current = imageLifecycleLiveRef.current;
                if (current.projectId !== context.projectId || current.aTopology !== context.aTopology
                    || context.receipts.some((receipt: StoredImageMedia, index: number) => !imageMediaReceiptMatches(receipt, { sdBlob: current.sd[index], hdBlob: current.hd[index], previewUrl: current.previews[index] }))) {
                    throw new Error('An image changed during storage. Its completed uploads are retained; Continue saves the current images.');
                }
                return await saveToDastabase(s3Urls, HdFluxArray, context);
            } catch (err) {
                setHideSave(false);
                // Close();
                console.error("Error uploading all images to S3:", err);
                throw err;
            }
        },
        [
            generatedImagesFlux,
            saveToDastabase,
            steps,
            generatedImagesFluxBlob,
            GeneratedText,
            voice,
            type,
            PostId,
            ImagesHdCloud,
            MemeMusic,
            music,
            ratioKey,
            prepareImageSaveContext
        ]
    );

    const continueSingleImage = useCallback(async () => {
        setDraftSaveNotice(null);
        try {
            const context = await prepareImageSaveContext({ onStorageRequired: () => {
                setisLoading(true);
                setLoadData('Uploading Images..');
            } });
            const receipt = context.receipts[0];
            if (!receipt) throw new Error('The single image has not finished generating.');
            let current = imageLifecycleLiveRef.current;
            if (current.projectId !== context.projectId || current.aTopology !== context.aTopology
                || !imageMediaReceiptMatches(receipt, { sdBlob: current.sd[0], hdBlob: current.hd[0], previewUrl: current.previews[0] })) throw new Error('The image changed while saving. Continue again to save its current version.');
            if (creationDraft) {
                await saveToDastabase([receipt.sdUrl], [receipt.hdUrl], context);
                return;
            }
            setisLoading(true);
            setLoadData('Saving..');
            const imageResponse = await axios.post(`${CLIK_URL}/generatedImagePost`, { values: {
                id: loggedUser?.id, caption: prompt, imagehd: receipt.hdUrl,
                Kkontext: GeneratedImage?.[0] || null, prompt, model: modelz, ratio: ratioKey,
            } }, { withCredentials: true });
            const saved = { postId: (imageResponse.data as any).go };
            setPostId(saved.postId);
            if (!(Number(saved?.postId) > 0)) throw new Error('The image has not finished saving.');
            current = imageLifecycleLiveRef.current;
            if (current.projectId !== context.projectId || current.aTopology !== context.aTopology) return;
            if (!imageMediaReceiptMatches(receipt, { sdBlob: current.sd[0], hdBlob: current.hd[0], previewUrl: current.previews[0] })) {
                globalErrorEmitter.emit('A newer image is ready. Continue again to save its current version.', 0);
                return;
            }
            imageMediaReceiptsRef.current['A:0'] = persistedImageReceipt(receipt);
            setSavedSceneImages([receipt.hdUrl]);
            lastSavedImagesRef.current = [receipt.sdUrl];
            setVideMode(true);
            setnarrate(2);
        } catch (error: any) {
            console.error('Single image save failed; completed result retained:', error);
            globalErrorEmitter.emit(error?.message || 'Could not save the image. Try Continue again.', 0);
        } finally {
            setisLoading(false);
            setHideSave(false);
        }
    }, [creationDraft, saveToDastabase, loggedUser, prompt, GeneratedImage, modelz, ratioKey, CLIK_URL, prepareImageSaveContext, setVideMode]);

    useEffect(() => {
        // Storyboard previews are sufficient to continue into Video, including
        // Direct Video with First Frame off. Full image rendering is optional;
        // Auto tracks unfinished full images independently via isSceneImageFinal.
        const allImagesReady = steps.length > 0 && steps.every((_: string, index: number) => generatedImagesFluxBlob[index] instanceof Blob
            || isCompletedCreationMedia(generatedImagesFlux[index]) || isHttpMediaUrl(ImagesHdCloud[index]));
        setDone(allImagesReady);
    }, [generatedImagesFluxBlob, steps, generatedImagesFlux, ImagesHdCloud]);

    // Add a new piece of state to track poll status
    const [pollStatus, setPollStatus] = useState<string>("");



    const [open, setOpen] = React.useState(false);

    const [open2, setopen2] = React.useState(false);
    const [hideExpandedSceneText, setHideExpandedSceneText] = useState(false);
    const [promptPreviewIndex, setPromptPreviewIndex] = useState<number | null>(null);

    /**
     * Interaction node map. Only Games/Interactions (type 3) has a branch
     * structure to draw, so Shorts and Cinema keep the scene preview they
     * already have and nothing about their flow changes.
     */
    const isInteractionMode = isHotspotInteraction;
    const [showNodeMap, setShowNodeMap] = useState(false);

    const nodeMapPlan = useMemo(
        () =>
            compilePlanGraph(
                steps || [],
                (steps || []).map((_: any, i: number) =>
                    // Video is the final truth; the image only stands in until
                    // one exists, and the creator may drop it entirely.
                    pickThumb(
                        VideoArrayCloud?.[i],
                        ImagesHdCloud?.[i] || generatedImagesFlux?.[i] || nanoImages?.[i]
                    )
                )
            ),
        [steps, VideoArrayCloud, ImagesHdCloud, generatedImagesFlux, nanoImages]
    );

    // The interaction tool receives a compact, typed slot table beside the
    // A-shot-only plan. This prevents interleaved B-shots from being mistaken
    // for plan nodes and gives them an explicit unlinked-tray destination.
    const nodeMapMediaSlots = useMemo(() => {
        const slots: MediaSlot[] = [];
        const valid = (value: unknown): value is string =>
            typeof value === "string" &&
            value.trim().length > 0 &&
            value !== "EMPTY" &&
            value !== "EMPTY_BSHOT";

        (steps || []).forEach((_: any, sceneIndex: number) => {
            const aShot = VideoArrayCloud?.[sceneIndex];
            if (valid(aShot)) slots.push({ url: aShot, type: "A", sceneIndex });

            (bShotVideos?.[sceneIndex] || []).forEach((bShot: unknown, bIndex: number) => {
                if (valid(bShot)) {
                    slots.push({ url: bShot, type: "B", sceneIndex, bIndex });
                }
            });
        });
        return slots;
    }, [steps, VideoArrayCloud, bShotVideos]);

    // No slots are passed to the map here on purpose. The "not linked yet" tray
    // answers "which videos does the tree not use", and Storybook has no tree —
    // so every scene qualified and the tray simply repeated the nodes drawn
    // above it. Each scene appears exactly once, as its plan node, with one
    // preview resolved by pickThumb: the video when it exists, the image until
    // then.

    /**
     * Hands the plan's SHAPE to the interaction tool, so its map can show the
     * AI's original structure until the creator wires their own hotspots.
     *
     * Deliberately its own effect and deliberately tiny — node ids, parents and
     * branch labels only, a few hundred bytes. It must never live inside the
     * video-save function: that code clears and rewrites every localstoragevid
     * slot, and nothing that can consume quota belongs beside it.
     */
    useEffect(() => {
        if (!isInteractionMode) return;
        const topology = compilePlanTopology(steps || []);
        if (topology.length === 0) return;
        try {
            localStorage.setItem(
                STORED_PLAN_KEY,
                JSON.stringify({ v: 1, t: topology, s: nodeMapMediaSlots })
            );
        } catch {
            // Never let this affect anything else. Without it the tool's map
            // simply shows the live tree, which is the view that matters.
        }
    }, [isInteractionMode, steps, nodeMapMediaSlots]);
    const [pendingSceneDeleteIndex, setPendingSceneDeleteIndex] = useState<number | null>(null);
    const sceneElementsRef = useRef<HTMLDivElement[] | null[]>([]);

    // Auto-scroll to selected scene when modal opens
    React.useEffect(() => {
        if (promptPreviewIndex === null) return;
        let attempts = 0;
        const scrollInterval = setInterval(() => {
            const target = sceneElementsRef.current[promptPreviewIndex];
            if (target) {
                target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
                attempts++;
                if (attempts > 5) clearInterval(scrollInterval);
            } else {
                clearInterval(scrollInterval);
            }
        }, 50);
        return () => clearInterval(scrollInterval);
    }, [promptPreviewIndex]);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);
    const lastSwipeTimeRef = useRef<number>(0);

    const ExpandSteps = React.useCallback((index: any) => {
        setactiveEdit(index);
        setOpen(true)


    }, []);
    // ...your existing onClick calls ExpandSteps();

    // Example updated handleSubmitFluxImage


    ///convertToHDWebpOrJpegByDevice

    const [anyVideoReady, setAnyVideoReady] = useState(false);



    useEffect(() => {
        const ready =
            // walk every index in `steps`, and succeed if *any* VideoArray[i] is a real, non-blank string
            steps.some((_: any, i: any) => {
                const v = VideoArray[i];
                return (
                    v != null &&                // not null or undefined
                    typeof v === "string" &&
                    v.trim().length > 0         // not empty or just whitespace
                );
            });

        setAnyVideoReady(ready);
    }, [VideoArray, steps]);


    const [allVideosReady, setAllVideosReady] = useState(false);

    // 2) effect to recompute whenever VideoArray or steps change
    useEffect(() => {
        const ready =
            VideoArray.length === steps.length &&                // same length
            steps.every((_: any, i: any) => {                              // for each position…
                const v = VideoArray[i];
                return (
                    v != null &&                                    // not null or undefined
                    typeof v === 'string' &&
                    v.trim().length > 0                             // non-blank
                );
            });

        setAllVideosReady(ready);
    }, [VideoArray, steps]);


    // ContinueGen moved below handleSubmitFluxImageNew to prevent ReferenceError

    const storyRunIdRef = useRef<string>(
        (typeof crypto !== "undefined" && "randomUUID" in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    );


    const promptFetchCacheRef = useRef<Record<number, Promise<string | null> | undefined>>({});

    useEffect(() => {
        promptFetchCacheRef.current = {};
    }, [steps]);

    async function internalFetchAndGenerateImage(
        stepText: string,
        stepIndex: number,
        imageBlobx: any,
        type: number,
        signal?: AbortSignal
    ): Promise<string | null> {
        const restoredPrompt = String((creationDraft as DraftController | undefined)?.section<Record<string, any>>('storybook')?.GeneratedText?.[stepIndex] || '').trim();
        if (restoredPrompt && restoredPrompt === String(GeneratedText[stepIndex] || '').trim()) return restoredPrompt;
        if (_stopped || signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        // Waits on THIS scene's intent only. Every scene call is in flight
        // together behind one shared global pass, so this never queues behind
        // another scene. If this scene's intent fails it resolves null and the
        // prompt is generated without it; no other scene is affected.
        // Cinema writes Stage A and Stage B from one backend call, so it needs
        // both snapshots — requested together, not one after the other.
        await (type === 1
            ? Promise.all([
                ensureSceneIntent(stepIndex),
                ensureSceneIntent(stepIndex + 1),
            ])
            : ensureSceneIntent(stepIndex));
        const compiledIntent = intentBlueprintRef.current;

        const imagePacerRequestContext = {
            promptOperationId: `${storyRunIdRef.current}:${type === 1 ? 'pair' : 'scene'}:${type === 1 ? Math.floor(stepIndex / 2) : stepIndex}`,
            globalIntent: compiledIntent ? {
                title: compiledIntent.global.title, overview: compiledIntent.global.overview,
                premise: compiledIntent.global.premise, userGoal: compiledIntent.global.userGoal,
                visualLanguage: compiledIntent.global.visualLanguage,
            } : null,
            outputContext: { creationType: type, ratio: ratioKey, stage: 'initial automatic image prompt preparation',
                requestedResult: Planx?.prompt_summary || '', interactionExperienceMode },
            referenceContext: (referenceImages || []).map((reference: any) => ({
                name: reference.name, type: reference.type, description: reference.description,
            })),
        };

        // --- CRITICAL FIX: DO NOT REGENERATE IF TEXT ALREADY EXISTS ---
        // If the user already has a generated image prompt (or one injected with @Characters),
        // we must immediately return it and prevent the AI from overwriting it.
        const existingText = GeneratedText[stepIndex]?.trim();
        if (existingText) {
            bindInitialImagePromptToIntent(stepIndex, existingText);
            // Optional: Still start loader visually, but resolve immediately
            // startLoader(stepIndex);
            return existingText;
        }

        const openAiImagePromptAttempts = 4;
        const selectedImagePromptTier = languageModelRef.current;
        const selectedReplicateTier = selectedImagePromptTier === "deepseek" || selectedImagePromptTier === "kimi";
        const maxAttempts = selectedReplicateTier
            ? openAiImagePromptAttempts
            : openAiImagePromptAttempts + 1;
        const retryDelayMs = 6000;

        const tierForAttempt = (attempt: number) =>
            !selectedReplicateTier && attempt > openAiImagePromptAttempts
                ? "deepseek"
                : selectedImagePromptTier;

        const switchImagePromptFallbackToDeepSeek = () => {
            const alreadyOnReplicate = (model: string) => model === "deepseek" || model === "kimi";
            let switchedToDeepSeek = false;

            if (!alreadyOnReplicate(languageModelRef.current)) {
                // Keep visible selector state on the user's chosen model; only this retry uses fallback.
                void 0;
                switchedToDeepSeek = true;
            }
            if (!alreadyOnReplicate(conversationModelRef.current)) {
                void 0;
                void 0;
                switchedToDeepSeek = true;
            }
            if (switchedToDeepSeek) {
                dispatch(showAiProviderNotice("OpenAI unavailable — switched to DeepSeek"));
            }
        };

        const promptAttemptTargetKey = `A:${stepIndex}`;
        const promptAttemptId = `sb-prompt:${creationProjectId}:${promptAttemptTargetKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        dispatch(recordCreationAttemptStart({
            attemptId: promptAttemptId,
            projectId: creationProjectId,
            mediaKind: 'image',
            targetKey: promptAttemptTargetKey,
        }));
        startLoader(stepIndex);

        try {
            let attempt = 0;

            // ---------- STORY MODE ----------
            if (type === 1) {
                const pairIndex = Math.floor(stepIndex / 2);
                // The handoff key must be identical for the writer (even step)
                // and reader (odd step). It previously included a mode flag
                // derived from GeneratedImage.length, which flips from 0 to >0
                // WHILE scenes generate — so the writer stored under ...N:x and
                // the reader polled ...K:x, never found it, timed out, and fell
                // back to copying the previous scene's prompt into this scene.
                const stage2Key = `clikb:story:stage2:${storyRunIdRef.current}:${pairIndex}`;

                // odd index => stage 2 reads localStorage then clears
                if (stepIndex % 2 === 1) {
                    const waitForStage2 = async () => {
                        const maxPolls = 120; // ~12s
                        const pollDelayMs = 100;

                        for (let i = 0; i < maxPolls; i++) {
                            if (_stopped || signal?.aborted) {
                                throw new DOMException("Aborted", "AbortError");
                            }

                            const v = (localStorage.getItem(stage2Key) ?? "").trim();
                            if (v) return v;

                            await zzz(pollDelayMs, signal);
                        }

                        // Last resort: this scene's own slot or empty. NEVER copy
                        // the previous scene's prompt into this slot — a silently
                        // wrong prompt permanently poisons every downstream
                        // generation. An empty prompt is a visible, retryable failure.
                        return (GeneratedText?.[stepIndex] ?? "").trim();
                    };

                    const stage2 = await waitForStage2();

                    if (stage2) {
                        bindInitialImagePromptToIntent(stepIndex, stage2);
                        // optional: ensure UI has it
                        setGeneratedText((prev) => {
                            const next = [...prev];
                            next[stepIndex] = cleanQuotedAtMentions(stage2);
                            return next;
                        });

                        setGeneratedTextx((prev) => {
                            const next = [...prev];
                            next[stepIndex] = cleanQuotedAtMentions(stage2);
                            return next;
                        });
                    }

                    // wipe after use
                    try { localStorage.removeItem(stage2Key); } catch { }

                    return stage2 || null;
                }

                // even index => call backend ONCE, save stage1+stage2, cache stage2
                while (attempt < maxAttempts) {
                    attempt++;

                    try {
                        setPollStatus("Polling Replicate...");

                        const stageAIntent = compiledIntent
                            ? resolveSceneIntent(
                                { type: "A", index: stepIndex },
                                intentSceneBindingsRef.current,
                                compiledIntent
                            )
                            : null;
                        const stageBIntent = compiledIntent
                            ? resolveSceneIntent(
                                { type: "A", index: stepIndex + 1 },
                                intentSceneBindingsRef.current,
                                compiledIntent
                            )
                            : null;
                        const requestData = {
                            ...imagePacerRequestContext,
                            text: stepText,
                            prompt,
                            Planx,
                            stageAIntent,
                            stageBIntent,
                            stageBScene: String(steps?.[stepIndex + 1] || stepText),
                            // One call writes Stage A and Stage B together, so
                            // the pair is charged once, never twice.
                            llmTier: tierForAttempt(attempt),
                            // Storybook owns four retries for this automatic,
                            // buttonless stage. Do not switch providers until
                            // every attempt on the selected OpenAI tier fails.
                            deferOpenAiProviderSwitch: !selectedReplicateTier
                                && attempt <= openAiImagePromptAttempts,
                        };
                        console.log("[IntentBlueprint][consume][initial-cinema-image-prompts]", {
                            stageAId: stageAIntent?.sceneId ?? null,
                            stageBId: stageBIntent?.sceneId ?? null,
                            stageAIntent,
                            stageBIntent,
                        });

                        // ✅ stage endpoints
                        let xx = "ImageDesignStoryStage";
                        // Kontext prompt-writing disabled — always describe scenes
                        // from scratch instead of as edits to a source image.
                        // if (GeneratedImage.length > 0) xx = "ImageDesignStoryStageKontext";

                        const resp = await fetch(`${CLIK_URL}/${xx}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestData),
                            credentials: "include",
                            signal,
                        });

                        if (!resp.ok) await throwLlmFetchError(resp, dispatch);

                        applyPixelBillingHeaders(dispatch, resp);
                        const data = await resp.json();
                        applyLlmBilling(dispatch, data);
                        let stage1: string | null = (data?.visualPromptStage1 ?? null);
                        let stage2: string | null = (data?.visualPromptStage2 ?? null);

                        if (stage1) {
                            bindInitialImagePromptToIntent(stepIndex, stage1, readImagePromptPacing(data?.imagePacingStage1, stage1) || undefined);
                            await zzz(100, signal);
                            if (_stopped || signal?.aborted) {
                                throw new DOMException("Aborted", "AbortError");
                            }

                            // save stage1 at even
                            setGeneratedText((prev) => {
                                const next = [...prev];
                                next[stepIndex] = stage1;
                                return next;
                            });

                            setGeneratedTextx((prev) => {
                                const next = [...prev];
                                next[stepIndex] = stage1;
                                return next;
                            });
                        }

                        if (stage2) {
                            bindInitialImagePromptToIntent(stepIndex + 1, stage2, readImagePromptPacing(data?.imagePacingStage2, stage2) || undefined);
                            // save stage2 at even+1
                            setGeneratedText((prev) => {
                                const next = [...prev];
                                next[stepIndex + 1] = stage2;
                                return next;
                            });

                            setGeneratedTextx((prev) => {
                                const next = [...prev];
                                next[stepIndex + 1] = stage2;
                                return next;
                            });

                            // cache stage2 so odd index can always “read & clear”
                            try { localStorage.setItem(stage2Key, stage2); } catch { }
                        }

                        return stage1 ?? null;

                    } catch (err: any) {
                        if (err?.name === "AbortError") throw err;
                        // Not enough pixels / signed out: retrying cannot fix it and
                        // would stall the run for maxAttempts * retryDelayMs.
                        if (err?.llmBillingError) throw err;

                        console.error(`fetchAndGenerateImage (story even) attempt ${attempt} failed`, err);

                        if (!selectedReplicateTier && attempt === openAiImagePromptAttempts) {
                            switchImagePromptFallbackToDeepSeek();
                        }

                        if (attempt < maxAttempts) {
                            await zzz(retryDelayMs, signal);
                            if (_stopped || signal?.aborted) {
                                throw new DOMException("Aborted", "AbortError");
                            }
                        } else {
                            throw err;
                        }
                    }
                }

                return null;
            }

            // ---------- NORMAL MODE (unchanged) Sending payload to model route ----------
            while (attempt < maxAttempts) {
                attempt++;

                try {
                    setPollStatus("Polling Replicate...");

                    const sceneIntent = compiledIntent
                        ? resolveSceneIntent(
                            { type: "A", index: stepIndex },
                            intentSceneBindingsRef.current,
                            compiledIntent
                        )
                        : null;
                    const requestData = {
                        ...imagePacerRequestContext,
                        text: stepText,
                        prompt,
                        Planx,
                        sceneIntent,
                        llmTier: tierForAttempt(attempt),
                        deferOpenAiProviderSwitch: !selectedReplicateTier
                            && attempt <= openAiImagePromptAttempts,
                    };
                    console.log("[IntentBlueprint][consume][initial-image-prompt]", {
                        sceneIndex: stepIndex,
                        sceneId: sceneIntent?.sceneId ?? null,
                        sceneIntent,
                    });
                    let xx = "ImageDesignStory";
                    ///  if (GeneratedImage.length > 0) xx = "ImageDesignStoryKontext";

                    const resp = await fetch(`${CLIK_URL}/${xx}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestData),
                        credentials: "include",
                        signal,
                    });

                    if (!resp.ok) await throwLlmFetchError(resp, dispatch);

                    applyPixelBillingHeaders(dispatch, resp);
                    const data = await resp.json();
                    applyLlmBilling(dispatch, data);
                    let visualPromptText = data?.visualPrompt ?? null;

                    if (visualPromptText) {
                        bindInitialImagePromptToIntent(stepIndex, visualPromptText, readImagePromptPacing(data?.imagePacing, visualPromptText) || undefined);
                        await zzz(100, signal);
                        if (_stopped || signal?.aborted) {
                            throw new DOMException("Aborted", "AbortError");
                        }

                        setGeneratedText((prev) => {
                            const next = [...prev];
                            next[stepIndex] = visualPromptText;
                            return next;
                        });

                        setGeneratedTextx((prev) => {
                            const next = [...prev];
                            next[stepIndex] = visualPromptText;
                            return next;
                        });
                    }

                    return visualPromptText;

                } catch (err: any) {
                    if (err?.name === "AbortError") throw err;
                    // Not enough pixels / signed out: retrying cannot fix it and
                    // would stall the run for maxAttempts * retryDelayMs.
                    if (err?.llmBillingError) throw err;

                    console.error(`fetchAndGenerateImage attempt ${attempt} failed`, err);

                    if (!selectedReplicateTier && attempt === openAiImagePromptAttempts) {
                        switchImagePromptFallbackToDeepSeek();
                    }

                    if (attempt < maxAttempts) {
                        await zzz(retryDelayMs, signal);
                        if (_stopped || signal?.aborted) {
                            throw new DOMException("Aborted", "AbortError");
                        }
                    } else {
                        throw err;
                    }
                }
            }

            return null;
        } catch (err: any) {
            setContinue(true)
            if (err?.name === "AbortError") return null;
            const errText = err?.response?.data?.message || err?.message || 'Image generation failed';
            dispatch(recordCreationAttemptFailure({
                attemptId: promptAttemptId,
                projectId: creationProjectId,
                mediaKind: 'image',
                targetKey: promptAttemptTargetKey,
                sceneNumber: stepIndex + 1,
                message: `Scene ${stepIndex + 1} image failed: ${errText}`,
            }));
            dispatch(patchUserSnapshot({ creation: { isGenerating: false } }));
            throw err;
        } finally {
            finishLoader(stepIndex);
        }
    }

    async function fetchAndGenerateImage(
        stepText: string,
        stepIndex: number,
        imageBlobx: any,
        type: number,
        signal?: AbortSignal
    ): Promise<string | null> {
        if (_stopped || signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        if (promptFetchCacheRef.current) {
            if (promptFetchCacheRef.current[stepIndex]) {
                return await promptFetchCacheRef.current[stepIndex];
            }
        }

        const promise = internalFetchAndGenerateImage(stepText, stepIndex, imageBlobx, type, signal);
        promptFetchCacheRef.current[stepIndex] = promise;

        try {
            const res = await promise;
            if (res) {
                dispatch(recordCreationAttemptSuccess({
                    projectId: creationProjectId,
                    mediaKind: 'image',
                    targetKey: `A:${stepIndex}`,
                }));
            }
            return res;
        } catch (err) {
            delete promptFetchCacheRef.current[stepIndex];
            throw err;
        }
    }
    const claimNanoImage = useCallback((sceneIndex: number, imageData: string): string | null => {
        if (!imageData) return null;

        let finalImage = imageData;
        const isHttpImage = /^https?:\/\//i.test(finalImage);
        if (!finalImage.startsWith('data:image') && !(STORYBOOK_LINK_MODE && isHttpImage)) {
            finalImage = `data:image/png;base64,${finalImage}`;
        }

        const existingImage = nanoImagesRef.current?.[sceneIndex];
        const canKeepExistingImage = Boolean(existingImage)
            && (!STORYBOOK_LINK_MODE || /^https?:\/\//i.test(existingImage));
        if (canKeepExistingImage) {
            imageProvenanceRef.current.mark('preview', existingImage);
            return existingImage;
        }
        imageProvenanceRef.current.mark('preview', finalImage);

        const nextImages = [...nanoImagesRef.current];
        nextImages[sceneIndex] = finalImage;
        nanoImagesRef.current = nextImages;
        setPreviewImage(finalImage);

        if (setNanoImages) {
            setNanoImages((previous: string[] = []) => {
                const previousImage = previous[sceneIndex];
                const canKeepPreviousImage = Boolean(previousImage)
                    && (!STORYBOOK_LINK_MODE || /^https?:\/\//i.test(previousImage));
                if (canKeepPreviousImage) {
                    const currentImages = [...nanoImagesRef.current];
                    currentImages[sceneIndex] = previousImage;
                    nanoImagesRef.current = currentImages;
                    return previous;
                }

                const next = [...previous];
                next[sceneIndex] = finalImage;
                nanoImagesRef.current = next;
                return next;
            });
        }

        return finalImage;
    }, [setNanoImages]);



    // Example updated handleSubmitFluxImage
    const handleSubmitFluxImageNew = useCallback(
        async (
            s3imagesUrlArray: any,
            enhancedPromptx: any,
            loggedUserx: any,
            index: any,
            s3ResultUrl: any,
        ) => {
            const restored = (creationDraft as DraftController | undefined)?.section<Record<string, any>>('prompt');
            const storedHd = String(restored?.ImagesHdCloud?.[index] || '');
            const storedPreview = String(restored?.generatedImagesFluxx?.[index] || storedHd);
            if (draftSeed.savedSceneImages?.[index] && storedHd && storedHd === ImagesHdCloud?.[index]
                && String(draftSeed.GeneratedText?.[index] || '') === String(GeneratedText[index] || '')) {
                imageMediaReceiptsRef.current[`A:${index}`] = { sdUrl: storedPreview, hdUrl: storedHd, persisted: true };
                if (index === 0) setContinue(true);
                else if (index + 1 < steps.length) await handleSubmitFluxImageNew(s3imagesUrlArray, GeneratedText[index + 1], loggedUserx, index + 1, s3ResultUrl);
                return;
            }

            const claim = Symbol(`A:${index}`);
            imageGenerationClaimsRef.current[index] = claim;
            const start = imageLifecycleLiveRef.current;
            let ownedPreview = start.previews[index];
            const canAdopt = () => imageGenerationClaimsRef.current[index] === claim
                && imageLifecycleLiveRef.current.projectId === start.projectId
                && imageLifecycleLiveRef.current.aTopology === start.aTopology
                && [start.previews[index], ownedPreview].includes(imageLifecycleLiveRef.current.previews[index]);

            ///  alert(s3imagesUrlArray.length);

            /// alert('ijj');

            const ctrl = new AbortController();

            // wait for the result here
            startLoader(index);
            let enhancedPrompt;
            try {
                enhancedPrompt = await fetchAndGenerateImage(steps[index], index, null, type, ctrl.signal);
            } catch (error) {
                if (imageGenerationClaimsRef.current[index] === claim) finishLoader(index, true);
                console.error('Scene prompt preparation failed before image submission:', error);
                return;
            }


            if (!enhancedPrompt) {
                // aborted or no text — fallback to original
                // or return early if you require a result
                if (imageGenerationClaimsRef.current[index] === claim) finishLoader(index, true);
                return;
            }
            if (!canAdopt() || timeoutsDisabledRef.current) {
                if (imageGenerationClaimsRef.current[index] === claim) finishLoader(index, true);
                return;
            }

            // --- HYBRID MANUAL MODE LOGIC ---
            const shouldUseNanoImage = CreationMode === 'Video' || modelz === 'Schnell' || modelz === 'Models';
            const cachedNanoImage = nanoImagesRef.current[index];
            const canUseCachedNanoImage = Boolean(cachedNanoImage)
                && (!STORYBOOK_LINK_MODE || /^https?:\/\//i.test(cachedNanoImage));
            if (shouldUseNanoImage && canUseCachedNanoImage) {
                const nanoUrl = cachedNanoImage;
                recordGeneratedImageModel(imageModelForSource(nanoUrl) || 'Schnell', [nanoUrl]);
                imageProvenanceRef.current.mark('preview', nanoUrl);
                try {
                    const fetchRes = await fetch(nanoUrl);
                    if (!fetchRes.ok) throw new Error(`Could not read the completed Nano image (${fetchRes.status}).`);
                    const nanoBlob = await fetchRes.blob();
                    if (!canAdopt()) { retainedInitialImageResultsRef.current.push({ sourceUrl: nanoUrl, sdBlob: nanoBlob, hdBlob: nanoBlob }); return; }
                    ownedPreview = nanoUrl;
                    setGeneratedImagesFluxBlob((prev: any) => { const next = [...prev]; next[index] = nanoBlob; return next; });
                    setGeneratedImagesFluxBlobHd((prev: any) => { const next = [...prev]; next[index] = nanoBlob; return next; });
                    setGeneratedImagesFlux((prev: any) => { const next = [...prev]; next[index] = nanoUrl; return next; });
                    setDummyImageUrls((prev) => ({ ...prev, [index]: nanoUrl }));
                    // A provider URL can expire. Store the actual preview bytes
                    // once; the same binary is intentionally both Nano variants.
                    const storedUrl = await storeImageBinary(nanoBlob);
                    if (!canAdopt()) { retainedInitialImageResultsRef.current.push({ sdUrl: storedUrl, hdUrl: storedUrl }); return; }
                    onImageMediaStored({ type: 'A', index }, { sdBlob: nanoBlob, hdBlob: nanoBlob, previewUrl: nanoUrl, sdUrl: storedUrl, hdUrl: storedUrl });
                    setImagesHdCloud((previous: string[]) => { const next = [...previous]; next[index] = storedUrl; return next; });

                    finishLoader(index);

                    if (index === 0) {
                        setContinue(true);
                    } else {
                        if (index !== steps.length - 1) {
                            handleSubmitFluxImageNew(s3imagesUrlArray, GeneratedText[index + 1], loggedUser, index + 1, s3ResultUrl);
                        }
                    }
                    return; // Skip replicate API generation
                } catch (e) {
                    console.error("Failed to load nano image", e);
                    if (canAdopt()) {
                        setGeneratedImagesFlux((previous: string[]) => { const next = [...previous]; next[index] = nanoUrl; return next; });
                        setDummyImageUrls(previous => ({ ...previous, [index]: nanoUrl }));
                    }
                    finishLoader(index, true);
                    if (index === 0) setContinue(true);
                    return; // Retain the paid preview/file; retry storage, never regenerate it.
                }
            }
            // --------------------------------

            setPollStatus("Polling Replicate...");


            ///alert(enhancedPrompt); installHook.js:1 fetchAndGenerateImage

            if (timeoutsDisabledRef.current) return;

            if (index === 0) {
                setContinue(false);
            }
            const renderAttemptTargetKey = `A:${index}`;
            const renderAttemptId = `sb-img:${creationProjectId}:${renderAttemptTargetKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
            dispatch(recordCreationAttemptStart({
                attemptId: renderAttemptId,
                projectId: creationProjectId,
                mediaKind: 'image',
                targetKey: renderAttemptTargetKey,
            }));
            try {

                // Extract active characters specifically matching this scene's tracked index
                const activeCharsForScene = (CreationMode === 'Video' ? sceneActiveCharactersVideo : sceneActiveCharacters)[index] || [];

                // Build the payload
                var payload: any = {
                    inputs: cleanQuotedAtMentions(enhancedPrompt),
                    // `ty` is the only image-shape instruction.
                    guidance: 7.5,
                    num_inference_steps: 35,
                    seed: Seed,
                    ty: ratioKey,
                    Png: true,
                    linkmode: STORYBOOK_LINK_MODE,
                    model: modelz,
                    billingAction: "scene-image",
                    billingScene: index + 1,
                };

                // Conditionally include the image if available
                var url = "fluxschnell";

                if (CreationMode === 'Video') {
                    url = "fluxschnell";
                }
                else if (activeCharsForScene.length > 0) {

                    // Extract valid reference image URLs from current strictly active characters
                    const characterUrls = activeCharsForScene
                        .map((c: any) => c.imageUrl || c.url || c.image)
                        .filter((u: any) => u && typeof u === 'string' && u.trim() !== '');

                    // 1. Map over ALL URLs and create a promise for each conversion
                    const imagePromises = characterUrls.map(async (imgUrl: any) => {
                        if (!imgUrl || imgUrl.trim() === "") return null;

                        try {
                            // ✅ no fetch / no blob / no base64
                            return imgUrl.trim();
                        } catch (error) {
                            console.error(`Failed to process image ${imgUrl}:`, error);
                            return null;
                        }
                    });

                    // 2. Wait for all conversions to finish
                    const base64ImagesArray = await Promise.all(imagePromises);

                    // 3. Filter out any nulls (failed downloads)
                    const validBase64Images = base64ImagesArray.filter((img) => img !== null);
                    // Result: validBase64Images is now an array of strings ["data:image/...", "data:image/..."]

                    payload.sampleImages = validBase64Images;
                    payload.sampleimagesnames = activeCharsForScene;

                    // 3. Determine the Endpoint URL based on modelz
                    if (modelz === 'Bannana') {
                        url = 'Bannana';
                    }
                    else if (modelz === 'Imagen') {

                        url = 'Bannana';
                    }

                    else if (modelz === 'Imagen2') {

                        url = 'Bannana2';
                    }

                    else if (modelz === 'minimax') {
                        url = 'minimax';
                    }

                    else if (modelz === 'fluxUltra') {

                        url = 'fluxUltra';
                    }

                    else if (modelz === 'fluxUltra2') {

                        url = 'fluxUltra2';
                    }

                    else if (getGptImageRoute(modelz)) {

                        url = getGptImageRoute(modelz)!;
                    }
                    else if (modelz === 'minimax2') {

                        url = 'minimax2';
                    }
                    else if (modelz === 'Schnell' || modelz === 'Models') {
                        url = 'fluxschnell';

                    }
                    else {
                        url = 'minimax';
                    }

                    //   alert(modelz) Dev




                }

                else if (modelz === 'Schnell') {
                    url = 'fluxschnell';

                } else if (modelz === 'Hi Dream') {

                    url = 'HiDream';
                }
                else if (modelz === 'minimax') {

                    url = 'minimax';
                }

                else if (modelz === 'minimax2') {

                    url = 'minimax2';
                }
                else if (modelz === 'Imagen') {

                    url = 'Imagen';
                }

                else if (modelz === 'Imagen2') {

                    url = 'Imagen2';
                }
                else if (modelz === 'Bannana') {
                    url = 'Imagen';
                }
                else if (modelz === 'Imagenx') {

                    url = 'Imagenx';
                }
                else if (modelz === 'fluxUltra') {

                    url = 'fluxUltra';
                }

                else if (modelz === 'fluxUltra2') {

                    url = 'fluxUltra2';
                }

                else if (modelz === 'fluxDev') {

                    url = 'fluxDev';
                }

                else if (modelz === 'seeDream') {

                    url = 'seeDream';
                }

                else if (getGptImageRoute(modelz)) {

                    url = getGptImageRoute(modelz)!;
                } else {

                    url = 'fluxschnell';


                }

                //  type === 3

                payload.billingAction = url === "fluxschnell" ? "preview-image" : "scene-image";

                console.log("[GENERATION PAYLOAD] Processing final generation request:", {
                    modelUrl: url,
                    prompt: payload.inputs,
                    sampleImagesSent: payload.sampleImages ? payload.sampleImages.length : 0,
                    activeCharactersSent: payload.activeCharacters ? payload.activeCharacters.length : 0,
                    activeCharactersData: payload.activeCharacters,
                    sampleImagesData: payload.sampleImages
                });


                // Make the POST request  s3imagesUrlArray
                const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
                    withCredentials: true,
                });

                if (response.status !== 200) {
                    throw new Error(`FluxSchnell route error: ${response.status}`);
                }
                const responseImageSource = await resolveStorybookGeneratedImage(
                    response.data,
                    `storybook-scene-${index}`,
                );
                const sourceQuality = payload.billingAction === 'preview-image' ? 'preview' : 'final';
                const producingModel = imageModelForGenerationRoute(url, response.data?.model);
                recordGeneratedImageModel(producingModel, [responseImageSource]);
                imageProvenanceRef.current.mark(sourceQuality, responseImageSource);
                if (shouldUseNanoImage) {
                    claimNanoImage(index, responseImageSource);
                }


                if (!timeoutsDisabledRef.current) {
                    // clear any previous timeout for this index
                    if (timeoutRefsxp.current[index]) {
                        clearTimeout(timeoutRefsxp.current[index]!);
                        timeoutRefsxp.current[index] = null;
                    }

                    timeoutRefsxp.current[index] = setTimeout(async () => {
                        let preparationFailed = false;
                        try {

                        ///alert(index);

                        if (timeoutsDisabledRef.current) return;

                        const imageSource = STORYBOOK_LINK_MODE
                            ? responseImageSource
                            : shouldUseNanoImage
                                ? nanoImagesRef.current[index] || responseImageSource
                                : responseImageSource;
                        if (!imageSource) {
                            throw new Error("No image returned from server");
                        }

                        // Link mode fetches the normalized S3 URL. Legacy mode
                        // fetches the existing Base64 data URL. Both produce the
                        // same Blob consumed by the established canvas pipeline.
                        const fluxImageBlobx = await (async () => {
                            const fetchRes = await fetch(imageSource);
                            if (!fetchRes.ok) {
                                throw new Error(`Generated image fetch failed: ${fetchRes.status}`);
                            }
                            return await fetchRes.blob();
                        })();

                        // Convert the blob to HD WebP
                        const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                            fluxImageBlobx
                        );

                        const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(
                            fluxImageBlobx
                        );

                        if (!canAdopt()) { retainedInitialImageResultsRef.current.push({ sourceUrl: imageSource, sdBlob: fluxImageBlob, hdBlob: fluxImageBlobHd }); return; }
                        const fluxImageUrl = URL.createObjectURL(fluxImageBlob);
                        recordGeneratedImageModel(producingModel, [fluxImageUrl]);
                        imageProvenanceRef.current.mark(sourceQuality, fluxImageUrl);
                        ownedImageObjectUrlsRef.current.add(fluxImageUrl);
                        ownedPreview = fluxImageUrl;

                        setGeneratedImagesFluxBlob((prev) => {
                            const next = [...prev];
                            next[index] = fluxImageBlob;
                            return next;
                        });

                        setGeneratedImagesFluxBlobHd((prev) => {
                            const next = [...prev];
                            next[index] = fluxImageBlobHd;
                            return next;
                        });


                        // Update the generated image for this particular step VideMode
                        setGeneratedImagesFlux((prev: any) => {
                            const next = [...prev];
                            next[index] = fluxImageUrl;
                            return next;
                        });
                        dispatch(recordCreationAttemptSuccess({
                            attemptId: renderAttemptId,
                            projectId: creationProjectId,
                            mediaKind: 'image',
                            targetKey: renderAttemptTargetKey,
                        }));

                        if (CreationMode === 'Video') {
                            setDummyImageUrls((prev) => ({ ...prev, [index]: fluxImageUrl }));
                        }
                        try {
                            const sdUrl = await storeImageBinary(fluxImageBlob);
                            const hdUrl = await storeImageBinary(fluxImageBlobHd);
                            if (!canAdopt()) { retainedInitialImageResultsRef.current.push({ sdUrl, hdUrl }); return; }
                            onImageMediaStored({ type: 'A', index }, { sdBlob: fluxImageBlob, hdBlob: fluxImageBlobHd, previewUrl: fluxImageUrl, sdUrl, hdUrl });
                            setImagesHdCloud((previous: string[]) => { const next = [...previous]; next[index] = hdUrl; return next; });
                            if (index === 0) {
                                setS3ResultUrl(hdUrl);
                                localStorage.setItem(LOCAL_STORAGE_KEY, hdUrl);
                            }
                        } catch (s3Err) {
                            console.error("Automated S3 upload failed in story loop; completed image retained:", s3Err);
                        }



                        if (type === 10000000) {
                            setSteps((prev: any) => {
                                const next = [...prev];
                                next[index] = "";
                                return next;
                            });
                        }


                        if (index === 0) {
                            setContinue(true);
                        }
                        else {

                            // Stop if we've generated as many images as we have steps
                            if (index === steps.length - 1) {
                                //    setDonex(true);
                            } else {
                                /// alert('nn');
                                handleSubmitFluxImageNew(s3imagesUrlArray, GeneratedText[index + 1], loggedUser, index + 1, s3ResultUrl);


                            }
                        }
                        } catch (error) {
                            preparationFailed = true;
                            // The provider already returned paid work. Retain that
                            // result rather than turn a conversion error into a retry.
                            if (canAdopt()) {
                                setGeneratedImagesFlux((previous: string[]) => { const next = [...previous]; next[index] = responseImageSource; return next; });
                                if (index === 0) setContinue(true);
                            } else {
                                retainedInitialImageResultsRef.current.push({ sourceUrl: responseImageSource });
                            }
                            console.error('Generated image retained after preparation failed:', error);
                        } finally {
                            if (imageGenerationClaimsRef.current[index] === claim) finishLoader(index, preparationFailed);
                        }
                    }, 4500);

                } else if (imageGenerationClaimsRef.current[index] === claim) {
                    finishLoader(index, true);
                }

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err: any) {

                // 1️⃣  pull whatever text is available
                let serverMsg = "";
                if (err.response?.data) {
                    if (typeof err.response.data === "string") {
                        serverMsg = err.response.data;            // raw text
                    } else if (typeof err.response.data.error === "string") {
                        serverMsg = err.response.data.error;      // { error: "…" }
                    }
                }
                if (!serverMsg) serverMsg = err.message || "";

                // 2️⃣  now do simple substring tests
                if (serverMsg.includes("Symbol(Request internals)")) {
                    globalErrorEmitter.emit(
                        "Your prompt was blocked by the content-safety filter. Click on the Safety Button.", index
                    );
                } else if (
                    /safety|sensitive|content policy/i.test(serverMsg)
                ) {
                    globalErrorEmitter.emit(
                        "Your prompt was blocked by the content-safety filter. Click on the Safety Button.", index
                    );
                } else {
                    globalErrorEmitter.emit(
                        "Generation failed. Check safety settings or refresh.", index
                    );
                    console.log("Unexpected error: " + serverMsg);
                }


                dispatch(recordCreationAttemptFailure({
                    attemptId: renderAttemptId,
                    projectId: creationProjectId,
                    mediaKind: 'image',
                    targetKey: renderAttemptTargetKey,
                    sceneNumber: index + 1,
                    message: `Scene ${index + 1} image failed: ${(/safety|sensitive|content policy|Symbol\(Request internals\)/i.test(serverMsg) ? 'blocked by content-safety filter' : (serverMsg || 'generation failed')).slice(0, 220)}`,
                }));
                finishLoader(index, true);

                if (index === 0) {
                    setContinue(true);
                } else {
                    // Stop if we've generated as many images as we have steps
                    if (index === steps.length - 1) {
                        setDonex(true);
                    } else {
                        /// alert('nn');
                        // Grab the last generated blob in the array




                        handleSubmitFluxImageNew(GeneratedImage, GeneratedText[index + 1], loggedUser, index + 1, s3ResultUrl);
                    }

                }


                console.error("Error calling Flux Inference Endpoint:", err);
                setPollStatus("Failed!");
            }
        },
        [prompt, generatedImages, generatedImagesFlux, modelz, Planx, Seed, timeoutRefsxp, GeneratedText, s3ResultUrl, steps, type, CreationMode, sceneActiveCharacters, sceneActiveCharactersVideo, claimNanoImage, storeImageBinary, onImageMediaStored]
    );

    const ContinueGen = useCallback(() => {
        handleSubmitFluxImageNew(GeneratedImage, GeneratedText[1], loggedUser, 1, s3ResultUrl);
        setContinue(false);
    }, [GeneratedImage, GeneratedText, timeoutRefsxp, s3ResultUrl, type, handleSubmitFluxImageNew])

    useEffect(() => {
        if (magicMode && Continue) {
            const timer = setTimeout(() => {
                const targetText = (GeneratedText && GeneratedText.length > 1) ? GeneratedText[1] : "";
                handleSubmitFluxImageNew(GeneratedImage, targetText, loggedUser, 1, s3ResultUrl);

                setContinue(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [magicMode, Continue, GeneratedText, GeneratedImage, loggedUser, s3ResultUrl, handleSubmitFluxImageNew]);




    /** 2) Your existing hook — just make it RETURN the public URL. */
    const generateSignedUrlAndUpload = useCallback(
        async (blob: Blob, promptLine: any): Promise<string> => {
            try {
                // setload(true);
                // setError("");

                // A. get signed PUT url
                const { data }: any = await axios.post(
                    `${CLIK_URL}/get_signed_url_image`,
                    { values: { count: 2 } },
                    { withCredentials: true }
                );

                const signed = data.holder?.[0];
                if (!signed?.urlHD) throw new Error("Bad signed-URL response");

                // B. upload PNG to S3 (force correct content-type)
                const putRes = await axios.put(signed.urlHD, blob, {
                    headers: { "Content-Type": blob.type || "image/png" }
                });
                if (![200, 204].includes(putRes.status)) {
                    throw new Error(`Upload failed: ${putRes.status}`);
                }

                // C. public URL (strip query)
                const publicUrl = signed.urlHD.split("?")[0];



                return publicUrl; // <-- IMPORTANT: now returns the URL
            } catch (err: any) {
                console.error(err);

                throw err; // propagate so caller can handle
            } finally {

            }
        },
        [Planx]
    );



    /**
    * Render text to a transparent PNG and return it as a Blob.
    * Works on iOS/Android (uses toBlob with safe fallback).
    */




    async function textToImageBlob(
        text: string,
        opts?: {
            fontFamily?: string;
            fontSize?: number;         // px
            fontWeight?: number | string;
            fillStyle?: string;        // text color
            strokeStyle?: string;      // outline color
            strokeWidth?: number;      // px
            paddingX?: number;         // px around text
            paddingY?: number;         // px around text
            background?: string | null;  // e.g. "rgba(0,0,0,0.4)"; null => transparent
            textAlign?: "left" | "center" | "right";
        }
    ): Promise<Blob> {
        const {
            fontFamily = 'Roboto',
            fontSize = 56,
            fontWeight = 800,
            fillStyle = '#ffffff',
            strokeStyle = 'rgba(0,0,0,0.7)',
            strokeWidth = 6,
            paddingX = 24,
            paddingY = 12,
            background = null,
            textAlign = "left",
        } = opts || {};

        // If using web fonts, wait so measurements are correct
        try { await (document as any).fonts?.ready; } catch { }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;

        const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.font = font;

        // Measure
        const m = ctx.measureText(text);
        const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.8;
        const descent = m.actualBoundingBoxDescent ?? fontSize * 0.2;
        const lineH = ascent + descent;
        const textW = Math.ceil(m.width);

        // CSS pixel size (then we scale for DPR)
        const cssW = Math.ceil(textW + paddingX * 2);
        const cssH = Math.ceil(lineH + paddingY * 2);

        canvas.width = Math.max(2, Math.round(cssW * dpr));
        canvas.height = Math.max(2, Math.round(cssH * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Background (optional)
        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, cssW, cssH);
        } else {
            ctx.clearRect(0, 0, cssW, cssH);
        }

        // Draw text
        ctx.font = font;
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        let x = paddingX;
        if (textAlign === "center") x = cssW / 2;
        if (textAlign === "right") x = cssW - paddingX;
        const y = paddingY + ascent;

        ctx.textAlign = textAlign as CanvasTextAlign;

        if (strokeWidth > 0) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = strokeStyle;
            ctx.strokeText(text, x, y);
        }
        ctx.fillStyle = fillStyle;
        ctx.fillText(text, x, y);

        // Return Blob (with Safari fallback)
        const blob: Blob = await new Promise((resolve) => {
            if (canvas.toBlob) {
                canvas.toBlob((b) => resolve(b!), 'image/png');
            } else {
                const dataURL = canvas.toDataURL('image/png');
                const [head, body] = dataURL.split(',');
                const mime = head.match(/:(.*?);/)![1];
                const bin = atob(body);
                const u8 = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                resolve(new Blob([u8], { type: mime }));
            }
        });

        return blob;
    }



    const stripRef = useRef<HTMLDivElement | null>(null);

    /* clamp on every native scroll event */
    useEffect(() => {
        const node = stripRef.current;
        if (!node) return;

        const MIN = 10;
        const clamp = () => {
            const max = node.scrollWidth - node.clientWidth - MIN;
            if (node.scrollLeft < MIN) node.scrollLeft = MIN;
            else if (node.scrollLeft > max) node.scrollLeft = max;
        };

        /* start slightly away from 0 so history-swipe can’t kick in */
        node.scrollLeft = MIN;

        node.addEventListener("scroll", clamp, { passive: true });
        return () => node.removeEventListener("scroll", clamp);
    }, []);



    ///convertToHDWebpOrJpegByDevice


    // ----- cancel controls -----
    let _ctrl: AbortController | null = null;
    let _stopped = false;

    function stopAll() {
        _stopped = true;
        _ctrl?.abort();
        _ctrl = null;
    }

    // abortable sleep
    function zzz(ms: number, signal?: AbortSignal) {
        return new Promise<void>((res, rej) => {
            const id = setTimeout(res, ms);
            if (signal) {
                const onAbort = () => {
                    clearTimeout(id);
                    rej(new DOMException('Aborted', 'AbortError'));
                };
                signal.addEventListener('abort', onAbort, { once: true });
            }
        });
    }



    // usage:
    // await runSteps(steps, type);
    // stopAll();  // call anytime to cancel mid-flight


    /**
     * Detects if the user agent is an iPhone.
     * (Very simple check; can be refined if needed.)
     */
    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    /**
     * Converts an input Blob (PNG/JPEG/etc.) into a resized image Blob at 1080×1920.
     * On iPhone, always use JPEG. On other devices, use WebP.
     *
     * @param inputBlob - The original image as a Blob
     * @returns A Promise resolving to the converted image as a Blob
     */
    async function convertToHDWebpOrJpegByDevice(
        inputBlob: Blob
    ): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            // Step 1: Read the Blob into a Data URL
            const reader = new FileReader();
            reader.readAsDataURL(inputBlob);

            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();

                // Step 2: Preserve the provider-returned pixel dimensions.
                img.onload = () => {
                    const canvas = document.createElement("canvas");



                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;


                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Unable to get 2D context from canvas."));
                    }

                    ctx.drawImage(img, 0, 0);

                    // Decide the format based on iPhone detection
                    /// const format = isIphone() ? "image/png" : "image/png";

                    const format = isIphone() ? "image/jpeg" : "image/webp";
                    console.log(
                        "Detected iPhone?",
                        isIphone(),
                        "| Using format:",
                        format
                    );

                    // Step 3: Convert the canvas to a Blob
                    canvas.toBlob(
                        (outputBlob) => {
                            if (outputBlob) {
                                resolve(outputBlob);
                            } else {
                                reject(new Error("Canvas toBlob returned null."));
                            }
                        },
                        format,
                        0.8 // 80% quality
                    );
                };

                // Handle errors while loading the image
                img.onerror = (error) => {
                    reject(error);
                };

                // Begin loading the image
                img.src = imageUrl;
            };

            // Handle file-reading errors
            reader.onerror = (error) => {
                reject(error);
            };
        });
    }

    async function convertToHDWebpOrJpegByDeviceHd(
        inputBlob: Blob
    ): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            // Step 1: Read the Blob into a Data URL
            const reader = new FileReader();
            reader.readAsDataURL(inputBlob);

            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();

                // Step 2: Preserve the provider-returned pixel dimensions.
                img.onload = () => {
                    const canvas = document.createElement("canvas");



                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;


                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Unable to get 2D context from canvas."));
                    }

                    ctx.drawImage(img, 0, 0);

                    // Decide the format based on iPhone detection

                    const format = isIphone() ? "image/png" : "image/png";

                    console.log(
                        "Detected iPhone?",
                        isIphone(),
                        "| Using format:",
                        format
                    );



                    // Step 3: Convert the canvas to a Blob
                    canvas.toBlob(
                        (outputBlob) => {
                            if (outputBlob) {
                                resolve(outputBlob);
                            } else {
                                reject(new Error("Canvas toBlob returned null."));
                            }
                        },
                        format,
                        0.8 // 80% quality
                    );
                };

                // Handle errors while loading the image
                img.onerror = (error) => {
                    reject(error);
                };

                // Begin loading the image
                img.src = imageUrl;
            };

            // Handle file-reading errors
            reader.onerror = (error) => {
                reject(error);
            };
        });
    }

    // Example usage:
    //convertToHDWebpOrJpegByDevice

    //fetchAndGenerateImage

    /**
     *  Minimal SDXL call to huggingface using the "visualPromptText." Imagen
     *  Replaces the local image for this step once it's generated.
     */

    //convertToHDWebpOrJpegByDevice

    /**
     * Whenever steps change (or on mount), fetch visual prompts + generate images.
     */
    const hasFetchedRef = useRef(false);
    const hasFetchedRef2 = useRef(false);
    // Customize padding for both buttons here.
    const buttonPadding = { px: 3, py: 1.5 };
    const storyActionBorder = darkMode
        ? "1px solid rgba(0, 0, 0, 0.42)"
        : "1px solid rgba(60, 70, 85, 0.12)";
    const storyActionBoxShadow = darkMode
        ? "0 8px 32px 0 rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(0, 0, 0, 0.28)"
        : "0 2px 8px rgba(45, 57, 75, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)";
    const storyActionGlassSx = {
        background: buttonTheme.bg,
        backdropFilter: darkMode ? "blur(24px) saturate(120%)" : "none",
        color: buttonTheme.text,
        textShadow: "none",
        border: storyActionBorder,
        borderRadius: 12,
        boxShadow: storyActionBoxShadow,
        transform: "translateY(-2px)",
        // The bottom bar used to fade as a whole while generating. That fade now
        // lives on the buttons themselves, because CSS opacity on a parent caps
        // its children — and the Auto toggle has to stay visible during a run so
        // it can be switched off. Every consumer of this style is a bottom-bar
        // button; Auto spreads it and then opts back in.
        opacity: anyGenerating ? 0 : 1,
        pointerEvents: anyGenerating ? "none" : "auto",
        transition:
            "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease, opacity .3s ease",
        position: "relative",
        overflow: "hidden",
        "&::before": {
            content: '""',
            position: "absolute",
            top: "-40%",
            left: 0,
            width: "60%",
            height: "180%",
            background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
            backgroundSize: "200% 200%",
            transform: "translateX(-150%) rotate(20deg)",
            opacity: 0,
            pointerEvents: "none",
        },
        "&:hover": {
            outline: "none",
            background: buttonTheme.hoverBg,
            color: buttonTheme.hoverText,
            boxShadow: darkMode
                ? "0 8px 32px 0 rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(0, 0, 0, 0.36)"
                : "0 3px 10px rgba(45, 57, 75, 0.08), inset 0 1px 0 #fff",
            transform: "translateY(0)",
            border: storyActionBorder,
            "&::before": {
                opacity: 0.8,
                animation: `${glassSweep} 1.8s ease-out forwards`,
            },
        },
        "&:active": {
            background: darkMode ? "rgba(5, 5, 5, 0.55)" : "#f0f3f7",
            boxShadow: darkMode ? "0 4px 16px rgba(0,0,0,.30)" : "inset 0 1px 3px rgba(45,57,75,0.06)",
            transform: "translateY(0)",
            border: storyActionBorder,
            "&::before": {
                opacity: 0.9,
                animation: `${glassSweep} 1.2s ease-out forwards`,
            },
        },
    };
    const sceneOverlayControlSx = {
        width: 38,
        height: 38,
        borderRadius: "12px",
        background: buttonTheme.bg,
        backdropFilter: darkModeReducer ? "blur(24px) saturate(120%)" : "none",
        color: buttonTheme.text,
        border: darkModeReducer
            ? "1px solid rgba(0, 0, 0, 0.42)"
            : "1px solid rgba(60, 70, 85, 0.12)",
        boxShadow: darkModeReducer
            ? "0 8px 24px rgba(0,0,0,0.55)"
            : "0 2px 8px rgba(45,57,75,0.06)",
        "&:hover": {
            background: buttonTheme.hoverBg,
            color: buttonTheme.hoverText,
        },
    };
    const getSceneDisplayText = (sceneIndex: number) => {
        if (type === 1) {
            const stepItem = steps2[Math.floor(sceneIndex / 2)];
            const textContent = typeof stepItem === 'object' && stepItem !== null ? (stepItem as any).text : stepItem;
            return sceneIndex % 2 === 0 ? textContent ?? "" : "";
        }
        return steps[sceneIndex] ?? "";
    };
    const getOriginalScenePrompt = () => {
        return (prompt || "").trim();
    };
    const getScenePopupText = (sceneIndex: number) => {
        return getSceneDisplayText(sceneIndex).trim();
    };

    // ---------------- Centralized scene deletion ----------------
    // type === 1 stories interleave two raw entries per logical scene
    // (even = plot/narration slot, odd = filler), so deleting one logical
    // scene must remove BOTH raw entries plus ONE narration entry.
    const getSceneDeleteRange = (rawIndex: number) => {
        if (type === 1) {
            const logicalIndex = Math.floor(rawIndex / 2);
            return {
                rawStart: logicalIndex * 2,
                rawCount: 2,
                narrationIndex: logicalIndex,
            };
        }
        return {
            rawStart: rawIndex,
            rawCount: 1,
            narrationIndex: rawIndex,
        };
    };

    const removeRange = <T,>(arr: T[] | null | undefined, start: number, count: number): T[] =>
        (Array.isArray(arr) ? arr : []).filter((_, i) => i < start || i >= start + count);

    // Functional-updater form so every splice works off latest state.
    const removeRangeUpdater = (start: number, count: number) => (prev: any) =>
        removeRange(Array.isArray(prev) ? prev : [], start, count);

    // Object maps keyed by scene index (dummyImageUrls, lipSyncProJobs,
    // promptFetchCacheRef) must be REINDEXED, not just have one key deleted,
    // or entries after the deleted scene stay attached to the wrong scene.
    const reindexNumericRecord = <V,>(rec: Record<number, V>, start: number, count: number): Record<number, V> => {
        const next: Record<number, V> = {};
        Object.keys(rec || {}).forEach((k) => {
            const key = Number(k);
            if (Number.isNaN(key)) return;
            if (key < start) {
                next[key] = rec[key];
            } else if (key >= start + count) {
                next[key - count] = rec[key];
            }
            // keys inside [start, start + count) are dropped
        });
        return next;
    };

    // Shift a scalar scene pointer after deleting [start, start+count).
    const shiftScenePointer = (ptr: number, start: number, count: number, newLength: number): number => {
        if (ptr < start) return ptr;
        if (ptr >= start + count) return ptr - count;
        // pointed at the deleted scene -> clamp to nearest valid index
        return Math.max(0, Math.min(start, newLength - 1));
    };

    const deleteSceneEverywhere = (rawIndex: number) => {
        if (rawIndex == null || rawIndex < 0 || !steps || rawIndex >= steps.length) return;
        if (anyGenerating || isGeneratingBShotPrompts) {
            globalErrorEmitter.emit("Wait for active scene generation to finish before deleting scenes.", rawIndex);
            return;
        }

        // Music-video gate: only extra scenes beyond the song formula count
        // (musicSegments.length) may be deleted. Mirrors the popup gating.
        if (isStoryMusicVideoMode) {
            const currentLogical = Math.ceil(steps.length / 2);
            const requiredLogical = Array.isArray(musicSegments) ? musicSegments.length : 0;
            if (requiredLogical > 0 && currentLogical <= requiredLogical) return;
        }

        const { rawStart, rawCount, narrationIndex } = getSceneDeleteRange(rawIndex);
        if (creationDraft) {
            const removed = removeDraftScenes(creationDraft.getState().snapshot, rawStart, rawCount, narrationIndex);
            for (const section of ['prompt', 'storybook', 'editor'] as const) creationDraft.capture(section, removed.sections[section] || {});
            videoHistoryRef.current = normalizeVideoHistory(removed.sections.storybook?.videoHistory);
            setVideoHistory(videoHistoryRef.current);
            cacheVideoHistory(videoHistoryRef.current);
            // Intent is updated below before this task commits the full projection.
            queueMicrotask(() => { void creationDraft.checkpoint('quiet', { kind: 'topology' }).catch(() => undefined); });
        }
        narrationLayoutVersionRef.current += 1;
        const newRawLength = steps.length - rawCount;
        const spliceRaw = removeRangeUpdater(rawStart, rawCount);
        const spliceNarration = removeRangeUpdater(narrationIndex, 1);
        const removedIntentBindings = intentSceneBindingsRef.current.slice(rawStart, rawStart + rawCount);
        const removedIntentSceneIds = new Set(removedIntentBindings.map((binding) => binding.sceneId));
        setAudioReferences(previous => Object.fromEntries(Object.entries(previous).flatMap(([key, reference]) => {
            if (removedIntentSceneIds.has(key)) return [];
            const indexed = /^([AB]):(\d+)(:\d+)?$/.exec(key);
            if (!indexed) return [[key, reference]];
            const position = Number(indexed[2]);
            if (position >= rawStart && position < rawStart + rawCount) return [];
            return [[position >= rawStart + rawCount ? `${indexed[1]}:${position - rawCount}${indexed[3] || ''}` : key, reference]];
        })));
        const removedLogicalSceneIds = new Set(
            removedIntentBindings
                .map((binding) => binding.logicalSceneId)
                .filter((value): value is string => Boolean(value))
        );

        // Native indices shift below this range: EditStory must drop its
        // scene-keyed drafts/request tokens or they would describe the wrong
        // scenes after the splice.
        bumpSceneTopologyVersion();

        // --- Cancel pending per-scene timeouts, then reindex the ref array ---
        if (timeoutRefsxp?.current) {
            for (let i = rawStart; i < rawStart + rawCount; i++) {
                if (timeoutRefsxp.current[i]) {
                    clearTimeout(timeoutRefsxp.current[i]!);
                    timeoutRefsxp.current[i] = null;
                }
            }
            timeoutRefsxp.current = reindexNumericRecord(timeoutRefsxp.current, rawStart, rawCount);
        }

        // --- Raw-indexed arrays (parent-owned via props) ---
        setSteps(spliceRaw);
        setIntentSceneBindings((previous) => {
            const next = spliceRaw(previous).map((binding: any, orderIndex: number) => ({
                ...binding,
                orderIndex,
            }));
            intentSceneBindingsRef.current = next;
            return next;
        });
        removedIntentSceneIds.forEach((sceneId) => {
            delete initialImagePacingRef.current[sceneId];
            delete committedImagePromptBySceneRef.current[sceneId];
            delete boundImagePromptTextBySceneRef.current[sceneId];
        });
        const intentAfterDelete = replaceIntentBlueprint((current) => {
            if (!current) return current;
            const nextScenes = { ...current.scenes };
            removedIntentSceneIds.forEach((sceneId) => delete nextScenes[sceneId]);
            const nextModeStructure = current.modeStructure.kind === "cinema"
                ? {
                    ...current.modeStructure,
                    logicalSceneOrder: current.modeStructure.logicalSceneOrder.filter(
                        (logicalSceneId) => !removedLogicalSceneIds.has(logicalSceneId)
                    ),
                    logicalScenes: Object.fromEntries(
                        Object.entries(current.modeStructure.logicalScenes).filter(
                            ([logicalSceneId]) => !removedLogicalSceneIds.has(logicalSceneId)
                        )
                    ),
                }
                : current.modeStructure;
            return {
                ...current,
                revision: current.revision + 1,
                sceneOrder: current.sceneOrder.filter((sceneId) => !removedIntentSceneIds.has(sceneId)),
                scenes: nextScenes,
                modeStructure: nextModeStructure,
            };
        });
        if (intentAfterDelete) void persistIntentBlueprint(intentAfterDelete);
        setStepsx(spliceRaw);
        setGeneratedImagesFlux(spliceRaw);
        setImagesHdCloud(spliceRaw);
        setSavedSceneImages(spliceRaw);
        setDrawFrameData(spliceRaw);
        setAutoDrawGuideData(spliceRaw);
        setAutoDrawGuideModes(spliceRaw);
        if (setNanoImages) setNanoImages(spliceRaw);
        if (setLoadersArray) setLoadersArray(spliceRaw);

        // --- Raw-indexed arrays (local state) ---
        setGeneratedText(spliceRaw);
        setGeneratedTextx(spliceRaw);
        setTextVideo(spliceRaw);
        setVideoArray(spliceRaw);
        setVideoArrayBlob(spliceRaw);
        setVideoArrayCloud(spliceRaw);
        setGeneratedImages(spliceRaw);
        setGeneratedImagesFirst(spliceRaw);
        setGeneratedImageBlob(spliceRaw);
        setGeneratedImagesFluxBlob(spliceRaw);
        setGeneratedImagesFluxBlobHd(spliceRaw);
        setGeneratedImagePrompt(spliceRaw);
        setSelectvidImagePrompt(spliceRaw);
        setClipDurations(spliceRaw);
        setIsGenerating(spliceRaw);
        setLoadPrompt(spliceRaw);
        setLoadersPrompt(spliceRaw);
        setLipSyncAudioUrls(spliceRaw);
        setLipSyncActiveList(spliceRaw);
        setLipSyncInstructions(spliceRaw);
        setLipSyncInstructionStatuses(spliceRaw);
        setLipSyncInstructionMeta(spliceRaw);
        setLipSyncPromptBackup(spliceRaw);
        setReferenceVideoUrls(spliceRaw);
        setReferenceVideoActiveList(spliceRaw);
        setnoImagePrompt(spliceRaw);
        setSceneActiveCharacters(spliceRaw);
        setSceneActiveCharactersVideo(spliceRaw);
        setSpatialMotionContexts(spliceRaw);
        setBShotSpatialScenes(spliceRaw);
        setBShotSpatialContexts(spliceRaw);
        setSpatialManifest((previous) => ({
            ...previous,
            scenes: removeRange(previous.scenes, rawStart, rawCount),
        }));
        spatialMotionCompileKeyRef.current = "";

        // --- Narration / logical-scene arrays ---
        setSteps2(spliceNarration);
        if (setGeneratedAudios) setGeneratedAudios(spliceNarration);
        if (setGeneratedAudioTexts) setGeneratedAudioTexts(spliceNarration);
        setGeneratedAudiosCloud(spliceNarration);
        if (setAudioSceneStatuses) setAudioSceneStatuses(spliceNarration);

        // NOTE: musicSegments is intentionally NOT touched here. Segments are
        // formula-owned (NotepadEditor: ceil(songDuration / (breaker * 2)),
        // positional start/end). Music-mode deletes are gated in the popup so
        // only scenes BEYOND the formula count can be removed — after which
        // the existing segment list already matches the remaining scenes.

        // --- B-shot arrays (outer index = raw scene index) ---
        if (setBShotImages) setBShotImages(spliceRaw);
        if (setBShotVideos) setBShotVideos(spliceRaw);
        if (setBShotPrompts) setBShotPrompts(spliceRaw);
        if (setBShotTextVideo) setBShotTextVideo(spliceRaw);
        if (setBShotNanoImages) setBShotNanoImages(spliceRaw);
        setBShotDrawFrameData(spliceRaw);
        setBShotAutoDrawGuideData(spliceRaw);
        setBShotAutoDrawGuideModes(spliceRaw);
        setBShotVideoArray(spliceRaw);
        setBShotVideoArrayBlob(spliceRaw);
        setBShotLoaders(spliceRaw);
        setIsBShotGenerating(spliceRaw);
        setBShotNoImagePrompt(spliceRaw);
        setBShotReferenceVideoUrls(spliceRaw);
        setBShotReferenceVideoActiveList(spliceRaw);
        setBShotSceneActiveCharacters(spliceRaw);
        setBShotSceneActiveCharactersVideo(spliceRaw);

        // --- Index-keyed object maps: reindex, don't just delete ---
        setDummyImageUrls((prev) => reindexNumericRecord(prev || {}, rawStart, rawCount));
        setLipSyncProJobs((prev) => reindexNumericRecord(prev || {}, rawStart, rawCount));
        if (promptFetchCacheRef.current) {
            promptFetchCacheRef.current = reindexNumericRecord(promptFetchCacheRef.current, rawStart, rawCount) as any;
        }

        // --- Refs holding per-scene DOM nodes ---
        if (sceneElementsRef.current) {
            sceneElementsRef.current = removeRange(sceneElementsRef.current as any[], rawStart, rawCount);
        }

        // --- Scalar scene pointers ---
        setactiveEdit((prev: number) => shiftScenePointer(prev, rawStart, rawCount, newRawLength));
        setActiveBShotEdit(null);
        setPromptPreviewIndex((prev: number | null) => {
            if (prev === null) return null;
            if (newRawLength <= 0) return null;
            return shiftScenePointer(prev, rawStart, rawCount, newRawLength);
        });
        setPendingSceneDeleteIndex(null);
    };
    // -------------------------------------------------------------
    ////Sending payload to model route

    useEffect(() => {
        if (!open2) {
            setHideExpandedSceneText(false);
            setPromptPreviewIndex(null);
        }
    }, [open2]);

    // Helper: fire a nano image request directly (no React state dependency)
    const fireNanoForScene = (promptText: string, sceneIndex: number) => {
        if (isHttpMediaUrl(nanoImagesRef.current?.[sceneIndex])) return;
        const payload = {
            inputs: cleanQuotedAtMentions(promptText),
            width: 1080,
            height: 1920,
            guidance: 7.5,
            num_inference_steps: 35,
            seed: Seed || 42,
            ty: ratioKey,
            linkmode: STORYBOOK_LINK_MODE,
            billingAction: "preview-image",
            billingScene: sceneIndex + 1,
        };
        // Fire and forget — runs in background, never aborted
        axios.post(`${CLIK_URL}/fluxschnell`, payload)
            .then(async (response) => {
                const responseData = response.data as any;
                const imageSource = await resolveStorybookGeneratedImage(
                    responseData,
                    `storybook-nano-${sceneIndex}`,
                );
                claimNanoImage(sceneIndex, imageSource);
                recordGeneratedImageModel(imageModelForGenerationRoute('fluxschnell', responseData?.model), [imageSource]);
            })
            .catch((e: any) => {
                console.error("Nano preview API failed for scene", sceneIndex, e);
            });
    };

    useEffect(() => {
        if (!steps?.length) return;

        const run = async () => {
            if (DummyMode) {
                // If you want DummyMode to always run, don't gate on allowgetImage immediately after setting it.
                setallowgetImage(true);

                if (hasFetchedRef.current) return;
                hasFetchedRef.current = true;

                for (let index = 0; index < steps.length; index++) {
                    const enhancedPrompt = await fetchAndGenerateImage(
                        steps[index],
                        index,
                        null,
                        type,
                        undefined
                    );

                    // optional: do something with enhancedPrompt
                    // console.log(enhancedPrompt);
                }

                return;
            }

            // NOT DummyMode
            if (allowgetImage) {
                if (hasFetchedRef.current) return;
                hasFetchedRef.current = true;

                handleSubmitFluxImageNew(
                    GeneratedImage,
                    GeneratedText[0],
                    loggedUser,
                    0,
                    s3ResultUrl
                );
            } else {
                if (hasFetchedRef2.current) return;
                hasFetchedRef2.current = true;

                // strictly sequential runner for background PROMPT prefetching
                hasFiredNanoRef.current = false;
                setPreviewImage(null);
                setFetchingPrompts(true);

                try {
                    for (let index = 0; index < steps.length; index++) {
                        if (_stopped) break;
                        try {
                            const generatedPrompt = await fetchAndGenerateImage(
                                steps[index],
                                index,
                                null,
                                type,
                                undefined
                            );
                            if (generatedPrompt) {
                                // Update text for glass box 1 overlay
                                setLatestFetchedPrompt({ text: generatedPrompt, index });
                                // FIRE NANO DIRECTLY - no React state, no batching issues
                                // Each scene's nano image runs in parallel, all complete independently
                                fireNanoForScene(generatedPrompt, index);
                            }
                        } catch (e) {
                            console.error(`Prefetch failed for index ${index}`, e);
                        }
                    }
                } finally {
                    setFetchingPrompts(false);
                    // DO NOT abort nano requests here - they are fire-and-forget
                    // and must ALL complete for glass box 2 to have every image

                    // Notify parent once the initial prompt prefetch attempt has ended.
                    if (!_stopped && onAllPromptsGenerated) {
                        onAllPromptsGenerated();
                    }
                }
            }
        };

        run().catch((err) => {
            console.error("useEffect run error:", err);
        });

        // optional cleanup if you later add AbortController:
        // return () => ctrl.abort();
    }, [
        steps,
        fetchAndGenerateImage,
        allowgetImage,
        DummyMode,
        GeneratedImage,
        GeneratedText,
        loggedUser,
        s3ResultUrl,
        type,
        CreationMode,
        handleSubmitFluxImageNew
    ]);
    ///    async function runSteps(steps: string[], type: number) {


    ///Done localStorage

    // Whenever `steps` changes, re-initialize generatedImages
    useEffect(() => {
        if (generatedImagesFluxBlob[0]) {
            /////hdimage  1 with 0
        } else {
        }
    }, [generatedImagesFluxBlob]);

    if (!steps || steps.length === 0) {
        return <div>No steps to display.</div>;
    }

    // Define the EnhanceText function
    const EnhanceCaptionx = useCallback(
        async (voice: any) => {
            setisLoading(true);
            setLoadData("Creating Summary..");

            var pp: any = prompt;

            /// setLoadingAudio(true);
            try {
                console.log(pp);
                // Prepare the request payload
                const requestData: any = { pp };

                // Make the POST request to the server
                const response = await axios.post<any>(
                    `${CLIK_URL}/summary`,
                    requestData,
                    { withCredentials: true }
                );

                // Extract data from the response
                const data = response.data;

                // 1. Log both:
                console.log("title done:", data.title);

                // Keep the existing generated-value guard populated so audio
                // retries do not pay for another title request.
                setEnhanceCaption(data.title);
                setEnhanceTitle(data.title);

                // The route now generates only the thumbnail title. Storybook
                // narration audio is generated from the scene text, not a summary.
                /// setisLoading(false);

                handleGenerateAudio("", voice);
                ////Starts Generating Voice
                // callvoice(data.initialSteps);
            } catch (error: any) {
                setisLoading(false);
                // setLoadingAudio(false);

                // Handle different error scenarios generate Video Here
                if (error.response) {
                    // Server responded with a status other than 2xx
                    console.error("Server Error:", error.response.data);
                    //  setError(error.response.data.message || "Server Error");
                } else if (error.request) {
                    // Request was made but no response received
                    console.error("No response received:", error.request);
                    /// setError("Network Error: No response received from server.");
                } else {
                    // Other errors
                    console.error("Error:", error.message);
                    /// setError(error.message);
                }
            } finally {
                ///setIsLoading(false);
            }
        },
        [prompt, steps, music, VideoArrayCloud, steps2, activatevoicenarration, ratioKey]
    );



    const sleepx = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Example of calling Google Text-to-Speech instead of ElevenLabs.
     *
     * @param stepText - The text you want to synthesize
     * @param stepIndex - The index of the current step (to store in 'generatedAudios')
     * @param voiceName - The voice name (e.g., "en-US-Chirp-HD-F"), or whichever voice you prefer
     *
     * Note: you will need valid Google TTS credentials or an API key.
     *       (If you have an API Key, you can pass it as a query param:  ?key=YOUR_API_KEY)
     *       If you’re using an OAuth token, you’ll need an Authorization header with a Bearer token.
     */
    const fetchAndGenerateSpeech = useCallback(
        async (item: any, index: number, voiceName: string, _voiceId: any) => {
            const key = narrationContentKey(item, voiceName);
            const layout = narrationLiveRef.current.layout;
            const isCurrent = () => {
                const live = narrationLiveRef.current;
                return narrationLayoutVersionRef.current === layout && live.layout === layout && live.voice === voiceName
                    && narrationContentKey(live.plots[index], live.voice) === key;
            };
            const allowed = () => narrationLiveRef.current.enabled && isCurrent();
            const text = typeof item === 'object' && item !== null ? item.text : item;
            const updateStatus = (status: string, errorMsg?: string) => {
                if (!isCurrent()) return;
                setAudioSceneStatuses((previous: any[]) => previous.map((value, slot) =>
                    slot === index ? { ...value, status, errorMsg } : value));
            };
            try {
                updateStatus('generating');
                let audioUrl = durableNarrationRef.current.get(key) || await narrationRequestsRef.current.run(key, allowed, async () => {
                    await sleepx(100);
                    // The toggle can change while the deliberate delay is awaited.
                    if (!allowed()) throw new CreationWorkPaused();
                    const response: any = await axios.post(`${CLIK_URL}/generateReplicateAudio`, {
                        text, voice: voiceName,
                        prompt: typeof item === 'object' && item !== null && item.prompt
                            ? item.prompt : "DIRECTOR'S NOTES: Clear and expressive delivery.",
                        language_code: 'en-US',
                    }, { headers: { 'Content-Type': 'application/json' }, withCredentials: true });
                    if (!response.data?.audioContent) throw new Error('No audioContent in response');
                    const audioBuffer = Uint8Array.from(atob(response.data.audioContent), char => char.charCodeAt(0));
                    const audioBlob = new Blob([audioBuffer], { type: response.data.mimeType || 'audio/wav' });
                    return URL.createObjectURL(audioBlob);
                });
                if (creationDraft && audioUrl.startsWith('blob:')) {
                    // Upload retry reuses the already-paid retained Blob result.
                    const audioBlob = await fetch(audioUrl).then(response => response.blob());
                    const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);
                    await axios.put(urlAudio, audioBlob, { headers: { 'Content-Type': audioBlob.type || 'audio/wav' } });
                    const storedUrl = String(urlAudio).split('?')[0];
                    ProtectSavedMediaFromDeleteLater([storedUrl]);
                    URL.revokeObjectURL(audioUrl);
                    audioUrl = storedUrl;
                    durableNarrationRef.current.set(key, storedUrl);
                }
                narrationMetadataRef.current.set(audioUrl, key);
                captureCreationCache(creationDraft, 'storybook', { narrationMetadata: Object.fromEntries(narrationMetadataRef.current) });
                // A paid completion survives off/close. A changed scene/settings
                // retains the keyed result without overwriting another scene.
                if (isCurrent()) {
                    narrationLiveRef.current.audios = [...narrationLiveRef.current.audios];
                    narrationLiveRef.current.audios[index] = audioUrl;
                    narrationLiveRef.current.texts = [...narrationLiveRef.current.texts];
                    narrationLiveRef.current.texts[index] = text;
                    setGeneratedAudios((previous: any[]) => { const next = [...previous]; next[index] = audioUrl; return next; });
                    setGeneratedAudioTexts((previous: any[]) => { const next = [...previous]; next[index] = text; return next; });
                    captureCreationCache(creationDraft, 'prompt', { generatedAudios: narrationLiveRef.current.audios,
                        generatedAudioTexts: narrationLiveRef.current.texts });
                    if (creationDraft?.getState().postId) void creationDraft.flush().catch(() => undefined);
                    updateStatus('success');
                }
                return audioUrl;
            } catch (error: any) {
                if (error instanceof CreationWorkPaused) { updateStatus('pending'); return; }
                failedNarrationRequestsRef.current.add(key);
                if (isCurrent()) {
                    // Failed replacements never erase an earlier paid result.
                    updateStatus('error', error?.response?.data?.error || error.message);
                    narrationRequestedRef.current = false;
                    dispatch(showAiProviderNotice(
                        voiceName.startsWith('fish_')
                            ? 'Fish voice unavailable — select a Gemini voice from the list'
                            : 'Gemini voice unavailable — select a Fish voice from the list'
                    ));
                }
                console.error('TTS generation failed:', error?.message || 'Audio generation failed');
            }
        },
        [setAudioSceneStatuses, setGeneratedAudios, setGeneratedAudioTexts]
    );

    const callvoice = useCallback((_caption: string, _plots: any[], _voiceId: string) => {
        return narrationWorkerRef.current.run(
            () => narrationRequestedRef.current && narrationLiveRef.current.enabled,
            async () => {
                const live = narrationLiveRef.current;
                const index = live.plots.findIndex((item: any, slot: number) =>
                    !hasValidNarrationAudio(item, slot)
                    && !failedNarrationRequestsRef.current.has(narrationContentKey(item, live.voice)));
                if (index < 0) return false;
                await fetchAndGenerateSpeech(live.plots[index], index, live.voice, '');
                return true;
            }
        );
    }, [fetchAndGenerateSpeech, hasValidNarrationAudio]);

    const handleGenerateAudio = useCallback((captionx: any, selectedVoice: any) => {
        narrationRequestedRef.current = true;
        failedNarrationRequestsRef.current.clear();
        setisLoading(false);
        const plots = narrationLiveRef.current.plots;
        setAudioSceneStatuses(plots.map((item: any, index: number) => ({
            text: item, status: hasValidNarrationAudio(item, index) ? 'success' : 'pending',
        })));
        if (narrationLiveRef.current.enabled) setIsAudioGenerating(true);
        setAudioVoiceGenerationTrigger({ caption: captionx, plots, voiceId: selectedVoice });
    }, [hasValidNarrationAudio, setAudioSceneStatuses, setIsAudioGenerating, setisLoading]);

    useEffect(() => {
        if (audioVoiceGenerationTrigger) setAudioVoiceGenerationTrigger(null);
        if (!activatevoicenarration || !narrationLiveRef.current.enabled || !narrationRequestedRef.current) return;
        const live = narrationLiveRef.current;
        const hasMissing = live.plots.some((item: any, index: number) => !hasValidNarrationAudio(item, index)
            && !failedNarrationRequestsRef.current.has(narrationContentKey(item, live.voice)));
        if (!hasMissing) return;
        const work = callvoice('', live.plots, live.voice);
        if (observedNarrationWorkRef.current === work) return;
        observedNarrationWorkRef.current = work;
        void work.finally(() => {
            if (observedNarrationWorkRef.current === work) observedNarrationWorkRef.current = null;
            setAudioWorkRevision(revision => revision + 1);
        }).catch(error => console.error('Narration queue failed:', error?.message));
    }, [activatevoicenarration, narrationSummaryReady, audioVoiceGenerationTrigger, audioWorkRevision, generatedAudios,
        generatedAudioTexts, steps2, voice, callvoice, hasValidNarrationAudio]);

    /*
    useEffect(() => {
        if (steps2.length === 0) return;

        // Detect on the fly if any audio failed and close the publish loader
        if (generatedAudios.includes("ERROR")) {
            setisLoading(false);
            return;
        }

        const postId = PostId;

        const storyT: any = [
            steps2[0],
            steps2[1],
            steps2[2],
            steps2[3],
            steps2[4],
            steps2[5],
            steps2[6],
            steps2[7],
            steps2[8],
        ].filter(Boolean);

        // limit = number of valid scene narration entries. Caption audio is no longer generated.
        const limit = storyT.length;

        // Make sure we have exactly `limit` audios
        // AND every audio element is non-empty (truthy)
        if (
            generatedAudios.length === limit &&
            generatedAudios.every((audioUrl: any) => Boolean(audioUrl) && audioUrl !== "ERROR")
        ) {
            // Fire off the upload
            uploadAllAudiosToS3(postId, EnhanceCaption);
        }
    }, [steps, steps2, PostId, generatedAudios, EnhanceCaption, ImagesHdCloud, type, VideoArrayCloud,]);
    */

    const GenerateSignedUrlForSingleAudio = async (audioBlob: Blob) => {
        if (!audioBlob) {
            throw new Error("No audio Blob to generate a signed URL.");
        }

        // Example request body
        const requestData = { values: { count: 1 } };

        // Post to your backend route that generates signed URLs for audio
        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_audioStory`,
            requestData,
            { withCredentials: true }
        );

        // Assume the server returns something like: { holder: [ { urlAudio } ] }
        const holder = response.data.holder;
        if (!holder || !Array.isArray(holder) || holder.length !== 1) {
            throw new Error("Invalid response from signed URL endpoint.");
        }

        const signedUrls = holder[0];
        if (!signedUrls.urlAudio) {
            throw new Error("Missing signed URL for audio.");
        }

        // Return the object containing the audio URL
        return signedUrls; // e.g. { urlAudio: "https://..." }
    };

    const uploadAllAudiosToS3 = useCallback(
        async (postId: any, EnhanceCaption: any) => {
            setisLoading(true);
            setLoadData("Uploading Audio..");

            try {
                const s3AudioUrls: string[] = [];

                // Loop through each local audio URL in generatedAudios
                for (const audioUrl of generatedAudios) {
                    if (creationDraft && isHttpMediaUrl(audioUrl)) { s3AudioUrls.push(audioUrl); continue; }
                    // 1) Convert the local URL to a Blob
                    const audioBlob = await fetch(audioUrl).then((r) => r.blob());

                    // 2) Get a pre-signed upload URL from your API
                    //    e.g., call GenerateSignedUrlForSingleAudio(audioBlob)
                    const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);

                    // 3) Upload the Blob to S3 using that signed URL
                    await axios.put(urlAudio, audioBlob, {
                        headers: {
                            "Content-Type": audioBlob.type || "audio/mpeg",
                        },
                    });

                    // 4) The final S3 path is the URL without query params
                    const finalAudioUrl = urlAudio.split("?")[0];
                    s3AudioUrls.push(finalAudioUrl);
                }

                // Once done, log them (or store them in state, or send to DB)
                console.log("Uploaded all audio to S3:", s3AudioUrls);

                var Data = {
                    postId: postId,
                    captionSummary: EnhanceCaption,
                    captionAudio: null,
                    x1: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                    x2: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                    x3: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                    x4: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                    x5: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                    x6: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                    x7: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                    x8: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                    x9: s3AudioUrls[8] ? s3AudioUrls[8] : null,
                    typex: 1,
                };

                var Datax = {
                    captionSummary: EnhanceCaption,
                    captionAudio: null,
                    xa1: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                    xa2: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                    xa3: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                    xa4: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                    xa5: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                    xa6: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                    xa7: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                    xa8: s3AudioUrls[7] ? s3AudioUrls[7] : null,

                };

                ///ClikStory(verticalActiveIndex, 0, '');

                /// setisLoading(false);

                callCreateMp4(Datax, Data, s3AudioUrls);
            } catch (error) {
                setisLoading(false);
                console.error("Error uploading all audios to S3:", error);
            }
        },
        [steps, generatedAudios, ImagesHdCloud, type, VideoArrayCloud, steps2, activatevoicenarration, ratioKey]
    );

    /**
     * Helper: Load metadata for a single audio URL and return duration (seconds).
     */
    const getAudioDuration = (url: any) => {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous"; // helps if your S3 or server sets CORS headers
            audio.preload = "metadata"; // ensure metadata is loaded
            audio.src = url;

            audio.addEventListener("loadedmetadata", () => {
                // audio.duration is in seconds
                resolve(audio.duration);
            });

            // Handle load errors (e.g., 404, CORS issues)
            audio.addEventListener("error", (err) => {
                reject(err);
            });
        });
    };


    const getVideoDuration = (url: any) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.crossOrigin = "anonymous"; // handle CORS if needed
            video.preload = "metadata";
            video.src = url;

            video.addEventListener("loadedmetadata", () => {
                resolve(video.duration); // duration in seconds
            });

            video.addEventListener("error", (err) => {
                reject(err);
            });
        });
    };


    /* ------------------------------------------------------------------ */
    /* Helper: poll backend until MediaConvert job finishes                */
    /* ------------------------------------------------------------------ */
    const pollJobUntilComplete = async (
        jobId: string,
        intervalMs = 5_000,          // 5-second polling cadence
        timeoutMs = 10 * 60_000     // 10-minute cap
    ) => {
        const start = Date.now();
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        while (true) {
            const { data }: any = await axios.get(`${CLIK_URL}/job-status/${jobId}`);
            const status = data.status as string;

            if (status === "COMPLETE") return;          // ✅ ready!
            if (status === "ERROR") throw new Error("MediaConvert job failed");

            if (Date.now() - start > timeoutMs) {
                throw new Error("Timed-out waiting for MediaConvert");
            }
            await sleep(intervalMs);
        }
    };



    const confirmImagesUsed = useCallback(() => {
        // 1. Safety check: If there are no images to confirm, stop.
        if (!GeneratedImage || GeneratedImage.length === 0) return;

        const STORAGE_KEY = "helperimagesprompt";

        try {
            // 2. Get the current "Delete List" from local storage
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (!storedData) return;

            const existingImages = JSON.parse(storedData);
            if (!Array.isArray(existingImages)) return;

            // 3. Filter the list
            // We keep an image in the delete list ONLY if it is NOT present in GeneratedImage.
            // (i.e., If it IS in GeneratedImage, we remove it from this list so it won't be deleted)
            const updatedImages = existingImages.filter((storedImg: any) => {
                return !GeneratedImage.includes(storedImg.url);
            });

            // 4. Update Local Storage if changes were made
            if (updatedImages.length !== existingImages.length) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedImages));

                const savedCount = existingImages.length - updatedImages.length;
                console.log(`✅ Secured ${savedCount} assets from auto-deletion.`);
            }

        } catch (error) {
            console.error("Error securing used images:", error);
        }
    }, [GeneratedImage]); // Dependency ensures function always sees the latest GeneratedImage array

    /* ------------------------------------------------------------------ */
    /* Your unchanged create-MP4 hook, plus the polling step               */
    /* ------------------------------------------------------------------ */
    const callCreateMp4 = useCallback(
        async (Datax: any, Data: any, s3AudioUrls: any) => {
            ///MemeMusic
            setisLoading(true);
            setLoadData("Creating Mp4..");
            console.log("cloud", ImagesHdCloud);
            /* ---------- 2) Gather all possible images (now uses Datax length) ---------- */
            const imagesForVideo2 = [
                Datax[0], Datax[1], Datax[2], Datax[3],
                Datax[4], Datax[5], Datax[6], Datax[7], Datax[8], Datax[9], Datax[10], Datax[11], Datax[12],
                Datax[13], Datax[14], Datax[15], Datax[16], Datax[17]
            ].filter(Boolean);

            const imagesForVideox = (ImagesHdCloud ?? []).filter(Boolean);

            const imagesForVideo = !activatevoicenarration ? imagesForVideo2 : imagesForVideox;

            /* ---------- 3) Gather all possible audios (now uses s3AudioUrls length) ---------- */
            /**
             * Your old code intentionally skipped index 0 (started at [1]).
             * This keeps that behavior: take from index 1 onward.
             */
            const audioForVideo = (s3AudioUrls ?? []).slice(1).filter(Boolean);

            /* ---------- 4) Gather all possible ai videos (now uses VideoArrayCloud length) ---------- */
            const clipsForVideo = (VideoArrayCloud ?? []).filter(Boolean);


            ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3"
            ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/humming-song-59500.mp3",
            var TYPE2_TRACKS: any = [
                "https://clikbatebucket.s3.us-east-1.amazonaws.com/welte-mignon-piano-48794.mp3",
                "https://clikbatebucket.s3.us-east-1.amazonaws.com/clikb_default.mp3"


            ];

            //  var idx = Math.floor(Math.random() * TYPE2_TRACKS.length);

            /// alert(music)
            var audioUrl = music;

            console.log('music bg to route', audioUrl);
            ///  console.log("RANDOM IDX:", idx);
            /// console.log("RANDOM URL:", TYPE2_TRACKS[idx]);


            try {
                const firstImageSize = firstImageDims
                    ? `${firstImageDims.width}x${firstImageDims.height}`
                    : "";



                /* 4) durations (UNCHANGED) */

                var audioDurations = [];
                var BGduration: any = 90;
                if (audioForVideo.length > 0) {
                    audioDurations =
                        await Promise.all(
                            audioForVideo.map((audioUrl: any) => getAudioDuration(audioUrl))
                        );
                }

                // You must use 'await' because your function returns a Promise
                try {
                    BGduration = await getAudioDuration(audioUrl);
                    console.log("Duration is:", BGduration); // e.g., 15.4
                } catch (error) {
                    console.error("Error getting BGduration:", error);
                }
                console.log("Audio Durations:", audioDurations);
                console.log("Audio Duration BACKGROUNDDDDDDDDDDDDDDD:", BGduration);


                var usevid = 0;
                var x = "create-videoimg";

                if (VideoArrayCloud.length === steps.length) {

                    usevid = 1;
                }

                console.log('vid length', clipsForVideo.length);
                console.log('img length', imagesForVideo.length);
                console.log('vid cloud length', VideoArrayCloud.length);

                if (usevid === 1) {
                    //alert('awwwa');



                    if (activatevoicenarration) {
                        //  alert('kk');

                        x = "create-video";

                        if (clipDurations[1] == 200) {
                            x = "create-videonoaudio";

                        }
                    } else {

                        x = "create-videoDirect";

                        if (clipDurations[1] == 200) {
                            x = "create-videoDirectnoaudio";
                        }
                    }



                    if (type === 0 || type === 3) {

                        /// alert('using wrong music');
                        // alert('aapppp');
                        x = "create-memevidm";



                    }
                }

                else {


                    if (activatevoicenarration) {
                        //   alert('aa');
                        x = "create-videoimg";

                    } else {

                        x = "create-memeimg";
                    }

                    if (type === 0 || type === 3) {

                        /// alert('using wrong music');

                        // alert('aasss');
                        x = "create-memeimg";
                    }
                }







                /* 5) POST to backend (UNCHANGED) */
                const response: any =
                    await axios.post(`${CLIK_URL}/${x}`, {
                        clipDurations: clipDurations[0],
                        audioUrls: audioForVideo,
                        imageUrls: imagesForVideo,
                        videoUrls: usevid ? clipsForVideo : null,                // mp4type === 1 ? clipsForVideo : null,
                        audioDurations: type === 0 || type === 3 ? 0 : audioDurations,
                        audioUrl: audioUrl,
                        outputResolution: firstImageSize,
                        outputBucket: "s3://clikbatebucket/videos/",
                        ratio: ratioKey

                    });

                console.log("MediaConvert response:", response.data);

                const { jobId, videoUrl, videoLength } = response.data;   // backend reply alert








                /* ---------- NEW: wait until job is COMPLETE Speech ---------- */
                setLoadData("Rendering video…");             // optional UI message
                await pollJobUntilComplete(jobId);            // ⏳ blocks here
                console.log("MediaConvert job completed:", jobId);
                /// alert(videoLength);
                /* ---------- Continue exactly as before --------------- */

                ///   const videoLengthx = await getVideoDuration(videoUrl);
                ///  console.log(`Video Length calculated: ${videoLengthx} seconds`);
                console.log(`Video Length: ${videoLength} `);
                console.log(`First Videoooooooooooo : ${videoUrl} `);



                setTimeout(async () => {



                    /// var logo1 = 'https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/88.png';
                    /// var logo2 = 'https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/ddd.png';

                    var logo1 = 'https://clikbatebucket.s3.us-east-1.amazonaws.com/ChatGPT+Image+Apr+25%2C+2026%2C+09_28_40+PM.png';
                    var logo2 = 'https://clikbatebucket.s3.us-east-1.amazonaws.com/ChatGPT+Image+Apr+25%2C+2026%2C+09_28_40+PM.png';

                    // Randomly pick 1 or 2
                    var logo = Math.random() < 0.5 ? logo1 : logo2;
                    /// var logo = logo2;

                    var text2 = 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-cb15400a7ecfabe08640af35d6ca66aa.png'


                    /*     const blob = await textToImageBlob(`@${loggedUser?.username}`);
                         const text1 = 'await generateSignedUrlAndUpload(blob, ''); '  // <- this is the S3 URL
                     
     
                         */

                    const text1 = 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-cb15400a7ecfabe08640af35d6ca66aa.png'

                    console.log('branding text2 URL made:', text1);
                    //   alert('pp');

                    const addBgResponse: any = await axios.post(
                        `${CLIK_URL}/addbackgroundmusic`,
                        {
                            text1,
                            logo,
                            text2,
                            videoUrlx: videoUrl, // the MP4 we just created
                            audioUrlx: audioUrl, // the same MP3 (or any other MP3 you want)
                            videoLength: videoLength, // must match the MP4’s length in seconds
                            outputResolution: firstImageSize,
                            type: type === 0 || type === 3 ?
                                usevid === 1 ? 2 : 1

                                : activatevoicenarration ? 0 : usevid === 1 ? 2 : 1,
                            audioLength: BGduration,
                            isVideoSilent: activatevoicenarration ? false : clipDurations[1] == 200 ? true : false,
                            usedanimate: usedanimate,
                        }
                    );
                    console.log("Second MediaConvert (add background) response:", addBgResponse.data);

                    const { jobId: bgJobId, outputVideo } = addBgResponse.data;
                    // outputVideo will look like: https://clikbatebucket.s3.amazonaws.com/videos-with-music/whatever_with_music.mp4


                    // 7) Now `outputVideo` is your final MP4 with music mixed in
                    console.log("Final MP4 with background music:", outputVideo);
                    setLoadData("Done! Your video is ready.");
                    setisLoading(false);
                    // 8) Save to database or update your UI
                    Data.videourl = outputVideo;

                    // startDelete(text1);

                    // 1. First, tell Local Storage "These images are safe now, don't delete them!"
                    confirmImagesUsed();

                    saveToDatabase(Data, videoUrl);
                    setGeneratedAudios([]);



                    // 6) Poll until the “addbackgroundmusic” job completes
                    ////   await pollJobUntilComplete(bgJobId);
                    //console.log("✅ Background‐music job completed:", bgJobId);







                }, 500)







            } catch (error: any) {
                if (error.response) {
                    console.error("Status:", error.response.status);
                    console.error("Response body:", error.response.data);
                } else {
                    console.error(error);
                }
                ///   alert(error.message || "Error making MP4");
            } finally {

            }
        },
        [ImagesHdCloud, firstImageDims, type, MemeMusic, music, VideoArrayCloud, clipDurations, activatevoicenarration, GeneratedImage, ratioKey]
    );





    const ContinueUpload = useCallback(async () => {
        if (type === 1 && activatevoicenarration && !narrationSummaryReady) return;
        // If type === 3 (Interactions), we bypass audio generation and go straight to the B Shot Grid

        // If type === 3 (Interactions), we bypass audio generation and go straight to the B Shot Grid
        if (type === 3) {
            setIsBShotModeActive(true);
            setActiveLoaderCallerChecker(false);
            return;
        }

        // If type === 0 (Memes) or narration is disabled, we also bypass audio and go straight to B Shot Grid
        if (!activatevoicenarration || type === 0) {
            setIsBShotModeActive(true);
            setActiveLoaderCallerChecker(false);
            return;
        }

        // Otherwise, voice narration is enabled. We need to generate audios if dirty or missing.
        const storyT = [
            steps2[0],
            steps2[1],
            steps2[2],
            steps2[3],
            steps2[4],
            steps2[5],
            steps2[6],
            steps2[7],
            steps2[8],
        ].filter(Boolean);

        let needsAnyAudioGeneration = false;
        for (let i = 0; i < storyT.length; i++) {
            const idx = i;
            if (!hasValidNarrationAudio(storyT[i], idx)) {
                needsAnyAudioGeneration = true;
            }
        }

        if (needsAnyAudioGeneration) {
            // Trigger Audio progress modal
            setIsAudioGenerating(true);
            // Hide the publish pre-flight checks modal
            setActiveLoaderCallerChecker(false);

            // If EnhanceCaption already exists, we skip summary generation
            if (EnhanceCaption && EnhanceCaption.trim() !== "") {
                handleGenerateAudio(EnhanceCaption, voice);
            } else {
                EnhanceCaptionx(voice);
            }
        } else {
            // Audio is already generated and valid, skip straight to B Shot Grid!
            setIsBShotModeActive(true);
            setActiveLoaderCallerChecker(false);
        }

    }, [
        type, activatevoicenarration, narrationSummaryReady, steps2, generatedAudios, generatedAudioTexts,
        voice, EnhanceCaption, EnhanceCaptionx, handleGenerateAudio,
        setIsBShotModeActive, setIsAudioGenerating, setActiveLoaderCallerChecker, hasValidNarrationAudio
    ]);

    const handleRetrySceneAudio = useCallback(async (idx: number) => {
        if (!narrationLiveRef.current.enabled) return;
        const item = audioSceneStatuses[idx];
        if (!item) return;
        failedNarrationRequestsRef.current.delete(narrationContentKey(item.text, voice));

        try {
            await fetchAndGenerateSpeech(item.text, idx, voice, "");
        } catch (err) {
            console.error("Retry failed:", err);
        }
    }, [audioSceneStatuses, fetchAndGenerateSpeech, voice]);

    const handlePlayAudioPreview = useCallback((idx: number) => {
        const url = generatedAudios[idx];
        if (!url || url === "ERROR") return;

        if (currentlyPlayingAudio && playingAudioIndex === idx) {
            currentlyPlayingAudio.pause();
            setCurrentlyPlayingAudio(null);
            setPlayingAudioIndex(null);
            return;
        }

        if (currentlyPlayingAudio) {
            currentlyPlayingAudio.pause();
        }

        const newAudio = new Audio(url);
        newAudio.addEventListener('ended', () => {
            setPlayingAudioIndex(null);
            setCurrentlyPlayingAudio(null);
        });

        newAudio.play()
            .then(() => {
                setPlayingAudioIndex(idx);
                setCurrentlyPlayingAudio(newAudio);
            })
            .catch(err => {
                console.error("Audio preview play failed:", err);
                setPlayingAudioIndex(null);
                setCurrentlyPlayingAudio(null);
            });
    }, [generatedAudios, currentlyPlayingAudio, playingAudioIndex]);

    useEffect(() => {
        if (!isAudioGenerating && currentlyPlayingAudio) {
            currentlyPlayingAudio.pause();
            setCurrentlyPlayingAudio(null);
            setPlayingAudioIndex(null);
        }
    }, [isAudioGenerating, currentlyPlayingAudio]);

    useEffect(() => {
        if (isAudioGenerating && audioSceneStatuses.length > 0) {
            const allDone = audioSceneStatuses.every(s => s.status === 'success')
                && narrationLiveRef.current.enabled
                && narrationLiveRef.current.plots.every((item: any, index: number) => hasValidNarrationAudio(item, index));
            if (allDone) {
                setIsAudioDirty(false);
                setIsAudioGenerating(false);
                setIsBShotModeActive(true);
            }
        }
    }, [audioSceneStatuses, isAudioGenerating, setIsAudioDirty, setIsAudioGenerating, setIsBShotModeActive, hasValidNarrationAudio]);

    // ============================================================================
    // B SHOT ENGINE: Audio-Duration vs Video-Length Calculation
    // ============================================================================
    useEffect(() => {
        let cancelled = false;
        const topology = sceneTopologyVersionRef.current;
        if (isBShotModeActive) {
            const calculateBShots = async () => {
                // Per-clip duration comes from the lifted `time` (the same value the
                // video editor generates with). Guard against 0/undefined.
                const D = (typeof time === 'number' && time > 0) ? time : 5;

                // Deep copy the state arrays
                const newBShotPrompts = [...(bShotPrompts || [])];
                const newBShotImages = [...(bShotImages || [])];
                const newBShotVideos = [...(bShotVideos || [])];

                // Ensure they have the correct length matching steps
                while (newBShotPrompts.length < steps?.length) newBShotPrompts.push([]);
                while (newBShotImages.length < steps?.length) newBShotImages.push([]);
                while (newBShotVideos.length < steps?.length) newBShotVideos.push([]);

                let arraysModified = false;

                for (let i = 0; i < steps?.length; i++) {
                    const stepPrompt = typeof steps[i] === 'object' && steps[i] !== null ? (steps[i] as any).text : steps[i];

                    // WITHOUT NARRATION: Just add 1 default B-Shot next to all scenes
                    if (!activatevoicenarration || type !== 1) {
                        if (newBShotPrompts[i].length === 0) {
                            newBShotPrompts[i] = [`${stepPrompt} [B-Shot-Pending]`];
                            arraysModified = true;
                        }
                        continue;
                    }

                    // WITH NARRATION + STORY MODE
                    // Only calculate for the "B" scene of the stage (i % 2 === 1)
                    if (i % 2 === 0) {
                        // "A" scene, no B shots added here.
                        continue;
                    }

                    // We are at the "B" scene (e.g., i=1 for stage 1, i=3 for stage 2)
                    const stageIndex = Math.floor(i / 2); // stage 1 audio is at index 0
                    const audioUrl = generatedAudios?.[stageIndex];

                    if (audioUrl && audioUrl !== "ERROR" && newBShotPrompts[i].length === 0) {
                        try {
                            const duration = await new Promise<number>((resolve) => {
                                const audio = new Audio(audioUrl);
                                audio.onloadedmetadata = () => resolve(audio.duration);
                                audio.onerror = () => resolve(0);
                            });

                            const baseDuration = D * 2; // two A-shots cover 2 x D seconds
                            if (duration > baseDuration) {
                                const remainder = duration - baseDuration;
                                // Every B-shot is exactly D seconds (the only length the model
                                // can render), so the count is just the rounded number of
                                // D-second clips needed to cover the leftover narration.
                                // Cap at 10 for safety; round() lets a tiny tail (< D/2) drop to 0.
                                const nB = Math.min(Math.round(remainder / D), 10);
                                if (nB > 0) {
                                    const stagePrompts = [];
                                    for (let k = 0; k < nB; k++) {
                                        stagePrompts.push(`${stepPrompt} [B-Shot-Pending ${D}s]`);
                                    }
                                    newBShotPrompts[i] = stagePrompts;
                                    arraysModified = true;
                                }
                            }
                        } catch (err) {
                            console.error("Audio duration check failed", err);
                        }
                    }
                }

                if (arraysModified && !cancelled && sceneTopologyVersionRef.current === topology) {
                    setBShotPrompts(newBShotPrompts);
                    setBShotImages(newBShotImages);
                    setBShotVideos(newBShotVideos);
                    // Stamp the arrangement with the clip length it was built against.
                    setBShotBuiltWithTime(time);
                }
            };

            const hasArrangement = (bShotPrompts || []).some((arr: any) => arr && arr.length > 0);

            if (!hasArrangement) {
                // First-time build: create the arrangement (calculateBShots stamps the time).
                calculateBShots();
            } else if (
                activatevoicenarration && type === 1 &&
                bShotBuiltWithTime != null && bShotBuiltWithTime !== time
            ) {
                // An arrangement already exists but it was sized for a different clip
                // length than the current `time` (e.g. user generated video at 10s after
                // building B-shots at 5s). Ask before wiping/rebuilding — no silent reset.
                setShowBShotTimeChangeWarning(true);
            }
        }
        return () => { cancelled = true; };
    }, [isBShotModeActive, steps, type, activatevoicenarration, generatedAudios, SelectedModel, time, bShotBuiltWithTime, bShotPrompts, bShotImages, bShotVideos, setBShotPrompts, setBShotImages, setBShotVideos]);


    // The existing prompt/preview pipeline shares one owner across every card.
    // Pauses affect new submissions; paid stage results remain owned and reusable.
    useEffect(() => {
        if (!canSubmitBShotWork() || bShotWorkLiveRef.current.anyGenerating) return;
        if (!nextBShotCreationStage(bShotWorkLiveRef.current, failedBShotRequestsRef.current)) {
            const live = bShotWorkLiveRef.current;
            const waitingForBase = live.prompts.some((row: string[], index: number) => row.some(value => value.includes('[B-Shot-Pending')) && !live.GeneratedText[index]);
            if (!waitingForBase && optionalBShotsRunning) setOptionalBShotsRunning(false);
            return;
        }
        const work = bShotWorkerRef.current.run(canSubmitBShotWork, async () => {
            const live = bShotWorkLiveRef.current;
            if (live.anyGenerating) return false;
            const target = nextBShotCreationStage(live, failedBShotRequestsRef.current);
            if (!target) return false;
            const { index, shot, prompt: capturedPrompt, pending, key } = target;
            const topology = live.topology;
            const current = () => sceneTopologyVersionRef.current === topology && bShotWorkLiveRef.current.topology === topology
                && String(bShotWorkLiveRef.current.prompts[index]?.[shot] || '') === capturedPrompt;
            const allowed = () => canSubmitBShotWork() && current();
            setIsGeneratingBShotPrompts(true);
            try {
                if (pending) {
                    const aiText = await bShotPromptRequestsRef.current.run(key, allowed, async () => {
                        const latest = bShotWorkLiveRef.current;
                        const visual = shot === 0 ? latest.GeneratedText[index] : latest.prompts[index][shot - 1];
                        const video = shot === 0 ? latest.TextVideo?.[index] : latest.videoPrompts[index]?.[shot - 1];
                        const response = await fetch(`${CLIK_URL}/ImageDesignStoryStage`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({
                                text: cleanQuotedAtMentions(`[CINEMATIC B-SHOT CUTAWAY OR REACTION]. ${latest.generatedAudioTexts?.[Math.floor(index / 2)] || ''}. Visual continuation of: ${visual}`),
                                prompt: cleanQuotedAtMentions(latest.prompt), Planx: latest.Planx,
                                videoPrompt: cleanQuotedAtMentions(video || ''), isBShotPrompt: true,
                            }),
                        });
                        if (!response.ok) await throwLlmFetchError(response, dispatch);
                        applyPixelBillingHeaders(dispatch, response);
                        const data = await response.json();
                        const result = data?.visualPromptStage1 || data?.visualPromptStage2;
                        if (typeof result !== 'string' || !result.trim()) throw new Error('No B-roll visual prompt returned');
                        return cleanQuotedAtMentions(result);
                    });
                    const duration = capturedPrompt.match(/\[B-Shot-Pending (\d+s)\]/)?.[1];
                    const result = aiText + (duration ? ` [B-Shot ${duration}]` : '');
                    if (current()) {
                        const next = bShotWorkLiveRef.current.prompts.map((row: string[]) => [...row]);
                        next[index][shot] = result;
                        bShotWorkLiveRef.current.prompts = next;
                        bShotTruthRef.current = { ...bShotTruthRef.current, prompts: next };
                        setBShotPrompts((previous: string[][]) => {
                            if (sceneTopologyVersionRef.current !== topology || previous[index]?.[shot] !== capturedPrompt) return previous;
                            const updated = previous.map(row => [...row]); updated[index][shot] = result; return updated;
                        });
                        setBShotTextVideo?.((previous: string[][] = []) => {
                            if (sceneTopologyVersionRef.current !== topology || previous[index]?.[shot]) return previous;
                            const next = previous.map(row => [...row]); while (next.length <= index) next.push([]);
                            next[index][shot] = result; return next;
                        });
                    } else {
                        retainedBShotArrangementsRef.current.push({ type: 'prompt', index, shot, topology, prompt: result });
                    }
                    // Nano generation is a separate next operation, so Stop or
                    // Publish during prompt preparation takes effect here.
                } else {
                    let finalImage = await bShotNanoRequestsRef.current.run(key, allowed, async () => {
                        const latest = bShotWorkLiveRef.current;
                        const response: any = await axios.post(`${CLIK_URL}/fluxschnell`, {
                            inputs: cleanQuotedAtMentions(capturedPrompt.replace(/\s*\[B-Shot(?:-Pending)?(?: \d+s)?\]/g, '')),
                            width: 1080, height: 1920, guidance: 7.5, num_inference_steps: 35,
                            seed: latest.Seed || 42, ty: latest.ratioKey, linkmode: STORYBOOK_LINK_MODE,
                            billingAction: 'b-shot-image', billingScene: index + 1,
                        });
                        const image = await resolveStorybookGeneratedImage(response.data, `storybook-bshot-${index}-${shot}`);
                        recordGeneratedImageModel(imageModelForGenerationRoute('fluxschnell', response.data?.model), [image]);
                        return image;
                    });
                    if (creationDraft) {
                        // The paid result is retained by its request owner; a storage retry
                        // reuses it and does not submit another image generation.
                        const source = finalImage;
                        let stored = imageStoredAliasesRef.current.get(source);
                        if (!stored) {
                            const binary = await fetch(source).then(response => {
                                if (!response.ok) throw new Error('Could not store the B-roll preview.');
                                return response.blob();
                            });
                            stored = await storeImageBinary(binary);
                            imageStoredAliasesRef.current.set(source, stored);
                        }
                        inheritImageResultModel(source, [source, stored], stored);
                        ProtectSavedMediaFromDeleteLater([stored]);
                        finalImage = stored;
                    }
                    const latest = bShotWorkLiveRef.current;
                    if (current() && !isCompletedCreationMedia(latest.images[index]?.[shot]) && !isCompletedCreationMedia(latest.videos[index]?.[shot])) {
                        const next = latest.nanoImages.map((row: string[]) => [...row]); while (next.length <= index) next.push([]);
                        next[index][shot] = finalImage; latest.nanoImages = next;
                        setBShotNanoImages?.((previous: string[][] = []) => {
                            if (sceneTopologyVersionRef.current !== topology) return previous;
                            const updated = previous.map(row => [...row]); while (updated.length <= index) updated.push([]);
                            updated[index][shot] = finalImage; return updated;
                        });
                    } else {
                        retainedBShotArrangementsRef.current.push({ type: 'image', index, shot, topology, prompt: capturedPrompt, image: finalImage });
                    }
                }
            } catch (error: any) {
                if (!(error instanceof CreationWorkPaused)) {
                    failedBShotRequestsRef.current.add(key);
                    console.error('B-roll creation failed:', index, shot, error?.message || 'Generation failed');
                }
            }
            return true;
        });
        if (observedBShotWorkRef.current === work) return;
        observedBShotWorkRef.current = work;
        void work.finally(() => {
            if (observedBShotWorkRef.current === work) observedBShotWorkRef.current = null;
            setIsGeneratingBShotPrompts(false);
            setBShotWorkRevision(revision => revision + 1);
        }).catch(error => console.error('B-roll queue failed:', error?.message));
    }, [bShotPrompts, GeneratedText, bShotImages, bShotVideos, bShotNanoImages, isBShotModeActive,
        optionalBShotsRunning, publishLoader2Open, activatevoicenarration, bShotWorkRevision, anyGenerating,
        TextVideo, bShotTextVideo, prompt, Planx, ratioKey, Seed, generatedAudioTexts, canSubmitBShotWork, dispatch]);

    const toggleOptionalBShots = useCallback(() => {
        if (publishLoader2Open) return;
        if (optionalBShotsRunning) { pauseBShotWork(); return; }
        failedBShotRequestsRef.current.clear();
        bShotWorkGateRef.current.allowed = true;
        setOptionalBShotsRunning(true);
        setBShotWorkRevision(revision => revision + 1);
    }, [optionalBShotsRunning, pauseBShotWork, publishLoader2Open]);

    const cleanupSafetyAndReferenceMedia = useCallback(() => {
        // Closing must not turn unsaved intermediate uploads into unowned permanent files.
        // Actual image/video saves protect their confirmed metadata immediately.
        ProtectSavedMediaFromDeleteLater(persistedPlanMediaRef.current);
    }, []);

    const closeT = useCallback(() => {
        cleanupSafetyAndReferenceMedia();
        setTimeout(() => {
            setcallFeeds(true);
        }, 500);

        setTimeout(() => {
            Close();
        }, 1000);

        setTimeout(() => {
            // Save the current scroll position and last ID from your feed container
            const feedScrollPos = 0;
            const feedLastId = 0;

            // Prepare state to persist the feed's scroll position and last ID
            const routeState = {
                userId: loggedUser?.id,
            };

            console.log(
                `Navigating from ${location.pathname} with ScrollPos: ${feedScrollPos} and PageNum: ${feedLastId}  to profile `
            );

            navigate(`/pages`, {
                state: routeState,
            });

            /// Close();
        }, 500);
    }, [loggedUser, location, cleanupSafetyAndReferenceMedia]);


    /// AudioDb
    const saveToDatabase = useCallback(async (Data: any, urlvid: any) => {
        setisLoading(true);
        setLoadData("Saving..");

        Data.vidoriginal = "";

        console.log('data sent after music bg added to mp4', Data);
        return axios
            .put(`${CLIK_URL}/UpdatePostAudioMp4`, {
                values: Data,
            })
            .then((response) => {
                if (response) {
                    setisLoading(false);

                    setdbLoad(false);

                    setThumbGo(true);
                    cleanupSafetyAndReferenceMedia();

                    ///closeT();

                    //alert('Load Thumbnail');
                    return true;
                }
                return false;
            })
            .catch((error) => {
                setisLoading(false);

                console.log(error);
                return false;
            });
    }, [CLIK_URL, cleanupSafetyAndReferenceMedia]);

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const isCloudUrl = (url: any) => (
        typeof url === "string" &&
        /^https?:\/\//i.test(url) &&
        !url.startsWith("blob:")
    );

    const isUsableMediaUrl = (url: any) => (
        typeof url === "string" &&
        url.trim() !== "" &&
        url !== "EMPTY" &&
        url !== "EMPTY_BSHOT" &&
        url !== "ERROR"
    );

    const uploadAudioForLambdaIfNeeded = useCallback(async (audioUrl: string) => {
        if (!isUsableMediaUrl(audioUrl)) return null;
        if (isCloudUrl(audioUrl)) return audioUrl;

        const audioBlob = await fetch(audioUrl).then((r) => r.blob());
        const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);

        await axios.put(urlAudio, audioBlob, {
            headers: {
                "Content-Type": audioBlob.type || "audio/mpeg",
            },
        });

        return urlAudio.split("?")[0];
    }, []);

    const uploadVisualForLambdaIfNeeded = useCallback(async (mediaUrl: string, mediaType?: string) => {
        if (!isUsableMediaUrl(mediaUrl)) return null;
        if (isCloudUrl(mediaUrl)) return mediaUrl;

        const mediaBlob = await fetch(mediaUrl).then((r) => r.blob());
        const isVideoAsset = mediaType === "video" || mediaBlob.type.startsWith("video/");

        if (isVideoAsset) {
            const response: any = await axios.post(
                `${CLIK_URL}/get_signed_url_video`,
                { values: { count: 1 } },
                { withCredentials: true }
            );

            const signed = response.data?.holder?.[0];
            if (!signed?.urlVideo) {
                throw new Error("Missing signed URL for Lambda video upload.");
            }

            await axios.put(signed.urlVideo, mediaBlob, {
                headers: {
                    "Content-Type": mediaBlob.type || "video/mp4",
                    "Cache-Control": IMMUTABLE_VIDEO_CACHE_CONTROL,
                },
            });

            return signed.urlVideo.split("?")[0];
        }

        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_imageStory`,
            { values: { count: 1 } },
            { withCredentials: true }
        );

        const signed = response.data?.holder?.[0];
        if (!signed?.urlHD) {
            throw new Error("Missing signed URL for Lambda image upload.");
        }

        await axios.put(signed.urlHD, mediaBlob, {
            headers: {
                "Content-Type": mediaBlob.type || "image/png",
            },
        });

        return signed.urlHD.split("?")[0];
    }, [CLIK_URL]);

    const prepareLambdaRecipeForPublish = useCallback(async (recipe: any) => {
        // Persisting a template preview never makes it an output still. Direct
        // videos need no final image, but a required main slot needs real media.
        if (type !== 3 && !isStoryMusicVideoMode) for (let i = 0; i < steps.length; i++) {
            const recipeVideo = (recipe.scenes || []).some((scene: any) => (scene.visuals || []).some((visual: any) =>
                visual.role === 'a-shot' && visual.sourceIndex === i && visual.type === 'video' && isUsableMediaUrl(visual.url)));
            if (!recipeVideo && !isValidVideo(VideoArrayCloud?.[i]) && !isSceneImageFinal(i)) {
                throw new Error(`Scene ${i + 1} needs an image or video before publishing. Preview images are not final output.`);
            }
        }
        const uploadedAudioByIndex: Record<number, string> = {};
        const uploadedVisualByUrl: Record<string, string> = {};
        const narrationSourceIndices = new Set<number>();

        const uploadRecipeVisualUrl = async (mediaUrl: string, mediaType?: string) => {
            if (!isUsableMediaUrl(mediaUrl)) return mediaUrl;
            if (isCloudUrl(mediaUrl)) return mediaUrl;
            if (uploadedVisualByUrl[mediaUrl]) return uploadedVisualByUrl[mediaUrl];

            const uploadedUrl = await uploadVisualForLambdaIfNeeded(mediaUrl, mediaType);
            if (!uploadedUrl) {
                throw new Error(`Could not upload local visual asset for Lambda: ${mediaUrl}`);
            }

            uploadedVisualByUrl[mediaUrl] = uploadedUrl;
            return uploadedUrl;
        };

        (recipe.scenes || []).forEach((scene: any) => {
            const sourceIndex = scene?.narration?.sourceIndex;
            if (typeof sourceIndex === "number") {
                narrationSourceIndices.add(sourceIndex);
            }
        });

        for (let index = 0; index < generatedAudios.length; index++) {
            if (narrationSourceIndices.size > 0 && !narrationSourceIndices.has(index)) continue;

            const audioUrl = generatedAudios[index];
            if (!isUsableMediaUrl(audioUrl)) continue;

            const s3AudioUrl = await uploadAudioForLambdaIfNeeded(audioUrl);
            if (s3AudioUrl) {
                uploadedAudioByIndex[index] = s3AudioUrl;
            }
        }

        const nextScenes = [];
        for (const scene of recipe.scenes || []) {
            const nextVisuals = [];

            for (const visual of scene.visuals || []) {
                const uploadedUrl = await uploadRecipeVisualUrl(visual.url, visual.type);
                const uploadedFallbackImageUrl = isUsableMediaUrl(visual.fallbackImageUrl)
                    ? await uploadRecipeVisualUrl(visual.fallbackImageUrl, "image")
                    : visual.fallbackImageUrl;

                nextVisuals.push({
                    ...visual,
                    url: uploadedUrl,
                    fallbackImageUrl: uploadedFallbackImageUrl,
                });
            }

            nextScenes.push({
                ...scene,
                visuals: nextVisuals,
            });
        }

        const nextRecipe = {
            ...recipe,
            scenes: nextScenes.map((scene: any) => {
                if (!scene.narration) return scene;

                const sourceIndex = scene.narration.sourceIndex;
                const uploadedUrl = typeof sourceIndex === "number"
                    ? uploadedAudioByIndex[sourceIndex]
                    : null;

                return {
                    ...scene,
                    narration: {
                        ...scene.narration,
                        url: uploadedUrl || scene.narration.url
                    }
                };
            })
        };

        return {
            recipe: nextRecipe,
            s3AudioUrls: Object.keys(uploadedAudioByIndex)
                .sort((a, b) => Number(a) - Number(b))
                .map((key) => uploadedAudioByIndex[Number(key)]),
            s3VisualUrls: Object.keys(uploadedVisualByUrl).map((key) => uploadedVisualByUrl[key])
        };
    }, [generatedAudios, uploadAudioForLambdaIfNeeded, uploadVisualForLambdaIfNeeded, type, steps, VideoArrayCloud, isSceneImageFinal, isStoryMusicVideoMode]);

    const buildLambdaAudioDbData = useCallback((s3AudioUrls: string[]) => {
        const captionText = typeof EnhanceCaption === "object" && EnhanceCaption !== null
            ? (EnhanceCaption as any).text
            : (EnhanceCaption || "");

        return {
            postId: PostId,
            captionSummary: captionText || "cool",
            captionAudio: null,
            x1: s3AudioUrls[0] || null,
            x2: s3AudioUrls[1] || null,
            x3: s3AudioUrls[2] || null,
            x4: s3AudioUrls[3] || null,
            x5: s3AudioUrls[4] || null,
            x6: s3AudioUrls[5] || null,
            x7: s3AudioUrls[6] || null,
            x8: s3AudioUrls[7] || null,
            typex: s3AudioUrls.length > 0 ? 1 : 0,
        };
    }, [EnhanceCaption, PostId]);

    const startLambdaFfmpegPublish = useCallback(async (recipe: any) => {
        try {
            setLambdaPublishStatus({
                active: true,
                progress: 1,
                stage: "preparing",
                message: "Preparing media for Lambda render. Do not close this screen.",
                error: ""
            });

            const prepared = await prepareLambdaRecipeForPublish(recipe);

            console.group("=== STARTING LAMBDA FFMPEG PUBLISH ===");
            console.log("Prepared Lambda recipe:", prepared.recipe);
            console.log("S3 narration audios:", prepared.s3AudioUrls);
            console.log("S3 visual assets:", prepared.s3VisualUrls);
            console.groupEnd();

            setLambdaPublishStatus({
                active: true,
                progress: 3,
                stage: "queued",
                message: "Starting Lambda render job.",
                error: ""
            });

            const startResponse: any = await axios.post(`${CLIK_URL}/lambdaFfmpeg/start`, {
                recipe: prepared.recipe
            }, { withCredentials: true });

            const { jobId, statusBucket, statusKey } = startResponse.data;
            console.log("Lambda FFmpeg job started:", startResponse.data);

            for (let attempt = 0; attempt < 600; attempt++) {
                await wait(2000);

                const statusResponse: any = await axios.post(`${CLIK_URL}/lambdaFfmpeg/status`, {
                    statusBucket,
                    statusKey
                }, { withCredentials: true });

                const status = statusResponse.data;
                console.log("Lambda FFmpeg poll:", status);

                setLambdaPublishStatus({
                    active: true,
                    progress: Number(status.progress || 0),
                    stage: status.stage || "processing",
                    message: status.message || "Rendering video...",
                    error: status.state === "failed" ? (status.message || "Lambda render failed") : ""
                });

                if (status.state === "complete" && status.finalVideoUrl) {
                    const dataForDb = buildLambdaAudioDbData(prepared.s3AudioUrls);
                    dataForDb.videourl = status.finalVideoUrl;

                    setLambdaPublishStatus({
                        active: true,
                        progress: 100,
                        stage: "saving",
                        message: "Saving final video to database.",
                        error: ""
                    });

                    const saved = await saveToDatabase(dataForDb, status.finalVideoUrl);
                    if (!saved) throw new Error('Final video rendered, but saving the post failed.');
                    setPublishLoader2Open(false);
                    setLambdaPublishStatus({
                        active: false,
                        progress: 0,
                        stage: "",
                        message: "",
                        error: ""
                    });
                    return;
                }

                if (status.state === "failed") {
                    throw new Error(status.message || "Lambda render failed");
                }
            }

            throw new Error(`Lambda render timed out while polling job ${jobId}.`);
        } catch (error: any) {
            console.error("Lambda FFmpeg publish failed:", error);
            setLambdaPublishStatus({
                active: false,
                progress: 0,
                stage: "failed",
                message: error?.message || "Lambda render failed",
                error: error?.message || "Lambda render failed"
            });
        }
    }, [
        CLIK_URL,
        prepareLambdaRecipeForPublish,
        buildLambdaAudioDbData,
        saveToDatabase,
        setPublishLoader2Open
    ]);

    const publishGeneratedImagesFlux = useMemo(() => {
        const totalImages = Math.max(generatedImagesFlux?.length || 0, ImagesHdCloud?.length || 0);
        return Array.from({ length: totalImages }, (_, index) => {
            if (!isSceneImageFinal(index)) return '';
            const cloudImage = ImagesHdCloud?.[index];
            const candidate = isUsableMediaUrl(cloudImage) ? cloudImage : generatedImagesFlux?.[index] || "";
            return safetySceneSourceUrl(candidate, safetyImageSetsByTarget[`A:${index}`]);
        });
    }, [ImagesHdCloud, generatedImagesFlux, safetyImageSetsByTarget, isSceneImageFinal]);
    const publishBShotImages = useMemo(() => (bShotImages || []).map((row: any[], scene: number) =>
        (row || []).map((url: string, b: number) => hasFinalSceneImage({ hdImageUrl: url,
            nanoImageUrl: bShotNanoImages?.[scene]?.[b], quality: imageProvenanceRef.current.quality(url) })
            ? safetySceneSourceUrl(url, safetyImageSetsByTarget[`B:${scene}:${b}`]) : '')
    ), [bShotImages, bShotNanoImages, safetyImageSetsByTarget, imageMediaRevision]);

    const isUpscaledMediaUrl = useCallback((url: any) => (
        isUsableMediaUrl(url) && String(url).toLowerCase().includes("upscaled")
    ), []);

    const upscaledSceneRefs = useMemo(() => {
        const refs: Array<{ role: "a-shot" | "b-shot"; sourceIndex: number; bShotIndex?: number; url: string }> = [];
        const totalAShots = Math.max(ImagesHdCloud?.length || 0, generatedImagesFlux?.length || 0);

        for (let sourceIndex = 0; sourceIndex < totalAShots; sourceIndex++) {
            const imageUrl = ImagesHdCloud?.[sourceIndex] || generatedImagesFlux?.[sourceIndex];
            if (isUpscaledMediaUrl(imageUrl)) {
                refs.push({ role: "a-shot", sourceIndex, url: imageUrl });
            }
        }

        (bShotImages || []).forEach((sceneImages: string[] = [], sourceIndex: number) => {
            sceneImages.forEach((imageUrl: string, bShotIndex: number) => {
                if (isUpscaledMediaUrl(imageUrl)) {
                    refs.push({ role: "b-shot", sourceIndex, bShotIndex, url: imageUrl });
                }
            });
        });

        return refs;
    }, [ImagesHdCloud, generatedImagesFlux, bShotImages, isUpscaledMediaUrl]);

    const handleMusicVideoPublish = useCallback(() => {
        setActiveLoaderCallerChecker(false);
        setAutoStartPublishLoader2(true);
        setFinalPublishOpen(true);
    }, [setFinalPublishOpen]);

    const buildCurrentSpatialExperience = useCallback(() => buildSpatialExperience(
        spatialLinkOptions,
        spatialManifest.scenes,
        bShotSpatialScenes,
        spatialMotionContexts,
        bShotSpatialContexts,
    ), [spatialLinkOptions, spatialManifest.scenes, bShotSpatialScenes, spatialMotionContexts, bShotSpatialContexts]);

    const openSpatialPreview = useCallback(async () => {
        clearSpatialPreviewVerification();
        setPublishLoader2Open(false);
        try { setPreviewDocument(await hydrateSpatialExperience(CLIK_URL, Number(PostId), buildCurrentSpatialExperience())); }
        catch (error: any) { alert(error?.response?.data?.message || 'Could not load the latest spatial preview. Please try again.'); }
    }, [buildCurrentSpatialExperience, clearSpatialPreviewVerification, PostId]);

    const closeSpatialPreview = useCallback(() => {
        clearSpatialPreviewVerification();
        setPreviewDocument(null);
    }, [clearSpatialPreviewVerification]);

    const toggleSpatialPreviewVerification = useCallback(() => {
        if (spatialPreviewVerifying) {
            clearSpatialPreviewVerification();
            return;
        }
        setSpatialPreviewVerified(true);
        setSpatialPreviewVerifying(true);
        setFinalPublishOpen(true);
    }, [clearSpatialPreviewVerification, spatialPreviewVerifying, setFinalPublishOpen]);

    const lastSpatialPublication = useRef<{ postId: number; document: string } | null>(null);
    const prepareHotspotSearch = useCallback(() => ensureGameSearchMetadata(CLIK_URL, {
        postId: Number(PostId), kind: 'hotspots', context: String(prompt || ''),
    }), [PostId, prompt]);

    const publishSpatialExperience = useCallback(async () => {
        const postId = Number(PostId);
        if (!Number.isInteger(postId) || postId <= 0) throw new Error("A valid post is required before publishing.");
        const document = await hydrateSpatialExperience(CLIK_URL, postId, buildCurrentSpatialExperience());
        if (!document.entry || document.stages.length === 0) throw new Error("Create at least one spatial scene before publishing.");
        try {
            await ensureGameSearchMetadata(CLIK_URL, { postId, kind: 'spatial', context: String(prompt || '') });
        } catch {
            throw new Error('Could not save the game search details. Retry Publish to complete publication.');
        }
        const serializedDocument = JSON.stringify(document);
        if (lastSpatialPublication.current?.postId !== postId || lastSpatialPublication.current.document !== serializedDocument) {
            await axios.put(`${CLIK_URL}/spatial-experience/save`, {
                postId, spatialExperienceJson: serializedDocument,
            }, { withCredentials: true });
            lastSpatialPublication.current = { postId, document: serializedDocument };
        }

        // These assets are now referenced by the persisted spatial document,
        // so protect them from PromptInput's delayed temporary-media cleanup.
        const spatialImageUrls = document.stages.flatMap((stage) => [
            ...stage.scene.nodes.map((node) => node.frameUrl),
            stage.scene.ledger?.world.sourceImage,
            ...Object.values(stage.scene.ledger?.actionImageEdits || {}).flatMap(edit => [edit.original, edit.output]),
            ...Object.values(stage.scene.ledger?.routes || {}).flatMap(route => [route.forward.startAnchor, route.forward.endAnchor, route.backward?.startAnchor, route.backward?.endAnchor]),
            ...Object.values(stage.scene.ledger?.routes || {}).flatMap(route => [route.forward, route.backward].flatMap(animation => [animation?.motionEvidence?.diagram?.imageUrl, ...(animation?.motionEvidence?.frames.map(frame => frame.imageUrl) || [])])),
        ]);
        const spatialVideoUrls = document.stages.flatMap((stage) => [
            stage.videoUrl || null,
            ...stage.scene.connections.flatMap((connection) => [
                connection.forward?.videoUrl || null,
                connection.backward?.videoUrl || null,
            ]),
            ...Object.values(stage.scene.ledger?.routes || {}).flatMap(route => [route.forward.referenceVideo, route.backward?.referenceVideo]),
            ...(stage.scene.ledger?.jobs || []).flatMap(job => [job.output, job.upscale?.output, job.upscale?.original]),
        ]);
        ProtectSavedMediaFromDeleteLater(document);
        RemoveFromDeleteLater([...new Set(spatialImageUrls.filter(Boolean))]);
        RemoveVideoFromDeleteLater([...new Set(spatialVideoUrls.filter(Boolean))]);
        cleanupSafetyAndReferenceMedia();

        // Close PublishLoader2 before minimizing and leaving creation mode.
        setPublishLoader2Open(false);
        clearSpatialPreviewVerification();
        Close();
        setminimisePrompt(true);
        navigate("/pages", { state: { userId: loggedUser?.id } });
    }, [PostId, prompt, buildCurrentSpatialExperience, clearSpatialPreviewVerification, Close, setminimisePrompt, navigate, loggedUser, cleanupSafetyAndReferenceMedia]);

    const creationDeckEnabled = useCreationDeckEnabled();
    const [deckModeDestination, setDeckModeDestination] = useState<number | null>(null);
    const deckModeStep = useRef<string | null>(null);
    const deckModeDialogOpened = useRef(false);
    const currentStoryboardMode = isBShotModeActive ? 2 : VideMode ? 1 : 0;
    const [visitedDeckStage, setVisitedDeckStage] = useState({ projectId: creationProjectId, mode: currentStoryboardMode });
    const furthestDeckStage = visitedDeckStage.projectId === creationProjectId
        ? Math.max(visitedDeckStage.mode, currentStoryboardMode) : currentStoryboardMode;
    useEffect(() => {
        if (visitedDeckStage.projectId !== creationProjectId || visitedDeckStage.mode !== furthestDeckStage) {
            setVisitedDeckStage({ projectId: creationProjectId, mode: furthestDeckStage });
        }
    }, [creationProjectId, furthestDeckStage, visitedDeckStage]);
    const [deckBShotOptions, setDeckBShotOptions] = useState<string | null>(null);
    const sceneDeckKey = (index: number, bIndex?: number | null) => bIndex == null ? `A:${index}` : `B:${index}:${bIndex}`;
    const deckSlots = unifiedIndexMap.filter(slot => slot.type === 'A' || isBShotModeActive);
    const openSceneWorkstation = (index: number, bIndex: number | null = null) => {
        setactiveEdit(index);
        setActiveBShotEdit(bIndex);
        setstartEdit(true);
    };
    const foregroundStoryboard = !creationDeckCovered && Boolean(steps?.length);
    const wasForegroundStoryboard = useRef(foregroundStoryboard);
    const deckHistory = useCreationDeckHistory({
        enabled: creationDeckEnabled,
        active: foregroundStoryboard,
        initiallyOpen: creationDeckPreferred,
        escapeBlocked: promptPreviewIndex !== null || deckBShotOptions !== null || showVoices || showNodeMap || showWorldModel2
            || open || isAudioGenerating || activeLoaderCallerChecker || publishLoader2Open || Boolean(previewDocument)
            || showBShotResetWarning || showBShotTimeChangeWarning,
        onRestoreWorkstation: sceneKey => {
            const slot = deckSlots.find(item => sceneDeckKey(item.index, item.bIndex) === sceneKey);
            if (slot) openSceneWorkstation(slot.index, slot.bIndex);
        },
        onCloseWorkstation: () => setstartEdit(false),
        onRevealGrid: sceneKey => {
            const targetKey = promptPreviewIndex !== null ? sceneDeckKey(promptPreviewIndex) : deckBShotOptions ?? sceneKey;
            if (!targetKey) return;
            requestAnimationFrame(() => stripRef.current?.querySelector(`[data-creation-scene-key="${targetKey}"]`)
                ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
        },
    });
    const canShowStoryboardDeck = foregroundStoryboard && deckHistory.deckOpen && !startEdit && !showVoices && !showNodeMap && !open && !isAudioGenerating
        && !showWorldModel2 && !previewDocument && !ThumbGo
        && !showBShotResetWarning && !showBShotTimeChangeWarning;
    const studioSelectorInDeck = canShowStoryboardDeck && activeLoaderCallerChecker && !musicMode && !publishLoader2Open;
    const publishReviewInDeck = canShowStoryboardDeck && publishLoader2Open && type !== 3;
    const deckVisible = canShowStoryboardDeck && ((!activeLoaderCallerChecker && !publishLoader2Open) || studioSelectorInDeck || publishReviewInDeck);
    const storyboardCovered = deckVisible || creationImaginationCovered;
    const [deckDetailHost, setDeckDetailHost] = useState<HTMLDivElement | null>(null);
    const deckActiveSlot = deckSlots.find(slot => sceneDeckKey(slot.index, slot.bIndex) === deckHistory.sceneKey) ?? deckSlots[0];
    const deckSceneKey = deckActiveSlot ? sceneDeckKey(deckActiveSlot.index, deckActiveSlot.bIndex) : undefined;
    useLayoutEffect(() => {
        if (foregroundStoryboard && !wasForegroundStoryboard.current && !startEdit) {
            if (creationDeckPreferred) deckHistory.openDeck(deckSceneKey);
            else deckHistory.closeDeck();
        }
        wasForegroundStoryboard.current = foregroundStoryboard;
    }, [foregroundStoryboard, creationDeckPreferred, startEdit, deckSceneKey]);
    const reopenDeckWhenForeground = useRef(false);
    useLayoutEffect(() => {
        if (foregroundStoryboard && reopenDeckWhenForeground.current) {
            reopenDeckWhenForeground.current = false;
            deckHistory.openDeck(deckSceneKey);
        }
    }, [foregroundStoryboard, deckSceneKey]);
    const currentDeckHistory = useRef(deckHistory);
    currentDeckHistory.current = deckHistory;
    const setStoryboardWorkstationOpen = useCallback((next: boolean) => {
        if (!next && currentDeckHistory.current.workstationOpen) currentDeckHistory.current.closeWorkstation();
        else setstartEdit(next);
    }, []);
    const enterSceneFromGrid = (index: number, bIndex: number | null = null) => {
        if (creationDeckEnabled && foregroundStoryboard) deckHistory.openDeck(sceneDeckKey(index, bIndex));
        else openSceneWorkstation(index, bIndex);
    };
    const gridSceneEntryBinding = (key: string, target: SceneTarget) => cb('storybook_grid', key,
        `Open ${displayLabel(target)} in ${creationDeckEnabled ? 'Creation Deck' : 'the workstation'}`,
        creationDeckEnabled ? 'enterSceneFromGrid/openDeck' : 'setstartEdit');
    const closeScenePreview = () => {
        setPendingSceneDeleteIndex(null);
        setPromptPreviewIndex(null);
        setPendingDelete(null);
        setDeckBShotOptions(null);
    };
    const showScenePreview = (index: number) => {
        setPromptPreviewIndex(index);
        setHideExpandedSceneText(false);
    };
    const openSceneText = (index: number) => {
        if (isInteractionMode) { setShowNodeMap(true); return; }
        showScenePreview(index);
    };
    const stepBackStoryboard = () => {
        if (isBShotModeActive) { setIsBShotModeActive(false); setVideMode(true); setnarrate(2); }
        else if (VideMode) { setVideMode(false); setnarrate(0); }
        else onBackToInitial();
    };
    const publishStoryboard = () => {
        if (isSpatialInteraction) { openSpatialPreview(); return; }
        setAutoStartPublishLoader2(false);
        setFinalPublishOpen(true);
    };
    const stepNextStoryboard = () => {
        if (VideMode) { setActiveLoaderCallerChecker(true); return; }
        if (type === 0 && generatedImagesFlux.length <= 1) { void continueSingleImage(); return; }
        if (type !== 0 || activatevoicenarration) setGeneratedAudios([]);
        uploadAllImagesToS3();
        setHideSave(true);
    };
    const backStoryboard = () => { setDeckModeDestination(null); stepBackStoryboard(); };
    const nextStoryboard = () => { setDeckModeDestination(null); stepNextStoryboard(); };
    const modeActions = useRef({ back: stepBackStoryboard, next: stepNextStoryboard });
    modeActions.current = { back: stepBackStoryboard, next: stepNextStoryboard };
    useEffect(() => {
        if (deckModeDestination === null) return;
        if (!creationDeckEnabled || !foregroundStoryboard || !deckHistory.deckOpen || startEdit || currentStoryboardMode === deckModeDestination) {
            setDeckModeDestination(null);
            return;
        }
        if (activeLoaderCallerChecker) { deckModeDialogOpened.current = true; return; }
        if (deckModeDialogOpened.current) { setDeckModeDestination(null); return; }
        const movingBack = currentStoryboardMode > deckModeDestination;
        if (isLoading || anyGenerating || (!movingBack && (Continue || !Done || HideSave))) return;
        const stepKey = `${currentStoryboardMode}:${deckModeDestination}`;
        if (deckModeStep.current === stepKey) return;
        const timer = setTimeout(() => {
            deckModeStep.current = stepKey;
            if (movingBack) modeActions.current.back();
            else modeActions.current.next();
        }, 300);
        return () => clearTimeout(timer);
    }, [deckModeDestination, creationDeckEnabled, foregroundStoryboard, deckHistory.deckOpen, startEdit, currentStoryboardMode,
        activeLoaderCallerChecker, isLoading, anyGenerating, Continue, Done, HideSave]);
    const openStoryboardMusic = () => {
        if (!(steps.length === 1 && (type === 0 || type === 3))) setShowVoices(true);
    };
    const backStoryboardBinding = Continue
        ? cb('storybook_start', 'back', 'Return to Skip or Create Characters choice', 'onBackToInitial')
        : cb('storybook_grid', 'back', 'Go back one storyboard mode', 'onBackToInitial/setVideMode/setIsBShotModeActive');
    const publishStoryboardBinding = cb('storybook_grid', 'publish', isSpatialInteraction ? 'Preview spatial experience; does not publish' : 'Open final publish review', isSpatialInteraction ? 'openSpatialPreview' : 'setFinalPublishOpen', 'click', isSpatialInteraction ? 'candidate' : 'needs_confirmation');
    const nextStoryboardBinding = cb('storybook_grid', VideMode ? 'next_videos' : 'continue_images', VideMode ? (musicMode ? 'Debut: open music-video studio selector' : 'Next: open studio selector from video grid') : 'Continue from image grid to video grid', 'uploadAllImagesToS3/setActiveLoaderCallerChecker');
    const musicStoryboardBinding = cb('storybook_grid', 'music', 'Open storyboard background music or voice selection', 'setShowVoices');

    useCreationControls('storybook_start', 'Storybook', Continue && !startEdit, {
        stage: 'image_start', estimatedPixels: price4all, selectedImageModel: getCreationImageModelName(String(modelz || '')),
        previewCount: nanoImages?.filter(Boolean).length || 0,
    });
    useCreationControls('storybook_grid', 'Storybook', !Continue && !startEdit, {
        stage: isBShotModeActive ? 'bshot_grid' : VideMode ? 'video_grid' : 'image_grid',
        mode: type === 0 ? 'Shorts' : type === 1 ? 'Cinema' : type === 3 ? 'Games' : 'Create',
        interactionExperienceMode: type === 3 ? interactionExperienceMode : null,
        musicVideoMode: isStoryMusicVideoMode,
        musicTrackName: isStoryMusicVideoMode ? musicModeName : undefined,
        musicBreakerSec: isStoryMusicVideoMode ? musicBreakerSec : undefined,
        logicalSceneCount: type === 1 ? Math.ceil((steps?.length || 0) / 2) : steps?.length || 0,
        sceneCount: steps?.length || 0, selectedImageModel: getCreationImageModelName(String(modelz || '')),
        displaySceneCount: sceneDisplayMap.count, sceneDisplayRevision: sceneDisplayMap.revision,
        selectedVideoModel: String(SelectedModel || ''), autoOn: autoImageRunnerOn,
        remainingHdImages: pendingPrimaryImages + (narrationRequiresBShots ? pendingBShotImages : 0),
        remainingPrimaryImages: pendingPrimaryImages, remainingBShotImages: pendingBShotImages,
        primaryShotCount: primarySlotCount, bShotSlotCount,
        primaryImagesReady: primarySlotCount - pendingPrimaryImages,
        bShotImagesReady: bShotSlotCount - pendingBShotImages,
        primaryVideosReady, bShotVideosReady,
        bshotsRequired: narrationRequiresBShots, bshotsOptional: !narrationRequiresBShots,
        previewOpen: promptPreviewIndex !== null,
        ...(creationDeckEnabled && deckModeDestination !== null ? { deckModeDestination } : {}),
        ...(creationDeckEnabled ? { storyboardView: storyboardCovered ? 'deck' : 'grid', ...(deckVisible && deckSceneKey ? { deckSceneKey } : {}) } : {}),
        bshotSlots: (bShotPrompts || []).reduce((count: number, row: string[]) => count + (row?.length || 0), 0),
        narrationOn: Boolean(activatevoicenarration), clipSeconds: Number(time) || 0,
    });
    useCreationControls('storybook_preview', 'Storybook', (promptPreviewIndex !== null || deckBShotOptions !== null) && !startEdit, {
        sceneNumber: promptPreviewIndex === null ? 0 : promptPreviewIndex + 1,
        bshotKey: deckBShotOptions,
        expanded: hideExpandedSceneText,
    });
    useCreationControls('storybook_narration_progress', 'Storybook', isAudioGenerating, {
        generating: audioSceneStatuses.some((item: any) => item.status === 'generating'),
        readyCount: audioSceneStatuses.filter((item: any) => item.status === 'success').length,
        sceneCount: audioSceneStatuses.length,
    });
    useCreationControls('storybook_bshot_warning', 'Storybook', showBShotResetWarning || showBShotTimeChangeWarning, {
        reason: showBShotResetWarning ? 'narration_change' : 'clip_length_change',
        previousClipSeconds: bShotBuiltWithTime || 0, currentClipSeconds: Number(time) || 0,
    });
    useCreationControls('storybook_spatial_preview', 'Storybook', !!previewDocument, {
        stageCount: previewDocument?.stages?.length || 0,
        verifying: spatialPreviewVerifying,
        verified: spatialPreviewVerified,
    });
    const sceneDeleteConfirmation = pendingSceneDeleteIndex !== null && (() => {
        // Music-mode gating: segments are formula-owned
        // (NotepadEditor: ceil(songDuration / (breaker * 2))),
        // so musicSegments.length IS the required scene count.
        const currentLogical = Math.ceil((steps?.length || 0) / 2);
        const requiredLogical = Array.isArray(musicSegments) ? musicSegments.length : 0;
        const musicDeleteBlocked = isStoryMusicVideoMode && requiredLogical > 0 && currentLogical <= requiredLogical;
        const logicalSceneNum = (type === 1 ? Math.floor(pendingSceneDeleteIndex / 2) : pendingSceneDeleteIndex) + 1;
        return (
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    position: 'fixed', inset: 0, zIndex: 999999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)'
                }}
            >
                <Box sx={{
                    maxWidth: 360, width: '85%', p: 3, borderRadius: '16px',
                    background: 'rgba(20,20,20,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    textAlign: 'center'
                }}>
                    {musicDeleteBlocked
                        ? <WarningAmberIcon sx={{ color: '#ffb300', fontSize: 36, mb: 1 }} />
                        : <DeleteOutlineIcon sx={{ color: '#ff5252', fontSize: 36, mb: 1 }} />}
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', mb: 0.5 }}>
                        {musicDeleteBlocked
                            ? "This Scene Can't Be Deleted"
                            : `Delete Scene ${logicalSceneNum}?`}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', mb: 2.5 }}>
                        {musicDeleteBlocked
                            ? `This scene is needed to match the song length. Music mode calculated ${requiredLogical} scene${requiredLogical === 1 ? '' : 's'} from your song and ${musicBreakerSec}s breaker. Delete is only available for extra AI-generated scenes.`
                            : isStoryMusicVideoMode
                                ? `Music mode detected an extra scene beyond the ${requiredLogical} calculated from your song. Deleting removes both visual slots (Stage A / Stage B) and keeps the song timeline at the calculated length. This can't be undone.`
                                : type === 1
                                    ? "Story mode uses two visual slots per scene: Stage A and Stage B. Deleting this scene removes both visual slots, plus its narration, image, video, and audio. This can't be undone."
                                    : "This removes the scene's prompt, image, video, and audio. This can't be undone."}
                    </Typography>
                    {musicDeleteBlocked ? (
                        <Button
                            {...cb('storybook_preview', 'dismiss_delete_blocked', 'Keep required music-timed scene', 'setPendingSceneDeleteIndex')}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPendingSceneDeleteIndex(null);
                            }}
                            sx={{
                                width: '100%', borderRadius: '10px', textTransform: 'none', fontWeight: 700,
                                color: '#fff', background: 'rgba(255,255,255,0.1)',
                                '&:hover': { background: 'rgba(255,255,255,0.2)' }
                            }}
                        >
                            Got it
                        </Button>
                    ) : (
                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
                            <Button
                                {...cb('storybook_preview', 'cancel_delete_scene', 'Keep this scene', 'setPendingSceneDeleteIndex')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingSceneDeleteIndex(null);
                                }}
                                sx={{
                                    flex: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 700,
                                    color: '#fff', background: 'rgba(255,255,255,0.1)',
                                    '&:hover': { background: 'rgba(255,255,255,0.2)' }
                                }}
                            >
                                No
                            </Button>
                            <Button
                                {...cb('storybook_preview', 'confirm_delete_scene', 'Delete this scene and its linked media', 'deleteSceneEverywhere', 'click', 'needs_confirmation')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSceneEverywhere(pendingSceneDeleteIndex);
                                }}
                                sx={{
                                    flex: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 700,
                                    color: '#fff', background: '#c62828',
                                    '&:hover': { background: '#e53935' }
                                }}
                            >
                                Yes, delete
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        );
    })();
    const draftSavedPill = draftSaveNotice ? (
        <Box key={draftSaveNotice} role="status" aria-live="polite" data-draft-save-notice
            sx={{ ...appColorHintPillSx(appColor, darkModeReducer), zIndex: 1000002, transform: 'translateX(-50%)',
                animation: draftSaveNotice === 'saving' ? 'none' : `${appColorPillFloatAndFade} 3.95s cubic-bezier(.22,.8,.28,1) forwards` }}>
            {draftSaveNotice === 'saving' ? 'Saving draft…' : 'Draft saved'}
        </Box>
    ) : null;
    const bShotOptionsSlot = deckSlots.find(slot => sceneDeckKey(slot.index, slot.bIndex) === deckBShotOptions);
    const deckDetailIndex = promptPreviewIndex ?? bShotOptionsSlot?.index;
    const deckDetailSlot = bShotOptionsSlot ?? (deckDetailIndex == null ? undefined : deckSlots.find(slot => slot.type === 'A' && slot.index === deckDetailIndex));
    const deckMediaForSlot = (slot: typeof unifiedIndexMap[number]) => {
        const index = slot.originalIndex;
        const previewImage = [unifiedGeneratedImagesFlux[index], unifiedImagesHdCloud[index], unifiedNanoImages[index],
            slot.type === 'A' ? generatedImages?.[slot.index] : null].find(isValidVideo);
        const previewVideo = [unifiedVideoArrayCloud[index], unifiedVideoArray[index]].find(isValidVideo);
        return { image: previewImage, video: VideMode || isBShotModeActive ? previewVideo : undefined,
            isPreview: Boolean(previewImage && !previewVideo && isUnifiedSlotEmpty(index)) };
    };
    const deckDetailImage = deckDetailSlot && deckMediaForSlot(deckDetailSlot).image;
    const deckBShotSuffix = bShotOptionsSlot?.bIndex == null ? null : `${bShotOptionsSlot.index + 1}_${bShotOptionsSlot.bIndex + 1}`;
    const deckBShotCanDelete = Boolean(deckDetailSlot?.type === 'B' && deckMediaForSlot(deckDetailSlot).video);
    const deckDetail = deckDetailIndex != null && deckDetailSlot ? (
        <div className={`creation-deck-scene-detail${deckDetailImage ? ' creation-deck-scene-detail--media' : ''}${hideExpandedSceneText ? ' creation-deck-scene-detail--expanded' : ''}`}
            {...(deckDetailImage && !bShotOptionsSlot ? cb('storybook_preview', `toggle_scene_${deckDetailIndex + 1}`, 'Switch scene image and text', 'setHideExpandedSceneText') : {})}
            onClick={() => { if (deckDetailImage) setHideExpandedSceneText(!hideExpandedSceneText); }}>
            {deckDetailImage && <img className="creation-deck-scene-detail-img" src={deckDetailImage} alt={`${displayLabel(deckDetailSlot)} preview`} draggable={false} />}
            {deckDetailImage && hideExpandedSceneText && !bShotOptionsSlot && <button type="button" className="deck-glass-button creation-deck-circle creation-deck-scene-detail-delete"
                aria-label="Delete scene" {...cb('storybook_preview', `delete_scene_${deckDetailIndex + 1}`, `Review deleting scene ${deckDetailIndex + 1}; does not delete`, 'setPendingSceneDeleteIndex')}
                onClick={event => { event.stopPropagation(); setPendingSceneDeleteIndex(deckDetailIndex); }}><DeleteOutlineIcon /></button>}
            {bShotOptionsSlot && deckBShotSuffix && deckBShotCanDelete && <button type="button" className="deck-glass-button creation-deck-circle creation-deck-scene-detail-delete"
                aria-label="Delete B-roll media" {...cb('storybook_grid', `request_delete_bshot_${deckBShotSuffix}`, 'Request deletion of B-roll media', 'setPendingDelete')}
                onClick={event => { event.stopPropagation(); setPendingDelete({ index: bShotOptionsSlot.index, bIndex: bShotOptionsSlot.bIndex, type: 'bshot' }); }}><DeleteOutlineIcon /></button>}
            <div className="creation-deck-scene-detail-overlay">
                {(!deckDetailImage || hideExpandedSceneText) && <h2>{bShotOptionsSlot ? displayLabel(deckDetailSlot) : `Scene ${deckDetailIndex + 1}`}</h2>}
                <p>{bShotOptionsSlot ? unifiedGeneratedText[bShotOptionsSlot.originalIndex] : getScenePopupText(deckDetailIndex)}</p>
                {bShotOptionsSlot && deckBShotSuffix && pendingDelete?.type === 'bshot' && pendingDelete.index === bShotOptionsSlot.index && pendingDelete.bIndex === bShotOptionsSlot.bIndex && (
                    <div className="creation-deck-scene-detail-confirm" role="group" aria-label="Confirm B-roll media deletion" onClick={event => event.stopPropagation()}>
                        <p>Delete video and images?</p>
                        <div className="creation-deck-scene-detail-confirm-actions">
                            <button type="button" className="deck-glass-button creation-deck-primary" {...cb('storybook_grid', `cancel_delete_bshot_${deckBShotSuffix}`, 'Keep B-roll media', 'setPendingDelete')} onClick={() => setPendingDelete(null)}>No</button>
                            <button type="button" className="deck-glass-button creation-deck-primary" {...cb('storybook_grid', `confirm_delete_bshot_${deckBShotSuffix}`, 'Delete B-roll media', 'confirmDelete', 'click', 'needs_confirmation')} onClick={confirmDelete}>Yes, delete</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    ) : undefined;
    useEffect(() => {
        if (!deckVisible || !deckDetail) return;
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented || pendingSceneDeleteIndex !== null) return;
            if (pendingDelete) setPendingDelete(null);
            else closeScenePreview();
            event.preventDefault();
        };
        window.addEventListener('keydown', onEscape);
        return () => window.removeEventListener('keydown', onEscape);
    }, [deckVisible, deckDetailIndex, deckBShotOptions, pendingDelete, pendingSceneDeleteIndex]);
    useEffect(() => {
        if (deckVisible || promptPreviewIndex === null) return;
        let attempts = 0;
        const scrollInterval = setInterval(() => {
            const target = sceneElementsRef.current[promptPreviewIndex];
            if (target) {
                target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
                attempts++;
                if (attempts > 5) clearInterval(scrollInterval);
            } else clearInterval(scrollInterval);
        }, 50);
        return () => clearInterval(scrollInterval);
    }, [deckVisible, promptPreviewIndex]);
    const deckCurrentImage = deckActiveSlot && deckMediaForSlot(deckActiveSlot).image;
    const deckCurrentVideo = deckActiveSlot && deckMediaForSlot(deckActiveSlot).video;
    const deckBShotHasImage = deckActiveSlot?.type === 'B' && isValidVideo(bShotImages?.[deckActiveSlot.index]?.[deckActiveSlot.bIndex ?? 0]);
    const deckMotionAvailable = Boolean(!Continue && Donex && VideMode && deckActiveSlot
        && !(unifiedLoaders[deckActiveSlot.originalIndex] > 0)
        && (deckActiveSlot.type === 'A' ? !isGenerating?.[deckActiveSlot.index]
            : (deckBShotHasImage || deckCurrentVideo) && !isBShotGenerating?.[deckActiveSlot.index]?.[deckActiveSlot.bIndex ?? 0]));
    const deckOpenKey = deckActiveSlot?.type === 'B'
        ? `${deckCurrentImage || deckCurrentVideo ? 'open_bshot' : 'add_bshot'}_${deckActiveSlot.index + 1}_${(deckActiveSlot.bIndex ?? 0) + 1}`
        : `${deckMotionAvailable ? 'open_motion' : deckCurrentImage ? 'open_scene' : 'edit_scene'}_${(deckActiveSlot?.index ?? 0) + 1}`;
    const renderOptionalBShotsButton = (index: number, bIndex: number) => (
        <Button
            {...cb('storybook_grid', `${optionalBShotsRunning ? 'stop_bshots' : 'start_bshots'}_${index + 1}_${bIndex + 1}`, optionalBShotsRunning ? 'Pause shared B-roll creation' : 'Start missing B-roll', 'toggleOptionalBShots')}
            variant="contained"
            aria-busy={optionalBShotsRunning}
            disabled={publishLoader2Open}
            onClick={(event) => { event.stopPropagation(); toggleOptionalBShots(); }}
            sx={{ bgcolor: appColor, color: darkModeReducer ? '#000' : '#fff', borderRadius: '24px', px: 2,
                ...(optionalBShotsRunning ? {
                    backgroundImage: `linear-gradient(110deg, ${appColor} 25%, ${darken(appColor, .3)} 45%, ${appColor} 65%)`,
                    backgroundSize: '250% 100%', animation: 'bShotPreparing 1.3s linear infinite',
                    '@keyframes bShotPreparing': { from: { backgroundPosition: '120% 0' }, to: { backgroundPosition: '-120% 0' } },
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                } : {}),
                '&:hover': { bgcolor: darken(appColor, 0.15) } }}
        >
            {optionalBShotsRunning ? 'Stop B-roll' : 'Start B-roll'}
        </Button>
    );
    const deckOpenBinding = deckActiveSlot
        ? cb('storybook_grid', deckOpenKey, `Open ${displayLabel(deckActiveSlot)} in the workstation`, 'setstartEdit')
        : undefined;
    const deckClose = () => {
        reopenDeckWhenForeground.current = false;
        deckHistory.closeDeck();
    };
    const closePublishReview = () => {
        setAutoStartPublishLoader2(false);
        setPublishLoader2Open(false);
        if (isSpatialInteraction) clearSpatialPreviewVerification();
    };
    const deckPanelOpen = studioSelectorInDeck || publishReviewInDeck;
    const deckPanelCloseDisabled = studioSelectorInDeck ? isLoading : publishReviewInDeck && lambdaPublishStatus.active;
    const primaryLabel = isBShotModeActive ? (isSpatialInteraction ? 'Preview' : 'Publish')
        : HaltPublish ? 'Use Images' : VideMode ? (musicMode ? 'Debut' : 'Next') : 'Continue';
    const renderPreparingPrompt = (bottom = 12) => (
        <Box role="status" aria-live="polite" sx={{
            position: 'absolute', bottom, left: 12, right: 12, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            py: 1, borderRadius: 2, background: 'rgba(0,0,0,0.72)', color: '#fff',
            pointerEvents: 'none',
        }}>
            <CircularProgress size={16} color="inherit" />
            <Typography variant="body2">Preparing Prompt…</Typography>
        </Box>
    );
    const storyboardDeck = deckVisible ? (
        <CreationDeck title={Continue ? 'Storyboard' : isBShotModeActive ? 'B-roll' : VideMode ? 'Video' : 'Images'}
            cards={deckSlots.map(slot => {
                const scene = sceneDisplayForTarget(sceneDisplayMap.entries, slot);
                const sceneNumber = scene?.displaySceneNumber;
                const progress = unifiedLoaders[slot.originalIndex] ?? 0;
                const preparingPrompt = VideMode && Boolean(loadPrompt[slot.originalIndex]);
                return { id: sceneDeckKey(slot.index, slot.bIndex), title: displayLabel(slot), sceneNumber: sceneNumber ?? undefined,
                    workstationAvailable: !Continue && (Donex || slot.type === 'B'),
                    sceneLabel: sceneNumber ? `Scene ${sceneNumber}` : 'B-roll',
                    sceneRelationships: scene ? [
                        scene.type === 'B' ? `B-roll for Scene ${scene.parentDisplaySceneNumber ?? scene.nativeSlotNumber}` : scene.displayRole,
                        ...(scene.cinemaStage ? [scene.cinemaStage] : []),
                    ] : undefined,
                    loader: progress > 0 || preparingPrompt ? <>
                        {progress > 0 && <GlowWidthBar value={progress} matchMobile={matchMobile} />}
                        {preparingPrompt && renderPreparingPrompt(62)}
                    </> : undefined,
                    ...deckMediaForSlot(slot), text: slot.type === 'B' ? unifiedGeneratedText[slot.originalIndex] : getScenePopupText(slot.index) };
            })}
            activeId={deckSceneKey} onSelect={sceneKey => {
                deckHistory.selectScene(sceneKey);
                if (promptPreviewIndex !== null || deckBShotOptions !== null) {
                    const nextSlot = deckSlots.find(slot => sceneDeckKey(slot.index, slot.bIndex) === sceneKey);
                    if (nextSlot) {
                        if (nextSlot.type === 'B') {
                            setPromptPreviewIndex(null);
                            setDeckBShotOptions(sceneKey);
                        } else {
                            setDeckBShotOptions(null);
                            setPromptPreviewIndex(nextSlot.index);
                        }
                    }
                }
            }}
            onClose={deckPanelCloseDisabled ? () => {} : studioSelectorInDeck ? () => setActiveLoaderCallerChecker(false) : publishReviewInDeck ? closePublishReview : deckClose}
            closeLabel={studioSelectorInDeck ? 'Close studio setup' : publishReviewInDeck ? 'Close final publish review' : undefined}
            closeBinding={deckPanelOpen ? cb('deck_view', 'close', studioSelectorInDeck ? 'Close studio setup' : 'Close final publish review', 'closeStoryboardDeckPanel') : undefined}
            closeDisabled={deckPanelCloseDisabled} foregroundPanel={deckPanelOpen}
            statusText={isLoading ? LoadData : draftSaveNotice === 'saving' ? 'Saving draft…' : draftSaveNotice === 'saved' ? 'Draft saved' : undefined}
            statusBusy={isLoading || draftSaveNotice === 'saving'}
            transitionLabel={deckModeDestination === null ? undefined : ['Images', 'Video', 'B-roll'][currentStoryboardMode]}
            onOpen={!Continue && deckActiveSlot && (Donex || deckActiveSlot.type === 'B') ? deckHistory.openWorkstation : undefined}
            onOpenSceneFromSettings={!Continue ? sceneKey => deckHistory.openWorkstation(sceneKey, true) : undefined}
            openBinding={deckMotionAvailable ? undefined : deckOpenBinding}
            activeCardAction={Continue ? (
                <button type="button" className="creation-deck-start-cost" onClick={ContinueGen}>
                    {price4all.toLocaleString()} {price4all === 1 ? 'Pixel' : 'Pixels'}
                </button>
            ) : deckMotionAvailable && deckSceneKey ? (
                <button type="button" className="deck-glass-button" {...deckOpenBinding}
                    onClick={() => deckHistory.openWorkstation(deckSceneKey)}>{deckCurrentVideo ? 'Open video' : 'Create motion'}</button>
            ) : !Continue && deckActiveSlot?.type === 'B' && !deckCurrentImage && !deckCurrentVideo && !automaticNarrationBShots
                ? renderOptionalBShotsButton(deckActiveSlot.index, deckActiveSlot.bIndex ?? 0) : undefined}
            onOptions={!Continue && deckActiveSlot ? () => {
                if (deckActiveSlot.type === 'B') {
                    setDeckBShotOptions(deckSceneKey ?? null);
                    setHideExpandedSceneText(false);
                } else openSceneText(deckActiveSlot.index);
            } : undefined}
            optionsBinding={deckActiveSlot?.type === 'A' ? cb('storybook_grid', `read_scene_${deckActiveSlot.index + 1}`, `Read ${displayLabel(deckActiveSlot)} text`, 'setPromptPreviewIndex') : undefined}
            detail={deckPanelOpen ? <div ref={setDeckDetailHost} /> : deckDetail}
            browsableDetail={!deckPanelOpen && Boolean(deckDetail)}
            renderCardDetail={cardEntry => {
                const slot = deckSlots.find(item => sceneDeckKey(item.index, item.bIndex) === cardEntry.id);
                if (!slot) return null;
                const media = deckMediaForSlot(slot);
                const text = slot.type === 'B' ? unifiedGeneratedText[slot.originalIndex] : getScenePopupText(slot.index);
                return (
                    <div className={`creation-deck-scene-detail${media.image ? ' creation-deck-scene-detail--media' : ''}${hideExpandedSceneText ? ' creation-deck-scene-detail--expanded' : ''}`}>
                        {media.image && <img className="creation-deck-scene-detail-img" src={media.image} alt="" draggable={false} />}
                        <div className="creation-deck-scene-detail-overlay">
                            {(!media.image || hideExpandedSceneText) && <h2>{slot.type === 'B' ? displayLabel(slot) : `Scene ${slot.index + 1}`}</h2>}
                            <p>{text}</p>
                        </div>
                    </div>
                );
            }}
            onCloseDetail={deckPanelOpen ? undefined : closeScenePreview}
            closeDetailBinding={cb('storybook_preview', 'close', 'Close scene text preview', 'setPromptPreviewIndex')}
            slideshow={!Continue}
            settings={<>
                {!Continue && !deckDetail && pendingSceneDeleteIndex === null && !pendingDelete && !isLoading && !anyGenerating &&
                    ['Images', 'Video', 'B-roll'].map((label, mode) => mode !== currentStoryboardMode && mode <= furthestDeckStage &&
                    (mode < currentStoryboardMode || (Done && !HideSave)) && <button type="button" key={label}
                    {...cb('storybook_grid', `deck_mode_${mode}`, `Navigate to ${label} through the existing storyboard steps`, 'backStoryboard/nextStoryboard')}
                    onClick={() => { deckModeStep.current = null; deckModeDialogOpened.current = false; setDeckModeDestination(mode); }}>{label}</button>)}
                {onCreationDeckModels && <button type="button" {...cb('storybook_toolbar', 'open_models', 'Open model selection menu', 'setOpen(true)')}
                    onClick={onCreationDeckModels}>{getCreationImageModelName(modelz)}</button>}
                {onCreationDeckCharacters && <button type="button" {...cb('character_entry', 'open', 'Open Characters studio', 'openCharacterStudio')}
                    onClick={() => onCreationDeckCharacters(deckClose, () => { reopenDeckWhenForeground.current = true; })}>Characters</button>}
            </>}
            exitCreation={onCreationDeckCloseCreation && <button type="button" className="creation-deck-exit"
                {...cb('storybook_toolbar', 'close', 'Open exit creation confirmation', 'setShowConfirmClose')}
                onClick={onCreationDeckCloseCreation}>Exit creation</button>}
            footer={<>
                {!isLoading && !anyGenerating && <button type="button" className="deck-glass-button creation-deck-circle" aria-label="Back" {...backStoryboardBinding} onClick={backStoryboard}><ArrowBackIosIcon /></button>}
                {canShowAutoImageRunner && <button type="button" className="deck-glass-button creation-deck-auto" aria-label={autoImageRunnerOn ? 'Stop Auto' : 'Start Auto'} aria-pressed={autoImageRunnerOn}
                    {...cb('storybook_grid', autoImageRunnerOn ? 'stop_auto_images' : 'start_auto_images', autoImageRunnerOn ? 'Stop starting new HD images' : 'Auto-generate remaining HD images', 'toggleAutoImageRunner')}
                    onClick={toggleAutoImageRunner}><AutoModeIcon /><span>Auto</span></button>}
                {Continue && <button type="button" className="deck-glass-button creation-deck-primary" {...cb('storybook_start', 'start', 'Enter storyboard', 'ContinueGen')} onClick={ContinueGen}>Start</button>}
                {!Continue && !anyGenerating && (isBShotModeActive || (Done && !HideSave)) && <button type="button" className="deck-glass-button creation-deck-primary"
                    {...(isBShotModeActive ? publishStoryboardBinding : nextStoryboardBinding)} onClick={isBShotModeActive ? publishStoryboard : nextStoryboard}>{primaryLabel}</button>}
                {!Continue && !anyGenerating && VideMode && !isBShotModeActive && <button type="button" className="deck-glass-button creation-deck-circle" aria-label="Create World"
                    {...cb('storybook_grid', 'create_world', 'Open World Creation from this post', 'setShowWorldModel2')} onClick={() => setShowWorldModel2(true)}><PublicIcon /></button>}
                {!Continue && !isBShotModeActive && !isStoryMusicVideoMode && Done && !HideSave && type !== 3 && !anyGenerating && !(steps.length === 1 && type === 0) && !(matchMobile && canShowAutoImageRunner) && (
                    <button type="button" className="deck-glass-button creation-deck-circle" aria-label="Music" {...musicStoryboardBinding} onClick={openStoryboardMusic}><MusicNoteIcon /></button>
                )}
            </>}
        />
    ) : null;
    return (
        <>
        <Box data-creation-deck-covered={storyboardCovered || undefined} {...(storyboardCovered ? { inert: '' } as Record<string, string> : {})} sx={{
            '& [data-scene-card]:is(:focus-within, :active) .creation-scene-count': { opacity: 1 },
            '& [data-scene-card]:is(:focus-within, :active) [data-scene-preview]': { left: '38px' },
            '@media (hover: hover)': {
                '& [data-scene-card]:hover .creation-scene-count': { opacity: 1 },
                '& [data-scene-card]:hover [data-scene-preview]': { left: '38px' },
            },
            position: (matchMobile && minimizeMode === 0) ? 'fixed' : 'relative',
            top: (matchMobile && minimizeMode === 0) ? '60px' : 'auto',
            left: (matchMobile && minimizeMode === 0) ? 0 : 'auto',
            zIndex: (matchMobile && minimizeMode === 0) ? 9999 : 'auto',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: minimizeMode === 0
                ? (matchMobile ? 'calc(100dvh - 60px)' : 'calc(100vh - 120px)')
                : minimizeMode === 1
                    ? (matchMobile ? '60vh' : '65vh')
                    : (matchMobile ? '30vh' : '35vh'),
            maxHeight: '100%',
            overflow: 'hidden',
            transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {!deckVisible && draftSavedPill}
            <ErrorPillContainer darkMode={darkModeReducer} />
            <style>
                {`
            .custom-scroll::-webkit-scrollbar {
                width: 9px;
            }
            .custom-scroll::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.0);
            }
            .custom-scroll::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0);
                border-radius: 10px;
            }
            .custom-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0);
            }
            `}
            </style>


            {/* --- NEW PUBLISH LOADER COMPONENT --- */}
            <PublishLoader
                setThumbGo={setThumbGo}
                steps={steps}
                open={activeLoaderCallerChecker}
                inCreationDeck={studioSelectorInDeck}
                deckDetailHost={deckDetailHost}
                onClose={() => setActiveLoaderCallerChecker(false)}
                type={type}
                generatedImagesFlux={generatedImagesFlux}
                VideoArrayCloud={VideoArrayCloud}
                postId={PostId}
                musicname={publishMusicName}
                musicUrl={publishMusicUrl}
                isLoading={isLoading}
                loadData={LoadData}
                HaltPublish={HaltPublish}
                setHaltPublish={setHaltPublish}
                ContinueUpload={ContinueUpload}
                Close={Close}
                setflip={setflip}
                setminimisePrompt={setminimisePrompt}
                darkMode={darkModeReducer}
                appColor={appColor}
                matchMobile={matchMobile}
                SelectedModel={SelectedModel}
                musicKling={musicKling}
                activatevoicenarration={activatevoicenarration}
                setactivatevoicenarration={handleNarrationToggle}
                narrationSummaryError={activatevoicenarration ? narrationSummaryError : ''}
                onRetryNarrationSummary={onRetryNarrationSummary}
                narrationSummaryPending={type === 1 && activatevoicenarration && !narrationSummaryReady}
                musicMode={musicMode}
                onMusicPublish={handleMusicVideoPublish}
            />

            {/* --- NEW PUBLISH LOADER 2 COMPONENT --- */}
            <Modal open={!!previewDocument} onClose={closeSpatialPreview}>
                <Box sx={{position:"fixed",inset:0,bgcolor:"#080808"}}>
                    {previewDocument && <SpatialExperiencePlayer document={previewDocument} mode="preview" postId={Number(PostId)} creatorId={loggedUser?.id} api={CLIK_URL} appColor={appColor} darkMode={darkModeReducer} controlsHidden={spatialPreviewVerifying} />}
                    <IconButton {...cb('storybook_spatial_preview', 'verify', 'Mark spatial preview reviewed', 'toggleSpatialPreviewVerification', 'click', 'information_only')} aria-label={spatialPreviewVerifying ? "Preview verified" : "Verify preview"} aria-pressed={spatialPreviewVerifying} onClick={toggleSpatialPreviewVerification} sx={{position:"absolute",right:spatialPreviewVerifying ? 16 : 76,top:16,zIndex:40001,width:48,height:48,bgcolor:spatialPreviewVerifying ? appColor : "rgba(255,255,255,0.92)",color:spatialPreviewVerifying ? (darkModeReducer ? "#111" : "#fff") : "#111",border:`1px solid ${spatialPreviewVerifying ? alpha(appColor,0.75) : "rgba(0,0,0,0.2)"}`,boxShadow:spatialPreviewVerifying ? `0 8px 24px ${alpha(appColor,0.35)}` : "0 6px 18px rgba(0,0,0,0.25)",borderRadius:"50%","&:hover":{bgcolor:spatialPreviewVerifying ? darken(appColor,0.1) : "#fff"}}}><CheckIcon /></IconButton>
                    {!spatialPreviewVerifying && <IconButton {...cb('storybook_spatial_preview', 'close', 'Close spatial preview', 'closeSpatialPreview')} aria-label="Close preview" onClick={closeSpatialPreview} sx={{position:"absolute",right:16,top:16,zIndex:40001,width:48,height:48,bgcolor:"#fff",color:"#111",borderRadius:"50%","&:hover":{bgcolor:"#eee"}}}><CloseIcon /></IconButton>}
                </Box>
            </Modal>
            <PublishLoader2
                onPreview={isSpatialInteraction ? openSpatialPreview : undefined}
                spatialVerified={isSpatialInteraction && spatialPreviewVerified}
                onSpatialPublish={isSpatialInteraction ? publishSpatialExperience : undefined}
                onPrepareHotspotSearch={isHotspotInteraction ? prepareHotspotSearch : undefined}
                interactionExperienceMode={interactionExperienceMode}
                open={publishLoader2Open}
                fromCreationDeck={deckHistory.deckOpen}
                inCreationDeck={publishReviewInDeck}
                deckDetailHost={deckDetailHost}
                onClose={closePublishReview}
                type={type}
                darkMode={darkModeReducer}
                appColor={appColor}
                matchMobile={matchMobile}
                generatedImagesFlux={publishGeneratedImagesFlux}
                VideoArrayCloud={VideoArrayCloud}
                generatedAudios={generatedAudios}
                upscaledSceneRefs={upscaledSceneRefs}
                bShotImages={publishBShotImages}
                bShotVideos={bShotVideos}
                bShotPrompts={bShotPrompts}
                postId={PostId}
                usedanimate={usedanimate}
                ratioKey={ratioKey}
                musicname={publishMusicName}
                musicUrl={publishMusicUrl}
                MemeMusic={MemeMusic}
                onProcessLambdaRecipe={startLambdaFfmpegPublish}
                lambdaPublishStatus={lambdaPublishStatus}
                musicMode={musicMode}
                clipDurationSec={time}
                musicSegments={musicSegments}
                musicBreakerSec={musicBreakerSec}
                activatevoicenarration={activatevoicenarration}
                ClosePromptInput={Close}
                setflip={setflip}
                setminimisePrompt={setminimisePrompt}
                autoStart={autoStartPublishLoader2}
            />

            {/* --- NARRATION TOGGLE DATA LOSS WARNING MODAL --- */}
            <Modal
                sx={{ zIndex: 99999 }}
                open={showBShotResetWarning}
                onClose={cancelNarrationToggle}
                closeAfterTransition
                slots={{ backdrop: Backdrop }}
                slotProps={{
                    backdrop: {
                        timeout: 500,
                        style: { backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }
                    },
                }}
            >
                <Fade in={showBShotResetWarning}>
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: matchMobile ? "90%" : "400px",
                        background: darkModeReducer
                            ? "linear-gradient(145deg, rgba(30,30,30,0.9), rgba(10,10,10,0.95))"
                            : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,240,240,0.9))",
                        border: `1px solid ${darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderRadius: "24px",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                        p: 4,
                        textAlign: 'center',
                        outline: 'none',
                    }}>
                        <WarningAmberIcon sx={{ fontSize: 60, color: appColor, mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: darkModeReducer ? '#fff' : '#000', mb: 1 }}>
                            Reset B-roll?
                        </Typography>
                        <Typography sx={{ color: darkModeReducer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', mb: 3 }}>
                            Changing Narration settings will recalculate your grid and reset your existing B-roll media. Do you want to proceed and lose this data?
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                {...cb('storybook_bshot_warning', 'cancel_narration_reset', 'Keep existing B-roll media and cancel narration change', 'cancelNarrationToggle')}
                                variant="outlined"
                                onClick={cancelNarrationToggle}
                                sx={{ borderRadius: '50px', px: 3, borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', color: darkModeReducer ? '#fff' : '#000' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                {...cb('storybook_bshot_warning', 'confirm_narration_reset', 'Reset existing B-roll media and change narration', 'confirmNarrationToggle', 'click', 'needs_confirmation')}
                                variant="contained"
                                onClick={confirmNarrationToggle}
                                sx={{
                                    borderRadius: '50px', px: 3,
                                    bgcolor: appColor,
                                    color: darkModeReducer ? '#000' : '#fff',
                                    '&:hover': { bgcolor: darken(appColor, 0.18) }
                                }}
                            >
                                Yes, Reset
                            </Button>
                        </Box>
                    </Box>
                </Fade>
            </Modal>

            {/* --- B-SHOT TIME-CHANGE WARNING MODAL --- */}
            <Modal
                sx={{ zIndex: 99999 }}
                open={showBShotTimeChangeWarning}
                onClose={cancelBShotTimeRebuild}
                closeAfterTransition
                slots={{ backdrop: Backdrop }}
                slotProps={{
                    backdrop: {
                        timeout: 500,
                        style: { backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }
                    },
                }}
            >
                <Fade in={showBShotTimeChangeWarning}>
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: matchMobile ? "90%" : "400px",
                        background: darkModeReducer
                            ? "linear-gradient(145deg, rgba(30,30,30,0.9), rgba(10,10,10,0.95))"
                            : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,240,240,0.9))",
                        border: `1px solid ${darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderRadius: "24px",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                        p: 4,
                        textAlign: 'center',
                        outline: 'none',
                    }}>
                        <WarningAmberIcon sx={{ fontSize: 60, color: appColor, mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: darkModeReducer ? '#fff' : '#000', mb: 1 }}>
                            Video length changed
                        </Typography>
                        <Typography sx={{ color: darkModeReducer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', mb: 3 }}>
                            Your B-roll were built for {bShotBuiltWithTime}s clips, but your video length is now {time}s. Rebuild the B-roll for {time}s, or keep them and close — you can delete the {time}s video and regenerate at {bShotBuiltWithTime}s instead.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                {...cb('storybook_bshot_warning', 'keep_length', 'Keep existing B-roll arrangement and clip length', 'cancelBShotTimeRebuild')}
                                variant="outlined"
                                onClick={cancelBShotTimeRebuild}
                                sx={{ borderRadius: '50px', px: 3, borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', color: darkModeReducer ? '#fff' : '#000' }}
                            >
                                Keep, I'll fix it
                            </Button>
                            <Button
                                {...cb('storybook_bshot_warning', 'rebuild_length', 'Clear and rebuild B-roll arrangement for new clip length', 'confirmBShotTimeRebuild', 'click', 'needs_confirmation')}
                                variant="contained"
                                onClick={confirmBShotTimeRebuild}
                                sx={{
                                    borderRadius: '50px', px: 3,
                                    bgcolor: appColor,
                                    color: darkModeReducer ? '#000' : '#fff',
                                    '&:hover': { bgcolor: darken(appColor, 0.18) }
                                }}
                            >
                                Rebuild at {time}s
                            </Button>
                        </Box>
                    </Box>
                </Fade>
            </Modal>

            {/* --- AUDIO GENERATION PROGRESS MODAL --- */}
            <Modal
                open={isAudioGenerating}
                onClose={() => setIsAudioGenerating(false)}
                closeAfterTransition
                slots={{ backdrop: Backdrop }}
                slotProps={{
                    backdrop: {
                        timeout: 500,
                        style: { backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }
                    },
                }}
            >
                <Fade in={isAudioGenerating}>
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: matchMobile ? '90%' : '450px',
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        p: 3,
                        borderRadius: '24px',
                        background: darkModeReducer
                            ? "linear-gradient(145deg, rgba(30,30,30,0.95), rgba(10,10,10,0.98))"
                            : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,240,240,0.98))",
                        border: `2px solid ${appColor}`,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        color: darkModeReducer ? '#fff' : '#000',
                        outline: 'none',
                    }}>
                        {/* Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                Voice Narration Progress
                            </Typography>
                            <IconButton {...cb('storybook_narration_progress', 'close', 'Close narration progress; keep accepted narration running', 'setIsAudioGenerating(false)')} aria-label="Close narration progress" onClick={() => setIsAudioGenerating(false)} size="small" sx={{ color: 'inherit' }}>
                                <CloseIcon />
                            </IconButton>
                        </Box>

                        {/* List Container */}
                        <Box className="custom-scroll" sx={{ flex: 1, overflowY: 'auto', pr: 1, mb: 3 }}>
                            {audioSceneStatuses.map((item, idx) => {
                                const pColor = appColor;
                                return (
                                    <Box
                                        key={idx}
                                        onClick={() => item.status === 'success' && handlePlayAudioPreview(idx)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            py: 1.5,
                                            px: 1,
                                            borderRadius: '12px',
                                            cursor: item.status === 'success' ? 'pointer' : 'default',
                                            borderBottom: `1px solid ${darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                            transition: 'background-color 0.2s',
                                            '&:hover': item.status === 'success' ? {
                                                bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                                            } : {}
                                        }}
                                    >
                                        <Box sx={{ mr: 2, minWidth: 0, flex: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: pColor }}>
                                                {`Scene ${idx + 1}`}
                                            </Typography>
                                            <Typography variant="body2" noWrap sx={{ opacity: 0.8, fontSize: '0.85rem' }}>
                                                {typeof item.text === 'object' && item.text !== null ? (item.text.text || item.text.prompt || "") : item.text}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flexShrink: 0, ml: 2 }} onClick={(e) => {
                                            if (item.status !== 'success') {
                                                e.stopPropagation();
                                            }
                                        }}>
                                            {item.status === 'generating' && (
                                                <CircularProgress size={20} sx={{ color: pColor }} />
                                            )}
                                            {item.status === 'success' && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                    {playingAudioIndex === idx ? (
                                                        <PauseIcon sx={{ color: pColor, fontSize: '1.25rem', opacity: 0.8 }} />
                                                    ) : (
                                                        <VolumeUpIcon sx={{ color: pColor, fontSize: '1.25rem', opacity: 0.8 }} />
                                                    )}
                                                    <CheckCircleIcon sx={{ color: '#4caf50' }} />
                                                </Box>
                                            )}
                                            {item.status === 'error' && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="caption" sx={{ color: '#f44336', display: { xs: 'none', sm: 'inline' } }}>
                                                        Failed
                                                    </Typography>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => handleRetrySceneAudio(idx)}
                                                        sx={{
                                                            py: 0.25,
                                                            px: 1,
                                                            minWidth: 0,
                                                            fontSize: '0.75rem',
                                                            borderRadius: '8px',
                                                            borderColor: pColor,
                                                            color: pColor,
                                                            '&:hover': {
                                                                borderColor: pColor,
                                                                bgcolor: alpha(appColor, 0.1)
                                                            }
                                                        }}
                                                    >
                                                        Retry
                                                    </Button>
                                                </Box>
                                            )}
                                            {item.status === 'pending' && (
                                                <Box sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    bgcolor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                                                    mx: 1
                                                }} />
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Fade>
            </Modal>



            <Box
                ref={stripRef}
                {...cb('storybook_grid', 'scroll_scenes', 'Scroll Storybook scene grid', 'stripRef', 'scroll')}

                sx={{
                    display: "flex",
                    flexWrap: "wrap",           // CHANGED: Allows items to wrap to the next line
                    overflowY: "auto",          // Kept vertical scroll modelz
                    alignContent: "flex-start", // Ensures items start from top
                    gap: "1rem",
                    width: "100%",
                    minHeight: 0,
                    flex: 1,
                    padding: "1rem",
                    paddingTop: matchMobile ? '1.5rem' : '1rem',
                    paddingBottom: matchMobile ? '2rem' : '2.5rem',
                    overscrollBehaviorY: "contain",
                    /** */
                    "&::-webkit-scrollbar": {
                        width: "6px", // Thinner scrollbar
                    },
                    "&::-webkit-scrollbar-track": {
                        background: "rgba(255,255,255,0.05)", // Transparent track
                    },
                    "&::-webkit-scrollbar-thumb": {
                        background: "rgba(255,255,255,0.3)", // Glassy thumb
                        borderRadius: "10px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                        background: "rgba(255,255,255,0.5)",
                    }

                    // paddingBottom: '10vh' */
                }}
            >
                {steps?.map((step: any, index: any) => {
                    // Fallback image if generation not completed

                    //const isLocked = isInteractionSlotLocked(index);

                    const isLocked = false;
                    const isDummy = isPreviewSceneImage(generatedImagesFlux[index], dummyImageUrls[index]);
                    const isSceneGenerating = !!isGenerating?.[index] || (loaders?.[index] || 0) > 0;
                    const promptSceneIndex = unifiedIndexMap.findIndex(entry => entry.type === 'A' && entry.index === index);
                    const isPromptPreparing = VideMode && Boolean(loadPrompt[promptSceneIndex >= 0 ? promptSceneIndex : index]);
                    const isBShotArrayExpanded = isBShotModeActive && (bShotPrompts?.[index]?.length || 0) > 0;


                    const fallbackImage = loggedUser
                        ? `${loggedUser.image}`
                        : "https://via.placeholder.com/400x250.png?text=No+User+Image";

                    const hasVideo = !!VideoArray?.[index] && String(VideoArray[index]).trim() !== "" && VideoArray[index] !== "EMPTY";
                    const displayImage = generatedImagesFlux[index] || generatedImages?.[index];
                    const imageQuality = imageProvenanceRef.current.quality(displayImage);
                    const isNanoCard = !hasVideo && (imageQuality === 'preview'
                        || (!imageQuality && isPreviewSceneImage(displayImage, nanoImages?.[index])));

                    return (
                        <React.Fragment key={`group-${index}`}>

                            <div data-scene-card
                                key={`main-${index}`} data-creation-scene-key={sceneDeckKey(index)}
                                style={{
                                    flex: "0 0 auto", // ensure each item doesn’t shrink

                                    // Grid Mapping
                                    // Desktop PC: 9:16 = 5 grid; 1:1 = 4 grid; 16:9 = 3 grid
                                    // Mobile:     16:9 = 1 grid, 1:1 = 1 grid, 9:16 = 2 grid
                                    width: (ratioKey === 3)
                                        ? (matchMobile ? "100%" : "calc(33.333% - 0.666rem)")
                                        : (ratioKey === 2)
                                            ? (matchMobile ? "100%" : "calc(25% - 0.75rem)")
                                            : (matchMobile ? "calc(50% - 0.5rem)" : "calc(20% - 0.8rem)"),
                                    height: "auto",
                                    ...(matchMobile ? {} : {
                                        width: ratioKey === 1 ? "calc((100% - 4rem) / 5)" : (ratioKey === 2 ? "calc((100% - 3rem) / 4)" : "calc((100% - 2rem) / 3)"),
                                        minWidth: 0,
                                    }),
                                    position: "relative",
                                    borderRadius: "4px",
                                    overflow: "hidden",
                                    padding: '0px',
                                    marginBottom: "1.5rem",

                                }}
                            >
                                <SceneNumberBadge number={sceneDisplayForTarget(sceneDisplayMap.entries, { type: 'A', index })?.displaySceneNumber} />
                                {generatedImagesFlux[index] && (
                                    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                        {isNanoCard && (
                                            <Typography data-scene-preview
                                                sx={{
                                                    position: 'absolute',
                                                    top: isDummy ? 'calc(22.5% + 6px)' : '6px',
                                                    left: isDummy ? 'calc(22.5% + 6px)' : '6px',
                                                    zIndex: 10,
                                                    bgcolor: 'rgba(0, 0, 0, 0.76)',
                                                    backdropFilter: 'blur(8px)',
                                                    color: '#ffffff',
                                                    px: 1.1,
                                                    py: 0.28,
                                                    borderRadius: '5px',
                                                    fontSize: matchMobile ? '0.68rem' : '0.58rem',
                                                    fontWeight: 850,
                                                    letterSpacing: '0.06em',
                                                    textTransform: 'uppercase',
                                                    pointerEvents: 'none',
                                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                }}
                                            >
                                                PREVIEW
                                            </Typography>
                                        )}
                                        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                                            <img
                                                ref={index === 0 ? firstImageRef : null}
                                                {...gridSceneEntryBinding(`open_scene_${index + 1}`, { type: 'A', index })}
                                                data-creation-blocked={isLocked || !Donex ? 'true' : undefined}
                                                data-creation-disabled-reason={isLocked || !Donex ? 'Scene entry is locked while storyboard setup or generation is running.' : undefined}
                                                onLoad={(e) => {
                                                    if (!isRatioSet) {
                                                        const img = e.currentTarget;
                                                        const naturalRatio = img.naturalWidth / img.naturalHeight;
                                                        setMasterAspectRatio(naturalRatio);
                                                        setIsRatioSet(true);
                                                    }
                                                }}
                                                onClick={() => {
                                                    console.error("[Storybook] Grid Image Clicked! index:", index, "isLocked:", isLocked, "Donex:", Donex);
                                                    if (isLocked) return;
                                                    if (Donex) {
                                                        console.error("[Storybook] Opening EditStory for index:", index);
                                                        enterSceneFromGrid(index);
                                                    }
                                                }}
                                                src={generatedImagesFlux[index]}
                                                alt={`Step ${index + 1}`}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    display: "block",
                                                    objectFit: "cover",
                                                    cursor: isLocked ? "not-allowed" : "pointer",
                                                    opacity: isLocked ? 0.4 : 1,
                                                    pointerEvents: isLocked ? "none" : "auto",
                                                    borderRadius: isDummy ? "20px" : "12px",
                                                    border: "1px solid rgba(255, 255, 255, 0.12)",
                                                    boxShadow: isDummy ? "0 4px 25px rgba(0,0,0,0.4)" : "0 4px 15px rgba(0,0,0,0.2)",
                                                    transform: isDummy ? "scale(0.55)" : "scale(1)",
                                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                                }}
                                            />
                                        </Box>
                                        {/* VIDEO PLAY OVERLAY — video mode only. In image mode the
                                            grid shows pure images even when videos already exist. */}
                                        {(VideMode && !isSceneGenerating) && (
                                            <Box
                                                {...gridSceneEntryBinding(`open_motion_${index + 1}`, { type: 'A', index })}
                                                data-creation-blocked={isLocked || !Donex ? 'true' : undefined}
                                                data-creation-disabled-reason={isLocked || !Donex ? 'Scene entry is locked while storyboard setup or generation is running.' : undefined}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isLocked) return;
                                                    if (Donex) {
                                                        enterSceneFromGrid(index);
                                                    }
                                                }}
                                                sx={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    width: 'auto',
                                                    height: 'auto',
                                                    padding: '6px 16px',
                                                    borderRadius: '20px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: 'rgba(0, 0, 0, 0.5)',
                                                    border: '2px solid rgba(255,255,255,0.8)',
                                                    backdropFilter: 'blur(4px)',
                                                    cursor: isLocked ? "not-allowed" : "pointer",
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                    zIndex: 3,
                                                    transition: 'transform 0.2s',
                                                    '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)' }
                                                }}
                                            >
                                                {!!VideoArray[index] ? (
                                                    <PlayArrowIcon sx={{ color: 'white', fontSize: 32 }} />
                                                ) : (
                                                    <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                        CREATE MOTION
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}

                                        {/* DELETE ICON for Video Mode */}
                                        {VideMode && !!VideoArray[index] && !isBShotArrayExpanded && (
                                            <Box
                                                {...cb('storybook_grid', `request_delete_video_${index + 1}`, `Request deletion of scene ${index + 1} video`, 'setPendingDelete')}
                                                onClick={(e) => { e.stopPropagation(); setPendingDelete({ index, type: 'video' }); }}
                                                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10, cursor: 'pointer', color: '#fff', '&:hover': { transform: 'scale(1.1)' }, transition: 'transform 0.2s' }}
                                            >
                                                <PanoramaFishEyeIcon sx={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))', fontSize: 28 }} />
                                            </Box>
                                        )}

                                        {/* DELETE OVERLAY for Video Mode */}
                                        {pendingDelete?.type === 'video' && pendingDelete?.index === index && (
                                            <Box sx={{
                                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20,
                                                backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: isDummy ? "20px" : "12px",
                                            }} onClick={(e) => e.stopPropagation()}>
                                                <Typography sx={{ color: '#fff', mb: 2, fontWeight: 'bold' }}>Delete video</Typography>
                                                <Stack direction="row" spacing={2}>
                                                    <Button {...cb('storybook_grid', `confirm_delete_video_${index + 1}`, `Delete scene ${index + 1} video`, 'confirmDelete', 'click', 'needs_confirmation')} variant="contained" color="error" size="small" onClick={(e) => { e.stopPropagation(); confirmDelete(); }}>Yes</Button>
                                                    <Button {...cb('storybook_grid', `cancel_delete_video_${index + 1}`, `Keep scene ${index + 1} video`, 'setPendingDelete')} variant="outlined" size="small" sx={{ color: '#fff', borderColor: '#fff' }} onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}>No</Button>
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>
                                )}
                                {!(generatedImagesFlux[index]) && (
                                    generatedImages?.[index] ? (
                                        <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                            {isNanoCard && (
                                                <Typography data-scene-preview
                                                    sx={{
                                                        position: 'absolute',
                                                        top: isDummy ? 'calc(22.5% + 6px)' : '8px',
                                                        left: isDummy ? 'calc(22.5% + 6px)' : '8px',
                                                        zIndex: 10,
                                                        bgcolor: 'rgba(0, 0, 0, 0.76)',
                                                        backdropFilter: 'blur(8px)',
                                                        color: '#ffffff',
                                                        px: 1.1,
                                                        py: 0.28,
                                                        borderRadius: '5px',
                                                        fontSize: matchMobile ? '0.68rem' : '0.58rem',
                                                        fontWeight: 850,
                                                        letterSpacing: '0.06em',
                                                        textTransform: 'uppercase',
                                                        pointerEvents: 'none',
                                                        border: '1px solid rgba(255, 255, 255, 0.25)',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                                                    }}
                                                >
                                                    PREVIEW
                                                </Typography>
                                            )}
                                            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                                                <img
                                                    {...gridSceneEntryBinding(`open_scene_${index + 1}`, { type: 'A', index })}
                                                    onClick={() => {
                                                        if (Continue) {
                                                            ContinueGen();
                                                        } else if (Donex) {
                                                            if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                                enterSceneFromGrid(index);
                                                            }
                                                        }
                                                    }}
                                                    src={generatedImages[index]}
                                                    alt={`Step ${index + 1}`}
                                                    onLoad={(e) => {
                                                        if (!isRatioSet) {
                                                            const img = e.currentTarget;
                                                            const naturalRatio = img.naturalWidth / img.naturalHeight;
                                                            setMasterAspectRatio(naturalRatio);
                                                            setIsRatioSet(true);
                                                        }
                                                    }}
                                                    style={{
                                                        width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                        cursor: "pointer",
                                                        borderRadius: "12px",
                                                    }}
                                                />
                                            </Box>
                                            {/* VIDEO PLAY OVERLAY fallback — video mode only, same rule
                                                as the main overlay above. */}
                                            {(VideMode && !isSceneGenerating) && (
                                                <Box
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (Continue) {
                                                            ContinueGen();
                                                        } else if (Donex) {
                                                            if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                                enterSceneFromGrid(index);
                                                            }
                                                        }
                                                    }}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: 'auto',
                                                        height: 'auto',
                                                        padding: '6px 16px',
                                                        borderRadius: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: 'rgba(0, 0, 0, 0.5)',
                                                        border: '2px solid rgba(255,255,255,0.8)',
                                                        backdropFilter: 'blur(4px)',
                                                        cursor: "pointer",
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                        zIndex: 3,
                                                        transition: 'transform 0.2s',
                                                        '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)' }
                                                    }}
                                                >
                                                    {isValidVideo(VideoArray[index]) ? (
                                                        <PlayArrowIcon sx={{ color: 'white', fontSize: 32 }} />
                                                    ) : (
                                                        <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                            CREATE MOTION
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                        </Box>
                                    ) : nanoImages?.[index] ? (
                                        /* --- PREVIEW NANO IMAGE OVERLAY --- */
                                        <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                            <Box sx={{ position: 'relative', width: '100%', height: '100%', borderRadius: "12px", overflow: 'hidden' }}>
                                                <Typography data-scene-preview
                                                    sx={{
                                                        position: 'absolute',
                                                        top: '6px',
                                                        left: '6px',
                                                        zIndex: 10,
                                                        bgcolor: 'rgba(0, 0, 0, 0.72)',
                                                        backdropFilter: 'blur(8px)',
                                                        color: '#ffffff',
                                                        px: 1.1,
                                                        py: 0.28,
                                                        borderRadius: '5px',
                                                        fontSize: matchMobile ? '0.68rem' : '0.58rem',
                                                        fontWeight: 850,
                                                        letterSpacing: '0.06em',
                                                        textTransform: 'uppercase',
                                                        pointerEvents: 'none',
                                                        border: '1px solid rgba(255, 255, 255, 0.25)',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                                                    }}
                                                >
                                                    PREVIEW
                                                </Typography>
                                                <img
                                                    {...gridSceneEntryBinding(`open_scene_${index + 1}`, { type: 'A', index })}
                                                    onClick={() => {
                                                        if (Continue) ContinueGen();
                                                        else if (Donex) {
                                                            enterSceneFromGrid(index);
                                                        }
                                                    }}
                                                    src={nanoImages[index]}
                                                    alt={`Preview Step ${index + 1}`}
                                                    style={{
                                                        width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                        cursor: "pointer",
                                                        borderRadius: "12px",
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    ) : (
                                        /* --- NEW GLASS PLACEHOLDER --- */
                                        <Box
                                            {...gridSceneEntryBinding(`edit_scene_${index + 1}`, { type: 'A', index })}
                                            data-creation-blocked={!Continue && !Donex ? 'true' : undefined}
                                            data-creation-disabled-reason={!Continue && !Donex ? 'Storyboard setup has not enabled scene editing yet.' : undefined}
                                            onClick={(e) => {
                                                console.error("[Storybook] Pencil Icon Clicked! index:", index, "isLocked:", isLocked);
                                                console.error("[Storybook] anyGenerating:", Object.values(isGenerating || {}).some(Boolean));
                                                e.stopPropagation();
                                                if (Continue) ContinueGen();
                                                else if (Donex) {
                                                    enterSceneFromGrid(index);
                                                }
                                            }}
                                            sx={{
                                                width: "100%",
                                                height: "100%",
                                                aspectRatio: matchMobile ? (ratioKey === 1 ? '1 / 1' : '16 / 9') : '4 / 3', // Square for 2-column mobile portrait, Card shape for others
                                                borderRadius: "12px",
                                                fontSize: matchMobile ? '0.8rem' : '1rem',
                                                background: darkModeReducer ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.06)",
                                                backdropFilter: "blur(24px)",
                                                border: darkModeReducer ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.15)",
                                                boxShadow: darkModeReducer ? "inset 0 0 20px rgba(0,0,0,0.8), 5px 5px 20px rgba(0,0,0,0.4)" : "0 4px 15px rgba(0,0,0,0.1)",
                                                display: "flex",
                                                alignItems: "flex-start", // Start from top to allow percentage positioning
                                                justifyContent: "center",
                                                pt: '30%', // Tweak: 30% from top (70% from bottom)
                                                cursor: "pointer",
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    background: "rgba(255, 255, 255, 0.08)",
                                                    transform: 'scale(0.98)'
                                                }
                                            }}
                                        >
                                            <Typography sx={{

                                                visibility: (matchMobile || (allowgetImage && (index === 0 || !Continue))) ? 'hidden' : !Continue ? 'visible' : 'hidden',
                                                fontWeight: 900,

                                                marginTop: matchMobile ? '4vh' : '1vh',
                                                letterSpacing: '0.2em',
                                                color: darkModeReducer ? "rgba(255,255,255,0.15)" : "#000000",
                                                textTransform: 'uppercase',
                                                textShadow: darkModeReducer ? "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.05)" : "none",
                                                userSelect: 'none'
                                            }}>
                                                {matchMobile ? ` ${index + 1}` : `SCENE ${index + 1}`}
                                            </Typography>
                                        </Box>
                                    )
                                )}

                                {



                                    DummyMode ?

                                        null
                                        :

                                        !generatedImagesFlux?.[index] || isGenerating?.[index] ?
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    width: "100%",
                                                    height: "100%",
                                                    display: allowgetImage ? index === 0 ? 'flex' : Continue ? 'none' : "flex" :
                                                        'none',
                                                    flexDirection: "column", // spinner ⬆ text ⬇
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    zIndex: 300,
                                                    cursor: "pointer",
                                                    pointerEvents: "none",
                                                }}
                                            >
                                                <GlowWidthBar
                                                    value={loaders?.[index] || 0}
                                                    matchMobile={matchMobile}
                                                    index={index}
                                                />

                                            </Box>
                                            : null}

                                {!generatedImages[index] && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: "40%",
                                            left: "0px",
                                            width: "100%",
                                            height: "0px",
                                            backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                            display: "none",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 300, // Above overlay and images
                                            borderRadius: 2,
                                            pointerEvents: "none",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <GlowWidthBar
                                            value={loaders[index]}
                                            matchMobile={matchMobile}
                                            index={index}
                                        />
                                    </Box>
                                )}


                                {isPromptPreparing && renderPreparingPrompt()}

                                {dbLoad && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: "0px",
                                            left: "0px",
                                            width: "100%",
                                            height: "100%",
                                            /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 300, // Above overlay and images
                                            borderRadius: 2,
                                            pointerEvents: "none",
                                            cursor: "pointer",
                                        }}
                                    >

                                        <GlowWidthBar
                                            value={loaders[index]}
                                            matchMobile={matchMobile}
                                            index={index}
                                        />
                                    </Box>
                                )}

                                {
                                    Donex && (

                                        // imports (if not already)
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: "0vh",
                                                left: 0,
                                                width: "100%",
                                                display: minimizeMode === 2 || open2 || (Continue && index !== 0) ? "none" : "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                zIndex: 3,
                                                pointerEvents: "none", // only the button is clickable
                                            }}
                                        >
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                onClick={() => {
                                                    setActiveBShotEdit(null);

                                                    if (allowgetImage) {


                                                        if (open2 && !VideMode) {

                                                            setstartEdit(true);
                                                            setactiveEdit(index);

                                                        } else {

                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                        }




                                                    } else {

                                                        if (!generatedImagesFlux[0] && !DummyMode) {
                                                            ///  setallowgetImage(true);
                                                        } else {

                                                            if (open2 && !VideMode) {

                                                                setstartEdit(true);
                                                                setactiveEdit(index);

                                                            } else {

                                                                setstartEdit(true);
                                                                setactiveEdit(index);
                                                            }

                                                        }
                                                    }

                                                }}
                                                startIcon={
                                                    allowgetImage ? DummyMode ?

                                                        <FileUploadIcon
                                                            sx={{ fontSize: "2.2rem", transform: 'scale(90%)' }}
                                                        /> : ''

                                                        : (
                                                            <VisibilityIcon
                                                                sx={{ fontSize: "2.2rem", transform: 'scale(0%)', opacity: GeneratedText.length > 0 ? 1 : 0.3 }}
                                                            />
                                                        )
                                                }
                                                ///  disabled={!allowgetImage && GeneratedText.length === 0}
                                                sx={{
                                                    pointerEvents: "auto",
                                                    // size
                                                    width: "100%",
                                                    height: "auto",
                                                    px: 3,
                                                    py: 1.5,
                                                    borderRadius: 2,
                                                    textTransform: "none",
                                                    fontSize: matchMobile ? '2.2vh' : "3vh",
                                                    fontWeight: 700,
                                                    // backdropFilter: ratioKey === 3 || ratioKey === 2 ? 'blur(0px)' : "blur(12px)",
                                                    // WebkitBackdropFilter: ratioKey === 3 || ratioKey === 2 ? 'blur(0px)' : "blur(12px)",
                                                    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

                                                    letterSpacing: "0.02em",

                                                    // center icon + text
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    gap: 1.2,
                                                    "& .MuiButton-startIcon": {
                                                        margin: 0, // remove default negative margins so true-centers
                                                    },
                                                    boxShadow: "none",
                                                    // glass look + hover swap (based on your guide)
                                                    //   backdropFilter: "blur(10px)",
                                                    //  WebkitBackdropFilter: "blur(10px)",
                                                    backgroundColor: darkMode ? "rgb(25,25,25,0.03)" : "rgb(105,105,105,0.04)",
                                                    color: darkMode ? "#ffffff" : "#ffffff",
                                                    //  boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                                                    //  border: "1px solid rgba(255,255,255,0.25)",
                                                    "&:hover": {
                                                        backgroundColor: darkMode ? "rgb(105,105,105,0.03)" : "rgb(25,25,25,0.04)",
                                                        color: darkMode ? "#000000" : "#000000",
                                                        ///boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                                                    },

                                                    // disabled look
                                                    "&.Mui-disabled": {
                                                        backgroundColor: "rgba(255,255,255,0.05)",
                                                        color: "rgba(255,255,255,0.85)",
                                                        boxShadow: "none",
                                                        borderColor: "rgba(255,255,255,0.2)",

                                                    },

                                                }}
                                            >
                                                {/* centered icon + text */}
                                                {allowgetImage ? (DummyMode ?
                                                    'Upload'
                                                    :


                                                    <EditIcon sx={{ fontSize: "2.2rem", transform: 'scale(70%)' }} />) :
                                                    ''}
                                            </Button>
                                        </Box>

                                    )}

                                {false && !allowgetImage && ( /* Auto/Manual selector hidden: Manual auto-fires */
                                    <>
                                        {/* ================================================================================== */}
                                        {/* NEW CASE: SPLIT BUTTONS AT INDEX 1 (Only if steps.length === 2)                    */}
                                        {/* Left: Video 🎥 | Right: Magic Wand 🪄                                              */}
                                        {/* ================================================================================== */}
                                        {steps.length === 2 && index === 1 && (
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top: matchMobile ? "0vh" : '7%',
                                                    left: 0,
                                                    width: "100%",
                                                    display: "none",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    zIndex: 3,
                                                    pointerEvents: "none",
                                                    // MOBILE OPTIMIZATION: Tighter padding and gap on mobile
                                                    px: matchMobile ? 0.3 : 3,
                                                    gap: matchMobile ? 1.5 : 2
                                                }}
                                            >
                                                <Button
                                                    variant="contained"
                                                    onClick={() => {
                                                        setCreationMode('Video');
                                                        setallowgetImage(true);
                                                    }}
                                                    sx={{
                                                        flex: 1,
                                                        pointerEvents: "auto",
                                                        height: "auto",
                                                        py: 1.5,
                                                        borderRadius: 2,
                                                        fontSize: matchMobile ? "clamp(12px, 2vw, 20px)" : "clamp(14px, 1.8vw, 22px)",
                                                        display: "flex",
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        backdropFilter: "blur(12px)",
                                                        WebkitBackdropFilter: "blur(12px)",
                                                        background: "rgba(255,255,255,0.05)",
                                                        color: darkModeReducer ? "#ffffff" : "#000000",
                                                        boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
                                                        border: "1px solid rgba(255,255,255,0.15)",
                                                        "&:hover": {
                                                            background: "rgba(255,255,255,0.12)",
                                                            boxShadow: "0px 6px 16px rgba(0,0,0,0.4)",
                                                            borderColor: "rgba(255,255,255,0.3)",
                                                        },
                                                    }}
                                                >
                                                    <VideocamIcon sx={{ fontSize: "1.5rem" }} />
                                                </Button>

                                                <Button
                                                    variant="contained"
                                                    onClick={() => {
                                                        setCreationMode('Manual');
                                                        setDummyMode(true);
                                                        setallowgetImage(true);
                                                    }}
                                                    sx={{
                                                        flex: 1,
                                                        pointerEvents: "auto",
                                                        height: "auto",
                                                        py: 1.5,
                                                        borderRadius: 2,
                                                        fontSize: matchMobile ? "clamp(12px, 2vw, 20px)" : "clamp(14px, 1.8vw, 22px)",
                                                        display: "flex",
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        backdropFilter: "blur(12px)",
                                                        WebkitBackdropFilter: "blur(12px)",
                                                        background: "rgba(255,255,255,0.05)",
                                                        color: darkModeReducer ? "#ffffff" : "#000000",
                                                        boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
                                                        border: "1px solid rgba(255,255,255,0.15)",
                                                        "&:hover": {
                                                            background: "rgba(255,255,255,0.12)",
                                                            boxShadow: "0px 6px 16px rgba(0,0,0,0.4)",
                                                            borderColor: "rgba(255,255,255,0.3)",
                                                        },
                                                    }}
                                                >
                                                    <AutoFixHighIcon sx={{ fontSize: "1.5rem" }} />
                                                </Button>
                                            </Box>
                                        )}

                                        {/* ================================================================================== */}
                                        {/* STANDARD BUTTON (GENERATE, ETC.)                                                   */}
                                        {/* ================================================================================== */}
                                        {true && (
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top: matchMobile ? "0vh" : '7%',
                                                    left: 0,
                                                    width: "100%",
                                                    display: index === 0 || index === 1 ? "flex" : "none",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    zIndex: 3,
                                                    pointerEvents: "none",
                                                    // MOBILE OPTIMIZATION: Match padding with split buttons for consistency
                                                    px: matchMobile ? 0.3 : 3,
                                                }}
                                            >
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    onClick={() => {
                                                        setCreationMode(index === 0 ? 'Normal' :
                                                            index === 1 ? 'Video' : 'Manual'
                                                        )
                                                        if (index === 2) {
                                                            setDummyMode(true)
                                                        }
                                                        setallowgetImage(true);
                                                    }}
                                                    startIcon={
                                                        index === 0 ? <ImageIcon sx={{ fontSize: "0.8em" }} /> :
                                                            (index === 1) ? <VideocamIcon sx={{ fontSize: "0.8em" }} /> :
                                                                <AutoFixHighIcon sx={{ fontSize: "0.8em" }} />
                                                    }
                                                    sx={{
                                                        pointerEvents: "auto",
                                                        width: "100%",
                                                        height: "auto",
                                                        py: 1.5,
                                                        borderRadius: 2,
                                                        textTransform: "none",
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem',
                                                        display: "flex",
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        gap: 1.2,
                                                        "& .MuiButton-startIcon": { margin: 0 },
                                                        backdropFilter: "blur(10px)",
                                                        WebkitBackdropFilter: "blur(10px)",
                                                        background: "rgba(255,255,255,0.05)",
                                                        color: darkModeReducer ? "#ffffff" : "#000000",
                                                        boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
                                                        border: "1px solid rgba(255,255,255,0.15)",
                                                        "&:hover": {
                                                            background: "rgba(255,255,255,0.12)",
                                                            boxShadow: "0px 6px 16px rgba(0,0,0,0.4)",
                                                            borderColor: "rgba(255,255,255,0.3)",
                                                        },
                                                        "&.Mui-disabled": {
                                                            backgroundColor: "rgba(255,255,255,0.05)",
                                                            //  color: "rgba(255,255,255,0.4)", Publish YES
                                                            borderColor: "rgba(255,255,255,0.1)",
                                                        },
                                                    }}
                                                >
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: 1,
                                                            width: "100%",
                                                            flexWrap: "wrap",
                                                            lineHeight: 1.2,
                                                            textAlign: "center",
                                                            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

                                                            letterSpacing: "0.02em",
                                                        }}
                                                    >
                                                        <Box component="span" sx={{ fontWeight: 600, whiteSpace: "nowrap", fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                                            {index === 0 ? 'Auto' :
                                                                index === 1 ? 'Manual' :
                                                                    'UPLOAD'}
                                                        </Box>
                                                    </Box>
                                                </Button>
                                            </Box>
                                        )}
                                    </>
                                )}

                                {Continue && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: matchMobile ? "0vh" : '30%',
                                            left: 0,
                                            width: "100%",
                                            display: index === 0 ? "none" : "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 3,
                                            pointerEvents: "none", // only the button is clickable
                                        }}
                                    >
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            {...cb('storybook_start', 'start', `Enter storyboard; estimated full-story image cost ${price4all} pixels (Start itself does not deduct pixels)`, 'ContinueGen')}
                                            onClick={ContinueGen}

                                            startIcon={<DoubleArrowIcon sx={{ fontSize: "0.8em", color: darkModeReducer ? "#ffffff" : "#000000" }} />}
                                            sx={{
                                                pointerEvents: "auto",
                                                width: "100%",
                                                height: "auto",
                                                px: 3,
                                                py: 2,
                                                borderRadius: 2,
                                                textTransform: "none",
                                                fontWeight: 700,
                                                fontSize: matchMobile ? "clamp(12.6px, 2.1vw, 21px)" : "clamp(14.7px, 1.89vw, 23.1px)",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                gap: 1.2,
                                                "& .MuiButton-startIcon": { margin: 0, color: "inherit" },
                                                "& .MuiButton-startIcon svg": { color: darkModeReducer ? "#ffffff" : "#000000" },
                                                "& span": { color: darkModeReducer ? "#ffffff" : "#000000" },
                                                backdropFilter: "blur(12px)",
                                                WebkitBackdropFilter: "blur(12px)",
                                                background: darkModeReducer ? "rgba(8,8,10,0.78)" : "rgba(255,255,255,0.05)",
                                                color: darkModeReducer ? "#ffffff" : "#000000",
                                                boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
                                                border: "1px solid rgba(255,255,255,0.15)",
                                                "&:hover": {
                                                    background: darkModeReducer ? "rgba(8,8,10,0.88)" : "rgba(255,255,255,0.12)",
                                                    boxShadow: "0px 6px 16px rgba(0,0,0,0.4)",
                                                    borderColor: "rgba(255,255,255,0.3)",
                                                },
                                                "&.Mui-disabled": {
                                                    backgroundColor: "rgba(255,255,255,0.05)",
                                                    ///   color: "rgba(255,255,255,0.4)",
                                                    borderColor: "rgba(255,255,255,0.1)",
                                                },
                                            }}
                                        >
                                            {/* Centered text block; scales to fit width Scene */}



                                            <Box
                                                component="span"
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 1,
                                                    width: "100%",
                                                    flexWrap: "wrap", // allow wrap on tiny screens
                                                    lineHeight: 1.2,
                                                    textAlign: "center",
                                                    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',

                                                    letterSpacing: "0.02em",
                                                }}

                                            >
                                                <Box component="span" sx={{
                                                    fontWeight: 700, whiteSpace: "nowrap", fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                                    fontSize: '1.1471rem',
                                                    color: darkModeReducer ? "#ffffff" : "#000000",
                                                    letterSpacing: "0.02em",
                                                }}>
                                                    Start
                                                </Box>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        opacity: 0.8,
                                                        fontSize: '0.9056rem',
                                                        color: darkModeReducer ? "#ffffff" : "#000000",
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {price4all.toLocaleString()}{" "}
                                                    {price4all === 1 ? "PIXEL" : "PIXELS"}
                                                </Box>
                                            </Box>
                                        </Button>
                                    </Box>
                                )}

                                {
                                    <Box
                                        onClick={() => {
                                            removeFromStep(index);

                                        }}
                                        sx={{
                                            cursor: "pointer",
                                            position: "absolute",
                                            top: "3%",
                                            right: "80%",
                                            width: "100%",
                                            height: "0px",
                                            backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                            display: type === 0 ?

                                                allowgetImage ? 'none' :
                                                    VideMode ? 'none' : 'none' : VideMode ? 'none' : 'none',
                                            alignItems: "right",
                                            justifyContent: "right",
                                            zIndex: 3, // Above overlay and images
                                            borderRadius: 2,
                                            fontSize: "5vh",
                                            fontWeight: "bold",
                                            color: "#ffffff", // Text color
                                            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)", // Text shadow for visibility
                                        }}
                                    >
                                        <DeleteOutlineIcon sx={{ mr: 1, fontSize: "inherit" }} />

                                    </Box>
                                }

                                <Box
                                    sx={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        width: "100%",
                                        padding: "40px 16px 12px 16px",
                                        background: (generatedImagesFlux[index] || generatedImages?.[index] || nanoImages?.[index])
                                            ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)"
                                            : "transparent",
                                        zIndex: 10,
                                        borderBottomLeftRadius: "12px",
                                        borderBottomRightRadius: "12px",
                                        pointerEvents: "none", // Let clicks pass through the gradient background
                                    }}
                                >
                                    <Typography
                                        {...cb('storybook_grid', `read_scene_${index + 1}`, `Read ${displayLabel({ type: 'A', index })} text`, 'setPromptPreviewIndex')}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Interactions opens the node map first;
                                            // a circle in there opens this same
                                            // scene preview. Other modes unchanged.
                                            openSceneText(index);
                                        }}
                                        sx={{
                                            pointerEvents: "auto", // Re-enable clicks just for the text
                                            cursor: "pointer",
                                            color: (generatedImagesFlux[index] || generatedImages?.[index] || nanoImages?.[index])
                                                ? "#fff"
                                                : (darkModeReducer ? "#fff" : "#111"),
                                            textShadow: (generatedImagesFlux[index] || generatedImages?.[index] || nanoImages?.[index])
                                                ? "0px 1px 3px rgba(0,0,0,0.8)"
                                                : "none",
                                            fontSize: matchMobile ? "0.85rem" : "0.9rem",
                                            fontWeight: 400,
                                            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                            display: "-webkit-box",
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {type === 1 ? (index % 2 === 0 ? (typeof steps2[Math.floor(index / 2)] === 'object' && steps2[Math.floor(index / 2)] !== null ? (steps2[Math.floor(index / 2)] as any).text : steps2[Math.floor(index / 2)]) : '') : steps[index]}
                                    </Typography>
                                </Box>
                            </div>

                            {/* B SHOT INTERLEAVING (Only shown when B Shot Mode is active) */}
                            {isBShotModeActive && (bShotPrompts?.[index] || []).map((bShotPrompt, bIndex) => {
                                const bShotImg = bShotImages?.[index]?.[bIndex];
                                const nanoImg = bShotNanoImages?.[index]?.[bIndex];
                                const isGenerated = !!bShotImg && bShotImg !== "EMPTY_BSHOT";
                                const isNano = !isGenerated && !isValidVideo(bShotVideos?.[index]?.[bIndex]) && !!nanoImg && nanoImg !== "EMPTY_BSHOT";
                                const finalImageToShow = isGenerated ? bShotImg : nanoImg;
                                const isFilled = isGenerated || isNano || isValidVideo(bShotVideos?.[index]?.[bIndex]);
                                const isBShotLoaderActive = !!isBShotGenerating?.[index]?.[bIndex] || (bShotLoaders?.[index]?.[bIndex] || 0) > 0;

                                return (
                                    <div data-scene-card
                                        key={`bshot-${index}-${bIndex}`} data-creation-scene-key={sceneDeckKey(index, bIndex)}
                                        style={{
                                            flex: "0 0 auto", // ensure each item doesn’t shrink
                                            width: (ratioKey === 3)
                                                ? (matchMobile ? "100%" : "calc(33.333% - 0.666rem)")
                                                : (ratioKey === 2)
                                                    ? (matchMobile ? "100%" : "calc(25% - 0.75rem)")
                                                    : (matchMobile ? "calc(50% - 0.5rem)" : "calc(20% - 0.8rem)"),
                                            height: "auto",
                                            ...(matchMobile ? {} : {
                                                width: ratioKey === 1 ? "calc((100% - 4rem) / 5)" : (ratioKey === 2 ? "calc((100% - 3rem) / 4)" : "calc((100% - 2rem) / 3)"),
                                                minWidth: 0,
                                            }),
                                            position: "relative",
                                            borderRadius: "4px",
                                            overflow: "hidden",
                                            padding: '0px',
                                            marginBottom: "1.5rem",
                                        }}
                                    >
                                        <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                            {!isNano && <SceneNumberBadge number={sceneDisplayForTarget(sceneDisplayMap.entries, { type: 'B', index, bIndex })?.displaySceneNumber} />}
                                            {isFilled ? (
                                                isNano ? (
                                                    <Box sx={{
                                                        position: 'relative',
                                                        height: '55%',
                                                        aspectRatio: '9/16',
                                                        display: 'flex',
                                                        margin: 'auto',
                                                        boxSizing: 'border-box'
                                                    }}>
                                                        <SceneNumberBadge number={sceneDisplayForTarget(sceneDisplayMap.entries, { type: 'B', index, bIndex })?.displaySceneNumber} />
                                                        <Typography data-scene-preview
                                                            sx={{
                                                                position: 'absolute',
                                                                top: '6px',
                                                                left: '6px',
                                                                zIndex: 4,
                                                                bgcolor: 'rgba(0, 0, 0, 0.72)',
                                                                backdropFilter: 'blur(8px)',
                                                                color: '#ffffff',
                                                                px: 0.8,
                                                                py: 0.18,
                                                                borderRadius: '4px',
                                                                fontSize: matchMobile ? '0.68rem' : '0.58rem',
                                                                fontWeight: 850,
                                                                letterSpacing: '0.06em',
                                                                textTransform: 'uppercase',
                                                                pointerEvents: 'none',
                                                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                                                boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                                                            }}
                                                        >
                                                            PREVIEW
                                                        </Typography>
                                                        <img
                                                            {...gridSceneEntryBinding(`open_bshot_${index + 1}_${bIndex + 1}`, { type: 'B', index, bIndex })}
                                                            src={finalImageToShow}
                                                            alt={`B-roll ${index + 1}.${bIndex + 1}`}
                                                            style={{
                                                                width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                                opacity: 0.5,
                                                                cursor: "pointer",
                                                                borderRadius: "12px",
                                                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                                                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                                                            }}
                                                            onClick={() => {
                                                                enterSceneFromGrid(index, bIndex);
                                                            }}
                                                        />
                                                        <Box
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                enterSceneFromGrid(index, bIndex);
                                                            }}
                                                            sx={{
                                                                position: 'absolute',
                                                                top: '12px',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                background: "rgba(0,0,0,0.4)",
                                                                backdropFilter: "blur(6px)",
                                                                borderRadius: "50%",
                                                                border: '2px solid rgba(255,255,255,0.6)',
                                                                padding: "12px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                cursor: "pointer",
                                                                zIndex: 2,
                                                                transition: 'all 0.2s',
                                                                '&:hover': {
                                                                    transform: 'translateX(-50%) scale(1.15)',
                                                                    background: 'rgba(0,0,0,0.6)',
                                                                    border: '2px solid rgba(255,255,255,0.9)',
                                                                }
                                                            }}
                                                        >
                                                            <AddIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 40 }} />
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                                                        <img
                                                            {...gridSceneEntryBinding(`open_bshot_${index + 1}_${bIndex + 1}`, { type: 'B', index, bIndex })}
                                                            src={finalImageToShow}
                                                            alt={`B-roll ${index + 1}.${bIndex + 1}`}
                                                            style={{
                                                                width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                                cursor: "pointer",
                                                                borderRadius: "12px",
                                                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                                                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                                                            }}
                                                            onClick={() => {
                                                                enterSceneFromGrid(index, bIndex);
                                                            }}
                                                        />
                                                    </Box>
                                                )
                                            ) : (
                                                /* --- B SHOT EMPTY GLASS PLACEHOLDER --- */
                                                <Box
                                                    sx={{
                                                        width: "100%",
                                                        height: "100%",
                                                        aspectRatio: matchMobile ? (ratioKey === 1 ? '1 / 1' : '16 / 9') : '4 / 3',
                                                        borderRadius: "12px",
                                                        background: darkModeReducer ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.06)",
                                                        backdropFilter: "blur(24px)",
                                                        border: darkModeReducer ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed rgba(255, 255, 255, 0.25)",
                                                        boxShadow: darkModeReducer ? "inset 0 0 20px rgba(0,0,0,0.8)" : "0 4px 15px rgba(0,0,0,0.05)",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        justifyContent: automaticNarrationBShots ? "flex-start" : "center",
                                                        paddingTop: automaticNarrationBShots ? "12px" : 0,
                                                        cursor: "pointer",
                                                        transition: 'all 0.3s ease',
                                                        '&:hover': {
                                                            background: "rgba(255, 255, 255, 0.08)",
                                                            transform: 'scale(0.98)'
                                                        }
                                                    }}
                                                    onClick={() => {
                                                        enterSceneFromGrid(index, bIndex);
                                                    }}
                                                    {...gridSceneEntryBinding(`add_bshot_${index + 1}_${bIndex + 1}`, { type: 'B', index, bIndex })}
                                                >
                                                    {!automaticNarrationBShots ? renderOptionalBShotsButton(index, bIndex) : <Box sx={{
                                                        background: "rgba(255,255,255,0.1)",
                                                        backdropFilter: "blur(4px)",
                                                        borderRadius: "50%",
                                                        padding: "12px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center"
                                                    }}>
                                                        <AddIcon sx={{
                                                            fontSize: 32,
                                                            color: darkModeReducer ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)"
                                                        }} />
                                                    </Box>}
                                                </Box>
                                            )}

                                            {/* DELETE ICON for B-Shot Mode */}
                                            {(isGenerated || isValidVideo(bShotVideos?.[index]?.[bIndex])) && (
                                                <Box
                                                    {...cb('storybook_grid', `request_delete_bshot_${index + 1}_${bIndex + 1}`, `Request deletion of B-roll ${index + 1}.${bIndex + 1}`, 'setPendingDelete')}
                                                    onClick={(e) => { e.stopPropagation(); setPendingDelete({ index, bIndex, type: 'bshot' }); }}
                                                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10, cursor: 'pointer', color: '#fff', '&:hover': { transform: 'scale(1.1)' }, transition: 'transform 0.2s' }}
                                                >
                                                    <PanoramaFishEyeIcon sx={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))', fontSize: 28 }} />
                                                </Box>
                                            )}

                                            {/* DELETE OVERLAY for B-Shot Mode */}
                                            {pendingDelete?.type === 'bshot' && pendingDelete?.index === index && pendingDelete?.bIndex === bIndex && (
                                                <Box sx={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20,
                                                    backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: "12px",
                                                }} onClick={(e) => e.stopPropagation()}>
                                                    <Typography sx={{ color: '#fff', mb: 2, fontWeight: 'bold', textAlign: 'center' }}>Delete Video<br />& images</Typography>
                                                    <Stack direction="row" spacing={2}>
                                                        <Button {...cb('storybook_grid', `confirm_delete_bshot_${index + 1}_${bIndex + 1}`, `Delete B-roll ${index + 1}.${bIndex + 1} media`, 'confirmDelete', 'click', 'needs_confirmation')} variant="contained" color="error" size="small" onClick={(e) => { e.stopPropagation(); confirmDelete(); }}>Yes</Button>
                                                        <Button {...cb('storybook_grid', `cancel_delete_bshot_${index + 1}_${bIndex + 1}`, `Keep B-roll ${index + 1}.${bIndex + 1} media`, 'setPendingDelete')} variant="outlined" size="small" sx={{ color: '#fff', borderColor: '#fff' }} onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}>No</Button>
                                                    </Stack>
                                                </Box>
                                            )}

                                            {/* GLOBAL OVERLAYS FOR THE B-SHOT THUMBNAIL */}
                                            {((VideMode || isValidVideo(bShotVideos?.[index]?.[bIndex])) && isFilled && !isNano && !isBShotLoaderActive) && (
                                                <Box
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (Donex) {
                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                            setActiveBShotEdit(bIndex);
                                                        }
                                                    }}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: isValidVideo(bShotVideos?.[index]?.[bIndex]) ? '50px' : 'auto',
                                                        height: isValidVideo(bShotVideos?.[index]?.[bIndex]) ? '50px' : 'auto',
                                                        padding: isValidVideo(bShotVideos?.[index]?.[bIndex]) ? 0 : '6px 16px',
                                                        borderRadius: isValidVideo(bShotVideos?.[index]?.[bIndex]) ? '50%' : '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: 'rgba(0, 0, 0, 0.5)',
                                                        border: '2px solid rgba(255,255,255,0.8)',
                                                        backdropFilter: 'blur(4px)',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                        zIndex: 3,
                                                        transition: 'transform 0.2s',
                                                        '&:hover': { transform: 'translate(-50%, -50%) scale(1.1)' }
                                                    }}
                                                >
                                                    {isValidVideo(bShotVideos?.[index]?.[bIndex]) ? (
                                                        <PlayArrowIcon sx={{ color: '#fff', fontSize: '1.8rem' }} />
                                                    ) : (
                                                        <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                            CREATE MOTION
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                            {isBShotLoaderActive && (
                                                <Box sx={{
                                                    position: "absolute",
                                                    top: 0, left: 0, right: 0, bottom: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    zIndex: 300,
                                                    cursor: "pointer",
                                                    pointerEvents: "none",
                                                }}>
                                                    <GlowWidthBar
                                                        value={bShotLoaders?.[index]?.[bIndex] || 0}
                                                        matchMobile={matchMobile}
                                                        index={index}
                                                    />
                                                </Box>
                                            )}
                                        </Box>

                                        <Box
                                            sx={{
                                                position: "absolute",
                                                bottom: 0,
                                                left: 0,
                                                width: "100%",
                                                padding: "40px 16px 12px 16px",
                                                background: isFilled
                                                    ? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)"
                                                    : "transparent",
                                                zIndex: 10,
                                                borderBottomLeftRadius: "12px",
                                                borderBottomRightRadius: "12px",
                                                pointerEvents: "none",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center"
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    color: isFilled ? "#fff" : (darkModeReducer ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"),
                                                    fontSize: matchMobile ? "0.85rem" : "0.9rem",
                                                    fontWeight: 600,
                                                    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.1em"
                                                }}
                                            >
                                                {`B-roll ${index + 1}.${bIndex + 1}`}
                                            </Typography>
                                            {bShotPrompt && bShotPrompt.match(/\[B-Shot(?:-Pending)? (\d+s)\]/) && (
                                                <Typography
                                                    sx={{
                                                        color: isFilled ? "#fff" : (darkModeReducer ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"),
                                                        fontSize: matchMobile ? "0.85rem" : "0.9rem",
                                                        fontWeight: 600,
                                                        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.1em",
                                                    }}
                                                >
                                                    {`Narration ${bShotPrompt.match(/\[B-Shot(?:-Pending)? (\d+s)\]/)?.[1]}`}
                                                </Typography>
                                            )}
                                        </Box>
                                    </div>
                                );
                            })}
                        </React.Fragment>);
                })}
            </Box >

            <Box
                id="bottom-buttons-container"
                sx={{
                    display: minimizeMode !== 2 ? "flex" : "none",
                    visibility: minimizeMode === 1 ? "hidden" : "visible",
                    // The generating-fade moved onto the buttons (see
                    // storyActionGlassSx) so the Auto toggle can stay clickable.
                    width: "100%",
                    transition: "opacity 0.3s ease",
                    gap: 1, // Adds spacing between the two buttons
                    alignItems: "center",
                    px: matchMobile ? 2 : 4, // Optional: padding on the container so buttons don't touch the screen edges
                    marginTop: "auto",
                    paddingTop: "0.5rem",
                    paddingBottom: "1vh",
                    flexShrink: 0,
                    zIndex: 2000,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        width: "100%",
                        marginTop: "3px",
                        gap: "8px", // space between the two buttons
                    }}
                >

                    <Box
                        sx={{
                            display: "flex",
                            width: "100%",
                            maxWidth: { sm: "50%" }, // PC: cap button bar at half-width
                            mx: { sm: "auto" }, // PC: center the bar
                            marginTop: "3px",
                            gap: "8px", // Consistent gap
                            alignItems: "center", // Center vertically
                        }}
                    >
                        {/* 1. BACK BUTTON */}
                        <Button
                            {...backStoryboardBinding} onClick={backStoryboard}
                            variant="contained"
                            color="inherit"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* In Videos/B-shots Back shares the row via flex; on the plain
                                   Images page it sizes like a normal button (no ballooning) */
                                flex: (VideMode || isBShotModeActive) ? { xs: 0.5, sm: 0.6 } : '0 0 auto',
                                minWidth: (VideMode || isBShotModeActive) ? 'auto' : (matchMobile ? 56 : 120), // icon-only pill on mobile
                                mx: (VideMode || isBShotModeActive) ? 0 : 'auto', // center when alone

                                display: isLoading ? 'none' : 'flex', // visible on Images too, but hidden while uploading/saving
                                ...buttonPadding,
                                px: matchMobile ? 1 : 3, // Tighter padding on mobile
                                ...storyActionGlassSx,
                            }}
                        >
                            <ArrowBackIosIcon sx={{ fontSize: "1.3em", mr: matchMobile ? 0 : 0.5 }} />
                            {/* Hide text on mobile */}
                            {!matchMobile && (
                                <Typography variant="button" sx={{ whiteSpace: "nowrap" }}>
                                    Back
                                </Typography>
                            )}
                        </Button>

                        {/* 1b. AUTO IMAGE RUNNER TOGGLE
                            Sits left of Continue/Publish. Icon-only on mobile so
                            the row still fits at 320px. Unlike its neighbours it
                            stays visible while generating — it is the only way to
                            stop the run. */}
                        {canShowAutoImageRunner && (
                            <Button
                                {...(autoImageRunnerOn
                                    ? cb('storybook_grid', 'stop_auto_images', 'Stop starting new HD images', 'toggleAutoImageRunner')
                                    : cb('storybook_grid', 'start_auto_images', `Auto-generate ${pendingPrimaryImages} primary and ${pendingBShotImages} B-roll HD images`, 'toggleAutoImageRunner', 'click', 'candidate'))}
                                onClick={toggleAutoImageRunner}
                                variant="contained"
                                color="inherit"
                                disableRipple
                                disableFocusRipple
                                aria-pressed={autoImageRunnerOn}
                                title={autoImageRunnerOn
                                    ? "Auto is on — stop starting new images"
                                    : `Auto-generate the ${autoPendingIndexes.length} remaining image${autoPendingIndexes.length === 1 ? "" : "s"}`}
                                sx={{
                                    flex: "0 0 auto",
                                    minWidth: matchMobile ? 44 : 110,
                                    ...buttonPadding,
                                    px: matchMobile ? 1 : 3,
                                    ...storyActionGlassSx,
                                    // Opt back in to the fade the shared glass style applies.
                                    opacity: 1,
                                    pointerEvents: "auto",
                                    ...(autoImageRunnerOn ? {
                                        background: `linear-gradient(135deg, ${alpha(appColor, 0.85)}, ${alpha(darken(appColor, 0.18), 0.95)})`,
                                        color: darkModeReducer ? "#000" : "#fff",
                                        border: "none",
                                        "&:hover": {
                                            background: `linear-gradient(135deg, ${appColor}, ${darken(appColor, 0.18)})`,
                                        },
                                    } : {}),
                                }}
                            >
                                <Stack direction="row" alignItems="center" spacing={matchMobile ? 0 : 1} justifyContent="center">
                                    <AutoModeIcon
                                        sx={{
                                            fontSize: "1.25rem",
                                            animation: autoImageRunnerOn ? "storyAutoSpin 2.4s linear infinite" : "none",
                                            "@keyframes storyAutoSpin": {
                                                from: { transform: "rotate(0deg)" },
                                                to: { transform: "rotate(360deg)" },
                                            },
                                        }}
                                    />
                                    {!matchMobile && (
                                        <Typography variant="button" sx={{ whiteSpace: "nowrap" }}>
                                            {autoImageRunnerOn ? `Auto ${autoPendingIndexes.length}` : "Auto"}
                                        </Typography>
                                    )}
                                </Stack>
                            </Button>
                        )}

                        {/* 2. PUBLISH BUTTON (NEW) */}
                        <Button
                            {...publishStoryboardBinding} onClick={publishStoryboard}
                            variant="contained"
                            color="primary"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                flex: { xs: 0.5, sm: 0.6 },
                                minWidth: "auto",
                                display: isBShotModeActive ? 'flex' : 'none',
                                ...buttonPadding,
                                px: matchMobile ? 1 : 3,
                                ...storyActionGlassSx,
                                background: darkModeReducer
                                    ? `linear-gradient(135deg, ${alpha(appColor, 0.8)}, ${alpha(darken(appColor, 0.18), 0.9)})`
                                    : `linear-gradient(135deg, ${alpha(appColor, 0.8)}, ${alpha(darken(appColor, 0.18), 0.9)})`,
                                color: darkModeReducer ? "#000" : "#FFF",
                                border: "none",
                                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    transform: "scale(1.02)",
                                    background: darkModeReducer
                                        ? `linear-gradient(135deg, ${appColor}, ${darken(appColor, 0.18)})`
                                        : `linear-gradient(135deg, ${appColor}, ${darken(appColor, 0.18)})`,
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                                }
                            }}
                        >
                            <Typography variant="button" sx={{ whiteSpace: "nowrap", fontWeight: "bold" }}>
                                {isSpatialInteraction ? "Preview" : "Publish"}
                            </Typography>
                        </Button>

                        {!isBShotModeActive && (
                            <>
                                {/* 2. WORLD MODEL BUTTON (New) */}
                                {/* Only show if VideMode is active (based on your layout flow) */}
                                {VideMode && (
                                    <Button
                                        variant="contained"
                                        {...cb('storybook_grid', 'create_world', 'Open World Creation from this post', 'setShowWorldModel2')}
                                        onClick={() => setShowWorldModel2(true)} // Your handler here
                                        disableRipple
                                        disableFocusRipple
                                        sx={{
                                            /* Flex Sizing: Fixed square-ish on both */
                                            flex: "0 0 auto",
                                            width: matchMobile ? 50 : 60,
                                            minWidth: 0,
                                            ...buttonPadding,
                                            ...storyActionGlassSx,
                                        }}
                                    >
                                        <PublicIcon sx={{ fontSize: "1.6rem" }} />
                                    </Button>
                                )}

                                {/* 3. PUBLISH BUTTON (Middle) */}
                                <Button
                                    {...nextStoryboardBinding} onClick={nextStoryboard}
                            variant="contained"
                                    color="inherit"
                                    disableRipple
                                    disableFocusRipple
                                    sx={{
                                        /* Flex Sizing: Takes the most space Publish*/
                                        flex: 1.5,
                                        mt: "3px",
                                        ...buttonPadding,
                                        ...storyActionGlassSx,
                                        backgroundColor: darkModeReducer ? "#000000" : "#ffffff",
                                        color: darkModeReducer ? "#ffffff" : "#000000",
                                        '&:hover': {
                                            backgroundColor: darkModeReducer ? "#333333" : "#f0f0f0"
                                        },
                                        display: Done ? (HideSave ? "none" : "block") : "none",
                                    }}
                                >
                                    {HaltPublish ? "Use Images" : VideMode ? (musicMode ? "Debut" : "Next") : "Continue"}
                                </Button>

                                {/* 4. SAVE / MUSIC BUTTON (Right) */}
                                {!isStoryMusicVideoMode && (
                                    <Button
                                        {...musicStoryboardBinding} onClick={openStoryboardMusic}
                            variant="contained"
                                        color="inherit"
                                        disableRipple
                                        disableFocusRipple
                                        sx={{
                                            /* Flex Sizing: Small on mobile, larger on PC */
                                            flex: { xs: 0.4, sm: 0.6 },
                                            minWidth: matchMobile ? "auto" : "120px", // Force wider on PC
                                            ...buttonPadding,
                                            px: matchMobile ? 1 : 3, // Tight on mobile
                                            ...storyActionGlassSx,
                                            /* Music yields to Auto on the narrowest phones: four controls
                                               do not fit at 320px, and Auto only appears while images are
                                               still missing — Music returns the moment it is done. */
                                            display: (() => {
                                                const shown = Done ? (HideSave ? "none" : type === 3 ? 'none' : "block") : "none";
                                                return { xs: canShowAutoImageRunner ? "none" : shown, sm: shown };
                                            })(),
                                            /* Re-apply the dimmed "unavailable" look after the shared glass
                                               style, which sets its own opacity for the generating fade. */
                                            opacity: anyGenerating
                                                ? 0
                                                : ((steps.length === 1 && type === 0) || (steps.length === 1 && type === 3) ? 0.3 : 1),
                                        }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                                            {MemeMusic ? (
                                                <>
                                                    {VideMode ? (
                                                        HaltPublish ? (
                                                            <ReportOffIcon fontSize="small" sx={{ color: "red", transform: "scale(1.6)" }} />
                                                        ) : (
                                                            <MusicNoteIcon fontSize="small" />
                                                        )
                                                    ) : (
                                                        <MusicNoteIcon fontSize="small" sx={{ color: "inherit", p: 0 }} />
                                                    )}

                                                    {/* Hide Text on Mobile */}
                                                    {!matchMobile && (
                                                        <Typography variant="button" sx={{ whiteSpace: "nowrap" }}>
                                                            {VideMode
                                                                ? HaltPublish
                                                                    ? "All"
                                                                    : "Music"
                                                                : musicname}
                                                        </Typography>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {VideMode ? (
                                                        HaltPublish ? (
                                                            <ReportOffIcon fontSize="small" sx={{ color: "red", transform: "scale(1.6)" }} />
                                                        ) : (
                                                            <MusicNoteIcon fontSize="small" />
                                                        )
                                                    ) : (
                                                        <VolumeUpIcon fontSize="small" />
                                                    )}

                                                    {/* Hide Text on Mobile */}
                                                    {!matchMobile && (
                                                        <Typography variant="button" sx={{ whiteSpace: "nowrap" }}>
                                                            {VideMode
                                                                ? HaltPublish
                                                                    ? "All"
                                                                    : "Music"
                                                                : Name}
                                                        </Typography>
                                                    )}
                                                </>
                                            )}
                                        </Stack>
                                    </Button>
                                )}
                            </>
                        )}

                    </Box>

                    {MemeMusic ?


                        showVoices ? <AudioPicker
                            // activatevoicenarration={activatevoicenarration}
                            forceMusicMode
                            VideMode={VideMode}
                            type={type}
                            music={music}
                            setmusicname={setmusicname}
                            setmusic={setmusic}
                            MemeMusic={MemeMusic}
                            setMemeMusic={setMemeMusic}
                            setName={setName}
                            showVoicesList={showVoices}
                            selectedVoice={voice}
                            onClose={() => setShowVoices(false)}
                            onSelectVoice={(id: any) => {
                                setVoice(id);
                                setShowVoices(false);
                            }}
                        /> : null :

                        showVoices ?
                            <VoicePicker
                                MemeMusic={MemeMusic}
                                type={type}
                                setMemeMusic={setMemeMusic}
                                setName={setName}
                                showVoicesList={showVoices}
                                selectedVoice={voice}
                                onClose={() => setShowVoices(false)}
                                onSelectVoice={(id) => {
                                    setVoice(id);
                                    setShowVoices(false);
                                }}
                            /> : null}
                </Box>



                <InteractionNodeMap
                    open={showNodeMap}
                    onClose={() => setShowNodeMap(false)}
                    planGraph={nodeMapPlan}
                    title="Interaction map"
                    onSelectNode={(nodeId, sceneIndex) => {
                        // A circle opens the ordinary scene preview on top of the
                        // map, so closing it lands back here rather than in the grid.
                        const fromPlan = nodeMapPlan.nodes.findIndex((n) => n.id === nodeId);
                        const target = sceneIndex ?? (fromPlan >= 0 ? fromPlan : null);
                        if (target === null) return;
                        setPromptPreviewIndex(target);
                        setHideExpandedSceneText(false);
                    }}
                />

                <Modal
                    open={promptPreviewIndex !== null && !deckVisible}
                    onClose={() => setPromptPreviewIndex(null)}
                >
                    <Box
                        {...cb('storybook_preview', 'close', 'Close scene text preview', 'setPromptPreviewIndex')}
                        onClick={() => setPromptPreviewIndex(null)}
                        sx={{
                            position: 'fixed', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3,
                            bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999
                        }}
                    >

                        <Box
                            id="scenes-glass-slider-storybook"
                            sx={{
                                width: '100%',
                                maxWidth: '100vw',
                                height: matchMobile ? '75vh' : '100vh',
                                display: 'flex',
                                alignItems: 'center',
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                scrollSnapType: 'x mandatory',
                                '::-webkit-scrollbar': { display: 'none' },
                                p: 0,
                                outline: 'none'
                            }}
                        >
                            {/* Left Hitbox */}
                            <Box
                                {...cb('storybook_preview', 'previous', 'Previous scene in text preview', 'scrollBy')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const slider = document.getElementById('scenes-glass-slider-storybook');
                                    if (slider) slider.scrollBy({ left: -window.innerWidth, behavior: 'smooth' });
                                }}
                                sx={{
                                    position: 'fixed', left: 0, top: 0, bottom: 0, width: '20%',
                                    display: matchMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', zIndex: 99999, transition: 'background 0.2s',
                                    background: 'transparent',
                                    '&:hover': { background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)' },
                                    '&:active': { background: 'linear-gradient(to right, rgba(255,255,255,0.15), transparent)' }
                                }}
                            />

                            {/* Right Hitbox */}
                            <Box
                                {...cb('storybook_preview', 'next', 'Next scene in text preview', 'scrollBy')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const slider = document.getElementById('scenes-glass-slider-storybook');
                                    if (slider) slider.scrollBy({ left: window.innerWidth, behavior: 'smooth' });
                                }}
                                sx={{
                                    position: 'fixed', right: 0, top: 0, bottom: 0, width: '20%',
                                    display: matchMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', zIndex: 99999, transition: 'background 0.2s',
                                    background: 'transparent',
                                    '&:hover': { background: 'linear-gradient(to left, rgba(255,255,255,0.05), transparent)' },
                                    '&:active': { background: 'linear-gradient(to left, rgba(255,255,255,0.15), transparent)' }
                                }}
                            />

                            {steps && steps.map((scene: any, idx: number) => {
                                const previewImg = generatedImagesFlux[idx] || generatedImages?.[idx] || nanoImages?.[idx];
                                const isExpanded = hideExpandedSceneText;

                                return (
                                    <Box
                                        key={idx}
                                        ref={(el: HTMLDivElement | null) => { if (sceneElementsRef.current) sceneElementsRef.current[idx] = el; }}
                                        sx={{
                                            flex: '0 0 100vw',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            scrollSnapAlign: 'center',
                                            px: { xs: 2, sm: 8 },
                                            outline: 'none',
                                            cursor: 'zoom-out'
                                        }}
                                    >
                                        <Box
                                            {...cb('storybook_preview', `toggle_scene_${idx + 1}`, `Expand or collapse scene ${idx + 1} text`, 'setHideExpandedSceneText')}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (previewImg) {
                                                    setHideExpandedSceneText(!hideExpandedSceneText);
                                                }
                                            }}
                                            sx={{
                                                position: 'relative',
                                                overflow: 'hidden',
                                                borderRadius: 4,
                                                minHeight: previewImg ? 'auto' : '40vh',
                                                minWidth: previewImg ? 'auto' : '250px',
                                                maxWidth: '100%',
                                                bgcolor: darkModeReducer ? "rgba(20, 20, 25, 0.85)" : "rgba(255, 255, 255, 0.85)",
                                                backdropFilter: 'blur(20px)',
                                                boxShadow: darkModeReducer ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.1)",
                                                border: darkModeReducer ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(255,255,255,0.4)",
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: previewImg ? 'flex-end' : 'center',
                                                cursor: previewImg ? 'pointer' : 'default',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            {previewImg && (
                                                <img
                                                    src={previewImg}
                                                    alt="Scene preview"
                                                    style={{
                                                        display: 'block',
                                                        maxWidth: '100%',
                                                        maxHeight: matchMobile ? '75vh' : '85vh',
                                                        width: 'auto',
                                                        height: 'auto',
                                                        objectFit: 'contain',
                                                        zIndex: 0,
                                                        opacity: 1,
                                                        animation: 'majesticFade 0.5s ease-out forwards',
                                                        filter: isExpanded ? 'brightness(0.45) blur(3px)' : 'none',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                />
                                            )}
                                            {!previewImg && (
                                                <Box sx={{
                                                    position: 'absolute', inset: 0, zIndex: 0, opacity: 0.1,
                                                    background: `linear-gradient(135deg, #FFB4B4 0%, ${appColor} 100%)`,
                                                    animation: 'pulseBg 2s infinite alternate'
                                                }} />
                                            )}
                                            {previewImg && isExpanded && (
                                                <IconButton
                                                    {...cb('storybook_preview', `delete_scene_${idx + 1}`, `Review deleting scene ${idx + 1}; does not delete`, 'setPendingSceneDeleteIndex')}
                                                    aria-label="Delete scene"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPendingSceneDeleteIndex(idx);
                                                    }}
                                                    size="small"
                                                    sx={{
                                                        position: 'absolute',
                                                        top: { xs: 10, sm: 12 },
                                                        right: { xs: 10, sm: 12 },
                                                        zIndex: 3,
                                                        width: 36,
                                                        height: 36,
                                                        color: 'rgba(255,255,255,0.9)',
                                                        background: 'rgba(0,0,0,0.45)',
                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                        backdropFilter: 'blur(8px)',
                                                        '&:hover': { color: '#ff5252', background: 'rgba(0,0,0,0.65)' }
                                                    }}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            )}

                                            <Box sx={{
                                                position: previewImg ? 'absolute' : 'relative',
                                                bottom: previewImg ? 0 : 'auto',
                                                left: previewImg ? 0 : 'auto',
                                                width: previewImg ? '100%' : 'auto',
                                                height: isExpanded ? (matchMobile ? '80%' : '100%') : 'auto',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: isExpanded ? 'center' : 'flex-end',
                                                zIndex: 1,
                                                background: previewImg
                                                    ? (isExpanded ? 'transparent' : (darkModeReducer ? 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.9))' : 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))'))
                                                    : (darkModeReducer ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'),
                                                p: previewImg ? (isExpanded ? { xs: 3, sm: 6 } : 2) : 2,
                                                pt: previewImg ? (isExpanded ? { xs: 4, sm: 8 } : 4) : 2,
                                                borderRadius: previewImg ? (isExpanded ? '12px' : 0) : 2,
                                                backdropFilter: previewImg ? (isExpanded ? 'none' : 'none') : 'blur(10px)',
                                                textAlign: previewImg ? (isExpanded ? 'center' : 'center') : 'center',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                {!previewImg && (
                                                    <Typography sx={{
                                                        color: appColor,
                                                        fontWeight: 800, mb: 1, fontSize: '1.2rem',
                                                        textShadow: darkModeReducer ? '0 2px 4px rgba(0,0,0,0.8)' : 'none'
                                                    }}>
                                                        Accessing Imagination...
                                                    </Typography>
                                                )}
                                                {previewImg && isExpanded && (
                                                    <Box sx={{
                                                        display: 'flex', alignItems: 'center',
                                                        justifyContent: 'center', mb: 1.5
                                                    }}>
                                                        <Typography sx={{
                                                            color: "#ffffff",
                                                            fontWeight: 900, fontSize: '1.2rem',
                                                            textTransform: 'uppercase', letterSpacing: 2,
                                                            textShadow: '0 2px 10px rgba(0,0,0,1)'
                                                        }}>
                                                            Scene {idx + 1}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                <Typography sx={{
                                                    color: previewImg ? "rgba(255,255,255,0.95)" : (darkModeReducer ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)"),
                                                    fontSize: previewImg ? (isExpanded ? { xs: '0.85rem', sm: '1.0rem' } : '0.8rem') : '0.9rem',
                                                    lineHeight: isExpanded ? 1.6 : 1.4,
                                                    fontStyle: previewImg && !isExpanded ? 'normal' : 'italic',
                                                    display: isExpanded ? 'block' : '-webkit-box',
                                                    overflow: isExpanded ? 'auto' : 'hidden',
                                                    WebkitBoxOrient: 'vertical',
                                                    WebkitLineClamp: isExpanded ? 'none' : (previewImg ? 2 : 4),
                                                    textShadow: previewImg ? '0 1px 5px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,1)' : (darkModeReducer ? '0 1px 3px rgba(0,0,0,0.8)' : 'none'),
                                                    transition: 'all 0.3s ease'
                                                }}>
                                                    {getScenePopupText(idx)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>

                        {sceneDeleteConfirmation}
                    </Box>
                </Modal>


                <StepsDialog
                    open={open}
                    onClose={() => setOpen(false)}
                    title={prompt}               // your long prompt/title
                    steps={steps}
                    activeIndex={activeEdit}                    // string[]
                    onEdit={() => {

                        setstartEdit(true);
                        setactiveEdit(activeEdit);
                        setOpen(false);
                        setnarrate(1);
                    }}
                    darkMode={darkModeReducer}
                />

                <EditStory
                    creationDraft={creationDraft}
                    savedVideoUpscales={savedVideoUpscales}
                    videoHistory={videoHistory}
                    onVideoMediaStored={onVideoMediaStored}
                    onImageMediaStored={onImageMediaStored}
                    manualOnlyVideoPrompts={manualOnlyVideoPrompts}
                    canSubmitBShotWork={canSubmitBShotWork}
                    ensureImageIntentReady={ensureImageIntentReady}
                    reconcileImagePromptIntent={reconcileImagePromptIntent}
                    getSceneIntentForTarget={getIntentForSceneTarget}
                    getImagePacingForTarget={getImagePacingForTarget}
                    restoreSceneIntentSnapshot={restoreSceneIntentSnapshot}
                    onRegisterAutoImageGenerator={(generate: any) => {
                        autoGeneratorRef.current = generate;
                    }}
                    creationProjectId={creationProjectId}
                    onCreationMemoryChange={handleEditStoryMemoryChange}
                    usedanimate={usedanimate}
                    setusedanimate={setusedanimate}
                    setFullscreenCharIndex={setFullscreenCharIndex}
                    Vipcharacters={Vipcharacters}
                    setVipcharacters={setVipcharacters}
                    referenceImages={referenceImages}
                    setReferenceImages={setReferenceImages}
                    SavedImagesHdCloud={savedSceneImages}
                    detectedCharacters={detectedCharacters}
                    selectedStyle={selectedStyle}
                    Planx={Planx}
                    SelectedModel={SelectedModel}
                    setSelectedModel={setSelectedModel}
                    time={time}
                    setTime={setTime}

                    noImagePrompt={unifiedNoImagePrompt}
                    restoredFrameModeKeys={restoredFrameModeKeys}
                    setnoImagePrompt={setUnifiedNoImagePrompt}
                    setGeneratedImagePrompt={setGeneratedImagePrompt}
                    generatedImagePrompt={generatedImagePrompt}
                    CreationMode={CreationMode}
                    musicKling={musicKling}
                    setmusicKling={setmusicKling}
                    setloadPrompt={setLoadPrompt}
                    loadPrompt={loadPrompt}
                    defaultVideoStartFrames={defaultVideoStartFrames}
                    setVideoArrayLastFrame={setVideoArrayLastFrame}
                    videoArrayLastFrame={videoArrayLastFrame}
                    VideoArrayCloud={unifiedVideoArrayCloud}
                    loadersPrompt={loadersPrompt}
                    setloadersPrompt={setLoadersPrompt}

                    setImagesHdCloud={setUnifiedImagesHdCloud}
                    drawFrameData={unifiedDrawFrameData}
                    setDrawFrameData={setUnifiedDrawFrameData}
                    autoDrawGuide={unifiedAutoDrawGuideData[unifiedActiveEdit] || null}
                    getGuideForScene={(target) => {
                        const state = unifiedStateRef.current;
                        const slot = state.map.findIndex((entry: any) => entry.type === target.type && entry.index === target.index && (target.type === 'A' || entry.bIndex === target.bIndex));
                        return { mode: state.autoDrawGuideModes?.[slot] || 'text', data: state.autoDrawGuideData?.[slot] || null };
                    }}
                    onUpdateAutoDrawGuide={updateActiveAutoDrawGuide}
                    onUpdateTextVideoForScene={updateTextVideoForScene}
                    autoDrawGuideMode={unifiedAutoDrawGuideModes[unifiedActiveEdit] || "text"}
                    onUpdateAutoDrawGuideMode={updateActiveAutoDrawGuideMode}
                    sceneTopologyVersion={sceneTopologyVersion}
                    aSceneTopologyVersion={aSceneTopologyVersion}
                    setPLoader={setPLoader}
                    PLoader={PLoader}
                    loader={unifiedLoaders[unifiedActiveEdit]}

                    steps2={steps2} /* NATIVE narration-space; EditStory derives narrIdx from the native slot */
                    setClipDurations={setClipDurations}
                    clipDurations={clipDurations}
                    PlanVid={PlanVid}
                    s3ResultUrl={s3ResultUrl}
                    stepsx={stepsx}
                    setStepsx={setStepsx}
                    pageType={type}
                    interactionExperienceMode={interactionExperienceMode}
                    DummyMode={DummyMode}
                    allowgetImage={allowgetImage}
                    GeneratedImages3={GeneratedImage}
                    finishLoader={(idx: number, isFail: boolean = false) => {
                        const target = unifiedIndexMap[idx];
                        if (target?.type === 'B') {
                            const uniqueIdx = 10000 + target.index * 100 + (target.bIndex ?? 0);
                            const epoch = (loaderEpoch.current[uniqueIdx] ?? 0) + 1;
                            loaderEpoch.current[uniqueIdx] = epoch;
                            if (loaderTimers.current[uniqueIdx]) {
                                clearInterval(loaderTimers.current[uniqueIdx]!);
                                loaderTimers.current[uniqueIdx] = null;
                            }
                            setBShotLoaders(prev => {
                                const next = [...(prev || [])];
                                while (next.length <= target.index) next.push([]);
                                const bArr = [...(next[target.index] || [])];
                                bArr[target.bIndex ?? 0] = isFail ? 0 : 100;
                                next[target.index] = bArr;
                                return next;
                            });

                            if (!isFail) {
                                // clear any previous hide timeout for B-shots
                                if (loaderHideTimers.current[uniqueIdx]) {
                                    clearTimeout(loaderHideTimers.current[uniqueIdx]!);
                                    loaderHideTimers.current[uniqueIdx] = null;
                                }
                                loaderHideTimers.current[uniqueIdx] = setTimeout(() => {
                                    setBShotLoaders(prev => {
                                        const next = [...(prev || [])];
                                        while (next.length <= target.index) next.push([]);
                                        const bArr = [...(next[target.index] || [])];
                                        bArr[target.bIndex ?? 0] = 0;
                                        next[target.index] = bArr;
                                        return next;
                                    });
                                }, 600);
                            }
                        } else {
                            finishLoader(target?.index ?? idx, isFail);
                        }
                    }}
                    updateLoader={(idx: number, pct: number, force: boolean = false) => {
                        const target = unifiedIndexMap[idx];
                        if (target?.type === 'B') {
                            const uniqueIdx = 10000 + target.index * 100 + (target.bIndex ?? 0);
                            if (force) {
                                loaderEpoch.current[uniqueIdx] = (loaderEpoch.current[uniqueIdx] ?? 0) + 1;
                                if (loaderTimers.current[uniqueIdx]) {
                                    clearInterval(loaderTimers.current[uniqueIdx]!);
                                    loaderTimers.current[uniqueIdx] = null;
                                }
                            }
                            setBShotLoaders(prev => {
                                const next = [...(prev || [])];
                                while (next.length <= target.index) next.push([]);
                                const bArr = [...(next[target.index] || [])];
                                bArr[target.bIndex ?? 0] = force
                                    ? pct
                                    : Math.max(pct, bArr[target.bIndex ?? 0] || 0);
                                next[target.index] = bArr;
                                return next;
                            });
                        } else {
                            updateLoader(target?.index ?? idx, pct, force);
                        }
                    }}
                    startLoader={(idx: number) => {
                        const target = unifiedIndexMap[idx];
                        if (target?.type === 'B') {
                            const uniqueIdx = 10000 + target.index * 100 + (target.bIndex ?? 0);
                            const epoch = (loaderEpoch.current[uniqueIdx] ?? 0) + 1;
                            loaderEpoch.current[uniqueIdx] = epoch;
                            if (loaderTimers.current[uniqueIdx]) clearInterval(loaderTimers.current[uniqueIdx]!);

                            setBShotLoaders(prev => {
                                const next = [...(prev || [])];
                                while (next.length <= target.index) next.push([]);
                                const bArr = [...(next[target.index] || [])];
                                bArr[target.bIndex ?? 0] = 1;
                                next[target.index] = bArr;
                                return next;
                            });

                            const begun = Date.now();
                            const DURATION = 3 * 60 * 1000;
                            const CAP = 95;
                            loaderTimers.current[uniqueIdx] = setInterval(() => {
                                if (loaderEpoch.current[uniqueIdx] !== epoch) return;
                                const t = Math.min((Date.now() - begun) / DURATION, 1);
                                const eased = 1 - Math.pow(1 - t, 3);
                                const pct = Math.max(1, Math.round(eased * CAP));

                                setBShotLoaders(prev => {
                                    const next = [...(prev || [])];
                                    while (next.length <= target.index) next.push([]);
                                    const bArr = [...(next[target.index] || [])];
                                    if (pct > (bArr[target.bIndex ?? 0] || 0)) bArr[target.bIndex ?? 0] = pct;
                                    next[target.index] = bArr;
                                    return next;
                                });
                            }, 200);
                        } else {
                            startLoader(target?.index ?? idx);
                        }
                    }}

                    isGenerating={isGenerating}
                    setIsGenerating={(updater: any) => {
                        setIsGenerating((prev: any) => {
                            if (typeof updater === 'function') {
                                // Create a dummy unified array that EditStory expects
                                const dummyUnified = unifiedIndexMap.map(m => m.type === 'A' ? prev[m.index] : false);
                                const nextUnified = updater(dummyUnified);
                                // Map the updated A-Roll values back to the real native array
                                const next = [...prev];
                                unifiedIndexMap.forEach((m, i) => {
                                    if (m.type === 'A') {
                                        next[m.index] = nextUnified[i];
                                    }
                                });
                                return next;
                            } else {
                                // Fallback if EditStory passes a raw array (it shouldn't)
                                const next = [...prev];
                                next[activeEdit] = updater;
                                return next;
                            }
                        });
                    }}
                    isBShotGenerating={isBShotGenerating}
                    setIsBShotGenerating={setIsBShotGenerating}
                    bShotLoaders={bShotLoaders}
                    setBShotLoaders={setBShotLoaders}
                    bShotTextVideo={bShotTextVideo}
                    setBShotTextVideo={setUnifiedTextVideo}
                    setVideoArrayCloud={setUnifiedVideoArrayCloud}
                    PostId={PostId}
                    ImagesHdCloud={unifiedImagesHdCloud}
                    isSceneImageFinalAtIndex={(slotIndex: number) => !isUnifiedSlotEmpty(slotIndex)}
                    VideMode={VideMode}
                    setVideoArray={setUnifiedVideoArray}
                    setVideoArrayBlob={setUnifiedVideoArrayBlob}
                    VideoArrayBlob={unifiedVideoArrayBlob}
                    VideoArray={unifiedVideoArray}
                    TextVideo={unifiedTextVideo}
                    setTextVideo={setUnifiedTextVideo}
                    setmusic={() => { }}
                    Seed={Seed}
                    setMemeMusic={setMemeMusic}
                    setIndex={handleSetUnifiedActiveEdit}
                    modelz={modelz}
                    convertToHDWebpOrJpegByDeviceHd={convertToHDWebpOrJpegByDeviceHd}
                    steps={unifiedSteps}
                    setSteps={setUnifiedSteps}
                    setSteps2={setSteps2} /* NATIVE setter — unified mapping corrupted narration in B-shot mode */
                    setIsAudioDirty={setIsAudioDirty}
                    narrate={narrate}
                    setnarrate={setnarrate}
                    setGeneratedText={setUnifiedGeneratedText}
                    setGeneratedTextx={setUnifiedGeneratedTextx}
                    GeneratedTextx={unifiedGeneratedTextx}
                    type={0}
                    GotIm={GotIm}
                    nanoImages={unifiedNanoImages}
                    /* Array-based props */
                    setGeneratedImagesFlux={setUnifiedGeneratedImagesFlux}
                    setGeneratedImagesFluxBlob={setGeneratedImagesFluxBlob}
                    setGeneratedImage={setGeneratedImage}
                    generatedImagesFlux={unifiedGeneratedImagesFlux}
                    GeneratedImage={unifiedGeneratedImagesFlux[unifiedActiveEdit]}
                    GeneratedText={unifiedGeneratedText}
                    /* Single-based props become null or undefined */
                    setFluxIm={null}
                    setFluxImBlob={null}
                    FluxIm={null}
                    Im={null}
                    prompt={null}
                    /* Common props */
                    convertToHDWebpOrJpegByDevice={convertToHDWebpOrJpegByDevice}
                    setbase={setbase}

                    base={base}
                    isBShotGridContext={unifiedIndexMap[unifiedActiveEdit]?.type === 'B'}
                    isBShotMedia={unifiedIndexMap[unifiedActiveEdit]?.type === 'B'}
                    isBShotModeActive={isBShotModeActive}
                    parentSceneIndex={activeEdit}
                    spatialLinkOptions={spatialLinkOptions}
                    spatialStages={spatialCreationStages}
                    spatialIdentityCandidates={savedSpatialDocuments}
                    onNavigateSpatialPosition={navigateSpatialPosition}
                    spatialScene={activeSpatialScene}
                    updateSpatialScene={updateActiveSpatialScene}
                    spatialMotionContexts={activeBSpatialKey ? bSpatialContexts[activeBSpatialKey] || [] : spatialMotionContexts[activeEdit] || []}
                    updateSpatialMotionContexts={updateActiveSpatialMotionContexts}
                    spatialMotionContextStatus={activeBSpatialKey ? bSpatialContextStatus : spatialMotionContextStatus}
                    onRetrySpatialMotionContext={activeBSpatialKey ? () => setBSpatialRetry(value => value + 1) : retrySpatialMotionContext}
                    spatialGlobalIntent={intentBlueprintState?.global}
                    onInstantBShotSave={handleBShotTruthSave}
                    index={editStoryIndex}
                    unifiedIndexMap={unifiedIndexMap}
                    sceneDisplayEntries={sceneDisplayMap.entries}
                    bIndex={activeBShotEdit}
                    startEdit={startEdit && unifiedActiveEdit >= 0}
                    setGeneratedImagesFluxBlobHd={setGeneratedImagesFluxBlobHd}
                    setstartEdit={setStoryboardWorkstationOpen}
                    fallbackImage={loggedUser
                        ? `${loggedUser.image}` : ''}
                    defaultText=""
                    onUpdateActiveCharacters={(idx, activeChars) => {
                        const target = resolveUnifiedTarget(idx, unifiedActiveEdit);
                        if (!target) return;
                        const targetIndex = unifiedIndexMap.findIndex((entry) => (
                            entry.type === target.type
                            && entry.index === target.index
                            && (target.type === 'A' || (entry.bIndex ?? 0) === (target.bIndex ?? 0))
                        ));
                        if (targetIndex < 0) return;
                        const setter = CreationMode === 'Video'
                            ? setUnifiedSceneActiveCharactersVideo
                            : setUnifiedSceneActiveCharacters;
                        setter((prev: any[] = []) => {
                            const next = [...prev];
                            if (JSON.stringify(next[targetIndex]) === JSON.stringify(activeChars)) return prev;
                            next[targetIndex] = activeChars;
                            return next;
                        });
                    }}
                    activeCharsForScene={(CreationMode === 'Video' ? unifiedSceneActiveCharactersVideo : unifiedSceneActiveCharacters)[unifiedActiveEdit] || []}
                    musicMode={musicMode}
                    musicModeUrl={musicModeUrl}
                    musicSegments={musicSegments}
                    musicBreakerSec={musicBreakerSec}
                    lipSyncAudioUrls={lipSyncAudioUrls}
                    audioReferences={audioReferences}
                    setAudioReferences={setAudioReferences}
                    setLipSyncAudioUrls={setLipSyncAudioUrls}
                    lipSyncProJobs={lipSyncProJobs}
                    setLipSyncProJobs={setLipSyncProJobs}
                    lipSyncActiveList={lipSyncActiveList}
                    setLipSyncActiveList={setLipSyncActiveList}
                    lipSyncInstructions={lipSyncInstructions}
                    setLipSyncInstructions={setLipSyncInstructions}
                    lipSyncInstructionStatuses={lipSyncInstructionStatuses}
                    setLipSyncInstructionStatuses={setLipSyncInstructionStatuses}
                    lipSyncInstructionMeta={lipSyncInstructionMeta}
                    setLipSyncInstructionMeta={setLipSyncInstructionMeta}
                    lipSyncPromptBackup={lipSyncPromptBackup}
                    setLipSyncPromptBackup={setLipSyncPromptBackup}
                    referenceVideoUrls={unifiedReferenceVideoUrls}
                    setReferenceVideoUrls={setUnifiedReferenceVideoUrls}
                    referenceVideoActiveList={unifiedReferenceVideoActiveList}
                    setReferenceVideoActiveList={setUnifiedReferenceVideoActiveList}
                    safetyImageSetsByTarget={safetyImageSetsByTarget}
                    setSafetyImageSetsByTarget={setSafetyImageSetsByTarget}
                    safetyVideoSetsByTarget={safetyVideoSetsByTarget}
                    setSafetyVideoSetsByTarget={setSafetyVideoSetsByTarget}
                />

                {/* CLOSE ICON */}
                <IconButton
                    onClick={() => {
                        Close();
                        setflip(false);
                    }}
                    sx={{
                        display: generatedImagesFlux ? "none" : "none",
                        position: "fixed",
                        top: matchMobile ? "7vh" : "12vh",
                        right: "0",
                        color: darkModeReducer ? "#ffffff" : "#000000", // Always white
                        zIndex: 300,
                        filter: darkModeReducer
                            ? "drop-shadow(2px 2px 4px rgba(0,0,0,0.7))"
                            : "drop-shadow(2px 2px 4px rgba(230,230,230,0.7))",
                    }}
                >
                    <CloseIcon style={{ fontSize: "2rem", opacity: 0.3 }} />
                </IconButton>
            </Box>

            <WorldModel
                selectedImages={[]}
                handleSelection={() => { }}

                PostId={PostId}
                selectedStyle={selectedStyle}

                Seed={Seed}
                prompt={prompt}
                GeneratedImageFirst={generatedImagesFlux?.[0]}
                mode={1}
                open={showWorldModel2}
                onClose={() => setShowWorldModel2(false)}

                // Data Props
                steps={steps}
                ImagesHdCloud={ImagesHdCloud}
                GeneratedText={GeneratedText}
                Planx={Planx}

                // Action Props
                handleFileChange={() => { { } }} // <--- Pass your existing file handler here

                // UI Props
                darkMode={darkModeReducer}
                matchMobile={matchMobile}
                modelz={modelz}
                GeneratedImageFlux={generatedImagesFlux} // or whatever state tracks generation
                parsedKeyPoints={steps} // or [] if not available in this scope
                Vipcharacters={Vipcharacters}
                setVipcharacters={setVipcharacters}
                referenceImages={referenceImages}
            />


            {
                ThumbGo ? (
                    <div
                        style={{
                            position: "fixed",
                            top: "0vh",
                            zIndex: 1000005,
                            width: matchMobile ? "100%" : "100%",
                            height: "100vh",
                            margin: "auto",
                            //display: 'none'
                            ///  backgroundColor: 'red',
                        }}
                    >
                        <Thumbnail
                            creationDraft={creationDraft}
                            minimizeMode={minimizeMode}
                            DummyMode={DummyMode}
                            steps={steps}
                            setGeneratedImage={setGeneratedImage}
                            prompt={prompt}
                            type={type}
                            closeT={closeT}
                            isMenuOpen={isMenuOpen}
                            sceneImages={(steps || []).map((_step: any, index: number) => ({
                                id: `scene-${index}`,
                                image: ImagesHdCloud?.[index] || generatedImagesFluxBlobHd?.[index]
                                    || generatedImagesFluxBlob?.[index] || generatedImagesFlux?.[index] || savedSceneImages?.[index],
                            })).filter((scene: any) => scene.image && scene.image !== 'EMPTY')}
                            image={ImagesHdCloud?.[0] || generatedImagesFlux?.[0] || generatedImagesFluxBlob?.[0]}
                            PostId={PostId}
                            title={EnhanceTitle}
                        />
                    </div>
                ) : null
            }
            {fetchingPrompts && (
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999, // very high
                        bgcolor: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'all' // intercept clicks
                    }}
                >
                    <Box
                        sx={{
                            width: matchMobile ? '90%' : '80%',
                            maxWidth: 640,
                            aspectRatio: typeof ratioKey === 'string' ? ratioKey.replace(' / ', '/') : '9/10',
                            p: 3,
                            borderRadius: 4,
                            bgcolor: darkModeReducer ? "rgba(20, 20, 25, 0.85)" : "rgba(255, 255, 255, 0.85)",
                            backdropFilter: 'blur(20px)',
                            boxShadow: darkModeReducer ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.1)",
                            border: darkModeReducer ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(255,255,255,0.4)",
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {creationImaginationReopen && <Box sx={{ position: 'absolute', zIndex: 2, top: 12, left: 12 }}>
                            {creationImaginationReopen}
                        </Box>}
                        {previewImage && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                zIndex: 0, opacity: 0.85,
                                backgroundImage: `url(${previewImage})`,
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                animation: 'majesticFade 0.5s ease-out forwards'
                            }} />
                        )}
                        <Box sx={{
                            position: previewImage ? 'absolute' : 'relative',
                            bottom: previewImage ? 0 : 'auto',
                            left: previewImage ? 0 : 'auto',
                            width: previewImage ? '100%' : 'auto',
                            zIndex: 1,
                            background: previewImage
                                ? (darkModeReducer ? 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.9))' : 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))')
                                : (darkModeReducer ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'),
                            p: previewImage ? 1.5 : 2,
                            pt: previewImage ? 4 : 2,
                            borderRadius: previewImage ? 0 : 2,
                            backdropFilter: previewImage ? 'none' : 'blur(10px)',
                            textAlign: previewImage ? 'right' : 'center'
                        }}>
                            <Typography sx={{
                                color: previewImage ? "#ffffff" : (appColor),
                                fontWeight: 800, mb: previewImage ? 0.5 : 1, fontSize: '1.2rem',
                                textShadow: previewImage ? '0 2px 8px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,1)' : (darkModeReducer ? '0 2px 4px rgba(0,0,0,0.8)' : 'none')
                            }}>
                                {/* Global intent lands well before the first image, so the
                                    box shows the creation's own title instead of a spinner
                                    caption. Falls back the moment intent is unavailable. */}
                                {imaginationTitle}
                            </Typography>
                            <Typography sx={{
                                color: previewImage ? "rgba(255,255,255,0.95)" : (darkModeReducer ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)"),
                                fontSize: previewImage ? '0.8rem' : '0.9rem',
                                fontStyle: 'italic', display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: previewImage ? 2 : 4,
                                textShadow: previewImage ? '0 1px 5px rgba(0,0,0,0.9)' : (darkModeReducer ? '0 1px 3px rgba(0,0,0,0.8)' : 'none')
                            }}>
                                {imaginationText}
                            </Typography>
                            {/* Stage line. Always says what the backend is doing, so no
                                part of the wait is silent. Hidden once real prompts are
                                streaming in, since those are better to look at. */}
                            {imaginationStatus && (
                                <Typography sx={{
                                    mt: 0.75,
                                    fontSize: '0.72rem',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    color: previewImage
                                        ? "rgba(255,255,255,0.75)"
                                        : alpha(appColor, 0.85),
                                }}>
                                    {imaginationStatus}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Fullscreen Character Slideshow Overlay */}
            {fullscreenCharIndex !== null && referenceImages && referenceImages.length > 0 && (
                <Modal
                    open
                    onClose={() => setFullscreenCharIndex(null)}
                    disableRestoreFocus
                    disableEnforceFocus
                    sx={{ zIndex: 10000000 }}
                >
                    <Box
                        onClick={(e) => { if (e.target === e.currentTarget) setFullscreenCharIndex(null); }}
                        sx={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            bgcolor: 'rgba(0,0,0,0.95)',
                            backdropFilter: 'blur(10px)',

                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                        <IconButton
                            onClick={() => setFullscreenCharIndex(null)}
                            sx={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                color: 'white',
                                zIndex: 10,
                                bgcolor: 'rgba(255,255,255,0.1)',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                            }}
                        >
                            <CloseIcon />
                        </IconButton>

                        <Box
                            onClick={(e) => { if (e.target === e.currentTarget) setFullscreenCharIndex(null); }}
                            // Mobile Touch Events
                            onTouchStart={(e) => setCharTouchStart(e.targetTouches[0].clientX)}
                            onTouchMove={(e) => setCharTouchEnd(e.targetTouches[0].clientX)}
                            onTouchEnd={() => {
                                if (charTouchStart === null || charTouchEnd === null) return;
                                const distance = charTouchStart - charTouchEnd;
                                if (distance > 50) {
                                    setFullscreenCharIndex(prev => Math.min(prev! + 1, referenceImages.length - 1));
                                } else if (distance < -50) {
                                    setFullscreenCharIndex(prev => Math.max(prev! - 1, 0));
                                }
                                setCharTouchStart(null);
                                setCharTouchEnd(null);
                            }}

                            // PC Mouse Events
                            onMouseDown={(e) => setCharTouchStart(e.clientX)}
                            onMouseMove={(e) => {
                                if (charTouchStart !== null) {
                                    setCharTouchEnd(e.clientX);
                                }
                            }}
                            onMouseUp={() => {
                                if (charTouchStart === null || charTouchEnd === null) {
                                    setCharTouchStart(null);
                                    setCharTouchEnd(null);
                                    return;
                                }
                                const distance = charTouchStart - charTouchEnd;
                                if (distance > 50) {
                                    setFullscreenCharIndex(prev => Math.min(prev! + 1, referenceImages.length - 1));
                                } else if (distance < -50) {
                                    setFullscreenCharIndex(prev => Math.max(prev! - 1, 0));
                                }
                                setCharTouchStart(null);
                                setCharTouchEnd(null);
                            }}
                            onMouseLeave={() => {
                                if (charTouchStart !== null) {
                                    setCharTouchStart(null);
                                    setCharTouchEnd(null);
                                }
                            }}
                            sx={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                cursor: charTouchStart !== null ? 'grabbing' : 'grab'
                            }}
                        >
                            {fullscreenCharIndex > 0 && (
                                <IconButton
                                    onClick={(e) => { e.stopPropagation(); setFullscreenCharIndex(prev => prev! - 1); }}
                                    sx={{ position: 'absolute', left: 16, color: 'white', zIndex: 10, bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                                >
                                    <ArrowBackIosIcon />
                                </IconButton>
                            )}

                            <Box
                                component="img"
                                src={referenceImages[fullscreenCharIndex].imageUrl || referenceImages[fullscreenCharIndex].url}
                                alt={referenceImages[fullscreenCharIndex].name}
                                onDragStart={(e: any) => e.preventDefault()}
                                sx={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    width: { xs: '100%', md: 'auto' },
                                    height: { xs: 'auto', md: '100%' },
                                    objectFit: 'contain'
                                }}
                            />

                            {fullscreenCharIndex < referenceImages.length - 1 && (
                                <IconButton
                                    onClick={(e) => { e.stopPropagation(); setFullscreenCharIndex(prev => prev! + 1); }}
                                    sx={{ position: 'absolute', right: 16, color: 'white', zIndex: 10, bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                                >
                                    <ArrowForwardIosIcon />
                                </IconButton>
                            )}
                        </Box>
                        <Typography variant="h6" sx={{ position: 'absolute', bottom: 30, color: 'white', bgcolor: 'rgba(0,0,0,0.5)', px: 2, py: 0.5, borderRadius: 2 }}>
                            {referenceImages[fullscreenCharIndex].name}
                        </Typography>
                    </Box>
                </Modal>
            )}

            {/* Audio Error Snackbar */}
            <Portal disablePortal={!creationDeckEnabled}>
            <Snackbar
                open={audioError.show}
                autoHideDuration={10000}
                onClose={() => setAudioError(prev => ({ ...prev, show: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={creationDeckEnabled ? { zIndex: 1000002 } : undefined}
            >
                <Alert
                    onClose={() => setAudioError(prev => ({ ...prev, show: false }))}
                    severity="error"
                    variant="filled"
                    sx={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        Audio Generation Failed for {audioError.scene}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
                        {audioError.message}
                    </Typography>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', bgcolor: 'rgba(0,0,0,0.2)', p: 1, borderRadius: 1, width: '100%', display: 'block' }}>
                        "{audioError.text}"
                    </Typography>
                </Alert>
            </Snackbar>
            </Portal>

        </Box>
        {storyboardDeck}
        {!deckVisible && !startEdit && deckBShotOptions !== null && <Modal open onClose={closeScenePreview}>
            <Box className="creation-deck-grid-detail" sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                width: 'min(520px, 92vw)', maxHeight: '85dvh', overflow: 'auto', p: 2, borderRadius: 4, bgcolor: darkModeReducer ? '#141820' : '#fff', color: darkModeReducer ? '#fff' : '#111' }}>
                <IconButton {...cb('storybook_preview', 'close', 'Close scene text preview', 'setPromptPreviewIndex')} aria-label="Close scene text preview" onClick={closeScenePreview}><CloseIcon /></IconButton>
                {deckDetail}
            </Box>
        </Modal>}
        {deckVisible && pendingSceneDeleteIndex !== null && <Modal open onClose={() => setPendingSceneDeleteIndex(null)} sx={{ zIndex: 1000002 }}>
            <Box>{sceneDeleteConfirmation}</Box>
        </Modal>}
        </>
    );
};

export default Storybook;
