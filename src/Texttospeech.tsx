import React, { useCallback, useMemo, useState, useEffect } from "react";
import axios from "axios";
import {
    Box,
    IconButton,
    Typography,
    Button,
    Stack,
    Divider,
} from "@mui/material";

import { TextField, FilledInput } from '@mui/material';

import DeleteIcon from "@mui/icons-material/Delete";



import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import VoicePickerx from "./VoicePickerx"; // <-- uses your existing component setIsGenerating

import AudioPicker2 from "./AudioPicker2"; // <-- uses your existing component

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";

type IdMode = 0 | 1 | 2;

interface TextToSpeechProps {
    /** When true, component is rendered as a bottom sheet overlay */
    Addvoice: boolean;
    /** 0 = main, 1 = sub1, 2 = sub2 */
    identifier: IdMode;
    /** Close handler for the X icon */
    onClose: () => void;

    /** Setters for where to store the resulting S3 audio URL */
    setMainAudioUrl: (url: string) => void;
    setSub1AudioUrl: (url: string) => void;
    setSub2AudioUrl: (url: string) => void;

    setMainAudioUrlx: (url: string) => void;
    setSub1AudioUrlx: (url: string) => void;
    setSub2AudioUrlx: (url: string) => void;

    mainAudioUrlx: any;
    sub1AudioUrlx: any;
    sub2AudioUrlx: any;

    interactionPostId: any;
    mainAudioUrl: any; sub1AudioUrl: any; sub2AudioUrl: any;

    // ðŸ›‘ NEW PROP: Setter to lock navigation
    setIsGenerating: (isGenerating: boolean) => void;
}

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;

const titleFor = (id: IdMode) =>
    id === 0 ? "Main Voice" : id === 1 ? "Sub1 Voice" : "Sub2 Voice";

const titleForx = (id: IdMode) =>
    id === 0 ? "Main Song" : id === 1 ? "Sub1 Song" : "Sub2 Song";


/* ------------------------------------------------------------------
   NEW: Voice samples for inline preview (uses your provided list)
------------------------------------------------------------------- */
type Voice = {
    id: string;
    url: string;
    name: string;
    emotion: string;
    gender: "Male" | "Female";
};

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

/** Helper: your signed-URL flow for a single audio */
const generateSignedUrlForSingleAudio = async (audioBlob: Blob) => {
    if (!audioBlob) throw new Error("No audio Blob to generate a signed URL.");

    const requestData = { values: { count: 1 } };
    const response: any = await axios.post(
        `${CLIK_URL}/get_signed_url_audioStory`,
        requestData,
        { withCredentials: true }
    );

    const holder = response.data.holder;
    if (!holder || !Array.isArray(holder) || holder.length !== 1) {
        throw new Error("Invalid response from signed URL endpoint.");
    }

    const signed = holder[0];
    if (!signed.urlAudio) throw new Error("Missing signed URL for audio.");
    return signed as { urlAudio: string };
};

