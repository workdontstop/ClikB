// useGeminiVoice: Gemini Live handles STT; deterministic streaming TTS speaks Brainstorm replies.
import { useCallback, useEffect, useRef, useState } from 'react';
import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity, TurnCoverage } from '@google/genai';

const L = (...a: any[]) => console.log('%c[voice]', 'color:#b07cff;font-weight:bold', ...a);

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

type SavedVoiceFrame = {
    data: string;
    samples: number;
};

interface UseGeminiVoiceArgs {
    clikUrl: string;
    callBrain: (text: string, signal?: AbortSignal) => Promise<string>;
    ttsVoice?: string;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const TRANSCRIPT_SETTLE_MS = 2200;
const TRANSCRIPT_TURN_COMPLETE_SETTLE_MS = 1400;
const MIC_ACTIVITY_HOLD_MS = 900;
const BARGE_IN_RMS_THRESHOLD = 0.04;
const BARGE_IN_REQUIRED_FRAMES = 5;
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
const TTS_ECHO_GRACE_MS = 1400;
const RECENT_TRANSCRIPT_TTL_MS = 12000;
const TTS_DUCK_GAIN = 0.06;
const TTS_DUCK_RESTORE_MS = 850;
const TTS_DUCK_RESTORE_POLL_MS = 160;
const TTS_DUCK_ATTACK_SECONDS = 0.025;
const TTS_DUCK_RELEASE_SECONDS = 0.12;

// xAI streaming STT (provider 'xai'): the backend proxies mic PCM to wss://api.x.ai/v1/stt.
// Smart Turn decides end-of-turn server-side, so speech_final is processed almost
// immediately; chunk finals only keep a long local fallback as a safety net.
const XAI_STT_WS_PATH = '/xaiSttStream';
const XAI_SPEECH_FINAL_SETTLE_MS = 200;
const XAI_CHUNK_FINAL_FALLBACK_MS = 5000;

// Gemini Live input transcription is enabled by passing an (empty) AudioTranscriptionConfig.
// IMPORTANT: languageHints / adaptationPhrases are NOT valid keys on inputAudioTranscription.
// On gemini-*-live models, including them makes the server silently drop transcription entirely,
// which shows up as "audio frames OUT but inputTranscription=undefined" â†’ the no-transcript
// reconnect loop. Keep this an empty object so transcription actually flows.
// (Old adaptation phrases kept here for reference only: ClikB, ClickB, Clickby, Clik, Brainstorm,
//  Creative Scenes, Memes, voice mode, Gemini Live, OpenAI, web search, globe.)
const STT_TRANSCRIPTION_CONFIG = {};

const STT_REALTIME_INPUT_CONFIG = {
    automaticActivityDetection: {
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        prefixPaddingMs: 220,
        silenceDurationMs: 1300,
    },
    turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
};

const STT_INSTRUCTION = [
    'You are ClikB voice input only.',
    'Your job is to transcribe microphone speech for the app.',
    'Do not answer questions, do not brainstorm, and do not give advice.',
    'If you produce any text response, it will be ignored; only input transcription matters.',
].join(' ');

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
        /\b(?:clikb|brainstorm|magic mirror|shorts|cinema|interactions|interactive|games|mode|scene|scenes|meme|memes|video|image|template|create|make|generate|app|my app|this app)\b/.test(normalized) ||
        /\b(?:on|in|inside|using|use|with|for)\s+(?:clickbank|click bank|clickbait|click bait|click b|clik b|clickbee|clikbee|clickby)\b/.test(normalized);
    if (!directCorrection && !clikbContext) return trimmed;

    return trimmed.replace(/\b(?:click\s*bank|click\s*bait|click\s+b|clik\s+b|clickbee|clikbee|clickby)\b/gi, 'ClikB');
}

