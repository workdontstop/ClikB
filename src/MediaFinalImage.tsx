import React, { useState } from "react";
import axios from "axios";
import { Box, Button, Typography, Grid, CircularProgress } from "@mui/material";
import { alpha, getContrastRatio } from '@mui/material/styles';
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';

import { useSelector } from "react-redux";

import { RootState } from "./store";

import { matchMobile, matchPc, matchTablet } from "./DetectDevice";

import WorldModel from './WorldModel';
import { Saveprompthelperfordellater } from './SavepromptHelpersLocal';
import { normalizeImageUrlToS3 } from './imageCorsDownloadManager';
import { creationBinding as cb } from './creationControlSnapshot';

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const MEDIA_FINAL_CHARACTER_BROWSER_TRANSFER = true;

const copyImageToS3InBrowser = async (sourceUrl: string): Promise<string> => {
    let imageBlob: Blob;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
        const imageResponse = await fetch(sourceUrl, { signal: controller.signal });
        if (!imageResponse.ok) throw new Error(`Character source image fetch failed: ${imageResponse.status}`);
        imageBlob = await imageResponse.blob();
    } catch (error) {
        // Existing server normalization creates an independent copy, including for own S3 sources.
        // Restrict fallback to reading a remote source; failed uploads must not make another copy.
        if (!/^https?:\/\//i.test(sourceUrl)) throw error;
        return normalizeImageUrlToS3(sourceUrl, `saved-scene-reference-${Date.now()}`);
    } finally {
        clearTimeout(timeout);
    }

    const signedResponse: any = await axios.post(
        `${CLIK_URL}/get_signed_url_imageStory`,
        { values: { count: 1 } },
        { withCredentials: true }
    );
    const signedUrl = signedResponse.data?.holder?.[0]?.urlHD;
    if (!signedUrl) throw new Error("Failed to create character image upload URL.");

    await axios.put(signedUrl, imageBlob, {
        headers: { "Content-Type": imageBlob.type || "application/octet-stream" },
    });
    return signedUrl.split("?")[0];
};




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
    referenceImages?: any[];
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
    referenceImages,
    setVipcharacters,
    setReferenceImages
}) => {
    const uniqueImages = Array.from(new Set(imagesList));

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight) || (darkModeReducer ? '#39DDF5' : '#3157C8');
    const accentText = getContrastRatio(appColor, '#111') >= 4.5 ? '#111' : '#fff';

    const [downloadingImg, setDownloadingImg] = useState<string | null>(null);

    const handleImageClick = async (imgSrc: string) => {
        if (downloadingImg === imgSrc) return;
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
    const sceneNumber = Number.isFinite(Number(index)) ? Number(index) + 1 : 1;
    const sceneName = `Scene ${sceneNumber}`;
    const [savingSceneReference, setSavingSceneReference] = useState(false);

    const getNextSavedSceneName = () => {
        const baseName = `Saved${sceneNumber}`;
        const combined = [
            ...(Array.isArray(Vipcharacters) ? Vipcharacters : []),
            ...(Array.isArray(referenceImages) ? referenceImages : []),
        ];
        const usedNames = new Set(
            combined
                .map((item: any) => String(item?.name || "").trim().toLowerCase())
                .filter(Boolean)
        );

        if (!usedNames.has(baseName.toLowerCase())) return baseName;

        for (let code = 98; code <= 122; code += 1) {
            const candidate = `${baseName}${String.fromCharCode(code)}`;
            if (!usedNames.has(candidate.toLowerCase())) return candidate;
        }

        let overflowIndex = 2;
        while (usedNames.has(`${baseName}z${overflowIndex}`.toLowerCase())) {
            overflowIndex += 1;
        }
        return `${baseName}z${overflowIndex}`;
    };

    const handleSaveSceneReference = async () => {
        if (!activeImageUrl || !setVipcharacters || savingSceneReference) return;

        setSavingSceneReference(true);
        try {
            const savedName = getNextSavedSceneName();
            const uploadedUrl = MEDIA_FINAL_CHARACTER_BROWSER_TRANSFER
                ? await copyImageToS3InBrowser(String(activeImageUrl))
                : await normalizeImageUrlToS3(
                    String(activeImageUrl),
                    `saved-scene-${sceneNumber}-${Date.now()}`
                );
            Saveprompthelperfordellater(uploadedUrl);

            const description = `Frozen saved visual reference copied from ${sceneName}. Use as a stable reusable asset.`;
            const commonRecord = {
                name: savedName,
                description,
                imageUrl: uploadedUrl,
                url: uploadedUrl,
                image: uploadedUrl,
                type: "saved-scene",
                source: "saved-scene",
                sourceSceneName: sceneName,
                sourceSceneIndex: sceneNumber - 1,
                sourceImageUrl: activeImageUrl,
                vipSourceImageUrl: uploadedUrl,
                isVip: true,
                isGenerating: false,
                prompt: description,
                originalPrompt: description,
            };

            const removeLegacySceneRecord = (item: any) => {
                const itemName = String(item?.name || "").trim();
                const itemUrl = String(item?.imageUrl || item?.url || item?.image || "").trim();
                const itemDescription = String(item?.description || item?.prompt || "").trim();
                const itemSource = String(item?.source || "").trim();
                return itemName === sceneName && (
                    itemUrl === activeImageUrl ||
                    itemDescription === "Scene Environment" ||
                    itemSource === "scene"
                );
            };

            setVipcharacters((prev: any) => [
                ...(Array.isArray(prev) ? prev.filter((item: any) => !removeLegacySceneRecord(item)) : []),
                commonRecord,
            ]);
            if (setReferenceImages) {
                setReferenceImages((prev: any) => [
                    ...(Array.isArray(prev) ? prev.filter((item: any) => !removeLegacySceneRecord(item)) : []),
                    commonRecord,
                ]);
            }
        } catch (error) {
            console.error("Failed to save scene as character reference", error);
        } finally {
            setSavingSceneReference(false);
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
                            {...cb('workstation_image_context', 'add_to_characters', 'Save the selected scene result as a reusable character reference', 'handleSaveSceneReference', 'click', 'candidate')}
                            onClick={handleSaveSceneReference}
                            variant="outlined"
                            disabled={savingSceneReference}
                            sx={{
                                color: accentText,
                                borderColor: darkModeReducer ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                bgcolor: appColor,
                                borderRadius: 4,
                                backdropFilter: 'blur(10px)',
                                px: 4,
                                py: 1,
                                fontWeight: 700,
                                textTransform: 'none',
                                '&:hover': {
                                    bgcolor: appColor,
                                    filter: 'brightness(0.9)',
                                    borderColor: darkModeReducer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                                }
                            }}
                        >
                            {savingSceneReference ? 'Saving...' : 'Add to Characters'}
                        </Button>
                    </Box>
                )}

                {/* Reduced spacing={1.5} for a tighter mobile look, looks cleaner */}
                <Grid container spacing={1.5} justifyContent="flex-start">

                    {/* Upload Button */}
                    {/* CHANGED: xs={6} (2 items per row) for mobile. xs={4} (3 items) is too crowded for 9:16 aspect ratio */}
                    <Grid item xs={6} sm={4} md={2.4}>
                        <Button
                            {...cb('workstation_image_context', 'upload_result_image', 'Open the user-operated result image upload flow', 'setshowWorldModel3', 'click', 'information_only')}
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
                                "&:hover": { borderColor: appColor, bgcolor: alpha(appColor, 0.08) }
                            }}
                        >
                            <AssignmentIndIcon fontSize="large" style={{ color: appColor }} />
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
                                    {...cb('workstation_image_context', `select_result_${idx + 1}`, `Use ${idx === 0 ? 'current' : `earlier ${idx + 1}`} scene result as active image`, 'handleImageClick')}
                                    onClick={() => handleImageClick(imgSrc)}
                                    sx={{
                                        position: "relative",
                                        aspectRatio: "9/16",
                                        borderRadius: 2,
                                        overflow: "hidden",
                                        cursor: downloadingImg === imgSrc ? "default" : "pointer",
                                        border: isSelected ? `3px solid ${appColor}` : "1px solid transparent",
                                        boxShadow: isSelected ? `0 0 15px ${alpha(appColor, 0.6)}` : "0 4px 10px rgba(0,0,0,0.3)",
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
                                            <CheckCircleIcon sx={{ fontSize: 24, color: appColor }} />
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
