import * as React from "react";
import { Button, Typography, Box, CircularProgress } from "@mui/material";
import { FavoriteRounded } from "@mui/icons-material";
import { alpha, useTheme, keyframes } from "@mui/material/styles";

import { useSelector } from "react-redux";
import { RootState } from "./store";

export type FollowersButtonProps = {
    count?: number;
    disabled?: boolean;
    onClick?: () => void; // e.g., open followers modal/list
    label?: string;       // optional label override (defaults to "Followers")
};

export default function FollowersButton({
    count = 0,
    disabled,
    onClick,
    label = "Followers",
}: FollowersButtonProps) {
    const theme = useTheme();

    const isDark = useSelector((state: RootState) => state.settings.darkMode);
    const glassBg = isDark ? alpha("#0d0f14", 0.6) : alpha("#ffffff", 0.35);
    const borderCol = isDark ? alpha("#9fb3c8", 0.18) : alpha("#102a43", 0.15);
    const hoverBg = isDark ? alpha("#ffffff", 0.08) : alpha("#000000", 0.06);

    /* --- NEW: 2s phasing animation + animated count (1 -> count) --- */
    const [displayCount, setDisplayCount] = React.useState(1);
    const [phasing, setPhasing] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const rafRef = React.useRef<number | null>(null);

    const phaseKF = keyframes`
    0% { opacity: .65; }
    50% { opacity: 1; }
    100% { opacity: .65; }
  `;

    const animateCount = React.useCallback((to: number) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const duration = 1000;
        const start = performance.now();
        const from = 1;

        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const val = Math.floor(from + (to - from) * t);
            setDisplayCount(val);
            if (t < 1) rafRef.current = requestAnimationFrame(step);
        };

        setDisplayCount(1);
        rafRef.current = requestAnimationFrame(step);
    }, []);

    // Run on mount and whenever `count` changes
    React.useEffect(() => {
        animateCount(count);
        setPhasing(true);
        const ph = setTimeout(() => setPhasing(false), 2000);
        return () => {
            clearTimeout(ph);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [count, animateCount]);

    const handleClick = () => {
        if (disabled || loading) return;
        // animateCount(count)
        setLoading(true);
        setPhasing(true);

        // Simulate async for 2s, then call onClick
        setTimeout(() => {
            setLoading(false);
            setPhasing(false);
            onClick?.();
        }, 20);
    };
    /* --- END NEW --- */

    return (
        <Box sx={{ width: "100%" }}>
            <Button
                fullWidth
                aria-label="View followers"
                onClick={handleClick}
                disabled={disabled}
                startIcon={
                    loading ? (
                        <CircularProgress style={{ color: isDark ? '#F6BB56' : '#ff8a00', }} size={18} thickness={5} />
                    ) : (
                        <FavoriteRounded sx={{ filter: "drop-shadow(0 0 10px rgba(255,0,85,.35))" }} />
                    )
                }
                sx={{
                    color: isDark ? '#ffffff' : '#000000',
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
                    // NEW: 2s phasing animation
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
                    <Typography variant="body1" fontWeight={600}>{label}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8, userSelect: "none" }}>
                        {displayCount.toLocaleString()}
                    </Typography>
                </Box>
            </Button>
        </Box>
    );
}
