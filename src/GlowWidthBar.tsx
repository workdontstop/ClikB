// GlowWidthBar.tsx
import { Box, Typography } from "@mui/material";
import { useMemo, useEffect } from "react";

const COLORS_12 = [
  "#FFD400", // yellow
  "#FF3B30", // red
  "#34C759", // green
  "#007AFF", // blue
  "#AF52DE", // purple
  "#FF9F0A", // orange
  "#5AC8FA", // light blue
  "#FF2D55", // pink
  "#32D74B", // lime
  "#64D2FF", // sky
  "#BF5AF2", // violet
  "#FF453A", // coral
];

export default function GlowWidthBar({
  value, // loaders[index]
  matchMobile, // boolean
  index = 0, // use index to pick a stable color
}: {
  value: number;
  matchMobile: boolean;
  index?: number;
}) {
  const color = useMemo(() => COLORS_12[index % COLORS_12.length], [index]);
  const trackWidth = matchMobile ? 80 : 160;
  const trackHeight = matchMobile ? 24 : 28;
  const v = Math.max(0, Math.min(100, value));



  if (v === 0) return null;

  console.error(`[GlowWidthBar] IS ACTIVE! index: ${index}, value: ${v}`);

  return (
    <Box sx={{
      position: "relative",
      width: trackWidth,
      height: trackHeight,
      flexShrink: 0,
      borderRadius: trackHeight / 2,
      border: `1px dashed rgba(255, 255, 255, 0.4)`,
      background: "rgba(10, 10, 10, 0.45)",
      backdropFilter: "blur(24px) saturate(120%)",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      {/* Progress fill */}
      <Box sx={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `${v}%`,
        background: `linear-gradient(90deg, ${color}aa 0%, ${color}ee 100%)`,
        transition: "width 220ms ease",
        zIndex: 0,
      }} />

      {/* Numeric text on top */}
      <Typography sx={{
        position: "relative",
        zIndex: 1,
        color: "#ffffff",
        fontSize: matchMobile ? "0.75rem" : "0.85rem",
        fontWeight: 800,
        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
      }}>
        {Math.round(v)}%
      </Typography>
    </Box>
  );
}
