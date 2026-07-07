// PromptInput.tsx

import React, { useState, useCallback, useEffect, useRef } from "react";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { Button, Box, Menu, MenuItem, Typography, CircularProgress, IconButton, Modal, Avatar } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon
import ViewListIcon from "@mui/icons-material/ViewList";
import ForumIcon from "@mui/icons-material/Forum";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import PersonIcon from '@mui/icons-material/Person';
import LandscapeIcon from '@mui/icons-material/Landscape';
import CategoryIcon from '@mui/icons-material/Category';  ///casting complete

import { cycleAspectRatio3, cycleAspectRatio2, toggleDarkMode, setPixels } from './settingsSlice'; // <-- adjust path
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

import PlanSteps from "./PlanSteps"; // adjust path to match your project



import { useSelector, useDispatch } from "react-redux";
import { setArtstyle, setModel, setPromptRed } from "./settingsSlice";
import { RootState, AppDispatch } from "./store";


////helperimagesprompt



import WorldModel from './WorldModel';


import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import { Saveprompthelperfordellater, RemoveFromDeleteLater } from "./SavepromptHelpersLocal";

import { setLogin } from "./settingsSlice";

import { calcModelPixels } from "./ModelPixels";   // adjust path

import AspectRatioBox from './AspectRatioBox'

import { useParams, useLocation, useNavigate } from "react-router-dom"; // <-- Import useParams he
import LockIcon from '@mui/icons-material/Lock';

import PingLoader from './ping';
import { matchPc, matchTablet } from "./DetectDevice";
import ImageIcon from '@mui/icons-material/Image';

import GradientIcon from '@mui/icons-material/Gradient';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';

import EditIcon from '@mui/icons-material/Edit';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from "axios"; // Import Axios

import ModelPixels from './ModelPixels'

import EditStory from "./EditStory";

import Storybook from './Storybook';

///const [VideMode, setVideMode] = useState(false);

import ModelSelectionModal, { ModelData } from './ModelSelectionModal';
import PromptToolbar from './PromptToolbar';

import CheckIcon from '@mui/icons-material/Check';
///localhost

import TitleSelector from "./TitleSelector"; // path to the file

import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Scale } from "@mui/icons-material";
import AudioNarration from "./AudioNarration";

import { keyframes } from "@emotion/react";

import Notepad from "./Notepad";
import AudioPicker from "./AudioPicker";
import type { ImageGenCache } from "./components/PromptConstructor";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";

type ReferenceImageItem = {
  name: string;
  type: string;
  imageUrl: string;
  prompt: string;
  originalPrompt?: string;
  isGenerating?: boolean;
  [key: string]: any;
};
import Mirror from "./Mirror";
import { matchMobile } from "./DetectDevice";


// Define your CLIK_URL here or import it if it's defined elsewhere caption Delete
const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_HUGG = import.meta.env.VITE_HUGG;
const APP_STATE = import.meta.env.VITE_APPX_STATE;


// Predefined suggestions for autocomplete
const suggestions: string[] = [
  // Add more predefined prompts as needed
];

