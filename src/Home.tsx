import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Button, IconButton } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import SuperstarzIconLight from "./s.png";
import SuperstarzIconDark from "./s2.png";
import CloseIcon from "@mui/icons-material/Close";
import { matchMobile } from "./DetectDevice";
import { setLogin } from "./settingsSlice";

const SPLASH_MS = 3000;

const Home = ({ handleLoginError, handleLoginSuccess }: any) => {
    const dispatch = useDispatch();
    const darkMode = useSelector((s: RootState) => s.settings.darkMode);
    const isLoggedIn = useSelector((s: RootState) => s.settings.login);

    const [expanded, setExpanded] = useState(true);
    const [showSplash, setShowSplash] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        // Old splash logic removed: FirstLoader handles entry
        setShowSplash(false);
    }, [isLoggedIn]);

    const logoSrc = darkMode ? SuperstarzIconDark : SuperstarzIconLight;

    // âœ… Your rule: darkMode -> #000, !darkMode -> #fff
    const brandTextColor = !darkMode ? "#000" : "#fff";
    const accent = darkMode ? "yellow" : "#ff3b30";

    const overlayBg = showSplash
        ? (darkMode ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.98)")
        : "rgba(0,0,0,0.12)";

    const sheetHeight = useMemo(() => {
        if (matchMobile) return expanded ? "86vh" : "64vh";
        return expanded ? "78vh" : "56vh";
    }, [expanded]);

    const handleClose = () => dispatch(setLogin(false));
    const toggleExpanded = () => setExpanded((v) => !v);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!showSplash && isLoggedIn && e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isLoggedIn, showSplash]);

    return (
        <>
            <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.985) } to { opacity: 1; transform: scale(1) } }
        @keyframes slideUp { from { transform: translateY(28px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .splash-shimmer {
          background: linear-gradient(90deg, rgba(127,127,127,0.1), rgba(127,127,127,0.35), rgba(127,127,127,0.1));
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 2.4s infinite;
        }
      `}</style>

            <div
                onClick={() => { if (!showSplash) handleClose(); }}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 200000,
                    display: isLoggedIn ? "flex" : "none",
                    alignItems: showSplash ? "center" : "flex-end",
                    justifyContent: "center",
                    background: showSplash
                        ? overlayBg
                        : `
                radial-gradient(1200px 60% at 50% 100%, ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} 0%, transparent 60%),
                ${overlayBg}
              `,
                    backdropFilter: showSplash
                        ? (darkMode ? "blur(4px)" : "blur(2px)")
                        : (matchMobile ? "blur(8px)" : "blur(12px)"),
                    transition: "background 320ms ease, backdrop-filter 320ms ease",
                    cursor: showSplash ? "default" : "pointer",
                    color: brandTextColor,
                }}
            >
                {/* SPLASH */}
                {showSplash && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                            gap: matchMobile ? 16 : 20,
                            animation: "fadeIn 320ms ease",
                            color: brandTextColor,
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Welcome to ClikB"
                    >
                        <img
                            src={logoSrc}
                            alt="ClikB"
                            style={{
                                width: matchMobile ? "34vw" : 120,
                                height: "auto",
                                filter: darkMode ? "drop-shadow(0 2px 10px rgba(255,255,255,0.1))" : "none",
                            }}
                        />
                        <div
                            style={{
                                marginTop: 6,
                                fontSize: matchMobile ? "1.15rem" : "1.35rem",
                                letterSpacing: 0.2,
                                fontWeight: 700,
                                textAlign: "center",
                                color: brandTextColor,
                                padding: "0 16px",
                            }}
                        >
                            <span className="splash-shimmer">ðŸŽ¨ Express Yourself</span>
                        </div>
                        <button
                            onClick={() => setShowSplash(false)}
                            style={{
                                position: "absolute",
                                right: matchMobile ? 16 : 24,
                                bottom: matchMobile ? 16 : 24,
                                background: "transparent",
                                border: "none",
                                fontSize: "0.95rem",
                                cursor: "pointer",
                                padding: "8px 10px",
                                color: accent,
                                textDecoration: "underline",
                            }}
                            aria-label="Skip"
                        >
                            Skip
                        </button>
                    </div>
                )}

                {/* SHEET */}
                {!showSplash && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(900px, 96vw)",
                            height: sheetHeight,
                            marginBottom: 0,
                            padding: matchMobile ? "18px" : "24px",
                            borderRadius: "20px 20px 0 0",
                            position: "relative",
                            cursor: "default",
                            animation: "slideUp 420ms ease",
                            transition: "height 280ms ease",
                            background: darkMode
                                ? "linear-gradient(180deg, rgba(22,22,22,0.72), rgba(12,12,12,0.58))"
                                : "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(248,248,248,0.74))",
                            backdropFilter: matchMobile ? "blur(16px)" : "blur(22px)",
                            boxShadow: darkMode
                                ? "0 24px 80px rgba(0,0,0,0.55)"
                                : "0 24px 80px rgba(0,0,0,0.2)",
                            border: darkMode
                                ? "1px solid rgba(255,255,255,0.08)"
                                : "1px solid rgba(0,0,0,0.06)",
                            color: brandTextColor,
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="clikb-title"
                    >
                        {/* top accent */}
                        <div
                            aria-hidden
                            style={{
                                position: "absolute",
                                top: 0,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: "64px",
                                height: "4px",
                                borderRadius: 999,
                                background: darkMode
                                    ? "linear-gradient(90deg, #FFD600, #FFF388)"
                                    : "linear-gradient(90deg, #ff3b30, #ff8a80)",
                                opacity: 0.8,
                            }}
                        />

                        {/* Close */}
                        <IconButton
                            onClick={handleClose}
                            aria-label="Close"
                            style={{
                                position: "absolute",
                                top: matchMobile ? 8 : 10,
                                right: matchMobile ? 8 : 10,
                                color: brandTextColor,
                            }}
                        >
                            <CloseIcon />
                        </IconButton>

                        {/* LAYOUT */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: matchMobile ? "1fr" : "1.1fr 0.9fr",
                                gap: matchMobile ? 16 : 24,
                                height: "100%",
                            }}
                        >
                            {/* LEFT: copy + chips (unchanged) */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: matchMobile ? "center" : "top",
                                    alignItems: matchMobile ? "center" : "top",
                                    textAlign: "center",
                                    paddingTop: matchMobile ? 12 : 0,
                                }}
                            >
                                {/* On mobile we keep your original centered brand header */}
                                {matchMobile && (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 10,
                                            marginBottom: 8,
                                            paddingRight: 36,
                                            color: brandTextColor,
                                        }}
                                    >
                                        <img
                                            src={logoSrc}
                                            alt="App Icon"
                                            style={{ width: "20vw", height: "auto" }}
                                        />
                                        <h1
                                            id="clikb-title"
                                            style={{
                                                margin: 0,
                                                fontSize: "1.9rem",
                                                fontWeight: 800,
                                                lineHeight: 1.05,
                                                letterSpacing: -0.3,
                                            }}
                                        >
                                            <span style={{ color: brandTextColor }}>Clik</span>
                                            <span
                                                style={{
                                                    background: darkMode
                                                        ? "linear-gradient(90deg, #FFD600, #FFF388)"
                                                        : "linear-gradient(90deg, #ff3b30, #ff8a80)",
                                                    WebkitBackgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                    marginLeft: 2,
                                                }}
                                            >
                                                B
                                            </span>
                                        </h1>
                                    </div>
                                )}



                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        justifyContent: "center",
                                        marginTop: matchMobile ? 6 : "10vh",
                                        marginBottom: matchMobile ? 8 : 12,
                                    }}
                                >
                                    {["Create", "Visualise", "Interact"].map((label) => (
                                        <span
                                            key={label}
                                            style={{
                                                padding: "6px 10px",
                                                borderRadius: 999,
                                                fontSize: matchMobile ? "0.85rem" : "0.9rem",
                                                border:
                                                    brandTextColor === "#000"
                                                        ? "1px solid rgba(0,0,0,0.18)"
                                                        : "1px solid rgba(255,255,255,0.18)",
                                                background:
                                                    brandTextColor === "#000"
                                                        ? "rgba(0,0,0,0.04)"
                                                        : "rgba(255,255,255,0.10)",
                                                backdropFilter: "blur(8px)",
                                                color: brandTextColor,
                                            }}
                                        >
                                            {label}
                                        </span>
                                    ))}
                                </div>

                                <div style={{ maxWidth: 720, color: brandTextColor }}>
                                    {!expanded ? (
                                        <div style={{ marginTop: 4, opacity: 0.75 }}>â€¦</div>
                                    ) : (
                                        <div
                                            style={{
                                                marginTop: 10,
                                                lineHeight: 1.6,
                                                fontSize: matchMobile ? "1.2rem" : "1.26rem",
                                            }}
                                        >
                                            Explain âž¡ï¸ anything in mp4 ðŸŽ¥ <br />
                                            Re-use AI Worlds ðŸŒ <br />
                                            Create any AI Content ðŸ“– <br />
                                            Auto Prompt Creations âœï¸ <br />
                                            Make videos clickable ðŸŽ®

                                        </div>
                                    )}
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpanded();
                                        }}
                                        variant="text"
                                        style={{
                                            color: accent,
                                            textTransform: "none",
                                            fontSize: "1rem",
                                            padding: 0,
                                            marginTop: 6,
                                        }}
                                    >
                                        {expanded ? "Read Less" : "Read More"}
                                    </Button>
                                </div>
                            </div>

                            {/* RIGHT: big brand header ABOVE sign-in (desktop only) + actions */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "stretch",
                                    justifyContent: "center",
                                    gap: 12,
                                    color: brandTextColor,
                                }}
                            >
                                {/* Big brand header for DESKTOP */}
                                {!matchMobile && (
                                    <div
                                        style={{
                                            display: "flex", position: 'relative',
                                            top: '-10vh',
                                            alignItems: "center",
                                            justifyContent: "center",
                                            textAlign: 'center',
                                            gap: 0,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <img
                                            src={logoSrc}
                                            alt="ClikB"
                                            style={{ width: 64, height: "auto" }}
                                        />
                                        <h1
                                            id="clikb-title"
                                            style={{
                                                margin: 0,
                                                fontSize: "2.6rem",
                                                fontWeight: 900,
                                                lineHeight: 1.04,
                                                letterSpacing: -0.4,
                                            }}
                                        >
                                            <span style={{ color: brandTextColor }}>Clik</span>
                                            <span
                                                style={{
                                                    background: darkMode
                                                        ? "linear-gradient(90deg, #FFD600, #FFF388)"
                                                        : "linear-gradient(90deg, #ff3b30, #ff8a80)",
                                                    WebkitBackgroundClip: "text",
                                                    WebkitTextFillColor: "transparent",
                                                    marginLeft: 2,
                                                }}
                                            >
                                                B
                                            </span>
                                        </h1>
                                    </div>
                                )}

                                <div
                                    style={{
                                        borderRadius: 16,
                                        padding: matchMobile ? 14 : 18,
                                        background: brandTextColor === "#000"
                                            ? "linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.75))"
                                            : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
                                        border: brandTextColor === "#000"
                                            ? "1px solid rgba(0,0,0,0.06)"
                                            : "1px solid rgba(255,255,255,0.12)",
                                        boxShadow: brandTextColor === "#000"
                                            ? "inset 0 1px 0 rgba(255,255,255,0.7)"
                                            : "inset 0 1px 0 rgba(255,255,255,0.04)",
                                        textAlign: "center",
                                        color: brandTextColor,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                                        <GoogleLogin
                                            onSuccess={handleLoginSuccess}
                                            onError={handleLoginError}
                                            size="large"
                                        />
                                    </div>

                                    <Button
                                        variant="contained"
                                        onClick={handleClose}
                                        style={{
                                            width: "100%",
                                            padding: "12px",
                                            backgroundColor: accent,
                                            color: darkMode ? "#000" : "#fff",
                                            textTransform: "none",
                                            fontSize: "16px",
                                            fontWeight: 700,
                                            borderRadius: 12,
                                            boxShadow: "none",
                                            marginTop: 8,
                                        }}
                                    >
                                        Continue as Guest
                                    </Button>

                                    <div
                                        style={{
                                            marginTop: 10,
                                            fontSize: "0.85rem",
                                            opacity: 0.7,
                                            lineHeight: 1.4,
                                            color: brandTextColor,
                                        }}
                                    >
                                        By continuing, you agree to our community guidelines.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Home;