function isFillerOnly(text: string): boolean {
    const normalized = normalizeTranscript(text);
    if (!normalized) return false;
    const fillers = new Set(['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm', 'hm', 'mm', 'ah']);
    return normalized.split(' ').every((word) => fillers.has(word));
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

export function useGeminiVoice(args: UseGeminiVoiceArgs) {
    const { clikUrl, callBrain, ttsVoice = 'Kore' } = args;

    const [active, setActive] = useState(false);
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
    const closedRef = useRef<boolean>(false);
    const transcriptRef = useRef<string>('');
    const transcriptFinalizeTimerRef = useRef<number | null>(null);
    const lastMicSpeechAtRef = useRef<number>(0);
    const processingTranscriptRef = useRef<boolean>(false);
    const brainAbortRef = useRef<AbortController | null>(null);
    const voiceTurnIdRef = useRef(0);
    const activeTranscriptNormRef = useRef<string>('');
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

    const scheduleTtsRestore = useCallback(() => {
        clearDuckRestoreTimer();

        const armRestore = (delayMs: number) => {
            duckRestoreTimerRef.current = window.setTimeout(() => {
                duckRestoreTimerRef.current = null;
                if (!ttsSpeakingRef.current || !ttsDuckedRef.current) {
                    return;
                }

                const quietForMs = performance.now() - lastMicSpeechAtRef.current;
                if (transcriptRef.current.trim() || quietForMs < TTS_DUCK_RESTORE_MS) {
                    armRestore(TTS_DUCK_RESTORE_POLL_MS);
                    return;
                }

                L('TTS duck restored after quiet window');
                restoreTtsVolume();
                setStatus('speaking');
            }, delayMs);
        };

        armRestore(TTS_DUCK_RESTORE_MS);
    }, [clearDuckRestoreTimer, restoreTtsVolume]);
    const stopPlayback = useCallback(() => {
        const wasSpeaking = ttsSpeakingRef.current;
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
        }
        bargeInSpeechFramesRef.current = 0;
    }, [clearDuckRestoreTimer, restoreTtsVolume]);

    const stopSpeech = useCallback(() => {
        L('stopSpeech()');
        stopPlayback();
        if (!closedRef.current) {
            setStatus(activeRef.current ? 'listening' : 'idle');
        }
    }, [stopPlayback]);

    const resetRuntimeRefs = useCallback(() => {
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
            transcriptFinalizeTimerRef.current = null;
        }
        transcriptRef.current = '';
        sttSetupCompleteRef.current = false;
        lastMicSpeechAtRef.current = 0;
        clearCurrentAudioCapture();
        processingTranscriptRef.current = false;
        lastProcessedTranscriptRef.current = '';
        lastProcessedTranscriptNormRef.current = '';
        activeTranscriptNormRef.current = '';
        try { brainAbortRef.current?.abort(); } catch (e) { void e; }
        brainAbortRef.current = null;
        ttsSpeakingRef.current = false;
        ttsDuckedRef.current = false;
        currentTtsTextNormRef.current = '';
        lastTtsTextNormRef.current = '';
        bargeInSpeechFramesRef.current = 0;
        lastBargeInAtRef.current = 0;
        lastTtsEndedAtRef.current = 0;
        ignoredSttTextPartsRef.current = 0;
        audioChunksRef.current = 0;
        framesSentRef.current = 0;
    }, [clearCurrentAudioCapture]);

    const cleanup = useCallback(() => {
        L('cleanup()');
        sttSetupCompleteRef.current = false;
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
        stopPlayback();
        try { outCtxRef.current?.close(); } catch (e) { void e; }
        outCtxRef.current = null;
        try { sttSessionRef.current?.close?.(); } catch (e) { void e; }
        sttSessionRef.current = null;
        resetRuntimeRefs();
        setLevel(0);
    }, [resetRuntimeRefs, resolveSttReadyWaiters, stopPlayback]);

    const scheduleSttReconnect = useCallback((reason: string, finalError: string) => {
        if (closedRef.current || sttRecoveringRef.current) {
            return false;
        }

        saveRetryCapture(reason);
        const canReconnect = activeRef.current && sttReconnectAttemptsRef.current < MAX_STT_RECONNECT_ATTEMPTS;
        if (!canReconnect) {
            closedRef.current = true;
            sttRecoveringRef.current = false;
            setError(finalError);
            setStatus('error');
            cleanup();
            activeRef.current = false;
            setActive(false);
            return false;
        }

        L('STT recovering:', reason, 'attempt=', sttReconnectAttemptsRef.current + 1);
        sttReconnectAttemptsRef.current += 1;
        sttRecoveringRef.current = true;
        closedRef.current = true;
        setError(null);
        setStatus('connecting');
        cleanup();
        activeRef.current = false;
        setActive(true);
        reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            closedRef.current = false;
            sttRecoveringRef.current = false;
            void startRef.current?.();
        }, STT_RECONNECT_DELAY_MS);
        return true;
    }, [cleanup, saveRetryCapture]);

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
            try { await outCtxRef.current.resume(); } catch (e) { void e; }
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

    const sendReplyForTts = useCallback(async (reply: string, options?: { allowWhenStopped?: boolean }) => {
        const text = (reply || '').trim();
        const allowWhenStopped = !!options?.allowWhenStopped;
        if (!text || (closedRef.current && !allowWhenStopped)) {
            return;
        }
        if (allowWhenStopped && closedRef.current) {
            closedRef.current = false;
        }

        L('TTS stream <- Brainstorm reply:', text.slice(0, 120), 'voice=', ttsVoice);
        await ensureOutputContext();
        stopPlayback();
        restoreTtsVolume(true);
        currentTtsTextNormRef.current = normalizeTranscript(text);
        lastTtsTextNormRef.current = currentTtsTextNormRef.current;
        const runId = ttsRunIdRef.current + 1;
        ttsRunIdRef.current = runId;
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        ttsSpeakingRef.current = true;
        audioChunksRef.current = 0;
        setStatus('speaking');

        try {
            const resp = await fetch(clikUrl + '/voiceTtsStream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: ttsVoice, speakingRate: 1.04 }),
                signal: controller.signal,
            });
            if (!resp.ok || !resp.body) {
                throw new Error(`TTS HTTP ${resp.status}`);
            }

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
            await waitForPlaybackDrain();
            if (!closedRef.current && ttsRunIdRef.current === runId) {
                setStatus(activeRef.current ? 'listening' : 'idle');
            }
        } catch (e: any) {
            if (controller.signal.aborted || closedRef.current) {
                L('TTS stream aborted');
                return;
            }
            L('voiceTtsStream error', e);
            setStatus('error');
            setError('Voice TTS failed');
        } finally {
            if (ttsAbortRef.current === controller) {
                ttsAbortRef.current = null;
            }
            if (ttsRunIdRef.current === runId) {
                ttsSpeakingRef.current = false;
                currentTtsTextNormRef.current = '';
                ttsDuckedRef.current = false;
                lastTtsEndedAtRef.current = performance.now();
            }
        }
    }, [clikUrl, ensureOutputContext, playPcm, restoreTtsVolume, stopPlayback, ttsVoice, waitForPlaybackDrain]);

    const speakText = useCallback((text: string) => {
        return sendReplyForTts(text, { allowWhenStopped: true });
    }, [sendReplyForTts]);
    const processTranscript = useCallback(async (rawText: string) => {
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
            transcriptFinalizeTimerRef.current = null;
        }
        const text = correctClikbAliasTranscript(collapseRepeatedShortTranscript((rawText || '').trim()));
        if (!text) {
            return;
        }
        if (isFillerOnly(text)) {
            L('filler-only transcript ignored:', text);
            return;
        }

        const normalizedText = normalizeTranscript(text);
        if (!normalizedText) {
            return;
        }

        const now = performance.now();
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

        if (processingTranscriptRef.current) {
            L('new transcript supersedes in-flight brain turn:', text);
        }

        const turnId = voiceTurnIdRef.current + 1;
        voiceTurnIdRef.current = turnId;
        try { brainAbortRef.current?.abort(); } catch (e) { void e; }
        const brainController = new AbortController();
        brainAbortRef.current = brainController;

        transcriptRef.current = '';
        clearSavedRetry();
        clearCurrentAudioCapture();
        processingTranscriptRef.current = true;
        activeTranscriptNormRef.current = normalizedText;
        recentTranscriptNormsRef.current.set(normalizedText, now);
        lastProcessedTranscriptRef.current = text;
        lastProcessedTranscriptNormRef.current = normalizedText;
        stopPlayback();
        setStatus('thinking');

        let reply = '';
        let shouldSpeak = false;
        try {
            L('STT -> Brainstorm:', text);
            reply = await callBrain(text, brainController.signal);
            if (brainController.signal.aborted || voiceTurnIdRef.current !== turnId) {
                L('brain reply ignored for stale/aborted voice turn:', text);
                return;
            }
            L('Brainstorm -> text:', reply.slice(0, 120));
            shouldSpeak = true;
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
            shouldSpeak = true;
        } finally {
            if (brainAbortRef.current === brainController) {
                brainAbortRef.current = null;
            }
            if (voiceTurnIdRef.current === turnId) {
                processingTranscriptRef.current = false;
                if (activeTranscriptNormRef.current === normalizedText) {
                    activeTranscriptNormRef.current = '';
                }
            }
        }

        if (shouldSpeak && reply && voiceTurnIdRef.current === turnId && !closedRef.current) {
            void sendReplyForTts(reply);
        }
    }, [callBrain, clearCurrentAudioCapture, clearSavedRetry, sendReplyForTts, stopPlayback]);

    const scheduleTranscriptProcessing = useCallback((reason: string, delayMs = TRANSCRIPT_SETTLE_MS, opts?: { ignoreMicHold?: boolean }) => {
        if (transcriptFinalizeTimerRef.current != null) {
            window.clearTimeout(transcriptFinalizeTimerRef.current);
        }

        const armTimer = (nextDelayMs: number) => {
            transcriptFinalizeTimerRef.current = window.setTimeout(() => {
                transcriptFinalizeTimerRef.current = null;
                const pendingTranscript = transcriptRef.current.trim();
                if (!pendingTranscript) return;

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
            resolveSttReadyWaiters(true);
            if (!processingTranscriptRef.current && !ttsSpeakingRef.current) {
                setStatus('listening');
            }
        }

        const inputTranscription = message?.serverContent?.inputTranscription;
        const transcriptText = correctClikbAliasTranscript(String(inputTranscription?.text ?? '').trim());
        if (transcriptText) {
            clearNoTranscriptWatchdog();
            const now = performance.now();
            const hasConfirmedBargeIn = lastBargeInAtRef.current > 0 && now - lastBargeInAtRef.current <= BARGE_IN_TRANSCRIPT_WINDOW_MS;
            const isPostTtsEchoWindow = lastTtsEndedAtRef.current > 0 && now - lastTtsEndedAtRef.current <= TTS_ECHO_GRACE_MS;
            const echoSource = currentTtsTextNormRef.current || lastTtsTextNormRef.current;
            const canBeEcho = !!echoSource && (ttsSpeakingRef.current || ttsDuckedRef.current || isPostTtsEchoWindow);

            if (canBeEcho && isLikelyEchoTranscript(transcriptText, echoSource)) {
                L('STT transcript ignored as TTS echo:', transcriptText);
                return;
            }

            const transcriptNorm = normalizeTranscript(transcriptText);
            if (processingTranscriptRef.current && transcriptNorm && transcriptNorm === activeTranscriptNormRef.current) {
                L('STT duplicate transcript ignored while brain is busy:', transcriptText);
                return;
            }
            if (ttsSpeakingRef.current && !hasConfirmedBargeIn) {
                L('STT transcript ignored during TTS without confirmed barge-in:', transcriptText);
                return;
            }
            if (ttsSpeakingRef.current) {
                L('barge-in: confirmed transcript during TTS; stopping playback');
                stopPlayback();
                setStatus('listening');
            }
            transcriptRef.current = mergeTranscript(transcriptRef.current, transcriptText);
            L('input transcript', inputTranscription?.finished ? '(finished)' : '(partial)', transcriptText, '| buffered=', transcriptRef.current);
            if (inputTranscription?.finished) {
                scheduleTranscriptProcessing('finished transcription');
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
            if (!processingTranscriptRef.current && !ttsSpeakingRef.current) {
                setStatus('listening');
            }
        }
    }, [clearNoTranscriptWatchdog, processTranscript, resolveSttReadyWaiters, scheduleTranscriptProcessing, stopPlayback]);

    // xAI streaming STT events: transcript.created -> ready,
    // transcript.partial -> { text, is_final, speech_final }, transcript.done -> flush.
    // Unlike the Gemini path, barge-in here is word-based: any non-echo transcript
    // arriving during TTS counts as a confirmed interruption (interim ducks, final stops).
    const handleXaiSttEvent = useCallback((event: any) => {
        if (closedRef.current) return;

        if (event?.type === 'transcript.created') {
            L('xAI STT ready (transcript.created)');
            sttSetupCompleteRef.current = true;
            resolveSttReadyWaiters(true);
            if (!processingTranscriptRef.current && !ttsSpeakingRef.current) {
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
        clearNoTranscriptWatchdog();

        const isFinal = event?.type === 'transcript.done' ? true : !!event?.is_final;
        const speechFinal = event?.type === 'transcript.done' ? true : !!event?.speech_final;

        const now = performance.now();
        const isPostTtsEchoWindow = lastTtsEndedAtRef.current > 0 && now - lastTtsEndedAtRef.current <= TTS_ECHO_GRACE_MS;
        const echoSource = currentTtsTextNormRef.current || lastTtsTextNormRef.current;
        const canBeEcho = !!echoSource && (ttsSpeakingRef.current || ttsDuckedRef.current || isPostTtsEchoWindow);
        if (canBeEcho && isLikelyEchoTranscript(transcriptText, echoSource)) {
            L('xAI transcript ignored as TTS echo:', transcriptText);
            return;
        }

        const transcriptNorm = normalizeTranscript(transcriptText);
        if (processingTranscriptRef.current && transcriptNorm && transcriptNorm === activeTranscriptNormRef.current) {
            L('xAI duplicate transcript ignored while brain is busy:', transcriptText);
            return;
        }

        if (ttsSpeakingRef.current) {
            lastBargeInAtRef.current = now;
            if (!isFinal) {
                L('xAI barge-in: interim words during TTS; ducking playback:', transcriptText);
                duckTtsVolume();
                scheduleTtsRestore();
            } else {
                L('xAI barge-in: final words during TTS; stopping playback:', transcriptText);
                stopPlayback();
                setStatus('listening');
            }
        }

        if (!isFinal) {
            // Interim text can still be revised by the server; never buffer it.
            L('xAI interim transcript:', transcriptText);
            return;
        }

        transcriptRef.current = mergeTranscript(transcriptRef.current, transcriptText);
        L('xAI transcript', speechFinal ? '(utterance final)' : '(chunk final)', transcriptText, '| buffered=', transcriptRef.current);
        if (speechFinal) {
            // Smart Turn already decided the user finished; process almost immediately.
            scheduleTranscriptProcessing('xai speech_final', XAI_SPEECH_FINAL_SETTLE_MS, { ignoreMicHold: true });
        } else {
            // Chunk final: text is locked but the utterance continues; long fallback only.
            scheduleTranscriptProcessing('xai chunk final fallback', XAI_CHUNK_FINAL_FALLBACK_MS);
        }
    }, [clearNoTranscriptWatchdog, duckTtsVolume, resolveSttReadyWaiters, scheduleTranscriptProcessing, scheduleTtsRestore, stopPlayback]);

    // Connects to the backend xAI STT proxy and returns an adapter with the same
    // surface the Gemini session exposes (sendRealtimeInput / close), so the rest
    // of the hook (mic pipeline, reconnects, retry replay) works unchanged.
    const connectXaiStt = useCallback((sessionId: number) => {
        const wsUrl = clikUrl.replace(/^http/i, 'ws') + XAI_STT_WS_PATH;
        L('STT: connecting to xAI proxy at', wsUrl);
        return new Promise<any>((resolve, reject) => {
            let settled = false;
            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';

            const adapter = {
                sendRealtimeInput: (input: any) => {
                    if (ws.readyState !== WebSocket.OPEN) return;
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
                    handleXaiSttEvent(JSON.parse(ev.data));
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
    }, [clikUrl, handleXaiSttEvent, scheduleSttReconnect]);

    const fetchLiveToken = useCallback(async () => {
        L('STT: fetching token from', clikUrl + '/liveToken');
        const resp = await fetch(clikUrl + '/liveToken', { method: 'POST' });
        L('STT: token resp status', resp.status);
        if (!resp.ok) {
            throw new Error(`STT token endpoint HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!data.token) {
            throw new Error('STT token missing from /liveToken');
        }
        return data as { token: string; model: string; sttModel?: string };
    }, [clikUrl]);

    const start = useCallback(async () => {
        if (activeRef.current && !closedRef.current) {
            L('start: already active');
            return;
        }
        setError(null);
        setStatus('connecting');
        closedRef.current = false;
        const sessionId = sttSessionIdRef.current + 1;
        sttSessionIdRef.current = sessionId;
        resetRuntimeRefs();
        try {
            // Provider flag lives on the backend (VOICE_STT_PROVIDER=gemini|xai).
            // Rollback is an env change + server restart; no frontend rebuild.
            let sttProvider: 'gemini' | 'xai' = 'gemini';
            try {
                const provResp = await fetch(clikUrl + '/sttProvider');
                if (provResp.ok) {
                    const provData = await provResp.json();
                    if (String(provData?.provider || '').toLowerCase() === 'xai') {
                        sttProvider = 'xai';
                    }
                }
            } catch (e) {
                L('sttProvider fetch failed; defaulting to gemini', e);
            }
            sttProviderRef.current = sttProvider;
            L('STT provider:', sttProvider);

            let sttSession: any;
            if (sttProvider === 'xai') {
                sttSession = await connectXaiStt(sessionId);
            } else {
            const sttToken = await fetchLiveToken();

            const sttAi: any = new GoogleGenAI({ apiKey: sttToken.token, httpOptions: { apiVersion: 'v1alpha' } });
            const sttModel = sttToken.sttModel || sttToken.model;

            L('STT: connecting to ai.live, model=', sttModel);
            sttSession = await sttAi.live.connect({
                model: sttModel,
                callbacks: {
                    onopen: () => {
                        if (sttSessionIdRef.current !== sessionId) return;
                        L('STT LIVE onopen');
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
                    },
                    onmessage: (m: any) => { if (!closedRef.current && sttSessionIdRef.current === sessionId) void handleSttMessage(m); },
                    onerror: (ev: any) => {
                        if (sttSessionIdRef.current !== sessionId) return;
                        const errorText = String(ev?.message || ev?.error?.message || 'unknown');
                        L('STT LIVE onerror', ev);
                        scheduleSttReconnect('stt error', 'STT error: ' + errorText);
                    },
                    onclose: (ev: any) => {
                        if (sttSessionIdRef.current !== sessionId) return;
                        const closeReason = String(ev?.reason || ('code ' + ev?.code) || 'unknown');
                        L('STT LIVE onclose code=', ev?.code, 'reason=', ev?.reason);
                        if (closedRef.current) return;
                        scheduleSttReconnect('stt close', 'STT closed: ' + closeReason);
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    maxOutputTokens: 1,
                    inputAudioTranscription: STT_TRANSCRIPTION_CONFIG,
                    realtimeInputConfig: STT_REALTIME_INPUT_CONFIG,
                    systemInstruction: STT_INSTRUCTION,
                },
            });
            }
            if (sttSessionIdRef.current !== sessionId || closedRef.current) {
                try { sttSession?.close?.(); } catch (e) { void e; }
                return;
            }
            sttSessionRef.current = sttSession;

            const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
            outCtxRef.current = new Ctx({ sampleRate: OUTPUT_RATE });
            outputGainRef.current = outCtxRef.current.createGain();
            outputGainRef.current.gain.value = 1;
            outputGainRef.current.connect(outCtxRef.current.destination);
            nextStartRef.current = 0;

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
                    setLevel(Math.min(1, rms * 4.8));
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
                if (ttsSpeakingRef.current) {
                    if (rms >= BARGE_IN_RMS_THRESHOLD) {
                        bargeInSpeechFramesRef.current += 1;
                        if (bargeInSpeechFramesRef.current >= BARGE_IN_REQUIRED_FRAMES) {
                            lastBargeInAtRef.current = performance.now();
                            if (!ttsDuckedRef.current) {
                                L('barge-in: likely user speech during TTS; ducking playback', 'rms=', rms.toFixed(4));
                            }
                            duckTtsVolume();
                            scheduleTtsRestore();
                        }
                    } else {
                        bargeInSpeechFramesRef.current = 0;
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
            setStatus(sttSetupCompleteRef.current ? 'listening' : 'connecting');
        } catch (e: any) {
            console.error('[voice] start failed:', e);
            closedRef.current = true;
            cleanup();
            activeRef.current = false;
            setActive(false);
            setError(e?.message || 'Voice failed to start');
            setStatus('error');
        }
    }, [armNoTranscriptWatchdog, cleanup, clikUrl, connectXaiStt, duckTtsVolume, fetchLiveToken, handleSttMessage, rememberSentAudioFrame, resetRuntimeRefs, scheduleSttReconnect, scheduleTtsRestore]);

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
            void start();
        }
    }, [active, start, stop]);

    return { active, status, error, level, canRetryAudio, retryLastAudio, start, stop, toggle, speakText, stopSpeech };
}
