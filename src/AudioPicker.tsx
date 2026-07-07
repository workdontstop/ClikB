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
} from "@mui/material";
import axios from "axios";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import AudioPickerPlayer from "./AudioPickerPlayer";

import MusicNoteIcon from '@mui/icons-material/MusicNote';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";

import { matchMobile } from "./DetectDevice";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* Types                                                  */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* Component                                              */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    const [uploadedMp3, setUploadedMp3] = useState<string | null>(null);
    const [gotMp3, setGotMp3] = useState(false);
    /* 1ï¸âƒ£  state: array of objects */


    type SongItem = { name: string; url: string };

    const [audioUrls, setAudioUrls] = useState<SongItem[]>([]);

    const [audioName, setAudioName] = useState<string>('');

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const pickerMusicMode = forceMusicMode || MemeMusic;


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
        setAudioName(file.name);          // â† âœ”ï¸ set audio name here

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
    /* callmusic â†’ update list                                            */
    /* ------------------------------------------------------------------ */
    const callMusic = useCallback(
        async () => {

            setAudioUrls([]);
            // you can still send the URLâ€”even if the server doesnâ€™t use it
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



    useEffect(() => {
        if (pickerMusicMode && showVoicesList) {



            callMusic();

        }

    }, [pickerMusicMode, showVoicesList, callMusic])




    /* ------------------------------------------------------------------ */
    /* Render                                                             */
    /* ------------------------------------------------------------------ */
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
            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ title â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                    Audio
                </Typography>


                {type === 1 && !forceMusicMode ? <Button

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
                    <label htmlFor="upload-mp3-input">
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
                    sx={{ color: darkModeReducer ? "#ffffff" : "#000000" }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ content â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {/* list ------------------------------------------------------------ */}
            <DialogContent dividers sx={{ p: 0, }}>



                {gotMp3 && (
                    <Box sx={{ width: "100%", p: 1 }}>
                        <AudioPickerPlayer
                            callMusic={callMusic}
                            setGotmp3={setGotMp3}
                            AudioName={audioName}
                            src={uploadedMp3}
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
                    {/* audioUrls: [{ name, url }] â€” newest â†’ oldest */}

                    {audioUrls.map(({ name, url }) => {

                        console.log('array', audioUrls)
                        console.log('url', url);
                        const isSelected = url === music;   // keep your selected logic
                        const isPlaying = url === playingVoice;    // keep your playing logic
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
                                            backgroundColor: isSelected ? (darkModeReducer ? '#E8BAFA' : '#0099cc') : '',
                                            borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                            color: isSelected ? (darkModeReducer ? '#000000' : '#ffffff') : (darkModeReducer ? '#E8BAFA' : '#0099cc'),
                                            "&:hover": {
                                                borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                            },
                                            "&:active": {
                                                backgroundColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                                borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                                color: darkModeReducer ? '#000000' : '#ffffff',
                                            },
                                        }}
                                        onClick={() => {
                                            setmusicname(name);
                                            setmusic(url);      // save name if you want it elsewhere
                                            onClose();
                                        }}
                                    >
                                        {isSelected ? "Selected" : "Select"}
                                    </Button>
                                }
                            >
                                <ListItemButton
                                    onClick={() => {
                                        // togglePlayback now expects { id:url, url, name }
                                        togglePlayback({ url } as any);
                                    }}
                                    sx={{ pr: 2, color: darkModeReducer ? "#fff" : "#fff", padding: '1.2vh' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Typography variant="button" sx={{ width: '70%' }}>
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
            </DialogContent>


            <Box sx={{ display: "none" }}>
                <audio ref={audioRef} />
            </Box>

        </Dialog>
    );
};

export default AudioPicker;
