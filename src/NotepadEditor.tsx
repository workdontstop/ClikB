// NotepadEditor.tsx â€” Production Grade: Smart Perms + Clean Hardware Release + Smart Scenes + Glass Loader
import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";
import {
    Box,
    Button,
    Typography,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Stack,
    Avatar,
    IconButton,
} from "@mui/material";
// Icons
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { matchMobile } from "./DetectDevice";
import axios from "axios";

import { useCaretInsert } from "./useCaretInsert";
import PromptConstructor from "./components/PromptConstructor";
import { ImagePreview } from "./components/ImagePreview";
import type { ImageGenCache } from "./components/PromptConstructor";
import { Template } from "./PromptConstructorMock";
import { useSelector } from "react-redux";
import { RootState } from "./store";

const LOG = "[NotepadEditor]";
const warn = (...a: any[]) => console.warn(LOG, ...a);
const err = (...a: any[]) => console.error(LOG, ...a);

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const DETECT = {
    START_DELAY_MS: 0,
    SILENCE_HOLD_MS: 5000,
    THRESHOLD_LEVEL: 0.2,
};

// ðŸ”¹ Helpers
function splitCombinedPrompt(value: string): { base: string; scenes: string[] } {
    const scenes = Array(9).fill("");
    if (!value) return { base: "", scenes };

    const lines = value.split("\n");
    let base = "";

    for (const line of lines) {
        if (!line.trim()) continue;
        const m = /^\s*scene\s*(\d+)\s*:\s*(.*)$/i.exec(line);

        if (m) {
            const idx = parseInt(m[1], 10);
            if (idx >= 1 && idx <= 9) {
                scenes[idx - 1] = m[2];
            }
        } else if (!base) {
            base = line;
        } else {
            base += "\n" + line;
        }
    }
    return { base, scenes };
}

function makeCombinedPrompt(base: string, scenes: string[]): string {
    const parts: string[] = [];
    if (base && base.trim()) parts.push(base);
    scenes.forEach((s, i) => {
        if (s && s.trim()) {
            parts.push(`Scene ${i + 1}: ${s}`);
        }
    });
    return parts.join("\n");
}

function formatDurationLabel(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = String(whole % 60).padStart(2, "0");
    return `${mins}:${secs}`;
}

export interface NotepadEditorProps
    extends Omit<
        TextFieldProps,
        "value" | "onChange" | "variant" | "multiline" | "fullWidth"
    > {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    darkMode?: boolean;
    appColor: string;
    placeholder?: string;
    type: any;
    GeneratedImage: any;
    setTextFieldactive: any;
    handleKeyDownx: any;
    onclose: any;
    Caret: any;
    open: any;
    mode?: any;
    showTemplates?: boolean;
    onBrainstormOpenChange?: (open: boolean) => void;
    onTemplateLibraryOpenChange?: (open: boolean) => void;
    cachedImageGen?: ImageGenCache;
    onUpdateCachedImageGen?: (data: ImageGenCache) => void;
    // LIFTED TEMPLATE PROPS
    templateList: Template[];
    onFetchTemplates: (reset?: boolean) => void;
    hasMoreTemplates: boolean;
    onTemplateCreated: () => void;
    onDeleteTemplate: (template: Template) => void;
    referenceImages?: any[];
    detectedCharacters?: any[];
    SelectedModel?: string;
    ImagesHdCloud?: string[];
    musicMode?: boolean;
    musicUrl?: string;
    musicName?: string;
    musicBreakerSec?: 5 | 10;
    onMusicBreakerChange?: (seconds: 5 | 10) => void;
    onMusicSceneCountChange?: (count: number) => void;
    onMusicSegmentsChange?: (segments: { index: number; start: number; end: number }[]) => void;
}

function pickBestMime(): { mime: string; ext: string } {
    const MR: any = (window as any).MediaRecorder;
    const candidates = [
        { mime: "audio/webm;codecs=opus", ext: "webm" },
        { mime: "audio/webm", ext: "webm" },
        { mime: "audio/ogg;codecs=opus", ext: "ogg" },
        { mime: "audio/ogg", ext: "ogg" },
        { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
        { mime: "audio/mp4", ext: "m4a" },
    ];
    if (!MR || typeof MR.isTypeSupported !== "function") {
        return { mime: "audio/webm;codecs=opus", ext: "webm" };
    }
    for (const c of candidates) {
        if (MR.isTypeSupported(c.mime)) return c;
    }
    return { mime: "audio/webm", ext: "webm" };
}

const MemoSceneField = React.memo(({
    idx, sceneText, isThisSceneBusy, handleSceneChange, onclose, handleKeyDownx,
    setTextFieldactive, setActiveField, isActive, bindRef, bindOnSelect, bindOnKeyUp, bindOnClick,
    darkMode, glassOverlaySx
}: any) => {
    return (
        <TextField
            key={idx}
            multiline fullWidth minRows={1} maxRows={3} variant="outlined"
            value={sceneText}
            placeholder={`Scene ${idx + 1}`}
            onChange={(e) => handleSceneChange(idx, e.target.value)}
            onKeyDown={(e: any) => { if (e.key === "Enter") onclose(); handleKeyDownx(e); }}
            onFocus={() => { setTextFieldactive(true); setActiveField(idx + 1); }}
            inputRef={isActive ? bindRef : undefined}
            inputProps={{
                style: { color: darkMode ? "#fff" : "#000", WebkitOverflowScrolling: "touch" },
                autoCorrect: "on", spellCheck: true, autoCapitalize: "sentences", autoComplete: "on",
                onSelect: isActive ? bindOnSelect : undefined,
                onKeyUp: isActive ? bindOnKeyUp : undefined,
                onClick: isActive ? bindOnClick : undefined,
            }}
            InputProps={{
                sx: {
                    mb: 0.5,
                    "& .MuiInputBase-input": { caretColor: "auto !important" },
                    backgroundColor: "transparent",
                    "& .MuiOutlinedInput-root": {
                        alignItems: "flex-start",
                        "& .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)" },
                        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)" },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)" },
                    },
                    position: "relative",
                    ...(isThisSceneBusy ? glassOverlaySx : {}),
                }
            }}
            sx={{
                mb: 0.5,
            }}
        />
    );
}, (prev: any, next: any) => {
    return prev.sceneText === next.sceneText &&
           prev.isActive === next.isActive &&
           prev.isThisSceneBusy === next.isThisSceneBusy &&
           prev.darkMode === next.darkMode;
});

