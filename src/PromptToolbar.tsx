import { isOpenAiConversationProfile } from './conversationModels';
import React, { useEffect, useState, useRef } from "react";
import './SocialChat.css';
import { createPortal } from "react-dom";
import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Typography,
    CircularProgress,
    IconButton,
    Dialog,
    DialogContent,
    DialogActions,
    List,
    ListItemButton,
    TextField,
    Menu,
    MenuItem,
    Divider
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { ArtStyleSelector } from "./ArtStyleSelector"; // adjust path as needed
import ModelPixels from './ModelPixels';

import { keyframes } from "@emotion/react";

import { matchMobile } from "./DetectDevice";
import MorphButton from './MorphButton';
import CloseIcon from "@mui/icons-material/Close";
import CancelIcon from '@mui/icons-material/Cancel';
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import PeopleIcon from "@mui/icons-material/People";
import TouchAppIcon from '@mui/icons-material/TouchApp';
import PhotoIcon from '@mui/icons-material/Photo';
import WeekendIcon from '@mui/icons-material/Weekend';
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import axios from "axios"; // Import Axios
import { useDispatch } from "react-redux";
import { setArtstyle, setArtstylePreview, setConversationModel, setLanguageModel } from "./settingsSlice";
import { calcModelPixels } from "./ModelPixels";
import {
    DEFAULT_IMAGE_MODEL,
    GPT_IMAGE_25_FLARE,
    GPT_IMAGE_25_SUNBURST,
    getGptImageRoute,
} from "./imageModels";
import { LANGUAGE_MODELS, type LanguageModelTier } from "./languageModels";
import { CONVERSATION_MODELS, type ConversationModelTier } from "./conversationModels";
import { notifyOpenAiSelected } from "./openAiSelection";
import LanguageModelCostInfo, { LanguageModelCostButton } from "./LanguageModelCostInfo";
import PixelLedgerDialog, { LedgerButton } from "./PixelLedgerDialog";
import { useCreationLedger } from "./CreationLedgerContext";
import { isImageModelExampleSource } from "./SavepromptHelpersLocal";

const ART_STYLE_PREVIEW_LINK_MODE = true;


import type { CreationStage } from "./creationStage";



interface PromptToolbarProps {
    draftSaved?: boolean;
    draftSaving?: boolean;
    draftError?: string | null;
    onDraftCloseReview?: () => Promise<unknown> | unknown;
    closeReviewRequest?: number;
    creationDeckOpen?: boolean;
    /** click handler for the close (x) icon */
    onClose: () => void;
    allowSpin: boolean;
    parsedKeyPoints: any;
    GeneratedImageFlux: any;
    handleCloseOverlay: any;
    selectedStyle: any;
    setSelectedStyle: any;
    setPrompt: any;
    Manual: any
    type: any;
    destroyAllFluxCalls: any;
    isMenuOpen: any;
    minimisePrompt: any;
    setVideMode: any;
    ImagesHdCloud: any;
    setImagesHdCloud: any;
    setDummyMode: any;
    worldStyle: any;
    referenceImages: any[];
    setReferenceImages: any;
    isBlinking?: boolean;
    onCancel?: () => void;
    minimizeMode?: number;
    setMinimizeMode?: any;
    handleOpenCharacterStudio?: () => void;
    models?: any[];
    modelz?: string;
    homeModel?: string;
    handleSelectModel?: (name: string, img: any) => void;
    onToggleSlideshow?: () => void;
    isStorybookDone?: boolean;
    magicMode?: boolean;
    isBShotModeActive?: boolean;
    onOpenMusicPicker?: () => void;
    hasPromptMusic?: boolean;
    landingToolbarContent?: React.ReactNode;
    /** App intro is up: hide the toolbar extras so only the name shows. */
    introActive?: boolean;
    handleLoginSuccess?: (response: any) => void;
    handleLoginError?: () => void;
    /**
     * Where PromptInput currently is in the creation flow. Derived in
     * PromptInput from real pipeline data via ./creationStage.ts - never set by
     * hand, so it cannot drift from what is actually on screen.
     */
    creationStage?: CreationStage;
    /** True ONLY on the initial prompt-entry screen (stage === 'composer'). Resize target. */
    isComposerStage?: boolean;
    /** Composer with the welcome/landing cards showing. */
    isLandingStage?: boolean;
    /**
     * Compact-pill rearrangement. The STYLES trigger moves to PromptInput's bottom
     * row, so its modal state is lifted; pass both to control it from there.
     * Omit them and the toolbar keeps its own internal state (Storybook path).
     */
    styleModalOpen?: boolean;
    onStyleModalOpenChange?: (open: boolean) => void;
    /** Close handler rendered into the toolbar's far-right slot when compact. */
    onCompactClose?: () => void;
    /** Clear direct-upload and character draft state after a confirmed wipe. */
    onClearCreationReferences?: () => void;
    /** Active World/direct-upload URLs that cleanup must never delete. */
    protectedImageUrls?: string[];
    /**
     * THE RESIZE FLAG: true for 'composer' AND 'generating', and only while the
     * user has not manually minimised. Stays true through the PlanSteps progress
     * text and releases when the "Accessing Imagination" scene cards appear.
     *
     * Note the minimise button below is gated on `isStorybookOpen`, which is only
     * ever true in 'preview' / 'story' - so it is never on screen while this flag
     * is true, and the two sizing systems cannot fight.
     */
    isCompactStage?: boolean;
    buttonTheme?: { bg: string; text: string; hoverBg: string; hoverText: string };
}

