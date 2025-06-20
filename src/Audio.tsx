import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import SearchIcon from '@mui/icons-material/Search';
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



const Audio: FC<any> = ({
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
    setIsFullscreen, isFullscreen
}) => {



    const [minimisePrompt, setminimisePrompt] = useState(false); // Tracks which image is on top


    const location = useLocation();



    useEffect(() => {
        setcallFeeds(true);
    }, [location.pathname]);


    return (
        <>
            {minimisePrompt ? <Box
                sx={{


                    width: matchMobile ? '20%' : "100%",
                    textAlign: "center",

                    left: matchMobile ? "40%" :
                        '0px',


                    // Optional: If you want a subtle background to separate it
                    //// backgroundColor: darkModeReducer ? "#121212" : "#ffffff",
                    height: matchMobile ? '5.15vh' : '3vh', // vertical padding
                    zIndex: 1000,
                    fontWeight: 'bold',
                    fontFamily: "Arial, Helvetica, sans-serif",
                    position: 'fixed',
                    top: '0vh'

                }}
            >
                <>
                    <SearchIcon onClick={() => {
                        setminimisePrompt(false);
                    }} style={{
                        fontSize: matchMobile ? '2.3rem' : '2rem',
                        paddingTop: matchMobile ? '0.4vh' : '1vh',
                        transform: matchMobile ? 'scale(0.7)' : 'scale(1)',
                        opacity: 0.6,
                        display: 'inline',
                        margin: 'auto',
                        cursor: 'pointer',
                        color: 'white', // Set the icon color to white
                        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.7)', // Add a shadow for visibility
                    }} />

                </>
            </Box > : null}



            {/* 1) Prompt Input */}
            <PromptInput

                callFeeds={callFeeds}
                type={2}
                minimisePrompt={minimisePrompt}
                setminimisePrompt={setminimisePrompt}

                isMenuOpen={isMenuOpen}
                setcallFeeds={setcallFeeds}
                setAllowPing={setAllowPing}
                AllowPing={AllowPing}
            />



        </>
    );
};






export default Audio;