const Texttospeech: React.FC<TextToSpeechProps> = ({
    Addvoice,
    identifier,
    onClose,
    setMainAudioUrl,
    setSub1AudioUrl,
    setSub2AudioUrl,
    interactionPostId,
    mainAudioUrl, sub1AudioUrl, sub2AudioUrl,
    mainAudioUrlx, sub1AudioUrlx, sub2AudioUrlx,
    setMainAudioUrlx, setSub1AudioUrlx, setSub2AudioUrlx,
    // âœ… Destructure the new prop
    setIsGenerating


}) => {
    const [text, setText] = useState("");
    const [selectedVoice, setSelectedVoice] = useState("en-US-Chirp-HD-O"); // your default
    const [selectedVoiceName, setSelectedVoiceName] = useState("Orion");
    const [showVoices, setShowVoices] = useState(false);

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );



    const [music, setmusic] = useState('');
    const [musicname, setmusicname] = useState('');

    const [showVoicesListx, setshowVoicesListx] = useState(true);
    const [MemeMusicx, setMemeMusicx] = useState(true);



    const [loading, setLoading] = useState(false);

    const [Music, setMusic] = useState(false);

    const [MusicUsed, setMusicUsed] = useState(false);


    const [retry, setretry] = useState(false);

    const [status, setStatus] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const modeTitle = useMemo(() => titleFor(identifier), [identifier]);

    const modeTitlex = useMemo(() => titleForx(identifier), [identifier]);

    /* NEW: Resolve a sample audio URL for the currently selected voice */
    const selectedSampleUrl = useMemo(() => {
        const v = defaultVoices.find((x) => x.id === selectedVoice);
        return v?.url || "";
    }, [selectedVoice]);


    useEffect(() => {
        setPreviewUrl('');
        setMusicUsed(false);
        setretry(false);
    }, [Addvoice])

    const [src, setsrc] = useState('');

    useEffect(() => {
        setTimeout(() => {
            var tt = identifier === 0 ?
                mainAudioUrl : identifier === 1 ? sub1AudioUrl : sub2AudioUrl;



            setsrc(tt);
        }, 200);



    }, [identifier, mainAudioUrl, sub1AudioUrl, sub2AudioUrl])

    const handleStoreUrl = (url: string) => {


        if (identifier === 0) setMainAudioUrl(url);
        else if (identifier === 1) setSub1AudioUrl(url);
        else setSub2AudioUrl(url);


    };

    const handleStoreUrlx = (url: string) => {
        if (identifier === 0) setMainAudioUrlx(url);
        else if (identifier === 1) setSub1AudioUrlx(url);
        else setSub2AudioUrlx(url);
    };


    // Paste this inside your component, before the return()
    const handleClearAudio = async () => {
        try {
            setmusic('');
            setPreviewUrl('');
            setsrc('');
            setMusicUsed(false);
            setretry(false);
            handleStoreUrl('');

            // Save null to DB to remove it permanently
            await saveAudioUrl(interactionPostId, identifier, null);
        } catch (e) {
            console.error("Failed to clear audio", e);
        }
    };

    const saveAudioUrl = useCallback(
        async (postId: number | string, identifier: 0 | 1 | 2, audioUrl: string | null) => {
            const body = {
                values: {
                    id: postId,
                    identifier,    // 0 | 1 | 2
                    audioUrl,      // pass null to clear
                    userId: loggedUser?.id ?? null,
                },
            };

            try {
                const res = await axios.put(`${CLIK_URL}/audioSave`, body);
                console.log("âœ… audio saved", res.data);



                return res.data;
            } catch (err) {
                console.error("âŒ saveAudioUrl failed", err);
                throw err;
            }
        },
        [loggedUser?.id]
    );


    useEffect(() => {
        if (!music) return; // nothing to do

        let cancelled = false;

        const run = async () => {
            try {
                setPreviewUrl(music);
                handleStoreUrl(music); // updates main/sub url

                await saveAudioUrl(interactionPostId, identifier, music);

                if (cancelled) return;
                setMusicUsed(true);
                setmusic(""); // clear selection
            } catch (err) {
                console.error("Failed to save music:", err);
            }
        };

        run();

        return () => {
            cancelled = true;
        };
        // include stable deps used inside
    }, [music, saveAudioUrl, interactionPostId, identifier, handleStoreUrl]);



    const [activeAudioUrl, setActiveAudioUrl] = useState<string>("");

    // keep activeAudioUrl in sync with identifier + all audio urls
    useEffect(() => {
        const next =
            identifier === 0 ? mainAudioUrl :
                identifier === 1 ? sub1AudioUrl :
                    sub2AudioUrl;

        // only update if we actually have a value (and avoid redundant sets)
        if (next && next !== activeAudioUrl) {
            setActiveAudioUrl(next);
        }
    }, [identifier, mainAudioUrl, sub1AudioUrl, sub2AudioUrl, activeAudioUrl]);



    const startDeleteAudio = async (audioUrl: any) => {
        try {

            /// setLoadingDatabase2(true);
            //del-
            await axios.post(
                `${CLIK_URL}/del-audio`,
                { url: audioUrl },          // <-- body
                { withCredentials: true }   // <-- config
            );

            // success: update UI, toast, etc.
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            /// setLoadingDatabase2(false);
        }
    };



    const generateAudio = useCallback(async () => {
        if (!text.trim()) {
            setStatus("Please enter some text first.");
            return;
        }
        try {
            // ðŸ›‘ LOCK NAVIGATION
            setIsGenerating(true);

            startDeleteAudio(identifier === 0 ? mainAudioUrlx :
                identifier === 1 ? sub1AudioUrlx :
                    sub2AudioUrlx);

            setLoading(true);
            setStatus("Generating audioâ€¦");

            // Build Gemini TTS request payload
            const requestData = {
                text,
                voice: selectedVoice,
                prompt: "DIRECTOR'S NOTES: Clear and expressive delivery.",
                language_code: "en-US"
            };

            // Call local Gemini TTS endpoint
            const response: any = await axios.post(
                `${CLIK_URL}/generateReplicateAudio`,
                requestData,
                {
                    headers: { "Content-Type": "application/json" },
                    withCredentials: true
                }
            );

            const audioContent = response.data?.audioContent;
            if (!audioContent) throw new Error("No audioContent in response.");

            // Convert base64 to Blob
            const audioBuffer = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0));
            const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

            // Local preview URL


            setStatus("Uploading to S3â€¦");

            // Get a signed URL and upload
            const { urlAudio } = await generateSignedUrlForSingleAudio(audioBlob);
            await axios.put(urlAudio, audioBlob, {
                headers: { "Content-Type": audioBlob.type || "audio/mpeg" },
            });

            const localUrl = URL.createObjectURL(audioBlob);
            const finalUrl = urlAudio.split("?")[0];
            setPreviewUrl(finalUrl);


            handleStoreUrl(finalUrl);
            setMusicUsed(false);
            handleStoreUrlx(finalUrl);
            setretry(true)



            await saveAudioUrl(interactionPostId, identifier, finalUrl);


            setStatus("Done! Saved to project.");
        } catch (err: any) {
            console.error("TTS Error:", err?.message || err);
            setStatus(err?.message || "Failed to generate audio.");
        } finally {
            setLoading(false);
            // ðŸ›‘ UNLOCK NAVIGATION (whether success or fail)
            setIsGenerating(false);
        }
    }, [text, selectedVoice, identifier, setIsGenerating]); // Added setIsGenerating to dependency array

    if (!Addvoice) return null;

    return (
        <Box
            role="dialog"
            aria-label="Text to Speech"
            sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "74%",
                width: "100%",
                bgcolor: darkModeReducer ? '#000000' : '#ffffff',
                // snug to parent: no padding
                p: 0,
                boxShadow: "0 -8px 28px rgba(0,0,0,0.35)",
                display: "flex",
                flexDirection: "column",
                zIndex: 999, // above your stage UI
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: 56,
                    px: 2, // visual comfort inside header only
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <MusicNoteIcon fontSize="small" />
                    <Typography fontWeight={700}>

                        {Music ?
                            modeTitlex : modeTitle}</Typography>
                </Stack>

                <Button
                    variant='contained'
                    onClick={() => {

                        setMusic(!Music);
                    }}
                    disabled={loading}
                    fullWidth
                    sx={{ py: 1.25, fontWeight: 700, borderRadius: 2, width: '40%', backgroundColor: 'green' }}
                >
                    {Music ? 'Voice' : 'Music'}
                </Button>
                <IconButton onClick={onClose} aria-label="Close" >
                    <CloseIcon style={{
                        color: darkModeReducer ? '#ffffff' : '#000000',
                    }} />
                </IconButton>
            </Box>

            <Divider />
            <Box>
                {/* Body (no outer padding, internal controls fill width) */}
                <Box
                    sx={{
                        flex: "1 1 auto",
                        overflow: "auto",
                        /// display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        px: 2, // light internal spacing for inputs
                        py: 1,
                        display: Music ? 'none' : 'flex'
                    }}
                >


                    <TextField
                        variant="filled"
                        label="Enter Text to synthesize"
                        placeholder="text to voiceâ€¦"
                        multiline
                        minRows={4}
                        maxRows={8}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        fullWidth
                        helperText={`${text.length}/65`} // optional counter

                        /* modern MUI syntax */
                        slots={{ input: FilledInput }}
                        slotProps={{
                            /* native <input> attributes live here now */
                            htmlInput: {
                                maxLength: 65,                  // was inputProps={{ maxLength: 65 }}
                                'aria-label': 'Text to synthesize',
                            },
                            /* helper text props live here now */
                            formHelperText: {
                                sx: { textAlign: 'right' },     // was FormHelperTextProps={{ sx: { textAlign: 'right' } }}
                            },
                        }}

                        /* caret added explicitly */
                        sx={{


                            "& .MuiInputLabel-root": {
                                color: darkModeReducer ? "#ffffff" : "#000000", // Label color
                            },
                            "& .MuiInputBase-input": {
                                color: darkModeReducer ? "#ffffff" : "#000000", // Text color
                                caretColor: 'auto !important',
                            },
                        }}
                    />



                    <Stack direction="row" spacing={0} alignItems="center" sx={{
                        margin: 'auto', width: '100%', textAlign: 'center',
                        paddingBottom: '1vh',

                    }}>
                        <TextField
                            label="Voice ID"
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            style={{ display: 'none' }}
                            fullWidth
                        />
                        <Button
                            variant="outlined"
                            onClick={handleClearAudio}
                            startIcon={<DeleteIcon />}
                            sx={{
                                whiteSpace: "nowrap",
                                flex: 1, // This makes it take 50%
                                width: '50%',
                                opacity: (!previewUrl && !src) ? 0.5 : 1, // Dim if empty
                                color: 'gray',
                                border: '2px solid gray',
                                fontWeight: 700,
                                '&:hover': {
                                    border: '2px solid black',
                                    color: 'black',
                                    backgroundColor: 'rgba(0,0,0,0.05)'
                                }
                            }}
                        >
                            Clear
                        </Button>

                        {/* CHOOSE VOICE BUTTON (50%) */}
                        <Button
                            variant="outlined"
                            onClick={() => setShowVoices(true)}
                            sx={{
                                whiteSpace: "nowrap",
                                flex: 1, // This makes it take 50%
                                width: '50%',
                                opacity: MusicUsed ? 0.3 : 1,
                                color: 'red',
                                border: '2px solid red',
                                fontWeight: 700,
                                '&:hover': {
                                    border: '2px solid darkred',
                                    color: 'darkred',
                                    backgroundColor: 'rgba(255,0,0,0.05)'
                                }
                            }}
                        >
                            Choose Voice
                        </Button>
                    </Stack>

                    <br></br>
                    <Typography variant="body1" sx={{ opacity: 0.85, textAlign: 'center' }}>
                        {MusicUsed ? 'Preview Music' : 'Preview Audio'}
                    </Typography>

                    {/* NEW: inline preview of the currently selected voice */}
                    {previewUrl ? (
                        <Box sx={{ mt: 1 }}>
                            <audio controls src={previewUrl} style={{ width: "100%" }} />
                        </Box>
                    ) :

                        (<Box sx={{ mt: 1 }}>
                            <audio controls src={src} style={{ width: "100%" }} />
                        </Box>)}



                    <Stack direction="row" spacing={1} alignItems="center" sx={{
                        paddingBottom: '8vh',

                    }}>


                        {retry ?

                            <>


                                <Button
                                    variant='outlined'
                                    onClick={generateAudio}
                                    disabled={loading}
                                    fullWidth
                                    sx={{
                                        py: 1.25, fontWeight: 700, borderRadius: 2, backgroundColor: 'red', color: '#ffffff',
                                        opacity: MusicUsed ? 0.3 : 1,
                                    }}
                                >
                                    {loading ? "Runningâ€¦" : "Re-Generate"}
                                </Button>



                            </> :

                            <Button
                                variant="contained"
                                onClick={generateAudio}
                                disabled={loading}
                                fullWidth
                                sx={{
                                    py: 1.25, fontWeight: 700, borderRadius: 2, backgroundColor: 'red',
                                    opacity: MusicUsed ? 0.3 : 1,
                                }}
                            >


                                {MusicUsed ? 'Using Music' : loading ? "Generatingâ€¦" : "Generate Audio"}
                            </Button>

                        }

                        <Button

                            variant="contained"
                            onClick={() => {



                                onClose();


                            }}
                            disabled={loading}
                            fullWidth
                            sx={{
                                py: 1.25, fontWeight: 700, borderRadius: 2, backgroundColor: 'green',
                                opacity: 1,
                            }}
                        >


                            {MusicUsed ? 'Done' : ' Done'}
                        </Button>

                    </Stack>





                    {status && (
                        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8 }}>
                            {//status
                            }
                        </Typography>
                    )}





                </Box>

                {/* Voice picker dialog (uses your component & sample voices) */}



                <VoicePickerx
                    showVoicesList={showVoices}
                    selectedVoice={selectedVoice}
                    onClose={() => setShowVoices(false)}
                    onSelectVoice={(voiceId: string) => {
                        setSelectedVoice(voiceId);
                        setShowVoices(false);
                    }}
                    setName={(n: string) => setSelectedVoiceName(n)}
                    setMemeMusic={() => { }}
                    type="voice"
                    previewText={text || "Testing the voice preview."}
                />







            </Box>

            <Box
                sx={{
                    flex: "1 1 auto",
                    /// overflow: "auto",
                    /// display: "flex",
                    flexDirection: "column",
                    zIndex: 20000000000,
                    gap: 1,
                    px: 2, // light internal spacing for inputs
                    py: 1,
                    display: Music ? 'inline' : 'none'
                }}
            >



                {/* NEW â€” inline overlay picker that will always show here */}
                <AudioPicker2
                    open={Music}
                    onClose={() => setMusic(false)}
                    music={music}
                    setmusic={setmusic}
                    setmusicname={setmusicname}
                    MemeMusic={MemeMusicx}
                />


            </Box>
        </Box >


    );
};

export default Texttospeech;
