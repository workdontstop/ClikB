// src/components/PromptConstructor.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import {
    ChatMessage,
    getAIResponse,
    Template,
} from '../PromptConstructorMock';
import { useDebounce } from '../hooks/useDebounce';
import { TemplateLibrary } from './TemplateGallery';
import { BrainstormChat } from './BrainstormChat';
import { useBrainstormSession } from './BrainstormSessionProvider';
import { ImagePreview } from './ImagePreview';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setArtstyle } from '../settingsSlice';
import { setBrainstormChatOpen } from '../brainstormSlice';
import { matchMobile } from '../DetectDevice';

import PsychologyIcon from '@mui/icons-material/Psychology';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
export interface ImageGenCache {
    text: string;
    imageUrl: string | null;
    ratio?: number;
}

type Mode = 'template' | 'brainstorm' | 'preview';

interface Props {
    darkMode: boolean;
    onInjectText: (text: string, oldText?: string) => void;
    currentNotepadText: string;
    onLoadingChange?: (isLoading: boolean) => void;
    containerHeight?: number;
    onImageGenerated?: (imageUrl: string | null) => void;
    onImageClear?: () => void;
    showTemplates?: boolean;
    cachedImageGen?: ImageGenCache;
    onUpdateCachedImageGen?: (data: ImageGenCache) => void;
    // Lifted Props
    templates: Template[];
    onFetchTemplates: () => void;
    hasMoreTemplates: boolean;
    onTemplateCreated: () => void;
    onDeleteTemplate: (template: Template) => void;
    /** Current notepad mode (mirrors PromptInput `type`): 0 scenes/memes, 1 story, 3 interactions. */
    notepadType?: number;
    /** Notifies the parent when the brainstorm chat is open (for height + close guarding). */
    onBrainstormOpenChange?: (open: boolean) => void;
    /** Notifies the parent when the template list is open (for height only). */
    onTemplateLibraryOpenChange?: (open: boolean) => void;
}

