// useGeminiVoice: xAI/Gemini handles STT; streaming TTS speaks Brainstorm replies as text arrives.
import { useCallback, useEffect, useRef, useState } from 'react';
import { conversationMeasurementHeaders, getConversationMeasurementSessionId } from '../conversationMeasurementSession';
import { CONVERSATION_PROFILE_POLICY_VERSION, isPaidConversationTier } from '../conversationModels';
import { AutomaticSpeechQueue } from '../conciergeAnnouncements';
import { getConciergeMeteredReceiptCursor, handleConciergeMeteredReceiptBatch, handleConciergeMeteredBillingEvent } from '../pixelBillingClient';
import { store } from '../store';
import { showAiProviderNotice } from '../settingsSlice';
import { logVoiceDiagnostic } from '../conciergeDiagnostics';

const L = (...a: any[]) => logVoiceDiagnostic(...a);

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

const voiceReceiptPolls = new Map<string, Promise<void>>();
export function pollConciergeVoiceReceipts(clikUrl: string): Promise<void> {
    const userId = (store.getState() as any).profile?.loggedUser?.id;
    if (!userId) return Promise.resolve();
    const key = `${clikUrl}:${userId}`;
    const running = voiceReceiptPolls.get(key);
    if (running) return running;
    const poll = (async () => {
        // Bounded pagination also catches several binary TTS charges made
        // between polls, each delivered exactly once by the shared receipt UI.
        for (let batch = 0; batch < 4; batch++) {
            const response = await fetch(clikUrl + '/concierge/metered-settle', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                body: JSON.stringify({ conversationModel: store.getState().settings.conversationModel,
                    afterReceiptSeq: getConciergeMeteredReceiptCursor() }),
            });
            if (!response.ok) return;
            const payload = await response.json();
            handleConciergeMeteredReceiptBatch(payload);
            if (!Array.isArray(payload?.receipts) || payload.receipts.length < 100) return;
        }
    })().catch(() => { /* Durable receipts remain available on the next poll. */ })
        .finally(() => { voiceReceiptPolls.delete(key); });
    voiceReceiptPolls.set(key, poll);
    return poll;
}

type SavedVoiceFrame = {
    data: string;
    samples: number;
};

type BrainTextStreamCallbacks = {
    onTextDelta?: (delta: string) => void;
    onFinalText?: (text: string) => void;
};

type SendTtsOptions = {
    automaticCurrent?: () => boolean;
    allowWhenStopped?: boolean;
    append?: boolean;
    keepAlive?: boolean;
    runId?: number;
    spokenText?: string;
};

type StopPlaybackOptions = {
    recoverIfNoSpeech?: boolean;
    reason?: string;
};

type ResetRuntimeOptions = {
    preservePlayback?: boolean;
    preserveBrainTurn?: boolean;
};

type CleanupOptions = {
    preservePlayback?: boolean;
    preserveBrainTurn?: boolean;
    reason?: string;
};

interface UseGeminiVoiceArgs {
    clikUrl: string;
    callBrain: (text: string, signal?: AbortSignal, stream?: BrainTextStreamCallbacks) => Promise<string>;
    ttsVoice?: string;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const TRANSCRIPT_SETTLE_MS = 2200;
const TRANSCRIPT_TURN_COMPLETE_SETTLE_MS = 1400;
const MIC_ACTIVITY_HOLD_MS = 2200;
const BARGE_IN_RMS_THRESHOLD = 0.04;
const BARGE_IN_REQUIRED_FRAMES = 5;
const XAI_NOISE_RESET_QUIET_FRAMES = 8;
const VOICE_RETRY_PREROLL_FRAMES = 12;
const VOICE_RETRY_MAX_FRAMES = 260;
const VOICE_RETRY_MIN_SPEECH_FRAMES = 8;
const VOICE_RETRY_SILENCE_FRAMES = 10;
const STT_RECONNECT_DELAY_MS = 650;
const STT_RECONNECT_STABLE_MS = 8000;
const MAX_STT_RECONNECT_ATTEMPTS = 2;
const STT_NO_TRANSCRIPT_MS = 5200;
const STT_READY_WAIT_MS = 4500;
const BARGE_IN_TRANSCRIPT_WINDOW_MS = 3600;
const TTS_BARGE_IN_PROVISIONAL_SETTLE_MS = 900;
const TTS_ECHO_GRACE_MS = 1400;
const RECENT_TRANSCRIPT_TTL_MS = 12000;
const TTS_DUCK_GAIN = 0.06;
const TTS_DUCK_RESTORE_MS = 2000;
const TTS_DUCK_RESTORE_POLL_MS = 160;
const TTS_DUCK_ATTACK_SECONDS = 0.025;
const TTS_DUCK_RELEASE_SECONDS = 0.12;
const STREAM_TTS_SOFT_MIN_CHARS = 28;
const STREAM_TTS_MIN_CHARS = 70;
const STREAM_TTS_MAX_CHARS = 220;
const TTS_INTERRUPTION_RECOVERY_MS = 1800;
const TTS_RECOVERY_MIN_CHARS = 12;

// xAI streaming STT (provider 'xai'): the backend proxies mic PCM to wss://api.x.ai/v1/stt.
// Smart Turn decides end-of-turn server-side, so speech_final is processed almost
// immediately; chunk finals only keep a long local fallback as a safety net.
const XAI_STT_WS_PATH = '/xaiSttStream';
const GEMINI_STT_WS_PATH = '/geminiSttStream';
const XAI_SPEECH_FINAL_SETTLE_MS = 1800;
const XAI_CHUNK_FINAL_FALLBACK_MS = 5000;
// During barge-in, xAI can mark speech_final before the user has finished.
// Treat any new, non-echo xAI transcript as liveness and require this bounded
// period with no new transcript activity before sending the turn to Brainstorm.
// Raw mic energy is intentionally not used here, so wind/fans cannot hold it.
const XAI_BARGE_IN_TRANSCRIPT_IDLE_MS = 1800;
const XAI_BARGE_IN_RECHECK_PADDING_MS = 50;

// Gemini Live input transcription is enabled by passing an (empty) AudioTranscriptionConfig.
// IMPORTANT: languageHints / adaptationPhrases are NOT valid keys on inputAudioTranscription.
// On gemini-*-live models, including them makes the server silently drop transcription entirely,
// which shows up as "audio frames OUT but inputTranscription=undefined" -> the no-transcript
// reconnect loop. Keep this an empty object so transcription actually flows.
// (Old adaptation phrases kept here for reference only: ClikB, ClickB, Clickby, Clik, Brainstorm,
//  Creative Scenes, Memes, voice mode, Gemini Live, OpenAI, web search, globe.)

function floatTo16BitPCM(input: Float32Array): Int16Array {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

function downsample(buffer: Float32Array, inRate: number, outRate: number): Float32Array {
    if (outRate >= inRate) {
        return buffer;
    }
    const ratio = inRate / outRate;
    const newLen = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
        const startI = Math.round(i * ratio);
        const endI = Math.round((i + 1) * ratio);
        let sum = 0;
        let count = 0;
        for (let j = startI; j < endI && j < buffer.length; j++) {
            sum += buffer[j];
            count++;
        }
        result[i] = count > 0 ? sum / count : 0;
    }
    return result;
}

function int16ToBase64(int16: Int16Array): string {
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

function bytesToInt16(bytes: Uint8Array): Int16Array {
    const evenLength = bytes.length - (bytes.length % 2);
    const copy = bytes.slice(0, evenLength);
    return new Int16Array(copy.buffer);
}

function normalizeTranscript(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function correctClikbAliasTranscript(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;

    const aliasRe = /\b(?:click\s*bank|click\s*bait|click\s+b|clik\s+b|clickbee|clikbee|clickby)\b/i;
    if (!aliasRe.test(trimmed)) return trimmed;

    const normalized = normalizeTranscript(trimmed);
    const explicitOtherTopic =
        /\b(?:what is|whats|define|meaning of|explain)\s+(?:clickbank|click bank|clickbait|click bait)\b/.test(normalized) ||
        /\b(?:affiliate|marketplace|commission|vendor|checkout|payment|seo|headline|headlines|thumbnail|thumbnails|title|titles|viral hook|rage bait|ragebait)\b/.test(normalized);
    if (explicitOtherTopic) return trimmed;

    const directCorrection = /^(?:(?:um|uh|yes|yeah|yep|no|nah|actually|sorry|i|mean|correct|correction|the|app|is|it|s|its)\s+){0,6}(?:clickbank|click bank|clickbait|click bait|click b|clik b|clickbee|clikbee|clickby)\s*$/i.test(normalized);
    const clikbContext =
        /\b(?:clikb|brainstorm|shorts|cinema|interactions|interactive|games|mode|scene|scenes|meme|memes|video|image|template|create|make|generate|app|my app|this app)\b/.test(normalized) ||
        /\b(?:on|in|inside|using|use|with|for)\s+(?:clickbank|click bank|clickbait|click bait|click b|clik b|clickbee|clikbee|clickby)\b/.test(normalized);
    if (!directCorrection && !clikbContext) return trimmed;

    return trimmed.replace(/\b(?:click\s*bank|click\s*bait|click\s+b|clik\s+b|clickbee|clikbee|clickby)\b/gi, 'ClikB');
}

const STT_FILLER_WORDS = new Set(['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm', 'hm', 'mm', 'ah']);
const STT_INTERRUPT_WORDS = new Set(['stop', 'wait', 'pause', 'cancel']);
const STT_NOISE_SINGLE_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'too', 'you', 'yeah', 'ok', 'okay', 'so']);
const STT_KEYTERM_LEAK_WORDS = new Set(['clikb', 'clickb', 'clik', 'click', 'b', 'app', 'creative', 'ai', 'brainstorm', 'magic', 'mirror', 'shorts', 'cinema', 'interactions']);

function isFillerOnly(text: string): boolean {
    const normalized = normalizeTranscript(text);
    if (!normalized) return false;
    return normalized.split(' ').every((word) => STT_FILLER_WORDS.has(word));
}

function isLikelySttKeytermLeak(text: string): boolean {
    const normalized = normalizeTranscript(text);
    if (!normalized) return false;
    const words = normalized.split(' ').filter(Boolean);
    if (words.length < 5) return false;
    const knownWords = words.filter((word) => STT_KEYTERM_LEAK_WORDS.has(word));
    if (knownWords.length !== words.length) return false;

    const commaCount = (text.match(/,/g) || []).length;
    const hasSeveralProductTerms = new Set(words).size >= 4;
    return commaCount >= 2 || hasSeveralProductTerms;
}

function isImmediateInterruptTranscript(text: string): boolean {
    const normalized = normalizeTranscript(text);
    if (!normalized || isFillerOnly(text) || isLikelySttKeytermLeak(text)) return false;
    const words = normalized.split(' ').filter(Boolean);
    const meaningfulWords = words.filter((word) => !STT_FILLER_WORDS.has(word));
    if (!meaningfulWords.length) return false;
    const phrase = meaningfulWords.join(' ');
    const firstWord = meaningfulWords[0];
    return STT_INTERRUPT_WORDS.has(firstWord) || /^(hold on|one sec|one second|wait a second|let me speak|i am talking)\b/.test(phrase);
}

function isConfirmedUserSpeechTranscript(text: string, opts: { final?: boolean; duringTts?: boolean } = {}): boolean {
    const normalized = normalizeTranscript(text);
    if (!normalized || isFillerOnly(text) || isLikelySttKeytermLeak(text)) return false;

    const words = normalized.split(' ').filter(Boolean);
    const meaningfulWords = words.filter((word) => !STT_FILLER_WORDS.has(word));
    if (!meaningfulWords.length) return false;

    const phrase = meaningfulWords.join(' ');
    const firstWord = meaningfulWords[0];
    if (STT_INTERRUPT_WORDS.has(firstWord)) return true;
    if (/^(hold on|one sec|one second|wait a second|let me speak|i am talking)\b/.test(phrase)) return true;

    if (opts.duringTts) {
        return meaningfulWords.length >= 3;
    }

    if (meaningfulWords.length >= 2) return true;

    const onlyWord = meaningfulWords[0];
    if (opts.final && onlyWord.length >= 3 && !STT_NOISE_SINGLE_WORDS.has(onlyWord)) {
        return true;
    }

    return false;
}

function collapseRepeatedShortTranscript(text: string): string {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);
    if (words.length < 2 || words.length > 12) return trimmed;

