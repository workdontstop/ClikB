import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, IconButton } from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { RootState } from '../store';
import { useBrainstormSession } from './BrainstormSessionProvider';

interface GlobalBrainstormVoiceProps {
    clikUrl: string;
    isMenuOpen?: boolean;
    minimisePrompt?: boolean;
    matchMobile?: boolean;
}

const INITIAL_AUTO_COLLAPSE_MS = 180000; // 3 minutes
const ASSISTANT_EMOJIS = [
    '\u{1F914}', '\u{1F9D0}', '\u{1F92A}', '\u{1F92B}', '\u{1F971}', '\u{1F92A}', '\u{1F914}', '\u{1F92B}',
    '\u{1F9D0}', '\u{1F971}', '\u{1F9D0}', '\u{1F971}', '\u{1F914}', '\u{1F92A}', '\u{1F92B}', '\u{1F92B}',
    '\u{1F92A}', '\u{1F914}', '\u{1F971}', '\u{1F9D0}', '\u{1F971}', '\u{1F9D0}', '\u{1F92B}', '\u{1F92A}',
    '\u{1F914}', '\u{1F914}', '\u{1F92B}', '\u{1F92A}', '\u{1F9D0}', '\u{1F971}', '\u{1F92A}', '\u{1F971}',
    '\u{1F9D0}', '\u{1F92B}', '\u{1F914}', '\u{1F9D0}', '\u{1F914}', '\u{1F971}', '\u{1F92B}', '\u{1F92A}',
];
const pickAssistantEmoji = () => ASSISTANT_EMOJIS[Math.floor(Math.random() * ASSISTANT_EMOJIS.length)];

// Readable icon/text color on top of an arbitrary hex color.
const contrastFor = (color: string): string => {
    const hex = (color || '#808080').replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16) || 128;
    const g = parseInt(full.slice(2, 4), 16) || 128;
    const b = parseInt(full.slice(4, 6), 16) || 128;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#0b0b0e' : '#ffffff';
};

// State-driven face shown INSIDE the active circle (never the nub), reflecting
// what the assistant is doing. Surfaces for 5s on each state change.
const STATUS_EMOJI: Record<string, string> = {
    idle: '\u{1F60C}',        // relieved
    connecting: '\u{1F914}',  // thinking (waiting)
    listening: '\u{1F642}',   // slightly smiling
    thinking: '\u{1F914}',    // thinking
    speaking: '\u{1F604}',    // grinning
    error: '\u{1F635}',       // dizzy
};

