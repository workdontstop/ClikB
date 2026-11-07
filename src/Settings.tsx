import { CONVERSATION_MODELS } from './conversationModels';
import CreativeProfiles from './CreativeProfiles';
import React, { useEffect, useRef, useState, type FC } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { Alert, Box, Button, Container, FormControlLabel, IconButton, Stack, Switch, Typography, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DownloadIcon from '@mui/icons-material/Download';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ConversationModelPicker from './ConversationModelPicker';
import { setAppColorDark, setAppColorLight, setThemePreference, setDeckCleanMode, type ThemePreference } from './settingsSlice';
import { APP_ACCENT_COLORS, type AppAccentColor } from './appAccentColors';
import { updateProfileAccentColor } from './profileSlice';
import { saveDeckPreference } from './deckPreference';
import { publishNavigationArea, recordNavigationTransition, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';
import type { NavigationViewport } from './navigationControlSnapshot';
import { useNavigationViewport } from './useNavigationViewport';
import type { RootState } from './store';
import { usePWA } from './PWAContext';

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

interface SettingsProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
    darkmode?: boolean;
}

const appearanceOptions: { id: ThemePreference; name: string; Icon: typeof BrightnessAutoIcon }[] = [
    { id: 'automatic', name: 'Automatic', Icon: BrightnessAutoIcon },
    { id: 'light', name: 'Light', Icon: LightModeIcon },
    { id: 'dark', name: 'Dark', Icon: DarkModeIcon },
];

const Settings: FC<SettingsProps> = ({ setcallFeeds }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const store = useStore<RootState>();
    const matchMobile = useMediaQuery('(max-width:767px)');
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const themePreference = useSelector((state: RootState) => state.settings.themePreference);
    const conversationModel = useSelector((state: RootState) => state.settings.conversationModel);
    const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
    const deckCleanMode = useSelector((state: RootState) => state.settings.deckCleanMode);
    const deckLabel = deckEnabled ? 'On' : 'Off';
    const deckModeLabel = deckCleanMode ? 'Clean' : 'Normal';
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = darkMode ? appColorDark : appColorLight;
    const colorMode = darkMode ? 'dark' : 'light';
    const accentColors = APP_ACCENT_COLORS[colorMode];
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const isGuest = loggedUser?.id === 1;
    const { installPwa, isInstallable, isPwaMode } = usePWA();
    const foreground = darkMode ? '#f7f7f8' : '#17171b';
    const panel = darkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)';
    const border = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.11)';
    const deckSwitchSx = {
        '& .MuiSwitch-switchBase.Mui-checked': { color: appColor, '&:hover': { bgcolor: alpha(appColor, 0.08) } },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: appColor },
    };
    const pageViewport = useNavigationViewport('vertical', matchMobile);
    const [modelViewport, setModelViewport] = useState<NavigationViewport | null>(null);
    const previousSettled = useRef<Record<string, NavigationViewport>>({});
    const [accentSaving, setAccentSaving] = useState(false);
    const [accentSaveError, setAccentSaveError] = useState<string | null>(null);
    const accentSaveInFlight = useRef(false);
    const deckSaveInFlight = useRef(false);
    const [deckSaving, setDeckSaving] = useState(false);
    const [deckSaveError, setDeckSaveError] = useState<string | null>(null);

    useEffect(() => {
        for (const [surface, current] of Object.entries({ page: pageViewport.viewport, model_strip: modelViewport })) {
            if (!current?.settledAt || current.isScrolling) continue;
            const previous = previousSettled.current[surface];
            if (previous?.settledAt === current.settledAt) continue;
            previousSettled.current[surface] = current;
            if (!previous || (previous.region === current.region && previous.visibleIds.join('|') === current.visibleIds.join('|'))) continue;
            dispatch(recordNavigationTransition({
                actor: 'unknown', kind: 'area',
                before: { route: location.pathname, areaId: 'clikb.settings', state: { scrollSurface: surface, scrollRegion: previous.region, visibleIds: previous.visibleIds.join(',') } },
                after: { route: location.pathname, areaId: 'clikb.settings', state: { scrollSurface: surface, scrollRegion: current.region, visibleIds: current.visibleIds.join(',') } },
                outcome: 'succeeded', authoritativeSource: `Settings ${surface} scroll settlement`,
            }));
        }
    }, [dispatch, location.pathname, pageViewport.viewport, modelViewport]);

    useEffect(() => {
        setcallFeeds(true);
    }, [location.pathname, setcallFeeds]);

    useEffect(() => {
        const areaId = 'clikb.settings';
        dispatch(publishNavigationArea({
            areaId,
            source: 'Settings',
            scrolls: {
                ...(pageViewport.viewport ? { page: pageViewport.viewport } : {}),
                ...(modelViewport ? { model_strip: modelViewport } : {}),
            },
            state: {
                themePreference,
                effectiveDarkMode: darkMode,
                conversationModel,
                deckEnabled, deckCleanMode,
                accentMode: colorMode,
                appColor,
                appColorDark,
                appColorLight,
                activeAccentName: accentColors.find(color => color.value.toLowerCase() === appColor.toLowerCase())?.name ?? null,
                mobileLayout: matchMobile,
            },
            visibleControls: [
                navigationControl(areaId, 'close', 'Settings.handleClose'),
                ...(['automatic', 'light', 'dark'] as const).map(name => navigationControl(areaId, `theme_${name}`, 'Settings.setThemePreference')),
                ...accentColors.map(color => navigationControl(areaId, `accent_${colorMode}_${color.name.toLowerCase()}`,
                    darkMode ? 'Settings.setAppColorDark' : 'Settings.setAppColorLight', 'candidate',
                    !accentSaving && !!loggedUser && color.value.toLowerCase() !== appColor.toLowerCase(), undefined,
                    accentSaving ? 'Saving accent color' : color.value.toLowerCase() === appColor.toLowerCase() ? 'Accent color is already selected' : undefined)),
                ...CONVERSATION_MODELS.map(({id: name}) => navigationControl(areaId, `conversation_${name}`, 'ConversationModelPicker.setConversationModel')),
                navigationControl(areaId, 'toggle_deck', 'Settings.handleDeckSetting', 'candidate',
                    !deckSaving && !!loggedUser, undefined, deckSaving ? 'Saving Deck setting' : undefined),
                ...(deckEnabled ? [navigationControl(areaId, 'toggle_deck_clean_mode', 'Settings.setDeckCleanMode')] : []),
                navigationControl(areaId, 'privacy_policy', 'Settings.navigate(/privacy-policy)'),
                navigationControl(areaId, 'install_app', 'Settings.installPwa', 'manual_only', isInstallable && !isPwaMode),
                navigationControl(areaId, 'logout', 'Settings.handleLogout', 'manual_only'),
            ],
        }));
    }, [dispatch, themePreference, darkMode, conversationModel, deckEnabled, deckCleanMode, deckSaving, matchMobile, pageViewport.viewport, modelViewport, isGuest, isInstallable, isPwaMode, colorMode, appColor, appColorDark, appColorLight, accentColors, accentSaving, loggedUser]);

    useEffect(() => () => {
        dispatch(removeNavigationArea({ areaId: 'clikb.settings', source: 'Settings' }));
    }, [dispatch]);

    const handleLogout = async () => {
        try {
            await axios.post(`${CLIK_URL}/logout`, {}, { withCredentials: true });
            dispatch(recordNavigationTransition({
                actor: 'manual', kind: 'control',
                before: { route: location.pathname, areaId: 'clikb.settings' },
                after: { route: '/', areaId: 'clikb.settings', controlId: 'clikb.settings.control.logout', state: { loggedOut: true } },
                outcome: 'succeeded', authoritativeSource: 'POST /logout response',
            }));
            window.location.replace('/');
        } catch (error) {
            console.error('Error during logout:', error);
            dispatch(recordNavigationTransition({
                actor: 'manual', kind: 'control',
                before: { route: location.pathname, areaId: 'clikb.settings' },
                after: { route: location.pathname, areaId: 'clikb.settings', controlId: 'clikb.settings.control.logout', state: { loggedOut: false } },
                outcome: 'failed', authoritativeSource: 'POST /logout error',
            }));
        }
    };

    const handlePrivacyPolicy = () => {
        navigate('/privacy-policy');
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.settings' },
            after: { route: '/privacy-policy', areaId: 'clikb.settings', controlId: 'clikb.settings.control.privacy_policy' },
            outcome: 'unknown', authoritativeSource: 'Settings privacy navigation request',
            detail: 'Router location event establishes arrival',
        }));
    };

    const handleThemeChange = (next: ThemePreference) => {
        const previous = themePreference;
        dispatch(setThemePreference(next));
        if (previous === next) return;
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.settings', state: { themePreference: previous } },
            after: { route: location.pathname, areaId: 'clikb.settings', controlId: `clikb.settings.control.theme_${next}`, state: { themePreference: next } },
            outcome: 'succeeded', authoritativeSource: 'settings Redux theme reducer',
        }));
    };

    const handleAccentChange = async (color: AppAccentColor) => {
        if (!loggedUser || accentSaveInFlight.current || color.value.toLowerCase() === appColor.toLowerCase()) return;
        const userId = loggedUser.id;
        accentSaveInFlight.current = true;
        setAccentSaving(true);
        setAccentSaveError(null);
        dispatch(darkMode ? setAppColorDark(color.value) : setAppColorLight(color.value));
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.settings', state: { accentMode: colorMode, appColor } },
            after: { route: location.pathname, areaId: 'clikb.settings', controlId: `clikb.settings.control.accent_${colorMode}_${color.name.toLowerCase()}`,
                state: { accentMode: colorMode, appColor: color.value, activeAccentName: color.name } },
            outcome: 'succeeded', authoritativeSource: `settings Redux ${darkMode ? 'setAppColorDark' : 'setAppColorLight'} reducer`,
        }));
        try {
            await axios.post(`${CLIK_URL}/settings/accent-color`, { mode: colorMode, color: color.value }, { withCredentials: true });
            dispatch(updateProfileAccentColor({ userId, mode: colorMode, color: color.value }));
        } catch {
            if ((store.getState() as RootState).profile.loggedUser?.id === userId) {
                dispatch(darkMode ? setAppColorDark(appColor) : setAppColorLight(appColor));
                setAccentSaveError('Your color could not be saved. Please try again.');
            }
        } finally {
            accentSaveInFlight.current = false;
            setAccentSaving(false);
        }
    };

    const handleDeckSetting = async (cleanMode: boolean, checked: boolean) => {
        if (!cleanMode && (!loggedUser || deckSaveInFlight.current)) return;
        const recordChange = () => dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.settings', state: { deckEnabled, deckCleanMode } },
            after: { route: location.pathname, areaId: 'clikb.settings',
                controlId: `clikb.settings.control.${cleanMode ? 'toggle_deck_clean_mode' : 'toggle_deck'}`,
                state: { deckEnabled: cleanMode ? deckEnabled : checked, deckCleanMode: cleanMode ? checked : deckCleanMode } },
            outcome: 'succeeded', authoritativeSource: 'settings Redux Deck reducer',
        }));
        if (cleanMode) {
            dispatch(setDeckCleanMode(checked));
            recordChange();
            return;
        }
        deckSaveInFlight.current = true; setDeckSaving(true); setDeckSaveError(null);
        try {
            if (await saveDeckPreference(store, CLIK_URL, checked)) recordChange();
        } catch {
            setDeckSaveError('Your Deck setting could not be saved. Please try again.');
        } finally { deckSaveInFlight.current = false; setDeckSaving(false); }
    };

    const handleClose = () => {
        const canGoBack = Number(window.history.state?.idx) > 0 || location.key !== 'default';
        const targetRoute = canGoBack ? 'history_back' : '/feeds';
        dispatch(recordNavigationTransition({
            actor: 'manual', kind: 'control',
            before: { route: location.pathname, areaId: 'clikb.settings' },
            after: { route: targetRoute, areaId: 'clikb.settings', controlId: 'clikb.settings.control.close' },
            outcome: 'succeeded', authoritativeSource: 'Settings close handler',
        }));
        if (canGoBack) { navigate(-1); return; } else { navigate('/feeds'); return; }
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (matchMobile) return;
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    return (
        <Box
            ref={pageViewport.ref}
            onScroll={pageViewport.onScroll}
            onClick={handleBackdropClick}
            data-ai-scroll="clikb.settings:page"
            sx={{
                height: '100vh',
                overflowY: 'auto',
                pt: { xs: 3, md: 5 },
                pb: { xs: 14, md: 5 },
                color: foreground,
                bgcolor: darkMode ? '#08090b' : '#fbfbfc',
                cursor: matchMobile ? 'default' : 'pointer',
            }}
        >
            <Container maxWidth="md" onClick={(e) => e.stopPropagation()} sx={{ cursor: 'default' }}>
                <Stack spacing={3.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>Settings</Typography>
                        <IconButton
                            onClick={handleClose}
                            aria-label="Close settings"
                            data-ai-action="clikb.settings.action.close"
                            sx={{
                                display: 'inline-flex',
                                color: foreground,
                                opacity: 0.65,
                                '&:hover': {
                                    opacity: 1,
                                    bgcolor: panel,
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <CreativeProfiles surface="settings" />
                    <Box data-navigation-scroll-id="clikb.settings.section.appearance" component="section" aria-labelledby="appearance-heading" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: panel, border: `1px solid ${border}` }}>
                        <Typography id="appearance-heading" variant="h6" sx={{ fontWeight: 750 }}>Appearance</Typography>
                        <Box role="group" aria-label="Appearance preference" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25, mt: 2 }}>
                            {appearanceOptions.map((option) => {
                                const selected = themePreference === option.id;
                                return (
                                    <Box
                                        key={option.id}
                                        component="button"
                                        type="button"
                                        aria-pressed={selected}
                                        data-ai-action={`clikb.settings.action.theme_${option.id}`}
                                        onClick={() => handleThemeChange(option.id)}
                                        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textAlign: 'left', p: 1.75, minHeight: 76, cursor: 'pointer', borderRadius: 2, color: foreground, background: selected ? alpha(appColor, 0.14) : panel, border: `2px solid ${selected ? appColor : border}`, '&:hover': { background: alpha(appColor, 0.12) }, '&:focus-visible': { outline: `2px solid ${appColor}`, outlineOffset: 2 } }}
                                    >
                                        <option.Icon aria-hidden="true" sx={{ fontSize: 25, color: selected ? appColor : foreground }} />
                                        <Typography sx={{ fontWeight: 700 }}>{option.name}</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${border}` }}>
                            <Typography id="accent-color-heading" sx={{ fontWeight: 700 }}>Accent color</Typography>
                            <Typography sx={{ mt: 0.5, fontSize: 13, color: foreground, opacity: 0.7 }}>
                                {darkMode ? 'Dark' : 'Light'} mode · Each mode remembers its own color.
                            </Typography>
                            <Box role="group" aria-labelledby="accent-color-heading" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, 44px)', gap: 1.5, mt: 2, p: 0.5 }}>
                                {accentColors.map((color) => {
                                    const selected = appColor.toLowerCase() === color.value.toLowerCase();
                                    return (
                                        <Box
                                            key={`${colorMode}-${color.value}`}
                                            component="button"
                                            type="button"
                                            aria-label={`${color.name} accent for ${colorMode} mode`}
                                            aria-pressed={selected}
                                            title={color.name}
                                            disabled={accentSaving || !loggedUser}
                                            data-ai-action={`clikb.settings.action.accent_${colorMode}_${color.name.toLowerCase()}`}
                                            onClick={() => handleAccentChange(color)}
                                            sx={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: 44, height: 44, p: 0, borderRadius: '50%', cursor: 'pointer',
                                                bgcolor: color.value, color: darkMode ? '#000000' : '#FFFFFF', border: 'none',
                                                outline: selected ? `2px solid ${foreground}` : 'none', outlineOffset: 3,
                                                '&:hover': { boxShadow: `0 0 0 3px ${alpha(foreground, 0.2)}` },
                                                '&:focus-visible': { outline: `3px solid ${foreground}`, outlineOffset: 3 },
                                                '&:disabled': { cursor: 'wait' },
                                            }}
                                        >
                                            {selected && <CheckIcon aria-hidden="true" sx={{ fontSize: 24 }} />}
                                        </Box>
                                    );
                                })}
                            </Box>
                            {accentSaving && <Typography role="status" sx={{ mt: 1.5, fontSize: 13 }}>Saving color…</Typography>}
                            {accentSaveError && <Alert severity="error" sx={{ mt: 1.5 }}>{accentSaveError}</Alert>}
                        </Box>
                    </Box>

                    <Box data-navigation-scroll-id="clikb.settings.section.deck" component="section" aria-label="Deck settings" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: panel, border: `1px solid ${border}` }}>
                        <Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>Deck</Typography>
                        <Stack spacing={2}>
                            <Box>
                                <FormControlLabel label={deckLabel} control={<Switch checked={deckEnabled} disabled={deckSaving || !loggedUser} sx={deckSwitchSx}
                                    inputProps={{ 'aria-label': deckLabel, 'data-ai-action': 'clikb.settings.action.toggle_deck' } as React.InputHTMLAttributes<HTMLInputElement>}
                                    onChange={(_, checked) => handleDeckSetting(false, checked)} />} />
                            </Box>
                            {deckEnabled && <Box>
                                <FormControlLabel label={deckModeLabel} control={<Switch checked={deckCleanMode} sx={deckSwitchSx}
                                    inputProps={{ 'aria-label': deckModeLabel, 'data-ai-action': 'clikb.settings.action.toggle_deck_clean_mode' } as React.InputHTMLAttributes<HTMLInputElement>}
                                    onChange={(_, checked) => handleDeckSetting(true, checked)} />} />
                            </Box>}
                        </Stack>
                        {deckSaveError && <Typography role="alert" color="error" sx={{ mt: 1 }}>{deckSaveError}</Typography>}
                    </Box>

                    <Box data-navigation-scroll-id="clikb.settings.section.conversation_ai" component="section" aria-label="Conversation AI settings" sx={{ p: { xs: 1, md: 2 }, borderRadius: 3, bgcolor: panel, border: `1px solid ${border}` }}>
                        <ConversationModelPicker darkMode={darkMode} matchMobile={matchMobile} appColor={appColor} navigationAreaId="clikb.settings" onViewportChange={setModelViewport} />
                    </Box>

                    <Box component="section" aria-label="Install ClikB" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: panel, border: `1px solid ${border}` }}>
                        <Typography variant="h6" sx={{ fontWeight: 750, mb: 1.5 }}>Desktop app</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            data-ai-action="clikb.settings.action.install_app"
                            disabled={!isInstallable || isPwaMode}
                            onClick={() => { void installPwa(); }}
                            sx={{
                                borderColor: appColor,
                                color: appColor,
                                '&.Mui-disabled': {
                                    color: darkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.38)',
                                    borderColor: darkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.14)',
                                },
                            }}
                        >
                            {isPwaMode ? 'Desktop App installed' : isInstallable ? 'Install Desktop App' : 'Desktop App unavailable'}
                        </Button>
                    </Box>

                    <Box data-navigation-scroll-id="clikb.settings.section.account_privacy" component="section" aria-label="Account and privacy" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, bgcolor: panel, border: `1px solid ${border}` }}>
                        <Typography variant="h6" sx={{ fontWeight: 750, mb: 1.5 }}>Account & privacy</Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                            <Button variant="outlined" data-ai-action="clikb.settings.action.privacy_policy" onClick={handlePrivacyPolicy} sx={{ borderColor: border, color: foreground }}>Privacy Policy</Button>
                            <Button variant="outlined" color="error" onClick={handleLogout}>Logout</Button>
                        </Stack>
                    </Box>
                </Stack>
            </Container>
        </Box>
    );
};

export default Settings;
