import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location

import { Hotspot } from "./TouchPreviewStageUI";
import type { BranchTuple } from "./TouchInteractionModel";
import TogglePromptButton from './TogglePromptButton';


import InteractInput from "./InteractInput";

import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';

import TouchAppIcon from "@mui/icons-material/TouchApp";

import {
    Box,
    Typography,
    CircularProgress,
    Card,
    CardMedia,
} from "@mui/material";


import { useLocation } from 'react-router-dom';






import { matchMobile, matchPc, matchTablet } from "./DetectDevice";

interface ImagesProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
}



const Clikit: FC<any> = ({
    isMenuOpen,
    callFeeds,
    setcallFeeds,
    AllowPing,
    setAllowPing,
    feedContainerRef,
    LastId,
    setLastId,
    feeds,
    setFeeds,
    setIsFullscreen,
    isFullscreen,



    setFluxLoaded,
    fluxLoaded,
    isSubmittingKick,
    setIsSubmittingKick,

    setIsSubmitting,
    isSubmitting,
    setIsMenuOpen,
    minimisePrompt,
    setminimisePrompt,
    MenuOpenb,
    setMenuOpenb,
    allowUploadText,
    setallowUploadText,
    setHideBottom,
    GeneratedImage,
    setGeneratedImage,
    showEmotions,
    setLikesPostid,
    setLikes,
    setShowEmotions,

    setsearchDataNav,
    setMyPageIdNav,
    setfeedLastIdNav,
    setfeedScrollPosNav,
    handleLoginSuccess,
    handleLoginError,
    showcaseTemplates,
    onShowcaseTemplatesChanged,
    templateLibrary,
    hasMoreTemplates,
    ensureTemplateLibraryLoaded,
    loadMoreTemplates,
    onTemplateLibraryChanged



}) => {



    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const location = useLocation();

    const [stopFeeds, setstopFeeds] = useState(false);

    const [InteractStart, setInteractStart] = useState(false);

    const [mode, setmode] = useState<"touch" | "swipe" | any>('');

    const [stage, setStage] = useState(0);

    const [HideDemo, setHideDemo] = useState(false);


    const [intbg, setintbg] = useState(0);
    const [mainAudioUrl, setMainAudioUrl] = useState<string>("");
    const [sub1AudioUrl, setSub1AudioUrl] = useState<string>("");
    const [sub2AudioUrl, setSub2AudioUrl] = useState<string>("");


    const [mainAudioUrlx, setMainAudioUrlx] = useState<string>("");
    const [sub1AudioUrlx, setSub1AudioUrlx] = useState<string>("");
    const [sub2AudioUrlx, setSub2AudioUrlx] = useState<string>("");

    const [clikt, setclikt] = useState(false);

    const [touchHotspots, setTouchHotspots] = useState<BranchTuple<Hotspot>>([
        { id: "left", x: 0.3, y: 0.6, r: 0.12 },
        { id: "right", x: 0.7, y: 0.6, r: 0.12 },
        { id: "top", x: 0.5, y: 0.28, r: 0.12 },
        { id: "bottom", x: 0.5, y: 0.78, r: 0.12 },
    ]);


    const [IsMobileBackActive, setIsMobileBackActive] = useState(false);


    const { routelastId, upload } = location.state || {};
    // Now these will be `undefined` if no state was passed

    const [minimiseProfile, setminimiseProfile] = useState(false);


    useEffect(() => {
        setcallFeeds(true);
        ///    setminimisePrompt(true)
    }, [location.pathname]);



    useEffect(() => {
        if (upload) {
            setstopFeeds(true);
        } else {
            setstopFeeds(false);
        }
    }, [location.pathname, upload]);





    const LOCAL_KEY_PREFIX = "localstoragevid";  //  localstoragevid1, 2, 3 …
    // Floor only — NOT a cap. The real slot count is discovered from localStorage
    // so A-shots + B-shots (which can exceed 9) are all usable.
    const VIDEO_SLOTS = 9;

    // State is zero-based for React: videoArray[0] is localstoragevid1.
    const [videoArray, setVideoArray] = useState<(string | null)[]>(
        Array(VIDEO_SLOTS).fill(null)
    );




    // Call this to wipe local cache + state used by the effect
    const wipeInteractionState = useCallback(() => {
        // 1) Clear EVERY numbered slot key, not just 0–9 (B-shots push past 9)
        const staleSlotKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && new RegExp(`^${LOCAL_KEY_PREFIX}\\d+$`).test(key)) staleSlotKeys.push(key);
        }
        staleSlotKeys.forEach((key) => localStorage.removeItem(key));
        // 2) Clear the post id key
        localStorage.removeItem("localInteractionpostId");

        // 3) Reset React state
        setVideoArray(Array(VIDEO_SLOTS).fill(null));
        /// setInteractionPostId(null);  //      // assuming this can be null in your state

        setInteractStart(false);
    }, [setVideoArray,]);



    /**
     * Whenever `close` becomes true, reload every slot from localStorage
     * so the UI reflects whatever was saved most recently.
     */
    const [interactionPostId, setInteractionPostId] = useState<string | null>(() =>
        localStorage.getItem("localInteractionpostId")    // initial value on first render
    );

    const isUsableInteractionVideo = useCallback((url: string | null): url is string => (
        typeof url === "string" &&
        url.trim() !== "" &&
        url !== "EMPTY" &&
        url !== "EMPTY_BSHOT" &&
        url !== "ERROR" &&
        url !== "undefined" &&
        url !== "null"
    ), []);

    // Discover the highest populated slot instead of assuming 9. Returns how many
    // sequential positions to read starting at startIndex (never below VIDEO_SLOTS,
    // so empty/short sets keep the original 9-placeholder shape).
    const countInteractionSlots = useCallback((startIndex: number) => {
        let highestIndex = -1;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(LOCAL_KEY_PREFIX)) continue;
            const suffix = key.slice(LOCAL_KEY_PREFIX.length);
            if (!/^\d+$/.test(suffix)) continue;
            const slotIndex = Number(suffix);
            if (slotIndex < startIndex) continue;
            if (!isUsableInteractionVideo(localStorage.getItem(key))) continue;
            if (slotIndex > highestIndex) highestIndex = slotIndex;
        }
        if (highestIndex < startIndex) return VIDEO_SLOTS;
        return Math.max(highestIndex - startIndex + 1, VIDEO_SLOTS);
    }, [isUsableInteractionVideo]);

    const readInteractionSlots = useCallback((startIndex: number) => Array.from(
        { length: countInteractionSlots(startIndex) },
        (_, index) => localStorage.getItem(`${LOCAL_KEY_PREFIX}${index + startIndex}`)
    ), [countInteractionSlots]);

    const getStoredInteractionVideos = useCallback(() => {
        const oneBasedSlots = readInteractionSlots(1);
        if (oneBasedSlots.some(isUsableInteractionVideo)) return oneBasedSlots;
        return readInteractionSlots(0);
    }, [isUsableInteractionVideo, readInteractionSlots]);

    const refreshInteractionState = useCallback(() => {
        setVideoArray(getStoredInteractionVideos());
        setInteractionPostId(localStorage.getItem("localInteractionpostId"));
    }, [getStoredInteractionVideos]);

    // Legacy interaction auto-entry disabled: spatial preview must keep creation open.
