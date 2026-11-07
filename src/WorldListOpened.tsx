import React, { useState, useEffect } from "react";
import { WORLD_GROUPS, type WorldAssetKind } from "./WorldCreation";
import ReactDOM from "react-dom"; // <--- 1. ADDED THIS IMPORT
import {
    Box,
    Stack,
    Typography,
    Divider,
    IconButton,
    useTheme,
    useMediaQuery,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle
} from "@mui/material";
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSelector } from "react-redux";
import { RootState } from "./store";

const copyTextToClipboard = async (text: string): Promise<boolean> => {
    const value = String(text || "");
    if (!value) return false;

    // Run the selection copy synchronously while the click still has browser
    // user-activation. Waiting for an async clipboard rejection first can make
    // browsers reject this fallback too.
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    let copied = false;
    try {
        copied = document.execCommand("copy");
    } finally {
        document.body.removeChild(textarea);
    }

    if (copied) return true;

    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
};

const CharacterCopyButton: React.FC<{
    controlKey: string;
    label: string;
    value: string;
    activeColor: string;
    isActivated: boolean;
    darkMode: boolean;
}> = ({ controlKey, label, value, activeColor, isActivated, darkMode }) => {
    const [open, setOpen] = useState(false);
    const activatedTextColor = darkMode ? '#000000' : '#ffffff';

    return (
        <>
            <IconButton
                {...cb('world_detail', `copy_${controlKey}`, `Copy ${label} description`, 'copyTextToClipboard', 'click', 'needs_handoff')}
                aria-label={`Copy ${label} description`}
                title="Copy character description"
                size="small"
                onClick={(event) => {
                    event.stopPropagation();
                    void copyTextToClipboard(value);
                    setOpen(true);
                }}
                sx={{
                    flexShrink: 0,
                    color: isActivated ? activatedTextColor : activeColor,
                    border: `1px solid ${isActivated ? activatedTextColor : activeColor}`,
                    backgroundColor: isActivated ? 'rgba(255,255,255,0.22)' : 'transparent',
                }}
            >
                <ContentCopyIcon fontSize="small" />
            </IconButton>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="sm"
                fullWidth
                onClick={(event) => event.stopPropagation()}
            >
                <DialogTitle>{`${label} character description`}</DialogTitle>
                <DialogContent>
                    <Typography sx={{ whiteSpace: 'pre-wrap', userSelect: 'text', overflowWrap: 'anywhere' }}>
                        {value}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button {...cb('world_detail', `copy_dialog_${controlKey}`, `Copy ${label} description`, 'copyTextToClipboard', 'click', 'needs_handoff')}
                        onClick={() => void copyTextToClipboard(value)}>Copy</Button>
                    <Button {...cb('world_detail', `close_copy_${controlKey}`, 'Close description copy dialog', 'setOpen')}
                        onClick={() => setOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

const SectionCard: React.FC<{
    controlKey: string;
    label: string;
    value?: string;
    isCharacter?: boolean;
    charImage?: string | null;
    isActivated?: boolean;
    isExpanded: boolean;
    matchMobile: boolean;
    darkMode: boolean;
    activeColor: string;
    directUpload?: boolean;
    onClose?: () => void;
    onToggle: (label: string) => void;
    onCharacterSelect: (name: string, description: string | undefined, imageUrl: string) => void;
}> = React.memo(({
    controlKey,
    label,
    value,
    isCharacter = false,
    charImage = null,
    isActivated = false,
    isExpanded,
    matchMobile,
    darkMode,
    activeColor,
    directUpload,
    onClose,
    onToggle,
    onCharacterSelect,
}) => {
    const activatedTextColor = darkMode ? '#000000' : '#ffffff';
    return (
    <Box
        onClick={() => onToggle(controlKey)}
        {...cb('world_detail', `section_${controlKey}`, `${isExpanded ? 'Collapse' : 'Expand'} ${label}`, 'onToggle')}
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
                {isCharacter && <AssignmentIndIcon sx={{ color: isActivated ? activatedTextColor : activeColor, fontSize: '1.2rem' }} />}
                <Typography
                    variant="caption"
                    sx={{
                        color: isActivated ? activatedTextColor : activeColor,
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
                    <CheckCircleIcon sx={{ color: activatedTextColor, fontSize: '1.2rem' }} />
                    <Typography variant="caption" sx={{ color: activatedTextColor, fontWeight: 'bold' }}>ACTIVATED</Typography>
                </Box>
            )}
        </Box>

        {isCharacter && charImage && (
            <Box
                {...cb('world_detail', `character_${controlKey}`, `Select or deselect ${label}`, 'onCharacterSelect')}
                onClick={(event) => {
                    event.stopPropagation();
                    onCharacterSelect(label, value, charImage);
                    if (directUpload && onClose) onClose();
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
        )}

        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <Typography
                variant="body2"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: isExpanded ? "pre-wrap" : "normal",
                    display: "-webkit-box",
                    WebkitLineClamp: isExpanded ? "unset" : 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontFamily: label === "BluePrint" || label === "Original Prompt" ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
                    fontSize: matchMobile ? "0.85rem" : "0.95rem",
                    lineHeight: 1.55,
                    color: isActivated ? activatedTextColor : darkMode ? 'rgba(255,255,255,0.86)' : '#111111',
                    opacity: 1
                }}
            >
                {value || "No description provided."}
            </Typography>

            {isCharacter && isExpanded && value && (
                <CharacterCopyButton
                    controlKey={controlKey}
                    label={label}
                    value={value}
                    activeColor={activeColor}
                    isActivated={isActivated}
                    darkMode={darkMode}
                />
            )}
        </Box>
    </Box>
    );
});

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
    characters: (Character & { kind?: WorldAssetKind })[];
    planx?: any;
    activated?: boolean;
}

interface WorldListOpenedProps {
    world: World;
    matchMobile?: boolean;
    PRIMARY_COLOR?: string;
    onBack?: () => void;
    onEdit?: () => void;
    mode: any;
    selectedImages: any;
    handleSelection: any;
    DirectUpload?: boolean;
    onClose?: () => void;
    setRemixData?: any;
    setWorldCover?: any;
    setWorldStyle?: any;
    selectedWorldId?: string | number | null;
    setSelectedWorldId?: any;
    Vipcharacters?: any[];
    setVipcharacters?: any;

}

const WorldListOpened: React.FC<WorldListOpenedProps> = ({
    world,
    matchMobile: externalMatchMobile,
    PRIMARY_COLOR,
    onEdit,
    onBack,
    mode,
    selectedImages,
    handleSelection,
    DirectUpload,
    onClose,
    setRemixData,
    setWorldCover,
    setWorldStyle,
    selectedWorldId,
    setSelectedWorldId,
    setVipcharacters

}) => {
    // --- REDUX: Get Dark Mode & App Colors ---
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);

    // --- COLOR LOGIC ---
    const activeColor = (darkMode ? (appColorDark || "#FFD52A") : (appColorLight || "#A16900")) || PRIMARY_COLOR || (darkMode ? '#FFD52A' : '#A16900');

    // --- Responsive Logic ---
    const theme = useTheme();
    const activatedTextColor = darkMode ? '#000000' : '#ffffff';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const matchMobile = externalMatchMobile ?? isMobile;

    // --- Local State ---
    const [localWorld, setLocalWorld] = useState<World>(world);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    useCreationControls('world_detail', 'WorldListOpened', true, { worldId: world.id, title: world.title, canEdit: Boolean(onEdit), characterCount: world.characters.filter(asset => !asset.kind || asset.kind === "character").length, environmentCount: world.characters.filter(asset => asset.kind === "environment").length, objectCount: world.characters.filter(asset => asset.kind === "object").length, expandedSection, descriptionExpanded: isExpanded, activated: Boolean(localWorld.activated), selectedReferenceCount: selectedImages?.length || 0 });

    useEffect(() => {
        const isSelectedWorld = selectedWorldId !== null
            && selectedWorldId !== undefined
            && String(localWorld.id) === String(selectedWorldId);

        setLocalWorld((previous) => (
            previous.activated === isSelectedWorld
                ? previous
                : { ...previous, activated: isSelectedWorld }
        ));
    }, [localWorld.id, selectedWorldId]);

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
    const handleToggle = (key: string) => {
        setExpandedSection((prev) => (prev === key ? null : key));
    };

    // --- Handle Use World ---
    const handleUseWorld = () => {
        if (mode === 0) {
            setLocalWorld(prev => ({ ...prev, activated: true }));
            handleUseWorldSave();

        }
    };

    // --- NEW STATES for Remix Data and Cover ---





    // --- SAVE FUNCTION ---
    const handleUseWorldSave = () => {
        setSelectedWorldId?.(localWorld.id);

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

        // 9. Trigger Close logic after delay
        setTimeout(() => {
            if (onClose) onClose();
        }, 2000);
    };

    const toggleWorldCharacterSelection = (name: string, description: string | undefined, imageUrl: string, assetKind: WorldAssetKind = 'character') => {
        const wasSelected = Array.isArray(selectedImages) && selectedImages.includes(imageUrl);

        if (DirectUpload) {
            handleSelection(imageUrl, 1);
        } else {
            handleSelection(imageUrl);
        }

        if (setVipcharacters) {
            setVipcharacters((previous: any[] = []) => {
                const withoutCharacter = previous.filter((character: any) => character?.imageUrl !== imageUrl);
                if (wasSelected) return withoutCharacter;

                return [
                    ...withoutCharacter,
                    {
                        name,
                        description,
                        imageUrl,
                        source: "world",
                        assetKind,
                        worldId: localWorld.id,
                    },
                ];
            });
        }
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
                    <Typography variant="caption" sx={{ color: localWorld.activated ? activatedTextColor : activeColor, fontWeight: 900, letterSpacing: 1 }}>
                        WORLD TITLE
                    </Typography>
                    {localWorld.activated && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleIcon sx={{ color: activatedTextColor, fontSize: '1rem' }} />
                        </Box>
                    )}
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "1rem", color: localWorld.activated ? activatedTextColor : (darkMode ? "#fff" : "#000") }}>
                    {localWorld.title}
                </Typography>
            </Stack>
        </Box>
    );

    const renderDescBox = () => (
        <Box sx={{
            borderRadius: 3,
            border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`,
            p: 2,
            background: localWorld.activated ? activeColor : (darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")
        }}>
            <Stack>
                <Typography variant="caption" sx={{ color: localWorld.activated ? activatedTextColor : activeColor, fontWeight: 900, letterSpacing: 1 }}>
                    DESCRIPTION
                </Typography>

                <Typography
                    {...cb('world_detail', `description_world_${localWorld.id}`, `${isExpanded ? 'Collapse' : 'Expand'} World description`, 'setIsExpanded')}
                    variant="body2"
                    onClick={() => setIsExpanded(!isExpanded)} // 1. Toggle state on click
                    sx={{
                        color: localWorld.activated ? activatedTextColor : (darkMode ? "#fff" : "#000"),
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
        <Box {...(matchMobile ? cb('world_detail', 'scroll', 'Scroll World details and assets', 'worldDetail.scrollBy', 'scroll') : {})}
            sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflowY: matchMobile ? "auto" : "hidden", p: 0, m: 0 }}>

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
                {!matchMobile && <Box sx={{
                    display: 'flex',
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
                </Box>}

                {!matchMobile && (
                    <Divider orientation="vertical" flexItem sx={{ opacity: darkMode ? 0.12 : 0.2 }} />
                )}

                {/* ================= RIGHT COLUMN ================= */}
                <Box {...(!matchMobile ? cb('world_detail', 'scroll', 'Scroll World details and assets', 'worldDetail.scrollBy', 'scroll') : {})} sx={{
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
                        <SectionCard
                            controlKey={`world_${localWorld.id}_blueprint`}
                            label="BluePrint"
                            value={localWorld.blueprint}
                            isExpanded={expandedSection === `world_${localWorld.id}_blueprint`}
                            matchMobile={matchMobile}
                            darkMode={darkMode}
                            activeColor={activeColor}
                            directUpload={DirectUpload}
                            onClose={onClose}
                            onToggle={handleToggle}
                            onCharacterSelect={toggleWorldCharacterSelection}
                        />
                    )}

                    {onEdit && <Button {...cb("world_detail", "edit_world", "Edit saved World", "onEdit")} onClick={onEdit}>Edit World</Button>}
                    {WORLD_GROUPS.map(([kind, label]) => (
                        <Stack key={kind} direction="column" spacing={2}>
                            <Typography variant="h6">{label}</Typography>
                            {localWorld.characters.filter(char => (char.kind || "character") === kind).map((char, index) => (
                                <SectionCard
                                    key={char.id || index}
                                    controlKey={`world_${localWorld.id}_character_${char.id || index}`}
                                    label={char.name || `Character ${index + 1}`}
                                    value={char.description}
                                    isCharacter={true}
                                    charImage={char.image}
                                    isActivated={char.activated}
                                    isExpanded={expandedSection === `world_${localWorld.id}_character_${char.id || index}`}
                                    matchMobile={matchMobile}
                                    darkMode={darkMode}
                                    activeColor={activeColor}
                                    directUpload={DirectUpload}
                                    onClose={onClose}
                                    onToggle={handleToggle}
                                    onCharacterSelect={(name, description, url) => toggleWorldCharacterSelection(name, description, url, kind)}
                                />
                            ))}
                        </Stack>
                    ))}

                    {localWorld.original_prompt && (
                        <SectionCard
                            controlKey={`world_${localWorld.id}_original_prompt`}
                            label="Original Prompt"
                            value={localWorld.original_prompt}
                            isExpanded={expandedSection === `world_${localWorld.id}_original_prompt`}
                            matchMobile={matchMobile}
                            darkMode={darkMode}
                            activeColor={activeColor}
                            directUpload={DirectUpload}
                            onClose={onClose}
                            onToggle={handleToggle}
                            onCharacterSelect={toggleWorldCharacterSelection}
                        />
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
                            {...cb('world_detail', 'use', 'Use this World', 'handleUseWorld')}
                            sx={{
                                pointerEvents: 'auto', // Re-enable clicks
                                bgcolor: activeColor,
                                color: activatedTextColor,
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
                        {...cb('world_detail', 'back', 'Back to Worlds list', 'onBack')}
                        sx={{
                            pointerEvents: 'auto', // Re-enable clicks
                            bgcolor: mode === 0 ? (darkMode ? '#333' : '#e0e0e0') : activeColor,
                            color: mode === 0 ? (darkMode ? '#fff' : '#000') : activatedTextColor,
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
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
