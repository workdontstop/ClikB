import { conciergeSurface } from '../conciergeSurface';
// src/components/BrainstormChat.tsx
import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography, TextField, Button, useTheme, useMediaQuery, CircularProgress, Stack, Snackbar, Alert, Tooltip, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Divider } from '@mui/material';
import { darken } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublicIcon from '@mui/icons-material/Public';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import { matchMobile } from '../DetectDevice';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import ArticleIcon from '@mui/icons-material/Article';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ChatMessage } from '../PromptConstructorMock';
import { distillCoverArtPromptRuleBased } from '../utils/templatePromptDeduction';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { useBrainstormSession } from './BrainstormSessionProvider';
import { MusicScenePanel, type MusicPanelConfig } from './MusicScenePanel';
import { setBrainstormSelectedVoice } from '../brainstormSlice';
import { useFishVoices, GEMINI_VOICE_OPTIONS } from '../fishVoices';
import { FishVoicePreviewManager } from './FishVoicePreviewManager';
import { TEMPLATE_COVER_MODELS, type TemplateCoverQuality } from '../../server/src/templateCoverModels';
import { calcModelPixels } from '../ModelPixels';
import AutoControlRevealButton from '../AutoControlRevealButton';
import AutoControlPill from '../AutoControlPill';
import { getConversationMeasurementSessionId, resetConversationMeasurementSessionId } from '../conversationMeasurementSession';

interface BrainstormChatProps {
    isAIEnabled: boolean;
    setIsAIEnabled: (enabled: boolean) => void;
    chatHistory: ChatMessage[];
    currentInput: string;
    setCurrentInput: (input: string) => void;
    handleSendMessage: () => void;
    handleUseMessage: (msg: ChatMessage) => void;
    handleSaveMessage: (msg: ChatMessage) => void;
    handleCloseBrainstorm: () => void;
    manualName: string;
    setManualName: (name: string) => void;
    manualPrompt: string;
    setManualPrompt: (prompt: string) => void;
    handleManualUse: () => void;
    handleManualSave: () => void;
    chatEndRef: React.RefObject<HTMLDivElement>;
    darkMode: boolean;
    appColor: string;
    appColorDeep: string;
    appColorHover: string;
    clikUrl: string;
    ratioKey: number;
    onTemplateCreated: () => void;
    /** Current notepad mode (0 scenes/memes, 1 story, 3 interactions) for distill tailoring. */
    notepadType?: number;
    /** Whether web search is enabled for replies (ON = web search, OFF = fast streaming). */
    webSearch?: boolean;
    onToggleWebSearch?: () => void;
    webSearchDisabled?: boolean;
    /**
     * Music-video scene breakdown. Only supplied while music mode is active with
     * a track selected; pinned above the chat so the user can plan scenes and
     * preview each segment's audio without leaving the assistant.
     */
    musicPanel?: MusicPanelConfig;
    /** Voice relay: transcribed speech -> OpenAI brain -> streamed reply text for TTS. */
    onVoiceAsk?: (text: string, signal?: AbortSignal, stream?: { onTextDelta?: (delta: string) => void; onFinalText?: (text: string) => void }) => Promise<string>;
    initialView?: 'chat' | 'finalize';
    manualArtStyle?: string;
    onManualArtStyleChange?: (style: string) => void;
}

type ViewMode = 'chat' | 'finalize';
type FinalizePromptMode = 'template' | 'image';
type RagLibraryView = 'session' | 'instructions';

type ConversationProviderTotal = {
    reasoningEffort?: string | null;
    provider: string;
    model: string;
    calls: number;
    costUsd: number;
    projectedOneHourCostUsd: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    durationSeconds: number;
};

type ConversationLedgerSession = {
    sessionId: string;
    startedAt: string;
    updatedAt: string;
    summary: {
        measuredWindowSeconds: number;
        requestCount: number;
        providerCallCount: number;
        successfulRequests: number;
        failedRequests: number;
        totalCostUsd: number;
        projectedOneHourCostUsd: number;
        projectedRequestsPerHour: number;
        projectionStatus: string;
        speedMs: {
            averageRequest: number;
            p50Request: number;
            p95Request: number;
            averageTimeToFirstToken: number | null;
            p95TimeToFirstToken: number | null;
            validFirstTokenSamples?: number;
            missingFirstTokenSamples?: number;
            averageModelCall?: number | null;
            averageFirstAudible?: number | null;
            averageFirstMutation?: number | null;
        };
        providerTotals: ConversationProviderTotal[];
        workloadTotals?: Array<{ category: string; calls: number; costUsd: number; inputTokens: number; cachedInputTokens: number; outputTokens: number; durationSeconds: number }>;
        contextSize?: { eventCount: number; totalCharacters: number; averageCharacters: number; averageBySource?: Record<string, number> };
    };
    totalRecordCount?: number;
    page?: { offset: number; limit: number; total: number; hasMore: boolean };
    records: Array<{ requestId?: string; route?: string; stage?: string; actionLabel?: string; status?: string; startedAt?: string; completedAt?: string; elapsedMs?: number; calls?: Array<{ provider: string; model: string; inputTokens: number; cachedInputTokens: number; outputTokens: number; providerCostUsd: number }> }>;
};

type ConversationLedgerResponse = {
    ledger: ConversationLedgerSession | null;
    pricing?: {
        checkedAt?: string;
        currency?: string;
        notes?: string[];
        sources?: Record<string, string>;
        rates?: Record<string, number>;
    };
    logPath?: string;
};

const conversationLedgerMarkdown = (payload: ConversationLedgerResponse): string => {
    const session = payload.ledger;
    if (!session) {
        return '# ClikB Conversation Cost Ledger\n\nNo measured conversation activity exists for this browser session yet.';
    }
    const summary = session.summary;
    const providerRows = summary.providerTotals.length
        ? summary.providerTotals.map(row => (
            `| ${row.provider} | ${row.model} (${row.reasoningEffort || "unspecified"}) | ${row.calls} | ${row.inputTokens} | ${row.outputTokens} | ${row.durationSeconds.toFixed(3)} | $${row.costUsd.toFixed(9)} | $${row.projectedOneHourCostUsd.toFixed(6)} |`
        )).join('\n')
        : '| — | — | 0 | 0 | 0 | 0 | $0 | $0 |';
    const sourceRows = Object.entries(payload.pricing?.sources || {})
        .map(([name, url]) => `- ${name}: ${url}`)
        .join('\n');

    return [
        '# ClikB Conversation Cost Ledger',
        '',
        `- Session: ${session.sessionId}`,
        `- Measured: ${session.startedAt} → ${session.updatedAt}`,
        `- Window: ${summary.measuredWindowSeconds.toFixed(3)} seconds`,
        `- Projection quality: ${summary.projectionStatus}`,
        `- Requests: ${summary.requestCount} (${summary.successfulRequests} successful, ${summary.failedRequests} failed)`,
        `- Provider calls: ${summary.providerCallCount}`,
        `- Measured cost: $${summary.totalCostUsd.toFixed(9)}`,
        `- Projected continuous one-hour cost: $${summary.projectedOneHourCostUsd.toFixed(6)}`,
        `- Projected requests/hour: ${summary.projectedRequestsPerHour.toFixed(2)}`,
        '',
        '## Speed',
        '',
        `- Average request: ${summary.speedMs.averageRequest} ms`,
        `- P50 request: ${summary.speedMs.p50Request} ms`,
        `- P95 request: ${summary.speedMs.p95Request} ms`,
        `- Average time to first token: ${summary.speedMs.averageTimeToFirstToken !== null && summary.speedMs.averageTimeToFirstToken !== undefined ? `${summary.speedMs.averageTimeToFirstToken} ms` : 'unavailable'} (${summary.speedMs.validFirstTokenSamples ?? 0} valid / ${summary.speedMs.missingFirstTokenSamples ?? 0} missing samples)`,
        `- P95 time to first token: ${summary.speedMs.p95TimeToFirstToken ?? 'not reported'} ms`,
        '',
        '## Provider breakdown',
        '',
        '| Provider | Model | Calls | Input tokens | Output tokens | Audio seconds | Measured cost | Projected/hour |',
        '|---|---|---:|---:|---:|---:|---:|---:|',
        providerRows,
        '',
        `## Official pricing sources (checked ${payload.pricing?.checkedAt || 'unknown'})`,
        '',
        sourceRows || '- Pricing sources unavailable in this response.',
        '',
        '## Workload breakdown',
        '',
        ...(summary.workloadTotals?.length ? summary.workloadTotals.map(w => `- ${w.category}: ${w.calls} calls, ${w.inputTokens} in / ${w.outputTokens} out tokens, $${w.costUsd.toFixed(9)}`) : ['- No workload totals recorded.']),
        '',
        '## Context & Recent Requests Summary',
        '',
        `- Input-size events: ${summary.contextSize?.eventCount ?? 0} (avg ${summary.contextSize?.averageCharacters ?? 0} chars/provider input)`,
        `- Recent requests shown: ${session.records?.length ?? 0} of ${session.totalRecordCount ?? summary.requestCount}`,
        ...(session.records || []).slice(0, 15).map(rec => `- \`${rec.requestId || 'req'}\` ${rec.route || ''} (${rec.actionLabel || rec.stage || 'call'}): ${rec.status || 'unknown'} in ${rec.elapsedMs ?? 0} ms`),
        '',
        '> Use "Download raw JSON" in the Conversation Cost Ledger dialog for full trace export.',
        '',
    ].join('\n');
};

// SD is author-only; HD and SD2 are shared cover alternatives.
type FinalizeImageQuality = TemplateCoverQuality;
const TEMPLATE_IMAGE_LINK_MODE = true;
const FINALIZE_IMAGE_MODELS = TEMPLATE_COVER_MODELS;

const VOICE_OPTIONS = GEMINI_VOICE_OPTIONS;
type RagDocumentRow = {
    databaseId?: number;
    docId: string;
    topic: string;
    sourceName: string;
    status: string;
    chunkCount: number;
    createdAt: string;
    updatedAt: string;
    instructions: string;
    sourceType?: string;
    namespace?: string;
    vectorId?: string;
    sessionId?: string;
    deviceId?: string;
    expiresAt?: number;
    displayId?: string;
    memoryKind?: string;
    memoryKindLabel?: string;
    turnStart?: number;
    turnEnd?: number;
    slotId?: number;
    previewText?: string;
};


type RagInstructionApiRow = {
    id: number;
    rag_id: string;
    title: string;
    instructions: string;
    source_type?: string;
    namespace?: string;
    vector_id?: string;
    session_id?: string;
    device_id?: string;
    expires_at?: number;
    memory_kind?: string;
    turn_start?: number;
    turn_end?: number;
    slot_id?: number;
    preview_text?: string;
};
const DUMMY_RAG_DOCUMENTS: RagDocumentRow[] = [
    {
        docId: 'clikb_app_overview',
        topic: 'ClikB overall app identity',
        sourceName: '01_clikb_app_overview.rag.txt',
        status: 'dummy',
        chunkCount: 0,
        createdAt: 'Stage 1',
        updatedAt: 'Stage 1',
        instructions: 'Dummy RAG preview. Upload a .rag.txt packet to see the exact stored instructions here.',
    },
    {
        docId: 'clikb_storybook_bshots_publish_pipeline',
        topic: 'Storybook B-roll publish pipeline',
        sourceName: '05_storybook_bshots_publish_pipeline.rag.txt',
        status: 'dummy',
        chunkCount: 0,
        createdAt: 'Stage 1',
        updatedAt: 'Stage 1',
        instructions: 'Dummy RAG preview. Upload a .rag.txt packet to see the exact stored instructions here.',
    },
    {
        docId: 'clikb_user_snapshot_brainstorm_bridge',
        topic: 'userSnapshot and Brainstorm bridge',
        sourceName: '10_user_snapshot_brainstorm_bridge.rag.txt',
        status: 'dummy',
        chunkCount: 0,
        createdAt: 'Stage 1',
        updatedAt: 'Stage 1',
        instructions: 'Dummy RAG preview. Upload a .rag.txt packet to see the exact stored instructions here.',
    },
];
const extractRagSourceName = (instructions: string, fallback: string): string => {
    return instructions.match(/sourceName:\s*"([^"]+)"/)?.[1] || fallback;
};


const estimateRagChunkCount = (instructions: string, maxChars: number = 1800, overlapChars: number = 220): number => {
    const text = String(instructions || '').replace(/\r\n/g, '\n').trim();
    if (!text) return 0;
    if (text.length <= maxChars) return 1;

    let count = 0;
    let start = 0;

    while (start < text.length) {
        let end = Math.min(start + maxChars, text.length);
        if (end < text.length) {
            const newlineBreak = text.lastIndexOf('\n', end);
            if (newlineBreak > start + Math.floor(maxChars * 0.55)) {
                end = newlineBreak;
            }
        }
        if (text.slice(start, end).trim()) count += 1;
        if (end >= text.length) break;
        start = Math.max(0, end - overlapChars);
    }

    return count;
};
const SESSION_MEMORY_SOURCE_TYPE = 'brainstorm-session-memory';
const isSessionMemoryDocument = (doc?: RagDocumentRow | null): boolean => doc?.sourceType === SESSION_MEMORY_SOURCE_TYPE;

