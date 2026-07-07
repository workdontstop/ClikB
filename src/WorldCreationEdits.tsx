import React, { useState, useCallback } from "react";
import { Box, Typography, Stack, Button, Fade, CircularProgress } from "@mui/material";
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import SectionCard from "./SectionCard";
import WorldImage from "./WorldImage";

interface WorldCreationEditsProps {
    promptText: string;
    planText: string;
    darkMode: boolean;
    matchMobile: boolean;
    GeneratedImageFirst?: string;
    PRIMARY_COLOR: string;
    remixPlan?: {
        Characters: Array<{ name: string; description: string }>;
        CharacterImages?: Array<string | null>;
        "Plan Summary": string;
    };
    setRemixPlan?: any;
    Vipcharacters?: any[];
    referenceImages?: any[];
    Planx: any;
    ImagesHdCloud: any;
    modelz: any;
    Seed: any;
    onClose: any
}

const WorldCreationEdits: React.FC<WorldCreationEditsProps> = ({
    promptText,
    planText,
    darkMode,
    matchMobile,
    GeneratedImageFirst,
    PRIMARY_COLOR,
    remixPlan,
    setRemixPlan,
    Vipcharacters,
    referenceImages,
    Planx,
    ImagesHdCloud,
    modelz,
    Seed,
    onClose
}) => {
    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    // --- Redux State ---
    const ratioKey = useSelector((s: RootState) => s.settings.aspectRatio);
    // const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // --- State ---
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCharIndex, setSelectedCharIndex] = useState<number | null>(null);

    // --- Loading Array to track background generation ---
    const [loadingIndices, setLoadingIndices] = useState<number[]>([]);

    // --- Helpers ---
    const handleToggle = (label: string) => {
        setExpandedSection((prev) => (prev === label ? null : label));
    };

    const handleOpenImageModal = (index: number) => {
        setSelectedCharIndex(index);
        setIsModalOpen(true);
    };

    // --- API LOGIC ---
    const getSceneContext = (plan: any): string => {
        if (!plan) return "neutral cinematic background";
        return plan.setting || plan.location || "atmospheric background matching the world style";
    };

    const constructGptInput = (charData: any) => {
        if (!charData || !Planx) return "";
        const worldStyle = remixPlan?.["Plan Summary"] || "Cinematic, High Fidelity";
        return `
            Describe a high-fidelity visual concept art for: ${charData.name}.
            [DATA]
            Character Visuals: ${charData.description}
            Current Scene/Location: ${getSceneContext(Planx)}
            Art Style: ${worldStyle}
            [INSTRUCTIONS]
            Write a detailed image generation prompt that depicts ${charData.name} standing full-body (head to toe) in this specific scene.
            Focus on lighting, texture, and how the character integrates with the background.
        `.trim();
    };

    const triggerGeneration = async (index: number, currentDescription: string, referenceImageUrl: string | null) => {
        // 1. Add to loading array
        setLoadingIndices(prev => [...prev, index]);
        await handleSubmitFluxImageNew(referenceImageUrl, currentDescription, index);

        /**   try {
            // A. Draft Prompt
            const charData = { name: remixPlan?.Characters[index].name, description: currentDescription };
            const inputPayload = constructGptInput(charData);

            const gptRes: any = await axios.post(`${CLIK_URL}/gptWorldImage`, {
                prompt: `${charData.name} ${inputPayload}`,
                planContext: ''
            });

            const visualPrompt = gptRes.data.payload;
            if (!visualPrompt) throw new Error("Backend returned empty prompt payload.");

            // B. Generate Image (This now ONLY generates locally, no S3 upload yet)


        } catch (error: any) {
            console.error("Gen Flow Error:", error);
            alert(`Generation failed for character ${index + 1}: ${error.message}`);
            // Remove from loading array on error
            setLoadingIndices(prev => prev.filter(i => i !== index));
        } */

    };

    const handleSubmitFluxImageNew = useCallback(async (
        s3imageUrl: any,
        enhancedPrompt: any,
        index: number
    ) => {
        try {
            let base64Image = "";
            // Logic to handle Image-to-Image if a reference exists

            if (s3imageUrl && s3imageUrl.trim() !== "") {
                base64Image = s3imageUrl.trim(); // âœ… now it's a URL string
            }

            let payload: any = {
                inputs: enhancedPrompt,
                width: 1080,
                height: 1920,
                guidance: 7.5,
                num_inference_steps: 35,
                seed: Seed,
                ty: ratioKey
            };

            let url = "fluxschnell";
            // Model Selection Logic
            if (base64Image) {
                ///  alert(modelz)
                payload.sampleImage = base64Image;
                payload.sampleImages = base64Image;
                if (modelz === 'Bannana' || modelz === 'Imagen') url = 'Bannana';
                else if (modelz === 'Imagen2') {

                    url = 'Bannana2';
                }
                else if (modelz === 'minimax') url = 'minimax';
                else if (modelz === 'fluxUltra') url = 'fluxUltra';
                else if (modelz === 'Kontext') url = 'kontext';
                else if (modelz === 'fluxUltra2') {

                    url = 'fluxUltra2';
                }
                else if (modelz === 'Gpt Image') url = 'GptImage';
                else url = 'minimax';
            } else {
                if (modelz === 'Schnell') url = 'fluxschnell';
                else if (modelz === 'Hi Dream') url = 'HiDream';
                else if (modelz === 'minimax') url = 'minimax';
                else if (modelz === 'minimax2') url = 'minimax2';
                else if (modelz === 'Bannana' || modelz === 'Imagen') url = 'Imagen';
                else if (modelz === 'Imagen2') url = 'Imagen2';
                else if (modelz === 'Imagenx') url = 'Imagenx';
                else if (modelz === 'fluxUltra') url = 'fluxUltra';
                else if (modelz === 'fluxUltra2') url = 'fluxUltra2';
                else if (modelz === 'fluxDev') url = 'fluxDev';
                else if (modelz === 'seeDream') url = 'seeDream';
                else if (modelz === 'Gpt Image') url = 'GptImage';
                else url = 'fluxschnell';
            }

            const response: any = await axios.post(`${CLIK_URL}/${url}`, payload);
            if (response.status !== 200) throw new Error(`Gen route error: ${response.status}`);

            // --- MODIFIED: NO S3 UPLOAD HERE ---
            // Just get the Base64 and save it to state locally
            const { imageBase64 } = response.data;

            setRemixPlan((prevPlan: any) => {
                const currentImages = prevPlan.CharacterImages ? [...prevPlan.CharacterImages] : [];
                // Store the raw Base64 data url. S3 upload happens in the parent component on "Create World"
                currentImages[index] = imageBase64;
                return { ...prevPlan, CharacterImages: currentImages };
            });

        } catch (err: any) {
            throw err;
        } finally {
            setLoadingIndices(prev => prev.filter(i => i !== index));
        }
    }, [modelz, Seed, ratioKey, CLIK_URL, setRemixPlan]);



    return (
        <>
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    height: matchMobile ? "auto" : "100%",
                    overflowY: matchMobile ? "visible" : "auto",
                    overflowX: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    pr: 1,
                }}
            >
                {remixPlan && remixPlan["Plan Summary"] && (
                    <SectionCard
                        label="BluePrint"
                        value={remixPlan["Plan Summary"]}
                        placeholder="World Summary..."
                        expandedSection={expandedSection}
                        loadingIndices={loadingIndices}
                        handleToggle={handleToggle}
                        handleOpenImageModal={handleOpenImageModal}
                        matchMobile={matchMobile}
                        darkMode={darkMode}
                        PRIMARY_COLOR={PRIMARY_COLOR}
                    />
                )}

                {remixPlan && remixPlan.Characters && (
                    <Stack direction="column" spacing={2} sx={{ minWidth: 0 }}>
                        {remixPlan.Characters.map((char, index) => (
                            <SectionCard
                                key={index}
                                label={char.name || `Character ${index + 1}`}
                                value={char.description}
                                placeholder="Character description..."
                                isCharacter={true}
                                charIndex={index}
                                charImage={remixPlan.CharacterImages ? remixPlan.CharacterImages[index] : null}
                                expandedSection={expandedSection}
                                loadingIndices={loadingIndices}
                                handleToggle={handleToggle}
                                handleOpenImageModal={handleOpenImageModal}
                                matchMobile={matchMobile}
                                darkMode={darkMode}
                                PRIMARY_COLOR={PRIMARY_COLOR}
                            />
                        ))}
                    </Stack>
                )}

                <SectionCard
                    label="Original Prompt"
                    value={promptText}
                    expandedSection={expandedSection}
                    loadingIndices={loadingIndices}
                    handleToggle={handleToggle}
                    handleOpenImageModal={handleOpenImageModal}
                    matchMobile={matchMobile}
                    darkMode={darkMode}
                    PRIMARY_COLOR={PRIMARY_COLOR}
                />

                <Box sx={{ height: 80, flexShrink: 0 }} />
            </Box>


            {/* --- WORLD IMAGE MODAL --- */}
            {selectedCharIndex !== null && remixPlan?.Characters[selectedCharIndex] && (
                <WorldImage
                    onClosex={onClose}
                    open={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    darkMode={darkMode}
                    PRIMARY_COLOR={PRIMARY_COLOR}
                    charIndex={selectedCharIndex}
                    characterData={remixPlan.Characters[selectedCharIndex]}
                    remixPlan={remixPlan}
                    setRemixPlan={setRemixPlan}
                    Planx={Planx}
                    ImagesHdCloud={ImagesHdCloud}
                    Vipcharacters={Vipcharacters}
                    referenceImages={referenceImages}
                    Seed={Seed}
                    modelz={modelz}
                    // Pass the background loading state
                    isGeneratingParent={loadingIndices.includes(selectedCharIndex)}
                    // Pass the trigger function
                    onGenerateTrigger={triggerGeneration}
                />
            )}
        </>
    );
};

export default WorldCreationEdits;
