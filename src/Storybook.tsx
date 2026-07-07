import React, {
    useCallback,
    useState,
    useEffect,
    useRef,
    useLayoutEffect,
    useMemo
} from "react";


import axios from "axios";
///Snackbar/Box

import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Saveprompthelperfordellater, RemoveFromDeleteLater, RemoveVideoFromDeleteLater } from "./SavepromptHelpersLocal";



import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import ErrorPillContainer, { globalErrorEmitter } from "./components/ErrorPillContainer";
import StepsDialog from './StepsDialog';


import { keyframes } from "@emotion/react";

import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { calcModelPixels } from "./ModelPixels";   // adjust path save

import PublishLoader from "./PublishLoader";   // adjust path
import PublishLoader2 from "./PublishLoader2"; // New modal


import ArrowRightIcon from '@mui/icons-material/ArrowRight';

import PaletteIcon from '@mui/icons-material/Palette';

import ModeEditOutlineIcon from '@mui/icons-material/ModeEditOutline';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import SaveIcon from '@mui/icons-material/Save';


import { setPixels, incrementPixels } from "./settingsSlice";

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

import AudioPicker from "./AudioPicker";

import Thumbnail from "./Thumbnail";

import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";

import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon
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
    Snackbar,
    Alert,
    Backdrop,
    Fade,
} from "@mui/material";
import { matchMobile } from "./DetectDevice";

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


import WorldModel from './WorldModel';

