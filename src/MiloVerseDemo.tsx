import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Collapse,
    IconButton
} from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { RootState } from "./store";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const MiloVerseDemo: React.FC = () => {
    const navigate = useNavigate();
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const [storyIdea, setStoryIdea] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [videoModel, setVideoModel] = useState<"seedance" | "hailuo">("seedance");
    const [activeActionData, setActiveActionData] = useState<string>("");

    // Pipeline states
    const [characters, setCharacters] = useState<any[]>([]);
    const [imagePlan, setImagePlan] = useState<any>(null);
    const [conceptEnvImage, setConceptEnvImage] = useState<string>("");
    const [conceptCharImages, setConceptCharImages] = useState<string[]>([]);
    const [scenes, setScenes] = useState<string[]>([]);
    const [imagePrompts, setImagePrompts] = useState<string[]>([]);
    const [baseImages, setBaseImages] = useState<string[]>([]);
    const [videoPlan, setVideoPlan] = useState<any[]>([]);
    const [motionPrompts, setMotionPrompts] = useState<string[]>([]);
    const [finalVideos, setFinalVideos] = useState<string[]>([]);

    const [activeStep, setActiveStep] = useState(0);
    const [logMessages, setLogMessages] = useState<string[]>([]);
    const [isBoxOpen, setIsBoxOpen] = useState(true);

    const [timerStart, setTimerStart] = useState<number | null>(null);
    const [timerEnd, setTimerEnd] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => {
        let interval: any;
        if (timerStart && !timerEnd) {
            interval = setInterval(() => setNow(Date.now()), 1000);
        }
        return () => clearInterval(interval);
    }, [timerStart, timerEnd]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const addLog = (msg: string) => {
        setLogMessages(prev => [...prev, msg]);
    };

    const handleRunPipeline = async () => {
        if (!storyIdea.trim()) return;
        setIsProcessing(true);
        setActiveStep(0);
        setTimerStart(null);
        setTimerEnd(null);
        setCharacters([]);
        setImagePlan(null);
        setConceptEnvImage("");
        setConceptCharImages([]);
        setScenes([]);
        setImagePrompts([]);
        setBaseImages([]);
        setVideoPlan([]);
        setMotionPrompts([]);
        setFinalVideos([]);
        setLogMessages([]);
        setIsBoxOpen(true);

        try {
            // STEP 1: Character Creation
            addLog("Step 1/9: Generating Character Profiles...");
            setActiveStep(1);
            const charRes = await axios.post<any>(`${CLIK_URL}/startMiloCharacters`, { story: storyIdea });
            const charData = charRes.data.data.characters || [];
            if (!charData || charData.length === 0) throw new Error("No characters generated.");
            setCharacters(charData);
            addLog(`Created ${charData.length} character(s).`);

            // STEP 2: Image Plan
            addLog("Step 2/9: Generating Global Image Plan...");
            setActiveStep(2);
            const ipRes = await axios.post<any>(`${CLIK_URL}/startMiloImagePlan`, {
                story: storyIdea,
                characters: charData
            });
            const ipData = ipRes.data.data.imagePlan;
            setImagePlan(ipData);
            addLog("Global aesthetic defined.");

            // STEP 3: Concept Art Generation
            addLog("Step 3/9: Generating Concept Art...");
            setActiveStep(3);

            setActiveActionData(`CURRENT ACTION: Generating Environment Concept\n\nPrompt:\n${ipData.aesthetic}`);
            const envRes = await axios.post<any>(`${CLIK_URL}/Imagen`, {
                inputs: `${ipData.aesthetic}. Wide establishing shot. Clean, empty environment showcasing the global aesthetic.`,
                ty: 3, // 16:9 Landscape
                outputFormat: "jpg"
            });
            let generatedEnv = "";
            if (envRes.data.imageBase64) {
                 generatedEnv = envRes.data.imageBase64;
            } else if (envRes.data.images && envRes.data.images.length > 0) {
                 generatedEnv = envRes.data.images[0].url;
            }
            setConceptEnvImage(generatedEnv);

            const generatedCharArt: string[] = [];
            for (let i = 0; i < charData.length; i++) {
                const charObj = charData[i];
                const cPrompt = `${ipData.aesthetic}. Character portrait of ${charObj.name}. ${charObj.description}. Blank neutral background.`;
                setActiveActionData(`CURRENT ACTION: Generating Character Concept for ${charObj.name}\n\nPrompt:\n${cPrompt}`);
                const charArtRes = await axios.post<any>(`${CLIK_URL}/Imagen`, {
                    inputs: cPrompt,
                    ty: 1, // 9:16 Portrait
                    outputFormat: "jpg"
                });

                let b64 = "";
                if (charArtRes.data.imageBase64) {
                     b64 = charArtRes.data.imageBase64;
                } else if (charArtRes.data.images && charArtRes.data.images.length > 0) {
                     b64 = charArtRes.data.images[0].url;
                }
                generatedCharArt.push(b64);
                setConceptCharImages([...generatedCharArt]); // Update UI sequentially
            }
            addLog(`Generated Environment and ${generatedCharArt.length} Character Concept arts.`);

            const conceptReferences = [generatedEnv, ...generatedCharArt].filter(Boolean);

            setTimerStart(Date.now());

            // STEP 4: Scene Extraction
            addLog("Step 4/9: Extracting Scenes...");
            setActiveStep(4);
            const scenesRes = await axios.post<any>(`${CLIK_URL}/startMiloScenes`, { story: storyIdea });
            const scenesData = scenesRes.data.data.scenes || [];
            setScenes(scenesData);
            addLog(`Extracted ${scenesData.length} action beats.`);

            // STEP 5: Base Images (Full Parallel Generation)
            addLog("Step 5/9: Generating Base Images in parallel...");
            setActiveStep(5);
            setActiveActionData(`CURRENT ACTION: Generating All Base Images concurrently...\n\nConcept References Used: ${conceptReferences.length}`);

            const imagePromises = scenesData.map(async (scene: any, index: number) => {
                const sprompt = `${ipData.aesthetic}. Scene: ${scene}. Characters: ${JSON.stringify(charData)}`;
                try {
                    const imgRes = await axios.post<any>(`${CLIK_URL}/Bannana`, {
                        inputs: sprompt,
                        sampleImages: conceptReferences.length > 0 ? conceptReferences : undefined,
                        ty: 3, // 16:9 Landscape
                        outputFormat: "jpg"
                    });

                    let b64 = "";
                    if (imgRes.data.imageBase64) {
                        b64 = imgRes.data.imageBase64;
                    } else if (imgRes.data.images && imgRes.data.images.length > 0) {
                        b64 = imgRes.data.images[0].url;
                    }
                    return { index, b64, prompt: sprompt };
                } catch (err: any) {
                    addLog(`Error generating image for scene ${index + 1}: ${err.message}`);
                    return { index, b64: "", prompt: sprompt };
                }
            });

            const imageResults = await Promise.all(imagePromises);
            const finalGeneratedImages = new Array(scenesData.length).fill("");
            const finalImagePrompts = new Array(scenesData.length).fill("");

            imageResults.forEach(res => {
                if (res.b64) {
                    finalGeneratedImages[res.index] = res.b64;
                    finalImagePrompts[res.index] = res.prompt;
                }
            });

            setBaseImages(finalGeneratedImages.filter(Boolean));
            setImagePrompts(finalImagePrompts.filter(Boolean));
            addLog(`Generated ${finalGeneratedImages.filter(Boolean).length} base images.`);

            // STEP 6: Video Plan
            addLog("Step 6/9: Generating Video Plan...");
            setActiveStep(6);
            setActiveActionData("CURRENT ACTION: Mapping Video Plan...\n\nPlanning camera and subject movements across all scenes based on layout...");
            const vpRes = await axios.post<any>(`${CLIK_URL}/startMiloVideoPlan`, {
                story: storyIdea,
                imagePlan: ipData,
                scenes: scenesData
            });
            const vpData = vpRes.data.data.videoPlan || [];
            setVideoPlan(vpData);
            addLog("Camera and subject movements mapped.");

            // STEP 7: Motion Prompts
            addLog("Step 7/9: Writing strict Motion Prompts...");
            setActiveStep(7);
            setActiveActionData("CURRENT ACTION: Writing Motion Prompts...\n\nConverting Video Plan into strict single-action motion parameters...");
            const mpRes = await axios.post<any>(`${CLIK_URL}/startMiloMotionPrompts`, {
                videoPlan: vpData,
                scenes: scenesData
            });
            const mpData = mpRes.data.data.motionPrompts || [];
            setMotionPrompts(mpData);
            addLog("Motion prompts created.");

            // STEP 8: Final Render (Full Parallel Animation)
            addLog("Step 8/9: Animating all video clips in parallel...");
            setActiveStep(8);
            const filteredGeneratedImages = finalGeneratedImages.filter(Boolean);
            setActiveActionData(`CURRENT ACTION: Animating All ${filteredGeneratedImages.length} Scenes concurrently with ${videoModel === "seedance" ? "SeeDance Fast" : "Hailuo 2.3"}...`);

            const videoPromises = filteredGeneratedImages.map(async (imgUrl: string, index: number) => {
                const mPrompt = mpData[index] || "Subtle motion";
                const routeName = videoModel === "seedance" ? "/minimax23Routex" : "/minimax23Route";

                try {
                    const vpReq = await axios.post<any>(`${CLIK_URL}${routeName}`, {
                        prompt: mPrompt,
                        startImage: imgUrl,
                        videoLength: videoModel === "seedance" ? 5 : 6,
                        resolution: videoModel === "seedance" ? "1080p" : "768p",
                        ty: 3
                    });

                    let newVideo = "";
                    if (vpReq.data.videoBase64 || vpReq.data.videoUrl || vpReq.data.url) {
                        newVideo = vpReq.data.videoBase64 || vpReq.data.videoUrl || vpReq.data.url;
                    } else if (vpReq.data.taskId) {
                        newVideo = "POLLING_REQUIRED_" + vpReq.data.taskId;
                    }
                    return { index, url: newVideo };
                } catch (err: any) {
                    addLog(`Error animating scene ${index + 1}: ${err.message}`);
                    return { index, url: "" };
                }
            });

            const videoResults = await Promise.all(videoPromises);
            const finalVideoArray = new Array(filteredGeneratedImages.length).fill("");

            videoResults.forEach(res => {
                if (res.url) {
                    if (res.url.startsWith("POLLING_REQUIRED_")) {
                        addLog(`Task created for scene ${res.index + 1}: ${res.url.split("POLLING_REQUIRED_")[1]}. Polling required...`);
                    } else {
                        finalVideoArray[res.index] = res.url;
                    }
                }
            });

            setFinalVideos(finalVideoArray.filter(Boolean));

            addLog("Step 9/9: Success. Video scenes generated.");
            setActiveStep(9);
            setTimerEnd(Date.now());
        } catch (e: any) {
            console.error(e);
            addLog(`Error: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Box sx={{ height: "100vh", overflowY: "auto", bgcolor: darkMode ? "#111" : "#fff", color: darkMode ? "#fff" : "#000", pb: 10 }}>
            {/* Header */}
            <Box sx={{ p: 2, display: "flex", alignItems: "center", borderBottom: `1px solid ${darkMode ? "#333" : "#e0e0e0"}` }}>
                <IconButton onClick={() => navigate(-1)} sx={{ color: "inherit", mr: 2 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight="bold">Milo Verse Demo</Typography>
            </Box>

            <Box sx={{ maxWidth: 800, margin: "auto", p: { xs: 2, md: 4 } }}>

                {/* Text Input Block */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>Story Idea</Typography>
                    <TextField
                        fullWidth
                        multiline
                        minRows={4}
                        placeholder="Enter your story idea here..."
                        value={storyIdea}
                        onChange={(e) => setStoryIdea(e.target.value)}
                        disabled={isProcessing}
                        InputProps={{
                            sx: {
                                mb: 0.5,
                                "& .MuiInputBase-input": { caretColor: "auto !important" },
                                backgroundColor: "rgba(0,0,0,0.05)",
                                position: "relative",

                            }
                        }}
                        sx={{
                            backgroundColor: darkMode ? "#222" : "#f5f5f5",
                            borderRadius: 2,
                            "& fieldset": { border: "none" },
                            "& .MuiInputBase-input": {
                                color: darkMode ? "#fff" : "#000",
                                caretColor: darkMode ? "#fff" : "#000",
                            }
                        }}
                    />
                    <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
                        <select
                            value={videoModel}
                            onChange={(e) => setVideoModel(e.target.value as "seedance" | "hailuo")}
                            disabled={isProcessing}
                            style={{
                                padding: "12px",
                                borderRadius: "8px",
                                border: "none",
                                backgroundColor: darkMode ? "#333" : "#e0e0e0",
                                color: darkMode ? "#fff" : "#000",
                                fontWeight: "bold",
                                cursor: "pointer",
                                outline: "none",
                                flex: 1
                            }}
                        >
                            <option value="seedance">SeeDance Fast (Default)</option>
                            <option value="hailuo">Hailuo 2.3</option>
                        </select>
                        <Button
                            onClick={handleRunPipeline}
                            disabled={isProcessing || !storyIdea.trim()}
                            variant="contained"
                            sx={{ flex: 2, py: 1.5, fontWeight: "bold", background: "linear-gradient(90deg, #ff3b30, #ff9500)", color: "#fff" }}
                        >
                            {isProcessing ? <CircularProgress size={24} color="inherit" /> : "Generate Video"}
                        </Button>
                    </Box>
                </Box>

                {/* Expanded Progress UI */}
                {(logMessages.length > 0 || isProcessing) && (
                    <Box sx={{ mb: 4, bgcolor: darkMode ? "#1a1a1a" : "#f9f9f9", borderRadius: 2, overflow: "hidden", border: `1px solid ${darkMode ? "#333" : "#ddd"}` }}>
                        <Box
                            sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", bgcolor: darkMode ? "#222" : "#eee" }}
                            onClick={() => setIsBoxOpen(!isBoxOpen)}
                        >
                            <Typography fontWeight="bold">Pipeline Progress (Step {activeStep}/9) {timerStart && `- Time: ${formatTime((timerEnd || now) - timerStart)}`}</Typography>
                            <Typography variant="body2">{isBoxOpen ? "Collapse" : "Expand"}</Typography>
                        </Box>

                        <Collapse in={isBoxOpen}>
                            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 3 }}>

                                {/* ---------------- SECTION 1: TOP (Total Job & Progress) ---------------- */}
                                <Box sx={{ maxHeight: 175, overflowY: "auto", pr: 1 }}>
                                    <Typography variant="subtitle2" sx={{ color: "#ff9500", mb: 1, fontWeight: "bold", textTransform: "uppercase" }}>
                                        Total Job & Progress
                                    </Typography>

                                    {characters.length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="caption" fontWeight="bold" color="text.secondary">Characters Created:</Typography>
                                            {characters.map((c, i) => (
                                                <Typography key={i} variant="body2" sx={{ ml: 1 }}>â€¢ {c.name}: {c.description}</Typography>
                                            ))}
                                        </Box>
                                    )}

                                    {scenes.length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="caption" fontWeight="bold" color="text.secondary">Story Beats (Scenes):</Typography>
                                            {scenes.map((s, i) => (
                                                <Typography key={i} variant="body2" sx={{ ml: 1 }}>{i + 1}. {s}</Typography>
                                            ))}
                                        </Box>
                                    )}

                                    {/* Activity Feed Logs (4 lines max height) */}
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" fontWeight="bold" color="text.secondary">Activity Feed Logs:</Typography>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                bgcolor: darkMode ? "#000" : "#fff",
                                                border: `1px solid ${darkMode ? "#444" : "#ccc"}`,
                                                borderRadius: 1,
                                                maxHeight: "6rem",
                                                overflowY: "auto",
                                                display: "flex",
                                                flexDirection: "column-reverse"
                                            }}
                                        >
                                            <Box>
                                                {logMessages.map((msg, i) => (
                                                    <Typography key={i} variant="body2" sx={{ fontFamily: "monospace", mb: 0.5, color: msg.includes("Error") ? "red" : "inherit" }}>
                                                        {msg}
                                                    </Typography>
                                                ))}
                                                {isProcessing && (
                                                    <Typography variant="body2" sx={{ fontFamily: "monospace", mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                                                        <CircularProgress size={12} /> Processing...
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* ---------------- SECTION 2: MIDDLE (Concept & Scene Images) ---------------- */}
                                {(conceptEnvImage || conceptCharImages.length > 0 || baseImages.length > 0) && (
                                    <Box sx={{ borderTop: `1px solid ${darkMode ? "#333" : "#ddd"}`, pt: 2 }}>
                                        {/* Concept Art Sub-section */}
                                        {(conceptEnvImage || conceptCharImages.length > 0) && (
                                            <Box sx={{ mb: baseImages.length > 0 ? 3 : 0 }}>
                                                <Typography variant="subtitle2" sx={{ color: "#2196f3", mb: 1, fontWeight: "bold", textTransform: "uppercase" }}>
                                                    Concept Art (Environment & Characters)
                                                </Typography>
                                                <Box sx={{ display: "flex", gap: 3, overflowX: "auto", py: 1, scrollbarWidth: "thin" }}>
                                                    {conceptEnvImage && (
                                                        <Box sx={{ minWidth: 200, maxWidth: 200, display: "flex", flexDirection: "column", gap: 1 }}>
                                                            <Box sx={{ width: "100%", height: 112, borderRadius: 2, overflow: "hidden", border: `1px solid ${darkMode ? "#444" : "#ccc"}`, flexShrink: 0 }}>
                                                                <img src={conceptEnvImage} alt="Environment" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                            </Box>
                                                            <Typography variant="caption" align="center" fontWeight="bold">Environment</Typography>
                                                        </Box>
                                                    )}
                                                    {conceptCharImages.map((img, i) => (
                                                        <Box key={i} sx={{ minWidth: 112, maxWidth: 112, display: "flex", flexDirection: "column", gap: 1 }}>
                                                            <Box sx={{ width: "100%", height: 200, borderRadius: 2, overflow: "hidden", border: `1px solid ${darkMode ? "#444" : "#ccc"}`, flexShrink: 0 }}>
                                                                <img src={img} alt={`Character ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                            </Box>
                                                            <Typography variant="caption" align="center" fontWeight="bold">{characters[i]?.name || `Char ${i + 1}`}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Scene Images Sub-section */}
                                        {baseImages.length > 0 && (
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ color: "#4caf50", mb: 1, fontWeight: "bold", textTransform: "uppercase" }}>
                                                    Scene Images
                                                </Typography>
                                                <Box sx={{ display: "flex", gap: 3, overflowX: "auto", py: 1, scrollbarWidth: "thin" }}>
                                                    {baseImages.map((img, i) => (
                                                        <Box key={i} sx={{ minWidth: 200, maxWidth: 200, display: "flex", flexDirection: "column", gap: 1 }}>
                                                            <Box sx={{ width: "100%", height: 200, borderRadius: 2, overflow: "hidden", border: `1px solid ${darkMode ? "#444" : "#ccc"}`, flexShrink: 0 }}>
                                                                <img src={img} alt={`Scene ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* ---------------- SECTION 3: BOTTOM (Active Mode Details) ---------------- */}
                                {activeActionData && (
                                    <Box sx={{ borderTop: `1px solid ${darkMode ? "#333" : "#ddd"}`, pt: 2 }}>
                                        <Typography variant="subtitle2" sx={{ color: "#ff3b30", mb: 1, fontWeight: "bold", textTransform: "uppercase" }}>
                                            Active Mode Details
                                        </Typography>
                                        <Box sx={{
                                            p: 1.5,
                                            bgcolor: darkMode ? "#222" : "#f0f0f0",
                                            borderRadius: 1,
                                            maxHeight: 125,
                                            overflowY: "auto",
                                            border: `1px dashed ${darkMode ? "#555" : "#bbb"}`
                                        }}>
                                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", color: darkMode ? "#4caf50" : "#2e7d32" }}>
                                                {activeActionData}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}

                            </Box>
                        </Collapse>
                    </Box>
                )}

            </Box>

            {/* Final Videos Output - Full Width */}
            {finalVideos.length > 0 && (
                <Box sx={{ mt: 4, width: "100%", px: { xs: 2, md: 4 } }}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ maxWidth: 800, margin: "auto", px: { xs: 0, md: 0 } }}>Final Video Scenes</Typography>
                    <Box sx={{ display: "flex", gap: 3, overflowX: "auto", pb: 2, pt: 1, scrollbarWidth: "thin" }}>
                        {/* A spacer to help align the start of horizontal scroll slightly inward if needed, or we just let it scroll */}
                        <Box sx={{ minWidth: { xs: 0, md: 'calc((100vw - 800px) / 2)' }, flexShrink: 0 }} />
                        {finalVideos.map((url, i) => (
                            <Box key={i} sx={{ minWidth: { xs: 350, md: 600 }, maxWidth: { xs: 350, md: 600 }, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Box sx={{ width: "100%", borderRadius: 2, overflow: "hidden", bgcolor: "#000", border: `1px solid ${darkMode ? "#444" : "#ccc"}` }}>
                                    <video
                                        src={url}
                                        controls
                                        autoPlay={i === 0}
                                        style={{ width: "100%", height: "auto", display: "block", aspectRatio: "16/9", objectFit: "cover" }}
                                    />
                                </Box>
                                <Typography variant="body2" fontWeight="bold" align="center">Scene {i + 1}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {(activeStep === 8 || activeStep === 9) && finalVideos.length === 0 && !isProcessing && (
                <Box sx={{ maxWidth: 800, margin: "auto", px: { xs: 2, md: 4 } }}>
                    <Typography color="error">
                        Pipeline finished but no videos were returned. Ensure the video generation endpoint does not require async polling or check backend logs.
                    </Typography>
                </Box>
            )}

        </Box>
    );
};

export default MiloVerseDemo;
