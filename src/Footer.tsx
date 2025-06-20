// src/components/Footer.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { matchMobile } from './DetectDevice';

import ClikbaeIcon from './s.png'; // your transparent PNG icon

const Footer: React.FC<any> = ({

    x
}) => {
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const isMobile = matchMobile;

    // Responsive sizing
    const iconSize = isMobile ? '2rem' : '3rem';
    const textSize = isMobile ? '1.5rem' : '1.4rem';

    return (
        <footer
            style={{
                display: x ? 'flex' : 'none',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: '1rem 1rem 1.5rem',    // extra bottom padding for breathing room
                marginTop: 'auto',
                fontFamily: 'Inter, sans-serif', // match global font
                opacity: darkMode ? '0.8' : '0.8'
            }}
        >
            <a
                href="https://www.clikb.com/privacy-policy"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    color: darkMode ? '#eee' : '#111',
                }}
            >
                {/* Icon */}
                <img
                    src={ClikbaeIcon}
                    alt="ClikBae icon"
                    style={{
                        width: iconSize,
                        height: iconSize,
                        marginRight: '0.5rem',
                    }}
                />

                {/* App Name + ™ */}
                <span style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span
                        style={{
                            fontSize: textSize,
                            fontWeight: 800,
                            lineHeight: 1,
                        }}
                    >
                        Clik
                    </span>
                    <span
                        style={{
                            fontSize: textSize,
                            fontWeight: 800,
                            lineHeight: 1,
                            ///color: '#FF4B9D',    // pink accent
                            opacity: 0.8,
                            marginLeft: '0.1rem',
                        }}
                    >
                        B
                    </span>
                    <sup
                        style={{
                            position: 'relative',
                            top: '2px',            // nudge ™ into perfect vertical alignment
                            fontSize: '0.75rem',   // small TM
                            lineHeight: 1,
                            marginLeft: '0.2rem',
                        }}
                    >
                        ™
                    </sup>
                </span>
            </a>
        </footer>
    );
};

export default Footer;