export const GlobalBrainstormVoice: React.FC<GlobalBrainstormVoiceProps> = ({ isMenuOpen = false, minimisePrompt = false, matchMobile = false }) => {
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const isChatOpen = useSelector((state: RootState) => state.brainstorm.isChatOpen);
    const appColor = darkMode ? appColorDark : appColorLight;
    const shouldShiftIntoContent = !matchMobile && isMenuOpen && minimisePrompt;
    const isFullAppFloatingVoice = !isChatOpen;

    // Shared position rules Ã¢â‚¬â€ the nub anchors to the SAME spot as the circle
    // (just nudged slightly left), so every circle-position condition is honored.
    const anchorLeft = shouldShiftIntoContent ? 'calc(20vw + 20px)' : 20;
    const anchorBottom = '20vh';

    const { voice, greetViaVoice, chatHistory, textAsk } = useBrainstormSession();

    const { status, error, level, start, stop, speakText, stopSpeech } = voice;
    const isActive = status !== 'idle';
    const isListening = status === 'listening';
    const isThinking = status === 'thinking' || status === 'connecting';
    const isSpeaking = status === 'speaking';
    const isError = status === 'error';
    const glowLevel = Math.max(0.18, Math.min(1, level || 0.18));
    const [assistantEmoji, setAssistantEmoji] = useState<string>(() => pickAssistantEmoji());
    const circleEmoji = STATUS_EMOJI[status] || '';
    const [showCircleEmoji, setShowCircleEmoji] = useState(true);

    // Collapsed = deactivated. The big circle melts into a tiny edge nub so it
    // is not a visual "terror" 24/7, but stays one click away. Session persists.
    const [collapsed, setCollapsed] = useState(false);
    const initialAutoCollapseDoneRef = useRef(false);
    const userInteractedWithBrainstormRef = useRef(false);
    const fullAppModeRef = useRef(isFullAppFloatingVoice);
    const stopRef = useRef(stop);
    const collapseTimerRef = useRef<number | null>(null);
    const helperTimerRef = useRef<number | null>(null);
    const emojiTimerRef = useRef<number | null>(null);
    const [showHelper, setShowHelper] = useState(true);

    // Text-mode label: clicking the transient voice label stops voice and turns
    // that same label surface into a compact type/read panel. Clicking the reply
    // body (or the circle) returns to voice mode. Pinned while open — no 5s hide.
    const [labelMode, setLabelMode] = useState<'voice' | 'text'>('voice');
    const [textBody, setTextBody] = useState<'reply' | 'write'>('reply');
    const [draft, setDraft] = useState('');
    const [askBusy, setAskBusy] = useState(false);
    const activeAskRunRef = useRef(0);
    const [askError, setAskError] = useState<string | null>(null);
    const isTextMode = labelMode === 'text';

    // Latest completed AI reply straight from the shared chatHistory (voice and
    // typed turns both land there), so the panel updates reactively.
    const latestAiReply = useMemo(() => {
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            const msg = chatHistory[i];
            if (msg.role === 'ai' && msg.content?.trim() && !msg.streaming) {
                return msg.content.trim();
            }
        }
        return '';
    }, [chatHistory]);

    const clearCollapseTimer = useCallback(() => {
        if (collapseTimerRef.current != null) {
            window.clearTimeout(collapseTimerRef.current);
            collapseTimerRef.current = null;
        }
    }, []);

    const clearHelperTimer = useCallback(() => {
        if (helperTimerRef.current != null) {
            window.clearTimeout(helperTimerRef.current);
            helperTimerRef.current = null;
        }
    }, []);

    const clearEmojiTimer = useCallback(() => {
        if (emojiTimerRef.current != null) {
            window.clearTimeout(emojiTimerRef.current);
            emojiTimerRef.current = null;
        }
    }, []);

    const markBrainstormUsed = useCallback(() => {
        userInteractedWithBrainstormRef.current = true;
        initialAutoCollapseDoneRef.current = true;
        clearCollapseTimer();
    }, [clearCollapseTimer]);

    useEffect(() => () => {
        clearCollapseTimer();
        clearHelperTimer();
        clearEmojiTimer();
    }, [clearCollapseTimer, clearHelperTimer, clearEmojiTimer]);

    useEffect(() => {
        fullAppModeRef.current = isFullAppFloatingVoice;
    }, [isFullAppFloatingVoice]);

    useEffect(() => {
        stopRef.current = stop;
    }, [stop]);

    useEffect(() => {
        if (initialAutoCollapseDoneRef.current) return;
        collapseTimerRef.current = window.setTimeout(() => {
            collapseTimerRef.current = null;
            if (initialAutoCollapseDoneRef.current || userInteractedWithBrainstormRef.current || !fullAppModeRef.current) return;
            initialAutoCollapseDoneRef.current = true;
            stopRef.current();
            setAssistantEmoji(pickAssistantEmoji());
            setCollapsed(true);
        }, INITIAL_AUTO_COLLAPSE_MS);
        return clearCollapseTimer;
    }, [clearCollapseTimer]);

    // Pick readable text for the "AI" nub regardless of how light/dark appColor is.
    const contrastText = useMemo(() => contrastFor(appColor), [appColor]);

    // Text mode inverts ONLY the circle: it takes the opposite theme's color so
    // the mode switch is instantly visible. Everything else stays on-theme.
    const invertedAppColor = darkMode ? appColorLight : appColorDark;
    const circleColor = isTextMode ? invertedAppColor : appColor;

    const helperText = useMemo(() => {
        if (isError) return error || 'Voice error';
        if (status === 'connecting') return 'Preparing Brainstorm voice';
        if (status === 'thinking') return 'Brainstorm is thinking';
        if (status === 'speaking') return 'Brainstorm is speaking';
        if (status === 'listening') return 'Listening';
        return 'Talk to Brainstorm';
    }, [error, isError, status]);
    const helperBackground = darkMode ? 'rgba(18,18,22,0.94)' : 'rgba(255,255,255,0.94)';
    const helperColor = darkMode ? '#ffffff' : '#111217';
    const helperBorder = darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
    // Text-mode panel follows the current theme (only the circle inverts).
    const panelBackground = helperBackground;
    const panelColor = helperColor;
    const panelBorder = helperBorder;

    useEffect(() => {
        clearHelperTimer();
        // Text mode pins its own panel; the transient helper stays out of the way
        // and never auto-hides mid-typing because this timer path is skipped.
        if (isTextMode) {
            setShowHelper(false);
            return;
        }
        const shouldShowHelper = !collapsed;
        if (!shouldShowHelper) {
            setShowHelper(false);
            return;
        }
        setShowHelper(true);
        helperTimerRef.current = window.setTimeout(() => {
            helperTimerRef.current = null;
            setShowHelper(false);
        }, 5000);
        return clearHelperTimer;
    }, [clearHelperTimer, collapsed, helperText, isTextMode, status]);

    // State-driven face inside the circle: surface it for 5s on each status change.
    useEffect(() => {
        clearEmojiTimer();
        if (collapsed) {
            setShowCircleEmoji(false);
            return;
        }
        setShowCircleEmoji(true);
        emojiTimerRef.current = window.setTimeout(() => {
            emojiTimerRef.current = null;
            setShowCircleEmoji(false);
        }, 5000);
        return clearEmojiTimer;
    }, [clearEmojiTimer, collapsed, status]);

    // Entering text mode: kill voice fully (STT + any TTS playback), keep the
    // circle on screen, and pin the panel starting on the latest reply.
    const enterTextMode = useCallback(() => {
        markBrainstormUsed();
        stop();
        clearCollapseTimer();
        setAskError(null);
        setDraft('');
        setTextBody('reply');
        setLabelMode('text');
    }, [clearCollapseTimer, markBrainstormUsed, stop]);

    // Exit back to voice: panel collapses to the normal label UI and listening
    // resumes immediately.
    const exitTextModeToVoice = useCallback(() => {
        markBrainstormUsed();
        setLabelMode('voice');
        setTextBody('reply');
        setDraft('');
        setAskError(null);
        void start();
    }, [markBrainstormUsed, start]);

    const handleSendDraft = useCallback(async () => {
        const q = draft.trim();
        if (!q) return;
        const runId = ++activeAskRunRef.current;
        setDraft('');
        markBrainstormUsed();
        setAskBusy(true);
        setAskError(null);
        setTextBody('reply');
        try {
            await textAsk(q);
            setDraft('');
        } catch (e) {
            console.error('Brainstorm text ask failed:', e);
            if (activeAskRunRef.current === runId) setAskError('Could not reach Brainstorm. Tap the pencil to try again.');
        } finally {
            if (activeAskRunRef.current === runId) setAskBusy(false);
        }
    }, [askBusy, draft, markBrainstormUsed, textAsk]);

    // Manual play/stop of the latest reply. Never autoplays in text mode.
    const handlePlayToggle = useCallback(() => {
        markBrainstormUsed();
        if (isSpeaking) {
            stopSpeech();
            return;
        }
        if (latestAiReply) void speakText(latestAiReply);
    }, [isSpeaking, latestAiReply, markBrainstormUsed, speakText, stopSpeech]);

    // Circle click: text mode -> back to voice; error -> restart; active ->
    // deactivate now, collapse after a short hold; idle -> activate.
    const handleCircleClick = useCallback(() => {
        markBrainstormUsed();
        if (isTextMode) {
            exitTextModeToVoice();
            return;
        }
        if (status === 'error') {
            stop();
            void start();
            return;
        }
        if (isActive) {
            stop();
            clearCollapseTimer();
            setAssistantEmoji(pickAssistantEmoji());
            setCollapsed(true);
            return;
        }
        clearCollapseTimer();
        void start();
    }, [status, isActive, isTextMode, exitTextModeToVoice, start, stop, clearCollapseTimer, markBrainstormUsed]);

    // Nub click/tap: expand back to the circle, start listening, then auto-greet.
    // start() is awaited first so the greeting's audio doesn't race the session setup.
    const handleNubExpand = useCallback(() => {
        markBrainstormUsed();
        setAssistantEmoji(pickAssistantEmoji());
        setCollapsed(false);
        void (async () => {
            await start();
            await greetViaVoice('hi');
        })();
    }, [start, markBrainstormUsed, greetViaVoice]);

    if (isChatOpen) return null;

    // --- Collapsed state: tiny circular "A.I" nub at the circle's spot, nudged left ------
    if (collapsed) {
        return (
            <Box
                data-ai-snapshot-ignore="true"
                data-brainstorm-ui="true"
                sx={{
                    position: 'fixed',
                    left: anchorLeft,
                    bottom: anchorBottom,
                    zIndex: 2147483600,
                    pointerEvents: 'none',
                }}
            >
                <Box
                    component="button"
                    type="button"
                    aria-label="Open Brainstorm voice"
                    onClick={handleNubExpand}
                    sx={{
                        pointerEvents: 'auto',
                        display: 'grid',
                        placeItems: 'center',
                        width: { xs: 19, sm: 20 },
                        height: { xs: 19, sm: 20 },
                        minWidth: { xs: 19, sm: 20 },
                        maxWidth: { xs: 19, sm: 20 },
                        minHeight: { xs: 19, sm: 20 },
                        maxHeight: { xs: 19, sm: 20 },
                        aspectRatio: '1 / 1',
                        padding: 0,
                        boxSizing: 'border-box',
                        flex: '0 0 auto',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        margin: 0,
                        // Resting: nudged slightly left of the circle anchor.
                        // Hover/focus only scales the fixed circle, which prevents shake.
                        transform: 'translateX(-42%) scale(1)',
                        transformOrigin: 'center center',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: appColor,
                        color: contrastText,
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.14)'}`,
                        cursor: 'pointer',
                        outline: 'none',
                        fontSize: { xs: 10, sm: 11 },
                        fontWeight: 800,
                        letterSpacing: 0,
                        lineHeight: 1,
                        opacity: 0.72,
                        boxShadow: `0 0 10px ${appColor}55`,
                        transition: 'transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        '&:hover, &:focus-visible': {
                            transform: 'translateX(-42%) scale(1.16)',
                            opacity: 1,
                            boxShadow: `0 0 16px ${appColor}8a`,
                            borderColor: `${appColor}aa`,
                        },
                        '&:active': {
                            transform: 'translateX(-42%) scale(1.08)',
                        },
                    }}
                >
                    <Box component="span" aria-hidden="true" sx={{ fontSize: { xs: 13, sm: 13.5 }, lineHeight: 1, transform: 'translateY(-0.5px)' }}>{assistantEmoji}</Box>
                </Box>
            </Box>
        );
    }

    // --- Active state: the audio-reactive hollow circle ----------------------
    return (
        <Box
            data-ai-snapshot-ignore="true"
            data-brainstorm-ui="true"
            sx={{
                position: 'fixed',
                left: anchorLeft,
                // While typing on mobile, lift the whole cluster above the
                // on-screen keyboard (iOS doesn't resize the layout viewport).
                bottom: matchMobile && isTextMode && textBody === 'write' ? '46vh' : anchorBottom,
                zIndex: 2147483600,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, sm: 1.25 },
                transition: 'bottom 220ms ease',
            }}
        >
            <Box
                component="button"
                type="button"
                aria-label={isTextMode ? 'Return to Brainstorm voice mode' : (isActive ? 'Stop global Brainstorm voice' : 'Start global Brainstorm voice')}
                onClick={handleCircleClick}
                sx={{
                    pointerEvents: 'auto',
                    width: { xs: 54, sm: 62 },
                    height: { xs: 54, sm: 62 },
                    borderRadius: '50%',
                    border: `2px solid ${isError ? '#ff5f5f' : circleColor}`,
                    background: 'transparent',
                    backdropFilter: 'none',
                    color: isError ? '#ff5f5f' : circleColor,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isListening || isSpeaking
                        ? `0 0 ${18 + glowLevel * 30}px ${isError ? 'rgba(255,95,95,0.38)' : `${circleColor}7a`}`
                        : `0 0 ${isActive ? 18 : 8}px ${isError ? 'rgba(255,95,95,0.28)' : `${circleColor}42`}`,
                    opacity: isActive ? 1 : 0.86,
                    transition: 'box-shadow 120ms ease, opacity 160ms ease, transform 160ms ease, border-color 160ms ease',
                    animation: isListening || isSpeaking
                        ? 'globalBrainstormPulse 980ms ease-in-out infinite'
                        : 'none',
                    '&:hover': {
                        transform: isListening || isSpeaking ? undefined : 'scale(1.04)',
                        opacity: 1,
                    },
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 5,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: `1px solid ${isError ? 'rgba(255,95,95,0.38)' : `${circleColor}5c`}`,
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        inset: -2,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: isThinking
                            ? `conic-gradient(from 0deg, transparent 0deg, transparent 245deg, ${circleColor} 310deg, transparent 360deg)`
                            : 'transparent',
                        animation: isThinking ? 'globalBrainstormOrbit 1.1s linear infinite' : 'none',
                        opacity: isThinking ? 0.9 : 0,
                        pointerEvents: 'none',
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
                    },
                    '@keyframes globalBrainstormPulse': {
                        '0%, 100%': { transform: 'scale(1)', opacity: 0.84 },
                        '50%': { transform: 'scale(1.045)', opacity: 1 },
                    },
                    '@keyframes globalBrainstormOrbit': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                    },
                }}
            >
                <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        zIndex: 2,
                        fontSize: { xs: 26, sm: 30 },
                        lineHeight: 1,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        opacity: showCircleEmoji && circleEmoji ? 1 : 0,
                        transition: 'opacity 220ms ease',
                    }}
                >
                    {circleEmoji}
                </Box>
            </Box>
            {isTextMode ? (
            <Box
                role="dialog"
                aria-label="Brainstorm text mode"
                sx={{
                    position: 'relative',
                    pointerEvents: 'auto',
                    // Never wider than the viewport allows next to the circle.
                    width: { xs: 'min(232px, calc(100vw - 96px))', sm: 272 },
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: panelBackground,
                    color: panelColor,
                    border: `1px solid ${panelBorder}`,
                    boxShadow: darkMode
                        ? '0 10px 26px rgba(0,0,0,0.30)'
                        : '0 10px 26px rgba(0,0,0,0.42)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Thick top bar (~30%): write toggle + manual play/stop */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 0.75,
                        minHeight: { xs: 42, sm: 46 },
                        background: appColor,
                        color: contrastText,
                        flex: '0 0 auto',
                    }}
                >
                    <IconButton
                        size="small"
                        aria-label={textBody === 'write' ? 'Show latest reply' : 'Write a question'}
                        onClick={() => { setAskError(null); setTextBody(textBody === 'write' ? 'reply' : 'write'); }}
                        sx={{ color: 'inherit' }}
                    >
                        {textBody === 'write' ? <ChatBubbleOutlineRoundedIcon fontSize="small" /> : <EditRoundedIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                        size="small"
                        aria-label={isSpeaking ? 'Stop audio' : 'Play latest reply'}
                        onClick={handlePlayToggle}
                        disabled={!latestAiReply && !isSpeaking}
                        sx={{ color: 'inherit', opacity: !latestAiReply && !isSpeaking ? 0.4 : 1 }}
                    >
                        {isSpeaking ? <StopRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
                    </IconButton>
                </Box>
                {/* Body (~70%): latest reply (tap to return to voice) or the quiet ask field */}
                {textBody === 'reply' ? (
                    <Box
                        onClick={exitTextModeToVoice}
                        title="Tap to talk instead"
                        sx={{
                            px: 1.4,
                            py: 1.1,
                            minHeight: { xs: 88, sm: 100 },
                            maxHeight: { xs: 150, sm: 170 },
                            overflowY: 'auto',
                            cursor: 'pointer',
                            fontSize: { xs: 12, sm: 13 },
                            fontWeight: 500,
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                            opacity: askBusy ? 0.7 : 1,
                        }}
                    >
                        {askBusy ? 'Thinking…' : (askError || latestAiReply || 'No reply yet. Tap the pencil to type, or tap here to talk.')}
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, px: 1, py: 1 }}>
                        <Box
                            component="textarea"
                            autoFocus
                            value={draft}
                            placeholder={'Ask Brainstorm quietly…'}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleSendDraft();
                                }
                            }}
                            sx={{
                                flex: 1,
                                resize: 'none',
                                minHeight: { xs: 68, sm: 76 },
                                background: 'transparent',
                                color: panelColor,
                                border: `1px solid ${panelBorder}`,
                                borderRadius: '8px',
                                outline: 'none',
                                fontFamily: 'inherit',
                                // 16px on mobile: anything smaller triggers iOS
                                // Safari's auto-zoom when the field is focused.
                                fontSize: { xs: 16, sm: 13 },
                                lineHeight: 1.4,
                                p: 0.9,
                                // Caret fix (same as Homepage search field): index.css/App.css
                                // set `html *:focus { caret-color: transparent !important }`,
                                // which outranks a single class. The doubled selector below
                                // gives this rule higher specificity so `auto !important` wins,
                                // exactly like `.css-x .MuiInputBase-input` does on Homepage.
                                caretColor: 'auto !important',
                                '&&:focus': {
                                    caretColor: 'auto !important',
                                    userSelect: 'text !important',
                                    outline: 'none',
                                },
                                '&::placeholder': { color: panelColor, opacity: 0.55 },
                            }}
                        />
                        <IconButton
                            size="small"
                            aria-label="Send question"
                            onClick={() => void handleSendDraft()}
                            disabled={!draft.trim()}
                            sx={{ color: appColor, opacity: !draft.trim() ? 0.4 : 1 }}
                        >
                            <SendRoundedIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )}
            </Box>
            ) : (
            <Box
                aria-hidden={!showHelper}
                role="button"
                aria-label="Switch Brainstorm to text mode"
                title="Tap to type instead"
                onClick={showHelper ? enterTextMode : undefined}
                sx={{
                    position: 'relative',
                    pointerEvents: showHelper ? 'auto' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6,
                    minHeight: { xs: 28, sm: 30 },
                    maxWidth: { xs: 170, sm: 230 },
                    px: { xs: 1.15, sm: 1.35 },
                    py: 0.75,
                    borderRadius: '7px',
                    background: helperBackground,
                    color: isError ? '#ff7777' : helperColor,
                    border: `1px solid ${isError ? 'rgba(255,95,95,0.42)' : helperBorder}`,
                    boxShadow: darkMode
                        ? '0 8px 22px rgba(0,0,0,0.36)'
                        : '0 8px 22px rgba(0,0,0,0.16)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    fontSize: { xs: 11, sm: 12 },
                    fontWeight: 700,
                    letterSpacing: 0,
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: showHelper ? 1 : 0,
                    visibility: showHelper ? 'visible' : 'hidden',
                    transform: showHelper ? 'translateX(0)' : 'translateX(-4px)',
                    transition: 'opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: -5,
                        top: '50%',
                        width: 8,
                        height: 8,
                        transform: 'translateY(-50%) rotate(45deg)',
                        background: helperBackground,
                        borderLeft: `1px solid ${isError ? 'rgba(255,95,95,0.42)' : helperBorder}`,
                        borderBottom: `1px solid ${isError ? 'rgba(255,95,95,0.42)' : helperBorder}`,
                    },
                }}
            >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{helperText}</Box>
                {/* Pencil hint: this label is tappable and switches to text mode. */}
                <EditRoundedIcon sx={{ fontSize: { xs: 13, sm: 14 }, opacity: 0.7, flexShrink: 0 }} />
            </Box>
            )}
        </Box>
    );
};
