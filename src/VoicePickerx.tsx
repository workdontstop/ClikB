// VoicePickerx.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    Avatar,
    Typography,
    Button,
    Stack,
    Divider,
    Box,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MusicNoteIcon from "@mui/icons-material/MusicNote";

/* Types */
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
    setName: (name: string) => void;
    setMemeMusic: (v?: any) => void; // kept for compatibility
    type: any;                        // kept for compatibility
    previewText?: string;
    voices?: Voice[];
}

/* Default voices */
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

const VoicePickerx: React.FC<VoicePickerProps> = ({
    showVoicesList,
    selectedVoice,
    onClose,
    onSelectVoice,
    setName,
    setMemeMusic,
    type,
    previewText,
    voices = defaultVoices,
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentSelection = useMemo(
        () => voices.find((v) => v.id === selectedVoice),
        [voices, selectedVoice]
    );

    useEffect(() => {
        if (!showVoicesList && audioRef.current) {
            audioRef.current.pause();
            setPlayingId(null);
        }
    }, [showVoicesList]);

    const [generatingAudio, setGeneratingAudio] = useState(false);

    const togglePlayback = async (voice: Voice) => {
        if (playingId === voice.id && audioRef.current) {
            if (!audioRef.current.paused) {
                audioRef.current.pause();
                setPlayingId(null);
            } else {
                audioRef.current.play();
                setPlayingId(voice.id);
            }
            return;
        }

        if (audioRef.current) audioRef.current.pause();

        let audioUrl = voice.url;
        if (!audioUrl) {
            setGeneratingAudio(true);
            try {
                const sampleText = previewText || "Testing the voice preview.";
                const host = "http://localhost:3000";
                const response = await fetch(`${host}/generateReplicateAudio`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: sampleText,
                        voice: voice.id,
                        prompt: "DIRECTOR'S NOTES: Clear delivery.",
                        language_code: "en-US"
                    })
                });
                const data = await response.json();
                if (data.audioContent) {
                   audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
                }
            } catch (err) {
                console.error("Preview failed:", err);
            } finally {
                setGeneratingAudio(false);
            }
        }

        if (audioUrl) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.play();
            setPlayingId(voice.id);
            audioRef.current.onended = () => setPlayingId(null);
        }
    };

    const handleSelect = (v: Voice) => {
        onSelectVoice(v.id);
        setName(v.name);
    };

    if (!showVoicesList) return null;

    // -------- Portal overlay content --------
    const content = (
        <Box
            // Backdrop
            onClick={onClose}
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483000, // very high
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: fullScreen ? "stretch" : "center",
                justifyContent: "center",
            }}
        >
            {/* Panel (stop click propagation so backdrop closes only when outside) */}
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    width: fullScreen ? "100%" : 560,
                    maxWidth: "100%",
                    height: fullScreen ? "100%" : "80vh",
                    bgcolor: theme.palette.background.paper,
                    borderRadius: fullScreen ? 0 : 2,
                    boxShadow: 24,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 2,
                        height: 56,
                        flexShrink: 0,
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <MusicNoteIcon fontSize="small" />
                        <Typography variant="h6">Choose a voice</Typography>
                    </Stack>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Divider />

                {/* Scrollable list */}
                <Box sx={{ flex: 1, overflow: "auto" }}>
                    <List disablePadding>
                        {voices.map((v) => {
                            const isSelected = v.id === selectedVoice;
                            const isPlaying = v.id === playingId;
                            const initials = v.name
                                .split(" ")
                                .map((s) => s[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase();

                            return (
                                <ListItem
                                    key={v.id}
                                    divider
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        "&:hover": {
                                            backgroundColor:
                                                theme.palette.mode === "dark"
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.03)",
                                        },
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar>{initials}</Avatar>
                                    </ListItemAvatar>

                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Typography fontWeight={600}>{v.name}</Typography>
                                                {isSelected && (
                                                    <CheckCircleIcon
                                                        fontSize="small"
                                                        color="success"
                                                        sx={{ opacity: 0.9 }}
                                                    />
                                                )}
                                            </Stack>
                                        }
                                        secondary={
                                            <Typography variant="body2" color="text.secondary">
                                                {v.emotion} â€¢ {v.gender} â€¢ {v.id}
                                            </Typography>
                                        }
                                    />

                                    <ListItemSecondaryAction>
                                        <Stack direction="row" spacing={1}>
                                            <IconButton
                                                aria-label={isPlaying ? "Pause sample" : "Play sample"}
                                                onClick={() => togglePlayback(v)}
                                            >
                                                {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                            </IconButton>
                                            <Button
                                                variant={isSelected ? "contained" : "outlined"}
                                                onClick={() => handleSelect(v)}
                                                sx={{
                                                    backgroundColor: isSelected ? (theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc') : '',
                                                    borderColor: theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc',
                                                    color: isSelected ? (theme.palette.mode === 'dark' ? '#000000' : '#ffffff') : (theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc'),
                                                    '&:hover': {
                                                        borderColor: theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc',
                                                        backgroundColor: isSelected ? (theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc') : 'transparent',
                                                    }
                                                }}
                                            >
                                                {isSelected ? "Selected" : "Select"}
                                            </Button>
                                        </Stack>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            );
                        })}
                    </List>
                </Box>

                <Divider />

                {/* Footer */}
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                            {currentSelection
                                ? `Selected: ${currentSelection.name} â€¢ ${currentSelection.emotion} (${currentSelection.id})`
                                : "No voice selected"}
                        </Typography>
                    </Box>
                    <Button variant="contained" onClick={onClose} disabled={!currentSelection} sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc', color: theme.palette.mode === 'dark' ? '#000000' : '#ffffff', '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#E8BAFA' : '#0099cc' } }}>
                        Use
                    </Button>
                </Box>
            </Box>
        </Box>
    );

    // Render above everything via portal to <body>
    return ReactDOM.createPortal(content, document.body);
};

export default VoicePickerx;
