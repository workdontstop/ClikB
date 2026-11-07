import React, { useCallback, useEffect, useRef, useState } from "react";
import { Slider, Stack, useMediaQuery, useTheme } from "@mui/material";
// import { matchMobile } from "./your‑vars"  ← user will add the real import

import { matchMobile } from "./DetectDevice";

import axios from "axios";

import { useSelector } from "react-redux";
import { RootState } from "./store";


import {
    Button,
    Box,
    Typography,
    CircularProgress,
    IconButton,

} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { setLoggedUser } from "./profileSlice";
import { SaveAudioHelperForDelLater } from './SavepromptHelpersLocal';
import type { AudioReference } from '../server/src/audioReference';




/* ──────────────────────────────────────────────────────
 * AudioPickerPlayer – <audio> element + hidden‑thumb trim slider
 * --------------------------------------------------------------------------
 * • Thumbs + timestamp labels are visually hidden.
 * • Slider rail/thickness grows on mobile (`matchMobile`).
 * • Trim window fixed at exactly 15 s (or full audio if shorter).
 * --------------------------------------------------------------------------
 */


export interface AudioPickerPlayerProps {
    src: any;
    accentColor?: string;
    onEnded?: () => void;
    onTrimChange?: (start: number, end: number) => void;
    AudioName: any;
    setGotmp3: any;
    callMusic: any;
    onAudioReady?: (audioUrl: string, audioName: any) => void;
    // Music-video mode: show how the trimmed length maps to scenes/stages.
    showSceneBreakdown?: boolean;
    breakerSec?: 5 | 10;
    onBreakerChange?: (seconds: 5 | 10) => void;
    referenceDuration?: number;
    referenceStart?: number;
    onReferenceReady?: (reference: AudioReference) => void | Promise<void>;
}

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const MIN_TRIM_SECONDS = 10;

