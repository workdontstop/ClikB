import { Box } from "@mui/material";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "./store";
import { clearPixelChargeNotice } from "./settingsSlice";

import { appColorHintPillSx } from "./appNoticeStyles";
export { appColorPillFloatAndFade } from "./appNoticeStyles";

export default function PixelChargeNotice() {
  const dispatch = useDispatch();
  const notice = useSelector((state: RootState) => state.settings.pixelChargeNotice);
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColor = useSelector((state: RootState) =>
    state.settings.darkMode ? state.settings.appColorDark : state.settings.appColorLight,
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => dispatch(clearPixelChargeNotice()), 2600);
    return () => window.clearTimeout(timer);
  }, [notice, dispatch]);

  if (!notice) return null;
  return (
    <Box
      key={notice.id}
      role="status"
      aria-live="polite"
      sx={appColorHintPillSx(appColor, darkMode)}
    >
      −{notice.pixels.toLocaleString()}P · {notice.label}
    </Box>
  );
}
