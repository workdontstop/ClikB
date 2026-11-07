// BottomMenu.tsx
import React, { useMemo, useState, useLayoutEffect, useEffect, useRef } from "react";
import {
    Box,
    BottomNavigation,
    BottomNavigationAction,
    alpha,
    darken,
} from "@mui/material";
import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import PersonIcon from "@mui/icons-material/Person";
import WeekendIcon from "@mui/icons-material/Weekend";


import WidgetsIcon from "@mui/icons-material/Widgets";

import AddCircleIcon from '@mui/icons-material/AddCircle';

import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit';
import MenuIcon from '@mui/icons-material/Menu';

import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useNavigate, useLocation } from "react-router-dom";
import { deckRouteTransition } from './useDeckNavigation';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import { appAccentForeground } from './appAccentStyles';
import { SocialUnreadDot, useSocialChat } from './SocialChat';
import ClikBSocialWordmark from './ClikBSocialWordmark';

import ClikbaeIcon from "./s.png";
import ClikbaeIcon2 from "./s2.png";

// Keep the label text available so captions can be restored with one switch.
const SHOW_BOTTOM_MENU_LABELS = false;

const BottomMenu: React.FC<any> = ({
    activeIndex,
    setActiveIndex,
    isFullscreen,
    isMenuOpen,
    MenuOpenb,

    setMenuOpenb,
    setIsMenuOpen,
    setminimisePrompt
}) => {
    const [showMagicBubble, setShowMagicBubble] = useState(false); // New state for Magic Mirror bubble cli
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasUnreadNotifications } = useSocialChat();
    const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
    const { userId } = location.state || {};
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const profileMenuLabel = Number(loggedUser?.id) > 1 && loggedUser?.username?.trim()
        ? loggedUser.username : 'My Page';
    const darkModeReducer = useSelector((s: RootState) => s.settings.darkMode);
    const appColorDark = useSelector((s: RootState) => s.settings.appColorDark);
    const appColorLight = useSelector((s: RootState) => s.settings.appColorLight);
    const deckOpen = useSelector((s: RootState) => s.brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck']?.state.isOpen === true);
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? "#E8BAFA" : "#0099cc");
    const isMobile = matchMobile;

    const [activePillLabel, setActivePillLabel] = useState<string | null>(null);
    const [pillLeftPercent, setPillLeftPercent] = useState<number>(50);
    const mobilePillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerPill = (label: string, index: number) => {
        setActivePillLabel(label);
        setPillLeftPercent(((index + 0.5) / menuItems.length) * 100);
        if (mobilePillTimerRef.current) {
            clearTimeout(mobilePillTimerRef.current);
        }
        mobilePillTimerRef.current = setTimeout(() => {
            setActivePillLabel(null);
        }, 1500);
    };

    useEffect(() => {
        return () => {
            if (mobilePillTimerRef.current) {
                clearTimeout(mobilePillTimerRef.current);
            }
        };
    }, []);

    const menuItems = [
        { label: "Cinema", icon: <WeekendIcon /> },
        { label: "Shorts", icon: <PhotoIcon /> },
        { label: "Games", icon: <TouchAppIcon /> },
        { label: "My Page", icon: <PersonIcon /> },
        { label: "Menu", icon: <WidgetsIcon /> },
    ] as const;

    const current = (() => {
        const path = location.pathname.toLowerCase();
        if (path.includes('/kickit')) return 0;
        if (path.includes('/images')) return 1;
        if (path.includes('/clikit')) return 2;
        if (path.includes('/pages')) return 3;
        return -1;
    })();

    const handleChange = (_: any, newBottomIdx: number) => {
        const pathMap: Record<string, string> = {
            Cinema: "/kickit",
            Shorts: "/images",
            Games: "/clikit",
            "My Page": "/pages",
        };
        const selectedLabel = menuItems[newBottomIdx].label;
        if (pathMap[selectedLabel]) {
            dispatch(recordNavigationTransition({
                actor: 'manual', kind: 'control',
                before: { route: location.pathname, areaId: 'clikb.navigation.bottom_menu' },
                after: { route: pathMap[selectedLabel], areaId: 'clikb.navigation.bottom_menu', controlId: `clikb.navigation.bottom_menu.control.${selectedLabel === 'My Page' ? 'my_page' : selectedLabel.toLowerCase()}` },
                outcome: 'unknown', authoritativeSource: 'BottomMenu navigation request',
                detail: 'Router location event establishes arrival',
            }));
            const transition = deckRouteTransition(location, pathMap[selectedLabel], { userId: loggedUser?.id }, { deckEnabled });
            navigate(transition.to, transition.options);
        }
    };

    /* ---------------------------------------------------
     * 6) show / hide brand overlay (unchanged)
     * -------------------------------------------------- */
    const Menux = matchMobile ? isMenuOpen : MenuOpenb;

    useEffect(() => {
        const areaId = 'clikb.navigation.bottom_menu';
        dispatch(publishNavigationArea({
            areaId,
            source: 'BottomMenu',
            state: {
                activeRoute: location.pathname.toLowerCase(),
                selectedIndex: current,
                menuOverlayOpen: Menux,
            },
            visibleControls: Menux
                ? []
                : [
                    navigationControl(areaId, 'cinema', 'BottomMenu.handleChange'),
                    navigationControl(areaId, 'shorts', 'BottomMenu.handleChange'),
                    navigationControl(areaId, 'games', 'BottomMenu.handleChange'),
                    navigationControl(areaId, 'my_page', 'BottomMenu.handleChange'),
                    navigationControl(areaId, 'menu', 'BottomMenu.setIsMenuOpen or setMenuOpenb'),
                ],
        }));
    }, [dispatch, location.pathname, current, Menux]);

    useEffect(() => () => {
        dispatch(removeNavigationArea({ areaId: 'clikb.navigation.bottom_menu', source: 'BottomMenu' }));
    }, [dispatch]);

    /* ---------------------------------------------------
     * 7) styles (unchanged)
     * -------------------------------------------------- */
    const backdrop = {
        backgroundColor: darkModeReducer ? "rgba(25,25,25,0.88)" : "rgba(255,255,255,0.88)",
        backdropFilter: "blur(24px) saturate(120%)",
        borderTop: `1px solid ${alpha(darkModeReducer ? "#fff" : "#000", 0.15)}`,
        transition: "background-color 0.3s ease",
    };

    /* ---------------------------------------------------
     * 8) render (UI identical)
     * -------------------------------------------------- */
    return (
        <Box sx={{ position: "fixed", bottom: 0, width: "100%", zIndex: deckOpen ? 1200 : 20, ...backdrop }}>
            {activePillLabel && !Menux && (
                <Box
                    data-ai-snapshot-ignore="true"
                    sx={{
                        position: "absolute",
                        top: "-36px",
                        left: isMobile ? `${pillLeftPercent}%` : `calc(50% + ${(pillLeftPercent - 50) * 0.5}%)`,
                        transform: "translateX(-50%)",
                        backgroundColor: appColor,
                        color: darkModeReducer ? "#000000" : "#ffffff",
                        px: 2,
                        py: 0.45,
                        borderRadius: "20px",
                        fontSize: "0.82rem",
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                        boxShadow: darkModeReducer
                            ? "0 4px 18px rgba(0,0,0,0.65), 0 0 10px rgba(255,255,255,0.18)"
                            : "0 4px 18px rgba(0,0,0,0.22), 0 0 10px rgba(0,0,0,0.08)",
                        border: darkModeReducer ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.12)",
                        backdropFilter: "blur(12px)",
                        pointerEvents: "none",
                        zIndex: 1400,
                        whiteSpace: "nowrap",
                        userSelect: "none",
                        transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                >
                    {activePillLabel === 'My Page' ? profileMenuLabel : activePillLabel}
                </Box>
            )}
            <BottomNavigation
                value={current}
                showLabels
                sx={{
                    px: 0,
                    width: isMobile ? "100%" : "50%",
                    minWidth: isMobile ? 0 : "min(360px, 100%)",
                    maxWidth: isMobile ? "100%" : 840,
                    mx: "auto",
                    height: 64,
                    bgcolor: "transparent",
                    boxShadow: "none",
                }}
            >
                {menuItems.map((item, idx) => {
                    const isActive = current === idx;
                    const isProfile = item.label === "My Page";
                    const displayLabel = isProfile ? profileMenuLabel : item.label;
                    const isFullyActive = isProfile && loggedUser ? isActive && (userId === 0 || userId === loggedUser.id) : isActive;

                    const activeColor = appAccentForeground(darkModeReducer);
                    const activePillBg = appColor;

                    return Menux ? (
                        /* brand overlay (first button only) */
                        <Box
                            key={`brand-${idx}`}
                            sx={{
                                position: "fixed", bottom: 0, width: "100%", zIndex: 1300,
                                display: idx === 0 ? "flex" : "none",
                                justifyContent: "center", alignItems: "center",
                                height: 64, backgroundColor: "transparent", opacity: 0.8,
                            }}
                        >
                            <div
                                style={{
                                    display: "inline-flex", alignItems: "center",
                                    textDecoration: "none",
                                    color: appColor,
                                    opacity: 1,
                                    background: darkModeReducer ? 'rgba(25, 28, 38, 0.78)' : 'rgba(255, 255, 255, 0.85)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: `1.5px solid ${darkModeReducer ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'}`,
                                    padding: '6px 18px',
                                    borderRadius: '28px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: darkModeReducer ? '0 8px 30px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.12)',
                                }}
                            >
                                <img src={darkModeReducer ? ClikbaeIcon2 : ClikbaeIcon}
                                    alt="ClikBae" style={{
                                        width: "2.5rem", height: "2.5rem",
                                        marginRight: "0.5rem", position: "relative", top: "1px"
                                    }} />
                                <span style={{ display: "flex", alignItems: "baseline" }}>
                                    <ClikBSocialWordmark fontSize={matchMobile ? '1.4rem' : undefined} />
                                </span>
                            </div>
                        </Box>
                    ) : (
                        <BottomNavigationAction
                            data-ai-action={`clikb.navigation.bottom_menu.action.${item.label === 'My Page' ? 'my_page' : item.label.toLowerCase()}`}
                            onMouseEnter={() => {
                                if (!isMobile) {
                                    setActivePillLabel(item.label);
                                    setPillLeftPercent(((idx + 0.5) / menuItems.length) * 100);
                                }
                            }}
                            onMouseLeave={() => {
                                if (!isMobile) {
                                    setActivePillLabel(null);
                                }
                            }}
                            onClick={(e: any) => {
                                if (isMobile) {
                                    triggerPill(item.label, idx);
                                }
                                if (item.label === "Menu") {
                                    setMenuOpenb((prev: boolean) => !prev);
                                    dispatch(recordNavigationTransition({
                                        actor: 'manual', kind: 'area',
                                        before: { route: location.pathname, areaId: 'clikb.navigation.bottom_menu', state: { menuOverlayOpen: false } },
                                        after: { route: location.pathname, areaId: 'clikb.navigation.menu', controlId: 'clikb.navigation.bottom_menu.control.menu', state: { menuOverlayOpen: true } },
                                        outcome: 'succeeded', authoritativeSource: 'BottomMenu menu handler',
                                    }));
                                } else {
                                    handleChange(e, idx);
                                }
                            }}
                            key={idx}
                            label={displayLabel}
                            aria-label={displayLabel}
                            aria-description={item.label === 'Menu' && hasUnreadNotifications && !MenuOpenb && !isMenuOpen ? 'Unread notifications' : undefined}
                            disableRipple
                            disableTouchRipple
                            sx={{
                                color: darkModeReducer ? "#ffffff" : "#000000",
                                minWidth: 'auto',
                                maxWidth: 'none',
                                flex: '1 1 0',
                                padding: '6px 0',
                                "&:focus:not(:focus-visible)": { outline: 'none' },
                                "&.Mui-focusVisible": { outline: `2px solid ${appColor}`, outlineOffset: -3, borderRadius: 2 },
                                "&:hover": { backgroundColor: alpha(darkModeReducer ? '#fff' : '#000', .06) },
                                "& .MuiBottomNavigationAction-label": {
                                    display: SHOW_BOTTOM_MENU_LABELS ? 'block' : 'none',
                                    fontSize: isMobile ? '10px' : '12px',
                                    fontWeight: isFullyActive ? 900 : 800,
                                    marginTop: "4px",
                                    transition: 'all 0.2s ease',
                                },
                                "&.Mui-selected": {
                                    color: darkModeReducer ? "#ffffff" : "#000000",
                                    "& .MuiBottomNavigationAction-label": {
                                        fontSize: isMobile ? '11px' : '13px',
                                    }
                                },
                                "& .MuiTouchRipple-root": { display: "none" },
                            }}
                            icon={
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: isMobile ? 52 : 60,
                                        height: 32,
                                        position: 'relative',
                                        borderRadius: '16px',
                                        backgroundColor: isFullyActive ? activePillBg : 'transparent',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isFullyActive ? 'scale(1.1)' : 'scale(1)',
                                    }}
                                >
                                    {isProfile && loggedUser ? (
                                        <img
                                            src={loggedUser.image || ''}
                                            alt="Me"
                                            style={{
                                                width: 26,
                                                height: 26,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: isFullyActive ? `2px solid ${activeColor}` : '2px solid transparent',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    ) : (
                                        React.cloneElement(item.icon, {
                                            sx: {
                                                fontSize: isMobile ? 24 : 26,
                                                color: isFullyActive ? activeColor : (darkModeReducer ? "#ffffff" : "#000000"),
                                                transition: 'color 0.2s ease',
                                                filter: isFullyActive && darkModeReducer ? 'drop-shadow(0px 1px 3px rgba(0,0,0,0.5))' : 'none'
                                            }
                                        })
                                    )}
                                    {item.label === 'Menu' && hasUnreadNotifications && !MenuOpenb && !isMenuOpen && <SocialUnreadDot accent={appColor} />}
                                </Box>
                            }
                        />
                    );
                })}
            </BottomNavigation>
        </Box>
    );
};

export default BottomMenu;
