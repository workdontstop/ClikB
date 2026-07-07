import React, { useEffect, useRef, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";

interface TopRightSpinnerProps {
    /** When true, show the spinner for durationMs. When false, hide immediately. */
    show: boolean;
    /** Duration before auto-hide (ms). Default 5000. */
    durationMs?: number;
    /** Use fixed (default) or absolute positioning. */
    fixed?: boolean;
    /** z-index for the container (default 8). */
    zIndex?: number;
}

/** Glassy spinner overlay in the top-right; auto-hides after durationMs. */
const TopRightSpinner: React.FC<TopRightSpinnerProps> = ({
    show,
    durationMs = 5000,
    fixed = true,
    zIndex = 8,
}) => {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        // Clear any prior timer whenever inputs change
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (!show) {
            // If parent turns show off, hide immediately
            setVisible(false);
            return;
        }

        // show === true -> start a new window
        setVisible(true);
        timerRef.current = window.setTimeout(() => {
            setVisible(false);
            timerRef.current = null;
        }, durationMs);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [show, durationMs]);

    if (!visible) return null;

    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                top: '3%',
                right: '43%',

                // Circular container
                width: 44,
                height: 44,
                aspectRatio: "1 / 1",
                borderRadius: "50%",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                backdropFilter: "blur(6px) saturate(120%)",
                WebkitBackdropFilter: "blur(6px) saturate(120%)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
                zIndex,
                pointerEvents: "none", // never intercept clicks/taps
            }}
        >
            {/* MUI spinner is circular and spins (indeterminate) */}
            <CircularProgress size={22} thickness={5} variant="indeterminate" />
        </div>
    );
};

export default TopRightSpinner;
