// EmotionsGateDesign.tsx (PRESENTATIONAL / UI)
import React, { useState, useEffect, useContext, createContext, useCallback, useRef } from "react";
import { Box, IconButton, Typography, ButtonBase } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import Avatar from "@mui/material/Avatar";
import { alpha, useTheme } from "@mui/material/styles";
import FollowPanel from "./FollowPanel";
import type { FanRow } from "./useFanPeople";
import { matchMobile } from "./DetectDevice";
import { useNavigate } from "react-router-dom";

import { Routes, Route, useLocation } from "react-router-dom";



import { useSelector, useDispatch } from "react-redux";

import { RootState, } from "./store";

type Counts = { followers?: number; following?: number } | undefined;

export type EmotionsGateDesignProps = {
    isDark: boolean;
    showEmotions: boolean;
    onClose?: () => void;
    view: "followers" | "following";
    onSetView: (next: "followers" | "following") => void;
    counts: Counts;
    loading: boolean;
    err?: string | null;
    rows: FanRow[];
    loggedUser: any;
    children?: React.ReactNode;

    /** Optional: root-provided pagination trigger */
    onPaginate?: () => void;
    setlastid: any;
    setEmotionRoute: any;
    emotionRoute: any;
    Likes: any;
    likesCount: any;
    isFullscreen: any


};

/* ---------- SINGLE-ACTIVE ROW CONTEXT (internal, no root changes)  ---------- */
type ActiveCtx = {
    activeKey: number | string | null;
    setActiveKey: (k: number | string | null) => void;
};
const ActiveRowContext = createContext<ActiveCtx | null>(null);
const useActiveRow = () => {
    const ctx = useContext(ActiveRowContext);
    if (!ctx) throw new Error("useActiveRow must be used within EmotionsGateDesign provider");
    return ctx;
};
/* -------------------------------------------------------------------------- */