//     useEffect(() => {
//         const storedVideos = getStoredInteractionVideos();
//         if (!storedVideos.some(isUsableInteractionVideo)) return;
//
//         setVideoArray(storedVideos);
//         setInteractionPostId(localStorage.getItem("localInteractionpostId"));
//         setminimisePrompt(true);
//     }, [getStoredInteractionVideos, isUsableInteractionVideo, location.pathname, setminimisePrompt]);


    useEffect(() => {
        if (!minimisePrompt) return;
        refreshInteractionState();
    }, [minimisePrompt, location.pathname, refreshInteractionState]);


    // PublishLoader2 emits this only after a validated Hotspots handoff.
    // Spatial preview/publish never emits it, so stale legacy slots cannot pull a
    // Spatial project into InteractInput.
    useEffect(() => {
        const handleHotspotStorageUpdated = (event: Event) => {
            const detail = (event as CustomEvent<{ mode?: string }>).detail;
            if (detail?.mode !== "hotspots") return;
            refreshInteractionState();
            setminimisePrompt(true);
        };

        window.addEventListener("clikb-hotspot-storage-updated", handleHotspotStorageUpdated);
        return () => {
            window.removeEventListener("clikb-hotspot-storage-updated", handleHotspotStorageUpdated);
        };
    }, [refreshInteractionState, setminimisePrompt]);




    useEffect(() => {

        ///alert(videoArray)
        if (minimisePrompt) {


            const hasAnyVideo = videoArray.some(isUsableInteractionVideo);

            setInteractStart(hasAnyVideo);   // true  â†’ ready to interact
            // false â†’ keep it/reset to false
        } else { }
    }, [videoArray, minimisePrompt, location.pathname, isUsableInteractionVideo]);


    return (
        <>


            {HideDemo ? <Box

                onClick={() => {

                    setHideDemo(true);
                }}
                sx={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    cursor: 'pointer',
                    height: "100vh",
                    width: "100%",
                    backgroundColor: "rgba(20,20,20,0.8)",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",        // vertical centering
                    justifyContent: "flex-start", // align to left
                    p: 2,
                    // space from edges
                }}
            >
                <Typography
                    variant="h6"
                    component="div"
                    sx={{
                        color: "#fff", fontWeight: "bold", margin: 'auto',
                        textAlign: 'center'
                    }}
                >
                    🚧 Work in Progress 🚧
                </Typography>
            </Box> : null}





            {/* 1) Prompt Input */}
            <PromptInput

                    stopFeeds={stopFeeds}
                    setstopFeeds={setstopFeeds}
                    GeneratedImage={GeneratedImage}
                    setGeneratedImage={setGeneratedImage}
                    setHideBottom={setHideBottom}
                    IsMobileBackActive={IsMobileBackActive}
                    setIsMobileBackActive={setIsMobileBackActive}
                    clikt={clikt}
                    setclikt={setclikt}

                    setFluxLoaded={setFluxLoaded}
                    fluxLoaded={fluxLoaded}
                    isSubmittingKick={isSubmittingKick}
                    setIsSubmittingKick={setIsSubmittingKick}

                    setIsSubmitting={setIsSubmitting}
                    isSubmitting={isSubmitting}

                    callFeeds={callFeeds}
                    type={3}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}

                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    handleLoginSuccess={handleLoginSuccess}
                    handleLoginError={handleLoginError}
                    showcaseTemplates={showcaseTemplates}
                    onShowcaseTemplatesChanged={onShowcaseTemplatesChanged}
                    templateLibrary={templateLibrary}
                    hasMoreTemplates={hasMoreTemplates}
                    ensureTemplateLibraryLoaded={ensureTemplateLibraryLoaded}
                    loadMoreTemplates={loadMoreTemplates}
                    onTemplateLibraryChanged={onTemplateLibraryChanged}
                />


            {minimisePrompt ? <Box
                sx={{


                    width: matchMobile ? '20%' : "100%",
                    textAlign: "center",

                    left: matchMobile ? "40%" :
                        '-27vw',


                    // Optional: If you want a subtle background to separate it
                    //// backgroundColor: darkModeReducer ? "#121212" : "#ffffff",
                    height: matchMobile ? '5.15vh' : '2vh', // vertical padding
                    zIndex: 1000,
                    fontWeight: 'bold',
                    fontFamily: "Arial, Helvetica, sans-serif",
                    position: 'fixed',
                    top: matchMobile ? "1vh" :
                        '3vh',

                }}
            >


                <IconButton
                    onClick={() => setminimisePrompt(false)}
                    sx={{
                        // make it circular
                        borderRadius: "50%",
                        // size tweaks
                        width: matchMobile ? 43 : 43,
                        height: matchMobile ? 43 : 43,
                        // colours & states
                        bgcolor: darkModeReducer ? 'rgb(100,100,100,1)' : 'rgb(250,250,250,1)',
                        "&:hover": { bgcolor: darkModeReducer ? 'rgb(100,100,100,0.3)' : 'rgb(250,250,250,0.3)' },
                        // keep the same behaviours you already had
                        opacity: 0.7,
                        display: matchMobile && isMenuOpen ? "none" : "none",
                        m: "auto",          // centre horizontally
                        boxShadow: 3,       // soft elevation

                    }}
                >
                    <TouchAppIcon
                        sx={{
                            fontSize: matchMobile ? "1.6rem" : "1.3rem",
                            color: darkModeReducer ? 'white' : "black",
                        }}
                    />
                </IconButton>


            </Box > : null}



            {/* 1) Prompt Input */}

            <div style={{
                position: 'relative',
                zIndex: 1300,
            }}>




                {/* ───────── overlay bar ─────────
                
               
                */}

                <TogglePromptButton
                    LastId={LastId}
                    feedContainerRef={feedContainerRef}
                    isFullscreen={isFullscreen}

                    textActive={false}
                    setMenuOpenb={setMenuOpenb}
                    setIsMenuOpen={setIsMenuOpen}
                    MenuOpenb={MenuOpenb}
                    type={1}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}

                    matchMobile={matchMobile}
                    allowUploadText={false}
                    isMenuOpen={isMenuOpen}
                    darkModeReducer={darkModeReducer}
                />


            </div>


            {
                videoArray.some(isUsableInteractionVideo) && minimisePrompt ?
                    InteractStart && (
                        <InteractInput
                            intbg={intbg}
                            setintbg={setintbg}
                            feedData={[]}
                            mainAudioUrlx={mainAudioUrlx}
                            sub1AudioUrlx={sub1AudioUrlx}
                            sub2AudioUrlx={sub2AudioUrlx}
                            setMainAudioUrlx={setMainAudioUrlx}
                            setSub1AudioUrlx={setSub1AudioUrlx}
                            setSub2AudioUrlx={setSub2AudioUrlx}


                            mainAudioUrl={mainAudioUrl}
                            sub1AudioUrl={sub1AudioUrl}
                            sub2AudioUrl={sub2AudioUrl}

                            setMainAudioUrl={setMainAudioUrl}
                            setSub1AudioUrl={setSub1AudioUrl}
                            setSub2AudioUrl={setSub2AudioUrl}

                            wipeInteractionState={wipeInteractionState}
                            touchHotspots={touchHotspots}
                            setTouchHotspots={setTouchHotspots}
                            feeds={false}
                            videoArray={videoArray}
                            interactionPostId={interactionPostId}
                            vid1={videoArray[0]}   // ← slot 1
                            vid2={videoArray[1]}   // ← slot 2
                            vid3={videoArray[2]}   // ← slot 3
                            mode={mode}
                            setmode={setmode}
                            stage={stage}
                            setStage={setStage}
                        />)

                    : null

            }



            {IsMobileBackActive && matchMobile ?

                <Box onClick={() => {
                    setclikt(false);
                }}

                    sx={{ height: '75vh', width: '100%', position: 'fixed', bottom: '0vh', backgroundColor: '', zIndex: '1' }} >



                </Box >
                : null}

            {<Feedgate


                setsearchDataNav={setsearchDataNav}
                setMyPageIdNav={setMyPageIdNav}
                setfeedLastIdNav={setfeedLastIdNav}
                setfeedScrollPosNav={setfeedScrollPosNav}


                setShowEmotions={setShowEmotions}
                setLikesPostid={setLikesPostid}
                setLikes={setLikes}

                showEmotions={showEmotions}
                setminimiseProfile={setminimiseProfile}
                minimiseProfile={minimiseProfile}

                minimisePrompt={minimisePrompt}
                searchData={''}
                vertical={true}
                MenuOpenb={MenuOpenb}
                setMenuOpenb={setMenuOpenb}
                routelastId={routelastId}
                setIsMenuOpen={setIsMenuOpen}
                setIsFullscreen={setIsFullscreen}
                isFullscreen={isFullscreen}
                type={3}
                feedContainerRef={feedContainerRef}
                isMenuOpen={isMenuOpen}
                callFeeds={callFeeds}
                setcallFeeds={setcallFeeds}
                LastId={LastId}
                setLastId={setLastId}
                feeds={feeds}
                setFeeds={setFeeds}
            />}

            {/* 3) Feedgate */}





        </>
    );
};





export default Clikit;
