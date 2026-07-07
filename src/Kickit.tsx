import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location
import Thumbnail from "./Thumbnail";
import TogglePromptButton from './TogglePromptButton';

import axios from "axios"; // Import Axios
import Slide from "@mui/material/Slide";

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






import { matchMobile, matchPc, matchTablet } from "./DetectDevice";
import { Height } from "@mui/icons-material";
///import { setTimeout } from "timers/promises";

interface ImagesProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
}



const Kickit: FC<any> = ({
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
    setfeedScrollPosNav,
    instantCall,
    setinstantCall



}) => {

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const location = useLocation();

    const [IsMobileBackActive, setIsMobileBackActive] = useState(false);
    const [minimiseProfile, setminimiseProfile] = useState(false);

    const [stopFeeds, setstopFeeds] = useState(false);

    const { routeScrollPos, routelastId, userId, upload } = location.state || {};
    // Now these will be `undefined` if no state was passed

    console.log("routeScrollPos:", routeScrollPos);
    console.log("routelastId:", routelastId);
    console.log("userId:", userId);






    useEffect(() => {

        setcallFeeds(true);

        setHideBottom(false);

    }, [location.pathname]);


    useEffect(() => {
        if (upload) {
            setstopFeeds(true);
        } else {
            setstopFeeds(false);
        }
    }, [location.pathname, upload]);



    const [clikt, setclikt] = useState(false);



    useEffect(() => {
        // slide in
        /// setallowUploadText(true)
        const t = setTimeout(() => setallowUploadText(false), 5000); // slide out after 3 s
        return () => clearTimeout(t);

    }, []);

    const [Zoom1x, setZoom1x] = useState(false);



    return (
        <>

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ overlay bar â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <TogglePromptButton
                LastId={LastId}
                feedContainerRef={feedContainerRef}
                isFullscreen={isFullscreen}
                textActive={false}
                setMenuOpenb={setMenuOpenb}
                setIsMenuOpen={setIsMenuOpen}
                MenuOpenb={MenuOpenb}
                type={2}
                minimisePrompt={minimisePrompt}
                setminimisePrompt={setminimisePrompt}

                matchMobile={matchMobile}
                allowUploadText={allowUploadText}
                isMenuOpen={isMenuOpen}
                darkModeReducer={darkModeReducer}
            />



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
                    type={1}
                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}

                    isMenuOpen={isMenuOpen}
                    setcallFeeds={setcallFeeds}
                    setAllowPing={setAllowPing}
                    AllowPing={AllowPing}
                    instantCall={instantCall}
                    setinstantCall={setinstantCall}
                />

            </Box >

            {IsMobileBackActive && matchMobile ?

                <Box onClick={() => {
                    setclikt(false);
                }}

                    sx={{ height: '75vh', width: '100%', position: 'fixed', bottom: '0vh', backgroundColor: '', zIndex: '1' }} >



                </Box >
                : null}


            {/* 3) Feedgate */}

            {stopFeeds ? null :
                null

            }


            <Feedgate

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
                type={2}
                feedContainerRef={feedContainerRef}
                isMenuOpen={isMenuOpen}
                callFeeds={callFeeds}
                setcallFeeds={setcallFeeds}
                LastId={LastId}
                setLastId={setLastId}
                feeds={feeds}
                setFeeds={setFeeds}
            />




        </>
    );
};






export default Kickit;
