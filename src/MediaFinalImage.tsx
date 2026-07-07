import React, { useState } from "react";
import { Box, Button, Typography, Grid, CircularProgress } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';

import { useSelector } from "react-redux";

import { RootState } from "./store";

import { matchMobile, matchPc, matchTablet } from "./DetectDevice";

import WorldModel from './WorldModel';




interface MediaFinalImageProps {
    imagesList: string[];
    selectedImages: string[];
    onTriggerFilePicker: () => void;
    darkMode: boolean;
    onImageUrlChange: any;

    PostId: any;
    selectedStyle: any;
    Planx: any;
    Seed: any;
    steps: any;
    modelz: any;
    generatedImagesFlux: any;
    prompt: any;
    onFileChange: any;
    showWorldModel3: any; setshowWorldModel3: any;
    index?: number;
    Vipcharacters?: any[];
    setVipcharacters?: any;
    setReferenceImages?: any;
}

const MediaFinalImage: React.FC<MediaFinalImageProps> = ({
    imagesList,
    selectedImages,
    onTriggerFilePicker,
    darkMode,
    onImageUrlChange,


    PostId,
    selectedStyle,
    Planx,
    Seed,
    steps,
    modelz,
    generatedImagesFlux,
    prompt,
    onFileChange,
    showWorldModel3, setshowWorldModel3,
    index,
    Vipcharacters,
    setVipcharacters,
    setReferenceImages
}) => {
    const uniqueImages = Array.from(new Set(imagesList));

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const [downloadingImg, setDownloadingImg] = useState<string | null>(null);

    const handleImageClick = async (imgSrc: string) => {
        if (selectedImages.includes(imgSrc) || downloadingImg === imgSrc) return;
        setDownloadingImg(imgSrc);
        try {
            await onImageUrlChange(imgSrc, 0);
        } catch (error) {
            console.error(error);
        } finally {
            setDownloadingImg(null);
        }
    };

    const activeImageUrl = selectedImages && selectedImages.length > 0 ? selectedImages[0] : null;
    const sceneName = `Scene ${index !== undefined ? index + 1 : ''}`;
    const isAddedToChars = Vipcharacters?.some(v => v.name === sceneName && (v.imageUrl === activeImageUrl || v.image === activeImageUrl));

    // Auto-remove outdated image
    React.useEffect(() => {
        if (!activeImageUrl || !Vipcharacters || !setVipcharacters) return;
        const existingChar = Vipcharacters.find(v => v.name === sceneName);
        if (existingChar && existingChar.imageUrl !== activeImageUrl && existingChar.image !== activeImageUrl) {
            setVipcharacters((prev: any) => prev.filter((v: any) => v.name !== sceneName));
            if (setReferenceImages) {
                setReferenceImages((prev: any) => prev.filter((v: any) => v.name !== sceneName));
            }
        }
    }, [activeImageUrl, sceneName, Vipcharacters, setVipcharacters, setReferenceImages]);

    const handleToggleVipCharacter = () => {
        if (!activeImageUrl || !setVipcharacters) return;
        if (isAddedToChars) {
            setVipcharacters((prev: any) => prev.filter((v: any) => v.name !== sceneName));
            if (setReferenceImages) {
                setReferenceImages((prev: any) => prev.filter((v: any) => v.name !== sceneName));
            }
        } else {
            const newVip = {
                name: sceneName,
                description: "Scene Environment",
                imageUrl: activeImageUrl
            };
            setVipcharacters((prev: any) => {
                const filtered = prev ? prev.filter((v: any) => v.name !== sceneName) : [];
                return [...filtered, newVip];
            });
            if (setReferenceImages) {
                const newRef = {
                    name: sceneName,
                    type: 'character',
                    imageUrl: activeImageUrl,
                    prompt: "Scene Environment",
                    description: "Scene Environment",
                    isGenerating: false,
                    isVip: true
                };
                setReferenceImages((prev: any) => {
                    const filtered = prev ? prev.filter((v: any) => v.name !== sceneName) : [];
                    return [...filtered, newRef];
                });
            }
        }
    };

    return (

        <>

            <WorldModel
                DirectUpload={true}
                selectedImages={[]}
                handleSelection={onImageUrlChange}

                PostId={PostId}
                selectedStyle={selectedStyle}

                Seed={Seed}
                prompt={prompt}
                GeneratedImageFirst={generatedImagesFlux ? generatedImagesFlux[0] : ''}
                mode={2}
                open={showWorldModel3}
                onClose={() => setshowWorldModel3(false)}

                // Data Props
                steps={steps}
                ImagesHdCloud={[]}
                GeneratedText={[]}
                Planx={Planx}

                // Action Props

                handleFileChange={onFileChange

                } // <--- Pass your existing file handler here

                // UI Props
                darkMode={darkModeReducer}
                matchMobile={matchMobile}
                modelz={modelz}
                GeneratedImageFlux={generatedImagesFlux} // or whatever state tracks generation
                parsedKeyPoints={steps} // or [] if not available in this scope
            />
            <Box sx={{ flex: 1, p: 2, overflowY: "auto", overflowX: "hidden" }}>
                {/* Character Toggle Button */}
                {activeImageUrl && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                        <Button
                            onClick={handleToggleVipCharacter}
                            variant="outlined"
                            sx={{
                                color: isAddedToChars ? (darkModeReducer ? 'white' : 'black') : 'white',
                                borderColor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                bgcolor: isAddedToChars ? (darkModeReducer ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : '#0099cc',
                                borderRadius: 4,
                                backdropFilter: 'blur(10px)',
                                px: 4,
                                py: 1,
                                fontWeight: 700,
                                textTransform: 'none',
                                '&:hover': {
                                    bgcolor: isAddedToChars ? (darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : '#007bb5',
                                    borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                                }
                            }}
                        >
                            {isAddedToChars ? 'Remove from Characters' : 'Add to Characters'}
                        </Button>
                    </Box>
                )}

                {/* Reduced spacing={1.5} for a tighter mobile look, looks cleaner */}
                <Grid container spacing={1.5} justifyContent="flex-start">

                    {/* Upload Button */}
                    {/* CHANGED: xs={6} (2 items per row) for mobile. xs={4} (3 items) is too crowded for 9:16 aspect ratio */}
                    <Grid item xs={6} sm={4} md={2.4}>
                        <Button
                            variant="outlined"
                            onClick={

                                () => {

                                    setshowWorldModel3(true);
                                }


                            }
                            sx={{
                                width: "100%",
                                aspectRatio: "9/16",
                                borderRadius: 2,
                                borderStyle: 'dashed',
                                borderColor: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                color: 'inherit',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                                // Added :active for mobile touch feedback
                                "&:active": { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                "&:hover": { borderColor: darkMode ? '#fff' : '#000', bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                            }}
                        >
                            <AssignmentIndIcon fontSize="large" style={{ color: darkModeReducer ? 'yellow' : '#0099cc' }} />
                            <Typography variant="caption" align="center" sx={{ lineHeight: 1.2, fontWeight: 500 }}>
                                Upload Result Image
                            </Typography>
                        </Button>
                    </Grid>

                    {/* Images */}
                    {uniqueImages.map((imgSrc, idx) => {
                        const isSelected = selectedImages.includes(imgSrc);
                        return (
                            // CHANGED: xs={6} here too. Matches the button.
                            <Grid item xs={6} sm={4} md={2.4} key={`${imgSrc}-${idx}`}>
                                <Box
                                    onClick={() => handleImageClick(imgSrc)}
                                    sx={{
                                        position: "relative",
                                        aspectRatio: "9/16",
                                        borderRadius: 2,
                                        overflow: "hidden",
                                        cursor: isSelected || downloadingImg === imgSrc ? "default" : "pointer",
                                        border: isSelected ? `3px solid ${darkMode ? "#4caf50" : "#2e7d32"}` : "1px solid transparent",
                                        boxShadow: isSelected ? "0 0 15px rgba(76, 175, 80, 0.6)" : "0 4px 10px rgba(0,0,0,0.3)",
                                        transition: "all 0.2s ease-in-out",
                                        opacity: downloadingImg === imgSrc ? 0.6 : 1,
                                        // Added :active for mobile tap effect (scale down slightly on press)
                                        "&:active": { transform: downloadingImg === imgSrc ? "none" : "scale(0.98)" },
                                        "&:hover": { transform: downloadingImg === imgSrc ? "none" : "scale(1.02)" }
                                    }}
                                >
                                    <img src={imgSrc} alt={`Final ${idx}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    {downloadingImg === imgSrc && (
                                        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.3)", zIndex: 1 }}>
                                            <CircularProgress size={32} color="inherit" sx={{ color: 'white' }} />
                                        </Box>
                                    )}
                                    {isSelected && !downloadingImg && (
                                        <Box sx={{ position: "absolute", top: 8, right: 8, bgcolor: "white", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                                            <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                                        </Box>
                                    )}
                                </Box>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>

        </>
    );
};

export default MediaFinalImage;