import { Padding, Title } from "@mui/icons-material";
import { video } from "framer-motion/client";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;
const VITE_HUGG = import.meta.env.VITE_HUGG;

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
    steps, stepsx, prompt, isSubmittingKick, setIsSubmittingKick, handleCloseOverlay, setcallFeeds,
    setSteps, setStepsx, GeneratedImage, setStopText, GotIm, generatedImagesFlux, setGeneratedImagesFlux,
    modelz, Planx, isMenuOpen, type, GenerateSignedUrl, PostId, setPostId, Seed, DummyMode,
    timeoutsDisabledRef, timeoutRefsxp, setGeneratedImage, VideMode, setVideMode, ImagesHdCloud,
    setImagesHdCloud, stopFeeds, setminimisePrompt, allowSpin, steps2, setSteps2, allowgetImage,
    setallowgetImage, setDummyMode, showWorldModel, setShowWorldModel, setCreationMode, magicMode,
    selectedStyle, minimizeMode = 0, setMinimizeMode = () => { }, stagePromptCache,
    destroyAllFluxCalls, CreationMode, onAllPromptsGenerated, setNanoImages, referenceImages, setReferenceImages, detectedCharacters, detectedEnvironments, nanoImages, loadersArray, setLoadersArray,
    onSaveVisibilityChange, Vipcharacters, setVipcharacters,
    isAudioDirty, setIsAudioDirty, audioSceneStatuses, setAudioSceneStatuses, isAudioGenerating, setIsAudioGenerating, isBShotModeActive, setIsBShotModeActive, generatedAudios, setGeneratedAudios,
    generatedAudioTexts, setGeneratedAudioTexts,
    bShotImages, setBShotImages, bShotVideos, setBShotVideos, bShotPrompts, setBShotPrompts, bShotTextVideo, setBShotTextVideo, bShotNanoImages, setBShotNanoImages,
    musicMode = false, musicModeUrl = "", musicModeName = "", musicBreakerSec = 10, musicSegments = [],
    buttonTheme = {
        bg: "rgba(10, 10, 10, 0.45)",
        text: "#ffffff",
        hoverBg: "rgba(15, 15, 15, 0.65)",
        hoverText: "#ffffff",
    }
}) => {
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const isStoryMusicVideoMode = Boolean(musicMode && type === 1);
    const [masterAspectRatio, setMasterAspectRatio] = useState<any>('9 / 10');
    const [isRatioSet, setIsRatioSet] = useState(false);

    // (Unified array logic moved down)

    const dispatch = useDispatch();

    const navigate = useNavigate();


    const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);

    const [HaltPublish, setHaltPublish] = useState(false);

    const [musicKling, setmusicKling] = useState(true);
    const [publishLoader2Open, setPublishLoader2Open] = useState(false);
    const [autoStartPublishLoader2, setAutoStartPublishLoader2] = useState(false);
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
        }
    }, [publishLoader2Open]);

    // --- Sub-Stage 3.5: Narration Toggle Data Protection ---
    const [showBShotResetWarning, setShowBShotResetWarning] = useState(false);

    // --- B-shot time stamp + time-change rebuild prompt ---
    // The clip duration the current B-shot arrangement was built against. Used to
    // detect when the user later generates video at a different length.
    const [bShotBuiltWithTime, setBShotBuiltWithTime] = useState<number | null>(null);
    const [showBShotTimeChangeWarning, setShowBShotTimeChangeWarning] = useState(false);
    const [pendingNarrationToggle, setPendingNarrationToggle] = useState<boolean | null>(null);
    const [isGeneratingBShotPrompts, setIsGeneratingBShotPrompts] = useState(false); // Tracks GPT B-Shot auto-gen
    const [bShotVideoArray, setBShotVideoArray] = useState<any[]>([]);
    const [bShotVideoArrayBlob, setBShotVideoArrayBlob] = useState<any[]>([]);

    const handleNarrationToggle = (newVal: boolean) => {
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
            // Silently reset arrays and allow toggle
            if (setBShotPrompts) setBShotPrompts([]);
            if (setBShotTextVideo) setBShotTextVideo([]);
            setIsBShotGenerating([]);
            if (setBShotImages) setBShotImages([]);
            if (setBShotVideos) setBShotVideos([]);
            if (setBShotNanoImages) setBShotNanoImages([]);
            setactivatevoicenarration(newVal);
        }
    };

    const confirmNarrationToggle = () => {
        if (setBShotPrompts) setBShotPrompts([]);
        if (setBShotTextVideo) setBShotTextVideo([]);
        setIsBShotGenerating([]);
        if (setBShotImages) setBShotImages([]);
        if (setBShotVideos) setBShotVideos([]);
        if (setBShotNanoImages) setBShotNanoImages([]);
        if (pendingNarrationToggle !== null) {
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
        if (setBShotPrompts) setBShotPrompts([]);
        if (setBShotTextVideo) setBShotTextVideo([]);
        setIsBShotGenerating([]);
        if (setBShotImages) setBShotImages([]);
        if (setBShotVideos) setBShotVideos([]);
        if (setBShotNanoImages) setBShotNanoImages([]);
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

    const [GeneratedText, setGeneratedText] = useState<string[]>([]);
    const [GeneratedTextx, setGeneratedTextx] = useState<string[]>([]);
    const [fetchingPrompts, setFetchingPrompts] = useState(false);
    const [latestFetchedPrompt, setLatestFetchedPrompt] = useState<{ text: string, index: number } | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const abortNanoRef = useRef<AbortController | null>(null);
    const hasFiredNanoRef = useRef(false);

    const [TextVideo, setTextVideo] = useState<string[]>([]);

    const [VideoArray, setVideoArray] = useState<string[]>([]);
    const [VideoArrayBlob, setVideoArrayBlob] = useState<string[]>([]);

    // Fullscreen Character Slideshow State
    const [fullscreenCharIndex, setFullscreenCharIndex] = useState<number | null>(null);
    const [charTouchStart, setCharTouchStart] = useState<number | null>(null);
    const [charTouchEnd, setCharTouchEnd] = useState<number | null>(null);

    const [VideoArrayCloud, setVideoArrayCloud] = useState<string[]>([]);
    const [usedanimate, setusedanimate] = useState<boolean>(false);

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
    const [generatedImages, setGeneratedImages] = useState<string[]>(
        Array(steps.length).fill("")
    );

    const [generatedImagesFirst, setGeneratedImagesFirst] = useState<string[]>(
        Array(steps.length).fill("")
    );
    const [lipSyncAudioUrls, setLipSyncAudioUrls] = useState<string[]>(
        () => Array(steps.length).fill("")
    );
    const [lipSyncActiveList, setLipSyncActiveList] = useState<boolean[]>(
        () => Array(steps.length).fill(false)
    );
    // Per-scene direct Lip Sync Pro lifecycle. EditStory can close while its async task continues.
    const [lipSyncProJobs, setLipSyncProJobs] = useState<Record<number, { state: "generating" | "succeeded" | "failed"; message: string }>>({});
    // Backup of the user's original video prompt per scene, saved when lip-sync is turned ON
    // and restored when turned OFF, so toggling never loses or breaks the prompt.
    const [lipSyncPromptBackup, setLipSyncPromptBackup] = useState<string[]>(
        () => Array(steps.length).fill("")
    );
    // Per-scene reference video (Seedance 2.0 / 2.0 Fast only). Holds the uploaded S3 URL
    // of a user-picked clip used as a motion/style reference ([Video1]).
    const [referenceVideoUrls, setReferenceVideoUrls] = useState<string[]>(
        () => Array(steps.length).fill("")
    );
    // Whether each scene's reference video is actively in use ("Using Vid").
    const [referenceVideoActiveList, setReferenceVideoActiveList] = useState<boolean[]>(
        () => Array(steps.length).fill(false)
    );

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
    const [MemeMusic, setMemeMusic] = useState(true);


    // inside your component
    useEffect(() => {
        // check for any null/empty/defaultâ€placeholder steps
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
    const [noImagePrompt, setnoImagePrompt] = useState<boolean[]>(
        Array(steps.length).fill(false)
    );




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




    const [generatedImagePrompt, setGeneratedImagePrompt] = useState<string[]>(
        Array(steps.length).fill("")
    );

    const [SelectvidPrompt, setSelectvidImagePrompt] = useState<string[]>(
        Array(steps.length).fill("")
    );


    const [base, setbase] = useState<string[]>([]);

    const [Name, setName] = useState("Voices");




    const [musicname, setmusicname] = useState("Music");

    /// {loader}%
    const TYPE2_TRACKS = [
        ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3"
        ///https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-b50013a478814b136194434fe19576d7-trim-1749103536560.mp3

        /// "https://clikbatebucket.s3.us-east-1.amazonaws.com/background-melody-6-50284.mp3",
        /// "https://clikbatebucket.s3.us-east-1.amazonaws.com/humming-song-59500.mp3",
        ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/background-melody-3-17343.mp3",


        "https://clikbatebucket.s3.us-east-1.amazonaws.com/welte-mignon-piano-48794.mp3",

        "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3",
    ];
    //const idx = Math.floor(Math.random() * TYPE2_TRACKS.length);

    var idx = "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3";
    const [music, setmusic] = useState('https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3');
    const publishMusicUrl = musicMode && musicModeUrl ? musicModeUrl : music;
    const publishMusicName = musicMode && musicModeName ? musicModeName : musicname;

    const [generatedImagesFluxBlob, setGeneratedImagesFluxBlob] = useState<
        Blob[]
    >(Array(steps.length).fill(null) as Blob[]);

    // durations in seconds, one perSscene
    const [clipDurations, setClipDurations] = useState<number[]>(
        () => Array(steps.length).fill(5) // default 5s perSscene
    );




    const [generatedImagesFluxBlobHd, setGeneratedImagesFluxBlobHd] = useState<
        Blob[]
    >(Array(steps.length).fill(null) as Blob[]);

    const [dummyImageUrls, setDummyImageUrls] = useState<Record<number, string>>({});

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
    const [activeBShotEdit, setActiveBShotEdit] = useState<number | null>(null);

    const bShotTruthRef = useRef({
        images: bShotImages,
        videos: bShotVideos,
        prompts: bShotPrompts
    });

    useEffect(() => {
        bShotTruthRef.current = {
            images: bShotImages,
            videos: bShotVideos,
            prompts: bShotPrompts
        };
    }, [bShotImages, bShotVideos, bShotPrompts]);

    const saveBShotTruthPayload = useCallback(async (nextImages: any[], nextVideos: any[], nextPrompts: any[], errorMessage = "Failed to save BShot truth") => {
        const payload = {
            imagesarray: nextImages,
            videoarray: nextVideos,
            promptsarray: nextPrompts
        };

        try {
            await axios.put(`${CLIK_URL}/UpdatePostBShotTruth`, {
                values: {
                    postId: PostId,
                    bshot: JSON.stringify(payload)
                }
            });
        } catch (err: any) {
            console.error(errorMessage, err);
            throw err;
        }
    }, [PostId]);

    const handleBShotTruthSave = useCallback(async (
        mediaUrl: string,
        promptText: string,
        isVideo: boolean,
        parentScene = activeEdit,
        bShotIndex = activeBShotEdit
    ) => {
        if (!mediaUrl || typeof parentScene !== "number" || bShotIndex === null || bShotIndex === undefined) {
            const error = new Error("Failed to save BShot truth: missing target slot");
            console.error(error.message, { mediaUrl, parentScene, bShotIndex });
            throw error;
        }

        const current = bShotTruthRef.current;
        const nextImages = (current.images || []).map((sceneArr: string[]) => [...(sceneArr || [])]);
        const nextVideos = (current.videos || []).map((sceneArr: string[]) => [...(sceneArr || [])]);
        const nextPrompts = (current.prompts || []).map((sceneArr: string[]) => [...(sceneArr || [])]);

        while (nextImages.length <= parentScene) nextImages.push([]);
        while (nextVideos.length <= parentScene) nextVideos.push([]);
        while (nextPrompts.length <= parentScene) nextPrompts.push([]);

        if (!nextImages[parentScene]) nextImages[parentScene] = [];
        if (!nextVideos[parentScene]) nextVideos[parentScene] = [];
        if (!nextPrompts[parentScene]) nextPrompts[parentScene] = [];

        if (isVideo) {
            nextVideos[parentScene][bShotIndex] = mediaUrl;
        } else {
            nextImages[parentScene][bShotIndex] = mediaUrl;
        }

        if (promptText && promptText.trim()) {
            nextPrompts[parentScene][bShotIndex] = promptText;
        }

        await saveBShotTruthPayload(nextImages, nextVideos, nextPrompts);

        bShotTruthRef.current = {
            images: nextImages,
            videos: nextVideos,
            prompts: nextPrompts
        };

        if (setBShotImages) setBShotImages(nextImages);
        if (setBShotVideos) setBShotVideos(nextVideos);
        if (setBShotPrompts) setBShotPrompts(nextPrompts);

        if (isVideo && VideoArrayCloud) {
            const keysToRemove: string[] = [];
            for (let storageIndex = 0; storageIndex < localStorage.length; storageIndex++) {
                const key = localStorage.key(storageIndex);
                if (key && /^localstoragevid\d+$/.test(key)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
            localStorage.removeItem("localInteractionpostId");

            if (PostId !== undefined && PostId !== null && String(PostId).trim() !== "") {
                localStorage.setItem("localInteractionpostId", String(PostId));
            }

            const maxLen = Math.max(VideoArrayCloud.length, nextVideos.length);
            let interleavedIndex = 1;
            for (let i = 0; i < maxLen; i++) {
                const aRollVid = VideoArrayCloud[i];
                if (aRollVid && aRollVid !== "EMPTY" && aRollVid.trim() !== "") {
                    localStorage.setItem('localstoragevid' + interleavedIndex, aRollVid);
                    interleavedIndex++;
                }

                if (nextVideos[i]) {
                    for (let j = 0; j < nextVideos[i].length; j++) {
                        const bVid = nextVideos[i][j];
                        if (bVid && bVid !== "EMPTY_BSHOT" && bVid.trim() !== "") {
                            localStorage.setItem('localstoragevid' + interleavedIndex, bVid);
                            interleavedIndex++;
                        }
                    }
                }
            }
        }
    }, [activeEdit, activeBShotEdit, VideoArrayCloud, PostId, setBShotImages, setBShotVideos, setBShotPrompts, saveBShotTruthPayload]);

    const [defaultVideoStartFrames, setDefaultVideoStartFrames] = useState<string[]>([]);

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
    const [generatedAudiosCloud, setGeneratedAudiosCloud] = useState<string[]>(
        []
    );



    const [isGenerating, setIsGenerating] = useState<boolean[]>([]);
    const [isBShotGenerating, setIsBShotGenerating] = useState<boolean[][]>([]);

    const [bShotLoaders, setBShotLoaders] = useState<number[][]>([]);



    const [showVoices, setShowVoices] = useState(false);
    const [voice, setVoice] = useState("Puck");


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
        // Remove from the â€œlow-resâ€ blobs
        setGeneratedImagesFluxBlob((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        // Remove from the â€œHDâ€ blobs
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
            let injectedText = text;

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

                // Regex that matches:
                // 1. Double quoted string: "[^"]*"
                // 2. Single quoted string: '[^']*'
                // 3. The flexible name pattern NOT preceded by '@'
                const regex = new RegExp(`("[^"]*")|('[^']*')|((?<!@)\\b(?:${flexibleNamePattern})\\b)`, 'gi');

                injectedText = injectedText.replace(regex, (match, doubleQuotes, singleQuotes, nameMatch) => {
                    if (doubleQuotes || singleQuotes) {
                        return match; // return the quoted text unchanged
                    }
                    if (nameMatch) {
                        return handle; // replace the unquoted character name with the @Handle
                    }
                    return match;
                });
            });

            console.log("[INJECTION END] New Text:", injectedText);
            return injectedText;
        } catch (err) {
            console.error("Local Regex Injection error:", err);
            return text;
        }
    };

    const injectedScenesRef = useRef<Set<number>>(new Set());

    const [sceneActiveCharacters, setSceneActiveCharacters] = useState<Array<Array<any>>>([]);
    const [sceneActiveCharactersVideo, setSceneActiveCharactersVideo] = useState<Array<Array<any>>>([]);

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
    const unifiedTextVideo = useMemo(() => unifiedIndexMap.map(m => m.type === 'A' ? TextVideo?.[m.index] : (bShotTextVideo?.[m.index]?.[m.bIndex] || "")), [unifiedIndexMap, TextVideo, bShotTextVideo]);
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

    // Active Edit Mapping
    const unifiedActiveEdit = useMemo(() => {
        if (activeBShotEdit !== null && isBShotModeActive) {
            return unifiedIndexMap.find(m => m.type === 'B' && m.index === activeEdit && m.bIndex === activeBShotEdit)?.originalIndex || 0;
        }
        return unifiedIndexMap.find(m => m.type === 'A' && m.index === activeEdit)?.originalIndex || 0;
    }, [unifiedIndexMap, activeEdit, activeBShotEdit, isBShotModeActive]);

    const handleSetUnifiedActiveEdit = useCallback((newUnifiedIndex: number) => {
        const m = unifiedIndexMap[newUnifiedIndex];
        if (m) {
            setactiveEdit(m.index);
            if (m.type === 'B') {
                setActiveBShotEdit(m.bIndex!);
            } else {
                setActiveBShotEdit(null);
            }
        }
    }, [unifiedIndexMap, setactiveEdit]);

    const unifiedStateRef = useRef<any>({});
    unifiedStateRef.current = {
        map: unifiedIndexMap,
        generatedImagesFlux: unifiedGeneratedImagesFlux,
        ImagesHdCloud: unifiedImagesHdCloud,
        TextVideo: unifiedTextVideo,
        VideoArrayCloud: unifiedVideoArrayCloud,
        steps: unifiedSteps,
        GeneratedText: unifiedGeneratedText,
        GeneratedTextx: unifiedGeneratedTextx,
        steps2: unifiedSteps2,
        VideoArray: unifiedVideoArray,
        VideoArrayBlob: unifiedVideoArrayBlob,
    };

    const createUnifiedSetter = useCallback((key: string, setA: any, setB: any, isInherited = false) => {
        return (updater: any) => {
            const refs = unifiedStateRef.current;
            const nextUnified = typeof updater === 'function' ? updater(refs[key]) : updater;

            setA((prevA: any) => {
                const nextA = [...(prevA || [])];
                let changedA = false;
                nextUnified.forEach((val: any, uIdx: number) => {
                    const m = refs.map[uIdx];
                    if (m && m.type === 'A') { nextA[m.index] = val; changedA = true; }
                    if (m && m.type === 'B' && isInherited) { nextA[m.index] = val; changedA = true; }
                });
                if (changedA && key === 'steps') console.log("ðŸ”¥ createUnifiedSetter modified A-Roll array for key:", key);
                return nextA;
            });

            if (setB && !isInherited) {
                setB((prevB: any) => {
                    const nextB = [...(prevB || [])];
                    nextUnified.forEach((val: any, uIdx: number) => {
                        const m = refs.map[uIdx];
                        if (m && m.type === 'B') {
                            if (!nextB[m.index]) nextB[m.index] = [];
                            nextB[m.index][m.bIndex!] = val;
                        }
                    });
                    return nextB;
                });
            }
        };
    }, []);

    const setUnifiedGeneratedImagesFlux = useMemo(() => createUnifiedSetter('generatedImagesFlux', setGeneratedImagesFlux, setBShotImages), [createUnifiedSetter, setGeneratedImagesFlux, setBShotImages]);
    const setUnifiedImagesHdCloud = useMemo(() => createUnifiedSetter('ImagesHdCloud', setImagesHdCloud, setBShotImages), [createUnifiedSetter, setImagesHdCloud, setBShotImages]);
    const setUnifiedTextVideo = useMemo(() => createUnifiedSetter('TextVideo', setTextVideo, setBShotTextVideo), [createUnifiedSetter, setTextVideo, setBShotTextVideo]);
    const setUnifiedVideoArrayCloud = useMemo(() => createUnifiedSetter('VideoArrayCloud', setVideoArrayCloud, setBShotVideos), [createUnifiedSetter, setVideoArrayCloud, setBShotVideos]);
    const setUnifiedSteps = useMemo(() => createUnifiedSetter('steps', setSteps, setBShotPrompts), [createUnifiedSetter, setSteps, setBShotPrompts]);
    const setUnifiedGeneratedText = useMemo(() => createUnifiedSetter('GeneratedText', setGeneratedText, setBShotPrompts), [createUnifiedSetter, setGeneratedText, setBShotPrompts]);
    const setUnifiedGeneratedTextx = useMemo(() => createUnifiedSetter('GeneratedTextx', setGeneratedTextx, setBShotPrompts), [createUnifiedSetter, setGeneratedTextx, setBShotPrompts]);
    const setUnifiedSteps2 = useMemo(() => createUnifiedSetter('steps2', setSteps2, null, true), [createUnifiedSetter, setSteps2]);
    const setUnifiedVideoArray = useMemo(() => createUnifiedSetter('VideoArray', setVideoArray, setBShotVideoArray), [createUnifiedSetter, setVideoArray, setBShotVideoArray]);
    const setUnifiedVideoArrayBlob = useMemo(() => createUnifiedSetter('VideoArrayBlob', setVideoArrayBlob, setBShotVideoArrayBlob), [createUnifiedSetter, setVideoArrayBlob, setBShotVideoArrayBlob]);

    useEffect(() => {
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
    }, [generatedImagePrompt, GeneratedText, referenceImages, steps?.length]);

    useEffect(() => {
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
    }, [referenceImages, steps, TextVideo]);

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

    /* 2ï¸âƒ£ one timer handle per tile */
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
    function updateLoader(idx: number, pct: number) {
        setLoaders((prev) => {
            const next = [...prev];
            while (next.length <= idx) next.push(0);
            if (pct > next[idx]) next[idx] = pct;
            return next;
        });
    }


    /**
     * 1. Call your backend to get a â€œvisualPromptText.â€
     * 2. Then call the huggingface SDXL endpoint with that text to generate an image.
     */
    // Define the sleep function
    const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    const [dbLoad, setdbLoad] = useState(false);

    const [ThumbGo, setThumbGo] = useState(false);

    const Close = () => {
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
        if (setIsBShotModeActive) setIsBShotModeActive(false);
    };

    const [isLoading, setisLoading] = useState<boolean>(false);

    const [LoadData, setLoadData] = useState("Processing..");

    const [saveBlob, setsaveBlob] = useState<any>(null);

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
            const nextImages = (current.images || []).map((sceneArr: any[]) => [...(sceneArr || [])]);
            const nextVideos = (current.videos || []).map((sceneArr: any[]) => [...(sceneArr || [])]);
            const nextPrompts = (current.prompts || []).map((sceneArr: any[]) => [...(sceneArr || [])]);

            const imageUrlToDelete = nextImages?.[index]?.[bIndex] || bShotImages?.[index]?.[bIndex];
            const videoUrlToDelete = nextVideos?.[index]?.[bIndex] || bShotVideos?.[index]?.[bIndex];

            if (imageUrlToDelete) {
                await startDelete(imageUrlToDelete);
            }
            if (videoUrlToDelete) {
                await startDeleteVid(videoUrlToDelete);
            }

            while (nextImages.length <= index) nextImages.push([]);
            while (nextVideos.length <= index) nextVideos.push([]);
            while (nextPrompts.length <= index) nextPrompts.push([]);

            if (!nextImages[index]) nextImages[index] = [];
            if (!nextVideos[index]) nextVideos[index] = [];
            if (!nextPrompts[index]) nextPrompts[index] = [];

            nextImages[index][bIndex] = null;
            nextVideos[index][bIndex] = null;

            bShotTruthRef.current = {
                images: nextImages,
                videos: nextVideos,
                prompts: nextPrompts
            };

            if (setBShotImages) setBShotImages(nextImages);
            if (setBShotVideos) setBShotVideos(nextVideos);

            void saveBShotTruthPayload(nextImages, nextVideos, nextPrompts, "Failed to persist BShot deletion")
                .catch(() => undefined);
        }

        setPendingDelete(null);
    };

    const anyGenerating = React.useMemo(() => {
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
    }, [isGenerating, isBShotGenerating]);

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

    const [EnhanceCaption, setEnhanceCaption] = useState("");

    const [EnhanceTitle, setEnhanceTitle] = useState("");


    const [price4all, setPrice4all] = useState(0);

    //Imagen

    const applyArtStyleToPlan = (
        plan: any,
        style: string
    ): any => {
        if (style === "Auto") {
            console.log("Plan Created:", plan); // <- âœ¨ hereâ€™s your plan
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


            if (modelz === 'fluxUltra') {

                x = 'kontext';
            }
            else if (modelz === 'Schnell' || modelz === 'Models') {

                x = 'Schnell';
            }
        }

        var pixelsPerImage = calcModelPixels({
            model: x,
            baseImagesPerDollar: 333,
        });


        var cc = steps.length - 1;
        setPrice4all(pixelsPerImage * cc);
    }, [modelz, steps, type, GeneratedImage]);  // dependencies alert



    const [PLoader, setPLoader] = useState(false);

    const [PlanVid, setPlanVid] = useState<any>(null);

    const [SelectedModel, setSelectedModel] = useState('');

    // Video clip duration (seconds). Lifted from EditStory so it is the single
    // source of truth shared between the video editor and the B-shot duration
    // calculation. EditStory receives time/setTime as props.
    const [time, setTime] = useState(
        SelectedModel === "Pro" ? 5 :
            SelectedModel === "pPro" ? 5 :
                SelectedModel === "Proxxx" ? 5 : SelectedModel === "Prox" ? 5 : SelectedModel === "Proxx" ? 6 :
                    5
    );

    // ... existing state
    const [activatevoicenarration, setactivatevoicenarration] = useState(true);

    // Define the EnhanceText function
    const StartPlan = async (planImg: any, steps: any) => {


        setPLoader(true);

        try {
            // Prepare the request payload

            const requestData: any = { planImg, steps };

            var tt = 'startPlanVid';


            // Make the POST request to the server Models
            const response = await axios.post<any>(
                `${CLIK_URL}/${tt}`,
                requestData,
                { withCredentials: true }
            );


            const { plan } = response.data                     // <- âœ¨ hereâ€™s your plan
            console.log("Plan Created:", plan)

            // example use:



            var finalPlan = plan;

            /// setPlanInfo(3)

            console.log('PlaaaaaaaaaaNNNNVIDDDDDDDD', finalPlan)


            finalPlan = applyArtStyleToPlan(plan, '');
            // do something with finalPlanâ€¦






            setPlanVid(finalPlan);


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

            console.log("ðŸ”¥ Storybook.tsx: useEffect triggered StartPlan (Grid Reset)! Dependencies changed:", { VideMode, Planx, steps, steps2 });

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

        // âœ… On mobile: DO NOTHING with JS â€“ let native scroll handle it
        if (isTouchDevice) return;

        // âœ… On PC: block back/forward on horizontal wheel, but keep scrolling
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




    /* 1ï¸âƒ£  NEW STATE  â€“â€“ lives with your other useState hooks VideMode           */
    const [firstImageDims, setFirstImageDims] = useState<{
        width: number;
        height: number;
    } | null>(null);

    const firstImageRef = useRef<HTMLImageElement | null>(null);



    const [activeLoaderCallerChecker, setActiveLoaderCallerChecker] = useState(false);




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
        if (!imgEl) return; // the element isnâ€™t in the DOM yet

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



    const startDeleteDB = async (id: any) => {
        try {

            //del-
            await axios.post(
                `${CLIK_URL}/delPost`,
                { postId: id },          // <-- body
                { withCredentials: true }   // <-- config
            );

            // success: update UI, toast, etc.
            //  setDeleted(true);
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            // setLoadingDatabase2(false);
        }
    };

    const startDeletep = async (imageUrl: any) => {
        try {

            //del-
            await axios.post(
                `${CLIK_URL}/del-image`,
                { url: imageUrl },          // <-- body
                { withCredentials: true }   // <-- config
            );

            // success: update UI, toast, etc.
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {

        }
    };

    const deleteFeedImages = async (images: string[]) => {
        for (const url of images) {
            ///alert(url);
            if (!url) continue;       // skip empty slots / undefined
            await startDeletep(url);  // your existing delete helper
        }
    };

    // pageType: number
    // videoArrayLastFrame: { stepback1: Blob | null; stepbackTwice: Blob | null }[]



    const isInteractionSlotLocked = (idx: number) => {
        // Only lock in interaction mode
        if (type !== 3) return false;

        // MainSscene (index 0) is always allowed
        if (idx === 0) return false;

        const entry = videoArrayLastFrame[idx];
        return !entry || !entry.stepback1 || !entry.stepbackTwice;
    };


    const saveToDastabase = useCallback(
        async (blobs: any[], HdFluxArray: any[]) => {
            setImagesHdCloud(HdFluxArray);

            setisLoading(true);
            setLoadData("Saving..");

            const dataToSave: any = {
                id: loggedUser ? loggedUser.id : null,
                topic: "",
                mode: type === 0 ? 0 : type === 3 ? 2 : 1,
                caption: prompt,

                kontext: GeneratedImage.length > 0 ? GeneratedImage[0] : null,
                prompt: prompt ? prompt : null,
                model: modelz === "Models" ? "fluxSchnell" : modelz,
                ratio: ratioKey,
            };

            // âœ… ALWAYS drive saving by steps.length (ALL modes)
            const count = steps?.length ?? 0;

            for (let i = 0; i < count; i++) {
                const n = i + 1;

                dataToSave[`image${n}`] = blobs?.[i] ?? null;
                dataToSave[`imageHd${n}`] = HdFluxArray?.[i] ?? null;

                dataToSave[`txt${n}`] = steps?.[i] ?? null;
                dataToSave[`GeneratedText${n}`] = GeneratedText?.[i] ?? null;
            }

            axios
                .post(`${CLIK_URL}/PostStory`, { values: dataToSave })
                .then((response: any) => {
                    const newRowId = response.data.go;

                    setStopText(false);
                    setdbLoad(false);
                    setHideSave(false);
                    setisLoading(false);

                    setPostId(newRowId);

                    // --- Protection: Remove in-use images from cleanup list ---
                    const inUseImages = [
                        dataToSave.kontext,
                        ...HdFluxArray
                    ];
                    RemoveFromDeleteLater(inUseImages);

                    // (Optional) Protection for videos
                    if (VideoArray && VideoArray.length > 0) {
                        RemoveVideoFromDeleteLater(VideoArray);
                    }

                    localStorage.removeItem("S3fromprompt");

                    console.log("ðŸ”¥ Storybook.tsx: Images saved! Now calling StartPlan...");
                    StartPlan(Planx, steps2);

                    setVideMode(true);
                    setnarrate(2);
                })
                .catch((error) => {
                    setHideSave(false);
                    setdbLoad(false);
                    setisLoading(false);
                    setHideSave(false);
                    console.log(error);
                });
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
            MemeMusic,
            music,
            GeneratedImage,
            ratioKey,
            modelz,
            CLIK_URL,
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

    const uploadAllImagesToS3 = useCallback(async () => {
        //callCreatemp4


        setisLoading(true);
        setLoadData("Uploading Images..");

        setdbLoad(true);



        if (PostId > 0) {

            await deleteFeedImages(ImagesHdCloud); // user waits for heavy work

            // don't block UI on this
            startDeleteDB(PostId).catch(err => {
                console.error("DB delete failed:", err);
            });
        } else {

            // alert('jhj');
        }


        // setdbLoad(true);startPlan delete

        try {
            // Weâ€™ll store the final S3 URLs here
            const s3Urls: string[] = [];

            // Loop through each generated Blob
            for (let i = 0; i < generatedImagesFluxBlobHd.length; i++) {
                const blob = generatedImagesFluxBlobHd[i];
                if (!blob) {
                    s3Urls.push(""); // or null
                    continue;
                }

                // 1) Call your existing function to get a signed URL
                const signedUrls = await GenerateSignedUrlForSingleImage(blob);

                // 2) Call the actual "put" operation, uploading to S3
                const uploadedHdUrl = await PutSingleImageInS3WithURL(blob, signedUrls);


                // 3) Push the final HD S3 URL into our array
                s3Urls.push(uploadedHdUrl);
            }

            // Now that all images are uploaded, call saveToDastabase with final URLs

            ///setDone(true);
            uploadAllImagesToS3Default(s3Urls);
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
        ratioKey
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
        async (HdFluxArray: any) => {
            setdbLoad(true);

            // setdbLoad(true);

            try {
                // Weâ€™ll store the final S3 URLs here
                const s3Urls: string[] = [];

                // Loop through each generated Blob
                for (let i = 0; i < generatedImagesFluxBlob.length; i++) {
                    const blob = generatedImagesFluxBlob[i];
                    if (!blob) {
                        s3Urls.push(""); // or null
                        continue;
                    }

                    // 1) Call your existing function to get a signed URL
                    const signedUrls = await GenerateSignedUrlForSingleImage(blob);

                    // 2) Call the actual "put" operation, uploading to S3
                    const uploadedHdUrl = await PutSingleImageInS3WithURL(
                        blob,
                        signedUrls
                    );

                    // 3) Push the final HD S3 URL into our array
                    s3Urls.push(uploadedHdUrl);
                }

                // Now that all images are uploaded, call saveToDastabase with final URLs

                ///setDone(true);
                saveToDastabase(s3Urls, HdFluxArray);
            } catch (err) {
                setHideSave(false);
                // Close();
                console.error("Error uploading all images to S3:", err);
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
            ratioKey
        ]
    );

    useEffect(() => {
        // Check if all items are not empty strings
        const allItemsFilled = generatedImagesFluxBlob.every(
            (item) => item instanceof Blob
        );

        // Alternatively, if you want to check for non-null and non-empty:
        // const allItemsFilled = generatedImagesFlux.every(item => item != null && item.trim() !== "");

        // Check if the number of filled items equals the number of steps
        if (allItemsFilled && generatedImagesFluxBlob.length === steps.length) {
            //saveToDastabase();

            setDone(true);
            /// uploadAllImagesToS3();
        }
    }, [generatedImagesFluxBlob, steps, generatedImagesFlux]);

    // Add a new piece of state to track poll status
    const [pollStatus, setPollStatus] = useState<string>("");



    const [open, setOpen] = React.useState(false);

    const [open2, setopen2] = React.useState(false);
    const [hideExpandedSceneText, setHideExpandedSceneText] = useState(false);
    const [promptPreviewIndex, setPromptPreviewIndex] = useState<number | null>(null);
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
            steps.every((_: any, i: any) => {                              // for each positionâ€¦
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
        if (_stopped || signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        // --- CRITICAL FIX: DO NOT REGENERATE IF TEXT ALREADY EXISTS ---
        // If the user already has a generated image prompt (or one injected with @Characters),
        // we must immediately return it and prevent the AI from overwriting it.
        const existingText = GeneratedText[stepIndex]?.trim();
        if (existingText) {
            // Optional: Still start loader visually, but resolve immediately
            // startLoader(stepIndex);
            return existingText;
        }

        const maxAttempts = 4;
        const retryDelayMs = 6000;

        startLoader(stepIndex);

        try {
            let attempt = 0;

            // ---------- STORY MODE ----------
            if (type === 1) {
                const pairIndex = Math.floor(stepIndex / 2);
                const modeKey = GeneratedImage.length > 0 ? "K" : "N";
                const stage2Key = `clikb:story:stage2:${storyRunIdRef.current}:${modeKey}:${pairIndex}`;

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

                        // last resort: donâ€™t crash pipeline
                        return (GeneratedText?.[stepIndex] ?? GeneratedText?.[stepIndex - 1] ?? "").trim();
                    };

                    const stage2 = await waitForStage2();

                    if (stage2) {
                        // optional: ensure UI has it
                        setGeneratedText((prev) => {
                            const next = [...prev];
                            next[stepIndex] = stage2;
                            return next;
                        });

                        setGeneratedTextx((prev) => {
                            const next = [...prev];
                            next[stepIndex] = stage2;
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

                        const requestData = { text: stepText, prompt, Planx };

                        // âœ… stage endpoints
                        let xx = "ImageDesignStoryStage";
                        if (GeneratedImage.length > 0) xx = "ImageDesignStoryStageKontext";

                        const resp = await fetch(`${CLIK_URL}/${xx}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestData),
                            credentials: "include",
                            signal,
                        });

                        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                        const data = await resp.json();
                        let stage1: string | null = (data?.visualPromptStage1 ?? null);
                        let stage2: string | null = (data?.visualPromptStage2 ?? null);

                        if (stage1) {
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

                            // cache stage2 so odd index can always â€œread & clearâ€
                            try { localStorage.setItem(stage2Key, stage2); } catch { }
                        }

                        return stage1 ?? null;

                    } catch (err: any) {
                        if (err?.name === "AbortError") throw err;

                        console.error(`fetchAndGenerateImage (story even) attempt ${attempt} failed`, err);

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

                    const requestData = { text: stepText, prompt, Planx };
                    let xx = "ImageDesignStory";
                    ///  if (GeneratedImage.length > 0) xx = "ImageDesignStoryKontext";

                    const resp = await fetch(`${CLIK_URL}/${xx}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestData),
                        credentials: "include",
                        signal,
                    });

                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                    const data = await resp.json();
                    let visualPromptText = data?.visualPrompt ?? null;

                    if (visualPromptText) {
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

                    console.error(`fetchAndGenerateImage attempt ${attempt} failed`, err);

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
            return await promise;
        } catch (err) {
            delete promptFetchCacheRef.current[stepIndex];
            throw err;
        }
    }


    // Example updated handleSubmitFluxImage
    const handleSubmitFluxImageNew = useCallback(
        async (
            s3imagesUrlArray: any,
            enhancedPromptx: any,
            loggedUserx: any,
            index: any,
            s3ResultUrl: any,
        ) => {

            ///  alert(s3imagesUrlArray.length);

            /// alert('ijj');

            const ctrl = new AbortController();

            // wait for the result here
            const enhancedPrompt = await fetchAndGenerateImage(steps[index], index, null, type, ctrl.signal);


            if (!enhancedPrompt) {
                // aborted or no text â€” fallback to original
                // or return early if you require a result
                return;
            }

            // --- HYBRID MANUAL MODE LOGIC ---
            if (CreationMode === 'Video' && nanoImages && nanoImages[index]) {
                const nanoUrl = nanoImages[index];
                try {
                    const dummyBlob = new Blob([], { type: 'image/png' });
                    let nanoBlob = dummyBlob;
                    try {
                        const fetchRes = await fetch(nanoUrl);
                        nanoBlob = await fetchRes.blob();
                    } catch (e) {
                        console.warn("Could not fetch blob for nanoImage, using dummy blob", e);
                    }

                    setGeneratedImagesFluxBlob((prev: any) => { const next = [...prev]; next[index] = nanoBlob; return next; });
                    setGeneratedImagesFluxBlobHd((prev: any) => { const next = [...prev]; next[index] = nanoBlob; return next; });
                    setGeneratedImagesFlux((prev: any) => { const next = [...prev]; next[index] = nanoUrl; return next; });

                    setDummyImageUrls((prev) => ({ ...prev, [index]: nanoUrl }));

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
                }
            }
            // --------------------------------

            startLoader(index);
            setPollStatus("Polling Replicate...");


            ///alert(enhancedPrompt); installHook.js:1 fetchAndGenerateImage

            if (timeoutsDisabledRef.current) return;

            if (index === 0) {
                setContinue(false);
            }
            try {

                // Extract active characters specifically matching this scene's tracked index
                const activeCharsForScene = (CreationMode === 'Video' ? sceneActiveCharactersVideo : sceneActiveCharacters)[index] || [];

                // Build the payload
                var payload: any = {
                    inputs: enhancedPrompt,
                    // `ty` is the only image-shape instruction.
                    guidance: 7.5,
                    num_inference_steps: 35,
                    seed: Seed,
                    ty: ratioKey,
                    Png: true,
                };

                // Conditionally include the image if available
                var url = "fluxschnell";

                if (CreationMode === 'Video') {
                    url = "fluxschnell";
                }
                else if (activeCharsForScene.length > 0) {

                    // Extract valid reference image URLs from current strictly active characters
                    const characterUrls = activeCharsForScene
                        .map((c: any) => c.image || c.imageUrl || c.url)
                        .filter((u: any) => u && typeof u === 'string' && u.trim() !== '');

                    // 1. Map over ALL URLs and create a promise for each conversion
                    const imagePromises = characterUrls.map(async (imgUrl: any) => {
                        if (!imgUrl || imgUrl.trim() === "") return null;

                        try {
                            // âœ… no fetch / no blob / no base64
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

                        url = 'kontext';
                    }

                    else if (modelz === 'fluxUltra2') {

                        url = 'fluxUltra2';
                    }

                    else if (modelz === 'Gpt Image') {

                        url = 'GptImage';
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

                else if (modelz === 'Gpt Image') {

                    url = 'GptImage';
                } else {

                    url = 'fluxschnell';


                }

                //  type === 3

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

                finishLoader(index);


                if (!timeoutsDisabledRef.current) {
                    // clear any previous timeout for this index
                    if (timeoutRefsxp.current[index]) {
                        clearTimeout(timeoutRefsxp.current[index]!);
                        timeoutRefsxp.current[index] = null;
                    }

                    timeoutRefsxp.current[index] = setTimeout(async () => {

                        ///alert(index);

                        if (timeoutsDisabledRef.current) return;

                        // Extract final base64 from server
                        const { imageBase64 } = response.data;
                        if (!imageBase64) {
                            throw new Error("No imageBase64 returned from server");
                        }

                        // Convert the returned base64 back to a Blob
                        const fluxImageBlobx = await (async () => {
                            const fetchRes = await fetch(imageBase64);
                            return await fetchRes.blob();
                        })();

                        // Convert the blob to HD WebP
                        const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                            fluxImageBlobx
                        );

                        const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(
                            fluxImageBlobx
                        );

                        if (index === 0) {
                            setsaveBlob(fluxImageBlob);
                        }

                        // --- Automated S3 Upload & Cleanup Tracking ---
                        try {
                            const signedUrls = await GenerateSignedUrlForSingleImage(fluxImageBlobHd);
                            const uploadedHdUrl = await PutSingleImageInS3WithURL(fluxImageBlobHd, signedUrls);

                            // Add to history so it shows in "Created Scenes"
                            setImagesHdCloud((prev: string[]) => {
                                const next = [...prev];
                                next[index] = uploadedHdUrl;
                                return next;
                            });

                            // Track for cleanup
                            Saveprompthelperfordellater(uploadedHdUrl);
                        } catch (s3Err) {
                            console.error("Automated S3 upload failed in story loop:", s3Err);
                        }

                        ///setGeneratedImageFluxBlob(fluxImageBlob);

                        /// GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

                        const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

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

                        if (CreationMode === 'Video') {
                            setDummyImageUrls((prev) => ({ ...prev, [index]: fluxImageUrl }));
                        }

                        if (index === 0) { InteractionsPromptS3Upload(fluxImageBlobHd); }



                        var modelPrice = calcModelPixels({
                            model: modelz,          // or m.name, however you store the model label
                            baseImagesPerDollar: 333       // keep in sync with what you pass the component
                        });

                        //type === 3

                        removePixel(modelPrice);

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
                                // Grab the last generated blob in the array

                                var lastBlob: any = fluxImageBlob;

                                if (saveBlob) {
                                    lastBlob = saveBlob;
                                }



                                handleSubmitFluxImageNew(s3imagesUrlArray, GeneratedText[index + 1], loggedUser, index + 1, s3ResultUrl);


                            }
                        }
                    }, 4500);

                }

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err: any) {

                // 1ï¸âƒ£  pull whatever text is available
                let serverMsg = "";
                if (err.response?.data) {
                    if (typeof err.response.data === "string") {
                        serverMsg = err.response.data;            // raw text
                    } else if (typeof err.response.data.error === "string") {
                        serverMsg = err.response.data.error;      // { error: "â€¦" }
                    }
                }
                if (!serverMsg) serverMsg = err.message || "";

                // 2ï¸âƒ£  now do simple substring tests
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
        [prompt, generatedImages, generatedImagesFlux, modelz, Planx, Seed, timeoutRefsxp, GeneratedText, s3ResultUrl, steps, type, CreationMode, sceneActiveCharacters, sceneActiveCharactersVideo]
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




    /** 2) Your existing hook â€” just make it RETURN the public URL. */
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

        /* start slightly away from 0 so history-swipe canâ€™t kick in */
        node.scrollLeft = MIN;

        node.addEventListener("scroll", clamp, { passive: true });
        return () => node.removeEventListener("scroll", clamp);
    }, []);



    const removePixel = async (amount: number): Promise<any> => {
        /* ---------- input-level validation ---------- */
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("Amount must be a positive integer");
        }

        try {
            const { data } = await axios.post<{ userid: number; pixels: number }>(
                `${CLIK_URL}/spendPixels`,
                {
                    values: {
                        userid: loggedUser?.id ?? 0,
                        amount,
                    },
                }
            );





            dispatch(setPixels(data.pixels));


        } catch (err) {
            console.error("Error spending pixels:", err);
            throw new Error("Failed to spend pixels");  // bubble up a friendly error
        }
    };

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
     * Converts an input Blob (PNG/JPEG/etc.) into a resized image Blob at 1080Ã—1920.
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
        : "1px solid rgba(255, 255, 255, 0.4)";
    const storyActionBoxShadow = darkMode
        ? "0 8px 32px 0 rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(0, 0, 0, 0.28)"
        : "0 8px 32px 0 rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.2)";
    const storyActionGlassSx = {
        background: buttonTheme.bg,
        backdropFilter: "blur(24px) saturate(120%)",
        color: buttonTheme.text,
        textShadow: "none",
        border: storyActionBorder,
        borderRadius: 12,
        boxShadow: storyActionBoxShadow,
        transform: "translateY(-2px)",
        transition:
            "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",
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
                : "0 8px 32px 0 rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.28)",
            transform: "translateY(0)",
            border: storyActionBorder,
            "&::before": {
                opacity: 0.8,
                animation: `${glassSweep} 1.8s ease-out forwards`,
            },
        },
        "&:active": {
            background: "rgba(5, 5, 5, 0.55)",
            boxShadow: "0 4px 16px rgba(0,0,0,.30)",
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
        backdropFilter: "blur(24px) saturate(120%)",
        color: buttonTheme.text,
        border: darkModeReducer
            ? "1px solid rgba(0, 0, 0, 0.42)"
            : "1px solid rgba(255, 255, 255, 0.4)",
        boxShadow: darkModeReducer
            ? "0 8px 24px rgba(0,0,0,0.55)"
            : "0 8px 24px rgba(0,0,0,0.12)",
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

        // Music-video gate: only extra scenes beyond the song formula count
        // (musicSegments.length) may be deleted. Mirrors the popup gating.
        if (isStoryMusicVideoMode) {
            const currentLogical = Math.ceil(steps.length / 2);
            const requiredLogical = Array.isArray(musicSegments) ? musicSegments.length : 0;
            if (requiredLogical > 0 && currentLogical <= requiredLogical) return;
        }

        const { rawStart, rawCount, narrationIndex } = getSceneDeleteRange(rawIndex);
        const newRawLength = steps.length - rawCount;
        const spliceRaw = removeRangeUpdater(rawStart, rawCount);
        const spliceNarration = removeRangeUpdater(narrationIndex, 1);

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
        setStepsx(spliceRaw);
        setGeneratedImagesFlux(spliceRaw);
        setImagesHdCloud(spliceRaw);
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
        setLipSyncPromptBackup(spliceRaw);
        setReferenceVideoUrls(spliceRaw);
        setReferenceVideoActiveList(spliceRaw);

        // --- Narration / logical-scene arrays ---
        setSteps2(spliceNarration);
        if (setGeneratedAudios) setGeneratedAudios(spliceNarration);
        if (setGeneratedAudioTexts) setGeneratedAudioTexts(spliceNarration);
        setGeneratedAudiosCloud(spliceNarration);
        if (setAudioSceneStatuses) setAudioSceneStatuses(spliceNarration);

        // NOTE: musicSegments is intentionally NOT touched here. Segments are
        // formula-owned (NotepadEditor: ceil(songDuration / (breaker * 2)),
        // positional start/end). Music-mode deletes are gated in the popup so
        // only scenes BEYOND the formula count can be removed â€” after which
        // the existing segment list already matches the remaining scenes.

        // --- B-shot arrays (outer index = raw scene index) ---
        if (setBShotImages) setBShotImages(spliceRaw);
        if (setBShotVideos) setBShotVideos(spliceRaw);
        if (setBShotPrompts) setBShotPrompts(spliceRaw);
        if (setBShotTextVideo) setBShotTextVideo(spliceRaw);
        if (setBShotNanoImages) setBShotNanoImages(spliceRaw);
        setBShotVideoArray(spliceRaw);
        setBShotVideoArrayBlob(spliceRaw);
        setBShotLoaders(spliceRaw);
        setIsBShotGenerating(spliceRaw);

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
        const payload = {
            inputs: promptText,
            width: 1080,
            height: 1920,
            guidance: 7.5,
            num_inference_steps: 35,
            seed: Seed || 42,
            ty: ratioKey
        };
        // Fire and forget â€” runs in background, never aborted
        axios.post(`${CLIK_URL}/fluxschnell`, payload)
            .then((response) => {
                const responseData = response.data as any;
                if (responseData && responseData.imageBase64) {
                    let finalImage = responseData.imageBase64;
                    if (!finalImage.startsWith('data:image')) {
                        finalImage = `data:image/png;base64,${finalImage}`;
                    }
                    setPreviewImage(finalImage);
                    if (setNanoImages) {
                        setNanoImages((prev: string[]) => {
                            const next = [...prev];
                            next[sceneIndex] = finalImage;
                            return next;
                        });
                    }
                }
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
                            // FIRE NANO DIRECTLY â€” no React state, no batching issues
                            // Each scene's nano image runs in parallel, all complete independently
                            fireNanoForScene(generatedPrompt, index);
                        }
                    } catch (e) {
                        console.error(`Prefetch failed for index ${index}`, e);
                    }
                }

                setFetchingPrompts(false);
                // DO NOT abort nano requests here â€” they are fire-and-forget
                // and must ALL complete for glass box 2 to have every image

                // Notify parent that prompt fetching is successfully completed!
                if (!_stopped && onAllPromptsGenerated) {
                    onAllPromptsGenerated();
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
                console.log("sum:", data.summary);

                console.log("title done:", data.title);

                // 2. Put the title into your caption state:
                setEnhanceCaption(data.summary);

                setEnhanceTitle(data.title);

                // 3. Kick off your TTS with the summary:
                /// setisLoading(false);

                handleGenerateAudio(data.summary, voice);
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
     *       If youâ€™re using an OAuth token, youâ€™ll need an Authorization header with a Bearer token.
     */
    const fetchAndGenerateSpeech = useCallback(
        async (
            stepTextRaw: any,
            stepIndex: number,
            voiceName: string,
            voiceId: any
        ) => {
            const isModalFlow = isAudioGenerating;
            if (!isModalFlow) {
                setisLoading(true);
                setLoadData("Generating Audio..");
            }

            if (isModalFlow) {
                setAudioSceneStatuses((prev: any) => {
                    const next = [...prev];
                    if (next[stepIndex]) {
                        next[stepIndex] = { ...next[stepIndex], status: 'generating' };
                    }
                    return next;
                });
            }

            const stepText = typeof stepTextRaw === 'object' && stepTextRaw !== null ? stepTextRaw.text : stepTextRaw;
            const promptText = typeof stepTextRaw === 'object' && stepTextRaw !== null && stepTextRaw.prompt ? stepTextRaw.prompt : "DIRECTOR'S NOTES: Clear and expressive delivery.";

            try {
                // (Optional) delay between requests
                await sleepx(100);

                // Build the request payload for Replicate TTS
                const requestData = {
                    text: stepText,
                    voice: voiceName,
                    prompt: promptText,
                    language_code: "en-US"
                };

                // Make the call to Replicate TTS
                const response: any = await axios.post(
                    `${CLIK_URL}/generateReplicateAudio`,
                    requestData,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        withCredentials: true
                    }
                );

                // 1) Extract the base64 encoded audio
                const audioContent = response.data?.audioContent;
                if (!audioContent) {
                    throw new Error("No audioContent in response");
                }

                // 2) Convert the base64 string to a UInt8Array
                const audioBuffer = Uint8Array.from(atob(audioContent), (char) =>
                    char.charCodeAt(0)
                );

                // 3) Build a Blob from the binary data
                const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

                // 4) Convert the Blob into an object URL so we can play it in the browser
                const audioUrl = URL.createObjectURL(audioBlob);

                // 5) Update your 'generatedAudios' array in state
                setGeneratedAudios((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = audioUrl;
                    return next;
                });

                setGeneratedAudioTexts((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = stepText;
                    return next;
                });

                if (isModalFlow) {
                    setAudioSceneStatuses((prev: any) => {
                        const next = [...prev];
                        if (next[stepIndex]) {
                            next[stepIndex] = { ...next[stepIndex], status: 'success' };
                        }
                        return next;
                    });
                }

                console.log("done with audio");
            } catch (error: any) {
                // Use state to notify the useEffect of the failure
                setGeneratedAudios((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = "ERROR";
                    return next;
                });

                setGeneratedAudioTexts((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = "";
                    return next;
                });

                if (isModalFlow) {
                    setAudioSceneStatuses((prev: any) => {
                        const next = [...prev];
                        if (next[stepIndex]) {
                            next[stepIndex] = { ...next[stepIndex], status: 'error', errorMsg: error.message };
                        }
                        return next;
                    });
                } else {
                    setAudioError({
                        show: true,
                        scene: `Scene ${stepIndex + 1}`,
                        text: stepText,
                        message: error?.response?.data?.error || error.message || "Failed to generate audio"
                    });
                }

                console.error("TTS Error:", error.message || error);
                throw error;
            } finally {
                if (!isModalFlow) {
                    setisLoading(false);
                }
            }
        },
        [activatevoicenarration, ratioKey, isAudioGenerating, setAudioSceneStatuses, setGeneratedAudios, setGeneratedAudioTexts, setisLoading, setLoadData]
    );

    // 4) Generate narration audio for each plot. Caption audio is intentionally skipped.
    const callvoice = useCallback(
        async (caption: string, plots: string[], voiceId: string) => {
            setGeneratedAudios((prev: any) => {
                const next = [...prev].slice(0, plots.length);
                while (next.length < plots.length) {
                    next.push("");
                }
                return next;
            });

            setGeneratedAudioTexts((prev: any) => {
                const next = [...prev].slice(0, plots.length);
                while (next.length < plots.length) {
                    next.push("");
                }
                return next;
            });

            // Generate plots
            for (let i = 0; i < plots.length; i++) {
                try {
                    const idx = i;
                    const plotText = typeof plots[i] === 'object' && plots[i] !== null ? (plots[i] as any).text : plots[i];
                    const needsGen = !generatedAudios[idx] || generatedAudios[idx] === "ERROR" || generatedAudioTexts[idx] !== plotText;
                    if (needsGen) {
                        await fetchAndGenerateSpeech(plots[i], idx, voiceId, "");
                    } else {
                        setAudioSceneStatuses((prev: any) => {
                            const next = [...prev];
                            if (next[idx]) next[idx] = { ...next[idx], status: 'success' };
                            return next;
                        });
                    }
                } catch (err) {
                    console.error(`Plot ${i} voice generation failed:`, err);
                }
            }
        },
        [fetchAndGenerateSpeech, generatedAudios, generatedAudioTexts, setAudioSceneStatuses, setGeneratedAudios, setGeneratedAudioTexts]
    );

    const handleGenerateAudio = useCallback(
        (captionx: any, voice: any) => {
            setIsAudioGenerating(true);
            setisLoading(false);

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

            const initialStatuses = storyT.map((item: any, i: number) => {
                const idx = i;
                const plotText = typeof item === 'object' && item !== null ? (item as any).text : item;
                const isPlotCached = generatedAudios[idx] && generatedAudios[idx] !== "ERROR" && generatedAudioTexts[idx] === plotText;
                return {
                    text: item,
                    status: isPlotCached ? ('success' as const) : ('pending' as const)
                };
            });
            setAudioSceneStatuses(initialStatuses);

            setAudioVoiceGenerationTrigger({ caption: captionx, plots: storyT, voiceId: voice });
        },
        [steps2, generatedAudios, generatedAudioTexts, setIsAudioGenerating, setisLoading, setAudioSceneStatuses, setAudioVoiceGenerationTrigger]
    );

    useEffect(() => {
        if (isAudioGenerating && audioVoiceGenerationTrigger) {
            const { caption, plots, voiceId } = audioVoiceGenerationTrigger;
            setAudioVoiceGenerationTrigger(null); // Clear trigger
            callvoice(caption, plots, voiceId);
        }
    }, [isAudioGenerating, audioVoiceGenerationTrigger, callvoice]);

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

            if (status === "COMPLETE") return;          // âœ… ready!
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
                console.log(`âœ… Secured ${savedCount} assets from auto-deletion.`);
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


            ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3"
            ///"https://clikbatebucket.s3.us-east-1.amazonaws.com/humming-song-59500.mp3",
            var TYPE2_TRACKS: any = [
                "https://clikbatebucket.s3.us-east-1.amazonaws.com/welte-mignon-piano-48794.mp3",
                "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3"


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
                setLoadData("Rendering videoâ€¦");             // optional UI message
                await pollJobUntilComplete(jobId);            // â³ blocks here
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
                            videoLength: videoLength, // must match the MP4â€™s length in seconds
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



                    // 6) Poll until the â€œaddbackgroundmusicâ€ job completes
                    ////   await pollJobUntilComplete(bgJobId);
                    //console.log("âœ… Backgroundâ€music job completed:", bgJobId);







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
            const plotText = typeof storyT[i] === 'object' && storyT[i] !== null ? (storyT[i] as any).text : storyT[i];
            if (!generatedAudios[idx] || generatedAudios[idx] === "ERROR" || generatedAudioTexts[idx] !== plotText) {
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
        type, activatevoicenarration, steps2, generatedAudios, generatedAudioTexts,
        voice, EnhanceCaption, EnhanceCaptionx, handleGenerateAudio,
        setIsBShotModeActive, setIsAudioGenerating, setActiveLoaderCallerChecker
    ]);

    const handleRetrySceneAudio = useCallback(async (idx: number) => {
        const item = audioSceneStatuses[idx];
        if (!item) return;

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
            const allDone = audioSceneStatuses.every(s => s.status === 'success');
            if (allDone) {
                setIsAudioDirty(false);
                setIsAudioGenerating(false);
                setIsBShotModeActive(true);
            }
        }
    }, [audioSceneStatuses, isAudioGenerating, setIsAudioDirty, setIsAudioGenerating, setIsBShotModeActive]);

    // ============================================================================
    // B SHOT ENGINE: Audio-Duration vs Video-Length Calculation
    // ============================================================================
    useEffect(() => {
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

                if (arraysModified) {
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
                // building B-shots at 5s). Ask before wiping/rebuilding â€” no silent reset.
                setShowBShotTimeChangeWarning(true);
            }
        }
    }, [isBShotModeActive, steps, type, activatevoicenarration, generatedAudios, SelectedModel, time, bShotBuiltWithTime, bShotPrompts, bShotImages, bShotVideos, setBShotPrompts, setBShotImages, setBShotVideos]);


    // Stage 3 & 4: Auto-Generate B-Shot Prompts and Nano Images
    // This effect continuously monitors for `[B-Shot]` placeholders and waits for their base `GeneratedText` to be ready!
    useEffect(() => {
        if (!isBShotModeActive || !bShotPrompts || bShotPrompts.length === 0) return;

        const processBShots = async () => {
            if (isGeneratingBShotPrompts) return;

            let needsGeneration = false;
            for (let i = 0; i < bShotPrompts.length; i++) {
                // IMPORTANT: Wait until the base scene's actual cinematic visual prompt is generated!
                if (!bShotPrompts[i] || !GeneratedText[i]) continue;
                for (let j = 0; j < bShotPrompts[i].length; j++) {
                    if (bShotPrompts[i][j].includes("[B-Shot-Pending")) {
                        needsGeneration = true;
                        break;
                    }
                }
            }

            if (!needsGeneration) return;

            setIsGeneratingBShotPrompts(true);
            const updatedPrompts = [...bShotPrompts];

            for (let i = 0; i < updatedPrompts.length; i++) {
                if (!updatedPrompts[i] || !GeneratedText[i]) continue;

                const baseVisualPrompt = GeneratedText[i];

                for (let j = 0; j < updatedPrompts[i].length; j++) {
                    if (updatedPrompts[i][j].includes("[B-Shot-Pending")) {

                        // CHAINED SEQUENTIAL CONTEXT
                        const baseVisualPromptContext = j === 0 ? GeneratedText[i] : updatedPrompts[i][j - 1];
                        const videoPromptContext = j === 0 ? TextVideo?.[i] : bShotTextVideo?.[i]?.[j - 1];

                        const stageIndex = Math.floor(i / 2);
                        const summaryCaption = generatedAudioTexts?.[stageIndex] || "";

                        const requestData = {
                            text: `[CINEMATIC B-SHOT CUTAWAY OR REACTION]. ${summaryCaption}. Visual continuation of: ${baseVisualPromptContext}`,
                            prompt: prompt,
                            Planx: Planx,
                            videoPrompt: videoPromptContext || ""
                        };

                        let xx = "ImageDesignStoryStage";
                        if (GeneratedImage && GeneratedImage.length > 0) xx = "ImageDesignStoryStageKontext";

                        console.log(`[B-Shot Engine - Index ${i}.${j}] Sending to ${xx}:`, requestData);

                        try {
                            const resp = await fetch(`${CLIK_URL}/${xx}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(requestData),
                                credentials: "include"
                            });

                            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                            const data = await resp.json();
                            let aiText = data?.visualPromptStage1 || data?.visualPromptStage2;

                            console.log(`[B-Shot Engine - Index ${i}.${j}] Response:`, aiText);

                            if (aiText && typeof aiText === "string") {
                                // Extract the duration meta-tag from the placeholder to preserve it for the UI
                                const durationMatch = updatedPrompts[i][j].match(/\[B-Shot-Pending (\d+s)\]/);
                                const durationSuffix = durationMatch ? ` [B-Shot ${durationMatch[1]}]` : "";

                                // Overwrite the prompt with AI text, but re-append the duration tag (without "Pending")
                                updatedPrompts[i][j] = aiText.replace(/['"]/g, '') + durationSuffix;

                                setBShotPrompts([...updatedPrompts]);
                                if (setBShotTextVideo) {
                                    setBShotTextVideo((prev: string[][]) => {
                                        const next = [...(prev || [])];
                                        while (next.length <= i) next.push([]);
                                        const sceneArr = [...(next[i] || [])];
                                        sceneArr[j] = updatedPrompts[i][j]; // Use the exact same prompt as a baseline for video text
                                        next[i] = sceneArr;
                                        return next;
                                    });
                                }

                                // Stage 4: Auto-Call Nano Image (Strip the meta-tag for the AI payload)
                                const nanoPayload = {
                                    inputs: aiText.replace(/['"]/g, ''),
                                    width: 1080,
                                    height: 1920,
                                    guidance: 7.5,
                                    num_inference_steps: 35,
                                    seed: Seed || 42,
                                    ty: ratioKey
                                };
                                axios.post(`${CLIK_URL}/fluxschnell`, nanoPayload).then((response) => {
                                    const responseData = response.data as any;
                                    if (responseData && responseData.imageBase64) {
                                        let finalImage = responseData.imageBase64;
                                        if (!finalImage.startsWith('data:image')) {
                                            finalImage = `data:image/png;base64,${finalImage}`;
                                        }
                                        if (setBShotNanoImages) {
                                            setBShotNanoImages((prev: string[][]) => {
                                                const next = [...(prev || [])];
                                                while (next.length <= i) next.push([]);
                                                const sceneArr = [...(next[i] || [])];
                                                sceneArr[j] = finalImage;
                                                next[i] = sceneArr;
                                                return next;
                                            });
                                        }
                                    }
                                }).catch((e) => console.error("B-Shot Nano failed", e));
                            } else {
                                // Fallback if AI text is empty to prevent infinite loop
                                updatedPrompts[i][j] = updatedPrompts[i][j].replace("[B-Shot-Pending", "[B-Shot");
                                setBShotPrompts([...updatedPrompts]);
                            }
                        } catch (err) {
                            console.error("B-Shot Generation Failed", i, j, err);
                            // Fallback on error to prevent infinite retry loop
                            updatedPrompts[i][j] = updatedPrompts[i][j].replace("[B-Shot-Pending", "[B-Shot");
                            setBShotPrompts([...updatedPrompts]);
                        }
                    }
                }
            }
            setIsGeneratingBShotPrompts(false);
        };

        processBShots();

    }, [bShotPrompts, GeneratedText, GeneratedImage, isBShotModeActive, prompt, Planx, Seed, ratioKey, generatedAudioTexts, setBShotPrompts, setBShotNanoImages, isGeneratingBShotPrompts, TextVideo, bShotTextVideo, setBShotTextVideo]);


    const closeT = useCallback(() => {
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
    }, [loggedUser, location]);


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

                    ///closeT();

                    //alert('Load Thumbnail');
                }
            })
            .catch((error) => {
                setisLoading(false);

                console.log(error);
            });
    }, []);

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
    }, [generatedAudios, uploadAudioForLambdaIfNeeded, uploadVisualForLambdaIfNeeded]);

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

                    await saveToDatabase(dataForDb, status.finalVideoUrl);
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
        const totalImages = Math.max(
            generatedImagesFlux?.length || 0,
            ImagesHdCloud?.length || 0
        );

        return Array.from({ length: totalImages }, (_, index) => {
            const cloudImage = ImagesHdCloud?.[index];
            return isUsableMediaUrl(cloudImage)
                ? cloudImage
                : (generatedImagesFlux?.[index] || "");
        });
    }, [ImagesHdCloud, generatedImagesFlux]);

    const handleMusicVideoPublish = useCallback(() => {
        setActiveLoaderCallerChecker(false);
        setAutoStartPublishLoader2(true);
        setPublishLoader2Open(true);
    }, []);

    return (
        <Box sx={{
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
                matchMobile={matchMobile}
                SelectedModel={SelectedModel}
                musicKling={musicKling}
                activatevoicenarration={activatevoicenarration}
                setactivatevoicenarration={handleNarrationToggle}
                musicMode={musicMode}
                onMusicPublish={handleMusicVideoPublish}
            />

            {/* --- NEW PUBLISH LOADER 2 COMPONENT --- */}
            <PublishLoader2
                open={publishLoader2Open}
                onClose={() => {
                    setAutoStartPublishLoader2(false);
                    setPublishLoader2Open(false);
                }}
                type={type}
                darkMode={darkModeReducer}
                matchMobile={matchMobile}
                generatedImagesFlux={publishGeneratedImagesFlux}
                VideoArrayCloud={VideoArrayCloud}
                generatedAudios={generatedAudios}
                bShotImages={bShotImages}
                bShotVideos={bShotVideos}
                bShotPrompts={bShotPrompts}
                postId={PostId}
                usedanimate={usedanimate}
                ratioKey={ratioKey}
                musicname={publishMusicName}
                musicUrl={publishMusicUrl}
                MemeMusic={MemeMusic}
                ClosePromptInput={Close}
                setflip={setflip}
                setminimisePrompt={setminimisePrompt}
                onProcessLambdaRecipe={startLambdaFfmpegPublish}
                lambdaPublishStatus={lambdaPublishStatus}
                musicMode={musicMode}
                clipDurationSec={time}
                musicSegments={musicSegments}
                musicBreakerSec={musicBreakerSec}
                activatevoicenarration={activatevoicenarration}
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
                        <WarningAmberIcon sx={{ fontSize: 60, color: '#f44336', mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: darkModeReducer ? '#fff' : '#000', mb: 1 }}>
                            Reset B Shots?
                        </Typography>
                        <Typography sx={{ color: darkModeReducer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', mb: 3 }}>
                            Changing Narration settings will recalculate your grid and reset your existing B Shot media. Do you want to proceed and lose this data?
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="outlined"
                                onClick={cancelNarrationToggle}
                                sx={{ borderRadius: '50px', px: 3, borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', color: darkModeReducer ? '#fff' : '#000' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={confirmNarrationToggle}
                                sx={{ borderRadius: '50px', px: 3, bgcolor: '#f44336', color: '#fff', '&:hover': { bgcolor: '#d32f2f' } }}
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
                        <WarningAmberIcon sx={{ fontSize: 60, color: '#ff9800', mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: darkModeReducer ? '#fff' : '#000', mb: 1 }}>
                            Video length changed
                        </Typography>
                        <Typography sx={{ color: darkModeReducer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', mb: 3 }}>
                            Your B-shots were built for {bShotBuiltWithTime}s clips, but your video length is now {time}s. Rebuild the B-shots for {time}s, or keep them and close â€” you can delete the {time}s video and regenerate at {bShotBuiltWithTime}s instead.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                            <Button
                                variant="outlined"
                                onClick={cancelBShotTimeRebuild}
                                sx={{ borderRadius: '50px', px: 3, borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', color: darkModeReducer ? '#fff' : '#000' }}
                            >
                                Keep, I'll fix it
                            </Button>
                            <Button
                                variant="contained"
                                onClick={confirmBShotTimeRebuild}
                                sx={{ borderRadius: '50px', px: 3, bgcolor: '#ff9800', color: '#fff', '&:hover': { bgcolor: '#f57c00' } }}
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
                        border: `2px solid ${darkModeReducer ? '#E8BAFA' : '#0099cc'}`,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        color: darkModeReducer ? '#fff' : '#000',
                        outline: 'none',
                    }}>
                        {/* Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                Voice Narration Progress
                            </Typography>
                            <IconButton onClick={() => setIsAudioGenerating(false)} size="small" sx={{ color: 'inherit' }}>
                                <CloseIcon />
                            </IconButton>
                        </Box>

                        {/* List Container */}
                        <Box className="custom-scroll" sx={{ flex: 1, overflowY: 'auto', pr: 1, mb: 3 }}>
                            {audioSceneStatuses.map((item, idx) => {
                                const pColor = darkModeReducer ? '#E8BAFA' : '#0099cc';
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
                                                                bgcolor: darkModeReducer ? 'rgba(232,186,250,0.1)' : 'rgba(0,153,204,0.1)'
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
                    const isDummy = dummyImageUrls[index] === generatedImagesFlux[index];
                    const isSceneGenerating = !!isGenerating?.[index] || (loaders?.[index] || 0) > 0;
                    const isBShotArrayExpanded = isBShotModeActive && (bShotPrompts?.[index]?.length || 0) > 0;


                    const fallbackImage = loggedUser
                        ? `${loggedUser.image}`
                        : "https://via.placeholder.com/400x250.png?text=No+User+Image";

                    return (
                        <React.Fragment key={`group-${index}`}>

                            <div
                                key={`main-${index}`}
                                style={{
                                    flex: "0 0 auto", // ensure each item doesnâ€™t shrink

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
                                {generatedImagesFlux[index] && (
                                    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                        <img
                                            ref={index === 0 ? firstImageRef : null}
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
                                                    setstartEdit(true);
                                                    setactiveEdit(index);
                                                    setActiveBShotEdit(null);
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
                                        {/* VIDEO PLAY OVERLAY */}
                                        {((VideMode || isValidVideo(VideoArrayCloud?.[index])) && !isSceneGenerating) && (
                                            <Box
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isLocked) return;
                                                    if (Donex) {
                                                        setstartEdit(true);
                                                        setactiveEdit(index);
                                                        setActiveBShotEdit(null);
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
                                                    <Button variant="contained" color="error" size="small" onClick={(e) => { e.stopPropagation(); confirmDelete(); }}>Yes</Button>
                                                    <Button variant="outlined" size="small" sx={{ color: '#fff', borderColor: '#fff' }} onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}>No</Button>
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>
                                )}
                                {!(generatedImagesFlux[index]) && (
                                    generatedImages?.[index] ? (
                                        <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                            <img
                                                onClick={() => {
                                                    if (Continue) {
                                                        ContinueGen();
                                                    } else if (Donex) {
                                                        if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                            setActiveBShotEdit(null);
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
                                            {/* VIDEO PLAY OVERLAY fallback */}
                                            {((VideMode || isValidVideo(VideoArray[index])) && !isSceneGenerating) && (
                                                <Box
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (Continue) {
                                                            ContinueGen();
                                                        } else if (Donex) {
                                                            if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                                setstartEdit(true);
                                                                setactiveEdit(index);
                                                                setActiveBShotEdit(null);
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
                                        <Box sx={{
                                            position: 'relative',
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            padding: '30% 15% 0% 15%',
                                            boxSizing: 'border-box'
                                        }}>
                                            <img
                                                onClick={() => {
                                                    if (Continue) ContinueGen();
                                                    else if (Donex) {
                                                        setstartEdit(true);
                                                        setactiveEdit(index);
                                                        setActiveBShotEdit(null);
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
                                    ) : (
                                        /* --- NEW GLASS PLACEHOLDER --- */
                                        <Box
                                            onClick={(e) => {
                                                console.error("[Storybook] Pencil Icon Clicked! index:", index, "isLocked:", isLocked);
                                                console.error("[Storybook] anyGenerating:", Object.values(isGenerating || {}).some(Boolean));
                                                e.stopPropagation();
                                                if (Continue) ContinueGen();
                                                else if (Donex) {
                                                    setstartEdit(true);
                                                    setactiveEdit(index);
                                                    setActiveBShotEdit(null);
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
                                                    top: "47%",
                                                    left: 0,
                                                    width: "100%",
                                                    height: 0,
                                                    display: allowgetImage ? index === 0 ? 'flex' : Continue ? 'none' : "flex" :
                                                        'none',
                                                    flexDirection: "column", // spinner â¬† text â¬‡
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    zIndex: 300,
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
                                        }}
                                    >
                                        <GlowWidthBar
                                            value={loaders[index]}
                                            matchMobile={matchMobile}
                                            index={index}
                                        />
                                    </Box>
                                )}


                                {dbLoad && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: "40%",
                                            left: "0px",
                                            width: "100%",
                                            height: "0px",
                                            /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 300, // Above overlay and images
                                            borderRadius: 2,
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

                                {!allowgetImage && (
                                    <>
                                        {/* ================================================================================== */}
                                        {/* NEW CASE: SPLIT BUTTONS AT INDEX 1 (Only if steps.length === 2)                    */}
                                        {/* Left: Video ðŸŽ¥ | Right: Magic Wand ðŸª„                                              */}
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
                                            onClick={ContinueGen}

                                            startIcon={<DoubleArrowIcon sx={{ fontSize: "0.8em" }} />}
                                            sx={{
                                                pointerEvents: "auto",
                                                width: "100%",
                                                height: "auto",
                                                px: 3,
                                                py: 2,
                                                borderRadius: 2,
                                                textTransform: "none",
                                                fontWeight: 700,
                                                fontSize: matchMobile ? "clamp(12px, 2vw, 20px)" : "clamp(14px, 1.8vw, 22px)",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                gap: 1.2,
                                                "& .MuiButton-startIcon": { margin: 0 },
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
                                                    fontSize: '0.95rem',
                                                    letterSpacing: "0.02em",
                                                }}>
                                                    Start
                                                </Box>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        opacity: 0.8,
                                                        fontSize: '0.75rem',
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPromptPreviewIndex(index);
                                            setHideExpandedSceneText(false);
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
                                    <div
                                        key={`bshot-${index}-${bIndex}`}
                                        style={{
                                            flex: "0 0 auto", // ensure each item doesnâ€™t shrink
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
                                                        <img
                                                            src={finalImageToShow}
                                                            alt={`B-Shot ${index + 1}.${bIndex + 1}`}
                                                            style={{
                                                                width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                                opacity: 0.5,
                                                                cursor: "pointer",
                                                                borderRadius: "12px",
                                                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                                                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                                                            }}
                                                            onClick={() => {
                                                                setactiveEdit(index);
                                                                setActiveBShotEdit(bIndex);
                                                                setstartEdit(true);
                                                            }}
                                                        />
                                                        <Box
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setactiveEdit(index);
                                                                setActiveBShotEdit(bIndex);
                                                                setstartEdit(true);
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
                                                            src={finalImageToShow}
                                                            alt={`B-Shot ${index + 1}.${bIndex + 1}`}
                                                            style={{
                                                                width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                                cursor: "pointer",
                                                                borderRadius: "12px",
                                                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                                                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                                                            }}
                                                            onClick={() => {
                                                                setactiveEdit(index);
                                                                setActiveBShotEdit(bIndex);
                                                                setstartEdit(true);
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
                                                        justifyContent: "flex-start",
                                                        paddingTop: "12px",
                                                        cursor: "pointer",
                                                        transition: 'all 0.3s ease',
                                                        '&:hover': {
                                                            background: "rgba(255, 255, 255, 0.08)",
                                                            transform: 'scale(0.98)'
                                                        }
                                                    }}
                                                    onClick={() => {
                                                        setactiveEdit(index);
                                                        setActiveBShotEdit(bIndex);
                                                        setstartEdit(true);
                                                    }}
                                                >
                                                    {/* TRANSLUCENT PLUS ICON IN A SMALL CIRCLE PADDING */}
                                                    <Box sx={{
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
                                                    </Box>
                                                </Box>
                                            )}

                                            {/* DELETE ICON for B-Shot Mode */}
                                            {(isGenerated || isValidVideo(bShotVideos?.[index]?.[bIndex])) && (
                                                <Box
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
                                                        <Button variant="contained" color="error" size="small" onClick={(e) => { e.stopPropagation(); confirmDelete(); }}>Yes</Button>
                                                        <Button variant="outlined" size="small" sx={{ color: '#fff', borderColor: '#fff' }} onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}>No</Button>
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
                                                {`B-SHOT ${index + 1}.${bIndex + 1}`}
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
                    opacity: anyGenerating ? 0 : 1,
                    pointerEvents: anyGenerating ? "none" : "auto",
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
                            onClick={() => {
                                if (isBShotModeActive) {
                                    setIsBShotModeActive(false);
                                } else {
                                    setVideMode(false);
                                }
                            }}
                            variant="contained"
                            color="inherit"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* Flex Sizing: Small on mobile, slightly larger on PC */
                                flex: { xs: 0.5, sm: 0.6 },
                                minWidth: "auto", // Allow shrinking P

                                display: (VideMode || isBShotModeActive) ? 'flex' : 'none',
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

                        {/* 2. PUBLISH BUTTON (NEW) */}
                        <Button
                            onClick={() => {
                                setAutoStartPublishLoader2(false);
                                setPublishLoader2Open(true);
                            }}
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
                                    ? "linear-gradient(135deg, rgba(232,186,250,0.8), rgba(200,150,220,0.9))"
                                    : "linear-gradient(135deg, rgba(0,153,204,0.8), rgba(0,120,180,0.9))",
                                color: darkModeReducer ? "#000" : "#FFF",
                                border: "none",
                                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    transform: "scale(1.02)",
                                    background: darkModeReducer
                                        ? "linear-gradient(135deg, rgba(232,186,250,1), rgba(200,150,220,1))"
                                        : "linear-gradient(135deg, rgba(0,153,204,1), rgba(0,120,180,1))",
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                                }
                            }}
                        >
                            <Typography variant="button" sx={{ whiteSpace: "nowrap", fontWeight: "bold" }}>
                                Publish
                            </Typography>
                        </Button>

                        {!isBShotModeActive && (
                            <>
                                {/* 2. WORLD MODEL BUTTON (New) */}
                                {/* Only show if VideMode is active (based on your layout flow) */}
                                {VideMode && (
                                    <Button
                                        variant="contained"
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
                                        <AssignmentIndIcon sx={{ fontSize: "1.6rem" }} />
                                    </Button>
                                )}

                                {/* 3. PUBLISH BUTTON (Middle) */}
                                <Button
                                    onClick={() => {
                                        if (VideMode) {
                                            setActiveLoaderCallerChecker(true);
                                        } else {
                                            // ... existing upload logic ...
                                            if (type === 0) {
                                                if (generatedImagesFlux.length > 1) {
                                                    if (!activatevoicenarration) {
                                                        uploadAllImagesToS3();
                                                        setHideSave(true);
                                                    } else {
                                                        setGeneratedAudios([]);
                                                        uploadAllImagesToS3();
                                                        setHideSave(true);
                                                    }
                                                } else {
                                                    GenerateSignedUrl(generatedImagesFluxBlob[0], steps[0], loggedUser);
                                                    setVideMode(true);
                                                    setnarrate(2);
                                                }
                                            } else {
                                                setGeneratedAudios([]);
                                                uploadAllImagesToS3();
                                                setHideSave(true);
                                            }
                                        }
                                    }}
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
                                        onClick={() => {
                                            if (!(steps.length === 1 && type === 0 || steps.length === 1 && type === 3)) setShowVoices(true);
                                        }}
                                        variant="contained"
                                        color="inherit"
                                        disableRipple
                                        disableFocusRipple
                                        sx={{
                                            /* Flex Sizing: Small on mobile, larger on PC */
                                            flex: { xs: 0.4, sm: 0.6 },
                                            minWidth: matchMobile ? "auto" : "120px", // Force wider on PC
                                            opacity: steps.length === 1 && type === 0 || steps.length === 1 && type === 3 ? 0.3 : 1,
                                            ...buttonPadding,
                                            px: matchMobile ? 1 : 3, // Tight on mobile
                                            display: Done ? (HideSave ? "none" : type === 3 ? 'none' : "block") : "none",
                                            ...storyActionGlassSx,
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
                                                                    : "Saved"
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
                                                                    : "Saved"
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



                <Modal
                    open={promptPreviewIndex !== null}
                    onClose={() => setPromptPreviewIndex(null)}
                >
                    <Box
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
                                                    background: 'linear-gradient(135deg, #FFB4B4 0%, #E8BAFA 100%)',
                                                    animation: 'pulseBg 2s infinite alternate'
                                                }} />
                                            )}
                                            {previewImg && isExpanded && (
                                                <IconButton
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
                                                        color: darkModeReducer ? "#E8BAFA" : "#0099cc",
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

                        {/* --- SCENE DELETE CONFIRMATION OVERLAY --- */}
                        {pendingSceneDeleteIndex !== null && (() => {
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
                        })()}
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
                    usedanimate={usedanimate}
                    setusedanimate={setusedanimate}
                    setFullscreenCharIndex={setFullscreenCharIndex}
                    Vipcharacters={Vipcharacters}
                    setVipcharacters={setVipcharacters}
                    referenceImages={referenceImages}
                    setReferenceImages={setReferenceImages}
                    detectedCharacters={detectedCharacters}
                    selectedStyle={selectedStyle}
                    Planx={Planx}
                    SelectedModel={SelectedModel}
                    setSelectedModel={setSelectedModel}
                    time={time}
                    setTime={setTime}

                    noImagePrompt={noImagePrompt}
                    setnoImagePrompt={setnoImagePrompt}
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
                    DummyMode={DummyMode}
                    allowgetImage={allowgetImage}
                    GeneratedImages3={GeneratedImage}
                    finishLoader={(idx: number, isFail: boolean = false) => {
                        if (unifiedIndexMap[unifiedActiveEdit]?.type === 'B') {
                            const uniqueIdx = 10000 + activeEdit * 100 + activeBShotEdit;
                            const epoch = (loaderEpoch.current[uniqueIdx] ?? 0) + 1;
                            loaderEpoch.current[uniqueIdx] = epoch;
                            if (loaderTimers.current[uniqueIdx]) {
                                clearInterval(loaderTimers.current[uniqueIdx]!);
                                loaderTimers.current[uniqueIdx] = null;
                            }
                            setBShotLoaders(prev => {
                                const next = [...(prev || [])];
                                while (next.length <= activeEdit) next.push([]);
                                const bArr = [...(next[activeEdit] || [])];
                                bArr[activeBShotEdit] = isFail ? 0 : 100;
                                next[activeEdit] = bArr;
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
                                        while (next.length <= activeEdit) next.push([]);
                                        const bArr = [...(next[activeEdit] || [])];
                                        bArr[activeBShotEdit] = 0;
                                        next[activeEdit] = bArr;
                                        return next;
                                    });
                                }, 600);
                            }
                        } else {
                            finishLoader(activeEdit, isFail);
                        }
                    }}
                    updateLoader={(idx: number, pct: number) => {
                        if (unifiedIndexMap[unifiedActiveEdit]?.type === 'B') {
                            setBShotLoaders(prev => {
                                const next = [...(prev || [])];
                                while (next.length <= activeEdit) next.push([]);
                                const bArr = [...(next[activeEdit] || [])];
                                bArr[activeBShotEdit] = Math.max(pct, bArr[activeBShotEdit] || 0);
                                next[activeEdit] = bArr;
                                return next;
                            });
                        } else {
                            updateLoader(activeEdit, pct);
                        }
                    }}
                    startLoader={(idx: number) => {
                        if (unifiedIndexMap[unifiedActiveEdit]?.type === 'B') {
                            const uniqueIdx = 10000 + activeEdit * 100 + activeBShotEdit;
                            const epoch = (loaderEpoch.current[uniqueIdx] ?? 0) + 1;
                            loaderEpoch.current[uniqueIdx] = epoch;
                            if (loaderTimers.current[uniqueIdx]) clearInterval(loaderTimers.current[uniqueIdx]!);

                            setBShotLoaders(prev => {
                                const next = [...(prev || [])];
                                while (next.length <= activeEdit) next.push([]);
                                const bArr = [...(next[activeEdit] || [])];
                                bArr[activeBShotEdit] = 1;
                                next[activeEdit] = bArr;
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
                                    while (next.length <= activeEdit) next.push([]);
                                    const bArr = [...(next[activeEdit] || [])];
                                    if (pct > (bArr[activeBShotEdit] || 0)) bArr[activeBShotEdit] = pct;
                                    next[activeEdit] = bArr;
                                    return next;
                                });
                            }, 200);
                        } else {
                            startLoader(activeEdit);
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
                    setSteps2={setSteps2} /* NATIVE setter â€” unified mapping corrupted narration in B-shot mode */
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
                    onInstantBShotSave={handleBShotTruthSave}
                    index={unifiedActiveEdit}
                    unifiedIndexMap={unifiedIndexMap}
                    bIndex={activeBShotEdit}
                    startEdit={startEdit}
                    setGeneratedImagesFluxBlobHd={setGeneratedImagesFluxBlobHd}
                    setstartEdit={setstartEdit}
                    fallbackImage={loggedUser
                        ? `${loggedUser.image}` : ''}
                    defaultText=""
                    onUpdateActiveCharacters={(idx, activeChars) => {
                        if (CreationMode === 'Video') {
                            setSceneActiveCharactersVideo(prev => {
                                const next = [...prev];
                                if (JSON.stringify(next[idx]) !== JSON.stringify(activeChars)) {
                                    next[idx] = activeChars;
                                    return next;
                                }
                                return prev;
                            });
                        } else {
                            setSceneActiveCharacters(prev => {
                                const next = [...prev];
                                if (JSON.stringify(next[idx]) !== JSON.stringify(activeChars)) {
                                    next[idx] = activeChars;
                                    return next;
                                }
                                return prev;
                            });
                        }
                    }}
                    activeCharsForScene={(CreationMode === 'Video' ? sceneActiveCharactersVideo : sceneActiveCharacters)[unifiedActiveEdit] || []}
                    musicMode={musicMode}
                    musicModeUrl={musicModeUrl}
                    musicSegments={musicSegments}
                    musicBreakerSec={musicBreakerSec}
                    lipSyncAudioUrls={lipSyncAudioUrls}
                    setLipSyncAudioUrls={setLipSyncAudioUrls}
                    lipSyncProJobs={lipSyncProJobs}
                    setLipSyncProJobs={setLipSyncProJobs}
                    lipSyncActiveList={lipSyncActiveList}
                    setLipSyncActiveList={setLipSyncActiveList}
                    lipSyncPromptBackup={lipSyncPromptBackup}
                    setLipSyncPromptBackup={setLipSyncPromptBackup}
                    referenceVideoUrls={referenceVideoUrls}
                    setReferenceVideoUrls={setReferenceVideoUrls}
                    referenceVideoActiveList={referenceVideoActiveList}
                    setReferenceVideoActiveList={setReferenceVideoActiveList}
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
            />


            {
                ThumbGo ? (
                    <div
                        style={{
                            position: "fixed",
                            top: "0vh",
                            zIndex: 9999,
                            width: matchMobile ? "100%" : "100%",
                            height: "100vh",
                            margin: "auto",
                            //display: 'none'
                            ///  backgroundColor: 'red',
                        }}
                    >
                        <Thumbnail
                            minimizeMode={minimizeMode}
                            DummyMode={DummyMode}
                            steps={steps}
                            setGeneratedImage={setGeneratedImage}
                            prompt={prompt}
                            type={type}
                            closeT={closeT}
                            isMenuOpen={isMenuOpen}
                            image={generatedImagesFluxBlob?.[0]}
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
                                color: previewImage ? "#ffffff" : (darkModeReducer ? "#E8BAFA" : "#0099cc"),
                                fontWeight: 800, mb: previewImage ? 0.5 : 1, fontSize: '1.2rem',
                                textShadow: previewImage ? '0 2px 8px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,1)' : (darkModeReducer ? '0 2px 4px rgba(0,0,0,0.8)' : 'none')
                            }}>
                                Accessing Imagination...
                            </Typography>
                            <Typography sx={{
                                color: previewImage ? "rgba(255,255,255,0.95)" : (darkModeReducer ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)"),
                                fontSize: previewImage ? '0.8rem' : '0.9rem',
                                fontStyle: 'italic', display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: previewImage ? 2 : 4,
                                textShadow: previewImage ? '0 1px 5px rgba(0,0,0,0.9)' : (darkModeReducer ? '0 1px 3px rgba(0,0,0,0.8)' : 'none')
                            }}>
                                {latestFetchedPrompt ? latestFetchedPrompt.text : "Initializing Prompts..."}
                            </Typography>
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
            <Snackbar
                open={audioError.show}
                autoHideDuration={10000}
                onClose={() => setAudioError(prev => ({ ...prev, show: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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

        </Box>
    );
};

export default Storybook;
