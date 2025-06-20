import React, { useState, useCallback, useEffect, FC } from "react";
import PromptInput from "./PromptInput";
import PingLoader from "./ping";
import Feedgate from "./FeedsGate";
import IconButton from "@mui/material/IconButton";
import SearchIcon from '@mui/icons-material/Search';
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location


import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';

import { useParams, useLocation } from "react-router-dom"; // <-- Import useParams he
import {
    Box,
    Typography,
    CircularProgress,
    Card,
    CardMedia,
} from "@mui/material";

import ProfileInfo from "./ProfileInfo";








import { matchMobile, matchPc, matchTablet } from "./DetectDevice";

interface ImagesProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
}



const Mypage: FC<any> = ({
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
    setIsMenuOpen,
    minimisePrompt,
    setminimisePrompt,
    MenuOpenb,
    setMenuOpenb,


    x,

    isCropOpen,
    setIsCropOpen,
    setHideBottom
}) => {

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // 1) Grab the " userId" from the URL
    ///const {  userId } = useParams();

    const location = useLocation();
    const { routeScrollPos, routelastId, userId } = location.state || {};

    // Now these will be `undefined` if no state was passed
    console.log("routeScrollPos:", routeScrollPos);
    console.log("routelastId:", routelastId);
    console.log("userId:", userId);




    const [minimiseProfile, setminimiseProfile] = useState(false);



    useEffect(() => {
        setcallFeeds(true);
        ///alert(routelastId);
        setHideBottom(false);
    }, [location.pathname, userId,]);


    return (
        <>
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
                    display: 'none'

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
                    <CameraEnhanceIcon
                        sx={{
                            fontSize: matchMobile ? "1.6rem" : "1.3rem",
                            color: darkModeReducer ? 'white' : "black",
                        }}
                    />
                </IconButton>


            </Box > : null}





            {/* 3) Feedgate */}
            <Feedgate
                setminimiseProfile={setminimiseProfile}
                minimiseProfile={minimiseProfile}
                MenuOpenb={MenuOpenb}
                setMenuOpenb={setMenuOpenb}
                routelastId={routelastId}
                MyPageId={userId}
                setIsMenuOpen={setIsMenuOpen}
                setIsFullscreen={setIsFullscreen}
                isFullscreen={isFullscreen}
                type={10}
                feedContainerRef={feedContainerRef}
                isMenuOpen={isMenuOpen}
                callFeeds={callFeeds}
                setcallFeeds={setcallFeeds}
                LastId={LastId}
                setLastId={setLastId}
                feeds={feeds}
                setFeeds={setFeeds}
                isCropOpen={isCropOpen}
                setIsCropOpen={setIsCropOpen}
                x={x}
            />

        </>
    );
};






export default Mypage;


