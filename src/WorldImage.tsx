import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, Button, Backdrop, Fade, IconButton, Stack, CircularProgress, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { matchMobile } from "./DetectDevice";
import { normalizeImageUrlToS3 } from "./imageCorsDownloadManager";
import { normalizeManualCharacterName } from "./manualCharacterImage";
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { getWorldCharacterImagePrompt } from './worldCharacterDescription';

interface WorldImageProps {
    open: boolean;
    onClose: () => void;
    darkMode: boolean;
    PRIMARY_COLOR: string;
    charIndex: number;
    characterData: { name: string; description: string } | null;
    remixPlan: any;
    setRemixPlan: any;
    Planx: any;
    ImagesHdCloud: string[];
    Seed: any;
    saveToDastabase?: any;
    modelz?: any;
    Vipcharacters?: any[];
    referenceImages?: any[];
    // New Props for Background Loading
    isGeneratingParent: boolean;
    onClosex: any;
    onGenerateTrigger: (index: number, desc: string, refImage: string | null) => void;
}

type AssetTab = "characters" | "scenes";

type WorldAssetOption = {
    id: string;
    kind: "character" | "scene";
    name: string;
    imageUrl: string;
    source: string;
    worldId?: string | number;
    sceneIndex?: number;
};

const isValidAssetUrl = (value: unknown): value is string => {
    const url = String(value || "").trim();
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower !== "null" && lower !== "undefined" && lower !== "none";
};

const getCharacterUrl = (item: any): string =>
    String(item?.imageUrl || item?.url || item?.image || item?.vipSourceImageUrl || "").trim();

const createCharacterId = (name: string, imageUrl: string, index: number): string => {
    const key = normalizeManualCharacterName(name) || normalizeManualCharacterName(imageUrl) || String(index);
    return `character-${key}-${index}`;
};

const deriveCharacterSources = (referenceImages: any[] = [], Vipcharacters: any[] = []): WorldAssetOption[] => {
    const byName = new Map<string, WorldAssetOption>();
    const byUrl = new Map<string, WorldAssetOption>();
    const ordered: WorldAssetOption[] = [];

    const addOption = (item: any, fallbackIndex: number, preferredFromReference: boolean) => {
        const imageUrl = getCharacterUrl(item);
        if (!isValidAssetUrl(imageUrl)) return;

        const displayName = String(item?.name || `Character ${fallbackIndex + 1}`).trim();
        const nameKey = normalizeManualCharacterName(displayName);
        const urlKey = imageUrl.trim().toLowerCase();
        const existing = (nameKey && byName.get(nameKey)) || byUrl.get(urlKey);

        if (existing) {
            if (preferredFromReference) {
                existing.name = displayName || existing.name;
                existing.imageUrl = imageUrl || existing.imageUrl;
                existing.source = item?.source || existing.source;
            } else {
                existing.source = existing.source || item?.source || "upload";
            }
            if (item?.worldId !== undefined && existing.worldId === undefined) {
                existing.worldId = item.worldId;
            }
            return;
        }

        const option: WorldAssetOption = {
            id: createCharacterId(displayName, imageUrl, ordered.length),
            kind: "character",
            name: displayName,
            imageUrl,
            source: item?.source || (preferredFromReference ? "reference" : "upload"),
            worldId: item?.worldId,
        };

        ordered.push(option);
        if (nameKey) byName.set(nameKey, option);
        byUrl.set(urlKey, option);
    };

    referenceImages.forEach((item, index) => addOption(item, index, true));
    Vipcharacters.forEach((item, index) => addOption(item, index, false));

    return ordered;
};

const deriveSceneSources = (ImagesHdCloud: string[] = []): WorldAssetOption[] =>
    ImagesHdCloud
        .map((url, index) => ({ url: String(url || "").trim(), index }))
        .filter(({ url }) => isValidAssetUrl(url))
        .map(({ url, index }) => ({
            id: `scene-${index}`,
            kind: "scene" as const,
            name: `Scene ${index + 1}`,
            imageUrl: url,
            source: "scene",
            sceneIndex: index,
        }));

