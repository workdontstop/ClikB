import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { setConciergeResponseExpanded } from '../settingsSlice';
import { Box, Button, IconButton, Modal, Tooltip, Typography, useMediaQuery } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import ViewCarouselOutlinedIcon from '@mui/icons-material/ViewCarouselOutlined';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import MicRoundedIcon from '@mui/icons-material/MicRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';

import { RootState } from '../store';
import { useBrainstormSession } from './BrainstormSessionProvider';
import AutoControlRevealButton from '../AutoControlRevealButton';
import AutoControlPill from '../AutoControlPill';
import { CONVERSATION_MODELS, isOpenAiConversationProfile, isPaidConversationTier, type ConversationModelTier } from '../conversationModels';
import { setConversationModel } from '../settingsSlice';
import { setBrainstormSelectedVoice } from '../brainstormSlice';
import { notifyOpenAiSelected } from '../openAiSelection';
import { useFishVoices, GEMINI_VOICE_OPTIONS } from '../fishVoices';
import { appAccentForeground } from '../appAccentStyles';
import { saveDeckPreference } from '../deckPreference';

interface GlobalBrainstormGuideProps {
    clikUrl?: string;
    isMenuOpen?: boolean;
    MenuOpenb?: boolean;
    minimisePrompt?: boolean;
    matchMobile?: boolean;
    placement?: 'floating' | 'notepad';
    automaticReviewActive?: boolean;
    dockHost?: HTMLElement | null;
    confirmationDockHost?: HTMLElement | null;
    creationTop?: boolean;
}


const TEXT_MODE_ANIMALS = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁',
    '🐯', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧',
    '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
    '🐝', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🦂', '🐢', '🐙',
] as const;

const pickTextModeAnimal = (): string => (
    TEXT_MODE_ANIMALS[Math.floor(Math.random() * TEXT_MODE_ANIMALS.length)]
);

const quickPointerAction = (action: () => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        action();
    },
    // Pointer activation already ran above; detail === 0 preserves keyboard
    // and assistive-technology click activation without firing twice.
    onClick: (event: React.MouseEvent<HTMLElement>) => {
        if (event.detail === 0) action();
    },
});



