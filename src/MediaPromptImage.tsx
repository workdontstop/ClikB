import React, { useRef, useMemo, useState } from "react";
import { Box, Button, Typography, Grid } from "@mui/material";

import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CollectionsIcon from '@mui/icons-material/Collections'; // Icon for Scenes
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // Icon for Back
import axios from "axios";

import { matchMobile, matchPc, matchTablet } from "./DetectDevice";

import WorldModel from './WorldModel';


import { Saveprompthelperfordellater } from "./SavepromptHelpersLocal";

import { useSelector } from "react-redux";

import { RootState } from "./store";


// NOTE: ensure CLIK_URL is defined or imported from your config
const CLIK_URL = import.meta.env.VITE_CLIK_URL || "";

// --- Helper Functions ---

const isIphone = () => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPod/.test(navigator.userAgent);
};

async function convertToHDWebpOrJpegByDevicex(
    inputBlob: Blob,
    modelx: any, // Ignored: Enforces strict HD standards for all models
    ratioKeyx: any // 1=Portrait (9:16), 2=Square (1:1), 3=Landscape (16:9)
): Promise<Blob> {
    const reader = new FileReader();
    return new Promise<Blob>((resolve, reject) => {
        reader.onerror = (e) => reject(e);
        reader.onload = () => {
            const imageUrl = reader.result as string;
            const img = new Image();
            img.onerror = (e) => reject(e);
            img.onload = () => {
                // --- 1) STRICT Target Dimensions (Standard HD) ---
                let tW: number, tH: number;

                if (ratioKeyx === 1) {
                    // Portrait 9:16 -> 1080x1920
                    tW = 1080;
                    tH = 1920;
                } else if (ratioKeyx === 3) {
                    // Landscape 16:9 -> 1920x1080
                    tW = 1920;
                    tH = 1080;
                } else {
                    // Square 1:1 (Default or ty=2) -> 1080x1080
                    tW = 1080;
                    tH = 1080;
                }

                // --- 2) Compute "Cover" Crop (Center Crop) ---
                // This prevents stretching by cutting off edges to fill the box.
                const srcW = img.width;
                const srcH = img.height;
                const srcRatio = srcW / srcH;
                const tgtRatio = tW / tH;

                let sx: number, sy: number, sW: number, sH: number;

                if (srcRatio > tgtRatio) {
                    // Source is wider than target -> Crop left/right
                    sH = srcH;
                    sW = srcH * tgtRatio;
                    sx = (srcW - sW) / 2;
                    sy = 0;
                } else {
                    // Source is taller than target -> Crop top/bottom
                    sW = srcW;
                    sH = srcW / tgtRatio;
                    sx = 0;
                    sy = (srcH - sH) / 2;
                }

                // --- 3) Draw to Canvas ---
                const canvas = document.createElement("canvas");
                canvas.width = tW;
                canvas.height = tH;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    return reject(new Error("Canvas 2D context unavailable."));
                }

                // Draw cropped source onto specific target size
                ctx.drawImage(img, sx, sy, sW, sH, 0, 0, tW, tH);

                // --- 4) Export ---
                // Using PNG prevents artifacts, or use your device logic if preferred.
                // I kept your original logic here, or you can hardcode "image/png" for quality.
                const format = "image/png";

                canvas.toBlob(
                    (blobOut) => {
                        if (blobOut) resolve(blobOut);
                        else reject(new Error("toBlob returned null"));
                    },
                    format,
                    0.9 // High quality
                );
            };
            img.src = imageUrl;
        };
        reader.readAsDataURL(inputBlob);
    });
}