const WorldImage: React.FC<WorldImageProps> = ({
    open,
    onClose,
    darkMode,
    PRIMARY_COLOR,
    charIndex,
    characterData,
    remixPlan,
    setRemixPlan,
    ImagesHdCloud,
    isGeneratingParent, // Receive loading state from parent
    onGenerateTrigger, // Receive function from parent
    Vipcharacters,
    referenceImages
}) => {

    // --- State (Only UI state remains here) ---
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AssetTab>("characters");
    const [isUsing, setIsUsing] = useState(false);

    const characterSources = useMemo(
        () => deriveCharacterSources(referenceImages || [], Vipcharacters || []),
        [referenceImages, Vipcharacters]
    );

    const sceneSources = useMemo(
        () => deriveSceneSources(ImagesHdCloud || []),
        [ImagesHdCloud]
    );

    const defaultTab: AssetTab = characterSources.length > 0 ? "characters" : "scenes";
    const visibleSources = activeTab === "characters" ? characterSources : sceneSources;
    const selectedAsset = useMemo(
        () => [...characterSources, ...sceneSources].find((option) => option.id === selectedAssetId) || null,
        [characterSources, sceneSources, selectedAssetId]
    );

    useEffect(() => {
        if (!open) return;
        setSelectedAssetId(null);
        setActiveTab(defaultTab);
    }, [open, charIndex, defaultTab]);

    useEffect(() => {
        if (activeTab === "characters" && characterSources.length === 0 && sceneSources.length > 0) {
            setActiveTab("scenes");
            return;
        }
        if (activeTab === "scenes" && sceneSources.length === 0 && characterSources.length > 0) {
            setActiveTab("characters");
        }
    }, [activeTab, characterSources.length, sceneSources.length]);

    useEffect(() => {
        if (!selectedAssetId) return;
        if (!visibleSources.some((option) => option.id === selectedAssetId)) {
            setSelectedAssetId(null);
        }
    }, [selectedAssetId, visibleSources]);

    // Result is now derived from the remixPlan which handles the final URL
    const generatedResultUrl = (charIndex !== null && remixPlan?.CharacterImages?.[charIndex])
        ? remixPlan.CharacterImages[charIndex]
        : null;

    // --- Handle Editable Description ---
    const handleDescriptionChange = (newValue: string) => {
        if (charIndex === null || !remixPlan?.Characters) return;
        const updatedCharacters = [...remixPlan.Characters];
        updatedCharacters[charIndex] = {
            ...updatedCharacters[charIndex],
            description: newValue
        };
        setRemixPlan({
            ...remixPlan,
            Characters: updatedCharacters
        });
    };

    const handleUseClick = async (url: string) => {
        setIsUsing(true);
        try {
            const safeUrl = await normalizeImageUrlToS3(url, `world-use-image-${charIndex + 1}`);
            const currentImages = remixPlan.CharacterImages ? [...remixPlan.CharacterImages] : [];
            currentImages[charIndex] = safeUrl;
            setRemixPlan({ ...remixPlan, CharacterImages: currentImages });
        } catch (e) {
            console.error(e);
            alert("Failed to secure the image for this world. Please try again.");
        } finally {
            setIsUsing(false);
        }
    };

    const handleGenerateClick = () => {
        if (charIndex === null || !characterData) return;
        const visualDescription = getWorldCharacterImagePrompt(characterData.description);
        if (!visualDescription.trim()) return;
        onGenerateTrigger(charIndex, visualDescription, selectedAsset?.imageUrl || null);
    };

    useCreationControls('storybook_world_character', 'WorldImage', open && Boolean(characterData), {
        characterName: characterData?.name || '', activeTab, selectedReference: selectedAsset?.name || '',
        referenceCount: visibleSources.length, generating: Boolean(isGeneratingParent),
        hasImage: Boolean(generatedResultUrl), descriptionLength: characterData?.description?.length || 0,
    });
    if (!characterData) return null;

    return (
        <Backdrop
            aria-hidden={false} role="dialog" aria-modal="true" aria-label="World Character Lab"
            sx={{ zIndex: 10000, backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            open={open}
            onClick={onClose}
        >
            <Fade in={open}>
                <Box
                    {...cb('storybook_world_character', 'scroll', 'Scroll Character Lab', 'WorldImage', 'scroll')}
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                        width: "90%", maxWidth: "550px",
                        bgcolor: darkMode ? "#1e1e1e" : "#fff",
                        borderRadius: 4, p: 3,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                        display: "flex", flexDirection: "column", gap: 2,
                        border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        maxHeight: "90vh", overflowY: "auto"
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="h6" sx={{ color: darkMode ? "#fff" : "#000", fontWeight: 900 }}>
                            Character Lab
                        </Typography>
                        <IconButton {...cb('storybook_world_character', 'close', 'Close Character Lab', 'onClose')} onClick={onClose} sx={{ color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Hide controls if result exists OR if Generating */}
                    {!generatedResultUrl && !isGeneratingParent && (
                        <>
                            {/* Reference Selector */}
                            <Box sx={{ mt: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
                                    <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 700, display: 'block' }}>
                                        SELECT REFERENCE (OPTIONAL)
                                    </Typography>
                                    {(characterSources.length > 0 || sceneSources.length > 0) && (
                                        <Box sx={{ display: "flex", p: 0.25, borderRadius: 2, bgcolor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", flexShrink: 0 }}>
                                            {(["characters", "scenes"] as AssetTab[]).map((tab) => {
                                                const disabled = tab === "characters" ? characterSources.length === 0 : sceneSources.length === 0;
                                                const isActive = activeTab === tab;
                                                return (
                                                    <Button
                                                        {...cb('storybook_world_character', `tab_${tab}`, `Show ${tab} references`, 'setActiveTab')}
                                                        key={tab}
                                                        size="small"
                                                        disabled={disabled}
                                                        onClick={() => setActiveTab(tab)}
                                                        sx={{
                                                            minWidth: 78,
                                                            px: 1.25,
                                                            py: 0.5,
                                                            borderRadius: 1.5,
                                                            textTransform: "none",
                                                            fontSize: "0.72rem",
                                                            fontWeight: 800,
                                                            color: isActive ? (darkMode ? "#000" : "#fff") : (darkMode ? "#ddd" : "#333"),
                                                            bgcolor: isActive ? PRIMARY_COLOR : "transparent",
                                                            "&:hover": { bgcolor: isActive ? PRIMARY_COLOR : (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)") },
                                                        }}
                                                    >
                                                        {tab === "characters" ? "Characters" : "Scenes"}
                                                    </Button>
                                                );
                                            })}
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{
                                    display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, pt: 5, alignItems: 'center',
                                    '&::-webkit-scrollbar': { height: '6px' },
                                    '&::-webkit-scrollbar-thumb': { backgroundColor: darkMode ? '#444' : '#ccc', borderRadius: '3px' }
                                }}>
                                    <Box
                                        {...cb('storybook_world_character', 'no_reference', 'Use no reference image', 'setSelectedAssetId')}
                                        onClick={() => setSelectedAssetId(null)}
                                        sx={{
                                            minWidth: '100px', height: '120px', borderRadius: 2,
                                            border: `2px dashed ${selectedAssetId === null ? PRIMARY_COLOR : (darkMode ? '#444' : '#ccc')}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                            bgcolor: selectedAssetId === null ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent'
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: darkMode ? '#888' : '#666', textAlign: 'center' }}>No<br />Image</Typography>
                                    </Box>
                                    {visibleSources.map((asset) => {
                                        const isSelected = selectedAssetId === asset.id;
                                        return (
                                            <Box key={asset.id} sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                                {isSelected && (
                                                    <Button
                                                        {...cb('storybook_world_character', 'use_reference', `Use ${asset.name} as character image`, 'handleUseClick', 'click', 'candidate')}
                                                        size="small"
                                                        variant="contained"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUseClick(asset.imageUrl);
                                                        }}
                                                        disabled={isUsing}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: -38,
                                                            bgcolor: PRIMARY_COLOR, color: darkMode ? '#000' : '#fff',
                                                            fontWeight: 900, fontSize: '0.7rem', zIndex: 10,
                                                            borderRadius: 2, px: 2,
                                                            whiteSpace: 'nowrap',
                                                            '&:hover': { bgcolor: PRIMARY_COLOR, filter: 'brightness(1.2)' }
                                                        }}
                                                    >
                                                        {isUsing ? "..." : "USE IMAGE"}
                                                    </Button>
                                                )}
                                                <Box
                                                    {...cb('storybook_world_character', `select_reference_${asset.id}`, `Select ${asset.name} reference`, 'setSelectedAssetId')}
                                                    onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                                                    sx={{
                                                        width: isSelected ? (matchMobile ? '150px' : '200px') : '100px',
                                                        height: isSelected ? (matchMobile ? '180px' : '240px') : '120px',
                                                        borderRadius: 2,
                                                        border: isSelected ? `2px solid ${PRIMARY_COLOR}` : `1px solid ${darkMode ? '#333' : '#eee'}`,
                                                        overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                                                        bgcolor: 'rgba(0,0,0,0.5)',
                                                        opacity: isSelected ? 1 : 0.7, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                >
                                                    <img src={asset.imageUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                </Box>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        mt: 0.75,
                                                        maxWidth: isSelected ? (matchMobile ? 150 : 200) : 100,
                                                        color: darkMode ? "#ddd" : "#333",
                                                        fontWeight: 700,
                                                        textAlign: "center",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {asset.name}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>

                            {/* Editable Description Field */}
                            <Box>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 700, mb: 0.5, display: 'block' }}>
                                    {characterData.name} - CHARACTER DESCRIPTION
                                </Typography>
                                <TextField
                                    {...cb('storybook_world_character', 'description', `Description for ${characterData.name}`, 'handleDescriptionChange', 'text')}
                                    fullWidth multiline rows={4} variant="outlined"
                                    value={characterData.description}
                                    onChange={(e) => handleDescriptionChange(e.target.value)}
                                    placeholder={'Visual description:\nAppearance and clothing...\n\nPersonality:\nTemperament and speaking style...'}
                                    helperText="Images use the Visual description section. Existing descriptions without sections still work."
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            color: darkMode ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)",
                                            bgcolor: darkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
                                            borderRadius: 2, fontSize: '0.85rem', fontStyle: 'italic',
                                            "& fieldset": { borderColor: 'transparent' },
                                            "&:hover fieldset": { borderColor: PRIMARY_COLOR },
                                            "&.Mui-focused fieldset": { borderColor: PRIMARY_COLOR },
                                        }
                                    }}
                                />
                            </Box>
                        </>
                    )}

                    {/* GENERATING STATE: Show visual feedback */}
                    {isGeneratingParent && !generatedResultUrl && (
                        <Box sx={{
                            mt: 2, py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            bgcolor: darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: 3
                        }}>
                            <CircularProgress size={40} sx={{ color: PRIMARY_COLOR, mb: 2 }} />
                            <Typography variant="body1" sx={{ color: darkMode ? '#fff' : '#000', fontWeight: 'bold' }}>Generating in Background...</Typography>
                            <Typography variant="caption" sx={{ opacity: 0.7, color: darkMode ? '#ccc' : '#444' }}>
                                You can close this window and continue.
                            </Typography>
                        </Box>
                    )}

                    {/* Result Display (Only if not generating and url exists) */}
                    {generatedResultUrl && !isGeneratingParent && (
                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Box sx={{
                                width: "100%", height: { xs: "45vh", md: "47vh" }, borderRadius: 3, overflow: "hidden",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                bgcolor: darkMode ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, mb: 2
                            }}>
                                <img src={generatedResultUrl} alt="Generated" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            </Box>
                            <Typography variant="body2" sx={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}>Image Saved!</Typography>
                        </Box>
                    )}

                    {/* Actions */}
                    <Box sx={{ mt: 2 }}>
                        {isGeneratingParent ? (
                            <Button {...cb('storybook_world_character', 'close_background', 'Close while character image runs in background', 'onClose')} fullWidth variant="outlined" onClick={onClose} sx={{ borderColor: PRIMARY_COLOR, color: PRIMARY_COLOR }}>
                                Close & Let Run in Background
                            </Button>
                        ) : !generatedResultUrl ? (
                            <Button
                                {...cb('storybook_world_character', 'generate', `Generate image for ${characterData.name}`, 'handleGenerateClick', 'click', 'candidate')}
                                fullWidth variant="contained"
                                onClick={handleGenerateClick}
                                disabled={!getWorldCharacterImagePrompt(characterData.description).trim()}
                                startIcon={<AutoFixHighIcon />}
                                sx={{ bgcolor: PRIMARY_COLOR, color: darkMode ? "#000" : "#FFF", fontWeight: 900, py: 1.8, borderRadius: 3 }}
                            >
                                Generate Character
                            </Button>
                        ) : (
                            <Stack direction="row" spacing={2}>
                                <Button
                                    {...cb('storybook_world_character', 'redo', 'Clear generated character image to redo it', 'setRemixPlan', 'click', 'needs_confirmation')}
                                    fullWidth variant="outlined"
                                    // Resetting the image means clearing it from remixPlan in the parent
                                    onClick={() => {

                                        //if (charIndex) return;

                                        const currentImages = remixPlan.CharacterImages ? [...remixPlan.CharacterImages] : [];
                                        currentImages[charIndex] = null; // Clear image
                                        setRemixPlan({ ...remixPlan, CharacterImages: currentImages });
                                    }}
                                    sx={{ color: PRIMARY_COLOR, borderColor: PRIMARY_COLOR }}
                                >
                                    Redo
                                </Button>
                                <Button {...cb('storybook_world_character', 'done', 'Keep character image and return to World', 'onClose')} fullWidth variant="contained" onClick={onClose} sx={{ bgcolor: PRIMARY_COLOR, color: darkMode ? '#000' : '#fff' }}>Done</Button>
                            </Stack>
                        )}
                    </Box>
                </Box>
            </Fade>
        </Backdrop>
    );
};

export default WorldImage;
