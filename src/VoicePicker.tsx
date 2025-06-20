// VoicePicker.tsx
import React, { useRef, useState, useEffect } from "react";
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
} from "@mui/material";

import { RootState } from "./store";

import { useSelector, useDispatch } from "react-redux";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";

import { matchMobile } from "./DetectDevice";

/* ──────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────── */
type Voice = {
    id: string;
    url: string;
    name: string;
    emotion: string;
    gender: "Male" | "Female";
};

interface VoicePickerProps {
    showVoicesList: boolean;
    selectedVoice: string;
    onClose: () => void;
    onSelectVoice: (voiceId: string) => void;
    darkMode?: boolean;
    voices?: Voice[];
    setName: any;
    setMemeMusic: any,
    type: any
}

/* ──────────────────────────────────────────────────────
 * Default voices (if none are passed in)
 * ──────────────────────────────────────────────────── */
const defaultVoices: Voice[] = [

    {
        id: "en-US-Chirp-HD-D",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-8cda450b61c157d79077ee1f6a96d04a.mp3",
        name: "Drake",
        emotion: "Resonant",
        gender: "Male",
    },
    {
        id: "en-US-Chirp-HD-F",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-b0ca43b1728db23687f4684a9d63d887.mp3",
        name: "Fiona",
        emotion: "Cheerful",
        gender: "Female",
    },
    {
        id: "en-US-Chirp-HD-O",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-ff1f1c7055c85b3439bb1727d96371d2.mp3",
        name: "Orion",
        emotion: "Upbeat",
        gender: "Female",
    },
    {
        id: "en-US-Chirp3-HD-Achernar",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-53362843be3765e1b462072d4d673ba9.mp3",
        name: "Ace",
        emotion: "Authoritative",
        gender: "Female",
    },
    {
        id: "en-US-Chirp3-HD-Achird",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-d37a14595efe81d7a58ee7715a598651.mp3",
        name: "Charlie",
        emotion: "Warm",
        gender: "Male",
    },
    {
        id: "en-US-Chirp3-HD-Aoede",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-0f3becff75bd6766ccd2c99cd7f78a90.mp3",
        name: "Mia",
        emotion: "Lyrical",
        gender: "Female",
    },
    {
        id: "en-US-Chirp3-HD-Charon",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-19978452955d587c07c9c099b7afb920.mp3",
        name: "Nyx",
        emotion: "Mysterious",
        gender: "Male",
    },
    {
        id: "en-US-Chirp3-HD-Fenrir",
        url: "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-96c866acc43bf599e3b5fcb30576d46f.mp3",
        name: "Fen",
        emotion: "Intense",
        gender: "Male",

    },
];

/* ──────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────── */
const VoicePicker: React.FC<VoicePickerProps> = ({
    showVoicesList,
    selectedVoice,
    onClose,
    onSelectVoice,
    darkMode = false,
    voices = defaultVoices,
    setName,
    setMemeMusic,
    type
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [playingVoice, setPlayingVoice] = useState<string | null>(null);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    /* play / pause -------------------------------------------------------- */
    const togglePlayback = (voice: Voice): void => {
        // same voice -> toggle
        if (playingVoice === voice.id && audioRef.current) {
            if (!audioRef.current.paused) {
                audioRef.current.pause();
                setPlayingVoice(null);
            } else {
                audioRef.current.play();
                setPlayingVoice(voice.id);
            }
            return;
        }

        // new voice
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(voice.url);
        audioRef.current.play();
        setPlayingVoice(voice.id);

        // when audio ends, clear playing state
        audioRef.current.onended = () => setPlayingVoice(null);
    };

    /* stop playback if dialog closes -------------------------------------- */
    useEffect(() => {
        if (!showVoicesList && audioRef.current) {
            audioRef.current.pause();
            setPlayingVoice(null);
        }
    }, [showVoicesList]);

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
            {/* title ----------------------------------------------------------- */}
            <DialogTitle
                id="voice-picker-title"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    pr: 2,
                    backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                    backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",
                    color: darkModeReducer ? '#ffffff' : '#ffffff',
                }}
            >
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    Choose a voice
                </Typography>


                <IconButton onClick={onClose} sx={{ color: darkModeReducer ? '#ffffff' : '#000000', }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* list ------------------------------------------------------------ */}
            <DialogContent dividers sx={{ p: 0 }}>
                <List dense disablePadding>
                    {voices.map((v, index) => {
                        const isSelected = v.id === selectedVoice;
                        const isPlaying = v.id === playingVoice;
                        return (
                            <ListItem
                                key={v.id}
                                disablePadding
                                secondaryAction={
                                    <Button
                                        size="medium"
                                        variant={isSelected ? "contained" : "outlined"}
                                        sx={{
                                            minWidth: 110,


                                            backgroundColor: isSelected ? '#F6BB56' : '',
                                            borderColor: isSelected ? '#F6BB56' : (darkModeReducer ? '#F6BB56' : '#F6BB56'),
                                            color: isSelected ? '#000000' : (darkModeReducer ? "#F6BB56" : "#DA8E0B"),

                                            '&:hover': {
                                                ///  backgroundColor: '#F6BB56',
                                                borderColor: '#F6BB56',
                                                //color: '#000000',
                                            },

                                            '&:active': {
                                                backgroundColor: '#F6BB56',
                                                borderColor: '#F6BB56',
                                                color: '#000000',
                                            },
                                        }}
                                        onClick={() => {
                                            onSelectVoice(v.id);
                                            setName(v.name);
                                        }}
                                    >
                                        {isSelected ? "Selected" : "Select"}
                                    </Button>

                                }
                            >
                                <ListItemButton
                                    onClick={() => togglePlayback(v)}
                                    sx={{ pr: 2, color: darkModeReducer ? '#ffffff' : '#ffffff', }} // space before secondaryAction
                                >
                                    {/* name + emotion + indicator icon */}
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={0.5}  >
                                                <Typography fontWeight={500} >
                                                    {`${v.name} • ${v.emotion}`}
                                                </Typography>
                                                {isPlaying ? (
                                                    <PauseIcon fontSize="small" />
                                                ) : (
                                                    <PlayArrowIcon fontSize="small" />
                                                )}
                                            </Stack>
                                        }
                                        secondary={`${v.gender}`}
                                        slotProps={{
                                            secondary: {
                                                sx: {
                                                    color: darkModeReducer
                                                        ? theme.palette.grey[400]
                                                        : theme.palette.grey[400],
                                                },
                                            },
                                        }}
                                    />
                                    {/* check mark for currently-selected voice */}
                                    {isSelected && (
                                        <CheckCircleIcon
                                            fontSize="small"
                                            sx={{ color: theme.palette.success.main, ml: 1, }}
                                        />
                                    )}
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </DialogContent >
        </Dialog >
    );
};

export default VoicePicker;
