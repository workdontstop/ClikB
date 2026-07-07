import React, { useState } from "react";
import PromptInput from "./PromptInput";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import SuperstarzIconLight from "./s.png";
import SuperstarzIconDark from "./s2.png";
import { matchMobile } from "./DetectDevice";
import { usePWA } from "./PWAContext";
import DownloadIcon from '@mui/icons-material/Download';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

interface MagicMirrorProps {
    handleLoginSuccess?: (res: any) => void;
    handleLoginError?: () => void;
    setminimisePrompt?: (val: boolean) => void;
    hasAutoRedirected?: boolean;
    setHasAutoRedirected?: (val: boolean) => void;
    instantCall?: boolean;
    setinstantCall?: (val: boolean) => void;
}

const MagicMirror: React.FC<MagicMirrorProps> = ({ handleLoginSuccess, handleLoginError, setminimisePrompt, hasAutoRedirected, setHasAutoRedirected, instantCall, setinstantCall }) => {
    const [generatedImage, setGeneratedImage] = useState<any[]>([]);
    const [type, setType] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImagePressed, setIsImagePressed] = useState(false);
    const [isImageHovered, setIsImageHovered] = useState(false);
    const [rotationAngle, setRotationAngle] = useState(30);
    const [hideHamburger, setHideHamburger] = useState(false);

    // Always open on load for both PC and mobile
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const darkMode = useSelector((s: RootState) => s.settings.darkMode);
    const appColorDark = useSelector((s: RootState) => s.settings.appColorDark);
    const appColorLight = useSelector((s: RootState) => s.settings.appColorLight);
    const loggedUser = useSelector((s: RootState) => s.profile.loggedUser);
    const navigate = useNavigate();
    const { deferredPrompt, installPwa } = usePWA();

    const logoSrc = darkMode ? SuperstarzIconDark : SuperstarzIconLight;
    const accent = darkMode ? appColorDark : appColorLight;
    const brandTextColor = !darkMode ? "#000" : "#fff";

    const noop = () => { };

    const location = useLocation();

    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        if (hasAutoRedirected) return;

        // Start 7 second timer on initial load
        timerRef.current = setTimeout(() => {
            if (setHasAutoRedirected) setHasAutoRedirected(true);
            navigate('/images');
            if (setminimisePrompt) setminimisePrompt(false);
            cleanupListeners(); // Remove listeners if timer triggers successfully
        }, 7000);

        const handleInteraction = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (setHasAutoRedirected) setHasAutoRedirected(true);
            cleanupListeners(); // Remove listeners immediately after the first interaction
        };

        const cleanupListeners = () => {
            window.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };

        // Listen for interactions globally while this component is mounted (with passive true for scroll perf)
        window.addEventListener('mousedown', handleInteraction, { passive: true });
        window.addEventListener('touchstart', handleInteraction, { passive: true });
        window.addEventListener('keydown', handleInteraction, { passive: true });

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            cleanupListeners();
        };
    }, [navigate, setminimisePrompt]);

    const navLinks = [
        { label: "Home", path: "/MagicMirror" },
        { label: "Create", path: "/" },
        { label: "Games", path: "/clikit" },
        { label: "Shorts", path: "/images" },
        { label: "Cinema", path: "/kickit" },
    ];

    const handleInstallPWA = async () => {
        if (deferredPrompt) await installPwa();
    };

    const handleContinue = () => {
        navigate("/");
    };

    const handleImageInteractStart = (type: 'hover' | 'press') => {
        if (!isImageHovered && !isImagePressed) {
            setRotationAngle(Math.random() > 0.5 ? 30 : -30);
        }
        if (type === 'hover') setIsImageHovered(true);
        if (type === 'press') setIsImagePressed(true);
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: darkMode ? '#000' : '#fff' }}>

            {/* Hamburger to open Sidebar (Mobile and PC) */}
            {!isSidebarOpen && !hideHamburger && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    style={{ position: 'absolute', top: matchMobile ? 12 : 46, left: matchMobile ? 12 : 46, zIndex: 40001, background: 'transparent', border: 'none', color: brandTextColor, cursor: 'pointer' }}
                >
                    <MenuIcon fontSize="large" />
                </button>
            )}

            {/* LEFT SIDEBAR */}
            <div style={{
                width: matchMobile ? '30%' : '15%',
                minWidth: matchMobile ? '200px' : '0px',
                height: '100dvh',
                position: matchMobile ? 'absolute' : 'relative',
                left: matchMobile ? (isSidebarOpen ? 0 : '-100%') : 'auto',
                transition: 'left 0.3s ease',
                zIndex: 40002,
                background: darkMode ? '#111' : '#f8f8f8',
                borderRight: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                display: matchMobile ? 'flex' : (isSidebarOpen ? 'flex' : 'none'),
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: matchMobile ? '16px 16px 32px 16px' : '16px',
                boxSizing: 'border-box',
                boxShadow: matchMobile && isSidebarOpen ? '4px 0 20px rgba(0,0,0,0.5)' : 'none',
                overflowY: 'auto'
            }}>

                {/* TOP: Branding */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', alignSelf: 'flex-start', width: '100%' }}>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            textDecoration: "none",
                            color: darkMode ? '#000' : '#fff',
                            background: darkMode ? appColorDark : appColorLight,
                            padding: matchMobile ? '6px 16px' : '8px 21px',
                            borderRadius: matchMobile ? '24px' : '32px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                    >
                        <img src={logoSrc} alt="ClikB" style={{ width: matchMobile ? 26 : 34, height: matchMobile ? 26 : 34, marginRight: '0.5rem' }} />
                        <span style={{ display: "flex", alignItems: "baseline" }}>
                            <span style={{ fontSize: matchMobile ? "1.3rem" : "1.7rem", fontWeight: 800, lineHeight: 1 }}>ClikB</span>
                        </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: brandTextColor, opacity: 0.6, marginTop: matchMobile ? 6 : 10, paddingLeft: 6 }}>Express yourself using A.I</div>
                </div>

                {/* GOOGLE LOGIN */}
                {handleLoginSuccess && handleLoginError && loggedUser?.id === 1 && (
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'center', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} shape="pill" />
                    </div>
                )}

                {/* NAVIGATION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {navLinks.map(link => {
                        const isHomeActive = link.path === "/" && (location.pathname === "/" || location.pathname === "");
                        const isOtherActive = link.path !== "/" && location.pathname.toLowerCase().includes(link.path.toLowerCase());
                        const isFullyActive = isHomeActive || isOtherActive;

                        return (
                            <div
                                key={link.label}
                                onClick={() => {
                                    if (link.label === 'Create') {
                                        if (setminimisePrompt) setminimisePrompt(false);
                                        navigate('/images');
                                    } else {
                                        navigate(link.path);
                                    }
                                }}
                                style={{
                                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                                    fontWeight: isFullyActive ? 800 : 600, fontSize: '0.95rem',
                                    color: isFullyActive ? accent : brandTextColor,
                                    background: isFullyActive ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent',
                                    transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center'
                                }}
                                onMouseEnter={e => { if (!isFullyActive) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                                onMouseLeave={e => { if (!isFullyActive) e.currentTarget.style.background = 'transparent' }}
                            >
                                {link.label}
                            </div>
                        );
                    })}
                </div>

                {/* PROFILE ANIMATION */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ position: "relative", width: matchMobile ? 80 : 60, height: matchMobile ? 80 : 60 }}>
                        <div style={{
                            position: "absolute", inset: -6, borderRadius: "50%",
                            border: `2px dashed ${accent}`, opacity: 0.5,
                            animation: "spin 10s linear infinite",
                            pointerEvents: "none"
                        }} />
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        <img
                            src={loggedUser?.image || logoSrc}
                            onClick={() => {
                                navigate('/pages', { state: { userId: loggedUser?.id } });
                            }}
                            onMouseEnter={() => handleImageInteractStart('hover')}
                            onMouseLeave={() => { setIsImageHovered(false); setIsImagePressed(false); }}
                            onMouseDown={() => handleImageInteractStart('press')}
                            onMouseUp={() => setIsImagePressed(false)}
                            onTouchStart={() => handleImageInteractStart('press')}
                            onTouchEnd={() => setIsImagePressed(false)}
                            alt="User"
                            style={{
                                width: "100%", height: "100%",
                                borderRadius: "50%", objectFit: "cover",
                                border: `2px solid ${accent}`, cursor: "pointer",
                                position: "relative", zIndex: 10,
                                transform: (isImagePressed || (!matchMobile && isImageHovered)) ? `rotate(${rotationAngle}deg)` : 'none',
                                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                        />
                    </div>
                    <div style={{ marginTop: 12, fontSize: '1.1rem', fontWeight: 800, color: brandTextColor }}>
                        {loggedUser?.username || "Guest"}
                    </div>
                    <button
                        onClick={handleContinue}
                        style={{
                            marginTop: 12, background: accent, color: "#000",
                            border: "none", padding: "10px 24px", borderRadius: 100,
                            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
                            width: '100%', maxWidth: '180px'
                        }}
                    >
                        Search
                    </button>
                </div>

                {/* PWA INSTALL */}
                <div
                    onClick={handleInstallPWA}
                    style={{
                        padding: matchMobile ? '8px' : '12px', borderRadius: 12, cursor: 'pointer',
                        background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                        display: 'flex', alignItems: 'center', gap: matchMobile ? 8 : 10, color: brandTextColor
                    }}
                >
                    <div style={{ background: accent, borderRadius: '50%', padding: matchMobile ? 4 : 6, display: 'flex', color: '#000' }}>
                        <DownloadIcon style={{ fontSize: matchMobile ? '0.8rem' : '1rem' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: matchMobile ? '0.75rem' : '0.85rem' }}>{matchMobile ? 'Home App' : 'Desktop App'}</div>
                        <div style={{ fontSize: matchMobile ? '0.65rem' : '0.7rem', opacity: 0.7 }}>For the best experience</div>
                    </div>
                </div>

            </div>

            {/* Overlay Backgrounds  */}
            {isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    style={{ position: 'absolute', inset: 0, background: matchMobile ? 'rgba(0,0,0,0.8)' : 'transparent', zIndex: 40001, cursor: matchMobile ? 'default' : 'pointer' }}
                />
            )}

            {/* RIGHT MAIN CONTENT (80% on PC, 100% on Mobile) */}
            <div style={{ flex: 1, position: 'relative', width: isSidebarOpen ? (matchMobile ? '100%' : '85%') : '100%', zIndex: 40000 }}>
                <PromptInput
                    key={type}
                    magicMode={true}
                    GeneratedImage={generatedImage}
                    setGeneratedImage={setGeneratedImage}
                    isSubmitting={isSubmitting}
                    setIsSubmitting={setIsSubmitting}
                    minimisePrompt={false}
                    type={type}
                    setType={setType}
                    isMenuOpen={isSidebarOpen}
                    setcallFeeds={noop}
                    setAllowPing={noop}
                    AllowPing={false}
                    setminimisePrompt={setminimisePrompt}
                    callFeeds={false}
                    setFluxLoaded={noop}
                    fluxLoaded={false}
                    isSubmittingKick={false}
                    setIsSubmittingKick={noop}
                    IsMobileBackActive={false}
                    setIsMobileBackActive={noop}
                    clikt={false}
                    setclikt={noop}
                    setHideBottom={setHideHamburger}
                    setstopFeeds={noop}
                    stopFeeds={false}
                    instantCall={instantCall}
                    setinstantCall={setinstantCall}
                />
            </div>
        </div>
    );
};

export default MagicMirror;
