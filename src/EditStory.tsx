import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Box, IconButton, TextField, Typography, Avatar, Button, CircularProgress, Select, MenuItem, SelectChangeEvent, Modal } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import VideocamIcon from "@mui/icons-material/Videocam";
import ImageIcon from "@mui/icons-material/Image";
import AnimationIcon from '@mui/icons-material/Animation';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import UploadIcon from '@mui/icons-material/Upload';
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { SaveAudioHelperForDelLater, Saveprompthelperfordellater, SaveVideoHelperForDelLater } from "./SavepromptHelpersLocal";
////helperimagesprompt axios //Upscale/

///...imports
import MediaPrompt from "./MediaPrompt";
import { globalErrorEmitter } from "./components/ErrorPillContainer";

// ... inside EditStory return statement ...


import { RootState } from "./store";

import { useSelector, useDispatch } from "react-redux";

import Notepad from "./Notepad";

import { calcModelPixels } from "./ModelPixels";   // adjust path

import { Gradient, RecordVoiceOver } from '@mui/icons-material';

import CampaignIcon from '@mui/icons-material/Campaign';

import MusicOffIcon from "@mui/icons-material/MusicOff";
import LockIcon from "@mui/icons-material/Lock";

import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

type CustomVideoPlayerHandle = {
    startSnippetPlayback: () => void;
    stopSnippetPlayback: () => void;
};

const CustomVideoPlayer = React.forwardRef<CustomVideoPlayerHandle, any>(({
    src,
    isZoomPreview,
    matchMobile,
    togglePreviewMode,
    style,
    isActive,
    showDirectLipSync = false,
    isDirectLipSyncGenerating = false,
    onDirectLipSync
}: any, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const mutedBeforeSnippetRef = React.useRef<boolean | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(true);
    const [progress, setProgress] = React.useState(0);
    const [isMuted, setIsMuted] = React.useState(true);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isManualPlay, setIsManualPlay] = React.useState(false);
    const [showHint, setShowHint] = React.useState(false);
    const hintTimeoutRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (videoRef.current) {
            if (isActive) {
                setIsManualPlay(false);
                setShowHint(false);
                if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    }, [src, isActive]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = videoRef.current.currentTime;
            const duration = videoRef.current.duration;
            if (duration > 0) {
                setProgress((current / duration) * 100);
            }
        }
    };

    const handleSeek = (e: any) => {
        const newValue = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = (newValue / 100) * videoRef.current.duration;
            setProgress(newValue);
        }
    };

    const togglePlay = (e: any) => {
        e.stopPropagation();
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        setShowHint(false);
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                setIsManualPlay(true);
                if (videoRef.current.currentTime >= videoRef.current.duration) {
                    videoRef.current.currentTime = 0;
                }
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const toggleMute = (e: any) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

    const handleEnded = () => {
        if (isManualPlay && videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        } else {
            setIsPlaying(false);
            setShowHint(true);
            if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
            hintTimeoutRef.current = setTimeout(() => setShowHint(false), 3000);
        }
    };

    const startSnippetPlayback = React.useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (mutedBeforeSnippetRef.current === null) {
            mutedBeforeSnippetRef.current = video.muted;
        }

        video.pause();
        video.muted = true;
        setIsMuted(true);
        setIsManualPlay(false);
        setShowHint(false);

        const restart = () => {
            video.currentTime = 0;
            video.play()
                .then(() => setIsPlaying(true))
                .catch((error) => {
                    console.warn("Could not play the synced video preview:", error?.message || error);
                    setIsPlaying(false);
                });
        };

        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            restart();
        } else {
            video.addEventListener("loadedmetadata", restart, { once: true });
        }
    }, []);

    const stopSnippetPlayback = React.useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        video.pause();
        setIsPlaying(false);

        if (mutedBeforeSnippetRef.current !== null) {
            video.muted = mutedBeforeSnippetRef.current;
            setIsMuted(mutedBeforeSnippetRef.current);
            mutedBeforeSnippetRef.current = null;
        }
    }, []);

    React.useImperativeHandle(ref, () => ({ startSnippetPlayback, stopSnippetPlayback }), [startSnippetPlayback, stopSnippetPlayback]);

    // Calculate visibility
    const isVisible = showHint || (isHovered && !matchMobile) || (!isPlaying && matchMobile);

    return (
        <Box
            sx={{ position: 'relative', width: '100%', height: isZoomPreview ? (matchMobile ? "100dvh" : "100vh") : "100%" }}
            onClick={togglePreviewMode}
            onDoubleClick={togglePreviewMode}
        >
            <video
                ref={videoRef}
                src={src}
                style={style}
                playsInline
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
            />
            {showDirectLipSync && (
                <IconButton
                    aria-label="Generate direct lip-sync video"
                    title="Lip Sync Pro"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDirectLipSync?.();
                    }}
                    sx={{
                        position: "absolute",
                        top: matchMobile ? 10 : 14,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 14,
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.34)",
                        backdropFilter: "blur(10px)",
                        background: isDirectLipSyncGenerating ? "#E8BAFA" : "rgba(0,0,0,0.58)",
                        boxShadow: isDirectLipSyncGenerating ? "0 0 0 3px rgba(232,186,250,0.35), 0 0 24px rgba(232,186,250,0.9)" : "none",
                        animation: isDirectLipSyncGenerating ? "lipSyncPulse 1s ease-in-out infinite" : "none",
                        "@keyframes lipSyncPulse": {
                            "0%, 100%": { transform: "translateX(-50%) scale(1)", opacity: 1 },
                            "50%": { transform: "translateX(-50%) scale(1.14)", opacity: 0.58 },
                        },
                        "&:hover": { background: "rgba(0,0,0,0.8)" },
                    }}
                >
                    <RecordVoiceOver />
                </IconButton>
            )}

            {/* Play/Pause Button Area - Top 30% */}
            <Box
                onClick={togglePlay}
                onMouseEnter={() => !matchMobile && setIsHovered(true)}
                onMouseLeave={() => !matchMobile && setIsHovered(false)}
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '30%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isVisible ? 'rgba(0,0,0,0.3)' : 'transparent',
                    backdropFilter: isVisible ? 'blur(4px)' : 'none',
                    opacity: isVisible ? 1 : 0,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    zIndex: 10,
                }}
            >
                <IconButton sx={{ color: 'white' }}>
                    {isPlaying ? <PauseIcon sx={{ fontSize: 60 }} /> : <PlayArrowIcon sx={{ fontSize: 60 }} />}
                </IconButton>
            </Box>

            {/* Glass Seeker Area - Bottom middle */}
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: matchMobile ? '50%' : '40%',
                    height: 40,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    zIndex: 10,
                    border: '1px solid rgba(255,255,255,0.2)',
                }}
            >
                <Box sx={{ width: matchMobile ? '80%' : '90%', pr: 1, display: 'flex', alignItems: 'center' }}>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={progress}
                        onChange={handleSeek}
                        style={{
                            width: '100%',
                            cursor: 'pointer',
                            accentColor: 'white'
                        }}
                    />
                </Box>
                <Box sx={{ width: matchMobile ? '20%' : '10%', display: 'flex', justifyContent: 'center' }}>
                    <IconButton onClick={toggleMute} sx={{ color: 'white', p: 0 }}>
                        {isMuted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
});

CustomVideoPlayer.displayName = "CustomVideoPlayer";

import GlowWidthBar from "./GlowWidthBar";



import PixelUpdater, { type PlanName } from "./PixelUpdater";

import { Stack } from "@mui/material";



import { setPixels, incrementPixels } from "./settingsSlice";

import { matchMobile } from "./DetectDevice";
import axios from "axios";
import FilePicker from './FilePicker';
import { setShowmenuToggle } from "./settingsSlice";
import { video } from "framer-motion/client";
///import { setTimeout } from "timers/promises"; window

// ... existing imports
import MediaPromptVideo from "./MediaPromptVideo"; // <--- Add this
import type { ImageGenCache } from "./components/PromptConstructor";

interface EditStoryProps {
    isBShotGridContext?: boolean;
    isBShotMedia?: boolean;
    isBShotModeActive?: boolean;
    parentSceneIndex?: number;
    /**
     * Maps a flattened (unified A/B grid) display index back to its native identity:
     * { type: 'A' | 'B', index: nativeAShotSourceIndex, bIndex?: number, originalIndex: number }.
     * Provided by Storybook whenever it passes unified arrays. When absent, indices are native.
     */
    unifiedIndexMap?: { type: 'A' | 'B', index: number, bIndex?: number, originalIndex: number }[];
    onInstantBShotSave?: (mediaUrl: string, promptText: string, isVideo: boolean, parentSceneIndex?: number, bIndex?: number | null) => void | Promise<void>;
    referenceImages?: any[];
    detectedCharacters?: any[];
    /** 0 = array mode, 1 = single mode */
    type?: number;
    setFullscreenCharIndex?: any;

    // ----------- For type=0 (Arrays) -----------
    generatedImagesFlux?: string[] | any;
    setGeneratedImagesFlux?: React.Dispatch<React.SetStateAction<string[]>> | any;
    setGeneratedImagesFluxBlob?: React.Dispatch<React.SetStateAction<Blob[]>> | any;
    GeneratedImage?: string | any;
    GeneratedText?: string[] | any;

    // ----------- For type=1 (Single) -----------
    FluxIm?: string | any;
    setFluxIm?: React.Dispatch<React.SetStateAction<string>> | any;
    setFluxImBlob?: React.Dispatch<React.SetStateAction<Blob>> | any;
    Im?: string | any;              // Usually the "GeneratedImage" for single mode
    prompt?: string | any;          // Usually the "GeneratedText" for single mode Remix

    usedanimate?: boolean;
    setusedanimate?: any;

    // ----------- Common Props -----------
    base: string[]; // can still be used for both, just treat index=0 in single mode
    setbase: React.Dispatch<React.SetStateAction<string[]>> | any;
    convertToHDWebpOrJpegByDevice: (blob: Blob, modelz: any, ratioKeyx: number) => Promise<Blob> | any;

    convertToHDWebpOrJpegByDeviceHd: (blob: Blob, modelz: any, ratioKeyx: number) => Promise<Blob> | any;

    index: number;
    startEdit?: boolean;
    setstartEdit?: any;
    fallbackImage?: string;
    defaultText?: string;
    GotIm: boolean;


    narrate: number;
    setnarrate: any;

    setGeneratedText: any;

    setGeneratedTextx: any;
    GeneratedTextx: any;
    steps: any;
    setSteps: any;
    setGeneratedImagesFluxBlobHd: any;
    modelz: any;
    setIndex: any;
    setMemeMusic: any;
    Seed: any;
    setmusic: any;
    TextVideo: any
    setTextVideo: any;
    bShotTextVideo?: any;
    setBShotTextVideo?: any;
    setVideoArray: any;
    VideoArray: any;
    VideMode: any;
    ImagesHdCloud: any;
    setVideoArrayBlob: any;
    VideoArrayBlob: any;
    PostId: any;
    setVideoArrayCloud: any;
    setIsGenerating: any;
    isGenerating: any;
    isBShotGenerating?: any;
    setIsBShotGenerating?: any;
    finishLoader: any;
    startLoader: any;
    updateLoader?: any;
    GeneratedImages3: String;
    DummyMode: any;
    pageType: any;
    allowgetImage: any;
    stepsx: any; setStepsx: any;
    s3ResultUrl: any;
    PlanVid: any;
    setClipDurations: any;
    clipDurations: any;
    setSteps2: any;
    steps2: any;
    setIsAudioDirty?: (val: boolean) => void;
    loader: any;
    setPLoader?: any;
    PLoader: any;
    setImagesHdCloud: any;
    loadersPrompt: any;
    setloadersPrompt: any;
    VideoArrayCloud: any;
    setVideoArrayLastFrame: any;
    videoArrayLastFrame: any;
    defaultVideoStartFrames?: any[];

    setloadPrompt: any;
    loadPrompt: any;
    musicKling: any;
    music?: any;
    setmusicKling: any;
    CreationMode: any;
    setGeneratedImagePrompt: any;
    generatedImagePrompt: any;

    noImagePrompt: any;
    setnoImagePrompt: any;
    SelectedModel: any
    setSelectedModel: any;
    time: any;
    setTime: any;
    selectedStyle: any;
    Planx: any;
    setGeneratedImage?: any;
    onUpdateActiveCharacters?: (index: number, activeChars: any[]) => void;
    activeCharsForScene?: any[];
    nanoImages?: string[];
    Vipcharacters?: any[];
    setVipcharacters?: any;
    setReferenceImages?: any;
    musicMode?: boolean;
    musicModeUrl?: string;
    musicSegments?: { index: number; start: number; end: number }[];
    musicBreakerSec?: 5 | 10;
    lipSyncAudioUrls?: string[];
    setLipSyncAudioUrls?: any;
    lipSyncProJobs?: Record<number, { state: "generating" | "succeeded" | "failed"; message: string }>;
    setLipSyncProJobs?: any;
    lipSyncActiveList?: boolean[];
    setLipSyncActiveList?: any;
    lipSyncPromptBackup?: string[];
    setLipSyncPromptBackup?: any;
    referenceVideoUrls?: string[];
    setReferenceVideoUrls?: any;
    referenceVideoActiveList?: boolean[];
    setReferenceVideoActiveList?: any;
}

