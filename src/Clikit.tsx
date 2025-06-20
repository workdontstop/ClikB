import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location



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
    setMenuOpenb



}) => {



    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const location = useLocation();


    const [HideDemo, setHideDemo] = useState(false);


    const { routeScrollPos, routelastId, userId } = location.state || {};
    // Now these will be `undefined` if no state was passed

    console.log("routeScrollPos:", routeScrollPos);
    console.log("routelastId:", routelastId);
    console.log("userId:", userId);



    useEffect(() => {
        setcallFeeds(true);
    }, [location.pathname]);



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
            </Box>}


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
                        display: matchMobile && isMenuOpen ? "none" : "inline‑flex",
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

                <InteractInput

                    minimisePrompt={minimisePrompt}
                    setminimisePrompt={setminimisePrompt}

                />

            </div>


            {/* 3) Feedgate */}
            <Feedgate
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
            />




        </>
    );
};





export default Clikit;
