import React, { useState, useMemo } from "react";
import { Box, Button, Stack, Typography, TextField, Backdrop, Fade, Divider, CircularProgress } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // Added for error state
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // Added for success state
import WorldCreationEdits from "./WorldCreationEdits";
import axios from "axios";

import { useSelector, } from "react-redux";

import { RootState } from "./store";



interface WorldCreationProps {
    matchMobile: boolean;
    darkMode: boolean;
    PRIMARY_COLOR: string;
    Planx: any;
    GeneratedText: string[];
    steps: string[];
    GeneratedImageFirst?: string;
    prompt?: any;
    open: any;
    ImagesHdCloud: any;
    modelz: any;
    Seed: any;
    PostId: any;
    selectedStyle: any
    setCreationDone: any;
    onClose: any;
    Vipcharacters?: any[];
    referenceImages?: any[];
}

const WorldCreation: React.FC<WorldCreationProps> = ({
    matchMobile,
    darkMode,
    PRIMARY_COLOR,
    Planx,
    GeneratedText,
    steps,
    GeneratedImageFirst,
    prompt,
    open,
    ImagesHdCloud,
    modelz,
    Seed,
    PostId,
    selectedStyle,
    setCreationDone,
    onClose,
    Vipcharacters,
    referenceImages
}) => {
    // --- Local State ---
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [editField, setEditField] = useState<"title" | "description" | null>(null);
    const [tempValue, setTempValue] = useState("");

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    // 1. Remix Data
    const [remixPlan, setRemixPlan] = useState<any>(null);
    const [isLoadingRemix, setIsLoadingRemix] = useState(false);

    // 2. Upload / Create Status State
    // 'idle' = normal, 'loading' = spinner, 'error' = red, 'success' = green
    const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
    const [statusText, setStatusText] = useState("");

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // --- Helpers ---
    const openEditPopup = (field: "title" | "description") => {
        setEditField(field);
        setTempValue(field === "title" ? title : description);
    };

    const submitEditPopup = () => {
        if (editField === "title") setTitle(tempValue);
        if (editField === "description") setDescription(tempValue);
        setEditField(null);
    };

    const promptText = useMemo(() => {
        if (prompt) return prompt;
        return "Auto-filled Prompt Placeholder...";
    }, [prompt]);

    const planText = useMemo(() => {
        if (Planx?.plan) return String(Planx.plan);
        if (Array.isArray(Planx)) return Planx.join("\n");
        if (typeof Planx === "object" && Planx) return JSON.stringify(Planx, null, 2);
        return "Auto-filled Plan Placeholder...";
    }, [Planx]);

    // --- API: Generate Remix Plan ---
    // --- API: Generate Remix Plan ---
    const generateRemixPlan = async () => {
        if (!Planx || !steps || steps.length === 0) return;
        setIsLoadingRemix(true);
        try {
            const payload = {
                originalPrompt: prompt,
                rawPlan: Planx,
                sceneSteps: steps
            };
            const response: any = await axios.post(`${CLIK_URL}/generate-world-remix`, payload);
            console.log("GPT Remix Plan:", response.data);

            // 1. Set the full plan data
            setRemixPlan(response.data);

            // 2. AUTO-POPULATE Title & Description State
            // This ensures the editable fields update immediately with the AI results
            if (response.data.title) setTitle(response.data.title);
            if (response.data.description) setDescription(response.data.description);

        } catch (error) {
            console.error("Error generating world remix plan:", error);
        } finally {
            setIsLoadingRemix(false);
        }
    };

    // --- HELPER: Upload Base64 to S3 ---
    const uploadImageToS3 = async (base64Data: string) => {
        const fetchRes = await fetch(base64Data);
        const blob = await fetchRes.blob();

        const signRes: any = await axios.post(`${CLIK_URL}/get_signed_url_imageStory`, { values: { count: 1 } }, { withCredentials: true });
        const signedUrl = signRes.data.holder[0].urlHD;

        await axios.put(signedUrl, blob, {
            headers: { "Content-Type": blob.type || "application/octet-stream" },
        });

        return signedUrl.split("?")[0];
    };
    // --- HELPER: Universal Upload (Handles Base64 AND S3 URLs) ---
    const processAndUploadToS3 = async (inputSource: string) => {
        // 1. Retrieve the Blob
        // We add { mode: 'cors' } so the browser can download the image from S3
        // without getting blocked by security policies.
        const fetchRes = await fetch(inputSource, { mode: 'cors' });

        if (!fetchRes.ok) throw new Error("Failed to fetch source image");

        const blob = await fetchRes.blob();

        // 2. Get Signed URL
        const signRes: any = await axios.post(`${CLIK_URL}/get_signed_url_imageStory`, { values: { count: 1 } }, { withCredentials: true });
        const signedUrl = signRes.data.holder[0].urlHD;

        // 3. Upload Blob to new location
        await axios.put(signedUrl, blob, {
            headers: { "Content-Type": blob.type || "application/octet-stream" },
        });

        return signedUrl.split("?")[0];
    };

    // --- HELPER: Dummy DB Call ---
    // --- HELPER: Save to Backend ---
    // --- HELPER: Save to Backend ---
    const saveToBackend = async (finalData: any) => {
        console.log("Submitting Final World Data to DB:", finalData);

        // 1. Create the World Model
        // setStatusText("Saving World Model...");

        const worldPayload = {
            PostId: PostId,
            selectedStyle: selectedStyle,
            title: finalData.title,
            description: finalData.description,
            blueprint: finalData.planSummary,
            originalPrompt: finalData.originalPrompt,
            planx: finalData.rawPlan,
            cover: finalData.newCoverOverride,
            userid: loggedUser ? loggedUser.id : 0,
        };

        // Wait for World creation
        const worldResponse: any = await axios.post(`${CLIK_URL}/create_world_model`, worldPayload);

        // Handle varying ID response keys (id vs insertId)
        const newWorldId = worldResponse.data.id || worldResponse.data.insertId;

        if (!newWorldId) throw new Error("Database failed to return a World ID");

        // 2. Loop to Create Characters using the new World ID
        const chars = finalData.characters;

        // We use a for...of loop with await to ensure robustness.
        // The function effectively "pauses" at each await, ensuring we don't proceed
        // until the database confirms the save.
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];

            // setStatusText(`Saving Char ${i + 1}/${chars.length}...`);

            await axios.post(`${CLIK_URL}/create_character`, {
                world_id: newWorldId,
                name: char.name,
                description: char.description,
                image: char.imageUrl
            });
        }

        // 3. Mark as Done alert
        // Because of the 'await' keywords above, this line will ONLY run
        // once the world AND all characters are successfully saved.
        setCreationDone(true);
        /// onClose();

        return { success: true, worldId: newWorldId };
    };

    // --- HELPER: Display Error on Button ---
    const triggerButtonError = (msg: string) => {
        setButtonState('error');
        setStatusText(msg);
        // Reset to idle after 3 seconds so user can try again
        setTimeout(() => {
            setButtonState('idle');
            setStatusText("");
        }, 3000);
    };

    // --- MAIN ACTION: Handle Create World ---
    // --- MAIN ACTION: Handle Create World ---
    // --- MAIN ACTION: Handle Create World ---
    const handleCreateWorld = async () => {
        if (!remixPlan) return;

        // --- STEP 1: VALIDATION ---
        if (!title || title.trim() === "") {
            triggerButtonError("Missing World Title");
            return;
        }

        const characters = remixPlan.Characters || [];
        const currentImages = remixPlan.CharacterImages || [];

        if (characters.length === 0) {
            triggerButtonError("No Characters Found");
            return;
        }

        let missingImageCount = 0;
        for (let i = 0; i < characters.length; i++) {
            const img = currentImages[i];
            if (!img || img.trim() === "") {
                missingImageCount++;
            }
        }

        if (missingImageCount > 0) {
            triggerButtonError(`${missingImageCount} Images Missing`);
            return;
        }

        // --- STEP 2: START PROCESS ---
        setButtonState('loading');
        setStatusText("Preparing assets...");

        try {
            // ---------------------------------------------------------
            // 2A. PROCESS COVER IMAGE (CRITICAL STEP)
            // ---------------------------------------------------------
            let finalCoverUrl = ImagesHdCloud && ImagesHdCloud[0] ? ImagesHdCloud[0] : null;

            if (finalCoverUrl) {
                setStatusText("Securing Cover...");
                try {
                    // Re-upload to create a fresh independent copy
                    finalCoverUrl = await processAndUploadToS3(finalCoverUrl);
                } catch (err) {
                    console.error("CRITICAL: Failed to re-upload cover image", err);
                    triggerButtonError("Cover Error");
                    return; // <--- STOPS PROCESS IMMEDIATELY IF COVER FAILS
                }
            } else {
                // If there is no cover at all, strictly speaking we should probably stop too?
                // Depending on your logic. For now, we assume if it's null it's fine or caught elsewhere.
            }

            // ---------------------------------------------------------
            // 2B. PROCESS CHARACTER IMAGES
            // ---------------------------------------------------------
            const processedImages = [...currentImages];

            // Parallel Upload for Speed (Recommended optimization)
            const imageUploadPromises = processedImages.map(async (img: any, i: number) => {
                if (img && typeof img === 'string' && img.startsWith("data:")) {
                    setStatusText("Uploading Assets..."); // General loading text
                    try {
                        return await processAndUploadToS3(img);
                    } catch (err) {
                        console.error(`Failed to upload image index ${i}`, err);
                        throw new Error("Upload Failed");
                    }
                }
                return img; // Return as-is if it's already a URL
            });

            // Wait for all characters. If one fails, the catch block below handles it.
            const finalCharacterImages = await Promise.all(imageUploadPromises);

            // --- STEP 3: CONSTRUCT FINAL DATA ---
            setStatusText("Finalizing...");
            const finalClassState = {
                title: title,
                description: description || "No description provided.",
                originalPrompt: promptText,
                planSummary: remixPlan["Plan Summary"],
                characters: characters.map((char: any, idx: number) => ({
                    ...char,
                    imageUrl: finalCharacterImages[idx] || null
                })),
                rawPlan: Planx,
                coverUrl: finalCoverUrl // The new safe cover URL
            };

            // --- STEP 4: CALL DB ---
            await saveToBackend({
                ...finalClassState,
                newCoverOverride: finalCoverUrl
            });

            setButtonState('success');
            setStatusText("Success!");

            setTimeout(() => {
                setButtonState('idle');
                setStatusText("");
            }, 1500);

        } catch (error: any) {
            console.error("Create World Error:", error);
            // If the error came from the character upload promise, it ends up here
            triggerButtonError(error.message || "System Error");
        }
    };

    const hasData = remixPlan && remixPlan.Characters && remixPlan.Characters.length > 0;

    // --- Dynamic Button Icon ---
    const getButtonIcon = () => {
        if (buttonState === 'loading') return <CircularProgress size={20} color="inherit" />;
        if (buttonState === 'error') return <ErrorOutlineIcon />;
        if (buttonState === 'success') return <CheckCircleOutlineIcon />;
        return <CloudUploadIcon />;
    };

    // --- Dynamic Button Color ---
    const getButtonColor = () => {
        if (buttonState === 'error') return "#d32f2f"; // Red
        if (buttonState === 'success') return "#2e7d32"; // Green
        return PRIMARY_COLOR; // Default
    };

    return (
        <>
            <Box
                sx={{
                    width: "100%",
                    height: matchMobile ? "auto" : "100%",
                    display: "flex",
                    flexDirection: matchMobile ? "column" : "row",
                    gap: 4,
                    overflow: matchMobile ? "visible" : "hidden"
                }}
            >
                {/* LEFT COLUMN (PC ONLY) */}
                <Box sx={{
                    display: matchMobile ? 'none' : 'flex',
                    flex: "0 0 35%",
                    flexDirection: "column",
                    gap: 2,
                    height: "100%",
                    overflowY: "auto",
                    overflowX: "hidden",
                    pr: 1
                }}>
                    <Stack spacing={2}>
                        <Button
                            fullWidth
                            onClick={() => openEditPopup("title")}
                            sx={{ justifyContent: "flex-start", textAlign: "left", borderRadius: 3, border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`, p: 2, color: darkMode ? "#fff" : "#000", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                        >
                            <Stack sx={{ minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 900, letterSpacing: 1 }}>WORLD TITLE</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "1rem", opacity: title ? 1 : 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || "Click to add Title..."}</Typography>
                            </Stack>
                            <EditIcon sx={{ ml: "auto", opacity: 0.55 }} />
                        </Button>

                        <Button
                            fullWidth
                            onClick={() => openEditPopup("description")}
                            sx={{ justifyContent: "flex-start", textAlign: "left", borderRadius: 3, border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`, p: 2, color: darkMode ? "#fff" : "#000", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                        >
                            <Stack sx={{ minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 900, letterSpacing: 1 }}>DESCRIPTION</Typography>
                                <Typography variant="body2" sx={{ opacity: description ? 1 : 0.55, fontStyle: description ? "normal" : "italic", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: "0.9rem" }}>{description || "Click to add Description..."}</Typography>
                            </Stack>
                            <EditIcon sx={{ ml: "auto", opacity: 0.55 }} />
                        </Button>
                    </Stack>

                    {GeneratedImageFirst && (
                        <Box sx={{ width: "100%", height: { xs: "45vh", md: "47vh" }, minHeight: { xs: "45vh", md: "47vh" }, borderRadius: 3, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: darkMode ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)" }}>
                            <Box component="img" src={GeneratedImageFirst} alt="World Preview" sx={{ width: "100%", height: "100%", display: "block", objectFit: "contain", objectPosition: "center" }} />
                        </Box>
                    )}
                </Box>

                <Divider orientation="vertical" flexItem sx={{ opacity: darkMode ? 0.12 : 0.2, display: matchMobile ? 'none' : 'block' }} />

                {/* RIGHT COLUMN */}
                <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, height: matchMobile ? "auto" : "100%", overflowY: matchMobile ? "visible" : "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 2, pr: 1 }}>
                    {/* MOBILE DUPLICATES START */}
                    <Stack spacing={2} sx={{ display: matchMobile ? 'flex' : 'none' }}>
                        <Button fullWidth onClick={() => openEditPopup("title")} sx={{ justifyContent: "flex-start", textAlign: "left", borderRadius: 3, border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`, p: 1.5, color: darkMode ? "#fff" : "#000", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
                            <Stack sx={{ minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 900, letterSpacing: 1 }}>WORLD TITLE</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 700, fontSize: "0.95rem", opacity: title ? 1 : 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || "Click to add Title..."}</Typography>
                            </Stack>
                            <EditIcon sx={{ ml: "auto", opacity: 0.55 }} />
                        </Button>
                        <Button fullWidth onClick={() => openEditPopup("description")} sx={{ justifyContent: "flex-start", textAlign: "left", borderRadius: 3, border: `1px dashed ${darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}`, p: 1.5, color: darkMode ? "#fff" : "#000", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
                            <Stack sx={{ minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: PRIMARY_COLOR, fontWeight: 900, letterSpacing: 1 }}>DESCRIPTION</Typography>
                                <Typography variant="body2" sx={{ opacity: description ? 1 : 0.55, fontStyle: description ? "normal" : "italic", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: "0.85rem" }}>{description || "Click to add Description..."}</Typography>
                            </Stack>
                            <EditIcon sx={{ ml: "auto", opacity: 0.55 }} />
                        </Button>
                        <Divider sx={{ opacity: darkMode ? 0.12 : 0.2 }} />
                        {GeneratedImageFirst && (
                            <Box sx={{ width: "100%", height: { xs: "45vh", md: "47vh" }, minHeight: { xs: "45vh", md: "47vh" }, borderRadius: 3, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: darkMode ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)" }}>
                                <Box component="img" src={GeneratedImageFirst} alt="World Preview" sx={{ width: "100%", height: "100%", display: "block", objectFit: "contain", objectPosition: "center" }} />
                            </Box>
                        )}
                    </Stack>
                    {/* MOBILE DUPLICATES END */}

                    {hasData ? (
                        <WorldCreationEdits

                            onClose={onClose}
                            Seed={Seed}
                            modelz={modelz}
                            ImagesHdCloud={ImagesHdCloud}
                            Planx={Planx}
                            promptText={promptText}
                            planText={planText}
                            darkMode={darkMode}
                            matchMobile={matchMobile}
                            GeneratedImageFirst={GeneratedImageFirst}
                            PRIMARY_COLOR={PRIMARY_COLOR}
                            remixPlan={remixPlan}
                            setRemixPlan={setRemixPlan}
                            Vipcharacters={Vipcharacters}
                            referenceImages={referenceImages}
                        />
                    ) : (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', flexDirection: 'column', gap: 2 }}>
                            {isLoadingRemix ? (
                                <>
                                    <CircularProgress size={40} sx={{ color: PRIMARY_COLOR }} />
                                    <Typography variant="body2" sx={{ opacity: 0.7, color: darkMode ? '#fff' : '#000' }}>
                                        Generating World Blueprint...
                                    </Typography>
                                </>
                            ) : (
                                <Button
                                    variant="outlined"
                                    onClick={generateRemixPlan}
                                    startIcon={<AutoFixHighIcon />}
                                    sx={{
                                        borderColor: PRIMARY_COLOR, color: PRIMARY_COLOR, fontWeight: 900, px: 4, py: 1.5, borderRadius: 4,
                                        "&:hover": { borderColor: PRIMARY_COLOR, background: darkMode ? "rgba(232,186,250,0.1)" : "rgba(0,153,204,0.1)" }
                                    }}
                                >
                                    Generate World Blueprint
                                </Button>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* --- CREATE BUTTON (Sticky Bottom) --- */}
            <Box sx={{
                position: "fixed",
                bottom: matchMobile ? '-10vh' : '3vh',
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                width: matchMobile ? "90%" : "400px"
            }}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleCreateWorld}
                    disabled={!hasData || buttonState === 'loading'}
                    startIcon={getButtonIcon()}
                    sx={{
                        borderRadius: "50px",
                        py: 1.8,
                        fontSize: "1.1rem",
                        fontWeight: 900,
                        textTransform: "none",
                        bgcolor: getButtonColor(),
                        color: darkMode ? "#000" : "#FFF",
                        boxShadow: `0 8px 30px ${buttonState === 'error' ? 'rgba(211, 47, 47, 0.4)' : buttonState === 'success' ? 'rgba(46, 125, 50, 0.4)' : darkMode ? "rgba(232, 186, 250, 0.3)" : "rgba(0, 153, 204, 0.4)"}`,
                        "&:hover": {
                            bgcolor: getButtonColor(),
                            filter: "brightness(1.1)",
                            transform: "scale(1.02)"
                        },
                        "&:disabled": {
                            bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                            color: "rgba(255,255,255,0.3)",
                            boxShadow: "none"
                        },
                        transition: "all 0.3s ease"
                    }}
                >
                    {statusText || "Create World"}
                </Button>
            </Box>

            {/* --- POPUP --- */}
            <Backdrop sx={{ zIndex: 10000, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} open={!!editField} onClick={() => setEditField(null)}>
                <Fade in={!!editField}>
                    <Box onClick={(e) => e.stopPropagation()} sx={{ width: matchMobile ? "92%" : "560px", maxWidth: "92vw", bgcolor: darkMode ? "#1e1e1e" : "#fff", borderRadius: 4, p: matchMobile ? 2 : 3, boxShadow: 24, display: "flex", flexDirection: "column", gap: 2 }}>
                        <Typography variant={matchMobile ? "subtitle1" : "h6"} sx={{ color: darkMode ? "#fff" : "#000", fontWeight: 900 }}>
                            {editField === "title" ? "Edit Title" : "Edit Description"}
                        </Typography>
                        <TextField fullWidth multiline={editField === "description"} minRows={editField === "description" ? (matchMobile ? 5 : 6) : 2} value={tempValue} onChange={(e) => setTempValue(e.target.value)} autoFocus variant="outlined" placeholder={editField === "title" ? "Enter world title..." : "Enter description..."} sx={{ "& .MuiInputBase-root": { color: darkMode ? "#fff" : "#000" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" } }} />
                        <Stack direction="row" spacing={2} justifyContent="flex-end">
                            <Button onClick={() => setEditField(null)} color="inherit">Cancel</Button>
                            <Button variant="contained" onClick={submitEditPopup} startIcon={<CheckIcon />} sx={{ bgcolor: PRIMARY_COLOR, color: darkMode ? "#000" : "#000", fontWeight: 900, borderRadius: 3, px: 2.5, py: 1.1 }}>Submit</Button>
                        </Stack>
                    </Box>
                </Fade>
            </Backdrop>
        </>
    );
};

export default WorldCreation;
