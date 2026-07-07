import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom"; // <--- 1. ADDED THIS IMPORT
import {
    Box,
    Stack,
    Typography,
    Divider,
    Fade,
    IconButton,
    useTheme,
    useMediaQuery,
    Button
} from "@mui/material";
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSelector } from "react-redux";
import { RootState } from "./store";

// --- TYPES ---
interface Character {
    id: number;
    name: string;
    description: string;
    image: string;
    activated?: boolean;
}

interface World {
    id: number;
    title: string;
    description: string;
    cover: string;
    blueprint: string;
    original_prompt: string;
    characters: Character[];
    planx?: any;
    activated?: boolean;
}

interface WorldListOpenedProps {
    world: World;
    matchMobile?: boolean;
    PRIMARY_COLOR?: string;
    onBack?: () => void;
    mode: any;
    selectedImages: any;
    handleSelection: any;
    DirectUpload?: boolean;
    onClose?: () => void;
    setRemixData?: any;
    setWorldCover?: any;
    setWorldStyle?: any;
    Vipcharacters?: any[];
    setVipcharacters?: any;

}

const WorldListOpened: React.FC<WorldListOpenedProps> = ({
    world,
    matchMobile: externalMatchMobile,
    PRIMARY_COLOR,
    onBack,
    mode,
    selectedImages,
    handleSelection,
    DirectUpload,
    onClose,
    setRemixData,
    setWorldCover,
    setWorldStyle,
    Vipcharacters,
    setVipcharacters

}) => {
    // --- REDUX: Get Dark Mode ---
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);

    // --- COLOR LOGIC ---
    const activeColor = PRIMARY_COLOR || (darkMode ? "#E8BAFA" : "#0099cc");

    // --- Responsive Logic ---
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const matchMobile = externalMatchMobile ?? isMobile;

    // --- Local State ---
    const [localWorld, setLocalWorld] = useState<World>(world);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    // --- Step 5: Activated Characters Checker ---
    useEffect(() => {
        const activatedCharactersChecker = () => {
            if (!selectedImages || !localWorld.characters) return;

            const updatedChars = localWorld.characters.map(char => {
                const isSelected = selectedImages.includes(char.image);
                return { ...char, activated: isSelected };
            });

            setLocalWorld(prev => ({
                ...prev,
                characters: updatedChars
            }));
        };

        activatedCharactersChecker();
    }, [selectedImages]);

    // --- Toggle Helper ---
    const handleToggle = (label: string) => {
        setExpandedSection((prev) => (prev === label ? null : label));
    };

    // --- Handle Use World ---
    const handleUseWorld = () => {
        if (mode === 0) {
            setLocalWorld(prev => ({ ...prev, activated: true }));
            handleUseWorldSave();

        }
    };

    // --- NEW STATES for Remix Data and Cover ---



    const [worldGenModel, setWorldGenModel] = useState<string>(''); // <--- New State

    // --- SAVE FUNCTION ---
    const handleUseWorldSave = () => {
        // 1. Get World Info
        const worldTitle = localWorld.title || "Untitled World";
        const worldDesc = localWorld.description || "";

        // 2. Get Blueprint
        const visualStyle = localWorld.blueprint || "";

        // 4. Construct Final String
        // Start with Title & Description Headers
        let finalRemixString = `World Title: ${worldTitle}\nWorld Description: ${worldDesc}\n\n`;

        // Add Visual Style
        finalRemixString += `visual style & possible representations: ${visualStyle}`;

        // 5. Save Remix Data to State
        setRemixData(finalRemixString);
        console.log("Saved Remix Data (String):", finalRemixString);

        // 6. Save World Cover to State
        const currentCover = localWorld.cover || "";
        setWorldCover(currentCover);
        console.log("Saved World Cover:", currentCover);

        // 7. Save World Style (New Step)
        // Assuming localWorld has the selected_style field based on your World interface
        // Note: You need to make sure 'selected_style' is in your World interface
        const currentStyle = (localWorld as any).selected_style || "";

        ///alert(currentStyle)
        setWorldStyle(currentStyle);
        console.log("Saved World Style:", currentStyle);

        // 8. Save World Gen Model (New Step)
        // Using 'modelz' which should be passed in props or available in scope
        // Note: You might need to add 'modelz' to props if it's not defined
        const currentModel = "";
        setWorldGenModel(currentModel);
        console.log("Saved World Gen Model:", currentModel);

        // 9. Trigger Close logic after delay
        setTimeout(() => {
            if (onClose) onClose();
        }, 2000);
    };
    // --- HELPER COMPONENT: Section Card ---
    const SectionCard = ({
        label,
        value,
        isCharacter = false,
        charImage = null,
        isActivated = false
    }: {
        label: string;
        value?: string;
        isCharacter?: boolean;
        charImage?: string | null;
        isActivated?: boolean;
    }) => {
        const isExpanded = expandedSection === label;

        return (
            <Box
                onClick={() => handleToggle(label)}
                sx={{
                    p: matchMobile ? 2 : 2.5,
                    borderRadius: 3,
                    background: isActivated
                        ? activeColor
                        : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                    border: `1px solid ${isExpanded ? activeColor : (darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)")}`,
                    width: "100%",
                    flexShrink: 0,
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.2s ease-in-out",
                    "&:hover": {
                        background: isActivated ? activeColor : (darkMode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)"),
                    }
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, minHeight: '32px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {isCharacter && <AssignmentIndIcon sx={{ color: isActivated ? '#000000' : activeColor, fontSize: '1.2rem' }} />}
                        <Typography
                            variant="caption"
                            sx={{
                                color: isActivated ? '#000000' : activeColor,
                                fontWeight: 900,
                                letterSpacing: 1,
                                textTransform: "uppercase",
                                display: "block"
                            }}
                        >
                            {label}
                        </Typography>
                    </Box>
                    {isActivated && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleIcon sx={{ color: '#000000', fontSize: '1.2rem' }} />
                            <Typography variant="caption" sx={{ color: '#000000', fontWeight: 'bold' }}>ACTIVATED</Typography>
                        </Box>
                    )}
                </Box>

                {isCharacter && charImage && (
                    <Fade in={true} timeout={1000} unmountOnExit>
                        <Box
                            onClick={(e) => {
                                e.stopPropagation();
                                if (DirectUpload) {
                                    handleSelection(charImage, 1);
                                    if (setVipcharacters) {
                                        setVipcharacters((prev: any) => [...prev, { name: label, description: value, imageUrl: charImage }]);
                                    }
                                    if (onClose) onClose();
                                    return;
                                }
                                handleSelection(charImage);
                                if (setVipcharacters) {
                                    setVipcharacters((prev: any) => [...prev, { name: label, description: value, imageUrl: charImage }]);
                                }
                            }}
                            sx={{
                                width: "100%",
                                height: { xs: "45vh", md: "50vh" },
                                minHeight: { xs: "45vh", md: "50vh" },
                                borderRadius: 3,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: darkMode ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                                mb: 2,
                                mt: 1,
                                flexShrink: 0,
                                cursor: 'crosshair'
                            }}
                        >
                            <Box
                                component="img"
                                src={charImage}
                                alt={label}
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    display: "block",
                                    objectFit: "contain",
                                    objectPosition: "center"
                                }}
                            />
                        </Box>
                    </Fade>
                )}

                <Typography
                    variant="body2"
                    sx={{
                        whiteSpace: isExpanded ? "pre-wrap" : "normal",
                        display: "-webkit-box",
                        WebkitLineClamp: isExpanded ? "unset" : 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontFamily: label === "BluePrint" || label === "Original Prompt" ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
                        fontSize: matchMobile ? "0.85rem" : "0.95rem",
                        lineHeight: 1.55,
                        color: isActivated ? '#000000' : (darkMode ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.82)"),
                        opacity: 1
                    }}
                >
                    {value || "No description provided."}
                </Typography>
            </Box>
        );
    };

    // ... (Render helpers unchanged)
    const renderTitleBox = () => (
        <Box sx={{
            borderRadius: 3,
            border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`,
            p: 2,
            background: localWorld.activated ? activeColor : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
        }}>
            <Stack>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: localWorld.activated ? '#000000' : activeColor, fontWeight: 900, letterSpacing: 1 }}>
                        WORLD TITLE
                    </Typography>
                    {localWorld.activated && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleIcon sx={{ color: '#000000', fontSize: '1rem' }} />
                        </Box>
                    )}
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "1rem", color: localWorld.activated ? '#000000' : (darkMode ? "#fff" : "#000") }}>
                    {localWorld.title}
                </Typography>
            </Stack>
        </Box>
    );

    const [isExpanded, setIsExpanded] = useState(false);

    const renderDescBox = () => (
        <Box sx={{
            borderRadius: 3,
            border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`,
            p: 2,
            background: localWorld.activated ? activeColor : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
        }}>
            <Stack>
                <Typography variant="caption" sx={{ color: localWorld.activated ? '#000000' : activeColor, fontWeight: 900, letterSpacing: 1 }}>
                    DESCRIPTION
                </Typography>

                <Typography
                    variant="body2"
                    onClick={() => setIsExpanded(!isExpanded)} // 1. Toggle state on click
                    sx={{
                        color: localWorld.activated ? '#000000' : (darkMode ? "#fff" : "#000"),
                        opacity: 0.8,
                        fontSize: "0.9rem",
                        display: "-webkit-box",
                        WebkitLineClamp: isExpanded ? "unset" : 3, // 2. Toggle between 3 lines and all lines
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        cursor: "pointer", // 3. Show pointer so user knows it's clickable
                        transition: "all 0.3s ease" // Optional: makes the height change smoother
                    }}>
                    {localWorld.description}
                </Typography>
            </Stack>
        </Box>
    );
    const renderCoverImage = () => localWorld.cover ? (
        <Box sx={{
            width: "100%",
            height: { xs: "45vh", md: "46vh" },
            minHeight: { xs: "45vh", md: "46vh" },
            borderRadius: matchMobile ? '100%' : '50%',

            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: darkMode ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)",
            mt: 1,
            border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
        }}>
            <Box
                component="img"
                src={localWorld.cover}
                alt="Cover"
                sx={{
                    marginTop: matchMobile ? '0px' : '0px',
                    borderRadius: matchMobile ? '100%' : '50%',
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "contain",
                    objectPosition: "center"
                }}
            />
        </Box>
    ) : null;


    return (
        <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", p: 0, m: 0 }}>

            {/* --- MAIN CONTENT SCROLL AREA --- */}
            <Box
                sx={{
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    flexDirection: matchMobile ? "column" : "row",
                    gap: 4,
                    overflow: matchMobile ? "visible" : "hidden",
                    pb: matchMobile ? 10 : 0
                }}
            >
                {/* ================= LEFT COLUMN ================= */}
                <Box sx={{
                    display: matchMobile ? 'none' : 'flex',
                    flex: "0 0 35%",
                    flexDirection: "column",
                    gap: 2,
                    height: "100%",
                    overflowY: "auto",
                    pr: 1,
                    pt: 2
                }}>
                    <Stack spacing={2}>
                        {renderTitleBox()}
                        {renderDescBox()}
                    </Stack>
                    {renderCoverImage()}
                </Box>

                {!matchMobile && (
                    <Divider orientation="vertical" flexItem sx={{ opacity: darkMode ? 0.12 : 0.2 }} />
                )}

                {/* ================= RIGHT COLUMN ================= */}
                <Box sx={{
                    flex: 1,
                    height: matchMobile ? "auto" : "100%",
                    overflowY: matchMobile ? "visible" : "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    pr: 1,
                    pb: 12,
                    pt: 2
                }}>

                    {matchMobile && (
                        <Stack spacing={2} sx={{ mb: 2 }}>
                            {renderTitleBox()}
                            {renderDescBox()}
                            {renderCoverImage()}
                            <Divider sx={{ opacity: 0.2 }} />
                        </Stack>
                    )}

                    {localWorld.blueprint && (
                        <SectionCard label="BluePrint" value={localWorld.blueprint} />
                    )}

                    {localWorld.characters && localWorld.characters.length > 0 && (
                        <Stack direction="column" spacing={2}>
                            {localWorld.characters.map((char, index) => (
                                <SectionCard
                                    key={char.id || index}
                                    label={char.name || `Character ${index + 1}`}
                                    value={char.description}
                                    isCharacter={true}
                                    charImage={char.image}
                                    isActivated={char.activated}
                                />
                            ))}
                        </Stack>
                    )}

                    {localWorld.original_prompt && (
                        <SectionCard label="Original Prompt" value={localWorld.original_prompt} />
                    )}
                </Box>
            </Box>

            {/* ========================================================================
                2. FIX: REACT PORTAL
                This 'teleports' the buttons outside of any parent containers
                that might have transforms or overflow settings, forcing them
                to stay fixed to the actual screen glass.
                ========================================================================
            */}
            {onBack && ReactDOM.createPortal(
                <Box sx={{
                    position: 'fixed',
                    // I removed the -10vh logic so it doesn't disappear on mobile.
                    // Change '4vh' to your logic if you specifically want it hidden sometimes.
                    bottom: matchMobile ? '4vh' : '12vh',
                    left: matchMobile ? '50%' : "60%",
                    transform: "translateX(-50%)",
                    zIndex: 9999, // Guaranteed to be on top
                    width: matchMobile ? "90%" : "25%",
                    display: 'flex',
                    gap: 2,
                    pointerEvents: 'none' // Ensures box doesn't block clicks around buttons
                }}>

                    {/* Use World Button */}
                    {mode === 0 && (
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleUseWorld}
                            sx={{
                                pointerEvents: 'auto', // Re-enable clicks
                                bgcolor: activeColor,
                                color: "#000",
                                fontWeight: 800,
                                borderRadius: "50px",
                                py: 1.5,
                                fontSize: "1rem",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                                textTransform: "none",
                                "&:hover": {
                                    bgcolor: activeColor,
                                    filter: "brightness(1.1)",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 6px 25px rgba(0,0,0,0.4)"
                                },
                                transition: "all 0.2s ease"
                            }}
                        >
                            Use World
                        </Button>
                    )}

                    <Button
                        fullWidth
                        variant="contained"
                        onClick={onBack}
                        sx={{
                            pointerEvents: 'auto', // Re-enable clicks
                            bgcolor: mode === 0 ? (darkMode ? '#333' : '#e0e0e0') : activeColor,
                            color: mode === 0 ? (darkMode ? '#fff' : '#000') : "#000",
                            fontWeight: 800,
                            borderRadius: "50px",
                            py: 1.5,
                            fontSize: "1rem",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                            textTransform: "none",
                            "&:hover": {
                                bgcolor: mode === 0 ? (darkMode ? '#444' : '#d0d0d0') : activeColor,
                                filter: "brightness(1.1)",
                                transform: "translateY(-2px)",
                                boxShadow: "0 6px 25px rgba(0,0,0,0.4)"
                            },
                            transition: "all 0.2s ease"
                        }}
                    >
                        Done
                    </Button>
                </Box>,
                document.body
            )}
        </Box>
    );
};

export default WorldListOpened;