const PromptConstructor = React.memo<Props>(({
    darkMode, onInjectText, currentNotepadText, onLoadingChange, containerHeight,
    onImageGenerated, onImageClear, showTemplates,
    cachedImageGen, onUpdateCachedImageGen,
    templates, onFetchTemplates, hasMoreTemplates, onTemplateCreated,
    onDeleteTemplate, notepadType, onBrainstormOpenChange, onTemplateLibraryOpenChange
}) => {
    const dispatch = useDispatch();
    console.log('[PromptConstructor] Render. showTemplates:', showTemplates, 'Mode:', 'template');
    const [mode, setMode] = useState<Mode>('template');
    // LOCAL STATE FOR TEMPLATES REMOVED - Using props instead
    const [isAIEnabled, setIsAIEnabled] = useState(true);
    const {
        chatHistory,
        setChatHistory,
        chatHistoryRef,
        buildBrainstormPayload,
        noteMemoryAfterAssistant,
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

    // Tell the parent when the template list is open, so the dialog grows to
    // ~90vh and the full template images are visible (height only â€” no close guard).
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

    const appColor = darkMode ? '#E8BAFA' : '#0099cc';
    const appColorDeep = darkMode ? '#C481E0' : '#0077aa';
    const appColorHover = darkMode ? '#F2DAFC' : '#00bbff';

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;
    const ratioKey = useSelector((state: RootState) => state.settings.aspectRatio);
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
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
        if (!debouncedText.trim() || mode === 'brainstorm') return;

        // CHECK PARENT CACHE: If text and ratio match, use parent's cached URL
        if (cachedImageGen &&
            cachedImageGen.text === debouncedText.trim() &&
            cachedImageGen.imageUrl) {

            // Optional: verify ratio if provided in cache (user primarily said text/url, but ratio serves similar purpose)
            // If cached ratio exists and differs, we should ideally regen, but user emphasized text equality.
            // We'll trust text equality for now as primary key.

            console.log('[PromptConstructor] Using LIFTED cached image for:', debouncedText.slice(0, 20));
            setPreviewImage(cachedImageGen.imageUrl);
            onImageGenerated?.(cachedImageGen.imageUrl);
            return;
        }

        const generateImage = async () => {
            setIsGenerating(true);
            try {
                const payload = {
                    inputs: debouncedText,
                    width: 1080,
                    height: 1920,
                    guidance: 7.5,
                    num_inference_steps: 35,
                    seed: seed,
                    ty: ratioKey
                };

                const response = await axios.post(`${CLIK_URL}/fluxschnell`, payload);

                const responseData = response.data as any;
                if (responseData && responseData.imageBase64) {
                    let finalImage = responseData.imageBase64;
                    if (!finalImage.startsWith('data:image')) {
                        finalImage = `data:image/png;base64,${finalImage}`;
                    }
                    const imageUrl = finalImage;

                    // UPDATE PARENT CACHE
                    if (onUpdateCachedImageGen) {
                        onUpdateCachedImageGen({
                            text: debouncedText.trim(),
                            imageUrl: imageUrl,
                            ratio: ratioKey
                        });
                    }

                    setPreviewImage(imageUrl);
                    onImageGenerated?.(imageUrl);
                    // Only switch internal mode if not handled externally
                    if (!onImageGenerated) {
                        setMode('preview');
                    }
                } else {
                    setPreviewImage(null);
                    onImageGenerated?.(null);
                    onImageClear?.();
                }
            } catch (error) {
                console.error("Image generation failed:", error);
                // Optional: Show error state
            } finally {
                setIsGenerating(false);
            }
        };

        generateImage();
    }, [debouncedText, ratioKey]);

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

    const handleSendMessage = useCallback(async () => {
        const userInput = currentInput.trim();
        if (!userInput) return;

        const historyBeforeTurn = chatHistoryRef.current;
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
                void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg]);
            }, 800);
            return;
        }

        const payload = buildBrainstormPayload(userInput, historyBeforeTurn);
        console.log('[Brainstorm userSnapshot] typed request', payload.userSnapshot);
        const messagesPayload = payload.messages;

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
            void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg]);
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
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: messagesPayload, memorySlots: payload.memorySlots, userSnapshot: payload.userSnapshot, mode: notepadType, webSearch }),
            });

            if (!resp.ok || !resp.body) throw new Error(`Stream HTTP ${resp.status}`);
            const ctype = resp.headers.get('content-type') || '';
            if (!ctype.includes('text/event-stream')) throw new Error(`Not an SSE response (${ctype})`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let raw = '';
            let finished = false;

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
                        raw += evt.text || '';
                        patchAiMsg({ content: cleanText(raw), status: undefined });
                    } else if (evt.type === 'status') {
                        patchAiMsg({ status: evt.text || undefined });
                    } else if (evt.type === 'done') {
                        finished = true;
                    } else if (evt.type === 'error') {
                        finished = true;
                        raw = evt.text || "I'm having trouble connecting to my brain right now. Please try again.";
                    }
                }
            }

            if (!raw.trim()) throw new Error('Empty stream - no deltas received');
            finalizeAiReply(cleanText(raw));

        } catch (error) {
            console.error("Brainstorm stream failed, falling back to non-streaming:", error);
            try {
                const response = await axios.post(`${CLIK_URL}/startBrainstorm`, {
                    messages: messagesPayload,
                    memorySlots: payload.memorySlots,
                    userSnapshot: payload.userSnapshot,
                    mode: notepadType,
                    webSearch,
                });
                finalizeAiReply((response.data as any).reply || '');
            } catch (err2) {
                console.error("Brainstorm fallback failed:", err2);
                finalizeAiReply("I'm having trouble connecting to my brain right now. Please try again.");
            }
        }
    }, [currentInput, isAIEnabled, CLIK_URL, notepadType, webSearch, buildBrainstormPayload, noteMemoryAfterAssistant]);

    const cleanVoiceReply = (replyText: string): string => {
        return replyText
            .replace(/^\s*(hey|hi|hello)[!,.?]?\s+(hey there|hi there|hello there)[!,.?]?\s*/i, (_match, _first, second) => `${second}! `)
            .replace(/^\s*(hey|hi|hello)[!,.?]?\s+\1[!,.?]?\s*/i, (_match, first) => `${first}! `)
            .replace(/\s+/g, ' ')
            .trim();
    };
    // Voice relay: Gemini Live transcribes speech -> this routes the text to the
    // SAME OpenAI brain (mode-aware), appends both turns to the chat, and returns
    // the reply text so Gemini Live can speak it. Non-streaming (full reply).
    const voiceAsk = useCallback(async (userText: string, signal?: AbortSignal): Promise<string> => {
        const text = (userText || '').trim();
        if (!text) return '';

        const historyBeforeTurn = chatHistoryRef.current;
        const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
        setChatHistory(prev => [...prev, userMsg]);

        const payload = buildBrainstormPayload(text, historyBeforeTurn);
        console.log('[Brainstorm userSnapshot] visible voice request', payload.userSnapshot);

        let reply = '';
        try {
            const response = await axios.post(`${CLIK_URL}/startBrainstorm`, {
                messages: payload.messages,
                memorySlots: payload.memorySlots,
                userSnapshot: payload.userSnapshot,
                mode: notepadTypeRef.current,
                webSearch: webSearchRef.current,
            }, { signal } as any);
            reply = cleanVoiceReply((response.data as any)?.reply || '');
        } catch (e: any) {
            if (signal?.aborted || e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
                console.log('voiceAsk aborted');
                throw e;
            }
            console.error('voiceAsk failed:', e);
            reply = "Sorry, I'm having trouble connecting right now.";
        }

        const aiMsg: ChatMessage = { id: `msg-${Date.now() + 1}`, role: 'ai', content: reply, timestamp: Date.now() };
        setChatHistory(prev => [...prev, aiMsg]);
        void noteMemoryAfterAssistant([...historyBeforeTurn, userMsg, aiMsg]);
        return reply;
        // Stable identity (reads live state via refs) so the voice hook never
        // holds a stale copy of this function.
    }, [CLIK_URL, buildBrainstormPayload, noteMemoryAfterAssistant]);

    const handleUseMessage = useCallback((msg: ChatMessage) => {
        onInjectText(msg.content);
        setActiveTemplateId(null);
        activeTemplateTextRef.current = '';
        setMode('template');
    }, [onInjectText]);

    const handleManualUse = useCallback(() => {
        if (!manualPrompt.trim()) return;
        onInjectText(manualPrompt);
        setActiveTemplateId(null);
        activeTemplateTextRef.current = '';
        setManualName('');
        setManualPrompt('');
        setMode('template');
    }, [manualPrompt, onInjectText]);

    const glassStyle = useMemo(() => ({
        background: darkMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'}`,
        borderRadius: '12px',
        boxShadow: darkMode ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.08)',
    }), [darkMode]);

    return (
        <Box sx={{
            position: mode === 'brainstorm' || isTemplateLibraryOpen ? 'static' : 'relative',
            width: '100%',
            height: '100%',
            mb: mode === 'brainstorm' ? 0 : 2,
            overflow: 'visible', // Allow gallery to be seen fully
            transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {mode === 'template' && showTemplates && !isTemplateLibraryOpen && (
                <Box sx={{ display: 'flex', gap: 1.25, width: '100%', alignItems: 'stretch', p: 1.25 }}>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setMode('brainstorm');
                        }}
                        startIcon={<PsychologyIcon />}
                        sx={{
                            flex: { xs: '1 1 0', md: '0 0 calc(60% - 5px)' },
                            minHeight: 56,
                            borderColor: darkMode ? appColor : '#000',
                            color: darkMode ? '#fff' : '#000',
                            px: 2,
                            py: 1,
                            borderStyle: 'dashed',
                            borderWidth: 1.5,
                            borderRadius: 2.5,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            '&:hover': { borderColor: appColorHover, bgcolor: `${appColor}14` },
                        }}
                    >
                        BrainStorm
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setIsTemplateLibraryOpen(true)}
                        endIcon={<ViewModuleIcon />}
                        sx={{
                            flex: { xs: '1 1 0', md: '1 1 40%' },
                            minHeight: 56,
                            borderColor: darkMode ? appColor : '#000',
                            color: darkMode ? '#fff' : '#000',
                            borderRadius: 2.5,
                            fontWeight: 800,
                            px: { xs: 1, sm: 2 },
                            py: 1,
                            borderStyle: 'dashed',
                            borderWidth: 1.5,
                            justifyContent: 'space-between',
                            letterSpacing: '0.04em',
                            minWidth: 0,
                            '&:hover': { borderColor: appColorHover, bgcolor: `${appColor}14` },
                        }}
                    >
                        Templates
                    </Button>
                </Box>
            )}

            {mode === 'template' && showTemplates && isTemplateLibraryOpen && (
                <TemplateLibrary
                    templates={templates}
                    activeTemplateId={activeTemplateId}
                    handleTemplateSelect={handleTemplateSelect}
                    darkMode={darkMode}
                    appColor={appColor}
                    appColorHover={appColorHover}
                    onClose={() => setIsTemplateLibraryOpen(false)}
                    onFetchMore={onFetchTemplates}
                    hasMore={hasMoreTemplates}
                    onDeleteTemplate={onDeleteTemplate}
                />

            )}
            {mode === 'brainstorm' && (
                <BrainstormChat
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
                    webSearch={webSearch}
                    onToggleWebSearch={() => setWebSearch(v => !v)}
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
                        boxShadow: `0 8px 32px ${darkMode ? 'rgba(232,186,250,0.15)' : 'rgba(0, 153, 204, 0.25)'}`,
                    }}>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mb: 1, fontSize: '1.1rem' }}>
                            This is a Prototype Feature with some bugs
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#aaa', mb: 0.5 }}>
                            Under development ðŸš§
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#aaa', mb: 3 }}>
                            Have Fun ðŸ˜Š
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
