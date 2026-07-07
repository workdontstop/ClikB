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

    isCropOpen,
    setIsCropOpen,
    setHideBottom,
    showEmotions,
    setShowEmotions,
    setfollowType,
    setLikesPostid,
    setLikes,

    setsearchDataNav,
    setMyPageIdNav,
    setfeedLastIdNav,
    setfeedScrollPosNav
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
        setminimisePrompt(true);
        setcallFeeds(true);
        ///alert(routelastId);
        setHideBottom(false);
    }, [location.pathname, userId,]);


    return (
        <>

            <TogglePromptButton
                LastId={LastId}
                feedContainerRef={feedContainerRef}
                isFullscreen={isFullscreen}
                textActive={false}
                setMenuOpenb={setMenuOpenb}
                setIsMenuOpen={setIsMenuOpen}
                MenuOpenb={MenuOpenb}
                type={10}
                minimisePrompt={minimisePrompt}
                setminimisePrompt={setminimisePrompt}

                matchMobile={matchMobile}
                allowUploadText={false}
                isMenuOpen={isMenuOpen}
                darkModeReducer={darkModeReducer}
            />



            {/* 3) Feedgate */}
            <Feedgate

                setsearchDataNav={setsearchDataNav}
                setMyPageIdNav={setMyPageIdNav}
                setfeedLastIdNav={setfeedLastIdNav}
                setfeedScrollPosNav={setfeedScrollPosNav}

                setShowEmotions={setShowEmotions}
                setLikesPostid={setLikesPostid}
                setLikes={setLikes}


                setfollowType={setfollowType}

                showEmotions={showEmotions}
                searchData={''}
                vertical={true}
                minimisePrompt={minimisePrompt}
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

            />

        </>
    );
};






export default Mypage;
