import React, { useState, useCallback, useEffect } from "react";
import { useDeckRuntime } from './DeckRuntimeContext';
import { openDeckCreation } from './useDeckNavigation';
import { Box } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import { useNavigate, useLocation } from "react-router-dom";

interface TogglePromptButtonProps {
    type?: number;
    minimisePrompt: boolean;
    setminimisePrompt: React.Dispatch<React.SetStateAction<boolean>>;
    matchMobile: boolean;
    allowUploadText?: boolean;
    isMenuOpen: boolean;
    darkModeReducer: boolean;
    setMenuOpenb?: any;
    setIsMenuOpen?: any;
    MenuOpenb?: any;
    textActive?: any;
    setshowGoUpload?: any;
    LastId?: any;
    feedContainerRef?: any;
    isFullscreen?: any;
    setActiveIndex?: any;
}

const TogglePromptButton: React.FC<any> = ({
    minimisePrompt,
    matchMobile,
    allowUploadText,
    isMenuOpen,
    darkModeReducer,
    type,
    textActive,
    isFullscreen,
}) => {
    const dispatch = useDispatch();
    const deckRuntime = useDeckRuntime();
    const [zoom1x, setZoom1x] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);

    // Grid-only control: Deck and Fullscreen have their own Create entry points.
    const deckOpen = useSelector((state: RootState) => state.brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck']?.state.isOpen === true);
    const snapshotVisible = Boolean(minimisePrompt && (!isMenuOpen || matchMobile) && !deckOpen && !isFullscreen);

    useEffect(() => {
        const areaId = 'clikb.navigation.quick_create';
        if (!snapshotVisible) {
            dispatch(removeNavigationArea({ areaId, source: 'TogglePromptButton' }));
            return;
        }
        dispatch(publishNavigationArea({
            areaId,
            source: 'TogglePromptButton',
            state: { route: location.pathname.toLowerCase(), mobileLayout: Boolean(matchMobile) },
            visibleControls: [navigationControl(areaId, 'open_creation', 'TogglePromptButton.handleCreateClick')],
        }));
    }, [dispatch, snapshotVisible, location.pathname, matchMobile]);

    useEffect(() => () => {
        dispatch(removeNavigationArea({ areaId: 'clikb.navigation.quick_create', source: 'TogglePromptButton' }));
    }, [dispatch]);

    const baseToggleIconShadow = darkModeReducer
        ? 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.45))'
        : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35))';
    const baseToggleSurfaceShadow = darkModeReducer
        ? '0 4px 14px rgba(0, 0, 0, 0.35)'
        : 'none';

    const handleCreateClick = useCallback(() => {
        const currentPath = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
        const isCreationPage = ['/', '/feeds', '/images', '/clikit', '/kickit'].includes(currentPath);
        openDeckCreation(location, navigate, deckRuntime.openCreate, deckEnabled);
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.navigation.quick_create', state: { promptOpen: false } },
            after: { route: isCreationPage ? location.pathname : '/images', areaId: 'clikb.navigation.quick_create', controlId: 'clikb.navigation.quick_create.control.open_creation', state: { promptOpen: true } },
            outcome: isCreationPage ? 'succeeded' : 'unknown',
            authoritativeSource: isCreationPage ? 'TogglePromptButton prompt-state handler' : 'TogglePromptButton navigation request',
            detail: isCreationPage ? 'Prompt opening requested' : 'Router location event establishes arrival',
        }));
    }, [dispatch, location, navigate, deckRuntime.openCreate, deckEnabled]);

    if (!snapshotVisible) return null;

    return (
        <Box
            onMouseEnter={() => setZoom1x(true)}
            onMouseOver={() => setZoom1x(true)}
            onMouseLeave={() => setZoom1x(false)}
            onTouchStart={() => setZoom1x(true)}
            onTouchEnd={() => setZoom1x(false)}
            onClick={() => {
                setZoom1x(true);
                setTimeout(() => setZoom1x(false), 300);
            }}
            sx={{
                height: '0vh',
                position: 'fixed',
                top: type === 20
                    ? (matchMobile ? (textActive ? '25vh' : '16vh') : (textActive ? '20vh' : '13vh'))
                    : (matchMobile ? '6.5vh' : isMenuOpen ? '6vh' : '8.5vh'),
                left: matchMobile
                    ? 'auto'
                    : isMenuOpen
                        ? '95vw'
                        : '93vw',
                right: matchMobile ? 'max(8px, env(safe-area-inset-right, 0px))' : 'auto',
                width: matchMobile ? 'auto' : '100%',
                display: 'flex',
                alignItems: 'center',
                zIndex: 1,
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                    data-ai-action="clikb.navigation.quick_create.action.open_creation"
                    className={`toggle-image ${zoom1x ? 'bounce' : ''}`}
                    onClick={() => {
                        handleCreateClick();
                    }}
                    sx={{
                        alignItems: 'center',
                        gap: allowUploadText ? 1 : 0,
                        width: allowUploadText ? 'auto' : 55,
                        height: 55,
                        px: allowUploadText ? 1.6 : 0,
                        py: 0.4,
                        borderRadius: allowUploadText ? 1 : '50%',
                        bgcolor: darkModeReducer ? 'rgba(0,0,0,0.2)' : 'transparent',
                        backdropFilter: darkModeReducer ? 'blur(4px)' : 'none',
                        boxShadow: baseToggleSurfaceShadow,
                        opacity: 1,
                        cursor: 'pointer',
                        '&:hover': {
                            bgcolor: darkModeReducer ? 'rgba(100,100,100,0.3)' : 'rgba(0,0,0,0.08)',
                        },
                        display: 'inline-flex',
                        transition: 'width 250ms ease, border-radius 250ms ease',
                    }}
                >
                    <AddCircleIcon
                        sx={{
                            fontSize: matchMobile ? '1.75rem' : '1.875rem',
                            filter: baseToggleIconShadow,
                            color: darkModeReducer ? '#FF0000' : '#FFB800',
                            textAlign: 'center',
                            margin: 'auto',
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default TogglePromptButton;
