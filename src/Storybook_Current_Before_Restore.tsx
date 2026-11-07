import React, {
    useCallback,
    useState,
    useEffect,
    useRef,
    useLayoutEffect,
} from "react";


import axios from "axios";


import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import { Saveprompthelperfordellater, RemoveFromDeleteLater, RemoveVideoFromDeleteLater } from "./SavepromptHelpersLocal";



import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import ErrorPillContainer, { globalErrorEmitter } from "./components/ErrorPillContainer";
import StepsDialog from './StepsDialog';


import { keyframes } from "@emotion/react";

import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { calcModelPixels } from "./ModelPixels";   // adjust path save

import PublishLoader from "./PublishLoader";   // adjust path


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

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useNavigate } from "react-router-dom";

import VoicePicker from "./VoicePicker";

import AudioPicker from "./AudioPicker";

import Thumbnail from "./Thumbnail";

import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";

import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon

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
} from "@mui/material";
import { matchMobile } from "./DetectDevice";

import VolumeUpIcon from "@mui/icons-material/VolumeUp";

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
    onSaveVisibilityChange, Vipcharacters, setVipcharacters
}) => {
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const [masterAspectRatio, setMasterAspectRatio] = useState<any>('9 / 10');
    const [isRatioSet, setIsRatioSet] = useState(false);

    const dispatch = useDispatch();

    const navigate = useNavigate();


    const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);

    const [HaltPublish, setHaltPublish] = useState(false);

    const [musicKling, setmusicKling] = useState(true);

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

    useEffect(() => {
        if (magicMode && Continue) {
            const timer = setTimeout(() => {
                const targetText = (GeneratedText && GeneratedText.length > 1) ? GeneratedText[1] : "";
                handleSubmitFluxImageNew(GeneratedImage, targetText, loggedUser, 1, s3ResultUrl);

                setContinue(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [magicMode, Continue, GeneratedText, GeneratedImage, loggedUser, s3ResultUrl]);


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
    const [MemeMusic, setMemeMusic] = useState(true);


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

    const nanoImagesRef = useRef(nanoImages);
    useEffect(() => {
        nanoImagesRef.current = nanoImages;
    }, [nanoImages]);

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

    const [generatedAudios, setGeneratedAudios] = useState<string[]>([]);
    const [generatedAudiosCloud, setGeneratedAudiosCloud] = useState<string[]>(
        []
    );



    const [isGenerating, setIsGenerating] = useState<boolean[]>([]);



    const [showVoices, setShowVoices] = useState(false);
    const [voice, setVoice] = useState("en-US-Chirp-HD-O");


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
    function updateLoader(idx: number, pct: number) {
        setLoaders((prev) => {
            const next = [...prev];
            while (next.length <= idx) next.push(0);
            if (pct > next[idx]) next[idx] = pct;
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
        stopAll();
        setIsSubmittingKick(false);
        setSteps([]);
        setStepsx([]);
        handleCloseOverlay();
        setGeneratedText([]);
        setGeneratedImagesFlux([]);
        setGeneratedImagesFluxBlob([]);
        setMinimizeMode(1);
    };

    const [isLoading, setisLoading] = useState<boolean>(false);

    const [LoadData, setLoadData] = useState("Processing..");

    const [saveBlob, setsaveBlob] = useState<any>(null);

    const [Done, setDone] = useState<boolean>(false);

    const [Donex, setDonex] = useState<boolean>(true);

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


            const { plan } = response.data                     // <- ✨ here’s your plan
            console.log("Plan Created:", plan)

            // example use:



            var finalPlan = plan;

            /// setPlanInfo(3)

            console.log('PlaaaaaaaaaaNNNNVIDDDDDDDD', finalPlan)


            finalPlan = applyArtStyleToPlan(plan, '');
            // do something with finalPlan…






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

            // 2. reset state for new plan
            StartPlan(Planx, steps2);

            setVideoArray([]);
            setVideoArrayBlob([]);
        })();
    }, [VideMode, Planx, steps, steps2]);



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

            // ✅ ALWAYS drive saving by steps.length (ALL modes)
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
            // We’ll store the final S3 URLs here
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
                // We’ll store the final S3 URLs here
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


    const ContinueGen = useCallback(() => {






        handleSubmitFluxImageNew(GeneratedImage, GeneratedText[1], loggedUser, 1, s3ResultUrl);

        setContinue(false);

    }, [GeneratedImage, GeneratedText, timeoutRefsxp, s3ResultUrl, type])

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

                        // last resort: don’t crash pipeline
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

                        // ✅ stage endpoints
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

                            // cache stage2 so odd index can always “read & clear”
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
                // aborted or no text — fallback to original
                // or return early if you require a result
                return;
            }

            // --- HYBRID MANUAL MODE LOGIC ---
            if (CreationMode === 'Video' && nanoImagesRef.current && nanoImagesRef.current[index]) {
                const nanoUrl = nanoImagesRef.current[index];
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
                    // any extra parameters you need
                    width: 1080,
                    height: 1920,
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
                            fluxImageBlobx,
                            modelz,
                            ratioKey
                        );

                        const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(
                            fluxImageBlobx,
                            modelz,
                            ratioKey
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
     * Converts an input Blob (PNG/JPEG/etc.) into a resized image Blob at 1080×1920.
     * On iPhone, always use JPEG. On other devices, use WebP.
     *
     * @param inputBlob - The original image as a Blob
     * @returns A Promise resolving to the converted image as a Blob
     */
    async function convertToHDWebpOrJpegByDevice(
        inputBlob: Blob,
        modelx: any,
        ratioKeyx: number
    ): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            // Step 1: Read the Blob into a Data URL
            const reader = new FileReader();
            reader.readAsDataURL(inputBlob);

            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();

                // Step 2: When the image loads, draw it onto a 1080×1920 canvas
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let desiredWidth;
                    let desiredHeight;

                    if (modelx === "Gpt Imagejjjjj") {
                        // base size 1024px for GPT Image
                        if (ratioKey === 1) {
                            // 9:16 portrait
                            desiredWidth = 1024;
                            desiredHeight = 1536;
                        } else if (ratioKey === 2) {
                            // 1:1 square
                            desiredWidth = 1024;
                            desiredHeight = 1024;
                        } else if (ratioKey === 3) {
                            // 16:9 landscape
                            desiredWidth = 1536;
                            desiredHeight = 1024;
                        } else {
                            // fallback to 9:16 portrait
                            desiredWidth = 1024;
                            desiredHeight = 1536;
                        }
                    } else if (modelx === "Imagenpppppppppppp") {
                        // Always square for Imagen
                        desiredWidth = 1024;
                        desiredHeight = 1024;
                    } else {
                        // otheM models use 1080px base
                        if (ratioKey === 1) {

                            ///  alert(modelx);
                            // 9:16 portrait
                            desiredWidth = 1080;
                            desiredHeight = 1920;
                        } else if (ratioKey === 2) {
                            // 1:1 square
                            desiredWidth = 1080;
                            desiredHeight = 1080;
                        } else if (ratioKey === 3) {
                            // 16:9 landscape
                            desiredWidth = 1920;
                            desiredHeight = 1080;
                        } else {
                            // fallback to 9:16 portrait
                            desiredWidth = 1080;
                            desiredHeight = 1920;
                        }
                    }


                    canvas.width = desiredWidth;
                    canvas.height = desiredHeight;


                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Unable to get 2D context from canvas."));
                    }

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
        inputBlob: Blob,
        modelx: any,
        ratioKeyx: number
    ): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            // Step 1: Read the Blob into a Data URL
            const reader = new FileReader();
            reader.readAsDataURL(inputBlob);

            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();

                // Step 2: When the image loads, draw it onto a 1080×1920 canvas
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let desiredWidth;
                    let desiredHeight;



                    if (modelx === "Gpt Imagejjjjjj") {
                        // base size 1024px for GPT Image
                        if (ratioKeyx === 1) {
                            // 9:16 portrait
                            desiredWidth = 1024;
                            desiredHeight = 1536;
                        } else if (ratioKeyx === 2) {
                            // 1:1 square
                            desiredWidth = 1024;
                            desiredHeight = 1024;
                        } else if (ratioKeyx === 3) {
                            // 16:9 landscape
                            desiredWidth = 1536;
                            desiredHeight = 1024;
                        } else {
                            // fallback to 9:16 portrait
                            desiredWidth = 1024;
                            desiredHeight = 1536;
                        }
                    } else if (modelx === "Imagenpppppppp") {
                        // Always square for Imagen
                        desiredWidth = 1024;
                        desiredHeight = 1024;
                    } else {
                        // otheM models use 1080px base
                        if (ratioKeyx === 1) {

                            // 9:16 portrait
                            desiredWidth = 1080;
                            desiredHeight = 1920;
                        } else if (ratioKeyx === 2) {
                            // 1:1 square
                            desiredWidth = 1080;
                            desiredHeight = 1080;
                        } else if (ratioKeyx === 3) {
                            // 16:9 landscape
                            desiredWidth = 1920;
                            desiredHeight = 1080;
                        } else {
                            // fallback to 9:16 portrait
                            desiredWidth = 1080;
                            desiredHeight = 1920;
                        }
                    }


                    canvas.width = desiredWidth;
                    canvas.height = desiredHeight;


                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Unable to get 2D context from canvas."));
                    }

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
        background: "rgba(10, 10, 10, 0.45)",
        backdropFilter: "blur(24px) saturate(120%)",
        color: "#ffffff",
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
            background: "rgba(15, 15, 15, 0.65)",
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
        background: "rgba(10, 10, 10, 0.45)",
        backdropFilter: "blur(24px) saturate(120%)",
        color: "#ffffff",
        border: darkModeReducer
            ? "1px solid rgba(0, 0, 0, 0.42)"
            : "1px solid rgba(255, 255, 255, 0.4)",
        boxShadow: darkModeReducer
            ? "0 8px 24px rgba(0,0,0,0.55)"
            : "0 8px 24px rgba(0,0,0,0.12)",
        "&:hover": {
            background: "rgba(15, 15, 15, 0.65)",
        },
    };
    const getSceneDisplayText = (sceneIndex: number) => {
        if (type === 1) {
            return sceneIndex % 2 === 0 ? steps2[Math.floor(sceneIndex / 2)] ?? "" : "";
        }
        return steps[sceneIndex] ?? "";
    };
    const getOriginalScenePrompt = () => {
        return (prompt || "").trim();
    };
    const getScenePopupText = (sceneIndex: number) => {
        return getSceneDisplayText(sceneIndex).trim();
    };
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
        // Fire and forget — runs in background, never aborted
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
                            // FIRE NANO DIRECTLY — no React state, no batching issues
                            // Each scene's nano image runs in parallel, all complete independently
                            fireNanoForScene(generatedPrompt, index);
                        }
                    } catch (e) {
                        console.error(`Prefetch failed for index ${index}`, e);
                    }
                }

                setFetchingPrompts(false);
                // DO NOT abort nano requests here — they are fire-and-forget
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

    const handleGenerateAudio = useCallback(
        (captionx: any, voice: any) => {


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

            callvoice(captionx, storyT, voice);
        },
        [steps2, music, VideoArrayCloud, activatevoicenarration, ratioKey]
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
        async (
            stepText: string,
            stepIndex: number,
            voiceName: string,
            voiceId: any
        ) => {
            setisLoading(true);
            setLoadData("Generating Audio..");

            try {
                // (Optional) delay between requests
                await sleepx(100);

                // Build the request payload for Gemini TTS
                const requestData = {
                    text: stepText,
                    voice: voiceName, // voiceName holds the Gemini voice ID here
                    prompt: "DIRECTOR'S NOTES: Clear and expressive delivery.",
                    language_code: "en-US"
                };

                // Make the call to the local Gemini TTS endpoint
                const response: any = await axios.post(
                    `${CLIK_URL}/generateReplicateAudio`,
                    requestData,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        withCredentials: true,
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
                //    For LINEAR16, "audio/wav" is a common container.
                //    If you used "MP3" in audioConfig, set type to "audio/mpeg".
                const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

                // 4) Convert the Blob into an object URL so we can play it in the browser
                const audioUrl = URL.createObjectURL(audioBlob);

                /// setisLoading(false);

                // 5) Update your 'generatedAudios' array in state
                setGeneratedAudios((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = audioUrl;
                    return next;
                });

                console.log("done with audio");
            } catch (error: any) {
                setisLoading(false);
                ///setLoadingAudio(false);
                console.error("TTS Error:", error.message || error);
            }
        },
        [activatevoicenarration, ratioKey]
    );

    // 4) The function that generates audio first for the caption, then for each plot
    const callvoice = useCallback(
        async (caption: string, plots: string[], voiceId: string) => {
            // Optional: initialize state array to correct length
            // Index 0 for the caption, plus one for each plot
            setGeneratedAudios(Array(1 + plots.length).fill(""));

            // Generate audio for the caption (index = 0)
            await fetchAndGenerateSpeech(caption, 0, voiceId, "");

            // Generate audio for each plot (indices = 1..plots.length)
            for (let i = 0; i < plots.length; i++) {
                await fetchAndGenerateSpeech(plots[i], i + 1, voiceId, "");
            }
        },
        [fetchAndGenerateSpeech, music, activatevoicenarration, ratioKey]
    );

    useEffect(() => {
        if (steps2.length === 0) return;

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

        // limit = number of valid text entries + 1
        const limit = storyT.length + 1;

        // Make sure we have exactly `limit` audios
        // AND every audio element is non-empty (truthy)
        if (
            generatedAudios.length === limit &&
            generatedAudios.every((audioUrl: any) => Boolean(audioUrl))
        ) {
            // Fire off the upload
            uploadAllAudiosToS3(postId, EnhanceCaption);
        }
    }, [steps, steps2, PostId, generatedAudios, EnhanceCaption, ImagesHdCloud, type, VideoArrayCloud,]);

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
                    captionAudio: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                    x1: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                    x2: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                    x3: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                    x4: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                    x5: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                    x6: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                    x7: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                    x8: s3AudioUrls[8] ? s3AudioUrls[8] : null,
                    x9: s3AudioUrls[9] ? s3AudioUrls[9] : null,
                    typex: 1,
                };

                var Datax = {
                    captionSummary: EnhanceCaption,
                    captionAudio: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                    xa1: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                    xa2: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                    xa3: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                    xa4: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                    xa5: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                    xa6: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                    xa7: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                    xa8: s3AudioUrls[8] ? s3AudioUrls[8] : null,

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





    const ContinueUpload = useCallback(() => {

        if (!activatevoicenarration || type === 0 || type === 3) {
            ///////THIS CODE TYPE 1000000000 REDUNDANT LEFT IT HERE SO YOU UNDERSTAND DATA STRUCTURE
            var Data = {
                postId: PostId,
                captionSummary: "cool",
                captionAudio: "",
                x1: "",
                x2: "",
                x3: "",
                x4: "",
                x5: "",
                x6: "",
                x7: "",
                x8: "",
                typex: 0,
            };







            callCreateMp4(ImagesHdCloud, Data, null);
        } else {
            EnhanceCaptionx(voice);
        }

    }, [PostId, MemeMusic, EnhanceCaptionx, callCreateMp4, voice, ImagesHdCloud, VideoArrayCloud, steps, clipDurations, steps2, activatevoicenarration, GeneratedImage,
        ratioKey
    ])


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
    const saveToDatabase = useCallback((Data: any, urlvid: any) => {
        setisLoading(true);
        setLoadData("Saving..");

        Data.vidoriginal = urlvid;

        console.log('data sent after music bg added to mp4', Data);
        axios
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
                setactivatevoicenarration={setactivatevoicenarration}
            />



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


                    const fallbackImage = loggedUser
                        ? `${loggedUser.image}`
                        : "https://via.placeholder.com/400x250.png?text=No+User+Image";

                    return (


                        <div
                            key={index}
                            style={{
                                flex: "0 0 auto", // ensure each item doesn’t shrink

                                // Grid Mapping
                                // Desktop PC: 16:9 = 3 grid, 1:1 = 4 grid, 9:16 = 5 grid
                                // Mobile:     16:9 = 1 grid, 1:1 = 1 grid, 9:16 = 2 grid
                                width: (ratioKey === 3)
                                    ? (matchMobile ? "100%" : "calc(33.333% - 0.666rem)")
                                    : (ratioKey === 2)
                                        ? (matchMobile ? "100%" : "calc(25% - 0.75rem)")
                                        : (matchMobile ? "calc(50% - 0.5rem)" : "calc(20% - 0.8rem)"),
                                height: "auto",
                                position: "relative",
                                borderRadius: "4px",
                                overflow: "hidden",
                                padding: '0px',
                                marginBottom: "1.5rem",

                            }}
                        >
                            {generatedImagesFlux[index] && (
                                <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                    {VideMode && VideoArrayCloud?.[index] ? (
                                        <video
                                            ref={index === 0 ? (firstImageRef as any) : null}
                                            src={VideoArrayCloud[index]}
                                            onClick={() => {
                                                if (isLocked) return;
                                                if (Donex) {
                                                    setstartEdit(true);
                                                    setactiveEdit(index);
                                                }
                                            }}
                                            onLoadedMetadata={(e) => {
                                                if (!isRatioSet) {
                                                    const vid = e.currentTarget;
                                                    const naturalRatio = vid.videoWidth / vid.videoHeight;
                                                    if (naturalRatio) {
                                                        setMasterAspectRatio(naturalRatio);
                                                        setIsRatioSet(true);
                                                    }
                                                }
                                            }}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "block",
                                                objectFit: "cover",
                                                cursor: isLocked ? "not-allowed" : "pointer",
                                                opacity: isLocked ? 0.4 : 1,
                                                pointerEvents: isLocked ? "none" : "auto",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                                            }}
                                        />
                                    ) : (
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
                                                if (isLocked) return;
                                                if (Donex) {
                                                    setstartEdit(true);
                                                    setactiveEdit(index);
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
                                    )}

                                    {/* VIDEO PLAY OVERLAY */}
                                    {VideMode && !isGenerating?.[index] && (
                                        <Box
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isLocked) return;
                                                if (Donex) {
                                                    setstartEdit(true);
                                                    setactiveEdit(index);
                                                }
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: !!VideoArray[index] ? '50px' : 'auto',
                                                height: !!VideoArray[index] ? '50px' : 'auto',
                                                padding: !!VideoArray[index] ? 0 : '6px 16px',
                                                borderRadius: !!VideoArray[index] ? '50%' : '25px',
                                                background: !!VideoArray[index] ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: isLocked ? "not-allowed" : "pointer",
                                                zIndex: 2,
                                                backdropFilter: 'blur(4px)',
                                                transition: 'all 0.2s',
                                                border: !!VideoArray[index] ? 'none' : '1px dashed rgba(255,255,255,0.3)',
                                                '&:hover': {
                                                    transform: 'translate(-50%, -50%) scale(1.1)',
                                                    background: !!VideoArray[index] ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
                                                }
                                            }}
                                        >
                                            {!!VideoArray[index] ? (
                                                <PlayArrowIcon sx={{ color: 'white', fontSize: 32 }} />
                                            ) : (
                                                <>
                                                    <VideocamIcon sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, mr: 0.5 }} />
                                                    <Typography variant="button" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        Animate
                                                    </Typography>
                                                </>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            )}
                            {!(generatedImagesFlux[index]) && (
                                generatedImages?.[index] ? (
                                    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
                                        {VideMode && VideoArrayCloud?.[index] ? (
                                            <video
                                                src={VideoArrayCloud[index]}
                                                onClick={() => {
                                                    if (Continue) {
                                                        ContinueGen();
                                                    } else if (Donex) {
                                                        if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                        }
                                                    }
                                                }}
                                                onLoadedMetadata={(e) => {
                                                    if (!isRatioSet) {
                                                        const vid = e.currentTarget;
                                                        const naturalRatio = vid.videoWidth / vid.videoHeight;
                                                        if (naturalRatio) {
                                                            setMasterAspectRatio(naturalRatio);
                                                            setIsRatioSet(true);
                                                        }
                                                    }
                                                }}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                style={{
                                                    width: "100%", height: "100%", display: "block", objectFit: "cover",
                                                    cursor: "pointer",
                                                    borderRadius: "12px",
                                                }}
                                            />
                                        ) : (
                                            <img
                                                onClick={() => {
                                                    if (Continue) {
                                                        ContinueGen();
                                                    } else if (Donex) {
                                                        if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                            setstartEdit(true);
                                                            setactiveEdit(index);
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
                                        )}

                                        {/* VIDEO PLAY OVERLAY fallback */}
                                        {VideMode && !isGenerating?.[index] && (
                                            <Box
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (Continue) {
                                                        ContinueGen();
                                                    } else if (Donex) {
                                                        if (!(type === 0 && steps.length === 1 || type === 3 && steps.length === 1)) {
                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                        }
                                                    }
                                                }}
                                                sx={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    width: !!VideoArray[index] ? '50px' : 'auto',
                                                    height: !!VideoArray[index] ? '50px' : 'auto',
                                                    padding: !!VideoArray[index] ? 0 : '6px 16px',
                                                    borderRadius: !!VideoArray[index] ? '50%' : '25px',
                                                    background: !!VideoArray[index] ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: "pointer",
                                                    zIndex: 2,
                                                    backdropFilter: 'blur(4px)',
                                                    transition: 'all 0.2s',
                                                    border: !!VideoArray[index] ? 'none' : '1px dashed rgba(255,255,255,0.3)',
                                                    '&:hover': {
                                                        transform: 'translate(-50%, -50%) scale(1.1)',
                                                        background: !!VideoArray[index] ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
                                                    }
                                                }}
                                            >
                                                {!!VideoArray[index] ? (
                                                    <PlayArrowIcon sx={{ color: 'white', fontSize: 32 }} />
                                                ) : (
                                                    <>
                                                        <VideocamIcon sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, mr: 0.5 }} />
                                                        <Typography variant="button" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                            Animate
                                                        </Typography>
                                                    </>
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
                                        onClick={() => {
                                            if (Continue) ContinueGen();
                                            else if (Donex) {
                                                setstartEdit(true);
                                                setactiveEdit(index);
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
                                                flexDirection: "column", // spinner ⬆ text ⬇
                                                alignItems: "center",
                                                justifyContent: "center",
                                                zIndex: 300,
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


                                                if (allowgetImage) {


                                                    if (open2 && !VideMode) {

                                                        setstartEdit(true);
                                                        setactiveEdit(index);
                                                        setnarrate(1);

                                                    } else {

                                                        setstartEdit(true);
                                                        setactiveEdit(index);
                                                        if (VideMode) {
                                                            setnarrate(2);
                                                        } else { setnarrate(0); }
                                                    }




                                                } else {

                                                    if (!generatedImagesFlux[0] && !DummyMode) {
                                                        ///  setallowgetImage(true);
                                                    } else {

                                                        if (open2 && !VideMode) {

                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                            setnarrate(1);

                                                        } else {

                                                            setstartEdit(true);
                                                            setactiveEdit(index);
                                                            if (VideMode) {
                                                                setnarrate(2);
                                                            } else { setnarrate(0); }
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
                                    {type === 1 ? (index % 2 === 0 ? steps2[Math.floor(index / 2)] : '') : steps[index]}
                                </Typography>
                            </Box>
                        </div>);
                })}
            </Box >

            <Box
                sx={{
                    // display: showButton && !minimisePrompt ? 'flex' : 'none', allowgetImage
                    display: minimizeMode === 2 ? "none" : "flex",
                    visibility: minimizeMode === 1 ? "hidden" : "visible",
                    width: "100%",
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
                            marginTop: "3px",
                            gap: "8px", // Consistent gap
                            alignItems: "center", // Center vertically
                        }}
                    >
                        {/* 1. BACK BUTTON */}
                        <Button
                            onClick={() => {
                                setVideMode(false);
                            }}
                            variant="contained"
                            color="inherit"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* Flex Sizing: Small on mobile, slightly larger on PC */
                                flex: matchMobile ? 0.5 : 0.6,
                                minWidth: "auto", // Allow shrinking P

                                display: VideMode ? 'flex' : 'none',
                                ...buttonPadding,
                                px: matchMobile ? 1 : 3, // Tighter padding on mobile
                                ...storyActionGlassSx,
                            }}
                        >
                            <ArrowBackIosIcon sx={{ fontSize: "1.3em", mr: matchMobile ? 0 : 0.5 }} />
                            {/* Hide text on mobile */}
                            {!matchMobile && "Back"}
                        </Button>

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
                            {HaltPublish ? "Use Images" : VideMode ? "Publish" : "Continue"}
                        </Button>

                        {/* 4. SAVE / MUSIC BUTTON (Right) */}
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
                                flex: matchMobile ? 0.4 : 0.6,
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
                                                position: 'relative',
                                                overflow: 'hidden',
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
                                                    <Typography sx={{
                                                        color: "#ffffff",
                                                        fontWeight: 900, mb: 1.5, fontSize: '1.2rem',
                                                        textTransform: 'uppercase', letterSpacing: 2,
                                                        textShadow: '0 2px 10px rgba(0,0,0,1)'
                                                    }}>
                                                        Scene {idx + 1}
                                                    </Typography>
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
                    VideoArrayCloud={VideoArrayCloud}
                    loadersPrompt={loadersPrompt}
                    setloadersPrompt={setLoadersPrompt}

                    setImagesHdCloud={setImagesHdCloud}
                    setPLoader={setPLoader}
                    PLoader={PLoader}
                    loader={loaders[activeEdit]}

                    steps2={steps2}
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
                    finishLoader={finishLoader}
                    updateLoader={updateLoader}
                    startLoader={startLoader}

                    setIsGenerating={setIsGenerating}
                    isGenerating={isGenerating}
                    setVideoArrayCloud={setVideoArrayCloud}
                    PostId={PostId}
                    ImagesHdCloud={ImagesHdCloud}
                    VideMode={VideMode}
                    setVideoArray={setVideoArray}
                    setVideoArrayBlob={setVideoArrayBlob}
                    VideoArrayBlob={VideoArrayBlob}
                    VideoArray={VideoArray}
                    TextVideo={TextVideo}
                    setTextVideo={setTextVideo}
                    setmusic={() => { }}
                    Seed={Seed}
                    setMemeMusic={setMemeMusic}
                    setIndex={setactiveEdit}
                    modelz={modelz}
                    convertToHDWebpOrJpegByDeviceHd={convertToHDWebpOrJpegByDeviceHd}
                    steps={steps}
                    setSteps={setSteps}
                    setSteps2={setSteps2}
                    narrate={narrate}
                    setnarrate={setnarrate}
                    setGeneratedText={setGeneratedText}
                    setGeneratedTextx={setGeneratedTextx}
                    GeneratedTextx={GeneratedTextx}
                    type={0}
                    GotIm={GotIm}
                    nanoImages={nanoImages}
                    /* Array-based props */
                    setGeneratedImagesFlux={setGeneratedImagesFlux}
                    setGeneratedImagesFluxBlob={setGeneratedImagesFluxBlob}
                    setGeneratedImage={setGeneratedImage}
                    generatedImagesFlux={generatedImagesFlux}
                    GeneratedImage={generatedImagesFlux?.[activeEdit]}
                    GeneratedText={GeneratedText}
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
                    index={activeEdit}
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
                    activeCharsForScene={(CreationMode === 'Video' ? sceneActiveCharactersVideo : sceneActiveCharacters)[activeEdit] || []}
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
                        zIndex: 999999,
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
            )}
        </Box>
    );
};

export default Storybook;
