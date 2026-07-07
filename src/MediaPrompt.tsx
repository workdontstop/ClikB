import React, { useMemo, useState, useEffect } from "react";
import { Box, IconButton, Fade, Backdrop, Typography, Portal } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import Button from "@mui/material/Button";


import WorldModel from './WorldModel';


import { useSelector } from "react-redux";

import { RootState } from "./store";


// --- IMPORT CHILD COMPONENTS ---
import MediaPromptImage from "./MediaPromptImage";
import MediaFinalImage from "./MediaFinalImage";

interface MediaPromptProps {
    type: number;
    index: number;
    generatedImagesFlux?: string[];
    FluxIm?: string;
    GeneratedImage?: any;
    selectedPromptImages: string[];
    onUpdatePromptSelection: (images: string[]) => void;
    selectedFinalImages: string[];
    onUpdateFinalSelection: (images: string[]) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    darkMode: boolean;
    matchMobile: boolean;
    onImageUrlChange: any;
    setGeneratedImagePrompt: any;
    generatedImagePrompt: any;
    ImagesHdCloud: any;
    PostId: any;
    selectedStyle: any;
    Planx: any;
    Seed: any;
    steps: any;
    modelz: any;
    onFileChange: any;
    worldModelsInuse: any;
    setWorldModelsInuse: any;
    resultImages: string[]; // NEW
    Vipcharacters?: any[];
    setVipcharacters?: any;
    setReferenceImages?: any;
}