export default function EmotionsGateDesign({
    isDark,
    showEmotions,
    onClose,
    view,
    onSetView,
    counts,
    loading,
    err,
    rows,
    loggedUser,
    children,
    onPaginate,
    setlastid,
    setEmotionRoute,
    emotionRoute,
    Likes,
    likesCount,
    isFullscreen
}: EmotionsGateDesignProps) {
    const theme = useTheme();

    // Glass palette
    const glassBg = isDark ? alpha("#0d0f14", 0.6) : alpha("#ffffff", 0.35);
    const borderCol = isDark ? alpha("#9fb3c8", 0.18) : alpha("#102a43", 0.15);
    const hoverBg = isDark ? alpha("#ffffff", 0.08) : alpha("#000000", 0.06);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    const navigate = useNavigate();


    const location = useLocation();

    const { userId } = location.state || {};






    if (!showEmotions) return null;

    const Tab = ({
        label,
        active,
        onClick,
    }: {
        label: string;
        active: boolean;
        onClick: () => void;
    }) => (
        <ButtonBase
            onClick={onClick}
            disableRipple
            sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 2,
                color: isDark ? "#ffffff" : "#000000",
                fontWeight: 700,
                opacity: active ? 1 : 0.55,
                transition: "all .18s ease",
                "&:hover": {
                    background: `linear-gradient(0deg, ${hoverBg}, ${hoverBg}), transparent`,
                    opacity: 1,
                },
            }}
            aria-pressed={active}
            aria-label={label}
        >
            <Typography variant="body1" fontWeight={700}>
                {label}
            </Typography>
        </ButtonBase>
    );

    // internal coordinator for single-open behavior
    const [activeKey, setActiveKey] = useState<number | string | null>(null);

    return (
        <Box
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose?.(); // <- optional chaining = only call if defined
                }
            }}


            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 2000000000000,
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                left: matchMobile ? "0px" : "0px",
                top: "0vh",

                pt: "10vh",
                padding: "0px",
                pointerEvents: "auto",
                cursor: 'pointer',
                backgroundColor: Likes ? '' : darkModeReducer ? 'rgb(0,0,0,0.65)' : 'rgb(70,70,70,0.25)',
            }}
        >
            {/* Panel */}
            <Box
                sx={{
                    marginTop: matchMobile ? '11vh' : "0vh",
                    width: matchMobile ? "100vw" : "40vw",
                    height: matchMobile ? '79vh' : "100vh",
                    marginLeft: matchMobile ? "0px" : "8.5vw",
                    borderRadius: 3,
                    background: isDark ? 'rgb(0,0,0, 0.4)' : 'rgb(240,240,240,0.68)',
                    border: `1px solid ${borderCol}`,
                    backdropFilter: "saturate(180%) blur(15px)",
                    WebkitBackdropFilter: "saturate(180%) blur(15px)",
                    boxShadow: isDark ? "0 18px 60px rgba(0,0,0,.50)" : "0 18px 60px rgba(16,42,67,.22)",
                    color: isDark ? "#ffffff" : "#000000",

                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    WebkitOverflowScrolling: "touch",


                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 2,
                        py: 1.25,
                        borderBottom: `1px solid ${borderCol}`,

                    }}
                >

                    {Likes ?


                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                            Likes â€¢ {likesCount}
                        </Typography>

                        :
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

                            <Tab
                                label={`Following${counts?.following ? ` (${counts.following})` : ""}`}
                                active={view === "following"}
                                onClick={() => {
                                    setlastid(0);


                                    setActiveKey(null);

                                    setTimeout(() => { onSetView("following"); }, 300)
                                }}
                            />
                            <Tab
                                label={`Followers${counts?.followers ? ` (${counts.followers})` : ""}`}
                                active={view === "followers"}
                                onClick={() => {

                                    setlastid(0);

                                    setActiveKey(null);

                                    setTimeout(() => { onSetView("followers"); }, 200)

                                }}
                            />

                        </Box>
                    }

                    <IconButton
                        aria-label="Close"
                        onClick={onClose}
                        size="small"
                        sx={{
                            color: isDark ? "#ffffff" : "#000000",
                            borderRadius: 2,
                            "&:hover": {
                                background: `linear-gradient(0deg, ${hoverBg}, ${hoverBg}), transparent`,
                            },
                        }}
                    >
                        <CloseRounded />
                    </IconButton>
                </Box>

                {/* Scrollable content â€” render what ROOT passes, inside provider */}
                <ActiveRowContext.Provider value={{ activeKey, setActiveKey }}>
                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            px: 2,
                            py: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.25,

                            "&::-webkit-scrollbar": {
                                width: "8px",
                            },
                            "&::-webkit-scrollbar-track": {
                                background: "rgb(255,255,255,0.2)",
                            },
                            "&::-webkit-scrollbar-thumb": {
                                background: "rgb(150,150,150,0.8)",
                                borderRadius: "4px",
                            },
                            "&::-webkit-scrollbar-thumb:hover": {
                                background: "rgb(255,255,255,0.1)",
                            },
                        }}
                    >
                        {children}

                        {/* Bottom â€œLoad moreâ€ â€” placed at the real end of content */}
                        {onPaginate && !loading && rows && rows.length > 0 && (
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    py: 2,
                                }}
                            >
                                <IconButton
                                    aria-label="Load more"
                                    onClick={() => {
                                        setActiveKey(null); // collapse any expanded row
                                        onPaginate();       // root fetches next page (wipes & replaces)
                                    }}
                                    sx={{
                                        border: `1px solid ${borderCol}`,
                                        background: glassBg,
                                        color: darkModeReducer ? '#ffffff' : '#000000',
                                        "&:hover": {
                                            background: `linear-gradient(0deg, ${hoverBg}, ${hoverBg}), ${glassBg}`,
                                        },
                                    }}
                                >
                                    <AddRounded />
                                </IconButton>
                            </Box>
                        )}
                    </Box>
                </ActiveRowContext.Provider>
            </Box>
        </Box>
    );
}

