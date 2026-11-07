import { isOpenAiConversationProfile } from '../conversationModels';
import { acceptConciergeDelta } from '../conciergeAnnouncements';
import { handleConciergeMeteredBillingEvent } from '../pixelBillingClient';
// src/components/PromptConstructor.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Typography, Button, Modal } from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import {
    ChatMessage,
    getAIResponse,
    ShowcaseMode,
    Template,
} from '../PromptConstructorMock';
import { useDebounce } from '../hooks/useDebounce';
import { TemplateLibrary, TEMPLATE_LIBRARY_Z_INDEX, type TemplateLibraryHandle } from './TemplateGallery';
import { BrainstormChat } from './BrainstormChat';
import type { MusicPanelConfig } from './MusicScenePanel';
import { useBrainstormSession } from './BrainstormSessionProvider';
import { ImagePreview } from './ImagePreview';
import axios from 'axios';
import { recordGeneratedImageModel } from '../imageResultProvenance';
import { imageModelForGenerationRoute } from '../imageModels';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, store } from '../store';
import { setArtstyle } from '../settingsSlice';
import { setBrainstormChatOpen } from '../brainstormSlice';
import { matchMobile } from '../DetectDevice';
import { handleNavigationBrowserRequest } from '../navigationBrowserControl';
import { autoControlRequestContext, autoControlSnapshotKey, clearPendingAutoControlUserTurn, noteAutoControlGateStage } from '../autoControlContinuation';
import { conversationMeasurementHeaders } from '../conversationMeasurementSession';
import { PreviewImageRequests } from '../previewImageRequests';

import PsychologyIcon from '@mui/icons-material/Psychology';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
export interface ImageGenCache {
    text: string;
    imageUrl: string | null;
    ratio?: number;
}

type Mode = 'template' | 'brainstorm' | 'preview';
const NOTEPAD_TYPED_PREVIEW_LINK_MODE = true;

interface Props {
    darkMode: boolean;
    onInjectText: (text: string, oldText?: string) => void;
    currentNotepadText: string;
    onLoadingChange?: (isLoading: boolean) => void;
    containerHeight?: number;
    onImageGenerated?: (imageUrl: string | null) => void;
    onImageClear?: () => void;
    previewActive?: boolean;
    showTemplates?: boolean;
    cachedImageGen?: ImageGenCache;
    previewRequests?: PreviewImageRequests<{ data: any }>;
    onUpdateCachedImageGen?: (data: ImageGenCache) => void;
    // Lifted Props
    templates: Template[];
    onFetchTemplates: () => void;
    hasMoreTemplates: boolean;
    onTemplateCreated: () => void;
    onDeleteTemplate: (template: Template) => void;
    onToggleTemplateShowcase: (template: Template, mode: ShowcaseMode) => Promise<void>;
    /** Current notepad mode (mirrors PromptInput `type`): 0 scenes/memes, 1 story, 3 interactions. */
    notepadType?: number;
    /**
     * Music-video scene breakdown, present only while music mode is active with a
     * track selected. Forwarded to the brainstorm chat so a music video can be
     * planned (and its segments previewed) without closing the assistant.
     */
    musicPanel?: MusicPanelConfig;
    /** Notifies the parent when the brainstorm chat is open (for height + close guarding). */
    onBrainstormOpenChange?: (open: boolean) => void;
    /** Notifies the parent when the template list is open (for height only). */
    onTemplateLibraryOpenChange?: (open: boolean) => void;
}

