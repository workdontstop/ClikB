import { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "./store"; // adjust the import to your store location

import MenuIcon from '@mui/icons-material/Menu';
import SwitchRightIcon from '@mui/icons-material/SwitchRight';

import ToggleOnIcon from '@mui/icons-material/ToggleOn';

import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import SwitchLeftIcon from '@mui/icons-material/SwitchLeft';
import { matchMobile } from "./DetectDevice";


const MenuToggle = ({
  loggedUser,
  isMenuOpen,
  setIsMenuOpen,
  isInitialLoad,
  setIsFullscreen,
  isFullscreen,
  prompt,
  setminimisePrompt,
  isCropOpen,
}: any) => {
  const VITE__CLOUNDFRONT = import.meta.env.VITE__CLOUNDFRONT;
  const [Zoom1x, setZoom1x] = useState(false);

  const [once, setonce] = useState(0);
  // Retrieve showmenuToggle from Redux store
  const showmenuToggle = useSelector(
    (state: RootState) => state.settings.showmenuToggle
  );




  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

  /* …inside your component’s render … */
  return (
    <div style={{ display: isCropOpen ? 'none' : matchMobile ? 'none' : 'block' }}>
      {/* Only render after first mount and when the toggle should be visible */}
      {!isInitialLoad && showmenuToggle && (
        <div

          style={{
            backgroundColor: darkModeReducer ? 'rgba(0,0,0,0.65)' : 'rgb(250,250,250,0.65)',

            color: darkModeReducer ? '#ffffff' : '#000000',
          }}
          className={`toggle-btn ${Zoom1x ? 'bounce' : ''}`}
          onMouseEnter={() => setZoom1x(true)}
          onMouseLeave={() => setZoom1x(false)}
          onTouchStart={() => setZoom1x(true)}
          onTouchEnd={() => setZoom1x(false)}
          onClick={() => {
            // same click logic you already had
            setZoom1x(true);
            setTimeout(() => setZoom1x(false), 300);

            if (isFullscreen) {
              setIsFullscreen(false);
            } else {
              setIsMenuOpen(!isMenuOpen);
            }
          }}
        >
          {/* MUI hamburger icon (inherits circle colour) */}
          {matchMobile ? <MenuIcon sx={{ fontSize: '3rem' }} />

            :

            isMenuOpen ? < ToggleOnIcon sx={{ fontSize: '3rem', opacity: 0.4 }} /> :
              < ToggleOffIcon sx={{ fontSize: '3rem', opacity: 0.4 }} />}
        </div>
      )}

      <style>
        {`
        /* ---------- toggle circle ---------- */
        .toggle-btn {
          position: fixed;
          bottom: 10px;
          right: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 15vw;
          height: 15vw;
          border-radius: 50%;
          cursor: pointer;
          z-index: 9999;

          /* LIGHT THEME DEFAULT */
          background: rgba(0,0,0,0.65);
          color: #ffffff;
          backdrop-filter: blur(4px);
        }

        /* Automatic dark-mode override */
        @media (prefers-color-scheme: dark) {
          .toggle-btn {
            background: rgba(255,255,255,0.14);
            color: #ffffff;
          }
        }

        /* -------- bounce animation (unchanged) -------- */
        @keyframes bounce-animation {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.9); }
          100% { transform: scale(1.5); }
        }
        .bounce {
          animation: bounce-animation 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @media (max-width: 768px) {
          .bounce { animation-duration: 0.36s; }
        }

        /* -------- responsive sizing (same breakpoints) -------- */
        @media (min-width: 768px) {  /* Tablet */
          .toggle-btn { width: 8vw; height: 8vw; }
        }
        @media (min-width: 1024px) { /* Desktop */
          .toggle-btn { width: 4.5vw; height: 4.5vw; }
        }
      `}
      </style>
    </div>
  );

};

export default MenuToggle;