const PromptInput: React.FC<any> = React.memo(({ isMenuOpen, setcallFeeds, setAllowPing, AllowPing, minimisePrompt, setminimisePrompt, type, callFeeds, setFluxLoaded,
  fluxLoaded,
  isSubmittingKick,
  setIsSubmittingKick,
  setIsSubmitting,
  isSubmitting,
  IsMobileBackActive,
  setIsMobileBackActive,
  clikt,
  setclikt,
  setHideBottom,
  GeneratedImage,
  setGeneratedImage,
  setstopFeeds,
  stopFeeds,
  magicMode,
  setType,
  genCache: externalGenCache,
  setGenCache: externalSetGenCache,
  instantCall,
  setinstantCall
}) => {


  const VITE_REPLI_KEY = import.meta.env.VITE_REPLI_KEY;
  const [prompt, setPrompt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const actualSubmitRef = useRef<(() => void) | null>(null);

  const [isMirrorFocused, setIsMirrorFocused] = useState<boolean>(magicMode || false);

  useEffect(() => {
    setIsMirrorFocused(magicMode || false);
  }, [magicMode]);

  const [planEditText, setPlanEditText] = useState("");

  const [internalGenCache, setInternalGenCache] = useState<ImageGenCache | undefined>();
  const genCache = externalGenCache || internalGenCache;
  const setGenCache = externalSetGenCache || setInternalGenCache;

  const [expandedScene, setExpandedScene] = useState<boolean>(false);

  const [IsColdStart, setIsColdStart] = useState<boolean>(false); // Optional: To handle cold start state
  const [StopText, setStopText] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  // const { routeScrollPos, routelastId, userId } = location.state || {};


  // Aggressive Navigation Lock & Fallback
  useEffect(() => {
    // Only apply the lock state when PromptInput is physically open
    if (!minimisePrompt) {
      // 1. Universal Fallback: BeforeUnload (Warning on tab close / refresh)
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = ''; // Triggers the standard browser warning dialog
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      // 2. History Trapping (prevent swipe back / back button)
      // Note: We only pushState if we are not already trapped to avoid history buildup loop
      window.history.pushState(null, "", window.location.href);

      const handlePopState = (event: PopStateEvent) => {
        window.history.pushState(null, "", window.location.href);
      };
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [minimisePrompt]);

  const dispatch = useDispatch();

  const artstyleRedux = useSelector((state: RootState) => state.settings.artstyle);
  const modelRedux = useSelector((state: RootState) => state.settings.model);
  const promptRedux = useSelector((state: RootState) => state.settings.prompt);

  ///startDelete(GeneratedImage);
  const [promptx, setPromptx] = useState<string>("");

  ///seed


  const [planInfo, setPlanInfo] = useState(0);

  const [Seed, setSeed] = useState<number>(100);

  const [big, setBig] = useState(false);

  const [narrate, setnarrate] = useState(false);


  const [flip, setflip] = useState(false);

  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
  const maxCharacters = 3000; // Example character limit


  const [TextFieldactive, setTextFieldactive] = useState(false);

  const [VideMode, setVideMode] = useState(false);
  const [promptMusicPickerOpen, setPromptMusicPickerOpen] = useState(false);
  const [promptMusicMode, setPromptMusicMode] = useState(true);
  const [promptMusicUrl, setPromptMusicUrl] = useState("");
  const [promptMusicName, setPromptMusicName] = useState("");
  const [promptMusicBreakerSec, setPromptMusicBreakerSec] = useState<5 | 10>(10);
  const [promptMusicSceneCount, setPromptMusicSceneCount] = useState(9);
  const [promptMusicSegments, setPromptMusicSegments] = useState<{ index: number; start: number; end: number }[]>([]);

  const resetPromptMusicState = () => {
    setPromptMusicPickerOpen(false);
    setPromptMusicMode(true);
    setPromptMusicUrl("");
    setPromptMusicName("");
    setPromptMusicBreakerSec(10);
    setPromptMusicSceneCount(9);
    setPromptMusicSegments([]);
  };


  const [base, setbase] = useState<string[]>([]);
  const [startEdit, setstartEdit] = useState(false);


  const [parsedKeyPoints, setParsedKeyPoints] = useState<string[]>([]);
  const [parsedKeyPointsx, setParsedKeyPointsx] = useState<string[]>([]);
  const [parsedKeyPointsb, setParsedKeyPointsb] = useState<string[]>([]);


  const [Planx, setPlanx] = useState<any>(null);

  const [allowSpin, setallowSpin] = useState<any>(false);

  const [DummyMode, setDummyMode] = useState<any>(false);



  // Redux selector for dark mode countdown

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const darkMode = darkModeReducer;

  // --- Dynamic Button Theme (holds button bg/text + hover bg/text per mode) ---
  type ButtonTheme = {
    bg: string;
    text: string;
    hoverBg: string;
    hoverText: string;
  };

  const makeButtonTheme = (dark: boolean): ButtonTheme => ({
    bg: dark ? "rgba(10, 10, 10, 0.45)" : "rgba(255, 255, 255, 0.45)",
    text: dark ? "#ffffff" : "#000000",
    hoverBg: dark ? "rgba(15, 15, 15, 0.65)" : "rgba(255, 255, 255, 0.65)",
    hoverText: dark ? "#ffffff" : "#000000",
  });

  const [buttonTheme, setButtonTheme] = useState<ButtonTheme>(() => makeButtonTheme(darkMode));

  // Keep the button theme in sync whenever dark/light mode changes
  useEffect(() => {
    setButtonTheme(makeButtonTheme(darkMode));
  }, [darkMode]);


  const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);

  // --- Attention & Countdown System ---
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Scene Popup Modal ---
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [nanoImages, setNanoImages] = useState<string[]>([]);

  // --- Concept Generation Studio Modal ---
  const [showPathChoiceOverlay, setShowPathChoiceOverlay] = useState<boolean>(false);
  const [expandedChoiceScene, setExpandedChoiceScene] = useState<number>(0);
  const [showStudioModal, setShowStudioModal] = useState<boolean>(false);
  const [isRevisitingCharacter, setIsRevisitingCharacter] = useState<boolean>(false);
  const [showConfirmClose, setShowConfirmClose] = useState<boolean>(false);
  const [castingInstruction, setCastingInstruction] = useState<string>("");
  const [castingStatus, setCastingStatus] = useState<string>("Analyzing script & matching actors...");
  const [detectedCharacters, setDetectedCharacters] = useState<any[]>([]);
  const [detectedEnvironments, setDetectedEnvironments] = useState<any[]>([]);

  // --- Pricing & Auto-Proceed Studio Button ---
  const [skipCountdown, setSkipCountdown] = useState<number | null>(null);
  const [autoSkipPending, setAutoSkipPending] = useState(false);
  const [studioButtonStage, setStudioButtonStage] = useState<'hidden' | 'generating' | 'pre-broke' | 'post-countdown' | 'post-continue'>('hidden');
  const [studioActionTimer, setStudioActionTimer] = useState<number | null>(null);
  const [studioActionCost, setStudioActionCost] = useState<number>(0);
  const [availablePixels, setAvailablePixels] = useState<number>(0);
  const [queuedCastingPrompts, setQueuedCastingPrompts] = useState<any[]>([]);
  // --- Reference Image Generation ---
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>([]);
  const referenceImagesRef = useRef<ReferenceImageItem[]>([]);

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  const updateReferenceImages = useCallback((updater: (prev: ReferenceImageItem[]) => ReferenceImageItem[]) => {
    const next = updater(referenceImagesRef.current);
    referenceImagesRef.current = next;
    setReferenceImages(next);
  }, []);
  const [referenceLoading, setReferenceLoading] = useState<boolean>(false);
  const [referencePendingCount, setReferencePendingCount] = useState<number>(0);
  const [isAgentCasting, setIsAgentCasting] = useState<boolean>(false);
  const [hideAllLabels, setHideAllLabels] = useState<boolean>(false);
  const [fadeAllLabels, setFadeAllLabels] = useState<boolean>(false);
  const [showScenesPopup, setShowScenesPopup] = useState<boolean>(false);
  const studioScrollRef = React.useRef<HTMLDivElement>(null);
  const scenesAnchorRef = React.useRef<HTMLDivElement>(null);
  const scenesTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingRefIdx, setEditingRefIdx] = useState<number | null>(null);
  const [isGoldenPromptExpanded, setIsGoldenPromptExpanded] = useState<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const lastSwipeTimeRef = useRef<number>(0);
  const [aiUpdateVal, setAiUpdateVal] = useState<string>("");
  const [imagePromptVal, setImagePromptVal] = useState<string>("");
  const [isRegeneratingRef, setIsRegeneratingRef] = useState<boolean>(false);
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [characterToRename, setCharacterToRename] = useState<{ idx: number, oldName: string, newName: string, type: string } | null>(null);
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [zoomMode, setZoomMode] = useState<boolean>(false);
  const [minimizeMode, setMinimizeMode] = useState<number>(1); // 1: Inline (Default), 0: Full, 2: Compact
  const [isSaveButtonVisible, setIsSaveButtonVisible] = useState<boolean>(false);

  const [Vipcharacters, setVipcharacters] = useState<any[]>([]);
  const [showVipPopup, setShowVipPopup] = useState<boolean>(false);
  const [vipImageTemp, setVipImageTemp] = useState<string>('');
  const [vipName, setVipName] = useState<string>('');
  const [vipDescription, setVipDescription] = useState<string>('');
  const [vipBlobTemp, setVipBlobTemp] = useState<Blob | null>(null);
  const [isVipUploading, setIsVipUploading] = useState<boolean>(false);

  // Hoisted states for B Shot Mode Stage 1 (TTS Audio & Caching)
  const [isAudioDirty, setIsAudioDirty] = useState<boolean>(true);
  const [audioSceneStatuses, setAudioSceneStatuses] = useState<any[]>([]);
  const [isAudioGenerating, setIsAudioGenerating] = useState<boolean>(false);
  const [isBShotModeActive, setIsBShotModeActive] = useState<boolean>(false);
  const [generatedAudios, setGeneratedAudios] = useState<string[]>([]);
  const [generatedAudioTexts, setGeneratedAudioTexts] = useState<string[]>([]);

  // Stage 2: Supreme Arrays for B Shots (interleaved per scene)
  const [bShotImages, setBShotImages] = useState<string[][]>([]);
  const [bShotVideos, setBShotVideos] = useState<string[][]>([]);
  const [bShotPrompts, setBShotPrompts] = useState<string[][]>([]);
  const [bShotTextVideo, setBShotTextVideo] = useState<string[][]>([]);
  const [bShotNanoImages, setBShotNanoImages] = useState<string[][]>([]);

  useEffect(() => {
    // When the storybook opens (first generation of keypoints), auto-expand to Fullscreen
    if (parsedKeyPoints.length > 0) {
      setMinimizeMode(0);
    }
  }, [parsedKeyPoints.length > 0]);

  // --- Locks to prevent double-generation ---
  const isGeneratingRefsRef = useRef<boolean>(false);
  const hasStartedCastingRef = useRef<boolean>(false);
  const latestCastingIdRef = useRef<number>(0);

  const removePixel = async (amount: number): Promise<any> => {
    if (!Number.isFinite(amount) || amount <= 0) return;
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
      setAvailablePixels(data.pixels); // Update local Studio display Edit generation
    } catch (err) {
      console.error("Error spending pixels in Studio:", err);
    }
  };
  // Helper to refinement prompt with AI (Sync with EditStory logic)
  const handleEditReferenceAI = async (): Promise<string | null> => {
    if (editingRefIdx === null) return null;
    setIsAILoading(true);
    try {
      const refItem = referenceImages[editingRefIdx];
      const payload = {
        promptx: imagePromptVal || refItem.prompt,
        instructions: aiUpdateVal,
        logic: `Character/Environment reference for: ${refItem.name}`,
        imageUrl: refItem.image || refItem.imageUrl || refItem.url
      };

      const response = await axios.post<any>(`${CLIK_URL}/GptRemake`, payload);
      let updatedPrompt: any = response.data?.payload || response.data;
      if (typeof updatedPrompt === "object" && updatedPrompt !== null) {
        updatedPrompt = JSON.stringify(updatedPrompt, null, 2);
      }
      setImagePromptVal(updatedPrompt);
      setAiUpdateVal(""); // Clear update box
      return updatedPrompt;
    } catch (err) {
      console.error("AI Update Failed:", err);
      alert("Failed to refine prompt with AI.");
      return null;
    } finally {
      setIsAILoading(false);
    }
  };

  // Helper to regenerate the reference image
  const handleRegenerateReference = async () => {
    if (editingRefIdx === null) return;
    const targetIdx = editingRefIdx;

    let promptToUse = imagePromptVal;

    // First: If AI update field is populated, process it and fetch the refined prompt
    if (aiUpdateVal.trim() !== "") {
      const refinedPrompt = await handleEditReferenceAI();
      if (!refinedPrompt) return; // Stop if AI refinement fails
      promptToUse = refinedPrompt;
    }

    // Set generating status for this specific character locally without locking the whole UI
    updateReferenceImages(prev => {
      const updated = [...prev];
      if (updated[targetIdx]) {
        updated[targetIdx] = { ...updated[targetIdx], isGenerating: true };
      }
      return updated;
    });

    // Execute asynchronously so the user can continue generating others
    (async () => {
      try {
        let url = 'fluxschnell';
        if (modelz === 'Imagen') url = 'Imagen';
        else if (modelz === 'Imagen2') url = 'Imagen2';
        else if (modelz === 'minimax') url = 'minimax';
        else if (modelz === 'minimax2') url = 'minimax2';
        else if (modelz === 'fluxUltra') url = 'fluxUltra';
        else if (modelz === 'fluxUltra2') url = 'fluxUltra2';
        else if (modelz === 'fluxDev') url = 'fluxDev';
        else if (modelz === 'Hi Dream') url = 'HiDream';
        else if (modelz === 'Gpt Image') url = 'GptImage';
        else if (modelz === 'seeDream') url = 'seeDream';

        const seed = Math.floor(Math.random() * 1_000_000_000);
        let calcWidth = 1080;
        let calcHeight = 1920;
        if (ratioKey === 3) { calcWidth = 1920; calcHeight = 1080; }
        else if (ratioKey === 2) { calcWidth = 1080; calcHeight = 1080; }
        else if (ratioKey === 1) { calcWidth = 1080; calcHeight = 1920; }


        const payload = {
          inputs: promptToUse,
          width: calcWidth,
          height: calcHeight,
          guidance: 7.5,
          num_inference_steps: 35,
          seed: seed,
          ty: ratioKey
        };

        const executeGeneration = async (attempt: number) => {
          try {
            if (attempt === 1) {
              const perImageCost = calcModelPixels({ model: modelz, baseImagesPerDollar: 333 });
              await removePixel(perImageCost);
            }
            const imgRes: any = await axios.post(`${CLIK_URL}/${url}`, payload, { withCredentials: true });
            const { imageBase64 } = imgRes.data;

            if (imageBase64) {
              let finalUrl = imageBase64;
              try {
                const fetchRes = await fetch(imageBase64);
                const blob = await fetchRes.blob();
                const publicUrl = await putToS3(blob);
                if (publicUrl) {
                  finalUrl = publicUrl;
                  Saveprompthelperfordellater(publicUrl);
                }
              } catch (s3Err) {
                console.error("Failed to upload regenerated character to S3:", s3Err);
              }

              const enableUpscale = false; // Toggled off for now due to backend stitching video size limits

              // First, show the original low-res image but trigger the "UPSCALING..." overlay if enabled
              updateReferenceImages(prev => {
                const updated = [...prev];
                if (updated[targetIdx]) {
                  updated[targetIdx] = {
                    ...updated[targetIdx],
                    imageUrl: finalUrl,
                    prompt: promptToUse,
                    originalPrompt: updated[targetIdx].originalPrompt || updated[targetIdx].prompt || promptToUse,
                    isGenerating: false,
                    isUpscaling: enableUpscale
                  } as any;
                }
                return updated;
              });

              // Perform auto-upscale
              if (enableUpscale) {
                try {
                  await removePixel(2); // Upscale cost
                  const upscaleRes: any = await axios.post(`${CLIK_URL}/upscaleImage`, { url: imageBase64 });
                  if (upscaleRes.data && upscaleRes.data.url) {
                    updateReferenceImages(prev => {
                      const updated = [...prev];
                      if (updated[targetIdx]) {
                        updated[targetIdx] = { ...updated[targetIdx], imageUrl: upscaleRes.data.url, isUpscaling: false } as any;
                      }
                      return updated;
                    });
                  } else {
                    throw new Error("No URL returned from upscale API");
                  }
                } catch (upscaleErr) {
                  console.error("Auto-upscale failed for manual retry", upscaleErr);
                  // Remove the loading overlay on failure but keep the base image
                  updateReferenceImages(prev => {
                    const updated = [...prev];
                    if (updated[targetIdx]) {
                      updated[targetIdx] = { ...updated[targetIdx], isUpscaling: false } as any;
                    }
                    return updated;
                  });
                }
              }
              const p = await getPixel();
              setAvailablePixels(p);
              return true; // success
            }
            return false;
          } catch (imgErr) {
            console.error(`Failed to generate reference image for manual retry (attempt ${attempt}):`, imgErr);
            return false;
          }
        };

        let success = await executeGeneration(1);
        if (!success) {
          await new Promise(r => setTimeout(r, 3000));
          success = await executeGeneration(2);
          if (!success) {
            await new Promise(r => setTimeout(r, 6000));
            success = await executeGeneration(3);
          }
        }

        if (!success) {
          updateReferenceImages(prev => {
            const updated = [...prev];
            if (updated[targetIdx]) {
              updated[targetIdx] = { ...updated[targetIdx], isGenerating: false };
            }
            return updated;
          });
          alert("Failed to regenerate image.");
        }
      } catch (err) {
        console.error("Regeneration Failed:", err);
        updateReferenceImages(prev => {
          const updated = [...prev];
          if (updated[targetIdx]) {
            updated[targetIdx] = { ...updated[targetIdx], isGenerating: false };
          }
          return updated;
        });
        alert("Failed to regenerate image.");
      }
    })();
  };

  const sceneElementsRef = React.useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll to selected scene when modal opens
  React.useEffect(() => {
    if (selectedSceneIndex === null) return;

    let attempts = 0;
    const scrollInterval = setInterval(() => {
      const target = sceneElementsRef.current[selectedSceneIndex];
      if (target) {
        target.scrollIntoView({
          behavior: 'auto',
          inline: 'center',
          block: 'nearest'
        });
        clearInterval(scrollInterval);
      } else {
        attempts++;
        if (attempts > 20) clearInterval(scrollInterval); // Guard against infinite loop
      }
    }, 50);

    return () => clearInterval(scrollInterval);
  }, [selectedSceneIndex]);

  // Scroll detection: auto-trigger scenes popup when scrolling ~20% into scenes section
  React.useEffect(() => {
    const el = studioScrollRef.current;
    const anchor = scenesAnchorRef.current;
    if (!el || !anchor || !showStudioModal) return;

    const handleScroll = () => {
      if (showScenesPopup) return;

      // Check if user has scrolled to the very bottom
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;

      if (isAtBottom) {
        // Prevent further scroll
        if (!scenesTimerRef.current) {
          scenesTimerRef.current = setTimeout(() => {
            setShowScenesPopup(true);
            scenesTimerRef.current = null;
          }, 500);
        }
      } else {
        // User scrolled back up, cancel
        if (scenesTimerRef.current) {
          clearTimeout(scenesTimerRef.current);
          scenesTimerRef.current = null;
        }
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scenesTimerRef.current) {
        clearTimeout(scenesTimerRef.current);
        scenesTimerRef.current = null;
      }
    };
  }, [showStudioModal, showScenesPopup]);

  // --- Studio Auto-Proceed Timer Logic ---
  useEffect(() => {
    // Stage 1: Timer Completion
    if (studioActionTimer === 0) {
      setStudioActionTimer(null);
      if (studioButtonStage === 'post-countdown') {
        // Time expired without cancellation! Proceed to Storybook map
        setStudioButtonStage('hidden');
        setShowStudioModal(false);     // Mounts the Storybook
        setShowScenesPopup(false);
      }
      return;
    }

    // Stage 2: Tick Down
    if (studioActionTimer !== null && studioActionTimer > 0) {
      const timer = setInterval(() => {
        setStudioActionTimer((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [studioActionTimer, studioButtonStage, queuedCastingPrompts]);
  const blinkOutline = keyframes`
    0% { outline: 2px solid transparent; outline-offset: 3px; }
    50% { outline: 2px solid rgba(255, 255, 255, 0.5); outline-offset: 3px; }
    100% { outline: 2px solid transparent; outline-offset: 3px; }
  `;

  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    setIsBlinking(false);
  }, []);




  const handleCycle = () => dispatch(cycleAspectRatio2());

  const handleCyclex = () => dispatch(cycleAspectRatio3());


  const handleChange = useCallback(
    (_: React.SyntheticEvent, newValue: string) => {




      if (StopText) { } else { }



      if (newValue.length <= maxCharacters) {
        if (minipromptRefx.current) {
          clearTimeout(minipromptRefx.current);
        }

        setPrompt(newValue);
        setError("");
      } else {
        setError(`Maximum character limit of ${maxCharacters} exceeded.`);


      }
    },
    [maxCharacters, StopText]
  );



  // State variables for signed URLs
  const [signedUrlThumb, setSignedUrlThumb] = useState<string | null>(null);
  const [signedUrlHD, setSignedUrlHD] = useState<string | null>(null);

  const [GeneratedImageFlux, setGeneratedImageFlux] = useState('');



  const [generatedImagesFluxx, setGeneratedImagesFluxx] = useState<string[]>(
    Array(parsedKeyPoints.length).fill("")
  );
  const [loadersArray, setLoadersArray] = useState<number[]>([]);



  const [GeneratedImageFluxBlob, setGeneratedImageFluxBlob] = useState<any>(null);
  const [enhancedPromptx, setenhancedPromptx] = useState('');

  /* âœ±  State declarations with explicit types  âœ± */

  const [generatedImagesFluxBlobHd, setGeneratedImagesFluxBlobHd] = useState<Blob[]>([]);





  const [im, setim] = useState(false);

  const [textchange, settextchange] = useState(false);

  const [GotIm, setGotIm] = useState(false);

  const [AudioResult, setAudioResult] = useState('');
  const [CreationMode, setCreationMode] = useState('');

  const [selectedStyle, setSelectedStyle] = useState<string>("Auto");




  const [urlName4prompt, setUrlName4prompt] = useState(location.pathname); // initial value

  useEffect(() => {
    setUrlName4prompt(location.pathname);
    if (location.pathname === '/images' || location.pathname === '/clikit' || location.pathname === '/kickit' || location.pathname.toLowerCase() === '/magicmirror') {

    } else {
      setminimisePrompt(true);
    }

  }, [location.pathname]); // runs whenever either changes






  const isActive = !minimisePrompt;
  const activeRef = useRef(isActive);

  // [REMOVED window.history.pushState LOGIC to prevent swipe-back data loss]



  // Add this import if needed, or ensure startDelete is in scope
  // import { startDelete } from './your-api-functions';
  // 1. Define the Video Deleter (as requested)
  const startDeleteVid = async (vidUrl: string) => {
    try {
      await axios.post(
        `${CLIK_URL}/del-video`,
        { url: vidUrl },
        { withCredentials: true }
      );
      // console.log("Video deleted from S3:", vidUrl);
    } catch (err) {
      console.error("Delete video failed:", err);
    }
  };

  const startDeleteAudio = async (audioUrl: string) => {
    try {
      await axios.post(
        `${CLIK_URL}/del-audio`,
        { url: audioUrl },
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Delete audio failed:", err);
    }
  };

  useEffect(() => {


    // 2. Define a Generic Cleanup Function  startstory
    // This handles the logic for ANY storage key and ANY delete function
    const runCleanup = async (
      storageKey: string,
      deleteFn: (url: string) => Promise<any>
    ) => {
      const storedData = localStorage.getItem(storageKey);
      if (!storedData) return;

      try {
        const items = JSON.parse(storedData);
        if (!Array.isArray(items)) return;

        const now = Date.now();
        const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

        const validItems: any[] = [];
        const expiredItems: any[] = [];

        // A. Filter items
        items.forEach((item: any) => {
          const age = now - (item.timestamp || 0);
          if (age > SIX_HOURS_MS) {
            expiredItems.push(item);
          } else {
            validItems.push(item);
          }
        });

        // B. If nothing to delete, exit
        if (expiredItems.length === 0) return;

        console.log(`ðŸ§¹ Cleaning up ${expiredItems.length} expired items from ${storageKey}...`);

        // C. Update Local Storage IMMEDIATELY (Safety first)
        localStorage.setItem(storageKey, JSON.stringify(validItems));

        // D. Trigger the specific delete function for each item
        await Promise.allSettled(
          expiredItems.map((item) => deleteFn(item.url))
        );

        console.log(`âœ… Cleanup complete for ${storageKey}.`);
      } catch (err) {
        console.error(`Error parsing ${storageKey} for cleanup:`, err);
      }
    };

    // --- EXECUTE CLEANUP startDeleteAudio ---

    // 1. Clean Images (Using your existing startDelete)
    // Note: Assuming startDelete is available in your component scope
    runCleanup("helperimagesprompt", startDelete);

    // 2. Clean Videos (Using the new startDeleteVid)
    runCleanup("helpervideosprompt", startDeleteVid);

    // 3. Clean audio snippets generated for music-video lip sync
    runCleanup("helperaudiosprompt", startDeleteAudio);

  }, []); // Runs once on mount

  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isNotepadOpenRefAI, setIsNotepadOpenRefAI] = useState(false);
  const [isNotepadOpenRefPrompt, setIsNotepadOpenRefPrompt] = useState(false);

  // keep your existing suggestions, error, maxCharacters, etc.
  // handleChange now only needed if you still use Autocomplete suggestions.
  // But the actual text comes from `prompt` which Notepad edits.


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


    console.log(signedUrlHD);
    console.log(signedUrlThumb);
  }, [signedUrlThumb, signedUrlHD]);

  useEffect(() => {


    if (parsedKeyPoints.length > 0) {

      setHideBottom(true);
    } else {

      setHideBottom(false)
    }
  }, [parsedKeyPoints]);


  var timerb: any = null;
  var timerbc: any = null;


  // Customize padding for both buttons here.
  const buttonPadding = { px: 3, py: 1.5 };


  const minipromptRefx = useRef<ReturnType<typeof setTimeout> | null>(null);


  const minipromptRefx2 = useRef<ReturnType<typeof setTimeout> | null>(null);


  const [PostId, setPostId] = useState(0);

  const [showWorldModel, setShowWorldModel] = useState(false);

  const [allowgetImage, setallowgetImage] = useState(false)

  const glassSweep = keyframes`
  from { transform: translateX(-150%) rotate(20deg); }
  to   { transform: translateX(150%)  rotate(20deg); }
`;
  /* ------------------------------------------------------------------
   * 1)  Re-usable glass style
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
  * Unified â€œglassâ€ style â€“ v2
  * ------------------------------------------------------------------ */
  const glassButtonSx = {
    /* ---------- core look & feel ---------- */
    flex: matchMobile ? 0.2 : 0.2,
    mt: "3px",
    borderRadius: 2,
    background: darkMode
      ? "rgba(25,25,25,0.25)"
      : "rgba(255,255,255,0.25)",
    color: darkMode ? "#ffffff" : "#000",


    /* thinner, neutral border compared to v1 */
    border: "1px solid rgba(255,255,255,0.45)",


    /* softer shadow depth */
    boxShadow: darkMode
      ? "0 8px 32px rgba(0,0,0,.55)"
      : "0 8px 32px rgba(0,0,0,.15)",

    transform: "translateY(-2px)",

    transition:
      "background .25s ease, box-shadow .25s ease, transform .12s ease",

    /* ---------- reflection overlay ---------- */
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
      opacity: 0,            // hidden until hover / active
      pointerEvents: "none",
    },

    /* ---------- hover ---------- */
    "&:hover": {
      background: darkMode
        ? "rgba(25,25,25,0.35)"
        : "rgba(255,255,255,0.35)",
      transform: "translateY(0)",
      "&::before": {
        opacity: 0.8,
        animation: `${glassSweep} 1.8s ease-out forwards`,
      },
    },

    /* ---------- active / pressed ---------- */
    "&:active": {
      background: darkMode
        ? "rgba(25,25,25,0.45)"
        : "rgba(255,255,255,0.45)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
      transform: "translateY(0)",
      "&::before": {
        opacity: 0.9,
        animation: `${glassSweep} 1.1s ease-out forwards`,
      },
    },

    /* ---------- focus highlight ---------- */
    "&:focus, &:focus-visible, &.Mui-focusVisible": {
      outline: "none",
      boxShadow: "none",
      backgroundColor: darkMode
        ? "rgba(255,255,255,0.10)"
        : "rgba(255,255,255,0.10)",
    },

    WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
    "::-moz-focus-inner": { border: 0 },
  };

  // helpers (place inside your component or import from a utils file)
  const LABEL_BY_INDEX = [] as const;

  const LABEL_BY_INDEXcc = ["Pro", "Knowledge", "Artistic", "Graphical", "Standard", "Base", "Pro"] as const;
  // Optional: centralize neon picks
  const NEON = {
    yellow: '#FFFF33',   // electric yellow
    red: '#18FFFF',   // scarlet/neon red
    cyan: 'orange',   // bright cyan
    pink: '#FF00FF',   // magenta/neon pink
    green: '#39FF14',   // electric green
  };

  const COLOR_BY_LABEL: Record<(typeof LABEL_BY_INDEX)[number], string> = {
    Pro: darkModeReducer ? "yellow" : NEON.yellow,
    Knowledge: darkModeReducer ? "red" : NEON.red,
    Graphical: darkModeReducer ? "orange" : NEON.cyan,
    Artistic: darkModeReducer ? "pink" : NEON.pink,
    Standard: darkModeReducer ? "#3b82f6" : NEON.green,
    Base: darkModeReducer ? "#3b82f6" : NEON.green,
  };


  const getTextShadow = (label: string, dark: boolean): string => {
    // Simulated stroke (works on any bg) + mode-specific glow.
    const heavyForYellow = label === "High" ? "0 0 3px rgba(0,0,0,0.9), " : "";
    const stroke =
      "0 0 1px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.75), " +
      "1px 0 0 rgba(0,0,0,0.7), -1px 0 0 rgba(0,0,0,0.7), " +
      "0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(0,0,0,0.7), " +
      "1px 1px 0 rgba(0,0,0,0.6), -1px -1px 0 rgba(0,0,0,0.6)";
    const glow = dark
      ? ", 0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.5)"
      : ", 0 2px 4px rgba(0,0,0,0.45), 0 6px 12px rgba(0,0,0,0.35)";
    return heavyForYellow + stroke + glow;
  };

  // --- your JSX snippet, updated window ---


  const handleToggleGeneratedImage = (url: string) => {
    setGeneratedImage((prev: string[]) => {
      if (prev.includes(url)) {
        // URL exists? Remove it (Filter out)
        return prev.filter((img) => img !== url);
      } else {
        // URL doesn't exist? Add it
        return [...prev, url];
      }
    });
  };


  useEffect(() => {
    ///clikt

    if (minimisePrompt) {
      setstopFeeds(false);
    } else { }

  }, [minimisePrompt]); // still valid


  useEffect(() => {
    ///clikt Stories


    if (parsedKeyPoints.length > 0) {

      if (minipromptRefx2.current) {
        clearTimeout(minipromptRefx2.current);
      }
    } else {
      if (prompt === '' && !minimisePrompt) {
        minipromptRefx2.current = setTimeout(() => {
          ///   setminimisePrompt(true);
        }, 30);
      }



      // Cleanup
      return () => {
        if (minipromptRefx2.current) {
          clearTimeout(minipromptRefx2.current);
        }
      };

    }
  }, [prompt, minimisePrompt, type, parsedKeyPoints]); // still valid



  const GRADIENTx = "linear-gradient(135deg, yellow 0%, #736EFE 100%)";


  /////////////////////////////////////////MODELSSSSSSSSSSSSSS///////////////////////////////

  const [modelz, setModelz] = useState("Models");
  const [homeModel, setHomeModel] = useState<string>("Models");
  const homeModelLocked = useRef(false);

  useEffect(() => {
    if (!homeModelLocked.current && (GeneratedImage.length > 0 || parsedKeyPoints.length > 0)) {
      setHomeModel(modelz === "Models" ? "Schnell" : modelz);
      homeModelLocked.current = true;
    }
  }, [modelz, GeneratedImage.length, parsedKeyPoints.length]);


  /////////////////////////////////////////MODELSSSSSSSSSSSSSS///////////////////////////////

  // helper: add the correct circle based on whether the *model key* is pro, hd, or standard
  const circleForLabel = (key: string) => {
    let circle = "ðŸ”´"; // default Pro

    const k = key.toLowerCase();

    if (k === "imagen") {
      circle = "ðŸŸ¡"; // HD / Nano 2
    } else if (k === "imagen2" || k === "minimax2" || k === "schnell") {
      circle = "ðŸ”µ"; // Lite / Standard
    } else {
      circle = "ðŸ”´"; // Pro (fluxUltra, fluxUltra2, minimax, etc)
    }

    return (
      <span
        style={{
          marginLeft: 6,
          fontSize: matchMobile ? 12 : 13,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {circle}
      </span>
    );
  };

  // helper: keeps your exact â€œmobile hides robotâ€ layout
  const renderPretty = (key: string, text: string) => (
    <>
      <span style={{ display: matchMobile ? "none" : "inline-flex", alignItems: "center" }}>
        {text}
        {circleForLabel(key)}
      </span>

      <span style={{ display: matchMobile ? "inline-flex" : "none", alignItems: "center" }}>
        {text}
        {circleForLabel(key)}
      </span>
    </>
  );





  const GRADIENT = darkMode
    ? "linear-gradient(90deg, #ffffff 20%, #eeeeee 100%)"
    : "";



  const [anchorEl, setAnchorEl] = useState(null);



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



  ///  startDelete(GeneratedImage);


  const [ImagesHdCloud, setImagesHdCloud] = useState<string[]>([]);


  const [worldStyle, setWorldStyle] = useState<string>(''); // <--- New State

  const GenerateSignedUrl = useCallback(
    async (
      GeneratedImageFluxBlob: Blob,
      enhancedTextData: any,
      loggedUserx: any
    ) => {
      if (!GeneratedImageFluxBlob) {
        setError("Image blobs are not available for uploading.");
        return;
      }

      try {
        // â†³ ask backend for TWO signed URLs (HD + PNG)
        const response: any = await axios.post(
          `${CLIK_URL}/get_signed_url_image`,
          { values: { count: 2 } },
          { withCredentials: true }
        );

        const signedUrls = response.data.holder?.[0];
        if (!signedUrls?.urlHD || !signedUrls?.urlBase) {
          throw new Error("Missing signed URLs for images.");
        }

        console.log("Signed URLs generated:", signedUrls);

        await PutImagesInS3WithURL(
          GeneratedImageFluxBlob,
          signedUrls,
          enhancedTextData,
          loggedUserx
        );
      } catch (err: any) {
        console.error("Error generating signed URLs:", err);
        setError(
          err.message || "An error occurred while generating signed URLs."
        );
      }
    },
    [CLIK_URL, prompt, promptx, GeneratedImage, modelz, ratioKey]
  );

  /* ---------------------------------------------------------------------- */
  /*  helper â€“ convert original blob -> PNG blob                             */
  /* ---------------------------------------------------------------------- */
  const textCol = darkModeReducer ? "#ffffff" : "#000000";

  /* ---------------------------------------------------------------------- */
  /*  helper â€“ convert original blob -> PNG blob                             */
  /* ---------------------------------------------------------------------- */
  const blobToPng = async (blob: Blob): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (pngBlob) =>
            pngBlob
              ? resolve(pngBlob)
              : reject(new Error("PNG conversion failed")),
          "image/png",
          1
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });

  /* ---------------------------------------------------------------------- */
  /*  PutImagesInS3WithURL â€“ now uploads HD *and* PNG                        */
  /* ---------------------------------------------------------------------- */

  const PutImagesInS3WithURL = useCallback(
    async (
      GeneratedImageFluxBlob: Blob,
      signedUrls: { urlHD: string; urlBase: string },
      enhancedTextData: any,
      loggedUserx: any
    ) => {
      try {
        setError("");

        /* ---------- upload HD ------------------------------------------- */
        console.log(`Uploading HD image â†’ ${signedUrls.urlHD}`);
        await axios.put(signedUrls.urlHD, GeneratedImageFluxBlob, {
          headers: {
            "Content-Type": GeneratedImageFluxBlob.type || "application/octet-stream",
          },
        });
        const uploadedHdUrl = signedUrls.urlHD.split("?")[0];
        console.log("âœ…  HD uploaded:", uploadedHdUrl);

        /* ---------- convert to PNG & upload ----------------------------- */
        console.log("ðŸ–¼ï¸  Converting blob â†’ PNG â€¦");
        const pngBlob = await blobToPng(GeneratedImageFluxBlob);              // NEW
        console.log(`Uploading PNG image â†’ ${signedUrls.urlBase}`);           // NEW
        await axios.put(signedUrls.urlBase, pngBlob, {                       // NEW
          headers: { "Content-Type": "image/png" },                          // NEW
        });                                                                   // NEW
        const uploadedPngUrl = signedUrls.urlBase.split("?")[0];              // NEW
        console.log("âœ…  PNG uploaded:", uploadedPngUrl);                     // NEW

        /* ---------- persist + set state --------------------------------- */
        // adjust func


        console.log("HD image uploaded successfully.");



        // Update state with uploaded URLs
        saveToDastabase(uploadedHdUrl, enhancedTextData, loggedUserx);

        // Push both URLs to React state so UI updates
        setImagesHdCloud(prev => [...prev, uploadedPngUrl]);                    // NEW
      } catch (err: any) {
        console.error("Error during image upload:", err);
        setError(err.message || "An error occurred during the image upload.");
      }
    },
    [promptx, GeneratedImage, prompt, modelz, ratioKey] //  (no external deps needed after refactor)
  );


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
  async function convertToHDWebpOrJpegByDevice(inputBlob: Blob, modelx: any): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      // Step 1: Read the Blob into a Data URL
      const reader = new FileReader();
      reader.readAsDataURL(inputBlob);

      reader.onload = () => {
        const imageUrl = reader.result as string;
        const img = new Image();

        // Step 2: When the image loads, draw it onto a 1080Ã—1920 canvas
        img.onload = () => {

          const canvas = document.createElement("canvas");

          if (modelx === "Gpt Image") {
            // old GPT image (tall format)
            canvas.width = 1024;
            canvas.height = 1536;
          } else if (modelx === "Imagen") {
            // Google Imagen (square format)
            canvas.width = 1024;
            canvas.height = 1024;
          } else {
            // default (tall format)
            canvas.width = 1080;
            canvas.height = 1920;
          }


          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Unable to get 2D context from canvas."));
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Decide the format based on iPhone detection
          const format = isIphone() ? "image/jpeg" : "image/webp";
          /// alert(` Using format ${format}`);

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
  async function exampleUsage() {
    // Suppose you have a file input or some Blob
    const inputBlob = new Blob(); // Placeholder

    try {
      const convertedBlob = await convertToHDWebpOrJpegByDevice(inputBlob, '');
      console.log("Successfully converted image. Blob:", convertedBlob);
      // Do something with the converted Blob (e.g., upload, display, etc.)
    } catch (e) {
      console.error("Failed to convert image:", e);
    }
  }

  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    if (planInfo === 1 || planInfo === 2) {
      const id = setInterval(() => setBlinkOn((b) => !b), 600);

      return () => clearInterval(id);
    }

  }, [planInfo]);



  // Example callback that submits a Flux generation request using the BFL API.

  const [Caret, setCaret] = useState(0);

  const handlePromptShellCaret = (e: any) => {
    const el: any = e.target;

    if (!el || typeof el.selectionStart !== "number") {
      // fallback if something weird gets focused
      return 0;
    }

    const caretIndex = el.selectionStart ?? 0;

    // ðŸ‘‰ use this however you want:
    console.log("caretIndex:", caretIndex);

    setCaret(caretIndex);

    ///alert( caretIndex);

    // setShellCaretIndex(caretIndex); // if you have state for it

    return caretIndex;
  };




  const [remixData, setRemixData] = useState<string>('');
  const [worldCover, setWorldCover] = useState<string>(''); // <--- 1. Added worldCover state

  // Add a new piece of state to track poll status flux pro
  const [pollStatus, setPollStatus] = useState<string>("");


  // Example updated handleSubmitFluxImage
  const handleSubmitSdxlImageRepli = useCallback(
    async (
      imageUrlFromSdxl: string,   // optional image URL from another model
      enhancedPrompt: string,     // user prompt
      loggedUserx: any            // user object
    ) => {


      setIsSubmitting(true);
      setPollStatus("Polling Replicate...");

      setBig(false);

      try {
        let base64Image = "";

        // If we have an image URL from SDXL (or anywhere)
        if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
          const imageResponse = await fetch(imageUrlFromSdxl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const imageBlob = await imageResponse.blob();

          // Convert Blob -> base64
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        // Build the payload
        const payload: any = {
          inputs: enhancedPrompt,
          // any extra parameters you need
          width: 1080,
          height: 1920,
          guidance: 7.5,
          num_inference_steps: 35,
        };

        // Conditionally include the image if available
        var url = 'sdxlReplicatePro';

        if (base64Image) {
          payload.image = base64Image;
          url = 'sdxlReplicate';
        }

        // Make the POST request
        const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error(`FluxSchnell route error: ${response.status}`);
        }

        // Extract final base64 from server
        const { imageBase64 } = response.data;
        if (!imageBase64) {
          throw new Error("No imageBase64 returned from server");
        }

        // Convert the returned base64 back to a Blob
        const fluxImageBlob = await (async () => {
          const fetchRes = await fetch(imageBase64);
          return await fetchRes.blob();
        })();

        // Now do whatever you need (convert to HD, etc.)
        const finalBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlob, '');
        const finalUrl = URL.createObjectURL(finalBlob);




        setGeneratedImage(finalUrl);

        if (matchMobile) {
          setMinimizeMode(0);
        }

        handleSubmitFluxImage(finalUrl, enhancedPrompt, loggedUserx, 2200);

      } catch (err) {
        console.error("Error calling Flux Inference Endpoint:", err);
        setPollStatus("Failed!");
      }
    },
    [prompt, modelz]
  );

  const [parsedKeyPoints2, setParsedKeyPoints2] = useState<string[]>([]);

  const prevRef = useRef<string[]>([]);

  const normalize = (s: any) =>
    (typeof s === "string" ? s.trim().replace(/\s+/g, " ") : String(s ?? ""));



  const stagePromptCache: Record<number, string> = {};


  useEffect(() => {
    if (!Array.isArray(parsedKeyPoints) || parsedKeyPoints.length === 0) return;

    if (!prevRef.current) prevRef.current = [];

    // Detect if anything actually changed (normalized)
    const currentNorm = parsedKeyPoints.map((x) => normalize(x));
    const prevNorm = (prevRef.current as any[]).map((x) => normalize(x));

    const hasChange =
      currentNorm.length !== prevNorm.length ||
      currentNorm.some((val, idx) => val && val !== prevNorm[idx]);

    if (!hasChange) return;

    let cancelled = false;

    (async () => {
      const MAX_RETRIES = 3;

      for (let attempt = 0; attempt < MAX_RETRIES && !cancelled; attempt++) {
        try {
          const result = await StartNarrateSummary(parsedKeyPoints2, prompt);

          // StartNarrateSummary returns null on error in your implementation
          if (!cancelled && result) {
            // successful: snapshot current parsedKeyPoints so we don't call again
            prevRef.current = parsedKeyPoints.slice(0);
            break;
          }

          if (attempt === MAX_RETRIES - 1) {
            console.error("StartNarrateSummary failed after 3 attempts.");
          } else {
            console.warn(
              `StartNarrateSummary attempt ${attempt + 1} failed, retryingâ€¦`
            );
          }
        } catch (err) {
          console.error(
            `StartNarrateSummary unexpected error on attempt ${attempt + 1
            }:`,
            err
          );
          if (attempt === MAX_RETRIES - 1) {
            console.error("StartNarrateSummary aborted after 3 attempts.");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsedKeyPoints, prompt]);


  useEffect(() => {

    console.log('Sumarrrrrrrrrrrrrrrrry 4 TTS', parsedKeyPoints2)
  }, [parsedKeyPoints2])

  const StartNarrateSummary = async (
    steps: string[],          // ðŸ‘ˆ ALL scenes in an array
    prompt: string,           // keep if you still need it
    _i?: any,                 // no longer needed, but kept so calls don't break
    _last?: boolean,
    _first?: boolean
  ) => {
    // setIsLoading?.(true); // optional spinner

    try {
      // ðŸ‘‡ IMPORTANT: we send steps (array), not step
      const requestData = {
        keyPoints: steps,     // ðŸ‘ˆ backend reads this array
        prompt,              // you can drop this if backend doesn't use it
      };

      const tt = "narrateSummary";

      const response = await axios.post<{
        message: string;
        narrationSteps: {
          keyPoints: string[];   // <- narrations for each scene
        };
      }>(`${CLIK_URL}/${tt}`, requestData, { withCredentials: true });

      const { message, narrationSteps } = response.data || {};

      if (
        !narrationSteps ||
        !Array.isArray(narrationSteps.keyPoints) ||
        !narrationSteps.keyPoints.length
      ) {
        throw new Error("Invalid narrationSteps received from server.");
      }

      // Optional safety: warn if lengths don't match
      if (narrationSteps.keyPoints.length !== steps.length) {
        console.warn(
          "Narration length mismatch:",
          "input =", steps.length,
          "output =", narrationSteps.keyPoints.length
        );
      }

      console.log("Narration Summary:", narrationSteps.keyPoints);
      if (message) console.log("Server Message:", message);

      // ðŸ”¥ Update your narration array 1:1 with original scenes
      setParsedKeyPoints2(narrationSteps.keyPoints);

      return narrationSteps.keyPoints;
    } catch (error: any) {
      if (error.response) {
        console.error("Server Error:", error.response.data);
        setError?.(error.response.data.message || "Server Error");
      } else if (error.request) {
        console.error("No response received:", error.request);
        setError?.("Network Error: No response received from server.");
      } else {
        console.error("Error:", error.message);
        setError?.(error.message);
      }
      return null;
    } finally {
      // setIsLoading?.(false);
    }
  };


  // Example updated handleSubmitFluxImage
  const handleSubmitFluxImage = useCallback(
    async (
      imageUrlFromSdxl: string,   // optional image URL from another model
      enhancedPrompt: string,     // user prompt
      loggedUserx: any,
      seed: any         // user object
    ) => {
      setIsSubmitting(true);
      setPollStatus("Polling Replicate...");

      setBig(false);

      try {
        let base64Image = "";

        // If we have an image URL from SDXL (or anywhere)
        if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
          const imageResponse = await fetch(imageUrlFromSdxl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const imageBlob = await imageResponse.blob();

          // Convert Blob -> base64
          base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        }

        // Build the payload
        const payload: any = {
          inputs: enhancedPrompt,
          // any extra parameters you need
          width: 1080,
          height: 1920,
          guidance: 7.5,
          num_inference_steps: 35,
          seed: seed
        };

        // Conditionally include the image if available
        var url = "fluxschnell";


        if (modelz === 'Kontext') {
          ///  url = 'fluxPro';

          if (base64Image) {
            payload.image = base64Image;
            url = 'fluxKontext';
          }
        } else if (modelz === 'code not in use anymore goto storybook') {
          ///  url = 'fluxPro';

          if (base64Image) {
            payload.image = base64Image;
            url = 'Bannana';
          }
        } else if (modelz === 'Schnell') {
          url = 'fluxschnell';

        } else if (modelz === 'Hi Dream') {

          url = 'HiDream';
        }
        else if (modelz === 'minimax') {

          url = 'minimax';
        }
        else if (modelz === 'Imagen') {

          url = 'Imagen';
        }
        else if (modelz === 'Gpt Image') {

          url = 'GptImage';
        } else {

          url = 'fluxschnell';


        }



        // Make the POST request
        const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error(`FluxSchnell route error: ${response.status}`);
        }
        setLoader(100);


        setTimeout(async () => {


          // Extract final base64 from server
          const { imageBase64 } = response.data;
          if (!imageBase64) {
            throw new Error("No imageBase64 returned from server");
          }

          // Convert the returned base64 back to a Blob
          const fluxImageBlob = await (async () => {
            const fetchRes = await fetch(imageBase64);
            return await fetchRes.blob();
          })();

          // Now do whatever you need (convert to HD, etc.)
          const finalBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlob, modelz);
          const finalUrl = URL.createObjectURL(finalBlob);

          // Show it in your UI
          setGeneratedImageFlux(finalUrl);
          setGeneratedImageFluxBlob(finalBlob);
          setenhancedPromptx(enhancedPrompt);

          setIsSubmitting(false);

          // Optionally push it to your storage

          /// GenerateSignedUrl(finalBlob, enhancedPrompt, loggedUserx);
          setBig(true);
          setPollStatus("Succeeded");
          if (matchMobile) {
            setMinimizeMode(0);
          }

        }, 1000)



      } catch (err) {
        setLoader(100);
        console.error("Error calling Flux Inference Endpoint:", err);
        setPollStatus("Failed!");
      }
    },
    [prompt, modelz]
  );




  type ModelName = 'Schnell' | 'Hi Dream' | 'minimax' | 'Gpt Image' | 'Imagen' | 'fluxUltra' | 'seeDream' | 'fluxDev'
    | 'Bannana' | 'Kontext' | 'Imagenx' | 'minimax2' | 'Imagen2' | 'fluxUltra2';

  interface Model {
    name: ModelName;
    img: string;
  }

  const MODELSx: Model[] = [
    {
      name: "Gpt Image",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4fcf6d5e800c3383ffebd74ec7a942dd.png",
    },


    {
      name: "Imagen",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e24ad34dff260dc914809380e323be7e.png",
    },

    {
      name: "fluxUltra",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e1cdb36c8236f2e9a091c6028c81affe.png",
    },

    {
      name: "Imagenx",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e1cdb36c8236f2e9a091c6028c81affe.png",
    },


    {
      name: "fluxDev",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e1cdb36c8236f2e9a091c6028c81affe.png",
    },



    {
      name: "minimax",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-6435f7be3285745c833b714525e87269.png",
    },

    {
      name: "Hi Dream",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-325dfa0100fac12f81437b5a61fc2a32.png",
    },
    {
      name: "Schnell",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-325dfa0100fac12f81437b5a61fc2a32.png",
    },



  ];



  const MODELS: Model[] = [


    {
      name: "Imagen",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e24ad34dff260dc914809380e323be7e.png",
    },

    {
      name: "Gpt Image",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4fcf6d5e800c3383ffebd74ec7a942dd.png",
    },


    {
      name: "fluxUltra",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-e1cdb36c8236f2e9a091c6028c81affe.png",
    },

    {
      name: "minimax",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-6435f7be3285745c833b714525e87269.png",
    },







    {
      name: "Schnell",
      img: "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-325dfa0100fac12f81437b5a61fc2a32.png",
    },


  ];

  /** the three demo batches you supplied ---------------------------------- */
  const DEMO_SETS: Record<ModelName, string>[][] = [
    /* 1  Lion */
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-44436e043dd754b3b0d4bcc07251a7e5.png",
        'Imagen': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ae1a561b5f1282ca90b55a602ca2d5b3.png",
        'fluxUltra': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-74c8d191c778333f648f3a3637e2045b.png",
        'seeDream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-6e6912ac98fbc0bf1c207b6ce7737337.png",
        'Imagenx': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-03b7cd9dacb3f0c381881e6684da59ba.png",
        'fluxDev': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-5493676cbaf892546a32dc4a49d000e8.png",
        'minimax': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-24f8c8c2509dd6d2578cb0ee41658995.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-5ac948abd76e3593332fe1520ac8458f.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-faefd11606ccd381a1aeeb4500fa7e0d.png",
        'Kontext': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-15fa65168c34b693853848e7f4350af3.png",
        'Bannana': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-86331bb20188d5f4d1720d57cbe58968.png",

        'Imagen2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ae1a561b5f1282ca90b55a602ca2d5b3.png",
        'fluxUltra2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-74c8d191c778333f648f3a3637e2045b.png",
        'minimax2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-24f8c8c2509dd6d2578cb0ee41658995.png",
      },
    ],
    /* 2  knight water*/
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-14052339b97030047eab1335c6e7ae57.png",
        "Imagen":
          "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-d10a74599a321c33e312d164d01e92cb.png",
        'fluxUltra': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ffdb334559e1bce690011d4d55a3d88c.png",

        'seeDream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-06a43c7d987812fefbbe71a8025f80ce.png",
        'Imagenx': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-c34308f08ea92551b6440631c2762deb.png",
        'fluxDev': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-7193f7b6c94c145e1e426b9aaa13e004.png",

        'minimax': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4ae302517c4108e8267f9abfb7abe99b.png ",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-a9f87f1d9c09286771b6ea1ce24c3f79.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-c77a574eadf3582ddd6db0369b06aaf0.png",
        'Kontext': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-15fa65168c34b693853848e7f4350af3.png",
        'Bannana': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-86331bb20188d5f4d1720d57cbe58968.png",
        'Imagen2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ae1a561b5f1282ca90b55a602ca2d5b3.png",
        'fluxUltra2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-74c8d191c778333f648f3a3637e2045b.png",
        'minimax2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-24f8c8c2509dd6d2578cb0ee41658995.png",
      },
    ],
    /* 3  whale */
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-5604f8a4589eb0abbb382b7f6f3d6e82.png",
        "Imagen":
          "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-cedf7f6ccf56cdcd737d79ebc8aa7f8a.png",
        'fluxUltra': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-31b7838c593250deb728c54361e4be7b.png",



        'seeDream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-f2e1050d909cbab01cd3b7b184811ea8.png",
        'Imagenx': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-a5d95a9817bb5343eb0a0229a74a3ab3.png",
        'fluxDev': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-f529a2b517efc045404b585f237b5530.png",

        'minimax': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-3e05a810f8f9f8f2b954e35a8271cccc.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-bec7928b1304ba61f5613521e95edf5c.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-50e8ecb0099bd2afc880e77e64a99d4a.png",
        'Kontext': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-15fa65168c34b693853848e7f4350af3.png",
        'Bannana': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-86331bb20188d5f4d1720d57cbe58968.png",
        'Imagen2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ae1a561b5f1282ca90b55a602ca2d5b3.png",
        'fluxUltra2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-74c8d191c778333f648f3a3637e2045b.png",
        'minimax2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-24f8c8c2509dd6d2578cb0ee41658995.png",
      },


    ],
    /* 4  astronaut*/
    [
      {
        'Gpt Image': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-4fcf6d5e800c3383ffebd74ec7a942dd.png",
        "Imagen":
          "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-7ac1f1e7856daedd475b8d2e1fbdc901.png",
        'fluxUltra': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-8145c978bd9631bc66a980bf93a7f446.png",

        'seeDream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-9bb0eab503c68aee31adb13652f1a2f2.png",
        'Imagenx': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-15235c3036c1ccbfbc9b581eb6455fae.png",
        'fluxDev': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-12932c65655aa49d94347584888d7d34.png",
        'minimax': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-46701ca9b9a75cbd45088c8ad4946136.png",
        'Hi Dream': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-df8ba377a739c0bb56f2606df3672951.png",
        'Schnell': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-84e8aea68a3e5c421338005377641cdf.png",
        'Kontext': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-15fa65168c34b693853848e7f4350af3.png",
        'Bannana': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-86331bb20188d5f4d1720d57cbe58968.png",
        'Imagen2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-ae1a561b5f1282ca90b55a602ca2d5b3.png",
        'fluxUltra2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-74c8d191c778333f648f3a3637e2045b.png",
        'minimax2': "https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-24f8c8c2509dd6d2578cb0ee41658995.png",
      },
    ],
  ];

  /** helper to flatten a demo record into a Model[] ------------------------ */
  function recordToModels(
    base: Model[],
    record: Record<ModelName, string>
  ): Model[] {
    return base.map((m) => ({
      ...m,
      img: record[m.name] ?? m.img, // keep fallback if missing
    }));
  }

  const [open, setOpen] = useState(false);

  const [models, setModels] = useState<Model[]>(MODELS); // initial = fallback

  /* choose a random set whenever `open` toggles ------------------------- */
  useEffect(() => {
    if (!open) return;

    const randomRecord =
      DEMO_SETS[Math.floor(Math.random() * DEMO_SETS.length)][0];
    setModels(recordToModels(MODELS, randomRecord));

  }, [open]);


  useEffect(() => {
    if (modelz === 'FluxUltra' && GeneratedImage.length > 0) {

      setModelz('Kontext');
    }

  }, [models, GeneratedImage]);

  const prettyLabel = modelz.charAt(0).toUpperCase() + modelz.slice(1);

  const handleSelect = (name: string, image: any) => {

    dispatch(setModel(name));
    setModelz(name);
    setOpen(false);

  };


  useEffect(() => {

    dispatch(setPromptRed(prompt));
  }, [prompt]);



  useEffect(() => {

    setTimeout(() => {

      if (modelRedux) {
        //   alert(modelRedux);
        setModelz(modelRedux);
      }

      if (promptRedux) {
        //alert(promptRedux)
        setPrompt(promptRedux)
      }

      if (artstyleRedux && artstyleRedux !== selectedStyle) {

        setSelectedStyle(artstyleRedux);
      }

    }, 500)


  }, [artstyleRedux]);


  //GeneratedImage

  useEffect(() => {
    ///if (type === 3) { handleCycle() }

    if (modelz === 'Imagen') { //handleCyclex()
    }

  }, [location.pathname, type, ratioKey, modelz])


  const handleSubmitFlux = useCallback(
    async (enhancedPrompt: string, loggedUserx: any) => {
      try {
        // If you're controlling any UI state (loading, labels, etc.)
        // from your original code, you can keep those here:
        settextchange(false);
        setIsSubmitting(true);
        setLabel('Loading Hd: 10secs');
        setShowLabel(true);

        // Construct the payload WITHOUT extra image data
        const payload = {
          inputs: enhancedPrompt,


        };

        const fluxEndpoint =
          'https://slll6h6mzbbr88gv.us-east-1.aws.endpoints.huggingface.cloud';

        const response = await fetch(fluxEndpoint, {
          method: 'POST',
          headers: {
            Accept: 'image/png',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VITE_HUGG}`, // replace with your token variable
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Flux API Error: ${response.status} - ${errorData}`);
        }

        // Stop ping timer if you have one
        setAllowPing(false);

        // Convert the Flux response into a Blob (PNG)
        const fluxImageBlob = await response.blob();

        // (Optional) If you have a function to store the image in the backend:
        GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

        // Create a local object URL for preview
        const fluxImageUrl = URL.createObjectURL(fluxImageBlob);
        setGeneratedImageFlux(fluxImageUrl);

        // Reset or finalize UI state
        setIsSubmitting(false);
        setIsFluxOnTop(true);


      } catch (err) {

        /// handleCloseOverlay();

        console.error('Error calling Flux Inference Endpoint:', err);
        setIsSubmitting(false);
        // Optionally handle errors in your UI
      }
    },
    [/* dependencies if needed */]
  );


  // helpers/s3.ts
  const putToS3 = async (blob: Blob): Promise<string> => {
    /* A. get signed URL */
    const { data }: any = await axios.post(
      `${CLIK_URL}/get_signed_url_image`,
      { values: { count: 2 } },
      { withCredentials: true }
    );

    const signed = data.holder?.[0];
    if (!signed?.urlHD) throw new Error("Bad signed-URL response");

    /* B. PUT the file */
    const putRes = await axios.put(signed.urlHD, blob, {
      headers: { "Content-Type": blob.type || "application/octet-stream" }
    });
    if (![200, 204].includes(putRes.status)) {
      throw new Error(`Upload failed: ${putRes.status}`);
    }

    /* C. Return the public URL (no query-string) */
    return signed.urlHD.split("?")[0];
  };





  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {

    const file = event.target.files?.[0];
    if (!file) return;



    const imageUrl = URL.createObjectURL(file);

    // 1) Create an HTML Image object
    const img = new Image();
    img.onload = async () => {
      // 2) Once the image is loaded, create a canvas
      var desiredWidth = 1080;
      var desiredHeight = 1920;



      if (ratioKey === 1) {
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
        // fallback back to 9:16
        desiredWidth = 1080;
        desiredHeight = 1920;
      }



      const canvas = document.createElement("canvas");
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Original aspect ratio
      const originalWidth = img.width;
      const originalHeight = img.height;
      const originalAspect = originalWidth / originalHeight;

      // Desired aspect ratio
      const desiredAspect = desiredWidth / desiredHeight;

      let drawWidth, drawHeight;
      let offsetX = 0, offsetY = 0;

      // 3) Calculate the scaled width/height so that
      //    the original imageâ€™s aspect ratio is preserved.
      if (originalAspect > desiredAspect) {
        // Image is relatively "wide", so match the canvas height
        drawHeight = desiredHeight;
        drawWidth = drawHeight * originalAspect;
        // Center the image horizontally (negative offset if too wide)
        offsetX = (desiredWidth - drawWidth) * 0.5;
      } else {
        // Image is relatively "tall", so match the canvas width
        drawWidth = desiredWidth;
        drawHeight = drawWidth / originalAspect;
        // Center the image vertically (negative offset if too tall)
        offsetY = (desiredHeight - drawHeight) * 0.5;
      }

      // 4) Create the image onto the canvas at the calculated scale & offsets
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // 5) Convert canvas to a Blob (JPEG at 90% quality)
      const resizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
      });

      if (!resizedBlob) return;




      /* Optional: quick local preview while the upload is running */
      const tempURL = URL.createObjectURL(resizedBlob);

      // Local preview mode
      setVipImageTemp(tempURL);
      setVipBlobTemp(resizedBlob);
      setShowVipPopup(true);

      // 7) (Optional) If you want to upload the blob to your server or S3:
      // await uploadResizedImage(resizedBlob);
      event.target.value = '';


    };

    // Trigger the loading process
    img.src = imageUrl;

    event.target.value = '';
  };



  const handleImageSubmit = useCallback((enhancedTextx: any, loggedUserx: any, seed: any) => {


    if (GeneratedImage) {
      ///alert('im');
      handleSubmitSdxlImageRepli(GeneratedImage, enhancedTextx, loggedUserx);

    } else {
      //alert('no');
      ///handleSubmitSdxlImageRepli('', enhancedTextx, loggedUserx);

      handleSubmitFluxImage('', enhancedTextx, loggedUserx, seed);
    }
  }, [GeneratedImage, modelz]);



  const runReferenceImageGeneration = async (castingPrompts: any[]) => {
    if (!castingPrompts || castingPrompts.length === 0) return;
    if (isGeneratingRefsRef.current) return; // LOCK
    isGeneratingRefsRef.current = true;

    setCastingStatus("Generating reference images...");
    setReferenceLoading(true);
    setReferencePendingCount(castingPrompts.length);
    // Initialize empty slots without spinners and keep the first generated prompt as the default.
    updateReferenceImages(prev => {
      const next = prev.map(ref => {
        const match = castingPrompts.find((p: any) => p.name === ref.name);
        if (match) {
          return {
            ...ref,
            prompt: ref.prompt || match.imagePrompt,
            originalPrompt: ref.originalPrompt || match.imagePrompt,
            isGenerating: false
          };
        }
        return ref;
      });
      return next;
    });

    let successCount = 0;

    // Sequential image generation: 1 at a time with 1-second delay
    for (let i = 0; i < castingPrompts.length; i++) {
      const item = castingPrompts[i];
      const latestRef = referenceImagesRef.current.find((ref) => ref.name === item.name);

      if (latestRef?.imageUrl || latestRef?.isGenerating) {
        successCount++;
        setReferencePendingCount(prev => Math.max(0, prev - 1));
        continue;
      }

      let url = 'fluxschnell';
      if (modelz === 'Imagen') url = 'Imagen';
      else if (modelz === 'Imagen2') url = 'Imagen2';
      else if (modelz === 'minimax') url = 'minimax';
      else if (modelz === 'minimax2') url = 'minimax2';
      else if (modelz === 'fluxUltra') url = 'fluxUltra';
      else if (modelz === 'fluxUltra2') url = 'fluxUltra2';
      else if (modelz === 'fluxDev') url = 'fluxDev';
      else if (modelz === 'Hi Dream') url = 'HiDream';
      else if (modelz === 'Gpt Image') url = 'GptImage';
      else if (modelz === 'seeDream') url = 'seeDream';
      else if (modelz === 'Bannana') url = 'Imagen';
      else if (modelz === 'Schnell' || modelz === 'Models') url = 'fluxschnell';

      let calcWidth = 1080;
      let calcHeight = 1920;
      if (ratioKey === 3) { calcWidth = 1920; calcHeight = 1080; }
      else if (ratioKey === 2) { calcWidth = 1080; calcHeight = 1080; }
      else if (ratioKey === 1) { calcWidth = 1080; calcHeight = 1920; }

      const payload = {
        inputs: item.imagePrompt,
        width: calcWidth,
        height: calcHeight,
        guidance: 7.5,
        num_inference_steps: 35,
        seed: Seed,
        ty: ratioKey
      };

      const executeGeneration = async (attempt: number) => {
        try {
          if (attempt === 1) {
            const perImageCost = calcModelPixels({ model: modelz, baseImagesPerDollar: 333 });
            await removePixel(perImageCost);
          }
          const imgRes: any = await axios.post(`${CLIK_URL}/${url}`, payload, { withCredentials: true });
          const { imageBase64 } = imgRes.data;

          if (imageBase64) {
            let finalUrl = imageBase64;
            try {
              const fetchRes = await fetch(imageBase64);
              const blob = await fetchRes.blob();
              const publicUrl = await putToS3(blob);
              if (publicUrl) {
                finalUrl = publicUrl;
                Saveprompthelperfordellater(publicUrl);
              }
            } catch (s3Err) {
              console.error("Failed to upload character to S3:", s3Err);
            }

            const enableUpscale = true; // Auto-upscale after creation

            // Keep 'isGenerating' true during upscale so the normal loading state remains active
            updateReferenceImages(prev => {
              const updated = [...prev];
              const targetIdx = updated.findIndex(r => r.name === item.name);
              if (targetIdx !== -1) {
                const current = updated[targetIdx];
                if (current.imageUrl && !current.isGenerating) {
                  return updated;
                }
                updated[targetIdx] = {
                  ...current,
                  imageUrl: finalUrl,
                  prompt: current.prompt || item.imagePrompt,
                  originalPrompt: current.originalPrompt || item.imagePrompt,
                  isGenerating: enableUpscale,
                  isUpscaling: enableUpscale
                } as any;
              }
              return updated;
            });

            // Perform auto-upscale
            if (enableUpscale) {
              try {
                await removePixel(2); // Upscale cost
                const upscaleRes: any = await axios.post(`${CLIK_URL}/upscaleImage`, { url: imageBase64 });
                if (upscaleRes.data && upscaleRes.data.url) {
                  updateReferenceImages(prev => {
                    const updated = [...prev];
                    const targetIdx = updated.findIndex(r => r.name === item.name);
                    if (targetIdx !== -1) {
                      const current = updated[targetIdx];
                      if (current.imageUrl === finalUrl || current.isUpscaling) {
                        updated[targetIdx] = { ...current, imageUrl: upscaleRes.data.url, isGenerating: false, isUpscaling: false } as any;
                      }
                    }
                    return updated;
                  });
                } else {
                  throw new Error("No URL returned from upscale API");
                }
              } catch (upscaleErr) {
                console.error("Auto-upscale failed for", item.name, upscaleErr);
                // Remove the loading overlay on failure but keep the base image
                updateReferenceImages(prev => {
                  const updated = [...prev];
                  const targetIdx = updated.findIndex(r => r.name === item.name);
                  if (targetIdx !== -1) {
                    updated[targetIdx] = { ...updated[targetIdx], isGenerating: false, isUpscaling: false } as any;
                  }
                  return updated;
                });
              }
            }

            setReferencePendingCount(prev => Math.max(0, prev - 1));

            const p = await getPixel();
            setAvailablePixels(p);
            successCount++;
            return true; // success
          }
          return false;
        } catch (imgErr) {
          console.error(`Failed to generate reference image for ${item.name} (attempt ${attempt}):`, imgErr);
          return false;
        }
      };

      // Set generating status for this specific image to show the spinner.
      updateReferenceImages(prev => {
        const updated = [...prev];
        const targetIdx = updated.findIndex(r => r.name === item.name);
        if (targetIdx !== -1) {
          const current = updated[targetIdx];
          if (!current.imageUrl && !current.isGenerating) {
            updated[targetIdx] = { ...current, isGenerating: true };
          }
        }
        return updated;
      });

      let success = await executeGeneration(1);
      if (!success) {
        setReferencePendingCount(prev => Math.max(0, prev - 1));
        updateReferenceImages(prev => {
          const updated = [...prev];
          const targetIdx = updated.findIndex(r => r.name === item.name);
          if (targetIdx !== -1 && !updated[targetIdx].imageUrl) {
            updated[targetIdx] = { ...updated[targetIdx], isGenerating: false };
          }
          return updated;
        });
      }

      // Wait 1 second before calling the API for the next image
      if (i < castingPrompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setReferenceLoading(false);
    isGeneratingRefsRef.current = false; // RELEASE LOCK

    if (successCount === castingPrompts.length) {
      setCastingStatus("Reference images ready!");
      setStudioButtonStage('post-countdown');
      setStudioActionTimer(20);
    } else {
      setCastingStatus(`Finished with errors: ${castingPrompts.length - successCount} failed.`);
      setStudioButtonStage('post-continue');
    }
  };

  const handleSubmitSdxl = useCallback(async (enhancedText: any, loggedUserx: any) => {
    // Immediately show loader
    setIsSubmitting(true);

    // Keep forcing the loader to true on an interval
    const intervalId = setInterval(() => {
      setIsSubmitting(true);
    }, 500);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt cannot be empty.");
      return;
    }

    try {
      const response = await fetch(
        "https://mjuutqlkaw0l3v21.us-east-1.aws.endpoints.huggingface.cloud",
        {
          method: "POST",
          headers: {
            Accept: "image/png",
            "Content-Type": "application/json",
            Authorization: `Bearer ${VITE_HUGG}`,
          },
          body: JSON.stringify({
            inputs: trimmedPrompt,
            parameters: {
              height: 1024,
              width: 1024,
              num_inference_steps: 35,
              guidance_scale: 7.5,
            },
          }),
        }
      );

      if (response.ok) {

        setAllowPing(false);
        ///setIsFluxOnTop(true);

        const imageBlob = await response.blob();
        //setGeneratedImageBlob(imageBlob);
        const imageUrl = URL.createObjectURL(imageBlob);
        // setGeneratedImage(imageUrl);

        setim(true)

        ///handleSubmitFlux(imageUrl)

        ///EnhanceText(prompt, imageUrl, loggedUser);

        handleSubmitFluxImage(imageUrl, enhancedText, loggedUserx, 100)


        ///setIsSubmitting(true); // Set loading state
        /// setLabel('Loading Hd: 10secs');
        /// setShowLabel(true);
      } else {
        setAllowPing(true);
        /// handleSubmitDefaultSdxl();
      }
    } catch (err) {

      /// handleCloseOverlay();
      console.error("Error calling Hugging Face Inference Endpoint:", err);
      setError("An error occurred while generating the image. Please try again.");
    } finally {
      // Clear the interval and hide loader
      clearInterval(intervalId);
      // setIsSubmitting(false);
    }
  }, [prompt, loggedUser, modelz]);

  const handleSubmitDefaultSdxl = useCallback(async () => {
    setGeneratedImageFlux('');

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Prompt cannot be empty.");
      return;
    }

    setIsSubmitting(true); // Set loading state
    console.log('using Serverless Api');
    try {
      // Make the fetch request to the Hugging Face Inference Endpoint
      const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", // Replace with your actual endpoint URL
        {
          method: "POST",
          headers: {
            Accept: "image/png", // Request image response
            "Content-Type": "application/json", // Specify JSON format for request
            Authorization: `Bearer ${VITE_HUGG}`, // Hugging Face API token
          },
          body: JSON.stringify({
            inputs: trimmedPrompt,
            parameters: {
              height: 1024, // Optional: Specify image height
              width: 1024,  // Optional: Specify image width
              num_inference_steps: 50, // Optional: Number of steps for better image quality
              guidance_scale: 7.5, // Optional: Higher value for better adherence to prompt
            },
          }),
        }
      );

      // Convert the Blob response into a URL for display
      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);

      // Update your state to display the image
      //  if (imageUrl) { setGeneratedImage(imageUrl); }
      // setIsSubmitting(false);

      // Clear input and error
      // setPrompt("");
      setError("");

      if (response.ok) {
        ///handleSubmitFlux(imageUrl);
        setIsFluxOnTop(false);
        ///setIsSubmitting(true); // Set loading state
        /// setLabel('Loading Hd: 10secs');
        /// setShowLabel(true);
      } else {
      }
    } catch (err) {
      console.error("Error calling Hugging Face Inference Endpoint:", err);
      setError("An error occurred while generating the image. Please try again.");
    } finally {
      // setIsSubmitting(false); // Reset loading state
    }
  }, [prompt]);

  const handleSubmit = useCallback(() => {
    setGeneratedImageFlux('');
    setParsedKeyPoints([]);
    setParsedKeyPoints2([])
    setParsedKeyPointsb([]);
    /// handleSubmitSdxl();


    EnhanceText(prompt, loggedUser);

  }, [handleSubmitSdxl, prompt, loggedUser, GeneratedImage]);

  // Define TypeScript interfaces
  interface EnhanceTextRequest {
    pp: string;
    remixData: string




  }

  interface EnhanceTextResponse {
    message: string;
    initialSteps: string;

  }



  const SPECIAL = new Set(['kontext', 'bannana', 'minimax']);

  const SPECIALp = new Set(['kontext', 'bannana',]);


  const SPECIALx = new Set(['kontext', 'bannana',]);
  const modelzLower = (modelz ?? '').toLowerCase();
  const isSpecialSelected = SPECIALp.has(modelzLower);

  const isSpecialSelectedx = SPECIALx.has(modelzLower);
  // State variables
  const [enhancedText, setEnhancedText] = useState<string>('');



  // Define the EnhanceText function
  const StartStory = async (pp: any, loggedUserx: any, selectedStyle: any, typex: any) => {
    setIsSubmittingKick(true);

    setParsedKeyPoints([]);
    setParsedKeyPoints2([])
    setParsedKeyPointsb([]);

    setPlanInfo(1);

    setallowSpin(true);

    setError('');
    try {
      let finalRemixData = remixData || "";

      if (Vipcharacters && Vipcharacters.length > 0) {
        const vipText = Vipcharacters.map((v: any) => `${v.name} ${v.description}`).join("\n");
        if (finalRemixData.trim().length > 0) {
          finalRemixData += `\n\ncharacters description:\n${vipText}`;
        } else {
          finalRemixData = `characters description:\n${vipText}`;
        }
      }

      var url = 'startStory';

      if (typex === 0) {
        url = 'startMemes';
      } else if (typex === 3) {
        url = 'startInteractions';
      } else {

      }

      const promptForRequest =
        typex === 1 && promptMusicUrl
          // Put the scene-count constraint INSIDE the brief (front-loaded, where the
          // model weights it most) and reinforce at the tail, so it reads like part
          // of the user's own request rather than a trailing system note. This keeps
          // the AI in control of the story while strongly steering the exact count.
          ? `Tell this story in exactly ${promptMusicSceneCount} scenes â€” not more, not fewer.\n\n${String(pp).trim()}\n\n(Reminder: the finished story must have exactly ${promptMusicSceneCount} scenes.)\n\nNo matter what, you must give me exactly ${promptMusicSceneCount} scenes. You must do this. You must give exactly ${promptMusicSceneCount} scenes.`
          : pp;

      console.log('GOLDEN PROMPTTTTTTTTTT', promptForRequest);
      const requestData: EnhanceTextRequest = { pp: promptForRequest, remixData: finalRemixData };



      // Make the POST request to the server
      const response = await axios.post<EnhanceTextResponse>(
        `${CLIK_URL}/${url}`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;


      console.log("log:", data);

      setPlanInfo(2);

      const parsed: any = data.initialSteps;

      const keyPoints: string[] = Array.isArray(parsed?.keyPoints) ? parsed.keyPoints : [];

      const keyPointsWithStage2 =
        type === 1
          ? keyPoints.flatMap((t) => [t, t]) // duplicates each item adjacently
          : keyPoints;

      setParsedKeyPointsx(keyPointsWithStage2);

      setParsedKeyPoints2(parsed.keyPoints);
      setPlanInfo(2)

      StartPlan(pp, keyPointsWithStage2, selectedStyle);


      console.log("Enhancement Completed:", keyPointsWithStage2);

      // Update state with the enhanced text


      //setPrompt(data.initialSteps);

      console.log(data.initialSteps);


    } catch (error: any) {

      setshowButton(true);

      setallowSpin(false);
      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }

  // strip popular TLD suffixes like ".com", ".org", ".io", etc. (no spaced dots)
  const TLD_REGEX =
    /\.(?:com|org|net|io|co|gov|edu|cn|uk|de|jp|fr|in|it|nl|br|es|ca|au|ru|ch|se|no|dk|fi|pl|cz|at|be|nz|il|kr|tw|tr|ar|mx|pt|gr|hu|ie|sg|hk|id|my|ph|sa|ae|qa|za|ng)\b(?![a-z0-9-])/gi;

  const cleanPoints = (arr: string[]) =>
    arr.map((s) =>
      s
        .replace(/\*/g, "")     // remove all asterisks
      ///.replace(TLD_REGEX, "") // drop the listed TLDs
    );



  // Define the EnhanceText function
  const StartPlan = async (pp: any, x: any, selectedStyle: any) => {
    setIsSubmittingKick(true);
    startNewFluxRun();


    setError('');
    try {
      // Prepare the request payload

      const requestData: any = { pp, x };

      var tt = 'startPlan';

      // Check if the array has at least one image
      if (GeneratedImage.length > 0) {
        tt = 'startPlan';
      }
      // Make the POST request to the server
      const response = await axios.post<any>(
        `${CLIK_URL}/${tt}`,
        requestData,
        { withCredentials: true }
      );

      const { plan } = response.data                     // <- âœ¨ hereâ€™s your plan
      console.log("Plan Created:", plan)

      // example use:



      var finalPlan = plan;

      setPlanInfo(3)

      if (selectedStyle === 'Auto') {



      } else {


        finalPlan = applyArtStyleToPlan(plan, selectedStyle);
        // do something with finalPlanâ€¦



      }


      setPlanx(finalPlan);


      setPlanInfo(0);

      setallowSpin(false);
      const cleaned = Array.isArray(x) ? cleanPoints(x) : [];

      setParsedKeyPoints(cleaned);
      console.log(parsedKeyPoints, parsedKeyPoints);
      setParsedKeyPointsb(cleaned);

      // --- Step 3: Server Casting Call (Phase 2) ---
      // --- DEFERRED: Server Casting Call (Phase 2 & 3) ---
      // We no longer trigger extractCasting here. It is deferred until the
      // skipCountdown hits 0, saving tokens if the user decides to skip.

      // Update state with the enhanced text


      //setPrompt(data.initialSteps);




    } catch (error: any) {
      setallowSpin(false);
      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }





  // 1ï¸âƒ£  Create one â€œbulk-deleteâ€ helper
  const bulkDeleteImages = async () => {
    // Combine scene images and character portraits for cloud cleanup
    const refUrls = (referenceImages || []).map((r: any) => r.imageUrl);
    const allToDelete = [...(ImagesHdCloud || []), ...refUrls].filter(url => url && typeof url === 'string' && url.trim() !== "");

    // Always clear the local UI state
    setImagesHdCloud([]);
    updateReferenceImages(() => []);
    setDetectedEnvironments([]);

    if (allToDelete.length === 0) return;

    try {
      await Promise.all(
        allToDelete.map(async (url: any) => {
          try {
            await startDelete(url);          // your existing helper
          } catch (err) {
            console.error(`âŒ  Couldnâ€™t delete ${url}:`, err);
          }
        })
      );
    } catch (err) {
      console.error("Bulk delete error", err);
    }
  };

  const resetMagicMirror = () => {
    setDummyMode(false);

    bulkDeleteImages();
    setVideMode(false);
    destroyAllFluxCalls();
    handleCloseOverlay();
    setIsAgentCasting(false);
    setReferencePendingCount(0);

    if (magicMode) {
      setGeneratedImagesFluxx([]);
      setParsedKeyPoints([]);
      setParsedKeyPoints2([]);
      setIsMirrorFocused(true);
    }
  }

  const callAudio = async () => {


    try {
      // Prepare the request payload
      const requestData: any = { prompt };
      setAudioResult('');

      setaudioLoad(true);
      // Make the POST request to the server
      const response = await axios.post<any>(
        `${CLIK_URL}/ChatGPTApiAudio`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;

      console.log("Enhancement Completed:", data.responseText);

      // Update state with the enhanced text
      //setEnhancedText(data.initialSteps);
      //setPrompt(data.initialSteps);

      setAudioResult(data.responseText);
      setaudioLoad(false)


    } catch (error: any) {
      ///handleCloseOverlay();



      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }




  // Define the EnhanceText function
  const EnhanceText = async (pp: any, loggedUserx: any) => {

    setIsSubmitting(true);
    setError('');
    var long = 0

    if (modelz === 'Flux Pro') {

      long = 1
    }


    try {
      // Prepare the request payload
      const requestData: any = { pp, prompt, long };

      // Make the POST request to the server
      const response = await axios.post<EnhanceTextResponse>(
        `${CLIK_URL}/ChatGPTApiDesign4`,
        requestData,
        { withCredentials: true }
      );

      // Extract data from the response
      const data = response.data;

      console.log("Enhancement Completed:", data.initialSteps);

      const seed = Math.floor(Math.random() * 1_000_000_000);


      setSeed(seed);

      // Update state with the enhanced text
      setEnhancedText(data.initialSteps);
      //setPrompt(data.initialSteps);

      ///handleSubmitFluxImage(img, data.initialSteps, loggedUserx)

      /// handleSubmitSdxl(data.initialSteps, loggedUserx);

      handleImageSubmit(data.initialSteps, loggedUserx, seed)

    } catch (error: any) {
      /// handleCloseOverlay();

      // Handle different error scenarios
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error("Server Error:", error.response.data);
        setError(error.response.data.message || "Server Error");
      } else if (error.request) {
        // Request was made but no response received
        console.error("No response received:", error.request);
        setError("Network Error: No response received from server.");
      } else {
        // Other errors
        console.error("Error:", error.message);
        setError(error.message);
      }
    } finally {
      ///setIsLoading(false);
    }
  }



  const [showButton, setshowButton] = useState(false);


  useEffect(() => {
    if (prompt.trim() === "") return; // Do not submit if prompt is empty

    //type===0


    setshowButton(true);

    const handler = setTimeout(() => {


      setshowButton(false);

    }, 50000); // 500 milliseconds = 0.5 seconds

    // Cleanup the timeout if prompt changes before 0.5 seconds
    return () => {
      clearTimeout(handler);
    };
  }, [prompt, handleSubmit]);



  const getPixel = async (): Promise<number> => {
    try {
      const { data } = await axios.post<{ userid: number; pixels: number }>(
        `${CLIK_URL}/getPixels`,
        { values: { userid: loggedUser?.id ?? 0 } }
      );
      return data.pixels;          // a number
    } catch (err) {
      console.error("Error fetching pixels:", err);
      return 0;                    // fallback so the caller always gets a number
    }
  };




  /* ------------------------------------------------------------------
   * Actual Submit Logic (Renamed from old handleStartSubmit)
   * ------------------------------------------------------------------ */
  const handleActualSubmit = useCallback(async () => {
    actualSubmitRef.current = null; // clear it so it's not stale

    if (!loggedUser || allowSpin) return;
    if (isSubmittingKick) return;

    if (loggedUser.id === 1 && APP_STATE === 'prodxxxx') {
      alert("ðŸ”’ Please sign up first before using this feature! ðŸ’ª");
      dispatch(setLogin(true));
    } else {
      setIsSubmittingKick(true);
      setshowButton(false);

      if (GeneratedImage.length > 0) {
        setGotIm(true);
      } else {
        setGotIm(false);
      }

      if (type === 1 || type === 0 || type === 3) {
        const pixels = await getPixel();
        const modelPrice = calcModelPixels({
          model: modelz,
          baseImagesPerDollar: 333
        });

        if (pixels >= modelPrice) {
          StartStory(prompt, loggedUser, selectedStyle, type);
        } else {
          alert(`ðŸ˜¢ Youâ€™ve run out of pixels!\nThis image generation needs at least ${modelPrice} pixels, but your balance is ${pixels} pixels.`);
        }
      } else if (type === 2) {
        callAudio();
      }
    }
  }, [type, handleSubmit, GeneratedImageFlux, GeneratedImage, selectedStyle, modelz, loggedUser, showButton, planInfo, isSubmittingKick, promptMusicUrl, promptMusicSceneCount]);

  /* ------------------------------------------------------------------
   * NEW handleStartSubmit: Enforces the 4-second Countdown
   * ------------------------------------------------------------------ */
  const handleStartSubmit = useCallback(() => {

    if (countdown !== null) return; // Prevent multiple countdowns

    setCountdown(5);
    setIsBlinking(true);
  }, [countdown]);


  useEffect(() => {

    if (instantCall && prompt.trim() !== "") {

      setTimeout(() => {
        handleStartSubmit();
        /// alert(prompt);
        setinstantCall(false);
      }, 2000); // 1-second delay to ensure smooth transition


    }
  }, [instantCall, prompt, handleStartSubmit]);

  useEffect(() => {
    // Stage 1: Timer Completion
    if (countdown === 0) {
      setIsBlinking(false);
      setCountdown(null);
      // Trigger final submission natively after the clock zero
      handleActualSubmit();
      return;
    }

    // Stage 2: Tick Down
    if (countdown !== null && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [countdown, handleActualSubmit]);

  const handleSkipCharacters = useCallback(() => {
    // IMMEDIATELY Proceed to Storybook (Skip Phase) - Visual close only so background gen continues
    setSkipCountdown(null);
    setStudioButtonStage('hidden');
    setShowStudioModal(false);
    setShowScenesPopup(false);
    setAutoSkipPending(false);
  }, []);

  const handleDeleteCharacter = useCallback((nameToDelete: string, type: string) => {
    if (type === 'character') {
      setDetectedCharacters(prev => prev.filter(c => c.name !== nameToDelete));
    } else {
      setDetectedEnvironments(prev => prev.filter(e => e.name !== nameToDelete));
    }
    updateReferenceImages(prev => prev.filter(ref => ref.name !== nameToDelete));
  }, []);

  const proceedToImageGeneration = useCallback(async (characters: any[], environments: any[], castingId: number) => {
    setCastingStatus("Generating reference image prompts...");
    updateReferenceImages(prev => prev.map(r => r.imageUrl === '' ? { ...r, isGenerating: true } : r));
    try {
      const charsToGenerate = characters.filter((c: any) => !c.imageUrl);
      const promptRes = await axios.post<any>(
        `${CLIK_URL}/generateCastingPrompts`,
        { characters: charsToGenerate, environments, prompts: parsedKeyPointsb, plan: Planx, narrationSummary: parsedKeyPoints2 },
        { withCredentials: true }
      );
      if (latestCastingIdRef.current !== castingId) return;

      const castingPrompts = promptRes.data.prompts || [];
      if (castingPrompts.length > 0) {
        const userPixels = await getPixel();
        setAvailablePixels(userPixels);
        const perImageCost = calcModelPixels({ model: modelz, baseImagesPerDollar: 333 });
        const requiredPixels = perImageCost * castingPrompts.length;
        setStudioActionCost(requiredPixels);

        if (userPixels >= requiredPixels) {
          setQueuedCastingPrompts(castingPrompts);
          hasStartedCastingRef.current = true;
          setCastingStatus(`Generating ${castingPrompts.length} references...`);
          runReferenceImageGeneration(castingPrompts);
        } else {
          setStudioButtonStage('pre-broke');
          setCastingStatus(`Not enough Pixels. Cost: ${requiredPixels}`);
        }
      }
    } catch (err: any) {
      console.error("Casting Prompts Pipeline Failed:", err);
      setCastingStatus("Error generating prompts.");
      handleSkipCharacters();
    }
  }, [parsedKeyPointsb, Planx, parsedKeyPoints2, modelz, handleSkipCharacters]);

  const runAutoCastingPipeline = useCallback(async (autoMode?: boolean) => {
    setStudioButtonStage('generating');
    setCastingStatus("Reading Script & Identifying Characters...");

    const currentCastingId = Date.now();
    latestCastingIdRef.current = currentCastingId;

    // 1. Show Vip characters with just names initially
    const vipRefsPre = Vipcharacters ? Vipcharacters.map((v: any) => ({
      name: v.name,
      type: 'character',
      imageUrl: '', // Show just names (shimmer) initially
      prompt: v.description,
      description: v.description,
      isGenerating: true
    })) : [];
    if (vipRefsPre.length > 0) updateReferenceImages(() => vipRefsPre);

    try {
      const castingRes = await axios.post<any>(
        `${CLIK_URL}/extractCasting`,
        { prompts: parsedKeyPointsb, instruction: castingInstruction },
        { withCredentials: true }
      );
      if (latestCastingIdRef.current !== currentCastingId) return;

      const castData = castingRes.data.data;
      const characters = castData?.characters || [];
      const environments = castData?.environments || [];

      // Merge Vipcharacters
      const vipRefs = Vipcharacters ? Vipcharacters.map((v: any) => ({
        name: v.name,
        type: 'character',
        imageUrl: v.imageUrl, // SHOW IMAGES NOW
        prompt: v.description,
        description: v.description,
        isGenerating: false,
        isVip: true
      })) : [];

      const vipNames = vipRefs.map((v: any) => v.name.toLowerCase());
      const filteredCharacters = characters.filter((c: any) => !vipNames.includes(c.name.toLowerCase()));
      const combinedCharacters = [
        ...vipRefs,
        ...filteredCharacters
      ];

      setDetectedCharacters(combinedCharacters);
      setDetectedEnvironments(environments);

      // Initialize referenceImages immediately to render the bubbles with shimmer (no spinners yet)
      updateReferenceImages(() => [
        ...vipRefs,
        ...filteredCharacters.map((c: any) => ({ name: c.name, type: 'character', imageUrl: '', prompt: '', description: c.description, isGenerating: false })),
        ...environments.map((e: any) => ({ name: e.name, type: 'environment', imageUrl: '', prompt: '', description: e.description, isGenerating: false }))
      ]);

      setCastingStatus("Casting Complete! Found Characters.");

      if (filteredCharacters.length === 0 && environments.length === 0 && vipRefs.length === 0) {
        setCastingStatus("No characters found.");
        handleSkipCharacters();
        if (autoMode) {
          setallowgetImage(true);
          setCreationMode('Normal');
          setIsAgentCasting(false);
        }
        return;
      }

      if (characters.length > 0 || environments.length > 0) {
        setSkipCountdown(null);
        if (autoMode) {
          proceedToImageGeneration(characters, environments, currentCastingId);
        } else {
          setStudioButtonStage('continue-editing' as any);
        }
      }
    } catch (err: any) {
      console.error("Casting Pipeline Failed:", err);
      setCastingStatus("Error retrieving characters.");
      handleSkipCharacters();
      if (autoMode) {
        setallowgetImage(true);
        setCreationMode('Normal');
        setIsAgentCasting(false);
      }
    }
  }, [parsedKeyPointsb, handleSkipCharacters, proceedToImageGeneration, isRevisitingCharacter, setallowgetImage, setCreationMode, castingInstruction]);

  const startAgentCasting = useCallback(() => {
    setIsAgentCasting(true);
    runAutoCastingPipeline(true);
  }, [runAutoCastingPipeline]);

  useEffect(() => {
    if (isAgentCasting && !referenceLoading && referencePendingCount === 0 && referenceImages.length > 0) {
      const isAnyGenerating = referenceImages.some(r => r.isGenerating);
      if (!isAnyGenerating) {
        setallowgetImage(true);
        setCreationMode('Normal');
        setIsAgentCasting(false);
      }
    }
  }, [isAgentCasting, referenceLoading, referencePendingCount, referenceImages, setallowgetImage, setCreationMode]);

  useEffect(() => {
    if (isRevisitingCharacter) return;

    if (skipCountdown === 0) {
      setSkipCountdown(null);
      if (studioButtonStage === 'edit-characters') {
        setStudioButtonStage('generating');
        proceedToImageGeneration(detectedCharacters, detectedEnvironments, latestCastingIdRef.current);
      } else {
        runAutoCastingPipeline();
      }
      return;
    }
    if (skipCountdown !== null && skipCountdown > 0) {
      const timer = setInterval(() => {
        setSkipCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [skipCountdown, isRevisitingCharacter, studioButtonStage, detectedCharacters, detectedEnvironments, proceedToImageGeneration, runAutoCastingPipeline]);



  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();


        handleStartSubmit();

      }
    },
    [handleStartSubmit, type]
  );





  const [isFluxOnTop, setIsFluxOnTop] = useState(true); // Tracks which image is on top
  const [label, setLabel] = useState<string>("");

  const [showLabel, setShowLabel] = useState<boolean>(false);

  const handleImageClick = useCallback(() => {


    if (big) {

      setstartEdit(true);
    }
  }, [big]);

  useEffect(() => {
    if (GeneratedImageFlux) {
      setLabel('');
    }
  }, [GeneratedImageFlux]);

  useEffect(() => {
    if (showLabel) {
      const timer = setTimeout(() => {
        setShowLabel(false);
      },
        label === 'Loading Hd: 10secs' ? 900000 : 5000); // 900000 ms = 15 minutes or 5000 ms = 5 sec

      // Cleanup the timer when the component unmounts or when showLabel changes
      return () => clearTimeout(timer);
    }
  }, [showLabel]);


  // Keeps every timeout ID keyed by the image index
  const timeoutRefsxp = useRef<{ [key: number]: ReturnType<typeof setTimeout> | null }>({});
  // When TRUE we refuse to schedule *any* new setTimeouts
  const timeoutsDisabledRef = useRef(false);

  const destroyAllFluxCalls = () => {
    timeoutsDisabledRef.current = true;                 // block future scheduling

    // clear & null-out every live timeout
    Object.keys(timeoutRefsxp.current).forEach((key) => {
      const id = timeoutRefsxp.current[Number(key)];
      if (id) clearTimeout(id);
      timeoutRefsxp.current[Number(key)] = null;
    });
  };

  const startNewFluxRun = () => {
    timeoutsDisabledRef.current = false;
  };







  const saveToDastabase = useCallback((uploadedHdUrluploadedHdUrl: any, enhancedTextData: any, loggedUserx: any) => {
    var Datall = ({
      id: loggedUserx ? loggedUserx.id : null,
      caption: promptx ? promptx : enhancedTextData,
      imagehd: uploadedHdUrluploadedHdUrl,
      Kkontext: GeneratedImage.length > 0 ? GeneratedImage[0] : null,
      prompt: prompt ? prompt : null,
      model: modelz,
      ratio: ratioKey
    });



    axios.post(`${CLIK_URL}/generatedImagePost`, {
      values: Datall,
    })
      .then((response: any) => {
        console.log(response);


        const newRowId = response.data.go;

        setPostId(newRowId);

        const LOCAL_KEY = "S3fromprompt";
        localStorage.removeItem(LOCAL_KEY);

        // Protect in-use images from deletion
        const inUseUrls = [uploadedHdUrluploadedHdUrl, ...GeneratedImage];
        RemoveFromDeleteLater(inUseUrls);

        setStopText(false);

        ///   setTimeout(() => { setcallFeeds(true); }, 500);

        ///  setTimeout(() => { handleCloseOverlay(); }, 10);


      })
      .catch((error) => {
        ///handleCloseOverlay();
        console.log(error);
      });

  }, [promptx, GeneratedImage, prompt, modelz, ratioKey])

  // **New State Variable to Control Overlay Visibility**
  const [showOverlay, setShowOverlay] = useState<boolean>(false);

  const [audioLoad, setaudioLoad] = useState<boolean>(false);

  // **Trigger Overlay When Image Generation Starts**
  useEffect(() => {
    if (isSubmitting) {
      setShowOverlay(true);
    } else {
      setShowOverlay(false);

    }
  }, [isSubmitting]);

  // **Function to Close Overlay** startPlan
  const handleCloseOverlay = () => {
    resetPromptMusicState();
    setallowgetImage(false);
    setHomeModel('Models');
    homeModelLocked.current = false;
    setbase([]);
    /// setPromptx('');
    // setPrompt('');
    setaudioLoad(false)
    setAllowPing(true);

    //setGeneratedImage('');
    setGeneratedImageFlux('');
    setGeneratedImagesFluxx([]);
    setParsedKeyPoints([]);
    setParsedKeyPointsb([]);
    setIsSubmittingKick(false);
    setGeneratedImageFluxBlob([]);

    // --- Story Stage Garbage Collection ---
    setBShotVideos([]);
    setBShotImages([]);
    setBShotPrompts([]);
    setBShotTextVideo([]);
    setBShotNanoImages([]);
    setIsBShotModeActive(false);

    // --- Character & Environment Garbage Collection ---
    setDetectedCharacters([]);
    setDetectedEnvironments([]);
    updateReferenceImages(() => []);
    setQueuedCastingPrompts([]);
    setCastingStatus("Analyzing script & matching actors...");
    setSkipCountdown(null);
    setAutoSkipPending(false);
    setStudioButtonStage('hidden');
    setNanoImages([]);
    setShowStudioModal(false);
    setShowConfirmClose(false);
    setReferenceLoading(false);
    setReferencePendingCount(0);
    hasStartedCastingRef.current = false;

    setShowOverlay(false);
    setMinimizeMode(1);
  };


  const handleCloseOverlay2 = () => {
    setbase([]);
    setaudioLoad(false)
    setAllowPing(true);
    setShowOverlay(true);
    setGeneratedImageFlux('');
    setParsedKeyPoints([]);
  }




  useEffect(() => {


    if (GeneratedImageFlux && isSubmitting || isSubmittingKick) {





      setStopText(true);
    } else {

      setStopText(false);
    }



  }, [GeneratedImageFlux, isSubmitting, isSubmittingKick]);



  /* ------------------------------------------------------------------ */
  const [loader, setLoader] = useState(0);          // 0 â€“ 100 %

  /* ------------------------------------------------------------------ */
  /* Kick off / reset when isSubmitting flips                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isSubmitting) {
      const start = Date.now();                 // ms
      const DURATION = 3 * 60 * 1000;           // 5 minutes in ms
      const CAP = 95;                           // never exceed 95 %

      // reset immediately
      setLoader(0);

      timer = setInterval(() => {
        const elapsed = Date.now() - start;     // ms since start
        const t = Math.min(elapsed / DURATION, 1); // 0 â€“ 1 timeline

        /* cubic-easing curve  â†’ fast start, slow finish              *
         *   easeOutCubic(t) = 1 â€“ (1 â€“ t)^3                          */
        const eased = 1 - Math.pow(1 - t, 3);

        const pct = Math.round(eased * CAP);   // 0 â†’ 95 % non-linear
        setLoader(prev => (pct > prev ? pct : prev));
      }, 200);                                  // update every 0.2 s
    }

    /* cleanup on unmount / when isSubmitting flips to false */
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSubmitting]);
  /* ------------------------------------------------------------------ */
  /* When the generation completes, bump to 100 % then hide overlay  countdown    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isSubmitting && loader < 100) {
      // when you set isSubmitting = false, bump to 100 first
      setLoader(100);
      // overlay will disappear because isSubmitting === false
    }
  }, [isSubmitting]);                                // runs once on finish



  const Manual = () => {


    setIsSubmittingKick(false);

    setParsedKeyPoints(
      ["",
        "",
        " ",
        "",
      ]);

    setParsedKeyPointsb(
      ["",
        "",
        " ",
        "",
      ]);

    setDummyMode(true)
  }
  // Lifted state for Notepad Image Generation
  // --- Auto-initiate Fullscreen Mode on Storybook Open ---
  useEffect(() => {
    if (parsedKeyPoints.length > 0) {
      setMinimizeMode(0); // Default to Fullscreen when opening
    }
  }, [parsedKeyPoints.length]);

  const handlePromptsFinished = useCallback(() => {
    // Only trigger skip countdown on FRESH first-load, never on revisit
    if (parsedKeyPoints.length > 0 && !isRevisitingCharacter && !magicMode) {
      if (parsedKeyPoints.length === 1) {
        // Automatically skip character creation for single-scene prompts
        handleSkipCharacters();
      } else {
        setShowPathChoiceOverlay(true);
      }
    }
  }, [parsedKeyPoints.length, isRevisitingCharacter, handleSkipCharacters, runAutoCastingPipeline, magicMode]);

  return (
    <>
      <AudioPicker
        showVoicesList={promptMusicPickerOpen}
        selectedVoice=""
        onClose={() => setPromptMusicPickerOpen(false)}
        onSelectVoice={() => { }}
        darkMode={darkModeReducer}
        voices={[]}
        setName={() => { }}
        setMemeMusic={setPromptMusicMode}
        MemeMusic={promptMusicMode}
        setmusicname={setPromptMusicName}
        setmusic={setPromptMusicUrl}
        music={promptMusicUrl}
        type={type}
        VideMode={VideMode}
        forceMusicMode
      />

      <div style={{
        ...(!isMirrorFocused ? {
          transform: 'scale(0.3)',
          opacity: 0,
          pointerEvents: 'none',
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: 'top center',
          zIndex: 0,
        } : {
          transform: 'none',
          opacity: 1,
          pointerEvents: 'auto',
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: 'top center',
          zIndex: 999999,
        })
      }}>
        <Mirror
          type={type}
          setType={setType}
          isMenuOpen={isMenuOpen}
          setModelz={setModelz}
          magicMode={true}
          prompt={prompt}
          setPrompt={(val) => {
            setPrompt(val);
            dispatch(setPromptRed(val));
          }}
          handleStartSubmit={handleStartSubmit}
          darkModeReducer={darkModeReducer}
          matchMobile={matchMobile}
          navigate={navigate}
          GeneratedImage={GeneratedImage}
          GeneratedImageFlux={GeneratedImageFlux}
          setGeneratedImage={setGeneratedImage}
          setGeneratedImageFlux={setGeneratedImageFlux}
          setminimisePrompt={setminimisePrompt}
          setinstantCall={setinstantCall}
          loggedUser={loggedUser}
          parsedKeyPoints={parsedKeyPoints}
          setParsedKeyPoints={setParsedKeyPoints}
          CreationMode={CreationMode}
          setCreationMode={setCreationMode}
          setallowgetImage={setallowgetImage}
          generatedImagesFluxx={generatedImagesFluxx}
          setGeneratedImagesFluxx={setGeneratedImagesFluxx}
          parsedKeyPoints2={parsedKeyPoints2}
          onClose={resetMagicMirror}
          startAgentCasting={startAgentCasting}
          referenceImages={referenceImages}
          referencePendingCount={referencePendingCount}
          castingStatus={castingStatus}
          isAgentCasting={isAgentCasting}
          nanoImages={nanoImages}
          loadersArray={loadersArray}
          onToggleSlideshow={() => setIsMirrorFocused(false)}
          isMirrorFocused={isMirrorFocused}
        />
      </div>


      {/* === STANDARD UI (Scaled Down in Mirror Mode) === */}
      <Box sx={{
        // --- Mirror Mode Transition (Create mode backgrounding) ---
        transform: isMirrorFocused ? 'scale(0.92)' : 'none',
        opacity: isMirrorFocused ? 0 : 1,
        pointerEvents: isMirrorFocused ? 'none' : 'auto',
        transformOrigin: 'top center',

        // --- Dynamic Minimizing Modes ---
        display: minimisePrompt ? 'none' : 'block',
        position: 'fixed',
        zIndex: minimizeMode === 0 ? 1000 : 2,

        top: 0,
        bottom: 'auto',
        left: minimizeMode === 0 ? 0 : (matchMobile ? 0 : (isMenuOpen ? '20%' : 0)),
        right: minimizeMode === 0 ? 0 : (matchMobile ? 0 : (isMenuOpen ? 0 : 0)),

        // Use auto width combined with left/right to fix scrollbar bulge
        width: minimizeMode === 0 ? '100%' : (matchMobile ? '100%' : 'auto'),
        height: minimizeMode === 0 ? '100vh' : (minimizeMode === 1 ? 'auto' : '25vh'),
        maxHeight: minimizeMode === 0 ? '100vh' : (minimizeMode === 1 ? '60vh' : '25vh'),

        background: darkModeReducer
          ? 'rgba(15, 15, 15, 0.6)'
          : 'rgba(255, 255, 255, 0.6)',
        backdropFilter: "blur(24px) saturate(140%)",

        // --- Premium Glassmorphism & 3D Effect ---
        border: (showPathChoiceOverlay || minimizeMode === 0) ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '12px 12px 40px rgba(0, 0, 0, 0.6)',

        borderRadius: minimizeMode === 0 ? 0 : '0 0 24px 24px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',

        paddingBottom: (minimisePrompt && minimizeMode !== 0) ? '0px' : '4vh',
        paddingTop: (minimisePrompt && minimizeMode !== 0) ? '0px' : '1.5vh',
        overflow: minimizeMode === 2 ? 'hidden' : (minimizeMode === 0 ? 'hidden' : 'visible'),
      }}>

        <div style={{ position: 'fixed', top: '20vh', zIndex: 200, display: 'none' }}>
          {pollStatus && <p>{pollStatus}</p>}
          {/* existing UI */}
        </div>

        {
          minimisePrompt ?

            null
            :

            <>

              <PromptToolbar
                buttonTheme={buttonTheme}
                worldStyle={worldStyle}
                setDummyMode={setDummyMode}
                ImagesHdCloud={ImagesHdCloud}
                setImagesHdCloud={setImagesHdCloud}
                minimisePrompt={minimisePrompt}
                handleOpenCharacterStudio={() => {
                  setIsRevisitingCharacter(true);
                  setShowStudioModal(true);

                  if (referenceImages.length === 0) {
                    // SIMPLIFIED REVISIT: No automatic casting, no countdown.
                    // User gets a GENERATE button to manually trigger casting,
                    // and an X close button to instantly exit.
                    setStudioButtonStage('post-continue');
                    setShowScenesPopup(false);
                    setCastingStatus("Analyzing script & matching actors...");
                  } else {
                    setStudioButtonStage('post-continue');
                    setShowScenesPopup(false);
                  }
                }}
                setVideMode={setVideMode}
                isMenuOpen={isMenuOpen}
                destroyAllFluxCalls={destroyAllFluxCalls}
                Manual={Manual}
                type={type}
                setPrompt={setPrompt}
                selectedStyle={selectedStyle}
                setSelectedStyle={setSelectedStyle}

                parsedKeyPoints={parsedKeyPoints}
                GeneratedImageFlux={GeneratedImageFlux}
                handleCloseOverlay={handleCloseOverlay}
                referenceImages={referenceImages}
                setReferenceImages={setReferenceImages}

                allowSpin={allowSpin}
                isBlinking={isBlinking}
                onCancel={cancelCountdown}
                onClose={resetMagicMirror}
                minimizeMode={minimizeMode}
                setMinimizeMode={setMinimizeMode}
                isStorybookDone={isSaveButtonVisible}
                magicMode={magicMode}
                models={models}
                modelz={modelz}
                homeModel={homeModel}
                handleSelectModel={handleSelect}
                isBShotModeActive={isBShotModeActive}
                onOpenMusicPicker={() => {
                  setPromptMusicMode(true);
                  setPromptMusicPickerOpen(true);
                }}
                hasPromptMusic={Boolean(promptMusicUrl)}
                onToggleSlideshow={() => setIsMirrorFocused(true)}
              />




              <Box
                sx={{
                  // display: "flex",
                  width: "100%",
                  minHeight: matchMobile ? "18vh" : "14vh",
                  borderBottom: "none",
                  display:
                    generatedImagesFluxx.length > 0 || parsedKeyPoints.length > 0
                      ? "none"
                      : "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {isSubmittingKick && parsedKeyPoints.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, py: 4, width: '100%' }}>
                    <PlanSteps planInfo={planInfo} parsedKeyPointsx={parsedKeyPointsx} darkMode={darkModeReducer} />
                  </Box>
                ) : (
                  <>
                    {/* LEFT: Autocomplete/TextField (~80%) as a visual shell & mirror */}
                    <Box sx={{ flex: "1 1 20%", minWidth: 0, }}>
                      <Autocomplete
                        freeSolo
                        options={suggestions}
                        inputValue={prompt}
                        onInputChange={(_, value) => {
                          // If you still want external changes (e.g. suggestion click) to update prompt:
                          ///dispatch(setPromptRed(value));
                          setPrompt(value);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label=""
                            // Trigger Notepad on focus/click

                            onClick={(e: any) => {
                              // âœ… get caret first
                              handlePromptShellCaret(e);

                              setIsMobileBackActive(true);
                              setIsNotepadOpen(true);
                            }}
                            onBlur={() => {
                              // let dialog manage UX; no need to auto-close here
                              setIsMobileBackActive(false);
                            }}
                            variant="filled"
                            fullWidth
                            multiline
                            minRows={matchMobile ? 3 : 2}
                            value={prompt}
                            placeholder={
                              type === 0
                                ? (GeneratedImage.length > 0
                                  ? "Remix image into 1â€“9 creative scenes."
                                  : "Describe 1â€“9 Creative scenes.")
                                : type === 1
                                  ? (GeneratedImage.length > 0
                                    ? "Reimagine image in new story beats."
                                    : "Speak or type a storyâ€”even todayâ€™s news.")
                                  : type === 2
                                    ? "Ask anythingâ€”Iâ€™ll reply with a friendly audio (with live context)."
                                    : type === 3
                                      ? "Describe 3-9 reveal moments for your interaction."
                                      : "Search anythingâ€”I can use current data."
                            }
                            helperText={error || `${prompt.length} / ${maxCharacters} characters`}
                            error={Boolean(error)}
                            slotProps={{
                              htmlInput: {
                                ...params.inputProps,
                                readOnly: true, // <-- important: editing happens in Notepad dialog
                                maxLength: maxCharacters,
                                "aria-label": "Prompt Input",
                                onKeyDown: (e: any) => {
                                  // Optional: prevent typing in shell
                                  e.preventDefault();
                                },
                                autoCorrect: "on",
                                spellCheck: true,
                                autoCapitalize: "sentences",
                                autoComplete: "off",
                              },
                            }}
                            sx={{
                              "& .MuiFilledInput-root": { backgroundColor: "transparent" },
                              "& .MuiFilledInput-root:hover": { backgroundColor: "transparent" },
                              "& .MuiFilledInput-root.Mui-focused": { backgroundColor: "transparent" },
                              "& .MuiInputBase-root:focus": { outline: "none" },
                              "& .MuiInputBase-input:focus-visible": { outline: "none" },
                              "& .Mui-focused": { outline: "none" },
                              "& .MuiInputBase-input": {
                                color: darkMode ? "#ffffff" : "#000000",
                                fontSize: matchMobile ? "1.2rem" : "1.3rem",
                                caretColor: "transparent", // no caret in shell
                              },
                              "& .MuiInputLabel-root": {
                                color: darkMode ? "#ffffff" : "#000000",
                              },
                              "& .MuiFormHelperText-root": {
                                color: error ? "#f44336" : darkMode ? "#ffffff" : "#000000",
                              },
                              /* kill the filled-input underline (default, hover & focus) */
                              "& .MuiFilledInput-root:before": {
                                borderBottom: "none !important",
                              },
                              "& .MuiFilledInput-root:hover:before": {
                                borderBottom: "none !important",
                              },
                              "& .MuiFilledInput-root:after": {
                                borderBottom: "none !important",
                              },
                              "& .MuiFilledInput-root.Mui-focused:after": {
                                borderBottom: "none !important",
                              },
                              opacity: isNotepadOpen ? "0.03" : "1",
                              /// backgroundColor: "rgb(255,255,255,0)",
                              zIndex: 0,
                              maxHeight: matchMobile ? "18vh" : "14vh",
                              overflow: "auto",

                            }}
                          />

                        )}
                      />
                    </Box>

                    {/* RIGHT: Notepad panel trigger + dialog host */}

                    <Notepad
                      //hide={false}
                      mode={1}
                      Caret={Caret}
                      handleKeyDown={handleKeyDown}
                      TextFieldactive={TextFieldactive}
                      setTextFieldactive={setTextFieldactive}

                      GeneratedImage={GeneratedImage}
                      panel
                      type={type}
                      placeholder={
                        type === 0
                          ? (GeneratedImage.length > 0
                            ? "Remix image into 1â€“9 creative scenes."
                            : "Describe 1â€“9 Creative scenes.")
                          : type === 1
                            ? (GeneratedImage.length > 0
                              ? "Reimagine image in new story beats."
                              : "Speak or type a storyâ€”even todayâ€™s news.")
                            : type === 2
                              ? "Ask anythingâ€”Iâ€™ll reply with a friendly audio (with live context)."
                              : type === 3
                                ? "Describe 3-9 reveal moments for your interaction."
                                : "Search anythingâ€”I can use current data."
                      }
                      setIsNotepadOpen={setIsNotepadOpen}
                      darkMode={darkModeReducer}
                      size={matchMobile ? "small" : "medium"}
                      open={isNotepadOpen}
                      value={prompt}
                      onChange={(v) => setPrompt(v)}
                      musicMode={Boolean(promptMusicUrl)}
                      musicUrl={promptMusicUrl}
                      musicName={promptMusicName}
                      musicBreakerSec={promptMusicBreakerSec}
                      onMusicBreakerChange={setPromptMusicBreakerSec}
                      onMusicSceneCountChange={setPromptMusicSceneCount}
                      onMusicSegmentsChange={setPromptMusicSegments}
                      onClose={() => {
                        setIsNotepadOpen(false);
                        setIsMobileBackActive(false);
                      }}

                      hide={parsedKeyPoints.length > 1 ? true : false}
                      onSpeak={() => {
                        console.log("Speak / mic with prompt:", prompt);
                      }}
                      showTemplates
                      cachedImageGen={genCache}
                      onUpdateCachedImageGen={setGenCache}
                    />
                  </>
                )}
              </Box>



            </>
        }

        {/* CLOSE ICON  modelz */}
        <IconButton
          onClick={() => {

            setRemixData('');
            setWorldCover('');

            handleCloseOverlay();

            setflip(false);
          }}
          sx={{
            position: "fixed",
            top: matchMobile ? '23vh' : '20vh',
            right: 12,
            color: darkMode ? "#ffffff" : "#000000",
            zIndex: 30,
            display: GeneratedImageFlux && type === 0 ? 'none' : 'none'
          }}
        >



          <CloseIcon style={{ fontSize: "2rem", opacity: 0.3 }} />
        </IconButton>
        {

          fluxLoaded && type === 0 || fluxLoaded && type === 1 || fluxLoaded && type === 3 ?
            <Box
              sx={{
                display: (GeneratedImageFlux || parsedKeyPoints.length > 0) ? "none" : (!minimisePrompt ? "flex" : "none"),
                position: { sm: "relative" },
                minHeight: { sm: (GeneratedImageFlux || parsedKeyPoints.length > 0) ? 0 : "17vh" },
                width: "100%",
                gap: 1,
                alignItems: "center",
                justifyContent: "center",
                mt: { sm: "2vh" },
                px: { xs: 1, sm: 3 },
                py: 1
              }}
            >

              {/* PC-only: title selector pinned to the far-left edge */}
              {planInfo === 0 && parsedKeyPoints.length === 0 && !minimisePrompt && GeneratedImage.length === 0 && (
                <Box sx={{ display: { xs: "none", sm: "flex" }, position: "absolute", left: 24, top: "calc(50% + 2vh)", transform: "translateY(-50%)", alignItems: "center" }}>
                  <TitleSelector inline isBlinking={isBlinking} onCancel={cancelCountdown} buttonTheme={buttonTheme} />
                </Box>
              )}

              {/* main buttons (always dead-center on PC) */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  width: { xs: "100%", sm: "auto" },
                  justifyContent: "center",
                  position: { sm: "absolute" },
                  left: { sm: "50%" },
                  top: { sm: "calc(50% + 2vh)" },
                  transform: { sm: "translate(-50%, -50%)" },
                }}
              >

                <Button
                  variant="contained"
                  disableRipple
                  disableFocusRipple
                  onClick={() => {
                    if (isBlinking) cancelCountdown();
                    setOpen(true);
                  }}
                  sx={{
                    flex: { xs: "0 0 auto", sm: "0 0 auto" },
                    minWidth: { xs: "30%", sm: "auto" },
                    px: { sm: 3 },
                    fontSize: { xs: "0.65rem", sm: "0.8rem" },

                    /* professional glass base */
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textShadow: "none",
                    height: { xs: '38px', sm: '44px' },

                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",
                    animation: isBlinking ? `${blinkOutline} 1s infinite` : "none",

                    transition:
                      "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",

                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                    /* ---------- reflection overlay ---------- */
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
                      opacity: 0,                      // hidden until hover / press
                      pointerEvents: "none",
                    },

                    /* ---------- hover ---------- */
                    "&:hover": {
                      background: buttonTheme.hoverBg,
                      color: buttonTheme.hoverText,
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                      transform: "translateY(0)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.8s ease-out forwards`,
                      },
                    },

                    /* ---------- active ---------- */
                    "&:active": {
                      background: "rgba(5, 5, 5, 0.55)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                      transform: "translateY(0)",
                      color: darkMode ? "#ffffff" : "#000000",
                      "&::before": {
                        opacity: 0.9,
                        animation: `${glassSweep} 1.1s ease-out forwards`,
                      },
                    },
                  }}
                >

                  {
                    prettyLabel === "Imagenx" ? (
                      renderPretty("Imagenx", "Imagen")
                    ) :
                      prettyLabel === "Gpt Image" ? (
                        renderPretty("Gpt Image", "GPT")
                      ) : prettyLabel === "FluxDev" ? (
                        renderPretty("FluxDev", "Reve")
                      ) : prettyLabel === "Imagen" ? (
                        renderPretty("Imagen", "Banana 2")
                      ) : prettyLabel === "Imagen2" ? (
                        renderPretty("Imagen2", "Banana")
                      ) : prettyLabel === "FluxUltra" ? (
                        renderPretty("FluxUltra", "Max")
                      ) : prettyLabel === "FluxUltra2" ? (
                        renderPretty("FluxUltra2", "Pro")
                      ) : prettyLabel === "Minimax2" ? (
                        renderPretty("Minimax2", "See 4")
                      ) : prettyLabel === "Minimax" ? (
                        renderPretty("Minimax", "See 4.5")

                      ) : prettyLabel === "Schnell" ? (
                        renderPretty("Schnell", "Klein")

                      ) : (
                        renderPretty(prettyLabel, prettyLabel)
                      )
                  }

                </Button>

                <ModelSelectionModal
                  open={open}
                  setOpen={setOpen}
                  handleSelect={handleSelect}
                  updateModelWithoutClosing={(name: string) => {
                    dispatch(setModel(name));
                    setModelz(name);
                  }}
                  activeModelName={modelz}

                  // Pass Data
                  models={models}
                  currentImage={GeneratedImage.length > 0 ? GeneratedImage[0] : ''}

                  // Styles & Environment
                  darkModeReducer={darkModeReducer}
                  matchMobile={matchMobile}
                  darkMode={darkMode}

                  // Config
                  gradient={GRADIENT}
                  labelsByIndex={LABEL_BY_INDEX}
                  colorsByLabel={COLOR_BY_LABEL}
                />



                {/* Image upload button */}
                <Button
                  variant="contained"
                  onClick={() => {
                    setShowWorldModel(true)
                  }}
                  disableRipple
                  disableFocusRipple
                  sx={{
                    /* premium glass skin */
                    background: darkMode
                      ? "linear-gradient(135deg, rgba(20,20,20,0.5) 0%, rgba(10,10,10,0.2) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)",
                    backdropFilter: "blur(40px) saturate(180%)",
                    color: darkMode ? "#ffffff" : "#000000",
                    textShadow: "none",
                    height: { xs: '48px', sm: '56px' },
                    width: { xs: '48px', sm: '56px' },
                    minWidth: { xs: '48px', sm: '56px' },
                    padding: 0,
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.6)",
                    borderRadius: 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.3)" : "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                    transform: "translateY(-2px)",
                    transition:
                      "background 250ms ease, box-shadow 250ms ease, transform 120ms ease, border 250ms ease",
                    position: "relative",
                    overflow: "hidden",

                    "&:hover": {
                      background: darkMode
                        ? "linear-gradient(135deg, rgba(30,30,30,0.6) 0%, rgba(20,20,20,0.3) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 100%)",
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.4)" : "0 8px 32px 0 rgba(31, 38, 135, 0.12)",
                      transform: "translateY(0)",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(255, 255, 255, 0.6)", // clean white rim on hover
                    },

                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0
                        ? "none"
                        : "block",
                  }}
                >
                  <AssignmentIndIcon style={{ fontSize: '1.8rem', display: 'block', margin: 'auto', }} />
                </Button>


                {/* Action button */}
                <Button
                  variant="contained"
                  onClick={handleStartSubmit}
                  color="inherit"
                  disableRipple
                  disableFocusRipple
                  sx={{
                    /* ------------- premium glassmorphism CREATE button ------------- */
                    flex: { xs: 1, sm: "0 0 auto" },
                    minWidth: { sm: "360px" },
                    fontSize: { xs: "0.65rem", sm: "0.8rem" },
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textShadow: "none",
                    height: { xs: '38px', sm: '44px' },
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",

                    transition:
                      "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",
                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                    /* ---------- (NEW) container + hidden overlay ---------- */
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
                      opacity: 0,                       // invisible until hover/active
                      pointerEvents: "none",
                    },

                    /* ---------- focus highlight  del (unchanged) ---------- */
                    "&:focus, &:focus-visible, &.Mui-focusVisible": {
                      outline: "none",
                      boxShadow: "none",
                      backgroundColor: darkMode
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(255,255,255,0.10)",
                      color: darkMode ? "#ffffff" : "#000000",
                    },

                    /* ---------- hover ---------- */
                    "&:hover": {
                      outline: "none",
                      background: buttonTheme.hoverBg,
                      color: buttonTheme.hoverText,
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                      transform: "translateY(0)",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.8s ease-out forwards`,
                      },
                    },

                    /* ---------- active ---------- */
                    "&:active": {
                      background: "rgba(5, 5, 5, 0.55)",
                      boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                      transform: "translateY(0)",
                      color: darkMode ? "#ffffff" : "#000000",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.2s ease-out forwards`,
                      },
                    },

                    WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                    "::-moz-focus-inner": { border: 0 },
                  }}
                >


                  <span style={{
                    display:
                      allowSpin ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%'
                  }}>
                    {countdown !== null ? (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: darkModeReducer ? "#E8BAFA" : "#000000",
                        '@keyframes fadeText': {
                          '0%': { opacity: 0.2 },
                          '100%': { opacity: 1 }
                        },
                        animation: 'fadeText 0.6s infinite alternate'
                      }}>
                        {countdown}
                      </Box>
                    ) : (
                      (type === 0 ? "Create" : type === 1 ? "Visualize" : type === 2 ? "Speak" : type === 3 ? "Create" : "Go")
                    )}

                  </span>

                  <span style={{
                    display:
                      allowSpin ? 'inline' : 'none',

                    opacity: blinkOn ? 1 : 0.35,
                    transition: "opacity 250ms linear",
                  }}>
                    {planInfo > 1 ? 'Running...' : '...'}

                  </span>


                </Button>




                {/* Action button */}


                <IconButton
                  onClick={async () => {
                    if (isBlinking) cancelCountdown();


                    /// GeneratedImage
                    setGeneratedImage([]);
                    setVipcharacters([]);
                    setstopFeeds(false);
                    setminimisePrompt(true);

                    setRemixData('');
                    setWorldCover('');

                    handleCloseOverlay();

                  }}
                  aria-label="close"
                  color="inherit"
                  disableRipple
                  disableFocusRipple
                  sx={{
                    width: { xs: '38px', sm: '44px' },
                    height: { xs: '38px', sm: '44px' },

                    /* professional glass base */
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textShadow: "none",
                    padding: 0,
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: 2,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",

                    transition:
                      "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",

                    display:
                      GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "inline-flex",

                    /* âœ¨ sweep overlay (invisible until hover/press) */
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

                    /* focus cue (unchanged) */
                    "&:focus, &:focus-visible, &.Mui-focusVisible": {
                      outline: "none",
                      boxShadow: "none",
                      backgroundColor: "rgba(255,255,255,0.007)",
                    },

                    WebkitTapHighlightColor: "transparent",
                    "::-moz-focus-inner": { border: 0 },

                    /* hover */
                    "&:hover": {
                      background: buttonTheme.hoverBg,
                      color: buttonTheme.hoverText,
                      boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                      transform: "translateY(0)",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.8s ease-out forwards`,
                      },
                    },

                    /* active */
                    "&:active": {
                      background: "rgba(5, 5, 5, 0.55)",
                      boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                      transform: "translateY(0)",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                      "&::before": {
                        opacity: 0.8,
                        animation: `${glassSweep} 1.2s ease-out forwards`,
                      },
                    },
                  }}
                >
                  <CloseIcon />
                </IconButton>

              </Box>

              {/* PC-only: aspect-ratio selector at the far-right end */}
              {planInfo === 0 && parsedKeyPoints.length === 0 && !minimisePrompt && GeneratedImage.length === 0 && (
                <Box sx={{ display: { xs: "none", sm: "flex" }, position: "absolute", right: 24, top: "calc(50% + 2vh)", transform: "translateY(-50%)", alignItems: "center" }}>
                  <AspectRatioBox inline models={models} isBlinking={isBlinking} onCancel={cancelCountdown} />
                </Box>
              )}

            </Box >

            :

            <Box
              sx={{
                display: showButton && !minimisePrompt ? 'flex' : 'none',
                width: '100%',
                maxWidth: { sm: '50%' }, // PC: cap button bar at half-width
                mx: { sm: 'auto' }, // PC: center the bar
                gap: 1, // Adds spacing between the two buttons
                alignItems: 'center',
                px: 1, // Optional: padding on the container so buttons don't touch the screen edges

              }}
            >


              {/* Right Button: Compute / Action Button */}
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartSubmit}
                sx={{
                  flex: 1,
                  marginTop: "0px",

                  /* liquid-glass base */
                  background: buttonTheme.bg,
                  backdropFilter: "blur(24px) saturate(120%)",
                  color: buttonTheme.text,
                  height: { xs: '38px', sm: '44px' }, // Compact mobile!

                  border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                  borderRadius: 12,
                  boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                  transform: "translateY(-2px)",

                  transition:
                    "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",

                  display:
                    GeneratedImageFlux || parsedKeyPoints.length > 0 ? "none" : "block",

                  /* === custom focus highlight === */
                  "&:focus, &:focus-visible, &.Mui-focusVisible": {
                    outline: "none",
                    boxShadow: "none",
                    backgroundColor: "rgba(255,255,255,0.10)",
                  },

                  "&:hover": {
                    outline: "none",
                    background: buttonTheme.hoverBg,
                    color: buttonTheme.hoverText,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                    transform: "translateY(0)",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                  },
                  "&:active": {
                    background: "rgba(5, 5, 5, 0.55)",
                    boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                    transform: "translateY(0)",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                  },

                  /* remove mobile tap rectangle */
                  WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                  /* remove Firefox inner border */
                  "::-moz-focus-inner": { border: 0 },
                }}
              >
                {countdown !== null ? (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: darkModeReducer ? "#E8BAFA" : "#0099cc",
                    '@keyframes fadeText2': {
                      '0%': { opacity: 0.2 },
                      '100%': { opacity: 1 }
                    },
                    animation: 'fadeText2 0.6s infinite alternate'
                  }}>
                    {countdown}
                  </Box>
                ) : (
                  (type === 0
                    ? 'Create'
                    : type === 1
                      ? 'Visualize'
                      : type === 2
                        ? 'Speak'
                        : type === 3
                          ? 'Create' : 'Go')
                )}
              </Button>
            </Box>

        }

        {
          error && (
            <Box mt={1}>
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            </Box>
          )
        }

        {/* **Image Display Container** */}
        <Box
          mt={4}
          display="flex"
          justifyContent="center"
          position="relative"
          sx={{ width: '100%', maxWidth: 600, margin: '0 auto' }} // Ensure consistent width
        >





          {isSubmitting && type === 0 && (
            <Box
              sx={{
                position: "absolute",
                top: matchMobile ? '-10vh' : "-8vh",
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,.35)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                zIndex: 3,

              }}
            >
              <CircularProgress
                variant="determinate"
                value={loader}
                size={44}
                thickness={4}
                sx={{ color: 'yellow' }} // or any custom color you prefer
              />

              {/* numeric label (optional) */}


              <Typography
                sx={{
                  mt: 1,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  fontFamily: "sans-serif",
                  textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)", // strong shadow for contrast
                }}
              >
                {loader}%
              </Typography>

            </Box>
          )}


          {/* **Generated Image** */}
          {



            parsedKeyPoints.length > 0 ?
              null
              :

              GeneratedImage.length > 0 || worldCover ? (
                <>
                  {/* PlanSteps was moved into the center div to replace Thinking */}

                  {/* WRAPPER: Handles positioning and size */}
                  <Box
                    sx={{
                      position: "relative",
                      width: big ? "44%" : "34%",
                      display: GeneratedImageFlux ? "none" : "block",
                      mr: GeneratedImage.length > 1 ? 4 : 0,
                      mb: GeneratedImage.length > 1 ? 2 : 0,
                    }}
                  >
                    {GeneratedImage.slice(-3).map((imgUrl: any, index: any, array: any) => {
                      const isTop = index === array.length - 1;
                      const offset = (array.length - 1) - index;

                      return (
                        <Box
                          key={imgUrl + index}
                          component="img"
                          src={imgUrl}
                          alt="Generated"
                          loading="lazy"
                          sx={{
                            position: isTop ? "relative" : "absolute",
                            top: 0,
                            left: 0,

                            width: "100%",
                            height: "auto",
                            borderRadius: 2,
                            objectFit: "cover",

                            zIndex: index + 1,

                            transformOrigin: "bottom left",
                            transform: isTop
                              ? "none"
                              : `translateX(${offset * 25}px) rotate(${offset * 6}deg) scale(${1 - offset * 0.05})`,

                            filter: isTop ? "none" : `brightness(${1 - offset * 0.1}) contrast(0.9)`,

                            boxShadow: isTop ? 4 : 1,
                            transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                            cursor: "pointer",
                          }}
                        />
                      );
                    })}

                    {/* âœ… WORLD COVER (circular, on top of the stack) */}
                    {worldCover && (
                      <Box
                        component="img"
                        src={worldCover}
                        alt="World Cover"
                        loading="lazy"
                        sx={{
                          position: "absolute",
                          bottom: matchMobile ? GeneratedImage.length > 0 ? '50%' : "-18vh" : GeneratedImage.length > 0 ? '50%' : "-15vh",
                          left: matchMobile ? GeneratedImage.length > 0 ? '5%' : "97%" : GeneratedImage.length > 0 ? '5%' : "37%",
                          transform: "translateX(-50%)",
                          width: '100px',
                          height: '100px',
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #fff",
                          boxShadow: 4,
                          zIndex: 50, // above cards + badge
                          backgroundColor: "#000",
                        }}
                      />
                    )}

                    {/* THE COUNT BADGE */}
                    {GeneratedImage.length > 0 && (
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: -10,
                          right: -15,
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          bgcolor: "#000",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          border: "2px solid #fff",
                          zIndex: 10,
                          boxShadow: 3,
                          pointerEvents: "none",
                        }}
                      >
                        {GeneratedImage.length}
                      </Box>
                    )}
                  </Box>

                </>
              ) : null}

          {/* **Generated Image Flux** */}
          {

            parsedKeyPoints.length > 0 ?
              null : GeneratedImageFlux && (
                <Box
                  component="img"
                  src={GeneratedImageFlux}
                  alt="Generated Flux"
                  loading="lazy"
                  onClick={handleImageClick} // Allow toggling between images
                  sx={{
                    width: big ? '50%' : "34%",
                    height: "auto",
                    borderRadius: 2,


                    // border: "1px solid #ccc",
                    /// boxShadow: 3,
                    objectFit: "cover",
                    zIndex: 2, // Base z-index
                    cursor: "pointer",
                    transition: "z-index 0.3s ease",
                    filter: isFluxOnTop ? 'blur(0px)' : 'blur(0px)', // Consistent blur

                  }}
                />
              )}


          {big && GeneratedImageFlux ? (
            <Box
              onClick={() => {


                setstartEdit(true);
              }}

              sx={{
                cursor: 'pointer',
                position: "absolute",
                top: '12%',
                left: '0px',
                width: "100%",
                height: "0px",
                backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3, // Above overlay and images
                borderRadius: 2,
                fontSize: '3vh',
                fontWeight: "bold",
                color: "#ffffff", // Text color
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)" // Text shadow for visibility
              }}
            >
              <EditIcon sx={{ mr: 1, fontSize: "inherit" }} />
              Edit
            </Box>

          ) : null}

          {/* **Loader Overlay Within Image Area** */}
          {audioLoad && type === 2 && (
            <Box
              sx={{
                position: "absolute",
                top: '-10.2vh',
                left: 0,
                width: "100%",
                height: "100%",
                /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3, // Above overlay and images
                borderRadius: 2,
              }}
            >
              <CircularProgress />
            </Box>
          )}


        </Box>

        {
          GeneratedImageFlux ?
            <Button
              onClick={() => {
                // uploadAllImagesToS3();
                GenerateSignedUrl(GeneratedImageFluxBlob, enhancedPromptx, loggedUser);
              }}
              variant="contained"
              color="inherit"         /* avoid theme-blue */
              disableRipple
              disableFocusRipple
              sx={{
                /* keep your sizing */
                width: "100%",
                flex: 1,
                mt: "3px",

                /* â”€â”€ liquid-glass design â”€â”€ */
                background: darkMode
                  ? "rgba(25,25,25,0.25)"
                  : "rgba(255,255,255,0.25)",
                color: darkMode ? "#ffffff" : "#000000",
                ...buttonPadding,

                border: "none",
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.8)",
                transform: "translateY(-2px)",



                transition:
                  "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",

                display: "block",

                /* hover / press */
                "&:hover": {
                  background: darkMode
                    ? "rgba(25,25,25,0.35)"
                    : "rgba(255,255,255,0.35)",
                  transform: "translateY(0)",
                },
                "&:active": {
                  background: darkMode
                    ? "rgba(25,25,25,0.45)"
                    : "rgba(255,255,255,0.45)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                  transform: "translateY(0)",
                },

                /* custom focus tint (no blue outline) */
                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                  outline: "none",
                  boxShadow: "none",
                  backgroundColor: "rgba(255,255,255,0.10)",
                },
                WebkitTapHighlightColor: "transparent",
                "::-moz-focus-inner": { border: 0 },
              }}
            >
              Save
            </Button>


            : null
        }

        {minimisePrompt || GeneratedImage.length > 0 ? null :


          parsedKeyPoints.length === 0 ?

            planInfo === 0 ?


              <Box sx={{ display: { xs: "block", sm: "none" } }}>


                <AspectRatioBox models={models} isBlinking={isBlinking} onCancel={cancelCountdown} />
                <TitleSelector isBlinking={isBlinking} onCancel={cancelCountdown} buttonTheme={buttonTheme} />

              </Box>
              :

              null


            : null
        }






        {
          parsedKeyPoints.length > 0 ?
            <Storybook
              buttonTheme={buttonTheme}
              Vipcharacters={Vipcharacters}
              setVipcharacters={setVipcharacters}
              setNanoImages={setNanoImages}
              nanoImages={nanoImages}
              showWorldModel={showWorldModel}
              setShowWorldModel={setShowWorldModel}
              stagePromptCache={stagePromptCache}
              allowgetImage={allowgetImage}
              setallowgetImage={setallowgetImage}
              setSteps2={setParsedKeyPoints2}
              steps2={parsedKeyPoints2}
              allowSpin={allowSpin}
              setminimisePrompt={setminimisePrompt}
              stopFeeds={stopFeeds}
              ImagesHdCloud={ImagesHdCloud}
              setImagesHdCloud={setImagesHdCloud}

              VideMode={VideMode}
              setVideMode={setVideMode}


              selectedStyle={selectedStyle}

              setGeneratedImage={setGeneratedImage}
              timeoutsDisabledRef={timeoutsDisabledRef}
              timeoutRefsxp={timeoutRefsxp}
              destroyAllFluxCalls={destroyAllFluxCalls}
              referenceImages={referenceImages}
              setReferenceImages={setReferenceImages}
              detectedCharacters={detectedCharacters}
              detectedEnvironments={detectedEnvironments}
              DummyMode={DummyMode}
              setDummyMode={setDummyMode}
              Seed={Seed}
              PostId={PostId}
              setPostId={setPostId}
              GenerateSignedUrl={GenerateSignedUrl}
              type={type}
              isMenuOpen={isMenuOpen}
              Planx={Planx}
              modelz={modelz}
              generatedImagesFlux={generatedImagesFluxx}
              setGeneratedImagesFlux={setGeneratedImagesFluxx}
              loadersArray={loadersArray}
              setLoadersArray={setLoadersArray}
              GotIm={GotIm}
              setStopText={setStopText}
              GeneratedImage={GeneratedImage}
              stepsx={parsedKeyPointsb} setStepsx={setParsedKeyPointsb}
              steps={parsedKeyPoints} setSteps={setParsedKeyPoints} prompt={prompt} isSubmittingKick={isSubmittingKick} setIsSubmittingKick={setIsSubmittingKick}
              musicMode={Boolean(promptMusicUrl)}
              musicModeUrl={promptMusicUrl}
              musicModeName={promptMusicName}
              musicBreakerSec={promptMusicBreakerSec}
              musicSegments={promptMusicSegments}
              setcallFeeds={setcallFeeds}
              handleCloseOverlay={handleCloseOverlay}
              CreationMode={CreationMode} setCreationMode={setCreationMode}
              magicMode={magicMode}
              minimizeMode={minimizeMode}
              setMinimizeMode={setMinimizeMode}
              onAllPromptsGenerated={handlePromptsFinished}
              onSaveVisibilityChange={setIsSaveButtonVisible}
              isAudioDirty={isAudioDirty}
              setIsAudioDirty={setIsAudioDirty}
              audioSceneStatuses={audioSceneStatuses}
              setAudioSceneStatuses={setAudioSceneStatuses}
              isAudioGenerating={isAudioGenerating}
              setIsAudioGenerating={setIsAudioGenerating}
              isBShotModeActive={isBShotModeActive}
              setIsBShotModeActive={setIsBShotModeActive}
              generatedAudios={generatedAudios}
              setGeneratedAudios={setGeneratedAudios}
              generatedAudioTexts={generatedAudioTexts}
              setGeneratedAudioTexts={setGeneratedAudioTexts}
              bShotImages={bShotImages}
              setBShotImages={setBShotImages}
              bShotVideos={bShotVideos}
              setBShotVideos={setBShotVideos}
              bShotPrompts={bShotPrompts}
              setBShotPrompts={setBShotPrompts}
              bShotTextVideo={bShotTextVideo}
              setBShotTextVideo={setBShotTextVideo}
              bShotNanoImages={bShotNanoImages}
              setBShotNanoImages={setBShotNanoImages}
            /> : null
        }


        <WorldModel
          setWorldStyle={setWorldStyle}
          setRemixData={setRemixData}
          setWorldCover={setWorldCover}


          selectedImages={GeneratedImage}

          // Pass the toggle function
          handleSelection={handleToggleGeneratedImage}
          PostId={PostId}
          selectedStyle={selectedStyle}
          Seed={Seed}
          mode={0}
          open={showWorldModel}
          onClose={() => setShowWorldModel(false)}

          // Data Props
          steps={parsedKeyPoints}
          ImagesHdCloud={ImagesHdCloud}
          GeneratedText={[]}
          Planx={Planx}
          GeneratedImageFirst={generatedImagesFluxx[0]}
          // Action Props
          handleFileChange={handleFileChange} // <--- Pass your existing file handler here

          // UI Props
          darkMode={darkModeReducer}
          matchMobile={matchMobile}
          modelz={modelz}
          GeneratedImageFlux={generatedImagesFluxx} // or whatever state tracks generation
          parsedKeyPoints={parsedKeyPoints} // or [] if not available in this scope
          Vipcharacters={Vipcharacters}
          setVipcharacters={setVipcharacters}
        />

        {/* â”€â”€â”€â”€â”€â”€ VIP CHARACTER POPUP â”€â”€â”€â”€â”€â”€ */}
        <Modal
          open={showVipPopup}
          onClose={() => setShowVipPopup(false)}
          aria-labelledby="vip-popup-title"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            bgcolor: darkModeReducer ? '#121212' : '#ffffff',
            color: darkModeReducer ? '#ffffff' : '#000000',
            borderRadius: 3, boxShadow: 24, p: 4,
            display: 'flex', flexDirection: 'column', gap: 3,
            border: darkModeReducer ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'
          }}>
            <Typography id="vip-popup-title" variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
              Character Details
            </Typography>

            {vipImageTemp && (
              <Box sx={{ width: '100%', height: 150, borderRadius: 2, overflow: 'hidden', display: 'flex', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.5)' }}>
                <img src={vipImageTemp} alt="Uploaded" style={{ height: '100%', objectFit: 'contain' }} />
              </Box>
            )}

            <TextField
              label="Image Name"
              variant="outlined"
              fullWidth
              value={vipName}
              onChange={(e) => setVipName(e.target.value)}
              InputLabelProps={{ style: { color: darkModeReducer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' } }}
              InputProps={{ style: { color: darkModeReducer ? '#fff' : '#000' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' },
                  '&:hover fieldset': { borderColor: darkModeReducer ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' },
                }
              }}
            />
            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={vipDescription}
              onChange={(e) => setVipDescription(e.target.value)}
              InputLabelProps={{ style: { color: darkModeReducer ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' } }}
              InputProps={{ style: { color: darkModeReducer ? '#fff' : '#000' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' },
                  '&:hover fieldset': { borderColor: darkModeReducer ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' },
                }
              }}
            />
            <Button
              variant="contained"
              disabled={isVipUploading || !vipName.trim() || !vipDescription.trim()}
              onClick={async () => {
                if (!vipBlobTemp) return;
                setIsVipUploading(true);
                try {
                  const publicUrl = await putToS3(vipBlobTemp);

                  if (vipImageTemp.startsWith('blob:')) {
                    URL.revokeObjectURL(vipImageTemp);
                  }

                  console.log('attached image to prompt url', publicUrl);
                  setGeneratedImage((prev: any) => [...prev, publicUrl]);
                  setGotIm(true);

                  const newVip = { name: vipName, description: vipDescription, imageUrl: publicUrl };
                  setVipcharacters((prev) => [...prev, newVip]);
                  setShowVipPopup(false);
                  setVipName('');
                  setVipDescription('');
                  setVipBlobTemp(null);
                  setVipImageTemp('');
                } catch (err) {
                  console.error("Upload failed", err);
                  alert("Failed to upload character image");
                } finally {
                  setIsVipUploading(false);
                }
              }}
              sx={{
                background: darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.8)",
                color: "#fff",
                py: 1.5,
                borderRadius: 2,
                "&:hover": {
                  background: darkModeReducer ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,1)",
                }
              }}
            >
              {isVipUploading ? <CircularProgress size={24} color="inherit" /> : "Create Character"}
            </Button>
          </Box>
        </Modal>


        {/* â”€â”€â”€â”€â”€â”€ PATH CHOICE OVERLAY â”€â”€â”€â”€â”€â”€ */}
        {showPathChoiceOverlay && (
          <Box sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Top 50% - Result scenes */}
            <Box className="hide-scrollbar" sx={{
              height: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              overflowX: 'auto',
              p: 4,
              width: '100vw'
            }}>
              <style>{`
                  @keyframes pulsate {
                      0% { transform: scale(1); opacity: 0.3; }
                      50% { transform: scale(1.2); opacity: 0.1; }
                      100% { transform: scale(1); opacity: 0.3; }
                  }
                  .go-pulsate {
                      animation: pulsate 2s infinite ease-in-out;
                  }
                  .hide-scrollbar::-webkit-scrollbar {
                      display: none;
                  }
                  .hide-scrollbar {
                      -ms-overflow-style: none;
                      scrollbar-width: none;
                  }
                `}</style>
              {parsedKeyPoints.map((sceneText, i) => {
                const img = nanoImages[i];
                const isImageLarge = expandedChoiceScene > 0;
                const isTextLarge = expandedChoiceScene === 2;
                return (
                  <Box
                    key={i}
                    onClick={() => {
                      if (expandedChoiceScene === 2) {
                        setExpandedChoiceScene(1);
                      } else {
                        setExpandedChoiceScene(expandedChoiceScene === 1 ? 0 : 1);
                      }
                    }}
                    sx={{
                      position: 'relative',
                      height: isImageLarge ? { xs: '110%', sm: '120%' } : { xs: '70%', sm: '85%' },
                      flexShrink: 0,
                      borderRadius: 3,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      maxWidth: '80vw',
                      aspectRatio: img ? 'auto' : '1/1.5',
                      bgcolor: img ? 'transparent' : 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: img ? 'none' : '1px dashed rgba(255,255,255,0.2)'
                    }}
                  >
                    {img ? (
                      <img src={img} alt={`Scene ${i + 1}`} style={{ height: '100%', width: 'auto', display: 'block', objectFit: 'contain' }} />
                    ) : (
                      <div className="go-pulsate" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    )}
                    {!((window.location.pathname.includes('kickit') || type === 1) && i % 2 !== 0) && (
                      <Box className="hide-scrollbar"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (expandedChoiceScene === 2) {
                            setExpandedChoiceScene(1);
                          } else {
                            setExpandedChoiceScene(2);
                          }
                        }}
                        sx={{
                          position: 'absolute',
                          bottom: 0, left: 0, right: 0,
                          maxHeight: '100%',
                          overflowY: isTextLarge ? 'auto' : 'hidden',
                          background: isTextLarge
                            ? 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.4) 85%, transparent 100%)'
                            : 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                          p: isTextLarge ? { xs: 3, sm: 4 } : 2,
                          pt: isTextLarge ? 12 : 8,
                          transition: 'all 0.3s ease'
                        }}>
                        <Typography sx={{
                          color: '#fff',
                          fontSize: isTextLarge ? { xs: '0.85rem', sm: '0.95rem' } : '0.8rem',
                          fontWeight: 500,
                          display: isTextLarge ? 'block' : '-webkit-box',
                          WebkitLineClamp: isTextLarge ? 'unset' : 2,
                          WebkitBoxOrient: isTextLarge ? 'unset' : 'vertical',
                          overflow: isTextLarge ? 'visible' : 'hidden',
                          textShadow: isTextLarge ? '0 4px 10px rgba(0,0,0,1)' : '0 2px 4px rgba(0,0,0,0.8)'
                        }}>
                          {sceneText}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>

            {/* Bottom 50% - Buttons */}
            <Box sx={{
              height: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: matchMobile ? 'flex-start' : 'center',
              position: 'relative',
              gap: 3,
              pt: matchMobile ? 2 : 0
            }}>
              <div style={{
                width: matchMobile ? '90%' : '50%',
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                zIndex: 100,
              }}>
                <TextField
                  value={planEditText}
                  onChange={(e) => setPlanEditText(e.target.value)}
                  placeholder="Edit generation plan..."
                  multiline
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                  sx={{
                    flex: 1,
                    minHeight: '40px',
                    borderRadius: '20px 0 0 20px',
                    padding: '10px 15px',
                    background: darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    backdropFilter: 'blur(10px)',
                    "& .MuiInputBase-root": {
                      padding: 0,
                    },
                    "& .MuiInputBase-input": {
                      color: darkModeReducer ? "#ffffff" : "#000000", // Text color
                      fontSize: matchMobile ? '0.7rem' : '0.8rem',
                      caretColor: 'auto !important',
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!planEditText.trim()) return;
                    const newPrompt = `Update: '${planEditText}', Original prompt:'${prompt}'`;
                    setPrompt(newPrompt);
                    resetMagicMirror();
                    handleStartSubmit();
                  }}
                  style={{
                    background: darkModeReducer ? "#E8BAFA" : "#0099cc",
                    color: "#fff",
                    border: 'none',
                    borderRadius: '0 20px 20px 0',
                    padding: '0 20px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    zIndex: 2,
                    boxShadow: `4px 4px 15px ${darkModeReducer ? "#E8BAFA" : "#0099cc"}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Go
                </button>
              </div>
              <div style={{
                position: 'relative',
                width: "100%", maxWidth: "500px", display: "flex", justifyContent: "center", alignItems: "center", gap: "15px",
                padding: "0 20px"
              }}>
                {/* Skip Circle  Extract all*/}
                <div style={{ position: 'relative', width: matchMobile ? "90px" : "40%", maxWidth: "160px", aspectRatio: "1/1", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div className="go-pulsate" style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: "rgba(128,128,128,0.5)", opacity: 0.3, zIndex: 0 }} />
                  <button
                    onClick={() => {
                      setShowPathChoiceOverlay(false);
                      handleSkipCharacters();
                    }}
                    style={{
                      position: 'relative',
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: "rgba(128,128,128,0.2)", color: "#fff",
                      border: `2px solid ${darkModeReducer ? "#E8BAFA" : "#0099cc"}55`, fontWeight: 800,
                      fontSize: matchMobile ? "0.9rem" : "1.1rem", cursor: "pointer",
                      transition: "transform 0.2s ease", display: "flex",
                      alignItems: "center", justifyContent: "center", zIndex: 10,
                    }}
                  >
                    Skip
                  </button>
                </div>

                {/* Create Characters Circle */}
                <div style={{ position: 'relative', width: matchMobile ? "130px" : "55%", maxWidth: "220px", aspectRatio: "1/1", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div className="go-pulsate" style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: darkModeReducer ? "#E8BAFA" : "#0099cc", opacity: 0.3, zIndex: 0 }} />
                  <button
                    onClick={() => {
                      setShowPathChoiceOverlay(false);
                      setStudioButtonStage('generating');
                      setShowStudioModal(true);
                      setShowScenesPopup(true);
                      runAutoCastingPipeline();
                    }}
                    style={{
                      position: 'relative',
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: darkModeReducer ? "#E8BAFA" : "#0099cc", color: "#fff", border: "none",
                      fontWeight: 900, fontSize: matchMobile ? "1.1rem" : "1.4rem",
                      cursor: "pointer", boxShadow: `0 15px 40px ${darkModeReducer ? "#E8BAFA" : "#0099cc"}77`,
                      transition: "transform 0.2s ease, box-shadow 0.2s ease", display: "flex",
                      alignItems: "center", justifyContent: "center", zIndex: 10,
                    }}
                  >
                    Create Characters
                  </button>
                </div>
              </div>
            </Box>
          </Box>
        )}

        {/* â”€â”€â”€â”€â”€â”€ CONCEPT GENERATION STUDIO MODAL (Phase 1) â”€â”€â”€â”€â”€â”€ */}
        <Modal
          open={showStudioModal}
          aria-labelledby="studio-modal-title"
          aria-describedby="studio-modal-description"
          style={{ zIndex: 99999 }}
        >
          <Box
            sx={{
              zIndex: 99999,
              position: 'fixed',
              inset: 0, /* covers top, right, bottom, left */
              width: '100vw',
              height: '100dvh',
              bgcolor: darkModeReducer ? 'rgba(15, 15, 18, 0.55)' : '#ffffff',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'majesticFade 0.4s ease-out forwards',
              '@keyframes majesticFade': {
                '0%': { opacity: 0 },
                '100%': { opacity: 1 }
              },
              '@keyframes bounceClick': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(0.85)' }
              }
            }}
          >
            {/* Unified Close / Skip Arrow Down Button */}
            {!showConfirmClose && !(studioButtonStage === 'generating' && !hasStartedCastingRef.current) && (
              <IconButton
                onClick={() => {
                  if (isRevisitingCharacter) {
                    setStudioButtonStage('hidden');
                    setShowStudioModal(false);
                    setShowScenesPopup(false);
                    setIsRevisitingCharacter(false);
                    setSkipCountdown(null);
                    latestCastingIdRef.current = Date.now();
                  } else {
                    handleSkipCharacters();
                  }
                }}
                sx={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  zIndex: 100,
                  width: 44,
                  height: 44,
                  bgcolor: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  '&:hover': {
                    bgcolor: 'rgba(255,50,50,0.6)',
                    transform: 'scale(1.1)'
                  },
                  '&:active': {
                    transform: 'scale(1.3)',
                    animation: 'bounceClick 0.3s ease'
                  }
                }}
              >
                <KeyboardArrowDownIcon style={{ fontSize: '1.5rem', opacity: 0.9 }} />
              </IconButton>
            )}

            {/* STUDIO ACTION BUTTON (TOP MIDDLE / LEFT) */}
            {studioButtonStage !== 'hidden' && (
              <Box sx={{
                position: 'absolute',
                top: { xs: 24, sm: 24 },
                left: { xs: 16, sm: '50%' },
                transform: { xs: 'none', sm: 'translateX(-50%)' },
                width: { xs: 'calc(100vw - 90px)', sm: 'auto' },
                zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1
              }}>
                {skipCountdown === null && (() => {
                  const hasExtractedData = detectedCharacters.length > 0 || detectedEnvironments.length > 0;
                  const hasMissingImages = referenceImages.length === 0 || referenceImages.some(r => r.imageUrl === '' && !r.isGenerating);
                  const isCurrentlyGenerating = referenceImages.some(r => r.isGenerating) || referencePendingCount > 0;

                  return (
                    <Button
                      disableRipple
                      onClick={async () => {
                        // NORMAL FLOW CANCELLATION
                        if (!isRevisitingCharacter && studioButtonStage === 'post-countdown' && skipCountdown === null) {
                          setStudioButtonStage('post-continue');
                          setStudioActionTimer(null);
                          return;
                        }

                        if (!hasExtractedData) {
                          runAutoCastingPipeline();
                        } else if (hasMissingImages && !isCurrentlyGenerating) {
                          setStudioButtonStage('generating');
                          proceedToImageGeneration(detectedCharacters, detectedEnvironments, latestCastingIdRef.current);
                        } else if (!isCurrentlyGenerating) {
                          // Close only if not currently generating and no missing images
                          setStudioButtonStage('hidden');
                          setShowStudioModal(false);
                          setShowScenesPopup(false);
                          setIsRevisitingCharacter(false);
                        }
                      }}
                      disabled={(!isRevisitingCharacter && skipCountdown !== null) && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke'}
                      sx={{
                        bgcolor: (studioButtonStage === 'pre-broke') ? 'rgba(255,50,50,0.1)' : (darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        color: (studioButtonStage === 'pre-broke') ? '#ff4040' : (darkModeReducer ? '#fff' : '#000'),
                        border: `1px solid ${(studioButtonStage === 'pre-broke') ? 'rgba(255,50,50,0.3)' : (darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')}`,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        borderRadius: '30px', px: { xs: 2.5, sm: 4 }, py: { xs: 1, sm: 1.5 },
                        textTransform: 'none', fontSize: { xs: '0.85rem', sm: '1rem' }, fontWeight: 700, letterSpacing: 0.5,
                        transition: 'all 0.3s ease',
                        whiteSpace: { xs: 'normal', sm: 'nowrap' },
                        lineHeight: { xs: 1.3, sm: 1.5 },
                        textAlign: 'left',
                        '&:hover': {
                          bgcolor: (studioButtonStage === 'pre-broke') ? 'rgba(255,50,50,0.2)' : (darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                          transform: 'scale(1.02)'
                        }
                      }}
                    >
                      {(studioButtonStage === 'generating' || isCurrentlyGenerating) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.85rem' }, letterSpacing: 0.5 }}>
                          <span style={{ opacity: 0.7 }}>REFS:</span> <span style={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc", fontWeight: 700 }}>{queuedCastingPrompts.length}</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span style={{ opacity: 0.7 }}>COST:</span> <span style={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc", fontWeight: 700 }}>{studioActionCost}P</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span style={{ opacity: 0.7 }}>BALANCE:</span> <span style={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc", fontWeight: 700 }}>{availablePixels.toLocaleString()}P</span>
                        </Box>
                      )}
                      {(studioButtonStage === 'pre-broke' && !isCurrentlyGenerating) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.82rem' } }}>
                          <span style={{ color: '#ff4040', fontWeight: 800 }}>INSUFFICIENT PIXELS</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span style={{ opacity: 0.7 }}>NEED:</span> <span style={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc", fontWeight: 700 }}>{studioActionCost}P</span>
                        </Box>
                      )}
                      {(!isRevisitingCharacter && studioButtonStage === 'post-countdown' && !isCurrentlyGenerating) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5 } }}>
                          <span style={{ fontWeight: 400, fontSize: '0.9rem', letterSpacing: 1.5 }}>CANCEL SEQUENCE</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span style={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc", fontWeight: 700, fontSize: '1.1rem' }}>{studioActionTimer}s</span>
                        </Box>
                      )}
                      {(!hasExtractedData && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke' && studioButtonStage !== 'post-countdown' && !isCurrentlyGenerating) && (
                        <span style={{ fontWeight: 900, letterSpacing: 2.5 }}>FIND CHARACTERS</span>
                      )}
                      {(hasExtractedData && hasMissingImages && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke' && studioButtonStage !== 'post-countdown' && !isCurrentlyGenerating) && (
                        <span style={{ fontWeight: 900, letterSpacing: 2.5 }}>GENERATE IMAGES</span>
                      )}
                      {(hasExtractedData && !hasMissingImages && studioButtonStage !== 'generating' && studioButtonStage !== 'pre-broke' && studioButtonStage !== 'post-countdown' && !isCurrentlyGenerating) && (
                        <span style={{ fontWeight: 900, letterSpacing: 2.5 }}>CONTINUE</span>
                      )}
                    </Button>
                  );
                })()}
              </Box>
            )}

            {/* Scenes Toggle Button */}
            {!showConfirmClose && !showScenesPopup && (
              <Button
                onClick={() => setShowScenesPopup(true)}
                startIcon={<ForumIcon style={{ fontSize: '1.2rem', opacity: 0.9 }} />}
                sx={{
                  display: 'none', // Hidden per user request
                  position: 'absolute',
                  top: { xs: 'auto', sm: 24 },
                  bottom: { xs: '20vh', sm: 'auto' },
                  left: { xs: 'auto', sm: 24 },
                  right: { xs: 24, sm: 'auto' },
                  transform: { xs: 'none', sm: 'none' },
                  zIndex: 100,
                  minWidth: { xs: 44, sm: 120 },
                  height: 44,
                  px: { xs: 0, sm: 3 },
                  borderRadius: { xs: '50%', sm: '22px' },
                  bgcolor: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  '& .MuiButton-startIcon': {
                    margin: { xs: 0, sm: '0 8px 0 0' }
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.85)',
                    transform: { xs: 'scale(1.1)', sm: 'scale(1.05)' },
                  },
                  '&:active': {
                    transform: { xs: 'scale(1.1)', sm: 'scale(0.95)' },
                    transition: 'transform 0.1s'
                  }
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  SCENES
                </Box>
              </Button>
            )}
            {/* SCROLLABLE INNER AREA */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
                p: matchMobile ? 3 : 6,
                pt: matchMobile ? 14 : 16,
                pb: matchMobile ? '15vh' : '10vh',
                '::-webkit-scrollbar': { width: '6px' },
                '::-webkit-scrollbar-track': { background: 'transparent' },
                '::-webkit-scrollbar-thumb': {
                  background: darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                  borderRadius: '10px'
                },
                '::-webkit-scrollbar-thumb:hover': {
                  background: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
                }
              }}
              ref={studioScrollRef}
            >
              {/* SECTION 1: Character & Environment Reference Images */}
              <Box sx={{ mb: 6 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="e.g. Extract all locations as well"
                  value={castingInstruction}
                  onChange={(e) => setCastingInstruction(e.target.value)}
                  sx={{
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      color: darkModeReducer ? '#fff' : '#000',
                      bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      '& fieldset': {
                        borderColor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      },
                      '&:hover fieldset': {
                        borderColor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: darkModeReducer ? '%#E8BAFA' : '%#0099cc',
                      }
                    },
                    "& .MuiInputBase-input": {
                      color: darkModeReducer ? "#ffffff" : "#000000", // Text color
                      fontSize: matchMobile ? '1rem' : '1rem',
                      caretColor: 'auto !important',
                    }
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Typography variant="overline" sx={{ color: darkModeReducer ? '#888' : '#777', letterSpacing: 2, fontWeight: 'bold' }}>
                    Character & Environment References
                  </Typography>
                  {(!referenceImages.some((r: any) => r.isGenerating) && referencePendingCount === 0) && (
                    <IconButton
                      onClick={() => {
                        setDetectedCharacters([]);
                        setDetectedEnvironments([]);
                        updateReferenceImages(() => []);
                        setQueuedCastingPrompts([]);
                        hasStartedCastingRef.current = false;
                        // Auto-restart the pipeline when the user resets
                        runAutoCastingPipeline(false);
                      }}
                      size="small"
                      sx={{
                        color: darkModeReducer ? '#888' : '#777',
                        bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: 'rgba(255,50,50,0.1)', color: '#ff4040' }
                      }}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                {/* Status indicator â€” hide on idle revisit, show during generation */}
                {(!isRevisitingCharacter || studioButtonStage === 'generating') && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 3 }}>
                    {(referenceLoading || detectedCharacters.length === 0) && <CircularProgress size={18} sx={{
                      color: darkModeReducer ? "#E8BAFA" : "#0099cc",
                      display: castingStatus === 'Casting Complete! Found Characters.' ? 'none' : 'flex'
                    }} />}
                    <Typography variant="body2" sx={{ color: darkModeReducer ? '#aaa' : '#666', fontWeight: 500 }}>
                      {castingStatus}{referencePendingCount > 0 ? ` (${referencePendingCount} remaining)` : ''}
                    </Typography>
                  </Box>
                )}

                {/* 2-column reference image grid */}
                {referenceImages.length > 0 && (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(6, 1fr)' },
                    gap: 2
                  }}>
                    {referenceImages.map((ref, idx) => (
                      <Box key={idx}
                        onClick={() => {
                          if (studioButtonStage === 'continue-editing') return; // Do not edit prompt/zoom if in edit characters mode
                          if (studioButtonStage === 'post-countdown') {
                            setStudioButtonStage('post-continue');
                            setStudioActionTimer(null);
                          }
                          setEditingRefIdx(idx);
                          setImagePromptVal(ref.prompt || "");
                          setAiUpdateVal("");
                          setZoomMode(false);
                        }}
                        onMouseLeave={() => {
                          setHideAllLabels(false);
                          setFadeAllLabels(false);
                          if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                        }}
                        onTouchEnd={() => {
                          setHideAllLabels(false);
                          setFadeAllLabels(false);
                          if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                        }}
                        sx={{
                          borderRadius: 3,
                          overflow: 'hidden',
                          position: 'relative',
                          bgcolor: '#ffffff',
                          boxShadow: darkModeReducer ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
                          aspectRatio: '9/16',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: studioButtonStage === 'continue-editing' ? 'default' : 'pointer'
                        }}>
                        {/* NEW: X button for deletion during editing stage */}
                        {studioButtonStage === 'continue-editing' && (
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCharacter(ref.name, ref.type);
                            }}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              zIndex: 10,
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              width: 28,
                              height: 28,
                              '&:hover': { bgcolor: 'rgba(255,0,0,0.8)' }
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                        {/* Image or shimmer skeleton */}
                        {ref.imageUrl ? (
                          <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                            <img
                              src={ref.imageUrl}
                              alt={ref.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                              }}
                            />
                            {(ref as any).isUpscaling && (
                              <Box sx={{
                                position: 'absolute', inset: 0,
                                bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', gap: 1, zIndex: 10
                              }}>
                                <CircularProgress size={32} sx={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc" }} />
                                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, letterSpacing: 1 }}>
                                  UPSCALING...
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        ) : ((ref as any).isGenerating || (studioButtonStage === 'generating' && !ref.imageUrl)) ? (
                          <Box sx={{
                            width: '100%',
                            height: '100%',
                            background: `linear-gradient(110deg, #f5f5f5 8%, #e0e0e0 18%, #f5f5f5 33%)`,
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite linear',
                            '@keyframes shimmer': {
                              '0%': { backgroundPosition: '200% 0' },
                              '100%': { backgroundPosition: '-200% 0' }
                            }
                          }} />
                        ) : (
                          <Box sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: darkModeReducer ? '#2d2d2d' : '#f0f0f0',
                          }}>
                            {ref.type === 'Environment' ? (
                              <LandscapeIcon sx={{ fontSize: 80, color: darkModeReducer ? '#555' : '#ccc' }} />
                            ) : ref.type === 'Object' ? (
                              <CategoryIcon sx={{ fontSize: 80, color: darkModeReducer ? '#555' : '#ccc' }} />
                            ) : (
                              <PersonIcon sx={{ fontSize: 80, color: darkModeReducer ? '#555' : '#ccc' }} />
                            )}
                          </Box>
                        )}

                        {/* Glassmorphism bottom name tag */}
                        {!hideAllLabels && (
                          <Box
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setFadeAllLabels(true);
                              if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                              labelHideTimerRef.current = setTimeout(() => {
                                setHideAllLabels(true);
                              }, 1300);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              setFadeAllLabels(true);
                              if (labelHideTimerRef.current) clearTimeout(labelHideTimerRef.current);
                              labelHideTimerRef.current = setTimeout(() => {
                                setHideAllLabels(true);
                              }, 1300);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCharacterToRename({ idx, oldName: ref.name, newName: ref.name, type: ref.type });
                              setRenameModalOpen(true);
                            }}
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              px: 2,
                              py: 1.5,
                              bgcolor: 'rgba(0,0,0,0.65)',
                              backdropFilter: 'blur(16px)',
                              borderTop: '1px solid rgba(255,255,255,0.1)',
                              cursor: 'pointer',
                              transition: 'all 0.2s, opacity 1.3s linear',
                              opacity: fadeAllLabels ? (hideAllLabels ? 0 : 0.2) : 1,
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <Typography sx={{
                                color: '#fff',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                                textAlign: 'center'
                              }}>
                                {ref.name}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCharacterToRename({ idx, oldName: ref.name, newName: ref.name, type: ref.type });
                                  setRenameModalOpen(true);
                                }}
                                onTouchStart={(e) => e.stopPropagation()}
                                sx={{ color: '#fff', p: 0.5 }}
                              >
                                <EditIcon fontSize="inherit" sx={{ fontSize: '1.1rem' }} />
                              </IconButton>
                            </Box>
                            {(ref.description || ref.prompt) && (
                              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', mt: 0.5, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {ref.description || ref.prompt}
                              </Typography>
                            )}
                          </Box>
                        )}

                        {/* Generation top-right Spinner */}
                        {(ref as any).isGenerating && (
                          <Box sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 20,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            borderRadius: '50%',
                            p: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(4px)'
                          }}>
                            <CircularProgress size={16} thickness={5} sx={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc" }} />
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* SECTION 2: Scenes Scroll Anchor */}
              <Box ref={scenesAnchorRef} sx={{ mb: 28 }}>
                <Typography
                  variant="body1"
                  onClick={() => setIsGoldenPromptExpanded(!isGoldenPromptExpanded)}
                  sx={{
                    color: darkModeReducer ? '#fff' : '#111',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    textShadow: darkModeReducer ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
                    maxHeight: isGoldenPromptExpanded ? '500px' : '150px',
                    overflowY: 'auto',
                    cursor: 'pointer',
                    transition: 'max-height 0.3s ease',
                    '&::-webkit-scrollbar': { display: 'none' },
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                  }}>
                  {prompt || "Golden Prompt Not Provided"}
                </Typography>
                <Box sx={{ height: '1px', bgcolor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', my: 3 }} />
                <Typography
                  variant="subtitle2"
                  onClick={() => setShowScenesPopup(true)}
                  sx={{
                    color: darkModeReducer ? "#E8BAFA" : "#0099cc",
                    mt: 1,
                    mb: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.7 }
                  }}
                >
                  Slide to Bottom â–¼
                </Typography>
              </Box>
            </Box>

            {/* SCENES SLIDE-UP POPUP Skip  */}
            {showScenesPopup && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 500,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'stretch',
                bgcolor: 'rgba(0,0,0,0.3)', // Added subtle backdrop
              }}
                onClick={() => setShowScenesPopup(false)} // Background click closes popup
              >
                {!matchMobile && (
                  <Box
                    sx={{
                      height: '20%',
                      cursor: 'pointer'
                    }}
                  />
                )}
                {/* Bottom 80% â€” scenes content */}
                <Box
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    height: matchMobile ? '65vh' : '80%',
                    width: '100%',
                    bgcolor: darkModeReducer ? 'rgba(15, 15, 18, 0.75)' : '#ffffff',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    borderTop: '1px solid',
                    borderColor: darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    borderRadius: '24px 24px 0 0',
                    overflowY: 'auto',
                    p: matchMobile ? 3 : 6,
                    pt: matchMobile ? 4 : 5,
                    pb: matchMobile ? '15vh' : '10vh',
                    animation: 'slideUpScenes 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    '@keyframes slideUpScenes': {
                      '0%': { transform: 'translateY(100%)' },
                      '100%': { transform: 'translateY(0)' }
                    },
                    '::-webkit-scrollbar': { width: '6px' },
                    '::-webkit-scrollbar-track': { background: 'transparent' },
                    '::-webkit-scrollbar-thumb': {
                      background: darkModeReducer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                      borderRadius: '10px'
                    }
                  }}
                >
                  {/* Drag handle indicator */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
                  </Box>

                  <Typography variant="subtitle2" sx={{
                    color: darkModeReducer ? "#E8BAFA" : "#0099cc",
                    mb: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    Scenes
                  </Typography>

                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    px: { xs: 0, sm: 6, md: 16 }
                  }}>
                    {parsedKeyPoints && parsedKeyPoints.length > 0 ? (
                      parsedKeyPoints.map((scene: any, idx: number) => (
                        <Box
                          key={idx}
                          sx={{
                            cursor: 'pointer',
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 1,
                            transition: 'background-color 0.2s',
                            '&:hover': {
                              bgcolor: darkModeReducer ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            }
                          }}
                          onClick={() => {
                            setSelectedSceneIndex(idx);
                            setExpandedScene(false);
                          }}
                        >
                          <Typography variant="h6" sx={{
                            fontWeight: 'bold',
                            mb: 0.5,
                            fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.15rem' },
                            color: darkModeReducer ? "#E8BAFA" : "#888888"
                          }}>
                            Scene {idx + 1}.
                          </Typography>
                          <Typography variant="body1" sx={{
                            lineHeight: 1.5,
                            fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.15rem' },
                            textAlign: 'justify',
                            color: darkModeReducer ? '#cccccc' : '#333333'
                          }}>
                            {scene}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      [1, 2, 3].map((mock, idx) => (
                        <Box key={`mock-${idx}`} sx={{ p: { xs: 1.5, sm: 2 } }}>
                          <Typography variant="h6" sx={{ color: darkModeReducer ? '#777' : '#999', fontWeight: 'bold', mb: 0.5, fontSize: '0.95rem' }}>
                            Scene {idx + 1}. (Analysis Pending)
                          </Typography>
                          <Typography variant="body1" sx={{ color: darkModeReducer ? '#555' : '#888', lineHeight: 1.5, fontSize: '0.95rem', textAlign: 'justify' }}>
                            The model is currently analyzing the golden prompt to extract key narrative segments and determine the visual requirements for this scene.
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            {/* CONFIRMATION OVERLAY */}
            {showConfirmClose && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Box
                  onClick={() => {
                    setShowConfirmClose(false);
                    setShowStudioModal(false);
                    setShowScenesPopup(false);
                    setCountdown(null);
                    updateReferenceImages(() => []);
                    setDetectedCharacters([]);
                    setDetectedEnvironments([]);
                    setCastingStatus("Analyzing script & matching actors...");
                    bulkDeleteImages();
                    handleCloseOverlay(); // Call close functionality from Storybook context
                    hasStartedCastingRef.current = false;
                    isGeneratingRefsRef.current = false;
                  }}
                  sx={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(20px)',
                    color: '#fff', fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, cursor: 'pointer',
                    transition: 'all 0.2s',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    '&:hover': { bgcolor: darkModeReducer ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.25)' }
                  }}
                >
                  YES
                </Box>
                <Box
                  onClick={() => setShowConfirmClose(false)}
                  sx={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(20px)',
                    color: '#fff', fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, cursor: 'pointer',
                    transition: 'all 0.2s',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    '&:hover': { bgcolor: darkModeReducer ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)' }
                  }}
                >
                  NO
                </Box>
              </Box>
            )}
          </Box>
        </Modal>

        <Modal
          open={selectedSceneIndex !== null}
          onClose={() => setSelectedSceneIndex(null)}
          sx={{ zIndex: 999999 }}
        >
          <Box
            onClick={() => setSelectedSceneIndex(null)}
            sx={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3,
              bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999
            }}
          >

            <Box
              id="scenes-glass-slider"
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
                  const slider = document.getElementById('scenes-glass-slider');
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
                  const slider = document.getElementById('scenes-glass-slider');
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

              {parsedKeyPoints && parsedKeyPoints.map((scene: any, idx: number) => {
                const previewImg = nanoImages[idx];
                const isExpanded = expandedScene;

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
                          setExpandedScene(!expandedScene);
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
                        {/* Removed "Accessing imagination" for loaded images and instead present the scene number */}
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
                          {scene}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Modal>

        {/* Reference Editor Popup */}
        <Modal
          open={editingRefIdx !== null}
          onClose={() => setEditingRefIdx(null)}
          sx={{ zIndex: 999999 }}
        >
          <Box
            sx={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 0, sm: 3 },
              bgcolor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', zIndex: 999999
            }}
            onClick={() => setEditingRefIdx(null)} // Click background closes
          >
            <Box
              onClick={(e) => {
                e.stopPropagation();
                if (zoomMode && !matchMobile) {
                  setEditingRefIdx(null);
                }
              }}
              sx={{
                width: '100%',
                maxWidth: (zoomMode && !matchMobile) ? '100vw' : '1000px',
                maxHeight: (zoomMode && !matchMobile) ? '100vh' : (matchMobile && zoomMode ? '100dvh' : { xs: '90vh', sm: '85vh' }),
                bgcolor: (zoomMode && !matchMobile) ? 'transparent' : (darkModeReducer ? '#0f0f12' : '#ffffff'),
                borderRadius: ((zoomMode && !matchMobile) || (matchMobile && zoomMode)) ? 0 : 6,
                overflowY: (matchMobile && zoomMode) ? 'auto' : 'hidden',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                position: 'relative',
                boxShadow: (zoomMode && !matchMobile) ? 'none' : '0 24px 80px rgba(0,0,0,0.8)',
                border: (zoomMode && !matchMobile) ? 'none' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {(zoomMode || matchMobile) && (
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingRefIdx(null);
                  }}
                  sx={{
                    position: 'absolute',
                    top: { xs: '3.5vh', sm: 24 },
                    right: { xs: 16, sm: 24 },
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              )}
              {/* Left/Top: Image Section */}
              <Box
                onDragStart={(e) => e.preventDefault()}
                onWheel={(e) => {
                  if (Math.abs(e.deltaX) < 30) return;
                  const now = Date.now();
                  if (now - lastSwipeTimeRef.current < 600) return;
                  lastSwipeTimeRef.current = now;

                  if (e.deltaX > 0 && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                    setEditingRefIdx(editingRefIdx + 1);
                    setImagePromptVal(referenceImages[editingRefIdx + 1]?.prompt || "");
                    setAiUpdateVal("");
                  }
                  if (e.deltaX < 0 && editingRefIdx !== null && editingRefIdx > 0) {
                    setEditingRefIdx(editingRefIdx - 1);
                    setImagePromptVal(referenceImages[editingRefIdx - 1]?.prompt || "");
                    setAiUpdateVal("");
                  }
                }}
                onTouchStart={(e) => {
                  touchStartXRef.current = e.targetTouches[0].clientX;
                }}
                onTouchMove={(e) => {
                  touchEndXRef.current = e.targetTouches[0].clientX;
                }}
                onTouchEnd={() => {
                  if (touchStartXRef.current === null || touchEndXRef.current === null) return;
                  const distance = touchStartXRef.current - touchEndXRef.current;
                  const isLeftSwipe = distance > 50;
                  const isRightSwipe = distance < -50;
                  if (isLeftSwipe || isRightSwipe) {
                    lastSwipeTimeRef.current = Date.now();
                  }
                  if (isLeftSwipe && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                    setEditingRefIdx(editingRefIdx + 1);
                    setImagePromptVal(referenceImages[editingRefIdx + 1]?.prompt || "");
                    setAiUpdateVal("");
                  }
                  if (isRightSwipe && editingRefIdx !== null && editingRefIdx > 0) {
                    setEditingRefIdx(editingRefIdx - 1);
                    setImagePromptVal(referenceImages[editingRefIdx - 1]?.prompt || "");
                    setAiUpdateVal("");
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
                  if (!matchMobile && touchStartXRef.current !== null && touchEndXRef.current !== null) {
                    const distance = touchStartXRef.current - touchEndXRef.current;
                    if (Math.abs(distance) > 50) {
                      if (distance > 50 && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                        setEditingRefIdx(editingRefIdx + 1);
                        setImagePromptVal(referenceImages[editingRefIdx + 1]?.prompt || "");
                        setAiUpdateVal("");
                      }
                      if (distance < -50 && editingRefIdx !== null && editingRefIdx > 0) {
                        setEditingRefIdx(editingRefIdx - 1);
                        setImagePromptVal(referenceImages[editingRefIdx - 1]?.prompt || "");
                        setAiUpdateVal("");
                      }
                    }
                  }
                  touchStartXRef.current = null;
                  touchEndXRef.current = null;
                }}
                onMouseUp={(e) => {
                  if (matchMobile) return;
                  if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
                    const distance = touchStartXRef.current - touchEndXRef.current;
                    if (Math.abs(distance) > 50) {
                      if (distance > 50 && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                        setEditingRefIdx(editingRefIdx + 1);
                        setImagePromptVal(referenceImages[editingRefIdx + 1]?.prompt || "");
                        setAiUpdateVal("");
                      }
                      if (distance < -50 && editingRefIdx !== null && editingRefIdx > 0) {
                        setEditingRefIdx(editingRefIdx - 1);
                        setImagePromptVal(referenceImages[editingRefIdx - 1]?.prompt || "");
                        setAiUpdateVal("");
                      }
                    } else if (zoomMode && Math.abs(distance) < 5) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const edgeWidth = rect.width * 0.25;
                      if (clickX < edgeWidth && editingRefIdx !== null && editingRefIdx > 0) {
                        setEditingRefIdx(editingRefIdx - 1);
                        setImagePromptVal(referenceImages[editingRefIdx - 1]?.prompt || "");
                        setAiUpdateVal("");
                      } else if (clickX > rect.width - edgeWidth && editingRefIdx !== null && editingRefIdx < referenceImages.length - 1) {
                        setEditingRefIdx(editingRefIdx + 1);
                        setImagePromptVal(referenceImages[editingRefIdx + 1]?.prompt || "");
                        setAiUpdateVal("");
                      }
                    }
                  }
                  touchStartXRef.current = null;
                  touchEndXRef.current = null;
                }}
                sx={{
                  flex: (zoomMode && !matchMobile) ? '1 1 100%' : { xs: 'none', md: '0 0 45%' },
                  height: (zoomMode && !matchMobile) ? '100vh' : (matchMobile && zoomMode ? '100dvh' : { xs: '20vh', md: 'auto' }),
                  aspectRatio: (matchMobile && zoomMode) ? '9/16' : 'auto',
                  position: 'relative',
                  bgcolor: matchMobile ? (darkModeReducer ? '#0f0f12' : '#ffffff') : '#000',
                  overscrollBehaviorX: 'none',
                  touchAction: 'pan-y',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& .nav-arrow': { opacity: 0, transition: 'opacity 0.2s' },
                  '&:hover .nav-arrow': { opacity: 1 }
                }}>
                {(!matchMobile || (matchMobile && zoomMode)) && (
                  <>
                    {editingRefIdx !== null && referenceImages.length > 1 && (
                      <Box
                        className="nav-edge-left"
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingRefIdx !== null) {
                            const newIdx = editingRefIdx > 0 ? editingRefIdx - 1 : referenceImages.length - 1;
                            setEditingRefIdx(newIdx);
                            setImagePromptVal(referenceImages[newIdx]?.prompt || "");
                            setAiUpdateVal("");
                          }
                        }}
                        sx={{
                          position: zoomMode ? "fixed" : "absolute",
                          left: 0,
                          top: 0,
                          width: zoomMode ? "18vw" : "18%",
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
                    )}
                    {editingRefIdx !== null && referenceImages.length > 1 && (
                      <Box
                        className="nav-edge-right"
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingRefIdx !== null) {
                            const newIdx = editingRefIdx < referenceImages.length - 1 ? editingRefIdx + 1 : 0;
                            setEditingRefIdx(newIdx);
                            setImagePromptVal(referenceImages[newIdx]?.prompt || "");
                            setAiUpdateVal("");
                          }
                        }}
                        sx={{
                          position: zoomMode ? "fixed" : "absolute",
                          right: 0,
                          top: 0,
                          width: zoomMode ? "18vw" : "18%",
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
                    )}
                  </>
                )}
                {editingRefIdx !== null && referenceImages[editingRefIdx]?.imageUrl ? (
                  <img
                    onClick={(e) => {
                      e.stopPropagation();
                      if (Date.now() - lastSwipeTimeRef.current < 400) return;
                      setZoomMode(!zoomMode);
                    }}
                    src={referenceImages[editingRefIdx].imageUrl}
                    alt="Reference"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: (zoomMode && !matchMobile) ? 'contain' : (matchMobile && zoomMode ? 'contain' : 'cover'),
                      objectPosition: (matchMobile && !zoomMode) ? 'top center' : 'center',
                      cursor: 'pointer'
                    }}
                  />
                ) : (
                  <CircularProgress color="inherit" />
                )}
              </Box>

              {/* Right/Bottom: Controls Section (Hidden in zoom mode on PC) */}
              {(!zoomMode || matchMobile) && (
                <Box sx={{
                  flex: 1,
                  p: { xs: 3, sm: 5 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  overflowY: 'auto'
                }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: darkModeReducer ? '#fff' : '#000', mb: 1 }}>
                      {editingRefIdx !== null && referenceImages[editingRefIdx]?.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
                      Concept Refinement
                    </Typography>
                  </Box>

                  {/* Update with AI */}
                  <Box>
                    <Typography variant="overline" sx={{ color: darkModeReducer ? "#E8BAFA" : "#0099cc", fontWeight: 800, mb: 1, display: 'block', letterSpacing: 1 }}>
                      Update with AI
                    </Typography>
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          placeholder="Describe changes... (e.g. 'add a battle scar', 'blue cinematic lighting')"
                          value={aiUpdateVal}
                          onChange={(e) => setAiUpdateVal(e.target.value)}
                          onFocus={() => setIsNotepadOpenRefAI(true)}
                          onClick={() => setIsNotepadOpenRefAI(true)}
                          slotProps={{
                            htmlInput: { readOnly: true }
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: darkModeReducer ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 3,
                              fontSize: '0.95rem',
                              pr: 7
                            },
                            '& .MuiInputBase-input': {
                              color: darkModeReducer ? '#fff' : '#000'
                            },
                            opacity: isNotepadOpenRefAI ? '0.03' : '1'
                          }}
                        />
                        <IconButton
                          onClick={(e) => { e.stopPropagation(); handleEditReferenceAI(); }}
                          disabled={isAILoading || !aiUpdateVal}
                          sx={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            color: darkModeReducer ? "#E8BAFA" : "#0099cc",
                            '&.Mui-disabled': { color: 'rgba(255,255,255,0.1)' }
                          }}
                        >
                          {isAILoading ? <CircularProgress size={24} color="inherit" /> : <AutoFixHighIcon />}
                        </IconButton>
                      </Box>
                      <Notepad
                        zIndex={9999999}
                        hide={false}
                        Caret={0}
                        handleKeyDown={(e: any) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsNotepadOpenRefAI(false);
                            handleRegenerateReference();
                          }
                        }}
                        TextFieldactive={false}
                        setTextFieldactive={() => { }}
                        GeneratedImage={''}
                        panel
                        type={200}
                        darkMode={darkModeReducer}
                        size={matchMobile ? "small" : "medium"}
                        open={isNotepadOpenRefAI}
                        setIsNotepadOpen={setIsNotepadOpenRefAI}
                        onClose={() => setIsNotepadOpenRefAI(false)}
                        placeholder="Describe changes... (e.g. 'add a battle scar', 'blue cinematic lighting')"
                        value={aiUpdateVal}
                        onChange={(v: string) => setAiUpdateVal(v)}
                      />
                    </Box>
                  </Box>

                  {/* Image Prompt */}
                  <Box>
                    <Typography variant="overline" sx={{ color: '#888', fontWeight: 800, mb: 1, display: 'block', letterSpacing: 1 }}>
                      Image Prompt
                    </Typography>
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                      <Box sx={{ flex: 1, position: 'relative' }}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          maxRows={6}
                          value={imagePromptVal}
                          onChange={(e) => setImagePromptVal(e.target.value)}
                          onFocus={() => setIsNotepadOpenRefPrompt(true)}
                          onClick={() => setIsNotepadOpenRefPrompt(true)}
                          slotProps={{
                            htmlInput: { readOnly: true }
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: darkModeReducer ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderRadius: 3,
                              fontSize: '0.85rem',
                              fontFamily: 'monospace',
                              color: darkModeReducer ? '#ccc' : '#444'
                            },
                            opacity: isNotepadOpenRefPrompt ? '0.03' : '1'
                          }}
                        />
                      </Box>
                      <Notepad
                        zIndex={9999999}
                        hide={false}
                        Caret={0}
                        handleKeyDown={(e: any) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsNotepadOpenRefPrompt(false);
                            handleRegenerateReference();
                          }
                        }}
                        TextFieldactive={false}
                        setTextFieldactive={() => { }}
                        GeneratedImage={''}
                        panel
                        type={200}
                        darkMode={darkModeReducer}
                        size={matchMobile ? "small" : "medium"}
                        open={isNotepadOpenRefPrompt}
                        setIsNotepadOpen={setIsNotepadOpenRefPrompt}
                        onClose={() => setIsNotepadOpenRefPrompt(false)}
                        placeholder="Image Prompt"
                        value={imagePromptVal}
                        onChange={(v: string) => setImagePromptVal(v)}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', mt: 1 }}>
                      <Button
                        size="small"
                        onClick={() => {
                          if (editingRefIdx !== null) {
                            const ref = referenceImages[editingRefIdx];
                            const defaultPrompt = ref?.originalPrompt || ref?.prompt || ref?.description || "";
                            setImagePromptVal(defaultPrompt);
                            setAiUpdateVal("");
                          }
                        }}
                        sx={{
                          ml: 'auto',
                          bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          color: darkModeReducer ? '#aaa' : '#666',
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          borderRadius: '16px',
                          px: 2,
                          py: 0.5,
                          backdropFilter: 'blur(4px)',
                          border: '1px solid',
                          borderColor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          '&:hover': {
                            bgcolor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: darkModeReducer ? '#fff' : '#000',
                          }
                        }}
                      >
                        Default
                      </Button>
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ mt: 'auto', pt: 2, pb: matchMobile ? 4 : 0, display: 'flex', gap: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleRegenerateReference}
                      disabled={(referenceImages[editingRefIdx] as any)?.isGenerating}
                      startIcon={(referenceImages[editingRefIdx] as any)?.isGenerating ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                      sx={{
                        height: 56,
                        borderRadius: 4,
                        bgcolor: darkModeReducer ? "#E8BAFA" : "#0099cc",
                        color: '#121212',
                        fontWeight: 800,
                        fontSize: '1rem',
                        letterSpacing: 1,
                        boxShadow: '0 8px 20px rgba(0,200,83,0.3)',
                        '&:hover': { bgcolor: '#00a844', color: '#121212', boxShadow: '0 10px 25px rgba(0,200,83,0.4)' },
                        '&.Mui-disabled': { bgcolor: 'rgba(0,200,83,0.3)', color: 'rgba(255,255,255,0.5)' }
                      }}
                    >
                      {(referenceImages[editingRefIdx] as any)?.isGenerating ? "GENERATING..." : "REGENERATE"}
                    </Button>

                    <IconButton
                      onClick={() => setEditingRefIdx(null)}
                      sx={{
                        width: 56, height: 56, borderRadius: 4,
                        bgcolor: darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        '&:hover': { bgcolor: darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                      }}
                    >
                      <CloseIcon sx={{ color: darkModeReducer ? '#fff' : '#000' }} />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Modal>

        <Modal
          open={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999
          }}
        >
          <Box sx={{
            width: matchMobile ? '90%' : 400,
            bgcolor: darkModeReducer ? '#1E1E1E' : '#FFFFFF',
            borderRadius: 3,
            p: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h6" sx={{ color: darkModeReducer ? '#fff' : '#000', fontWeight: 'bold' }}>
              Rename Character
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              value={characterToRename?.newName || ''}
              onChange={(e) => setCharacterToRename(prev => prev ? { ...prev, newName: e.target.value } : null)}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: darkModeReducer ? '#fff' : '#000',
                  '& fieldset': {
                    borderColor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: darkModeReducer ? "#E8BAFA" : "#0099cc",
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: darkModeReducer ? "#E8BAFA" : "#0099cc",
                  },
                },
                "& .MuiInputBase-input": {
                  color: darkModeReducer ? "#ffffff" : "#000000", // Text color
                  fontSize: matchMobile ? '1.3rem' : '1.4rem',
                  caretColor: 'auto !important',
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
              <Button
                onClick={() => setRenameModalOpen(false)}
                sx={{ color: darkModeReducer ? '#aaa' : '#666', fontWeight: 'bold' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (characterToRename && characterToRename.newName.trim() !== '') {
                    const { idx, newName, oldName, type } = characterToRename;
                    updateReferenceImages(prev => prev.map((r, i) => i === idx ? { ...r, name: newName } : r));
                    if (type.toLowerCase() === 'character') {
                      setDetectedCharacters(prev => prev.map((c: any) => c.name === oldName ? { ...c, name: newName } : c));
                    } else {
                      setDetectedEnvironments(prev => prev.map((env: any) => env.name === oldName ? { ...env, name: newName } : env));
                    }
                  }
                  setRenameModalOpen(false);
                }}
                sx={{
                  bgcolor: darkModeReducer ? "#E8BAFA" : "#0099cc",
                  color: '#fff',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: darkModeReducer ? "#d0a0e0" : "#007ea8",
                  }
                }}
              >
                GO
              </Button>
            </Box>
          </Box>
        </Modal>

        <Box>
          {AudioResult === "" ? null : <AudioNarration text={AudioResult} />}
        </Box>
      </Box>
    </>
  );
});

export default PromptInput;
