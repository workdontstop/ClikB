import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IconButton, Button, Menu, MenuItem, TextField, Typography, CircularProgress, Box } from '@mui/material';
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import PhotoIcon from '@mui/icons-material/Photo';
import WeekendIcon from '@mui/icons-material/Weekend';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { useDispatch, useSelector } from 'react-redux';
import { setModel, cycleAspectRatio } from './settingsSlice';
import { RootState } from './store';
import { calcModelPixels } from './ModelPixels';
import MirrorView from './MirrorView';
import shortsImage from '../shorts.jpg';
import cinemaImage from '../cinema.jpg';
import gamesImage from '../games.jpg';

interface MirrorProps {
    isMenuOpen?: boolean;
    magicMode: boolean;
    prompt: string;
    setPrompt: (value: string) => void;
    handleStartSubmit: () => void;
    darkModeReducer: boolean;
    matchMobile: boolean;
    navigate: (path: string) => void;
    GeneratedImage: string[];
    GeneratedImageFlux: string;
    setGeneratedImage: (value: string[]) => void;
    setGeneratedImageFlux: (value: string) => void;
    setminimisePrompt: (value: boolean) => void;
    loggedUser: any;
    setModelz: (value: string) => void;
    type: number;
    setType: (value: number) => void;
    parsedKeyPoints: string[];
    setParsedKeyPoints: (value: string[]) => void;
    CreationMode: string;
    setCreationMode: (value: string) => void;
    setallowgetImage: (value: boolean) => void;
    generatedImagesFluxx: string[];
    setGeneratedImagesFluxx: (value: string[]) => void;
    parsedKeyPoints2: string[];
    onClose: () => void;
    startAgentCasting?: () => void;
    referenceImages?: any[];
    referencePendingCount?: number;
    castingStatus?: string;
    isAgentCasting?: boolean;
    nanoImages?: string[];
    loadersArray?: number[];
    onToggleSlideshow?: () => void;
    setinstantCall?: (val: boolean) => void;
    isNativeMagicMode?: boolean;
    isMirrorFocused?: boolean;
}

// Defined based on ModelSelectionModal logic Provide a Top 10 list of fascinating places, historical events, memorable moments, or iconic cars. You choose the topic!
const ALL_MODELS = [
    { label: "Nano Banana Pro", key: "fluxUltra2" },
    { label: "Nano Banana 2", key: "Imagen" },
    { label: "Nano Banana", key: "Imagen2" },
    { label: "GPT 2", key: "Gpt Image" },
    { label: "Flux Max", key: "fluxUltra" },
    { label: "See Dream 4.5", key: "minimax" },
    { label: "See Dream 4", key: "minimax2" },
    { label: "Klein", key: "Schnell" },
];




