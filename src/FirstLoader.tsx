import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import SuperstarzIconLight from "./s.png";
import SuperstarzIconDark from "./s2.png";
import { matchMobile } from "./DetectDevice";
import { useNavigate } from "react-router-dom";
import DownloadIcon from '@mui/icons-material/Download';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { usePWA } from "./PWAContext";

const SPLASH_MS = 30000; // 30 seconds

const FirstLoader: React.FC = () => {
    const darkMode = useSelector((s: RootState) => s.settings.darkMode);
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const navigate = useNavigate();

    const [visible, setVisible] = useState(true);
    const { deferredPrompt, installPwa } = usePWA();

    // keep as any to avoid TS timeout type wars in mixed node/dom typings
    const timerRef = useRef<any>(null);

    useEffect(() => {
        // restart timer every mount
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        setVisible(true);

        timerRef.current = window.setTimeout(() => {
            setVisible(false);
        }, SPLASH_MS);

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    const handleInstallOrLaunch = async () => {
        console.log("PWA: handleInstallOrLaunch called from FirstLoader");
        try {
            if (deferredPrompt) {
                await installPwa();
            } else {
                // If no prompt available, assume installed or not supported, so just "launch" (enter app)
                console.log("PWA: No prompt available, entering app...");
                handleSkip();
            }
        } catch (error) {
            console.error("PWA: Error during install/launch:", error);
            // Fallback to ensuring we enter the app
            handleSkip();
        }
    };




    if (!visible) return null;

    const logoSrc = darkMode ? SuperstarzIconDark : SuperstarzIconLight;
    const brandTextColor = !darkMode ? "#000" : "#fff";
    const accent = darkMode ? "yellow" : "#ff3b30";
    const overlayBg = darkMode ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.98)";

    const handleSkip = () => {
        setVisible(false);
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    return (
        <>
            <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.985) } to { opacity: 1; transform: scale(1) } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .splash-shimmer {
          background: linear-gradient(90deg, rgba(127,127,127,0.1), rgba(127,127,127,0.35), rgba(127,127,127,0.1));
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 2.4s infinite;
        }
        /* Hide scrollbar for clean UI */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 200000,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: overlayBg,
                    backdropFilter: darkMode ? "blur(10px)" : "blur(5px)",
                    transition: "background 320ms ease, backdrop-filter 320ms ease",
                    cursor: "default",
                    color: brandTextColor,
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Welcome to ClikB"
            >
                {/* Dev-only Milo Verse Access Button */}
                {import.meta.env.DEV && (
                    <button
                        onClick={() => {
                            handleSkip();
                            navigate('/miloverse');
                        }}
                        style={{
                            position: 'absolute',
                            bottom: 10,
                            left: 10,
                            opacity: 0.3,
                            fontSize: '10px',
                            padding: '4px',
                            zIndex: 200001,
                            background: 'transparent',
                            border: '1px solid currentColor',
                            color: 'inherit'
                        }}
                    >
                        Milo Verse
                    </button>
                )}
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: matchMobile ? "column" : "row",
                        padding: matchMobile ? "20px" : "40px",
                        boxSizing: "border-box",
                        gap: matchMobile ? 20 : 60,
                        animation: "fadeIn 320ms ease",
                    }}
                >
                    {/* LEFT SIDE (PC) / TOP (Mobile): SCROLLABLE GRID */}
                    <div
                        className="no-scrollbar"
                        style={{
                            // On mobile: 2x2 grid attempt or horizontal scroll? User said "4 boxes on top".
                            // "4 grid as 3 will non symetric"
                            // "on mobile simple show the 4 boxes on top"
                            // Let's use a grid for mobile to fit 4 nicely.
                            alignItems: "center",
                            // Mobile: grid 2 columns. PC: flex column.
                            display: matchMobile ? "grid" : "flex",
                            flexDirection: matchMobile ? "row" : "column",
                            gridTemplateColumns: matchMobile ? "1fr 1fr" : "none",
                            gap: 20,
                            overflowY: matchMobile ? "visible" : "auto",
                            overflowX: matchMobile ? "visible" : "hidden",
                            maxHeight: matchMobile ? "auto" : "90vh",
                            width: matchMobile ? "100%" : "auto",
                            paddingRight: matchMobile ? 0 : 20, // space for scroll if any (hidden though)
                            justifyContent: "center",
                        }}
                    >
                        {/* BOX 1: Magic Mirror */}
                        <div
                            onClick={() => {
                                handleSkip();
                                navigate("/MagicMirror");
                            }}
                            style={{
                                width: matchMobile ? "100%" : 300,
                                height: matchMobile ? "40vw" : 180,
                                borderRadius: 20,
                                overflow: "hidden",
                                position: "relative",
                                cursor: "pointer",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                            }}
                        >
                            <img
                                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop"
                                alt="Magic Mirror"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }} />
                            <div style={{ position: "absolute", bottom: 12, left: 12 }}>
                                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff" }}>Magic Mirror</div>
                            </div>
                        </div>

                        {/* BOX 2: ClikB Social */}
                        <div
                            onClick={handleSkip}
                            style={{
                                width: matchMobile ? "100%" : 300,
                                height: matchMobile ? "40vw" : 180,
                                borderRadius: 20,
                                overflow: "hidden",
                                position: "relative",
                                cursor: "pointer",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                            }}
                        >
                            <img
                                src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop"
                                alt="ClikB Social"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }} />
                            <div style={{ position: "absolute", bottom: 12, left: 12 }}>
                                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff" }}>ClikB Social</div>
                            </div>
                        </div>

                        {/* BOX 3: Download App (PWA) */}
                        <div
                            onClick={handleInstallOrLaunch}
                            style={{
                                width: matchMobile ? "100%" : 300,
                                height: matchMobile ? "40vw" : 180,
                                borderRadius: 20,
                                overflow: "hidden",
                                position: "relative",
                                cursor: "pointer",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                                background: darkMode ? "#1a1a1a" : "#f5f5f5",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 10
                            }}
                        >
                            <div style={{
                                width: 60, height: 60, borderRadius: "50%", background: accent,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#000", boxShadow: `0 0 20px ${accent}66`
                            }}>
                                <DownloadIcon sx={{ fontSize: 32 }} />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: brandTextColor }}>Download App</div>
                            <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Install for better experience</div>
                        </div>

                        {/* BOX 4: Launch App */}
                        <div
                            onClick={handleInstallOrLaunch}
                            style={{
                                width: matchMobile ? "100%" : 300,
                                height: matchMobile ? "40vw" : 180,
                                borderRadius: 20,
                                overflow: "hidden",
                                position: "relative",
                                cursor: "pointer",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
                                background: darkMode ? "#1a1a1a" : "#f5f5f5",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 10
                            }}
                        >
                            <div style={{
                                width: 60, height: 60, borderRadius: "50%", background: "transparent",
                                border: `2px solid ${accent}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: accent
                            }}>
                                <RocketLaunchIcon sx={{ fontSize: 32 }} />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: brandTextColor }}>Launch App</div>
                            <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Open directly</div>
                        </div>

                    </div>


                    {/* RIGHT SIDE (PC) / BOTTOM (Mobile): PROFILE & CONTINUE */}
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 24,
                            width: "100%",
                            marginLeft: matchMobile ? 0 : 40,
                        }}
                    >
                        <div style={{ position: "relative" }}>
                            {/* Rotating Ring */}
                            <div style={{
                                position: "absolute", inset: -10, borderRadius: "50%",
                                border: `2px dashed ${accent}`, opacity: 0.3,
                                animation: "spin 10s linear infinite",
                                pointerEvents: "none"
                            }} />
                            <style>{`@keyframes spin { from { transfrom: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                            <img
                                src={loggedUser?.image || logoSrc}
                                onClick={handleSkip}
                                alt="User"
                                style={{
                                    height: matchMobile ? "120px" : "250px",
                                    width: matchMobile ? "120px" : "250px",
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    boxShadow: `0 0 50px ${accent}44`,
                                    border: `4px solid ${accent}`,
                                    cursor: "pointer",
                                    transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                    position: "relative",
                                    zIndex: 10
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1) rotate(5deg)")}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) rotate(0deg)")}
                            />
                        </div>

                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: matchMobile ? "1.5rem" : "2.2rem", fontWeight: 900, marginBottom: 8, letterSpacing: -1 }}>
                                {loggedUser?.username || "Guest"}
                            </div>
                            <div style={{ fontSize: "1rem", opacity: 0.5, marginBottom: 24 }}>Welcome back</div>

                            <button
                                onClick={handleSkip}
                                style={{
                                    background: accent,
                                    color: "#000",
                                    border: "none",
                                    padding: "16px 48px",
                                    borderRadius: 100,
                                    fontWeight: 800,
                                    fontSize: "1.1rem",
                                    cursor: "pointer",
                                    transition: "all 0.3s ease",
                                    boxShadow: `0 10px 30px -10px ${accent}`,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = `0 20px 40px -10px ${accent}`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = `0 10px 30px -10px ${accent}`;
                                }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default FirstLoader;
