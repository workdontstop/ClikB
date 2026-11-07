// AudioPicker2.tsx
import React, { useRef, useState, useEffect, useCallback, ChangeEvent } from "react";
import {
    Box,
    Stack,
    Typography,
    IconButton,
    Button,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import AudioPickerPlayer from "./AudioPickerPlayer";

type SongItem = {
    id?: number;
    sender?: number | string | null;
    name: string;
    url: string;
};

type AudioPicker2Props = {
    /** show/hide inline picker */
    open: boolean;
    /** close the inline picker */
    onClose: () => void;

    /** currently selected music URL */
    music: string | null;
    /** set selected music URL */
    setmusic: (url: string) => void;
    /** set selected music name */
    setmusicname: (name: string) => void;

    /** whether to fetch from /callmusic */
    MemeMusic: boolean;
};

const AudioPicker2: React.FC<AudioPicker2Props> = ({
    open,
    onClose,
    music,
    setmusic,
    setmusicname,
    MemeMusic,

}) => {
    const darkMode = useSelector((s: RootState) => s.settings.darkMode);
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const loggedUserId = loggedUser?.id ?? null;
    const CLIK_URL = import.meta.env.VITE_CLIK_URL as string;
    const appAccent = darkMode ? "#E8BAFA" : "#0099cc";
    const appAccentText = darkMode ? "#000000" : "#ffffff";

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);
    const [deletingAudioUrl, setDeletingAudioUrl] = useState<string | null>(null);

    const [audioUrls, setAudioUrls] = useState<SongItem[]>([]);
    const [uploadedMp3, setUploadedMp3] = useState<string | null>(null);
    const [audioName, setAudioName] = useState<string>("");
    const [gotMp3, setGotMp3] = useState(false);

    // fetch music list
    const callMusic = useCallback(async () => {
        try {
            const res: any = await axios.post(
                `${CLIK_URL}/callmusic`,
                {},
                { withCredentials: true }
            );
            if (res.status === 200 && Array.isArray(res.data?.allsongs)) {
                setAudioUrls(
                    res.data.allsongs.map((row: any) => ({
                        id: row.id,
                        sender: row.sender,
                        name: row.name,
                        url: row.song,
                    }))
                );
            }
        } catch (err) {
            console.error("callMusic failed:", err);
        }
    }, [CLIK_URL]);

    const canDeleteMusicItem = useCallback(
        (item: SongItem) => {
            const ownerId = Number(item.sender);
            const userId = Number(loggedUserId);
            return Number.isFinite(ownerId) && Number.isFinite(userId) && ownerId > 0 && ownerId === userId;
        },
        [loggedUserId]
    );

    const deleteMusicItem = useCallback(
        async (item: SongItem) => {
            if (!canDeleteMusicItem(item) || deletingAudioUrl) return;
            const shouldDelete = window.confirm('Delete "' + item.name + '"?');
            if (!shouldDelete) return;

            setDeletingAudioUrl(item.url);
            try {
                await axios.post(
                    CLIK_URL + "/deletemusic",
                    { values: { id: item.id, song: item.url } },
                    { withCredentials: true }
                );

                if (playingUrl === item.url && audioRef.current) {
                    audioRef.current.pause();
                    setPlayingUrl(null);
                }

                if (music === item.url) {
                    setmusic("");
                    setmusicname("");
                }

                setAudioUrls((prev) =>
                    prev.filter((row) => item.id ? row.id !== item.id : row.url !== item.url)
                );
            } catch (err) {
                console.error("deleteMusic failed:", err);
                alert("Could not delete audio.");
            } finally {
                setDeletingAudioUrl(null);
            }
        },
        [CLIK_URL, canDeleteMusicItem, deletingAudioUrl, music, playingUrl, setmusic, setmusicname]
    );

    // load list on open
    useEffect(() => {
        if (open && MemeMusic) callMusic();
    }, [open, MemeMusic, callMusic]);

    // playback
    const togglePlayback = useCallback(
        (item: SongItem) => {
            const el = audioRef.current;
            if (!el) return;

            if (playingUrl === item.url) {
                if (!el.paused) {
                    el.pause();
                    setPlayingUrl(null);
                } else {
                    el.play();
                    setPlayingUrl(item.url);
                }
                return;
            }

            el.pause();
            el.src = item.url;
            el.load();
            el.play();
            setPlayingUrl(item.url);
        },
        [playingUrl]
    );

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const onEnd = () => setPlayingUrl(null);
        el.addEventListener("ended", onEnd);
        return () => el.removeEventListener("ended", onEnd);
    }, []);

    // upload mp3
    const handleMp3Upload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAudioName(file.name);
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setUploadedMp3(reader.result);
                setGotMp3(true);
            }
        };
        reader.readAsDataURL(file);
    };

    if (!open) return null;

    return (
        <Box
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 20_000_000_000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // scrim so it "pops"
                background: "rgba(0,0,0,0.35)",
            }}
        >
            <Box
                sx={{
                    paddingTop: '10vh',
                    width: matchMobile ? "92%" : 480,
                    maxHeight: "88vh",
                    overflow: "hidden",
                    borderRadius: 2,
                    // glass card
                    backgroundColor: darkMode ? "rgba(25,245,245,0.25)" : "rgba(0,20,100,0.35)",
                    backdropFilter: darkMode
                        ? matchMobile ? "blur(18px)" : "blur(30px)"
                        : matchMobile ? "blur(12px)" : "blur(18px)",
                    boxShadow: "0 12px 38px rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.35)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header */}
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                        px: 2,
                        py: 1,
                        backgroundColor: "transparent",
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{ flex: 1, color: "#fff", fontWeight: 800, letterSpacing: 0.3 }}
                    >
                        Music
                    </Typography>

                    {/* Upload */}
                    <input
                        id="upload-mp3-input-inline"
                        type="file"
                        accept="audio/*"
                        hidden
                        onChange={handleMp3Upload}
                    />
                    <label htmlFor="upload-mp3-input-inline">
                        <Button
                            component="span"
                            size="small"
                            variant="outlined"
                            sx={{
                                color: "#fff",
                                borderColor: "#fff",
                                textTransform: "none",
                                fontSize: 14,
                            }}
                        >
                            Upload MP3
                        </Button>
                    </label>

                    <IconButton onClick={onClose} sx={{ color: "#fff", ml: 1 }}>
                        <CloseIcon />
                    </IconButton>
                </Stack>

                {/* Content */}
                <Box sx={{ overflow: "auto", px: 0, pb: 1 }}>
                    {gotMp3 && (
                        <Box sx={{ width: "100%", p: 1 }}>
                            <AudioPickerPlayer
                                callMusic={callMusic}
                                setGotmp3={setGotMp3}
                                AudioName={audioName}
                                src={uploadedMp3}
                                onEnded={() => setPlayingUrl(null)}
                                onAudioReady={(audioUrl: string, name: string) => {
                                    setmusicname(name);
                                    setmusic(audioUrl);
                                    onClose();
                                }}
                            />
                        </Box>
                    )}

                    <List dense disablePadding>
                        {audioUrls.map((song) => {
                            const { name, url } = song;
                            const isSelected = url === music;
                            const isPlaying = url === playingUrl;
                            const canDelete = canDeleteMusicItem(song);
                            const isDeleting = deletingAudioUrl === url;
                            return (
                                <ListItem
                                    key={song.id ?? url}
                                    disablePadding
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        px: 1.5,
                                        py: 0.6,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        aria-label={"Delete " + name}
                                        disabled={!canDelete || isDeleting}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            deleteMusicItem(song);
                                        }}
                                        sx={{
                                            width: 28,
                                            height: 28,
                                            flexShrink: 0,
                                            color: "#ffffff",
                                            backgroundColor: darkMode ? "rgba(232, 186, 250, 0.14)" : "rgba(0, 153, 204, 0.14)",
                                            border: darkMode ? "1px solid rgba(232, 186, 250, 0.32)" : "1px solid rgba(0, 153, 204, 0.32)",
                                            opacity: canDelete ? 0.65 : 0,
                                            visibility: canDelete ? "visible" : "hidden",
                                            "&:hover": {
                                                opacity: 1,
                                                color: "#ffb3b3",
                                                backgroundColor: "rgba(255, 71, 87, 0.18)",
                                                borderColor: "rgba(255, 120, 120, 0.4)",
                                            },
                                            "&.Mui-disabled": {
                                                color: "rgba(255,255,255,0.65)",
                                            },
                                        }}
                                    >
                                        {isDeleting ? (
                                            <CircularProgress size={14} sx={{ color: "inherit" }} />
                                        ) : (
                                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                        )}
                                    </IconButton>
                                    <ListItemButton
                                        onClick={() => togglePlayback({ name, url })}
                                        sx={{
                                            minWidth: 0,
                                            flex: 1,
                                            color: "#fff",
                                            p: 1.2,
                                            borderRadius: 2,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <ListItemText
                                            sx={{ minWidth: 0, m: 0 }}
                                            primary={
                                                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, width: "100%" }}>
                                                    <Typography
                                                        variant="button"
                                                        title={name}
                                                        noWrap
                                                        sx={{
                                                            display: "block",
                                                            minWidth: 0,
                                                            flex: 1,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {name}
                                                    </Typography>
                                                    {isPlaying ? (
                                                        <PauseIcon fontSize="small" sx={{ flexShrink: 0 }} />
                                                    ) : (
                                                        <PlayArrowIcon fontSize="small" sx={{ flexShrink: 0 }} />
                                                    )}
                                                </Stack>
                                            }
                                        />
                                        {isSelected && (
                                            <CheckCircleIcon
                                                fontSize="small"
                                                sx={{ color: appAccent, ml: 1, flexShrink: 0 }}
                                            />
                                        )}
                                    </ListItemButton>
                                    <Button
                                        size="medium"
                                        variant={isSelected ? "contained" : "outlined"}
                                        sx={{
                                            flexShrink: 0,
                                            minWidth: 116,
                                            minHeight: 42,
                                            px: 2.5,
                                            borderRadius: 999,
                                            fontWeight: 800,
                                            letterSpacing: 0.4,
                                            backgroundColor: isSelected ? appAccent : "transparent",
                                            borderColor: appAccent,
                                            color: isSelected ? appAccentText : appAccent,
                                            whiteSpace: "nowrap",
                                            "&:hover": {
                                                borderColor: appAccent,
                                                backgroundColor: isSelected
                                                    ? appAccent
                                                    : darkMode
                                                        ? "rgba(232, 186, 250, 0.12)"
                                                        : "rgba(0, 153, 204, 0.1)",
                                            },
                                            "&:active": {
                                                backgroundColor: appAccent,
                                                borderColor: appAccent,
                                                color: appAccentText,
                                            },
                                        }}
                                        onClick={() => {
                                            setmusicname(name);
                                            setmusic(url);
                                            onClose();
                                        }}
                                    >
                                        {isSelected ? "Selected" : "Select"}
                                    </Button>
                                </ListItem>
                            );
                        })}
                    </List>
                </Box>

                {/* hidden audio element */}
                <Box sx={{ display: "none" }}>
                    <audio ref={audioRef} />
                </Box>
            </Box>
        </Box>
    );
};

export default AudioPicker2;