const AudioPickerPlayer: React.FC<AudioPickerPlayerProps> = ({
    src,
    accentColor,
    onEnded,
    onTrimChange,
    AudioName,
    setGotmp3,
    callMusic,
    onAudioReady,
    showSceneBreakdown = false,
    breakerSec = 5,
    onBreakerChange,
    referenceDuration,
    referenceStart,
    onReferenceReady,
}) => {
    // Time breaker lives here so the scene pills recalculate instantly; the
    // parent is told through onBreakerChange when it cares.
    const [localBreakerSec, setLocalBreakerSec] = useState<5 | 10>(breakerSec);
    useEffect(() => { setLocalBreakerSec(breakerSec); }, [breakerSec]);
    const activeBreakerSec = localBreakerSec;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const audioRef = useRef<HTMLAudioElement>(null);
    const [duration, setDuration] = useState<number>(0);
    const [referenceError, setReferenceError] = useState('');
    const [trim, setTrim] = useState<[number, number]>([0, 0]);


    const [isLoading, setisLoading] = useState(false);
    const [LoadData, setLoadData] = useState('');


    const [OriginalAudio, setOriginalAudio] = useState('');

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );

    const darkMode = darkModeReducer;
    // Accent follows the user's configurable app color from Redux settings
    // (dark/light aware); old hardcoded values remain only as fallbacks.
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appAccent = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? "#E8BAFA" : "#0099cc");
    const appAccentText = darkMode ? "#000000" : "#ffffff";
    const resolvedAccentColor = accentColor ?? appAccent;


    const loggedUser = useSelector(
        (state: RootState) => state.profile.loggedUser
    );


    /* ─────────── sync source */
    useEffect(() => {
        if (!audioRef.current || !src) return;
        audioRef.current.pause();
        audioRef.current.src = src;
        audioRef.current.load();
    }, [src]);

    /* ─────────── load meta */
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const meta = () => {
            const d = Number.isFinite(el.duration) ? el.duration : 0;
            setDuration(d);
            // Start at 55% of the song so the trim pill never covers the whole
            // rail — the app-coloured base stays visible on the right.
            const maxWindow = showSceneBreakdown ? 9 * activeBreakerSec * 2 : Infinity;
            const initialEnd = referenceDuration ? Math.min(d, referenceDuration) : d > 0
                ? Math.min(d, maxWindow, Math.max(Math.min(d, MIN_TRIM_SECONDS), d * 0.55))
                : d;
            const initialStart = referenceDuration ? Math.max(0, Math.min(referenceStart || 0, d - initialEnd)) : 0;
            setTrim([initialStart, initialStart + initialEnd]);
            onTrimChange?.(initialStart, initialStart + initialEnd);
        };
        el.addEventListener("loadedmetadata", meta);
        return () => el.removeEventListener("loadedmetadata", meta);
    }, [src, referenceDuration, referenceStart]);

    /* ─────────── clamp playback */
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const t = () => {
            const [s, e] = trim;
            if (el.currentTime < s) el.currentTime = s;
            if (el.currentTime > e) {
                el.pause();
                el.currentTime = e;
                onEnded?.();
            }
        };
        el.addEventListener("timeupdate", t);
        return () => el.removeEventListener("timeupdate", t);
    }, [trim, onEnded]);

    /* ─────────── trim window
       In music-video mode the story is capped at 9 scenes, and a scene is
       breaker × 2 long — so the selectable music maxes out at 9 × 20s = 3:00
       (or 1:30 on a 5s breaker). Enforced here so no drag can exceed it.   */
    const maxTrimSeconds = showSceneBreakdown ? 9 * activeBreakerSec * 2 : Infinity;

    const clampTrimWindow = (start: number, end: number): [number, number] => {
        if (referenceDuration) {
            const length = Math.min(duration, referenceDuration);
            const offset = Math.max(0, Math.min(start, duration - length));
            return [offset, offset + length];
        }
        const safeStart = Math.max(0, Math.min(start, duration));
        let safeEnd = Math.max(safeStart, Math.min(end, duration));
        if (safeEnd - safeStart > maxTrimSeconds) {
            safeEnd = safeStart + maxTrimSeconds;
        }
        return [safeStart, safeEnd];
    };


    /* ─────────── clamp & loop playback */
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const handle = () => {
            const [s, e] = trim;

            /* keep pointer in window */
            if (el.currentTime < s) el.currentTime = s;

            /* restart when we hit the right-edge */
            if (el.currentTime >= e) {
                el.currentTime = s;  // jump back to start15
                el.play();           // resume immediately
            }
        };

        el.addEventListener("timeupdate", handle);
        return () => el.removeEventListener("timeupdate", handle);
    }, [trim]);


    /* ─────────── slider handlers */
    const handleChange = (_: Event, val: number | number[]) => {
        if (!Array.isArray(val)) return;
        const [s, e] = val as number[];
        setTrim(clampTrimWindow(s, e));
    };

    const handleCommit = () => {
        onTrimChange?.(trim[0], trim[1]);
        if (audioRef.current) audioRef.current.currentTime = trim[0];
    };

    /* ─────────── middle-drag only
       Edges keep their ORIGINAL behaviour: the Slider handles them, so
       dragging either end to grow or shrink the window works exactly as
       before. We only intercept presses in the MIDDLE of the pill, which
       the Slider would otherwise treat as "jump the nearest edge here" —
       there we drag the whole window instead, keeping its length.          */
    const trimTrackRef = useRef<HTMLDivElement | null>(null);
    const EDGE_GRAB_PX = 22;

    const handleTrimTap = (event: React.PointerEvent<HTMLDivElement>) => {
        if (duration <= 0) return;
        const host = trimTrackRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        if (rect.width <= 0) return;

        // We own every press on this track. The Slider's thumbs are hidden, so
        // letting it handle presses made it jump the nearest edge to the end —
        // which is why the window could grow to the full song and never shrink.
        event.preventDefault();
        event.stopPropagation();

        const [startAtGrab, endAtGrab] = trim;
        const windowLength = Math.max(0, endAtGrab - startAtGrab);
        const pxPerSecond = rect.width / duration;
        const startPx = rect.left + startAtGrab * pxPerSecond;
        const endPx = rect.left + endAtGrab * pxPerSecond;

        const timeAt = (clientX: number) => {
            const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            return ratio * duration;
        };

        // Which handle did the user grab?
        const distanceToLeft = Math.abs(event.clientX - startPx);
        const distanceToRight = Math.abs(event.clientX - endPx);
        const insidePill = event.clientX > startPx && event.clientX < endPx;

        let dragMode: "start" | "end" | "move";
        if (distanceToLeft <= EDGE_GRAB_PX && distanceToLeft <= distanceToRight) {
            dragMode = "start";
        } else if (distanceToRight <= EDGE_GRAB_PX) {
            dragMode = "end";
        } else if (insidePill) {
            dragMode = "move";
        } else {
            // Outside the pill: extend the nearer edge to meet the press.
            dragMode = event.clientX < startPx ? "start" : "end";
        }

        const grabOffsetSec = timeAt(event.clientX) - startAtGrab;

        const applyAt = (clientX: number): [number, number] => {
            const pointerTime = timeAt(clientX);
            let nextStart = startAtGrab;
            let nextEnd = endAtGrab;

            if (dragMode === "start") {
                nextStart = Math.min(pointerTime, endAtGrab);
            } else if (dragMode === "end") {
                nextEnd = Math.max(pointerTime, startAtGrab);
            } else {
                nextStart = Math.max(0, Math.min(duration - windowLength, pointerTime - grabOffsetSec));
                nextEnd = nextStart + windowLength;
            }

            const clamped = clampTrimWindow(nextStart, nextEnd);
            setTrim(clamped);
            return clamped;
        };

        applyAt(event.clientX);

        const handleMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            applyAt(moveEvent.clientX);
        };

        const handleUp = (upEvent: PointerEvent) => {
            const finalTrim = applyAt(upEvent.clientX);
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleUp);
            onTrimChange?.(finalTrim[0], finalTrim[1]);
            if (audioRef.current) audioRef.current.currentTime = finalTrim[0];
        };

        window.addEventListener("pointermove", handleMove, { passive: false });
        window.addEventListener("pointerup", handleUp);
        window.addEventListener("pointercancel", handleUp);
    };

    /* ─────────── music-video scenes inside the trim window
       One scene = stage A + stage B, so scene length = breaker × 2.
       Segments are derived from the CURRENT trim, so they follow the pill
       live as it is dragged or resized.                                    */
    const trimSegments = React.useMemo(() => {
        if (!showSceneBreakdown) return [];
        const [start, end] = trim;
        const trimmed = Math.max(0, end - start);
        const sceneDurationSec = activeBreakerSec * 2;
        if (trimmed <= 0 || sceneDurationSec <= 0) return [];

        const sceneCount = Math.max(1, Math.min(9, Math.ceil(trimmed / sceneDurationSec)));
        return Array.from({ length: sceneCount }, (_, index) => {
            const segmentStart = start + index * sceneDurationSec;
            const segmentEnd = Math.min(end, segmentStart + sceneDurationSec);
            return {
                index,
                start: segmentStart,
                end: segmentEnd,
                label: `Scene ${index + 1}`,
            };
        });
    }, [showSceneBreakdown, trim, activeBreakerSec]);

    const [playingSegment, setPlayingSegment] = useState<number | null>(null);
    const segmentStopAtRef = useRef<number | null>(null);

    const playSegment = (index: number, start: number, end: number) => {
        const el = audioRef.current;
        if (!el) return;

        if (playingSegment === index) {
            el.pause();
            setPlayingSegment(null);
            segmentStopAtRef.current = null;
            return;
        }

        segmentStopAtRef.current = end;
        setPlayingSegment(index);
        el.currentTime = start;
        void el.play().catch(() => setPlayingSegment(null));
    };

    // Stop a segment preview when it reaches its own end.
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const watch = () => {
            const stopAt = segmentStopAtRef.current;
            if (stopAt === null) return;
            if (el.currentTime >= stopAt) {
                el.pause();
                segmentStopAtRef.current = null;
                setPlayingSegment(null);
            }
        };
        el.addEventListener("timeupdate", watch);
        return () => el.removeEventListener("timeupdate", watch);
    }, []);

    // Live preview: 4s after the trim stops changing, play from the new start.
    useEffect(() => {
        if (!showSceneBreakdown) return;
        const el = audioRef.current;
        if (!el || duration <= 0) return;

        const previewTimer = setTimeout(() => {
            segmentStopAtRef.current = trim[1];
            setPlayingSegment(null);
            el.currentTime = trim[0];
            void el.play().catch(() => { });
        }, 4000);

        return () => clearTimeout(previewTimer);
    }, [showSceneBreakdown, trim, duration]);

    const formatTrimClock = (seconds: number) => {
        const safe = Math.max(0, Math.floor(seconds || 0));
        const mins = Math.floor(safe / 60);
        const secs = safe % 60;
        return `${mins}:${String(secs).padStart(2, "0")}`;
    };

    /* ─────────── sizes */
    // `matchMobile` should be provided by the caller; fallback to 12 if undefined
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const rail = isMobile ? 50 : 40;


    const buttonPadding = { px: 3, py: 1.5 };


    // 1️⃣ Generate a presigned upload URL for ONE audio blob
    const GenerateSignedUrlForSingleAudio = async (audioBlob: Blob) => {
        if (!audioBlob) throw new Error("No audio Blob to generate a signed URL.");

        const requestData = { values: { count: 1 } };

        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_audioStory`,
            requestData,
            { withCredentials: true }
        );

        const holder = response.data.holder;
        if (!holder || !Array.isArray(holder) || holder.length !== 1)
            throw new Error("Invalid response from signed-URL endpoint.");

        const { urlAudio } = holder[0];
        if (!urlAudio) {
            throw new Error("Missing signed URL for audio.");

            setisLoading(false);

        }

        return { urlAudio }; // e.g. { urlAudio: "https://..." }
    };

    // 2️⃣ Upload a single (original) audio file to S3 and return its final URL
    const uploadOriginalAudioToS3 = useCallback(async (localAudioUrl: any): Promise<any> => {
        const totalTrim = Math.max(0, trim[1] - trim[0]);
        if (totalTrim <= 0) {
            alert('Select an audio range first');
            return null;
        }

        if (onReferenceReady && (totalTrim < 2 || totalTrim > Math.min(15, referenceDuration || 15) + .15)) {
            setReferenceError('Choose audio lasting at least 2 seconds, up to the video duration.'); return null;
        }
        if (!onReferenceReady && totalTrim < MIN_TRIM_SECONDS) {
            alert(`Audio Too Short Minimum Length: ${MIN_TRIM_SECONDS}secs`);
            return null;
        }

            setisLoading(true);
            setLoadData('Uploading')
            // Convert local/remote URL to Blob
            const audioBlob = await fetch(localAudioUrl).then((r) => r.blob());

            // Get presigned URL
            const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);

            // Upload to S3
            await axios.put(urlAudio, audioBlob, {
                headers: { "Content-Type": audioBlob.type || "audio/mpeg" },
            });

            // Strip query params → final S3 path
            const finalAudioUrl = urlAudio.split("?")[0];
            if (onReferenceReady) SaveAudioHelperForDelLater(finalAudioUrl);


            setOriginalAudio(finalAudioUrl);

            await createTrimmedAudio(finalAudioUrl);
            // TODO: optionally persist `postId`, `enhanceCaption`, finalAudioUrl to DB

            return finalAudioUrl; // usable S3 path
    }, [trim, onReferenceReady, referenceDuration])




    // 3️⃣ Request MediaConvert (or backend) to cut the clip  
    //    POST → `${CLIK_URL}/create-trimaudio`
    // 1️⃣  place this near the top of your component
    const [trimmedAudioUrl, setTrimmedAudioUrl] = useState<string | null>(null);

    // 2️⃣  update createTrimmedAudio
    const createTrimmedAudio = useCallback(
        async (originalAudio: string) => {

            setisLoading(true);
            setLoadData('Trimming-Audio')


            const dataForTranscode = {
                originalAudio,
                start: trim[0],
                end: trim[1],
                outputBucket: "s3://clikbatebucket/videos/",
            };

            try {
                const res = await axios.post(
                    `${CLIK_URL}/${onReferenceReady ? 'create-lipsync-trimaudio' : 'create-trimaudio'}`,
                    dataForTranscode,
                    { withCredentials: true }
                );

                // backend responds { audioUrl: "https://bucket.s3....mp3", ... }
                const { audioUrl } = res.data as { audioUrl: string };

                // 3️⃣  save it in state
                setTrimmedAudioUrl(audioUrl);

                // alert(audioUrl);


                if (onReferenceReady) {
                    SaveAudioHelperForDelLater(audioUrl);
                    await onReferenceReady({ url: audioUrl, sourceUrl: originalAudio, start: Number(trim[0].toFixed(3)), name: String(AudioName || 'Audio'), duration: Number((trim[1] - trim[0]).toFixed(3)), enabled: true });
                    setisLoading(false);
                } else await saveToDatabase(audioUrl);

                // optional: also return it
                return audioUrl;
            } catch (err) {

                setisLoading(false);

                console.error("Trim-audio request failed:", err);
                throw err;
            }
        },
        [trim, onReferenceReady, AudioName]
    );


    const saveToDatabase = useCallback(
        async (Audio: string) => {
            const dataForTranscode = {
                values: {
                    id: loggedUser?.id ?? null,
                    audio: Audio,
                    AudioName: AudioName
                },
            };


            setisLoading(true);
            setLoadData('Saving')


            try {
                const res = await axios.post(
                    `${CLIK_URL}/savemusic`,
                    dataForTranscode,
                    { withCredentials: true }
                );

                if (res.status === 200) {
                    ///alert('good');
                }


                callMusic();
                onAudioReady?.(Audio, AudioName);
                setisLoading(false);

                setTimeout(() => {

                    setGotmp3(false);
                }, 500)



            } catch (err) {
                setisLoading(false);

                console.error("Trim-audio request failed:", err);
                throw err;
            }
        },
        [loggedUser, AudioName, callMusic, onAudioReady]
    );




    return (


        <>

            {isLoading ? (
                <div
                    style={{
                        position: "fixed",
                        top: "0vh",
                        zIndex: 9999,

                        width: matchMobile ? "100%" : "100%",
                        left: matchMobile ? "0px" : "-0vw",
                        height: "100vh",
                        textAlign: "center",
                        color: "#ffffff",
                        backgroundColor: "rgb(0,0,0,0.45)",
                    }}
                >
                    {" "}
                    <div
                        style={{
                            marginTop: "20vh",
                        }}
                    >
                        {" "}
                        {LoadData}{" "}
                    </div>{" "}
                </div>
            ) : null}

            <Stack spacing={4} sx={{
                width: "100%", margin: 'auto',
                textAlign: 'auto',
            }}>
                {referenceError && <Typography role="alert" color="error">{referenceError}</Typography>}
                <audio ref={audioRef} controls loop style={{ width: "100%", accentColor: resolvedAccentColor, marginTop: isMobile ? '8vh' : '5vh' }} />

                {duration > 0 && (
                    <Stack spacing={1} sx={{ width: "100%" }}>
                    <Box
                        ref={trimTrackRef}
                        onPointerDownCapture={handleTrimTap}
                        sx={{ width: "100%", cursor: "pointer", touchAction: "none", py: 1 }}
                    >
                    <Slider
                        value={trim}
                        min={0}
                        max={duration}
                        step={0.1}
                        disableSwap
                        onChange={handleChange}
                        onChangeCommitted={handleCommit}
                        sx={{
                            color: resolvedAccentColor,
                            height: rail,
                            // Visual only — the wrapper owns all pointer input.
                            pointerEvents: "none",
                            // Full-width base is the app color; the selected trim
                            // window sits on top in black so the chosen length
                            // reads clearly against it.
                            "& .MuiSlider-rail": {
                                height: rail,
                                backgroundColor: resolvedAccentColor,
                                opacity: 1,
                            },
                            "& .MuiSlider-track": {
                                height: rail,
                                backgroundColor: "#000000",
                                // Thin white outline so the trim pill reads
                                // clearly against the app-coloured rail.
                                border: "1px solid #ffffff",
                                opacity: 1,
                                boxSizing: "border-box",
                            },
                            "& .MuiSlider-thumb": {
                                width: 0,
                                height: 0,
                                p: 0,
                                m: 0,
                                visibility: "hidden",
                            },
                        }}
                    />
                    </Box>

                    {/* Trim readout — shown in every mode */}
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 0.5 }}
                    >
                        <Typography
                            variant="caption"
                            sx={{ color: darkMode ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)", fontWeight: 700 }}
                        >
                            {formatTrimClock(trim[0])} – {formatTrimClock(trim[1])}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ color: resolvedAccentColor, fontWeight: 900 }}
                        >
                            {formatTrimClock(Math.max(0, trim[1] - trim[0]))} selected
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ color: darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)", fontWeight: 700 }}
                        >
                            of {formatTrimClock(duration)}
                        </Typography>
                    </Stack>

                    {/* Music-video scene pills — same behaviour as the Notepad
                        editor, styled for this Audio UI. Each pill plays its own
                        slice of the trimmed music. */}
                    {showSceneBreakdown && trimSegments.length > 0 && (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "repeat(2, minmax(0, 1fr))",
                                    sm: `repeat(${Math.min(trimSegments.length, 4)}, minmax(0, 1fr))`,
                                },
                                gap: 0.75,
                            }}
                        >
                            {trimSegments.map((segment) => {
                                const isPlayingSegment = playingSegment === segment.index;
                                return (
                                    <Button
                                        key={segment.index}
                                        onClick={() => playSegment(segment.index, segment.start, segment.end)}
                                        startIcon={isPlayingSegment ? <PauseIcon /> : <PlayArrowIcon />}
                                        sx={{
                                            minWidth: 0,
                                            justifyContent: "flex-start",
                                            textTransform: "none",
                                            color: appAccentText,
                                            background: resolvedAccentColor,
                                            border: isPlayingSegment
                                                ? `2px dashed ${appAccentText} !important`
                                                : "2px solid transparent !important",
                                            backgroundClip: "padding-box",
                                            borderRadius: 2,
                                            px: 1,
                                            py: 0.8,
                                            boxShadow: isPlayingSegment
                                                ? `0 0 0 1px ${resolvedAccentColor}, 0 0 18px ${resolvedAccentColor}77`
                                                : "none",
                                            "& .MuiButton-startIcon": { mr: 0.5, minWidth: 18 },
                                            "&:hover": { background: resolvedAccentColor, filter: "brightness(0.92)" },
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0, textAlign: "left" }}>
                                            <Typography sx={{ fontSize: "0.74rem", fontWeight: 900, lineHeight: 1.1 }}>
                                                {segment.label}
                                            </Typography>
                                            <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, opacity: 0.82, lineHeight: 1.1 }}>
                                                {formatTrimClock(segment.start)}-{formatTrimClock(segment.end)}
                                            </Typography>
                                        </Box>
                                    </Button>
                                );
                            })}
                        </Box>
                    )}

                    {/* Time breaker — same control as the Notepad editor */}
                    {showSceneBreakdown && (
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            spacing={1}
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
                                {([5, 10] as const).map((seconds) => {
                                    const active = activeBreakerSec === seconds;
                                    return (
                                        <Button
                                            key={seconds}
                                            size="small"
                                            variant={active ? "contained" : "outlined"}
                                            onClick={() => {
                                                setLocalBreakerSec(seconds);
                                                onBreakerChange?.(seconds);
                                            }}
                                            sx={{
                                                minWidth: 0,
                                                px: 1.5,
                                                borderRadius: 999,
                                                textTransform: "none",
                                                fontWeight: 900,
                                                color: active ? appAccentText : resolvedAccentColor,
                                                background: active ? resolvedAccentColor : "transparent",
                                                borderColor: resolvedAccentColor,
                                                "&:hover": {
                                                    borderColor: resolvedAccentColor,
                                                    background: active
                                                        ? resolvedAccentColor
                                                        : `${resolvedAccentColor}22`,
                                                },
                                            }}
                                        >
                                            {seconds}s
                                        </Button>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    )}
                    </Stack>
                )}

                <Button

                    variant="contained"
                    color="primary"
                    onClick={() => {


                        /// setisLoading(true);
                        ///setLoadData('Uploading')

                        setReferenceError('');
                        void uploadOriginalAudioToS3(src).catch(() => { setisLoading(false); setReferenceError('Audio could not be saved. Please try again.'); });
                    }}
                    sx={{

                        color: resolvedAccentColor,
                        flex: 1, // Ensures this button takes equal space as the left button
                        marginTop: "3px",
                        backgroundColor: darkMode ? "rgba(232, 186, 250, 0.12)" : "rgba(0, 153, 204, 0.1)",

                        ...buttonPadding,
                        borderRadius: 999,
                        margin: 'auto',
                        textAlign: 'auto',
                        fontWeight: 800,
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                        "&:hover": {
                            backgroundColor: resolvedAccentColor,
                            color: appAccentText,
                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                        },
                    }}
                >
                    {onReferenceReady ? 'Use audio' : 'Publish'}
                </Button>


            </Stack >



        </>
    );
};

export default AudioPickerPlayer;
