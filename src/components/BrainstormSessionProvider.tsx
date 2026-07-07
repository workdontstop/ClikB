import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChatMessage } from '../PromptConstructorMock';
import { useGeminiVoice } from '../hooks/useGeminiVoice';
import { AppDispatch, RootState } from '../store';
import {
    addBrainstormMemorySlot,
    resetBrainstormSession,
    setBrainstormChatHistory,
    type BrainstormMemorySlot,
    type UserSnapshot,
} from '../brainstormSlice';

type BrainstormRole = 'user' | 'assistant' | 'system';

type BrainstormPayloadMessage = {
    role: BrainstormRole;
    content: string;
};

type BuildPayloadResult = {
    messages: BrainstormPayloadMessage[];
    memorySlots: BrainstormMemorySlot[];
    userSnapshot: UserSnapshot;
};

type BrainstormVoiceAskHandler = (text: string, signal?: AbortSignal) => Promise<string>;
type BrainstormVoiceController = ReturnType<typeof useGeminiVoice>;

type BrainstormSessionContextValue = {
    chatHistory: ChatMessage[];
    setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatHistoryRef: React.MutableRefObject<ChatMessage[]>;
    memorySlots: BrainstormMemorySlot[];
    memorySlotsRef: React.MutableRefObject<BrainstormMemorySlot[]>;
    userSnapshot: UserSnapshot;
    buildBrainstormPayload: (currentUserText: string, historyOverride?: ChatMessage[]) => BuildPayloadResult;
    noteMemoryAfterAssistant: (committedHistory: ChatMessage[]) => Promise<void>;
    clearBrainstormSession: () => void;
    voice: BrainstormVoiceController;
    setVoiceAskHandler: (handler: BrainstormVoiceAskHandler | null) => void;
    greetViaVoice: (text?: string) => Promise<void>;
    // Typed questions from the floating label's text mode. Same full-app brain
    // path and chatHistory bookkeeping as voice turns, but never autoplays TTS.
    textAsk: (text: string, signal?: AbortSignal) => Promise<string>;
};

const SLOT_SIZE_COMPLETED_TURNS = 8;
const MEMORY_INDEX_LIMIT = 50;

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

