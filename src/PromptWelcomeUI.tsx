import GroupAddIcon from "@mui/icons-material/GroupAdd";
import CloseIcon from "@mui/icons-material/Close";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { keyframes } from "@emotion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Modal, Tooltip } from "@mui/material";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import type { Template } from "./PromptConstructorMock";
import type { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import SuperstarzIconLight from "./s.png";
import SuperstarzIconDark from "./s2.png";
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';

/**
 * One entry in the top selection row.
 *
 * `kind` decides the silhouette, and the silhouette is the contract: a circle
 * ("world") comes back exactly as it is, a rectangle ("image") is an identity
 * reference the story is free to reinterpret. Keep that distinction visible —
 * it is the only cue the user gets about what will happen when the story runs.
 */
export type SelectionItem = {
  id: string;
  src: string;
  kind: "world" | "image";
  /** Declared up front so width is known BEFORE the image decodes — see the
   *  measurement note in the component. Ignored for worlds, which are square. */
  aspectRatio?: string;
};

type PromptWelcomeUIProps = {
  onBeforeNavigate: () => void;
  onReselectActiveMode?: () => void;
  showcaseTemplates?: Template[];
  onSelectTemplate?: (template: Template) => void;
  onOpenTemplates?: () => void;
  onAskAiForPrompt?: () => void;
  isAskingAiForPrompt?: boolean;
  aiPromptLabel?: string;
  handleLoginSuccess?: (response: CredentialResponse) => void;
  handleLoginError?: () => void;
  toolbarOnly?: boolean;
  /** Worlds and reference images the user has selected or uploaded. */
  selectionItems?: SelectionItem[];
  /**
   * True while PromptInput is the compact bottom pill (creationStage.isCompact).
   * Drives real pixel dimensions here, not just breakpoints: the references and
   * template thumbnails each carry a minHeight floor that otherwise keeps them
   * at page scale no matter what `height` says.
   */
  isCompactStage?: boolean;
};

export const PROMPT_LANDING_CONTENT_WIDTH = { xs: "80%", sm: "50%" } as const;

const CREATION_MODES = [
  { label: "Shorts", path: "/images", key: "shorts" },
  { label: "Games", path: "/clikit", key: "games" },
  { label: "Cinema", path: "/kickit", key: "cinema" },
] as const;

const welcomeGlassSweep = keyframes`
  from { transform: translateX(-150%) rotate(20deg); }
  to { transform: translateX(150%) rotate(20deg); }
`;

const PromptWelcomeUI = ({
  onBeforeNavigate,
  onOpenTemplates,
  handleLoginSuccess,
  handleLoginError,
  toolbarOnly = false,
  selectionItems = [],
  isCompactStage = false,
}: PromptWelcomeUIProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
  const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

  const hasSelection = selectionItems.length > 0;
  const [expandedCharacterImage, setExpandedCharacterImage] = useState<string | null>(null);
  // Cold-start priority: when reference images/worlds exist, show them by default
  // and hide the 4 mode/template buttons until the user toggles.
  const [showButtonsWithRefs, setShowButtonsWithRefs] = useState(false);

  // Whenever the user clears all selections, reset toggle back to default
  useEffect(() => {
    if (!hasSelection) {
      setShowButtonsWithRefs(false);
    }
  }, [hasSelection]);

  /* ------------------------------------------------------------------
   * Centre while everything fits, hard-left once it does not.
   * ----------------------------------------------------------------- */
  const rowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isRowScrollable, setIsRowScrollable] = useState(false);

  const measureRow = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = rowRef.current;
      if (!el) return;
      setIsRowScrollable(el.scrollWidth > el.clientWidth + 1);
    });
  }, []);

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const images = Array.from(el.querySelectorAll("img"));
    if (images.some((img) => img.complete)) measureRow();
    measureRow();

    const observer = new ResizeObserver(measureRow);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [measureRow, selectionItems.length, showButtonsWithRefs]);

  useEffect(() => {
    if (isRowScrollable && rowRef.current) rowRef.current.scrollLeft = 0;
  }, [isRowScrollable]);

  const accent = (darkMode ? appColorDark : appColorLight)
    || (darkMode ? "#E8BAFA" : "#0099cc");

  const textColor = darkMode ? "#ffffff" : "#111111";
  const mutedTextColor = darkMode ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.62)";
  const logoSrc = darkMode ? SuperstarzIconDark : SuperstarzIconLight;
  const isGuest = loggedUser?.id === 1;

  const glassButtonSx = {
    width: "auto",
    minWidth: 0,
    flex: "0 0 auto",
    px: { xs: 1.25, sm: 1.6 },
    py: { xs: 0.55, sm: 0.7 },
    borderRadius: 3,
    textTransform: "none",
    whiteSpace: "nowrap",
    background: "rgba(10, 10, 10, 0.45)",
    backdropFilter: "blur(24px) saturate(120%)",
    WebkitBackdropFilter: "blur(24px) saturate(120%)",
    color: "#ffffff",
    textShadow: "none",
    border: darkMode
      ? "1px solid rgba(255,255,255,0.05)"
      : "1px solid rgba(255,255,255,0.4)",
    boxShadow: darkMode
      ? "0 8px 32px rgba(0,0,0,0.6)"
      : "0 8px 32px rgba(0,0,0,0.1)",
    transform: "translateY(-2px)",
    transition: "background 250ms ease, box-shadow 250ms ease, transform 120ms ease, border 250ms ease",
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '\"\"',
      position: "absolute",
      top: "-40%",
      left: 0,
      width: "60%",
      height: "180%",
      background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
      backgroundSize: "200% 200%",
      transform: "translateX(-150%) rotate(20deg)",
      opacity: 0,
      pointerEvents: "none",
    },
    "&:hover": {
      background: "rgba(15, 15, 15, 0.65)",
      boxShadow: darkMode
        ? "0 8px 32px rgba(0,0,0,0.8)"
        : "0 8px 32px rgba(0,0,0,0.2)",
      transform: "translateY(0)",
      "&::before": {
        opacity: 0.8,
        animation: `${welcomeGlassSweep} 1.8s ease-out forwards`,
      },
    },
    "&:active": {
      background: "rgba(5, 5, 5, 0.55)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
      transform: "translateY(0)",
      "&::before": {
        opacity: 0.8,
        animation: `${welcomeGlassSweep} 1.2s ease-out forwards`,
      },
    },
    "&:focus, &:focus-visible, &.Mui-focusVisible": {
      outline: "none",
      boxShadow: "none",
      backgroundColor: "rgba(255,255,255,0.10)",
    },
    "&.Mui-disabled": {
      color: mutedTextColor,
      borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
      background: darkMode ? "rgba(10,10,10,0.34)" : "rgba(255,255,255,0.2)",
    },
    WebkitTapHighlightColor: "transparent",
    "::-moz-focus-inner": { border: 0 },
  };

  const navigateToMode = (path: string) => {
    if (location.pathname.toLowerCase() === path.toLowerCase()) {
      return;
    }

    onBeforeNavigate();
    navigate(path);
  };

  const isFeedsRoute = location.pathname.toLowerCase() === "/feeds";
  const showingFourButtons = !isFeedsRoute && (!hasSelection || showButtonsWithRefs);
  const showingReferenceRow = hasSelection && (isFeedsRoute || !showButtonsWithRefs);

  useCreationControls('welcome', 'PromptWelcomeUI', !toolbarOnly, {
    route: location.pathname,
    hasSelection,
    showingFourButtons,
    showingReferenceRow,
  });

  const logoTile = (
    <Tooltip title="ClikB" arrow>
      <Box
        aria-label="ClikB"
        sx={{
          flexShrink: 0,
          ...(isCompactStage && toolbarOnly ? {
            position: "absolute",
            left: { xs: "8px", sm: "12px" },
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 2,
          } : {}),
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
    </Tooltip>
  );

  if (toolbarOnly) {
    return (
      <Box
        aria-label="ClikB account and app controls"
        sx={{
          order: isCompactStage ? -1 : 0,
          flex: isCompactStage ? "0 1 auto" : "1 1 auto",
          minWidth: 0,
          ml: isCompactStage ? 0 : { xs: 0.5, sm: 1 },
          mr: isCompactStage ? { xs: 0.5, sm: 1 } : 0,
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.5, sm: 1 },
        }}
      >
        {logoTile}

        <Box sx={{ ml: "auto", display: { xs: "none", lg: "flex" }, alignItems: "center", gap: 1 }}>
          {isGuest && handleLoginSuccess && handleLoginError ? (
            <GoogleLogin
              theme={darkMode ? "filled_black" : "outline"}
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              shape="pill"
              size="medium"
              width={190}
            />
          ) : null}
        </Box>

        <Box sx={{ ml: "auto", display: { xs: "flex", lg: "none" }, alignItems: "center", gap: 0.5 }}>
          {isGuest && handleLoginSuccess && handleLoginError ? (
            <Tooltip title="Sign in with Google" arrow>
              <Box
                aria-label="Sign in with Google"
                sx={{
                  ...glassButtonSx,
                  position: "relative",
                  display: "flex",
                  width: 38,
                  height: 38,
                  minWidth: 38,
                  p: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                }}
              >
                <GroupAddIcon aria-hidden="true" sx={{ fontSize: "1.15rem" }} />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: "50%",
                    opacity: 0.001,
                  }}
                >
                  <GoogleLogin
                    theme={darkMode ? "filled_black" : "outline"}
                    onSuccess={handleLoginSuccess}
                    onError={handleLoginError}
                    type="icon"
                    shape="circle"
                    size="medium"
                  />
                </Box>
              </Box>
            </Tooltip>
          ) : null}
        </Box>
      </Box>
    );
  }

  // Exactly matches the parent PromptInput surface: transparent background showing promptinput through + slight clean border
  const getGlassButtonSx = (isActive: boolean) => ({
    flex: { xs: "1 1 0", sm: "0 1 135px" },
    minWidth: { xs: 68, sm: 108 },
    height: isCompactStage ? 32 : { xs: 34, sm: 36 },
    minHeight: isCompactStage ? 32 : { xs: 34, sm: 36 },
    px: { xs: 1.25, sm: 2 },
    py: 0,
    borderRadius: "14px",
    textTransform: "none",
    fontSize: isCompactStage ? "0.68rem" : { xs: "0.72rem", sm: "0.74rem" },
    fontWeight: isActive ? 800 : 700,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
    color: isActive
      ? `${accent} !important`
      : (darkMode ? "rgba(255,255,255,0.78) !important" : "rgba(17,19,24,0.72) !important"),
    background: isActive
      ? (darkMode ? "rgba(255, 255, 255, 0.08) !important" : "rgba(255, 255, 255, 0.38) !important")
      : "transparent !important",
    backgroundColor: isActive
      ? (darkMode ? "rgba(255, 255, 255, 0.08) !important" : "rgba(255, 255, 255, 0.38) !important")
      : "transparent !important",
    backdropFilter: "none !important",
    WebkitBackdropFilter: "none !important",
    border: darkMode
      ? (isActive ? `1.5px solid ${accent} !important` : "1px solid rgba(255, 255, 255, 0.14) !important")
      : (isActive ? `1.5px solid ${accent} !important` : "1px solid rgba(0, 0, 0, 0.10) !important"),
    outline: "none",
    boxShadow: "none !important",
    transition: "background 150ms ease, border-color 150ms ease, color 150ms ease, transform 120ms ease",
    "&:hover": {
      background: darkMode
        ? (isActive ? "rgba(255, 255, 255, 0.12) !important" : "rgba(255, 255, 255, 0.06) !important")
        : (isActive ? "rgba(255, 255, 255, 0.50) !important" : "rgba(255, 255, 255, 0.22) !important"),
      backgroundColor: darkMode
        ? (isActive ? "rgba(255, 255, 255, 0.12) !important" : "rgba(255, 255, 255, 0.06) !important")
        : (isActive ? "rgba(255, 255, 255, 0.50) !important" : "rgba(255, 255, 255, 0.22) !important"),
      borderColor: `${accent} !important`,
      color: `${accent} !important`,
      boxShadow: "none !important",
    },
    "&:active": {
      transform: "translateY(0)",
    },
    "&:focus, &:focus-visible, &.Mui-focusVisible": {
      outline: "none !important",
      boxShadow: "none !important",
    },
  });

  return (
    <Box
      component="section"
      aria-label="ClikB creation welcome"
      sx={{
        width: "100%",
        boxSizing: "border-box",
        px: { xs: 1.25, sm: 0 },
        pb: { xs: 0.25, sm: 0.35 },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 0.5, sm: 0.65 },
        color: textColor,
      }}
    >
      {/* Top row above the text field: 4 wide, short blended buttons (Shorts | Games | Cinema | Templates) + Reference toggle when references exist */}
      {!isFeedsRoute && (
        <Box
          sx={{
            width: isCompactStage
              ? "100%"
              : { xs: "100%", sm: PROMPT_LANDING_CONTENT_WIDTH.sm },
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: { xs: 0.6, sm: 0.85 },
            pt: isCompactStage ? 0.35 : { xs: 0.45, sm: 0.65 },
            pb: 0.2,
            px: isCompactStage ? { xs: 0.75, sm: 1 } : 0,
          }}
        >
          {showingFourButtons && (
            <Box
              role="navigation"
              aria-label="Creation modes and templates"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: { xs: 0.6, sm: 0.9 },
                flex: "1 1 auto",
                minWidth: 0,
              }}
            >
              {CREATION_MODES.map((mode) => {
                const isActive = location.pathname.toLowerCase() === mode.path;
                return (
                  <Button
                    key={mode.path}
                    disableRipple
                    disableFocusRipple
                    aria-current={isActive ? "page" : undefined}
                    {...cb('welcome', `mode_${mode.key}`, mode.label, 'navigateToMode')}
                    onClick={() => navigateToMode(mode.path)}
                    sx={getGlassButtonSx(isActive)}
                  >
                    {mode.label}
                  </Button>
                );
              })}

              {/* 4th Button: Templates */}
              <Button
                disableRipple
                disableFocusRipple
                {...cb('welcome', 'open_templates', 'Open Templates popup', 'onOpenTemplates')}
                onClick={() => onOpenTemplates?.()}
                sx={getGlassButtonSx(false)}
              >
                Templates
              </Button>
            </Box>
          )}

          {/* Toggle button when reference images exist so user can switch between Reference Images and the 4 Mode/Template buttons */}
          {hasSelection && (
            <Button
              variant="contained"
              disableRipple
              disableFocusRipple
              size="small"
              startIcon={<SwapHorizIcon sx={{ fontSize: 15 }} />}
              onClick={() => setShowButtonsWithRefs((prev) => !prev)}
              {...cb(
                'welcome',
                'toggle_refs_or_modes',
                showButtonsWithRefs
                  ? `Show selected reference images (${selectionItems.length})`
                  : 'Show Shorts, Games, Cinema & Templates buttons',
                'setShowButtonsWithRefs'
              )}
              sx={{
                ...getGlassButtonSx(false),
                flex: "0 0 auto",
                ml: showingFourButtons ? "auto" : 0,
                height: isCompactStage ? 30 : 32,
                minHeight: isCompactStage ? 30 : 32,
                px: 1.5,
                color: textColor,
              }}
            >
              {showButtonsWithRefs
                ? `References (${selectionItems.length})`
                : "Modes & Templates"}
            </Button>
          )}
        </Box>
      )}

      {/* Reference Images / Worlds Row (Shown by default when hasSelection is true) */}
      {showingReferenceRow && (
        <Box
          ref={rowRef}
          role="navigation"
          aria-label="Selected worlds and images"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: isRowScrollable ? "flex-start" : "center",
            width: "100%",
            height: isCompactStage ? (matchMobile ? 165 : 183.61728) : { xs: "30svh", sm: "25dvh" },
            minHeight: isCompactStage ? (matchMobile ? 165 : 183.61728) : { xs: 190, sm: 180 },
            maxHeight: isCompactStage ? (matchMobile ? 165 : 183.61728) : { xs: 300, sm: 260 },
            gap: isCompactStage ? 0.6 : { xs: 1, sm: 1.1 },
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {selectionItems.map((item) => {
            const isWorld = item.kind === "world";
            return (
              <Box
                key={item.id}
                role={!isWorld ? "button" : undefined}
                tabIndex={!isWorld ? 0 : undefined}
                aria-label={!isWorld ? "Enlarge character image" : undefined}
                onClick={() => {
                  if (!isWorld) setExpandedCharacterImage(item.src);
                }}
                onKeyDown={(event) => {
                  if (isWorld || (event.key !== "Enter" && event.key !== " ")) return;
                  event.preventDefault();
                  setExpandedCharacterImage(item.src);
                }}
                sx={{
                  position: "relative",
                  height: "100%",
                  width: "auto",
                  aspectRatio: isWorld ? "1 / 1" : (item.aspectRatio || "9 / 16"),
                  flex: "0 0 auto",
                  borderRadius: isWorld ? "50%" : 3,
                  overflow: isWorld ? "visible" : "hidden",
                  border: isWorld
                    ? "2px solid rgba(255,255,255,0.9)"
                    : "1px solid rgba(255,255,255,0.16)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                  background: "#111",
                  cursor: isWorld ? "default" : "zoom-in",
                  transform: "scale(0.85)",
                }}
              >
                <Box
                  component="img"
                  src={item.src}
                  alt=""
                  loading="lazy"
                  onLoad={measureRow}
                  onError={measureRow}
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                    borderRadius: isWorld ? "50%" : 0,
                  }}
                />
              </Box>
            );
          })}
        </Box>
      )}

      <Modal
        open={Boolean(expandedCharacterImage)}
        onClose={() => setExpandedCharacterImage(null)}
        aria-label="Expanded character image"
        sx={{ zIndex: 12000 }}
      >
        <Box
          onClick={() => setExpandedCharacterImage(null)}
          sx={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.94)",
            backdropFilter: "blur(12px)",
            p: { xs: 2, sm: 4 },
            boxSizing: "border-box",
          }}
        >
          <IconButton
            aria-label="Close enlarged character image"
            onClick={() => setExpandedCharacterImage(null)}
            sx={{
              position: "fixed",
              top: { xs: "max(12px, env(safe-area-inset-top))", sm: 20 },
              right: { xs: "max(12px, env(safe-area-inset-right))", sm: 20 },
              zIndex: 1,
              width: 48,
              height: 48,
              color: "#fff",
              background: "rgba(20,20,20,0.76)",
              border: "1px solid rgba(255,255,255,0.22)",
              "&:hover": { background: "rgba(40,40,40,0.9)" },
            }}
          >
            <CloseIcon />
          </IconButton>

          {expandedCharacterImage && (
            <Box
              component="img"
              src={expandedCharacterImage}
              alt="Expanded character reference"
              onClick={(event) => event.stopPropagation()}
              sx={{
                display: "block",
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "calc(100dvh - 32px)",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: { xs: 1.5, sm: 2.5 },
                boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
              }}
            />
          )}
        </Box>
      </Modal>
    </Box>
  );
};

export default PromptWelcomeUI;
