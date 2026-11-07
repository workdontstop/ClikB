import React, { createContext, useContext, useEffect, useState } from 'react';
import { Backdrop, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface PWAContextType {
    deferredPrompt: any;
    installPwa: () => Promise<void>;
    isInstallable: boolean;
    isPwaMode: boolean;
    isIos: boolean;
    showIosGuide: boolean;
    setShowIosGuide: (open: boolean) => void;
}

const PWAContext = createContext<PWAContextType>({
    deferredPrompt: null,
    installPwa: async () => { },
    isInstallable: false,
    isPwaMode: false,
    isIos: false,
    showIosGuide: false,
    setShowIosGuide: () => { },
});

export const usePWA = () => useContext(PWAContext);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isPwaMode, setIsPwaMode] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showIosGuide, setShowIosGuide] = useState(false);

    useEffect(() => {
        // Detect iOS Safari
        const userAgent = window.navigator.userAgent || '';
        const iosDevice = /iphone|ipad|ipod/i.test(userAgent) && !(window as any).MSStream;
        setIsIos(iosDevice);

        // Check if running in standalone mode (PWA)
        const checkPwaMode = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;
            setIsPwaMode(isStandalone);
            console.log("PWA Mode Detected:", isStandalone);
        };

        checkPwaMode();

        // Listen for display-mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => setIsPwaMode(e.matches);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            mediaQuery.addListener(handleChange);
        }

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            console.log("PWA Context: beforeinstallprompt captured");
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleChange);
            } else {
                mediaQuery.removeListener(handleChange);
            }
        };
    }, []);

    const installPwa = async () => {
        // iOS Safari: Apple does not support automated 1-click install prompts
        // Show custom step-by-step iOS installation guide modal
        if (isIos) {
            setShowIosGuide(true);
            return;
        }

        // Android / Desktop / Chrome: Native programmatic PWA prompt
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log("PWA: User choice:", outcome);
                if (outcome === 'accepted') {
                    setDeferredPrompt(null);
                }
            } catch (error) {
                console.error("PWA: Install error", error);
            }
        } else {
            console.log("PWA: No deferred prompt available");
        }
    };

    const isInstallable = !isPwaMode && (isIos || !!deferredPrompt);

    return (
        <PWAContext.Provider value={{
            deferredPrompt,
            installPwa,
            isInstallable,
            isPwaMode,
            isIos,
            showIosGuide,
            setShowIosGuide
        }}>
            {children}

            {/* --- iOS SAFARI PWA INSTALLATION GUIDE MODAL --- */}
            {showIosGuide && (
                <Backdrop
                    open={showIosGuide}
                    onClick={() => setShowIosGuide(false)}
                    sx={{
                        zIndex: 100000,
                        color: '#fff',
                        backdropFilter: 'blur(16px)',
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                    }}
                >
                    <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            position: 'relative',
                            maxWidth: '440px',
                            maxHeight: '90vh',
                            width: '100%',
                            borderRadius: '24px',
                            overflow: 'hidden',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            bgcolor: '#0a0a0c',
                        }}
                    >
                        {/* Top-right circular padded X close button inside a circular div */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 14,
                                right: 14,
                                zIndex: 10,
                            }}
                        >
                            <IconButton
                                onClick={() => setShowIosGuide(false)}
                                aria-label="close"
                                sx={{
                                    width: 38,
                                    height: 38,
                                    bgcolor: 'rgba(0, 0, 0, 0.72)',
                                    backdropFilter: 'blur(10px)',
                                    color: '#ffffff',
                                    border: '1px solid rgba(255, 255, 255, 0.25)',
                                    borderRadius: '50%',
                                    p: 1,
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                    transition: 'all 200ms ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.25)',
                                        transform: 'scale(1.05)',
                                    },
                                    '&:active': {
                                        transform: 'scale(0.95)',
                                    }
                                }}
                            >
                                <CloseIcon sx={{ fontSize: '1.25rem', color: '#ffffff' }} />
                            </IconButton>
                        </Box>

                        {/* ClikB iOS Safari Guide Image */}
                        <Box
                            component="img"
                            src="/ios_pwa_safari_install_guide.jpg"
                            alt="ClikB iOS Safari PWA Installation Guide"
                            sx={{
                                width: '100%',
                                height: 'auto',
                                maxHeight: '85vh',
                                objectFit: 'contain',
                                display: 'block',
                            }}
                        />
                    </Box>
                </Backdrop>
            )}
        </PWAContext.Provider>
    );
};
