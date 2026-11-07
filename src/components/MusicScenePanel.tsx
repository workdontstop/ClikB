// src/components/MusicScenePanel.tsx
//
// Shared music-video scene breakdown panel.
//
// Music-video mode turns a picked song into a fixed number of scenes:
//   one scene = stage A + stage B, each `breakerSec` seconds long.
// This panel is the read-out for that maths plus a per-segment audio preview.
// It is rendered in two places and both share the SAME upstream state
// (owned by PromptInput, threaded through NotepadEditor):
//   1. NotepadEditor  - above the scene slots the user types into.
//   2. BrainstormChat - pinned at the top of the chat body, collapsible, so a
//      music video can be planned with the assistant without closing and
//      reopening the notepad just to hear a segment.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Stack, Typography, IconButton, Tooltip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { darken } from "@mui/material/styles";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export const MUSIC_MAX_SCENES = 9;
export const MUSIC_STAGE_SLOTS_PER_SCENE = 2;

export interface MusicSegment {
    index: number;
    start: number;
    end: number;
}

/** Seconds a single logical scene occupies (stage A + stage B). */
export const getMusicSceneDurationSec = (breakerSec: number) =>
    breakerSec * MUSIC_STAGE_SLOTS_PER_SCENE;

/** Song length / scene length, clamped to 1..9 scenes. */
export function computeMusicSceneCount(durationSec: number, breakerSec: number): number {
    if (!(durationSec > 0)) return 1;
    return Math.max(
        1,
        Math.min(MUSIC_MAX_SCENES, Math.ceil(durationSec / getMusicSceneDurationSec(breakerSec))),
    );
}

/** Logical scene timings (NOT split into stage A/B). */
export function computeMusicSegments(durationSec: number, breakerSec: number): MusicSegment[] {
    const sceneDurationSec = getMusicSceneDurationSec(breakerSec);
    const sceneCount = computeMusicSceneCount(durationSec, breakerSec);
    return Array.from({ length: sceneCount }, (_, index) => {
        const start = index * sceneDurationSec;
        const end = durationSec > 0
            ? Math.min(durationSec, start + sceneDurationSec)
            : start + sceneDurationSec;
        return { index, start, end };
    });
}

export function formatMusicDurationLabel(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = String(whole % 60).padStart(2, "0");
    return `${mins}:${secs}`;
}

function getSlotLabel(slotIndex: number, usesStageSlots: boolean): string {
    if (!usesStageSlots) return `Scene ${slotIndex + 1}`;
    const logicalScene = Math.floor(slotIndex / MUSIC_STAGE_SLOTS_PER_SCENE) + 1;
    return slotIndex % MUSIC_STAGE_SLOTS_PER_SCENE === 0
        ? `Scene ${logicalScene}`
        : `Scene ${logicalScene}B`;
}

export interface MusicScenePanelProps {
    darkMode?: boolean;
    appColor: string;
    musicUrl: string;
    musicName?: string;
    musicDurationSec: number;
    /** Length of ONE stage. A scene is two of these. */
    breakerSec: 5 | 10;
    /** Story mode splits each scene into stage A / B pills; other modes list scenes flat. */
    usesStageSlots?: boolean;
    onBreakerChange?: (seconds: 5 | 10) => void;
    /** Fired once the <audio> element reports the real song length. */
    onDurationChange?: (seconds: number) => void;
    /** Shows the collapse chevron. Off by default so the notepad keeps its always-open panel. */
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    /** Compact spacing for tight hosts like the brainstorm chat header area. */
    dense?: boolean;
    sx?: SxProps<Theme>;
}

/**
 * The subset of panel props that describe the *song*, threaded from the owner
 * of the music state (PromptInput -> NotepadEditor) down to secondary hosts
 * such as the brainstorm chat. Presentation flags (collapsible, dense, sx) are
 * decided by each host, not passed along.
 */
export type MusicPanelConfig = Pick<
    MusicScenePanelProps,
    | "musicUrl"
    | "musicName"
    | "musicDurationSec"
    | "breakerSec"
    | "usesStageSlots"
    | "onBreakerChange"
    | "onDurationChange"
>;