const EditStory: React.FC<EditStoryProps> = ({
    isBShotGridContext = false,
    isBShotMedia = false,
    isBShotModeActive = false,
    parentSceneIndex = 0,
    unifiedIndexMap,
    onInstantBShotSave,
    Vipcharacters,
    setVipcharacters,
    referenceImages = [],
    setReferenceImages,
    detectedCharacters = [],
    // Which mode we are in: 0 = arrays, 1 = single minimax
    type = 0,
    setFullscreenCharIndex,

    // ----------- Arrays -----------
    generatedImagesFlux = [],
    setGeneratedImagesFlux,
    setGeneratedImagesFluxBlob,
    GeneratedImage = "",
    GeneratedText = [],

    // ----------- Single -----------
    FluxIm = "",
    setFluxIm,
    setFluxImBlob,
    Im = "",
    prompt = "",

    // ----------- Common -----------
    base,
    setbase,
    convertToHDWebpOrJpegByDevice,
    index,
    bIndex,
    startEdit,
    setstartEdit,
    fallbackImage = "",
    defaultText = "",
    GotIm,
    setGeneratedText,
    narrate,
    setnarrate,
    steps,
    setSteps,
    setGeneratedImagesFluxBlobHd,
    convertToHDWebpOrJpegByDeviceHd,
    modelz,
    setIndex,
    setMemeMusic,
    Seed,
    setmusic,
    TextVideo,
    setTextVideo,
    bShotTextVideo,
    setBShotTextVideo,
    setVideoArray,
    VideoArray,
    VideMode,
    ImagesHdCloud,
    setVideoArrayBlob,
    VideoArrayBlob,
    PostId,
    setVideoArrayCloud,
    setIsGenerating,
    isGenerating,
    isBShotGenerating,
    setIsBShotGenerating,
    finishLoader,
    startLoader,
    updateLoader,
    GeneratedImages3,
    setGeneratedImage,
    DummyMode,
    pageType,
    setGeneratedTextx,
    GeneratedTextx,
    allowgetImage,
    stepsx, setStepsx,
    s3ResultUrl,
    PlanVid,
    setClipDurations,
    clipDurations,
    setSteps2,
    steps2,
    setIsAudioDirty,
    loader,
    usedanimate,
    setusedanimate,
    setPLoader,
    PLoader,
    setImagesHdCloud,
    loadersPrompt,
    setloadersPrompt,
    VideoArrayCloud,
    setVideoArrayLastFrame,
    videoArrayLastFrame,
    defaultVideoStartFrames = [],
    setloadPrompt,
    loadPrompt,
    musicKling,
    music,
    setmusicKling,
    CreationMode,
    setGeneratedImagePrompt,
    generatedImagePrompt,
    noImagePrompt,
    setnoImagePrompt,
    SelectedModel,
    setSelectedModel,
    time,
    setTime,
    selectedStyle,
    Planx,
    onUpdateActiveCharacters,
    activeCharsForScene,
    nanoImages,
    musicMode = false,
    musicModeUrl = "",
    musicSegments = [],
    musicBreakerSec = 10,
    lipSyncAudioUrls = [],
    setLipSyncAudioUrls,
    lipSyncProJobs = {},
    setLipSyncProJobs,
    lipSyncActiveList = [],
    setLipSyncActiveList,
    lipSyncPromptBackup = [],
    setLipSyncPromptBackup,
    referenceVideoUrls = [],
    setReferenceVideoUrls,
    referenceVideoActiveList = [],
    setReferenceVideoActiveList,
}) => {
    // ... existing hook ...

    // ---------------------------------------------------------------------
    // INDEX IDENTITY (unified/flattened display index vs native A-shot index)
    //
    // When the B-shot unified grid is active, `index` (and any `idx`/`i`
    // derived from it) is a FLATTENED display index into the unified arrays
    // (ImagesHdCloud, VideoArrayCloud, TextVideo, GeneratedText, steps, ...).
    // Arrays that are NOT unified (stepsx, noImagePrompt, steps2) are indexed
    // by the NATIVE A-shot sourceIndex. `toNativeSlot` resolves a unified
    // index to its native A-shot sourceIndex (a B-shot resolves to its parent
    // A-shot slot). When `unifiedIndexMap` is absent, indices are already
    // native and this is the identity function.
    // ---------------------------------------------------------------------
    const toNativeSlot = useCallback((uIdx: number): number => {
        if (Array.isArray(unifiedIndexMap) && unifiedIndexMap[uIdx]) {
            return unifiedIndexMap[uIdx].index;
        }
        return uIdx;
    }, [unifiedIndexMap]);

    // Native A-shot slot index of the CURRENT active card.
    const nativeSlotIndex = useMemo(() => toNativeSlot(index), [toNativeSlot, index]);

    // Force Image Mode (0) on Story Mode Part B (odd index)
    // Force Image Mode (0) on Story Mode Part B (odd index) IF NOT in Video Mode
    // Removed the useEffects that force setnarrate(0) to allow the tab state to persist

    // Removed the useEffects that force setnarrate(0) to allow the tab state to persist

    const [textValue, setTextValue] = useState("");
    const backdropPointerStarted = useRef(false);
    const [vidGenCaches, setVidGenCaches] = useState<ImageGenCache[]>([]);

    const [videotxt, setvideotxt] = useState('');
    type BShotSaveContextSnapshot = {
        isBShotMedia: boolean;
        isBShotGridContext: boolean;
        onInstantBShotSave?: (mediaUrl: string, promptText: string, isVideo: boolean, parentSceneIndex?: number, bIndex?: number | null) => void | Promise<void>;
        textValue: string;
        parentSceneIndex?: number;
        bIndex?: number | null;
    };

    const bShotSaveContextRef = useRef<BShotSaveContextSnapshot>({
        isBShotMedia,
        isBShotGridContext,
        onInstantBShotSave,
        textValue,
        parentSceneIndex,
        bIndex
    });

    useEffect(() => {
        bShotSaveContextRef.current = {
            isBShotMedia,
            isBShotGridContext,
            onInstantBShotSave,
            textValue,
            parentSceneIndex,
            bIndex
        };
    }, [isBShotMedia, isBShotGridContext, onInstantBShotSave, textValue, parentSceneIndex, bIndex]);

    const getBShotSaveContextSnapshot = useCallback((promptOverride?: string): BShotSaveContextSnapshot => {
        const current = bShotSaveContextRef.current;
        return {
            ...current,
            textValue: promptOverride ?? current.textValue
        };
    }, []);

    // Action Image Override States
    const [actionImagesMap, setActionImagesMap] = useState<Record<number, { name: string, description: string, imageUrl: string }[]>>({});
    const [activeActionImagesMap, setActiveActionImagesMap] = useState<Record<number, any[]>>({});
    const [openActionModal, setOpenActionModal] = useState<number | null>(null);
    const [actionPrompt, setActionPrompt] = useState("");
    const [actionUpdateText, setActionUpdateText] = useState("");
    const [isGeneratingAction, setIsGeneratingAction] = useState(false);
    const [hasExpandedActionChars, setHasExpandedActionChars] = useState(false);
    const [fullScreenActionImage, setFullScreenActionImage] = useState<any | null>(null);
    const [isScenesModeActive, setIsScenesModeActive] = useState(false);

    // Outside-click closer logic for Video Mode Scenes Bar
    useEffect(() => {
        if (!isScenesModeActive) return;
        const handleOutsideClick = () => {
            setIsScenesModeActive(false);
        };
        const timer = setTimeout(() => {
            document.addEventListener("click", handleOutsideClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [isScenesModeActive]);

    // Motion Image Override States
    const [actionModalMode, setActionModalMode] = useState<'action' | 'motion'>('action');
    const [motionImagesMap, setMotionImagesMap] = useState<Record<number, { name: string, description: string, imageUrl: string }[]>>({});
    const [activeMotionImagesMap, setActiveMotionImagesMap] = useState<Record<number, any[]>>({});
    const [originalNoImagePromptMap, setOriginalNoImagePromptMap] = useState<Record<number, boolean>>({});



    const extendedReferenceImages = React.useMemo(() => {
        let combined = [...(referenceImages || [])];
        const activeActions = activeActionImagesMap[index] || [];
        if (activeActions.length > 0) {
            const mappedActions = activeActions.map((act: any) => ({
                name: act.name,
                url: act.imageUrl,
                imageUrl: act.imageUrl,
                image: act.imageUrl,
                isMotion: false,
            }));
            combined = [...combined, ...mappedActions];
        }

        const activeMotions = activeMotionImagesMap[index] || [];
        if (activeMotions.length > 0) {
            const mappedMotions = activeMotions.map((mot: any) => ({
                name: mot.name,
                url: mot.imageUrl,
                imageUrl: mot.imageUrl,
                image: mot.imageUrl,
                isMotion: true,
            }));
            combined = [...combined, ...mappedMotions];
        }

        return combined;
    }, [referenceImages, activeActionImagesMap, activeMotionImagesMap, index]);

    const actionPopupCharacters = React.useMemo(() => {
        const chars = [...extendedReferenceImages];
        if (VideMode && ImagesHdCloud?.[index]) {
            chars.unshift({
                name: "Startframe",
                url: ImagesHdCloud[index],
                imageUrl: ImagesHdCloud[index],
                image: ImagesHdCloud[index]
            });
        }
        return chars;
    }, [extendedReferenceImages, VideMode, ImagesHdCloud, index]);

    const [textValue2, setTextValue2] = useState("");

    const [textValueT, setTextValueT] = useState("");

    const [textValuex, setTextValuex] = useState("");

    const [textValuex2, setTextValuex2] = useState("");


    const [pixelsc, setPixelsc] = useState(0);

    const [pixelsk, setPixelsk] = useState(0);

    const [showRemix, setshowRemix] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState<boolean[]>([]);

    // Live Notepad buffer dispatcher
    useEffect(() => {
        if (!extendedReferenceImages || extendedReferenceImages.length === 0 || !onUpdateActiveCharacters) {
            return;
        }

        const sceneActive: any[] = [];
        const liveText = (VideMode ? videotxt : textValue) || "";

        for (const ref of extendedReferenceImages) {
            if (!ref || !ref.name) continue;
            const rawName = String(ref.name).trim();
            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");

            const words = rawName.split(/[\s\-]+/);
            const flexibleNamePattern = words.map(w => escapeRegExp(w)).join('[\\s\\-]*');

            const regex = new RegExp(`(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)`, "i");
            if (regex.test(liveText)) {
                sceneActive.push({
                    name: ref.name,
                    url: ref.url,
                    imageUrl: ref.imageUrl,
                    image: ref.image,
                    description: ref.description,
                    isMotion: ref.isMotion
                });
            }
        }

        // Also check for Scene Images (e.g. "@Scene1", "@Scene2", etc.)
        if (ImagesHdCloud && ImagesHdCloud.length > 0) {
            ImagesHdCloud.forEach((url: string, idx: number) => {
                if (!url) return;
                const sceneName = `Scene ${idx + 1}`;
                const handle = "@" + sceneName.replace(/[^A-Za-z0-9_]/g, "");
                const regex = new RegExp(`\\s*${handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
                if (regex.test(liveText)) {
                    sceneActive.push({
                        name: sceneName,
                        url: url,
                        imageUrl: url,
                        image: url,
                        isMotion: false
                    });
                }
            });
        }

        const hasMotion = sceneActive.some(char => char.isMotion);

        if (hasMotion) {
            // noImagePrompt is a NATIVE array â€” key by nativeSlotIndex, not the unified display index
            setOriginalNoImagePromptMap(prev => {
                if (!(nativeSlotIndex in prev)) {
                    return { ...prev, [nativeSlotIndex]: !!noImagePrompt[nativeSlotIndex] };
                }
                return prev;
            });
            setnoImagePrompt((prev: any) => {
                const next = [...prev];
                next[nativeSlotIndex] = true;
                return next;
            });
        } else {
            setOriginalNoImagePromptMap(prev => {
                if (nativeSlotIndex in prev) {
                    setnoImagePrompt((prevNoImage: any) => {
                        const next = [...prevNoImage];
                        next[nativeSlotIndex] = prev[nativeSlotIndex];
                        return next;
                    });
                    const nextMap = { ...prev };
                    delete nextMap[nativeSlotIndex];
                    return nextMap;
                }
                return prev;
            });
        }

        onUpdateActiveCharacters(index, sceneActive);
    }, [textValue, videotxt, VideMode, extendedReferenceImages, index, nativeSlotIndex, ImagesHdCloud]);

    const dispatch = useDispatch();

    const [show, setShow] = useState(true);


    const [TextFieldactive, setTextFieldactive] = useState(false);


    const MAX_VIDEO_SIZE_MB = 500;
    const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;



    /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
       2.  Whenever the `steps` array changes length,
           create a matching Boolean array, all false.
       ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
    useEffect(() => {
        setIsGenerating((prev: any) => {
            if (prev && prev.length === steps.length) return prev;
            const next = Array(steps.length).fill(false);
            if (prev) {
                for (let j = 0; j < Math.min(prev.length, steps.length); j++) {
                    next[j] = prev[j];
                }
            }
            return next;
        });
        setIsUpscaling((prev: any) => {
            if (prev && prev.length === steps.length) return prev;
            const next = Array(steps.length).fill(false);
            if (prev) {
                for (let j = 0; j < Math.min(prev.length, steps.length); j++) {
                    next[j] = prev[j];
                }
            }
            return next;
        });
    }, [steps]);

    const setGeneratingAt = useCallback((idx: number, value: boolean) => {
        if (isBShotGridContext && setIsBShotGenerating) {
            setIsBShotGenerating((prev: any) => {
                const next = [...(prev || [])];
                while (next.length <= parentSceneIndex!) next.push([]);
                const sceneArr = [...(next[parentSceneIndex!] || [])];
                sceneArr[bIndex !== undefined ? bIndex : idx] = value;
                next[parentSceneIndex!] = sceneArr;
                return next;
            });
        } else {
            setIsGenerating((prev: any) => {
                const next = [...prev];
                next[idx] = value;
                return next;
            });
        }
    }, [isBShotGridContext, setIsBShotGenerating, parentSceneIndex, setIsGenerating, bIndex]);


    const CLIK_URL = import.meta.env.VITE_CLIK_URL;


    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    /* ---------- slider index sync ---------- */
    const sliderRef = useRef<HTMLDivElement | null>(null);
    const touchStartXRef = useRef<number | null>(null);
    const touchEndXRef = useRef<number | null>(null);
    const lastSwipeTimeRef = useRef<number>(0);

    const pixels = useSelector((state: RootState) => state.settings.pixels);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);


    // 2. Define State
    const [selectedPromptsMap, setSelectedPromptsMap] = useState<Record<number, string[]>>({});
    const [selectedFinalsMap, setSelectedFinalsMap] = useState<Record<number, string[]>>({});
    const [resultHistory, setResultHistory] = useState<Record<number, string[]>>({});

    // 3. Get Current Lists (Safe Access)
    const currentSelectedPrompts = selectedPromptsMap[index] || [];
    const currentSelectedFinals = selectedFinalsMap[index] || [];


    const [animateState, setAnimateState] = useState<number>(0);
    const [trimmedVideoUrl, setTrimmedVideoUrl] = useState<string | null>(null);



    //const pixelsV = 60;

    // ...inside your component render:
    const editorFontFamily = '"Roboto", "Helvetica", "Arial", sans-serif';
    const commonButtonSx = {
        width: "auto",
        minHeight: 34,
        borderRadius: 999,
        /* premium glass */
        background: darkMode
            ? "linear-gradient(135deg, rgba(20,20,20,0.5) 0%, rgba(10,10,10,0.2) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)",
        backdropFilter: "blur(20px) saturate(180%)",
        border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.6)",
        color: darkMode ? "#ffffff" : "#000000",
        fontFamily: editorFontFamily,
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: 0.1,
        boxShadow: darkMode ? "0px 6px 14px rgba(0, 0, 0, 0.24)" : "0px 6px 14px rgba(31, 38, 135, 0.06)",
        "&:hover": {
            background: darkMode
                ? "linear-gradient(135deg, rgba(30,30,30,0.6) 0%, rgba(20,20,20,0.3) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 100%)",
            color: darkMode ? "#yellow" : "#000000",
            boxShadow: "0px 8px 18px rgba(0, 0, 0, 0.28)",
            border: darkMode ? "1px solid rgba(255, 215, 0, 0.5)" : "1px solid rgba(255, 50, 50, 0.5)",
        },
        px: 1.2,
        py: 0.5
    };

    const shellHeaderHeight = matchMobile ? 84 : 96;
    const controlPanelWidth = matchMobile ? "100%" : "55%";
    const mediaPanelWidth = matchMobile ? "100%" : `calc(100% - ${controlPanelWidth})`;
    const glassPanelBg = darkModeReducer
        ? "linear-gradient(135deg, rgba(18,18,20,0.92) 0%, rgba(10,10,12,0.82) 100%)"
        : "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(244,244,246,0.82) 100%)";
    const shellBorder = darkModeReducer
        ? "1px solid rgba(255,255,255,0.09)"
        : "1px solid rgba(255,255,255,0.72)";
    const fieldShellSx = {
        "& .MuiOutlinedInput-root": {
            bgcolor: darkModeReducer ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            borderRadius: 3,
            alignItems: "flex-start",
            boxShadow: "none",
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: darkModeReducer ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        },
        "& .MuiInputBase-input": {
            color: darkMode ? "#ffffff" : "#000000",
            fontFamily: editorFontFamily,
            fontSize: "0.95rem",
            lineHeight: 1.55,
            caretColor: "auto !important",
        },
        "& .MuiInputBase-input::placeholder": {
            fontFamily: editorFontFamily,
            fontSize: "0.95rem",
            lineHeight: 1.55,
            opacity: 0.7,
            color: "inherit",
        },
        "& .MuiInputLabel-root": {
            color: darkMode ? "#ffffff" : "#000000",
            fontFamily: editorFontFamily,
            fontSize: "0.95rem",
            lineHeight: 1.55,
        },
        "& .MuiFormHelperText-root": {
            color: darkMode ? "#ffffff" : "#000000",
        },
        "&::-webkit-scrollbar": {
            width: "8px",
        },
        "&::-webkit-scrollbar-track": {
            background: "rgb(255,255,255,0.2)",
        },
        "&::-webkit-scrollbar-thumb": {
            background: "rgb(150,150,150,0.8)",
            borderRadius: "4px",
        },
        "&::-webkit-scrollbar-thumb:hover": {
            background: "rgb(255,255,255,0.1)",
        },
    } as const;
    const sectionTitleSx = {
        color: darkMode ? "#E8BAFA" : "#0099cc",
        fontWeight: 800,
        fontFamily: editorFontFamily,
        fontSize: "0.8rem",
        display: "block",
        letterSpacing: 1,
        mb: 1,
        textTransform: "uppercase",
    } as const;
    const optionPillSx = {
        borderRadius: 999,
        minHeight: 34,
        textTransform: "none",
        fontWeight: 700,
        fontFamily: editorFontFamily,
        fontSize: "0.75rem",
        background: darkModeReducer
            ? "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.42) 100%)",
        backdropFilter: "blur(18px) saturate(180%)",
        border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.7)",
        color: darkModeReducer ? "#fff" : "#111",
        boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.24)" : "0 8px 20px rgba(31,38,135,0.08)",
        px: 1.2,
        py: 0.5,
    } as const;
    const compactGlassButtonSx = {
        minHeight: 34,
        height: 34,
        borderRadius: 999,
        px: 1.35,
        py: 0.45,
        textTransform: "none",
        fontFamily: editorFontFamily,
        fontSize: "0.76rem",
        fontWeight: 700,
        background: darkModeReducer
            ? "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.46) 100%)",
        backdropFilter: "blur(18px) saturate(180%)",
        border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.72)",
        color: darkModeReducer ? "#fff" : "#111",
        boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.18)" : "0 8px 20px rgba(31,38,135,0.06)",
        "&:hover": {
            background: darkModeReducer
                ? "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.58) 100%)",
        },
    } as const;
    const panelTabSx = (active: boolean) => ({
        pb: 0.35,
        cursor: "pointer",
        fontFamily: editorFontFamily,
        fontSize: "0.88rem",
        fontWeight: 700,
        color: active ? (darkModeReducer ? "#fff" : "#111") : (darkModeReducer ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.5)"),
        borderBottom: active ? `2px solid ${darkMode ? "#E8BAFA" : "#0099cc"}` : "2px solid transparent",
        transition: "color 0.2s ease",
    });
    const panelHeaderRowSx = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        rowGap: 0.6,
        flexWrap: "wrap",
        mb: 1.25,
    } as const;
    const topUtilityButtonSx = {
        minWidth: 0,
        height: 42,
        borderRadius: 999,
        textTransform: "none",
        fontFamily: editorFontFamily,
        fontSize: "0.78rem",
        fontWeight: 700,
        background: darkModeReducer
            ? "linear-gradient(135deg, rgba(20,20,20,0.6) 0%, rgba(10,10,10,0.4) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.44) 100%)",
        backdropFilter: "blur(18px) saturate(180%)",
        border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.7)",
        color: darkModeReducer ? "#fff" : "#111",
        boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.24)" : "0 8px 20px rgba(31,38,135,0.08)",
        "&:hover": {
            background: darkModeReducer
                ? "linear-gradient(135deg, rgba(40,40,40,0.7) 0%, rgba(20,20,20,0.5) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.58) 100%)",
        },
    } as const;
    const videoMetaButtonSx = {
        minWidth: { xs: 84, md: 88 },
        height: 40,
        borderRadius: 999,
        textTransform: "none",
        fontFamily: editorFontFamily,
        fontSize: "0.8rem",
        fontWeight: 700,
        background: darkModeReducer
            ? "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.46) 100%)",
        backdropFilter: "blur(18px) saturate(180%)",
        border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.72)",
        color: darkModeReducer ? "#fff" : "#111",
        boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.18)" : "0 8px 20px rgba(31,38,135,0.06)",
        px: 1.6,
        py: 0.85,
        "&:hover": {
            background: darkModeReducer
                ? "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.58) 100%)",
        },
    } as const;
    const greenPrimaryButtonSx = {
        width: "100%",
        minHeight: 56,
        borderRadius: 4,
        background: darkMode ? "#E8BAFA" : "#0099cc",
        color: "#121212",
        fontWeight: 800,
        fontFamily: editorFontFamily,
        fontSize: "0.96rem",
        letterSpacing: 0.35,
        boxShadow: "0 8px 20px rgba(79, 207, 96, 0.3)",
        "&:hover": {
            background: "linear-gradient(180deg, #6ae57a 0%, #57d668 100%)",
            color: "#121212",
            boxShadow: "0 10px 25px rgba(79, 207, 96, 0.4)",
        },
    } as const;
    const previewHeight = matchMobile
        ? (show ? "20vh" : "100dvh")
        : "100%";
    const mobileControlTop = show ? "20vh" : "100dvh";
    const mobileControlHeight = show
        ? `calc(100dvh - 20vh)`
        : "0px";

    const borderColor = (active: boolean) =>
        active ? (darkModeReducer ? "#fff" : "#000") : "transparent";
    const defaultFieldTextSx = {
        color: darkMode ? "#ffffff" : "#000000",
        fontFamily: editorFontFamily,
        fontSize: "0.95rem",
        lineHeight: 1.55,
        caretColor: "auto !important",
    } as const;
    const promptFieldTextSx = {
        color: darkModeReducer ? "#ffffff" : "#000000",
        fontFamily: editorFontFamily,
        fontSize: "0.95rem",
        lineHeight: 1.55,
        caretColor: "auto !important",
    } as const;



    const getPixel = async () => {
        try {
            const response = await axios.post(
                `${CLIK_URL}/getPixels`,                   // <-- POST endpoint
                { values: { userid: loggedUser?.id ?? 0 } }  // <-- request body
            );
            const { pixels } = response.data as any;   // ÃƒÂ¢Ã¢â‚¬Â Ã‚Â pick out the primitive

            /// setPixels(pixels);

            dispatch(setPixels(pixels));

        } catch (err) {
            console.error("Error fetching pixels:", err);
        }
    };







    useEffect(() => {
        ///back

        if (startEdit) {

            getPixel();

        } else {


        }

    }, [startEdit, showRemix])


    useEffect(() => {

        ///alert('jjh');
        var x = modelz;
        if (currentSelectedPrompts && currentSelectedPrompts.length > 0) {


            if (modelz === 'fluxUltra') {

                x = 'fluxUltra';
            }
            else if (modelz === 'Schnell' || modelz === 'Models') {

                x = 'Schnell';
            }
        }
        const modelPrice = calcModelPixels({
            model: x,          // or m.name, however you store the model label
            baseImagesPerDollar: 333       // keep in sync with what you pass the component
        });

        setPixelsc(modelPrice);

    }, [startEdit, modelz, currentSelectedPrompts]);


    useEffect(() => {

        const modelPrice = calcModelPixels({
            model: 'Kontext',          // or m.name, however you store the model label
            baseImagesPerDollar: 333       // keep in sync with what you pass the component
        });

        setPixelsk(modelPrice);
    }, [startEdit, modelz]);





    const [textVidUpdate, settextVidUpdate] = useState('');

    /* keep slider aligned when parent changes index */
    useEffect(() => {



        if (!sliderRef.current) return;
        sliderRef.current.scrollTo({
            left: index * (sliderRef.current.clientWidth || 1),
            behavior: "auto",
        });

    }, [index, startEdit]);

    // const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Helper: Are we in array-based mode?
    const isArrayMode = type === 0;

    // Helper: get the ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œcurrentÃƒÂ¢Ã¢â€šÂ¬Ã‚Â displayed image (either from the arrays or from the single props)
    // Helper: get the ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œcurrentÃƒÂ¢Ã¢â€šÂ¬Ã‚  displayed image (either from the arrays or from the single props)
    const currentDisplayedImage = isArrayMode
        ? generatedImagesFlux[index] || (nanoImages && nanoImages[index]) || fallbackImage
        : FluxIm || (nanoImages && nanoImages[0]) || fallbackImage;

    // Helper: get the ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œbaseÃƒÂ¢Ã¢â€šÂ¬Ã‚  image for the current index (array-mode) or for single mode (index=0)
    const currentBaseImage = isArrayMode
        ? base[index]
        : base[0]; // in single mode, we just store at base[0]
    const currentVideo = VideoArray[index];
    const isZoomPreview = !show;

    const togglePreviewMode = useCallback((event?: { preventDefault?: () => void; stopPropagation?: () => void; }) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (Date.now() - lastSwipeTimeRef.current < 400) return;
        setShow((prev) => !prev);
    }, []);

    const goToPreviousScene = useCallback(() => {
        if (index > 0) {
            setIndex?.(index - 1);
        }
    }, [index, setIndex]);

    const goToNextScene = useCallback(() => {
        if (index < steps.length - 1) {
            setIndex?.(index + 1);
        }
    }, [index, setIndex, steps.length]);
    ///Typex
    // Handle Escape key to close the editor safely without touching window.history API
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && startEdit) {
                if (openActionModal || fullScreenActionImage) return; // Let the modal handle its own escape
                console.error("[EditStory] Escape key pressed! Calling setstartEdit(false)");
                setstartEdit(false);
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("keydown", handleEscape);
        };
    }, [startEdit, openActionModal, fullScreenActionImage]);


    // [REMOVED window.history.pushState LOGIC]
    useEffect(() => {

        if (startEdit) {

            dispatch(setShowmenuToggle(false));

        } else {

            dispatch(setShowmenuToggle(true));

        }



    }, [startEdit, setstartEdit]);



    const [stopObserve, setstopObserve] = useState(false);

    ////////////////////////////////////INDEX UPDATE/////////////////////////////////
    const handleScroll = useCallback(() => {
        if (!sliderRef.current || stopObserve) return;

        const { scrollLeft, clientWidth } = sliderRef.current;
        const newIdx = Math.round(scrollLeft / clientWidth); // snap points are 100% wide

        if (newIdx !== index) {
            setIndex?.(newIdx);
        }
    }, [index, setIndex, stopObserve]);

    const go = useCallback(() => {
        const slider = sliderRef.current;
        if (!slider) return;

        // Temporarily ignore scroll events caused by this programmatic scroll     setVideoArray([]);
        setstopObserve(true);

        slider.scrollTo({
            left: index * slider.clientWidth,
            behavior: "smooth",
        });

        // Re-enable scroll observing shortly after the smooth scroll starts
        window.setTimeout(() => {
            setstopObserve(false);
        }, 1000); // short window instead of 3 seconds
    }, [index]);

    // Scroll to the active index whenever the editor opens or the index changes
    useEffect(() => {
        if (!startEdit) return;
        go();
    }, [startEdit, index, go]);



    ////////////////////////////////////INDEX UPDATE/////////////////////////////////

    const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);

    const [Once, setOnce] = useState(false);

    useEffect(() => {
        //   setTextValuex('');

    }, [startEdit, narrate])

    // Initialize text value, and base array item

    useEffect(() => {
        if (!startEdit) return;

        ///alert()


        setvideotxt(TextVideo[index] || '');



        // In array mode, we read from GeneratedText[index], else single uses prompt
        if (isArrayMode) {
            setTextValue(GeneratedText[index] || defaultText);
            // steps2 is narration-space (one entry per content scene). Derive the
            // narration index from the NATIVE A-shot slot, never the unified index.
            const narrIdx = Math.floor(nativeSlotIndex / 2);
            const narrData = steps2?.[narrIdx];
            setTextValueT(typeof narrData === 'object' && narrData !== null ? narrData.text : (narrData ?? ""));
        } else {
            setTextValue(prompt || defaultText);
        }



        // If there's no base image stored yet, set it with the ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œGeneratedImageÃƒÂ¢Ã¢â€šÂ¬Ã‚Â in array mode or single mode
        // (In single mode, we store the base in base[0].)
        if (!currentBaseImage) {
            setbase((prev: any) => {
                const next = [...prev];
                const targetIndex = isArrayMode ? index : 0;
                next[targetIndex] = isArrayMode ? GeneratedImage : Im;
                return next;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startEdit, index, GeneratedImage, Im, GeneratedText, prompt, steps, TextVideo]);




    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValue(event.target.value);
    };

    const handleChangeR = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValue2(event.target.value);
    };
    const handleChangeT = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValueT(event.target.value);
    };

    const handleChangex = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValuex(event.target.value);
    };

    const handleChangexv = (event: React.ChangeEvent<HTMLInputElement>) => {
        settextVidUpdate(event.target.value);
    };



    const handleChangex2 = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValuex2(event.target.value);
    };


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


    const LOCAL_KEY_PREFIX = "localstoragevid";   // e.g. localstoragevid1, 2, 3 ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦

    const saveVideoLOCALxFORxINTERACTIONS = useCallback((idx: number, videoObjectUrl: any) => {
        if (isBShotMedia) return; // Suppress individual saves; Storybook handles the combined array rewrite

        // Turn the Blob into a session-lifetime URL
        if (pageType === 3) {

            localStorage.setItem(`localInteractionpostId`, PostId);

            var url = videoObjectUrl;
            var xx = idx;

            // Make a key such as "localstoragevid1"
            var key = `${LOCAL_KEY_PREFIX}${xx}`;
            // alert(key)
            localStorage.setItem(key, url);

        }
        /// alert('jj');
        /// return { key, url };
    }, [PostId, pageType]);



    const [videModel, setvideModel] = useState('');





    // Your mode toggle
    const [button, setbutton] = useState<any>("");

    // IMPORTANT: use state for updates (a plain `const pixelsV = 60` won't update)
    const [pixelsV, setPixelsV] = useState(60);

    // Other knobs



    const [Selectti, setSelectti] = useState(false);


    // `time` / `setTime` are now lifted to Storybook and passed in as props
    // (single source of truth shared with the B-shot duration calculation).
    const lockedMusicTime = musicBreakerSec === 5 ? 5 : 10;
    const isMusicVideoTimingLocked = Boolean(musicMode);
    const [isSnippetPlaying, setIsSnippetPlaying] = useState(false);
    const sceneVideoPreviewRefs = useRef<Record<number, CustomVideoPlayerHandle | null>>({});
    const syncedSnippetVideoIndexRef = useRef<number | null>(null);
    const snippetAudioRef = useRef<HTMLAudioElement | null>(null);
    const snippetStopAtRef = useRef<number | null>(null);
    const snippetStopTimeoutRef = useRef<number | null>(null);
    const currentMusicSnippet = useMemo(() => {
        const safeIndex = Math.max(0, Number(index || 0));
        const storySceneIndex = Math.floor(safeIndex / 2);
        const stageInScene = safeIndex % 2;
        const sourceSegment = Array.isArray(musicSegments) ? musicSegments[storySceneIndex] : null;

        if (sourceSegment && Number.isFinite(sourceSegment.start) && Number.isFinite(sourceSegment.end)) {
            const segmentStart = Number(sourceSegment.start);
            const segmentEnd = Math.max(segmentStart, Number(sourceSegment.end));
            const midpoint = segmentStart + ((segmentEnd - segmentStart) / 2);

            return stageInScene === 0
                ? { start: segmentStart, end: midpoint }
                : { start: midpoint, end: segmentEnd };
        }

        const safeBreaker = musicBreakerSec === 5 ? 5 : 10;
        const start = safeIndex * safeBreaker;
        return {
            start,
            end: start + safeBreaker,
        };
    }, [index, musicBreakerSec, musicSegments]);

    const stopSnippetPreview = useCallback(() => {
        if (snippetStopTimeoutRef.current !== null) {
            window.clearTimeout(snippetStopTimeoutRef.current);
            snippetStopTimeoutRef.current = null;
        }
        const audio = snippetAudioRef.current;
        if (audio) {
            audio.pause();
        }
        const syncedVideoIndex = syncedSnippetVideoIndexRef.current;
        if (syncedVideoIndex !== null) {
            sceneVideoPreviewRefs.current[syncedVideoIndex]?.stopSnippetPlayback();
            syncedSnippetVideoIndexRef.current = null;
        }
        snippetStopAtRef.current = null;
        setIsSnippetPlaying(false);
    }, []);

    const handleSnippetToggle = useCallback(() => {
        const audio = snippetAudioRef.current;
        if (!musicMode || !musicModeUrl || !audio) return;

        if (isSnippetPlaying) {
            stopSnippetPreview();
            return;
        }

        audio.currentTime = currentMusicSnippet.start;
        snippetStopAtRef.current = currentMusicSnippet.end;
        const videoPreview = VideMode ? sceneVideoPreviewRefs.current[index] : null;
        if (videoPreview) {
            syncedSnippetVideoIndexRef.current = index;
            videoPreview.startSnippetPlayback();
        }
        const snippetMs = Math.max(250, (currentMusicSnippet.end - currentMusicSnippet.start) * 1000);
        snippetStopTimeoutRef.current = window.setTimeout(() => {
            stopSnippetPreview();
        }, snippetMs + 150);
        audio.play()
            .then(() => setIsSnippetPlaying(true))
            .catch((error) => {
                console.warn("Could not play music video snippet:", error?.message || error);
                stopSnippetPreview();
            });
    }, [currentMusicSnippet, index, isSnippetPlaying, musicMode, musicModeUrl, stopSnippetPreview, VideMode]);

    const handleSnippetTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
        const stopAt = snippetStopAtRef.current;
        if (stopAt !== null && event.currentTarget.currentTime >= stopAt) {
            stopSnippetPreview();
        }
    }, [stopSnippetPreview]);

    useEffect(() => {
        stopSnippetPreview();
    }, [index, musicBreakerSec, musicModeUrl, musicSegments, stopSnippetPreview]);

    const [isLipSyncAudioTrimming, setIsLipSyncAudioTrimming] = useState(false);
    const activeLipSyncAudioUrl = useMemo(() => {
        const safeIndex = Math.max(0, Number(index || 0));
        return Array.isArray(lipSyncAudioUrls) ? lipSyncAudioUrls[safeIndex] : "";
    }, [index, lipSyncAudioUrls]);
    const hasLipSyncAudio = typeof activeLipSyncAudioUrl === "string" && activeLipSyncAudioUrl.trim().length > 0;
    const isLipSyncActive = Array.isArray(lipSyncActiveList) ? lipSyncActiveList[Math.max(0, Number(index || 0))] : false;
    const createLipSyncAudio = useCallback(async (): Promise<string> => {
        const safeIndex = Math.max(0, Number(index || 0));
        if (!musicMode || !musicModeUrl || isLipSyncAudioTrimming) {
            throw new Error("Select music before creating lip-sync audio.");
        }

        const start = Number(currentMusicSnippet.start);
        const end = Number(currentMusicSnippet.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            const message = "Invalid music snippet for lipsync audio.";
            globalErrorEmitter.emit(message, safeIndex);
            throw new Error(message);
        }

        setIsLipSyncAudioTrimming(true);
        stopSnippetPreview();
        try {
            const res: any = await axios.post(
                `${CLIK_URL}/create-lipsync-trimaudio`,
                {
                    originalAudio: musicModeUrl,
                    start,
                    end,
                    outputBucket: "s3://clikbatebucket/videos/",
                },
                { withCredentials: true }
            );
            const audioUrl = res.data?.audioUrl;
            if (typeof audioUrl !== "string" || audioUrl.trim().length === 0) {
                throw new Error("Trim route did not return an audioUrl.");
            }

            setLipSyncAudioUrls?.((prev: string[] = []) => {
                const next = Array.isArray(prev) ? [...prev] : [];
                while (next.length <= safeIndex) next.push("");
                next[safeIndex] = audioUrl;
                return next;
            });
            SaveAudioHelperForDelLater(audioUrl);
            return audioUrl;
        } catch (error: any) {
            console.error("Lipsync audio trim failed:", error);
            globalErrorEmitter.emit(error?.message || "Could not trim audio for lipsync.", safeIndex);
            throw error;
        } finally {
            setIsLipSyncAudioTrimming(false);
        }
    }, [CLIK_URL, currentMusicSnippet, index, isLipSyncAudioTrimming, musicMode, musicModeUrl, setLipSyncAudioUrls, stopSnippetPreview]);

    // ---------------------------------------------------------------------------
    // Dedicated post-generation lip sync. This bypasses GenerateSignedUrlForVideo,
    // so it never calls startDeleteVid for the source scene video.
    const [isLipSyncProModalOpen, setIsLipSyncProModalOpen] = useState(false);
    const activeLipSyncProJob = lipSyncProJobs[index];
    const isLipSyncProGenerating = activeLipSyncProJob?.state === "generating";
    const lipSyncProStatus = activeLipSyncProJob?.message || "";
    const updateLipSyncProJob = useCallback((state: "generating" | "succeeded" | "failed", message: string) => {
        setLipSyncProJobs?.((prev: Record<number, { state: "generating" | "succeeded" | "failed"; message: string }> = {}) => ({
            ...prev,
            [index]: { state, message },
        }));
    }, [index, setLipSyncProJobs]);
    const directLipSyncSourceUrl = typeof VideoArrayCloud?.[index] === "string" ? VideoArrayCloud[index] : "";
    const directLipSyncVideoPreview = currentVideo || directLipSyncSourceUrl;
    const directLipSyncSeconds = Math.max(1, Math.round(currentMusicSnippet.end - currentMusicSnippet.start));
    const directLipSyncDollars = directLipSyncSeconds * 0.08325;
    const directLipSyncPixels = Math.round(directLipSyncDollars * 333);
    const canUseDirectLipSync = Boolean(musicMode && VideMode && !isBShotMedia && !isBShotModeActive && directLipSyncSourceUrl && directLipSyncVideoPreview);

    const openDirectLipSync = useCallback(() => {
        if (!canUseDirectLipSync) {
            globalErrorEmitter.emit("Generate and save this music-video scene before using Lip Sync Pro.", index);
            return;
        }
        setIsLipSyncProModalOpen(true);
    }, [canUseDirectLipSync, index]);

    const persistDirectLipSyncVideo = useCallback(async (blob: Blob, objectUrl: string) => {
        const sourceUrl = directLipSyncSourceUrl;
        if (!sourceUrl) throw new Error("The source scene video has not been saved to S3.");

        const signedRes = await axios.post<any>(`${CLIK_URL}/get_signed_url_video`, { values: { count: 1 } }, { withCredentials: true });
        const signedUrl = signedRes.data?.holder?.[0]?.urlVideo;
        if (!signedUrl) throw new Error("Could not create an upload URL for the Lip Sync Pro result.");

        const uploadRes = await axios.put(signedUrl, blob, { headers: { "Content-Type": blob.type || "video/mp4" } });
        if (uploadRes.status !== 200 && uploadRes.status !== 204) {
            throw new Error(`Lip Sync Pro upload failed with status ${uploadRes.status}.`);
        }

        const uploadedUrl = signedUrl.split("?")[0];
        await axios.put(`${CLIK_URL}/UpdatePostAIVideo`, {
            values: { postId: PostId, type: toNativeSlot(index), vid: uploadedUrl, mode: pageType },
        });

        setVideoArray((prev: any) => {
            const next = [...(prev || [])];
            next[index] = objectUrl;
            return next;
        });
        setVideoArrayBlob((prev: any) => {
            const next = [...(prev || [])];
            next[index] = blob;
            return next;
        });
        setVideoArrayCloud((prev: any) => {
            const next = [...(prev || [])];
            next[index] = uploadedUrl;
            return next;
        });

        // Storybook later removes this only if it is no longer used by the post.
        if (sourceUrl !== uploadedUrl) SaveVideoHelperForDelLater(sourceUrl);
    }, [CLIK_URL, PostId, directLipSyncSourceUrl, index, pageType, setVideoArray, setVideoArrayBlob, setVideoArrayCloud, toNativeSlot]);

    const handleDirectLipSyncGenerate = useCallback(async () => {
        if (isLipSyncProGenerating) return;
        if (!canUseDirectLipSync || !directLipSyncSourceUrl) {
            globalErrorEmitter.emit("Generate and save this music-video scene before using Lip Sync Pro.", index);
            return;
        }
        if (pixels < directLipSyncPixels) {
            globalErrorEmitter.emit(`You need ${directLipSyncPixels} pixels for Lip Sync Pro, but your balance is ${pixels}.`, index);
            return;
        }

        updateLipSyncProJob("generating", hasLipSyncAudio ? "Starting Lip Sync Proâ€¦" : "Creating scene audio snippetâ€¦");
        try {
            const audioUrl = hasLipSyncAudio ? activeLipSyncAudioUrl : await createLipSyncAudio();
            const response = await axios.post<any>(
                `${CLIK_URL}/lipsync2Pro`,
                { videoUrl: directLipSyncSourceUrl, audioUrl, syncMode: "loop", temperature: 0.5, activeSpeaker: true, asyncMode: true },
                { timeout: 90000 }
            );
            let { status, jobId, provider, modelEndpoint, videoBase64 } = response.data || {};
            if (status !== "starting" && status !== "succeeded") throw new Error(response.data?.error || "Lip Sync Pro was not accepted.");

            updateLipSyncProJob("generating", "Generating Lip Sync Pro videoâ€¦");
            if (status === "starting") {
                let completed = false;
                for (let attempt = 0; attempt < 360; attempt += 1) {
                    await new Promise((resolve) => window.setTimeout(resolve, 5000));
                    const pollRes = await axios.post(`${CLIK_URL}/pollVideoStatus`, { jobId, provider, modelEndpoint });
                    const pollData = pollRes.data || {};
                    if (pollData.status === "succeeded") {
                        videoBase64 = pollData.videoBase64;
                        completed = true;
                        break;
                    }
                    if (pollData.status === "failed" || pollData.status === "canceled") {
                        throw new Error(pollData.error || "Lip Sync Pro generation failed.");
                    }
                }
                if (!completed) throw new Error("Lip Sync Pro timed out while waiting for the provider.");
            }

            if (!videoBase64) throw new Error("Lip Sync Pro returned no video data.");
            updateLipSyncProJob("generating", "Saving Lip Sync Pro resultâ€¦");
            const blob = await base64ToBlob(videoBase64);
            await persistDirectLipSyncVideo(blob, URL.createObjectURL(blob));

            // Mirror normal video generation: charge only after S3 upload and scene save succeed.
            await removePixel(directLipSyncPixels);
            updateLipSyncProJob("succeeded", "Generated already â€” generate again when you want another version.");
        } catch (error: any) {
            console.error("Lip Sync Pro generation failed:", error);
            const message = error?.message || "Could not generate the Lip Sync Pro video.";
            updateLipSyncProJob("failed", message);
            globalErrorEmitter.emit(message, index);
        }
    }, [activeLipSyncAudioUrl, canUseDirectLipSync, createLipSyncAudio, directLipSyncPixels, directLipSyncSourceUrl, hasLipSyncAudio, index, isLipSyncProGenerating, persistDirectLipSyncVideo, pixels, updateLipSyncProJob]);
    // Reference Video (Seedance 2.0 / 2.0 Fast only) â€” user-picked clip used as a
    // [Video1] motion/style reference. Uploaded to S3, registered for later cleanup.
    // ---------------------------------------------------------------------------
    const REF_VIDEO_MAX_SECONDS = 15;       // Seedance caps reference video at 15s total
    const REF_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100MB
    // Only Seedance 2.0 (Pro) and Seedance 2.0 Fast (Minix) accept reference videos.
    const isVideoRefModel = videModel === "Pro" || videModel === "Minix";
    const refVideoInputRef = useRef<HTMLInputElement | null>(null);
    const [isRefVideoUploading, setIsRefVideoUploading] = useState(false);
    const [isRefVideoModalOpen, setIsRefVideoModalOpen] = useState(false);
    const activeReferenceVideoUrl = useMemo(() => {
        const safeIndex = Math.max(0, Number(index || 0));
        return Array.isArray(referenceVideoUrls) ? referenceVideoUrls[safeIndex] : "";
    }, [index, referenceVideoUrls]);
    const hasReferenceVideo = typeof activeReferenceVideoUrl === "string" && activeReferenceVideoUrl.trim().length > 0;
    // Whether the uploaded reference video is actively in use for this scene. The user
    // must click "Use Vid" to turn it on (label -> "Using Vid", preview highlighted).
    const isReferenceVideoActive = Array.isArray(referenceVideoActiveList)
        ? !!referenceVideoActiveList[Math.max(0, Number(index || 0))]
        : false;

    // Read a video file's duration (seconds) from its object URL.
    const readVideoDuration = useCallback((objectUrl: string): Promise<number> => {
        return new Promise((resolve, reject) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.onloadedmetadata = () => resolve(v.duration || 0);
            v.onerror = () => reject(new Error("Could not read video metadata."));
            v.src = objectUrl;
        });
    }, []);

    // Lightweight S3 upload for a reference video blob: signed URL -> PUT -> clean URL.
    const uploadReferenceVideoToS3 = useCallback(async (file: File): Promise<string> => {
        const response = await axios.post<any>(
            `${CLIK_URL}/get_signed_url_video`,
            { values: { count: 1 } },
            { withCredentials: true }
        );
        const holder = response.data?.holder;
        if (!holder || holder.length !== 1) {
            throw new Error("Invalid signed URL response.");
        }
        const signedUrl = holder[0];
        const { urlVideo } = signedUrl || {};
        if (!urlVideo) throw new Error("No signed URL returned from server.");

        const uploadResponse = await axios.put(urlVideo, file, {
            headers: { "Content-Type": file.type || "video/mp4" },
        });
        if (uploadResponse.status !== 200 && uploadResponse.status !== 204) {
            throw new Error(`Video upload failed with status ${uploadResponse.status}`);
        }
        return urlVideo.split("?")[0];
    }, [CLIK_URL]);

    // Toggle whether the uploaded reference video is in use for this scene.
    const toggleReferenceVideoActive = useCallback(() => {
        const safeIndex = Math.max(0, Number(index || 0));
        setReferenceVideoActiveList?.((prev: boolean[] = []) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            while (next.length <= safeIndex) next.push(false);
            next[safeIndex] = !next[safeIndex];
            return next;
        });
    }, [index, setReferenceVideoActiveList]);

    const handleAddVideoClick = useCallback(() => {
        if (isRefVideoUploading) return;
        // Once a video exists, the button toggles "Use Vid" <-> "Using Vid".
        // With no video yet, it opens the file picker.
        if (hasReferenceVideo) {
            toggleReferenceVideoActive();
            return;
        }
        refVideoInputRef.current?.click();
    }, [isRefVideoUploading, hasReferenceVideo, toggleReferenceVideoActive]);

    const handleReferenceVideoFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const safeIndex = Math.max(0, Number(index || 0));
        const file = event.target.files?.[0];
        // Reset the input so picking the same file again still fires onChange.
        if (event.target) event.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("video/")) {
            globalErrorEmitter.emit("Please choose a video file.", safeIndex);
            return;
        }
        if (file.size > REF_VIDEO_MAX_BYTES) {
            globalErrorEmitter.emit("Video is too large (max 100MB).", safeIndex);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        try {
            const duration = await readVideoDuration(objectUrl);
            if (duration > REF_VIDEO_MAX_SECONDS + 0.5) {
                globalErrorEmitter.emit("Video is too long (max 15 seconds).", safeIndex);
                return;
            }

            setIsRefVideoUploading(true);
            const uploadedUrl = await uploadReferenceVideoToS3(file);
            // Register for later cleanup so it doesn't live in S3 forever.
            SaveVideoHelperForDelLater(uploadedUrl);

            setReferenceVideoUrls?.((prev: string[] = []) => {
                const next = Array.isArray(prev) ? [...prev] : [];
                while (next.length <= safeIndex) next.push("");
                next[safeIndex] = uploadedUrl;
                return next;
            });
        } catch (err: any) {
            globalErrorEmitter.emit(err?.message || "Could not upload reference video.", safeIndex);
        } finally {
            setIsRefVideoUploading(false);
            URL.revokeObjectURL(objectUrl);
        }
    }, [index, readVideoDuration, uploadReferenceVideoToS3, setReferenceVideoUrls]);

    const handleRemoveReferenceVideo = useCallback(() => {
        const safeIndex = Math.max(0, Number(index || 0));
        setReferenceVideoUrls?.((prev: string[] = []) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            while (next.length <= safeIndex) next.push("");
            next[safeIndex] = "";
            return next;
        });
        setReferenceVideoActiveList?.((prev: boolean[] = []) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            while (next.length <= safeIndex) next.push(false);
            next[safeIndex] = false;
            return next;
        });
        setIsRefVideoModalOpen(false);
    }, [index, setReferenceVideoUrls, setReferenceVideoActiveList]);

    const handleLipsyncTrim = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const safeIndex = Math.max(0, Number(index || 0));

        // If audio exists, toggle the ACTIVE state instead of re-trimming
        if (hasLipSyncAudio) {
            // const LIPSYNC_BASE_PROMPT = "speaking to camera"; // (disabled) prompt auto-swap
            const wasActive = Array.isArray(lipSyncActiveList) ? !!lipSyncActiveList[safeIndex] : false;
            const turningOn = !wasActive;

            setLipSyncActiveList?.((prev: boolean[] = []) => {
                const next = Array.isArray(prev) ? [...prev] : [];
                while (next.length <= safeIndex) next.push(false);
                next[safeIndex] = !next[safeIndex];
                return next;
            });

            if (turningOn) {
                /* ---- DISABLED: auto-swap video prompt to base cue (uncomment to re-enable) ----
                // Save the user's current prompt for this scene, then drop in the editable base cue.
                const currentPrompt = videotxt || "";
                setLipSyncPromptBackup?.((prev: string[] = []) => {
                    const next = Array.isArray(prev) ? [...prev] : [];
                    while (next.length <= safeIndex) next.push("");
                    next[safeIndex] = currentPrompt;
                    return next;
                });
                setvideotxt(LIPSYNC_BASE_PROMPT);
                setTextVideo?.((prev: any[] = []) => {
                    const next = Array.isArray(prev) ? [...prev] : [];
                    while (next.length <= safeIndex) next.push("");
                    next[safeIndex] = LIPSYNC_BASE_PROMPT;
                    return next;
                });
                ---- end disabled ---- */
                // Lip-sync only supports audio-capable models. If a non-audio model was
                // already selected, auto-switch to SeeDance 2.0 (Pro) so a non-audio model
                // can never carry through and the audio always flows.
                const audioModels = ["Pro", "Minix", "Omni"];
                if (!audioModels.includes(videModel)) {
                    setvideModel?.("Pro");
                    setbutton?.("Pro");
                    setSelectedModel?.("Pro");
                }
            } else {
                /* ---- DISABLED: restore original prompt on lip-sync off (uncomment to re-enable) ----
                // Restore the user's original prompt (or empty if there wasn't one).
                const restored = (Array.isArray(lipSyncPromptBackup) ? lipSyncPromptBackup[safeIndex] : "") || "";
                setvideotxt(restored);
                setTextVideo?.((prev: any[] = []) => {
                    const next = Array.isArray(prev) ? [...prev] : [];
                    while (next.length <= safeIndex) next.push("");
                    next[safeIndex] = restored;
                    return next;
                });
                ---- end disabled ---- */
            }
            return;
        }

        try {
            await createLipSyncAudio();
        } catch {
            // createLipSyncAudio already emits the user-facing error.
        }
    }, [
        createLipSyncAudio,
        currentMusicSnippet,
        index,
        isLipSyncAudioTrimming,
        musicMode,
        musicModeUrl,
        setLipSyncAudioUrls,
        stopSnippetPreview,
        hasLipSyncAudio,
        setLipSyncActiveList,
        lipSyncActiveList,
        lipSyncPromptBackup,
        setLipSyncPromptBackup,
        videotxt,
        setvideotxt,
        setTextVideo,
        videModel,
        setvideModel,
        setbutton,
        setSelectedModel,
    ]);


    const [worldModelsInuse, setWorldModelsInuse] = useState(false);


    useEffect(() => {

        setSeconds(time)
    }, [time])

    const [seconds, setSeconds] = useState(time);          // t
    const [method, setMethod] = useState<"exact" | "approx">("exact");
    const [imagesPerDollar, setImagesPerDollar] = useState(333); // I$
    const [pixelsPerImage, setPixelsPerImage] = useState(1);     // k
    const [rounding, setRounding] = useState<"round" | "floor" | "ceil" | "none">("round");


    const [isNotepadOpen, setIsNotepadOpen] = useState(false);
    const [isNotepadOpen2, setIsNotepadOpen2] = useState(false);
    const [isNotepadOpen3, setIsNotepadOpen3] = useState(false);
    const [isNotepadOpen4, setIsNotepadOpen4] = useState(false);
    const [isNotepadOpen5, setIsNotepadOpen5] = useState(false);
    const [isNotepadOpen6, setIsNotepadOpen6] = useState(false);
    // Default to Stories (1)

    enum ContentType {
        STORIES = 1,
        DOCUMENTARY = 2,
        MEMES = 3,
    }

    type Props = {
        value: ContentType;
        onChange: (val: ContentType) => void;
        disabled?: boolean;
    };

    const SHORT_LONG = {
        Mini: { short: 5, long: 10 },
        Pro: { short: 5, long: 10 },
        Prox: { short: 5, long: 10 },
        Proxx: { short: 5, long: 10 },
        Proxxx: { short: 5, long: 10 },
        pPro: { short: 5, long: 10 },
        Minix: { short: 5, long: 10 },
        _def: { short: 5, long: 10 },
    } as const;

    const getPair = (model: string) =>
        model === "Mini" ? SHORT_LONG.Mini
            : model === "Pro" ? SHORT_LONG.Pro
                : model === "Prox" ? SHORT_LONG.Prox
                    : model === "Proxx" ? SHORT_LONG.Proxx
                        : model === "Proxxx" ? SHORT_LONG.Proxxx
                            : model === "pPro" ? SHORT_LONG.pPro
                                : model === "Minix" ? SHORT_LONG.Minix
                                    : SHORT_LONG._def;

    const isLong = (v: number) => v === 8 || v === 10;

    const isUsableVideoEntry = (value: any) => {
        if (!value) return false;
        if (typeof Blob !== "undefined" && value instanceof Blob) return value.size > 0;
        if (typeof value !== "string") return true;

        const trimmed = value.trim();
        return (
            trimmed !== "" &&
            trimmed !== "EMPTY" &&
            trimmed !== "EMPTY_BSHOT" &&
            trimmed !== "undefined" &&
            trimmed !== "null"
        );
    };

    const toggleTime = useCallback(() => {
        if (isMusicVideoTimingLocked) return;

        const hasGeneratedVideo = [VideoArray, VideoArrayBlob, VideoArrayCloud]
            .some((entries) => Array.isArray(entries) && entries.some(isUsableVideoEntry));

        if (hasGeneratedVideo && pageType !== 3) return;

        const { short, long } = getPair(videModel);

        setTime(prev => (prev === short ? long : short));
    }, [VideoArray, VideoArrayBlob, VideoArrayCloud, pageType, videModel, isMusicVideoTimingLocked]);

    useEffect(() => {
        if (isMusicVideoTimingLocked) {
            setTime(lockedMusicTime);
            return;
        }

        setTime(prev => {
            const { short, long } = getPair(videModel);
            // If previous was long (8 or 10), stay long but map to this model's long.
            // Otherwise, force this model's short.
            return isLong(prev) ? long : short;
        });
    }, [videModel, button, SelectedModel, isMusicVideoTimingLocked, lockedMusicTime]);

    useEffect(() => {
        if (!isMusicVideoTimingLocked) return;
        setTime(lockedMusicTime);
    }, [isMusicVideoTimingLocked, lockedMusicTime]);




    const GRADIENTt = "linear-gradient(90deg, #39FF14, #FFFF33, #FF2400)";

    const [Caret, setCaret] = useState(0);

    const handlePromptShellCaret = (e: any) => {
        const el: any = e.target;

        if (!el || typeof el.selectionStart !== "number") {
            // fallback if something weird gets focused
            return 0;
        }

        const caretIndex = el.selectionStart ?? 0;

        // ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Â° use this however you want:
        console.log("caretIndex:", caretIndex);

        setCaret(caretIndex);

        ///alert( caretIndex);

        // setShellCaretIndex(caretIndex); // if you have state for it

        return caretIndex;
    };





    useEffect(() => {


        if (VideMode) {
            //  setSelectti(false);
            setSelectedModel('');
            setvideModel("");
            setbutton("");

        } else {

            setnarrate(0)
        }


    }, [VideMode])

    useEffect(() => {
        if (startEdit && isBShotGridContext) {
            const trueImage = ImagesHdCloud && ImagesHdCloud[index];
            const hasImage = trueImage && trueImage !== "EMPTY" && trueImage !== "EMPTY_BSHOT";
            if (!hasImage) {
                setnarrate(0);
            }
        }
    }, [startEdit, isBShotGridContext, parentSceneIndex, bIndex]);

    // inside your component
    useEffect(() => {
        if (typeof finishLoader === 'function') {
            // setGeneratingAt(index, false); finishLoader(index, true); // Removed to prevent loader vanishing on swipe
        }
    }, [CreationMode, index]);




    // Capture the last frame (~duration - offsetSeconds) of a video URL as a Blob
    function captureLastFrameBlobFromVideo(
        videoUrl: string,
        offsetSeconds: number = 0.02
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            video.src = videoUrl;
            video.crossOrigin = "anonymous";   // important if your video is on another origin
            video.muted = true;
            video.playsInline = true;

            const onError = () => {
                reject(new Error("Error loading video for frame capture."));
            };

            video.addEventListener("error", onError);

            video.addEventListener("loadedmetadata", () => {
                if (!isFinite(video.duration) || video.duration <= 0) {
                    reject(new Error("Invalid video duration."));
                    return;
                }

                const captureTime = Math.max(0, video.duration - offsetSeconds);

                const onSeeked = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = video.videoWidth || 1080;
                    canvas.height = video.videoHeight || 1920;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("Canvas 2D context not available."));
                        return;
                    }

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error("Failed to create blob from canvas."));
                            } else {
                                resolve(blob);
                            }
                        },
                        "image/webp",   // you can change to "image/jpeg" if you want
                        0.95
                    );
                };

                video.addEventListener("seeked", onSeeked, { once: true });
                video.currentTime = captureTime;
            });
        });
    }

    const fetchAndGenerateImage = useCallback(
        async (indexv: any, textPrompt: any, type: any) => {
            settextVidUpdate('');

            if (videModel === '') {
                globalErrorEmitter.emit("Please, Select a model ðŸ˜¢", 0);
                return;
            }

            const baseLength = Array.isArray(ImagesHdCloud) ? ImagesHdCloud.length : 0;

            // Check if all corresponding indices for the base images in TextVideo are empty
            const allBaseTextEmpty =
                baseLength > 0 &&
                Array.from({ length: baseLength }).every((_, i) => {
                    const val = TextVideo?.[i];
                    return !val || String(val).trim() === '';
                });

            // Helper to generate for a single index
            const generateForSingleIndex = async (idx: number, shouldEdit: boolean) => {
                console.log("ðŸ”¥ EDITSTORY AUTO PROMPT CLICKED! Index:", idx);
                console.log("ðŸ”¥ EDITSTORY PlanVid currently is:", PlanVid);

                setloadPrompt((prev: any) => {
                    const next = [...prev];
                    next[idx] = true;
                    return next;
                });

                //alert(GeneratedText[idx])
                try {
                    const nativeIndex = toNativeSlot(idx);
                    const imageDescription = String(
                        GeneratedText?.[idx] || GeneratedTextx?.[idx] || steps?.[idx] || prompt ||
                        "Animate the supplied image faithfully."
                    ).trim();
                    const question = String(
                        stepsx?.[nativeIndex] || steps?.[idx] || prompt || imageDescription
                    ).trim();

                    const requestData: any = {
                        imageDescription,
                        // stepsx is NATIVE (per A-shot slot); idx may be a unified index.
                        // A B-shot card resolves to its parent A-shot slot's story beat.
                        question,
                        // A single scene does not need a completed global plan to obtain a motion prompt.
                        PlanVid: PlanVid || { characters: [], storyContext: question },
                        duration: time,
                        targetModel: videModel,
                        ratioKey: ratioKey,
                        suppressDialogue: false
                    };

                    // noImagePrompt is NATIVE; ImagesHdCloud is unified â€” use the right space for each
                    if (!noImagePrompt[nativeIndex]) {
                        requestData.imageUrl = ImagesHdCloud[idx];
                    }

                    let k = musicKling ? 'VideoDesign' : 'GptVideoVisualMiniMax';
                    console.log("=== AUTO PROMPT CLIENT-SIDE (EditStory.tsx) PARAMETERS AND DATA SENT ===");
                    console.log("Index (idx):", idx);
                    console.log("Endpoint Name (k):", k);
                    console.log("Suppress dialogue:", requestData.suppressDialogue);
                    console.log("Request Payload (requestData):", JSON.stringify(requestData, null, 2));

                    const response = await axios.post<any>(
                        `${CLIK_URL}/${k}`,
                        requestData,
                        { withCredentials: true, timeout: 900000 }
                    );

                    const datax = response.data;
                    console.log("=== AUTO PROMPT CLIENT-SIDE (EditStory.tsx) RESPONSE RECEIVED ===");
                    console.log("Response Status:", response.status);
                    console.log("Response Data (datax):", JSON.stringify(datax, null, 2));

                    const visualPromptText = datax.storyPrompt;

                    setTextVideo((prev: any) => {
                        const next = [...prev];
                        next[idx] = visualPromptText;
                        return next;
                    });

                    // Only run edit hook for explicit re-generation (not for initial auto prompts)
                    if (shouldEdit) {
                        EditGeneratedVisualTextOnlyFn(idx, textPrompt, visualPromptText, 0);
                    }
                } catch (error: any) {
                    setGeneratingAt(idx, false);
                    finishLoader(idx);

                    if (error.response) {
                        const message = error.response.data?.message || "Server rejected the Auto Prompt request.";
                        console.error('Server Error:', error.response.data);
                        globalErrorEmitter.emit(`Auto Prompt failed: ${message}`, idx);
                    } else if (error.request) {
                        console.error('No response received:', error.request);
                        globalErrorEmitter.emit("Auto Prompt failed: no response from the server.", idx);
                    } else {
                        console.error('Error:', error.message);
                        globalErrorEmitter.emit(`Auto Prompt failed: ${error.message || "unexpected error"}.`, idx);
                    }
                } finally {
                    setloadPrompt((prev: any) => {
                        const next = [...prev];
                        next[idx] = false;
                        return next;
                    });
                }
            };

            // If all base TextVideo entries are empty, generate for ALL indices (initial load)
            if (allBaseTextEmpty && baseLength > 0) {
                for (let i = 0; i < baseLength; i++) {
                    await generateForSingleIndex(i, false); // no edit on initial auto prompts
                }
            } else {
                // Normal behavior: generate only for the requested index
                const shouldEdit = type === 1;
                await generateForSingleIndex(indexv, shouldEdit);
            }
        },
        [
            prompt,
            GeneratedText,
            GeneratedTextx,
            steps,
            stepsx,
            PlanVid,
            videModel,
            ImagesHdCloud,
            videotxt,
            PostId,
            modelz,
            pixelsV,
            textVidUpdate,
            TextVideo, // <-- ensure TextVideo is included
            time,
            musicKling,
            noImagePrompt,
            toNativeSlot
        ]
    );


    const GRADIENTx =
        darkModeReducer ?
            "linear-gradient(90deg, yellow 0%, yellow 100%)" :
            "linear-gradient(90deg, #ff8a00 0%, red 100%)";



    const GRADIENTxx =
        darkModeReducer ?
            "linear-gradient(90deg, yellow 0%, yellow 100%)" :
            "linear-gradient(90deg, darkred 0%, red 100%)";







    async function convertToHDWebpOrJpegByDevicex(
        inputBlob: Blob,
        modelx: any,
        ratioKeyx: any
    ): Promise<Blob> {
        const reader = new FileReader();
        return new Promise<Blob>((resolve, reject) => {
            reader.onerror = e => reject(e);
            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();
                img.onerror = e => reject(e);
                img.onload = () => {
                    // 1) pick target dims
                    const [tW, tH] =
                        (modelx === "Gpt Imagejjj")
                            ? (
                                ratioKeyx === 1 ? [1024, 1536] :   // 9:16
                                    ratioKeyx === 2 ? [1024, 1024] :   // 1:1
                                        ratioKeyx === 3 ? [1536, 1024] :   // 16:9
                                            [1024, 1536]                       // fallback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 9:16
                            )
                            : (
                                ratioKeyx === 1 ? [1080, 1920] :   // 9:16
                                    ratioKeyx === 2 ? [1080, 1080] :   // 1:1
                                        ratioKeyx === 3 ? [1920, 1080] :   // 16:9
                                            [1080, 1920]                       // fallback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 9:16
                            );


                    // 2) compute crop box in source to match target aspect ratio
                    const srcW = img.width;
                    const srcH = img.height;
                    const srcRatio = srcW / srcH;
                    const tgtRatio = tW / tH;

                    let sx: number, sy: number, sW: number, sH: number;
                    if (srcRatio > tgtRatio) {
                        // source is wider -> crop sides
                        sH = srcH;
                        sW = srcH * tgtRatio;
                        sx = (srcW - sW) / 2;
                        sy = 0;
                    } else {
                        // source is taller -> crop top/bottom
                        sW = srcW;
                        sH = srcW / tgtRatio;
                        sx = 0;
                        sy = (srcH - sH) / 2;
                    }

                    // 3) draw into canvas
                    const canvas = document.createElement("canvas");
                    canvas.width = tW;
                    canvas.height = tH;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Canvas 2D context unavailable."));
                    }
                    ctx.drawImage(
                        img,
                        sx, sy, sW, sH,     // source crop
                        0, 0, tW, tH        // destination
                    );

                    // 4) choose format
                    const format = isIphone() ? "image/jpeg" : "image/webp";

                    // 5) export
                    canvas.toBlob(
                        blobOut => {
                            if (blobOut) resolve(blobOut);
                            else reject(new Error("toBlob returned null"));
                        },
                        format,
                        0.8
                    );
                };
                img.src = imageUrl;
            };
            reader.readAsDataURL(inputBlob);
        });
    }

    ///Imagen

    async function convertToHDWebpOrJpegByDeviceHdx(
        inputBlob: Blob,
        modelx: any,
        ratioKeyx: any
    ): Promise<Blob> {
        const reader = new FileReader();
        return new Promise<Blob>((resolve, reject) => {
            reader.onerror = e => reject(e);
            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();
                img.onerror = e => reject(e);
                img.onload = () => {
                    const [tW, tH] =
                        (modelx === "Gpt Imagelllll")
                            ? (
                                ratioKeyx === 1 ? [1024, 1536] :   // 9:16
                                    ratioKeyx === 2 ? [1024, 1024] :   // 1:1
                                        ratioKeyx === 3 ? [1536, 1024] :   // 16:9
                                            [1024, 1536]                       // fallback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 9:16
                            )
                            : (
                                ratioKeyx === 1 ? [1080, 1920] :   // 9:16
                                    ratioKeyx === 2 ? [1080, 1080] :   // 1:1
                                        ratioKeyx === 3 ? [1920, 1080] :   // 16:9
                                            [1080, 1920]                       // fallback ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 9:16
                            );




                    const srcW = img.width;
                    const srcH = img.height;
                    const srcRatio = srcW / srcH;
                    const tgtRatio = tW / tH;

                    let sx: number, sy: number, sW: number, sH: number;
                    if (srcRatio > tgtRatio) {
                        sH = srcH;
                        sW = srcH * tgtRatio;
                        sx = (srcW - sW) / 2;
                        sy = 0;
                    } else {
                        sW = srcW;
                        sH = srcW / tgtRatio;
                        sx = 0;
                        sy = (srcH - sH) / 2;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = tW;
                    canvas.height = tH;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Canvas 2D context unavailable."));
                    }
                    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, tW, tH);

                    // HD version you wanted as PNG on all devices
                    const format = "image/png";

                    canvas.toBlob(
                        blobOut => {
                            if (blobOut) resolve(blobOut);
                            else reject(new Error("toBlob returned null"));
                        },
                        format,
                        0.8
                    );
                };
                img.src = imageUrl;
            };
            reader.readAsDataURL(inputBlob);
        });
    }


    // ... inside your JSX return ...



    const onFileChange = async (e: any) => {
        const file = e.target.files?.[0]
        if (!file) return

        const bShotSaveContext = getBShotSaveContextSnapshot(textValue);

        //  alert('kk');
        // 1) load original blob
        const originalBlob = file

        // 2) convert low-res
        const blob = await convertToHDWebpOrJpegByDevicex(originalBlob, modelz, ratioKey)
        // create a preview URL
        const url = URL.createObjectURL(blob)

        // 3) convert high-res
        const blobHd = await convertToHDWebpOrJpegByDeviceHdx(originalBlob, modelz, ratioKey)

        // 4) delegate to your updater
        handleUpdateFluxImage(blob, url, blobHd, index, 1, bShotSaveContext)


    }

    // const handleClearContext = useCallback(() => {


    const handleToggleContext = useCallback((isDirect: boolean) => {
        // noImagePrompt is NATIVE-indexed
        setnoImagePrompt((prev: any) => {
            const next = [...prev];
            next[nativeSlotIndex] = isDirect;
            return next;
        });

        // Optional: If turning direct mode ON, you might want to clear the cloud/local image state too
        // so it doesn't linger visually if they switch back without re-selecting.
        // But keeping it allows them to toggle back and forth without losing the selection.
        // Your choice. For now, we just toggle the flag.

        console.log(`Context mode for native slot ${nativeSlotIndex}: ${isDirect ? "Direct" : "Image Context"}`);
    }, [index, nativeSlotIndex]);

    const onImageUrlChange = async (imageUrl: string, type: number) => {

        if (!imageUrl) return;

        const bShotSaveContext = getBShotSaveContextSnapshot(textValue);


        try {
            // 1) FETCH THE IMAGE & CONVERT TO BLOB
            // We must fetch the URL to get the actual binary data
            const response = await fetch(imageUrl);
            const originalBlob = await response.blob();

            // -------------------------------------------------------
            // FROM HERE DOWN, IT IS IDENTICAL TO YOUR ORIGINAL CODE
            // -------------------------------------------------------

            // 2) convert low-res
            const blob = await convertToHDWebpOrJpegByDevicex(originalBlob, modelz, ratioKey);

            // create a preview URL
            // Note: You can reuse the incoming imageUrl if you want,
            // but creating a new ObjectURL ensures consistency with your upload flow
            const url = URL.createObjectURL(blob);

            // 3) convert high-res
            const blobHd = await convertToHDWebpOrJpegByDeviceHdx(originalBlob, modelz, ratioKey);

            // 1) Delete old cloud image if it exists
            const oldCloudUrl =
                isArrayMode
                    ? ImagesHdCloud?.[index]
                    : ImagesHdCloud?.[0]; // optional: handle single mode via index 0

            if (type === 0) {


            } else {

                //  alert('hh');

            }

            Saveprompthelperfordellater(oldCloudUrl);
            if (!matchMobile) setShow(false);
            // 4) delegate to your updater
            handleUpdateFluxImage(blob, url, blobHd, index, 1, bShotSaveContext);

        } catch (error) {
            console.error("Failed to process image URL:", error);
            globalErrorEmitter.emit("Could not load image data. Check CORS settings if this is an external URL.", index);
        }
    };




    const runWanAnimate = useCallback(async () => {
        const bShotSaveContext = getBShotSaveContextSnapshot(videotxt);

        try {

            setGeneratingAt(0, true);

            startLoader(0)


            // 1) Grab the motion source video from VideoArrayCloud[2]
            const motionVideoUrl = VideoArrayCloud?.[2];
            if (!motionVideoUrl) {
                console.error("No motion source video in VideoArrayCloud[2]");
                return;
            }

            // 2) Character image URL ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ e.g. generatedImagesFlux[0]
            const characterImageUrl = ImagesHdCloud?.[0];
            if (!characterImageUrl) {
                console.error("No character image URL for WAN Animate");
                return;
            }

            // 3) Call your backend WAN Animate route
            const response = await axios.post(
                `${CLIK_URL}/wanAnimateRoute`,   // <-- match your Express route path
                {
                    video: motionVideoUrl,
                    characterImage: characterImageUrl,
                    // optional extras (all match backend wanAnimateRoute inputs):
                    goFast: false,
                    // referFrames: 1,        // 1 or 5
                    // resolution: "720",     // default
                    // mergeAudio: true,
                    // fps: 24,
                    seed: Seed,
                },
                { timeout: 1900000 }
            );

            let { videoBase64, meta, status, jobId, provider, modelEndpoint } = response.data as any;

            if (status === "starting" && jobId && provider) {
                let attempts = 0;
                while (attempts < 480) { // Max ~40 min (480 * 5s)
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    try {
                        const pollRes = await axios.post(`${CLIK_URL}/pollVideoStatus`, { jobId, provider, modelEndpoint });
                        const pollData = pollRes.data as any;
                        if (pollData.status === "succeeded") {
                            videoBase64 = pollData.videoBase64;
                            meta = pollData.meta || meta;
                            break;
                        } else if (pollData.status === "failed" || pollData.status === "canceled") {
                            throw new Error("HARD_FAIL:" + (pollData.error || "Video generation failed"));
                        }
                    } catch (e: any) {
                        if (e.message && String(e.message).startsWith("HARD_FAIL:")) {
                            throw new Error(String(e.message).replace("HARD_FAIL:", ""));
                        }
                        console.warn("Transient polling error (retrying...):", e.message);
                        // Continuing the loop instead of breaking
                    }
                }
            }

            if (!videoBase64) {
                console.error("WAN Animate returned no videoBase64");
                return;
            }

            // Convert the base64 string into a Blob and then create an Object URL.
            const blob = await base64ToBlob(videoBase64);
            const videoObjectUrl = URL.createObjectURL(blob);

            // Save the object URL so that the video can be displayed del.



            console.log('vid', videoObjectUrl);




            setVideoArray((prev: any) => {
                const next = [...prev];
                next[0] = videoObjectUrl;
                return next;
            });

            setVideoArrayBlob((prev: any) => {
                const nextx = [...prev];
                nextx[0] = blob;
                return nextx;
            });




            /// setPollStatus("Success!");

            // Upload and save before marking the video slot finished.
            await GenerateSignedUrlForVideo(blob, 0, videoObjectUrl, bShotSaveContext);

            setGeneratingAt(0, false);
            finishLoader(0)

            console.log("WAN Animate meta:", meta);
        } catch (err) {
            setGeneratingAt(0, false);
            finishLoader(0, true);
            console.error("Error calling wanAnimateRoute:", err);
        } finally {
            // setAnimating(false);
        }
    }, [VideoArrayCloud, ImagesHdCloud, CLIK_URL, setVideoArrayCloud, CreationMode]);





    // Helper to convert a base64 data-URI to a Blob
    async function base64ToBlob(base64Data: string): Promise<Blob> {
        // base64Data should look like: "data:video/mp4;base64,AAAA..."
        const res = await fetch(base64Data);
        return res.blob();
    }

    const handleUpscale = async (idx: number) => {
        if (!ImagesHdCloud || !ImagesHdCloud[idx]) {
            alert("No cloud image found to upscale.");
            return;
        }

        setIsUpscaling(prev => {
            const next = Array.isArray(prev) ? [...prev] : [];
            next[idx] = true;
            return next;
        });

        try {
            const currentUrl = ImagesHdCloud[idx];
            // alert('Upscaling...');
            const response = await axios.post(`${CLIK_URL}/upscaleImage`, {
                url: currentUrl
            });

            const newUrl = (response.data as any).url;

            // Update cloud array
            if (setImagesHdCloud) {
                setImagesHdCloud((prev: any) => {
                    const next = [...prev];
                    next[idx] = newUrl;
                    return next;
                });
            }

            // Update local display
            if (setGeneratedImagesFlux) {
                setGeneratedImagesFlux((prev: any) => {
                    const next = [...prev];
                    next[idx] = newUrl;
                    return next;
                });
            }

            if (type === 1) {
                if (setFluxIm) setFluxIm(newUrl);
            }


        } catch (error) {
            console.error("Upscale failed", error);
            alert("Upscale failed. Please try again.");
        } finally {
            setIsUpscaling(prev => {
                const next = Array.isArray(prev) ? [...prev] : [];
                next[idx] = false;
                return next;
            });
        }
    };



    // i = which scene / which block you're editing
    const EditGeneratedVisualTextOnlyFn = useCallback(
        async (i: number, textVidUpdatex: any, TextV: any, r: any) => {
            // pull the values for this index
            setloadersPrompt((prev: any) => {
                const next = [...prev];
                next[i] = true;
                return next;
            });

            const createdvisual = TextV;
            const question = stepsx[toNativeSlot(i)];                 // The story lore/action beat (stepsx is NATIVE-indexed)
            const imageDescription = GeneratedText[i];  // The visual ground truth
            const editvalue = textVidUpdatex;

            if (!createdvisual || !question || !editvalue) {
                alert("Missing edit info for this item.");
                setloadersPrompt((prev: any) => {
                    const next = [...prev];
                    next[i] = false;
                    return next;
                });
                return;
            }

            try {
                // build request body for backend
                const payload = {
                    editvalue,         // what change the user wants (e.g., "make it rain")
                    createdvisual,     // the full prompt we want to surgically edit
                    question,          // story context
                    imageDescription,   // Ground truth to prevent context leak
                    targetModel: videModel,
                    duration: time,
                    ratioKey: ratioKey,
                    imageUrl: ImagesHdCloud[i]
                };

                if (r === 1) {
                    settextVidUpdate('');
                }

                // call backend
                const response = await axios.post(
                    `${CLIK_URL}/EditGeneratedVisualTextOnly`,
                    payload,
                    { timeout: 90000 } // 90s safety, adjust if needed
                );

                if (response.status !== 200) {
                    throw new Error(`Server error: ${response.status}`);
                }

                let updatedPrompt = response.data;

                // Handle if Axios auto-parsed our Kling Array into a JS object
                if (typeof updatedPrompt === "object" && updatedPrompt !== null) {
                    updatedPrompt = JSON.stringify(updatedPrompt, null, 2);
                }

                if (!updatedPrompt || typeof updatedPrompt !== "string") {
                    throw new Error("No updated prompt returned from server");
                }

                // Save updated prompt locally in state
                setTextVideo((prev: any) => {
                    const next = [...prev];
                    next[i] = updatedPrompt;
                    return next;
                });

                console.log("Edited prompt for index", i, "=>", updatedPrompt);

                // done loading
                setloadersPrompt((prev: any) => {
                    const next = [...prev];
                    next[i] = false;
                    return next;
                });

            } catch (err) {
                setloadersPrompt((prev: any) => {
                    const next = [...prev];
                    next[i] = false;
                    return next;
                });
                console.error("Error editing visual prompt:", err);

                // stop loading on error (if you still use these)
                // setGeneratingAt(i, false);
                // finishLoader(i, true);

                alert("Couldn't update this prompt.");
            }
        },
        [
            CLIK_URL,
            TextVideo,
            stepsx,
            GeneratedText, // Added dependency
            textVidUpdate,
            setGeneratingAt,
            startLoader,
            finishLoader,
            settextVidUpdate,
            time,
            videoArrayLastFrame,
            musicKling,
            noImagePrompt,
            toNativeSlot
        ]
    );

    const GenerateVideox = useCallback(
        async (i: number, overridePrompt?: string, overrideAudio?: boolean) => {
            console.log("ðŸ”¥ [1] GenerateVideox Entry:", {
                index: i,
                isBShotModeActive,
                overridePrompt,
                videModel,
                animateState,
                currentVideoArrayCloudVal: VideoArrayCloud[i]
            });




            if (!videModel && animateState === 0) return;

            const actualPrompt = overridePrompt !== undefined ? overridePrompt : videotxt;
            const bShotSaveContext = getBShotSaveContextSnapshot(actualPrompt || "");
            let maxLength = 0;
            if (videModel === 'Prox') {
                maxLength = 2048;
            } else if (videModel === 'pPro') {
                maxLength = 2500;
            }

            if (maxLength > 0 && actualPrompt && typeof actualPrompt === 'string' && actualPrompt.length > maxLength) {
                globalErrorEmitter.emit(`ðŸ˜¢ Prompt too long for this model. Limit is ${maxLength} characters, but yours is ${actualPrompt.length}.`, i);
                return;
            }

            var pxx = pixelsV

            if (animateState > 0) {
                // Kling O3 Standard Pricing ($0.252/sec @ 333px/$)
                if (time === 10) {
                    pxx = 839;
                } else if (time === 8) {
                    pxx = 671;
                } else if (time === 6) {
                    pxx = 503;
                } else {
                    // Default to 5 seconds
                    pxx = 420;
                }
            }

            if (pixels >= pxx) {

                /// alert(pixelsV);





                // 1) Grab the motion source video from VideoArrayCloud[2]
                const motionVideoUrl = trimmedVideoUrl;





                /// setIsGenerating(true);

                setGeneratingAt(i, true);

                startLoader(i)


                setTextVideo((prev: any) => {
                    const next = [...prev];
                    next[i] = videotxt;
                    return next;
                });



                try {
                    ///   setIsSubmitting(true);
                    ///  setPollStatus("Generating Kling video. This can take up to 3 minutes...");

                    // Use overrides if provided, else fall back to state
                    const actualPrompt = overridePrompt !== undefined ? overridePrompt : videotxt;
                    const actualAudio = overrideAudio !== undefined ? overrideAudio : musicKling;

                    const sceneActiveMotions = activeMotionImagesMap[i] || [];
                    const sceneActiveActions = activeActionImagesMap[i] || [];
                    const allSceneActiveChars = [
                        ...(activeCharsForScene || []),
                        ...sceneActiveMotions,
                        ...sceneActiveActions
                    ];

                    const extractedCharacterUrls = allSceneActiveChars
                        .map((c: any) => c.image || c.imageUrl || c.url)
                        .filter((u: any) => u && typeof u === 'string' && u.trim() !== '');
                    const extractedCharacterNames = allSceneActiveChars;

                    // Prepare the payload.
                    // noImagePrompt is NATIVE-indexed; i/ImagesHdCloud are unified-indexed.
                    var payload: any = {
                        prompt: actualPrompt,
                        startImage: noImagePrompt[toNativeSlot(i)] ? null : ImagesHdCloud[i],
                        videoLength: time,
                        ty: ratioKey,
                        model: modelz,
                        generateAudio: actualAudio,
                        generate_audio: actualAudio,
                        useaudio: actualAudio,

                        duration: time,
                        video: trimmedVideoUrl,
                        characterImage: ImagesHdCloud[i],
                        // optional extras (all match backend wanAnimateRoute inputs):
                        goFast: false,
                        // referFrames: 1,        // 1 or 5
                        // resolution: "720",     // default
                        // mergeAudio: true,
                        // fps: 24,
                        seed: Seed,
                        activechracterimages: extractedCharacterUrls,
                        activechracternames: extractedCharacterNames,
                        asyncMode: true


                    };

                    setSelectedModel(videModel);

                    var k = 'minimax23Route';

                    setClipDurations((prevx: any) => {
                        const next = [...prevx];
                        next[1] = 1;
                        return next;
                    });



                    if (videModel === 'Mini') {


                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (!musicKling) {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 1;
                                return next;
                            });
                        }

                        //200
                        k = 'veo3fast';
                    }

                    else if (videModel === 'Minix') {

                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (!musicKling) {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 1;
                                return next;
                            });
                        }


                        k = 'sora2';
                    } else if (videModel === 'Proxx') {


                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (!musicKling) {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 1;
                                return next;
                            });
                        }

                        k = 'minimax23Route';
                    }

                    else if (videModel === 'pPro') {


                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (!musicKling) {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 1;
                                return next;
                            });
                        }


                        k = 'Seedance2';
                    }

                    else if (videModel === 'Proxxx') {


                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (!musicKling) {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 1;
                                return next;
                            });
                        }

                        k = 'KlingRouteo1';
                    }
                    else if (videModel === 'Prox') {


                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (musicKling) {


                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        }



                        k = 'minimax23Routex';
                    }
                    else if (videModel === 'Omni') {
                        // bytedance/omni-human-1.5 â€” audio-driven digital-human lip-sync.
                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        k = 'omniHuman';
                    } else {
                        setClipDurations((prevx: any) => {
                            const next = [...prevx];
                            next[0] = time;
                            return next;
                        });

                        if (!musicKling) {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });
                        } else {
                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 1;
                                return next;
                            });
                        }

                        k = 'klingPro';
                    }

                    if (animateState > 0) {



                        payload = {
                            prompt: actualPrompt,
                            activechracterimages: extractedCharacterUrls,
                            activechracternames: extractedCharacterNames,
                            startImage: noImagePrompt[toNativeSlot(i)] ? null : ImagesHdCloud[i],
                            videoLength: time,
                            duration: time,
                            ty: ratioKey,
                            model: modelz,
                            generateAudio: actualAudio,
                            generate_audio: actualAudio,
                            useaudio: actualAudio, // for backend compatibility
                            video: trimmedVideoUrl,
                            characterImage: ImagesHdCloud[i],
                            // optional extras (all match backend wanAnimateRoute inputs):
                            goFast: false,
                            // referFrames: 1,        // 1 or 5
                            // resolution: "720",     // default
                            // mergeAudio: true,
                            // fps: 24,
                            seed: Seed,
                            asyncMode: true

                        };



                        if (overrideAudio) { } else {

                            setClipDurations((prevx: any) => {
                                const next = [...prevx];
                                next[1] = 200;
                                return next;
                            });

                        }

                        if (animateState === 1) {
                            k = 'dreamActorRoute';
                        } else {
                            k = 'wanAnimateRouteRep'
                        }

                    }


                    // Attach the trimmed lip-sync audio URL only for the Seedance routes when active.
                    // Backend reads `lipSyncUrl` and maps it to Replicate's `reference_audios`.
                    const safeIdx = Math.max(0, Number(i || 0));
                    const lipActive = Array.isArray(lipSyncActiveList) ? lipSyncActiveList[safeIdx] : false;
                    const lipUrl = Array.isArray(lipSyncAudioUrls) ? lipSyncAudioUrls[safeIdx] : "";
                    if (lipActive && lipUrl && (k === 'klingPro' || k === 'sora2' || k === 'omniHuman')) {
                        payload.lipSyncUrl = lipUrl;
                    }

                    // Attach the reference video URL only when the user has it actively turned on
                    // ("Using Vid"), and only for Seedance 2.0 (klingPro) / 2.0 Fast (sora2).
                    // Backend maps it to Replicate's `reference_videos`.
                    const refVidActive = Array.isArray(referenceVideoActiveList) ? referenceVideoActiveList[safeIdx] : false;
                    const refVidUrl = Array.isArray(referenceVideoUrls) ? referenceVideoUrls[safeIdx] : "";
                    if (refVidActive && refVidUrl && (k === 'klingPro' || k === 'sora2')) {
                        payload.referenceVideoUrl = refVidUrl;
                    }

                    // Make a POST to your backend route with an extended timeout of 15 minutes
                    const response = await axios.post<any>(
                        `${CLIK_URL}/${k}`,
                        payload,
                        { timeout: 1900000 } // 15 minute timeout for long-running video generation
                    );

                    if (response.status !== 200) {
                        throw new Error(`Error from server: ${response.status}`);
                    }

                    // Extract the data from the serverÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s response.
                    let { videoBase64, status, jobId, provider, modelEndpoint } = response.data;

                    if (status === "starting" && jobId && provider) {
                        let attempts = 0;
                        while (attempts < 480) { // Max ~40 min (480 * 5s)
                            attempts++;
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            try {
                                const pollRes = await axios.post(`${CLIK_URL}/pollVideoStatus`, { jobId, provider, modelEndpoint });
                                const pollData = pollRes.data as any;
                                if (pollData.progress && updateLoader) {
                                    updateLoader(i, pollData.progress);
                                }
                                if (pollData.status === "succeeded") {
                                    videoBase64 = pollData.videoBase64;
                                    break;
                                } else if (pollData.status === "failed" || pollData.status === "canceled") {
                                    throw new Error("HARD_FAIL:" + (pollData.error || "Video generation failed online"));
                                }
                            } catch (e: any) {
                                if (e.message && String(e.message).startsWith("HARD_FAIL:")) {
                                    throw new Error(String(e.message).replace("HARD_FAIL:", ""));
                                }
                                console.warn("Transient polling error (retrying...):", e.message);
                            }
                        }
                    }

                    if (!videoBase64) {
                        throw new Error("No videoBase64 returned from server");
                    }

                    // Convert the base64 string into a Blob and then create an Object URL.
                    const blob = await base64ToBlob(videoBase64);
                    const videoObjectUrl = URL.createObjectURL(blob);

                    // Save the object URL so that the video can be displayed.



                    console.log('vid', videoObjectUrl);




                    setVideoArray((prev: any) => {
                        const next = [...prev];
                        next[i] = videoObjectUrl;
                        return next;
                    });

                    setVideoArrayBlob((prev: any) => {
                        const nextx = [...prev];
                        nextx[i] = blob;
                        return nextx;
                    });

                    if (animateState === 1 && setusedanimate) {
                        setusedanimate(true);
                    }




                    /// setPollStatus("Success!"); pageType

                    // Upload and save before marking this generation as finished.
                    await GenerateSignedUrlForVideo(blob, i, videoObjectUrl, bShotSaveContext);

                    setGeneratingAt(i, false);
                    finishLoader(i)

                    if (matchMobile && i === index) {
                        setShow(false);
                    }

                    removePixel(pxx);




                } catch (err) {
                    // Reset loader state when an error occurs.
                    /// setIsGenerating(false);

                    setGeneratingAt(i, false);

                    finishLoader(i, true);
                    console.error("Error generating Kling Pro video:", err);
                    // setPollStatus("Failed");
                } finally {
                    ///  setIsSubmitting(false);
                }

            }

            else {

                const requiredPixels = pxx;      // e.g. 100000
                const currentBalance = pixels;      // your userÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s pixel balance

                globalErrorEmitter.emit(`ðŸ˜¢ You've run out of pixels! This Video generation needs at least ${requiredPixels} pixels, but your balance is ${currentBalance} pixels.`, i);


            }
        },
        [ImagesHdCloud, videotxt, PostId, modelz, videModel, pixelsV, time, pageType, VideoArrayCloud, videoArrayLastFrame, musicKling, CreationMode,
            noImagePrompt, trimmedVideoUrl, animateState, lipSyncActiveList, lipSyncAudioUrls, referenceVideoUrls, referenceVideoActiveList]
    );



    //setTime(10)

    const GenerateVideo = useCallback(
        (index: number) => {
            // 1ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Special case: single-step + cloud video ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ just animate
            if (steps.length === 1 && VideoArrayCloud[2]) {
                runWanAnimate();
                return;
            }

            // 2ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Only in INTERACTIONS mode (pageType === 3)
            //    For non-main scenes (index !== 0), require both stepback1 & stepbackTwice

            //CreationMode === 'Video'

            // 3ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Normal generation path (for:
            //    - pageType !== 3, OR
            //    - index === 0, OR
            //    - interaction mode with valid stepbacks)
            if (textVidUpdate) {
                if (videotxt) {
                    EditGeneratedVisualTextOnlyFn(index, textVidUpdate, videotxt, 1);
                } else {
                    fetchAndGenerateImage(index, textVidUpdate, 1);
                }
            } else {
                GenerateVideox(index);
            }
        },
        [
            // deps actually used inside this callback:
            steps,
            VideoArrayCloud,
            pageType,
            videoArrayLastFrame,
            textVidUpdate,
            videotxt,
            runWanAnimate,
            EditGeneratedVisualTextOnlyFn,
            fetchAndGenerateImage,
            GenerateVideox,
            videoArrayLastFrame,
            TextVideo,
            musicKling,
            noImagePrompt, trimmedVideoUrl, animateState
        ]
    );


    // 1) Generate S3 signed URL
    const GenerateSignedUrlForVideo = useCallback(
        async (videoBlob: Blob, i: number, videoObjectUrl: any, bShotSaveContextOverride?: BShotSaveContextSnapshot) => {
            if (!videoBlob) {
                /// setError("No video blob for upload.");
                return;
            }

            try {
                console.log("ðŸ”¥ [2] GenerateSignedUrlForVideo Entry:", {
                    index: i,
                    currentVideoArrayCloudVal: VideoArrayCloud[i],
                    videoObjectUrl,
                    isBShotModeActive
                });

                const saveContext = bShotSaveContextOverride || bShotSaveContextRef.current;
                const previousVideoUrl = saveContext.isBShotMedia ? "" : VideoArrayCloud[i];
                // Example: pass any needed metadata or parameters in requestData

                const requestData = {
                    values: { count: 1 },
                };

                // Request a signed URL from your server
                const response = await axios.post<any>(
                    `${CLIK_URL}/get_signed_url_video`,
                    requestData,
                    { withCredentials: true } // If your server requires credentials/cookies
                );

                // Expect the server to respond with { signedUrl: "...", ... }

                const holder = response.data.holder;

                if (!holder || holder.length !== 1) {
                    throw new Error("Invalid signed URL response.");
                }

                const signedUrl = holder[0];


                if (!signedUrl) {
                    throw new Error("No signedUrl returned from server");
                }

                const { urlVideo } = signedUrl;

                // 2) Once we have a signed URL, PUT the video blob to S3
                const uploadedVideoUrl = await PutVideoInS3WithURL(videoBlob, urlVideo, i, videoObjectUrl, bShotSaveContextOverride);

                if (
                    previousVideoUrl &&
                    previousVideoUrl !== uploadedVideoUrl &&
                    previousVideoUrl !== "EMPTY" &&
                    previousVideoUrl !== "EMPTY_BSHOT"
                ) {
                    startDeleteVid(previousVideoUrl);
                }

                console.log("signed URL:", signedUrl);
                return uploadedVideoUrl;
            } catch (err: any) {
                setGeneratingAt(i, false);

                finishLoader(i, true)


                console.error("Error generating video signed URL:", err);
                ///setError(err.message || "Error generating video signed URL");
                throw err;
            }
        },
        [PostId, pageType, VideoArrayCloud, videoArrayLastFrame, CreationMode]
    );



    const startDeleteVid = async (vidUrl: string) => {
        try {
            console.log("ðŸ”¥ EditStory.tsx: startDeleteVid called! Deleting URL:", vidUrl);

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




    // 2) Upload video to S3 using the signed URL
    const PutVideoInS3WithURL = useCallback(
        async (videoBlob: Blob, signedUrl: string, i: number, videoObjectUrl: any, bShotSaveContextOverride?: BShotSaveContextSnapshot) => {
            try {
                console.log("ðŸ”¥ [3] PutVideoInS3WithURL Entry:", {
                    index: i,
                    signedUrl,
                    videoObjectUrl,
                    isBShotModeActive
                });


                const uploadResponse = await axios.put(signedUrl, videoBlob, {
                    headers: {
                        "Content-Type": videoBlob.type || "video/mp4",
                    },
                });

                if (uploadResponse.status !== 200 && uploadResponse.status !== 204) {
                    throw new Error(`Video upload failed with status ${uploadResponse.status}`);
                }

                console.log("Video uploaded successfully to S3.");


                // The final S3 link is the signedUrl minus the query parameters del
                const uploadedVideoUrl = signedUrl.split("?")[0];
                console.log("Uploaded video URL:", uploadedVideoUrl);



                /// alert('jj');

                const saveContext = bShotSaveContextOverride || bShotSaveContextRef.current;
                await saveToDatabase(uploadedVideoUrl, i, videoObjectUrl, saveContext);

                if (!saveContext.isBShotMedia) {
                    setVideoArrayCloud((prev: any) => {
                        const nextx = [...prev];
                        nextx[i] = uploadedVideoUrl;
                        return nextx;
                    });

                    saveVideoLOCALxFORxINTERACTIONS(i, uploadedVideoUrl);
                }
                return uploadedVideoUrl;

                // (Optional) Save the final URL to your database
                // e.g.: await saveToDatabase(uploadedVideoUrl, promptData, userData);
            } catch (err: any) {

                setGeneratingAt(i, false);

                finishLoader(i, true)

                console.error("Error uploading video to S3:", err);
                /// setError(err.message || "Error uploading video to S3");
                throw err;
            }
        },
        [PostId, pageType, VideoArrayCloud, videoArrayLastFrame, CreationMode]
    );





    // your existing helpers
    const GenerateSignedUrlForSingleImage = async (blob: Blob) => {
        if (!blob) throw new Error("No image Blob to generate a signed URL.");

        const requestData = { values: { count: 1 } };

        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_imageStory`,
            requestData,
            { withCredentials: true }
        );

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





    const saveToDatabase = useCallback(async (vid: any, i: number, videoObjectUrl: any, bShotSaveContextOverride?: BShotSaveContextSnapshot) => {
        try {
            const bShotSaveContext = bShotSaveContextOverride || bShotSaveContextRef.current;
            if (bShotSaveContext.isBShotMedia) {
                if (!bShotSaveContext.onInstantBShotSave) {
                    throw new Error("Missing B-shot video save handler.");
                }

                await bShotSaveContext.onInstantBShotSave(
                    vid,
                    bShotSaveContext.textValue || "",
                    true,
                    bShotSaveContext.parentSceneIndex,
                    bShotSaveContext.bIndex
                );
                return;
            }

            const Data = {
                postId: PostId,
                // DB column index (xv1..xv9 / xv1B..xv9B) is the NATIVE A-shot slot.
                // In B-shot (unified grid) mode `i` is a flattened display index â€”
                // saving with it puts the video in the wrong scene column (or gets
                // rejected), which is why videos could vanish after reload.
                type: toNativeSlot(i),
                vid: vid,
                mode: pageType
            };

            if (PostId === undefined || PostId === null || String(PostId).trim() === "" || !vid) {
                throw new Error("Missing postId or saved video URL for database update.");
            }

            await axios.put(`${CLIK_URL}/UpdatePostAIVideo`, { values: Data });
        } catch (error) {
            setGeneratingAt(i, false);
            finishLoader(i, true)
            globalErrorEmitter.emit("!Important Error: You can see Video But It is not saved on Database, pls generate again for use", i);
            console.log(error);
            throw error;
        }
        return;
        /*
        axios.put(`${CLIK_URL}/UpdatePostAIVideo`, { values: Data })
            .then(async (response) => {
                if (response) {

                    // ÃƒÂ°Ã…Â¸Ã¢â‚¬Â Ã¢â‚¬Â¢ Add this:
                    // if (CreationMode === 'Video')
                    // Use the video URL we just saved
                    // await saveLastFrameForIndex(videoObjectUrl, i);


                    // Update loader state ImageDesignStoryKontext
                    //  alert('video database')

                    // Update the storyVidArray state by setting the 'vid' in the appropriate index.

                }
            })
            .catch((error) => {

                setGeneratingAt(i, false);

                finishLoader(i, true)

                globalErrorEmitter.emit("!Important Error: You can see Video But It is not saved on Database, pls generate again for use", i);
                console.log(error);
            });
        */
    }, [PostId, pageType, videoArrayLastFrame, CreationMode, toNativeSlot]);




    // This now updates either the array or the single item
    const handleUpdateFluxImage = useCallback(
        async (
            fluxImageBlob: Blob,
            fluxImageUrl: string,
            fluxImageBlobHd: Blob,
            index: number,
            del: number = 0,
            bShotSaveContextOverride?: BShotSaveContextSnapshot,
        ) => {
            try {

                setGeneratingAt(index, true); startLoader(index)


                // SAFETY: if we're in array mode, we *need* a valid index
                if (isArrayMode && (index === undefined || index === null)) {
                    console.error("Index is required in array mode.");
                    return;
                }

                // 1) Handle old cloud image (Save for later instead of delete)
                const oldCloudUrl =
                    isArrayMode
                        ? ImagesHdCloud?.[index]
                        : ImagesHdCloud?.[0]; // optional: handle single mode via index 0

                if (oldCloudUrl && del === 0) {
                    // CHANGED: Do NOT delete. Save for later cleanup/history reference.
                    Saveprompthelperfordellater(oldCloudUrl);

                    // --- NEW: Immediately archive the old image to history ---
                    // This ensures that when we replace it with the new generation, the old one isn't lost.
                    setResultHistory((prev) => {
                        const currentHistory = prev[index] || [];
                        // Add old image to the history if not already there
                        if (!currentHistory.includes(oldCloudUrl)) {
                            // We append to start or end?
                            // If we want newest first, and oldCloudUrl is "older" than the one we are about to generate...
                            // It should be after the new one.
                            // But we don't have the new one yet.
                            // Let's just ensure it's in the list.
                            return { ...prev, [index]: [...currentHistory, oldCloudUrl] };
                        }
                        return prev;
                    });
                }

                // 2) Upload new HD image to S3
                const signedUrls = await GenerateSignedUrlForSingleImage(fluxImageBlobHd);
                const uploadedHdUrl = await PutSingleImageInS3WithURL(
                    fluxImageBlobHd,
                    signedUrls
                );

                // 3) Update local states
                if (isArrayMode) {
                    // --- ARRAY MODE ---

                    // blobs (SD)
                    setGeneratedImagesFluxBlob?.((prev: Blob[]) => {
                        const next = [...(prev || [])];
                        next[index] = fluxImageBlob;
                        return next;
                    });

                    // blobs (HD)
                    setGeneratedImagesFluxBlobHd?.((prev: Blob[]) => {
                        const next = [...(prev || [])];
                        next[index] = fluxImageBlobHd;
                        return next;
                    });


                    // URLs (local preview) -> UPDATE TO S3 URL to avoid duplicates/Blob expiry
                    setGeneratedImagesFlux?.((prev: string[]) => {
                        const next = [...(prev || [])];
                        next[index] = uploadedHdUrl; // Was fluxImageUrl
                        return next;
                    });

                    // CLOUD URLs (S3) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ maintain array integrity
                    setImagesHdCloud?.((prev: string[]) => {
                        const next = [...(prev || [])];
                        next[index] = uploadedHdUrl;
                        return next;
                    });

                    // --- NEW: Add the new URL to the history list ---
                    setGeneratedImagePrompt?.((prev: any) => {
                        const next = [...prev];
                        if (!next[index]) {
                            next[index] = { uploadedImages: [] };
                        }
                        const currentUploads = next[index].uploadedImages || [];
                        next[index] = {
                            ...next[index],
                            uploadedImages: [...currentUploads, uploadedHdUrl]
                        };
                        return next;
                    });

                    // --- NEW: Update resultHistory ---
                    setResultHistory((prev) => {
                        const currentHistory = prev[index] || [];
                        // Add new image to the START (newest first), ensuring no duplicates
                        const newHistory = [uploadedHdUrl, ...currentHistory.filter(url => url !== uploadedHdUrl)];
                        return { ...prev, [index]: newHistory };
                    });

                    setGeneratingAt(index, false); finishLoader(index, true);
                    if (matchMobile) {
                        setShow(false);
                    }
                } else {
                    // --- SINGLE MODE ---
                    finishLoader(index);
                    if (matchMobile) {
                        setShow(false);
                    }
                    // Local single blob + url
                    setFluxImBlob?.(fluxImageBlob);
                    setFluxIm?.(fluxImageUrl);

                    // Optional: store the cloud HD url in slot 0 (or use a separate single state)
                    setImagesHdCloud?.(() => [uploadedHdUrl]);
                }

                // --- NEW: Context A & B Intercept for B-Shot Grid ---
                const bShotSaveContext = bShotSaveContextOverride || bShotSaveContextRef.current;
                if (bShotSaveContext.isBShotMedia) {
                    if (bShotSaveContext.onInstantBShotSave) {
                        bShotSaveContext.onInstantBShotSave(
                            uploadedHdUrl,
                            bShotSaveContext.textValue || "",
                            false,
                            bShotSaveContext.parentSceneIndex,
                            bShotSaveContext.bIndex
                        );
                    }
                } else if (bShotSaveContext.isBShotGridContext) {
                    axios.put(`${CLIK_URL}/UpdatePostAIImage`, {
                        values: {
                            postId: PostId,
                            img: uploadedHdUrl,
                            type: pageType === 1 ? index * 2 : index,
                            mode: pageType
                        }
                    }).catch((err: any) => console.error("Failed to instant save image", err));
                }

                return uploadedHdUrl;

            } catch (err) {

                setGeneratingAt(index, false); finishLoader(index, true);
                console.error("handleUpdateFluxImage failed:", err);
            }
        },
        [
            isArrayMode,
            ImagesHdCloud,
            setGeneratedImagesFluxBlob,
            setGeneratedImagesFluxBlobHd,
            setGeneratedImagesFlux,
            setFluxImBlob,
            setFluxIm,
            setImagesHdCloud,
        ]
    );

    const PutSingleImageInS3WithURL = async (blob: Blob, signedUrls: any) => {
        if (!signedUrls.urlHD) {
            throw new Error("Signed URL is not available for uploading.");
        }
        if (!blob) {
            throw new Error("Image blob is not available for uploading.");
        }

        const uploadHD = await axios.put(signedUrls.urlHD, blob, {
            headers: {
                "Content-Type": blob.type || "application/octet-stream",
            },
        });

        if (uploadHD.status !== 200 && uploadHD.status !== 204) {
            throw new Error(`HD image upload failed with status ${uploadHD.status}`);
        }

        console.log("HD image uploaded successfully.");
        const uploadedHdUrl = signedUrls.urlHD.split("?")[0]; // strip query params
        return uploadedHdUrl;
    };

    // your delete helper
    const startDelete = async (imageUrl: string) => {
        try {
            ///  setLoadingDatabase2(true);
            await axios.post(
                `${CLIK_URL}/del-image`,
                { url: imageUrl },
                { withCredentials: true }
            );
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            ///setLoadingDatabase2(false);
        }
    };






    // Helper that calls the server, converts the returned image, then updates either the arrays or single Gpt Image
    const handleSubmitFluxImageNew = async (
        imageUrlFromSdxl: string, // base image
        enhancedPrompt: string,
        Seed: number,
        savedTextyes: number,
        currentSelectedPrompts: any,
        bShotSaveContextOverride?: BShotSaveContextSnapshot
    ) => {
        // setIsGenerating(true); // show the loader



        if (!showRemix) {
            setTextValue(enhancedPrompt);
            setGeneratedText((prev: any) => {
                const next = [...prev];
                next[index] = enhancedPrompt;
                return next;
            });
        }

        const bShotSaveContext = {
            ...(bShotSaveContextOverride || getBShotSaveContextSnapshot(enhancedPrompt)),
            textValue: enhancedPrompt
        };




        var x = modelz;

        if (currentSelectedPrompts && currentSelectedPrompts.length > 0) {


            if (modelz === 'fluxUltra') {

                x = 'kontext';
            }
            else if (modelz === 'Schnell' || modelz === 'Models') {

                x = 'Schnell';
            }
        }
        const modelPrice = calcModelPixels({
            model: x,          // or m.name, however you store the model label
            baseImagesPerDollar: 333       // keep in sync with what you pass the component
        });



        if (pixels >= modelPrice) {

            /// alert(modelPrice);




            setGeneratingAt(index, true);
            setGeneratingAt(index, true); startLoader(index)

            setshowRemix(false);

            try {





                // Prepare payload
                var payload: any = {
                    inputs: enhancedPrompt,
                    width: 1080,
                    height: 1920,
                    guidance: 7.5,
                    num_inference_steps: 35,
                    seed: Seed,
                    ty: ratioKey,
                    Png: true
                };

                // Conditionally include the image if available
                var url = 'fluxschnell';




                const sceneActiveMotions = activeMotionImagesMap[index] || [];
                const sceneActiveActions = activeActionImagesMap[index] || [];
                const allSceneActiveChars = [
                    ...(activeCharsForScene || []),
                    ...sceneActiveMotions,
                    ...sceneActiveActions
                ];

                // Check if there are active characters specifically locked into this targeted scene edit
                if (allSceneActiveChars.length > 0) {

                    // 1. Extract valid reference image URLs from current strictly active characters
                    const characterUrls = allSceneActiveChars
                        .map((c: any) => c.image || c.imageUrl || c.url)
                        .filter((u: any) => u && typeof u === 'string' && u.trim() !== '');

                    // 2. Process ALL images in the array concurrently
                    const base64ImagesArray = characterUrls
                        .map((imgUrl: any) => (imgUrl && imgUrl.trim() !== "" ? imgUrl.trim() : null));

                    // Filter out any nulls (failed downloads)
                    const validBase64Images = base64ImagesArray.filter((img: any) => img !== null);

                    // 3. Prepare payload with the ARRAY of extracted string URLs alongside full Character Data
                    payload = {
                        inputs: enhancedPrompt,
                        width: 1080,
                        height: 1920,
                        guidance: 7.5,
                        sampleImages: validBase64Images,
                        sampleimagesnames: allSceneActiveChars,
                        num_inference_steps: 35,
                        seed: Seed,
                        ty: ratioKey,
                        Png: true
                    };

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

                } else {
                    // ... existing else logic for models that don't use image prompts ...

                    if (modelz === 'Schnell') {
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
                    else if (modelz === 'Bannana') {
                        url = 'Imagen';
                    }



                    else if (modelz === 'Imagen') {

                        url = 'Imagen';
                    }

                    else if (modelz === 'Imagen2') {

                        url = 'Imagen2';
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
                }

                if (showRemix) {
                    url = 'Bannana';
                    payload = {
                        inputs: enhancedPrompt,
                        width: 1080,
                        height: 1920,
                        guidance: 7.5,
                        sampleImages: [ImagesHdCloud[index]],
                        num_inference_steps: 35,
                        seed: Seed,
                        ty: ratioKey,
                        Png: true
                    };
                }


                // pageType === 3

                // Post to your backend handleSubmitFluxImageNew
                const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
                    withCredentials: true,
                    timeout: 900000,
                });

                if (response.status !== 200) {
                    throw new Error(`FluxSchnell route error: ${response.status}`);
                }

                const { imageBase64 } = response.data;
                if (!imageBase64) {
                    throw new Error("No imageBase64 returned from server");
                }

                // Convert the returned base64 to a Blob
                const fluxImageBlobx = await (async () => {
                    const fetchRes = await fetch(imageBase64);
                    return await fetchRes.blob();
                })();

                // Convert the blob to HD WebP or JPEG
                const fluxImageBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlobx, modelz, ratioKey);
                const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(fluxImageBlobx, modelz, ratioKey);

                // Create a blob URL for preview
                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

                ///  setLoader(100);
                setGeneratingAt(index, false);

                finishLoader(index);



                setTimeout(async () => {

                    ///  setIsGenerating(false); // hide the loader Mini


                    if (savedTextyes === 1) {
                    } else {

                        if (imageUrlFromSdxl) { } else {
                            if (type === 1) {

                                setGeneratedText(enhancedPrompt);
                            }

                            else {

                                setGeneratedText((prev: any) => {
                                    const next = [...prev];
                                    next[index] = enhancedPrompt;
                                    return next;
                                });

                            }
                            setTextValuex('');
                            setTextValuex2('');
                        }


                    }


                    removePixel(modelPrice);


                    // Update local arrays or single
                    handleUpdateFluxImage(fluxImageBlob, fluxImageUrl, fluxImageBlobHd, index, 0, bShotSaveContext);

                    console.log("New flux image ready:", fluxImageUrl);

                }, 1000)


            } catch (err: any) {

                console.error("Error calling Flux Inference Endpoint:", err);

                setGeneratingAt(index, false);

                finishLoader(index, true)

                // 1ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£  pull whatever text is available
                let serverMsg = "";
                if (err.response?.data) {
                    if (typeof err.response.data === "string") {
                        serverMsg = err.response.data;            // raw text
                    } else if (typeof err.response.data.error === "string") {
                        serverMsg = err.response.data.error;      // { error: "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦" }
                    }
                }
                if (!serverMsg) serverMsg = err.message || "";

                // 2ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£  now do simple substring tests
                if (serverMsg.includes("Symbol(Request internals)")) {
                    globalErrorEmitter.emit("Your prompt was blocked by the content-safety filter. Click on the Safety Button.", index);
                } else if (
                    /safety|sensitive|content policy/i.test(serverMsg)
                ) {
                    globalErrorEmitter.emit("Your prompt was blocked by the content-safety filter. Click on the Safety Button.", index);
                } else {
                    globalErrorEmitter.emit("Generation failed. Check safety settings or refresh.", index);
                }

            } finally {

            }


        }

        else {

            const requiredPixels = modelPrice;      // e.g. 100000
            const currentBalance = pixels;      // your userÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s pixel balance

            globalErrorEmitter.emit(`ðŸ˜¢ You've run out of pixels! This image generation needs at least ${requiredPixels} pixels, but your balance is ${currentBalance} pixels.`, index);


        }
    };


    type LastFrameEntry = {
        base: Blob | null;        // this index's own last frame
        stepback1: Blob | null;   // last frame from index-1
        stepbackTwice: Blob | null; // last frame from index-2
    };
    const applyStepbacksForIndex = useCallback(
        (index: number, rawFrameBlob: Blob) => {
            setVideoArrayLastFrame((prev: any) => {
                // 1. SAFE COPY: Copy existing data first.
                // We do NOT use 'steps.length' to cut it short.
                const next = [...(prev || [])];

                // 2. SAFE EXPAND: Only add empty slots if the array is too short for this index.
                // This prevents wiping future scenes if 'steps.length' is wrong.
                while (next.length <= index + 1) { // +1 to ensure space for 'j' (index+1) later
                    next.push({ base: null, stepback1: null, stepbackTwice: null });
                }

                // 3. Ensure this specific index is initialized
                if (!next[index]) {
                    next[index] = { base: null, stepback1: null, stepbackTwice: null };
                }

                // 4. Store this index's own last frame
                next[index].base = rawFrameBlob;

                // 5. Populate the NEXT slot (j) with stepback data
                const j = index + 1;

                // We don't check 'if (j < len)' anymore because we want to save data
                // even if the 'steps' array hasn't updated yet.

                // Ensure slot 'j' exists
                if (!next[j]) {
                    next[j] = { base: null, stepback1: null, stepbackTwice: null };
                }

                // stepback1 = frame from index
                next[j].stepback1 = rawFrameBlob;

                // stepbackTwice = frame from index-1 (if present)
                const prev2 = j - 2; // which is effectively (index - 1)
                if (prev2 >= 0 && next[prev2]?.base) {
                    next[j].stepbackTwice = next[prev2].base;
                } else {
                    next[j].stepbackTwice = null;
                }



                return next;
            });
        },
        [steps, setImagesHdCloud] // Removed videoArrayLastFrame from dependency to avoid loop
    );

    ///handleKeyDownvid

    const saveLastFrameForIndex = useCallback(
        async (videoUrl: string, index: number) => {
            setGeneratingAt(index, true);
            setGeneratingAt(index, true); setGeneratingAt(index, true); startLoader(index);
            try {
                // 1ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Capture the raw last frame
                const rawFrameBlob = await captureLastFrameBlobFromVideo(
                    videoUrl,
                    0.06
                );

                // 2ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Save into videoArrayLastFrame with stepback1 / stepbackTwice rules
                applyStepbacksForIndex(index, rawFrameBlob);

            } catch (err) {
                console.error("Failed to capture last frame for index", index, err);
            } finally {
                finishLoader(index);
            }
        },
        [
            applyStepbacksForIndex,
            modelz,
            ratioKey,

            startLoader,
            finishLoader,
            videoArrayLastFrame
        ]
    );

    const applyStoredFrameToIndex = useCallback(
        async (
            targetIndex: number,
            sourceType: "base" | "stepback1" | "stepbackTwice" = "base",
            forcedSourceIndex?: number // <--- I added this so it knows WHICH image to use
        ) => {
            // If we provided a specific index (forcedSourceIndex), use it.
            // Otherwise, fallback to the old logic (targetIndex - 1)
            const indexToUse = (typeof forcedSourceIndex === 'number')
                ? forcedSourceIndex
                : targetIndex - 1;

            const entry = videoArrayLastFrame[indexToUse + 1];
            if (!entry) {
                console.warn("No last-frame entry for index", indexToUse);
                return;
            }

            const sourceBlob = entry[sourceType];
            if (!sourceBlob) {
                console.warn(
                    `No blob found for ${sourceType} at index ${indexToUse}. ` +
                    "Maybe that video hasn't been captured yet?"
                );
                return;
            }

            const bShotSaveContext = getBShotSaveContextSnapshot(textValue);

            setGeneratingAt(targetIndex, true); startLoader(targetIndex);
            try {
                // 2ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Convert just like your AI-generated images
                const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                    sourceBlob,
                    modelz,
                    ratioKey
                );
                const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(
                    sourceBlob,
                    modelz,
                    ratioKey
                );

                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);
                console.log(
                    `Applying ${sourceType} from index ${indexToUse} to target ${targetIndex}:`,
                    fluxImageUrl
                );

                // 3ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Save into your normal slot for THIS index
                handleUpdateFluxImage(
                    fluxImageBlob,
                    fluxImageUrl,
                    fluxImageBlobHd,
                    targetIndex,
                    0,
                    bShotSaveContext
                );
            } catch (err) {
                console.error(
                    `Failed to apply ${sourceType} last frame for index`,
                    targetIndex,
                    err
                );
            } finally {
                finishLoader(targetIndex, true);
            }
        },
        [
            videoArrayLastFrame,
            modelz,
            ratioKey,
            handleUpdateFluxImage,
            startLoader,
            finishLoader,
        ]
    );

    const handleExtractFrame = useCallback(
        async (targetIndex: number, sourceBlob: Blob) => {
            if (!sourceBlob) {
                console.warn("No blob provided for extract frame.");
                return;
            }

            const bShotSaveContext = getBShotSaveContextSnapshot(textValue);

            setGeneratingAt(targetIndex, true); startLoader(targetIndex);
            try {
                // 2ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Bypass the standard device conversion to preserve our intentional downscale (e.g. 360x640)
                // The sourceBlob is already a safe JPEG from the canvas extraction.
                const fluxImageBlob = sourceBlob;
                const fluxImageBlobHd = sourceBlob;

                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);
                console.log(
                    `Applying extracted frame to target ${targetIndex}:`,
                    fluxImageUrl
                );

                // 3ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Save into your normal slot for THIS index (which uploads to S3)
                const newCloudUrl = await handleUpdateFluxImage(
                    fluxImageBlob,
                    fluxImageUrl,
                    fluxImageBlobHd,
                    targetIndex,
                    0,
                    bShotSaveContext
                );

                // 4ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Automatically trigger upscaling now that it's in S3
                if (newCloudUrl) {
                    setIsUpscaling(prev => {
                        const next = Array.isArray(prev) ? [...prev] : [];
                        next[targetIndex] = true;
                        return next;
                    });

                    try {
                        const response = await axios.post(`${CLIK_URL}/upscaleImage`, {
                            url: newCloudUrl,
                            size: "720x1280"
                        });

                        const upscaledUrl = (response.data as any).url;

                        let finalUrlToUse = upscaledUrl;
                        try {
                            const downscaledBlob = await new Promise<Blob>((resolve, reject) => {
                                const img = new Image();
                                img.crossOrigin = "anonymous";
                                img.onload = () => {
                                    const canvas = document.createElement("canvas");
                                    // Make sure it sits in a 720p box max
                                    const maxW = 720;
                                    const maxH = 1280;
                                    let targetWidth = img.width;
                                    let targetHeight = img.height;

                                    if (targetWidth > maxW || targetHeight > maxH) {
                                        const ratio = Math.min(maxW / targetWidth, maxH / targetHeight);
                                        targetWidth = Math.round(targetWidth * ratio);
                                        targetHeight = Math.round(targetHeight * ratio);
                                    }

                                    canvas.width = targetWidth;
                                    canvas.height = targetHeight;
                                    const ctx = canvas.getContext("2d");
                                    if (!ctx) return reject(new Error("Canvas context missing"));
                                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                                    canvas.toBlob((blob) => {
                                        if (blob) resolve(blob);
                                        else reject(new Error("Canvas toBlob failed"));
                                    }, "image/png"); // Forced PNG
                                };
                                img.onerror = () => reject(new Error("Image failed to load for downscaling"));
                                img.src = upscaledUrl + "?nocache=" + new Date().getTime();
                            });

                            const signedUrls = await GenerateSignedUrlForSingleImage(downscaledBlob);
                            finalUrlToUse = await PutSingleImageInS3WithURL(downscaledBlob, signedUrls);
                        } catch (downscaleErr) {
                            console.error("Canvas downscale failed, falling back to upscaledUrl", downscaleErr);
                        }

                        // Update all arrays with the final 720p downscaled PNG
                        if (setImagesHdCloud) {
                            setImagesHdCloud((prev: any) => {
                                const next = [...prev];
                                next[targetIndex] = finalUrlToUse;
                                return next;
                            });
                        }

                        if (setGeneratedImagesFlux) {
                            setGeneratedImagesFlux((prev: any) => {
                                const next = [...prev];
                                next[targetIndex] = finalUrlToUse;
                                return next;
                            });
                        }

                        if (type === 1 && setFluxIm) {
                            setFluxIm(finalUrlToUse);
                        }

                    } catch (error) {
                        console.error("Auto upscale failed", error);
                    } finally {
                        setIsUpscaling(prev => {
                            const next = Array.isArray(prev) ? [...prev] : [];
                            next[targetIndex] = false;
                            return next;
                        });
                    }
                }

            } catch (err) {
                console.error(
                    `Failed to apply extracted frame for index`,
                    targetIndex,
                    err
                );
            } finally {
                finishLoader(targetIndex, true);
            }
        },
        [
            modelz,
            ratioKey,
            handleUpdateFluxImage,
            startLoader,
            finishLoader,
        ]
    );

    // This is the bridge that connects the UI click to the logic above
    const handleSelectVideoStepback = useCallback((targetIndex: number, sourceIndexFromUI: number) => {
        applyStoredFrameToIndex(targetIndex, "stepback1", sourceIndexFromUI);
    }, [applyStoredFrameToIndex]);


    // Inside your component function:

    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¹ Build some derived state for this index
    const entry = videoArrayLastFrame[index];

    // Do we need to force the user to pick a stepback?
    const needsStepbackChoice =
        CreationMode === 'Video' &&
        !ImagesHdCloud[index] &&        // no prompt image yet for this step
        index > 0 &&                    // only for step > 0 (main step 0 is free)
        entry &&
        (entry.stepback1 || entry.stepbackTwice);

    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¹ Create preview URLs for the two stored frames (and clean up)
    const [stepbackPreviewUrls, setStepbackPreviewUrls] = useState<{
        stepback1: string | null;
        stepbackTwice: string | null;
    }>({ stepback1: null, stepbackTwice: null });

    useEffect(() => {
        let url1: string | null = null;
        let url2: string | null = null;

        if (entry?.stepback1) {
            url1 = URL.createObjectURL(entry.stepback1);
        }
        if (entry?.stepbackTwice) {
            url2 = URL.createObjectURL(entry.stepbackTwice);
        }

        setStepbackPreviewUrls({
            stepback1: url1,
            stepbackTwice: url2,
        });

        return () => {
            if (url1) URL.revokeObjectURL(url1);
            if (url2) URL.revokeObjectURL(url2);
        };
    }, [entry?.stepback1, entry?.stepbackTwice]);





    // Add this inside EditStory component
    useEffect(() => {
        if (CreationMode === 'Video') {
            setnoImagePrompt((prev: any) => {
                // If already initialized (e.g. user toggled one back), maybe don't overwrite?
                // But request was "on load true".
                // Let's protect against overwriting if user already interacted, or just force it once.
                // For "first load" behavior, we can check if it's all false.
                const isAllFalse = prev.every((v: boolean) => v === false);
                if (isAllFalse) {
                    return Array(steps.length).fill(false); // Changed to false: keep image context ON by default
                }
                return prev;
            });
        }
    }, [CreationMode, steps.length, VideMode]);

    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¹ Click handlers for the tiny previews
    const handleChooseStepback1 = useCallback(() => {
        if (!entry?.stepback1) return;
        applyStoredFrameToIndex(index, "stepback1");
    }, [applyStoredFrameToIndex, entry?.stepback1, index]);

    const handleChooseStepbackTwice = useCallback(() => {
        if (!entry?.stepbackTwice) return;
        applyStoredFrameToIndex(index, "stepbackTwice");
    }, [applyStoredFrameToIndex, entry?.stepbackTwice, index]);

    const saveLastFrameAsBaseImageForAllSlots = useCallback(
        async (videoUrl: string) => {

            setGeneratingAt(index, true); setGeneratingAt(index, true); startLoader(index);
            try {
                // 1ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Get raw frame as blob from end of video
                const rawFrameBlob = await captureLastFrameBlobFromVideo(videoUrl, 0.06);

                // 2ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Convert just like your AI-generated images
                const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                    rawFrameBlob,
                    modelz,
                    ratioKey
                );
                const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(
                    rawFrameBlob,
                    modelz,
                    ratioKey
                );

                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

                console.log("Last frame image URL:", fluxImageUrl);

                // 3ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Save "as if AI-generated" for index 0
                // If your handleUpdateFluxImage already uses `index` from closure,
                // you can either:
                //  - temporarily set a localIndex before calling it, or
                //  - write a small per-index saver like below.

                // Example per-index save using your style:
                const nonBShotSaveContext = {
                    ...getBShotSaveContextSnapshot(textValue),
                    isBShotMedia: false,
                    isBShotGridContext: false
                };

                const saveForIndex = (idx: number) => {
                    handleUpdateFluxImage(fluxImageBlob, fluxImageUrl, fluxImageBlobHd, idx, 0, nonBShotSaveContext);

                    // If you already have a helper like handleUpdateFluxImage(bl, url, hd),
                    // you can call that here instead of the three setters.
                    // handleUpdateFluxImage(fluxImageBlob, fluxImageUrl, fluxImageBlobHd, idx);
                };

                // 4ÃƒÂ¯Ã‚Â¸Ã‚ÂÃƒÂ¢Ã†â€™Ã‚Â£ Save to all indexes (same image) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ index 0 and beyond
                const slotsCount = steps.length; // or whatever array length you use

                for (let idx = 0; idx < slotsCount; idx++) {
                    saveForIndex(idx);
                }


                // If you only want to copy to indexes > 0:
                // for (let idx = 1; idx < slotsCount; idx++) {
                //   saveForIndex(idx);
                // }

            } catch (err) {

                setGeneratingAt(index, false); finishLoader(index, true);
                console.error("Failed to capture last frame and save base image:", err);
            }
        },
        [
            modelz,
            ratioKey,
            steps,

        ]
    );



    const callRemakeSafety = async (textValuex: any, textValue: any, prompt: any) => {

        if (!allowgetImage) return;
        const bShotSaveContext = getBShotSaveContextSnapshot(textValue);

        //setIsGenerating(true); // show the loader

        setGeneratingAt(index, true);

        setGeneratingAt(index, true); startLoader(index)


        var ff = 'GptRemakeSafe';

        // if (GeneratedImages3.length > 0) {


        try {
            // Prepare the request payload

            var instructions = typeof textValuex === 'string' ? textValuex.replace(/@/g, '') : textValuex;
            var promptx = textValue;
            var logic = prompt;
            const requestData: any = { promptx, instructions, logic, imageUrl: ImagesHdCloud[index] };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/${ff}`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;

            console.log("remake:", data.payload);

            if (type === 1) {

                setGeneratedText(data.payload);
            }

            else {

                setGeneratedText((prev: any) => {
                    const next = [...prev];
                    next[index] = data.payload;
                    return next;
                });

            }
            setTextValuex('');
            setTextValuex2('');
            finishLoader(index)
            setGeneratingAt(index, false);
            handleDraw(data.payload, GeneratedImages3, 0, bShotSaveContext);

        } catch (error: any) {


            //setIsGenerating(false); // show the loader
            setGeneratingAt(index, false);

            finishLoader(index, true)


            // Handle different error scenarios
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                /// setError(error.response.data.message || "Server Error");
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
    }



    // 1. Ensure Index is a number (Assuming it comes from props)
    // const {index} = props;

    // 4. Handle Updates (Typed 'prev' to fix errors)
    const handleUpdatePromptSelection = (newImages: string[]) => {
        setSelectedPromptsMap((prev: Record<number, string[]>) => ({
            ...prev,
            [index]: newImages
        }));
    };

    const handleUpdateFinalSelection = (newImages: string[]) => {
        setSelectedFinalsMap((prev: Record<number, string[]>) => ({
            ...prev,
            [index]: newImages
        }));
    };



    const callRemake = async (textValuex: any, textValue: any, prompt: any) => {
        if (!allowgetImage) return;
        const bShotSaveContext = getBShotSaveContextSnapshot(textValue);

        //setIsGenerating(true); // show the loader

        setGeneratingAt(index, true);

        setGeneratingAt(index, true); startLoader(index)


        setTextValuex('');

        var ff = 'GptRemake';

        // if (GeneratedImages3.length > 0) {





        try {
            // Prepare the request payload

            var instructions = typeof textValuex === 'string' ? textValuex.replace(/@/g, '') : textValuex;
            instructions = instructions ? (instructions + ". CRITICAL RULE: You MUST perfectly retain all Character Names exactly as they appear in the source text. Do NOT invent new character names or voices. If a character is not named, describe them generally.") : "CRITICAL RULE: You MUST perfectly retain all Character Names exactly as they appear in the source text. Do NOT invent new character names or voices. If a character is not named, describe them generally without a name.";
            var promptx = textValue;
            var logic = prompt;
            const requestData: any = { promptx, instructions, logic, imageUrl: ImagesHdCloud[index] };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/${ff}`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;

            console.log("remake:", data.payload);




            if (type === 1) {

                setGeneratedText(data.payload);
            }

            else {

                setGeneratedText((prev: any) => {
                    const next = [...prev];
                    next[index] = data.payload;
                    return next;
                });

            }

            finishLoader(index)
            setGeneratingAt(index, false);
            handleDraw(data.payload, GeneratedImages3, 1, bShotSaveContext);

        } catch (error: any) {


            //setIsGenerating(false); // show the loader
            setGeneratingAt(index, false);

            finishLoader(index, true)


            // Handle different error scenarios
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                /// setError(error.response.data.message || "Server Error");
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
    }

    const callRemakePromptOnly = async (textValuex: any, textValue: any, prompt: any) => {
        setGeneratingAt(index, true); startLoader(index);
        setTextValuex('');
        try {
            var instructions = typeof textValuex === 'string' ? textValuex.replace(/@/g, '') : textValuex;
            instructions = instructions ? (instructions + ". CRITICAL RULE: You MUST perfectly retain all Character Names exactly as they appear in the source text. Do NOT invent new character names or voices. If a character is not named, describe them generally.") : "CRITICAL RULE: You MUST perfectly retain all Character Names exactly as they appear in the source text. Do NOT invent new character names or voices. If a character is not named, describe them generally without a name.";
            var promptx = textValue;
            var logic = prompt;
            const requestData: any = { promptx, instructions, logic, imageUrl: ImagesHdCloud[index] };
            const response = await axios.post<any>(
                `${CLIK_URL}/GptRemake`,
                requestData,
                { withCredentials: true }
            );
            const data = response.data;
            if (type === 1) {
                setGeneratedText(data.payload);
            } else {
                setGeneratedText((prev: any) => {
                    const next = [...prev];
                    next[index] = data.payload;
                    return next;
                });
            }
            if (typeof setTextValue === "function") {
                setTextValue(data.payload);
            }
            finishLoader(index);
            setGeneratingAt(index, false);
        } catch (error: any) {
            setGeneratingAt(index, false);
            finishLoader(index, true);
            console.error("Error updating prompt with AI:", error);
        }
    }



    const callRemakeText = async (textValuex: any, textValue: any) => {

        /// setIsGenerating(true); // show the loader

        setTextValuex2('');
        setGeneratingAt(index, true);
        setGeneratingAt(index, true); startLoader(index)
        try {
            // Prepare the request payload

            var instructions = typeof textValuex === 'string' ? textValuex.replace(/@/g, '') : textValuex;
            instructions = instructions ? (instructions + ". CRITICAL RULE: You MUST perfectly retain all Character Names exactly as they appear in the source text. Do NOT invent new character names or voices. If a character is not named, describe them generally.") : "CRITICAL RULE: You MUST perfectly retain all Character Names exactly as they appear in the source text. Do NOT invent new character names or voices. If a character is not named, describe them generally without a name.";
            var promptx = textValue;
            const requestData: any = { promptx, instructions };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/GptRemakeText`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;

            console.log("remakeText:", data.payload);

            // Update state with the enhanced text
            //setEnhancedText(data.initialSteps);
            //setPrompt(data.initialSteps);


            setGeneratingAt(index, false);
            finishLoader(index)




            {
                // steps2/stepsx are NATIVE arrays â€” never index them with the unified display index
                const narrIdx = pageType === 1 ? Math.floor(nativeSlotIndex / 2) : nativeSlotIndex - 1;
                const prevNarrRaw = steps2?.[narrIdx];
                const prevNarrText = typeof prevNarrRaw === 'object' && prevNarrRaw !== null ? prevNarrRaw.text : (prevNarrRaw ?? "");

                setSteps2((prev: any[]) => {
                    const next = [...prev];
                    while (next.length <= narrIdx) next.push("");
                    next[narrIdx] = data.payload;
                    return next;
                });

                setStepsx((prev: any) => {
                    const next = [...prev];
                    next[nativeSlotIndex] = data.payload;
                    return next;
                });

                // Only mark audio stale when the narration text actually changed
                if (data.payload !== prevNarrText) {
                    setIsAudioDirty?.(true);
                }
            }

            if (typeof setTextValueT === "function") {
                setTextValueT(data.payload);
            }

        } catch (error: any) {


            /// setIsGenerating(false); // show the loader

            setGeneratingAt(index, false);
            finishLoader(index, true)
            // Handle different error scenarios
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                /// setError(error.response.data.message || "Server Error");
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
    }



    const handleKeyDownR = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleDraw(textValue2, generatedImagesFlux[index], 0);

        }

    }

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {

            e.preventDefault();

            if (allowgetImage) {
                if (textValuex) {
                    callRemake(textValuex, textValue, prompt);

                } else {
                    handleDraw(textValue, GeneratedImages3, 0);
                }
            } else {
                if (textValuex) {
                    callRemakePromptOnly(textValuex, textValue, prompt);
                } else {
                    setGeneratedText((prev: any) => {
                        const next = [...prev];
                        next[index] = textValue;
                        return next;
                    });
                    setstartEdit(false);
                }
            }

        }

    }

    // handler factory: given an index, returns an onChange handler
    const handleChangeTextVid = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {

        const newValue = e.target.value;



        setvideotxt(newValue);

    }, [index])



    const handleKeyDownT = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (textValuex2) {

                ///   alert('kj');
                callRemakeText(textValuex2, textValueT);
            } else {

                // steps2/stepsx are NATIVE arrays â€” never index them with the unified display index
                const narrIdx = pageType === 1 ? Math.floor(nativeSlotIndex / 2) : nativeSlotIndex - 1;
                const prevNarrRaw = steps2?.[narrIdx];
                const prevNarrText = typeof prevNarrRaw === 'object' && prevNarrRaw !== null ? prevNarrRaw.text : (prevNarrRaw ?? "");

                setSteps2((prev: any[]) => {
                    const next = [...prev];
                    while (next.length <= narrIdx) next.push("");
                    next[narrIdx] = textValueT;
                    return next;
                });

                setStepsx((prev: any) => {
                    const next = [...prev];
                    next[nativeSlotIndex] = textValueT;
                    return next;
                });

                // Only mark audio stale when the narration text actually changed
                if (textValueT !== prevNarrText) {
                    setIsAudioDirty?.(true);
                }

                if (setstartEdit) setstartEdit(false);
            }
        }
    };


    const handleKeyDownvid = (e: any, videotxt: any, textVidUpdate: any, index: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();


            GenerateVideo(index);


        }
    }


    useEffect(() => {
        // Check if any step is exactly " " or exactly "Enter Text to Generate AI Voice"

        /// setMemeMusic(true);

        ///setMemeMusic(false);

    }, [steps]);

    // The "Draw" button calls the above function
    const handleDraw = (newValue: any, im: any, type: number, bShotSaveContextOverride?: BShotSaveContextSnapshot) => {
        if (!allowgetImage) return;
        // In array mode, we use base[index], in single mode base[0]
        // const baseToSend = isArrayMode ? base[index] : base[0] || "";
        handleSubmitFluxImageNew(im, newValue, Seed, type, currentSelectedPrompts, bShotSaveContextOverride);
    };



    // Assume VideoArrayCloud is already state somewhere above, e.g.
    // const [VideoArrayCloud, setVideoArrayCloud] = useState<string[]>([]);

    const [uploadingVideo, setUploadingVideo] = useState(false);

    // to match video width to the button width
    const animateButtonRef = useRef<HTMLButtonElement | null>(null);
    const [animateButtonWidth, setAnimateButtonWidth] = useState<number | null>(null);

    useEffect(() => {
        if (animateButtonRef.current) {
            setAnimateButtonWidth(animateButtonRef.current.offsetWidth);
        }
    }, [matchMobile, darkModeReducer]); // re-measure when layout/theme changes

    const videoUrl = VideoArrayCloud?.[index] || "";





    const handleVideoFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            setUploadingVideo(true);
            const file = e.target.files?.[0];
            if (!file) return;

            // 500 MB cap
            if (file.size > MAX_VIDEO_SIZE_BYTES) {
                console.error("Video is larger than 500MB (frontend cap).");
                // setError("Video must be <= 500MB");
                return;
            }

            const videoObjectUrl = URL.createObjectURL(file);
            const i = index; // use the actual index prop instead of hardcoded 2
            const bShotSaveContext = getBShotSaveContextSnapshot(videotxt);

            try {
                setUploadingVideo(true);
                await GenerateSignedUrlForVideo(file, i, videoObjectUrl, bShotSaveContext);
            } catch (err) {
                console.error("Error in video upload pipeline:", err);
            } finally {
                setUploadingVideo(false);
            }
        },
        [GenerateSignedUrlForVideo, videoArrayLastFrame, CreationMode]
    );



    const handleDeleteUploadedVideo = () => {
        console.log("Delete video clicked");

        startDeleteVid(VideoArrayCloud[index]);

        // clear from local array UI
        setVideoArrayCloud((prev: any) => {
            const next = [...prev];
            next[index] = "";
            return next;
        });
    };

    // 2) For an existing image URL: fetch => create File => call handleFileChange
    const handleExistingUrl = async (
        url: string,
        onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch image for resizing");

            const blob = await response.blob();
            const file = new File([blob], "selectedImage.jpg", { type: blob.type });

            // Synthetic event
            const fakeInputEvent = {
                target: { files: [file] },
                currentTarget: { files: [file] },
                preventDefault: () => { },
                stopPropagation: () => { },
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            onFileChange(fakeInputEvent);
        } catch (err) {
            console.error(err);
        }
    };


    // The file upload logic is shared. We store the result in array mode at base[index], in single mode at base[0].
    const handleVideoUploadDirect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const bShotSaveContext = getBShotSaveContextSnapshot(videotxt);

            // 1. Validate Size (500MB cap from existing logic)
            if (file.size > MAX_VIDEO_SIZE_BYTES) {
                console.error("Video is larger than 500MB.");
                // alert("Video is larger than 500MB.");
                return;
            }

            // 2. Validate Duration (Max 20s)
            const videoElement = document.createElement('video');
            videoElement.preload = 'metadata';
            videoElement.onloadedmetadata = async () => {
                window.URL.revokeObjectURL(videoElement.src);
                const duration = videoElement.duration;
                if (duration > 20) {
                    console.error("Video duration exceeds 20 seconds.");
                    globalErrorEmitter.emit("Video duration must be 20 seconds or less.", index);
                    return;
                }

                // Proceed with upload
                const videoObjectUrl = URL.createObjectURL(file);

                // Use a temporary "uploading" state if needed, or just leverage the existing logic
                console.log(`Uploading video for index ${idx}...`);

                // MANUAL STATE UPDATE FOR IMMEDIATE UI FEEDBACK
                setVideoArray((prev: any) => {
                    const next = [...prev];
                    next[idx] = videoObjectUrl;
                    return next;
                });

                // Also set blob if needed for downstream logic
                if (setVideoArrayBlob) {
                    setVideoArrayBlob((prev: any) => {
                        const next = [...prev];
                        next[idx] = file;
                        return next;
                    });
                }


                try {
                    // setUploadingVideo(true); // Optional: if you want a global loader, or per-item
                    // Reuse existing GenerateSignedUrlForVideo logic
                    await GenerateSignedUrlForVideo(file, idx, videoObjectUrl, bShotSaveContext);

                } catch (err) {
                    console.error("Error in direct video upload:", err);
                }
            };
            videoElement.src = URL.createObjectURL(file);
        },
        [GenerateSignedUrlForVideo, MAX_VIDEO_SIZE_BYTES, setVideoArray, setVideoArrayBlob]
    );

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            const desiredWidth = 1080;
            const desiredHeight = 1920;

            const canvas = document.createElement("canvas");
            canvas.width = desiredWidth;
            canvas.height = desiredHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const originalWidth = img.width;
            const originalHeight = img.height;
            const originalAspect = originalWidth / originalHeight;
            const desiredAspect = desiredWidth / desiredHeight;

            let drawWidth, drawHeight;
            let offsetX = 0;
            let offsetY = 0;

            // Letterbox or pillarbox to fill 1080x1920 exactly
            if (originalAspect > desiredAspect) {
                drawHeight = desiredHeight;
                drawWidth = drawHeight * originalAspect;
                offsetX = (desiredWidth - drawWidth) * 0.5;
            } else {
                drawWidth = desiredWidth;
                drawHeight = drawWidth / originalAspect;
                offsetY = (desiredHeight - drawHeight) * 0.5;
            }

            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

            const resizedBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
            });
            if (!resizedBlob) return;

            const resizedImageUrl = URL.createObjectURL(resizedBlob);

            // Store the new base image in either base[index] or base[0]
            setbase((prev: any) => {
                const next = [...prev];
                const targetIndex = isArrayMode ? index : 0;
                next[targetIndex] = resizedImageUrl;
                return next;
            });

            URL.revokeObjectURL(imageUrl);
        };

        img.src = imageUrl;
        event.target.value = "";

    };

    const handleClickBasePicker = () => {
        fileInputRef.current?.click();
    };



    if (!startEdit || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <Box
            onPointerDown={(e) => {
                backdropPointerStarted.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                if (backdropPointerStarted.current && e.target === e.currentTarget) {
                    if (setstartEdit) setstartEdit(false);
                }
                backdropPointerStarted.current = false;
            }}
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100dvh",
                zIndex: 1200,
                overflow: "hidden",
                display: "flex",
                pointerEvents: "auto",
                alignItems: "center",
                justifyContent: "center",
                p: { xs: 0, sm: 3 },
                bgcolor: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(16px)",
            }}
        >
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    position: "relative",
                    width: "100%",
                    maxWidth: isZoomPreview && !matchMobile ? "100vw" : "1000px",
                    height: isZoomPreview && !matchMobile ? "100vh" : (matchMobile && isZoomPreview ? "100dvh" : { xs: "100dvh", sm: "85vh" }),
                    maxHeight: isZoomPreview && !matchMobile ? "100vh" : (matchMobile && isZoomPreview ? "100dvh" : { xs: "100dvh", sm: "85vh" }),
                    overflow: "hidden",
                    bgcolor: isZoomPreview && !matchMobile ? "transparent" : (matchMobile ? (darkModeReducer ? "#0f0f12" : "#ffffff") : (darkModeReducer ? "#111214" : "#f8f8fb")),
                    borderRadius: ((isZoomPreview && !matchMobile) || (matchMobile && isZoomPreview)) ? 0 : { xs: 0, sm: 6 },
                    border: isZoomPreview && !matchMobile ? "none" : shellBorder,
                    boxShadow: isZoomPreview && !matchMobile
                        ? "none"
                        : (darkModeReducer ? "0 24px 80px rgba(0,0,0,0.8)" : "0 24px 80px rgba(31,38,135,0.12)"),
                    alignSelf: "center",
                    transition: matchMobile ? "all 0.25s ease" : "none",
                }}
            >



                <Box
                    onClick={() => {
                        console.error("[EditStory] Custom close button clicked! Calling setstartEdit(false)");
                        if (setstartEdit) setstartEdit(false);
                        setTimeout(() => {
                            const btn = document.getElementById('morph-button-trigger');
                            if (btn) btn.click();
                        }, 50);
                    }}
                    sx={{
                        position: 'absolute',
                        top: { xs: 'calc(8px + 1vh)', sm: 18 },
                        left: 20,
                        zIndex: 30000,
                        display: show ? 'flex' : 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 0,
                        height: 48,
                        px: 2,
                        borderRadius: 999,
                        background: darkModeReducer
                            ? "linear-gradient(135deg, rgba(20,20,20,0.6) 0%, rgba(10,10,10,0.4) 100%)"
                            : "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.46) 100%)",
                        backdropFilter: "blur(18px) saturate(180%)",
                        border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.72)",
                        color: darkModeReducer ? "#fff" : "#111",
                        boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.18)" : "0 8px 20px rgba(31,38,135,0.06)",
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        transition: 'all 0.2s',
                        '&:hover': {
                            transform: 'scale(1.05)',
                            background: darkModeReducer
                                ? "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)"
                                : "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.58) 100%)",
                        }
                    }}
                >
                    <Typography
                        variant="button"
                        sx={{
                            fontSize: '1rem',
                            lineHeight: 1,
                            fontWeight: 800,
                            fontFamily: editorFontFamily,
                            textTransform: 'none',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 0.6
                        }}
                    >
                        {pixels.toLocaleString()}
                        <span style={{ fontSize: '0.65em', fontWeight: 700, opacity: 0.6 }}>P</span>
                    </Typography>
                </Box>





                <label htmlFor="flux-image-input" style={{
                    position: 'absolute',
                    top: '18px',
                    left: matchMobile ? '140px' : '130px',
                    zIndex: 30000,
                    display: 'none',

                }}>
                    <Button
                        component="span"
                        startIcon={<ImageIcon style={{ fontSize: '2rem' }} />}
                        variant='contained'
                        sx={{
                            // position

                            // sizing & shape
                            width: 'auto',
                            minWidth: 0,
                            height: 46,
                            margin: 'auto',
                            borderRadius: '28px',

                            // colors & effects
                            background: darkModeReducer
                                ? "linear-gradient(135deg, rgba(20,20,20,0.5) 0%, rgba(10,10,10,0.2) 100%)"
                                : "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)",
                            backdropFilter: "blur(20px) saturate(180%)",
                            border: darkModeReducer ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.4)",
                            color: darkModeReducer ? 'white' : 'black',
                            boxShadow: darkModeReducer ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(31,38,135,0.07)",

                            '&:hover': {
                                background: darkModeReducer
                                    ? "linear-gradient(135deg, rgba(30,30,30,0.6) 0%, rgba(20,20,20,0.3) 100%)"
                                    : "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 100%)",
                            },

                            // layout


                            opacity: 1,
                            px: 2.25,
                            textTransform: 'none',
                            fontWeight: 700,
                        }}
                    >
                        UPLOAD
                    </Button>
                </label>



                {/* 1. HIDDEN INPUT (Handles the actual file selection logic)  modelz === 'Schnell' || modelz === 'Models' */}
                <input
                    ref={fileInputRef} // Attach ref here so MediaPrompt can click it remotely
                    accept="image/*"
                    type="file"
                    id="flux-image-input"
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                />

                <input
                    // ref={fileInputRefvv} alert
                    accept="image/*"
                    type="filejj"
                    id="flux-image-inputkkk"
                    style={{ display: 'none' }}
                // onChange={onFileChangex}
                />





                {/* Legacy one-scene video overlay removed: it shared generated-video storage and could delete a generated result. */}






                <Modal
                    open={isLipSyncProModalOpen}
                    onClose={() => setIsLipSyncProModalOpen(false)}
                    disableRestoreFocus
                    sx={{ zIndex: 1000000 }}
                >
                    <Box
                        onClick={(event) => event.stopPropagation()}
                        sx={{
                            position: "fixed",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "min(92vw, 720px)",
                            maxHeight: "90dvh",
                            overflowY: "auto",
                            p: { xs: 2, sm: 3 },
                            borderRadius: 4,
                            color: darkModeReducer ? "#fff" : "#121212",
                            background: darkModeReducer ? "rgba(17,17,21,0.96)" : "rgba(255,255,255,0.98)",
                            border: darkModeReducer ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(0,0,0,0.12)",
                            boxShadow: "0 28px 90px rgba(0,0,0,0.48)",
                        }}
                    >
                        <IconButton
                            aria-label="Close Lip Sync Pro"
                            onClick={() => setIsLipSyncProModalOpen(false)}
                            sx={{ position: "absolute", top: 10, right: 10, color: "inherit" }}
                        >
                            <CloseIcon />
                        </IconButton>
                        <Typography variant="h6" sx={{ fontWeight: 800, pr: 5 }}>
                            Lip Sync 2 Pro
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.72, mt: 0.5, mb: 2 }}>
                            Uses this generated scene video and its exact music snippet.
                        </Typography>

                        {directLipSyncVideoPreview && (
                            <video
                                src={directLipSyncVideoPreview}
                                controls
                                muted
                                playsInline
                                style={{ width: "100%", maxHeight: "42dvh", objectFit: "contain", borderRadius: 12, background: "#000" }}
                            />
                        )}

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" sx={{ display: "block", mb: 0.75, opacity: 0.7 }}>
                                Scene lip-sync audio
                            </Typography>
                            {hasLipSyncAudio ? (
                                <audio src={activeLipSyncAudioUrl} controls style={{ width: "100%" }} />
                            ) : (
                                <Typography variant="body2" sx={{ opacity: 0.78 }}>
                                    No scene audio exists yet. Generate creates the same trimmed snippet as the Lipsync button first.
                                </Typography>
                            )}
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mt: 2.5, mb: 1.5, flexWrap: "wrap" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {directLipSyncSeconds}s Â· ${directLipSyncDollars.toFixed(4)} Â· {directLipSyncPixels} pixels
                            </Typography>
                            <Button
                                onClick={handleDirectLipSyncGenerate}
                                disabled={isLipSyncProGenerating || !canUseDirectLipSync}
                                startIcon={isLipSyncProGenerating ? <CircularProgress size={16} color="inherit" /> : <RecordVoiceOver />}
                                sx={{ bgcolor: darkMode ? "#E8BAFA" : "#0099cc", color: "#111", fontWeight: 800, px: 2.2, "&:hover": { bgcolor: darkMode ? "#D4A1E5" : "#0088b8" } }}
                            >
                                {isLipSyncProGenerating ? "Generatingâ€¦" : (activeLipSyncProJob?.state === "succeeded" ? "Generate Again" : (activeLipSyncProJob?.state === "failed" ? "Generate Again" : "Generate Lip Sync Pro"))}
                            </Button>
                        </Box>
                        {lipSyncProStatus && (
                            <Typography variant="body2" sx={{ color: darkMode ? "#E8BAFA" : "#00719a" }}>
                                {lipSyncProStatus}
                            </Typography>
                        )}
                    </Box>
                </Modal>
                {/* MAIN IMAGE CONTAINER */}
                <Box
                    className={darkMode ? "contentdarkColor" : "contentColor"}
                    onDragStart={(e) => e.preventDefault()}
                    onWheel={(e) => {
                        if (!isArrayMode || Math.abs(e.deltaX) < 30) return;
                        const now = Date.now();
                        if (now - lastSwipeTimeRef.current < 600) return;
                        lastSwipeTimeRef.current = now;

                        if (e.deltaX > 0) goToNextScene();
                        else goToPreviousScene();
                    }}
                    onTouchStart={(e) => {
                        touchStartXRef.current = e.targetTouches[0].clientX;
                    }}
                    onTouchMove={(e) => {
                        touchEndXRef.current = e.targetTouches[0].clientX;
                    }}
                    onTouchEnd={() => {
                        if (touchStartXRef.current === null || touchEndXRef.current === null || !isArrayMode) {
                            touchStartXRef.current = null;
                            touchEndXRef.current = null;
                            return;
                        }

                        const distance = touchStartXRef.current - touchEndXRef.current;
                        if (Math.abs(distance) > 50) {
                            lastSwipeTimeRef.current = Date.now();
                            if (distance > 50) goToNextScene();
                            if (distance < -50) goToPreviousScene();
                        }

                        touchStartXRef.current = null;
                        touchEndXRef.current = null;
                    }}
                    onMouseDown={(e) => {
                        if (!matchMobile) {
                            touchStartXRef.current = e.clientX;
                            touchEndXRef.current = e.clientX;
                        }
                    }}
                    onMouseMove={(e) => {
                        if (!matchMobile && e.buttons === 1 && touchStartXRef.current !== null) {
                            touchEndXRef.current = e.clientX;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!matchMobile && touchStartXRef.current !== null && touchEndXRef.current !== null && isArrayMode) {
                            const distance = touchStartXRef.current - touchEndXRef.current;
                            if (Math.abs(distance) > 50) {
                                if (distance > 50) goToNextScene();
                                if (distance < -50) goToPreviousScene();
                            }
                        }
                        touchStartXRef.current = null;
                        touchEndXRef.current = null;
                    }}
                    onMouseUp={(e) => {
                        if (matchMobile) return;
                        if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
                            const distance = touchStartXRef.current - touchEndXRef.current;

                            if (Math.abs(distance) > 50 && isArrayMode) {
                                if (distance > 50) goToNextScene();
                                if (distance < -50) goToPreviousScene();
                            } else if (isZoomPreview && Math.abs(distance) < 5) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const edgeWidth = rect.width * 0.25;
                                if (clickX < edgeWidth && index > 0) {
                                    goToPreviousScene();
                                } else if (clickX > rect.width - edgeWidth && index < steps.length - 1) {
                                    goToNextScene();
                                }
                            }
                        }
                        touchStartXRef.current = null;
                        touchEndXRef.current = null;
                    }}
                    sx={{
                        flexDirection: "column",
                        position: "absolute",
                        top: { xs: 0, md: 0 },
                        left: 0,
                        width: { xs: "100%", md: isZoomPreview ? "100%" : mediaPanelWidth },
                        height: { xs: previewHeight, md: "100%" },
                        display: "flex",
                        alignItems: isZoomPreview && matchMobile ? "flex-start" : "center",
                        justifyContent: isZoomPreview && matchMobile ? "flex-start" : "center",
                        zIndex: 1,
                        overflowX: "auto",
                        overflowY: isZoomPreview && matchMobile ? "auto" : "hidden",
                        "&::-webkit-scrollbar": { display: "none" },
                        overscrollBehaviorX: "none",
                        touchAction: "pan-y",
                        borderRight: { xs: "none", md: isZoomPreview ? "none" : shellBorder },
                        borderTopLeftRadius: isZoomPreview ? 0 : { xs: 0, sm: 24 },
                        borderBottomLeftRadius: isZoomPreview ? 0 : { xs: 0, sm: 24 },
                        bgcolor: isZoomPreview ? "transparent" : (darkModeReducer ? "#111214" : "#ffffff"),
                        p: 0,
                        transition: matchMobile ? "all 0.25s ease" : "none",
                        "& .nav-arrow": { opacity: 0, transition: "opacity 0.2s" },
                        "&:hover .nav-arrow": { opacity: 1 },
                    }}
                >
                    {/* 2. NEW COMPONENT (Handles UI logic and display) */}
                    {show && (
                        (isBShotGridContext ? narrate === 2 : VideMode) ? (
                            // --- VIDEO MODE UI ---
                            <MediaPromptVideo
                                onClose={() => { }}
                                animateState={animateState}
                                setAnimateState={setAnimateState}
                                trimmedVideoUrl={trimmedVideoUrl}
                                setTrimmedVideoUrl={setTrimmedVideoUrl}

                                videoDurationCap={time}
                                index={index}
                                VideoArrayCloud={VideoArrayCloud}
                                currentImage={ImagesHdCloud[index]}
                                onSelectStepback={handleSelectVideoStepback}
                                onExtractFrame={handleExtractFrame}
                                onResetToDefault={() => {
                                    const originalUrl = defaultVideoStartFrames[index] || generatedImagesFlux[index];

                                    if (!originalUrl) {
                                        globalErrorEmitter.emit("No default image found for this scene.", index);
                                        return;
                                    }

                                    if (setImagesHdCloud) {
                                        setImagesHdCloud((prev: any) => {
                                            const next = Array.isArray(prev) ? [...prev] : [];
                                            next[index] = originalUrl;
                                            return next;
                                        });
                                    }

                                    if (setGeneratedImagesFlux) {
                                        setGeneratedImagesFlux((prev: any) => {
                                            const next = Array.isArray(prev) ? [...prev] : [];
                                            next[index] = originalUrl;
                                            return next;
                                        });
                                    }

                                    if (setGeneratedImagesFluxBlob) {
                                        setGeneratedImagesFluxBlob((prev: any) => {
                                            const next = Array.isArray(prev) ? [...prev] : [];
                                            next[index] = null;
                                            return next;
                                        });
                                    }

                                    if (setGeneratedImagesFluxBlobHd) {
                                        setGeneratedImagesFluxBlobHd((prev: any) => {
                                            const next = Array.isArray(prev) ? [...prev] : [];
                                            next[index] = null;
                                            return next;
                                        });
                                    }
                                }}

                                // New Props
                                onToggleContext={handleToggleContext}
                                isDirectMode={noImagePrompt[nativeSlotIndex]} // Read from NATIVE state array

                                darkMode={darkModeReducer}
                                matchMobile={matchMobile}
                                CreationMode={CreationMode}
                                onGenerate={GenerateVideox}
                            />
                        ) : (
                            // --- IMAGE MODE UI (Original) ---
                            <MediaPrompt
                                Vipcharacters={Vipcharacters}
                                setVipcharacters={setVipcharacters}
                                setReferenceImages={setReferenceImages}

                                worldModelsInuse={worldModelsInuse}
                                setWorldModelsInuse={setWorldModelsInuse}
                                resultImages={resultHistory[index] || []} // NEW: Pass history

                                onFileChange={onFileChange}

                                PostId={PostId}
                                selectedStyle={selectedStyle}
                                Planx={Planx}
                                Seed={Seed}

                                steps={steps}

                                modelz={modelz}



                                ImagesHdCloud={ImagesHdCloud}
                                setGeneratedImagePrompt={setGeneratedImagePrompt}
                                generatedImagePrompt={generatedImagePrompt}
                                // Data Context
                                index={index}
                                type={type || 0}

                                onImageUrlChange={onImageUrlChange}
                                // Raw Data
                                generatedImagesFlux={generatedImagesFlux}
                                FluxIm={FluxIm}
                                GeneratedImage={GeneratedImages3}

                                // State & Setters
                                selectedPromptImages={currentSelectedPrompts}
                                onUpdatePromptSelection={handleUpdatePromptSelection}

                                selectedFinalImages={currentSelectedFinals}
                                onUpdateFinalSelection={handleUpdateFinalSelection}

                                // UI
                                fileInputRef={fileInputRef}
                                darkMode={darkModeReducer}
                                matchMobile={matchMobile}
                            />
                        )
                    )}

                    {type === 1 ? (
                        /* ---------- SINGLE MODE ---------- */
                        VideMode && currentVideo ? (
                        <CustomVideoPlayer
                            ref={(player) => { sceneVideoPreviewRefs.current[index] = player; }}
                            src={currentVideo}
                            isActive
                            showDirectLipSync={canUseDirectLipSync}
                            isDirectLipSyncGenerating={isLipSyncProGenerating}
                            onDirectLipSync={openDirectLipSync}
                            isZoomPreview={isZoomPreview}
                            matchMobile={matchMobile}
                            togglePreviewMode={togglePreviewMode}
                            style={{
                                height: isZoomPreview ? (matchMobile ? "100dvh" : "100vh") : "100%",
                                width: "100%",
                                maxWidth: "100%",
                                objectFit: isZoomPreview ? "contain" : "cover",
                                objectPosition: matchMobile && !isZoomPreview ? "center 35%" : "center",
                                cursor: "pointer",
                                display: "block",
                            }}
                        />
                        ) : (
                        <img
                            onClick={() => togglePreviewMode()}
                            src={currentDisplayedImage}
                            alt={`Step ${index + 1}`}
                            style={{
                                height: isZoomPreview ? (matchMobile ? "auto" : "100vh") : "100%",
                                width: "100%",
                                maxWidth: "100%",
                                objectFit: isZoomPreview ? "contain" : "cover",
                                objectPosition: matchMobile && !isZoomPreview ? "center 35%" : "center",
                                cursor: "pointer",
                                display: "block",
                                transform: (currentDisplayedImage && nanoImages && currentDisplayedImage === nanoImages[isArrayMode ? index : 0]) ? "scale(0.8)" : "none",
                                transition: "transform 0.3s ease",
                            }}
                        />
                        )
                    ) : (
                        /* ---------- ARRAY MODE: self-contained, snap-scroll slider ---------- */
                        <Box
                            ref={sliderRef}          // ÃƒÂ¢Ã¢â‚¬Â Ã‚Â new
                            onScroll={handleScroll}  // ÃƒÂ¢Ã¢â‚¬Â Ã‚Â new
                            sx={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                overflowX: "hidden",
                                transform: "translate(-0%, -0%)",
                                transition: matchMobile ? "transform 0.25s ease" : "none",
                            }}
                        >

                            {steps.map((img: string, i: number) => (
                                <Box
                                    key={i}
                                    sx={{
                                        flex: "0 0 100%",
                                        height: "100%",
                                        position: "relative",
                                        display: i === index ? "flex" : "none",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        px: 0,
                                        py: 0,
                                        width: "100%",
                                        marginTop: 0,
                                    }}
                                >
                                    {/* Upscale Icon */}
                                    {
                                        /* HIDE IF:
                                            1. It's a video
                                            2. Narration mode is active (2)
                                            3. Image is already upscaled (URL contains 'upscaled')
                                        */
                                        !VideoArray[i] && narrate !== 2 &&
                                        (!generatedImagesFlux[i] || !generatedImagesFlux[i].includes("upscaled")) && (
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpscale(i);
                                                }}
                                                sx={{
                                                    position: "absolute",
                                                    top: matchMobile ? "5%" : "5%",
                                                    right: matchMobile ? "5%" : "7vw", // Moved left on PC
                                                    zIndex: 9999, // Ensure it's on top of everything
                                                    backgroundColor: darkModeReducer
                                                        ? "rgba(0, 0, 0, 0.5)"
                                                        : "rgba(255, 255, 255, 0.5)",
                                                    backdropFilter: "blur(10px)",
                                                    p: 1,
                                                    color: darkModeReducer ? "#fff" : "#000",
                                                    boxShadow: 3,
                                                    display: 'none',

                                                    "&:hover": {
                                                        backgroundColor: darkModeReducer
                                                            ? "rgba(0, 0, 0, 0.7)"
                                                            : "rgba(255, 255, 255, 0.7)",
                                                    },
                                                }}
                                            >
                                                {isUpscaling[i] ? (
                                                    <CircularProgress size={24} color="inherit" />
                                                ) : (
                                                    <AutoFixHighIcon />
                                                )}
                                            </IconButton>
                                        )}

                                    {/* Upscaling Text Overlay */}
                                    {isUpscaling[i] && (
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                position: "absolute",
                                                top: "20vh",
                                                left: 0,
                                                right: 0,
                                                textAlign: "center",
                                                color: "#fff",
                                                zIndex: 9999,
                                                fontWeight: "bold",
                                                textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
                                                pointerEvents: "none", // Allow clicks to pass through
                                            }}
                                        >
                                            Upscaling...
                                        </Typography>
                                    )}

                                    {((narrate === 2 || (narrate === 1 && VideMode)) && VideoArray[i]) ?
                                        <CustomVideoPlayer
                                            ref={(player) => { sceneVideoPreviewRefs.current[i] = player; }}
                                            src={VideoArray[i]}
                                            isActive={index === i}
                                            showDirectLipSync={index === i && canUseDirectLipSync}
                                            isDirectLipSyncGenerating={index === i && isLipSyncProGenerating}
                                            onDirectLipSync={openDirectLipSync}
                                            isZoomPreview={isZoomPreview}
                                            matchMobile={matchMobile}
                                            togglePreviewMode={togglePreviewMode}
                                            style={{
                                                height: isZoomPreview ? (matchMobile ? "100dvh" : "100vh") : "100%",
                                                width: "100%",
                                                maxWidth: "100%",
                                                objectFit: isZoomPreview ? "contain" : "cover",
                                                objectPosition: matchMobile && !isZoomPreview ? "center 35%" : "center",
                                                cursor: "pointer",
                                                display: "block",
                                            }}
                                        />
                                        :

                                        <img
                                            onClick={() => togglePreviewMode()}
                                            src={generatedImagesFlux[i] || (nanoImages && nanoImages[i]) || fallbackImage}
                                            alt={`Step ${i + 1}`}
                                            style={{
                                                height: isZoomPreview ? (matchMobile ? "100dvh" : "100vh") : "100%",
                                                width: "100%",
                                                maxWidth: "100%",
                                                objectFit: isZoomPreview ? "contain" : "cover",
                                                objectPosition: matchMobile && !isZoomPreview ? "center 35%" : "center",
                                                cursor: "pointer",
                                                display: "block",
                                                transform: (!generatedImagesFlux[i] && (nanoImages && nanoImages[i])) ? "scale(0.8)" : "none",
                                                transition: "transform 0.3s ease",
                                            }}
                                        />}

                                    {/* Direct Video Upload Button */}
                                    {
                                        narrate === 2 && show && (
                                            <div style={{ position: 'absolute', top: matchMobile ? "5%" : "5%", right: matchMobile ? "5%" : "7vw", zIndex: 9999, display: 'none' }}>
                                                <input
                                                    accept="video/*"
                                                    style={{ display: 'none' }}
                                                    id={`video-upload-direct-${i}`}
                                                    type="file"
                                                    onChange={(e) => handleVideoUploadDirect(e, i)}
                                                />
                                                <label htmlFor={`video-upload-direct-${i}`}>
                                                    <IconButton
                                                        component="span"
                                                        sx={{
                                                            backgroundColor: darkModeReducer
                                                                ? "rgba(0, 0, 0, 0.5)"
                                                                : "rgba(255, 255, 255, 0.5)",
                                                            backdropFilter: "blur(10px)",
                                                            p: 1,
                                                            color: darkModeReducer ? "#fff" : "#000",
                                                            boxShadow: 3,
                                                            "&:hover": {
                                                                backgroundColor: darkModeReducer
                                                                    ? "rgba(0, 0, 0, 0.7)"
                                                                    : "rgba(255, 255, 255, 0.7)",
                                                            },
                                                        }}
                                                    >
                                                        <UploadIcon />
                                                    </IconButton>
                                                </label>
                                            </div>
                                        )
                                    }

                                </Box>
                            ))}
                        </Box>
                    )}


                    {loader > 0 && (


                        <Box
                            sx={{
                                position: "absolute",
                                top: matchMobile ? (show ? "10vh" : "50dvh") : "35%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                width: "100%",
                                height: "0px",
                                background: "rgba(0,0,0,.35)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 2,
                                zIndex: 2,

                            }}
                        >
                            <GlowWidthBar
                                value={loader}
                                matchMobile={matchMobile}
                                index={index}
                            />



                        </Box>
                    )}

                    {(!matchMobile || (matchMobile && isZoomPreview)) && type === 0 && steps.length > 1 && (
                        <>
                            <Box
                                className="nav-edge-left"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (index > 0) goToPreviousScene();
                                    else setIndex?.(steps.length - 1);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                sx={{
                                    position: isZoomPreview ? "fixed" : "absolute",
                                    left: 0,
                                    top: 0,
                                    width: isZoomPreview ? "18vw" : "18%",
                                    height: "100%",
                                    zIndex: 20,
                                    cursor: "pointer",
                                    transition: "background 0.3s ease",
                                    "&:hover": {
                                        background: darkMode
                                            ? "linear-gradient(to right, rgba(255,255,255,0.15) 0%, transparent 100%)"
                                            : "linear-gradient(to right, rgba(0,0,0,0.3) 0%, transparent 100%)"
                                    },
                                }}
                            />
                            <Box
                                className="nav-edge-right"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (index < steps.length - 1) goToNextScene();
                                    else setIndex?.(0);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                sx={{
                                    position: isZoomPreview ? "fixed" : "absolute",
                                    right: 0,
                                    top: 0,
                                    width: isZoomPreview ? "18vw" : "18%",
                                    height: "100%",
                                    zIndex: 20,
                                    cursor: "pointer",
                                    transition: "background 0.3s ease",
                                    "&:hover": {
                                        background: darkMode
                                            ? "linear-gradient(to left, rgba(255,255,255,0.15) 0%, transparent 100%)"
                                            : "linear-gradient(to left, rgba(0,0,0,0.3) 0%, transparent 100%)"
                                    },
                                }}
                            />
                        </>
                    )}
                </Box>

                {/* TOP RIGHT ACTIONS */}
                <Box
                    sx={{
                        position: "absolute",
                        top: { xs: 'calc(8px + 1vh)', sm: 18 },
                        right: { xs: 'calc(20px - 2vw)', sm: 20 },
                        zIndex: 30000,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    {false && !VideoArray[index] && narrate !== 2 &&
                        (!generatedImagesFlux[index] || !generatedImagesFlux[index].includes("upscaled")) && (
                            <IconButton
                                onClick={() => handleUpscale(index)}
                                sx={topUtilityButtonSx}
                            >
                                {isUpscaling[index] ? (
                                    <CircularProgress size={20} color="inherit" />
                                ) : (
                                    <AutoFixHighIcon />
                                )}
                            </IconButton>
                        )}

                    {false && narrate === 2 && show && (
                        <>
                            <input
                                accept="video/*"
                                style={{ display: 'none' }}
                                id={`video-upload-direct-header-${index}`}
                                type="file"
                                onChange={(e) => handleVideoUploadDirect(e, index)}
                            />
                            <label htmlFor={`video-upload-direct-header-${index}`}>
                                <Button
                                    component="span"
                                    startIcon={<UploadIcon />}
                                    sx={{ ...topUtilityButtonSx, px: 2.25, fontWeight: 700 }}
                                >
                                    Upload Video
                                </Button>
                            </label>
                        </>
                    )}

                    <IconButton
                        onClick={() => {
                            if (setstartEdit) setstartEdit(false);
                        }}
                        sx={{
                            ...topUtilityButtonSx,
                            color: darkMode ? "#ffffff" : "#000000",
                            display: matchMobile ? 'flex' : 'none',
                        }}
                    >
                        <CloseIcon style={{ fontSize: "1.4rem", opacity: 0.9 }} />
                    </IconButton>
                </Box>
                {/* BASE PICKER THUMBNAIL */}


                {

                    modelz === 'Flux Pro' ? show && narrate !== 1 ? (
                        <FilePicker
                            Once={Once}
                            setOnce={setOnce}
                            startEdit={startEdit}
                            type={type}
                            generatedImagesFlux={generatedImagesFlux}
                            GeneratedImage={GeneratedImage}
                            FluxIm={FluxIm}
                            base={base}
                            setbase={setbase}
                            handleExistingUrl={handleExistingUrl}
                            handleFileChange={handleFileChange}
                            index={index}
                            fallbackImage={fallbackImage}
                            show={false}
                            compact
                            showPreviewThumb={false}

                        />
                    ) : null

                        : null
                }



                {/* TEXT PROMPT AND DRAW BUTTON */}

                {

                    showRemix ? null :
                        <Box
                            sx={{
                                position: "absolute",
                                top: { xs: mobileControlTop, md: 0 },
                                left: { xs: 0, md: `calc(100% - ${controlPanelWidth})` },
                                width: { xs: "100%", md: controlPanelWidth },
                                height: { xs: mobileControlHeight, md: "100%" },
                                borderRadius: { xs: "28px 28px 0 0", md: "0" },
                                p: matchMobile ? 2 : 3.25,
                                color: darkMode ? "#fff" : "#000",
                                background: glassPanelBg,
                                backdropFilter: "blur(30px) saturate(180%)",
                                borderLeft: { xs: "none", md: shellBorder },
                                borderTop: { xs: shellBorder, md: "none" },
                                boxShadow: "none",
                                zIndex: 2,
                                display: show && narrate === 0 ? "flex" : "none",
                                flexDirection: "column",
                                gap: 2,
                                overflowX: "hidden",
                                overflowY: "auto",
                            }}
                        >
                            <Box sx={{ position: "relative", ...panelHeaderRowSx }}>
                                {/* LEFT END: Upscale */}
                                <Box sx={{ display: "flex", visibility: 'hidden', alignItems: "center", gap: 0.8 }}>
                                    {!VideoArray[index] && (
                                        <Button
                                            onClick={() => {
                                                if (generatedImagesFlux[index] && generatedImagesFlux[index].includes("upscaled")) return;
                                                handleUpscale(index);
                                            }}
                                            startIcon={isUpscaling[index] ? <CircularProgress size={16} color="inherit" /> : (generatedImagesFlux[index] && generatedImagesFlux[index].includes("upscaled")) ? null : <AutoFixHighIcon sx={{ fontSize: "1rem", color: darkMode ? "#E8BAFA" : "#0099cc" }} />}
                                            sx={{
                                                ...compactGlassButtonSx,
                                                opacity: (generatedImagesFlux[index] && generatedImagesFlux[index].includes("upscaled")) ? 0.6 : 1,
                                                cursor: (generatedImagesFlux[index] && generatedImagesFlux[index].includes("upscaled")) ? "default" : "pointer"
                                            }}
                                            disableRipple={generatedImagesFlux[index] && generatedImagesFlux[index].includes("upscaled")}
                                        >
                                            {generatedImagesFlux[index] && generatedImagesFlux[index].includes("upscaled") ? "HD" : "Upscale"}
                                        </Button>
                                    )}
                                </Box>

                                {/* MIDDLE: Images / Narration */}
                                {isBShotGridContext ? (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            zIndex: 30,
                                            fontSize: '0.8rem',
                                            color: darkModeReducer ? "#fff" : "#000",
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            p: 0.5,
                                            borderRadius: 999,
                                            background: darkModeReducer
                                                ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
                                                : "linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.4) 100%)",
                                            backdropFilter: "blur(16px) saturate(180%)",
                                            border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.72)",
                                            boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.24)" : "0 8px 20px rgba(31,38,135,0.08)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <Box onClick={() => setnarrate(0)} style={{
                                            padding: matchMobile ? '6px 14px' : '6px 18px',
                                            opacity: narrate === 0 ? 1 : 0.45,
                                            borderRadius: '999px',
                                            background: narrate === 0
                                                ? (darkModeReducer ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)')
                                                : 'transparent',
                                            display: 'block'
                                        }}>
                                            Images
                                        </Box>
                                        <Box onClick={() => setnarrate(2)} style={{
                                            padding: matchMobile ? '6px 14px' : '6px 18px',
                                            opacity: narrate === 2 ? 1 : 0.45,
                                            borderRadius: '999px',
                                            background: narrate === 2
                                                ? (darkModeReducer ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)')
                                                : 'transparent',
                                            display: 'block'
                                        }}>
                                            Videos
                                        </Box>
                                    </Box>
                                ) : (VideMode || isBShotModeActive) ? (
                                    <Box sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 2.25,
                                        position: "absolute",
                                        left: "50%",
                                        transform: "translateX(-50%)"
                                    }}>
                                        <Box onClick={() => setnarrate(0)} sx={{
                                            ...panelTabSx(narrate === 0),
                                            padding: matchMobile ? '6px 14px' : '6px 18px',
                                        }}>
                                            Images
                                        </Box>
                                        <Box onClick={() => setnarrate(2)} sx={{
                                            ...panelTabSx(narrate === 2),
                                            padding: matchMobile ? '6px 14px' : '6px 18px',
                                        }}>
                                            Videos
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 2.25,
                                        position: "absolute",
                                        left: "50%",
                                        transform: "translateX(-50%)"
                                    }}>
                                        <Box onClick={() => setnarrate(0)} sx={panelTabSx(narrate === 0)}>
                                            Images
                                        </Box>
                                        {((pageType === 1 && index % 2 !== 0) ? false : true) && !isBShotGridContext && (
                                            <Box onClick={() => setnarrate(1)} sx={panelTabSx(narrate === 1)}>
                                                Narration
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* RIGHT END: Upload */}
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                    <label htmlFor="flux-image-input">
                                        <Button component="span" startIcon={<UploadIcon />} sx={compactGlassButtonSx}>
                                            Upload
                                        </Button>
                                    </label>
                                    {modelz === 'Flux Pro' && narrate !== 1 ? (
                                        <FilePicker
                                            Once={Once}
                                            setOnce={setOnce}
                                            startEdit={startEdit}
                                            type={type}
                                            generatedImagesFlux={generatedImagesFlux}
                                            GeneratedImage={GeneratedImage}
                                            FluxIm={FluxIm}
                                            base={base}
                                            setbase={setbase}
                                            handleExistingUrl={handleExistingUrl}
                                            handleFileChange={handleFileChange}
                                            index={index}
                                            fallbackImage={fallbackImage}
                                            show={show}
                                            compact
                                            showPreviewThumb={false}
                                        />
                                    ) : null}
                                </Box>
                            </Box>


                            {musicMode && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        flexWrap: "wrap",
                                        mt: -0.75,
                                        mb: 0.25,
                                    }}
                                >
                                    <Button
                                        type="button"
                                        startIcon={isSnippetPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                        onClick={handleSnippetToggle}
                                        sx={{
                                            ...compactGlassButtonSx,
                                            opacity: musicModeUrl ? 1 : 0.5,
                                            cursor: musicModeUrl ? "pointer" : "not-allowed",
                                        }}
                                    >
                                        Snippet
                                    </Button>
                                </Box>
                            )}

                            <Typography variant="overline" sx={{ ...sectionTitleSx, mt: 4, display: 'block' }}>
                                Update with AI
                            </Typography>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "stretch",
                                    width: "100%",
                                }}
                            >
                                <Box sx={{ flex: "1 1 20%", minWidth: 0 }}>
                                    <TextField

                                        variant="outlined"
                                        fullWidth

                                        // keep your original handlers/values
                                        onKeyDown={handleKeyDown}
                                        value={textValuex}
                                        onChange={handleChangex}
                                        placeholder="Describe change to Gpt"

                                        // Notepad triggers (same as your working field)
                                        onFocus={() => {

                                            // setIsNotepadOpen(true);
                                        }}
                                        onClick={(e: any) => {
                                            handlePromptShellCaret(e);
                                            setIsNotepadOpen(true);
                                        }}
                                        onBlur={() => {
                                            // let the Notepad dialog manage closing; just reset back button state

                                        }}

                                        // visuals: UNCHANGED except opacity now also dims when Notepad is open
                                        sx={{
                                            ...fieldShellSx,
                                            "& .MuiInputBase-root:focus": { outline: "none" },
                                            "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                            "& .Mui-focused": { outline: "none" },
                                            "& .MuiInputBase-input": {
                                                ...defaultFieldTextSx,
                                                fontSize: "0.85rem",
                                                fontFamily: "monospace",
                                                color: darkMode ? "#ccc" : "#444"
                                            },

                                            // original opacity rule preserved, plus dim when Notepad is open
                                            opacity: isNotepadOpen ? "0.03" : 1,

                                            "& .MuiInputLabel-root": {
                                                color: darkMode ? "#ffffff" : "#000000",
                                                fontFamily: editorFontFamily,
                                                fontSize: "0.95rem",
                                                lineHeight: 1.55,
                                            },
                                        }}

                                        // read-only shell so edits come from the Notepad dialog
                                        slotProps={{
                                            htmlInput: {
                                                readOnly: true,
                                                "aria-label": "Change Request Input",
                                                onKeyDown: (e: any) => { e.preventDefault(); }, // block typing in shell
                                                autoCorrect: "on",
                                                spellCheck: true,
                                                autoCapitalize: "sentences",
                                                autoComplete: "off",
                                            },
                                        }}
                                    />
                                </Box>
                                {/* RIGHT/ATTACHED: Notepad dialog host (same wiring as your working one) */}
                                <Notepad
                                    Caret={Caret}
                                    handleKeyDown={handleKeyDown}

                                    TextFieldactive={TextFieldactive}
                                    setTextFieldactive={setTextFieldactive}

                                    GeneratedImage={''}
                                    panel
                                    type={200}
                                    darkMode={darkModeReducer}
                                    size={matchMobile ? "small" : "medium"}
                                    open={isNotepadOpen}
                                    setIsNotepadOpen={setIsNotepadOpen}
                                    placeholder="Describe change to Gpt"

                                    // this Notepad controls the second field's value
                                    value={textValuex}
                                    cachedImageGen={vidGenCaches[index] || { text: '', imageUrl: null }}
                                    onUpdateCachedImageGen={(newData) => {
                                        setVidGenCaches(prev => {
                                            const next = [...prev];
                                            next[index] = newData;
                                            return next;
                                        });
                                    }}
                                    onChange={(v: string) => {
                                        // Prefer a direct setter if you have one:
                                        if (typeof setTextValuex === "function") {
                                            setTextValuex(v);
                                        } else {
                                            // otherwise route through your existing handler
                                            try {
                                                // mimic a normal onChange event shape
                                                handleChangex({ target: { value: v } } as any);
                                            } catch {
                                                // final fallback: no-op to avoid crashes if handler not present
                                            }
                                        }
                                    }}

                                    onClose={() => {
                                        setIsNotepadOpen(false);

                                    }}

                                    // optionally mirror your other visibility rules
                                    hide={false}

                                    onSpeak={() => {
                                        console.log("Speak / mic with change request:", textValuex);
                                    }}
                                />
                            </Box>

                            <Typography variant="overline" sx={{ ...sectionTitleSx, color: '#888' }}>
                                Scene Image Prompt
                            </Typography>

                            {/* Mini Active Character Viewer Bar */}
                            {referenceImages && referenceImages.length > 0 && (
                                <Box sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    overflowX: "auto",
                                    overflowY: "hidden",
                                    minHeight: 80,
                                    m: 0,
                                    p: "14px 4px",
                                    gap: 1, // Restored clean padding between avatars
                                    "&::-webkit-scrollbar": { height: "4px" },
                                    "&::-webkit-scrollbar-track": { background: "transparent" },
                                    "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.15)", borderRadius: "10px" }
                                }}>
                                    {extendedReferenceImages.map((ref: any, idx: number) => {
                                        const currentModel = button || SelectedModel;
                                        if (ref.isMotion && currentModel !== 'Pro') {
                                            return null;
                                        }
                                        const isActivated = activeCharsForScene?.some((ac: any) => ac.name === ref.name);
                                        const themeColor = darkMode ? "#E8BAFA" : "#0099cc";
                                        const themeShadow = darkMode ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)";

                                        return (
                                            <Box key={idx} sx={{
                                                position: "relative",
                                                flexShrink: 0,
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                zIndex: isActivated ? 2 : 1
                                            }}>
                                                <Avatar
                                                    src={ref.imageUrl || ref.url}
                                                    alt={ref.name}
                                                    onClick={() => {
                                                        // Regular character/action/motion zoom logic
                                                        if (idx < (referenceImages?.length || 0)) {
                                                            setFullscreenCharIndex && setFullscreenCharIndex(idx);
                                                        } else {
                                                            setFullScreenActionImage(ref);
                                                        }
                                                    }}
                                                    imgProps={{ style: { objectPosition: 'top' } }}
                                                    sx={{
                                                        cursor: "pointer",
                                                        width: 54,
                                                        height: 54,
                                                        minWidth: 54,
                                                        minHeight: 54,
                                                        flexShrink: 0,
                                                        border: isActivated ? `2.5px solid ${themeColor}` : `1.5px solid rgba(255,255,255,0.15)`,
                                                        boxShadow: isActivated ? `0 0 12px ${themeShadow}` : "none",
                                                        opacity: isActivated ? 1 : 0.4,
                                                        transition: "all 0.3s ease"
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}


                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "stretch",
                                    width: "100%",
                                }}
                            >
                                <Box sx={{ flex: "1 1 20%", minWidth: 0 }}>
                                    <TextField
                                        variant="outlined"
                                        fullWidth
                                        multiline
                                        minRows={1}

                                        // keep your original handlers/values
                                        onKeyDown={handleKeyDown}
                                        value={textValue}
                                        onChange={handleChange}
                                        placeholder="Enter a Prompt To Recreate The Image"

                                        // Notepad triggers (same as your working field)
                                        onFocus={() => {
                                            /// setIsNotepadOpen2(true);
                                        }}
                                        onClick={(e: any) => {
                                            handlePromptShellCaret(e);
                                            setIsNotepadOpen2(true);
                                        }}
                                        onBlur={() => {
                                            // let the Notepad dialog manage closing if needed
                                        }}

                                        // visuals: EXACT ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only adds dim when Notepad is open
                                        sx={{
                                            ...fieldShellSx,
                                            "& .MuiInputBase-root:focus": { outline: "none" },
                                            "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                            "& .Mui-focused": { outline: "none" },
                                            "& .MuiInputBase-input": {
                                                ...defaultFieldTextSx,
                                                fontSize: "0.85rem",
                                                fontFamily: "monospace",
                                                color: darkMode ? "#ccc" : "#444"
                                            },
                                            mb: 1,
                                            maxHeight: matchMobile ? "20vh" : "16vh",
                                            overflow: "auto",
                                            opacity: isNotepadOpen2 ? "0.03" : 1,
                                        }}

                                        // read-only shell; Notepad writes into `textValue`
                                        slotProps={{
                                            htmlInput: {
                                                readOnly: true,
                                                "aria-label": "Prompt Recreate Input",
                                                onKeyDown: (e: any) => { e.preventDefault(); }, // block typing in shell
                                                autoCorrect: "on",
                                                spellCheck: true,
                                                autoCapitalize: "sentences",
                                                autoComplete: "off",
                                            },
                                        }}
                                    />
                                </Box>

                                {/* RIGHT: attached Notepad host (same wiring as your template) */}
                                <Notepad
                                    referenceImages={extendedReferenceImages}
                                    ImagesHdCloud={ImagesHdCloud}
                                    detectedCharacters={detectedCharacters}
                                    Caret={Caret}
                                    handleKeyDown={handleKeyDown}
                                    TextFieldactive={TextFieldactive}
                                    setTextFieldactive={setTextFieldactive}
                                    GeneratedImage={''}
                                    panel
                                    type={200}
                                    darkMode={darkModeReducer}
                                    size={matchMobile ? "small" : "medium"}
                                    open={isNotepadOpen2}
                                    setIsNotepadOpen={setIsNotepadOpen2}
                                    placeholder="Enter a Prompt To Recreate The Image"
                                    // Notepad controls THIS fieldÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s value
                                    value={textValue}
                                    cachedImageGen={vidGenCaches[index] || { text: '', imageUrl: null }}
                                    onUpdateCachedImageGen={(newData) => {
                                        setVidGenCaches(prev => {
                                            const next = [...prev];
                                            next[index] = newData;
                                            return next;
                                        });
                                    }}
                                    onChange={(v: string) => {
                                        if (typeof setTextValue === "function") {
                                            setTextValue(v);
                                        } else {
                                            try {
                                                handleChange({ target: { value: v } } as any);
                                            } catch { /* no-op */ }
                                        }
                                    }}

                                    onClose={() => {
                                        setIsNotepadOpen2(false);
                                    }}

                                    hide={false}
                                    onSpeak={() => {
                                        console.log("Speak / mic with recreate prompt:", textValue);
                                    }}
                                />
                            </Box>

                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
                                    gap: 1,
                                }}
                            >
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        setGeneratingAt(index, true); setGeneratingAt(index, true); startLoader(index);
                                        setTextValue(GeneratedTextx[index]);
                                        handleDraw(GeneratedTextx[index], GeneratedImages3, 0);
                                    }}
                                    sx={{
                                        ...optionPillSx,
                                        opacity: allowgetImage ? 1 : 0.35,
                                        boxShadow: "none",
                                    }}
                                >
                                    Default
                                </Button>

                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        callRemake('Make my image look better , enhance this scene like a master image Creator, maintaining all the relevant details but better with relatively same amount of text reorder it for perfection', textValue, prompt);
                                    }}
                                    sx={{
                                        ...optionPillSx,
                                        opacity: allowgetImage ? 1 : 0.35,
                                        boxShadow: "none",
                                    }}
                                >
                                    Enhance
                                </Button>

                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        callRemakeSafety(GeneratedTextx[index], textValue, prompt);
                                    }}
                                    sx={{
                                        ...optionPillSx,
                                        opacity: allowgetImage ? 1 : 0.35,
                                        boxShadow: "none",
                                    }}
                                >
                                    Safety
                                </Button>

                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        if (allowgetImage) {
                                            setshowRemix(true);
                                        }
                                    }}
                                    sx={{
                                        ...optionPillSx,
                                        opacity: allowgetImage ? 1 : 0.35,
                                    }}
                                >
                                    {`Remix ${pixelsk.toLocaleString()} P`}
                                </Button>
                            </Box>

                            <Box sx={{ mt: "auto", width: "100%", pb: matchMobile ? 8 : 0, display: "flex", gap: 2 }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        if (allowgetImage) {
                                            if (textValuex) {
                                                callRemake(textValuex, textValue, prompt);
                                            } else {
                                                handleDraw(textValue, GeneratedImages3, 0);
                                            }
                                        } else {
                                            if (textValuex) {
                                                callRemakePromptOnly(textValuex, textValue, prompt);
                                            } else {
                                                console.error("[EditStory] RECREATE clicked but allowgetImage is false! Calling setstartEdit(false)");
                                                setGeneratedText((prev: any) => {
                                                    const next = [...prev];
                                                    next[index] = textValue;
                                                    return next;
                                                });
                                                setstartEdit(false);
                                            }
                                        }
                                    }}
                                    sx={{
                                        ...greenPrimaryButtonSx,
                                        flex: 1,
                                    }}
                                >
                                    {allowgetImage ? `RECREATE ${pixelsc.toLocaleString()} P` : "UPDATE PROMPT"}
                                </Button>
                                <IconButton
                                    onClick={() => setShow(false)}
                                    sx={{
                                        width: 56, height: 56, borderRadius: 4, flexShrink: 0,
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        '&:hover': { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                                    }}
                                >
                                    <CloseIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                                </IconButton>
                            </Box>
                        </Box>


                }
                <Box
                    sx={{
                        position: "absolute",
                        top: { xs: mobileControlTop, md: 0 },
                        left: { xs: 0, md: `calc(100% - ${controlPanelWidth})` },
                        width: { xs: "100%", md: controlPanelWidth },
                        height: { xs: mobileControlHeight, md: "100%" },
                        p: matchMobile ? 2 : 3.25,
                        color: darkMode ? "#fff" : "#000",
                        background: glassPanelBg,
                        backdropFilter: "blur(30px) saturate(180%)",
                        borderLeft: { xs: "none", md: shellBorder },
                        borderTop: { xs: shellBorder, md: "none" },
                        boxShadow: "none",
                        display: show && narrate === 1 ? "flex" : "none",
                        flexDirection: "column",
                        gap: 2,
                        overflowX: "hidden",
                        overflowY: { xs: "auto", md: "hidden" },
                    }}
                >
                    <Box sx={{ position: "relative", minHeight: 40, ...panelHeaderRowSx }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.8, flexWrap: "wrap", visibility: "hidden", height: 0, overflow: "hidden" }}>
                            {VideMode ? (
                                <>
                                    <input
                                        accept="video/*"
                                        style={{ display: 'none' }}
                                        id={`video-upload-direct-panel-${index}`}
                                        type="file"
                                        onChange={(e) => handleVideoUploadDirect(e, index)}
                                    />
                                    <label htmlFor={`video-upload-direct-panel-${index}`}>
                                        <Button component="span" startIcon={<UploadIcon />} sx={compactGlassButtonSx}>
                                            Upload Video
                                        </Button>
                                    </label>
                                </>
                            ) : (
                                <label htmlFor="flux-image-input">
                                    <Button component="span" startIcon={<UploadIcon />} sx={compactGlassButtonSx}>
                                        Upload
                                    </Button>
                                </label>
                            )}
                            {modelz === 'Flux Pro' && narrate !== 1 ? (
                                <FilePicker
                                    Once={Once}
                                    setOnce={setOnce}
                                    startEdit={startEdit}
                                    type={type}
                                    generatedImagesFlux={generatedImagesFlux}
                                    GeneratedImage={GeneratedImage}
                                    FluxIm={FluxIm}
                                    base={base}
                                    setbase={setbase}
                                    handleExistingUrl={handleExistingUrl}
                                    handleFileChange={handleFileChange}
                                    index={index}
                                    fallbackImage={fallbackImage}
                                    show={show}
                                    compact
                                    showPreviewThumb={false}
                                />
                            ) : null}
                            {!VideMode && (
                                <Button
                                    onClick={() => {
                                        if (FluxIm && FluxIm.includes("upscaled")) return;
                                        handleUpscale(index);
                                    }}
                                    startIcon={isUpscaling[index] ? <CircularProgress size={16} color="inherit" /> : (FluxIm && FluxIm.includes("upscaled")) ? null : <AutoFixHighIcon sx={{ fontSize: "1rem", color: darkMode ? "#E8BAFA" : "#0099cc" }} />}
                                    sx={{
                                        ...compactGlassButtonSx,
                                        opacity: (FluxIm && FluxIm.includes("upscaled")) ? 0.6 : 1,
                                        cursor: (FluxIm && FluxIm.includes("upscaled")) ? "default" : "pointer",
                                        visibility: 'hidden',
                                    }}
                                    disableRipple={FluxIm && FluxIm.includes("upscaled")}
                                >
                                    {FluxIm && FluxIm.includes("upscaled") ? "HD" : "Upscale"}
                                </Button>
                            )}
                        </Box>
                        {isBShotGridContext ? (
                            <Box
                                sx={{
                                    position: "absolute",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 30,
                                    fontSize: '0.8rem',
                                    color: darkModeReducer ? "#fff" : "#000",
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    p: 0.5,
                                    borderRadius: 999,
                                    background: darkModeReducer
                                        ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
                                        : "linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.4) 100%)",
                                    backdropFilter: "blur(16px) saturate(180%)",
                                    border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.72)",
                                    boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.24)" : "0 8px 20px rgba(31,38,135,0.08)",
                                    cursor: "pointer",
                                }}
                            >
                                <Box onClick={() => setnarrate(0)} style={{
                                    padding: matchMobile ? '6px 14px' : '6px 18px',
                                    opacity: narrate === 0 ? 1 : 0.45,
                                    borderRadius: '999px',
                                    background: narrate === 0
                                        ? (darkModeReducer ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)')
                                        : 'transparent',
                                    display: 'block'
                                }}>
                                    Images
                                </Box>
                                <Box onClick={() => setnarrate(2)} style={{
                                    padding: matchMobile ? '6px 14px' : '6px 18px',
                                    opacity: narrate === 2 ? 1 : 0.45,
                                    borderRadius: '999px',
                                    background: narrate === 2
                                        ? (darkModeReducer ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)')
                                        : 'transparent',
                                    display: 'block'
                                }}>
                                    Videos
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2.25,
                                position: "absolute",
                                left: "50%",
                                transform: "translateX(-50%)"
                            }}>
                                <Box onClick={() => setnarrate((VideMode || isBShotModeActive) ? 2 : 0)} sx={panelTabSx(false)}>
                                    {(VideMode || isBShotModeActive) ? "Videos" : "Images"}
                                </Box>
                                <Box onClick={() => setnarrate(1)} sx={panelTabSx(narrate === 1)}>
                                    Narration
                                </Box>
                            </Box>
                        )}
                    </Box>
                    <Typography variant="overline" sx={{ ...sectionTitleSx, mt: 4, display: 'block' }}>
                        Update with AI
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "stretch",
                            width: "100%",

                        }}
                    >
                        {/* LEFT: shell TextField (read-only; Notepad edits the value) */}
                        <Box sx={{ flex: "1 1 20%", minWidth: 0 }}>
                            <TextField
                                variant="outlined"
                                fullWidth

                                // keep your original handlers/values
                                onKeyDown={handleKeyDownT}
                                value={textValuex2}
                                onChange={handleChangex2}
                                placeholder="Use Gpt"

                                // Notepad triggers
                                onFocus={() => {
                                    //setIsNotepadOpen3(true);
                                }}
                                onClick={(e: any) => {
                                    handlePromptShellCaret(e);
                                    setIsNotepadOpen3(true);
                                }}
                                onBlur={() => {
                                    // Notepad dialog controls closing
                                }}

                                // visuals: EXACT; only adds dim when Notepad is open
                                sx={{
                                    ...fieldShellSx,
                                    "& .MuiInputBase-root:focus": { outline: "none" },
                                    "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                    "& .Mui-focused": { outline: "none" },
                                    "& .MuiInputBase-input": {
                                        ...defaultFieldTextSx,
                                    },
                                    "& .MuiInputLabel-root": {
                                        color: darkMode ? "#ffffff" : "#000000",
                                        fontFamily: editorFontFamily,
                                        fontSize: "0.95rem",
                                        lineHeight: 1.55,
                                    },

                                    mb: 1,

                                    // dim while Notepad is open (matches your pattern)
                                    opacity: isNotepadOpen3 ? "0.03" : 1,
                                }}

                                // read-only shell; Notepad writes into `textValuex2`
                                slotProps={{
                                    htmlInput: {
                                        readOnly: true,
                                        "aria-label": "Use Gpt Input",
                                        onKeyDown: (e: any) => { e.preventDefault(); }, // block typing in shell
                                        autoCorrect: "on",
                                        spellCheck: true,
                                        autoCapitalize: "sentences",
                                        autoComplete: "off",
                                    },
                                }}
                            />
                        </Box>

                        {/* RIGHT: attached Notepad host */}
                        <Notepad
                            Caret={Caret}
                            handleKeyDown={handleKeyDownT}
                            TextFieldactive={TextFieldactive}
                            setTextFieldactive={setTextFieldactive}
                            GeneratedImage={''}
                            panel
                            type={200}
                            darkMode={darkModeReducer}
                            size={matchMobile ? "small" : "medium"}
                            open={isNotepadOpen3}
                            setIsNotepadOpen={setIsNotepadOpen3}
                            placeholder="Use Gpt"

                            // Notepad controls THIS fieldÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s value
                            value={textValuex2}
                            onChange={(v: string) => {
                                if (typeof setTextValuex2 === "function") {
                                    setTextValuex2(v);
                                } else {
                                    try {
                                        handleChangex2({ target: { value: v } } as any);
                                    } catch { /* no-op */ }
                                }
                            }}

                            onClose={() => {
                                setIsNotepadOpen3(false);
                            }}

                            hide={false}
                            onSpeak={() => {
                                console.log("Speak / mic with GPT field:", textValuex2);
                            }}
                        />
                    </Box>

                    {!isBShotGridContext && (
                        <>
                            <Typography variant="overline" sx={{ ...sectionTitleSx, color: '#888' }}>
                                Narration Text
                            </Typography>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "stretch",
                                    width: "100%",

                                }}
                            >
                                {/* LEFT: shell TextField (read-only; Notepad edits the value) */}
                                <Box sx={{ flex: "1 1 20%", minWidth: 0 }}>
                                    <TextField
                                        variant="outlined"
                                        fullWidth
                                        multiline
                                        minRows={1}

                                        // keep your original handlers/values
                                        onKeyDown={handleKeyDownT}
                                        value={textValueT}
                                        onChange={handleChangeT}
                                        placeholder="Enter Narration Text"

                                        // Notepad triggers
                                        onFocus={() => {
                                            //setIsNotepadOpen4(true);
                                        }}
                                        onClick={(e: any) => {
                                            handlePromptShellCaret(e);
                                            setIsNotepadOpen4(true);
                                        }}
                                        onBlur={() => {
                                            // Notepad dialog controls closing
                                        }}

                                        // visuals: EXACT; only adds dim when Notepad is open
                                        sx={{
                                            ...fieldShellSx,
                                            "& .MuiInputBase-root:focus": { outline: "none" },
                                            "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                            "& .Mui-focused": { outline: "none" },
                                            "& .MuiInputBase-input": {
                                                ...defaultFieldTextSx,
                                            },
                                            "& .MuiInputLabel-root": {
                                                color: darkMode ? "#ffffff" : "#000000",
                                                fontFamily: editorFontFamily,
                                                fontSize: "0.95rem",
                                                lineHeight: 1.55,
                                            },

                                            mb: 1,
                                            maxHeight: matchMobile ? '25vh' : '15vh',
                                            overflow: 'auto',
                                            overflowY: "scroll",
                                            overflowX: "hidden",
                                            scrollSnapType: "y mandatory",
                                            scrollBehavior: "smooth",
                                            overscrollBehavior: "contain",
                                            WebkitOverflowScrolling: "touch",
                                            "&::-webkit-scrollbar": {
                                                width: "8px",
                                            },
                                            "&::-webkit-scrollbar-track": {
                                                background: "rgb(255,255,255,0.2)",
                                            },
                                            "&::-webkit-scrollbar-thumb": {
                                                background: "rgb(150,150,150,0.8)",
                                                borderRadius: "4px",
                                            },
                                            "&::-webkit-scrollbar-thumb:hover": {
                                                background: "rgb(255,255,255,0.1)",
                                            },

                                            // dim while Notepad is open (matches your pattern)
                                            opacity: isNotepadOpen4 ? "0.03" : 1,
                                        }}

                                        // read-only shell; Notepad writes into `textValueT`
                                        slotProps={{
                                            htmlInput: {
                                                readOnly: true,
                                                "aria-label": "Narration Text Input",
                                                onKeyDown: (e: any) => { e.preventDefault(); }, // block typing in shell
                                                autoCorrect: "on",
                                                spellCheck: true,
                                                autoCapitalize: "sentences",
                                                autoComplete: "off",
                                            },
                                        }}
                                    />
                                </Box>

                                {/* RIGHT: attached Notepad host */}
                                <Notepad
                                    Caret={Caret}
                                    handleKeyDown={handleKeyDownT}
                                    TextFieldactive={TextFieldactive}
                                    setTextFieldactive={setTextFieldactive}
                                    GeneratedImage={''}
                                    panel
                                    type={200}
                                    darkMode={darkModeReducer}
                                    size={matchMobile ? "small" : "medium"}
                                    open={isNotepadOpen4}
                                    setIsNotepadOpen={setIsNotepadOpen4}
                                    placeholder="Enter Narration Text"

                                    // Notepad controls THIS fieldÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s value
                                    value={textValueT}
                                    onChange={(v: string) => {
                                        if (typeof setTextValueT === "function") {
                                            setTextValueT(v);
                                        } else {
                                            try {
                                                handleChangeT({ target: { value: v } } as any);
                                            } catch { /* no-op */ }
                                        }
                                    }}

                                    onClose={() => {
                                        setIsNotepadOpen4(false);
                                    }}

                                    hide={false}
                                    onSpeak={() => {
                                        console.log("Speak / mic with narration text:", textValueT);
                                    }}
                                />
                            </Box>
                        </>
                    )}


                    <Box sx={{ mt: "auto", width: "100%", pb: matchMobile ? 8 : 0, display: "flex", gap: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {

                                if (textValuex2) {

                                    callRemakeText(textValuex2, textValueT);
                                } else {
                                    // steps2/stepsx are NATIVE arrays â€” never index them with the unified display index
                                    const narrIdx = pageType === 1 ? Math.floor(nativeSlotIndex / 2) : nativeSlotIndex - 1;
                                    const prevNarrRaw = steps2?.[narrIdx];
                                    const prevNarrText = typeof prevNarrRaw === 'object' && prevNarrRaw !== null ? prevNarrRaw.text : (prevNarrRaw ?? "");

                                    setSteps2((prev: any[]) => {
                                        const next = [...prev];
                                        while (next.length <= narrIdx) next.push("");
                                        next[narrIdx] = textValueT;
                                        return next;
                                    });

                                    setStepsx((prev: any) => {
                                        const next = [...prev];
                                        next[nativeSlotIndex] = textValueT;
                                        return next;
                                    });

                                    // Only mark audio stale when the narration text actually changed
                                    if (textValueT !== prevNarrText) {
                                        setIsAudioDirty?.(true);
                                    }

                                    if (setstartEdit) setstartEdit(false);
                                }

                            }}
                            sx={{
                                ...greenPrimaryButtonSx,
                                px: 3,
                                py: 1.5,
                                flex: 1,
                            }}
                        >
                            Update
                        </Button>
                    </Box>

                </Box>


                <Box
                    sx={{
                        position: "absolute",
                        top: { xs: mobileControlTop, md: 0 },
                        left: { xs: 0, md: `calc(100% - ${controlPanelWidth})` },
                        width: { xs: "100%", md: controlPanelWidth },
                        height: { xs: mobileControlHeight, md: "100%" },
                        borderRadius: { xs: "28px 28px 0 0", md: "0" },
                        p: matchMobile ? 2 : 3.25,
                        color: darkMode ? "#fff" : "#000",
                        background: glassPanelBg,
                        backdropFilter: "blur(30px) saturate(180%)",
                        borderLeft: { xs: "none", md: shellBorder },
                        borderTop: { xs: shellBorder, md: "none" },
                        boxShadow: "none",
                        zIndex: 2,
                        display: show && narrate === 2 ? "flex" : "none",
                        flexDirection: "column",
                        gap: 2,
                        overflowX: "hidden",
                        overflowY: { xs: "auto", md: "auto" },
                    }}
                >
                    <Box sx={panelHeaderRowSx}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                            <input
                                accept="video/*"
                                style={{ display: 'none' }}
                                id={`video-upload-direct-panel-${index}`}
                                type="file"
                                onChange={(e) => handleVideoUploadDirect(e, index)}
                            />
                            <label htmlFor={`video-upload-direct-panel-${index}`}>
                                <Button component="span" startIcon={<UploadIcon />} sx={compactGlassButtonSx}>
                                    {matchMobile ? "Upload" : "Upload Video"}
                                </Button>
                            </label>
                        </Box>
                        {isBShotModeActive ? (
                            <Box
                                sx={{
                                    position: "absolute",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 30,
                                    fontSize: '0.8rem',
                                    color: darkModeReducer ? "#fff" : "#000",
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    p: 0.5,
                                    borderRadius: 999,
                                    background: darkModeReducer
                                        ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
                                        : "linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.4) 100%)",
                                    backdropFilter: "blur(16px) saturate(180%)",
                                    border: darkModeReducer ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.72)",
                                    boxShadow: darkModeReducer ? "0 8px 20px rgba(0,0,0,0.24)" : "0 8px 20px rgba(31,38,135,0.08)",
                                    cursor: "pointer",
                                }}
                            >
                                <Box onClick={() => setnarrate(0)} style={{
                                    padding: matchMobile ? '6px 14px' : '6px 18px',
                                    opacity: narrate === 0 ? 1 : 0.45,
                                    borderRadius: '999px',
                                    background: narrate === 0
                                        ? (darkModeReducer ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)')
                                        : 'transparent',
                                    display: 'block'
                                }}>
                                    Images
                                </Box>
                                <Box onClick={() => setnarrate(2)} style={{
                                    padding: matchMobile ? '6px 14px' : '6px 18px',
                                    opacity: narrate === 2 ? 1 : 0.45,
                                    borderRadius: '999px',
                                    background: narrate === 2
                                        ? (darkModeReducer ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)')
                                        : 'transparent',
                                    display: 'block'
                                }}>
                                    Videos
                                </Box>
                            </Box>
                        ) : VideMode ? (
                            <Box sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2.25,
                                position: "absolute",
                                left: "50%",
                                transform: "translateX(-50%)"
                            }}>
                                <Box onClick={() => setnarrate(2)} sx={panelTabSx(narrate === 2)}>
                                    Videos
                                </Box>
                                <Box onClick={() => setnarrate(1)} sx={panelTabSx(narrate === 1)}>
                                    Narration
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2.25,
                                position: "absolute",
                                left: "50%",
                                transform: "translateX(-50%)"
                            }}>
                                <Box onClick={() => setnarrate(0)} sx={panelTabSx(narrate === 0)}>
                                    Images
                                </Box>
                                <Box onClick={() => setnarrate(1)} sx={panelTabSx(narrate === 1)}>
                                    Narration
                                </Box>
                            </Box>
                        )}
                    </Box>
                    {(musicMode || isVideoRefModel) && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flexWrap: "wrap",
                                mt: -0.75,
                                mb: 0.25,
                                order: 0,
                            }}
                        >
                            {musicMode && (
                            <>
                            {musicModeUrl && (
                                <audio
                                    ref={snippetAudioRef}
                                    src={musicModeUrl}
                                    preload="metadata"
                                    onTimeUpdate={handleSnippetTimeUpdate}
                                    onEnded={stopSnippetPreview}
                                />
                            )}
                            <Button
                                type="button"
                                startIcon={isSnippetPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                onClick={handleSnippetToggle}
                                sx={{
                                    ...compactGlassButtonSx,
                                    opacity: musicModeUrl ? 1 : 0.5,
                                    cursor: musicModeUrl ? "pointer" : "not-allowed",
                                }}
                            >
                                Snippet
                            </Button>
                            <Button
                                type="button"
                                startIcon={<RecordVoiceOver />}
                                onClick={handleLipsyncTrim}
                                sx={{
                                    ...compactGlassButtonSx,
                                    opacity: musicModeUrl ? 1 : 0.5,
                                    cursor: musicModeUrl ? "pointer" : "not-allowed",
                                    background: isLipSyncActive ? (darkMode ? "#E8BAFA" : "#0099cc") : compactGlassButtonSx.background,
                                    color: isLipSyncActive ? "#000" : compactGlassButtonSx.color,
                                    border: hasLipSyncAudio
                                        ? `1px solid ${darkMode ? "#E8BAFA" : "#0099cc"}`
                                        : compactGlassButtonSx.border,
                                    boxShadow: hasLipSyncAudio
                                        ? `0 0 0 1px ${darkMode ? "rgba(232,186,250,0.55)" : "rgba(0,153,204,0.45)"}, 0 0 18px ${darkMode ? "rgba(232,186,250,0.32)" : "rgba(0,153,204,0.26)"}`
                                        : compactGlassButtonSx.boxShadow,
                                    "&:hover": isLipSyncActive ? {
                                        background: darkMode ? "#D4A1E5" : "#007ea8",
                                        color: "#000",
                                    } : compactGlassButtonSx["&:hover"],
                                }}
                            >
                                {isLipSyncActive ? "Using Lip Sync" : (hasLipSyncAudio ? "Use" : "Lipsync")}
                            </Button>
                            {isLipSyncAudioTrimming && (
                                <Box
                                    sx={{
                                        position: "fixed",
                                        inset: 0,
                                        zIndex: 9999999,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: darkMode
                                            ? "rgba(0,0,0,0.42)"
                                            : "rgba(255,255,255,0.2)",
                                        backdropFilter: "blur(18px) saturate(140%)",
                                        WebkitBackdropFilter: "blur(18px) saturate(140%)",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            minWidth: 220,
                                            px: 3,
                                            py: 2.5,
                                            borderRadius: 3,
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            gap: 1.5,
                                            background: darkMode
                                                ? "rgba(12,12,14,0.7)"
                                                : "rgba(255,255,255,0.68)",
                                            border: darkMode
                                                ? "1px solid rgba(255,255,255,0.12)"
                                                : "1px solid rgba(255,255,255,0.68)",
                                            boxShadow: "0 18px 60px rgba(0,0,0,0.32)",
                                        }}
                                    >
                                        <CircularProgress
                                            size={32}
                                            thickness={4}
                                            sx={{ color: darkMode ? "#E8BAFA" : "#0099cc" }}
                                        />
                                        <Typography
                                            sx={{
                                                color: darkMode ? "#fff" : "#111",
                                                fontWeight: 900,
                                                fontSize: "0.9rem",
                                            }}
                                        >
                                            Trimming audio
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            </>
                            )}

                            {/* ADD VIDEO â€” reference video for Seedance 2.0 / 2.0 Fast only */}
                            {isVideoRefModel && (
                                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                                    {hasReferenceVideo && (
                                        <Box
                                            onClick={() => setIsRefVideoModalOpen(true)}
                                            sx={{
                                                width: 96,
                                                height: 54,
                                                borderRadius: 1.5,
                                                overflow: "hidden",
                                                cursor: "pointer",
                                                position: "relative",
                                                // Highlighted in app color only while actively in use ("Using Vid").
                                                border: isReferenceVideoActive
                                                    ? `2px solid ${darkMode ? "#E8BAFA" : "#0099cc"}`
                                                    : `1px solid ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}`,
                                                boxShadow: isReferenceVideoActive
                                                    ? `0 0 0 1px ${darkMode ? "rgba(232,186,250,0.55)" : "rgba(0,153,204,0.45)"}, 0 0 18px ${darkMode ? "rgba(232,186,250,0.4)" : "rgba(0,153,204,0.32)"}`
                                                    : "none",
                                                opacity: isReferenceVideoActive ? 1 : 0.7,
                                                background: "#000",
                                            }}
                                        >
                                            <video
                                                src={activeReferenceVideoUrl}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                                            />
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "#fff",
                                                    background: "rgba(0,0,0,0.25)",
                                                }}
                                            >
                                                <PlayArrowIcon fontSize="small" />
                                            </Box>
                                        </Box>
                                    )}
                                    <input
                                        ref={refVideoInputRef}
                                        type="file"
                                        accept="video/*"
                                        style={{ display: "none" }}
                                        onChange={handleReferenceVideoFile}
                                    />
                                    <Button
                                        type="button"
                                        startIcon={<VideoLibraryIcon />}
                                        onClick={handleAddVideoClick}
                                        disabled={isRefVideoUploading}
                                        sx={{
                                            ...compactGlassButtonSx,
                                            background: isReferenceVideoActive ? (darkMode ? "#E8BAFA" : "#0099cc") : compactGlassButtonSx.background,
                                            color: isReferenceVideoActive ? "#000" : compactGlassButtonSx.color,
                                            border: isReferenceVideoActive
                                                ? `1px solid ${darkMode ? "#E8BAFA" : "#0099cc"}`
                                                : compactGlassButtonSx.border,
                                            boxShadow: isReferenceVideoActive
                                                ? `0 0 0 1px ${darkMode ? "rgba(232,186,250,0.55)" : "rgba(0,153,204,0.45)"}, 0 0 18px ${darkMode ? "rgba(232,186,250,0.32)" : "rgba(0,153,204,0.26)"}`
                                                : compactGlassButtonSx.boxShadow,
                                            "&:hover": isReferenceVideoActive ? {
                                                background: darkMode ? "#D4A1E5" : "#007ea8",
                                                color: "#000",
                                            } : compactGlassButtonSx["&:hover"],
                                        }}
                                    >
                                        {isRefVideoUploading ? "Uploadingâ€¦" : (hasReferenceVideo ? (isReferenceVideoActive ? "Using Vid" : "Use Vid") : "Add Video")}
                                    </Button>
                                </Box>
                            )}

                            {/* Reference video viewer popup */}
                            {isRefVideoModalOpen && hasReferenceVideo && (
                                <Box
                                    onClick={() => setIsRefVideoModalOpen(false)}
                                    sx={{
                                        position: "fixed",
                                        inset: 0,
                                        zIndex: 9999999,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: darkMode ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.45)",
                                        backdropFilter: "blur(8px) saturate(140%)",
                                        WebkitBackdropFilter: "blur(8px) saturate(140%)",
                                    }}
                                >
                                    <Box
                                        onClick={(e: any) => e.stopPropagation()}
                                        sx={{
                                            position: "relative",
                                            maxWidth: "min(86vw, 720px)",
                                            width: "100%",
                                            borderRadius: 3,
                                            overflow: "hidden",
                                            background: darkMode ? "rgba(12,12,14,0.92)" : "rgba(255,255,255,0.96)",
                                            border: darkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.08)",
                                            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
                                            p: 1.5,
                                        }}
                                    >
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, px: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: darkMode ? "#fff" : "#111" }}>
                                                Reference video
                                            </Typography>
                                            <IconButton size="small" onClick={() => setIsRefVideoModalOpen(false)} sx={{ color: darkMode ? "#fff" : "#111" }}>
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                        <video
                                            src={activeReferenceVideoUrl}
                                            controls
                                            autoPlay
                                            playsInline
                                            style={{ width: "100%", maxHeight: "70vh", borderRadius: 8, background: "#000", display: "block" }}
                                        />
                                        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.25 }}>
                                            <Button
                                                type="button"
                                                onClick={handleRemoveReferenceVideo}
                                                sx={{ ...compactGlassButtonSx, color: darkMode ? "#ff9a9a" : "#c0392b" }}
                                            >
                                                Remove
                                            </Button>
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                    <Typography variant="overline" sx={{ ...sectionTitleSx, mt: 4, display: 'block', order: 1 }}>
                        Update with AI
                    </Typography>

                    {/* SCROLL CONTAINER (adds horizontal scroll & snap on mobile only) */}
                    <Box
                        sx={{
                            width: "100%",
                            maxWidth: "100%",
                            overflowX: "auto",
                            overflowY: "hidden",
                            scrollBehavior: "smooth",
                            WebkitOverflowScrolling: "touch",
                            // snap on small screens
                            overscrollBehaviorX: "contain",
                            touchAction: "pan-x",
                            scrollSnapType: "x proximity",
                            // optional: subtle fade edges on mobile (remove if you donÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢t want it)
                            maskImage: {
                                xs: "linear-gradient(90deg, transparent 0, black 12px, black calc(100% - 12px), transparent 100%)",
                                md: "none",
                            },
                            px: 0.25,
                            pb: 0.25,
                            // optional: hide scrollbar on WebKit
                            "&::-webkit-scrollbar": { display: { xs: "none", md: "initial" } },
                            order: 6,
                            pt: { xs: 1.5, md: 0 },
                            mb: { xs: 1.5, md: 0 },
                            flexShrink: 0,
                            minHeight: { xs: 70, md: 'auto' },
                        }}
                    >
                        <Stack
                            direction="row"
                            spacing={1}
                            // Make the inner row expand only as wide as its contents on mobile so it can scroll
                            sx={{
                                width: "max-content",
                                minWidth: "100%",
                                padding: 0.25,
                                // Ensure all direct children (your buttons) participate in scroll snapping on mobile
                                "& > *": {
                                    scrollSnapAlign: "start",
                                },
                            }}
                        >


                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                        setvideModel?.("Proxxx");
                                        setbutton?.("Proxxx");
                                        if (typeof setmusicKling === "function") setmusicKling(false);
                                    } else { }
                                }}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    pointerEvents: isLipSyncActive ? "none" : "auto",
                                    opacity: isLipSyncActive ? 0.3 : (pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3)),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Proxxx"),
                                    "&:hover": { borderColor: borderColor(button === "Proxxx") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Proxxx") },
                                    "&:active": { borderColor: borderColor(button === "Proxxx") },
                                }}
                            >
                                Hailuo 2.3
                            </Button>

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                        setvideModel?.("Proxx");
                                        setbutton?.("Proxx");
                                    } else { }
                                }}
                                startIcon={<CampaignIcon style={{ display: musicKling ? 'block' : 'none' }} />}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    display: 'flex',
                                    pointerEvents: isLipSyncActive ? "none" : "auto",
                                    opacity: isLipSyncActive ? 0.3 : (pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3)),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Proxx"),
                                    "&:hover": { borderColor: borderColor(button === "Proxx") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Proxx") },
                                    "&:active": { borderColor: borderColor(button === "Proxx") },
                                }}
                            >
                                Seedance 1.5
                            </Button>

                            {/* Mini (30%) */}
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (ratioKey === 2) { } else {
                                        if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                            if (typeof setmusicKling === "function") setmusicKling(true);
                                            setvideModel?.("Mini");
                                            setbutton?.("Mini");
                                        } else { }
                                    }
                                }}
                                startIcon={<CampaignIcon />}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    pointerEvents: isLipSyncActive ? "none" : "auto",
                                    opacity: isLipSyncActive ? 0.3 : (ratioKey === 2 ? 0.3 : (pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3))),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Mini"),
                                    "&:hover": { borderColor: borderColor(button === "Mini") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Mini") },
                                    "&:active": { borderColor: borderColor(button === "Mini") },
                                }}
                            >
                                Grok
                            </Button>

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                        setvideModel?.("Prox");
                                        setbutton?.("Prox");
                                    } else { }
                                }}
                                startIcon={<CampaignIcon style={{ display: musicKling ? 'block' : 'none' }} />}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    pointerEvents: isLipSyncActive ? "none" : "auto",
                                    opacity: isLipSyncActive ? 0.3 : (pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3)),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Prox"),
                                    "&:hover": { borderColor: borderColor(button === "Prox") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Prox") },
                                    "&:active": { borderColor: borderColor(button === "Prox") },
                                }}
                            >
                                PixVerse 6
                            </Button>

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                        setvideModel?.("pPro");
                                        setbutton?.("pPro");
                                    } else { }
                                }}
                                startIcon={<CampaignIcon style={{ display: musicKling ? 'block' : 'none' }} />}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    pointerEvents: isLipSyncActive ? "none" : "auto",
                                    opacity: isLipSyncActive ? 0.3 : (pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3)),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "pPro"),
                                    "&:hover": { borderColor: borderColor(button === "Ppro") },
                                    "&:focus-visible": { borderColor: borderColor(button === "pPro") },
                                    "&:active": { borderColor: borderColor(button === "pPro") },
                                }}
                            >
                                Kling 3
                            </Button>

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                        setvideModel?.("Pro");
                                        setbutton?.("Pro");
                                    } else { }
                                }}
                                startIcon={<CampaignIcon style={{ display: musicKling ? 'block' : 'none' }} />}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    opacity: pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Pro"),
                                    "&:hover": { borderColor: borderColor(button === "Pro") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Pro") },
                                    "&:active": { borderColor: borderColor(button === "Pro") },
                                }}
                            >
                                SeeDance 2.0
                            </Button>



                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    if (ratioKey === 2) { } else {
                                        if (!SelectedModel || pageType === 3 || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni') {
                                            setvideModel?.("Minix");
                                            setbutton?.("Minix");
                                        } else { }
                                    }
                                }}
                                startIcon={<CampaignIcon style={{ display: musicKling ? 'block' : 'none' }} />}
                                sx={{
                                    ...commonButtonSx,
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    opacity: ratioKey === 2 ? 0.3 : (pageType === 3 ? 1 : (!SelectedModel || SelectedModel === 'Prox' || SelectedModel === 'Proxx' || SelectedModel === 'pPro' || SelectedModel === 'Pro' || SelectedModel === 'Proxxx' || SelectedModel === 'Mini' || SelectedModel === 'Minix' || SelectedModel === 'Omni' ? 1 : 0.3)),
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Minix"),
                                    "&:hover": { borderColor: borderColor(button === "Minix") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Minix") },
                                    "&:active": { borderColor: borderColor(button === "Minix") },
                                }}
                            >
                                Seedance 2.0 Fast
                            </Button>

                            {/* OmniHuman 1.5 â€” visible only when lip-sync is active */}
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {
                                    setvideModel?.("Omni");
                                    setbutton?.("Omni");
                                }}
                                startIcon={<CampaignIcon />}
                                sx={{
                                    ...commonButtonSx,
                                    display: isLipSyncActive ? "inline-flex" : "none",
                                    flex: "0 0 auto",
                                    minWidth: { xs: 132, md: 124 },
                                    px: { xs: 1.7, md: 1.8 },
                                    py: { xs: 0.95, md: 0.95 },
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    opacity: 1,
                                    pointerEvents: "auto",
                                    borderWidth: 2,
                                    borderStyle: "solid",
                                    borderColor: borderColor(button === "Omni"),
                                    "&:hover": { borderColor: borderColor(button === "Omni") },
                                    "&:focus-visible": { borderColor: borderColor(button === "Omni") },
                                    "&:active": { borderColor: borderColor(button === "Omni") },
                                }}
                            >
                                OmniHuman 1.5
                            </Button>
                        </Stack>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "stretch",
                            width: "100%",
                            paddingTop: '1vh',
                            order: 2,
                        }}
                    >
                        {/* LEFT: shell TextField (read-only; Notepad edits the value) */}
                        <Box sx={{ flex: "1 1 20%", minWidth: 0 }}>
                            <TextField
                                variant="outlined"
                                fullWidth

                                // keep your original handlers/values
                                onKeyDown={(e: any) => { handleKeyDownvid(e, videotxt, textVidUpdate, index); }}
                                value={textVidUpdate}
                                onChange={handleChangexv}
                                placeholder="Describe change to Gpt"

                                // Notepad triggers
                                onFocus={() => {
                                    ///setIsNotepadOpen5(true);
                                }}
                                onClick={(e: any) => {
                                    handlePromptShellCaret(e);
                                    setIsNotepadOpen5(true);
                                }}
                                onBlur={() => {
                                    // Notepad dialog controls closing
                                }}

                                // visuals: EXACT; only adds dim when Notepad is open (and preserves allowgetImage)
                                sx={{
                                    ...fieldShellSx,
                                    "& .MuiInputBase-root:focus": { outline: "none" },
                                    "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                    "& .Mui-focused": { outline: "none" },
                                    "& .MuiInputBase-input": {
                                        ...defaultFieldTextSx,
                                    },
                                    opacity: isNotepadOpen5 ? "0.03" : (allowgetImage ? 1 : 0.1),

                                    "& .MuiInputLabel-root": {
                                        color: darkMode ? "#ffffff" : "#000000",
                                        fontFamily: editorFontFamily,
                                        fontSize: "0.95rem",
                                        lineHeight: 1.55,
                                    },

                                    "& .MuiFormHelperText-root": {
                                        color: darkMode ? "#ffffff" : "#000000",
                                    },

                                    '& .MuiFilledInput-underline:after': {
                                        borderBottomColor: darkModeReducer ? "green" : 'black', // keep your underline colors
                                    },
                                    '& .Mui-focused .MuiFilledInput-underline:after': {
                                        borderBottomColor: darkModeReducer ? "green" : 'black',
                                    },

                                    mb: 1,
                                }}

                                // read-only shell; Notepad writes into `textVidUpdate`
                                slotProps={{
                                    htmlInput: {
                                        readOnly: true,
                                        "aria-label": "Describe change to Gpt",
                                        onKeyDown: (e: any) => { e.preventDefault(); }, // block typing in shell
                                        autoCorrect: "on",
                                        spellCheck: true,
                                        autoCapitalize: "sentences",
                                        autoComplete: "off",
                                    },
                                }}
                            />
                        </Box>

                        {/* RIGHT: attached Notepad host */}
                        <Notepad
                            Caret={Caret}
                            handleKeyDown={(e: any) => { handleKeyDownvid(e, videotxt, textVidUpdate, index); }}
                            TextFieldactive={TextFieldactive}
                            setTextFieldactive={setTextFieldactive}
                            GeneratedImage={''}
                            panel
                            type={200}
                            SelectedModel={button || SelectedModel}
                            darkMode={darkModeReducer}
                            size={matchMobile ? "small" : "medium"}
                            open={isNotepadOpen5}
                            setIsNotepadOpen={setIsNotepadOpen5}
                            placeholder="Describe change to Gpt"

                            // Notepad controls THIS fieldÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s value
                            value={textVidUpdate}
                            cachedImageGen={vidGenCaches[index] || { text: '', imageUrl: null }}
                            onUpdateCachedImageGen={(newData) => {
                                setVidGenCaches(prev => {
                                    const next = [...prev];
                                    next[index] = newData;
                                    return next;
                                });
                            }}
                            onChange={(v: string) => {
                                if (typeof settextVidUpdate === "function") {
                                    settextVidUpdate(v);
                                } else {
                                    try {
                                        // mimic a normal event for your existing handler
                                        handleChangexv({ target: { value: v } } as any);
                                    } catch { /* no-op */ }
                                }
                            }}

                            onClose={() => {
                                setIsNotepadOpen5(false);
                            }}

                            hide={false}
                            onSpeak={() => {
                                console.log("Speak / mic with video-change field:", textVidUpdate);
                            }}
                        />
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", order: 3, mb: 0.5 }}>
                        <Typography variant="overline" sx={{ ...sectionTitleSx, color: '#888', mb: 0, fontSize: matchMobile ? '0.65rem' : sectionTitleSx.fontSize }}>
                            {matchMobile ? 'Video' : 'Video Prompt'}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                // disabled={PLoader}
                                onClick={() => fetchAndGenerateImage(index, '', 0)}
                                sx={{
                                    ...videoMetaButtonSx,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                    position: "relative",
                                    px: 2,
                                    // inline keyframes for the spinner
                                    "@keyframes spinPulse": {
                                        "0%": { transform: "scale(1) rotate(0deg)", opacity: 1 },
                                        "50%": { transform: "scale(0.8) rotate(180deg)", opacity: 0.5 },
                                        "100%": { transform: "scale(1) rotate(360deg)", opacity: 1 },
                                    },
                                }}
                            >
                                {loadersPrompt[index] || loadPrompt[index] || PLoader ? (
                                    <>
                                        <Box
                                            sx={{
                                                width: 14,
                                                height: 14,
                                                borderRadius: "50%",
                                                border: "2px solid rgba(255,255,255,0.5)",
                                                borderTopColor: darkModeReducer ? "#fff" : "#111",
                                                animation: "spinPulse 0.8s linear infinite",
                                                flexShrink: 0,
                                            }}
                                        />
                                        <Typography variant="button" sx={{ fontSize: "0.84rem", fontWeight: 700, color: darkModeReducer ? "#fff" : "#111", whiteSpace: "nowrap" }}>
                                            Working...
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography variant="button" sx={{ fontSize: "0.84rem", fontWeight: 700, color: darkModeReducer ? "#fff" : "#111", whiteSpace: "nowrap" }}>
                                        Auto Prompt
                                    </Typography>
                                )}
                            </Button>

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={toggleTime}
                                sx={{
                                    ...videoMetaButtonSx,
                                    opacity: videModel === "Veo" ? 0.4 : 1,
                                    cursor: isMusicVideoTimingLocked ? "not-allowed" : "pointer",
                                }}
                            >
                                {isMusicVideoTimingLocked && (
                                    <LockIcon
                                        sx={{
                                            fontSize: "0.95rem",
                                            mr: 0.55,
                                            color: darkModeReducer ? "#fff" : "#111",
                                        }}
                                    />
                                )}
                                <Typography
                                    variant="button"
                                    sx={{
                                        fontSize: "0.84rem",
                                        fontWeight: 700,
                                        color: darkModeReducer ? "#fff" : "#111",
                                    }}
                                >
                                    {time}secs
                                </Typography>
                            </Button>

                            {videModel === 'Prox' || videModel === 'Proxx' || videModel === 'pPro' || videModel === 'Pro' || videModel === 'Minix' ? (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        if (typeof setmusicKling === "function") setmusicKling((prev: any) => !prev);
                                    }}
                                    sx={{
                                        ...videoMetaButtonSx,
                                    }}
                                >
                                    {musicKling ? (
                                        <CampaignIcon
                                            sx={{
                                                fontSize: "1.1rem",
                                                color: "#20c997",
                                                opacity: 1,
                                            }}
                                        />
                                    ) : (
                                        <MusicOffIcon
                                            sx={{
                                                fontSize: "1.1rem",
                                                color: darkModeReducer ? "rgba(255,255,255,0.58)" : "rgba(0,0,0,0.5)",
                                                opacity: 0.6,
                                            }}
                                        />
                                    )}
                                </Button>
                            ) : null}
                        </Box>
                    </Box>

                    {/* Mini Active Character Viewer Bar (Video Mode) */}
                    {((referenceImages && referenceImages.length > 0) || (ImagesHdCloud && ImagesHdCloud.some(url => !!url))) && (
                        <Box
                            tabIndex={-1}
                            onBlur={(e: React.FocusEvent) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                    setIsScenesModeActive(false);
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                overflowX: "auto",
                                overflowY: "hidden",
                                minHeight: 80,
                                m: 0,
                                p: "14px 4px",
                                order: 4,
                                gap: 1,
                                outline: 'none',
                                "&::-webkit-scrollbar": { height: "4px" },
                                "&::-webkit-scrollbar-track": { background: "transparent" },
                                "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.15)", borderRadius: "10px" }
                            }}
                        >
                            {isScenesModeActive ? (
                                <>
                                    {/* Close Button */}
                                    <Avatar
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsScenesModeActive(false);
                                        }}
                                        sx={{
                                            cursor: "pointer",
                                            width: 54, height: 54, minWidth: 54, minHeight: 54, flexShrink: 0,
                                            bgcolor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                            border: darkMode ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid rgba(0,0,0,0.4)',
                                            '&:hover': { bgcolor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)', border: darkMode ? '1.5px solid #fff' : '1.5px solid #000' },
                                            zIndex: 3
                                        }}
                                    >
                                        <CloseIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                                    </Avatar>

                                    {/* Scene Avatars */}
                                    {ImagesHdCloud && ImagesHdCloud.map((url: string, idx: number) => {
                                        if (!url) return null;
                                        const sceneNum = idx + 1;
                                        const refObj = {
                                            name: `Scene ${sceneNum}`,
                                            imageUrl: url,
                                            url: url,
                                            image: url,
                                            isMotion: false
                                        };
                                        const isActivated = activeCharsForScene?.some((ac: any) => ac.name === refObj.name);
                                        const themeColor = darkMode ? "#E8BAFA" : "#0099cc";
                                        const themeShadow = darkMode ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)";

                                        return (
                                            <Box key={`scene-ref-${idx}`} sx={{
                                                position: "relative",
                                                flexShrink: 0,
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                zIndex: isActivated ? 2 : 1
                                            }}>
                                                <Avatar
                                                    src={url}
                                                    alt={`Scene ${sceneNum}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFullScreenActionImage(refObj);
                                                    }}
                                                    imgProps={{ style: { objectPosition: 'top' } }}
                                                    sx={{
                                                        cursor: "pointer",
                                                        width: 54,
                                                        height: 54,
                                                        minWidth: 54,
                                                        minHeight: 54,
                                                        flexShrink: 0,
                                                        border: isActivated ? `2.5px solid ${themeColor}` : `1.5px solid rgba(255,255,255,0.15)`,
                                                        boxShadow: isActivated ? `0 0 12px ${themeShadow}` : "none",
                                                        opacity: isActivated ? 1 : 0.4,
                                                        transition: "all 0.3s ease",
                                                        '&:hover': {
                                                            border: darkMode ? '1.5px solid #fff' : '1.5px solid #000'
                                                        }
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </>
                            ) : (
                                <>
                                    {(() => {
                                        const currentModelUI = button || SelectedModel;
                                        const isUnsupportedUI = currentModelUI === 'Proxx' || currentModelUI === 'Mini' || currentModelUI === 'Prox' || currentModelUI === 'Proxxx';

                                        return (
                                            <>
                                                {/* Action Image Trigger Button */}
                                                <Avatar
                                                    onClick={() => {
                                                        if (isUnsupportedUI) return;
                                                        setActionModalMode('action');
                                                        setActionPrompt(currentSelectedPrompts[0] || textValue || "");
                                                        setActionUpdateText("");
                                                        setHasExpandedActionChars(false);
                                                        setOpenActionModal(index);
                                                    }}
                                                    sx={{
                                                        cursor: isUnsupportedUI ? "default" : "pointer",
                                                        pointerEvents: isUnsupportedUI ? "none" : "auto",
                                                        opacity: isUnsupportedUI ? 0.3 : 1,
                                                        transform: isUnsupportedUI ? "scale(0.8)" : "scale(1)",
                                                        transition: "all 0.3s ease",
                                                        width: 54, height: 54, minWidth: 54, minHeight: 54, flexShrink: 0,
                                                        bgcolor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                                        border: darkMode ? '1.5px dashed rgba(255,255,255,0.4)' : '1.5px dashed rgba(0,0,0,0.4)',
                                                        '&:hover': { bgcolor: isUnsupportedUI ? undefined : (darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'), border: isUnsupportedUI ? undefined : (darkMode ? '1.5px solid #fff' : '1.5px solid #000') },
                                                        zIndex: 3
                                                    }}
                                                >
                                                    <DirectionsRunIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                                                </Avatar>

                                                {/* Motion Image Trigger Button */}
                                                {VideMode && currentModelUI !== 'pPro' && (
                                                    <Avatar
                                                        onClick={() => {
                                                            if (isUnsupportedUI) return;
                                                            setActionModalMode('motion');
                                                            setActionPrompt(currentSelectedPrompts[0] || textValue || "");
                                                            setActionUpdateText("");
                                                            setHasExpandedActionChars(false);
                                                            setOpenActionModal(index);
                                                        }}
                                                        sx={{
                                                            cursor: isUnsupportedUI ? "default" : "pointer",
                                                            pointerEvents: isUnsupportedUI ? "none" : "auto",
                                                            opacity: isUnsupportedUI ? 0.3 : 1,
                                                            transform: isUnsupportedUI ? "scale(0.8)" : "scale(1)",
                                                            transition: "all 0.3s ease",
                                                            width: 54, height: 54, minWidth: 54, minHeight: 54, flexShrink: 0,
                                                            bgcolor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                                            border: darkMode ? '1.5px dashed rgba(255,255,255,0.4)' : '1.5px dashed rgba(0,0,0,0.4)',
                                                            '&:hover': { bgcolor: isUnsupportedUI ? undefined : (darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'), border: isUnsupportedUI ? undefined : (darkMode ? '1.5px solid #fff' : '1.5px solid #000') },
                                                            zIndex: 3
                                                        }}
                                                    >
                                                        <VideocamIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                                                    </Avatar>
                                                )}

                                                {/* Scenes Image Trigger Button (Man standing with hands up) */}
                                                {VideMode && ImagesHdCloud && ImagesHdCloud.some(url => !!url) && (
                                                    <Avatar
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isUnsupportedUI) return;
                                                            setIsScenesModeActive(true);
                                                        }}
                                                        sx={{
                                                            cursor: isUnsupportedUI ? "default" : "pointer",
                                                            pointerEvents: isUnsupportedUI ? "none" : "auto",
                                                            opacity: isUnsupportedUI ? 0.3 : 1,
                                                            transform: isUnsupportedUI ? "scale(0.8)" : "scale(1)",
                                                            transition: "all 0.3s ease",
                                                            width: 54, height: 54, minWidth: 54, minHeight: 54, flexShrink: 0,
                                                            bgcolor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                                            border: (() => {
                                                                const themeColor = darkMode ? "#E8BAFA" : "#0099cc";
                                                                const hasSelectedScene = activeCharsForScene?.some((ac: any) => String(ac.name).startsWith("Scene "));
                                                                return isScenesModeActive || hasSelectedScene
                                                                    ? `2.5px solid ${themeColor}`
                                                                    : (darkMode ? '1.5px dashed rgba(255,255,255,0.4)' : '1.5px dashed rgba(0,0,0,0.4)');
                                                            })(),
                                                            boxShadow: (() => {
                                                                const themeShadow = darkMode ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)";
                                                                const hasSelectedScene = activeCharsForScene?.some((ac: any) => String(ac.name).startsWith("Scene "));
                                                                return isScenesModeActive || hasSelectedScene
                                                                    ? `0 0 12px ${themeShadow}`
                                                                    : "none";
                                                            })(),
                                                            '&:hover': { bgcolor: isUnsupportedUI ? undefined : (darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'), border: isUnsupportedUI ? undefined : (darkMode ? '1.5px solid #fff' : '1.5px solid #000') },
                                                            zIndex: 3
                                                        }}
                                                    >
                                                        <EmojiPeopleIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                                                    </Avatar>
                                                )}
                                            </>
                                        );
                                    })()}
                                    {extendedReferenceImages.map((ref: any, idx: number) => {
                                        const currentModel = button || SelectedModel;
                                        if (ref.isMotion && currentModel === 'pPro') {
                                            return null;
                                        }
                                        const isActivated = activeCharsForScene?.some((ac: any) => ac.name === ref.name);
                                        const themeColor = darkMode ? "#E8BAFA" : "#0099cc";
                                        const themeShadow = darkMode ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)";
                                        const isUnsupportedModel = currentModel === 'Proxx' || currentModel === 'Mini' || currentModel === 'Prox' || currentModel === 'Proxxx';

                                        return (
                                            <Box key={idx} sx={{
                                                position: "relative",
                                                flexShrink: 0,
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                zIndex: isActivated ? 2 : 1,
                                                pointerEvents: isUnsupportedModel ? "none" : "auto",
                                            }}>
                                                <Avatar
                                                    src={ref.imageUrl || ref.url}
                                                    alt={ref.name}
                                                    onClick={() => {
                                                        // Regular character/action/motion zoom logic
                                                        if (idx < (referenceImages?.length || 0)) {
                                                            setFullscreenCharIndex && setFullscreenCharIndex(idx);
                                                        } else {
                                                            setFullScreenActionImage(ref);
                                                        }
                                                    }}
                                                    imgProps={{ style: { objectPosition: 'top' } }}
                                                    sx={{
                                                        cursor: "pointer",
                                                        width: 54,
                                                        height: 54,
                                                        minWidth: 54,
                                                        minHeight: 54,
                                                        flexShrink: 0,
                                                        border: isActivated && !isUnsupportedModel ? `2.5px solid ${themeColor}` : `1.5px solid rgba(255,255,255,0.15)`,
                                                        boxShadow: isActivated && !isUnsupportedModel ? `0 0 12px ${themeShadow}` : "none",
                                                        opacity: isActivated ? 1 : 0.4,
                                                        transform: isUnsupportedModel ? "scale(0.4)" : "scale(1)",
                                                        transition: "all 0.3s ease"
                                                    }}
                                                />
                                            </Box>
                                        );
                                    })}
                                </>
                            )}
                        </Box>
                    )}

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "stretch",
                            width: "100%",
                            order: 5,

                        }}
                    >
                        {/* LEFT: shell TextField (read-only; Notepad edits the value) */}
                        <Box sx={{ flex: "1 1 20%", minWidth: 0 }}>
                            <TextField
                                variant="outlined"
                                fullWidth
                                multiline
                                minRows={1}

                                // keep your original handlers/values
                                onKeyDown={(e: any) => { handleKeyDownvid(e, videotxt, textVidUpdate, index); }}
                                value={videotxt}
                                onChange={handleChangeTextVid}
                                placeholder="Use Auto Prompt / Enter Video Prompt"

                                // Notepad triggers
                                onFocus={() => {
                                    ///setIsNotepadOpen6(true);
                                }}
                                onClick={(e: any) => {
                                    handlePromptShellCaret(e);
                                    setIsNotepadOpen6(true);
                                }}
                                onBlur={() => {
                                    // Notepad dialog controls closing
                                }}

                                // visuals: EXACT; only adds dim when Notepad is open
                                sx={{
                                    ...fieldShellSx,
                                    "& .MuiInputBase-root:focus": { outline: "none" },
                                    "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                    "& .Mui-focused": { outline: "none" },
                                    "& .MuiInputBase-input": {
                                        ...defaultFieldTextSx,
                                        fontSize: "0.85rem",
                                        fontFamily: "monospace",
                                        color: darkMode ? "#ccc" : "#444"
                                    },
                                    "& .MuiInputLabel-root": {
                                        color: darkMode ? "#ffffff" : "#000000",
                                        fontFamily: editorFontFamily,
                                        fontSize: "0.95rem",
                                        lineHeight: 1.55,
                                    },
                                    '& .MuiFilledInput-underline:after': {
                                        borderBottomColor: 'red', // keep your underline colors
                                    },
                                    '& .Mui-focused .MuiFilledInput-underline:after': {
                                        borderBottomColor: 'red',
                                    },

                                    mb: 1,
                                    maxHeight: matchMobile ? '25vh' : '15vh',
                                    overflow: 'auto',
                                    overflowY: "scroll",
                                    overflowX: "hidden",
                                    scrollSnapType: "y mandatory",
                                    scrollBehavior: "smooth",
                                    overscrollBehavior: "contain",
                                    WebkitOverflowScrolling: "touch",
                                    "&::-webkit-scrollbar": {
                                        width: "8px",
                                    },
                                    "&::-webkit-scrollbar-track": {
                                        background: "rgb(255,255,255,0.2)",
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        background: "rgb(150,150,150,0.8)",
                                        borderRadius: "4px",
                                    },
                                    "&::-webkit-scrollbar-thumb:hover": {
                                        background: "rgb(255,255,255,0.1)",
                                    },

                                    // dim while Notepad is open (matches your pattern)
                                    opacity: isNotepadOpen6 ? "0.03" : 1,
                                }}

                                // read-only shell; Notepad writes into `videotxt`
                                slotProps={{
                                    htmlInput: {
                                        readOnly: true,
                                        "aria-label": "Use Auto Prompt / Enter Video Prompt",
                                        onKeyDown: (e: any) => { e.preventDefault(); }, // block typing in shell
                                        autoCorrect: "on",
                                        spellCheck: true,
                                        autoCapitalize: "sentences",
                                        autoComplete: "off",
                                    },
                                }}
                            />
                        </Box>

                        {/* RIGHT: attached Notepad host */}
                        <Notepad
                            referenceImages={extendedReferenceImages}
                            ImagesHdCloud={ImagesHdCloud}
                            detectedCharacters={detectedCharacters}
                            Caret={Caret}
                            handleKeyDown={(e: any) => { handleKeyDownvid(e, videotxt, textVidUpdate, index); }}
                            TextFieldactive={TextFieldactive}
                            setTextFieldactive={setTextFieldactive}
                            GeneratedImage={''}
                            panel
                            type={200}
                            SelectedModel={button || SelectedModel}
                            darkMode={darkModeReducer}
                            size={matchMobile ? "small" : "medium"}
                            open={isNotepadOpen6}
                            setIsNotepadOpen={setIsNotepadOpen6}
                            placeholder="Use Auto Prompt / Enter Video Prompt"
                            // Notepad controls THIS fieldÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s value
                            value={videotxt}
                            cachedImageGen={vidGenCaches[index] || { text: '', imageUrl: null }}
                            onUpdateCachedImageGen={(newData) => {
                                setVidGenCaches(prev => {
                                    const next = [...prev];
                                    next[index] = newData;
                                    return next;
                                });
                            }}
                            onChange={(v: string) => {
                                if (typeof setvideotxt === "function") {
                                    setvideotxt(v);
                                } else {
                                    try {
                                        // mimic a normal event for your existing handler
                                        handleChangeTextVid({ target: { value: v } } as any);
                                    } catch { /* no-op */ }
                                }
                            }}

                            onClose={() => {
                                setIsNotepadOpen6(false);
                            }}

                            hide={false}
                            onSpeak={() => {
                                console.log("Speak / mic with video prompt:", videotxt);
                            }}
                        />
                    </Box>









                    {/* ===== Generate button (unchanged)  rest of your code ===== */}
                    <Box sx={{ order: 7, mt: "auto", width: "100%", pb: matchMobile ? 8 : 0, display: "flex", gap: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                if (videModel === "Veo") {
                                    // blocked by opacity anyway
                                } else if (videModel === 'pPro' && activeCharsForScene && activeCharsForScene.length > 3) {
                                    globalErrorEmitter.emit("maximum 3 characters for kling 3", index);
                                } else {
                                    GenerateVideo(index);
                                }
                            }}
                            sx={{
                                flex: 1,
                                borderRadius: 4,
                                background: darkMode ? "#E8BAFA" : "#0099cc",
                                opacity: videModel === "Veo" ? 0.4 : 1,
                                color: "#121212",
                                boxShadow: "0 12px 28px rgba(79, 207, 96, 0.26)",
                                "&:hover": {
                                    background: "linear-gradient(180deg, #6ae57a 0%, #57d668 100%)",
                                    color: "#121212",
                                    boxShadow: "0 14px 30px rgba(79, 207, 96, 0.32)",
                                },
                                px: 3,
                                py: 1.5,
                            }}
                        >
                            Generate

                            <Box
                                component="span"
                                sx={{ fontSize: "1.5em", visibility: "hidden" }}
                            >
                                .
                            </Box>
                            <Typography
                                variant="button"
                                sx={{
                                    fontSize: matchMobile ? "1.4rem" : "1.4em",
                                    lineHeight: 1,
                                    fontWeight: 700,
                                    background: GRADIENTx,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    textShadow: darkModeReducer
                                        ? "0px 1px 2px rgba(0, 0, 0, 0), 0px 2px 4px rgba(0, 0, 0, 0)"
                                        : "0px 1px 2px rgba(0, 0, 0, 0.12), 0px 2px 4px rgba(0, 0, 0, 0.08)",
                                }}
                            >
                                {button ? (
                                    <>
                                        {pixelsV.toLocaleString()}
                                        <Box
                                            component="span"
                                            sx={{
                                                fontSize: "0.5em",
                                                visibility: "hidden",
                                            }}
                                        >
                                            .
                                        </Box>
                                        <Box
                                            component="span"
                                            sx={{
                                                fontSize: "0.5em",
                                                verticalAlign: "baseline",
                                            }}
                                        >
                                            P
                                        </Box>
                                    </>
                                ) : null}
                            </Typography>

                            <PixelUpdater
                                musicKling={musicKling}
                                seconds={seconds}
                                plan={button ? button : "Prox"}
                                method={method}
                                imagesPerDollar={imagesPerDollar}
                                pixelsPerImage={pixelsPerImage}
                                rounding={rounding}
                                onChange={(res) => {
                                    setPixelsV(res.pixels);
                                }}
                            />
                        </Button>
                        <IconButton
                            onClick={() => setShow(false)}
                            sx={{
                                width: 56, height: 56, borderRadius: 4, flexShrink: 0,
                                bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                '&:hover': { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                            }}
                        >
                            <CloseIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                        </IconButton>
                    </Box>
                </Box>

            </Box>

            {
                showRemix ?


                    <Box

                        onClick={(e) => {
                            e.stopPropagation();
                            setshowRemix(false);
                            // Reset any iOS/Android auto-zoom caused by small input focus
                            if (matchMobile) {
                                const vp = document.querySelector('meta[name="viewport"]');
                                if (vp) {
                                    const orig = vp.getAttribute('content') || '';
                                    vp.setAttribute('content', orig.replace(/maximum-scale=[^,]*/g, '') + ',maximum-scale=1');
                                    setTimeout(() => vp.setAttribute('content', orig), 50);
                                }
                            }
                        }}
                        sx={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: '100%',
                            p: { xs: 2, sm: 3 },
                            color: darkMode ? "#fff" : "#000",
                            backgroundColor: darkMode
                                ? "rgba(10, 10, 10, 0.72)"
                                : "rgba(205, 205, 205, 0.42)",
                            backdropFilter: "blur(16px)",
                            zIndex: 90000,
                            cursor: 'pointer',
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",

                        }}
                    >

                        <Box


                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦
                            }}

                            sx={{
                                width: "100%",
                                maxWidth: "720px",
                                p: { xs: 2.5, sm: 3 },
                                color: darkMode ? "#fff" : "#000",
                                background: glassPanelBg,
                                border: shellBorder,
                                borderRadius: 4,
                                boxShadow: darkModeReducer ? "0 24px 80px rgba(0,0,0,0.55)" : "0 24px 80px rgba(31,38,135,0.15)",
                                backdropFilter: "blur(30px) saturate(180%)",
                            }}
                        >

                            <Typography variant="overline" sx={{ ...sectionTitleSx, color: '#888' }}>
                                Remix Scene
                            </Typography>

                            <TextField
                                variant="outlined"
                                fullWidth
                                multiline
                                minRows={1}
                                onKeyDown={handleKeyDownR}
                                value={textValue2}
                                onChange={handleChangeR}
                                placeholder="Enter a Prompt To Reimagine This Image"
                                sx={{
                                    ...fieldShellSx,
                                    "& .MuiInputBase-root:focus": { outline: "none" },
                                    "& .MuiInputBase-input:focus-visible": { outline: "none" },
                                    "& .Mui-focused": { outline: "none" },
                                    "& .MuiInputBase-input": {
                                        ...defaultFieldTextSx,
                                        fontSize: matchMobile ? "16px" : "0.95rem",
                                    },
                                    "& .MuiInputLabel-root": {
                                        color: darkMode ? "#ffffff" : "#000000",
                                        fontFamily: editorFontFamily,
                                        fontSize: "0.95rem",
                                        lineHeight: 1.55,
                                    },
                                    "& .MuiFormHelperText-root": {
                                        color: darkMode ? "#ffffff" : "#000000",
                                    },

                                    '& .MuiFilledInput-underline:after': {
                                        borderBottomColor: 'green', // focused underline color
                                    },
                                    '& .Mui-focused .MuiFilledInput-underline:after': {
                                        borderBottomColor: 'green', // explicitly force color when focused
                                    },

                                    mb: 1,
                                    maxHeight: matchMobile ? '20vh' : '16vh',
                                    overflow: 'auto',

                                    overflowY: "scroll",
                                    overflowX: "hidden",
                                    scrollSnapType: "y mandatory",
                                    scrollBehavior: "smooth",
                                    overscrollBehavior: "contain",
                                    WebkitOverflowScrolling: "touch",
                                    "&::-webkit-scrollbar": {
                                        width: "8px",
                                    },
                                    "&::-webkit-scrollbar-track": {
                                        background: "rgb(255,255,255,0.2)",
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        background: "rgb(150,150,150,0.8)",
                                        borderRadius: "4px",
                                    },
                                    "&::-webkit-scrollbar-thumb:hover": {
                                        background: "rgb(255,255,255,0.1)",
                                    },
                                }}
                            />

                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => {

                                    handleDraw(textValue2, generatedImagesFlux[index], 0);

                                    ///handleClickBasePicker();

                                }}
                                sx={{
                                    ...greenPrimaryButtonSx,
                                    px: 3,
                                    py: 1.5,
                                }}
                            >
                                Edit
                            </Button>
                        </Box> </Box> : null
            }

            <Box onClick={(e) => e.stopPropagation()}>
                {/* Mirror UI Action Modal */}
                <Modal open={openActionModal === index} disableRestoreFocus disableEnforceFocus onClose={(e, reason) => { if (reason !== 'backdropClick') setOpenActionModal(null); }} sx={{ zIndex: 999999 }}>
                    <Box onClick={(e) => { e.stopPropagation(); setOpenActionModal(null); }} sx={{
                        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        p: { xs: 0, sm: 3 }, bgcolor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)'
                    }}>
                        <Box onClick={(e) => e.stopPropagation()} sx={{
                            width: '100%', maxWidth: 600, height: '100%',
                            bgcolor: darkMode ? '#121212' : '#fff', color: darkMode ? '#fff' : '#000',
                            borderRadius: { xs: 0, sm: 4 }, display: 'flex', flexDirection: 'column', p: 3, position: 'relative'
                        }}>
                            <IconButton onClick={(e) => { e.stopPropagation(); setOpenActionModal(null); }} sx={{ position: 'absolute', top: 16, right: 16, color: darkMode ? '#fff' : '#000', zIndex: 10 }}>
                                <CloseIcon />
                            </IconButton>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{actionModalMode === 'action' ? "Action Image Generation" : "Motion Storyboard Generation"}</Typography>

                            {actionModalMode === 'action' ? (
                                <>

                                    {/* Generated Action Images Gallery */}
                                    {actionImagesMap[index] && actionImagesMap[index].length > 0 && (
                                        <Box sx={{
                                            display: 'flex', overflowX: 'auto', gap: 2, mb: 2, pb: 1.5,
                                            '&::-webkit-scrollbar': { height: 6 },
                                            '&::-webkit-scrollbar-thumb': { background: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 3 }
                                        }}>
                                            {actionImagesMap[index].filter((act: any) => act.imageUrl && act.imageUrl.startsWith('http')).map((actObj: any, idx: number) => (
                                                <Box key={idx}
                                                    onClick={() => setFullScreenActionImage({ ...actObj, isMotion: false })}
                                                    sx={{
                                                        flexShrink: 0, width: { xs: '50%', sm: '30%' }, borderRadius: 3, overflow: 'hidden',
                                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                        cursor: 'pointer'
                                                    }}>
                                                    <img src={actObj.imageUrl} alt={actObj.name} style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', borderRadius: '12px' }} />
                                                </Box>
                                            ))}
                                        </Box>
                                    )}

                                    {/* UPDATE WITH AI field */}
                                    <Typography variant="overline" sx={{ color: darkMode ? '#E8BAFA' : '#0099cc', fontWeight: 800, mt: 1, mb: 1 }}>UPDATE WITH AI</Typography>
                                    <TextField
                                        fullWidth placeholder="Describe change to Gpt"
                                        value={actionUpdateText} onChange={(e) => setActionUpdateText(e.target.value)}
                                        sx={{
                                            mb: 3,
                                            '& .MuiOutlinedInput-root': { bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5', borderRadius: 2 },
                                            '& .MuiInputBase-input': {
                                                color: darkMode ? '#ffffff' : '#000000',
                                                py: 1.5,
                                                caretColor: 'auto !important'
                                            }
                                        }}
                                    />

                                    {/* Mirror the characters bar */}
                                    <Box sx={{ display: 'flex', overflowX: 'auto', gap: 2, pb: hasExpandedActionChars ? 3 : 1, mb: 2, alignItems: 'flex-start', minHeight: hasExpandedActionChars ? 190 : 80 }}>
                                        {actionPopupCharacters?.map((ref: any, idx: number) => {
                                            const rawName = String(ref.name).trim();
                                            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                            const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");
                                            const words = rawName.split(/[\s\-]+/);
                                            const flexibleNamePattern = words.map((w: string) => escapeRegExp(w)).join('[\\s\\-]*');
                                            const regex = new RegExp(`(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)`, "i");
                                            const isActivated = regex.test(actionPrompt);
                                            const themeColor = darkMode ? "#E8BAFA" : "#0099cc";
                                            const themeShadow = darkMode ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)";

                                            return (
                                                <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, py: 1 }}>
                                                    <Avatar src={ref.imageUrl || ref.url} alt={ref.name}
                                                        sx={{
                                                            width: hasExpandedActionChars ? 150 : 54,
                                                            height: hasExpandedActionChars ? 150 : 54,
                                                            cursor: 'pointer',
                                                            border: isActivated ? `3px solid ${themeColor}` : "2.5px solid transparent",
                                                            boxShadow: isActivated ? `0 0 12px ${themeShadow}` : "none",
                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            '& .MuiAvatar-img': { objectPosition: 'top' }
                                                        }}
                                                        onClick={() => {
                                                            if (!hasExpandedActionChars) {
                                                                setHasExpandedActionChars(true);
                                                                return; // Just expand on the first click
                                                            }
                                                            if (isActivated) {
                                                                // Remove the character from prompt
                                                                setActionPrompt(prev => {
                                                                    const replaceRegex = new RegExp(`(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)\\s*`, "gi");
                                                                    return prev.replace(replaceRegex, '').replace(/\s{2,}/g, ' ').trim() + " ";
                                                                });
                                                            } else {
                                                                // Add the character
                                                                setActionPrompt(prev => prev.trim() + ` ${handle} `);
                                                            }
                                                        }} />
                                                    {hasExpandedActionChars && (
                                                        <Typography variant="caption" sx={{
                                                            mt: 1, fontWeight: 800, fontSize: '0.75rem',
                                                            color: darkMode ? '#fff' : '#000',
                                                            maxWidth: 140, textAlign: 'center',
                                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                            transition: 'color 0.2s ease'
                                                        }}>
                                                            {String(ref.name).trim()}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            );
                                        })}
                                    </Box>

                                    {/* Default Prompt Reset Button & Prompt */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="overline" sx={{ color: darkMode ? '#E8BAFA' : '#0099cc', fontWeight: 800 }}>IMAGE PROMPT</Typography>
                                        <Button size="small" onClick={() => setActionPrompt(currentSelectedPrompts[0] || textValue || "")} sx={{ fontSize: '0.7rem', color: darkMode ? '#aaa' : '#555', textTransform: 'none' }}>
                                            Restore Original Text
                                        </Button>
                                    </Box>

                                    <TextField
                                        multiline rows={4} fullWidth placeholder="Enter action prompt (e.g. zooming in on @jamie)"
                                        value={actionPrompt} onChange={(e) => setActionPrompt(e.target.value)}
                                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5', borderRadius: 2 }, '& .MuiInputBase-input': { color: darkMode ? '#ffffff' : '#000000', caretColor: 'auto !important' } }}
                                    />

                                    <Button
                                        variant="contained" fullWidth disabled={isGeneratingAction || !actionPrompt}
                                        onClick={async () => {
                                            setIsGeneratingAction(true);

                                            // Extract active characters to send in the image gen call
                                            const activeActionChars = actionPopupCharacters?.filter((ref: any) => {
                                                const rawName = String(ref.name).trim();
                                                const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");
                                                const words = rawName.split(/[\s\-]+/);
                                                const flexibleNamePattern = words.map((w: string) => escapeRegExp(w)).join('[\\s\\-]*');
                                                const regex = new RegExp(`(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)`, "i");
                                                return regex.test(actionPrompt);
                                            }) || [];

                                            try {
                                                // 1. Prepare base64 image prompts from active characters
                                                const validBase64Images = activeActionChars
                                                    .map((c: any) => c.image || c.imageUrl || c.url)
                                                    .filter((u: any) => typeof u === 'string' && u.trim() !== '');

                                                let actionUrl = 'minimax';
                                                if (modelz === 'Bannana' || modelz === 'Imagen') actionUrl = 'Bannana';
                                                else if (modelz === 'Imagen2') actionUrl = 'Bannana2';
                                                else if (modelz === 'minimax') actionUrl = 'minimax';
                                                else if (modelz === 'fluxUltra' || modelz === 'FluxUltra' || modelz === 'Kontext') actionUrl = 'kontext';
                                                else if (modelz === 'fluxUltra2' || modelz === 'FluxUltra2') actionUrl = 'fluxUltra2';
                                                else if (modelz === 'Gpt Image') actionUrl = 'GptImage';
                                                else if (modelz === 'minimax2') actionUrl = 'minimax2';
                                                else if (modelz === 'Schnell' || modelz === 'Models') actionUrl = 'fluxschnell';
                                                else if (modelz === 'Hi Dream') actionUrl = 'HiDream';
                                                else if (modelz === 'seeDream') actionUrl = 'seeDream';
                                                else if (modelz === 'fluxDev') actionUrl = 'fluxDev';

                                                const finalPrompt = actionUpdateText ? `${actionPrompt} | AI Edit: ${actionUpdateText}` : actionPrompt;

                                                const payload: any = {
                                                    inputs: finalPrompt,
                                                    width: 1080,
                                                    height: 1920,
                                                    guidance: 7.5,
                                                    num_inference_steps: 35,
                                                    seed: Seed,
                                                    ty: ratioKey,
                                                    model: modelz,
                                                    Png: true
                                                };

                                                if (validBase64Images.length > 0) {
                                                    payload.sampleImages = validBase64Images;
                                                    payload.sampleimagesnames = activeActionChars;
                                                }

                                                if (isBShotGridContext && bIndex !== undefined) {
                                                    setGeneratingAt(bIndex, true);
                                                    if (startLoader) startLoader(bIndex);
                                                } else {
                                                    setGeneratingAt(index, true);
                                                    if (startLoader) startLoader(index);
                                                }

                                                // 2. Generate Image via Backend
                                                const response: any = await axios.post(`${CLIK_URL}/${actionUrl}`, payload, {
                                                    withCredentials: true,
                                                    timeout: 900000,
                                                });

                                                if (response.status === 200 && response.data.imageBase64) {
                                                    const fetchRes = await fetch(response.data.imageBase64);
                                                    const fluxImageBlobx = await fetchRes.blob();

                                                    // 3. Convert to HD format for S3
                                                    const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(fluxImageBlobx, modelz, ratioKey);

                                                    // 4. Upload directly to S3
                                                    const signedUrls = await GenerateSignedUrlForSingleImage(fluxImageBlobHd);
                                                    const uploadedHdUrl = await PutSingleImageInS3WithURL(fluxImageBlobHd, signedUrls);

                                                    // 5. Register with auto-delete helper (cleans S3 bucket after 6 hrs if not formally saved)
                                                    Saveprompthelperfordellater(uploadedHdUrl);

                                                    // 5. Save the final S3 URL to our Action Gallery State
                                                    setActionImagesMap(prev => {
                                                        const existing = prev[index] || [];
                                                        const newActionCount = existing.length + 1;
                                                        return {
                                                            ...prev,
                                                            [index]: [...existing, {
                                                                name: `action${newActionCount}`,
                                                                description: finalPrompt,
                                                                imageUrl: uploadedHdUrl
                                                            }]
                                                        };
                                                    });

                                                    // Deduct cost
                                                    removePixel(pixelsc);
                                                } else {
                                                    throw new Error("Invalid response from generation server.");
                                                }

                                            } catch (err) {
                                                console.error("Action Generation failed", err);
                                                globalErrorEmitter.emit("Action Image generation failed. Please try again.", index);
                                            } finally {
                                                setIsGeneratingAction(false);
                                                if (isBShotGridContext && bIndex !== undefined) {
                                                    setGeneratingAt(bIndex, false);
                                                    if (finishLoader) finishLoader(bIndex, false);
                                                } else {
                                                    setGeneratingAt(index, false);
                                                    if (finishLoader) finishLoader(index, false);
                                                }
                                            }
                                        }}
                                        sx={{
                                            bgcolor: darkMode ? '#E8BAFA' : '#0099cc', color: '#121212', fontWeight: 800, py: 1.5, borderRadius: 4, mt: 'auto', boxShadow: "0 12px 28px rgba(79, 207, 96, 0.26)",
                                            '&.Mui-disabled': {
                                                bgcolor: darkMode ? 'rgba(232,186,250,0.4)' : 'rgba(0,153,204,0.4)',
                                                color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
                                            }
                                        }}
                                    >
                                        {isGeneratingAction ? <CircularProgress size={24} color="inherit" /> : `GENERATE ACTION (${pixelsc.toLocaleString()} P)`}
                                    </Button>

                                </>
                            ) : (
                                <>
                                    {/* MOTION GALLERY */}
                                    {motionImagesMap[index] && motionImagesMap[index].length > 0 && (
                                        <Box sx={{
                                            display: 'flex', overflowX: 'auto', gap: 2, mb: 2, pb: 1.5,
                                            '&::-webkit-scrollbar': { height: 6 },
                                            '&::-webkit-scrollbar-thumb': { background: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 3 }
                                        }}>
                                            {motionImagesMap[index].filter((mot: any) => mot.imageUrl && mot.imageUrl.startsWith('http')).map((motObj: any, idx: number) => (
                                                <Box key={idx}
                                                    onClick={() => setFullScreenActionImage({ ...motObj, isMotion: true })}
                                                    sx={{
                                                        flexShrink: 0, width: { xs: '50%', sm: '30%' }, borderRadius: 3, overflow: 'hidden',
                                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                        cursor: 'pointer'
                                                    }}>
                                                    <img src={motObj.imageUrl} alt={motObj.name} style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', borderRadius: '12px' }} />
                                                </Box>
                                            ))}
                                        </Box>
                                    )}

                                    {/* UPDATE SCENE WITH AI */}
                                    <Typography variant="overline" sx={{ color: darkMode ? '#E8BAFA' : '#0099cc', fontWeight: 800, mt: 1, mb: 1 }}>UPDATE SCENE WITH AI</Typography>
                                    <Box sx={{ display: "flex", alignItems: "stretch", width: "100%", mb: 3 }}>
                                        <TextField
                                            variant="outlined" fullWidth multiline minRows={1}
                                            value={textVidUpdate}
                                            onChange={(e) => settextVidUpdate(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (textVidUpdate) EditGeneratedVisualTextOnlyFn(index, textVidUpdate, videotxt, 1);
                                                }
                                            }}
                                            placeholder="Describe change to Gpt and press Enter"
                                            sx={{
                                                '& .MuiOutlinedInput-root': { bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5', borderRadius: '8px 0 0 8px' },
                                                '& .MuiInputBase-input': {
                                                    color: darkMode ? '#ffffff' : '#000000',
                                                    py: 1.5,
                                                    caretColor: 'auto !important'
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={() => {
                                                if (textVidUpdate) EditGeneratedVisualTextOnlyFn(index, textVidUpdate, videotxt, 1);
                                            }}
                                            disabled={loadersPrompt[index] || !textVidUpdate}
                                            sx={{
                                                bgcolor: darkMode ? '#E8BAFA' : '#0099cc', color: darkMode ? '#000' : '#fff', borderRadius: '0 8px 8px 0', px: 3,
                                                '&:hover': { bgcolor: darkMode ? '#d7a2ef' : '#007bb5' }
                                            }}
                                        >
                                            {loadersPrompt[index] ? <CircularProgress size={24} color="inherit" /> : <AutoFixHighIcon />}
                                        </Button>
                                    </Box>

                                    {/* VIDEO PROMPT READ-ONLY */}
                                    <Typography variant="overline" sx={{ color: darkMode ? '#E8BAFA' : '#0099cc', fontWeight: 800, mb: 1 }}>VIDEO PROMPT (READ-ONLY)</Typography>
                                    <TextField
                                        multiline rows={5} fullWidth
                                        value={videotxt}
                                        InputProps={{ readOnly: true }}
                                        sx={{
                                            mb: 3,
                                            '& .MuiOutlinedInput-root': { bgcolor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: 2 },
                                            '& .MuiInputBase-input': { color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', caretColor: 'auto !important' }
                                        }}
                                    />

                                    <Button
                                        variant="contained" fullWidth disabled={isGeneratingAction || !videotxt}
                                        onClick={async () => {
                                            setIsGeneratingAction(true);

                                            try {
                                                // STEP 3: AI Storyboard Translation
                                                const instructions = "You are an expert storyboard artist. Convert the provided action scene into a single highly descriptive image generation prompt for a multi-panel comic grid (min 2, max 8 panels). The prompt must be designed for a text-to-image model. CRITICAL RULE: You MUST perfectly retain all @CharacterNames exactly as they appear in the source text.";
                                                const requestData = { promptx: videotxt, instructions, imageUrl: ImagesHdCloud[index] };

                                                const llmResponse = await axios.post(`${CLIK_URL}/GptRemakeText`, requestData, { withCredentials: true, timeout: 90000 });

                                                let gridImagePrompt = llmResponse.data?.payload;
                                                if (!gridImagePrompt) throw new Error("Failed to generate storyboard prompt");

                                                // STEP 4: Reusing Generation & Injection
                                                const activeActionChars = actionPopupCharacters?.filter((ref: any) => {
                                                    const rawName = String(ref.name).trim();
                                                    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                    const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");
                                                    const words = rawName.split(/[\s\-]+/);
                                                    const flexibleNamePattern = words.map((w: string) => escapeRegExp(w)).join('[\s\-]*');
                                                    const regex = new RegExp(`(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)`, "i");
                                                    return regex.test(gridImagePrompt);
                                                }) || [];

                                                const validBase64Images = activeActionChars
                                                    .map((c: any) => c.image || c.imageUrl || c.url)
                                                    .filter((u: any) => typeof u === 'string' && u.trim() !== '');

                                                let actionUrl = 'minimax';
                                                if (modelz === 'Bannana' || modelz === 'Imagen') actionUrl = 'Bannana';
                                                else if (modelz === 'Imagen2') actionUrl = 'Bannana2';
                                                else if (modelz === 'minimax') actionUrl = 'minimax';
                                                else if (modelz === 'fluxUltra' || modelz === 'FluxUltra' || modelz === 'Kontext') actionUrl = 'kontext';
                                                else if (modelz === 'fluxUltra2' || modelz === 'FluxUltra2') actionUrl = 'fluxUltra2';
                                                else if (modelz === 'Gpt Image') actionUrl = 'GptImage';
                                                else if (modelz === 'minimax2') actionUrl = 'minimax2';
                                                else if (modelz === 'Schnell' || modelz === 'Models') actionUrl = 'fluxschnell';
                                                else if (modelz === 'Hi Dream') actionUrl = 'HiDream';
                                                else if (modelz === 'seeDream') actionUrl = 'seeDream';
                                                else if (modelz === 'fluxDev') actionUrl = 'fluxDev';

                                                const payload: any = {
                                                    inputs: gridImagePrompt,
                                                    width: 1080,
                                                    height: 1920,
                                                    guidance: 7.5,
                                                    num_inference_steps: 35,
                                                    seed: Seed,
                                                    ty: ratioKey,
                                                    model: modelz
                                                };

                                                if (validBase64Images.length > 0) {
                                                    payload.sampleImages = validBase64Images;
                                                    payload.sampleimagesnames = activeActionChars;
                                                }

                                                // Generate Image via Backend
                                                const response: any = await axios.post(`${CLIK_URL}/${actionUrl}`, payload, {
                                                    withCredentials: true,
                                                    timeout: 900000,
                                                });

                                                if (response.status === 200 && response.data.imageBase64) {
                                                    const fetchRes = await fetch(response.data.imageBase64);
                                                    const fluxImageBlobx = await fetchRes.blob();

                                                    const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(fluxImageBlobx, modelz, ratioKey);
                                                    const signedUrls = await GenerateSignedUrlForSingleImage(fluxImageBlobHd);
                                                    const uploadedHdUrl = await PutSingleImageInS3WithURL(fluxImageBlobHd, signedUrls);
                                                    Saveprompthelperfordellater(uploadedHdUrl);

                                                    setMotionImagesMap(prev => {
                                                        const existing = prev[index] || [];
                                                        const newMotionCount = existing.length + 1;
                                                        return {
                                                            ...prev,
                                                            [index]: [...existing, {
                                                                name: `motion${newMotionCount}`,
                                                                description: gridImagePrompt,
                                                                imageUrl: uploadedHdUrl
                                                            }]
                                                        };
                                                    });

                                                    removePixel(pixelsc);
                                                } else {
                                                    throw new Error("Invalid response from generation server.");
                                                }

                                            } catch (err) {
                                                console.error("Motion Generation failed", err);
                                                globalErrorEmitter.emit("Motion Storyboard generation failed. Please try again.", index);
                                            } finally {
                                                setIsGeneratingAction(false);
                                            }
                                        }}
                                        sx={{
                                            bgcolor: darkMode ? '#E8BAFA' : '#0099cc', color: '#121212', fontWeight: 800, py: 1.5, borderRadius: 4, mt: 'auto', boxShadow: "0 12px 28px rgba(79, 207, 96, 0.26)",
                                            '&.Mui-disabled': {
                                                bgcolor: darkMode ? 'rgba(232,186,250,0.4)' : 'rgba(0,153,204,0.4)',
                                                color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
                                            }
                                        }}
                                    >
                                        {isGeneratingAction ? <CircularProgress size={24} color="inherit" /> : `GENERATE MOTION (${pixelsc.toLocaleString()} P)`}
                                    </Button>
                                </>
                            )}

                        </Box>
                    </Box>
                </Modal>

                {/* Full Screen Action Image Viewer */}
                <Modal
                    open={!!fullScreenActionImage}
                    disableRestoreFocus
                    disableEnforceFocus
                    onClose={(e, reason) => { if (e && e.stopPropagation) e.stopPropagation(); setFullScreenActionImage(null); setIsScenesModeActive(true); }}
                    sx={{ zIndex: 999999 }}
                >
                    <Box
                        onClick={() => { setFullScreenActionImage(null); setIsScenesModeActive(true); }}
                        sx={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            bgcolor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2
                        }}
                    >
                        <IconButton
                            onClick={(e) => { e.stopPropagation(); setFullScreenActionImage(null); setIsScenesModeActive(true); }}
                            sx={{ position: 'absolute', top: { xs: 10, sm: 20 }, right: { xs: 10, sm: 20 }, color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                        >
                            <CloseIcon />
                        </IconButton>
                        <img
                            src={fullScreenActionImage?.imageUrl || ''}
                            alt={fullScreenActionImage?.name || 'Full screen action'}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onClick={(e) => e.stopPropagation()}
                        />

                        {/* Add bottom USE and DELETE buttons */}
                        {fullScreenActionImage && (
                            <Box onClick={(e) => e.stopPropagation()} sx={{ position: 'absolute', bottom: { xs: 20, sm: 40 }, width: '100%', display: 'flex', justifyContent: 'center', gap: 2, px: 2, maxWidth: 600, left: '50%', transform: 'translateX(-50%)' }}>
                                {(() => {
                                    const isActiveAction = !fullScreenActionImage.isMotion && (activeActionImagesMap[index] || []).some(act => act.imageUrl === fullScreenActionImage.imageUrl);
                                    const isActiveMotion = fullScreenActionImage.isMotion && (activeMotionImagesMap[index] || []).some(mot => mot.imageUrl === fullScreenActionImage.imageUrl);
                                    const isActive = fullScreenActionImage.isMotion ? isActiveMotion : isActiveAction;

                                    return (
                                        <>
                                            {/* DELETE BUTTON (RED) - Only visible when opened from Action Generation Modal */}
                                            {openActionModal !== null && (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // 1. Remove from active if present
                                                        setActiveActionImagesMap(prev => {
                                                            const existing = prev[index] || [];
                                                            return { ...prev, [index]: existing.filter(act => act.imageUrl !== fullScreenActionImage.imageUrl) };
                                                        });
                                                        setActiveMotionImagesMap(prev => {
                                                            const existing = prev[index] || [];
                                                            return { ...prev, [index]: existing.filter(mot => mot.imageUrl !== fullScreenActionImage.imageUrl) };
                                                        });
                                                        // 2. Remove from actionImagesMap
                                                        setActionImagesMap(prev => {
                                                            const existing = prev[index] || [];
                                                            return { ...prev, [index]: existing.filter(act => act.imageUrl !== fullScreenActionImage.imageUrl) };
                                                        });
                                                        // 3. Remove from motionImagesMap
                                                        setMotionImagesMap(prev => {
                                                            const existing = prev[index] || [];
                                                            return { ...prev, [index]: existing.filter(mot => mot.imageUrl !== fullScreenActionImage.imageUrl) };
                                                        });
                                                        // 3. Delete from S3
                                                        startDelete(fullScreenActionImage.imageUrl);
                                                        // 4. Close viewer
                                                        setFullScreenActionImage(null);
                                                        setIsScenesModeActive(true);
                                                    }}
                                                    sx={{
                                                        flex: 1,
                                                        bgcolor: 'rgba(255,50,50,0.8)',
                                                        color: '#fff',
                                                        fontWeight: 800, py: 2, borderRadius: 3, backdropFilter: 'blur(10px)',
                                                        '&:hover': { bgcolor: 'rgba(255,0,0,1)' }
                                                    }}
                                                >
                                                    DELETE
                                                </Button>
                                            )}

                                            {/* USE / REMOVE BUTTON or NAME CHIP */}
                                            {openActionModal !== null ? (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (fullScreenActionImage.isMotion) {
                                                            setActiveMotionImagesMap(prev => {
                                                                const existing = prev[index] || [];
                                                                if (isActiveMotion) {
                                                                    return { ...prev, [index]: existing.filter(mot => mot.imageUrl !== fullScreenActionImage.imageUrl) };
                                                                } else {
                                                                    return { ...prev, [index]: [...existing, fullScreenActionImage] };
                                                                }
                                                            });
                                                        } else {
                                                            setActiveActionImagesMap(prev => {
                                                                const existing = prev[index] || [];
                                                                if (isActiveAction) {
                                                                    return { ...prev, [index]: existing.filter(act => act.imageUrl !== fullScreenActionImage.imageUrl) };
                                                                } else {
                                                                    return { ...prev, [index]: [...existing, fullScreenActionImage] };
                                                                }
                                                            });
                                                        }
                                                        // Auto-close viewer after adding/removing
                                                        setFullScreenActionImage(null);
                                                        setIsScenesModeActive(true);
                                                    }}
                                                    sx={{
                                                        flex: 1,
                                                        bgcolor: isActive ? 'rgba(0,150,255,0.8)' : 'rgba(50,205,50,0.8)', // blue if active, green if not
                                                        color: '#fff',
                                                        fontWeight: 800, py: 2, borderRadius: 3, backdropFilter: 'blur(10px)',
                                                        '&:hover': { bgcolor: isActive ? 'rgba(0,120,255,1)' : 'rgba(34,139,34,1)' }
                                                    }}
                                                >
                                                    {isActive ? "REMOVE" : "USE"}
                                                </Button>
                                            ) : (
                                                <Box sx={{
                                                    bgcolor: 'rgba(0,0,0,0.7)',
                                                    color: '#fff',
                                                    px: 2,
                                                    py: 1,
                                                    borderRadius: 2,
                                                    backdropFilter: 'blur(8px)',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 500,
                                                    mb: 2
                                                }}>
                                                    {fullScreenActionImage.name}
                                                </Box>
                                            )}
                                        </>
                                    );
                                })()}
                            </Box>
                        )}
                    </Box>
                </Modal>
            </Box>

        </Box >,
        document.body
    );

};

export default EditStory;
