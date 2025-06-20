import React, { useState, useCallback, useEffect } from "react";
import { Box, Typography, Stack, useTheme } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import WeekendIcon from "@mui/icons-material/Weekend";
import SettingsIcon from "@mui/icons-material/Settings";
import { matchMobile } from "./DetectDevice";
import { useNavigate, useLocation } from "react-router-dom";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import { DarkMode } from "@mui/icons-material";
import { m } from "framer-motion";

/**
 * The component now renders two completely independent layouts:
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
    setx,
    isFullscreen,
    type,
    x
}) => {
    const theme = useTheme();
    const isMobile = matchMobile; // your helper already returns a boolean

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = location.state || {};

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const [menuItems, setmenuItems] = useState([
        { label: "My Page", icon: <PersonIcon /> },
        { label: "Interactions", icon: <TouchAppIcon /> },
        { label: "Stories", icon: <WeekendIcon /> },
        { label: "Memes", icon: <PhotoIcon /> },
        // { label: "Audio Gpt", icon: <MusicNoteIcon /> },
        { label: "Settings", icon: <SettingsIcon /> },
    ]);

    // keep menu items in-sync with Redux user state
    useEffect(() => {
        setmenuItems([
            { label: "My Page", icon: <PersonIcon /> },
            { label: "Interactions", icon: <TouchAppIcon /> },
            { label: "Stories", icon: <WeekendIcon /> },
            { label: "Memes", icon: <PhotoIcon /> },
            { label: "Settings", icon: <SettingsIcon /> },
        ]);
    }, [loggedUser]);



    /**
     * Centralised click handler – shared by desktop & mobile render paths.
     */


    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);



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
                    case "My Page":
                        targetPath = "/pages";
                        break;
                    case "Interactions":
                        targetPath = "/clikit";
                        break;
                    case "Stories":
                        targetPath = "/";
                        break;
                    case "Memes":
                        targetPath = "/images";
                        break;
                    case "Settings":
                        targetPath = "/settings";
                        break;
                    default:
                        break;
                }

                // If already there and it is the user page – reload
                if (
                    location.pathname === targetPath &&
                    loggedUser &&
                    userId === loggedUser.id
                ) {
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
        ]
    );

    /**
     * Shared shadow style – tuned for both light & dark mode.
     */
    const shadowStyle = {
        boxShadow:
            theme.palette.mode === "dark"
                ? darkModeReducer ? "0 0 10px rgba(255,255,255,0.25)" : "0 0 10px rgba(255,255,255,0.15)"
                : darkModeReducer ? "0 0 10px rgba(0,0,0,0.15)" : "0 0 10px rgba(0,0,0,0.05)",
    } as const;

    /* -------------------------------------------------------------------------- */
    /*                              MOBILE RENDERING                              */
    /* -------------------------------------------------------------------------- */
    /* 1️⃣  — put this near the other “helper” styles */
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
                    height: matchMobile ? '91vh' : '93.5vh',
                    // container scroll
                    backgroundColor: darkModeReducer ? 'rgba(30, 30, 30, 0.2)' : 'rgba(244, 244, 244, 0.22)',
                    color: darkModeReducer ? "#ffffff" : "#000000",
                    backdropFilter: "blur(40px)",
                    p: 0,

                    borderRadius: 0,

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
                }}
            >
                {/* 👇  just let the Stack itself scroll instead of hiding overflow */}
                <Stack
                    direction="column"
                    spacing={3}
                    sx={{
                        height: '100%',
                        marginTop: '16vh',

                        // ⬅️ change -- was "hidden"
                        pr: 1,                      // little padding so scrollbar isn’t flush
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                    }}
                >
                    {menuItems.map((item, index) => {
                        const isActive = activeIndex === index;
                        return (
                            /* ...everything inside stays identical... */

                            <Box
                                key={index}
                                sx={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    px: 2,
                                    py: 0,
                                    borderRadius: 1,
                                    // backgroundColor: 'rgba(0,0,0,0.5)',


                                    ...(loggedUser ? activeIndex === index && loggedUser.id === userId ? {
                                        transform: isActive ? 'scale(1.3)' : matchMobile ? 'scale(1.05)' : 'scale(1.1)',
                                    } : null : null),


                                    '&:hover': { backgroundColor: darkModeReducer ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)' },
                                }}
                                onClick={() => handleItemClick(index)}
                            >
                                {/* --- ICON ---------------------------------------------------- */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 56,
                                        height: 56,
                                        borderRadius: '50%',
                                        transition: 'all 0.2s ease',
                                        color: darkModeReducer ? '#ffffff' : '#000000',



                                        ...(loggedUser ? activeIndex === index && loggedUser.id === userId ? {
                                            backgroundColor: darkModeReducer ? 'rgb(10,10,10,0.1)' : 'rgb(240,240,240,0.1)',
                                            ml: '3.5vw',
                                        } : null : null),

                                        ...shadowStyle,                      // your existing subtle shadow
                                        filter: `drop-shadow(${strongShadow})`, // <-- NEW: strong icon shadow
                                        '&:hover': { transform: 'scale(1.08)' },
                                    }}
                                >
                                    {/* ⬇️  swap the first icon for the user’s image */}
                                    {item.label === 'My Page' ? (
                                        <img
                                            src={loggedUser ? `${loggedUser.image}` : ''}
                                            alt="My profile"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    ) : (
                                        React.cloneElement(item.icon, { sx: { fontSize: 32 } })
                                    )}
                                </Box>


                                {/* --- LABEL --------------------------------------------------- */}
                                <Typography
                                    variant="body1"
                                    noWrap
                                    sx={{
                                        ml: '20px',
                                        fontWeight: 900,
                                        textShadow: strongShadow,


                                        ...(
                                            loggedUser ? activeIndex === index ?
                                                userId > 0 ?
                                                    userId === loggedUser.id ?
                                                        {
                                                            background:
                                                                darkModeReducer ? "linear-gradient(90deg, #F6BB56,#ffffff)" :
                                                                    "linear-gradient(90deg, #F6BB56,#000000)",
                                                            WebkitBackgroundClip: "text",
                                                            WebkitTextFillColor: "transparent",
                                                        } : null
                                                    : {
                                                        background:
                                                            darkModeReducer ? "linear-gradient(90deg, #F6BB56,#ffffff)" :
                                                                "linear-gradient(90deg, #F6BB56,#000000)",
                                                        WebkitBackgroundClip: "text",
                                                        WebkitTextFillColor: "transparent",
                                                    }

                                                : null : null),        // <-- NEW: strong text shadow
                                    }}
                                >
                                    {item.label}
                                </Typography>
                            </Box>

                        );
                    })
                    }
                </Stack >
            </Box >
        );
    }



    /* -------------------------------------------------------------------------- */
    /*                             DESKTOP RENDERING                              */
    /* -------------------------------------------------------------------------- */
    return (
        <Box
            sx={{
                width: "100%",
                height: "40vh",
                overflowY: "auto",
                mt: 2,
                "&::-webkit-scrollbar": {
                    width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                    background: "#888",
                    borderRadius: "4px",
                },
            }}
        >
            <Stack direction="column" spacing={1} sx={{ py: 1 }}>
                {menuItems.map((item, index) => (
                    <Box
                        key={index}
                        onClick={() => {
                            if (loggedUser && loggedUser.id === 1 && index === 0) {
                                handleItemClick(index);
                            } else {
                                handleItemClick(index);
                            }
                        }}
                        sx={{
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            px: 3,
                            py: 1.1,
                            borderRadius: 1,
                            "&:hover": {
                                backgroundColor: "rgba(0,0,0,0.1)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                fontSize: 24,
                                display: "flex",
                                alignItems: "center",
                                mr: 3.3,
                            }}
                        >
                            {item.icon}
                        </Box>

                        <Typography
                            variant="body1"
                            noWrap
                            sx={{
                                fontWeight: 700,
                                ...(
                                    loggedUser ? activeIndex === index ?
                                        userId > 0 ?
                                            userId === loggedUser.id ?
                                                {
                                                    background:
                                                        darkModeReducer ? "linear-gradient(90deg, #F6BB56,#ffffff)" :
                                                            "linear-gradient(90deg, #F6BB56,#000000)",
                                                    WebkitBackgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                } : null
                                            : {
                                                background:
                                                    darkModeReducer ? "linear-gradient(90deg, #F6BB56,#ffffff)" :
                                                        "linear-gradient(90deg, #F6BB56,#000000)",
                                                WebkitBackgroundClip: "text",
                                                WebkitTextFillColor: "transparent",
                                            }

                                        : null : null),
                            }}
                        >
                            {item.label}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
};

export default MenuSlider;
