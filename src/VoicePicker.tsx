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

import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';


import { useSelector, useDispatch } from "react-redux";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import DeveloperModeIcon from "@mui/icons-material/DeveloperMode";
import axios from "axios";
import CircularProgress from "@mui/material/CircularProgress";
const CLIK_URL = import.meta.env.VITE_CLIK_URL;

import { matchMobile } from "./DetectDevice";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Types
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    type: any,
    MemeMusic: any
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Default voices (if none are passed in)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const defaultVoices: Voice[] = [
    {
        "id": "Zephyr",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-eef20480b0b0285f2de0195ddc50ebc5.mp3",
        "name": "Zephyr",
        "emotion": "Bright",
        "gender": "Female"
    },
    {
        "id": "Puck",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-1f5b099f09a4b39c38e669bd0460d9dd.mp3",
        "name": "Puck",
        "emotion": "Upbeat",
        "gender": "Male"
    },
    {
        "id": "Kore",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-89665cf8e9418f0e9fa27bda9f511755.mp3",
        "name": "Kore",
        "emotion": "Firm",
        "gender": "Female"
    },
    {
        "id": "Charon",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-4c77fed3ffcccb0e44553c918542ca17.mp3",
        "name": "Charon",
        "emotion": "Mysterious",
        "gender": "Male"
    },
    {
        "id": "Leda",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5bcde8e7737ee8eab3f64ac428b3a778.mp3",
        "name": "Leda",
        "emotion": "Calm",
        "gender": "Female"
    },
    {
        "id": "Fenrir",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-0ecd2a46802b6054b7069f6deda884b2.mp3",
        "name": "Fenrir",
        "emotion": "Excitable",
        "gender": "Male"
    },
    {
        "id": "Aoede",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-45ac4df46ff7b180416793679ca26e9c.mp3",
        "name": "Aoede",
        "emotion": "Lyrical",
        "gender": "Female"
    },
    {
        "id": "Orus",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-6806f2b96a741dfa2fab55840ebcf532.mp3",
        "name": "Orus",
        "emotion": "Deep",
        "gender": "Male"
    },
    {
        "id": "Callirrhoe",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-59c6c900223d2dfdf200a28fce986c00.mp3",
        "name": "Callirrhoe",
        "emotion": "Gentle",
        "gender": "Female"
    },
    {
        "id": "Enceladus",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-9f7fcff725015f515d19983e986e0485.mp3",
        "name": "Enceladus",
        "emotion": "Resonant",
        "gender": "Male"
    },
    {
        "id": "Autonoe",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5fd4e7f22f0b63f3e0dcf31430eefed8.mp3",
        "name": "Autonoe",
        "emotion": "Smooth",
        "gender": "Female"
    },
    {
        "id": "Iapetus",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-62a997c00eb23deba3188a6e2a9a61b4.mp3",
        "name": "Iapetus",
        "emotion": "Gravelly",
        "gender": "Male"
    },
    {
        "id": "Despina",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-e95c82d61222e9f151aec43d954b860a.mp3",
        "name": "Despina",
        "emotion": "Clear",
        "gender": "Female"
    },
    {
        "id": "Umbriel",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-08dc0816df6f93b541843364a93b923b.mp3",
        "name": "Umbriel",
        "emotion": "Shadowy",
        "gender": "Male"
    },
    {
        "id": "Erinome",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5c41fe35b90a9a9c1dc0ed46aba21393.mp3",
        "name": "Erinome",
        "emotion": "Warm",
        "gender": "Female"
    },
    {
        "id": "Algenib",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-a4dac817bd9f810d13ce008d97a00916.mp3",
        "name": "Algenib",
        "emotion": "Gruff",
        "gender": "Male"
    },
    {
        "id": "Laomedeia",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-a5180c8d80b7c9dd114ac7493eb119aa.mp3",
        "name": "Laomedeia",
        "emotion": "Steady",
        "gender": "Female"
    },
    {
        "id": "Algieba",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-ebdb2dc65ce2d0d7e3051e1ba98a134c.mp3",
        "name": "Algieba",
        "emotion": "Robust",
        "gender": "Male"
    },
    {
        "id": "Achernar",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-b7878ff88d4fc0c6421fc040f49436e3.mp3",
        "name": "Achernar",
        "emotion": "Authoritative",
        "gender": "Female"
    },
    {
        "id": "Schedar",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-2ac36f8cff57f429d503180239f37b9c.mp3",
        "name": "Schedar",
        "emotion": "Bold",
        "gender": "Male"
    },
    {
        "id": "Gacrux",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-39331a00bcd6d316ff4a7342e62183c4.mp3",
        "name": "Gacrux",
        "emotion": "Vibrant",
        "gender": "Female"
    },
    {
        "id": "Achird",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-815bed4b849bbf8cb4f7af1a5146e644.mp3",
        "name": "Achird",
        "emotion": "Warm",
        "gender": "Male"
    },
    {
        "id": "Pulcherrima",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-553c0e7d8029a59f36ed1c1577eb59c2.mp3",
        "name": "Pulcherrima",
        "emotion": "Elegant",
        "gender": "Female"
    },
    {
        "id": "Zubenelgenubi",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-e2c65131bb1c8eb7ccdee21aa4adcb4d.mp3",
        "name": "Zubenelgenubi",
        "emotion": "Commanding",
        "gender": "Male"
    },
    {
        "id": "Vindemiatrix",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-93769a11bedaefc18634f6c993b34dc1.mp3",
        "name": "Vindemiatrix",
        "emotion": "Soft",
        "gender": "Female"
    },
    {
        "id": "Sadachbia",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-3735d96a71296b6609ac55edfff4750e.mp3",
        "name": "Sadachbia",
        "emotion": "Mellow",
        "gender": "Male"
    },
    {
        "id": "Sulafat",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-dd8a98f506e9b5f73e823720210c1063.mp3",
        "name": "Sulafat",
        "emotion": "Rich",
        "gender": "Female"
    },
    {
        "id": "Sadaltager",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-68ab6b7ecd5565bbf48e021c2d8ceb8f.mp3",
        "name": "Sadaltager",
        "emotion": "Smooth",
        "gender": "Male"
    },
    {
        "id": "Alnilam",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-71bcdb0e8d53747465f37ffe94dee36b.mp3",
        "name": "Alnilam",
        "emotion": "Clear",
        "gender": "Male"
    },
    {
        "id": "Rasalgethi",
        "url": "https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5b2295c0d657ac304fd01319188e78db.mp3",
        "name": "Rasalgethi",
        "emotion": "Strong",
        "gender": "Male"
    }
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Component
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const VoicePicker: React.FC<VoicePickerProps> = ({
    showVoicesList,
    selectedVoice,
    onClose,
    onSelectVoice,
    darkMode = false,
    voices = defaultVoices,
    setName,
    setMemeMusic,
    type,
    MemeMusic
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [generatingDev, setGeneratingDev] = useState(false);

    const generateAllVoiceSamples = async () => {
        setGeneratingDev(true);
        try {
            const devJokes = [
                "Why don't skeletons fight each other? They don't have the guts.",
                "I told my wife she was drawing her eyebrows too high. She looked surprised.",
                "What do you call a fake noodle? An impasta.",
                "Why did the scarecrow win an award? Because he was outstanding in his field.",
                "I would avoid the sushi if I was you. Itâ€™s a little fishy.",
                "Want to hear a joke about construction? I'm still working on it.",
                "I used to play piano by ear, but now I use my hands.",
                "Why don't eggs tell jokes? They'd crack each other up.",
                "I'm reading a book on anti-gravity. I just can't put it down.",
                "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.",
                "Why did the math book look sad? Because of all of its problems.",
                "Parallel lines have so much in common. Itâ€™s a shame theyâ€™ll never meet.",
                "My wife asked me to stop singing 'Wonderwall' to her. I said maybe.",
                "I only know 25 letters of the alphabet. I don't know y.",
                "What do you call a factory that makes okay products? A satisfactory.",
                "Why do bees have sticky hair? Because they use a honeycomb.",
                "I asked my dog what's on top of the house. He said, 'Roof!'",
                "Why did the invisible man turn down the job offer? He couldn't see himself doing it.",
                "I don't trust stairs. They're always up to something.",
                "What do you call a bear with no teeth? A gummy bear.",
                "I tried to catch some fog earlier. I mist.",
                "How does a penguin build its house? Igloos it together.",
                "What do you call cheese that isn't yours? Nacho cheese.",
                "Why don't scientists trust atoms? Because they make up everything.",
                "What did one wall say to the other? I'll meet you at the corner.",
                "Why did the bicycle fall over? Because it was two-tired.",
                "What do you call a snowman with a six-pack? An abdominal snowman.",
                "How do you organize a space party? You planet.",
                "Why did the coffee file a police report? It got mugged.",
                "What did the ocean say to the beach? Nothing, it just waved."
            ];
            const newVoices = [];

            for (let i = 0; i < voices.length; i++) {
                const voice = voices[i];
                const jokePrompt = devJokes[i % devJokes.length];

                console.log(`Generating for ${voice.name}...`);
                const requestData = {
                    text: jokePrompt,
                    voice: voice.id,
                    prompt: "DIRECTOR'S NOTES: Deliver this joke with great comedic timing.",
                    language_code: "en-US"
                };

                const response = await axios.post(
                    `${CLIK_URL}/generateReplicateAudio`,
                    requestData,
                    {
                        headers: { "Content-Type": "application/json" },
                        withCredentials: true,
                    }
                );

                const audioContent = response?.data?.audioContent;
                if (!audioContent) {
                    console.error(`Failed to get audio for ${voice.name}`);
                    newVoices.push({ ...voice });
                    continue;
                }

                const audioBuffer = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
                const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });

                const countRes = await axios.post(
                    `${CLIK_URL}/get_signed_url_audioStory`,
                    { values: { count: 1 } },
                    { withCredentials: true }
                );
                const holder = countRes?.data?.holder;
                if (!holder || !holder[0]?.urlAudio) {
                     console.error(`Failed to get S3 signed URL for ${voice.name}`);
                     newVoices.push({ ...voice });
                     continue;
                }

                const signedObj = holder[0];
                await axios.put(signedObj.urlAudio, audioBlob, {
                    headers: { "Content-Type": "audio/mp3" }
                });

                const uploadedUrl = signedObj.urlAudio.split("?")[0];
                console.log(`Success for ${voice.name}: ${uploadedUrl}`);
                newVoices.push({ ...voice, url: uploadedUrl });
            }

            console.log("ALL VOICES GENERATED:");
            console.log(JSON.stringify(newVoices, null, 2));
            alert("All demo voices generated and uploaded. Check the console!");
        } catch (err) {
            console.error("Dev generation failed:", err);
            alert("Dev generation failed, check console.");
        } finally {
            setGeneratingDev(false);
        }
    };

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

                <Button
                    onClick={generateAllVoiceSamples}
                    disabled={generatingDev}
                    component="span"
                    size="small"
                    variant="outlined"
                    startIcon={generatingDev ? <CircularProgress size={16} color="inherit" /> : <DeveloperModeIcon />}
                    sx={{
                        display: 'none',
                        color: darkModeReducer ? "#ffffff" : "#ffffff",
                        borderColor: darkModeReducer ? "#ffffff" : "#000000",
                        textTransform: "none",
                        fontSize: 14,
                        marginRight: '1vw'
                    }}
                >
                    {generatingDev ? "Loading..." : "Dev"}
                </Button>

                <Button

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
                </Button>

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


                                            backgroundColor: isSelected ? (darkModeReducer ? '#E8BAFA' : '#0099cc') : '',
                                            borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                            color: isSelected ? (darkModeReducer ? '#000000' : '#ffffff') : (darkModeReducer ? '#E8BAFA' : '#0099cc'),

                                            '&:hover': {
                                                borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                            },
                                            '&:active': {
                                                backgroundColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                                borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                                color: darkModeReducer ? '#000000' : '#ffffff',
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
                                                    {`${v.name} â€¢ ${v.emotion}`}
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
