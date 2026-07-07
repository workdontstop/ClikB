import React, {
    FC,
    memo,
    useEffect,
    useState,
    useRef,
    useCallback,
    useLayoutEffect
} from "react";
import axios from "axios";
import {
    Box,
    Typography,
    CircularProgress,
    Card,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import { setShowmenuToggle, } from "./settingsSlice";
import { matchMobile } from "./DetectDevice";
import "./theme.css";
import StoryAutoScroller from "./StoryAutoScroller";
import FullScreenStories from "./FullScreenStories";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Footer from "./Footer";
import ProfileInfo from "./ProfileInfo";

import { useLocation } from 'react-router-dom';
import { Fullscreen, Height, Padding } from "@mui/icons-material";



// Re-use any types you already have
// (e.g. FeedItem) or fall back to `any` if you prefer.
export interface FeedLayoutProps {
    matchMobile: boolean;
    isMenuOpen: boolean;
    audioElementRef: React.RefObject<HTMLAudioElement>;
    loading: boolean;
    error: string | null;
    feeds: any[]; // replace with FeedItem[] if you have that type
    feedContainerRef: React.RefObject<HTMLElement>;
    darkModeReducer: boolean;
    type: number;
    x: any;
    userProfile: any;
    setUserProfile: (v: any) => void;
    setminimiseProfile: (v: boolean) => void;
    minimiseProfile: boolean;
    isCropOpen: boolean;
    setIsCropOpen: (v: boolean) => void;
    loggedUser: any;
    MenuOpenb: boolean;
    setMenuOpenb: (v: boolean) => void;
    Zoom1x: boolean;
    setZoom1x: (v: boolean) => void;
    itemRefs: React.MutableRefObject<any[]>;
    minimisePrompt: boolean;
    itemLoadArray: any[];
    setitemLoadArray: (v: any[]) => void;
    captionVisibility: boolean[];
    halt: boolean;
    bottomSentinelRef: React.RefObject<HTMLDivElement>;
    delayMore: boolean;
    isFullscreen: boolean;
    storyVidArray: any[];
    setStoryVidArray: (v: any[]) => void;
    closePop: () => void;
    LastId: any;
    setLastId: (v: any) => void;
    setVideoArray: (v: any[]) => void;
    videoArray: any[];
    AudioArray: any[];
    setAudioArray: (v: any[]) => void;
    generatedAudios: any[];
    setGeneratedAudios: (v: any[]) => void;
    fullScreenContainerRef: React.RefObject<HTMLElement>;
    setHorizontalActiveIndex: (v: number) => void;
    horizontalActiveIndex: number;
    verticalActiveIndex: number;
    setverticalActiveIndex: (v: number) => void;
    audioPlaying: boolean;
    setAudioPlaying: (v: boolean) => void;
    fullscreenRefsX: React.MutableRefObject<any[]>;
    activeIndex: number;
    setActiveIndex: (v: number) => void;
    setIsFullscreen: (v: boolean) => void;
    handleOpenFullscreen: (idx: number, flag: boolean) => void;
    likedArray: any;
    likeCountArray: any;
    setLikedArray: any;
    setLikeCountArray: any

}

const FeedLayout: React.FC<any> = (props) => {
    /*
     * Destructure props for convenience,
     * but keep the variable names unchanged
     * so the original JSX remains identical.
     */
    const {
        matchMobile,
        isMenuOpen,
        audioElementRef,
        loading,
        error,
        feeds,
        feedContainerRef,
        darkModeReducer,
        type,
        userProfile,
        setUserProfile,
        setminimiseProfile,
        minimiseProfile,
        isCropOpen,
        setIsCropOpen,
        loggedUser,
        MenuOpenb,
        setMenuOpenb,
        Zoom1x,
        setZoom1x,
        itemRefs,
        minimisePrompt,
        itemLoadArray,
        setitemLoadArray,
        captionVisibility,
        halt,
        bottomSentinelRef,
        delayMore,
        isFullscreen,
        storyVidArray,
        setStoryVidArray,
        closePop,
        LastId,
        setLastId,
        setVideoArray,
        videoArray,
        AudioArray,
        setAudioArray,
        generatedAudios,
        setGeneratedAudios,
        fullScreenContainerRef,
        setHorizontalActiveIndex,
        horizontalActiveIndex,
        verticalActiveIndex,
        setverticalActiveIndex,
        audioPlaying,
        setAudioPlaying,
        fullscreenRefsX,
        activeIndex,
        setActiveIndex,
        setIsFullscreen,
        handleOpenFullscreen,
        searchData,
        showEmotions,

        setfollowType,
        MyPageId,
        likedArray,
        likeCountArray,
        setLikedArray,
        setLikeCountArray,

        setLikesPostid,
        setLikes,
        setShowEmotions,

        setsearchDataNav,
        setMyPageIdNav,
        setfeedLastIdNav,
        setfeedScrollPosNav
    } = props;


    const [currentIndex, setCurrentIndex] = useState(0);

    return (
        <>
            {/* Main Feed Layout */}

            <Box
                width="100%"
                p={matchMobile ? (isMenuOpen ? 1 : 0) : 2}
                style={{ padding: 0 }}
            >
                <audio ref={audioElementRef} style={{ display: 'none' }} />

                {loading && (
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        my={4}
                        style={{ display: 'none' }}
                    >
                        <CircularProgress size={48} />
                    </Box>
                )}

                {error && (
                    <Box mt={2} textAlign="center" style={{ display: 'none' }}>
                        <Typography variant="body1" color="error">
                            {error}
                        </Typography>
                    </Box>
                )}


                {feeds.length > 0 && (
                    <Box
                        className={darkModeReducer ? 'contentdarkcolor' : 'contentcolor'}
                        ref={feedContainerRef}
                        sx={{
                            maxHeight: matchMobile ? 'none' : '100vh',
                            overflowY: matchMobile ? 'visible' : 'auto',
                            overflowX: 'hidden',
                            scrollBehavior: 'smooth',
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: matchMobile ? 'auto' : 'contain',
                            boxSizing: 'border-box',
                            width: '100%',

                            padding:
                                matchMobile
                                    ? isMenuOpen
                                        ? '0px'
                                        : '0px'
                                    : isMenuOpen
                                        ? '16px'
                                        : '1vh',

                            '&::-webkit-scrollbar': { width: '8px' },
                            '&::-webkit-scrollbar-track': { background: '#f1f1f1' },
                            '&::-webkit-scrollbar-thumb': {
                                background: '#888',
                                borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb:hover': { background: '#555' },
                        }}
                    >
                        <Box sx={{
                            height: '10vh', width: '100%',
                            display: matchMobile ?
                                type === 10 ? 'none' : 'block'
                                :
                                type === 10 && !isMenuOpen ? 'none' : 'block',


                        }}>

                        </Box>
                        {(matchMobile && type === 10) || (!isMenuOpen && type === 10) ? (
                            <>
                                <ProfileInfo
                                    isFullscreen={isFullscreen}
                                    setIsFullscreen={setIsFullscreen}


                                    isFullscreen1={false}
                                    isFullscreen2={false}
                                    isFullscreen3={false}


                                    setShowEmotions={setShowEmotions}
                                    setfollowType={setfollowType}

                                    userProfile={userProfile}
                                    setUserProfile={setUserProfile}
                                    setminimise={setminimiseProfile}
                                    minimise={minimiseProfile}
                                    isCropOpen={isCropOpen}
                                    setIsCropOpen={setIsCropOpen}
                                    feeds={feeds}
                                    loggedUser={loggedUser}
                                    isMenuOpen={isMenuOpen}
                                    MenuOpenb={MenuOpenb}
                                    setMenuOpenb={setMenuOpenb}
                                />

                                <img
                                    onMouseEnter={() => setZoom1x(true)}
                                    onMouseOver={() => setZoom1x(true)}
                                    onMouseLeave={() => setZoom1x(false)}
                                    onTouchStart={() => setZoom1x(true)}
                                    onTouchEnd={() => setZoom1x(false)}
                                    onClick={() => {
                                        setZoom1x(true);
                                        setTimeout(() => setZoom1x(false), 300);
                                        if (matchMobile) {
                                            window.scrollTo({ top: 0, behavior: 'auto' });
                                        } else {
                                            const feedContainer = feedContainerRef.current as HTMLElement | null;
                                            feedContainer?.scrollTo({ top: 0, behavior: 'instant' });
                                        }
                                        setminimiseProfile(false);
                                    }}
                                    src={
                                        userProfile.profilePic ? `${userProfile.profilePic}` : ''
                                    }
                                    alt={
                                        userProfile.username
                                            ? `${userProfile.username}'s profile`
                                            : 'Profile'
                                    }
                                    style={{
                                        position: 'fixed',
                                        top: matchMobile ? '6vh' : '11.5vh',
                                        ///  right: matchMobile ? '' : '3vw',
                                        left: matchMobile ? '-1vw' : '3vw',
                                        transform: matchMobile
                                            ? minimiseProfile
                                                ? Zoom1x
                                                    ? 'scale(1.3)'
                                                    : 'scale(0.8)'
                                                : 'scale(0)'
                                            : minimiseProfile
                                                ? Zoom1x
                                                    ? 'scale(1.3)'
                                                    : 'scale(0.9)'
                                                : 'scale(0)',
                                        marginLeft: minimiseProfile
                                            ? matchMobile
                                                ? '2vw'
                                                : '0px'
                                            : matchMobile
                                                ? '2vw'
                                                : '0px',
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s ease-in-out',
                                        borderRadius: '50%',
                                        width: '80px',
                                        height: '80px',
                                        zIndex: 6,
                                        marginTop: matchMobile
                                            ? minimiseProfile
                                                ? '-5vh'
                                                : ''
                                            : minimiseProfile
                                                ? '-8vh'
                                                : '',
                                    }}
                                    className="profile-image"
                                />
                            </>
                        ) : null}


                        <Grid
                            container
                            spacing={
                                matchMobile
                                    ? type === 10
                                        ? 0.3
                                        : 0.3
                                    : isMenuOpen
                                        ? 2
                                        : 4
                            }
                            sx={{
                                margin: 0,
                                p: matchMobile
                                    ? type === 10
                                        ? 0
                                        : 0
                                    : isMenuOpen
                                        ? 0
                                        : 4,

                            }}
                        >

                            <AnimatePresence>


                                {feeds.map((item: any, idx: number) => {
                                    const storyImages =
                                        type === 2 || type === 10 || type === 1 || type === 4
                                            ? [
                                                item.x1,
                                                item.x2,
                                                item.x3,
                                                item.x4,
                                                item.x5,
                                                item.x6,
                                                item.x7,
                                                item.x8,
                                            ].filter(Boolean)
                                            : [];

                                    const storyVideos =
                                        type === 2 || type === 10 || type === 1 || type === 4
                                            ? [
                                                item.xv1,
                                                item.xv2,
                                                item.xv3,
                                                item.xv4,
                                                item.xv5,
                                                item.xv6,
                                                item.xv7,
                                                item.xv8,
                                                item.xv9,
                                            ].filter(Boolean)
                                            : [];

                                    const feedx = feeds[idx];

                                    return (

                                        <Grid
                                            ref={(el) => {
                                                if (el) itemRefs.current[idx] = el;
                                            }}
                                            data-index={idx}
                                            key={`${item.id}${idx}`}
                                            size={{
                                                xs: feeds.length === 1 ? 12 : type === 10 ? 4 : 4,
                                                sm: isMenuOpen ? (feeds.length === 1 ? 6 : 6) : 4,
                                                md: isMenuOpen ? (feeds.length === 1 ? 3 : type === 10 ? 2 : 2) : 2,
                                            }}
                                            component={motion.div}
                                            style={{

                                                padding:
                                                    feeds.length === 1 && matchMobile ? '10vw' :

                                                        matchMobile ?
                                                            type === 10 ? '0.4vh' : '0.4vh'

                                                            : '0vh',
                                                paddingBottom: matchMobile ? type === 10 ? '8vh' : '8vh' :
                                                    isMenuOpen ? '12vh' : '12vh'
                                            }}
                                            layout
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 30 }}
                                            transition={{
                                                duration: matchMobile ? 0.9 : 0.9,
                                                ease: 'easeInOut',
                                            }}
                                        >
                                            <Card
                                                sx={{
                                                    opacity: darkModeReducer ? 0.9 : 1,
                                                    position: 'relative',
                                                    borderRadius: matchMobile
                                                        ? type === 10
                                                            ? 0
                                                            : 0
                                                        : 2,
                                                    overflow: 'hidden',
                                                    boxShadow: 3,
                                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                                    minHeight: 100,
                                                    '&:hover': {
                                                        transform: 'scale(1.02)',
                                                        boxShadow: 6,
                                                    },


                                                }}
                                            >
                                                {/* Story Mode */}
                                                <StoryAutoScroller
                                                    showEmotions={showEmotions}
                                                    mode={feeds.length > 0 ? feeds[idx].mode : 0}
                                                    isFullscreen={isFullscreen}
                                                    item1vid={item.xv1}
                                                    vertical={true}
                                                    minimisePrompt={minimisePrompt}
                                                    itemLoadArray={itemLoadArray}
                                                    setitemLoadArray={setitemLoadArray}
                                                    videoUrl={item.videoUrl}
                                                    videoUrlItem={item.xv2}
                                                    videoUrlItem2={item.xv3}
                                                    MenuOpenb={MenuOpenb}
                                                    idx={idx}
                                                    captionVisibility={captionVisibility}
                                                    isMenuOpen={isMenuOpen}
                                                    image={item.item1}
                                                    image2={item.x2}
                                                    images={storyImages}
                                                    allVideos={storyVideos}
                                                    caption={item.caption}
                                                    onClick={() => handleOpenFullscreen(idx, false)}
                                                    type={type}
                                                />


                                                {/* Caption */}
                                                {captionVisibility[idx] ?
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            color: '#fff',
                                                            pl: matchMobile ? 2 : 2.5,
                                                            pr: matchMobile ? 3 : 3.5,
                                                            pt: matchMobile ? 2 : 2.5,
                                                            pb: matchMobile ? 2 : 2.5,
                                                            boxSizing: 'border-box',
                                                            visibility: halt ? 'hidden' : 'visible',
                                                            display:
                                                                matchMobile && isMenuOpen
                                                                    ? 'none'
                                                                    : type === 3 || type === 2
                                                                        ? 'none'
                                                                        : feedx.mode === 1 && feedx.captionAudio || feedx.mode === 2
                                                                            ? 'none'
                                                                            : 'block',
                                                            background: 'rgba(0, 0, 0, 0.25)',
                                                            backdropFilter: 'blur(3px)',
                                                            WebkitBackdropFilter: 'blur(3px)',
                                                            borderTopLeftRadius: '12px',
                                                            borderTopRightRadius: '12px',
                                                            transition: 'all 0.3s ease',
                                                            '&::-webkit-scrollbar': { width: '4px' },
                                                            '&::-webkit-scrollbar-track': { background: 'transparent' },
                                                            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.3)', borderRadius: '4px' },
                                                            '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.5)' },
                                                            '&:hover, &:active': {
                                                                background: 'rgba(0, 0, 0, 0.65)',
                                                                backdropFilter: 'blur(12px)',
                                                                WebkitBackdropFilter: 'blur(12px)',
                                                                maxHeight: '90%',
                                                                overflowY: 'auto'
                                                            },

                                                        }}
                                                    >
                                                        <Typography
                                                            className="caption-text"
                                                            variant="body1"
                                                            sx={{
                                                                fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
                                                                fontSize: matchMobile ? '0.75rem' : '0.9rem',
                                                                letterSpacing: '0.03em',
                                                                lineHeight: 1.5,
                                                                width: '100%',
                                                                opacity: 1,
                                                                textAlign: 'left',
                                                                wordBreak: 'break-word',
                                                                margin: '0 auto',
                                                                padding: '0px',
                                                                fontWeight: 400,
                                                                color: 'rgba(255, 255, 255, 0.95)',
                                                                display: '-webkit-box',
                                                                WebkitBoxOrient: 'vertical',
                                                                WebkitLineClamp: matchMobile ? 3 : 2,
                                                                overflow: 'hidden',
                                                                transition: 'all 0.3s ease',
                                                            }}
                                                        >
                                                            <span>
                                                                {item.caption}
                                                            </span>
                                                        </Typography>
                                                    </Box> : null
                                                }
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </AnimatePresence>
                        </Grid>

                        {/* Sentinel */}
                        <div
                            ref={bottomSentinelRef}
                            style={{
                                backgroundColor: 'red',
                                height: matchMobile
                                    ? '55vh'
                                    : isMenuOpen
                                        ? '30vh'
                                        : '60vh',
                                background: 'transparent',
                                display: delayMore ? 'none' : 'block',
                            }}
                        />
                    </Box>
                )}

                {!loading && feeds.length === 0 && !error && (
                    <Box mt={2} textAlign="center" style={{ marginTop: '10vh' }}>
                        <Typography variant="body1">No feeds available.</Typography>
                    </Box>
                )}
            </Box >

            {/* Fullscreen overlay */}
            {
                isFullscreen ? (
                    <FullScreenStories

                        setsearchDataNav={setsearchDataNav}
                        setMyPageIdNav={setMyPageIdNav}
                        setfeedLastIdNav={setfeedLastIdNav}
                        setfeedScrollPosNav={setfeedScrollPosNav}


                        setShowEmotions={setShowEmotions}
                        setLikesPostid={setLikesPostid}
                        setLikes={setLikes}

                        likedArray={likedArray}
                        likeCountArray={likeCountArray}

                        setLikedArray={setLikedArray}
                        setLikeCountArray={setLikeCountArray}

                        MyPageId={MyPageId}
                        searchData={''}
                        storyVidArray={storyVidArray}
                        setStoryVidArray={setStoryVidArray}
                        closePop={closePop}
                        type={type}
                        isMenuOpen={isMenuOpen}
                        feedContainerRef={feedContainerRef}
                        LastId={LastId}
                        setLastId={setLastId}
                        setVideoArray={setVideoArray}
                        videoArray={videoArray}
                        audioElementRef={audioElementRef}
                        AudioArray={AudioArray}
                        setAudioArray={setAudioArray}
                        generatedAudios={generatedAudios}
                        setGeneratedAudios={setGeneratedAudios}
                        fullScreenContainerRef={fullScreenContainerRef}
                        setHorizontalActiveIndex={setHorizontalActiveIndex}
                        horizontalActiveIndex={horizontalActiveIndex}
                        verticalActiveIndex={verticalActiveIndex}
                        setverticalActiveIndex={setverticalActiveIndex}
                        audioPlaying={audioPlaying}
                        setAudioPlaying={setAudioPlaying}
                        fullscreenRefsX={fullscreenRefsX}
                        feeds={feeds}
                        activeIndex={activeIndex}
                        setActiveIndex={setActiveIndex}
                        setIsFullscreen={setIsFullscreen}
                        IsFullscreen={isFullscreen}
                    />
                ) : null
            }
        </>
    );
};

export default FeedLayout;
