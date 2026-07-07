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
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import AudioPickerPlayer from "./AudioPickerPlayer";

type SongItem = { name: string; url: string };

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
    const theme = useTheme();
    const darkMode = useSelector((s: RootState) => s.settings.darkMode);
    const CLIK_URL = import.meta.env.VITE_CLIK_URL as string;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingUrl, setPlayingUrl] = useState<string | null>(null);

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
                        name: row.name,
                        url: row.song,
                    }))
                );
            }
        } catch (err) {
            console.error("callMusic failed:", err);
        }
    }, [CLIK_URL]);

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
                        Audio
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
                        {audioUrls.map(({ name, url }) => {
                            const isSelected = url === music;
                            const isPlaying = url === playingUrl;
                            return (
                                <ListItem
                                    key={url}
                                    disablePadding
                                    secondaryAction={
                                        <Button
                                            size="medium"
                                            variant={isSelected ? "contained" : "outlined"}
                                            sx={{
                                                minWidth: 110,
                                                backgroundColor: isSelected
                                                    ? darkMode ? "#F6BB56" : "#e52e71"
                                                    : "transparent",
                                                borderColor: darkMode ? "#F6BB56" : "#ff8a00",
                                                color: isSelected ? "#000" : darkMode ? "#F6BB56" : "#ff8a00",
                                                "&:hover": {
                                                    borderColor: darkMode ? "#F6BB56" : "#ff8a00",
                                                },
                                                "&:active": {
                                                    backgroundColor: darkMode ? "#F6BB56" : "#e52e71",
                                                    borderColor: darkMode ? "#F6BB56" : "#e52e71",
                                                    color: "#000",
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
                                    }
                                >
                                    <ListItemButton
                                        onClick={() => togglePlayback({ name, url })}
                                        sx={{ pr: 2, color: "#fff", py: 1.2 }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Stack direction="row" alignItems="center" spacing={0.5} style={{ width: '100%' }}>
                                                    <Typography variant="button" sx={{ width: "70%" }}>
                                                        {name.length > 50 ? `${name.slice(0, 50)}â€¦` : name}
                                                    </Typography>
                                                    {isPlaying ? (
                                                        <PauseIcon fontSize="small" />
                                                    ) : (
                                                        <PlayArrowIcon fontSize="small" />
                                                    )}
                                                </Stack>
                                            }
                                        />
                                        {isSelected && (
                                            <CheckCircleIcon
                                                fontSize="small"
                                                sx={{ color: theme.palette.success.main, ml: 1 }}
                                            />
                                        )}
                                    </ListItemButton>
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
