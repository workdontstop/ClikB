import React, { useCallback, useEffect, useRef, useState } from "react";
import { Slider, Stack, useMediaQuery, useTheme } from "@mui/material";
// import { matchMobile } from "./yourâ€‘vars"  â† user will add the real import

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
import { setLoggedUser } from "./profileSlice";




/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * AudioPickerPlayer â€“ <audio> element + hiddenâ€‘thumb trim slider
 * --------------------------------------------------------------------------
 * â€¢ Thumbs + timestamp labels are visually hidden.
 * â€¢ Slider rail/thickness grows on mobile (`matchMobile`).
 * â€¢ Trim window fixed at exactly 15â€¯s (or full audio if shorter).
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

}

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const MIN_TRIM_SECONDS = 10;

const AudioPickerPlayer: React.FC<AudioPickerPlayerProps> = ({
    src,
    accentColor = "#F6BB56",
    onEnded,
    onTrimChange,
    AudioName,
    setGotmp3,
    callMusic,
    onAudioReady
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const audioRef = useRef<HTMLAudioElement>(null);
    const [duration, setDuration] = useState<number>(0);
    const [trim, setTrim] = useState<[number, number]>([0, 0]);


    const [isLoading, setisLoading] = useState(false);
    const [LoadData, setLoadData] = useState('');


    const [OriginalAudio, setOriginalAudio] = useState('');

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );

    const darkMode = darkModeReducer;


    const loggedUser = useSelector(
        (state: RootState) => state.profile.loggedUser
    );


    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ sync source */
    useEffect(() => {
        if (!audioRef.current || !src) return;
        audioRef.current.pause();
        audioRef.current.src = src;
        audioRef.current.load();
    }, [src]);

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ load meta */
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const meta = () => {
            const d = Number.isFinite(el.duration) ? el.duration : 0;
            setDuration(d);
            setTrim([0, d]);
            onTrimChange?.(0, d);
        };
        el.addEventListener("loadedmetadata", meta);
        return () => el.removeEventListener("loadedmetadata", meta);
    }, [src]);

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ clamp playback */
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

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ allow any trim window */
    const clampTrimWindow = (start: number, end: number): [number, number] => {
        const safeStart = Math.max(0, Math.min(start, duration));
        const safeEnd = Math.max(safeStart, Math.min(end, duration));
        return [safeStart, safeEnd];
    };


    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ clamp & loop playback */
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


    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ slider handlers */
    const handleChange = (_: Event, val: number | number[]) => {
        if (!Array.isArray(val)) return;
        const [s, e] = val as number[];
        setTrim(clampTrimWindow(s, e));
    };

    const handleCommit = () => {
        onTrimChange?.(trim[0], trim[1]);
        if (audioRef.current) audioRef.current.currentTime = trim[0];
    };

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ sizes */
    // `matchMobile` should be provided by the caller; fallback to 12 if undefined
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const rail = isMobile ? 50 : 40;


    const buttonPadding = { px: 3, py: 1.5 };


    // 1ï¸âƒ£ Generate a presigned upload URL for ONE audio blob
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

    // 2ï¸âƒ£ Upload a single (original) audio file to S3 and return its final URL
    const uploadOriginalAudioToS3 = useCallback(async (localAudioUrl: any): Promise<any> => {
        const totalTrim = Math.max(0, trim[1] - trim[0]);
        if (totalTrim <= 0) {
            alert('Select an audio range first');
            return null;
        }

        if (totalTrim < MIN_TRIM_SECONDS) {
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

            // Strip query params â†’ final S3 path
            const finalAudioUrl = urlAudio.split("?")[0];


            setOriginalAudio(finalAudioUrl);

            await createTrimmedAudio(finalAudioUrl);
            // TODO: optionally persist `postId`, `enhanceCaption`, finalAudioUrl to DB

            return finalAudioUrl; // usable S3 path
    }, [trim])




    // 3ï¸âƒ£ Request MediaConvert (or backend) to cut the clip
    //    POST â†’ `${CLIK_URL}/create-trimaudio`
    // 1ï¸âƒ£  place this near the top of your component
    const [trimmedAudioUrl, setTrimmedAudioUrl] = useState<string | null>(null);

    // 2ï¸âƒ£  update createTrimmedAudio
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
                    `${CLIK_URL}/create-trimaudio`,
                    dataForTranscode,
                    { withCredentials: true }
                );

                // backend responds { audioUrl: "https://bucket.s3....mp3", ... }
                const { audioUrl } = res.data as { audioUrl: string };

                // 3ï¸âƒ£  save it in state
                setTrimmedAudioUrl(audioUrl);

                // alert(audioUrl);


                await saveToDatabase(audioUrl);

                // optional: also return it
                return audioUrl;
            } catch (err) {

                setisLoading(false);

                console.error("Trim-audio request failed:", err);
                throw err;
            }
        },
        [trim]
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
                <audio ref={audioRef} controls loop style={{ width: "100%", accentColor, marginTop: isMobile ? '8vh' : '5vh' }} />

                {duration > 0 && (
                    <Slider
                        value={trim}
                        min={0}
                        max={duration}
                        step={0.1}
                        disableSwap
                        onChange={handleChange}
                        onChangeCommitted={handleCommit}
                        sx={{
                            color: accentColor,
                            height: rail,
                            "& .MuiSlider-track, & .MuiSlider-rail": { height: rail },
                            "& .MuiSlider-thumb": {
                                width: 0,
                                height: 0,
                                p: 0,
                                m: 0,
                                visibility: "hidden",
                            },
                        }}
                    />


                )}

                <Button
                    variant="outlined"
                    disabled={duration <= 0}
                    onClick={() => {
                        const nextTrim: [number, number] = [0, duration];
                        setTrim(nextTrim);
                        onTrimChange?.(nextTrim[0], nextTrim[1]);
                        if (audioRef.current) audioRef.current.currentTime = 0;
                    }}
                    sx={{
                        color: darkMode ? "#F6BB56" : "#DA8E0B",
                        borderColor: darkMode ? "#F6BB56" : "#DA8E0B",
                        ...buttonPadding,
                        borderRadius: 2,
                        margin: 'auto',
                        textTransform: "none",
                    }}
                >
                    Full Song
                </Button>

                <Button

                    variant="contained"
                    color="primary"
                    onClick={() => {


                        /// setisLoading(true);
                        ///setLoadData('Uploading')

                        uploadOriginalAudioToS3(src);
                    }}
                    sx={{

                        color: darkMode ? "#F6BB56" : "#DA8E0B",
                        flex: 1, // Ensures this button takes equal space as the left button
                        marginTop: "3px",
                        backgroundColor: darkMode ? "#1e1e1e" : "#f5f5f5",

                        ...buttonPadding,
                        borderRadius: 2,
                        margin: 'auto',
                        textAlign: 'auto',
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                        "&:hover": {
                            backgroundColor: darkMode ? "#bbbbbb" : "#555555",
                            color: darkMode ? "#000000" : "#ffffff",
                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                        },
                    }}
                >
                    Publish
                </Button>


            </Stack >



        </>
    );
};

export default AudioPickerPlayer;
