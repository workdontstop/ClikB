import { CONCIERGE_ACKNOWLEDGMENT_MS, AnnouncementLedger, announcementKey, acceptConciergeDelta, interruptedConciergeFeedback } from '../conciergeAnnouncements';
import { handleConciergeMeteredBillingEvent } from '../pixelBillingClient';
import { logControlDiagnostic } from '../conciergeDiagnostics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChatMessage } from '../PromptConstructorMock';
import { useGeminiVoice } from '../hooks/useGeminiVoice';
import { AppDispatch, RootState, store } from '../store';
import { FULLSCREEN_SLIDESHOW_GUIDANCE } from '../fullscreenHeartbeat';
import { AUTO_CONTROL_PING_INTERVAL, allowCreationProgressAnnouncement, autoControlPingMessage, autoControlSnapshotKey, autoControlRequestContext, clearAutoControlSessionReceipts, clearAutoControlTask, clearPendingAutoControlUserTurn, getAutoControlTask, idleAutoControlTask, noteAutoControlGateStage, noteAutoControlUserTurn, resumeAutoControlTask, shouldWakeAutoControlHeartbeat } from '../autoControlContinuation';
import {
    automaticGuideCallCancelled,
    automaticGuideCallFailed,
    automaticGuideCallStarted,
    automaticGuideCallSucceeded,
    addBrainstormMemorySlot,
    resetBrainstormSession,
    setBrainstormChatHistory,
    setBrainstormSessionIdentity,
    type BrainstormMemorySlot,
    type BrainstormSessionIdentity,
    type UserSnapshot,
} from '../brainstormSlice';
import { chunkCreationMemoryText, type CreationMemoryCard } from '../creationMemory';
import { CreationMemoryComposition, selectCreationMemoryFallback } from '../creationProjectMemory';
import { setConciergeEnabled } from '../settingsSlice';
import { handleNavigationBrowserRequest, observeCurrentAppSnapshot } from '../navigationBrowserControl';
import SharedBackControl from '../SharedBackControl';
import { getExecutingNavigationAction, getExecutingNavigationScroll } from '../navigationActionProvenance';
import { conversationMeasurementHeaders, syncConversationMeasurementSessionOwner } from '../conversationMeasurementSession';
import {
    AUTOMATIC_GUIDE_CALLS,
    AUTOMATIC_GUIDE_ENABLED_STORAGE_KEY,
    AUTOMATIC_GUIDE_RESPONSE_INSTRUCTION,
    type AutomaticGuideCallRequest,
} from '../automaticGuideCalls';
import {
    ConciergeEventQueue,
    buildMilestoneObservationPrompt,
    type ConciergeBatchResolution,
    type ConciergeMilestoneBatch,
    type ConciergeMilestoneEvent,
} from '../conciergeEventQueue';

type BrainstormRole = 'user' | 'assistant' | 'system';

type BrainstormPayloadMessage = {
    role: BrainstormRole;
    content: string;
};

type BuildPayloadResult = {
    messages: BrainstormPayloadMessage[];
    memorySlots: BrainstormMemorySlot[];
    userSnapshot: UserSnapshot;
    sessionIdentity: BrainstormSessionIdentity;
};

type BrainstormVoiceStreamCallbacks = {
    onTextDelta?: (delta: string) => void;
    onFinalText?: (text: string) => void;
};

type BrainstormAskOptions = {
    autoControlHeartbeat?: boolean;
    automaticGuideCallId?: string;
    conciergeObservationTurn?: boolean;
    pendingMilestoneEvents?: ConciergeMilestoneEvent[];
    milestoneBatchId?: string;
    hideTriggerMessage?: boolean;
    skipMemoryRollup?: boolean;
};

type BrainstormVoiceAskHandler = (text: string, signal?: AbortSignal, stream?: BrainstormVoiceStreamCallbacks, options?: BrainstormAskOptions) => Promise<string>;
type BrainstormVoiceController = ReturnType<typeof useGeminiVoice>;

export type GuidePanelState = 'normal' | 'compact' | 'hidden';

export type GuideUseTarget = {
    id: string;
    label: string;
    append: (text: string) => void;
    contextLabel?: string;
    getContextText?: () => string;
};

type BrainstormSessionContextValue = {
    chatHistory: ChatMessage[];
    setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatHistoryRef: React.MutableRefObject<ChatMessage[]>;
    memorySlots: BrainstormMemorySlot[];
    memorySlotsRef: React.MutableRefObject<BrainstormMemorySlot[]>;
    userSnapshot: UserSnapshot;
    sessionIdentity: BrainstormSessionIdentity;
    buildBrainstormPayload: (currentUserText: string, historyOverride?: ChatMessage[]) => BuildPayloadResult;
    noteMemoryAfterAssistant: (committedHistory: ChatMessage[], mode?: number) => Promise<void>;
    clearBrainstormSession: () => Promise<void>;
    voice: BrainstormVoiceController;
    setVoiceAskHandler: (handler: BrainstormVoiceAskHandler | null) => void;
    greetViaVoice: (text?: string) => Promise<void>;
    // Typed questions from the floating label's text mode. Same full-app brain
    // path and chatHistory bookkeeping as voice turns, but never autoplays TTS.
    textAsk: (text: string, signal?: AbortSignal) => Promise<string>;
    guideEnabled: boolean;
    guidePlayMode: boolean;
    setGuidePlayMode: (enabled: boolean) => void;
    runAutomaticGuideCall: (request: AutomaticGuideCallRequest) => Promise<string>;
    cancelAutomaticGuideCall: (callId: string) => void;
    setGuideEnabled: (enabled: boolean) => void;
    guidePanelState: GuidePanelState;
    setGuidePanelState: (state: GuidePanelState) => void;
    hasGuideUseTarget: boolean;
    guideUseTargetLabel: string;
    registerGuideUseTarget: (target: GuideUseTarget) => () => void;
    appendGuideTextToTarget: (text: string) => boolean;
    isGuideInlineHostActive: boolean;
    registerGuideInlineHost: () => () => void;
    syncCreationMemoryCards: (cards: CreationMemoryCard[], options?: { owner: string; priority?: number }) => void;
    waitForCreationMemorySync: () => Promise<void>;
    creationMemoryUnsyncedCardKeys: string[];
    takePendingMilestonesForTurn: () => ConciergeMilestoneBatch | null;
    resolveMilestoneBatch: (batchId: string, resolution: ConciergeBatchResolution) => void;
};

const SLOT_SIZE_COMPLETED_TURNS = 8;
const MEMORY_INDEX_LIMIT = 50;

const BRAINSTORM_DEVICE_ID_STORAGE_KEY = 'clikb_brainstorm_device_id';
const BRAINSTORM_GUEST_USER_ID_STORAGE_KEY = 'clikb_brainstorm_guest_user_id';
const CREATION_MEMORY_DEBOUNCE_MS = 650;

const hashCreationMemoryCard = (card: CreationMemoryCard): string => {
    const input = JSON.stringify(card);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

const createBrainstormScopedId = (prefix: string): string => {
    const cryptoRef = typeof crypto !== 'undefined' ? crypto : null;
    const randomPart = cryptoRef?.randomUUID ? cryptoRef.randomUUID() : Math.random().toString(36).slice(2);
    return `${prefix}-${Date.now()}-${randomPart}`;
};

const getOrCreateBrainstormDeviceId = (): string => {
    try {
        const existing = window.localStorage.getItem(BRAINSTORM_DEVICE_ID_STORAGE_KEY);
        if (existing) return existing;
        const next = createBrainstormScopedId('brainstorm-device');
        window.localStorage.setItem(BRAINSTORM_DEVICE_ID_STORAGE_KEY, next);
        return next;
    } catch {
        return createBrainstormScopedId('brainstorm-device');
    }
};

const createBrainstormGuestUserId = (): number => {
    let randomPart = Math.floor(Math.random() * 1000);

    try {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const randomValue = new Uint32Array(1);
            crypto.getRandomValues(randomValue);
            randomPart = randomValue[0] % 1000;
        }
    } catch {
        // Keep the browser-scoped fallback generated above.
    }

    return (Date.now() * 1000) + randomPart;
};

const getOrCreateBrainstormGuestUserId = (): number => {
    try {
        const existing = Number(window.localStorage.getItem(BRAINSTORM_GUEST_USER_ID_STORAGE_KEY));
        if (Number.isSafeInteger(existing) && existing > 0) return existing;

        const next = createBrainstormGuestUserId();
        window.localStorage.setItem(BRAINSTORM_GUEST_USER_ID_STORAGE_KEY, String(next));
        return next;
    } catch {
        return createBrainstormGuestUserId();
    }
};


const BrainstormSessionContext = createContext<BrainstormSessionContextValue | null>(null);

const toPayloadRole = (role: ChatMessage['role']): BrainstormRole => {
    if (role === 'ai') return 'assistant';
    if (role === 'system') return 'system';
    return 'user';
};

const toPayloadMessage = (msg: ChatMessage): BrainstormPayloadMessage => ({
    role: toPayloadRole(msg.role),
    content: msg.content,
});

const cleanVoiceReply = (replyText: string): string => {
    return replyText
        .replace(/^\s*(hey|hi|hello)[!,.?]?\s+(hey there|hi there|hello there)[!,.?]?\s*/i, (_match, _first, second) => `${second}! `)
        .replace(/^\s*(hey|hi|hello)[!,.?]?\s+\1[!,.?]?\s*/i, (_match, first) => `${first}! `)
        .replace(/\s+/g, ' ')
        .trim();
};

