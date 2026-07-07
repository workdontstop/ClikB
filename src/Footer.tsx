// src/components/Footer.jsx
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { matchMobile } from './DetectDevice';

import ClikbaeIcon from './s.png'; // your transparent PNG icon

import ClikbaeIcon2 from './s2.png';
// import DownloadIcon from '@mui/icons-material/Download';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { usePWA } from './PWAContext';
const Footer: React.FC<any> = ({

}) => {
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);

    const [darkModex, setdarkModex] = useState(false);
    useEffect(() => {

        setdarkModex(darkMode)
    }, [darkMode])
    const isMobile =

        matchMobile;

    // Responsive sizing
    const iconSize = isMobile ? '2rem' : '3rem';
    const textSize = isMobile ? '1.5rem' : '1.4rem';

    const isLoggedIn = useSelector((state: RootState) => state.settings.login);

    const { installPwa, isInstallable, isPwaMode } = usePWA();
    const [showLaunch, setShowLaunch] = useState(true);

    useEffect(() => {
        // Show launch button only for first 1 minute AND if not in PWA mode
        if (isPwaMode) {
            setShowLaunch(false);
            return;
        }

        const timer = setTimeout(() => {
            setShowLaunch(false);
        }, 4000); // 4 seconds

        return () => clearTimeout(timer);
    }, [isPwaMode]); // re-run if pwa mode changes (unlikely but safe)

    const handleLaunchClick = async (e: any) => {
        if (isPwaMode) return; // Do nothing if already in PWA

        e.preventDefault();
        await installPwa();
        // optionally hide after clicking? User said "launch or download... then go to BottomMenu"
        // Let's keep it visible or hide it? "if user clik... then got to BottomMenu look for ClikB icon"
        // implies we should probably stop showing it here if they installed?
        // But for now, just trigger install.
        setShowLaunch(false);
    };

    return (
        <footer
            style={{
                display: isLoggedIn ? 'flex' : 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: '1rem 1rem 1.5rem',    // extra bottom padding for breathing room
                marginTop: 'auto',
                fontFamily: 'Inter, sans-serif', // match global font
                opacity: darkModex ? '0.5' : '0.8'
            }}
        >
            {showLaunch ? (
                <a
                    href="#"
                    onClick={handleLaunchClick}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        color: darkModex ? '#000' : '#fff', // Contrast text
                        opacity: 1,
                        background: darkModex ? '#E8BAFA' : '#0099cc', // App colors
                        padding: '6px 16px',
                        borderRadius: '20px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                    }}
                >
                    <span style={{ fontSize: textSize, fontWeight: 800 }}>
                        Launch App
                    </span>
                    <RocketLaunchIcon sx={{ fontSize: '1.2rem', marginLeft: '0.5rem', color: darkModex ? "#000" : "#fff" }} />
                </a>
            ) : (
                <div
                    onClick={handleLaunchClick} // Brand also launches app
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        color: darkModex ? '#000' : '#fff', // Contrast text
                        opacity: 1,
                        background: darkModex ? '#E8BAFA' : '#0099cc', // App colors
                        padding: '6px 16px',
                        borderRadius: '20px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        cursor: 'pointer'
                    }}
                >
                    {/* Icon on far left */}
                    <img
                        src={darkModex ? ClikbaeIcon2 : ClikbaeIcon}
                        alt="ClikBae icon"
                        style={{
                            width: iconSize,
                            height: iconSize,
                            marginRight: '0.5rem',
                        }}
                    />

                    {/* App Name + â„¢ */}
                    <span style={{ display: 'flex', alignItems: 'baseline' }}>
                        <span
                            style={{
                                fontSize: textSize,
                                fontWeight: 800,
                                lineHeight: 1,
                            }}
                        >
                            ClikB
                        </span>

                    </span>
                </div>
            )}
        </footer >
    );
};

export default Footer;
