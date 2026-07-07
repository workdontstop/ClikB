import React, { useState } from "react";
import { Box, Typography, Button, Backdrop, Fade, IconButton, Stack, CircularProgress, TextField } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { matchMobile } from "./DetectDevice";

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

const WorldImage: React.FC<WorldImageProps> = ({
    open,
    onClose,
    darkMode,
    PRIMARY_COLOR,
    charIndex,
    characterData,
    remixPlan,
    setRemixPlan,
    Planx,
    ImagesHdCloud,
    isGeneratingParent, // Receive loading state from parent
    onGenerateTrigger, // Receive function from parent
    onClosex,
    Vipcharacters,
    referenceImages
}) => {

    // --- State (Only UI state remains here) ---
    const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
    const [isUsing, setIsUsing] = useState(false);

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

    const allReferenceImages = [
        ...(ImagesHdCloud || []),
        ...(Vipcharacters?.map((v: any) => v.imageUrl) || []),
        ...(referenceImages?.map((r: any) => r.imageUrl) || [])
    ].filter(Boolean);

    const handleUseClick = async (url: string) => {
        setIsUsing(true);
        try {
            const res = await fetch(url, { mode: 'cors' });
            const blob = await res.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = reader.result;
                const currentImages = remixPlan.CharacterImages ? [...remixPlan.CharacterImages] : [];
                currentImages[charIndex] = base64data;
                setRemixPlan({ ...remixPlan, CharacterImages: currentImages });
                setIsUsing(false);
            };
        } catch (e) {
            console.error(e);
            setIsUsing(false);
            alert("Failed to fetch the image. It might be restricted by CORS.");
        }
    };

    const handleGenerateClick = () => {
        if (charIndex === null || !characterData) return;

        let s3InputImage = null;
        if (selectedImageIndex >= 0 && allReferenceImages[selectedImageIndex]) {
            s3InputImage = allReferenceImages[selectedImageIndex];
        }

        // Trigger parent function. Logic runs in parent, so we can close this modal if we want.
        onGenerateTrigger(charIndex, characterData.description, s3InputImage);
    };

    if (!characterData) return null;

    return (
        <Backdrop
            sx={{ zIndex: 10000, backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            open={open}
            onClick={onClose}
        >
            <Fade in={open}>
                <Box
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
                        <IconButton onClick={onClose} sx={{ color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)" }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Hide controls if result exists OR if Generating */}
                    {!generatedResultUrl && !isGeneratingParent && (
                        <>
                            {/* Reference Selector */}
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 700, mb: 1, display: 'block' }}>
                                    SELECT REFERENCE (OPTIONAL)
                                </Typography>
                                <Box sx={{
                                    display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, pt: 5, alignItems: 'center',
                                    '&::-webkit-scrollbar': { height: '6px' },
                                    '&::-webkit-scrollbar-thumb': { backgroundColor: darkMode ? '#444' : '#ccc', borderRadius: '3px' }
                                }}>
                                    <Box
                                        onClick={() => setSelectedImageIndex(-1)}
                                        sx={{
                                            minWidth: '100px', height: '120px', borderRadius: 2,
                                            border: `2px dashed ${selectedImageIndex === -1 ? PRIMARY_COLOR : (darkMode ? '#444' : '#ccc')}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                            bgcolor: selectedImageIndex === -1 ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent'
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: darkMode ? '#888' : '#666', textAlign: 'center' }}>No<br />Image</Typography>
                                    </Box>
                                    {allReferenceImages?.map((imgUrl, idx) => {
                                        const isSelected = selectedImageIndex === idx;
                                        return (
                                            <Box key={idx} sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                {isSelected && (
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUseClick(imgUrl);
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
                                                    onClick={() => setSelectedImageIndex(isSelected ? -1 : idx)}
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
                                                    <img src={imgUrl} alt="ref" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>

                            {/* Editable Description Field */}
                            <Box>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 700, mb: 0.5, display: 'block' }}>
                                    {characterData.name} - VISUAL DESCRIPTION
                                </Typography>
                                <TextField
                                    fullWidth multiline rows={4} variant="outlined"
                                    value={characterData.description}
                                    onChange={(e) => handleDescriptionChange(e.target.value)}
                                    placeholder="Describe the character's appearance..."
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
                            <Button fullWidth variant="outlined" onClick={onClose} sx={{ borderColor: PRIMARY_COLOR, color: PRIMARY_COLOR }}>
                                Close & Let Run in Background
                            </Button>
                        ) : !generatedResultUrl ? (
                            <Button
                                fullWidth variant="contained"
                                onClick={handleGenerateClick}
                                startIcon={<AutoFixHighIcon />}
                                sx={{ bgcolor: PRIMARY_COLOR, color: darkMode ? "#000" : "#FFF", fontWeight: 900, py: 1.8, borderRadius: 3 }}
                            >
                                Generate Character
                            </Button>
                        ) : (
                            <Stack direction="row" spacing={2}>
                                <Button
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
                                <Button fullWidth variant="contained" onClick={onClose} sx={{ bgcolor: PRIMARY_COLOR }}>Done</Button>
                            </Stack>
                        )}
                    </Box>
                </Box>
            </Fade>
        </Backdrop>
    );
};

export default WorldImage;
