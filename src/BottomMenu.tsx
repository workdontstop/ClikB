// BottomMenu.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    BottomNavigation,
    BottomNavigationAction,
    useTheme,
    alpha,
} from "@mui/material";
import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import PersonIcon from "@mui/icons-material/Person";
import WeekendIcon from "@mui/icons-material/Weekend";
import WidgetsIcon from "@mui/icons-material/Widgets";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

import ClikbaeIcon from './s.png'; // your transparent PNG icon

const BottomMenu: React.FC<any> = ({
    activeIndex,
    setActiveIndex,
    isFullscreen,
    isMenuOpen,
    setIsMenuOpen,
    openMenuPc,
    MenuOpenb
}) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = location.state || {};
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const dark = useSelector((s: RootState) => s.settings.darkMode);
    const isMobile = matchMobile;

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    const menuItems = [
        { label: "Memes", icon: <PhotoIcon /> },
        { label: "Interactions", icon: <TouchAppIcon /> },
        { label: "My Page", icon: <PersonIcon /> },
        { label: "Stories", icon: <WeekendIcon /> },
        { label: "Menu", icon: <WidgetsIcon /> },
    ];

    // slider↔bottom index maps
    const SLIDER_TO_BOTTOM = [2, 1, 3, 0, 4] as const;
    const BOTTOM_TO_SLIDER = useMemo(() => {
        const arr: number[] = [];
        SLIDER_TO_BOTTOM.forEach((b, s) => (arr[b] = s));
        return arr;
    }, []);
    const current = SLIDER_TO_BOTTOM[activeIndex] ?? 0;

    const handleChange = (_: any, newValue: number) => {
        if (newValue === 4) {
            isMobile ? setIsMenuOpen(!isMenuOpen) : openMenuPc();
            return;
        }
        const sliderIdx = BOTTOM_TO_SLIDER[newValue] ?? 0;
        let delay = isFullscreen ? 1000 : 20;
        if (isFullscreen) window.history.back();
        setTimeout(() => {
            setActiveIndex(sliderIdx);
            const clicked = menuItems[newValue].label;
            const pathMap: Record<string, string> = {
                Memes: "/images",
                Interactions: "/clikit",
                "My Page": "/pages",
                Stories: "/",
                Settings: "/settings",
            };
            setTimeout(
                () => navigate(pathMap[clicked], { state: { userId: loggedUser?.id } }),
                100
            );
        }, delay);
    };

    const backdrop = {
        backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
        backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",

        borderTop: `1px solid ${alpha(dark ? "#fff" : "#000", 0.15)}`,
    };

    // gradient style for both icon and label when active
    const gradientClip = {
        background: darkModeReducer ? "conic-gradient(#ffffff,#FFffff)" : "conic-gradient(#000000,#000000)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",

    };


    const gradientClipx = {
        // background: "conic-gradient(#ffffff,#FF4B9D)",
        color: darkModeReducer ? '#ffffff' : '#000000'
    };

    const activeColor = "#ffbe0b";

    /// const iconActiveColors = ["#ffbe0b", "#0aff99", "#9b5de5", "#ffbe0b"];
    const iconActiveColors = ["#F6BB56"];


    const [Menux, setMenux] = useState(false);

    useEffect(() => {
        if (matchMobile) {

            if (isMenuOpen) {

                setMenux(true)
            } else {
                setMenux(false)

            }
        } else {

            if (MenuOpenb) {


                setMenux(true)
            } else {
                setMenux(false)

            }
        }


    }, [MenuOpenb, isMenuOpen]);
    return (
        <Box
            sx={{
                position: "fixed",
                bottom: 0,
                width: "100%",
                zIndex: 1300,
                ...backdrop,
            }}
        >
            <BottomNavigation
                value={current}
                onChange={handleChange}
                showLabels
                sx={{
                    px: 2,
                    height: isMobile ? 64 : 64,
                    bgcolor: "transparent",
                    boxShadow: "none",
                }}
            >
                {menuItems.map((item, idx) => {
                    const isProfile = item.label === "My Page";
                    const isActive = current === idx;

                    const iconColor = isActive
                        ? iconActiveColors[
                        Math.floor(Math.random() * iconActiveColors.length)
                        ]
                        : undefined;


                    // ring & container sized 20% up (32→38px)
                    const ringSize = 38;
                    const ringStyle =
                        isProfile && loggedUser
                            ? {
                                width: ringSize,
                                height: ringSize,
                                p: ringSize * 0.5 / ringSize, // ~0.5
                                borderRadius: "50%",
                                background: isActive ? "conic-gradient(#F6BB56,#F6BB56)" : '',

                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }
                            : {};

                    const ringStylex =
                        isProfile && loggedUser
                            ? {
                                width: ringSize,
                                height: ringSize,
                                p: ringSize * 0.5 / ringSize, // ~0.5
                                borderRadius: "50%",
                                // background: isActive ? "conic-gradient(#ffffff,#FF4B9D)" : '',

                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }
                            : {};



                    return (


                        (Menux) ? (
                            <Box
                                sx={{
                                    position: "fixed",
                                    bottom: 0,
                                    width: "100%",
                                    zIndex: 1300,
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    py: 1.5,

                                    backgroundColor: 'rgb(0, 0, 0, 0)',
                                    /// borderTop: `1px solid ${alpha(dark ? "#fff" : "#000", 0.15)}`,
                                    opacity: 0.8,

                                }}
                            >
                                <a
                                    href="https://www.clikb.com/privacy-policy"
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        textDecoration: "none",
                                        color: dark ? "#eee" : "#111",
                                    }}
                                >
                                    {/* icon */}
                                    <img


                                        src={ClikbaeIcon}
                                        alt="ClikBae icon"
                                        style={{
                                            width: isMobile ? "2.5rem" : "2.5rem",
                                            height: isMobile ? "2.5rem" : "2.5rem",
                                            marginRight: "0.5rem",
                                            position: "relative",
                                            top: "1px",

                                        }}
                                    />
                                    {/* word-mark + TM */}
                                    <span style={{ display: "flex", alignItems: "flex-start" }}>
                                        <span
                                            style={{
                                                fontSize: isMobile ? "1.25rem" : "1.5rem",
                                                fontWeight: 800,
                                                lineHeight: 1,
                                            }}
                                        >
                                            Clik
                                        </span>
                                        <span
                                            style={{
                                                fontSize: isMobile ? "1.25rem" : "1.5rem",
                                                fontWeight: 800,
                                                lineHeight: 1,
                                                opacity: 0.8,
                                                marginLeft: "0.1rem",
                                            }}
                                        >
                                            B
                                        </span>
                                        <sup
                                            style={{
                                                position: "relative",
                                                top: "2px",
                                                fontSize: "0.75rem",
                                                marginLeft: "0.2rem",
                                            }}
                                        >
                                            ™
                                        </sup>
                                    </span>
                                </a>
                            </Box>
                        )
                            :
                            <BottomNavigationAction
                                key={idx}
                                label={item.label}

                                disableRipple           // already removed the focus-ripple
                                disableTouchRipple      // <-- ❶ removes the blue flash on click
                                sx={{
                                    color: darkModeReducer ? '#ffffff' : '#000000',

                                    "&:focus, &.Mui-focusVisible": { outline: 'none', },
                                    opacity: isActive ? 0.8 : 1,
                                    // ---- active-state rules you already had ----
                                    "&.Mui-selected svg": { fill: isActive ? iconColor : '' },




                                    // label styles + 2 px spacing
                                    "& .MuiBottomNavigationAction-label": {
                                        fontSize: matchMobile ? 10 : 12,

                                        lineHeight: 1.2,
                                        marginTop: '2px',          // <-- ❷ 2-px gap between icon & text
                                    },

                                    // optional extra safety: no ripple element at all
                                    "& .MuiTouchRipple-root": { display: 'none' },

                                    "&.Mui-selected": {
                                        color: loggedUser ? userId === loggedUser.id ? '#F6BB56' :

                                            darkModeReducer ? '#ffffff' : '#000000' : null,                               // text + icon
                                        "& .MuiBottomNavigationAction-label": {
                                            color: loggedUser ? userId === loggedUser.id ? '#F6BB56' :

                                                darkModeReducer ? '#ffffff' : '#000000' : null,                              // label specifically
                                        },
                                        "& svg": {
                                            fill: loggedUser ? userId === loggedUser.id ? '#F6BB56' :

                                                darkModeReducer ? '#ffffff' : '#000000' : null,
                                        },                   // icon stroke if needed
                                    },
                                }}
                                icon={
                                    isProfile ? (
                                        <Box
                                            sx={
                                                loggedUser && isProfile
                                                    ? isActive
                                                        ? userId > 0
                                                            ? userId === loggedUser.id
                                                                ? ringStyle
                                                                : ringStylex
                                                            : ringStyle
                                                        : ringStylex
                                                    : ringStylex
                                            }
                                        >
                                            <img
                                                src={loggedUser?.image || ''}
                                                alt="Me"
                                                style={{
                                                    width: '120%',
                                                    height: '120%',
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                }}
                                            />
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'inline-flex', }}>
                                            {React.cloneElement(item.icon, { sx: { fontSize: 38 } })}
                                        </Box>
                                    )
                                }
                            />

                    );
                })}
            </BottomNavigation>
        </Box>
    );
};

export default BottomMenu;