    const normalizedWords = normalizeTranscript(trimmed).split(' ').filter(Boolean);
    if (normalizedWords.length % 2 !== 0) return trimmed;
    const half = normalizedWords.length / 2;
    const first = normalizedWords.slice(0, half).join(' ');
    const second = normalizedWords.slice(half).join(' ');
    if (first !== second) return trimmed;

    return words.slice(0, half).join(' ');
}

function mergeTranscript(existing: string, incoming: string): string {
    const current = existing.trim();
    const next = incoming.trim();
    if (!current) return next;
    if (!next) return current;

    const currentNorm = normalizeTranscript(current);
    const nextNorm = normalizeTranscript(next);
    if (!currentNorm) return next;
    if (!nextNorm) return current;
    if (currentNorm === nextNorm) return current.length >= next.length ? current : next;
    if (currentNorm.includes(nextNorm)) return current;
    if (nextNorm.includes(currentNorm)) return next;

    const currentWords = current.split(/\s+/);
    const nextWords = next.split(/\s+/);
    const currentNormWords = currentNorm.split(' ');
    const nextNormWords = nextNorm.split(' ');
    const maxOverlap = Math.min(currentNormWords.length, nextNormWords.length, 12);
    for (let size = maxOverlap; size >= 2; size--) {
        const left = currentNormWords.slice(currentNormWords.length - size).join(' ');
        const right = nextNormWords.slice(0, size).join(' ');
        if (left === right) {
            return [...currentWords, ...nextWords.slice(size)].join(' ');
        }
    }

    return `${current} ${next}`;
}

function getFrameRms(input: Float32Array): number {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < input.length; i += 16) {
        const sample = input[i];
        sum += sample * sample;
        count++;
    }
    return count > 0 ? Math.sqrt(sum / count) : 0;
}

function isLikelySpeechFrame(input: Float32Array): boolean {
    return getFrameRms(input) > 0.012;
}

function isLikelyEchoTranscript(transcript: string, spokenTextNorm: string): boolean {
    const transcriptNorm = normalizeTranscript(transcript);
    const spokenNorm = normalizeTranscript(spokenTextNorm);
    if (!transcriptNorm || !spokenNorm) return false;

    const transcriptWords = transcriptNorm.split(' ').filter(Boolean);
    if (transcriptWords.length === 0) return false;
    if (spokenNorm.includes(transcriptNorm)) return true;

    const spokenWords = new Set(spokenNorm.split(' ').filter(Boolean));
    const overlap = transcriptWords.filter((word) => spokenWords.has(word)).length;
    const overlapRatio = overlap / transcriptWords.length;
    return transcriptWords.length >= 3 && overlapRatio >= 0.72;
}

