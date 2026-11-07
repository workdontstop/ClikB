import { useEffect } from "react";
import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { keyframes } from "@emotion/react";
import type { RootState } from "./store";
import { dismissAppIntro } from "./settingsSlice";
import SuperstarzIconLight from "./s.png";
import SuperstarzIconDark from "./s2.png";

/**
 * APP INTRO - the first thing the toolbar says on a fresh page load.
 *
 * Deliberately a SEPARATE component rather than another branch inside
 * PromptWelcomeUI or PromptToolbar. Those two already carry the compact-pill /
 * full-panel / mobile / PC matrix, and threading a fifth state through them is
 * how a working layout gets broken on a screen nobody re-tested. This renders
 * into the SAME slot PromptWelcomeUI's toolbar copy uses
 * (PromptToolbar's `landingToolbarContent` prop), so PromptToolbar itself is
 * untouched - it is a prop swap, not an edit.
 *
 * What it shows: the app mark on the left, the app name centred in the theme
 * accent, and nothing else. The X on the right is PromptToolbar's own close
 * control, which is already pinned to that row in both breakpoints - reusing it
 * is both less code and the only way to be certain the icon matches, since it
 * IS the icon.
 *
 * How it leaves: the 10s fallback lives here, because a component that puts
 * itself on screen should know how to take itself off. The other exit - a tap
 * anywhere in the composer - is owned by PromptInput, which is the element that
 * actually receives those events.
 */

const introFadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/** How long the intro holds the toolbar before it steps aside on its own. */
export const APP_INTRO_AUTO_DISMISS_MS = 20_000;

export const APP_INTRO_TEXT = "Visualise Your Ideas";

type PromptIntroUIProps = {
  /**
   * Compact bottom pill vs the full-height panel. Only affects type scale and
   * the logo inset - the structure is identical, which is the point.
   */
  isCompactStage?: boolean;
};

const PromptIntroUI = ({ isCompactStage = false }: PromptIntroUIProps) => {
  const dispatch = useDispatch();
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
  const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);

  const accent = (darkMode ? appColorDark : appColorLight)
    || (darkMode ? "#E8BAFA" : "#0099cc");
  const logoSrc = darkMode ? SuperstarzIconDark : SuperstarzIconLight;

  // Fallback exit. Cleared on unmount so a mode navigation mid-intro cannot
  // leave a timer running against a store that has already moved on.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      dispatch(dismissAppIntro());
    }, APP_INTRO_AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [dispatch]);

  return (
    <Box
      aria-label="ClikB introduction"
      sx={{
        // Takes the whole toolbar row so the name centres against the row, not
        // against whatever happens to sit beside it.
        flex: "1 1 auto",
        minWidth: 0,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Keep clear of PromptToolbar's absolutely-pinned close button on the
        // right, and of the logo on the left, at every width.
        px: { xs: "56px", sm: "64px" },
        animation: `${introFadeIn} 320ms ease-out`,
      }}
    >
      {/*
        * Same tile as PromptWelcomeUI's: grey/white plate, accent hairline,
        * accent glow. Duplicated rather than imported because that one is built
        * inside a component with a different job - copying 20 lines is cheaper
        * than giving PromptWelcomeUI a second reason to re-render.
        */}
      <Box
        aria-label="ClikB"
        sx={{
          position: "absolute",
          left: { xs: "8px", sm: "12px" },
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
          flexShrink: 0,
          p: { xs: "3px", sm: "4px" },
          borderRadius: { xs: "8px", sm: "10px" },
          backgroundColor: darkMode ? "rgba(128, 128, 128, 0.6)" : "#ffffff",
          border: `1px solid ${accent}`,
          boxShadow: `0 0 12px ${accent}66`,
        }}
      >
        <Box
          component="img"
          src={logoSrc}
          alt=""
          sx={{
            width: { xs: 26, sm: 30 },
            height: { xs: 26, sm: 30 },
            display: "block",
            borderRadius: { xs: "5px", sm: "6px" },
          }}
        />
      </Box>

      <Box
        component="span"
        sx={{
          color: accent,
          fontWeight: 800,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
          lineHeight: 1.2,
          fontSize: isCompactStage
            ? { xs: "0.95rem", sm: "1.05rem" }
            : { xs: "1.05rem", sm: "1.25rem" },
          textShadow: `0 0 18px ${accent}44`,
        }}
      >
        {APP_INTRO_TEXT}
      </Box>
    </Box>
  );
};

export default PromptIntroUI;