const getCompletedTurns = (history: ChatMessage[]): ChatMessage[][] => {
    const turns: ChatMessage[][] = [];
    for (let i = 0; i < history.length; i += 1) {
        const user = history[i];
        const assistant = history[i + 1];
        if (!user || !assistant) continue;
        if (user.role !== 'user' || assistant.role !== 'ai') continue;
        if (!user.content?.trim() || !assistant.content?.trim() || assistant.streaming) continue;
        turns.push([user, assistant]);
        i += 1;
    }
    return turns;
};

const getUnsummarizedTailMessages = (history: ChatMessage[], completedTurns: ChatMessage[][], lastLockedTurn: number): ChatMessage[] => {
    const lockedEndMsg = lastLockedTurn > 0 ? completedTurns[Math.min(lastLockedTurn, completedTurns.length) - 1]?.[1] : undefined;
    const startIdx = lockedEndMsg ? history.indexOf(lockedEndMsg) + 1 : 0;
    const tail: ChatMessage[] = [];
    for (let i = Math.max(0, startIdx); i < history.length; i += 1) {
        const msg = history[i];
        if (!msg || msg.role !== 'user' || !msg.content?.trim()) continue;
        const next = history[i + 1];
        if (next && next.role === 'ai') {
            if (next.content?.trim() && !next.streaming) tail.push(msg, next);
            else if (!next.content?.trim()) tail.push(msg);
            i += 1;
        } else {
            tail.push(msg);
        }
    }
    return tail;
};
const renderMemoryIndex = (slots: BrainstormMemorySlot[]): string => {
    const visible = slots.slice(-MEMORY_INDEX_LIMIT);
    if (!visible.length) return '';

    return [
        'SESSION MEMORY INDEX (title only to save tokens).',
        'These are locked summaries from earlier in this Brainstorm session.',
        'If the user refers to older context that is not clear from the recent raw tail, use searchSessionMemory with the relevant topic or summary title before answering.',
        ...visible.map((slot) => `${slot.slotId}. ${slot.title}`),
    ].join('\n');
};

