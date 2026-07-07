import React, { useEffect, useState, useRef } from "react";
import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Typography,
    CircularProgress,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItemButton,
    TextField,
    Menu,
    MenuItem
} from "@mui/material";

import { ArtStyleSelector } from "./ArtStyleSelector"; // adjust path as needed
import ModelPixels from './ModelPixels';

import { keyframes } from "@emotion/react";

import { matchMobile } from "./DetectDevice";
import MorphButton from './MorphButton';
import CloseIcon from "@mui/icons-material/Close";
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
import { setArtstyle, setPixels } from "./settingsSlice";
import { calcModelPixels } from "./ModelPixels";





interface PromptToolbarProps {
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
    buttonTheme?: { bg: string; text: string; hoverBg: string; hoverText: string };
}

const PromptToolbar: React.FC<PromptToolbarProps> = ({
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
    buttonTheme = {
        bg: "rgba(10, 10, 10, 0.45)",
        text: "#ffffff",
        hoverBg: "rgba(15, 15, 15, 0.65)",
        hoverText: "#ffffff",
    }
}) => {
    const [showConfirmClose, setShowConfirmClose] = useState(false);
    const [modelMenuAnchorEl, setModelMenuAnchorEl] = useState<null | HTMLElement>(null);

    const activeModelz = modelz?.toLowerCase() === 'models' ? 'Schnell' : modelz;
    const activeHomeModel = homeModel?.toLowerCase() === 'models' ? 'Schnell' : homeModel;

    const flattenedModels = [
        { name: 'Nano Banana Pro', value: 'fluxUltra2' },
        { name: 'Nano Banana 2', value: 'Imagen' },
        { name: 'Nano Banana', value: 'Imagen2' },
        { name: 'GPT 2', value: 'Gpt Image' },
        { name: 'Flux Max', value: 'fluxUltra' },
        { name: 'See Dream 4.5', value: 'minimax' },
        { name: 'See Dream 4', value: 'minimax2' },
        { name: 'Klein', value: 'Schnell' },
    ];


    const CLIK_URL = import.meta.env.VITE_CLIK_URL;



    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const darkMode = darkModeReducer;

    const dispatch = useDispatch();
    const isDarkMode = darkModeReducer;
    const isStorybookOpen = Boolean(GeneratedImageFlux || parsedKeyPoints.length > 0);


    const artstyleRedux = useSelector((state: RootState) => state.settings.artstyle);


    /* ------ palette helpers ------ YES */
    const bgDialog = isDarkMode ? "#121212" : "#ffffff";
    const bgList = isDarkMode ? "#1e1e1e" : "#fafafa";
    const textPrimary = isDarkMode ? "#ffffff" : "#ffffff";
    const dividerColor = isDarkMode ? "rgba(255,255,255,0.12)" : "#e0e0e0";

    const selectedItemStyle = {
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        color: "#ffffff",
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
    const buttonPadding = { px: 3, minWidth: { xs: '94px', sm: '100px' }, height: { xs: '38px', sm: '44px' } } as const;

    // ---------------- Artâ€‘style picker state ----------------
    const [styleModalOpen, setStyleModalOpen] = useState(false);

    const activeModel = useSelector((state: RootState) => state.settings.model);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

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
        if (model === "Schnell" || model === "Models") return "fluxschnell";
        if (model === "fluxUltra") return "fluxUltra";
        if (model === "Hi Dream") return "HiDream";
        if (model === "minimax") return "minimax";
        if (model === "Imagen") return "Imagen";
        if (model === "Gpt Image") return "GptImage";
        return "fluxschnell"; // fallback
    };

    const handleGenerateImage = async (e: React.MouseEvent, styleName: string) => {
        e.stopPropagation();
        if (!loggedUser || !loggedUser.id) return alert("Please log in first.");

        if (reGenTimeoutRef.current) {
            clearTimeout(reGenTimeoutRef.current);
            reGenTimeoutRef.current = null;
        }

        const cost = calcModelPixels({ model: activeModel, baseImagesPerDollar: 333 });
        const modelRoute = getModelRoute(activeModel);

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
            const spendRes = await axios.post(`${CLIK_URL}/spendPixels`, {
                values: { userid: loggedUser.id, amount: cost }
            }, { withCredentials: true });

            if (spendRes.data.error) {
                clearInterval(interval);
                alert("Not enough credits.");
                setGeneratingStyle(null);
                setProgress(0);
                return;
            }
            dispatch(setPixels(spendRes.data.pixels));

            const gptRes = await axios.post(`${CLIK_URL}/GptArtstylePrompt`, { artstyleName: styleName });
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
            };

            const imageRes = await axios.post(`${CLIK_URL}/${modelRoute}`, payload, { withCredentials: true });
            const imageBase64 = imageRes.data.imageBase64 || imageRes.data.image;

            if (!imageBase64) throw new Error("No image returned");

            const rawBlob = await fetch(imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`).then(r => r.blob());

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
        // Debounce the dispatch to prevent typing issues
        const timer = setTimeout(() => {
            dispatch(setArtstyle(customStyleInput));
        }, 5000); // 5 seconds delay

        return () => clearTimeout(timer);
    }, [customStyleInput, dispatch])






    const handleSelectStyle = (style: string) => {
        setSelectedStyle(style);
        setCustomStyleInput(style);
        // any other sideâ€‘effects (e.g., dispatch) can be added here
    };

    const handleSaveCustom = () => {
        if (customStyleInput.trim()) {
            handleSelectStyle(customStyleInput.trim());
            setCustomStyleInput("");
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
        darkModeReducer,
        allowSpin,
    }: {
        darkModeReducer: boolean;
        allowSpin: boolean;
    }) {
        // Use HSL so we can reuse the exact hue with different alphas for a true "glass" feel
        // pink ~ hsl(283 86% 85%), light blue ~ hsl(195 100% 40%)
        const hue = darkModeReducer ? "283 86% 85%" : "195 100% 40%";

        return (
            <Box
                sx={{
                    flexBasis: "auto",
                    display: allowSpin ? "flex" : "none",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    flexShrink: 0,
                    ml: 1,
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
                        background: `linear-gradient(180deg, hsl(${hue} / 0.18), hsl(${hue} / 0.40))`,
                        boxShadow: `
            0 0 8px hsl(${hue} / 0.55),
            inset 0 0 10px hsl(${hue} / 0.35)
          `,

                        // crisp tinted border + inner glow (same hue)
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            borderRadius: "inherit",
                            border: `1px solid hsl(${hue} / 0.9)`,
                            boxShadow: `inset 0 0 16px hsl(${hue} / 0.45)`,
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
    hsl(${hue} / 0.10) 22%,
    hsl(${hue} / 0.60) 50%,
    hsl(${hue} / 0.10) 78%,
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


    // 1ï¸âƒ£  Create one â€œbulk-deleteâ€ helper
    const bulkDeleteImages = async () => {
        // Combine scene images and character portraits for cloud cleanup
        const allToDelete = [...(ImagesHdCloud || []), ...(referenceImages || [])].filter(url => url && typeof url === 'string' && url.trim() !== "");
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
        if (!isStorybookOpen || !isStorybookDone || isBShotModeActive) return null;
        return (
            <Button
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
                disableRipple
                disableFocusRipple
                startIcon={<MusicNoteIcon sx={{ fontSize: "1.05rem" }} />}
                sx={{
                    ml: "auto",
                    background: hasPromptMusic
                        ? "rgba(232, 186, 250, 0.26)"
                        : buttonTheme.bg,
                    backdropFilter: "blur(24px) saturate(120%)",
                    color: buttonTheme.text,
                    textTransform: "none",
                    border: hasPromptMusic
                        ? "1px solid rgba(232, 186, 250, 0.75)"
                        : darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: 12,
                    boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                    transform: "translateY(-2px)",
                    transition: "all 250ms ease",
                    ...buttonPadding,
                    minWidth: { xs: "92px", sm: "112px" },
                    "& .MuiButton-startIcon": { mr: 0.75 },
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
                elevation={1}
                color="transparent"
                sx={{ width: "100%", mb: 1 }}
            >
                <Toolbar
                    disableGutters
                    sx={{
                        px: 2,
                        py: 1,
                        display: "flex",
                        alignItems: "center",
                        borderRadius: 1,
                        boxShadow: 1,
                    }}
                >
                    {/* Art Style button */}
                    <Box sx={{
                        flexBasis: { xs: "30%", sm: "auto" },
                        flexShrink: 0,
                        pr: 2,
                        display: (GeneratedImageFlux || parsedKeyPoints.length > 0) ? "none" : "block"
                    }}>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => {
                                if (isBlinking && onCancel) onCancel();
                                setStyleModalOpen(true);
                            }}
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

                                /* â€”â€” sweep overlay (hidden until hover/press) â€”â€” */
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
                                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            }}>
                                {(!selectedStyle || selectedStyle === 'Auto') ? 'Styles' : selectedStyle}
                            </Typography>
                        </Button>
                    </Box>

                    {/* MorphButton (Pixels): Default PC, Right on Mobile */}
                    <Box sx={{
                        display: "flex",
                        flexBasis: "auto",
                        justifyContent: "flex-start",
                        flexShrink: 0,
                        ml: 0,
                        gap: 1,
                        alignItems: "center"
                    }}>
                        <MorphButton isMenuOpen={isMenuOpen} darkMode={darkModeReducer} minimisePrompt={minimisePrompt} buttonTheme={buttonTheme} />

                        {/* Models Glass Dropdown Button */}
                        {renderModelsButton(false)}

                        {/* Slideshow Toggle Button */}
                        {renderSlideshowButton(false)}
                    </Box>

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
                                minWidth: '220px',
                                "& .MuiList-root": { p: 1 },
                            }
                        }}
                    >
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
                                            width: 8, height: 8, borderRadius: '50%',
                                            backgroundColor: lightColor,
                                            boxShadow: lightColor !== 'transparent' ? `0 0 8px ${lightColor}` : 'none'
                                        }} />
                                        <Typography sx={{ color: darkModeReducer ? '#fff' : '#000', fontSize: '0.85rem' }}>
                                            {m.name}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ color: '#0099cc', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                        <ModelPixels model={m.value} baseImagesPerDollar={333} />
                                    </Typography>
                                </MenuItem>
                            );
                        })}
                    </Menu>

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

                    {/* 20% â€“ Spinner */}
                    <LoadingGlass
                        darkModeReducer={darkModeReducer}
                        allowSpin={false}
                    />

                    <Box sx={{
                        ml: 'auto',
                        order: 1000, // ensure extreme right
                        display: (isStorybookOpen || allowSpin) ? "flex" : "none",
                        justifyContent: "flex-end",
                        gap: 1.5,
                        alignItems: "center"
                    }}>
                        {isStorybookOpen && (
                            <>
                                {renderCharactersButton(true)}
                                {renderModelsButton(true)}
                                {renderSlideshowButton(true)}
                                {/* Minimize/Cycle Mode Button */}
                                <IconButton
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
                                    edge="end"
                                    onClick={() => {
                                        if (minimizeMode === 2 && setMinimizeMode) {
                                            setMinimizeMode(0);
                                        } else {
                                            setShowConfirmClose(true);
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
                            darkModeReducer={darkModeReducer}
                            allowSpin={allowSpin}
                        />
                    </Box>

                    {/* â€”â€”â€” SAFETY CONFIRMATION OVERLAY â€”â€”â€” */}
                    {showConfirmClose && (
                        <Box sx={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 10000,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}>
                            <Box
                                onClick={() => {
                                    setShowConfirmClose(false);
                                    if (magicMode) {
                                        onClose();
                                    } else {
                                        setDummyMode(false);
                                        bulkDeleteImages();
                                        setVideMode(false);
                                        destroyAllFluxCalls();
                                        handleCloseOverlay();
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
                                YES
                            </Box>
                            <Box
                                onClick={() => setShowConfirmClose(false)}
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

                                /* â€”â€” sweep overlay (hidden until hover/press) â€”â€” */
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
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    style: {
                        backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                        backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",

                    }
                }}
                style={{ position: "fixed", zIndex: 6000 }}
            >
                <DialogTitle style={{ paddingBottom: 0, color: textPrimary }}>
                    Select Art Style
                </DialogTitle>

                <DialogContent style={{ paddingTop: 8 }}>
                    {/* --- ALWAYS-VISIBLE â€œAutoâ€ OPTION --- */}
                    <List style={{ paddingTop: 0 }}>
                        <ListItemButton
                            selected={selectedStyle === "Auto"}
                            onClick={() => handleSelectStyle("Auto")}
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
                    <Box style={{ marginTop: 16 }}>
                        <TextField
                            label="Custom style"
                            variant="outlined"
                            fullWidth
                            value={customStyleInput}
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
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() => setStyleModalOpen(false)}
                        sx={{ color: darkModeReducer ? '#E8BAFA' : '#0099cc' }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog>




        </>
    );
};

export default PromptToolbar;