async function convertToHDWebpOrJpegByDeviceHdx(
    inputBlob: Blob,
    modelx: any, // Ignored: Enforces strict HD standards for all models
    ratioKeyx: any // 1=Portrait (9:16), 2=Square (1:1), 3=Landscape (16:9)
): Promise<Blob> {
    const reader = new FileReader();
    return new Promise<Blob>((resolve, reject) => {
        reader.onerror = e => reject(e);
        reader.onload = () => {
            const imageUrl = reader.result as string;
            const img = new Image();
            img.onerror = e => reject(e);
            img.onload = () => {
                // --- 1) STRICT Target Dimensions (Standard HD) ---
                let tW: number, tH: number;

                if (ratioKeyx === 1) {
                    // Portrait 9:16
                    tW = 1080;
                    tH = 1920;
                } else if (ratioKeyx === 3) {
                    // Landscape 16:9
                    tW = 1920;
                    tH = 1080;
                } else {
                    // Square 1:1 (Default or ratioKeyx === 2)
                    tW = 1080;
                    tH = 1080;
                }

                // 2) compute crop box in source to match target aspect ratio
                // This prevents stretching by cutting off edges to fill the box perfectly.
                const srcW = img.width;
                const srcH = img.height;
                const srcRatio = srcW / srcH;
                const tgtRatio = tW / tH;

                let sx: number, sy: number, sW: number, sH: number;
                if (srcRatio > tgtRatio) {
                    // source is wider -> crop sides
                    sH = srcH;
                    sW = srcH * tgtRatio;
                    sx = (srcW - sW) / 2;
                    sy = 0;
                } else {
                    // source is taller -> crop top/bottom
                    sW = srcW;
                    sH = srcW / tgtRatio;
                    sx = 0;
                    sy = (srcH - sH) / 2;
                }

                // 3) draw into canvas
                const canvas = document.createElement("canvas");
                canvas.width = tW;
                canvas.height = tH;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    return reject(new Error("Canvas 2D context unavailable."));
                }

                // Draw cropped source onto specific target size
                ctx.drawImage(
                    img,
                    sx, sy, sW, sH,     // source crop
                    0, 0, tW, tH        // destination
                );

                // 4) choose format (Force PNG for quality)
                const format = "image/png";

                // 5) export
                canvas.toBlob(
                    blobOut => {
                        if (blobOut) resolve(blobOut);
                        else reject(new Error("toBlob returned null"));
                    },
                    format,
                    0.8
                );
            };
            img.src = imageUrl;
        };
        reader.readAsDataURL(inputBlob);
    });
}

interface MediaPromptImageProps {
    imagesList: string[];
    selectedImages: string[];
    onSelect: (url: string) => void;
    darkMode: boolean;
    // Optional: Callback to notify parent about the new image
    onNewImage?: (url: string) => void;
    setGeneratedImagePrompt: any;
    generatedImagePrompt: any;
    index: any;
    ImagesHdCloud: any; // Assuming this is string[] or similar

    PostId: any;
    selectedStyle: any;
    Planx: any;
    Seed: any;
    steps: any;
    modelz: any;
    generatedImagesFlux: any;
    prompt: any;
    worldModelsInuse: any;
    setWorldModelsInuse: any


}

