import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location
import Thumbnail from "./Thumbnail";

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
    setHideBottom



}) => {


    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const location = useLocation();

    const [IsMobileBackActive, setIsMobileBackActive] = useState(false);

    const { routeScrollPos, routelastId, userId } = location.state || {};
    // Now these will be `undefined` if no state was passed

    console.log("routeScrollPos:", routeScrollPos);
    console.log("routelastId:", routelastId);
    console.log("userId:", userId);



    useEffect(() => {
        setcallFeeds(true);
        setHideBottom(false);
    }, [location.pathname]);





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

            {/* ───────── overlay bar ───────── */}
            {minimisePrompt && (
                <Box

                    onMouseEnter={() => setZoom1x(true)}
                    onMouseOver={() => setZoom1x(true)}
                    onMouseLeave={() => setZoom1x(false)}

                    onTouchStart={() => setZoom1x(true)}
                    onTouchEnd={() => setZoom1x(false)}

                    onClick={() => {

                        setZoom1x(true);
                        setTimeout(() => setZoom1x(false), 300);

                    }}

                    sx={{
                        height: "0vh",
                        position: "fixed",
                        top: matchMobile ? "6.5vh" : isMenuOpen ? '6vh' : "8.5vh",
                        left: matchMobile
                            ? allowUploadText ? "33vw" : "82vw"
                            : isMenuOpen
                                ? "21.8vw"
                                : "3vw",
                        width: matchMobile ? "100%" : "100%",
                        display: "flex",
                        alignItems: "center",
                        zIndex: 1000,
                    }}
                >
                    {/* unified icon + label button */}
                    <Box
                        className={`toggle-image ${Zoom1x ? "bounce" : ""}`}
                        onClick={() => setminimisePrompt(false)}
                        sx={{

                            alignItems: "center",
                            gap: allowUploadText ? 1 : 0,          // keep icon centred when collapsed
                            width: allowUploadText ? "auto" : 55,  // pill width → circle width
                            height: 55,
                            px: allowUploadText ? 1.6 : 0,         // same padding you used on the label
                            py: 0.4,
                            borderRadius: allowUploadText ? 1 : "50%",
                            bgcolor: darkModeReducer
                                ? "rgba(0,0,0,0.65)"
                                : "rgb(250,250,250)",
                            backdropFilter: "blur(4px)",
                            boxShadow: 3,
                            opacity: 0.7,

                            cursor: "pointer",
                            "&:hover": {
                                bgcolor: darkModeReducer
                                    ? "rgba(100,100,100,0.3)"
                                    : "rgba(250,250,250,0.3)",
                            },
                            display: matchMobile && isMenuOpen ? "none" : "inline-flex",
                            transition: "width 250ms ease, border-radius 250ms ease",
                        }}
                    >
                        {/* camera icon */}
                        <CameraEnhanceIcon
                            sx={{
                                fontSize: matchMobile ? "1.8rem" : "1.7rem",
                                color: darkModeReducer ? "#fff" : "#000",
                                textAlign: 'center',
                                margin: 'auto',
                            }}
                        />

                        {/* sliding label — collapses to 0 px width */}
                        <Collapse
                            orientation="horizontal"
                            in={allowUploadText}
                            timeout={{ enter: 300, exit: 250 }}
                            unmountOnExit
                        >
                            <Box
                                sx={{
                                    fontSize: matchMobile ? 12 : 14,
                                    fontWeight: 600,
                                    color: darkModeReducer ? "#fff" : "#000",
                                    whiteSpace: "nowrap",
                                    userSelect: "none",
                                }}
                            >
                                Create Story
                            </Box>
                        </Collapse>
                    </Box>
                </Box>
            )}





            <Box sx={{ position: 'relative', padding: '0px', zIndex: '2' }} >


                {/* 1) Prompt Input */}
                <PromptInput
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
            <Feedgate
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


