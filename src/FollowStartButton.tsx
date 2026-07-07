import React, { useEffect, useRef } from "react";
import axios from "axios";

import { Button, CircularProgress, Typography, Box } from "@mui/material";
import { PersonAddRounded, HowToRegRounded } from "@mui/icons-material";

import { useDispatch } from "react-redux";



import { IconButton, ButtonBase } from "@mui/material";

import AddRounded from "@mui/icons-material/AddRounded";


import { setFollowersCount, setFollowingCount, incrementFollowingCount, deFollowingCount } from "./settingsSlice";

import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import HikingIcon from '@mui/icons-material/Hiking';
import SnowshoeingIcon from '@mui/icons-material/Snowshoeing';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import { alpha, useTheme, keyframes } from "@mui/material/styles";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import AddIcon from '@mui/icons-material/Add';

import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
//import { setTimeout } from "timers/promises";
// If you already export CLIK_URL from somewhere, import it instead:
// import { CLIK_URL } from "./config"; alert

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

export type FollowButtonProps = {
    userid: number;             // <--- ADDED
    favid: number;              // <--- ADDED
    initialFollowing?: boolean;
    initialCount?: number;
    disabled?: boolean;
    onToggle?: (next: boolean) => void;
    setConnected: any;
    connected: any;
    refresh: any;
    type: any;
    typex: any;

};

