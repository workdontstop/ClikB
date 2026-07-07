import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location
import TogglePromptButton from './TogglePromptButton';

import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';
import {
    Box,
    Typography,
    CircularProgress,
    Card,
    CardMedia,
    Collapse
} from "@mui/material";


import { useLocation } from 'react-router-dom';



import axios from "axios"; // Import Axios  backgroundColor



import { matchMobile, matchPc, matchTablet } from "./DetectDevice";
import { DarkMode } from "@mui/icons-material";

interface ImagesProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
}



const Feeds: FC<any> = ({
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
    setIsFullscreen, isFullscreen,

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

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const location = useLocation();

    const [HideDemo, setHideDemo] = useState(false);

    const [clikt, setclikt] = useState(false);

    const [stopFeeds, setstopFeeds] = useState(false);


    const [minimiseProfile, setminimiseProfile] = useState(false);

    useEffect(() => {
        setcallFeeds(true);
        setHideBottom(false);


    }, [location.pathname]);


    const { routeScrollPos, routelastId, userId, upload } = location.state || {};
    // Now these will be `undefined` if no state was passed

    /// console.log("routeScrollPos:", routeScrollPos);
    ///console.log("routelastId:", routelastId);
    ///console.log("userId:", userId);

    const [IsMobileBackActive, setIsMobileBackActive] = useState(false);



    useEffect(() => {
        // slide in
        ///  setallowUploadText(true)
        const t = setTimeout(() => setallowUploadText(false), 5000); // slide out after 3 s
        return () => clearTimeout(t);

    }, []);


    const [Zoom1x, setZoom1x] = useState(false);


    useEffect(() => {
        if (upload) {
            setstopFeeds(true);
        } else {
            setstopFeeds(false);
        }
    }, [location.pathname, upload]);



    return (
        <>
            {HideDemo ? null : <Box



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
                    display: "none",
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
            </Box>}


            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ overlay bar â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}


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
                allowUploadText={allowUploadText}
                isMenuOpen={isMenuOpen}
                darkModeReducer={darkModeReducer}
            />



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
                type={0}
                minimisePrompt={minimisePrompt}
                setminimisePrompt={setminimisePrompt}

                isMenuOpen={isMenuOpen}
                setcallFeeds={setcallFeeds}
                setAllowPing={setAllowPing}
                AllowPing={AllowPing}
            />

            {/* 2) Ping Loader */}


            {IsMobileBackActive && matchMobile ?

                <Box onClick={() => {
                    setclikt(false);
                }}

                    sx={{ height: '75vh', width: '100%', position: 'fixed', bottom: '0vh', backgroundColor: '', zIndex: '1' }} >



                </Box >
                : null}

            {/* 3) Feedgate */}

            {stopFeeds ? null : <Feedgate

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
                searchData={''}
                vertical={true}
                minimisePrompt={minimisePrompt}
                MenuOpenb={MenuOpenb}
                setMenuOpenb={setMenuOpenb}
                routelastId={routelastId}
                setIsMenuOpen={setIsMenuOpen}
                setIsFullscreen={setIsFullscreen}
                isFullscreen={isFullscreen}
                type={4}
                feedContainerRef={feedContainerRef}
                isMenuOpen={isMenuOpen}
                callFeeds={callFeeds}
                setcallFeeds={setcallFeeds}
                LastId={LastId}
                setLastId={setLastId}
                feeds={feeds}
                setFeeds={setFeeds}
            />}

        </>
    );
};

export default Feeds;