const PromptConstructor = React.memo<Props>(({
    darkMode, onInjectText, currentNotepadText, onLoadingChange, containerHeight,
    onImageGenerated, onImageClear, previewActive = false, showTemplates,
    cachedImageGen, onUpdateCachedImageGen, previewRequests: sharedPreviewRequests,
    templates, onFetchTemplates, hasMoreTemplates, onTemplateCreated,
    onDeleteTemplate, onToggleTemplateShowcase, notepadType, musicPanel, onBrainstormOpenChange, onTemplateLibraryOpenChange
}) => {
    const dispatch = useDispatch();
    const [mode, setMode] = useState<Mode>('template');
    // LOCAL STATE FOR TEMPLATES REMOVED - Using props instead
    const [isAIEnabled, setIsAIEnabled] = useState(true);
    const [brainstormInitialView, setBrainstormInitialView] = useState<'chat' | 'finalize'>('chat');

    useEffect(() => {
        const handleOpenBrainstormEvent = (e: any) => {
            const detail = e.detail || {};
            setMode('brainstorm');
            setIsTemplateLibraryOpen(false);
            if (typeof detail.isAIEnabled === 'boolean') {
                setIsAIEnabled(detail.isAIEnabled);
            }
            if (detail.view) setBrainstormInitialView(detail.view);
            if (typeof detail.title === 'string') setManualName(detail.title);
            if (typeof detail.prompt === 'string') setManualPrompt(detail.prompt);
            if (typeof detail.artStyle === 'string') setManualArtStyle(detail.artStyle);
        };
        window.addEventListener('clikb-open-brainstorm', handleOpenBrainstormEvent);
        return () => {
            window.removeEventListener('clikb-open-brainstorm', handleOpenBrainstormEvent);
        };
    }, []);
    const {
        chatHistory,
        setChatHistory,
        chatHistoryRef,
        buildBrainstormPayload,
        noteMemoryAfterAssistant,
        waitForCreationMemorySync,
        takePendingMilestonesForTurn,
        resolveMilestoneBatch,
        voice,
    } = useBrainstormSession();
    // Web search toggle: OFF = fast token streaming, ON = web search (typed out).
    const [webSearch, setWebSearch] = useState(false);

    // Live refs so voiceAsk always reads the freshest mode and web-search flag.
    // Chat history now comes from the shared Brainstorm session provider.
    const notepadTypeRef = useRef<number | undefined>(notepadType);
    const webSearchRef = useRef<boolean>(false);
    useEffect(() => { notepadTypeRef.current = notepadType; }, [notepadType]);
    useEffect(() => { webSearchRef.current = webSearch; }, [webSearch]);

    // Tell the parent (Notepad) when brainstorm is open, so it can grow the
    // dialog to ~90vh and block accidental backdrop/Esc close that would wipe the chat.
    useEffect(() => {
        const isOpen = mode === 'brainstorm';
        onBrainstormOpenChange?.(isOpen);
        dispatch(setBrainstormChatOpen(isOpen));
        return () => {
            dispatch(setBrainstormChatOpen(false));
        };
    }, [mode, onBrainstormOpenChange, dispatch]);

    const [currentInput, setCurrentInput] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
    const templateGalleryRef = useRef<TemplateLibraryHandle | null>(null);
    const [manualArtStyle, setManualArtStyle] = useState('');

    // Tell the parent when the template list is open, so the dialog grows to
    // ~90vh and the full template images are visible (height only — no close guard).
    // Declared after isTemplateLibraryOpen so it isn't read before initialization.
    useEffect(() => {
        onTemplateLibraryOpenChange?.(mode === 'template' && !!showTemplates && isTemplateLibraryOpen);
    }, [mode, showTemplates, isTemplateLibraryOpen, onTemplateLibraryOpenChange]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualPrompt, setManualPrompt] = useState('');

    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
    const activeTemplateTextRef = useRef<string>('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [prototypeWarningTarget, setPrototypeWarningTarget] = useState<'brainstorm' | Template | null>(null);

    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? '#E8BAFA' : '#0099cc');
    const appColorDeep = darken(appColor, 0.18);
    const appColorHover = darken(appColor, 0.08);

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;
    const ratioKey = useSelector((state: RootState) => state.settings.aspectRatio);
    const pixels = useSelector((state: RootState) => state.settings.pixels);
    const conversationModel = useSelector((state: RootState) => state.settings.conversationModel);
    const conversationSupportsOnlineAccess = isOpenAiConversationProfile(conversationModel);
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
    const previewRequestIdRef = useRef(0);
    const previewRequestsRef = useRef(new PreviewImageRequests<any>());
    const previewRequests = sharedPreviewRequests || previewRequestsRef.current;
    const previewCallbacks = useRef({ cachedImageGen, onImageGenerated, onImageClear, onUpdateCachedImageGen });
    previewCallbacks.current = { cachedImageGen, onImageGenerated, onImageClear, onUpdateCachedImageGen };
    const previewPixels = useRef(pixels); previewPixels.current = pixels;
    const canAffordPreview = pixels >= 1;

    useEffect(() => {
        if (conversationSupportsOnlineAccess) return;
        setWebSearch(false);
        webSearchRef.current = false;
    }, [conversationSupportsOnlineAccess]);
    // Use a default seed or specific one if needed
    const seed = 100;

    // Debounce the notepad text for image generation (10 seconds)
    const debouncedText = useDebounce(currentNotepadText, 10000);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    useEffect(() => {
        onLoadingChange?.(isGenerating);
    }, [isGenerating, onLoadingChange]);

    useEffect(() => {
        if (!currentNotepadText.trim()) {
            setPreviewImage(null);
            if (mode === 'preview') setMode('template');
        }
    }, [currentNotepadText, mode]);

    // Trigger image generation when debounced text changes
    useEffect(() => {
        const requestId = ++previewRequestIdRef.current;
        const callbacks = () => previewCallbacks.current;
        const requestKey = JSON.stringify([CLIK_URL, debouncedText.trim(), ratioKey, seed]);

        if (!previewActive || !debouncedText.trim() || mode === 'brainstorm') {
            setIsGenerating(false);
            return;
        }

        // CHECK PARENT CACHE: If text and ratio match, use parent's cached URL
        const cached = callbacks().cachedImageGen;
        if (cached && cached.text === debouncedText.trim() && cached.imageUrl && cached.ratio === ratioKey) {

            // Optional: verify ratio if provided in cache (user primarily said text/url, but ratio serves similar purpose)
            // If cached ratio exists and differs, we should ideally regen, but user emphasized text equality.
            // We'll trust text equality for now as primary key.

            console.log('[PromptConstructor] Using LIFTED cached image for:', debouncedText.slice(0, 20));
            if (requestId !== previewRequestIdRef.current) return;
            setIsGenerating(false);
            setPreviewImage(cached.imageUrl);
            callbacks().onImageGenerated?.(cached.imageUrl);
            return;
        }

        const generateImage = async () => {
            if (previewPixels.current < 1 && !previewRequests.has(requestKey)) { setIsGenerating(false); return; }
            setIsGenerating(true);
            try {
                const payload = {
                    inputs: debouncedText,
                    width: 1080,
                    height: 1920,
                    guidance: 7.5,
                    num_inference_steps: 35,
                    seed: seed,
                    ty: ratioKey,
                    linkmode: NOTEPAD_TYPED_PREVIEW_LINK_MODE,
                    billingAction: "preview-image",
                };

                const response = await previewRequests.run(requestKey, async () => await axios.post(`${CLIK_URL}/fluxschnell`, payload));

                if (requestId !== previewRequestIdRef.current) return;

                const responseData = response.data as any;
                const returnedImage = NOTEPAD_TYPED_PREVIEW_LINK_MODE
                    ? responseData?.imageUrl
                    : responseData?.imageBase64;
                if (returnedImage) {
                    let finalImage = String(returnedImage);
                    if (!NOTEPAD_TYPED_PREVIEW_LINK_MODE && !finalImage.startsWith('data:image')) {
                        finalImage = `data:image/png;base64,${finalImage}`;
                    }
                    const imageUrl = finalImage;
                    recordGeneratedImageModel(imageModelForGenerationRoute('fluxschnell', responseData?.model), [imageUrl]);

                    // UPDATE PARENT CACHE
                    if (callbacks().onUpdateCachedImageGen) {
                        callbacks().onUpdateCachedImageGen!({
                            text: debouncedText.trim(),
                            imageUrl: imageUrl,
                            ratio: ratioKey
                        });
                    }

                    setPreviewImage(imageUrl);
                    callbacks().onImageGenerated?.(imageUrl);
                    // Only switch internal mode if not handled externally
                    if (!callbacks().onImageGenerated) {
                        setMode('preview');
                    }
                } else {
                    setPreviewImage(null);
                    callbacks().onImageGenerated?.(null);
                    callbacks().onImageClear?.();
                }
            } catch (error: any) {
            if (typeof turnController !== 'undefined' && (turnController.signal.aborted || error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED')) {
                if (typeof aiMsgId !== 'undefined') { setChatHistory(prev => prev.filter(message => message.id !== aiMsgId || Boolean(message.content?.trim()))); return; }
                return;
            }
                if (requestId !== previewRequestIdRef.current) return;
                if ((error as Error).name === 'AbortError') return;
                console.error("Image generation failed:", error);
                // Optional: Show error state
            } finally {
                if (requestId === previewRequestIdRef.current) {
                    setIsGenerating(false);
                }
            }
        };

        generateImage();
        return () => { if (requestId === previewRequestIdRef.current) ++previewRequestIdRef.current; };
    }, [debouncedText, ratioKey, previewActive, mode, canAffordPreview, CLIK_URL, previewRequests]);

    const executeTemplateSelect = useCallback((template: Template) => {
        console.log("Selected Template Object:", template);
        const oldText = activeTemplateId ? activeTemplateTextRef.current : undefined;
        setActiveTemplateId(template.id);
        activeTemplateTextRef.current = template.basePrompt;
        onInjectText(template.basePrompt, oldText);

        if (template.artStyle) {
            dispatch(setArtstyle(template.artStyle));
        }
    }, [activeTemplateId, onInjectText, dispatch]);

    const handleTemplateSelect = useCallback((template: Template) => {
        executeTemplateSelect(template);
        setIsTemplateLibraryOpen(false);
    }, [executeTemplateSelect]);

    const typedTurnAbortRef = useRef<AbortController | null>(null);
    const handleSendMessage = useCallback(async () => {
        const userInput = currentInput.trim();
        if (!userInput) return;

        // Voice mode owns both microphone and typed turns. Its shared request
        // streams the same answer to the chat and TTS with one cancellation owner.
        // Do not also append/send through the separate text-only path below.
        if (isAIEnabled && voice.active) {
            setCurrentInput('');
            await voice.askText(userInput);
            return;
        }

                if (typeof typedTurnAbortRef !== 'undefined') typedTurnAbortRef.current?.abort();
        const turnController = new AbortController();
        if (typeof typedTurnAbortRef !== 'undefined') typedTurnAbortRef.current = turnController;
        const rawHistoryBeforeTurn = chatHistoryRef.current;
        const lastBeforeTurn = rawHistoryBeforeTurn[rawHistoryBeforeTurn.length - 1];
        const historyBeforeTurn = (lastBeforeTurn?.role === 'user' && lastBeforeTurn.content?.trim() && (typeof text !== 'undefined' ? text : userInput).toLowerCase().startsWith(lastBeforeTurn.content.trim().toLowerCase())) ? rawHistoryBeforeTurn.slice(0, -1) : rawHistoryBeforeTurn;
        const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: userInput,
            timestamp: Date.now()
        };

        setChatHistory(prev => [...prev, userMsg]);
        setCurrentInput('');

        if (!isAIEnabled) {
            setTimeout(() => {
                const aiMsg: ChatMessage = {
                    id: `msg-${Date.now() + 1}`,
                    role: 'ai',
                    content: getAIResponse(userInput),
                    timestamp: Date.now()
                };
                setChatHistory(prev => [...prev, aiMsg]);
                void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg], notepadType);
            }, 800);
            return;
        }

        await waitForCreationMemorySync();
        const payload = buildBrainstormPayload(userInput, historyBeforeTurn);
        console.log('[Brainstorm userSnapshot] typed request', payload.userSnapshot);
        const messagesPayload = payload.messages;
        const milestoneBatch = takePendingMilestonesForTurn?.() || null;

        const aiMsgId = `msg-${Date.now() + 1}`;
        const aiStartedAt = Date.now();
        setChatHistory(prev => [...prev, {
            id: aiMsgId,
            role: 'ai',
            content: '',
            timestamp: aiStartedAt,
            streaming: true,
        }]);

        const patchAiMsg = (patch: Partial<ChatMessage>) => {
            setChatHistory(prev => prev.map(m => (m.id === aiMsgId ? { ...m, ...patch } : m)));
        };

        const finalizeAiReply = (replyText: string) => {
            const finalText = replyText.trim();
            const aiMsg: ChatMessage = {
                id: aiMsgId,
                role: 'ai',
                content: finalText,
                timestamp: aiStartedAt,
                streaming: false,
            };
            patchAiMsg({ content: finalText, streaming: false, status: undefined });
            void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg], notepadType);
        };

        const fence = String.fromCharCode(96, 96, 96);
        const cleanText = (t: string) => {
            let rest = t;
            let i = rest.indexOf(fence);
            while (i !== -1) {
                const j = rest.indexOf(fence, i + 3);
                if (j === -1) { rest = rest.slice(0, i); break; }
                rest = rest.slice(0, i) + rest.slice(j + 3);
                i = rest.indexOf(fence);
            }
            return rest
                .replace(/^\s{0,3}#{1,6}\s*/gm, '')
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/^\s*[-\u2022]\s+/gm, '')
                .replace(/^\s*(?:top|middle|bottom|first|second|third|final)\s+panel\s*:\s*/gim, '')
                .replace(/^\s*panel\s*\d+\s*:\s*/gim, '')
                .replace(/^\s*(?:image|visual|text|caption)\s*:\s*/gim, '')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n');
        };

        try {
            const resp = await fetch(`${CLIK_URL}/startBrainstormStream`, {
                method: 'POST',
                signal: typeof signal !== 'undefined' ? signal : turnController.signal,
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                credentials: 'include',
                body: JSON.stringify({
                    messages: messagesPayload,
                    memorySlots: payload.memorySlots,
                    userSnapshot: payload.userSnapshot,
                    sessionIdentity: payload.sessionIdentity,
                    conversationModel,
                    mode: notepadType,
                    ...(milestoneBatch?.events?.length ? { pendingMilestoneEvents: milestoneBatch.events } : {}),
                    webSearch: conversationSupportsOnlineAccess && webSearch,
                    ...autoControlRequestContext(userMsg.content),
                }),
            });

            if (!resp.ok || !resp.body) throw new Error(`Stream HTTP ${resp.status}`);
            const ctype = resp.headers.get('content-type') || '';
            if (!ctype.includes('text/event-stream')) throw new Error(`Not an SSE response (${ctype})`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const receivedNarrationEvents = new Set<string>();
            let raw = '';
            let finished = false;
            let streamFailed = false;

            while (!finished) {
                const { value, done: streamDone } = await reader.read();
                if (streamDone) break;
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
                        raw += evt.text || '';
                        patchAiMsg({ content: cleanText(raw), status: undefined });
                    } else if (evt.type === 'status') {
                        if (typeof evt.virtualGate?.stage === 'string') noteAutoControlGateStage(evt.virtualGate.stage,
                            evt.virtualGate.detail, autoControlSnapshotKey(store.getState().brainstorm.userSnapshot));
                        patchAiMsg({ status: evt.text || undefined });
                    } else if (evt.type === 'navigation_browser_request') {
                        void handleNavigationBrowserRequest(evt, CLIK_URL);
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
            if (typeof signal === 'undefined' || !signal?.aborted) clearPendingAutoControlUserTurn();

            if (streamFailed) {
                if (milestoneBatch) resolveMilestoneBatch?.(milestoneBatch.batchId, { deliveredText: cleanText(raw), completedCleanly: false });
                await axios.get(`${CLIK_URL}/ai-provider-status`).catch(() => undefined);
                setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
                return;
            }
            if (!raw.trim()) throw new Error('Empty stream - no deltas received');
            await axios.get(`${CLIK_URL}/ai-provider-status`).catch(() => undefined);
            if (milestoneBatch) resolveMilestoneBatch?.(milestoneBatch.batchId, { deliveredText: cleanText(raw), completedCleanly: true });
            finalizeAiReply(cleanText(raw));

        } catch (error: any) {
            if (typeof turnController !== 'undefined' && (turnController.signal.aborted || error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED')) {
                if (typeof aiMsgId !== 'undefined') { setChatHistory(prev => prev.filter(message => message.id !== aiMsgId || Boolean(message.content?.trim()))); return; }
                return;
            }
            if (typeof signal === 'undefined' || !signal?.aborted) clearPendingAutoControlUserTurn();
            console.error("Brainstorm stream failed:", error);
            if (milestoneBatch) resolveMilestoneBatch?.(milestoneBatch.batchId, { deliveredText: '', completedCleanly: false });
            await axios.get(`${CLIK_URL}/ai-provider-status`).catch(() => undefined);
            setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
        }
    }, [currentInput, isAIEnabled, CLIK_URL, notepadType, webSearch, conversationModel, buildBrainstormPayload, dispatch, noteMemoryAfterAssistant, waitForCreationMemorySync, takePendingMilestonesForTurn, resolveMilestoneBatch, voice.active, voice.askText]);

    const cleanVoiceReply = (replyText: string): string => {
        return replyText
            .replace(/^\s*(hey|hi|hello)[!,.?]?\s+(hey there|hi there|hello there)[!,.?]?\s*/i, (_match, _first, second) => `${second}! `)
            .replace(/^\s*(hey|hi|hello)[!,.?]?\s+\1[!,.?]?\s*/i, (_match, first) => `${first}! `)
            .replace(/\s+/g, ' ')
            .trim();
    };
    // Voice relay: STT text -> same mode-aware Brainstorm stream -> early TTS chunks.
    const voiceAsk = useCallback(async (
        userText: string,
        signal?: AbortSignal,
        stream?: { onTextDelta?: (delta: string) => void; onFinalText?: (text: string) => void },
        options?: { conciergeObservationTurn?: boolean; pendingMilestoneEvents?: unknown[] }
    ): Promise<string> => {
        const text = (userText || '').trim();
        if (!text) return '';

                if (typeof typedTurnAbortRef !== 'undefined') typedTurnAbortRef.current?.abort();
        const turnController = new AbortController();
        if (typeof typedTurnAbortRef !== 'undefined') typedTurnAbortRef.current = turnController;
        const rawHistoryBeforeTurn = chatHistoryRef.current;
        const lastBeforeTurn = rawHistoryBeforeTurn[rawHistoryBeforeTurn.length - 1];
        const historyBeforeTurn = (lastBeforeTurn?.role === 'user' && lastBeforeTurn.content?.trim() && (typeof text !== 'undefined' ? text : userInput).toLowerCase().startsWith(lastBeforeTurn.content.trim().toLowerCase())) ? rawHistoryBeforeTurn.slice(0, -1) : rawHistoryBeforeTurn;
        const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
        const aiMsgId = `msg-${Date.now() + 1}`;
        const aiStartedAt = Date.now();
        setChatHistory(prev => {
            const last = prev[prev.length - 1];
            const base = (last?.role === 'user' && last.content?.trim() && text.toLowerCase().startsWith(last.content.trim().toLowerCase())) ? prev.slice(0, -1) : prev;
            return [...base, userMsg, { id: aiMsgId, role: 'ai', content: '', timestamp: aiStartedAt, streaming: true }];
        });

        const patchAiMsg = (patch: Partial<ChatMessage>) => {
            setChatHistory(prev => prev.map(m => (m.id === aiMsgId ? { ...m, ...patch } : m)));
        };

        await waitForCreationMemorySync();
        const payload = buildBrainstormPayload(text, historyBeforeTurn);
        console.log('[Brainstorm userSnapshot] visible voice request', payload.userSnapshot);

        let raw = '';
        let reply = '';
        let responseInterrupted = false;
        try {
            const resp = await fetch(`${CLIK_URL}/startBrainstormStream`, {
                method: 'POST',
                signal: typeof signal !== 'undefined' ? signal : turnController.signal,
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                credentials: 'include',
                body: JSON.stringify({
                    messages: payload.messages,
                    memorySlots: payload.memorySlots,
                    userSnapshot: payload.userSnapshot,
                    sessionIdentity: payload.sessionIdentity,
                    conversationModel,
                    mode: notepadTypeRef.current,
                    webSearch: conversationSupportsOnlineAccess && webSearchRef.current,
                    ...(options?.conciergeObservationTurn !== undefined ? { conciergeObservationTurn: options.conciergeObservationTurn } : {}),
                    ...(Array.isArray(options?.pendingMilestoneEvents) ? { pendingMilestoneEvents: options.pendingMilestoneEvents } : {}),
                    ...autoControlRequestContext(userMsg.content),
                }),

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
                        const delta = String(evt.text || '');
                        if (!delta) continue;
                        raw += delta;
                        stream?.onTextDelta?.(delta);
                        patchAiMsg({ content: cleanVoiceReply(raw), status: undefined });
                    } else if (evt.type === 'status') {
                        if (typeof evt.virtualGate?.stage === 'string') noteAutoControlGateStage(evt.virtualGate.stage,
                            evt.virtualGate.detail, autoControlSnapshotKey(store.getState().brainstorm.userSnapshot));
                        patchAiMsg({ status: evt.text || undefined });
                    } else if (evt.type === 'navigation_browser_request') {
                        void handleNavigationBrowserRequest(evt, CLIK_URL);
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
            if (typeof signal === 'undefined' || !signal?.aborted) clearPendingAutoControlUserTurn();

            if (streamFailed) throw new Error('Brainstorm stream interrupted');
            if (!raw.trim()) throw new Error('Empty Brainstorm stream');
            void axios.get(`${CLIK_URL}/ai-provider-status`, { timeout: 5000 }).catch(() => undefined);
            reply = cleanVoiceReply(raw);
        } catch (e: any) {
            if (typeof signal === 'undefined' || !signal?.aborted) clearPendingAutoControlUserTurn();
            if (signal?.aborted || e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
                console.log('voiceAsk aborted');
                if (!raw.trim()) setChatHistory(prev => prev.filter(message => message.id !== aiMsgId));
                else patchAiMsg({ streaming: false, status: undefined });
                throw e;
            }
            console.error('voiceAsk stream failed:', e);
            if (typeof signal === 'undefined' || !signal?.aborted) clearPendingAutoControlUserTurn();
            void axios.get(`${CLIK_URL}/ai-provider-status`, { timeout: 5000 }).catch(() => undefined);
            responseInterrupted = true;
            const notice = "Sorry, that response was interrupted. Please try again.";
            const delta = raw.trim() ? ` ${notice}` : notice;
            stream?.onTextDelta?.(delta);
            reply = cleanVoiceReply(raw + delta);
        }

        stream?.onFinalText?.(reply);
        const aiMsg: ChatMessage = { id: aiMsgId, role: 'ai', content: reply, timestamp: aiStartedAt, streaming: false };
        patchAiMsg({ content: reply, streaming: false, status: undefined });
        if (!responseInterrupted) void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg], notepadTypeRef.current);
        return reply;
        // Stable identity (reads live state via refs) so the voice hook never
        // holds a stale copy of this function.
    }, [CLIK_URL, conversationModel, buildBrainstormPayload, dispatch, noteMemoryAfterAssistant, waitForCreationMemorySync]);

    const handleUseMessage = useCallback((msg: ChatMessage) => {
        onInjectText(msg.content);
        setActiveTemplateId(null);
        activeTemplateTextRef.current = '';
        setMode('template');
    }, [onInjectText]);

    const handleManualUse = useCallback(() => {
        if (!manualPrompt.trim()) return;
        onInjectText(manualPrompt);
        if (manualArtStyle) dispatch(setArtstyle(manualArtStyle));
        setActiveTemplateId(null);
        activeTemplateTextRef.current = '';
        setManualName('');
        setManualPrompt('');
        setMode('template');
    }, [manualPrompt, manualArtStyle, dispatch, onInjectText]);

    const glassStyle = useMemo(() => ({
        background: darkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
        borderRadius: '12px',
        boxShadow: darkMode ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.08)',
    }), [darkMode]);

    useCreationControls('assistant', 'PromptConstructor', Boolean(showTemplates), { mode, isTemplateLibraryOpen });
    return (
        <Box sx={{
            position: mode === 'brainstorm' || isTemplateLibraryOpen ? 'static' : 'relative',
            width: '100%',
            height: '100%',
            mb: mode === 'brainstorm' ? 0 : (matchMobile ? 0.5 : 2),
            overflow: 'visible', // Allow gallery to be seen fully
            transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {mode === 'template' && showTemplates && !isTemplateLibraryOpen && (
                <Box sx={{
                    display: 'flex',
                    gap: matchMobile ? 0.75 : 1.25,
                    width: '100%',
                    alignItems: 'stretch',
                    px: 1.25,
                    pb: matchMobile ? 0.5 : 1.25,
                    pt: matchMobile ? 0.5 : 1.25
                }}>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setMode('brainstorm');
                        }}
                        startIcon={<PsychologyIcon />}
                        {...cb('assistant', 'brainstorm', 'Open Brainstorm', 'setMode(brainstorm)')}
                        sx={{
                            flex: { xs: '1 1 0', md: '0 0 calc(60% - 5px)' },
                            minHeight: matchMobile ? 36 : 56,
                            borderColor: darkMode ? appColor : '#000',
                            color: darkMode ? '#fff' : '#000',
                            px: matchMobile ? 0.75 : 2,
                            py: matchMobile ? 0.25 : 1,
                            borderStyle: 'dashed',
                            borderWidth: 1.5,
                            borderRadius: 2.5,
                            fontWeight: 800,
                            fontSize: matchMobile ? '0.78rem' : '0.875rem',
                            letterSpacing: '0.04em',
                            '&:hover': { borderColor: appColorHover, bgcolor: `${appColor}14` },
                        }}
                    >
                        BrainStorm
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setIsTemplateLibraryOpen(true)}
                        {...cb('assistant', 'templates', 'Open template library', 'setIsTemplateLibraryOpen(true)')}
                        endIcon={<ViewModuleIcon />}
                        sx={{
                            flex: { xs: '1 1 0', md: '1 1 40%' },
                            minHeight: matchMobile ? 36 : 56,
                            borderColor: darkMode ? appColor : '#000',
                            color: darkMode ? '#fff' : '#000',
                            borderRadius: 2.5,
                            fontWeight: 800,
                            px: matchMobile ? 0.75 : 2,
                            py: matchMobile ? 0.25 : 1,
                            borderStyle: 'dashed',
                            borderWidth: 1.5,
                            justifyContent: 'space-between',
                            letterSpacing: '0.04em',
                            fontSize: matchMobile ? '0.78rem' : '0.875rem',
                            minWidth: 0,
                            '&:hover': { borderColor: appColorHover, bgcolor: `${appColor}14` },
                        }}
                    >
                        Templates
                    </Button>
                </Box>
            )}

            {mode === 'template' && showTemplates && isTemplateLibraryOpen && (
                <Modal
                    open={isTemplateLibraryOpen}
                    disableEnforceFocus
                    disableAutoFocus
                    disableRestoreFocus
                    onClose={() => {
                        if (templateGalleryRef.current?.handleBackOrClose?.()) {
                            return;
                        }
                        setIsTemplateLibraryOpen(false);
                    }}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: TEMPLATE_LIBRARY_Z_INDEX,
                        p: 0,
                        backdropFilter: 'blur(12px)',
                        bgcolor: 'rgba(0,0,0,0.62)',
                    }}
                >
                    <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            width: { xs: '100vw', sm: '80vw' },
                            maxWidth: 1540,
                            height: '100dvh',
                            maxHeight: '100dvh',
                            bgcolor: darkMode ? '#0e1015' : '#f7f8fa',
                            borderRadius: { xs: 0, sm: 3 },
                            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            outline: 'none',
                        }}
                    >
                        <TemplateLibrary
                            ref={templateGalleryRef}
                            standalone
                            templates={templates}
                            activeTemplateId={activeTemplateId}
                            handleTemplateSelect={(selected) => {
                                handleTemplateSelect(selected);
                                setIsTemplateLibraryOpen(false);
                            }}
                            darkMode={darkMode}
                            appColor={appColor}
                            appColorHover={appColorHover}
                            onClose={() => setIsTemplateLibraryOpen(false)}
                            onFetchMore={onFetchTemplates}
                            hasMore={hasMoreTemplates}
                            onDeleteTemplate={onDeleteTemplate}
                            onToggleShowcase={onToggleTemplateShowcase}
                            onTemplateCreated={onTemplateCreated}
                            onOpenBrainstorm={(params) => {
                                setIsTemplateLibraryOpen(false);
                                setMode('brainstorm');
                                onBrainstormOpenChange?.(true);
                                if (params && typeof params === 'object') {
                                    if (typeof params.isAIEnabled === 'boolean') {
                                        setIsAIEnabled(params.isAIEnabled);
                                    }
                                    if (typeof params.title === 'string') setManualName(params.title);
                                    if (typeof params.prompt === 'string') setManualPrompt(params.prompt);
                                    if (typeof params.artStyle === 'string') setManualArtStyle(params.artStyle);
                                    if (params.view) setBrainstormInitialView(params.view);
                                }
                            }}
                        />
                    </Box>
                </Modal>
            )}
            {mode === 'brainstorm' && (
                <BrainstormChat
                    initialView={brainstormInitialView}
                    isAIEnabled={isAIEnabled}
                    setIsAIEnabled={setIsAIEnabled}
                    chatHistory={chatHistory}
                    currentInput={currentInput}
                    setCurrentInput={setCurrentInput}
                    handleSendMessage={handleSendMessage}
                    handleUseMessage={handleUseMessage}
                    handleSaveMessage={() => { }} // Not used as primary anymore, finalize flow internal
                    handleCloseBrainstorm={() => setMode('template')}
                    manualName={manualName}
                    setManualName={setManualName}
                    manualPrompt={manualPrompt}
                    setManualPrompt={setManualPrompt}
                    handleManualUse={handleManualUse}
                    handleManualSave={() => { }} // Not used as primary anymore, finalize flow internal
                    chatEndRef={chatEndRef}
                    darkMode={darkMode}
                    appColor={appColor}
                    appColorDeep={appColorDeep}
                    appColorHover={appColorHover}
                    clikUrl={CLIK_URL}
                    ratioKey={ratioKey}
                    onTemplateCreated={onTemplateCreated}
                    notepadType={notepadType}
                    musicPanel={musicPanel}
                    webSearch={webSearch}
                    webSearchDisabled={!conversationSupportsOnlineAccess}
                    onToggleWebSearch={() => {
                        if (conversationSupportsOnlineAccess) setWebSearch(v => !v);
                    }}
                    manualArtStyle={manualArtStyle}
                    onManualArtStyleChange={setManualArtStyle}
                    onVoiceAsk={voiceAsk}
                />
            )}

            {/* Condition 1: Standard Image Preview (PC or PromptInput mode) */}
            {(mode === 'preview') && (
                <ImagePreview
                    previewImage={previewImage}
                    isGenerating={isGenerating}
                    handleBackToGallery={() => {
                        setMode('template');
                        setIsPreviewExpanded(false);
                        // Clear image if in EditStory mode
                        if (!showTemplates) {
                            setPreviewImage(null);
                            onImageClear?.();
                            onImageGenerated?.(null);
                        }
                    }}
                    glassStyle={glassStyle}
                    ratioKey={ratioKey}
                    isExpanded={isPreviewExpanded}
                    onToggleExpand={() => setIsPreviewExpanded(!isPreviewExpanded)}
                    appColor={appColor}
                    darkMode={darkMode}
                    containerHeight={containerHeight}
                />
            )}

            {/* Prototype Warning Overlay */}
            {prototypeWarningTarget && (
                <Box sx={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(10, 10, 10, 0.75)',
                    backdropFilter: 'blur(8px)',
                }}>
                    <Box sx={{
                        backgroundColor: 'rgba(20, 20, 20, 0.95)',
                        border: `1px solid ${appColor}`,
                        borderRadius: '16px',
                        p: 4,
                        textAlign: 'center',
                        maxWidth: '80%',
                        boxShadow: `0 8px 32px ${alpha(appColor, darkMode ? 0.15 : 0.25)}`,
                    }}>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mb: 1, fontSize: '1.1rem' }}>
                            This is a Prototype Feature with some bugs
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#aaa', mb: 0.5 }}>
                            Under development 🚧
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#aaa', mb: 3 }}>
                            Have Fun 😊
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                            <Button 
                                variant="outlined" 
                                size="small"
                                onClick={() => setPrototypeWarningTarget(null)}
                                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="contained" 
                                size="small"
                                onClick={() => {
                                    if (prototypeWarningTarget === 'brainstorm') {
                                        setMode('brainstorm');
                                    } else {
                                        executeTemplateSelect(prototypeWarningTarget as Template);
                                    }
                                    setPrototypeWarningTarget(null);
                                }}
                                sx={{ bgcolor: appColor, color: darkMode ? '#000' : '#fff', '&:hover': { bgcolor: appColorHover } }}
                            >
                                Proceed
                            </Button>
                        </Box>
                    </Box>
                </Box>
            )}

        </Box>
    );
});

export default PromptConstructor;
import { creationBinding as cb } from '../creationControlSnapshot';
import { useCreationControls } from '../useCreationControls';
