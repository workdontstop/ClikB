import React, { useEffect } from "react";
import { Button, CircularProgress, Typography, Box, SvgIcon, SvgIconProps } from "@mui/material";
import { alpha, useTheme, keyframes } from "@mui/material/styles";

import { useSelector } from "react-redux";
import GroupIcon from '@mui/icons-material/Group';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import HikingIcon from '@mui/icons-material/Hiking';

import { RootState } from "./store";

/** Simple shoe icon (custom SVG) */
function ShoeIconc(props: SvgIconProps) {
    return (
        <SvgIcon {...props} viewBox="0 0 24 24">
            <path d="M3 14c2 1.6 4.2 2 6.5 2H12l1.6-2.4 3.2 2.4H22v1a4 4 0 0 1-4 4H5a3 3 0 0 1-3-3v-4z" />
            <path d="M2 16h10.5c1.2 0 2.4.5 3.3 1.3l.2.2H5a2 2 0 0 1-2-2z" opacity=".35" />
        </SvgIcon>
    );
}



function ShoeIcon(props: SvgIconProps) {
    return (
        <SvgIcon viewBox="0 0 24 24" {...props}>
            {/* heads */}
            <circle cx="8" cy="7" r="3" />
            <circle cx="16" cy="7" r="3" />

            {/* linked shoulders/arms (stroke) */}
            <path
                d="M6.75 11.25c1.7 1.4 3.4 2.1 5.25 2.1s3.55-.7 5.25-2.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />

            {/* shared torso/base (filled) */}
            <path d="M4 18.25C4 15.35 6.5 13 9.5 13h1l1.5 1.5L13.5 13h1c3 0 5.5 2.35 5.5 5.25V19.5c0 .83-.67 1.5-1.5 1.5H5.5c-.83 0-1.5-.67-1.5-1.5v-1.25z" />
        </SvgIcon>
    );
}

export type FollowingButtonProps = {
    initialFollowing?: boolean;
    initialCount?: number;   // followers count to display
    disabled?: boolean;
    onToggle?: (next: boolean) => void;
};

export default function FollowingButton({
    initialFollowing = false,
    initialCount = 0,
    disabled,
    onToggle,
}: FollowingButtonProps) {
    const theme = useTheme();
    const [following, setFollowing] = React.useState(initialFollowing);
    const [count, setCount] = React.useState(initialCount);
    const [loading, setLoading] = React.useState(false);

    // NEW: displayCount animates from 1 â†’ count over 2s
    const [displayCount, setDisplayCount] = React.useState(1);
    const rafRef = React.useRef<number | null>(null);

    // NEW: phasing flag to run a CSS phase animation for 2s
    const [phasing, setPhasing] = React.useState(false);
    const phaseKF = keyframes`
      0% { opacity: .65; }
      50% { opacity: 1; }
      100% { opacity: .65; }
    `;



    const isDark = useSelector((state: RootState) => state.settings.darkMode);
    const glassBg = isDark ? alpha("#0d0f14", 0.6) : alpha("#ffffff", 0.35);
    const borderCol = isDark ? alpha("#9fb3c8", 0.18) : alpha("#102a43", 0.15);
    const hoverBg = isDark ? alpha("#ffffff", 0.08) : alpha("#000000", 0.06);

    // NEW: count animation helper (2s)
    const animateCount = React.useCallback((to: number) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const duration = 1000;
        const start = performance.now();
        const from = 1;

        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const val = Math.floor(from + (to - from) * t);
            setDisplayCount(val);
            if (t < 1) {
                rafRef.current = requestAnimationFrame(step);
            }
        };
        setDisplayCount(1);
        rafRef.current = requestAnimationFrame(step);
    }, []);

    // NEW: run count animation & phasing on mount
    React.useEffect(() => {
        animateCount(initialCount);
        setPhasing(true);
        const ph = setTimeout(() => setPhasing(false), 2000);
        return () => {
            clearTimeout(ph);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // only once on load

    // NEW: whenever real count changes, animate again from 1 â†’ count for 2s
    React.useEffect(() => {
        animateCount(count);
        setPhasing(true);
        const ph = setTimeout(() => setPhasing(false), 2000);
        return () => clearTimeout(ph);
    }, [count, animateCount]);

    const handleClick = () => {
        if (loading || disabled) return;
        setLoading(true);
        setPhasing(true); // start the 2s phase effect on click

        // --- Dummy async behavior (simulate API) --- (now 2s to match the phase)
        window.setTimeout(() => {
            setLoading(false);
            setPhasing(false);
            setFollowing(prev => {
                const next = !prev;
                ///  setCount(c => (next ? c + 1 : Math.max(0, c - 1)));
                onToggle?.(next);
                return next;
            });
        }, 20);
    };


    useEffect(() => {
        setCount(initialCount);
    }, [initialCount])

    return (
        <Box sx={{ width: "100%" }}>
            <Button
                fullWidth
                aria-label={following ? "Unfollow" : "Start following"}
                aria-pressed={following}
                onClick={handleClick}
                disabled={disabled}
                startIcon={
                    loading ? (
                        <CircularProgress style={{ color: isDark ? '#F6BB56' : '#ff8a00', }} size={18} thickness={5} />
                    ) : (
                        <HikingIcon sx={{ filter: following ? "drop-shadow(0 0 10px rgba(0,153,255,.35))" : "none" }} />
                    )
                }
                sx={{
                    justifyContent: "flex-start",
                    gap: 1,
                    textTransform: "none",
                    borderRadius: 3,
                    px: 2,
                    py: 1.2,
                    color: isDark ? '#ffffff' : '#000000',
                    transition: "transform .12s ease, box-shadow .2s ease, background .2s ease",
                    background: glassBg,
                    border: `1px solid ${borderCol}`,
                    backdropFilter: "saturate(180%) blur(12px)",
                    WebkitBackdropFilter: "saturate(180%) blur(12px)",
                    boxShadow: isDark
                        ? "0 6px 20px rgba(0,0,0,.35)"
                        : "0 6px 24px rgba(16,42,67,.14)",

                    "&:hover": {
                        background: `linear-gradient(0deg, ${hoverBg}, ${hoverBg}), ${glassBg}`,
                        transform: "translateY(-1px)",
                        boxShadow: isDark
                            ? "0 10px 28px rgba(0,0,0,.45)"
                            : "0 10px 30px rgba(16,42,67,.22)",
                    },
                    // NEW: 2s phasing animation using CSS
                    animation: phasing ? `${phaseKF} 2s ease-in-out` : "none",
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
                        {/* Always show "Following" as the visible label */}
                        Following
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{ opacity: 0.8, transition: "opacity .2s ease", userSelect: "none" }}
                    >
                        {/* NEW: animated count (1 â†’ count in 2s) */}
                        {displayCount.toLocaleString()}
                    </Typography>
                </Box>
            </Button>
        </Box>
    );
}