const formatSessionMemoryKind = (value?: string): string => {
    const cleaned = String(value || 'memory').replace(/[_-]+/g, ' ').trim();
    return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const stripSessionTitle = (title: string): string => String(title || 'Brainstorm memory').replace(/^\[Session\]\s*/i, '').trim();

const formatTurnLabel = (turnStart?: number, turnEnd?: number): string => {
    const start = Number(turnStart || 0);
    const end = Number(turnEnd || 0);
    return start && end ? `${start}-${end}` : '-';
};

const formatExpiryLabel = (expiresAt?: number): string => {
    const timestamp = Number(expiresAt || 0);
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getRagTableLabels = (view: RagLibraryView): string[] => view === 'session'
    ? ['memory', 'title', 'kind', 'status', 'turns', 'expires']
    : ['docId', 'title/topic', 'sourceName', 'status', 'chunks', 'updatedAt'];

const getRagTableCells = (doc: RagDocumentRow, view: RagLibraryView): Array<string | number> => {
    if (view === 'session' && isSessionMemoryDocument(doc)) {
        return [
            doc.displayId || doc.memoryKindLabel || 'Session memory',
            doc.topic,
            doc.memoryKindLabel || formatSessionMemoryKind(doc.memoryKind),
            'active',
            formatTurnLabel(doc.turnStart, doc.turnEnd),
            formatExpiryLabel(doc.expiresAt),
        ];
    }

    return [doc.docId, doc.topic, doc.sourceName, doc.status, doc.chunkCount, doc.updatedAt];
};

const mapRagInstructionRowToDocument = (row: RagInstructionApiRow): RagDocumentRow => {
    const sourceType = row.source_type || 'brainstorm-rag-instruction';
    const sessionMemory = sourceType === SESSION_MEMORY_SOURCE_TYPE;
    const expiresAt = Number(row.expires_at || 0);
    const memoryKind = String(row.memory_kind || 'memory');
    const memoryKindLabel = formatSessionMemoryKind(memoryKind);
    const turnStart = Number(row.turn_start || 0);
    const turnEnd = Number(row.turn_end || 0);
    const slotId = Number(row.slot_id || 0);
    const title = sessionMemory ? stripSessionTitle(row.title) : row.title;
    const turnLabel = formatTurnLabel(turnStart, turnEnd);

    return {
        databaseId: row.id,
        docId: row.vector_id || row.rag_id,
        displayId: sessionMemory
            ? `${memoryKindLabel}${turnLabel !== '-' ? `, turns ${turnLabel}` : ''}`
            : row.rag_id,
        topic: title,
        sourceName: sessionMemory ? 'Brainstorm session' : extractRagSourceName(row.instructions, `${row.rag_id}.rag.txt`),
        status: sessionMemory ? 'active' : 'uploaded',
        chunkCount: sessionMemory ? 1 : estimateRagChunkCount(row.instructions),
        createdAt: sessionMemory ? 'Pinecone' : 'DB',
        updatedAt: sessionMemory && expiresAt ? formatExpiryLabel(expiresAt) : 'DB',
        instructions: row.instructions,
        sourceType,
        namespace: row.namespace,
        vectorId: row.vector_id,
        sessionId: row.session_id,
        deviceId: row.device_id,
        expiresAt,
        memoryKind,
        memoryKindLabel,
        turnStart,
        turnEnd,
        slotId,
        previewText: row.preview_text,
    };
};
export const BrainstormChat: React.FC<BrainstormChatProps> = ({
    isAIEnabled, setIsAIEnabled, chatHistory, currentInput, setCurrentInput, handleSendMessage,
    handleUseMessage, handleSaveMessage: onFinalSaveExternal, handleCloseBrainstorm, manualName, setManualName,
    manualPrompt, setManualPrompt, handleManualUse, chatEndRef,
    darkMode, appColor: callerAppColor, appColorDeep: _callerAppColorDeep, appColorHover: _callerAppColorHover, clikUrl, ratioKey, onTemplateCreated,
    webSearch, onToggleWebSearch, webSearchDisabled = false, onVoiceAsk, musicPanel, initialView, manualArtStyle, onManualArtStyleChange
}) => {
    const theme = useTheme();
    const isPC = useMediaQuery('(min-width: 1024px)');
    const dispatch = useDispatch();
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const selectedVoice = useSelector((state: RootState) => state.brainstorm.selectedVoice);
    const autoControlVisible = useSelector((state: RootState) => state.settings.autoControlVisible);
    // Live pixel balance (Redux mirror of the DB balance) for the HD thumbnail charge.
    const pixels = useSelector((state: RootState) => state.settings.pixels);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight)
        || callerAppColor
        || (darkMode ? '#E8BAFA' : '#0099cc');
    const appColorDeep = darken(appColor, 0.18);
    const appColorHover = darken(appColor, 0.08);

    // Internal state for the new flow
    const [view, setView] = useState<ViewMode>(initialView || 'chat');
    useEffect(() => {
        if (initialView) {
            setView(initialView);
        }
    }, [initialView]);

    // Finalize View State
    const [finalizePrompt, setFinalizePrompt] = useState('');
    const [finalizeImagePrompt, setFinalizeImagePrompt] = useState('');
    const [finalizePromptMode, setFinalizePromptMode] = useState<FinalizePromptMode>('template');
    // SD (Klein) is the default so opening Finalize never triggers a costly render.
    const [imageQuality, setImageQuality] = useState<FinalizeImageQuality>('sd');
    const imageQualityRef = React.useRef<FinalizeImageQuality>('sd');
    useEffect(() => { imageQualityRef.current = imageQuality; }, [imageQuality]);
    const [baseTemplatePrompt, setBaseTemplatePrompt] = useState('');
    const [baseImagePrompt, setBaseImagePrompt] = useState('');
    const [finImage, setFinImage] = useState<string | null>(null);
    const coverReceiptRef = React.useRef<string | null>(null);
    const [isFinGenerating, setIsFinGenerating] = useState(false);
    const [finalizeTitle, setFinalizeTitle] = useState('');
    const [finalizeArtStyle, setFinalizeArtStyle] = useState('');
    const [isFinSaving, setIsFinSaving] = useState(false);
    const finalizeGenerationRunRef = React.useRef(0);
    const finalizeGenerationAbortRef = React.useRef<AbortController | null>(null);
    const finalSaveInFlightRef = React.useRef(false);
    const closeAfterSaveTimerRef = React.useRef<number | null>(null);
    const isBrainstormMountedRef = React.useRef(true);
    // Confirm before leaving brainstorm. Session persists unless user explicitly resets it.
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const handleBackFromFinalizeRef = React.useRef<() => void>(() => {});
    useEffect(() => {
        const handleBackdropConfirm = () => {
            if (view === 'finalize') {
                if (isFinGenerating) {
                    return;
                }
                handleBackFromFinalizeRef.current?.();
                return;
            }
            setShowLeaveConfirm(true);
        };
        window.addEventListener("clikb-request-brainstorm-leave-confirm", handleBackdropConfirm);
        return () => window.removeEventListener("clikb-request-brainstorm-leave-confirm", handleBackdropConfirm);
    }, [view, isFinGenerating]);
    const [showRagInjector, setShowRagInjector] = useState(false);
    const [ragLibraryView, setRagLibraryView] = useState<RagLibraryView>('session');
    const ragUploadInputRef = React.useRef<HTMLInputElement | null>(null);
    const [ragDocuments, setRagDocuments] = useState<RagDocumentRow[]>([]);
    const [hasLoadedRagDocuments, setHasLoadedRagDocuments] = useState(false);
    const [isRagLoading, setIsRagLoading] = useState(false);
    const [isRagUploading, setIsRagUploading] = useState(false);
    const [selectedRagDocument, setSelectedRagDocument] = useState<RagDocumentRow | null>(null);
    const [ragDeleteConfirmDocument, setRagDeleteConfirmDocument] = useState<RagDocumentRow | null>(null);
    const [ragDeleteConfirmText, setRagDeleteConfirmText] = useState('');
    const [isRagDeleting, setIsRagDeleting] = useState(false);
    const VITE_APPX_STATE = import.meta.env.VITE_APPX_STATE;
    const isRagInjectorDevMode = VITE_APPX_STATE === 'dev';
    const isConversationLedgerDevMode = import.meta.env.DEV || VITE_APPX_STATE === 'dev';
    const [showConversationLedger, setShowConversationLedger] = useState(false);
    const [conversationLedger, setConversationLedger] = useState<ConversationLedgerResponse | null>(null);
    const [isConversationLedgerLoading, setIsConversationLedgerLoading] = useState(false);
    const [isConversationLedgerExporting, setIsConversationLedgerExporting] = useState(false);
    const [conversationLedgerExportError, setConversationLedgerExportError] = useState('');
    const conversationLedgerExportRef = React.useRef(false);
    const [conversationLedgerError, setConversationLedgerError] = useState('');
    const [conversationLedgerCopied, setConversationLedgerCopied] = useState(false);
    const { clearBrainstormSession, voice, setVoiceAskHandler, sessionIdentity, setGuideEnabled } = useBrainstormSession();

    const [voiceMenuAnchor, setVoiceMenuAnchor] = useState<HTMLElement | null>(null);
    const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
    const voicePreviewRef = React.useRef<HTMLAudioElement | null>(null);
    const fishVoices = useFishVoices(Boolean(voiceMenuAnchor));
    const voiceOptions = [...fishVoices.map(v => ({ id: v.id, label: `${v.name} (Fish)`, tone: v.tone,
        gender: v.gender, previewUrl: v.previewUrl })), ...VOICE_OPTIONS.map(v => ({ ...v, label: `${v.label} (Gemini)` }))];
    const selectedVoiceMeta = voiceOptions.find(v => v.id === selectedVoice) || VOICE_OPTIONS[0];
    const [replayingMessageId, setReplayingMessageId] = useState<string | null>(null);
    const replayingMessageIdRef = React.useRef<string | null>(null);
    const replayRunRef = React.useRef(0);

    const stopVoicePreview = () => {
        if (voicePreviewRef.current) {
            voicePreviewRef.current.pause();
            voicePreviewRef.current.currentTime = 0;
            voicePreviewRef.current = null;
        }
        setPreviewingVoice(null);
    };

    const toggleVoicePreview = (option: { id: string; previewUrl?: string }) => {
        if (!option.previewUrl) return;
        if (previewingVoice === option.id) {
            stopVoicePreview();
            return;
        }
        stopVoicePreview();
        const audio = new Audio(option.previewUrl);
        voicePreviewRef.current = audio;
        audio.onended = () => setPreviewingVoice(null);
        audio.play().then(() => setPreviewingVoice(option.id)).catch(() => setPreviewingVoice(null));
    };

    useEffect(() => {
        if (!voiceMenuAnchor) stopVoicePreview();
        return () => stopVoicePreview();
    }, [voiceMenuAnchor]);

    useEffect(() => {
        setVoiceAskHandler(onVoiceAsk || null);
        return () => setVoiceAskHandler(null);
    }, [onVoiceAsk, setVoiceAskHandler]);
    const voiceIsSpeaking = voice.status === 'speaking';
    const voiceIsWaiting = voice.status === 'connecting' || voice.status === 'thinking';
    const sessionRagDocuments = ragDocuments.filter(isSessionMemoryDocument);
    const instructionRagDocuments = ragDocuments.filter((doc) => !isSessionMemoryDocument(doc));
    const visibleRagDocuments = hasLoadedRagDocuments
        ? (ragLibraryView === 'session' ? sessionRagDocuments : instructionRagDocuments)
        : (ragLibraryView === 'instructions' ? DUMMY_RAG_DOCUMENTS : []);
    const ragTableLabels = getRagTableLabels(ragLibraryView);
    const emptyRagMessage = ragLibraryView === 'session'
        ? 'No Brainstorm session history yet. It appears after a few completed turns.'
        : 'No RAG instructions uploaded yet.';

    const voiceStatusLabel = voice.status === 'listening'
        ? 'Listening...'
        : voice.status === 'connecting'
            ? 'Waiting...'
            : voice.status === 'thinking'
                ? 'Waiting...'
                : voice.status === 'speaking'
                    ? voice.ttsDelivery?.fallback ? `Speaking · Gemini fallback (${voice.ttsDelivery.actualVoice})` : 'Speaking...'
                    : 'Voice ready';

    const handleReplayAudioClick = React.useCallback(async (msg: ChatMessage) => {
        const msgId = String(msg.id);
        if (replayingMessageIdRef.current === msgId) {
            replayRunRef.current += 1;
            replayingMessageIdRef.current = null;
            setReplayingMessageId(null);
            voice.stopSpeech();
            return;
        }

        const runId = replayRunRef.current + 1;
        replayRunRef.current = runId;
        replayingMessageIdRef.current = msgId;
        setReplayingMessageId(msgId);

        try {
            await voice.speakText(msg.content);
        } finally {
            if (replayRunRef.current === runId) {
                replayingMessageIdRef.current = null;
                setReplayingMessageId(null);
            }
        }
    }, [voice.speakText, voice.stopSpeech]);

    const cancelFinalizeGeneration = React.useCallback(() => {
        finalizeGenerationRunRef.current += 1;
        finalizeGenerationAbortRef.current?.abort();
        finalizeGenerationAbortRef.current = null;
        if (isBrainstormMountedRef.current) {
            setIsFinGenerating(false);
        }
    }, []);

    const closeBrainstormWithVoiceCleanup = () => {
        stopVoicePreview();
        cancelFinalizeGeneration();
        if (closeAfterSaveTimerRef.current !== null) {
            window.clearTimeout(closeAfterSaveTimerRef.current);
            closeAfterSaveTimerRef.current = null;
        }
        handleCloseBrainstorm();
    };

    useEffect(() => {
        isBrainstormMountedRef.current = true;
        return () => {
            isBrainstormMountedRef.current = false;
            finalizeGenerationRunRef.current += 1;
            finalizeGenerationAbortRef.current?.abort();
            finalizeGenerationAbortRef.current = null;
            if (closeAfterSaveTimerRef.current !== null) {
                window.clearTimeout(closeAfterSaveTimerRef.current);
                closeAfterSaveTimerRef.current = null;
            }
            if (voicePreviewRef.current) {
                voicePreviewRef.current.pause();
                voicePreviewRef.current.currentTime = 0;
                voicePreviewRef.current = null;
            }
        };
    }, []);
    // Snackbar State
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    const loadConversationLedger = React.useCallback(async () => {
        if (!clikUrl || !isConversationLedgerDevMode) return;
        setIsConversationLedgerLoading(true);
        setConversationLedgerError('');
        try {
            const measurementSessionId = getConversationMeasurementSessionId();
            const response = await fetch(`${clikUrl}/conversation-measurement?sessionId=${encodeURIComponent(measurementSessionId)}&limit=25`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error(`Ledger request failed (${response.status})`);
            setConversationLedger(await response.json() as ConversationLedgerResponse);
        } catch (error) {
            setConversationLedgerError(error instanceof Error ? error.message : 'Could not load the conversation ledger.');
        } finally {
            setIsConversationLedgerLoading(false);
        }
    }, [clikUrl, isConversationLedgerDevMode]);

    const openConversationLedger = () => {
        if (!isConversationLedgerDevMode) return;
        setConversationLedgerCopied(false);
        setShowConversationLedger(true);
        void loadConversationLedger();
    };

    const copyConversationLedger = async () => {
        if (!conversationLedger) return;
        const report = conversationLedgerMarkdown(conversationLedger);
        try {
            await navigator.clipboard.writeText(report);
        } catch {
            const copyArea = document.createElement('textarea');
            copyArea.value = report;
            copyArea.style.position = 'fixed';
            copyArea.style.opacity = '0';
            document.body.appendChild(copyArea);
            copyArea.select();
            document.execCommand('copy');
            document.body.removeChild(copyArea);
        }
        setConversationLedgerCopied(true);
        window.setTimeout(() => setConversationLedgerCopied(false), 1800);
    };

    const downloadConversationLedger = async () => {
        if (!clikUrl || !conversationLedger?.ledger || conversationLedgerExportRef.current) return;
        conversationLedgerExportRef.current = true;
        setIsConversationLedgerExporting(true);
        setConversationLedgerExportError('');
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 30000);
        try {
            const sessionId = conversationLedger.ledger.sessionId;
            // Fetch as data: a document navigation can enter an old app/PWA
            // fallback on the API origin instead of downloading the ledger.
            const response = await fetch(`${clikUrl}/conversation-measurement?sessionId=${encodeURIComponent(sessionId)}&export=raw`, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
                cache: 'no-store',
                redirect: 'error',
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Ledger export failed (${response.status}).`);
            if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) {
                throw new Error('The ledger endpoint returned an app page instead of JSON. Restart the backend with the current code.');
            }
            // Keep the full trace out of React state and avoid parsing or
            // serializing it on the browser's main thread.
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = `conversation-ledger-${sessionId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            setConversationLedgerExportError(error instanceof Error && error.name !== 'AbortError'
                ? error.message : 'Ledger export timed out. The local server log is still available.');
        } finally {
            window.clearTimeout(timeout);
            conversationLedgerExportRef.current = false;
            setIsConversationLedgerExporting(false);
        }
    };

    const startFreshConversationMeasurement = () => {
        resetConversationMeasurementSessionId();
        setConversationLedger(null);
        setConversationLedgerError('');
        setConversationLedgerExportError('');
        setConversationLedgerCopied(false);
    };

    const handleOpenRagInjector = () => {
        if (!isRagInjectorDevMode) return;
        setShowRagInjector(true);
    };

    const loadRagInstructions = React.useCallback(async () => {
        if (!clikUrl || !isRagInjectorDevMode) return;
        setIsRagLoading(true);
        try {
            const response: any = await axios.get(`${clikUrl}/get_rag_instructions`, {
                withCredentials: true,
                params: {
                    includeSessionMemory: '1',
                    userId: sessionIdentity.userId || '',
                    username: sessionIdentity.username || '',
                    sessionId: sessionIdentity.sessionId || '',
                    deviceId: sessionIdentity.deviceId || '',
                },
            });
            const rows: RagInstructionApiRow[] = Array.isArray(response.data?.ragInstructions)
                ? response.data.ragInstructions
                : [];
            setRagDocuments(rows.map(mapRagInstructionRowToDocument));
            setHasLoadedRagDocuments(true);
        } catch (error) {
            console.error('Load RAG instructions failed:', error);
            setSnackbarMessage('Could not load RAG list');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setIsRagLoading(false);
        }
    }, [clikUrl, isRagInjectorDevMode, sessionIdentity.deviceId, sessionIdentity.sessionId, sessionIdentity.userId, sessionIdentity.username]);

    useEffect(() => {
        if (showRagInjector && isRagInjectorDevMode) {
            void loadRagInstructions();
        }
    }, [showRagInjector, isRagInjectorDevMode, loadRagInstructions]);

    const handleRagUploadButtonClick = () => {
        if (isRagUploading) return;
        ragUploadInputRef.current?.click();
    };

    const closeRagInstructionViewer = () => {
        setSelectedRagDocument(null);
        setRagDeleteConfirmDocument(null);
        setRagDeleteConfirmText('');
    };

    const openRagDeleteConfirm = (documentRow: RagDocumentRow) => {
        if (documentRow.status === 'dummy' || isRagDeleting) return;
        setRagDeleteConfirmDocument(documentRow);
        setRagDeleteConfirmText('');
    };

    const handleConfirmRagDelete = async () => {
        const documentRow = ragDeleteConfirmDocument;
        if (!documentRow || !clikUrl || ragDeleteConfirmText.trim() !== 'delete') return;

        setIsRagDeleting(true);
        const deletingSessionMemory = isSessionMemoryDocument(documentRow);
        try {
            if (deletingSessionMemory) {
                await axios.post(
                    `${clikUrl}/memory/session/delete`,
                    {
                        sessionIdentity,
                        vectorId: documentRow.vectorId || documentRow.docId,
                        confirmation: 'delete',
                    },
                    { withCredentials: true }
                );
            } else {
                await axios.post(
                    `${clikUrl}/delete_rag_instruction`,
                    { ragId: documentRow.docId, confirmation: 'delete' },
                    { withCredentials: true }
                );
            }
            setRagDocuments((previousDocuments) => previousDocuments.filter((item) => item.docId !== documentRow.docId));
            if (selectedRagDocument?.docId === documentRow.docId) {
                setSelectedRagDocument(null);
            }
            setRagDeleteConfirmDocument(null);
            setRagDeleteConfirmText('');
            setSnackbarMessage(deletingSessionMemory ? 'Session memory deleted' : 'RAG instruction deleted');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            await loadRagInstructions();
        } catch (error: any) {
            console.error(deletingSessionMemory ? 'Delete session memory failed:' : 'Delete RAG instruction failed:', error);
            setSnackbarMessage(error?.response?.data?.message || (deletingSessionMemory ? 'Session memory delete failed' : 'RAG delete failed'));
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setIsRagDeleting(false);
        }
    };

    const handleRagFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !clikUrl) return;

        if (!file.name.endsWith('.rag.txt') && !file.name.endsWith('.txt')) {
            setSnackbarMessage('Upload a .rag.txt or .txt RAG instruction file');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        setIsRagUploading(true);
        try {
            const instructions = await file.text();
            const response: any = await axios.post(
                `${clikUrl}/upload_rag_instruction`,
                { sourceName: file.name, instructions },
                { withCredentials: true }
            );
            const indexedChunks = response.data?.ragIndex?.chunkCount;
            const savedRagInstruction = response.data?.ragInstruction as RagInstructionApiRow | undefined;
            if (savedRagInstruction?.rag_id && savedRagInstruction.instructions) {
                const savedDocument = mapRagInstructionRowToDocument(savedRagInstruction);
                setRagDocuments((previousDocuments) => [
                    savedDocument,
                    ...previousDocuments.filter((documentRow) => documentRow.docId !== savedDocument.docId),
                ]);
                setHasLoadedRagDocuments(true);
            }
            setSnackbarMessage(indexedChunks ? `RAG instruction uploaded and indexed (${indexedChunks} chunks)` : 'RAG instruction uploaded');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            await loadRagInstructions();
        } catch (error: any) {
            console.error('Upload RAG instruction failed:', error);
            setSnackbarMessage(error?.response?.data?.message || 'RAG upload failed');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setIsRagUploading(false);
        }
    };

    // Auto-load manualName when switching to finalize view or when manualName changes
    useEffect(() => {
        if (manualName) {
            setFinalizeTitle(manualName);
        }
    }, [manualName]);

    useEffect(() => {
        if (manualPrompt && !finalizePrompt) {
            setFinalizePrompt(manualPrompt);
        }
    }, [manualPrompt, finalizePrompt]);

    useEffect(() => {
        if (manualArtStyle && !finalizeArtStyle) {
            setFinalizeArtStyle(manualArtStyle);
        }
    }, [manualArtStyle, finalizeArtStyle]);

    // Intercept the save action to switch views with the exact selected message.
    const onSaveClicked = (msg: ChatMessage) => {
        cancelFinalizeGeneration();
        setFinImage(null);
        setFinalizePrompt(msg.content);
        setBaseTemplatePrompt(msg.content);
        const deductedCover = distillCoverArtPromptRuleBased(msg.content, finalizeTitle || manualName, finalizeArtStyle);
        setFinalizeImagePrompt(deductedCover);
        setBaseImagePrompt(deductedCover);
        setFinalizePromptMode('template');
        // Always re-enter Finalize on SD so the auto-preview below can never
        // fire a paid HD render the user did not ask for.
        setImageQuality('sd');
        imageQualityRef.current = 'sd';
        setView('finalize');
    };

    // Auto-generate on show / update
    useEffect(() => {
        if (view === 'finalize' && finalizeImagePrompt) {
            void generateFinalizeImage(finalizeImagePrompt);
        }
    }, [view]);

    /** Cost in pixels of one thumbnail at the given quality. */
    const finalizeImageCost = React.useCallback(
        (quality: FinalizeImageQuality) => calcModelPixels({
            model: FINALIZE_IMAGE_MODELS[quality].model,
            baseImagesPerDollar: 333,
        }),
        []
    );

    const generateFinalizeImage = async (
        text: string,
        qualityOverride?: FinalizeImageQuality
    ): Promise<string | null> => {
        if (!text.trim() || !clikUrl) return null;

        const quality = qualityOverride ?? imageQualityRef.current;
        const config = FINALIZE_IMAGE_MODELS[quality];
        const cost = finalizeImageCost(quality);

        // Balance check before spending anything. Redux mirrors the DB value.
        if (pixels < cost) {
            setSnackbarMessage(
                `You need ${cost} pixels for an ${quality.toUpperCase()} thumbnail, but your balance is ${pixels}.`
            );
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return null;
        }

        const requestId = finalizeGenerationRunRef.current + 1;
        finalizeGenerationRunRef.current = requestId;
        finalizeGenerationAbortRef.current?.abort();
        const controller = new AbortController();
        finalizeGenerationAbortRef.current = controller;

        setIsFinGenerating(true);
        try {
            const payload = {
                inputs: text,
                // Template thumbnails are always landscape so they fit the
                // two-column saved-template gallery without letterboxing.
                width: 1920,
                height: 1080,
                size: '2K',
                guidance: 7.5,
                // Klein is fast (4-8 steps); Seedream 4.5 matches the main
                // generators at 35.
                num_inference_steps: config.steps,
                seed: Math.floor(Math.random() * 1000000), // Random seed for variety
                ty: 3, // 16:9, independent of the main creation ratio
                linkmode: TEMPLATE_IMAGE_LINK_MODE,
                billingAction: "brainstorm-image",
                templateCover: true, templateCoverTarget: 'new',
            };

            const requestOptions = { signal: controller.signal, timeout: config.timeoutMs, withCredentials: true };
            const response = await axios.post(`${clikUrl}/${config.route}`, payload, requestOptions);
            if (requestId !== finalizeGenerationRunRef.current || controller.signal.aborted) {
                return null;
            }
            const responseData = response.data as any;

            const returnedImage = responseData?.imageUrl;
            if (!returnedImage || !responseData?.coverReceipt) throw new Error('No stored template cover was returned.');
            if (isBrainstormMountedRef.current) {
                coverReceiptRef.current = responseData.coverReceipt;
                setFinImage(String(returnedImage));
            }
            return String(returnedImage);
        } catch (error) {
            if ((error as { code?: string })?.code !== 'ERR_CANCELED' && !controller.signal.aborted) {
                console.error("Finalize Generator failed:", error);
            }
        } finally {
            if (requestId === finalizeGenerationRunRef.current) {
                finalizeGenerationAbortRef.current = null;
                if (isBrainstormMountedRef.current) {
                    setIsFinGenerating(false);
                }
            }
        }
        return null;
    };

    const handleFinalizePromptModeChange = (nextMode: FinalizePromptMode) => {
        if (isFinSaving || nextMode === finalizePromptMode) return;
        // Moving back to template text invalidates any preview request that
        // could otherwise finish later and overwrite the current thumbnail.
        if (nextMode === 'template' && isFinGenerating) {
            cancelFinalizeGeneration();
        }
        setFinalizePromptMode(nextMode);
    };

    /**
     * Switching quality never auto-renders — it only arms the next Generate /
     * Save. Any in-flight render is cancelled so a slower SD result cannot land
     * on top of an HD one (or vice versa).
     */
    const handleImageQualityChange = (nextQuality: FinalizeImageQuality) => {
        if (isFinSaving || nextQuality === imageQuality) return;
        cancelFinalizeGeneration();
        // Drop the existing preview: it was rendered at the OTHER quality, and
        // the save path falls back to `finImage` when it is present. Keeping it
        // meant picking HD after an SD render and then saving the SD image.
        // Clearing it forces the save path to render at the chosen quality.
        setFinImage(null);
        setImageQuality(nextQuality);
        imageQualityRef.current = nextQuality;
    };

    const handleBackFromFinalize = () => {
        if (isFinSaving) return;
        cancelFinalizeGeneration();
        setManualName(finalizeTitle);
        setManualPrompt(finalizePrompt);
        onManualArtStyleChange?.(finalizeArtStyle);
        setView('chat');
    };
    handleBackFromFinalizeRef.current = handleBackFromFinalize;

    const handleRestoreDefault = () => {
        if (finalizePromptMode === 'template') {
            setFinalizePrompt(baseTemplatePrompt);
        } else {
            cancelFinalizeGeneration();
            setFinalizeImagePrompt(baseImagePrompt);
            setFinImage(null);
        }
    };

    const handleFinalSave = async () => {
        if (finalSaveInFlightRef.current) return;
        if (!finalizeTitle.trim()) {
            setSnackbarMessage('Please enter a Template Name');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }
        if (!finalizePrompt.trim()) {
            setSnackbarMessage('Prompt cannot be empty');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        finalSaveInFlightRef.current = true;
        setIsFinSaving(true);
        let saveSucceeded = false;
        try {
            let imageForSave = finImage;
            if (!imageForSave && finalizeImagePrompt.trim()) {
                imageForSave = await generateFinalizeImage(finalizeImagePrompt);
                if (!imageForSave) throw new Error('The cover could not be generated. Your template draft has been kept.');
            }
            const finalImageUrl = imageForSave;

            const payload = {
                userid: loggedUser?.id || 0,
                title: finalizeTitle,
                template_prompt: finalizePrompt,
                template_image: finalImageUrl,
                artstyle: finalizeArtStyle,
                coverQuality: imageQuality,
                coverReceipt: imageForSave ? coverReceiptRef.current : undefined
            };
            console.log("Saving Template:", {
                userid: payload.userid,
                title: payload.title,
                hasImage: Boolean(payload.template_image),
                hasArtStyle: Boolean(payload.artstyle),
            });

            const response: any = await axios.post(`${clikUrl}/create_template_prompt`, payload, {
                withCredentials: true,
                timeout: 30_000,
            });

            if (response.data && response.data.message) {
                saveSucceeded = true;
                setSnackbarMessage('Template Saved Successfully!');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);

                // 1. Wipe parent array
                onTemplateCreated();

                // 2. Close brainstorm (which should reload latest data via NotepadEditor effect)
                closeAfterSaveTimerRef.current = window.setTimeout(() => {
                    closeAfterSaveTimerRef.current = null;
                    closeBrainstormWithVoiceCleanup();
                }, 1500);
            } else {
                throw new Error('Template save returned no success confirmation');
            }
        } catch (error) {
            console.error('Save Error:', error);
            setSnackbarMessage('Failed to save template');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            // Keep the save locked after success until the finalize screen
            // closes, preventing a second DB insert during the success toast.
            if (!saveSucceeded) {
                finalSaveInFlightRef.current = false;
                if (isBrainstormMountedRef.current) {
                    setIsFinSaving(false);
                }
            }
        }
    };

    // Styles for consistent inputs
    const commonInputStyles = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 3,
            bgcolor: darkMode ? 'rgba(255,255,255,0.095)' : 'rgba(255,255,255,0.92)',
            color: darkMode ? '#fff' : '#000',
            boxShadow: darkMode ? 'inset 0 0 0 1px rgba(255,255,255,0.04)' : 'inset 0 0 0 1px rgba(0,0,0,0.03)',
            '& fieldset': { borderColor: darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)' },
            '&:hover fieldset': { borderColor: appColor },
            '&.Mui-focused fieldset': { borderColor: appColor }
        },
        '& .MuiInputBase-input': {
            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
        },
        '& input': {
            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
        },
        '& .MuiInputLabel-root': {
            color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
            '&.Mui-focused': { color: appColor }
        }
    };

    // Finalize View Content
    const finalizeContent = (
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1.25, sm: 3 },
            gap: { xs: 1.25, sm: 2 },
            overflowY: 'auto'
        }}>
            <Box
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <IconButton {...cb('brainstorm', 'back_finalize', 'Back from template finalization', 'handleBackFromFinalize')} onClick={handleBackFromFinalize} disabled={isFinSaving}>
                    <ArrowBackIcon sx={{ color: darkMode ? '#fff' : '#000' }} />
                </IconButton>
                <Typography variant="h6" sx={{ color: darkMode ? '#fff' : '#000', fontWeight: 'bold' }}>
                    Finalize Template
                </Typography>
                <Box width={40} />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1.25, sm: 2 }, height: { xs: 'auto', md: '100%' }, minHeight: 0 }}>
                {/* Left: Editor */}
                <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, minHeight: 0, display: 'flex', flexDirection: 'column', gap: { xs: 1.25, sm: 2 } }}>
                    {/* Title Input */}
                    <TextField
                        label="Template Name"
                        fullWidth
                        value={finalizeTitle}
                        {...cb('brainstorm', 'template_name', 'Template name', 'setFinalizeTitle', 'text')}
                        onChange={(e) => setFinalizeTitle(e.target.value)}
                        variant="outlined"
                        sx={commonInputStyles}
                        inputProps={{
                            style: {
                                caretColor: darkMode ? '#ffffff' : '#000000',
                                color: darkMode ? '#ffffff' : '#000000'
                            }
                        }}
                    />

                    {/* Art Style Input */}
                    <TextField
                        label="Art Style"
                        fullWidth
                        value={finalizeArtStyle}
                        {...cb('brainstorm', 'template_style', 'Template art style', 'setFinalizeArtStyle', 'text')}
                        onChange={(e) => setFinalizeArtStyle(e.target.value)}
                        variant="outlined"
                        sx={commonInputStyles}
                        placeholder="e.g. Cinematic, 3D Animation, Anime..."
                        inputProps={{
                            style: {
                                caretColor: darkMode ? '#ffffff' : '#000000',
                                color: darkMode ? '#ffffff' : '#000000'
                            }
                        }}
                    />

                    <Box sx={{ position: 'relative', flex: { xs: '0 0 auto', md: 1 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                            <Button
                                variant={finalizePromptMode === 'template' ? 'contained' : 'outlined'}
                                onClick={() => handleFinalizePromptModeChange('template')}
                                {...cb('brainstorm', 'template_prompt_mode', 'Edit template prompt', 'handleFinalizePromptModeChange(template)')}
                                disabled={isFinSaving}
                                sx={{
                                    minHeight: 38,
                                    bgcolor: finalizePromptMode === 'template' ? appColor : 'transparent',
                                    color: finalizePromptMode === 'template' ? (darkMode ? '#000' : '#fff') : appColor,
                                    borderColor: appColor,
                                    fontWeight: 800,
                                    '&:hover': {
                                        bgcolor: finalizePromptMode === 'template' ? appColorHover : 'rgba(255,255,255,0.05)',
                                        borderColor: appColorHover
                                    }
                                }}
                            >
                                Template
                            </Button>
                            <Button
                                variant={finalizePromptMode === 'image' ? 'contained' : 'outlined'}
                                onClick={() => handleFinalizePromptModeChange('image')}
                                {...cb('brainstorm', 'image_prompt_mode', 'Edit template image prompt', 'handleFinalizePromptModeChange(image)')}
                                disabled={isFinSaving}
                                sx={{
                                    minHeight: 38,
                                    bgcolor: finalizePromptMode === 'image' ? appColor : 'transparent',
                                    color: finalizePromptMode === 'image' ? (darkMode ? '#000' : '#fff') : appColor,
                                    borderColor: appColor,
                                    fontWeight: 800,
                                    '&:hover': {
                                        bgcolor: finalizePromptMode === 'image' ? appColorHover : 'rgba(255,255,255,0.05)',
                                        borderColor: appColorHover
                                    }
                                }}
                            >
                                Image
                            </Button>
                        </Box>
                        <TextField
                            label={finalizePromptMode === 'template' ? 'Template Prompt' : 'Image Prompt'}
                            multiline
                            minRows={3}
                            fullWidth
                            value={finalizePromptMode === 'template' ? finalizePrompt : finalizeImagePrompt}
                            {...cb('brainstorm', 'finalize_prompt', 'Template or image prompt', 'setFinalizePrompt/setFinalizeImagePrompt', 'text')}
                            onChange={(e) => {
                                if (finalizePromptMode === 'template') {
                                    setFinalizePrompt(e.target.value);
                                } else {
                                    cancelFinalizeGeneration();
                                    setFinalizeImagePrompt(e.target.value);
                                    setFinImage(null);
                                }
                            }}
                            variant="outlined"
                            sx={{
                                ...commonInputStyles,
                                flex: 1,
                                '& .MuiInputBase-root': {
                                    height: { xs: 240, sm: 280, md: '100%' },
                                    alignItems: 'flex-start'
                                },
                                '& textarea': {
                                    height: '100% !important',
                                    overflow: 'auto !important'
                                }
                            }}
                            inputProps={{
                                style: {
                                    caretColor: darkMode ? '#ffffff' : '#000000',
                                    color: darkMode ? '#ffffff' : '#000000'
                                }
                            }}
                        />
                    </Box>

                    {/* Template cover choices: SD = Klein, HD = GPT, SD2 = Seedream 4.5.
                        Only relevant while editing the Image prompt, so it stays
                        hidden in Template mode. */}
                    {finalizePromptMode === 'image' && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mt: 1 }}>
                        {(['sd', 'hd', 'sd2'] as FinalizeImageQuality[]).map((quality) => {
                            const isActive = imageQuality === quality;
                            const cost = finalizeImageCost(quality);
                            const unaffordable = pixels < cost;
                            return (
                                <Button
                                    key={quality}
                                    variant={isActive ? 'contained' : 'outlined'}
                                    onClick={() => handleImageQualityChange(quality)}
                                    {...cb('brainstorm', `quality_${quality}`, `${quality.toUpperCase()} ${FINALIZE_IMAGE_MODELS[quality].label} (${cost}p)`, 'handleImageQualityChange')}
                                    disabled={isFinSaving}
                                    sx={{
                                        minHeight: 52,
                                        minWidth: 0,
                                        px: 0.75,
                                        flexDirection: 'column',
                                        lineHeight: 1.15,
                                        py: 0.5,
                                        bgcolor: isActive ? appColor : 'transparent',
                                        color: isActive ? (darkMode ? '#000' : '#fff') : appColor,
                                        borderColor: appColor,
                                        fontWeight: 800,
                                        opacity: !isActive && unaffordable ? 0.5 : 1,
                                        '&:hover': {
                                            bgcolor: isActive ? appColorHover : 'rgba(255,255,255,0.05)',
                                            borderColor: appColorHover
                                        }
                                    }}
                                >
                                    <Box component="span">
                                        {quality.toUpperCase()}
                                    </Box>
                                    <Box component="span" sx={{ fontSize: '0.6rem', fontWeight: 500 }}>
                                        {FINALIZE_IMAGE_MODELS[quality].label}
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.85 }}
                                    >
                                        {cost} {cost === 1 ? 'pixel' : 'pixels'}
                                    </Box>
                                </Button>
                            );
                        })}
                    </Box>
                    )}

                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                        <Button
                            variant="outlined"
                            onClick={handleRestoreDefault}
                            {...cb('brainstorm', 'restore_image_prompt', 'Restore default image prompt', 'handleRestoreDefault')}
                            startIcon={<RefreshIcon />}
                            sx={{
                                flex: 1,
                                color: darkMode ? '#aaa' : '#666',
                                borderColor: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
                            }}
                        >
                            Original
                        </Button>
                        {/* Generate only renders the thumbnail, so it is hidden in
                            Template mode where there is nothing for it to act on. */}
                        {finalizePromptMode === 'image' && (
                        <Button
                            variant="contained"
                            disabled={isFinGenerating}
                            onClick={() => void generateFinalizeImage(finalizeImagePrompt)}
                            {...cb('brainstorm', 'generate_image', 'Generate template image', 'generateFinalizeImage', 'click', 'candidate')}
                            sx={{
                                flex: 1,
                                bgcolor: appColor,
                                color: darkMode ? '#000' : '#fff',
                                fontWeight: 700,
                                '&:hover': { bgcolor: appColorHover }
                            }}
                        >
                            Generate
                        </Button>
                        )}
                    </Stack>

                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        disabled={isFinSaving || isFinGenerating}
                        startIcon={(isFinSaving || isFinGenerating) ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        onClick={handleFinalSave}
                        {...cb('brainstorm', 'save_template', 'Save template', 'handleFinalSave', 'click', 'needs_confirmation')}
                        sx={{
                            mt: 'auto',
                            py: 1.5,
                            borderRadius: 3,
                            bgcolor: darkMode ? '#fff' : '#000',
                            color: darkMode ? '#000' : '#fff',
                            fontWeight: 700,
                            fontSize: '1rem',
                            '&:hover': { opacity: 0.9 },
                            '&.Mui-disabled': {
                                bgcolor: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                                color: darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'
                            }
                        }}
                    >
                        {isFinSaving ? 'Saving...' : isFinGenerating ? 'Generating Image...' : 'Save Template'}
                    </Button>
                </Box>

                {/* Right/Bottom: Preview */}
                <Box sx={{
                    flex: { xs: '0 0 auto', md: 1 },
                    width: '100%',
                    position: 'relative',
                    bgcolor: darkMode ? '#000' : '#f5f5f5',
                    borderRadius: { xs: 3, sm: 4 },
                    overflow: 'hidden',
                    minHeight: { xs: 260, sm: 300 },
                    height: { xs: 300, sm: 360, md: 'auto' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                }}>
                    {isFinGenerating ? (
                        <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress sx={{ color: appColor }} size={48} thickness={4} />
                            <Typography sx={{ mt: 2, color: darkMode ? '#aaa' : '#666', fontWeight: 500 }}>
                                Generating Preview...
                            </Typography>
                        </Box>
                    ) : finImage ? (
                        <img
                            src={finImage}
                            alt="Finalize Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    ) : (
                        <Typography sx={{ color: darkMode ? '#aaa' : '#666', opacity: 0.5 }}>
                            No preview available
                        </Typography>
                    )}
                </Box>
            </Box>
        </Box>
    );

    useCreationControls('brainstorm', 'BrainstormChat', true, { view, isAIEnabled, finalizePromptMode, isFinSaving, isFinGenerating, imageQuality, inputLength: currentInput.length, ...(!isAIEnabled || view === 'finalize' ? { templateWorkflow: 'Create Template: edit name/script, Save Template opens Finalize. Finalize: choose style and cover quality; Original resets the current tab; Save persists to Library.' } : {}) });
    return (
        <Box
            data-template-creator={!isAIEnabled || view === 'finalize' ? 'true' : undefined}
            data-ai-snapshot-ignore={isAIEnabled && view === 'chat' ? 'true' : undefined}
            data-brainstorm-ui={isAIEnabled && view === 'chat' ? 'true' : undefined}
            sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
        }}>
            <Box sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                ...conciergeSurface(darkMode, appColor),
                borderRadius: 'inherit',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}>
                {/* Leave-brainstorm confirm overlay */}
                {showLeaveConfirm && (
                    <Box role="alertdialog" aria-modal="true" aria-label="Confirm leave brainstorm" onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) setShowLeaveConfirm(false); }} sx={{
                        position: 'absolute', inset: 0, zIndex: 30, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', p: 3,
                        bgcolor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)',
                        backdropFilter: 'blur(2px)',
                    }}>
                        <Box sx={{
                            width: '100%', maxWidth: 360, p: 3, borderRadius: 3, textAlign: 'center',
                            background: darkMode ? 'rgba(20,20,26,0.98)' : '#fff',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                            boxShadow: '0 18px 52px rgba(0,0,0,0.5)',
                            position: 'relative',
                        }}>
                            <Button
                                size="small"
                                variant="text"
                                onClick={() => { void clearBrainstormSession(); }}
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    minWidth: 0,
                                    px: 1,
                                    py: 0.4,
                                    borderRadius: 1.5,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: '#d32f2f',
                                    '&:hover': { bgcolor: 'rgba(211,47,47,0.08)' },
                                }}
                            >
                                Reset
                            </Button>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: darkMode ? '#fff' : '#111', mb: 1 }}>
                                Leave brainstorm?
                            </Typography>
                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', mb: 2.5 }}>
                                Leave keeps this Brainstorm session. Use Reset to wipe chat and memory, then close or stay to start fresh.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => setShowLeaveConfirm(false)}
                                    {...cb('brainstorm', 'stay', 'Stay in Brainstorm', 'setShowLeaveConfirm(false)')}
                                    sx={{ flex: 1, borderRadius: 2, fontWeight: 700, color: darkMode ? '#fff' : '#111', borderColor: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
                                >
                                    Stay
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => { setShowLeaveConfirm(false); closeBrainstormWithVoiceCleanup(); }}
                                    {...cb('brainstorm', 'leave', 'Close Brainstorm and preserve session', 'closeBrainstormWithVoiceCleanup', 'click', 'candidate', 'Leave Brainstorm and return to templates or prompts')}
                                    sx={{ flex: 1, borderRadius: 2, fontWeight: 800, bgcolor: appColor, color: darkMode ? '#000' : '#fff', '&:hover': { bgcolor: appColorHover } }}
                                >
                                    Leave
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}
                {isRagInjectorDevMode && showRagInjector && (
                    <Box sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 35,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: { xs: 2, md: 3 },
                        bgcolor: darkMode ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.35)',
                        backdropFilter: 'blur(3px)',
                    }}>
                        <input
                            ref={ragUploadInputRef}
                            type="file"
                            accept=".rag.txt,.txt,text/plain"
                            onChange={handleRagFileSelected}
                            style={{ display: 'none' }}
                        />
                        <Box sx={{
                            width: 'min(920px, 100%)',
                            maxHeight: 'min(720px, calc(100% - 24px))',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            borderRadius: 3,
                            background: darkMode ? 'rgba(18,18,24,0.98)' : '#fff',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                            boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
                        }}>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                                px: { xs: 2, md: 2.5 },
                                py: 2,
                                borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: `${appColor}22`,
                                        color: appColor,
                                        flexShrink: 0,
                                    }}>
                                        <StorageIcon />
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ color: darkMode ? '#fff' : '#111', fontWeight: 900, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                                            RAG Injector
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.52)', fontWeight: 700 }}>
                                            Dev scaffold
                                        </Typography>
                                    </Box>
                                </Box>
                                <IconButton
                                    onClick={() => { closeRagInstructionViewer(); setShowRagInjector(false); }}
                                    aria-label="Close RAG injector"
                                    sx={{ color: darkMode ? '#fff' : '#111' }}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                            <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button
                                        size="small"
                                        variant={ragLibraryView === 'session' ? 'contained' : 'outlined'}
                                        startIcon={<HistoryIcon />}
                                        onClick={() => { setRagLibraryView('session'); setSelectedRagDocument(null); }}
                                        sx={{
                                            borderRadius: 2,
                                            fontWeight: 900,
                                            bgcolor: ragLibraryView === 'session' ? appColor : 'transparent',
                                            color: ragLibraryView === 'session' ? (darkMode ? '#000' : '#fff') : (darkMode ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)'),
                                            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)',
                                            '&:hover': { bgcolor: ragLibraryView === 'session' ? appColorHover : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.045)') },
                                        }}
                                    >
                                        Session history{hasLoadedRagDocuments ? ` (${sessionRagDocuments.length})` : ''}
                                    </Button>
                                    <Button
                                        size="small"
                                        variant={ragLibraryView === 'instructions' ? 'contained' : 'outlined'}
                                        startIcon={<ArticleIcon />}
                                        onClick={() => { setRagLibraryView('instructions'); setSelectedRagDocument(null); }}
                                        sx={{
                                            borderRadius: 2,
                                            fontWeight: 900,
                                            bgcolor: ragLibraryView === 'instructions' ? appColor : 'transparent',
                                            color: ragLibraryView === 'instructions' ? (darkMode ? '#000' : '#fff') : (darkMode ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)'),
                                            borderColor: darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)',
                                            '&:hover': { bgcolor: ragLibraryView === 'instructions' ? appColorHover : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.045)') },
                                        }}
                                    >
                                        Instructions{hasLoadedRagDocuments ? ` (${instructionRagDocuments.length})` : ''}
                                    </Button>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                                    <Box>
                                        <Typography sx={{ color: darkMode ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)', fontWeight: 800 }}>
                                            {ragLibraryView === 'session' ? 'Brainstorm session history' : 'Base knowledge workspace'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                                            {ragLibraryView === 'session'
                                                ? 'Temporary creative memories for this device. They expire after 24 hours.'
                                                : 'Upload stores the exact RAG packet in S3 and rag_instructions.'}
                                        </Typography>
                                    </Box>
                                    {ragLibraryView === 'instructions' && (
                                        <Button
                                            variant="contained"
                                            startIcon={isRagUploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
                                            onClick={handleRagUploadButtonClick}
                                            disabled={isRagUploading}
                                            sx={{
                                                alignSelf: { xs: 'stretch', sm: 'center' },
                                                bgcolor: appColor,
                                                color: darkMode ? '#000' : '#fff',
                                                borderRadius: 2,
                                                fontWeight: 900,
                                                px: 2,
                                                '&:hover': { bgcolor: appColorHover },
                                            }}
                                        >
                                            {isRagUploading ? 'Uploading...' : 'Upload RAG'}
                                        </Button>
                                    )}
                                </Box>

                                <Box sx={{
                                    overflow: 'auto',
                                    borderRadius: 2,
                                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                                }}>
                                    <Box sx={{
                                        minWidth: { xs: 0, md: 760 },
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', md: '1.1fr 1.2fr 1.15fr 0.6fr 0.65fr 0.75fr' },
                                        gap: 1,
                                        px: 1.5,
                                        py: 1,
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)',
                                    }}>
                                        {ragTableLabels.map((label) => (
                                            <Typography key={label} variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.5)', fontWeight: 900 }}>
                                                {label}
                                            </Typography>
                                        ))}
                                    </Box>

                                    {isRagLoading ? (
                                        <Box sx={{ px: 1.5, py: 2, borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.075)' : 'rgba(0,0,0,0.06)'}` }}>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.6)', fontWeight: 700 }}>
                                                Loading RAG list...
                                            </Typography>
                                        </Box>
                                    ) : visibleRagDocuments.length === 0 ? (
                                        <Box sx={{ px: 1.5, py: 2, borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.075)' : 'rgba(0,0,0,0.06)'}` }}>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.6)', fontWeight: 700 }}>
                                                {emptyRagMessage}
                                            </Typography>
                                        </Box>
                                    ) : visibleRagDocuments.map((doc) => (
                                        <Box
                                            key={doc.docId}
                                            onClick={() => setSelectedRagDocument(doc)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setSelectedRagDocument(doc);
                                                }
                                            }}
                                            sx={{
                                                minWidth: { xs: 0, md: 760 },
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', md: '1.1fr 1.2fr 1.15fr 0.6fr 0.65fr 0.75fr' },
                                                gap: 1,
                                                px: 1.5,
                                                py: 1.25,
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.075)' : 'rgba(0,0,0,0.06)'}`,
                                            }}
                                        >
                                            {getRagTableCells(doc, ragLibraryView).map((cell, cellIndex) => (
                                                <Typography
                                                    key={`${doc.docId}-${cellIndex}`}
                                                    variant="body2"
                                                    sx={{
                                                        color: cellIndex === 3 ? appColor : cellIndex === 0 ? (darkMode ? '#fff' : '#111') : (darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.66)'),
                                                        fontWeight: cellIndex === 0 || cellIndex === 3 || cellIndex === 4 ? 900 : 700,
                                                        wordBreak: 'break-word',
                                                        lineHeight: 1.3,
                                                    }}
                                                >
                                                    {cell}
                                                </Typography>
                                            ))}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
                {selectedRagDocument && (
                    <Box sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 60,
                        bgcolor: 'rgba(0,0,0,0.58)',
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'flex-start',
                    }}>
                        <Box sx={{
                            width: { xs: '100vw', md: '60vw' },
                            height: '100vh',
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: darkMode ? 'rgba(14,14,19,0.98)' : '#fff',
                            borderRight: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                            boxShadow: '18px 0 60px rgba(0,0,0,0.45)',
                        }}>
                            <Box sx={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1.25,
                                px: { xs: 1.25, sm: 1.75 },
                                py: 1.35,
                                borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            }}>
                                <IconButton
                                    onClick={closeRagInstructionViewer}
                                    aria-label="Close RAG instruction viewer"
                                    sx={{ color: darkMode ? '#fff' : '#111', mt: -0.25, flexShrink: 0 }}
                                >
                                    <CloseIcon />
                                </IconButton>
                                <Box sx={{ minWidth: 0, pt: 0.35 }}>
                                    <Typography sx={{ color: darkMode ? '#fff' : '#111', fontWeight: 900, fontSize: { xs: '1rem', sm: '1.1rem' }, lineHeight: 1.18, wordBreak: 'break-word' }}>
                                        {selectedRagDocument.topic}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.54)' : 'rgba(0,0,0,0.52)', fontWeight: 800, wordBreak: 'break-word' }}>
                                        {isSessionMemoryDocument(selectedRagDocument) ? selectedRagDocument.displayId : selectedRagDocument.docId}
                                    </Typography>
                                </Box>                                <Tooltip title={isSessionMemoryDocument(selectedRagDocument) ? "Delete session memory" : "Delete RAG"}>
                                    <span style={{ marginLeft: 'auto' }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => openRagDeleteConfirm(selectedRagDocument)}
                                            disabled={selectedRagDocument.status === 'dummy' || isRagDeleting}
                                            aria-label={isSessionMemoryDocument(selectedRagDocument) ? "Delete session memory" : "Delete RAG instruction"}
                                            sx={{
                                                width: 44,
                                                height: 44,
                                                flexShrink: 0,
                                                alignSelf: 'flex-start',
                                                borderRadius: 2,
                                                color: '#ff6b6b',
                                                bgcolor: darkMode ? 'rgba(33,33,42,0.94)' : 'rgba(255,255,255,0.94)',
                                                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'}`,
                                                boxShadow: '0 10px 28px rgba(0,0,0,0.24)',
                                                '&:hover': { bgcolor: 'rgba(255,82,82,0.16)', borderColor: '#ff6b6b' },
                                                '&.Mui-disabled': { color: darkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)' },
                                            }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Box>

                            <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 1.5, sm: 2.25 }, pt: 2, pb: { xs: 14, sm: 16 } }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1, mb: 2 }}>
                                    {(isSessionMemoryDocument(selectedRagDocument)
                                        ? [
                                            ['kind', selectedRagDocument.memoryKindLabel || '-'],
                                            ['turns', formatTurnLabel(selectedRagDocument.turnStart, selectedRagDocument.turnEnd)],
                                            ['status', selectedRagDocument.status],
                                            ['expires', formatExpiryLabel(selectedRagDocument.expiresAt)],
                                            ['namespace', selectedRagDocument.namespace || '-'],
                                            ['vector', selectedRagDocument.vectorId ? `${selectedRagDocument.vectorId.slice(0, 22)}...` : '-'],
                                        ]
                                        : [
                                            ['db id', selectedRagDocument.databaseId || '-'],
                                            ['source', selectedRagDocument.sourceName],
                                            ['status', selectedRagDocument.status],
                                            ['chars', selectedRagDocument.instructions.length.toLocaleString()],
                                            ['chunks', selectedRagDocument.chunkCount],
                                            ['s3 path', `rag/instructions/${selectedRagDocument.docId}.rag.txt`],
                                        ]).map(([label, value]) => (
                                        <Box key={label} sx={{ border: `1px solid ${darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 1.5, p: 1 }}>
                                            <Typography variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)', fontWeight: 900 }}>
                                                {label}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.76)' : 'rgba(0,0,0,0.72)', fontWeight: 800, wordBreak: 'break-word' }}>
                                                {value}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>

                                <Box
                                    component="pre"
                                    sx={{
                                        m: 0,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                        fontSize: { xs: '0.8rem', sm: '0.86rem' },
                                        lineHeight: 1.62,
                                        color: darkMode ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.78)',
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.028)',
                                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                                        borderRadius: 2,
                                        p: { xs: 1.5, sm: 2 },
                                        cursor: 'text',
                                        userSelect: 'text',
                                        WebkitUserSelect: 'text',
                                        MozUserSelect: 'text',
                                        msUserSelect: 'text',
                                        '&::selection': {
                                            bgcolor: appColor,
                                            color: darkMode ? '#000' : '#fff',
                                        },
                                    }}
                                >
                                    {selectedRagDocument.instructions}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
                {ragDeleteConfirmDocument && (
                    <Box sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                        bgcolor: 'rgba(0,0,0,0.62)',
                        backdropFilter: 'blur(2px)',
                    }}>
                        <Box sx={{
                            width: 'min(420px, 100%)',
                            borderRadius: 2,
                            p: 2,
                            bgcolor: darkMode ? 'rgba(18,18,24,0.98)' : '#fff',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}`,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ color: darkMode ? '#fff' : '#111', fontWeight: 900 }}>
                                        {isSessionMemoryDocument(ragDeleteConfirmDocument) ? 'Delete memory' : 'Delete RAG'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', fontWeight: 800, wordBreak: 'break-word' }}>
                                        {isSessionMemoryDocument(ragDeleteConfirmDocument) ? ragDeleteConfirmDocument.displayId : ragDeleteConfirmDocument.docId}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size="small"
                                    onClick={() => { if (!isRagDeleting) { setRagDeleteConfirmDocument(null); setRagDeleteConfirmText(''); } }}
                                    disabled={isRagDeleting}
                                    sx={{ color: darkMode ? '#fff' : '#111' }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.66)' : 'rgba(0,0,0,0.66)', mb: 1.5 }}>
                                {isSessionMemoryDocument(ragDeleteConfirmDocument)
                                    ? 'Type delete to remove this Brainstorm session memory from Pinecone.'
                                    : 'Type delete to remove this RAG from Pinecone, S3, and the app database.'}
                            </Typography>
                            <TextField
                                fullWidth
                                size="small"
                                value={ragDeleteConfirmText}
                                onChange={(event) => setRagDeleteConfirmText(event.target.value)}
                                placeholder="delete"
                                autoFocus
                                disabled={isRagDeleting}
                                sx={{
                                    mb: 2,
                                    '& .MuiOutlinedInput-root': {
                                        color: darkMode ? '#fff' : '#111',
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)',
                                        '& fieldset': { borderColor: darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)' },
                                    },
                                }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                <Button
                                    onClick={() => { setRagDeleteConfirmDocument(null); setRagDeleteConfirmText(''); }}
                                    disabled={isRagDeleting}
                                    sx={{ color: darkMode ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)', fontWeight: 800 }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={isRagDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
                                    disabled={ragDeleteConfirmText.trim() !== 'delete' || isRagDeleting}
                                    onClick={handleConfirmRagDelete}
                                    sx={{
                                        bgcolor: '#ff5252',
                                        color: '#fff',
                                        fontWeight: 900,
                                        borderRadius: 1.5,
                                        '&:hover': { bgcolor: '#e53935' },
                                    }}
                                >
                                    Delete
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}
                {/* Header with Close Button */}
                <Box sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: { xs: 1.25, sm: 2.5 },
                    gap: { xs: 1, sm: 2 },
                    flexShrink: 0,
                    borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    // Hide header in finalize view if you want full immersion, or keep it for context?
                    // User said "replace the brainstorm body", so we keep the external modal shell
                    display: view === 'finalize' ? 'none' : 'flex'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, minWidth: 0, flex: 1 }}>
                        <Box sx={{
                            p: { xs: 0.8, sm: 1 },
                            borderRadius: { xs: '10px', sm: '12px' },
                            background: `linear-gradient(135deg, ${appColor} 0%, ${appColorDeep} 100%)`,
                            display: 'flex',
                            flexShrink: 0
                        }}>
                            <SmartToyIcon sx={{ color: darkMode ? '#000' : '#fff', fontSize: { xs: 20, sm: 24 } }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: darkMode ? '#fff' : '#000', fontSize: { xs: '1.05rem', sm: '1.25rem' }, lineHeight: 1.15, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isAIEnabled ? 'Brainstorm Assistant' : 'Create Template'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 2 }, alignItems: 'center', flexShrink: 0 }}>
                        {isAIEnabled && (
                            autoControlVisible ? (
                                <>
                                    <Box sx={{ display: 'none' }}><AutoControlRevealButton entry="chat" onEnableGuide={() => setGuideEnabled(true)} /></Box>
                                    <AutoControlPill placement="embedded" small />
                                </>
                            ) : <AutoControlRevealButton entry="chat" onEnableGuide={() => setGuideEnabled(true)} />
                        )}
                        {isAIEnabled && isConversationLedgerDevMode && (
                            <Tooltip title="Conversation cost and speed ledger (dev)">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<ReceiptLongIcon fontSize="small" />}
                                    onClick={openConversationLedger}
                                    aria-label="Open conversation cost ledger"
                                    sx={{
                                        borderRadius: { xs: '9px', sm: '10px' },
                                        fontWeight: 800,
                                        px: { xs: 0.75, sm: 1.5 },
                                        minWidth: { xs: 38, sm: 104 },
                                        height: { xs: 38, sm: 'auto' },
                                        borderColor: `${appColor}88`,
                                        color: appColor,
                                        '&:hover': { borderColor: appColor, bgcolor: `${appColor}14` },
                                        '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.75 } },
                                    }}
                                >
                                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                        Ledger
                                    </Box>
                                </Button>
                            </Tooltip>
                        )}
                        {isRagInjectorDevMode && (
                            <Tooltip title="Open RAG injector">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<StorageIcon fontSize="small" />}
                                    onClick={handleOpenRagInjector}
                                    sx={{
                                        borderRadius: { xs: '9px', sm: '10px' },
                                        fontWeight: 800,
                                        px: { xs: 0.75, sm: 1.5 },
                                        minWidth: { xs: 38, sm: 120 },
                                        height: { xs: 38, sm: 'auto' },
                                        borderColor: darkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
                                        color: darkMode ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.72)',
                                        '&:hover': { borderColor: appColor, color: appColor, bgcolor: `${appColor}12` },
                                        '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.75 } },
                                    }}
                                >
                                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                        RAG Injector
                                    </Box>
                                </Button>
                            </Tooltip>
                        )}
                        <Button
                            size="small"
                            variant={isAIEnabled ? 'contained' : 'outlined'}
                            onClick={() => setIsAIEnabled(!isAIEnabled)}
                            {...cb('brainstorm', 'ai_mode', 'Switch AI chat or manual template input', 'setIsAIEnabled')}
                            sx={{
                                borderRadius: '10px',
                                fontWeight: 700,
                                px: { xs: 1, sm: 2 },
                                minWidth: { xs: 62, sm: 72 },
                                height: { xs: 44, sm: 'auto' },
                                fontSize: { xs: '0.76rem', sm: '0.8125rem' },
                                lineHeight: 1.15,
                                bgcolor: isAIEnabled ? appColor : 'transparent',
                                borderColor: appColor,
                                color: isAIEnabled ? (darkMode ? '#000' : '#fff') : appColor,
                                '&:hover': {
                                    bgcolor: isAIEnabled ? appColorHover : 'rgba(255,255,255,0.05)',
                                    borderColor: appColorHover,
                                }
                            }}
                        >
                            {/* Labels the DESTINATION, not the current state. In AI chat mode
                                it offers Template; once manual template mode is on — the
                                "Create Template" panel — it offers the way back to Chat. */}
                            {isAIEnabled ? 'Template' : 'Chat'}
                        </Button>
                        <IconButton {...cb('brainstorm', 'close', 'Review leaving Brainstorm', 'setShowLeaveConfirm(true)')} onClick={() => setShowLeaveConfirm(true)} sx={{ color: darkMode ? '#fff' : '#000', width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, p: 0.5 }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>

                {/* Content Area */}
                <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    p: isPC ? 4 : { xs: 1.25, sm: 2 },
                    overflow: 'hidden'
                }}>
                    {view === 'finalize' ? (
                        finalizeContent
                    ) : isAIEnabled ? (
                        <>
                            {/* Music-video scene breakdown, pinned above the thread.
                                Collapsible because the chat is the main event here -
                                open it to hear a segment or retune the time breaker,
                                fold it away to read replies. */}
                            {musicPanel && (
                                <MusicScenePanel
                                    {...musicPanel}
                                    darkMode={darkMode}
                                    appColor={appColor}
                                    collapsible
                                    dense
                                    sx={{ mb: 1.5, flexShrink: 0 }}
                                />
                            )}

                            {/* Chat Messages */}
                            <Box {...cb('brainstorm', 'scroll', 'Scroll Brainstorm conversation', 'chat.scrollBy', 'scroll')} sx={{
                                flex: 2,
                                overflowY: 'auto', // Enable scrolling
                                mb: 2,
                                '&::-webkit-scrollbar': { width: '4px' },
                                '&::-webkit-scrollbar-thumb': { borderRadius: '2px', background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                            }}>
                                {chatHistory.length === 0 && (
                                    <Box sx={{ textAlign: 'center', mt: 4, px: 4 }}>
                                        <SmartToyIcon sx={{ fontSize: 64, color: appColor, opacity: 0.2, mb: 2 }} />
                                        <Typography variant="h6" sx={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', mb: 1 }}>
                                            Assistant Ready
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
                                            Hi Drop a Topic, Name , Idea Anything, Let's Talk
                                        </Typography>
                                    </Box>
                                )}
                                {chatHistory.map(msg => {
                                    if (msg.role === 'ai' && !msg.streaming && !msg.content?.trim()) return null;
                                    const isActionableAssistant = msg.role === 'ai' && !msg.streaming && !!msg.content?.trim();
                                    return (
                                    <Box
                                        key={msg.id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            mb: 3
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                maxWidth: msg.role === 'ai' ? { xs: 'calc(100% - 48px)', sm: '85%', lg: '50%' } : { xs: '85%', lg: '50%' },
                                                p: 2,
                                                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                                background: msg.role === 'user'
                                                    ? `linear-gradient(135deg, ${appColor} 0%, ${appColorDeep} 100%)`
                                                    : darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                                color: msg.role === 'user' ? (darkMode ? '#000' : '#fff') : darkMode ? '#e0e0e0' : '#333',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                // Allow copy/paste from chat bubbles (app disables selection elsewhere).
                                                userSelect: 'text',
                                                WebkitUserSelect: 'text',
                                                cursor: 'text',
                                            }}
                                        >
                                            {(msg.content || !(msg.role === 'ai' && msg.streaming)) && (
                                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: { xs: 14, lg: 15.4 }, lineHeight: 1.6 }}>
                                                    {msg.content}
                                                    {msg.role === 'ai' && msg.streaming && msg.content && (
                                                        <Box component="span" sx={{
                                                            display: 'inline-block', width: '7px', height: '1.05em', ml: '2px',
                                                            verticalAlign: 'text-bottom', borderRadius: '1px', bgcolor: appColor,
                                                            animation: 'clikbBlink 1s steps(1) infinite',
                                                            '@keyframes clikbBlink': { '50%': { opacity: 0 } },
                                                        }} />
                                                    )}
                                                </Typography>
                                            )}
                                            {msg.role === 'ai' && msg.streaming && !msg.content && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                                                    <Box sx={{
                                                        display: 'flex', gap: '4px',
                                                        '@keyframes clikbDot': {
                                                            '0%, 80%, 100%': { opacity: 0.2, transform: 'translateY(0)' },
                                                            '40%': { opacity: 1, transform: 'translateY(-3px)' },
                                                        },
                                                    }}>
                                                        {[0, 1, 2].map(i => (
                                                            <Box key={i} sx={{
                                                                width: 7, height: 7, borderRadius: '50%', bgcolor: appColor,
                                                                animation: 'clikbDot 1.2s infinite', animationDelay: `${i * 0.18}s`,
                                                            }} />
                                                        ))}
                                                    </Box>
                                                    {msg.status && (
                                                        <Typography variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', fontStyle: 'italic' }}>
                                                            {msg.status}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                            {isActionableAssistant && (
                                                <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={(event) => { event.stopPropagation(); handleUseMessage(msg); }}
                                                        {...cb('brainstorm', `use_${msg.id}`, 'Use this response in prompt', 'handleUseMessage', 'click', 'needs_handoff')}
                                                        sx={{
                                                            bgcolor: appColor,
                                                            color: darkMode ? '#000' : '#fff',
                                                            borderRadius: '8px',
                                                            fontWeight: 600,
                                                            '&:hover': { bgcolor: appColorHover }
                                                        }}
                                                    >
                                                        Use This
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={(event) => { event.stopPropagation(); onSaveClicked(msg); }}
                                                        {...cb('brainstorm', `finalize_${msg.id}`, 'Create template from response', 'onSaveClicked')}
                                                        sx={{
                                                            borderColor: appColor,
                                                            color: appColor,
                                                            borderRadius: '8px',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        Save Template
                                                    </Button>
                                                </Box>
                                            )}
                                        </Box>
                                        {msg.role === 'ai' && !msg.streaming && msg.content && (
                                            <Tooltip title={replayingMessageId === String(msg.id) ? "Stop response audio" : "Play response audio"}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleReplayAudioClick(msg);
                                                    }}
                                                    aria-label={replayingMessageId === String(msg.id) ? "Stop response audio" : "Play response audio"}
                                                    sx={{
                                                        alignSelf: 'flex-start',
                                                        mt: 0.75,
                                                        ml: 1,
                                                        width: { xs: 34, sm: 38 },
                                                        height: { xs: 34, sm: 38 },
                                                        flexShrink: 0,
                                                        color: appColor,
                                                        bgcolor: replayingMessageId === String(msg.id)
                                                            ? `${appColor}22`
                                                            : darkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)',
                                                        border: `1px solid ${replayingMessageId === String(msg.id) ? appColor : darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                                                        '&:hover': {
                                                            bgcolor: `${appColor}20`,
                                                            borderColor: appColor,
                                                        },
                                                    }}
                                                >
                                                    {replayingMessageId === String(msg.id) ? <StopIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </Box>

                            {/* Voice status / wave meter */}
                            {voice.status !== 'idle' && (
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: { xs: 1, sm: 1.25 },
                                    px: { xs: 1.25, sm: 2 },
                                    py: { xs: 0.9, sm: 1 },
                                    mb: 1,
                                    minHeight: { xs: 50, sm: 56 },
                                    flexShrink: 0,
                                    borderRadius: 3,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    bgcolor: voice.status === 'error'
                                        ? 'rgba(211,47,47,0.12)'
                                        : (darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)'),
                                    border: `1px solid ${voice.status === 'error' ? 'rgba(255,107,107,0.22)' : (darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)')}`,
                                    boxShadow: voice.status === 'error' ? 'none' : `inset 0 0 0 1px ${appColor}08`,
                                    '@keyframes clikbVoiceBarPulse': {
                                        '0%, 100%': { transform: 'scaleY(0.45)', opacity: 0.48 },
                                        '50%': { transform: 'scaleY(1)', opacity: 1 },
                                    },
                                    '@keyframes clikbVoiceWaitPulse': {
                                        '0%, 100%': { transform: 'scaleY(0.62)', opacity: 0.52 },
                                        '50%': { transform: 'scaleY(0.92)', opacity: 0.9 },
                                    },
                                }}>
                                    {voice.status === 'error' ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                                            <Typography variant="body2" sx={{ color: '#ff6b6b', fontWeight: 700, minWidth: 0, flex: '1 1 240px' }}>
                                                Voice error: {voice.error || 'unknown - check console'}
                                            </Typography>
                                            {voice.canRetryAudio && (
                                                <Button
                                                    size="small"
                                                    onClick={() => { void voice.retryLastAudio(); }}
                                                    sx={{
                                                        color: '#ffd6d6',
                                                        border: '1px solid rgba(255,214,214,0.45)',
                                                        fontWeight: 900,
                                                        fontSize: { xs: '0.68rem', sm: '0.75rem' },
                                                        px: 1,
                                                        minWidth: { xs: 74, sm: 92 },
                                                    }}
                                                >
                                                    Retry voice
                                                </Button>
                                            )}

                                            <Button
                                                size="small"
                                                onClick={voice.stop}
                                                sx={{
                                                    color: 'rgba(255,214,214,0.76)',
                                                    fontWeight: 900,
                                                    fontSize: { xs: '0.68rem', sm: '0.75rem' },
                                                    px: 1,
                                                    minWidth: { xs: 44, sm: 58 },
                                                }}
                                            >
                                                Stop
                                            </Button>
                                        </Box>
                                    ) : (
                                        <>
                                            <Box sx={{
                                                position: 'relative',
                                                flex: 1,
                                                minWidth: 0,
                                                height: { xs: 28, sm: 30 },
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: { xs: '2px', sm: '3px' },
                                                px: { xs: 1, sm: 1.25 },
                                                overflow: 'hidden',
                                                borderRadius: 999,
                                                bgcolor: `${appColor}18`,
                                                border: `1px solid ${appColor}26`,
                                            }}>
                                                {Array.from({ length: 34 }).map((_, i) => {
                                                    const wave = (Math.sin(i * 0.78) + 1) / 2;
                                                    const speechLevel = Math.max(0.08, Math.min(1, voice.level));
                                                    const showLiveWave = voice.status === 'listening' || voice.status === 'speaking';
                                                    const baseHeight = showLiveWave
                                                        ? 6 + speechLevel * 24 * (0.45 + wave * 0.72)
                                                        : voiceIsWaiting
                                                            ? 7 + wave * 13
                                                            : 10 + ((i % 6) * 2.1);
                                                    const height = Math.max(6, Math.min(28, baseHeight));
                                                    return (
                                                        <Box
                                                            key={i}
                                                            sx={{
                                                                position: 'relative',
                                                                zIndex: 1,
                                                                flex: '1 1 0',
                                                                minWidth: { xs: 2, sm: 3 },
                                                                maxWidth: 5,
                                                                height,
                                                                borderRadius: 999,
                                                                bgcolor: appColor,
                                                                opacity: showLiveWave ? 0.95 : (voiceIsWaiting ? 0.62 : 0.72),
                                                                transformOrigin: 'center',
                                                                transition: showLiveWave ? 'height 80ms linear, opacity 120ms ease' : 'none',
                                                                animation: voiceIsWaiting
                                                                    ? 'clikbVoiceWaitPulse 1.35s ease-in-out infinite'
                                                                    : 'none',
                                                                animationDelay: `${i * 32}ms`,
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: darkMode ? 'rgba(255,255,255,0.76)' : 'rgba(0,0,0,0.72)',
                                                    fontWeight: 800,
                                                    fontSize: { xs: '0.76rem', sm: '0.875rem' },
                                                    minWidth: { xs: 78, sm: 96 },
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {voiceStatusLabel}
                                            </Typography>

                                            <Button
                                                size="small"
                                                onClick={voice.stop}
                                                sx={{
                                                    ml: { xs: 0, sm: 0.25 },
                                                    minWidth: { xs: 44, sm: 58 },
                                                    px: { xs: 0.75, sm: 1 },
                                                    color: darkMode ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.58)',
                                                    fontWeight: 900,
                                                    fontSize: { xs: '0.68rem', sm: '0.75rem' },
                                                }}
                                            >
                                                Stop
                                            </Button>
                                        </>
                                    )}
                                </Box>
                            )}
                            {/* Input Area */}
                            <Box sx={{ display: { xs: 'grid', sm: 'flex' }, gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'none' }, flexWrap: { sm: 'nowrap' }, gap: { xs: 1, sm: 1.5 }, rowGap: { xs: 1, sm: 1.5 }, flexShrink: 0, mt: 'auto', alignItems: { xs: 'stretch', sm: 'center' } }}>
                                <Tooltip title={webSearchDisabled
                                    ? 'Online Access is unavailable with Replicate conversation models'
                                    : webSearch
                                        ? 'Web search ON — replies use live info (typed out)'
                                        : 'Web search OFF — faster streaming'}>
                                    <span>
                                    <IconButton
                                        onClick={webSearchDisabled ? undefined : onToggleWebSearch}
                                        {...cb('brainstorm', 'web', 'Toggle online access', 'onToggleWebSearch')}
                                        disabled={webSearchDisabled}
                                        aria-label={webSearchDisabled ? 'Online Access unavailable for this conversation model' : 'Toggle web search'}
                                        sx={{
                                            order: { xs: 2, sm: 0 },
                                            width: { xs: '100%', sm: 48 },
                                            height: { xs: 52, sm: 48 },
                                            minWidth: 0,
                                            flex: { xs: '1 1 0', sm: '0 0 auto' },
                                            flexShrink: { xs: 1, sm: 0 },
                                            borderRadius: { xs: 2.5, sm: 3 },
                                            border: `1px solid ${webSearch ? appColor : (darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)')}`,
                                            color: webSearch ? appColor : (darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'),
                                            background: webSearch ? `${appColor}22` : (darkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)'),
                                            transition: 'all 0.2s',
                                            '&:hover': { borderColor: appColor, background: `${appColor}1a` },
                                            '&.Mui-disabled': {
                                                borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                                color: darkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)',
                                                background: 'transparent',
                                            },
                                        }}
                                    >
                                        <PublicIcon />
                                    </IconButton>
                                    </span>
                                </Tooltip>
                                <FishVoicePreviewManager />
                                <Tooltip title={`Voice: ${selectedVoiceMeta.label} (${selectedVoiceMeta.gender}, ${selectedVoiceMeta.tone})`}>
                                    <IconButton
                                        onClick={(event) => setVoiceMenuAnchor(event.currentTarget)}
                                        aria-label="Choose voice"
                                        sx={{
                                            order: { xs: 3, sm: 0 },
                                            width: { xs: '100%', sm: 48 },
                                            height: { xs: 52, sm: 48 },
                                            minWidth: 0,
                                            flex: { xs: '1 1 0', sm: '0 0 auto' },
                                            flexShrink: { xs: 1, sm: 0 },
                                            borderRadius: { xs: 2.5, sm: 3 },
                                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`,
                                            color: appColor,
                                            background: darkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)',
                                            transition: 'all 0.2s',
                                            '&:hover': { borderColor: appColor, background: `${appColor}1a` },
                                        }}
                                    >
                                        <RecordVoiceOverIcon />
                                    </IconButton>
                                </Tooltip>
                                <Menu
                                    anchorEl={voiceMenuAnchor}
                                    open={Boolean(voiceMenuAnchor)}
                                    onClose={() => setVoiceMenuAnchor(null)}
                                    sx={matchMobile ? { zIndex: 2147483001 } : undefined}
                                    PaperProps={{
                                        sx: {
                                            bgcolor: darkMode ? '#16161a' : '#fff',
                                            color: darkMode ? '#fff' : '#111',
                                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'}`,
                                            minWidth: 300,
                                            maxHeight: 420,
                                        },
                                    }}
                                >
                                    {voiceOptions.map((option) => (
                                        <MenuItem
                                            key={option.id}
                                            selected={selectedVoice === option.id}
                                            onClick={() => {
                                                dispatch(setBrainstormSelectedVoice(option.id));
                                                setVoiceMenuAnchor(null);
                                            }}
                                            sx={{ gap: 1.25, minHeight: 64, pr: 1 }}
                                        >
                                            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 188, flex: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{option.label}</Typography>
                                                <Typography variant="caption" sx={{ opacity: 0.78, lineHeight: 1.4 }}>
                                                    {option.gender} - {option.tone}
                                                </Typography>
                                            </Box>
                                            <Tooltip title={previewingVoice === option.id ? 'Stop preview' : 'Play preview'}>
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggleVoicePreview(option);
                                                    }}
                                                    aria-label={`${previewingVoice === option.id ? 'Stop' : 'Play'} ${option.label} preview`}
                                                    disabled={!option.previewUrl}
                                                    sx={{
                                                        color: selectedVoice === option.id ? appColor : (darkMode ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.7)'),
                                                        border: `1px solid ${selectedVoice === option.id ? appColor : 'transparent'}`,
                                                    }}
                                                >
                                                    {previewingVoice === option.id ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                        </MenuItem>
                                    ))}
                                </Menu>
                                <TextField
                                    fullWidth
                                    placeholder="Ask me anything..."
                                    value={currentInput}
                                    onChange={e => setCurrentInput(e.target.value)}
                                    {...cb('brainstorm', 'input', 'Brainstorm message', 'setCurrentInput', 'text', 'needs_handoff')}
                                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    inputProps={{
                                        style: {
                                            caretColor: darkMode ? '#ffffff' : '#000000',
                                            color: darkMode ? '#ffffff' : '#000000'
                                        }
                                    }}
                                    sx={{
                                        order: { xs: 1, sm: 0 },
                                        gridColumn: { xs: '1 / -1', sm: 'auto' },
                                        flexBasis: { xs: '100%', sm: 'auto' },
                                        minWidth: 0,
                                        ...(matchMobile ? {
                                            width: '100% !important',
                                            maxWidth: '100% !important',
                                        } : {}),
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: { xs: 3, sm: 4 },
                                            minHeight: { xs: 48, sm: 56 },
                                            background: darkMode ? 'rgba(255,255,255,0.105)' : 'rgba(255,255,255,0.94)',
                                            color: darkMode ? '#fff' : '#000',
                                            boxShadow: darkMode ? '0 8px 22px rgba(0,0,0,0.22)' : '0 8px 22px rgba(0,0,0,0.08)',
                                            '& fieldset': { borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)' },
                                            '&:hover fieldset': { borderColor: appColor },
                                            '&.Mui-focused fieldset': { borderColor: appColor }
                                        },
                                        '& .MuiInputBase-input': {
                                            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
                                        },
                                        '& input': {
                                            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
                                        },
                                        '& .MuiInputBase-input::placeholder': {
                                            color: darkMode ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.48)',
                                            opacity: 1
                                        }
                                    }}
                                />
                                <Tooltip title={voice.active ? `Voice: ${voice.status} - tap to stop` : 'Talk instead of type'}>
                                    <IconButton
                                        onClick={voice.toggle}
                                        {...cb('brainstorm', 'voice', 'Voice/text control (user operated)', 'voice.toggle', 'click', 'information_only')}
                                        aria-label="Voice mode"
                                        sx={{
                                            order: { xs: 4, sm: 0 },
                                            justifySelf: { xs: 'center', sm: 'auto' },
                                            width: { xs: 52, sm: 56 },
                                            height: { xs: 52, sm: 56 },
                                            minWidth: { xs: 52, sm: 56 },
                                            flex: { xs: '0 0 auto', sm: '0 0 auto' },
                                            flexShrink: { xs: 1, sm: 0 },
                                            borderRadius: '50%',
                                            color: voice.active ? (darkMode ? '#000' : '#fff') : appColor,
                                            background: voice.active
                                                ? `linear-gradient(135deg, ${appColor} 0%, ${appColorDeep} 100%)`
                                                : (darkMode ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)'),
                                            border: voice.active ? 'none' : `1px solid ${appColor}`,
                                            transition: 'all 0.2s',
                                            animation: voice.active ? 'clikbVoicePulse 1.4s ease-in-out infinite' : 'none',
                                            '@keyframes clikbVoicePulse': {
                                                '0%,100%': { boxShadow: `0 0 0 0 ${appColor}66` },
                                                '50%': { boxShadow: `0 0 0 8px ${appColor}00` },
                                            },
                                            '&:hover': { opacity: 0.9, transform: { xs: 'none', sm: 'scale(1.05)' } },
                                        }}
                                    >
                                        <MicIcon />
                                    </IconButton>
                                </Tooltip>
                                <IconButton
                                    onClick={handleSendMessage}
                                    {...cb('brainstorm', 'send', 'Send Brainstorm message', 'handleSendMessage', 'click', 'needs_handoff')}
                                    sx={{
                                        justifySelf: { xs: 'center', sm: 'auto' },
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${appColor} 0%, ${appColorDeep} 100%)`,
                                        color: darkMode ? '#000' : '#fff',
                                        order: { xs: 5, sm: 0 },
                                        width: { xs: 52, sm: 56 },
                                        height: { xs: 52, sm: 56 },
                                        minWidth: { xs: 52, sm: 56 },
                                        flex: { xs: '0 0 auto', sm: '0 0 auto' },
                                        '&:hover': { opacity: 0.9, transform: { xs: 'none', sm: 'scale(1.05)' } },
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <SendIcon />
                                </IconButton>
                            </Box>
                        </>
                    ) : (
                        /* Manual Template Creation - Modern Two-Panel Layout */
                        <Box sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: isPC ? 'row' : 'column',
                            gap: isPC ? 4 : 2,
                            maxWidth: isPC ? 1200 : 700,

                            mx: 'auto',
                            width: '100%',
                            overflow: 'hidden'
                        }}>
                            {/* Panel 1: Settings & Actions */}
                            <Box sx={{
                                flex: isPC ? '0 0 320px' : '0 0 auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                height: 'auto'
                            }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Template Name"
                                    placeholder="e.g. Cinema Master"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    {...cb('brainstorm', 'manual_name', 'Manual template name', 'setManualName', 'text')}
                                    inputProps={{
                                        style: {
                                            caretColor: darkMode ? '#ffffff' : '#000000',
                                            color: darkMode ? '#ffffff' : '#000000'
                                        }
                                    }}
                                    sx={{
                                        mt: 1,
                                        width: isPC ? '400px' : '100%',
                                        flexShrink: 0,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            color: darkMode ? '#fff' : '#000',
                                            '& fieldset': { borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                            '&:hover fieldset': { borderColor: appColor },
                                            '&.Mui-focused fieldset': { borderColor: appColor }
                                        },
                                        '& .MuiInputBase-input': {
                                            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
                                        },
                                        '& input': {
                                            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                            '&.Mui-focused': { color: appColor }
                                        }
                                    }}
                                />

                                {isPC && (
                                    <Box sx={{ mt: 1, mb: 2, display: 'flex', flexDirection: 'row', gap: 2 }}>
                                        <Button
                                            variant="contained"
                                            onClick={handleManualUse}
                                            {...cb('brainstorm', 'manual_use', 'Use manual prompt', 'handleManualUse')}
                                            sx={{
                                                bgcolor: appColor,
                                                color: darkMode ? '#000' : '#fff',
                                                py: 1,
                                                px: 4,
                                                fontSize: 14,
                                                fontWeight: 700,
                                                borderRadius: '10px',
                                                '&:hover': { bgcolor: appColorHover, transform: 'translateY(-1px)' },
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Use Now
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            onClick={() => {
                                                if (!manualPrompt.trim()) return;
                                                cancelFinalizeGeneration();
                                                setImageQuality('sd');
                                                imageQualityRef.current = 'sd';
                                                setBaseTemplatePrompt(manualPrompt);
                                                setFinalizeTitle(manualName);
                                                setFinalizePrompt(manualPrompt);
                                                const deductedCover = distillCoverArtPromptRuleBased(manualPrompt, manualName, finalizeArtStyle);
                                                setFinalizeImagePrompt(deductedCover);
                                                setBaseImagePrompt(deductedCover);
                                                setFinalizePromptMode('template');
                                                setFinImage(null);
                                                setView('finalize');
                                            }}
                                            {...cb('brainstorm', 'manual_finalize', 'Create template from manual prompt', 'setView(finalize)')}
                                            sx={{
                                                borderColor: appColor,
                                                color: appColor,
                                                py: 1,
                                                px: 4,
                                                fontSize: 14,
                                                fontWeight: 700,
                                                borderRadius: '10px',
                                                borderWidth: 2,
                                                '&:hover': { borderWidth: 2, borderColor: appColorHover, background: 'rgba(255,255,255,0.05)', transform: 'translateY(-1px)' },
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Save Template
                                        </Button>
                                    </Box>
                                )}
                            </Box>

                            {/* Panel 2: Big Editor */}
                            <Box sx={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0,
                                height: isPC ? '85%' : '100%',
                                alignSelf: isPC ? 'flex-start' : 'stretch'
                            }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    size="small"
                                    label="Template Prompt Content"
                                    placeholder="Enter your detailed prompt instructions here..."
                                    value={manualPrompt}
                                    onChange={e => setManualPrompt(e.target.value)}
                                    {...cb('brainstorm', 'manual_prompt', 'Manual template prompt', 'setManualPrompt', 'text')}
                                    inputProps={{
                                        style: {
                                            caretColor: darkMode ? '#ffffff' : '#000000',
                                            color: darkMode ? '#ffffff' : '#000000'
                                        }
                                    }}
                                    sx={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        '& .MuiOutlinedInput-root': {
                                            flex: 1,
                                            borderRadius: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            color: darkMode ? '#fff' : '#000',
                                            backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                            '& fieldset': { borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                            '&:hover fieldset': { borderColor: appColor },
                                            '&.Mui-focused fieldset': { borderColor: appColor },
                                        },
                                        '& .MuiInputBase-input': {
                                            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
                                            overflow: 'auto !important',
                                            height: '100% !important',
                                            flex: 1,
                                            boxSizing: 'border-box',
                                            padding: '16px !important',
                                            fontSize: '0.95rem',
                                            lineHeight: 1.5,
                                            '&::placeholder': {
                                                color: darkMode ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.48)',
                                                opacity: 1
                                            }
                                        },
                                        '& input': {
                                            caretColor: `${darkMode ? '#ffffff' : '#000000'} !important`,
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                            '&.Mui-focused': { color: appColor }
                                        }
                                    }}
                                />

                                {!isPC && (
                                    <Box sx={{ display: 'flex', gap: 2, mt: 1.5, mb: 1 }}>
                                        <Button
                                            variant="contained"
                                            onClick={handleManualUse}
                                            {...cb('brainstorm', 'manual_use', 'Use manual prompt', 'handleManualUse')}
                                            fullWidth
                                            sx={{
                                                bgcolor: appColor,
                                                color: darkMode ? '#000' : '#fff',
                                                py: 1.2,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                borderRadius: '8px'
                                            }}
                                        >
                                            Use Now
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            onClick={() => {
                                                if (!manualPrompt.trim()) return;
                                                cancelFinalizeGeneration();
                                                setImageQuality('sd');
                                                imageQualityRef.current = 'sd';
                                                setBaseTemplatePrompt(manualPrompt);
                                                setFinalizeTitle(manualName);
                                                setFinalizePrompt(manualPrompt);
                                                const deductedCover = distillCoverArtPromptRuleBased(manualPrompt, manualName, finalizeArtStyle);
                                                setFinalizeImagePrompt(deductedCover);
                                                setBaseImagePrompt(deductedCover);
                                                setFinalizePromptMode('template');
                                                setFinImage(null);
                                                setView('finalize');
                                            }}
                                            fullWidth
                                            {...cb('brainstorm', 'manual_finalize', 'Create template from manual prompt', 'setView(finalize)')}
                                            sx={{
                                                borderColor: appColor,
                                                color: appColor,
                                                py: 1.2,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                borderRadius: '8px',
                                                borderWidth: 2
                                            }}
                                        >
                                            Save
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>

            {isConversationLedgerDevMode && (
                <Dialog
                    open={showConversationLedger}
                    onClose={() => setShowConversationLedger(false)}
                    fullWidth
                    maxWidth="md"
                    aria-labelledby="conversation-ledger-title"
                    sx={{ zIndex: 1800 }}
                    PaperProps={{
                        sx: {
                            maxHeight: '88vh',
                            borderRadius: { xs: 2.5, sm: 4 },
                            color: darkMode ? '#fff' : '#111',
                            ...conciergeSurface(darkMode, appColor),
                            border: `1px solid ${appColor}55`,

                        },
                    }}
                >
                    <DialogTitle id="conversation-ledger-title" sx={{ pb: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <ReceiptLongIcon sx={{ color: appColor }} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                                    Conversation Cost Ledger
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.68 }}>
                                    Dev-only local measurement receipt · no database
                                </Typography>
                            </Box>
                            <IconButton onClick={() => setShowConversationLedger(false)} aria-label="Close ledger" sx={{ color: 'inherit' }}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <Divider />
                    <DialogContent sx={{ py: 2.25 }}>
                        {conversationLedgerExportError && <Alert severity="error" sx={{ mb: 2 }}>{conversationLedgerExportError}</Alert>}
                        {isConversationLedgerLoading && !conversationLedger ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 7 }}>
                                <CircularProgress sx={{ color: appColor }} />
                            </Box>
                        ) : conversationLedgerError ? (
                            <Alert severity="error">{conversationLedgerError}</Alert>
                        ) : !conversationLedger?.ledger ? (
                            <Alert severity="info">
                                No measured calls yet. Send a concierge message or run voice/control, then press Refresh.
                            </Alert>
                        ) : (
                            <Stack spacing={2}>
                                {conversationLedger.ledger.summary.projectionStatus === 'preliminary_under_10_minutes' && (
                                    <Alert severity="warning">
                                        Preliminary projection: run at least 10 minutes—and ideally the full hour—for a representative continuous-use cost.
                                    </Alert>
                                )}
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1 }}>
                                    {[
                                        ['Measured cost', `$${conversationLedger.ledger.summary.totalCostUsd.toFixed(6)}`],
                                        ['Projected / hour', `$${conversationLedger.ledger.summary.projectedOneHourCostUsd.toFixed(4)}`],
                                        ['Requests', String(conversationLedger.ledger.summary.requestCount)],
                                        ['Measured window', `${conversationLedger.ledger.summary.measuredWindowSeconds.toFixed(1)}s`],
                                    ].map(([label, value]) => (
                                        <Box key={label} sx={{ p: 1.4, borderRadius: 2.25, bgcolor: darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.035)', border: `1px solid ${appColor}2d` }}>
                                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.64, fontWeight: 700 }}>{label}</Typography>
                                            <Typography sx={{ fontWeight: 900, color: appColor, overflowWrap: 'anywhere' }}>{value}</Typography>
                                        </Box>
                                    ))}
                                </Box>

                                <Box>
                                    <Typography sx={{ fontWeight: 900, mb: 0.75 }}>Speed</Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                        Request avg {conversationLedger.ledger.summary.speedMs.averageRequest} ms · P50 {conversationLedger.ledger.summary.speedMs.p50Request} ms · P95 {conversationLedger.ledger.summary.speedMs.p95Request} ms · First token avg {conversationLedger.ledger.summary.speedMs.averageTimeToFirstToken !== null && conversationLedger.ledger.summary.speedMs.averageTimeToFirstToken !== undefined ? `${conversationLedger.ledger.summary.speedMs.averageTimeToFirstToken} ms` : 'unavailable'} ({conversationLedger.ledger.summary.speedMs.validFirstTokenSamples ?? 0} valid / {conversationLedger.ledger.summary.speedMs.missingFirstTokenSamples ?? 0} missing)
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography sx={{ fontWeight: 900, mb: 1 }}>Provider breakdown</Typography>
                                    <Stack spacing={0.75}>
                                        {conversationLedger.ledger.summary.providerTotals.length ? conversationLedger.ledger.summary.providerTotals.map(row => (
                                            <Box key={`${row.provider}:${row.model}:${row.reasoningEffort || "unspecified"}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(180px, 1fr) repeat(3, auto)' }, columnGap: 2, rowGap: 0.25, p: 1.15, borderRadius: 2, bgcolor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.028)' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{row.provider} · {row.model} · {row.reasoningEffort || "unspecified effort"}</Typography>
                                                <Typography variant="body2">{row.calls} call{row.calls === 1 ? '' : 's'}</Typography>
                                                <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>{row.durationSeconds.toFixed(1)}s audio</Typography>
                                                <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>${row.costUsd.toFixed(7)}</Typography>
                                            </Box>
                                        )) : (
                                            <Typography variant="body2" sx={{ opacity: 0.65 }}>No provider calls recorded.</Typography>
                                        )}
                                    </Stack>
                                </Box>

                                <Box>
                                    <Typography sx={{ fontWeight: 900, mb: 0.75 }}>Official pricing sources</Typography>
                                    <Stack spacing={0.35}>
                                        {Object.entries(conversationLedger.pricing?.sources || {}).map(([name, url]) => (
                                            <Typography key={name} component="a" href={url} target="_blank" rel="noreferrer" variant="caption" sx={{ color: appColor, overflowWrap: 'anywhere' }}>
                                                {name}: {url}
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>

                                <Box>
                                    <Typography sx={{ fontWeight: 900, mb: 0.75 }}>Recent measured requests (showing {conversationLedger.ledger.records?.length ?? 0} of {conversationLedger.ledger.totalRecordCount ?? conversationLedger.ledger.summary.requestCount})</Typography>
                                    <Box component="pre" sx={{ m: 0, p: 1.5, maxHeight: 260, overflow: 'auto', borderRadius: 2, fontSize: '0.69rem', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', bgcolor: darkMode ? '#090a0c' : '#f5f6f8', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}` }}>
                                        {conversationLedger.ledger.records?.length ? conversationLedger.ledger.records.slice(0, 25).map((rec, idx) => `${rec.startedAt || ''} · ${rec.route || ''} (${rec.actionLabel || rec.stage || 'call'}) · ${rec.status || ''} · ${rec.elapsedMs ?? 0} ms`).join('\n') : 'No recent request rows.'}
                                    </Box>
                                    {conversationLedger.logPath && (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, opacity: 0.58, overflowWrap: 'anywhere' }}>
                                            Local file: {conversationLedger.logPath}
                                        </Typography>
                                    )}
                                </Box>
                            </Stack>
                        )}
                    </DialogContent>
                    <Divider />
                    <DialogActions sx={{ px: 2.5, py: 1.5 }}>
                        <Button onClick={startFreshConversationMeasurement} sx={{ color: darkMode ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.66)' }}>
                            New test
                        </Button>
                        <Button
                            onClick={() => void downloadConversationLedger()}
                            startIcon={isConversationLedgerExporting ? <CircularProgress size={15} /> : undefined}
                            disabled={!conversationLedger?.ledger || isConversationLedgerExporting}
                            sx={{ color: darkMode ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.78)' }}
                        >
                            {isConversationLedgerExporting ? 'Downloading…' : 'Download JSON'}
                        </Button>
                        <Button onClick={() => void loadConversationLedger()} disabled={isConversationLedgerLoading} startIcon={isConversationLedgerLoading ? <CircularProgress size={15} /> : <RefreshIcon />} sx={{ color: darkMode ? '#fff' : '#222' }}>
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => void copyConversationLedger()}
                            disabled={!conversationLedger}
                            startIcon={<ContentCopyIcon />}
                            sx={{ ml: 'auto', bgcolor: appColor, color: darkMode ? '#000' : '#fff', fontWeight: 900, '&:hover': { bgcolor: appColorHover } }}
                        >
                            {conversationLedgerCopied ? 'Copied' : 'Copy report'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%', borderRadius: 3 }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};
import { creationBinding as cb } from '../creationControlSnapshot';
import { useCreationControls } from '../useCreationControls';
