// FullScreenStories.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button, Box, Typography, CircularProgress, IconButton } from "@mui/material";

import Sandbox from "./Sandbox"; // adjust the import path as needed

import SmartDisplayIcon from '@mui/icons-material/SmartDisplay';

import { AnimatePresence, motion } from "framer-motion";
import { matchMobile, matchPc } from "./DetectDevice";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import axios from "axios";
import PauseIcon from '@mui/icons-material/Pause';

import { setShowmenuToggle } from "./settingsSlice";

import { useSelector, useDispatch } from "react-redux";
import { useLocation } from 'react-router-dom';
import { useNavigate } from "react-router-dom";

import { activateFullscreenMute, deactivateFullscreenMute } from "./settingsSlice";


import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

import EditPost from "./EditPost";


import {
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";


import { RootState, } from "./store";
import { isIPhone13, isSafari } from "react-device-detect";

interface FeedItem {
    id: number;
    caption: string;
    username: string;
    profile_image: string;
    sender: number;

    // Existing fields
    x1?: string;
    xt1?: string;
    x2?: string;
    xt2?: string;
    x3?: string;
    xt3?: string;
    x4?: string;
    xt4?: string;
    x5?: string;
    xt5?: string;
    x6?: string;
    xt6?: string;
    x7?: string;
    xt7?: string;
    x8?: string;
    xt8?: string;
    item1?: string; // For type 1 items

    // New fields
    captionSummary?: string;
    captionAudio?: string;
    xa1?: string;
    xa2?: string;
    xa3?: string;
    xa4?: string;
    xa5?: string;
    xa6?: string;
    xa7?: string;
    xa8?: string;
    videoUrl?: String;

    xh1?: string;
    xh2?: string;
    xh3?: string;
    xh4?: string;
    xh5?: string;
    xh6?: string;
    xh7?: string;
    xh8?: string;

    xv1?: string;
    xv2?: string;
    xv3?: string;
    xv4?: string;
    xv5?: string;
    xv6?: string;
    xv7?: string;
    xv8?: string;

    mainint?: string;
    int1?: any;
    inttime1?: any;
    intx1?: any;
    inty1?: any;

    int2?: any;
    inttime2?: any;
    intx2?: any;
    inty2?: any;
    mode?: any;

}


interface FullScreenStoriesProps {
    feeds: FeedItem[];
    activeIndex: number | null; // which feed item index is currently active
    setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
    setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
    fullscreenRefsX: React.MutableRefObject<any[]>;
    IsFullscreen: boolean;
    setAudioPlaying: any;
    audioPlaying: boolean;
    setHorizontalActiveIndex: any;
    horizontalActiveIndex: any;
    verticalActiveIndex: any;
    setverticalActiveIndex: any;
    fullScreenContainerRef: any;
    generatedAudios: any;
    setGeneratedAudios: any;
    AudioArray: any;
    setAudioArray: any;
    audioElementRef: any;
    videoArray: any;
    setVideoArray: any;
    feedContainerRef: any;
    LastId: any;
    setLastId: any;
    isMenuOpen: any;
    type: any;
    closePop: any;
    storyVidArray: any;
    setStoryVidArray: any;

}

/**
 * FullScreenStories:
 *  - Renders a vertical, full‑viewport container (with scroll snapping) for all story posts.
 *  - Each post (feed item) is rendered as one full‑viewport “page.”
 *  - The horizontal container for images is laid out (but user scrolling is disabled)
 *    so you can later slide images with JS.
 *  - On mount (or when activeIndex changes), the browser’s TTS narrates the text in xt1.
 *  - Intersection Observer sets `activeStory = false` whenever a new post enters the viewport.
 *
 * NEW FUNCTIONALITY:
 *  - A new horizontal container ref (horizontalContainerRef) is attached (for the active feed only)
 *    and an IntersectionObserver on its children saves the current horizontal active index.
 *  - When an utterance finishes naturally, if the current horizontal index isn’t the last image,
 *    the container scrolls to the next image and that caption’s audio is automatically played.
 *  - Each vertical post is independent. When clicking play on a post that isn’t active,
 *    the activeIndex is updated and its horizontal index reset.
 */
const FullScreenStories: React.FC<FullScreenStoriesProps> = ({
    feeds,
    activeIndex,
    setActiveIndex,
    setIsFullscreen,
    IsFullscreen,
    fullscreenRefsX,
    setAudioPlaying,
    audioPlaying,
    setHorizontalActiveIndex,
    horizontalActiveIndex,
    verticalActiveIndex,
    fullScreenContainerRef,
    setverticalActiveIndex,
    generatedAudios,
    setGeneratedAudios,
    AudioArray,
    setAudioArray,
    audioElementRef,
    videoArray,
    setVideoArray,
    feedContainerRef,
    LastId,
    setLastId,
    isMenuOpen,
    type,
    closePop,
    storyVidArray,
    setStoryVidArray

}) => {
    // Reference to the vertical container so we can scroll to the active post on mount.
    const verticalContainerRef = useRef<HTMLDivElement>(null);
    // Reference for the horizontal container of the active feed.
    const horizontalContainerRef = useRef<any[]>([]);




    const [tshow, settshow] = useState(false);

    const [ActiveCap, setActiveCap] = useState(false);

    const [mp4type, setmp4type] = useState(0);

    const [isOpen, setisOpen] = useState(false);

    const [hidevol, sethidevol] = useState(false);


    const [Hideprofile, setHideprofile] = useState(false);

    const [forceMute, setforceMute] = useState(false);



    const clearAlldefaults = () => { }

    const VITE_ELEVEN_KEY = import.meta.env.VITE_ELEVEN_KEY;
    const dispatch = useDispatch();


    const navigate = useNavigate();


    const VITE__CLOUNDFRONT = import.meta.env.VITE__CLOUNDFRONT;
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const MuteReducer = useSelector((state: RootState) => state.settings.fullscreenMute);

    const voiceOptions = [
        { label: "Adam", value: "pNInz6obpgDQGcFmaJgB" },
        { label: "Antoni", value: "ErXwobaYiN019PkySvjV" },
        { label: "Elli", value: "MF3mGyEYCl7XYWbV9V6O" },
        { label: "Josh", value: "TxGEqnHWrfWFTfG5tAM1" },
        { label: "Arnold", value: "VR6AewLTigWG4xSOukaG" },
        { label: "Bella", value: "EXAVITQu4vr4xnSDxMaL" },
        { label: "Domi", value: "Ew26xBcqzG7TgkS7C7JK" },
        { label: "Sam", value: "2EiwWnXFnvU5JabPnv8n" },
    ];


    const [closeInteraction, setcloseInteraction] = useState(true);

    const [showVoiceSelector, setShowVoiceSelector] = useState(false);
    // Stores the chosen Eleven Labs voice ID
    const [selectedVoice, setSelectedVoice] = useState("");

    const [EnhanceCaption, setEnhanceCaption] = useState('');





    /** hide or show the caption for ONE row */
    function setCapFlag(idx: number, value: boolean) {
        setHideVidCap(prev => {
            const next = [...prev];
            next[idx] = value;
            return next;
        });
    }


    // false ⇢ caption visible   |   true ⇢ caption hidden
    const [hideVidCap, setHideVidCap] = useState<boolean[]>(
        () => feeds.map(() => false)          // length == feeds.length
    );

    useEffect(() => {
        setHideVidCap(prev =>
            // preserve any existing values, default the rest to false
            feeds.map((_, i) => prev[i] ?? false)
        );
    }, [feeds.length]);


    const [Zoom2x, setZoom2x] = useState(false);
    const [Zoom1x, setZoom1x] = useState(false);

    // Replace with your actual API endpoint
    const CLIK_URL = import.meta.env.VITE_CLIK_URL
    const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;

    // Track whether the current story is active (we’ll reset it to false on each new post).
    const [activeStory, setActiveStory] = useState<boolean>(false);
    // Track whether audio is paused (in addition to audioPlaying coming from props)
    const [audioPaused, setAudioPaused] = useState<boolean>(false);

    const [activetext, setactivetext] = useState<boolean>(false);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const [UpdatedCaption, setUpdatedCaption] = useState(false);

    // Hold a reference to the current speech synthesis utterance.
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const [LoadingAudio, setLoadingAudio] = useState<boolean>(false);

    const [playvid, setplayvid] = useState<boolean>(false);


    const [LoadingDatabase, setLoadingDatabase] = useState<boolean>(false);


    const imgRef: any = useRef(null);
    const [isNineTwelve, setIsNineTwelve] = useState(false);

    useEffect(() => {
        const node = imgRef.current;
        if (!node) return;



        const TARGET = 9 / 12;   // 0.75
        const TOL = 0;     // ±2 % wiggle room

        const check = () => {
            const { naturalWidth: w, naturalHeight: h } = node;
            if (!w || !h) return;                     // image not loaded yet
            setIsNineTwelve(w === 1080 && h === 1920);


        };

        // run immediately for cached files
        if (node.complete) check();

        // run when a fresh load finishes
        node.addEventListener("load", check);

        // clean-up when the element unmounts or the slide changes
        return () => node.removeEventListener("load", check);
    }, [verticalActiveIndex, feeds, imgRef.current]);                     // re-measure when the active slide flips



    /* 1️⃣  NEW STATE  –– lives with your other useState hooks            */
    const [firstImageDims, setFirstImageDims] = useState<{
        width: number;
        height: number;
    } | null>(null);




    const [VideoUrl, setVideoUrl] = useState('');


    function setAudioFlag(idx: number, value: boolean) {
        ///alert('jj');
        setAudioPlayingx(prev => {
            const next = [...prev];
            next[idx] = value;
            return next;
        });
    }


    // State for the play/pause icon overlay.intersect
    const [iconOverlay, setIconOverlay] = useState<{ visible: boolean, iconType: 'play' | 'pause' }>({
        visible: false,
        iconType: 'pause'
    });
    const iconTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefn = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefx = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefxx = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefxxa = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefxxa2 = useRef<NodeJS.Timeout | null>(null);

    // one ref per <audio> and per <video>
    const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

    // one Boolean per feed row
    const [audioPlayingx, setAudioPlayingx] = useState<boolean[]>(
        () => feeds.map(() => false)            // initial length = feeds.length
    );



    const [hasvid, sethasvid] = useState(false);
    useEffect(() => {

        if (videoArray[verticalActiveIndex] === '') {


        } else {
            sethasvid(videoArray[verticalActiveIndex]);
        }


    }, [videoArray, verticalActiveIndex]);

    // Auto‑advance function using the Web Speech API.
    const playAudio = useCallback(
        (index: number) => {

            // Cancel any ongoing speech.
            speechSynthesis.cancel();
            if (verticalActiveIndex !== null) {
                const feed = feeds[verticalActiveIndex];
                const storyT = [
                    feed.xt1,
                    feed.xt2,
                    feed.xt3,
                    feed.xt4,
                    feed.xt5,
                    feed.xt6,
                    feed.xt7,
                    feed.xt8,
                ].filter(Boolean);
                const utterance = new SpeechSynthesisUtterance(storyT[index]);
                utterance.onend = () => {
                    if (verticalActiveIndex !== null) {
                        const feed = feeds[verticalActiveIndex];
                        // Gather story images for this feed.
                        const storyImages = [
                            feed.x1,
                            feed.x2,
                            feed.x3,
                            feed.x4,
                            feed.x5,
                            feed.x6,
                            feed.x7,
                            feed.x8,
                        ].filter(Boolean);
                        // Use a functional update to always work with the latest horizontal index.
                        setHorizontalActiveIndex((currentIndex: any) => {

                            /// alert(currentIndex)
                            if (currentIndex < storyImages.length - 1) {
                                const nextIndex = currentIndex + 1;
                                // Scroll to the next image via the horizontal container ref.
                                if (horizontalContainerRef.current[verticalActiveIndex]) {
                                    const child = horizontalContainerRef.current[verticalActiveIndex].children[nextIndex];
                                    if (child) {
                                        (child as HTMLElement).scrollIntoView({
                                            behavior: "instant",
                                            inline: "start",
                                        });
                                    }
                                }



                                // Delay (500ms) to allow the scroll to complete, then call playAudio again.
                                setTimeout(() => {
                                    playAudio(currentIndex);
                                }, 500);
                                return nextIndex;
                            } else {
                                // Reached the last image – stop audio.
                                setAudioPlaying(false);
                                setAudioPaused(false);
                                return currentIndex;
                            }
                        });
                    }
                };
                utterance.onerror = (e) => {
                    console.error("Speech synthesis error", e);
                    setAudioPlaying(false);
                    setAudioPaused(false);
                };
                utteranceRef.current = utterance;
                speechSynthesis.speak(utterance);
                setAudioPlaying(true);
                setAudioPaused(false);
            }
        },
        [activeIndex, feeds, setAudioPlaying, setAudioPaused, horizontalActiveIndex, verticalActiveIndex]
    );





    // Customize padding for both buttons here.
    const buttonPadding = { px: 3, py: 1.5 };


    // Toggle pause/resume functionality.
    const pauseAudio = () => {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
            setAudioPlaying(false);
            setAudioPaused(true);
        } else if (speechSynthesis.paused) {
            speechSynthesis.resume();
            setAudioPlaying(true);
            setAudioPaused(false);
        }
    };

    const stop = () => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();

        }
    }



    const stopAudio = () => {
        stop();

        // Slight delay to let iOS handle the user gesture first
        // Clear any previous icon hide timeout.
        if (iconTimeoutRefx.current) {
            clearTimeout(iconTimeoutRefx.current);
        }
        // Hide the icon overlay after 3 seconds.
        iconTimeoutRefx.current = setTimeout(() => {
            speechSynthesis.cancel();
            // Cleanup
            if (utteranceRef.current) {
                utteranceRef.current.onend = null;
                utteranceRef.current.onerror = null;
                utteranceRef.current = null;
            }
            setAudioPlaying(false);
            setAudioPaused(false);
        }, 300);

    };

    const SILENT_AUDIO_DATAURL =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQgAAAAA";
    // This is a very short (silent) .wav in base64

    // (1) OPTIONAL: Keep a silent audio track playing softly to maintain the audio context.
    const silentAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Create the silent audio object
        const silentAudio = new Audio(SILENT_AUDIO_DATAURL);
        silentAudio.loop = true;
        silentAudio.volume = 0.01; // Almost muted
        silentAudioRef.current = silentAudio;

        // Attempt to play it once user interaction occurs
        const startSilentAudio = () => {
            silentAudio.play().catch(() => {
                // Fail silently if the user hasn’t interacted yet
            });
        };

        // For iOS, you need user interaction before audio can play,
        // so we attach a click/touch listener to start it.
        document.addEventListener("click", startSilentAudio, { once: true });
        document.addEventListener("touchstart", startSilentAudio, { once: true });

        return () => {
            // Cleanup
            if (silentAudioRef.current) {
                silentAudioRef.current.pause();
                silentAudioRef.current.src = "";
            }
            document.removeEventListener("click", startSilentAudio);
            document.removeEventListener("touchstart", startSilentAudio);
        };
    }, []);


    const [isIphone, setIsIphone] = useState(false);

    // 2. Define the check function (could also be placed outside the component).
    function checkIsIphone() {
        // Many iOS browsers include "iPhone" in their userAgent string
        return typeof navigator !== "undefined" && /iPhone/.test(navigator.userAgent);
    }

    // 3. On first render, run the detector and update state.
    useEffect(() => {
        setIsIphone(checkIsIphone());
    }, []); // empty deps → run once after initial render



    // (2) Actual playback logic
    const playStoredAudioChain = useCallback(
        (verticalIdx: number, horizontalIdx: number) => {
            ///if (!audioElementRef.current) return;

            // 1) Grab audio fields from AudioArray
            const audioData = AudioArray[verticalIdx];
            if (!audioData) return;

            // [0] = captionAudio, then xa1..xa8
            const trackList = [
                audioData.captionAudio,
                audioData.xa1,
                audioData.xa2,
                audioData.xa3,
                audioData.xa4,
                audioData.xa5,
                audioData.xa6,
                audioData.xa7,
                audioData.xa8,
            ].filter(Boolean);

            // Start playback from 'horizontalIdx'.
            // If horizontalIdx=0 => start with captionAudio
            // If horizontalIdx=2 => skip captionAudio, xa1 => start from xa2
            const audioEl = audioElementRef.current;
            let currentTrackIndex = horizontalIdx === 0 ? 0 : horizontalIdx + 1;

            // 2) Helper to load + play the next track
            const playNext = () => {
                if (currentTrackIndex >= trackList.length) {
                    setAudioPlaying(false);
                    return;
                }
                const nextUrl = trackList[currentTrackIndex];
                audioEl.src = nextUrl;
                audioEl
                    .play()
                    .then(() => {
                        setAudioPlaying(true);
                    })
                    .catch((err: any) => {
                        console.error("Audio play error:", err);
                        setAudioPlaying(false);
                    });
            };

            // 3) onended => auto-advance + auto-scroll
            audioEl.onended = () => {
                // For track #1 => scroll to image #0, track #2 => image #1, etc.
                if (currentTrackIndex >= 1) {
                    const container = horizontalContainerRef.current[verticalIdx];
                    if (container) {
                        const imageIndex = currentTrackIndex + 1;
                        const child = container.children[imageIndex];
                        if (child) {
                            // Use requestAnimationFrame to throttle the scroll call
                            requestAnimationFrame(() => {
                                (child as HTMLElement).scrollIntoView({
                                    behavior: "instant",
                                    inline: "start",
                                });
                            });
                        }
                    }
                }

                // Move on to the next track after a brief delay
                setTimeout(() => {
                    currentTrackIndex++;
                    playNext();
                }, 500);
            };

            // 4) Begin playback
            playNext();
        },
        [AudioArray, horizontalContainerRef, audioElementRef, setAudioPlaying]
    );







    const ClikStory = useCallback(
        (verticalIdx: number, horizontalIdx: number, captionText: string) => {
            // 1) Check if the feed at verticalIdx has premium audio
            const premiumData = AudioArray[verticalIdx]?.captionSummary;
            const hasPremiumAudio = Boolean(premiumData);

            if (hasPremiumAudio) {
                //////////////////////////////////////////
                // PREMIUM (S3 MP3) AUDIO PLAYBACK
                //////////////////////////////////////////

                if (!activeStory) {
                    setActiveStory(true);
                }

                if (!audioPlaying) {
                    // Not currently playing => start fresh
                    // Stop TTS just in case

                    setIconOverlay({ visible: true, iconType: 'pause' });
                    /// speechSynthesis.cancel();
                    setAudioPaused(false);
                    setAudioPlaying(true);

                    // Start chain playback from track 0
                    playStoredAudioChain(verticalIdx, horizontalIdx);
                } else {
                    // Currently "playing" or "paused" => toggle
                    if (!audioPaused) {
                        // It's playing => pause
                        setIconOverlay({ visible: true, iconType: 'play' });
                        audioElementRef.current?.pause().catch((err: any) => {
                            console.error("Audio resume error:", err);
                        });

                        setAudioPlaying(false);
                        setAudioPaused(true);
                    } else {



                        // It's paused => resume
                        audioElementRef.current?.play().catch((err: any) => {
                            console.error("Audio resume error:", err);
                        });

                        if (audioElementRef.current) {
                            audioElementRef.current.pause();
                        }
                        setAudioPlaying(true);
                        setAudioPaused(false);
                    }
                }

                // Clear any previous icon hide timeout.
                if (iconTimeoutRef.current) {
                    clearTimeout(iconTimeoutRef.current);
                }
                // Hide the icon overlay after 3 seconds.
                iconTimeoutRef.current = setTimeout(() => {
                    setIconOverlay((prev) => ({ ...prev, visible: false }));
                }, 3000);


            } else {
                //////////////////////////////////////////
                // FREE (TTS) AUDIO PLAYBACK
                //////////////////////////////////////////
                if (!activeStory) {
                    setActiveStory(true);
                }

                // Clear any previous icon hide timeout.
                if (iconTimeoutRef.current) {
                    clearTimeout(iconTimeoutRef.current);
                }


                // Function to resume speech synthesis after a slight delay
                // to keep iOS from suspending/unloading.
                const handleResume = () => {
                    setTimeout(() => {
                        if (speechSynthesis.paused) {
                            speechSynthesis.resume();
                            setAudioPlaying(true);
                            setAudioPaused(false);
                            setIconOverlay({ visible: true, iconType: 'pause' });
                        }
                    }, 200); // adjust delay as needed
                };

                if (audioPlaying) {
                    // Already playing audio?
                    if (!audioPaused) {
                        // If it's playing and not paused, we stop it.
                        stopAudio();

                        setIconOverlay({ visible: true, iconType: 'play' });
                    } else {
                        // If it's paused, try resuming with a slight delay.
                        handleResume();
                    }
                } else {
                    // Not playing anything, so start fresh.
                    playAudio(horizontalIdx);
                    setIconOverlay({ visible: true, iconType: 'pause' });
                }

                // Hide the icon overlay after 3 seconds.
                iconTimeoutRef.current = setTimeout(() => {
                    setIconOverlay((prev) => ({ ...prev, visible: false }));
                }, 3000);
            }
        },
        [
            AudioArray,
            audioPlaying,
            audioPaused,
            audioElementRef,
            playStoredAudioChain,
            playAudio,
            setAudioPlaying,
            setAudioPaused,
        ]
    );









    // Automatically scroll vertically to the active post.
    useEffect(() => {
        if (verticalContainerRef.current && activeIndex !== null) {
            const container = verticalContainerRef.current;
            const containerHeight = container.clientHeight;
            container.scrollTo({
                top: activeIndex * containerHeight,
                behavior: "instant",
            });
            // Reset horizontal active index whenever vertical active post changes.
            setHorizontalActiveIndex(0);
        }
    }, [activeIndex]);


    /* 2️⃣  UPDATED handler -------------------------------------- */
    const handlePlay = useCallback((index: number) => {
        //// alert('jhg');
        const idx = verticalActiveIndex;
        const audio = audioRefs.current[idx];
        const video = videoRefs.current[idx];

        if (!audio || !video) return;

        /* A. restart + play audio */
        audio.currentTime = 0;
        if (MuteReducer) {
            audio.muted = true;
        } else {
            audio.muted = false;
        }
        audio.play()
            .then(() => setAudioFlag(idx, true))       // 🔔 flag[idx] = true
            .catch(() => { });

        /* B. prime video for iOS */
        if (matchMobile) {

            video.muted = true;
            video.play().then(() => video.pause()).catch(() => { });

        }

        /* C. when audio ends (or pauses) */
        const onFinish = () => {
            setAudioFlag(idx, false);                     // 🔔 flag[idx] = false
            if (video.paused) {


                setplayvid(true);
                video.currentTime = 0;
                ///  video.muted = false;
                video.play().catch(() => { });

            }
            audio.removeEventListener("ended", onFinish);

        };

        audio.addEventListener("ended", onFinish);

    }, [verticalActiveIndex, matchMobile, setplayvid, audioRefs, videoRefs, MuteReducer]);


    useEffect(() => {
        const verticalContainer = verticalContainerRef.current;
        if (!verticalContainer) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    // Only trigger if the post is intersecting within the vertical container.
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                        // Find the index of the element that is intersecting.
                        const idx = fullscreenRefsX.current.findIndex(
                            (el) => el === entry.target
                        );
                        if (idx !== -1) {







                            setActiveCap(false)
                            //setHideprofile(false);
                            setShowVoiceSelector(false);

                            setGeneratedAudios([]);
                            setActiveStory(false);
                            settshow(false);
                            setplayvid(false);

                            setverticalActiveIndex(idx);

                            sethidevol(false)
                            //  setcloseInteraction(false);
                            ///setLastId(feeds[idx - 1].id);
                            stopAudio();

                            setIconOverlay({ visible: true, iconType: 'play' });

                            const video = videoRefs.current[idx];
                            if (video) {


                                // ⏸️ Pause/stop branch
                                setplayvid(false);
                                video.pause();
                                video.currentTime = 0;        // rewind to start


                            }

                            setAudioFlag(idx, false);

                            setCapFlag(idx, false);

                            // handlePlay(idx);


                            if (iconTimeoutRefxxa2.current) {
                                clearTimeout(iconTimeoutRefxxa2.current);
                            }
                            iconTimeoutRefxxa2.current = setTimeout(() => { sethidevol(true) }, 3000)

                            //////////////////VIDEO////////////
                            if (iconTimeoutRefxxa.current) {
                                clearTimeout(iconTimeoutRefxxa.current);
                            }

                            /// setforceMute(true);
                            // Hide the icon overlay after 0.5s
                            iconTimeoutRefxxa.current = setTimeout(() => {
                                const video = videoRefs.current[idx];

                                if (matchMobile) {

                                    if (MuteReducer) {

                                        if (video) {
                                            video.play();
                                        }
                                        setplayvid(true);

                                    } else {


                                        handlePlay(idx)


                                    }



                                } else {

                                    if (type === 1 || type === 10) {

                                        if (video) {
                                            video.play();
                                        }
                                        setplayvid(true);


                                    } else {

                                        //  alert('hh');
                                        handlePlay(idx)
                                    }
                                }
                            }, matchMobile ? 3000 : 2000)

                            //////////////////VIDEO////////////

                        } else {

                            if (iconTimeoutRefxxa.current) {
                                clearTimeout(iconTimeoutRefxxa.current);
                            }
                        }
                    }
                });
            },
            {
                root: verticalContainer,
                threshold: 0.6,
            }
        );
        // Observe each post container.
        fullscreenRefsX.current.forEach((postEl) => {
            if (postEl) observer.observe(postEl);
        });
        return () => {
            observer.disconnect();
        };
    }, [fullscreenRefsX, audioRefs, videoRefs, handlePlay]);

    // Intersection Observer for the horizontal container's children.
    useEffect(() => {
        if (activeIndex === null) return;
        // Get the horizontal container for the active vertical post.
        const container = horizontalContainerRef.current[verticalActiveIndex];
        if (!container) return;
        const children = container.children;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                        const nodes = Array.from(children);
                        const idx = nodes.indexOf(entry.target);
                        if (idx !== -1) {
                            setHorizontalActiveIndex(idx);
                        }
                    }
                });
            },
            {
                threshold: 0.6,
            }
        );
        Array.from(children).forEach((child: any) => {
            observer.observe(child);
        });
        return () => {
            observer.disconnect();
        };
    }, [activeIndex, audioPlaying, activeStory, verticalActiveIndex]);

    if (activeIndex === null && feeds.length === 0) return null;





    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Example of calling Google Text-to-Speech instead of ElevenLabs.
     * 
     * @param stepText - The text you want to synthesize
     * @param stepIndex - The index of the current step (to store in 'generatedAudios')
     * @param voiceName - The voice name (e.g., "en-US-Chirp-HD-F"), or whichever voice you prefer
     * 
     * Note: you will need valid Google TTS credentials or an API key. 
     *       (If you have an API Key, you can pass it as a query param:  ?key=YOUR_API_KEY)
     *       If you’re using an OAuth token, you’ll need an Authorization header with a Bearer token.
     */
    const fetchAndGenerateSpeech = useCallback(
        async (stepText: string, stepIndex: number, voiceName: string, voiceId: any) => {
            try {
                // (Optional) delay between requests
                await sleep(100);

                // Build the request payload for Google TTS
                const requestData = {
                    input: {
                        text: stepText,
                    },
                    voice: {
                        languageCode: "en-US",
                        name: 'en-US-Chirp3-HD-Fenrir',
                        // e.g. "en-US-Chirp-HD-F"
                        // or "en-US-Wavenet-D", etc.
                        /// en-US-Chirp3-HD-Fenrir

                    },
                    audioConfig: {
                        audioEncoding: "LINEAR16", // or "MP3", "OGG_OPUS", etc.
                        pitch: 0,
                        speakingRate: 1,
                        effectsProfileId: ["small-bluetooth-speaker-class-device"],
                    },
                };


                // Make the call to Google TTS
                // Replace <YOUR_GOOGLE_TTS_API_KEY_OR_TOKEN> with your key or a Bearer token
                const response: any = await axios.post(
                    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${VITE_GOOGLE_TTS}`,
                    requestData,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        // Google returns a JSON object containing base64 audio in 'audioContent'
                        // so no need for "responseType": "arraybuffer" in this case
                    }
                );

                // 1) Extract the base64 encoded audio
                const audioContent = response.data?.audioContent;
                if (!audioContent) {
                    throw new Error("No audioContent in response");
                }

                // 2) Convert the base64 string to a UInt8Array
                const audioBuffer = Uint8Array.from(
                    atob(audioContent),
                    (char) => char.charCodeAt(0)
                );

                // 3) Build a Blob from the binary data
                //    For LINEAR16, "audio/wav" is a common container.
                //    If you used "MP3" in audioConfig, set type to "audio/mpeg".
                const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

                // 4) Convert the Blob into an object URL so we can play it in the browser
                const audioUrl = URL.createObjectURL(audioBlob);

                // 5) Update your 'generatedAudios' array in state
                setGeneratedAudios((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = audioUrl;
                    return next;
                });

                console.log("done with audio");
            } catch (error: any) {
                setLoadingAudio(false);
                console.error("TTS Error:", error.message || error);
            }
        },
        []
    );


    // 4) The function that generates audio first for the caption, then for each plot
    const callvoice = useCallback(
        async (caption: string, plots: string[], voiceId: string) => {
            // Optional: initialize state array to correct length
            // Index 0 for the caption, plus one for each plot
            setGeneratedAudios(Array(1 + plots.length).fill(""));




            // Generate audio for the caption (index = 0)
            await fetchAndGenerateSpeech(caption, 0, 'en-US-Chirp-HD-F', voiceId);

            // Generate audio for each plot (indices = 1..plots.length)
            for (let i = 0; i < plots.length; i++) {
                await fetchAndGenerateSpeech(plots[i], i + 1, 'en-US-Chirp-HD-F', voiceId);
            }
        },
        [fetchAndGenerateSpeech]
    );


    // 5) Now you can call `callvoice` anywhere in your component,
    // and the resulting audio URLs will appear in `generatedAudios`.
    // Example usage:key
    const handleGenerateAudio = useCallback((captionx: any, voice: any) => {

        const voiceId = voice;

        if (verticalActiveIndex !== null) {
            const feed = feeds[verticalActiveIndex];
            const storyT: any = [
                feed.xt1,
                feed.xt2,
                feed.xt3,
                feed.xt4,
                feed.xt5,
                feed.xt6,
                feed.xt7,
                feed.xt8,
            ].filter(Boolean);

            callvoice(captionx, storyT, voiceId);
        }
    }, [feeds, verticalActiveIndex]);


    const GenerateSignedUrlForSingleAudio = async (audioBlob: Blob) => {
        if (!audioBlob) {
            throw new Error("No audio Blob to generate a signed URL.");
        }

        // Example request body
        const requestData = { values: { count: 1 } };

        // Post to your backend route that generates signed URLs for audio
        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_audioStory`,
            requestData,
            { withCredentials: true }
        );

        // Assume the server returns something like: { holder: [ { urlAudio } ] }
        const holder = response.data.holder;
        if (!holder || !Array.isArray(holder) || holder.length !== 1) {
            throw new Error("Invalid response from signed URL endpoint.");
        }

        const signedUrls = holder[0];
        if (!signedUrls.urlAudio) {
            throw new Error("Missing signed URL for audio.");
        }

        // Return the object containing the audio URL
        return signedUrls; // e.g. { urlAudio: "https://..." }
    };



    const uploadAllAudiosToS3 = useCallback(async (postId: any, EnhanceCaption: any) => {
        try {
            const s3AudioUrls: string[] = [];

            // Loop through each local audio URL in generatedAudios
            for (const audioUrl of generatedAudios) {
                // 1) Convert the local URL to a Blob
                const audioBlob = await fetch(audioUrl).then((r) => r.blob());

                // 2) Get a pre-signed upload URL from your API
                //    e.g., call GenerateSignedUrlForSingleAudio(audioBlob)
                const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);

                // 3) Upload the Blob to S3 using that signed URL
                await axios.put(urlAudio, audioBlob, {
                    headers: {
                        "Content-Type": audioBlob.type || "audio/mpeg",
                    },
                });

                // 4) The final S3 path is the URL without query params
                const finalAudioUrl = urlAudio.split("?")[0];
                s3AudioUrls.push(finalAudioUrl);
            }

            // Once done, log them (or store them in state, or send to DB)
            console.log("Uploaded all audio to S3:", s3AudioUrls);



            var Data = ({

                postId: postId,
                captionSummary: EnhanceCaption,
                captionAudio: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                x1: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                x2: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                x3: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                x4: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                x5: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                x6: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                x7: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                x8: s3AudioUrls[8] ? s3AudioUrls[8] : null,

            });


            var Datax = ({
                captionSummary: EnhanceCaption,
                captionAudio: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                xa1: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                xa2: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                xa3: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                xa4: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                xa5: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                xa6: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                xa7: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                xa8: s3AudioUrls[8] ? s3AudioUrls[8] : null,

            });




            setAudioArray((prevAudioArray: any) => {
                // Make a shallow copy of the entire array
                const newAudioArray = [...prevAudioArray];
                // Overwrite the specific index entirely with the new Data
                newAudioArray[verticalActiveIndex] = Datax;
                return newAudioArray;
            });

            ///ClikStory(verticalActiveIndex, 0, '');


            setLoadingAudio(false);
            /// saveToDatabase(Data);



            callCreateMp4(Datax, Data);




        } catch (error) {
            console.error("Error uploading all audios to S3:", error);
        }
    }, [feeds, verticalActiveIndex, generatedAudios, storyVidArray, mp4type, firstImageDims]);


    const saveToDatabase = useCallback((Data: any) => {



        setLoadingDatabase(true);
        axios.put(`${CLIK_URL}/UpdatePostAudioMp4`, {
            values: Data,
        })
            .then((response) => {

                if (response) {

                    // alert(Data.videourl);
                    setVideoArray((prevVideoArray: any) => {
                        const updated = [...prevVideoArray];
                        updated[verticalActiveIndex] = Data.videourl;
                        return updated;
                    });


                    setLoadingDatabase(false);


                    setTimeout(() => {
                        window.history.back();

                    }, 500)



                }
            })
            .catch((error) => {
                setLoadingDatabase(false);
                console.log(error);
            });

    }, [verticalActiveIndex, videoArray])






    useEffect(() => {
        if (!feeds[verticalActiveIndex]) return;

        const feed = feeds[verticalActiveIndex];
        const postId = feed.id;

        const storyT = [
            feed.xt1,
            feed.xt2,
            feed.xt3,
            feed.xt4,
            feed.xt5,
            feed.xt6,
            feed.xt7,
            feed.xt8,
        ].filter(Boolean);

        // limit = number of valid text entries + 1
        const limit = storyT.length + 1;

        // Make sure we have exactly `limit` audios
        // AND every audio element is non-empty (truthy)
        if (
            generatedAudios.length === limit &&
            generatedAudios.every((audioUrl: any) => Boolean(audioUrl))
        ) {



            // Fire off the upload
            uploadAllAudiosToS3(postId, EnhanceCaption);

        }
    }, [feeds, verticalActiveIndex, generatedAudios, EnhanceCaption, verticalActiveIndex, storyVidArray]);


    // Define the EnhanceText function
    const EnhanceCaptionx = useCallback(async (voice: any) => {

        const feed = feeds[verticalActiveIndex];
        var pp: any = feed.caption;

        setLoadingAudio(true);
        try {

            console.log(pp);
            // Prepare the request payload
            const requestData: any = { pp };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/summary`,
                requestData,
                { withCredentials: true }
            );




            // Extract data from the response
            const data = response.data;

            // 1. Log both:
            console.log("sum:", data.summary);

            console.log("title done:", data.title);

            // 2. Put the title into your caption state:
            setEnhanceCaption(data.summary);



            // 3. Kick off your TTS with the summary:
            /// setisLoading(false);

            handleGenerateAudio(data.summary, voice);




            ////Starts Generating Voice
            // callvoice(data.initialSteps);



        } catch (error: any) {
            setLoadingAudio(false);

            // Handle different error scenarios
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                //  setError(error.response.data.message || "Server Error");
            } else if (error.request) {
                // Request was made but no response received
                console.error("No response received:", error.request);
                /// setError("Network Error: No response received from server.");
            } else {
                // Other errors
                console.error("Error:", error.message);
                /// setError(error.message);
            }
        } finally {
            ///setIsLoading(false);
        }
    }, [feeds, verticalActiveIndex])





    /**
     * Helper: Load metadata for a single audio URL and return duration (seconds).
     */
    const getAudioDuration = (url: any) => {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous"; // helps if your S3 or server sets CORS headers
            audio.preload = "metadata";     // ensure metadata is loaded
            audio.src = url;

            audio.addEventListener("loadedmetadata", () => {
                // audio.duration is in seconds
                resolve(audio.duration);
            });

            // Handle load errors (e.g., 404, CORS issues)
            audio.addEventListener("error", (err) => {
                reject(err);
            });
        });
    };

    const [isLoading, setIsLoading] = useState(false);

    const callCreateMp4 = useCallback(async (Datax: any, Data: any) => {
        setIsLoading(true); // Show loader when job starts



        // 1) Grab the relevant item from your "feeds" based on verticalActiveIndex
        const dataformp4 = feeds[verticalActiveIndex];

        const dataformp4x = storyVidArray[verticalActiveIndex];


        // 2) Gather all possible images
        const imagesForVideo = [
            dataformp4.xh1,
            dataformp4.xh2,
            dataformp4.xh3,
            dataformp4.xh4,
            dataformp4.xh5,
            dataformp4.xh6,
            dataformp4.xh7,
            dataformp4.xh8,
        ].filter(Boolean);

        // 3) Gather all possible audios
        const audioForVideo = [
            Datax.xa1,
            Datax.xa2,
            Datax.xa3,
            Datax.xa4,
            Datax.xa5,
            Datax.xa6,
            Datax.xa7,
            Datax.xa8,
        ].filter(Boolean);

        // 4) Gather all possible images
        const clipsForVideo = [
            dataformp4x[0],
            dataformp4x[1],
            dataformp4x[2],
            dataformp4x[3],
            dataformp4x[4],
            dataformp4x[5],
            dataformp4x[6],
            dataformp4x[7],
        ].filter(Boolean);

        try {

            const firstImageSize =
                firstImageDims ? `${firstImageDims.width}x${firstImageDims.height}` : "";

            // 4) Dynamically fetch durations for each audio track
            const audioDurations = await Promise.all(
                audioForVideo.map((audioUrl) => getAudioDuration(audioUrl))
            );

            console.log("Audio Durations:", audioDurations);


            var x = 'create-videoimg';

            if (mp4type === 1) { x = 'create-video' }
            // 5) Post to /create-video endpoint with the real durations
            const response: any = await axios.post(`${CLIK_URL}/${x}`, {
                audioUrls: audioForVideo,
                imageUrls: imagesForVideo,
                videoUrls: mp4type === 1 ? clipsForVideo : null,
                audioDurations, // pass the real durations in seconds


                outputResolution: firstImageSize,
                ///outputResolution: "2160x3840", ///1080x1920

                outputBucket: "s3://clikbatebucket/videos/",
            });

            console.log("MediaConvert response:", response.data);

            // Log the new 'videoName' and 'videoUrl'


            // Suppose the backend returns a jobId
            const { jobId } = response.data;



            setVideoUrl(response.data.videoUrl);


            setIsLoading(false); // Hide loader
            setGeneratedAudios([]);


            const ResVideo = response.data.videoUrl;


            if (matchPc) {

                //// checkVideoAvailability(ResVideo);
            }




            Data.videourl = ResVideo;

            /// alert(Data.videourl);
            saveToDatabase(Data)



        } catch (error) {
            console.error("Error fetching audio durations or calling create-video:", error);
            setIsLoading(false); // Hide loader
        }
    }, [feeds, verticalActiveIndex, storyVidArray, mp4type, firstImageDims]);




    // The function that keeps polling to see if the video has appeared in S3
    const checkVideoAvailability = useCallback(
        async (url: any, attempt = 1, maxAttempts = 10) => {
            try {
                // Set or keep "loading" as true when we start (or continue) checking
                setIsLoading(true);

                // HEAD request to see if the file exists
                const response = await fetch(url, { method: "HEAD" });
                if (response.ok) {
                    // File exists => stop loading
                    setIsLoading(false);
                    console.log(`Video found! ${url}`);
                    return; // Done
                } else {
                    console.log(`Video not ready yet (attempt ${attempt}).`);
                }
            } catch (error) {
                console.log(`Error checking video HEAD request:`, error);
            }

            // If we haven’t succeeded and still have attempts left, wait a few seconds and try again
            if (attempt < maxAttempts) {
                setTimeout(() => {
                    checkVideoAvailability(url, attempt + 1, maxAttempts);
                }, 2000); // poll every 3 seconds
            } else {
                console.log(`Reached max attempts (${maxAttempts}) – video still not ready`);
                setIsLoading(false); // fallback to false or keep it true if you prefer
            }
        },
        []
    );

    // EXAMPLE: automatically start checking when the component mounts or when videoUrl changes
    useEffect(() => {

        /*  if (videoArray[verticalActiveIndex]) {
              // Kick off polling
              checkVideoAvailability(videoArray[verticalActiveIndex]);
          } else {
              // No URL => definitely "loading"
              setIsLoading(true);
          }
     
          */

    }, [videoArray, verticalActiveIndex, checkVideoAvailability]);


    const location = useLocation();

    const { userId } = location.state || {};


    const GotoProfile = useCallback(
        (id: number, index: number) => {



            // If you still need to go back first, keep window.history.back() here
            ///


            if (userId === id && type === 10) {
                window.history.back();
            } else {

                closePop();

                if (iconTimeoutRefxx.current) {
                    clearTimeout(iconTimeoutRefxx.current);
                }

                // Hide the icon overlay after 0.5s
                iconTimeoutRefxx.current = setTimeout(() => {
                    const feedScrollPos = feedContainerRef.current?.scrollTop ?? 0;

                    const feedLastId = feeds[index + 1] ? feeds[index + 1].id : 0;
                    /// alert(feedLastId);

                    console.log(
                        `Navigating from ${location.pathname} with ScrollPos: ${feedScrollPos} and PageNum: ${feedLastId} to profile ${id}`
                    );

                    const routeState = {
                        routeScrollPos: feedScrollPos,
                        routelastId: feedLastId,
                        fullscreen: true,  // Added fullscreen mode flag
                    };



                    navigate(location.pathname, {
                        state: routeState,
                        replace: true,
                    });

                    const routeState2 = {
                        userId: id, // Here is your ID
                    };

                    navigate(`/pages`, {
                        state: routeState2,
                    });



                }, 500);

            }
        },
        [LastId, feedContainerRef, navigate, location.pathname, userId, type]
    );



    /* keep it in sync if feeds ever changes length */
    useEffect(() => {
        setAudioPlayingx(prev =>
            feeds.map((_, i) => prev[i] ?? false) // preserve existing flags
        );
    }, [feeds.length]);








    //key


    return (
        <AnimatePresence >

            {feeds.length > 0 && isOpen ?




                <EditPost
                    firstImageDims={firstImageDims}
                    setFirstImageDims={setFirstImageDims}
                    setmp4type={setmp4type}
                    EnhanceCaptionx={EnhanceCaptionx}
                    storyVidArray={storyVidArray}
                    setStoryVidArray={setStoryVidArray}
                    verticalActiveIndex={verticalActiveIndex}
                    feeds={feeds}
                    isOpen={isOpen}
                /// onClose={clearAlldefaults}
                />

                : null




            }

            {LoadingAudio ? <div
                style={{
                    position: "fixed",
                    top: "0vh",
                    zIndex: 9999,

                    width: matchMobile ? "100%" : '100%',
                    left: matchMobile ? "0px" : '-0vw',
                    height: "100vh",
                    textAlign: "center",
                    color: '#ffffff',
                    backgroundColor: 'rgb(0,0,0,0.45)'
                }}
            > <div
                style={{

                    marginTop: "20vh",

                }}
            >  Generating Audio </div>  </div> : null
            }

            {isLoading ? <div
                style={{
                    position: "fixed",
                    top: "0vh",
                    zIndex: 9999,

                    width: matchMobile ? "100%" : '100%',
                    left: matchMobile ? "0px" : '-0vw',
                    height: "100vh",
                    textAlign: "center",
                    color: '#ffffff',
                    backgroundColor: 'rgb(0,0,0,0.45)'
                }}
            > <div
                style={{

                    marginTop: "20vh",

                }}
            >  Creating MP4 </div>  </div> : null
            }


            {LoadingDatabase ? <div
                style={{
                    position: "fixed",
                    top: "0vh",
                    zIndex: 9999,

                    width: matchMobile ? "100%" : '100%',
                    left: matchMobile ? "0px" : '-0vw',
                    height: "100vh",
                    textAlign: "center",
                    color: '#ffffff',
                    backgroundColor: 'rgb(0,0,0,0.45)'
                }}
            > <div
                style={{

                    marginTop: "20vh",

                }}
            >  Saving.. </div>  </div> : null
            }






            <Box

                onClick={(e) => {
                    /// e.stopPropagation();
                    /// window.history.back();
                }
                }
                component={motion.div}
                key="fullscreen-overlay-stories"

                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                ref={verticalContainerRef}
                sx={{
                    WebkitTapHighlightColor: "transparent",

                    // Prevent text/image selection
                    /// userSelect: "none",

                    // Remove focus outline if it ever appears
                    outline: "none",


                    m: 0,
                    p: 0,
                    position: "fixed",
                    top: 0,
                    right: 0,

                    width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                    height: "100vh", // use 100vh so the container fits snugly
                    backgroundColor: darkModeReducer ? 'rgb(30,30,30,0.95)' : 'rgb(210,210,210,0.95)',
                    zIndex: 9990,
                    overflowY: "scroll",
                    overflowX: "hidden",
                    scrollSnapType: "y mandatory",
                    scrollBehavior: "smooth",
                    overscrollBehavior: "contain",
                    WebkitOverflowScrolling: "touch",
                    "&::-webkit-scrollbar": {
                        width: "5px",
                    },
                    "&::-webkit-scrollbar-track": {
                        background: "#f1f1f1",
                    },
                    "&::-webkit-scrollbar-thumb": {
                        background: "#888",
                        borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                        background: "#555",
                    },
                }}
            >





                {feeds.map((item, index) => {

                    const hasVideo = videoArray[verticalActiveIndex] !== null && verticalActiveIndex === index;
                    // Gather story images for each post.
                    const storyImages = [
                        item.x1,
                        item.x2,
                        item.x3,
                        item.x4,
                        item.x5,
                        item.x6,
                        item.x7,
                        item.x8,
                    ].filter(Boolean);

                    return (
                        <Box
                            key={item.id}
                            ref={(el) => (fullscreenRefsX.current[index] = el!)}
                            sx={{
                                width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                                maxHeight: "100vh",
                                scrollSnapAlign: "start",
                                scrollSnapStop: "always",
                                position: "relative",
                            }}
                        >



                            {verticalActiveIndex === index ?
                                <audio
                                    ref={el => (audioRefs.current[index] = el)}
                                    src={feeds[verticalActiveIndex].captionAudio}
                                    preload="auto"

                                    style={{ display: 'none' }}
                                />
                                : null}

                            {/* If storyImages exist, render the horizontal slider (type 2) */}


                            {

                                storyImages.length > 0 ? (
                                    <Box
                                        ref={(el) => {
                                            horizontalContainerRef.current[index] = el;
                                        }}
                                        sx={{
                                            width: "100%",
                                            height: matchMobile ? "100vh" : "102vh",
                                            whiteSpace: "nowrap",
                                            scrollSnapType: "x mandatory",
                                            scrollBehavior: "smooth",
                                            overflowX: 'auto',
                                            WebkitOverflowScrolling: "touch",
                                            scrollbarWidth: "none",
                                            msOverflowStyle: "none",
                                            "&::-webkit-scrollbar": { display: "none" },
                                        }}
                                    >



                                        {hasvid ? null :
                                            <div
                                                style={{
                                                    position: "fixed",
                                                    top: "2vh",
                                                    zIndex: 3000,
                                                    display:
                                                        verticalActiveIndex === index ?
                                                            AudioArray[verticalActiveIndex]?.captionSummary ? 'none' : 'none' : "none",

                                                    margin: "auto",
                                                    width: "100%",
                                                    height: "0px",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {/*  If the voice selector is NOT visible, show the “Generate Audio” button  */}

                                                <Button
                                                    onClick={() => {
                                                        // When clicked, hide this button and show the voice picker


                                                        ///EnhanceCaptionx('');

                                                        setisOpen(true);
                                                        ///callCreateMp4();
                                                    }}
                                                    variant="contained"
                                                    component="label"
                                                    sx={{
                                                        flex: 1,

                                                        ...buttonPadding,
                                                        borderRadius: 2,
                                                        left: matchMobile ? '0px' : "-10vw",
                                                        backgroundColor: darkModeReducer ? "#1e1e1e" : "#f5f5f5",
                                                        color: darkModeReducer ? "#ffffff" : "#000000",
                                                        "&:hover": {
                                                            backgroundColor: darkModeReducer ? "#bbbbbb" : "#555555",
                                                            color: darkModeReducer ? "#000000" : "#ffffff",
                                                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                                                        },
                                                    }}
                                                >
                                                    Make Video
                                                </Button>



                                                {/* Hidden debug audio elements */}

                                            </div>


                                        }




                                        {

                                            index === verticalActiveIndex ?

                                                <Box

                                                    onMouseEnter={() => setZoom2x(true)}
                                                    onMouseOver={() => setZoom2x(true)}
                                                    onMouseLeave={() => setZoom2x(false)}

                                                    onTouchStart={() => setZoom2x(true)}
                                                    onTouchEnd={() => setZoom2x(false)}

                                                    onClick={() => {

                                                        setZoom2x(true);
                                                        setTimeout(() => setZoom2x(false), 300);


                                                        if (MuteReducer) {

                                                            dispatch(deactivateFullscreenMute());
                                                        } else {

                                                            dispatch(activateFullscreenMute());
                                                        }

                                                    }}

                                                    sx={{
                                                        height: "0vh",
                                                        position: "fixed",
                                                        top: matchMobile ? "6.5vh" : isMenuOpen ? '6vh' : "8.5vh",
                                                        left: matchMobile
                                                            ? "85vw"
                                                            : isMenuOpen
                                                                ? "46.8vw"
                                                                : "36.8vw",
                                                        width: matchMobile ? "100%" : "100%",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        zIndex: 1000,

                                                    }}
                                                >
                                                    {/* unified icon + label button */}
                                                    <Box
                                                        className={`toggle-image ${Zoom2x ? "bounce" : ""}`}
                                                        onClick={() => {
                                                        }}
                                                        sx={{
                                                            opacity: 0.8,
                                                            alignItems: "center",
                                                            gap: 0,          // keep icon centred when collapsed
                                                            width: 55,  // pill width → circle width
                                                            height: 55,
                                                            px: 0,         // same padding you used on the label
                                                            py: 0.4,
                                                            borderRadius: "50%",
                                                            bgcolor: darkModeReducer
                                                                ? "rgba(0,0,0,0.65)"
                                                                : "rgb(250,250,250)",
                                                            backdropFilter: "blur(1px)",
                                                            boxShadow: 3,

                                                            display: MuteReducer ? "inline-flex" :
                                                                hidevol ? 'none' : 'inline-flex',
                                                            cursor: "pointer",
                                                            "&:hover": {
                                                                bgcolor: darkModeReducer
                                                                    ? "rgba(100,100,100,0.3)"
                                                                    : "rgba(250,250,250,0.3)",
                                                            },

                                                            transition: "width 250ms ease, border-radius 250ms ease",
                                                        }}
                                                    >
                                                        {/* camera icon */}

                                                        {MuteReducer ?

                                                            <VolumeOffIcon
                                                                sx={{
                                                                    fontSize: matchMobile ? "1.8rem" : "1.7rem",
                                                                    color: darkModeReducer ? "#fff" : "#000",
                                                                    textAlign: 'center',
                                                                    margin: 'auto',
                                                                }}
                                                            /> :

                                                            <VolumeUpIcon

                                                                sx={{
                                                                    fontSize: matchMobile ? "1.8rem" : "1.7rem",
                                                                    color: darkModeReducer ? "#fff" : "#000",
                                                                    textAlign: 'center',
                                                                    margin: 'auto',

                                                                }}
                                                            />}


                                                        {/* sliding label — collapses to 0 px width */}

                                                    </Box>
                                                </Box>


                                                : null
                                        }


                                        {



                                            < Box

                                                onClick={(e) => {
                                                    ///   e.stopPropagation();
                                                    ////window.history.back();
                                                }
                                                }
                                                key={index}

                                                sx={{
                                                    display: "inline-block",
                                                    width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                                                    height: matchMobile ? "90vh" : "100vh",
                                                    scrollSnapAlign: "start",
                                                    position: "relative",
                                                    verticalAlign: "top",
                                                    cursor: "pointer",



                                                }}
                                            >


                                                <Box

                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (type === 3) {
                                                            if (!closeInteraction) {
                                                                setcloseInteraction(true)
                                                            } else {
                                                                window.history.back();
                                                            }
                                                        } else {
                                                            window.history.back();
                                                        }
                                                    }
                                                    }

                                                    sx={{
                                                        WebkitTapHighlightColor: "transparent",

                                                        // Prevent text/image selection
                                                        userSelect: "none",

                                                        // Remove focus outline if it ever appears
                                                        outline: "none",


                                                        m: 0,
                                                        p: 0,
                                                        position: "fixed",
                                                        top: 0,
                                                        right: 0,
                                                        display: matchMobile ? 'none' : 'block',
                                                        width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                                                        height: "100vh", // use 100vh so the container fits snugly
                                                        /// backgroundColor: darkModeReducer ? 'rgb(30,30,30,0.95)' : 'rgb(210,210,210,0.95)',
                                                        zIndex: 0,

                                                    }}
                                                >

                                                </Box>

                                                {verticalActiveIndex === index ?
                                                    <>



                                                        <video

                                                            onClick={() => {


                                                                if (hideVidCap[verticalActiveIndex]) {

                                                                    if (!matchMobile) {
                                                                        const video = videoRefs.current[index];
                                                                        if (video) {
                                                                            video.play();
                                                                        }
                                                                    }

                                                                    setCapFlag(index, false);

                                                                } else {

                                                                    if (matchMobile) {
                                                                        const video = videoRefs.current[index];
                                                                        if (video) {
                                                                            video.pause();
                                                                        }
                                                                    }

                                                                    setCapFlag(index, true);

                                                                }

                                                            }}
                                                            ref={el => (videoRefs.current[index] = el)}
                                                            playsInline

                                                            loop
                                                            webkit-playsinline="true"
                                                            src={videoArray[verticalActiveIndex]}
                                                            controls={hideVidCap[verticalActiveIndex]}
                                                            muted={MuteReducer}
                                                            style={{
                                                                width: matchMobile ? '100%' : 'auto',
                                                                height: matchMobile ? isNineTwelve ? '110vh' : '100% ' : '100% ',
                                                                objectFit: matchMobile ? 'cover' : 'contain',
                                                                position: 'absolute',
                                                                zIndex: 3,
                                                                top: matchMobile ? isNineTwelve ? '50%' : '55%' : '50%',
                                                                left: '50%',
                                                                marginTop: matchMobile ? '0vh' : '0px',
                                                                transform: 'translate(-50%, -50%)',
                                                                transition: 'transform 7s ease-in-out',
                                                                display: playvid ? 'block' : 'none'
                                                            }}
                                                        />

                                                    </> : null}

                                                {matchMobile ?
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            width: '100vw',
                                                            height: '100dvh',
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            zIndex: 2,
                                                            margin: 'auto',
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        <img
                                                            ref={verticalActiveIndex === index ? imgRef : null}
                                                            src={storyImages[0]}
                                                            alt={`Story-${item.id}-0`}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                if (videoArray[verticalActiveIndex]) {
                                                                    if (type === 1 || type === 10) {
                                                                        const video = videoRefs.current[index];
                                                                        if (video) {
                                                                            video.play();
                                                                        }
                                                                        setplayvid(true);
                                                                    } else {
                                                                        handlePlay(index)
                                                                    }
                                                                } else {
                                                                    setActiveStory(prev => !prev);
                                                                    settshow(false);
                                                                }
                                                            }}
                                                            style={{
                                                                maxWidth: '100%',
                                                                maxHeight: '100%',
                                                                width: matchMobile ? '100%' : 'auto',
                                                                height: 'auto',
                                                                objectFit: matchMobile ? 'cover' : 'contain',
                                                                cursor: 'pointer',
                                                            }}
                                                        />
                                                    </Box>
                                                    : <img
                                                        ref={verticalActiveIndex === index ? imgRef : null}
                                                        src={storyImages[0]}
                                                        alt={`Story-${item.id}-${0}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (videoArray[verticalActiveIndex]) {
                                                                if (type === 1 || type === 10) {
                                                                    const video = videoRefs.current[index];
                                                                    if (video) {
                                                                        video.play();
                                                                    }
                                                                    setplayvid(true);

                                                                } else {

                                                                    handlePlay(index)
                                                                }
                                                            } else {
                                                                setActiveStory((prev) => !prev);
                                                                settshow(false);
                                                            }
                                                        }}
                                                        style={{
                                                            cursor: "pointer",
                                                            position: "absolute",
                                                            top: "50%",
                                                            left: "50%",
                                                            transform: "translate(-50%, -50%)",
                                                            width: matchMobile ? "100%" : "auto",
                                                            height: "100dvh",
                                                            objectFit: matchMobile ? "cover" : "contain",
                                                            zIndex: 1,
                                                        }}
                                                    />
                                                }

                                                {videoArray[verticalActiveIndex] && (
                                                    <Box
                                                        onClick={(e: any) => {
                                                            /// e.stopPropagation();
                                                            //  setplayvid(true);



                                                            if (type === 1 || type === 10) {



                                                                const video = videoRefs.current[index];
                                                                if (video) {
                                                                    video.play();

                                                                }
                                                                /// alert('kk');
                                                                setplayvid(true);

                                                            } else {

                                                                handlePlay(index)
                                                            }

                                                        }}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            zIndex: 2,
                                                            color: '#fff',
                                                            fontSize: audioPlayingx[verticalActiveIndex] ? '5rem' : '4rem',
                                                            opacity: 0.8,
                                                            cursor: 'pointer',
                                                            // Use drop-shadow for an SVG icon
                                                            filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.15))',
                                                        }}
                                                    >
                                                        {audioPlayingx[verticalActiveIndex] ? <AudiotrackIcon fontSize="inherit" /> : <PlayArrowIcon fontSize="inherit" />}
                                                    </Box>

                                                )
                                                }

                                                {!activeStory && (
                                                    <Box
                                                        //onClick={() => { /* your onClick logic here */ }}
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: matchMobile ? '' : 0,
                                                            top: matchMobile ? isNineTwelve ?
                                                                isIphone ? ActiveCap ? '76vh' : '86vh' :
                                                                    ActiveCap ? '70vh' : '80vh' :


                                                                isIphone ? ActiveCap ? '70vh' : '80vh' :
                                                                    ActiveCap ? '70vh' : '80vh'

                                                                : '',

                                                            left: matchMobile ? '0px' : '50%',

                                                            transform: matchMobile ? 'none' : 'translateX(-50%)',
                                                            width: matchMobile ? '100%' : '28vw',
                                                            boxSizing: 'border-box',
                                                            display: verticalActiveIndex === index ?

                                                                hideVidCap[verticalActiveIndex] ? 'none' : 'flex' : 'none',
                                                            alignItems: 'flex-end',
                                                            justifyContent: 'space-between',

                                                            zIndex: 4,

                                                            padding: '2vh',


                                                            background:

                                                                ActiveCap ?
                                                                    darkModeReducer ?
                                                                        'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                        :
                                                                        'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)'

                                                                    : ''



                                                        }}
                                                    >
                                                        {/* 70%: Username & Caption */}
                                                        <Box
                                                            sx={{
                                                                width: matchMobile ? '87%' : '86%',
                                                                color: 'rgba(255, 255, 255, 1)', // visible white
                                                                textShadow: '0px 0px 3px rgba(0,0,0,0.1)',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'space-between',


                                                            }}
                                                        >


                                                            <Typography

                                                                onClick={() => {


                                                                    GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                                }}
                                                                variant="subtitle2"
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    fontWeight: 'bold',
                                                                    mb: 1,
                                                                    fontSize: matchMobile ? '1.2rem' : '1.3rem',
                                                                }}
                                                            >


                                                                <span style={{
                                                                    background:
                                                                        darkModeReducer ?

                                                                            'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                            :
                                                                            'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                                }}>   {`@${feeds[index].username}`} </span>
                                                            </Typography>

                                                            <Typography

                                                                onClick={() => {

                                                                    ActiveCap ?
                                                                        setActiveCap(false) :

                                                                        setActiveCap(true)


                                                                }}
                                                                variant="body2"
                                                                sx={{
                                                                    fontSize: matchMobile ? '1.2rem' : '1.3rem',
                                                                    whiteSpace: 'normal',
                                                                    wordBreak: 'break-word',
                                                                    maxHeight: matchMobile ?
                                                                        '' :
                                                                        '14vh',

                                                                    height: matchMobile ?
                                                                        ActiveCap ? '14vh' : '4vh' :
                                                                        '',


                                                                    overflowY: 'auto',
                                                                    "&::-webkit-scrollbar": {
                                                                        width: "8px",
                                                                    },
                                                                    "&::-webkit-scrollbar-track": {
                                                                        background: "rgb(255,255,255,0)",
                                                                    },
                                                                    "&::-webkit-scrollbar-thumb": {
                                                                        background: "rgb(255,255,255,0)",
                                                                        borderRadius: "4px",
                                                                    },
                                                                    "&::-webkit-scrollbar-thumb:hover": {
                                                                        background: "rgb(255,255,255,0)",
                                                                    },
                                                                }}
                                                            >

                                                                <span style={{
                                                                    background:
                                                                        darkModeReducer ?

                                                                            'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                            :
                                                                            'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                                }}>  {feeds[index].caption}  </span>
                                                            </Typography>
                                                        </Box>



                                                        {/* 12%: Profile Pic */}
                                                        <Box
                                                            sx={{

                                                                display: 'flex',
                                                                justifyContent: 'center',
                                                                alignItems: 'center',

                                                                bottom: matchMobile ?
                                                                    isNineTwelve ? '56vh' : '50vh' : '51vh',
                                                                position: 'absolute',
                                                                width: 'auto',
                                                                left: matchMobile ? '84vw' :

                                                                    isNineTwelve ? '23.5vw' : '26vw',
                                                                transform: 'translate(0%, 10%)',
                                                                transition: 'transform 7s ease-in-out',
                                                                height: '0px',

                                                            }}
                                                        >
                                                            <img

                                                                onClick={() => {


                                                                    setZoom1x(true);
                                                                    setTimeout(() => setZoom1x(false), 300);

                                                                    GotoProfile(feeds[index].sender, verticalActiveIndex - 1);


                                                                }}
                                                                src={
                                                                    loggedUser
                                                                        ? `${feeds[index].profile_image}`
                                                                        : ""
                                                                }
                                                                alt={

                                                                    loggedUser
                                                                        ? `Goto ${feeds[index].username}'s profile`
                                                                        : ""
                                                                }
                                                                onMouseEnter={() => setZoom1x(true)}
                                                                onMouseOver={() => setZoom1x(true)}
                                                                onMouseLeave={() => setZoom1x(false)}

                                                                onTouchStart={() => setZoom1x(true)}
                                                                onTouchEnd={() => setZoom1x(false)}
                                                                className={`toggle-image ${Zoom1x ? "bounce" : ""}`}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    borderRadius: '50%',
                                                                    width: matchMobile ? 58 : 68,
                                                                    height: 'auto',
                                                                    visibility: ActiveCap ? 'hidden' : 'visible',
                                                                    objectFit: 'cover',
                                                                    boxShadow: darkModeReducer
                                                                        ? '0 0 10px rgba(255, 255, 255, 0.5)'  // light shadow for dark mode
                                                                        : '0 0 10px rgba(0, 0, 0, 0.5)'


                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                )}




                                            </Box>

                                        }

                                    </Box>
                                ) : item.item1 ? (
                                    // Else if no story images but item1 exists, render type 1 layout.

                                    <Box


                                        id={`fullscreenItem-${index}`}
                                        component={motion.div}
                                        key="fullscreen-overlay"



                                        sx={{

                                            cursor: 'pointer',
                                            width: "100%",
                                            height: "100dvh",
                                            scrollSnapAlign: "start",
                                            position: "relative",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            m: 0,
                                            p: 0,
                                        }}
                                    >






                                        <Box

                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (type === 3) {
                                                    if (!closeInteraction) {
                                                        setcloseInteraction(true)
                                                    } else {
                                                        window.history.back();
                                                    }
                                                } else {
                                                    window.history.back();
                                                }
                                            }
                                            }

                                            sx={{
                                                WebkitTapHighlightColor: "transparent",

                                                // Prevent text/image selection
                                                userSelect: "none",

                                                // Remove focus outline if it ever appears
                                                outline: "none",


                                                m: 0,
                                                p: 0,
                                                position: "fixed",
                                                top: 0,
                                                right: 0,
                                                display: matchMobile ? 'none' : 'block',

                                                width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                                                height: "100vh", // use 100vh so the container fits snugly
                                                /// backgroundColor: darkModeReducer ? 'rgb(30,30,30,0.95)' : 'rgb(210,210,210,0.95)',
                                                zIndex: 0,

                                            }}
                                        >
                                        </Box>




                                        {verticalActiveIndex === index && type === 3 && (
                                            <Box
                                                onClick={(e: any) => {
                                                    /// e.stopPropagation();
                                                    setcloseInteraction(false)
                                                }}
                                                sx={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    zIndex: 10,
                                                    color: '#fff',
                                                    fontSize: '4rem',
                                                    opacity: 0.8,
                                                    cursor: 'pointer',
                                                    // Use drop-shadow for an SVG icon
                                                    filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.15))',
                                                }}
                                            >

                                                <SmartDisplayIcon fontSize="inherit" />
                                            </Box>

                                        )
                                        }

                                        {verticalActiveIndex === index && type === 3 ?

                                            closeInteraction ? null :
                                                <Sandbox
                                                    setcloseInteractionx={setcloseInteraction}
                                                    closeInteractionx={closeInteraction}

                                                    item={item}
                                                    type={1}
                                                    videoURL={item.mainint!}
                                                    CloudvideoURL={item.mainint!}
                                                /> :

                                            null}




                                        <img
                                            src={item.item1}
                                            alt={item.caption}

                                            onClick={() => {
                                                setactivetext(!activetext);
                                            }}
                                            style={{

                                                cursor: "pointer",
                                                position: "absolute",   // Position absolutely
                                                top: "50%",             // Position top center
                                                left: "50%",            // Position left center
                                                transform: "translate(-50%, -50%)", // Offset the element by half of its own dimensions
                                                width: matchMobile ? "100%" : "auto",
                                                height: "100%",
                                                objectFit: matchMobile ? "cover" : "contain",
                                                zIndex: 1,
                                            }}
                                        />


                                        {!activetext && (
                                            <Box
                                                ///onClick={() => { /* your onClick logic here */ }}
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: matchMobile ? 0 : 0,
                                                    left: matchMobile ? '0px' : '50%',
                                                    transform: matchMobile ? 'none' : 'translateX(-50%)',
                                                    width: matchMobile ? '100%' : '28vw',
                                                    boxSizing: 'border-box',
                                                    display: verticalActiveIndex === index ? 'flex' : 'none',
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'space-between',

                                                    zIndex: 1,

                                                    p: 2,
                                                    // Add a soft dark fade from bottom to top

                                                }}
                                            >
                                                {/* 70%: Username & Caption */}
                                                <Box
                                                    sx={{
                                                        width: matchMobile ? '87%' : '86%',
                                                        color: 'rgba(255, 255, 255, 1)', // visible white
                                                        textShadow: '0px 0px 3px rgba(0,0,0,0.1)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',


                                                    }}
                                                >


                                                    <Typography

                                                        onClick={() => {


                                                            GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                        }}
                                                        variant="subtitle2"
                                                        sx={{
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            mb: 1,
                                                            fontSize: matchMobile ? '1.2rem' : '1.3rem',

                                                        }}
                                                    >
                                                        <span style={{
                                                            background:
                                                                darkModeReducer ?

                                                                    'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                    :
                                                                    'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                        }}>  {`@${feeds[index].username}`}  </span>
                                                    </Typography>

                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontSize: matchMobile ? '1.2rem' : '1.3rem',
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            maxHeight: matchMobile ? '12vh' : '14vh',
                                                            overflowY: 'auto',
                                                            "&::-webkit-scrollbar": {
                                                                width: "8px",
                                                            },
                                                            "&::-webkit-scrollbar-track": {
                                                                background: "rgb(255,255,255,0)",
                                                            },
                                                            "&::-webkit-scrollbar-thumb": {
                                                                background: "rgb(255,255,255,0)",
                                                                borderRadius: "4px",
                                                            },
                                                            "&::-webkit-scrollbar-thumb:hover": {
                                                                background: "rgb(255,255,255,0)",
                                                            },
                                                        }}
                                                    >


                                                        <span style={{
                                                            background:
                                                                darkModeReducer ?

                                                                    'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                    :
                                                                    'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                        }}>  {feeds[index].caption}  </span>
                                                    </Typography>
                                                </Box>

                                                {/* 12%: Profile Pic */}
                                                <Box
                                                    sx={{

                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',

                                                        bottom: matchMobile ?
                                                            isNineTwelve ? '56vh' : '50vh' : '51vh',
                                                        position: 'absolute',
                                                        width: 'auto',
                                                        left: matchMobile ? '84vw' :

                                                            isNineTwelve ? '23.5vw' : '26vw',
                                                        transform: 'translate(0%, 10%)',
                                                        transition: 'transform 7s ease-in-out',
                                                        height: '0px',
                                                    }}
                                                >
                                                    <img

                                                        onClick={() => {


                                                            setZoom1x(true);
                                                            setTimeout(() => setZoom1x(false), 300);

                                                            GotoProfile(feeds[index].sender, verticalActiveIndex - 1);


                                                        }}

                                                        src={
                                                            loggedUser
                                                                ? `${feeds[index].profile_image}`
                                                                : ""
                                                        }
                                                        alt={

                                                            loggedUser
                                                                ? `Goto ${feeds[index].username}'s profile`
                                                                : ""
                                                        }
                                                        onMouseEnter={() => setZoom1x(true)}
                                                        onMouseOver={() => setZoom1x(true)}
                                                        onMouseLeave={() => setZoom1x(false)}

                                                        onTouchStart={() => setZoom1x(true)}
                                                        onTouchEnd={() => setZoom1x(false)}
                                                        className={`toggle-image ${Zoom1x ? "bounce" : ""}`}
                                                        style={{
                                                            cursor: 'pointer',
                                                            borderRadius: '50%',
                                                            width: matchMobile ? 58 : 68,
                                                            height: 'auto',
                                                            visibility: ActiveCap ? 'hidden' : 'visible',
                                                            objectFit: 'cover',
                                                            boxShadow: darkModeReducer
                                                                ? '0 0 10px rgba(255, 255, 255, 0.5)'  // light shadow for dark mode
                                                                : '0 0 10px rgba(0, 0, 0, 0.5)'

                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                ) : (
                                    // Fallback if neither story images nor item1 exist.
                                    <Box
                                        sx={{
                                            width: "100%",
                                            height: "100%",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Typography variant="h6" color="#fff">
                                            No story images found
                                        </Typography>
                                    </Box>
                                )}
                        </Box>
                    );
                })}
            </Box>
        </AnimatePresence >
    );
};

export default FullScreenStories;
