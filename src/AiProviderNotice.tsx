import { Box } from "@mui/material";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "./store";
import { clearAiProviderNotice } from "./settingsSlice";
import { appColorPillFloatAndFade } from "./PixelChargeNotice";

export default function AiProviderNotice() {
  const dispatch = useDispatch();
  const notice = useSelector((state: RootState) => state.settings.aiProviderNotice);
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColor = useSelector((state: RootState) =>
    state.settings.darkMode ? state.settings.appColorDark : state.settings.appColorLight,
  );
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => dispatch(clearAiProviderNotice()), 2600);
    return () => window.clearTimeout(timer);
  }, [dispatch, notice]);
  if (!notice) return null;
  return (
    <Box key={notice.id} role="status" aria-live="polite" sx={{
      position: "fixed",
      left: "50%",
      top: "48%",
      zIndex: 20001,
      pointerEvents: "none",
      maxWidth: { xs: "86vw", sm: "min(620px, 72vw)" },
      px: 2.25,
      py: 1.1,
      borderRadius: 999,
      color: darkMode ? "#fff" : "#111",
      fontWeight: 900,
      fontSize: 13,
      letterSpacing: ".02em",
      textAlign: "center",
      background: darkMode
        ? "rgba(16,16,18,.84)"
        : "rgba(255,255,255,.9)",
      border: `1px solid ${appColor}`,
      boxShadow: `0 12px 40px color-mix(in srgb, ${appColor} 30%, transparent)`,
      backdropFilter: "blur(18px) saturate(150%)",
      animation: `${appColorPillFloatAndFade} 2.55s ease-out forwards`,
    }}>
      {notice.message}
    </Box>
  );
}
