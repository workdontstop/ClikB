import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Typography, Stack, useTheme, Button, } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonIcon from "@mui/icons-material/Person";
import MenuIcon from '@mui/icons-material/Menu';



import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import FileUploadIcon from '@mui/icons-material/FileUpload';
import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import WeekendIcon from "@mui/icons-material/Weekend";
import CategoryIcon from "@mui/icons-material/Category";
import SettingsIcon from "@mui/icons-material/Settings";
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { SocialUnreadDot, useSocialChat } from './SocialChat';
import ClikBSocialWordmark from './ClikBSocialWordmark';
import ClikbaeIcon from './s.png';
import ClikbaeIcon2 from './s2.png';
import { getExecutingNavigationAction } from './navigationActionProvenance';
import { matchMobile } from "./DetectDevice";
import { useNavigate, useLocation } from "react-router-dom";
import { deckRouteTransition, openDeckCreation } from './useDeckNavigation';
import { useDeckRuntime } from './DeckRuntimeContext';

import SearchIcon from '@mui/icons-material/Search';

import StarIcon from '@mui/icons-material/Star';

import { setShowmenuToggle } from "./settingsSlice";


import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import { useNavigationViewport } from './useNavigationViewport';

import MusicNoteIcon from "@mui/icons-material/MusicNote";
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
    categoriesExpanded,
    onExpandCategories,
    feedContainerRef,
    setFeeds,
    LastId,
    activeIndex,
    setActiveIndex,

    isFullscreen,
    setIsFullscreen,
    type,

    setShowThumb,
    showThumb,
    showGoUpload,
    setshowGoUpload,
    setminimisePrompt,
    setIsMenuOpen,
    setMenuOpenb,
    isMenuOpen,
    MenuOpenb,
}) => {
    const theme = useTheme();
    const isMobile = matchMobile; // your helper already returns a boolean

    const dispatch = useDispatch();
    const deckRuntime = useDeckRuntime();
    const navigate = useNavigate();
    const location = useLocation();
    const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
    const composing = useSelector((state: RootState) => state.brainstorm.userSnapshot.ui.minimisePrompt === false && state.brainstorm.userSnapshot.creation.isActive !== false);
    const { open: openSocialChat, hasUnreadNotifications } = useSocialChat();
    const deckEnabledRef = useRef(deckEnabled);
    deckEnabledRef.current = deckEnabled;
    const { userId } = location.state || {};

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const [menuItems, setmenuItems] = useState([
        { label: "Create", icon: <AddCircleIcon /> },
        { label: "Games", icon: <TouchAppIcon /> },
        { label: "Shorts", icon: <PhotoIcon /> },
        { label: "Cinema", icon: <WeekendIcon /> },
        { label: "My Page", icon: <PersonIcon /> },
        { label: "All Feeds", icon: <HorizontalSplitIcon /> },
        { label: "HomePage", icon: <SearchIcon /> },
        { label: "Chat", icon: <ChatBubbleOutlineIcon /> },
        { label: "Settings", icon: <SettingsIcon /> },
    ]);

    const visibleMenuItems = menuItems.flatMap((item, index) => {
        if (categoriesExpanded) return [{ item, index }];
        if (item.label === "Games") {
            return [{ item: { label: "Categories", icon: <CategoryIcon /> }, index: -1 }];
        }
        if (item.label === "Shorts" || item.label === "Cinema") return [];
        return [{ item, index }];
    });
    const menuControlNames: Record<string, string> = {
        Create: 'create', Categories: 'categories', Games: 'games', Shorts: 'shorts', Cinema: 'cinema',
        'My Page': 'my_page_or_login', 'All Feeds': 'all_feeds', HomePage: 'search', Settings: 'settings', Chat: 'chat',
    };
    const menuRefreshKey = visibleMenuItems.map(({ item }) => item.label).join('|');
    const menuViewport = useNavigationViewport('vertical', menuRefreshKey);
    const previousSettledMenuViewport = useRef<{ region: string; visibleIds: string[]; settledAt: number | null } | null>(null);

    const [feedsOpen, setFeedsOpen] = useState(false);               // collapsed by default
    const collapsed = ['Shorts', 'Cinema'];          // the 3 rows to hide
    const iconTimeoutRefa = useRef<NodeJS.Timeout | null>(null);
    const iconTimeoutRefax = useRef<NodeJS.Timeout | null>(null);

    // keep menu items in-sync with Redux user state
    useEffect(() => {
        setmenuItems([
            { label: "Create", icon: <AddCircleIcon /> },
            { label: "Games", icon: <TouchAppIcon /> },
            { label: "Shorts", icon: <PhotoIcon /> },
            { label: "Cinema", icon: <WeekendIcon /> },
            { label: "My Page", icon: <PersonIcon /> },
            { label: "All Feeds", icon: <HorizontalSplitIcon /> },
            { label: "HomePage", icon: <SearchIcon /> },
            { label: "Chat", icon: <ChatBubbleOutlineIcon /> },
            { label: "Settings", icon: <SettingsIcon /> },
        ]);
    }, [loggedUser]);

    // Dynamically check if a route is active based on location.pathname
    const getIsActive = (label: string) => {
        const path = location.pathname.toLowerCase();
        
        if (label === 'HomePage' && path.includes('/search')) return true;
        if (label === 'My Page' && path.includes('/pages')) return true;
        if (label === 'All Feeds' && /^\/feeds\/?$/.test(path)) return true;
        if (label === 'Games' && path.includes('/clikit')) return true;
        if (label === 'Cinema' && path.includes('/kickit')) return true;
        if (label === 'Shorts' && path.includes('/images')) return true;
        if (label === 'Settings' && path.includes('/settings')) return true;
        
        return false;
    };


    const [showbut, setshowbut] = useState(false);
    const iconTimeoutRefaxa = useRef<NodeJS.Timeout | null>(null);
    const snapshotSource = `MenuSlider:${type === 1 ? 'compact_overlay' : isMobile ? 'mobile' : 'desktop_sidebar'}`;
    const menuVisible = type === 1 ? Boolean(!isMenuOpen && MenuOpenb) : Boolean(isMenuOpen);

    useEffect(() => {
        const current = menuViewport.viewport;
        if (!menuVisible || !current?.settledAt || current.isScrolling) return;
        const previous = previousSettledMenuViewport.current;
        if (previous?.settledAt === current.settledAt) return;
        previousSettledMenuViewport.current = current;
        if (!previous || (previous.region === current.region && previous.visibleIds.join('|') === current.visibleIds.join('|'))) return;
        dispatch(recordNavigationTransition({
            actor: 'unknown', kind: 'area',
            before: { route: location.pathname, areaId: 'clikb.navigation.menu', state: { scrollRegion: previous.region, visibleIds: previous.visibleIds.join(',') } },
            after: { route: location.pathname, areaId: 'clikb.navigation.menu', state: { scrollRegion: current.region, visibleIds: current.visibleIds.join(',') } },
            outcome: 'succeeded', authoritativeSource: 'MenuSlider scroll settlement',
        }));
    }, [dispatch, location.pathname, menuVisible, menuViewport.viewport]);

    useEffect(() => {
        if (!menuVisible) {
            dispatch(removeNavigationArea({ areaId: 'clikb.navigation.menu', source: snapshotSource }));
            return;
        }
        const areaId = 'clikb.navigation.menu';
        const visibleLabels = visibleMenuItems.map(({ item }) => item.label);
        dispatch(publishNavigationArea({
            areaId,
            source: snapshotSource,
            scrolls: menuViewport.viewport ? { menu_items: menuViewport.viewport } : undefined,
            state: {
                activeRoute: location.pathname.toLowerCase(),
                categoriesExpanded: Boolean(categoriesExpanded),
                guestEntry: loggedUser?.id === 1,
                layout: isMobile || type === 1 ? 'compact' : 'desktop',
                thumbnailCreatorOpen: Boolean(showThumb),
            },
            visibleControls: [
                ...visibleLabels.filter(label => !(label === 'Create' && composing)).map(label => navigationControl(
                    areaId, menuControlNames[label],
                    label === 'Categories' ? 'MenuSlider.onExpandCategories'
                        : label === 'Create' ? 'MenuSlider.handleCreateClick'
                            : label === 'My Page' && loggedUser?.id === 1 ? 'MenuSlider.handleLoginClick'
                                : 'MenuSlider.handleItemClick',
                )),
                ...(import.meta.env.VITE_APPX_STATE !== 'prod' && showbut && (isMobile || type === 1)
                    ? [navigationControl(areaId, 'thumbnail_creator', 'MenuSlider.setShowThumb(true)')]
                    : []),
            ],
        }));
    }, [dispatch, menuVisible, snapshotSource, categoriesExpanded, menuItems, location.pathname, loggedUser?.id, isMobile, type, showbut, showThumb, menuViewport.viewport, composing]);

    useEffect(() => () => {
        dispatch(removeNavigationArea({ areaId: 'clikb.navigation.menu', source: snapshotSource }));
    }, [dispatch, snapshotSource]);



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
     * Centralised click handler – shared by desktop & mobile render paths.
     */


    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? "#E8BAFA" : "#0099cc");
    const activeMenuColor = appColor;
    const createIconColor = darkModeReducer ? 'rgba(255, 0, 0, 0.8)' : '#E69500';


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
            if (menuItems[index]?.label === 'Chat') {
                const areaId = 'clikb.navigation.menu';
                dispatch(recordNavigationTransition({
                    actor: getExecutingNavigationAction() === `${areaId}.action.chat` ? 'ai' : 'manual',
                    kind: 'control',
                    before: { route: location.pathname, areaId },
                    after: { areaId, controlId: `${areaId}.control.chat` },
                    outcome: 'unknown',
                    authoritativeSource: 'MenuSlider Chat open request',
                }));
                if (isMobile) {
                    setIsMenuOpen(false);
                    setMenuOpenb(false);
                }
                openSocialChat();
                return;
            }
            let delay = 20;
            const isDirectExperienceRoute = /^\/experience\/[1-9]\d{0,14}\/?$/i.test(location.pathname);

            if (isFullscreen) {
                if (isDirectExperienceRoute) {
                    // A shared experience is opened fullscreen without adding a
                    // synthetic history entry. Close that local fullscreen state
                    // before routing; going back here could leave the site entirely.
                    setIsFullscreen(false);
                    dispatch(setShowmenuToggle(true));
                } else {
                    // Preserve the existing close flow for normal feed-card usage.
                    delay = 1000;
                    window.history.back();
                }
            }

            setTimeout(() => {
                const clickedItem = menuItems[index];
                let targetPath = "";
                switch (clickedItem.label) {

                    case "HomePage":
                        targetPath = "/search";
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

                // If already there and it is the user page – reload
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

                dispatch(recordNavigationTransition({
                    actor: 'manual', kind: 'control',
                    before: { route: location.pathname, areaId: 'clikb.navigation.menu' },
                    after: { route: targetPath, areaId: 'clikb.navigation.menu', controlId: `clikb.navigation.menu.control.${clickedItem.label === 'HomePage' ? 'search' : clickedItem.label === 'My Page' ? 'my_page_or_login' : clickedItem.label.toLowerCase().replace(/ /g, '_')}` },
                    outcome: 'unknown',
                    authoritativeSource: targetPath ? 'MenuSlider navigation request' : 'MenuSlider unmapped selection',
                    detail: targetPath ? 'Router location event establishes arrival' : 'No destination route mapped',
                }));

                setTimeout(() => {
                    const transition = deckRouteTransition(location, targetPath, { userId: loggedUser?.id }, { deckEnabled: deckEnabledRef.current });
                    navigate(transition.to, transition.options);
                }, 100);
            }, delay);
        },
        [
            LastId,
            feedContainerRef,
            location.pathname,
            location.state,
            location.search,
            location.hash,
            loggedUser?.id,
            menuItems,
            openSocialChat,
            isMobile,
            setIsMenuOpen,
            setMenuOpenb,
            navigate,
            userId,
            isFullscreen,
            setIsFullscreen,
            feedsOpen,
            dispatch,
        ]
    );

    /**
     * Shared shadow style – tuned for both light & dark mode.
     */
    const handleCreateClick = useCallback(() => {
        const path = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
        const isCreationPage = ['/', '/feeds', '/images', '/clikit', '/kickit'].includes(path);
        openDeckCreation(location, navigate, deckRuntime.openCreate, deckEnabled);
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.navigation.menu' },
            after: { route: isCreationPage ? location.pathname : '/images', areaId: 'clikb.navigation.menu', controlId: 'clikb.navigation.menu.control.create' },
            outcome: isCreationPage ? 'succeeded' : 'unknown',
            authoritativeSource: isCreationPage ? 'MenuSlider prompt-state handler' : 'MenuSlider navigation request',
            detail: isCreationPage ? 'Prompt opening requested' : 'Router location event establishes arrival',
        }));
    }, [dispatch, location, navigate, deckRuntime.openCreate, deckEnabled]);

    const handleCategoriesClick = useCallback(() => {
        onExpandCategories();
        if (categoriesExpanded) return;
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'area',
            before: { route: location.pathname, areaId: 'clikb.navigation.menu', state: { categoriesExpanded: Boolean(categoriesExpanded) } },
            after: { route: location.pathname, areaId: 'clikb.navigation.menu', controlId: 'clikb.navigation.menu.control.categories', state: { categoriesExpanded: true } },
            outcome: 'succeeded', authoritativeSource: 'MenuSlider categories expansion handler',
        }));
    }, [categoriesExpanded, dispatch, location.pathname, onExpandCategories]);

    const handleLoginClick = useCallback(() => {
        deckRuntime.requestCreationDeck();
        setminimisePrompt(false);

        if (isMobile) {
            setIsMenuOpen(false);
        }

        const path = location.pathname.toLowerCase();
        const isCreationPage = ["/clikit", "/kickit", "/images"].some((route) =>
            path.includes(route)
        );

        if (!isCreationPage) {
            navigate("/images");
        }
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.navigation.menu' },
            after: { route: isCreationPage ? location.pathname : '/images', areaId: 'clikb.navigation.menu', controlId: 'clikb.navigation.menu.control.my_page_or_login', state: { promptOpen: true } },
            outcome: isCreationPage ? 'succeeded' : 'unknown',
            authoritativeSource: isCreationPage ? 'MenuSlider guest-entry prompt handler' : 'MenuSlider guest-entry navigation request',
            detail: isCreationPage ? 'Creation/auth entry opened; authentication not established' : 'Router location event establishes arrival; authentication not established',
        }));
    }, [dispatch, isMobile, location.pathname, navigate, setIsMenuOpen, setminimisePrompt, deckRuntime.requestCreationDeck]);

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
    /*                               MOBILE & OVERLAY RENDERING                   */
    /* -------------------------------------------------------------------------- */
    if (isMobile || type === 1) {
        const isVeryDarkAccent = (() => {
            if (!activeMenuColor || activeMenuColor === '#101010' || activeMenuColor === '#000000') return true;
            const c = activeMenuColor.replace('#', '');
            if (c.length === 6) {
                const r = parseInt(c.slice(0, 2), 16);
                const g = parseInt(c.slice(2, 4), 16);
                const b = parseInt(c.slice(4, 6), 16);
                return (0.299 * r + 0.587 * g + 0.114 * b) < 90;
            }
            return false;
        })();

        // Subtle frosted glass look that reflects the app color indicator without drawing attention away from content
        const activeMobileTextColor = darkModeReducer
            ? (isVeryDarkAccent ? '#ffffff' : activeMenuColor)
            : activeMenuColor;
        const activeMobileIconColor = activeMobileTextColor;
        const activeMobileBg = alpha(activeMenuColor, darkModeReducer ? 0.16 : 0.10);
        const activeMobileBorder = `1px solid ${alpha(activeMenuColor, darkModeReducer ? 0.30 : 0.20)}`;
        const activeMobileIconBg = alpha(activeMenuColor, darkModeReducer ? 0.20 : 0.12);
        const activeMobileHoverBg = alpha(activeMenuColor, darkModeReducer ? 0.22 : 0.15);
        const activeMobileShadow = darkModeReducer
            ? `0 2px 14px ${alpha(activeMenuColor, 0.20)}`
            : '0 2px 10px rgba(0,0,0,0.04)';
        const inactiveMobileTextColor = darkModeReducer ? "rgba(255, 255, 255, 0.88)" : "rgba(20, 20, 20, 0.88)";
        const inactiveMobileHoverBg = darkModeReducer ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";

        return (
            <Box
                ref={menuViewport.ref}
                onScroll={menuViewport.onScroll}
                data-navigation-scroll-id="clikb.navigation.menu"
                data-ai-scroll="clikb.navigation.menu:menu_items"
                sx={{
                    width: '100%',
                    height: '100dvh',
                    minHeight: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    // 'safe center' keeps the list at the exact vertical middle and
                    // falls back to top-aligned scrolling when it outgrows the drawer.
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    backgroundColor: type === 1
                        ? 'transparent'
                        : (darkModeReducer ? "rgba(22,22,24,0.92)" : "rgba(255,255,255,0.94)"),
                    color: darkModeReducer ? "#ffffff" : "#000000",
                    backdropFilter: type === 1 ? 'none' : "blur(24px) saturate(120%)",
                    p: 0,
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    "&::-webkit-scrollbar": {
                        display: "none",
                        width: 0,
                        height: 0,
                    },
                }}
            >
                {isMobile && menuVisible && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1,
                        flexShrink: 0, px: 2, pt: 'max(16px, env(safe-area-inset-top))', pb: 1, color: appColor }}>
                        <Box component="img" src={darkModeReducer ? ClikbaeIcon2 : ClikbaeIcon}
                            alt="" sx={{ width: 28, height: 28 }} />
                        <ClikBSocialWordmark fontSize="1.15rem" />
                    </Box>
                )}
                <Box
                    sx={{
                        width: '100%',
                        margin: 'auto 0',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}
                >
                    {import.meta.env.VITE_APPX_STATE !== 'prod' && showbut && (
                        <Box sx={{ width: '100%', px: 1.5, pt: 0.5, pb: 0.5, boxSizing: 'border-box' }}>
                            <Button
                                data-ai-action="clikb.navigation.menu.action.thumbnail_creator"
                                variant="contained"
                                disableElevation
                                size="small"
                                sx={{
                                    width: '100%',
                                    py: 0.9,
                                    borderRadius: '24px',
                                    visibility: showbut ? 'visible' : 'hidden',
                                    border: `1px solid ${alpha(appColor, darkModeReducer ? 0.38 : 0.28)}`,
                                    bgcolor: darkModeReducer ? alpha(appColor, 0.16) : alpha(appColor, 0.1),
                                    color: appColor,
                                    fontWeight: 800,
                                    fontSize: '0.78rem',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    backdropFilter: 'blur(12px)',
                                    boxShadow: darkModeReducer
                                        ? '0 4px 16px rgba(0,0,0,0.35)'
                                        : `0 4px 16px ${alpha(appColor, 0.18)}`,
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '& .MuiButton-startIcon': {
                                        color: appColor,
                                        mr: 0.8,
                                    },
                                    '&:hover': {
                                        bgcolor: alpha(appColor, 0.25),
                                        borderColor: appColor,
                                        transform: 'translateY(-1px)',
                                        boxShadow: `0 6px 20px ${alpha(appColor, 0.28)}`,
                                    },
                                    '&:active': {
                                        transform: 'scale(0.98)',
                                    },
                                }}
                                onClick={() => {
                                    setShowThumb(true);
                                    dispatch(recordNavigationTransition({
                                        actor: 'manual', kind: 'area',
                                        before: { route: location.pathname, areaId: 'clikb.navigation.menu', state: { thumbnailCreatorOpen: false } },
                                        after: { route: location.pathname, areaId: 'clikb.navigation.menu', controlId: 'clikb.navigation.menu.control.thumbnail_creator', state: { thumbnailCreatorOpen: true } },
                                        outcome: 'succeeded', authoritativeSource: 'MenuSlider thumbnail-creator handler',
                                    }));
                                }}
                                startIcon={<StarIcon sx={{ fontSize: '1.1rem !important' }} />}
                            >
                                Thumbnail Creator
                            </Button>
                        </Box>
                    )}

                    <Stack
                        direction="column"
                        spacing={0.75}
                        sx={{
                            mt: import.meta.env.VITE_APPX_STATE !== 'prod' && showbut ? 1 : 0,
                            px: 1.25,
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    >
                    {visibleMenuItems.map(({ item, index }) => {
                        const isActive = getIsActive(item.label);
                        const isProfile = item.label === 'My Page';
                        const isLogin = isProfile && loggedUser && loggedUser.id === 1;
                        
                        const isFullyActive = isActive && (item.label !== 'My Page' ? true : (!userId || userId === 0 || (loggedUser && userId === loggedUser.id)));

                        return (
                            <Box
                                key={index}
                                data-navigation-scroll-id={`clikb.navigation.menu.control.${menuControlNames[item.label]}`}
                                data-ai-action={`clikb.navigation.menu.action.${menuControlNames[item.label]}`}
                                sx={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                    px: 2,
                                    py: 1.25,
                                    borderRadius: '18px',
                                    boxSizing: 'border-box',
                                    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                                    backgroundColor: isFullyActive ? activeMobileBg : 'transparent',
                                    color: isFullyActive ? activeMobileTextColor : inactiveMobileTextColor,
                                    boxShadow: isFullyActive ? activeMobileShadow : 'none',
                                    border: isFullyActive ? activeMobileBorder : '1px solid transparent',
                                    '&:hover': {
                                        backgroundColor: isFullyActive
                                            ? activeMobileHoverBg
                                            : inactiveMobileHoverBg,
                                        transform: isFullyActive ? 'scale(1.015)' : 'translateX(4px)',
                                    },
                                    '&:active': {
                                        transform: 'scale(0.98)',
                                    },
                                    ...(isFullyActive && { transform: 'scale(1.015)' })
                                }}
                                onClick={() => {
                                    if (item.label === 'Categories') {
                                        handleCategoriesClick();
                                    } else if (item.label === 'Create') {
                                        handleCreateClick();
                                    } else {
                                        if (isLogin) {
                                            handleLoginClick();
                                        } else {
                                            handleItemClick(index);
                                        }
                                    }
                                }}
                            >
                                {/* --- ICON CONTAINER (fixed width) --- */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 38,
                                        height: 38,
                                        position: 'relative',
                                        mr: 1.75,
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        backgroundColor: isFullyActive
                                            ? activeMobileIconBg
                                            : (darkModeReducer ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                                        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    {isProfile ? (
                                        <img
                                            src={loggedUser ? `${loggedUser.image}` : ''}
                                            alt="My profile"
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: isFullyActive ? `2px solid ${activeMobileTextColor}` : '2px solid transparent',
                                                transition: 'border-color 0.2s ease',
                                            }}
                                        />
                                    ) : (
                                        (() => {
                                            const iconColor = (item.label === 'Create' && !feedsOpen)
                                                ? activeMenuColor
                                                : getIconColor(item.label, darkModeReducer, feedsOpen);

                                            return React.cloneElement(item.icon, {
                                                sx: {
                                                    fontSize: 24,
                                                    color: isFullyActive
                                                        ? activeMobileIconColor
                                                        : (item.label === 'Create'
                                                            ? createIconColor
                                                            : (iconColor || (darkModeReducer ? "#ffffff" : "#1a1a1a"))),
                                                    transition: 'color 0.2s ease, transform 0.2s ease',
                                                    filter: darkModeReducer && !isFullyActive
                                                        ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                                        : 'none',
                                                },
                                            });
                                        })()
                                    )}
                                    {item.label === 'Chat' && hasUnreadNotifications && <SocialUnreadDot accent={appColor} />}
                                </Box>

                                {/* --- TEXT CONTAINER --- */}
                                <Typography
                                    variant="body1"
                                    noWrap
                                    sx={{
                                        flex: 1,
                                        fontWeight: isFullyActive ? 800 : 600,
                                        fontSize: '0.93rem',
                                        letterSpacing: '-0.01em',
                                        color: isFullyActive ? activeMobileTextColor : inactiveMobileTextColor,
                                        transition: 'color 0.2s ease',
                                    }}
                                >
                                    {isLogin ? 'Login' : isProfile ? loggedUser?.username || item.label : item.label === 'HomePage' ? 'Search' : item.label}
                                </Typography>
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
        </Box>
    );
}



    /* -------------------------------------------------------------------------- */
    /*                             DESKTOP RENDERING                              */
    /* -------------------------------------------------------------------------- */
    const isDesktopVeryDarkAccent = (() => {
        if (!activeMenuColor || activeMenuColor === '#101010' || activeMenuColor === '#000000') return true;
        const c = activeMenuColor.replace('#', '');
        if (c.length === 6) {
            const r = parseInt(c.slice(0, 2), 16);
            const g = parseInt(c.slice(2, 4), 16);
            const b = parseInt(c.slice(4, 6), 16);
            return (0.299 * r + 0.587 * g + 0.114 * b) < 90;
        }
        return false;
    })();

    // Subtle frosted glass look: tactical indicator reflecting app color without distracting from content
    const activeDesktopTextColor = darkModeReducer
        ? (isDesktopVeryDarkAccent ? '#ffffff' : activeMenuColor)
        : activeMenuColor;
    const activeDesktopIconColor = activeDesktopTextColor;
    const activeDesktopBg = alpha(activeMenuColor, darkModeReducer ? 0.16 : 0.10);
    const activeDesktopBorder = `1px solid ${alpha(activeMenuColor, darkModeReducer ? 0.30 : 0.20)}`;
    const activeDesktopIconBg = alpha(activeMenuColor, darkModeReducer ? 0.20 : 0.12);
    const activeDesktopHoverBg = alpha(activeMenuColor, darkModeReducer ? 0.22 : 0.15);
    const activeDesktopShadow = darkModeReducer
        ? `0 2px 14px ${alpha(activeMenuColor, 0.20)}`
        : '0 2px 10px rgba(0,0,0,0.04)';
    const inactiveDesktopTextColor = darkModeReducer ? "rgba(255, 255, 255, 0.88)" : "rgba(25, 25, 25, 0.88)";
    const inactiveDesktopHoverBg = darkModeReducer ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)";

    return (
        <Stack
            ref={menuViewport.ref as React.Ref<HTMLDivElement>}
            onScroll={menuViewport.onScroll}
            data-navigation-scroll-id="clikb.navigation.menu"
            data-ai-scroll="clikb.navigation.menu:menu_items"
            direction="column"
            spacing={0.75}
            sx={{
                py: 1,
                px: 1.25,
                height: '44vh',
                backgroundColor: 'transparent',
                backdropFilter: "blur(40px)",
                borderRadius: 2,
                boxShadow: theme.palette.mode === "dark"
                    ? darkModeReducer ? "0 0 10px rgba(255,255,255,0.25)" : "0 0 10px rgba(255,255,255,0.15)"
                    : darkModeReducer ? "0 0 10px rgba(0,0,0,0.15)" : "0 0 10px rgba(0,0,0,0.05)",
                overflowX: 'hidden',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                "&::-webkit-scrollbar": {
                    display: 'none',
                    width: 0,
                    height: 0,
                },
                "&::-webkit-scrollbar-track": {
                    background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                    background: "transparent",
                },
            }}
        >
            {visibleMenuItems.map(({ item, index }) => {
                const isActive = getIsActive(item.label);
                const isProfile = item.label === 'My Page';
                const isLogin = isProfile && loggedUser && loggedUser.id === 1;
                
                const isFullyActive = isActive && (item.label !== 'My Page' ? true : (!userId || userId === 0 || (loggedUser && userId === loggedUser.id)));

                return (
                    <Box
                        key={index}
                        data-navigation-scroll-id={`clikb.navigation.menu.control.${menuControlNames[item.label]}`}
                        data-ai-action={`clikb.navigation.menu.action.${menuControlNames[item.label]}`}
                        onClick={() => {
                            if (item.label === 'Categories') {
                                handleCategoriesClick();
                            } else if (item.label === 'Create') {
                                handleCreateClick();
                            } else {
                                if (isLogin) {
                                    handleLoginClick();
                                } else {
                                    handleItemClick(index);
                                }
                            }
                        }}
                        sx={{
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            width: "100%",
                            px: 2,
                            py: 1.1,
                            borderRadius: '16px',
                            boxSizing: 'border-box',
                            transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                            backgroundColor: isFullyActive ? activeDesktopBg : 'transparent',
                            color: isFullyActive ? activeDesktopTextColor : inactiveDesktopTextColor,
                            boxShadow: isFullyActive ? activeDesktopShadow : 'none',
                            border: isFullyActive ? activeDesktopBorder : '1px solid transparent',
                            "&:hover": { 
                                backgroundColor: isFullyActive
                                    ? activeDesktopHoverBg
                                    : inactiveDesktopHoverBg,
                                transform: isFullyActive ? 'scale(1.015)' : 'translateX(4px)',
                            },
                            "&:active": {
                                transform: 'scale(0.98)',
                            },
                            ...(isFullyActive && { transform: 'scale(1.015)' }),
                        }}
                    >
                        {/* --- ICON CONTAINER (fixed width) --- */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 34,
                                height: 34,
                                position: 'relative',
                                mr: 1.75,
                                borderRadius: '50%',
                                flexShrink: 0,
                                backgroundColor: isFullyActive
                                    ? activeDesktopIconBg
                                    : (darkModeReducer ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                                transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
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
                                        border: isFullyActive ? `2px solid ${activeDesktopTextColor}` : '2px solid transparent',
                                        transition: 'border-color 0.2s ease',
                                    }}
                                />
                            ) : (
                                (() => {
                                    const iconColor = (item.label === 'Create' && !feedsOpen)
                                        ? activeMenuColor
                                        : getIconColor(item.label, darkModeReducer, feedsOpen);

                                    return React.cloneElement(item.icon, {
                                        sx: {
                                            fontSize: 22,
                                            color: isFullyActive
                                                ? activeDesktopTextColor
                                                : (item.label === 'Create'
                                                    ? createIconColor
                                                    : (iconColor || (darkModeReducer ? "#ffffff" : "#1a1a1a"))),
                                            transition: 'color 0.2s ease, transform 0.2s ease',
                                            filter: darkModeReducer && !isFullyActive
                                                ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                                : 'none',
                                        },
                                    });
                                })()
                            )}
                            {item.label === 'Chat' && hasUnreadNotifications && <SocialUnreadDot accent={appColor} />}
                        </Box>

                        {/* --- TEXT CONTAINER --- */}
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{
                                flex: 1,
                                fontWeight: isFullyActive ? 800 : 600,
                                fontSize: '0.92rem',
                                letterSpacing: '-0.01em',
                                color: isFullyActive ? activeDesktopTextColor : inactiveDesktopTextColor,
                                transition: 'color 0.2s ease',
                            }}
                        >
                            {isLogin ? 'Login' : isProfile ? loggedUser?.username || item.label : item.label === 'HomePage' ? 'Search' : item.label}
                        </Typography>
                    </Box>
                );
            })}
        </Stack>
    );
};

export default MenuSlider;


