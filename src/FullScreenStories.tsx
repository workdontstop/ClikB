// FullScreenStories.tsx
import React, { useCallback, useEffect, useRef, useState, useLayoutEffect, useMemo } from "react";
import { CreationDraftAction } from './creationDrafts/actions';

import { Button, Box, Typography, CircularProgress, IconButton, Stack } from "@mui/material";
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useSocialChat } from './SocialChat';

import Sandbox from "./Sandbox"; // adjust the import path as needed font scroll

import SmartDisplayIcon from '@mui/icons-material/SmartDisplay';

import FullscreenInteractionPlayer from "./FullscreenInteractionPlayer";
import SpatialExperiencePlayer from "./SpatialExperiencePlayer";
import { parseSpatialExperience, type SpatialExperience } from "./spatialExperience";

import FollowPanel from "./FollowPanel";

import { bgcolor, keyframes } from '@mui/system';



import { AnimatePresence, motion } from "framer-motion";
import { matchMobile, matchPc } from "./DetectDevice";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import axios from "axios";
import PauseIcon from '@mui/icons-material/Pause';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import AdjustIcon from '@mui/icons-material/Adjust';
import { setShowmenuToggle } from "./settingsSlice";

import { useSelector, useDispatch } from "react-redux";

import { RootState, store } from "./store";
import { createOwnedAudioChain, createOwnedNarrationSession, type OwnedAudioChain } from './ownedMediaLifecycle';
import { publishFeedsArea, removeFeedsArea } from "./brainstormSlice";
import { boundedFeedTextHint, feedInstanceId, summariseVisiblePost, type FeedAreaId, type FeedControl } from "./feedsControlSnapshot";




import { useLocation } from 'react-router-dom';
import { useNavigate } from "react-router-dom";
import Badge from '@mui/material/Badge';
import Favorite from '@mui/icons-material/Favorite';

import { activateFullscreenMute, deactivateFullscreenMute } from "./settingsSlice";


import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

import EditPost from "./EditPost";

import Plan from "./Plan";
import { clearPostActionLabels } from "./spatialLabelsSlice";
import { evictFeedPost } from "./feedCollectionCache";
import { evictCachedDeckPost } from "./useDeckNavigation";
/////feedtype

import VideoPlayer from './VideoPlayer'; // Adjust path as needed
import { postVideoSource } from './postVideoSource';
import { useFullscreenPlaybackDiagnostics } from './fullscreenPlaybackDiagnostics';
import { containedMediaRect, shouldHideVideoCaption, videoPlaybackKey } from './videoPlaybackLayout';