const MediaPrompt: React.FC<MediaPromptProps> = ({
    Vipcharacters,
    setVipcharacters,
    setReferenceImages,
    type,
    index,
    generatedImagesFlux,
    FluxIm,
    GeneratedImage,
    selectedPromptImages,
    onUpdatePromptSelection,
    selectedFinalImages,
    onUpdateFinalSelection,
    fileInputRef,
    darkMode,
    matchMobile,
    onImageUrlChange,
    setGeneratedImagePrompt,
    generatedImagePrompt,
    ImagesHdCloud,
    PostId,
    selectedStyle,
    Planx,
    Seed,
    steps,
    modelz,
    onFileChange,
    worldModelsInuse,
    setWorldModelsInuse,
    resultImages = [] // Default to empty
}) => {
    const [open, setOpen] = useState(false);

    const [showWorldModel3, setShowWorldModel3] = useState(false);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    // --- 1. CALCULATE PROMPT LIST ---
    const initialPromptList = useMemo(() => {
        // Check if it's an array and has items
        if (GeneratedImage && GeneratedImage.length > 0) {
            // Return a copy of the array (Spread operator)
            return [...GeneratedImage];
        }
        // Return empty array if nothing exists
        return [];
    }, [GeneratedImage]);

    // --- 2. CALCULATE FINAL HISTORY (And Auto-Select Latest) ---
    // --- 2. CALCULATE FINAL HISTORY (Derived from props) ---
    // Instead of syncing local state, we derive the list directly from the authoritative "resultImages" prop
    // plus any immediate "current" image that might differ (though ideally parent syncs them).
    const finalHistoryList = useMemo(() => {
        let current = "";
        if (type === 0 && generatedImagesFlux?.[index]) {
            current = generatedImagesFlux[index];
        } else if (type === 1 && FluxIm) {
            current = FluxIm;
        }

        // Combine current + history (resultImages)
        // resultImages is passed from parent. Parent updates it on generation.
        // We use a Set to ensure uniqueness and correct ordering (Current -> Newest History -> Oldest History)
        const combined = new Set<string>();

        if (current) combined.add(current);
        if (resultImages && Array.isArray(resultImages)) {
            resultImages.forEach(img => combined.add(img));
        }

        return Array.from(combined);
    }, [generatedImagesFlux, FluxIm, type, index, resultImages]);

    // Remove the setFinalHistoryList state setter since we use useMemo now
    // convert existing usages of setFinalHistoryList to no-ops or remove logic that updates it locally if any exists.
    // (The only other usage was the useEffect we are replacing).

    // B. Auto-Select the Newest Image (Index 0) whenever history changes
    useEffect(() => {
        if (finalHistoryList.length > 0) {
            // Only update if the selection isn't already the newest one
            if (selectedFinalImages[0] !== finalHistoryList[0]) {
                onUpdateFinalSelection([finalHistoryList[0]]);
            }
        }
    }, [finalHistoryList, onUpdateFinalSelection, selectedFinalImages]);

    // --- 3. AUTO-INIT PROMPTS ---
    useEffect(() => {
        // If nothing is selected, but we have images available...
        if (selectedPromptImages.length === 0 && initialPromptList.length > 0) {

            // OLD: onUpdatePromptSelection([initialPromptList[0]]); // Selected only the first one

            // NEW: Selects the entire list
            onUpdatePromptSelection(initialPromptList);
        }
    }, [initialPromptList, selectedPromptImages.length, onUpdatePromptSelection]);

    // --- 4. THUMBNAIL (Strictly Media Prompt Images) ---
    const currentThumbnail = useMemo(() => {
        // Only show images from the Prompt selection
        if (selectedPromptImages.length > 0) {
            // Return the "latest" selected (usually the last one added to the array)
            return selectedPromptImages[selectedPromptImages.length - 1];
        }
        return "";
    }, [selectedPromptImages]);

    // --- HANDLERS ---
    const handleTriggerPicker = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleSelectPrompt = (url: string) => {
        const newSelection = selectedPromptImages.includes(url)
            ? selectedPromptImages.filter(i => i !== url)
            : [...selectedPromptImages, url];
        onUpdatePromptSelection(newSelection);
    };

    // Note: handleSelectFinal is not actually used by the child anymore for clicking,
    // but we pass the auto-selected state down.

    return (
        <>
            {/* FLOATING ENTRY */}
            <Box sx={{ position: "absolute", top: matchMobile ? "70px" : "16px", left: "auto", right: { xs: 8, md: "1vw" }, zIndex: 30000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "none" }}>
                {currentThumbnail && typeof currentThumbnail === 'string' && currentThumbnail.trim() !== "" ? (
                        <Box
                            onClick={() => setOpen(true)}
                            sx={{
                                position: "relative", // Needed for absolute positioning of badge
                                width: matchMobile ? 60 : 80,
                                height: matchMobile ? 60 : 80,
                                borderRadius: "50%",
                                overflow: "visible", // Allow badge to overflow
                                cursor: "pointer",
                                border: `2px solid ${darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)"}`,
                                boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
                                transition: "transform 0.2s",
                                "&:hover": { transform: "scale(1.05)", borderColor: darkMode ? "#fff" : "#000" }
                            }}
                        >
                            {/* Image Container with overflow hidden to keep image rounded */}
                            <Box sx={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
                                <img src={currentThumbnail} alt="Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </Box>

                        {/* Selected Count Badge */}
                        <Box sx={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bgcolor: "#ef5350", // Red color for visibility
                            color: "white",
                            borderRadius: "50%",
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            border: `2px solid ${darkMode ? "#000" : "#fff"}`,
                            boxShadow: 2,
                            zIndex: 2
                        }}>
                            {selectedPromptImages.length}
                        </Box>
                    </Box>
                ) : (
                    <Button onClick={() => setOpen(true)} variant="contained" sx={{ width: 44, height: 44, borderRadius: "50%", minWidth: 0, bgcolor: darkMode ? "rgb(100,100,100,0.4)" : "rgb(250,250,250,0.4)", color: darkMode ? "white" : "black", backdropFilter: "blur(10px)", boxShadow: 3, "&:hover": { bgcolor: darkMode ? "rgba(100,100,100,0.7)" : "rgba(250,250,250,0.7)" } }}>
                        <AddPhotoAlternateIcon sx={{ fontSize: "1.3rem" }} />
                    </Button>
                )}
                <Typography variant="caption" sx={{ mt: 1, color: darkMode ? "#fff" : "#000", fontWeight: "bold", textShadow: "0 1px 4px rgba(0,0,0,0.5)", display: "none" }}>Prompt</Typography>
            </Box>

            {/* MODAL */}
            <Portal>
              <Backdrop open={open} sx={{ zIndex: 40000, height: '100vh', color: '#fff', backgroundColor: darkMode ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)" }}>
                  <Fade in={open}>
                      <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "88vh", display: "flex", flexDirection: "column", color: darkMode ? "#fff" : "#000" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, pt: matchMobile ? 4 : 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 1 }}>SCENE {index + 1}</Typography>
                            <IconButton onClick={() => setOpen(false)} sx={{ color: "inherit" }}><CloseIcon sx={{ fontSize: "2rem" }} /></IconButton>
                        </Box>

                        <MediaFinalImage
                            Vipcharacters={Vipcharacters}
                            setVipcharacters={setVipcharacters}
                            setReferenceImages={setReferenceImages}
                            index={index}
                            showWorldModel3={showWorldModel3}
                            setshowWorldModel3={setShowWorldModel3}
                            onFileChange={onFileChange}

                            PostId={PostId}
                            selectedStyle={selectedStyle}
                            Planx={Planx}
                            Seed={Seed}
                            prompt={prompt}
                            generatedImagesFlux={generatedImagesFlux ? generatedImagesFlux[0] : ''}

                            steps={steps}
                            modelz={modelz}



                            onImageUrlChange={onImageUrlChange}
                            imagesList={finalHistoryList}
                            selectedImages={selectedFinalImages}
                            onTriggerFilePicker={handleTriggerPicker}
                            darkMode={darkMode}
                        />
                      </Box>
                  </Fade>
              </Backdrop>
            </Portal>
        </>
    );
};

export default MediaPrompt;
