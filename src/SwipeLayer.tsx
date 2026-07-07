import React, { useRef } from "react";

type Dir = "left" | "right";

interface Props {
    onSwipe: (dir: Dir) => void;
    withinMs?: number;        // default 500 (for swipe)
    thresholdPx?: number;     // overrides adaptive swipe threshold
    zIndex?: number;          // default 4
}

const TAP_MS = 250; // quick tap window
const TAP_ZONE_FRAC = 0.25; // left/right 25% zones

/** Full-frame transparent overlay that detects LEFT/RIGHT swipes or quick taps on outer 25% bands. */
const SwipeLayer: React.FC<Props> = ({
    onSwipe,
    withinMs = 500,
    thresholdPx,
    zIndex = 4,
}) => {
    const start = useRef<{ x: number; t: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, t: performance.now() };
    };

    const reset = (e?: React.PointerEvent<HTMLDivElement>) => {
        if (e) e.currentTarget.releasePointerCapture(e.pointerId);
        start.current = null;
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const s = start.current;
        reset(e);
        if (!s) return;

        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();

        const dx = e.clientX - s.x;
        const dt = performance.now() - s.t;

        // Adaptive horizontal threshold: 8% of width, clamped 40..100px
        const thrX = thresholdPx ?? Math.max(40, Math.min(100, Math.round(rect.width * 0.08)));

        // Swipe: anywhere on the element
        if (dt <= withinMs && Math.abs(dx) >= thrX) {
            onSwipe(dx > 0 ? "right" : "left");
            return;
        }

        // Quick tap: ONLY outer 25% bands; middle 50% does nothing
        if (dt <= TAP_MS && Math.abs(dx) < thrX) {
            const xRel = s.x - rect.left; // position at pointer down
            const w = rect.width;
            const leftBand = w * TAP_ZONE_FRAC;
            const rightBand = w * (1 - TAP_ZONE_FRAC);

            if (xRel <= leftBand) {
                onSwipe("left");
            } else if (xRel >= rightBand) {
                onSwipe("right");
            } else {
                // middle tap ignored
                // (optional) console.log("tap in middle (ignored)");
            }
        }
    };

    const onPointerCancel = () => reset();
    const onPointerLeave = () => reset();

    return (
        <div
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
            style={{
                position: "absolute",
                inset: 0,
                background: "transparent",
                touchAction: "pan-y", // allow vertical scroll; we only care about horizontal
                cursor: "default",
                zIndex,
            }}
        />
    );
};

export default SwipeLayer;
