// src/components/BrainstormChat.tsx
import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography, TextField, Button, useTheme, useMediaQuery, CircularProgress, Stack, Snackbar, Alert, Tooltip, Menu, MenuItem } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PublicIcon from '@mui/icons-material/Public';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import { ChatMessage } from '../PromptConstructorMock';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { useBrainstormSession } from './BrainstormSessionProvider';
import { setBrainstormSelectedVoice } from '../brainstormSlice';

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
    /** Voice relay: transcribed speech -> OpenAI brain -> reply text (spoken by Gemini). */
    onVoiceAsk?: (text: string, signal?: AbortSignal) => Promise<string>;
}

type ViewMode = 'chat' | 'finalize';
type FinalizePromptMode = 'template' | 'image';

const VOICE_OPTIONS = [
    { id: 'Zephyr', label: 'Zephyr', tone: 'Bright', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-eef20480b0b0285f2de0195ddc50ebc5.mp3' },
    { id: 'Puck', label: 'Puck', tone: 'Upbeat', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-1f5b099f09a4b39c38e669bd0460d9dd.mp3' },
    { id: 'Kore', label: 'Kore', tone: 'Firm', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-89665cf8e9418f0e9fa27bda9f511755.mp3' },
    { id: 'Charon', label: 'Charon', tone: 'Informative', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-4c77fed3ffcccb0e44553c918542ca17.mp3' },
    { id: 'Leda', label: 'Leda', tone: 'Youthful', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5bcde8e7737ee8eab3f64ac428b3a778.mp3' },
    { id: 'Fenrir', label: 'Fenrir', tone: 'Excitable', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-0ecd2a46802b6054b7069f6deda884b2.mp3' },
    { id: 'Aoede', label: 'Aoede', tone: 'Breezy', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-45ac4df46ff7b180416793679ca26e9c.mp3' },
    { id: 'Orus', label: 'Orus', tone: 'Firm', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-6806f2b96a741dfa2fab55840ebcf532.mp3' },
    { id: 'Callirrhoe', label: 'Callirrhoe', tone: 'Easy-going', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-59c6c900223d2dfdf200a28fce986c00.mp3' },
    { id: 'Enceladus', label: 'Enceladus', tone: 'Breathy', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-9f7fcff725015f515d19983e986e0485.mp3' },
    { id: 'Autonoe', label: 'Autonoe', tone: 'Bright', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5fd4e7f22f0b63f3e0dcf31430eefed8.mp3' },
    { id: 'Iapetus', label: 'Iapetus', tone: 'Clear', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-62a997c00eb23deba3188a6e2a9a61b4.mp3' },
    { id: 'Despina', label: 'Despina', tone: 'Smooth', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-e95c82d61222e9f151aec43d954b860a.mp3' },
    { id: 'Umbriel', label: 'Umbriel', tone: 'Easy-going', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-08dc0816df6f93b541843364a93b923b.mp3' },
    { id: 'Erinome', label: 'Erinome', tone: 'Clear', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5c41fe35b90a9a9c1dc0ed46aba21393.mp3' },
    { id: 'Algenib', label: 'Algenib', tone: 'Gravelly', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-a4dac817bd9f810d13ce008d97a00916.mp3' },
    { id: 'Laomedeia', label: 'Laomedeia', tone: 'Upbeat', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-a5180c8d80b7c9dd114ac7493eb119aa.mp3' },
    { id: 'Algieba', label: 'Algieba', tone: 'Smooth', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-ebdb2dc65ce2d0d7e3051e1ba98a134c.mp3' },
    { id: 'Achernar', label: 'Achernar', tone: 'Soft', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-b7878ff88d4fc0c6421fc040f49436e3.mp3' },
    { id: 'Schedar', label: 'Schedar', tone: 'Even', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-2ac36f8cff57f429d503180239f37b9c.mp3' },
    { id: 'Gacrux', label: 'Gacrux', tone: 'Mature', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-39331a00bcd6d316ff4a7342e62183c4.mp3' },
    { id: 'Achird', label: 'Achird', tone: 'Friendly', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-815bed4b849bbf8cb4f7af1a5146e644.mp3' },
    { id: 'Pulcherrima', label: 'Pulcherrima', tone: 'Forward', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-553c0e7d8029a59f36ed1c1577eb59c2.mp3' },
    { id: 'Zubenelgenubi', label: 'Zubenelgenubi', tone: 'Casual', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-e2c65131bb1c8eb7ccdee21aa4adcb4d.mp3' },
    { id: 'Vindemiatrix', label: 'Vindemiatrix', tone: 'Gentle', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-93769a11bedaefc18634f6c993b34dc1.mp3' },
    { id: 'Sadachbia', label: 'Sadachbia', tone: 'Lively', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-3735d96a71296b6609ac55edfff4750e.mp3' },
    { id: 'Sulafat', label: 'Sulafat', tone: 'Warm', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-dd8a98f506e9b5f73e823720210c1063.mp3' },
    { id: 'Sadaltager', label: 'Sadaltager', tone: 'Knowledgeable', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-68ab6b7ecd5565bbf48e021c2d8ceb8f.mp3' },
    { id: 'Alnilam', label: 'Alnilam', tone: 'Firm', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-71bcdb0e8d53747465f37ffe94dee36b.mp3' },
    { id: 'Rasalgethi', label: 'Rasalgethi', tone: 'Informative', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5b2295c0d657ac304fd01319188e78db.mp3' },
];
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
};


type RagInstructionApiRow = {
    id: number;
    rag_id: string;
    title: string;
    instructions: string;
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
        topic: 'Storybook B-shots publish pipeline',
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
const mapRagInstructionRowToDocument = (row: RagInstructionApiRow): RagDocumentRow => ({
    databaseId: row.id,
    docId: row.rag_id,
    topic: row.title,
    sourceName: extractRagSourceName(row.instructions, `${row.rag_id}.rag.txt`),
    status: 'uploaded',
    chunkCount: estimateRagChunkCount(row.instructions),
    createdAt: 'DB',
    updatedAt: 'DB',
    instructions: row.instructions,
});
export const BrainstormChat: React.FC<BrainstormChatProps> = ({
    isAIEnabled, setIsAIEnabled, chatHistory, currentInput, setCurrentInput, handleSendMessage,
    handleUseMessage, handleSaveMessage: onFinalSaveExternal, handleCloseBrainstorm, manualName, setManualName,
    manualPrompt, setManualPrompt, handleManualUse, chatEndRef,
    darkMode, appColor, appColorDeep, appColorHover, clikUrl, ratioKey, onTemplateCreated,
    webSearch, onToggleWebSearch, onVoiceAsk
}) => {
    const theme = useTheme();
    const isPC = useMediaQuery('(min-width: 1024px)');
    const dispatch = useDispatch();
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const selectedVoice = useSelector((state: RootState) => state.brainstorm.selectedVoice);

    // Internal state for the new flow
    const [view, setView] = useState<ViewMode>('chat');

    // Finalize View State
    const [finalizePrompt, setFinalizePrompt] = useState('');
    const [finalizeImagePrompt, setFinalizeImagePrompt] = useState('');
    const [finalizePromptMode, setFinalizePromptMode] = useState<FinalizePromptMode>('template');
    const [baseFinalizePrompt, setBaseFinalizePrompt] = useState('');
    const [finImage, setFinImage] = useState<string | null>(null);
    const [isFinGenerating, setIsFinGenerating] = useState(false);
    const [finalizeTitle, setFinalizeTitle] = useState('');
    const [finalizeArtStyle, setFinalizeArtStyle] = useState('');
    const [isFinSaving, setIsFinSaving] = useState(false);
    // Confirm before leaving brainstorm. Session persists unless user explicitly resets it.
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [showRagInjector, setShowRagInjector] = useState(false);
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
    const { clearBrainstormSession, voice, setVoiceAskHandler } = useBrainstormSession();

    const [voiceMenuAnchor, setVoiceMenuAnchor] = useState<HTMLElement | null>(null);
    const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
    const voicePreviewRef = React.useRef<HTMLAudioElement | null>(null);
    const selectedVoiceMeta = VOICE_OPTIONS.find(v => v.id === selectedVoice) || VOICE_OPTIONS[0];
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

    const toggleVoicePreview = (option: typeof VOICE_OPTIONS[number]) => {
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
    const visibleRagDocuments = hasLoadedRagDocuments ? ragDocuments : DUMMY_RAG_DOCUMENTS;

    const voiceStatusLabel = voice.status === 'listening'
        ? 'Listening...'
        : voice.status === 'connecting'
            ? 'Waiting...'
            : voice.status === 'thinking'
                ? 'Waiting...'
                : voice.status === 'speaking'
                    ? 'Speaking...'
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

    const closeBrainstormWithVoiceCleanup = () => {
        stopVoicePreview();
        handleCloseBrainstorm();
    };

    useEffect(() => {
        return () => {
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

    const handleOpenRagInjector = () => {
        if (!isRagInjectorDevMode) return;
        setShowRagInjector(true);
    };

    const loadRagInstructions = React.useCallback(async () => {
        if (!clikUrl || !isRagInjectorDevMode) return;
        setIsRagLoading(true);
        try {
            const response: any = await axios.get(`${clikUrl}/get_rag_instructions`, { withCredentials: true });
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
    }, [clikUrl, isRagInjectorDevMode]);

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
        try {
            await axios.post(
                `${clikUrl}/delete_rag_instruction`,
                { ragId: documentRow.docId, confirmation: 'delete' },
                { withCredentials: true }
            );
            setRagDocuments((previousDocuments) => previousDocuments.filter((item) => item.docId !== documentRow.docId));
            if (selectedRagDocument?.docId === documentRow.docId) {
                setSelectedRagDocument(null);
            }
            setRagDeleteConfirmDocument(null);
            setRagDeleteConfirmText('');
            setSnackbarMessage('RAG instruction deleted');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            await loadRagInstructions();
        } catch (error: any) {
            console.error('Delete RAG instruction failed:', error);
            setSnackbarMessage(error?.response?.data?.message || 'RAG delete failed');
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

    // Intercept the save action to switch views with the exact selected message.
    const onSaveClicked = (msg: ChatMessage) => {
        setFinImage(null);
        setFinalizePrompt(msg.content);
        setFinalizeImagePrompt(msg.content);
        setBaseFinalizePrompt(msg.content);
        setFinalizePromptMode('template');
        setView('finalize');
    };

    // Auto-generate on show / update
    useEffect(() => {
        if (view === 'finalize' && finalizeImagePrompt) {
            void generateFinalizeImage(finalizeImagePrompt);
        }
    }, [view]);

    const generateFinalizeImage = async (text: string): Promise<string | null> => {
        if (!text.trim() || !clikUrl) return null;

        setIsFinGenerating(true);
        try {
            const payload = {
                inputs: text,
                width: 1080,
                height: 1920,
                guidance: 7.5,
                num_inference_steps: 4, // Schnell is fast, 4-8 steps usually
                seed: Math.floor(Math.random() * 1000000), // Random seed for variety
                ty: ratioKey
            };

            const response = await axios.post(`${clikUrl}/fluxschnell`, payload);
            const responseData = response.data as any;

            if (responseData && responseData.imageBase64) {
                let finalImage = responseData.imageBase64;
                if (!finalImage.startsWith('data:image')) {
                    finalImage = `data:image/png;base64,${finalImage}`;
                }
                setFinImage(finalImage);
                return finalImage;
            }
        } catch (error) {
            console.error("Finalize Generator failed:", error);
        } finally {
            setIsFinGenerating(false);
        }
        return null;
    };

    const handleRestoreDefault = () => {
        if (finalizePromptMode === 'template') {
            setFinalizePrompt(baseFinalizePrompt);
        } else {
            setFinalizeImagePrompt(baseFinalizePrompt);
            setFinImage(null);
        }
    };

    const uploadToS3 = async (base64: string): Promise<string> => {
        try {
            // 1. Convert Base64 (data:image/png;base64,...) to Blob
            const response = await fetch(base64);
            const blob = await response.blob();

            // 2. Get Signed URL from Backend
            // Pattern matches Thumbnail.tsx: POST /get_signed_url_image with { values: { count: 2 } }
            const resp: any = await axios.post(
                `${clikUrl}/get_signed_url_image`,
                { values: { count: 2 } },
                { withCredentials: true }
            );

            const holder = resp.data.holder;
            if (!holder || holder.length !== 1) throw new Error("Invalid signed URL response");

            // urlHD is the standard high-res/final URL used in the app
            const { urlHD } = holder[0];
            if (!urlHD) throw new Error("Missing urlHD in signed URL response");

            // 3. Upload to S3
            const up = await axios.put(urlHD, blob, {
                headers: { "Content-Type": blob.type || "image/png" }
            });

            if (![200, 204].includes(up.status)) {
                throw new Error(`S3 Upload failed: ${up.status}`);
            }

            // 4. Return the clean public URL (strip query params)
            return urlHD.split('?')[0];
        } catch (err) {
            console.error("S3 Upload Error:", err);
            throw err;
        }
    };

    const handleFinalSave = async () => {
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

        setIsFinSaving(true);
        try {
            let imageForSave = finImage;
            if (!imageForSave && finalizeImagePrompt.trim()) {
                imageForSave = await generateFinalizeImage(finalizeImagePrompt);
            }
            let finalImageUrl = imageForSave;

            // If we have a base64 image, upload it to S3 first
            if (imageForSave && imageForSave.startsWith('data:image')) {
                try {
                    finalImageUrl = await uploadToS3(imageForSave);
                } catch (uploadErr) {
                    finalImageUrl = null;
                    setSnackbarMessage('Image upload failed, saving without image.');
                    setSnackbarSeverity('error');
                    setSnackbarOpen(true);
                }
            }

            const payload = {
                userid: loggedUser?.id || 0,
                title: finalizeTitle,
                template_prompt: finalizePrompt,
                template_image: finalImageUrl,
                artstyle: finalizeArtStyle
            };
            console.log("Saving Template Payload:", payload);

            const response: any = await axios.post(`${clikUrl}/create_template_prompt`, payload);

            if (response.data && response.data.message) {
                setSnackbarMessage('Template Saved Successfully!');
                setSnackbarSeverity('success');
                setSnackbarOpen(true);

                // 1. Wipe parent array
                onTemplateCreated();

                // 2. Close brainstorm (which should reload latest data via NotepadEditor effect)
                setTimeout(closeBrainstormWithVoiceCleanup, 1500);
            }
        } catch (error) {
            console.error('Save Error:', error);
            setSnackbarMessage('Failed to save template');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setIsFinSaving(false);
        }
    };

    // Styles for consistent inputs
    const commonInputStyles = {
        '& .MuiOutlinedInput-root': {
            borderRadius: 3,
            bgcolor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            color: darkMode ? '#fff' : '#000',
            '& fieldset': { borderColor: 'transparent' },
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <IconButton onClick={() => setView('chat')}>
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
                                onClick={() => setFinalizePromptMode('template')}
                                sx={{
                                    minHeight: 38,
                                    bgcolor: finalizePromptMode === 'template' ? appColor : 'transparent',
                                    color: finalizePromptMode === 'template' ? '#000' : appColor,
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
                                onClick={() => setFinalizePromptMode('image')}
                                sx={{
                                    minHeight: 38,
                                    bgcolor: finalizePromptMode === 'image' ? appColor : 'transparent',
                                    color: finalizePromptMode === 'image' ? '#000' : appColor,
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
                            onChange={(e) => {
                                if (finalizePromptMode === 'template') {
                                    setFinalizePrompt(e.target.value);
                                } else {
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

                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                        <Button
                            variant="outlined"
                            onClick={handleRestoreDefault}
                            startIcon={<RefreshIcon />}
                            sx={{
                                flex: 1,
                                color: darkMode ? '#aaa' : '#666',
                                borderColor: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
                            }}
                        >
                            Original
                        </Button>
                        <Button
                            variant="contained"
                            disabled={isFinGenerating}
                            onClick={() => void generateFinalizeImage(finalizeImagePrompt)}
                            sx={{
                                flex: 1,
                                bgcolor: appColor,
                                color: '#000',
                                fontWeight: 700,
                                '&:hover': { bgcolor: appColorHover }
                            }}
                        >
                            Generate
                        </Button>
                    </Stack>

                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        disabled={isFinSaving || isFinGenerating}
                        startIcon={(isFinSaving || isFinGenerating) ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        onClick={handleFinalSave}
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

    return (
        <Box sx={{
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
        }} >
            <Box sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: darkMode ? 'rgba(15, 15, 20, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                borderRadius: 'inherit',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}>
                {/* Leave-brainstorm confirm overlay */}
                {showLeaveConfirm && (
                    <Box sx={{
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
                                onClick={() => clearBrainstormSession()}
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
                                    sx={{ flex: 1, borderRadius: 2, fontWeight: 700, color: darkMode ? '#fff' : '#111', borderColor: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}
                                >
                                    Stay
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => { setShowLeaveConfirm(false); closeBrainstormWithVoiceCleanup(); }}
                                    sx={{ flex: 1, borderRadius: 2, fontWeight: 800, bgcolor: appColor, color: '#000', '&:hover': { bgcolor: appColorHover } }}
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
                                <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                                    <Box>
                                        <Typography sx={{ color: darkMode ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)', fontWeight: 800 }}>
                                            Base knowledge workspace
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                                            Upload stores the exact RAG packet in S3 and rag_instructions.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        startIcon={isRagUploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
                                        onClick={handleRagUploadButtonClick}
                                        disabled={isRagUploading}
                                        sx={{
                                            alignSelf: { xs: 'stretch', sm: 'center' },
                                            bgcolor: appColor,
                                            color: '#000',
                                            borderRadius: 2,
                                            fontWeight: 900,
                                            px: 2,
                                            '&:hover': { bgcolor: appColorHover },
                                        }}
                                    >
                                        {isRagUploading ? 'Uploading...' : 'Upload RAG'}
                                    </Button>
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
                                        {['docId', 'title/topic', 'sourceName', 'status', 'chunks', 'updatedAt'].map((label) => (
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
                                                No RAG instructions uploaded yet.
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
                                            <Typography variant="body2" sx={{ color: darkMode ? '#fff' : '#111', fontWeight: 800, wordBreak: 'break-word' }}>
                                                {doc.docId}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.72)', wordBreak: 'break-word' }}>
                                                {doc.topic}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.6)', wordBreak: 'break-word' }}>
                                                {doc.sourceName}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: appColor, fontWeight: 900 }}>
                                                {doc.status}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.68)', fontWeight: 800 }}>
                                                {doc.chunkCount}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: darkMode ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.55)' }}>
                                                {doc.updatedAt}
                                            </Typography>
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
                                        {selectedRagDocument.docId}
                                    </Typography>
                                </Box>                                <Tooltip title="Delete RAG">
                                    <span style={{ marginLeft: 'auto' }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => openRagDeleteConfirm(selectedRagDocument)}
                                            disabled={selectedRagDocument.status === 'dummy' || isRagDeleting}
                                            aria-label="Delete RAG instruction"
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
                                    {[
                                        ['db id', selectedRagDocument.databaseId || '-'],
                                        ['source', selectedRagDocument.sourceName],
                                        ['status', selectedRagDocument.status],
                                        ['chars', selectedRagDocument.instructions.length.toLocaleString()],
                                        ['chunks', selectedRagDocument.chunkCount],
                                        ['s3 path', `rag/instructions/${selectedRagDocument.docId}.rag.txt`],
                                    ].map(([label, value]) => (
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
                                            color: '#000',
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
                                        Delete RAG
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', fontWeight: 800, wordBreak: 'break-word' }}>
                                        {ragDeleteConfirmDocument.docId}
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
                                Type delete to remove this RAG from Pinecone, S3, and the app database.
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
                            <SmartToyIcon sx={{ color: '#000', fontSize: { xs: 20, sm: 24 } }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: darkMode ? '#fff' : '#000', fontSize: { xs: '1.05rem', sm: '1.25rem' }, lineHeight: 1.15, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isAIEnabled ? 'Brainstorm Assistant' : 'Create Template'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 2 }, alignItems: 'center', flexShrink: 0 }}>
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
                                color: isAIEnabled ? '#000' : appColor,
                                '&:hover': {
                                    bgcolor: isAIEnabled ? appColorHover : 'rgba(255,255,255,0.05)',
                                    borderColor: appColorHover,
                                }
                            }}
                        >
                            AI: {isAIEnabled ? 'ON' : 'OFF'}
                        </Button>
                        <IconButton onClick={() => setShowLeaveConfirm(true)} sx={{ color: darkMode ? '#fff' : '#000', width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, p: 0.5 }}>
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

                            {/* Chat Messages */}
                            <Box sx={{
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
                                                color: msg.role === 'user' ? '#000' : darkMode ? '#e0e0e0' : '#333',
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
                                                        sx={{
                                                            bgcolor: appColor,
                                                            color: '#000',
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
                                                    const baseHeight = voice.status === 'listening'
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
                                                                opacity: voice.status === 'listening' ? 0.95 : (voiceIsWaiting ? 0.62 : 0.72),
                                                                transformOrigin: 'center',
                                                                transition: voice.status === 'listening' ? 'height 80ms linear, opacity 120ms ease' : 'none',
                                                                animation: voiceIsSpeaking
                                                                    ? 'clikbVoiceBarPulse 980ms ease-in-out infinite'
                                                                    : voiceIsWaiting
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
                            <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: { xs: 1, sm: 1.5 }, rowGap: { xs: 1, sm: 1.5 }, flexShrink: 0, mt: 'auto', alignItems: { xs: 'stretch', sm: 'center' } }}>
                                <Tooltip title={webSearch ? 'Web search ON â€” replies use live info (typed out)' : 'Web search OFF â€” faster streaming'}>
                                    <IconButton
                                        onClick={onToggleWebSearch}
                                        aria-label="Toggle web search"
                                        sx={{
                                            order: { xs: 2, sm: 0 },
                                            width: { xs: 46, sm: 48 },
                                            height: { xs: 46, sm: 48 },
                                            flexShrink: 0,
                                            borderRadius: { xs: 2.5, sm: 3 },
                                            border: `1px solid ${webSearch ? appColor : (darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)')}`,
                                            color: webSearch ? appColor : (darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'),
                                            background: webSearch ? `${appColor}22` : 'transparent',
                                            transition: 'all 0.2s',
                                            '&:hover': { borderColor: appColor, background: `${appColor}1a` },
                                        }}
                                    >
                                        <PublicIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={`Voice: ${selectedVoiceMeta.label} (${selectedVoiceMeta.gender}, ${selectedVoiceMeta.tone})`}>
                                    <IconButton
                                        onClick={(event) => setVoiceMenuAnchor(event.currentTarget)}
                                        aria-label="Choose voice"
                                        sx={{
                                            order: { xs: 2, sm: 0 },
                                            width: { xs: 46, sm: 48 },
                                            height: { xs: 46, sm: 48 },
                                            flexShrink: 0,
                                            borderRadius: { xs: 2.5, sm: 3 },
                                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`,
                                            color: appColor,
                                            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
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
                                    {VOICE_OPTIONS.map((option) => (
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
                                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    inputProps={{
                                        style: {
                                            caretColor: darkMode ? '#ffffff' : '#000000',
                                            color: darkMode ? '#ffffff' : '#000000'
                                        }
                                    }}
                                    sx={{
                                        order: { xs: 1, sm: 0 },
                                        flexBasis: { xs: '100%', sm: 'auto' },
                                        minWidth: 0,
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: { xs: 3, sm: 4 },
                                            minHeight: { xs: 48, sm: 56 },
                                            background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                            color: darkMode ? '#fff' : '#000',
                                            '&Fieldset': { borderColor: 'transparent' },
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
                                            color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                            opacity: 1
                                        }
                                    }}
                                />
                                <Tooltip title={voice.active ? `Voice: ${voice.status} â€” tap to stop` : 'Talk instead of type'}>
                                    <IconButton
                                        onClick={voice.toggle}
                                        aria-label="Voice mode"
                                        sx={{
                                            order: { xs: 2, sm: 0 },
                                            width: { xs: 52, sm: 56 },
                                            height: { xs: 52, sm: 56 },
                                            flexShrink: 0,
                                            color: voice.active ? '#000' : appColor,
                                            background: voice.active
                                                ? `linear-gradient(135deg, ${appColor} 0%, ${appColorDeep} 100%)`
                                                : 'transparent',
                                            border: voice.active ? 'none' : `1px solid ${appColor}`,
                                            transition: 'all 0.2s',
                                            animation: voice.active ? 'clikbVoicePulse 1.4s ease-in-out infinite' : 'none',
                                            '@keyframes clikbVoicePulse': {
                                                '0%,100%': { boxShadow: `0 0 0 0 ${appColor}66` },
                                                '50%': { boxShadow: `0 0 0 8px ${appColor}00` },
                                            },
                                            '&:hover': { opacity: 0.9, transform: 'scale(1.05)' },
                                        }}
                                    >
                                        <MicIcon />
                                    </IconButton>
                                </Tooltip>
                                <IconButton
                                    onClick={handleSendMessage}
                                    sx={{
                                        background: `linear-gradient(135deg, ${appColor} 0%, ${appColorDeep} 100%)`,
                                        color: '#000',
                                        order: { xs: 2, sm: 0 },
                                        width: { xs: 52, sm: 56 },
                                        height: { xs: 52, sm: 56 },
                                        '&:hover': { opacity: 0.9, transform: 'scale(1.05)' },
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
                                            sx={{
                                                bgcolor: appColor,
                                                color: '#000',
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
                                                setFinalizePrompt(manualPrompt);
                                                setFinalizeImagePrompt(manualPrompt);
                                                setBaseFinalizePrompt(manualPrompt);
                                                setFinalizePromptMode('template');
                                                setFinImage(null);
                                                setView('finalize');
                                            }}
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
                                                color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
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
                                            fullWidth
                                            sx={{
                                                bgcolor: appColor,
                                                color: '#000',
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
                                                setFinalizePrompt(manualPrompt);
                                                setFinalizeImagePrompt(manualPrompt);
                                                setBaseFinalizePrompt(manualPrompt);
                                                setFinalizePromptMode('template');
                                                setFinImage(null);
                                                setView('finalize');
                                            }}
                                            fullWidth
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