export const MusicScenePanel: React.FC<MusicScenePanelProps> = ({
    darkMode = true,
    appColor,
    musicUrl,
    musicName,
    musicDurationSec,
    breakerSec,
    usesStageSlots = true,
    onBreakerChange,
    onDurationChange,
    collapsible = false,
    defaultCollapsed = false,
    dense = false,
    sx,
}) => {
    const appColorHover = darken(appColor, 0.08);
    const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);
    const [playingSegment, setPlayingSegment] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const stopAtRef = useRef<number | null>(null);

    const sceneDurationSec = getMusicSceneDurationSec(breakerSec);
    const sceneCount = computeMusicSceneCount(musicDurationSec, breakerSec);
    useCreationControls('music_scenes', 'MusicScenePanel', true, { collapsed, playingSegment, breakerSec, musicDurationSec, sceneCount });
    const segments = useMemo(
        () => computeMusicSegments(musicDurationSec, breakerSec),
        [musicDurationSec, breakerSec],
    );

    // Stage split: each logical scene becomes "Scene N" (A) + "Scene NB".
    const displaySegments = useMemo(() => {
        if (!usesStageSlots) {
            return segments.map((segment) => ({
                ...segment,
                label: `Scene ${segment.index + 1}`,
            }));
        }

        return segments.flatMap((segment) => {
            const stageAIndex = segment.index * MUSIC_STAGE_SLOTS_PER_SCENE;
            const stageBIndex = stageAIndex + 1;
            const stageAEnd = Math.min(segment.end, segment.start + breakerSec);
            return [
                { index: stageAIndex, start: segment.start, end: stageAEnd, label: getSlotLabel(stageAIndex, true) },
                { index: stageBIndex, start: stageAEnd, end: segment.end, label: getSlotLabel(stageBIndex, true) },
            ];
        });
    }, [breakerSec, segments, usesStageSlots]);

    // Segment preview: seek to `start`, then stop on the `timeupdate` that
    // crosses `end`. Cheaper and more reliable than a timer, and it survives
    // the user scrubbing the element directly.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const stopAt = stopAtRef.current;
            if (stopAt !== null && audio.currentTime >= stopAt) {
                audio.pause();
                audio.currentTime = stopAt;
                stopAtRef.current = null;
                setPlayingSegment(null);
            }
        };

        const handleEnded = () => {
            stopAtRef.current = null;
            setPlayingSegment(null);
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);
        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("ended", handleEnded);
        };
    }, [musicUrl]);

    // Collapsing hides the transport, so don't leave audio playing behind it.
    useEffect(() => {
        if (!collapsed) return;
        audioRef.current?.pause();
        stopAtRef.current = null;
        setPlayingSegment(null);
    }, [collapsed]);

    const stopPlayback = () => {
        audioRef.current?.pause();
        stopAtRef.current = null;
        setPlayingSegment(null);
    };

    const playSegment = (segmentIndex: number, start: number, end: number) => {
        const audio = audioRef.current;
        if (!audio || !musicUrl) return;

        if (playingSegment === segmentIndex && !audio.paused) {
            stopPlayback();
            return;
        }

        audio.currentTime = start;
        stopAtRef.current = end;
        setPlayingSegment(segmentIndex);
        audio.play().catch(() => {
            stopAtRef.current = null;
            setPlayingSegment(null);
        });
    };

    if (!musicUrl) return null;

    return (
        <Box
            sx={{
                p: dense ? { xs: 1, sm: 1.25 } : { xs: 1.25, sm: 1.5 },
                borderRadius: 3,
                background: darkMode ? "rgba(10,10,10,0.38)" : "rgba(255,255,255,0.28)",
                border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.45)",
                backdropFilter: "blur(22px) saturate(130%)",
                ...(sx as any),
            }}
        >
            <audio
                ref={audioRef}
                src={musicUrl}
                preload="metadata"
                onLoadedMetadata={(event) => {
                    const nextDuration = Number.isFinite(event.currentTarget.duration)
                        ? event.currentTarget.duration
                        : 0;
                    if (nextDuration > 0) onDurationChange?.(nextDuration);
                }}
                style={{ display: "none" }}
            />

            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: collapsed ? 0 : 1, minWidth: 0 }}
            >
                <MusicNoteIcon sx={{ color: appColor, flexShrink: 0 }} />
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
                    {formatMusicDurationLabel(musicDurationSec)} / {displaySegments.length} scenes
                </Typography>
                {collapsible && (
                    <Tooltip title={collapsed ? "Show music scenes" : "Hide music scenes"}>
                        <IconButton
                            size="small"
                            onClick={() => setCollapsed((prev) => !prev)}
                            {...cb('music_scenes', 'collapse', 'Expand or collapse music scenes', 'setCollapsed')}
                            sx={{
                                flexShrink: 0,
                                color: appColor,
                                border: `1px solid ${appColor}55`,
                                "&:hover": { background: `${appColor}18` },
                            }}
                        >
                            {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>

            {!collapsed && (
                <>
                    {/* Music-video breakdown: trimmed length, scene count, and
                        the stage A/B slots those scenes expand into. */}
                    <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                        sx={{ px: 0.5, pb: 0.5 }}
                    >
                        {[
                            { label: "Trim", value: formatMusicDurationLabel(musicDurationSec) },
                            { label: "Scenes", value: `${sceneCount}` },
                            { label: "Per scene", value: `${sceneDurationSec}s (A+B)` },
                            { label: "Stage length", value: `${breakerSec}s each` },
                        ].map((chip) => (
                            <Box
                                key={chip.label}
                                sx={{
                                    px: 1,
                                    py: 0.4,
                                    borderRadius: 999,
                                    border: `1px solid ${appColor}55`,
                                    background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 0.5,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                                        fontWeight: 700,
                                        fontSize: "0.65rem",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    {chip.label}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{ color: appColor, fontWeight: 900, fontSize: "0.72rem" }}
                                >
                                    {chip.value}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "repeat(2, minmax(0, 1fr))",
                                sm: `repeat(${Math.min(displaySegments.length, 5)}, minmax(0, 1fr))`,
                            },
                            gap: 0.75,
                            // Breathing room between the scene pills and the
                            // Time breaker row below.
                            mb: 2,
                        }}
                    >
                        {displaySegments.map((segment) => {
                            const isPlayingSegment = playingSegment === segment.index;
                            const segmentBackground = darkMode ? "rgba(255,255,255,0.92)" : "rgba(10,10,10,0.88)";
                            const segmentHoverBackground = darkMode ? "#fff" : "rgba(0,0,0,0.96)";
                            const segmentTextColor = darkMode ? "#111" : "#fff";
                            const segmentBorderColor = isPlayingSegment
                                ? appColor
                                : (darkMode ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.16)");
                            return (
                                <Button
                                    key={segment.index}
                                    onClick={() => playSegment(segment.index, segment.start, segment.end)}
                                    {...cb('music_scenes', `segment_${segment.index}`, `Play or pause ${segment.label}`, 'playSegment')}
                                    startIcon={isPlayingSegment ? <PauseIcon /> : <PlayArrowIcon />}
                                    sx={{
                                        minWidth: 0,
                                        justifyContent: "flex-start",
                                        textTransform: "none",
                                        color: segmentTextColor,
                                        background: segmentBackground,
                                        border: isPlayingSegment ? "2px dashed #000 !important" : "2px solid transparent !important",
                                        backgroundClip: "padding-box",
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
                                            {segment.label}
                                        </Typography>
                                        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, opacity: 0.82, lineHeight: 1.1 }}>
                                            {formatMusicDurationLabel(segment.start)}-{formatMusicDurationLabel(segment.end)}
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
                                const active = breakerSec === seconds;
                                return (
                                    <Button
                                        key={seconds}
                                        {...cb('music_scenes', `breaker_${seconds}`, `${seconds} second stage breaker`, 'stopPlayback; onBreakerChange')}
                                        size="small"
                                        variant={active ? "contained" : "outlined"}
                                        onClick={() => {
                                            stopPlayback();
                                            onBreakerChange?.(seconds as 5 | 10);
                                        }}
                                        sx={{
                                            minWidth: 58,
                                            color: active ? "#000" : "#fff",
                                            borderColor: darkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.45)",
                                            backgroundColor: active ? appColor : "rgba(10,10,10,0.42)",
                                            textTransform: "none",
                                            fontWeight: 900,
                                            "&:hover": {
                                                backgroundColor: active ? appColorHover : "rgba(20,20,20,0.62)",
                                            },
                                        }}
                                    >
                                        {seconds}s
                                    </Button>
                                );
                            })}
                        </Stack>
                    </Stack>
                </>
            )}
        </Box>
    );
};

export default MusicScenePanel;
import { creationBinding as cb } from '../creationControlSnapshot';
import { useCreationControls } from '../useCreationControls';