const MediaPromptImage: React.FC<MediaPromptImageProps> = ({
    index,
    imagesList,
    selectedImages,
    onSelect,
    darkMode,
    onNewImage,
    setGeneratedImagePrompt,
    generatedImagePrompt,
    ImagesHdCloud,

    PostId,
    selectedStyle,
    Planx,
    Seed,
    steps,
    modelz,
    generatedImagesFlux,
    prompt,
    worldModelsInuse,
    setWorldModelsInuse
}) => {


    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const [showWorldModel3, setShowWorldModel3] = useState(false);


    // 0. Get Aspect Ratio from Store
    const ratioKey = useSelector((s: any) => s.settings.aspectRatio);

    // 1. Ref for the hidden file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 2. View Toggle State (Main vs Scenes)
    const [showScenes, setShowScenes] = useState(false);

    // 3. Combine props list and PARENT state uploaded list (deduplicated)
    const displayList = useMemo(() => {
        // Safely access the uploadedImages array from the parent state at this index
        const parentUploads = generatedImagePrompt?.[index]?.uploadedImages || [];
        return Array.from(new Set([...imagesList, ...parentUploads]));
    }, [imagesList, generatedImagePrompt, index]);


    // --- S3 Helper Functions (Integrated) ---

    const GenerateSignedUrlForSingleImage = async (blob: Blob) => {
        if (!CLIK_URL) throw new Error("CLIK_URL is not defined");
        if (!blob) throw new Error("No image Blob to generate a signed URL.");

        const requestData = { values: { count: 1 } };

        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_imageStory`,
            requestData,
            { withCredentials: true }
        );

        const holder = response.data.holder;
        if (!holder || holder.length !== 1) {
            throw new Error("Invalid signed URL response.");
        }

        const signedUrls = holder[0];
        if (!signedUrls.urlHD) {
            throw new Error("Missing signed URLs for images.");
        }

        return signedUrls;
    };

    const PutSingleImageInS3WithURL = async (blob: Blob, signedUrls: any) => {
        if (!signedUrls.urlHD) {
            throw new Error("Signed URL is not available for uploading.");
        }
        if (!blob) {
            throw new Error("Image blob is not available for uploading.");
        }

        const uploadHD = await axios.put(signedUrls.urlHD, blob, {
            headers: {
                "Content-Type": blob.type || "application/octet-stream",
            },
        });

        if (uploadHD.status !== 200 && uploadHD.status !== 204) {
            throw new Error(`HD image upload failed with status ${uploadHD.status}`);
        }

        console.log("HD image uploaded successfully.");
        const uploadedHdUrl = signedUrls.urlHD.split("?")[0]; // strip query params
        return uploadedHdUrl;
    };

    // --- Selection Logic (Max 10) ---
    const handleSelection = (imgSrc: string) => {
        // Check if currently selected
        const isSelected = selectedImages.includes(imgSrc);

        if (isSelected) {
            // Always allow deselecting
            onSelect(imgSrc);
        } else {
            // Selecting new image: check limit
            if (selectedImages.length >= 10) {
                alert("Maximum of 10 reference images allowed.");
                return;
            }
            onSelect(imgSrc);
        }
    };


    const handleSelectionB = () => {
        selectedImages.forEach((src) => onSelect(src)); // deselect all
    };

    // --- Event Handlers ---

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            console.log("Starting upload for:", file.name);

            // Determine model from state or default
            const modelz = generatedImagePrompt?.[index]?.model || "Gpt Image";

            // 2) convert low-res (Preview/Thumbnail logic if needed)
            const blob = await convertToHDWebpOrJpegByDevicex(file, modelz, ratioKey);
            // create a preview URL (unused currently but logic kept)
            // const url = URL.createObjectURL(blob);

            // 3) convert high-res (This is what we upload to S3 for HD slot)
            const blobHd = await convertToHDWebpOrJpegByDeviceHdx(file, modelz, ratioKey);

            // 1) Generate Signed URL (Using blobHd to ensure it passes checks)
            const signedUrls = await GenerateSignedUrlForSingleImage(blobHd);

            // 2) Upload High-Res blob to S3
            const uploadedUrl = await PutSingleImageInS3WithURL(blobHd, signedUrls);

            // 3) Log Result
            console.log("Uploaded S3 URL:", uploadedUrl);


            Saveprompthelperfordellater(uploadedUrl);

            // 4) Add to PARENT state so it persists
            setGeneratedImagePrompt((prev: any) => {
                const newState = [...prev];
                const targetPrompt = { ...newState[index] };

                // Ensure the array exists and append new URL
                const currentUploads = targetPrompt.uploadedImages || [];
                targetPrompt.uploadedImages = [...currentUploads, uploadedUrl];

                newState[index] = targetPrompt;
                return newState;
            });

            // 5) Select the NEWLY uploaded image (ONLY IF < 10 selected)
            if (selectedImages.length < 10) {
                onSelect(uploadedUrl);
            } else {
                // Optional: Alert user that it was uploaded but not selected due to limit
                alert("Image uploaded, but not selected because you have reached the 10-image limit.");
            }

            // 6) Notify parent if prop is provided
            if (onNewImage) {
                onNewImage(uploadedUrl);
            }

        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            // Reset input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleAddClick = () => {
        fileInputRef.current?.click();
    };

    // Helper to render an image grid item
    const renderImageItem = (imgSrc: string, idx: number) => {
        const isSelected = selectedImages.includes(imgSrc);
        const selectionOrder = selectedImages.indexOf(imgSrc) + 1;

        return (
            <Grid item xs={6} sm={4} md={2.4} key={`${imgSrc}-${idx}`}>
                <Box
                    // Use new handleSelection wrapper to check limits
                    onClick={() => handleSelection(imgSrc)}
                    sx={{
                        position: "relative", aspectRatio: "9/16", borderRadius: 2, overflow: "hidden", cursor: "pointer",
                        border: isSelected ? `3px solid ${darkMode ? "#4caf50" : "#2e7d32"}` : "1px solid transparent",
                        boxShadow: isSelected ? "0 0 15px rgba(76, 175, 80, 0.6)" : "0 4px 10px rgba(0,0,0,0.3)",
                        transition: "all 0.2s ease-in-out",
                        "&:active": { transform: "scale(0.98)" },
                        "&:hover": { transform: "scale(1.02)" }
                    }}
                >
                    <img src={imgSrc} alt={`Prompt ${idx}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {isSelected && (
                        <Box sx={{ position: "absolute", top: 8, right: 8, bgcolor: "white", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                            <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                        </Box>
                    )}
                    {isSelected && selectedImages.length > 1 && (
                        <Box sx={{ position: "absolute", bottom: 8, right: 8, bgcolor: "rgba(0,0,0,0.7)", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold" }}>
                            {selectionOrder}
                        </Box>
                    )}
                </Box>
            </Grid>
        );
    };

    return (
        <>




            <WorldModel
                DirectUpload={false}
                setWorldModelsInuse={setWorldModelsInuse}
                selectedImages={selectedImages}
                handleSelection={handleSelection}


                PostId={PostId}
                selectedStyle={selectedStyle}

                Seed={Seed}
                prompt={prompt}
                GeneratedImageFirst={generatedImagesFlux ? generatedImagesFlux[0] : ''}
                mode={2}
                open={showWorldModel3}
                onClose={() => setShowWorldModel3(false)}

                // Data Props
                steps={steps}
                ImagesHdCloud={[]}
                GeneratedText={[]}
                Planx={Planx}

                // Action Props

                handleFileChange={


                    // CORRECT
                    onFileChange

                } // <--- Pass your existing file handler here

                // UI Props
                darkMode={darkModeReducer}
                matchMobile={matchMobile}
                modelz={modelz}
                GeneratedImageFlux={generatedImagesFlux} // or whatever state tracks generation
                parsedKeyPoints={steps} // or [] if not available in this scope
            />
            <Box sx={{ flex: 1, p: 2, overflowY: "auto", overflowX: "hidden" }}>
                {/* Hidden Input */}
                <input
                    ref={fileInputRef}
                    accept="image/*"
                    type="file"
                    style={{ display: "none" }}
                    onChange={onFileChange}
                />

                {/* SCENES VIEW */}
                {showScenes ? (
                    <Grid container spacing={1.5} justifyContent="flex-start">
                        {/* Back Button (Styled like other buttons) */}
                        <Grid item xs={6} sm={4} md={2.4}>
                            <Button
                                variant="outlined"
                                onClick={() => setShowScenes(false)}
                                sx={{
                                    width: "100%", aspectRatio: "9/16", borderRadius: 2, borderStyle: 'dashed',
                                    borderColor: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                    color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                    "&:active": { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                    "&:hover": { borderColor: darkMode ? '#fff' : '#000', bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                                }}
                            >
                                <ArrowBackIcon fontSize="large" />
                                <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}>Back</Typography>
                            </Button>
                        </Grid>

                        {/* Scenes List */}
                        {(() => {
                            // Deduplicate and combine initial generations + recreations
                            const combinedScenes = Array.from(new Set([...imagesList, ...(ImagesHdCloud || [])]));

                            return combinedScenes.length > 0 ? (
                                combinedScenes.map((imgSrc: string, idx: number) => renderImageItem(imgSrc, idx))
                            ) : (
                                <Grid item xs={12}>
                                    <Typography sx={{ p: 2, opacity: 0.7 }}>No scenes available.</Typography>
                                </Grid>
                            );
                        })()}
                    </Grid>
                ) : (
                    /* MAIN UPLOAD VIEW */
                    <Grid container spacing={1.5} justifyContent="flex-start">

                        {/* Upload Button */}
                        <Grid item xs={6} sm={4} md={2.4}>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setShowWorldModel3(true);
                                }}
                                sx={{
                                    width: "100%", aspectRatio: "9/16", borderRadius: 2, borderStyle: 'dashed',
                                    borderColor: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                    color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                    "&:active": { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                    "&:hover": { borderColor: darkMode ? '#fff' : '#000', bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                                }}
                            >
                                {worldModelsInuse ? (
                                    <CheckCircleIcon
                                        sx={{
                                            fontSize: '6rem', // Approx 3x bigger than fontSize="large"
                                            color: darkModeReducer ? 'yellow' : 'red'
                                        }}
                                    />
                                ) : (
                                    <AssignmentIndIcon
                                        fontSize="large"
                                        style={{ color: darkModeReducer ? 'yellow' : 'red' }}
                                    />
                                )}

                                <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}>
                                    {worldModelsInuse ? "IN USE" : "Add Prompt Image"}
                                </Typography>
                            </Button>
                        </Grid>

                        {/* Scenes Button */}

                        {
                            <Grid item xs={6} sm={4} md={2.4}>
                                <Button
                                    variant="outlined"
                                    onClick={() => handleSelectionB()}
                                    sx={{
                                        width: "100%", aspectRatio: "9/16", borderRadius: 2, borderStyle: 'dashed',
                                        borderColor: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                        color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                        "&:active": { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                        "&:hover": { borderColor: darkMode ? '#fff' : '#000', bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                                    }}
                                >
                                    <CollectionsIcon fontSize="large" />
                                    <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}> Clear all</Typography>
                                </Button>
                            </Grid>

                        }


                        {ImagesHdCloud.length > 0 ?
                            <Grid item xs={6} sm={4} md={2.4}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setShowScenes(true)}
                                    sx={{
                                        width: "100%", aspectRatio: "9/16", borderRadius: 2, borderStyle: 'dashed',
                                        borderColor: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                        color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                        "&:active": { bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                        "&:hover": { borderColor: darkMode ? '#fff' : '#000', bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                                    }}
                                >
                                    <CollectionsIcon fontSize="large" />
                                    <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}> Created Scenes</Typography>
                                </Button>
                            </Grid>

                            : null}
                        {/* Images List (Uses the combined displayList) */}
                        {displayList.map((imgSrc, idx) => renderImageItem(imgSrc, idx))}
                    </Grid>
                )}



            </Box>

        </>

    );
};

export default MediaPromptImage;