const NotepadEditor: FC<NotepadEditorProps> = ({
    value,
    onChange,
    darkMode,
    appColor,
    type,
    GeneratedImage,
    placeholder,
    setTextFieldactive,
    handleKeyDownx,
    onclose,
    Caret,
    open,
    mode,
    showTemplates,
    onBrainstormOpenChange,
    onTemplateLibraryOpenChange,
    cachedImageGen,
    onUpdateCachedImageGen,
    templateList,
    onFetchTemplates,
    hasMoreTemplates,
    onTemplateCreated,
    onDeleteTemplate,
    referenceImages = [],
    detectedCharacters = [],
    SelectedModel,
    ImagesHdCloud,
    musicMode = false,
    musicUrl = "",
    musicName = "",
    musicBreakerSec = 10,
    onMusicBreakerChange,
    onMusicSceneCountChange,
    onMusicSegmentsChange,
    ...rest
}) => {
    const ratioKey = useSelector((state: RootState) => state.settings.aspectRatio);
    // Mode 1 Split
    const { base: basePrompt, scenes: sceneValues } =
        mode === 1
            ? splitCombinedPrompt(value || "")
            : { base: value || "", scenes: Array(9).fill("") };
    const isMusicPromptMode = Boolean(musicMode && musicUrl && mode === 1);
    const [localMusicBreakerSec, setLocalMusicBreakerSec] = useState<5 | 10>(musicBreakerSec);
    const [musicDurationSec, setMusicDurationSec] = useState(0);
    const [playingMusicSegment, setPlayingMusicSegment] = useState<number | null>(null);
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    const musicStopAtRef = useRef<number | null>(null);
    const activeMusicBreakerSec = onMusicBreakerChange ? musicBreakerSec : localMusicBreakerSec;
    const musicSceneDurationSec = activeMusicBreakerSec * 2;
    const musicSceneCount = isMusicPromptMode
        ? musicDurationSec > 0
            ? Math.max(1, Math.min(9, Math.ceil(musicDurationSec / musicSceneDurationSec)))
            : 1
        : 9;
    const musicSegments = useMemo(() => Array.from({ length: musicSceneCount }, (_, index) => {
        const start = index * musicSceneDurationSec;
        const end = musicDurationSec > 0
            ? Math.min(musicDurationSec, start + musicSceneDurationSec)
            : start + musicSceneDurationSec;
        return { index, start, end };
    }), [musicDurationSec, musicSceneCount, musicSceneDurationSec]);

    // ðŸ”¹ FIX B: Scenes Auto-Open Logic
    const [showScenes, setShowScenes] = useState(false);
    const userToggledScenesRef = useRef(false);
    const [showSceneAvatarsOnly, setShowSceneAvatarsOnly] = useState(false);
    const [zoomImage, setZoomImage] = useState<{ name: string; imageUrl: string } | null>(null);

    // Outside-click collapse logic for Notepad Scenes Mode
    useEffect(() => {
        if (!showSceneAvatarsOnly) return;
        const handleOutsideClick = () => {
            setShowSceneAvatarsOnly(false);
        };
        const timer = setTimeout(() => {
            document.addEventListener("click", handleOutsideClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [showSceneAvatarsOnly]);

    // Reset Scenes Mode when the editor is closed
    useEffect(() => {
        if (!open) {
            setShowSceneAvatarsOnly(false);
        }
    }, [open]);

    useEffect(() => {
        if (!isMusicPromptMode) {
            setPlayingMusicSegment(null);
            musicStopAtRef.current = null;
            setMusicDurationSec(0);
            return;
        }

        setShowScenes(true);
        userToggledScenesRef.current = false;
    }, [isMusicPromptMode, musicUrl]);

    useEffect(() => {
        setLocalMusicBreakerSec(musicBreakerSec);
    }, [musicBreakerSec]);

    useEffect(() => {
        if (!isMusicPromptMode || musicSceneCount >= 9) return;

        const trimmedScenes = [...sceneValues];
        let changed = false;
        for (let i = musicSceneCount; i < trimmedScenes.length; i++) {
            if (trimmedScenes[i]) {
                trimmedScenes[i] = "";
                changed = true;
            }
        }

        if (changed) {
            onChange({ target: { value: makeCombinedPrompt(basePrompt, trimmedScenes) } } as any);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMusicPromptMode, musicSceneCount]);

    useEffect(() => {
        if (!isMusicPromptMode) return;
        onMusicSceneCountChange?.(musicSceneCount);
    }, [isMusicPromptMode, musicSceneCount, onMusicSceneCountChange]);

    useEffect(() => {
        if (!isMusicPromptMode) {
            onMusicSegmentsChange?.([]);
            return;
        }
        onMusicSegmentsChange?.(musicSegments);
    }, [isMusicPromptMode, musicSegments, onMusicSegmentsChange]);

    useEffect(() => {
        const audio = musicAudioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const stopAt = musicStopAtRef.current;
            if (stopAt !== null && audio.currentTime >= stopAt) {
                audio.pause();
                audio.currentTime = stopAt;
                musicStopAtRef.current = null;
                setPlayingMusicSegment(null);
            }
        };

        const handleEnded = () => {
            musicStopAtRef.current = null;
            setPlayingMusicSegment(null);
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);
        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("ended", handleEnded);
        };
    }, [musicUrl]);

    const playMusicSegment = (segmentIndex: number, start: number, end: number) => {
        const audio = musicAudioRef.current;
        if (!audio || !musicUrl) return;

        if (playingMusicSegment === segmentIndex && !audio.paused) {
            audio.pause();
            musicStopAtRef.current = null;
            setPlayingMusicSegment(null);
            return;
        }

        audio.currentTime = start;
        musicStopAtRef.current = end;
        setPlayingMusicSegment(segmentIndex);
        audio.play().catch(() => {
            musicStopAtRef.current = null;
            setPlayingMusicSegment(null);
        });
    };

    // Effect 1: On open/mode change, check if we should show scenes immediately
    useEffect(() => {
        if (!open) return;
        // Reset toggle memory on fresh open
        userToggledScenesRef.current = false;

        if (mode !== 1) {
            setShowScenes(false);
            return;
        }

        if (isMusicPromptMode) {
            setShowScenes(true);
            return;
        }

        const { scenes } = splitCombinedPrompt(value || "");
        const hasScenes = scenes.some((s) => (s ?? "").trim().length > 0);
        setShowScenes(hasScenes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, isMusicPromptMode]);

    // Effect 2: If data hydrates later, auto-open unless user explicitly closed it
    useEffect(() => {
        if (!open) return;
        if (mode !== 1) return;
        if (isMusicPromptMode) {
            setShowScenes(true);
            return;
        }
        if (userToggledScenesRef.current) return; // Respect user choice

        const { scenes } = splitCombinedPrompt(value || "");
        const hasScenes = scenes.some((s) => (s ?? "").trim().length > 0);
        if (hasScenes) setShowScenes(true);
    }, [value, open, mode]);

    const [isCarouselExpanded, setIsCarouselExpanded] = useState(false);
    const carouselTimerRef = useRef<number | null>(null);
    const ignoreBlurRef = useRef<boolean>(false);

    const kickCarouselTimer = () => {
        if (carouselTimerRef.current) window.clearTimeout(carouselTimerRef.current);
        carouselTimerRef.current = window.setTimeout(() => {
            setIsCarouselExpanded(false);
        }, 20000);
    };

    useEffect(() => {
        if (isCarouselExpanded) {
            kickCarouselTimer();
        } else {
            if (carouselTimerRef.current) window.clearTimeout(carouselTimerRef.current);
        }
        return () => {
            if (carouselTimerRef.current) window.clearTimeout(carouselTimerRef.current);
        };
    }, [isCarouselExpanded]);

    const [activeCharTags, setActiveCharTags] = useState<string[]>([]);

    // Performant regex tracker for highlighting character Avatars
    useEffect(() => {
        const currentActive: string[] = [];
        const allChars = [...(referenceImages || [])];
        if (ImagesHdCloud) {
            ImagesHdCloud.forEach((url, i) => {
                if (url) {
                    allChars.push({
                        name: `Scene ${i + 1}`,
                        imageUrl: url
                    });
                }
            });
        }
        if (allChars.length === 0) {
            setActiveCharTags([]);
            return;
        }
        allChars.forEach((ref: any) => {
            if (!ref.name) return;
            const rawName = String(ref.name).trim();
            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");

            const words = rawName.split(/[\s\-]+/);
            const flexibleNamePattern = words.map(w => escapeRegExp(w)).join('[\\s\\-]*');

            const regex = new RegExp(`(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)`, "i");
            if (regex.test(value || "")) {
                currentActive.push(ref.name);
            }
        });
        setActiveCharTags(currentActive);
    }, [value, referenceImages, ImagesHdCloud]);

    const [isRecording, setIsRecording] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [recordMs, setRecordMs] = useState(0);

    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    const [level, setLevel] = useState(0);

    const [noInputWarning, setNoInputWarning] = useState(false);
    const [showDetectionBanner, setShowDetectionBanner] = useState<boolean>(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const streamRef = useRef<MediaStream | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const meterRAF = useRef<number | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isClearConfirming, setIsClearConfirming] = useState(false);
    const clearConfirmTimerRef = useRef<number | null>(null);

    const isBusy = isUploading || isTranscribing;

    const { bind, insertAtCaret, setCaretPosition } = useCaretInsert();
    const timerRef = useRef<number | null>(null);
    const detectionTimerRef = useRef<number | null>(null);
    const isRecordingRef = useRef(false);

    // 0 = base, 1..9 = Scene index
    const [activeField, setActiveField] = useState<number>(0);

    useEffect(() => {
        if (Caret === null || Caret === undefined) return;
        if (!open) return;
        setCaretPosition(Caret);
    }, [open]);

    // ðŸ”¹ FIX A: Remove getUserMedia from mount. No permission popup on load.
    useEffect(() => {
        (async () => {
            await refreshDevices(); // Just enumerate, don't ask yet.
        })();
        return () => {
            cleanupAll();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!open) cleanupAll();
    }, [open]);

    async function refreshDevices() {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const mics = list.filter((d) => d.kind === "audioinput");
            setDevices(mics);
            // If previously selected device is gone, or none selected, pick first
            if (!selectedDeviceId && mics[0]?.deviceId)
                setSelectedDeviceId(mics[0].deviceId);
        } catch (e) {
            warn("enumerateDevices failed:", e);
        }
    }

    function cleanupAll() {
        try {
            mediaRecorderRef.current?.stop();
        } catch { }
        try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        streamRef.current = null;

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (detectionTimerRef.current) {
            window.clearTimeout(detectionTimerRef.current);
            detectionTimerRef.current = null;
        }
        if (clearConfirmTimerRef.current) {
            window.clearTimeout(clearConfirmTimerRef.current);
            clearConfirmTimerRef.current = null;
        }
        if (meterRAF.current) {
            cancelAnimationFrame(meterRAF.current);
            meterRAF.current = null;
        }
        try {
            analyserRef.current?.disconnect();
        } catch { }
        analyserRef.current = null;

        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => { });
        }
        audioCtxRef.current = null;

        setShowDetectionBanner(false);
        setNoInputWarning(false);
        isRecordingRef.current = false;
    }

    // Timer
    useEffect(() => {
        if (!isRecording) return;
        const start = Date.now();
        timerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - start;
            setRecordMs(elapsed);
            if (elapsed >= 6 * 60 * 1000) {
                stopRecording();
            }
        }, 100) as unknown as number;

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRecording]);

    function startMeter(stream: MediaStream) {
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Float32Array(analyser.fftSize);
        let ema = 0;
        const ALPHA = 0.35;

        const startTs = performance.now();
        let lastTs = startTs;
        let silentMs = 0;
        let armed = false;
        let stoppedFromSilence = false;

        const loop = () => {
            const now = performance.now();
            const dt = Math.max(0, now - lastTs);
            lastTs = now;

            analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
            const rms = Math.sqrt(sum / data.length);

            ema = ALPHA * rms + (1 - ALPHA) * ema;
            const lvl = Math.min(1, ema * 3);
            setLevel(lvl);

            if (!armed && now - startTs >= DETECT.START_DELAY_MS) armed = true;

            if (armed && !stoppedFromSilence && isRecordingRef.current) {
                if (lvl <= DETECT.THRESHOLD_LEVEL) {
                    silentMs += dt;
                } else {
                    silentMs = 0;
                }
                if (silentMs >= DETECT.SILENCE_HOLD_MS) {
                    stoppedFromSilence = true;
                    stopRecording();
                }
            } else {
                silentMs = 0;
            }
            meterRAF.current = requestAnimationFrame(loop);
        };
        meterRAF.current = requestAnimationFrame(loop);
    }

    const LOCAL_KEY_LAST_AUDIO = "clik_last_uploaded_audio";

    // --- Helpers for upload/transcribe ---
    async function GenerateSignedUrlForSingleAudio(audioBlob: Blob) {
        if (!audioBlob) throw new Error("No audio Blob to generate a signed URL.");
        const contentType = (audioBlob.type || "application/octet-stream").toLowerCase();
        const pickExt = (ct: string) => {
            if (ct.includes("webm")) return "webm";
            if (ct.includes("ogg")) return "ogg";
            if (ct.includes("wav")) return "wav";
            if (ct.includes("mp4") || ct.includes("m4a")) return "m4a";
            if (ct.includes("mpeg") || ct.includes("mp3") || ct.includes("mpga")) return "mp3";
            return "dat";
        };
        const ext = pickExt(contentType);
        const { data }: any = await axios.post(
            `${CLIK_URL}/get_signed_url_audioStoryx`,
            { values: { count: 1, contentType, ext } },
            { withCredentials: true }
        );
        const holder = data?.holder;
        if (!holder || !Array.isArray(holder) || holder.length !== 1) throw new Error("Invalid response");
        const { urlAudio } = holder[0] || {};
        if (!urlAudio) throw new Error("Missing signed URL");
        return { urlAudio, contentType, ext };
    }

    async function startDeleteAudio(audioUrl: string) {
        try {
            await axios.post(`${CLIK_URL}/del-audio`, { url: audioUrl }, { withCredentials: true });
        } catch (err) { }
    }

    async function uploadSingleAudioToS3(audioBlob: Blob): Promise<string> {
        const prevUrl = localStorage.getItem(LOCAL_KEY_LAST_AUDIO);
        if (prevUrl) {
            try { await startDeleteAudio(prevUrl); } catch { }
            localStorage.removeItem(LOCAL_KEY_LAST_AUDIO);
        }
        setIsUploading(true);
        const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);
        await axios.put(urlAudio, audioBlob, {
            headers: { "Content-Type": audioBlob.type || "audio/mpeg" },
            withCredentials: false,
        });
        const finalAudioUrl = urlAudio.split("?")[0];
        setIsUploading(false);
        localStorage.setItem(LOCAL_KEY_LAST_AUDIO, finalAudioUrl);
        return finalAudioUrl;
    }

    async function transcribeFromS3Url(audioUrl: string, language = "en"): Promise<string> {
        if (!audioUrl) throw new Error("Missing audioUrl");
        setIsTranscribing(true);
        const endpoint = `${CLIK_URL}/transcribeMiniRoute`;
        const doPost = async () => {
            const { data, status }: any = await axios.post(
                endpoint,
                { audioUrl, language },
                { withCredentials: true }
            );
            setIsTranscribing(false);
            if (status === 200) return data?.text ?? "";
            if (status === 202) {
                await new Promise((r) => setTimeout(r, 1500));
                const second: any = await axios.post(
                    endpoint,
                    { audioUrl, language },
                    { withCredentials: true }
                );
                return second?.data?.text ?? "";
            }
            return "";
        };
        try {
            return await doPost();
        } catch (err: any) {
            setIsTranscribing(false);
            return "";
        }
    }

    async function handleUploadAndTranscribe(
        audioBlob: Blob,
        currentText: string,
        onChangeField: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) {
        const finalAudioUrl = await uploadSingleAudioToS3(audioBlob);
        let transcript: any = "";
        try {
            transcript = await transcribeFromS3Url(finalAudioUrl, "en");
        } catch (e: any) {
            setIsUploading(false);
            setIsTranscribing(false);
        }

        if (typeof transcript === "string" && transcript.trim()) {
            const text: any = currentText ?? "";
            const padded: any = " " + transcript + " ";
            insertAtCaret(text, padded, (next: any) => {
                onChangeField({ target: { value: next } } as any);
            });
        }
    }

    // ðŸ”¹ FIX D: Permission on Trigger only
    const startRecording = async () => {
        if (isStarting || isRecording) return;
        setIsStarting(true);

        try {
            if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
                alert("Microphone requires HTTPS (or localhost).");
                return;
            }

            const MR: any = (window as any).MediaRecorder;
            if (!MR) {
                alert("MediaRecorder not supported.");
                return;
            }

            // Always request fresh stream (guarantees permission check or uses granted permission)
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            // Re-enumerate to get labels now that permission is granted
            await refreshDevices();

            if (detectionTimerRef.current) {
                window.clearTimeout(detectionTimerRef.current);
                detectionTimerRef.current = null;
            }
            setShowDetectionBanner(false);
            setNoInputWarning(false);
            isRecordingRef.current = true;

            startMeter(stream);

            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }

            const { mime } = pickBestMime();

            let mr: MediaRecorder;
            try {
                mr = new MediaRecorder(stream, { mimeType: mime });
            } catch (e) {
                mr = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = mr;
            const effective = (mr as any).mimeType || mime;
            audioChunksRef.current = [];
            mr.ondataavailable = (evt: BlobEvent) => {
                if (evt.data && evt.data.size > 0)
                    audioChunksRef.current.push(evt.data);
            };

            mr.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: effective });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                const combinedNow = value ?? "";
                const { base, scenes } =
                    mode === 1
                        ? splitCombinedPrompt(combinedNow)
                        : { base: combinedNow, scenes: [] };

                // Determine text based on ACTIVE field at stop
                const currentFieldText =
                    mode === 1
                        ? activeField === 0
                            ? base
                            : scenes[activeField - 1] || ""
                        : combinedNow;

                try {
                    await handleUploadAndTranscribe(
                        blob,
                        currentFieldText,
                        (e: React.ChangeEvent<HTMLInputElement>) => {
                            const newText = (e.target as any).value ?? "";
                            if (mode !== 1) {
                                onChange(e);
                            } else {
                                const latestCombined = value ?? "";
                                const { base: curBase, scenes: curScenes } = splitCombinedPrompt(latestCombined);
                                let nextBase = curBase;
                                const nextScenes = [...curScenes];

                                if (activeField === 0) {
                                    nextBase = newText;
                                } else if (activeField >= 1 && activeField <= 9) {
                                    nextScenes[activeField - 1] = newText;
                                }

                                const combinedNext = makeCombinedPrompt(nextBase, nextScenes);
                                onChange({ target: { value: combinedNext } } as any);
                            }
                        }
                    );
                } catch (uploadErr) {
                    err("Upload/Transcribe flow failed:", uploadErr);
                }
            };

            mr.start();
            setIsRecording(true);
            setRecordMs(0);
        } catch (e) {
            err("startRecording error:", e);
            // Don't alert if user just cancelled
            if (String(e).includes("Permission denied")) {
                alert("Microphone permission denied.");
            }
            isRecordingRef.current = false;
        } finally {
            setIsStarting(false);
        }
    };

    // ðŸ”¹ FIX C: Stop tracks on STOP (Proper hardware release)
    const stopRecording = () => {
        if (!isRecording && !isRecordingRef.current) return;
        isRecordingRef.current = false;

        try {
            mediaRecorderRef.current?.stop();
        } catch { }

        // KILL the stream so the rgb(0,0,0,0.05) dot goes away immediately
        try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        streamRef.current = null;

        if (meterRAF.current) {
            cancelAnimationFrame(meterRAF.current);
            meterRAF.current = null;
        }
        try {
            analyserRef.current?.disconnect();
        } catch { }
        analyserRef.current = null;

        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => { });
        }
        audioCtxRef.current = null;

        if (detectionTimerRef.current) {
            window.clearTimeout(detectionTimerRef.current);
            detectionTimerRef.current = null;
        }
        setShowDetectionBanner(false);
        setNoInputWarning(false);
        setIsRecording(false);
    };

    const handleClearClick = () => {
        if (isClearConfirming) {
            if (clearConfirmTimerRef.current) {
                window.clearTimeout(clearConfirmTimerRef.current);
                clearConfirmTimerRef.current = null;
            }
            setIsClearConfirming(false);
            onChange({ target: { value: "" } } as any);
        } else {
            setIsClearConfirming(true);
            clearConfirmTimerRef.current = window.setTimeout(() => {
                setIsClearConfirming(false);
                clearConfirmTimerRef.current = null;
            }, 5000);
        }
    };

    const mm = Math.floor(recordMs / 60000);
    const ss = Math.floor((recordMs % 60000) / 1000).toString().padStart(2, "0");

    const flowColorsBright = darkMode
        ? "linear-gradient(120deg, rgba(232,186,250,0.50), rgba(200,160,240,0.40), rgba(232,186,250,0.35), rgba(180,140,220,0.40), rgba(232,186,250,0.50))"
        : "linear-gradient(120deg, rgba(0,153,204,0.50), rgba(0,120,180,0.40), rgba(0,153,204,0.35), rgba(0,100,160,0.40), rgba(0,153,204,0.50))";

    // ðŸ”¹ Reusable Glass Loader Style
    const glassOverlaySx = {
        "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: flowColorsBright,
            backgroundSize: "300% 300%",
            animation: "riverFlowSpeech 4s linear infinite",
            opacity: 0.14,
            pointerEvents: "none",
        }
    };

    const normalizeScenesForMusic = (scenes: string[]) => {
        if (!isMusicPromptMode) return scenes;
        return scenes.map((scene, index) => index < musicSceneCount ? scene : "");
    };

    const handleBaseChange = (newBase: string) => {
        if (mode === 1) {
            const combined = makeCombinedPrompt(newBase, normalizeScenesForMusic(sceneValues));
            onChange({ target: { value: combined } } as any);
        } else {
            onChange({ target: { value: newBase } } as any);
        }
    };

    const handleSceneChange = (index: number, newText: string) => {
        if (mode !== 1) return;
        const newScenes = [...sceneValues];
        newScenes[index] = newText;
        const combined = makeCombinedPrompt(basePrompt, normalizeScenesForMusic(newScenes));
        onChange({ target: { value: combined } } as any);
    };

    const handleToggleCharacter = (charName: string, isActivated: boolean) => {
        ignoreBlurRef.current = true;
        const rawName = String(charName).trim();
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");

        const words = rawName.split(/[\s\-]+/);
        const flexibleNamePattern = words.map(w => escapeRegExp(w)).join('[\\s\\-]*');

        let currentText = "";
        let updater: (newText: string) => void;

        if (mode === 1) {
            if (activeField === 0) {
                currentText = basePrompt;
                updater = handleBaseChange;
            } else {
                currentText = sceneValues[activeField - 1] || "";
                updater = (newVal) => handleSceneChange(activeField - 1, newVal);
            }
        } else {
            currentText = value || "";
            updater = (newVal) => onChange({ target: { value: newVal } } as any);
        }

        if (isActivated) {
            const regex = new RegExp(`\\s*(${escapeRegExp(handle)}|@\\b${flexibleNamePattern}\\b)\\b`, "gi");
            const matchIndex = currentText.search(regex);

            let newText = currentText.replace(regex, " ").replace(/\s{2,}/g, " ").trim();
            updater(newText);

            if (matchIndex !== -1) {
                setTimeout(() => setCaretPosition(matchIndex), 50);
            }
        } else {
            insertAtCaret(currentText, ` ${handle} `, (next: any) => {
                updater(next);
            });
        }

        setTimeout(() => { ignoreBlurRef.current = false; }, 150);
    };

    // State for PromptConstructor preview loading (to show glass loader)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

    // Handler for PromptConstructor text injection with SWAP support
    const handleInjectText = (injectedText: string, oldText?: string) => {
        let current = value || "";

        // If oldText is provided, remove it first (template swap)
        if (oldText && current.includes(oldText)) {
            current = current.replace(oldText, "").trim();
        }

        // Prepend new text
        const newValue = current.trim()
            ? injectedText + " " + current
            : injectedText;
        onChange({ target: { value: newValue } } as any);
    };

    // Combined busy state (includes preview loading)
    const combinedBusy = isBusy || isPreviewLoading;

    // Ref and state for container height calculation
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number>(0);

    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight);
            }
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    return (
        <Box
            ref={containerRef}
            sx={{
                display: "flex", flexDirection: "column", gap: 0, width: "100%",
                height: "100%", // Fill DialogContent
                position: "relative", // Root for absolute overlays
                overflowX: "hidden", overflowY: "hidden",
                // Glassmorphism styling moved to parent Dialog (Notepad.tsx) to ensure uniform header/footer color
                // Thin transparent scrollbar for all scrollable children
                "& *::-webkit-scrollbar": { width: "5px", height: "5px" },
                "& *::-webkit-scrollbar-track": { background: "transparent" },
                "& *::-webkit-scrollbar-thumb": {
                    background: darkMode ? "rgba(232,186,250,0.18)" : "rgba(0,153,204,0.18)",
                    borderRadius: "10px",
                    "&:hover": {
                        background: darkMode ? "rgba(232,186,250,0.35)" : "rgba(0,153,204,0.35)",
                    },
                },
                // Firefox
                "& *": { scrollbarWidth: "thin", scrollbarColor: darkMode ? "rgba(232,186,250,0.18) transparent" : "rgba(0,153,204,0.18) transparent" },
            }}>

            {/* PromptConstructor - Templates/AI Brainstorm/Preview */}
            <Box sx={{
                flex: 'none',
                minHeight: (!showTemplates) ? 0 : (mode === 1 ? 100 : 80),
                display: (!showTemplates && (!previewImage || !matchMobile))
                    ? 'none'
                    : 'block',
                order: { xs: 2, md: 1 }
            }}>
                <PromptConstructor
                    darkMode={darkMode ?? false}
                    onInjectText={handleInjectText}
                    currentNotepadText={value || ""}
                    onLoadingChange={setIsPreviewLoading}
                    containerHeight={containerHeight}
                    onImageGenerated={setPreviewImage}
                    onImageClear={() => setPreviewImage(null)}
                    showTemplates={showTemplates}
                    notepadType={type}
                    onBrainstormOpenChange={onBrainstormOpenChange}
                    onTemplateLibraryOpenChange={onTemplateLibraryOpenChange}
                    cachedImageGen={cachedImageGen}
                    onUpdateCachedImageGen={onUpdateCachedImageGen}
                    // LIFTED PROPS (now from parent Notepad.tsx)
                    templates={templateList}
                    onFetchTemplates={() => onFetchTemplates(false)}
                    hasMoreTemplates={hasMoreTemplates}
                    onTemplateCreated={onTemplateCreated}
                    onDeleteTemplate={onDeleteTemplate}
                />
            </Box>

            {/* Scrollable Body Section */}
            <Box sx={{ flex: 1, overflowY: "auto", px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1, order: { xs: 1, md: 2 } }}>
                {isMusicPromptMode && (
                    <Box
                        sx={{
                            mb: 1.5,
                            p: { xs: 1.25, sm: 1.5 },
                            borderRadius: 3,
                            background: darkMode ? "rgba(10,10,10,0.38)" : "rgba(255,255,255,0.28)",
                            border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.45)",
                            backdropFilter: "blur(22px) saturate(130%)",
                        }}
                    >
                        <audio
                            ref={musicAudioRef}
                            src={musicUrl}
                            preload="metadata"
                            onLoadedMetadata={(event) => {
                                const nextDuration = Number.isFinite(event.currentTarget.duration)
                                    ? event.currentTarget.duration
                                    : 0;
                                setMusicDurationSec(nextDuration);
                            }}
                            style={{ display: "none" }}
                        />

                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            sx={{ mb: 1, minWidth: 0 }}
                        >
                            <MusicNoteIcon sx={{ color: appColor === "yellow" ? "#e8bafa" : "#0099cc", flexShrink: 0 }} />
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    color: darkMode ? "#fff" : "#111",
                                    fontWeight: 900,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                }}
                            >
                                {musicName || "Music"}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)",
                                    fontWeight: 800,
                                    flexShrink: 0,
                                }}
                            >
                                {formatDurationLabel(musicDurationSec)} / {musicSceneCount} scenes
                            </Typography>
                        </Stack>

                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "repeat(2, minmax(0, 1fr))",
                                    sm: `repeat(${Math.min(musicSegments.length, 5)}, minmax(0, 1fr))`,
                                },
                                gap: 0.75,
                            }}
                        >
                            {musicSegments.map((segment) => {
                                const isPlayingSegment = playingMusicSegment === segment.index;
                                const segmentBackground = darkMode ? "rgba(255,255,255,0.92)" : "rgba(10,10,10,0.88)";
                                const segmentHoverBackground = darkMode ? "#fff" : "rgba(0,0,0,0.96)";
                                const segmentTextColor = darkMode ? "#111" : "#fff";
                                const segmentBorderColor = isPlayingSegment
                                    ? (appColor === "yellow" ? "#e8bafa" : "#0099cc")
                                    : (darkMode ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.16)");
                                return (
                                    <Button
                                        key={segment.index}
                                        onClick={() => playMusicSegment(segment.index, segment.start, segment.end)}
                                        startIcon={isPlayingSegment ? <PauseIcon /> : <PlayArrowIcon />}
                                        sx={{
                                            minWidth: 0,
                                            justifyContent: "flex-start",
                                            textTransform: "none",
                                            color: segmentTextColor,
                                            background: segmentBackground,
                                            border: `1px solid ${segmentBorderColor}`,
                                            borderRadius: 2,
                                            px: 1,
                                            py: 0.8,
                                            boxShadow: isPlayingSegment
                                                ? `0 0 0 1px ${segmentBorderColor}, 0 0 18px ${segmentBorderColor}55`
                                                : "none",
                                            "& .MuiButton-startIcon": {
                                                mr: 0.5,
                                                minWidth: 18,
                                            },
                                            "&:hover": {
                                                background: segmentHoverBackground,
                                            },
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0, textAlign: "left" }}>
                                            <Typography sx={{ fontSize: "0.74rem", fontWeight: 900, lineHeight: 1.1 }}>
                                                Scene {segment.index + 1}
                                            </Typography>
                                            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, opacity: 0.82, lineHeight: 1.1 }}>
                                                {formatDurationLabel(segment.start)}-{formatDurationLabel(segment.end)}
                                            </Typography>
                                        </Box>
                                    </Button>
                                );
                            })}
                        </Box>

                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            spacing={1}
                            sx={{ mt: 1 }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    color: darkMode ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.62)",
                                    fontWeight: 800,
                                }}
                            >
                                Time breaker
                            </Typography>
                            <Stack direction="row" spacing={0.75}>
                                {[5, 10].map((seconds) => {
                                    const active = activeMusicBreakerSec === seconds;
                                    return (
                                        <Button
                                            key={seconds}
                                            size="small"
                                            variant={active ? "contained" : "outlined"}
                                            onClick={() => {
                                                const nextBreaker = seconds as 5 | 10;
                                                setLocalMusicBreakerSec(nextBreaker);
                                                onMusicBreakerChange?.(nextBreaker);
                                                setPlayingMusicSegment(null);
                                                musicAudioRef.current?.pause();
                                                musicStopAtRef.current = null;
                                            }}
                                            sx={{
                                                minWidth: 58,
                                                color: active ? "#000" : "#fff",
                                                borderColor: darkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.45)",
                                                backgroundColor: active
                                                    ? (appColor === "yellow" ? "#e8bafa" : "#0099cc")
                                                    : "rgba(10,10,10,0.42)",
                                                textTransform: "none",
                                                fontWeight: 900,
                                                "&:hover": {
                                                    backgroundColor: active
                                                        ? (appColor === "yellow" ? "#f0ccff" : "#12addd")
                                                        : "rgba(20,20,20,0.62)",
                                                },
                                            }}
                                        >
                                            {seconds}s
                                        </Button>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    </Box>
                )}

                {/* Top Bar */}
                <Stack direction="row" spacing={1} sx={{ mb: 2, top: '0vh' }}>
                    {mode === 1 && (
                        <Button
                            fullWidth
                            variant={showScenes ? "contained" : "outlined"}
                            onClick={() => {
                                if (isMusicPromptMode) {
                                    setShowScenes(true);
                                    return;
                                }
                                userToggledScenesRef.current = true;
                                setShowScenes(!showScenes);
                            }}
                            startIcon={<ViewModuleIcon />}
                            sx={{
                                width: matchMobile ? '40%' : '10%',
                                textTransform: "none", fontWeight: 600,
                                borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)",
                                color: showScenes ? "#000" : "#fff",
                                backgroundColor: showScenes ? "rgba(255,255,255,0.8)" : "rgba(10,10,10,0.45)",
                                backdropFilter: "blur(18px)",
                                "&:hover": {
                                    borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)",
                                    backgroundColor: showScenes ? "#ffffff" : "rgba(25,25,25,0.55)",
                                }
                            }}
                        >
                            Scenes
                        </Button>
                    )}
                    <Button
                        fullWidth
                        variant={isClearConfirming ? "contained" : "outlined"}
                        color={isClearConfirming ? "error" : "primary"}
                        onClick={handleClearClick}
                        startIcon={isClearConfirming ? <DeleteForeverIcon /> : null}
                        sx={{
                            width: matchMobile ? '40%' : '10%',
                            textTransform: "none", fontWeight: 600,
                            borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)",
                            backgroundColor: isClearConfirming ? "rgba(255,0,0,0.3)" : "rgba(10,10,10,0.45)",
                            backdropFilter: "blur(18px)",
                            color: "#fff",
                            "&:hover": { borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)", backgroundColor: isClearConfirming ? "rgba(255,0,0,0.5)" : "rgba(25,25,25,0.55)" }
                        }}
                    >
                        {isClearConfirming ? "Erase" : "Clear All"}
                    </Button>
                </Stack>

                {/* Mic Controls */}
                <Box sx={{ display: isRecording ? "flex" : "none", gap: 1, alignItems: "center", paddingTop: "2vh" }}>
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id="mic-label">Microphone</InputLabel>
                        <Select
                            labelId="mic-label"
                            label="Microphone"
                            value={selectedDeviceId}
                            sx={{ color: darkMode ? "#cccccc" : "#222222", opacity: darkMode ? 0.55 : 0.92 }}
                            onChange={(e) => setSelectedDeviceId(e.target.value as string)}
                        >
                            {devices.map((d) => (
                                <MenuItem key={d.deviceId || "default"} value={d.deviceId}>
                                    {d.label || "Default microphone"}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Box sx={{
                        flex: 1, height: 10, borderRadius: 999,
                        background: darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)", overflow: "hidden"
                    }}>
                        <Box sx={{
                            width: `${Math.min(100, Math.round(level * 100))}%`, height: "100%", position: "relative", transition: "width 80ms linear",
                            "&::before": {
                                content: '""', position: "absolute", inset: 0, background: flowColorsBright,
                                backgroundSize: "300% 300%", animation: "riverFlowSpeech 4s linear infinite",
                                filter: "saturate(1.2) brightness(1.15)",
                            },
                        }} />
                    </Box>
                </Box>

                {/* Hidden Banners/Player */}
                {showDetectionBanner && <Box role="status" aria-live="polite" sx={{ display: "none" }}>Audio detection enabled.</Box>}
                {noInputWarning && <Box role="status" aria-live="polite" sx={{ display: "none" }}><strong style={{ opacity: 0.9 }}>No input detected.</strong></Box>}
                {audioUrl && (<Box sx={{ display: "none" }}><audio key={audioUrl} ref={audioRef} src={audioUrl} controls /></Box>)}

                {/* ðŸ”¹ CHARACTER SLIDER UI */}
                {(placeholder === "Enter a Prompt To Recreate The Image" || placeholder === "Enter Video Prompt" || placeholder === "Use Auto Prompt / Enter Video Prompt") && ((referenceImages && referenceImages.length > 0) || (ImagesHdCloud && ImagesHdCloud.some(url => !!url))) && (
                    <Box
                        tabIndex={-1}
                        onBlur={(e: React.FocusEvent) => {
                            // removed onBlur focus handling per user request
                            // so circles deactivate only based on timer/inactivity
                        }}
                        sx={{
                        position: "relative",
                        mb: 1,
                        mt: 1,
                        display: "flex",
                        alignItems: "center",
                        overflowX: "auto",
                        overflowY: "hidden",
                        minHeight: isCarouselExpanded ? (matchMobile ? 190 : 240) : 100,
                        transition: "min-height 0.3s ease",
                        width: "100%",
                        zIndex: 10,
                        padding: 1,
                        background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                        borderRadius: 3,
                        border: darkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)",
                    }}>
                        {/* Scenes Toggle Button inside Notepad slider */}
                        {ImagesHdCloud && ImagesHdCloud.some(url => !!url) && (
                            <Box sx={{
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                mr: 2,
                                flexShrink: 0
                            }}>
                                <Avatar
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSceneAvatarsOnly(prev => !prev);
                                    }}
                                    sx={{
                                        width: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                        height: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                        cursor: "pointer",
                                        bgcolor: showSceneAvatarsOnly
                                            ? (appColor === "yellow" ? "rgba(232,186,250,0.4)" : "rgba(0,153,204,0.4)")
                                            : (darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                                        border: (() => {
                                            const hasSelectedScene = activeCharTags.some(tag => String(tag).startsWith("Scene "));
                                            return showSceneAvatarsOnly || hasSelectedScene
                                                ? `3px solid ${appColor === "yellow" ? "#e8bafa" : "#0099cc"}`
                                                : (darkMode ? '1.5px dashed rgba(255,255,255,0.4)' : '1.5px dashed rgba(0,0,0,0.4)');
                                        })(),
                                        boxShadow: (() => {
                                            const hasSelectedScene = activeCharTags.some(tag => String(tag).startsWith("Scene "));
                                            return showSceneAvatarsOnly || hasSelectedScene
                                                ? `0 0 15px ${appColor === "yellow" ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)"}`
                                                : "none";
                                        })(),
                                        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                        "&:hover": {
                                            transform: "translateY(-4px) scale(1.05)",
                                        }
                                    }}
                                >
                                    <EmojiPeopleIcon sx={{
                                        color: darkMode ? '#fff' : '#000',
                                        fontSize: isCarouselExpanded ? 48 : 32
                                    }} />
                                </Avatar>
                                {isCarouselExpanded && (
                                    <Typography variant="caption" sx={{
                                        mt: 1,
                                        fontWeight: "bold",
                                        color: darkMode ? "#ffffff" : "#000000",
                                        textShadow: darkMode ? "0px 2px 4px rgba(0,0,0,0.8)" : "none"
                                    }}>
                                        Scenes Mode
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {showSceneAvatarsOnly ? (
                            // Render scene avatars when Scenes Mode is active in Notepad
                            ImagesHdCloud && ImagesHdCloud.map((url: string, idx: number) => {
                                if (!url) return null;
                                const sceneName = `Scene ${idx + 1}`;
                                const isActivated = activeCharTags.includes(sceneName);
                                return (
                                    <Box key={`scene-${idx}`} sx={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        ml: isCarouselExpanded ? (idx === 0 ? 0 : 2) : (idx === 0 ? 0 : -2.5),
                                        transition: "all 0.3s ease",
                                    }}>
                                        <Avatar
                                            src={url}
                                            alt={sceneName}
                                            imgProps={{ style: { objectPosition: 'top' } }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isCarouselExpanded) {
                                                    setIsCarouselExpanded(true);
                                                    return;
                                                }
                                                kickCarouselTimer();
                                                handleToggleCharacter(sceneName, isActivated);
                                            }}
                                            sx={{
                                                width: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                height: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                border: isActivated
                                                    ? `3px solid ${appColor === "yellow" ? "#e8bafa" : "#0099cc"}`
                                                    : `2px solid rgba(255,255,255,0.15)`,
                                                boxShadow: isActivated ? `0 0 15px ${appColor === "yellow" ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)"}` : 3,
                                                transform: isActivated && !isCarouselExpanded ? "scale(1.05)" : "scale(1)",
                                                cursor: "pointer",
                                                opacity: isActivated ? 1 : 0.6,
                                                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                                "&:hover": {
                                                    transform: "translateY(-4px) scale(1.05)",
                                                    zIndex: 20,
                                                }
                                            }}
                                        />
                                        {isCarouselExpanded && (
                                            <Box sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                mt: 1,
                                                maxWidth: matchMobile ? 154 : 192,
                                                gap: 0.5
                                            }}>
                                                {/* Tiny Zoom Icon */}
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: sceneName, imageUrl: url });
                                                    }}
                                                    sx={{
                                                        p: 0.25,
                                                        color: darkMode ? "#fff" : "#000",
                                                        bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                                        '&:hover': { bgcolor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }
                                                    }}
                                                >
                                                    <ZoomInIcon sx={{ fontSize: "1.1rem" }} />
                                                </IconButton>

                                                {/* Larger Interactive Clickable Name */}
                                                <Typography
                                                    variant="caption"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: sceneName, imageUrl: url });
                                                    }}
                                                    sx={{
                                                        fontWeight: "bold",
                                                        color: darkMode ? "#ffffff" : "#000000",
                                                        textAlign: "center",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        textShadow: darkMode ? "0px 2px 4px rgba(0,0,0,0.8)" : "none",
                                                        cursor: "pointer",
                                                        fontSize: "0.84rem", // 5% larger than 0.8rem typical caption (0.8 * 1.05 = 0.84rem)
                                                        '&:hover': { textDecoration: 'underline', color: appColor === "yellow" ? "#e8bafa" : "#0099cc" }
                                                    }}
                                                >
                                                    {sceneName}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })
                        ) : (
                            // Render standard characters
                            referenceImages && referenceImages.map((ref: any, idx: number) => {
                                // Find matching detected character definition
                                const charDef = detectedCharacters?.find((dc: any) => dc.name === ref.name);

                                if (ref.isMotion && SelectedModel === 'pPro') {
                                    return null;
                                }

                                const isActivated = activeCharTags.includes(ref.name);
                                const isUnsupportedModel = SelectedModel === 'Proxx' || SelectedModel === 'Mini' || SelectedModel === 'Prox';

                                const isDisabled = isUnsupportedModel;

                                return (
                                    <Box key={idx} sx={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        ml: isCarouselExpanded ? (idx === 0 ? 0 : 2) : (idx === 0 ? 0 : -2.5),
                                        transition: "all 0.3s ease",
                                        pointerEvents: isDisabled ? "none" : "auto",
                                    }}>
                                        <Avatar
                                            src={ref.imageUrl}
                                            alt={ref.name}
                                            imgProps={{ style: { objectPosition: 'top' } }}
                                            onClick={() => {
                                                if (!isCarouselExpanded) {
                                                    setIsCarouselExpanded(true);
                                                    return;
                                                }

                                                kickCarouselTimer();
                                                handleToggleCharacter(ref.name, isActivated);
                                            }}
                                            sx={{
                                                width: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                height: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                border: isActivated && !isUnsupportedModel
                                                    ? `3px solid ${appColor === "yellow" ? "#e8bafa" : "#0099cc"}`
                                                    : `2px solid rgba(255,255,255,0.15)`,
                                                boxShadow: isActivated && !isUnsupportedModel ? `0 0 15px ${appColor === "yellow" ? "rgba(232,186,250,0.6)" : "rgba(0,153,204,0.6)"}` : 3,
                                                transform: isUnsupportedModel ? "scale(0.4)" : (isActivated && !isCarouselExpanded ? "scale(1.05)" : "scale(1)"),
                                                cursor: isDisabled ? "default" : "pointer",
                                                opacity: isActivated ? 1 : 0.6,
                                                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                                "&:hover": {
                                                    transform: isUnsupportedModel ? "scale(0.4)" : "translateY(-4px) scale(1.05)",
                                                    zIndex: isUnsupportedModel ? 1 : 20,
                                                }
                                            }}
                                        />
                                        {isCarouselExpanded && (
                                            <Box sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                mt: 1,
                                                maxWidth: matchMobile ? 154 : 192,
                                                gap: 0.5
                                            }}>
                                                {/* Tiny Zoom Icon */}
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: ref.name, imageUrl: ref.imageUrl });
                                                    }}
                                                    sx={{
                                                        p: 0.25,
                                                        color: darkMode ? "#fff" : "#000",
                                                        bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                                        '&:hover': { bgcolor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }
                                                    }}
                                                >
                                                    <ZoomInIcon sx={{ fontSize: "1.1rem" }} />
                                                </IconButton>

                                                {/* Larger Interactive Clickable Name */}
                                                <Typography
                                                    variant="caption"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: ref.name, imageUrl: ref.imageUrl });
                                                    }}
                                                    sx={{
                                                        fontWeight: "bold",
                                                        color: darkMode ? "#ffffff" : "#000000",
                                                        textAlign: "center",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        textShadow: darkMode ? "0px 2px 4px rgba(0,0,0,0.8)" : "none",
                                                        cursor: "pointer",
                                                        fontSize: "0.84rem", // 5% larger than 0.8rem typical caption (0.8 * 1.05 = 0.84rem)
                                                        '&:hover': { textDecoration: 'underline', color: appColor === "yellow" ? "#e8bafa" : "#0099cc" }
                                                    }}
                                                >
                                                    {ref.name}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })
                        )}
                        {isCarouselExpanded && (
                            <Box sx={{ ml: "auto", pl: 2, display: "flex", alignItems: "center" }}>
                                <Button size="small" variant="outlined" onClick={() => setIsCarouselExpanded(false)} sx={{ color: darkMode ? "#fff" : "#000", borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)", borderRadius: 5 }}>
                                    Collapse
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

                {/* ðŸ”¹ MAIN TEXT AREAS WITH SMART LOADING */}
                <Box sx={{ position: "relative" }}>
                    <Box sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 1.5,
                        alignItems: { xs: "center", md: "stretch" },
                        width: "100%"
                    }}>
                        {mode === 1 && showScenes && (
                            <Box sx={{
                                flex: matchMobile ? "none" : 1,
                                maxHeight: matchMobile ? "30vh" : "60vh",
                                overflowY: "auto",
                                width: matchMobile ? '100%' : 'auto',
                                order: matchMobile ? 2 : 1
                            }}>
                                {sceneValues.slice(0, musicSceneCount).map((sceneText, idx) => {
                                    const isThisSceneBusy = combinedBusy && activeField === (idx + 1);
                                    const isActive = activeField === idx + 1;
                                    return (
                                        <MemoSceneField
                                            key={idx}
                                            idx={idx}
                                            sceneText={sceneText}
                                            isThisSceneBusy={isThisSceneBusy}
                                            handleSceneChange={handleSceneChange}
                                            onclose={onclose}
                                            handleKeyDownx={handleKeyDownx}
                                            setTextFieldactive={setTextFieldactive}
                                            setActiveField={setActiveField}
                                            isActive={isActive}
                                            bindRef={bind.inputRef}
                                            bindOnSelect={bind.onSelect}
                                            bindOnKeyUp={bind.onKeyUp}
                                            bindOnClick={bind.onClick}
                                            darkMode={darkMode}
                                            glassOverlaySx={glassOverlaySx}
                                        />
                                    );
                                })}
                            </Box>
                        )}

                        {(previewImage || isPreviewLoading) && (
                            <Box sx={{
                                flex: matchMobile ? '0 0 auto' : (mode === 1 && showScenes ? 0.7 : 0.2),
                                width: matchMobile ? '100%' : '8vh',
                                height: matchMobile ? 'auto' : 'auto',
                                alignSelf: 'stretch',
                                order: matchMobile ? 2 : 3
                            }}>
                                <ImagePreview
                                    previewImage={previewImage}
                                    isGenerating={isPreviewLoading}
                                    handleBackToGallery={() => setPreviewImage(null)}
                                    darkMode={darkMode ?? false}
                                    appColor={appColor || 'yellow'}
                                    glassStyle={{
                                        background: 'transparent',
                                        backdropFilter: 'none',
                                        border: 'none',
                                        borderRadius: '0px',
                                        boxShadow: 'none'
                                    }}
                                    ratioKey={ratioKey}
                                    isExpanded={isPreviewExpanded}
                                    onToggleExpand={() => setIsPreviewExpanded(!isPreviewExpanded)}
                                    containerHeight={containerHeight}
                                    topAlign={matchMobile}
                                />
                            </Box>
                        )}

                        <Box sx={{
                            flex: matchMobile ? '0 0 auto' : 1.5,
                            width: matchMobile ? '100%' : '100%',
                            order: matchMobile ? 1 : 2
                        }}>
                            {mode === 1 ? (
                                <TextField
                                    autoFocus multiline fullWidth minRows={4} maxRows={matchMobile ? 10 : 20} variant="outlined"
                                    value={basePrompt}
                                    onKeyDown={(e: any) => { if (e.key === "Enter") onclose(); handleKeyDownx(e); }}
                                    onChange={(e) => handleBaseChange(e.target.value)}
                                    placeholder={placeholder}
                                    onFocus={() => { setTextFieldactive(true); setActiveField(0); }}
                                    inputRef={activeField === 0 ? bind.inputRef : undefined}
                                    inputProps={{
                                        style: { WebkitOverflowScrolling: "touch", maxHeight: matchMobile ? "45vh" : undefined, overflowY: matchMobile ? "auto" : undefined },
                                        autoCorrect: "on", spellCheck: true, autoCapitalize: "sentences", autoComplete: "on",
                                        onSelect: activeField === 0 ? bind.onSelect : undefined,
                                        onKeyUp: activeField === 0 ? bind.onKeyUp : undefined,
                                        onClick: activeField === 0 ? bind.onClick : undefined,
                                    }}
                                    InputProps={{
                                        sx: {
                                            alignItems: "flex-start", color: darkMode ? "#fff" : "#000",
                                            fontSize: matchMobile ? "1.2rem" : "1.4rem",
                                            "& textarea, & input": { caretColor: "auto !important" },
                                            "& textarea::placeholder": { fontSize: matchMobile ? "1rem" : "1.35rem" },
                                            position: "relative",
                                            ...(combinedBusy && activeField === 0 ? glassOverlaySx : {}),
                                        },
                                    }}
                                    sx={{
                                        flex: 1,
                                        "& .MuiOutlinedInput-root": {
                                            backgroundColor: "transparent",
                                            alignItems: "flex-start",
                                            "& .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)" },
                                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)" },
                                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)" },
                                        },
                                    }}
                                    {...rest}
                                />
                            ) : (
                                <TextField
                                    autoFocus multiline fullWidth minRows={4} maxRows={matchMobile ? 10 : 20} variant="outlined"
                                    value={value}
                                    onKeyDown={(e: any) => { if (e.key === "Enter") onclose(); handleKeyDownx(e); }}
                                    onChange={onChange}
                                    placeholder={placeholder}
                                    onFocus={() => { setTextFieldactive(true); setActiveField(0); }}
                                    inputRef={bind.inputRef}
                                    inputProps={{
                                        style: { WebkitOverflowScrolling: "touch", maxHeight: matchMobile ? "45vh" : undefined, overflowY: matchMobile ? "auto" : undefined },
                                        autoCorrect: "on", spellCheck: true, autoCapitalize: "sentences", autoComplete: "on",
                                        onSelect: bind.onSelect, onKeyUp: bind.onKeyUp, onClick: bind.onClick,
                                    }}
                                    InputProps={{
                                        sx: {
                                            alignItems: "flex-start", color: darkMode ? "#fff" : "#000",
                                            fontSize: matchMobile ? "1.2rem" : "1.4rem",
                                            "& textarea, & input": { caretColor: "auto !important" },
                                            "& textarea::placeholder": { fontSize: matchMobile ? "1rem" : "1.35rem" },
                                            position: "relative",
                                            ...(combinedBusy ? glassOverlaySx : {}),
                                        },
                                    }}
                                    sx={{
                                        flex: 1,
                                        "& .MuiOutlinedInput-root": {
                                            alignItems: "flex-start",
                                            backgroundColor: "transparent",
                                            "& .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)" },
                                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)" },
                                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)" },
                                        },
                                    }}
                                    {...rest}
                                />
                            )}
                        </Box>
                    </Box>

                    {isBusy && (
                        <Box sx={{ mt: 0.75 }}>
                            <Box sx={{
                                height: 6, width: "100%", borderRadius: 999, position: "relative", overflow: "hidden",
                                background: darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
                                "&::before": {
                                    content: '""', position: "absolute", inset: 0, background: flowColorsBright, backgroundSize: "300% 300%",
                                    animation: "riverFlowSpeech 4s linear infinite", filter: "saturate(1.25) brightness(1.2)",
                                },
                            }} />
                            <Typography variant="caption" sx={{ mt: 0.5, display: "none", textAlign: "center", color: darkMode ? "#fff" : "#000", opacity: 0.8, fontWeight: 600 }}>
                                {isUploading ? "Uploading audioâ€¦" : "Transcribingâ€¦"}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Rec Buttons */}
            {
                !isRecording ? (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: "auto", pt: 1, pb: 2, order: 3 }}>
                        <Button
                            onClick={startRecording}
                            disabled={isStarting}
                            aria-label="Start recording"
                            sx={{
                                width: matchMobile ? 72 : 84, height: matchMobile ? 72 : 84, borderRadius: "50%",
                                backgroundColor: darkMode ? "rgba(232,186,250,0.15)" : "rgba(0,153,204,0.15)", backdropFilter: "blur(18px)", border: darkMode ? "2px solid rgba(232,186,250,0.3)" : "2px solid rgba(0,153,204,0.3)",
                                color: darkMode ? "#fff" : "#000", fontWeight: 700, fontSize: matchMobile ? "0.95rem" : "1.05rem",
                                boxShadow: darkMode ? "0 0 20px rgba(232,186,250,0.15)" : "0 0 20px rgba(0,153,204,0.15)", "&:hover": { backgroundColor: darkMode ? "rgba(232,186,250,0.25)" : "rgba(0,153,204,0.25)" }, opacity: isStarting ? 0.7 : 1,
                            }}
                        >
                            {isStarting ? "â€¦" : "REC"}
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ mt: "auto", pt: 1, pb: 2, borderRadius: 2, backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`, order: 3 }}>
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                            <Button
                                onClick={stopRecording}
                                aria-label="Stop recording"
                                sx={{
                                    width: matchMobile ? 72 : 84, height: matchMobile ? 72 : 84, borderRadius: "50%",
                                    backgroundColor: darkMode ? "rgba(232,186,250,0.15)" : "rgba(0,153,204,0.15)", backdropFilter: "blur(18px)", border: darkMode ? "2px solid rgba(232,186,250,0.3)" : "2px solid rgba(0,153,204,0.3)",
                                    color: darkMode ? "#fff" : "#000", fontWeight: 800, fontSize: matchMobile ? "0.95rem" : "1.05rem", boxShadow: darkMode ? "0 0 20px rgba(232,186,250,0.15)" : "0 0 20px rgba(0,153,204,0.15)",
                                    "&:hover": { backgroundColor: darkMode ? "rgba(232,186,250,0.3)" : "rgba(0,153,204,0.3)" },
                                }}
                            >
                                STOP
                            </Button>
                        </Box>
                        <Box sx={{
                            height: 8, width: "100%", borderRadius: 999, position: "relative", overflow: "hidden",
                            background: darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
                            "&::before": {
                                content: '""', position: "absolute", inset: 0, background: flowColorsBright, backgroundSize: "300% 300%",
                                animation: "riverFlowSpeech 4s linear infinite", filter: "saturate(1.25) brightness(1.2)",
                            },
                        }} />
                        <Box sx={{ mt: 1, display: "flex", justifyContent: "center" }}>
                            <Typography variant="body2" sx={{ color: darkMode ? "#fff" : "#000", fontWeight: 700 }}>
                                Recordingâ€¦ {mm}:{ss}
                            </Typography>
                        </Box>
                    </Box>
                )
            }
            {zoomImage && (
                <NotepadFullscreenZoom
                    open={!!zoomImage}
                    imageObj={zoomImage}
                    onClose={() => {
                        setZoomImage(null);
                        setShowSceneAvatarsOnly(true);
                        setIsCarouselExpanded(true);
                    }}
                />
            )}
        </Box>
    );
};

// Fullscreen Zoom Popup for Notepad Mode (Self-contained Modal)
const NotepadFullscreenZoom: FC<{
    open: boolean;
    imageObj: { name: string; imageUrl: string } | null;
    onClose: () => void;
}> = ({ open, imageObj, onClose }) => {
    if (!open || !imageObj) return null;
    return (
        <Box
            onClick={onClose}
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0,0,0,0.9)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2,
                zIndex: 9999999
            }}
        >
            <IconButton
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                sx={{
                    position: 'absolute',
                    top: { xs: 10, sm: 20 },
                    right: { xs: 10, sm: 20 },
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.15)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.3)',
                        borderColor: '#fff'
                    },
                    width: 44,
                    height: 44
                }}
            >
                <CloseIcon />
            </IconButton>
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    position: 'relative',
                    maxWidth: '95%',
                    height: '80dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <img
                    src={imageObj.imageUrl}
                    alt={imageObj.name}
                    style={{
                        height: '100%',
                        width: 'auto',
                        borderRadius: 8,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }}
                />
                <Box sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    px: 3,
                    py: 1.2,
                    borderRadius: 3,
                    backdropFilter: 'blur(8px)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    mt: 2.5,
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    {imageObj.name}
                </Box>
            </Box>
        </Box>
    );
};

export default React.memo(NotepadEditor);
