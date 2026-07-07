import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// MUI icons
import PhotoIcon from "@mui/icons-material/Photo";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import WeekendIcon from "@mui/icons-material/Weekend";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SvgIconProps } from "@mui/material/SvgIcon";

import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

const ICON_COLORS = {
    light: '#ffffff',
    dark: '#ffffff',
} as const;

type TitleKey = "Cinema" | "Games" | "Shorts";
type IconType = React.ComponentType<SvgIconProps>;
type Option = { key: TitleKey; icon: IconType; route: string };

interface TitleSelectorProps {
    isBlinking?: boolean;
    onCancel?: () => void;
    buttonTheme?: { bg: string; text: string; hoverBg: string; hoverText: string };
    /** when true the selector renders in normal flow (used to flank the button bar on PC) */
    inline?: boolean;
}

export default function TitleSelector({
    isBlinking,
    onCancel,
    inline = false,
    buttonTheme = {
        bg: "rgba(10, 10, 10, 0.45)",
        text: "#ffffff",
        hoverBg: "rgba(15, 15, 15, 0.65)",
        hoverText: "#ffffff",
    }
}: TitleSelectorProps): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();

    const [urlName4prompt, setUrlName4prompt] = useState(location.pathname);
    const [minimisePrompt, setminimisePrompt] = useState(false);
    const [open, setOpen] = useState(false);

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // theme
    const [themeMode, setThemeMode] = useState<"light" | "dark">(
        typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
    );

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e: MediaQueryListEvent) => setThemeMode(e.matches ? "dark" : "light");

        mql.addEventListener ? mql.addEventListener("change", handler) : mql.addListener(handler);
        return () => {

            mql.removeEventListener ? mql.removeEventListener("change", handler) : mql.removeListener(handler);
        };
    }, []);

    const VALID_ROUTES = useMemo(() => new Set(["/images", "/clikit", "/kickit", "/MagicMirror"]), []);

    useEffect(() => {
        const path = location.pathname;
        if (!VALID_ROUTES.has(path)) {
            setUrlName4prompt("/images");
            setminimisePrompt(false);
            navigate("/images", { replace: true, state: { userId: loggedUser?.id } });
        } else {
            setUrlName4prompt(path);
            setminimisePrompt(false);
        }
    }, [location.pathname, VALID_ROUTES, navigate, loggedUser?.id]);

    const routeToTitle: TitleKey = useMemo(() => {
        if (urlName4prompt === "/images") return "Shorts";
        if (urlName4prompt === "/clikit") return "Games";
        if (urlName4prompt === "/kickit") return "Cinema";
        if (urlName4prompt === "/MagicMirror") return "Shorts";
        return "Shorts";
    }, [urlName4prompt]);

    const options: Option[] = useMemo(
        () => [
            { key: "Shorts", icon: PhotoIcon, route: "/images" },
            { key: "Cinema", icon: WeekendIcon, route: "/kickit" },
            { key: "Games", icon: TouchAppIcon, route: "/clikit" },

        ],
        []
    );

    const selected = useMemo(
        () => options.find((o) => o.key === routeToTitle) || options[2],
        [routeToTitle, options]
    );

    const wrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && e.target instanceof Node && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const glassy: React.CSSProperties = {
        background: buttonTheme.bg,
        color: buttonTheme.text,
        backdropFilter: "blur(24px) saturate(120%)",
        WebkitBackdropFilter: "blur(24px) saturate(120%)",
        border: themeMode === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
        borderRadius: 12,
        boxShadow: themeMode === "dark" ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
    };

    const iconColorFor = (key: TitleKey) => buttonTheme.text;

    return (
        <>
            <style>{`
                @keyframes blink-title-selector {
                    0% { outline: 2px solid transparent; outline-offset: 3px; }
                    50% { outline: 2px solid rgba(255, 255, 255, 0.5); outline-offset: 3px; }
                    100% { outline: 2px solid transparent; outline-offset: 3px; }
                }
            `}</style>
            <div
                ref={wrapperRef}
                style={
                    inline
                        ? {
                            // PC: render in normal flow so it can flank the button bar
                            position: "relative",
                            display: "inline-block",
                        }
                        : {
                            position: "fixed",
                            display: "inline-block",
                            bottom: matchMobile ? "7vh" : "4vh",
                            paddingTop: "0px",
                        }
                }
            >
                {!open && (
                    <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => {
                            if (isBlinking && onCancel) onCancel();
                            setOpen(true);
                        }}
                        style={{
                            ...glassy,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: matchMobile ? "8px 12px" : "10px 14px",
                            fontSize: matchMobile ? "0.65rem" : "0.8rem",
                            cursor: "pointer",
                            userSelect: "none",
                            animation: isBlinking ? 'blink-title-selector 1s infinite' : 'none',
                        }}
                    >
                        <selected.icon fontSize="small" htmlColor={iconColorFor(selected.key)} />
                        <span style={{ fontWeight: 600 }}>{selected.key}</span>
                        <ExpandMoreIcon fontSize="small" />
                    </button>
                )}

                {open && (
                    <div
                        style={{
                            ...glassy,
                            position: "absolute",
                            left: 0,
                            top: "auto",
                            bottom: "calc(100% + 6px)",
                            minWidth: 180,
                            padding: 6,
                            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                            zIndex: 200,
                        }}
                    >
                        {options.map((opt) => {
                            const Icon = opt.icon;
                            const isActive = opt.key === selected.key;

                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => {
                                        if (isActive) {
                                            setOpen(false);
                                            return;
                                        }
                                        setUrlName4prompt(opt.route);
                                        setOpen(false);
                                        navigate(opt.route, { state: { userId: loggedUser?.id } });
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "10px 12px",
                                        background: "transparent",
                                        color: buttonTheme.text,
                                        border: "none",
                                        borderRadius: 10,
                                        cursor: "pointer",
                                        fontWeight: isActive ? 700 : 500,
                                        outline: "none",
                                    }}
                                >
                                    <Icon fontSize="small" htmlColor={iconColorFor(opt.key)} />
                                    <span>{opt.key}</span>
                                    {isActive && (
                                        <span style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>
                                            (current)
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {minimisePrompt ? null : null}
            </div>
        </>
    );
}
