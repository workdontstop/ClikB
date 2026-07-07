// FeedLayoutHorizontal.tsx
import React, { useCallback, useEffect, useState, useLayoutEffect, useRef } from "react";
import {
    Box,
    CircularProgress,
    Typography,
    Card,
    IconButton,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import Grid from "@mui/material/Grid2";
import { motion, AnimatePresence } from "framer-motion";

// adjust paths to your project structure
import StoryAutoScroller from "./StoryAutoScroller";
import ProfileInfo from "./ProfileInfo";
import FullScreenStories from "./FullScreenStories";
import { FeedLayoutProps } from "./FeedLayout";
///scale

const FeedLayoutHorizontal: React.FC<any> = (props) => {
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
        /* bottomSentinelRef â€” removed */
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
        fetchFeedsPagination,
        vertical,
        searchData,
        showEmotions,
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

    /* ---------- arrow-visibility helpers ---------- */
    const [atEnd, setAtEnd] = useState(false);

    const [isScrollable, setIsScrollable] = useState(false);

    const [currentIndex, setCurrentIndex] = useState(0);

    const atEndRef = useRef<boolean>(false);
    const tickingRef = useRef(false);

    const handleScroll = useCallback(() => {
        const el = feedContainerRef.current as HTMLElement | null;
        if (!el) return;

        // rAF throttle to avoid layout thrash
        if (tickingRef.current) return;
        tickingRef.current = true;

        requestAnimationFrame(() => {
            const reachedEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 300;

            // Only update if the value changed
            if (atEndRef.current !== reachedEnd) {
                atEndRef.current = reachedEnd;
                setAtEnd(reachedEnd);
            }

            tickingRef.current = false;
        });
    }, [feedContainerRef]);

    useEffect(() => {
        const el = feedContainerRef.current as HTMLElement | null;
        if (!el) return;

        // Passive listener = better scroll perf
        el.addEventListener("scroll", handleScroll, { passive: true });

        // âš ï¸ Don't call handleScroll immediately; defer 2 frames so layout/widths settle
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => handleScroll())
        );

        return () => {
            cancelAnimationFrame(id);
            el.removeEventListener("scroll", handleScroll as EventListener);
        };

    }, [handleScroll]);


    useEffect(() => {
        const id = requestAnimationFrame(handleScroll);
        return () => cancelAnimationFrame(id);
    }, [captionVisibility, handleScroll]);

    /* --------------------------------------------- */


    // â”€â”€â”€â”€â”€ 1.  add these two helper states  â”€â”€â”€â”€â”€
    const [quickScroll, setQuickScroll] = useState(false);
    const [savedIndex, setSavedIndex] = useState<number | null>(null);
    const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);


    // ðŸš€ NEW clamp effect â€“ drop this in place of the old one
    useLayoutEffect(() => {

        const node = feedContainerRef.current as HTMLElement | null;
        if (!node) return;

        // 1ï¸âƒ£  Nothing to do if the content fits entirely on screen
        if (node.scrollWidth <= node.clientWidth + 1) return;

        //  constants (kept exactly as you had them)
        const LEFT_RATIO = matchMobile ? 0.01 : 0.03;  // 3 % of total range
        const RIGHT_RATIO = 0.99;  // 99 % of total range
        const MIN_PX = matchMobile ? 5 : 20;    // never allow < 20 px

        // 2ï¸âƒ£  RAF-throttled clamp â‡’ 1 layout pass per animation frame
        let rafId: number | null = null;
        const clamp = () => {
            if (rafId !== null) return;               // already scheduled
            rafId = requestAnimationFrame(() => {
                const range = node.scrollWidth - node.clientWidth;
                const min = Math.max(range * LEFT_RATIO, MIN_PX);
                const max = range * RIGHT_RATIO;

                if (node.scrollLeft < min) node.scrollLeft = min;
                else if (node.scrollLeft > max) node.scrollLeft = max;

                rafId = null;                     // free for next scroll event
            });
        };

        // 3ï¸âƒ£  Give React + the browser 2 s to paint the new feeds first
        const timeoutId = setTimeout(() => {
            // put the viewport just outside the swipe-zone on mount
            const range = node.scrollWidth - node.clientWidth;
            node.scrollLeft = Math.max(range * LEFT_RATIO, MIN_PX);

            node.addEventListener("scroll", clamp, { passive: true });
        }, 500);   // â† tweak if you need a different delay

        // ðŸ”„  clean-up
        return () => {
            clearTimeout(timeoutId);
            node.removeEventListener("scroll", clamp);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [feeds]);   // feedContainerRef is stable, so no need to include it here





    // â”€â”€â”€â”€â”€ 3.  auto-jump back once the new feeds arrive, after a 3s delay â”€â”€â”€â”€â”€
    useEffect(() => {
        if (!quickScroll || savedIndex === null) return;

        // schedule the scroll after 3 seconds

        if (iconTimeoutRefax.current) {
            clearTimeout(iconTimeoutRefax.current);
        }
        iconTimeoutRefax.current = setTimeout(() => {

            //alert(savedIndex);

            const container = feedContainerRef.current as HTMLElement | null;
            const targetEl = itemRefs.current[savedIndex];
            if (container && targetEl) {
                container.scrollTo({ left: targetEl.offsetLeft, behavior: "instant" });
            }
            setQuickScroll(false);  // reset flag
        }, 2000);

        // cleanup if dependencies change before the timeout fires

    }, [feeds, quickScroll, savedIndex]);


    // ðŸ“ put this near the component or in a helpers file
    const captionByType: Record<any, string> = {
        1: 'Memes',
        2: 'Stories',
        3: 'Interactions',
    }




    useLayoutEffect(() => {
        const el = feedContainerRef.current as HTMLElement | null;
        if (!el) return;
        const check = () => setIsScrollable(el.scrollWidth > el.clientWidth + 1);
        check();                        // after first paint
        window.addEventListener('resize', check);

        setIsScrollable(matchMobile ? feeds.length > 3 : feeds.length > 4);
        return () => window.removeEventListener('resize', check);
    }, [feeds, searchData]);



    return (
        <>
            {/* Main Feed Layout */}
            <Box
                position="relative"
                width={matchMobile ? '100%' : isMenuOpen ? '100%' : "100%"}
                p={matchMobile ? (isMenuOpen ? 0 : 0) : 2}
                style={{
                    paddingLeft: '0vw',
                    filter: quickScroll ? 'blur(5px)' : 'blur(0px)',

                }}
            >
                <audio ref={audioElementRef} style={{ display: "none" }} />

                {loading && (
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        my={4}
                        style={{ display: "none" }}
                    >
                        <CircularProgress size={48} />
                    </Box>
                )}

                {error && (
                    <Box mt={2} textAlign="center" style={{ display: "none" }}>
                        <Typography variant="body1" color="error">
                            {error}
                        </Typography>
                    </Box>
                )}

                {feeds.length > 0 && (
                    <Box
                        className={darkModeReducer ? "contentdarkcolor" : "contentcolor"}
                        ref={feedContainerRef}
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            flexWrap: "nowrap",
                            overflowX: "auto",
                            overflowY: "hidden",
                            justifyContent: "flex-start",
                            scrollBehavior: "snappy",
                            WebkitOverflowScrolling: "touch",
                            overscrollBehaviorX: "contain",
                            touchAction: "pan-x pan-y",
                            boxSizing: "border-box",
                            webkitOverflowScrolling: 'touch',
                            scrollSnapType: 'x proximity',
                            width: "100%",
                            padding:
                                matchMobile
                                    ? isMenuOpen
                                        ? "0px"
                                        : "0px"
                                    : isMenuOpen
                                        ? "0px"
                                        : "0vh",
                            pr: isScrollable ? matchMobile ? '15vw' : '10vw' : '0px',

                            "&::-webkit-scrollbar": {
                                width: "8px",
                            },
                            "&::-webkit-scrollbar-track": {
                                background: "rgb(255,255,255,0)",
                            },
                            "&::-webkit-scrollbar-thumb": {
                                background: "rgb(255,255,255,0)",
                                borderRadius: "4px",
                            },
                            "&::-webkit-scrollbar-thumb:hover": {
                                background: "rgb(255,255,255,0)",
                            },


                        }}
                    >
                        {/* OPTIONAL profile section */}
                        {(matchMobile && type === 10) || (!isMenuOpen && type === 10) ? (
                            <>
                                <ProfileInfo
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
                                        const el = feedContainerRef.current as HTMLElement;
                                        if (el) el.scrollTo({ left: 0, behavior: "instant" });
                                        setminimiseProfile(false);
                                    }}
                                    src={userProfile.profilePic ? `${userProfile.profilePic}` : ""}
                                    alt={
                                        userProfile.username
                                            ? `${userProfile.username}'s profile`
                                            : "Profile"
                                    }
                                    style={{
                                        position: "fixed",
                                        top: matchMobile ? "5vh" : "9vh",
                                        right: matchMobile ? "" : "3vw",
                                        left: matchMobile ? "-1vw" : "",
                                        transform: matchMobile
                                            ? minimiseProfile
                                                ? Zoom1x
                                                    ? "scale(1.3)"
                                                    : "scale(0.8)"
                                                : "scale(0)"
                                            : minimiseProfile
                                                ? Zoom1x
                                                    ? "scale(1.3)"
                                                    : "scale(0.9)"
                                                : "scale(0)",
                                        marginLeft: minimiseProfile
                                            ? matchMobile
                                                ? "2vw"
                                                : "0px"
                                            : matchMobile
                                                ? "2vw"
                                                : "0px",
                                        cursor: "pointer",
                                        transition: "transform 0.2s ease-in-out",
                                        borderRadius: "50%",
                                        width: "80px",
                                        height: "80px",
                                        zIndex: 6,
                                        marginTop: matchMobile
                                            ? minimiseProfile
                                                ? "-5vh"
                                                : ""
                                            : minimiseProfile
                                                ? "-8vh"
                                                : "",
                                    }}
                                    className="profile-image"
                                />
                            </>
                        ) : null}

                        {/* ITEMS */}
                        <Grid
                            container
                            direction="row"
                            wrap="nowrap"
                            spacing={
                                matchMobile ? (type === 10 ? 0.3 : 1.5) : isMenuOpen ? 1 : 1
                            }
                            sx={{
                                flexWrap: "nowrap",
                                margin: 0,
                                p: matchMobile
                                    ? type === 10
                                        ? 0
                                        : 1.5
                                    : isMenuOpen
                                        ? 0
                                        : 4,

                            }}
                        >
                            <AnimatePresence>
                                {/* â”€â”€ dummy spacer at the very start â”€â”€ */}

                                {isScrollable && (
                                    <Grid
                                        key="blank-spacer"
                                        size={

                                            { xs: 5, sm: 3, md: 2.5, lg: 2 }}   // same footprint as a real card
                                        component={motion.div}
                                        style={{ flexShrink: 0, pointerEvents: "none", opacity: 0 }}
                                        layout
                                    >
                                        {/* keeps the aspect-ratio so it â€œlooksâ€ like an image slot */}
                                        <Box sx={{ width: "100%", pt: "100%" }} />
                                    </Grid>
                                )}


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
                                            size={

                                                isScrollable ? { xs: 5.5, sm: 4, md: 3, lg: 2.2 }

                                                    :
                                                    {
                                                        xs: 5.5, sm: 4, md: 4, lg:
                                                            feeds.length > 2 ?
                                                                isMenuOpen ? 3 : 3 :
                                                                isMenuOpen ? 5 : 6
                                                    }}



                                            component={motion.div}
                                            style={{ flexShrink: 0, }}
                                            layout
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.6, ease: "easeInOut" }}
                                        >
                                            <Card
                                                sx={{
                                                    opacity: darkModeReducer ? 0.9 : 1,
                                                    bgcolor: darkModeReducer ? '#000' : '#fff',
                                                    position: "relative",
                                                    borderRadius:
                                                        matchMobile && type === 10 ? 0 : 2,
                                                    overflow: "hidden",
                                                    boxShadow: 3,

                                                    /// flex: '0 0 auto',
                                                    scrollSnapAlign: matchMobile ? 'center' : 'start',
                                                    //marginRight: '1vw',

                                                    transition: "transform 0.3s, box-shadow 0.3s",
                                                    minHeight: matchMobile ? isScrollable ? '100' : '38vh' : isScrollable ? '100' : '44vh',
                                                    width: matchMobile ? 'auto' : '25vh',
                                                    "&:hover": {
                                                        transform: "scale(1.02)",
                                                        boxShadow: `0 8px 28px ${darkModeReducer ? 'rgba(232,186,250,0.35)' : 'rgba(0,153,204,0.30)'}`,
                                                    },
                                                }}
                                            >
                                                <StoryAutoScroller
                                                    showEmotions={showEmotions}
                                                    mode={feeds.length > 0 ? feeds[idx].mode : 0}
                                                    isFullscreen={isFullscreen}
                                                    item1vid={item.xv1}
                                                    vertical={vertical}
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





                                                {captionVisibility[idx] && (
                                                    <Box
                                                        sx={{
                                                            position: "absolute",
                                                            bottom: 0,
                                                            left: 0,
                                                            width: "100%",
                                                            color: "#fff",
                                                            pl: matchMobile ? 2 : 2.5,
                                                            pr: matchMobile ? 3 : 3.5,
                                                            pt: matchMobile ? 2 : 2.5,
                                                            pb: matchMobile ? 2 : 2.5,
                                                            boxSizing: "border-box",
                                                            visibility: halt ? "hidden" : "visible",
                                                            display:
                                                                matchMobile && isMenuOpen
                                                                    ? "none"
                                                                    : type === 3
                                                                        ? "none"
                                                                        : feedx.mode === 1 && feedx.captionAudio || feedx.mode === 2
                                                                            ? "none"
                                                                            : "block",
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
                                                                fontSize: matchMobile ? '0.75rem' : '0.85rem',
                                                                letterSpacing: '0.03em',
                                                                lineHeight: 1.5,
                                                                fontWeight: 400,
                                                                color: 'rgba(255, 255, 255, 0.95)',
                                                                wordBreak: "break-word",
                                                                display: "-webkit-box",
                                                                WebkitBoxOrient: "vertical",
                                                                WebkitLineClamp: matchMobile ? 3 : 2,
                                                                overflow: "hidden",
                                                                transition: 'all 0.3s ease',
                                                            }}
                                                        >
                                                            <span>
                                                                {item.caption}
                                                            </span>
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Card>
                                        </Grid>
                                    );
                                })}
                            </AnimatePresence>
                        </Grid>
                    </Box>
                )}

                {!loading && feeds.length === 0 && !error && (
                    <Box mt={2} textAlign="center" style={{ marginTop: "10vh" }}>
                        <Typography variant="body1"></Typography>
                    </Box>
                )}

                {/* Arrow appears ONLY when we are at the end */}


                {isScrollable && atEnd && feeds.length > 0 && (
                    <IconButton
                        onClick={() => {
                            /* remember where we were, then paginate */
                            setSavedIndex(feeds.length - 2);   // â† last viewed card
                            setQuickScroll(true);
                            fetchFeedsPagination();
                        }}
                        sx={{
                            position: "absolute",
                            right: matchMobile ? 4 : 16,
                            top: "50%",
                            transform: "translateY(-50%)",
                            bgcolor: "rgba(0,0,0,0.4)",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
                            color: "#fff",
                            zIndex: 10,
                            padding: matchMobile ? '6vw' : '2vw'
                        }}
                    >
                        <ArrowForwardIosIcon style={{ fontSize: matchMobile ? '2.2rem' : '2rem' }} />
                    </IconButton>
                )}
            </Box >

            {/* Fullscreen overlay */}
            {
                isFullscreen && (
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
                        searchData={searchData}
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
                )
            }
        </>
    );
};

export default FeedLayoutHorizontal;
