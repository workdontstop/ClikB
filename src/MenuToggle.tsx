import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import { SocialUnreadDot, useSocialChat } from './SocialChat';

import MenuIcon from '@mui/icons-material/Menu';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
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
  MenuOpenb,
  setMenuOpenb,
  deckOpen: deckOpenProp,
}: any) => {
  const [Zoom1x, setZoom1x] = useState(false);
  const dispatch = useDispatch();

  const showmenuToggle = useSelector(
    (state: RootState) => state.settings.showmenuToggle
  );

  const deckOpenRedux = useSelector(
    (state: RootState) =>
      state.brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck']?.state.isOpen === true
  );
  const deckOpen = deckOpenProp !== undefined ? deckOpenProp : deckOpenRedux;

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
  const accent = useSelector((state: RootState) => darkModeReducer ? state.settings.appColorDark : state.settings.appColorLight)
    || (darkModeReducer ? '#e8bafa' : '#0099cc');
  const { hasUnreadNotifications } = useSocialChat();

  // Hidden with display: none on mobile and whenever on deck for a clean, relaxed experience
  const shouldShowToggle = !matchMobile && !deckOpen && (showmenuToggle || isFullscreen);

  useEffect(() => {
    const areaId = 'clikb.navigation.toggle';
    if (!shouldShowToggle) {
      dispatch(removeNavigationArea({ areaId, source: 'MenuToggle' }));
      return;
    }
    dispatch(publishNavigationArea({
      areaId,
      source: 'MenuToggle',
      state: { sidebarOpen: Boolean(isMenuOpen), fullscreen: Boolean(isFullscreen) },
      visibleControls: [navigationControl(areaId, 'toggle_sidebar', 'MenuToggle.onClick')],
    }));
  }, [dispatch, shouldShowToggle, isMenuOpen, isFullscreen]);

  useEffect(() => () => {
    dispatch(removeNavigationArea({ areaId: 'clikb.navigation.toggle', source: 'MenuToggle' }));
  }, [dispatch]);

  return (
    <div style={{ display: (!matchMobile && !deckOpen && shouldShowToggle) ? 'block' : 'none', position: 'fixed', bottom: '10px', right: '10px', zIndex: 10050 }}>
      {shouldShowToggle && (
        <div
          data-ai-action="clikb.navigation.toggle.action.toggle_sidebar"
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
            setZoom1x(true);
            setTimeout(() => setZoom1x(false), 300);

            const nextMenuState = !isMenuOpen;
            setIsMenuOpen(nextMenuState);
            if (nextMenuState && setMenuOpenb) {
              setMenuOpenb(false);
            }
            dispatch(recordNavigationTransition({
              actor: 'manual', kind: 'area',
              before: { areaId: 'clikb.navigation.toggle', controlId: 'clikb.navigation.toggle.control.toggle_sidebar', state: { fullscreen: Boolean(isFullscreen), sidebarOpen: Boolean(isMenuOpen) } },
              after: { areaId: 'clikb.navigation.toggle', state: { fullscreen: Boolean(isFullscreen), sidebarOpen: nextMenuState } },
              outcome: 'succeeded', authoritativeSource: 'MenuToggle sidebar state handler',
            }));
          }}
        >
          {matchMobile ? (
            <MenuIcon sx={{ fontSize: '3rem' }} />
          ) : (
            isMenuOpen ? <ToggleOnIcon sx={{ fontSize: '3rem', opacity: 0.4 }} /> : <ToggleOffIcon sx={{ fontSize: '3rem', opacity: 0.4 }} />
          )}
          {!isMenuOpen && !MenuOpenb && hasUnreadNotifications && (
            <span style={{ position: 'absolute', width: 48, height: 32, pointerEvents: 'none' }}>
              <SocialUnreadDot accent={accent} />
            </span>
          )}
        </div>
      )}

      <style>
        {`
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
          z-index: 10050;
          background: rgba(0,0,0,0.65);
          color: #ffffff;
          backdrop-filter: blur(4px);
        }

        @media (prefers-color-scheme: dark) {
          .toggle-btn {
            background: rgba(255,255,255,0.14);
            color: #ffffff;
          }
        }

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

        @keyframes bounce-animation-2x {
          0%   { transform: scale(1); }
          50%  { transform: scale(3.9); }
          100% { transform: scale(3.5); }
        }
        .bounce2 {
          animation: bounce-animation-2x 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @media (max-width: 768px) {
          .bounce2 { animation-duration: 0.36s; }
        }

        @media (min-width: 768px) {
          .toggle-btn { width: 8vw; height: 8vw; }
        }
        @media (min-width: 1024px) {
          .toggle-btn { width: 4.5vw; height: 4.5vw; }
        }
      `}
      </style>
    </div>
  );
};

export default MenuToggle;