export const GlobalBrainstormGuide: React.FC<GlobalBrainstormGuideProps> = ({
    clikUrl,
    isMenuOpen = false,
    MenuOpenb = false,
    minimisePrompt = false,
    matchMobile = false,
    placement = 'floating',
    automaticReviewActive = false,
    dockHost = null,
    confirmationDockHost = null,
    creationTop = false,
}) => {
    const isNarrowViewport = useMediaQuery('(max-width:599.95px)');
    const compactViewport = matchMobile || isNarrowViewport;
    const activeDockHost = (compactViewport && confirmationDockHost) || dockHost;
    const dock = (content: React.ReactNode) => activeDockHost ? createPortal(content, activeDockHost) : content;
    const dockStyles = activeDockHost ? {
        position: 'static' as const, left: 'auto', bottom: 'auto', top: 'auto', translate: 'none',
        zIndex: 1, maxWidth: '100%',
    } : {};
    const pixelsOverlayOpen = useSelector((state: RootState) => state.settings.pixelsOverlayOpen);
    const creationSelectionDialogOpen = useSelector((state: RootState) => state.settings.creationSelectionDialogOpen);
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const isChatOpen = useSelector((state: RootState) => state.brainstorm.isChatOpen);
    const automaticGuide = useSelector((state: RootState) => state.brainstorm.automaticGuide);
    const autoControlVisible = useSelector((state: RootState) => state.settings.autoControlVisible);
    const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
    const hasDeckProfile = useSelector((state: RootState) => Boolean(state.profile.loggedUser?.id));
    const store = useStore<RootState>();
    const [deckSaving, setDeckSaving] = useState(false);
    const [deckSaveError, setDeckSaveError] = useState(false);
    // PromptInput already publishes where the user is in the creation flow via
    // patchUserSnapshot, so the circle can follow the UI without any new plumbing.
    const creationStage = useSelector((state: RootState) => state.brainstorm.userSnapshot.creation.stage);
    const isInitialComposer = useSelector((state: RootState) => state.brainstorm.userSnapshot.creation.isInitialComposer === true);
    const isCompactCreation = useSelector((state: RootState) => state.brainstorm.userSnapshot.creation.isCompactOverlay === true);
    const isSceneEditorOpen = useSelector((state: RootState) => state.brainstorm.userSnapshot.creation.editStoryIsOpen === true);
    const isTemplatesAreaActive = useSelector((state: RootState) => Boolean(state.brainstorm.userSnapshot.creation.controls?.areas?.["clikb.creation.templates"]));
    const relationshipListType = useSelector((state: RootState) => (
        state.brainstorm.userSnapshot.navigation?.areas['clikb.navigation.relationships']?.state.listType
    ));
    const {
        voice,
        chatHistory,
        textAsk,
        guideEnabled,
        setGuideEnabled,
        guidePlayMode,
        setGuidePlayMode,
        guidePanelState,
        setGuidePanelState,
        hasGuideUseTarget,
        guideUseTargetLabel,
        appendGuideTextToTarget,
        isGuideInlineHostActive,
        registerGuideInlineHost,
    } = useBrainstormSession();

    const { status, error, level, start, stop, askText: askTextWithVoice, speakText, stopSpeech } = voice;
    const [textBody, setTextBody] = useState<'reply' | 'write'>('reply');
    const [draft, setDraft] = useState('');
    const draftRevisionRef = useRef(0);
    const activeAskRunRef = useRef(0);
    const [askBusy, setAskBusy] = useState(false);
    const [askError, setAskError] = useState<string | null>(null);
    const [usedMessageId, setUsedMessageId] = useState<string | null>(null);
    const [unreadReplyId, setUnreadReplyId] = useState<string | null>(null);
    const observedReplyIdRef = useRef<string | null>(null);

    const [voiceMode, setVoiceMode] = useState(false);
    const [hiddenReturnMode, setHiddenReturnMode] = useState<'text' | 'voice'>('text');
    const dispatch = useDispatch();
    const responseExpanded = useSelector((state: RootState) => state.settings.conciergeResponseExpanded);
    const conversationModel = useSelector((state: RootState) => state.settings.conversationModel);
    const selectedVoice = useSelector((state: RootState) => state.brainstorm.selectedVoice);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [showModelModal, setShowModelModal] = useState(false);
    const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
    const voicePreviewRef = useRef<HTMLAudioElement | null>(null);

    const fishVoices = useFishVoices(showVoiceModal);
    const voiceOptions = useMemo(() => [
        ...fishVoices.map(v => ({
            id: v.id,
            label: `${v.name} (Fish)`,
            tone: v.tone,
            gender: v.gender,
            previewUrl: v.previewUrl,
        })),
        ...GEMINI_VOICE_OPTIONS.map(v => ({
            ...v,
            label: `${v.label} (Gemini)`,
        })),
    ], [fishVoices]);
    const selectedVoiceMeta = useMemo(() => (
        voiceOptions.find(v => v.id === selectedVoice) || voiceOptions[0]
    ), [voiceOptions, selectedVoice]);
    const selectedModelMeta = useMemo(() => (
        CONVERSATION_MODELS.find(m => m.id === conversationModel) || CONVERSATION_MODELS[0]
    ), [conversationModel]);

    const stopVoicePreview = useCallback(() => {
        if (voicePreviewRef.current) {
            voicePreviewRef.current.pause();
            voicePreviewRef.current.currentTime = 0;
            voicePreviewRef.current = null;
        }
        setPreviewingVoice(null);
    }, []);

    const toggleVoicePreview = useCallback((previewUrl?: string, voiceId?: string) => {
        if (!previewUrl || !voiceId) return;
        if (previewingVoice === voiceId) {
            stopVoicePreview();
            return;
        }
        stopVoicePreview();
        const audio = new Audio(previewUrl);
        voicePreviewRef.current = audio;
        audio.onended = () => setPreviewingVoice(null);
        audio.onerror = () => setPreviewingVoice(null);
        audio.play().then(() => setPreviewingVoice(voiceId)).catch(() => setPreviewingVoice(null));
    }, [previewingVoice, stopVoicePreview]);

    useEffect(() => {
        if (!showVoiceModal) stopVoicePreview();
        return () => stopVoicePreview();
    }, [showVoiceModal, stopVoicePreview]);
    const isPaidConcierge = isPaidConversationTier(conversationModel);
    const [voiceCostFloatId, setVoiceCostFloatId] = useState(0);
    const prevVoicePaidActiveRef = useRef(false);
    useEffect(() => {
        const nowActive = Boolean(isPaidConcierge && (voiceMode || guidePlayMode));
        if (nowActive && !prevVoicePaidActiveRef.current) {
            setVoiceCostFloatId(id => id + 1);
        }
        if (!nowActive) {
            setVoiceCostFloatId(0);
        }
        prevVoicePaidActiveRef.current = nowActive;
    }, [isPaidConcierge, voiceMode, guidePlayMode]);
    const [textPinnedOpen, setTextPinnedOpen] = useState(false);
    const [textModeAnimal, setTextModeAnimal] = useState<string>(pickTextModeAnimal);
    const textPanelBeforeVoiceRef = useRef<'normal' | 'compact'>('normal');
    const voiceTextScrollRef = useRef<HTMLButtonElement | null>(null);
    const initialAutoOffTimerRef = useRef<number | null>(null);
    const userInteractedRef = useRef(false);

    const cancelAutoOffTimer = useCallback(() => {
        userInteractedRef.current = true;
        if (initialAutoOffTimerRef.current !== null) {
            window.clearTimeout(initialAutoOffTimerRef.current);
            initialAutoOffTimerRef.current = null;
        }
    }, []);


    const appColor = darkMode ? appColorDark : appColorLight;
    const isNotepadPlacement = placement === 'notepad';
    useEffect(() => {
        if (!isNotepadPlacement || guideEnabled) return undefined;
        const timer = window.setInterval(() => setTextModeAnimal(pickTextModeAnimal()), 3500);
        return () => window.clearInterval(timer);
    }, [isNotepadPlacement, guideEnabled]);
    /**
     * The 20vw offset exists to clear the side menu — but only while the menu column
     * is actually what sits beside the circle.
     *
     * The moment the engine answers and the UI becomes the accessing-imagination box,
     * and from there through the preview, character studio and fullscreen storyboard,
     * the creation panel spans edge to edge and covers that column (PromptInput's
     * `minimizeMode === 0` sets left:0 / width:100%). Holding the offset then parks
     * the circle on top of content instead of beside it, so it goes far left.
     *
     * The composer keeps the offset until its first result takes over the UI.
     */
    const isComposerVisible = (isInitialComposer || isCompactCreation) && !isSceneEditorOpen;
    const isBrowsingFeed = creationStage === 'feed_browsing';
    const holdMenuOffset = isComposerVisible || isBrowsingFeed;
    const relationshipOverlayOpen = relationshipListType === 'followers' || relationshipListType === 'following';
    const dockBesideOpenMenu = !compactViewport && isMenuOpen && relationshipOverlayOpen;

    // Mobile: when MenuOpenb is true, concierge moves to the right side and minimises
    const mobileMenuOpenbActive = compactViewport && MenuOpenb;

    // PC: when isMenuOpen is true or MenuOpenb is true, concierge shifts into the body area
    const shouldShiftIntoContent = !compactViewport && (
        (isMenuOpen && holdMenuOffset && !creationSelectionDialogOpen) ||
        MenuOpenb
    );
    const isDeckBMenuOpen = Boolean(dockHost && !compactViewport && !isMenuOpen && MenuOpenb);
    const isTopCentered = !isNotepadPlacement && !minimisePrompt && isComposerVisible && !creationSelectionDialogOpen;
    const anchorLeft = isTopCentered
        ? mobileMenuOpenbActive ? 'auto' : '50%'
        : mobileMenuOpenbActive
            ? 'auto'
            : dockBesideOpenMenu
                ? 20
                : shouldShiftIntoContent
                    ? (MenuOpenb ? 'calc(18vw + 24px)' : 'calc(20vw + 20px)')
                    : compactViewport && !creationTop ? 10 : 20;
    const anchorRight = mobileMenuOpenbActive ? 12 : 'auto';
    const anchorBottom = isTopCentered ? 'auto' : '20vh';
    const topCenteredStyles = isTopCentered
        ? {
            top: creationTop && compactViewport
                ? 'calc(env(safe-area-inset-top, 0px) + 82px)'
                : 'calc(env(safe-area-inset-top, 0px) + 12px)',
            translate: mobileMenuOpenbActive ? 'none' : '-50% 0',
            // Match App.css's content area beside the desktop menu.
            ...(!compactViewport && isMenuOpen ? {
                '@media (min-width: 769px) and (max-width: 1024px)': { left: '65%' },
                '@media (min-width: 1025px)': { left: '60%' },
            } : {}),
        }
        : {};
    const voiceActive = voiceMode;
    const automaticGuideRunning = Object.values(automaticGuide.calls).some(call => call.status === 'running');
    const chatResponseStreaming = chatHistory.some(message => message.role === 'ai' && message.streaming);
    const voiceActivityActive = status === 'connecting' || status === 'thinking' || status === 'speaking';
    const guideActivityActive = guideEnabled && (
        automaticReviewActive || askBusy || automaticGuideRunning || chatResponseStreaming || voiceActivityActive
    );
    const isCompact = !isNotepadPlacement && guidePanelState === 'compact';
    useEffect(() => {
        if (creationTop && !(compactViewport && MenuOpenb)) setGuidePanelState('normal');
    }, [creationTop, compactViewport, MenuOpenb, setGuidePanelState]);
    const glowLevel = Math.max(0.18, Math.min(1, level || 0.18));
    const panelBackground = darkMode ? 'rgba(19,20,25,0.94)' : 'rgba(255,255,255,0.95)';
    const panelColor = darkMode ? '#ffffff' : '#15171c';
    const panelBorder = darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.13)';
    useEffect(() => {
        if (isNotepadPlacement || dockHost) return undefined;

        // First-load welcome: keep Guide Mode on and minimise its panel after
        // ten seconds. Route-level creation state is not a reliable signal for
        // whether the floating prompt is visibly minimised, so this timer must
        // never turn Guide Mode off.
        initialAutoOffTimerRef.current = window.setTimeout(() => {
            initialAutoOffTimerRef.current = null;
            if (!userInteractedRef.current) {
                setTextPinnedOpen(false);
                setTextBody('reply');

                setGuidePanelState('compact');
            }
        }, 180000); // 3 minutes

        return () => {
            if (initialAutoOffTimerRef.current !== null) {
                window.clearTimeout(initialAutoOffTimerRef.current);
                initialAutoOffTimerRef.current = null;
            }
        };
    }, [isNotepadPlacement, dockHost, setGuidePanelState]);

    const wasMinimisedByMenuBRef = useRef(false);

    useEffect(() => {
        if (dockHost && !(compactViewport && MenuOpenb)) {
            setGuidePanelState('normal');
        }
    }, [dockHost, compactViewport, MenuOpenb, setGuidePanelState]);

    useEffect(() => {
        if (compactViewport && MenuOpenb) {
            if (guidePanelState !== 'compact') {
                wasMinimisedByMenuBRef.current = true;
                setTextPinnedOpen(false);
                setTextBody('reply');

                setGuidePanelState('compact');
            }
        } else if (compactViewport && !MenuOpenb && wasMinimisedByMenuBRef.current) {
            wasMinimisedByMenuBRef.current = false;
            setGuidePanelState('normal');
        }
    }, [compactViewport, MenuOpenb, guidePanelState, setGuidePanelState]);

    const guideTooltipSlotProps = {
        popper: { sx: { zIndex: 2147483647 } },
    } as const;
    const roundIconButtonSx = {
        color: 'inherit',
        width: 34,
        height: 34,
        minWidth: 34,
        minHeight: 34,
        maxWidth: 34,
        maxHeight: 34,
        aspectRatio: '1 / 1',
        boxSizing: 'border-box',
        p: 0,
        borderRadius: '50%',
        border: '1px solid rgba(127,127,127,0.30)',
        background: 'rgba(127,127,127,0.12)',
        outline: 'none',
        '&:focus, &:focus-visible': { outline: 'none' },
        '&::before, &::after': { content: 'none', display: 'none' },
    } as const;
    const dormantButtonSize = isNotepadPlacement ? 56 : 30;
    const dormantIconSize = isNotepadPlacement ? 30 : 17;
    // The OFF-state power button only: match the dev timer button's footprint
    // (23px button / 13px icon) so it sits unobtrusively on mobile and desktop.
    const powerButtonSize = isNotepadPlacement ? 56 : 23;
    const powerIconSize = isNotepadPlacement ? 30 : 13;
    const guideActivityIndicator = guideActivityActive ? (
        <Box
            component="span"
            aria-hidden="true"
            sx={{
                position: 'absolute',
                inset: 1,
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 2,
                background: `conic-gradient(from 15deg, transparent 0deg, ${appColor}20 72deg, ${appColor} 205deg, rgba(255,255,255,0.98) 272deg, ${appColor} 315deg, transparent 360deg)`,
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
                filter: `brightness(1.2) drop-shadow(0 0 4px ${appColor})`,
                animation: 'guideActivityOrbit 0.82s linear infinite',
                '@keyframes guideActivityOrbit': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                },
            }}
        />
    ) : null;


    const latestAiMessage = useMemo(() => {
        for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
            const message = chatHistory[index];
            if (message.role === 'ai' && message.content?.trim() && !message.streaming) return message;
        }
        return null;
    }, [chatHistory]);

    const latestAiReply = latestAiMessage?.content.trim() || '';
    const currentTurnAiMessage = useMemo(() => {
        for (let index = chatHistory.length - 1; index >= 0; index -= 1) {
            const message = chatHistory[index];
            if (message.role === 'user') return null;
            if (message.role === 'ai') return message;
        }
        return null;
    }, [chatHistory]);
    const currentTurnAiText = currentTurnAiMessage?.content?.replace(/\s+/g, ' ').trim() || '';
    const displayedText = askBusy
        ? 'Guide is thinking...'
        : askError
            ? askError
            : latestAiReply || 'I am ready to guide you through ClikB.';
    const hasUsableReply = Boolean(latestAiMessage && latestAiReply && !askBusy);
    const responseWasUsed = Boolean(latestAiMessage && usedMessageId === latestAiMessage.id);
    const compactResponseSource = displayedText.replace(/\s+/g, ' ').trim();
    const previewCharacterLimit = compactViewport ? 42 : 72;
    const isLongResponse = compactResponseSource.length > previewCharacterLimit || displayedText.split('\n').length > 2;
    const responseTextExpanded = responseExpanded;
    const notepadCardExpanded = isNotepadPlacement && responseExpanded;
    const visibleResponseText = isLongResponse && !responseTextExpanded
        ? `${compactResponseSource.slice(0, previewCharacterLimit).trimEnd()}\u2026`
        : displayedText;
    useEffect(() => {
        const messageId = latestAiMessage?.id;
        if (!messageId || observedReplyIdRef.current === messageId) return;
        observedReplyIdRef.current = messageId;
        setUsedMessageId(null);
        // A reply may arrive during an automatic continuation while the user is
        // composing. Leave the mounted textarea, draft, caret and focus alone.
        if (textBody === 'write') {
            setUnreadReplyId(messageId);
            return;
        }
        setTextPinnedOpen(false);
        setTextBody('reply');

        setGuidePanelState('normal');
    }, [latestAiMessage?.id, textBody, setGuidePanelState]);

    useEffect(() => {
        if (textBody === 'reply' && guideEnabled && !isChatOpen && !pixelsOverlayOpen &&
            (!isGuideInlineHostActive || isNotepadPlacement) && !isCompact && !voiceActive) {
            setUnreadReplyId(null);
        }
    }, [textBody, guideEnabled, isChatOpen, pixelsOverlayOpen, isGuideInlineHostActive, isNotepadPlacement, isCompact, voiceActive]);

    useEffect(() => {
        if (!guideEnabled || isChatOpen) {
            stop();
            setVoiceMode(false);
            setGuidePlayMode(false);
        }
    }, [guideEnabled, isChatOpen, setGuidePlayMode, stop]);


    const voiceStatusText = useMemo(() => {
        if (status === 'connecting') return 'Preparing voice';
        if (status === 'listening') return 'Listening';
        if (status === 'thinking') return 'Guide is thinking';
        if (status === 'speaking') return 'Guide is speaking';
        if (status === 'error') return error || 'Voice needs attention';
        return 'Voice ready';
    }, [error, status]);
    const voiceHasLiveText = Boolean(
        currentTurnAiText && (currentTurnAiMessage?.streaming || status === 'speaking'),
    );
    const voiceDisplayText = voiceHasLiveText ? currentTurnAiText : voiceStatusText;

    useEffect(() => {
        const textNode = voiceTextScrollRef.current;
        if (!textNode) return;
        textNode.scrollLeft = 0;
    }, [voiceDisplayText]);

    const enterVoiceMode = useCallback(() => {
        cancelAutoOffTimer();
        setAskError(null);
        setTextPinnedOpen(false);
        if (guidePanelState === 'normal' || guidePanelState === 'compact') {
            textPanelBeforeVoiceRef.current = guidePanelState;
        }
        if (guidePlayMode) {
            setGuidePlayMode(false);
            stopSpeech();
        }
        setHiddenReturnMode('voice');
        setTextBody('reply');

        setVoiceMode(true);
        if (guidePlayMode || status === 'idle' || status === 'error') void start();
    }, [cancelAutoOffTimer, guidePanelState, guidePlayMode, setGuidePlayMode, start, status, stopSpeech]);

    const returnToTextMode = useCallback(() => {
        cancelAutoOffTimer();
        stop();
        setVoiceMode(false);
        setHiddenReturnMode('text');
        setTextBody('reply');

        setTextPinnedOpen(true);
        setGuidePanelState('normal');
    }, [cancelAutoOffTimer, setGuidePanelState, stop]);

    const collapseVoiceMode = useCallback(() => {
        cancelAutoOffTimer();
        stop();
        setVoiceMode(false);
        setHiddenReturnMode('voice');
        setGuideEnabled(false);
        setGuidePanelState('hidden');
    }, [cancelAutoOffTimer, setGuideEnabled, setGuidePanelState, stop]);

    const handleCircleClick = useCallback(() => {
        cancelAutoOffTimer();
        if (voiceMode) {
            collapseVoiceMode();
            return;
        }
        if (isNotepadPlacement) {
            setTextPinnedOpen(false);
            setHiddenReturnMode('text');
            textPanelBeforeVoiceRef.current = 'normal';
            setGuideEnabled(false);
            setGuidePanelState('hidden');
            return;
        }
        if (guidePanelState !== 'compact') {
            setTextPinnedOpen(false);
            setTextBody('reply');

            setGuidePanelState('compact');
            return;
        }
        setTextPinnedOpen(false);
        setHiddenReturnMode('text');
        textPanelBeforeVoiceRef.current = 'normal';
        setGuideEnabled(false);
        setGuidePanelState('hidden');
    }, [cancelAutoOffTimer, collapseVoiceMode, guidePanelState, isNotepadPlacement, setGuideEnabled, setGuidePanelState, voiceMode]);

    const handleHiddenExpand = useCallback(() => {
        cancelAutoOffTimer();
        if (hiddenReturnMode === 'voice') {
            setGuidePanelState(textPanelBeforeVoiceRef.current);
            setVoiceMode(true);
            if (status === 'idle' || status === 'error') void start();
            return;
        }
        setVoiceMode(false);
        setTextBody('reply');

        setTextPinnedOpen(true);
        setGuidePanelState('normal');
    }, [cancelAutoOffTimer, hiddenReturnMode, setGuidePanelState, start, status]);


    const handleSendDraft = useCallback(async () => {
        cancelAutoOffTimer();
        const question = draft.trim();
        if (!question) return;
        const runId = ++activeAskRunRef.current;
        const submittedRevision = draftRevisionRef.current; setDraft('');
        setAskBusy(true);
        setAskError(null);
        setTextBody('reply');

        try {
            if (voiceMode || guidePlayMode) {
                await askTextWithVoice(question);
            } else {
                await textAsk(question);
            }
            // The user can reopen the writer and compose the next message while
            // this request finishes. Clear only the draft that was submitted.
            if (draftRevisionRef.current === submittedRevision) setDraft('');
        } catch (requestError) {
            if (activeAskRunRef.current === runId && draftRevisionRef.current === submittedRevision) setDraft(question); console.error('Guide text ask failed:', requestError);
            if (activeAskRunRef.current === runId) setAskError('Guide could not connect. Tap the pencil to try again.');
        } finally {
            if (activeAskRunRef.current === runId) setAskBusy(false);
        }
    }, [askBusy, askTextWithVoice, cancelAutoOffTimer, draft, guidePlayMode, voiceMode, textAsk]);

    const handleUse = useCallback(() => {
        cancelAutoOffTimer();
        if (!latestAiMessage || !hasUsableReply) return;
        if (appendGuideTextToTarget(latestAiMessage.content)) {
            setUsedMessageId(latestAiMessage.id);
        }
    }, [appendGuideTextToTarget, cancelAutoOffTimer, hasUsableReply, latestAiMessage]);

    const handlePlay = useCallback(() => {
        cancelAutoOffTimer();
        if (guidePlayMode) {
            setGuidePlayMode(false);
            stopSpeech();
            return;
        }
        const spokenText = latestAiReply || (dockHost ? 'I am ready to guide you through ClikB.' : '');
        if (!spokenText) return;
        setGuidePlayMode(true);
        void speakText(spokenText);
    }, [cancelAutoOffTimer, guidePlayMode, latestAiReply, dockHost, setGuidePlayMode, speakText, stopSpeech]);

    const openWriter = useCallback(() => {
        cancelAutoOffTimer();
        setAskError(null);
        setTextPinnedOpen(true);
        setGuidePanelState('normal');
        setTextBody('write');
    }, [cancelAutoOffTimer, setGuidePanelState]);

    const circleActionLabel = voiceActive
        ? 'Close Guide voice'
        : isCompact
            ? 'Close Guide text'
            : 'Minimise Guide text';

    useEffect(() => {
        if (!isNotepadPlacement) return undefined;
        return registerGuideInlineHost();
    }, [isNotepadPlacement, registerGuideInlineHost]);

    const isTemplateGalleryMounted = isTemplatesAreaActive || Boolean(typeof document !== "undefined" && document.querySelector('[data-template-gallery="true"]'));
    if (!isNotepadPlacement && isGuideInlineHostActive && !isTemplateGalleryMounted) return null;
    if (isNotepadPlacement && isTemplateGalleryMounted) return null;

    if (isChatOpen || pixelsOverlayOpen) return null;

    if (!guideEnabled) {
        return dock(
            <Tooltip slotProps={guideTooltipSlotProps} title="Turn Guide Mode on">
                <Box
                    component="button"
                    type="button"
                    data-ai-snapshot-ignore="true"
                    data-guide-ui="true"
                    aria-label="Turn Guide Mode on"
                    onClick={() => {
                        cancelAutoOffTimer();
                        setTextModeAnimal(pickTextModeAnimal());
                        setTextPinnedOpen(false);
                        setGuideEnabled(true);
                        setGuidePanelState('normal');
                    }}
                    sx={{
                        position: isNotepadPlacement ? 'relative' : 'fixed',
                        left: isNotepadPlacement ? 'auto' : anchorLeft,
                        right: isNotepadPlacement ? 'auto' : anchorRight,
                        bottom: isNotepadPlacement ? 'auto' : anchorBottom,
                        ...topCenteredStyles,
                        ...dockStyles,
                        zIndex: isNotepadPlacement ? 1 : 2147483600,
                        width: powerButtonSize,
                        height: powerButtonSize,
                        minWidth: powerButtonSize,
                        minHeight: powerButtonSize,
                        maxWidth: powerButtonSize,
                        maxHeight: powerButtonSize,
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box',
                        padding: 0,
                        margin: isNotepadPlacement ? '8px auto' : 0,
                        overflow: 'hidden',
                        appearance: 'none',
                        outline: 'none',
                        flex: isNotepadPlacement ? '0 0 56px' : `0 0 ${powerButtonSize}px`,
                        borderRadius: '50%',
                        '&:focus, &:focus-visible': { outline: 'none' },
                        '&::before, &::after': { content: 'none', display: 'none' },
                        border: isNotepadPlacement ? `2px solid ${appColor}` : `1px solid ${panelBorder}`,
                        background: panelBackground,
                        color: appColor,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        boxShadow: `0 5px 18px ${appColor}40`,
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    {isNotepadPlacement
                        ? <Box component="span" aria-hidden="true" sx={{ fontSize: 30, lineHeight: 1 }}>{textModeAnimal}</Box>
                        : <PowerSettingsNewRoundedIcon sx={{ fontSize: powerIconSize }} />}
                </Box>
            </Tooltip>
        );
    }

    if (guidePanelState === 'hidden' && !voiceActive) {
        return dock(
            <Tooltip slotProps={guideTooltipSlotProps} title="Open Guide Mode">
                <Box
                    component="button"
                    type="button"
                    data-ai-snapshot-ignore="true"
                    data-guide-ui="true"
                    aria-label="Open Guide Mode"
                    aria-busy={guideActivityActive || undefined}
                    onClick={handleHiddenExpand}
                    sx={{
                        position: isNotepadPlacement ? 'relative' : 'fixed',
                        left: isNotepadPlacement ? 'auto' : anchorLeft,
                        right: isNotepadPlacement ? 'auto' : anchorRight,
                        bottom: isNotepadPlacement ? 'auto' : anchorBottom,
                        ...topCenteredStyles,
                        ...dockStyles,
                        zIndex: isNotepadPlacement ? 1 : 2147483600,
                        width: dormantButtonSize,
                        height: dormantButtonSize,
                        minWidth: dormantButtonSize,
                        minHeight: dormantButtonSize,
                        maxWidth: dormantButtonSize,
                        maxHeight: dormantButtonSize,
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box',
                        padding: 0,
                        margin: isNotepadPlacement ? '8px auto' : 0,
                        overflow: 'hidden',
                        appearance: 'none',
                        outline: 'none',
                        flex: isNotepadPlacement ? '0 0 56px' : '0 0 30px',
                        borderRadius: '50%',
                        '&:focus, &:focus-visible': { outline: 'none' },
                        '&::before, &::after': { content: 'none', display: 'none' },
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.14)'}`,
                        background: panelBackground,
                        color: appColor,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        opacity: 0.86,
                        boxShadow: guideActivityActive ? `0 0 10px ${appColor}62, 0 0 24px ${appColor}82` : `0 0 14px ${appColor}70`,
                        transition: 'transform 160ms ease, opacity 160ms ease',
                        '&:hover, &:focus-visible': { transform: 'scale(1.1)', opacity: 1 },
                    }}
                >
                    {guideActivityIndicator}
                    <PowerSettingsNewRoundedIcon sx={{ position: 'relative', zIndex: 1, fontSize: isNotepadPlacement ? 31 : 18 }} />
                </Box>
            </Tooltip>
        );
    }

    const circleHost = dockHost && !compactViewport && !isDeckBMenuOpen
        ? dockHost.closest('.deck-dock')?.querySelector<HTMLElement>('[data-deck-circle-host]') : null;
    const circle = (
            <Tooltip slotProps={guideTooltipSlotProps} title={circleActionLabel}>
                <Box
                    data-guide-circle="true"
                    component="button"
                    type="button"
                    aria-label={circleActionLabel}
                    aria-busy={guideActivityActive || undefined}
                    onClick={handleCircleClick}
                    sx={{
                        pointerEvents: 'auto',
                        flex: { xs: '0 0 58px', sm: '0 0 64px' },
                        width: { xs: 58, sm: 64 },
                        height: { xs: 58, sm: 64 },
                        minWidth: { xs: 58, sm: 64 },
                        minHeight: { xs: 58, sm: 64 },
                        maxWidth: { xs: 58, sm: 64 },
                        maxHeight: { xs: 58, sm: 64 },
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box',
                        padding: 0,
                        margin: 0,
                        overflow: 'hidden',
                        appearance: 'none',
                        outline: 'none',
                        borderRadius: '50%',
                        border: `2px solid ${appColor}`,
                        background: darkMode ? 'rgba(11,12,16,0.78)' : 'rgba(255,255,255,0.90)',
                        color: appColor,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: guideActivityActive
                            ? `0 0 10px ${appColor}68, 0 0 26px ${appColor}88`
                            : voiceActive
                                ? `0 0 ${18 + glowLevel * 28}px ${appColor}78`
                                : `0 0 15px ${appColor}48`,
                        backdropFilter: 'blur(10px)',
                        animation: voiceActive && !isNotepadPlacement ? 'guideVoicePulse 1.05s ease-in-out infinite' : 'none',
                        '&:focus, &:focus-visible': { outline: 'none' },
                        '&::before, &::after': { content: 'none', display: 'none' },
                        '@keyframes guideVoicePulse': {
                            '0%, 100%': { transform: 'scale(1)' },
                            '50%': { transform: 'scale(1.045)' },
                        },
                    }}
                >
                    {guideActivityIndicator}
                    <Box
                        component="span"
                        aria-hidden="true"
                        sx={{ position: 'absolute', inset: 0, zIndex: 1, display: 'grid', placeItems: 'center', lineHeight: 1, fontSize: { xs: 27, sm: 30 } }}
                    >
                        {textModeAnimal}
                    </Box>
                </Box>
            </Tooltip>
    );

    const dockContent = dock(
        <Box
            data-ai-snapshot-ignore="true"
            data-guide-ui="true"
            sx={{
                position: isNotepadPlacement ? 'relative' : 'fixed',
                left: isNotepadPlacement ? 'auto' : anchorLeft,
                right: isNotepadPlacement ? 'auto' : anchorRight,
                bottom: isNotepadPlacement || isTopCentered ? 'auto' : (compactViewport && textBody === 'write' ? '46vh' : anchorBottom),
                ...topCenteredStyles,
                ...dockStyles,
                zIndex: isNotepadPlacement ? 1 : 2147483600,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: mobileMenuOpenbActive ? 'row-reverse' : 'row',
                transition: isNotepadPlacement ? 'none' : 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1), right 0.28s cubic-bezier(0.4, 0, 0.2, 1), bottom 220ms ease',
                gap: { xs: 0.8, sm: 1 },
                width: isDeckBMenuOpen ? 'auto' : (dockHost || isNotepadPlacement ? '100%' : 'auto'),
                maxWidth: isNotepadPlacement ? '100%' : 'calc(100vw - 18px)',
                boxSizing: 'border-box',
                px: isNotepadPlacement ? { xs: 1.25, sm: 2 } : 0,
                pt: isNotepadPlacement ? 0.75 : 0,
                pb: isNotepadPlacement ? 0.75 : 0,
                flexShrink: 0,
                minHeight: isNotepadPlacement ? { xs: 116, sm: 132 } : undefined,
                contain: isNotepadPlacement ? 'layout paint' : undefined,
                ...dockStyles,
            }}
        >
            {circleHost ? createPortal(circle, circleHost) : circle}

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, pointerEvents: 'none', flex: '0 0 auto', minWidth: 0, maxWidth: isDeckBMenuOpen ? 'calc(100vw - 160px)' : dockHost ? 'calc(100% - 48px)' : undefined, width: isNotepadPlacement ? (notepadCardExpanded ? 'min(calc(100% - 80px), 1040px)' : 'min(calc(100% - 80px), 520px)') : 'auto' }}>
            {voiceActive && textBody !== 'write' ? (
                <Box
                    sx={{
                        pointerEvents: 'auto',
                        width: voiceHasLiveText
                            ? { xs: 'min(72vw, 520px)', sm: 'min(66vw, 760px)' }
                            : 'auto',
                        maxWidth: dockHost ? '100%' : isNotepadPlacement ? 'calc(100% - 80px)' : 'calc(100vw - 92px)',
                        minWidth: dockHost ? 0 : voiceHasLiveText ? { xs: 220, sm: 300 } : 0,
                        height: 48,
                        boxSizing: 'border-box',
                        pl: 1.75,
                        pr: 0.75,
                        gap: 0.75,
                        py: 0,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        background: panelBackground,
                        color: status === 'error' ? '#ff7777' : panelColor,
                        border: `1px solid ${status === 'error' ? 'rgba(255,95,95,0.42)' : panelBorder}`,
                        boxShadow: darkMode ? '0 12px 30px rgba(0,0,0,0.38)' : '0 12px 30px rgba(0,0,0,0.22)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        fontSize: 15,
                        fontWeight: 800,
                        lineHeight: 1.35,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                        overflow: 'hidden',
                        transition: isNotepadPlacement ? 'none' : 'width 180ms ease, border-color 160ms ease, transform 160ms ease',
                        '&:focus, &:focus-visible': { outline: 'none' },
                        '&::before, &::after': { content: 'none', display: 'none' },
                        '&:hover': isNotepadPlacement ? { borderColor: appColor } : { borderColor: appColor, transform: 'translateY(-1px)' },
                    }}
                >
                    <Box
                        ref={voiceTextScrollRef}
                        component="button"
                        type="button"
                        aria-label={`${voiceDisplayText}. Return to Guide text`}
                        onClick={returnToTextMode}
                        sx={{
                            minWidth: 0,
                            flex: 1,
                            border: 0,
                            p: 0,
                            background: 'transparent',
                            color: 'inherit',
                            font: 'inherit',
                            cursor: 'pointer',
                            display: 'block',
                            width: '100%',
                            overflowX: 'hidden',
                            overflowY: 'hidden',
                            whiteSpace: 'nowrap',
                            textAlign: 'left',
                            scrollbarWidth: 'none',
                            '&::-webkit-scrollbar': { display: 'none' },
                        }}
                    >
                        {voiceDisplayText}
                    </Box>
                    <Tooltip slotProps={guideTooltipSlotProps} title="Type a message">
                        <IconButton
                            aria-label="Type a message in voice mode"
                            onClick={() => {
                                cancelAutoOffTimer();
                                setAskError(null);
                                setTextBody('write');
                            }}
                            sx={{ ...roundIconButtonSx, color: appColor }}
                        >
                            <EditRoundedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            ) : isCompact && !voiceActive ? (
                <Tooltip slotProps={guideTooltipSlotProps} title={displayedText}>
                    <Box
                        component="button"
                        type="button"
                        aria-label="Expand Guide text"
                        onClick={() => {
                            setTextBody('reply');

                            setTextPinnedOpen(true);
                            setGuidePanelState('normal');
                        }}
                        sx={{
                            pointerEvents: 'auto',
                            width: { xs: 52, sm: 56 },
                            height: 34,
                            minWidth: { xs: 52, sm: 56 },
                            minHeight: 34,
                            maxWidth: { xs: 52, sm: 56 },
                            maxHeight: 34,
                            boxSizing: 'border-box',
                            px: 0.75,
                            py: 0,
                            m: 0,
                            borderRadius: '11px',
                            border: `1px solid ${panelBorder}`,
                            background: panelBackground,
                            color: panelColor,
                            display: 'block',
                            cursor: 'pointer',
                            appearance: 'none',
                            outline: 'none',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            fontSize: 10.5,
                            fontWeight: 650,
                            lineHeight: '32px',
                            boxShadow: `inset 3px 0 0 ${appColor}, 0 7px 20px rgba(0,0,0,0.24)`,
                            backdropFilter: 'blur(14px)',
                            transition: 'width 160ms ease, box-shadow 160ms ease',
                            '&:hover': { width: { xs: 68, sm: 76 }, boxShadow: `inset 3px 0 0 ${appColor}, 0 9px 26px ${appColor}38` },
                            '&:focus, &:focus-visible': { outline: 'none' },
                            '&::before, &::after': { content: 'none', display: 'none' },
                        }}
                    >
                        {displayedText}
                    </Box>
                </Tooltip>
            ) : (
                <Box
                    role="dialog"
                    aria-label="ClikB Guide Mode"
                    onDoubleClick={(event: React.MouseEvent<HTMLDivElement>) => {
                        const target = event.target as HTMLElement;
                        if (target.closest('button, textarea, input')) return;
                        if (isNotepadPlacement) return;
                        dispatch(setConciergeResponseExpanded(false));
                        setTextPinnedOpen(false);
                        setTextBody('reply');

                        setGuidePanelState('compact');
                    }}
                    sx={{
                        pointerEvents: 'auto',
                        width: isNotepadPlacement
                            ? '100%'
                            : responseTextExpanded
                                ? { xs: 'min(calc(100vw - 104px), 560px)', sm: 560 }
                                : { xs: 'min(calc(100vw - 104px), 360px)', sm: 360 },
                        minHeight: isNotepadPlacement ? (autoControlVisible ? { xs: 140, sm: 152 } : { xs: 108, sm: 124 }) : undefined,
                        maxHeight: responseTextExpanded ? (isNotepadPlacement ? (autoControlVisible ? 220 : 172) : 'min(68vh, 560px)') : 'none',
                        flex: isNotepadPlacement ? '0 1 auto' : undefined,
                        minWidth: 0,
                        maxWidth: dockHost ? '100%' : undefined,
                        borderRadius: '24px',
                        overflow: 'hidden',
                        background: panelBackground,
                        color: panelColor,
                        border: `1px solid ${panelBorder}`,
                        boxShadow: darkMode ? '0 12px 30px rgba(0,0,0,0.38)' : '0 12px 30px rgba(0,0,0,0.22)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        transition: isNotepadPlacement ? 'none' : 'width 180ms ease',
                    }}
                >
                    {voiceActive ? (
                        <Box role="status" aria-live="polite" sx={{ px: 2, pt: 1.25, fontSize: 12, fontWeight: 650, color: status === 'error' ? '#ff7777' : panelColor }}>
                            {voice.captureAvailable ? 'Listening' : 'Microphone off'}{voice.inputPending || voice.inputReceipt ? ' · Received' : ''}{status !== 'listening' ? ` · ${voiceStatusText}` : ''}
                        </Box>
                    ) : null}
                    {textBody === 'write' && (!isCompact || voiceActive) ? (
                        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0.6, p: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 0.25, flexWrap: 'wrap' }}>
                                <Tooltip slotProps={guideTooltipSlotProps} title={`Voice: ${selectedVoiceMeta?.label || selectedVoice}`}>
                                    <Button
                                        size="small"
                                        aria-label={`Select Concierge voice. Current voice: ${selectedVoiceMeta?.label || selectedVoice}`}
                                        startIcon={<RecordVoiceOverRoundedIcon sx={{ fontSize: "13px !important" }} />}
                                        onClick={() => {
                                            cancelAutoOffTimer();
                                            setShowVoiceModal(true);
                                        }}
                                        sx={{
                                            minWidth: 0, height: 20, minHeight: 20, py: 0, px: 0.8,
                                            borderRadius: 999, border: `1px solid ${panelBorder}`,
                                            background: panelBackground, color: panelColor,
                                            fontSize: 10.5, fontWeight: 750, lineHeight: 1.5,
                                            textTransform: "none", whiteSpace: "nowrap",
                                            "& .MuiButton-startIcon": { mr: 0.4, ml: 0 },
                                            "&:hover": { background: panelBackground, borderColor: appColor },
                                        }}
                                    >
                                        {selectedVoiceMeta?.label ? selectedVoiceMeta.label.split(" ")[0] : "Voice"}
                                    </Button>
                                </Tooltip>
                                <Tooltip slotProps={guideTooltipSlotProps} title={`Conversation AI: ${selectedModelMeta?.name || conversationModel}`}>
                                    <Button
                                        size="small"
                                        aria-label={`Select conversation model. Current model: ${selectedModelMeta?.name || conversationModel}`}
                                        startIcon={<SmartToyRoundedIcon sx={{ fontSize: "13px !important" }} />}
                                        onClick={() => {
                                            cancelAutoOffTimer();
                                            setShowModelModal(true);
                                        }}
                                        sx={{
                                            minWidth: 0, height: 20, minHeight: 20, py: 0, px: 0.8,
                                            borderRadius: 999, border: `1px solid ${panelBorder}`,
                                            background: panelBackground, color: panelColor,
                                            fontSize: 10.5, fontWeight: 750, lineHeight: 1.5,
                                            textTransform: "none", whiteSpace: "nowrap",
                                            "& .MuiButton-startIcon": { mr: 0.4, ml: 0 },
                                            "&:hover": { background: panelBackground, borderColor: appColor },
                                        }}
                                    >
                                        {selectedModelMeta?.name ? selectedModelMeta.name.split(" ")[0] : "Model"}
                                    </Button>
                                </Tooltip>
                                {hasDeckProfile && <Tooltip slotProps={guideTooltipSlotProps} title={deckEnabled ? 'Deck On · Turn off' : 'Deck Off · Turn on'}>
                                    <Button
                                        size="small" aria-pressed={deckEnabled} disabled={deckSaving}
                                        aria-label={deckEnabled ? 'Deck on. Turn Deck off' : 'Deck off. Turn Deck on'}
                                        startIcon={<ViewCarouselOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                                        onClick={async () => {
                                            cancelAutoOffTimer();
                                            setDeckSaving(true);
                                            setDeckSaveError(false);
                                            try {
                                                await saveDeckPreference(store, clikUrl ?? import.meta.env.VITE_CLIK_URL, !deckEnabled);
                                            } catch {
                                                setDeckSaveError(true);
                                            } finally {
                                                setDeckSaving(false);
                                            }
                                        }}
                                        sx={{
                                            minWidth: 0, height: 20, minHeight: 20, py: 0, px: 0.8,
                                            borderRadius: 999, border: `1px solid ${deckEnabled ? appColor : panelBorder}`,
                                            background: deckEnabled ? appColor : panelBackground,
                                            color: deckEnabled ? appAccentForeground(darkMode) : panelColor,
                                            fontSize: 10.5, fontWeight: 750, lineHeight: 1.5,
                                            textTransform: 'none', whiteSpace: 'nowrap',
                                            '& .MuiButton-startIcon': { mr: 0.4, ml: 0 },
                                            '&:hover': { background: deckEnabled ? appColor : panelBackground, borderColor: appColor },
                                        }}
                                    >
                                        Deck
                                    </Button>
                                </Tooltip>}
                                {unreadReplyId ? (
                                    <Button
                                        size="small"
                                        aria-label="New reply from Guide. Open latest reply"
                                        startIcon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: '13px !important' }} />}
                                        onClick={() => {
                                            cancelAutoOffTimer();
                                            setUnreadReplyId(null);
                                            setTextBody('reply');

                                            setGuidePanelState('normal');
                                        }}
                                        sx={{
                                            minWidth: 0, height: 20, minHeight: 20, py: 0, px: 0.8,
                                            borderRadius: 999, border: `1px solid ${panelBorder}`,
                                            background: panelBackground, color: panelColor,
                                            fontSize: 10.5, fontWeight: 750, lineHeight: 1.5,
                                            textTransform: 'none', whiteSpace: 'nowrap',
                                            '& .MuiButton-startIcon': { mr: 0.4, ml: 0 },
                                            '&:hover': { background: panelBackground, borderColor: appColor },
                                        }}
                                    >
                                        New reply
                                    </Button>
                                ) : null}
                            </Box>
                            {deckSaveError && <Typography role="alert" sx={{ px: 0.25, fontSize: 11, color: panelColor }}>
                                Deck preference could not be saved. Try again.
                            </Typography>}
                            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.6 }}>
                                <Box
                                    component="textarea"
                                    autoFocus
                                    aria-label="Message to Guide"
                                    value={draft}
                                    placeholder="Ask Guide..."
                                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                                        draftRevisionRef.current++;
                                        setDraft(event.target.value);
                                    }}
                                    onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setTextBody('reply');

                                            return;
                                        }
                                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                            event.preventDefault();
                                            void handleSendDraft();
                                        }
                                    }}
                                    sx={{
                                        flex: 1,
                                        resize: 'none',
                                        minHeight: 64,
                                        borderRadius: '9px',
                                        border: `1px solid ${panelBorder}`,
                                        background: 'transparent',
                                        color: panelColor,
                                        fontFamily: 'inherit',
                                        fontSize: { xs: 16, sm: 13 },
                                        lineHeight: 1.45,
                                        p: 1,
                                        outline: 'none',
                                        caretColor: 'auto !important',
                                        '&::placeholder': { color: panelColor, opacity: 0.52 },
                                    }}
                                />
                                <Box sx={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.65 }}>
                                    <Tooltip slotProps={guideTooltipSlotProps} title="Close input">
                                        <IconButton
                                            size="small"
                                            aria-label="Close Guide input"
                                            onClick={() => setTextBody('reply')}
                                            sx={{ ...roundIconButtonSx, color: appColor, background: panelBackground }}
                                        >
                                            <CloseRoundedIcon sx={{ fontSize: 21 }} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip slotProps={guideTooltipSlotProps} title="Send question">
                                        <span>
                                            <IconButton
                                                size="small"
                                                aria-label="Send question"
                                                disabled={!draft.trim()}
                                                onClick={() => void handleSendDraft()}
                                                sx={{ ...roundIconButtonSx, color: appColor, opacity: !draft.trim() ? 0.4 : 1 }}
                                            >
                                                <SendRoundedIcon sx={{ fontSize: 20 }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Box>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ position: 'relative', p: 1 }}>
                            <Box
                                sx={{
                                    px: 1.25,
                                    pt: 1.1,
                                    pb: 1.15,
                                    pr: 6.4,
                                    minHeight: isNotepadPlacement ? (autoControlVisible ? { xs: 120, sm: 132 } : { xs: 88, sm: 100 }) : 84,
                                    maxHeight: 'none',
                                    overflow: isNotepadPlacement ? 'visible' : 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: 0,
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    lineHeight: 1.45,
                                    whiteSpace: 'pre-wrap',
                                }}
                            >
                                <Box sx={{ position: 'relative', width: '100%' }}>
                                    <Box
                                        component="button"
                                        type="button"
                                        role="status"
                                        aria-live="polite"
                                        aria-label={responseExpanded ? 'Contract Guide response' : 'Expand Guide response'}
                                        aria-expanded={responseExpanded}
                                        onClick={() => dispatch(setConciergeResponseExpanded(!responseExpanded))}
                                        sx={responseTextExpanded
                                            ? {
                                                display: 'block',
                                                width: '100%',
                                                maxHeight: isNotepadPlacement ? 92 : dockHost ? 'min(26dvh, 190px)' : 'calc(46vh - 38px)',
                                                overflowY: 'auto',
                                                whiteSpace: 'pre-wrap',
                                                p: 0,
                                                pr: isNotepadPlacement ? 0.35 : 3,
                                                m: 0,
                                                border: 0,
                                                outline: 'none',
                                                boxShadow: 'none',
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                background: 'transparent',
                                                color: 'inherit',
                                                textAlign: 'left',
                                                font: 'inherit',
                                                cursor: isNotepadPlacement ? 'default' : 'zoom-out',
                                                touchAction: 'manipulation',
                                                '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
                                            }
                                            : {
                                                display: '-webkit-box',
                                                width: '100%',
                                                WebkitBoxOrient: 'vertical',
                                                WebkitLineClamp: 3,
                                                overflow: isNotepadPlacement ? 'visible' : 'hidden',
                                                whiteSpace: 'normal',
                                                p: 0,
                                                pr: isNotepadPlacement ? 0 : 3,
                                                m: 0,
                                                border: 0,
                                                outline: 'none',
                                                boxShadow: 'none',
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                background: 'transparent',
                                                color: 'inherit',
                                                textAlign: 'left',
                                                font: 'inherit',
                                                cursor: isNotepadPlacement ? 'default' : 'zoom-in',
                                                touchAction: 'manipulation',
                                                '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
                                            }}
                                    >
                                        {visibleResponseText}
                                    </Box>
                                    {(isLongResponse || responseExpanded) ? (
                                        <Box
                                            component="span"
                                            aria-hidden="true"
                                            sx={{
                                                position: 'absolute',
                                                right: 1,
                                                bottom: 0,
                                                width: 24,
                                                height: 24,
                                                display: 'grid',
                                                placeItems: 'center',
                                                borderRadius: '50%',
                                                color: appColor,
                                                background: panelBackground,
                                                boxShadow: `0 0 0 3px ${panelBackground}`,
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            {responseExpanded
                                                ? <KeyboardArrowUpRoundedIcon sx={{ fontSize: 21 }} />
                                                : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 21 }} />}
                                        </Box>
                                    ) : null}
                                </Box>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.15,
                                        minHeight: 26,
                                        mt: 0.15,
                                        whiteSpace: 'normal',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Tooltip slotProps={guideTooltipSlotProps} title={guidePlayMode ? 'Pause spoken responses' : 'Play responses aloud'}>
                                        <span>
                                            <IconButton
                                                size="small"
                                                aria-label={guidePlayMode ? 'Pause spoken responses' : 'Play responses aloud'}
                                                disabled={!latestAiReply && !guidePlayMode && !dockHost}
                                                {...quickPointerAction(handlePlay)}
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    minWidth: 34,
                                                    minHeight: 34,
                                                    m: '-4px',
                                                    p: '4px',
                                                    color: appColor,
                                                    borderRadius: '50%',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    '&.Mui-disabled': { color: appColor, opacity: 0.72 },
                                                }}
                                            >
                                                {guidePlayMode
                                                    ? <PauseRoundedIcon sx={{ fontSize: 21, color: 'inherit' }} />
                                                    : <PlayArrowRoundedIcon sx={{ fontSize: 21, color: 'inherit' }} />}
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    {hasGuideUseTarget && hasUsableReply ? (
                                        <Button
                                            size="small"
                                            aria-label={`Use response in ${guideUseTargetLabel}`}
                                            {...quickPointerAction(handleUse)}
                                            sx={{
                                                minWidth: 0,
                                                px: 0.55,
                                                py: 0,
                                                color: appColor,
                                                fontSize: 10.5,
                                                fontWeight: 900,
                                                lineHeight: 1.8,
                                                textTransform: 'none',
                                            }}
                                        >
                                            {responseWasUsed ? 'Used' : 'Use'}
                                        </Button>
                                    ) : null}
                                </Box>
                            </Box>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: '50%',
                                    bottom: 12,
                                    transform: 'translateX(-50%)',
                                    zIndex: 2,
                                    display: 'flex',
                                    justifyContent: 'center',
                                }}
                            >
                                <Box sx={{ display: isNotepadPlacement && autoControlVisible ? 'none' : 'block' }}>
                                    <AutoControlRevealButton entry="guide" compact />
                                </Box>
                                {isNotepadPlacement ? <AutoControlPill placement="embedded" small /> : null}
                            </Box>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    right: 16,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.55,
                                }}
                            >
                                <Tooltip slotProps={guideTooltipSlotProps} title="Speak with Guide">
                                    <IconButton
                                        size="small"
                                        aria-label="Speak with Guide"
                                        {...quickPointerAction(enterVoiceMode)}
                                        sx={{ ...roundIconButtonSx, color: appColor, background: panelBackground }}
                                    >
                                        <MicRoundedIcon sx={{ fontSize: 21 }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip slotProps={guideTooltipSlotProps} title="Ask Guide">
                                    <IconButton
                                        size="small"
                                        aria-label="Open Guide input"
                                        {...quickPointerAction(openWriter)}
                                        sx={{ ...roundIconButtonSx, color: appColor, background: panelBackground }}
                                    >
                                        <EditRoundedIcon sx={{ fontSize: 20 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    )}

                </Box>
            )}
            {isPaidConcierge && (voiceActive || guidePlayMode) && voiceCostFloatId > 0 ? (
                <Box
                    key={`voice-cost-float-${voiceCostFloatId}`}
                    data-guide-voice-cost-float="true"
                    aria-hidden="true"
                    sx={{
                        pointerEvents: 'none',
                        px: 1.1,
                        py: 0.25,
                        borderRadius: 999,
                        border: `1px solid ${appColor}`,
                        background: panelBackground,
                        color: appColor,
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: 0.15,
                        whiteSpace: 'nowrap',
                        boxShadow: darkMode ? '0 6px 16px rgba(0,0,0,0.34)' : '0 6px 16px rgba(0,0,0,0.16)',
                        animation: 'clikbVoiceCostFloatAway 2.6s ease-out forwards',
                        '@keyframes clikbVoiceCostFloatAway': {
                            '0%': { opacity: 0, transform: 'translateY(4px) scale(0.96)' },
                            '18%': { opacity: 0.96, transform: 'translateY(0px) scale(1)' },
                            '75%': { opacity: 0.88, transform: 'translateY(-8px) scale(1)' },
                            '100%': { opacity: 0, transform: 'translateY(-18px) scale(0.97)' },
                        },
                    }}
                >
                    Voice active · metered usage
                </Box>
            ) : null}
            {!isNotepadPlacement && !minimisePrompt && !dockHost ? <AutoControlPill placement="embedded" /> : null}
            </Box>
        </Box>
    );

    return (
        <>
            {dockContent}
            {/* Centered Voice Selection Modal */}
            <Modal
                open={showVoiceModal}
                onClose={() => {
                    stopVoicePreview();
                    setShowVoiceModal(false);
                }}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    zIndex: 2147483640,
                }}
            >
                <Box sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 480,
                    maxHeight: '80vh',
                    bgcolor: darkMode ? '#16161a' : '#fff',
                    color: darkMode ? '#fff' : '#111',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: '16px',
                    boxShadow: darkMode ? '0 12px 40px rgba(0,0,0,0.8)' : '0 12px 40px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    outline: 'none',
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.25,
                        py: 1.5,
                        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <RecordVoiceOverRoundedIcon sx={{ color: appColor, fontSize: 20 }} />
                            <Typography sx={{ fontSize: 15, fontWeight: 750 }}>
                                Concierge Voice
                            </Typography>
                        </Box>
                        <IconButton
                            size="small"
                            onClick={() => {
                                stopVoicePreview();
                                setShowVoiceModal(false);
                            }}
                            aria-label="Close voice selection"
                            sx={{ color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Box>
                    <Box sx={{ p: 1.5, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {voiceOptions.map((option) => {
                            const isActive = selectedVoice === option.id;
                            return (
                                <Box
                                    key={option.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={isActive}
                                    onClick={() => {
                                        stopVoicePreview();
                                        dispatch(setBrainstormSelectedVoice(option.id));
                                        setShowVoiceModal(false);
                                    }}
                                    onKeyDown={(event: React.KeyboardEvent) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            stopVoicePreview();
                                            dispatch(setBrainstormSelectedVoice(option.id));
                                            setShowVoiceModal(false);
                                        }
                                    }}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 1.25,
                                        p: 1.2,
                                        borderRadius: "12px",
                                        border: `1.5px solid ${isActive ? appColor : darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                        backgroundColor: isActive
                                            ? (darkMode ? `${appColor}22` : `${appColor}15`)
                                            : (darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                                        cursor: "pointer",
                                        textAlign: "left",
                                        color: "inherit",
                                        outline: "none",
                                        transition: "all 0.15s ease",
                                        "&:hover": {
                                            backgroundColor: isActive
                                                ? (darkMode ? `${appColor}33` : `${appColor}25`)
                                                : (darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                                            borderColor: isActive ? appColor : darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)",
                                        },
                                    }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: darkMode ? "#fff" : "#111" }}>
                                            {option.label}
                                        </Typography>
                                        <Typography sx={{ fontSize: 12.5, opacity: 0.72, mt: 0.35 }}>
                                            {option.gender} · {option.tone}
                                        </Typography>
                                    </Box>
                                    <Box
                                        sx={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: "50%",
                                            border: `2px solid ${isActive ? appColor : darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}`,
                                            backgroundColor: isActive ? appColor : "transparent",
                                            flexShrink: 0,
                                            mr: 0.5,
                                        }}
                                    />
                                    <Tooltip title={previewingVoice === option.id ? "Stop preview" : "Play preview"}>
                                        <IconButton
                                            size="small"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleVoicePreview(option.previewUrl, option.id);
                                            }}
                                            aria-label={`${previewingVoice === option.id ? "Stop" : "Play"} ${option.label} preview`}
                                            disabled={!option.previewUrl}
                                            sx={{
                                                color: isActive ? appColor : (darkMode ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.7)"),
                                                border: `1px solid ${isActive ? appColor : "transparent"}`,
                                            }}
                                        >
                                            {previewingVoice === option.id ? <StopRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Modal>

            {/* Centered Conversation AI Model Modal */}
            <Modal
                open={showModelModal}
                onClose={() => setShowModelModal(false)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    zIndex: 2147483640,
                }}
            >
                <Box sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 480,
                    maxHeight: '80vh',
                    bgcolor: darkMode ? '#16161a' : '#fff',
                    color: darkMode ? '#fff' : '#111',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: '16px',
                    boxShadow: darkMode ? '0 12px 40px rgba(0,0,0,0.8)' : '0 12px 40px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    outline: 'none',
                }}>
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.25,
                        py: 1.5,
                        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SmartToyRoundedIcon sx={{ color: appColor, fontSize: 20 }} />
                            <Typography sx={{ fontSize: 15, fontWeight: 750 }}>
                                Conversation AI
                            </Typography>
                        </Box>
                        <IconButton
                            size="small"
                            onClick={() => setShowModelModal(false)}
                            aria-label="Close conversation AI selection"
                            sx={{ color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
                        >
                            <CloseRoundedIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    </Box>
                    <Box sx={{ p: 1.5, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {CONVERSATION_MODELS.map((model) => {
                            const isActive = model.id === conversationModel;
                            return (
                                <Box
                                    key={model.id}
                                    component="button"
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={async () => {
                                        if (isOpenAiConversationProfile(model.id)) await notifyOpenAiSelected();
                                        dispatch(setConversationModel(model.id));
                                        setShowModelModal(false);
                                    }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 1.2,
                                        borderRadius: '12px',
                                        border: `1.5px solid ${isActive ? appColor : darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                        backgroundColor: isActive
                                            ? (darkMode ? `${appColor}22` : `${appColor}15`)
                                            : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: 'inherit',
                                        outline: 'none',
                                        transition: 'all 0.15s ease',
                                        '&:hover': {
                                            backgroundColor: isActive
                                                ? (darkMode ? `${appColor}33` : `${appColor}25`)
                                                : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                                            borderColor: isActive ? appColor : darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
                                        },
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={model.image}
                                        alt={model.name}
                                        sx={{
                                            width: { xs: 72, sm: 84 },
                                            height: { xs: 72, sm: 84 },
                                            borderRadius: '12px',
                                            objectFit: 'cover',
                                            objectPosition: 'center 18%',
                                            flexShrink: 0,
                                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                                        }}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                            <Typography sx={{ fontSize: 15, fontWeight: 750, color: darkMode ? '#fff' : '#111' }}>
                                                {model.name}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: '50%',
                                                    border: `2px solid ${isActive ? appColor : darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}`,
                                                    backgroundColor: isActive ? appColor : 'transparent',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </Box>
                                        <Typography sx={{ fontSize: 12.5, opacity: 0.72, mt: 0.35 }}>
                                            {model.summary}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Modal>
        </>
    );
};