export default function StartFollowButton({
    userid,
    favid,
    initialFollowing = false,
    initialCount = 0,
    disabled,
    onToggle,
    setConnected,
    refresh,
    type,
    typex = false,
    connected
}: FollowButtonProps) {
    const theme = useTheme();
    const isDark = useSelector((s: RootState) => s.settings.darkMode);

    const glassBg = isDark ? alpha("#0d0f14", 0.6) : alpha("#ffffff", 0.35);
    const borderCol = isDark ? alpha("#9fb3c8", 0.18) : alpha("#102a43", 0.15);
    const hoverBg = isDark ? alpha("#ffffff", 0.08) : alpha("#000000", 0.06);
    const hoverBgx = isDark ? alpha("#ffffff", 0.68) : alpha("#000000", 0.46);
    const sweepKF = keyframes`
    0%   { transform: translateX(-120%); }
    100% { transform: translateX(220%); }
  `;


    const dispatch = useDispatch<any>();

    const [following, setFollowing] = React.useState(initialFollowing);
    const [followingx, setFollowingx] = React.useState(false);
    const [count, setCount] = React.useState(initialCount);
    const [loading, setLoading] = React.useState(false);
    const [sweepBg, setSweepBg] = React.useState<string | null>(null);


    useEffect(() => {

        setFollowingx(following);

        setTimeout(() => {
            setFollowingx(false);
        }, 3500)

    }, [following,])



    useEffect(() => {


        setFollowing(connected);


    }, [connected])


    const inFlightRef = useRef<AbortController | null>(null);

    const pickRandomSweep = React.useCallback(() => {
        const pool = [
            theme.palette.primary.main,
            theme.palette.secondary?.main ?? "#a78bfa",
            theme.palette.success.main,
            theme.palette.info.main,
            theme.palette.warning.main,
            theme.palette.error.main,
            "#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#f59e0b", "#14b8a6", "#60a5fa", "#f97316",
        ];
        const base = pool[Math.floor(Math.random() * pool.length)];
        const soft = alpha(base, isDark ? 0.18 : 0.14);
        const strong = alpha(base, isDark ? 0.30 : 0.22);
        return `linear-gradient(90deg, transparent 0%, ${soft} 18%, ${strong} 50%, ${soft} 82%, transparent 100%)`;
    }, [isDark, theme.palette]);

    const handleClick = async () => {
        if (disabled || loading) return;

        // show the pretty loader
        setSweepBg(pickRandomSweep());
        setLoading(true);

        // abort any prior request
        inFlightRef.current?.abort();
        const controller = new AbortController();
        inFlightRef.current = controller;

        const next = typex ? !following : true; // the state we intend to toggle to


        setTimeout(async () => {
            const dataHold = {
                userid,                         // from props
                favid,                          // from props
                /// action: next ? "follow" : "unfollow",
                action: next ? "follow" : 'unfollow',
            };

            try {
                // match your axios style (withCredentials)
                var tt: any = await axios.post(
                    `${CLIK_URL}/fantoggle`, // <-- use your real route, e.g. /fan/toggle or /follow
                    { values: dataHold },
                    { withCredentials: true, }
                );

                // success â†’ commit local UI
                setFollowing(next);


                console.log('toooggle follow', tt.data.state);



                var tt = tt.data.state;

                if (tt === 'unfollowed') {
                    ///  setConnected(false)

                    dispatch(deFollowingCount());

                }


                if (tt === 'already_following') { } else {

                    if (tt === 'followed') {
                        // alert('kkk');
                        dispatch(incrementFollowingCount());
                    }
                }



                refresh();

                setCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
                onToggle?.(next);


            } catch (err) {

                //  alert('ll');
                // optional: toast/snackbar here
                console.error("Follow toggle failed:", err);

            } finally {
                setLoading(false);
                inFlightRef.current = null;
            }
        }, 1000)
    };

    React.useEffect(() => {
        return () => {
            inFlightRef.current?.abort();
        };
    }, []);

    const Icon = following ? HowToRegRounded : PersonAddRounded;

    return (
        <Box sx={{ width: "100%" }}>



            {

                type >= 1 ?

                    <IconButton


                        aria-label="Add"
                        size="small"
                        onClick={handleClick}
                        ///onClick={() => { onPlus?.(item.id) }}
                        sx={{

                            ...(loading && {
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    left: 0,
                                    width: "42%",
                                    borderRadius: "inherit",
                                    background: sweepBg ?? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.16),
                                    transform: "translateX(-120%)",
                                    animation: `${sweepKF} 1.1s linear infinite`,
                                    pointerEvents: "none",
                                },
                            }),

                            mr: 0.5,
                            borderRadius: 2,
                            border: `1px solid ${borderCol}`,
                            background: typex ? `linear-gradient(0deg, ${hoverBg}, ${hoverBg})` : `linear-gradient(0deg, ${hoverBgx}, ${hoverBgx})`,
                            "&:hover": { background: hoverBg },
                        }}
                    >


                        {loading ? <HikingIcon /> :
                            following ?
                                <HikingIcon />
                                : <AddRounded />}
                    </IconButton>


                    :



                    <Button


                        fullWidth
                        aria-label={following ? "Unfollow" : "Follow"}
                        aria-pressed={following}
                        onClick={handleClick}
                        disabled={disabled}
                        startIcon={
                            loading ? (
                                <CircularProgress style={{ color: isDark ? "#F6BB56" : "#ff8a00", display: type >= 1 ? 'none' : 'flex' }} size={18} thickness={5} />
                            ) : (
                                <Icon style={{ color: following ? isDark ? 'yellow' : 'green' : '', display: type >= 1 ? 'none' : 'flex' }} />
                            )
                        }
                        sx={{
                            color: isDark ? '#ffffff' : '#000000',
                            position: "relative",
                            overflow: "hidden",
                            justifyContent: "flex-start",
                            gap: 1,
                            textTransform: "none",
                            borderRadius: 3,
                            px: 2,
                            py: 1.2,
                            transition: "transform .12s ease, box-shadow .2s ease, background .2s ease",
                            background: glassBg,
                            border: `1px solid ${borderCol}`,
                            backdropFilter: "saturate(180%) blur(12px)",
                            WebkitBackdropFilter: "saturate(180%) blur(12px)",
                            boxShadow: isDark ? "0 6px 20px rgba(0,0,0,.35)" : "0 6px 24px rgba(16,42,67,.14)",

                            "&:hover": {
                                background: `linear-gradient(0deg, ${hoverBg}, ${hoverBg}), ${glassBg}`,
                                transform: "translateY(-1px)",
                                boxShadow: isDark ? "0 10px 28px rgba(0,0,0,.45)" : "0 10px 30px rgba(16,42,67,.22)",
                            },
                            ...(loading && {
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    left: 0,
                                    width: "42%",
                                    borderRadius: "inherit",
                                    background: sweepBg ?? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.16),
                                    transform: "translateX(-120%)",
                                    animation: `${sweepKF} 1.1s linear infinite`,
                                    pointerEvents: "none",
                                },
                            }),
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 1,
                                width: "100%",
                                justifyContent: "space-between",

                            }}
                        >
                            <Typography variant="body1" fontWeight={600}>


                                {


                                    type >= 1 ? '' : following ? 'Done' :
                                        loading ? 'Following' : 'Follow'}</Typography>



                            <Typography variant="body2" sx={{
                                opacity: 0.8, userSelect: "none",
                                color:
                                    followingx ? isDark ? 'yellow' : 'green' : ''
                            }}>
                                {loading ? type >= 1 ? <HikingIcon /> : <DirectionsRunIcon /> :
                                    type >= 1 ?

                                        type === 2 ? <HikingIcon /> : following ? <HikingIcon /> : <PersonAddIcon />
                                        : <HikingIcon />}


                            </Typography>
                        </Box>
                    </Button >

            }
        </Box >
    );
}