/** Row â€” manages its own click; uses context so only one can be open */
export function EmotionsRow({
    item,
    index,
    isDark,
    loggedUser,
    // optional for compat; unused
    isActive: _isActiveProp,
    onToggleActive: _onToggleActive,
    rows,
    onClose,
    showEmotions,
    ownerId,
    setIsFullscreen,
    isFullscreen,
    view, Likes,
    LikesPostid,

    searchDataNav,
    MyPageIdNav,
    feedLastIdNav,
    feedScrollPosNav,

    setIsFullscreen1,
    isFullscreen1,
    setIsFullscreen2,
    isFullscreen2,
    setIsFullscreen3,
    isFullscreen3,
}: {
    item: FanRow;
    index: number;
    isDark: boolean;
    loggedUser: any;
    isActive?: boolean;
    onToggleActive?: (index: number) => void;
    rows: any;
    showEmotions: boolean;
    onClose?: () => void;
    ownerId: any;
    setIsFullscreen: any;
    isFullscreen: any;
    view: any;
    Likes: any;
    LikesPostid: any;
    searchDataNav: any;
    MyPageIdNav: any;
    feedLastIdNav: any;
    feedScrollPosNav: any;

    setIsFullscreen1: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen1: boolean;

    setIsFullscreen2: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen2: boolean;

    setIsFullscreen3: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen3: boolean;
}) {
    const theme = useTheme();
    const { activeKey, setActiveKey } = useActiveRow();


    const navigate = useNavigate();


    const location = useLocation();


    const glassBg = isDark ? alpha("#0d0f14", 0.6) : alpha("#ffffff", 0.35);
    const borderCol = isDark ? alpha("#9fb3c8", 0.18) : alpha("#102a43", 0.15);
    const hoverBg = isDark ? alpha("#ffffff", 0.08) : alpha("#000000", 0.06);

    const [connected, setConnected] = useState(false);
    useEffect(() => {
        setConnected(item.viewerFollows);
    }, [item]);

    const rowKey = item?.id ?? index;
    const isActive = activeKey === rowKey;

    const toggleSelf = () => setActiveKey(isActive ? null : rowKey);
    const stop = (e: React.MouseEvent) => e.stopPropagation();

    // const GotoProfile() = (e: React.MouseEvent) => {

    const iconTimeoutRefxx = useRef<NodeJS.Timeout | null>(null);



    const [urlName, setUrlName] = useState(location.pathname); // initial value
    const [typex, setType] = useState<number | null>(null);

    useEffect(() => {
        setUrlName(location.pathname);
    }, [location.pathname, showEmotions]); // runs whenever either changes

    useEffect(() => {
        const slug = urlName.replace(/^\/+/, "").toLowerCase(); // e.g. "/Images" -> "images"
        const mapping: Record<string, number> = {
            pages: 10,
            feeds: 4,
            images: 1,
            kickit: 2,
            clikit: 3,
        };
        setType(mapping[slug] ?? null);
    }, [urlName]);


    const GotoProfile = useCallback(
        (id: number, index: number) => {


            setIsFullscreen(false);
            setIsFullscreen1(false); setIsFullscreen2(false); setIsFullscreen3(false);

            if (iconTimeoutRefxx.current) {
                clearTimeout(iconTimeoutRefxx.current);
            }

            // Hide the icon overlay after 0.5s
            iconTimeoutRefxx.current = setTimeout(() => {


                const feedLastId = rows[index - 1] ? rows[index - 1].fan_id : 0;

                //alert(feedLastId);

                console.log(
                    `Navigating from ${location.pathname} and PageNum: ${feedLastId} to profile ${id}`
                );





                //alert(typex);
                var routeState = {
                    userId: ownerId,
                    routeScrollPos: 0,
                    routelastIdee: feedLastId,
                    follow: true,  // Added fullscreen mode flag
                    feedtype: typex,
                    viewx: view,
                    Likey: false,
                    likePostid: 0,
                    search: '',
                    ownerId: 0,
                    fullscreen: false,
                    routelastId: 0

                };

                if (Likes) {

                    routeState = {
                        userId: ownerId,
                        routeScrollPos: 0,
                        routelastIdee: feedLastId,
                        follow: true,  // Added fullscreen mode flag

                        ///// feedScrollPosNav actual holds feedtype for horizontal feeds ,basically tired of prop drilling
                        feedtype: feedScrollPosNav,
                        ///// feedScrollPosNav actual holds feedtype for horizontal feeds ,basically tired of prop drilling


                        viewx: view,
                        Likey: Likes,
                        likePostid: LikesPostid,
                        search: searchDataNav,
                        ownerId: MyPageIdNav,
                        fullscreen: true,
                        routelastId: feedLastIdNav,
                    };
                }


                navigate(location.pathname, {
                    state: routeState,
                    replace: true,
                });

                const routeState2 = {
                    userId: id,
                };

                onClose?.();
                navigate(`/pages`, {
                    state: routeState2,
                });



            }, 500);


        },
        [navigate, location.pathname, typex, isFullscreen, view, Likes]
    );



    return (
        <Box
            onClick={toggleSelf}
            role="button"
            tabIndex={0}
            aria-expanded={!!isActive}
            sx={{
                cursor: "pointer",
                width: "100%",
                display: "flex",
                alignItems: isActive ? "stretch" : "center",
                flexDirection: isActive ? "column" : "row",
                gap: 1.25,
                p: 1.25,
                borderRadius: 3,
                transition: "all .25s ease",
                "&:hover": {
                    background: `linear-gradient(0deg, ${hoverBg}, ${hoverBg}), ${glassBg}`,
                    transform: "translateY(-1px)",
                    boxShadow: isDark
                        ? "0 12px 34px rgba(0,0,0,.45)"
                        : "0 12px 34px rgba(16,42,67,.24)",
                },
            }}
            data-row-index={index}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleSelf();
                }
            }}
        >
            {/* Avatar (donâ€™t toggle) */}
            <Avatar
                onClick={
                    (e: any) => {
                        stop(e);
                        GotoProfile(item.id, index)
                    }
                }
                src={item.profile_image || undefined}
                alt={item.username}
                sx={{
                    width: 44,
                    height: 44,
                    border: `1px solid ${borderCol}`,
                    bgcolor: item.color1 || "transparent",
                    flex: "0 0 auto",
                }}
            />

            {/* Username area â€” texts donâ€™t toggle, blank area does */}
            <Box sx={{ minWidth: 0, flex: 1, pr: isActive ? 0 : 1 }}>
                <Typography
                    onClick={
                        (e: any) => {
                            stop(e);
                            GotoProfile(item.id, index)
                        }
                    }
                    variant="subtitle1"
                    fontWeight={700}
                    noWrap
                    title={item.username}
                    sx={{ lineHeight: 1.2, display: 'inline', bgcolor: '', height: 'auto', width: 'auto' }}
                >
                    {item.username}
                </Typography>

                <br></br>
                {item.last_item1 && (
                    <Typography
                        onClick={
                            (e: any) => {
                                stop(e);
                                GotoProfile(item.id, index)
                            }
                        }
                        //    onClick={ GotoProfile()}
                        variant="caption"
                        sx={{ opacity: 0.8, display: "inline", mt: 0.25, bgcolor: '', height: 'auto', width: 'auto' }}
                    >
                        latest post preview â†’
                    </Typography>
                )}
            </Box>

            {/* Follow/Plus panel (donâ€™t toggle) */}
            <Box onClick={stop} sx={{ minWidth: 0, flex: isActive ? "0 0 auto" : 0.1, pr: 1 }}>
                <FollowPanel
                    setShowEmotions={false}
                    setfollowType={0}
                    typex={true}
                    type={1}
                    userProfile={item.id}
                    loggedUser={loggedUser}
                    connected={connected}
                    setConnected={setConnected}
                    counts={30}
                    followersReducer={0}
                    followingReducer={0}
                    refresh={() => { }}
                    onFollowersClick={() => console.log("open followers list")}
                    onFollowToggle={(next) => console.log("follow ->", next)}
                />
            </Box>

            {/* Last post image (donâ€™t toggle) */}
            <Box

                onClick={
                    (e: any) => {


                        if (isActive) {
                            stop(e);
                            GotoProfile(item.id, index)
                        } else {


                        }

                    }
                }



                component="img"
                src={item.last_item1 || undefined}
                alt="last post"
                onError={(e: any) => (e.currentTarget.style.visibility = "hidden")}
                sx={{
                    width: isActive ? "40%" : 64,
                    height: isActive ? "auto" : 64,
                    objectFit: "cover",
                    textAlign: "center",
                    margin: "auto",
                    borderRadius: 2.5,
                    border: `1px solid ${borderCol}`,
                    flex: "0 0 auto",
                    transition: "all .25s ease",
                    background: item.last_item1
                        ? "transparent"
                        : `repeating-linear-gradient(45deg, #0000 0 6px, ${borderCol} 6px 12px)`,
                    mt: isActive ? 1 : 0,
                }}
            />
        </Box >
    );
}
