import React, { useRef, useEffect, useState, useCallback } from "react";
import { IconButton, Typography, Button, Menu, MenuItem } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import GridViewIcon from "@mui/icons-material/GridView";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import AudioPicker2 from "./AudioPicker2";
import SuperstarzIconLight from "./s.png";
import SuperstarzIconDark from "./s2.png";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;

interface MirrorViewProps {
    images: string[];
    nanoImages?: string[];
    loadersArray?: number[];
    totalExpected: number;
    darkMode: boolean;
    onClose: () => void;
    onSwitchToCreateMode?: () => void;
    parsedKeyPoints?: string[];
    parsedKeyPoints2?: string[];
    prompt?: string;
    matchMobile?: boolean;
    type?: number;
    loggedUser?: any;
    ratioKey?: number;
}

type ViewMode = "generating" | "watch";

const MirrorView: React.FC<MirrorViewProps> = ({
    images,
    nanoImages,
    loadersArray,
    totalExpected,
    darkMode,
    onClose,
    onSwitchToCreateMode,
    parsedKeyPoints = [],
    parsedKeyPoints2 = [],
    prompt = "",
    matchMobile = false,
    type = 1,
    loggedUser,
    ratioKey = 1,
}) => {
    const sliderRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showGrid, setShowGrid] = useState(false); // Grid View State
    const [isTitleExpanded, setIsTitleExpanded] = useState(false); // New: Expandable Title State
    const [showControls, setShowControls] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false); // Can be toggled on entry
    const [isMuted, setIsMuted] = useState(true);      // Default Muted
    const [currentIndex, setCurrentIndex] = useState(0);
    const [duration, setDuration] = useState(5); // Default 5s
    const [anchorElDuration, setAnchorElDuration] = useState<null | HTMLElement>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
    const [isTextHidden, setIsTextHidden] = useState(false);
    const [isMusicEnabled, setIsMusicEnabled] = useState(false); // Music off by default
    const [musicUrl, setMusicUrl] = useState("https://clikbatebucket.s3.us-east-1.amazonaws.com/welte-mignon-piano-48794.mp3");
    const [musicName, setMusicName] = useState("Music");
    const [showAudioPicker, setShowAudioPicker] = useState(false);
    const [logoVisible, setLogoVisible] = useState(false);

    // MP4 Export State
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState("");
    const [s3ImageUrls, setS3ImageUrls] = useState<string[]>([]);
    const navigate = useNavigate();

    // Music Ref
    const musicRef = useRef<HTMLAudioElement | null>(null);
    ///console.log(parsedKeyPoints2)

    // Initialize/Update Music
    useEffect(() => {
        if (!musicRef.current) {
            musicRef.current = new Audio(musicUrl);
            musicRef.current.loop = true;
            musicRef.current.volume = 0.5;
        } else {
            const wasPlaying = !musicRef.current.paused;
            musicRef.current.src = musicUrl;
            musicRef.current.load();
            if (wasPlaying && isPlaying && isMusicEnabled) {
                musicRef.current.play().catch(e => console.error("Music swap play failed:", e));
            }
        }

        return () => {
            // Only cleanup if the component actually unmounts or we want to hard reset
        };
    }, [musicUrl]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (musicRef.current) {
                musicRef.current.pause();
                musicRef.current.src = "";
                musicRef.current = null;
            }
        };
    }, []);

    // Sync Music Playback
    useEffect(() => {
        if (!musicRef.current) return;

        if (isPlaying && isMusicEnabled) {
            musicRef.current.play().catch(e => console.error("Music playback failed:", e));
        } else {
            musicRef.current.pause();
        }
    }, [isPlaying, isMusicEnabled]);

    // Logo Animation Loop
    useEffect(() => {
        if (showControls) {
            setLogoVisible(false);
            return;
        }

        let timeoutId1: NodeJS.Timeout;

        // Wait 5s hidden, then show and KEEP showing
        timeoutId1 = setTimeout(() => {
            setLogoVisible(true);
        }, 5000);

        return () => {
            if (timeoutId1) clearTimeout(timeoutId1);
        };
    }, [showControls]);

    // Determine mode based on generation status
    const isComplete = images.length >= totalExpected && totalExpected > 0;
    const mode: ViewMode = isComplete ? "watch" : "generating";

    const brandColor = darkMode ? '#e6cfff' : '#0099cc';
    const textCol = darkMode ? "#fff" : "#000";
    const bgCol = darkMode ? "rgba(0,0,0,0.98)" : "rgba(255,255,255,0.98)";

    // Glass style for bars
    const glassStyle: React.CSSProperties = {
        background: darkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.35)",
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: `1px solid ${darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
    };

    // Helper: Split text into two roughly equal halves without cutting words
    // REVERTED: User wants continuous narration now.
    // const splitTextEssentially = useCallback((text: string): [string, string] => { ... }, []);

    // State to coordinate continuous playback across slides
    const shouldCancelTTS = useRef(true);
    const currentIndexRef = useRef(currentIndex);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);







    // TTS Helper: Speak text with completion callback
    const speakText = (text: string, onEnd?: () => void, wordOffset: number = 0) => {
        console.log("TTS Attempting to speak:", text, "Offset:", wordOffset);
        window.speechSynthesis.cancel();
        if (!text) {
            console.warn("TTS: No text to speak");
            if (onEnd) onEnd();
            return;
        }

        // Reset word index
        setCurrentWordIndex(-1);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;

        // Attempt to select a voice (Prioritize British Female as requested)
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google UK English Female"))
            || voices.find(v => (v.lang.includes("GB") || v.lang.includes("UK")) && v.name.includes("Female"))
            || voices.find(v => v.name.includes("Female"))
            || voices.find(v => v.lang.includes("en"))
            || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;

        // Simulation State
        const words = text.trim().split(/\s+/);
        // If we are starting with an offset (Part B start), we are already "past" the halfway point relative to the FULL original text
        // But here 'text' is the partial text. Wait, 'text' passed in is just the text to speak.
        // If Part B start, 'text' is the second half.
        // So 'wordOffset' tells us where we are in the GLOBAL narration (which is displayed on screen).

        let simIndex = 0;
        let simInterval: NodeJS.Timeout | null = null;
        let boundaryFired = false;

        // Check halfway logic is only needed if we are on Part A and want to transition to Part B.
        // If we are already on Part B (offset > 0), we don't need to transition to B.
        // We just need to finish.
        // However, we need to know the 'total' length to know if we need to transition?
        // No, the transition logic in checkHalfway relies on 'currentIndexRef'.
        // If currentIndex is Odd (Part B), checkHalfway won't fire transition. Correct.


        let hasTransitionedToB = false;

        const checkHalfway = (idx: number) => {
            // Only if we are on Part A (even index) and haven't transitioned yet
            // idx here is relative to the current utterance.
            // If we started from 0 (Part A), idx is absolute.
            // If we started from offset (Part B), idx is relative to the partial text?
            // Actually, for Part A we pass the FULL text, so idx is absolute.
            // For Part B start, we pass PARTIAL text.

            // We need to know the 'mid' point of the FULL text to know when to transition.
            // But if we are on Part B, we don't transition.

            // So simply:
            if (currentIndexRef.current % 2 === 0 && !hasTransitionedToB) {
                // We need to calculate halfWords of the FULL text.
                // In Part A call, 'text' IS the full text.
                const totalWords = words.length;
                const halfPoint = Math.ceil(totalWords / 2);

                if (idx >= halfPoint) {
                    console.log("TTS: Halfway point reached, transitioning to Part B");
                    hasTransitionedToB = true;
                    shouldCancelTTS.current = false; // Don't kill audio!

                    if (sliderRef.current) {
                        const nextIndex = currentIndexRef.current + 1;
                        sliderRef.current.scrollTo({
                            left: nextIndex * sliderRef.current.offsetWidth,
                            behavior: "smooth",
                        });
                    }
                }
            }
        };

        utterance.onstart = () => {
            console.log("TTS: Started");
            // Start Simulation Timer (Fallback for voices like Google UK that miss boundaries)
            // Est. 350ms per word is a decent average for rate 1.0
            const msPerWord = 350;
            simInterval = setInterval(() => {
                if (!boundaryFired && simIndex < words.length) {
                    // Update global word index: Offset + current simulated index
                    setCurrentWordIndex(wordOffset + simIndex);
                    checkHalfway(simIndex); // Check using local index (0-based for this utterance)
                    simIndex++;
                }
            }, msPerWord);
        };

        utterance.onerror = (e) => {
            console.error("TTS Error:", e);
            if (simInterval) clearInterval(simInterval);
            if (e.error !== 'interrupted' && onEnd) onEnd();
        };

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                boundaryFired = true; // Real events detected, disable simulation updates
                const charIndex = event.charIndex;
                let currentLength = 0;
                for (let i = 0; i < words.length; i++) {
                    if (currentLength === charIndex || (currentLength < charIndex && charIndex < currentLength + words[i].length + 1)) {
                        setCurrentWordIndex(wordOffset + i);
                        checkHalfway(i);
                        break;
                    }
                    currentLength += words[i].length + 1;
                }
            }
        };

        utterance.onend = () => {
            console.log("TTS: Ended natural");
            if (simInterval) clearInterval(simInterval);
            setCurrentWordIndex(-1);
            shouldCancelTTS.current = true; // Reset safety
            if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);
    };

    // Auto-scroll to first image when watch mode activates AND start playing
    useEffect(() => {
        if (mode === "watch") {
            if (sliderRef.current) {
                sliderRef.current.scrollTo({ left: 0, behavior: "smooth" });
            }
            setIsPlaying(true); // Auto-play on entry
            setIsMuted(true);   // Ensure muted on entry
        }
    }, [mode]);

    // Auto-scroll to latest during generation
    useEffect(() => {
        if (mode === "generating" && sliderRef.current && images.length > 0) {
            const newIndex = images.length - 1;
            sliderRef.current.scrollTo({
                left: newIndex * sliderRef.current.offsetWidth,
                behavior: "smooth",
            });
        }
    }, [images.length, mode]);

    // Track manual scrolling to update currentIndex
    const handleScroll = () => {
        if (sliderRef.current) {
            const scrollLeft = sliderRef.current.scrollLeft;
            const width = sliderRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            if (index !== currentIndex) {
                setCurrentIndex(index);
            }
        }
    };

    // --- MP4 Export Logic ---
    const fetchBlob = useCallback(async (url: string): Promise<Blob> => {
        try {
            const response = await fetch(url);
            return await response.blob();
        } catch (e) {
            console.error("Fetch blob failed", e);
            throw e;
        }
    }, []);

    const GenerateSignedUrlForSingleImage = useCallback(async (blob: Blob) => {
        if (!blob) throw new Error("No image Blob.");
        const requestData = { values: { count: 1 } };
        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_imageStory`,
            requestData,
            { withCredentials: true }
        );
        const holder = response.data.holder;
        if (!holder || holder.length !== 1) throw new Error("Invalid signed URL.");
        const signedUrls = holder[0];
        if (!signedUrls.urlHD) throw new Error("Missing signed URLs.");
        return signedUrls;
    }, []);

    const PutSingleImageInS3WithURL = useCallback(async (blob: Blob, signedUrls: any) => {
        const uploadHD = await axios.put(signedUrls.urlHD, blob, {
            headers: { "Content-Type": blob.type || "application/octet-stream" },
        });
        if (uploadHD.status !== 200 && uploadHD.status !== 204) {
            throw new Error(`Upload failed: ${uploadHD.status}`);
        }
        return signedUrls.urlHD.split("?")[0];
    }, []);

    const pollJobUntilComplete = useCallback(async (jobId: string) => {
        return new Promise<void>((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const res: any = await axios.get(`${CLIK_URL}/job-status/${jobId}`);
                    const status = res.data.status;
                    if (status === "COMPLETE") {
                        clearInterval(interval);
                        resolve();
                    } else if (status === "ERROR") {
                        clearInterval(interval);
                        reject(new Error("MediaConvert job failed"));
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, 3000);
        });
    }, []);

    const getAudioDuration = useCallback((url: string): Promise<number> => {
        return new Promise((resolve) => {
            const audio = new Audio(url);
            audio.onloadedmetadata = () => {
                if (audio.duration === Infinity) {
                    audio.currentTime = 1e101;
                    audio.ontimeupdate = () => {
                        audio.ontimeupdate = null;
                        resolve(audio.duration);
                        audio.currentTime = 0;
                    };
                } else {
                    resolve(audio.duration);
                }
            };
            audio.onerror = () => resolve(0);
        });
    }, []);

    const generateNarrationAudio = useCallback(async (stepData: any, voiceId: string, index: number): Promise<string> => {
        if (!stepData) return "";
        try {
            const requestData = {
                text: typeof stepData === 'object' ? stepData.text : stepData,
                voice: voiceId,
                prompt: typeof stepData === 'object' && stepData.prompt ? stepData.prompt : "DIRECTOR'S NOTES: Clear delivery.",
                language_code: "en-US"
            };

            const response: any = await axios.post(
                `${CLIK_URL}/generateReplicateAudio`,
                requestData,
                {
                    headers: { "Content-Type": "application/json" },
                    withCredentials: true,
                }
            );

            const audioContent = response.data?.audioContent;
            if (!audioContent) throw new Error("No audio content");

            const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
            const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });

            const countRes: any = await axios.post(
                `${CLIK_URL}/get_signed_url_audioStory`,
                { values: { count: 1 } },
                { withCredentials: true }
            );
            const holder = countRes.data.holder;
            if (!holder || !holder[0]?.urlAudio) throw new Error("No signed audio URL");

            const signedObj = holder[0];
            await axios.put(signedObj.urlAudio, audioBlob, {
                headers: { "Content-Type": "audio/mp3" }
            });

            return signedObj.urlAudio.split("?")[0];
        } catch (error) {
            console.error("Error generating audio", error);
            return "";
        }
    }, []);

    const getImageDimensions = useCallback((url: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => resolve({ width: 1024, height: 1024 }); // Fallback
            img.src = url;
        });
    }, []);

    const convertToPng = useCallback(async (blob: Blob): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((pngBlob) => {
                    if (pngBlob) {
                        resolve(pngBlob);
                    } else {
                        reject(new Error("Failed to convert to PNG"));
                    }
                }, "image/png");
            };
            img.onerror = () => reject(new Error("Failed to load image for PNG conversion"));
            img.src = URL.createObjectURL(blob);
        });
    }, []);

    const handleExportMp4 = useCallback(async () => {
        try {
            setIsExporting(true);
            let finalS3Urls: string[] = [...s3ImageUrls];

            // 1. Upload Images if not already done
            if (finalS3Urls.length === 0) {
                setExportStatus("Uploading Images...");
                for (const imgUrl of images) {
                    if (!imgUrl) continue;
                    try {
                        const rawBlob = await fetchBlob(imgUrl);
                        const pngBlob = await convertToPng(rawBlob);
                        const signedUrls = await GenerateSignedUrlForSingleImage(pngBlob);
                        const uploadedUrl = await PutSingleImageInS3WithURL(pngBlob, signedUrls);
                        finalS3Urls.push(uploadedUrl);
                    } catch (err) {
                        console.error("Error uploading image:", err);
                        if (imgUrl.includes("clikbatebucket")) {
                            finalS3Urls.push(imgUrl);
                        }
                    }
                }

                setS3ImageUrls(finalS3Urls);
            }

            // 1.5 Initial Save to Database (PostStory)
            setExportStatus("Initializing Post...");
            const initialData: any = {
                id: loggedUser ? loggedUser.id : null,
                topic: "",
                mode: type === 0 ? 0 : type === 3 ? 2 : 1,
                caption: prompt,
                kontext: images.length > 0 ? images[0] : null,
                prompt: prompt ? prompt : null,
                model: "MirrorView Export",
                ratio: 1,
            };

            const count = images?.length ?? 0;
            for (let i = 0; i < count; i++) {
                const n = i + 1;
                const finalImg = finalS3Urls[i];
                initialData[`image${n}`] = finalImg;
                initialData[`imageHd${n}`] = finalImg;
                initialData[`txt${n}`] = parsedKeyPoints[i] || "";
                initialData[`GeneratedText${n}`] = typeof parsedKeyPoints2[i] === 'object' ? (parsedKeyPoints2[i] as any).text : (parsedKeyPoints2[i] || "");
            }

            const postRes: any = await axios.post(`${CLIK_URL}/PostStory`, { values: initialData });
            const newPostId = postRes.data.go;

            let route = "create-memeimg";
            let audioDurations: number[] | number = 0;
            let audioUrls: string[] = [];

            // 2. Handle Narration (Explain Mode / Type 1)
            if (type === 1 && parsedKeyPoints2 && parsedKeyPoints2.length > 0) {
                setExportStatus("Generating Narration...");
                route = "create-videoimg"; // Using audio-synced endpoint for narrated slideshow

                const exportVoices = ["en-US-Journey-D", "en-US-Journey-F", "en-US-Journey-O", "Aoede", "Charon", "Fenrir", "Kore", "Puck", "Leda", "Orpheus"];
                const randomVoiceId = exportVoices[Math.floor(Math.random() * exportVoices.length)];

                // Generate and upload speech for each slide
                for (let i = 0; i < parsedKeyPoints2.length; i++) {
                    const text = parsedKeyPoints2[i];
                    if (text) {
                        const url = await generateNarrationAudio(text, randomVoiceId, i);
                        audioUrls.push(url);
                    } else {
                        audioUrls.push("");
                    }
                }

                // Calculate durations for synchronization
                if (audioUrls.some(u => u.length > 0)) {
                    const durPromises = audioUrls.map(u => u ? getAudioDuration(u) : Promise.resolve(0));
                    audioDurations = await Promise.all(durPromises);
                }
            }

            // 3. Render Video (Ensuring usevid=0 logic)
            setExportStatus("Rendering video...");

            // Detect dynamic resolution from first image
            const firstImg = finalS3Urls[0];
            const dims = await getImageDimensions(firstImg);
            const dynamicResolution = `${dims.width}x${dims.height}`;

            ///alert(dynamicResolution)

            // Ensure clipDurations is an array
            const clipDurationsArray = 5;

            const response: any = await axios.post(`${CLIK_URL}/${route}`, {
                clipDurations: clipDurationsArray,
                audioUrls: audioUrls.filter(Boolean),
                imageUrls: finalS3Urls,
                videoUrls: null, // usevid = 0 logic (images only)
                audioDurations: type === 0 || type === 3 ? 0 : audioDurations,
                audioUrl: musicUrl,
                outputResolution: dynamicResolution,
                outputBucket: "s3://clikbatebucket/videos/",
                ratio: ratioKey
            });

            const { jobId, videoUrl, videoLength } = response.data;
            await pollJobUntilComplete(jobId);

            //alert(videoUrl)

            // 4. Finalize
            setExportStatus("Finalizing...");
            const logo = Math.random() < 0.5
                ? 'https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/88.png'
                : 'https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/ddd.png';

            const addBgResponse: any = await axios.post(`${CLIK_URL}/addbackgroundmusic`, {
                text1: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-cb15400a7ecfabe08640af35d6ca66aa.png',
                logo,
                text2: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/hd-cb15400a7ecfabe08640af35d6ca66aa.png',
                videoUrlx: videoUrl,
                audioUrlx: musicUrl,
                videoLength: videoLength,
                outputResolution: dynamicResolution,
                type: type === 1 ? 0 : 1,
                audioLength: 90,
                isVideoSilent: false,
            });

            console.log("Final Video:", addBgResponse.data.outputVideo);
            const finalVideoUrl = addBgResponse.data.outputVideo;

            // 5. Update Database with Video (UpdatePostAudioMp4)
            setExportStatus("Saving to Profile...");

            const updateData: any = {
                postId: newPostId,
                captionSummary: prompt,
                captionAudio: '',
                x1: audioUrls[0] || null,
                x2: audioUrls[1] || null,
                x3: audioUrls[2] || null,
                x4: audioUrls[3] || null,
                x5: audioUrls[4] || null,
                x6: audioUrls[5] || null,
                x7: audioUrls[6] || null,
                x8: audioUrls[7] || null,
                x9: audioUrls[8] || null,
                typex: 1,
                videourl: finalVideoUrl,
                vidoriginal: videoUrl // the unbranded one
            };

            await axios.put(`${CLIK_URL}/UpdatePostAudioMp4`, { values: updateData });

            setExportStatus("Done!");
            setTimeout(() => {
                navigate("/pages", {
                    state: { userId: loggedUser?.id },
                });
            }, 1000);
        } catch (error) {
            console.error("Export failed:", error);
            setExportStatus("Error!");
            setTimeout(() => setIsExporting(false), 2000);
        }
    }, [
        images,
        s3ImageUrls,
        loggedUser,
        type,
        prompt,
        parsedKeyPoints,
        parsedKeyPoints2,
        duration,
        musicUrl,
        ratioKey,
        fetchBlob,
        GenerateSignedUrlForSingleImage,
        PutSingleImageInS3WithURL,
        convertToPng,
        generateNarrationAudio,
        getAudioDuration,
        getImageDimensions,
        pollJobUntilComplete,
        navigate
    ]);

    // Auto-scroll logic
    // Smart Auto-Scroll Logic with Split Narration
    useEffect(() => {
        if (!isPlaying || mode !== "watch") {
            window.speechSynthesis.cancel();
            setCurrentWordIndex(-1);
            return;
        }

        let timeoutId: NodeJS.Timeout;

        const advanceSlide = () => {
            if (sliderRef.current) {
                // Use Ref to avoid stale closure if called from onEnd
                const nextIndex = currentIndexRef.current + 1;
                if (nextIndex < images.length) {
                    sliderRef.current.scrollTo({
                        left: nextIndex * sliderRef.current.offsetWidth,
                        behavior: "smooth",
                    });
                } else {
                    sliderRef.current.scrollTo({ left: 0, behavior: "smooth" });
                }
            }
        };

        const scheduleNextSlide = () => {
            // If Unmuted (Narrate Mode)
            if (!isMuted && parsedKeyPoints2 && parsedKeyPoints2.length > 0) {
                // Calculate which narration item to use
                const narrationIndex = Math.floor(currentIndex / 2);
                const isPartB = currentIndex % 2 === 1; // 0=PartA, 1=PartB

                const rawNarration = parsedKeyPoints2[narrationIndex] || "";
                const fullNarration = typeof rawNarration === 'object' ? (rawNarration as any).text : rawNarration;

                if (fullNarration) {
                    if (isPartB) {
                        // PART B: Passive Mode OR Manual Start
                        // If audio is already playing (detected via global state?), we do nothing.
                        // BUT `window.speechSynthesis.speaking` might be true from previous part.

                        // If we just landed here (e.g. User clicked Next or clicked Play on Part B), we need to ensure audio is correct.
                        // If currentWordIndex is -1 or we are not speaking, we should START speaking from halfway.

                        const isSpeaking = window.speechSynthesis.speaking;

                        if (!isSpeaking) {
                            console.log("Part B start detected (Silence). Starting from half.");
                            // Calculate second half text
                            const words = fullNarration.trim().split(/\s+/);
                            const splitIndex = Math.ceil(words.length / 2);
                            const secondHalfText = words.slice(splitIndex).join(" ");

                            shouldCancelTTS.current = true;
                            speakText(secondHalfText, () => {
                                advanceSlide();
                            }, splitIndex); // Pass offset!
                        } else {
                            // Audio is playing. Assume it's from Part A and let it ride.
                            console.log("Part B detected (Audio Playing). Continuing...");
                        }
                        return;
                    } else {
                        // PART A: Active Mode
                        // Start Speaking.
                        shouldCancelTTS.current = true; // Default to cancel unless transition
                        speakText(fullNarration, () => {
                            // On End of full narration (end of Part B effectively), go to Part C (or A if looping)
                            advanceSlide();
                        });
                        return; // EXIT. Do not set timer.
                    }
                }
            }

            // --- TIMER MODE (Muted or No Text) ---
            const nextDelay = duration * 1000;
            timeoutId = setTimeout(advanceSlide, nextDelay);
        };

        scheduleNextSlide();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (shouldCancelTTS.current) {
                window.speechSynthesis.cancel();
            }
            // Reset for next effect run
            shouldCancelTTS.current = true;
        };
    }, [isPlaying, mode, duration, currentIndex, images.length, isMuted, parsedKeyPoints2]);

    // VLC-style auto-hide logic
    const resetHideTimer = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        setShowControls(true);
        if (hasInteracted) {
            hideTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    }, [hasInteracted]);

    const handleUserInteraction = useCallback(() => {
        if (!hasInteracted) {
            setHasInteracted(true);
        }
        resetHideTimer();
    }, [hasInteracted, resetHideTimer]);

    // Mouse/touch events for auto-hide
    useEffect(() => {
        const container = containerRef.current;
        if (!container || mode !== "watch") return;

        const handleMove = () => handleUserInteraction();
        const handleClick = () => handleUserInteraction();

        container.addEventListener("mousemove", handleMove);
        container.addEventListener("touchstart", handleClick);
        container.addEventListener("click", handleClick);

        return () => {
            container.removeEventListener("mousemove", handleMove);
            container.removeEventListener("touchstart", handleClick);
            container.removeEventListener("click", handleClick);
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, [mode, handleUserInteraction]);

    const handleCloseClick = () => {
        if (onSwitchToCreateMode) onSwitchToCreateMode();
    };

    const handleConfirmClose = () => {
        setShowCloseConfirm(false);
        if (onSwitchToCreateMode) onSwitchToCreateMode();
    };

    const handleCancelClose = () => {
        setShowCloseConfirm(false);
    };

    const handlePrev = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsPlaying(false);
        if (sliderRef.current) {
            const nextIndex = Math.max(0, currentIndex - 1);
            sliderRef.current.scrollTo({
                left: nextIndex * sliderRef.current.offsetWidth,
                behavior: "smooth",
            });
        }
    };

    const handleNext = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsPlaying(false);
        if (sliderRef.current) {
            const nextIndex = Math.min(images.length - 1, currentIndex + 1);
            sliderRef.current.scrollTo({
                left: nextIndex * sliderRef.current.offsetWidth,
                behavior: "smooth",
            });
        }
    };

    const glassButtonStyle = {
        color: textCol,
        backgroundColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        "&:hover": {
            backgroundColor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
        },
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100dvh",
                zIndex: 25000,
                backgroundColor: bgCol,
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Generating Mode: Glass Top Bar */}
            {mode === "generating" && (
                <div
                    style={{
                        ...glassStyle,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "calc(10px + env(safe-area-inset-top)) 15px 10px 15px",
                    }}
                >
                    <IconButton onClick={handleCloseClick} sx={{ color: textCol }}>
                        <CloseIcon />
                    </IconButton>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Typography sx={{ fontSize: "0.85rem", color: textCol, opacity: 0.8, fontWeight: 600 }}>
                            Generating {images.length}/{totalExpected}...
                        </Typography>
                    </div>

                    <div style={{ width: 40 }} />

                    {/* Shimmer/Light Animation Layer */}
                    <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none", // Click-through
                        overflow: "hidden",
                        borderRadius: "inherit",
                    }}>
                        <style>{`
                            @keyframes scanLight {
                                0% { transform: translateX(-100%); }
                                100% { transform: translateX(100%); }
                            }
                        `}</style>
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "50%",
                            height: "100%",
                            background: darkMode
                                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)"
                                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                            transform: "skewX(-20deg)",
                            animation: "scanLight 2.5s infinite linear",
                        }} />
                    </div>
                </div>
            )}

            {/* Watch Mode: VLC-Style Top Bar */}
            {mode === "watch" && (
                <div
                    style={{
                        ...glassStyle,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 30000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "calc(10px + env(safe-area-inset-top)) 15px 10px 15px",
                        opacity: showControls ? 1 : 0,
                        transform: showControls ? "translateY(0)" : "translateY(-100%)",
                        transition: "opacity 0.3s ease, transform 0.3s ease",
                        pointerEvents: showControls ? "auto" : "none",
                    }}
                >
                    {/* Left: Close + Confirm */}
                    <div style={{ position: "relative" }}>
                        <IconButton onClick={handleCloseClick} sx={glassButtonStyle}>
                            <CloseIcon />
                        </IconButton>
                        {showCloseConfirm && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: 45,
                                    left: 0,
                                    ...glassStyle,
                                    borderRadius: 12,
                                    padding: "12px 16px",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                                    zIndex: 30001,
                                    minWidth: 160,
                                }}
                            >
                                <Typography sx={{ fontSize: "0.85rem", color: textCol, marginBottom: 1.5 }}>
                                    Are you sure?
                                </Typography>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={handleConfirmClose}
                                        sx={{
                                            backgroundColor: brandColor,
                                            color: "#000",
                                            fontWeight: 700,
                                            "&:hover": { backgroundColor: brandColor },
                                        }}
                                    >
                                        Yes
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleCancelClose}
                                        sx={{ borderColor: textCol, color: textCol, fontWeight: 700 }}
                                    >
                                        No
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Center: Duration Dropdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Button
                            onClick={(e) => setAnchorElDuration(e.currentTarget)}
                            endIcon={<KeyboardArrowDownIcon sx={{ fontSize: "1rem" }} />}
                            sx={{
                                color: textCol,
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                backgroundColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                                borderRadius: 20,
                                padding: "4px 12px",
                                textTransform: "none",
                                "&:hover": {
                                    backgroundColor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                                }
                            }}
                        >
                            {duration}s
                        </Button>
                        <Menu
                            anchorEl={anchorElDuration}
                            open={Boolean(anchorElDuration)}
                            onClose={() => setAnchorElDuration(null)}
                            PaperProps={{
                                style: {
                                    ...glassStyle,
                                    backgroundColor: darkMode ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)",
                                    color: textCol,
                                    borderRadius: 12,
                                    minWidth: 80,
                                }
                            }}
                            sx={{ zIndex: 32000 }} // Ensure menu is above top bar
                        >
                            {[3, 5, 7, 10, 15].map((d) => (
                                <MenuItem
                                    key={d}
                                    onClick={() => { setDuration(d); setAnchorElDuration(null); }}
                                    selected={duration === d}
                                    sx={{ justifyContent: "center", fontWeight: 700, fontSize: "0.9rem" }}
                                >
                                    {d}s
                                </MenuItem>
                            ))}
                        </Menu>
                    </div>

                    {/* Right: Play, Mute, Music */}
                    <div style={{ display: "flex", gap: 4 }}>
                        <IconButton
                            onClick={() => {
                                const newPlaying = !isPlaying;
                                setIsPlaying(newPlaying);
                                if (newPlaying) {
                                    setShowControls(false);
                                    setIsTextHidden(false); // Restore text on play
                                }
                            }}
                            sx={glassButtonStyle}
                        >
                            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                        </IconButton>
                        {type === 1 && (
                            <IconButton onClick={() => setIsMuted(!isMuted)} sx={glassButtonStyle}>
                                {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                            </IconButton>
                        )}
                        <IconButton
                            onClick={() => setIsMusicEnabled(!isMusicEnabled)}
                            sx={{
                                ...glassButtonStyle,
                                color: isMusicEnabled ? brandColor : textCol,
                                backgroundColor: isMusicEnabled
                                    ? (darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)")
                                    : glassButtonStyle.backgroundColor
                            }}
                        >
                            <MusicNoteIcon />
                        </IconButton>
                    </div>
                </div>
            )}

            {/* Watch Mode: VLC-Style Bottom Bar */}
            {mode === "watch" && (
                <div
                    style={{
                        ...glassStyle,
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 30000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 15px calc(10px + env(safe-area-inset-bottom)) 15px",
                        opacity: showControls ? 1 : 0,
                        transform: showControls ? "translateY(0)" : "translateY(100%)",
                        transition: "opacity 0.3s ease, transform 0.3s ease",
                        pointerEvents: showControls ? "auto" : "none",
                    }}
                >
                    {/* Left: Grid, Add */}
                    <div style={{ display: "flex", gap: 8 }}>
                        <IconButton
                            onClick={() => {
                                setShowGrid(true);
                                setIsPlaying(false); // Pause when opening grid
                            }}
                            sx={glassButtonStyle}
                        >
                            <GridViewIcon />
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                setShowAudioPicker(true);
                                setIsPlaying(false); // Pause when opening audio picker
                            }}
                            sx={{
                                ...glassButtonStyle,
                                borderRadius: "8px",
                                padding: "4px 8px",
                                gap: "4px",
                            }}
                        >
                            <AddIcon sx={{ fontSize: "1.2rem" }} />
                            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                {musicUrl === "https://clikbatebucket.s3.us-east-1.amazonaws.com/welte-mignon-piano-48794.mp3"
                                    ? "Music"
                                    : (musicName.length > (matchMobile ? 14 : 17)
                                        ? musicName.slice(0, matchMobile ? 14 : 17) + "..."
                                        : musicName)}
                            </Typography>
                        </IconButton>
                    </div>

                    {/* Slide Indicator (Center) */}
                    <div
                        style={{
                            position: "absolute",
                            left: "48%",
                            transform: "translateX(-50%)",
                            display: "flex",
                            alignItems: "center",
                            pointerEvents: "none",
                        }}
                    >
                        <Typography sx={{ color: textCol, fontWeight: 900, fontSize: "0.85rem", opacity: 0.8 }}>
                            {currentIndex + 1} / {images.length}
                        </Typography>
                    </div>

                    {/* Right: Switch to Create Mode */}
                    <Button
                        onClick={() => {
                            if (onSwitchToCreateMode) onSwitchToCreateMode();
                        }}
                        sx={{
                            ...glassButtonStyle,
                            borderRadius: 20,
                            padding: "4px 12px",
                            minWidth: "auto",
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            backgroundColor: darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
                            "&:hover": {
                                backgroundColor: brandColor,
                                color: "#000"
                            }
                        }}
                    >
                        Create Mode
                    </Button>
                </div>
            )}

            {/* GRID VIEW MODAL */}
            {showGrid && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 40000,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "rgba(0,0,0,0.4)", // Dim background
                        backdropFilter: "blur(5px)",
                    }}
                    onClick={() => setShowGrid(false)} // Close on background click
                >
                    <div
                        style={{
                            width: matchMobile ? "95%" : "40%", // Responsive Width
                            height: "90%", // Slightly less than 100 to show background
                            maxHeight: "95vh",
                            borderRadius: 24, // Rounded corners for modal
                            backgroundColor: darkMode ? "rgba(20,20,20,0.95)" : "rgba(255,255,255,0.95)",
                            backdropFilter: "blur(20px)",
                            display: "flex",
                            flexDirection: "column",
                            border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, // Full border
                            boxShadow: "0 10px 50px rgba(0,0,0,0.5)",
                            padding: "20px",
                            overflowY: "hidden",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                            <div
                                onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                                style={{
                                    flex: 1,
                                    marginRight: 10,
                                    cursor: "pointer",
                                    maxHeight: isTitleExpanded ? "150px" : "auto",
                                    overflowY: isTitleExpanded ? "auto" : "hidden",
                                    transition: "all 0.3s ease",
                                }}
                            >
                                <Typography sx={{
                                    color: textCol,
                                    fontWeight: 700,
                                    fontSize: "1.2rem",
                                    opacity: 0.8,
                                    whiteSpace: isTitleExpanded ? "normal" : "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "block"
                                }}>
                                    {prompt || "Generated Images"}
                                </Typography>
                                {!isTitleExpanded && (prompt || "").length > 50 && (
                                    <Typography sx={{ fontSize: "0.7rem", color: textCol, opacity: 0.5, marginTop: "-2px" }}>
                                        (Click to expand)
                                    </Typography>
                                )}
                            </div>
                            <IconButton onClick={() => setShowGrid(false)}>
                                <CloseIcon sx={{ color: textCol }} />
                            </IconButton>
                        </div>

                        {/* Grid Body - Using two columns to allow natural stacking without row-height gaps */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                padding: "4px",
                            }}
                        >
                            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                                {/* Left Column */}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                                    {Array.from({ length: totalExpected }).map((_, idx) => {
                                        if (idx % 2 !== 0) return null;
                                        const img = images[idx] || nanoImages?.[idx];
                                        return (
                                        <div
                                            key={idx}
                                            style={{
                                                position: "relative",
                                                borderRadius: 16,
                                                overflow: "hidden",
                                                cursor: "pointer",
                                                outline: currentIndex === idx ? `4px solid ${brandColor}` : "none",
                                                outlineOffset: "-4px",
                                                backgroundColor: "#000",
                                                width: "100%",
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                            }}
                                            onClick={() => {
                                                if (sliderRef.current) {
                                                    sliderRef.current.scrollTo({
                                                        left: idx * sliderRef.current.offsetWidth,
                                                        behavior: "auto"
                                                    });
                                                }
                                                setCurrentIndex(idx);
                                                setShowGrid(false);
                                            }}
                                        >
                                            <img
                                                src={img}
                                                alt={`Grid Item ${idx}`}
                                                style={{ width: "100%", height: "auto", display: "block" }}
                                            />
                                            {/* Index Overlay */}
                                            <div style={{
                                                position: "absolute",
                                                bottom: 8,
                                                left: 8,
                                                backgroundColor: "rgba(0,0,0,0.7)",
                                                color: "#fff",
                                                fontSize: "0.75rem",
                                                fontWeight: 900,
                                                padding: "4px 10px",
                                                borderRadius: 20,
                                                backdropFilter: "blur(4px)",
                                                border: "1px solid rgba(255,255,255,0.2)",
                                            }}>
                                                {idx + 1}
                                            </div>
                                        </div>
                                    )})}
                                </div>

                                {/* Right Column */}
                                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                                    {Array.from({ length: totalExpected }).map((_, idx) => {
                                        if (idx % 2 === 0) return null;
                                        const img = images[idx] || nanoImages?.[idx];
                                        return (
                                        <div
                                            key={idx}
                                            style={{
                                                position: "relative",
                                                borderRadius: 16,
                                                overflow: "hidden",
                                                cursor: "pointer",
                                                outline: currentIndex === idx ? `4px solid ${brandColor}` : "none",
                                                outlineOffset: "-4px",
                                                backgroundColor: "#000",
                                                width: "100%",
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                            }}
                                            onClick={() => {
                                                if (sliderRef.current) {
                                                    sliderRef.current.scrollTo({
                                                        left: idx * sliderRef.current.offsetWidth,
                                                        behavior: "auto"
                                                    });
                                                }
                                                setCurrentIndex(idx);
                                                setShowGrid(false);
                                            }}
                                        >
                                            <img
                                                src={img}
                                                alt={`Grid Item ${idx}`}
                                                style={{ width: "100%", height: "auto", display: "block" }}
                                            />
                                            {/* Index Overlay */}
                                            <div style={{
                                                position: "absolute",
                                                bottom: 8,
                                                left: 8,
                                                backgroundColor: "rgba(0,0,0,0.7)",
                                                color: "#fff",
                                                fontSize: "0.75rem",
                                                fontWeight: 900,
                                                padding: "4px 10px",
                                                borderRadius: 20,
                                                backdropFilter: "blur(4px)",
                                                border: "1px solid rgba(255,255,255,0.2)",
                                            }}>
                                                {idx + 1}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Subtitles Overlay (Watch Mode Only - Hidden in Image mode) */}
            {mode === "watch" && type === 1 && (
                <div style={{
                    position: "fixed",
                    bottom: "12%",
                    left: 0,
                    width: "100%",
                    textAlign: "center",
                    zIndex: 20002,
                    pointerEvents: "none",
                    padding: "0 20px",
                }}>
                    <Typography
                        component="div"
                        onClick={() => {
                            setIsPlaying(false);
                            setIsTextHidden(true); // Explicitly hide text on text click
                        }}
                        sx={{
                            color: "#fff",
                            fontWeight: 900,
                            fontSize: { xs: "1.2rem", md: "2.1rem" },
                            textShadow: "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                            fontFamily: "Arial, sans-serif",
                            lineHeight: 1.5,
                            maxWidth: "90%",
                            margin: "0 auto",
                            cursor: "pointer",
                            pointerEvents: "auto",
                            display: isTextHidden ? "none" : "block", // Depends on hidden state, not play state
                        }}>
                        {(() => {
                            if (parsedKeyPoints2 && parsedKeyPoints2.length > 0) {
                                // Logic for continuous narration: show FULL text on BOTH parts
                                const narrationIndex = Math.floor(currentIndex / 2);
                                // No splitting needed visually
                                const currentRaw = parsedKeyPoints2[narrationIndex] || "";
                                const currentText = typeof currentRaw === 'object' ? (currentRaw as any).text : currentRaw;

                                if (!currentText) return "";

                                const words = currentText.trim().split(/\s+/);
                                if (!isMuted) {
                                    return words.map((word, idx) => {
                                        // Visual Pill Logic
                                        const isActive = currentWordIndex >= 0 && idx >= currentWordIndex && idx < currentWordIndex + 5;
                                        const pillTextColor = darkMode ? "#000" : "#fff";
                                        const isStart = idx === currentWordIndex;
                                        const isEnd = idx === currentWordIndex + 4 || idx === words.length - 1;

                                        let radius = "4px";
                                        if (isActive) {
                                            if (isStart && isEnd) radius = "6px";
                                            else if (isStart) radius = "6px 0 0 6px";
                                            else if (isEnd) radius = "0 6px 6px 0";
                                            else radius = "0";
                                        }

                                        return (
                                            <span
                                                key={idx}
                                                style={{
                                                    display: "inline-block",
                                                    margin: "0",
                                                    padding: "2px 5px",
                                                    backgroundColor: isActive ? brandColor : "transparent",
                                                    color: isActive ? pillTextColor : "#fff",
                                                    borderRadius: radius,
                                                    transition: "background-color 0.3s ease, color 0.3s ease, border-radius 0.3s ease",
                                                    textShadow: isActive ? "none" : "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                                                }}
                                            >
                                                {word}
                                            </span>
                                        );
                                    });
                                } else {
                                    // Muted mode fallback
                                    return words.map((word, idx) => (
                                        <span key={idx} style={{ margin: "0 4px", display: "inline-block" }}>{word}</span>
                                    ));
                                }
                            }
                        })()}
                    </Typography>
                </div>
            )}

            {/* Horizontal Image Slider */}
            <div
                ref={sliderRef}
                style={{
                    flex: 1,
                    display: "flex",
                    overflowX: "auto",
                    overflowY: "hidden",
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                    position: "relative",
                }}
                onScroll={handleScroll}
                onClick={() => {
                    if (mode === "watch") {
                        const newPlaying = !isPlaying;
                        setIsPlaying(newPlaying);

                        if (newPlaying) {
                            setIsTextHidden(false); // Restore text if starting to play
                            // User request: "wait 1500 secs [ms] then hide ui for image play click"
                            setShowControls(true);
                            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                            hideTimeoutRef.current = setTimeout(() => {
                                setShowControls(false);
                            }, 1500);
                            // Do NOT call handleUserInteraction here, as it would reset to 3000ms
                        } else {
                            handleUserInteraction(); // Standard behaivor on pause
                        }
                    } else {
                        handleUserInteraction();
                    }
                }}
            >
                {/* Navigation Arrows (PC/Tablet focus) */}
                {mode === "watch" && showControls && (
                    <>
                        {currentIndex > 0 && (
                            <IconButton
                                onClick={handlePrev}
                                sx={{
                                    position: "fixed",
                                    left: 20,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    zIndex: 35000,
                                    ...glassButtonStyle,
                                    padding: "20px",
                                    borderRadius: "50%",
                                }}
                            >
                                <ArrowBackIosNewIcon sx={{ fontSize: "2rem" }} />
                            </IconButton>
                        )}
                        {currentIndex < images.length - 1 && (
                            <IconButton
                                onClick={handleNext}
                                sx={{
                                    position: "fixed",
                                    right: 20,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    zIndex: 35000,
                                    ...glassButtonStyle,
                                    padding: "20px",
                                    borderRadius: "50%",
                                }}
                            >
                                <ArrowForwardIosIcon sx={{ fontSize: "2rem" }} />
                            </IconButton>
                        )}
                    </>
                )}

                {/* Horizontal Image Slider */}

                {Array.from({ length: totalExpected }).map((_, idx) => {
                    const hdImg = images[idx];
                    const nanoImg = nanoImages?.[idx];
                    const isGenerating = !hdImg;
                    const activelyGenerating = loadersArray ? (loadersArray[idx] > 0) : isGenerating;

                    return (
                    <div
                        key={idx}
                        style={{
                            flex: "0 0 100%",
                            width: "100%",
                            height: "100%",
                            scrollSnapAlign: "start",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: darkMode ? "#000" : "#f0f0f0",
                            position: "relative" // For potential overlays
                        }}
                    >
                        {/* Image Wrapper for relative positioning of Dot */}
                        {isGenerating ? (
                            <div style={{ position: "relative", maxWidth: "100%", maxHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {nanoImg ? (
                                    <img src={nanoImg} alt={`Preview ${idx + 1}`} style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: "10px" }} />
                                ) : (
                                    <div style={{ width: 300, height: "60vh", backgroundColor: "rgba(128,128,128,0.2)", borderRadius: "10px" }} />
                                )}
                                {activelyGenerating && (
                                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", padding: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}>
                                        <CircularProgress size={50} sx={{ color: brandColor }} />
                                    </div>
                                )}
                            </div>
                        ) : (
                        <div style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", display: "flex" }}>
                            <img
                                src={hdImg}
                                alt={`Generated ${idx + 1}`}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "100vh", // prevent overflow
                                    objectFit: "contain",
                                    display: "block",
                                    cursor: mode === "watch" ? "pointer" : "default"
                                }}
                            />

                            {/* Blinking Dot - Positioned Top Left of THIS Image */}
                            {mode === "watch" && isPlaying && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 15, // Offset from image edge
                                        left: 15,
                                        zIndex: 10,
                                        pointerEvents: "none",
                                    }}
                                >
                                    <div style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        backgroundColor: "white",
                                        backdropFilter: "blur(4px)",
                                        border: "1px solid rgba(255,255,255,0.8)",
                                        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                                        animation: "blinkDot 2s infinite ease-in-out",
                                        // The style tag for @keyframes is injected once above or globally,
                                        // or we can inline it here if not present previously.
                                        // Assuming the previous @style block is kept in the render root or we add one here.
                                    }} />
                                    {/* Inline style for animation if not present globally */}
                                    <style>{`
                                        @keyframes blinkDot {
                                            0% { opacity: 0.3; transform: scale(0.8); box-shadow: 0 0 0 rgba(255,255,255,0); }
                                            50% { opacity: 1; transform: scale(1.1); box-shadow: 0 0 15px rgba(255,255,255,0.6), inset 0 0 5px rgba(0,0,0,0.2); }
                                            100% { opacity: 0.3; transform: scale(0.8); box-shadow: 0 0 0 rgba(255,255,255,0); }
                                        }
                                    `}</style>
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                )})}
            </div>

            {/* Blinking Dot Indicator (Only when playing) */}
            {/* The blinking dot is now positioned relative to each image */}
            {/* Audio Picker Overlay */}
            <AudioPicker2
                open={showAudioPicker}
                onClose={() => setShowAudioPicker(false)}
                music={musicUrl}
                setmusic={(url) => setMusicUrl(url)}
                setmusicname={(name) => setMusicName(name)}
                MemeMusic={true}
            />
            {/* Animated Logo Overlay */}
            {mode === "watch" && (
                <div style={{
                    position: "fixed",
                    top: matchMobile ? 20 : 30,
                    left: matchMobile ? 20 : 38,
                    zIndex: 1000,
                    pointerEvents: "none",
                    opacity: logoVisible ? 1 : 0,
                    transform: logoVisible ? "scale(1)" : "scale(0.05)",
                    transition: "opacity 0.8s ease, transform 0.8s ease",
                }}>
                    <div style={{
                        background: brandColor,
                        color: '#000',
                        padding: matchMobile ? '4px 10px' : '6px 14px',
                        borderRadius: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}>
                        <img
                            src={darkMode ? SuperstarzIconDark : SuperstarzIconLight}
                            alt="ClikB Logo"
                            style={{
                                width: matchMobile ? 18 : 22,
                                height: matchMobile ? 18 : 22,
                                marginRight: '0.4rem',
                                filter: darkMode ? "drop-shadow(0 0 8px rgba(255,255,255,0.2))" : "drop-shadow(0 0 8px rgba(0,0,0,0.1))"
                            }}
                        />
                        <span style={{ fontSize: matchMobile ? "0.9rem" : "1.1rem", fontWeight: 800, lineHeight: 1 }}>
                            ClikB
                        </span>
                    </div>
                </div>
            )}

            {/* MP4 Export Status Modal */}
            {isExporting && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0,
                    width: "100%", height: "100%",
                    zIndex: 20000, // Very high
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    backdropFilter: "blur(5px)"
                }}>
                    <div style={{
                        padding: "30px 50px",
                        borderRadius: 20,
                        background: darkMode ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)",
                        backdropFilter: "blur(20px)",
                        border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 20,
                        boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
                    }}>
                        <CircularProgress sx={{ color: brandColor }} />
                        <Typography variant="h6" sx={{ color: textCol, fontWeight: 600 }}>
                            {exportStatus}
                        </Typography>
                        {exportStatus === "Generating Narration..." || exportStatus === "Uploading Images..." ? (
                            <Typography sx={{ fontSize: "0.75rem", color: textCol, opacity: 0.7 }}>
                                Do not leave this window
                            </Typography>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MirrorView;
