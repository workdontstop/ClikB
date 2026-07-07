import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location

import { Hotspot } from "./TouchPreviewStageUI";
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
    setfeedScrollPosNav



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

    const [touchHotspots, setTouchHotspots] = useState<[Hotspot, Hotspot]>([
        { id: "left", x: 0.3, y: 0.6, r: 0.12 },
        { id: "right", x: 0.7, y: 0.6, r: 0.12 },
    ]);


    const [IsMobileBackActive, setIsMobileBackActive] = useState(false);


    const { routeScrollPos, routelastId, userId, upload } = location.state || {};
    // Now these will be `undefined` if no state was passed

    console.log("routeScrollPos:", routeScrollPos);
    console.log("routelastId:", routelastId);
    console.log("userId:", userId);

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





    const LOCAL_KEY_PREFIX = "localstoragevid";  //  localstoragevid1, 2, 3 â€¦
    const VIDEO_SLOTS = 9;                  //  how many separate slots you keep location.pathname

    // state that mirrors what you stored
    const [videoArray, setVideoArray] = useState<(string | null)[]>(
        Array(VIDEO_SLOTS + 1).fill(null)          // +1 so that index 1..3 match your code
    );




    // Call this to wipe local cache + state used by the effect
    const wipeInteractionState = useCallback(() => {
        // 1) Clear the 3 slot keys from localStorage
        for (let i = 0; i <= VIDEO_SLOTS; i++) {
            localStorage.removeItem(`${LOCAL_KEY_PREFIX}${i}`);
        }
        // 2) Clear the post id key
        localStorage.removeItem("localInteractionpostId");

        // 3) Reset React state
        setVideoArray(["", "", ""]);       // or [null, null, null] if your state type allows null
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

    useEffect(() => {
        if (!minimisePrompt) return;                      // bail out until dialog is closed

        // 1ï¸âƒ£  refresh the three video slots
        setVideoArray(prev => {
            const next = [...prev];
            for (let i = 0; i <= VIDEO_SLOTS; i++) {
                ///  alert(localStorage.getItem(`${LOCAL_KEY_PREFIX}${i}`));
                next[i] = localStorage.getItem(`${LOCAL_KEY_PREFIX}${i}`);   // may be null
            }
            return next;
        });

        // 2ï¸âƒ£  fetch the latest post-id
        setInteractionPostId(localStorage.getItem("localInteractionpostId")); // null if missing
    }, [minimisePrompt, location.pathname]);                               // â† dependency array


    useEffect(() => {

        ///alert(videoArray)
        if (minimisePrompt) {


            const hasAnyVideo = videoArray.slice(1).some(Boolean); // ignore the 0-th slot

            setInteractStart(hasAnyVideo);   // true  â†’ ready to interact
            // false â†’ keep it/reset to false
        } else { }
    }, [videoArray, minimisePrompt, location.pathname]);


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
                    ðŸš§ Work in Progress ðŸš§
                </Typography>
            </Box> : null}





            <Box sx={{ position: 'relative', padding: '0px', zIndex: '2' }} >


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
                />

            </Box >


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




                {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ overlay bar â”€â”€â”€â”€â”€â”€â”€â”€â”€


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
                videoArray[0] && minimisePrompt ?
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
                            vid1={videoArray[0]}   // â† slot 1
                            vid2={videoArray[1]}   // â† slot 2
                            vid3={videoArray[2]}   // â† slot 3
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