const TEMPLATE_PROMPTS = {

    story: `Cinematic Historical Narrative. Constraints: Select a Random  moment in human history. Structure as an epic, 3-act documentary explainer. Tone: Dramatic, visually expansive, and heavily detailed.`,

    top10: `High-Velocity Ranking. Constraints: Generate a Top 5 list of meals based on a specific Random country Structure: Aggressive hook, rapid-fire countdown from 5 to 1, and a definitive conclusion.`,

    wildlife: `Premium Wildlife Documentary. Constraints: Select a Random, Earth biome , Focus 100% on predator-prey dynamics, animal biology, and ecosystem survival. Ignore human geography entirely.`,

    exercise: `Pretend You Are My Personal Trainer and I Came To Your House, Give yourself a persona,  show me your daily workout routine while giving me a tour of your house,  Provide a healthy exercise routine while slighthly focusing on showing me your house bragging about your wealth or trying to get me to buy you a new furniture, or asking for asking for an unformal freidnly meeting later (use these as scenario randomisers) you could be very rich, rich, average or poor income`,
};
const Mirror: React.FC<MirrorProps> = ({
    isMenuOpen = false,
    magicMode,
    prompt,
    setPrompt,
    handleStartSubmit,
    darkModeReducer,
    matchMobile,
    navigate,
    GeneratedImage,
    GeneratedImageFlux,
    setGeneratedImage,
    setGeneratedImageFlux,
    setminimisePrompt,
    loggedUser,
    setModelz,
    type,
    setType,
    setinstantCall,
    parsedKeyPoints,
    setParsedKeyPoints,
    CreationMode,
    setCreationMode,
    setallowgetImage,
    generatedImagesFluxx,
    setGeneratedImagesFluxx,
    parsedKeyPoints2,
    onClose,
    startAgentCasting,
    referenceImages,
    referencePendingCount,
    castingStatus,
    isAgentCasting,
    nanoImages,
    loadersArray,
    onToggleSlideshow,
    isNativeMagicMode,
    isMirrorFocused,
}) => {
    const dispatch = useDispatch();
    const currentModelRedux = useSelector((state: RootState) => state.settings.model);
    const pixels = useSelector((state: RootState) => state.settings.pixels);
    const ratioKey = useSelector((state: RootState) => state.settings.aspectRatio);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);

    // Typewriter State
    const [showStopper, setShowStopper] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const [isGoLoading, setIsGoLoading] = useState(false);
    // stage1 serves as a gate: defaults to true (hidden), set to false on GO, back to true on close.
    const [stage1, setStage1] = useState(true);
    const [planInfo, setPlanInfo] = useState(0); // 0=none, 1=searching, 2=typing
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Dummy text for immediate feedback while API loads
    const dummyPlanSteps = useMemo(() => [
        "Analyzing your request...",
        "Gathering relevant information...",
        "Structuring content flow...",
        "Preparing visual elements...",
        "Finalizing generation plan...",
    ], []);

    const [blinkOn, setBlinkOn] = useState(true);
    const [titleIndex, setTitleIndex] = useState(0);

    const plan2Titles = useMemo(() => [
        { emoji: "ðŸ“", text: "Creating a plan." },
        { emoji: "ðŸŽ¨", text: "Creating Consistent Style..." },
        { emoji: "ðŸŽ’", text: "Applying Content Plan.ðŸ“" },
        { emoji: "â³", text: "Processing..." },
        { emoji: "âœï¸", text: "almost there, Creating Content..." },
    ], []);

    // Blinking effect for Step 1
    useEffect(() => {
        if (planInfo !== 1) return;
        const id = setInterval(() => setBlinkOn((b) => !b), 600);
        return () => clearInterval(id);
    }, [planInfo]);

    // Clear PlanSteps state on unmount
    useEffect(() => {
        return () => {
            // Clean up any remaining state if necessary
        };
    }, []);

    // Prevent browser back/forward swipe navigation on this page
    useEffect(() => {
        // Store original overscroll behavior
        const originalOverscroll = document.body.style.overscrollBehaviorX;

        // Disable horizontal overscroll to prevent sway-back navigation
        document.body.style.overscrollBehaviorX = "none";

        return () => {
            // Restore original on unmount
            document.body.style.overscrollBehaviorX = originalOverscroll;
        };
    }, []);

    // Title rotation for Step 2
    useEffect(() => {
        setTitleIndex(0);
        if (planInfo !== 2) return;
        const id = setInterval(() => {
            setTitleIndex((i) => (i < plan2Titles.length - 1 ? i + 1 : i));
        }, 4000);
        return () => clearInterval(id);
    }, [planInfo, plan2Titles]);

    // Caret blinking

    // Dummy typing logic
    // Simplified typing logic using index cycling
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    useEffect(() => {
        if (planInfo !== 2) {
            setCurrentStepIndex(0);
            return;
        }

        const intervalId = setInterval(() => {
            setCurrentStepIndex((prev) => {
                const next = prev + 1;
                return next < dummyPlanSteps.length ? next : prev; // Stop at end or loop? User wanted sequential
            });
        }, 3000); // Change step every 3 seconds

        return () => clearInterval(intervalId);
    }, [planInfo, dummyPlanSteps]);

    // Current phrase to show
    const currentPhrase = useMemo(() => {
        if (planInfo !== 2) return "";
        return dummyPlanSteps[currentStepIndex] || "";
    }, [planInfo, currentStepIndex, dummyPlanSteps]);

    /* Removing auto-scroll - user wants to read from the top */

    // Handle Typewriter Effect
    const filteredPoints = useMemo(() => {
        if (type === 1) {
            return parsedKeyPoints.filter((_, idx) => idx % 2 === 0);
        }
        return parsedKeyPoints;
    }, [parsedKeyPoints, type]);

    // When real data arrives, show stopper IMMEDIATELY (no typing delay)
    useEffect(() => {
        if (filteredPoints.length > 0 && GeneratedImage.length === 0 && !GeneratedImageFlux) {
            // Real data arrived - stop dummy typing and show stopper immediately
            setPlanInfo(0);
            setShowStopper(true);
            setIsGoLoading(false);
            setIsLocalLoading(false);
        } else {
            setShowStopper(false);
        }
    }, [filteredPoints, GeneratedImage.length, GeneratedImageFlux]);

    // Reset local loading only when stopper shows (typing complete)
    useEffect(() => {
        if (showStopper) {
            setIsLocalLoading(false);
        }
    }, [showStopper]);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            setIsFocused(false);
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }

            if (modelValue === "Models" || !currentModelRedux) {
                dispatch(setModel("Imagen2"));
                setModelz("Imagen2");
            }

            if (type === 1) {
                if (setminimisePrompt) {
                    setminimisePrompt(false);
                }
                if (setinstantCall) setinstantCall(true);
                navigate("/kickit");
            } else {
                if (setminimisePrompt) {
                    setminimisePrompt(false);
                }
                if (setinstantCall) setinstantCall(true);
                navigate("/images");
            }

            /*
            setIsLocalLoading(true);
            // Start dummy typing immediately: phase 1 (searching), then phase 2 (typing)
            setPlanInfo(1);
            setTimeout(() => setPlanInfo(2), 1500); // Move to typing phase after 1.5s
            handleStartSubmit();
            */
        }
    };

    // Dropdown States
    const [anchorElExplain, setAnchorElExplain] = useState<null | HTMLElement>(null);
    const [anchorElModels, setAnchorElModels] = useState<null | HTMLElement>(null);
    const [expandedChoiceScene, setExpandedChoiceScene] = useState<number>(0);
    const [planEditText, setPlanEditText] = useState("");

    // Sync explainValue with type prop
    const explainValue = type === 0 ? "Images" : "Explain";

    const [modelValue, setModelValue] = useState("Models");

    // Character Zoom Modal States
    const [zoomedCharacterIdx, setZoomedCharacterIdx] = useState<number | null>(null);
    const carouselRef = useRef<HTMLDivElement>(null);

    // Auto-scroll the zoom carousel to the correct character when it opens
    useEffect(() => {
        if (carouselRef.current && zoomedCharacterIdx !== null) {
            // Give layout a tick to render the flex items
            setTimeout(() => {
                if (carouselRef.current) {
                    carouselRef.current.scrollTo({
                        left: window.innerWidth * zoomedCharacterIdx,
                        behavior: 'instant'
                    });
                }
            }, 50);
        }
    }, [zoomedCharacterIdx]);

    // Sync button label with Redux state
    useEffect(() => {
        if (currentModelRedux) {
            const found = ALL_MODELS.find(m => m.key === currentModelRedux);
            if (found) {
                setModelValue(found.label);
            } else {
                // Fallback if model not in list (e.g. from older state)
                setModelValue(currentModelRedux);
            }
        }
    }, [currentModelRedux]);

    if (!magicMode) return null;

    // --- Colors ---
    const brandColor = darkModeReducer ? appColorDark : appColorLight;
    const brandColorR = darkModeReducer ? appColorDark : appColorLight;
    const bgGlass = darkModeReducer ? "rgba(5,5,5,0.25)" : "rgba(255,255,255,0.25)";
    const textCol = !darkModeReducer ? "#000" : "#fff";

    // --- Style Objects ---
    const outlineButtonStyle = {
        color: textCol,
        borderColor: brandColor,
        borderWidth: "1px",
        borderStyle: "solid",
        borderRadius: 20,
        textTransform: 'none' as const,
        fontWeight: 700,
        backgroundColor: bgGlass,
        backdropFilter: 'blur(10px)',
        minWidth: matchMobile ? 70 : 120,
        fontSize: matchMobile ? "0.75rem" : "1rem",
        px: matchMobile ? 1 : 2,
        height: matchMobile ? 32 : 40,
        justifyContent: 'space-between',
        flex: matchMobile ? 1 : 'none',
        "&:hover": {
            borderColor: brandColor,
            backgroundColor: darkModeReducer ? "rgba(255,255,0,0.1)" : "rgba(255,0,0,0.1)"
        }
    };

    const menuPaperProps = {
        style: {
            backgroundColor: darkModeReducer ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)",
            color: textCol,
            borderRadius: 12,
            border: `1px solid ${brandColor}`,
            maxHeight: 300, // Scrollable for long list
        }
    };

    // Auto-transition to MirrorView when casting is done and we enter Normal mode
    useEffect(() => {
        if (isMirrorFocused && !isNativeMagicMode && (generatedImagesFluxx.length > 0 || (nanoImages && nanoImages.length > 0))) {
            setStage1(false);
        } else if (CreationMode === 'Normal' && !isAgentCasting) {
            setStage1(false);
        }
    }, [CreationMode, isAgentCasting, isMirrorFocused, isNativeMagicMode, generatedImagesFluxx.length, nanoImages]);

    // Auto-reset to Magic Mirror Home when images are cleared
    useEffect(() => {
        if (generatedImagesFluxx.length === 0 && (!nanoImages || nanoImages.length === 0)) {
            setStage1(true);
        }
    }, [generatedImagesFluxx.length, nanoImages]);

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 2000, // Higher than everything
                background: darkModeReducer ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.98)",
                color: !darkModeReducer ? "#000" : "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: matchMobile ? "12px 15px 100px 15px" : "46px",
                overflowY: "auto",
                fontFamily: "'Inter', sans-serif",
            }}
        >
            {/* Top Animated Loading Bar */}
            {isAgentCasting && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: 4, zIndex: 30000,
                    background: `${brandColor}44`, overflow: 'hidden'
                }}>
                    <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
                        animation: 'loadingBar 1.5s infinite linear'
                    }} />
                </div>
            )}

            {/* CHARACTER ZOOM MODAL */}
            {zoomedCharacterIdx !== null && referenceImages && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 50000,
                        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column'
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setZoomedCharacterIdx(null);
                        }}
                        style={{
                            position: 'absolute', top: 30, right: 30, zIndex: 50001,
                            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                            borderRadius: '50%', width: 50, height: 50, cursor: 'pointer',
                            fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(5px)'
                        }}
                    >
                        âœ•
                    </button>

                    <div
                        ref={carouselRef}
                        style={{
                            display: 'flex', overflowX: 'auto', width: '100%', height: '100dvh',
                            scrollSnapType: 'x mandatory',
                            alignItems: 'center'
                        }}
                        className="hide-scrollbar"
                    >
                        {referenceImages.map((ref: any, idx: number) => (
                            <div
                                key={idx}
                                style={{
                                    minWidth: '100%', height: '100%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    scrollSnapAlign: 'center',
                                    position: 'relative'
                                }}
                            >
                                {ref.imageUrl ? (
                                    <img
                                        src={ref.imageUrl}
                                        alt={ref.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setZoomedCharacterIdx(null);
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setZoomedCharacterIdx(null);
                                        }}
                                    >
                                        <CircularProgress size={80} sx={{ color: brandColor }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Header */}
            <div
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: matchMobile ? 0 : 10,
                }}
            >
                <div style={{ width: 48 }} /> {/* Spacer */}
                <div style={{ display: (matchMobile && isMenuOpen) ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: "'Montserrat', sans-serif",
                        fontStyle: "italic",
                        fontWeight: 900,
                        color: brandColor,
                        fontSize: matchMobile ? "1.4rem" : "1.8rem",
                        letterSpacing: -0.5
                    }}>
                        <PlayCircleOutlineIcon style={{ fontSize: matchMobile ? "1.6rem" : "2rem" }} />
                        Script to Video
                    </div>
                </div>
                <IconButton onClick={() => navigate("/")} style={{ color: !darkModeReducer ? "#000" : "#fff" }}>
                    <SearchIcon style={{ fontSize: "1.8rem" }} />
                </IconButton>
            </div>

            {/* Main Content Area */}
            <div
                style={{
                    width: "100%",
                    maxWidth: 800,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: matchMobile ? "flex-start" : "center",
                    gap: matchMobile ? 5 : 10,
                }}
            >
                {/* Greeting / Mini Nav Row (Only show when not viewing result) */}
                {GeneratedImage.length === 0 && !GeneratedImageFlux && (
                    <div style={{ textAlign: "center", width: "100%", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: matchMobile ? '30vh' : '35vh',
                            width: '100%',
                            gap: matchMobile ? '8px' : '15px',
                            marginBottom: matchMobile ? 5 : 15,
                            paddingBottom: matchMobile ? '3vh' : 0,
                            marginTop: matchMobile ? '4vh' : 0,
                        }}>
                            {/* Shorts - replacing picture icon (/images) */}
                            <div onClick={() => navigate("/images")} style={{
                                position: 'relative',
                                height: '100%',
                                cursor: 'pointer',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                transform: 'scale(0.85)',
                                transition: 'transform 0.2s',
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
                            >
                                <img src={shortsImage} style={{ height: '100%', width: 'auto', display: 'block' }} alt="Shorts" />
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    width: '100%',
                                    padding: '10px 0',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                                    backdropFilter: 'blur(5px)',
                                    WebkitBackdropFilter: 'blur(5px)',
                                    textAlign: 'center',
                                    color: '#fff',
                                    fontWeight: '800',
                                    fontSize: '0.9rem',
                                    letterSpacing: '0.5px'
                                }}>
                                    Shorts
                                </div>
                            </div>

                            {/* Games - replacing touch icon (/clikit) */}
                            <div onClick={() => navigate("/clikit")} style={{
                                position: 'relative',
                                height: '100%',
                                cursor: 'pointer',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                transform: 'scale(0.85)',
                                transition: 'transform 0.2s',
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
                            >
                                <img src={gamesImage} style={{ height: '100%', width: 'auto', display: 'block' }} alt="Games" />
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    width: '100%',
                                    padding: '10px 0',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                                    backdropFilter: 'blur(5px)',
                                    WebkitBackdropFilter: 'blur(5px)',
                                    textAlign: 'center',
                                    color: '#fff',
                                    fontWeight: '800',
                                    fontSize: '0.9rem',
                                    letterSpacing: '0.5px'
                                }}>
                                    Games
                                </div>
                            </div>

                            {/* Cinema - replacing couch icon (/kickit) */}
                            <div onClick={() => navigate("/kickit")} style={{
                                position: 'relative',
                                height: '100%',
                                cursor: 'pointer',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                transform: 'scale(0.85)',
                                transition: 'transform 0.2s',
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(0.85)'}
                            >
                                <img src={cinemaImage} style={{ height: '100%', width: 'auto', display: 'block' }} alt="Cinema" />
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    width: '100%',
                                    padding: '10px 0',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                                    backdropFilter: 'blur(5px)',
                                    WebkitBackdropFilter: 'blur(5px)',
                                    textAlign: 'center',
                                    color: '#fff',
                                    fontWeight: '800',
                                    fontSize: '0.9rem',
                                    letterSpacing: '0.5px'
                                }}>
                                    Cinema
                                </div>
                            </div>
                        </div>


                        <style>{`
                            .glass-template-btn {
                                cursor: pointer;
                                border-radius: 14px;
                                padding: ${matchMobile ? '8px 12px' : '10px 14px'};
                                border: 1px solid rgba(255,255,255,0.18);
                                background: rgba(255,255,255,0.08);
                                backdrop-filter: blur(10px);
                                -webkit-backdrop-filter: blur(10px);
                                box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                                color: ${darkModeReducer ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)'};
                                font-weight: 600;
                                font-size: ${matchMobile ? '0.8rem' : '0.9rem'};
                                letter-spacing: 0.2px;
                                transition: transform 120ms ease, background 120ms ease, border 120ms ease;
                                user-select: none;
                                outline: none;
                            }
                            .glass-template-btn:hover {
                                transform: translateY(-1px);
                                background: rgba(255,255,255,0.12);
                                border: 1px solid rgba(255,255,255,0.28);
                            }
                            .glass-template-btn:active {
                                transform: translateY(0px) scale(0.99);
                            }
                            @media (max-width: 520px) {
                                .glass-template-btn { flex: 1; min-width: 140px; }
                            }
                        `}</style>

                        {/* Template Buttons Row */}
                        <div className="hide-scrollbar" style={{
                            display: 'flex',
                            gap: matchMobile ? '6px' : '10px',
                            marginTop: matchMobile ? '5px' : '10px',
                            marginBottom: matchMobile ? '5px' : '10px',
                            overflowX: 'auto',
                            paddingTop: '0.2vh',
                            paddingBottom: matchMobile ? 'calc(5px + 0.2vh)' : 'calc(10px + 0.2vh)',
                            width: "100%",
                            justifyContent: "center",
                        }}>



                            <button
                                type="button"
                                className="glass-template-btn"
                                onClick={() => setPrompt(TEMPLATE_PROMPTS.wildlife)}
                            >
                                Wildlife
                            </button>
                            <button
                                type="button"
                                className="glass-template-btn"
                                onClick={() => setPrompt(TEMPLATE_PROMPTS.story)}
                            >
                                Historical Story
                            </button>

                            <button
                                type="button"
                                className="glass-template-btn"
                                onClick={() => setPrompt(TEMPLATE_PROMPTS.top10)}
                            >
                                Top Meals
                            </button>


                            <button
                                type="button"
                                className="glass-template-btn"
                                onClick={() => setPrompt(TEMPLATE_PROMPTS.exercise)}
                            >
                                Exercise Routine
                            </button>
                        </div>
                    </div>
                )}

                {/* RESULT VIEW */}
                {(GeneratedImage.length > 0 || GeneratedImageFlux) ? (
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100dvh",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: darkModeReducer ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            zIndex: 25000,
                            animation: "fadeIn 0.5s ease-out",
                        }}
                    >
                        {/* Main Image Display */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                            }}
                        >
                            <img
                                src={GeneratedImageFlux || (GeneratedImage.length > 0 ? GeneratedImage[0] : "")}
                                alt="Magic Result"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                }}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            position: "absolute",
                            bottom: matchMobile ? 40 : 60,
                            display: "flex",
                            flexDirection: matchMobile ? "column" : "row",
                            gap: matchMobile ? 12 : 20,
                            width: matchMobile ? "90%" : "auto",
                            zIndex: 10,
                        }}>

                            {/* Back / Reset Button */}
                            <button
                                onClick={() => {
                                    setGeneratedImage([]);
                                    setGeneratedImageFlux("");
                                    setPrompt("");
                                }}
                                style={{
                                    background: "rgba(128,128,128,0.2)",
                                    color: !darkModeReducer ? "#000" : "#fff",
                                    border: "none",
                                    padding: "12px 30px",
                                    borderRadius: 100,
                                    fontWeight: 600,
                                    fontSize: "1rem",
                                    cursor: "pointer",
                                    backdropFilter: "blur(10px)",
                                    width: matchMobile ? "100%" : "auto",
                                }}
                            >
                                Stop / New
                            </button>

                            {/* Save / Keep Button */}
                            <button
                                onClick={() => {
                                    setminimisePrompt(true);
                                }}
                                style={{
                                    background: brandColor,
                                    color: "#000",
                                    border: "none",
                                    padding: "12px 30px",
                                    borderRadius: 100,
                                    fontWeight: 800,
                                    fontSize: "1rem",
                                    cursor: "pointer",
                                    boxShadow: `0 8px 20px ${brandColor}44`,
                                    width: matchMobile ? "100%" : "auto",
                                }}
                            >
                                Keep & Browse
                            </button>
                        </div>
                    </div>
                ) : (
                    /* INPUT VIEW */
                    <>
                        {matchMobile && isFocused && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur();
                                    }
                                }}
                                style={{
                                    position: "fixed",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 9999,
                                    backgroundColor: "rgba(0,0,0,0.85)",
                                    backdropFilter: "blur(8px)",
                                    WebkitBackdropFilter: "blur(8px)",
                                }}
                            />
                        )}
                        <div
                            style={{
                                width: "100%",
                                position: isFocused ? "relative" : "static",
                                zIndex: isFocused ? 10000 : "auto",
                                background: darkModeReducer ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                padding: matchMobile ? "15px" : "25px",
                                borderRadius: matchMobile ? 20 : 30,
                                border: `1px solid ${darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                                backdropFilter: "blur(20px)",
                                boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
                                minHeight: matchMobile ? 200 : 260,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: (isLocalLoading && parsedKeyPoints.length === 0) ? "center" : "flex-start",
                                alignItems: (isLocalLoading && parsedKeyPoints.length === 0) ? "center" : "stretch"
                            }}
                        >
                            {isLocalLoading && parsedKeyPoints.length === 0 ? (
                                <div style={{ width: "100%", padding: "1vh 2px", boxSizing: "border-box" }}>
                                    {(planInfo === 1 || planInfo === 0) && (
                                        <div style={{ marginBottom: "1vh" }}>
                                            <h3 style={{ opacity: blinkOn ? 1 : 0.35, transition: "opacity 250ms linear", color: textCol }}>
                                                ðŸŒ Searching the webâ€¦
                                            </h3>
                                        </div>
                                    )}
                                    {planInfo === 2 && (
                                        <div style={{ marginBottom: "1vh", display: 'flex', flexDirection: 'column', alignItems: 'left', textAlign: 'left' }}>
                                            <h3 style={{ color: textCol, marginBottom: '2vh', opacity: 0.8 }}>
                                                {plan2Titles[titleIndex].emoji} {plan2Titles[titleIndex].text}
                                            </h3>

                                            {/* CSS Typewriter Container */}
                                            <div style={{
                                                minHeight: '1em',
                                                // Typography completely removed as requested
                                            }} />
                                        </div>
                                    )}
                                    {planInfo === 3 && (
                                        <h3 style={{ color: textCol }}>ðŸŽ¨ Creating consistent style</h3>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: "0.5rem"
                                    }}>
                                        <div style={{
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "1px",
                                            color: brandColor,
                                            opacity: 0.8,
                                        }}>
                                            {pixels} Pixels
                                        </div>
                                        <IconButton size="small" onClick={() => setPrompt('')} style={{ color: isFocused ? "#ffffff" : textCol, opacity: 0.7, padding: 0 }}>
                                            <CircleOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </div>
                                    <TextField
                                        placeholder="e.g. Give me a healthy exercise routine... or Tell me a historical story..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onFocus={() => {
                                            if (matchMobile) {
                                                setIsFocused(true);
                                                const meta = document.querySelector('meta[name=viewport]');
                                                if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
                                            }
                                        }}
                                        onBlur={() => {
                                            if (matchMobile) {
                                                setIsFocused(false);
                                                const meta = document.querySelector('meta[name=viewport]');
                                                if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
                                                window.scrollTo(0, 0); // fix jiggling
                                            }
                                        }}
                                        multiline
                                        fullWidth
                                        variant="standard"
                                        InputProps={{
                                            disableUnderline: true,
                                            sx: {
                                                fontSize: matchMobile ? "16px" : "1.3rem",
                                                "& .MuiInputBase-input": {
                                                    caretColor: (isFocused || darkModeReducer) ? "#ffffff !important" : "#000000 !important",
                                                }
                                            }
                                        }}
                                        inputProps={{
                                            style: {
                                                color: isFocused ? "#ffffff" : (darkModeReducer ? "#ffffff" : "#000000"),
                                                height: matchMobile ? 60 : 100,
                                                overflowY: "auto",
                                            }
                                        }}
                                        sx={{
                                            width: "100%",
                                            "& .MuiInputBase-root": {
                                                padding: 0,
                                                fontFamily: "inherit",
                                            }
                                        }}
                                    />



                                    {/* Bottom Control Row */}
                                    <div style={{
                                        display: (matchMobile && isFocused) ? "none" : "flex",
                                        flexDirection: matchMobile ? "column" : "row",
                                        justifyContent: "space-between",
                                        alignItems: matchMobile ? "stretch" : "center",
                                        marginTop: matchMobile ? 10 : 20,
                                        gap: 15
                                    }}>
                                        {/* Left Side: Dropdowns */}
                                        <div style={{
                                            display: 'flex',
                                            gap: matchMobile ? 10 : 6,
                                            justifyContent: matchMobile ? "center" : "flex-start",
                                            width: matchMobile ? "100%" : "auto",
                                            alignItems: "center",
                                            flexWrap: matchMobile ? "wrap" : "nowrap"
                                        }}>

                                            {/* Aspect Ratio Box (NEW) */}
                                            <div
                                                onClick={() => dispatch(cycleAspectRatio())}
                                                style={{
                                                    width: matchMobile ? 32 : 40,
                                                    height: matchMobile ? 32 : 40,
                                                    borderRadius: 8,
                                                    border: `2px solid ${brandColor}`,
                                                    backgroundColor: bgGlass,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    cursor: "pointer",
                                                    flexShrink: 0,
                                                    transition: "transform 0.1s ease",
                                                }}
                                                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                                                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                            >
                                                <div style={{
                                                    width: ratioKey === 3 ? "70%" : (ratioKey === 2 ? "50%" : "30%"),
                                                    height: ratioKey === 1 ? "70%" : (ratioKey === 2 ? "50%" : "30%"),
                                                    backgroundColor: brandColor,
                                                    borderRadius: 2,
                                                    opacity: 0.9
                                                }} />
                                            </div>

                                            {/* Button 1: Explain */}
                                            <Button
                                                variant="outlined"
                                                onClick={(e) => setAnchorElExplain(e.currentTarget)}
                                                endIcon={<KeyboardArrowDownIcon sx={{ color: brandColorR }} />}
                                                sx={outlineButtonStyle}
                                            >
                                                {explainValue}
                                            </Button>
                                            <Menu
                                                anchorEl={anchorElExplain}
                                                open={Boolean(anchorElExplain)}
                                                onClose={() => setAnchorElExplain(null)}
                                                disableAutoFocusItem
                                                PaperProps={menuPaperProps}
                                                sx={{ zIndex: 45000 }}
                                            >
                                                <MenuItem onClick={() => { setAnchorElExplain(null); setTimeout(() => setType(1), 10); }}>
                                                    Explain
                                                </MenuItem>
                                                <MenuItem onClick={() => { setAnchorElExplain(null); setTimeout(() => setType(0), 10); }}>
                                                    Images
                                                </MenuItem>
                                            </Menu>


                                            {/* Button 2: Models (CONNECTED) */}
                                            <Button
                                                variant="outlined"
                                                onClick={(e) => setAnchorElModels(e.currentTarget)}
                                                endIcon={<KeyboardArrowDownIcon sx={{ color: brandColorR }} />}
                                                sx={outlineButtonStyle}
                                            >
                                                {modelValue}
                                            </Button>
                                            <Menu
                                                anchorEl={anchorElModels}
                                                open={Boolean(anchorElModels)}
                                                onClose={() => setAnchorElModels(null)}
                                                PaperProps={menuPaperProps}
                                                sx={{ zIndex: 45000 }}
                                            >
                                                {ALL_MODELS.map((m) => {
                                                    const price = calcModelPixels({ model: m.key, baseImagesPerDollar: 333 });
                                                    const isSelected = currentModelRedux === m.key;
                                                    // Highlight selected item
                                                    const itemBg = isSelected
                                                        ? (darkModeReducer ? "rgba(255,255,0,0.15)" : "rgba(255,0,0,0.1)")
                                                        : "transparent";

                                                    return (
                                                        <MenuItem
                                                            key={m.key}
                                                            onClick={() => {
                                                                dispatch(setModel(m.key));
                                                                setModelz(m.key);
                                                                setAnchorElModels(null);
                                                            }}
                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                gap: 2,
                                                                backgroundColor: itemBg,
                                                                "&:hover": {
                                                                    backgroundColor: darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
                                                                }
                                                            }}
                                                        >
                                                            <Typography variant="body1" sx={{ fontWeight: isSelected ? 800 : 400 }}>
                                                                {m.label}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ opacity: 0.7, color: brandColor, fontWeight: 700 }}>
                                                                {price} P
                                                            </Typography>
                                                        </MenuItem>
                                                    );
                                                })}
                                            </Menu>

                                        </div>


                                        <button
                                            onClick={() => {
                                                setIsFocused(false);
                                                if (document.activeElement instanceof HTMLElement) {
                                                    document.activeElement.blur();
                                                }

                                                if (modelValue === "Models" || !currentModelRedux) {
                                                    dispatch(setModel("Imagen2"));
                                                    setModelz("Imagen2");
                                                }

                                                if (type === 1) {
                                                    if (setminimisePrompt) {
                                                        setminimisePrompt(false);
                                                    }
                                                    if (setinstantCall) setinstantCall(true);
                                                    navigate("/kickit");
                                                } else {
                                                    if (setminimisePrompt) {
                                                        setminimisePrompt(false);
                                                    }
                                                    if (setinstantCall) setinstantCall(true);
                                                    navigate("/images");
                                                }

                                                /*
                                                setIsLocalLoading(true);
                                                setPlanInfo(1);
                                                setTimeout(() => setPlanInfo(2), 1500);
                                                handleStartSubmit();
                                                */
                                            }}
                                            style={{
                                                background: brandColor,
                                                color: "#000",
                                                border: "none",
                                                padding: matchMobile ? "10px 20px" : "12px 40px",
                                                borderRadius: 100,
                                                fontWeight: 800,
                                                fontSize: matchMobile ? "1rem" : "1.1rem",
                                                cursor: "pointer",
                                                boxShadow: `0 8px 20px ${brandColor}44`,
                                                transition: "transform 0.2s ease",
                                                width: matchMobile ? "100%" : "auto",
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                                        >
                                            Get Results
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Info Text */}
                {GeneratedImage.length === 0 && !GeneratedImageFlux && !(matchMobile && isMenuOpen) && (
                    <div style={{ textAlign: "center", opacity: 0.7, fontSize: matchMobile ? "0.9rem" : "1.1rem", maxWidth: 400 }}>
                        What would you like to see today?
                    </div>
                )}
            </div>

            {/* STOPPER OVERLAY - Hide when images exist */}
            {showStopper && generatedImagesFluxx.length === 0 && (!nanoImages || nanoImages.length === 0) && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100vh",
                    zIndex: 20000,
                    backgroundColor: darkModeReducer ? "rgba(0,0,0,0.97)" : "rgba(255,255,255,0.98)",
                    display: "flex",
                    flexDirection: "column",
                    animation: "fadeIn 0.3s ease-out",
                }}>
                    {/* 100% Width Close Button at Top */}
                    <button
                        onClick={() => setParsedKeyPoints([])}
                        style={{
                            width: "100%",
                            padding: "15px",
                            background: darkModeReducer ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                            border: "none",
                            borderBottom: `1px solid ${darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            color: textCol,
                        }}
                    >
                        <CloseIcon style={{ fontSize: "2rem" }} />
                    </button>

                    {/* Top 30%: Typed Steps */}
                    <Box className="hide-scrollbar" sx={{
                        height: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 2,
                        overflowX: 'auto',
                        p: 4,
                        width: '100%'
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
                            const img = (nanoImages && nanoImages[i]) ? nanoImages[i] : (generatedImagesFluxx ? generatedImagesFluxx[i] : null);
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
                            );
                        })}
                    </Box>

                    {/* Circular GO Button smack in the center */}
                    {(() => {
                        const modelPrice = calcModelPixels({ model: currentModelRedux || "schnell", baseImagesPerDollar: 333 });
                        const totalCost = parsedKeyPoints.length * modelPrice;
                        const hasEnough = pixels >= totalCost;

                        return (
                            <div style={{
                                flex: 1,
                                width: "100%",
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: matchMobile ? "flex-start" : "center",
                                paddingTop: matchMobile ? "10px" : 0,
                                gap: matchMobile ? 15 : 30,
                            }}>
                                <div style={{
                                    width: matchMobile ? '90%' : '50%',
                                    display: 'none', // HIDDEN AS REQUESTED
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
                                                fontSize: matchMobile ? '1.3rem' : '1.4rem',
                                                caretColor: 'auto !important',
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!planEditText.trim()) return;

                                            // Just use the new text directly, no wrapper
                                            setPrompt(planEditText);

                                            // Wipe all data so the user is back at the Get Results / Create Characters stage
                                            setParsedKeyPoints([]);
                                            setGeneratedImage([]);
                                            setGeneratedImageFlux("");
                                            setGeneratedImagesFluxx([]);

                                            // DO NOT call onClose() or handleStartSubmit()
                                            setPlanEditText("");
                                            setIsGoLoading(false);
                                        }}
                                        style={{
                                            background: brandColor,
                                            color: "#fff",
                                            border: 'none',
                                            borderRadius: '0 20px 20px 0',
                                            padding: '0 20px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            zIndex: 2,
                                            boxShadow: `4px 4px 15px ${brandColor}55`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        Go
                                    </button>
                                </div>
                                {/* Your Pixels (Moved above Go) */}
                                {!isAgentCasting && (
                                    <div style={{ textAlign: "center", zIndex: 1 }}>
                                        <Typography variant="body2" sx={{ opacity: 0.6, fontWeight: 700, marginBottom: 0.5, fontSize: '0.7rem' }}>
                                            PIXELS: {pixels.toLocaleString()}
                                        </Typography>

                                        <div style={{
                                            padding: "8px 20px",
                                            borderRadius: 20,
                                            background: darkModeReducer ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                            border: `1px solid ${hasEnough ? (darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)") : brandColor}`,
                                            textAlign: "center"
                                        }}>
                                            <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: hasEnough ? textCol : brandColor }}>
                                                Cost: {totalCost.toLocaleString()} P
                                            </Typography>
                                        </div>
                                    </div>
                                )}

                                {/* CENTER CIRCULAR GO BUTTON */}
                                <div style={{
                                    position: "relative",
                                    width: isAgentCasting ? (matchMobile ? '100%' : '60%') : (matchMobile ? 260 : 320),
                                    height: isAgentCasting ? 'auto' : (matchMobile ? 160 : 200),
                                    minHeight: isAgentCasting ? 250 : 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    {isAgentCasting ? (
                                        <div style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            width: '100%',
                                            padding: '40px 20px',
                                            borderRadius: '30px',
                                            background: brandColor,
                                            boxShadow: 'none',
                                            color: darkModeReducer ? '#000' : '#fff',
                                            position: 'relative',
                                            animation: 'popup 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            overflow: 'hidden'
                                        }}>
                                            <style>{`
                                                @keyframes popup {
                                                    from { transform: scale(0.9); opacity: 0; }
                                                    to { transform: scale(1); opacity: 1; }
                                                }
                                                @keyframes loadingBar {
                                                    0% { transform: translateX(-100%); }
                                                    100% { transform: translateX(100%); }
                                                }
                                            `}</style>

                                            {/* Top Info section */}
                                            <div style={{
                                                position: 'absolute', top: 10, left: 10, right: 10,
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                fontSize: '0.85rem', fontWeight: 800, letterSpacing: 1,
                                                padding: '10px 15px', borderRadius: '20px',
                                                background: darkModeReducer ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                                                border: `1px solid ${darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                                                backdropFilter: 'blur(10px)',
                                                WebkitBackdropFilter: 'blur(10px)'
                                            }}>
                                                <div>PIXELS: {pixels.toLocaleString()}</div>
                                                <div>COST: {(calcModelPixels({ model: currentModelRedux || "schnell", baseImagesPerDollar: 333 }) * (referenceImages ? referenceImages.length : 0)).toLocaleString()} P</div>
                                            </div>

                                            <div style={{ margin: '40px 0 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
                                                <CircularProgress size={40} sx={{ color: darkModeReducer ? '#000' : '#fff' }} />
                                                <Typography variant="body1" sx={{ fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }}>
                                                    {castingStatus || "Extracting characters..."}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', textAlign: 'center', opacity: 0.8, maxWidth: '85%' }}>
                                                    Please wait while our AI Agent analyzes your plan and crafts unique, consistent character references for your upcoming scenes.
                                                </Typography>
                                            </div>

                                            {referenceImages && referenceImages.length > 0 && (
                                                <div style={{
                                                    display: 'flex', gap: 15, overflowX: 'auto', width: '100%',
                                                    padding: '15px 20px',
                                                    background: darkModeReducer ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                                                    backdropFilter: 'blur(10px)',
                                                    WebkitBackdropFilter: 'blur(10px)',
                                                    borderRadius: '20px',
                                                    marginTop: 10
                                                }} className="hide-scrollbar">
                                                    {referenceImages.map((ref: any, idx: number) => (
                                                        <div key={idx}
                                                            onClick={() => {
                                                                setZoomedCharacterIdx(idx);
                                                            }}
                                                            style={{
                                                                width: 70, height: 70, borderRadius: '50%',
                                                                border: '2px solid rgba(255,255,255,0.5)',
                                                                overflow: 'hidden', flexShrink: 0,
                                                                position: 'relative',
                                                                background: 'rgba(0,0,0,0.1)',
                                                                cursor: 'pointer',
                                                                pointerEvents: 'auto'
                                                            }}>
                                                            {ref.imageUrl ? (
                                                                <img src={ref.imageUrl} alt={ref.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                                                    <CircularProgress size={24} sx={{ color: darkModeReducer ? '#000' : '#fff' }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : hasEnough ? (
                                        isGoLoading ? (
                                            <CircularProgress size={80} sx={{ color: brandColor }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                                <div style={{ position: 'relative', width: matchMobile ? "90px" : "40%", maxWidth: "160px", aspectRatio: "1/1", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <div className="go-pulsate" style={{
                                                        position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: "rgba(128,128,128,0.5)", opacity: 0.3, zIndex: 0
                                                    }} />
                                                    <button
                                                        onClick={() => {
                                                            setIsGoLoading(true);
                                                            setCreationMode('Normal');
                                                            setallowgetImage(true);
                                                        }}
                                                        style={{
                                                            position: 'relative',
                                                            width: "100%", height: "100%", borderRadius: "50%",
                                                            background: "rgba(128,128,128,0.2)", color: "#fff",
                                                            border: `2px solid ${brandColor}55`, fontWeight: 800,
                                                            fontSize: matchMobile ? "0.9rem" : "1.1rem", cursor: "pointer",
                                                            transition: "transform 0.2s ease", display: "flex",
                                                            alignItems: "center", justifyContent: "center", zIndex: 10,
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                                                    >
                                                        Skip
                                                    </button>
                                                </div>

                                                <div style={{ position: 'relative', width: matchMobile ? "130px" : "60%", maxWidth: "220px", aspectRatio: "1/1", display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <div className="go-pulsate" style={{
                                                        position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: brandColor, opacity: 0.3, zIndex: 0
                                                    }} />
                                                    <button
                                                        onClick={() => {
                                                            setIsGoLoading(true);
                                                            if (startAgentCasting) startAgentCasting();
                                                        }}
                                                        style={{
                                                            position: 'relative',
                                                            width: "100%", height: "100%", borderRadius: "50%",
                                                            background: brandColor, color: "#fff", border: "none",
                                                            fontWeight: 900, fontSize: matchMobile ? "1.1rem" : "1.4rem",
                                                            cursor: "pointer", boxShadow: `0 15px 40px ${brandColor}77`,
                                                            transition: "transform 0.2s ease, box-shadow 0.2s ease", display: "flex",
                                                            alignItems: "center", justifyContent: "center", zIndex: 10,
                                                            textAlign: 'center', padding: '10px'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = "scale(1.05)";
                                                            e.currentTarget.style.boxShadow = `0 15px 50px ${brandColor}aa`;
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = "scale(1)";
                                                            e.currentTarget.style.boxShadow = `0 15px 40px ${brandColor}77`;
                                                        }}
                                                    >
                                                        Create Characters
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div style={{
                                            width: "100%",
                                            height: "100%",
                                            borderRadius: "50%",
                                            background: "rgba(128,128,128,0.1)",
                                            border: `4px solid ${brandColor}33`,
                                            color: brandColor,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            textAlign: "center",
                                            padding: "20px",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            lineHeight: 1.2,
                                        }}>
                                            Not enough Pixels
                                        </div>
                                    )}

                                    {/* Pulsating background moved inside individual buttons */}
                                </div>

                                {!hasEnough && (
                                    <div style={{
                                        color: brandColor,
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        maxWidth: 300,
                                        fontSize: '0.9rem',
                                        opacity: 0.8
                                    }}>
                                        Try a cheaper model or Buy pixels from ClikB social Create section
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <style>{`
                        @keyframes slideInLeft {
                            from { opacity: 0; transform: translateX(-20px); }
                            to { opacity: 1; transform: translateX(0); }
                        }
                        @keyframes pulsate {
                            0% { transform: scale(1); opacity: 0.3; }
                            50% { transform: scale(1.2); opacity: 0.1; }
                            100% { transform: scale(1); opacity: 0.3; }
                        }
                        .go-pulsate {
                            animation: pulsate 2s infinite ease-in-out;
                        }
                    `}</style>
                </div>
            )}

            {/* MirrorView â€“ Full-screen image slider when images exist AND we are past stage 1 */}
            {!stage1 && (generatedImagesFluxx.length > 0 || (nanoImages && nanoImages.length > 0)) && (
                <MirrorView
                    images={generatedImagesFluxx}
                    nanoImages={nanoImages}
                    loadersArray={loadersArray}
                    totalExpected={parsedKeyPoints.length}
                    darkMode={darkModeReducer}
                    onClose={() => {
                        if (!isNativeMagicMode && onToggleSlideshow) {
                            // We are in Storybook/Standard UI mode. Just hide the slideshow!
                            onToggleSlideshow();
                        } else {
                            // 1. Immediately hide the UI to prevent any "leak" of the previous image
                            setStage1(true);

                            // 2. Call the parent cleanup (deletes images, clears state)
                            onClose();

                            // 3. Local cleanup (optional/redundant but safe)
                            setGeneratedImagesFluxx([]);
                            setParsedKeyPoints([]);
                            setShowStopper(false);
                        }
                    }}
                    parsedKeyPoints={parsedKeyPoints}
                    parsedKeyPoints2={parsedKeyPoints2}
                    prompt={prompt}
                    matchMobile={matchMobile}
                    type={type}
                    loggedUser={loggedUser}
                    ratioKey={ratioKey}
                    onSwitchToCreateMode={onToggleSlideshow}
                />
            )}
        </div>
    );
};

export default Mirror;
