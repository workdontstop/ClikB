import React, { createContext, useContext, useEffect, useState } from 'react';

interface PWAContextType {
    deferredPrompt: any;
    installPwa: () => Promise<void>;
    isInstallable: boolean;
    isPwaMode: boolean; // New property
}

const PWAContext = createContext<PWAContextType>({
    deferredPrompt: null,
    installPwa: async () => { },
    isInstallable: false,
    isPwaMode: false,
});

export const usePWA = () => useContext(PWAContext);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isPwaMode, setIsPwaMode] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (PWA)
        const checkPwaMode = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true;
            setIsPwaMode(isStandalone);
            console.log("PWA Mode Detected:", isStandalone);
        };

        checkPwaMode();

        // Optional: Listen for changes (e.g. if user installs and it opens)
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => setIsPwaMode(e.matches);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            // Fallback
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

    return (
        <PWAContext.Provider value={{
            deferredPrompt,
            installPwa,
            isInstallable: !!deferredPrompt,
            isPwaMode
        }}>
            {children}
        </PWAContext.Provider>
    );
};
