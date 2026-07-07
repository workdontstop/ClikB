import React, { useState, useCallback, useEffect, FC } from "react";
import { Box, Collapse } from '@mui/material';
import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';
import WidgetsIcon from "@mui/icons-material/Widgets";

import SearchIcon from '@mui/icons-material/Search';

import NotificationsIcon from '@mui/icons-material/Notifications';

import FilterListIcon from '@mui/icons-material/FilterList';
import MenuIcon from '@mui/icons-material/Menu';


import PersonIcon from "@mui/icons-material/Person";
import PublicIcon from '@mui/icons-material/Public';

import TuneIcon from '@mui/icons-material/Tune';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import FileUploadIcon from '@mui/icons-material/FileUpload';


import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import WeekendIcon from "@mui/icons-material/Weekend";
import SettingsIcon from "@mui/icons-material/Settings";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";

import { useNavigate, useLocation } from "react-router-dom";


import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit';

interface TogglePromptButtonProps {
    type: number;
    minimisePrompt: boolean;
    setminimisePrompt: React.Dispatch<React.SetStateAction<boolean>>;

    matchMobile: boolean;
    allowUploadText: boolean;
    isMenuOpen: boolean;
    darkModeReducer: boolean;
    setMenuOpenb: any;
    setIsMenuOpen: any;
    MenuOpenb: any
    textActive: any
}

