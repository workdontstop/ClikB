// AudioPicker.tsx
import React, {
    useRef,
    useState,
    useEffect,
    ChangeEvent,
    useCallback,
} from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    IconButton,
    Button,
    Typography,
    Stack,
    useMediaQuery,
    useTheme,
    Box,
    CircularProgress,
} from "@mui/material";
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { alpha } from "@mui/material/styles";
import AudioPickerPlayer from "./AudioPickerPlayer";

import MusicNoteIcon from '@mui/icons-material/MusicNote';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { matchMobile } from "./DetectDevice";

/* ────────────────────────────────────────────────────── */
/* Types                                                  */
/* ────────────────────────────────────────────────────── */
export type Voice = {
    id: string;
    url: string;
    name: string;
    emotion: string;
    gender: "Male" | "Female";
};

export interface VoicePickerProps {
    showVoicesList: boolean;
    selectedVoice: string;
    onClose: () => void;
    onSelectVoice: (voiceId: string) => void;
    darkMode?: boolean;
    voices?: Voice[];
    setName: (name: string) => void;
    setMemeMusic: (val: boolean) => void;
    MemeMusic: any;
    setmusicname: any;
    setmusic: any;
    music: any;
    type: any;

}

const defaultVoices: Voice[] = [];

/* ────────────────────────────────────────────────────── */
/* Component                                              */
/* ────────────────────────────────────────────────────── */
const AudioPicker: React.FC<any> = ({
    showVoicesList,
    selectedVoice,
    onClose,
    onSelectVoice,
    darkMode = false,
      
    voices = defaultVoices,
    setName,
    setMemeMusic,
    MemeMusic,
    setmusicname,
    setmusic,
    music,
    type,
    VideMode,
    forceMusicMode = false,

}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    /* ------------------------------------------------------------------ */
    /* State & refs                                                       */
    /* ------------------------------------------------------------------ */
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [deletingAudioUrl, setDeletingAudioUrl] = useState<string | null>(null);

    const [uploadedMp3, setUploadedMp3] = useState<string | null>(null);
    const [gotMp3, setGotMp3] = useState(false);
    /* 1️⃣  state: array of objects */


    type SongItem = {
        id?: number;
        sender?: number | string | null;
        name: string;
        url: string;
    };

    const [audioUrls, setAudioUrls] = useState<SongItem[]>([]);

    const [audioName, setAudioName] = useState<string>('');

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const loggedUser = useSelector(
        (state: RootState) => state.profile.loggedUser
    );
    const loggedUserId = loggedUser?.id ?? null;
    const pickerMusicMode = forceMusicMode || MemeMusic;
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appAccent = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? "#E8BAFA" : "#0099cc");
    const appAccentText = darkModeReducer ? "#000000" : "#ffffff";


    /* ------------------------------------------------------------------ */
    /* Playback helpers                                                   */
    /* ------------------------------------------------------------------ */

    const togglePlayback = useCallback(
        (item: SongItem) => {
            const el = audioRef.current;
            if (!el) return;

            if (playingVoice === item.url && audioRef.current) {
                if (!audioRef.current.paused) {
                    audioRef.current.pause();
                    setPlayingVoice(null);
                } else {
                    audioRef.current.play();
                    setPlayingVoice(item.url);
                }
                return;
            }

            // switch to a new song
            el.pause();
            el.src = item.url;
            el.load();
            el.play();
            setPlayingVoice(item.url); // track by URL
        },
        [playingVoice]
    );


    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const ended = () => setPlayingVoice(null);
        el.addEventListener("ended", ended);
        return () => el.removeEventListener("ended", ended);
    }, []);

    useEffect(() => {
        if (!showVoicesList) {
            setPlayingVoice(null);
        }
    }, [showVoicesList]);

    useEffect(() => {
        if (!uploadedMp3) {
            setPlayingVoice(null);
        }
    }, [uploadedMp3]);

    /* ------------------------------------------------------------------ */
    /* Upload-file handler                                                */
    /* ------------------------------------------------------------------ */
    const handleMp3Upload = (e: ChangeEvent<HTMLInputElement>) => {


        const file = e.target.files?.[0];
        if (!file) return;

        // store the name so you can display it later
        setAudioName(file.name);          // ← ✔️ set audio name here

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setUploadedMp3(reader.result);
                setGotMp3(true);
            }
        };
        reader.readAsDataURL(file);
    };
    /* ------------------------------------------------------------------ */
    /* callmusic → update list                                            */
    /* ------------------------------------------------------------------ */
    const callMusic = useCallback(
        async () => {

            setAudioUrls([]);
            // you can still send the URL—even if the server doesn’t use it
            const payload = {};



            try {
                const res: any = await axios.post(`${CLIK_URL}/callmusic`, payload, {
                    withCredentials: true,
                });

                // server responds with full list
                if (res.status === 200 && Array.isArray(res.data?.allsongs)) {

                    console.log(res.data.allsongs);
                    // keep only the song URLs for the picker


                    setAudioUrls(
                        res.data.allsongs.map((row: any) => ({
                            id: row.id,
                            sender: row.sender,
                            name: row.name,      // "fly me to the moon.mp3"
                            url: row.song,       // full S3 URL
                        }))
                    );





                }
            } catch (err) {
                console.error("callMusic request failed:", err);
            }
        },
        [CLIK_URL]
    );

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

                if (playingVoice === item.url && audioRef.current) {
                    audioRef.current.pause();
                    setPlayingVoice(null);
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
        [CLIK_URL, canDeleteMusicItem, deletingAudioUrl, music, playingVoice, setmusic, setmusicname]
    );



    useEffect(() => {
        if (pickerMusicMode && showVoicesList) {



            callMusic();

        }

    }, [pickerMusicMode, showVoicesList, callMusic])




    /* ------------------------------------------------------------------ */
    /* Render                                                             */
    /* ------------------------------------------------------------------ */
    const selectedTrackName = audioUrls.find((s) => s.url === music)?.name || '';
    const playingTrackName = audioUrls.find((s) => s.url === playingVoice)?.name || '';
    useCreationControls('music', 'AudioPicker', Boolean(showVoicesList && pickerMusicMode), {
        count: audioUrls.length,
        playing: Boolean(playingVoice),
        playingTrack: playingTrackName,
        selected: Boolean(music),
        selectedTrack: selectedTrackName,
    });
    return (
        <Dialog
            open={showVoicesList}
            onClose={onClose}
            fullScreen={fullScreen}
            PaperProps={{
                sx: {
                    p: 0,
                    width: fullScreen ? "100%" : 420,
                    backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                    backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",
                },
            }}
            aria-labelledby="voice-picker-title"
        >
            {/* ───────── title ───────── */}
            <DialogTitle

                id="voice-picker-title"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    pr: 2,
                    backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                    backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",
                    color: darkModeReducer ? "#ffffff" : "#ffffff",
                }}
            >
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    {pickerMusicMode && type === 1 ? "Music Vid" : "Music"}
                </Typography>


                {type === 1 && !forceMusicMode ? <Button
                    {...(pickerMusicMode ? cb('music', 'open_voices', 'Switch to voice narration picker', 'setMemeMusic') : {})}
                    onClick={() => {
                        if (!MemeMusic) {

                            setMemeMusic(true);
                        } else {

                            setMemeMusic(false)
                        }

                    }}
                    component="span"
                    size="small"
                    variant="outlined"
                    startIcon={MemeMusic ? <RecordVoiceOverIcon /> : <MusicNoteIcon />}
                    sx={{
                        color: darkModeReducer ? "#ffffff" : "#ffffff",
                        borderColor: darkModeReducer ? "#ffffff" : "#000000",
                        textTransform: "none",
                        fontSize: 14,
                        paddingRight: '2vw'
                    }}
                >
                    {MemeMusic ? "Narration" : "Music"}
                </Button> : null}


                {/* Upload MP3 */}
                <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
                    <input
                        id="upload-mp3-input"
                        type="file"
                        accept="audio/*"
                        hidden
                        onChange={handleMp3Upload}
                    />
                    <label {...cb('music', 'upload', 'Upload music from device', 'handleMp3Upload', 'click', 'needs_handoff')} htmlFor="upload-mp3-input">
                        <Button
                            component="span"
                            size="small"
                            variant="outlined"
                            sx={{
                                color: darkModeReducer ? "#ffffff" : "#ffffff",
                                borderColor: darkModeReducer ? "#ffffff" : "#000000",
                                textTransform: "none",
                                fontSize: 14,
                            }}
                        >
                            Upload MP3
                        </Button>
                    </label>


                </Stack>

                <IconButton
                    onClick={onClose}
                    {...cb('music', 'close', 'Close music picker', 'onClose')}
                    sx={{ color: darkModeReducer ? "#ffffff" : "#000000" }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* ───────── content ───────── */}
            {/* list ------------------------------------------------------------ */}
            <DialogContent {...cb('music', 'scroll', 'Scroll music tracks', 'DialogContent.scrollBy', 'scroll')} dividers sx={{ p: 0, }}>
                  


                {gotMp3 && (
                    <Box sx={{ width: "100%", p: 1 }}>
                        <AudioPickerPlayer
                            callMusic={callMusic}
                            setGotmp3={setGotMp3}
                            AudioName={audioName}
                            src={uploadedMp3}
                            showSceneBreakdown={pickerMusicMode && type === 1}
                            onEnded={() => setPlayingVoice(null)}
                            onAudioReady={(audioUrl: string, name: string) => {
                                setmusicname(name);
                                setmusic(audioUrl);
                                onClose();
                            }}
                        />
                    </Box>
                )}

                <List dense disablePadding>
                    {/* audioUrls: [{ name, url }] — newest → oldest */}

                    {audioUrls.map((song) => {
                        const { name, url } = song;

                        console.log('array', audioUrls)
                        console.log('url', url);
                        const isSelected = url === music;   // keep your selected logic
                        const isPlaying = url === playingVoice;    // keep your playing logic
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
                                    {...cb('music', `delete_${song.id ?? name}`, `Delete ${name}`, 'deleteMusicItem', 'click', 'needs_confirmation')}
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
                                        backgroundColor: alpha(appAccent, 0.14),
                                        border: `1px solid ${alpha(appAccent, 0.32)}`,
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
                                    {...cb('music', `play_${song.id ?? name}`, `Preview ${name}`, 'togglePlayback')}
                                    aria-pressed={isPlaying}
                                    onClick={() => {
                                        // togglePlayback now expects { id:url, url, name }
                                        togglePlayback({ url } as any);
                                    }}
                                    sx={{
                                        minWidth: 0,
                                        flex: 1,
                                        color: darkModeReducer ? "#fff" : "#fff",
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
                                        borderColor: isSelected ? appAccent : (darkModeReducer ? appAccent : "#ffffff"),
                                        color: isSelected ? appAccentText : (darkModeReducer ? appAccent : "#ffffff"),
                                        whiteSpace: "nowrap",
                                        "&:hover": {
                                            borderColor: isSelected ? appAccent : (darkModeReducer ? appAccent : "#ffffff"),
                                            backgroundColor: isSelected
                                                ? appAccent
                                                : darkModeReducer
                                                    ? alpha(appAccent, 0.12)
                                                    : "rgba(255, 255, 255, 0.14)",
                                        },
                                        "&:active": {
                                            backgroundColor: isSelected
                                                ? appAccent
                                                : darkModeReducer
                                                    ? alpha(appAccent, 0.16)
                                                    : "rgba(255, 255, 255, 0.18)",
                                            borderColor: isSelected ? appAccent : (darkModeReducer ? appAccent : "#ffffff"),
                                            color: isSelected ? appAccentText : (darkModeReducer ? appAccent : "#ffffff"),
                                        },
                                    }}
                                    onClick={() => {
                                        setmusicname(name);
                                        setmusic(url);      // save name if you want it elsewhere
                                        onClose();
                                    }}
                                    aria-pressed={isSelected}
                                    {...cb('music', `select_${song.id ?? name}`, `Select ${name}`, 'setmusicname; setmusic; onClose')}
                                >
                                    {isSelected ? "Selected" : "Select"}
                                </Button>
                            </ListItem>
                        );
                    })}
                </List>
            </DialogContent>


            <Box sx={{ display: "none" }}>
                <audio ref={audioRef} />
            </Box>

        </Dialog>
    );
};

export default AudioPicker;

import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