import {
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";



import { isIPhone13, isSafari } from "react-device-detect";

const getMobileFullscreenHeight = (): string => {
    // Dynamic viewport height tracks the REAL visible area as mobile browser
    // bars show/hide — panel always fits, so no dead space at the top and the
    // bottom seeker is never pushed below the fold. lvh sized the panel as if
    // the browser bars were hidden, which cut off the bottom whenever they
    // were visible.
    if (typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh")) return "100dvh";
    if (typeof CSS !== "undefined" && CSS.supports?.("height", "100lvh")) return "100lvh";
    return "100vh";
};

interface FeedItem {
    id: number;
    caption: string;
    username: string;
    profile_image: string;
    sender: number;

    // Existing fields
    x1: string;
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
    x9?: string;
    xt9?: string;
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
    xa9?: string;
    videoUrl: String;

    xh1?: string;
    xh2?: string;
    xh3?: string;
    xh4?: string;
    xh5?: string;
    xh6?: string;
    xh7?: string;
    xh8?: string;
    xh9?: string;

    xv1?: string;
    xv2?: string;
    xv3?: string;
    xv4?: string;
    xv5?: string;
    xv6?: string;
    xv7?: string;
    xv8?: string;
    xv9?: string;

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

    nobgmvideo?: string;

    kontext?: string;
    prompt?: string;

    ratio?: number;
    model?: string;


    main?: string;                  // main video URL
    inttype?: number;
    subl?: string;                  // left sub-video URL
    subr?: string;                  // right sub-video URL

    // touch hotspots (normalized 0..1)
    touchl?: "left";                // label (optional if you store it)
    touchlx?: number;               // left hotspot x
    touchly?: number;               // left hotspot y
    touchlr?: number;               // left hotspot radius

    touchr?: "right";               // label
    touchrx?: number;               // right hotspot x
    touchry?: number;               // right hotspot y
    touchrr?: number;


    mainaud?: string;
    sub1aud?: string;
    sub2aud?: string;

    favCount?: number;
    interactionAudioMain?: string | null;
    interactionAudioLeft?: string | null;
    interactionAudioRight?: string | null;
    touchConfigJson?: string | null;

    intbg?: number;
    interactionFormat?: string | null;
    spatialExperienceJson?: string | SpatialExperience | null;



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
    searchData: any;
    MyPageId: any;
    likedArray: any;
    likeCountArray: any;
    setLikedArray: any;
    setLikeCountArray: any;
    setLikesPostid: any;
    setLikes: any;
    setShowEmotions: any;
    showEmotions: boolean;

    setsearchDataNav: any;
    setMyPageIdNav: any;
    setfeedLastIdNav: any;
    setfeedScrollPosNav: any;


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
    setStoryVidArray,
    searchData,
    MyPageId,
    likedArray,
    likeCountArray,
    setLikedArray,
    setLikeCountArray,

    setLikesPostid,
    setLikes,
    setShowEmotions,
    showEmotions,

    setsearchDataNav,
    setMyPageIdNav,
    setfeedLastIdNav,
    setfeedScrollPosNav

}) => {


    // Early-out if list is empty or index invalid
    if (
        !Array.isArray(feeds) ||
        feeds.length === 0 ||
        verticalActiveIndex == null ||
        verticalActiveIndex < 0 ||
        verticalActiveIndex >= feeds.length
    ) {
        return null; // or a lightweight skeleton
    }

    // Reference to the vertical container so we can scroll to the active post on mount.
    const verticalContainerRef = useRef<HTMLDivElement>(null);
    // Reference for the horizontal container of the active feed.
    const horizontalContainerRef = useRef<any[]>([]);




    const [tshow, settshow] = useState(false);

    const [ActiveCap, setActiveCap] = useState(false);

    const [mp4type, setmp4type] = useState(0);

    const [showDel, setShowDel] = useState(0);

    const [Deleted, setDeleted] = useState(false);
    const deletingPostRef = useRef(false);
    const [deleteRetry, setDeleteRetry] = useState(false);
    useEffect(() => { setDeleteRetry(false); }, [showDel, verticalActiveIndex]);

    const [isOpen, setisOpen] = useState(false);

    const [hidevol, sethidevol] = useState(false);

    const [HideT, setHideT] = useState(false);


    const [Hideprofile, setHideprofile] = useState(false);

    const [forceMute, setforceMute] = useState(false);



    const clearAlldefaults = () => { }

    const VITE_ELEVEN_KEY = import.meta.env.VITE_ELEVEN_KEY;
    const dispatch = useDispatch();
    const location = useLocation();
    const fullscreenInstanceId = feedInstanceId(Number(type), !location.pathname.startsWith('/search'));
    const fullscreenAreaId: FeedAreaId = `clikb.feeds.fullscreen.${fullscreenInstanceId}`;
    const [fullscreenScroll, setFullscreenScroll] = useState({ top: 0, max: 0 });
    const [sceneScroll, setSceneScroll] = useState({ left: 0, max: 0 });
    const [captionScroll, setCaptionScroll] = useState({ top: 0, max: 0 });


    const navigate = useNavigate();
    const { open: openSocialChat, isOpen: chatOpen } = useSocialChat();
    const chatOpenRef = useRef(chatOpen);
    chatOpenRef.current = chatOpen;


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


    const [normalVideoPlaying, setNormalVideoPlaying] = useState<Record<string, boolean>>({});
    const reportVideoPlayback = useCallback((postId: string | number, source: string, playing: boolean) => {
        const key = videoPlaybackKey(postId, source);
        setNormalVideoPlaying(previous => previous[key] === playing ? previous : { ...previous, [key]: playing });
    }, []);

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
    const [Zoom3x, setZoom3x] = useState(false);
    // Replace with your actual API endpoint
    const CLIK_URL = import.meta.env.VITE_CLIK_URL
    const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;

    // Track whether the current story is active (we’ll reset it to false on each new post).
    const [activeStory, setActiveStory] = useState<boolean>(false);
    // Track whether audio is paused (in addition to audioPlaying coming from props)
    const [audioPaused, setAudioPaused] = useState<boolean>(false);

    const [activetext, setactivetext] = useState<boolean>(false);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? "#E8BAFA" : "#0099cc");

    const postActivityId = Number(feeds[verticalActiveIndex]?.id);
    const postActivityMember = Number(loggedUser?.id);
    const chatRouteOpen = Boolean(location.state?.socialChat);
    const [postActivity, setPostActivity] = useState<{ postId: number; member: number; hasMessages: boolean } | null>(null);
    const postHasChat = postActivity?.postId === postActivityId && postActivity.member === postActivityMember && postActivity.hasMessages;
    useEffect(() => {
        if (!IsFullscreen || !postActivityId || !postActivityMember || chatRouteOpen) return;
        const controller = new AbortController();
        void fetch(`${CLIK_URL || ''}/social/post-activity?postId=${postActivityId}`, {
            credentials: 'include', signal: controller.signal,
            headers: { 'X-ClikB-Active-Member': String(postActivityMember) },
        }).then(async response => {
            if (!response.ok) return;
            const { hasMessages } = await response.json();
            if (!controller.signal.aborted) setPostActivity({ postId: postActivityId, member: postActivityMember, hasMessages: hasMessages === true });
        }).catch(() => {});
        return () => controller.abort();
    }, [IsFullscreen, CLIK_URL, postActivityId, postActivityMember, chatRouteOpen]);

    const fullscreenPanelHeight = matchMobile ? getMobileFullscreenHeight() : "100dvh";

    useLayoutEffect(() => {
        if (!matchMobile) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const frameId = window.requestAnimationFrame(() => {
            const scrollRoot = document.scrollingElement || document.documentElement;
            const currentTop = window.scrollY || scrollRoot.scrollTop || document.body.scrollTop || 0;
            const maxTop = Math.max(0, scrollRoot.scrollHeight - window.innerHeight);
            const nextTop = Math.min(maxTop, currentTop + 80);

            if (nextTop > currentTop) {
                window.scrollTo({ top: nextTop, behavior: "auto" });
            }

            timeoutId = setTimeout(() => {
                const top = window.scrollY || scrollRoot.scrollTop || document.body.scrollTop || 0;
                const targetTop = Math.min(maxTop, top + 1);
                if (targetTop > top) window.scrollTo({ top: targetTop, behavior: "auto" });
            }, 80);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    const [UpdatedCaption, setUpdatedCaption] = useState(false);

    // Hold a reference to the current speech synthesis utterance.
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [nativeNarration] = useState(() => createOwnedNarrationSession());

    const [LoadingAudio, setLoadingAudio] = useState<boolean>(false);

    const [playvid, setplayvid] = useState<boolean>(false);
    const activePlaybackPost = useRef({ index: verticalActiveIndex, id: Number(feeds[verticalActiveIndex]?.id) });
    activePlaybackPost.current = { index: verticalActiveIndex, id: Number(feeds[verticalActiveIndex]?.id) };
    const observedPlaybackPost = useRef<string | null>(null);



    const [LoadingDatabase, setLoadingDatabase] = useState<boolean>(false);

    const [LoadingDatabase2, setLoadingDatabase2] = useState<boolean>(false);

    const imgRef: any = useRef(null);
    const [isNineTwelve, setIsNineTwelve] = useState(true);

    const [width, setwidth] = useState(0);
    const [height, setheight] = useState(0);
    const [actionRail, setActionRail] = useState<{ index: number; right: number } | null>(null);


    // Get the active feed row directly
    const row = useMemo(() => feeds?.[verticalActiveIndex], [feeds, verticalActiveIndex]);
    useFullscreenPlaybackDiagnostics({
        route: location.pathname, routeKey: location.key,
        tier: location.state?.clikbDeck?.tier, historyPostId: location.state?.clikbDeck?.activePostId,
        profileId: location.state?.userId, fullscreen: IsFullscreen, postId: row?.id,
        index: verticalActiveIndex, scene: horizontalActiveIndex, count: feeds.length, mode: row?.mode,
        expectedSource: type !== 3 ? postVideoSource(row) : '', mappedSource: videoArray[verticalActiveIndex],
        coverSource: row?.item1 || row?.x1,
        coverHidden: playvid && (Boolean(type !== 3 && postVideoSource(row)) || row?.interactionFormat === 'spatial-v1' || row?.mode === 2 || type === 3),
        playing: Boolean(normalVideoPlaying[videoPlaybackKey(row?.id ?? '', postVideoSource(row))]),
        captionHidden: Boolean(hideVidCap[verticalActiveIndex]), relationshipsOpen: showEmotions,
    }, verticalContainerRef);
    const [hydratedSpatialJsonById, setHydratedSpatialJsonById] = useState<Record<number, any>>({});
    const [failedSpatialById, setFailedSpatialById] = useState<Record<number, boolean>>({});
    const inFlightSpatialIdsRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (!Array.isArray(feeds) || !CLIK_URL) return;
        const candidates: FeedItem[] = [];
        if (row?.interactionFormat === "spatial-v1" && !row?.spatialExperienceJson && row?.id) {
            candidates.push(row);
        }
        feeds.forEach((item) => {
            if (
                item?.interactionFormat === "spatial-v1" &&
                !item?.spatialExperienceJson &&
                item?.id &&
                item.id !== row?.id
            ) {
                candidates.push(item);
            }
        });

        candidates.forEach((item) => {
            const postId = Number(item.id);
            if (!postId || hydratedSpatialJsonById[postId] || inFlightSpatialIdsRef.current.has(postId)) {
                return;
            }
            inFlightSpatialIdsRef.current.add(postId);
            axios
                .post(`${CLIK_URL}/getPostSpatial`, { postId })
                .then((res) => {
                    const spatialJson = res.data?.spatialExperienceJson;
                    if (spatialJson) {
                        item.spatialExperienceJson = spatialJson;
                        setHydratedSpatialJsonById((prev) => ({ ...prev, [postId]: spatialJson }));
                    } else {
                        setFailedSpatialById((prev) => ({ ...prev, [postId]: true }));
                    }
                })
                .catch((err) => {
                    console.warn("Spatial experience lazy load failed for post", postId, err);
                    setFailedSpatialById((prev) => ({ ...prev, [postId]: true }));
                })
                .finally(() => {
                    inFlightSpatialIdsRef.current.delete(postId);
                });
        });
    }, [CLIK_URL, feeds, hydratedSpatialJsonById, row]);

    const resolvedSpatialJson = row?.spatialExperienceJson ?? (row?.id ? hydratedSpatialJsonById[Number(row.id)] : null);
    const activeSpatialExperience = useMemo(() => (
        row?.interactionFormat === "spatial-v1"
            ? parseSpatialExperience(resolvedSpatialJson)
            : null
    ), [row?.id, row?.interactionFormat, resolvedSpatialJson]);

    const IS_IPHONE_OR_SAFARI = (() => {
        const ua = navigator.userAgent || "";
        const vendor = navigator.vendor || "";

        // iPhone / iPod (classic UA check)
        const isIPhone = /iPhone|iPod/i.test(ua);

        // Safari (exclude Chrome/Edge/Opera/Firefox variants on iOS & desktop)
        const isSafari =
            /Safari/i.test(ua) &&
            /Apple/i.test(vendor) &&
            !/(CriOS|Chrome|Edg|OPR|Opera|FxiOS|Firefox)/i.test(ua);

        return isIPhone || isSafari;
    })();



    //settshow(false);

    // ...

    // Inside your component
    const OpenLikes = (
        postidentity: any,
        search: any,
        myPageId: any,
        feedLastId: any,
        feedtypeforhorizontal: any
    ) => {
        // existing behavior
        setLikesPostid(postidentity);
        setLikes(true);
        setShowEmotions(true);

        // new bits
        setsearchDataNav(search);
        setMyPageIdNav(myPageId);
        setfeedLastIdNav(feedLastId);
        setfeedScrollPosNav(feedtypeforhorizontal);
    };



    useLayoutEffect(() => {
        const video = videoRefs.current[verticalActiveIndex];
        const poster = imgRef.current;
        const check = () => {
            // An unloaded video's default dimensions must never move the action rail.
            const node = playvid && video?.videoWidth ? video : poster;
            if (!node) return;
            const { width: w, height: h } = node.getBoundingClientRect();
            if (!w || !h) return;          // not laid out yet
            const dimensions = node as HTMLVideoElement & HTMLImageElement;
            if (!(dimensions.videoWidth || dimensions.naturalWidth)) return;
            setwidth(previous => Math.abs(previous - w) < .5 ? previous : w);
            setheight(previous => Math.abs(previous - h) < .5 ? previous : h);

            if (!matchMobile) {
                const media = node as HTMLVideoElement & HTMLImageElement;
                const bounds = containedMediaRect(node.getBoundingClientRect(), media.videoWidth || media.naturalWidth, media.videoHeight || media.naturalHeight);
                const panel = fullscreenRefsX.current[verticalActiveIndex]?.getBoundingClientRect();
                if (panel) {
                    const right = Math.max(12, panel.right - bounds.right - 65);
                    setActionRail(previous => previous && previous.index === verticalActiveIndex && Math.abs(previous.right - right) < .5 ? previous : { index: verticalActiveIndex, right });
                }
            }
        };

        poster?.addEventListener("load", check);
        video?.addEventListener("loadedmetadata", check);
        check();
        const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
        if (poster) ro?.observe(poster);
        if (video) ro?.observe(video);
        const panel = fullscreenRefsX.current[verticalActiveIndex];
        if (panel) ro?.observe(panel);
        window.addEventListener('resize', check);

        return () => {
            poster?.removeEventListener("load", check);
            video?.removeEventListener("loadedmetadata", check);
            ro?.disconnect();
            window.removeEventListener('resize', check);
        };
    }, [verticalActiveIndex, feeds, playvid, isMenuOpen]);


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
    const iconTimeoutRefxb = useRef<NodeJS.Timeout | null>(null);
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
        (index: number, narrationToken?: number) => {
            if (chatOpenRef.current) return;
            const token = narrationToken ?? nativeNarration.begin();
            if (!nativeNarration.isCurrent(token)) return;
            if (iconTimeoutRefx.current) clearTimeout(iconTimeoutRefx.current);

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
                    if (!nativeNarration.isCurrent(token) || utteranceRef.current !== utterance) return;
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
                            if (!nativeNarration.isCurrent(token)) return currentIndex;

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
                                nativeNarration.schedule(token, () => {
                                    playAudio(currentIndex, token);
                                }, 500);
                                return nextIndex;
                            } else {
                                // Reached the last image – stop audio.
                                setAudioPlaying(false);
                                setAudioPaused(false);
                                nativeNarration.stop();
                                return currentIndex;
                            }
                        });
                    }
                };
                utterance.onerror = (e) => {
                    if (!nativeNarration.isCurrent(token) || utteranceRef.current !== utterance) return;
                    console.error("Speech synthesis error", e);
                    setAudioPlaying(false);
                    setAudioPaused(false);
                    nativeNarration.stop();
                };
                utteranceRef.current = utterance;
                nativeNarration.attach(utterance, token);
                speechSynthesis.speak(utterance);
                setAudioPlaying(true);
                setAudioPaused(false);
            }
        },
        [activeIndex, feeds, setAudioPlaying, setAudioPaused, horizontalActiveIndex, verticalActiveIndex]
    );


    const [connected, setconnected] = useState(false);



    const popIn = keyframes`
  0%   { transform: scale(0.2); opacity: 0; }
  60%  { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
`;

    const shake = keyframes`
  0%   { transform: translateX(0) rotate(0deg); }
  20%  { transform: translateX(-4px) rotate(-4deg); }
  40%  { transform: translateX(2px)  rotate(4deg); }
  60%  { transform: translateX(-3px) rotate(-3deg); }
  80%  { transform: translateX(1px)  rotate(3deg); }
  100% { transform: translateX(0) rotate(0deg); }
`;

    // add these states near your component top
    const [ZoomHeartx, setZoomHeartx] = useState(false);
    const [ZoomCountx, setZoomCountx] = useState(false);

    // new states (top of component)
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);

    const [anim, setAnim] = useState(false);


    // call this to like/unlike

    // helper to coerce numbers
    const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    /**
     * addLike(postId, userIdx, index?)
     * - Updates single-item states (liked, likesCount)
     * - Updates per-index arrays (likedArray, likeCountArray) using the matching postId
     * Pass index if you have it; otherwise we fallback to findIndex by postId in feeds.
     */
    const addLike = async (postId: number, userIdx: number, index?: number) => {
        if (!userIdx) return;

        try {
            const requestData = { values: { postid: postId, userid: userIdx } };
            const { data }: any = await axios.post(
                `${CLIK_URL}/addlikes`,
                requestData,
                { withCredentials: true, headers: { "Content-Type": "application/json" } }
            );

            if (data?.ok) {
                const likedNow = !!data.liked;           // true when liked, false when unliked
                const likesNow = toNum(data.likes);      // server-provided count

                // update the simple states (for current post view)
                setLiked(likedNow);
                setLikesCount(likesNow);

                // figure out which index this post is at (prefer the index param to avoid searching)
                let idx = typeof index === 'number' ? index : -1;
                if (idx < 0) {
                    idx = Array.isArray(feeds) ? feeds.findIndex((f: any) => Number(f?.id) === postId) : -1;
                }
                if (idx < 0) return data; // not visible in current window; nothing else to do

                // liked array
                setLikedArray((prev: Array<{ postId: number; liked: boolean }>) => {
                    const next = [...prev];
                    // ensure index exists
                    if (idx >= next.length) {
                        next.length = idx + 1; // extends with empty slots
                    }
                    next[idx] = { postId, liked: likedNow }; // overwrite regardless
                    return next;
                });



                // like-count array
                setLikeCountArray((prev: Array<{ postId: number; count: number }>) => {
                    const next = [...prev];
                    if (idx >= next.length) {
                        next.length = idx + 1;
                    }
                    next[idx] = { postId, count: likesNow }; // overwrite regardless
                    return next;
                });

            }

            return data;
        } catch (err) {
            console.error("addLike failed:", err);
            throw err;
        }
    };





    /// const [liked, setLiked] = useState(false);
    // const [anim, setAnim] = useState(false);



    useEffect(() => {
        const item = feeds?.[verticalActiveIndex ?? -1];
        if (!item) return;                // ← avoid the undefined read
        setconnected(item.favCount === 1);
    }, [feeds, verticalActiveIndex]);



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

    const ownedAudioChainRef = useRef<OwnedAudioChain | null>(null);
    useEffect(() => () => {
        if (ownedAudioChainRef.current?.isActive()) setAudioPlaying(false);
        nativeNarration.stop();
        ownedAudioChainRef.current?.dispose();
        ownedAudioChainRef.current = null;
        if (iconTimeoutRefx.current) clearTimeout(iconTimeoutRefx.current);
        if (utteranceRef.current) {
            utteranceRef.current.onend = null;
            utteranceRef.current.onerror = null;
            utteranceRef.current = null;
        }
    }, []);
    const stop = () => {
        if (ownedAudioChainRef.current) {
            ownedAudioChainRef.current.dispose();
            ownedAudioChainRef.current = null;
        }
    }

    const pausedForChat = useRef<{ video: HTMLVideoElement; postId: number; source: string } | null>(null);
    useLayoutEffect(() => {
        const postId = Number(feeds[verticalActiveIndex]?.id);
        const video = videoRefs.current[verticalActiveIndex];
        if (chatOpen) {
            if (video && !video.paused && !video.ended && !pausedForChat.current) {
                pausedForChat.current = { video, postId, source: video.src };
            }
            videoRefs.current.forEach(media => media?.pause());
            audioRefs.current.forEach(media => media?.pause());
            const container = verticalContainerRef.current;
            if (container) container.scrollTo({ top: container.scrollTop, behavior: 'instant' });
            return;
        }
        const previous = pausedForChat.current;
        pausedForChat.current = null;
        if (previous && previous.video === video && previous.postId === postId && video.src === previous.source && video.isConnected) {
            video.play().catch(() => {});
        }
    }, [chatOpen, verticalActiveIndex, feeds]);

    useLayoutEffect(() => {
        if (!chatOpen) return;
        if (iconTimeoutRefx.current) clearTimeout(iconTimeoutRefx.current);
        nativeNarration.stop();
        if (utteranceRef.current) {
            speechSynthesis.cancel();
            utteranceRef.current = null;
        }
        ownedAudioChainRef.current?.dispose();
        ownedAudioChainRef.current = null;
        setAudioPlaying(false);
        setAudioPaused(false);
    }, [chatOpen, nativeNarration, setAudioPlaying]);



    const stopAudio = () => {
        const stoppedUtterance = utteranceRef.current;
        const stoppedGeneration = nativeNarration.stop();
        stop();

        // Slight delay to let iOS handle the user gesture first
        // Clear any previous icon hide timeout.
        if (iconTimeoutRefx.current) {
            clearTimeout(iconTimeoutRefx.current);
        }
        // Hide the icon overlay after 3 seconds.
        iconTimeoutRefx.current = setTimeout(() => {
            if (!nativeNarration.sameGeneration(stoppedGeneration)) return;
            if (stoppedUtterance && utteranceRef.current === stoppedUtterance) speechSynthesis.cancel();
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
            if (chatOpenRef.current) return;
            ///if (!audioElementRef.current) return;

            // 1) Grab audio fields from AudioArray
            const audioData = AudioArray[verticalIdx];
            if (!audioData) return;

            // [0] = xa1, then xa2..xa8
            const trackList = [
                audioData.xa1,
                audioData.xa2,
                audioData.xa3,
                audioData.xa4,
                audioData.xa5,
                audioData.xa6,
                audioData.xa7,
                audioData.xa8,
            ].filter(Boolean);

            const audioEl = audioElementRef.current;
            if (!audioEl || !trackList.length) return;
            ownedAudioChainRef.current?.dispose();
            const chain = createOwnedAudioChain(audioEl);
            ownedAudioChainRef.current = chain;
            const playback = store.getState().settings;
            audioEl.muted = playback.fullscreenMute;
            audioEl.volume = playback.playbackVolume;
            let currentTrackIndex = horizontalIdx;

            // 2) Helper to load + play the next track
            const playNext = () => {
                if (currentTrackIndex >= trackList.length) {
                    setAudioPlaying(false);
                    return;
                }
                const nextUrl = trackList[currentTrackIndex];
                chain
                    .play(nextUrl)
                    .then(() => {
                        if (!chain.isActive()) return;
                        setAudioPlaying(true);
                    })
                    .catch((err: any) => {
                        if (!chain.isActive()) return;
                        console.error("Audio play error:", err);
                        setAudioPlaying(false);
                    });
            };

            // 3) onended => auto-advance + auto-scroll
            chain.onEnded(() => {
                // For track #1 => scroll to image #0, track #2 => image #1, etc.
                if (currentTrackIndex >= 1) {
                    const container = horizontalContainerRef.current[verticalIdx];
                    if (container) {
                        const imageIndex = currentTrackIndex + 1;
                        const child = container.children[imageIndex];
                        if (child) {
                            // Use requestAnimationFrame to throttle the scroll call
                            requestAnimationFrame(() => {
                                if (!chain.isActive()) return;
                                (child as HTMLElement).scrollIntoView({
                                    behavior: "instant",
                                    inline: "start",
                                });
                            });
                        }
                    }
                }

                // Move on to the next track after a brief delay
                chain.schedule(() => {
                    currentTrackIndex++;
                    playNext();
                }, 500);
            });

            // 4) Begin playback
            playNext();
        },
        [AudioArray, horizontalContainerRef, audioElementRef, setAudioPlaying]
    );







    const ClikStory = useCallback(
        (verticalIdx: number, horizontalIdx: number, captionText: string) => {
            if (chatOpenRef.current) return;
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
                    const token = nativeNarration.currentToken();
                    if (token == null) return;
                    nativeNarration.schedule(token, () => {
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


    const startDeleteDB = async (id: any) => {
        if (deletingPostRef.current) return;
        deletingPostRef.current = true;
        setDeleteRetry(false);
        try {
            setLoadingDatabase2(true);
            //del-
            await axios.post(
                `${CLIK_URL}/delPost`,
                { postId: id },          // <-- body
                { withCredentials: true }   // <-- config
            );

            dispatch(clearPostActionLabels(Number(id)));
            evictFeedPost(Number(id));
            evictCachedDeckPost(Number(id));
            setDeleted(true);
        } catch (err) {
            setDeleteRetry(true);
            console.error("Delete failed:", err);
        } finally {
            deletingPostRef.current = false;
            setLoadingDatabase2(false);
        }
    };

    useLayoutEffect(() => {
        if (activeIndex == null) return;                       // guard
        const container = verticalContainerRef.current;
        if (!container) return;

        const target = container.children.item(activeIndex) as HTMLElement | null;
        if (!target) return;                                   // bad index guard

        container.scrollTo({
            top: target.offsetTop,                               // ← exact offset
            behavior: "instant",                                    // "instant" → "auto"
        });

        setHorizontalActiveIndex(0);                           // reset row
    }, [activeIndex]);


    /* 2️⃣  UPDATED handler -------------------------------------- */
    const handlePlay = useCallback((index?: number) => {
        if (chatOpenRef.current) return;
        //// a
        const idx = typeof index === 'number' ? index : verticalActiveIndex;
        if (idx !== activePlaybackPost.current.index || Number(feeds[idx]?.id) !== activePlaybackPost.current.id) return;
        const audio = audioRefs.current[idx];
        const video = videoRefs.current[idx];

        if (!video) return;

        /// alert('jhg');
        /* A. restart + play audio (SKIPPED FOR AUTOPLAY) */
        if (audio && MuteReducer) {
            audio.muted = true;
        } else if (audio) {
            audio.muted = false;
        }

        /* C. Skip audio and play video immediately */
        setplayvid(true);
        video.currentTime = 0;
        video.play().catch(() => { });
        const onFinish = () => {
            setAudioFlag(idx, false);
            audio?.removeEventListener("ended", onFinish);
        };

        audio?.addEventListener("ended", onFinish);

    }, [verticalActiveIndex, feeds, matchMobile, setplayvid, audioRefs, videoRefs, MuteReducer]);

    const [allowTrue, setallowTrue] = useState(true);



    const startDeleteVidx = async (vidUrl: string, idd: any) => {
        try {
            //// setLoadingDatabase(true);
            //del-
            await axios.post(
                `${CLIK_URL}/del-video`,
                { url: vidUrl },          // <-- body
                { withCredentials: true }   // <-- config
            );

            // success: update UI, toast, etc.

            startDeleteDBx(idd);

        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            /// setLoadingDatabase(false);
        }
    };

    const startDeleteDBx = async (id: any) => {
        try {
            ///setLoadingDatabase(true);
            //del-
            await axios.put(
                `${CLIK_URL}/delPostnobg`,
                { postId: id },          // <-- body
                { withCredentials: true }   // <-- config
            );

            setallowTrue(false)
            // success: update UI, toast, etc.
            /// setDeleted(true);
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            ///setLoadingDatabase(false);
        }
    };

    useEffect(() => {
        const video = videoRefs.current?.[verticalActiveIndex];
        const post = feeds[verticalActiveIndex];
        const source = type !== 3 ? postVideoSource(post) : '';
        if (!video || !post || !source) return;
        const reportPlaybackState = () => reportVideoPlayback(post.id, source, video.readyState >= 2 && !video.paused && !video.ended);
        const events = ['play', 'playing', 'pause', 'ended', 'emptied', 'loadedmetadata', 'loadeddata'];
        events.forEach(event => video.addEventListener(event, reportPlaybackState));
        // Entry and repeated .play() on cached/already-playing nodes need a state read, not another play event.
        reportPlaybackState();
        return () => {
            events.forEach(event => video.removeEventListener(event, reportPlaybackState));
            reportVideoPlayback(post.id, source, false);
        };
    }, [verticalActiveIndex, feeds, videoArray, type, playvid, reportVideoPlayback]);



    useEffect(() => {
        const verticalContainer = verticalContainerRef.current;
        if (!verticalContainer) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (chatOpenRef.current) return;
                entries.forEach((entry) => {
                    // Only trigger if the post is intersecting within the vertical container.
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                        // Find the index of the element that is intersecting.
                        const idx = fullscreenRefsX.current.findIndex(
                            (el) => el === entry.target
                        );
                        if (idx !== -1) {
                            const postKey = `${idx}:${feeds[idx]?.id}`;
                            if (observedPlaybackPost.current === postKey) return;
                            observedPlaybackPost.current = postKey;
                            activePlaybackPost.current = { index: idx, id: Number(feeds[idx]?.id) };







                            setActiveCap(false)
                            //setHideprofile(false);
                            setShowVoiceSelector(false);

                            setGeneratedAudios([]);
                            setActiveStory(false);
                            settshow(false);

                            setverticalActiveIndex(idx);

                            sethidevol(false)
                            //  setcloseInteraction(false);
                            ///setLastId(feeds[idx - 1].id);
                            stopAudio();

                            setIconOverlay({ visible: true, iconType: 'play' });

                            // Pause all other videos
                            videoRefs.current.forEach((v, i) => {
                                if (i !== idx && v) {
                                    v.pause();
                                    v.currentTime = 0;
                                }
                            });

                            setAudioFlag(idx, false);

                            setCapFlag(idx, false);

                            if (iconTimeoutRefxxa2.current) {
                                clearTimeout(iconTimeoutRefxxa2.current);
                            }
                            iconTimeoutRefxxa2.current = setTimeout(() => { sethidevol(true) }, 3000);

                            // Start immediately; post identity, not a delay, owns playback.
                            if (iconTimeoutRefxxa.current) {
                                clearTimeout(iconTimeoutRefxxa.current);
                            }

                            const scheduledPostId = Number(feeds[idx]?.id);
                            const startPlayback = () => {
                                if (activePlaybackPost.current.index !== idx || activePlaybackPost.current.id !== scheduledPostId) return;
                                const video = videoRefs.current[idx];

                                if (matchMobile) {
                                    if (MuteReducer) {
                                        if (video) {
                                            video.currentTime = 0;
                                            video.play().catch(() => { });
                                        }
                                        setplayvid(true);
                                    } else {
                                        if (isIphone) { } else {
                                            handlePlay(idx);
                                        }
                                    }
                                } else {
                                    if (type === 1 || type === 10) {
                                        if (video) {
                                            video.currentTime = 0;
                                            video.play().catch(() => { });
                                        }
                                        setplayvid(true);
                                    } else {
                                        if (feeds[idx]?.captionAudio) {
                                            handlePlay(idx);
                                        } else {
                                            if (video) {
                                                video.currentTime = 0;
                                                video.play().catch(() => { });
                                            }
                                            setplayvid(true);
                                        }
                                    }
                                }
                            };
                            startPlayback();
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
            if (iconTimeoutRefxxa.current) clearTimeout(iconTimeoutRefxxa.current);
            if (iconTimeoutRefxxa2.current) clearTimeout(iconTimeoutRefxxa2.current);
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
            console.log("title done:", data.title);

            // The title endpoint intentionally returns only a 1-2 word title.
            setEnhanceCaption(data.title);



            // 3. Kick off your TTS with the short generated title:
            /// setisLoading(false);

            handleGenerateAudio(data.title, voice);




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


    const isDirectSharedLink = /^\/experience\/[1-9]\d{0,14}\/?$/i.test(location.pathname);
    // FullScreenStories owns the real vertical scroll element. Publish only its
    // current post and controls here; the grid must not infer fullscreen state.
    useEffect(() => {
        const container = verticalContainerRef.current;
        if (!IsFullscreen || !container) return;
        const measure = () => {
            const top = Math.max(0, Math.round(container.scrollTop));
            const max = Math.max(0, Math.round(container.scrollHeight - container.clientHeight));
            setFullscreenScroll(previous => previous.top === top && previous.max === max ? previous : { top, max });
        };
        measure();
        container.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => {
            container.removeEventListener('scroll', measure);
            window.removeEventListener('resize', measure);
        };
    }, [IsFullscreen]);
    useEffect(() => {
        const container = horizontalContainerRef.current[verticalActiveIndex] as HTMLElement | undefined;
        if (!IsFullscreen || !container) {
            setSceneScroll(previous => previous.left === 0 && previous.max === 0 ? previous : { left: 0, max: 0 });
            return;
        }
        const measure = () => {
            const left = Math.max(0, Math.round(container.scrollLeft));
            const max = Math.max(0, Math.round(container.scrollWidth - container.clientWidth));
            setSceneScroll(previous => previous.left === left && previous.max === max ? previous : { left, max });
        };
        measure();
        container.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => { container.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }, [IsFullscreen, verticalActiveIndex, row?.id]);

    useEffect(() => {
        const caption = ActiveCap ? verticalContainerRef.current?.querySelector<HTMLElement>('[data-feeds-caption-scroll="active"]') : null;
        if (!IsFullscreen || !caption) {
            setCaptionScroll(previous => previous.top === 0 && previous.max === 0 ? previous : { top: 0, max: 0 });
            return;
        }
        const measure = () => {
            const top = Math.max(0, Math.round(caption.scrollTop));
            const max = Math.max(0, Math.round(caption.scrollHeight - caption.clientHeight));
            setCaptionScroll(previous => previous.top === top && previous.max === max ? previous : { top, max });
        };
        measure();
        caption.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => { caption.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }, [IsFullscreen, ActiveCap, verticalActiveIndex, row?.id]);

    useEffect(() => {
        if (!IsFullscreen) {
            dispatch(removeFeedsArea({ areaId: fullscreenAreaId, source: 'FullScreenStories' }));
            return;
        }
        const post = feeds[verticalActiveIndex];
        if (!post) return;
        const normalSource = type !== 3 ? postVideoSource(row) : '';
        const actualVideoPlaying = Boolean(normalVideoPlaying[videoPlaybackKey(post.id, normalSource)]);
        const captionHidden = shouldHideVideoCaption(Boolean(normalSource), actualVideoPlaying, Boolean(hideVidCap[verticalActiveIndex]));
        const expandedCaption = ActiveCap && !captionHidden;
        const sidebarVisible = !showEmotions && !ActiveCap && !HideT && !activetext && !activeStory && showDel === 0 && !isOpen;
        const mediaControlsVisible = sidebarVisible && !hideVidCap[verticalActiveIndex];
        const controls: FeedControl[] = [];
        const creatorLabel = post.username ? `Creator @${String(post.username).trim().replace(/^@/, '').slice(0, 48)}` : 'Creator profile';
        const add = (name: string, handlerRef: string, policy: FeedControl['aiPolicy'] = 'candidate', label?: string) => {
            controls.push({ controlId: `${fullscreenAreaId}.${name}`, areaId: fullscreenAreaId,
                handlerRef, enabled: true, aiPolicy: policy, targetId: post.id,
                ...(label ? { label } : {}), ...(policy === 'candidate' ? { candidateActionId: `${fullscreenAreaId}.${name}` } : {}) });
        };
        if (!showEmotions && isDirectSharedLink && showDel === 0 && !isOpen) add('close_shared', 'FullScreenStories.closeViewer');
        if (!showEmotions && !isDirectSharedLink && showDel === 0 && !isOpen)
            add('back_to_feed', 'FullScreenStories.closeViewer: browser Back then FeedsGate.handlePopState');
        if (!showEmotions && !matchMobile && showDel === 0 && !isOpen && Boolean(post.x1 || post.x2 || post.x3 || post.x4 || post.x5 || post.x6 || post.x7 || post.x8))
            add('close_by_padding', 'FullScreenStories black padding onClick', 'manual_only');
        if (!showEmotions && showDel === 0 && !isOpen) add('scroll_posts', 'FullScreenStories.verticalContainerRef', 'scroll');
        if (!showEmotions && showDel === 1) {
            add(Deleted ? 'close_deleted' : 'cancel_delete', 'FullScreenStories.setShowDel');
            if (!Deleted) add('confirm_delete', 'FullScreenStories.startDeleteDB and media cleanup', 'manual_only');
        }
        if (!showEmotions && showDel === 0 && !isOpen && !hideVidCap[verticalActiveIndex]) {
            if (!captionHidden) add(expandedCaption ? 'collapse_caption' : 'expand_caption', 'FullScreenStories.setActiveCap', 'candidate', expandedCaption ? 'Collapse caption' : 'Expand caption');
        }
        if (!showEmotions && showDel === 0 && !isOpen && expandedCaption)
            add('creator_profile', 'FullScreenStories.GotoProfile', 'candidate', creatorLabel);
        if (!showEmotions && showDel === 0 && !isOpen && expandedCaption && captionScroll.max > 0)
            add('scroll_caption', 'FullScreenStories expanded caption scroll', 'scroll');
        if (sidebarVisible) {
            add('open_post_chat', 'FullScreenStories.openSocialChat', 'candidate', 'Post chat');
            add('creator_profile', 'FullScreenStories.GotoProfile', 'candidate', creatorLabel);
            add(likedArray[verticalActiveIndex]?.liked ? 'open_likes' : 'like_post',
                likedArray[verticalActiveIndex]?.liked ? 'FullScreenStories.OpenLikes' : 'FullScreenStories.addLike');
            if (likedArray[verticalActiveIndex]?.liked) add('open_likes_count', 'FullScreenStories.OpenLikes');
        }
        if (mediaControlsVisible) {
            if (MuteReducer || !hidevol) add('toggle_mute', 'FullScreenStories.activateFullscreenMute/deactivateFullscreenMute');
            add('open_plan', 'FullScreenStories.setShowDel(2)', 'candidate', 'Open creation plan');
            if (row?.mode !== 2) add('media_playback', 'FullScreenStories.VideoPlayer or media surface', 'manual_only');
        }
        const summary = summariseVisiblePost(post as unknown as Record<string, unknown>);
        const sceneCount = [post.x1, post.x2, post.x3, post.x4, post.x5, post.x6, post.x7, post.x8].filter(Boolean).length;
        if (!showEmotions && showDel === 0 && !isOpen && sceneCount > 1)
            add('scroll_scenes', 'FullScreenStories.horizontalContainerRef', 'scroll');
        dispatch(publishFeedsArea({ areaId: fullscreenAreaId, source: 'FullScreenStories',
            instanceId: fullscreenInstanceId,
            state: {
                postId: post.id, activeLoadedIndex: verticalActiveIndex,
                postTitle: boundedFeedTextHint(post.finalTitle, 80) || null,
                creatorUsername: boundedFeedTextHint(post.username, 48) || null,
                captionHint: boundedFeedTextHint(post.caption, 140) || null,
                promptHint: boundedFeedTextHint((post as any).prompt, 140) || null,
                loadedCount: feeds.length, hasPreviousLoaded: verticalActiveIndex > 0,
                hasNextLoaded: verticalActiveIndex < feeds.length - 1,
                scrollOwner: 'FullScreenStories.verticalContainerRef',
                scrollTop: fullscreenScroll.top, scrollMax: fullscreenScroll.max,
                scrollRegion: fullscreenScroll.max <= 0 ? 'single' : fullscreenScroll.top <= 2 ? 'start'
                    : fullscreenScroll.top >= fullscreenScroll.max - 2 ? 'end' : 'middle',
                horizontalSceneIndex: Number(horizontalActiveIndex) || 0,
                sceneCount, sceneScrollLeft: sceneScroll.left, sceneScrollMax: sceneScroll.max,
                canScrollScenesBackward: sceneScroll.left > 2,
                canScrollScenesForward: sceneScroll.left < sceneScroll.max - 2,
                captionExpanded: expandedCaption, captionHidden, muted: MuteReducer, postHasChat: Boolean(postHasChat),
                captionScrollTop: expandedCaption ? captionScroll.top : 0,
                captionScrollMax: expandedCaption ? captionScroll.max : 0,
                mediaPlaying: normalSource ? actualVideoPlaying : playvid, planOpen: showDel === 2,
                deleteConfirmationOpen: showDel === 1,
                editOpen: isOpen, sidebarVisible, sharedLink: isDirectSharedLink,
                obscuredByLikes: showEmotions,
                closeInteractionArmed: closeInteraction,
                liked: Boolean(likedArray[verticalActiveIndex]?.liked),
                likeCount: Number(likeCountArray[verticalActiveIndex]?.count) || 0,
            },
            visiblePosts: summary && !isOpen ? [summary] : [], visibleControls: controls,
        }));
    }, [dispatch, IsFullscreen, fullscreenAreaId, fullscreenInstanceId, feeds, verticalActiveIndex,
        fullscreenScroll, sceneScroll, captionScroll, horizontalActiveIndex, ActiveCap, HideT, activetext, activeStory,
        showDel, Deleted, isOpen, closeInteraction, showEmotions, hideVidCap, MuteReducer, hidevol, likedArray, likeCountArray,
        playvid, isDirectSharedLink, normalVideoPlaying, videoArray, type, row, postHasChat]);
    useEffect(() => () => {
        dispatch(removeFeedsArea({ areaId: fullscreenAreaId, source: 'FullScreenStories' }));
    }, [dispatch, fullscreenAreaId]);
    const closeViewer = () => {
        if (isDirectSharedLink && location.state?.socialChatPost === true) navigate(-1);
        else if (isDirectSharedLink) navigate('/feeds', { replace: true });
        else window.history.back();
    };

    const { userId } = location.state || {};

    const useDocumentFeedScroll =
        matchMobile && ["/", "/images", "/kickit", "/clikit", "/feeds", "/pages"].includes(location.pathname.toLowerCase());


    const GotoProfile = useCallback(
        (id: number, index: number) => {



            // If you still need to go back first, keep window.history.back() here
            ///


            if (userId === id && type === 10) {
                window.history.back();
            } else {

                if (location.state?.clikbDeck?.version === 1 && location.state.clikbDeck.tier === 'story') {
                    // Keep this exact fullscreen entry below the new profile.
                    // closePop() would first go Back to Deck; replacing that
                    // entry and pushing Profile then discards fullscreen's
                    // Forward history and loses its collection/post identity.
                    if (iconTimeoutRefxx.current) clearTimeout(iconTimeoutRefxx.current);
                    navigate('/pages', { state: { userId: id } });
                    return;
                }

                closePop();

                if (iconTimeoutRefxx.current) {
                    clearTimeout(iconTimeoutRefxx.current);
                }

                // Hide the icon overlay after 0.5s
                iconTimeoutRefxx.current = setTimeout(() => {
                    const feedScrollPos = useDocumentFeedScroll ? window.scrollY : feedContainerRef.current?.scrollTop ?? 0;

                    const feedLastId = feeds[index + 1] ? feeds[index + 1].id : 0;

                    /// alert(feedLastId);
                    /// alert(feedLastId);

                    console.log(
                        `Navigating from ${location.pathname} with ScrollPos: ${feedScrollPos} and PageNum: ${feedLastId} to profile ${id}`
                    );

                    const routeState = {
                        ownerId: MyPageId,
                        routeScrollPos: feedScrollPos,
                        routelastId: feedLastId,
                        fullscreen: true,  // Added fullscreen mode flag
                        feedtype: type,
                        search: searchData
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
        [closePop, feeds, feedContainerRef, navigate, location, userId, type, searchData, MyPageId, useDocumentFeedScroll]
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

            {isDirectSharedLink && showDel !== 2 && !isOpen && (
                <IconButton
                    aria-label="Close shared post"
                    data-ai-action={`${fullscreenAreaId}.close_shared`}
                    onClick={closeViewer}
                    sx={{ position: 'fixed', top: 16, right: 16, zIndex: 10020, color: '#fff', bgcolor: 'rgba(0,0,0,0.65)', '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' } }}
                >
                    <CloseIcon />
                </IconButton>
            )}

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
                    height: fullscreenPanelHeight,
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
                    height: fullscreenPanelHeight,
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
                    height: fullscreenPanelHeight,
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





            {LoadingDatabase2 ? <div
                style={{
                    position: "fixed",
                    top: "0vh",
                    zIndex: 9999,

                    width: matchMobile ? "100%" : '100%',
                    left: matchMobile ? "0px" : '-0vw',
                    height: fullscreenPanelHeight,
                    textAlign: "center",
                    color: '#ffffff',
                    backgroundColor: 'rgb(0,0,0,0.45)'
                }}
            > <div
                style={{

                    marginTop: "20vh",

                }}
            >  Deleting.. </div>  </div> : null
            }


            <Box
                data-fullscreen-stories="true"
                data-ai-action={!isDirectSharedLink && !showEmotions && showDel === 0 && !isOpen
                    ? `${fullscreenAreaId}.back_to_feed` : undefined}

                onClick={(e) => {
                    /// e.stopPropagation();
                    /// window.history.back();
                }
                }
                component={motion.div}
                key="fullscreen-overlay-stories"

                initial={false}
                ref={verticalContainerRef}
                data-ai-scroll={`${fullscreenAreaId}:posts`}
                // The interaction sits above the post's cover image and video, but a
                // finger that strays off a hotspot lands on those instead, and the
                // long-press sheet it opens belongs to whichever panel was hit — which
                // is why the offered image looked like it came from another post.
                // Cancelled here, once, for every panel in the scroller.
                onContextMenu={(e: any) => { if (matchMobile) e.preventDefault(); }}
                sx={{
                    WebkitTapHighlightColor: "transparent",
                    // iOS ignores the contextmenu handler and needs the CSS opt-out,
                    // and it must name the media elements: WebKit drops
                    // -webkit-touch-callout on replaced elements rather than
                    // inheriting it from an ancestor.
                    ...(matchMobile ? {
                        WebkitTouchCallout: "none",
                        "& img, & video, & canvas": {
                            WebkitTouchCallout: "none",
                            WebkitUserSelect: "none",
                            userSelect: "none",
                        },
                    } : {}),

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
                    height: fullscreenPanelHeight, // use the stable fullscreen height so snap points stay aligned  backgroundColor
                    backgroundColor: darkModeReducer ? 'rgb(30,30,30,0.95)' : 'rgb(210,210,210,0.95)',
                    backgroundImage: `linear-gradient(color-mix(in srgb, ${appColor} 5%, transparent), color-mix(in srgb, ${appColor} 5%, transparent))`,
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    zIndex: 9990,
                    overflowY: "scroll",
                    overflowX: "hidden",
                    scrollSnapType: "y mandatory",
                    scrollBehavior: "smooth",
                    overscrollBehavior: "contain",
                    WebkitOverflowScrolling: "touch",
                    "&::-webkit-scrollbar": {
                        width: "8px",
                    },
                    "&::-webkit-scrollbar-track": {
                        background: "rgb(255,255,255,0.2)",
                    },
                    "&::-webkit-scrollbar-thumb": {
                        background: "rgb(150,150,150,0.8)",
                        borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                        background: "rgb(255,255,255,0.1)",
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
                    if (storyImages.length === 0 && item.mode !== 2) {
                        const fallbackImage = item.item1 || (item as any).thumb1 || (item as any).item2 || (item as any).poster;
                        if (fallbackImage) {
                            storyImages.push(fallbackImage);
                        }
                    }
                    const isSpatialPost = item.interactionFormat === "spatial-v1";
                    const rawVideoCandidate = postVideoSource(item);
                    const normalVideoSource = item.mode !== 2 && type !== 3 ? rawVideoCandidate : '';
                    const hideCover = playvid && (Boolean(normalVideoSource) || isSpatialPost || item.mode === 2 || type === 3);
                    const hidePlayingCaption = shouldHideVideoCaption(Boolean(normalVideoSource),
                        Boolean(normalVideoPlaying[videoPlaybackKey(item.id, normalVideoSource)]), Boolean(hideVidCap[index]));
                    const captionExpanded = ActiveCap && !hidePlayingCaption;

                    return (
                        <Box
                            key={item.id}
                            data-playback-post-id={import.meta.env.DEV ? item.id : undefined}
                            ref={(el) => (fullscreenRefsX.current[index] = el!)}
                            onClick={(e) => {
                                if (e.target === e.currentTarget && !matchMobile) {
                                    closeViewer();
                                }
                            }}
                            sx={{
                                width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                                height: fullscreenPanelHeight,
                                maxHeight: fullscreenPanelHeight,
                                scrollSnapAlign: "start",
                                scrollSnapStop: "always",
                                position: "relative",
                            }}
                        >



                            {verticalActiveIndex === index ? <CreationDraftAction post={item} surface="fullscreen" /> : null}
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
                                        data-ai-scroll={index === verticalActiveIndex ? `${fullscreenAreaId}:scenes` : undefined}
                                        sx={{
                                            width: "100%",
                                            height: fullscreenPanelHeight,
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



                                        {showDel === 1 && index === verticalActiveIndex ? <Box
                                            sx={{
                                                position: "absolute",
                                                inset: 0,
                                                width: "100%",
                                                height: fullscreenPanelHeight,
                                                bgcolor: "rgba(0,0,0,0.15)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                zIndex: 1300,
                                            }}
                                        // onClick={onCancel}
                                        >
                                            {/* Prevent inner clicks from closing */}
                                            <Box
                                                onClick={(e) => e.stopPropagation()}
                                                sx={{
                                                    width: 280,
                                                    bgcolor: "#f9f9f9",
                                                    color: Deleted ? 'blue' : '#000000',
                                                    borderRadius: 4,
                                                    p: 3,
                                                    boxShadow: 24,
                                                    textAlign: "center",
                                                    fontFamily: "-apple-system, BlinkMacSystemFont, \"San Francisco\", \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
                                                }}
                                            >
                                                <Typography variant="h6" gutterBottom>
                                                    {Deleted ? '  Deleted' : '  Delete this item?'}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                                    {Deleted ? '' : 'This action can’t be undone.'}
                                                </Typography>

                                                <Stack direction="row" spacing={2} justifyContent="center">

                                                    {Deleted ?
                                                        <Button
                                                            data-ai-action={`${fullscreenAreaId}.close_deleted`}
                                                            variant="outlined"
                                                            color="inherit"
                                                            size="large"
                                                            fullWidth
                                                            sx={{ borderRadius: 3, textTransform: "none", fontSize: "1rem" }}
                                                            onClick={() => {

                                                                setShowDel(0);

                                                            }}
                                                        >
                                                            Close
                                                        </Button> :

                                                        <>
                                                            <Button
                                                                variant="contained"
                                                                color="error"
                                                                size="large"
                                                                fullWidth
                                                                sx={{ borderRadius: 3, textTransform: "none", fontSize: "1rem" }}
                                                                disabled={LoadingDatabase2}
                                                                onClick={() => void startDeleteDB(feeds[index].id)}

                                                            >
                                                                {deleteRetry ? 'Try again' : 'Yes'}
                                                            </Button>
                                                            <Button
                                                                data-ai-action={`${fullscreenAreaId}.cancel_delete`}
                                                                variant="outlined"
                                                                color="inherit"
                                                                size="large"
                                                                fullWidth
                                                                sx={{ borderRadius: 3, textTransform: "none", fontSize: "1rem" }}
                                                                onClick={() => {

                                                                    setShowDel(2);

                                                                }}
                                                            >
                                                                No
                                                            </Button>
                                                        </>
                                                    }
                                                </Stack>
                                            </Box>
                                        </Box> : null}


                                        {
                                            showDel === 2 && index === verticalActiveIndex ?
                                                <Plan
                                                    ty={0}
                                                    isMenuOpen={isMenuOpen}
                                                    feeds={feeds}
                                                    verticalActiveIndex={verticalActiveIndex}
                                                    setZoom2x={setZoom2x}
                                                    setShowDel={setShowDel} />
                                                : null
                                        }



                                        {

                                            index === verticalActiveIndex ?

                                                <Box

                                                    onMouseEnter={() => setZoom3x(true)}
                                                    onMouseOver={() => setZoom3x(true)}
                                                    onMouseLeave={() => setZoom3x(false)}

                                                    onTouchStart={() => setZoom3x(true)}
                                                    onTouchEnd={() => setZoom3x(false)}

                                                    onClick={() => {

                                                        setZoom3x(true);
                                                        setTimeout(() => setZoom3x(false), 300);


                                                        if (MuteReducer) {

                                                            dispatch(deactivateFullscreenMute());
                                                        } else {

                                                            dispatch(activateFullscreenMute());
                                                        }

                                                    }}

                                                    sx={{
                                                        position: "absolute",
                                                        display: "none",
                                                        bottom: matchMobile ? "245px" : "255px",
                                                        right: matchMobile ? "2vw" : "calc(50% - 230px)",
                                                        width: "auto",
                                                        alignItems: "center",
                                                        zIndex: 1000,
                                                    }}
                                                >
                                                    {/* unified icon + label  video button */}
                                                    <Box
                                                        className={`toggle-image ${Zoom3x ? "bounce" : ""}`}
                                                        onClick={() => {
                                                        }}
                                                        sx={{
                                                            opacity: 0.85,
                                                            alignItems: "center",
                                                            gap: 0,          // keep icon centred when collapsed start delete
                                                            width: 55,  // pill width → circle width
                                                            height: 55,
                                                            px: 0,         // same padding you used on the label
                                                            py: 0.4,
                                                            borderRadius: "50%",
                                                            bgcolor: darkModeReducer
                                                                ? "rgba(0,0,0,0.35)"
                                                                : "rgb(250,250,250,0.3)",
                                                            backdropFilter: "blur(1px)",
                                                            boxShadow: 3,

                                                            display: hideVidCap[verticalActiveIndex] ? "none" : MuteReducer ? "inline-flex" :
                                                                hidevol ? 'none' : 'inline-flex',


                                                            cursor: "pointer",
                                                            "&:hover": {
                                                                bgcolor: darkModeReducer
                                                                    ? "rgba(100,100,100,0.3)"
                                                                    : "rgba(250,250,250,0.3)",
                                                            },

                                                            visibility: 'visible',
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

                                            index === verticalActiveIndex ?

                                                <Box

                                                    onMouseEnter={() => setZoom2x(true)}
                                                    onMouseOver={() => setZoom2x(true)}
                                                    onMouseLeave={() => setZoom2x(false)}

                                                    onTouchStart={() => setZoom2x(true)}
                                                    onTouchEnd={() => setZoom2x(false)}

                                                    onClick={() => {


                                                    }}

                                                    sx={{
                                                        position: "absolute",
                                                        display: "none",
                                                        bottom: matchMobile ? "180px" : "190px",
                                                        right: matchMobile ? "2vw" : "calc(50% - 230px)",
                                                        width: "auto",
                                                        alignItems: "center",
                                                        zIndex: 1000,
                                                    }}
                                                >
                                                    {/* unified icon + label button */}
                                                    <Box
                                                        className={`toggle-image ${Zoom2x ? "bounce" : ""}`}
                                                        onClick={() => {
                                                            setDeleted(false);
                                                            setShowDel(2);


                                                        }}
                                                        sx={{
                                                            opacity: 0.85,
                                                            alignItems: "center",
                                                            gap: 0,          // keep icon centred when collapsed
                                                            width: 55,  // pill width → circle width video
                                                            height: 55,
                                                            px: 0,         // same padding you used on the label
                                                            py: 0.4,
                                                            borderRadius: "50%",
                                                            bgcolor: darkModeReducer
                                                                ? "rgba(0,0,0,0.35)"
                                                                : "rgb(250,250,250,0.3)",
                                                            backdropFilter: "blur(1px)",
                                                            boxShadow: 3,

                                                            display: hideVidCap[verticalActiveIndex] ? "none" : "inline-flex",

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
                                                        {item.mode === 2 && !playvid ? <AdjustIcon
                                                            sx={{
                                                                fontSize: matchMobile ? "1.8rem" : "1.7rem",
                                                                color: darkModeReducer ? "#fff" : "#000",
                                                                textAlign: 'center',
                                                                margin: 'auto',
                                                            }}
                                                        /> : <MoreVertIcon
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

                                                : null}

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
                                                    width: matchMobile ? '100vw' : isMenuOpen ?

                                                        "80vw" : '100vw',
                                                    transform: matchMobile ? 'scale(1)' : item.ratio === 3 ? 'scale(1)' : 'scale(1)',

                                                    height: fullscreenPanelHeight,
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
                                                                closeViewer();
                                                            }
                                                        } else {
                                                            closeViewer();
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
                                                        height: fullscreenPanelHeight, // use the stable fullscreen height so snap points stay aligned
                                                        /// backgroundColor: darkModeReducer ? 'rgb(30,30,30,0.95)' : 'rgb(210,210,210,0.95)',
                                                        zIndex: 0,

                                                    }}
                                                >

                                                </Box>

                                                {verticalActiveIndex === index ?
                                                    <>

                                                        {item.mode === 2 ?

                                                            playvid &&
                                                            <Box
                                                                /////// onClick={() => { setHideT(true) }}
                                                                onClick={(event) => event.stopPropagation()}
                                                                sx={{
                                                                    position: "absolute",
                                                                    inset: 0,
                                                                    width: "100%",
                                                                    height: "100%",
                                                                    p: 0,
                                                                    zIndex: 3,
                                                                    display: isSpatialPost && !matchMobile ? "flex" : "block",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    // Let unused desktop space reach the existing fullscreen
                                                                    // close layer. The spatial canvas below opts back into input.
                                                                    pointerEvents: isSpatialPost && !matchMobile ? "none" : "auto",
                                                                }}>
                                                                {isSpatialPost ? (
                                                                    activeSpatialExperience ? (
                                                                        <Box
                                                                            onClick={(event) => event.stopPropagation()}
                                                                            sx={{
                                                                                position: "relative",
                                                                                width: matchMobile
                                                                                    ? "100%"
                                                                                    : item.ratio === 3
                                                                                        ? "min(177.7778dvh, 100%)"
                                                                                        : item.ratio === 2
                                                                                            ? "100dvh"
                                                                                            : "56.25dvh",
                                                                                height: matchMobile || item.ratio !== 3 ? "100%" : "auto",
                                                                                maxWidth: "100%",
                                                                                maxHeight: "100%",
                                                                                aspectRatio: item.ratio === 3
                                                                                    ? "16 / 9"
                                                                                    : item.ratio === 2
                                                                                        ? "1 / 1"
                                                                                        : "9 / 16",
                                                                                pointerEvents: "auto",
                                                                                overflow: "hidden",
                                                                            }}
                                                                        >
                                                                            <SpatialExperiencePlayer
                                                                                key={`spatial-feed-${item.id}`}
                                                                                mode="feed"
                                                                                postId={item.id}
                                                                                creatorId={item.sender}
                                                                                api={CLIK_URL}
                                                                                document={activeSpatialExperience}
                                                                                poster={item.x1 || item.item1 || (item as any).thumb1 || (item as any).poster}
                                                                                appColor={appColor}
                                                                                darkMode={darkModeReducer}
                                                                                muted={MuteReducer}
                                                                                snapshotObscured={showDel !== 0 || showEmotions}
                                                                                onSurfaceTap={() => setActiveStory(true)}
                                                                            />
                                                                        </Box>
                                                                    ) : failedSpatialById[Number(item.id)] ? (
                                                                        <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", bgcolor: "#080808", color: "#fff" }}>
                                                                            <Typography>Spatial experience unavailable.</Typography>
                                                                        </Box>
                                                                    ) : (
                                                                        <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5, bgcolor: "#080808", color: "rgba(255,255,255,0.78)" }}>
                                                                            <CircularProgress size={28} sx={{ color: appColor || "#fff" }} />
                                                                            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>Loading 3D experience…</Typography>
                                                                        </Box>
                                                                    )
                                                                ) : <FullscreenInteractionPlayer
                                                                    key={`interaction-feed-${item.id}`}
                                                                    item={item}
                                                                    setActiveStory={setActiveStory}
                                                                    snapshotObscured={showDel !== 0 || showEmotions}
                                                                />}
                                                            </Box>
                                                            : normalVideoSource ? (

                                                            <VideoPlayer
                                                                snapshotObscured={showDel !== 0 || showEmotions || chatOpen}
                                                                playbackSuspended={chatOpen}
                                                                loop={false}
                                                                onEnded={() => {
                                                                    if (chatOpenRef.current || store.getState().settings.autoControlEnabled || index !== activePlaybackPost.current.index || Number(item.id) !== activePlaybackPost.current.id) return;
                                                                    if (index < feeds.length - 1) {
                                                                        const nextEl = fullscreenRefsX.current[index + 1];
                                                                        if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                    }
                                                                }}
                                                                singleMode={false}
                                                                // Identity
                                                                index={index}
                                                                src={normalVideoSource}
                                                                onPlaybackChange={(playing) => reportVideoPlayback(item.id, normalVideoSource, playing)}
                                                                isActive={index === verticalActiveIndex} // Ensures controls only show on active slide

                                                                // State Passing
                                                                isUIHidden={!!hideVidCap[verticalActiveIndex]}
                                                                setUIHidden={(val) => setCapFlag(index, val)}

                                                                // Ref (Important: Updates your existing videoRefs array)
                                                                onRefAssign={(el) => (videoRefs.current[index] = el)}

                                                                // Styling Logic Variables
                                                                matchMobile={matchMobile}
                                                                isNineTwelve={isNineTwelve}
                                                                isMenuOpen={isMenuOpen}
                                                                item={item}
                                                                playvid={playvid}

                                                                // Audio & Theme
                                                                muted={MuteReducer}
                                                                darkMode={darkModeReducer}
                                                                mobileViewportHeight={fullscreenPanelHeight}
                                                            />
                                                        ) : null}

                                                    </> : null}



                                                {

                                                    verticalActiveIndex === index

                                                        ? matchMobile ?
                                                            <Box
                                                                sx={{
                                                                    position: 'absolute',
                                                                    width: '100vw',
                                                                    height: fullscreenPanelHeight,
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
                                                                    loading={Math.abs(index - verticalActiveIndex) <= 1 ? 'eager' : 'lazy'}
                                                                    decoding="async"
                                                                    alt={`Story-${item.id}-0`}
                                                                    onClick={e => {
                                                                        e.stopPropagation();

                                                                        const video = videoRefs.current[index];

                                                                        if (type === 3) {



                                                                            if (video) {
                                                                                video.play();
                                                                            }
                                                                            setplayvid(true);


                                                                        } else {
                                                                            if (normalVideoSource) {



                                                                                if (type === 1 || type === 10) {

                                                                                    if (video) {
                                                                                        video.play();
                                                                                    }
                                                                                    setplayvid(true);
                                                                                } else {
                                                                                    if (video) {
                                                                                        video.play();
                                                                                    }
                                                                                    setplayvid(true);

                                                                                }
                                                                            } else {
                                                                                setActiveStory(prev => !prev);
                                                                                settshow(false);
                                                                            }
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        maxWidth: '100%',
                                                                        maxHeight: '100%',
                                                                        width: matchMobile ? '100%' : 'auto',
                                                                        height: '100%',
                                                                        objectFit: 'contain',
                                                                        cursor: 'pointer',
                                                                        display: 'block',
                                                                        opacity: hideCover ? 0 : 1,
                                                                        pointerEvents: hideCover ? 'none' : 'auto',
                                                                        transition: "none"
                                                                    }}
                                                                />
                                                            </Box>
                                                            : <img
                                                                ref={verticalActiveIndex === index ? imgRef : null}
                                                                src={storyImages[0]}
                                                                loading={Math.abs(index - verticalActiveIndex) <= 1 ? 'eager' : 'lazy'}
                                                                decoding="async"
                                                                alt={`Story-${item.id}-${0}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (normalVideoSource) {

                                                                        const video = videoRefs.current[index];

                                                                        if (type === 1 || type === 10) {

                                                                            if (video) {
                                                                                video.play();
                                                                            }
                                                                            setplayvid(true);

                                                                        } else {

                                                                            if (video) {
                                                                                video.play();
                                                                            }
                                                                            setplayvid(true);
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
                                                                    height: fullscreenPanelHeight,
                                                                    objectFit: matchMobile ? "cover" : "contain",
                                                                    zIndex: 1,
                                                                    display: 'block',
                                                                    opacity: hideCover ? 0 : 1,
                                                                    pointerEvents: hideCover ? 'none' : 'auto',
                                                                    transition: "none"
                                                                }}
                                                            /> : null
                                                }

                                                {Boolean(normalVideoSource) && (
                                                    <Box
                                                        onClick={(e: any) => {
                                                            /// e.stopPropagation();
                                                            //  setplayvid(true);
                                                            const video = videoRefs.current[index];


                                                            if (type === 1 || type === 10) {




                                                                if (video) {
                                                                    video.play();

                                                                }
                                                                /// alert('kk');
                                                                setplayvid(true);

                                                            } else {

                                                                if (feeds[verticalActiveIndex].captionAudio) {

                                                                    handlePlay(index)
                                                                } else {
                                                                    if (video) {
                                                                        video.play();
                                                                    } setplayvid(true);

                                                                }
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



                                                {type === 3 && !playvid ?


                                                    <Box
                                                        onClick={(e: any) => {
                                                            /// e.stopPropagation();
                                                            //  setplayvid(true);
                                                            const video = videoRefs.current[index];



                                                            if (video) {
                                                                video.play();

                                                            }
                                                            /// alert('kk');
                                                            setplayvid(true);
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
                                                    </Box> : null}

                                                {!activeStory && (
                                                    <Box
                                                        //onClick={() => { /* your onClick logic here */ e.stopPropagation(); }}
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: matchMobile ? '' :
                                                                item.ratio === 3 ?
                                                                    item.model === 'Gpt Image' ? height / 100 :
                                                                        isMenuOpen ? height / 20 : height / 30 :
                                                                    height / 100,


                                                            top: matchMobile ?

                                                                item.mode === 2 ?
                                                                    loggedUser ? loggedUser.id === feeds[index].sender ? '80vh' : '75.7vh' : null
                                                                    : isNineTwelve ?
                                                                        ActiveCap ? '66vh' :

                                                                            loggedUser ? loggedUser.id === feeds[index].sender ?
                                                                                '80.3vh' : '76vh' : null :



                                                                        ActiveCap ? '70vh' :
                                                                            loggedUser ? loggedUser.id === feeds[index].sender ?
                                                                                '84.3vh' : '80vh' : null


                                                                : '',

                                                            left: matchMobile ? '0px' : '50%',
                                                            transform: matchMobile ? 'none' : 'translateX(-50%)',
                                                            width: matchMobile ? '100%' :
                                                                item.ratio === 1 ? '56.25dvh' :
                                                                item.ratio === 2 ? '100%' :
                                                                item.ratio === 3 ?
                                                                    item.model === 'Gpt Image' ?
                                                                        isMenuOpen ? width / 1.1 : width / 1.5 :
                                                                        isMenuOpen ? width / 1.02 : width / 1.2 :
                                                                width,
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
                                                                textShadow: '0px 1px 3px rgba(0,0,0,0.9), 0px 0px 6px rgba(0,0,0,0.7)',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'space-between',


                                                            }}
                                                        >


                                                            <Typography

                                                                onClick={() => {


                                                                    //GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                                }}
                                                                variant="subtitle2"
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    fontWeight: 'bold',
                                                                    mb: 1,
                                                                    fontSize: matchMobile ? '0.95rem' : '1.3rem',



                                                                }}
                                                            >


                                                                <span style={{
                                                                    background:
                                                                        darkModeReducer ?

                                                                            'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                            :
                                                                            'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                                }}>
                                                                    {///feeds[verticalActiveIndex].favCount
                                                                    }


                                                                    <FollowPanel
                                                                        setShowEmotions={false}
                                                                        setfollowType={0}
                                                                        type={1}
                                                                        typex={false}
                                                                        userProfile={feeds[index].sender}
                                                                        loggedUser={loggedUser}
                                                                        connected={connected}
                                                                        setConnected={setconnected}

                                                                        counts={30}
                                                                        followersReducer={0}
                                                                        followingReducer={0}
                                                                        refresh={() => { }}
                                                                        onFollowersClick={() => console.log("open followers list")}
                                                                        onFollowToggle={(next) => console.log("follow ->", next)}
                                                                    />
                                                                </span>
                                                            </Typography>

                                                            {captionExpanded && (
                                                                <Box
                                                                    onClick={(e) => { e.stopPropagation(); setActiveCap(false); setHideT(false); }}
                                                                    sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
                                                                />
                                                            )}
                                                            <Typography
                                                                data-feeds-caption-scroll={index === verticalActiveIndex ? 'active' : undefined}
                                                                data-ai-scroll={index === verticalActiveIndex && captionExpanded ? `${fullscreenAreaId}:caption` : undefined}
                                                                data-ai-action={index === verticalActiveIndex && !captionExpanded && !hidePlayingCaption ? `${fullscreenAreaId}.expand_caption` : undefined}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (captionExpanded || hidePlayingCaption) return;
                                                                    if (type === 3) setHideT(true);
                                                                    setActiveCap(true);
                                                                }}
                                                                variant="body2"
                                                                sx={captionExpanded ? {
                                                                    position: 'fixed',
                                                                    bottom: 0,
                                                                    left: 0,
                                                                    width: '100%',
                                                                    height: '70vh',
                                                                    bgcolor: 'rgba(0, 0, 0, 0.75)',
                                                                    backdropFilter: 'blur(20px)',
                                                                    zIndex: 99999,
                                                                    padding: matchMobile ? '60px 5vw 4vh' : '60px 3vw 4vh',
                                                                    borderTopLeftRadius: '24px',
                                                                    borderTopRightRadius: '24px',
                                                                    color: '#fff',
                                                                    fontWeight: 'bold',
                                                                    fontSize: matchMobile ? '1.1rem' : '1.4rem',
                                                                    lineHeight: 1.6,
                                                                    overflowY: 'auto',
                                                                    whiteSpace: 'normal',
                                                                    wordBreak: 'break-word',
                                                                    display: 'block',
                                                                    boxSizing: 'border-box',
                                                                    boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
                                                                    transition: 'all 0.3s ease-in-out',
                                                                    "&::-webkit-scrollbar": { width: "8px" },
                                                                    "&::-webkit-scrollbar-track": { background: "rgb(255,255,255,0)" },
                                                                    "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.3)", borderRadius: "4px" },
                                                                } : {
                                                                    fontSize: matchMobile ? '0.95rem' : '1.3rem',
                                                                    whiteSpace: item.mode === 2 ? 'nowrap' : 'normal',
                                                                    wordBreak: item.mode === 2 ? 'normal' : 'break-word',
                                                                    maxHeight: item.mode === 2 ? '1.6em' : '7vh',
                                                                    display: 'block',
                                                                    overflow: item.mode === 2 ? 'hidden' : undefined,
                                                                    overflowY: item.mode === 2 ? 'hidden' : 'auto',
                                                                    textOverflow: item.mode === 2 ? 'ellipsis' : 'clip',
                                                                    transition: 'all 0.3s ease-in-out',
                                                                    "&::-webkit-scrollbar": { width: "8px" },
                                                                    "&::-webkit-scrollbar-track": { background: "rgb(255,255,255,0)" },
                                                                    "&::-webkit-scrollbar-thumb": { background: "rgb(255,255,255,0)", borderRadius: "4px" },
                                                                }}
                                                            >
                                                                    {captionExpanded && (
                                                                        <IconButton
                                                                            data-ai-action={index === verticalActiveIndex ? `${fullscreenAreaId}.collapse_caption` : undefined}
                                                                            onClick={(e) => { e.stopPropagation(); setActiveCap(false); setHideT(false); }}
                                                                            sx={{ position: 'absolute', top: 12, right: 12, color: 'white', zIndex: 100000 }}
                                                                        >
                                                                            <CloseIcon />
                                                                        </IconButton>
                                                                    )}
                                                                    <span
                                                                        data-ai-action={index === verticalActiveIndex && captionExpanded ? `${fullscreenAreaId}.creator_profile` : undefined}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                                        }}
                                                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                    >
                                                                        {`@${feeds[index].username}`}
                                                                    </span>
                                                                    <span style={{ visibility: 'hidden' }}>
                                                                        ......
                                                                    </span>

                                                                    <span style={{
                                                                        display: hidePlayingCaption ? 'none' : 'inline',
                                                                    }}>
                                                                        {` ${feeds[index].caption}`}
                                                                    </span>
                                                            </Typography>
                                                        </Box>


                                                        {/* 12%: Profile Pic */}
                                                        <Box
                                                            sx={{
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                display: "none",
                                                                bottom: matchMobile ? '40px' : '45px',
                                                                position: 'absolute',
                                                                width: 'auto',
                                                                right: matchMobile ? '2vw' : 'calc(50% - 230px)',
                                                                height: '0px',
                                                                zIndex: 1000,
                                                            }}
                                                        >
                                                            {/* Wrapper to position the heart on top of the image */}
                                                            <Box sx={{ position: 'relative', display: 'inline-block' }}>
                                                                <img
                                                                    onClick={() => {
                                                                        setZoom1x(true);
                                                                        setTimeout(() => setZoom1x(false), 300);
                                                                        GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                                    }}
                                                                    src={loggedUser ? `${feeds[index].profile_image}` : ""}
                                                                    alt={loggedUser ? `Goto ${feeds[index].username}'s profile` : ""}
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
                                                                            ? '0 0 10px rgba(255, 255, 255, 0.5)'
                                                                            : '0 0 10px rgba(0, 0, 0, 0.5)',
                                                                    }}
                                                                />

                                                                {/* Heart overlay */}
                                                                <Box
                                                                    className={`toggle-image ${ZoomHeartx ? "bounce" : ""}`}
                                                                    onMouseEnter={() => setZoomHeartx(true)}
                                                                    onMouseOver={() => setZoomHeartx(true)}
                                                                    onMouseLeave={() => setZoomHeartx(false)}
                                                                    onTouchStart={() => setZoomHeartx(true)}
                                                                    onTouchEnd={() => setZoomHeartx(false)}
                                                                    onClick={() => {


                                                                        addLike(feeds[index].id, loggedUser ? loggedUser.id : 0);
                                                                        // bounce the heart like your other controls
                                                                        setZoomHeartx(true);
                                                                        setTimeout(() => setZoomHeartx(false), 300);

                                                                        const next = !liked;
                                                                        setLiked(next);
                                                                        if (next) {
                                                                            setAnim(true);
                                                                            setTimeout(() => setAnim(false), 950); // total of both anims
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        position: 'absolute',
                                                                        bottom: matchMobile ? '95px' : '105px',
                                                                        left: '50%',
                                                                        transform: 'translateX(-50%)',
                                                                        width: matchMobile ? '45px' : '55px',
                                                                        height: matchMobile ? '45px' : '55px',
                                                                        borderRadius: '50%',
                                                                        display: ActiveCap ? 'none' : 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        zIndex: 2,
                                                                        bgcolor: darkModeReducer ? "rgba(0,0,0,0.35)" : "rgb(250,250,250,0.3)",
                                                                        backdropFilter: "blur(1px)",
                                                                        "&:hover": {
                                                                            bgcolor: darkModeReducer ? "rgba(100,100,100,0.3)" : "rgba(250,250,250,0.3)",
                                                                        },
                                                                        boxShadow: darkModeReducer
                                                                            ? '0 0 6px rgba(255,255,255,0.6)'
                                                                            : '0 0 6px rgba(0,0,0,0.4)',
                                                                        // run pop-in then shake when anim is true (i.e., on like)
                                                                        animation: anim
                                                                            ? `${popIn} 600ms ease-out, ${shake} 2000ms cubic-bezier(.34,1.56,.64,1) 600ms`
                                                                            : 'none',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    {/* Heart icon with per-item bounce */}
                                                                    {likedArray[index]?.liked ? (
                                                                        <Favorite
                                                                            sx={{ fontSize: matchMobile ? 26 : 30, color: appColor }}
                                                                        />
                                                                    ) : (
                                                                        <Favorite

                                                                            sx={{ fontSize: 30, opacity: 0.6 }}
                                                                        />
                                                                        // If you prefer an outline when not liked, swap the line above for:
                                                                        // <FavoriteBorder className={`toggle-image ${ZoomHeartx ? "bounce" : ""}`} sx={{ fontSize: 30 }} />
                                                                    )}

                                                                    {/* Likes count panel — its own zoom state & handlers */}
                                                                    <Box
                                                                        onMouseEnter={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                                                                        onMouseOver={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                                                                        onMouseLeave={(e) => { e.stopPropagation(); setZoomCountx(false); setZoomHeartx(false) }}
                                                                        onTouchStart={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                                                                        onTouchEnd={(e) => { e.stopPropagation(); setZoomCountx(false); setZoomHeartx(false) }}
                                                                        onClick={(e) => {
                                                                            // bounce count without toggling like
                                                                            e.stopPropagation();
                                                                            const feedtypeforhorizontal = type;
                                                                            const feedLastIdx = feeds[index] ? feeds[index].id : 0;
                                                                            //alert(feedLastIdx);


                                                                            OpenLikes(
                                                                                feeds[index].id,
                                                                                searchData,
                                                                                MyPageId,
                                                                                feedLastIdx,
                                                                                feedtypeforhorizontal
                                                                            );


                                                                            setZoomCountx(true);
                                                                            setTimeout(() => setZoomCountx(false), 300);
                                                                        }}
                                                                        sx={{
                                                                            position: 'absolute',
                                                                            bottom: 'calc(-8px + 0.7vh)',
                                                                            left: '50%',
                                                                            transform: 'translateX(-50%)',
                                                                            zIndex: 3,
                                                                            minWidth: 28,
                                                                            textAlign: 'center',
                                                                            // allow its own hover/touch events
                                                                            pointerEvents: 'auto',
                                                                            // (optional) GotoProfile  subtle bg for readability; comment out if you don't want it
                                                                            // bgcolor: 'rgba(0,0,0,0.55)',
                                                                        }}
                                                                    >
                                                                        <span
                                                                            className={`toggle-image ${ZoomCountx ? "bounce2" : ""}`}
                                                                            style={{
                                                                                fontSize: matchMobile ? 9.5 : 10.5,
                                                                                fontWeight: 900,
                                                                                color: '#fff',
                                                                                textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)',
                                                                                lineHeight: 1,
                                                                                display: 'inline-block',
                                                                            }}
                                                                        >
                                                                            {
                                                                                (!likeCountArray[index]?.count || likeCountArray[index]?.count <= 1) ? '' :
                                                                                    likeCountArray[index]?.count}
                                                                        </span>
                                                                    </Box>
                                                                </Box>


                                                            </Box>
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
                                            height: fullscreenPanelHeight,
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
                                                        closeViewer();
                                                    }
                                                } else {
                                                    closeViewer();
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
                                                display: matchMobile ? 'none' : 'none',

                                                width: matchMobile ? '100vw' : isMenuOpen ? "80vw" : '100vw',
                                                height: fullscreenPanelHeight, // use the stable fullscreen height so snap points stay aligned
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



                                        {index === verticalActiveIndex ?

                                            <Box

                                                onMouseEnter={() => setZoom3x(true)}
                                                onMouseOver={() => setZoom3x(true)}
                                                onMouseLeave={() => setZoom3x(false)}

                                                onTouchStart={() => setZoom3x(true)}
                                                onTouchEnd={() => setZoom3x(false)}

                                                onClick={() => {

                                                    setZoom3x(true);
                                                    setTimeout(() => setZoom3x(false), 300);


                                                    if (MuteReducer) {

                                                        dispatch(deactivateFullscreenMute());
                                                    } else {

                                                        dispatch(activateFullscreenMute());
                                                    }

                                                }}

                                                sx={{
                                                    height: "0vh",
                                                        position: "absolute",
                                                        display: "none",
                                                        bottom: matchMobile ? "245px" : "255px",
                                                        right: matchMobile ? "2vw" : "calc(50% - 230px)",
                                                        width: "auto",
                                                        alignItems: "center",
                                                        zIndex: 1000,
                                                    }}
                                            >
                                                {/* unified icon + label  video button */}
                                                <Box
                                                    className={`toggle-image ${Zoom3x ? "bounce" : ""}`}
                                                    onClick={() => {
                                                    }}
                                                    sx={{
                                                        opacity: 0.85,
                                                        alignItems: "center",
                                                        gap: 0,          // keep icon centred when collapsed start delete
                                                        width: 55,  // pill width → circle width
                                                        height: 55,
                                                        px: 0,         // same padding you used on the label
                                                        py: 0.4,
                                                        borderRadius: "50%",
                                                        bgcolor: darkModeReducer
                                                            ? "rgba(0,0,0,0.35)"
                                                            : "rgb(250,250,250,0.3)",
                                                        backdropFilter: "blur(1px)",
                                                        boxShadow: 3,

                                                        display: hideVidCap[verticalActiveIndex] ? "none" : MuteReducer ? "inline-flex" :
                                                            hidevol ? 'none' : 'inline-flex',


                                                        cursor: "pointer",
                                                        "&:hover": {
                                                            bgcolor: darkModeReducer
                                                                ? "rgba(100,100,100,0.3)"
                                                                : "rgba(250,250,250,0.3)",
                                                        },

                                                        visibility: 'visible',
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
                                            : null}


                                        {

                                            index === verticalActiveIndex ?

                                                <Box

                                                    onMouseEnter={() => setZoom2x(true)}
                                                    onMouseOver={() => setZoom2x(true)}
                                                    onMouseLeave={() => setZoom2x(false)}

                                                    onTouchStart={() => setZoom2x(true)}
                                                    onTouchEnd={() => setZoom2x(false)}

                                                    onClick={() => {


                                                    }}
                                                    sx={{
                                                        position: "absolute",
                                                        display: "none",
                                                        bottom: matchMobile ? "180px" : "190px",
                                                        right: matchMobile ? "2vw" : "calc(50% - 230px)",
                                                        width: "auto",
                                                        alignItems: "center",
                                                        zIndex: 1000,
                                                    }}
                                                >
                                                    {/* unified icon + label button */}
                                                    <Box
                                                        className={`toggle-image ${Zoom2x ? "bounce" : ""}`}
                                                        onClick={() => {
                                                            setDeleted(false);
                                                            setShowDel(2);


                                                        }}
                                                        sx={{
                                                            opacity: 0.85,
                                                            alignItems: "center",
                                                            gap: 0,          // keep icon centred when collapsed
                                                            width: 55,  // pill width → circle width video
                                                            height: 55,
                                                            px: 0,         // same padding you used on the label
                                                            py: 0.4,
                                                            borderRadius: "50%",
                                                            bgcolor: darkModeReducer
                                                                ? "rgba(0,0,0,0.35)"
                                                                : "rgb(250,250,250,0.3)",
                                                            backdropFilter: "blur(1px)",
                                                            boxShadow: 3,

                                                            display: hideVidCap[verticalActiveIndex] ? "none" : "inline-flex",

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
                                                        {item.mode === 2 && !playvid ? <AdjustIcon
                                                            sx={{
                                                                fontSize: matchMobile ? "1.8rem" : "1.7rem",
                                                                color: darkModeReducer ? "#fff" : "#000",
                                                                textAlign: 'center',
                                                                margin: 'auto',
                                                            }}
                                                        /> : <MoreVertIcon
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

                                                : null}


                                        {showDel === 1 && index === verticalActiveIndex ? <Box
                                            sx={{
                                                position: "absolute",
                                                inset: 0,
                                                width: "100%",
                                                height: fullscreenPanelHeight,
                                                bgcolor: "rgba(0,0,0,0.15)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                zIndex: 1300,
                                            }}
                                        // onClick={onCancel}
                                        >
                                            {/* Prevent inner clicks from closing */}
                                            <Box
                                                onClick={(e) => e.stopPropagation()}
                                                sx={{
                                                    width: 280,
                                                    bgcolor: "#f9f9f9",
                                                    color: Deleted ? 'blue' : '#000000',
                                                    borderRadius: 4,
                                                    p: 3,
                                                    boxShadow: 24,
                                                    textAlign: "center",
                                                    fontFamily: "-apple-system, BlinkMacSystemFont, \"San Francisco\", \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
                                                }}
                                            >
                                                <Typography variant="h6" gutterBottom>
                                                    {Deleted ? '  Deleted' : '  Delete this item?'}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                                                    {Deleted ? '' : 'This action can’t be undone.'}
                                                </Typography>

                                                <Stack direction="row" spacing={2} justifyContent="center">

                                                    {Deleted ?
                                                        <Button
                                                            data-ai-action={`${fullscreenAreaId}.close_deleted`}
                                                            variant="outlined"
                                                            color="inherit"
                                                            size="large"
                                                            fullWidth
                                                            sx={{ borderRadius: 3, textTransform: "none", fontSize: "1rem" }}
                                                            onClick={() => {

                                                                setShowDel(0);

                                                            }}
                                                        >
                                                            Close
                                                        </Button> :

                                                        <>
                                                            <Button
                                                                variant="contained"
                                                                color="error"
                                                                size="large"
                                                                fullWidth
                                                                sx={{ borderRadius: 3, textTransform: "none", fontSize: "1rem" }}
                                                                disabled={LoadingDatabase2}
                                                                onClick={() => void startDeleteDB(feeds[index].id)}

                                                            >
                                                                {deleteRetry ? 'Try again' : 'Yes'}
                                                            </Button>
                                                            <Button
                                                                data-ai-action={`${fullscreenAreaId}.cancel_delete`}
                                                                variant="outlined"
                                                                color="inherit"
                                                                size="large"
                                                                fullWidth
                                                                sx={{ borderRadius: 3, textTransform: "none", fontSize: "1rem" }}
                                                                onClick={() => {

                                                                    setShowDel(2);

                                                                }}
                                                            >
                                                                No
                                                            </Button>
                                                        </>
                                                    }
                                                </Stack>
                                            </Box>
                                        </Box> : null}




                                        {
                                            showDel === 2 && index === verticalActiveIndex ?
                                                <Plan
                                                    ty={1}
                                                    isMenuOpen={isMenuOpen}
                                                    feeds={feeds}
                                                    verticalActiveIndex={verticalActiveIndex}
                                                    setZoom2x={setZoom2x}
                                                    setShowDel={setShowDel} />
                                                : null
                                        }



                                        <Box
                                            onClick={(e: any) => {
                                                /// e.stopPropagation();
                                                //  setplayvid(true);
                                                const video = videoRefs.current[index];



                                                if (video) {
                                                    video.play();

                                                }
                                                /// alert('kk');
                                                setplayvid(true);
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
                                                display: !playvid ? 'block' : 'none',
                                                // Use drop-shadow for an SVG icon
                                                filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.15))',
                                            }}
                                        >
                                            {audioPlayingx[verticalActiveIndex] ? <AudiotrackIcon fontSize="inherit" /> : <PlayArrowIcon fontSize="inherit" />}
                                        </Box>

                                        <img
                                            ref={verticalActiveIndex === index ? imgRef : null}
                                            src={item.item1}
                                            alt={item.caption}
                                            loading={Math.abs(index - verticalActiveIndex) <= 1 ? 'eager' : 'lazy'}
                                            decoding="async"

                                            onClick={() => {
                                                setactivetext(!activetext);
                                            }}
                                            style={{

                                                cursor: "pointer",
                                                position: "absolute",   // Position absolutely
                                                top: "50%",             // Position top center
                                                left: "50%",            // Position left center
                                                transform: "translate(-50%, -50%)", // Offset the element by half of its own dimensions
                                                width: matchMobile ? "100%" : item.ratio === 3 ? "100%" : 'auto',
                                                height: "100%",
                                                objectFit: "contain",
                                                zIndex: 1,
                                                pointerEvents: playvid && item.xv1 ? 'none' : 'auto',
                                            }}
                                        />

                                        {verticalActiveIndex === index && type !== 3 && normalVideoSource ?
                                            <VideoPlayer
                                                snapshotObscured={showDel !== 0 || showEmotions || chatOpen}
                                                playbackSuspended={chatOpen}
                                                loop={false}
                                                onEnded={() => {
                                                    if (chatOpenRef.current || store.getState().settings.autoControlEnabled || index !== activePlaybackPost.current.index || Number(item.id) !== activePlaybackPost.current.id) return;
                                                    if (index < feeds.length - 1) {
                                                        const nextEl = fullscreenRefsX.current[index + 1];
                                                        if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }}
                                                singleMode={true}
                                                // --- Identity ---
                                                index={index}
                                                src={normalVideoSource}
                                                onPlaybackChange={(playing) => reportVideoPlayback(item.id, normalVideoSource, playing)}
                                                isActive={index === verticalActiveIndex}

                                                // --- State Passing ---
                                                isUIHidden={!!hideVidCap[verticalActiveIndex]}
                                                setUIHidden={(val) => setCapFlag(index, val)}

                                                // --- Ref Handling ---
                                                onRefAssign={(el) => (videoRefs.current[index] = el)}

                                                // --- Styling Logic ---
                                                matchMobile={matchMobile}
                                                isNineTwelve={isNineTwelve}
                                                isMenuOpen={isMenuOpen}
                                                item={item}
                                                playvid={playvid} // This handles the display: block/none logic internally

                                                // --- Audio & Theme ---
                                                muted={MuteReducer}
                                                darkMode={darkModeReducer}
                                                mobileViewportHeight={fullscreenPanelHeight}
                                            />
                                            : null}



                                        {!activetext && (
                                            <Box
                                                ///onClick={() => { /* your onClick logic here */ }}
                                                sx={{
                                                    position: 'absolute',

                                                    bottom: matchMobile ? item.ratio === 1 ?

                                                        item.model === 'Gpt Image' ? height / 15 :
                                                            height / 200 :

                                                        height / 20

                                                        :

                                                        item.ratio === 3 ?
                                                            item.model === 'Gpt Image' ? height / 100 :
                                                                isMenuOpen ? height / 20 : height / 30 :
                                                            height / 100,


                                                    width: matchMobile ? '100%' :
                                                        item.ratio === 1 ? '56.25dvh' :
                                                        item.ratio === 2 ? '100%' :
                                                        item.ratio === 3 ?
                                                            item.model === 'Gpt Image' ?
                                                                isMenuOpen ? width / 1.1 : width / 1.5 :
                                                                isMenuOpen ? width / 1.02 : width / 1.2 :
                                                            width,



                                                    left: matchMobile ? '0px' : '50%',
                                                    transform: matchMobile ? 'none' : 'translateX(-50%)',





                                                    boxSizing: 'border-box',
                                                    display: verticalActiveIndex === index ?
                                                        hideVidCap[verticalActiveIndex] ? 'none' : 'flex' : 'none',
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
                                                        textShadow: '0px 1px 3px rgba(0,0,0,0.9), 0px 0px 6px rgba(0,0,0,0.7)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',


                                                    }}
                                                >


                                                    <Typography

                                                        onClick={() => {


                                                            ///GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                        }}
                                                        variant="subtitle2"
                                                        sx={{
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            mb: 1,
                                                            fontSize: matchMobile ? '0.95rem' : '1.3rem',


                                                        }}
                                                    >
                                                        <span style={{
                                                            background:
                                                                darkModeReducer ?

                                                                    'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                    :
                                                                    'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                        }}>
                                                            <FollowPanel
                                                                setShowEmotions={false}
                                                                setfollowType={0}

                                                                typex={false}
                                                                type={1}
                                                                userProfile={feeds[index].sender}
                                                                loggedUser={loggedUser}
                                                                connected={connected}
                                                                setConnected={setconnected}

                                                                counts={30}
                                                                followersReducer={0}
                                                                followingReducer={0}
                                                                refresh={() => { }}
                                                                onFollowersClick={() => console.log("open followers list")}
                                                                onFollowToggle={(next) => console.log("follow ->", next)}
                                                            />   </span>
                                                    </Typography>

                                                    {captionExpanded && (
                                                        <Box
                                                            onClick={(e) => { e.stopPropagation(); setActiveCap(false); setHideT(false); }}
                                                            sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
                                                        />
                                                    )}
                                                    <Typography
                                                        data-feeds-caption-scroll={index === verticalActiveIndex ? 'active' : undefined}
                                                        data-ai-scroll={index === verticalActiveIndex && captionExpanded ? `${fullscreenAreaId}:caption` : undefined}
                                                        data-ai-action={index === verticalActiveIndex && !captionExpanded && !hidePlayingCaption ? `${fullscreenAreaId}.expand_caption` : undefined}
                                                        variant="body2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (captionExpanded || hidePlayingCaption) return;
                                                            if (type === 3) setHideT(true);
                                                            setActiveCap(true);
                                                        }}
                                                        sx={captionExpanded ? {
                                                            position: 'fixed',
                                                            bottom: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '70vh',
                                                            bgcolor: 'rgba(0, 0, 0, 0.75)',
                                                            backdropFilter: 'blur(20px)',
                                                            zIndex: 99999,
                                                            padding: matchMobile ? '60px 5vw 4vh' : '60px 3vw 4vh',
                                                            borderTopLeftRadius: '24px',
                                                            borderTopRightRadius: '24px',
                                                            color: '#fff',
                                                            fontWeight: 'bold',
                                                            fontSize: matchMobile ? '1.1rem' : '1.4rem',
                                                            lineHeight: 1.6,
                                                            overflowY: 'auto',
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            display: 'block',
                                                            boxSizing: 'border-box',
                                                            boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
                                                            transition: 'all 0.3s ease-in-out',
                                                            "&::-webkit-scrollbar": { width: "8px" },
                                                            "&::-webkit-scrollbar-track": { background: "rgb(255,255,255,0)" },
                                                            "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.3)", borderRadius: "4px" },
                                                        } : {
                                                            fontSize: matchMobile ? '0.95rem' : '1.3rem',
                                                            whiteSpace: item.mode === 2 ? 'nowrap' : 'normal',
                                                            wordBreak: item.mode === 2 ? 'normal' : 'break-word',
                                                            maxHeight: item.mode === 2 ? '1.6em' : '7vh',
                                                            display: 'block',
                                                            overflow: item.mode === 2 ? 'hidden' : undefined,
                                                            overflowY: item.mode === 2 ? 'hidden' : 'auto',
                                                            textOverflow: item.mode === 2 ? 'ellipsis' : 'clip',
                                                            transition: 'all 0.3s ease-in-out',
                                                            "&::-webkit-scrollbar": { width: "8px" },
                                                            "&::-webkit-scrollbar-track": { background: "rgb(255,255,255,0)" },
                                                            "&::-webkit-scrollbar-thumb": { background: "rgb(255,255,255,0)", borderRadius: "4px" },
                                                        }}
                                                    >


                                                        <span style={{
                                                            background:
                                                                darkModeReducer ?

                                                                    'linear-gradient(to bottom, rgba(70, 70, 70, 0) 0%, rgba(70, 70, 70, 0.7) 50%, rgba(70, 70, 70, 0) 100%)'
                                                                    :
                                                                    'linear-gradient(to bottom, rgba(90, 90, 100, 0) 0%, rgba(90, 90, 100, 0.7) 50%, rgba(90, 90, 100, 0) 100%)',
                                                        }}>

                                                            {captionExpanded && (
                                                                <IconButton
                                                                    data-ai-action={index === verticalActiveIndex ? `${fullscreenAreaId}.collapse_caption` : undefined}
                                                                    onClick={(e) => { e.stopPropagation(); setActiveCap(false); setHideT(false); }}
                                                                    sx={{ position: 'absolute', top: 12, right: 12, color: 'white', zIndex: 100000 }}
                                                                >
                                                                    <CloseIcon />
                                                                </IconButton>
                                                            )}
                                                            <span
                                                                data-ai-action={index === verticalActiveIndex && captionExpanded ? `${fullscreenAreaId}.creator_profile` : undefined}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                                                                }}
                                                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                            >
                                                                {`@${feeds[index].username}`}
                                                            </span>
                                                            <span style={{ visibility: 'hidden' }}>
                                                                ......
                                                            </span>

                                                            <span style={{ display: hidePlayingCaption ? 'none' : 'inline' }}>
                                                                {` ${feeds[index].caption}`}
                                                            </span>


                                                        </span>
                                                    </Typography>
                                                </Box>

                                                {/* 12%: Profile Pic */}
                                                <Box
                                                    sx={{

                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        display: "none",
                                                        bottom: matchMobile ? '40px' : '45px',
                                                        position: 'absolute',
                                                        width: 'auto',
                                                        right: matchMobile ? '2vw' : 'calc(50% - 230px)',
                                                        height: '0px',
                                                        zIndex: 1000,
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

                                                    {/* Heart overlay */}
                                                    <Box
                                                        className={`toggle-image ${ZoomHeartx ? "bounce" : ""}`}
                                                        onMouseEnter={() => setZoomHeartx(true)}
                                                        onMouseOver={() => setZoomHeartx(true)}
                                                        onMouseLeave={() => setZoomHeartx(false)}
                                                        onTouchStart={() => setZoomHeartx(true)}
                                                        onTouchEnd={() => setZoomHeartx(false)}
                                                        onClick={() => {


                                                            addLike(feeds[index].id, loggedUser ? loggedUser.id : 0);
                                                            // bounce the heart like your other controls
                                                            setZoomHeartx(true);
                                                            setTimeout(() => setZoomHeartx(false), 300);

                                                            const next = !liked;
                                                            setLiked(next);
                                                            if (next) {
                                                                setAnim(true);
                                                                setTimeout(() => setAnim(false), 950); // total of both anims
                                                            }
                                                        }}
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: matchMobile ? '95px' : '105px',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            width: matchMobile ? '45px' : '55px',
                                                            height: matchMobile ? '45px' : '55px',
                                                            borderRadius: '50%',
                                                            display: ActiveCap ? 'none' : 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            zIndex: 2,
                                                            bgcolor: darkModeReducer ? "rgba(0,0,0,0.35)" : "rgb(250,250,250,0.3)",
                                                            backdropFilter: "blur(1px)",
                                                            "&:hover": {
                                                                bgcolor: darkModeReducer ? "rgba(100,100,100,0.3)" : "rgba(250,250,250,0.3)",
                                                            },
                                                            boxShadow: darkModeReducer
                                                                ? '0 0 6px rgba(255,255,255,0.6)'
                                                                : '0 0 6px rgba(0,0,0,0.4)',
                                                            animation: anim
                                                                ? `${popIn} 600ms ease-out, ${shake} 2000ms cubic-bezier(.34,1.56,.64,1) 600ms`
                                                                : 'none',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        {/* Heart icon with per-item bounce */}
                                                        {likedArray[index]?.liked ? (
                                                            <Favorite
                                                                sx={{ fontSize: matchMobile ? 26 : 30, color: appColor }}
                                                            />
                                                        ) : (
                                                            <Favorite

                                                                sx={{ fontSize: 30, opacity: 0.6 }}
                                                            />
                                                            // If you prefer an outline when not liked, swap the line above for:
                                                            // <FavoriteBorder className={`toggle-image ${ZoomHeartx ? "bounce" : ""}`} sx={{ fontSize: 30 }} />
                                                        )}

                                                        {/* Likes count panel — its own zoom state & handlers */}
                                                        <Box
                                                            onMouseEnter={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                                                            onMouseOver={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                                                            onMouseLeave={(e) => { e.stopPropagation(); setZoomCountx(false); setZoomHeartx(false) }}
                                                            onTouchStart={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                                                            onTouchEnd={(e) => { e.stopPropagation(); setZoomCountx(false); setZoomHeartx(false) }}
                                                            onClick={(e) => {
                                                                // bounce count without toggling like
                                                                e.stopPropagation();
                                                                const feedtypeforhorizontal = type;
                                                                const feedLastIdx = feeds[index] ? feeds[index].id : 0;
                                                                //alert(feedLastIdx);


                                                                OpenLikes(
                                                                    feeds[index].id,
                                                                    searchData,
                                                                    MyPageId,
                                                                    feedLastIdx,
                                                                    feedtypeforhorizontal
                                                                );


                                                                setZoomCountx(true);
                                                                setTimeout(() => setZoomCountx(false), 300);
                                                            }}
                                                            sx={{
                                                                position: 'absolute',
                                                                bottom: 'calc(-8px + 0.7vh)',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                                zIndex: 3,
                                                                minWidth: 28,
                                                                textAlign: 'center',
                                                                // allow its own hover/touch events
                                                                pointerEvents: 'auto',
                                                                // (optional) GotoProfile  subtle bg for readability; comment out if you don't want it
                                                                // bgcolor: 'rgba(0,0,0,0.55)',
                                                            }}
                                                        >
                                                            <span
                                                                className={`toggle-image ${ZoomCountx ? "bounce2" : ""}`}
                                                                style={{
                                                                    fontSize: matchMobile ? 9.5 : 10.5,
                                                                    fontWeight: 900,
                                                                    color: '#fff',
                                                                    textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)',
                                                                    lineHeight: 1,
                                                                    display: 'inline-block',
                                                                }}
                                                            >
                                                                {
                                                                    (!likeCountArray[index]?.count || likeCountArray[index]?.count <= 1) ? '' :
                                                                        likeCountArray[index]?.count
                                                                }
                                                            </span>
                                                        </Box>
                                                    </Box>
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
{/* UNIFIED SIDEBAR (Replaces scattered icons) */}
<Box
    data-fullscreen-actions="true"
    sx={{
        position: 'absolute',
        right: matchMobile ? '2vw' : actionRail?.index === index ? actionRail.right : (item.ratio === 3 ? '2vw' : item.ratio === 2 ? 'calc(50% - 50dvh - 65px)' : 'calc(50% - 28.125dvh - 65px)'),
        bottom: matchMobile ? '20%' : 'auto',
        top: matchMobile ? 'auto' : '50%',
        transform: matchMobile ? 'none' : 'translateY(-50%)',
        display: ActiveCap || HideT || activetext || activeStory ? 'none' : 'flex',
        flexDirection: 'column',
        gap: matchMobile ? 2.5 : 3,
        alignItems: 'center',
        zIndex: 1000,
        pointerEvents: 'none', // let clicks pass through the gap
        '& > *': { pointerEvents: 'auto' } // enable clicks on the buttons
    }}
>

    {index === verticalActiveIndex && !showEmotions && showDel === 0 && !isOpen && (
        <IconButton
            aria-label="Post chat"
            title={postHasChat ? 'Post chat · Has messages' : 'Post chat'}
            data-ai-action={`${fullscreenAreaId}.open_post_chat`}
            onClick={(event) => { event.stopPropagation(); openSocialChat(Number(item.id)); }}
            sx={{
                width: matchMobile ? 45 : 55, height: matchMobile ? 45 : 55,
                color: darkModeReducer ? '#fff' : '#000',
                bgcolor: darkModeReducer ? 'rgba(0,0,0,.35)' : 'rgba(250,250,250,.3)',
                backdropFilter: 'blur(1px)', boxShadow: 3,
                '&:hover': { bgcolor: darkModeReducer ? 'rgba(100,100,100,.3)' : 'rgba(250,250,250,.6)' },
            }}
        >
            <ChatBubbleOutlineIcon />
            {postHasChat && <Box component="span" aria-hidden="true" data-post-chat-indicator="true" sx={{
                position: 'absolute', top: '25%', right: '22%', width: 7, height: 7,
                borderRadius: '50%', bgcolor: appColor, boxShadow: `0 0 6px 2px ${appColor}`,
            }} />}
        </IconButton>
    )}

    {/* Volume Button */}
    {hideVidCap[verticalActiveIndex] || (MuteReducer ? false : hidevol) ? null : (
        <Box
            className={`toggle-image ${Zoom3x ? "bounce" : ""}`}
            data-ai-action={index === verticalActiveIndex ? `${fullscreenAreaId}.toggle_mute` : undefined}
            onMouseEnter={() => setZoom3x(true)}
            onMouseOver={() => setZoom3x(true)}
            onMouseLeave={() => setZoom3x(false)}
            onTouchStart={() => setZoom3x(true)}
            onTouchEnd={() => setZoom3x(false)}
            onClick={() => {
                setZoom3x(true);
                setTimeout(() => setZoom3x(false), 300);
                if (MuteReducer) {
                    dispatch(deactivateFullscreenMute());
                } else {
                    dispatch(activateFullscreenMute());
                }
            }}
            sx={{
                opacity: 0.85,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: matchMobile ? 45 : 55,
                height: matchMobile ? 45 : 55,
                borderRadius: "50%",
                transition: "all 250ms ease",
                bgcolor: darkModeReducer ? "rgba(0,0,0,0.35)" : "rgb(250,250,250,0.3)",
                backdropFilter: "blur(1px)",
                boxShadow: 3,
                cursor: "pointer",
                "&:hover": {
                    bgcolor: darkModeReducer ? "rgba(100,100,100,0.3)" : "rgba(250,250,250,0.3)",
                },
                visibility: 'visible',
            }}
        >
            {MuteReducer ? (
                <VolumeOffIcon sx={{ fontSize: matchMobile ? "1.8rem" : "1.7rem", color: darkModeReducer ? "#fff" : "#000" }} />
            ) : (
                <VolumeUpIcon sx={{ fontSize: matchMobile ? "1.8rem" : "1.7rem", color: darkModeReducer ? "#fff" : "#000" }} />
            )}
        </Box>
    )}

    {/* Menu Button */}
    {index === verticalActiveIndex && !hideVidCap[verticalActiveIndex] ? (
        <Box
            className={`toggle-image ${Zoom2x ? "bounce" : ""}`}
            data-ai-action={index === verticalActiveIndex ? `${fullscreenAreaId}.open_plan` : undefined}
            onMouseEnter={() => setZoom2x(true)}
            onMouseOver={() => setZoom2x(true)}
            onMouseLeave={() => setZoom2x(false)}
            onTouchStart={() => setZoom2x(true)}
            onTouchEnd={() => setZoom2x(false)}
            onClick={() => {
                setZoom2x(true);
                setTimeout(() => setZoom2x(false), 300);
                setDeleted(false);
                setShowDel(2);
            }}
            sx={{
                opacity: 0.85,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: matchMobile ? 45 : 55,
                height: matchMobile ? 45 : 55,
                borderRadius: "50%",
                transition: "all 250ms ease",
                bgcolor: darkModeReducer ? "rgba(0,0,0,0.35)" : "rgb(250,250,250,0.3)",
                backdropFilter: "blur(1px)",
                boxShadow: 3,
                cursor: "pointer",
                "&:hover": {
                    bgcolor: darkModeReducer ? "rgba(100,100,100,0.3)" : "rgba(250,250,250,0.3)",
                },
            }}
        >
            {item.mode === 2 && !playvid ? (
                <AdjustIcon sx={{ fontSize: matchMobile ? "1.8rem" : "1.7rem", color: darkModeReducer ? "#fff" : "#000" }} />
            ) : (
                <MoreVertIcon sx={{ fontSize: matchMobile ? "1.8rem" : "1.7rem", color: darkModeReducer ? "#fff" : "#000" }} />
            )}
        </Box>
    ) : null}

    {/* Heart/Like Button */}
    {!ActiveCap ? (
        <Box
            className={`toggle-image ${ZoomHeartx ? "bounce" : ""}`}
            data-ai-action={index === verticalActiveIndex ? `${fullscreenAreaId}.${likedArray[index]?.liked ? 'open_likes' : 'like_post'}` : undefined}
            onMouseEnter={() => setZoomHeartx(true)}
            onMouseOver={() => setZoomHeartx(true)}
            onMouseLeave={() => setZoomHeartx(false)}
            onTouchStart={() => setZoomHeartx(true)}
            onTouchEnd={() => setZoomHeartx(false)}
            onClick={(e) => {
                if (likedArray[index]?.liked) {
                    // Already liked, so open the likes view
                    e.stopPropagation();
                    const feedtypeforhorizontal = type;
                    const feedLastIdx = feeds[index] ? feeds[index].id : 0;
                    OpenLikes(feeds[index].id, searchData, MyPageId, feedLastIdx, feedtypeforhorizontal);
                    setZoomCountx(true);
                    setTimeout(() => setZoomCountx(false), 300);
                } else {
                    // Not liked, send a like
                    addLike(feeds[index].id, loggedUser ? loggedUser.id : 0);
                    setZoomHeartx(true);
                    setTimeout(() => setZoomHeartx(false), 300);
                    const next = !liked;
                    setLiked(next);
                    if (next) {
                        setAnim(true);
                        setTimeout(() => setAnim(false), 950);
                    }
                }
            }}
            sx={{
                position: 'relative',
                width: matchMobile ? '45px' : '55px',
                height: matchMobile ? '45px' : '55px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: darkModeReducer ? "rgba(0,0,0,0.35)" : "rgb(250,250,250,0.3)",
                transition: "all 250ms ease",
                backdropFilter: "blur(1px)",
                "&:hover": {
                    bgcolor: darkModeReducer ? "rgba(100,100,100,0.3)" : "rgba(250,250,250,0.3)",
                },
                boxShadow: darkModeReducer ? '0 0 6px rgba(255,255,255,0.6)' : '0 0 6px rgba(0,0,0,0.4)',
                animation: anim ? `${popIn} 600ms ease-out, ${shake} 2000ms cubic-bezier(.34,1.56,.64,1) 600ms` : 'none',
                cursor: 'pointer',
            }}
        >
            {likedArray[index]?.liked ? (
                <Favorite sx={{ fontSize: matchMobile ? 26 : 30, color: appColor }} />
            ) : (
                <Favorite sx={{ fontSize: 30, opacity: 0.6 }} />
            )}

            {/* Likes count panel */}
            <Box
                data-ai-action={index === verticalActiveIndex && likedArray[index]?.liked ? `${fullscreenAreaId}.open_likes_count` : undefined}
                onMouseEnter={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                onMouseOver={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                onMouseLeave={(e) => { e.stopPropagation(); setZoomCountx(false); setZoomHeartx(false) }}
                onTouchStart={(e) => { e.stopPropagation(); setZoomCountx(true); }}
                onTouchEnd={(e) => { e.stopPropagation(); setZoomCountx(false); setZoomHeartx(false) }}
                onClick={(e) => {
                    e.stopPropagation();
                    const feedtypeforhorizontal = type;
                    const feedLastIdx = feeds[index] ? feeds[index].id : 0;
                    OpenLikes(feeds[index].id, searchData, MyPageId, feedLastIdx, feedtypeforhorizontal);
                    setZoomCountx(true);
                    setTimeout(() => setZoomCountx(false), 300);
                }}
                sx={{
                    display: likedArray[index]?.liked ? 'block' : 'none',
                    position: 'absolute',
                    bottom: 'calc(-8px + 0.7vh)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 3,
                    textAlign: 'center',
                    pointerEvents: 'auto',
                }}
            >
                <span
                    className={`toggle-image ${ZoomCountx ? "bounce2" : ""}`}
                    style={{
                        fontSize: matchMobile ? 9.5 : 10.5,
                        fontWeight: 900,
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)',
                        lineHeight: 1,
                        display: 'inline-block',
                    }}
                >
                    {(!likeCountArray[index]?.count || likeCountArray[index]?.count <= 1) ? '' : likeCountArray[index]?.count}
                </span>
            </Box>
        </Box>
    ) : null}

    {/* Profile Pic */}
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <img
                data-ai-action={index === verticalActiveIndex && !ActiveCap ? `${fullscreenAreaId}.creator_profile` : undefined}
                onClick={() => {
                    setZoom1x(true);
                    setTimeout(() => setZoom1x(false), 300);
                    GotoProfile(feeds[index].sender, verticalActiveIndex - 1);
                }}
                onMouseEnter={() => setZoom1x(true)}
                onMouseOver={() => setZoom1x(true)}
                onMouseLeave={() => setZoom1x(false)}
                onTouchStart={() => setZoom1x(true)}
                onTouchEnd={() => setZoom1x(false)}
                src={loggedUser ? `${feeds[index].profile_image}` : ""}
                alt={loggedUser ? `Goto ${feeds[index].username}'s profile` : ""}
                className={`toggle-image ${Zoom1x ? "bounce" : ""}`}
                style={{
                    cursor: 'pointer',
                    borderRadius: '50%',
                    width: matchMobile ? 45 : 55,
                    height: matchMobile ? 45 : 55,
                    objectFit: 'cover',
                    boxShadow: darkModeReducer ? '0 0 10px rgba(255, 255, 255, 0.5)' : '0 0 10px rgba(0, 0, 0, 0.5)'
                }}
            />
        </Box>

</Box>

                        </Box>
                    );
                })}
            </Box>
        </AnimatePresence >
    );
};

export default FullScreenStories;
