import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Typography, Stack, useTheme, Button, } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import MenuIcon from '@mui/icons-material/Menu';



import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import FileUploadIcon from '@mui/icons-material/FileUpload';
import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import WeekendIcon from "@mui/icons-material/Weekend";
import SettingsIcon from "@mui/icons-material/Settings";
import { matchMobile } from "./DetectDevice";
import { useNavigate, useLocation } from "react-router-dom";

import SearchIcon from '@mui/icons-material/Search';

import StarIcon from '@mui/icons-material/Star';

import { setLogin } from "./settingsSlice";


import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";

import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { DarkMode } from "@mui/icons-material";
import { m } from "framer-motion";

/**
 * The component now renders two completely independent layouts: textShadow
 *  - Desktop (unchanged from your original implementation)
 *  - Mobile (icons-only, 100% viewport height, shadows, larger icons)
 *
 * The decision is done once on each render via the `isMobile` constant, so
 * re-runs still react to window resize if your own `matchMobile` helper does.
 */
const MenuSlider: React.FC<any> = ({
    feedContainerRef,
    setFeeds,
    LastId,
    activeIndex,
    setActiveIndex,

    isFullscreen,
    type,

    setShowThumb,
    showGoUpload,
    setshowGoUpload,
    setminimisePrompt,
    setIsMenuOpen,
    setMenuOpenb
}) => {
    const theme = useTheme();
    const isMobile = matchMobile; // your helper already returns a boolean

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = location.state || {};

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const [menuItems, setmenuItems] = useState([
        { label: "Home", icon: <PlayCircleOutlineIcon /> },
        { label: "Create", icon: <AddCircleIcon /> },
        { label: "Games", icon: <TouchAppIcon /> },
        { label: "Shorts", icon: <PhotoIcon /> },
        { label: "Cinema", icon: <WeekendIcon /> },
        { label: "My Page", icon: <PersonIcon /> },
        { label: "All Feeds", icon: <HorizontalSplitIcon /> },
        { label: "HomePage", icon: <SearchIcon /> },
        { label: "Settings", icon: <SettingsIcon /> },
    ]);

    const [feedsOpen, setFeedsOpen] = useState(false);               // collapsed by default
    const collapsed = ['Shorts', 'Cinema'];          // the 3 rows to hide
    const iconTimeoutRefa = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);

    // keep menu items in-sync with Redux user state
    useEffect(() => {
        setmenuItems([
            { label: "Home", icon: <PlayCircleOutlineIcon /> },
            { label: "Create", icon: <AddCircleIcon /> },
            { label: "Games", icon: <TouchAppIcon /> },
            { label: "Shorts", icon: <PhotoIcon /> },
            { label: "Cinema", icon: <WeekendIcon /> },
            { label: "My Page", icon: <PersonIcon /> },
            { label: "All Feeds", icon: <HorizontalSplitIcon /> },
            { label: "HomePage", icon: <SearchIcon /> },
            { label: "Settings", icon: <SettingsIcon /> },
        ]);
    }, [loggedUser]);

    // Dynamically check if a route is active based on location.pathname
    const getIsActive = (label: string) => {
        const path = location.pathname.toLowerCase();

        if (label === 'HomePage' && (path === '/' || path === '')) return true;
        if (label === 'Home' && path.includes('/magicmirror')) return true;
        if (label === 'My Page' && path.includes('/pages')) return true;
        if (label === 'All Feeds' && path.includes('/feeds')) return true;
        if (label === 'Games' && path.includes('/clikit')) return true;
        if (label === 'Cinema' && path.includes('/kickit')) return true;
        if (label === 'Shorts' && path.includes('/images')) return true;
        if (label === 'Settings' && path.includes('/settings')) return true;

        return false;
    };


    const [showbut, setshowbut] = useState(false);
    const iconTimeoutRefaxa = useRef<NodeJS.Timeout | null>(null);



    useEffect(() => {

        setshowbut(true);



        if (iconTimeoutRefaxa.current) {
            clearTimeout(iconTimeoutRefaxa.current);
        }

        // Set a timeout to open the menu after 2 seconds
        iconTimeoutRefaxa.current = setTimeout(() => {

            setshowbut(false);
        }, 5000)



    }, [])


    /**
     * Centralised click handler â€“ shared by desktop & mobile render paths.
     */


    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    // put near the top of the file
    const ICON_COLORS = {
        light: {
            'All Feeds': 'red', // violet-600
            'Games': '#2563EB', // blue-600
            'Shorts': '#16A34A', // green-600
            'Cinema': '#D97706', // amber-600
        },
        dark: {
            'All Feeds': 'red', // violet-300
            'Games': '#60A5FA', // blue-300
            'Shorts': '#4ADE80', // green-300
            'Cinema': '#FBBF24', // amber-300
        },
    } as const;

    const getIconColor = (
        label: string,
        darkMode: boolean,
        feedsOpen: boolean
    ) => {
        if (!feedsOpen) return undefined;
        const mode = darkMode ? 'dark' : 'light';
        return ICON_COLORS[mode][label as keyof typeof ICON_COLORS['light']];
    };


    useEffect(
        () => {


            if (iconTimeoutRefa.current) {
                clearTimeout(iconTimeoutRefa.current);
            }



            iconTimeoutRefa.current = setTimeout(() => { setFeedsOpen(false) }, 20000);

        }, [location.pathname, feedsOpen]
    )


    useEffect(
        () => {


            if (iconTimeoutRefax.current) {
                clearTimeout(iconTimeoutRefax.current);
            }

            ///  setFeedsOpen(true)

            ///  iconTimeoutRefax.current = setTimeout(() => { setFeedsOpen(false) }, 2000);

        }, [location.pathname]
    )

    const handleItemClick = useCallback(
        (index: number) => {
            let delay = 20;
            if (isFullscreen) {
                delay = 1000;
                window.history.back();
            }

            setTimeout(() => {
                const clickedItem = menuItems[index];
                let targetPath = "";
                switch (clickedItem.label) {

                    case "HomePage":
                        targetPath = "/";
                        break;
                    case "Home":
                        targetPath = "/MagicMirror";
                        if (setMenuOpenb) setMenuOpenb(false);
                        break;
                    case "My Page":
                        targetPath = "/pages";
                        break;
                    case "All Feeds":
                        targetPath = "/Feeds";
                        break;
                    case "Games":
                        targetPath = "/clikit";
                        break;
                    case "Cinema":
                        targetPath = "/kickit";
                        break;
                    case "Shorts":
                        targetPath = "/images";
                        break;
                    case "Settings":
                        targetPath = "/settings";
                        break;
                    default:
                        break;
                }

                // If already there and it is the user page â€“ reload
                if (
                    location.pathname === targetPath &&
                    loggedUser &&
                    userId === loggedUser.id
                ) {

                    if (feedsOpen) {
                        navigate(location.pathname, {
                            state: {
                                routeScrollPos: null,
                                routelastId: null,
                                userId: userId || null,
                            },
                            replace: true,
                        });
                        window.location.reload();
                        return;
                    }
                }

                // Save scroll state, etc., then navigate
                const feedScrollPos = feedContainerRef.current?.scrollTop ?? 0;
                setActiveIndex(index);

                setTimeout(() => {
                    navigate(targetPath, {
                        state: { userId: loggedUser?.id },
                    });
                }, 100);
            }, delay);
        },
        [
            LastId,
            feedContainerRef,
            location.pathname,
            loggedUser?.id,
            menuItems,
            navigate,
            userId,
            isFullscreen,
            feedsOpen
        ]
    );

    /**
     * Shared shadow style â€“ tuned for both light & dark mode.
     */
    const handleCreateClick = useCallback(() => {
        setminimisePrompt((prev: boolean) => !prev);

        const path = location.pathname.toLowerCase();
        const isCreationPage = ["/clikit", "/kickit", "/images"].some((route) =>
            path.includes(route)
        );

        if (!isCreationPage) {
            navigate("/images");
        }
    }, [location.pathname, navigate, setminimisePrompt]);

    const shadowStyle = {
        boxShadow:
            theme.palette.mode === "dark"
                ? darkModeReducer ? "0 0 10px rgba(255,255,255,0.25)" : "0 0 10px rgba(255,255,255,0.15)"
                : darkModeReducer ? "0 0 10px rgba(0,0,0,0.15)" : "0 0 10px rgba(0,0,0,0.05)",
    } as const;

    /* -------------------------------------------------------------------------- */
    /*                              MOBILE RENDERING                              */
    /* -------------------------------------------------------------------------- */
    /* 1ï¸âƒ£  â€” put this near the other â€œhelperâ€ styles */
    const strongShadow = darkModeReducer ? '0px 2px 6px rgba(0,0,0,0.48)' : '0px 2px 6px rgba(0,0,0,0.08)';

    /* -------------------------------------------------------------------------- */
    /*                              MOBILE RENDERING                              */
    /* -------------------------------------------------------------------------- */


    /* -------------------------------------------------------------------------- */
    /*                               MOBILE RENDERING                             */
    /* -------------------------------------------------------------------------- */
    if (isMobile || type === 1) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: matchMobile ? '100dvh' : '100dvh',
                    // container scroll
                    backgroundColor: darkModeReducer ? "rgba(25,25,25,0.25)" : "rgba(255,255,255,0.25)",
                    color: darkModeReducer ? "#ffffff" : "#000000",
                    backdropFilter: "blur(24px) saturate(120%)",
                    p: 0,

                    borderRadius: 0,

                    overflowX: 'hidden',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch',
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
                {/* ðŸ‘‡  just let the Stack itself scroll instead of hiding overflow */}

                {import.meta.env.VITE_APPX_STATE !== 'prod' && (
                    <Button
                        variant="outlined"
                        size="medium"
                        sx={{
                            position: 'absolute',
                            top: '2vh',
                            margin: 'auto',
                            left: '0.7vw',
                            minWidth: 110,

                            visibility: showbut ? 'visible' : 'hidden',
                            borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                            bgcolor: darkModeReducer ? 'rgba(232,186,250,0.14)' : 'rgba(255,255,255,0.9)',
                            color: darkModeReducer ? '#E8BAFA' : '#0099cc',
                            fontWeight: 800,
                            backdropFilter: 'blur(14px) saturate(130%)',
                            boxShadow: darkModeReducer
                                ? '0 8px 24px rgba(0,0,0,0.32)'
                                : '0 8px 24px rgba(0,153,204,0.18)',
                            textShadow: 'none',
                            '& .MuiButton-startIcon': {
                                color: darkModeReducer ? '#E8BAFA' : '#0099cc',
                            },
                            '&:hover': {
                                bgcolor: darkModeReducer ? 'rgba(232,186,250,0.24)' : 'rgba(0,153,204,0.12)',
                                borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                color: darkModeReducer ? '#ffffff' : '#0077a0',
                                textShadow: 'none',
                            },
                            '&:active': {
                                bgcolor: darkModeReducer ? 'rgba(232,186,250,0.32)' : 'rgba(0,153,204,0.18)',
                                borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                color: darkModeReducer ? '#ffffff' : '#005d7d',
                                textShadow: 'none',
                            },
                        }}
                        onClick={() => {
                            setShowThumb(true)
                        }}
                        startIcon={<StarIcon />}
                    >
                        Thumbnail Creator
                    </Button>
                )}

                <Stack
                    direction="column"
                    spacing={0.5}
                    sx={{
                        height: '100%',
                        marginTop: '10vh',
                        px: 1.5,
                        width: '100%',
                        boxSizing: 'border-box'
                    }}
                >
                    {menuItems.map((item, index) => {
                        const isActive = getIsActive(item.label);
                        const isProfile = item.label === 'My Page';
                        const isLogin = isProfile && loggedUser && loggedUser.id === 1;

                        const activeColor = darkModeReducer ? "#E8BAFA" : "#0099cc";
                        const isFullyActive = isActive && (item.label !== 'My Page' ? true : (!userId || userId === 0 || (loggedUser && userId === loggedUser.id)));

                        return (
                            <Box
                                key={index}
                                sx={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 3,
                                    transition: 'all 0.2s ease',
                                    backgroundColor: isFullyActive ? (darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)') : 'transparent',
                                    border: isFullyActive ? (darkModeReducer ? '1px solid rgba(232, 186, 250, 0.16)' : '1px solid rgba(255,255,255,0.95)') : '1px solid transparent',
                                    boxShadow: isFullyActive && !darkModeReducer ? '0 8px 22px rgba(0,0,0,0.08)' : 'none',
                                    '&:hover': {
                                        backgroundColor: isFullyActive
                                            ? (darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)')
                                            : (darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                                    },
                                    ...(isFullyActive && { transform: 'scale(1.02)' })
                                }}
                                onClick={() => {
                                    if (item.label === 'Create') {
                                        handleCreateClick();
                                    } else {
                                        isLogin ? navigate('/MagicMirror') : handleItemClick(index);
                                    }
                                }}
                            >
                                {/* --- ICON CONTAINER (fixed width) --- */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 44,
                                        height: 44,
                                        mr: 2,
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        ...(isFullyActive && {
                                            backgroundColor: darkModeReducer ? 'rgba(232, 186, 250, 0.1)' : 'rgba(0, 153, 204, 0.1)',
                                        })
                                    }}
                                >
                                    {isProfile ? (
                                        <img
                                            src={loggedUser ? `${loggedUser.image}` : ''}
                                            alt="My profile"
                                            style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: isFullyActive ? `2px solid ${activeColor}` : '2px solid transparent'
                                            }}
                                        />
                                    ) : (
                                        (() => {
                                            const iconColor = (item.label === 'Create' && !feedsOpen)
                                                ? activeColor
                                                : getIconColor(item.label, darkModeReducer, feedsOpen);

                                            return React.cloneElement(item.icon, {
                                                sx: {
                                                    fontSize: 26,
                                                    color: isFullyActive ? activeColor : (iconColor || (darkModeReducer ? "#ffffff" : "#000000")),
                                                    transition: 'color 0.2s ease',
                                                    filter: darkModeReducer
                                                        ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                                        : 'none',
                                                },
                                            });
                                        })()
                                    )}
                                </Box>

                                {/* --- TEXT CONTAINER --- */}
                                <Typography
                                    variant="body1"
                                    noWrap
                                    sx={{
                                        flex: 1,
                                        fontWeight: isFullyActive ? 700 : 500,
                                        fontSize: '0.9rem',
                                        letterSpacing: '0.01em',
                                        color: isFullyActive ? activeColor : (darkModeReducer ? "#ffffff" : "#000000"),
                                        textShadow: darkModeReducer
                                            ? '0px 1px 3px rgba(0,0,0,0.5)'
                                            : 'none',
                                        transition: 'color 0.2s ease'
                                    }}
                                >
                                    {isLogin ? 'Login' : item.label === 'HomePage' ? 'Search' : item.label}
                                </Typography>
                            </Box>
                        );
                    })}
                </Stack>

                <Box style={{ height: '15vh', width: '100%' }}></Box >
            </Box >
        );
    }



    /* -------------------------------------------------------------------------- */
    /*                             DESKTOP RENDERING                              */
    /* -------------------------------------------------------------------------- */
    return (
        <Stack direction="column" spacing={1} sx={{
            py: 1,
            height: '44vh',
            backgroundColor: 'transparent',
            backdropFilter: "blur(40px)",
            borderRadius: 2,
            boxShadow: theme.palette.mode === "dark"
                ? darkModeReducer ? "0 0 10px rgba(255,255,255,0.25)" : "0 0 10px rgba(255,255,255,0.15)"
                : darkModeReducer ? "0 0 10px rgba(0,0,0,0.15)" : "0 0 10px rgba(0,0,0,0.05)",
            overflowX: 'hidden',
            overflowY: 'auto',
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
        }}>
            {menuItems.map((item, index) => {
                const isActive = getIsActive(item.label);
                        const isProfile = item.label === 'My Page';
                        const isLogin = isProfile && loggedUser && loggedUser.id === 1;

                        const activeColor = darkModeReducer ? "#E8BAFA" : "#0099cc";
                        const isFullyActive = isActive && (item.label !== 'My Page' ? true : (!userId || userId === 0 || (loggedUser && userId === loggedUser.id)));

                return (
                    <Box
                        key={index}
                        onClick={() => {
                            if (item.label === 'Create') {
                                handleCreateClick();
                            } else {
                                isLogin ? navigate('/MagicMirror') : handleItemClick(index);
                            }
                        }}
                        sx={{
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            width: "100%",
                            px: 2.5,
                            py: 1,
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            backgroundColor: isFullyActive ? (darkModeReducer ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent',
                            "&:hover": {
                                backgroundColor: darkModeReducer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                            },
                        }}
                    >
                        {/* --- ICON CONTAINER (fixed width) --- */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 36,
                                height: 36,
                                mr: 1.5,
                                borderRadius: '50%',
                                flexShrink: 0,
                                ...(isFullyActive && {
                                    backgroundColor: darkModeReducer ? 'rgba(232, 186, 250, 0.1)' : 'rgba(0, 153, 204, 0.1)',
                                })
                            }}
                        >
                            {isProfile ? (
                                <img
                                    src={loggedUser ? `${loggedUser.image}` : ''}
                                    alt="My profile"
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: isFullyActive ? `2px solid ${activeColor}` : '2px solid transparent'
                                    }}
                                />
                            ) : (
                                (() => {
                                    const iconColor = (item.label === 'Create' && !feedsOpen)
                                        ? activeColor
                                        : getIconColor(item.label, darkModeReducer, feedsOpen);

                                    return React.cloneElement(item.icon, {
                                        sx: {
                                            fontSize: 22,
                                            color: isFullyActive ? activeColor : (iconColor || (darkModeReducer ? "#ffffff" : "#000000")),
                                            transition: 'color 0.2s ease',
                                        },
                                    });
                                })()
                            )}
                        </Box>

                        {/* --- TEXT CONTAINER --- */}
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{
                                flex: 1,
                                fontWeight: isFullyActive ? 800 : 600,
                                fontSize: '0.95rem',
                                color: isFullyActive ? activeColor : (darkModeReducer ? "#ffffff" : "#000000"),
                                transition: 'color 0.2s ease'
                            }}
                        >
                            {isLogin ? 'Login' : item.label === 'HomePage' ? 'Search' : item.label}
                        </Typography>
                    </Box>
                );
            })}
        </Stack>


    );
};

export default MenuSlider;