const TogglePromptButton: React.FC<any> = ({
    minimisePrompt,
    setminimisePrompt,
    setMenuOpenb,
    setIsMenuOpen,
    matchMobile,
    allowUploadText,
    isMenuOpen,
    darkModeReducer,
    type,
    MenuOpenb,
    textActive,
    setshowGoUpload,
    LastId,
    feedContainerRef,
    isFullscreen,
    setActiveIndex
}) => {


    if (!minimisePrompt) return null;


    const [zoom1x, setZoom1x] = useState(false);

    const [zoom2x, setZoom2x] = useState(false);

    const [zoom3x, setZoom3x] = useState(false);

    const [zoom4x, setZoom4x] = useState(false);

    const [zoom5x, setZoom5x] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();


    const dispatch = useDispatch();

    const { userId } = location.state || {};

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);



    const [more, setmore] = useState(false);

    var color = darkModeReducer ? '#E8BAFA' : '#0099cc';


    const [urlName, setUrlName] = useState(location.pathname); // initial value

    useEffect(() => {
        setUrlName(location.pathname);
    }, [location.pathname]); // runs whenever either changes



    useEffect(() => {
        if (!more) return;                 // only run when it just became true

        const id = setTimeout(() => setmore(false), 12000);

        return () => clearTimeout(id);     // cleanup if `more` changes/unmounts
    }, [more]);

    const [menuItems, setmenuItems] = useState([
        { label: "Create", icon: <AddCircleIcon /> },

        { label: "HomePage", icon: <PublicIcon /> },
        { label: "My Page", icon: <PersonIcon /> },
        { label: "All Feeds", icon: <HorizontalSplitIcon /> },
        { label: "Interactions", icon: <TouchAppIcon /> },
        { label: "Stories", icon: <WeekendIcon /> },
        { label: "Memes", icon: <PhotoIcon /> },
        // { label: "Audio Gpt", icon: <MusicNoteIcon /> },
        { label: "Settings", icon: <SettingsIcon /> },
    ]);

    // 1) Single color map (light/dark) for ALL labels you render
    const UI_COLORS = {
        light: {
            'All Feeds': '#0099cc',
            'Interactions': '#0099cc',
            'Stories': '#0099cc',
            'Memes': '#0099cc',
            'Create': '#0099cc',
            'Search': '#0099cc',
            'Notifications': '#0099cc',
        },
        dark: {
            'All Feeds': '#E8BAFA',
            'Interactions': '#E8BAFA',
            'Stories': '#E8BAFA',
            'Memes': '#E8BAFA',
            'Create': '#E8BAFA',
            'Search': '#E8BAFA',
            'Notifications': '#E8BAFA',
        },
    } as const;

    type UiLabel = keyof typeof UI_COLORS['light'];

    // 2) Generic color getter that works for ANY label above
    const getUiColor = (label: UiLabel, darkMode: boolean) => {
        const mode = darkMode ? 'dark' : 'light';
        return UI_COLORS[mode][label];
    };

    // (optional) Safe version if you sometimes pass arbitrary strings
    const getUiColorSafe = (label: string, darkMode: boolean, fallback: string) => {
        const mode = darkMode ? 'dark' : 'light';
        const table = UI_COLORS[mode] as Record<string, string>;
        return table[label] ?? fallback;
    };




    // keep menu items in-sync with Redux user state
    useEffect(() => {
        setmenuItems([
            { label: "Create", icon: <AddCircleIcon /> },
            { label: "HomePage", icon: <PublicIcon /> },
            { label: "My Page", icon: <PersonIcon /> },
            { label: "All Feeds", icon: <HorizontalSplitIcon /> },
            { label: "Interactions", icon: <TouchAppIcon /> },
            { label: "Stories", icon: <WeekendIcon /> },
            { label: "Memes", icon: <PhotoIcon /> },
            { label: "Settings", icon: <SettingsIcon /> },
        ]);
    }, [loggedUser]);







    const handleItemClick = useCallback(
        (index: number) => {
            let delay = 20;
            if (isFullscreen) {
                delay = 1000;
                window.history.back();
            }

            setTimeout(() => {
                /// alert(menuItems[index].label);
                const clickedItem = menuItems[index];
                let targetPath = "";
                switch (clickedItem.label) {

                    case "HomePage":
                        targetPath = "/";
                        break;
                    case "My Page":
                        targetPath = "/pages";
                        break;
                    case "All Feeds":
                        targetPath = "/Feeds";
                        break;
                    case "Interactions":
                        targetPath = "/clikit";
                        break;
                    case "Stories":
                        targetPath = "/kickit";
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

                // If already there and it is the user page â€“ reload
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
                //  setActiveIndex(index);

                // alert('kk');

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



    return (

        <>


            {type === 1 || type === 2 || type === 3 || type === 4 ?

                <>


                    <Box
                        onMouseEnter={() => setZoom1x(true)}
                        onMouseOver={() => setZoom1x(true)}
                        onMouseLeave={() => setZoom1x(false)}
                        onTouchStart={() => setZoom1x(true)}
                        onTouchEnd={() => setZoom1x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom1x(true);
                                setTimeout(() => setZoom1x(false), 300);

                                ///   setminimisePrompt(false);

                                /// setmore(true)

                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                '82vw'
                                : isMenuOpen
                                    ? '95vw'
                                    : '93vw',

                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >



                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {(() => {
                                const label = more ? 'Search' : 'Create';
                                const iconColor = getUiColor(label as 'Create' | 'Search', darkModeReducer);

                                return (
                                    <>
                                        <Box
                                            className={`toggle-image ${zoom1x ? 'bounce' : ''}`}
                                            onClick={() => {
                                                if (more) {
                                                    navigate("/", { state: { userId: loggedUser?.id } });
                                                } else {
                                                    setminimisePrompt(false);
                                                }
                                            }}
                                            sx={{
                                                alignItems: 'center',
                                                gap: allowUploadText ? 1 : 0,
                                                width: allowUploadText ? 'auto' : 55,
                                                height: 55,
                                                px: allowUploadText ? 1.6 : 0,
                                                py: 0.4,
                                                borderRadius: allowUploadText ? 1 : '50%',
                                                bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                                backdropFilter: 'blur(4px)',
                                                boxShadow: darkModeReducer ? 3 : 'none',
                                                opacity: 0.7,
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: darkModeReducer ? 'rgba(100,100,100,0.3)' : 'rgba(250,250,250,0.3)',
                                                },
                                                display: 'inline-flex',
                                                transition: 'width 250ms ease, border-radius 250ms ease',
                                            }}
                                        >
                                            {more ? (
                                                <SearchIcon
                                                    sx={{
                                                        fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                                        color: iconColor,                 // <-- colored icon
                                                        textAlign: 'center',
                                                        margin: 'auto',
                                                    }}
                                                />
                                            ) : (
                                                <AddCircleIcon
                                                    sx={{
                                                        fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                                        color: iconColor,                 // <-- colored icon
                                                        textAlign: 'center',
                                                        margin: 'auto',
                                                    }}
                                                />
                                            )}
                                        </Box>


                                    </>
                                );
                            })()}
                        </Box>

                    </Box>

                    <Box
                        onMouseEnter={() => setZoom2x(true)}
                        onMouseOver={() => setZoom2x(true)}
                        onMouseLeave={() => setZoom2x(false)}
                        onTouchStart={() => setZoom2x(true)}
                        onTouchEnd={() => setZoom2x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom2x(true);
                                setTimeout(() => setZoom2x(false), 300);

                                handleItemClick(4);

                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                '63vw'
                                : isMenuOpen
                                    ? '90vw'
                                    : '88vw',
                            width: '100%',
                            display: more ? 'flex' : 'none',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >

                        {/* container so text sits BELOW the circle */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                                className={`toggle-image ${zoom2x ? 'bounce' : ''}`}
                                sx={{
                                    alignItems: 'center',
                                    gap: allowUploadText ? 1 : 0,
                                    width: allowUploadText ? 'auto' : 55,
                                    height: 55,
                                    px: allowUploadText ? 1.6 : 0,
                                    py: 0.4,
                                    borderRadius: allowUploadText ? 1 : '50%',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: darkModeReducer ? 3 : 'none',
                                    opacity: 0.7,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: darkModeReducer ? 'rgba(100,100,100,0.3)' : 'rgba(250,250,250,0.3)',
                                    },
                                    display: 'inline-flex',
                                    transition: 'width 250ms ease, border-radius 250ms ease',
                                }}
                            >
                                <TouchAppIcon
                                    sx={{
                                        fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                        // active route uses `color`, otherwise themed UI color
                                        color: urlName === '/clikit'
                                            ? color
                                            : (darkModeReducer ? '#E8BAFA' : '#0099cc'),
                                        textAlign: 'center',
                                        margin: 'auto',
                                    }}
                                />
                            </Box>


                        </Box>

                    </Box>

                    <Box
                        onMouseEnter={() => setZoom3x(true)}
                        onMouseOver={() => setZoom3x(true)}
                        onMouseLeave={() => setZoom3x(false)}
                        onTouchStart={() => setZoom3x(true)}
                        onTouchEnd={() => setZoom3x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom3x(true);
                                setTimeout(() => setZoom3x(false), 300);

                                handleItemClick(5);

                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                '43vw'
                                : isMenuOpen
                                    ? '85vw'
                                    : '83vw',
                            width: '100%',
                            display: more ? 'flex' : 'none',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >

                        {/* container so label is BELOW the circle */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                                className={`toggle-image ${zoom3x ? 'bounce' : ''}`}
                                sx={{
                                    alignItems: 'center',
                                    gap: allowUploadText ? 1 : 0,
                                    width: allowUploadText ? 'auto' : 55,
                                    height: 55,
                                    px: allowUploadText ? 1.6 : 0,
                                    py: 0.4,
                                    borderRadius: allowUploadText ? 1 : '50%',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: darkModeReducer ? 3 : 'none',
                                    opacity: 0.7,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: darkModeReducer ? 'rgba(100,100,100,0.3)' : 'rgba(250,250,250,0.3)',
                                    },
                                    display: 'inline-flex',
                                    transition: 'width 250ms ease, border-radius 250ms ease',
                                }}
                            >
                                <WeekendIcon
                                    sx={{
                                        fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                        // active route uses `color`, otherwise themed Stories color
                                        color: urlName === '/kickit'
                                            ? color
                                            : (darkModeReducer ? '#E8BAFA' : '#0099cc'),
                                        textAlign: 'center',
                                        margin: 'auto',
                                    }}
                                />
                            </Box>


                        </Box>

                    </Box>


                    <Box
                        onMouseEnter={() => setZoom4x(true)}
                        onMouseOver={() => setZoom4x(true)}
                        onMouseLeave={() => setZoom4x(false)}
                        onTouchStart={() => setZoom4x(true)}
                        onTouchEnd={() => setZoom4x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom4x(true);
                                setTimeout(() => setZoom4x(false), 300);

                                handleItemClick(6);

                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                '23vw'
                                : isMenuOpen
                                    ? '80vw'
                                    : '78vw',
                            width: '100%',
                            display: more ? 'flex' : 'none',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >

                        {/* container so label is BELOW the circle */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                                className={`toggle-image ${zoom4x ? 'bounce' : ''}`}
                                sx={{
                                    alignItems: 'center',
                                    gap: allowUploadText ? 1 : 0,
                                    width: allowUploadText ? 'auto' : 55,
                                    height: 55,
                                    px: allowUploadText ? 1.6 : 0,
                                    py: 0.4,
                                    borderRadius: allowUploadText ? 1 : '50%',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: darkModeReducer ? 3 : 'none',
                                    opacity: 0.7,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: darkModeReducer ? 'rgba(100,100,100,0.3)' : 'rgba(250,250,250,0.3)',
                                    },
                                    display: 'inline-flex',
                                    transition: 'width 250ms ease, border-radius 250ms ease',
                                }}
                            >
                                <PhotoIcon
                                    sx={{
                                        fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                        // active route uses `color`, otherwise themed Memes color
                                        color: urlName === '/images'
                                            ? color
                                            : (darkModeReducer ? '#E8BAFA' : '#0099cc'),
                                        textAlign: 'center',
                                        margin: 'auto',
                                    }}
                                />
                            </Box>


                        </Box>

                    </Box>


                    <Box
                        onMouseEnter={() => setZoom5x(true)}
                        onMouseOver={() => setZoom5x(true)}
                        onMouseLeave={() => setZoom5x(false)}
                        onTouchStart={() => setZoom5x(true)}
                        onTouchEnd={() => setZoom5x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom5x(true);
                                setTimeout(() => setZoom5x(false), 300);


                                if (more) {

                                    handleItemClick(3);

                                } else {


                                    setmore(true);
                                }


                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                more ? '4vw' : '63vw'
                                : isMenuOpen
                                    ? more ? '75vw' : '90vw'
                                    : more ? '73vw' : '88vw',


                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >

                        {/* container so label is BELOW the circle */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box
                                className={`toggle-image ${zoom5x ? 'bounce' : ''}`}
                                sx={{
                                    alignItems: 'center',
                                    gap: allowUploadText ? 1 : 0,
                                    width: allowUploadText ? 'auto' : 55,
                                    height: 55,
                                    px: allowUploadText ? 1.6 : 0,
                                    py: 0.4,
                                    borderRadius: allowUploadText ? 1 : '50%',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: darkModeReducer ? 3 : 'none',
                                    opacity: 0.7,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: darkModeReducer ? 'rgba(100,100,100,0.3)' : 'rgba(250,250,250,0.3)',
                                    },
                                    display: 'inline-flex',
                                    transition: 'width 250ms ease, border-radius 250ms ease',
                                }}
                            >
                                {more ? (
                                    <HorizontalSplitIcon
                                        sx={{
                                            fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                            // "All Feeds" themed color when expanded pink
                                            color: getUiColor ? getUiColor('All Feeds', darkModeReducer) : (darkModeReducer ? '#E8BAFA' : '#0099cc'),
                                            textAlign: 'center',
                                            margin: 'auto',
                                        }}
                                    />
                                ) : (urlName === '/Feeds' || urlName === '/feeds') ? (
                                    <HorizontalSplitIcon
                                        sx={{
                                            fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                            color, // active route highlight
                                            textAlign: 'center',
                                            margin: 'auto',
                                        }}
                                    />
                                ) : urlName === '/clikit' ? (
                                    <TouchAppIcon
                                        sx={{
                                            fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                            color, // active route highlight
                                            textAlign: 'center',
                                            margin: 'auto',
                                        }}
                                    />
                                ) : urlName === '/kickit' ? (
                                    <WeekendIcon
                                        sx={{
                                            fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                            color, // active route highlight
                                            textAlign: 'center',
                                            margin: 'auto',
                                        }}
                                    />
                                ) : urlName === '/images' ? (
                                    <PhotoIcon
                                        sx={{
                                            fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                            color, // active route highlight
                                            textAlign: 'center',
                                            margin: 'auto',
                                        }}
                                    />
                                ) : null}

                        </Box>

                        </Box>

                    </Box>
                </> : null}


            {type === 10 ?

                <>


                    <Box
                        onMouseEnter={() => setZoom1x(true)}
                        onMouseOver={() => setZoom1x(true)}
                        onMouseLeave={() => setZoom1x(false)}
                        onTouchStart={() => setZoom1x(true)}
                        onTouchEnd={() => setZoom1x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom1x(true);
                                setTimeout(() => setZoom1x(false), 300);

                                ///   setminimisePrompt(false);

                                /// setmore(true)

                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                '82vw'
                                : isMenuOpen
                                    ? '95vw'
                                    : '93vw',

                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >


                        <Box
                            className={`toggle-image ${zoom1x ? 'bounce' : ''}`}
                            onClick={() => {

                                alert('ðŸš§ Work in progress ðŸš§')
                            }}
                            sx={{
                                alignItems: 'center',
                                gap: allowUploadText ? 1 : 0,
                                width: allowUploadText ? 'auto' : 55,
                                height: 55,
                                px: allowUploadText ? 1.6 : 0,
                                py: 0.4,
                                borderRadius: allowUploadText ? 1 : '50%',
                                bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                backdropFilter: 'blur(4px)',
                                boxShadow: darkModeReducer ? 3 : 'none',
                                opacity: 0.7,
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: darkModeReducer
                                        ? 'rgba(100,100,100,0.3)'
                                        : 'rgba(250,250,250,0.3)',
                                },
                                display: 'inline-flex',
                                transition: 'width 250ms ease, border-radius 250ms ease',
                            }}
                        >
                            <SearchIcon
                                sx={{
                                    fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                    color: darkModeReducer ? '#fff' : '#000',
                                    textAlign: 'center',
                                    margin: 'auto',
                                }}
                            />

                        </Box>
                    </Box>

                    <Box
                        onMouseEnter={() => setZoom2x(true)}
                        onMouseOver={() => setZoom2x(true)}
                        onMouseLeave={() => setZoom2x(false)}
                        onTouchStart={() => setZoom2x(true)}
                        onTouchEnd={() => setZoom2x(false)}
                        onClick={() => {
                            if (type === 20) {
                                ///   setshowGoUpload(true);

                            } else {

                                setZoom2x(true);
                                setTimeout(() => setZoom2x(false), 300);

                                ///   setminimisePrompt(false);

                            }

                        }}
                        sx={{
                            height: '0vh',
                            position: 'fixed',
                            top: type === 20 ? matchMobile ?

                                textActive ? '25vh' : '16vh' :

                                textActive ? '20vh' : '13vh' :

                                matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh',
                            left: matchMobile
                                ?
                                '63vw'
                                : isMenuOpen
                                    ? '90vw'
                                    : '88vw',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >


                        <Box
                            className={`toggle-image ${zoom2x ? 'bounce' : ''}`}
                            onClick={() => {

                                alert('ðŸš§ Work in progress ðŸš§')
                            }}
                            sx={{
                                alignItems: 'center',
                                gap: allowUploadText ? 1 : 0,
                                width: allowUploadText ? 'auto' : 55,
                                height: 55,
                                px: allowUploadText ? 1.6 : 0,
                                py: 0.4,
                                borderRadius: allowUploadText ? 1 : '50%',
                                bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'rgba(250,250,250,0.2)',
                                backdropFilter: 'blur(4px)',
                                boxShadow: darkModeReducer ? 3 : 'none',
                                opacity: 0.7,
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: darkModeReducer
                                        ? 'rgba(100,100,100,0.3)'
                                        : 'rgba(250,250,250,0.3)',
                                },
                                display: 'inline-flex',
                                transition: 'width 250ms ease, border-radius 250ms ease',
                            }}
                        >
                            <NotificationsIcon

                                sx={{
                                    fontSize: matchMobile ? '1.5rem' : '1.625rem',
                                    color: darkModeReducer ? '#fff' : '#000',
                                    textAlign: 'center',
                                    margin: 'auto',
                                }}
                            />

                        </Box>
                    </Box>

                </> : null}


        </>
    );



};

export default TogglePromptButton;
