// GlowWidthBar.tsx
// Ultra-light progress overlay: thin white line on a black track across the
// middle of the content, subtle dim over the content, percent at top-left.
//
// Built for MANY simultaneous instances:
//  - no backdrop-filter (GPU blur was the #1 perf killer of the old bar)
//  - progress animates via transform: scaleX (compositor-only, no layout/paint)
//  - React.memo with rounded-percent comparator: re-renders only on whole-% change
//  - no console logging
import { memo } from "react";
import { Box, Typography } from "@mui/material";

type GlowWidthBarProps = {
  value: number;
  matchMobile: boolean;
  index?: number; // kept for call-site compatibility (no longer drives color)
  message?: string;
};

function GlowWidthBarInner({ value, matchMobile, message = "" }: GlowWidthBarProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));

  if (v === 0) return null;

  return (
    <Box sx={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none" }}>
      {/* Slight dim of the content while the model is active */}
      <Box sx={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.30)" }} />

      {/* Percent - top-left of content */}
      <Typography
        sx={{
          position: "absolute",
          top: 8,
          left: 10,
          color: "#fff",
          fontSize: matchMobile ? "0.7rem" : "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          lineHeight: 1,
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}
      >
        {v}%
      </Typography>

      {message && (
        <Typography
          sx={{
            position: "absolute",
            left: 12,
            right: 12,
            top: "calc(50% - 24px)",
            color: "#fff",
            fontSize: matchMobile ? "0.64rem" : "0.76rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1,
            textAlign: "center",
            textTransform: "uppercase",
            textShadow: "0 1px 4px rgba(0,0,0,0.95)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {message}
        </Typography>
      )}

      {/* Thin black track: full content width, middle height, dark shadow */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: "2px",
          transform: "translateY(-50%)",
          background: "rgba(0,0,0,0.65)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }}
      >
        {/* White progress line (compositor-only scaleX animation) */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            transformOrigin: "left center",
            transform: `scaleX(${v / 100})`,
            transition: "transform 200ms linear",
            willChange: "transform",
          }}
        />
      </Box>
    </Box>
  );
}

// Skip re-renders unless the whole percent (or breakpoint) actually changed.
export default memo(
  GlowWidthBarInner,
  (prev, next) =>
    Math.round(prev.value) === Math.round(next.value) &&
    prev.matchMobile === next.matchMobile &&
    prev.message === next.message
);