export const BrainstormSessionProvider: React.FC<{
    clikUrl: string;
    children: React.ReactNode;
}> = ({ clikUrl, children }) => {
    const dispatch = useDispatch<AppDispatch>();
    const location = useLocation();
    const chatHistory = useSelector((state: RootState) => state.brainstorm.chatHistory);
    const memorySlots = useSelector((state: RootState) => state.brainstorm.memorySlots);
    const selectedVoice = useSelector((state: RootState) => state.brainstorm.selectedVoice);
    const sessionId = useSelector((state: RootState) => state.brainstorm.sessionId);
    const isChatOpen = useSelector((state: RootState) => state.brainstorm.isChatOpen);
    const automaticGuide = useSelector((state: RootState) => state.brainstorm.automaticGuide);
    const deviceId = useSelector((state: RootState) => state.brainstorm.deviceId);
    const prompt = useSelector((state: RootState) => state.settings.prompt);
    const artstyle = useSelector((state: RootState) => state.settings.artstyle);
    const model = useSelector((state: RootState) => state.settings.model);
    const conversationModel = useSelector((state: RootState) => state.settings.conversationModel);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const [guestUserId] = useState<number>(() => getOrCreateBrainstormGuestUserId());
    const authenticatedUserId = Number(loggedUser?.id);
    const hasAuthenticatedUserId = Number.isFinite(authenticatedUserId) && authenticatedUserId > 0;
    const sessionUserId = hasAuthenticatedUserId ? authenticatedUserId : guestUserId;
    const sessionUsername = hasAuthenticatedUserId
        ? loggedUser?.username || loggedUser?.name || 'Guest'
        : 'Guest';
    const chatHistoryRef = useRef<ChatMessage[]>(chatHistory);
    const heartbeatAbortRef = useRef<AbortController | null>(null);
    const heartbeatQuietUntilRef = useRef(0);
    const voiceBusyRef = useRef(false);
    const voiceOutputOrInputBusyRef = useRef(false);
    const conciergeEventQueueRef = useRef<ConciergeEventQueue | null>(null);
    const milestoneCommentaryAbortRef = useRef<AbortController | null>(null);
    const announcementsRef = useRef(new AnnouncementLedger());
    const memorySlotsRef = useRef<BrainstormMemorySlot[]>(memorySlots);
    const sessionIdentityRef = useRef<BrainstormSessionIdentity>({
        userId: sessionUserId,
        username: sessionUsername,
        sessionId,
        deviceId,
    });
    const rollupInFlightRef = useRef(false);
    const rollupWaitersRef = useRef<Array<() => void>>([]);
    const sessionMemoryGenerationRef = useRef(0);
    const greetInFlightRef = useRef(false);
    const voiceAskOverrideRef = useRef<BrainstormVoiceAskHandler | null>(null);
    const guideUseTargetRef = useRef<GuideUseTarget | null>(null);
    const creationMemoryHashesRef = useRef<Map<string, string>>(new Map());
    const creationMemoryLatestHashesRef = useRef<Map<string, string>>(new Map());
    const creationMemoryPendingRef = useRef<Map<string, CreationMemoryCard>>(new Map());
    const creationMemoryLatestCardsRef = useRef<Map<string, CreationMemoryCard>>(new Map());
    const creationMemoryCompositionRef = useRef(new CreationMemoryComposition());
    const creationMemoryOwnerIdentityRef = useRef('');
    const selectedReferenceMemoryCardRef = useRef<CreationMemoryCard | null>(null);
    const creationMemoryAutoPartCountsRef = useRef<Map<string, number>>(new Map());
    const automaticGuideControllersRef = useRef<Map<string, AbortController>>(new Map());
    const automaticGuideInFlightRef = useRef<Set<string>>(new Set());
    const creationMemoryTimerRef = useRef<number | null>(null);
    const creationMemorySyncChainRef = useRef<Promise<void>>(Promise.resolve());
    const creationMemorySyncGenerationRef = useRef(0);
    const guidePlayModeRef = useRef(false);
    const voiceActiveRef = useRef(false);
    const guidePlayModeSpeakTextRef = useRef<((text: string) => Promise<void>) | null>(null);
    const automaticSpeechQueueRef = useRef<((text: string, current: () => boolean) => void) | null>(null);
    const automaticSpeechCancelRef = useRef<(() => void) | null>(null);
    const guideEnabledRef = useRef(true);
    const queueAutomaticAnnouncement = useCallback((reply: string, family: string, signal?: AbortSignal, onSpeechCheck?: () => void) => {
        const key = announcementKey(observeCurrentAppSnapshot(), family, reply);
        const identity = sessionIdentityRef.current;
        automaticSpeechQueueRef.current?.(reply, () => {
            const state = store.getState();
            const isCompanionMilestone = family === 'concierge-milestone';
            const allowed = !signal?.aborted && guideEnabledRef.current
                && identity.sessionId === sessionIdentityRef.current.sessionId
                && identity.deviceId === sessionIdentityRef.current.deviceId
                && identity.userId === sessionIdentityRef.current.userId
                && (guidePlayModeRef.current || voiceActiveRef.current)
                && state.brainstorm.automaticGuide.enabled
                && state.brainstorm.automaticGuide.callOverrides[family] !== false
                && (isCompanionMilestone || (state.settings.autoControlEnabled && state.settings.autoControlVisible))
                && (family !== 'creation-progress' || allowCreationProgressAnnouncement(state.brainstorm.userSnapshot.creation?.projectId))
                && (isCompanionMilestone || key === announcementKey(observeCurrentAppSnapshot(), family, reply));
            if (allowed) onSpeechCheck?.();
            return allowed;
        });
    }, []);
    const [guideEnabled, setGuideEnabledState] = useState(true);
    const [guidePlayMode, setGuidePlayModeState] = useState(false);
    const setGuidePlayMode = useCallback((enabled: boolean) => {
        guidePlayModeRef.current = enabled;
        if (!enabled) automaticSpeechCancelRef.current?.();
        setGuidePlayModeState(enabled);
    }, []);
    const setGuideEnabled = useCallback((enabled: boolean) => {
        guideEnabledRef.current = enabled;
        if (!enabled) automaticSpeechCancelRef.current?.();
        dispatch(setConciergeEnabled(enabled));
        setGuideEnabledState(enabled);
        if (!enabled) setGuidePlayMode(false);
    }, [dispatch, setGuidePlayMode]);
    const [guidePanelState, setGuidePanelState] = useState<GuidePanelState>('normal');
    const [guideUseTargetMeta, setGuideUseTargetMeta] = useState<{ id: string; label: string } | null>(null);
    const [guideInlineHostCount, setGuideInlineHostCount] = useState(0);
    const [creationMemoryUnsyncedCardKeys, setCreationMemoryUnsyncedCardKeys] = useState<string[]>([]);
    const voiceContextRef = useRef({
        pathname: location.pathname,
        prompt,
        artstyle,
        model,
        loggedUserName: loggedUser?.username || loggedUser?.name || 'Guest',
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(
                AUTOMATIC_GUIDE_ENABLED_STORAGE_KEY,
                automaticGuide.enabled ? 'true' : 'false',
            );
        } catch {
            // Redux remains the runtime source of truth when storage is unavailable.
        }
    }, [automaticGuide.enabled]);

    useEffect(() => {
        automaticGuideControllersRef.current.forEach((controller, callId) => {
            const callDisabled = automaticGuide.callOverrides[callId] === false;
            if (!guideEnabled || !automaticGuide.enabled || isChatOpen || callDisabled) {
                controller.abort();
            }
        });
    }, [automaticGuide.callOverrides, automaticGuide.enabled, guideEnabled, isChatOpen]);

    useEffect(() => () => {
        automaticSpeechCancelRef.current?.();
        automaticGuideControllersRef.current.forEach((controller) => controller.abort());
        automaticGuideControllersRef.current.clear();
        automaticGuideInFlightRef.current.clear();
        announcementsRef.current.clear();
        milestoneCommentaryAbortRef.current?.abort();
        conciergeEventQueueRef.current?.clear();
    }, []);

    useEffect(() => {
        chatHistoryRef.current = chatHistory;
    }, [chatHistory]);

    useEffect(() => {
        memorySlotsRef.current = memorySlots;
    }, [memorySlots]);

    // Snapshot data is read directly when requested. Subscribing this provider
    // to every control publication re-rendered the application during scrolling.


    useEffect(() => {
        const nextDeviceId = deviceId || getOrCreateBrainstormDeviceId();
        const nextSessionId = sessionId || createBrainstormScopedId('brainstorm-session');

        if (nextDeviceId !== deviceId || nextSessionId !== sessionId) {
            dispatch(setBrainstormSessionIdentity({ sessionId: nextSessionId, deviceId: nextDeviceId }));
        }
    }, [deviceId, dispatch, sessionId]);

    const sessionIdentity = useMemo<BrainstormSessionIdentity>(() => ({
        userId: sessionUserId,
        username: sessionUsername,
        sessionId,
        deviceId,
    }), [deviceId, sessionId, sessionUserId, sessionUsername]);

    useEffect(() => {
        const previous = sessionIdentityRef.current;
        syncConversationMeasurementSessionOwner(hasAuthenticatedUserId ? authenticatedUserId : null);
        if (previous.sessionId !== sessionIdentity.sessionId || previous.deviceId !== sessionIdentity.deviceId || previous.userId !== sessionIdentity.userId) {
            automaticSpeechCancelRef.current?.();
        }
        sessionIdentityRef.current = sessionIdentity;
    }, [authenticatedUserId, hasAuthenticatedUserId, sessionIdentity]);

    useEffect(() => {
        voiceContextRef.current = {
            pathname: location.pathname,
            prompt,
            artstyle,
            model,
            loggedUserName: loggedUser?.username || loggedUser?.name || 'Guest',
        };
    }, [location.pathname, prompt, artstyle, model, loggedUser]);

    const setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>> = useCallback((updater) => {
        const next = typeof updater === 'function'
            ? (updater as (prev: ChatMessage[]) => ChatMessage[])(chatHistoryRef.current)
            : updater;
        const previousIds = new Set(chatHistoryRef.current.map(message => message.id));
        const newUserTurn = next.find(message => !previousIds.has(message.id) && message.role === 'user'
            && !message.automaticGuideCallId && !message.id.startsWith('auto-control-heartbeat-'));
        if (newUserTurn && store.getState().settings.autoControlEnabled) noteAutoControlUserTurn(newUserTurn.content);
        if (next.some(message => !previousIds.has(message.id) && !message.id.startsWith('auto-control-heartbeat-') && !message.id.startsWith('concierge-milestone-') && !message.id.startsWith('automatic-guide-') && (message.role === 'user' || message.streaming))) {
            heartbeatAbortRef.current?.abort();
            milestoneCommentaryAbortRef.current?.abort();
            heartbeatQuietUntilRef.current = Date.now() + AUTO_CONTROL_PING_INTERVAL;
        }
        chatHistoryRef.current = next;
        dispatch(setBrainstormChatHistory(next));
    }, [dispatch]);

    const buildBrainstormPayload = useCallback((currentUserText: string, historyOverride?: ChatMessage[]): BuildPayloadResult => {
        const history = historyOverride || chatHistoryRef.current;
        const messages: BrainstormPayloadMessage[] = [];
        const memoryIndex = renderMemoryIndex(memorySlotsRef.current);

        if (memoryIndex) {
            messages.push({ role: 'system', content: memoryIndex });
        }

        const completedTurns = getCompletedTurns(history);
        const slots = memorySlotsRef.current;
        const lastLockedTurn = slots.length ? slots[slots.length - 1].turnEnd : 0;
        const unsummarizedRaw = getUnsummarizedTailMessages(history, completedTurns, lastLockedTurn);
        messages.push(...unsummarizedRaw.map(toPayloadMessage));
        messages.push({ role: 'user', content: currentUserText });

        return {
            messages,
            memorySlots: slots.slice(-MEMORY_INDEX_LIMIT),
            userSnapshot: observeCurrentAppSnapshot(),
            sessionIdentity: sessionIdentityRef.current,
        };
    }, []);

    const noteMemoryAfterAssistant = useCallback(async (committedHistory: ChatMessage[], mode?: number) => {
        if (!clikUrl || rollupInFlightRef.current) return;
        const memoryGeneration = sessionMemoryGenerationRef.current;

        const completedTurns = getCompletedTurns(committedHistory);
        const currentSlots = memorySlotsRef.current;
        const lastEnd = currentSlots.length ? currentSlots[currentSlots.length - 1].turnEnd : 0;
        if (completedTurns.length - lastEnd < SLOT_SIZE_COMPLETED_TURNS) return;

        const turnStart = lastEnd + 1;
        const turnEnd = lastEnd + SLOT_SIZE_COMPLETED_TURNS;
        const turnSlice = completedTurns.slice(lastEnd, turnEnd).flat().map(toPayloadMessage);
        const slotId = currentSlots.length + 1;

        rollupInFlightRef.current = true;
        try {
            const response = await fetch(`${clikUrl}/memory/summarizeSlot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                credentials: 'include',
                body: JSON.stringify({
                    turns: turnSlice,
                    slotId,
                    turnStart,
                    turnEnd,
                    mode,
                    conversationModel,
                    sessionIdentity: sessionIdentityRef.current,
                }),
            });
            if (!response.ok) throw new Error(`memory summarize ${response.status}`);
            const data = await response.json();
            if (memoryGeneration !== sessionMemoryGenerationRef.current) return;
            const slot = data?.slot as BrainstormMemorySlot | undefined;
            if (!slot?.title || !slot?.fullSummary) return;

            const normalized: BrainstormMemorySlot = {
                slotId: Number(slot.slotId),
                turnStart: Number(slot.turnStart),
                turnEnd: Number(slot.turnEnd),
                title: String(slot.title),
                fullSummary: String(slot.fullSummary),
                rejectedIdeas: Array.isArray(slot.rejectedIdeas) ? slot.rejectedIdeas.map(String) : [],
                openQuestions: Array.isArray(slot.openQuestions) ? slot.openQuestions.map(String) : [],
                names: Array.isArray(slot.names) ? slot.names.map(String) : [],
                style: String(slot.style || ''),
            };

            if (memorySlotsRef.current.some((s) => s.slotId === normalized.slotId)) return;
            memorySlotsRef.current = [...memorySlotsRef.current, normalized];
            dispatch(addBrainstormMemorySlot(normalized));
        } catch (error) {
            console.error('Brainstorm memory rollup failed:', error);
        } finally {
            rollupInFlightRef.current = false;
            const waiters = rollupWaitersRef.current.splice(0);
            waiters.forEach((resolve) => resolve());
        }
    }, [clikUrl, conversationModel, dispatch]);

    const clearBrainstormSession = useCallback(async () => {
        automaticSpeechCancelRef.current?.();
        heartbeatAbortRef.current?.abort();
        clearAutoControlTask();
        clearAutoControlSessionReceipts();
        const identityToClear = sessionIdentityRef.current;
        const nextDeviceId = identityToClear.deviceId || getOrCreateBrainstormDeviceId();
        const nextSessionId = createBrainstormScopedId('brainstorm-session');

        automaticGuideControllersRef.current.forEach((controller) => controller.abort());
        automaticGuideControllersRef.current.clear();
        automaticGuideInFlightRef.current.clear();
        announcementsRef.current.clear();
        milestoneCommentaryAbortRef.current?.abort();
        conciergeEventQueueRef.current?.clear();
        if (creationMemoryTimerRef.current !== null) {
            window.clearTimeout(creationMemoryTimerRef.current);
            creationMemoryTimerRef.current = null;
        }
        creationMemoryPendingRef.current.clear();
        creationMemoryLatestCardsRef.current.clear();
        creationMemoryCompositionRef.current.clear();
        creationMemoryOwnerIdentityRef.current = '';
        selectedReferenceMemoryCardRef.current = null;
        creationMemoryAutoPartCountsRef.current.clear();
        creationMemoryHashesRef.current.clear();
        creationMemoryLatestHashesRef.current.clear();
        creationMemorySyncGenerationRef.current += 1;
        setCreationMemoryUnsyncedCardKeys([]);
        sessionMemoryGenerationRef.current += 1;

        chatHistoryRef.current = [];
        memorySlotsRef.current = [];
        dispatch(resetBrainstormSession());
        dispatch(setBrainstormSessionIdentity({ sessionId: nextSessionId, deviceId: nextDeviceId }));

        if (!clikUrl || !identityToClear.userId || !identityToClear.sessionId || !identityToClear.deviceId) return;

        try {
            if (rollupInFlightRef.current) {
                await new Promise<void>((resolve) => rollupWaitersRef.current.push(resolve));
            }
            await creationMemorySyncChainRef.current.catch(() => undefined);
            const response = await fetch(`${clikUrl}/memory/session/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                credentials: 'include',
                body: JSON.stringify({ sessionIdentity: identityToClear }),
            });
            if (!response.ok) throw new Error(`session memory reset ${response.status}`);
        } catch (error) {
            console.error('Brainstorm Pinecone session-memory reset failed:', error);
        }
    }, [clikUrl, dispatch]);

    const setVoiceAskHandler = useCallback((handler: BrainstormVoiceAskHandler | null) => {
        voiceAskOverrideRef.current = handler;
    }, []);

    const registerGuideUseTarget = useCallback((target: GuideUseTarget) => {
        guideUseTargetRef.current = target;
        setGuideUseTargetMeta({ id: target.id, label: target.label });

        return () => {
            if (guideUseTargetRef.current?.id !== target.id) return;
            guideUseTargetRef.current = null;
            setGuideUseTargetMeta(null);
        };
    }, []);

    const appendGuideTextToTarget = useCallback((text: string): boolean => {
        const cleanText = String(text || '').trim();
        const target = guideUseTargetRef.current;
        if (!cleanText || !target) return false;
        target.append(cleanText);
        return true;
    }, []);

    const registerGuideInlineHost = useCallback(() => {
        let disposed = false;
        setGuideInlineHostCount((count) => count + 1);

        return () => {
            if (disposed) return;
            disposed = true;
            setGuideInlineHostCount((count) => Math.max(0, count - 1));
        };
    }, []);

    const updateCreationMemoryUnsyncedState = useCallback((updates: Array<{ cardKey: string; unsynced: boolean }>) => {
        if (!updates.length) return;
        setCreationMemoryUnsyncedCardKeys((previous) => {
            const next = new Set(previous);
            updates.forEach(({ cardKey, unsynced }) => {
                if (unsynced) next.add(cardKey);
                else next.delete(cardKey);
            });
            const nextKeys = Array.from(next).sort();
            if (
                nextKeys.length === previous.length
                && nextKeys.every((cardKey, index) => cardKey === previous[index])
            ) return previous;
            return nextKeys;
        });
    }, []);

    const flushCreationMemoryCards = useCallback(() => {
        creationMemoryTimerRef.current = null;
        const pending = Array.from(creationMemoryPendingRef.current.values());
        creationMemoryPendingRef.current.clear();
        const syncGeneration = creationMemorySyncGenerationRef.current;
        const identityToSync = { ...sessionIdentity };

        const operations = pending.flatMap((card) => {
            const normalized: CreationMemoryCard = {
                ...card,
                cardKey: String(card.cardKey || '').trim(),
                title: String(card.title || card.cardKey || '').trim(),
                text: String(card.text || '').trim(),
            };
            if (!normalized.cardKey.startsWith('project:')) return [];

            const nextHash = hashCreationMemoryCard(normalized);
            const previousHash = creationMemoryHashesRef.current.get(normalized.cardKey);
            if (previousHash === nextHash) return [];
            if (!normalized.text && previousHash === undefined) return [];

            return [{
                ...normalized,
                action: normalized.text ? 'upsert' as const : 'delete' as const,
                nextHash,
            }];
        });
        if (!operations.length || !clikUrl) return;

        creationMemorySyncChainRef.current = creationMemorySyncChainRef.current
            .catch(() => undefined)
            .then(async () => {
                if (syncGeneration !== creationMemorySyncGenerationRef.current) return;
                let lastError: unknown;
                for (let attempt = 1; attempt <= 2; attempt += 1) {
                    try {
                        const response = await fetch(`${clikUrl}/memory/session/creation-sync`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                            credentials: 'include',
                            body: JSON.stringify({
                                sessionIdentity: identityToSync,
                                operations: operations.map(({ nextHash, ...operation }) => operation),
                                conversationModel,
                            }),
                        });
                        if (!response.ok) throw new Error(`creation memory sync ${response.status}`);
                        lastError = undefined;
                        break;
                    } catch (error) {
                        lastError = error;
                        if (attempt < 2) {
                            await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
                        }
                    }
                }
                if (lastError) throw lastError;
                if (syncGeneration !== creationMemorySyncGenerationRef.current) return;
                operations.forEach((operation) => {
                    creationMemoryHashesRef.current.set(operation.cardKey, operation.nextHash);
                });
                updateCreationMemoryUnsyncedState(
                    operations
                        .filter((operation) => (
                            creationMemoryLatestHashesRef.current.get(operation.cardKey) === operation.nextHash
                        ))
                        .map((operation) => ({ cardKey: operation.cardKey, unsynced: false })),
                );
            })
            .catch((error) => {
                console.error('Creation memory synchronization failed:', error);
            });
    }, [clikUrl, conversationModel, sessionIdentity.deviceId, sessionIdentity.sessionId, sessionIdentity.userId, sessionIdentity.username, updateCreationMemoryUnsyncedState]);

    const syncCreationMemoryCards = useCallback((cards: CreationMemoryCard[], options?: { owner: string; priority?: number }) => {
        const identityKey = `${sessionIdentity.userId}:${sessionIdentity.deviceId}:${sessionIdentity.sessionId}`;
        if (creationMemoryOwnerIdentityRef.current !== identityKey) {
            creationMemoryOwnerIdentityRef.current = identityKey;
            creationMemorySyncGenerationRef.current += 1;
            creationMemoryCompositionRef.current.clear();
            creationMemoryLatestCardsRef.current.clear();
            creationMemoryPendingRef.current.clear();
            creationMemoryHashesRef.current.clear();
            creationMemoryLatestHashesRef.current.clear();
            creationMemoryAutoPartCountsRef.current.clear();
        }
        const contributions = options ? creationMemoryCompositionRef.current.update(options.owner, options.priority ?? 0, cards) : cards;
        const unsyncedUpdates: Array<{ cardKey: string; unsynced: boolean }> = [];
        const expandedCards = (Array.isArray(contributions) ? contributions : []).flatMap((card): CreationMemoryCard[] => {
            const cardKey = String(card?.cardKey || '').trim();
            if (!cardKey.startsWith('project:')) return [];
            const parts = chunkCreationMemoryText(String(card?.text || ''));
            const previousCount = creationMemoryAutoPartCountsRef.current.get(cardKey) || 1;
            creationMemoryAutoPartCountsRef.current.set(cardKey, parts.length || 1);
            if (parts.length <= 1 && previousCount <= 1) return [card];
            return [
                { ...card, text: parts.length > 1
                    ? `Part 1 of ${parts.length}; remaining parts use this card key with :part:N.\n\n${parts[0]}`
                    : parts[0] || '' },
                ...Array.from({ length: Math.max(previousCount, parts.length) - 1 }, (_, offset) => ({
                    ...card,
                    cardKey: `${cardKey}:part:${offset + 2}`,
                    title: `${card.title} part ${offset + 2}`,
                    text: parts[offset + 1] || '',
                })),
            ];
        });
        expandedCards.forEach((card) => {
            const normalized: CreationMemoryCard = {
                ...card,
                cardKey: String(card?.cardKey || '').trim(),
                title: String(card?.title || card?.cardKey || '').trim(),
                text: String(card?.text || '').trim(),
            };
            if (!normalized.cardKey.startsWith('project:')) return;
            if (normalized.cardKey.endsWith(':selected_reference')) {
                selectedReferenceMemoryCardRef.current = normalized;
            }

            const nextHash = hashCreationMemoryCard(normalized);
            const previousHash = creationMemoryHashesRef.current.get(normalized.cardKey);
            const hasPendingChange = previousHash !== nextHash
                && Boolean(normalized.text || previousHash !== undefined);
            creationMemoryLatestHashesRef.current.set(normalized.cardKey, nextHash);
            creationMemoryLatestCardsRef.current.set(normalized.cardKey, normalized);
            creationMemoryPendingRef.current.set(normalized.cardKey, normalized);
            unsyncedUpdates.push({ cardKey: normalized.cardKey, unsynced: hasPendingChange });
        });
        updateCreationMemoryUnsyncedState(unsyncedUpdates);
        if (creationMemoryTimerRef.current !== null) {
            window.clearTimeout(creationMemoryTimerRef.current);
        }
        creationMemoryTimerRef.current = window.setTimeout(
            flushCreationMemoryCards,
            CREATION_MEMORY_DEBOUNCE_MS,
        );
    }, [flushCreationMemoryCards, updateCreationMemoryUnsyncedState, sessionIdentity]);

    const waitForCreationMemorySync = useCallback(async () => {
        // A failed background request is retried on the next question, without
        // rereading the draft or enabling App Control.
        creationMemoryLatestCardsRef.current.forEach((card, key) => {
            const previous = creationMemoryHashesRef.current.get(key);
            if (previous !== creationMemoryLatestHashesRef.current.get(key) && (card.text || previous !== undefined)) {
                creationMemoryPendingRef.current.set(key, card);
            }
        });
        if (creationMemoryTimerRef.current !== null) {
            window.clearTimeout(creationMemoryTimerRef.current);
        }
        flushCreationMemoryCards();
        await creationMemorySyncChainRef.current.catch(() => undefined);
    }, [flushCreationMemoryCards]);

    useEffect(() => () => {
        if (creationMemoryTimerRef.current !== null) {
            window.clearTimeout(creationMemoryTimerRef.current);
        }
    }, []);

    const fullAppVoiceAsk = useCallback(async (
        userText: string,
        signal?: AbortSignal,
        stream?: BrainstormVoiceStreamCallbacks,
        options: BrainstormAskOptions = {},
    ): Promise<string> => {
        const text = (userText || '').trim();
        if (!text) return '';
        if (!options.autoControlHeartbeat) heartbeatAbortRef.current?.abort();
        if (!options.autoControlHeartbeat && !options.automaticGuideCallId && !options.conciergeObservationTurn) {
            automaticSpeechCancelRef.current?.();
            automaticGuideControllersRef.current.forEach(controller => controller.abort());
        }
        const eventKey = options.automaticGuideCallId ? announcementKey(observeCurrentAppSnapshot(), options.automaticGuideCallId, text) : '';
        if (eventKey && !announcementsRef.current.begin(eventKey)) return '';
        const settleAnnouncement = (emitted: boolean) => { if (eventKey) announcementsRef.current.finish(eventKey, emitted); };


        if (store.getState().brainstorm.userSnapshot.creation?.isActive) {
            await waitForCreationMemorySync();
        }

        const rawHistoryBeforeTurn = chatHistoryRef.current;
        const lastBeforeTurn = rawHistoryBeforeTurn[rawHistoryBeforeTurn.length - 1];
        const replacesTrailingPartialUser = !options.hideTriggerMessage && lastBeforeTurn?.role === 'user' && Boolean(lastBeforeTurn.content?.trim()) && text.toLowerCase().startsWith(lastBeforeTurn.content.trim().toLowerCase());
        const historyBeforeTurn = replacesTrailingPartialUser ? rawHistoryBeforeTurn.slice(0, -1) : rawHistoryBeforeTurn;
        const aiStartedAt = Date.now();
        const messagePrefix = options.autoControlHeartbeat ? 'auto-control-heartbeat' : options.conciergeObservationTurn ? 'concierge-milestone' : options.automaticGuideCallId
            ? `automatic-guide-${options.automaticGuideCallId}`
            : 'global-voice';
        const userMsg: ChatMessage = {
            id: `${messagePrefix}-user-${aiStartedAt}`,
            role: 'user',
            content: text,
            timestamp: aiStartedAt,
            automaticGuideCallId: options.automaticGuideCallId,
        };
        const aiMsgId = `${messagePrefix}-ai-${aiStartedAt + 1}`;
        const aiPlaceholder: ChatMessage = {
            id: aiMsgId,
            role: 'ai',
            content: '',
            timestamp: aiStartedAt,
            streaming: true,
            automaticGuideCallId: options.automaticGuideCallId,
        };
        setChatHistory(prev => options.hideTriggerMessage
            ? [...prev, aiPlaceholder]
            : [...((prev[prev.length - 1]?.role === 'user' && prev[prev.length - 1]?.content?.trim() && text.toLowerCase().startsWith(prev[prev.length - 1].content.trim().toLowerCase())) ? prev.slice(0, -1) : prev), userMsg, aiPlaceholder]);

        const patchAiMsg = (patch: Partial<ChatMessage>) => {
            setChatHistory(prev => prev.map(m => (m.id === aiMsgId ? { ...m, ...patch } : m)));
        };

        const payload = buildBrainstormPayload(text, historyBeforeTurn);
        const creationProgressCall = options.automaticGuideCallId === 'creation-progress';
        const creationMemoryGuideCall = creationProgressCall
            || options.automaticGuideCallId === AUTOMATIC_GUIDE_CALLS.SCENE_GENERATION_DOUBLE_CHECK.id
            || options.automaticGuideCallId === AUTOMATIC_GUIDE_CALLS.CHARACTER_LIST_AUDIT.id;
        const requestSnapshot = creationMemoryGuideCall ? {
            route: payload.userSnapshot.route,
            autoControl: payload.userSnapshot.autoControl,
            creation: {
                isActive: payload.userSnapshot.creation?.isActive,
                projectId: payload.userSnapshot.creation?.projectId,
                stage: payload.userSnapshot.creation?.stage,
                mode: payload.userSnapshot.creation?.mode,
                status: payload.userSnapshot.creation?.status,
                isGenerating: payload.userSnapshot.creation?.isGenerating,
                previewSceneCount: payload.userSnapshot.creation?.previewSceneCount,
                previewImageCount: payload.userSnapshot.creation?.previewImageCount,
                hdImageCount: payload.userSnapshot.creation?.hdImageCount,
                videoCount: payload.userSnapshot.creation?.videoCount,
                mediaRevision: payload.userSnapshot.creation?.mediaRevision,
                recentMediaChanges: payload.userSnapshot.creation?.recentMediaChanges,
                editStoryMotionStatus: payload.userSnapshot.creation?.editStoryMotionStatus,
                editStoryMotionVideoReady: payload.userSnapshot.creation?.editStoryMotionVideoReady,
                imageError: payload.userSnapshot.creation?.imageError,
                videoError: payload.userSnapshot.creation?.videoError,
                characterBranchStage: payload.userSnapshot.creation?.characterBranchStage,
                canCreateCharacters: payload.userSnapshot.creation?.canCreateCharacters,
                canGenerateCharacterImages: payload.userSnapshot.creation?.canGenerateCharacterImages,
                referenceImageReadyCount: payload.userSnapshot.creation?.referenceImageReadyCount,
                referenceImageMissingCount: payload.userSnapshot.creation?.referenceImageMissingCount,
                editStoryIsOpen: payload.userSnapshot.creation?.editStoryIsOpen,
                editStoryIsBShot: payload.userSnapshot.creation?.editStoryIsBShot,
                editStoryCurrentSceneNumber: payload.userSnapshot.creation?.editStoryCurrentSceneNumber,
                // Compact progress still needs owner-published slot/job facts;
                // total images alone cannot explain primary versus extra work.
                controls: { areas: Object.fromEntries(Object.entries(payload.userSnapshot.creation?.controls?.areas || {})
                    .map(([areaId, area]) => [areaId, { state: area.state }])) },
                selectedModelDisplayName: payload.userSnapshot.creation?.selectedModelDisplayName,
                promptMemoryPartCount: payload.userSnapshot.creation?.promptMemoryPartCount,
                originalRequestMemoryPartCount: payload.userSnapshot.creation?.originalRequestMemoryPartCount,
                generationPlanMemoryPartCount: payload.userSnapshot.creation?.generationPlanMemoryPartCount,
                intentOverviewMemoryPartCount: payload.userSnapshot.creation?.intentOverviewMemoryPartCount,
                sceneIndexMemoryPartCount: payload.userSnapshot.creation?.sceneIndexMemoryPartCount,
                characterMemoryPartCount: payload.userSnapshot.creation?.characterMemoryPartCount,
                detectedCharacterCount: payload.userSnapshot.creation?.detectedCharacterCount,
                detectedEnvironmentCount: payload.userSnapshot.creation?.detectedEnvironmentCount,
            },
        } : payload.userSnapshot;
        let selectedReferenceSyncPending = false;
        if (!creationMemoryGuideCall && 'referenceEditorOpen' in requestSnapshot.creation && requestSnapshot.creation.referenceEditorOpen) {
            const selectedKey = `project:${requestSnapshot.creation.projectId}:selected_reference`;
            const selectedCard = selectedReferenceMemoryCardRef.current;
            if (selectedCard?.cardKey === selectedKey && selectedCard.text) {
                if (creationMemoryTimerRef.current !== null) {
                    window.clearTimeout(creationMemoryTimerRef.current);
                    creationMemoryTimerRef.current = null;
                }
                flushCreationMemoryCards();
                await creationMemorySyncChainRef.current.catch(() => undefined);
                if (creationMemoryHashesRef.current.get(selectedKey)
                    !== creationMemoryLatestHashesRef.current.get(selectedKey)) {
                    selectedReferenceSyncPending = true;
                }
            }
        }
        const currentProject = String(requestSnapshot.creation?.projectId || '');
        const projectMemoryPending = [...creationMemoryLatestCardsRef.current.entries()].some(([key, card]) =>
            key.startsWith(`project:${currentProject}:`) && (card.text || creationMemoryHashesRef.current.has(key))
            && creationMemoryHashesRef.current.get(key) !== creationMemoryLatestHashesRef.current.get(key));
        const memoryFallback = projectMemoryPending ? selectCreationMemoryFallback(
            [...creationMemoryLatestCardsRef.current.values()], currentProject, text, payload.userSnapshot.creation?.sceneSlots || [],
        ) : [];
        const activeGuideTarget = guideUseTargetRef.current;
        const fullAppContext = {
            role: 'system' as const,
            content: [
                guidePlayModeRef.current
                    ? 'You are in ClikB Guide Play Mode: the normal Guide text interface remains visible while replies are also spoken.'
                    : 'You are in ClikB full app voice mode.',
                guidePlayModeRef.current
                    ? 'Respond naturally for the visible text panel and for immediate spoken playback.'
                    : 'There is no visible chat box in this mode, only a small hollow voice circle.',
                'Do not assume the user is in memes, story, games, or prompt-constructor mode unless the context says so.',
                (options.automaticGuideCallId || options.conciergeObservationTurn)
                    ? AUTOMATIC_GUIDE_RESPONSE_INSTRUCTION
                    : 'Answer naturally for spoken conversation and keep replies concise enough to be spoken aloud.',
                payload.userSnapshot.feeds?.activeAreaIds.some(id => id.startsWith('clikb.feeds.fullscreen.'))
                    ? `Auto Control continuation is available while On. Current time: ${Date.now()} ms. ${FULLSCREEN_SLIDESHOW_GUIDANCE}` : '',
                activeGuideTarget?.contextLabel ? `Current NotepadEditor mode: ${activeGuideTarget.contextLabel}.` : '',
            ].filter(Boolean).join('\n'),
        };

        const messages = creationMemoryGuideCall
            ? [fullAppContext, { role: 'user' as const, content: text }]
            : [fullAppContext, ...payload.messages];
        let raw = '';
        const acknowledgment = setTimeout(() => { if (!raw && !signal?.aborted) patchAiMsg({status:'Received — working on it'}); }, CONCIERGE_ACKNOWLEDGMENT_MS);
        let reply = '';
        let responseInterrupted = false;
        let acceptedActionLabel: string | null = null;
        const autoQueue = typeof conciergeEventQueueRef !== 'undefined' ? conciergeEventQueueRef.current : null;
        if (options.autoControlHeartbeat && autoQueue && typeof store !== 'undefined') {
            autoQueue.observe(store.getState().brainstorm.userSnapshot, Date.now());
        }
        const autoHeartbeatBatch = options.autoControlHeartbeat
            && !(Array.isArray(options.pendingMilestoneEvents) && options.pendingMilestoneEvents.length > 0)
            && autoQueue
            ? autoQueue.takeForUserTurn(Date.now())
            : null;
        const effectiveMilestoneEvents = Array.isArray(options.pendingMilestoneEvents) && options.pendingMilestoneEvents.length > 0
            ? options.pendingMilestoneEvents
            : autoHeartbeatBatch?.events;

        try {
            const resp = await fetch(`${clikUrl}/startBrainstormStream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                credentials: 'include',
                body: JSON.stringify({
                    messages,
                    memorySlots: creationMemoryGuideCall ? [] : payload.memorySlots,
                    userSnapshot: selectedReferenceSyncPending || projectMemoryPending
                        ? { ...requestSnapshot, conciergeMemorySyncPending: true, creationMemoryFallback: memoryFallback } : requestSnapshot,
                    sessionIdentity: payload.sessionIdentity,
                    conversationModel,
                    webSearch: false,
                    automaticGuideCallId: options.automaticGuideCallId ?? null,
                    autoControlHeartbeat: options.autoControlHeartbeat === true,
                    ...(options.conciergeObservationTurn ? { conciergeObservationTurn: true } : {}),
                    ...(Array.isArray(effectiveMilestoneEvents) && effectiveMilestoneEvents.length > 0
                        ? { pendingMilestoneEvents: effectiveMilestoneEvents }
                        : {}),
                    ...autoControlRequestContext(text),
                }),
                signal,
            });
            if (!resp.ok || !resp.body) throw new Error(`Brainstorm stream HTTP ${resp.status}`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const receivedNarrationEvents = new Set<string>();
            let finished = false;
            let streamFailed = false;

            while (!finished) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';

                for (const frame of frames) {
                    const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
                    if (!dataLine) continue;
                    const jsonStr = dataLine.slice(5).trim();
                    if (!jsonStr) continue;
                    let evt: any;
                    try { evt = JSON.parse(jsonStr); } catch { continue; }

                    if (evt.type === 'delta') {
                        if (!acceptConciergeDelta(receivedNarrationEvents, evt)) continue;
                        clearTimeout(acknowledgment);
                        const delta = String(evt.text || '');
                        if (!delta) continue;
                        raw += delta;
                        stream?.onTextDelta?.(delta);
                        patchAiMsg({ content: cleanVoiceReply(raw), status: undefined });
                    } else if (evt.type === 'status') {
                        if (evt.virtualGate && typeof evt.virtualGate.stage === 'string') {
                            const gate = evt.virtualGate;
                            if (['handler_dispatched', 'observed_success'].includes(gate.stage)
                                && gate.detail?.evidence?.mutationSent !== false) {
                                acceptedActionLabel = String(gate.detail?.evidence?.controlLabel || 'the last app change');
                            }
                            if (!options.automaticGuideCallId && !options.conciergeObservationTurn) noteAutoControlGateStage(gate.stage, gate.detail,
                                autoControlSnapshotKey(store.getState().brainstorm.userSnapshot));
                            if (gate.stage === 'task_completed') {
                                automaticSpeechCancelRef.current?.();
                                for (const callId of ['creation-progress', 'scene-generation-double-check', 'character-list-audit'])
                                    automaticGuideControllersRef.current.get(callId)?.abort();
                            }
                            logControlDiagnostic('VirtualGate frontend', {
                                taskId: gate.taskId,
                                stage: gate.stage,
                                stateVersion: gate.stateVersion,
                                detail: gate.detail,
                            });
                        }
                        patchAiMsg({ status: evt.text || undefined });
                    } else if (evt.type === 'navigation_browser_request') {
                        if (!signal?.aborted) void handleNavigationBrowserRequest(evt, clikUrl, signal);
                    } else if (evt.type === 'metered_billing') {
                        handleConciergeMeteredBillingEvent(evt);
                    } else if (evt.type === 'done') {
                        finished = true;
                    } else if (evt.type === 'error') {
                        finished = true;
                        streamFailed = true;
                    }
                }
            }
            if (!signal?.aborted && !options.autoControlHeartbeat && !options.automaticGuideCallId && !options.conciergeObservationTurn) clearPendingAutoControlUserTurn();
            if (eventKey && eventKey !== announcementKey(store.getState().brainstorm.userSnapshot, options.automaticGuideCallId!, text)) {
                clearTimeout(acknowledgment); settleAnnouncement(false);
                setChatHistory(previous => previous.filter(message => message.id !== aiMsgId)); return '';
            }
            if (streamFailed) throw new Error('Brainstorm stream interrupted');
            if (!raw.trim()) throw new Error('Empty Brainstorm stream');
            void axios.get(`${clikUrl}/ai-provider-status`, { timeout: 5000 }).catch(() => undefined);
            reply = cleanVoiceReply(raw);
        } catch (e: any) {
            clearTimeout(acknowledgment);
            const abortedCatchErr = Boolean(signal?.aborted || e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED');
            if (!abortedCatchErr && !options.autoControlHeartbeat && !options.automaticGuideCallId && !options.conciergeObservationTurn) clearPendingAutoControlUserTurn();
            clearTimeout(acknowledgment);

            if (!abortedCatchErr && !options.autoControlHeartbeat && !options.automaticGuideCallId && !options.conciergeObservationTurn) clearPendingAutoControlUserTurn();
            settleAnnouncement(false);
            if (autoHeartbeatBatch && autoQueue) {
                const abortedErr = Boolean(signal?.aborted || e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED');
                autoQueue.resolveBatch(autoHeartbeatBatch.batchId, {
                    deliveredText: raw,
                    completedCleanly: false,
                    failed: !abortedErr,
                    now: Date.now(),
                });
            }
            if (signal?.aborted || e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
                if (options.hideTriggerMessage || !raw.trim()) {
                    setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
                } else {
                    patchAiMsg({ streaming: false, status: undefined });
                }
                throw e;
            }
            console.error('global voice stream failed:', e);
            if (options.conciergeObservationTurn) {
                void axios.get(`${clikUrl}/ai-provider-status`, { timeout: 5000 }).catch(() => undefined);
                setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
                throw e;
            }
            void axios.get(`${clikUrl}/ai-provider-status`, { timeout: 5000 }).catch(() => undefined);
            responseInterrupted = true;
            const feedback = interruptedConciergeFeedback(raw, acceptedActionLabel,
                Boolean(options.automaticGuideCallId || options.autoControlHeartbeat || options.conciergeObservationTurn));
            if (feedback === null) {
                setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
                return '';
            }
            const delta = raw.trim() ? feedback.slice(raw.length) : feedback;
            stream?.onTextDelta?.(delta);
            reply = cleanVoiceReply(feedback);
        }

        clearTimeout(acknowledgment);
        settleAnnouncement(Boolean(reply.trim()) && !reply.includes('[NO_UPDATE]'));
        if (autoHeartbeatBatch && autoQueue) {
            const noUpdate = reply.includes('[NO_UPDATE]');
            autoQueue.resolveBatch(autoHeartbeatBatch.batchId, {
                deliveredText: noUpdate ? '' : reply,
                completedCleanly: !responseInterrupted,
                suppressedNoUpdate: noUpdate,
                now: Date.now(),
            });
        }
        stream?.onFinalText?.(reply);
        const aiMsg: ChatMessage = {
            id: aiMsgId,
            role: 'ai',
            content: reply,
            timestamp: aiStartedAt,
            streaming: false,
            automaticGuideCallId: options.automaticGuideCallId,
        };
        patchAiMsg({ content: reply, streaming: false, status: undefined });
        if ((options.autoControlHeartbeat || options.automaticGuideCallId || options.conciergeObservationTurn) && reply.includes('[NO_UPDATE]')) {
            setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
            return '';
        }
        if (!responseInterrupted && !options.skipMemoryRollup) {
            void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg]);
        }
        return reply;
    }, [buildBrainstormPayload, clikUrl, conversationModel, dispatch, flushCreationMemoryCards, noteMemoryAfterAssistant, setChatHistory, waitForCreationMemorySync]);

    useEffect(() => {
        let running = false;
        let lastRunRevision = -1;
        let lastPingAt = 0;
        let lastSnapshotKey = '';
        let unchangedChecks = 0;
        const progressKey = () => {
            const creation = store.getState().brainstorm.userSnapshot.creation;
            return JSON.stringify([creation.projectId, creation.isGenerating, creation.status,
                creation.previewSceneCount, creation.previewImageCount, creation.hdImageCount,
                creation.videoCount, creation.mediaRevision, creation.editStoryMotionStatus, creation.editStoryMotionVideoReady]);
        };
        let lastProgressKey = progressKey();
        const snapshotKey = () => autoControlSnapshotKey(store.getState().brainstorm.userSnapshot);
        const eligible = () => {
            const settings = store.getState().settings;
            return settings.autoControlEnabled && settings.autoControlVisible && settings.conciergeEnabled;
        };
        const unsubscribe = store.subscribe(() => {
            if (!eligible()) {
                heartbeatAbortRef.current?.abort(); clearAutoControlTask(); lastRunRevision = -1; lastSnapshotKey = '';
                for (const callId of ['creation-progress', 'scene-generation-double-check', 'character-list-audit'])
                    automaticGuideControllersRef.current.get(callId)?.abort();
            }
        });
        const timer = window.setInterval(() => {
            if (!eligible() || document.hidden) return;
            let task = getAutoControlTask();
            if (!task) return;
            const currentSnapshotKey = snapshotKey();
            const currentProgressKey = progressKey();
            if (task.paused) {
                resumeAutoControlTask(currentSnapshotKey);
                task = getAutoControlTask();
                if (!task) return;
                if (!task.paused) heartbeatQuietUntilRef.current = Date.now() + AUTO_CONTROL_PING_INTERVAL;
            }
            const now = Date.now();
            const automaticCallBusy = automaticGuideInFlightRef.current.size > 0
                || Object.values(store.getState().brainstorm.automaticGuide.calls).some(call => call.status === 'running');
            if (voiceBusyRef.current || automaticCallBusy
                || (!running && (getExecutingNavigationAction() || getExecutingNavigationScroll()))
                || chatHistoryRef.current.some(m => m.streaming && !m.id.startsWith('auto-control-heartbeat-')
                    && !(running && m.automaticGuideCallId === 'creation-progress'))) {
                heartbeatAbortRef.current?.abort();
                heartbeatQuietUntilRef.current = now + AUTO_CONTROL_PING_INTERVAL;
                return;
            }
            if (task.paused) {
                return;
            }
            lastProgressKey = currentProgressKey;
            const maxUnchangedChecks = 1;
            const fullscreen = !!store.getState().brainstorm.userSnapshot.feeds?.activeAreaIds.some(id => id.startsWith('clikb.feeds.fullscreen.'));
            let wake = shouldWakeAutoControlHeartbeat({
                task, now, running, quietUntil: heartbeatQuietUntilRef.current, lastPingAt, lastRunRevision,
                currentSnapshotKey, lastSnapshotKey, unchangedChecks, maxUnchangedChecks, fullscreen,
                streaming: chatHistoryRef.current.some(m => m.streaming),
            });
            if (wake.resetUnchangedChecks) unchangedChecks = 0;
            if (wake.shouldResumeOnSnapshotChange) {
                resumeAutoControlTask(currentSnapshotKey);
                task = getAutoControlTask();
                if (!task) return;
                wake = shouldWakeAutoControlHeartbeat({
                    task, now, running, quietUntil: heartbeatQuietUntilRef.current, lastPingAt, lastRunRevision,
                    currentSnapshotKey, lastSnapshotKey, unchangedChecks, maxUnchangedChecks, fullscreen,
                    streaming: chatHistoryRef.current.some(m => m.streaming),
                });
            }
            const recurringTask = wake.isTimedTask;
            if (!wake.shouldWake) return;
            running = true;
            lastRunRevision = task.revision;
            lastPingAt = now;
            lastSnapshotKey = currentSnapshotKey;
            unchangedChecks += 1;
            const controller = new AbortController();
            heartbeatAbortRef.current = controller;
            void fullAppVoiceAsk(autoControlPingMessage(now), controller.signal, undefined,
                { autoControlHeartbeat: true, hideTriggerMessage: true, skipMemoryRollup: true })
                .then(async (reply) => {
                    if (!controller.signal.aborted && reply?.trim()) {
                        queueAutomaticAnnouncement(reply, 'auto-control-heartbeat', controller.signal);
                    }
                })
                .catch(() => undefined).finally(() => {
                    running = false;
                    const currentTask = getAutoControlTask();
                    if (controller.signal.aborted && currentTask?.goal === task.goal && currentTask.revision === lastRunRevision) {
                        resumeAutoControlTask();
                    } else if (!recurringTask && currentTask?.revision === lastRunRevision) {
                        idleAutoControlTask();
                    }
                    heartbeatQuietUntilRef.current = Date.now() + AUTO_CONTROL_PING_INTERVAL;
                    if (heartbeatAbortRef.current === controller) heartbeatAbortRef.current = null;
                });
        }, 500);
        return () => { clearInterval(timer); unsubscribe(); heartbeatAbortRef.current?.abort(); };
    }, [fullAppVoiceAsk, queueAutomaticAnnouncement]);

    const runAutomaticGuideCall = useCallback(async ({
        callId,
        message,
        runOncePerReload,
    }: AutomaticGuideCallRequest): Promise<string> => {
        const cleanCallId = String(callId || '').trim();
        const cleanMessage = String(message || '').trim();
        const callEnabled = automaticGuide.callOverrides[cleanCallId] !== false;
        const creationCall = ['creation-progress', 'scene-generation-double-check', 'character-list-audit'].includes(cleanCallId);
        const controlSettings = store.getState().settings;

        if (
            !cleanCallId
            || !cleanMessage
            || !guideEnabled
            || !automaticGuide.enabled
            || !callEnabled
            || (creationCall && !allowCreationProgressAnnouncement(store.getState().brainstorm.userSnapshot.creation?.projectId))
            || (creationCall && (!controlSettings.autoControlEnabled || !controlSettings.autoControlVisible))
            || (runOncePerReload && (automaticGuide.calls[cleanCallId]?.attempts || 0) > 0)
            || isChatOpen
            || automaticGuideInFlightRef.current.size > 0
            || voiceBusyRef.current
            || chatHistoryRef.current.some(message => message.streaming)
        ) {
            return '';
        }

        const controller = new AbortController();
        automaticGuideControllersRef.current.set(cleanCallId, controller);
        automaticGuideInFlightRef.current.add(cleanCallId);
        heartbeatAbortRef.current?.abort();
        heartbeatQuietUntilRef.current = Date.now() + AUTO_CONTROL_PING_INTERVAL;
        dispatch(automaticGuideCallStarted({
            callId: cleanCallId,
            triggeredAt: Date.now(),
        }));

        try {
            const reply = await fullAppVoiceAsk(
                cleanMessage,
                controller.signal,
                undefined,
                {
                    automaticGuideCallId: cleanCallId,
                    hideTriggerMessage: true,
                    skipMemoryRollup: true,
                },
            );
            if (!reply.trim()) {
                throw new Error('Automatic Guide returned an empty response');
            }
            queueAutomaticAnnouncement(reply, cleanCallId, controller.signal);
            dispatch(automaticGuideCallSucceeded({
                callId: cleanCallId,
                completedAt: Date.now(),
            }));
            return reply;
        } catch (error: any) {
            setChatHistory(previous => previous.filter(messageItem =>
                !(messageItem.automaticGuideCallId === cleanCallId && messageItem.streaming)));
            const cancelled = controller.signal.aborted
                || error?.name === 'AbortError'
                || error?.name === 'CanceledError'
                || error?.code === 'ERR_CANCELED';
            dispatch(cancelled
                ? automaticGuideCallCancelled({ callId: cleanCallId, completedAt: Date.now() })
                : automaticGuideCallFailed({
                    callId: cleanCallId,
                    completedAt: Date.now(),
                    error: error?.message || 'Automatic Guide request failed',
                }));
            if (!cancelled) console.error(`Automatic Guide call "${cleanCallId}" failed:`, error);
            return '';
        } finally {
            automaticGuideControllersRef.current.delete(cleanCallId);
            automaticGuideInFlightRef.current.delete(cleanCallId);
            heartbeatQuietUntilRef.current = Date.now() + AUTO_CONTROL_PING_INTERVAL;
            resumeAutoControlTask();
        }
    }, [automaticGuide.callOverrides, automaticGuide.calls, automaticGuide.enabled, dispatch, fullAppVoiceAsk, guideEnabled, isChatOpen, queueAutomaticAnnouncement, setChatHistory]);

    const cancelAutomaticGuideCall = useCallback((callId: string) => {
        const cleanCallId = String(callId || '').trim();
        if (!cleanCallId) return;
        automaticGuideControllersRef.current.get(cleanCallId)?.abort();
        automaticSpeechCancelRef.current?.();
    }, []);

    const runUserTurnWithMilestones = useCallback(async (
        text: string,
        signal?: AbortSignal,
        stream?: BrainstormVoiceStreamCallbacks,
        useOverride = false,
    ): Promise<string> => {
        milestoneCommentaryAbortRef.current?.abort();
        automaticSpeechCancelRef.current?.();
        const queue = conciergeEventQueueRef.current;
        const userBatch = queue?.takeForUserTurn(Date.now()) || null;
        let deliveredText = '';
        const wrappedStream: BrainstormVoiceStreamCallbacks = {
            onTextDelta: (delta) => {
                deliveredText += delta;
                stream?.onTextDelta?.(delta);
            },
            onFinalText: (finalText) => {
                stream?.onFinalText?.(finalText);
            },
        };
        try {
            const override = useOverride ? voiceAskOverrideRef.current : null;
            const reply = override
                ? await override(
                    text,
                    signal,
                    wrappedStream,
                    userBatch ? { pendingMilestoneEvents: userBatch.events, milestoneBatchId: userBatch.batchId } : undefined,
                )
                : await fullAppVoiceAsk(
                    text,
                    signal,
                    wrappedStream,
                    userBatch ? { pendingMilestoneEvents: userBatch.events, milestoneBatchId: userBatch.batchId } : {},
                );
            if (userBatch && queue) {
                queue.resolveBatch(userBatch.batchId, {
                    deliveredText: reply || deliveredText,
                    completedCleanly: !signal?.aborted,
                });
            }
            return reply;
        } catch (error) {
            if (userBatch && queue) {
                queue.resolveBatch(userBatch.batchId, {
                    deliveredText,
                    completedCleanly: false,
                });
            }
            throw error;
        }
    }, [fullAppVoiceAsk]);

    const textAskAbortRef = useRef<AbortController | null>(null);
    const sharedVoiceAsk = useCallback((text: string, signal?: AbortSignal, stream?: BrainstormVoiceStreamCallbacks) => {
        textAskAbortRef.current?.abort();
        return runUserTurnWithMilestones(text, signal, stream, true);
    }, [runUserTurnWithMilestones]);


    const textAsk = useCallback(async (text: string, signal?: AbortSignal) => {
        textAskAbortRef.current?.abort();
        const controller = new AbortController();
        textAskAbortRef.current = controller;
        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        try {
            return await runUserTurnWithMilestones(text, controller.signal, undefined, false);
        } catch (err: any) {
            if (!signal?.aborted && (controller.signal.aborted || err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED')) return '';
            throw err;
        } finally {
            if (textAskAbortRef.current === controller) textAskAbortRef.current = null;
        }
    }, [runUserTurnWithMilestones]);

    const voice = useGeminiVoice({
        clikUrl,
        callBrain: sharedVoiceAsk,
        ttsVoice: selectedVoice,
    });

    guidePlayModeSpeakTextRef.current = voice.speakText;
    automaticSpeechQueueRef.current = voice.queueAutomaticSpeech;
    automaticSpeechCancelRef.current = voice.cancelAutomaticSpeech;
    voiceActiveRef.current = voice.active;

    const voiceStopRef = useRef(voice.stop);
    // TTS startup also reports "thinking". Only accepted user input/model work
    // owns control scheduling; playback has its own arbitration in the voice hook.
    voiceBusyRef.current = voice.inputPending;
    voiceOutputOrInputBusyRef.current = Boolean(
        voice.inputPending || voice.status === 'thinking' || voice.status === 'speaking',
    );

    useEffect(() => {
        if (!conciergeEventQueueRef.current) {
            conciergeEventQueueRef.current = new ConciergeEventQueue(store.getState().brainstorm.userSnapshot);
        }
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            const queue = conciergeEventQueueRef.current;
            if (!queue) return;
            const now = Date.now();
            const state = store.getState();
            queue.observe(state.brainstorm.userSnapshot, now);

            // Autonomous milestone commentary is an Auto Control behavior.
            // When Auto Control is OFF, autonomous commentary and unprompted LLM calls are disabled.
            // Ordinary direct conversation (user clicks mic or types) continues to have full live snapshot visibility.
            const autoControlActive = Boolean(
                state.settings.autoControlEnabled
                && state.settings.conciergeEnabled,
            );
            if (!autoControlActive) {
                return;
            }

            const activeTask = getAutoControlTask();
            const activeTaskDrivingUi = Boolean(
                state.settings.autoControlEnabled
                && state.settings.autoControlVisible
                && activeTask
                && !activeTask.paused,
            );
            const batch = queue.takeDueBatch(now, {
                voiceOutputOrInputBusy: voiceOutputOrInputBusyRef.current,
                streaming: chatHistoryRef.current.some((message) => message.streaming),
                chatOpen: isChatOpen,
                guideEnabled: guideEnabledRef.current,
                automaticEnabled: state.brainstorm.automaticGuide.enabled,
                autoControlEnabled: autoControlActive,
                activeTaskDrivingUi,
            });
            if (!batch) return;

            const controller = new AbortController();
            milestoneCommentaryAbortRef.current = controller;
            let deliveredText = '';
            let speechStarted = false;

            void fullAppVoiceAsk(
                buildMilestoneObservationPrompt(batch),
                controller.signal,
                {
                    onTextDelta: (delta) => {
                        deliveredText += delta;
                    },
                },
                {
                    conciergeObservationTurn: true,
                    pendingMilestoneEvents: batch.events,
                    milestoneBatchId: batch.batchId,
                    hideTriggerMessage: true,
                    skipMemoryRollup: true,
                },
            ).then((reply) => {
                if (controller.signal.aborted) {
                    queue.resolveBatch(batch.batchId, {
                        deliveredText,
                        speechStarted,
                        completedCleanly: false,
                        now: Date.now(),
                    });
                    return;
                }
                const cleanReply = String(reply || '').trim();
                if (!cleanReply) {
                    queue.resolveBatch(batch.batchId, {
                        deliveredText: '',
                        speechStarted: false,
                        completedCleanly: true,
                        suppressedNoUpdate: true,
                        now: Date.now(),
                    });
                    return;
                }
                queueAutomaticAnnouncement(cleanReply, 'concierge-milestone', controller.signal, () => {
                    speechStarted = true;
                });
                queue.resolveBatch(batch.batchId, {
                    deliveredText: cleanReply,
                    speechStarted,
                    completedCleanly: true,
                    now: Date.now(),
                });
            }).catch(() => {
                queue.resolveBatch(batch.batchId, { deliveredText, speechStarted, completedCleanly: false, failed: !controller.signal.aborted, now: Date.now() });
                if (false)
                queue.resolveBatch(batch.batchId, {
                    deliveredText,
                    speechStarted,
                    completedCleanly: false,
                    now: Date.now(),
                });
            }).finally(() => {
                if (milestoneCommentaryAbortRef.current === controller) {
                    milestoneCommentaryAbortRef.current = null;
                }
            });
        }, 400);

        return () => {
            window.clearInterval(timer);
            milestoneCommentaryAbortRef.current?.abort();
        };
    }, [fullAppVoiceAsk, isChatOpen, queueAutomaticAnnouncement]);

    useEffect(() => {
        voiceStopRef.current = voice.stop;
    }, [voice.stop]);

    useEffect(() => {
        return () => voiceStopRef.current();
    }, []);

    // Programmatic greeting: used when the user reopens the circle from the "AI"
    // nub. Reuses the existing brain path + speakText — no new turn logic.
    // Fires on every nub open; the in-flight guard only blocks overlapping greets.
    // Never throws to caller.
    const greetViaVoice = useCallback(async (text: string = 'hi'): Promise<void> => {
        if (greetInFlightRef.current) return;
        greetInFlightRef.current = true;
        try {
            const reply = await sharedVoiceAsk(text);
            const spoken = (reply || '').trim();
            if (spoken) await voice.speakText(spoken);
        } catch (err) {
            console.error('Brainstorm greet failed:', err);
        } finally {
            greetInFlightRef.current = false;
        }
    }, [sharedVoiceAsk, voice]);

    const takePendingMilestonesForTurn = useCallback((): ConciergeMilestoneBatch | null => {
        milestoneCommentaryAbortRef.current?.abort();
        automaticSpeechCancelRef.current?.();
        const queue = conciergeEventQueueRef.current;
        if (!queue) return null;
        queue.observe(store.getState().brainstorm.userSnapshot, Date.now());
        return queue.takeForUserTurn(Date.now());
    }, []);

    const resolveMilestoneBatch = useCallback((batchId: string, resolution: ConciergeBatchResolution): void => {
        conciergeEventQueueRef.current?.resolveBatch(batchId, resolution);
    }, []);

    const value = useMemo<BrainstormSessionContextValue>(() => ({
        chatHistory,
        setChatHistory,
        chatHistoryRef,
        memorySlots,
        memorySlotsRef,
        get userSnapshot() {
            return store.getState().brainstorm.userSnapshot;
        },
        sessionIdentity,
        buildBrainstormPayload,
        noteMemoryAfterAssistant,
        clearBrainstormSession,
        voice,
        setVoiceAskHandler,
        greetViaVoice,
        textAsk,
        runAutomaticGuideCall,
        cancelAutomaticGuideCall,
        guideEnabled,
        setGuideEnabled,
        guidePlayMode,
        setGuidePlayMode,
        guidePanelState,
        setGuidePanelState,
        hasGuideUseTarget: guideUseTargetMeta !== null,
        guideUseTargetLabel: guideUseTargetMeta?.label || '',
        registerGuideUseTarget,
        appendGuideTextToTarget,
        isGuideInlineHostActive: guideInlineHostCount > 0,
        registerGuideInlineHost,
        syncCreationMemoryCards,
        waitForCreationMemorySync,
        creationMemoryUnsyncedCardKeys,
        takePendingMilestonesForTurn,
        resolveMilestoneBatch,
    }), [chatHistory, memorySlots, sessionIdentity, setChatHistory, buildBrainstormPayload, noteMemoryAfterAssistant, clearBrainstormSession, voice, setVoiceAskHandler, greetViaVoice, textAsk, runAutomaticGuideCall, cancelAutomaticGuideCall, guideEnabled, setGuideEnabled, guidePlayMode, setGuidePlayMode, guidePanelState, guideUseTargetMeta, guideInlineHostCount, registerGuideUseTarget, appendGuideTextToTarget, registerGuideInlineHost, syncCreationMemoryCards, waitForCreationMemorySync, creationMemoryUnsyncedCardKeys, takePendingMilestonesForTurn, resolveMilestoneBatch]);

    return (
        <BrainstormSessionContext.Provider value={value}>
            <SharedBackControl />
            {children}
        </BrainstormSessionContext.Provider>
    );
};

export const useBrainstormSession = (): BrainstormSessionContextValue => {
    const ctx = useContext(BrainstormSessionContext);
    if (!ctx) {
        throw new Error('useBrainstormSession must be used inside BrainstormSessionProvider');
    }
    return ctx;
};