const renderMemoryIndex = (slots: BrainstormMemorySlot[]): string => {
    const visible = slots.slice(-MEMORY_INDEX_LIMIT);
    if (!visible.length) return '';

    return [
        'SESSION MEMORY INDEX (title only to save tokens).',
        'These are locked summaries from earlier in this Brainstorm session.',
        'If the user refers to older context that is not clear from the recent raw tail, call getMemory with the relevant slot IDs before answering.',
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
    const userSnapshot = useSelector((state: RootState) => state.brainstorm.userSnapshot);
    const prompt = useSelector((state: RootState) => state.settings.prompt);
    const artstyle = useSelector((state: RootState) => state.settings.artstyle);
    const model = useSelector((state: RootState) => state.settings.model);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const chatHistoryRef = useRef<ChatMessage[]>(chatHistory);
    const memorySlotsRef = useRef<BrainstormMemorySlot[]>(memorySlots);
    const userSnapshotRef = useRef<UserSnapshot>(userSnapshot);
    const rollupInFlightRef = useRef(false);
    const greetInFlightRef = useRef(false);
    const voiceAskOverrideRef = useRef<BrainstormVoiceAskHandler | null>(null);
    const voiceContextRef = useRef({
        pathname: location.pathname,
        prompt,
        artstyle,
        model,
        loggedUserName: loggedUser?.username || loggedUser?.name || 'Guest',
    });

    useEffect(() => {
        chatHistoryRef.current = chatHistory;
    }, [chatHistory]);

    useEffect(() => {
        memorySlotsRef.current = memorySlots;
    }, [memorySlots]);

    useEffect(() => {
        userSnapshotRef.current = userSnapshot;
    }, [userSnapshot]);

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
        const unsummarizedRaw = completedTurns.slice(lastLockedTurn).flat();
        messages.push(...unsummarizedRaw.map(toPayloadMessage));
        messages.push({ role: 'user', content: currentUserText });

        return {
            messages,
            memorySlots: slots.slice(-MEMORY_INDEX_LIMIT),
            userSnapshot: userSnapshotRef.current,
        };
    }, []);

    const noteMemoryAfterAssistant = useCallback(async (committedHistory: ChatMessage[]) => {
        if (!clikUrl || rollupInFlightRef.current) return;

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ turns: turnSlice, slotId, turnStart, turnEnd }),
            });
            if (!response.ok) throw new Error(`memory summarize ${response.status}`);
            const data = await response.json();
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
        }
    }, [clikUrl, dispatch]);

    const clearBrainstormSession = useCallback(() => {
        chatHistoryRef.current = [];
        memorySlotsRef.current = [];
        dispatch(resetBrainstormSession());
    }, [dispatch]);

    const setVoiceAskHandler = useCallback((handler: BrainstormVoiceAskHandler | null) => {
        voiceAskOverrideRef.current = handler;
    }, []);

    const fullAppVoiceAsk = useCallback(async (userText: string, signal?: AbortSignal): Promise<string> => {
        const text = (userText || '').trim();
        if (!text) return '';

        const ctx = voiceContextRef.current;
        const historyBeforeTurn = chatHistoryRef.current;
        const userMsg: ChatMessage = { id: `global-voice-user-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
        setChatHistory(prev => [...prev, userMsg]);

        const payload = buildBrainstormPayload(text, historyBeforeTurn);
        console.log('[Brainstorm userSnapshot] global voice request', payload.userSnapshot);
        const fullAppContext = {
            role: 'system' as const,
            content: [
                'You are in ClikB full app voice mode.',
                'There is no visible chat box in this mode, only a small hollow voice circle.',
                'Do not assume the user is in memes, story, games, or prompt-constructor mode unless the context says so.',
                'Answer naturally for spoken conversation and keep replies concise enough to be spoken aloud.',
                `Current route: ${ctx.pathname || '/'}.`,
                `Current user: ${ctx.loggedUserName}.`,
                ctx.prompt ? `Current app prompt/draft text: ${ctx.prompt}` : '',
                ctx.artstyle ? `Current art style setting: ${ctx.artstyle}` : '',
                ctx.model ? `Current model setting: ${ctx.model}` : '',
            ].filter(Boolean).join('\n'),
        };

        const response = await axios.post(`${clikUrl}/startBrainstorm`, {
            messages: [fullAppContext, ...payload.messages],
            memorySlots: payload.memorySlots,
            userSnapshot: payload.userSnapshot,
            webSearch: false,
        }, { signal } as any);

        const reply = cleanVoiceReply((response.data as any)?.reply || '');
        const aiMsg: ChatMessage = { id: `global-voice-ai-${Date.now() + 1}`, role: 'ai', content: reply, timestamp: Date.now() };
        setChatHistory(prev => [...prev, aiMsg]);
        void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg]);
        return reply;
    }, [buildBrainstormPayload, clikUrl, noteMemoryAfterAssistant, setChatHistory]);

    const sharedVoiceAsk = useCallback((text: string, signal?: AbortSignal) => {
        const override = voiceAskOverrideRef.current;
        return override ? override(text, signal) : fullAppVoiceAsk(text, signal);
    }, [fullAppVoiceAsk]);

    const voice = useGeminiVoice({
        clikUrl,
        callBrain: sharedVoiceAsk,
        ttsVoice: selectedVoice,
    });

    const voiceStopRef = useRef(voice.stop);

    useEffect(() => {
        voiceStopRef.current = voice.stop;
    }, [voice.stop]);

    useEffect(() => {
        return () => voiceStopRef.current();
    }, []);

    // Programmatic greeting: used when the user reopens the circle from the "AI"
    // nub. Reuses the existing brain path + speakText â€” no new turn logic.
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

    const value = useMemo<BrainstormSessionContextValue>(() => ({
        chatHistory,
        setChatHistory,
        chatHistoryRef,
        memorySlots,
        memorySlotsRef,
        userSnapshot,
        buildBrainstormPayload,
        noteMemoryAfterAssistant,
        clearBrainstormSession,
        voice,
        setVoiceAskHandler,
        greetViaVoice,
        textAsk: fullAppVoiceAsk,
    }), [chatHistory, memorySlots, userSnapshot, setChatHistory, buildBrainstormPayload, noteMemoryAfterAssistant, clearBrainstormSession, voice, setVoiceAskHandler, greetViaVoice, fullAppVoiceAsk]);

    return (
        <BrainstormSessionContext.Provider value={value}>
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