const PromptToolbar: React.FC<PromptToolbarProps> = ({
    draftSaved = false,
    draftSaving = false,
    draftError = null,
    onDraftCloseReview,
    closeReviewRequest = 0,
    creationDeckOpen = false,
    onClose,
    allowSpin,
    parsedKeyPoints,
    GeneratedImageFlux,
    handleCloseOverlay,
    selectedStyle,
    setSelectedStyle,
    setPrompt,
    Manual,
    type,
    destroyAllFluxCalls,
    isMenuOpen,
    minimisePrompt,
    setVideMode,
    ImagesHdCloud,
    setImagesHdCloud,
    setDummyMode,
    worldStyle,
    referenceImages,
    setReferenceImages,
    isBlinking,
    onCancel,
    minimizeMode = 1,
    setMinimizeMode,
    handleOpenCharacterStudio,
    models = [],
    modelz,
    homeModel,
    handleSelectModel,
    onToggleSlideshow,
    isStorybookDone,
    magicMode,
    isBShotModeActive,
    onOpenMusicPicker,
    hasPromptMusic,
    landingToolbarContent,
    introActive = false,
    handleLoginSuccess,
    handleLoginError,
    creationStage = 'composer',
    isComposerStage = creationStage === 'composer',
    isLandingStage = false,
    isCompactStage = creationStage === 'composer' || creationStage === 'generating',
    styleModalOpen: styleModalOpenProp,
    onStyleModalOpenChange,
    onCompactClose,
    onClearCreationReferences,
    protectedImageUrls = [],
    buttonTheme = {
        bg: "rgba(10, 10, 10, 0.45)",
        text: "#ffffff",
        hoverBg: "rgba(15, 15, 15, 0.65)",
        hoverText: "#ffffff",
    }
}) => {
    const { reset: resetCreationLedger } = useCreationLedger();
    const [showConfirmClose, setShowConfirmClose] = useState(false);
    const [deckCloseReview, setDeckCloseReview] = useState(false);
    const renderCloseReview = (dialog: React.ReactNode) => deckCloseReview ? createPortal(dialog, document.body) : dialog;
    const handledCloseReview = useRef(closeReviewRequest);
    const [reviewingDraft, setReviewingDraft] = useState(false);
    const [draftReviewFailed, setDraftReviewFailed] = useState(false);
    const [draftReviewError, setDraftReviewError] = useState('');
    const [closingCreation, setClosingCreation] = useState(false);
    const closingCreationRef = useRef(false);
    const closeReviewEpoch = useRef(0);
    const draftCloseReviewRef = useRef<Promise<boolean> | null>(null);
    const reviewDraftBeforeClose = () => {
        if (draftCloseReviewRef.current) return draftCloseReviewRef.current;
        if (!onDraftCloseReview) return Promise.resolve(true);
        setReviewingDraft(true);
        setDraftReviewFailed(false);
        setDraftReviewError('');
        const work = Promise.resolve().then(onDraftCloseReview)
            .then(() => true, (error: unknown) => {
                setDraftReviewFailed(true);
                setDraftReviewError(error instanceof Error ? error.message : 'Please retry saving or choose No to keep working.');
                return false;
            })
            .finally(() => {
                draftCloseReviewRef.current = null;
                setReviewingDraft(false);
            });
        draftCloseReviewRef.current = work;
        return work;
    };
    const openCloseReview = (fromDeck = false) => {
        closeReviewEpoch.current++;
        setDeckCloseReview(fromDeck);
        setShowConfirmClose(true);
        void reviewDraftBeforeClose();
    };
    useEffect(() => {
        if (handledCloseReview.current === closeReviewRequest) return;
        handledCloseReview.current = closeReviewRequest;
        openCloseReview(true);
    }, [closeReviewRequest]);
    useEffect(() => {
        if (!deckCloseReview || !showConfirmClose) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeReviewEpoch.current++;
            setShowConfirmClose(false);
        };
        document.addEventListener('keydown', closeOnEscape, true);
        return () => document.removeEventListener('keydown', closeOnEscape, true);
    }, [deckCloseReview, showConfirmClose]);

    const [modelMenuAnchorEl, setModelMenuAnchorEl] = useState<null | HTMLElement>(null);

    /* ---------- Language model (prompt writing) ---------- */
    const languageModel = useSelector(
        (state: RootState) => state.settings.languageModel
    );
    const conversationModel = useSelector(
        (state: RootState) => state.settings.conversationModel
    );
    const [llmCostInfoOpen, setLlmCostInfoOpen] = useState(false);
    const [pixelLedgerOpen, setPixelLedgerOpen] = useState(false);

    const activeModelz = !modelz || modelz.toLowerCase() === 'models' ? DEFAULT_IMAGE_MODEL : modelz;
    const activeHomeModel = !homeModel || homeModel.toLowerCase() === 'models' ? DEFAULT_IMAGE_MODEL : homeModel;

    // Order mirrors ModelSelectionModal: cards in MODELS order (Imagen,
    // Gpt Image, fluxUltra, minimax, Schnell), each card's top option
    // followed by its lite option.
    const flattenedModels = [
        // Nano Banana family card
        { name: 'Nano Banana Pro', value: 'fluxUltra2' },
        { name: 'Nano Banana', value: 'Imagen2' },
        // GPT Image 2.5 family card
        { name: 'GPT Image Sunburst', value: GPT_IMAGE_25_SUNBURST },
        { name: 'GPT Image Flare', value: GPT_IMAGE_25_FLARE },
        // Nano Banana 2 family card
        { name: 'Nano Banana 2.1', value: 'Imagen' },
        { name: 'Nano Banana 2 Lite', value: 'fluxUltra' },
        // Seedream family card
        { name: 'Seedream 5 Pro', value: 'minimax' },
        { name: 'Seedream 4.5', value: 'minimax2' },
        // Klein card
        { name: 'Klein', value: 'Schnell' },
    ];


    const CLIK_URL = import.meta.env.VITE_CLIK_URL;



    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const darkMode = darkModeReducer;
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? '#E8BAFA' : '#0099cc');

    const dispatch = useDispatch();
    const isDarkMode = darkModeReducer;
    const isStorybookOpen = Boolean(GeneratedImageFlux || parsedKeyPoints.length > 0);


    const artstyleRedux = useSelector((state: RootState) => state.settings.artstyle);


    /* ------ palette helpers ------ YES */
    const bgList = isDarkMode ? "#1e1e1e" : "#fafafa";
    const textPrimary = isDarkMode ? "#ffffff" : "#111111";
    const dividerColor = isDarkMode ? "rgba(255,255,255,0.12)" : "#e0e0e0";

    const selectedItemStyle = {
        backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.07)",
        color: textPrimary,
    };

    const defaultItemStyle = {
        color: textPrimary,
    };


    const glassSweep = keyframes`
      from { transform: translateX(-150%) rotate(20deg); }
      to   { transform: translateX(150%)  rotate(20deg); }
    `;

    const blinkOutline = keyframes`
      0% { outline: 2px solid transparent; outline-offset: 3px; }
      50% { outline: 2px solid rgba(255, 255, 255, 0.5); outline-offset: 3px; }
      100% { outline: 2px solid transparent; outline-offset: 3px; }
    `;


    // Customize padding and height for all top buttons here.
    const buttonPadding = isCompactStage
        ? ({ px: 1.75, minWidth: { xs: '94px', sm: '78px' }, height: { xs: '38px', sm: '34px' } } as const)
        : ({ px: 3, minWidth: { xs: '94px', sm: '100px' }, height: { xs: '38px', sm: '44px' } } as const);
    /** Toolbar label size, tightened with the rest of the compact composer bar. */
    const buttonLabelSize = isCompactStage
        ? ({ xs: '0.65rem', sm: '0.66rem' } as const)
        : ({ xs: '0.65rem', sm: '0.75rem' } as const);

    // ---------------- Art‑style picker state ----------------
    const [internalStyleModalOpen, setInternalStyleModalOpen] = useState(false);
    // Controlled when the parent supplies both; otherwise fully internal.
    const styleModalOpen = styleModalOpenProp !== undefined ? styleModalOpenProp : internalStyleModalOpen;
    const setStyleModalOpen = (open: boolean) => {
        if (onStyleModalOpenChange) onStyleModalOpenChange(open);
        else setInternalStyleModalOpen(open);
    };

    const activeModel = useSelector((state: RootState) => state.settings.model);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const pixels = useSelector((state: RootState) => state.settings.pixels);

    const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
    const [generatingStyle, setGeneratingStyle] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [showReGenPill, setShowReGenPill] = useState<Record<string, boolean>>({});
    const reGenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (reGenTimeoutRef.current) {
                clearTimeout(reGenTimeoutRef.current);
            }
        };
    }, []);

    // Fetch images map on mount and whenever styleModalOpen becomes true
    useEffect(() => {
        const fetchImages = async () => {
            try {
                const res = await axios.get(`${CLIK_URL}/api/get-artstyle-images`);
                if (res.data && res.data.images) {
                    const map: Record<string, string> = {};
                    res.data.images.forEach((row: any) => {
                        map[row.artstyle_name] = row.image_url;
                    });
                    setImagesMap(map);
                }
            } catch (err) {
                console.error("Failed to fetch art style images", err);
            }
        };
        fetchImages();
    }, [CLIK_URL, styleModalOpen]);

    const getModelRoute = (model: string) => {
        const gptRoute = getGptImageRoute(model);
        if (gptRoute) return gptRoute;
        if (model === "Schnell" || model === "Models") return "fluxschnell";
        if (model === "fluxUltra") return "fluxUltra";
        if (model === "Hi Dream") return "HiDream";
        if (model === "minimax") return "minimax";
        if (model === "Imagen") return "Imagen";
        return "fluxschnell"; // fallback
    };

    const handleGenerateImage = async (e: React.MouseEvent, styleName: string) => {
        e.stopPropagation();
        if (!loggedUser || !loggedUser.id) return alert("Please log in first.");

        if (reGenTimeoutRef.current) {
            clearTimeout(reGenTimeoutRef.current);
            reGenTimeoutRef.current = null;
        }

        const cost = calcModelPixels({ model: "Schnell", baseImagesPerDollar: 333 });
        const modelRoute = getModelRoute("Schnell");

        setGeneratingStyle(styleName);
        setProgress(0);

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev < 30) return prev + (Math.random() * 0.4 + 0.2);
                if (prev < 70) return prev + (Math.random() * 0.2 + 0.1);
                if (prev < 90) return prev + 0.05;
                if (prev < 98) return prev + 0.01;
                return prev;
            });
        }, 100); // 100ms ticks for smooth, non-choppy slow motion

        const completeProgress = () => {
            clearInterval(interval);
            return new Promise<void>((resolve) => {
                const endInterval = setInterval(() => {
                    setProgress(prev => {
                        if (prev >= 100) {
                            clearInterval(endInterval);
                            setTimeout(() => {
                                resolve();
                            }, 300);
                            return 100;
                        }
                        return prev + 10;
                    });
                }, 30);
            });
        };

        try {
            if (pixels < cost) {
                clearInterval(interval);
                alert(`You need ${cost} pixels for this style image, but your balance is ${pixels}.`);
                setGeneratingStyle(null);
                setProgress(0);
                return;
            }

            const gptRes = await axios.post(
                `${CLIK_URL}/GptArtstylePrompt`,
                { artstyleName: styleName },
                { withCredentials: true },
            );
            const finalPrompt = gptRes.data.storyPrompt;

            const payload = {
                inputs: finalPrompt || `A professional showcase image representing the ${styleName} art style`,
                width: 1080,
                height: 1080,
                guidance: 7.5,
                num_inference_steps: 35,
                seed: Math.floor(Math.random() * 10000000),
                ty: 2,
                Png: true,
                linkmode: ART_STYLE_PREVIEW_LINK_MODE,
                model: "Schnell",
                billingAction: "style-image",
            };

            const imageRes = await axios.post(`${CLIK_URL}/${modelRoute}`, payload, { withCredentials: true });
            const generatedImage = ART_STYLE_PREVIEW_LINK_MODE
                ? imageRes.data?.imageUrl
                : (imageRes.data?.imageBase64 || imageRes.data?.image);

            if (!generatedImage) throw new Error("No image returned");

            const imageDownload = await fetch(generatedImage);
            if (!imageDownload.ok) {
                throw new Error(`Art style image download failed with status ${imageDownload.status}.`);
            }
            const rawBlob = await imageDownload.blob();

            const s3Res = await axios.post(`${CLIK_URL}/get_signed_url_imageStory`, { values: { count: 1 } }, { withCredentials: true });
            const signedUrls = s3Res.data.holder[0];

            await axios.put(signedUrls.urlHD, rawBlob, {
                headers: { "Content-Type": rawBlob.type || "application/octet-stream" },
            });
            const uploadedImageUrl = signedUrls.urlHD.split("?")[0];

            await axios.post(`${CLIK_URL}/api/save-artstyle-image`, {
                artstyle_name: styleName,
                image_url: uploadedImageUrl,
                userid: loggedUser.id
            });

            await completeProgress();

            setImagesMap(prev => ({ ...prev, [styleName]: uploadedImageUrl }));
            setShowReGenPill(prev => ({ ...prev, [styleName]: false }));

        } catch (err) {
            clearInterval(interval);
            console.error("Generation failed:", err);
            alert("Failed to generate image.");
        } finally {
            setGeneratingStyle(null);
            setProgress(0);
        }
    };

    const [customStyleInput, setCustomStyleInput] = useState<string>("");

    /* ---------------- Allowed art styles ---------------- */
    const artStyles: string[] = [
        "3D Animation",
        "PhotoRealistic",
        "3D Render",
        "Cinematic",
        "Final Fantasy",
        "Anime",
        "Comic Book",
        "MineCraft",
        "Fantasy Art",
        "Realism",
        "Renaissance",
        "Watercolor",
        "HDR Photography",
        "CCTV Camera",
        "Wireframe",
        "3D Render CGI",
        "Pixel",
        "2D Game",
        "Cyberpunk",
        "Synthwave",
        "Sci-Fi",
        "Pop Art"
    ];



    useEffect(() => {


        setCustomStyleInput(selectedStyle);
    }, [styleModalOpen, selectedStyle])


    useEffect(() => {
        dispatch(setArtstylePreview(selectedStyle && imagesMap[selectedStyle]
            ? { style: selectedStyle, url: imagesMap[selectedStyle] }
            : null));
    }, [dispatch, imagesMap, selectedStyle]);






    const handleSelectStyle = (style: string) => {
        setSelectedStyle(style);
        setCustomStyleInput(style);
        dispatch(setArtstyle(style));
    };

    const handleSaveCustom = () => {
        if (customStyleInput.trim()) {
            handleSelectStyle(customStyleInput.trim());

        }
    };

    useEffect(() => {

        if (worldStyle) {
            handleSelectStyle(worldStyle);


        }
    }, [worldStyle])

    // 1) Smoother, full-width sweep
    const sweep = keyframes`
  0%   { transform: translate3d(-120%,0,0) skewX(-16deg); opacity: 0; }
  12%  { opacity: 0.95; }
  88%  { opacity: 0.95; }
  100% { transform: translate3d(120%,0,0) skewX(-16deg); opacity: 0; }
`;


    function LoadingGlass({
        appColor,
        allowSpin,
    }: {
        appColor: string;
        allowSpin: boolean;
    }) {
        return (
            <Box
                sx={{
                    flexBasis: "auto",
                    display: allowSpin ? "flex" : "none",
                    justifyContent: isCompactStage ? "center" : "flex-end",
                    alignItems: "center",
                    flexShrink: 0,
                    ml: isCompactStage ? 0 : 1,
                    // Compact loading owns the same pinned right-hand slot as
                    // the close button, without entering the centred flex flow.
                    ...(isCompactStage ? {
                        position: "absolute",
                        right: { xs: 8, sm: 12 },
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 2,
                    } : {}),
                }}
            >
                <Box
                    role="progressbar"
                    aria-busy={allowSpin}
                    aria-label="Loading"
                    sx={{
                        display: allowSpin ? "block" : "none",

                        // smaller by default, scales up slightly on larger screens
                        width: { xs: 28, sm: 32, md: 40 },
                        height: { xs: 28, sm: 32, md: 40 },
                        borderRadius: { xs: 1, sm: 1.25, md: 1.5 },
                        position: "relative",
                        overflow: "hidden",

                        // The BOX itself is the theme color with glassy depth
                        // base color + subtle vertical gradient of the SAME hue
                        background: `linear-gradient(180deg, ${alpha(appColor, 0.18)}, ${alpha(appColor, 0.4)})`,
                        boxShadow: `
            0 0 8px ${alpha(appColor, 0.55)},
            inset 0 0 10px ${alpha(appColor, 0.35)}
          `,

                        // crisp tinted border + inner glow (same hue)
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            borderRadius: "inherit",
                            border: `1px solid ${alpha(appColor, 0.9)}`,
                            boxShadow: `inset 0 0 16px ${alpha(appColor, 0.45)}`,
                            pointerEvents: "none",
                        },

                        // glassy light sweep, tinted by the same hue (not white)
                        "&::after": {
                            content: '""',
                            position: "absolute",
                            top: "-28%",
                            bottom: "-28%",
                            left: 0,
                            width: "100%",                 // full width of the box
                            // same-hue sheen with soft edges
                            background: `linear-gradient(90deg,
    transparent 0%,
    ${alpha(appColor, 0.1)} 22%,
    ${alpha(appColor, 0.6)} 50%,
    ${alpha(appColor, 0.1)} 78%,
    transparent 100%
  )`,
                            filter: "blur(2px)",
                            willChange: "transform, opacity",
                            transform: "translate3d(-120%,0,0) skewX(-16deg)",
                            animation: `${sweep} 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite`,
                        },


                        // Motion & mobile tuning
                        "@media (prefers-reduced-motion: reduce)": {
                            "&::after": { animation: "none" },
                        },
                        // Slightly slower on very small screens for a smoother feel
                        "@media (max-width:600px)": {
                            "&::after": { animation: `${sweep} 1.25s linear infinite` },
                        },
                    }}
                />
            </Box>
        );
    }





    const startDelete = async (imageUrl: any) => {
        // A saved example set owns this file even when its creation is discarded.
        if (typeof imageUrl === "string" && isImageModelExampleSource(imageUrl)) return;
        try {
            ///  setLoadingDatabase(true);
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
            ///  setLoadingDatabase(false);
        }
    };


    // 1️⃣  Create one “bulk-delete” helper
    const bulkDeleteImages = async () => {
        // Delete temporary scene/reference renders only. World and active
        // direct-upload source images remain protected while selected.
        const protectedUrls = new Set(
            protectedImageUrls.map((url) => String(url || "").trim()).filter(Boolean)
        );
        const allToDelete = [...(ImagesHdCloud || []), ...(referenceImages || [])].filter(
            (url) => url
                && typeof url === "string"
                && url.trim() !== ""
                && !protectedUrls.has(url.trim())
        );
        if (allToDelete.length === 0) return;

        try {
            await Promise.all(
                allToDelete.map(async (url: any) => {
                    try {
                        await startDelete(url);          // your existing helper
                    } catch (err) {
                        console.error(`❌  Couldn’t delete ${url}:`, err);
                    }
                })
            );
        } finally {
            setImagesHdCloud([]);
            setReferenceImages([]);
        }
    };




    // Define the EnhanceText function
    const StartSample = async (pp: any, prompt: any) => {

        try {
            // Prepare the request payload
            const requestData: any = { pp, prompt };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/examplestory`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;


            console.log("example data", data);


            const parsed: any = data.initialSteps;



            console.log("example ", data.initialSteps.keyPoints[0]);

            setPrompt(data.initialSteps.keyPoints[0]);

        } catch (error: any) {


        } finally {
            ///setIsLoading(false);
        }
    }

    const renderModelsButton = (isMobileOnly: boolean) => {
        if (!isStorybookOpen) return null;
        const isMatch = activeModelz === activeHomeModel;
        return (
            <Button
                {...cb('storybook_toolbar', 'open_models', 'Open model selection menu', 'setModelMenuAnchorEl')}
                variant="contained"
                size="small"
                onClick={(e) => setModelMenuAnchorEl(e.currentTarget)}
                disableRipple
                sx={{
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textTransform: "none",
                    border: darkModeReducer ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: { xs: '50%', sm: 12 },
                    width: { xs: '38px', sm: 'auto' },
                    height: { xs: '38px', sm: '44px' },
                    minWidth: { xs: '38px', sm: '40px' },
                    px: { xs: 0, sm: 2 },
                    display: isMobileOnly ? { xs: "flex", sm: "none" } : { xs: "none", sm: "flex" },
                    alignItems: "center",
                    justifyContent: "center",
                    gap: { xs: 0.5, sm: 1 },
                    "&:hover": { background: buttonTheme.hoverBg },
                }}
            >
                <Box sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: isMatch ? '#44ff44' : '#ff4444',
                    boxShadow: `0 0 8px ${isMatch ? '#44ff44' : '#ff4444'}`
                }} />
                <Typography variant="button" sx={{ fontSize: { xs: '0.8rem', sm: '0.8rem' }, fontWeight: 700 }}>
                    {matchMobile ? 'M' : 'Models'}
                </Typography>
            </Button>
        );
    };

    const renderCharactersButton = (isMobileOnly: boolean) => {
        if (!isStorybookOpen) return null;
        return (
            <Button
                {...cb('character_entry', 'open', 'Open Characters studio', 'handleOpenCharacterStudio')}
                variant="contained"
                size="small"
                onClick={() => {
                    if (handleOpenCharacterStudio) handleOpenCharacterStudio();
                }}
                disableRipple
                disableFocusRipple
                sx={{
                    pointerEvents: 'auto',
                    display: isMobileOnly ? { xs: "flex", sm: "none" } : { xs: "none", sm: "flex" },
                    alignItems: "center",
                    justifyContent: "center",
                    gap: matchMobile ? 0 : 0.75,
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    border: darkModeReducer ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: { xs: '50%', sm: 16 },
                    boxShadow: darkModeReducer ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",
                    transition: "all 250ms ease",
                    width: { xs: '38px', sm: 'auto' },
                    minWidth: { xs: '38px', sm: 'auto' },
                    height: { xs: '38px', sm: '42px' },
                    p: { xs: 0, sm: '10px 24px' },
                    "&:hover": {
                        background: buttonTheme.hoverBg,
                        transform: "translateY(0)",
                    },
                    "&:active": {
                        background: "rgba(5, 5, 5, 0.55)",
                        transform: "translateY(0)",
                    }
                }}
            >
                <PeopleIcon sx={{ fontSize: matchMobile ? '1.4rem' : '1.2rem' }} />
                {!matchMobile && (
                    <Typography variant="button" sx={{ lineHeight: 1, fontSize: '0.8rem', fontWeight: 700 }}>
                        Characters
                    </Typography>
                )}
            </Button>
        );
    };

    const renderSlideshowButton = (isMobileOnly: boolean) => {
        // Available in B-shot mode too: the slideshow now previews the final
        // render (A-shots + B-shots, videos where they exist), so B-shot mode
        // is exactly where the user most wants to see it.
        if (!isStorybookOpen || !isStorybookDone) return null;
        return (
            <Button
                {...cb('storybook_toolbar', 'slideshow', 'Slideshow preview is available for the user (information only)', 'onToggleSlideshow', 'click', 'information_only')}
                variant="contained"
                size="small"
                onClick={() => {
                    if (onToggleSlideshow) onToggleSlideshow();
                }}
                disableRipple
                disableFocusRipple
                sx={{
                    pointerEvents: 'auto',
                    display: isMobileOnly ? { xs: "flex", sm: "none" } : { xs: "none", sm: "flex" },
                    alignItems: "center",
                    justifyContent: "center",
                    gap: matchMobile ? 0 : 0.75,
                    background: buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    border: darkModeReducer ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: { xs: '50%', sm: 16 },
                    boxShadow: darkModeReducer ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",
                    transition: "all 250ms ease",
                    width: { xs: '38px', sm: 'auto' },
                    minWidth: { xs: '38px', sm: 'auto' },
                    height: { xs: '38px', sm: '42px' },
                    p: { xs: 0, sm: '10px 24px' },
                    "&:hover": {
                        background: buttonTheme.hoverBg,
                        transform: "translateY(0)",
                    },
                    "&:active": {
                        background: "rgba(5, 5, 5, 0.55)",
                        transform: "translateY(0)",
                    }
                }}
            >
                <PlayCircleOutlineIcon sx={{ fontSize: matchMobile ? '1.4rem' : '1.2rem' }} />
                {!matchMobile && (
                    <Typography variant="button" sx={{ lineHeight: 1, fontSize: '0.8rem', fontWeight: 700 }}>
                        Slideshow
                    </Typography>
                )}
            </Button>
        );
    };

    const renderMusicButton = () => {
        if (type !== 1 || isStorybookOpen || !onOpenMusicPicker) return null;

        return (
            <Button
                variant="contained"
                size="small"
                onClick={onOpenMusicPicker}
                {...cb('styles', 'music', 'Choose Cinema music', 'onOpenMusicPicker')}
                disableRipple
                disableFocusRipple
                startIcon={<MusicNoteIcon sx={{ fontSize: "1.05rem" }} />}
                sx={{
                    ml: landingToolbarContent ? 1 : "auto",
                    background: hasPromptMusic
                        ? alpha(appColor, 0.26)
                        : buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textTransform: "none",
                    border: hasPromptMusic
                        ? `1px solid ${alpha(appColor, 0.75)}`
                        : darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",
                    transition: "all 250ms ease",
                    ...buttonPadding,
                    width: { xs: 38, sm: "auto" },
                    minWidth: { xs: 38, sm: "112px" },
                    px: { xs: 0, sm: 2 },
                    "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } },
                    "&:hover": {
                        background: buttonTheme.hoverBg,
                        transform: "translateY(0)",
                    },
                    "&:active": {
                        background: "rgba(5, 5, 5, 0.55)",
                        transform: "translateY(0)",
                    },
                }}
            >
                <Typography
                    variant="button"
                    sx={{
                        display: { xs: "none", sm: "block" },
                        fontSize: { xs: "0.72rem", sm: "0.78rem" },
                        fontWeight: 800,
                        lineHeight: 1,
                    }}
                >
                    Music
                </Typography>
            </Button>
        );
    };

    useCreationControls('styles', 'PromptToolbar', true, { styleModalOpen, selectedStyle, customStyleInput });
    useCreationControls('character_entry', 'PromptToolbar', isStorybookOpen, { storybookOpen: isStorybookOpen });
    useCreationControls('storybook_toolbar', 'PromptToolbar', isStorybookOpen || creationDeckOpen || showConfirmClose, {
        modelsOpen: Boolean(modelMenuAnchorEl),
        selectedImageModel: flattenedModels.find((model) => model.value === activeModelz)?.name || String(activeModelz || ''),
        selectedHomeModel: flattenedModels.find((model) => model.value === activeHomeModel)?.name || String(activeHomeModel || ''),
        slideshowAvailable: Boolean(isStorybookDone),
    });
    return (
        <>
            {minimizeMode === 2 ? (
                <Box
                    onClick={() => setMinimizeMode && setMinimizeMode(0)}
                    sx={{
                        width: '100%',
                        height: '2.5vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        px: 2,
                        cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 200ms ease',
                        '&:hover': {
                            background: darkMode
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.04)',
                        },
                    }}
                >
                    <OpenInFullIcon sx={{ fontSize: '1.2rem', color: darkMode ? '#fff' : '#333' }} />
                </Box>
            ) : (
            <AppBar
                position="static"
                elevation={0}
                color="transparent"
                /* Stage is surfaced on the DOM so it can be verified in devtools
                   and targeted from CSS while the composer look is reworked. */
                data-creation-stage={creationStage}
                data-composer-stage={isComposerStage ? "true" : "false"}
                data-landing-stage={isLandingStage ? "true" : "false"}
                data-compact-stage={isCompactStage ? "true" : "false"}
                sx={{ width: "100%", mb: 1 }}
            >
                <Toolbar
                    disableGutters
                    sx={{
                        px: { xs: landingToolbarContent ? 1 : 2, sm: isCompactStage ? 1 : 2 },
                        py: { xs: 1, sm: isCompactStage ? 0.4 : 1 },
                        display: "flex",
                        // Compact pill: download / sign-in / morph sit centred, and the
                        // row becomes the containing block for the pinned close button.
                        justifyContent: isCompactStage ? "center" : "flex-start",
                        // Keep absolute toolbar controls (notably Storybook's
                        // CHARACTERS button) anchored to this row in every stage.
                        position: "relative",
                        alignItems: "center",
                        borderRadius: 1,
                        boxShadow: "none",
                    }}
                >
                    {/* Art Style button */}
                    <Box sx={{
                        flexBasis: { xs: "30%", sm: "auto" },
                        flexShrink: 0,
                        pr: { xs: landingToolbarContent ? 1 : 2, sm: 2 },
                        // In the pill the trigger is rendered by PromptInput in Slot C.
                        display: isCompactStage
                            ? "none"
                            : ((GeneratedImageFlux || parsedKeyPoints.length > 0) ? "none" : "block")
                    }}>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => {
                                if (isBlinking && onCancel) onCancel();
                                setStyleModalOpen(true);
                            }}
                            {...cb('styles', 'open', 'Open art styles', 'setStyleModalOpen(true)')}
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* layout */
                                width: { xs: "100%", sm: "auto" },
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",

                                /* professional glass skin */
                                background: buttonTheme.bg,
                                backdropFilter: "blur(24px) saturate(120%)",
                                color: buttonTheme.text,
                                textShadow: "none",
                                ...buttonPadding,

                                border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                                borderRadius: 12,
                                boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                                transform: "translateY(-2px)",

                                transition:
                                    "background 250ms ease, box-shadow 250ms ease, transform 120ms ease, border 250ms ease",
                                display: "flex",
                                animation: isBlinking ? `${blinkOutline} 1s infinite` : "none",

                                /* —— sweep overlay (hidden until hover/press) —— */
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

                                /* hover */
                                "&:hover": {
                                    background: buttonTheme.hoverBg,
                                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.8s ease-out forwards`,
                                    },
                                },

                                /* active */
                                "&:active": {
                                    background: "rgba(5, 5, 5, 0.55)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                                    transform: "translateY(0)",
                                    color: darkMode ? "#ffffff" : "#000000",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.2s ease-out forwards`,
                                    },
                                },

                                /* focus tidy */
                                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                    outline: "none",
                                    boxShadow: "none",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                    color: darkMode ? "#ffffff" : "#000000",
                                },
                                WebkitTapHighlightColor: "transparent",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            <Typography variant="button" sx={{
                                lineHeight: 1,
                                display: 'block',
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                                fontSize: buttonLabelSize,
                            }}>
                                {(!selectedStyle || selectedStyle === 'Auto') ? 'Styles' : selectedStyle}
                            </Typography>
                        </Button>
                    </Box>

                    {/* MorphButton (Pixels): Default PC, Right on Mobile */}
                    <Box sx={{
                        display: introActive ? "none" : "flex",
                        flexBasis: "auto",
                        justifyContent: "flex-start",
                        flexShrink: 0,
                        ml: 0,
                        gap: 1,
                        alignItems: "center"
                    }}>
                        {!(import.meta.env.PROD && landingToolbarContent) && <Box {...cb('storybook_toolbar', 'pixels_balance', 'Pixel balance and purchase control (information only)', 'MorphButton', 'click', 'information_only')}>
                            <MorphButton
                                toolbarStyle
                                isMenuOpen={isMenuOpen}
                                darkMode={darkModeReducer}
                                minimisePrompt={minimisePrompt}
                                handleLoginSuccess={handleLoginSuccess}
                                handleLoginError={handleLoginError}
                                buttonTheme={buttonTheme}
                            />
                        </Box>}

                        {/* Models Glass Dropdown Button */}
                        {renderModelsButton(false)}
                        
                        {/* Slideshow Toggle Button */}
                        {renderSlideshowButton(false)}
                    </Box>

                    {landingToolbarContent}

                    {/* Slot B: the close control, relocated here in the compact pill. */}
                    {isCompactStage && onCompactClose && !allowSpin && (
                        <IconButton
                            onClick={onCompactClose}
                            {...cb('styles', 'close_composer', 'Close Creation composer', 'onCompactClose', 'click', isComposerStage && !isBlinking && !allowSpin ? 'candidate' : 'needs_confirmation')}
                            aria-label="close"
                            disableRipple
                            disableFocusRipple
                            color="inherit"
                            sx={{
                                position: "absolute",
                                right: { xs: 8, sm: 12 },
                                top: "50%",
                                transform: "translateY(-50%)",

                                /* the original close-button box: 44 wide, zero inner padding */
                                width: { xs: '44px', sm: '44px' },
                                height: { xs: '44px', sm: '34px' },
                                padding: 0,

                                /* professional glass base */
                                background: buttonTheme.bg,
                                backdropFilter: "blur(24px) saturate(120%)",
                                color: buttonTheme.text,
                                textShadow: "none",
                                border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                                borderRadius: { xs: "50%", sm: 2 },
                                boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                                transition:
                                    "background .25s ease, box-shadow .25s ease, transform .12s ease, border .25s ease",
                                "&:hover": { background: buttonTheme.hoverBg, color: buttonTheme.hoverText },
                                WebkitTapHighlightColor: "transparent",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            <CancelIcon />
                        </IconButton>
                    )}

                    {renderMusicButton()}

                    {/* The Menu List */}
                    <Menu
                        anchorEl={modelMenuAnchorEl}
                        open={Boolean(modelMenuAnchorEl)}
                        onClose={() => setModelMenuAnchorEl(null)}
                        PaperProps={{
                            sx: {
                                background: darkModeReducer ? "rgba(15, 15, 15, 0.85)" : "rgba(255, 255, 255, 0.85)",
                                backdropFilter: "blur(24px)",
                                border: darkModeReducer ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(255, 255, 255, 0.4)",
                                borderRadius: 3,
                                mt: 1,
                                width: 280,
                                maxWidth: 'calc(100vw - 32px)',
                                "& .MuiList-root": { p: 1 },
                                "& .MuiMenuItem-root": { gap: 1.5, minWidth: 0 },
                                "& .MuiMenuItem-root > .MuiBox-root:has(.MuiTypography-root)": { flex: 1, minWidth: 0 },
                                "& .MuiMenuItem-root > .MuiBox-root .MuiTypography-root": {
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                },
                                "& .MuiMenuItem-root > .MuiTypography-root": {
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                },
                            }
                        }}
                    >
                        {/* Conversation AI controls Brainstorm and Guide only. */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1.5,
                                pt: 0.5,
                                pb: 0.75,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: 0.5,
                                    textTransform: 'uppercase',
                                    color: darkModeReducer ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                }}
                            >
                                Conversation AI
                            </Typography>
                            <LedgerButton
                                appColor={appColor}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setPixelLedgerOpen(true);
                                }}
                            />
                        </Box>

                        {CONVERSATION_MODELS.map((model) => {
                            const isActive = model.id === conversationModel;
                            return (
                                <MenuItem
                                    key={model.id}
                                    {...cb('storybook_toolbar', `select_conversation_${model.id}`, `Select conversation AI ${model.name}`, 'setConversationModel')}
                                    aria-pressed={isActive}
                                    onClick={async (event) => {
                                        event.stopPropagation();
                                        if (isOpenAiConversationProfile(model.id)) {
                                            await notifyOpenAiSelected();
                                        }
                                        dispatch(setConversationModel(model.id as ConversationModelTier));
                                    }}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1.5,
                                        border: `1px solid ${isActive ? appColor : 'transparent'}`,
                                        backgroundColor: isActive ? alpha(appColor, 0.14) : 'transparent',
                                        '&:hover': {
                                            backgroundColor: isActive ? alpha(appColor, 0.2) : 'rgba(255, 255, 255, 0.05)',
                                        },
                                        '&:focus-visible': {
                                            outline: `2px solid ${appColor}`,
                                            outlineOffset: -2,
                                        },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Box>
                                            <Typography
                                                sx={{
                                                    fontSize: 13,
                                                    lineHeight: 1.2,
                                                    fontWeight: isActive ? 700 : 500,
                                                    color: darkModeReducer ? '#fff' : '#000',
                                                }}
                                            >
                                                {model.name}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    mt: 0.2,
                                                    fontSize: 10,
                                                    lineHeight: 1.2,
                                                    color: darkModeReducer ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                                                }}
                                            >
                                                {model.summary}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            border: `2px solid ${isActive ? appColor : alpha(darkModeReducer ? '#fff' : '#000', 0.35)}`,
                                            backgroundColor: isActive ? appColor : 'transparent',
                                            flex: '0 0 auto',
                                        }}
                                    />
                                </MenuItem>
                            );
                        })}

                        <Divider
                            sx={{
                                my: 1,
                                mx: 0.5,
                                borderColor: appColor,
                                borderBottomWidth: 1,
                                opacity: 0.45,
                            }}
                        />

                        {/* Creation AI writes prompts and never changes the image model. */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1.5,
                                pt: 0.5,
                                pb: 0.75,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: 0.5,
                                    textTransform: 'uppercase',
                                    color: darkModeReducer ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                }}
                            >
                                Creation AI
                            </Typography>
                            <LanguageModelCostButton
                                appColor={appColor}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setLlmCostInfoOpen(true);
                                }}
                            />
                        </Box>

                        {LANGUAGE_MODELS.map((lm) => {
                            const isActive = lm.id === languageModel;
                            return (
                                <MenuItem
                                    key={lm.id}
                                    {...cb('storybook_toolbar', `select_creation_${lm.id}`, `Select creation AI ${lm.name}`, 'setLanguageModel')}
                                    aria-pressed={isActive}
                                    onClick={async (event) => {
                                        // Must not call handleSelectModel — that
                                        // is the image model. Menu stays open so
                                        // the change is visible immediately.
                                        event.stopPropagation();
                                        if (lm.id === 'luna' || lm.id === 'luna_extra' || lm.id === 'terra' || lm.id === 'sol_medium' || lm.id === 'sol' || lm.id === 'astra') {
                                            await notifyOpenAiSelected();
                                        }
                                        dispatch(setLanguageModel(lm.id as LanguageModelTier));
                                    }}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1.5,
                                        border: `1px solid ${isActive ? appColor : 'transparent'}`,
                                        backgroundColor: isActive
                                            ? alpha(appColor, 0.14)
                                            : 'transparent',
                                        "&:hover": {
                                            backgroundColor: isActive
                                                ? alpha(appColor, 0.2)
                                                : "rgba(255, 255, 255, 0.05)",
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${appColor}`,
                                            outlineOffset: -2,
                                        },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Box
                                            component="img"
                                            src={lm.image}
                                            alt=""
                                            sx={{
                                                width: 28,
                                                height: 20,
                                                borderRadius: 0.75,
                                                objectFit: 'cover',
                                                filter: lm.imageFilter,
                                                flex: '0 0 auto',
                                            }}
                                        />
                                        <Typography
                                            sx={{
                                                fontSize: 13,
                                                fontWeight: isActive ? 700 : 500,
                                                color: darkModeReducer ? '#fff' : '#000',
                                            }}
                                        >
                                            {lm.name}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        sx={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: isActive
                                                ? appColor
                                                : darkModeReducer
                                                    ? 'rgba(255,255,255,0.5)'
                                                    : 'rgba(0,0,0,0.5)',
                                        }}
                                    >
                                        {lm.pixels} P
                                    </Typography>
                                </MenuItem>
                            );
                        })}

                        <Divider
                            sx={{
                                my: 1,
                                mx: 0.5,
                                borderColor: appColor,
                                borderBottomWidth: 2,
                                opacity: 0.7,
                            }}
                        />

                        <Typography
                            sx={{
                                px: 1.5,
                                pb: 0.75,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                                color: darkModeReducer ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            }}
                        >
                            Image model
                        </Typography>

                        {flattenedModels.map((m) => {
                            const isThisHome = m.value === activeHomeModel;
                            const isThisActive = m.value === activeModelz;
                            
                            let lightColor = 'transparent';
                            if (isThisActive && isThisHome) lightColor = '#44ff44';
                            else if (isThisActive && !isThisHome) lightColor = '#ff4444';
                            else if (!isThisActive && isThisHome) lightColor = '#44aaff';

                            return (
                                <MenuItem
                                    key={m.value}
                                    title={m.value}
                                    {...cb('storybook_toolbar', `select_image_model_${m.value}`, `Select image model ${m.name}`, 'handleSelectModel')}
                                    onClick={() => {
                                        if (handleSelectModel) handleSelectModel(m.value, null);
                                        setModelMenuAnchorEl(null);
                                    }}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: isThisActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
                                        "&:hover": {
                                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Box sx={{
                                            width: 8, height: 8, flexShrink: 0, borderRadius: '50%',
                                            backgroundColor: lightColor,
                                            boxShadow: lightColor !== 'transparent' ? `0 0 8px ${lightColor}` : 'none'
                                        }} />
                                        <Typography sx={{ color: darkModeReducer ? '#fff' : '#000', fontSize: '0.85rem' }}>
                                            {m.name}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ color: appColor, fontWeight: 'bold', fontSize: '0.8rem' }}>
                                        <ModelPixels model={m.value} baseImagesPerDollar={333} />
                                    </Typography>
                                </MenuItem>
                            );
                        })}
                    </Menu>
                    <PixelLedgerDialog
                        open={pixelLedgerOpen}
                        onClose={() => setPixelLedgerOpen(false)}
                        darkMode={darkModeReducer}
                        appColor={appColor}
                    />

                    <LanguageModelCostInfo
                        open={llmCostInfoOpen}
                        onClose={() => setLlmCostInfoOpen(false)}
                        tier={languageModel}
                        sceneCount={parsedKeyPoints?.length ?? 0}
                        cinemaMode={Number(type) === 1}
                        darkMode={darkModeReducer}
                    />

                    {/* Dynamic Characters Revisit Button - CENTERED */}
                    {isStorybookOpen && (
                        <Box sx={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10,
                            display: 'flex',
                            pointerEvents: 'none'
                        }}>
                            {renderCharactersButton(false)}
                        </Box>
                    )}

                    {/* 20% – Spinner */}
                    <LoadingGlass
                        appColor={appColor}
                        allowSpin={false}
                    />

                    <Box sx={{
                        ml: isCompactStage ? 0 : 'auto',
                        order: 1000, // ensure extreme right
                        display: (isStorybookOpen || allowSpin) ? "flex" : "none",
                        justifyContent: "flex-end",
                        gap: 1.5,
                        alignItems: "center",
                        // LoadingGlass is absolutely pinned in compact mode;
                        // keep this host at zero width so it cannot shift centre.
                        width: isCompactStage ? 0 : "auto",
                        flexBasis: isCompactStage ? 0 : "auto",
                    }}>
                        {isStorybookOpen && (
                            <>
                                {renderCharactersButton(true)}
                                {renderModelsButton(true)}
                                {renderSlideshowButton(true)}
                                {/* Minimize/Cycle Mode Button */}
                                <IconButton
                                    {...cb('storybook_toolbar', 'minimize', 'Minimize or restore Creation over feeds', 'setMinimizeMode')}
                                    onClick={() => setMinimizeMode && setMinimizeMode((m: number) => (m + 1) % 3)}
                                    sx={{
                                        /* professional glass skin */
                                        background: buttonTheme.bg,
                                        backdropFilter: "blur(24px) saturate(120%)",
                                        width: { xs: '38px', sm: '44px' },
                                        height: { xs: '38px', sm: '44px' },
                                        border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                                        borderRadius: { xs: '50%', sm: 12 },
                                        boxShadow: '12px 12px 40px rgba(0, 0, 0, 0.6)',
                                        transform: "translateY(-2px)",
                                        transition: "all 250ms ease",
                                        position: "relative",
                                        overflow: "hidden",
                                        "&::before": {
                                            content: '""',
                                            position: "absolute",
                                            top: "-40%",
                                            left: 0,
                                            width: "60%",
                                            height: "180%",
                                            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                            backgroundSize: "200% 200%",
                                            transform: "translateX(-150%) rotate(20deg)",
                                            opacity: 0,
                                            pointerEvents: "none",
                                        },
                                        "&:hover": {
                                            background: buttonTheme.hoverBg,
                                            transform: "translateY(0)",
                                            "&::before": {
                                                opacity: 0.8,
                                                animation: `${glassSweep} 1.8s ease-out forwards`,
                                            },
                                        },
                                        "&:active": {
                                            background: "rgba(5, 5, 5, 0.55)",
                                            transform: "translateY(0)",
                                        },
                                    }}
                                >
                                    {minimizeMode === 0 ? (
                                        <CloseFullscreenIcon sx={{ fontSize: '1.3rem', color: buttonTheme.text }} />
                                    ) : (
                                        <ArrowBackIosIcon sx={{ transform: 'rotate(90deg)', fontSize: '1rem', color: buttonTheme.text }} />
                                    )}
                                </IconButton>

                                <IconButton
                                    {...cb('storybook_toolbar', 'close', minimizeMode === 2 ? 'Restore minimized Creation' : 'Open close-creation confirmation', minimizeMode === 2 ? 'setMinimizeMode(0)' : 'setShowConfirmClose')}
                                    edge="end"
                                    onClick={() => {
                                        if (minimizeMode === 2 && setMinimizeMode) {
                                            setMinimizeMode(0);
                                        } else {
                                            openCloseReview();
                                        }
                                    }}
                                    aria-label="close"
                                    disableRipple
                                    disableFocusRipple
                                    sx={{
                                        /* professional glass skin */
                                        background: buttonTheme.bg,
                                        backdropFilter: "blur(24px) saturate(120%)",
                                        width: { xs: '38px', sm: '44px' },
                                        height: { xs: '38px', sm: '44px' },
                                        border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                                        borderRadius: { xs: '50%', sm: 12 },
                                        boxShadow: '12px 12px 40px rgba(0, 0, 0, 0.6)',
                                        transform: "translateY(-2px)",
                                        transition: "all 250ms ease",
                                        position: "relative",
                                        overflow: "hidden",
                                        "&::before": {
                                            content: '""',
                                            position: "absolute",
                                            top: "-40%",
                                            left: 0,
                                            width: "60%",
                                            height: "180%",
                                            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                            backgroundSize: "200% 200%",
                                            transform: "translateX(-150%) rotate(20deg)",
                                            opacity: 0,
                                            pointerEvents: "none",
                                        },
                                        "&:hover": {
                                            background: buttonTheme.hoverBg,
                                            transform: "translateY(1px)",
                                            "&::before": {
                                                opacity: 0.8,
                                                animation: `${glassSweep} 1.8s ease-out forwards`,
                                            },
                                        },
                                        "&:active": {
                                            background: "rgba(5, 5, 5, 0.55)",
                                            transform: "translateY(0)",
                                        },
                                    }}
                                >
                                    <CloseIcon
                                        sx={{
                                            fontSize: "1.7rem",
                                            color: buttonTheme.text,
                                        }}
                                    />
                                </IconButton>
                            </>
                        )}

                        <LoadingGlass
                            appColor={appColor}
                            allowSpin={allowSpin}
                        />
                    </Box>

                    {/* ——— SAFETY CONFIRMATION OVERLAY ——— */}
                    {showConfirmClose && renderCloseReview(
                        <Box role="alertdialog" aria-modal="true" aria-label="Confirm close creation" sx={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: deckCloseReview ? 1000003 : 10000,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}>
                            <Box
                                {...cb('storybook_toolbar', 'confirm_close', 'Yes, close and wipe the current creation', 'handleCloseOverlay', 'click', 'needs_confirmation')}
                                aria-disabled={closingCreation || undefined}
                                aria-busy={closingCreation || undefined}
                                data-creation-blocked={closingCreation ? 'true' : undefined}
                                onClick={async () => {
                                    if (closingCreationRef.current) return;
                                    closingCreationRef.current = true;
                                    setClosingCreation(true);
                                    const epoch = closeReviewEpoch.current;
                                    try {
                                        if (!await reviewDraftBeforeClose() || epoch !== closeReviewEpoch.current) return;
                                        setShowConfirmClose(false);
                                        resetCreationLedger();
                                        if (magicMode) {
                                            onClose();
                                        } else {
                                            setDummyMode(false);
                                            bulkDeleteImages();
                                            // Only the initial PromptInput/composer X is an
                                            // intentional full selection reset. Storybook and
                                            // other active creation stages keep World/direct VIPs.
                                            if (creationStage === 'composer') {
                                                onClearCreationReferences?.();
                                            }
                                            setVideMode(false);
                                            destroyAllFluxCalls();
                                            await handleCloseOverlay();
                                        }
                                    } finally {
                                        closingCreationRef.current = false;
                                        setClosingCreation(false);
                                    }
                                }}
                                sx={{
                                    flex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.8)',
                                    backdropFilter: 'blur(30px)',
                                    color: '#fff', fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    '&:hover': { bgcolor: darkModeReducer ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.25)' }
                                }}
                            >
                                <Box sx={{ textAlign: 'center' }}>
                                    YES
                                    {(reviewingDraft || draftSaving || draftSaved || draftReviewFailed || draftError) && (
                                        <Typography role="status" aria-live="polite" sx={{ fontSize: '0.9rem', letterSpacing: 0, mt: 1 }}>
                                            {reviewingDraft ? 'Saving draft…' : (draftReviewFailed || draftError) ? 'Draft not saved' : draftSaving ? 'Saving draft…' : 'Draft saved'}
                                        </Typography>
                                    )}
                                    {draftReviewFailed && draftReviewError && <Typography role="alert"
                                        sx={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: 0, mt: 1, maxWidth: 480, px: 2 }}>
                                        {draftReviewError}
                                    </Typography>}
                                </Box>
                            </Box>
                            <Box
                                {...cb('storybook_toolbar', 'cancel_close', 'No, keep current creation', 'setShowConfirmClose')}
                                onClick={() => { closeReviewEpoch.current++; setShowConfirmClose(false); }}
                                sx={{
                                    flex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)',
                                    backdropFilter: 'blur(30px)',
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
                    <Box
                        onClick={() => {
                            if (type === 0) Manual();
                            else StartSample("", "");
                        }}
                        sx={{ flexBasis: "40%", pr: 1, display: "none" }}
                    >
                        <Button
                            variant="contained"
                            size="small"
                            //    onClick={() => setStyleModalOpen(true)}
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* layout */
                                width: { xs: "100%", sm: "auto" },
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",

                                /* professional glass skin */
                                background: buttonTheme.bg,
                                backdropFilter: "blur(24px) saturate(120%)",
                                color: buttonTheme.text,
                                textShadow: "none",
                                ...buttonPadding,

                                border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                                borderRadius: 12,
                                boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                                transform: "translateY(-2px)",

                                transition:
                                    "background 250ms ease, box-shadow 250ms ease, transform 120ms ease, border 250ms ease",
                                display: "flex",

                                /* —— sweep overlay (hidden until hover/press) —— */
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

                                /* hover */
                                "&:hover": {
                                    background: buttonTheme.hoverBg,
                                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.8)" : "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.8s ease-out forwards`,
                                    },
                                },

                                /* active */
                                "&:active": {
                                    background: "rgba(5, 5, 5, 0.55)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.2s ease-out forwards`,
                                    },
                                },

                                /* focus tidy */
                                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                    outline: "none",
                                    boxShadow: "none",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                },
                                WebkitTapHighlightColor: "transparent",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            <Typography variant="button" sx={{ lineHeight: 1 }}>
                                {type === 0 ? "Upload" : "Sample"}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    lineHeight: 1,
                                    fontSize: "0.55rem",
                                    mt: 0.75,
                                    color: "#ffffff",
                                }}
                            >
                                {type === 0 ? "remix" : "stories"}
                            </Typography>
                        </Button>
                    </Box>


                </Toolbar>
            </AppBar>
            )}



            <Dialog
                open={styleModalOpen}
                onClose={() => setStyleModalOpen(false)}
                disableEnforceFocus
                aria-labelledby="art-style-picker-heading"
                maxWidth={false}
                classes={{ container: 'social-panel-container' }}
                slotProps={{ backdrop: { className: 'social-panel-backdrop' } }}
                PaperProps={{
                    className: `social-panel ${darkMode ? 'social-panel-dark' : ''}`,
                    style: { '--chat-accent': appColor } as React.CSSProperties,
                }}
                sx={{ '@media (max-width: 600px)': { '& .MuiDialog-container': { alignItems: 'flex-end' } } }}
                style={{ position: "fixed", zIndex: 6000 }}
            >
                <header className="social-chat-header social-picker-header">
                    <h2 id="art-style-picker-heading">Select Art Style</h2>
                    <IconButton
                        aria-label="Close art style selector"
                        {...cb('styles', 'close', 'Close art styles', 'setStyleModalOpen(false)')}
                        onClick={() => setStyleModalOpen(false)}
                    >
                        <CloseIcon />
                    </IconButton>
                </header>

                <DialogContent style={{ paddingTop: 8, paddingBottom: 8, display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minHeight: 0 }}>
                    {/* --- ALWAYS-VISIBLE “Auto” OPTION --- */}
                    <List style={{ paddingTop: 0 }}>
                        <ListItemButton
                            selected={selectedStyle === "Auto"}
                            onClick={() => handleSelectStyle("Auto")}
                            {...cb('styles', 'auto', 'Use Auto style', 'handleSelectStyle(Auto)')}
                            style={
                                selectedStyle === "Auto" ? selectedItemStyle : defaultItemStyle
                            }
                        >
                            <Typography variant="body1">Auto</Typography>
                        </ListItemButton>
                    </List>

                    {/* --- SCROLLABLE LIST OF PREDEFINED STYLES --- */}
                    <ArtStyleSelector
                        matchMobile={matchMobile}
                        dividerColor={dividerColor}
                        selectedStyle={selectedStyle}
                        handleSelectStyle={handleSelectStyle}
                        selectedItemStyle={selectedItemStyle}
                        defaultItemStyle={defaultItemStyle}
                        imagesMap={imagesMap}
                        setImagesMap={setImagesMap}
                        generatingStyle={generatingStyle}
                        setGeneratingStyle={setGeneratingStyle}
                        progress={progress}
                        setProgress={setProgress}
                        showReGenPill={showReGenPill}
                        setShowReGenPill={setShowReGenPill}
                        handleGenerateImage={handleGenerateImage}
                    />

                    {/* --- CUSTOM STYLE INPUT (BOTTOM) --- */}
                </DialogContent>
                <DialogActions className="social-picker-footer" sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TextField
                            label="Custom style"
                            size="small"
                            variant="outlined"
                            fullWidth
                            value={customStyleInput}
                            inputProps={cb('styles', 'custom', 'Custom art style', 'setCustomStyleInput; blur/Enter handleSaveCustom', 'text')}
                            onChange={(e) => setCustomStyleInput(e.target.value)}
                            onBlur={handleSaveCustom}
                            placeholder="Enter custom style (press Enter)"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveCustom();
                                }
                            }}
                            InputLabelProps={{ style: { color: textPrimary } }}
                            InputProps={{ style: { color: textPrimary } }}

                            sx={{
                                "& .MuiInputBase-root:focus": {
                                    outline: "none", // Remove focus outline on the input root
                                },
                                "& .MuiInputBase-input:focus-visible": {
                                    outline: "none", // Remove focus outline on the input
                                },
                                "& .Mui-focused": {
                                    outline: "none", // Remove Material-UI's focus outline
                                },
                                "& .MuiInputBase-input": {
                                    color: darkMode ? "#ffffff" : "#000000", // Text color
                                    fontSize: matchMobile ? '1rem' : '1.1rem',
                                    caretColor: 'auto !important',
                                    /// outline: 'auto !important',
                                },
                            }}
                        />
                    </Box>
                    <Button 
                        {...cb('styles', 'done', 'Finish style selection', 'setStyleModalOpen(false)')}
                        onClick={() => { handleSaveCustom(); setStyleModalOpen(false); }}
                        sx={{ color: appColor, flexShrink: 0 }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog>




        </>
    );
};

export default PromptToolbar;
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
