// BottomMenu.tsx
import React, { useMemo, useState, useLayoutEffect, useEffect } from "react";
import {
    Box,
    BottomNavigation,
    BottomNavigationAction,
    alpha,
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
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

import ClikbaeIcon from "./s.png";
import ClikbaeIcon2 from "./s2.png";
import { usePWA } from "./PWAContext";
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

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
    const [showMagicBubble, setShowMagicBubble] = useState(false); // New state for Magic Mirror bubble
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = location.state || {};
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const darkModeReducer = useSelector((s: RootState) => s.settings.darkMode);
    const isMobile = matchMobile;

    const { installPwa, isPwaMode, isInstallable } = usePWA();
    const [showLaunchMenu, setShowLaunchMenu] = useState(false);

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
            navigate(pathMap[selectedLabel], {
                state: { userId: loggedUser?.id },
            });
        }
    };

    /* ---------------------------------------------------
     * 6) show / hide brand overlay (unchanged)
     * -------------------------------------------------- */
    const [Menux, setMenux] = useState(false);
    useEffect(() => {
        const isOpen = matchMobile ? isMenuOpen : MenuOpenb;
        setMenux(isOpen);

        if (isOpen && !isPwaMode) {
            setShowLaunchMenu(true);
            const timer = setTimeout(() => {
                setShowLaunchMenu(false);
            }, 4000); // 4 seconds
            return () => clearTimeout(timer);
        } else {
            setShowLaunchMenu(false);
        }
    }, [isMenuOpen, MenuOpenb, isPwaMode]);

    const handleLaunchMenuClick = async (e: any) => {
        if (isPwaMode) return;
        e.stopPropagation(); // prevent menu close if needed? or let it happen.
        await installPwa();
        setShowLaunchMenu(false);
    };

    /* ---------------------------------------------------
     * 7) styles (unchanged)
     * -------------------------------------------------- */
    const backdrop = {
        backgroundColor: darkModeReducer ? "rgba(25,25,25,0.25)" : "rgba(255,255,255,0.25)",
        backdropFilter: "blur(24px) saturate(120%)",
        borderTop: `1px solid ${alpha(darkModeReducer ? "#fff" : "#000", 0.15)}`,
        transition: "background-color 0.3s ease",
    };
    const iconActiveColor = darkModeReducer ? "#E8BAFA" : "#0099cc";

    /* ---------------------------------------------------
     * 8) render (UI identical)
     * -------------------------------------------------- */
    return (
        <Box sx={{ position: "fixed", bottom: 0, width: "100%", zIndex: 20, ...backdrop }}>
            <BottomNavigation
                value={current}
                showLabels
                sx={{ px: 2, height: 64, bgcolor: "transparent", boxShadow: "none" }}
            >
                {menuItems.map((item, idx) => {
                    const isActive = current === idx;
                    const isProfile = item.label === "My Page";
                    const isFullyActive = isProfile && loggedUser ? isActive && (userId === 0 || userId === loggedUser.id) : isActive;

                    const activeColor = darkModeReducer ? "#E8BAFA" : "#0099cc";
                    const activePillBg = darkModeReducer ? 'rgba(232, 186, 250, 0.15)' : 'rgba(0, 153, 204, 0.15)';

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
                            {showLaunchMenu && !isPwaMode && isInstallable ? (
                                <div
                                    onClick={handleLaunchMenuClick}
                                    style={{
                                        display: "inline-flex", alignItems: "center",
                                        textDecoration: "none", color: darkModeReducer ? "#000" : "#fff",
                                        cursor: "pointer",
                                        background: activeColor,
                                        padding: '5px 15px',
                                        borderRadius: '20px',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <span style={{ fontSize: "1.0rem", fontWeight: 800 }}>Launch App</span>
                                    <RocketLaunchIcon sx={{ fontSize: "1.2rem", marginLeft: "0.5rem", color: darkModeReducer ? "#000" : "#fff" }} />
                                </div>
                            ) : (
                                <div
                                    onClick={isPwaMode || !isInstallable ? undefined : handleLaunchMenuClick}
                                    style={{
                                        display: "inline-flex", alignItems: "center",
                                        textDecoration: "none",
                                        color: darkModeReducer ? '#000' : '#fff',
                                        opacity: 1,
                                        background: activeColor,
                                        padding: '6px 16px',
                                        borderRadius: '20px',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                        cursor: isPwaMode || !isInstallable ? 'default' : 'pointer'
                                    }}
                                >
                                    <img src={darkModeReducer ? ClikbaeIcon2 : ClikbaeIcon}
                                        alt="ClikBae" style={{
                                            width: "2.5rem", height: "2.5rem",
                                            marginRight: "0.5rem", position: "relative", top: "1px"
                                        }} />
                                    <span style={{ display: "flex", alignItems: "baseline" }}>
                                        <span style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1 }}>ClikB</span>
                                    </span>
                                </div>
                            )}
                        </Box>
                    ) : (
                        <BottomNavigationAction
                            onClick={(e: any) => {
                                if (item.label === "Menu") {
                                    if (matchMobile) { setIsMenuOpen(true); }
                                    else { setMenuOpenb(true); }
                                } else {
                                    handleChange(e, idx);
                                }
                            }}
                            key={idx}
                            label={item.label}
                            disableRipple
                            disableTouchRipple
                            sx={{
                                color: darkModeReducer ? "#ffffff" : "#000000",
                                minWidth: 'auto',
                                padding: '6px 0',
                                "&:focus,&.Mui-focusVisible": { outline: "none" },
                                "& .MuiBottomNavigationAction-label": {
                                    fontSize: isMobile ? '10px' : '12px',
                                    fontWeight: isFullyActive ? 800 : 600,
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