function cleanTtsChunkText(text: string): string {
    return String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/^\s{0,3}#{1,6}\s*/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^\s*[-\u2022]\s+/gm, '')
        .replace(/^\s*(?:top|middle|bottom|first|second|third|final)\s+panel\s*:\s*/gim, '')
        .replace(/^\s*panel\s*\d+\s*:\s*/gim, '')
        .replace(/^\s*(?:image|visual|text|caption)\s*:\s*/gim, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function takeNextTtsSpeechChunk(buffer: string, force = false): { chunk: string; rest: string } | null {
    const text = String(buffer || '').replace(/\s+/g, ' ').trimStart();
    if (!text.trim()) return null;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch !== '.' && ch !== '!' && ch !== '?') continue;
        const end = i + 1;
        const next = text[end] || '';
        if (end >= STREAM_TTS_SOFT_MIN_CHARS && (end >= text.length || /\s/.test(next))) {
            return { chunk: text.slice(0, end), rest: text.slice(end) };
        }
    }

    if (text.length >= STREAM_TTS_MAX_CHARS) {
        const windowText = text.slice(0, STREAM_TTS_MAX_CHARS);
        let cut = Math.max(windowText.lastIndexOf(','), windowText.lastIndexOf(';'), windowText.lastIndexOf(':'));
        if (cut < STREAM_TTS_MIN_CHARS) cut = windowText.lastIndexOf(' ');
        if (cut < STREAM_TTS_MIN_CHARS) cut = STREAM_TTS_MAX_CHARS - 1;
        return { chunk: text.slice(0, cut + 1), rest: text.slice(cut + 1) };
    }

    if (force) {
        return { chunk: text.trim(), rest: '' };
    }

    return null;
}
export function useGeminiVoice(args: UseGeminiVoiceArgs) {
    const { clikUrl, callBrain, ttsVoice = 'Kore' } = args;
    // Connected STT handlers can retain older callbacks across voice changes.
    // Read the current selection when dispatching TTS without reconnecting the mic.
    const ttsVoiceRef = useRef(ttsVoice);
    ttsVoiceRef.current = ttsVoice;
    const [ttsDelivery, setTtsDelivery] = useState<{ engine: string; fallback: boolean; actualVoice: string } | null>(null);

    const [active, setActive] = useState(false);
    const [captureConnected, setCaptureConnected] = useState(false);
    const [acceptedSpeechPending, setAcceptedSpeechPending] = useState(false);
    const [inputReceipt, setInputReceipt] = useState<{turnId:number;text:string} | null>(null);
    const [status, setStatus] = useState<VoiceStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [level, setLevel] = useState(0);
    const [canRetryAudio, setCanRetryAudio] = useState(false);
    const activeRef = useRef(false);
    const sttSessionIdRef = useRef(0);

    const sttSessionRef = useRef<any>(null);
    const sttProviderRef = useRef<'gemini' | 'xai'>('gemini');
    const micStreamRef = useRef<MediaStream | null>(null);
    const inCtxRef = useRef<any>(null);
    const procRef = useRef<any>(null);
    const analyserRef = useRef<any>(null);
    const rafRef = useRef<number | null>(null);
    const outCtxRef = useRef<any>(null);
    const outputGainRef = useRef<any>(null);
    const nextStartRef = useRef<number>(0);
    const sourcesRef = useRef<any[]>([]);
    const framesSentRef = useRef<number>(0);
    const audioChunksRef = useRef<number>(0);
    const ttsAbortRef = useRef<AbortController | null>(null);
    const ttsRunIdRef = useRef(0);
    const duckRestoreTimerRef = useRef<number | null>(null);
    const ttsDuckedRef = useRef(false);
    const currentTtsTextNormRef = useRef<string>('');
    const lastTtsTextNormRef = useRef<string>('');
    const ttsKnownResponseTextRef = useRef<string>('');
    const ttsCurrentChunkTextRef = useRef<string>('');
    const ttsSpokenTextRef = useRef<string>('');
    const ttsInterruptionRecoveryTimerRef = useRef<number | null>(null);
    const ttsInterruptionRecoveryTokenRef = useRef(0);
    const ttsRecoverySpeakRef = useRef<((text: string) => void) | null>(null);
    const closedRef = useRef<boolean>(false);
    const transcriptRef = useRef<string>('');
    const transcriptFinalizeTimerRef = useRef<number | null>(null);
    const lastMicSpeechAtRef = useRef<number>(0);
    const lastXaiBargeInTranscriptAtRef = useRef<number>(0);
    const lastXaiBargeInTranscriptNormRef = useRef<string>('');
    const xaiBargeInTurnActiveRef = useRef<boolean>(false);
    const xaiUnconfirmedNoiseRef = useRef<boolean>(false);
    const xaiNoiseQuietFramesRef = useRef<number>(0);
    const processingTranscriptRef = useRef<boolean>(false);
    const automaticSpeechRef = useRef(new AutomaticSpeechQueue());
    const drainAutomaticSpeechRef = useRef<() => void>(() => {});
    const brainAbortRef = useRef<AbortController | null>(null);
    const voiceTurnIdRef = useRef(0);
    const activeTranscriptNormRef = useRef<string>('');
    const inFlightSpeechTextRef = useRef<string>('');
    const inFlightSpeechAnsweredRef = useRef<boolean>(false);
    const recentTranscriptNormsRef = useRef<Map<string, number>>(new Map());
    const lastProcessedTranscriptRef = useRef<string>('');
    const lastProcessedTranscriptNormRef = useRef<string>('');
    const ttsSpeakingRef = useRef<boolean>(false);
    const bargeInSpeechFramesRef = useRef<number>(0);
    const lastBargeInAtRef = useRef<number>(0);
    const lastTtsEndedAtRef = useRef<number>(0);
    const preSpeechFramesRef = useRef<SavedVoiceFrame[]>([]);
    const currentUtteranceFramesRef = useRef<SavedVoiceFrame[]>([]);
    const currentUtteranceSpeechFramesRef = useRef<number>(0);
    const retryAudioFramesRef = useRef<SavedVoiceFrame[]>([]);
    const retryTranscriptRef = useRef<string>('');
    const sttSetupCompleteRef = useRef(false);
    const sttReadyResolversRef = useRef<((ready: boolean) => void)[]>([]);
    const ignoredSttTextPartsRef = useRef<number>(0);
    const sttReconnectAttemptsRef = useRef(0);
    const sttRecoveringRef = useRef(false);
    const preservePlaybackOnReconnectRef = useRef(false);
    const reconnectTimerRef = useRef<number | null>(null);
    const reconnectStableTimerRef = useRef<number | null>(null);
    const sttNoTranscriptTimerRef = useRef<number | null>(null);
    const startRef = useRef<(() => Promise<void>) | null>(null);

    const clearNoTranscriptWatchdog = useCallback(() => {
        if (sttNoTranscriptTimerRef.current != null) {
            window.clearTimeout(sttNoTranscriptTimerRef.current);
            sttNoTranscriptTimerRef.current = null;
        }
    }, []);

    const resolveSttReadyWaiters = useCallback((ready: boolean) => {
        const waiters = sttReadyResolversRef.current.splice(0);
        for (const resolve of waiters) {
            resolve(ready);
        }
    }, []);

    const waitForSttReady = useCallback(async () => {
        if (sttSetupCompleteRef.current && sttSessionRef.current && !closedRef.current) {
            return true;
        }

        return await new Promise<boolean>((resolve) => {
            const done = (ready: boolean) => {
                window.clearTimeout(timer);
                resolve(ready);
            };
            const timer = window.setTimeout(() => {
                sttReadyResolversRef.current = sttReadyResolversRef.current.filter((waiter) => waiter !== done);
                resolve(false);
            }, STT_READY_WAIT_MS);
            sttReadyResolversRef.current.push(done);
        });
    }, []);

    const clearCurrentAudioCapture = useCallback(() => {
        clearNoTranscriptWatchdog();
        preSpeechFramesRef.current = [];
        currentUtteranceFramesRef.current = [];
        currentUtteranceSpeechFramesRef.current = 0;
    }, [clearNoTranscriptWatchdog]);

    const clearSavedRetry = useCallback(() => {
        retryAudioFramesRef.current = [];
        retryTranscriptRef.current = '';
        setCanRetryAudio(false);
    }, []);

    const rememberSentAudioFrame = useCallback((frame: SavedVoiceFrame, hasSpeech: boolean) => {
        if (!hasSpeech && currentUtteranceFramesRef.current.length === 0) {
            preSpeechFramesRef.current = [...preSpeechFramesRef.current, frame].slice(-VOICE_RETRY_PREROLL_FRAMES);
            return;
        }

        if (hasSpeech && currentUtteranceFramesRef.current.length === 0) {
            currentUtteranceFramesRef.current = preSpeechFramesRef.current.slice();
        }

        if (hasSpeech) {
            currentUtteranceSpeechFramesRef.current = Math.min(VOICE_RETRY_MAX_FRAMES, currentUtteranceSpeechFramesRef.current + 1);
        }

        if (currentUtteranceFramesRef.current.length > 0 || hasSpeech) {
            currentUtteranceFramesRef.current = [...currentUtteranceFramesRef.current, frame].slice(-VOICE_RETRY_MAX_FRAMES);
        }
    }, []);

    const saveRetryCapture = useCallback((reason: string) => {
        const transcript = transcriptRef.current.trim();
        const speechFrames = currentUtteranceSpeechFramesRef.current;
        const frames = currentUtteranceFramesRef.current.slice();
        if (!transcript && (frames.length === 0 || speechFrames < VOICE_RETRY_MIN_SPEECH_FRAMES)) {
            return false;
        }

        retryTranscriptRef.current = transcript;
        retryAudioFramesRef.current = frames;
        setCanRetryAudio(true);
        L('saved voice retry:', reason, 'frames=', frames.length, 'speechFrames=', speechFrames, 'transcript=', transcript.slice(0, 80));
        return true;
    }, []);

    const clearDuckRestoreTimer = useCallback(() => {
        if (duckRestoreTimerRef.current != null) {
            window.clearTimeout(duckRestoreTimerRef.current);
            duckRestoreTimerRef.current = null;
        }
    }, []);

    const setTtsGain = useCallback((value: number, timeConstant: number) => {
        const gain = outputGainRef.current;
        if (!gain) return;
        const now = gain.context.currentTime;
        try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setTargetAtTime(value, now, timeConstant);
        } catch (e) {
            void e;
            gain.gain.value = value;
        }
    }, []);

    const restoreTtsVolume = useCallback((immediate = false) => {
        clearDuckRestoreTimer();
        ttsDuckedRef.current = false;
        setTtsGain(1, immediate ? 0.001 : TTS_DUCK_RELEASE_SECONDS);
    }, [clearDuckRestoreTimer, setTtsGain]);

    const duckTtsVolume = useCallback(() => {
        if (!ttsSpeakingRef.current) return;
        ttsDuckedRef.current = true;
        setTtsGain(TTS_DUCK_GAIN, TTS_DUCK_ATTACK_SECONDS);
    }, [setTtsGain]);

    const scheduleTtsRestore = useCallback((options?: { ignoreMicActivity?: boolean }) => {
        clearDuckRestoreTimer();
        const ignoreMicActivity = !!options?.ignoreMicActivity;

        const armRestore = (delayMs: number) => {
            duckRestoreTimerRef.current = window.setTimeout(() => {
                duckRestoreTimerRef.current = null;
                if (!ttsSpeakingRef.current || !ttsDuckedRef.current) {
                    return;
                }

                const quietForMs = performance.now() - lastMicSpeechAtRef.current;
                if (transcriptRef.current.trim() || (!ignoreMicActivity && quietForMs < TTS_DUCK_RESTORE_MS)) {
                    armRestore(TTS_DUCK_RESTORE_POLL_MS);
                    return;
                }

                L(ignoreMicActivity
                    ? 'TTS duck restored; xAI did not confirm user speech'
                    : 'TTS duck restored after quiet window');
                if (ignoreMicActivity) {
                    // Do not immediately re-duck on the same continuous wind or
                    // fan noise. Confirmed xAI speech can still stop playback.
                    xaiUnconfirmedNoiseRef.current = true;
                    xaiNoiseQuietFramesRef.current = 0;
                }
                restoreTtsVolume();
                setStatus('speaking');
            }, delayMs);
        };

        armRestore(TTS_DUCK_RESTORE_MS);
    }, [clearDuckRestoreTimer, restoreTtsVolume]);

    const clearTtsInterruptionRecovery = useCallback(() => {
        if (ttsInterruptionRecoveryTimerRef.current != null) {
            window.clearTimeout(ttsInterruptionRecoveryTimerRef.current);
            ttsInterruptionRecoveryTimerRef.current = null;
        }
        ttsInterruptionRecoveryTokenRef.current += 1;
    }, []);

    const getRecoverableTtsText = useCallback(() => {
        const knownText = cleanTtsChunkText(ttsKnownResponseTextRef.current);
        const currentChunk = cleanTtsChunkText(ttsCurrentChunkTextRef.current);
        const spokenText = cleanTtsChunkText(ttsSpokenTextRef.current);
        let remaining = '';

        if (knownText && currentChunk) {
            const currentIndex = knownText.indexOf(currentChunk);
            remaining = currentIndex >= 0 ? knownText.slice(currentIndex) : currentChunk;
        } else if (knownText && spokenText && knownText.startsWith(spokenText)) {
            remaining = knownText.slice(spokenText.length);
        } else {
            remaining = currentChunk || knownText;
        }

        const cleanRemaining = cleanTtsChunkText(remaining);
        return cleanRemaining.length >= TTS_RECOVERY_MIN_CHARS ? cleanRemaining : '';
    }, []);

    const armTtsInterruptionRecovery = useCallback((reason: string) => {
        const restartText = getRecoverableTtsText();
        if (!restartText) return;

        if (ttsInterruptionRecoveryTimerRef.current != null) {
            window.clearTimeout(ttsInterruptionRecoveryTimerRef.current);
        }
        const token = ttsInterruptionRecoveryTokenRef.current + 1;
        ttsInterruptionRecoveryTokenRef.current = token;
        ttsInterruptionRecoveryTimerRef.current = window.setTimeout(() => {
            ttsInterruptionRecoveryTimerRef.current = null;
            if (token !== ttsInterruptionRecoveryTokenRef.current) return;
            if (closedRef.current || processingTranscriptRef.current || transcriptRef.current.trim() || ttsSpeakingRef.current) return;

            const latestText = getRecoverableTtsText() || restartText;
            if (!latestText) return;
            L('TTS interruption recovery: restarting speech after unconfirmed noise:', reason, latestText.slice(0, 120));
            ttsRecoverySpeakRef.current?.(latestText);
        }, TTS_INTERRUPTION_RECOVERY_MS);
    }, [getRecoverableTtsText]);

    const hasAudiblePlayback = useCallback(() => {
        const ctx = outCtxRef.current;
        const queued = !!ctx && ctx.state !== 'closed' && nextStartRef.current > ctx.currentTime + 0.05;
        return sourcesRef.current.length > 0 || queued || (ttsSpeakingRef.current && audioChunksRef.current > 0);
    }, []);

    const hasActiveTts = useCallback(() => {
        return hasAudiblePlayback() || ttsSpeakingRef.current || !!ttsAbortRef.current;
    }, [hasAudiblePlayback]);

    const stopPlayback = useCallback((options?: StopPlaybackOptions) => {
        const wasSpeaking = ttsSpeakingRef.current;
        const shouldRecover = !!options?.recoverIfNoSpeech && wasSpeaking;
        L('stopPlayback called', options?.reason || 'unspecified');
        if (!shouldRecover) {
            clearTtsInterruptionRecovery();
        }
        clearDuckRestoreTimer();
        restoreTtsVolume(true);
        ttsRunIdRef.current += 1;
        try { ttsAbortRef.current?.abort(); } catch (e) { void e; }
        ttsAbortRef.current = null;
        for (const s of sourcesRef.current) {
            try { s.stop(); } catch (e) { void e; }
        }
        sourcesRef.current = [];
        nextStartRef.current = 0;
        ttsSpeakingRef.current = false;
        currentTtsTextNormRef.current = '';
        if (wasSpeaking) {
            lastTtsEndedAtRef.current = performance.now();
        void pollConciergeVoiceReceipts(clikUrl);
        }
        bargeInSpeechFramesRef.current = 0;
        if (shouldRecover) {
            armTtsInterruptionRecovery(options?.reason || 'playback cut while AI was speaking');
        }
    }, [armTtsInterruptionRecovery, clearDuckRestoreTimer, clearTtsInterruptionRecovery, restoreTtsVolume]);

    const stopSpeech = useCallback(() => {
        L('stopSpeech()');
        automaticSpeechRef.current.cancel();
        stopPlayback({ reason: 'manual stop' });
        if (!closedRef.current) {
            setStatus(activeRef.current ? 'listening' : 'idle');
        }
    }, [stopPlayback]);

    const resetRuntimeRefs = useCallback((options?: ResetRuntimeOptions) => {
        const preservePlayback = !!options?.preservePlayback;
        const preserveBrainTurn = !!options?.preserveBrainTurn;
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
            transcriptFinalizeTimerRef.current = null;
        }
        if (!preservePlayback) {
            automaticSpeechRef.current.cancel();
            clearTtsInterruptionRecovery();
        }
        transcriptRef.current = '';
        lastXaiBargeInTranscriptAtRef.current = 0;
        lastXaiBargeInTranscriptNormRef.current = '';
        xaiBargeInTurnActiveRef.current = false;
        xaiUnconfirmedNoiseRef.current = false;
        xaiNoiseQuietFramesRef.current = 0;
        sttSetupCompleteRef.current = false;
        setCaptureConnected(false);
        setAcceptedSpeechPending(false);
        lastMicSpeechAtRef.current = 0;
        clearCurrentAudioCapture();
        if (!preserveBrainTurn) {
            setInputReceipt(null);
            processingTranscriptRef.current = false;
            lastProcessedTranscriptRef.current = '';
            lastProcessedTranscriptNormRef.current = '';
            inFlightSpeechTextRef.current = '';
            inFlightSpeechAnsweredRef.current = false;
            activeTranscriptNormRef.current = '';


            try { brainAbortRef.current?.abort(); } catch (e) { void e; }
            brainAbortRef.current = null;
        }
        if (!preservePlayback) {
            ttsSpeakingRef.current = false;
            ttsDuckedRef.current = false;
            currentTtsTextNormRef.current = '';
            lastTtsTextNormRef.current = '';
            ttsKnownResponseTextRef.current = '';
            ttsCurrentChunkTextRef.current = '';
            ttsSpokenTextRef.current = '';
            audioChunksRef.current = 0;
        }
        bargeInSpeechFramesRef.current = 0;
        lastBargeInAtRef.current = 0;
        lastTtsEndedAtRef.current = 0;
        ignoredSttTextPartsRef.current = 0;
        framesSentRef.current = 0;
    }, [clearCurrentAudioCapture, clearTtsInterruptionRecovery]);

    const cleanup = useCallback((options?: CleanupOptions) => {
        const preservePlayback = !!options?.preservePlayback && hasActiveTts();
        const preserveBrainTurn = !!options?.preserveBrainTurn;
        L(preservePlayback ? 'cleanup(STT only, preserving TTS)' : 'cleanup()', options?.reason || '');
        sttSetupCompleteRef.current = false;
        setCaptureConnected(false);
        setAcceptedSpeechPending(false);
        resolveSttReadyWaiters(false);
        if (reconnectTimerRef.current != null) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (reconnectStableTimerRef.current != null) {
            window.clearTimeout(reconnectStableTimerRef.current);
            reconnectStableTimerRef.current = null;
        }
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
            transcriptFinalizeTimerRef.current = null;
        }
        if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        analyserRef.current = null;
        try { procRef.current?.disconnect(); } catch (e) { void e; }
        procRef.current = null;
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        micStreamRef.current = null;
        try { inCtxRef.current?.close(); } catch (e) { void e; }
        inCtxRef.current = null;
        if (!preservePlayback) {
            stopPlayback({ reason: options?.reason || 'voice cleanup' });
            try { outCtxRef.current?.close(); } catch (e) { void e; }
            outCtxRef.current = null;
            outputGainRef.current = null;
        }
        try { sttSessionRef.current?.close?.(); } catch (e) { void e; }
        sttSessionRef.current = null;
        resetRuntimeRefs({ preservePlayback, preserveBrainTurn });
        setLevel(0);
        if (preservePlayback) {
            setStatus(hasAudiblePlayback() ? 'speaking' : 'thinking');
        }
    }, [hasActiveTts, hasAudiblePlayback, resetRuntimeRefs, resolveSttReadyWaiters, stopPlayback]);

    const scheduleSttReconnect = useCallback((reason: string, finalError: string) => {
        if (closedRef.current || sttRecoveringRef.current) {
            return false;
        }

        saveRetryCapture(reason);
        const preservePlayback = hasActiveTts();
        const preserveBrainTurn = processingTranscriptRef.current;
        const canReconnect = activeRef.current && sttReconnectAttemptsRef.current < MAX_STT_RECONNECT_ATTEMPTS;
        if (!canReconnect) {
            closedRef.current = !preservePlayback;
            sttRecoveringRef.current = false;
            setError(finalError);
            cleanup({ preservePlayback, preserveBrainTurn, reason: 'STT final failure' });
            activeRef.current = false;
            setActive(false);
            if (!preservePlayback) {
                setStatus('error');
            }
            return false;
        }

        L('STT recovering:', reason, 'attempt=', sttReconnectAttemptsRef.current + 1, 'preservePlayback=', preservePlayback);
        sttReconnectAttemptsRef.current += 1;
        sttRecoveringRef.current = true;
        preservePlaybackOnReconnectRef.current = preservePlayback;
        closedRef.current = !preservePlayback;
        setError(null);
        setStatus(preservePlayback ? (hasAudiblePlayback() ? 'speaking' : 'thinking') : 'connecting');
        cleanup({ preservePlayback, preserveBrainTurn, reason: 'STT reconnect' });
        activeRef.current = false;
        setActive(true);
        reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            closedRef.current = false;
            sttRecoveringRef.current = false;
            void startRef.current?.();
        }, STT_RECONNECT_DELAY_MS);
        return true;
    }, [cleanup, hasActiveTts, hasAudiblePlayback, saveRetryCapture]);

    const armNoTranscriptWatchdog = useCallback(() => {
        if (sttNoTranscriptTimerRef.current != null) {
            return;
        }

        sttNoTranscriptTimerRef.current = window.setTimeout(() => {
            sttNoTranscriptTimerRef.current = null;
            if (closedRef.current || !activeRef.current || processingTranscriptRef.current || transcriptRef.current.trim()) {
                return;
            }
            if (currentUtteranceSpeechFramesRef.current < VOICE_RETRY_MIN_SPEECH_FRAMES) {
                return;
            }

            const quietForMs = performance.now() - lastMicSpeechAtRef.current;
            if (lastMicSpeechAtRef.current && quietForMs < MIC_ACTIVITY_HOLD_MS) {
                armNoTranscriptWatchdog();
                return;
            }

            L('STT no transcript after speech; reconnecting');
            scheduleSttReconnect('no transcript after speech', 'STT did not return a transcript');
        }, STT_NO_TRANSCRIPT_MS);
    }, [scheduleSttReconnect]);

    const stop = useCallback(() => {
        L('stop()');
        closedRef.current = true;
        sttSessionIdRef.current += 1;
        sttRecoveringRef.current = false;
        if (reconnectTimerRef.current != null) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (reconnectStableTimerRef.current != null) {
            window.clearTimeout(reconnectStableTimerRef.current);
            reconnectStableTimerRef.current = null;
        }
        sttReconnectAttemptsRef.current = 0;
        voiceTurnIdRef.current += 1;
        try { brainAbortRef.current?.abort(); } catch (e) { void e; }
        brainAbortRef.current = null;
        activeTranscriptNormRef.current = '';
        recentTranscriptNormsRef.current.clear();
        cleanup();
        clearSavedRetry();
        activeRef.current = false;
        setActive(false);
        setStatus('idle');
    }, [cleanup, clearSavedRetry]);

    const ensureOutputContext = useCallback(async () => {
        const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!outCtxRef.current || outCtxRef.current.state === 'closed') {
            outCtxRef.current = new Ctx({ sampleRate: OUTPUT_RATE });
            nextStartRef.current = 0;
            outputGainRef.current = null;
        }
        if (!outputGainRef.current || outputGainRef.current.context !== outCtxRef.current) {
            const gain = outCtxRef.current.createGain();
            gain.gain.value = 1;
            gain.connect(outCtxRef.current.destination);
            outputGainRef.current = gain;
        }
        if (outCtxRef.current?.state === 'suspended') {
            await outCtxRef.current.resume();
        }
        if (outCtxRef.current?.state !== 'running') {
            throw new Error('Browser audio output is not available');
        }
        return outCtxRef.current;
    }, []);
    const playPcm = useCallback((int16: Int16Array) => {
        const ctx = outCtxRef.current;
        if (!ctx || int16.length === 0) {
            if (!ctx) L('playPcm: no output ctx');
            return;
        }
        const f32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            f32[i] = int16[i] / 0x8000;
        }
        const buffer = ctx.createBuffer(1, f32.length, OUTPUT_RATE);
        buffer.copyToChannel(f32, 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(outputGainRef.current || ctx.destination);
        const startAt = Math.max(ctx.currentTime, nextStartRef.current);
        src.start(startAt);
        nextStartRef.current = startAt + buffer.duration;
        sourcesRef.current.push(src);
        ttsSpeakingRef.current = true;
        setStatus('speaking');
        src.onended = () => {
            sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
        };
    }, []);

    const waitForPlaybackDrain = useCallback(async () => {
        const ctx = outCtxRef.current;
        if (!ctx) return;
        const delayMs = Math.max(0, (nextStartRef.current - ctx.currentTime) * 1000) + 80;
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }, []);

    const finishTtsRun = useCallback(async (runId: number) => {
        if (ttsRunIdRef.current !== runId) return;
        await waitForPlaybackDrain();
        if (ttsRunIdRef.current !== runId) return;
        if (audioChunksRef.current === 0) {
            ttsSpeakingRef.current = false;
            if (!closedRef.current) {
                setError('Voice TTS returned no audio');
                setStatus('error');
            }
            return;
        }
        clearTtsInterruptionRecovery();
        restoreTtsVolume(true);
        ttsSpeakingRef.current = false;
        currentTtsTextNormRef.current = '';
        ttsKnownResponseTextRef.current = '';
        ttsCurrentChunkTextRef.current = '';
        ttsSpokenTextRef.current = '';
        ttsDuckedRef.current = false;
        lastTtsEndedAtRef.current = performance.now();
        void pollConciergeVoiceReceipts(clikUrl);
        if (!closedRef.current) {
            setStatus(activeRef.current ? 'listening' : 'idle');
        }
    }, [clearTtsInterruptionRecovery, restoreTtsVolume, waitForPlaybackDrain]);

    const sendReplyForTts = useCallback(async (reply: string, options?: SendTtsOptions) => {
        const text = cleanTtsChunkText(reply);
        const automaticReady = () => !options?.automaticCurrent || (options.automaticCurrent()
            && !hasActiveTts() && !processingTranscriptRef.current && !transcriptRef.current.trim());
        const allowWhenStopped = !!options?.allowWhenStopped;
        const append = !!options?.append;
        const keepAlive = !!options?.keepAlive;
        if (!text || (closedRef.current && !allowWhenStopped) || !automaticReady()) {
            return false;
        }
        if (allowWhenStopped && closedRef.current) {
            closedRef.current = false;
        }

        const pendingRunId = ttsRunIdRef.current;
        const pendingTurnId = voiceTurnIdRef.current;
        await ensureOutputContext();
        // Audio-context resume can finish after Stop or a newer turn. It must
        // not revive speech that lost ownership while the browser was waiting.
        if (closedRef.current || ttsRunIdRef.current !== pendingRunId || voiceTurnIdRef.current !== pendingTurnId || !automaticReady()) return false;

        let runId: number;
        if (append) {
            runId = options?.runId || ttsRunIdRef.current;
            if (!runId || ttsRunIdRef.current !== runId) return;
            currentTtsTextNormRef.current = normalizeTranscript(options?.spokenText || text);
            lastTtsTextNormRef.current = currentTtsTextNormRef.current;
            ttsCurrentChunkTextRef.current = text;
            ttsSpokenTextRef.current = cleanTtsChunkText(options?.spokenText || `${ttsSpokenTextRef.current} ${text}`);
            if (!ttsKnownResponseTextRef.current) {
                ttsKnownResponseTextRef.current = ttsSpokenTextRef.current;
            }
        } else {
            stopPlayback();
            restoreTtsVolume(true);
            ttsKnownResponseTextRef.current = text;
            ttsCurrentChunkTextRef.current = text;
            ttsSpokenTextRef.current = '';
            currentTtsTextNormRef.current = normalizeTranscript(text);
            lastTtsTextNormRef.current = currentTtsTextNormRef.current;
            runId = ttsRunIdRef.current + 1;
            ttsRunIdRef.current = runId;
            audioChunksRef.current = 0;
        }

        const requestVoice = ttsVoiceRef.current;
        L(append ? 'TTS stream chunk <- Brainstorm:' : 'TTS stream <- Brainstorm reply:', text.slice(0, 120), 'voice=', requestVoice);
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        ttsSpeakingRef.current = true;
        if (audioChunksRef.current === 0) {
            setStatus('thinking');
        }

        try {
            const resp = await fetch(clikUrl + '/voiceTtsStream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...conversationMeasurementHeaders() },
                credentials: 'include',
                body: JSON.stringify({ text, voice: requestVoice, speakingRate: 1.04, conversationModel: store.getState().settings.conversationModel, billingPolicyVersion: CONVERSATION_PROFILE_POLICY_VERSION }),
                signal: controller.signal,
            });
            if (!resp.ok || !resp.body) {
                throw new Error(`TTS HTTP ${resp.status}`);
            }
            setTtsDelivery({ engine: resp.headers.get('X-TTS-Engine') || '',
                fallback: resp.headers.get('X-TTS-Fallback') === 'true',
                actualVoice: resp.headers.get('X-TTS-Fallback-Voice') || resp.headers.get('X-Voice') || requestVoice });

            const reader = resp.body.getReader();
            let trailingByte: number | null = null;
            while (!closedRef.current && ttsRunIdRef.current === runId) {
                const { value, done } = await reader.read();
                if (done) break;
                if (!value || value.length === 0) continue;

                let pcmBytes = value;
                if (trailingByte !== null) {
                    const merged = new Uint8Array(value.length + 1);
                    merged[0] = trailingByte;
                    merged.set(value, 1);
                    pcmBytes = merged;
                    trailingByte = null;
                }
                if (pcmBytes.length % 2 !== 0) {
                    trailingByte = pcmBytes[pcmBytes.length - 1];
                    pcmBytes = pcmBytes.slice(0, pcmBytes.length - 1);
                }
                if (pcmBytes.length === 0) continue;

                audioChunksRef.current += 1;
                if (audioChunksRef.current <= 3 || audioChunksRef.current % 20 === 0) {
                    L('TTS PCM chunk IN #', audioChunksRef.current, 'bytes=', pcmBytes.length);
                }
                if (ttsRunIdRef.current !== runId) break;
                playPcm(bytesToInt16(pcmBytes));
            }

            if (ttsRunIdRef.current !== runId) return;
            if (!keepAlive) {
                await finishTtsRun(runId);
            }
        } catch (e: any) {
            if (controller.signal.aborted || closedRef.current || ttsRunIdRef.current !== runId) {
                L('TTS stream aborted');
                return;
            }
            L('voiceTtsStream error', e);
            stopPlayback({ reason: 'Speech failed' });
            store.dispatch(showAiProviderNotice(
                requestVoice.startsWith('fish_')
                    ? 'Fish voice unavailable — select a Gemini voice from the list'
                    : 'Gemini voice unavailable — select a Fish voice from the list'
            ));
            ttsSpeakingRef.current = false;
            setStatus('error');
            setError('Voice TTS failed');
        } finally {
            if (ttsAbortRef.current === controller) {
                ttsAbortRef.current = null;
            }
            drainAutomaticSpeechRef.current();
        }
        return true;
    }, [clikUrl, ensureOutputContext, finishTtsRun, hasActiveTts, playPcm, restoreTtsVolume, stopPlayback]);

    drainAutomaticSpeechRef.current = () => {
        void automaticSpeechRef.current.flush(async (text, current) =>
            (await sendReplyForTts(text, { allowWhenStopped: true, automaticCurrent: current })) !== false
        ).catch(error => L('Automatic speech failed', error));
    };
    const queueAutomaticSpeech = useCallback((text: string, current: () => boolean) => {
        automaticSpeechRef.current.offer(text, current);
        drainAutomaticSpeechRef.current();
    }, []);
    const cancelAutomaticSpeech = useCallback(() => automaticSpeechRef.current.cancel(), []);

    ttsRecoverySpeakRef.current = (text: string) => {
        void sendReplyForTts(text, { allowWhenStopped: true });
    };

    const speakText = useCallback(async (text: string) => {
        automaticSpeechRef.current.cancel();
        await sendReplyForTts(text, { allowWhenStopped: true });
    }, [sendReplyForTts]);

    const processTranscript = useCallback(async (rawText: string, inputSource: 'speech' | 'text' = 'speech') => {
        setAcceptedSpeechPending(false);
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
            transcriptFinalizeTimerRef.current = null;
        }
        const isTypedInput = inputSource === 'text';
        const text = isTypedInput
            ? (rawText || '').trim()
            : correctClikbAliasTranscript(collapseRepeatedShortTranscript((rawText || '').trim()));
        if (!text) {
            return;
        }
        if (!isTypedInput && isFillerOnly(text)) {
            L('filler-only transcript ignored:', text);
            return;
        }
        if (!isTypedInput && isLikelySttKeytermLeak(text)) {
            L('STT keyterm leak ignored before processing:', text);
            return;
        }

        const normalizedText = normalizeTranscript(text);
        if (!normalizedText) {
            return;
        }

        if (isTypedInput) {
            closedRef.current = false;
            setError(null);
        }

        const now = performance.now();
        if (!isTypedInput) {
            for (const [norm, seenAt] of recentTranscriptNormsRef.current) {
                if (now - seenAt > RECENT_TRANSCRIPT_TTL_MS) {
                    recentTranscriptNormsRef.current.delete(norm);
                }
            }
            if (normalizedText === activeTranscriptNormRef.current || recentTranscriptNormsRef.current.has(normalizedText)) {
                L('duplicate/recent transcript ignored:', text);
                return;
            }
            if (normalizedText === lastProcessedTranscriptNormRef.current) {
                L('duplicate transcript ignored:', text);
                return;
            }
        }

        clearTtsInterruptionRecovery();

        if (processingTranscriptRef.current) {
            L('new transcript supersedes in-flight brain turn:', text);
        }

        const turnId = voiceTurnIdRef.current + 1;
        automaticSpeechRef.current.cancel();
        setInputReceipt({turnId,text:text.slice(0,120)});
        voiceTurnIdRef.current = turnId;
        try { brainAbortRef.current?.abort(); } catch (e) { void e; }
        const brainController = new AbortController();
        brainAbortRef.current = brainController;

        transcriptRef.current = '';
        lastXaiBargeInTranscriptAtRef.current = 0;
        lastXaiBargeInTranscriptNormRef.current = '';
        xaiBargeInTurnActiveRef.current = false;
        xaiUnconfirmedNoiseRef.current = false;
        xaiNoiseQuietFramesRef.current = 0;
        clearSavedRetry();
        clearCurrentAudioCapture();
        processingTranscriptRef.current = true;
        activeTranscriptNormRef.current = normalizedText;
        inFlightSpeechTextRef.current = isTypedInput ? '' : text;
        inFlightSpeechAnsweredRef.current = false;
        if (!isTypedInput) {
            recentTranscriptNormsRef.current.set(normalizedText, now);
            lastProcessedTranscriptRef.current = text;
            lastProcessedTranscriptNormRef.current = normalizedText;
        }
        const wasSpeakingBeforeBrainTurn = hasAudiblePlayback();
        if (wasSpeakingBeforeBrainTurn) {
            duckTtsVolume();
            scheduleTtsRestore();
            setStatus('speaking');
        } else {
            stopPlayback({ reason: 'new user turn while no AI audio is playing' });
            setStatus('thinking');
        }

        let streamedReply = '';
        let streamTtsBuffer = '';
        let streamTtsStarted = false;
        let streamTtsFinalized = false;
        let streamTtsRunId = 0;
        let streamSpokenText = '';
        let ttsQueue: Promise<void> = Promise.resolve();

        const reportTtsQueue = () => {
            void ttsQueue.catch((e) => L('streamed TTS queue error', e));
        };

        const beginStreamTts = () => {
            if (streamTtsStarted) return true;
            if (closedRef.current || brainController.signal.aborted || voiceTurnIdRef.current !== turnId) return false;
            streamTtsStarted = true;
            streamTtsRunId = ttsRunIdRef.current + 1;
            ttsRunIdRef.current = streamTtsRunId;
            ttsSpeakingRef.current = true;
            ttsDuckedRef.current = false;
            audioChunksRef.current = 0;
            restoreTtsVolume(true);
            setStatus('thinking');
            L('Brainstorm stream -> TTS starts before final reply');
            return true;
        };

        const queueStreamTtsChunk = (chunk: string, final = false) => {
            const spoken = cleanTtsChunkText(chunk);
            if (!spoken || !beginStreamTts()) return;
            if (final) streamTtsFinalized = true;
            streamSpokenText = `${streamSpokenText} ${spoken}`.trim();
            const spokenText = streamSpokenText;
            const runId = streamTtsRunId;
            const keepAlive = !final;
            ttsQueue = ttsQueue.then(async () => {
                if (closedRef.current || brainController.signal.aborted || voiceTurnIdRef.current !== turnId || ttsRunIdRef.current !== runId) return;
                await sendReplyForTts(spoken, { append: true, keepAlive, runId, spokenText });
            });
            reportTtsQueue();
        };

        const flushStreamTts = (force = false) => {
            while (true) {
                const next = takeNextTtsSpeechChunk(streamTtsBuffer, force);
                if (!next) break;
                streamTtsBuffer = next.rest;
                const isFinal = force && !streamTtsBuffer.trim();
                queueStreamTtsChunk(next.chunk, isFinal);
            }
        };

        const finishQueuedStreamTts = () => {
            if (!streamTtsStarted || streamTtsFinalized) return;
            streamTtsFinalized = true;
            const runId = streamTtsRunId;
            ttsQueue = ttsQueue.then(async () => {
                if (closedRef.current || brainController.signal.aborted || voiceTurnIdRef.current !== turnId || ttsRunIdRef.current !== runId) return;
                await finishTtsRun(runId);
            });
            reportTtsQueue();
        };

        let reply = '';
        let shouldSpeak = false;
        try {
            L(isTypedInput ? 'Text -> Brainstorm:' : 'STT -> Brainstorm:', text);
            reply = await callBrain(text, brainController.signal, {
                onTextDelta: (delta: string) => {
                    if (brainController.signal.aborted || voiceTurnIdRef.current !== turnId) return;
                    const piece = String(delta || '');
                    if (!piece) return;
                    if (wasSpeakingBeforeBrainTurn && hasAudiblePlayback() && !streamTtsStarted) {
                        L('new Brainstorm text started; replacing previous AI speech');
                        stopPlayback({ reason: 'new Brainstorm text started' });
                    }
                    streamedReply += piece;
                    inFlightSpeechAnsweredRef.current = true;
                    ttsKnownResponseTextRef.current = cleanTtsChunkText(streamedReply);
                    streamTtsBuffer += piece;
                    flushStreamTts(false);
                },
                onFinalText: (finalText: string) => {
                    if (closedRef.current || brainController.signal.aborted || voiceTurnIdRef.current !== turnId) return;
                    streamedReply = streamedReply || String(finalText || '');
                    if (streamedReply.trim()) inFlightSpeechAnsweredRef.current = true;
                    ttsKnownResponseTextRef.current = cleanTtsChunkText(streamedReply);
                },
            });
            if (brainController.signal.aborted || voiceTurnIdRef.current !== turnId) {
                L('brain reply ignored for stale/aborted voice turn:', text);
                return;
            }
            if (!reply && streamedReply.trim()) {
                reply = streamedReply;
            }
            if (reply || streamedReply.trim()) {
                ttsKnownResponseTextRef.current = cleanTtsChunkText(reply || streamedReply);
            }
            if (streamedReply.trim()) {
                flushStreamTts(true);
                finishQueuedStreamTts();
            }
            L('Brainstorm -> text:', reply.slice(0, 120));
            shouldSpeak = !streamTtsStarted;
        } catch (e: any) {
            if (brainController.signal.aborted || e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
                L('brain turn aborted silently:', text);
                return;
            }
            if (voiceTurnIdRef.current !== turnId) {
                L('brain error ignored for stale voice turn:', e);
                return;
            }
            L('brain error', e);
            reply = 'Sorry, I could not reach my brain just now.';
            shouldSpeak = !streamTtsStarted;
        } finally {
            if (brainAbortRef.current === brainController) {
                brainAbortRef.current = null;
            }
            if (voiceTurnIdRef.current === turnId) {
                setInputReceipt(null);
                processingTranscriptRef.current = false;
                if (!brainController.signal.aborted) { inFlightSpeechTextRef.current = ''; inFlightSpeechAnsweredRef.current = false;
        
        
                }
                if (activeTranscriptNormRef.current === normalizedText) {
                    activeTranscriptNormRef.current = '';


                }
            }
        }

        if (shouldSpeak && reply && voiceTurnIdRef.current === turnId && !closedRef.current) {
            void sendReplyForTts(reply);
        }
        return reply;
    }, [callBrain, clearCurrentAudioCapture, clearSavedRetry, clearTtsInterruptionRecovery, duckTtsVolume, finishTtsRun, hasAudiblePlayback, restoreTtsVolume, scheduleTtsRestore, sendReplyForTts, stopPlayback]);

    const askText = useCallback(async (text: string) => (
        (await processTranscript(text, 'text')) || ''
    ), [processTranscript]);

    const scheduleTranscriptProcessing = useCallback((reason: string, delayMs = TRANSCRIPT_SETTLE_MS, opts?: { ignoreMicHold?: boolean; useXaiBargeInTranscriptGuard?: boolean }) => {
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
        }

        const armTimer = (nextDelayMs: number) => {
            transcriptFinalizeTimerRef.current = window.setTimeout(() => {
                transcriptFinalizeTimerRef.current = null;
                const pendingTranscript = transcriptRef.current.trim();
                if (!pendingTranscript) return;

                if (opts?.useXaiBargeInTranscriptGuard && lastXaiBargeInTranscriptAtRef.current) {
                    const transcriptIdleForMs = performance.now() - lastXaiBargeInTranscriptAtRef.current;
                    if (transcriptIdleForMs < XAI_BARGE_IN_TRANSCRIPT_IDLE_MS) {
                        const retryDelay = Math.max(
                            80,
                            XAI_BARGE_IN_TRANSCRIPT_IDLE_MS - transcriptIdleForMs + XAI_BARGE_IN_RECHECK_PADDING_MS,
                        );
                        L('xAI barge-in settle delayed; recent transcript activity', Math.round(transcriptIdleForMs), 'ms');
                        armTimer(retryDelay);
                        return;
                    }
                }

                const quietForMs = performance.now() - lastMicSpeechAtRef.current;
                if (!opts?.ignoreMicHold && lastMicSpeechAtRef.current && quietForMs < MIC_ACTIVITY_HOLD_MS) {
                    const retryDelay = Math.max(250, MIC_ACTIVITY_HOLD_MS - quietForMs + 250);
                    L('STT settle delayed; mic still active', Math.round(quietForMs), 'ms');
                    armTimer(retryDelay);
                    return;
                }

                L('STT settled -> Brainstorm:', reason, pendingTranscript);
                void processTranscript(pendingTranscript);
            }, nextDelayMs);
        };

        armTimer(delayMs);
    }, [processTranscript]);
    const handleSttMessage = useCallback(async (message: any) => {
        if (closedRef.current) return;
        try {
            L('STT onmessage keys=', Object.keys(message || {}),
                '| serverContent=', !!message?.serverContent,
                '| setupComplete=', !!message?.setupComplete);
            if (message?.serverContent) {
                const sc = message.serverContent;
                L('  STT serverContent keys=', Object.keys(sc),
                    '| turnComplete=', sc.turnComplete,
                    '| interrupted=', sc.interrupted,
                    '| inputTranscription=', sc.inputTranscription);
            }
        } catch (e) { L('STT log error', e); }

        if (message?.setupComplete) {
            sttSetupCompleteRef.current = true;
            setCaptureConnected(true);
            resolveSttReadyWaiters(true);
            if (!processingTranscriptRef.current && !hasActiveTts()) {
                setStatus('listening');
            }
        }

        const serverContent = message?.serverContent;
        if (serverContent?.interrupted && hasAudiblePlayback()) {
            lastBargeInAtRef.current = performance.now();
            L('STT provider detected possible interruption during TTS; ducking until transcript confirms speech');
            duckTtsVolume();
            scheduleTtsRestore();
            armTtsInterruptionRecovery('possible noise while AI was speaking');
            setStatus('speaking');
        }

        const inputTranscription = serverContent?.inputTranscription;
        const transcriptText = correctClikbAliasTranscript(String(inputTranscription?.text ?? '').trim());
        if (transcriptText) {
            if (isLikelySttKeytermLeak(transcriptText)) {
                L('STT keyterm leak ignored:', transcriptText);
                if (hasAudiblePlayback()) {
                    scheduleTtsRestore();
                    armTtsInterruptionRecovery('possible noise while AI was speaking');
                    setStatus('speaking');
                }
                return;
            }
            clearNoTranscriptWatchdog();
            const now = performance.now();
            const isPostTtsEchoWindow = lastTtsEndedAtRef.current > 0 && now - lastTtsEndedAtRef.current <= TTS_ECHO_GRACE_MS;
            const echoSource = currentTtsTextNormRef.current || lastTtsTextNormRef.current;
            const canBeEcho = !!echoSource && (hasActiveTts() || ttsDuckedRef.current || isPostTtsEchoWindow);

            if (canBeEcho && isLikelyEchoTranscript(transcriptText, echoSource)) {
                L('STT transcript ignored as TTS echo:', transcriptText);
                return;
            }

            const transcriptNorm = normalizeTranscript(transcriptText);
            if (processingTranscriptRef.current && transcriptNorm && transcriptNorm === activeTranscriptNormRef.current) {
                L('STT duplicate transcript ignored while brain is busy:', transcriptText);
                return;
            }

            const transcriptFinished = !!inputTranscription?.finished;
            const wasTtsSpeaking = hasAudiblePlayback();
            const confirmedSpeech = isConfirmedUserSpeechTranscript(transcriptText, {
                final: transcriptFinished,
                duringTts: wasTtsSpeaking,
            });
            if (!confirmedSpeech) {
                L('STT transcript ignored as weak/noise candidate:', transcriptText);
                if (wasTtsSpeaking) {
                    scheduleTtsRestore();
                    armTtsInterruptionRecovery('possible noise while AI was speaking');
                    setStatus('speaking');
                }
                return;
            }

            if (wasTtsSpeaking) {
                L('barge-in transcript confirmed; ducking old audio until new response text starts', transcriptText);
                duckTtsVolume();
                scheduleTtsRestore();
                setStatus('speaking');
            }
            setAcceptedSpeechPending(true);
            if (processingTranscriptRef.current && !inFlightSpeechAnsweredRef.current) {
                L('STT user continued speaking while brain turn had not answered; aborting and merging:', inFlightSpeechTextRef.current, '->', transcriptText);
                try { brainAbortRef.current?.abort(); } catch (e) { void e; }
                brainAbortRef.current = null;
                processingTranscriptRef.current = false;
                setInputReceipt(null);
                if (inFlightSpeechTextRef.current) {
                    transcriptRef.current = mergeTranscript(inFlightSpeechTextRef.current, transcriptRef.current);
                inFlightSpeechTextRef.current = '';
                    inFlightSpeechTextRef.current = '';
        
                }
                if (!wasTtsSpeaking) setStatus('listening');
            }
            if (processingTranscriptRef.current && !inFlightSpeechAnsweredRef.current) {
            L('xAI user continued speaking while brain turn had not answered; aborting and merging:', inFlightSpeechTextRef.current, '->', transcriptText);
            try { brainAbortRef.current?.abort(); } catch (e) { void e; }
            brainAbortRef.current = null;
            processingTranscriptRef.current = false;
            setInputReceipt(null);
            if (inFlightSpeechTextRef.current) {
                transcriptRef.current = mergeTranscript(inFlightSpeechTextRef.current, transcriptRef.current);
                inFlightSpeechTextRef.current = '';
    
            }
            if (!wasTtsSpeaking) setStatus('listening');
        }
        transcriptRef.current = mergeTranscript(transcriptRef.current, transcriptText);
            L('input transcript', transcriptFinished ? '(finished)' : '(partial)', transcriptText, '| buffered=', transcriptRef.current);
            if (transcriptFinished) {
                scheduleTranscriptProcessing('finished transcription');
            } else if (wasTtsSpeaking) {
                scheduleTranscriptProcessing('barge-in provisional transcription', TTS_BARGE_IN_PROVISIONAL_SETTLE_MS);
            } else {
                scheduleTranscriptProcessing('partial transcription');
            }
        }

        const textParts = message?.serverContent?.modelTurn?.parts ?? [];
        for (const part of textParts) {
            if (part?.text) {
                ignoredSttTextPartsRef.current += 1;
                if (ignoredSttTextPartsRef.current <= 3 || ignoredSttTextPartsRef.current % 10 === 0) {
                    L('ignored STT model text #', ignoredSttTextPartsRef.current, String(part.text).slice(0, 80));
                }
            }
        }

        if (message?.serverContent?.turnComplete) {
            const pendingTranscript = transcriptRef.current.trim();
            if (pendingTranscript && !processingTranscriptRef.current) {
                L('STT turnComplete with pending transcript; waiting for settle window');
                scheduleTranscriptProcessing('turnComplete', TRANSCRIPT_TURN_COMPLETE_SETTLE_MS);
                return;
            }
            if (!processingTranscriptRef.current && !hasActiveTts()) {
                setStatus('listening');
            }
        }
    }, [armTtsInterruptionRecovery, clearNoTranscriptWatchdog, duckTtsVolume, hasActiveTts, hasAudiblePlayback, processTranscript, resolveSttReadyWaiters, scheduleTranscriptProcessing, scheduleTtsRestore]);

    // xAI streaming STT events: transcript.created -> ready,
    // transcript.partial -> { text, is_final, speech_final }, transcript.done -> flush.
    // Unlike the Gemini path, barge-in here is word-based: any non-echo transcript
    // arriving during TTS counts as a confirmed interruption (interim ducks, final stops).
    const handleXaiSttEvent = useCallback((event: any) => {
        if (event?.type === 'metered_billing') {
            handleConciergeMeteredBillingEvent(event);
            if (event?.exhausted || event?.zeroBalance) {
                closedRef.current = true;
                activeRef.current = false;
                cleanup({ preservePlayback: true, preserveBrainTurn: true, reason: 'metered voice exhausted' });
                setActive(false);
                setError(event?.message || 'Insufficient Pixels for metered voice mode.');
                setStatus('error');
            }
            return;
        }
        if (closedRef.current) return;

        if (event?.type === 'transcript.created') {
            L('xAI STT ready (transcript.created)');
            sttSetupCompleteRef.current = true;
            setCaptureConnected(true);
            resolveSttReadyWaiters(true);
            if (!processingTranscriptRef.current && !hasActiveTts()) {
                setStatus('listening');
            }
            return;
        }
        if (event?.type === 'error') {
            L('xAI STT error event:', event?.message);
            return;
        }
        if (event?.type !== 'transcript.partial' && event?.type !== 'transcript.done') {
            return;
        }

        const transcriptText = correctClikbAliasTranscript(String(event?.text ?? '').trim());
        if (!transcriptText) return;
        if (isLikelySttKeytermLeak(transcriptText)) {
            L('xAI keyterm leak ignored:', transcriptText);
            if (hasAudiblePlayback()) {
                armTtsInterruptionRecovery('possible noise while AI was speaking');
                setStatus('speaking');
            }
            return;
        }
        clearNoTranscriptWatchdog();

        const isFinal = event?.type === 'transcript.done' ? true : !!event?.is_final;
        const speechFinal = event?.type === 'transcript.done' ? true : !!event?.speech_final;

        const now = performance.now();
        const wasTtsSpeaking = hasAudiblePlayback();
        const isXaiBargeInContext = xaiBargeInTurnActiveRef.current
            || wasTtsSpeaking
            || ttsDuckedRef.current
            || (lastBargeInAtRef.current > 0 && now - lastBargeInAtRef.current <= BARGE_IN_TRANSCRIPT_WINDOW_MS);
        const isPostTtsEchoWindow = lastTtsEndedAtRef.current > 0 && now - lastTtsEndedAtRef.current <= TTS_ECHO_GRACE_MS;
        const echoSource = currentTtsTextNormRef.current || lastTtsTextNormRef.current;
        const canBeEcho = !!echoSource && (hasActiveTts() || ttsDuckedRef.current || isPostTtsEchoWindow);
        if (canBeEcho && isLikelyEchoTranscript(transcriptText, echoSource)) {
            L('xAI transcript ignored as TTS echo:', transcriptText);
            if (hasAudiblePlayback()) {
                armTtsInterruptionRecovery('possible noise while AI was speaking');
                setStatus('speaking');
            }
            return;
        }

        const transcriptNorm = normalizeTranscript(transcriptText);
        // Liveness has a deliberately lower bar than submission. A short,
        // revisable non-echo interim may be too weak to send to Brainstorm, but
        // it is still strong evidence that the interrupted user is continuing.
        if (transcriptNorm && transcriptNorm !== lastXaiBargeInTranscriptNormRef.current) {
            const previousActivityAt = lastXaiBargeInTranscriptAtRef.current;
            lastXaiBargeInTranscriptAtRef.current = now;
            lastXaiBargeInTranscriptNormRef.current = transcriptNorm;
            if (previousActivityAt > 0) {
                L('xAI barge-in transcript liveness gap', Math.round(now - previousActivityAt), 'ms');
            }
        }
        if (processingTranscriptRef.current && transcriptNorm && transcriptNorm === activeTranscriptNormRef.current) {
            L('xAI duplicate transcript ignored while brain is busy:', transcriptText);
            return;
        }

        const confirmedSpeech = isConfirmedUserSpeechTranscript(transcriptText, {
            final: isFinal,
            duringTts: isXaiBargeInContext,
        });

        if (isXaiBargeInContext && confirmedSpeech) {
            xaiBargeInTurnActiveRef.current = true;
            xaiUnconfirmedNoiseRef.current = false;
            xaiNoiseQuietFramesRef.current = 0;
        }

        if (wasTtsSpeaking) {
            lastBargeInAtRef.current = now;
            if (confirmedSpeech) {
                L('xAI barge-in confirmed; stopping the previous AI response:', transcriptText);
                stopPlayback({ reason: 'xAI confirmed user barge-in' });
                setStatus('listening');
            } else {
                L(isFinal ? 'xAI final transcript during TTS ignored as weak/noise candidate:' : 'xAI provisional transcript during TTS ignored as weak/noise candidate:', transcriptText);
                scheduleTtsRestore({ ignoreMicActivity: true });
                armTtsInterruptionRecovery('possible noise while AI was speaking');
                setStatus('speaking');
                return;
            }
        }

        if (!isFinal && !isXaiBargeInContext) {
            if (processingTranscriptRef.current && !inFlightSpeechAnsweredRef.current && confirmedSpeech) {
                L('xAI interim speech arrived while brain turn had not answered; aborting and re-buffering:', inFlightSpeechTextRef.current, '->', transcriptText);
                try { brainAbortRef.current?.abort(); } catch (e) { void e; }
                brainAbortRef.current = null;
                processingTranscriptRef.current = false;
                setInputReceipt(null);
                if (inFlightSpeechTextRef.current) {
                    transcriptRef.current = mergeTranscript(inFlightSpeechTextRef.current, transcriptRef.current);
                inFlightSpeechTextRef.current = '';
                    inFlightSpeechTextRef.current = '';
        
                }
                setStatus('listening');
            }
            if (transcriptRef.current.trim() && transcriptFinalizeTimerRef.current != null) {
                scheduleTranscriptProcessing('xai interim continuation', XAI_SPEECH_FINAL_SETTLE_MS, { ignoreMicHold: true, useXaiBargeInTranscriptGuard: true });
            }
            // Interim text can still be revised by the server; never buffer it during normal listening.
            L('xAI interim transcript:', transcriptText);
            return;
        }

        if (!confirmedSpeech) {
            L('xAI final transcript ignored as weak/noise candidate:', transcriptText);
            return;
        }

        setAcceptedSpeechPending(true);
        if (processingTranscriptRef.current && !inFlightSpeechAnsweredRef.current) {
            L('xAI user continued speaking while brain turn had not answered; aborting and merging:', inFlightSpeechTextRef.current, '->', transcriptText);
            try { brainAbortRef.current?.abort(); } catch (e) { void e; }
            brainAbortRef.current = null;
            processingTranscriptRef.current = false;
            setInputReceipt(null);
            if (inFlightSpeechTextRef.current) {
                transcriptRef.current = mergeTranscript(inFlightSpeechTextRef.current, transcriptRef.current);
                inFlightSpeechTextRef.current = '';
    
            }
            if (!wasTtsSpeaking) setStatus('listening');
        }
        transcriptRef.current = mergeTranscript(transcriptRef.current, transcriptText);
        L('xAI transcript', speechFinal ? '(utterance final)' : isFinal ? '(chunk final)' : '(barge-in provisional)', transcriptText, '| buffered=', transcriptRef.current);
        const xaiBargeInGuardOptions = { ignoreMicHold: true, useXaiBargeInTranscriptGuard: true };


        if (speechFinal) {
            // Keep ordinary Smart Turn fast. During barge-in, require a bounded
            // period with no new non-echo transcript activity before processing.
            scheduleTranscriptProcessing(
                'xai speech_final',
                XAI_SPEECH_FINAL_SETTLE_MS,
                xaiBargeInGuardOptions || { ignoreMicHold: true },
            );
        } else if (isFinal) {
            // Chunk final: text is locked but the utterance continues; long fallback only.
            scheduleTranscriptProcessing('xai chunk final fallback', XAI_CHUNK_FINAL_FALLBACK_MS, xaiBargeInGuardOptions);
        } else {
            // xAI can stop AI playback from a provisional barge-in before it sends final text.
            // Buffer confirmed speech here so the UI cannot sit in Listening with no user turn.
            scheduleTranscriptProcessing('xai provisional barge-in fallback', TTS_BARGE_IN_PROVISIONAL_SETTLE_MS, xaiBargeInGuardOptions);
        }
    }, [armTtsInterruptionRecovery, cleanup, clearNoTranscriptWatchdog, hasActiveTts, hasAudiblePlayback, resolveSttReadyWaiters, scheduleTranscriptProcessing, scheduleTtsRestore, stopPlayback]);
    // Connects to the backend xAI STT proxy and returns an adapter with the same
    // surface the Gemini session exposes (sendRealtimeInput / close), so the rest
    // of the hook (mic pipeline, reconnects, retry replay) works unchanged.
    const connectXaiStt = useCallback((sessionId: number, provider: 'xai' | 'gemini' = 'xai') => {
        const wsUrl = clikUrl.replace(/^http/i, 'ws') + (provider === 'gemini' ? GEMINI_STT_WS_PATH : XAI_STT_WS_PATH)
            + `?measurementSessionId=${encodeURIComponent(getConversationMeasurementSessionId())}&conversationModel=${encodeURIComponent(String(store.getState().settings.conversationModel || 'luna'))}&billingPolicyVersion=${encodeURIComponent(CONVERSATION_PROFILE_POLICY_VERSION)}`;
        let activeSttTier = String(store.getState().settings.conversationModel || 'luna');
        L('STT: connecting to xAI proxy at', wsUrl);
        return new Promise<any>((resolve, reject) => {
            let settled = false;
            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';

            const adapter = {
                sendRealtimeInput: (input: any) => {
                    if (ws.readyState !== WebSocket.OPEN) return;
                    const currentTier = String(store.getState().settings.conversationModel || 'luna');
                    if (currentTier !== activeSttTier) {
                        activeSttTier = currentTier;
                        try { ws.send(JSON.stringify({ type: 'clikb.tier', conversationModel: currentTier, billingPolicyVersion: CONVERSATION_PROFILE_POLICY_VERSION })); } catch (e) { void e; }
                    }
                    const data = input?.audio?.data;
                    if (!data) return;
                    ws.send(base64ToBytes(String(data)).buffer);
                },
                close: () => { try { ws.close(); } catch (e) { void e; } },
            };

            ws.onopen = () => {
                if (sttSessionIdRef.current !== sessionId) {
                    try { ws.close(); } catch (e) { void e; }
                    return;
                }
                L('xAI STT WS onopen');
                sttRecoveringRef.current = false;
                if (reconnectStableTimerRef.current != null) {
                    window.clearTimeout(reconnectStableTimerRef.current);
                }
                reconnectStableTimerRef.current = window.setTimeout(() => {
                    if (activeRef.current && !closedRef.current) {
                        sttReconnectAttemptsRef.current = 0;
                    }
                }, STT_RECONNECT_STABLE_MS);
                setError(null);
                setStatus(sttSetupCompleteRef.current ? 'listening' : 'connecting');
                if (!settled) {
                    settled = true;
                    resolve(adapter);
                }
            };
            ws.onmessage = (ev: MessageEvent) => {
                if (closedRef.current || sttSessionIdRef.current !== sessionId) return;
                if (typeof ev.data !== 'string') return;
                try {
                    const event = JSON.parse(ev.data);
                    if (provider === 'gemini' && event.type === 'gemini_message') void handleSttMessage(event.message);
                    else handleXaiSttEvent(event);
                } catch (e) {
                    L('xAI STT message parse error', e);
                }
            };
            ws.onerror = (ev: any) => {
                if (sttSessionIdRef.current !== sessionId) return;
                L('xAI STT WS onerror', ev);
                if (!settled) {
                    settled = true;
                    reject(new Error('xAI STT proxy connection failed'));
                    return;
                }
                scheduleSttReconnect('xai stt error', 'STT error: xai proxy connection');
            };
            ws.onclose = (ev: CloseEvent) => {
                if (sttSessionIdRef.current !== sessionId) return;
                L('xAI STT WS onclose code=', ev?.code, 'reason=', ev?.reason);
                if (!settled) {
                    settled = true;
                    reject(new Error('xAI STT proxy closed: ' + (ev?.reason || String(ev?.code))));
                    return;
                }
                if (closedRef.current) return;
                scheduleSttReconnect('xai stt close', 'STT closed: ' + (ev?.reason || String(ev?.code)));
            };
        });
    }, [clikUrl, handleSttMessage, handleXaiSttEvent, scheduleSttReconnect]);

    const start = useCallback(async () => {
        if (activeRef.current && !closedRef.current) {
            L('start: already active');
            return;
        }
        const preservePlaybackOnStart = preservePlaybackOnReconnectRef.current && hasActiveTts();
        preservePlaybackOnReconnectRef.current = false;
        setError(null);
        setStatus(preservePlaybackOnStart ? (hasAudiblePlayback() ? 'speaking' : 'thinking') : 'connecting');
        closedRef.current = false;
        const sessionId = sttSessionIdRef.current + 1;
        sttSessionIdRef.current = sessionId;
        resetRuntimeRefs({
            preservePlayback: preservePlaybackOnStart,
            preserveBrainTurn: preservePlaybackOnStart && processingTranscriptRef.current,
        });
        try {
            await ensureOutputContext();
            // Backend defaults STT to xAI when a key exists; Gemini is only fallback/override.
            let sttProvider: 'gemini' | 'xai' = 'xai';
            try {
                const provResp = await fetch(clikUrl + '/sttProvider');
                if (provResp.ok) {
                    const provData = await provResp.json();
                    sttProvider = String(provData?.provider || '').toLowerCase() === 'gemini' ? 'gemini' : 'xai';
                }
            } catch (e) {
                L('sttProvider fetch failed; defaulting to xAI', e);
            }
            sttProviderRef.current = sttProvider;
            L('STT provider:', sttProvider);

            const sttSession = await connectXaiStt(sessionId, sttProvider);
            if (sttSessionIdRef.current !== sessionId || closedRef.current) {
                try { sttSession?.close?.(); } catch (e) { void e; }
                return;
            }
            sttSessionRef.current = sttSession;

            L('start: requesting mic...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: INPUT_RATE,
                    sampleSize: 16,
                },
            });
            L('start: mic granted, tracks=', stream.getTracks().length);
            micStreamRef.current = stream;
            const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
            const inCtx: any = new Ctx();
            inCtxRef.current = inCtx;
            L('start: input AudioContext sampleRate=', inCtx.sampleRate);
            const source = inCtx.createMediaStreamSource(stream);

            const analyser = inCtx.createAnalyser();
            analyser.fftSize = 512;
            analyserRef.current = analyser;
            source.connect(analyser);
            const meter = new Uint8Array(analyser.frequencyBinCount);
            let lastTick = 0;

            const tick = (t: number) => {
                const a = analyserRef.current;
                if (!a) {
                    return;
                }
                if (t - lastTick > 60) {
                    a.getByteTimeDomainData(meter);
                    let sum = 0;
                    for (let i = 0; i < meter.length; i++) {
                        const v = (meter[i] - 128) / 128;
                        sum += v * v;
                    }
                    const rms = Math.sqrt(sum / meter.length);
                    const nextLevel = Math.min(1, rms * 4.8);
                    setLevel(nextLevel);
                    lastTick = t;
                }
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);

            const proc = inCtx.createScriptProcessor(4096, 1, 1);
            procRef.current = proc;
            proc.onaudioprocess = (e: any) => {
                if (closedRef.current || sttSessionIdRef.current !== sessionId || !sttSessionRef.current) {
                    return;
                }
                const input = e.inputBuffer.getChannelData(0);
                const rms = getFrameRms(input);
                const hasSpeech = isLikelySpeechFrame(input);
                if (hasSpeech) {
                    lastMicSpeechAtRef.current = performance.now();
                }
                if (hasAudiblePlayback()) {
                    if (rms >= BARGE_IN_RMS_THRESHOLD) {
                        xaiNoiseQuietFramesRef.current = 0;
                        if (sttProviderRef.current === 'xai' && xaiUnconfirmedNoiseRef.current) {
                            bargeInSpeechFramesRef.current = 0;
                        } else {
                            bargeInSpeechFramesRef.current += 1;
                        }
                        if (!xaiUnconfirmedNoiseRef.current && bargeInSpeechFramesRef.current >= BARGE_IN_REQUIRED_FRAMES) {
                            lastBargeInAtRef.current = performance.now();
                            if (!ttsDuckedRef.current) {
                                L('barge-in: likely user speech during TTS; ducking playback', 'rms=', rms.toFixed(4));
                                duckTtsVolume();
                                scheduleTtsRestore({ ignoreMicActivity: sttProviderRef.current === 'xai' });
                            }
                        }
                    } else {
                        bargeInSpeechFramesRef.current = 0;
                        if (sttProviderRef.current === 'xai' && xaiUnconfirmedNoiseRef.current) {
                            xaiNoiseQuietFramesRef.current += 1;
                            if (xaiNoiseQuietFramesRef.current >= XAI_NOISE_RESET_QUIET_FRAMES) {
                                xaiUnconfirmedNoiseRef.current = false;
                                xaiNoiseQuietFramesRef.current = 0;
                                L('xAI noise suppression reset after sustained quiet');
                            }
                        }
                    }
                } else {
                    bargeInSpeechFramesRef.current = 0;
                }
                const down = downsample(input, inCtx.sampleRate, INPUT_RATE);
                const pcm = floatTo16BitPCM(down);
                const audioFrame = { data: int16ToBase64(pcm), samples: pcm.length };
                rememberSentAudioFrame(audioFrame, hasSpeech);
                if (hasSpeech && currentUtteranceSpeechFramesRef.current >= VOICE_RETRY_MIN_SPEECH_FRAMES) {
                    armNoTranscriptWatchdog();
                }
                try {
                    sttSessionRef.current.sendRealtimeInput({
                        audio: { data: audioFrame.data, mimeType: 'audio/pcm;rate=' + INPUT_RATE },
                    });
                    framesSentRef.current += 1;
                    if (framesSentRef.current <= 3 || framesSentRef.current % 50 === 0) {
                        L('STT audio frame OUT #', framesSentRef.current, 'samples=', pcm.length);
                    }
                } catch (err: any) {
                    L('sendRealtimeInput STT error', err);
                    scheduleSttReconnect('sendRealtimeInput error', 'STT input failed: ' + (err?.message || 'unknown'));
                }
            };
            source.connect(proc);
            proc.connect(inCtx.destination);

            L('start: STT session and streaming TTS ready, audio graph wired. SPEAK.');
            activeRef.current = true;
            setActive(true);
            setStatus(hasAudiblePlayback() ? 'speaking' : sttSetupCompleteRef.current ? 'listening' : 'connecting');
        } catch (e: any) {
            console.error('[voice] start failed:', e);
            const preservePlaybackOnFailure = preservePlaybackOnStart && hasActiveTts();
            closedRef.current = !preservePlaybackOnFailure;
            cleanup({
                preservePlayback: preservePlaybackOnFailure,
                preserveBrainTurn: preservePlaybackOnFailure && processingTranscriptRef.current,
                reason: 'voice start failed',
            });
            activeRef.current = false;
            setActive(false);
            setError(e?.message || 'Voice failed to start');
            setStatus(preservePlaybackOnFailure ? (hasAudiblePlayback() ? 'speaking' : 'thinking') : 'error');
        }
    }, [armNoTranscriptWatchdog, cleanup, clikUrl, connectXaiStt, duckTtsVolume, ensureOutputContext, hasActiveTts, hasAudiblePlayback, rememberSentAudioFrame, resetRuntimeRefs, scheduleSttReconnect, scheduleTtsRestore, stopPlayback]);

    useEffect(() => {
        startRef.current = start;
        return () => {
            if (startRef.current === start) {
                startRef.current = null;
            }
        };
    }, [start]);

    useEffect(() => {
        return () => {
            closedRef.current = true;
            sttRecoveringRef.current = false;
            cleanup();
            clearSavedRetry();
        };
    }, [cleanup, clearSavedRetry]);

    const replaySavedAudioFrames = useCallback(async (frames: SavedVoiceFrame[]) => {
        if (!sttSessionRef.current) {
            throw new Error('No STT session available for retry');
        }

        for (const frame of frames) {
            if (closedRef.current || !sttSessionRef.current) break;
            sttSessionRef.current.sendRealtimeInput({
                audio: { data: frame.data, mimeType: 'audio/pcm;rate=' + INPUT_RATE },
            });
            await new Promise((resolve) => setTimeout(resolve, Math.max(12, Math.min(120, (frame.samples / INPUT_RATE) * 1000))));
        }

        const silence = int16ToBase64(new Int16Array(Math.round(INPUT_RATE * 0.12)));
        for (let i = 0; i < VOICE_RETRY_SILENCE_FRAMES; i++) {
            if (closedRef.current || !sttSessionRef.current) break;
            sttSessionRef.current.sendRealtimeInput({
                audio: { data: silence, mimeType: 'audio/pcm;rate=' + INPUT_RATE },
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }, []);

    const retryLastAudio = useCallback(async () => {
        const transcript = retryTranscriptRef.current.trim();
        const frames = retryAudioFramesRef.current.slice();
        if (!transcript && frames.length === 0) {
            return;
        }

        setError(null);
        setCanRetryAudio(false);

        if (transcript) {
            L('retrying saved transcript:', transcript.slice(0, 120));
            await processTranscript(transcript);
            return;
        }

        try {
            L('retrying saved voice audio frames:', frames.length);
            setStatus('connecting');
            sttReconnectAttemptsRef.current = 0;
            if (!activeRef.current || closedRef.current || !sttSessionRef.current) {
                await start();
            }
            const sttReady = await waitForSttReady();
            if (!sttReady || !sttSessionRef.current) {
                throw new Error('STT session was not ready');
            }
            setStatus('listening');
            transcriptRef.current = '';
            clearCurrentAudioCapture();
            currentUtteranceFramesRef.current = frames.slice(-VOICE_RETRY_MAX_FRAMES);
            currentUtteranceSpeechFramesRef.current = Math.max(VOICE_RETRY_MIN_SPEECH_FRAMES, Math.min(frames.length, VOICE_RETRY_MAX_FRAMES));
            lastMicSpeechAtRef.current = performance.now();
            await replaySavedAudioFrames(frames);
            armNoTranscriptWatchdog();
        } catch (e: any) {
            L('retry saved voice failed:', e);
            setCanRetryAudio(true);
            setError('Voice retry failed: ' + (e?.message || 'unknown error'));
            setStatus('error');
        }
    }, [armNoTranscriptWatchdog, clearCurrentAudioCapture, processTranscript, replaySavedAudioFrames, start, waitForSttReady]);

    const toggle = useCallback(() => {
        L('toggle, active=', active);
        if (active) {
            stop();
        } else {
            void ensureOutputContext().catch((e) => {
                L('audio unlock failed', e);
            });
            void start();
        }
    }, [active, ensureOutputContext, start, stop]);

    useEffect(() => { drainAutomaticSpeechRef.current(); }, [status, acceptedSpeechPending, inputReceipt]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if ((activeRef.current || ttsSpeakingRef.current || ttsAbortRef.current)
                && isPaidConversationTier(store.getState().settings.conversationModel)) {
                void pollConciergeVoiceReceipts(clikUrl);
            }
        }, 10_000);
        return () => {
            window.clearInterval(timer);
            void pollConciergeVoiceReceipts(clikUrl);
        };
    }, [clikUrl]);

    return { ttsDelivery, inputPending: acceptedSpeechPending || inputReceipt !== null, captureAvailable: active && captureConnected, inputReceipt, active, status, error, level, canRetryAudio, retryLastAudio, start, stop, toggle, askText, speakText, stopSpeech, queueAutomaticSpeech, cancelAutomaticSpeech };
}

