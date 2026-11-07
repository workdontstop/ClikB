import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, alpha } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { matchMobile } from '../DetectDevice';
import ClikbaeIcon from '../s.png';
import ClikbaeIcon2 from '../s2.png';

interface LeftEdgeMenuPeekProps {
    isMenuOpen: boolean;
    setIsMenuOpen?: (open: boolean) => void;
    MenuOpenb: boolean;
    setMenuOpenb: (open: boolean) => void;
    isFullscreen?: boolean;
}

export const LeftEdgeMenuPeek: React.FC<LeftEdgeMenuPeekProps> = ({
    isMenuOpen,
    setIsMenuOpen,
    MenuOpenb,
    setMenuOpenb,
    isFullscreen = false,
}) => {
    const [isPeeking, setIsPeeking] = useState(false);
    const [cursorY, setCursorY] = useState<number>(() => typeof window !== 'undefined' ? window.innerHeight / 2 : 300);
    const [isTouchHolding, setIsTouchHolding] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

    const darkModeReducer = useSelector((s: RootState) => s.settings.darkMode);
    const appColorDark = useSelector((s: RootState) => s.settings.appColorDark);
    const appColorLight = useSelector((s: RootState) => s.settings.appColorLight);
    const appColor = (darkModeReducer ? appColorDark : appColorLight) || (darkModeReducer ? '#E8BAFA' : '#0099cc');

    // On PC without fullscreen, if primary sidebar is already open, B menu cannot be seen anyway
    const isSidebarAlreadyVisible = !matchMobile && !isFullscreen && isMenuOpen;
    const isPeekDisabled = MenuOpenb || isSidebarAlreadyVisible;

    // Helper to safely clear the hold/peek timer
    const clearPeekTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        touchStartPosRef.current = null;
    }, []);

    const openOverlayMenu = useCallback(() => {
        clearPeekTimer();
        setIsPeeking(false);
        setIsTouchHolding(false);
        if (setIsMenuOpen) {
            setIsMenuOpen(false);
        }
        setMenuOpenb(true);
    }, [clearPeekTimer, setMenuOpenb, setIsMenuOpen]);

    // -------------------------------------------------------------
    // PC: Mouse Edge Detection (extreme left edge: hitting the edge with leeway, clientX <= 10px)
    // Starts ONLY when cursor hits the physical extreme left edge and is left there for 1.2s
    // -------------------------------------------------------------
    useEffect(() => {
        if (matchMobile || isPeekDisabled) {
            clearPeekTimer();
            setIsPeeking(false);
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const edgeThreshold = 10; // Extreme edge with leeway for DPI scaling: <= 10px

            if (e.clientX <= edgeThreshold) {
                const boundedY = Math.max(48, Math.min(window.innerHeight - 48, e.clientY));
                setCursorY(boundedY);

                if (!timerRef.current) {
                    setIsPeeking(true);
                    timerRef.current = setTimeout(() => {
                        openOverlayMenu();
                    }, 1200); // 1.2 seconds leave it hitting the edge
                }
            } else {
                if (timerRef.current) {
                    clearPeekTimer();
                }
                setIsPeeking(false);
            }
        };

        const handleMouseLeave = () => {
            clearPeekTimer();
            setIsPeeking(false);
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            clearPeekTimer();
        };
    }, [isPeekDisabled, openOverlayMenu, clearPeekTimer]);

    // -------------------------------------------------------------
    // Mobile: Extremely sensitive tiny edge touchpoint (<= 20px)
    // User intentionally holds down for 1.5s to pop up menu
    // -------------------------------------------------------------
    const handleTouchStart = (e: React.TouchEvent) => {
        if (isPeekDisabled || !e.touches[0]) return;
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        const maxEdgeWidth = 20; // 20px comfortable leeway on phone bezel
        if (touchX > maxEdgeWidth) return;

        touchStartPosRef.current = { x: touchX, y: touchY };

        const boundedY = Math.max(56, Math.min(window.innerHeight - 56, touchY));
        setCursorY(boundedY);
        setIsTouchHolding(true);
        setIsPeeking(true);

        clearPeekTimer();
        touchStartPosRef.current = { x: touchX, y: touchY };
        timerRef.current = setTimeout(() => {
            openOverlayMenu();
        }, 1500); // 1.5s intentional hold on mobile edge
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!timerRef.current || !e.touches[0] || !touchStartPosRef.current) return;
        const deltaX = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);

        // Cancel if finger moves more than 10px (normal scrolling/swiping)
        if (deltaX > 10 || deltaY > 10) {
            clearPeekTimer();
            setIsTouchHolding(false);
            setIsPeeking(false);
        } else {
            const touchY = e.touches[0].clientY;
            setCursorY(Math.max(56, Math.min(window.innerHeight - 56, touchY)));
        }
    };

    const handleTouchEnd = () => {
        clearPeekTimer();
        setIsTouchHolding(false);
        setIsPeeking(false);
    };

    return (
        <>
            {/* Sensitive edge touch strip for mobile */}
            {!isPeekDisabled && (
                <Box
                    data-ai-snapshot-ignore="true"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    sx={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        width: matchMobile ? '20px' : '10px',
                        height: '100dvh',
                        zIndex: 10028,
                        cursor: 'default',
                        pointerEvents: matchMobile ? 'auto' : 'none',
                        background: isTouchHolding
                            ? `linear-gradient(90deg, ${alpha(appColor, 0.22)} 0%, transparent 100%)`
                            : 'transparent',
                        transition: 'background 0.2s ease',
                        touchAction: 'pan-y',
                    }}
                />
            )}

            {/* Glowing CLIKB Logo Badge: only visible while leaving mouse at extreme edge or touch holding */}
            {isPeeking && !isPeekDisabled && (
                <Box
                    className="clikb-edge-peek-logo"
                    data-ai-snapshot-ignore="true"
                    sx={{
                        position: 'fixed',
                        left: matchMobile ? 12 : 8,
                        top: cursorY,
                        transform: 'translateY(-50%)',
                        zIndex: 10030,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: matchMobile ? 44 : 40,
                        height: matchMobile ? 44 : 40,
                        borderRadius: '50%',
                        background: darkModeReducer ? 'rgba(20,20,20,0.88)' : 'rgba(255,255,255,0.92)',
                        border: `1.5px solid ${alpha(appColor, 0.75)}`,
                        boxShadow: `0 0 22px ${alpha(appColor, 0.55)}, 0 4px 14px rgba(0,0,0,0.4)`,
                        backdropFilter: 'blur(12px)',
                        transition: 'opacity 0.2s ease',
                    }}
                >
                    <img
                        src={darkModeReducer ? ClikbaeIcon2 : ClikbaeIcon}
                        alt="CLikB"
                        style={{
                            width: matchMobile ? 28 : 24,
                            height: matchMobile ? 28 : 24,
                            objectFit: 'contain',
                            filter: `drop-shadow(0 0 6px ${alpha(appColor, 0.65)})`,
                            pointerEvents: 'none',
                        }}
                    />
                </Box>
            )}
        </>
    );
};

export default LeftEdgeMenuPeek;
