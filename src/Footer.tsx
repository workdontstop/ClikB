// src/components/Footer.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { matchMobile } from './DetectDevice';
import ClikBSocialWordmark from './ClikBSocialWordmark';

import ClikbaeIcon from './s.png'; // your transparent PNG icon

import ClikbaeIcon2 from './s2.png';
const Footer: React.FC = () => {
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? '#E8BAFA' : '#0099cc');

    const iconSize = matchMobile ? '2rem' : '3rem';

    return (
        <footer
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: '1rem 1rem 1.5rem',    // extra bottom padding for breathing room
                marginTop: 'auto',
                fontFamily: 'Inter, sans-serif', // match global font
                opacity: darkMode ? '0.5' : '0.8'
            }}
        >
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    color: appColor, // ClikB wordmark
                    opacity: 1,
                    background: darkMode ? 'rgba(128, 128, 128, 0.6)' : '#fff', // App colors
                    border: `1px solid ${appColor}`,
                    padding: '6px 16px',
                    borderRadius: '20px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                }}
            >
                {/* Icon on far left */}
                <img
                    src={darkMode ? ClikbaeIcon2 : ClikbaeIcon}
                    alt="ClikBae icon"
                    style={{
                        width: iconSize,
                        height: iconSize,
                        marginRight: '0.5rem',
                    }}
                />

                <span style={{ display: 'flex', alignItems: 'baseline' }}>
                    <ClikBSocialWordmark fontSize={matchMobile ? '1.45rem' : undefined} />
                </span>
            </div>
        </footer >
    );
};

export default Footer;
