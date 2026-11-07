import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { useSelector } from "react-redux";
import { RootState } from "../store";

type TimerView = "full" | "minutes" | "icon";

const formatFullTime = (elapsedMs: number): string => {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
};

export default function DemoTimer() {
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColorDark = useSelector(
    (state: RootState) => state.settings.appColorDark
  );
  const appColorLight = useSelector(
    (state: RootState) => state.settings.appColorLight
  );
  const appColor = (darkMode ? appColorDark : appColorLight) || "#e8bafa";

  const [isRunning, setIsRunning] = useState(false);
  const [view, setView] = useState<TimerView>("icon"); // default to tiny icon mode
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    const autoStart = window.setTimeout(() => {
      if (hasUserInteractedRef.current) return;
      startedAtRef.current = performance.now();
      setElapsedMs(0);
      setIsRunning(true);
    }, 1500);

    return () => window.clearTimeout(autoStart);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const updateElapsed = () => {
      if (startedAtRef.current !== null) {
        setElapsedMs(performance.now() - startedAtRef.current);
      }
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const startTimer = () => {
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    setIsRunning(true);
    setView("full");
  };

  const handleTimerControl = () => {
    hasUserInteractedRef.current = true;
    if (isRunning) {
      startedAtRef.current = null;
      setIsRunning(false);
      setElapsedMs(0);
      setView("full");
      return;
    }
    startTimer();
  };

  const handleTimeClick = () => {
    hasUserInteractedRef.current = true;
    setView((current) => (current === "full" ? "minutes" : "icon"));
  };

  const showFullTimer = () => {
    hasUserInteractedRef.current = true;
    setView("full");
  };

  const minutes = Math.floor(elapsedMs / 60000);
  const isIconOnly = view === "icon";


  return (
    <Box
      data-ai-snapshot-ignore="true"
      data-dev-timer="true"
      sx={{
        position: "fixed",
        left: { xs: 18, sm: 22 },
        bottom: { xs: 84, sm: 22 },
        zIndex: 2147482990,
      }}
    >
      {isIconOnly ? (
        <Box
          component="button"
          type="button"
          aria-label="Show demo timer"
          title="Show timer"
          onClick={showFullTimer}
          sx={{
            width: 23,
            height: 23,
            minWidth: 23,
            p: 0,
            border: "1px solid rgba(0,0,0,0.16)",
            borderRadius: "50%",
            bgcolor: appColor,
            color: "#111111",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            WebkitTapHighlightColor: "transparent",
            boxShadow: "0 0 9px " + appColor,
            transition: "transform 150ms ease, box-shadow 150ms ease",
            "&:hover": {
              transform: "translateY(-2px) scale(1.04)",
              boxShadow: "0 0 12px " + appColor,
            },
            "&:active": { transform: "scale(0.96)" },
            "&:focus-visible": {
              outline: "3px solid " + appColor,
              outlineOffset: 3,
            },
          }}
        >
          <TimerOutlinedIcon sx={{ fontSize: 13 }} />
        </Box>
      ) : (
        <Box
          sx={{
            width: view === "minutes" ? 150 : 168,
            height: 60,
            p: "0 12px",
            border: "1px solid rgba(0,0,0,0.14)",
            borderRadius: 999,
            bgcolor: "#ffffff",
            color: "#111111",
            display: "flex",
            alignItems: "center",
            boxShadow: "0 8px 28px rgba(0,0,0,0.24)",
            transition: "width 180ms ease, transform 150ms ease",
            "&:hover": { transform: "translateY(-2px)" },
          }}
        >
          {view === "full" && (
          <Box
            component="button"
            type="button"
            aria-label={isRunning ? "Stop and reset demo timer" : "Start demo timer"}
            title={isRunning ? "Stop and reset timer" : "Start timer"}
            onClick={handleTimerControl}
            sx={{
              width: 38,
              height: 38,
              minWidth: 38,
              p: 0,
              border: 0,
              borderRadius: "50%",
              bgcolor: isRunning ? "rgba(0,0,0,0.05)" : "transparent",
              color: isRunning ? "#ff2020" : "#111111",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              filter: isRunning
                ? "drop-shadow(0 0 7px #ff2020)"
                : "none",
              transition:
                "color 150ms ease, filter 150ms ease, transform 150ms ease",
              "&:hover": { transform: "scale(1.08)" },
              "&:active": { transform: "scale(0.96)" },
              "&:focus-visible": {
                outline: "3px solid " + appColor,
                outlineOffset: 2,
              },
            }}
          >
            <TimerOutlinedIcon sx={{ fontSize: 25 }} />
          </Box>
          )}

          <Box
            component="button"
            type="button"
            aria-label={isRunning ? "Change timer display" : "Start demo timer"}
            onClick={handleTimeClick}
            sx={{
              flex: 1,
              alignSelf: "stretch",
              p: 0,
              border: 0,
              bgcolor: "transparent",
              color: "#111111",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              WebkitTapHighlightColor: "transparent",
              "&:focus-visible": {
                outline: "3px solid " + appColor,
                outlineOffset: -2,
                borderRadius: 999,
              },
            }}
          >
            <Box
              component="span"
              sx={{
                fontSize: view === "minutes" ? 27 : 30,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: 0,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
              }}
            >
              {view === "minutes"
                ? String(minutes) + " MIN"
                : formatFullTime(elapsedMs)}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
